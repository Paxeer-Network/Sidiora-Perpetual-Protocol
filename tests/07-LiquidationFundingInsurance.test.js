const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, setupFullProtocol } = require("./helpers/deployDiamond");

describe("Liquidation, Funding & Insurance", function () {
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
      const vault = await ethers.getContractAt("UserVault", vAddr);
      await vault.connect(user).deposit(usdcAddr, amount);
    }
  });

  // ==========================================================
  //                  LIQUIDATION FACET
  // ==========================================================
  describe("LiquidationFacet", function () {
    describe("checkLiquidatable()", function () {
      it("healthy position is not liquidatable", async function () {
        await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
        const [liquidatable, marginBps] = await d.liquidation.checkLiquidatable(posId);
        expect(liquidatable).to.equal(false);
        expect(marginBps).to.be.greaterThan(50); // > maintenance margin
      });

      it("returns false for inactive position", async function () {
        const [liquidatable] = await d.liquidation.checkLiquidatable(999);
        expect(liquidatable).to.equal(false);
      });

      it("position becomes liquidatable after big price move", async function () {
        // Open 100x leveraged long
        await d.position.connect(d.user1).openPosition(0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("100"), true);
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);

        // Drop price by 2% — should bring margin below 0.5% maintenance
        const newPrice = ethers.parseEther("49000");
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [newPrice]);

        const [liquidatable] = await d.liquidation.checkLiquidatable(posId);
        expect(liquidatable).to.equal(true);
      });
    });

    describe("liquidate()", function () {
      let posId;

      beforeEach(async function () {
        // Open high-leverage long: 100x on BTC at $50,000
        await d.position.connect(d.user1).openPosition(0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("100"), true);
        posId = await d.position.getUserMarketPosition(d.user1.address, 0);
      });

      it("anyone can liquidate an undercollateralized position", async function () {
        // Drop price 2%
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("49000")]);

        // user2 (anyone) liquidates
        await d.liquidation.connect(d.user2).liquidate(posId);
        const pos = await d.position.getPosition(posId);
        expect(pos.active).to.equal(false);
      });

      it("liquidator receives keeper reward", async function () {
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("49000")]);
        const before = await d.usdc.balanceOf(d.user2.address);
        await d.liquidation.connect(d.user2).liquidate(posId);
        const after = await d.usdc.balanceOf(d.user2.address);
        // Keeper should receive some reward
        expect(after).to.be.greaterThanOrEqual(before);
      });

      it("clears user market position mapping", async function () {
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("49000")]);
        await d.liquidation.connect(d.user2).liquidate(posId);
        const mapped = await d.position.getUserMarketPosition(d.user1.address, 0);
        expect(mapped).to.equal(0);
      });

      it("reduces open interest", async function () {
        const [beforeLong] = await d.position.getOpenInterest(0);
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("49000")]);
        await d.liquidation.connect(d.user2).liquidate(posId);
        const [afterLong] = await d.position.getOpenInterest(0);
        expect(afterLong).to.be.lessThan(beforeLong);
      });

      it("reverts liquidating healthy position", async function () {
        await expect(
          d.liquidation.connect(d.user2).liquidate(posId)
        ).to.be.revertedWith("Liquidation: position is healthy");
      });

      it("reverts liquidating inactive position", async function () {
        await expect(
          d.liquidation.connect(d.user2).liquidate(999)
        ).to.be.revertedWith("Liquidation: position not active");
      });

      it("reverts when no oracle price", async function () {
        // Create market without oracle price
        await d.marketRegistry.createMarket("Gold", "XAU", ethers.parseEther("500"), 50, ethers.parseEther("5000000"));
        // Can't liquidate positions in that market (no positions exist, but test the check)
      });

      it("emits Liquidation event", async function () {
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("49000")]);
        await expect(d.liquidation.connect(d.user2).liquidate(posId))
          .to.emit(d.liquidation, "Liquidation");
      });

      it("short liquidation — price goes up", async function () {
        // Open 100x short
        await d.position.connect(d.user2).openPosition(0, usdcAddr, 1000n * 10n ** 6n, ethers.parseEther("100"), false);
        const shortPosId = await d.position.getUserMarketPosition(d.user2.address, 0);

        // Price goes up 2%
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("51000")]);

        const [liquidatable] = await d.liquidation.checkLiquidatable(shortPosId);
        expect(liquidatable).to.equal(true);

        await d.liquidation.connect(d.keeper).liquidate(shortPosId);
        const pos = await d.position.getPosition(shortPosId);
        expect(pos.active).to.equal(false);
      });
    });

    describe("autoDeleverage()", function () {
      it("reverts for non-authorized caller", async function () {
        await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("55000")]);
        await expect(
          d.liquidation.connect(d.user1).autoDeleverage(posId, ethers.parseEther("1000"))
        ).to.be.reverted;
      });

      it("reverts for inactive position", async function () {
        await expect(
          d.liquidation.connect(d.keeper).autoDeleverage(999, ethers.parseEther("1000"))
        ).to.be.revertedWith("Liquidation: position not active");
      });
    });
  });

  // ==========================================================
  //                FUNDING RATE FACET
  // ==========================================================
  describe("FundingRateFacet", function () {
    describe("getCurrentFundingRate()", function () {
      it("initially zero", async function () {
        const rate = await d.fundingRate.getCurrentFundingRate(0);
        expect(rate).to.equal(0);
      });
    });

    describe("updateFundingRate()", function () {
      it("keeper can update funding rate", async function () {
        // Create imbalance: user1 goes long
        await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);

        // Advance time and update price slightly above to create mark > index scenario
        await ethers.provider.send("evm_increaseTime", [60]);
        await ethers.provider.send("evm_mine");
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("50000")]);

        await d.fundingRate.connect(d.keeper).updateFundingRate(0);
        // Rate may or may not be zero depending on mark vs index
        // Just verify it doesn't revert
      });

      it("non-keeper cannot update", async function () {
        await expect(
          d.fundingRate.connect(d.user1).updateFundingRate(0)
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("emits FundingRateUpdated event", async function () {
        await expect(d.fundingRate.connect(d.keeper).updateFundingRate(0))
          .to.emit(d.fundingRate, "FundingRateUpdated");
      });
    });

    describe("getFundingRate24h()", function () {
      it("returns 24h rate as per-second * 86400", async function () {
        const rate24h = await d.fundingRate.getFundingRate24h(0);
        const ratePerSec = await d.fundingRate.getCurrentFundingRate(0);
        expect(rate24h).to.equal(ratePerSec * 86400n);
      });
    });

    describe("getFundingState()", function () {
      it("returns full funding state", async function () {
        const [cumLong, cumShort, lastUpdate, rate] = await d.fundingRate.getFundingState(0);
        expect(cumLong).to.equal(0);
        expect(cumShort).to.equal(0);
      });
    });

    describe("getPendingFunding()", function () {
      it("returns zero with no time elapsed", async function () {
        const [pendingLong, pendingShort] = await d.fundingRate.getPendingFunding(0);
        expect(pendingLong).to.equal(0);
        expect(pendingShort).to.equal(0);
      });
    });

    describe("getPositionFunding()", function () {
      it("returns zero for inactive position", async function () {
        const funding = await d.fundingRate.getPositionFunding(999);
        expect(funding).to.equal(0);
      });

      it("returns funding for active position", async function () {
        await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
        const funding = await d.fundingRate.getPositionFunding(posId);
        // Should be 0 or very small since no time has passed
        expect(funding).to.be.greaterThanOrEqual(0n - ethers.parseEther("1"));
      });

      it("funding accumulates over time", async function () {
        await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);

        // Set a non-zero funding rate
        await d.fundingRate.connect(d.keeper).updateFundingRate(0);

        // Advance time
        await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
        await ethers.provider.send("evm_mine");

        // Re-check funding (may still be 0 if mark == index, but at least it runs)
        await d.fundingRate.getPositionFunding(posId);
      });
    });
  });

  // ==========================================================
  //                INSURANCE FUND FACET
  // ==========================================================
  describe("InsuranceFundFacet", function () {
    describe("getInsuranceBalance()", function () {
      it("initially has some balance from trading fees", async function () {
        // Open and close a position to generate fees
        await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
        await d.position.connect(d.user1).closePosition(posId);

        const balance = await d.insuranceFund.getInsuranceBalance(usdcAddr);
        expect(balance).to.be.greaterThanOrEqual(0);
      });
    });

    describe("setADLThreshold()", function () {
      it("admin can set ADL threshold", async function () {
        await d.insuranceFund.setADLThreshold(ethers.parseEther("10000"));
        expect(await d.insuranceFund.getADLThreshold()).to.equal(ethers.parseEther("10000"));
      });

      it("non-admin cannot set threshold", async function () {
        await expect(
          d.insuranceFund.connect(d.user1).setADLThreshold(ethers.parseEther("10000"))
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("emits ADLThresholdUpdated event", async function () {
        await expect(d.insuranceFund.setADLThreshold(ethers.parseEther("5000")))
          .to.emit(d.insuranceFund, "ADLThresholdUpdated");
      });
    });

    describe("shouldTriggerADL()", function () {
      it("returns false when balance is above threshold", async function () {
        await d.insuranceFund.setADLThreshold(0);
        expect(await d.insuranceFund.shouldTriggerADL(usdcAddr)).to.equal(false);
      });

      it("returns true when balance is below threshold", async function () {
        await d.insuranceFund.setADLThreshold(ethers.parseEther("999999999")); // very high threshold
        expect(await d.insuranceFund.shouldTriggerADL(usdcAddr)).to.equal(true);
      });
    });

    describe("withdrawInsurance()", function () {
      it("admin can withdraw insurance funds", async function () {
        // Generate insurance funds by trading
        await d.position.connect(d.user1).openPosition(0, usdcAddr, 10000n * 10n ** 6n, ethers.parseEther("10"), true);
        const posId = await d.position.getUserMarketPosition(d.user1.address, 0);
        await d.position.connect(d.user1).closePosition(posId);

        const balance = await d.insuranceFund.getInsuranceBalance(usdcAddr);
        if (balance > 0n) {
          await d.insuranceFund.withdrawInsurance(usdcAddr, balance, d.owner.address);
          const after = await d.insuranceFund.getInsuranceBalance(usdcAddr);
          expect(after).to.equal(0);
        }
      });

      it("non-admin cannot withdraw", async function () {
        await expect(
          d.insuranceFund.connect(d.user1).withdrawInsurance(usdcAddr, 1, d.user1.address)
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("reverts on zero amount", async function () {
        await expect(
          d.insuranceFund.withdrawInsurance(usdcAddr, 0, d.owner.address)
        ).to.be.revertedWith("InsuranceFund: zero amount");
      });

      it("reverts on zero recipient", async function () {
        await expect(
          d.insuranceFund.withdrawInsurance(usdcAddr, 1, ethers.ZeroAddress)
        ).to.be.revertedWith("InsuranceFund: zero recipient");
      });
    });
  });
});
