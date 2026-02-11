export const LiquidationFacetAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'positionId',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'deleveragedSizeUsd',
        type: 'uint256',
      },
    ],
    name: 'ADLExecuted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'positionId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'user',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: 'marketId',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'liquidationPrice',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'penalty',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'keeper',
        type: 'address',
      },
    ],
    name: 'Liquidation',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_deleverageSize',
        type: 'uint256',
      },
    ],
    name: 'autoDeleverage',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
    ],
    name: 'checkLiquidatable',
    outputs: [
      {
        internalType: 'bool',
        name: 'liquidatable',
        type: 'bool',
      },
      {
        internalType: 'uint256',
        name: 'marginBps',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
    ],
    name: 'liquidate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
