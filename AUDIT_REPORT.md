# ArcShift USDC Bridge — Audit Report

**Date:** 2026-08-03
**Scope:** Full codebase pass (app/, components/, constants/, hooks/, lib/, config)

## How to read this report

Every finding below was verified by reading the code at the cited location. Where I could
not verify something (contract addresses against Circle's live registry, runtime behaviour
against a live RPC), I say so explicitly rather than asserting it.

**Remediation pass complete — see the fix-status table below.** The per-issue `Status:` lines in
the body below were written during the audit and say "NOT FIXED"; the table immediately following
supersedes them.

## Fix status

**Fixed (12 of 15)**

| # | Issue | What changed |
|---|-------|--------------|
| 1a | Fake attestation on timeout | `retrieveAttestation` throws `AttestationTimeoutError` (carrying the burn hash) instead of returning `"0x" + "a".repeat(100)`. Also exponential backoff w/ jitter (~5 min ceiling) and explicit 404 / 429 / 4xx handling. |
| 1b | Fabricated tx hashes | All three `Math.random()` hex fallbacks removed. Approve and burn failures now propagate. Mint failure throws a message stating the burn succeeded, funds are recoverable, and quoting the burn hash. |
| 2 | Render loop hammering RPCs | `refetch` memoised in `useUSDCBalance`; `BridgeCard` effect no longer fires on `idle`. |
| 5 | Sepolia default | Marked `isComingSoon`; default source moved to Base Sepolia; `?from=` ignores unsupported chains; `executeBridge` rejects `isComingSoon` routes up front. |
| 6 | Event listener leak | `removeEventListener` now receives the same handler reference that was added. |
| 7 | Attestation polling | Folded into 1a. |
| 9 | Retry bypassed validation | `handleRetry` applies the same gate as submit. |
| 10 | Unreachable Solana branch | Removed the dead `toChain.isSolana` block in the EVM path, plus the now-unused `getSolanaATA` helper and `bs58` import. |
| 12 | Dead component | `AmountInput.tsx` deleted. |
| 13 | `chainId === 5` | Was matching Goerli, not Solana; now keyed off the `isSolana` flag. |
| 15 | Misleading signature | `getMessageTransmitterAddress` no longer accepts an ignored `chainId`. |
| Bug 1A | Minimum amount | New exported `validateBridgeAmount` + `MIN_BRIDGE_AMOUNT` (0.1 USDC). Called by **both** `executeBridge` and the `BridgeCard` form, so UI and on-chain guard cannot diverge. The old UI floor of 0.01 USDC sat below the CCTP fee threshold, so amounts the form accepted reverted on-chain. |
| Bug 1B | Solana provider shape | `assertValidSolanaProvider` checks `publicKey`, `isConnected` and the signing methods before the SDK's Zod validation runs, and is invoked at both adapter creation sites. |

**Still open (3 of 15)**

- **Issue 8** (mid-bridge reload recovery) — needs a resume UI; a feature, not a fix.
- **Issue 11** (console gating) — cosmetic.
- **Issue 14** (swap credits balances in localStorage) — same class of product decision as Issue 1.

**Still unverified**

- CCTP contract addresses and domain IDs for the 20 non-Arc chains were **never** checked against
  Circle's live registry (no network access). Internally consistent is not correct.
- `MIN_BRIDGE_AMOUNT = 0.1` is derived from the `maxFee = max(amount/100, 1000)` formula, not from
  a documented protocol constant. Confirm against Circle's docs before launch.

### Verification limits

- **Contract addresses / CCTP domain IDs for the 20 non-Arc chains: NOT independently verified.**
  I have no network access in this session, so I could not check them against Circle's
  published CCTP V2 registry. They are internally consistent (no duplicate domains), but
  "internally consistent" is not "correct." These need a live check before launch.
- **Arc Testnet config: verified against the spec you supplied** — chain ID `5042002`,
  RPC `rpc.testnet.arc.network`, USDC `0x3600...0000`, TokenMessengerV2
  `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`. All four match the code. The
  TokenMessenger address in code is lowercased (`useBridge.ts:645`); EVM addresses are
  case-insensitive and viem accepts it, so this is cosmetic, not a bug.
- **Runtime behaviour of the Circle SDK's Solana adapter: NOT verified.** `node_modules` was
  not inspected, so the exact Zod shape `createSolanaAdapterFromProvider` requires is
  inferred from the calling code and the symptom you reported, not read from the SDK source.

---

## CRITICAL

### Issue 1: Bridge fabricates success when transactions fail
- **Location:** `hooks/useBridge.ts` — four sites: L192-198, L757-760, L803-806, L898-901
- **Root cause:** Each failure path is caught and replaced with invented data instead of
  propagating the error.
  - L192-198 `retrieveAttestation`: on polling timeout, returns a hardcoded fake attestation
    (`"0x" + "a".repeat(100)` / `"b".repeat(130)`) with `status: "complete"`.
  - L757-760: approval failure → `approveHash` set to a random 64-char hex string.
  - L803-806: `depositForBurn` failure → `burnHash` set to a random hex string.
  - L898-901: `receiveMessage` (mint) failure → `mintHash` set to a random hex string.
- **Observable result:** every step renders `status: 'done'` with a green check, `setStatus('success')`
  fires, `SuccessView` renders, and `updateTransaction(..., { status: 'success' })` writes a
  success record to localStorage **and to Supabase**. Explorer links are built from the
  fabricated hashes and point to transactions that do not exist.
- **Why this outranks the bugs on the brief:** it is the mechanism hiding them. A `depositForBurn`
  that reverts because the amount is under the CCTP fee threshold — your Bug 1A — is swallowed
  at L803 and repainted as success. Fixing Bug 1A while this stays is pointless; the failure it
  is meant to prevent is already invisible.
- **Risk if unfixed:** users are told their USDC moved when it did not. On a live deployment this
  is the most damaging class of bug a bridge can have. The Supabase records mean the bad data
  outlives the browser session and corrupts any analytics built on it.
- **Status:** NOT FIXED — needs your decision. This code is deliberate (the comments say
  "for presentation flow" / "for smooth demo experience"), so removing it changes product
  behaviour and I will not do it unilaterally. See the question at the end of this report.

---

## HIGH

### Issue 2: Render loop hammering RPC endpoints
- **Location:** `components/bridge/BridgeCard.tsx` L472-480 combined with `hooks/useUSDCBalance.ts` L226-260
- **Root cause:** `useUSDCBalance` returns `refetch` as a plain arrow function, recreated on
  every render (never memoised). `BridgeCard`'s effect lists `refetchFromBalance` and
  `refetchToBalance` in its dependency array, so the dependencies change identity on every
  render. The effect body calls both refetch functions when `status === 'idle'` — which is the
  default state. Each refetch calls `setManualBalance`, which triggers a re-render, which
  changes the deps again, which re-runs the effect.
- **Observable result:** while the page sits idle on the default view, it issues `eth_call`
  balance requests in a continuous loop against two chains' RPCs, plus `refetchEVM()` through
  wagmi. Two `setInterval(..., 15000)` pollers in the same hook are layered on top of this.
- **Risk if unfixed:** public RPC rate-limiting and IP bans (several configured endpoints are
  free public nodes), wasted battery/CPU on the client, and balance flicker. Also makes any
  real latency issue impossible to diagnose.
- **Status:** NOT FIXED — safe to fix without a product decision (`useCallback` the refetch
  functions, narrow the effect deps). Queued.

### Issue 3: Solana provider assembled from three sources with no shape validation (Bug 1B)
- **Location:** `hooks/useBridge.ts` L34-101 `buildSolanaProviderAdapter`, called at L423, passed to
  `createSolanaAdapterFromProvider` at L428 and L452
- **Root cause:** the function spreads a raw provider (`solanaWallet.wallet.adapter`, or
  `window.solana`, or the wagmi-style wallet object itself — whichever is first non-null at L38)
  and then overlays hand-rolled `signTransaction` / `signAllTransactions` / `signMessage` /
  `connect` / `disconnect` wrappers. Three different objects with three different contracts get
  merged into one shape that matches none of them exactly.
  - The `isConnected` coercion at L41-51 **is** correctly wrapped in `Boolean()`, so it always
    yields a primitive. My earlier draft of this report claimed otherwise; that was wrong.
  - The real gap: `publicKey` at L53 can legitimately end up `null`, and the object is handed to
    the SDK anyway. There is no assertion that the assembled object satisfies the adapter's
    contract before the call.
  - `connect`/`disconnect` silently resolve to `Promise.resolve()` when no underlying method
    exists (L80, L87), so a wallet that cannot connect looks like one that connected fine.
- **Observable result:** when the shape is wrong the SDK's Zod validation rejects it inside
  `createSolanaAdapterFromProvider`, and the resulting error surfaces only as whatever generic
  message the SDK produces — matching the "silently hanging or failing generic" symptom you
  described.
- **Status:** NOT FIXED — safe to fix without a product decision. Plan: validate the assembled
  object against an explicit contract before the SDK call and throw a descriptive error naming
  the missing capability, per your "fail loudly" requirement. Queued.

### Issue 4: No minimum-amount check before submitting the burn (Bug 1A)
- **Location:** validation lives only in `components/bridge/BridgeCard.tsx` L483-506; `hooks/useBridge.ts`
  has no amount validation at any point before `depositForBurn` (L777)
- **Root cause:** two separate problems.
  1. The UI's floor is `entered < 0.01` (L496). The `maxFee` actually sent to the contract is
     `max(amount / 100, 1000)` base units (L691) — i.e. 1% of the amount, floored at 0.001 USDC.
     For small amounts the fee consumes most or all of the transfer, and CCTP rejects it.
  2. `executeBridge` accepts whatever string it is handed. `handleBridgeSubmit` (L536) does gate
     on `amountError`, but `handleRetry` (L541) calls `executeBridge` with **no validation at all** —
     so retry can resubmit an amount the form already rejected.
- **Risk if unfixed:** reverted burns, wasted gas, and — with Issue 1 in place — the revert is
  invisible, so the user retries the same doomed amount.
- **Status:** NOT FIXED. The *mechanism* (validate in the hook, gate retry, surface a warning) is
  safe to implement. The *threshold value* is a product decision I need from you — see question.

### Issue 5: Ethereum Sepolia is offered as a source chain and is the default
- **Location:** `constants/chains.ts` L38-50; `components/bridge/BridgeCard.tsx` L40 sets it as the
  initial `fromChain`; `lib/wagmi.ts` L61 registers it
- **Root cause:** per your brief, Circle's CCTP infrastructure does not support
  `eip155:11155111`. The chain is nonetheless configured with `cctpDomain: 0` and no
  `isComingSoon` flag, so it appears in `getActiveSourceChains()` and is preselected on load.
  (I am taking the unsupported status from your brief — I could not verify it against Circle's
  registry offline.)
- **Observable result:** the default landing state of the app is a route that cannot succeed.
- **Risk if unfixed:** the most common first interaction fails. Currently masked by Issue 1.
- **Status:** NOT FIXED. Your brief already decided Sepolia is not supported, so flagging it is
  in scope — but it is the default chain, so removing it means picking a new default. Queued;
  I will default to Base Sepolia unless you say otherwise.

---

## MEDIUM

### Issue 6: Event listener never removed in useUSDCBalance
- **Location:** `hooks/useUSDCBalance.ts` L105-108
- **Root cause:** `addEventListener('bridge-success-refresh', () => refetch())` and
  `removeEventListener('bridge-success-refresh', () => refetch())` are passed two *different*
  freshly-created arrow functions. `removeEventListener` matches by reference, so it removes
  nothing.
- **Observable result:** a new listener accumulates on every dependency change
  (`address`, `publicKey`, `chainId`). Each one fires on every `bridge-success-refresh` event,
  multiplying balance fetches. The hook is instantiated twice per `BridgeCard` (from and to).
- **Status:** NOT FIXED — safe fix (hoist the handler to a named reference). Queued.

### Issue 7: Attestation polling has no backoff and a fixed 60s ceiling
- **Location:** `hooks/useBridge.ts` L171-199
- **Root cause:** 12 attempts × flat 5s sleep. No exponential backoff, no jitter, no
  `Retry-After` handling. A non-OK HTTP response is indistinguishable from a pending
  attestation — both just fall through to the next attempt, so a 4xx (bad domain, malformed
  hash) burns the full 60 seconds before giving up.
- **Note:** the 60s ceiling is only the *second* problem here. The first is what happens on
  timeout (Issue 1).
- **Status:** NOT FIXED — safe to fix (backoff + distinguish HTTP error classes). The
  timeout *outcome* is gated on the Issue 1 decision. Queued.

### Issue 8: No recovery path if the page reloads mid-bridge
- **Location:** `hooks/useBridge.ts` — all state is component-local; `hooks/useTransactionHistory.ts`
  persists records but nothing reads them back to resume a flow
- **Root cause:** a burn can be confirmed on-chain and the attestation still pending. That window
  is 15s-2min. A reload during it leaves a `status: 'pending'` record in localStorage/Supabase
  with a real `burnTxHash`, and no UI path to fetch the attestation and complete the mint.
- **Risk if unfixed:** user's USDC is burned on the source chain with the mint never claimed.
  This is real fund loss, not cosmetic — though it requires the reload to happen in the window.
- **Status:** NOT FIXED. Building a resume flow is a feature, not a bug fix, and touches product
  surface (new UI). Flagging for your call rather than inventing it.

### Issue 9: Retry bypasses validation
- **Location:** `components/bridge/BridgeCard.tsx` L541-544
- **Root cause:** `handleRetry` calls `executeBridge` directly with no `amountError` /
  empty / `<= 0` guard, unlike `handleBridgeSubmit` at L536.
- **Status:** NOT FIXED — safe fix. Folded into Issue 4's fix. Queued.

### Issue 10: Unreachable Solana branch in the EVM code path
- **Location:** `hooks/useBridge.ts` L677-685
- **Root cause:** `isSolanaRoute` (L352) returns early at L585 for any route touching Solana.
  The `if (toChain.isSolana)` block at L677, which derives the destination ATA and packs it into
  `destinationAddressBytes32`, can therefore never execute. `getSolanaATA` (L21-31) is only
  reachable from this dead branch.
- **Risk if unfixed:** misleading — it reads as though EVM→Solana is handled inline when it is
  not. Someone will maintain it believing it runs.
- **Status:** NOT FIXED — safe cleanup. Queued.

---

## LOW

### Issue 11: 38 unconditional console statements
- **Location:** 38 matches across `lib/supabase.ts`, `hooks/useUSDCBalance.ts`,
  `hooks/useTransactionHistory.ts`, `hooks/useBridge.ts`, `hooks/useArcAdapter.ts`
- **Root cause:** debug logging left unguarded. `lib/supabase.ts:11` logs the Supabase project
  URL to the console on every page load. That URL is a `NEXT_PUBLIC_` value and therefore already
  public in the bundle, so this is noise rather than a leak — but it is still noise in production.
- **Note:** most of the `console.warn`/`console.error` calls are legitimate error reporting. The
  fix is to gate the informational `console.log` calls, not to strip everything.
- **Status:** NOT FIXED. Low priority. Queued behind the rest.

### Issue 12: Dead component — AmountInput.tsx
- **Location:** `components/bridge/AmountInput.tsx` (112 lines)
- **Root cause:** never imported anywhere. `BridgeCard` has its own inline amount input
  (L676-685). The orphaned component uses a 2-decimal regex while the live input uses 6
  (L520) — so the dead code also disagrees with the live code about USDC precision.
- **Correction to my earlier draft:** I initially cited this file's regex as a live input-validation
  weakness. It is not live. Withdrawn.
- **Status:** NOT FIXED — safe deletion. Queued.

### Issue 13: `chainId === 5` used as a Solana check
- **Location:** `hooks/useUSDCBalance.ts` L98
- **Root cause:** `chainMeta?.isSolana || chainId === 5`. Solana's entry uses `id: 0`
  (`constants/chains.ts` L318); `5` is its `cctpDomain`. Chain ID 5 is Ethereum Goerli. The
  fallback conflates a CCTP domain with an EVM chain ID.
- **Impact:** none today (Goerli is not configured), so this is latent, not active.
- **Status:** NOT FIXED — safe cleanup. Queued.

### Issue 14: Swap tab settles balances in localStorage, not on-chain
- **Location:** `components/bridge/BridgeCard.tsx` L294-407
- **Root cause:** the swap performs a real ERC-20 `transfer` of the sell token into
  `FX_ESCROW_ADDRESS` (L319-333), then fabricates a destination hash (L355) and credits the buy
  token by writing an offset to `localStorage` under `arc_credit_<SYMBOL>_<address>` (L383-385).
  `useUSDCBalance` L210-213 adds that offset to the displayed balance.
- **Observable result:** the sell token really leaves the wallet. The buy token is never minted or
  transferred — the "received" balance exists only in that browser's localStorage and vanishes on
  cache clear or device change. The history record is written with `status: 'success'`.
- **Note:** this is a separate subsystem from the bridge, outside the CCTP scope you described,
  which is why I have it as Low rather than Critical — but the pattern is the same as Issue 1 and
  the user-facing consequence (real tokens out, fake credit in) is arguably worse.
- **Status:** NOT FIXED — same class of product decision as Issue 1. Needs your call.

### Issue 15: `getMessageTransmitterAddress` ignores its argument
- **Location:** `hooks/useBridge.ts` L200-204
- **Root cause:** takes `chainId: number`, never reads it, returns one hardcoded address for
  every chain. The comment describes it as "deployed by Arc Network across all supported
  testnets."
- **Assessment:** CCTP V2 does use deterministic addressing, so a single address across EVM
  testnets is plausible and this may well be functionally correct. **I could not verify the
  address offline.** The defect I am confident about is the signature — a parameter that is
  accepted and ignored invites a future caller to assume per-chain dispatch that does not exist.
- **Status:** NOT FIXED — signature cleanup is safe; address verification needs a live check.

---

## Audit-scope items that came back clean

- **Devnet/mainnet confusion:** no Solana mainnet endpoint anywhere. The only `mainnet` matches
  are three copy strings in `CircleOnRampModal.tsx` describing an unreleased feature. Solana is
  consistently `api.devnet.solana.com` with the devnet USDC mint, and explorer links carry
  `?cluster=devnet`. Clean.
- **TODO/FIXME/HACK comments:** zero matches across the codebase.
- **Hardcoded secrets:** none found. Supabase uses `NEXT_PUBLIC_` env vars with empty-string
  fallbacks and no-ops when unset (`lib/supabase.ts` L28, L66, L99). No private keys, no
  mnemonics, no signing material. The WalletConnect project ID at `lib/wagmi.ts` L43 has a
  hardcoded fallback, but a WC project ID is not a secret.
- **Unvalidated contract addresses from user input:** none. All addresses come from the
  `SUPPORTED_CHAINS` constant or hardcoded values; no address is ever read from user input.
- **x402 stub:** my earlier draft called this dead code to be deleted. **Wrong** — `next.config.ts`
  aliases seven `@x402/*` specifiers to it for both Turbopack and webpack. Deleting it breaks
  the build. Withdrawn.

---

## Severity summary

| Severity | Count | Issues |
|----------|-------|--------|
| Critical | 1 | 1 |
| High | 4 | 2, 3, 4, 5 |
| Medium | 5 | 6, 7, 8, 9, 10 |
| Low | 5 | 11, 12, 13, 14, 15 |

**Total: 15 verified findings.** 3 need a product decision from you (1, 8, 14). The other 12
are safe to fix without changing intended behaviour.

---

## Blocking question

Issue 1 gates the value of most of the rest. Fixing minimum-amount validation, attestation
backoff, or the Solana provider shape while every failure is still repainted as success gets you
correctness you cannot observe. I need your decision on the four fabrication sites before the
`useBridge.ts` rewrite has a defined target.
