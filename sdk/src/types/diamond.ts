// ── Diamond Types ──────────────────────────────────────────────

export interface DiamondDiamondCutEvent {
  _diamondCut: readonly {
    facetAddress: `0x${string}`;
    action: bigint;
    functionSelectors: readonly `0x${string}`[];
  }[];
  _init: `0x${string}`;
  _calldata: `0x${string}`;
}

export interface DiamondOwnershipTransferredEvent {
  previousOwner: `0x${string}`; /* indexed */
  newOwner: `0x${string}`; /* indexed */
}
