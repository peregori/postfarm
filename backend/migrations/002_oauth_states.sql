-- OAuth state storage for PKCE and CSRF protection
-- Migration: 002_oauth_states.sql

CREATE TABLE IF NOT EXISTS oauth_states (
  state VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  code_verifier VARCHAR(128) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '10 minutes'
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON oauth_states(user_id);

-- Comment on table
COMMENT ON TABLE oauth_states IS 'Stores OAuth state parameters with PKCE code verifiers for secure OAuth 2.0 flows';
COMMENT ON COLUMN oauth_states.state IS 'Random state parameter for CSRF protection (primary key)';
COMMENT ON COLUMN oauth_states.code_verifier IS 'PKCE code verifier for Twitter OAuth 2.0';
COMMENT ON COLUMN oauth_states.expires_at IS 'State expiration time (default 10 minutes from creation)';
