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
  protocolFeeUnits: bigint;     // Circle fast transfer protocol fee (0 for standard)
  protocolFeeFormatted: string; // E.g. "0.00" or "0.325"
  forwardingFeeUnits: bigint;   // Circle forwarding service fee for destination minting
  forwardingFeeFormatted: string;// E.g. "0.02" or "1.014"
  totalFeeUnits: bigint;        // protocolFeeUnits + forwardingFeeUnits
  totalFeeFormatted: string;    // Sum of all fees deducted from transfer
  maxFeeUnits: bigint;          // Fee cap sent to depositForBurnWithHook (totalFee + safety buffer)
  maxFeeFormatted: string;
  expectedReceiveAmount: string;// E.g. "99.95" (sendAmount - totalFee)
  expectedReceiveUnits: bigint;
  speedMode: 'standard' | 'fast';
  isForwarding: boolean;
  estimatedDuration: string;
  sourceGasEstimateUnits?: bigint; // On Arc: reserved in native USDC; on EVM: in ETH
  isArcSource: boolean;
  expiresAt: number;            // Timestamp after which quote must refresh (60s)
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
 * Covers both Circle protocol fees (fast transfers) and forwarding service fees (destination minting).
 */
export async function getRouteFeeQuote(
  sourceChainId: number,
  destChainId: number,
  amount: string,
  speedMode: 'standard' | 'fast' = 'standard',
  isForwarding = true,
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
  const forwardingActive = isForwarding && dstConfig.supportsForwardingDest;

  let protocolFeeUnits = 0n;
  let forwardingFeeUnits = 0n;

  try {
    const url = `${baseUrl}/v2/burn/USDC/fees/${srcConfig.domain}/${dstConfig.domain}?forward=${forwardingActive}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000),
    });

    if (response.ok) {
      const data = await response.json();
      const tiers: Array<{
        finalityThreshold: number;
        minimumFee?: number;
        forwardFee?: { low?: number; med?: number; high?: number };
      }> = Array.isArray(data) ? data : data?.fees || [];

      // Match target threshold: 1000 for fast, 2000 for standard
      const targetThreshold = speedMode === 'fast' && srcConfig.supportsFastTransferSource ? 1000 : 2000;
      const matchedTier = tiers.find(t => t.finalityThreshold === targetThreshold) || tiers[0];

      if (matchedTier) {
        // 1. Protocol Fee (Fast transfer)
        if (targetThreshold === 1000 && typeof matchedTier.minimumFee === 'number' && matchedTier.minimumFee > 0) {
          protocolFeeUnits = parseUsdcUnits(matchedTier.minimumFee.toString());
        }

        // 2. Forwarding Fee (Relayer destination mint)
        if (forwardingActive && matchedTier.forwardFee) {
          const medFee = matchedTier.forwardFee.med ?? matchedTier.forwardFee.high ?? matchedTier.forwardFee.low ?? 0;
          forwardingFeeUnits = BigInt(Math.round(medFee));
        }
      }
    } else {
      throw new Error(`Iris fee query HTTP ${response.status}`);
    }
  } catch (err) {
    // Documented fallback based on destination gas dynamics
    console.warn('Iris fee endpoint query failed, using documented route estimates:', err);

    // Fast protocol fee fallback (~10 bps with 0.01 USDC min if source supports fast)
    if (speedMode === 'fast' && srcConfig.supportsFastTransferSource) {
      const bpsFee = (sendAmountUnits * 10n) / 10_000n;
      protocolFeeUnits = bpsFee < 10_000n ? 10_000n : bpsFee;
    }

    // Forwarding fee fallback
    if (forwardingActive) {
      // Ethereum L1 destination mint costs significantly more gas (~1.25 USDC)
      if (dstConfig.id === 1 || dstConfig.id === 11155111) {
        forwardingFeeUnits = 1_250_000n; // 1.25 USDC
      } else {
        // Arc and EVM L2s (Base, Arbitrum)
        forwardingFeeUnits = 25_000n; // 0.025 USDC
      }
    }
  }

  // Total fee deducted from the bridge principal
  const totalFeeUnits = protocolFeeUnits + forwardingFeeUnits;

  if (sendAmountUnits <= totalFeeUnits) {
    throw new Error(
      `Amount must be greater than required total route fees of ${formatUsdcUnits(totalFeeUnits, 4)} USDC ` +
      `(${formatUsdcUnits(protocolFeeUnits, 4)} protocol + ${formatUsdcUnits(forwardingFeeUnits, 4)} forwarding).`
    );
  }

  // maxFee cap passed to depositForBurnWithHook
  // Circle recommends total fee + ~10% safety cushion (min +0.005 USDC) to prevent reverts on inclusion
  let maxFeeUnits = 0n;
  if (forwardingActive || protocolFeeUnits > 0n) {
    maxFeeUnits = totalFeeUnits + (totalFeeUnits / 10n) + 5_000n;
  }

  const expectedReceiveUnits = sendAmountUnits - totalFeeUnits;

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
    forwardingFeeUnits,
    forwardingFeeFormatted: formatUsdcUnits(forwardingFeeUnits, 4),
    totalFeeUnits,
    totalFeeFormatted: formatUsdcUnits(totalFeeUnits, 4),
    maxFeeUnits,
    maxFeeFormatted: formatUsdcUnits(maxFeeUnits, 4),
    expectedReceiveAmount: formatUsdcUnits(expectedReceiveUnits, 4),
    expectedReceiveUnits,
    speedMode,
    isForwarding: forwardingActive,
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
