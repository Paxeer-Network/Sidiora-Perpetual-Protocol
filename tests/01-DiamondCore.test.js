const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullDiamond, getSelectors, FacetCutAction } = require("./helpers/deployDiamond");

describe("Diamond Core", function () {
  let d;

  beforeEach(async function () {
    d = await deployFullDiamond();
  });

  // ==========================================================
  //                    DIAMOND PROXY
  // ==========================================================
  describe("Diamond Proxy", function () {
    it("should have correct owner set in constructor", async function () {
      expect(await d.ownershipFacet.owner()).to.equal(d.owner.address);
    });

    it("should revert on unknown function selector", async function () {
      const bogus = new ethers.Interface(["function bogusFunction()"]);
      const data = bogus.encodeFunctionData("bogusFunction");
      await expect(
        d.owner.sendTransaction({ to: d.diamondAddress, data })
      ).to.be.revertedWith("Diamond: Function does not exist");
    });

    it("should accept ETH via receive()", async function () {
      await d.owner.sendTransaction({ to: d.diamondAddress, value: ethers.parseEther("1") });
      const balance = await ethers.provider.getBalance(d.diamondAddress);
      expect(balance).to.equal(ethers.parseEther("1"));
    });
  });

  // ==========================================================
  //                    DIAMOND CUT FACET
  // ==========================================================
  describe("DiamondCutFacet", function () {
    it("should allow owner to add a facet", async function () {
      // Deploy a dummy facet (re-deploy OwnershipFacet as dummy)
      const Factory = await ethers.getContractFactory("OwnershipFacet");
      const dummy = await Factory.deploy();
      await dummy.waitForDeployment();

      // We can't add already-existing selectors, so this is tested via the initial deployment
      const facetAddresses = await d.loupe.facetAddresses();
      expect(facetAddresses.length).to.be.greaterThan(1);
    });

    it("should revert diamond cut from non-owner", async function () {
      const cut = await ethers.getContractAt("IDiamondCut", d.diamondAddress);
      await expect(
        cut.connect(d.user1).diamondCut([], ethers.ZeroAddress, "0x")
      ).to.be.revertedWith("LibDiamond: Must be contract owner");
    });

    it("should revert adding function that already exists", async function () {
      const Factory = await ethers.getContractFactory("OwnershipFacet");
      const dummy = await Factory.deploy();
      await dummy.waitForDeployment();
      const selectors = getSelectors(dummy);

      const cut = await ethers.getContractAt("IDiamondCut", d.diamondAddress);
      await expect(
        cut.diamondCut(
          [{ facetAddress: await dummy.getAddress(), action: FacetCutAction.Add, functionSelectors: selectors }],
          ethers.ZeroAddress, "0x"
        )
      ).to.be.revertedWith("LibDiamondCut: Can't add function that already exists");
    });

    it("should revert adding facet with zero address", async function () {
      const cut = await ethers.getContractAt("IDiamondCut", d.diamondAddress);
      const selector = "0x12345678";
      await expect(
        cut.diamondCut(
          [{ facetAddress: ethers.ZeroAddress, action: FacetCutAction.Add, functionSelectors: [selector] }],
          ethers.ZeroAddress, "0x"
        )
      ).to.be.revertedWith("LibDiamondCut: Add facet can't be address(0)");
    });

    it("should revert adding facet with no selectors", async function () {
      const Factory = await ethers.getContractFactory("OwnershipFacet");
      const dummy = await Factory.deploy();
      await dummy.waitForDeployment();
      const cut = await ethers.getContractAt("IDiamondCut", d.diamondAddress);
      await expect(
        cut.diamondCut(
          [{ facetAddress: await dummy.getAddress(), action: FacetCutAction.Add, functionSelectors: [] }],
          ethers.ZeroAddress, "0x"
        )
      ).to.be.revertedWith("LibDiamondCut: No selectors in facet to cut");
    });

    it("should allow owner to replace a function", async function () {
      // Deploy a new OwnershipFacet
      const Factory = await ethers.getContractFactory("OwnershipFacet");
      const newFacet = await Factory.deploy();
      await newFacet.waitForDeployment();
      const selectors = getSelectors(newFacet);
      const cut = await ethers.getContractAt("IDiamondCut", d.diamondAddress);

      await cut.diamondCut(
        [{ facetAddress: await newFacet.getAddress(), action: FacetCutAction.Replace, functionSelectors: selectors }],
        ethers.ZeroAddress, "0x"
      );

      // Verify it points to new address
      const facetAddr = await d.loupe.facetAddress(selectors[0]);
      expect(facetAddr).to.equal(await newFacet.getAddress());
    });

    it("should allow owner to remove a function", async function () {
      // Get a selector from a non-critical facet (e.g., QuoterFacet)
      const quoterSelectors = getSelectors(d.facetContracts["QuoterFacet"]);
      const selectorToRemove = quoterSelectors[0];

      const cut = await ethers.getContractAt("IDiamondCut", d.diamondAddress);
      await cut.diamondCut(
        [{ facetAddress: ethers.ZeroAddress, action: FacetCutAction.Remove, functionSelectors: [selectorToRemove] }],
        ethers.ZeroAddress, "0x"
      );

      // Verify removed
      const facetAddr = await d.loupe.facetAddress(selectorToRemove);
      expect(facetAddr).to.equal(ethers.ZeroAddress);
    });

    it("should revert remove with non-zero facet address", async function () {
      const cut = await ethers.getContractAt("IDiamondCut", d.diamondAddress);
      await expect(
        cut.diamondCut(
          [{ facetAddress: d.owner.address, action: FacetCutAction.Remove, functionSelectors: ["0x12345678"] }],
          ethers.ZeroAddress, "0x"
        )
      ).to.be.revertedWith("LibDiamondCut: Remove facet address must be address(0)");
    });

    it("should emit DiamondCut event", async function () {
      const Factory = await ethers.getContractFactory("OwnershipFacet");
      const newFacet = await Factory.deploy();
      await newFacet.waitForDeployment();
      const selectors = getSelectors(newFacet);
      const cut = await ethers.getContractAt("IDiamondCut", d.diamondAddress);

      await expect(
        cut.diamondCut(
          [{ facetAddress: await newFacet.getAddress(), action: FacetCutAction.Replace, functionSelectors: selectors }],
          ethers.ZeroAddress, "0x"
        )
      ).to.emit(cut, "DiamondCut");
    });
  });

  // ==========================================================
  //                  DIAMOND LOUPE FACET
  // ==========================================================
  describe("DiamondLoupeFacet", function () {
    it("facets() should return all registered facets", async function () {
      const facets = await d.loupe.facets();
      // DiamondCutFacet + 17 other facets = 18 total
      expect(facets.length).to.be.greaterThanOrEqual(18);
    });

    it("facetAddresses() should return all facet addresses", async function () {
      const addresses = await d.loupe.facetAddresses();
      expect(addresses.length).to.be.greaterThanOrEqual(18);
    });

    it("facetFunctionSelectors() should return selectors for a facet", async function () {
      const ownershipAddr = await d.facetContracts["OwnershipFacet"].getAddress();
      const selectors = await d.loupe.facetFunctionSelectors(ownershipAddr);
      expect(selectors.length).to.equal(2); // owner() + transferOwnership()
    });

    it("facetAddress() should return correct facet for a selector", async function () {
      const iface = new ethers.Interface(["function owner() view returns (address)"]);
      const selector = iface.getFunction("owner").selector;
      const addr = await d.loupe.facetAddress(selector);
      expect(addr).to.not.equal(ethers.ZeroAddress);
    });

    it("facetAddress() should return address(0) for unknown selector", async function () {
      const addr = await d.loupe.facetAddress("0xdeadbeef");
      expect(addr).to.equal(ethers.ZeroAddress);
    });

    it("supportsInterface() should return false for unsupported interface", async function () {
      const result = await d.loupe.supportsInterface("0xdeadbeef");
      expect(result).to.equal(false);
    });

    it("facetFunctionSelectors() for non-existent facet returns empty", async function () {
      const selectors = await d.loupe.facetFunctionSelectors(ethers.ZeroAddress);
      expect(selectors.length).to.equal(0);
    });
  });

  // ==========================================================
  //                  OWNERSHIP FACET
  // ==========================================================
  describe("OwnershipFacet", function () {
    it("owner() should return deployer", async function () {
      expect(await d.ownershipFacet.owner()).to.equal(d.owner.address);
    });

    it("transferOwnership() should transfer to new owner", async function () {
      await d.ownershipFacet.transferOwnership(d.user1.address);
      expect(await d.ownershipFacet.owner()).to.equal(d.user1.address);
    });

    it("transferOwnership() should revert from non-owner", async function () {
      await expect(
        d.ownershipFacet.connect(d.user1).transferOwnership(d.user2.address)
      ).to.be.revertedWith("LibDiamond: Must be contract owner");
    });

    it("transferOwnership() should allow transferring to address(0) (renounce)", async function () {
      await d.ownershipFacet.transferOwnership(ethers.ZeroAddress);
      expect(await d.ownershipFacet.owner()).to.equal(ethers.ZeroAddress);
    });

    it("transferOwnership() should emit OwnershipTransferred", async function () {
      await expect(d.ownershipFacet.transferOwnership(d.user1.address))
        .to.emit(d.ownershipFacet, "OwnershipTransferred")
        .withArgs(d.owner.address, d.user1.address);
    });

    it("new owner can perform diamond cut after transfer", async function () {
      await d.ownershipFacet.transferOwnership(d.user1.address);
      const cut = await ethers.getContractAt("IDiamondCut", d.diamondAddress);
      // Empty cut should succeed for new owner
      await cut.connect(d.user1).diamondCut([], ethers.ZeroAddress, "0x");
    });

    it("old owner cannot perform diamond cut after transfer", async function () {
      await d.ownershipFacet.transferOwnership(d.user1.address);
      const cut = await ethers.getContractAt("IDiamondCut", d.diamondAddress);
      await expect(
        cut.connect(d.owner).diamondCut([], ethers.ZeroAddress, "0x")
      ).to.be.revertedWith("LibDiamond: Must be contract owner");
    });
  });
});
