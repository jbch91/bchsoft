import { Permission, Role } from '../auth/models';

export interface BiomedicalFeaturePolicy {
  label: string;
  route: string;
  moduleKey?: string;
  permissionsAny: readonly Permission[];
  excludedRoles?: readonly Role[];
}

export const BIOMEDICAL_FEATURE_POLICIES = {
  hojas_de_vida: {
    label: 'Hojas de vida',
    route: '/hojas-de-vida',
    moduleKey: 'hojas_de_vida',
    permissionsAny: ['hb:create', 'hb:view', 'read:all'],
    excludedRoles: ['lector', 'responsable_area']
  },
  hojas_de_vida_industriales: {
    label: 'Hojas de vida industriales',
    route: '/hojas-de-vida-industriales',
    moduleKey: 'hojas_de_vida',
    permissionsAny: ['hb:create', 'hb:view', 'read:all'],
    excludedRoles: ['lector', 'responsable_area']
  },
  inventario: {
    label: 'Inventario',
    route: '/inventario',
    moduleKey: 'inventario',
    permissionsAny: ['hb:create', 'hb:view', 'read:all']
  },
  sedes_areas_ubicaciones: {
    label: 'Sedes y ubicaciones',
    route: '/sedes-areas-ubicaciones',
    permissionsAny: ['areas:manage']
  },
  guias_rapidas: {
    label: 'Guías rápidas',
    route: '/guias-rapidas',
    moduleKey: 'guias_rapidas',
    permissionsAny: [
      'quick_guides:view',
      'quick_guides:create',
      'quick_guides:edit',
      'quick_guides:approve',
      'quick_guides:delete',
      'hb:view',
      'read:all'
    ]
  },
  reportes_mantenimiento: {
    label: 'Mantenimiento',
    route: '/mantenimiento',
    moduleKey: 'reportes_mantenimiento',
    permissionsAny: [
      'maintenance:request:create',
      'maintenance:report:create',
      'maintenance:report:sign',
      'maintenance:protocol:print_blank',
      'read:all'
    ]
  },
  reportes_mantenimiento_industrial: {
    label: 'Mantenimiento industrial',
    route: '/mantenimiento-industrial',
    moduleKey: 'reportes_mantenimiento',
    permissionsAny: [
      'maintenance:request:create',
      'maintenance:report:create',
      'maintenance:report:sign',
      'maintenance:protocol:print_blank',
      'read:all'
    ]
  },
  cronogramas: {
    label: 'Cronogramas',
    route: '/cronogramas',
    moduleKey: 'cronogramas',
    permissionsAny: ['schedules:manage', 'schedules:unlock_approved']
  },
  cronogramas_industriales: {
    label: 'Cronogramas industriales',
    route: '/cronogramas-industriales',
    moduleKey: 'cronogramas',
    permissionsAny: ['schedules:manage', 'schedules:unlock_approved']
  },
  calibraciones: {
    label: 'Calibraciones',
    route: '/calibraciones',
    moduleKey: 'calibraciones',
    permissionsAny: ['calibration:schedule:manage', 'calibration:report:upload', 'read:all']
  }
} as const satisfies Record<string, BiomedicalFeaturePolicy>;

export type BiomedicalFeatureKey = keyof typeof BIOMEDICAL_FEATURE_POLICIES;

export function canOpenBiomedicalFeature(
  featureKey: BiomedicalFeatureKey,
  context: {
    permissions: readonly Permission[];
    roles: readonly Role[];
    enabledModules: ReadonlySet<string> | null;
  }
): boolean {
  const policy = BIOMEDICAL_FEATURE_POLICIES[featureKey] as BiomedicalFeaturePolicy;
  if (policy.excludedRoles?.some((role) => context.roles.includes(role))) {
    return false;
  }
  if (!policy.permissionsAny.some((permission) => context.permissions.includes(permission))) {
    return false;
  }
  if (!policy.moduleKey) {
    return true;
  }
  return Boolean(context.enabledModules?.has(policy.moduleKey));
}
