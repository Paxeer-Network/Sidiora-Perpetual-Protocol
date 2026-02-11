import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { InsuranceFundFacetAbi } from '../abis/insurance-fund-facet';
import { INSURANCE_FUND_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `InsuranceFundFacet.getADLThreshold`
 */
export function useReadInsuranceFundFacetGetADLThreshold(config?: { chainId?: number }) {
  return useReadContract({
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    functionName: 'getADLThreshold',
    ...config,
  });
}

/**
 * Read `InsuranceFundFacet.getInsuranceBalance`
 */
export function useReadInsuranceFundFacetGetInsuranceBalance(
  args: { _token: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    functionName: 'getInsuranceBalance',
    args: [args._token],
    ...config,
  });
}

/**
 * Read `InsuranceFundFacet.shouldTriggerADL`
 */
export function useReadInsuranceFundFacetShouldTriggerADL(
  args: { _token: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    functionName: 'shouldTriggerADL',
    args: [args._token],
    ...config,
  });
}

/**
 * Write `InsuranceFundFacet.setADLThreshold`
 */
export function useWriteInsuranceFundFacetSetADLThreshold() {
  const result = useWriteContract();

  const write = (args: { _threshold: bigint }) =>
    result.writeContract({
      address: INSURANCE_FUND_FACET_ADDRESS,
      abi: InsuranceFundFacetAbi,
      functionName: 'setADLThreshold',
      args: [args._threshold],
    });

  return { ...result, write };
}

/**
 * Simulate `InsuranceFundFacet.setADLThreshold`
 */
export function useSimulateInsuranceFundFacetSetADLThreshold(
  args: { _threshold: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    functionName: 'setADLThreshold',
    args: [args._threshold],
    ...config,
  });
}

/**
 * Write `InsuranceFundFacet.withdrawInsurance`
 */
export function useWriteInsuranceFundFacetWithdrawInsurance() {
  const result = useWriteContract();

  const write = (args: { _token: `0x${string}`; _amount: bigint; _to: `0x${string}` }) =>
    result.writeContract({
      address: INSURANCE_FUND_FACET_ADDRESS,
      abi: InsuranceFundFacetAbi,
      functionName: 'withdrawInsurance',
      args: [args._token, args._amount, args._to],
    });

  return { ...result, write };
}

/**
 * Simulate `InsuranceFundFacet.withdrawInsurance`
 */
export function useSimulateInsuranceFundFacetWithdrawInsurance(
  args: { _token: `0x${string}`; _amount: bigint; _to: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    functionName: 'withdrawInsurance',
    args: [args._token, args._amount, args._to],
    ...config,
  });
}

/**
 * Watch `InsuranceFundFacet.ADLThresholdUpdated` event
 */
export function useWatchInsuranceFundFacetADLThresholdUpdated(config: {
  onLogs: (
    logs: Array<{
      args: { oldThreshold: bigint; newThreshold: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    eventName: 'ADLThresholdUpdated',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `InsuranceFundFacet.InsuranceWithdrawn` event
 */
export function useWatchInsuranceFundFacetInsuranceWithdrawn(config: {
  onLogs: (
    logs: Array<{
      args: { token: `0x${string}`; amount: bigint; to: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: INSURANCE_FUND_FACET_ADDRESS,
    abi: InsuranceFundFacetAbi,
    eventName: 'InsuranceWithdrawn',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
