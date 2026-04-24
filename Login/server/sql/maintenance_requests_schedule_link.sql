ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_item_id UUID REFERENCES maintenance_schedule_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_schedule_item
  ON maintenance_requests (schedule_item_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_maintenance_requests_unique_schedule_item
  ON maintenance_requests (schedule_item_id)
  WHERE source = 'cronograma' AND schedule_item_id IS NOT NULL;
