CREATE TABLE IF NOT EXISTS asset_code_sequences (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL,
  number_width INTEGER NOT NULL CHECK (number_width BETWEEN 1 AND 18),
  last_number BIGINT NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);
