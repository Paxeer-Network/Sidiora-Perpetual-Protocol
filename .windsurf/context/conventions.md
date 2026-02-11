# Code Conventions

> **Blockchain Development Standards** - Follow these patterns for consistency

## Solidity Style Guide

### Contract Structure
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 1. Imports (OpenZeppelin first, then local)
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IMyContract.sol";

// 2. Interfaces (if small, otherwise separate file)

// 3. Libraries

// 4. Errors (custom errors preferred over require strings)
error InsufficientBalance(uint256 available, uint256 required);

// 5. Contract
/// @title MyContract
/// @author [Author]
/// @notice [User-facing description]
/// @dev [Technical notes]
contract MyContract is ERC20, ReentrancyGuard {
    // 5a. Type declarations
    using SafeMath for uint256;
    
    // 5b. State variables
    uint256 public constant MAX_SUPPLY = 1_000_000 * 10**18;
    address public immutable treasury;
    mapping(address => uint256) private _balances;
    
    // 5c. Events
    event Deposited(address indexed user, uint256 amount);
    
    // 5d. Modifiers
    modifier onlyPositive(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        _;
    }
    
    // 5e. Constructor
    constructor(address _treasury) ERC20("Token", "TKN") {
        treasury = _treasury;
    }
    
    // 5f. External functions
    // 5g. Public functions
    // 5h. Internal functions
    // 5i. Private functions
    // 5j. View/Pure functions (external then public then internal)
}
```

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Contract | PascalCase | `StakingRewards` |
| Interface | IPascalCase | `IStakingRewards` |
| Library | PascalCase | `SafeMath` |
| Function | camelCase | `withdrawRewards()` |
| Variable | camelCase | `rewardRate` |
| Constant | UPPER_SNAKE | `MAX_SUPPLY` |
| Immutable | camelCase | `treasury` |
| Private | _prefixed | `_balances` |
| Event | PascalCase | `RewardsPaid` |
| Error | PascalCase | `InsufficientBalance` |

### Security Patterns

**Checks-Effects-Interactions (CEI)**
```solidity
function withdraw(uint256 amount) external {
    // 1. CHECKS
    require(amount <= balances[msg.sender], "Insufficient");
    
    // 2. EFFECTS
    balances[msg.sender] -= amount;
    
    // 3. INTERACTIONS
    (bool success,) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

**Access Control**
```solidity
// Use OpenZeppelin's Ownable or AccessControl
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
```

**Reentrancy Protection**
```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

function riskyFunction() external nonReentrant {
    // ...
}
```

## JavaScript/TypeScript Conventions

### Test File Structure
```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ContractName", function () {
    // Fixture for deployment
    async function deployFixture() {
        const [owner, user1, user2] = await ethers.getSigners();
        const Contract = await ethers.getContractFactory("ContractName");
        const contract = await Contract.deploy();
        return { contract, owner, user1, user2 };
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const { contract, owner } = await loadFixture(deployFixture);
            expect(await contract.owner()).to.equal(owner.address);
        });
    });

    describe("Functionality", function () {
        it("Should [behavior description]", async function () {
            // Arrange
            const { contract, user1 } = await loadFixture(deployFixture);
            
            // Act
            await contract.connect(user1).someFunction();
            
            // Assert
            expect(await contract.value()).to.equal(expected);
        });
    });
});
```

### Script Structure
```javascript
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);
    
    // Deploy
    const Contract = await ethers.getContractFactory("ContractName");
    const contract = await Contract.deploy();
    await contract.waitForDeployment();
    
    const address = await contract.getAddress();
    console.log("Deployed to:", address);
    
    // Verify (if not local)
    if (network.name !== "hardhat" && network.name !== "localhost") {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: [],
        });
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
```

## Git Conventions

### Branch Names
- `feat/contract-name` - New contracts
- `fix/vulnerability-name` - Security fixes
- `test/contract-coverage` - Test additions
- `refactor/gas-optimization` - Optimizations
- `docs/natspec-update` - Documentation

### Commit Messages
```
feat: add staking rewards contract
fix: resolve reentrancy in withdraw
test: add edge case tests for deposit
refactor: optimize gas in swap function
docs: add NatSpec to all public functions
```

## Documentation Requirements

### NatSpec (Required for all public/external)
```solidity
/// @notice Deposits tokens into the pool
/// @dev Emits Deposited event. Requires approval.
/// @param amount The amount of tokens to deposit
/// @return shares The number of pool shares minted
function deposit(uint256 amount) external returns (uint256 shares);
```

### README Requirements
- [ ] Project description
- [ ] Installation instructions
- [ ] Testing commands
- [ ] Deployment instructions
- [ ] Contract addresses (mainnet/testnet)
- [ ] Security considerations
- [ ] License
