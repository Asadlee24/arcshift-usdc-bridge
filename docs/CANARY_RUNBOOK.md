# Bridgr Arc Mainnet Canary Runbook & Incident Response

> **Prepared for:** Asad Lee  
> **Target Release:** Arc Mainnet Launch (September 2026)  
> **Protocol:** Circle CCTP v2 Auto-Relay & Direct Mint  
> **Source Networks:** Base (`8453`), Ethereum (`1`), Arbitrum One (`42161`)  
> **Primary Destination:** Arc Mainnet (`5042`, Domain `26`)

---

## 1. Safety Principles & Pre-Conditions

1. **Explicit Authorization Required:** Never initiate a mainnet transaction with real user funds without human sign-off on the active canary wallet.
2. **Route-Specific Value Caps & Canary Budgets:**
   - **Base -> Arc Mainnet:** Principal `1.00 USDC`, Forwarding Relayer Fee `~0.02 USDC`, Source Gas `~0.0002 ETH (~$0.50)`. Total needed: ~1.05 USDC + 0.0005 ETH.
   - **Arbitrum -> Arc Mainnet:** Principal `1.00 USDC`, Forwarding Relayer Fee `~0.02 USDC`, Source Gas `~0.0001 ETH (~$0.25)`. Total needed: ~1.05 USDC + 0.0003 ETH.
   - **Arc Mainnet -> Base/Arbitrum:** Principal `1.00 USDC`, Forwarding Relayer Fee `~0.02 USDC`, Source Gas `~0.005 USDC`. Total needed: ~1.05 USDC native Arc.
   - **Arc Mainnet -> Ethereum L1:** **CRITICAL:** Do NOT attempt <= 1.00 USDC! Ethereum destination mint forwarding fee is `~1.01 - 1.31 USDC`. Recommended Canary Principal: `5.00 - 10.00 USDC`, Forwarding Relayer Fee `~1.25 USDC`, Source Gas `~0.005 USDC`. Total needed: ~12.00 USDC on Arc.
3. **No Unaudited Swaps:** Bridgr on mainnet is dedicated exclusively to native USDC cross-chain bridging via CCTP v2. Token swaps and simulated testnet escrows are strictly disabled.
4. **Isolated Storage:** Ensure your browser is using `bridgr-tx-history-mainnet`. Any legacy testnet records are segregated in `bridgr-tx-history-testnet`.

---

## 2. Pre-Flight Verification Checklist

Before initiating any canary transaction:

- [ ] **Arc Mainnet RPC Health:** Verify `https://rpc.mainnet.arc.io` is responding with block height and chain ID `5042`.
  ```bash
  curl -s -X POST https://rpc.mainnet.arc.io \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
  # Expected: {"jsonrpc":"2.0","id":1,"result":"0x13b2"} (5042 in decimal)
  ```
- [ ] **Source Chain Gas:** The canary wallet has sufficient native gas currency:
  - On Base: at least 0.0005 ETH (~$1.50)
  - On Arbitrum: at least 0.0003 ETH (~$0.90)
  - On Arc (for Arc -> EVM canary): at least 0.01 native USDC gas
- [ ] **USDC Balance:** The canary wallet holds the required principal + forwarding buffer for the target route.
- [ ] **Circle Iris API Health:** Verify the production Iris API endpoint is reachable:
  ```bash
  curl -s -I https://iris-api.circle.com/v2/messages/6?transactionHash=0x0
  # Expected: HTTP 404 or HTTP 200 (not 5xx or SSL error)
  ```

---

## 3. Step-by-Step Canary Procedure (Base -> Arc Mainnet)

### Step 1: Connect Canary Wallet
1. Open the Bridgr production application.
2. Connect the authorized Canary EVM wallet (e.g. via MetaMask, Rabby, or Coinbase Wallet).
3. Ensure the active network prompt switches to **Base Mainnet** (`Chain ID: 8453`).

### Step 2: Route & Parameter Entry
1. Select **FROM: Base** (`Chain ID: 8453`, `Domain: 6`).
2. Select **TO: Arc Mainnet** (`Chain ID: 5042`, `Domain: 26`).
3. Enter Amount: `1.00` USDC.
4. Speed Mode: Select **Standard** (free protocol fee) or **Fast** (~10 bps fee).
5. Inspect the **Fee Breakdown Panel**:
   - Source Gas: `~$0.01 ETH`
   - Circle Protocol Fee: `$0.00` (Standard) or `~$0.01` (Fast)
   - Circle Forwarding Fee: `~$0.02 USDC`
   - Net Received: `~0.98 USDC` (Standard) or `~0.97 USDC` (Fast)

### Step 3: Approval Confirmation
1. Click **BRIDGE USDC**.
2. Inspect the ERC-20 approval prompt in your wallet:
   - **Contract Spender:** Base TokenMessenger `0x1682Ae6375C4E4A97e4B583BC394c861A46D8962`
   - **Approved Amount:** Exactly `1.000000 USDC` (`1,000,000` units).
3. Confirm the approval transaction in your wallet.

### Step 4: Deposit For Burn Execution
1. Once approval is mined, the wallet will prompt for `depositForBurn`.
2. Inspect transaction parameters:
   - **Target Contract:** TokenMessenger (`0x1682Ae6375C4E4A97e4B583BC394c861A46D8962`)
   - **Destination Domain:** `26` (Arc Mainnet)
   - **Mint Recipient:** Your wallet address (padded to 32 bytes)
3. Sign and broadcast the transaction.

### Step 5: Immediate Persistence & Lifecycle Tracking
1. The source transaction hash (`burnTxHash`) will be saved immediately to `localStorage` under `bridgr-tx-history-mainnet` with stage `BURN_SUBMITTED`.
2. Bridgr Step Tracker will track:
   - **Step 1 (Approve Spend):** Done.
   - **Step 2 (Deposit for Burn):** Waiting for block inclusion receipt.
   - **Step 3 (Circle Attestation):** Polling Iris API `https://iris-api.circle.com/v2/messages/6?transactionHash=<hash>`.
   - **Step 4 (Destination Mint):** Polling Arc MessageTransmitter `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` for `usedNonces(nonce)`.

### Step 6: Completion Verification
1. Once `usedNonces(nonce) == 1`, Bridgr updates status to `DELIVERED`.
2. Check your wallet balance on Arc Mainnet:
   - Query native Arc precompile `0x3600000000000000000000000000000000000000` (`balanceOf`).
   - Expected increase: `+1.00 USDC`.
3. Record transaction hashes and attestation bytes in the deployment log.

---

## 4. Emergency Circuit Breaker & Incident Response

If anomalous behavior, unexpected Iris delays (>30 minutes), or upstream RPC outages occur:

### Triggering Emergency Pause
1. **Global Kill-Switch:**
   Set the following environment variable in the deployment dashboard (e.g. Vercel) and redeploy:
   ```env
   NEXT_PUBLIC_PAUSE_ALL_TRANSFERS=true
   ```
2. **Per-Route Kill-Switch (Base <-> Arc):**
   ```env
   NEXT_PUBLIC_PAUSE_ROUTE_8453_5042=true
   NEXT_PUBLIC_PAUSE_ROUTE_5042_8453=true
   ```
   *Note: Pausing prevents new burns but leaves recovery, attestation lookup, and manual claims fully functional.*

### Manual Recovery Procedure (If Attestation Delays or Relayer Fails)
If USDC was burned on the source chain but not auto-minted on destination:
1. **Funds are Safe:** Burned USDC cannot be stolen; the message is committed to Circle's protocol state machine.
2. **Fetch Attestation Manually:**
   ```bash
   curl -s "https://iris-api.circle.com/v2/messages/6?transactionHash=<BURN_TX_HASH>"
   ```
3. Extract `message` and `attestation` hex strings from the JSON response.
4. **Execute Manual Mint:**
   Connect to Arc Mainnet with your canary wallet. Call `receiveMessage(message, attestation)` on Arc MessageTransmitter:
   - **Contract Address:** `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64`
   - **Function:** `receiveMessage(bytes message, bytes attestation)`
5. Once executed, Circle mints the exact USDC amount directly to your destination recipient address.
