// hooks/useBridge.ts
// Core CCTP Bridge Hook — All routes use Circle CCTP Forwarding Service (depositForBurnWithHook).
// 3-step flow: Approve → Burn & Forward → Circle Auto-Relay. No manual mint required.

import { useState, useEffect, useRef, useCallback } from 'react';
import { getChainById } from '../constants/chains';
import { writeContract, waitForTransactionReceipt, getAccount, switchChain, getGasPrice, readContract } from '@wagmi/core';
import { config } from '../lib/wagmi';
import { parseUnits, pad } from 'viem';
import { addTransaction, updateTransaction } from './useTransactionHistory';

// Solana & Circle AppKit Imports
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey as SolanaPublicKey } from '@solana/web3.js';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { appKit } from '../lib/appKit';
import { getSolanaRpcUrl } from '../lib/rpcEndpoints';
import { circlePublicClientFactory } from '../lib/publicClient';

// Forwarding Service Magic Bytes
export const CCTP_FORWARD_HOOK_DATA = '0x636374702d666f72776172640000000000000000000000000000000000000000' as `0x${string}`;

/**
 * Derives the Solana Associated Token Account (ATA) for a wallet address and USDC mint.
 * Required by Circle CCTP Forwarding Service when destination is Solana.
 */
export function getSolanaUsdcAta(walletPubKey: SolanaPublicKey, usdcMintPubKey: SolanaPublicKey): SolanaPublicKey {
  const TOKEN_PROGRAM_ID = new SolanaPublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  const ASSOCIATED_TOKEN_PROGRAM_ID = new SolanaPublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
  const [ata] = SolanaPublicKey.findProgramAddressSync(
    [walletPubKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), usdcMintPubKey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

// Helper to build a Solana provider compliant with Circle's SolanaAdapter Zod validation requirements
function buildSolanaProviderAdapter(solanaWallet: any) {
  const activeAdapter = solanaWallet?.wallet?.adapter;
  const windowSolana = (typeof window !== 'undefined' && (window as any).solana);

  const rawProvider = activeAdapter ?? windowSolana ?? solanaWallet;

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

function assertValidSolanaProvider(provider: any, context: 'source' | 'destination'): void {
  const where = `${context} Solana wallet`;

  if (!provider || typeof provider !== 'object') {
    throw new Error(
      `Could not read your ${where}. Open your Solana wallet extension (e.g. Phantom), unlock it, and reconnect.`
    );
  }

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
        `Your ${where} does not expose ${method}(), which Circle CCTP requires to move USDC.`
      );
    }
  }
}

// ERC-20 ABI required for enforcing spend approvals
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  }
] as const;

// TokenMessenger ABI supporting depositForBurn and depositForBurnWithHook
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
  },
  {
    name: 'depositForBurnWithHook',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
      { name: 'hookData', type: 'bytes' }
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
      } else if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After'));
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }
      } else if (response.status >= 400 && response.status < 500 && response.status !== 404) {
        throw new Error(
          `Circle attestation request rejected (HTTP ${response.status}). ` +
          `This usually means the source domain (${fromDomain}) or transaction hash is invalid.`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Circle attestation request rejected')) {
        throw error;
      }
      console.warn(`Attestation poll attempt ${attempt + 1} failed:`, error);
    }

    const backoff = Math.min(1000 * 1.5 ** attempt, 6000);
    const jitter = Math.random() * 500;
    await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
  }

  throw new AttestationTimeoutError(transactionHash);
}

const MESSAGE_TRANSMITTER_ADDRESS = '0xe737e5cebeeba77efe34d4aa090756590b1ce275';
const getMessageTransmitterAddress = (): string => MESSAGE_TRANSMITTER_ADDRESS;

export const MIN_BRIDGE_AMOUNT = 0.1;

export function validateBridgeAmount(amount: string, availableBalance?: number): string | null {
  if (!amount || amount.trim() === '') return 'Enter an amount to bridge';

  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return 'Enter a valid number';
  if (parsed <= 0) return 'Amount must be greater than 0';

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
  const solanaWalletRef = useRef(solanaWallet);
  useEffect(() => {
    solanaWalletRef.current = solanaWallet;
  });
  const [status, setStatus] = useState<BridgeStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bridgr-bridging-status', {
        detail: { isBridging: status === 'bridging' }
      }));
    }
  }, [status]);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [attestationElapsed, setAttestationElapsed] = useState(0);

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
      label: 'Burn & Forward USDC',
      description: 'Burning USDC & registering Circle auto-relay hook',
    },
    {
      name: 'attest',
      status: 'pending',
      label: 'Circle Auto-Relaying',
      description: 'Circle is processing & minting on destination automatically',
    },
  ]);

  const [sourceTxHash, setSourceTxHash] = useState<string>('');
  const [destTxHash, setDestTxHash] = useState<string>('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const attestTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (attestTimerRef.current) clearInterval(attestTimerRef.current);
    };
  }, []);

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
        label: 'Burn & Forward USDC',
        description: 'Burning USDC & registering Circle auto-relay hook',
      },
      {
        name: 'attest',
        status: 'pending',
        label: 'Circle Auto-Relaying',
        description: 'Circle is processing & minting on destination automatically',
      },
    ]);
    if (timerRef.current) clearInterval(timerRef.current);
    if (attestTimerRef.current) clearInterval(attestTimerRef.current);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
    }
  }, []);

  const executeBridge = useCallback(async (
    fromChainId: number,
    toChainId: number,
    amount: string,
    speedMode: 'fast' | 'standard' = 'fast'
  ) => {
    const solanaWallet = solanaWalletRef.current;
    reset();
    setStatus('bridging');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: true } }));
    }

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

    if (typeof window === 'undefined') return;

    // All routes use Circle CCTP Forwarding Service — always 3-step auto-relay
    const isForwarding = true;

    // ─── SOLANA ROUTE (AppKit) ──────────────────────────────────────────
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
        if (solanaWallet.wallet && !solanaWallet.connected) {
          try { await solanaWallet.connect(); } catch (e) {}
        }
        if (!solanaWallet.publicKey) {
          setStatus('error');
          setError('Please connect your Solana (Phantom) wallet using the Phantom button in the navbar, then try again.');
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
          label: 'Burn & Forward USDC',
          description: `Burning USDC & registering Circle auto-relay hook on ${fromChain.name}`,
        },
        {
          name: 'attest',
          status: 'pending',
          label: 'Circle Auto-Relaying',
          description: 'Circle is processing attestation & minting on destination automatically',
        },
      ]);

      try {
        let sourceAdapter: any;
        let destAdapter: any;

        const solanaProviderForAdapter = buildSolanaProviderAdapter(solanaWallet);

        if (fromChain.isSolana) {
          assertValidSolanaProvider(solanaProviderForAdapter, 'source');
          const solanaAdapters = await import('@circle-fin/adapter-solana');
          sourceAdapter = await solanaAdapters.createSolanaAdapterFromProvider({
            provider: solanaProviderForAdapter as any,
            connection: new Connection(fromChain.rpcUrl || getSolanaRpcUrl(), 'confirmed'),
          });
        } else {
          if (!window.ethereum) {
            throw new Error('EVM Wallet provider not detected. Please install/connect your EVM wallet.');
          }
          sourceAdapter = await createViemAdapterFromProvider({
            provider: window.ethereum as any,
            getPublicClient: circlePublicClientFactory,
          });
        }

        if (toChain.isSolana) {
          if (!solanaWallet.publicKey) {
            if (solanaWallet.wallet) {
              try { await solanaWallet.connect(); } catch (_) {}
            }
            if (!solanaWallet.publicKey) {
              throw new Error('Please connect your Solana (Phantom) wallet before bridging to Solana.');
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
              ...s, status: 'done', txHash: 'Auto-Relayed',
              explorerUrl: `https://iris-api-sandbox.circle.com/v2/messages/${fromChain.cctpDomain}?transactionHash=${tempBurnHash}`
            } : s));
          }
        };

        appKit.on('*', handleWildcard);

        try {
          setSteps(prev => prev.map(s => s.name === 'approve' ? { ...s, status: 'active' } : s));

          const result = await appKit.bridge({
            from: { adapter: sourceAdapter, chain: fromChain.appKitId as any },
            to: { adapter: destAdapter, chain: toChain.appKitId as any },
            amount: amount,
            token: 'USDC',
          });

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
        console.error('Solana-based CCTP bridge error:', err);
        setStatus('error');
        setError(err?.message || 'An unexpected error occurred during Solana bridging.');
        setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s));
      } finally {
        if (timerRef.current) clearInterval(timerRef.current);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
        }
      }
      return;
    }

    // ─── EVM ROUTE (Direct CCTP Contracts) ──────────────────────────────
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
      const accountInfo = getAccount(config);
      if (!accountInfo.isConnected || !accountInfo.address) {
        throw new Error('Please connect your wallet first.');
      }

      if (accountInfo.chainId !== fromChain.id) {
        await switchChain(config, { chainId: fromChain.id as any });
      }

      const fromDomain = fromChain.cctpDomain ?? 0;
      const toDomain = toChain.cctpDomain ?? 0;

      // Always 3 steps: Approve → Burn & Forward → Circle Auto-Relay
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
          label: 'Burn & Forward USDC',
          description: `Burning USDC & attaching Circle auto-relay hook on ${fromChain.name}`,
        },
        {
          name: 'attest',
          status: 'pending',
          label: 'Circle Auto-Relaying',
          description: 'Circle is completing attestation & minting on destination automatically',
        },
      ]);

      const tokenMessenger = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';
      const destinationTransmitter = getMessageTransmitterAddress();

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

      // Resolve destination mintRecipient bytes32
      let destinationAddressBytes32: `0x${string}`;

      if (toChain.isSolana) {
        // Step 3 Solana Rule: recipient address must be recipient's USDC ATA for Solana destination when forwarding
        if (!solanaWallet.publicKey) {
          throw new Error('Solana (Phantom) wallet is required to resolve recipient ATA for Solana destination.');
        }
        const usdcMintPubKey = new SolanaPublicKey(toChain.usdcAddress);
        const ataPubKey = getSolanaUsdcAta(solanaWallet.publicKey, usdcMintPubKey);
        const ataHex = ataPubKey.toBuffer().toString('hex');
        destinationAddressBytes32 = ('0x' + ataHex) as `0x${string}`;
      } else {
        destinationAddressBytes32 = pad(accountInfo.address, { size: 32 });
      }

      const destinationCallerBytes32 = pad('0x', { size: 32 });

      // Calculate maxFee for CCTP v2: includes forwarding fee buffer when forwarding service is active
      const baseCctpFee = amountInUnits / BigInt(100) > BigInt(1000) ? amountInUnits / BigInt(100) : BigInt(1000);
      const maxFee = isForwarding
        ? (baseCctpFee * BigInt(15) / BigInt(10)) + BigInt(50000)
        : baseCctpFee;

      // ==========================================
      // STEP 1: APPROVE SPEND
      // ==========================================
      setSteps(prev => prev.map(s => s.name === 'approve' ? { ...s, status: 'active' } : s));

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

      let currentGasPrice: bigint = BigInt(1500000000);
      try {
        currentGasPrice = await getGasPrice(config, { chainId: fromChain.id as any });
      } catch (err) {
        console.warn("Failed to fetch gas price, using fallback:", err);
      }

      const isOpStack = [11155420, 1301, 763373].includes(fromChain.id);

      if (needsApproval) {
        approveHash = await writeContract(config, {
          address: fromChain.usdcAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [tokenMessenger as `0x${string}`, amountInUnits + maxFee],
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

      window.dispatchEvent(new CustomEvent('bridge-step-change', { detail: { step: 'burn' } }));

      // ==========================================
      // STEP 2: BURN (Branching: Forwarding vs Manual)
      // ==========================================
      setSteps(prev => prev.map(s => s.name === 'burn' ? { ...s, status: 'active' } : s));

      let burnHash = '';
      try {
        let txHash: `0x${string}`;

        // Always use depositForBurnWithHook — Circle CCTP Forwarding Service auto-relay
        console.log(`Executing CCTP depositForBurnWithHook to ${toChain.name} (Domain ${toDomain})`);
        txHash = await writeContract(config, {
          address: tokenMessenger as `0x${string}`,
          abi: TOKEN_MESSENGER_ABI,
          functionName: 'depositForBurnWithHook',
          args: [
            amountInUnits,
            toDomain,
            destinationAddressBytes32,
            fromChain.usdcAddress as `0x${string}`,
            destinationCallerBytes32,
            maxFee,
            speedMode === 'fast' ? 1000 : 2000,
            CCTP_FORWARD_HOOK_DATA
          ],
          chainId: fromChain.id as any,
          ...(isOpStack ? {
            gas: BigInt(400000),
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

      window.dispatchEvent(new Event('bridge-success-refresh'));
      window.dispatchEvent(new CustomEvent('bridge-step-change', { detail: { step: 'attest' } }));

      // ==========================================
      // STEP 3: ATTESTATION & AUTO-FORWARD / MINT
      // ==========================================
      setSteps(prev => prev.map(s => s.name === 'attest' ? { ...s, status: 'active' } : s));

      attestTimerRef.current = setInterval(() => {
        setAttestationElapsed(prev => prev + 1);
      }, 1000);

      const attestationMessage = await retrieveAttestation(burnHash, fromDomain);
      if (attestTimerRef.current) clearInterval(attestTimerRef.current);

      // FORWARDING COMPLETE — Circle auto-relays attestation & mints on destination
      setSteps(prev => prev.map(s => s.name === 'attest' ? {
        ...s,
        status: 'done',
        label: 'Circle Auto-Relayed ⚡',
        description: 'Circle forwarded attestation & minted USDC on destination automatically',
        txHash: 'Auto-Relayed',
        explorerUrl: `https://iris-api-sandbox.circle.com/v2/messages/${fromDomain}?transactionHash=${burnHash}`
      } : s));

      updateTransaction(burnHash, {
        status: 'success',
        mintTxHash: 'auto-relayed'
      });
      setStatus('success');
      window.dispatchEvent(new CustomEvent('bridge-step-change', { detail: { step: 'success' } }));
      window.dispatchEvent(new CustomEvent('bridge-state-change', { detail: { isBridging: false } }));
    } catch (err: any) {
      console.error('CCTP Bridge transaction failed:', err);
      if (activeBurnHash) {
        updateTransaction(activeBurnHash, { status: 'failed' });
      }
      setStatus('error');
      const rawMsg: string = err?.message || '';
      let friendlyError = 'Transaction was rejected or failed on chain.';
      if (rawMsg.includes('User rejected') || rawMsg.includes('user rejected')) {
        friendlyError = 'Transaction rejected in wallet. Please try again.';
      } else if (rawMsg.includes('insufficient funds')) {
        friendlyError = 'Insufficient funds for gas. Get testnet ETH from the Faucet.';
      } else if (rawMsg.includes('execution reverted')) {
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
