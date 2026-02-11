<p align="center">
  <img src="https://img.shields.io/badge/Network-Paxeer_Mainnet-00B4D8?style=for-the-badge" alt="Paxeer" />
  <img src="https://img.shields.io/badge/Chain_ID-125-blue?style=for-the-badge" alt="Chain ID" />
  <img src="https://img.shields.io/badge/Contracts-20-3C3C3D?style=for-the-badge" alt="Contracts" />
  <img src="https://img.shields.io/badge/Verified-Paxscan-brightgreen?style=for-the-badge" alt="Verified" />
</p>

# Deployment

<a href="./README.md"><img src="https://img.shields.io/badge/Back_to-Index-grey?style=flat-square" alt="Back" /></a>

All contracts are deployed on Paxeer Network (EVM-compatible, chain ID 125) and verified on Paxscan. The entire protocol is accessed through a single Diamond proxy address. Individual facet implementation contracts are listed for reference and verification purposes only -- you should never call them directly.

---

## Table of contents

- [Network configuration](#network-configuration)
- [Diamond proxy](#diamond-proxy)
- [Deployed addresses](#deployed-addresses)
- [Verification](#verification)
- [Deployment scripts](#deployment-scripts)
- [Upgrade process](#upgrade-process)

---

## Network configuration

| Property | Value |
|----------|-------|
| **Network name** | Paxeer Mainnet |
| **Chain ID** | `125` |
| **RPC endpoint** | `https://public-rpc.paxeer.app/rpc` |
| **Block explorer** | [paxscan.paxeer.app](https://paxscan.paxeer.app) |
| **Native currency** | PAX |
| **Solidity compiler** | ^0.8.27 (optimizer enabled, viaIR) |

### Adding to a wallet

To add Paxeer Network to MetaMask or any EVM wallet:

| Field | Value |
|-------|-------|
| Network Name | Paxeer Mainnet |
| RPC URL | `https://public-rpc.paxeer.app/rpc` |
| Chain ID | `125` |
| Currency Symbol | PAX |
| Block Explorer | `https://paxscan.paxeer.app` |

---

## Diamond proxy

The Diamond proxy is the single entry point for the entire protocol. All user interactions, frontend calls, and keeper transactions go through this address.

<table>
<tr>
<td><strong>Diamond Proxy</strong></td>
<td><code>0xeA65FE02665852c615774A3041DFE6f00fb77537</code></td>
<td><a href="https://paxscan.paxeer.app/address/0xeA65FE02665852c615774A3041DFE6f00fb77537#code"><img src="https://img.shields.io/badge/View_on-Paxscan-brightgreen?style=flat-square" alt="Paxscan" /></a></td>
</tr>
</table>

---

## Deployed addresses

### Diamond Core

| Contract | Implementation Address | Explorer |
|----------|----------------------|----------|
| **DiamondCutFacet** | `0x8af7E829E2061Cb2353CCce3cf99b00e6ca4DC3B` | <a href="https://paxscan.paxeer.app/address/0x8af7E829E2061Cb2353CCce3cf99b00e6ca4DC3B#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **DiamondLoupeFacet** | `0x425Bcb17F3e3679fC5fE001d3707BDC3ED76c3a1` | <a href="https://paxscan.paxeer.app/address/0x425Bcb17F3e3679fC5fE001d3707BDC3ED76c3a1#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **OwnershipFacet** | `0xDD0C64553e792120B04727b9Eb2e97c8cd67F387` | <a href="https://paxscan.paxeer.app/address/0xDD0C64553e792120B04727b9Eb2e97c8cd67F387#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **AccessControlFacet** | `0x71E10DB0c468BF682EA744F11C4A29b10E18FDEd` | <a href="https://paxscan.paxeer.app/address/0x71E10DB0c468BF682EA744F11C4A29b10E18FDEd#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **PausableFacet** | `0xDc72b3dC885C5b8816456FcF9EFda7aD5625ABf8` | <a href="https://paxscan.paxeer.app/address/0xDc72b3dC885C5b8816456FcF9EFda7aD5625ABf8#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |

### Vault & Collateral

| Contract | Implementation Address | Explorer |
|----------|----------------------|----------|
| **VaultFactoryFacet** | `0x54F4D455a8f47dFD2C6f252d0EdEEdDFfEe252B4` | <a href="https://paxscan.paxeer.app/address/0x54F4D455a8f47dFD2C6f252d0EdEEdDFfEe252B4#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **CentralVaultFacet** | `0xd09b87f5790C29fB3D25D642E7E681d722e2Be6A` | <a href="https://paxscan.paxeer.app/address/0xd09b87f5790C29fB3D25D642E7E681d722e2Be6A#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **CollateralFacet** | `0x26D0BEE6F9249dD3d098288a74f7b026929dD6BD` | <a href="https://paxscan.paxeer.app/address/0x26D0BEE6F9249dD3d098288a74f7b026929dD6BD#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |

### Trading Engine

| Contract | Implementation Address | Explorer |
|----------|----------------------|----------|
| **PositionFacet** | `0xD0f2448eF25427cd1555811f73D1d8d2FAbCf74e` | <a href="https://paxscan.paxeer.app/address/0xD0f2448eF25427cd1555811f73D1d8d2FAbCf74e#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **OrderBookFacet** | `0xd2ff3a1684B970750b7FB912b6293C0842554eb4` | <a href="https://paxscan.paxeer.app/address/0xd2ff3a1684B970750b7FB912b6293C0842554eb4#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **LiquidationFacet** | `0xfB1Efb83568635d5fBC1C572F5Cb03FF8fF81982` | <a href="https://paxscan.paxeer.app/address/0xfB1Efb83568635d5fBC1C572F5Cb03FF8fF81982#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **FundingRateFacet** | `0x3B13193149142ee25926DfAe5C169D36f8EfDf0c` | <a href="https://paxscan.paxeer.app/address/0x3B13193149142ee25926DfAe5C169D36f8EfDf0c#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |

### Pricing Layer

| Contract | Implementation Address | Explorer |
|----------|----------------------|----------|
| **OracleFacet** | `0x8699dE864496A7Af1F73540262FAA9eD561D7d0F` | <a href="https://paxscan.paxeer.app/address/0x8699dE864496A7Af1F73540262FAA9eD561D7d0F#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **VirtualAMMFacet** | `0x460490264c76d8aE5739F0744e40160582dC7E17` | <a href="https://paxscan.paxeer.app/address/0x460490264c76d8aE5739F0744e40160582dC7E17#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **PriceFeedFacet** | `0x08E967408a4Ee268FF11ab116BfE1D95F2484c61` | <a href="https://paxscan.paxeer.app/address/0x08E967408a4Ee268FF11ab116BfE1D95F2484c61#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |

### Support

| Contract | Implementation Address | Explorer |
|----------|----------------------|----------|
| **MarketRegistryFacet** | `0x2af1c76EC28F437B165594137f28d5A57Af1EEF3` | <a href="https://paxscan.paxeer.app/address/0x2af1c76EC28F437B165594137f28d5A57Af1EEF3#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **InsuranceFundFacet** | `0x830746A6b7b8989846d4B8848a12326d426Ed562` | <a href="https://paxscan.paxeer.app/address/0x830746A6b7b8989846d4B8848a12326d426Ed562#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |
| **QuoterFacet** | `0x5b1f999CC865b96a2DA2EF30BFAfe9E60A13083e` | <a href="https://paxscan.paxeer.app/address/0x5b1f999CC865b96a2DA2EF30BFAfe9E60A13083e#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |

### Standalone

| Contract | Address | Explorer |
|----------|---------|----------|
| **UserVault** (implementation) | `0x4195155D92451a47bF76987315DaEE499f1D7352` | <a href="https://paxscan.paxeer.app/address/0x4195155D92451a47bF76987315DaEE499f1D7352#code"><img src="https://img.shields.io/badge/Verify-Paxscan-brightgreen?style=flat-square" alt="Verify" /></a> |

Individual user vault clones are deployed at deterministic addresses via CREATE2. They are not listed here because each user gets a unique clone address.

---

## Verification

All contracts are verified on Paxscan. Source code, compiler settings, and constructor arguments are publicly visible.

**Compiler settings used for verification:**

| Setting | Value |
|---------|-------|
| Solidity version | 0.8.27 |
| Optimizer | Enabled (200 runs) |
| viaIR | Enabled |
| EVM version | Default (Shanghai) |

To verify a contract independently:

```bash
npx hardhat verify --network paxeer-network <CONTRACT_ADDRESS>
```

The verification script in the repository can verify all contracts at once:

```bash
node scripts/verify-contracts.js
```

This reads addresses from the deployment manifest at `deployments/paxeer-network.json` and submits verification requests to the Paxscan API.

---

## Deployment scripts

The protocol is deployed through a series of numbered scripts that run sequentially:

| Script | What it deploys |
|--------|----------------|
| `01-deploy-diamond.js` | Diamond proxy + core facets (DiamondCut, DiamondLoupe, Ownership) |
| `02-deploy-trading-facets.js` | PositionFacet, OrderBookFacet, LiquidationFacet, FundingRateFacet |
| `03-deploy-pricing-facets.js` | OracleFacet, VirtualAMMFacet, PriceFeedFacet |
| `04-deploy-support-facets.js` | AccessControlFacet, PausableFacet, VaultFactoryFacet, CentralVaultFacet, CollateralFacet, MarketRegistryFacet, InsuranceFundFacet, QuoterFacet |
| `05-deploy-uservault-impl.js` | UserVault implementation + registers with VaultFactory |
| `06-initialize-protocol.js` | Grants roles, whitelists collateral, sets fees, creates markets, initializes vAMM pools |
| `07-whitelist-collateral.js` | Whitelists USID, USDC, USDT, USDL |

To run a full deployment:

```bash
node scripts/deploy/deploy-all.js --network paxeer-network
```

Or run individual steps:

```bash
npx hardhat run scripts/deploy/01-deploy-diamond.js --network paxeer-network
npx hardhat run scripts/deploy/02-deploy-trading-facets.js --network paxeer-network
# ... and so on
```

Each script writes its results to `deployments/paxeer-network.json` for the next step to pick up.

---

## Upgrade process

Individual facets can be upgraded without migrating state. The upgrade script supports three modes:

| Mode | What it does |
|------|-------------|
| `REPLACE` | Replaces existing selectors with a new facet implementation |
| `ADD_NEW` | Adds new selectors from the updated facet (keeps existing ones) |
| `FULL` | Removes all old selectors and adds all new ones |

```bash
node scripts/upgrade/upgrade-facet.js \
  --facet PositionFacet \
  --mode REPLACE \
  --network paxeer-network
```

The script also supports a `--dry-run` flag that simulates the `diamondCut()` transaction without broadcasting it.

Upgrades are owner-only operations. The network owner (Paxeer) controls the Diamond through the `DIAMOND_OWNER` role.

---

## Deployment manifest

The full deployment manifest is stored at `deployments/paxeer-network.json`. It contains:

- All contract addresses
- Function selectors registered to each facet
- Deployment timestamps
- Transaction hashes

This file is consumed by the verification script, the upgrade script, and the SDK generator.

---

<p align="center">
  <a href="./sdk-reference.md"><img src="https://img.shields.io/badge/%E2%86%90_SDK_Reference-grey?style=for-the-badge" alt="Previous" /></a>
  &nbsp;
  <a href="./README.md"><img src="https://img.shields.io/badge/Back_to_Index-4A90D9?style=for-the-badge" alt="Index" /></a>
</p>
