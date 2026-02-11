export const PositionFacetAbi = [
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
        name: 'closedSizeUsd',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'exitPrice',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'int256',
        name: 'realizedPnl',
        type: 'int256',
      },
      {
        indexed: false,
        internalType: 'bool',
        name: 'isFullClose',
        type: 'bool',
      },
    ],
    name: 'PositionClosed',
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
        indexed: false,
        internalType: 'uint256',
        name: 'newSizeUsd',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'newCollateralUsd',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'newCollateralAmount',
        type: 'uint256',
      },
    ],
    name: 'PositionModified',
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
        internalType: 'bool',
        name: 'isLong',
        type: 'bool',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'sizeUsd',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'leverage',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'entryPrice',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'collateralToken',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'collateralAmount',
        type: 'uint256',
      },
    ],
    name: 'PositionOpened',
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
        name: '_amount',
        type: 'uint256',
      },
    ],
    name: 'addCollateral',
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
      {
        internalType: 'uint256',
        name: '_additionalCollateral',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_leverage',
        type: 'uint256',
      },
    ],
    name: 'addSize',
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
    name: 'closePosition',
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
    name: 'getOpenInterest',
    outputs: [
      {
        internalType: 'uint256',
        name: 'longOI',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'shortOI',
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
    name: 'getPosition',
    outputs: [
      {
        internalType: 'address',
        name: 'user',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'marketId',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: 'isLong',
        type: 'bool',
      },
      {
        internalType: 'uint256',
        name: 'sizeUsd',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'collateralUsd',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'collateralToken',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'collateralAmount',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'entryPrice',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'timestamp',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: 'active',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_user',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_marketId',
        type: 'uint256',
      },
    ],
    name: 'getUserMarketPosition',
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
        internalType: 'address',
        name: '_user',
        type: 'address',
      },
    ],
    name: 'getUserPositionIds',
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
    inputs: [
      {
        internalType: 'uint256',
        name: '_marketId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_collateralToken',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_collateralAmount',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_leverage',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: '_isLong',
        type: 'bool',
      },
    ],
    name: 'openPosition',
    outputs: [
      {
        internalType: 'uint256',
        name: 'positionId',
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
        name: '_positionId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_closeSizeUsd',
        type: 'uint256',
      },
    ],
    name: 'partialClose',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
