// lib/rpcAllowlist.ts
// Strict method allowlist for JSON-RPC proxy.
// Only read-only methods needed for balance lookups, receipts, block heights, and gas estimation
// are permitted. Any wallet signing, transaction submission, or debug/admin methods are rejected.

export const ALLOWED_RPC_METHODS = new Set([
  'eth_blockNumber',
  'eth_call',
  'eth_getBalance',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_gasPrice',
  'eth_estimateGas',
  'eth_chainId',
  'net_version',
  'getSlot',
  'getBalance',
  'getTokenAccountBalance',
  'getAccountInfo',
  'getLatestBlockhash',
]);

export function isAllowedMethod(method: unknown): boolean {
  return typeof method === 'string' && ALLOWED_RPC_METHODS.has(method);
}
