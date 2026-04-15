const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, setupFullProtocol, getSelectors, FacetCutAction } = require("./helpers/deployDiamond");

describe("Spot Trading — Phase 2 Integration", function () {
  let d; // diamond deployment context
  let spotRegistry, spotSettlement, spotOrderBook;
  let weth, wbtc;
  let diamondAddress;
  let SPOT_ADMIN_ROLE;

  beforeEach(async function () {
    d = await deployFullDiamond();
    await setupFullProtocol(d);
    diamondAddress = d.diamondAddress;

    // --- Deploy spot facets ---
    const spotFacetNames = [
      "SpotMarketRegistryFacet",
      "SpotSettlementFacet",
      "SpotOrderBookFacet",
    ];

    const cuts = [];
    const addedSelectors = new Set();

    // Collect existing selectors from diamond
    const loupe = d.loupe;
    const existingFacets = await loupe.facets();
    for (const f of existingFacets) {
      for (const sel of f.functionSelectors) {
        addedSelectors.add(sel);
      }
    }

    for (const name of spotFacetNames) {
      const Factory = await ethers.getContractFactory(name);
      const facet = await Factory.deploy();
      await facet.waitForDeployment();

      let selectors = getSelectors(facet);
      selectors = selectors.filter((s) => !addedSelectors.has(s));
      if (selectors.length === 0) continue;
      for (const s of selectors) addedSelectors.add(s);

      cuts.push({
        facetAddress: await facet.getAddress(),
        action: FacetCutAction.Add,
        functionSelectors: selectors,
      });
    }

    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");

    // Get spot facet interfaces on diamond
    spotRegistry = await ethers.getContractAt("SpotMarketRegistryFacet", diamondAddress);
    spotSettlement = await ethers.getContractAt("SpotSettlementFacet", diamondAddress);
    spotOrderBook = await ethers.getContractAt("SpotOrderBookFacet", diamondAddress);

    // Grant SPOT_ADMIN_ROLE to owner
    SPOT_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SPOT_ADMIN"));
    await d.accessControl.grantRole(SPOT_ADMIN_ROLE, d.owner.address);

    // --- Deploy spot tokens ---
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    weth = await MockERC20.deploy("Wrapped Ether", "WETH", 18);
    await weth.waitForDeployment();
    wbtc = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    await wbtc.waitForDeployment();

    // Whitelist spot tokens
    const wethAddr = await weth.getAddress();
    const wbtcAddr = await wbtc.getAddress();
    const usdcAddr = await d.usdc.getAddress();

    await spotSettlement.addSpotToken(wethAddr, 18);
    await spotSettlement.addSpotToken(usdcAddr, 6);
    await spotSettlement.addSpotToken(wbtcAddr, 8);

    // Set epoch length
    await spotSettlement.setEpochLength(5);
  });

  // ============================================================
  //              SPOT MARKET REGISTRY TESTS
  // ============================================================
  describe("SpotMarketRegistryFacet", function () {
    it("creates a spot market", async function () {
      const wethAddr = await weth.getAddress();
      const usdcAddr = await d.usdc.getAddress();

      const tx = await spotRegistry.createSpotMarket(
        wethAddr, usdcAddr,
        0,    // CONTINUOUS
        1,    // minOrderSize = 1 (18 dec base units)
        500,  // maxOffsetBps = ±5%
        5,    // takerFeeBps = 0.05%
        -2    // makerRebateBps = -0.02%
      );

      const receipt = await tx.wait();
      const marketId = ethers.keccak256(
        ethers.solidityPacked(["address", "string", "address"], [wethAddr, "/", usdcAddr])
      );

      const market = await spotRegistry.getSpotMarket(marketId);
      expect(market.baseToken).to.equal(wethAddr);
      expect(market.quoteToken).to.equal(usdcAddr);
      expect(market.mode).to.equal(0);
      expect(market.active).to.equal(true);
      expect(market.minOrderSize).to.equal(1);
      expect(market.maxOffsetBps).to.equal(500);
      expect(market.takerFeeBps).to.equal(5);
      expect(market.makerRebateBps).to.equal(-2);
    });

    it("reverts creating market with non-whitelisted token", async function () {
      const wethAddr = await weth.getAddress();
      const randomAddr = ethers.Wallet.createRandom().address;

      await expect(
        spotRegistry.createSpotMarket(wethAddr, randomAddr, 0, 1, 500, 5, -2)
      ).to.be.revertedWith("SpotRegistry: quote token not whitelisted");
    });

    it("reverts creating duplicate market", async function () {
      const wethAddr = await weth.getAddress();
      const usdcAddr = await d.usdc.getAddress();

      await spotRegistry.createSpotMarket(wethAddr, usdcAddr, 0, 1, 500, 5, -2);
      await expect(
        spotRegistry.createSpotMarket(wethAddr, usdcAddr, 0, 1, 500, 5, -2)
      ).to.be.revertedWith("SpotRegistry: market already exists");
    });

    it("sets market mode", async function () {
      const wethAddr = await weth.getAddress();
      const usdcAddr = await d.usdc.getAddress();
      await spotRegistry.createSpotMarket(wethAddr, usdcAddr, 0, 1, 500, 5, -2);

      const marketId = ethers.keccak256(
        ethers.solidityPacked(["address", "string", "address"], [wethAddr, "/", usdcAddr])
      );

      await spotRegistry.setSpotMarketMode(marketId, 1); // switch to BATCH
      const market = await spotRegistry.getSpotMarket(marketId);
      expect(market.mode).to.equal(1);
    });

    it("updates market params", async function () {
      const wethAddr = await weth.getAddress();
      const usdcAddr = await d.usdc.getAddress();
      await spotRegistry.createSpotMarket(wethAddr, usdcAddr, 0, 1, 500, 5, -2);

      const marketId = ethers.keccak256(
        ethers.solidityPacked(["address", "string", "address"], [wethAddr, "/", usdcAddr])
      );

      await spotRegistry.setSpotMarketParams(marketId, 10, 1000, 10, -5);
      const market = await spotRegistry.getSpotMarket(marketId);
      expect(market.minOrderSize).to.equal(10);
      expect(market.maxOffsetBps).to.equal(1000);
      expect(market.takerFeeBps).to.equal(10);
      expect(market.makerRebateBps).to.equal(-5);
    });

    it("disables and re-enables market", async function () {
      const wethAddr = await weth.getAddress();
      const usdcAddr = await d.usdc.getAddress();
      await spotRegistry.createSpotMarket(wethAddr, usdcAddr, 0, 1, 500, 5, -2);

      const marketId = ethers.keccak256(
        ethers.solidityPacked(["address", "string", "address"], [wethAddr, "/", usdcAddr])
      );

      await spotRegistry.disableSpotMarket(marketId);
      expect(await spotRegistry.isSpotMarketActive(marketId)).to.equal(false);

      await spotRegistry.enableSpotMarket(marketId);
      expect(await spotRegistry.isSpotMarketActive(marketId)).to.equal(true);
    });

    it("non-admin cannot create market", async function () {
      const wethAddr = await weth.getAddress();
      const usdcAddr = await d.usdc.getAddress();
      await expect(
        spotRegistry.connect(d.user1).createSpotMarket(wethAddr, usdcAddr, 0, 1, 500, 5, -2)
      ).to.be.revertedWith("LibAccessControl: account is missing role");
    });

    it("returns active spot markets", async function () {
      const wethAddr = await weth.getAddress();
      const usdcAddr = await d.usdc.getAddress();
      const wbtcAddr = await wbtc.getAddress();

      await spotRegistry.createSpotMarket(wethAddr, usdcAddr, 0, 1, 500, 5, -2);
      await spotRegistry.createSpotMarket(wbtcAddr, usdcAddr, 0, 1, 500, 5, -2);

      const ids = await spotRegistry.getActiveSpotMarkets();
      expect(ids.length).to.equal(2);
      expect(await spotRegistry.totalSpotMarkets()).to.equal(2);
    });
  });

  // ============================================================
  //              SPOT SETTLEMENT TESTS
  // ============================================================
  describe("SpotSettlementFacet", function () {
    let wethAddr, usdcAddr;

    beforeEach(async function () {
      wethAddr = await weth.getAddress();
      usdcAddr = await d.usdc.getAddress();
    });

    it("adds and removes spot tokens", async function () {
      const tokens = await spotSettlement.getSpotTokenList();
      expect(tokens.length).to.equal(3); // weth, usdc, wbtc

      expect(await spotSettlement.isSpotToken(wethAddr)).to.equal(true);

      const wbtcAddr = await wbtc.getAddress();
      await spotSettlement.removeSpotToken(wbtcAddr);
      expect(await spotSettlement.isSpotToken(wbtcAddr)).to.equal(false);

      const newTokens = await spotSettlement.getSpotTokenList();
      expect(newTokens.length).to.equal(2);
    });

    it("deposits spot collateral", async function () {
      // Create vault for user1
      await d.vaultFactory.connect(d.user1).createVault();
      const vaultAddr = await d.vaultFactory.getVault(d.user1.address);

      // Mint USDC to user1 and deposit into TradingAccount
      const depositAmount = 10000n * 10n ** 6n; // 10k USDC
      await d.usdc.mint(d.user1.address, depositAmount);
      await d.usdc.connect(d.user1).approve(vaultAddr, depositAmount);

      const vault = await ethers.getContractAt("TradingAccount", vaultAddr);
      await vault.connect(d.user1).deposit(usdcAddr, depositAmount);

      // Deposit into spot vault — lockCollateral is called by diamond on the vault
      await spotSettlement.connect(d.user1).depositSpotCollateral(usdcAddr, depositAmount);

      // Check virtual balance (normalized to 18 dec)
      const vBal = await spotSettlement.getSpotVirtualBalance(d.user1.address, usdcAddr);
      expect(vBal).to.equal(depositAmount * 10n ** 12n); // 6 dec → 18 dec

      // Check deposited collateral (raw)
      const deposited = await spotSettlement.getSpotDepositedCollateral(d.user1.address, usdcAddr);
      expect(deposited).to.equal(depositAmount);
    });

    it("withdraws spot collateral", async function () {
      // Setup: create vault + deposit
      await d.vaultFactory.connect(d.user1).createVault();
      const vaultAddr = await d.vaultFactory.getVault(d.user1.address);

      const depositAmount = 5000n * 10n ** 6n;
      await d.usdc.mint(d.user1.address, depositAmount);
      await d.usdc.connect(d.user1).approve(vaultAddr, depositAmount);

      const vault = await ethers.getContractAt("TradingAccount", vaultAddr);
      await vault.connect(d.user1).deposit(usdcAddr, depositAmount);
      await spotSettlement.connect(d.user1).depositSpotCollateral(usdcAddr, depositAmount);

      // Withdraw half
      const withdrawAmount = 2500n * 10n ** 6n;
      await spotSettlement.connect(d.user1).withdrawSpotCollateral(usdcAddr, withdrawAmount);

      const vBal = await spotSettlement.getSpotVirtualBalance(d.user1.address, usdcAddr);
      expect(vBal).to.equal((depositAmount - withdrawAmount) * 10n ** 12n);

      const deposited = await spotSettlement.getSpotDepositedCollateral(d.user1.address, usdcAddr);
      expect(deposited).to.equal(depositAmount - withdrawAmount);
    });

    it("reverts withdraw exceeding withdrawable", async function () {
      await d.vaultFactory.connect(d.user1).createVault();
      const vaultAddr = await d.vaultFactory.getVault(d.user1.address);

      const depositAmount = 1000n * 10n ** 6n;
      await d.usdc.mint(d.user1.address, depositAmount);
      await d.usdc.connect(d.user1).approve(vaultAddr, depositAmount);

      const vault = await ethers.getContractAt("TradingAccount", vaultAddr);
      await vault.connect(d.user1).deposit(usdcAddr, depositAmount);
      await spotSettlement.connect(d.user1).depositSpotCollateral(usdcAddr, depositAmount);

      await expect(
        spotSettlement.connect(d.user1).withdrawSpotCollateral(usdcAddr, depositAmount + 1n)
      ).to.be.revertedWith("SpotSettlement: exceeds withdrawable");
    });

    it("returns epoch info", async function () {
      const info = await spotSettlement.getEpochInfo();
      expect(info.epochLength).to.equal(5);
    });

    it("sets fast settle fee", async function () {
      await spotSettlement.setFastSettleFeeBps(5);
      // No direct getter for feeBps but no revert means it worked
    });
  });

  // ============================================================
  //              SPOT ORDER BOOK TESTS
  // ============================================================
  describe("SpotOrderBookFacet", function () {
    let wethAddr, usdcAddr, marketId;

    beforeEach(async function () {
      wethAddr = await weth.getAddress();
      usdcAddr = await d.usdc.getAddress();

      // Create ETH/USDC spot market
      await spotRegistry.createSpotMarket(wethAddr, usdcAddr, 0, 1, 500, 5, -2);
      marketId = ethers.keccak256(
        ethers.solidityPacked(["address", "string", "address"], [wethAddr, "/", usdcAddr])
      );

      // Set oracle price for this spot market via SpotMarketRegistryFacet
      const oraclePrice = ethers.parseEther("3000"); // $3000 ETH
      await spotRegistry.connect(d.oraclePoster).updateSpotPrice(marketId, oraclePrice);
    });

    it("places a spot order", async function () {
      // Setup user with collateral
      await d.vaultFactory.connect(d.user1).createVault();
      const vaultAddr = await d.vaultFactory.getVault(d.user1.address);

      // Deposit USDC for buying
      const depositAmount = 100000n * 10n ** 6n; // 100k USDC
      await d.usdc.mint(d.user1.address, depositAmount);
      await d.usdc.connect(d.user1).approve(vaultAddr, depositAmount);

      const vault = await ethers.getContractAt("TradingAccount", vaultAddr);
      await vault.connect(d.user1).deposit(usdcAddr, depositAmount);
      await spotSettlement.connect(d.user1).depositSpotCollateral(usdcAddr, depositAmount);

      // Place buy order: buy 1 ETH at -10 bps from oracle
      const tx = await spotOrderBook.connect(d.user1).placeSpotOrder(
        marketId,
        0,    // BUY
        1,    // LIMIT
        -10,  // -10 bps from oracle
        ethers.parseEther("1")  // 1 ETH (18 dec)
      );

      const receipt = await tx.wait();
      const orderId = 0; // first order

      const order = await spotOrderBook.getSpotOrder(orderId);
      expect(order.trader).to.equal(d.user1.address);
      expect(order.marketId).to.equal(marketId);
      expect(order.side).to.equal(0); // BUY
      expect(order.active).to.equal(true);
    });

    it("cancels a spot order", async function () {
      await d.vaultFactory.connect(d.user1).createVault();
      const vaultAddr = await d.vaultFactory.getVault(d.user1.address);

      const depositAmount = 100000n * 10n ** 6n;
      await d.usdc.mint(d.user1.address, depositAmount);
      await d.usdc.connect(d.user1).approve(vaultAddr, depositAmount);

      const vault = await ethers.getContractAt("TradingAccount", vaultAddr);
      await vault.connect(d.user1).deposit(usdcAddr, depositAmount);
      await spotSettlement.connect(d.user1).depositSpotCollateral(usdcAddr, depositAmount);

      await spotOrderBook.connect(d.user1).placeSpotOrder(
        marketId, 0, 1, -10, ethers.parseEther("1")
      );

      await spotOrderBook.connect(d.user1).cancelSpotOrder(0);
      const order = await spotOrderBook.getSpotOrder(0);
      expect(order.active).to.equal(false);
    });

    it("non-owner cannot cancel order", async function () {
      await d.vaultFactory.connect(d.user1).createVault();
      const vaultAddr = await d.vaultFactory.getVault(d.user1.address);

      const depositAmount = 100000n * 10n ** 6n;
      await d.usdc.mint(d.user1.address, depositAmount);
      await d.usdc.connect(d.user1).approve(vaultAddr, depositAmount);

      const vault = await ethers.getContractAt("TradingAccount", vaultAddr);
      await vault.connect(d.user1).deposit(usdcAddr, depositAmount);
      await spotSettlement.connect(d.user1).depositSpotCollateral(usdcAddr, depositAmount);

      await spotOrderBook.connect(d.user1).placeSpotOrder(
        marketId, 0, 1, -10, ethers.parseEther("1")
      );

      await expect(
        spotOrderBook.connect(d.user2).cancelSpotOrder(0)
      ).to.be.revertedWith("SpotOrderBook: not order owner");
    });

    it("returns user spot orders", async function () {
      await d.vaultFactory.connect(d.user1).createVault();
      const vaultAddr = await d.vaultFactory.getVault(d.user1.address);

      const depositAmount = 100000n * 10n ** 6n;
      await d.usdc.mint(d.user1.address, depositAmount);
      await d.usdc.connect(d.user1).approve(vaultAddr, depositAmount);

      const vault = await ethers.getContractAt("TradingAccount", vaultAddr);
      await vault.connect(d.user1).deposit(usdcAddr, depositAmount);
      await spotSettlement.connect(d.user1).depositSpotCollateral(usdcAddr, depositAmount);

      await spotOrderBook.connect(d.user1).placeSpotOrder(
        marketId, 0, 1, -10, ethers.parseEther("1")
      );
      await spotOrderBook.connect(d.user1).placeSpotOrder(
        marketId, 0, 1, -20, ethers.parseEther("2")
      );

      const orderIds = await spotOrderBook.getUserSpotOrders(d.user1.address);
      expect(orderIds.length).to.equal(2);
    });

    it("reverts order on inactive market", async function () {
      await spotRegistry.disableSpotMarket(marketId);

      await d.vaultFactory.connect(d.user1).createVault();
      const vaultAddr = await d.vaultFactory.getVault(d.user1.address);

      const depositAmount = 100000n * 10n ** 6n;
      await d.usdc.mint(d.user1.address, depositAmount);
      await d.usdc.connect(d.user1).approve(vaultAddr, depositAmount);

      const vault = await ethers.getContractAt("TradingAccount", vaultAddr);
      await vault.connect(d.user1).deposit(usdcAddr, depositAmount);
      await spotSettlement.connect(d.user1).depositSpotCollateral(usdcAddr, depositAmount);

      await expect(
        spotOrderBook.connect(d.user1).placeSpotOrder(
          marketId, 0, 1, -10, ethers.parseEther("1")
        )
      ).to.be.revertedWith("SpotOrderBook: market not active");
    });

    it("reverts order exceeding max offset", async function () {
      await d.vaultFactory.connect(d.user1).createVault();
      const vaultAddr = await d.vaultFactory.getVault(d.user1.address);

      const depositAmount = 100000n * 10n ** 6n;
      await d.usdc.mint(d.user1.address, depositAmount);
      await d.usdc.connect(d.user1).approve(vaultAddr, depositAmount);

      const vault = await ethers.getContractAt("TradingAccount", vaultAddr);
      await vault.connect(d.user1).deposit(usdcAddr, depositAmount);
      await spotSettlement.connect(d.user1).depositSpotCollateral(usdcAddr, depositAmount);

      // Max offset is 500 bps (±5%), try 600
      await expect(
        spotOrderBook.connect(d.user1).placeSpotOrder(
          marketId, 0, 1, 600, ethers.parseEther("1")
        )
      ).to.be.revertedWith("SpotOrderBook: offset exceeds max");
    });
  });
});
