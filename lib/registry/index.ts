// lib/registry/index.ts
// Single source of truth for Bridgr USDC bridge network configuration, CCTP v2 contracts,
// domain mappings, and route capabilities across Mainnet and Testnet.

export type NetworkEnvironment = 'mainnet' | 'testnet';

export interface ChainConfig {
  id: number;
  domain: number;
  name: string;
  shortName: string;
  iconUrl: string;
  color: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  usdcAddress: `0x${string}`;
  usdcDecimals: number;
  tokenMessengerAddress: `0x${string}`;
  messageTransmitterAddress: `0x${string}`;
  rpcUrls: string[];
  explorerUrl: string;
  isNativeArc: boolean;
  isSolana?: boolean;
  supportsFastTransferSource: boolean;
  supportsForwardingDest: boolean;
  enabled: boolean;
  statusReason?: string;
}

export interface RouteCapability {
  fromChain: ChainConfig | null;
  toChain: ChainConfig | null;
  enabled: boolean;
  supportsFastTransfer: boolean;
  supportsForwarding: boolean;
  reason?: string;
}

export const MAINNET_CHAINS: Record<number, ChainConfig> = {
  // ─── Arc Mainnet ───────────────────────────────────────────────
  5042: {
    id: 5042,
    domain: 26,
    name: 'Arc Mainnet',
    shortName: 'Arc',
    iconUrl: 'https://i.ibb.co/x8BwmWJR/6ceb4b2f-4218-408d-b61a-c34d0f3f181e.png',
    color: '#C8922A',
    nativeCurrency: {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 18, // Native gas is 18 decimals
    },
    usdcAddress: '0x3600000000000000000000000000000000000000', // Precompile ERC-20 (6 decimals)
    usdcDecimals: 6,
    tokenMessengerAddress: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitterAddress: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    rpcUrls: ['https://rpc.mainnet.arc.io', 'https://rpc.arc.io'],
    explorerUrl: 'https://explorer.arc.io',
    isNativeArc: true,
    supportsFastTransferSource: false,
    supportsForwardingDest: true,
    enabled: true,
  },

  // ─── Base Mainnet ──────────────────────────────────────────────
  8453: {
    id: 8453,
    domain: 6,
    name: 'Base',
    shortName: 'Base',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg',
    color: '#0052FF',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    usdcDecimals: 6,
    tokenMessengerAddress: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitterAddress: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    rpcUrls: ['https://mainnet.base.org', 'https://base.llamarpc.com'],
    explorerUrl: 'https://basescan.org',
    isNativeArc: false,
    supportsFastTransferSource: true,
    supportsForwardingDest: true,
    enabled: true,
  },

  // ─── Ethereum Mainnet ──────────────────────────────────────────
  1: {
    id: 1,
    domain: 0,
    name: 'Ethereum',
    shortName: 'Ethereum',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg',
    color: '#627EEA',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    usdcDecimals: 6,
    tokenMessengerAddress: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitterAddress: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    rpcUrls: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
    explorerUrl: 'https://etherscan.io',
    isNativeArc: false,
    supportsFastTransferSource: true,
    supportsForwardingDest: true,
    enabled: true,
  },

  // ─── Arbitrum One ──────────────────────────────────────────────
  42161: {
    id: 42161,
    domain: 3,
    name: 'Arbitrum One',
    shortName: 'Arbitrum',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg',
    color: '#28A0F0',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    usdcDecimals: 6,
    tokenMessengerAddress: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitterAddress: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'],
    explorerUrl: 'https://arbiscan.io',
    isNativeArc: false,
    supportsFastTransferSource: true,
    supportsForwardingDest: true,
    enabled: true,
  },
};

export const TESTNET_CHAINS: Record<number, ChainConfig> = {
  // ─── Arc Testnet ───────────────────────────────────────────────
  5042002: {
    id: 5042002,
    domain: 26,
    name: 'Arc Testnet',
    shortName: 'Arc',
    iconUrl: 'https://i.ibb.co/x8BwmWJR/6ceb4b2f-4218-408d-b61a-c34d0f3f181e.png',
    color: '#10B981',
    nativeCurrency: {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 18,
    },
    usdcAddress: '0x3600000000000000000000000000000000000000',
    usdcDecimals: 6,
    tokenMessengerAddress: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitterAddress: '0xE49B30F362e49Fd14dBECfcC7d65B626C8354c4f',
    rpcUrls: ['https://rpc.testnet.arc.network'],
    explorerUrl: 'https://testnet.arcscan.app',
    isNativeArc: true,
    supportsFastTransferSource: false,
    supportsForwardingDest: true,
    enabled: true,
  },

  // ─── Base Sepolia ──────────────────────────────────────────────
  84532: {
    id: 84532,
    domain: 6,
    name: 'Base Sepolia',
    shortName: 'Base',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg',
    color: '#0052FF',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    usdcDecimals: 6,
    tokenMessengerAddress: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitterAddress: '0x7865fAfC2db2093669d92c0F33AEEF291086BEFD',
    rpcUrls: ['https://sepolia.base.org'],
    explorerUrl: 'https://sepolia.basescan.org',
    isNativeArc: false,
    supportsFastTransferSource: true,
    supportsForwardingDest: true,
    enabled: true,
  },

  // ─── Ethereum Sepolia ──────────────────────────────────────────
  11155111: {
    id: 11155111,
    domain: 0,
    name: 'Ethereum Sepolia',
    shortName: 'Ethereum',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg',
    color: '#627EEA',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    usdcDecimals: 6,
    tokenMessengerAddress: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitterAddress: '0x7865fAfC2db2093669d92c0F33AEEF291086BEFD',
    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://1rpc.io/sepolia'],
    explorerUrl: 'https://sepolia.etherscan.io',
    isNativeArc: false,
    supportsFastTransferSource: true,
    supportsForwardingDest: true,
    enabled: true,
  },

  // ─── Arbitrum Sepolia ──────────────────────────────────────────
  421614: {
    id: 421614,
    domain: 3,
    name: 'Arbitrum Sepolia',
    shortName: 'Arbitrum',
    iconUrl: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg',
    color: '#28A0F0',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    usdcDecimals: 6,
    tokenMessengerAddress: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitterAddress: '0x7865fAfC2db2093669d92c0F33AEEF291086BEFD',
    rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
    explorerUrl: 'https://sepolia.arbiscan.io',
    isNativeArc: false,
    supportsFastTransferSource: true,
    supportsForwardingDest: true,
    enabled: true,
  },
};

/**
 * Resolves active environment based on process.env.NEXT_PUBLIC_APP_ENV.
 * Defaults to 'mainnet'.
 */
export function getActiveEnvironment(): NetworkEnvironment {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_ENV === 'testnet') {
    return 'testnet';
  }
  return 'mainnet';
}

/**
 * Returns chains registered for the requested or current environment.
 */
export function getChainsForEnvironment(env?: NetworkEnvironment): Record<number, ChainConfig> {
  const activeEnv = env || getActiveEnvironment();
  return activeEnv === 'mainnet' ? MAINNET_CHAINS : TESTNET_CHAINS;
}

/**
 * Looks up chain config across the given or active environment.
 */
export function getChainConfig(chainId: number, env?: NetworkEnvironment): ChainConfig | undefined {
  const chains = getChainsForEnvironment(env);
  return chains[chainId];
}

/**
 * Finds chain config by CCTP domain ID.
 */
export function getChainConfigByDomain(domain: number, env?: NetworkEnvironment): ChainConfig | undefined {
  const chains = getChainsForEnvironment(env);
  return Object.values(chains).find(c => c.domain === domain);
}

/**
 * Circle Iris API base URL.
 */
export function getIrisApiBaseUrl(env?: NetworkEnvironment): string {
  const activeEnv = env || getActiveEnvironment();
  return activeEnv === 'mainnet'
    ? 'https://iris-api.circle.com'
    : 'https://iris-api-sandbox.circle.com';
}

/**
 * Evaluates route capability and verifies correctness at boundary.
 */
export function validateRoute(
  fromChainId: number,
  toChainId: number,
  env?: NetworkEnvironment
): RouteCapability {
  const activeEnv = env || getActiveEnvironment();
  const chains = getChainsForEnvironment(activeEnv);
  const fromChain = chains[fromChainId];
  const toChain = chains[toChainId];

  if (!fromChain) {
    return {
      fromChain: null,
      toChain: null,
      enabled: false,
      supportsFastTransfer: false,
      supportsForwarding: false,
      reason: `Source chain ID ${fromChainId} is not supported in ${activeEnv}.`,
    };
  }

  if (!toChain) {
    return {
      fromChain,
      toChain: null,
      enabled: false,
      supportsFastTransfer: false,
      supportsForwarding: false,
      reason: `Destination chain ID ${toChainId} is not supported in ${activeEnv}.`,
    };
  }

  if (fromChainId === toChainId) {
    return {
      fromChain,
      toChain,
      enabled: false,
      supportsFastTransfer: false,
      supportsForwarding: false,
      reason: 'Source and destination chains must be different.',
    };
  }

  // Exactly one of the chains must be Arc to ensure Bridgr core bridge focus
  if (!fromChain.isNativeArc && !toChain.isNativeArc) {
    return {
      fromChain,
      toChain,
      enabled: false,
      supportsFastTransfer: false,
      supportsForwarding: false,
      reason: 'Every Bridgr route must connect directly to Arc (Arc as source or destination).',
    };
  }

  if (!fromChain.enabled || !toChain.enabled) {
    return {
      fromChain,
      toChain,
      enabled: false,
      supportsFastTransfer: false,
      supportsForwarding: false,
      reason: 'One or both selected networks are temporarily unavailable.',
    };
  }

  return {
    fromChain,
    toChain,
    enabled: true,
    supportsFastTransfer: fromChain.supportsFastTransferSource,
    supportsForwarding: toChain.supportsForwardingDest,
  };
}
