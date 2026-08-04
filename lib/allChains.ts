// lib/allChains.ts
// Custom Viem chain definitions for all new testnet chains not in wagmi/chains
// Used by wagmi config to enable network switching for these chains

import { defineChain } from 'viem';

// ── Already in wagmi/chains — imported directly there ──────────────
// sepolia, baseSepolia, arbitrumSepolia, avalancheFuji,
// optimismSepolia, lineaSepolia, polygonAmoy

// ── Custom chains ──────────────────────────────────────────────────

export const unichainSepolia = defineChain({
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.unichain.org'] },
  },
  blockExplorers: {
    default: { name: 'Uniscan', url: 'https://sepolia.uniscan.xyz' },
  },
  testnet: true,
});

export const sonicTestnet = defineChain({
  id: 14601,
  name: 'Sonic Testnet',
  nativeCurrency: { name: 'Sonic', symbol: 'S', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.soniclabs.com'] },
  },
  blockExplorers: {
    default: { name: 'SonicScan', url: 'https://testnet.sonicscan.org' },
  },
  testnet: true,
});

export const hyperEvmTestnet = defineChain({
  id: 998,
  name: 'HyperEVM Testnet',
  nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.hyperliquid-testnet.xyz/evm'] },
  },
  blockExplorers: {
    default: { name: 'HyperEVM Explorer', url: 'https://testnet.purrsec.com' },
  },
  testnet: true,
});

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' },
  },
  testnet: true,
});

export const inkSepolia = defineChain({
  id: 763373,
  name: 'Ink Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-gel-sepolia.inkonchain.com'] },
  },
  blockExplorers: {
    default: { name: 'Ink Explorer', url: 'https://explorer-sepolia.inkonchain.com' },
  },
  testnet: true,
});

export const seiTestnet = defineChain({
  id: 1328,
  name: 'Sei Testnet',
  nativeCurrency: { name: 'Sei', symbol: 'SEI', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evm-rpc-testnet.sei-apis.com'] },
  },
  blockExplorers: {
    default: { name: 'Sei Trace', url: 'https://seitrace.com/?chain=atlantic-2' },
  },
  testnet: true,
});

export const worldChainSepolia = defineChain({
  id: 4801,
  name: 'World Chain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://worldchain-sepolia.g.alchemy.com/public'] },
  },
  blockExplorers: {
    default: { name: 'World Chain Explorer', url: 'https://worldchain-sepolia.explorer.alchemy.com' },
  },
  testnet: true,
});

export const pharosTestnet = defineChain({
  id: 688689,
  name: 'Pharos Atlantic Testnet',
  nativeCurrency: { name: 'PHRS', symbol: 'PHRS', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://atlantic.dplabs-internal.com'] },
  },
  blockExplorers: {
    default: { name: 'Pharos Scan', url: 'https://atlantic.pharosscan.xyz' },
  },
  testnet: true,
});

export const codexTestnet = defineChain({
  id: 656476,
  name: 'Codex Testnet',
  nativeCurrency: { name: 'EDU', symbol: 'EDU', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.open-campus-codex.gelato.digital'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://opencampus-codex.blockscout.com' },
  },
  testnet: true,
});

export const edgeTestnet = defineChain({
  id: 3456,
  name: 'EDGE Testnet',
  nativeCurrency: { name: 'BTC', symbol: 'BTC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.layeredge.io'] },
  },
  blockExplorers: {
    default: { name: 'EdgeScan', url: 'https://testnet-explorer.layeredge.io' },
  },
  testnet: true,
});

export const injectiveTestnet = defineChain({
  id: 1439,
  name: 'Injective Testnet',
  nativeCurrency: { name: 'INJ', symbol: 'INJ', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://k8s.testnet.json-rpc.injective.network'] },
  },
  blockExplorers: {
    default: { name: 'inEVM Explorer', url: 'https://testnet.explorer.inevm.com' },
  },
  testnet: true,
});

export const morphTestnet = defineChain({
  id: 2810,
  name: 'Morph Holesky Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-holesky.morphl2.io'] },
  },
  blockExplorers: {
    default: { name: 'Morph Explorer', url: 'https://explorer-holesky.morphl2.io' },
  },
  testnet: true,
});

export const plumeTestnet = defineChain({
  id: 98867,
  name: 'Plume Testnet',
  nativeCurrency: { name: 'Plume', symbol: 'PLUME', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.plume.org'] },
  },
  blockExplorers: {
    default: { name: 'Plume Scan', url: 'https://testnet-explorer.plume.org' },
  },
  testnet: true,
});

export const xdcApothem = defineChain({
  id: 51,
  name: 'XDC Apothem',
  nativeCurrency: { name: 'TXDC', symbol: 'TXDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.apothem.network'] },
  },
  blockExplorers: {
    default: { name: 'XDCScan', url: 'https://apothem.xdcscan.io' },
  },
  testnet: true,
});

