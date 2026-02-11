// ── OwnershipFacet Types ──────────────────────────────────────────────

export type OwnershipFacetOwnerReturn = `0x${string}`;

export interface OwnershipFacetTransferOwnershipArgs {
  _newOwner: `0x${string}`;
}

export interface OwnershipFacetOwnershipTransferredEvent {
  previousOwner: `0x${string}`; /* indexed */
  newOwner: `0x${string}`; /* indexed */
}

export interface OwnershipFacetOwnershipTransferredEvent {
  previousOwner: `0x${string}`; /* indexed */
  newOwner: `0x${string}`; /* indexed */
}
