// lib/arcChain.ts
// Custom Viem chain definition for Arc Testnet (ID: 5042002)
import { defineChain } from 'viem';

export const arcTestnet = defineChain({
  id: 5042002, // Hex: 0x4cef52
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USD Coin',
    symbol: 'USDC', // Gas token is USDC (NOT ETH — critical!)
    decimals: 18, // Native Gas Token USDC has 18 decimals on Arc Network
  },
  rpcUrls: {
    // Intentionally the real upstream URL, NOT our /api/rpc proxy.
    //
    // This value is what gets handed to the wallet via wallet_addEthereumChain when a user
    // adds/switches to Arc. MetaMask issues those requests from its own extension process,
    // where CORS does not apply, and it cannot resolve a relative path like /api/rpc/5042002.
    // The app's own browser-side reads use the proxy instead — see lib/rpcEndpoints.ts.
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },

  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
    },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
    },
  },
  testnet: true,
});
