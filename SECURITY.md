# Security Policy

## Reporting vulnerabilities

If you discover a security vulnerability in the Sidiora Perpetual Protocol, please report it responsibly. Do not open a public GitHub issue.

**Email:** [security@paxeer.app](mailto:security@paxeer.app)

Include the following in your report:

- A clear description of the vulnerability
- Steps to reproduce the issue
- The affected contract(s), function(s), or component(s)
- Your assessment of severity and potential impact
- Any suggested fix (optional but appreciated)

## Response timeline

| Stage | Target |
|-------|--------|
| Acknowledgment | Within 24 hours |
| Initial assessment | Within 72 hours |
| Fix deployed (critical) | Within 7 days |
| Fix deployed (high) | Within 14 days |
| Public disclosure | After fix is deployed and verified |

## Scope

The following components are in scope for security reports:

| Component | Location | Priority |
|-----------|----------|----------|
| Diamond proxy and all facets | `contracts/diamond/` | Critical |
| UserVault | `contracts/vaults/UserVault.sol` | Critical |
| Internal libraries | `contracts/diamond/libraries/` | Critical |
| Oracle node | `.oracle/` | High |
| Event indexer | `.indexer/` | Medium |
| TypeScript SDK | `sdk/` | Medium |
| Deployment scripts | `scripts/` | Low |

## Out of scope

- Issues in third-party dependencies not maintained by PaxLabs
- Issues that require physical access to a server running the oracle or indexer
- Social engineering attacks
- Denial of service on public RPC endpoints not operated by PaxLabs

## Known considerations

The protocol is designed for up to 1000x leverage. This means:

- A 0.1% adverse price move at 1000x wipes out a position. This is by design.
- Oracle latency (up to 60 seconds between updates) is a known trade-off. Off-chain keepers use real-time feeds for liquidation detection.
- The protocol has zero external Solidity dependencies. The entire attack surface is custom code.
- There is no multi-sig or timelock. The network owner has direct admin control. This is a deliberate choice for a network-level protocol.

## Bug bounty

A formal bug bounty program will be announced separately. In the meantime, valid security reports that lead to meaningful fixes will be rewarded at the discretion of PaxLabs.

## Verification

All contracts are verified on Paxscan:
[https://paxscan.paxeer.app/address/0xeA65FE02665852c615774A3041DFE6f00fb77537](https://paxscan.paxeer.app/address/0xeA65FE02665852c615774A3041DFE6f00fb77537)
