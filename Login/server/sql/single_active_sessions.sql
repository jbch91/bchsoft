ALTER TABLE refresh_tokens
ADD COLUMN IF NOT EXISTS session_id UUID;

ALTER TABLE refresh_tokens
ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ;

UPDATE refresh_tokens
SET session_id = id
WHERE session_id IS NULL;

ALTER TABLE refresh_tokens
ALTER COLUMN session_id SET DEFAULT uuid_generate_v4();

ALTER TABLE refresh_tokens
ALTER COLUMN session_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_id
ON refresh_tokens(user_id, session_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active_session
ON refresh_tokens(user_id, session_id)
WHERE revoked_at IS NULL AND replaced_at IS NULL;
