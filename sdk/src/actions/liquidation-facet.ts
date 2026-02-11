import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { LiquidationFacetAbi } from '../abis/liquidation-facet';
import { LIQUIDATION_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `LiquidationFacet.checkLiquidatable`
 */
export async function readLiquidationFacetCheckLiquidatable(
  config: Config,
  args: { _positionId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: LIQUIDATION_FACET_ADDRESS,
    abi: LiquidationFacetAbi,
    functionName: 'checkLiquidatable',
    args: [args._positionId],
    chainId,
  });
}

/**
 * Write `LiquidationFacet.autoDeleverage`
 */
export async function writeLiquidationFacetAutoDeleverage(
  config: Config,
  args: { _positionId: bigint; _deleverageSize: bigint },
) {
  return writeContract(config, {
    address: LIQUIDATION_FACET_ADDRESS,
    abi: LiquidationFacetAbi,
    functionName: 'autoDeleverage',
    args: [args._positionId, args._deleverageSize],
  });
}

/**
 * Simulate `LiquidationFacet.autoDeleverage`
 */
export async function simulateLiquidationFacetAutoDeleverage(
  config: Config,
  args: { _positionId: bigint; _deleverageSize: bigint },
) {
  return simulateContract(config, {
    address: LIQUIDATION_FACET_ADDRESS,
    abi: LiquidationFacetAbi,
    functionName: 'autoDeleverage',
    args: [args._positionId, args._deleverageSize],
  });
}

/**
 * Write `LiquidationFacet.liquidate`
 */
export async function writeLiquidationFacetLiquidate(
  config: Config,
  args: { _positionId: bigint },
) {
  return writeContract(config, {
    address: LIQUIDATION_FACET_ADDRESS,
    abi: LiquidationFacetAbi,
    functionName: 'liquidate',
    args: [args._positionId],
  });
}

/**
 * Simulate `LiquidationFacet.liquidate`
 */
export async function simulateLiquidationFacetLiquidate(
  config: Config,
  args: { _positionId: bigint },
) {
  return simulateContract(config, {
    address: LIQUIDATION_FACET_ADDRESS,
    abi: LiquidationFacetAbi,
    functionName: 'liquidate',
    args: [args._positionId],
  });
}
