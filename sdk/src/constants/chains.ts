// ── Network / Chain Configuration ────────────────────────────────

export const HYPERPAXEER_CHAIN = {
  id: 125,
  name: 'Paxeer Mainnet',
  rpc: 'https://mainnet-beta.rpc.hyperpaxeer.com/rpc',
  explorer: 'https://paxscan.paxeer.app',
} as const;

export const CHAINS = {
  125: HYPERPAXEER_CHAIN,
} as const;

export const RPC_URLS: Record<number, string> = {
  125: 'https://mainnet-beta.rpc.hyperpaxeer.com/rpc',
};

export const SUPPORTED_CHAIN_IDS = [125] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];
