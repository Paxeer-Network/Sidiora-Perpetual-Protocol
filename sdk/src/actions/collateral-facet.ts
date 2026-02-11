import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { CollateralFacetAbi } from '../abis/collateral-facet';
import { COLLATERAL_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `CollateralFacet.getCollateralDecimals`
 */
export async function readCollateralFacetGetCollateralDecimals(
  config: Config,
  args: { _token: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'getCollateralDecimals',
    args: [args._token],
    chainId,
  });
}

/**
 * Read `CollateralFacet.getCollateralTokens`
 */
export async function readCollateralFacetGetCollateralTokens(config: Config, chainId?: number) {
  return readContract(config, {
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'getCollateralTokens',
    chainId,
  });
}

/**
 * Read `CollateralFacet.getCollateralValue`
 */
export async function readCollateralFacetGetCollateralValue(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'getCollateralValue',
    args: [args._token, args._amount],
    chainId,
  });
}

/**
 * Read `CollateralFacet.isAcceptedCollateral`
 */
export async function readCollateralFacetIsAcceptedCollateral(
  config: Config,
  args: { _token: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'isAcceptedCollateral',
    args: [args._token],
    chainId,
  });
}

/**
 * Write `CollateralFacet.addCollateral`
 */
export async function writeCollateralFacetAddCollateral(
  config: Config,
  args: { _token: `0x${string}` },
) {
  return writeContract(config, {
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'addCollateral',
    args: [args._token],
  });
}

/**
 * Simulate `CollateralFacet.addCollateral`
 */
export async function simulateCollateralFacetAddCollateral(
  config: Config,
  args: { _token: `0x${string}` },
) {
  return simulateContract(config, {
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'addCollateral',
    args: [args._token],
  });
}

/**
 * Write `CollateralFacet.removeCollateral`
 */
export async function writeCollateralFacetRemoveCollateral(
  config: Config,
  args: { _token: `0x${string}` },
) {
  return writeContract(config, {
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'removeCollateral',
    args: [args._token],
  });
}

/**
 * Simulate `CollateralFacet.removeCollateral`
 */
export async function simulateCollateralFacetRemoveCollateral(
  config: Config,
  args: { _token: `0x${string}` },
) {
  return simulateContract(config, {
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'removeCollateral',
    args: [args._token],
  });
}
