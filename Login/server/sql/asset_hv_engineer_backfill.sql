DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT schema_name FROM clients LOOP
    EXECUTE format($f$
      UPDATE %I.assets a
      SET hv_engineer_user_id = audit.actor_user_id,
          hv_engineer_signed_at = COALESCE(audit.created_at, NOW())
      FROM (
        SELECT DISTINCT ON (al.target_user_id)
               al.target_user_id AS asset_id,
               al.actor_user_id,
               al.created_at
        FROM audit_logs al
        JOIN user_roles ur ON ur.user_id = al.actor_user_id
        JOIN roles r ON r.id = ur.role_id
        WHERE al.action IN ('ASSET_IMPORT', 'ASSET_CREATE', 'ASSET_UPDATE')
          AND r.name = 'ingeniero_biomedico'
        ORDER BY al.target_user_id, al.created_at DESC
      ) audit
      WHERE a.id = audit.asset_id
        AND a.hv_engineer_user_id IS NULL
    $f$, s.schema_name);
  END LOOP;
END $$;
