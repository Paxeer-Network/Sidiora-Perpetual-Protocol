const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ============================================================
//                    CONSTANTS
// ============================================================

const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

// Deployment manifest file path
const DEPLOYMENTS_DIR = path.join(__dirname, "..", "..", "deployments");
const getDeploymentPath = (network) =>
  path.join(DEPLOYMENTS_DIR, `${network}.json`);

// ============================================================
//                    SELECTOR UTILS
// ============================================================

/**
 * Get all function selectors from a deployed contract
 * @param {Contract} contract - ethers Contract instance
 * @returns {string[]} Array of 4-byte function selectors
 */
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

/**
 * Get selectors excluding specific function names
 * @param {Contract} contract
 * @param {string[]} functionNames - Names to exclude
 * @returns {string[]}
 */
function getSelectorsExcept(contract, functionNames) {
  const iface = contract.interface;
  const excluded = new Set(
    functionNames.map((name) => iface.getFunction(name).selector)
  );
  return getSelectors(contract).filter((s) => !excluded.has(s));
}

/**
 * Get selectors for only specific function names
 * @param {Contract} contract
 * @param {string[]} functionNames
 * @returns {string[]}
 */
function getSelectorsOnly(contract, functionNames) {
  const iface = contract.interface;
  return functionNames.map((name) => iface.getFunction(name).selector);
}

/**
 * Remove selectors that already exist on the diamond
 * @param {string[]} selectors
 * @param {Contract} loupe - DiamondLoupeFacet at diamond address
 * @returns {Promise<string[]>}
 */
async function filterNewSelectors(selectors, loupe) {
  const newSelectors = [];
  for (const sel of selectors) {
    const addr = await loupe.facetAddress(sel);
    if (addr === ethers.ZeroAddress) {
      newSelectors.push(sel);
    }
  }
  return newSelectors;
}

// ============================================================
//                    DEPLOYMENT UTILS
// ============================================================

/**
 * Deploy a contract and log its address
 * @param {string} contractName
 * @param {...any} constructorArgs
 * @returns {Promise<Contract>}
 */
async function deployContract(contractName, ...constructorArgs) {
  const Factory = await ethers.getContractFactory(contractName);
  const contract = await Factory.deploy(...constructorArgs);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`  ✓ ${contractName} deployed at: ${addr}`);
  return contract;
}

/**
 * Deploy a facet and perform a diamond cut to add it
 * @param {string} diamondAddress
 * @param {string} facetName
 * @param {string[]} [excludeSelectors] - Selectors to exclude (for dedup)
 * @returns {Promise<{facet: Contract, selectors: string[]}>}
 */
async function deployAndCutFacet(
  diamondAddress,
  facetName,
  excludeSelectors = []
) {
  const facet = await deployContract(facetName);
  let selectors = getSelectors(facet);

  // Remove excluded selectors (duplicates from other facets)
  if (excludeSelectors.length > 0) {
    const excludeSet = new Set(excludeSelectors);
    selectors = selectors.filter((s) => !excludeSet.has(s));
  }

  if (selectors.length === 0) {
    console.log(`  ⚠ ${facetName}: no new selectors to add (all duplicates)`);
    return { facet, selectors: [] };
  }

  const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
  const tx = await diamondCut.diamondCut(
    [
      {
        facetAddress: await facet.getAddress(),
        action: FacetCutAction.Add,
        functionSelectors: selectors,
      },
    ],
    ethers.ZeroAddress,
    "0x"
  );
  await tx.wait();
  console.log(
    `  ✓ ${facetName}: ${selectors.length} selectors added to diamond`
  );

  return { facet, selectors };
}

/**
 * Perform a batch diamond cut for multiple facets at once
 * @param {string} diamondAddress
 * @param {Array<{facetAddress: string, selectors: string[]}>} facets
 */
async function batchDiamondCut(diamondAddress, facets) {
  const cuts = facets
    .filter((f) => f.selectors.length > 0)
    .map((f) => ({
      facetAddress: f.facetAddress,
      action: FacetCutAction.Add,
      functionSelectors: f.selectors,
    }));

  if (cuts.length === 0) {
    console.log("  ⚠ No selectors to add in batch cut");
    return;
  }

  const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
  const tx = await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");
  await tx.wait();

  const totalSelectors = cuts.reduce(
    (sum, c) => sum + c.functionSelectors.length,
    0
  );
  console.log(
    `  ✓ Batch cut: ${cuts.length} facets, ${totalSelectors} selectors added`
  );
}

// ============================================================
//                  MANIFEST / STATE FILE
// ============================================================

/**
 * Load deployment manifest for the given network
 * @param {string} network
 * @returns {object}
 */
function loadDeployment(network) {
  const filePath = getDeploymentPath(network);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  return {
    network,
    diamondAddress: null,
    facets: {},
    contracts: {},
    timestamp: null,
  };
}

/**
 * Save deployment manifest
 * @param {string} network
 * @param {object} data
 */
function saveDeployment(network, data) {
  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  }
  data.timestamp = new Date().toISOString();
  const filePath = getDeploymentPath(network);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`\n  💾 Deployment saved to: ${filePath}`);
}

/**
 * Record a facet deployment in the manifest
 * @param {object} deployment - The deployment manifest object
 * @param {string} facetName
 * @param {string} address
 * @param {string[]} selectors
 */
function recordFacet(deployment, facetName, address, selectors) {
  deployment.facets[facetName] = {
    address,
    selectors,
    deployedAt: new Date().toISOString(),
  };
}

/**
 * Record a generic contract deployment
 * @param {object} deployment
 * @param {string} name
 * @param {string} address
 */
function recordContract(deployment, name, address) {
  deployment.contracts[name] = {
    address,
    deployedAt: new Date().toISOString(),
  };
}

// ============================================================
//                     VERIFICATION
// ============================================================

/**
 * Verify all facets are correctly registered on the diamond
 * @param {string} diamondAddress
 * @param {object} deployment
 */
async function verifyDiamondState(diamondAddress, deployment) {
  console.log("\n🔍 Verifying diamond state...");
  const loupe = await ethers.getContractAt(
    "DiamondLoupeFacet",
    diamondAddress
  );

  const facets = await loupe.facets();
  console.log(`  Total facets registered: ${facets.length}`);

  let totalSelectors = 0;
  for (const facet of facets) {
    totalSelectors += facet.functionSelectors.length;
  }
  console.log(`  Total function selectors: ${totalSelectors}`);

  // Verify each recorded facet
  for (const [name, info] of Object.entries(deployment.facets)) {
    const registeredSelectors = await loupe.facetFunctionSelectors(
      info.address
    );
    if (registeredSelectors.length > 0) {
      console.log(
        `  ✓ ${name}: ${registeredSelectors.length} selectors registered`
      );
    } else {
      console.log(`  ✗ ${name}: NO selectors found (may have been replaced)`);
    }
  }

  // Verify ownership
  const ownership = await ethers.getContractAt(
    "OwnershipFacet",
    diamondAddress
  );
  const owner = await ownership.owner();
  console.log(`  Diamond owner: ${owner}`);
}

// ============================================================
//                      EXPORTS
// ============================================================

module.exports = {
  FacetCutAction,
  getSelectors,
  getSelectorsExcept,
  getSelectorsOnly,
  filterNewSelectors,
  deployContract,
  deployAndCutFacet,
  batchDiamondCut,
  loadDeployment,
  saveDeployment,
  recordFacet,
  recordContract,
  verifyDiamondState,
};
