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

-- 2. Insert Policy: Anonymous clients can only insert unverified 'pending_reconciliation' records
-- Client-submitted records are strictly treated as unverified hints until reconciled on-chain.
CREATE POLICY "Anon insert access for pending bridge records"
    ON public.bridge_transactions
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        length(id) > 10
        AND length(user_address) >= 32
        AND length(amount) <= 32
        AND status = 'pending'
        AND verification_status = 'pending_reconciliation'
    );

-- 3. Update Policy: Anonymous clients cannot overwrite verified financial records or self-certify
-- Clients may submit client-observed transaction hashes, but verification_status remains protected.
CREATE POLICY "Anon update access restricted to unverified records"
    ON public.bridge_transactions
    FOR UPDATE
    TO anon, authenticated
    USING (
        -- Only permit client updates on records that have NOT yet been authoritatively verified
        verification_status = 'pending_reconciliation'
    )
    WITH CHECK (
        length(id) > 10
        -- Anonymous clients are strictly forbidden from setting verification_status to 'verified_onchain'
        AND verification_status = 'pending_reconciliation'
    );

-- 4. Service Role Policy: Only backend indexer / reconciler using service_role can verify records
CREATE POLICY "Service role full reconciliation access"
    ON public.bridge_transactions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
