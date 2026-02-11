import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { PositionFacetAbi } from '../abis/position-facet';
import { POSITION_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `PositionFacet.getOpenInterest`
 */
export async function readPositionFacetGetOpenInterest(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'getOpenInterest',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `PositionFacet.getPosition`
 */
export async function readPositionFacetGetPosition(
  config: Config,
  args: { _positionId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'getPosition',
    args: [args._positionId],
    chainId,
  });
}

/**
 * Read `PositionFacet.getUserMarketPosition`
 */
export async function readPositionFacetGetUserMarketPosition(
  config: Config,
  args: { _user: `0x${string}`; _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'getUserMarketPosition',
    args: [args._user, args._marketId],
    chainId,
  });
}

/**
 * Read `PositionFacet.getUserPositionIds`
 */
export async function readPositionFacetGetUserPositionIds(
  config: Config,
  args: { _user: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'getUserPositionIds',
    args: [args._user],
    chainId,
  });
}

/**
 * Write `PositionFacet.addCollateral`
 */
export async function writePositionFacetAddCollateral(
  config: Config,
  args: { _positionId: bigint; _amount: bigint },
) {
  return writeContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'addCollateral',
    args: [args._positionId, args._amount],
  });
}

/**
 * Simulate `PositionFacet.addCollateral`
 */
export async function simulatePositionFacetAddCollateral(
  config: Config,
  args: { _positionId: bigint; _amount: bigint },
) {
  return simulateContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'addCollateral',
    args: [args._positionId, args._amount],
  });
}

/**
 * Write `PositionFacet.addSize`
 */
export async function writePositionFacetAddSize(
  config: Config,
  args: { _positionId: bigint; _additionalCollateral: bigint; _leverage: bigint },
) {
  return writeContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'addSize',
    args: [args._positionId, args._additionalCollateral, args._leverage],
  });
}

/**
 * Simulate `PositionFacet.addSize`
 */
export async function simulatePositionFacetAddSize(
  config: Config,
  args: { _positionId: bigint; _additionalCollateral: bigint; _leverage: bigint },
) {
  return simulateContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'addSize',
    args: [args._positionId, args._additionalCollateral, args._leverage],
  });
}

/**
 * Write `PositionFacet.closePosition`
 */
export async function writePositionFacetClosePosition(
  config: Config,
  args: { _positionId: bigint },
) {
  return writeContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'closePosition',
    args: [args._positionId],
  });
}

/**
 * Simulate `PositionFacet.closePosition`
 */
export async function simulatePositionFacetClosePosition(
  config: Config,
  args: { _positionId: bigint },
) {
  return simulateContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'closePosition',
    args: [args._positionId],
  });
}

/**
 * Write `PositionFacet.openPosition`
 */
export async function writePositionFacetOpenPosition(
  config: Config,
  args: {
    _marketId: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
    _leverage: bigint;
    _isLong: boolean;
  },
) {
  return writeContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'openPosition',
    args: [
      args._marketId,
      args._collateralToken,
      args._collateralAmount,
      args._leverage,
      args._isLong,
    ],
  });
}

/**
 * Simulate `PositionFacet.openPosition`
 */
export async function simulatePositionFacetOpenPosition(
  config: Config,
  args: {
    _marketId: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
    _leverage: bigint;
    _isLong: boolean;
  },
) {
  return simulateContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'openPosition',
    args: [
      args._marketId,
      args._collateralToken,
      args._collateralAmount,
      args._leverage,
      args._isLong,
    ],
  });
}

/**
 * Write `PositionFacet.partialClose`
 */
export async function writePositionFacetPartialClose(
  config: Config,
  args: { _positionId: bigint; _closeSizeUsd: bigint },
) {
  return writeContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'partialClose',
    args: [args._positionId, args._closeSizeUsd],
  });
}

/**
 * Simulate `PositionFacet.partialClose`
 */
export async function simulatePositionFacetPartialClose(
  config: Config,
  args: { _positionId: bigint; _closeSizeUsd: bigint },
) {
  return simulateContract(config, {
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'partialClose',
    args: [args._positionId, args._closeSizeUsd],
  });
}
