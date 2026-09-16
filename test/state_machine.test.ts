// test/state_machine.test.ts
// Unit tests for bridge lifecycle state transitions and safety invariants

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, getStageDescription } from '../lib/bridge/stateMachine.ts';

describe('Bridge Lifecycle State Machine', () => {
  it('allows legal forward transitions from IDLE to DELIVERED', () => {
    assert.equal(canTransition('IDLE', 'VALIDATING'), true);
    assert.equal(canTransition('VALIDATING', 'APPROVE_PENDING'), true);
    assert.equal(canTransition('APPROVE_PENDING', 'APPROVE_CONFIRMED'), true);
    assert.equal(canTransition('APPROVE_CONFIRMED', 'BURN_SUBMITTED'), true);
    assert.equal(canTransition('BURN_SUBMITTED', 'BURN_CONFIRMED'), true);
    assert.equal(canTransition('BURN_CONFIRMED', 'AWAITING_ATTESTATION'), true);
    assert.equal(canTransition('AWAITING_ATTESTATION', 'ATTESTATION_COMPLETE'), true);
    assert.equal(canTransition('ATTESTATION_COMPLETE', 'AWAITING_RELAY'), true);
    assert.equal(canTransition('AWAITING_RELAY', 'DELIVERED'), true);
  });

  it('strictly disallows transitioning to FAILED_PRE_BURN once burn has been submitted', () => {
    // Crucial safety invariant: once user burns USDC on-chain, transfer must NEVER
    // be marked as "failed pre-burn" which would cause lost funds and unrecoverable UI state.
    assert.equal(canTransition('BURN_SUBMITTED', 'FAILED_PRE_BURN'), false);
    assert.equal(canTransition('BURN_CONFIRMED', 'FAILED_PRE_BURN'), false);
    assert.equal(canTransition('AWAITING_ATTESTATION', 'FAILED_PRE_BURN'), false);
    assert.equal(canTransition('ATTESTATION_COMPLETE', 'FAILED_PRE_BURN'), false);
    assert.equal(canTransition('RECOVERABLE_DELAY', 'FAILED_PRE_BURN'), false);
  });

  it('allows FAILED_PRE_BURN only during pre-burn stages', () => {
    assert.equal(canTransition('IDLE', 'FAILED_PRE_BURN'), true);
    assert.equal(canTransition('VALIDATING', 'FAILED_PRE_BURN'), true);
    assert.equal(canTransition('APPROVE_PENDING', 'FAILED_PRE_BURN'), true);
    assert.equal(canTransition('APPROVE_CONFIRMED', 'FAILED_PRE_BURN'), true);
  });

  it('prevents any state mutations once transfer is DELIVERED', () => {
    assert.equal(canTransition('DELIVERED', 'IDLE'), false);
    assert.equal(canTransition('DELIVERED', 'BURN_SUBMITTED'), false);
    assert.equal(canTransition('DELIVERED', 'FAILED_PRE_BURN'), false);
  });

  it('allows transitioning to RECOVERABLE_DELAY upon network timeouts', () => {
    assert.equal(canTransition('AWAITING_ATTESTATION', 'RECOVERABLE_DELAY'), true);
    assert.equal(canTransition('AWAITING_RELAY', 'RECOVERABLE_DELAY'), true);
    assert.equal(canTransition('RECOVERABLE_DELAY', 'AWAITING_ATTESTATION'), true);
    assert.equal(canTransition('RECOVERABLE_DELAY', 'DELIVERED'), true);
  });

  it('returns valid user-facing status labels for each stage', () => {
    const burnDesc = getStageDescription('BURN_SUBMITTED', true);
    assert.equal(burnDesc.step, 'burn');
    assert.ok(burnDesc.title.length > 0);

    const relayDesc = getStageDescription('AWAITING_RELAY', true);
    assert.equal(relayDesc.step, 'relay');
  });
});
