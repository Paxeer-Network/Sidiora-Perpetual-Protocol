const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, setupFullProtocol, getSelectors, FacetCutAction } = require("./helpers/deployDiamond");

describe("Spot Trading — Phase 4: Infrastructure (PLV, PoFQ, SpotKeeper)", function () {
  let d;
  let spotRegistry, spotSettlement, spotOrderBook, spotBatchAuction, spotModeSwitch;
  let plvRegistry, pofqFacet, spotKeeper;
  let weth, mockPLV, mockPLV2;
  let diamondAddress;
  let SPOT_ADMIN_ROLE, KEEPER_ROLE;
  let wethAddr, usdcAddr, marketId;

  beforeEach(async function () {
    d = await deployFullDiamond();
    await setupFullProtocol(d);
    diamondAddress = d.diamondAddress;

    // --- Deploy all spot facets (Phase 1-3 + Phase 4) ---
    const spotFacetNames = [
      "SpotMarketRegistryFacet",
      "SpotSettlementFacet",
      "SpotOrderBookFacet",
      "SpotBatchAuctionFacet",
      "SpotModeSwitchFacet",
      "PLVRegistryFacet",
      "PoFQFacet",
      "SpotKeeperMulticallFacet",
    ];

    const cuts = [];
    const addedSelectors = new Set();

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

    // Get facet interfaces
    spotRegistry = await ethers.getContractAt("SpotMarketRegistryFacet", diamondAddress);
    spotSettlement = await ethers.getContractAt("SpotSettlementFacet", diamondAddress);
    spotOrderBook = await ethers.getContractAt("SpotOrderBookFacet", diamondAddress);
    spotBatchAuction = await ethers.getContractAt("SpotBatchAuctionFacet", diamondAddress);
    spotModeSwitch = await ethers.getContractAt("SpotModeSwitchFacet", diamondAddress);
    plvRegistry = await ethers.getContractAt("PLVRegistryFacet", diamondAddress);
    pofqFacet = await ethers.getContractAt("PoFQFacet", diamondAddress);
    spotKeeper = await ethers.getContractAt("SpotKeeperMulticallFacet", diamondAddress);

    // Grant roles
    SPOT_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SPOT_ADMIN"));
    KEEPER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("KEEPER"));
    await d.accessControl.grantRole(SPOT_ADMIN_ROLE, d.owner.address);
    await d.accessControl.grantRole(KEEPER_ROLE, d.owner.address);

    // Deploy tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    weth = await MockERC20.deploy("Wrapped Ether", "WETH", 18);
    await weth.waitForDeployment();

    wethAddr = await weth.getAddress();
    usdcAddr = await d.usdc.getAddress();

    // Whitelist tokens
    await spotSettlement.addSpotToken(wethAddr, 18);
    await spotSettlement.addSpotToken(usdcAddr, 6);
    await spotSettlement.setEpochLength(5);

    // Create ETH/USDC market in CONTINUOUS mode
    await spotRegistry.createSpotMarket(wethAddr, usdcAddr, 0, 1, 500, 5, -2);
    marketId = ethers.keccak256(
      ethers.solidityPacked(["address", "string", "address"], [wethAddr, "/", usdcAddr])
    );

    // Set oracle price
    await spotRegistry.connect(d.oraclePoster).updateSpotPrice(
      marketId, ethers.parseEther("3000")
    );

    // Deploy mock PLVs
    const MockPLV = await ethers.getContractFactory("MockPLV");
    mockPLV = await MockPLV.deploy(ethers.parseEther("2999"), ethers.parseEther("10"));
    await mockPLV.waitForDeployment();
    mockPLV2 = await MockPLV.deploy(ethers.parseEther("3001"), ethers.parseEther("5"));
    await mockPLV2.waitForDeployment();
  });

  // ============================================================
  //              PLV REGISTRY TESTS
  // ============================================================
  describe("PLVRegistryFacet", function () {
    it("registers a PLV", async function () {
      const addr = await mockPLV.getAddress();
      await plvRegistry.registerPLV(addr);
      expect(await plvRegistry.isPLVRegistered(addr)).to.equal(true);
      expect(await plvRegistry.getRegisteredPLVCount()).to.equal(1);
    });

    it("reverts registering zero address", async function () {
      await expect(plvRegistry.registerPLV(ethers.ZeroAddress))
        .to.be.revertedWith("PLVRegistry: zero address");
    });

    it("reverts registering duplicate", async function () {
      const addr = await mockPLV.getAddress();
      await plvRegistry.registerPLV(addr);
      await expect(plvRegistry.registerPLV(addr))
        .to.be.revertedWith("PLVRegistry: already registered");
    });

    it("deregisters a PLV", async function () {
      const addr = await mockPLV.getAddress();
      await plvRegistry.registerPLV(addr);
      await plvRegistry.deregisterPLV(addr);
      expect(await plvRegistry.isPLVRegistered(addr)).to.equal(false);
      expect(await plvRegistry.getRegisteredPLVCount()).to.equal(0);
    });

    it("reverts deregistering non-registered", async function () {
      await expect(plvRegistry.deregisterPLV(await mockPLV.getAddress()))
        .to.be.revertedWith("PLVRegistry: not registered");
    });

    it("returns registered PLVs list", async function () {
      const addr1 = await mockPLV.getAddress();
      const addr2 = await mockPLV2.getAddress();
      await plvRegistry.registerPLV(addr1);
      await plvRegistry.registerPLV(addr2);

      const list = await plvRegistry.getRegisteredPLVs();
      expect(list.length).to.equal(2);
      expect(list[0]).to.equal(addr1);
      expect(list[1]).to.equal(addr2);
    });

    it("gets PLV score (default zero)", async function () {
      const addr = await mockPLV.getAddress();
      await plvRegistry.registerPLV(addr);
      const [score, weight] = await plvRegistry.getPLVScore(addr);
      expect(score).to.equal(0);
      expect(weight).to.equal(0);
    });

    it("quotes a registered PLV", async function () {
      const addr = await mockPLV.getAddress();
      await plvRegistry.registerPLV(addr);

      const [price, maxFillSize] = await plvRegistry.quotePLV(
        addr, 0, ethers.parseEther("1"), ethers.parseEther("3000"), 0
      );
      expect(price).to.equal(ethers.parseEther("2999"));
      expect(maxFillSize).to.equal(ethers.parseEther("10"));
    });

    it("returns zeros when PLV quote reverts", async function () {
      const addr = await mockPLV.getAddress();
      await plvRegistry.registerPLV(addr);
      await mockPLV.setShouldRevert(true);

      const [price, maxFillSize] = await plvRegistry.quotePLV(
        addr, 0, ethers.parseEther("1"), ethers.parseEther("3000"), 0
      );
      expect(price).to.equal(0);
      expect(maxFillSize).to.equal(0);
    });

    it("reverts quoting non-registered PLV", async function () {
      await expect(
        plvRegistry.quotePLV(
          await mockPLV.getAddress(), 0, ethers.parseEther("1"), ethers.parseEther("3000"), 0
        )
      ).to.be.revertedWith("PLVRegistry: not registered");
    });

    it("updates PLV score", async function () {
      const addr = await mockPLV.getAddress();
      await plvRegistry.registerPLV(addr);

      await plvRegistry.updatePLVScore(addr, ethers.parseEther("0.95"), 1000);
      const [score, weight] = await plvRegistry.getPLVScore(addr);
      expect(score).to.be.gt(0);
      expect(weight).to.be.gt(0);
    });

    it("non-admin cannot register PLV", async function () {
      const [, , user] = await ethers.getSigners();
      await expect(
        plvRegistry.connect(user).registerPLV(await mockPLV.getAddress())
      ).to.be.revertedWith("LibAccessControl: account is missing role");
    });

    it("getTopPLVs sorts by score descending", async function () {
      const addr1 = await mockPLV.getAddress();
      const addr2 = await mockPLV2.getAddress();
      await plvRegistry.registerPLV(addr1);
      await plvRegistry.registerPLV(addr2);

      // Give PLV2 a higher score than PLV1
      await plvRegistry.updatePLVScore(addr1, ethers.parseEther("0.5"), 100);
      await plvRegistry.updatePLVScore(addr2, ethers.parseEther("0.9"), 100);

      const [vaults, scores] = await plvRegistry.getTopPLVs(10);
      expect(vaults.length).to.equal(2);
      // PLV2 should be first (higher score)
      expect(vaults[0]).to.equal(addr2);
      expect(scores[0]).to.be.gt(scores[1]);
    });
  });

  // ============================================================
  //              PoFQ FACET TESTS
  // ============================================================
  describe("PoFQFacet", function () {
    it("returns zero trader PoFQ by default", async function () {
      const [score, weight] = await pofqFacet.getTraderPoFQ(d.owner.address);
      expect(score).to.equal(0);
      expect(weight).to.equal(0);
    });

    it("returns zero vault PoFQ by default", async function () {
      const [score, weight] = await pofqFacet.getVaultPoFQ(await mockPLV.getAddress());
      expect(score).to.equal(0);
      expect(weight).to.equal(0);
    });

    it("gets default decay rate (0)", async function () {
      expect(await pofqFacet.getPoFQDecayRate()).to.equal(0);
    });

    it("sets PoFQ decay rate", async function () {
      await pofqFacet.setPoFQDecayRate(100);
      expect(await pofqFacet.getPoFQDecayRate()).to.equal(100);
    });

    it("reverts decay rate > 5000", async function () {
      await expect(pofqFacet.setPoFQDecayRate(5001))
        .to.be.revertedWith("PoFQ: decay too high");
    });

    it("gets default min spread (0)", async function () {
      expect(await pofqFacet.getMinSpreadBps()).to.equal(0);
    });

    it("sets min spread bps", async function () {
      await pofqFacet.setMinSpreadBps(2);
      expect(await pofqFacet.getMinSpreadBps()).to.equal(2);
    });

    it("reverts min spread > 1000", async function () {
      await expect(pofqFacet.setMinSpreadBps(1001))
        .to.be.revertedWith("PoFQ: min spread too high");
    });

    it("sets and gets fee tier thresholds", async function () {
      const thresholds = [0, ethers.parseEther("10000"), ethers.parseEther("100000"), ethers.parseEther("1000000")];
      await pofqFacet.setFeeTierThresholds(thresholds);

      const [storedThresholds,] = await pofqFacet.getFeeTierConfig();
      expect(storedThresholds[1]).to.equal(thresholds[1]);
      expect(storedThresholds[3]).to.equal(thresholds[3]);
    });

    it("sets and gets fee tier rebates", async function () {
      const rebates = [0, 1500, 3000, 5000];
      await pofqFacet.setFeeTierRebates(rebates);

      const [, storedRebates] = await pofqFacet.getFeeTierConfig();
      expect(storedRebates[1]).to.equal(1500);
      expect(storedRebates[3]).to.equal(5000);
    });

    it("updates trader fee tier", async function () {
      const [, , user] = await ethers.getSigners();
      await pofqFacet.updateTraderFeeTier(user.address, 2);
      const [tier,,] = await pofqFacet.getTraderFeeTier(user.address);
      expect(tier).to.equal(2);
    });

    it("batch updates fee tiers", async function () {
      const [, , user1, user2] = await ethers.getSigners();
      await pofqFacet.batchUpdateFeeTiers(
        [user1.address, user2.address],
        [1, 3]
      );
      const [tier1,,] = await pofqFacet.getTraderFeeTier(user1.address);
      const [tier2,,] = await pofqFacet.getTraderFeeTier(user2.address);
      expect(tier1).to.equal(1);
      expect(tier2).to.equal(3);
    });

    it("reverts invalid tier > 3", async function () {
      const [, , user] = await ethers.getSigners();
      await expect(pofqFacet.updateTraderFeeTier(user.address, 4))
        .to.be.revertedWith("PoFQ: invalid tier");
    });

    it("non-admin cannot set decay rate", async function () {
      const [, , user] = await ethers.getSigners();
      await expect(pofqFacet.connect(user).setPoFQDecayRate(100))
        .to.be.revertedWith("LibAccessControl: account is missing role");
    });
  });

  // ============================================================
  //              SPOT KEEPER MULTICALL TESTS
  // ============================================================
  describe("SpotKeeperMulticallFacet", function () {
    it("executes spot price cycle (mode evaluation only)", async function () {
      await spotKeeper.executeSpotPriceCycle([marketId]);
      // No revert = success. Market stays CONTINUOUS since conditions are normal.
      const market = await spotRegistry.getSpotMarket(marketId);
      expect(market.mode).to.equal(0); // CONTINUOUS
    });

    it("executes full spot cycle with no batches or epoch", async function () {
      const tx = await spotKeeper.executeSpotCycle([marketId]);
      const receipt = await tx.wait();
      // Should emit SpotKeeperCycleExecuted
      const event = receipt.logs.find(l => {
        try {
          return spotKeeper.interface.parseLog(l)?.name === "SpotKeeperCycleExecuted";
        } catch { return false; }
      });
      expect(event).to.not.be.undefined;
    });

    it("mode switches to BATCH via keeper cycle when oracle stale", async function () {
      // Set confidence threshold to 30 seconds
      await spotModeSwitch.setModeSwitchParams(0, 30);

      // Advance time to make oracle stale
      await ethers.provider.send("evm_increaseTime", [60]);
      await ethers.provider.send("evm_mine", []);

      // Execute spot cycle — should switch to BATCH
      await spotKeeper.executeSpotCycle([marketId]);
      const market = await spotRegistry.getSpotMarket(marketId);
      expect(market.mode).to.equal(1); // BATCH
    });

    it("clears batch through keeper cycle", async function () {
      // Initialize epoch start by running an empty cycle first, then set long epoch
      await spotKeeper.executeSpotCycle([marketId]);
      await spotSettlement.setEpochLength(1000);

      // Switch market to BATCH mode manually
      await spotRegistry.setSpotMarketMode(marketId, 1);

      // Setup users with deposits
      const [, , buyer, seller] = await ethers.getSigners();
      await setupBuyer(buyer, ethers.parseUnits("100000", 6));
      await setupSeller(seller, ethers.parseEther("10"));

      // Place orders via SpotOrderBookFacet — they'll queue in batch
      await spotOrderBook.connect(buyer).placeSpotOrder(marketId, 0, 1, 10, ethers.parseEther("1"));
      await spotOrderBook.connect(seller).placeSpotOrder(marketId, 1, 1, -10, ethers.parseEther("1"));

      // Advance a block so clearing is allowed
      await ethers.provider.send("evm_mine", []);

      // Refresh oracle price (so it's not stale)
      await spotRegistry.connect(d.oraclePoster).updateSpotPrice(
        marketId, ethers.parseEther("3000")
      );

      // Execute keeper cycle — should clear the batch
      const tx = await spotKeeper.executeSpotCycle([marketId]);
      const receipt = await tx.wait();

      // Check BatchCleared event
      const batchEvent = receipt.logs.find(l => {
        try {
          return spotKeeper.interface.parseLog(l)?.name === "BatchCleared";
        } catch { return false; }
      });
      expect(batchEvent).to.not.be.undefined;
    });

    it("settles epoch through keeper cycle when boundary reached", async function () {
      // Set epoch length to 2 blocks
      await spotSettlement.setEpochLength(2);

      // Mine enough blocks to reach epoch boundary
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);

      // Execute keeper cycle — should settle epoch
      const tx = await spotKeeper.executeSpotCycle([marketId]);
      const receipt = await tx.wait();

      const epochEvent = receipt.logs.find(l => {
        try {
          return spotKeeper.interface.parseLog(l)?.name === "EpochSettled";
        } catch { return false; }
      });
      expect(epochEvent).to.not.be.undefined;
    });

    it("non-keeper cannot execute spot cycle", async function () {
      const [, , user] = await ethers.getSigners();
      await expect(spotKeeper.connect(user).executeSpotCycle([marketId]))
        .to.be.revertedWith("LibAccessControl: account is missing role");
    });

    it("non-keeper cannot execute spot price cycle", async function () {
      const [, , user] = await ethers.getSigners();
      await expect(spotKeeper.connect(user).executeSpotPriceCycle([marketId]))
        .to.be.revertedWith("LibAccessControl: account is missing role");
    });

    it("handles empty market list gracefully", async function () {
      await spotKeeper.executeSpotCycle([]);
      // No revert = success
    });
  });

  // ============================================================
  //                    HELPERS
  // ============================================================

  async function setupBuyer(user, amount) {
    const vaultAddr = await d.vaultFactory.getVault(user.address);
    if (vaultAddr === ethers.ZeroAddress) {
      await d.vaultFactory.connect(user).createVault();
    }
    const vault = await d.vaultFactory.getVault(user.address);
    // Mint USDC and deposit
    await d.usdc.mint(user.address, amount);
    await d.usdc.connect(user).approve(vault, amount);
    const vaultContract = await ethers.getContractAt("TradingAccount", vault);
    await vaultContract.connect(user).deposit(usdcAddr, amount);
    // Deposit into spot
    await spotSettlement.connect(user).depositSpotCollateral(usdcAddr, amount);
  }

  async function setupSeller(user, amount) {
    const vaultAddr = await d.vaultFactory.getVault(user.address);
    if (vaultAddr === ethers.ZeroAddress) {
      await d.vaultFactory.connect(user).createVault();
    }
    const vault = await d.vaultFactory.getVault(user.address);
    // Mint WETH and deposit
    await weth.mint(user.address, amount);
    await weth.connect(user).approve(vault, amount);
    const vaultContract = await ethers.getContractAt("TradingAccount", vault);
    await vaultContract.connect(user).deposit(wethAddr, amount);
    // Deposit into spot
    await spotSettlement.connect(user).depositSpotCollateral(wethAddr, amount);
  }
});
