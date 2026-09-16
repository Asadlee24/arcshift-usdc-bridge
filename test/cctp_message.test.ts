// test/cctp_message.test.ts
// Unit tests for Circle CCTP v2 Message and BurnMessage decoding

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeMessageV2,
  decodeBurnMessage,
  bytes32ToAddress,
} from '../lib/cctp/messageV2.ts';

describe('Circle CCTP v2 Message Decoder', () => {
  // Synthesize a valid MessageV2 containing a BurnMessage
  // Version: 1 (uint32 -> 00000001)
  // SourceDomain: 6 (Base) -> 00000006
  // DestinationDomain: 26 (Arc) -> 0000001a
  // Nonce: 32-byte 0x00...0123456789abcdef...
  // Sender: 32-byte 0x00...1111111111111111111111111111111111111111
  // Recipient: 32-byte 0x00...2222222222222222222222222222222222222222
  // DestinationCaller: 32-byte 0x00...00
  // MessageBody: BurnMessage (132 bytes)
  const versionHex = '00000001';
  const srcDomainHex = '00000006';
  const dstDomainHex = '0000001a';
  const nonceHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const senderHex = '0000000000000000000000001111111111111111111111111111111111111111';
  const recipientHex = '0000000000000000000000002222222222222222222222222222222222222222';
  const dstCallerHex = '0000000000000000000000000000000000000000000000000000000000000000';

  // BurnMessage:
  // Version: 1
  // BurnToken: 32-byte USDC
  // MintRecipient: 32-byte user
  // Amount: 100 USDC = 100,000,000 units = 0x05f5e100 (padded to 32 bytes)
  // MessageSender: 32-byte caller
  const bmVersion = '00000001';
  const bmBurnToken = '0000000000000000000000003600000000000000000000000000000000000000';
  const bmMintRecipient = '0000000000000000000000009999999999999999999999999999999999999999';
  const bmAmount = '0000000000000000000000000000000000000000000000000000000005f5e100'; // 100000000
  const bmSender = '0000000000000000000000008888888888888888888888888888888888888888';
  const burnMessageHex = bmVersion + bmBurnToken + bmMintRecipient + bmAmount + bmSender;

  const rawMessageHex = '0x' + versionHex + srcDomainHex + dstDomainHex + nonceHex + senderHex + recipientHex + dstCallerHex + burnMessageHex;

  it('correctly decodes MessageV2 fields with 32-byte nonce at offset 12', () => {
    const decoded = decodeMessageV2(rawMessageHex);
    assert.equal(decoded.version, 1);
    assert.equal(decoded.sourceDomain, 6);
    assert.equal(decoded.destinationDomain, 26);
    assert.equal(decoded.nonce, '0x' + nonceHex);
    assert.equal(decoded.sender, '0x' + senderHex);
    assert.equal(decoded.recipient, '0x' + recipientHex);
    assert.equal(decoded.destinationCaller, '0x' + dstCallerHex);
    assert.equal(decoded.messageBody, '0x' + burnMessageHex);
  });

  it('correctly decodes BurnMessage inside MessageV2 body', () => {
    const burn = decodeBurnMessage('0x' + burnMessageHex);
    assert.equal(burn.version, 1);
    assert.equal(burn.burnToken, '0x' + bmBurnToken);
    assert.equal(burn.mintRecipient, '0x' + bmMintRecipient);
    assert.equal(burn.amount, 100_000_000n);
    assert.equal(burn.messageSender, '0x' + bmSender);
  });

  it('converts bytes32 representation to standard checksum/lowercase EVM address', () => {
    const evmAddr = bytes32ToAddress('0x' + bmMintRecipient);
    assert.equal(evmAddr, '0x9999999999999999999999999999999999999999');
  });

  it('throws for truncated or malformed message bytes', () => {
    assert.throws(() => decodeMessageV2('0x1234'), /less than minimum 280 chars/);
    assert.throws(() => decodeBurnMessage('0x1234'), /less than 264 chars/);
  });
});
