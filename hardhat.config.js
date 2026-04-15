require("@nomicfoundation/hardhat-toolbox");
require("dotenv/config");
require("solidity-docgen");

const optionalPlugins = [
  "hardhat-gas-reporter",
  "solidity-coverage",
  "slither",
  "hardhat-deploy",
  "hardhat-ethers",
  "hardhat-waffle",
  "hardhat-contract-sizer",
  "hardhat-abi-exporter",
];

for (const plugin of optionalPlugins) {
  try {
    require(plugin);
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
  }
}
// Retrieve the private key and API keys from the .env file
const privateKey = process.env.PRIVATE_KEY;


// Check if the private key is set
if (!privateKey) {
  console.warn("🚨 WARNING: PRIVATE_KEY is not set in the .env file. Deployments will not be possible.");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true, // Enable IR-based code generator to fix "Stack too deep" errors
        },
      },
      {
        version: "0.8.21",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      {
        version: "0.8.27",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      }
    ]
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  networks: {
    'paxeer-network': {
      url: 'http://89.117.147.196:8545',
      accounts: privateKey ? [privateKey] : [],
    },
  },
  etherscan: {
    apiKey: {
      'paxeer-network': 'empty'
    },
    customChains: [
      {
        network: "paxeer-network",
        chainId: 125,
        urls: {
          apiURL: "https://api.paxscan.io/api",
          browserURL: "https://paxscan.paxeer.app"
        }
      }
    ]
  },
  docgen: {
    path: "docs",
    clear: true,
    runOnCompile: true,
    except: ["test/**", "mocks/**", "lib/**"],
    pages: "files",
    template: "hardhat",
    outputDir: "docs",
  },
};