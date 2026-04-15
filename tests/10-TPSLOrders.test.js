const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, setupFullProtocol } = require("./helpers/deployDiamond");

describe("TP/SL Orders (Bug Fix A.1)", function () {
  let d, roles, usdcAddr;

  beforeEach(async function () {
    d = await deployFullDiamond();
    roles = await setupFullProtocol(d);
    usdcAddr = await d.usdc.getAddress();

    for (const user of [d.user1, d.user2]) {
      await d.vaultFactory.connect(user).createVault();
      const vAddr = await d.vaultFactory.getVault(user.address);
      const amount = 100_000n * 10n ** 6n;
      await d.usdc.connect(user).approve(vAddr, amount);
      const vault = await ethers.getContractAt("TradingAccount", vAddr);
      await vault.connect(user).deposit(usdcAddr, amount);
    }
  });

  // ============================================================
  //               TAKE-PROFIT ORDER PLACEMENT
  // ============================================================
  describe("placeTakeProfitOrder()", function () {
    let posId;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
    });

    it("places a TP order on a long position", async function () {
      await d.orderBook.connect(d.user1).placeTakeProfitOrder(posId, ethers.parseEther("55000"));
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);
      expect(ids.length).to.equal(1);

      const order = await d.orderBook.getOrder(ids[0]);
      expect(order.orderType).to.equal(2); // ORDER_TYPE_TAKE_PROFIT
      expect(order.active).to.equal(true);
      expect(order.isLong).to.equal(true);
      expect(order.triggerPrice).to.equal(ethers.parseEther("55000"));
      expect(order.collateralAmount).to.equal(0); // TP/SL have no collateral
    });

    it("emits OrderPlaced event", async function () {
      await expect(
        d.orderBook.connect(d.user1).placeTakeProfitOrder(posId, ethers.parseEther("55000"))
      ).to.emit(d.orderBook, "OrderPlaced");
    });

    it("reverts with zero trigger price", async function () {
      await expect(
        d.orderBook.connect(d.user1).placeTakeProfitOrder(posId, 0)
      ).to.be.revertedWith("OrderBook: zero trigger price");
    });

    it("reverts on inactive position", async function () {
      await d.position.connect(d.user1).closePosition(posId);
      await expect(
        d.orderBook.connect(d.user1).placeTakeProfitOrder(posId, ethers.parseEther("55000"))
      ).to.be.revertedWith("OrderBook: position not active");
    });

    it("reverts when not position owner", async function () {
      await expect(
        d.orderBook.connect(d.user2).placeTakeProfitOrder(posId, ethers.parseEther("55000"))
      ).to.be.revertedWith("OrderBook: not position owner");
    });
  });

  // ============================================================
  //               STOP-LOSS ORDER PLACEMENT
  // ============================================================
  describe("placeStopLossOrder()", function () {
    let posId;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
    });

    it("places a SL order on a long position", async function () {
      await d.orderBook.connect(d.user1).placeStopLossOrder(posId, ethers.parseEther("48000"));
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);
      const order = await d.orderBook.getOrder(ids[0]);
      expect(order.orderType).to.equal(3); // ORDER_TYPE_STOP_LOSS
      expect(order.active).to.equal(true);
      expect(order.isLong).to.equal(true);
    });

    it("places SL on a short position", async function () {
      await d.position.connect(d.user2).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), false);
      const shortPosId = await d.position.getUserMarketPosition(d.user2.address, 0);
      await d.orderBook.connect(d.user2).placeStopLossOrder(shortPosId, ethers.parseEther("52000"));
      const ids = await d.orderBook.getUserOrderIds(d.user2.address);
      const order = await d.orderBook.getOrder(ids[0]);
      expect(order.orderType).to.equal(3);
      expect(order.isLong).to.equal(false);
    });
  });

  // ============================================================
  //              TP ORDER EXECUTION (LONG)
  // ============================================================
  describe("executeOrder() — TP on long", function () {
    let posId, tpOrderId;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);

      await d.orderBook.connect(d.user1).placeTakeProfitOrder(posId, ethers.parseEther("55000"));
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);
      tpOrderId = ids[0];
    });

    it("closes position when TP trigger is met (price >= trigger)", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("56000")]);
      await d.orderBook.connect(d.keeper).executeOrder(tpOrderId);

      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(false);

      const order = await d.orderBook.getOrder(tpOrderId);
      expect(order.active).to.equal(false);
    });

    it("clears userMarketPosition mapping", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("56000")]);
      await d.orderBook.connect(d.keeper).executeOrder(tpOrderId);

      const mapped = await d.position.getUserMarketPosition(d.user1.address, 0);
      expect(mapped).to.equal(0);
    });

    it("reduces open interest to zero", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("56000")]);
      await d.orderBook.connect(d.keeper).executeOrder(tpOrderId);

      const [longOI] = await d.position.getOpenInterest(0);
      expect(longOI).to.equal(0);
    });

    it("transfers payout to user vault", async function () {
      const vAddr = await d.vaultFactory.getVault(d.user1.address);
      const balBefore = await d.usdc.balanceOf(vAddr);

      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("56000")]);
      await d.orderBook.connect(d.keeper).executeOrder(tpOrderId);

      const balAfter = await d.usdc.balanceOf(vAddr);
      expect(balAfter).to.be.greaterThan(balBefore);
    });

    it("emits OrderExecuted and PositionClosed events", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("56000")]);
      await expect(d.orderBook.connect(d.keeper).executeOrder(tpOrderId))
        .to.emit(d.orderBook, "OrderExecuted")
        .and.to.emit(d.orderBook, "PositionClosed");
    });

    it("reverts if TP not triggered (price below trigger)", async function () {
      await expect(
        d.orderBook.connect(d.keeper).executeOrder(tpOrderId)
      ).to.be.revertedWith("OrderBook: TP long not triggered");
    });

    it("allows opening new position in same market after TP close", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("56000")]);
      await d.orderBook.connect(d.keeper).executeOrder(tpOrderId);

      await d.position.connect(d.user1).openPosition(0, usdcAddr, 5000n * 10n ** 6n, ethers.parseEther("5"), false);
      const newPosId = await d.position.getUserMarketPosition(d.user1.address, 0);
      const newPos = await d.position.getPosition(newPosId);
      expect(newPos.active).to.equal(true);
      expect(newPos.isLong).to.equal(false);
    });
  });

  // ============================================================
  //             SL ORDER EXECUTION (LONG)
  // ============================================================
  describe("executeOrder() — SL on long", function () {
    let posId, slOrderId;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);

      await d.orderBook.connect(d.user1).placeStopLossOrder(posId, ethers.parseEther("48000"));
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);
      slOrderId = ids[0];
    });

    it("closes position when SL trigger is met (price <= trigger)", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("47000")]);
      await d.orderBook.connect(d.keeper).executeOrder(slOrderId);

      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(false);
    });

    it("reverts if SL not triggered (price above trigger)", async function () {
      await expect(
        d.orderBook.connect(d.keeper).executeOrder(slOrderId)
      ).to.be.revertedWith("OrderBook: SL long not triggered");
    });
  });

  // ============================================================
  //             TP/SL EXECUTION (SHORT)
  // ============================================================
  describe("executeOrder() — TP/SL on short", function () {
    let posId;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), false);
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
    });

    it("TP short triggers when price drops below trigger", async function () {
      await d.orderBook.connect(d.user1).placeTakeProfitOrder(posId, ethers.parseEther("45000"));
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);

      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("44000")]);
      await d.orderBook.connect(d.keeper).executeOrder(ids[0]);

      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(false);
    });

    it("SL short triggers when price rises above trigger", async function () {
      await d.orderBook.connect(d.user1).placeStopLossOrder(posId, ethers.parseEther("52000"));
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);

      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("53000")]);
      await d.orderBook.connect(d.keeper).executeOrder(ids[0]);

      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(false);
    });

    it("TP short reverts if price too high", async function () {
      await d.orderBook.connect(d.user1).placeTakeProfitOrder(posId, ethers.parseEther("45000"));
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);

      await expect(
        d.orderBook.connect(d.keeper).executeOrder(ids[0])
      ).to.be.revertedWith("OrderBook: TP short not triggered");
    });

    it("SL short reverts if price too low", async function () {
      await d.orderBook.connect(d.user1).placeStopLossOrder(posId, ethers.parseEther("52000"));
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);

      await expect(
        d.orderBook.connect(d.keeper).executeOrder(ids[0])
      ).to.be.revertedWith("OrderBook: SL short not triggered");
    });
  });

  // ============================================================
  //            EDGE CASES
  // ============================================================
  describe("Edge cases", function () {
    it("reverts TP execution when position was already closed manually", async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);

      await d.orderBook.connect(d.user1).placeTakeProfitOrder(posId, ethers.parseEther("55000"));
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);

      await d.position.connect(d.user1).closePosition(posId);

      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("56000")]);
      await expect(
        d.orderBook.connect(d.keeper).executeOrder(ids[0])
      ).to.be.revertedWith("OrderBook: no position to close");
    });

    it("user can cancel TP/SL order", async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);

      await d.orderBook.connect(d.user1).placeTakeProfitOrder(posId, ethers.parseEther("55000"));
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);

      await d.orderBook.connect(d.user1).cancelOrder(ids[0]);
      const order = await d.orderBook.getOrder(ids[0]);
      expect(order.active).to.equal(false);
    });

    it("executeOrder returns 0 for TP/SL (close order, no new position)", async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);

      await d.orderBook.connect(d.user1).placeTakeProfitOrder(posId, ethers.parseEther("55000"));
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);

      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("56000")]);
      const result = await d.orderBook.connect(d.keeper).executeOrder.staticCall(ids[0]);
      expect(result).to.equal(0);
    });
  });
});
