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
import { ALLOWED_RPC_METHODS, isAllowedMethod } from '../../../../lib/rpcAllowlist';

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

const MAX_BODY_BYTES = 32 * 1024; // 32 KB
const MAX_BATCH_SIZE = 10;

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

  // Enforce request body size limit
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'Payload exceeds maximum size limit (32KB)' },
      { status: 413 }
    );
  }

  let body: string;
  try {
    body = await request.text();
    if (body.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Payload exceeds maximum size limit (32KB)' },
        { status: 413 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Unable to read request body' }, { status: 400 });
  }

  // Validate JSON-RPC payload and method allowlist
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      if (parsed.length > MAX_BATCH_SIZE) {
        return NextResponse.json(
          { error: `Batch size exceeds limit of ${MAX_BATCH_SIZE}` },
          { status: 400 }
        );
      }
      for (const req of parsed) {
        if (!isAllowedMethod(req?.method)) {
          return NextResponse.json(
            { error: `Method '${req?.method || 'unknown'}' is not permitted` },
            { status: 403 }
          );
        }
      }
    } else if (typeof parsed === 'object' && parsed !== null) {
      if (!isAllowedMethod(parsed.method)) {
        return NextResponse.json(
          { error: `Method '${parsed.method || 'unknown'}' is not permitted` },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json({ error: 'Invalid JSON-RPC payload' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

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
        continue;
      }

      const text = await upstreamResponse.text();

      return new NextResponse(text, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      // Failover to next endpoint silently
    }
  }

  // Sanitized error response without leaking upstream URLs or credentials
  return NextResponse.json(
    {
      error: `RPC request failed across all redundant endpoints for chain ${chainId}`,
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
