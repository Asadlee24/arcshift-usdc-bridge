// lib/supabase.ts
// Lightweight HTTP-based client for querying and storing transaction records on Supabase.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (typeof window !== 'undefined') {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️ Supabase environment variables are MISSING! Ensure you redeployed your Vercel project after adding them.');
  } else {
    console.log('✅ Supabase initialized successfully for project URL:', SUPABASE_URL);
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
}

export async function saveTxToSupabase(tx: SupabaseTx): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;

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
        user_address: tx.user_address.toLowerCase(),
        from_chain_id: tx.from_chain_id,
        to_chain_id: tx.to_chain_id,
        amount: tx.amount,
        status: tx.status,
        burn_tx_hash: tx.burn_tx_hash || tx.id,
        mint_tx_hash: tx.mint_tx_hash || null,
        timestamp: tx.timestamp
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.warn('⚠️ Supabase saveTx failed:', response.status, errText);
    } else {
      console.log('✅ Supabase saveTx success');
    }
    return response.ok;
  } catch (e) {
    console.error('Supabase transaction insert failed:', e);
    return false;
  }
}

export async function updateTxInSupabase(id: string, updateData: Partial<SupabaseTx>): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;

  // Format keys from camelCase to snake_case if any passed
  const formattedUpdate: any = {};
  if (updateData.status) formattedUpdate.status = updateData.status;
  if (updateData.mint_tx_hash) formattedUpdate.mint_tx_hash = updateData.mint_tx_hash;
  if (updateData.burn_tx_hash) formattedUpdate.burn_tx_hash = updateData.burn_tx_hash;

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
    
    if (!response.ok) {
      const errText = await response.text();
      console.warn('⚠️ Supabase updateTx failed:', response.status, errText);
    } else {
      console.log('✅ Supabase updateTx success');
    }
    return response.ok;
  } catch (e) {
    console.error('Supabase transaction update failed:', e);
    return false;
  }
}

export async function getTxsFromSupabase(walletAddress: string): Promise<SupabaseTx[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY || !walletAddress) return [];

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/bridge_transactions?user_address=eq.${walletAddress.toLowerCase()}&order=timestamp.desc`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Supabase getTxs loaded rows:', data.length);
      return Array.isArray(data) ? data : [];
    } else {
      const errText = await response.text();
      console.warn('⚠️ Supabase getTxs failed:', response.status, errText);
    }
  } catch (e) {
    console.error('Supabase transactions fetch failed:', e);
  }
  return [];
}

export async function getAllTxsFromSupabase(): Promise<SupabaseTx[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/bridge_transactions?order=timestamp.desc&limit=500`,
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
