import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { AccessControlFacetAbi } from '../abis/access-control-facet';
import { ACCESS_CONTROL_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `AccessControlFacet.DIAMOND_OWNER_ROLE`
 */
export async function readAccessControlFacetDIAMONDOWNERROLE(config: Config, chainId?: number) {
  return readContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'DIAMOND_OWNER_ROLE',
    chainId,
  });
}

/**
 * Read `AccessControlFacet.INSURANCE_ADMIN_ROLE`
 */
export async function readAccessControlFacetINSURANCEADMINROLE(config: Config, chainId?: number) {
  return readContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'INSURANCE_ADMIN_ROLE',
    chainId,
  });
}

/**
 * Read `AccessControlFacet.KEEPER_ROLE`
 */
export async function readAccessControlFacetKEEPERROLE(config: Config, chainId?: number) {
  return readContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'KEEPER_ROLE',
    chainId,
  });
}

/**
 * Read `AccessControlFacet.MARKET_ADMIN_ROLE`
 */
export async function readAccessControlFacetMARKETADMINROLE(config: Config, chainId?: number) {
  return readContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'MARKET_ADMIN_ROLE',
    chainId,
  });
}

/**
 * Read `AccessControlFacet.ORACLE_POSTER_ROLE`
 */
export async function readAccessControlFacetORACLEPOSTERROLE(config: Config, chainId?: number) {
  return readContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'ORACLE_POSTER_ROLE',
    chainId,
  });
}

/**
 * Read `AccessControlFacet.PAUSER_ROLE`
 */
export async function readAccessControlFacetPAUSERROLE(config: Config, chainId?: number) {
  return readContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'PAUSER_ROLE',
    chainId,
  });
}

/**
 * Read `AccessControlFacet.PROTOCOL_FUNDER_ROLE`
 */
export async function readAccessControlFacetPROTOCOLFUNDERROLE(config: Config, chainId?: number) {
  return readContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'PROTOCOL_FUNDER_ROLE',
    chainId,
  });
}

/**
 * Read `AccessControlFacet.getRoleAdmin`
 */
export async function readAccessControlFacetGetRoleAdmin(
  config: Config,
  args: { _role: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'getRoleAdmin',
    args: [args._role],
    chainId,
  });
}

/**
 * Read `AccessControlFacet.hasRole`
 */
export async function readAccessControlFacetHasRole(
  config: Config,
  args: { _role: `0x${string}`; _account: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'hasRole',
    args: [args._role, args._account],
    chainId,
  });
}

/**
 * Write `AccessControlFacet.grantRole`
 */
export async function writeAccessControlFacetGrantRole(
  config: Config,
  args: { _role: `0x${string}`; _account: `0x${string}` },
) {
  return writeContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'grantRole',
    args: [args._role, args._account],
  });
}

/**
 * Simulate `AccessControlFacet.grantRole`
 */
export async function simulateAccessControlFacetGrantRole(
  config: Config,
  args: { _role: `0x${string}`; _account: `0x${string}` },
) {
  return simulateContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'grantRole',
    args: [args._role, args._account],
  });
}

/**
 * Write `AccessControlFacet.renounceRole`
 */
export async function writeAccessControlFacetRenounceRole(
  config: Config,
  args: { _role: `0x${string}` },
) {
  return writeContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'renounceRole',
    args: [args._role],
  });
}

/**
 * Simulate `AccessControlFacet.renounceRole`
 */
export async function simulateAccessControlFacetRenounceRole(
  config: Config,
  args: { _role: `0x${string}` },
) {
  return simulateContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'renounceRole',
    args: [args._role],
  });
}

/**
 * Write `AccessControlFacet.revokeRole`
 */
export async function writeAccessControlFacetRevokeRole(
  config: Config,
  args: { _role: `0x${string}`; _account: `0x${string}` },
) {
  return writeContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'revokeRole',
    args: [args._role, args._account],
  });
}

/**
 * Simulate `AccessControlFacet.revokeRole`
 */
export async function simulateAccessControlFacetRevokeRole(
  config: Config,
  args: { _role: `0x${string}`; _account: `0x${string}` },
) {
  return simulateContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'revokeRole',
    args: [args._role, args._account],
  });
}

/**
 * Write `AccessControlFacet.setRoleAdmin`
 */
export async function writeAccessControlFacetSetRoleAdmin(
  config: Config,
  args: { _role: `0x${string}`; _adminRole: `0x${string}` },
) {
  return writeContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'setRoleAdmin',
    args: [args._role, args._adminRole],
  });
}

/**
 * Simulate `AccessControlFacet.setRoleAdmin`
 */
export async function simulateAccessControlFacetSetRoleAdmin(
  config: Config,
  args: { _role: `0x${string}`; _adminRole: `0x${string}` },
) {
  return simulateContract(config, {
    address: ACCESS_CONTROL_FACET_ADDRESS,
    abi: AccessControlFacetAbi,
    functionName: 'setRoleAdmin',
    args: [args._role, args._adminRole],
  });
}
