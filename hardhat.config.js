require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv/config"); // Import and configure dotenv

// Retrieve the private key and API keys from the .env file
const privateKey = process.env.PRIVATE_KEY;

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
paths: {
    tests: "./tests",
  },
networks: {
    'paxeer-network': {
      url: 'https://public-rpc.paxeer.app/rpc',
      accounts: privateKey ? [privateKey] : [] // <-- ADD THIS LINE
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
          apiURL: "https://paxscan.paxeer.app/api",
          browserURL: "https://paxscan.paxeer.app"
        }
      }
    ]
  }
};