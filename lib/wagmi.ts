// lib/wagmi.ts
// RainbowKit + Wagmi v2 Configuration — All supported chains registered for network switching

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  coinbaseWallet,
  walletConnectWallet,
  rainbowWallet,
  phantomWallet,
} from '@rainbow-me/rainbowkit/wallets';
import {
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  avalancheFuji,
  optimismSepolia,
  lineaSepolia,
  polygonAmoy,
} from 'wagmi/chains';
import { http, fallback } from 'wagmi';
import { arcTestnet } from './arcChain';
import {
  unichainSepolia,
  sonicTestnet,
  hyperEvmTestnet,
  monadTestnet,
  inkSepolia,
  seiTestnet,
  worldChainSepolia,
  pharosTestnet,
  codexTestnet,
  edgeTestnet,
  injectiveTestnet,
  morphTestnet,
  plumeTestnet,
  xdcApothem,
} from './allChains';

// WalletConnect project ID from env
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '148d42d3d9e29a8a706509f6df849a78';

export const config = getDefaultConfig({
  appName: 'ArcShift',
  projectId,
  wallets: [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, okxWallet, rabbyWallet],
    },
    {
      groupName: 'More Wallets',
      wallets: [coinbaseWallet, walletConnectWallet, rainbowWallet, phantomWallet],
    },
  ],
  chains: [
    // ── Core chains (original) ─────────────────────────
    arcTestnet,
    sepolia,
    baseSepolia,
    arbitrumSepolia,
    avalancheFuji,
    optimismSepolia,
    lineaSepolia,
    polygonAmoy,
    // ── New chains from Arc BridgeChain enum ───────────
    unichainSepolia,
    sonicTestnet,
    hyperEvmTestnet,
    monadTestnet,
    inkSepolia,
    seiTestnet,
    worldChainSepolia,
    pharosTestnet,
    codexTestnet,
    edgeTestnet,
    injectiveTestnet,
    morphTestnet,
    plumeTestnet,
    xdcApothem,
  ],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
    [sepolia.id]: fallback([
      http('https://rpc.sepolia.org'),
      http('https://ethereum-sepolia-rpc.publicnode.com'),
    ]),
    [baseSepolia.id]: fallback([
      http('https://sepolia.base.org'),
      http('https://base-sepolia-rpc.publicnode.com'),
    ]),
    [arbitrumSepolia.id]: fallback([
      http('https://sepolia-rollup.arbitrum.io/rpc'),
      http('https://arbitrum-sepolia-rpc.publicnode.com'),
    ]),
    [avalancheFuji.id]: fallback([
      http('https://api.avax-test.network/ext/bc/C/rpc'),
      http('https://avalanche-fuji-c-chain-rpc.publicnode.com'),
    ]),
    [optimismSepolia.id]: fallback([
      http('https://sepolia.optimism.io'),
      http('https://optimism-sepolia.drpc.org'),
    ]),
    [lineaSepolia.id]: fallback([
      http('https://rpc.sepolia.linea.build'),
      http('https://linea-sepolia-rpc.publicnode.com'),
    ]),
    [polygonAmoy.id]: fallback([
      http('https://rpc-amoy.polygon.technology'),
      http('https://polygon-amoy-bor-rpc.publicnode.com'),
    ]),
    // New chains from Arc BridgeChain enum
    [unichainSepolia.id]: http('https://sepolia.unichain.org'),
    [sonicTestnet.id]: http('https://rpc.testnet.soniclabs.com'),
    [hyperEvmTestnet.id]: http('https://rpc.hyperliquid-testnet.xyz/evm'),
    [monadTestnet.id]: http('https://testnet-rpc.monad.xyz'),
    [inkSepolia.id]: http('https://rpc-gel-sepolia.inkonchain.com'),
    [seiTestnet.id]: http('https://evm-rpc-testnet.sei-apis.com'),
    [worldChainSepolia.id]: http('https://worldchain-sepolia.g.alchemy.com/public'),
    [pharosTestnet.id]: http('https://atlantic.dplabs-internal.com'),
    [codexTestnet.id]: http('https://rpc.open-campus-codex.gelato.digital'),
    [edgeTestnet.id]: http('https://testnet-rpc.layeredge.io'),
    [injectiveTestnet.id]: http('https://k8s.testnet.json-rpc.injective.network'),
    [morphTestnet.id]: http('https://rpc-holesky.morphl2.io'),
    [plumeTestnet.id]: http('https://testnet-rpc.plume.org'),
    [xdcApothem.id]: http('https://rpc.apothem.network'),
  },
  ssr: true, // Next.js App Router SSR compatibility
});
