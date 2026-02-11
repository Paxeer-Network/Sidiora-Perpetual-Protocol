import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { InsuranceFundFacetAbi } from '../abis/insurance-fund-facet';
import { INSURANCE_FUND_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `InsuranceFundFacet.getADLThreshold`
 */
export async function readInsuranceFundFacetGetADLThreshold(config: Config, chainId?: number) {
  return readContract(config, {
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    functionName: 'getADLThreshold',
    chainId,
  });
}

/**
 * Read `InsuranceFundFacet.getInsuranceBalance`
 */
export async function readInsuranceFundFacetGetInsuranceBalance(
  config: Config,
  args: { _token: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    functionName: 'getInsuranceBalance',
    args: [args._token],
    chainId,
  });
}

/**
 * Read `InsuranceFundFacet.shouldTriggerADL`
 */
export async function readInsuranceFundFacetShouldTriggerADL(
  config: Config,
  args: { _token: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    functionName: 'shouldTriggerADL',
    args: [args._token],
    chainId,
  });
}

/**
 * Write `InsuranceFundFacet.setADLThreshold`
 */
export async function writeInsuranceFundFacetSetADLThreshold(
  config: Config,
  args: { _threshold: bigint },
) {
  return writeContract(config, {
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    functionName: 'setADLThreshold',
    args: [args._threshold],
  });
}

/**
 * Simulate `InsuranceFundFacet.setADLThreshold`
 */
export async function simulateInsuranceFundFacetSetADLThreshold(
  config: Config,
  args: { _threshold: bigint },
) {
  return simulateContract(config, {
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    functionName: 'setADLThreshold',
    args: [args._threshold],
  });
}

/**
 * Write `InsuranceFundFacet.withdrawInsurance`
 */
export async function writeInsuranceFundFacetWithdrawInsurance(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint; _to: `0x${string}` },
) {
  return writeContract(config, {
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    functionName: 'withdrawInsurance',
    args: [args._token, args._amount, args._to],
  });
}

/**
 * Simulate `InsuranceFundFacet.withdrawInsurance`
 */
export async function simulateInsuranceFundFacetWithdrawInsurance(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint; _to: `0x${string}` },
) {
  return simulateContract(config, {
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    functionName: 'withdrawInsurance',
    args: [args._token, args._amount, args._to],
  });
}
