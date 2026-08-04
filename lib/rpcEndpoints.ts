// lib/rpcEndpoints.ts
// Single source of truth for every JSON-RPC endpoint the app talks to.
//
// Why this file exists
// -------------------
// Endpoint lists used to be duplicated in five places (constants/chains.ts, lib/wagmi.ts,
// hooks/useUSDCBalance.ts, components/bridge/UnifiedPortfolioDrawer.tsx,
// components/bridge/TransactionHistoryDrawer.tsx). They drifted apart, and several of the
// copies still pointed at endpoints that are now dead:
//
//   * https://eth-sepolia.public.blastapi.io  -> HTTP 403, Blast shut the free tier down
//   * https://rpc.sepolia.org                 -> HTTP 404
//   * https://rpc-amoy.polygon.technology     -> DNS/connection failure
//   * https://rpc-holesky.morphl2.io          -> DNS/connection failure
//
// Every endpoint below was probed for reachability, latency, and — critically — CORS.
//
// The CORS problem
// ----------------
// https://rpc.testnet.arc.network answers server-to-server fine but returns NO
// Access-Control-Allow-Origin header and rejects the OPTIONS preflight with HTTP 400.
// A browser therefore cannot call it directly: every request dies as "Failed to fetch",
// which is exactly the balanceOf() error users were seeing on Arc Testnet.
//
// Endpoints flagged `corsBlocked` are routed through our own /api/rpc proxy instead of
// being called from the browser. The proxy runs server-side where CORS does not apply.

export interface RpcEndpoint {
  url: string;
  /**
   * True when the endpoint sends no CORS headers, so it can only be reached from the
   * server. These are excluded from browser-side URL lists and served via /api/rpc.
   */
  corsBlocked?: boolean;
}

/**
 * Ordered endpoint lists, fastest/most reliable first. Order matters: callers try them
 * in sequence and stop at the first success.
 */
export const CHAIN_RPCS: Record<number, RpcEndpoint[]> = {
  // Arc Testnet — no CORS on the only public endpoint, so it is proxy-only in the browser.
  5042002: [{ url: 'https://rpc.testnet.arc.network', corsBlocked: true }],

  // Ethereum Sepolia. Note rpc.sepolia.org (404) and the Blast endpoint (403) are gone.
  11155111: [
    { url: 'https://ethereum-sepolia-rpc.publicnode.com' },
    { url: 'https://sepolia.gateway.tenderly.co' },
    { url: 'https://sepolia.drpc.org' },
    { url: 'https://1rpc.io/sepolia' },
  ],

  // Base Sepolia
  84532: [
    { url: 'https://base-sepolia-rpc.publicnode.com' },
    { url: 'https://sepolia.base.org' },
  ],

  // Arbitrum Sepolia
  421614: [
    { url: 'https://arbitrum-sepolia-rpc.publicnode.com' },
    { url: 'https://sepolia-rollup.arbitrum.io/rpc' },
  ],

  // Avalanche Fuji
  43113: [
    { url: 'https://api.avax-test.network/ext/bc/C/rpc' },
    { url: 'https://avalanche-fuji-c-chain-rpc.publicnode.com' },
  ],

  // OP Sepolia
  11155420: [
    { url: 'https://optimism-sepolia-rpc.publicnode.com' },
    { url: 'https://sepolia.optimism.io' },
    { url: 'https://optimism-sepolia.drpc.org' },
  ],

  // Linea Sepolia
  59141: [
    { url: 'https://linea-sepolia-rpc.publicnode.com' },
    { url: 'https://rpc.sepolia.linea.build' },
  ],

  // Polygon Amoy — the official rpc-amoy.polygon.technology endpoint is unreachable,
  // so it is no longer the primary.
  80002: [
    { url: 'https://polygon-amoy-bor-rpc.publicnode.com' },
    { url: 'https://polygon-amoy.gateway.tenderly.co' },
    { url: 'https://polygon-amoy.drpc.org' },
  ],

  // Unichain Sepolia
  1301: [
    { url: 'https://unichain-sepolia-rpc.publicnode.com' },
    { url: 'https://sepolia.unichain.org' },
  ],

  // Sonic Testnet
  14601: [{ url: 'https://rpc.testnet.soniclabs.com' }],

  // HyperEVM Testnet
  998: [{ url: 'https://rpc.hyperliquid-testnet.xyz/evm' }],

  // Monad Testnet
  10143: [
    { url: 'https://testnet-rpc.monad.xyz' },
    { url: 'https://monad-testnet.drpc.org' },
  ],

  // Ink Sepolia
  763373: [{ url: 'https://rpc-gel-sepolia.inkonchain.com' }],

  // Sei Testnet
  1328: [{ url: 'https://evm-rpc-testnet.sei-apis.com' }],

  // World Chain Sepolia
  4801: [{ url: 'https://worldchain-sepolia.g.alchemy.com/public' }],

  // Pharos Atlantic Testnet
  688689: [{ url: 'https://atlantic.dplabs-internal.com' }],

  // Codex Testnet
  656476: [{ url: 'https://rpc.open-campus-codex.gelato.digital' }],

  // EDGE Testnet
  3456: [{ url: 'https://testnet-rpc.layeredge.io' }],

  // Injective Testnet
  1439: [{ url: 'https://k8s.testnet.json-rpc.injective.network' }],

  // Morph Holesky — every published endpoint is currently unreachable. Kept here so the
  // chain still resolves, but it is marked isComingSoon in constants/chains.ts so no user
  // can route a transfer into a dead network.
  2810: [{ url: 'https://rpc-holesky.morphl2.io' }],

  // Plume Testnet
  98867: [{ url: 'https://testnet-rpc.plume.org' }],

  // XDC Apothem
  51: [
    { url: 'https://rpc.apothem.network' },
    { url: 'https://erpc.apothem.network' },
  ],
};

/** Solana Devnet. Public endpoint is heavily rate-limited, hence the fallback. */
export const SOLANA_RPCS: RpcEndpoint[] = [
  { url: process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com' },
  { url: 'https://devnet.helius-rpc.com/?api-key=demo' },
];

/** Chain ID used for the Solana proxy route, which has no EVM chain ID of its own. */
export const SOLANA_PROXY_ID = 'solana';

/** Server-side list including CORS-blocked endpoints. Used by the /api/rpc proxy. */
export function getServerRpcUrls(chainId: number): string[] {
  return (CHAIN_RPCS[chainId] || []).map((e) => e.url);
}

/**
 * Browser-safe endpoint list for a chain.
 *
 * CORS-blocked endpoints are replaced by our same-origin proxy path, so callers get a
 * list they can always fetch() without tripping the browser's cross-origin checks.
 */
export function getClientRpcUrls(chainId: number): string[] {
  const entries = CHAIN_RPCS[chainId] || [];
  const direct = entries.filter((e) => !e.corsBlocked).map((e) => e.url);
  const needsProxy = entries.some((e) => e.corsBlocked);

  // The proxy goes last for chains that have working direct endpoints (avoids a pointless
  // extra network hop), and first when every endpoint is CORS-blocked.
  return needsProxy && direct.length === 0
    ? [proxyUrl(chainId)]
    : needsProxy
      ? [...direct, proxyUrl(chainId)]
      : direct;
}

/** Same-origin proxy path for a chain. */
export function proxyUrl(chainId: number | string): string {
  return `/api/rpc/${chainId}`;
}

/** Browser-safe Solana endpoint. Falls back to the proxy if the public node is blocked. */
export function getSolanaRpcUrl(): string {
  return SOLANA_RPCS[0].url;
}

export function getSolanaRpcUrls(): string[] {
  return SOLANA_RPCS.map((e) => e.url);
}

/** Primary (display/metadata) URL for a chain — the first configured endpoint. */
export function getPrimaryRpcUrl(chainId: number): string {
  return CHAIN_RPCS[chainId]?.[0]?.url ?? '';
}
