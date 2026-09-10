import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MaintenanceComponent } from './maintenance.component';

function setup() {
  const auth = {
    currentUser: () => ({ id: 'engineer-1', clientId: 'client-1' }),
    hasRole: (role: string) => role === 'ingeniero_biomedico',
    hasPermission: vi.fn(() => true)
  };
  const maintenance = {
    generateBlankProtocols: vi.fn().mockResolvedValue({
      blob: new Blob(['test PDF'], { type: 'application/pdf' }), batchCode: 'PMF-123', assetCount: 1
    })
  };
  const cdr = { detectChanges: vi.fn() };
  const component = new MaintenanceComponent(
    {} as never, auth as never, {} as never, maintenance as never,
    cdr as never, { snapshot: { data: {} } } as never
  );
  component.assets = [
    { id: 'asset-1', code: 'A001', name: 'MONITOR', status: 'operativo' },
    { id: 'asset-2', code: 'A002', name: 'BASCULA', status: 'fuera_de_servicio' },
    { id: 'asset-3', code: 'A003', name: 'RETIRADO', status: 'dado_de_baja' }
  ];
  component.viewMode = 'protocolos_fisicos';
  component.selectedProtocolAssetIds = new Set(['asset-1']);
  const focus = vi.fn();
  component.protocolReasonInput = { nativeElement: { focus } } as never;
  const preview = { opener: {}, document: { title: '', body: { textContent: '' } }, location: { href: '' }, close: vi.fn() };
  const popup = vi.spyOn(window, 'open').mockReturnValue(preview as never);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:protocol-test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  return { component, auth, maintenance, cdr, focus, preview, popup };
}

describe('blank protocol generation modal', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('opens the modal before asking for a reason, excluding retired equipment from all active', () => {
    const { component, maintenance, popup } = setup();
    component.openProtocolConfirmation('all_active');
    expect(component.protocolConfirmationScope).toBe('all_active');
    expect(component.protocolConfirmationCount).toBe(2);
    expect(component.protocolReasonError).toBe('');
    expect(component.errorMessage).toBe('');
    expect(popup).not.toHaveBeenCalled();
    expect(maintenance.generateBlankProtocols).not.toHaveBeenCalled();
  });

  for (const reason of ['', '   ', 'motivo  x', 'x'.repeat(301)]) {
    it(`validates the reason in the modal before opening a PDF (${reason.length} characters)`, async () => {
      const { component, maintenance, focus, popup } = setup();
      component.openProtocolConfirmation('selected');
      component.protocolReason = reason;
      await component.generateBlankProtocols();
      expect(component.protocolReasonError).toContain('10 y 300');
      expect(component.protocolConfirmationScope).toBe('selected');
      expect(component.errorMessage).toBe('');
      expect(focus).toHaveBeenCalled();
      expect(popup).not.toHaveBeenCalled();
      expect(maintenance.generateBlankProtocols).not.toHaveBeenCalled();
    });
  }

  it('clears the field error when corrected and preserves the reason on cancel', async () => {
    const { component } = setup();
    component.openProtocolConfirmation('selected');
    await component.generateBlankProtocols();
    component.protocolReason = '  Contingencia   autorizada  ';
    component.onProtocolReasonChange();
    expect(component.protocolReasonError).toBe('');
    expect(component.protocolReasonLength).toBe(23);
    component.closeProtocolConfirmation();
    component.openProtocolConfirmation('all_active');
    expect(component.protocolReason).toBe('  Contingencia   autorizada  ');
  });

  for (const scope of ['selected', 'all_active'] as const) {
    it(`submits ${scope} with the normalized reason and shows success without clearing filters`, async () => {
      const { component, maintenance, preview, cdr } = setup();
      component.protocolSearchTerm = 'MONITOR';
      component.protocolReason = '  Contingencia   autorizada  ';
      component.openProtocolConfirmation(scope);
      await component.generateBlankProtocols();
      expect(maintenance.generateBlankProtocols).toHaveBeenCalledWith({
        scope, reason: 'Contingencia autorizada', assetCategory: 'biomedical',
        assetIds: scope === 'selected' ? ['asset-1'] : undefined
      });
      expect(preview.location.href).toBe('blob:protocol-test');
      expect(preview.opener).toBeNull();
      expect(component.protocolConfirmationScope).toBeNull();
      expect(component.protocolGenerating).toBe(false);
      expect(component.protocolReason).toBe('');
      expect(component.selectedProtocolAssetCount).toBe(0);
      expect(component.protocolSearchTerm).toBe('MONITOR');
      expect(component.alertMessage).toContain('PMF-123');
      await vi.advanceTimersByTimeAsync(1);
      expect(cdr.detectChanges).toHaveBeenCalled();
    });
  }

  it('keeps the draft and shows backend Blob errors inside the modal', async () => {
    const { component, maintenance, preview } = setup();
    component.openProtocolConfirmation('selected');
    component.protocolReason = 'Contingencia autorizada';
    const errorBody = new Blob();
    // jsdom's Blob does not implement text(), unlike browser Blob responses.
    Object.defineProperty(errorBody, 'text', { value: async () => JSON.stringify({ message: 'Registra tu firma digital.' }) });
    maintenance.generateBlankProtocols.mockRejectedValue({ status: 400, error: errorBody });
    await component.generateBlankProtocols();
    expect(component.protocolGenerationError).toBe('Registra tu firma digital.');
    expect(component.errorMessage).toBe('');
    expect(component.protocolConfirmationScope).toBe('selected');
    expect(component.protocolReason).toBe('Contingencia autorizada');
    expect(component.selectedProtocolAssetCount).toBe(1);
    expect(component.protocolGenerating).toBe(false);
    expect(preview.close).toHaveBeenCalled();
  });

  for (const error of [{ status: 403, error: { message: 'Permiso vencido.' } }, { status: 0 }]) {
    it(`keeps permission/network failures visible and allows closing (${error.status})`, async () => {
      const { component, maintenance } = setup();
      component.openProtocolConfirmation('selected');
      component.protocolReason = 'Contingencia autorizada';
      maintenance.generateBlankProtocols.mockRejectedValue(error);
      await component.generateBlankProtocols();
      expect(component.protocolGenerationError).not.toBe('');
      expect(component.protocolConfirmationScope).toBe('selected');
      expect(component.viewMode).toBe('protocolos_fisicos');
      expect(component.protocolGenerating).toBe(false);
      component.closeProtocolConfirmation();
      expect(component.protocolConfirmationScope).toBeNull();
    });
  }

  it('prevents a batch when permission expires after opening', async () => {
    const { component, auth, maintenance, popup } = setup();
    component.openProtocolConfirmation('selected');
    component.protocolReason = 'Contingencia autorizada';
    auth.hasPermission.mockReturnValue(false);
    await component.generateBlankProtocols();
    expect(component.protocolScopeError).toContain('permiso temporal');
    expect(maintenance.generateBlankProtocols).not.toHaveBeenCalled();
    expect(popup).not.toHaveBeenCalled();
    component.closeProtocolConfirmation();
    expect(component.viewMode).toBe('equipos');
  });

  it('reports oversized and invalid selections in the modal', async () => {
    const { component, maintenance } = setup();
    component.assets = Array.from({ length: 501 }, (_, id) => ({ id: String(id), code: String(id), name: 'Equipo', status: 'operativo' }));
    component.openProtocolConfirmation('all_active');
    expect(component.protocolScopeError).toContain('500 equipos');
    await component.generateBlankProtocols();
    component.openProtocolConfirmation('selected');
    expect(component.protocolScopeError).toContain('ya no están vigentes');
    component.clearProtocolSelection();
    expect(component.protocolScopeError).toContain('al menos un equipo');
    expect(maintenance.generateBlankProtocols).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('');
  });

  it('prevents duplicate generation, cancellation and scope changes while busy', async () => {
    const { component, maintenance } = setup();
    let reject!: (error: unknown) => void;
    maintenance.generateBlankProtocols.mockReturnValue(new Promise((_, no) => { reject = no; }));
    component.protocolReason = 'Contingencia autorizada';
    component.openProtocolConfirmation('selected');
    const pending = component.generateBlankProtocols();
    await component.generateBlankProtocols();
    component.closeProtocolConfirmation();
    const cancel = new Event('cancel', { cancelable: true });
    component.onProtocolDialogCancel(cancel);
    component.openProtocolConfirmation('all_active');
    expect(cancel.defaultPrevented).toBe(true);
    expect(component.protocolConfirmationScope).toBe('selected');
    expect(maintenance.generateBlankProtocols).toHaveBeenCalledTimes(1);
    reject({ status: 0 });
    await pending;
    expect(component.protocolGenerating).toBe(false);
  });

  it('downloads the PDF when the browser blocks the new tab', async () => {
    const { component, popup } = setup();
    popup.mockReturnValue(null);
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    component.protocolReason = 'Contingencia autorizada';
    component.openProtocolConfirmation('selected');
    await component.generateBlankProtocols();
    expect(download).toHaveBeenCalledTimes(1);
    expect(component.protocolConfirmationScope).toBeNull();
    expect(component.alertMessage).toContain('generado');
  });
});
