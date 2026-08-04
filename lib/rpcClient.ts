// lib/rpcClient.ts
// Shared JSON-RPC caller used by every browser-side read in the app.
//
// Replaces four near-identical hand-rolled fetch loops (useUSDCBalance,
// UnifiedPortfolioDrawer, TransactionHistoryDrawer, BridgeCard) that each had their own
// endpoint list, their own retry behaviour, and — in two cases — no timeout at all. A
// request to a hung node could sit open indefinitely, which is a large part of why balances
// and the portfolio drawer felt slow to load.

import { getClientRpcUrls, getSolanaRpcUrls, proxyUrl, SOLANA_PROXY_ID } from './rpcEndpoints';

/** Per-endpoint timeout. Short enough that failing over stays imperceptible. */
const DEFAULT_TIMEOUT_MS = 6_000;

export interface JsonRpcRequest {
  method: string;
  params?: unknown[];
}

interface JsonRpcResponse<T> {
  result?: T;
  error?: { code: number; message: string };
}

/**
 * Calls a JSON-RPC method against a chain, trying each configured endpoint in order.
 *
 * Returns null when every endpoint fails, so callers can fall back to a cached or
 * zero value instead of surfacing a hard error for a background balance refresh.
 */
export async function rpcCall<T = string>(
  chainId: number,
  request: JsonRpcRequest,
  options: { timeoutMs?: number } = {}
): Promise<T | null> {
  const urls = getClientRpcUrls(chainId);
  return callWithFailover<T>(urls, request, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

/** Solana equivalent of rpcCall. */
export async function solanaRpcCall<T = unknown>(
  request: JsonRpcRequest,
  options: { timeoutMs?: number } = {}
): Promise<T | null> {
  const urls = [...getSolanaRpcUrls(), proxyUrl(SOLANA_PROXY_ID)];
  return callWithFailover<T>(urls, request, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

async function callWithFailover<T>(
  urls: string[],
  request: JsonRpcRequest,
  timeoutMs: number
): Promise<T | null> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: request.method,
    params: request.params ?? [],
  });

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) continue;

      const json = (await response.json()) as JsonRpcResponse<T>;
      // A JSON-RPC-level error means the node answered; retrying elsewhere will give the
      // same answer, so stop here.
      if (json.error) return null;
      if (json.result !== undefined) return json.result;
    } catch {
      // Transport failure (timeout, DNS, CORS) — try the next endpoint.
    }
  }

  return null;
}

/** Selector for the ERC-20 balanceOf(address) call. */
const BALANCE_OF_SELECTOR = '0x70a08231';

/**
 * Reads an ERC-20 balance and returns it as a human-readable number.
 * Returns null when every endpoint fails, which callers treat as "unknown", distinct
 * from a real zero balance.
 */
export async function readErc20Balance(
  chainId: number,
  tokenAddress: string,
  ownerAddress: string,
  decimals: number
): Promise<number | null> {
  if (!ownerAddress || !tokenAddress) return null;

  // ABI encoding for balanceOf(address): selector + 32-byte left-padded address.
  const paddedOwner = ownerAddress.toLowerCase().replace('0x', '').padStart(64, '0');
  const data = `${BALANCE_OF_SELECTOR}${paddedOwner}`;

  const result = await rpcCall<string>(chainId, {
    method: 'eth_call',
    params: [{ to: tokenAddress, data }, 'latest'],
  });

  if (!result || result === '0x') return null;

  try {
    return Number(BigInt(result)) / 10 ** decimals;
  } catch {
    return null;
  }
}

/** Measures round-trip latency to a chain's fastest reachable endpoint. */
export async function measureChainLatency(
  chainId: number,
  timeoutMs = 2_500
): Promise<number> {
  const started = Date.now();
  const result = await rpcCall<string>(
    chainId,
    { method: 'eth_blockNumber' },
    { timeoutMs }
  );
  return result === null ? -1 : Date.now() - started;
}
