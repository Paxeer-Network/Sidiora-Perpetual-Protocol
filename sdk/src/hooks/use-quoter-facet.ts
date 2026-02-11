import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { QuoterFacetAbi } from '../abis/quoter-facet';
import { QUOTER_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `QuoterFacet.quoteClosePosition`
 */
export function useReadQuoterFacetQuoteClosePosition(
  args: { _positionId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: QUOTER_FACET_ADDRESS,
    abi: QuoterFacetAbi,
    functionName: 'quoteClosePosition',
    args: [args._positionId],
    ...config,
  });
}

/**
 * Read `QuoterFacet.quoteMarket`
 */
export function useReadQuoterFacetQuoteMarket(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: QUOTER_FACET_ADDRESS,
    abi: QuoterFacetAbi,
    functionName: 'quoteMarket',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `QuoterFacet.quoteOpenPosition`
 */
export function useReadQuoterFacetQuoteOpenPosition(
  args: {
    _marketId: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
    _leverage: bigint;
    _isLong: boolean;
  },
  config?: { chainId?: number },
) {
  return useReadContract({
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
    ...config,
  });
}

/**
 * Read `QuoterFacet.quotePartialClose`
 */
export function useReadQuoterFacetQuotePartialClose(
  args: { _positionId: bigint; _closeSizeUsd: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: QUOTER_FACET_ADDRESS,
    abi: QuoterFacetAbi,
    functionName: 'quotePartialClose',
    args: [args._positionId, args._closeSizeUsd],
    ...config,
  });
}
