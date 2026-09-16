// lib/supabase.ts
// Lightweight HTTP-based client for querying and storing transaction records on Supabase
// with strict environment isolation, verification status, and case-sensitive address handling.

import { getActiveEnvironment } from './registry/index.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (typeof window !== 'undefined') {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️ Supabase environment variables are missing. Transaction analytics will run in local-only mode.');
  }
}

export interface SupabaseTx {
  id: string; // burn transaction hash
  user_address: string;
  from_chain_id: number;
  to_chain_id: number;
  amount: string;
  status: 'pending' | 'success' | 'failed';
  burn_tx_hash?: string;
  mint_tx_hash?: string;
  timestamp: number;
  environment?: 'mainnet' | 'testnet';
  verification_status?: 'pending_reconciliation' | 'verified_onchain' | 'failed';
}

/**
 * Normalizes user address: lowercase for 0x EVM hex addresses;
 * preserves exact casing for Solana base58 addresses.
 */
export function normalizeWalletAddress(address: string): string {
  if (!address) return '';
  const trimmed = address.trim();
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    return trimmed.toLowerCase();
  }
  // Base58 Solana address is case-sensitive
  return trimmed;
}

export async function saveTxToSupabase(tx: SupabaseTx): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;

  const env = tx.environment || getActiveEnvironment();
  const normalizedAddress = normalizeWalletAddress(tx.user_address);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/bridge_transactions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates' // Upsert
      },
      body: JSON.stringify({
        id: tx.id,
        user_address: normalizedAddress,
        from_chain_id: tx.from_chain_id,
        to_chain_id: tx.to_chain_id,
        amount: tx.amount,
        status: tx.status,
        burn_tx_hash: tx.burn_tx_hash || tx.id,
        mint_tx_hash: tx.mint_tx_hash || null,
        timestamp: tx.timestamp,
        environment: env,
        verification_status: tx.verification_status || 'pending_reconciliation'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('⚠️ Supabase saveTx failed:', response.status, errText);
    }
    return response.ok;
  } catch (e) {
    console.error('Supabase transaction insert failed:', e);
    return false;
  }
}

export async function updateTxInSupabase(id: string, updateData: Partial<SupabaseTx>): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;

  const formattedUpdate: Record<string, unknown> = {};
  if (updateData.status) formattedUpdate.status = updateData.status;
  if (updateData.mint_tx_hash) formattedUpdate.mint_tx_hash = updateData.mint_tx_hash;
  if (updateData.burn_tx_hash) formattedUpdate.burn_tx_hash = updateData.burn_tx_hash;
  if (updateData.verification_status) formattedUpdate.verification_status = updateData.verification_status;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/bridge_transactions?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formattedUpdate)
    });

    return response.ok;
  } catch (e) {
    console.error('Supabase transaction update failed:', e);
    return false;
  }
}

export async function getTxsFromSupabase(walletAddress: string, env?: 'mainnet' | 'testnet'): Promise<SupabaseTx[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY || !walletAddress) return [];

  const targetEnv = env || getActiveEnvironment();
  const normalized = normalizeWalletAddress(walletAddress);

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/bridge_transactions?user_address=eq.${normalized}&environment=eq.${targetEnv}&order=timestamp.desc`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
  } catch (e) {
    console.error('Supabase transactions fetch failed:', e);
  }
  return [];
}

export async function getAllTxsFromSupabase(env?: 'mainnet' | 'testnet'): Promise<SupabaseTx[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];

  const targetEnv = env || getActiveEnvironment();

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/bridge_transactions?environment=eq.${targetEnv}&order=timestamp.desc&limit=500`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
  } catch (e) {
    console.error('Supabase getAllTxs failed:', e);
  }
  return [];
}
