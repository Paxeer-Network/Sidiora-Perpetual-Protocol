const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LibPoFQ", function () {
  let harness;
  const PRECISION = ethers.parseEther("1"); // 1e18

  beforeEach(async function () {
    const Harness = await ethers.getContractFactory("SpotLibHarness");
    harness = await Harness.deploy();
    await harness.waitForDeployment();
  });

  // ============================================================
  //                      scoreFill
  // ============================================================
  describe("scoreFill", function () {
    it("perfect match (fill == oracle) → score = 1e18", async function () {
      const price = ethers.parseEther("67000");
      const score = await harness.scoreFill(price, price);
      expect(score).to.equal(PRECISION);
    });

    it("1% deviation → score = 0.99e18", async function () {
      const oracle = ethers.parseEther("10000");
      const fill = ethers.parseEther("10100"); // +1% = 100 bps
      const score = await harness.scoreFill(fill, oracle);
      // deviationBps = 100, score = 1e18 - 1e18 * 100 / 10000 = 0.99e18
      expect(score).to.equal(ethers.parseEther("0.99"));
    });

    it("50% deviation → score = 0.5e18", async function () {
      const oracle = ethers.parseEther("10000");
      const fill = ethers.parseEther("15000"); // +50% = 5000 bps
      const score = await harness.scoreFill(fill, oracle);
      expect(score).to.equal(ethers.parseEther("0.5"));
    });

    it("100% deviation → score = 0", async function () {
      const oracle = ethers.parseEther("10000");
      const fill = ethers.parseEther("20000"); // +100% = 10000 bps
      const score = await harness.scoreFill(fill, oracle);
      expect(score).to.equal(0);
    });

    it("deviation > 100% → score = 0", async function () {
      const oracle = ethers.parseEther("10000");
      const fill = ethers.parseEther("30000"); // +200%
      const score = await harness.scoreFill(fill, oracle);
      expect(score).to.equal(0);
    });

    it("negative deviation (fill below oracle) same score", async function () {
      const oracle = ethers.parseEther("10000");
      const fill = ethers.parseEther("9900"); // -1%
      const score = await harness.scoreFill(fill, oracle);
      expect(score).to.equal(ethers.parseEther("0.99"));
    });

    it("oracle price zero → score = 0", async function () {
      const score = await harness.scoreFill(ethers.parseEther("100"), 0);
      expect(score).to.equal(0);
    });

    it("oracle price negative → score = 0", async function () {
      const score = await harness.scoreFill(ethers.parseEther("100"), -1);
      expect(score).to.equal(0);
    });

    it("tiny deviation → high score", async function () {
      const oracle = ethers.parseEther("10000");
      const fill = ethers.parseEther("10001"); // 0.01% = 1 bps
      const score = await harness.scoreFill(fill, oracle);
      // deviationBps = 1, score = 1e18 - 1e18 * 1 / 10000 = 0.9999e18
      expect(score).to.equal(ethers.parseEther("0.9999"));
    });
  });

  // ============================================================
  //                     scoreBatch
  // ============================================================
  describe("scoreBatch", function () {
    it("single fill → same as scoreFill", async function () {
      const oracle = ethers.parseEther("10000");
      const fill = ethers.parseEther("10050"); // +0.5%
      const [avgScore, totalVol] = await harness.scoreBatch(
        [fill], [oracle], [1000]
      );
      const singleScore = await harness.scoreFill(fill, oracle);
      expect(avgScore).to.equal(singleScore);
      expect(totalVol).to.equal(1000);
    });

    it("volume-weighted average of mixed fills", async function () {
      const oracle = ethers.parseEther("10000");
      // Fill 1: +1% deviation, 100 units → score 0.99e18
      // Fill 2: perfect match, 900 units → score 1.0e18
      // Weighted avg = (0.99 * 100 + 1.0 * 900) / 1000 = 0.999
      const [avgScore, totalVol] = await harness.scoreBatch(
        [ethers.parseEther("10100"), oracle],
        [oracle, oracle],
        [100, 900]
      );
      expect(totalVol).to.equal(1000);
      expect(avgScore).to.equal(ethers.parseEther("0.999"));
    });

    it("empty batch → 0 score, 0 volume", async function () {
      const [avgScore, totalVol] = await harness.scoreBatch([], [], []);
      expect(avgScore).to.equal(0);
      expect(totalVol).to.equal(0);
    });

    it("reverts on array length mismatch", async function () {
      await expect(
        harness.scoreBatch(
          [ethers.parseEther("10000")],
          [ethers.parseEther("10000"), ethers.parseEther("10000")],
          [100]
        )
      ).to.be.revertedWith("LibPoFQ: array mismatch");
    });
  });

  // ============================================================
  //                  updateRollingScore
  // ============================================================
  describe("updateRollingScore", function () {
    it("first update (no existing score) → new score directly", async function () {
      const newScore = ethers.parseEther("0.95");
      const [updated, weight] = await harness.updateRollingScore(
        0, 0, newScore, 1000, 100 // 1% decay (irrelevant on zero)
      );
      expect(updated).to.equal(newScore);
      expect(weight).to.equal(1000);
    });

    it("decay reduces existing score", async function () {
      const current = ethers.parseEther("1"); // perfect score
      const [updated, weight] = await harness.updateRollingScore(
        current, 1000,
        ethers.parseEther("1"), 0, // no new data
        100 // 1% decay
      );
      // Decayed score = 1e18 * 9900/10000 = 0.99e18
      // Decayed weight = 1000 * 9900/10000 = 990
      // No new data: updated = decayed * decayedWeight / decayedWeight = 0.99e18
      expect(updated).to.equal(ethers.parseEther("0.99"));
      expect(weight).to.equal(990);
    });

    it("new data blends with decayed existing", async function () {
      const current = ethers.parseEther("0.8");
      const [updated, weight] = await harness.updateRollingScore(
        current, 1000,
        ethers.parseEther("1"), 1000, // new perfect score, same volume
        100 // 1% decay
      );
      // Decayed: 0.8e18 * 9900/10000 = 0.792e18, weight = 990
      // Blended: (0.792e18 * 990 + 1.0e18 * 1000) / (990 + 1000)
      // = (784080...e15 + 1000000...e15) / 1990
      expect(weight).to.equal(1990);
      // Score should be between 0.792 and 1.0
      expect(updated).to.be.gt(ethers.parseEther("0.79"));
      expect(updated).to.be.lt(ethers.parseEther("1.0"));
    });

    it("zero decay: pure average", async function () {
      const [updated, weight] = await harness.updateRollingScore(
        ethers.parseEther("0.5"), 500,
        ethers.parseEther("1.0"), 500,
        0 // no decay
      );
      expect(weight).to.equal(1000);
      expect(updated).to.equal(ethers.parseEther("0.75"));
    });

    it("both zero weights → zero", async function () {
      const [updated, weight] = await harness.updateRollingScore(
        0, 0, 0, 0, 100
      );
      expect(updated).to.equal(0);
      expect(weight).to.equal(0);
    });
  });
});
