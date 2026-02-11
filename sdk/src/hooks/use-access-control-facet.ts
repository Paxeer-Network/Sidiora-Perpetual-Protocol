import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { AccessControlFacetAbi } from '../abis/access-control-facet';
import { ACCESS_CONTROL_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `AccessControlFacet.DIAMOND_OWNER_ROLE`
 */
export function useReadAccessControlFacetDIAMONDOWNERROLE(config?: { chainId?: number }) {
  return useReadContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'DIAMOND_OWNER_ROLE',
    ...config,
  });
}

/**
 * Read `AccessControlFacet.INSURANCE_ADMIN_ROLE`
 */
export function useReadAccessControlFacetINSURANCEADMINROLE(config?: { chainId?: number }) {
  return useReadContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'INSURANCE_ADMIN_ROLE',
    ...config,
  });
}

/**
 * Read `AccessControlFacet.KEEPER_ROLE`
 */
export function useReadAccessControlFacetKEEPERROLE(config?: { chainId?: number }) {
  return useReadContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'KEEPER_ROLE',
    ...config,
  });
}

/**
 * Read `AccessControlFacet.MARKET_ADMIN_ROLE`
 */
export function useReadAccessControlFacetMARKETADMINROLE(config?: { chainId?: number }) {
  return useReadContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'MARKET_ADMIN_ROLE',
    ...config,
  });
}

/**
 * Read `AccessControlFacet.ORACLE_POSTER_ROLE`
 */
export function useReadAccessControlFacetORACLEPOSTERROLE(config?: { chainId?: number }) {
  return useReadContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'ORACLE_POSTER_ROLE',
    ...config,
  });
}

/**
 * Read `AccessControlFacet.PAUSER_ROLE`
 */
export function useReadAccessControlFacetPAUSERROLE(config?: { chainId?: number }) {
  return useReadContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'PAUSER_ROLE',
    ...config,
  });
}

/**
 * Read `AccessControlFacet.PROTOCOL_FUNDER_ROLE`
 */
export function useReadAccessControlFacetPROTOCOLFUNDERROLE(config?: { chainId?: number }) {
  return useReadContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'PROTOCOL_FUNDER_ROLE',
    ...config,
  });
}

/**
 * Read `AccessControlFacet.getRoleAdmin`
 */
export function useReadAccessControlFacetGetRoleAdmin(
  args: { _role: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'getRoleAdmin',
    args: [args._role],
    ...config,
  });
}

/**
 * Read `AccessControlFacet.hasRole`
 */
export function useReadAccessControlFacetHasRole(
  args: { _role: `0x${string}`; _account: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'hasRole',
    args: [args._role, args._account],
    ...config,
  });
}

/**
 * Write `AccessControlFacet.grantRole`
 */
export function useWriteAccessControlFacetGrantRole() {
  const result = useWriteContract();

  const write = (args: { _role: `0x${string}`; _account: `0x${string}` }) =>
    result.writeContract({
      address: ACCESS_CONTROL_FACET_ADDRESS,
      abi: AccessControlFacetAbi,
      functionName: 'grantRole',
      args: [args._role, args._account],
    });

  return { ...result, write };
}

/**
 * Simulate `AccessControlFacet.grantRole`
 */
export function useSimulateAccessControlFacetGrantRole(
  args: { _role: `0x${string}`; _account: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'grantRole',
    args: [args._role, args._account],
    ...config,
  });
}

/**
 * Write `AccessControlFacet.renounceRole`
 */
export function useWriteAccessControlFacetRenounceRole() {
  const result = useWriteContract();

  const write = (args: { _role: `0x${string}` }) =>
    result.writeContract({
      address: ACCESS_CONTROL_FACET_ADDRESS,
      abi: AccessControlFacetAbi,
      functionName: 'renounceRole',
      args: [args._role],
    });

  return { ...result, write };
}

/**
 * Simulate `AccessControlFacet.renounceRole`
 */
export function useSimulateAccessControlFacetRenounceRole(
  args: { _role: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'renounceRole',
    args: [args._role],
    ...config,
  });
}

/**
 * Write `AccessControlFacet.revokeRole`
 */
export function useWriteAccessControlFacetRevokeRole() {
  const result = useWriteContract();

  const write = (args: { _role: `0x${string}`; _account: `0x${string}` }) =>
    result.writeContract({
      address: ACCESS_CONTROL_FACET_ADDRESS,
      abi: AccessControlFacetAbi,
      functionName: 'revokeRole',
      args: [args._role, args._account],
    });

  return { ...result, write };
}

/**
 * Simulate `AccessControlFacet.revokeRole`
 */
export function useSimulateAccessControlFacetRevokeRole(
  args: { _role: `0x${string}`; _account: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'revokeRole',
    args: [args._role, args._account],
    ...config,
  });
}

/**
 * Write `AccessControlFacet.setRoleAdmin`
 */
export function useWriteAccessControlFacetSetRoleAdmin() {
  const result = useWriteContract();

  const write = (args: { _role: `0x${string}`; _adminRole: `0x${string}` }) =>
    result.writeContract({
      address: ACCESS_CONTROL_FACET_ADDRESS,
      abi: AccessControlFacetAbi,
      functionName: 'setRoleAdmin',
      args: [args._role, args._adminRole],
    });

  return { ...result, write };
}

/**
 * Simulate `AccessControlFacet.setRoleAdmin`
 */
export function useSimulateAccessControlFacetSetRoleAdmin(
  args: { _role: `0x${string}`; _adminRole: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'setRoleAdmin',
    args: [args._role, args._adminRole],
    ...config,
  });
}

/**
 * Watch `AccessControlFacet.RoleAdminChanged` event
 */
export function useWatchAccessControlFacetRoleAdminChanged(config: {
  onLogs: (
    logs: Array<{
      args: { role: `0x${string}`; previousAdminRole: `0x${string}`; newAdminRole: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    eventName: 'RoleAdminChanged',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `AccessControlFacet.RoleGranted` event
 */
export function useWatchAccessControlFacetRoleGranted(config: {
  onLogs: (
    logs: Array<{
      args: { role: `0x${string}`; account: `0x${string}`; sender: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    eventName: 'RoleGranted',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `AccessControlFacet.RoleRevoked` event
 */
export function useWatchAccessControlFacetRoleRevoked(config: {
  onLogs: (
    logs: Array<{
      args: { role: `0x${string}`; account: `0x${string}`; sender: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    eventName: 'RoleRevoked',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
