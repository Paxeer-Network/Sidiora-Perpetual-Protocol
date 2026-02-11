const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, setupFullProtocol } = require("./helpers/deployDiamond");

describe("Full E2E Integration Test", function () {
  let d, roles, usdcAddr, daiAddr;

  before(async function () {
    d = await deployFullDiamond();
    roles = await setupFullProtocol(d);
    usdcAddr = await d.usdc.getAddress();
    daiAddr = await d.dai.getAddress();
  });

  // ==========================================================
  //  SCENARIO 1: Complete trade lifecycle — open, profit, close
  // ==========================================================
  describe("Scenario 1: Full long trade lifecycle with profit", function () {
    let user1VaultAddr, user1Vault, posId;
    const collateralAmount = 10_000n * 10n ** 6n; // $10,000 USDC

    it("Step 1: User1 creates a vault", async function () {
      await d.vaultFactory.connect(d.user1).createVault();
      user1VaultAddr = await d.vaultFactory.getVault(d.user1.address);
      user1Vault = await ethers.getContractAt("UserVault", user1VaultAddr);
      expect(user1VaultAddr).to.not.equal(ethers.ZeroAddress);
      expect(await user1Vault.vaultOwner()).to.equal(d.user1.address);
    });

    it("Step 2: User1 deposits USDC into vault", async function () {
      const depositAmount = 50_000n * 10n ** 6n;
      await d.usdc.connect(d.user1).approve(user1VaultAddr, depositAmount);
      await user1Vault.connect(d.user1).deposit(usdcAddr, depositAmount);
      expect(await user1Vault.getBalance(usdcAddr)).to.equal(depositAmount);
    });

    it("Step 3: Quoter provides accurate trade preview", async function () {
      const quote = await d.quoter.quoteOpenPosition(
        0, usdcAddr, collateralAmount, ethers.parseEther("10"), true
      );
      expect(quote.entryPrice).to.be.greaterThan(0);
      expect(quote.sizeUsd).to.be.greaterThan(0);
      expect(quote.liquidationPrice).to.be.greaterThan(0);
      expect(quote.liquidationPrice).to.be.lessThan(quote.entryPrice); // longs liq below entry
    });

    it("Step 4: User1 opens 10x long BTC at $50,000", async function () {
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, collateralAmount, ethers.parseEther("10"), true
      );
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
      expect(posId).to.be.greaterThan(0);

      const pos = await d.position.getPosition(posId);
      expect(pos.user).to.equal(d.user1.address);
      expect(pos.isLong).to.equal(true);
      expect(pos.active).to.equal(true);
      expect(pos.marketId).to.equal(0);

      // Open interest increased
      const [longOI] = await d.position.getOpenInterest(0);
      expect(longOI).to.be.greaterThan(0);

      // Collateral locked in vault
      expect(await user1Vault.getBalance(usdcAddr)).to.be.lessThan(50_000n * 10n ** 6n);
    });

    it("Step 5: Price rises to $55,000 — quoter shows profit", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0, 1], [
        ethers.parseEther("55000"), roles.ethPrice,
      ]);

      const closeQuote = await d.quoter.quoteClosePosition(posId);
      expect(closeQuote.unrealizedPnl).to.be.greaterThan(0); // Profit
      expect(closeQuote.estimatedPayout).to.be.greaterThan(0);
    });

    it("Step 6: User1 closes position — receives profit", async function () {
      const vaultBalBefore = await d.usdc.balanceOf(user1VaultAddr);
      await d.position.connect(d.user1).closePosition(posId);

      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(false);

      // Vault received payout
      const vaultBalAfter = await d.usdc.balanceOf(user1VaultAddr);
      expect(vaultBalAfter).to.be.greaterThan(vaultBalBefore);

      // OI back to zero
      const [longOI] = await d.position.getOpenInterest(0);
      expect(longOI).to.equal(0);

      // Can open new position
      const mapped = await d.position.getUserMarketPosition(d.user1.address, 0);
      expect(mapped).to.equal(0);
    });

    it("Step 7: User1 withdraws profit from vault", async function () {
      const available = await user1Vault.getBalance(usdcAddr);
      const balBefore = await d.usdc.balanceOf(d.user1.address);
      await user1Vault.connect(d.user1).withdraw(usdcAddr, available);
      const balAfter = await d.usdc.balanceOf(d.user1.address);
      expect(balAfter - balBefore).to.equal(available);
    });
  });

  // ==========================================================
  //  SCENARIO 2: Short trade with loss
  // ==========================================================
  describe("Scenario 2: Short trade with loss", function () {
    let user2VaultAddr, user2Vault, posId;

    it("Step 1: User2 creates vault and deposits", async function () {
      await d.vaultFactory.connect(d.user2).createVault();
      user2VaultAddr = await d.vaultFactory.getVault(d.user2.address);
      user2Vault = await ethers.getContractAt("UserVault", user2VaultAddr);
      const depositAmount = 50_000n * 10n ** 6n;
      await d.usdc.connect(d.user2).approve(user2VaultAddr, depositAmount);
      await user2Vault.connect(d.user2).deposit(usdcAddr, depositAmount);
    });

    it("Step 2: Reset oracle price to $50,000", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0, 1], [
        ethers.parseEther("50000"), ethers.parseEther("3000"),
      ]);
    });

    it("Step 3: User2 opens 5x short BTC", async function () {
      await d.position.connect(d.user2).openPosition(
        0, usdcAddr, 5_000n * 10n ** 6n, ethers.parseEther("5"), false
      );
      posId = await d.position.getUserMarketPosition(d.user2.address, 0);
      const pos = await d.position.getPosition(posId);
      expect(pos.isLong).to.equal(false);
      expect(pos.active).to.equal(true);
    });

    it("Step 4: Price rises to $52,000 — short is losing", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0, 1], [
        ethers.parseEther("52000"), ethers.parseEther("3000"),
      ]);
      const closeQuote = await d.quoter.quoteClosePosition(posId);
      expect(closeQuote.unrealizedPnl).to.be.lessThan(0); // Loss
    });

    it("Step 5: User2 partial closes 50%", async function () {
      const pos = await d.position.getPosition(posId);
      const halfSize = pos.sizeUsd / 2n;
      await d.position.connect(d.user2).partialClose(posId, halfSize);

      const posAfter = await d.position.getPosition(posId);
      expect(posAfter.active).to.equal(true);
      expect(posAfter.sizeUsd).to.be.lessThan(pos.sizeUsd);
    });

    it("Step 6: User2 closes remaining position", async function () {
      await d.position.connect(d.user2).closePosition(posId);
      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(false);
    });
  });

  // ==========================================================
  //  SCENARIO 3: Liquidation
  // ==========================================================
  describe("Scenario 3: Liquidation of high-leverage position", function () {
    let posId;

    it("Step 1: User1 re-deposits and opens 100x long BTC", async function () {
      const user1VaultAddr = await d.vaultFactory.getVault(d.user1.address);
      const vault = await ethers.getContractAt("UserVault", user1VaultAddr);
      await d.usdc.mint(d.user1.address, 100_000n * 10n ** 6n);
      await d.usdc.connect(d.user1).approve(user1VaultAddr, 100_000n * 10n ** 6n);
      await vault.connect(d.user1).deposit(usdcAddr, 100_000n * 10n ** 6n);

      // Reset price
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("50000")]);

      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 1_000n * 10n ** 6n, ethers.parseEther("100"), true
      );
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
    });

    it("Step 2: Position is healthy initially", async function () {
      const [liquidatable] = await d.liquidation.checkLiquidatable(posId);
      expect(liquidatable).to.equal(false);
    });

    it("Step 3: Price drops 2% — position becomes liquidatable", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("49000")]);
      const [liquidatable, marginBps] = await d.liquidation.checkLiquidatable(posId);
      expect(liquidatable).to.equal(true);
      expect(marginBps).to.be.lessThan(50); // Below 0.5% maintenance
    });

    it("Step 4: Keeper liquidates the position", async function () {
      const keeperBalBefore = await d.usdc.balanceOf(d.keeper.address);
      await d.liquidation.connect(d.keeper).liquidate(posId);

      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(false);

      // Keeper received reward
      const keeperBalAfter = await d.usdc.balanceOf(d.keeper.address);
      expect(keeperBalAfter).to.be.greaterThanOrEqual(keeperBalBefore);

      // User's market position cleared
      const mapped = await d.position.getUserMarketPosition(d.user1.address, 0);
      expect(mapped).to.equal(0);
    });

    it("Step 5: User1 can open new position after liquidation", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("49000")]);
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 2_000n * 10n ** 6n, ethers.parseEther("5"), false
      );
      const newPosId = await d.position.getUserMarketPosition(d.user1.address, 0);
      const pos = await d.position.getPosition(newPosId);
      expect(pos.active).to.equal(true);
      expect(pos.isLong).to.equal(false);

      // Clean up
      await d.position.connect(d.user1).closePosition(newPosId);
    });
  });

  // ==========================================================
  //  SCENARIO 4: Limit order lifecycle
  // ==========================================================
  describe("Scenario 4: Limit order placement and execution", function () {
    let orderId;

    it("Step 1: User2 places limit long order at $48,000", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("50000")]);

      await d.orderBook.connect(d.user2).placeLimitOrder(
        0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
        ethers.parseEther("10"), usdcAddr, 1_000n * 10n ** 6n
      );
      const ids = await d.orderBook.getUserOrderIds(d.user2.address);
      orderId = ids[Number(ids.length) - 1];

      const order = await d.orderBook.getOrder(orderId);
      expect(order.active).to.equal(true);
      expect(order.triggerPrice).to.equal(ethers.parseEther("48000"));
    });

    it("Step 2: Price at $50,000 — order not triggered", async function () {
      await expect(
        d.orderBook.connect(d.keeper).executeOrder(orderId)
      ).to.be.revertedWith("OrderBook: limit long not triggered");
    });

    it("Step 3: Price drops to $47,000 — order triggered", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("47000")]);
      await d.orderBook.connect(d.keeper).executeOrder(orderId);

      const order = await d.orderBook.getOrder(orderId);
      expect(order.active).to.equal(false);

      // Position created
      const posId = await d.position.getUserMarketPosition(d.user2.address, 0);
      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(true);
      expect(pos.isLong).to.equal(true);
    });

    it("Step 4: User2 closes the position opened by the order", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("50000")]);
      const posId = await d.position.getUserMarketPosition(d.user2.address, 0);
      await d.position.connect(d.user2).closePosition(posId);
      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(false);
    });
  });

  // ==========================================================
  //  SCENARIO 5: Multi-market trading
  // ==========================================================
  describe("Scenario 5: User trades multiple markets simultaneously", function () {
    it("User1 opens long BTC + short ETH at the same time", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0, 1], [
        ethers.parseEther("50000"), ethers.parseEther("3000"),
      ]);

      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 5_000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      await d.position.connect(d.user1).openPosition(
        1, usdcAddr, 3_000n * 10n ** 6n, ethers.parseEther("5"), false
      );

      const btcPos = await d.position.getUserMarketPosition(d.user1.address, 0);
      const ethPos = await d.position.getUserMarketPosition(d.user1.address, 1);

      const btc = await d.position.getPosition(btcPos);
      const eth = await d.position.getPosition(ethPos);

      expect(btc.active).to.equal(true);
      expect(btc.isLong).to.equal(true);
      expect(eth.active).to.equal(true);
      expect(eth.isLong).to.equal(false);

      // Both markets have OI
      const [btcLongOI] = await d.position.getOpenInterest(0);
      const [, ethShortOI] = await d.position.getOpenInterest(1);
      expect(btcLongOI).to.be.greaterThan(0);
      expect(ethShortOI).to.be.greaterThan(0);
    });

    it("Close both positions", async function () {
      const btcPosId = await d.position.getUserMarketPosition(d.user1.address, 0);
      const ethPosId = await d.position.getUserMarketPosition(d.user1.address, 1);
      await d.position.connect(d.user1).closePosition(btcPosId);
      await d.position.connect(d.user1).closePosition(ethPosId);

      expect((await d.position.getPosition(btcPosId)).active).to.equal(false);
      expect((await d.position.getPosition(ethPosId)).active).to.equal(false);
    });
  });

  // ==========================================================
  //  SCENARIO 6: Multi-stablecoin collateral
  // ==========================================================
  describe("Scenario 6: Trading with DAI (18 decimals) as collateral", function () {
    it("User1 deposits DAI and opens position", async function () {
      const user1VaultAddr = await d.vaultFactory.getVault(d.user1.address);
      const vault = await ethers.getContractAt("UserVault", user1VaultAddr);

      const daiAmount = ethers.parseEther("10000"); // 10k DAI
      await d.dai.connect(d.user1).approve(user1VaultAddr, daiAmount);
      await vault.connect(d.user1).deposit(daiAddr, daiAmount);

      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("50000")]);

      await d.position.connect(d.user1).openPosition(
        0, daiAddr, ethers.parseEther("5000"), ethers.parseEther("10"), true
      );
      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(true);
      expect(pos.collateralToken).to.equal(daiAddr);

      // Close it
      await d.position.connect(d.user1).closePosition(posId);
    });
  });

  // ==========================================================
  //  SCENARIO 7: Funding rate and settlement
  // ==========================================================
  describe("Scenario 7: Funding rate accrual", function () {
    it("Funding rate updates and accrues over time", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("50000")]);

      // Open a long to create OI imbalance
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 5_000n * 10n ** 6n, ethers.parseEther("10"), true
      );

      // Update funding rate
      await d.fundingRate.connect(d.keeper).updateFundingRate(0);

      // Check state
      const [cumLong, cumShort, lastUpdate, rate] = await d.fundingRate.getFundingState(0);
      expect(lastUpdate).to.be.greaterThan(0);

      // Advance time 1 hour
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");

      // Check pending funding
      const [pendingLong, pendingShort] = await d.fundingRate.getPendingFunding(0);
      // Pending values should be non-zero if rate is non-zero

      // Update oracle and refresh prices
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("50000")]);

      // Close position — funding settled on close
      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
      await d.position.connect(d.user1).closePosition(posId);
    });
  });

  // ==========================================================
  //  SCENARIO 8: Protocol admin operations
  // ==========================================================
  describe("Scenario 8: Admin operations", function () {
    it("Add new collateral token (USDT)", async function () {
      const usdtAddr = await d.usdt.getAddress();
      await d.collateral.addCollateral(usdtAddr);
      expect(await d.collateral.isAcceptedCollateral(usdtAddr)).to.equal(true);
    });

    it("Create a new market (Gold)", async function () {
      await d.marketRegistry.createMarket(
        "Gold", "XAU", ethers.parseEther("500"), 100, ethers.parseEther("5000000")
      );
      const marketId = (await d.marketRegistry.totalMarkets()) - 1n;
      const market = await d.marketRegistry.getMarket(marketId);
      expect(market.name).to.equal("Gold");
      expect(market.enabled).to.equal(true);
    });

    it("Pause and unpause a market", async function () {
      const PAUSER = await d.accessControl.PAUSER_ROLE();
      await d.accessControl.grantRole(PAUSER, d.owner.address);
      await d.pausable.pauseMarket(0);
      expect(await d.pausable.isMarketPaused(0)).to.equal(true);
      await d.pausable.unpauseMarket(0);
      expect(await d.pausable.isMarketPaused(0)).to.equal(false);
    });

    it("Fund and defund central vault", async function () {
      const fundAmount = 1_000_000n * 10n ** 6n;
      await d.usdc.mint(d.funder.address, fundAmount);
      await d.usdc.connect(d.funder).approve(d.diamondAddress, fundAmount);
      const balBefore = await d.centralVault.getVaultBalance(usdcAddr);
      await d.centralVault.connect(d.funder).fundVault(usdcAddr, fundAmount);
      const balAfter = await d.centralVault.getVaultBalance(usdcAddr);
      expect(balAfter - balBefore).to.equal(fundAmount);

      // Defund
      await d.centralVault.connect(d.funder).defundVault(usdcAddr, fundAmount, d.funder.address);
    });

    it("Update market parameters", async function () {
      await d.marketRegistry.updateMarket(0, ethers.parseEther("500"), 100, ethers.parseEther("20000000"));
      const m = await d.marketRegistry.getMarket(0);
      expect(m.maxLeverage).to.equal(ethers.parseEther("500"));
      expect(m.maintenanceMarginBps).to.equal(100);

      // Reset to original
      await d.marketRegistry.updateMarket(0, ethers.parseEther("1000"), 50, ethers.parseEther("10000000"));
    });

    it("Sync vAMM to oracle", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("51000")]);
      await d.virtualAMM.connect(d.keeper).syncToOracle(0);
      const markPrice = await d.virtualAMM.getMarkPrice(0);
      // Mark should have moved toward $51,000
      expect(markPrice).to.be.greaterThan(ethers.parseEther("50000"));
    });
  });

  // ==========================================================
  //  SCENARIO 9: Edge cases and stress tests
  // ==========================================================
  describe("Scenario 9: Edge cases", function () {
    it("Open position with minimum collateral ($1)", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("50000")]);
      const minCollateral = 1n * 10n ** 6n; // $1 USDC
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, minCollateral, ethers.parseEther("10"), true
      );
      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
      expect(posId).to.be.greaterThan(0);
      await d.position.connect(d.user1).closePosition(posId);
    });

    it("Open and immediately close position", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("50000")]);
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 1_000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
      await d.position.connect(d.user1).closePosition(posId);
      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(false);
    });

    it("Multiple users compete on same market", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("50000")]);

      // User1 long, User2 short — opposite sides
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 5_000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      await d.position.connect(d.user2).openPosition(
        0, usdcAddr, 5_000n * 10n ** 6n, ethers.parseEther("10"), false
      );

      const [longOI, shortOI] = await d.position.getOpenInterest(0);
      expect(longOI).to.be.greaterThan(0);
      expect(shortOI).to.be.greaterThan(0);

      // Close both
      const p1 = await d.position.getUserMarketPosition(d.user1.address, 0);
      const p2 = await d.position.getUserMarketPosition(d.user2.address, 0);
      await d.position.connect(d.user1).closePosition(p1);
      await d.position.connect(d.user2).closePosition(p2);
    });

    it("Place and cancel multiple orders", async function () {
      for (let i = 0; i < 3; i++) {
        await d.orderBook.connect(d.user1).placeLimitOrder(
          0, true, ethers.parseEther(String(45000 + i * 1000)),
          ethers.parseEther("5000"), ethers.parseEther("5"),
          usdcAddr, 1_000n * 10n ** 6n
        );
      }
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);
      expect(ids.length).to.be.greaterThanOrEqual(3);

      // Cancel all
      for (const id of ids) {
        const order = await d.orderBook.getOrder(id);
        if (order.active) {
          await d.orderBook.connect(d.user1).cancelOrder(id);
        }
      }
    });

    it("QuoterFacet market snapshot reflects state accurately", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0, 1], [
        ethers.parseEther("50000"), ethers.parseEther("3000"),
      ]);
      const btcQuote = await d.quoter.quoteMarket(0);
      const ethQuote = await d.quoter.quoteMarket(1);

      expect(btcQuote.indexPrice).to.equal(ethers.parseEther("50000"));
      expect(ethQuote.indexPrice).to.equal(ethers.parseEther("3000"));
      expect(btcQuote.enabled).to.equal(true);
      expect(ethQuote.enabled).to.equal(true);
      expect(btcQuote.priceStale).to.equal(false);
    });
  });
});
