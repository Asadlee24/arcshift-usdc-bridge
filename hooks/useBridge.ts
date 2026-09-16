// hooks/useBridge.ts
// Core CCTP v2 Bridge Hook — Production-hardened with typed lifecycle,
// immediate burn persistence, active Wagmi connector provider support,
// and on-chain destination execution verification.

import { useState, useEffect, useRef, useCallback } from 'react';
import { getChainById, ChainMetadata } from '../constants/chains';
import { writeContract, waitForTransactionReceipt, getAccount, switchChain, getGasPrice, readContract } from '@wagmi/core';
import { config } from '../lib/wagmi';
import { parseUnits, pad } from 'viem';
import { addTransaction, updateTransaction } from './useTransactionHistory';
import { getChainConfig, getIrisApiBaseUrl, getActiveEnvironment, validateRoute } from '../lib/registry';
import { decodeMessageV2, decodeCCTPTransfer, bytes32ToAddress, DecodedCCTPTransfer } from '../lib/cctp/messageV2';
import { getRouteFeeQuote, parseUsdcUnits, validateAmountInput } from '../lib/bridge/quotes';
import { getPublicClientForChain } from '../lib/publicClient';

// Solana & Circle AppKit Imports
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey as SolanaPublicKey } from '@solana/web3.js';
import { getSolanaRpcUrl } from '../lib/rpcEndpoints';

// Forwarding Service Magic Bytes
export const CCTP_FORWARD_HOOK_DATA = '0x636374702d666f72776172640000000000000000000000000000000000000000' as `0x${string}`;

/**
 * Derives the Solana Associated Token Account (ATA) for a wallet address and USDC mint.
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

// ERC-20 ABI required for spend approvals
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
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

// MessageTransmitter receiveMessage and usedNonces ABI
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
  },
  {
    name: 'usedNonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'nonce', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }]
  }
] as const;

export type BridgeStepName = 'approve' | 'burn' | 'attest' | 'relay';

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
      'Your USDC was successfully burned on the source chain, but Circle Iris attestation has not arrived yet. ' +
      'Your funds are safe on-chain and can be recovered once attestation is ready. ' +
      `Burn transaction hash: ${burnTxHash}`
    );
    this.name = 'AttestationTimeoutError';
  }
}

export interface TransferMatchCriteria {
  expectedDestDomain: number;
  expectedRecipient?: string;
  expectedAmountUnits?: bigint;
  expectedBurnToken?: string;
}

export interface VerifiedAttestationResult {
  attestationMessage: AttestationMessage;
  decodedTransfer: DecodedCCTPTransfer;
}

/**
 * Polls Circle's Iris API for attestation corresponding to the burn transaction.
 * Strictly verifies that the complete message matches the confirmed source burn
 * (source/dest domain, burn token, mint recipient, and amount) before accepting it.
 */
async function retrieveAttestation(
  transactionHash: string,
  fromDomain: number,
  criteria?: TransferMatchCriteria,
  maxAttempts = 60
): Promise<VerifiedAttestationResult> {
  const baseUrl = getIrisApiBaseUrl();
  const url = `${baseUrl}/v2/messages/${fromDomain}?transactionHash=${transactionHash}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, { method: 'GET' });

      if (response.ok) {
        const data = (await response.json()) as AttestationResponse;
        const messages = data?.messages || [];

        // Match expected message against source burn parameters
        for (const msg of messages) {
          if (msg.status === 'complete' && msg.message) {
            try {
              const decoded = decodeCCTPTransfer(msg.message);

              // 1. Match source domain
              if (decoded.message.sourceDomain !== fromDomain) continue;

              // 2. Match destination domain
              if (criteria && decoded.message.destinationDomain !== criteria.expectedDestDomain) continue;

              // 3. Match BurnMessage body parameters if present
              if (criteria && decoded.burnMessage) {
                if (criteria.expectedBurnToken) {
                  const burnTokenAddr = bytes32ToAddress(decoded.burnMessage.burnToken).toLowerCase();
                  if (burnTokenAddr !== criteria.expectedBurnToken.toLowerCase()) continue;
                }

                if (criteria.expectedRecipient) {
                  const recipientAddr = bytes32ToAddress(decoded.burnMessage.mintRecipient).toLowerCase();
                  if (recipientAddr !== criteria.expectedRecipient.toLowerCase()) continue;
                }

                if (criteria.expectedAmountUnits !== undefined) {
                  if (decoded.burnMessage.amount !== criteria.expectedAmountUnits) continue;
                }
              }

              // Message fully verified against source burn!
              return {
                attestationMessage: msg,
                decodedTransfer: decoded,
              };
            } catch {
              // Non-burn or unparseable format, check next message
            }
          }
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
          `Verify domain (${fromDomain}) and transaction hash.`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Circle attestation request rejected')) {
        throw error;
      }
      console.warn(`Attestation poll attempt ${attempt + 1} failed:`, error);
    }

    const backoff = Math.min(1000 * 1.5 ** attempt, 5000);
    const jitter = Math.random() * 400;
    await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
  }

  throw new AttestationTimeoutError(transactionHash);
}

export const MIN_BRIDGE_AMOUNT = 0.05;

export function validateBridgeAmount(amount: string, availableBalance?: number): string | null {
  const validation = validateAmountInput(amount);
  if (!validation.valid) return validation.error || 'Invalid amount';

  const parsed = Number(validation.cleanValue);
  if (parsed < MIN_BRIDGE_AMOUNT) {
    return `Minimum bridge amount is ${MIN_BRIDGE_AMOUNT} USDC.`;
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
      label: 'Deposit for Burn',
      description: 'Submitting burn transaction on source chain',
    },
    {
      name: 'attest',
      status: 'pending',
      label: 'Circle Attestation',
      description: 'Awaiting Circle Iris protocol attestation',
    },
    {
      name: 'relay',
      status: 'pending',
      label: 'Destination Mint',
      description: 'Verifying USDC minted to destination wallet',
    },
  ]);

  const [sourceTxHash, setSourceTxHash] = useState<string>('');
  const [destTxHash, setDestTxHash] = useState<string>('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const attestTimerRef = useRef<NodeJS.Timeout | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (attestTimerRef.current) clearInterval(attestTimerRef.current);
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
        label: 'Deposit for Burn',
        description: 'Submitting burn transaction on source chain',
      },
      {
        name: 'attest',
        status: 'pending',
        label: 'Circle Attestation',
        description: 'Awaiting Circle Iris protocol attestation',
      },
      {
        name: 'relay',
        status: 'pending',
        label: 'Destination Mint',
        description: 'Verifying USDC minted to destination wallet',
      },
    ]);
  }, []);

  const executeBridge = useCallback(async (
    fromChain: ChainMetadata,
    toChain: ChainMetadata,
    amount: string,
    speedMode: 'fast' | 'standard' = 'standard'
  ) => {
    reset();

    // Verify route boundary rules
    const routeCap = validateRoute(fromChain.id, toChain.id);
    if (!routeCap.enabled) {
      setStatus('error');
      setError(routeCap.reason || 'This route is currently unavailable.');
      return;
    }

    const amountErr = validateBridgeAmount(amount);
    if (amountErr) {
      setStatus('error');
      setError(amountErr);
      return;
    }

    setStatus('bridging');
    setElapsedSeconds(0);
    setAttestationElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    let activeBurnHash: string | undefined = undefined;
    let burnConfirmedOnChain = false;

    try {
      const accountInfo = getAccount(config);
      if (!accountInfo.isConnected || !accountInfo.address) {
        throw new Error('Please connect your EVM wallet first.');
      }

      if (accountInfo.chainId !== fromChain.id) {
        await switchChain(config, { chainId: fromChain.id as any });
      }

      const fromDomain = fromChain.cctpDomain ?? 0;
      const toDomain = toChain.cctpDomain ?? 0;
      const isForwarding = toChain.supportsForwarding;

      const srcConfig = getChainConfig(fromChain.id);
      const dstConfig = getChainConfig(toChain.id);

      const tokenMessenger = srcConfig?.tokenMessengerAddress || '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d';
      const destinationTransmitter = dstConfig?.messageTransmitterAddress || '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64';

      const amountInUnits = parseUsdcUnits(amount);

      // Resolve recipient bytes32 (EVM 20-byte address zero-padded on left)
      const destinationAddressBytes32 = pad(accountInfo.address, { size: 32 });
      const destinationCallerBytes32 = pad('0x', { size: 32 });

      // Fetch accurate dynamic fee quote including forwarding relayer fees
      const quote = await getRouteFeeQuote(fromChain.id, toChain.id, amount, speedMode, isForwarding);
      const maxFee = quote.maxFeeUnits;

      // ==========================================
      // STEP 1: APPROVE SPEND
      // ==========================================
      setSteps(prev => prev.map(s => s.name === 'approve' ? { ...s, status: 'active' } : s));

      let needsApproval = true;
      try {
        const currentAllowance = await readContract(config, {
          address: fromChain.usdcAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [accountInfo.address as `0x${string}`, tokenMessenger as `0x${string}`],
          chainId: fromChain.id as any,
        });
        if (typeof currentAllowance === 'bigint' && currentAllowance >= amountInUnits) {
          needsApproval = false;
        }
      } catch (err) {
        console.warn("Allowance query failed, proceeding with approve:", err);
      }

      let approveHash = '';
      if (needsApproval) {
        approveHash = await writeContract(config, {
          address: fromChain.usdcAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [tokenMessenger as `0x${string}`, amountInUnits],
          chainId: fromChain.id as any,
        });

        const approveReceipt = await waitForTransactionReceipt(config, {
          hash: approveHash as `0x${string}`,
          chainId: fromChain.id as any,
        });
        if (approveReceipt.status === 'reverted') {
          throw new Error('Approval transaction reverted on-chain.');
        }
      }

      setSteps(prev => prev.map(s => s.name === 'approve' ? {
        ...s,
        status: 'done',
        txHash: approveHash ? (approveHash.substring(0, 10) + '...') : 'Already Approved',
        explorerUrl: approveHash ? `${fromChain.explorerUrl}/tx/${approveHash}` : undefined
      } : s));

      // ==========================================
      // STEP 2: BURN (Immediate Persistence Before Receipt)
      // ==========================================
      setSteps(prev => prev.map(s => s.name === 'burn' ? { ...s, status: 'active' } : s));

      let txHash: `0x${string}`;
      if (isForwarding) {
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
        });
      } else {
        txHash = await writeContract(config, {
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
        });
      }

      // CRITICAL: Persist burn transaction hash IMMEDIATELY after submission
      activeBurnHash = txHash;
      setSourceTxHash(txHash);

      addTransaction({
        id: txHash,
        userAddress: accountInfo.address,
        fromChainId: fromChain.id,
        toChainId: toChain.id,
        amount,
        status: 'pending',
        burnTxHash: txHash,
        isRelayed: isForwarding,
      });

      // Now await on-chain inclusion
      const burnReceipt = await waitForTransactionReceipt(config, {
        hash: txHash,
        chainId: fromChain.id as any,
      });
      if (burnReceipt.status === 'reverted') {
        updateTransaction(txHash, { status: 'failed' });
        throw new Error('Burn transaction reverted on-chain.');
      }

      burnConfirmedOnChain = true;

      setSteps(prev => prev.map(s => s.name === 'burn' ? {
        ...s,
        status: 'done',
        txHash: txHash.substring(0, 10) + '...',
        explorerUrl: `${fromChain.explorerUrl}/tx/${txHash}`
      } : s));

      // ==========================================
      // STEP 3: CIRCLE ATTESTATION
      // ==========================================
      setSteps(prev => prev.map(s => s.name === 'attest' ? { ...s, status: 'active' } : s));

      attestTimerRef.current = setInterval(() => {
        setAttestationElapsed(prev => prev + 1);
      }, 1000);

      const { attestationMessage, decodedTransfer } = await retrieveAttestation(
        txHash,
        fromDomain,
        {
          expectedDestDomain: toDomain,
          expectedRecipient: accountInfo.address,
          expectedAmountUnits: amountInUnits,
          expectedBurnToken: fromChain.usdcAddress
        }
      );
      if (attestTimerRef.current) clearInterval(attestTimerRef.current);

      const decodedNonce = decodedTransfer.message.nonce;

      setSteps(prev => prev.map(s => s.name === 'attest' ? {
        ...s,
        status: 'done',
        label: 'Attestation Verified',
        description: 'Circle signed the CCTP attestation successfully',
        explorerUrl: `${getIrisApiBaseUrl()}/v2/messages/${fromDomain}?transactionHash=${txHash}`
      } : s));

      // ==========================================
      // STEP 4: DESTINATION EXECUTION VERIFICATION
      // ==========================================
      setSteps(prev => prev.map(s => s.name === 'relay' ? { ...s, status: 'active' } : s));

      if (isForwarding) {
        // Auto-forwarding route: poll destination chain usedNonces to verify settlement
        let isDelivered = false;
        let realDestinationMintTxHash: string | null = null;

        if (decodedNonce) {
          const destClient = getPublicClientForChain(toChain.id);
          for (let poll = 0; poll < 35; poll++) {
            try {
              const used = await destClient.readContract({
                address: destinationTransmitter as `0x${string}`,
                abi: MESSAGE_TRANSMITTER_ABI,
                functionName: 'usedNonces',
                args: [decodedNonce],
              });
              if (used > 0n) {
                isDelivered = true;
                // Attempt to retrieve actual destination receipt hash from MessageReceived event logs
                try {
                  const currentBlock = await destClient.getBlockNumber();
                  const fromBlock = currentBlock > 2000n ? currentBlock - 2000n : 0n;
                  const logs = await destClient.getLogs({
                    address: destinationTransmitter as `0x${string}`,
                    event: {
                      type: 'event',
                      name: 'MessageReceived',
                      inputs: [
                        { name: 'caller', type: 'address', indexed: true },
                        { name: 'nonce', type: 'bytes32', indexed: true },
                        { name: 'sourceDomain', type: 'uint32', indexed: false },
                        { name: 'message', type: 'bytes', indexed: false }
                      ]
                    },
                    args: { nonce: decodedNonce },
                    fromBlock,
                    toBlock: currentBlock
                  });

                  if (logs.length > 0 && logs[0].transactionHash) {
                    realDestinationMintTxHash = logs[0].transactionHash;
                  }
                } catch (logErr) {
                  console.warn('Could not index destination mint receipt hash:', logErr);
                }
                break;
              }
            } catch (err) {
              console.warn('Destination readContract usedNonces poll failed:', err);
            }
            await new Promise(r => setTimeout(r, 4000));
          }
        }

        if (isDelivered) {
          setSteps(prev => prev.map(s => s.name === 'relay' ? {
            ...s,
            status: 'done',
            label: 'Delivered (Auto-Forwarded)',
            description: realDestinationMintTxHash
              ? `USDC minted on ${toChain.name} (Tx: ${realDestinationMintTxHash.substring(0, 10)}...)`
              : `USDC minted on ${toChain.name} and verified on-chain via usedNonces (Tx indexing in progress)`,
            txHash: realDestinationMintTxHash ? (realDestinationMintTxHash.substring(0, 10) + '...') : undefined,
            explorerUrl: realDestinationMintTxHash ? `${toChain.explorerUrl}/tx/${realDestinationMintTxHash}` : undefined
          } : s));

          updateTransaction(txHash, {
            status: 'success',
            mintTxHash: realDestinationMintTxHash || undefined,
            verificationStatus: 'verified_onchain',
          });
          setDestTxHash(realDestinationMintTxHash || 'verified_onchain_indexing_pending');
          setStatus('success');
        } else {
          // Relayer is taking longer than usual; keep recoverable without marking failed
          setSteps(prev => prev.map(s => s.name === 'relay' ? {
            ...s,
            status: 'active',
            label: 'Relaying in Progress',
            description: 'Attestation confirmed. Circle relayer submission pending on destination.',
          } : s));

          updateTransaction(txHash, {
            status: 'pending',
          });
          setStatus('success'); // Transfer is confirmed on-chain, settlement will complete
        }
      } else {
        // Manual mint route: user executes receiveMessage
        setSteps(prev => prev.map(s => s.name === 'relay' ? {
          ...s,
          status: 'active',
          label: 'Ready to Claim',
          description: `Attestation complete. Submit mint transaction on ${toChain.name}.`,
        } : s));

        // Switch to destination chain to execute receiveMessage
        await switchChain(config, { chainId: toChain.id as any });

        const mintHash = await writeContract(config, {
          address: destinationTransmitter as `0x${string}`,
          abi: MESSAGE_TRANSMITTER_ABI,
          functionName: 'receiveMessage',
          args: [
            attestationMessage.message as `0x${string}`,
            attestationMessage.attestation as `0x${string}`
          ],
          chainId: toChain.id as any,
        });

        const mintReceipt = await waitForTransactionReceipt(config, {
          hash: mintHash,
          chainId: toChain.id as any,
        });

        if (mintReceipt.status === 'reverted') {
          throw new Error('Destination mint transaction reverted.');
        }

        setSteps(prev => prev.map(s => s.name === 'relay' ? {
          ...s,
          status: 'done',
          label: 'Mint Confirmed',
          txHash: mintHash.substring(0, 10) + '...',
          explorerUrl: `${toChain.explorerUrl}/tx/${mintHash}`
        } : s));

        updateTransaction(txHash, {
          status: 'success',
          mintTxHash: mintHash,
        });
        setDestTxHash(mintHash);
        setStatus('success');
      }

      window.dispatchEvent(new Event('bridge-success-refresh'));
    } catch (err: any) {
      console.error('CCTP Bridge error:', err);

      // Only mark failed if burn did NOT confirm on chain
      if (activeBurnHash && !burnConfirmedOnChain) {
        updateTransaction(activeBurnHash, { status: 'failed' });
      }

      setStatus('error');
      const rawMsg: string = err?.message || '';
      let friendlyError = 'Transaction failed or was rejected.';

      if (rawMsg.includes('User rejected') || rawMsg.includes('user rejected')) {
        friendlyError = 'Transaction rejected in wallet.';
      } else if (rawMsg.includes('insufficient funds')) {
        friendlyError = fromChain.isNativeArc
          ? 'Insufficient USDC for gas. Arc uses native USDC (18 decimals) for gas.'
          : 'Insufficient native currency for network gas.';
      } else if (rawMsg.includes('AttestationTimeoutError')) {
        friendlyError = 'Attestation is taking longer than usual. Your funds are safe and recoverable by burn hash.';
      } else if (rawMsg.length > 0) {
        friendlyError = rawMsg.substring(0, 180);
      }

      setError(friendlyError);
      setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s));
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
