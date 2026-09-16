// lib/cctp/messageV2.ts
// Standards-compliant MessageV2 and BurnMessage decoder for Circle CCTP v2
// References:
// - https://github.com/circlefin/evm-cctp-contracts/blob/master/src/messages/v2/MessageV2.sol
// - https://github.com/circlefin/evm-cctp-contracts/blob/master/src/v2/MessageTransmitterV2.sol

export interface DecodedMessageV2 {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  nonce: `0x${string}`; // Exact 32-byte nonce
  sender: `0x${string}`;
  recipient: `0x${string}`;
  destinationCaller: `0x${string}`;
  messageBody: `0x${string}`;
}

export interface DecodedBurnMessage {
  version: number;
  burnToken: `0x${string}`;
  mintRecipient: `0x${string}`;
  amount: bigint;
  messageSender: `0x${string}`;
}

export interface DecodedCCTPTransfer {
  message: DecodedMessageV2;
  burnMessage?: DecodedBurnMessage;
  rawMessage: `0x${string}`;
}

/**
 * Parses raw Circle MessageV2 bytes into structured fields.
 *
 * MessageV2 Layout:
 * 0..3   (4 bytes)  : version (uint32)
 * 4..7   (4 bytes)  : sourceDomain (uint32)
 * 8..11  (4 bytes)  : destinationDomain (uint32)
 * 12..43 (32 bytes) : nonce (bytes32) -> offset 24..88 in hex
 * 44..75 (32 bytes) : sender (bytes32) -> offset 88..152 in hex
 * 76..107(32 bytes) : recipient (bytes32) -> offset 152..216 in hex
 * 108..139(32 bytes): destinationCaller (bytes32) -> offset 216..280 in hex
 * 140..  (variable) : messageBody (bytes) -> offset 280+ in hex
 */
export function decodeMessageV2(messageHex: string): DecodedMessageV2 {
  const clean = messageHex.startsWith('0x') ? messageHex.slice(2) : messageHex;

  if (clean.length < 280) {
    throw new Error(`Invalid MessageV2: message length (${clean.length} hex chars) is less than minimum 280 chars (140 bytes).`);
  }

  const version = parseInt(clean.substring(0, 8), 16);
  const sourceDomain = parseInt(clean.substring(8, 16), 16);
  const destinationDomain = parseInt(clean.substring(16, 24), 16);
  const nonce = `0x${clean.substring(24, 88)}` as `0x${string}`;
  const sender = `0x${clean.substring(88, 152)}` as `0x${string}`;
  const recipient = `0x${clean.substring(152, 216)}` as `0x${string}`;
  const destinationCaller = `0x${clean.substring(216, 280)}` as `0x${string}`;
  const messageBody = `0x${clean.substring(280)}` as `0x${string}`;

  return {
    version,
    sourceDomain,
    destinationDomain,
    nonce,
    sender,
    recipient,
    destinationCaller,
    messageBody,
  };
}

/**
 * Parses the BurnMessage contained within messageBody for TokenMessenger transfers.
 *
 * BurnMessage Layout:
 * 0..3   (4 bytes)  : version (uint32)
 * 4..35  (32 bytes) : burnToken (bytes32) -> offset 8..72 in hex
 * 36..67 (32 bytes) : mintRecipient (bytes32) -> offset 72..136 in hex
 * 68..99 (32 bytes) : amount (uint256) -> offset 136..200 in hex
 * 100..131(32 bytes): messageSender (bytes32) -> offset 200..264 in hex
 */
export function decodeBurnMessage(messageBodyHex: string): DecodedBurnMessage {
  const clean = messageBodyHex.startsWith('0x') ? messageBodyHex.slice(2) : messageBodyHex;

  if (clean.length < 264) {
    throw new Error(`Invalid BurnMessage: body length (${clean.length} hex chars) is less than 264 chars (132 bytes).`);
  }

  const version = parseInt(clean.substring(0, 8), 16);
  const burnToken = `0x${clean.substring(8, 72)}` as `0x${string}`;
  const mintRecipient = `0x${clean.substring(72, 136)}` as `0x${string}`;
  const amount = BigInt(`0x${clean.substring(136, 200)}`);
  const messageSender = `0x${clean.substring(200, 264)}` as `0x${string}`;

  return {
    version,
    burnToken,
    mintRecipient,
    amount,
    messageSender,
  };
}

/**
 * Decodes the entire CCTP transfer including inner BurnMessage if valid.
 */
export function decodeCCTPTransfer(messageHex: string): DecodedCCTPTransfer {
  const rawMessage = (messageHex.startsWith('0x') ? messageHex : `0x${messageHex}`) as `0x${string}`;
  const message = decodeMessageV2(rawMessage);
  let burnMessage: DecodedBurnMessage | undefined;

  try {
    burnMessage = decodeBurnMessage(message.messageBody);
  } catch {
    // Non-burn or custom message format
  }

  return {
    message,
    burnMessage,
    rawMessage,
  };
}

/**
 * Converts a 32-byte hex string (bytes32) into a standard 20-byte EVM address.
 */
export function bytes32ToAddress(bytes32Hex: string): `0x${string}` {
  const clean = bytes32Hex.startsWith('0x') ? bytes32Hex.slice(2) : bytes32Hex;
  // EVM addresses are right-aligned (last 20 bytes = 40 hex chars)
  const addrHex = clean.length >= 40 ? clean.slice(-40) : clean.padStart(40, '0');
  return `0x${addrHex}` as `0x${string}`;
}
