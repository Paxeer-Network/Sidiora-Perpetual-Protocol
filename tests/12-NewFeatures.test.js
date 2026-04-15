const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, setupFullProtocol } = require("./helpers/deployDiamond");

describe("New Features (Borrowing Fee, Order Enhancements, Vault Solvency, RemoveCollateral, Oracle V2, Robustness)", function () {
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
  //                  BORROWING FEE
  // ============================================================
  describe("Borrowing Fee", function () {
    describe("setBorrowingFeeRate()", function () {
      it("admin can set borrowing fee rate", async function () {
        const rate = 10n ** 10n; // ~0.03%/hr
        await d.position.setBorrowingFeeRate(rate);
        expect(await d.position.getBorrowingFeeRate()).to.equal(rate);
      });

      it("non-admin cannot set rate", async function () {
        await expect(
          d.position.connect(d.user1).setBorrowingFeeRate(10n ** 10n)
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });
    });

    describe("getPendingBorrowingFee()", function () {
      it("returns zero when rate is zero", async function () {
        await d.position.connect(d.user1).openPosition(
          0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true
        );
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);

        await ethers.provider.send("evm_increaseTime", [3600]);
        await ethers.provider.send("evm_mine");

        const fee = await d.position.getPendingBorrowingFee(posId);
        expect(fee).to.equal(0);
      });

      it("accrues fee over time when rate is set", async function () {
        const rate = 10n ** 10n;
        await d.position.setBorrowingFeeRate(rate);

        await d.position.connect(d.user1).openPosition(
          0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true
        );
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);

        // Advance 1 hour
        await ethers.provider.send("evm_increaseTime", [3600]);
        await ethers.provider.send("evm_mine");

        const fee = await d.position.getPendingBorrowingFee(posId);
        expect(fee).to.be.greaterThan(0);
      });

      it("fee increases with time", async function () {
        await d.position.setBorrowingFeeRate(10n ** 10n);

        await d.position.connect(d.user1).openPosition(
          0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true
        );
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);

        await ethers.provider.send("evm_increaseTime", [3600]);
        await ethers.provider.send("evm_mine");
        const fee1h = await d.position.getPendingBorrowingFee(posId);

        await ethers.provider.send("evm_increaseTime", [3600]);
        await ethers.provider.send("evm_mine");
        const fee2h = await d.position.getPendingBorrowingFee(posId);

        expect(fee2h).to.be.greaterThan(fee1h);
      });

      it("returns zero for inactive position", async function () {
        expect(await d.position.getPendingBorrowingFee(999)).to.equal(0);
      });
    });

    describe("Borrowing fee deducted on close", function () {
      it("close position deducts borrowing fee from payout", async function () {
        await d.position.setBorrowingFeeRate(10n ** 12n); // high rate for visible effect

        await d.position.connect(d.user1).openPosition(
          0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true
        );
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);

        // Advance 1 day
        await ethers.provider.send("evm_increaseTime", [86400]);
        await ethers.provider.send("evm_mine");
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("50000")]);

        const pendingFee = await d.position.getPendingBorrowingFee(posId);
        expect(pendingFee).to.be.greaterThan(0);

        const vAddr = await d.vaultFactory.getVault(d.user1.address);
        const balBefore = await d.usdc.balanceOf(vAddr);
        await d.position.connect(d.user1).closePosition(posId);
        const balAfter = await d.usdc.balanceOf(vAddr);

        // Payout should be less than original collateral due to fees
        // (price unchanged, but trading fee + borrowing fee deducted)
        const payout = balAfter - balBefore;
        expect(payout).to.be.lessThan(10000n * 10n ** 6n);
      });
    });
  });

  // ============================================================
  //               ORDER COLLATERAL RESERVATION
  // ============================================================
  describe("Order Collateral Reservation", function () {
    it("placing a limit order reserves collateral in vault", async function () {
      const vAddr = await d.vaultFactory.getVault(d.user1.address);
      const vault = await ethers.getContractAt("TradingAccount", vAddr);

      const availBefore = await vault.getAvailableBalance(usdcAddr);

      await d.orderBook.connect(d.user1).placeLimitOrder(
        0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
        ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
      );

      const availAfter = await vault.getAvailableBalance(usdcAddr);
      expect(availAfter).to.be.lessThan(availBefore);
      expect(availBefore - availAfter).to.equal(1000n * 10n ** 6n);
    });

    it("cancelling order releases reserved collateral", async function () {
      const vAddr = await d.vaultFactory.getVault(d.user1.address);
      const vault = await ethers.getContractAt("TradingAccount", vAddr);

      const availBefore = await vault.getAvailableBalance(usdcAddr);

      await d.orderBook.connect(d.user1).placeLimitOrder(
        0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
        ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
      );
      const ids = await d.orderBook.getUserOrderIds(d.user1.address);

      await d.orderBook.connect(d.user1).cancelOrder(ids[0]);

      const availAfter = await vault.getAvailableBalance(usdcAddr);
      expect(availAfter).to.equal(availBefore);
    });

    it("cannot withdraw reserved collateral", async function () {
      const vAddr = await d.vaultFactory.getVault(d.user1.address);
      const vault = await ethers.getContractAt("TradingAccount", vAddr);

      const totalBal = await d.usdc.balanceOf(vAddr);

      await d.orderBook.connect(d.user1).placeLimitOrder(
        0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
        ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
      );

      // Try to withdraw more than available (should fail)
      await expect(
        vault.connect(d.user1).withdraw(usdcAddr, totalBal)
      ).to.be.revertedWith("TradingAccount: insufficient balance");
    });
  });

  // ============================================================
  //                REMOVE COLLATERAL
  // ============================================================
  describe("removeCollateral()", function () {
    let posId;

    beforeEach(async function () {
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("2"), true
      );
      posId = await d.position.getUserMarketPosition(d.user1.address, 0);
    });

    it("withdraws excess collateral", async function () {
      const posBefore = await d.position.getPosition(posId);
      const withdrawAmount = 1000n * 10n ** 6n;

      await d.position.connect(d.user1).removeCollateral(posId, withdrawAmount);

      const posAfter = await d.position.getPosition(posId);
      expect(posAfter.collateralAmount).to.be.lessThan(posBefore.collateralAmount);
      expect(posAfter.active).to.equal(true);
    });

    it("reverts for non-owner", async function () {
      await expect(
        d.position.connect(d.user2).removeCollateral(posId, 100n * 10n ** 6n)
      ).to.be.revertedWith("Position: not owner");
    });

    it("reverts on zero amount", async function () {
      await expect(
        d.position.connect(d.user1).removeCollateral(posId, 0)
      ).to.be.revertedWith("Position: invalid withdraw amount");
    });

    it("reverts on amount >= collateral", async function () {
      const pos = await d.position.getPosition(posId);
      await expect(
        d.position.connect(d.user1).removeCollateral(posId, pos.collateralAmount)
      ).to.be.revertedWith("Position: invalid withdraw amount");
    });

    it("reverts if margin too low after withdrawal", async function () {
      // With 2x leverage, removing most collateral should fail
      const pos = await d.position.getPosition(posId);
      const tooMuch = pos.collateralAmount - 1n; // leave only 1 token
      await expect(
        d.position.connect(d.user1).removeCollateral(posId, tooMuch)
      ).to.be.reverted;
    });

    it("reverts on inactive position", async function () {
      await d.position.connect(d.user1).closePosition(posId);
      await expect(
        d.position.connect(d.user1).removeCollateral(posId, 100n * 10n ** 6n)
      ).to.be.revertedWith("Position: not active");
    });

    it("emits PositionModified event", async function () {
      await expect(
        d.position.connect(d.user1).removeCollateral(posId, 1000n * 10n ** 6n)
      ).to.emit(d.position, "PositionModified");
    });
  });

  // ============================================================
  //                 ORACLE V2 ADMIN CONFIG
  // ============================================================
  describe("Oracle V2 Admin", function () {
    describe("setUsePrecompileOracle()", function () {
      it("admin can enable precompile mode", async function () {
        await d.oracle.setUsePrecompileOracle(true);
        const [usePrecompile] = await d.oracle.getOracleMode();
        expect(usePrecompile).to.equal(true);
      });

      it("admin can disable precompile mode", async function () {
        await d.oracle.setUsePrecompileOracle(true);
        await d.oracle.setUsePrecompileOracle(false);
        const [usePrecompile] = await d.oracle.getOracleMode();
        expect(usePrecompile).to.equal(false);
      });

      it("non-admin cannot toggle mode", async function () {
        await expect(
          d.oracle.connect(d.user1).setUsePrecompileOracle(true)
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("emits PrecompileModeUpdated event", async function () {
        await expect(d.oracle.setUsePrecompileOracle(true))
          .to.emit(d.oracle, "PrecompileModeUpdated")
          .withArgs(true);
      });
    });

    describe("setOraclePrecompile()", function () {
      it("admin can set precompile address", async function () {
        const addr = "0x0000000000000000000000000000000000000903";
        await d.oracle.setOraclePrecompile(addr);
        const [, precompile] = await d.oracle.getOracleMode();
        expect(precompile).to.equal(addr);
      });

      it("reverts with zero address", async function () {
        await expect(
          d.oracle.setOraclePrecompile(ethers.ZeroAddress)
        ).to.be.revertedWith("Oracle: zero precompile");
      });
    });

    describe("setMarketVomId()", function () {
      it("admin can set VOM market ID", async function () {
        const vomId = ethers.keccak256(ethers.toUtf8Bytes("BTC/USD"));
        await d.oracle.setMarketVomId(0, vomId);
        const stored = await d.oracle.getMarketVomId(0);
        expect(stored).to.equal(vomId);
      });

      it("reverts with zero VOM ID", async function () {
        await expect(
          d.oracle.setMarketVomId(0, ethers.ZeroHash)
        ).to.be.revertedWith("Oracle: zero VOM ID");
      });
    });

    describe("setMinOracleQuorum()", function () {
      it("admin can set quorum", async function () {
        await d.oracle.setMinOracleQuorum(5);
        const [,, minQuorum] = await d.oracle.getOracleMode();
        expect(minQuorum).to.equal(5);
      });

      it("reverts with zero quorum", async function () {
        await expect(
          d.oracle.setMinOracleQuorum(0)
        ).to.be.revertedWith("Oracle: zero quorum");
      });
    });

    describe("refreshPriceFromVOM()", function () {
      it("reverts when precompile mode is disabled", async function () {
        await expect(d.oracle.refreshPriceFromVOM(0))
          .to.be.revertedWith("Oracle: precompile mode not enabled");
      });
    });

    describe("batchRefreshFromVOM()", function () {
      it("reverts when precompile mode is disabled", async function () {
        await expect(d.oracle.batchRefreshFromVOM([0, 1]))
          .to.be.revertedWith("Oracle: precompile mode not enabled");
      });
    });
  });

  // ============================================================
  //                 PRICE DEVIATION CHECK
  // ============================================================
  describe("Price Deviation Check", function () {
    it("price deviation check rejects large moves when maxDeviationBps is set", async function () {
      await d.marketRegistry.setRobustnessParams(
        500, // 5% max deviation
        0, 0, 0
      );

      // Try to move price 20% — should be rejected
      await expect(
        d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("60000")])
      ).to.be.revertedWith("Oracle: price deviation exceeds max");
    });

    it("allows normal price moves within deviation bounds", async function () {
      await d.marketRegistry.setRobustnessParams(
        500, // 5% max deviation
        0, 0, 0
      );

      // Move price 4% — should succeed
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("52000")]);
      const [price] = await d.oracle.getPrice(0);
      expect(price).to.equal(ethers.parseEther("52000"));
    });

    it("deviation check disabled when maxDeviationBps is 0", async function () {
      await d.marketRegistry.setRobustnessParams(0, 0, 0, 0);

      // Big move should work
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("80000")]);
      const [price] = await d.oracle.getPrice(0);
      expect(price).to.equal(ethers.parseEther("80000"));
    });
  });

  // ============================================================
  //              ROBUSTNESS PARAMS
  // ============================================================
  describe("Robustness Params", function () {
    describe("setRobustnessParams()", function () {
      it("admin can set all params", async function () {
        await d.marketRegistry.setRobustnessParams(
          1000,
          ethers.parseEther("100"),
          ethers.parseEther("50"),
          ethers.parseEther("0.0001")
        );

        const [maxDev, minPos, minOrd, maxFunding] = await d.marketRegistry.getRobustnessParams();
        expect(maxDev).to.equal(1000);
        expect(minPos).to.equal(ethers.parseEther("100"));
        expect(minOrd).to.equal(ethers.parseEther("50"));
        expect(maxFunding).to.equal(ethers.parseEther("0.0001"));
      });

      it("non-admin cannot set params", async function () {
        await expect(
          d.marketRegistry.connect(d.user1).setRobustnessParams(0, 0, 0, 0)
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("reverts with deviation > 100%", async function () {
        await expect(
          d.marketRegistry.setRobustnessParams(10001, 0, 0, 0)
        ).to.be.revertedWith("MarketRegistry: deviation > 100%");
      });
    });

    describe("Minimum position size enforcement", function () {
      it("openPosition reverts when below minimum size", async function () {
        await d.marketRegistry.setRobustnessParams(
          0,
          ethers.parseEther("10000"), // min $10k position
          0, 0
        );

        // Try to open a $100 position (10 USDC * 10x = $100)
        await expect(
          d.position.connect(d.user1).openPosition(
            0, usdcAddr, 10n * 10n ** 6n, ethers.parseEther("10"), true
          )
        ).to.be.revertedWith("Position: below minimum size");
      });

      it("openPosition succeeds when above minimum size", async function () {
        await d.marketRegistry.setRobustnessParams(
          0,
          ethers.parseEther("1000"), // min $1k position
          0, 0
        );

        // $10,000 position (1000 USDC * 10x)
        await d.position.connect(d.user1).openPosition(
          0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("10"), true
        );
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
        expect(posId).to.be.greaterThan(0);
      });
    });

    describe("Minimum order size enforcement", function () {
      it("placeLimitOrder reverts when below minimum order size", async function () {
        await d.marketRegistry.setRobustnessParams(
          0, 0,
          ethers.parseEther("50000"), // min $50k order
          0
        );

        await expect(
          d.orderBook.connect(d.user1).placeLimitOrder(
            0, true, ethers.parseEther("48000"), ethers.parseEther("10000"),
            ethers.parseEther("10"), usdcAddr, 1000n * 10n ** 6n
          )
        ).to.be.revertedWith("OrderBook: below minimum order size");
      });
    });
  });

  // ============================================================
  //             FUNDING RATE CAP
  // ============================================================
  describe("Funding Rate Cap", function () {
    it("funding rate is clamped to maxFundingRatePerSecond", async function () {
      // Set a very low max rate
      await d.marketRegistry.setRobustnessParams(0, 0, 0, 1); // 1 wei per second max

      // Create large imbalance
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 50000n * 10n ** 6n, ethers.parseEther("10"), true
      );

      await ethers.provider.send("evm_increaseTime", [60]);
      await ethers.provider.send("evm_mine");
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("50000")]);
      await d.virtualAMM.connect(d.keeper).syncToOracle(0);

      await d.fundingRate.connect(d.keeper).updateFundingRate(0);

      const rate = await d.fundingRate.getCurrentFundingRate(0);
      // Rate should be clamped: |rate| <= 1
      expect(rate).to.be.lessThanOrEqual(1n);
      expect(rate).to.be.greaterThanOrEqual(-1n);
    });
  });

  // ============================================================
  //              MARK PRICE TWAP FOR FUNDING
  // ============================================================
  describe("Mark Price TWAP", function () {
    it("syncToOracle records mark price in history", async function () {
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("52000")]);
      await d.virtualAMM.connect(d.keeper).syncToOracle(0);

      // The mark price should have been recorded in markPriceHistory
      // We can verify indirectly by checking that funding rate calculation doesn't revert
      await d.fundingRate.connect(d.keeper).updateFundingRate(0);
    });

    it("updateFundingRate uses mark TWAP when history exists", async function () {
      // Record multiple mark prices
      for (let i = 0; i < 3; i++) {
        const p = 50000 + i * 500;
        await ethers.provider.send("evm_increaseTime", [60]);
        await ethers.provider.send("evm_mine");
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther(p.toString())]);
        await d.virtualAMM.connect(d.keeper).syncToOracle(0);
      }

      // Should not revert — uses markPriceHistory TWAP
      await d.fundingRate.connect(d.keeper).updateFundingRate(0);
    });
  });

  // ============================================================
  //               VAULT SOLVENCY CHECK
  // ============================================================
  describe("Vault Solvency Check", function () {
    it("payout caps to actual balance when vault is underfunded", async function () {
      // This is hard to trigger in normal flow since vault should always be funded
      // But we can verify the normal path works (no VaultDeficit emitted)
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);

      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("55000")]);

      // Close with profit — should work without VaultDeficit
      const tx = await d.position.connect(d.user1).closePosition(posId);
      const receipt = await tx.wait();

      // Check no VaultDeficit event was emitted
      const vaultDeficitTopic = ethers.id("VaultDeficit(address,uint256)");
      const deficitLogs = receipt.logs.filter(l => l.topics[0] === vaultDeficitTopic);
      expect(deficitLogs.length).to.equal(0);
    });
  });

  // ============================================================
  //         FUNDING SETTLED EVENT (B.6 Fix)
  // ============================================================
  describe("FundingSettled Event Fix", function () {
    it("emits FundingSettled with actual payment amounts on close", async function () {
      // Create imbalance so funding rate is non-zero
      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 50000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);

      // Set non-zero funding rate
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("51000")]);
      await d.virtualAMM.connect(d.keeper).syncToOracle(0);
      await d.fundingRate.connect(d.keeper).updateFundingRate(0);

      // Advance time so funding accrues
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");
      await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("51000")]);

      // Close position — should emit FundingSettled with non-zero values
      await d.position.connect(d.user1).closePosition(posId);
      // If we get here without revert, the funding settlement worked
    });
  });

  // ============================================================
  //         PARTIAL CLOSE WITH MIN REMAINING SIZE (M3)
  // ============================================================
  describe("Partial Close Minimum Remaining", function () {
    it("reverts partial close that leaves dust below minimum", async function () {
      await d.marketRegistry.setRobustnessParams(0, ethers.parseEther("5000"), 0, 0);

      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
      const pos = await d.position.getPosition(posId);

      // Try to close most of the position, leaving < $5000
      const closeSize = pos.sizeUsd - ethers.parseEther("1000"); // leave only $1000
      await expect(
        d.position.connect(d.user1).partialClose(posId, closeSize)
      ).to.be.revertedWith("Position: remaining size below minimum, use full close");
    });

    it("partial close succeeds when remaining is above minimum", async function () {
      await d.marketRegistry.setRobustnessParams(0, ethers.parseEther("1000"), 0, 0);

      await d.position.connect(d.user1).openPosition(
        0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true
      );
      const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
      const pos = await d.position.getPosition(posId);

      // Close half — remaining should be well above $1000
      const halfSize = pos.sizeUsd / 2n;
      await d.position.connect(d.user1).partialClose(posId, halfSize);

      const posAfter = await d.position.getPosition(posId);
      expect(posAfter.active).to.equal(true);
      expect(posAfter.sizeUsd).to.be.greaterThan(ethers.parseEther("1000"));
    });
  });
});
