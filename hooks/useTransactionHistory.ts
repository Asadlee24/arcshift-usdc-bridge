// hooks/useTransactionHistory.ts
// Robust custom hook for managing bridge transaction history in localStorage and syncing with Supabase in the background

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { saveTxToSupabase, updateTxInSupabase, getTxsFromSupabase } from '../lib/supabase';

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
  isRelayed?: boolean;
}

const LOCAL_STORAGE_KEY = 'bridgr-tx-history';
const EVENT_NAME = 'bridgr-tx-history-updated';

/**
 * Retrieves all transactions from localStorage
 */
export function getTransactionHistory(): BridgeTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
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
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(txs));
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
  if (!userAddress) {
    saveTransactionHistory([]);
    return;
  }
  const txs = getTransactionHistory();
  const updated = txs.filter(tx => tx.userAddress.toLowerCase() !== userAddress.toLowerCase());
  saveTransactionHistory(updated);
}

/**
 * Custom React hook for component consumption
 */
export function useTransactionHistory() {
  const { address } = useAccount();
  const [history, setHistory] = useState<BridgeTransaction[]>([]);

  const loadHistory = useCallback(() => {
    if (!address) {
      setHistory([]);
      return;
    }
    const allTxs = getTransactionHistory();
    const filtered = allTxs.filter(tx => tx.userAddress.toLowerCase() === address.toLowerCase());
    setHistory(filtered);
  }, [address]);

  useEffect(() => {
    loadHistory();

    const handleUpdate = () => {
      loadHistory();
    };

    window.addEventListener(EVENT_NAME, handleUpdate);

    // Background sync from Supabase
    if (address) {
      getTxsFromSupabase(address)
        .then(cloudTxs => {
          if (!cloudTxs || cloudTxs.length === 0) return;

          const localTxs = getTransactionHistory();
          let mergedHasChanged = false;

          // Map local items by ID for O(1) checks
          const localMap = new Map(localTxs.map(t => [t.id, t]));

          cloudTxs.forEach(ctx => {
            const mappedCtx: BridgeTransaction = {
              id: ctx.id,
              timestamp: ctx.timestamp,
              userAddress: ctx.user_address,
              fromChainId: ctx.from_chain_id,
              toChainId: ctx.to_chain_id,
              amount: ctx.amount,
              status: ctx.status,
              burnTxHash: ctx.burn_tx_hash,
              mintTxHash: ctx.mint_tx_hash || undefined
            };

            const existing = localMap.get(ctx.id);
            if (!existing) {
              localMap.set(ctx.id, mappedCtx);
              mergedHasChanged = true;
            } else {
              if (existing.status !== ctx.status || existing.mintTxHash !== ctx.mint_tx_hash) {
                localMap.set(ctx.id, {
                  ...existing,
                  status: ctx.status,
                  mintTxHash: ctx.mint_tx_hash || existing.mintTxHash,
                  burnTxHash: ctx.burn_tx_hash || existing.burnTxHash
                });
                mergedHasChanged = true;
              }
            }
          });

          if (mergedHasChanged) {
            const sortedMerged = Array.from(localMap.values()).sort((a, b) => b.timestamp - a.timestamp);
            saveTransactionHistory(sortedMerged);
          }
        })
        .catch(e => console.warn('Supabase background fetch skipped/failed:', e));
    }

    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
    };
  }, [address, loadHistory]);

  return {
    history,
    clearHistory: () => {
      if (address) {
        clearTransactionHistory(address);
      }
    },
    refresh: loadHistory
  };
}
