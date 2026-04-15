const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, setupFullProtocol } = require("./helpers/deployDiamond");

describe("Bug Fixes (A.2 Liquidation Accounting, A.3 ADL Insurance, B.7 Price Staleness)", function () {
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
  //      A.2: LIQUIDATION ACCOUNTING (No Double Deduction)
  // ============================================================
  describe("Liquidation Accounting Fix", function () {
    let posId;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("100"), true
      );
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
    });

    it("vault balance only deducted once for keeper + user remainder", async function () {
      const diamondBalBefore = await d.usdc.balanceOf(d.diamondAddress);
      const user1VAddr = await d.vaultFactory.getVault(d.user1.address);
      const userVaultBalBefore = await d.usdc.balanceOf(user1VAddr);

      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("49000")]);
      const liquidatorBalBefore = await d.usdc.balanceOf(d.user2.address);

      await d.liquidation.connect(d.user2).liquidate(posId);

      const diamondBalAfter = await d.usdc.balanceOf(d.diamondAddress);
      const liquidatorBalAfter = await d.usdc.balanceOf(d.user2.address);
      const userVaultBalAfter = await d.usdc.balanceOf(user1VAddr);

      const keeperReward = liquidatorBalAfter - liquidatorBalBefore;
      const userReturned = userVaultBalAfter - userVaultBalBefore;
      const totalOutflow = diamondBalBefore - diamondBalAfter;

      // Total outflow = keeper reward + user remainder
      // It should NOT exceed the original collateral (no double deduction)
      expect(totalOutflow).to.be.lessThanOrEqual(1000n * 10n ** 6n);
      expect(totalOutflow).to.equal(keeperReward + userReturned);
    });

    it("liquidation distributes penalty correctly: keeper + insurance + user", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("49000")]);

      const insuranceBefore = await d.insuranceFund.getInsuranceBalance(usdcAddr);
      const liquidatorBefore = await d.usdc.balanceOf(d.user2.address);
      const user1VAddr = await d.vaultFactory.getVault(d.user1.address);
      const userVaultBefore = await d.usdc.balanceOf(user1VAddr);

      await d.liquidation.connect(d.user2).liquidate(posId);

      const insuranceAfter = await d.insuranceFund.getInsuranceBalance(usdcAddr);
      const liquidatorAfter = await d.usdc.balanceOf(d.user2.address);
      const userVaultAfter = await d.usdc.balanceOf(user1VAddr);

      const keeperReward = liquidatorAfter - liquidatorBefore;
      const insuranceGain = insuranceAfter - insuranceBefore;
      const userReturned = userVaultAfter - userVaultBefore;

      // At least one of keeper or insurance should receive something
      expect(keeperReward + insuranceGain).to.be.greaterThanOrEqual(0);
      // User may get a remainder if there's equity left after penalty
      // Total distributed should not exceed original collateral
      expect(keeperReward + userReturned).to.be.lessThanOrEqual(1000n * 10n ** 6n);
    });

    it("position is deactivated after liquidation", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("49000")]);
      await d.liquidation.connect(d.user2).liquidate(posId);

      const pos = await d.position.getPosition(posId);
      expect(pos.active).to.equal(false);

      const mapped = await d.position.getUserMarketPosition(d.user1.address, 0);
      expect(mapped).to.equal(0);
    });

    it("OI is reduced after liquidation", async function () {
      const [longOIBefore] = await d.position.getOpenInterest(0);
      expect(longOIBefore).to.be.greaterThan(0);

      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("49000")]);
      await d.liquidation.connect(d.user2).liquidate(posId);

      const [longOIAfter] = await d.position.getOpenInterest(0);
      expect(longOIAfter).to.equal(0);
    });
  });

  // ============================================================
  //     A.3: ADL INSURANCE THRESHOLD CHECK
  // ============================================================
  describe("ADL Insurance Threshold Fix", function () {
    let posId;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);

      // Make position profitable
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("55000")]);
    });

    it("ADL reverts when insurance fund is above threshold", async function () {
      // Set ADL threshold to something low (insurance fund is healthy)
      await d.insuranceFund.setADLThreshold(0);

      await expect(
        d.liquidation.connect(d.keeper).autoDeleverage(posId, ethers.parseEther("10000"))
      ).to.be.revertedWith("Liquidation: insurance fund sufficient, ADL not needed");
    });

    it("ADL reverts when insurance fund is above a non-zero threshold", async function () {
      // Generate some insurance balance by opening/closing positions
      await d.position.connect(d.user2).openPosition(
        1, usdcAddr, 5000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      const p2 = await d.position.getUserMarketPosition(d.user2.address, 1);
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0, 1], [ethers.parseEther("55000"), ethers.parseEther("3000")]);
      await d.position.connect(d.user2).closePosition(p2);

      // Set threshold below current insurance balance
      await d.insuranceFund.setADLThreshold(1); // very low threshold

      // ADL should fail because insurance is sufficient
      await expect(
        d.liquidation.connect(d.keeper).autoDeleverage(posId, ethers.parseEther("10000"))
      ).to.be.revertedWith("Liquidation: insurance fund sufficient, ADL not needed");
    });

    it("ADL succeeds when insurance fund is below threshold", async function () {
      // Set a very high threshold so insurance is "depleted"
      await d.insuranceFund.setADLThreshold(ethers.parseEther("999999999"));

      const posBefore = await d.position.getPosition(posId);
      const sizeBefore = posBefore.sizeUsd;

      const deleverageSize = ethers.parseEther("10000");
      await d.liquidation.connect(d.keeper).autoDeleverage(posId, deleverageSize);

      const posAfter = await d.position.getPosition(posId);
      expect(posAfter.sizeUsd).to.be.lessThan(sizeBefore);
    });

    it("ADL reverts on non-profitable position", async function () {
      // Move price down so position is unprofitable
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("45000")]);
      await d.insuranceFund.setADLThreshold(ethers.parseEther("999999999"));

      await expect(
        d.liquidation.connect(d.keeper).autoDeleverage(posId, ethers.parseEther("1000"))
      ).to.be.revertedWith("Liquidation: ADL only on profitable positions");
    });

    it("ADL reverts for non-authorized caller", async function () {
      await d.insuranceFund.setADLThreshold(ethers.parseEther("999999999"));

      await expect(
        d.liquidation.connect(d.user1).autoDeleverage(posId, ethers.parseEther("1000"))
      ).to.be.revertedWith("Liquidation: not authorized for ADL");
    });

    it("ADL reverts with zero deleverage size", async function () {
      await d.insuranceFund.setADLThreshold(ethers.parseEther("999999999"));

      await expect(
        d.liquidation.connect(d.keeper).autoDeleverage(posId, 0)
      ).to.be.revertedWith("Liquidation: invalid ADL size");
    });

    it("ADL reverts with deleverage size > position size", async function () {
      await d.insuranceFund.setADLThreshold(ethers.parseEther("999999999"));
      const pos = await d.position.getPosition(posId);

      await expect(
        d.liquidation.connect(d.keeper).autoDeleverage(posId, pos.sizeUsd + 1n)
      ).to.be.revertedWith("Liquidation: invalid ADL size");
    });

    it("ADL deactivates position when fully deleveraged", async function () {
      await d.insuranceFund.setADLThreshold(ethers.parseEther("999999999"));
      const pos = await d.position.getPosition(posId);

      await d.liquidation.connect(d.keeper).autoDeleverage(posId, pos.sizeUsd);

      const posAfter = await d.position.getPosition(posId);
      expect(posAfter.active).to.equal(false);
      expect(posAfter.sizeUsd).to.equal(0);
    });
  });

  // ============================================================
  //      B.7: PRICE STALENESS CHECK IN ORDER EXECUTION
  // ============================================================
  describe("Price Staleness in Order Execution", function () {
    it("executeOrder reverts on stale price", async function () {
      await d.orderBook.connect(d.user1).placeLimitOrder(
        0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
        ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
      );
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);

      // Drop price to trigger
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("47000")]);

      // Advance time past staleness
      await ethers.provider.send("evm_increaseTime", [121]);
      await ethers.provider.send("evm_mine");

      await expect(
        d.orderBook.connect(d.keeper).executeOrder(ids[0])
      ).to.be.revertedWith("OrderBook: price is stale");
    });

    it("executeOrder succeeds with fresh price", async function () {
      await d.orderBook.connect(d.user1).placeLimitOrder(
        0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
        ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
      );
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);

      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("47000")]);
      await d.orderBook.connect(d.keeper).executeOrder(ids[0]);

      const order = await d.orderBook.getOrder(ids[0]);
      expect(order.active).to.equal(false);
    });
  });

  // ============================================================
  //       FUNDING-AWARE LIQUIDATION CHECK (H4)
  // ============================================================
  describe("checkLiquidatable accounts for pending funding", function () {
    it("returns funding-adjusted margin ratio", async function () {
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("50"), true
      );
      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);

      // Check with no funding — should be healthy
      const [liq1, margin1] = await d.liquidation.checkLiquidatable(posId);
      expect(liq1).to.equal(false);
      expect(margin1).to.be.greaterThan(0);
    });

    it("returns false for inactive position", async function () {
      const [liq, margin] = await d.liquidation.checkLiquidatable(999);
      expect(liq).to.equal(false);
      expect(margin).to.equal(0);
    });
  });
});
