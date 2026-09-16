-- supabase/migrations/001_bridge_transactions.sql
-- Production schema and Row-Level Security (RLS) policies for Bridgr CCTP v2 transactions.

CREATE TABLE IF NOT EXISTS public.bridge_transactions (
    id TEXT PRIMARY KEY,                             -- Burn transaction hash (unique)
    user_address TEXT NOT NULL,                     -- Normalized sender wallet address
    from_chain_id INTEGER NOT NULL,                 -- Source chain ID
    to_chain_id INTEGER NOT NULL,                   -- Destination chain ID
    amount TEXT NOT NULL,                           -- USDC amount bridged (formatted decimal string)
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    burn_tx_hash TEXT,                              -- Source chain burn transaction hash
    mint_tx_hash TEXT,                              -- Destination chain mint transaction hash
    timestamp BIGINT NOT NULL,                      -- Unix epoch milliseconds
    environment TEXT NOT NULL DEFAULT 'mainnet' CHECK (environment IN ('mainnet', 'testnet')),
    verification_status TEXT NOT NULL DEFAULT 'pending_reconciliation' CHECK (verification_status IN ('pending_reconciliation', 'verified_onchain', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for efficient analytics, user history queries, and verification jobs
CREATE INDEX IF NOT EXISTS idx_bridge_tx_env_timestamp ON public.bridge_transactions (environment, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bridge_tx_user_env ON public.bridge_transactions (user_address, environment);
CREATE INDEX IF NOT EXISTS idx_bridge_tx_status ON public.bridge_transactions (environment, status);
CREATE INDEX IF NOT EXISTS idx_bridge_tx_burn_hash ON public.bridge_transactions (burn_tx_hash);

-- Enable Row Level Security
ALTER TABLE public.bridge_transactions ENABLE ROW LEVEL SECURITY;

-- 1. Read Policy: Allow public read access to transaction records for explorer and analytics
CREATE POLICY "Public read access for bridge transactions"
    ON public.bridge_transactions
    FOR SELECT
    USING (true);

-- 2. Insert Policy: Allow client apps to insert new pending bridge transaction records
CREATE POLICY "Public insert access for new bridge records"
    ON public.bridge_transactions
    FOR INSERT
    WITH CHECK (
        length(id) > 10
        AND length(user_address) >= 32
        AND length(amount) <= 32
        AND verification_status IN ('pending_reconciliation', 'verified_onchain')
    );

-- 3. Update Policy: Allow updating transaction status and destination mint hash
CREATE POLICY "Public update access for transaction finalization"
    ON public.bridge_transactions
    FOR UPDATE
    USING (true)
    WITH CHECK (
        length(id) > 10
    );
