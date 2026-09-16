# Bridgr: Arc Mainnet USDC Cross-Chain Bridge

![Bridgr Banner](https://i.ibb.co/x8BwmWJR/6ceb4b2f-4218-408d-b61a-c34d0f3f181e.png)

> **Built by Asad Lee**  
> Cyber Security Researcher & Software Engineer  
> Verification Wallet: `0x4427e7f84908285fba94193709c985849a785b05`  
> Portfolio: [asad-lee-portfolio.vercel.app](https://asad-lee-portfolio.vercel.app) · X (Twitter): [@asadleo416](https://x.com/asadleo416)

Bridgr is a high-performance cross-chain USDC bridge engineered specifically for the **Arc Network**. Leveraging Circle's **Cross-Chain Transfer Protocol (CCTP v2)**, Bridgr provides native, 1-signature auto-relayed USDC bridging between **Arc Mainnet** and premier EVM partner networks (**Base**, **Ethereum**, and **Arbitrum One**).

Bridgr eliminates wrapped-token vulnerabilities, liquidity pool slippage, and complex two-step claiming procedures by burning native USDC on the source network and auto-minting native USDC directly into the recipient's wallet on the destination network.

---

## 🚀 Key Highlights & Architecture

- **Arc Mainnet Native Integration:** Direct connectivity to Arc Mainnet (Chain ID `5042`, CCTP Domain `26`) and its native precompiled USDC interface.
- **Circle CCTP v2 Protocol:** True burn-and-mint finality verified directly on-chain via Circle's `MessageTransmitterV2.usedNonces`.
- **Single-Signature Auto-Relaying:** Senders sign once on the source network; native USDC is automatically minted on the destination chain without manual claims.
- **Arc Native Gas Reservation:** Automatically accounts for Arc's dual gas token dynamics (native 18-decimal gas vs. 6-decimal precompile ERC-20) during `MAX` balance bridge calculations to prevent out-of-gas failures.
- **Immediate Burn Persistence:** Saves transactions immediately upon wallet broadcast before block inclusion to guarantee funds are tracked even across browser crashes.
- **Strict RPC Security Proxy:** Protects browser endpoints from CORS issues with strict JSON-RPC method allowlisting, 32 KB request limits, and upstream failover.
- **Emergency Circuit Breaker:** Granular per-route and global pause controls (`NEXT_PUBLIC_PAUSE_ALL_TRANSFERS`) to halt new burns while preserving recovery flows.

---

## 🏛️ Mainnet CCTP v2 Contract Matrix

| Network | Chain ID | CCTP Domain | Native USDC (ERC-20) | TokenMessenger | MessageTransmitter |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **Arc Mainnet** | `5042` | `26` | `0x3600000000000000000000000000000000000000` | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` |
| **Base** | `8453` | `6` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `0x1682Ae6375C4E4A97e4B583BC394c861A46D8962` | `0xAD0978E57E4368944501a3F49c81729013FaB947` |
| **Ethereum** | `1` | `0` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `0xbd3fa81b58ba92a82136038b25adec7066af3155` | `0x0a992d35273e3b790850ca14e0b68224741e7774` |
| **Arbitrum One** | `42161` | `3` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `0x19330d52D99E304216D853845416572e9a5957b7` | `0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca` |

*Note: Solana Mainnet is gated pending independent verification.*

---

## 🔬 Testnet CCTP v2 Contract Matrix

When `NEXT_PUBLIC_APP_ENV=testnet` is enabled, Bridgr seamlessly routes to verified testnet counterparts:

| Network | Chain ID | CCTP Domain | Native USDC (ERC-20) | TokenMessenger | MessageTransmitter |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **Arc Testnet** | `5042002` | `26` | `0x3600000000000000000000000000000000000000` | `0x805206361a49B602eb6E719601d368e5feA9Efa0` | `0xE567634f1ffE0f3Be5eEF95A642c67E4254f15dC` |
| **Base Sepolia** | `84532` | `6` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5` | `0x7865fAfC2db2093669d92c0F33AeEF291086BEFD` |
| **Ethereum Sepolia** | `11155111` | `0` | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | `0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5` | `0x7865fAfC2db2093669d92c0F33AeEF291086BEFD` |
| **Arbitrum Sepolia** | `421614` | `3` | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | `0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5` | `0xaCF1ceeF35cfAC5613777235a90334f9748548b0` |

---

## 🛠️ Security & Architecture Standards

### 1. Circle Iris MessageV2 Standards Compliance
In Circle MessageV2, the cross-chain sequence nonce is formatted as a 32-byte field at byte offset 12 (hex index 24 to 87). Destination delivery is checked on `MessageTransmitterV2.usedNonces(bytes32 nonce)`. Bridgr verifies on-chain receipts rather than simulating delivery states.

### 2. Arc Native Gas Dynamics
On Arc Network, the native gas token is USDC denominated with 18 decimals, while the precompiled ERC-20 contract is 6 decimals. Bridgr's `calculateMaxBridgeAmount` reserves estimated gas in native units to prevent bridge transactions from reverting due to out-of-gas conditions.

### 3. Server-Side RPC Proxy
Arc RPC nodes reject client CORS preflight requests. Bridgr proxies calls through `POST /api/rpc/[chainId]`:
- Restricts incoming methods to a strict read-only allowlist (`eth_call`, `eth_blockNumber`, `eth_getBalance`, `eth_getTransactionReceipt`, etc.).
- Enforces a 32 KB payload limit and batch caps.
- Automatically fails over across verified backup RPC nodes with latency tracking.

---

## 🧪 Automated Testing

Bridgr includes automated regression tests covering protocol message parsing, gas reservation calculations, route fee quotes, lifecycle state machine transitions, and RPC proxy boundaries:

```bash
# Run automated tests using Node 24 native test runner
npm test
```

Test coverage:
- `test/cctp_message.test.ts`: CCTP v2 32-byte nonce offset, BurnMessage decoding, bytes32 address conversion.
- `test/bridge_quotes.test.ts`: Dynamic Iris fees, strict numeric input validation, 6-decimal BigInt precision, Arc native gas reservation.
- `test/state_machine.test.ts`: Lifecycle state transitions, pre-burn terminal guards, post-burn recovery guarantees.
- `test/rpc_proxy.test.ts`: Strict JSON-RPC method allowlist and rejection of unauthorized methods.

---

## 💻 Local Development & Deployment

### 1. Environment Configuration
Copy the template file:
```bash
cp .env.example .env.local
```
Configure your Reown / WalletConnect Cloud project ID and Supabase credentials.

### 2. Installation & Run
```bash
npm install --legacy-peer-deps
npm run dev
```

### 3. Canary Live Transfer Runbook
Before executing real-value transfers on Arc Mainnet, follow the step-by-step small-value canary procedure documented in:
[docs/CANARY_RUNBOOK.md](docs/CANARY_RUNBOOK.md).

---

## 👤 Credits & Author

**Built with pride by Asad Lee**  
- **Profile:** Cyber Security Researcher & Software Engineer  
- **Verification Wallet:** `0x4427e7f84908285fba94193709c985849a785b05`  
- **Portfolio:** [asad-lee-portfolio.vercel.app](https://asad-lee-portfolio.vercel.app)  
- **X (Twitter):** [@asadleo416](https://x.com/asadleo416)  
- **LinkedIn:** [Asad Ali Ali](https://linkedin.com/in/asad-ali-ali)  
