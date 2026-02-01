-- User Secrets table for storing OAuth tokens and API keys
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_secrets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    secret_type TEXT NOT NULL,
    secret_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint for upsert operations
    UNIQUE(user_id, secret_type)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_secrets_user_id ON user_secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_secrets_type ON user_secrets(secret_type);

-- Enable Row Level Security
ALTER TABLE user_secrets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own secrets
CREATE POLICY "Users can manage own secrets" ON user_secrets
    FOR ALL
    USING (auth.uid()::text = user_id OR auth.role() = 'service_role')
    WITH CHECK (auth.uid()::text = user_id OR auth.role() = 'service_role');

-- Allow service role full access (for backend operations)
CREATE POLICY "Service role full access" ON user_secrets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
