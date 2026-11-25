import { describe, expect, it, vi } from 'vitest';
import { HojasDeVidaComponent } from './hojas-de-vida.component';

describe('HojasDeVidaComponent detail tabs', () => {
  it('reserva la pestaña al hacer clic y espera el PDF completo sin enviar solicitudes duplicadas', async () => {
    let finish!: (blob: Blob) => void;
    const downloadAssetFullPdf = vi.fn(() => new Promise<Blob>(resolve => { finish = resolve; }));
    const preview = { document: { title: '' }, location: { href: '' }, opener: window, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(preview as unknown as Window);
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:complete-history');
    const component = Object.assign(Object.create(HojasDeVidaComponent.prototype), {
      biomed: { downloadAssetFullPdf }, selectedClientId: 'hospital', selectedAssetForModal: { id: 'equipment' },
      cdr: { detectChanges: vi.fn() }, assetPdfLoading: false
    }) as HojasDeVidaComponent;
    const loading = component.openSelectedAssetPdf();
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(component.assetPdfLoading).toBe(true);
    await component.openSelectedAssetPdf();
    expect(downloadAssetFullPdf).toHaveBeenCalledOnce();
    expect(downloadAssetFullPdf).toHaveBeenCalledWith('hospital','equipment');
    finish(new Blob(['%PDF'])); await loading;
    expect(preview.location.href).toBe('blob:complete-history');
    expect(component.assetPdfLoading).toBe(false);
    expect(preview.opener).toBeNull();
    create.mockRestore();vi.restoreAllMocks();
  });

  it('muestra el documento faltante dentro del modal y cierra la pestaña fallida', async () => {
    const close = vi.fn();
    vi.spyOn(window,'open').mockReturnValue({ document: {}, close } as unknown as Window);
    const component = Object.assign(Object.create(HojasDeVidaComponent.prototype), {
      biomed: { downloadAssetFullPdf: vi.fn().mockRejectedValue({ error: { message: 'No se pudo incluir ACTA' } }) },
      selectedClientId: 'hospital', selectedAssetForModal: { id: 'equipment' },
      cdr: { detectChanges: vi.fn() }, assetPdfLoading: false
    }) as HojasDeVidaComponent;
    await component.openSelectedAssetPdf();
    expect(component.assetPdfError).toBe('No se pudo incluir ACTA');
    expect(component.assetPdfLoading).toBe(false);expect(close).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
  it('abre cada seccion desde arriba y conserva la carga de historial y documentos', () => {
    const scrollTo = vi.fn();
    const component = Object.assign(Object.create(HojasDeVidaComponent.prototype), {
      detailScroll: { nativeElement: { scrollTo } },
      assetHistoryItems: [],
      assetHistoryLoading: false,
      archivedAssetDocumentsLoaded: false,
      archivedAssetDocumentsLoading: false,
      loadAssetHistory: vi.fn(),
      loadArchivedAssetDocuments: vi.fn()
    }) as HojasDeVidaComponent;

    component.setDetailModalTab('history');
    expect(component.detailModalTab).toBe('history');
    expect(component.loadAssetHistory).toHaveBeenCalledWith(true);
    component.setDetailModalTab('documents');
    expect(component.loadArchivedAssetDocuments).toHaveBeenCalledOnce();
    component.setDetailModalTab('summary');
    expect(scrollTo).toHaveBeenCalledTimes(3);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
  });
});
