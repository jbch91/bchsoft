WITH preventive_reports AS (
  SELECT DISTINCT ON (request.schedule_item_id)
         request.schedule_item_id,
         request.schedule_id,
         report.id AS report_id,
         report.created_at AS report_created_at
  FROM maintenance_requests request
  JOIN maintenance_reports report
    ON report.request_id = request.id
   AND report.type = 'preventivo'
   AND report.requires_spare_parts = TRUE
   AND report.spare_parts_status <> 'recibido'
  WHERE request.type = 'preventivo'
    AND request.schedule_id IS NOT NULL
    AND request.schedule_item_id IS NOT NULL
  ORDER BY request.schedule_item_id, report.created_at DESC, report.id DESC
)
UPDATE maintenance_schedule_items item
SET status = 'done',
    completed_at = COALESCE(item.completed_at, preventive.report_created_at),
    report_id = preventive.report_id,
    completion_source = 'software_report',
    legacy_history_file_id = NULL,
    historical_resolution = NULL,
    non_execution_reason = NULL,
    non_execution_recorded_at = NULL,
    non_execution_recorded_by = NULL
FROM preventive_reports preventive
WHERE item.id = preventive.schedule_item_id
  AND item.schedule_id = preventive.schedule_id
  AND item.completion_source IS DISTINCT FROM 'historical_pdf';

UPDATE maintenance_schedules schedule
SET pdf_path = NULL
WHERE EXISTS (
  SELECT 1
  FROM maintenance_schedule_items item
  JOIN maintenance_requests request
    ON request.schedule_item_id = item.id
   AND request.schedule_id = item.schedule_id
   AND request.type = 'preventivo'
  JOIN maintenance_reports report
    ON report.request_id = request.id
   AND report.type = 'preventivo'
   AND report.requires_spare_parts = TRUE
   AND report.spare_parts_status <> 'recibido'
  WHERE item.schedule_id = schedule.id
);

UPDATE maintenance_schedules schedule
SET status = 'closed'
WHERE schedule.status = 'approved'
  AND EXISTS (
    SELECT 1
    FROM maintenance_schedule_items item
    WHERE item.schedule_id = schedule.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM maintenance_schedule_items item
    WHERE item.schedule_id = schedule.id
      AND item.status <> 'done'
  );
