ALTER TABLE maintenance_schedule_items
  ADD COLUMN IF NOT EXISTS completion_source TEXT,
  ADD COLUMN IF NOT EXISTS legacy_history_file_id UUID;

UPDATE maintenance_schedule_items
SET completion_source = CASE
  WHEN report_id IS NOT NULL THEN 'software_report'
  ELSE 'legacy_completion'
END
WHERE status = 'done'
  AND completion_source IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_maintenance_items_legacy_history_file
  ON maintenance_schedule_items (legacy_history_file_id)
  WHERE legacy_history_file_id IS NOT NULL;

WITH affected_items AS (
  UPDATE maintenance_schedule_items AS item
  SET deadline_date = (
    DATE_TRUNC('month', item.planned_date) + INTERVAL '1 month - 1 day'
  )::date
  WHERE item.deadline_date IS DISTINCT FROM (
    DATE_TRUNC('month', item.planned_date) + INTERVAL '1 month - 1 day'
  )::date
  RETURNING item.schedule_id
)
UPDATE maintenance_schedules
SET pdf_path = NULL
WHERE id IN (SELECT DISTINCT schedule_id FROM affected_items);

DO $$
DECLARE
  tenant RECORD;
BEGIN
  FOR tenant IN SELECT schema_name FROM clients LOOP
    EXECUTE format(
      'ALTER TABLE %I.asset_history_files
         ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT ''other'',
         ADD COLUMN IF NOT EXISTS maintenance_schedule_item_id UUID',
      tenant.schema_name
    );

    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I
         ON %I.asset_history_files (maintenance_schedule_item_id)
         WHERE maintenance_schedule_item_id IS NOT NULL',
      'idx_asset_history_files_schedule_item',
      tenant.schema_name
    );
  END LOOP;
END $$;
