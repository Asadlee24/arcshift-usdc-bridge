// constants/chains.ts
// Arc-supported USDC Bridge Chain Configurations — All BridgeChain enum chains from Arc docs
// EVM chains: fully functional CCTP.

import { getPrimaryRpcUrl, getSolanaRpcUrl } from '../lib/rpcEndpoints';

export interface ChainMetadata {
  id: number;
  appKitId: string;        // BridgeChain enum value from @circle-fin/app-kit
  name: string;
  shortName: string;
  iconUrl: string;
  color: string;
  explorerUrl: string;
  rpcUrl: string;          // RPC endpoint for network communication and latency checks
  usdcAddress: string;
  isNativeArc: boolean;
  cctpDomain?: number;
  isComingSoon?: boolean;  // Non-EVM or chains without MetaMask support
  isSolana?: boolean;      // Requires separate Solana adapter
  supportsForwarding: boolean; // Circle CCTP Forwarding Service capability status for destination
}

export const SUPPORTED_CHAINS: ChainMetadata[] = [
  // ─── DESTINATION (always TO) ──────────────────────────────────────
  {
    id: 5042002,
    appKitId: 'Arc_Testnet',
    name: 'Arc Testnet',
    shortName: 'Arc',
    iconUrl: 'https://i.ibb.co/x8BwmWJR/6ceb4b2f-4218-408d-b61a-c34d0f3f181e.png',
    color: '#10B981',
    explorerUrl: 'https://testnet.arcscan.app',
    rpcUrl: getPrimaryRpcUrl(5042002),
    usdcAddress: '0x3600000000000000000000000000000000000000',
    isNativeArc: true,
    cctpDomain: 26,
    supportsForwarding: false, // Arc Testnet forwarding service is unconfirmed; default to manual mint fallback
  },

  // ─── STABLE EVM CHAINS ──────────────────────────────────────────
  {
    id: 11155111,
    appKitId: 'Ethereum_Sepolia',
    name: 'Ethereum Sepolia',
    shortName: 'Ethereum',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg',
    color: '#627EEA',
    explorerUrl: 'https://sepolia.etherscan.io',
    rpcUrl: getPrimaryRpcUrl(11155111),
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    isNativeArc: false,
    cctpDomain: 0,
    supportsForwarding: true,
  },

  {
    id: 84532,
    appKitId: 'Base_Sepolia',
    name: 'Base Sepolia',
    shortName: 'Base',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg',
    color: '#0052FF',
    explorerUrl: 'https://sepolia.basescan.org',
    rpcUrl: getPrimaryRpcUrl(84532),
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    isNativeArc: false,
    cctpDomain: 6,
    supportsForwarding: true,
  },
  {
    id: 421614,
    appKitId: 'Arbitrum_Sepolia',
    name: 'Arbitrum Sepolia',
    shortName: 'Arbitrum',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg',
    color: '#28A0F0',
    explorerUrl: 'https://sepolia.arbiscan.io',
    rpcUrl: getPrimaryRpcUrl(421614),
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    isNativeArc: false,
    cctpDomain: 3,
    supportsForwarding: true,
  },
  {
    id: 43113,
    appKitId: 'Avalanche_Fuji',
    name: 'Avalanche Fuji',
    shortName: 'Avalanche',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg',
    color: '#E84142',
    explorerUrl: 'https://testnet.snowtrace.io',
    rpcUrl: getPrimaryRpcUrl(43113),
    usdcAddress: '0x5425890298aed601595a70AB815c96711a31Bc65',
    isNativeArc: false,
    cctpDomain: 1,
    supportsForwarding: true,
  },
  {
    id: 11155420,
    appKitId: 'Optimism_Sepolia',
    name: 'OP Sepolia',
    shortName: 'Optimism',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg',
    color: '#FF0420',
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    rpcUrl: getPrimaryRpcUrl(11155420),
    usdcAddress: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    isNativeArc: false,
    cctpDomain: 2,
    supportsForwarding: true,
  },

  {
    id: 59141,
    appKitId: 'Linea_Sepolia',
    name: 'Linea Sepolia',
    shortName: 'Linea',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_linea.jpg',
    color: '#60A5FA',
    explorerUrl: 'https://sepolia.lineascan.build',
    rpcUrl: getPrimaryRpcUrl(59141),
    usdcAddress: '0xFEce4462D57bD51A6A552365A011b95f0E16d9B7',
    isNativeArc: false,
    cctpDomain: 11,
    supportsForwarding: true,
  },
  {
    id: 80002,
    appKitId: 'Polygon_Amoy_Testnet',
    name: 'Polygon Amoy',
    shortName: 'Polygon',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg',
    color: '#8247E5',
    explorerUrl: 'https://amoy.polygonscan.com',
    rpcUrl: getPrimaryRpcUrl(80002),
    usdcAddress: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    isNativeArc: false,
    cctpDomain: 7,
    supportsForwarding: true,
  },

  // ─── NEW EVM CHAINS ─────────────

  {
    id: 1301,
    appKitId: 'Unichain_Sepolia',
    name: 'Unichain Sepolia',
    shortName: 'Unichain',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_unichain.jpg',
    color: '#FF007A',
    explorerUrl: 'https://unichain-sepolia.blockscout.com',
    rpcUrl: getPrimaryRpcUrl(1301),
    usdcAddress: '0x31d0220469e10c4E71834a79b1f276d740d3768F',
    isNativeArc: false,
    cctpDomain: 10,
    supportsForwarding: true,
  },
  {
    id: 14601,
    appKitId: 'Sonic_Testnet',
    name: 'Sonic Testnet',
    shortName: 'Sonic',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_sonic.jpg',
    color: '#00D4AA',
    explorerUrl: 'https://testnet.sonicscan.org',
    rpcUrl: getPrimaryRpcUrl(14601),
    usdcAddress: '0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51',
    isNativeArc: false,
    cctpDomain: 13,
    supportsForwarding: true,
  },
  {
    id: 998,
    appKitId: 'HyperEVM_Testnet',
    name: 'HyperEVM Testnet',
    shortName: 'HyperEVM',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_hyperliquid.jpg',
    color: '#00C4FF',
    explorerUrl: 'https://testnet.purrsec.com',
    rpcUrl: getPrimaryRpcUrl(998),
    usdcAddress: '0x2B3370eE501B4a559b57D449569354196457D8Ab',
    isNativeArc: false,
    cctpDomain: 19,
    supportsForwarding: true,
  },
  {
    id: 10143,
    appKitId: 'Monad_Testnet',
    name: 'Monad Testnet',
    shortName: 'Monad',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_monad.jpg',
    color: '#836EF9',
    explorerUrl: 'https://testnet.monadexplorer.com',
    rpcUrl: getPrimaryRpcUrl(10143),
    usdcAddress: '0x534b2f3A21130d7a60830c2Df862319e593943A3',
    isNativeArc: false,
    cctpDomain: 15,
    supportsForwarding: true,
  },
  {
    id: 763373,
    appKitId: 'Ink_Testnet',
    name: 'Ink Sepolia',
    shortName: 'Ink',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_ink.jpg',
    color: '#7C3AED',
    explorerUrl: 'https://explorer-sepolia.inkonchain.com',
    rpcUrl: getPrimaryRpcUrl(763373),
    usdcAddress: '0xFabab97dCE620294D2B0b0e46C68964e326300Ac',
    isNativeArc: false,
    cctpDomain: 21,
    supportsForwarding: true,
  },
  {
    id: 1328,
    appKitId: 'Sei_Testnet',
    name: 'Sei Testnet',
    shortName: 'Sei',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_sei.jpg',
    color: '#9C1C44',
    explorerUrl: 'https://seitrace.com/?chain=atlantic-2',
    rpcUrl: getPrimaryRpcUrl(1328),
    usdcAddress: '0x4fCF1784B31630811181f670Aea7A7bEF803eaED',
    isNativeArc: false,
    cctpDomain: 16,
    supportsForwarding: true,
  },
  {
    id: 4801,
    appKitId: 'World_Chain_Sepolia',
    name: 'World Chain Sepolia',
    shortName: 'World',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_worldchain.png',
    color: '#191C1F',
    explorerUrl: 'https://worldchain-sepolia.explorer.alchemy.com',
    rpcUrl: getPrimaryRpcUrl(4801),
    usdcAddress: '0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88',
    isNativeArc: false,
    cctpDomain: 14,
    supportsForwarding: true,
  },
  {
    id: 688689,
    appKitId: 'Pharos_Testnet',
    name: 'Pharos Atlantic Testnet',
    shortName: 'Pharos',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_pharos.jpg',
    color: '#E8B84B',
    explorerUrl: 'https://atlantic.pharosscan.xyz',
    rpcUrl: getPrimaryRpcUrl(688689),
    usdcAddress: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
    isNativeArc: false,
    cctpDomain: 31,
    supportsForwarding: false,
  },
  {
    id: 656476,
    appKitId: 'Codex_Testnet',
    name: 'Codex Testnet',
    shortName: 'Codex',
    iconUrl: 'https://coin-images.coingecko.com/coins/images/30032/large/open-campus.png',
    color: '#D97706',
    explorerUrl: 'https://opencampus-codex.blockscout.com',
    rpcUrl: getPrimaryRpcUrl(656476),
    usdcAddress: '0x6d7f141b6819C2c9CC2f818e6ad549E7Ca090F8f',
    isNativeArc: false,
    cctpDomain: 12,
    supportsForwarding: true,
  },
  {
    id: 3456,
    appKitId: 'Edge_Testnet',
    name: 'EDGE Testnet',
    shortName: 'EDGE',
    iconUrl: 'https://layeredge.io/favicon.ico',
    color: '#3B82F6',
    explorerUrl: 'https://testnet-explorer.layeredge.io',
    rpcUrl: getPrimaryRpcUrl(3456),
    usdcAddress: '0x2d9F7CAD728051AA35Ecdc472a14cf8cDF5CFD6B',
    isNativeArc: false,
    cctpDomain: 28,
    supportsForwarding: true,
  },
  {
    id: 1439,
    appKitId: 'Injective_Testnet',
    name: 'Injective Testnet',
    shortName: 'Injective',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_injective.jpg',
    color: '#06B6D4',
    explorerUrl: 'https://testnet.explorer.inevm.com',
    rpcUrl: getPrimaryRpcUrl(1439),
    usdcAddress: '0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d',
    isNativeArc: false,
    cctpDomain: 29,
    supportsForwarding: false,
  },
  {
    id: 2810,
    appKitId: 'Morph_Testnet',
    name: 'Morph Holesky Testnet',
    shortName: 'Morph',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_morph.jpg',
    color: '#10B981',
    explorerUrl: 'https://explorer-holesky.morphl2.io',
    rpcUrl: getPrimaryRpcUrl(2810),
    usdcAddress: '0xCfb1186F4e93D60E60a8bDd997427D1F33bc372B',
    isNativeArc: false,
    cctpDomain: 30,
    isComingSoon: true,
    supportsForwarding: false,
  },
  {
    id: 98867,
    appKitId: 'Plume_Testnet',
    name: 'Plume Testnet',
    shortName: 'Plume',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_plume.jpg',
    color: '#EC4899',
    explorerUrl: 'https://testnet-explorer.plume.org',
    rpcUrl: getPrimaryRpcUrl(98867),
    usdcAddress: '0xcB5f30e335672893c7eb944B374c196392C19D18',
    isNativeArc: false,
    cctpDomain: 22,
    supportsForwarding: true,
  },
  {
    id: 51,
    appKitId: 'XDC_Apothem',
    name: 'XDC Apothem',
    shortName: 'XDC',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_xdc.jpg',
    color: '#1E3A8A',
    explorerUrl: 'https://apothem.xdcscan.io',
    rpcUrl: getPrimaryRpcUrl(51),
    usdcAddress: '0xb5AB69F7bBada22B28e79C8FFAECe55eF1c771D4',
    isNativeArc: false,
    cctpDomain: 18,
    supportsForwarding: true,
  },

  // ─── NON-EVM CHAINS (needs Solana adapter) ───────────────────────
  {
    id: 0,   // Solana has no EVM chain ID
    appKitId: 'Solana_Devnet',
    name: 'Solana Devnet',
    shortName: 'Solana',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_solana.jpg',
    color: '#9945FF',
    explorerUrl: 'https://solscan.io/?cluster=devnet',
    rpcUrl: getSolanaRpcUrl(),
    usdcAddress: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Solana Devnet USDC mint
    isNativeArc: false,
    cctpDomain: 5,
    isSolana: true,
    supportsForwarding: true,
  },
];

export const getChainById = (id: any): ChainMetadata | undefined => {
  if (id === undefined || id === null) return undefined;
  return SUPPORTED_CHAINS.find(c => String(c.id) === String(id));
};

export const getChainByAppKitId = (appKitId: string): ChainMetadata | undefined => {
  return SUPPORTED_CHAINS.find(c => c.appKitId === appKitId);
};

// Source chains (EVM + Solana, excluding Arc Testnet destination)
export const getSourceChains = (): ChainMetadata[] =>
  SUPPORTED_CHAINS.filter(c => !c.isNativeArc);

// Active source chains available in ChainPicker (no isComingSoon)
export const getActiveSourceChains = (): ChainMetadata[] =>
  SUPPORTED_CHAINS.filter(c => !c.isNativeArc && !c.isComingSoon);
