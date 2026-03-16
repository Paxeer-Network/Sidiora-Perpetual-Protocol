const gql = require("graphql-tag");

const typeDefs = gql`
  scalar BigDecimal
  scalar DateTime

  # ============================================================
  #  MARKET
  # ============================================================

  type Market {
    marketId: Int!
    name: String!
    symbol: String!
    maxLeverage: BigDecimal!
    enabled: Boolean!
    createdAt: DateTime
    latestPrice: LatestPrice
    poolState: PoolState
    fundingRate: FundingRate
  }

  # ============================================================
  #  POSITION
  # ============================================================

  type Position {
    positionId: BigDecimal!
    userAddress: String!
    marketId: Int!
    isLong: Boolean!
    sizeUsd: BigDecimal!
    leverage: BigDecimal!
    entryPrice: BigDecimal!
    collateralToken: String
    collateralAmount: BigDecimal!
    collateralUsd: BigDecimal!
    status: String!
    realizedPnl: BigDecimal
    exitPrice: BigDecimal
    openedAt: DateTime
    closedAt: DateTime
    openBlock: Int
    closeBlock: Int
    openTxHash: String
    closeTxHash: String
    market: Market
  }

  # ============================================================
  #  TRADE
  # ============================================================

  type Trade {
    id: Int!
    positionId: BigDecimal!
    userAddress: String
    marketId: Int
    tradeType: String!
    isLong: Boolean
    sizeUsd: BigDecimal!
    price: BigDecimal!
    realizedPnl: BigDecimal
    feeUsd: BigDecimal
    blockNumber: Int!
    txHash: String!
    blockTimestamp: DateTime!
  }

  # ============================================================
  #  ORDER
  # ============================================================

  type Order {
    orderId: BigDecimal!
    userAddress: String!
    marketId: Int!
    orderType: Int!
    orderTypeName: String
    isLong: Boolean!
    triggerPrice: BigDecimal!
    sizeUsd: BigDecimal!
    status: String!
    positionId: BigDecimal
    executionPrice: BigDecimal
    failureReason: String
    placedAt: DateTime
    resolvedAt: DateTime
    placedBlock: Int
    resolvedBlock: Int
    placedTxHash: String
    resolvedTxHash: String
  }

  # ============================================================
  #  LIQUIDATION
  # ============================================================

  type Liquidation {
    id: Int!
    positionId: BigDecimal!
    userAddress: String!
    marketId: Int!
    price: BigDecimal!
    penalty: BigDecimal!
    keeper: String!
    blockNumber: Int!
    txHash: String!
    blockTimestamp: DateTime!
  }

  # ============================================================
  #  PRICE
  # ============================================================

  type PriceUpdate {
    id: Int!
    marketId: Int!
    price: BigDecimal!
    onchainTimestamp: Int!
    blockNumber: Int!
    txHash: String!
    blockTimestamp: DateTime!
  }

  type LatestPrice {
    marketId: Int!
    price: BigDecimal!
    onchainTimestamp: Int!
    blockNumber: Int!
    updatedAt: DateTime
  }

  # ============================================================
  #  FUNDING
  # ============================================================

  type FundingRate {
    id: Int!
    marketId: Int!
    ratePerSecond: BigDecimal!
    rate24h: BigDecimal!
    blockNumber: Int!
    txHash: String!
    blockTimestamp: DateTime!
  }

  # ============================================================
  #  VAULT
  # ============================================================

  type UserVault {
    userAddress: String!
    vaultAddress: String!
    createdAt: DateTime
    blockNumber: Int
    txHash: String
  }

  type VaultEvent {
    id: Int!
    eventType: String!
    userAddress: String
    tokenAddress: String!
    amount: BigDecimal!
    blockNumber: Int!
    txHash: String!
    logIndex: Int!
    blockTimestamp: DateTime!
  }

  # ============================================================
  #  COLLATERAL
  # ============================================================

  type CollateralToken {
    tokenAddress: String!
    decimals: Int!
    isActive: Boolean!
    addedAt: DateTime
  }

  # ============================================================
  #  POOL STATE (vAMM)
  # ============================================================

  type PoolState {
    marketId: Int!
    baseReserve: BigDecimal!
    quoteReserve: BigDecimal!
    oraclePrice: BigDecimal
    updatedAt: DateTime
    blockNumber: Int
  }

  # ============================================================
  #  FEE CONFIG
  # ============================================================

  type FeeConfig {
    takerFeeBps: Int!
    makerFeeBps: Int!
    liquidationFeeBps: Int!
    insuranceFeeBps: Int!
    updatedAt: DateTime
  }

  # ============================================================
  #  PROTOCOL EVENT
  # ============================================================

  type ProtocolEvent {
    id: Int!
    eventName: String!
    eventData: String!
    blockNumber: Int!
    txHash: String!
    logIndex: Int!
    blockTimestamp: DateTime!
  }

  # ============================================================
  #  INDEXER STATE
  # ============================================================

  type IndexerStatus {
    lastIndexedBlock: Int!
    chainHead: Int
    blocksScanned: Int
    eventsProcessed: Int
    isSynced: Boolean
  }

  # ============================================================
  #  KEEPER CYCLE (V2)
  # ============================================================

  type KeeperCycle {
    id: Int!
    onchainTimestamp: Int!
    marketsUpdated: Int!
    ordersExecuted: Int!
    liquidationsExecuted: Int!
    ordersFailed: Int!
    liquidationsFailed: Int!
    blockNumber: Int!
    txHash: String!
    blockTimestamp: DateTime!
  }

  # ============================================================
  #  ACCOUNT LEDGER (V2 — TradingAccount)
  # ============================================================

  type AccountLedgerEntry {
    id: Int!
    entryId: BigDecimal!
    userAddress: String!
    entryType: Int!
    tokenAddress: String!
    amount: BigDecimal!
    positionId: BigDecimal!
    isDebit: Boolean!
    blockNumber: Int!
    txHash: String!
    blockTimestamp: DateTime!
  }

  # ============================================================
  #  DELEGATE (V2 — TradingAccount)
  # ============================================================

  type Delegate {
    id: Int!
    userAddress: String!
    delegateAddress: String!
    canTrade: Boolean!
    canWithdraw: Boolean!
    canModifyMargin: Boolean!
    expiry: BigDecimal!
    isActive: Boolean!
    blockNumber: Int!
    txHash: String!
    blockTimestamp: DateTime!
  }

  # ============================================================
  #  TRADING ACCOUNT EVENT (V2)
  # ============================================================

  type TradingAccountEvent {
    id: Int!
    eventType: String!
    userAddress: String!
    positionId: BigDecimal
    tokenAddress: String
    amount: BigDecimal
    extraData: String
    blockNumber: Int!
    txHash: String!
    blockTimestamp: DateTime!
  }

  # ============================================================
  #  AGGREGATES
  # ============================================================

  type UserStats {
    userAddress: String!
    totalPositions: Int!
    openPositions: Int!
    closedPositions: Int!
    liquidatedPositions: Int!
    totalTrades: Int!
    totalRealizedPnl: BigDecimal!
    totalOrders: Int!
    activeOrders: Int!
  }

  type MarketStats {
    marketId: Int!
    symbol: String
    totalPositions: Int!
    openPositions: Int!
    totalTrades: Int!
    totalLiquidations: Int!
    totalVolume: BigDecimal!
    latestPrice: BigDecimal
    latestFundingRate: BigDecimal
  }

  type GlobalStats {
    totalMarkets: Int!
    totalPositions: Int!
    openPositions: Int!
    totalTrades: Int!
    totalLiquidations: Int!
    totalVolume: BigDecimal!
    totalUsers: Int!
    indexerBlock: Int!
  }

  # ============================================================
  #  QUERIES
  # ============================================================

  type Query {
    # Positions
    position(positionId: String!): Position
    positions(
      userAddress: String
      marketId: Int
      status: String
      limit: Int
      offset: Int
    ): [Position!]!

    # Trades
    trades(
      userAddress: String
      marketId: Int
      positionId: String
      tradeType: String
      limit: Int
      offset: Int
    ): [Trade!]!

    # Orders
    order(orderId: String!): Order
    orders(
      userAddress: String
      marketId: Int
      status: String
      orderType: Int
      limit: Int
      offset: Int
    ): [Order!]!

    # Liquidations
    liquidations(
      userAddress: String
      marketId: Int
      limit: Int
      offset: Int
    ): [Liquidation!]!

    # Markets
    market(marketId: Int!): Market
    markets: [Market!]!

    # Prices
    latestPrices: [LatestPrice!]!
    priceHistory(
      marketId: Int!
      limit: Int
      offset: Int
    ): [PriceUpdate!]!

    # Funding
    fundingRates(
      marketId: Int!
      limit: Int
      offset: Int
    ): [FundingRate!]!

    # Vaults
    userVault(userAddress: String!): UserVault
    vaultEvents(
      userAddress: String
      eventType: String
      limit: Int
      offset: Int
    ): [VaultEvent!]!

    # Collateral
    collateralTokens: [CollateralToken!]!

    # Pool state
    poolStates: [PoolState!]!
    poolState(marketId: Int!): PoolState

    # Fees
    feeConfig: FeeConfig

    # Protocol events
    protocolEvents(
      eventName: String
      limit: Int
      offset: Int
    ): [ProtocolEvent!]!

    # Stats
    userStats(userAddress: String!): UserStats
    marketStats(marketId: Int!): MarketStats
    globalStats: GlobalStats
    indexerStatus: IndexerStatus

    # V2 — Keeper Cycles
    keeperCycles(limit: Int, offset: Int): [KeeperCycle!]!

    # V2 — Account Ledger
    accountLedger(
      userAddress: String
      positionId: String
      limit: Int
      offset: Int
    ): [AccountLedgerEntry!]!

    # V2 — Delegates
    delegates(userAddress: String!): [Delegate!]!

    # V2 — Trading Account Events
    tradingAccountEvents(
      userAddress: String
      eventType: String
      limit: Int
      offset: Int
    ): [TradingAccountEvent!]!
  }
`;

module.exports = { typeDefs };
