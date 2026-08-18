DO $$
DECLARE
  client_schema RECORD;
BEGIN
  FOR client_schema IN
    SELECT schema_name
    FROM clients
    WHERE schema_name ~ '^[a-zA-Z0-9_]+$'
  LOOP
    IF to_regclass(format('%I.%I', client_schema.schema_name, 'assets')) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS requires_sanitary_classification BOOLEAN NOT NULL DEFAULT FALSE',
      client_schema.schema_name
    );
    EXECUTE format(
      'ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS requires_electrical_classification BOOLEAN NOT NULL DEFAULT FALSE',
      client_schema.schema_name
    );
    EXECUTE format(
      'ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS electrical_protection_class TEXT',
      client_schema.schema_name
    );
    EXECUTE format(
      'ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS applied_part_type TEXT',
      client_schema.schema_name
    );

    EXECUTE format($backfill$
      UPDATE %I.assets
      SET requires_sanitary_classification = TRUE
      WHERE NULLIF(BTRIM(risk_class), '') IS NOT NULL
        AND requires_sanitary_classification = FALSE
    $backfill$, client_schema.schema_name);
  END LOOP;
END $$;
