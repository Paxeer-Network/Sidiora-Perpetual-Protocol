const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond } = require("./helpers/deployDiamond");

describe("AccessControl & Pausable", function () {
  let d;

  beforeEach(async function () {
    d = await deployFullDiamond();
  });

  // ==========================================================
  //                  ACCESS CONTROL FACET
  // ==========================================================
  describe("AccessControlFacet", function () {
    let MARKET_ADMIN, ORACLE_POSTER, KEEPER, PAUSER, PROTOCOL_FUNDER, INSURANCE_ADMIN;

    beforeEach(async function () {
      MARKET_ADMIN = await d.accessControl.MARKET_ADMIN_ROLE();
      ORACLE_POSTER = await d.accessControl.ORACLE_POSTER_ROLE();
      KEEPER = await d.accessControl.KEEPER_ROLE();
      PAUSER = await d.accessControl.PAUSER_ROLE();
      PROTOCOL_FUNDER = await d.accessControl.PROTOCOL_FUNDER_ROLE();
      INSURANCE_ADMIN = await d.accessControl.INSURANCE_ADMIN_ROLE();
    });

    describe("Role constants", function () {
      it("should return unique role identifiers", async function () {
        const roles = [MARKET_ADMIN, ORACLE_POSTER, KEEPER, PAUSER, PROTOCOL_FUNDER, INSURANCE_ADMIN];
        const unique = new Set(roles.map((r) => r.toString()));
        expect(unique.size).to.equal(6);
      });

      it("role constants should be keccak256 hashes", async function () {
        expect(MARKET_ADMIN).to.equal(ethers.keccak256(ethers.toUtf8Bytes("MARKET_ADMIN")));
        expect(ORACLE_POSTER).to.equal(ethers.keccak256(ethers.toUtf8Bytes("ORACLE_POSTER")));
        expect(KEEPER).to.equal(ethers.keccak256(ethers.toUtf8Bytes("KEEPER")));
        expect(PAUSER).to.equal(ethers.keccak256(ethers.toUtf8Bytes("PAUSER")));
        expect(PROTOCOL_FUNDER).to.equal(ethers.keccak256(ethers.toUtf8Bytes("PROTOCOL_FUNDER")));
        expect(INSURANCE_ADMIN).to.equal(ethers.keccak256(ethers.toUtf8Bytes("INSURANCE_ADMIN")));
      });
    });

    describe("grantRole()", function () {
      it("owner can grant any role", async function () {
        await d.accessControl.grantRole(MARKET_ADMIN, d.user1.address);
        expect(await d.accessControl.hasRole(MARKET_ADMIN, d.user1.address)).to.equal(true);
      });

      it("granting same role twice is idempotent", async function () {
        await d.accessControl.grantRole(KEEPER, d.user1.address);
        await d.accessControl.grantRole(KEEPER, d.user1.address);
        expect(await d.accessControl.hasRole(KEEPER, d.user1.address)).to.equal(true);
      });

      it("non-owner without admin role cannot grant roles", async function () {
        await expect(
          d.accessControl.connect(d.user1).grantRole(MARKET_ADMIN, d.user2.address)
        ).to.be.revertedWith("LibAccessControl: must have admin role");
      });

      it("should emit RoleGranted event", async function () {
        await expect(d.accessControl.grantRole(KEEPER, d.user1.address))
          .to.emit(d.accessControl, "RoleGranted")
          .withArgs(KEEPER, d.user1.address, d.owner.address);
      });

      it("role admin can grant roles they administer", async function () {
        // Set MARKET_ADMIN as admin of KEEPER role
        await d.accessControl.setRoleAdmin(KEEPER, MARKET_ADMIN);
        await d.accessControl.grantRole(MARKET_ADMIN, d.user1.address);
        // Now user1 (MARKET_ADMIN) can grant KEEPER
        await d.accessControl.connect(d.user1).grantRole(KEEPER, d.user2.address);
        expect(await d.accessControl.hasRole(KEEPER, d.user2.address)).to.equal(true);
      });
    });

    describe("revokeRole()", function () {
      it("owner can revoke any role", async function () {
        await d.accessControl.grantRole(MARKET_ADMIN, d.user1.address);
        await d.accessControl.revokeRole(MARKET_ADMIN, d.user1.address);
        expect(await d.accessControl.hasRole(MARKET_ADMIN, d.user1.address)).to.equal(false);
      });

      it("revoking non-existent role is idempotent", async function () {
        await d.accessControl.revokeRole(MARKET_ADMIN, d.user1.address);
        expect(await d.accessControl.hasRole(MARKET_ADMIN, d.user1.address)).to.equal(false);
      });

      it("non-owner cannot revoke roles", async function () {
        await d.accessControl.grantRole(MARKET_ADMIN, d.user1.address);
        await expect(
          d.accessControl.connect(d.user2).revokeRole(MARKET_ADMIN, d.user1.address)
        ).to.be.revertedWith("LibAccessControl: must have admin role");
      });

      it("should emit RoleRevoked event", async function () {
        await d.accessControl.grantRole(KEEPER, d.user1.address);
        await expect(d.accessControl.revokeRole(KEEPER, d.user1.address))
          .to.emit(d.accessControl, "RoleRevoked")
          .withArgs(KEEPER, d.user1.address, d.owner.address);
      });
    });

    describe("renounceRole()", function () {
      it("user can renounce their own role", async function () {
        await d.accessControl.grantRole(KEEPER, d.user1.address);
        await d.accessControl.connect(d.user1).renounceRole(KEEPER);
        expect(await d.accessControl.hasRole(KEEPER, d.user1.address)).to.equal(false);
      });

      it("renouncing non-existent role is safe", async function () {
        await d.accessControl.connect(d.user1).renounceRole(KEEPER);
        expect(await d.accessControl.hasRole(KEEPER, d.user1.address)).to.equal(false);
      });
    });

    describe("hasRole()", function () {
      it("returns false for account without role", async function () {
        expect(await d.accessControl.hasRole(MARKET_ADMIN, d.user1.address)).to.equal(false);
      });

      it("returns true after granting", async function () {
        await d.accessControl.grantRole(MARKET_ADMIN, d.user1.address);
        expect(await d.accessControl.hasRole(MARKET_ADMIN, d.user1.address)).to.equal(true);
      });
    });

    describe("setRoleAdmin()", function () {
      it("owner can set role admin", async function () {
        await d.accessControl.setRoleAdmin(KEEPER, MARKET_ADMIN);
        expect(await d.accessControl.getRoleAdmin(KEEPER)).to.equal(MARKET_ADMIN);
      });

      it("non-owner cannot set role admin", async function () {
        await expect(
          d.accessControl.connect(d.user1).setRoleAdmin(KEEPER, MARKET_ADMIN)
        ).to.be.revertedWith("LibDiamond: Must be contract owner");
      });
    });
  });

  // ==========================================================
  //                    PAUSABLE FACET
  // ==========================================================
  describe("PausableFacet", function () {
    let PAUSER;

    beforeEach(async function () {
      PAUSER = await d.accessControl.PAUSER_ROLE();
      await d.accessControl.grantRole(PAUSER, d.owner.address);
    });

    describe("Global Pause", function () {
      it("initially not paused", async function () {
        expect(await d.pausable.isGlobalPaused()).to.equal(false);
      });

      it("pauser can pause globally", async function () {
        await d.pausable.pauseGlobal();
        expect(await d.pausable.isGlobalPaused()).to.equal(true);
      });

      it("pauser can unpause globally", async function () {
        await d.pausable.pauseGlobal();
        await d.pausable.unpauseGlobal();
        expect(await d.pausable.isGlobalPaused()).to.equal(false);
      });

      it("reverts if already paused", async function () {
        await d.pausable.pauseGlobal();
        await expect(d.pausable.pauseGlobal()).to.be.revertedWith("PausableFacet: already paused");
      });

      it("reverts unpause if not paused", async function () {
        await expect(d.pausable.unpauseGlobal()).to.be.revertedWith("PausableFacet: not paused");
      });

      it("non-pauser cannot pause", async function () {
        await expect(
          d.pausable.connect(d.user1).pauseGlobal()
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("non-pauser cannot unpause", async function () {
        await d.pausable.pauseGlobal();
        await expect(
          d.pausable.connect(d.user1).unpauseGlobal()
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("emits GlobalPaused event", async function () {
        await expect(d.pausable.pauseGlobal())
          .to.emit(d.pausable, "GlobalPaused")
          .withArgs(d.owner.address);
      });

      it("emits GlobalUnpaused event", async function () {
        await d.pausable.pauseGlobal();
        await expect(d.pausable.unpauseGlobal())
          .to.emit(d.pausable, "GlobalUnpaused")
          .withArgs(d.owner.address);
      });
    });

    describe("Market Pause", function () {
      it("market initially not paused", async function () {
        expect(await d.pausable.isMarketPaused(0)).to.equal(false);
      });

      it("pauser can pause a market", async function () {
        await d.pausable.pauseMarket(0);
        expect(await d.pausable.isMarketPaused(0)).to.equal(true);
      });

      it("pausing one market does not affect others", async function () {
        await d.pausable.pauseMarket(0);
        expect(await d.pausable.isMarketPaused(1)).to.equal(false);
      });

      it("pauser can unpause a market", async function () {
        await d.pausable.pauseMarket(0);
        await d.pausable.unpauseMarket(0);
        expect(await d.pausable.isMarketPaused(0)).to.equal(false);
      });

      it("reverts if market already paused", async function () {
        await d.pausable.pauseMarket(0);
        await expect(d.pausable.pauseMarket(0)).to.be.revertedWith("PausableFacet: market already paused");
      });

      it("reverts unpause if market not paused", async function () {
        await expect(d.pausable.unpauseMarket(0)).to.be.revertedWith("PausableFacet: market not paused");
      });

      it("global pause makes market appear paused", async function () {
        await d.pausable.pauseGlobal();
        expect(await d.pausable.isMarketPaused(0)).to.equal(true);
      });

      it("emits MarketPaused event", async function () {
        await expect(d.pausable.pauseMarket(5))
          .to.emit(d.pausable, "MarketPaused")
          .withArgs(5, d.owner.address);
      });

      it("emits MarketUnpaused event", async function () {
        await d.pausable.pauseMarket(5);
        await expect(d.pausable.unpauseMarket(5))
          .to.emit(d.pausable, "MarketUnpaused")
          .withArgs(5, d.owner.address);
      });

      it("non-pauser cannot pause market", async function () {
        await expect(
          d.pausable.connect(d.user1).pauseMarket(0)
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });
    });
  });
});
