const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, setupFullProtocol } = require("./helpers/deployDiamond");

describe("PositionFacet", function () {
  let d, roles, usdcAddr, vaultAddr;

  beforeEach(async function () {
    d = await deployFullDiamond();
    roles = await setupFullProtocol(d);
    usdcAddr = await d.usdc.getAddress();

    // Create vaults and deposit collateral for user1 and user2
    await d.vaultFactory.connect(d.user1).createVault();
    vaultAddr = await d.vaultFactory.getVault(d.user1.address);
    const depositAmount = 100_000n * 10n ** 6n; // $100k USDC
    await d.usdc.connect(d.user1).approve(vaultAddr, depositAmount);
    const vault = await ethers.getContractAt("UserVault", vaultAddr);
    await vault.connect(d.user1).deposit(usdcAddr, depositAmount);

    await d.vaultFactory.connect(d.user2).createVault();
    const vault2Addr = await d.vaultFactory.getVault(d.user2.address);
    await d.usdc.connect(d.user2).approve(vault2Addr, depositAmount);
    const vault2 = await ethers.getContractAt("UserVault", vault2Addr);
    await vault2.connect(d.user2).deposit(usdcAddr, depositAmount);
  });

  // ==========================================================
  //                    OPEN POSITION
  // ==========================================================
  describe("openPosition()", function () {
    it("opens a long BTC position", async function () {
      const collateral = 1000n * 10n ** 6n; // $1000 USDC
      const leverage = ethers.parseEther("10"); // 10x
      const tx = await d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, leverage, true);
      await tx.wait();

      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
      expect(posId).to.be.greaterThan(0);

      const pos = await d.position.getPosition(posId);
      expect(pos.user).to.equal(d.user1.address);
      expect(pos.marketId).to.equal(0);
      expect(pos.isLong).to.equal(true);
      expect(pos.active).to.equal(true);
      expect(pos.sizeUsd).to.be.greaterThan(0);
    });

    it("opens a short ETH position", async function () {
      const collateral = 500n * 10n ** 6n;
      const leverage = ethers.parseEther("5");
      await d.position.connect(d.user1).openPosition(1, usdcAddr, collateral, leverage, false);
      const posId = await d.position.getUserMarketPosition(d.user1.address, 1);
      const pos = await d.position.getPosition(posId);
      expect(pos.isLong).to.equal(false);
      expect(pos.active).to.equal(true);
    });

    it("emits PositionOpened event", async function () {
      const collateral = 1000n * 10n ** 6n;
      const leverage = ethers.parseEther("10");
      await expect(
        d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, leverage, true)
      ).to.emit(d.position, "PositionOpened");
    });

    it("updates open interest", async function () {
      const collateral = 1000n * 10n ** 6n;
      const leverage = ethers.parseEther("10");
      await d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, leverage, true);
      const [longOI, shortOI] = await d.position.getOpenInterest(0);
      expect(longOI).to.be.greaterThan(0);
      expect(shortOI).to.equal(0);
    });

    it("getUserPositionIds returns position", async function () {
      const collateral = 1000n * 10n ** 6n;
      const leverage = ethers.parseEther("10");
      await d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, leverage, true);
      const ids = await d.position.getUserPositionIds(d.user1.address);
      expect(ids.length).to.equal(1);
    });

    it("reverts when protocol is paused", async function () {
      const PAUSER = await d.accessControl.PAUSER_ROLE();
      await d.accessControl.grantRole(PAUSER, d.owner.address);
      await d.pausable.pauseGlobal();
      await expect(
        d.position.connect(d.user1).openPosition(0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("10"), true)
      ).to.be.revertedWith("Position: protocol paused");
    });

    it("reverts when market is paused", async function () {
      const PAUSER = await d.accessControl.PAUSER_ROLE();
      await d.accessControl.grantRole(PAUSER, d.owner.address);
      await d.pausable.pauseMarket(0);
      await expect(
        d.position.connect(d.user1).openPosition(0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("10"), true)
      ).to.be.revertedWith("Position: market paused");
    });

    it("reverts on disabled market", async function () {
      await d.marketRegistry.disableMarket(0);
      await expect(
        d.position.connect(d.user1).openPosition(0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("10"), true)
      ).to.be.revertedWith("Position: market not enabled");
    });

    it("reverts on non-accepted collateral", async function () {
      const usdtAddr = await d.usdt.getAddress();
      await expect(
        d.position.connect(d.user1).openPosition(0, usdtAddr, 1000, ethers.parseEther("10"), true)
      ).to.be.revertedWith("Position: collateral not accepted");
    });

    it("reverts with no vault", async function () {
      const [,,,,, extra] = await ethers.getSigners();
      // extra has no vault
      await expect(
        d.position.connect(extra).openPosition(0, usdcAddr, 1000, ethers.parseEther("10"), true)
      ).to.be.reverted;
    });

    it("reverts when leverage exceeds max", async function () {
      const collateral = 100n * 10n ** 6n;
      const leverage = ethers.parseEther("1001"); // > 1000x
      await expect(
        d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, leverage, true)
      ).to.be.revertedWith("LibPosition: leverage exceeds maximum");
    });

    it("reverts on stale price", async function () {
      await ethers.provider.send("evm_increaseTime", [121]);
      await ethers.provider.send("evm_mine");
      await expect(
        d.position.connect(d.user1).openPosition(0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("10"), true)
      ).to.be.revertedWith("Position: price is stale");
    });

    // ---- NET MODE TESTS ----
    describe("Net mode enforcement", function () {
      it("cannot open opposite direction in same market", async function () {
        const collateral = 1000n * 10n ** 6n;
        const leverage = ethers.parseEther("10");
        await d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, leverage, true);
        await expect(
          d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, leverage, false)
        ).to.be.revertedWith("Position: close existing position first");
      });

      it("cannot open same direction in same market (must use addSize)", async function () {
        const collateral = 1000n * 10n ** 6n;
        const leverage = ethers.parseEther("10");
        await d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, leverage, true);
        await expect(
          d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, leverage, true)
        ).to.be.revertedWith("Position: close existing position first");
      });

      it("CAN open positions in different markets", async function () {
        const collateral = 1000n * 10n ** 6n;
        const leverage = ethers.parseEther("10");
        await d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, leverage, true);
        await d.position.connect(d.user1).openPosition(1, usdcAddr, collateral, leverage, false);
        const btcPos = await d.position.getUserMarketPosition(d.user1.address, 0);
        const ethPos = await d.position.getUserMarketPosition(d.user1.address, 1);
        expect(btcPos).to.be.greaterThan(0);
        expect(ethPos).to.be.greaterThan(0);
      });

      it("different users can trade same market", async function () {
        const collateral = 1000n * 10n ** 6n;
        const leverage = ethers.parseEther("10");
        await d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, leverage, true);
        await d.position.connect(d.user2).openPosition(0, usdcAddr, collateral, leverage, false);
        const u1 = await d.position.getUserMarketPosition(d.user1.address, 0);
        const u2 = await d.position.getUserMarketPosition(d.user2.address, 0);
        expect(u1).to.be.greaterThan(0);
        expect(u2).to.be.greaterThan(0);
      });
    });

    describe("Leverage edge cases", function () {
      it("1x leverage works", async function () {
        const collateral = 10000n * 10n ** 6n;
        await d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, ethers.parseEther("1"), true);
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
        expect(posId).to.be.greaterThan(0);
      });

      it("1000x leverage works", async function () {
        const collateral = 100n * 10n ** 6n; // $100
        await d.position.connect(d.user1).openPosition(0, usdcAddr, collateral, ethers.parseEther("1000"), true);
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
        const pos = await d.position.getPosition(posId);
        expect(pos.active).to.equal(true);
      });
    });
  });

  // ==========================================================
  //                    ADD COLLATERAL
  // ==========================================================
  describe("addCollateral()", function () {
    let posId;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("10"), true);
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
    });

    it("adds collateral to existing position", async function () {
      const before = await d.position.getPosition(posId);
      await d.position.connect(d.user1).addCollateral(posId, 500n * 10n ** 6n);
      const after = await d.position.getPosition(posId);
      expect(after.collateralUsd).to.be.greaterThan(before.collateralUsd);
    });

    it("reverts for non-owner", async function () {
      await expect(
        d.position.connect(d.user2).addCollateral(posId, 500n * 10n ** 6n)
      ).to.be.revertedWith("Position: not owner");
    });

    it("reverts on zero amount", async function () {
      await expect(
        d.position.connect(d.user1).addCollateral(posId, 0)
      ).to.be.revertedWith("Position: zero amount");
    });

    it("reverts on inactive position", async function () {
      await d.position.connect(d.user1).closePosition(posId);
      await expect(
        d.position.connect(d.user1).addCollateral(posId, 500n * 10n ** 6n)
      ).to.be.revertedWith("Position: not active");
    });

    it("emits PositionModified event", async function () {
      await expect(d.position.connect(d.user1).addCollateral(posId, 500n * 10n ** 6n))
        .to.emit(d.position, "PositionModified");
    });
  });

  // ==========================================================
  //                      ADD SIZE
  // ==========================================================
  describe("addSize()", function () {
    let posId;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("10"), true);
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
    });

    it("increases position size", async function () {
      const before = await d.position.getPosition(posId);
      await d.position.connect(d.user1).addSize(posId, 500n * 10n ** 6n, ethers.parseEther("10"));
      const after = await d.position.getPosition(posId);
      expect(after.sizeUsd).to.be.greaterThan(before.sizeUsd);
    });

    it("updates open interest", async function () {
      const [beforeLong] = await d.position.getOpenInterest(0);
      await d.position.connect(d.user1).addSize(posId, 500n * 10n ** 6n, ethers.parseEther("10"));
      const [afterLong] = await d.position.getOpenInterest(0);
      expect(afterLong).to.be.greaterThan(beforeLong);
    });

    it("reverts for non-owner", async function () {
      await expect(
        d.position.connect(d.user2).addSize(posId, 500n * 10n ** 6n, ethers.parseEther("10"))
      ).to.be.revertedWith("Position: not owner");
    });

    it("reverts on inactive position", async function () {
      await d.position.connect(d.user1).closePosition(posId);
      await expect(
        d.position.connect(d.user1).addSize(posId, 500n * 10n ** 6n, ethers.parseEther("10"))
      ).to.be.revertedWith("Position: not active");
    });

    it("emits PositionModified event", async function () {
      await expect(d.position.connect(d.user1).addSize(posId, 500n * 10n ** 6n, ethers.parseEther("10")))
        .to.emit(d.position, "PositionModified");
    });
  });

  // ==========================================================
  //                    PARTIAL CLOSE
  // ==========================================================
  describe("partialClose()", function () {
    let posId, posSize;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
      const pos = await d.position.getPosition(posId);
      posSize = pos.sizeUsd;
    });

    it("reduces position size proportionally", async function () {
      const halfSize = posSize / 2n;
      await d.position.connect(d.user1).partialClose(posId, halfSize);
      const pos = await d.position.getPosition(posId);
      expect(pos.sizeUsd).to.be.lessThan(posSize);
      expect(pos.active).to.equal(true); // still active
    });

    it("reduces open interest", async function () {
      const [beforeLong] = await d.position.getOpenInterest(0);
      const halfSize = posSize / 2n;
      await d.position.connect(d.user1).partialClose(posId, halfSize);
      const [afterLong] = await d.position.getOpenInterest(0);
      expect(afterLong).to.be.lessThan(beforeLong);
    });

    it("reverts closing 0 size", async function () {
      await expect(
        d.position.connect(d.user1).partialClose(posId, 0)
      ).to.be.revertedWith("Position: invalid close size");
    });

    it("reverts closing full size (use closePosition instead)", async function () {
      await expect(
        d.position.connect(d.user1).partialClose(posId, posSize)
      ).to.be.revertedWith("Position: invalid close size");
    });

    it("reverts closing more than size", async function () {
      await expect(
        d.position.connect(d.user1).partialClose(posId, posSize + 1n)
      ).to.be.revertedWith("Position: invalid close size");
    });

    it("reverts for non-owner", async function () {
      await expect(
        d.position.connect(d.user2).partialClose(posId, posSize / 2n)
      ).to.be.revertedWith("Position: not owner");
    });

    it("emits PositionClosed event with isFullClose=false", async function () {
      await expect(d.position.connect(d.user1).partialClose(posId, posSize / 2n))
        .to.emit(d.position, "PositionClosed");
    });
  });

  // ==========================================================
  //                    CLOSE POSITION
  // ==========================================================
  describe("closePosition()", function () {
    let posId;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
    });

    it("closes position fully", async function () {
      await d.position.connect(d.user1).closePosition(posId);
      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(false);
    });

    it("clears userMarketPosition mapping", async function () {
      await d.position.connect(d.user1).closePosition(posId);
      const mapped = await d.position.getUserMarketPosition(d.user1.address, 0);
      expect(mapped).to.equal(0);
    });

    it("reduces open interest to zero", async function () {
      await d.position.connect(d.user1).closePosition(posId);
      const [longOI] = await d.position.getOpenInterest(0);
      expect(longOI).to.equal(0);
    });

    it("returns collateral to user vault", async function () {
      const vault = await ethers.getContractAt("UserVault", vaultAddr);
      const balanceBefore = await vault.getBalance(usdcAddr);
      await d.position.connect(d.user1).closePosition(posId);
      const balanceAfter = await vault.getBalance(usdcAddr);
      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });

    it("allows opening new position after close", async function () {
      await d.position.connect(d.user1).closePosition(posId);
      // Now can open in same market
      await d.position.connect(d.user1).openPosition(0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("5"), false);
      const newPosId = await d.position.getUserMarketPosition(d.user1.address, 0);
      const newPos = await d.position.getPosition(newPosId);
      expect(newPos.isLong).to.equal(false);
      expect(newPos.active).to.equal(true);
    });

    it("reverts for non-owner", async function () {
      await expect(
        d.position.connect(d.user2).closePosition(posId)
      ).to.be.revertedWith("Position: not owner");
    });

    it("reverts for already closed position", async function () {
      await d.position.connect(d.user1).closePosition(posId);
      await expect(
        d.position.connect(d.user1).closePosition(posId)
      ).to.be.revertedWith("Position: not active");
    });

    it("emits PositionClosed event with isFullClose=true", async function () {
      await expect(d.position.connect(d.user1).closePosition(posId))
        .to.emit(d.position, "PositionClosed");
    });

    describe("PnL scenarios", function () {
      it("profit scenario — price goes up for long", async function () {
        // Price goes up 10%
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("55000")]);
        const vault = await ethers.getContractAt("UserVault", vaultAddr);
        const balBefore = await d.usdc.balanceOf(vaultAddr);
        await d.position.connect(d.user1).closePosition(posId);
        const balAfter = await d.usdc.balanceOf(vaultAddr);
        // Should get back more than deposited
        expect(balAfter).to.be.greaterThan(balBefore);
      });

      it("loss scenario — price goes down for long", async function () {
        // Price goes down 5%
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("47500")]);
        const vault = await ethers.getContractAt("UserVault", vaultAddr);
        await d.position.connect(d.user1).closePosition(posId);
        // Position closed but with loss
        const pos = await d.position.getPosition(posId);
        expect(pos.active).to.equal(false);
      });
    });
  });
});
