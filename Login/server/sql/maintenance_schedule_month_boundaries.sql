WITH affected_items AS (
  UPDATE maintenance_schedule_items AS item
  SET deadline_date = (
    DATE_TRUNC('month', item.planned_date) + INTERVAL '1 month - 1 day'
  )::date
  FROM maintenance_schedules AS schedule
  WHERE schedule.id = item.schedule_id
    AND schedule.status = 'draft'
    AND item.deadline_date > (
      DATE_TRUNC('month', item.planned_date) + INTERVAL '1 month - 1 day'
    )::date
  RETURNING item.schedule_id
)
UPDATE maintenance_schedules
SET pdf_path = NULL
WHERE id IN (SELECT DISTINCT schedule_id FROM affected_items);
