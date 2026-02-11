const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, setupFullProtocol } = require("./helpers/deployDiamond");

describe("Vaults & Collateral", function () {
  let d, roles;

  beforeEach(async function () {
    d = await deployFullDiamond();
    roles = await setupFullProtocol(d);
  });

  // ==========================================================
  //                  VAULT FACTORY FACET
  // ==========================================================
  describe("VaultFactoryFacet", function () {
    describe("setImplementation()", function () {
      it("owner can set implementation", async function () {
        const impl = await d.vaultFactory.getUserVaultImplementation();
        expect(impl).to.not.equal(ethers.ZeroAddress);
      });

      it("non-owner cannot set implementation", async function () {
        await expect(
          d.vaultFactory.connect(d.user1).setImplementation(d.user1.address)
        ).to.be.revertedWith("LibDiamond: Must be contract owner");
      });

      it("reverts with zero address", async function () {
        await expect(
          d.vaultFactory.setImplementation(ethers.ZeroAddress)
        ).to.be.revertedWith("VaultFactory: zero implementation");
      });

      it("emits VaultImplementationUpdated event", async function () {
        const UserVault = await ethers.getContractFactory("UserVault");
        const newImpl = await UserVault.deploy();
        await newImpl.waitForDeployment();
        await expect(d.vaultFactory.setImplementation(await newImpl.getAddress()))
          .to.emit(d.vaultFactory, "VaultImplementationUpdated");
      });
    });

    describe("createVault()", function () {
      it("user can create a vault", async function () {
        await d.vaultFactory.connect(d.user1).createVault();
        const vault = await d.vaultFactory.getVault(d.user1.address);
        expect(vault).to.not.equal(ethers.ZeroAddress);
      });

      it("vault address matches prediction", async function () {
        const predicted = await d.vaultFactory.predictVaultAddress(d.user1.address);
        await d.vaultFactory.connect(d.user1).createVault();
        const actual = await d.vaultFactory.getVault(d.user1.address);
        expect(actual).to.equal(predicted);
      });

      it("reverts on second vault creation", async function () {
        await d.vaultFactory.connect(d.user1).createVault();
        await expect(
          d.vaultFactory.connect(d.user1).createVault()
        ).to.be.revertedWith("VaultFactory: vault already exists");
      });

      it("different users get different vaults", async function () {
        await d.vaultFactory.connect(d.user1).createVault();
        await d.vaultFactory.connect(d.user2).createVault();
        const v1 = await d.vaultFactory.getVault(d.user1.address);
        const v2 = await d.vaultFactory.getVault(d.user2.address);
        expect(v1).to.not.equal(v2);
      });

      it("totalVaults increments correctly", async function () {
        const before = await d.vaultFactory.totalVaults();
        await d.vaultFactory.connect(d.user1).createVault();
        await d.vaultFactory.connect(d.user2).createVault();
        expect(await d.vaultFactory.totalVaults()).to.equal(before + 2n);
      });

      it("emits VaultCreated event", async function () {
        await expect(d.vaultFactory.connect(d.user1).createVault())
          .to.emit(d.vaultFactory, "VaultCreated")
          .withArgs(d.user1.address, await d.vaultFactory.predictVaultAddress(d.user1.address));
      });

      it("getVault returns zero for user without vault", async function () {
        expect(await d.vaultFactory.getVault(d.user1.address)).to.equal(ethers.ZeroAddress);
      });
    });
  });

  // ==========================================================
  //                      USER VAULT
  // ==========================================================
  describe("UserVault", function () {
    let vaultAddr, vault, usdcAddr;

    beforeEach(async function () {
      await d.vaultFactory.connect(d.user1).createVault();
      vaultAddr = await d.vaultFactory.getVault(d.user1.address);
      vault = await ethers.getContractAt("UserVault", vaultAddr);
      usdcAddr = await d.usdc.getAddress();
    });

    describe("initialize()", function () {
      it("vault owner is set correctly", async function () {
        expect(await vault.vaultOwner()).to.equal(d.user1.address);
      });

      it("vault diamond is set correctly", async function () {
        expect(await vault.diamond()).to.equal(d.diamondAddress);
      });

      it("vault is initialized", async function () {
        expect(await vault.isInitialized()).to.equal(true);
      });

      it("cannot re-initialize", async function () {
        await expect(
          vault.initialize(d.user2.address, d.diamondAddress)
        ).to.be.revertedWith("UserVault: already initialized");
      });
    });

    describe("deposit()", function () {
      it("owner can deposit USDC", async function () {
        const amount = 1000n * 10n ** 6n;
        await d.usdc.connect(d.user1).approve(vaultAddr, amount);
        await vault.connect(d.user1).deposit(usdcAddr, amount);
        expect(await vault.getBalance(usdcAddr)).to.equal(amount);
      });

      it("non-owner cannot deposit", async function () {
        const amount = 1000n * 10n ** 6n;
        await d.usdc.connect(d.user2).approve(vaultAddr, amount);
        await expect(
          vault.connect(d.user2).deposit(usdcAddr, amount)
        ).to.be.revertedWith("UserVault: caller is not owner");
      });

      it("reverts on zero amount", async function () {
        await expect(
          vault.connect(d.user1).deposit(usdcAddr, 0)
        ).to.be.revertedWith("UserVault: zero amount");
      });

      it("emits Deposited event", async function () {
        const amount = 1000n * 10n ** 6n;
        await d.usdc.connect(d.user1).approve(vaultAddr, amount);
        await expect(vault.connect(d.user1).deposit(usdcAddr, amount))
          .to.emit(vault, "Deposited")
          .withArgs(usdcAddr, amount);
      });

      it("multiple deposits accumulate", async function () {
        const amount = 500n * 10n ** 6n;
        await d.usdc.connect(d.user1).approve(vaultAddr, amount * 2n);
        await vault.connect(d.user1).deposit(usdcAddr, amount);
        await vault.connect(d.user1).deposit(usdcAddr, amount);
        expect(await vault.getBalance(usdcAddr)).to.equal(amount * 2n);
      });
    });

    describe("withdraw()", function () {
      beforeEach(async function () {
        const amount = 10000n * 10n ** 6n;
        await d.usdc.connect(d.user1).approve(vaultAddr, amount);
        await vault.connect(d.user1).deposit(usdcAddr, amount);
      });

      it("owner can withdraw", async function () {
        const amount = 5000n * 10n ** 6n;
        const before = await d.usdc.balanceOf(d.user1.address);
        await vault.connect(d.user1).withdraw(usdcAddr, amount);
        const after = await d.usdc.balanceOf(d.user1.address);
        expect(after - before).to.equal(amount);
      });

      it("non-owner cannot withdraw", async function () {
        await expect(
          vault.connect(d.user2).withdraw(usdcAddr, 1000n * 10n ** 6n)
        ).to.be.revertedWith("UserVault: caller is not owner");
      });

      it("reverts on zero amount", async function () {
        await expect(
          vault.connect(d.user1).withdraw(usdcAddr, 0)
        ).to.be.revertedWith("UserVault: zero amount");
      });

      it("reverts on insufficient balance", async function () {
        await expect(
          vault.connect(d.user1).withdraw(usdcAddr, 20000n * 10n ** 6n)
        ).to.be.revertedWith("UserVault: insufficient available balance");
      });

      it("emits Withdrawn event", async function () {
        const amount = 1000n * 10n ** 6n;
        await expect(vault.connect(d.user1).withdraw(usdcAddr, amount))
          .to.emit(vault, "Withdrawn")
          .withArgs(usdcAddr, amount);
      });
    });

    describe("emergencyWithdraw()", function () {
      it("withdraws all available balance", async function () {
        const amount = 5000n * 10n ** 6n;
        await d.usdc.connect(d.user1).approve(vaultAddr, amount);
        await vault.connect(d.user1).deposit(usdcAddr, amount);
        await vault.connect(d.user1).emergencyWithdraw(usdcAddr);
        expect(await vault.getBalance(usdcAddr)).to.equal(0);
      });

      it("non-owner cannot emergency withdraw", async function () {
        await expect(
          vault.connect(d.user2).emergencyWithdraw(usdcAddr)
        ).to.be.revertedWith("UserVault: caller is not owner");
      });

      it("reverts if no available balance", async function () {
        await expect(
          vault.connect(d.user1).emergencyWithdraw(usdcAddr)
        ).to.be.revertedWith("UserVault: no available balance");
      });
    });

    describe("lockCollateral() / receiveCollateral()", function () {
      it("only diamond can lock collateral", async function () {
        await expect(
          vault.connect(d.user1).lockCollateral(usdcAddr, 1000, d.user2.address)
        ).to.be.revertedWith("UserVault: caller is not diamond");
      });

      it("only diamond can receive collateral", async function () {
        await expect(
          vault.connect(d.user1).receiveCollateral(usdcAddr, 1000)
        ).to.be.revertedWith("UserVault: caller is not diamond");
      });
    });

    describe("getLockedBalance()", function () {
      it("initially zero", async function () {
        expect(await vault.getLockedBalance(usdcAddr)).to.equal(0);
      });
    });
  });

  // ==========================================================
  //                  CENTRAL VAULT FACET
  // ==========================================================
  describe("CentralVaultFacet", function () {
    let usdcAddr;

    beforeEach(async function () {
      usdcAddr = await d.usdc.getAddress();
    });

    describe("fundVault()", function () {
      it("protocol funder can deposit", async function () {
        const balance = await d.centralVault.getVaultBalance(usdcAddr);
        expect(balance).to.be.greaterThan(0);
      });

      it("non-funder cannot deposit", async function () {
        await expect(
          d.centralVault.connect(d.user1).fundVault(usdcAddr, 1000)
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("reverts on zero amount", async function () {
        await expect(
          d.centralVault.connect(d.funder).fundVault(usdcAddr, 0)
        ).to.be.revertedWith("CentralVault: zero amount");
      });

      it("reverts on non-accepted token", async function () {
        const usdtAddr = await d.usdt.getAddress();
        await expect(
          d.centralVault.connect(d.funder).fundVault(usdtAddr, 1000)
        ).to.be.revertedWith("CentralVault: token not accepted");
      });

      it("emits VaultFunded event", async function () {
        const amount = 1000n * 10n ** 6n;
        await d.usdc.mint(d.funder.address, amount);
        await d.usdc.connect(d.funder).approve(d.diamondAddress, amount);
        await expect(d.centralVault.connect(d.funder).fundVault(usdcAddr, amount))
          .to.emit(d.centralVault, "VaultFunded")
          .withArgs(usdcAddr, amount, d.funder.address);
      });
    });

    describe("defundVault()", function () {
      it("protocol funder can withdraw", async function () {
        const before = await d.usdc.balanceOf(d.funder.address);
        const amount = 1000n * 10n ** 6n;
        await d.centralVault.connect(d.funder).defundVault(usdcAddr, amount, d.funder.address);
        const after = await d.usdc.balanceOf(d.funder.address);
        expect(after - before).to.equal(amount);
      });

      it("non-funder cannot withdraw", async function () {
        await expect(
          d.centralVault.connect(d.user1).defundVault(usdcAddr, 1000, d.user1.address)
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("reverts on zero amount", async function () {
        await expect(
          d.centralVault.connect(d.funder).defundVault(usdcAddr, 0, d.funder.address)
        ).to.be.revertedWith("CentralVault: zero amount");
      });

      it("reverts on zero recipient", async function () {
        await expect(
          d.centralVault.connect(d.funder).defundVault(usdcAddr, 1000, ethers.ZeroAddress)
        ).to.be.revertedWith("CentralVault: zero recipient");
      });

      it("reverts on insufficient balance", async function () {
        const balance = await d.centralVault.getVaultBalance(usdcAddr);
        await expect(
          d.centralVault.connect(d.funder).defundVault(usdcAddr, balance + 1n, d.funder.address)
        ).to.be.revertedWith("CentralVault: insufficient balance");
      });

      it("emits VaultDefunded event", async function () {
        const amount = 1000n * 10n ** 6n;
        await expect(d.centralVault.connect(d.funder).defundVault(usdcAddr, amount, d.funder.address))
          .to.emit(d.centralVault, "VaultDefunded");
      });
    });

    describe("getUtilization()", function () {
      it("returns 0 for empty vault", async function () {
        const daiAddr = await d.dai.getAddress();
        expect(await d.centralVault.getUtilization(daiAddr)).to.equal(0);
      });
    });
  });

  // ==========================================================
  //                  COLLATERAL FACET
  // ==========================================================
  describe("CollateralFacet", function () {
    let usdcAddr, usdtAddr, daiAddr;

    beforeEach(async function () {
      usdcAddr = await d.usdc.getAddress();
      usdtAddr = await d.usdt.getAddress();
      daiAddr = await d.dai.getAddress();
    });

    describe("addCollateral()", function () {
      it("accepted tokens are registered", async function () {
        expect(await d.collateral.isAcceptedCollateral(usdcAddr)).to.equal(true);
        expect(await d.collateral.isAcceptedCollateral(daiAddr)).to.equal(true);
      });

      it("non-accepted tokens are not registered", async function () {
        expect(await d.collateral.isAcceptedCollateral(usdtAddr)).to.equal(false);
      });

      it("admin can add new collateral", async function () {
        await d.collateral.addCollateral(usdtAddr);
        expect(await d.collateral.isAcceptedCollateral(usdtAddr)).to.equal(true);
      });

      it("reverts adding already accepted collateral", async function () {
        await expect(d.collateral.addCollateral(usdcAddr))
          .to.be.revertedWith("CollateralFacet: already accepted");
      });

      it("reverts adding zero address", async function () {
        await expect(d.collateral.addCollateral(ethers.ZeroAddress))
          .to.be.revertedWith("CollateralFacet: zero address");
      });

      it("non-admin cannot add collateral", async function () {
        await expect(
          d.collateral.connect(d.user1).addCollateral(usdtAddr)
        ).to.be.revertedWith("LibAccessControl: account is missing role");
      });

      it("emits CollateralAdded event", async function () {
        await expect(d.collateral.addCollateral(usdtAddr))
          .to.emit(d.collateral, "CollateralAdded")
          .withArgs(usdtAddr, 6);
      });

      it("stores correct decimals", async function () {
        expect(await d.collateral.getCollateralDecimals(usdcAddr)).to.equal(6);
        expect(await d.collateral.getCollateralDecimals(daiAddr)).to.equal(18);
      });
    });

    describe("removeCollateral()", function () {
      it("admin can remove collateral", async function () {
        await d.collateral.removeCollateral(daiAddr);
        expect(await d.collateral.isAcceptedCollateral(daiAddr)).to.equal(false);
      });

      it("reverts removing non-accepted", async function () {
        await expect(d.collateral.removeCollateral(usdtAddr))
          .to.be.revertedWith("CollateralFacet: not accepted");
      });

      it("emits CollateralRemoved event", async function () {
        await expect(d.collateral.removeCollateral(daiAddr))
          .to.emit(d.collateral, "CollateralRemoved")
          .withArgs(daiAddr);
      });

      it("removed token no longer in list", async function () {
        await d.collateral.removeCollateral(daiAddr);
        const tokens = await d.collateral.getCollateralTokens();
        expect(tokens).to.not.include(daiAddr);
      });
    });

    describe("getCollateralValue()", function () {
      it("USDC 6 decimal → 18 decimal normalization", async function () {
        const amount = 1000n * 10n ** 6n; // 1000 USDC
        const value = await d.collateral.getCollateralValue(usdcAddr, amount);
        expect(value).to.equal(ethers.parseEther("1000"));
      });

      it("DAI 18 decimal → 18 decimal (no change)", async function () {
        const amount = ethers.parseEther("1000");
        const value = await d.collateral.getCollateralValue(daiAddr, amount);
        expect(value).to.equal(ethers.parseEther("1000"));
      });

      it("reverts for non-accepted token", async function () {
        await expect(d.collateral.getCollateralValue(usdtAddr, 1000))
          .to.be.revertedWith("CollateralFacet: not accepted");
      });
    });

    describe("getCollateralTokens()", function () {
      it("returns all accepted tokens", async function () {
        const tokens = await d.collateral.getCollateralTokens();
        expect(tokens.length).to.equal(2);
        expect(tokens).to.include(usdcAddr);
        expect(tokens).to.include(daiAddr);
      });
    });
  });
});
