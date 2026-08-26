import { describe, expect, it } from 'vitest';
import {
  maintenanceAssetMatchesLookup,
  normalizeMaintenanceLookup,
  paginateMaintenanceItems
} from './maintenance-view.utils';

describe('maintenance view utilities', () => {
  it('normaliza acentos y mayúsculas para búsquedas', () => {
    expect(normalizeMaintenanceLookup('  MONITOR CARDÍACO ')).toBe('monitor cardiaco');
  });

  it('encuentra un equipo por código, serial o URL de QR', () => {
    const asset = { id: '8b490b20-1fb1-4f72-8f14-78248974ab28', code: 'ESJD133', serial: 'SN-9981' };
    expect(maintenanceAssetMatchesLookup(asset, 'esjd133')).toBe(true);
    expect(maintenanceAssetMatchesLookup(asset, 'SN-9981')).toBe(true);
    expect(
      maintenanceAssetMatchesLookup(asset, 'http://localhost/inventario?assetId=8b490b20-1fb1-4f72-8f14-78248974ab28')
    ).toBe(true);
  });

  it('ignora seriales genéricos para no seleccionar el equipo equivocado', () => {
    const asset = { id: 'asset-1', code: 'EQ-101', serial: 'NR' };
    expect(maintenanceAssetMatchesLookup(asset, 'NR')).toBe(false);
    expect(maintenanceAssetMatchesLookup(asset, 'https://localhost/inventario?code=NR')).toBe(false);
  });

  it('pagina reportes y ajusta una página que ya no existe', () => {
    const result = paginateMaintenanceItems(['a', 'b', 'c', 'd', 'e'], 8, 2);

    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(3);
    expect(result.items).toEqual(['e']);
    expect(result.start).toBe(5);
    expect(result.end).toBe(5);
  });

  it('mantiene una página vacía con contadores legibles', () => {
    const result = paginateMaintenanceItems([], 1, 10);

    expect(result.items).toEqual([]);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.start).toBe(0);
    expect(result.end).toBe(0);
  });
});
