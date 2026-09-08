import { describe, expect, it, vi } from 'vitest';
import { HojasDeVidaComponent } from './hojas-de-vida.component';

describe('HojasDeVidaComponent detail tabs', () => {
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
