export const TEMPORARY_ONLY_PERMISSIONS = Object.freeze([
  'hb:import',
  'asset_history:upload',
  'maintenance:protocol:print_blank'
]);

export const SUITE_BASE_PERMISSIONS = Object.freeze({
  biomedico: Object.freeze([
    'software:biomedico:access',
    'areas:manage',
    'read:all'
  ]),
  odontologico: Object.freeze([
    'software:odontologico:access'
  ]),
  laboratorio: Object.freeze([
    'software:laboratorio:access'
  ])
});

export const CLIENT_MODULE_PERMISSION_POLICY = Object.freeze({
  hojas_de_vida: Object.freeze([
    'hb:create',
    'hb:view',
    'hb:import',
    'asset_history:upload'
  ]),
  inventario: Object.freeze([
    'hb:view',
    'inventory:move',
    'inventory:request'
  ]),
  guias_rapidas: Object.freeze([
    'quick_guides:view',
    'quick_guides:create',
    'quick_guides:edit',
    'quick_guides:approve',
    'quick_guides:delete'
  ]),
  reportes_mantenimiento: Object.freeze([
    'hb:view',
    'maintenance:request:create',
    'maintenance:report:create',
    'maintenance:report:sign',
    'maintenance:protocol:print_blank',
    'maintenance:order:create',
    'maintenance:order:close',
    'service:order:create',
    'spareparts:order:create'
  ]),
  cronogramas: Object.freeze([
    'schedules:manage'
  ]),
  calibraciones: Object.freeze([
    'calibration:schedule:manage',
    'calibration:report:upload'
  ]),
  odontologia: Object.freeze([
    'software:odontologico:access',
    'odontology:access',
    'odontology:settings:manage',
    'odontology:patients:manage',
    'odontology:patients:import',
    'odontology:clinical_records:manage',
    'odontology:appointments:manage',
    'odontology:odontogram:manage',
    'odontology:periodontogram:manage',
    'odontology:consents:manage',
    'odontology:attachments:manage',
    'odontology:inventory:manage',
    'odontology:sterilization:manage',
    'odontology:treatment_plans:manage',
    'odontology:payments:manage',
    'odontology:financial:view',
    'odontology:prescriptions:manage',
    'odontology:documents:manage',
    'odontology:reports:view',
    'audit:odontology:view'
  ]),
  laboratorio: Object.freeze([
    'software:laboratorio:access',
    'laboratory:orders:manage',
    'laboratory:results:manage'
  ])
});

const MODULE_SUITE_POLICY = Object.freeze({
  hojas_de_vida: 'biomedico',
  inventario: 'biomedico',
  guias_rapidas: 'biomedico',
  reportes_mantenimiento: 'biomedico',
  cronogramas: 'biomedico',
  calibraciones: 'biomedico',
  odontologia: 'odontologico',
  laboratorio: 'laboratorio'
});

export const SUITE_ACCESS_PERMISSIONS = Object.freeze(
  Object.fromEntries(
    Object.keys(SUITE_BASE_PERMISSIONS).map((suiteKey) => {
      const permissions = new Set(SUITE_BASE_PERMISSIONS[suiteKey] || []);
      for (const [moduleKey, moduleSuite] of Object.entries(MODULE_SUITE_POLICY)) {
        if (moduleSuite !== suiteKey) continue;
        for (const permission of CLIENT_MODULE_PERMISSION_POLICY[moduleKey] || []) {
          permissions.add(permission);
        }
      }
      return [suiteKey, Object.freeze(Array.from(permissions))];
    })
  )
);

export function allowedClientPermissionsForModules(
  modules = [],
  { includeTemporary = true } = {}
) {
  const enabledModules = modules.filter((module) => module.enabled);
  const enabledSuites = new Set(
    enabledModules.map((module) => module.suite_key || 'biomedico')
  );
  const permissions = new Set();

  for (const suiteKey of enabledSuites) {
    for (const permission of SUITE_BASE_PERMISSIONS[suiteKey] || []) {
      permissions.add(permission);
    }
  }

  for (const module of enabledModules) {
    for (const permission of CLIENT_MODULE_PERMISSION_POLICY[module.key] || []) {
      permissions.add(permission);
    }
  }

  if (!includeTemporary) {
    for (const permission of TEMPORARY_ONLY_PERMISSIONS) {
      permissions.delete(permission);
    }
  }

  return permissions;
}
