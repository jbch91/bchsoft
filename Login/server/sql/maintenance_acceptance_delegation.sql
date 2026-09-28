ALTER TABLE maintenance_reports
  ADD COLUMN IF NOT EXISTS acceptance_delegate_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS acceptance_delegate_name text,
  ADD COLUMN IF NOT EXISTS acceptance_delegated_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS acceptance_delegated_at timestamptz,
  ADD COLUMN IF NOT EXISTS acceptance_delegation_reason text;

CREATE INDEX IF NOT EXISTS maintenance_reports_acceptance_delegate_idx
  ON maintenance_reports(client_id, acceptance_delegate_user_id)
  WHERE acceptance_delegate_user_id IS NOT NULL;
