# Bridgr Multi-Chain USDC Bridge

Bridgr is a premium cross-chain bridge ecosystem built specifically for the **Arc Network**. Leveraging Circle's Cross-Chain Transfer Protocol (CCTP) and Circle AppKit, Bridgr enables seamless, secure, and native USDC bridging across **23 EVM testnet chains + Solana Devnet (24 total)** with real-time analytics, automated gasless execution, built-in transaction recovery tools, and an embeddable SDK widget.

## 🚀 Live Demo & Deployment
- **Deployment URL:** [bridgr-usdc-bridge.vercel.app](https://bridgr-usdc-bridge.vercel.app) *(⚠️ FLAG: update once Vercel domain is renamed)*
- **Vercel Preview Deployments:** Handled automatically on every push to the `main` branch.

---

## 🛠️ Tech Stack & Modular Architecture

### Frontend & Visual System
- **Next.js 16 (App Router):** Fast routing, server-rendered layouts, and performant assets.
- **TypeScript:** Strict type safety across components, hooks, and contracts.
- **Framer Motion & Lucide Icons:** Physics-based spring animations and scalable iconography.
- **Three.js & React Three Fiber (R3F):** Immersive interactive 3D background grid.
- **Vanilla CSS / Tailwind CSS v4:** Curated, responsive dark/light themed styling system.

### Web3 Integration
- **Wagmi v2 & Viem v2:** React hooks and utilities for wallet connection and state management.
- **RainbowKit v2:** Premium wallet connection manager.
- **Circle AppKit & CCTP SDK:** Official Cross-Chain Transfer Protocol integration enabling direct on-chain burn-and-mint flows.

---

## 💎 Premium Feature Index

### 1. Multi-Chain Registry & Connectivity (24 Networks Supported)
Bridgr standardizes communication across 23 EVM testnets and Solana Devnet. Each chain is configured inside a centralized metadata registry (`constants/chains.ts`), acting as the single source of truth for the entire frontend and background scanning systems.

#### Supported Chains & USDC Token Addresses:
- **Arc Testnet** (Domain 26, Destination) - `0x3600000000000000000000000000000000000000`
- **Ethereum Sepolia** (Domain 0) - `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **Avalanche Fuji** (Domain 1) - `0x5425890298aed601595a70AB815c96711a31Bc65`
- **Optimism Sepolia** (Domain 2) - `0x5fd84259d66Cd46123540766Be93DFE6D43130D7`
- **Arbitrum Sepolia** (Domain 3) - `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- **Base Sepolia** (Domain 6) - `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Polygon Amoy** (Domain 7) - `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`
- **Unichain Sepolia** (Domain 10) - `0x31d0220469e10c4E71834a79b1f276d740d3768F`
- **Linea Sepolia** (Domain 11) - `0xFEce4462D57bD51A6A552365A011b95f0E16d9B7`
- **Sonic Testnet** (Domain 13) - `0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51`
- **World Chain Sepolia** (Domain 14) - `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88`
- **Monad Testnet** (Domain 15) - `0x534b2f3A21130d7a60830c2Df862319e593943A3`
- **Sei Testnet** (Domain 16) - `0x4fCF1784B31630811181f670Aea7A7bEF803eaED`
- **HyperEVM Testnet** (Domain 19) - `0x2B3370eE501B4a559b57D449569354196457D8Ab`
- **Ink Sepolia** (Domain 21) - `0xFabab97dCE620294D2B0b0e46C68964e326300Ac`
- **Pharos Atlantic Testnet** (Domain 31) - `0xcfc8330f4bcab529c625d12781b1c19466a9fc8b`
- **Codex Testnet** (Domain 12) - `0x6d7f141b6819C2c9CC2f818e6ad549E7Ca090F8f`
- **EDGE Testnet** (Domain 28) - `0x2d9F7CAD728051AA35Ecdc472a14cf8cDF5CFD6B`
- **Injective Testnet** (Domain 29) - `0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d`
- **Morph Holesky Testnet** (Domain 30) - `0xCfb1186F4e93D60E60a8bDd997427D1F33bc372B`
- **Plume Testnet** (Domain 22) - `0xcB5f30e335672893c7eb944B374c196392C19D18`
- **XDC Apothem** (Domain 18) - `0xb5AB69F7bBada22B28e79C8FFAECe55eF1c771D4`
- **Solana Devnet** (Domain 5, **LIVE** — Non-EVM) - `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` ✅

---

### 2. Developer Widget SDK Portal & Embeddable Viewports
- **Iframe Integration:** Allows external developers to embed the entire Bridgr bridge directly into their applications.
- **Widget-Only Mode:** Supports special URL queries (`?widget=true`) to customize the viewport, hiding extra layout elements for a seamless embed.
- **Dedicated Dev Portal:** An interactive Slide-over Drawer containing documentation, React code snippets, and iframe source configurations.
- **Frame Embedding CSP Security:** Set up robust frame-ancestors CSP headers to prevent clickjacking while allowing verified integrations.

---

### 3. Unified Portfolio & USDC Balance Dashboard
- **Total Portfolio Valuation:** Displays the total aggregated USDC balance across all supported testnets at the top of the Portfolio drawer.
- **Chain-by-Chain Breakdown:** Features a clean, tabular dashboard detailing individual chain balances, network names, and quick-action links.
- **Stale State Management:** Automatically resets manual state inputs and balances on network switches to avoid displaying stale data.

---

### 4. Real-Time RPC Latency Monitor
Pings all registered RPC URLs on chain picker dropdown open using `eth_blockNumber`.
- **Latency badges:** Green (`<200ms`), Yellow (`200ms-500ms`), and Red (`>500ms`/offline) indicator dots next to each network.

---

### 5. Cyberpunk UI & Visual Feedback System
- **Premium Cyberpunk Aesthetics:** Interactive 3D background grids, custom glowing cards, and micro-interactions.
- **Step Tracker & Particle Simulator:** Renders step-by-step progress with sleek Web3 glowing animations and particle flights simulating cross-chain packet transfers.
- **Theme-Aware Success View:** Success screen elements dynamically match dark and light themes, ensuring readability and visual brilliance.

---

### 6. Terminal-Style Shareable Bridge Receipt
- **Dual-Hash Display:** Captures both the source chain burn hash and destination mint hash.
- **Action Suite:** Built-in copy, share to X (Twitter), and open-in-explorer actions wrapped in a sleek, terminal-styled interface.

---

### 7. Integrated Faucet Hub & Premium Guide Modal
- **Faucet Hub:** Direct verified faucet links for all 23 EVM and non-EVM chains (including Morph, Monad, Sonic, Ink, Pharos, and Solana Devnet).
- **Premium Guide Modal:** Redesigned into a grid layout showcasing visual steps on how CCTP operates.

---

### 8. Gasless Relayer Mode
Toggling Auto-Relay Service (Gasless Mode) ON:
- Deducts a `$0.50 USDC` relayer subsidy fee from the transfer amount.
- Sets destination gas tokens cost to `$0.00 (Gasless)`.
- Relayer signs and mints automatically on the destination chain without prompts or wallet switches.

---

### 9. Smart Gas & Approval Optimizations
- **Allowance Pre-Check:** Scans existing token allowances to skip redundant token approval transactions, saving gas and time.
- **Dynamic Decimals Resolver:** Dynamically fetches USDC token decimals on-chain to handle custom decimals formatting on MetaMask safely.

---

### 10. CORS Proxy & Multi-Node Fallback Infrastructure
- **Serverless RPC Proxy:** Next.js `/api/rpc/[chainId]` endpoint proxies RPC requests server-side, bypassing browser CORS restrictions for chains with missing CORS headers (e.g. Arc Testnet).
- **Latency-Ranked Fallbacks:** Automatically ranks multi-node endpoints by latency every 30s and falls back if a primary node hangs or fails.

---

## 💻 Local Development

Create a `.env.local` file:
```env
NEXT_PUBLIC_WC_PROJECT_ID=148d42d3d9e29a8a706509f6df849a78
NEXT_PUBLIC_ARC_RPC=https://rpc.testnet.arc.network
```

Install packages and run:
```bash
npm install --legacy-peer-deps
npm run dev
```

---

## 👤 Developer Profile
- **Developer:** Asad Lee (IMSciences Student, Cyber Security Researcher)
- **Portfolio:** [asad-lee-portfolio.vercel.app](https://asad-lee-portfolio.vercel.app)
- **X (Twitter):** [@asadleo416](https://x.com/asadleo416)
- **LinkedIn:** Asad Ali Ali
- **Verification Wallet Address:** `0x4427e7f84908285fba94193709c985849a785b05`
