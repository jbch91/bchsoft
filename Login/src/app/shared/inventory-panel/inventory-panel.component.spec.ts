import { describe, expect, it, vi } from 'vitest';
import { InventoryPanelComponent, InventoryPanelItem } from './inventory-panel.component';

function createComponent(): InventoryPanelComponent {
  return new InventoryPanelComponent(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { detectChanges: vi.fn() } as never
  );
}

describe('InventoryPanelComponent operational conditions', () => {
  const items: InventoryPanelItem[] = [
    {
      id: 'operational',
      code: 'EQ-001',
      name: 'Monitor',
      brand: 'MARCA A',
      model: 'MODELO A',
      serial: 'SERIE A',
      status: 'operativo'
    },
    {
      id: 'warranty',
      code: 'EQ-002',
      name: 'Desfibrilador',
      brand: 'MARCA B',
      model: 'MODELO B',
      serial: 'SERIE B',
      status: 'operativo',
      acquisitionDate: '2099-01-01',
      warrantyYears: 2
    },
    {
      id: 'spare',
      code: 'EQ-003',
      name: 'Electrocardiógrafo',
      brand: 'MARCA C',
      model: 'MODELO C',
      serial: 'SERIE C',
      status: 'operativo_observacion',
      hasPendingSpare: true
    },
    {
      id: 'out',
      code: 'EQ-004',
      name: 'Ventilador',
      brand: null,
      model: null,
      serial: null,
      status: 'fuera_de_servicio'
    }
  ];

  it('filtra garantía y repuesto dentro del inventario', () => {
    const component = createComponent();
    component.items = items;
    component.showOperationalConditions = true;

    component.filterCondition = 'under_warranty';
    expect(component.filteredItems.map((item) => item.id)).toEqual(['warranty']);

    component.filterCondition = 'pending_spare';
    expect(component.filteredItems.map((item) => item.id)).toEqual(['spare']);
    expect(component.inventoryWarrantyCount).toBe(1);
    expect(component.inventoryPendingSpareCount).toBe(1);
    expect(component.inventoryOutOfServiceCount).toBe(1);
  });

  it('emite el equipo seleccionado para solicitar revisión', () => {
    const component = createComponent();
    const emitted = vi.fn();
    component.requestMaintenance.subscribe(emitted);

    component.requestMaintenance.emit(items[0]);

    expect(emitted).toHaveBeenCalledWith(items[0]);
  });
});
