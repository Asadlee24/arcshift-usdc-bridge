// hooks/useBridge.ts
// Core CCTP Bridge Hook managing the 4-step progress state machine, timers, and transaction links (Official SDK & Fallback Enabled)
// v2: Supports Fast/Standard speed modes and forwarding service toggle

import { useState, useEffect, useRef, useCallback } from 'react';
import { getChainById } from '../constants/chains';
import { writeContract, waitForTransactionReceipt, getAccount, switchChain, signMessage, readContract, getGasPrice } from '@wagmi/core';
import { config } from '../lib/wagmi';
import { parseUnits, pad, encodeFunctionData } from 'viem';
import { addTransaction, updateTransaction } from './useTransactionHistory';

// Solana & Circle AppKit Imports
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey as SolanaPublicKey } from '@solana/web3.js';
// Note: createSolanaAdapterFromProvider is loaded dynamically in the bridge function to avoid SSR issues
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { appKit } from '../lib/appKit';
import { getSolanaRpcUrl } from '../lib/rpcEndpoints';
import { circlePublicClientFactory } from '../lib/publicClient';

// Helper to build a Solana provider compliant with Circle's SolanaAdapter Zod validation requirements
function buildSolanaProviderAdapter(solanaWallet: any) {
  const activeAdapter = solanaWallet?.wallet?.adapter;
  const windowSolana = (typeof window !== 'undefined' && (window as any).solana);

  const rawProvider = activeAdapter ?? windowSolana ?? solanaWallet;

  // Ensure isConnected is strictly a boolean primitive (true/false), never undefined
  const isConnected = Boolean(
    solanaWallet?.connected ||
    solanaWallet?.publicKey ||
    (typeof rawProvider?.isConnected === 'boolean' ? rawProvider.isConnected : false) ||
    (typeof rawProvider?.isConnected === 'function' ? rawProvider.isConnected() : false) ||
    rawProvider?.connected ||
    (typeof windowSolana?.isConnected === 'boolean' ? windowSolana.isConnected : false) ||
    (typeof windowSolana?.isConnected === 'function' ? windowSolana.isConnected() : false) ||
    windowSolana?.connected ||
    windowSolana?.publicKey
  );

  const publicKey = solanaWallet?.publicKey ?? rawProvider?.publicKey ?? windowSolana?.publicKey ?? null;

  const signTransaction = (transaction: any) => {
    if (solanaWallet?.signTransaction) return solanaWallet.signTransaction(transaction);
    if (rawProvider?.signTransaction) return rawProvider.signTransaction(transaction);
    if (windowSolana?.signTransaction) return windowSolana.signTransaction(transaction);
    throw new Error('Solana wallet does not support signTransaction.');
  };

  const signAllTransactions = (transactions: any[]) => {
    if (solanaWallet?.signAllTransactions) return solanaWallet.signAllTransactions(transactions);
    if (rawProvider?.signAllTransactions) return rawProvider.signAllTransactions(transactions);
    if (windowSolana?.signAllTransactions) return windowSolana.signAllTransactions(transactions);
    throw new Error('Solana wallet does not support signAllTransactions.');
  };

  const signMessage = (message: any) => {
    if (solanaWallet?.signMessage) return solanaWallet.signMessage(message);
    if (rawProvider?.signMessage) return rawProvider.signMessage(message);
    if (windowSolana?.signMessage) return windowSolana.signMessage(message);
    throw new Error('Solana wallet does not support signMessage.');
  };

  const connect = () => {
    if (solanaWallet?.connect) return solanaWallet.connect();
    if (rawProvider?.connect) return rawProvider.connect();
    if (windowSolana?.connect) return windowSolana.connect();
    return Promise.resolve();
  };

  const disconnect = () => {
    if (solanaWallet?.disconnect) return solanaWallet.disconnect();
    if (rawProvider?.disconnect) return rawProvider.disconnect();
    if (windowSolana?.disconnect) return windowSolana.disconnect();
    return Promise.resolve();
  };

  return {
    ...(typeof rawProvider === 'object' ? rawProvider : {}),
    isConnected: isConnected,
    connected: isConnected,
    publicKey: publicKey,
    signTransaction,
    signAllTransactions,
    signMessage,
    connect,
    disconnect,
  };
}

/**
 * Verifies an assembled Solana provider before it reaches the Circle SDK.
 *
 * Throws a descriptive error naming the missing capability. Without this, an incomplete
 * provider fails inside the SDK's Zod schema and the user sees a generic message (or the
 * flow appears to hang), which is the reported EVM->Solana symptom.
 */
function assertValidSolanaProvider(provider: any, context: 'source' | 'destination'): void {
  const where = `${context} Solana wallet`;

  if (!provider || typeof provider !== 'object') {
    throw new Error(
      `Could not read your ${where}. Open your Solana wallet extension (e.g. Phantom), unlock it, and reconnect.`
    );
  }

  // publicKey is the field most likely to be missing — the wallet can report "connected"
  // while still exposing no account.
  if (!provider.publicKey) {
    throw new Error(
      `Your ${where} is not reporting an account address. Unlock the wallet and reconnect using the Phantom button in the navbar.`
    );
  }

  if (typeof provider.publicKey.toBase58 !== 'function' && typeof provider.publicKey.toString !== 'function') {
    throw new Error(
      `Your ${where} returned an account address in an unrecognised format. Try updating your wallet extension.`
    );
  }

  if (provider.isConnected !== true) {
    throw new Error(
      `Your ${where} is not connected. Connect it using the Phantom button in the navbar, then try again.`
    );
  }

  for (const method of ['signTransaction', 'signAllTransactions'] as const) {
    if (typeof provider[method] !== 'function') {
      throw new Error(
        `Your ${where} does not expose ${method}(), which Circle CCTP requires to move USDC. ` +
        `Use a wallet that supports transaction signing (e.g. Phantom or Solflare).`
      );
    }
  }
}

// ERC-20 ABI required for strictly enforcing deductions via Wagmi
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  }
] as const;

// TokenMessenger depositForBurn ABI
const TOKEN_MESSENGER_ABI = [
  {
    name: 'depositForBurn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' }
    ],
    outputs: []
  }
] as const;

// MessageTransmitter receiveMessage ABI
const MESSAGE_TRANSMITTER_ABI = [
  {
    name: 'receiveMessage',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' }
    ],
    outputs: []
  }
] as const;

export type BridgeStepName = 'approve' | 'burn' | 'attest' | 'mint';

export interface BridgeStep {
  name: BridgeStepName;
  status: 'pending' | 'active' | 'done' | 'error';
  label: string;
  description: string;
  txHash?: string;
  explorerUrl?: string;
}

export type BridgeStatus = 'idle' | 'bridging' | 'success' | 'error';

interface AttestationMessage {
  message: string;
  attestation: string;
  status: string;
}

interface AttestationResponse {
  messages: AttestationMessage[];
}

/**
 * Thrown when the burn succeeded on-chain but the attestation could not be retrieved.
 * The burn tx hash is carried so the caller can surface it — the user's funds are burned
 * and the mint is claimable later; this must never be reported as a generic failure.
 */
export class AttestationTimeoutError extends Error {
  constructor(public readonly burnTxHash: string) {
    super(
      'Your USDC was burned on the source chain, but the Circle attestation has not arrived yet. ' +
      'Funds are not lost — the transfer can be completed once the attestation is available. ' +
      `Save this burn transaction hash: ${burnTxHash}`
    );
    this.name = 'AttestationTimeoutError';
  }
}

/**
 * Polls Circle's Iris API for the attestation covering a burn.
 *
 * Uses exponential backoff with jitter (~5 minutes total) rather than a flat 5s x 12.
 * CCTP attestations commonly take 15s-2min on testnet and can exceed the old 60s ceiling
 * under load, which caused spurious timeouts.
 *
 * On timeout this THROWS. It previously returned a hardcoded fake attestation
 * ("0x" + "a".repeat(100)) with status "complete", which caused the UI to render success
 * for a transfer that never completed.
 */
async function retrieveAttestation(
  transactionHash: string,
  fromDomain: number,
  maxAttempts = 60
): Promise<AttestationMessage> {
  const url = `https://iris-api-sandbox.circle.com/v2/messages/${fromDomain}?transactionHash=${transactionHash}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, { method: 'GET' });

      if (response.ok) {
        const data = (await response.json()) as AttestationResponse;
        const message = data?.messages?.[0];
        if (message?.status === 'complete') {
          return message;
        }
        // 200 with a pending status is the normal "not ready yet" case — keep polling.
      } else if (response.status === 404) {
        // Iris has not indexed the burn yet. Expected immediately after submission.
      } else if (response.status === 429) {
        // Rate limited — respect Retry-After when present.
        const retryAfter = Number(response.headers.get('Retry-After'));
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }
      } else if (response.status >= 400 && response.status < 500) {
        // A genuine client error (malformed hash, bad domain) will never succeed on retry.
        throw new Error(
          `Circle attestation request rejected (HTTP ${response.status}). ` +
          `This usually means the source domain (${fromDomain}) or transaction hash is invalid.`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Circle attestation request rejected')) {
        throw error;
      }
      // Network-level failure — transient, fall through to backoff.
      console.warn(`Attestation poll attempt ${attempt + 1} failed:`, error);
    }

    // Gentle backoff: 1s, 1.5s, 2.25s ... capped at 6s, with jitter to avoid synchronised
    // retries. The cap matters for perceived speed — the previous curve (2s doubling to a
    // 30s ceiling) meant an attestation that completed at ~20s often went unnoticed until
    // ~45s because the poller was asleep. Attestations typically land in 15s-2min, so a 6s
    // ceiling keeps latency low while staying well within Iris rate limits.
    const backoff = Math.min(1000 * 1.5 ** attempt, 6000);
    const jitter = Math.random() * 500;
    await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
  }

  throw new AttestationTimeoutError(transactionHash);
}

// MessageTransmitter V2 address used across all supported testnets. CCTP V2 uses
// deterministic addressing, so this is chain-independent — it deliberately takes no
// chainId parameter. (It previously accepted one and ignored it, implying per-chain
// dispatch that did not exist.)
const MESSAGE_TRANSMITTER_ADDRESS = '0xe737e5cebeeba77efe34d4aa090756590b1ce275';
const getMessageTransmitterAddress = (): string => MESSAGE_TRANSMITTER_ADDRESS;

/**
 * Smallest transferable amount, in USDC.
 *
 * The maxFee sent to depositForBurn is max(amount * 0.01, 0.001 USDC). Below ~0.10 USDC
 * the flat 0.001 floor becomes a large proportion of the transfer and CCTP rejects the
 * burn. The previous UI floor of 0.01 USDC was under this and produced guaranteed reverts.
 */
export const MIN_BRIDGE_AMOUNT = 0.1;

/**
 * Validates a bridge amount before any on-chain call.
 * Returns an error string, or null when the amount is acceptable.
 */
export function validateBridgeAmount(amount: string, availableBalance?: number): string | null {
  if (!amount || amount.trim() === '') return 'Enter an amount to bridge';

  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return 'Enter a valid number';
  if (parsed <= 0) return 'Amount must be greater than 0';

  // USDC has 6 decimals; anything finer cannot be represented on-chain.
  const decimals = amount.includes('.') ? amount.split('.')[1].length : 0;
  if (decimals > 6) return 'USDC supports a maximum of 6 decimal places';

  if (parsed < MIN_BRIDGE_AMOUNT) {
    return `Minimum bridge amount is ${MIN_BRIDGE_AMOUNT} USDC — smaller transfers are rejected by CCTP because the fee would exceed the amount`;
  }

  if (availableBalance !== undefined && parsed > availableBalance) {
    return `Insufficient balance — you have ${availableBalance.toFixed(2)} USDC`;
  }

  return null;
}

export function useBridge() {
  const solanaWallet = useWallet();
  // Use a ref so executeBridge always sees the LATEST solanaWallet (avoids stale closure)
  const solanaWalletRef = useRef(solanaWallet);
  useEffect(() => {
    solanaWalletRef.current = solanaWallet;
  });
  const [status, setStatus] = useState<BridgeStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arcshift-bridging-status', {
        detail: { isBridging: status === 'bridging' }
      }));
    }
  }, [status]);

  // Elapsed time tracker
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Custom tracking for the attestation wait time
  const [attestationElapsed, setAttestationElapsed] = useState(0);

  // Active step tracker
  const [steps, setSteps] = useState<BridgeStep[]>([
    {
      name: 'approve',
      status: 'pending',
      label: 'Approve Spend',
      description: 'Approving USDC spend on source chain',
    },
    {
      name: 'burn',
      status: 'pending',
      label: 'Burn USDC',
      description: 'Burning USDC via Circle CCTP',
    },
    {
      name: 'attest',
      status: 'pending',
      label: 'Circle Attestation',
      description: "Waiting for Circle's consensus signatures (~15s)",
    },
    {
      name: 'mint',
      status: 'pending',
      label: 'Mint on Arc',
      description: 'Minting native USDC on Arc Testnet',
    },
  ]);

  // Tx Hashes for success view
  const [sourceTxHash, setSourceTxHash] = useState<string>('');
  const [destTxHash, setDestTxHash] = useState<string>('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const attestTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (attestTimerRef.current) clearInterval(attestTimerRef.current);
    };
  }, []);

  // Wallet disconnect listener (Issue #14)
  const accountInfo = getAccount(config);
  useEffect(() => {
    if (!accountInfo.isConnected && !solanaWallet.connected && status === 'bridging') {
      setStatus('error');
      setError('Wallet disconnected during bridging operation.');
      if (timerRef.current) clearInterval(timerRef.current);
      if (attestTimerRef.current) clearInterval(attestTimerRef.current);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
      }
    }
  }, [accountInfo.isConnected, solanaWallet.connected, status]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setElapsedSeconds(0);
    setAttestationElapsed(0);
    setSourceTxHash('');
    setDestTxHash('');
    setSteps([
      {
        name: 'approve',
        status: 'pending',
        label: 'Approve Spend',
        description: 'Approving USDC spend on source chain',
      },
      {
        name: 'burn',
        status: 'pending',
        label: 'Burn USDC',
        description: 'Burning USDC via Circle CCTP',
      },
      {
        name: 'attest',
        status: 'pending',
        label: 'Circle Attestation',
        description: "Waiting for Circle's consensus signatures (~15s)",
      },
      {
        name: 'mint',
        status: 'pending',
        label: 'Mint on Arc',
        description: 'Minting native USDC on Arc Testnet',
      },
    ]);
    if (timerRef.current) clearInterval(timerRef.current);
    if (attestTimerRef.current) clearInterval(attestTimerRef.current);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
    }
  }, []);

  // Primary executeBridge function
  // speedMode: 'fast' => minFinalityThreshold=1000, 'standard' => minFinalityThreshold=2000
  const executeBridge = useCallback(async (
    fromChainId: number,
    toChainId: number,
    amount: string,
    speedMode: 'fast' | 'standard' = 'fast'
  ) => {
    // Always use the ref to get the latest solanaWallet (fix stale closure)
    const solanaWallet = solanaWalletRef.current;
    reset();
    setStatus('bridging');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: true } }));
    }

    // Start global elapsed timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    const fromChain = getChainById(fromChainId);
    const toChain = getChainById(toChainId);

    if (!fromChain || !toChain) {
      setStatus('error');
      setError('Unsupported chain configuration selected.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
      }
      return;
    }

    // Validate the amount before touching the wallet. The UI validates too, but this is the
    // real guard: executeBridge is also reachable via retry, and an amount below the CCTP
    // fee threshold produces a guaranteed on-chain revert that costs the user gas.
    const amountValidationError = validateBridgeAmount(amount);
    if (amountValidationError) {
      setStatus('error');
      setError(amountValidationError);
      if (timerRef.current) clearInterval(timerRef.current);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
      }
      return;
    }

    // Reject routes on chains CCTP does not support rather than letting the burn revert.
    if (fromChain.isComingSoon || toChain.isComingSoon) {
      const unsupported = fromChain.isComingSoon ? fromChain.name : toChain.name;
      setStatus('error');
      setError(`${unsupported} is not yet supported for CCTP transfers.`);
      if (timerRef.current) clearInterval(timerRef.current);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
      }
      return;
    }

    // SSR check
    if (typeof window === 'undefined') return;

    // Route through Circle AppKit for Solana transfers
    const isSolanaRoute = fromChain.isSolana || toChain.isSolana;
    if (isSolanaRoute) {
      if (fromChain.isSolana && (!solanaWallet.connected || !solanaWallet.publicKey)) {
        setStatus('error');
        setError('Please connect your Solana wallet first.');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
        }
        return;
      }
      if (toChain.isSolana && !solanaWallet.publicKey) {
        // Try to auto-connect if wallet is selected but not yet connected
        if (solanaWallet.wallet && !solanaWallet.connected) {
          try {
            await solanaWallet.connect();
          } catch (e) {
            // ignore, will fail below
          }
        }
        if (!solanaWallet.publicKey) {
          setStatus('error');
          setError('Please connect your Solana (Phantom) wallet using the purple Phantom button in the navbar, then try again.');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
          }
          return;
        }
      }
      if (!fromChain.isSolana) {
        const accountInfo = getAccount(config);
        if (!accountInfo.isConnected || !accountInfo.address) {
          setStatus('error');
          setError('Please connect your EVM wallet first.');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
          }
          return;
        }
        if (accountInfo.chainId !== fromChain.id) {
          try {
            await switchChain(config, { chainId: fromChain.id as any });
          } catch (e: any) {
            setStatus('error');
            setError(`Please switch your EVM wallet network to ${fromChain.name}.`);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
            }
            return;
          }
        }
      }

      setSteps([
        {
          name: 'approve',
          status: 'pending',
          label: 'Approve Spend',
          description: `Approving USDC spend on ${fromChain.name}`,
        },
        {
          name: 'burn',
          status: 'pending',
          label: 'Burn USDC',
          description: `Burning USDC via Circle CCTP on ${fromChain.name}`,
        },
        {
          name: 'attest',
          status: 'pending',
          label: 'Circle Attestation',
          description: "Waiting for Circle's consensus signatures (~15s)",
        },
        {
          name: 'mint',
          status: 'pending',
          label: `Mint on ${toChain.shortName}`,
          description: `Minting native USDC on ${toChain.name}`,
        },
      ]);

      try {
        let sourceAdapter: any;
        let destAdapter: any;

        const solanaProviderForAdapter = buildSolanaProviderAdapter(solanaWallet);

        if (fromChain.isSolana) {
          // Validate before handing the provider to the SDK so a bad shape produces a
          // specific error naming the missing capability, not an opaque Zod failure.
          assertValidSolanaProvider(solanaProviderForAdapter, 'source');
          const solanaAdapters = await import('@circle-fin/adapter-solana');
          sourceAdapter = await solanaAdapters.createSolanaAdapterFromProvider({
            provider: solanaProviderForAdapter as any,
            // 'confirmed' (not 'finalized') keeps the burn responsive: finalization on Solana
            // adds ~13s per confirmation wait. The registry URL honours NEXT_PUBLIC_SOLANA_RPC,
            // since the shared public devnet node rate-limits and stalls bridge submissions.
            connection: new Connection(fromChain.rpcUrl || getSolanaRpcUrl(), 'confirmed'),
          });
        } else {
          if (!window.ethereum) {
            throw new Error('EVM Wallet provider not detected. Please install/connect your EVM wallet.');
          }
          sourceAdapter = await createViemAdapterFromProvider({
            provider: window.ethereum as any,
            // Without this the SDK builds its own client from a hardcoded endpoint table and
            // calls Arc's RPC directly, which sends no CORS headers — the "Read contract
            // failed / Failed to fetch" balanceOf error. See lib/publicClient.ts.
            getPublicClient: circlePublicClientFactory,
          });
        }

        if (toChain.isSolana) {
          // For EVM→Solana: destination adapter must be the Solana adapter (await required as it returns a Promise)
          if (!solanaWallet.publicKey) {
            if (solanaWallet.wallet) {
              try { await solanaWallet.connect(); } catch (_) {}
            }
            if (!solanaWallet.publicKey) {
              throw new Error('Please connect your Solana (Phantom) wallet using the purple button in the navbar before bridging to Solana.');
            }
          }
          assertValidSolanaProvider(solanaProviderForAdapter, 'destination');
          const solanaAdapters = await import('@circle-fin/adapter-solana');
          destAdapter = await solanaAdapters.createSolanaAdapterFromProvider({
            provider: solanaProviderForAdapter as any,
            connection: new Connection(toChain.rpcUrl || getSolanaRpcUrl(), 'confirmed'),
          });
        } else {
          if (!window.ethereum) {
            throw new Error('EVM Wallet provider not detected. Please install/connect your EVM wallet.');
          }
          destAdapter = await createViemAdapterFromProvider({
            provider: window.ethereum as any,
            getPublicClient: circlePublicClientFactory,
          });
        }

        // AppKit only exposes a wildcard '*' listener — dispatch by event.method internally
        let tempBurnHash = '';
        const handleWildcard = (event: any) => {
          const method = event?.method || '';
          console.log('Circle CCTP event:', method, event);

          if (method === 'approve') {
            const txHash = event.values?.txHash || '';
            setSteps(prev => prev.map(s => s.name === 'approve' ? {
              ...s, status: 'done',
              txHash: txHash ? (txHash.substring(0, 10) + '...') : 'Approved',
              explorerUrl: txHash ? `${fromChain.explorerUrl}/tx/${txHash}` : undefined
            } : s));
            setSteps(prev => prev.map(s => s.name === 'burn' ? { ...s, status: 'active' } : s));

          } else if (method === 'burn') {
            const txHash = event.values?.txHash || '';
            tempBurnHash = txHash;
            setSourceTxHash(txHash);
            addTransaction({
              id: txHash || `sol_${Date.now()}`,
              userAddress: fromChain.isSolana
                ? (solanaWallet.publicKey?.toBase58() || '')
                : (getAccount(config).address || ''),
              fromChainId: fromChain.id,
              toChainId: toChain.id,
              amount,
              status: 'pending',
              burnTxHash: txHash
            });
            setSteps(prev => prev.map(s => s.name === 'burn' ? {
              ...s, status: 'done',
              txHash: txHash ? (txHash.substring(0, 10) + '...') : 'Burned',
              explorerUrl: fromChain.isSolana
                ? `https://solscan.io/tx/${txHash}?cluster=devnet`
                : `${fromChain.explorerUrl}/tx/${txHash}`
            } : s));
            setSteps(prev => prev.map(s => s.name === 'attest' ? { ...s, status: 'active' } : s));

          } else if (method === 'fetchAttestation') {
            setSteps(prev => prev.map(s => s.name === 'attest' ? {
              ...s, status: 'done', txHash: 'Confirmed',
              explorerUrl: `https://iris-api-sandbox.circle.com/v2/messages/${fromChain.cctpDomain}?transactionHash=${tempBurnHash}`
            } : s));
            setSteps(prev => prev.map(s => s.name === 'mint' ? { ...s, status: 'active' } : s));

          } else if (method === 'mint') {
            const txHash = event.values?.txHash || '';
            setDestTxHash(txHash);
            if (tempBurnHash) {
              updateTransaction(tempBurnHash, { status: 'success', mintTxHash: txHash });
            }
            setSteps(prev => prev.map(s => s.name === 'mint' ? {
              ...s, status: 'done',
              description: 'USDC claimed and minted on destination',
              txHash: txHash ? (txHash.substring(0, 10) + '...') : 'Minted',
              explorerUrl: toChain.isSolana
                ? `https://solscan.io/tx/${txHash}?cluster=devnet`
                : `${toChain.explorerUrl}/tx/${txHash}`
            } : s));
          }
        };

        appKit.on('*', handleWildcard);

        try {
          setSteps(prev => prev.map(s => s.name === 'approve' ? { ...s, status: 'active' } : s));

          console.log('Initiating Circle AppKit bridge:', {
            fromAppKitId: fromChain.appKitId,
            toAppKitId: toChain.appKitId,
            amount: amount,
            fromChain: fromChain.name,
            toChain: toChain.name
          });

          const result = await appKit.bridge({
            from: { adapter: sourceAdapter, chain: fromChain.appKitId as any },
            to: { adapter: destAdapter, chain: toChain.appKitId as any },
            amount: amount,
            token: 'USDC',
          });

          console.log('Solana bridge finished. Result:', result);

          if (result.state === 'success') {
            setStatus('success');
            window.dispatchEvent(new Event('bridge-success-refresh'));
          } else {
            const steps = (result as any)?.steps || [];
            const failedStep = steps.find((s: any) => s.state === 'error' || s.status === 'error');
            const stepName = failedStep?.name || 'unknown';
            const stepErrMsg = failedStep?.errorMessage || failedStep?.error?.message || failedStep?.error;
            const rootErr = (result as any)?.error?.message || (result as any)?.errorMessage || (result as any)?.error;

            const detailedMsg = stepErrMsg
              ? `Bridge step "${stepName}" failed: ${typeof stepErrMsg === 'object' ? JSON.stringify(stepErrMsg) : stepErrMsg}`
              : rootErr
              ? `Bridge failed: ${typeof rootErr === 'object' ? JSON.stringify(rootErr) : rootErr}`
              : `Bridge execution failed (state: ${result.state})`;

            throw new Error(detailedMsg);
          }
        } finally {
          appKit.off('*', handleWildcard);
        }
      } catch (err: any) {
        console.error('Solana-based CCTP bridge error (full):', {
          message: err?.message,
          cause: err?.cause,
          details: err?.details,
          data: err?.data,
          stack: err?.stack,
          raw: err,
        });
        setStatus('error');
        let fullErrorMsg = err?.message || 'An unexpected error occurred during Solana bridging.';
        if (err?.cause) {
          const causeStr = typeof err.cause === 'object' ? (err.cause.message || JSON.stringify(err.cause)) : String(err.cause);
          fullErrorMsg += ` [Cause: ${causeStr}]`;
        }
        if (err?.details) {
          fullErrorMsg += ` [Details: ${err.details}]`;
        }
        setError(fullErrorMsg);
        setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s));
      } finally {
        if (timerRef.current) clearInterval(timerRef.current);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
        }
      }
      return;
    }


    // Check window.ethereum injection
    if (!window.ethereum) {
      setStatus('error');
      setError('No compatible EVM browser wallet detected. Please connect MetaMask, OKX, or Rabby.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
      }
      return;
    }

    let activeBurnHash: string | undefined = undefined;
    try {
      // 1. Determine active user account via Wagmi
      const accountInfo = getAccount(config);
      if (!accountInfo.isConnected || !accountInfo.address) {
        throw new Error('Please connect your wallet first.');
      }

      // Check if user is currently connected to the source chain
      if (accountInfo.chainId !== fromChain.id) {
        await switchChain(config, { chainId: fromChain.id as any });
      }

      // Domain values for CCTP mapping
      const fromDomain = fromChain.cctpDomain ?? 0;
      const toDomain = toChain.cctpDomain ?? 0;

      // Reset steps with dynamic labels matching the current route
      setSteps([
        {
          name: 'approve',
          status: 'pending',
          label: 'Approve Spend',
          description: `Approving USDC spend on ${fromChain.name}`,
        },
        {
          name: 'burn',
          status: 'pending',
          label: 'Burn USDC',
          description: `Burning USDC via Circle CCTP on ${fromChain.name}`,
        },
        {
          name: 'attest',
          status: 'pending',
          label: 'Circle Attestation',
          description: "Waiting for Circle's consensus signatures (~15s)",
        },
        {
          name: 'mint',
          status: 'pending',
          label: `Mint on ${toChain.shortName}`,
          description: `Minting native USDC on ${toChain.name}`,
        },
      ]);

      // Spender and Messengers — same TokenMessengerV2 across all CCTP-supported testnets
      const tokenMessenger = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';
      
      const destinationTransmitter = getMessageTransmitterAddress();

      // Dynamically query decimals from the USDC contract
      let decimals = 6;
      try {
        const tokenDecimals = await readContract(config, {
          address: fromChain.usdcAddress as `0x${string}`,
          abi: [
            {
              name: 'decimals',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint8' }],
            },
          ],
          functionName: 'decimals',
        });
        if (typeof tokenDecimals === 'number') {
          decimals = tokenDecimals;
        }
      } catch (err) {
        console.warn("Failed to fetch decimals dynamically, defaulting to 6:", err);
      }

      const amountInUnits = parseUnits(amount, decimals);

      // Bytes32 parameters required for CCTP ABI.
      // This path is EVM->EVM only: any route touching Solana returns earlier via the
      // isSolanaRoute branch. A `toChain.isSolana` block used to sit here deriving the
      // destination ATA — it was unreachable dead code and has been removed.
      const destinationAddressBytes32 = pad(accountInfo.address, { size: 32 });
      const destinationCallerBytes32 = pad('0x', { size: 32 });

      // Dynamic maxFee: 1% of amount, minimum 1000 units
      // Circle CCTP v2 requires maxFee >= ~0.1% of amount to prevent revert
      // Using 1% gives safe headroom for all chain + amount combinations
      const maxFee = amountInUnits / BigInt(100) > BigInt(1000) ? amountInUnits / BigInt(100) : BigInt(1000);

      // ==========================================
      // STEP 1: APPROVE SPEND
      // ==========================================
      setSteps(prev => prev.map(s => s.name === 'approve' ? { ...s, status: 'active' } : s));

      // Query allowance to see if user has already approved enough USDC
      let needsApproval = true;
      try {
        const currentAllowance = await readContract(config, {
          address: fromChain.usdcAddress as `0x${string}`,
          abi: [
            {
              name: 'allowance',
              type: 'function',
              stateMutability: 'view',
              inputs: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' }
              ],
              outputs: [{ type: 'uint256' }],
            },
          ],
          functionName: 'allowance',
          args: [accountInfo.address as `0x${string}`, tokenMessenger as `0x${string}`],
        });
        if (typeof currentAllowance === 'bigint' && currentAllowance >= amountInUnits) {
          needsApproval = false;
        }
      } catch (err) {
        console.warn("Failed to fetch current allowance, proceeding with approval:", err);
      }

      let approveHash = '';

      // Fetch live gasPrice - used as a fallback for chains where
      // the wallet cannot estimate gas independently
      let currentGasPrice: bigint = BigInt(1500000000);
      try {
        currentGasPrice = await getGasPrice(config, { chainId: fromChain.id as any });
      } catch (err) {
        console.warn("Failed to fetch gas price, using fallback:", err);
      }

      const isOpStack = [11155420, 1301, 763373].includes(fromChain.id);

      // NOTE: approval failures deliberately propagate to the outer catch. This block
      // previously swallowed them and substituted a random hex string for the tx hash,
      // rendering a green check for an approval that never happened — after which the
      // burn would revert for insufficient allowance.
      if (needsApproval) {
        approveHash = await writeContract(config, {
          address: fromChain.usdcAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [tokenMessenger as `0x${string}`, amountInUnits],
          chainId: fromChain.id as any,
          ...(isOpStack ? {
            gas: BigInt(180000),
            gasPrice: currentGasPrice,
            type: 'legacy'
          } : {})
        });

        const approveReceipt = await waitForTransactionReceipt(config, { hash: approveHash as `0x${string}` });
        if (approveReceipt.status === 'reverted') {
          throw new Error('Approval transaction reverted on-chain. Check that you have enough gas.');
        }
      }

      setSteps(prev => prev.map(s => s.name === 'approve' ? {
        ...s,
        status: 'done',
        txHash: approveHash ? (approveHash.substring(0, 10) + '...') : 'Already Approved',
        explorerUrl: approveHash ? `${fromChain.explorerUrl}/tx/${approveHash}` : undefined
      } : s));

      // Notify 3D arc: approve done, burn starting
      window.dispatchEvent(new CustomEvent('bridge-step-change', { detail: { step: 'burn' } }));

      // ==========================================
      // STEP 2: BURN
      // ==========================================
      setSteps(prev => prev.map(s => s.name === 'burn' ? { ...s, status: 'active' } : s));

      let burnHash = '';
      try {
        const txHash = await writeContract(config, {
          address: tokenMessenger as `0x${string}`,
          abi: TOKEN_MESSENGER_ABI,
          functionName: 'depositForBurn',
          args: [
            amountInUnits,
            toDomain,
            destinationAddressBytes32,
            fromChain.usdcAddress as `0x${string}`,
            destinationCallerBytes32,
            maxFee,
            speedMode === 'fast' ? 1000 : 2000
          ],
          chainId: fromChain.id as any,
          ...(isOpStack ? {
            gas: BigInt(360000),
            gasPrice: currentGasPrice,
            type: 'legacy'
          } : {})
        });

        const burnReceipt = await waitForTransactionReceipt(config, { hash: txHash });
        if (burnReceipt.status === 'reverted') {
          throw new Error('Burn transaction reverted on-chain.');
        }
        burnHash = txHash;
      } catch (burnErr) {
        // The burn is the point of no return: if it fails, nothing was transferred and the
        // flow must stop. This previously fabricated a burn hash and carried on to the
        // attestation step, reporting success for USDC that was never burned.
        console.error('CCTP burn failed:', burnErr);
        throw burnErr;
      }

      activeBurnHash = burnHash;
      setSourceTxHash(burnHash);

      addTransaction({
        id: burnHash,
        userAddress: accountInfo.address,
        fromChainId: fromChain.id,
        toChainId: toChain.id,
        amount,
        status: 'pending',
        burnTxHash: burnHash
      });

      setSteps(prev => prev.map(s => s.name === 'burn' ? {
        ...s,
        status: 'done',
        txHash: burnHash.substring(0, 10) + '...',
        explorerUrl: `${fromChain.explorerUrl}/tx/${burnHash}`
      } : s));

      // Trigger UI balance updates
      window.dispatchEvent(new Event('bridge-success-refresh'));

      // Notify 3D arc: burn done, attestation starting
      window.dispatchEvent(new CustomEvent('bridge-step-change', { detail: { step: 'attest' } }));

      // ==========================================
      // STEP 3: ATTESTATION
      // ==========================================
      setSteps(prev => prev.map(s => s.name === 'attest' ? { ...s, status: 'active' } : s));

      attestTimerRef.current = setInterval(() => {
        setAttestationElapsed(prev => prev + 1);
      }, 1000);

      // Fetch official attestation
      const attestationMessage = await retrieveAttestation(burnHash, fromDomain);
      if (attestTimerRef.current) clearInterval(attestTimerRef.current);

      setSteps(prev => prev.map(s => s.name === 'attest' ? {
        ...s,
        status: 'done',
        txHash: 'Confirmed',
        explorerUrl: `https://iris-api-sandbox.circle.com/v2/messages/${fromDomain}?transactionHash=${burnHash}`
      } : s));

      // Notify 3D arc: attestation done, mint starting
      window.dispatchEvent(new CustomEvent('bridge-step-change', { detail: { step: 'mint' } }));

      // ==========================================
      // STEP 4: MINT ON DESTINATION
      // ==========================================
      setSteps(prev => prev.map(s => s.name === 'mint' ? { ...s, status: 'active' } : s));

      let mintHash = '';

      // Execute the REAL mint on-chain for both modes to ensure real bridging and valid explorer hashes
      const currentAccount = getAccount(config);
      if (currentAccount.chainId !== toChain.id) {
        await switchChain(config, { chainId: toChain.id as any });
      }

      let mintGasPrice;
      try {
        mintGasPrice = await getGasPrice(config, { chainId: toChain.id as any });
      } catch (err) {
        console.warn("Failed to fetch mint gas price:", err);
      }

      const isDestOpStack = [11155420, 1301, 763373].includes(toChain.id);

      try {
        const txHash = await writeContract(config, {
          address: destinationTransmitter as `0x${string}`,
          abi: MESSAGE_TRANSMITTER_ABI,
          functionName: 'receiveMessage',
          args: [
            attestationMessage.message as `0x${string}`,
            attestationMessage.attestation as `0x${string}`
          ],
          chainId: toChain.id as any,
          ...(isDestOpStack ? {
            gas: BigInt(400000),
            gasPrice: mintGasPrice,
            type: 'legacy'
          } : {})
        });

        const mintReceipt = await waitForTransactionReceipt(config, { hash: txHash });
        if (mintReceipt.status === 'reverted') {
          throw new Error('Mint transaction reverted on-chain. Please ensure your attestation is valid.');
        }
        mintHash = txHash;
      } catch (mintErr) {
        // A failed mint leaves the burn completed and the funds claimable with the existing
        // attestation. Surface that explicitly instead of fabricating a mint hash and
        // claiming success (which is what this did before).
        console.error('Mint transaction failed:', mintErr);
        const detail = mintErr instanceof Error ? mintErr.message : String(mintErr);
        throw new Error(
          `Your USDC was burned on ${fromChain.name} but the mint on ${toChain.name} did not complete. ` +
          `Funds are not lost — the attestation is valid and the mint can be retried. ` +
          `Burn tx: ${burnHash}. Underlying error: ${detail}`
        );
      }

      setDestTxHash(mintHash);

      updateTransaction(burnHash, {
        status: 'success',
        mintTxHash: mintHash
      });

      setSteps(prev => prev.map(s => s.name === 'mint' ? {
        ...s,
        status: 'done',
        description: 'USDC claimed and minted on destination',
        txHash: mintHash.substring(0, 10) + '...',
        explorerUrl: `${toChain.explorerUrl}/tx/${mintHash}`
      } : s));

      setStatus('success');
      // Notify 3D arc: full success — burst at destination
      window.dispatchEvent(new CustomEvent('bridge-step-change', { detail: { step: 'success' } }));
      window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
    } catch (err: any) {
      console.error('CCTP Bridge transaction failed:', err);
      if (activeBurnHash) {
        updateTransaction(activeBurnHash, { status: 'failed' });
      }
      setStatus('error');
      // Extract the most useful part of the error message for user display
      const rawMsg: string = err?.message || '';
      let friendlyError = 'Transaction was rejected or failed on chain.';
      if (rawMsg.includes('User rejected') || rawMsg.includes('user rejected')) {
        friendlyError = 'Transaction rejected in wallet. Please try again.';
      } else if (rawMsg.includes('insufficient funds')) {
        friendlyError = 'Insufficient funds for gas. Get testnet ETH from the Faucet.';
      } else if (rawMsg.includes('execution reverted')) {
        // Extract revert reason if available
        const revertMatch = rawMsg.match(/reason: (.+?)(?:\n|$)/);
        friendlyError = revertMatch
          ? `Contract reverted: ${revertMatch[1]}`
          : 'Contract execution reverted. Check USDC balance and approval.';
      } else if (rawMsg.length > 0) {
        friendlyError = rawMsg.substring(0, 180);
      }
      setError(friendlyError);
      setSteps(prev => prev.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' } : s));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      if (attestTimerRef.current) clearInterval(attestTimerRef.current);
    }
  }, [reset]);

  return {
    executeBridge,
    status,
    steps,
    sourceTxHash,
    destTxHash,
    error,
    elapsedSeconds,
    attestationElapsed,
    reset,
  };
}
