// lib/bridge/quotes.ts
// Accurate dynamic route fee quotes, gas estimation, Arc native gas reservation, and numeric precision rules

import { getActiveEnvironment, getChainConfig, getIrisApiBaseUrl } from '../registry/index.ts';
import type { NetworkEnvironment } from '../registry/index.ts';

export interface RouteQuote {
  sourceChainId: number;
  destChainId: number;
  sourceDomain: number;
  destDomain: number;
  sendAmount: string;           // E.g. "100.00"
  sendAmountUnits: bigint;      // E.g. 100000000n (6 decimals)
  protocolFeeUnits: bigint;     // Protocol fee deducted from transfer
  protocolFeeFormatted: string; // E.g. "0.00" or "0.05"
  maxFeeUnits: bigint;          // Fee cap sent to depositForBurn
  maxFeeFormatted: string;
  expectedReceiveAmount: string;// E.g. "99.95"
  expectedReceiveUnits: bigint;
  speedMode: 'standard' | 'fast';
  estimatedDuration: string;
  sourceGasEstimateUnits?: bigint; // On Arc: reserved in USDC; on EVM: in ETH
  isArcSource: boolean;
  expiresAt: number;            // Timestamp after which quote must refresh
}

/**
 * Validates user input amount string.
 * Enforces strict 6-decimal precision, rejects negatives, NaN, scientific notation, and exponents.
 */
export function validateAmountInput(input: string): { valid: boolean; error?: string; cleanValue?: string } {
  if (!input || input.trim() === '') {
    return { valid: false, error: 'Enter an amount to bridge.' };
  }

  const trimmed = input.trim();

  // Reject scientific notation, negative numbers, or invalid characters
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid positive number.' };
  }

  const parts = trimmed.split('.');
  if (parts.length > 2) {
    return { valid: false, error: 'Invalid decimal format.' };
  }

  // USDC decimals is 6
  if (parts[1] && parts[1].length > 6) {
    return { valid: false, error: 'USDC supports a maximum of 6 decimal places.' };
  }

  const num = parseFloat(trimmed);
  if (isNaN(num) || num <= 0) {
    return { valid: false, error: 'Amount must be greater than 0.' };
  }

  return { valid: true, cleanValue: trimmed };
}

/**
 * Converts human readable amount string (e.g. "12.345678") to exact 6-decimal BigInt.
 */
export function parseUsdcUnits(amountStr: string): bigint {
  const parts = amountStr.trim().split('.');
  const whole = parts[0] || '0';
  let fraction = parts[1] || '';

  if (fraction.length > 6) {
    fraction = fraction.slice(0, 6);
  } else {
    fraction = fraction.padEnd(6, '0');
  }

  return BigInt(whole) * BigInt(1_000_000) + BigInt(fraction);
}

/**
 * Converts 6-decimal BigInt to formatted string with specified decimals.
 */
export function formatUsdcUnits(units: bigint, displayDecimals = 2): string {
  const isNegative = units < 0n;
  const absUnits = isNegative ? -units : units;
  const whole = absUnits / BigInt(1_000_000);
  const fraction = absUnits % BigInt(1_000_000);
  const fractionStr = fraction.toString().padStart(6, '0');

  const fullDecimal = `${whole}.${fractionStr}`;
  if (displayDecimals === 6) {
    return (isNegative ? '-' : '') + fullDecimal;
  }

  const rounded = parseFloat(fullDecimal).toFixed(displayDecimals);
  return (isNegative ? '-' : '') + rounded;
}

/**
 * Fetches dynamic route fee quote from Circle Iris API or computes documented fallback.
 */
export async function getRouteFeeQuote(
  sourceChainId: number,
  destChainId: number,
  amount: string,
  speedMode: 'standard' | 'fast' = 'standard',
  env?: NetworkEnvironment
): Promise<RouteQuote> {
  const activeEnv = env || getActiveEnvironment();
  const srcConfig = getChainConfig(sourceChainId, activeEnv);
  const dstConfig = getChainConfig(destChainId, activeEnv);

  if (!srcConfig || !dstConfig) {
    throw new Error(`Invalid route: chain config missing for ${sourceChainId} -> ${destChainId}`);
  }

  const amountValidation = validateAmountInput(amount);
  if (!amountValidation.valid) {
    throw new Error(amountValidation.error || 'Invalid amount');
  }

  const sendAmountUnits = parseUsdcUnits(amountValidation.cleanValue!);
  const baseUrl = getIrisApiBaseUrl(activeEnv);

  let feeBps = 0; // Standard transfer protocol fee is 0
  let minFeeUnits = 0n;

  if (speedMode === 'fast' && srcConfig.supportsFastTransferSource) {
    // Attempt to query live fee endpoint from Circle Iris API
    try {
      const response = await fetch(
        `${baseUrl}/v2/burn/USDC/fees/${srcConfig.domain}/${dstConfig.domain}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(4000),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Circle fee endpoint returns basis points or rate
        if (typeof data.fastTransferFeeBps === 'number') {
          feeBps = data.fastTransferFeeBps;
        } else if (typeof data.feeBps === 'number') {
          feeBps = data.feeBps;
        }
        if (data.minFee) {
          minFeeUnits = BigInt(data.minFee);
        }
      }
    } catch {
      // Use standard documented fast transfer fee: ~10 bps (0.10%)
      feeBps = 10;
      minFeeUnits = BigInt(10_000); // 0.01 USDC
    }
  }

  // Calculate protocol fee units
  let protocolFeeUnits = 0n;
  if (feeBps > 0) {
    protocolFeeUnits = (sendAmountUnits * BigInt(feeBps)) / BigInt(10_000);
    if (protocolFeeUnits < minFeeUnits) {
      protocolFeeUnits = minFeeUnits;
    }
  }

  // maxFee: Circle recommends setting maxFee slightly above expected fee (e.g. +10% or minimum 0.001 USDC buffer)
  // to avoid revert if rate changes slightly before inclusion.
  let maxFeeUnits = protocolFeeUnits;
  if (speedMode === 'fast' && protocolFeeUnits > 0n) {
    maxFeeUnits = protocolFeeUnits + (protocolFeeUnits / 10n) + BigInt(1_000);
  } else if (speedMode === 'standard') {
    maxFeeUnits = 0n; // Standard transfer requires maxFee = 0
  }

  if (sendAmountUnits <= protocolFeeUnits) {
    throw new Error(`Amount must be greater than required fee of ${formatUsdcUnits(protocolFeeUnits, 4)} USDC.`);
  }

  const expectedReceiveUnits = sendAmountUnits - protocolFeeUnits;

  // Finality estimation
  let estimatedDuration = '~2-5 minutes';
  if (speedMode === 'fast') {
    estimatedDuration = srcConfig.isNativeArc ? '~15-30 seconds' : '~30-60 seconds';
  } else {
    estimatedDuration = srcConfig.id === 1 || srcConfig.id === 11155111 ? '~15 minutes' : '~2-5 minutes';
  }

  return {
    sourceChainId,
    destChainId,
    sourceDomain: srcConfig.domain,
    destDomain: dstConfig.domain,
    sendAmount: amountValidation.cleanValue!,
    sendAmountUnits,
    protocolFeeUnits,
    protocolFeeFormatted: formatUsdcUnits(protocolFeeUnits, 4),
    maxFeeUnits,
    maxFeeFormatted: formatUsdcUnits(maxFeeUnits, 4),
    expectedReceiveAmount: formatUsdcUnits(expectedReceiveUnits, 4),
    expectedReceiveUnits,
    speedMode,
    estimatedDuration,
    isArcSource: srcConfig.isNativeArc,
    expiresAt: Date.now() + 60_000, // 1 minute quote validity
  };
}

/**
 * Calculates maximum bridgeable USDC amount considering gas reservation on Arc.
 * On Arc, gas token is USDC (18 decimals), so approval and burn gas must be subtracted
 * from the single underlying USDC balance.
 */
export function calculateMaxBridgeAmount(
  availableUsdcUnits: bigint,
  isNativeArc: boolean,
  estimatedGasUnits18: bigint = BigInt(300_000) * BigInt(1_500_000_000) // ~0.00045 USDC standard gas buffer
): { maxUnits: bigint; maxFormatted: string } {
  if (!isNativeArc) {
    // Non-Arc chains pay gas in native ETH/token, so full USDC balance can be bridged
    return {
      maxUnits: availableUsdcUnits,
      maxFormatted: formatUsdcUnits(availableUsdcUnits, 6),
    };
  }

  // On Arc, convert 18-decimal estimated gas to 6-decimal USDC equivalent (divide by 10^12)
  // Round UP to be conservative
  const gasInUsdc6 = (estimatedGasUnits18 + BigInt(999_999_999_999)) / BigInt(1_000_000_000_000);
  // Add safety buffer (e.g. 0.005 USDC = 5,000 units)
  const totalReservedGas6 = gasInUsdc6 + BigInt(5_000);

  if (availableUsdcUnits <= totalReservedGas6) {
    return { maxUnits: 0n, maxFormatted: '0.00' };
  }

  const maxUnits = availableUsdcUnits - totalReservedGas6;
  return {
    maxUnits,
    maxFormatted: formatUsdcUnits(maxUnits, 6),
  };
}
