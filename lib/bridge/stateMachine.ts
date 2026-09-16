// lib/bridge/stateMachine.ts
// Typed lifecycle state machine for CCTP v2 cross-chain transfers
// Ensures strict non-fabricated delivery verification, immediate post-submission persistence,
// and safe crash-resumable recovery.

import type { NetworkEnvironment } from '../registry/index.ts';

export type BridgeLifecycleStage =
  | 'IDLE'
  | 'VALIDATING'
  | 'APPROVE_PENDING'
  | 'APPROVE_CONFIRMED'
  | 'BURN_SUBMITTED'       // Source hash persisted immediately upon wallet submission
  | 'BURN_CONFIRMED'       // Source receipt verified, MessageSent event extracted
  | 'AWAITING_ATTESTATION' // Polling Circle Iris API
  | 'ATTESTATION_COMPLETE' // Attestation signature acquired
  | 'AWAITING_RELAY'       // For auto-forwarding: polling destination usedNonces
  | 'MANUAL_MINT_READY'    // Attestation ready; waiting for user manual receiveMessage
  | 'MINT_SUBMITTED'       // Manual or relayer destination tx submitted
  | 'DELIVERED'            // Destination usedNonces[nonce] > 0 verified on destination chain!
  | 'RECOVERABLE_DELAY'    // Delayed attestation or relay; resumable without re-burning
  | 'FAILED_PRE_BURN';     // Terminal failure ONLY before burn is submitted

export interface PersistedTransferRecord {
  id: string; // Source burn transaction hash (or temporary UUID until txHash available)
  environment: NetworkEnvironment;
  fromChainId: number;
  toChainId: number;
  fromDomain: number;
  toDomain: number;
  senderAddress: string;
  recipientAddress: string;
  amount: string;          // Human-readable string, e.g. "10.50"
  amountBaseUnits: string; // BigInt serialized as string, e.g. "10500000"
  burnTxHash?: string;
  mintTxHash?: string;     // Real destination hash, or 'relayed_verified' when hash not indexed
  nonce?: `0x${string}`;   // Exact 32-byte CCTP v2 nonce
  messageBytes?: `0x${string}`;
  attestationBytes?: `0x${string}`;
  stage: BridgeLifecycleStage;
  isForwarding: boolean;
  maxFeeBaseUnits?: string;
  estimatedReceiveAmount?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  sourceBlockNumber?: number;
  destBlockNumber?: number;
}

/**
 * Validates whether a state transition is legal in the bridge lifecycle.
 * Protects against accidental or fraudulent state jumping.
 */
export function canTransition(
  currentStage: BridgeLifecycleStage,
  nextStage: BridgeLifecycleStage
): boolean {
  // Terminal delivered state cannot be reversed
  if (currentStage === 'DELIVERED') {
    return false;
  }

  // Once burn is submitted, it can never transition to FAILED_PRE_BURN
  const postBurnStages: BridgeLifecycleStage[] = [
    'BURN_SUBMITTED',
    'BURN_CONFIRMED',
    'AWAITING_ATTESTATION',
    'ATTESTATION_COMPLETE',
    'AWAITING_RELAY',
    'MANUAL_MINT_READY',
    'MINT_SUBMITTED',
    'DELIVERED',
    'RECOVERABLE_DELAY',
  ];

  const preBurnStages: BridgeLifecycleStage[] = [
    'IDLE',
    'VALIDATING',
    'APPROVE_PENDING',
    'APPROVE_CONFIRMED',
  ];

  // Once burn has been submitted, the lifecycle can NEVER regress to pre-burn stages
  // This prevents accidental re-approval or double-burning funds.
  if (postBurnStages.includes(currentStage) && preBurnStages.includes(nextStage)) {
    return false;
  }

  if (postBurnStages.includes(currentStage) && nextStage === 'FAILED_PRE_BURN') {
    return false; // Burn already occurred on-chain! Funds must be recovered, not marked permanently lost.
  }

  // Pre-burn failure allowed only from pre-burn stages
  if (nextStage === 'FAILED_PRE_BURN') {
    return preBurnStages.includes(currentStage);
  }

  return true;
}

/**
 * Transitions bridge state safely, throwing an error if the transition violates lifecycle invariants.
 */
export function transitionBridgeState(
  currentStage: BridgeLifecycleStage,
  nextStage: BridgeLifecycleStage
): BridgeLifecycleStage {
  if (!canTransition(currentStage, nextStage)) {
    if (nextStage === 'FAILED_PRE_BURN') {
      throw new Error(`Cannot mark transfer as pre-burn failure: transfer has already progressed past burn submission (${currentStage})`);
    }
    throw new Error(`Illegal state transition from ${currentStage} to ${nextStage}`);
  }
  return nextStage;
}

/**
 * Translates lifecycle stage to user-facing status indicators and step trackers.
 */
export function getStageDescription(stage: BridgeLifecycleStage, isForwarding: boolean): {
  step: 'approve' | 'burn' | 'attest' | 'relay' | 'success';
  title: string;
  description: string;
} {
  switch (stage) {
    case 'VALIDATING':
      return { step: 'approve', title: 'Validating', description: 'Checking balances, gas, and allowance...' };
    case 'APPROVE_PENDING':
      return { step: 'approve', title: 'Approve USDC', description: 'Confirm approval transaction in your wallet...' };
    case 'APPROVE_CONFIRMED':
      return { step: 'approve', title: 'Approved', description: 'USDC allowance confirmed on source chain.' };
    case 'BURN_SUBMITTED':
      return { step: 'burn', title: 'Deposit for Burn', description: 'Burn transaction submitted to network...' };
    case 'BURN_CONFIRMED':
      return { step: 'burn', title: 'Burn Confirmed', description: 'Source burn confirmed. Extracting CCTP message...' };
    case 'AWAITING_ATTESTATION':
      return { step: 'attest', title: 'Circle Attestation', description: 'Waiting for Circle Iris protocol attestation...' };
    case 'ATTESTATION_COMPLETE':
      return { step: 'attest', title: 'Attestation Signed', description: 'Circle signed attestation successfully.' };
    case 'AWAITING_RELAY':
      return {
        step: 'relay',
        title: isForwarding ? 'Circle Auto-Relaying' : 'Awaiting Mint',
        description: isForwarding
          ? 'Circle relayer is submitting mint transaction on destination chain...'
          : 'Attestation ready for manual claim on destination chain.',
      };
    case 'MANUAL_MINT_READY':
      return { step: 'relay', title: 'Ready to Claim', description: 'Click Claim to mint your USDC on destination chain.' };
    case 'MINT_SUBMITTED':
      return { step: 'relay', title: 'Minting', description: 'Destination mint transaction submitted...' };
    case 'DELIVERED':
      return { step: 'success', title: 'Delivered', description: 'Transfer verified and USDC received on destination chain!' };
    case 'RECOVERABLE_DELAY':
      return { step: 'attest', title: 'Relay Delay', description: 'Attestation or relay is taking longer than usual. Resumable.' };
    case 'FAILED_PRE_BURN':
      return { step: 'burn', title: 'Submission Failed', description: 'Transaction was cancelled or failed before burn occurred.' };
    default:
      return { step: 'approve', title: 'Ready', description: 'Enter amount and click bridge.' };
  }
}
