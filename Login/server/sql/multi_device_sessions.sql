ALTER TABLE refresh_tokens
ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ;

ALTER TABLE refresh_tokens
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

ALTER TABLE refresh_tokens
ADD COLUMN IF NOT EXISTS user_agent TEXT;

ALTER TABLE refresh_tokens
ADD COLUMN IF NOT EXISTS ip_address TEXT;

UPDATE refresh_tokens
SET session_started_at = COALESCE(session_started_at, created_at),
    last_seen_at = COALESCE(last_seen_at, created_at)
WHERE session_started_at IS NULL
   OR last_seen_at IS NULL;

ALTER TABLE refresh_tokens
ALTER COLUMN session_started_at SET DEFAULT NOW();

ALTER TABLE refresh_tokens
ALTER COLUMN session_started_at SET NOT NULL;

ALTER TABLE refresh_tokens
ALTER COLUMN last_seen_at SET DEFAULT NOW();

ALTER TABLE refresh_tokens
ALTER COLUMN last_seen_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active_last_seen
ON refresh_tokens(user_id, last_seen_at DESC)
WHERE revoked_at IS NULL AND replaced_at IS NULL;
