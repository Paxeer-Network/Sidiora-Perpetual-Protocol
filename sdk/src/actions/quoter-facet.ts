import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { QuoterFacetAbi } from '../abis/quoter-facet';
import { QUOTER_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `QuoterFacet.quoteClosePosition`
 */
export async function readQuoterFacetQuoteClosePosition(
  config: Config,
  args: { _positionId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: QUOTER_FACET_ADDRESS,
    abi: QuoterFacetAbi,
    functionName: 'quoteClosePosition',
    args: [args._positionId],
    chainId,
  });
}

/**
 * Read `QuoterFacet.quoteMarket`
 */
export async function readQuoterFacetQuoteMarket(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: QUOTER_FACET_ADDRESS,
    abi: QuoterFacetAbi,
    functionName: 'quoteMarket',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `QuoterFacet.quoteOpenPosition`
 */
export async function readQuoterFacetQuoteOpenPosition(
  config: Config,
  args: {
    _marketId: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
    _leverage: bigint;
    _isLong: boolean;
  },
  chainId?: number,
) {
  return readContract(config, {
    address: QUOTER_FACET_ADDRESS,
    abi: QuoterFacetAbi,
    functionName: 'quoteOpenPosition',
    args: [
      args._marketId,
      args._collateralToken,
      args._collateralAmount,
      args._leverage,
      args._isLong,
    ],
    chainId,
  });
}

/**
 * Read `QuoterFacet.quotePartialClose`
 */
export async function readQuoterFacetQuotePartialClose(
  config: Config,
  args: { _positionId: bigint; _closeSizeUsd: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: QUOTER_FACET_ADDRESS,
    abi: QuoterFacetAbi,
    functionName: 'quotePartialClose',
    args: [args._positionId, args._closeSizeUsd],
    chainId,
  });
}
