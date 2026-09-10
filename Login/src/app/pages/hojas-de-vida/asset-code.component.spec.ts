import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { HojasDeVidaComponent } from './hojas-de-vida.component';

describe('Hoja de vida: default frequency and equipment codes', () => {
  let component: HojasDeVidaComponent;
  const api = { getAssetCodeSuggestion: vi.fn(), getAssetDetails: vi.fn() };
  const available = (code: string) => ({ code, available: true, suggestion: code, prefix: 'H-' });
  beforeEach(() => {
    vi.spyOn(HojasDeVidaComponent.prototype as any, 'init').mockResolvedValue(undefined);
    component = new HojasDeVidaComponent(api as any, {} as any, {} as any, {} as any, {} as any,
      { hasPermission: () => true } as any, { detectChanges: vi.fn() } as any,
      { snapshot: { data: {} }, queryParams: of({}) } as any);
    component.selectedClientId = 'client-a';
    component.formContextLoading = false;
    vi.spyOn(component, 'loadLocationsForForm').mockResolvedValue(undefined);
    api.getAssetCodeSuggestion.mockResolvedValue(available('H-0001'));
  });
  afterEach(() => {
    component.ngOnDestroy();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('defaults new assets to quarterly and suggests a code for the current client', async () => {
    await component.openCreateModal();
    expect(component.maintenanceFrequency).toBe('trimestral');
    expect(component.code).toBe('H-0001');
    expect(component.codeAutomatic).toBe(true);
    expect(api.getAssetCodeSuggestion).toHaveBeenCalledWith('client-a', {});
    component.maintenanceFrequency = 'mensual';
    component.resetForm();
    expect(component.maintenanceFrequency).toBe('trimestral');
  });

  it('does not open creation before the client has finished loading', async () => {
    component.formContextLoading = true;
    await component.openCreateModal();
    expect(component.assetModalMode).toBe(null);
    expect(api.getAssetCodeSuggestion).not.toHaveBeenCalled();
  });

  it('returns visibly to the code field if a duplicate is found at final save', async () => {
    component.assetModalMode = 'create';
    component.code = 'H-0001';
    component.name = 'EQUIPO';
    component.wizardStep = 7;
    api.getAssetCodeSuggestion.mockResolvedValue({ ...available('H-0001'), available: false });
    const renders: number[] = [];
    (component as any).cdr.detectChanges.mockImplementation(() => renders.push(component.wizardStep));
    await component.onCreateAsset();
    expect(component.assetSaving).toBe(false);
    expect(component.codeState).toBe('duplicate');
    expect(renders.at(-1)).toBe(0);
  });

  it('preserves an existing monthly frequency and code when editing', async () => {
    api.getAssetDetails.mockResolvedValue({ code: 'EXISTING-9', maintenance_frequency: 'mensual', asset_category: 'biomedical' });
    await component.openEditModal({ id: 'asset-a' } as any);
    expect(component.maintenanceFrequency).toBe('mensual');
    expect(component.code).toBe('EXISTING-9');
    expect(component.codeAutomatic).toBe(false);
    expect(component.codeState).toBe('available');
    expect(api.getAssetCodeSuggestion).not.toHaveBeenCalled();
  });

  it('debounces manual entry and excludes the edited asset from duplicate validation', async () => {
    vi.useFakeTimers();
    component.assetModalMode = 'edit';
    component.editingAssetId = 'asset-a';
    component.onCodeInput('h-0002');
    api.getAssetCodeSuggestion.mockResolvedValue({ ...available('H-0002'), available: false });
    await vi.advanceTimersByTimeAsync(401);
    expect(api.getAssetCodeSuggestion).toHaveBeenCalledWith('client-a', { code: 'H-0002', assetId: 'asset-a' });
    expect(component.codeState).toBe('duplicate');
    expect(component.codeAutomatic).toBe(false);
  });

  it('does not overwrite manual input with a late automatic suggestion', async () => {
    vi.useFakeTimers();
    let resolve!: (value: unknown) => void;
    api.getAssetCodeSuggestion.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const opening = component.openCreateModal();
    component.onCodeInput('MANUAL-9');
    resolve(available('H-0001'));
    await opening;
    expect(component.code).toBe('MANUAL-9');
    api.getAssetCodeSuggestion.mockResolvedValue(available('MANUAL-9'));
    await vi.advanceTimersByTimeAsync(401);
    expect(component.codeState).toBe('available');
  });

  it('ignores replies after closing the modal', async () => {
    let resolve!: (value: unknown) => void;
    api.getAssetCodeSuggestion.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const opening = component.openCreateModal();
    component.closeAssetModal();
    resolve(available('H-0001'));
    await opening;
    expect(component.code).toBe('');
    expect(component.assetModalMode).toBe(null);
  });

  it('recovers from a failed availability check without losing the code', async () => {
    component.assetModalMode = 'create';
    component.codeAutomatic = false;
    component.code = 'MANUAL-9';
    api.getAssetCodeSuggestion.mockRejectedValueOnce(new Error('Network'));
    await component.retryAssetCode();
    expect(component.codeState).toBe('error');
    expect(component.code).toBe('MANUAL-9');
    api.getAssetCodeSuggestion.mockResolvedValue(available('MANUAL-9'));
    await component.retryAssetCode();
    expect(component.codeState).toBe('available');
  });
});
