ALTER TABLE odontology_appointments
  ADD COLUMN IF NOT EXISTS treatment_plan_id UUID REFERENCES odontology_treatment_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS treatment_plan_item_id UUID REFERENCES odontology_treatment_plan_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_odontology_appointments_treatment_plan
  ON odontology_appointments (client_id, treatment_plan_id);

CREATE INDEX IF NOT EXISTS idx_odontology_appointments_treatment_plan_item
  ON odontology_appointments (client_id, treatment_plan_item_id);
