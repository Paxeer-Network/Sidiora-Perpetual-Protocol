// ── DiamondLoupeFacet Types ──────────────────────────────────────────────

export interface DiamondLoupeFacetFacetAddressArgs {
  _functionSelector: `0x${string}`;
}

export type DiamondLoupeFacetFacetAddressReturn = `0x${string}`;

export type DiamondLoupeFacetFacetAddressesReturn = readonly `0x${string}`[];

export interface DiamondLoupeFacetFacetFunctionSelectorsArgs {
  _facet: `0x${string}`;
}

export type DiamondLoupeFacetFacetFunctionSelectorsReturn = readonly `0x${string}`[];

export type DiamondLoupeFacetFacetsReturn = readonly {
  facetAddress: `0x${string}`;
  functionSelectors: readonly `0x${string}`[];
}[];

export interface DiamondLoupeFacetSupportsInterfaceArgs {
  _interfaceId: `0x${string}`;
}

export type DiamondLoupeFacetSupportsInterfaceReturn = boolean;
