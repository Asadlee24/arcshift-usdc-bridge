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
import { http, fallback, type Transport } from 'wagmi';
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
import { getClientRpcUrls } from './rpcEndpoints';

// WalletConnect project ID from env
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '148d42d3d9e29a8a706509f6df849a78';

/**
 * Builds a transport for a chain from the central endpoint registry.
 *
 * Two things this fixes over the previous hardcoded list:
 *
 * 1. Correctness. Arc Testnet was wired directly to https://rpc.testnet.arc.network, which
 *    sends no CORS headers, so every browser read failed with "HTTP request failed /
 *    Failed to fetch" — the balanceOf error users hit. getClientRpcUrls() substitutes the
 *    same-origin /api/rpc proxy for endpoints like that. Sepolia and Polygon Amoy also had
 *    dead endpoints (404 / unreachable) in *first* position, so their reads paid a full
 *    timeout before falling back.
 *
 * 2. Speed. Every transport now batches: wagmi coalesces the many concurrent eth_calls the
 *    UI makes (balances, allowance, decimals, gas) into a single HTTP request per chain
 *    instead of one round trip each. Endpoints are also ordered fastest-first, and the
 *    per-request timeout is bounded so a slow node can't stall the UI.
 */
function transportFor(chainId: number): Transport {
  const urls = getClientRpcUrls(chainId);

  const options = {
    // Coalesce concurrent calls into one HTTP request (~16ms collection window).
    batch: { wait: 16 },
    // Bound each attempt so a hung node fails over quickly instead of hanging the UI.
    timeout: 8_000,
    retryCount: 1,
    retryDelay: 150,
  } as const;

  if (urls.length === 0) return http(undefined, options);
  if (urls.length === 1) return http(urls[0], options);

  // Ranking re-sorts endpoints by observed latency and stability every 30s, so traffic
  // migrates to whichever node is currently healthiest rather than sticking with a
  // degraded primary.

  return fallback(
    urls.map((url) => http(url, options)),
    { rank: { interval: 30_000 } }
  );
}

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
    [arcTestnet.id]: transportFor(arcTestnet.id),
    [sepolia.id]: transportFor(sepolia.id),
    [baseSepolia.id]: transportFor(baseSepolia.id),
    [arbitrumSepolia.id]: transportFor(arbitrumSepolia.id),
    [avalancheFuji.id]: transportFor(avalancheFuji.id),
    [optimismSepolia.id]: transportFor(optimismSepolia.id),
    [lineaSepolia.id]: transportFor(lineaSepolia.id),
    [polygonAmoy.id]: transportFor(polygonAmoy.id),
    // New chains from Arc BridgeChain enum
    [unichainSepolia.id]: transportFor(unichainSepolia.id),
    [sonicTestnet.id]: transportFor(sonicTestnet.id),
    [hyperEvmTestnet.id]: transportFor(hyperEvmTestnet.id),
    [monadTestnet.id]: transportFor(monadTestnet.id),
    [inkSepolia.id]: transportFor(inkSepolia.id),
    [seiTestnet.id]: transportFor(seiTestnet.id),
    [worldChainSepolia.id]: transportFor(worldChainSepolia.id),
    [pharosTestnet.id]: transportFor(pharosTestnet.id),
    [codexTestnet.id]: transportFor(codexTestnet.id),
    [edgeTestnet.id]: transportFor(edgeTestnet.id),
    [injectiveTestnet.id]: transportFor(injectiveTestnet.id),
    [morphTestnet.id]: transportFor(morphTestnet.id),
    [plumeTestnet.id]: transportFor(plumeTestnet.id),
    [xdcApothem.id]: transportFor(xdcApothem.id),
  },
  ssr: true, // Next.js App Router SSR compatibility
});
