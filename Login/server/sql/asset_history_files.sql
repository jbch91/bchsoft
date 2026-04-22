DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT schema_name FROM clients LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.asset_history_files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        asset_id UUID REFERENCES %I.assets(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Mantenimiento histórico migrado',
        description TEXT,
        document_date DATE NOT NULL,
        file_path TEXT NOT NULL,
        uploaded_by UUID,
        uploaded_by_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    $f$, s.schema_name, s.schema_name);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.asset_history_files (asset_id, document_date ASC, created_at ASC)',
      'idx_asset_history_files_asset_date',
      s.schema_name
    );
  END LOOP;
END $$;
