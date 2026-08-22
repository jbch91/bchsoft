WITH affected_schedules AS (
  UPDATE maintenance_schedule_items AS item
  SET deadline_date = MAKE_DATE(schedule.year, 12, 31)
  FROM maintenance_schedules AS schedule
  WHERE item.schedule_id = schedule.id
    AND item.deadline_date > MAKE_DATE(schedule.year, 12, 31)
  RETURNING item.schedule_id
)
UPDATE maintenance_schedules
SET pdf_path = NULL
WHERE id IN (SELECT schedule_id FROM affected_schedules);

WITH affected_schedules AS (
  UPDATE calibration_schedule_items AS item
  SET deadline_date = MAKE_DATE(schedule.year, 12, 31)
  FROM calibration_schedules AS schedule
  WHERE item.schedule_id = schedule.id
    AND item.deadline_date > MAKE_DATE(schedule.year, 12, 31)
  RETURNING item.schedule_id
)
UPDATE calibration_schedules
SET pdf_path = NULL
WHERE id IN (SELECT schedule_id FROM affected_schedules);
