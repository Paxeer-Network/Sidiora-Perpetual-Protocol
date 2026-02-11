export const MarketRegistryFacetAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'takerFeeBps',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'makerFeeBps',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'liquidationFeeBps',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'insuranceFeeBps',
        type: 'uint256',
      },
    ],
    name: 'FeesUpdated',
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
        indexed: false,
        internalType: 'string',
        name: 'name',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'symbol',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'maxLeverage',
        type: 'uint256',
      },
    ],
    name: 'MarketCreated',
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
    ],
    name: 'MarketDisabled',
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
    ],
    name: 'MarketEnabled',
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
    ],
    name: 'MarketUpdated',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'string',
        name: '_name',
        type: 'string',
      },
      {
        internalType: 'string',
        name: '_symbol',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: '_maxLeverage',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_maintenanceMarginBps',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_maxOpenInterest',
        type: 'uint256',
      },
    ],
    name: 'createMarket',
    outputs: [
      {
        internalType: 'uint256',
        name: 'marketId',
        type: 'uint256',
      },
    ],
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
    name: 'disableMarket',
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
    name: 'enableMarket',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getActiveMarketIds',
    outputs: [
      {
        internalType: 'uint256[]',
        name: '',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getFees',
    outputs: [
      {
        internalType: 'uint256',
        name: 'takerFeeBps',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'makerFeeBps',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'liquidationFeeBps',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'insuranceFeeBps',
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
        name: '_marketId',
        type: 'uint256',
      },
    ],
    name: 'getMarket',
    outputs: [
      {
        internalType: 'string',
        name: 'name',
        type: 'string',
      },
      {
        internalType: 'string',
        name: 'symbol',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: 'maxLeverage',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'maintenanceMarginBps',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'maxOpenInterest',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: 'enabled',
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
    name: 'isMarketActive',
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
        name: '_takerFeeBps',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_makerFeeBps',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_liquidationFeeBps',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_insuranceFeeBps',
        type: 'uint256',
      },
    ],
    name: 'setFees',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalMarkets',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
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
        name: '_marketId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_maxLeverage',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_maintenanceMarginBps',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_maxOpenInterest',
        type: 'uint256',
      },
    ],
    name: 'updateMarket',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
