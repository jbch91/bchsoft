ALTER TABLE maintenance_reports
  ADD COLUMN IF NOT EXISTS closure_kind TEXT NOT NULL DEFAULT 'maintenance',
  ADD COLUMN IF NOT EXISTS non_execution_details JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_report_closure_kind_check') THEN
    ALTER TABLE maintenance_reports ADD CONSTRAINT maintenance_report_closure_kind_check CHECK (
      closure_kind = 'maintenance' OR (
        closure_kind = 'not_located' AND type = 'preventivo'
        AND NOT area_responsible_required AND NOT requires_spare_parts
        AND asset_status_after = 'no_verificado'
        AND maintenance_checks = '[]'::jsonb
        AND maintenance_activities = '[]'::jsonb AND maintenance_tests = '[]'::jsonb
        AND length(COALESCE(non_execution_details->>'reason', '')) >= 20
        AND NULLIF(non_execution_details->>'verifiedOn', '') IS NOT NULL
        AND NULLIF(non_execution_details->>'searchedLocation', '') IS NOT NULL
      )
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_maintenance_report_not_located_request
  ON maintenance_reports(request_id) WHERE closure_kind = 'not_located';
