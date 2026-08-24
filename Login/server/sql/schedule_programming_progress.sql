ALTER TABLE maintenance_schedule_items
  ADD COLUMN IF NOT EXISTS programming_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS programmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS programmed_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE training_schedule_items
  ADD COLUMN IF NOT EXISTS programming_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS programmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS programmed_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE calibration_schedule_items
  ADD COLUMN IF NOT EXISTS programming_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS programmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS programmed_by UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE maintenance_schedule_items AS item
SET programming_confirmed = TRUE,
    programmed_at = COALESCE(schedule.approved_at, schedule.created_at),
    programmed_by = schedule.created_by
FROM maintenance_schedules AS schedule
WHERE schedule.id = item.schedule_id
  AND schedule.status <> 'draft'
  AND item.programming_confirmed = FALSE;

UPDATE training_schedule_items AS item
SET programming_confirmed = TRUE,
    programmed_at = COALESCE(schedule.approved_at, schedule.created_at),
    programmed_by = schedule.created_by
FROM training_schedules AS schedule
WHERE schedule.id = item.schedule_id
  AND schedule.status <> 'draft'
  AND item.programming_confirmed = FALSE;

UPDATE calibration_schedule_items AS item
SET programming_confirmed = TRUE,
    programmed_at = COALESCE(schedule.approved_at, schedule.created_at),
    programmed_by = schedule.created_by
FROM calibration_schedules AS schedule
WHERE schedule.id = item.schedule_id
  AND schedule.status <> 'draft'
  AND item.programming_confirmed = FALSE;

CREATE INDEX IF NOT EXISTS idx_maintenance_schedule_items_programming
  ON maintenance_schedule_items (schedule_id, programming_confirmed);

CREATE INDEX IF NOT EXISTS idx_training_schedule_items_programming
  ON training_schedule_items (schedule_id, programming_confirmed);

CREATE INDEX IF NOT EXISTS idx_calibration_schedule_items_programming
  ON calibration_schedule_items (schedule_id, programming_confirmed);
