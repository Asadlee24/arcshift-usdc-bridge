// lib/publicClient.ts
// Shared, CORS-safe Viem PublicClient factory.
//
// Why this file exists
// --------------------
// lib/rpcEndpoints.ts already knows which endpoints a browser may call directly and which
// must be routed through the same-origin /api/rpc proxy. But that knowledge only helped the
// code paths that went through lib/rpcClient.ts or lib/wagmi.ts. Anything that built its own
// Viem client — most importantly the Circle SDK — bypassed the registry entirely and hit
// Arc's CORS-blocked RPC directly, producing:
//
//   Read contract failed: HTTP request failed.
//   URL: https://rpc.testnet.arc.network/
//   function: balanceOf(address _owner)
//   Details: Failed to fetch
//
// The `_owner` parameter name and the trailing slash in that URL are the giveaway: neither
// appears anywhere in this repo. Both come from @circle-fin/adapter-viem-v2, which ships its
// own ERC-20 ABI and its own hardcoded endpoint table, and falls back to them whenever
// `getPublicClient` is not supplied to createViemAdapterFromProvider().
//
// This module is the single place that turns a chain ID into a client that respects the
// endpoint registry, so SDK-owned and app-owned reads finally agree on how to reach a chain.

import {
  createPublicClient,
  fallback,
  http,
  type Chain,
  type PublicClient,
  type Transport,
} from 'viem';
import { getClientRpcUrls, getServerRpcUrls } from './rpcEndpoints';

/**
 * Shared HTTP transport tuning.
 *
 * `batch` coalesces the many concurrent eth_calls the UI makes (balance, allowance,
 * decimals, gas) into one request per chain. The bounded timeout stops a hung node from
 * stalling the UI, and one cheap retry absorbs transient blips.
 */
const HTTP_OPTIONS = {
  batch: { wait: 16 },
  timeout: 8_000,
  retryCount: 1,
  retryDelay: 150,
} as const;

/**
 * Endpoints valid for the *current* runtime.
 *
 * The browser gets the proxy substituted for CORS-blocked endpoints. The server must not use
 * the proxy: `/api/rpc/...` is a relative path that only resolves against a page origin, so
 * server-side fetch would throw on it. Server code talks to upstreams directly, where CORS
 * does not apply.
 */
export function getRuntimeRpcUrls(chainId: number): string[] {
  return typeof window === 'undefined'
    ? getServerRpcUrls(chainId)
    : getClientRpcUrls(chainId);
}

/** Builds a transport for a chain from the endpoint registry, with failover when possible. */
export function transportForChain(chainId: number): Transport {
  const urls = getRuntimeRpcUrls(chainId);

  // No registry entry: let Viem fall back to the chain's own default RPC.
  if (urls.length === 0) return http(undefined, HTTP_OPTIONS);
  if (urls.length === 1) return http(urls[0], HTTP_OPTIONS);

  // Ranking re-sorts by observed latency/stability so traffic migrates to the healthiest
  // node rather than sticking with a degraded primary.
  return fallback(
    urls.map((url) => http(url, HTTP_OPTIONS)),
    { rank: { interval: 30_000 } }
  );
}

/**
 * Clients are cached per chain so repeated reads reuse one connection pool and one batch
 * window instead of constructing a fresh client (and fresh batching state) per call.
 */
const clientCache = new Map<number, PublicClient>();

/** Returns a cached, registry-aware PublicClient for a chain. */
export function getPublicClientForChain(chainId: number, chain?: Chain): PublicClient {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const client = createPublicClient({
    chain,
    transport: transportForChain(chainId),
  }) as PublicClient;

  clientCache.set(chainId, client);
  return client;
}

/**
 * Drop-in for the Circle SDK's optional `getPublicClient` option.
 *
 * Passing this to createViemAdapterFromProvider() / createSolanaAdapterFromProvider() makes
 * every read the SDK performs (balances, allowances, receipts, gas) go through our endpoint
 * registry instead of the SDK's hardcoded table. Without it the SDK silently defaults to
 * `getDefaultPublicClient(new Map())`, which is how Arc reads ended up hitting a CORS-blocked
 * endpoint even though the rest of the app was proxying correctly.
 */
export const circlePublicClientFactory = ({ chain }: { chain: Chain }): PublicClient =>
  getPublicClientForChain(chain.id, chain);
