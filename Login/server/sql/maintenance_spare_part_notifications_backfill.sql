INSERT INTO notifications (user_id, client_id, title, message, link, type, priority, payload)
SELECT
  u.id,
  r.client_id,
  'Solicitud de repuesto',
  CONCAT(
    'Un equipo requiere repuesto: ',
    COALESCE(NULLIF(r.spare_parts_needed, ''), 'No especificado'),
    '. El caso queda en espera de repuestos.'
  ),
  '/mantenimiento',
  'maintenance_spare_part_requested',
  'high',
  jsonb_build_object(
    'reportId', r.id::text,
    'requestId', r.request_id::text,
    'assetId', r.asset_id::text,
    'sparePartsNeeded', r.spare_parts_needed
  )
FROM maintenance_reports r
JOIN maintenance_requests req ON req.id = r.request_id
JOIN users u ON u.client_id = r.client_id AND u.is_active = TRUE
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles role ON role.id = ur.role_id AND role.name = 'almacenista'
WHERE r.requires_spare_parts = TRUE
  AND r.spare_parts_status = 'solicitado'
  AND req.status = 'espera_repuesto'
  AND NOT EXISTS (
    SELECT 1
    FROM notifications n
    WHERE n.user_id = u.id
      AND n.type = 'maintenance_spare_part_requested'
      AND n.payload->>'reportId' = r.id::text
  );
