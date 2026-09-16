// constants/chains.ts
// Arc-supported USDC Bridge Chain Configurations derived from lib/registry
// Supports both Arc Mainnet (5042) and Arc Testnet (5042002) with strict environment isolation.

import {
  getActiveEnvironment,
  getChainConfig,
  getChainsForEnvironment,
  MAINNET_CHAINS,
  TESTNET_CHAINS,
  ChainConfig,
} from '../lib/registry';

export interface ChainMetadata {
  id: number;
  appKitId: string;
  name: string;
  shortName: string;
  iconUrl: string;
  color: string;
  explorerUrl: string;
  rpcUrl: string;
  usdcAddress: string;
  isNativeArc: boolean;
  cctpDomain?: number;
  isComingSoon?: boolean;
  isSolana?: boolean;
  supportsForwarding: boolean;
  supportsFastTransfer?: boolean;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

function configToMetadata(c: ChainConfig): ChainMetadata {
  return {
    id: c.id,
    appKitId: c.name.replace(/\s+/g, '_'),
    name: c.name,
    shortName: c.shortName,
    iconUrl: c.iconUrl,
    color: c.color,
    explorerUrl: c.explorerUrl,
    rpcUrl: c.rpcUrls[0],
    usdcAddress: c.usdcAddress,
    isNativeArc: c.isNativeArc,
    cctpDomain: c.domain,
    isComingSoon: !c.enabled,
    isSolana: c.isSolana || false,
    supportsForwarding: c.supportsForwardingDest,
    supportsFastTransfer: c.supportsFastTransferSource,
    nativeCurrency: c.nativeCurrency,
  };
}

export const MAINNET_METADATA_CHAINS: ChainMetadata[] = [
  configToMetadata(MAINNET_CHAINS[5042]),
  configToMetadata(MAINNET_CHAINS[8453]),
  configToMetadata(MAINNET_CHAINS[1]),
  configToMetadata(MAINNET_CHAINS[42161]),
  {
    id: 0,
    appKitId: 'Solana_Mainnet',
    name: 'Solana Mainnet',
    shortName: 'Solana',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_solana.jpg',
    color: '#9945FF',
    explorerUrl: 'https://solscan.io',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    usdcAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    isNativeArc: false,
    cctpDomain: 5,
    isComingSoon: true, // Solana mainnet is gated pending independent verification
    isSolana: true,
    supportsForwarding: false,
    supportsFastTransfer: false,
  },
];

export const TESTNET_METADATA_CHAINS: ChainMetadata[] = [
  configToMetadata(TESTNET_CHAINS[5042002]),
  configToMetadata(TESTNET_CHAINS[84532]),
  configToMetadata(TESTNET_CHAINS[11155111]),
  configToMetadata(TESTNET_CHAINS[421614]),
  {
    id: 43113,
    appKitId: 'Avalanche_Fuji',
    name: 'Avalanche Fuji',
    shortName: 'Avalanche',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg',
    color: '#E84142',
    explorerUrl: 'https://testnet.snowtrace.io',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    usdcAddress: '0x5425890298aed601595a70AB815c96711a31Bc65',
    isNativeArc: false,
    cctpDomain: 1,
    isComingSoon: false,
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
    rpcUrl: 'https://sepolia.optimism.io',
    usdcAddress: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    isNativeArc: false,
    cctpDomain: 2,
    isComingSoon: false,
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
    rpcUrl: 'https://atlantic.pharosscan.xyz/rpc',
    usdcAddress: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
    isNativeArc: false,
    cctpDomain: 31,
    isComingSoon: true,
    supportsForwarding: false, // Forwarding unsupported according to Circle capability table
  },
  {
    id: 1439,
    appKitId: 'Injective_Testnet',
    name: 'Injective Testnet',
    shortName: 'Injective',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_injective.jpg',
    color: '#06B6D4',
    explorerUrl: 'https://testnet.explorer.inevm.com',
    rpcUrl: 'https://testnet.rpc.inevm.com',
    usdcAddress: '0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d',
    isNativeArc: false,
    cctpDomain: 29,
    isComingSoon: true,
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
    rpcUrl: 'https://rpc-holesky.morphl2.io',
    usdcAddress: '0xCfb1186F4e93D60E60a8bDd997427D1F33bc372B',
    isNativeArc: false,
    cctpDomain: 30,
    isComingSoon: true,
    supportsForwarding: false,
  },
];

export const SUPPORTED_CHAINS: ChainMetadata[] =
  getActiveEnvironment() === 'mainnet' ? MAINNET_METADATA_CHAINS : TESTNET_METADATA_CHAINS;

export const getChainById = (id: any): ChainMetadata | undefined => {
  if (id === undefined || id === null) return undefined;
  const numId = Number(id);

  // Check active environment first
  const activeMatch = SUPPORTED_CHAINS.find(c => c.id === numId);
  if (activeMatch) return activeMatch;

  // Fallback to cross-environment check
  const allChains = [...MAINNET_METADATA_CHAINS, ...TESTNET_METADATA_CHAINS];
  return allChains.find(c => c.id === numId);
};

export const getChainByAppKitId = (appKitId: string): ChainMetadata | undefined => {
  return SUPPORTED_CHAINS.find(c => c.appKitId === appKitId);
};

/**
 * Returns chains available to choose as source.
 */
export const getSourceChains = (): ChainMetadata[] => {
  return SUPPORTED_CHAINS;
};

/**
 * Active source chains available in ChainPicker (excluding 'coming soon').
 */
export const getActiveSourceChains = (): ChainMetadata[] => {
  return SUPPORTED_CHAINS.filter(c => !c.isComingSoon);
};
