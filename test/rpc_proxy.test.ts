// test/rpc_proxy.test.ts
// Unit tests for RPC proxy method allowlist and security boundary

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedMethod } from '../lib/rpcAllowlist.ts';

describe('RPC Proxy Security Boundary', () => {
  it('permits required read-only methods for balances, receipts, and blocks', () => {
    const requiredMethods = [
      'eth_blockNumber',
      'eth_call',
      'eth_getBalance',
      'eth_getTransactionReceipt',
      'eth_getTransactionByHash',
      'eth_gasPrice',
      'eth_estimateGas',
      'eth_chainId',
      'net_version',
      'getBalance',
      'getTokenAccountBalance',
      'getAccountInfo',
    ];

    for (const method of requiredMethods) {
      assert.equal(isAllowedMethod(method), true, `Expected ${method} to be permitted`);
    }
  });

  it('strictly blocks dangerous, state-mutating, or private key RPC methods', () => {
    const dangerousMethods = [
      'eth_sendTransaction',
      'eth_sendRawTransaction',
      'eth_sign',
      'personal_sign',
      'eth_signTypedData',
      'eth_signTypedData_v4',
      'debug_traceTransaction',
      'admin_addPeer',
      'miner_start',
    ];

    for (const method of dangerousMethods) {
      assert.equal(isAllowedMethod(method), false, `Expected ${method} to be blocked`);
    }
  });

  it('rejects non-string or malformed method payloads', () => {
    assert.equal(isAllowedMethod(null), false);
    assert.equal(isAllowedMethod(undefined), false);
    assert.equal(isAllowedMethod(123), false);
    assert.equal(isAllowedMethod({}), false);
  });
});
