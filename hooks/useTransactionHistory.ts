// hooks/useTransactionHistory.ts
// Robust custom hook for managing bridge transaction history in localStorage and syncing with Supabase in the background
// Isolates mainnet and testnet history, quarantines simulated swap strings, and records nonces.

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { saveTxToSupabase, updateTxInSupabase, getTxsFromSupabase } from '../lib/supabase';
import { getActiveEnvironment } from '../lib/registry';

export interface BridgeTransaction {
  id: string; // Typically the burn transaction hash
  timestamp: number;
  userAddress: string;
  fromChainId: number;
  toChainId: number;
  amount: string;
  status: 'pending' | 'success' | 'failed';
  burnTxHash?: string;
  mintTxHash?: string;
  nonce?: string;
  isRelayed?: boolean;
  environment?: 'mainnet' | 'testnet';
  errorReason?: string;
  verificationStatus?: 'pending_reconciliation' | 'verified_onchain' | 'failed' | 'indexing_pending';
}

function getStorageKey(): string {
  const env = getActiveEnvironment();
  return env === 'mainnet' ? 'bridgr-tx-history-mainnet' : 'bridgr-tx-history-testnet';
}

const EVENT_NAME = 'bridgr-tx-history-updated';

/**
 * Retrieves all valid bridge transactions from localStorage, filtering out legacy simulated swaps.
 */
export function getTransactionHistory(): BridgeTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getStorageKey();
    const data = localStorage.getItem(key);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    // Quarantine legacy simulated swap entries
    return parsed.filter((tx: BridgeTransaction) => {
      if (typeof tx.amount === 'string' && tx.amount.includes('→')) {
        return false;
      }
      return true;
    });
  } catch (e) {
    console.error('Error reading transaction history from localStorage:', e);
    return [];
  }
}

/**
 * Saves transaction history list to localStorage and triggers reactive update event
 */
export function saveTransactionHistory(txs: BridgeTransaction[]) {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify(txs));
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch (e) {
    console.error('Error saving transaction history to localStorage:', e);
  }
}

/**
 * Inserts a new transaction into history
 */
export function addTransaction(tx: Omit<BridgeTransaction, 'timestamp'>) {
  const txs = getTransactionHistory();
  // Avoid duplicate registrations
  if (txs.some(t => t.id === tx.id)) {
    return;
  }
  const newTx: BridgeTransaction = {
    ...tx,
    environment: getActiveEnvironment(),
    timestamp: Date.now()
  };
  const updated = [newTx, ...txs];
  saveTransactionHistory(updated);

  // Sync to Supabase in background
  saveTxToSupabase({
    id: newTx.id,
    user_address: newTx.userAddress,
    from_chain_id: newTx.fromChainId,
    to_chain_id: newTx.toChainId,
    amount: newTx.amount,
    status: newTx.status,
    burn_tx_hash: newTx.burnTxHash || newTx.id,
    mint_tx_hash: newTx.mintTxHash,
    timestamp: newTx.timestamp
  }).catch(e => console.warn('Supabase sync-insert deferred/skipped:', e));
}

/**
 * Updates properties of an existing transaction
 */
export function updateTransaction(
  id: string,
  updates: Partial<Omit<BridgeTransaction, 'id' | 'timestamp' | 'userAddress'>>
) {
  const txs = getTransactionHistory();
  const updated = txs.map(tx => {
    if (tx.id === id) {
      return { ...tx, ...updates };
    }
    return tx;
  });
  saveTransactionHistory(updated);

  // Sync to Supabase in background
  const supabaseUpdates: any = {};
  if (updates.status) supabaseUpdates.status = updates.status;
  if (updates.mintTxHash) supabaseUpdates.mint_tx_hash = updates.mintTxHash;
  if (updates.burnTxHash) supabaseUpdates.burn_tx_hash = updates.burnTxHash;

  updateTxInSupabase(id, supabaseUpdates)
    .catch(e => console.warn('Supabase sync-update deferred/skipped:', e));
}

/**
 * Clears transaction history for a specific wallet address
 */
export function clearTransactionHistory(userAddress?: string) {
  if (typeof window === 'undefined') return;
  if (!userAddress) {
    saveTransactionHistory([]);
    return;
  }
  const txs = getTransactionHistory();
  const filtered = txs.filter(t => t.userAddress.toLowerCase() !== userAddress.toLowerCase());
  saveTransactionHistory(filtered);
}

/**
 * React hook to listen to transaction updates and auto-sync with Supabase
 */
export function useTransactionHistory() {
  const { address } = useAccount();
  const [history, setHistory] = useState<BridgeTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    // Load local history first for immediate render
    const localTxs = getTransactionHistory();
    const filteredLocal = address
      ? localTxs.filter(t => t.userAddress.toLowerCase() === address.toLowerCase())
      : localTxs;

    setHistory(filteredLocal);
    setIsLoading(false);

    // Reconcile with Supabase in background
    if (address) {
      try {
        const cloudTxs = await getTxsFromSupabase(address);
        if (cloudTxs && cloudTxs.length > 0) {
          const currentLocal = getTransactionHistory();
          let changed = false;
          const merged = [...currentLocal];

          cloudTxs.forEach(ctx => {
            const existingIndex = merged.findIndex(m => m.id === ctx.id);
            if (existingIndex === -1) {
              merged.push({
                id: ctx.id,
                timestamp: ctx.timestamp,
                userAddress: ctx.user_address,
                fromChainId: ctx.from_chain_id,
                toChainId: ctx.to_chain_id,
                amount: ctx.amount,
                status: ctx.status,
                burnTxHash: ctx.burn_tx_hash || ctx.id,
                mintTxHash: ctx.mint_tx_hash || undefined
              });
              changed = true;
            } else {
              const existing = merged[existingIndex];
              if (existing.status !== ctx.status || existing.mintTxHash !== ctx.mint_tx_hash) {
                merged[existingIndex] = {
                  ...existing,
                  status: ctx.status,
                  mintTxHash: ctx.mint_tx_hash || existing.mintTxHash,
                };
                changed = true;
              }
            }
          });

          if (changed) {
            saveTransactionHistory(merged);
            const refiltered = merged.filter(t => t.userAddress.toLowerCase() === address.toLowerCase());
            setHistory(refiltered);
          }
        }
      } catch (err) {
        console.warn('Background Supabase reconciliation skipped:', err);
      }
    }
  }, [address]);

  useEffect(() => {
    loadHistory();

    const handleUpdate = () => {
      const localTxs = getTransactionHistory();
      const filtered = address
        ? localTxs.filter(t => t.userAddress.toLowerCase() === address.toLowerCase())
        : localTxs;
      setHistory(filtered);
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
    };
  }, [address, loadHistory]);

  const clear = useCallback(() => {
    clearTransactionHistory(address);
  }, [address]);

  return {
    history,
    isLoading,
    clearHistory: clear,
    refreshHistory: loadHistory
  };
}
