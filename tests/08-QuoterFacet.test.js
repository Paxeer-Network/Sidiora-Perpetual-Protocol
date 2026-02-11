const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, setupFullProtocol } = require("./helpers/deployDiamond");

describe("QuoterFacet", function () {
  let d, roles, usdcAddr;

  beforeEach(async function () {
    d = await deployFullDiamond();
    roles = await setupFullProtocol(d);
    usdcAddr = await d.usdc.getAddress();

    // Create vault and deposit for user1
    await d.vaultFactory.connect(d.user1).createVault();
    const vAddr = await d.vaultFactory.getVault(d.user1.address);
    const amount = 100_000n * 10n ** 6n;
    await d.usdc.connect(d.user1).approve(vAddr, amount);
    const vault = await ethers.getContractAt("UserVault", vAddr);
    await vault.connect(d.user1).deposit(usdcAddr, amount);
  });

  // ==========================================================
  //                  QUOTE OPEN POSITION
  // ==========================================================
  describe("quoteOpenPosition()", function () {
    it("returns valid quote for long BTC", async function () {
      const quote = await d.quoter.quoteOpenPosition(
        0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      expect(quote.entryPrice).to.be.greaterThan(0);
      expect(quote.sizeUsd).to.be.greaterThan(0);
      expect(quote.collateralUsd).to.be.greaterThan(0);
      expect(quote.leverage).to.equal(ethers.parseEther("10"));
      expect(quote.tradingFee).to.be.greaterThanOrEqual(0);
      expect(quote.liquidationPrice).to.be.greaterThan(0);
      expect(quote.maintenanceMarginBps).to.equal(50);
    });

    it("returns valid quote for short ETH", async function () {
      const quote = await d.quoter.quoteOpenPosition(
        1, usdcAddr, 500n * 10n ** 6n, ethers.parseEther("5"), false
      );
      expect(quote.entryPrice).to.be.greaterThan(0);
      expect(quote.sizeUsd).to.be.greaterThan(0);
    });

    it("higher leverage = higher liquidation price for longs", async function () {
      const quote5x = await d.quoter.quoteOpenPosition(
        0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("5"), true
      );
      const quote50x = await d.quoter.quoteOpenPosition(
        0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("50"), true
      );
      // Higher leverage = liq price closer to entry = higher for longs
      expect(quote50x.liquidationPrice).to.be.greaterThan(quote5x.liquidationPrice);
    });

    it("larger position = more trading fee", async function () {
      const quoteSmall = await d.quoter.quoteOpenPosition(
        0, usdcAddr, 100n * 10n ** 6n, ethers.parseEther("10"), true
      );
      const quoteLarge = await d.quoter.quoteOpenPosition(
        0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      expect(quoteLarge.tradingFeeUsd).to.be.greaterThan(quoteSmall.tradingFeeUsd);
    });

    it("larger position = more price impact", async function () {
      const quoteSmall = await d.quoter.quoteOpenPosition(
        0, usdcAddr, 100n * 10n ** 6n, ethers.parseEther("10"), true
      );
      const quoteLarge = await d.quoter.quoteOpenPosition(
        0, usdcAddr, 50000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      expect(quoteLarge.priceImpact).to.be.greaterThan(quoteSmall.priceImpact);
    });

    it("entry price for long > oracle for large trades (slippage)", async function () {
      const quote = await d.quoter.quoteOpenPosition(
        0, usdcAddr, 50000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      expect(quote.entryPrice).to.be.greaterThan(roles.btcPrice);
    });

    it("entry price for short < oracle for large trades (slippage)", async function () {
      const quote = await d.quoter.quoteOpenPosition(
        0, usdcAddr, 50000n * 10n ** 6n, ethers.parseEther("10"), false
      );
      expect(quote.entryPrice).to.be.lessThan(roles.btcPrice);
    });
  });

  // ==========================================================
  //                  QUOTE CLOSE POSITION
  // ==========================================================
  describe("quoteClosePosition()", function () {
    let posId;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
    });

    it("returns valid close quote at same price", async function () {
      const quote = await d.quoter.quoteClosePosition(posId);
      expect(quote.exitPrice).to.be.greaterThan(0);
      expect(quote.tradingFee).to.be.greaterThan(0);
      expect(quote.estimatedPayout).to.be.greaterThan(0);
    });

    it("profit scenario: price up", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("55000")]);
      const quote = await d.quoter.quoteClosePosition(posId);
      expect(quote.unrealizedPnl).to.be.greaterThan(0);
    });

    it("loss scenario: price down", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("48000")]);
      const quote = await d.quoter.quoteClosePosition(posId);
      expect(quote.unrealizedPnl).to.be.lessThan(0);
    });

    it("reverts for inactive position", async function () {
      await d.position.connect(d.user1).closePosition(posId);
      await expect(d.quoter.quoteClosePosition(posId))
        .to.be.revertedWith("Quoter: position not active");
    });
  });

  // ==========================================================
  //                 QUOTE PARTIAL CLOSE
  // ==========================================================
  describe("quotePartialClose()", function () {
    let posId, posSize;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
      const pos = await d.position.getPosition(posId);
      posSize = pos.sizeUsd;
    });

    it("returns valid partial close quote", async function () {
      const halfSize = posSize / 2n;
      const [exitPrice, closedPnl, fee, payout] = await d.quoter.quotePartialClose(posId, halfSize);
      expect(exitPrice).to.be.greaterThan(0);
      expect(fee).to.be.greaterThan(0);
      expect(payout).to.be.greaterThan(0);
    });

    it("reverts for inactive position", async function () {
      await d.position.connect(d.user1).closePosition(posId);
      await expect(d.quoter.quotePartialClose(posId, ethers.parseEther("1000")))
        .to.be.revertedWith("Quoter: position not active");
    });

    it("reverts for invalid close size", async function () {
      await expect(d.quoter.quotePartialClose(posId, 0))
        .to.be.revertedWith("Quoter: invalid close size");
    });

    it("reverts for close size >= position size", async function () {
      await expect(d.quoter.quotePartialClose(posId, posSize))
        .to.be.revertedWith("Quoter: invalid close size");
    });

    it("closing half returns roughly half the collateral", async function () {
      const fullQuote = await d.quoter.quoteClosePosition(posId);
      const halfSize = posSize / 2n;
      const [, , , halfPayout] = await d.quoter.quotePartialClose(posId, halfSize);
      // Half payout should be roughly half of full payout (within 10%)
      const fullPayout = fullQuote.estimatedPayout;
      const expectedHalf = fullPayout / 2n;
      const tolerance = expectedHalf / 10n;
      expect(halfPayout).to.be.greaterThan(expectedHalf - tolerance);
      expect(halfPayout).to.be.lessThan(expectedHalf + tolerance);
    });
  });

  // ==========================================================
  //                    QUOTE MARKET
  // ==========================================================
  describe("quoteMarket()", function () {
    it("returns comprehensive market data for BTC", async function () {
      const quote = await d.quoter.quoteMarket(0);
      expect(quote.indexPrice).to.equal(roles.btcPrice);
      expect(quote.markPrice).to.be.greaterThan(0);
      expect(quote.oracleTWAP).to.be.greaterThan(0);
      expect(quote.maxLeverage).to.equal(ethers.parseEther("1000"));
      expect(quote.maintenanceMarginBps).to.equal(50);
      expect(quote.enabled).to.equal(true);
      expect(quote.priceStale).to.equal(false);
    });

    it("returns comprehensive market data for ETH", async function () {
      const quote = await d.quoter.quoteMarket(1);
      expect(quote.indexPrice).to.equal(roles.ethPrice);
      expect(quote.enabled).to.equal(true);
    });

    it("shows stale after time passes", async function () {
      await ethers.provider.send("evm_increaseTime", [121]);
      await ethers.provider.send("evm_mine");
      const quote = await d.quoter.quoteMarket(0);
      expect(quote.priceStale).to.equal(true);
    });

    it("shows OI after position opened", async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
      const quote = await d.quoter.quoteMarket(0);
      expect(quote.longOI).to.be.greaterThan(0);
      expect(quote.shortOI).to.equal(0);
    });

    it("shows disabled market", async function () {
      await d.marketRegistry.disableMarket(0);
      const quote = await d.quoter.quoteMarket(0);
      expect(quote.enabled).to.equal(false);
    });
  });
});
