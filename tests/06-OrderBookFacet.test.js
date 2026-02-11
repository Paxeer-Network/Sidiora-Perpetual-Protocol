const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, setupFullProtocol } = require("./helpers/deployDiamond");

describe("OrderBookFacet", function () {
  let d, roles, usdcAddr;

  beforeEach(async function () {
    d = await deployFullDiamond();
    roles = await setupFullProtocol(d);
    usdcAddr = await d.usdc.getAddress();

    // Create vaults and deposit for users
    for (const user of [d.user1, d.user2]) {
      await d.vaultFactory.connect(user).createVault();
      const vAddr = await d.vaultFactory.getVault(user.address);
      const amount = 100_000n * 10n ** 6n;
      await d.usdc.connect(user).approve(vAddr, amount);
      const vault = await ethers.getContractAt("UserVault", vAddr);
      await vault.connect(user).deposit(usdcAddr, amount);
    }
  });

  // ==========================================================
  //                  PLACE LIMIT ORDER
  // ==========================================================
  describe("placeLimitOrder()", function () {
    it("places a limit long order", async function () {
      const tx = await d.orderBook.connect(d.user1).placeLimitOrder(
        0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
        ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
      );
      await tx.wait();
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);
      expect(ids.length).to.equal(1);

      const order = await d.orderBook.getOrder(ids[0]);
      expect(order.user).to.equal(d.user1.address);
      expect(order.isLong).to.equal(true);
      expect(order.orderType).to.equal(0); // LIMIT
      expect(order.active).to.equal(true);
    });

    it("places a limit short order", async function () {
      await d.orderBook.connect(d.user1).placeLimitOrder(
        0, false, ethers.parseEther("52000"), ethers.parseEther("10000"),
        ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
      );
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);
      const order = await d.orderBook.getOrder(ids[0]);
      expect(order.isLong).to.equal(false);
    });

    it("emits OrderPlaced event", async function () {
      await expect(
        d.orderBook.connect(d.user1).placeLimitOrder(
          0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
          ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
        )
      ).to.emit(d.orderBook, "OrderPlaced");
    });

    it("reverts with zero trigger price", async function () {
      await expect(
        d.orderBook.connect(d.user1).placeLimitOrder(
          0, true, 0, ethers.parseEther("10000"),
          ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
        )
      ).to.be.revertedWith("OrderBook: zero trigger price");
    });

    it("reverts with zero size", async function () {
      await expect(
        d.orderBook.connect(d.user1).placeLimitOrder(
          0, true, ethers.parseEther("48000"), 0,
          ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
        )
      ).to.be.revertedWith("OrderBook: zero size");
    });

    it("reverts with zero collateral", async function () {
      await expect(
        d.orderBook.connect(d.user1).placeLimitOrder(
          0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
          ethers.parseEther("10"), usdcAddr, 0
        )
      ).to.be.revertedWith("OrderBook: zero collateral");
    });

    it("reverts with disabled market", async function () {
      await d.marketRegistry.disableMarket(0);
      await expect(
        d.orderBook.connect(d.user1).placeLimitOrder(
          0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
          ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
        )
      ).to.be.revertedWith("OrderBook: market not enabled");
    });

    it("reverts with non-accepted collateral", async function () {
      const usdtAddr = await d.usdt.getAddress();
      await expect(
        d.orderBook.connect(d.user1).placeLimitOrder(
          0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
          ethers.parseEther("10"), usdtAddr, 1000n * 10n ** 6n
        )
      ).to.be.revertedWith("OrderBook: collateral not accepted");
    });

    it("reverts with excessive leverage", async function () {
      await expect(
        d.orderBook.connect(d.user1).placeLimitOrder(
          0, true, ethers.parseEther("48000"), ethers.parseEther("10000000"),
          ethers.parseEther("10000"), usdcAddr, 1000n * 10n ** 6n
        )
      ).to.be.revertedWith("LibPosition: leverage exceeds maximum");
    });

    it("reverts without vault", async function () {
      const [,,,,,, extra] = await ethers.getSigners();
      await expect(
        d.orderBook.connect(extra).placeLimitOrder(
          0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
          ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
        )
      ).to.be.revertedWith("OrderBook: create vault first");
    });

    it("multiple orders from same user", async function () {
      await d.orderBook.connect(d.user1).placeLimitOrder(
        0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
        ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
      );
      await d.orderBook.connect(d.user1).placeLimitOrder(
        1, false, ethers.parseEther("3500"), ethers.parseEther("5000"),
        ethers.parseEther("10"), usdcAddr, 500n * 10n ** 6n
      );
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);
      expect(ids.length).to.equal(2);
    });
  });

  // ==========================================================
  //                PLACE STOP-LIMIT ORDER
  // ==========================================================
  describe("placeStopLimitOrder()", function () {
    it("places a stop-limit order", async function () {
      await d.orderBook.connect(d.user1).placeStopLimitOrder(
        0, true, ethers.parseEther("52000"), ethers.parseEther("52500"),
        ethers.parseEther("10000"), ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
      );
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);
      const order = await d.orderBook.getOrder(ids[0]);
      expect(order.orderType).to.equal(1); // STOP_LIMIT
      expect(order.triggerPrice).to.equal(ethers.parseEther("52000"));
      expect(order.limitPrice).to.equal(ethers.parseEther("52500"));
    });
  });

  // ==========================================================
  //                    CANCEL ORDER
  // ==========================================================
  describe("cancelOrder()", function () {
    let orderId;

    beforeEach(async function () {
      await d.orderBook.connect(d.user1).placeLimitOrder(
        0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
        ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
      );
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);
      orderId = ids[0];
    });

    it("user can cancel their own order", async function () {
      await d.orderBook.connect(d.user1).cancelOrder(orderId);
      const order = await d.orderBook.getOrder(orderId);
      expect(order.active).to.equal(false);
    });

    it("reverts cancelling non-existent order", async function () {
      await expect(
        d.orderBook.connect(d.user1).cancelOrder(999)
      ).to.be.revertedWith("OrderBook: order not active");
    });

    it("reverts cancelling other user's order", async function () {
      await expect(
        d.orderBook.connect(d.user2).cancelOrder(orderId)
      ).to.be.revertedWith("OrderBook: not owner");
    });

    it("reverts cancelling already cancelled", async function () {
      await d.orderBook.connect(d.user1).cancelOrder(orderId);
      await expect(
        d.orderBook.connect(d.user1).cancelOrder(orderId)
      ).to.be.revertedWith("OrderBook: order not active");
    });

    it("emits OrderCancelled event", async function () {
      await expect(d.orderBook.connect(d.user1).cancelOrder(orderId))
        .to.emit(d.orderBook, "OrderCancelled")
        .withArgs(orderId, d.user1.address);
    });
  });

  // ==========================================================
  //                   EXECUTE ORDER
  // ==========================================================
  describe("executeOrder()", function () {
    let orderId;

    beforeEach(async function () {
      // Place limit long order at $48,000 (buy when price drops)
      await d.orderBook.connect(d.user1).placeLimitOrder(
        0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
        ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
      );
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);
      orderId = ids[0];
    });

    it("keeper can execute triggered limit order", async function () {
      // Drop BTC price below trigger
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("47000")]);
      const posId = await d.orderBook.connect(d.keeper).executeOrder.staticCall(orderId);
      await d.orderBook.connect(d.keeper).executeOrder(orderId);

      // Order deactivated
      const order = await d.orderBook.getOrder(orderId);
      expect(order.active).to.equal(false);

      // Position created
      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(true);
      expect(pos.isLong).to.equal(true);
    });

    it("reverts if trigger not met", async function () {
      // Price is $50,000, trigger is $48,000 for limit long
      await expect(
        d.orderBook.connect(d.keeper).executeOrder(orderId)
      ).to.be.revertedWith("OrderBook: limit long not triggered");
    });

    it("non-keeper cannot execute", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("47000")]);
      await expect(
        d.orderBook.connect(d.user1).executeOrder(orderId)
      ).to.be.revertedWith("LibAccessControl: account is missing role");
    });

    it("reverts executing cancelled order", async function () {
      await d.orderBook.connect(d.user1).cancelOrder(orderId);
      await expect(
        d.orderBook.connect(d.keeper).executeOrder(orderId)
      ).to.be.revertedWith("OrderBook: order not active");
    });

    it("emits OrderExecuted and PositionOpened events", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("47000")]);
      await expect(d.orderBook.connect(d.keeper).executeOrder(orderId))
        .to.emit(d.orderBook, "OrderExecuted")
        .and.to.emit(d.orderBook, "PositionOpened");
    });

    it("limit short order triggers on price rise", async function () {
      // Place limit short at $52,000
      await d.orderBook.connect(d.user2).placeLimitOrder(
        0, false, ethers.parseEther("52000"), ethers.parseEther("10000"),
        ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
      );
      const ids = await d.orderBook.getUserOrderIds(d.user2.address);
      const shortOrderId = ids[0];

      // Raise price above trigger
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("53000")]);
      await d.orderBook.connect(d.keeper).executeOrder(shortOrderId);

      const order = await d.orderBook.getOrder(shortOrderId);
      expect(order.active).to.equal(false);
    });

    it("reverts when protocol is paused", async function () {
      const PAUSER = await d.accessControl.PAUSER_ROLE();
      await d.accessControl.grantRole(PAUSER, d.owner.address);
      await d.pausable.pauseGlobal();
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("47000")]);
      await expect(
        d.orderBook.connect(d.keeper).executeOrder(orderId)
      ).to.be.revertedWith("OrderBook: protocol paused");
    });

    it("reverts when user already has position in market (net mode)", async function () {
      // user1 opens a position directly first
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("47000")]);
      // Open position directly
      const vAddr = await d.vaultFactory.getVault(d.user1.address);
      // user1 needs more funds
      await d.usdc.mint(d.user1.address, 100_000n * 10n ** 6n);
      await d.usdc.connect(d.user1).approve(vAddr, 100_000n * 10n ** 6n);
      const vault = await ethers.getContractAt("UserVault", vAddr);
      await vault.connect(d.user1).deposit(usdcAddr, 100_000n * 10n ** 6n);
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("5"), true);

      // Now try to execute the order — should fail (net mode)
      await expect(
        d.orderBook.connect(d.keeper).executeOrder(orderId)
      ).to.be.revertedWith("OrderBook: user has active position in this market");
    });
  });
});
