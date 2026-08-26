import {
  BIOMEDICAL_FEATURE_POLICIES,
  canOpenBiomedicalFeature
} from './biomedical-access-policy';

describe('biomedical access policy', () => {
  it('muestra sedes solo cuando areas:manage está presente', () => {
    expect(canOpenBiomedicalFeature('sedes_areas_ubicaciones', {
      permissions: ['areas:manage'],
      roles: ['ingeniero_biomedico'],
      enabledModules: new Set()
    })).toBe(true);

    expect(canOpenBiomedicalFeature('sedes_areas_ubicaciones', {
      permissions: ['hb:view'],
      roles: ['ingeniero_biomedico'],
      enabledModules: new Set(['hojas_de_vida'])
    })).toBe(false);
  });

  it('exige permiso y módulo contratado para las hojas de vida', () => {
    expect(canOpenBiomedicalFeature('hojas_de_vida', {
      permissions: ['hb:view'],
      roles: ['ingeniero_biomedico'],
      enabledModules: new Set(['hojas_de_vida'])
    })).toBe(true);

    expect(canOpenBiomedicalFeature('hojas_de_vida', {
      permissions: ['hb:view'],
      roles: ['ingeniero_biomedico'],
      enabledModules: new Set()
    })).toBe(false);
  });

  it('mantiene la misma política para navegación y rutas', () => {
    expect(BIOMEDICAL_FEATURE_POLICIES.sedes_areas_ubicaciones.permissionsAny)
      .toEqual(['areas:manage']);
    expect(BIOMEDICAL_FEATURE_POLICIES.sedes_areas_ubicaciones.route)
      .toBe('/sedes-areas-ubicaciones');
  });

  it('limita al responsable de área a inventario y mantenimiento operativo', () => {
    const context = {
      permissions: [
        'hb:view',
        'maintenance:request:create',
        'maintenance:report:sign'
      ] as const,
      roles: ['responsable_area'] as const,
      enabledModules: new Set(['hojas_de_vida', 'inventario', 'reportes_mantenimiento'])
    };

    expect(canOpenBiomedicalFeature('hojas_de_vida', context)).toBe(false);
    expect(canOpenBiomedicalFeature('inventario', context)).toBe(true);
    expect(canOpenBiomedicalFeature('reportes_mantenimiento', context)).toBe(true);
    expect(canOpenBiomedicalFeature('cronogramas', context)).toBe(false);
  });

  it('mantiene separados los accesos a hojas de vida y cronogramas industriales', () => {
    const context = {
      permissions: ['hb:view', 'maintenance:report:create', 'schedules:manage'] as const,
      roles: ['ingeniero_biomedico'] as const,
      enabledModules: new Set(['hojas_de_vida', 'reportes_mantenimiento', 'cronogramas'])
    };

    expect(canOpenBiomedicalFeature('hojas_de_vida_industriales', context)).toBe(true);
    expect(canOpenBiomedicalFeature('cronogramas_industriales', context)).toBe(true);
    expect(canOpenBiomedicalFeature('reportes_mantenimiento_industrial', context)).toBe(true);
    expect(BIOMEDICAL_FEATURE_POLICIES.hojas_de_vida_industriales.route)
      .toBe('/hojas-de-vida-industriales');
    expect(BIOMEDICAL_FEATURE_POLICIES.cronogramas_industriales.route)
      .toBe('/cronogramas-industriales');
  });
});
