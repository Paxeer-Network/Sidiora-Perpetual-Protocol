const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LibOROB", function () {
  let harness;
  const PRECISION = ethers.parseEther("1"); // 1e18

  beforeEach(async function () {
    const Harness = await ethers.getContractFactory("SpotLibHarness");
    harness = await Harness.deploy();
    await harness.waitForDeployment();
  });

  // ============================================================
  //                    resolveOffset
  // ============================================================
  describe("resolveOffset", function () {
    it("zero offset returns oracle price", async function () {
      const oracle = ethers.parseEther("67000"); // $67,000
      const result = await harness.resolveOffset(oracle, 0);
      expect(result).to.equal(oracle);
    });

    it("positive offset (+100 bps = +1%)", async function () {
      const oracle = ethers.parseEther("67000");
      const result = await harness.resolveOffset(oracle, 100);
      // 67000 * 10100 / 10000 = 67670
      expect(result).to.equal(ethers.parseEther("67670"));
    });

    it("negative offset (-100 bps = -1%)", async function () {
      const oracle = ethers.parseEther("67000");
      const result = await harness.resolveOffset(oracle, -100);
      // 67000 * 9900 / 10000 = 66330
      expect(result).to.equal(ethers.parseEther("66330"));
    });

    it("max positive offset (+10000 bps = +100%)", async function () {
      const oracle = ethers.parseEther("1000");
      const result = await harness.resolveOffset(oracle, 10000);
      // 1000 * 20000 / 10000 = 2000
      expect(result).to.equal(ethers.parseEther("2000"));
    });

    it("max negative offset (-9999 bps) still positive", async function () {
      const oracle = ethers.parseEther("10000");
      const result = await harness.resolveOffset(oracle, -9999);
      // 10000 * 1 / 10000 = 1
      expect(result).to.equal(ethers.parseEther("1"));
    });

    it("reverts on -10000 bps (would resolve to 0)", async function () {
      const oracle = ethers.parseEther("10000");
      await expect(
        harness.resolveOffset(oracle, -10000)
      ).to.be.revertedWith("LibOROB: resolved price must be positive");
    });

    it("reverts on zero oracle price", async function () {
      await expect(
        harness.resolveOffset(0, 100)
      ).to.be.revertedWith("LibOROB: oracle price must be positive");
    });

    it("reverts on negative oracle price", async function () {
      await expect(
        harness.resolveOffset(-1, 100)
      ).to.be.revertedWith("LibOROB: oracle price must be positive");
    });

    it("small oracle price with small offset", async function () {
      const oracle = ethers.parseEther("0.001"); // $0.001
      const result = await harness.resolveOffset(oracle, 50);
      // 0.001 * 10050 / 10000 = 0.001005
      expect(result).to.equal(ethers.parseEther("0.001005"));
    });
  });

  // ============================================================
  //                  resolveOffsetBatch
  // ============================================================
  describe("resolveOffsetBatch", function () {
    it("resolves multiple offsets correctly", async function () {
      const oracle = ethers.parseEther("10000");
      const offsets = [-50, 0, 50, 100];
      const results = await harness.resolveOffsetBatch(oracle, offsets);

      expect(results[0]).to.equal(ethers.parseEther("9950"));
      expect(results[1]).to.equal(ethers.parseEther("10000"));
      expect(results[2]).to.equal(ethers.parseEther("10050"));
      expect(results[3]).to.equal(ethers.parseEther("10100"));
    });

    it("empty array returns empty", async function () {
      const oracle = ethers.parseEther("10000");
      const results = await harness.resolveOffsetBatch(oracle, []);
      expect(results.length).to.equal(0);
    });

    it("reverts if any offset resolves to non-positive", async function () {
      const oracle = ethers.parseEther("10000");
      await expect(
        harness.resolveOffsetBatch(oracle, [0, -10000])
      ).to.be.revertedWith("LibOROB: resolved price must be positive");
    });
  });

  // ============================================================
  //                      toOffset
  // ============================================================
  describe("toOffset", function () {
    it("same price yields 0 offset", async function () {
      const oracle = ethers.parseEther("67000");
      const result = await harness.toOffset(oracle, oracle);
      expect(result).to.equal(0);
    });

    it("price 1% above → +100 bps", async function () {
      const oracle = ethers.parseEther("10000");
      const absolute = ethers.parseEther("10100");
      const result = await harness.toOffset(oracle, absolute);
      expect(result).to.equal(100);
    });

    it("price 1% below → -100 bps", async function () {
      const oracle = ethers.parseEther("10000");
      const absolute = ethers.parseEther("9900");
      const result = await harness.toOffset(oracle, absolute);
      expect(result).to.equal(-100);
    });

    it("reverts on offset > 10000 bps", async function () {
      const oracle = ethers.parseEther("1000");
      const absolute = ethers.parseEther("3000"); // +200% → 20000 bps
      await expect(
        harness.toOffset(oracle, absolute)
      ).to.be.revertedWith("LibOROB: offset overflow");
    });

    it("reverts on offset < -10000 bps", async function () {
      const oracle = ethers.parseEther("1000");
      const absolute = ethers.parseEther("1"); // nearly -100%
      // (1 - 1000) * 10000 / 1000 = -9990 → within range actually
      // Let's try -10001 equivalent
      await expect(
        harness.toOffset(ethers.parseEther("10000"), 0)
      ).to.be.revertedWith("LibOROB: offset overflow");
    });

    it("roundtrip: resolveOffset(toOffset(x)) ≈ x", async function () {
      const oracle = ethers.parseEther("50000");
      const absolute = ethers.parseEther("50250"); // +50 bps
      const offset = await harness.toOffset(oracle, absolute);
      expect(offset).to.equal(50);
      const resolved = await harness.resolveOffset(oracle, offset);
      expect(resolved).to.equal(absolute);
    });
  });
});
