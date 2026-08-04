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
