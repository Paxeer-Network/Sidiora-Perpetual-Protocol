// ── AccessControlFacet Types ──────────────────────────────────────────────

export type AccessControlFacetDIAMONDOWNERROLEReturn = `0x${string}`;

export type AccessControlFacetINSURANCEADMINROLEReturn = `0x${string}`;

export type AccessControlFacetKEEPERROLEReturn = `0x${string}`;

export type AccessControlFacetMARKETADMINROLEReturn = `0x${string}`;

export type AccessControlFacetORACLEPOSTERROLEReturn = `0x${string}`;

export type AccessControlFacetPAUSERROLEReturn = `0x${string}`;

export type AccessControlFacetPROTOCOLFUNDERROLEReturn = `0x${string}`;

export interface AccessControlFacetGetRoleAdminArgs {
  _role: `0x${string}`;
}

export type AccessControlFacetGetRoleAdminReturn = `0x${string}`;

export interface AccessControlFacetHasRoleArgs {
  _role: `0x${string}`;
  _account: `0x${string}`;
}

export type AccessControlFacetHasRoleReturn = boolean;

export interface AccessControlFacetGrantRoleArgs {
  _role: `0x${string}`;
  _account: `0x${string}`;
}

export interface AccessControlFacetRenounceRoleArgs {
  _role: `0x${string}`;
}

export interface AccessControlFacetRevokeRoleArgs {
  _role: `0x${string}`;
  _account: `0x${string}`;
}

export interface AccessControlFacetSetRoleAdminArgs {
  _role: `0x${string}`;
  _adminRole: `0x${string}`;
}

export interface AccessControlFacetRoleAdminChangedEvent {
  role: `0x${string}`; /* indexed */
  previousAdminRole: `0x${string}`; /* indexed */
  newAdminRole: `0x${string}`; /* indexed */
}

export interface AccessControlFacetRoleGrantedEvent {
  role: `0x${string}`; /* indexed */
  account: `0x${string}`; /* indexed */
  sender: `0x${string}`; /* indexed */
}

export interface AccessControlFacetRoleRevokedEvent {
  role: `0x${string}`; /* indexed */
  account: `0x${string}`; /* indexed */
  sender: `0x${string}`; /* indexed */
}
