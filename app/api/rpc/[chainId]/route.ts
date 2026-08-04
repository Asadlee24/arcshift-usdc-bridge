// app/api/rpc/[chainId]/route.ts
// Same-origin JSON-RPC proxy with automatic upstream failover.
//
// Purpose
// -------
// Arc Testnet's RPC (https://rpc.testnet.arc.network) returns no Access-Control-Allow-Origin
// header and rejects the CORS preflight with HTTP 400. The browser therefore refuses every
// direct request, which surfaced as:
//
//   Read contract failed: HTTP request failed.
//   URL: https://rpc.testnet.arc.network
//   Details: Failed to fetch
//
// CORS is a browser-enforced policy, not a server one, so proxying the identical request
// through our own origin makes it work. This route also gives every chain a resilient
// last-resort endpoint: if an upstream is down, it transparently tries the next one.

import { NextRequest, NextResponse } from 'next/server';
import { getServerRpcUrls, SOLANA_RPCS, SOLANA_PROXY_ID } from '../../../../lib/rpcEndpoints';

// Node runtime: some upstreams reject the edge runtime's fetch fingerprint.
export const runtime = 'nodejs';
// Never cache RPC responses — balances and nonces must always be live.
export const dynamic = 'force-dynamic';

/** Per-upstream timeout. Kept tight so a hung node fails over quickly. */
const UPSTREAM_TIMEOUT_MS = 12_000;

function resolveUpstreams(chainId: string): string[] {
  if (chainId === SOLANA_PROXY_ID) {
    return SOLANA_RPCS.map((e) => e.url);
  }
  const numeric = Number(chainId);
  return Number.isFinite(numeric) ? getServerRpcUrls(numeric) : [];
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ chainId: string }> }
) {
  const { chainId } = await context.params;
  const upstreams = resolveUpstreams(chainId);

  if (upstreams.length === 0) {
    return NextResponse.json(
      { error: `No RPC endpoint configured for chain ${chainId}` },
      { status: 400 }
    );
  }

  // Read the body once; it is replayed against each upstream on failover.
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read request body' }, { status: 400 });
  }

  const failures: string[] = [];

  for (const url of upstreams) {
    try {
      const upstreamResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: 'no-store',
      });

      if (!upstreamResponse.ok) {
        failures.push(`${url} -> HTTP ${upstreamResponse.status}`);
        continue;
      }

      const text = await upstreamResponse.text();

      // A JSON-RPC error is a legitimate answer (e.g. "execution reverted"), so it is
      // returned to the caller rather than triggering failover. Only transport-level
      // failures fall through to the next upstream.
      return new NextResponse(text, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      failures.push(`${url} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return NextResponse.json(
    {
      error: `All RPC endpoints failed for chain ${chainId}`,
      attempts: failures,
    },
    { status: 502 }
  );
}

/** Lets the browser preflight this route successfully (unlike the Arc upstream). */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
