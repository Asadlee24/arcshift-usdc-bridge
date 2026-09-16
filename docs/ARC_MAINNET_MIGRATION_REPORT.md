# Bridgr Arc Mainnet Release Verification & Migration Report

> **Prepared for:** Asad Lee  
> **Brand & Attribution:** Built by Asad Lee  
> **Repository:** [https://github.com/Asadlee24/arcshift-usdc-bridge](https://github.com/Asadlee24/arcshift-usdc-bridge)  
> **Target Release:** Arc Mainnet Launch (September 2026)  
> **Final Commit SHA:** `c94aea4`  
> **Active Remote Branches:** `arc-mainnet-migration` & `main`  
> **Vercel Production Target:** [https://bridgr-usdc-bridge.vercel.app/](https://bridgr-usdc-bridge.vercel.app/)  
> **Operational Status:** **Ready for Authorized Canary** (Pre-release gates passed; awaiting human-authorized live transaction)

---

## 1. Executive Summary

This report provides reproducible technical evidence for the migration of **Bridgr** to **Arc Mainnet** (`Chain ID: 5042`, `CCTP Domain: 26`). All critical vulnerabilities identified during the architecture audit have been remediated:
1. **Clean Production Build:** The Next.js 16 Webpack client bundle packaging error was resolved at the root configuration level without modifying `node_modules` or disabling minification.
2. **Complete Fee Handling:** Dynamic query and accounting of Circle Iris API forwarding relayer fees and fast transfer protocol fees. Zero protocol fee no longer implies zero total fee.
3. **Exact Transfer Delivery:** Full CCTP v2 message decoding, strict matching against confirmed source burn parameters, `usedNonces` on-chain verification, and real event log transaction hash extraction.
4. **Resilient Recovery Lifecycle:** 6 automated test scenarios proving crash resilience, persistence immediately after burn submission, timeout handling, and duplicate claim protection.
5. **Data Integrity & Security Boundary:** Hardened Supabase Row Level Security (RLS) preventing anonymous clients from forging verified financial states.
6. **Route-Specific Canary Budget:** Granular budget matrix separating principal, source gas, and forwarding fees across Base, Arbitrum, Arc, and Ethereum L1.

---

## 2. Reproducible Evidence: Build, Typecheck, Lint & Test Results

All verification commands execute cleanly against pristine `node_modules` with exit code `0`:

### A. Production Webpack Build (`npm run build`)
- **Command:** `npm run build` (`next build --webpack`)
- **Exit Code:** `0`
- **Pristine Environment:** No debug patches in `node_modules/next`. Full minification active.
- **Root Cause & Fix:** Next.js client webpack configuration in `next.config.ts` previously assigned Node/React-Native modules (`@react-native-async-storage/async-storage`, `pino-pretty`, `encoding`, `lokijs`) to `config.externals`. In client bundles, Webpack emits `typeof <package>` syntax for externals, generating illegal JavaScript tokens for scoped packages. The fix moved these packages into `config.resolve.fallback = { ...: false }` for client bundles and added `outputFileTracingRoot`.
- **Output:**
  ```text
  ▲ Next.js 16.2.6 (webpack)
    Creating an optimized production build ...
  ✓ Compiled successfully in 55s
    Running TypeScript ...
    Finished TypeScript in 33.2s ...
  ✓ Generating static pages using 3 workers (5/5) in 1793ms
    Finalizing page optimization ...
    Collecting build traces ...

  Route (app)
  ┌ ○ /
  ├ ○ /_not-found
  ├ ○ /analytics
  └ ƒ /api/rpc/[chainId]
  ```

### B. Typecheck (`npx tsc --noEmit`)
- **Command:** `npx tsc --noEmit`
- **Exit Code:** `0`
- **Output:** Clean exit with 0 diagnostic errors across all TypeScript source files.

### C. Linter (`npm run lint`)
- **Command:** `npm run lint` (`eslint`)
- **Exit Code:** `0`
- **Output:** `✖ 120 problems (0 errors, 120 warnings)`

### D. Automated Unit & Integration Tests (`npm test`)
- **Command:** `npm test` (`node --test`)
- **Exit Code:** `0`
- **Output:**
  ```text
  ▶ Bridge Quotes & Validation Rules (8 tests) ✔
  ▶ Circle CCTP v2 Message Decoder (4 tests) ✔
  ▶ Bridge Recovery & Persistence Lifecycle (6 tests) ✔
  ▶ RPC Proxy Security Boundary (3 tests) ✔
  ▶ Bridge Lifecycle State Machine (6 tests) ✔
  ℹ tests 27 | suites 5 | pass 27 | fail 0 | cancelled 0 | duration_ms 1570ms
  ```

---

## 3. Fee Handling & Dynamic Forwarding Mechanics

### The Rule: Zero Protocol Fee ≠ Zero Total Fee
Circle CCTP v2 standard transfers charge a **0 protocol fee**. However, when auto-forwarding is enabled (`isForwarding = true`), Circle's relaying infrastructure executes the destination `receiveMessage` mint transaction on behalf of the user. Circle charges a **forwarding fee** (`forwardFee.med`) deducted directly from the minted USDC amount.

### Dynamic Live Iris API Query
Bridgr queries the Circle Iris API live at runtime:
`GET https://iris-api.circle.com/v2/burn/USDC/fees/{sourceDomain}/{destDomain}?forward=true`

| Route | Speed Mode | Protocol Fee | Forwarding Relayer Fee | Total Fee Deducted | Max Fee Buffer (`maxFee`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Base -> Arc** | Standard | `0.0000 USDC` | `~0.0199 USDC` (`19,968` units) | `~0.0200 USDC` | `~0.0270 USDC` |
| **Base -> Arc** | Fast | `0.3250 USDC` | `~0.0199 USDC` (`19,968` units) | `~0.3449 USDC` | `~0.3844 USDC` |
| **Arc -> Base** | Standard | `0.0000 USDC` | `~0.0200 USDC` (`20,000` units) | `~0.0200 USDC` | `~0.0270 USDC` |
| **Arc -> Arbitrum**| Standard | `0.0000 USDC` | `~0.0200 USDC` (`20,000` units) | `~0.0200 USDC` | `~0.0270 USDC` |
| **Arc -> Ethereum**| Standard | `0.0000 USDC` | `~1.0145 - 1.3140 USDC` | `~1.2500 USDC` | `~1.3800 USDC` |

### Key Mathematical Guarantees in `lib/bridge/quotes.ts`
1. `totalFeeUnits = protocolFeeUnits + forwardingFeeUnits`
2. `expectedReceiveUnits = sendAmountUnits - totalFeeUnits`
3. `maxFeeUnits = totalFeeUnits + (totalFeeUnits / 10n) + 5_000n` (protects against minor destination gas spikes).
4. Strict threshold guard: `sendAmountUnits > totalFeeUnits` enforced before permitting approval or burn.

---

## 4. Exact Transfer Delivery & CCTP v2 Verification

Bridgr eliminates false-positive delivery notifications and fabricated hashes:
1. **Source Burn Event Decoding:** Parses `MessageSent(bytes message)` from the confirmed transaction receipt.
2. **Attested Message Matching:** Decodes `MessageV2` (header + `BurnMessage`) using `lib/cctp/messageV2.ts`. Validates:
   - `message.sourceDomain === expectedSourceDomain`
   - `message.destinationDomain === expectedDestDomain`
   - `burnMessage.burnToken === expectedSourceUsdcAddress`
   - `bytes32ToAddress(burnMessage.mintRecipient) === expectedRecipient`
   - `burnMessage.amount === expectedAmountUnits`
3. **On-Chain Delivery Check:** Directly queries Arc `MessageTransmitterV2` (`0x81D40F21F12A8F0E3252Bccb954D722d4c464B64`) calling `usedNonces(bytes32 nonce)`. Returns `1n` when executed.
4. **Real Transaction Hash Retrieval:** When `usedNonces(nonce) > 0n`, Bridgr filters `MessageReceived` event logs on the destination chain matching the exact `nonce`.
   - If log indexing has completed: extracts and presents the real destination transaction hash with block explorer link.
   - If log indexing is pending: displays `verified_onchain_indexing_pending` with an explicit notice, never fabricating fake hashes.

---

## 5. Recovery & Disconnect Resilience

Bridgr implements a crash-resilient state machine (`lib/bridge/stateMachine.ts`):
1. **Immediate Pre-Confirmation Persistence:** As soon as the user confirms the transaction in their wallet and a `burnTxHash` exists, the transfer record is written to `localStorage` under `bridgr-tx-history-mainnet` with stage `BURN_SUBMITTED`.
2. **Crash & Reload Resilience:** If the browser tab is closed or refreshed:
   - State `BURN_SUBMITTED` resumes polling the source RPC for block inclusion receipt.
   - State `BURN_CONFIRMED` or `AWAITING_ATTESTATION` resumes querying Circle Iris API with the existing `burnTxHash`.
   - Under no circumstances does the application reset to `IDLE` or prompt the user to re-burn tokens.
3. **Attestation / Relayer Delays:** If Iris API or the destination relayer takes longer than expected, the transfer transitions to `RECOVERABLE_DELAY`. Transitions to `FAILED_PRE_BURN` are strictly prohibited once a burn transaction is submitted.
4. **Duplicate Claim Protection:** If a user opens the manual claim drawer while Circle auto-relayer is executing, Bridgr checks `usedNonces(nonce)`. If already `> 0n`, manual execution is aborted with an informative message.

---

## 6. Data Integrity & Supabase Security Boundary

### Schema & Policy Hardening (`supabase/migrations/001_bridge_transactions.sql`)
1. **Anonymous Write Restrictions:** Anonymous clients (`anon`) are restricted to inserting and updating records with `verification_status = 'pending_reconciliation'`.
2. **Verified State Protection:** Anonymous clients cannot set `verification_status = 'verified_onchain'`. Upgrading a transaction to verified financial state requires trusted backend reconciliation or `service_role`.
3. **Environment Isolation:** Mainnet analytics queries strictly filter `WHERE environment = 'mainnet'`. Simulated swap records and testnet transactions cannot inflate mainnet volume or counts.
4. **Unresolved Gate:** Production Supabase migration deployment requires authorized database administrator execution. If production credentials are not provided, Bridgr gracefully falls back to local storage isolation.

---

## 7. Multi-Route Canary Budget Matrix

| Route | Recommended Principal | Forwarding Relayer Fee | Source Gas Currency & Cost | Total Minimum Wallet Funding |
| :--- | :--- | :--- | :--- | :--- |
| **Base (`8453`) -> Arc (`5042`)** | `1.00 USDC` | `~0.02 USDC` | `~0.0002 ETH (~$0.50)` | `1.05 USDC` + `0.0005 ETH` |
| **Arbitrum (`42161`) -> Arc (`5042`)** | `1.00 USDC` | `~0.02 USDC` | `~0.0001 ETH (~$0.25)` | `1.05 USDC` + `0.0003 ETH` |
| **Arc (`5042`) -> Base (`8453`)** | `1.00 USDC` | `~0.02 USDC` | `~0.005 USDC` (native gas) | `1.05 USDC` (native Arc) |
| **Arc (`5042`) -> Arbitrum (`42161`)** | `1.00 USDC` | `~0.02 USDC` | `~0.005 USDC` (native gas) | `1.05 USDC` (native Arc) |
| **Arc (`5042`) -> Ethereum L1 (`1`)** | **`5.00 - 10.00 USDC`** | `~1.01 - 1.31 USDC` | `~0.005 USDC` (native gas) | `12.00 USDC` (native Arc) |

> **CRITICAL RULE ON ETHEREUM L1:** Do NOT attempt a canary transfer of `<= 1.00 USDC` to Ethereum L1. Because Ethereum L1 destination minting consumes substantial gas, Circle relayer charges `~1.25 USDC`. A transfer of 1.00 USDC will revert at quote validation with `sendAmount <= totalFeeUnits`.

---

## 8. Remaining Pre-Launch Checklist & Blocker Status

| Item | Status | Action Required Prior to Public Launch |
| :--- | :--- | :--- |
| **Clean Production Build** | **PASSED** | Ready in commit `c94aea4`. |
| **Typecheck & Lint** | **PASSED** | 0 errors across entire workspace. |
| **Unit & Lifecycle Tests** | **PASSED** | 27/27 tests passing. |
| **Live Arc RPC & Contracts** | **PASSED** | Verified on-chain at block `0x1425451`. |
| **Vercel Production Deployment** | **IN PROGRESS** | Triggered via commit `c94aea4` on `main`. |
| **Supabase Migration Deployment** | **PENDING GATE** | Apply `001_bridge_transactions.sql` on production Supabase. |
| **First Live Canary Transaction** | **READY FOR AUTHORIZATION** | Execute Step-by-Step Canary using `docs/CANARY_RUNBOOK.md`. |

*Disclaimer: This report documents technical verification and static test coverage. It does not constitute a formal external smart contract security audit.*
