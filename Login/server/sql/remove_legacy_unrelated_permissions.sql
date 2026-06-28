-- Limpieza de permisos heredados de otros sistemas/prototipos que no pertenecen
-- al ecosistema actual INBIHOSPITALARIO SaaS + biomédico + odontológico + laboratorio.
-- No toca permisos válidos como odontology:inventory:manage, inventory:move o inventory:request.
DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id
  AND (
    p.name LIKE 'cash:%'
    OR p.name LIKE 'sales:%'
    OR p.name LIKE 'remisiones:%'
    OR p.name IN (
      'inventory:create',
      'inventory:edit',
      'inventory:delete',
      'inventory:manage',
      'inventory:view'
    )
  );

DELETE FROM user_temporary_permissions utp
USING permissions p
WHERE utp.permission_id = p.id
  AND (
    p.name LIKE 'cash:%'
    OR p.name LIKE 'sales:%'
    OR p.name LIKE 'remisiones:%'
    OR p.name IN (
      'inventory:create',
      'inventory:edit',
      'inventory:delete',
      'inventory:manage',
      'inventory:view'
    )
  );

DELETE FROM permissions p
WHERE p.name LIKE 'cash:%'
   OR p.name LIKE 'sales:%'
   OR p.name LIKE 'remisiones:%'
   OR p.name IN (
     'inventory:create',
     'inventory:edit',
     'inventory:delete',
     'inventory:manage',
     'inventory:view'
   );
