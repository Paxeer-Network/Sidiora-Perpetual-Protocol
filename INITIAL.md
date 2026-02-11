# INITIAL.md -- Project Genesis

## Origin

The Sidiora Perpetual Protocol was conceived as the core trading engine for Paxeer Network, a purpose-built EVM chain (chain ID 125). The goal was straightforward: build a synthetic perpetual futures platform that could handle crypto, real-world assets, equities, and indexes -- all from a single smart contract address.

## Design philosophy

Three principles guided every decision:

1. **Zero external dependencies.** Every line of Solidity was written from scratch. No OpenZeppelin, no diamond libraries, no imported math utilities. This increases the audit surface, but it also means the team understands every byte of deployed code.

2. **Isolation by default.** User funds sit in personal vault contracts, not in a shared pool. The central vault only holds funds that are actively backing positions. Idle capital is never at risk from a central vault exploit.

3. **Simplicity over cleverness.** Net mode (one direction per market per user) instead of hedge mode. Per-second funding that settles automatically instead of a separate keeper. Protocol-funded liquidity instead of complex LP tokenomics.

## Timeline

| Date | Milestone |
|------|-----------|
| 2026-02-11 | Architecture finalized. All design decisions locked. |
| 2026-02-11 | Smart contracts implemented (19 facets, 10 libraries). |
| 2026-02-11 | Deployed to Paxeer Network. All contracts verified on Paxscan. |
| 2026-02-11 | Oracle node, event indexer, and TypeScript SDK operational. |

## Key decisions and why

**Why EIP-2535 Diamond?**
The protocol has 19 distinct functional modules. A standard proxy pattern would require multiple proxy contracts or a monolithic implementation. The Diamond pattern lets us deploy everything behind one address, upgrade individual pieces without migrating state, and keep each module focused.

**Why no external LPs?**
At launch, the network itself funds the central vault. This eliminates LP tokenomics complexity, impermanent loss concerns, and the cold-start liquidity problem. The protocol can always add external LP mechanics later via a new facet.

**Why per-user vaults?**
If the central vault were exploited, only actively-locked collateral would be at risk. Idle user funds would be safe in their own contracts. This is a meaningful security improvement over single-vault designs.

**Why custom oracle instead of Chainlink/Pyth on-chain?**
Paxeer Network does not have native Chainlink or Pyth contracts. Instead, an off-chain node fetches from Pyth Hermes and posts prices on-chain. This gives us full control over update frequency, gas costs, and data format.

**Why net mode instead of hedge mode?**
Hedge mode (simultaneous long and short on the same asset) adds significant complexity to PnL calculation, funding settlement, and liquidation logic. Net mode keeps things clean: one position per market per user. Traders who want to hedge can use a different wallet or a different market.
