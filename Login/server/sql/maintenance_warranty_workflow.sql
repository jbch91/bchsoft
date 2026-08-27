ALTER TABLE maintenance_schedule_items
  ADD COLUMN IF NOT EXISTS warranty_resolution TEXT,
  ADD COLUMN IF NOT EXISTS warranty_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warranty_resolved_by UUID REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'maintenance_items_warranty_resolution_check'
      AND conrelid = 'maintenance_schedule_items'::regclass
  ) THEN
    ALTER TABLE maintenance_schedule_items
      ADD CONSTRAINT maintenance_items_warranty_resolution_check
      CHECK (
        warranty_resolution IS NULL
        OR warranty_resolution IN ('covered', 'perform')
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_maintenance_items_warranty_resolution
  ON maintenance_schedule_items (warranty_resolution)
  WHERE warranty_resolution IS NOT NULL;

DO $$
DECLARE
  tenant RECORD;
BEGIN
  FOR tenant IN
    SELECT id, schema_name
    FROM clients
    WHERE schema_name ~ '^[a-zA-Z0-9_]+$'
  LOOP
    IF to_regclass(format('%I.%I', tenant.schema_name, 'assets')) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'UPDATE maintenance_requests AS request
       SET status = ''garantia'', updated_at = NOW()
       FROM maintenance_schedule_items AS item,
            maintenance_schedules AS schedule,
            %I.assets AS asset
       WHERE request.schedule_item_id = item.id
         AND item.schedule_id = schedule.id
         AND item.asset_id = asset.id
         AND schedule.client_id = $1
         AND schedule.status = ''approved''
         AND request.type = ''preventivo''
         AND request.source = ''cronograma''
         AND request.status IN (''abierto'', ''vencido'')
         AND item.report_id IS NULL
         AND item.completion_source IS NULL
         AND item.legacy_history_file_id IS NULL
         AND item.warranty_resolution IS DISTINCT FROM ''perform''
         AND asset.warranty_years IS NOT NULL
         AND (
           asset.acquisition_date IS NULL
           OR item.planned_date < (
             asset.acquisition_date + make_interval(years => asset.warranty_years)
           )::date
         )
         AND NOT EXISTS (
           SELECT 1
           FROM maintenance_reports AS report
           WHERE report.request_id = request.id
         )',
      tenant.schema_name
    ) USING tenant.id;

    EXECUTE format(
      'WITH protected AS (
         UPDATE maintenance_schedule_items AS item
         SET status = ''warranty''
         FROM maintenance_schedules AS schedule, %I.assets AS asset
         WHERE item.schedule_id = schedule.id
           AND item.asset_id = asset.id
           AND schedule.client_id = $1
           AND schedule.status = ''approved''
           AND item.status IN (''pending'', ''active'', ''expired'', ''warranty'')
           AND item.report_id IS NULL
           AND item.completion_source IS NULL
           AND item.legacy_history_file_id IS NULL
           AND item.warranty_resolution IS DISTINCT FROM ''perform''
           AND asset.warranty_years IS NOT NULL
           AND (
             asset.acquisition_date IS NULL
             OR item.planned_date < (
               asset.acquisition_date + make_interval(years => asset.warranty_years)
             )::date
           )
           AND NOT EXISTS (
             SELECT 1
             FROM maintenance_requests AS request
             WHERE request.schedule_item_id = item.id
               AND request.status IN (
                 ''en_proceso'', ''espera_repuesto'', ''reportado'', ''firmado'', ''correccion''
               )
           )
         RETURNING item.schedule_id
       )
       UPDATE maintenance_schedules AS schedule
       SET pdf_path = NULL
       WHERE schedule.id IN (SELECT DISTINCT schedule_id FROM protected)',
      tenant.schema_name
    ) USING tenant.id;
  END LOOP;
END
$$;
