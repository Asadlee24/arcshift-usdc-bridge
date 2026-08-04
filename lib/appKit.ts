// lib/appKit.ts
// Singleton instance of the Circle App Kit SDK

import { AppKit } from '@circle-fin/app-kit';

// We instantiate AppKit. It acts as the driver for CCTP operations under the hood.
export const appKit = new AppKit();
export { AppKit };
export type { BridgeStep } from '@circle-fin/app-kit';
