ALTER TABLE maintenance_schedule_items
  ADD COLUMN IF NOT EXISTS historical_resolution TEXT,
  ADD COLUMN IF NOT EXISTS non_execution_reason TEXT,
  ADD COLUMN IF NOT EXISTS non_execution_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS non_execution_recorded_by UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE maintenance_schedule_items
SET historical_resolution = 'evidence_uploaded'
WHERE completion_source = 'historical_pdf'
  AND historical_resolution IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'maintenance_items_historical_resolution_check'
      AND conrelid = 'maintenance_schedule_items'::regclass
  ) THEN
    ALTER TABLE maintenance_schedule_items
      ADD CONSTRAINT maintenance_items_historical_resolution_check
      CHECK (
        historical_resolution IS NULL
        OR historical_resolution IN ('pending_evidence', 'not_performed', 'evidence_uploaded')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'maintenance_items_non_execution_reason_check'
      AND conrelid = 'maintenance_schedule_items'::regclass
  ) THEN
    ALTER TABLE maintenance_schedule_items
      ADD CONSTRAINT maintenance_items_non_execution_reason_check
      CHECK (
        historical_resolution <> 'not_performed'
        OR NULLIF(BTRIM(non_execution_reason), '') IS NOT NULL
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_maintenance_items_historical_resolution
  ON maintenance_schedule_items (historical_resolution)
  WHERE historical_resolution IS NOT NULL;
