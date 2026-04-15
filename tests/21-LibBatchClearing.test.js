const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LibBatchClearing", function () {
  let harness;

  beforeEach(async function () {
    const Harness = await ethers.getContractFactory("SpotLibHarness");
    harness = await Harness.deploy();
    await harness.waitForDeployment();
  });

  // ============================================================
  //                  computeClearing
  // ============================================================
  describe("computeClearing", function () {
    it("single buy and single sell crossing → full match", async function () {
      const oracle = ethers.parseEther("10000");
      // Buy at +10 bps (willing to pay above oracle)
      // Sell at +5 bps (willing to sell slightly above oracle)
      // Buy offset >= Sell offset → they cross
      const [clearingOffset, clearingPrice, matchedVolume] =
        await harness.computeClearing(
          oracle,
          [10],   // buyOffsets (descending — most aggressive first)
          [100],  // buySizes
          [5],    // sellOffsets (ascending — cheapest first)
          [100]   // sellSizes
        );

      expect(matchedVolume).to.equal(100);
      expect(clearingOffset).to.equal(5); // clears at the sell offset
      // clearingPrice = 10000 * (10000 + 5) / 10000 = 10005
      expect(clearingPrice).to.equal(ethers.parseEther("10005"));
    });

    it("no crossing → zero matched volume", async function () {
      const oracle = ethers.parseEther("10000");
      // Buy at -10 bps, Sell at +10 bps → no cross
      const [, , matchedVolume] = await harness.computeClearing(
        oracle,
        [-10],  // buyOffsets
        [100],
        [10],   // sellOffsets
        [100]
      );
      expect(matchedVolume).to.equal(0);
    });

    it("empty buy side → zero matched volume", async function () {
      const oracle = ethers.parseEther("10000");
      const [, , matchedVolume] = await harness.computeClearing(
        oracle, [], [], [5], [100]
      );
      expect(matchedVolume).to.equal(0);
    });

    it("empty sell side → zero matched volume", async function () {
      const oracle = ethers.parseEther("10000");
      const [, , matchedVolume] = await harness.computeClearing(
        oracle, [10], [100], [], []
      );
      expect(matchedVolume).to.equal(0);
    });

    it("partial fill: buy size < sell size", async function () {
      const oracle = ethers.parseEther("10000");
      const [clearingOffset, , matchedVolume] = await harness.computeClearing(
        oracle,
        [10],   // buy 50 at +10 bps
        [50],
        [5],    // sell 100 at +5 bps
        [100]
      );
      expect(matchedVolume).to.equal(50);
      expect(clearingOffset).to.equal(5);
    });

    it("partial fill: sell size < buy size", async function () {
      const oracle = ethers.parseEther("10000");
      const [clearingOffset, , matchedVolume] = await harness.computeClearing(
        oracle,
        [10],
        [200],
        [5],
        [80]
      );
      expect(matchedVolume).to.equal(80);
      expect(clearingOffset).to.equal(5);
    });

    it("multiple buys and sells with partial matching", async function () {
      const oracle = ethers.parseEther("10000");
      // Buys descending: +20 bps (50 units), +10 bps (100 units)
      // Sells ascending: +5 bps (60 units), +15 bps (80 units)
      const [, , matchedVolume] = await harness.computeClearing(
        oracle,
        [20, 10],       // buyOffsets (descending)
        [50, 100],      // buySizes
        [5, 15],        // sellOffsets (ascending)
        [60, 80]        // sellSizes
      );
      // Buy 50 at +20 crosses sell 60 at +5 → fills min(50,60) = 50 (sell has 10 remaining)
      // Buy 100 at +10 crosses sell 10 at +5 → fills 10, then sell at +15: +10 < +15 → no cross
      // Total matched = 50 + 10 = 60
      expect(matchedVolume).to.equal(60);
    });

    it("exact equal sizes clear completely", async function () {
      const oracle = ethers.parseEther("5000");
      const [clearingOffset, clearingPrice, matchedVolume] =
        await harness.computeClearing(
          oracle,
          [0],
          [1000],
          [-5],
          [1000]
        );
      // Buy at 0 bps >= Sell at -5 bps → cross
      expect(matchedVolume).to.equal(1000);
      expect(clearingOffset).to.equal(-5);
      // 5000 * (10000 - 5) / 10000 = 4997.5 → 4997500000000000000000 (truncated)
      expect(clearingPrice).to.equal(ethers.parseEther("4997.5"));
    });

    it("reverts on array length mismatch", async function () {
      const oracle = ethers.parseEther("10000");
      await expect(
        harness.computeClearing(oracle, [10, 5], [100], [5], [100])
      ).to.be.revertedWith("LibBatchClearing: buy array mismatch");
    });

    it("reverts on zero oracle price", async function () {
      await expect(
        harness.computeClearing(0, [10], [100], [5], [100])
      ).to.be.revertedWith("LibBatchClearing: oracle price must be positive");
    });
  });
});
