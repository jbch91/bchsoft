import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { BiomedService } from '../../biomed/biomed.service';
import { QuickGuideDto, QuickGuidesService } from '../../quick-guides/quick-guides.service';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import { QuickGuidesComponent } from './quick-guides.component';

const guide = (overrides: Partial<QuickGuideDto> = {}): QuickGuideDto => ({
  id: 'guide-1', client_id: 'client-1', document_code: 'GRU-MINDRAY-UMEC12', version: '1.0',
  equipment_name: 'MONITOR DE SIGNOS VITALES', equipment_type: 'Equipo electromédico',
  brand: 'MINDRAY', model: 'UMEC 12', status: 'aprobada', intended_use: null,
  responsible_use: 'Personal asistencial del área', placement_notes: null,
  prerequisites: 'Verificar la conexión de los accesorios.', startup_steps: 'Encender el equipo.',
  shutdown_steps: 'Apagar el equipo.', basic_operation: 'Seleccionar los parámetros indicados.',
  alarms: 'Comprobar los límites de alarma.', cleaning_disinfection: 'Limpiar después del uso.',
  emergency_actions: 'Suspender el uso y reportar la falla.', support_contact: 'Ingeniero biomédico',
  visual_notes: null, visual_path: null, created_at: '2026-08-01T12:00:00Z',
  updated_at: '2026-08-30T12:00:00Z', updated_by_name: 'Ingeniero de prueba', asset_count: 4,
  ...overrides
});

function render(fixture: ComponentFixture<QuickGuidesComponent>): void {
  fixture.changeDetectorRef.markForCheck();
  fixture.detectChanges();
}

async function createFixture(permissions: string[] = []) {
  vi.spyOn(QuickGuidesComponent.prototype, 'init').mockResolvedValue();
  const auth = {
    currentUser: () => ({ id: 'user-1', clientId: 'client-1', role: 'responsable_area' }),
    hasRole: () => false,
    hasPermission: (permission: string) => permissions.includes(permission)
  };
  await TestBed.configureTestingModule({
    imports: [QuickGuidesComponent],
    providers: [
      { provide: QuickGuidesService, useValue: {} },
      { provide: AdminService, useValue: {} },
      { provide: AuthService, useValue: auth },
      { provide: BiomedService, useValue: {} },
      { provide: HttpClient, useValue: {} }
    ]
  }).overrideComponent(QuickGuidesComponent, {
    remove: { imports: [ModuleTabsComponent] },
    add: { schemas: [NO_ERRORS_SCHEMA] }
  }).compileComponents();
  const fixture = TestBed.createComponent(QuickGuidesComponent);
  const component = fixture.componentInstance;
  component.clientsLoading = false;
  component.selectedClientId = 'client-1';
  component.guides = [guide(), guide({ id: 'guide-2', equipment_name: 'BOMBA DE INFUSIÓN', brand: 'B BRAUN', model: 'INFUSOMAT SPACE', document_code: 'GRU-BBRAUN-SPACE' })];
  render(fixture);
  await fixture.whenStable();
  return { fixture, component, element: fixture.nativeElement as HTMLElement };
}

afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});

describe('QuickGuidesComponent presentation', () => {
  it('conserva la consulta en lista y oculta acciones de escritura sin permisos', async () => {
    const { fixture, component, element } = await createFixture();
    expect(element.querySelector('#guide-page-title')?.textContent).toBe('Guías rápidas de uso');
    expect(element.querySelectorAll('thead th[scope="col"]')).toHaveLength(5);
    expect(element.querySelectorAll('.guide-row')).toHaveLength(2);
    expect(element.querySelector('.guide-client-picker')).toBeNull();
    expect(element.querySelector('.guide-primary')).toBeNull();
    expect(element.querySelectorAll('.guide-row-actions .guide-icon-button')).toHaveLength(0);
    expect(element.querySelector('.guide-table')?.textContent).toContain('UMEC 12');
    const openPdf = vi.spyOn(component, 'openPdf').mockResolvedValue();
    element.querySelector<HTMLButtonElement>('.guide-pdf')!.click();
    render(fixture);
    expect(openPdf).toHaveBeenCalledWith(component.guides[0]);
  });

  it('filtra por marca desde la búsqueda y permite limpiarla sin perder la lista', async () => {
    const { fixture, component, element } = await createFixture();
    const search = element.querySelector<HTMLInputElement>('.guide-search input')!;
    search.value = 'mindray';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    render(fixture);
    expect(component.searchTerm).toBe('mindray');
    expect(element.querySelectorAll('.guide-row')).toHaveLength(1);
    expect(element.querySelector('.guide-count')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1 / 2');
    element.querySelector<HTMLButtonElement>('.guide-clear')!.click();
    render(fixture);
    expect(element.querySelectorAll('.guide-row')).toHaveLength(2);
  });

  it('distingue un listado vacío de una búsqueda sin resultados', async () => {
    const { fixture, component, element } = await createFixture();
    component.guides = [];
    render(fixture);
    expect(element.querySelector('[data-state="empty"]')?.textContent).toContain('Aún no hay guías rápidas');
    expect(element.querySelector('.guide-table')).toBeNull();
    component.guides = [guide()];
    component.searchTerm = 'SIN COINCIDENCIAS';
    render(fixture);
    expect(element.querySelector('[data-state="no-results"]')?.textContent).toContain('Sin resultados');
    element.querySelector<HTMLButtonElement>('.guide-empty button')!.click();
    render(fixture);
    expect(element.querySelectorAll('.guide-row')).toHaveLength(1);
  });

  it('mantiene diferenciados carga y error, con una acción para reintentar', async () => {
    const { fixture, component, element } = await createFixture();
    component.loading = true;
    render(fixture);
    expect(element.querySelector('[data-state="loading"]')).not.toBeNull();
    expect(element.querySelector('.guide-list')?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('.guide-table')).toBeNull();
    component.loading = false;
    component.guidesLoadFailed = true;
    component.message = 'Error de carga';
    component.messageType = 'error';
    render(fixture);
    expect(element.querySelector('[data-state="error"]')).not.toBeNull();
    expect(element.querySelector('[data-state="empty"]')).toBeNull();
    expect(element.querySelector('.guide-message')).toBeNull();
    const reload = vi.spyOn(component, 'loadGuides').mockResolvedValue();
    element.querySelector<HTMLButtonElement>('[data-state="error"] button')!.click();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('muestra un solo acceso de creación y preserva los campos y la edición documental', async () => {
    const { fixture, component, element } = await createFixture(['quick_guides:create']);
    expect(element.querySelectorAll('.guide-primary')).toHaveLength(1);
    element.querySelector<HTMLButtonElement>('.guide-primary')!.click();
    render(fixture);
    await fixture.whenStable();
    expect(component.viewMode).toBe('form');
    expect(element.querySelectorAll('.guide-form-section')).toHaveLength(3);
    expect(element.querySelectorAll('[name]')).toHaveLength(16);
    expect(element.querySelectorAll('[required]')).toHaveLength(6);
    expect(element.querySelector<HTMLInputElement>('[name="documentCode"]')!.disabled).toBe(true);
    expect(element.querySelector<HTMLInputElement>('[name="version"]')!.disabled).toBe(true);
    element.querySelector<HTMLButtonElement>('.guide-metadata-edit')!.click();
    render(fixture);
    await fixture.whenStable();
    render(fixture);
    expect(element.querySelector<HTMLInputElement>('[name="documentCode"]')!.disabled).toBe(false);
    expect(element.querySelector<HTMLInputElement>('[name="version"]')!.disabled).toBe(false);
  });

  it('respeta permisos independientes de editar y eliminar, y conserva la búsqueda al volver', async () => {
    const { fixture, component, element } = await createFixture(['quick_guides:edit']);
    expect(element.querySelector('.guide-delete')).toBeNull();
    const editButton = element.querySelector<HTMLButtonElement>('[title="Editar guía"]')!;
    expect(editButton.getAttribute('aria-label')).toContain('MONITOR DE SIGNOS VITALES');
    component.searchTerm = 'MINDRAY';
    editButton.click();
    render(fixture);
    await fixture.whenStable();
    expect(component.editingGuideId).toBe('guide-1');
    expect(element.querySelector<HTMLInputElement>('[name="equipmentName"]')!.value).toBe('MONITOR DE SIGNOS VITALES');
    expect(element.querySelector<HTMLTextAreaElement>('[name="basicOperation"]')!.value).toBe(guide().basic_operation);
    element.querySelector<HTMLButtonElement>('.form-toolbar > button')!.click();
    render(fixture);
    expect(component.viewMode).toBe('list');
    expect(component.searchTerm).toBe('MINDRAY');
    expect(element.querySelectorAll('.guide-row')).toHaveLength(1);
  });

  it('da nombre accesible a las herramientas y bloquea salida y reenvío al guardar', async () => {
    const { fixture, component, element } = await createFixture(['quick_guides:create', 'quick_guides:edit', 'quick_guides:delete']);
    for (const button of element.querySelectorAll<HTMLButtonElement>('.guide-icon-button')) {
      expect(button.getAttribute('aria-label')).toBeTruthy();
      expect(button.title).toBeTruthy();
      expect(button.type).toBe('button');
    }
    component.startCreate();
    component.saving = true;
    render(fixture);
    expect(element.querySelector('.guide-form')?.getAttribute('aria-busy')).toBe('true');
    for (const button of element.querySelectorAll<HTMLButtonElement>('.guide-form-actions button, .form-toolbar > button')) {
      expect(button.disabled).toBe(true);
    }
  });
});

describe('QuickGuidesComponent loading state', () => {
  it('identifica errores del servicio y permite recuperarse sin cambiar de cliente', async () => {
    vi.spyOn(QuickGuidesComponent.prototype, 'init').mockResolvedValue();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = { list: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([guide()]) };
    const component = new QuickGuidesComponent(service as never, {} as never, {} as never, {} as never, { detectChanges: vi.fn() } as never, {} as never);
    component.selectedClientId = 'client-1';
    await component.loadGuides();
    expect(component.guidesLoadFailed).toBe(true);
    expect(component.loading).toBe(false);
    await component.loadGuides();
    expect(component.guidesLoadFailed).toBe(false);
    expect(component.guides).toHaveLength(1);
    expect(service.list).toHaveBeenNthCalledWith(1, 'client-1');
    expect(service.list).toHaveBeenNthCalledWith(2, 'client-1');
  });
});
