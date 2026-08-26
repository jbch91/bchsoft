DO $$
DECLARE
  tenant RECORD;
  local_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date;
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
      'WITH removed AS (
         DELETE FROM maintenance_schedule_items AS item
         USING maintenance_schedules AS schedule, %I.assets AS asset
         WHERE item.schedule_id = schedule.id
           AND item.asset_id = asset.id
           AND schedule.client_id = $1
           AND schedule.status IN (''draft'', ''approved'')
           AND item.status = ''pending''
           AND item.planned_date >= $2
           AND item.report_id IS NULL
           AND item.completion_source IS NULL
           AND item.legacy_history_file_id IS NULL
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
           )
         RETURNING item.schedule_id
       )
       UPDATE maintenance_schedules AS schedule
       SET pdf_path = NULL
       WHERE schedule.id IN (SELECT DISTINCT schedule_id FROM removed)',
      tenant.schema_name
    ) USING tenant.id, local_today;
  END LOOP;
END
$$;
