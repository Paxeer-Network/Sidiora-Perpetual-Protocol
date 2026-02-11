# Architecture Guide

> **Smart Contract Architecture Patterns** - Reference for design decisions

## Contract Architecture Patterns

### 1. Single Contract
Best for: Simple tokens, basic functionality
```
┌─────────────────────┐
│    MyContract.sol   │
│  - All logic here   │
└─────────────────────┘
```

### 2. Interface Separation
Best for: External integrations, clear API
```
┌─────────────────────┐     ┌─────────────────────┐
│   IMyContract.sol   │◄────│    MyContract.sol   │
│   (interface)       │     │   (implementation)  │
└─────────────────────┘     └─────────────────────┘
```

### 3. Library Pattern
Best for: Shared logic, gas optimization
```
┌─────────────────────┐
│    MathLib.sol      │
│    (library)        │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
┌───────┐   ┌───────┐
│ Pool1 │   │ Pool2 │
└───────┘   └───────┘
```

### 4. Factory Pattern
Best for: Multiple deployments (pools, pairs)
```
┌─────────────────────┐
│     Factory.sol     │──── Creates ────┐
└─────────────────────┘                 │
                                        ▼
                              ┌─────────────────┐
                              │   Pool Clone    │
                              │   Pool Clone    │
                              │   Pool Clone    │
                              └─────────────────┘
```

### 5. Proxy Pattern (Upgradeable)
Best for: Long-lived protocols, bug fixes
```
┌─────────────────────┐     ┌─────────────────────┐
│       Proxy         │────▶│   Implementation    │
│  (storage here)     │     │   (logic here)      │
└─────────────────────┘     └─────────────────────┘
                                     │
                                     │ upgrade
                                     ▼
                            ┌─────────────────────┐
                            │ Implementation V2   │
                            └─────────────────────┘
```

### 6. Diamond Pattern (EIP-2535)
Best for: Large protocols, modular features
```
┌─────────────────────────────────────────────┐
│                  Diamond                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Facet A │ │ Facet B │ │ Facet C │       │
│  │ (swap)  │ │ (stake) │ │ (gov)   │       │
│  └─────────┘ └─────────┘ └─────────┘       │
└─────────────────────────────────────────────┘
```

## DeFi Architecture Patterns

### AMM/DEX
```
┌─────────────────────────────────────────────────────────────┐
│                         AMM Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                      ┌─────────────┐      │
│  │   Factory   │──── creates ────────▶│    Pair     │      │
│  └─────────────┘                      └─────────────┘      │
│         │                                    │              │
│         │                                    │              │
│         ▼                                    ▼              │
│  ┌─────────────┐                      ┌─────────────┐      │
│  │   Router    │──── routes via ─────▶│   Oracle    │      │
│  └─────────────┘                      └─────────────┘      │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │    User     │                                           │
│  └─────────────┘                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Lending Protocol
```
┌─────────────────────────────────────────────────────────────┐
│                    Lending Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │
│  │    Pool     │◄───▶│ Interest    │◄───▶│   Oracle    │  │
│  │  Manager    │     │   Model     │     │  (Chainlink)│  │
│  └─────────────┘     └─────────────┘     └─────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐     ┌─────────────┐                       │
│  │   aToken    │     │   Debt      │                       │
│  │  (receipt)  │     │   Token     │                       │
│  └─────────────┘     └─────────────┘                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Governance
```
┌─────────────────────────────────────────────────────────────┐
│                   Governance Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │
│  │    Token    │────▶│  Governor   │────▶│  Timelock   │  │
│  │   (votes)   │     │ (proposals) │     │   (delay)   │  │
│  └─────────────┘     └─────────────┘     └─────────────┘  │
│                             │                    │         │
│                             │                    ▼         │
│                             │            ┌─────────────┐  │
│                             │            │   Target    │  │
│                             │            │  Contracts  │  │
│                             │            └─────────────┘  │
│                             ▼                              │
│                      ┌─────────────┐                       │
│                      │   Voters    │                       │
│                      └─────────────┘                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Storage Patterns

### Packed Storage
```solidity
// BAD: Each uses full slot
uint256 a;  // Slot 0
uint256 b;  // Slot 1
uint128 c;  // Slot 2
uint128 d;  // Slot 3

// GOOD: Packed into fewer slots
uint256 a;  // Slot 0
uint256 b;  // Slot 1
uint128 c;  // Slot 2 (first half)
uint128 d;  // Slot 2 (second half)
```

### Mapping vs Array
```solidity
// Use mapping for: Random access, sparse data
mapping(address => uint256) public balances;

// Use array for: Iteration needed, dense data
address[] public stakers;
```

## Upgrade Patterns

### UUPS (Recommended)
```solidity
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract MyContract is UUPSUpgradeable {
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

### Transparent Proxy
```solidity
// Deploy with OpenZeppelin Hardhat Upgrades
const { deployProxy } = require('@openzeppelin/hardhat-upgrades');
const contract = await deployProxy(Contract, [args], { kind: 'transparent' });
```

## Access Control Patterns

### Simple (Ownable)
```solidity
import "@openzeppelin/contracts/access/Ownable.sol";
contract MyContract is Ownable {
    function adminOnly() external onlyOwner {}
}
```

### Role-Based (AccessControl)
```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";
contract MyContract is AccessControl {
    bytes32 public constant ADMIN = keccak256("ADMIN");
    bytes32 public constant OPERATOR = keccak256("OPERATOR");
    
    function adminOnly() external onlyRole(ADMIN) {}
    function operatorOnly() external onlyRole(OPERATOR) {}
}
```

### Multi-Sig
```solidity
// Use Gnosis Safe or similar for critical operations
// Timelock + MultiSig = Strong governance
```
