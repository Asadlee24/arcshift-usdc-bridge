// test/bridge_quotes.test.ts
// Unit tests for bridge quote calculations, precision rules, and Arc gas reservations

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAmountInput,
  parseUsdcUnits,
  formatUsdcUnits,
  calculateMaxBridgeAmount,
  getRouteFeeQuote,
} from '../lib/bridge/quotes.ts';

describe('Bridge Quotes & Validation Rules', () => {
  it('validates correct numeric USDC input', () => {
    assert.deepEqual(validateAmountInput('10'), { valid: true, cleanValue: '10' });
    assert.deepEqual(validateAmountInput('0.05'), { valid: true, cleanValue: '0.05' });
    assert.deepEqual(validateAmountInput('100.123456'), { valid: true, cleanValue: '100.123456' });
  });

  it('rejects invalid inputs, negative numbers, scientific notation, and excessive decimals', () => {
    assert.equal(validateAmountInput('').valid, false);
    assert.equal(validateAmountInput('-10').valid, false);
    assert.equal(validateAmountInput('1e5').valid, false);
    assert.equal(validateAmountInput('abc').valid, false);
    assert.equal(validateAmountInput('1.1234567').valid, false); // >6 decimals
  });

  it('parses USDC strings to exact 6-decimal BigInt units without float precision loss', () => {
    assert.equal(parseUsdcUnits('1'), 1_000_000n);
    assert.equal(parseUsdcUnits('0.5'), 500_000n);
    assert.equal(parseUsdcUnits('0.000001'), 1n);
    assert.equal(parseUsdcUnits('12.345678'), 12_345_678n);
  });

  it('formats BigInt units to exact decimal strings', () => {
    assert.equal(formatUsdcUnits(1_000_000n, 2), '1.00');
    assert.equal(formatUsdcUnits(500_000n, 2), '0.50');
    assert.equal(formatUsdcUnits(12_345_678n, 6), '12.345678');
  });

  it('calculateMaxBridgeAmount reserves gas on Arc but provides full balance on non-Arc EVM', () => {
    const balance = 10_000_000n; // 10 USDC

    // Non-Arc EVM chain (e.g. Base) -> 100% available
    const nonArcMax = calculateMaxBridgeAmount(balance, false);
    assert.equal(nonArcMax.maxUnits, 10_000_000n);
    assert.equal(nonArcMax.maxFormatted, '10.000000');

    // Arc chain -> reserves native gas in USDC units + safety buffer
    const arcMax = calculateMaxBridgeAmount(balance, true);
    assert.ok(arcMax.maxUnits < balance);
    assert.ok(arcMax.maxUnits > 9_000_000n); // Gas reserved is ~0.005 USDC

    // Arc chain with balance smaller than gas reservation returns 0
    const tinyBalance = 1_000n; // 0.001 USDC
    const tinyMax = calculateMaxBridgeAmount(tinyBalance, true);
    assert.equal(tinyMax.maxUnits, 0n);
    assert.equal(tinyMax.maxFormatted, '0.00');
  });

  it('calculates standard route fee quote with dynamic forwarding fee', async () => {
    // Base (8453) -> Arc Mainnet (5042) with forwarding active (default)
    const quote = await getRouteFeeQuote(8453, 5042, '100', 'standard', true, 'mainnet');
    assert.equal(quote.sendAmount, '100');
    assert.equal(quote.protocolFeeUnits, 0n); // Zero protocol fee for standard
    assert.ok(quote.forwardingFeeUnits > 0n);  // Forwarding fee is non-zero
    assert.equal(quote.totalFeeUnits, quote.forwardingFeeUnits);
    assert.ok(quote.maxFeeUnits > quote.totalFeeUnits); // Includes slippage buffer
    assert.equal(quote.sourceDomain, 6);
    assert.equal(quote.destDomain, 26);
  });

  it('calculates manual standard route fee quote with zero total fees when forwarding is disabled', async () => {
    // Base (8453) -> Arc Mainnet (5042) without forwarding
    const quote = await getRouteFeeQuote(8453, 5042, '100', 'standard', false, 'mainnet');
    assert.equal(quote.sendAmount, '100');
    assert.equal(quote.protocolFeeUnits, 0n);
    assert.equal(quote.forwardingFeeUnits, 0n);
    assert.equal(quote.totalFeeUnits, 0n);
    assert.equal(quote.maxFeeUnits, 0n);
    assert.equal(quote.expectedReceiveAmount, '100.0000');
  });

  it('calculates fast route fee quote with protocol fee and forwarding fee', async () => {
    // Base (8453) -> Arc Mainnet (5042) fast transfer
    const quote = await getRouteFeeQuote(8453, 5042, '100', 'fast', true, 'mainnet');
    assert.equal(quote.sendAmount, '100');
    assert.ok(quote.protocolFeeUnits > 0n); // Fast fee is > 0
    assert.ok(quote.forwardingFeeUnits > 0n);
    assert.equal(quote.totalFeeUnits, quote.protocolFeeUnits + quote.forwardingFeeUnits);
    assert.ok(quote.maxFeeUnits > quote.totalFeeUnits);
  });
});
