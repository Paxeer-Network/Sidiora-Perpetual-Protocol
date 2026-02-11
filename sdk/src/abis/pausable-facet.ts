export const PausableFacetAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'by',
        type: 'address',
      },
    ],
    name: 'GlobalPaused',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'by',
        type: 'address',
      },
    ],
    name: 'GlobalUnpaused',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'marketId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'by',
        type: 'address',
      },
    ],
    name: 'MarketPaused',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'marketId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'by',
        type: 'address',
      },
    ],
    name: 'MarketUnpaused',
    type: 'event',
  },
  {
    inputs: [],
    name: 'isGlobalPaused',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_marketId',
        type: 'uint256',
      },
    ],
    name: 'isMarketPaused',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pauseGlobal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_marketId',
        type: 'uint256',
      },
    ],
    name: 'pauseMarket',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'unpauseGlobal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_marketId',
        type: 'uint256',
      },
    ],
    name: 'unpauseMarket',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
