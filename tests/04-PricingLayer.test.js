const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, setupFullProtocol } = require("./helpers/deployDiamond");

describe("Pricing Layer", function () {
  let d, roles;

  beforeEach(async function () {
    d = await deployFullDiamond();
    roles = await setupFullProtocol(d);
  });

  // ==========================================================
  //                 MARKET REGISTRY FACET
  // ==========================================================
  describe("MarketRegistryFacet", function () {
    describe("createMarket()", function () {
      it("creates BTC and ETH markets during setup", async function () {
        const btc = await d.marketRegistry.getMarket(0);
        expect(btc.name).to.equal("Bitcoin");
        expect(btc.symbol).to.equal("BTC");
        expect(btc.enabled).to.equal(true);

        const eth = await d.marketRegistry.getMarket(1);
        expect(eth.name).to.equal("Ethereum");
        expect(eth.symbol).to.equal("ETH");
      });

      it("totalMarkets returns correct count", async function () {
        expect(await d.marketRegistry.totalMarkets()).to.equal(2);
      });

      it("getActiveMarketIds returns all IDs", async function () {
        const ids = await d.marketRegistry.getActiveMarketIds();
        expect(ids.length).to.equal(2);
        expect(ids[0]).to.equal(0);
        expect(ids[1]).to.equal(1);
      });

      it("isMarketActive returns true for active market", async function () {
        expect(await d.marketRegistry.isMarketActive(0)).to.equal(true);
      });

      it("isMarketActive returns false for non-existent market", async function () {
        expect(await d.marketRegistry.isMarketActive(99)).to.equal(false);
      });

      it("reverts with empty name", async function () {
        await expect(
          d.marketRegistry.createMarket("", "XYZ", ethers.parseEther("100"), 50, ethers.parseEther("1000000"))
        ).to.be.revertedWith("MarketRegistry: empty name");
      });

      it("reverts with empty symbol", async function () {
        await expect(
          d.marketRegistry.createMarket("Test", "", ethers.parseEther("100"), 50, ethers.parseEther("1000000"))
        ).to.be.revertedWith("MarketRegistry: empty symbol");
      });

      it("reverts with zero leverage", async function () {
        await expect(
          d.marketRegistry.createMarket("Test", "TST", 0, 50, ethers.parseEther("1000000"))
        ).to.be.revertedWith("MarketRegistry: invalid leverage");
      });

      it("reverts with leverage > 1000x", async function () {
        await expect(
          d.marketRegistry.createMarket("Test", "TST", ethers.parseEther("1001"), 50, ethers.parseEther("1000000"))
        ).to.be.revertedWith("MarketRegistry: invalid leverage");
      });

      it("reverts with zero maintenance margin", async function () {
        await expect(
          d.marketRegistry.createMarket("Test", "TST", ethers.parseEther("100"), 0, ethers.parseEther("1000000"))
        ).to.be.revertedWith("MarketRegistry: invalid margin");
      });

      it("reverts with zero max OI", async function () {
        await expect(
          d.marketRegistry.createMarket("Test", "TST", ethers.parseEther("100"), 50, 0)
        ).to.be.revertedWith("MarketRegistry: zero max OI");
      });

      it("non-admin cannot create market", async function () {
        await expect(
          d.marketRegistry.connect(d.user1).createMarket("Test", "TST", ethers.parseEther("100"), 50, ethers.parseEther("1000000"))
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("emits MarketCreated event", async function () {
        await expect(
          d.marketRegistry.createMarket("Gold", "XAU", ethers.parseEther("500"), 100, ethers.parseEther("5000000"))
        ).to.emit(d.marketRegistry, "MarketCreated");
      });
    });

    describe("updateMarket()", function () {
      it("admin can update market params", async function () {
        await d.marketRegistry.updateMarket(0, ethers.parseEther("500"), 100, ethers.parseEther("5000000"));
        const m = await d.marketRegistry.getMarket(0);
        expect(m.maxLeverage).to.equal(ethers.parseEther("500"));
        expect(m.maintenanceMarginBps).to.equal(100);
      });

      it("reverts for non-existent market", async function () {
        await expect(
          d.marketRegistry.updateMarket(99, ethers.parseEther("500"), 100, ethers.parseEther("5000000"))
        ).to.be.revertedWith("MarketRegistry: market does not exist");
      });

      it("non-admin cannot update", async function () {
        await expect(
          d.marketRegistry.connect(d.user1).updateMarket(0, ethers.parseEther("500"), 100, ethers.parseEther("5000000"))
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });
    });

    describe("enableMarket() / disableMarket()", function () {
      it("admin can disable market", async function () {
        await d.marketRegistry.disableMarket(0);
        expect(await d.marketRegistry.isMarketActive(0)).to.equal(false);
      });

      it("admin can re-enable market", async function () {
        await d.marketRegistry.disableMarket(0);
        await d.marketRegistry.enableMarket(0);
        expect(await d.marketRegistry.isMarketActive(0)).to.equal(true);
      });

      it("reverts disabling already disabled", async function () {
        await d.marketRegistry.disableMarket(0);
        await expect(d.marketRegistry.disableMarket(0))
          .to.be.revertedWith("MarketRegistry: already disabled");
      });

      it("reverts enabling already enabled", async function () {
        await expect(d.marketRegistry.enableMarket(0))
          .to.be.revertedWith("MarketRegistry: already enabled");
      });
    });
  });

  // ==========================================================
  //                    ORACLE FACET
  // ==========================================================
  describe("OracleFacet", function () {
    describe("batchUpdatePrices()", function () {
      it("prices are set correctly after setup", async function () {
        const [price, ts] = await d.oracle.getPrice(0);
        expect(price).to.equal(roles.btcPrice);
        expect(ts).to.be.greaterThan(0);
      });

      it("ETH price set correctly", async function () {
        const [price] = await d.oracle.getPrice(1);
        expect(price).to.equal(roles.ethPrice);
      });

      it("non-poster cannot update prices", async function () {
        await expect(
          d.oracle.connect(d.user1).batchUpdatePrices([0], [ethers.parseEther("60000")])
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("reverts on length mismatch", async function () {
        await expect(
          d.oracle.connect(d.oraclePoster).batchUpdatePrices([0, 1], [ethers.parseEther("60000")])
        ).to.be.revertedWith("Oracle: length mismatch");
      });

      it("reverts on empty arrays", async function () {
        await expect(
          d.oracle.connect(d.oraclePoster).batchUpdatePrices([], [])
        ).to.be.revertedWith("Oracle: empty arrays");
      });

      it("reverts on zero price", async function () {
        await expect(
          d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [0])
        ).to.be.revertedWith("Oracle: zero price");
      });

      it("reverts on non-existent market", async function () {
        await expect(
          d.oracle.connect(d.oraclePoster).batchUpdatePrices([99], [ethers.parseEther("100")])
        ).to.be.revertedWith("Oracle: market does not exist");
      });

      it("emits PricesUpdated event", async function () {
        await expect(
          d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("55000")])
        ).to.emit(d.oracle, "PricesUpdated");
      });

      it("price history length increases", async function () {
        const before = await d.oracle.getPriceHistoryLength(0);
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("55000")]);
        const after = await d.oracle.getPriceHistoryLength(0);
        expect(after).to.equal(before + 1n);
      });

      it("getPricePoint returns correct data", async function () {
        const [price, ts] = await d.oracle.getPricePoint(0, 0);
        expect(price).to.equal(roles.btcPrice);
        expect(ts).to.be.greaterThan(0);
      });

      it("getPricePoint reverts on out of bounds", async function () {
        await expect(d.oracle.getPricePoint(0, 999))
          .to.be.revertedWith("Oracle: index out of bounds");
      });
    });

    describe("isPriceStale()", function () {
      it("price is not stale immediately after posting", async function () {
        expect(await d.oracle.isPriceStale(0)).to.equal(false);
      });

      it("price becomes stale after max staleness", async function () {
        // Advance time by 121 seconds
        await ethers.provider.send("evm_increaseTime", [121]);
        await ethers.provider.send("evm_mine");
        expect(await d.oracle.isPriceStale(0)).to.equal(true);
      });
    });

    describe("addPricePoster() / removePricePoster()", function () {
      it("admin can add price poster", async function () {
        await d.oracle.addPricePoster(d.user1.address);
        expect(await d.oracle.isAuthorizedPoster(d.user1.address)).to.equal(true);
      });

      it("reverts adding zero address", async function () {
        await expect(d.oracle.addPricePoster(ethers.ZeroAddress))
          .to.be.revertedWith("Oracle: zero address");
      });

      it("reverts adding already authorized", async function () {
        await d.oracle.addPricePoster(d.user1.address);
        await expect(d.oracle.addPricePoster(d.user1.address))
          .to.be.revertedWith("Oracle: already authorized");
      });

      it("admin can remove price poster", async function () {
        await d.oracle.addPricePoster(d.user1.address);
        await d.oracle.removePricePoster(d.user1.address);
        expect(await d.oracle.isAuthorizedPoster(d.user1.address)).to.equal(false);
      });

      it("reverts removing non-authorized", async function () {
        await expect(d.oracle.removePricePoster(d.user1.address))
          .to.be.revertedWith("Oracle: not authorized");
      });
    });

    describe("setMaxPriceStaleness()", function () {
      it("updates staleness threshold", async function () {
        await d.oracle.setMaxPriceStaleness(300);
        expect(await d.oracle.getMaxPriceStaleness()).to.equal(300);
      });

      it("reverts if too low", async function () {
        await expect(d.oracle.setMaxPriceStaleness(30))
          .to.be.revertedWith("Oracle: staleness too low");
      });
    });
  });

  // ==========================================================
  //                  VIRTUAL AMM FACET
  // ==========================================================
  describe("VirtualAMMFacet", function () {
    describe("initializePool()", function () {
      it("BTC pool initialized correctly", async function () {
        const pool = await d.virtualAMM.getPool(0);
        expect(pool.baseReserve).to.be.greaterThan(0);
        expect(pool.quoteReserve).to.be.greaterThan(0);
        expect(pool.dampingFactor).to.equal(5000);
      });

      it("mark price matches oracle price after init", async function () {
        const markPrice = await d.virtualAMM.getMarkPrice(0);
        // Should be approximately $50,000
        const diff = markPrice > roles.btcPrice
          ? markPrice - roles.btcPrice
          : roles.btcPrice - markPrice;
        // Allow 0.1% tolerance for rounding
        expect(diff).to.be.lessThan(roles.btcPrice / 1000n);
      });

      it("reverts double initialization", async function () {
        await expect(
          d.virtualAMM.initializePool(0, ethers.parseEther("50000"), ethers.parseEther("1000000"), 5000)
        ).to.be.revertedWith("VirtualAMM: already initialized");
      });

      it("reverts with zero price", async function () {
        await d.marketRegistry.createMarket("Gold", "XAU", ethers.parseEther("500"), 100, ethers.parseEther("5000000"));
        await expect(
          d.virtualAMM.initializePool(2, 0, ethers.parseEther("1000000"), 5000)
        ).to.be.revertedWith("VirtualAMM: zero price");
      });

      it("reverts with zero liquidity", async function () {
        await d.marketRegistry.createMarket("Gold", "XAU", ethers.parseEther("500"), 100, ethers.parseEther("5000000"));
        await expect(
          d.virtualAMM.initializePool(2, ethers.parseEther("2000"), 0, 5000)
        ).to.be.revertedWith("VirtualAMM: zero liquidity");
      });

      it("reverts with invalid damping", async function () {
        await d.marketRegistry.createMarket("Gold", "XAU", ethers.parseEther("500"), 100, ethers.parseEther("5000000"));
        await expect(
          d.virtualAMM.initializePool(2, ethers.parseEther("2000"), ethers.parseEther("1000000"), 0)
        ).to.be.revertedWith("VirtualAMM: invalid damping");
      });

      it("non-admin cannot initialize", async function () {
        await d.marketRegistry.createMarket("Gold", "XAU", ethers.parseEther("500"), 100, ethers.parseEther("5000000"));
        await expect(
          d.virtualAMM.connect(d.user1).initializePool(2, ethers.parseEther("2000"), ethers.parseEther("1000000"), 5000)
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });
    });

    describe("simulateImpact()", function () {
      it("long trade increases price", async function () {
        const size = ethers.parseEther("100000"); // $100k
        const [execPrice, impact] = await d.virtualAMM.simulateImpact(0, size, true);
        const markPrice = await d.virtualAMM.getMarkPrice(0);
        expect(execPrice).to.be.greaterThan(markPrice);
        expect(impact).to.be.greaterThan(0);
      });

      it("short trade decreases price", async function () {
        const size = ethers.parseEther("100000");
        const [execPrice, impact] = await d.virtualAMM.simulateImpact(0, size, false);
        const markPrice = await d.virtualAMM.getMarkPrice(0);
        expect(execPrice).to.be.lessThan(markPrice);
        expect(impact).to.be.greaterThan(0);
      });

      it("larger trades have more impact", async function () {
        const small = ethers.parseEther("10000");
        const large = ethers.parseEther("1000000");
        const [, impactSmall] = await d.virtualAMM.simulateImpact(0, small, true);
        const [, impactLarge] = await d.virtualAMM.simulateImpact(0, large, true);
        expect(impactLarge).to.be.greaterThan(impactSmall);
      });

      it("reverts for uninitialized pool", async function () {
        await d.marketRegistry.createMarket("Gold", "XAU", ethers.parseEther("500"), 100, ethers.parseEther("5000000"));
        await expect(
          d.virtualAMM.simulateImpact(2, ethers.parseEther("1000"), true)
        ).to.be.revertedWith("VirtualAMM: pool not initialized");
      });
    });

    describe("syncToOracle()", function () {
      it("keeper can sync pool to oracle", async function () {
        // Change oracle price
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("55000")]);
        // Sync
        await d.virtualAMM.connect(d.keeper).syncToOracle(0);
        // Mark price should move toward $55,000
        const markPrice = await d.virtualAMM.getMarkPrice(0);
        expect(markPrice).to.be.greaterThan(roles.btcPrice);
      });

      it("non-keeper cannot sync", async function () {
        await expect(
          d.virtualAMM.connect(d.user1).syncToOracle(0)
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("reverts for uninitialized pool", async function () {
        await d.marketRegistry.createMarket("Gold", "XAU", ethers.parseEther("500"), 100, ethers.parseEther("5000000"));
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([2], [ethers.parseEther("2000")]);
        await expect(
          d.virtualAMM.connect(d.keeper).syncToOracle(2)
        ).to.be.revertedWith("VirtualAMM: pool not initialized");
      });

      it("emits PoolSynced event", async function () {
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("55000")]);
        await expect(d.virtualAMM.connect(d.keeper).syncToOracle(0))
          .to.emit(d.virtualAMM, "PoolSynced");
      });
    });

    describe("getMarkPrice()", function () {
      it("returns 0 for uninitialized pool", async function () {
        await d.marketRegistry.createMarket("Gold", "XAU", ethers.parseEther("500"), 100, ethers.parseEther("5000000"));
        expect(await d.virtualAMM.getMarkPrice(2)).to.equal(0);
      });
    });
  });

  // ==========================================================
  //                  PRICE FEED FACET
  // ==========================================================
  describe("PriceFeedFacet", function () {
    describe("getIndexPrice()", function () {
      it("returns oracle price", async function () {
        expect(await d.priceFeed.getIndexPrice(0)).to.equal(roles.btcPrice);
      });
    });

    describe("getMarkPrice()", function () {
      it("returns vAMM mark price", async function () {
        const markPrice = await d.priceFeed.getMarkPrice(0);
        expect(markPrice).to.be.greaterThan(0);
      });

      it("returns 0 for uninitialized pool", async function () {
        await d.marketRegistry.createMarket("Gold", "XAU", ethers.parseEther("500"), 100, ethers.parseEther("5000000"));
        expect(await d.priceFeed.getMarkPrice(2)).to.equal(0);
      });
    });

    describe("getExecutionPrice()", function () {
      it("returns price close to oracle for small trades", async function () {
        const size = ethers.parseEther("1000"); // $1k — tiny trade
        const execPrice = await d.priceFeed.getExecutionPrice(0, size, true);
        const diff = execPrice > roles.btcPrice ? execPrice - roles.btcPrice : roles.btcPrice - execPrice;
        // Should be very close to oracle price
        expect(diff).to.be.lessThan(roles.btcPrice / 100n); // < 1% diff
      });

      it("reverts if price is stale", async function () {
        await ethers.provider.send("evm_increaseTime", [121]);
        await ethers.provider.send("evm_mine");
        await expect(
          d.priceFeed.getExecutionPrice(0, ethers.parseEther("1000"), true)
        ).to.be.revertedWith("PriceFeed: price is stale");
      });

      it("returns oracle price when vAMM not initialized", async function () {
        await d.marketRegistry.createMarket("Gold", "XAU", ethers.parseEther("500"), 100, ethers.parseEther("5000000"));
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([2], [ethers.parseEther("2000")]);
        const price = await d.priceFeed.getExecutionPrice(2, ethers.parseEther("1000"), true);
        expect(price).to.equal(ethers.parseEther("2000"));
      });
    });

    describe("getOracleTWAP()", function () {
      it("returns price when only one data point", async function () {
        const twap = await d.priceFeed.getOracleTWAP(0);
        expect(twap).to.equal(roles.btcPrice);
      });

      it("TWAP updates with new prices", async function () {
        await ethers.provider.send("evm_increaseTime", [60]);
        await ethers.provider.send("evm_mine");
        await d.oracle.connect(d.oraclePoster).batchUpdatePrices([0], [ethers.parseEther("55000")]);
        const twap = await d.priceFeed.getOracleTWAP(0);
        // TWAP should be between 50000 and 55000
        expect(twap).to.be.greaterThanOrEqual(roles.btcPrice);
        expect(twap).to.be.lessThanOrEqual(ethers.parseEther("55000"));
      });
    });

    describe("getLiquidationPrice()", function () {
      it("returns oracle price", async function () {
        expect(await d.priceFeed.getLiquidationPrice(0)).to.equal(roles.btcPrice);
      });

      it("reverts if stale", async function () {
        await ethers.provider.send("evm_increaseTime", [121]);
        await ethers.provider.send("evm_mine");
        await expect(d.priceFeed.getLiquidationPrice(0))
          .to.be.revertedWith("PriceFeed: price is stale");
      });
    });
  });
});
