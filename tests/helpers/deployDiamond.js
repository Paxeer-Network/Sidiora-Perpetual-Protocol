const { ethers } = require("hardhat");

// Facet cut action enum
const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

// Get function selectors from a contract, excluding init/constructor
function getSelectors(contract) {
  const selectors = [];
  const iface = contract.interface;
  for (const fragment of iface.fragments) {
    if (fragment.type === "function") {
      selectors.push(iface.getFunction(fragment.name).selector);
    }
  }
  return selectors;
}

// Remove specific selectors from an array
function removeSelectors(selectors, toRemove) {
  return selectors.filter((s) => !toRemove.includes(s));
}

// Deploy the full diamond with all facets + setup roles, collateral, market, oracle, vAMM
async function deployFullDiamond() {
  const [owner, user1, user2, keeper, oraclePoster, funder] =
    await ethers.getSigners();

  // --- Deploy DiamondCutFacet ---
  const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.waitForDeployment();

  // --- Deploy Diamond ---
  const Diamond = await ethers.getContractFactory("Diamond");
  const diamond = await Diamond.deploy(owner.address, await diamondCutFacet.getAddress());
  await diamond.waitForDeployment();
  const diamondAddress = await diamond.getAddress();

  // --- Deploy all facets ---
  const facetNames = [
    "DiamondLoupeFacet",
    "OwnershipFacet",
    "AccessControlFacet",
    "PausableFacet",
    "VaultFactoryFacet",
    "CentralVaultFacet",
    "CollateralFacet",
    "MarketRegistryFacet",
    "OracleFacet",
    "VirtualAMMFacet",
    "PriceFeedFacet",
    "PositionFacet",
    "OrderBookFacet",
    "LiquidationFacet",
    "FundingRateFacet",
    "InsuranceFundFacet",
    "QuoterFacet",
  ];

  const facetContracts = {};
  const cuts = [];
  const addedSelectors = new Set();

  // DiamondCutFacet's diamondCut selector is already registered via constructor
  const dcSelectors = getSelectors(diamondCutFacet);
  for (const s of dcSelectors) addedSelectors.add(s);

  for (const name of facetNames) {
    const Factory = await ethers.getContractFactory(name);
    const facet = await Factory.deploy();
    await facet.waitForDeployment();
    facetContracts[name] = facet;

    let selectors = getSelectors(facet);

    // Deduplicate: skip selectors already added by a previous facet
    selectors = selectors.filter((s) => !addedSelectors.has(s));
    if (selectors.length === 0) continue;
    for (const s of selectors) addedSelectors.add(s);

    cuts.push({
      facetAddress: await facet.getAddress(),
      action: FacetCutAction.Add,
      functionSelectors: selectors,
    });
  }

  // --- Perform diamond cut to add all facets ---
  const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
  const tx = await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");
  await tx.wait();

  // --- Get facet interfaces on diamond address ---
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);
  const ownershipFacet = await ethers.getContractAt("OwnershipFacet", diamondAddress);
  const accessControl = await ethers.getContractAt("AccessControlFacet", diamondAddress);
  const pausable = await ethers.getContractAt("PausableFacet", diamondAddress);
  const vaultFactory = await ethers.getContractAt("VaultFactoryFacet", diamondAddress);
  const centralVault = await ethers.getContractAt("CentralVaultFacet", diamondAddress);
  const collateral = await ethers.getContractAt("CollateralFacet", diamondAddress);
  const marketRegistry = await ethers.getContractAt("MarketRegistryFacet", diamondAddress);
  const oracle = await ethers.getContractAt("OracleFacet", diamondAddress);
  const virtualAMM = await ethers.getContractAt("VirtualAMMFacet", diamondAddress);
  const priceFeed = await ethers.getContractAt("PriceFeedFacet", diamondAddress);
  const position = await ethers.getContractAt("PositionFacet", diamondAddress);
  const orderBook = await ethers.getContractAt("OrderBookFacet", diamondAddress);
  const liquidation = await ethers.getContractAt("LiquidationFacet", diamondAddress);
  const fundingRate = await ethers.getContractAt("FundingRateFacet", diamondAddress);
  const insuranceFund = await ethers.getContractAt("InsuranceFundFacet", diamondAddress);
  const quoter = await ethers.getContractAt("QuoterFacet", diamondAddress);

  // --- Deploy MockERC20 tokens ---
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();
  const usdt = await MockERC20.deploy("Tether USD", "USDT", 6);
  await usdt.waitForDeployment();
  const dai = await MockERC20.deploy("Dai Stablecoin", "DAI", 18);
  await dai.waitForDeployment();

  // --- Deploy UserVault implementation ---
  const UserVault = await ethers.getContractFactory("UserVault");
  const userVaultImpl = await UserVault.deploy();
  await userVaultImpl.waitForDeployment();

  return {
    diamond,
    diamondAddress,
    diamondCut,
    loupe,
    ownershipFacet,
    accessControl,
    pausable,
    vaultFactory,
    centralVault,
    collateral,
    marketRegistry,
    oracle,
    virtualAMM,
    priceFeed,
    position,
    orderBook,
    liquidation,
    fundingRate,
    insuranceFund,
    quoter,
    usdc,
    usdt,
    dai,
    userVaultImpl,
    facetContracts,
    owner,
    user1,
    user2,
    keeper,
    oraclePoster,
    funder,
    FacetCutAction,
    getSelectors,
  };
}

// Setup roles, collateral, vault implementation, market, oracle prices, vAMM
async function setupFullProtocol(d) {
  const {
    accessControl, vaultFactory, collateral, marketRegistry,
    oracle, virtualAMM, usdc, usdt, dai, userVaultImpl,
    owner, user1, user2, keeper, oraclePoster, funder, diamondAddress,
  } = d;

  // --- Grant roles ---
  const MARKET_ADMIN = await accessControl.MARKET_ADMIN_ROLE();
  const ORACLE_POSTER = await accessControl.ORACLE_POSTER_ROLE();
  const KEEPER = await accessControl.KEEPER_ROLE();
  const PAUSER = await accessControl.PAUSER_ROLE();
  const PROTOCOL_FUNDER = await accessControl.PROTOCOL_FUNDER_ROLE();
  const INSURANCE_ADMIN = await accessControl.INSURANCE_ADMIN_ROLE();

  await accessControl.grantRole(MARKET_ADMIN, owner.address);
  await accessControl.grantRole(ORACLE_POSTER, oraclePoster.address);
  await accessControl.grantRole(KEEPER, keeper.address);
  await accessControl.grantRole(PAUSER, owner.address);
  await accessControl.grantRole(PROTOCOL_FUNDER, funder.address);
  await accessControl.grantRole(INSURANCE_ADMIN, owner.address);

  // --- Set vault implementation ---
  await vaultFactory.setImplementation(await userVaultImpl.getAddress());

  // --- Add collateral tokens ---
  await collateral.addCollateral(await usdc.getAddress());
  await collateral.addCollateral(await dai.getAddress());

  // --- Create BTC market (id=0) ---
  const maxLev = ethers.parseEther("1000"); // 1000x
  const maintenanceMargin = 50; // 0.5%
  const maxOI = ethers.parseEther("10000000"); // $10M
  await marketRegistry.createMarket("Bitcoin", "BTC", maxLev, maintenanceMargin, maxOI);

  // --- Create ETH market (id=1) ---
  await marketRegistry.createMarket("Ethereum", "ETH", maxLev, maintenanceMargin, maxOI);

  // --- Set fee configuration ---
  // takerFee=10bps(0.1%), makerFee=5bps(0.05%), liquidationFee=500bps(5%), insuranceCut=2000bps(20%)
  await marketRegistry.setFees(10, 5, 500, 2000);

  // --- Set oracle staleness ---
  await oracle.connect(owner).setMaxPriceStaleness(120);

  // --- Post initial prices ---
  const btcPrice = ethers.parseEther("50000"); // $50,000
  const ethPrice = ethers.parseEther("3000"); // $3,000
  await oracle.connect(oraclePoster).batchUpdatePrices([0, 1], [btcPrice, ethPrice]);

  // --- Initialize vAMM pools ---
  const virtualLiquidity = ethers.parseEther("1000000"); // $1M virtual depth
  const dampingFactor = 5000; // 50%
  await virtualAMM.initializePool(0, btcPrice, virtualLiquidity, dampingFactor);
  await virtualAMM.initializePool(1, ethPrice, virtualLiquidity, dampingFactor);

  // --- Fund central vault ---
  const usdcAddr = await usdc.getAddress();
  const fundAmount = 10_000_000n * 10n ** 6n; // $10M USDC
  await usdc.mint(funder.address, fundAmount);
  await usdc.connect(funder).approve(diamondAddress, fundAmount);
  await d.centralVault.connect(funder).fundVault(usdcAddr, fundAmount);

  // --- Mint tokens to users ---
  const userAmount = 1_000_000n * 10n ** 6n; // $1M each
  await usdc.mint(user1.address, userAmount);
  await usdc.mint(user2.address, userAmount);

  const daiAmount = ethers.parseEther("1000000");
  await dai.mint(user1.address, daiAmount);
  await dai.mint(user2.address, daiAmount);

  return {
    MARKET_ADMIN, ORACLE_POSTER, KEEPER, PAUSER, PROTOCOL_FUNDER, INSURANCE_ADMIN,
    btcPrice, ethPrice,
  };
}

module.exports = {
  deployFullDiamond,
  setupFullProtocol,
  getSelectors,
  FacetCutAction,
};
