import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { MarketRegistryFacetAbi } from '../abis/market-registry-facet';
import { MARKET_REGISTRY_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `MarketRegistryFacet.getActiveMarketIds`
 */
export async function readMarketRegistryFacetGetActiveMarketIds(config: Config, chainId?: number) {
  return readContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'getActiveMarketIds',
    chainId,
  });
}

/**
 * Read `MarketRegistryFacet.getFees`
 */
export async function readMarketRegistryFacetGetFees(config: Config, chainId?: number) {
  return readContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'getFees',
    chainId,
  });
}

/**
 * Read `MarketRegistryFacet.getMarket`
 */
export async function readMarketRegistryFacetGetMarket(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'getMarket',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `MarketRegistryFacet.isMarketActive`
 */
export async function readMarketRegistryFacetIsMarketActive(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'isMarketActive',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `MarketRegistryFacet.totalMarkets`
 */
export async function readMarketRegistryFacetTotalMarkets(config: Config, chainId?: number) {
  return readContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'totalMarkets',
    chainId,
  });
}

/**
 * Write `MarketRegistryFacet.createMarket`
 */
export async function writeMarketRegistryFacetCreateMarket(
  config: Config,
  args: {
    _name: string;
    _symbol: string;
    _maxLeverage: bigint;
    _maintenanceMarginBps: bigint;
    _maxOpenInterest: bigint;
  },
) {
  return writeContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'createMarket',
    args: [
      args._name,
      args._symbol,
      args._maxLeverage,
      args._maintenanceMarginBps,
      args._maxOpenInterest,
    ],
  });
}

/**
 * Simulate `MarketRegistryFacet.createMarket`
 */
export async function simulateMarketRegistryFacetCreateMarket(
  config: Config,
  args: {
    _name: string;
    _symbol: string;
    _maxLeverage: bigint;
    _maintenanceMarginBps: bigint;
    _maxOpenInterest: bigint;
  },
) {
  return simulateContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'createMarket',
    args: [
      args._name,
      args._symbol,
      args._maxLeverage,
      args._maintenanceMarginBps,
      args._maxOpenInterest,
    ],
  });
}

/**
 * Write `MarketRegistryFacet.disableMarket`
 */
export async function writeMarketRegistryFacetDisableMarket(
  config: Config,
  args: { _marketId: bigint },
) {
  return writeContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'disableMarket',
    args: [args._marketId],
  });
}

/**
 * Simulate `MarketRegistryFacet.disableMarket`
 */
export async function simulateMarketRegistryFacetDisableMarket(
  config: Config,
  args: { _marketId: bigint },
) {
  return simulateContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'disableMarket',
    args: [args._marketId],
  });
}

/**
 * Write `MarketRegistryFacet.enableMarket`
 */
export async function writeMarketRegistryFacetEnableMarket(
  config: Config,
  args: { _marketId: bigint },
) {
  return writeContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'enableMarket',
    args: [args._marketId],
  });
}

/**
 * Simulate `MarketRegistryFacet.enableMarket`
 */
export async function simulateMarketRegistryFacetEnableMarket(
  config: Config,
  args: { _marketId: bigint },
) {
  return simulateContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'enableMarket',
    args: [args._marketId],
  });
}

/**
 * Write `MarketRegistryFacet.setFees`
 */
export async function writeMarketRegistryFacetSetFees(
  config: Config,
  args: {
    _takerFeeBps: bigint;
    _makerFeeBps: bigint;
    _liquidationFeeBps: bigint;
    _insuranceFeeBps: bigint;
  },
) {
  return writeContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'setFees',
    args: [args._takerFeeBps, args._makerFeeBps, args._liquidationFeeBps, args._insuranceFeeBps],
  });
}

/**
 * Simulate `MarketRegistryFacet.setFees`
 */
export async function simulateMarketRegistryFacetSetFees(
  config: Config,
  args: {
    _takerFeeBps: bigint;
    _makerFeeBps: bigint;
    _liquidationFeeBps: bigint;
    _insuranceFeeBps: bigint;
  },
) {
  return simulateContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'setFees',
    args: [args._takerFeeBps, args._makerFeeBps, args._liquidationFeeBps, args._insuranceFeeBps],
  });
}

/**
 * Write `MarketRegistryFacet.updateMarket`
 */
export async function writeMarketRegistryFacetUpdateMarket(
  config: Config,
  args: {
    _marketId: bigint;
    _maxLeverage: bigint;
    _maintenanceMarginBps: bigint;
    _maxOpenInterest: bigint;
  },
) {
  return writeContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'updateMarket',
    args: [args._marketId, args._maxLeverage, args._maintenanceMarginBps, args._maxOpenInterest],
  });
}

/**
 * Simulate `MarketRegistryFacet.updateMarket`
 */
export async function simulateMarketRegistryFacetUpdateMarket(
  config: Config,
  args: {
    _marketId: bigint;
    _maxLeverage: bigint;
    _maintenanceMarginBps: bigint;
    _maxOpenInterest: bigint;
  },
) {
  return simulateContract(config, {
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'updateMarket',
    args: [args._marketId, args._maxLeverage, args._maintenanceMarginBps, args._maxOpenInterest],
  });
}
