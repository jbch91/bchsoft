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
      'UPDATE maintenance_schedules AS schedule
       SET pdf_path = NULL
       WHERE schedule.client_id = $1
         AND EXISTS (
           SELECT 1
           FROM maintenance_schedule_items AS item
           WHERE item.schedule_id = schedule.id
             AND NOT EXISTS (
               SELECT 1 FROM %I.assets AS asset WHERE asset.id = item.asset_id
             )
         )',
      tenant.schema_name
    ) USING tenant.id;

    EXECUTE format(
      'DELETE FROM maintenance_schedule_items AS item
       USING maintenance_schedules AS schedule
       WHERE item.schedule_id = schedule.id
         AND schedule.client_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM %I.assets AS asset WHERE asset.id = item.asset_id
         )',
      tenant.schema_name
    ) USING tenant.id;

    EXECUTE format(
      'DELETE FROM calibration_schedule_items AS item
       USING calibration_schedules AS schedule
       WHERE item.schedule_id = schedule.id
         AND schedule.client_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM %I.assets AS asset WHERE asset.id = item.asset_id
         )',
      tenant.schema_name
    ) USING tenant.id;
  END LOOP;
END
$$;
