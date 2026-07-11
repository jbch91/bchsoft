import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { BiomedService } from '../../biomed/biomed.service';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';

interface SiteView {
  id: string;
  name: string;
  address: string | null;
}

interface AreaView {
  id: string;
  name: string;
  siteId: string | null;
}

interface LocationView {
  id: string;
  name: string;
  areaId: string | null;
}

type EditorKind = 'site' | 'area' | 'location';

interface EditorState {
  kind: EditorKind;
  mode: 'create' | 'edit';
  id: string | null;
  name: string;
  address: string;
  siteId: string;
  areaId: string;
}

@Component({
  selector: 'app-locations-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ModuleTabsComponent],
  templateUrl: './locations-management.component.html',
  styleUrl: './locations-management.component.scss'
})
export class LocationsManagementComponent implements OnInit {
  sites: SiteView[] = [];
  areas: AreaView[] = [];
  locations: LocationView[] = [];
  searchTerm = '';
  loading = false;
  saving = false;
  deletingId: string | null = null;
  errorMessage = '';
  successMessage = '';
  editor: EditorState | null = null;

  constructor(
    private readonly biomed: BiomedService,
    private readonly auth: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadCatalog();
  }

  @HostListener('document:keydown.escape')
  closeEditorOnEscape(): void {
    this.closeEditor();
  }

  get visibleSites(): SiteView[] {
    const term = this.normalize(this.searchTerm);
    if (!term) return this.sites;
    return this.sites.filter((site) => {
      if (this.normalize(`${site.name} ${site.address ?? ''}`).includes(term)) return true;
      return this.areasForSite(site.id).some((area) => {
        if (this.normalize(area.name).includes(term)) return true;
        return this.locationsForArea(area.id)
          .some((location) => this.normalize(location.name).includes(term));
      });
    });
  }

  get areasWithoutSite(): AreaView[] {
    return this.areas.filter((area) => !area.siteId);
  }

  get locationsWithoutArea(): LocationView[] {
    return this.locations.filter((location) => !location.areaId);
  }

  areasForSite(siteId: string): AreaView[] {
    return this.areas.filter((area) => area.siteId === siteId);
  }

  visibleAreasForSite(site: SiteView): AreaView[] {
    const areas = this.areasForSite(site.id);
    const term = this.normalize(this.searchTerm);
    if (!term || this.normalize(`${site.name} ${site.address ?? ''}`).includes(term)) return areas;
    return areas.filter((area) =>
      this.normalize(area.name).includes(term)
      || this.locationsForArea(area.id).some((location) => this.normalize(location.name).includes(term))
    );
  }

  locationsForArea(areaId: string): LocationView[] {
    return this.locations.filter((location) => location.areaId === areaId);
  }

  areasForEditorSite(): AreaView[] {
    return this.editor?.siteId ? this.areasForSite(this.editor.siteId) : [];
  }

  openCreate(kind: EditorKind): void {
    this.clearMessages();
    if (kind === 'area' && !this.sites.length) {
      this.errorMessage = 'Primero debes crear una sede.';
      return;
    }
    if (kind === 'location' && !this.areas.length) {
      this.errorMessage = 'Primero debes crear un área.';
      return;
    }

    const firstArea = this.areas[0] ?? null;
    this.editor = {
      kind,
      mode: 'create',
      id: null,
      name: '',
      address: '',
      siteId: kind === 'location' ? firstArea?.siteId ?? '' : this.sites[0]?.id ?? '',
      areaId: kind === 'location' ? firstArea?.id ?? '' : ''
    };
  }

  openEditSite(site: SiteView): void {
    this.clearMessages();
    this.editor = {
      kind: 'site',
      mode: 'edit',
      id: site.id,
      name: site.name,
      address: site.address ?? '',
      siteId: site.id,
      areaId: ''
    };
  }

  openEditArea(area: AreaView): void {
    this.clearMessages();
    this.editor = {
      kind: 'area',
      mode: 'edit',
      id: area.id,
      name: area.name,
      address: '',
      siteId: area.siteId ?? this.sites[0]?.id ?? '',
      areaId: area.id
    };
  }

  openEditLocation(location: LocationView): void {
    this.clearMessages();
    const area = this.areas.find((item) => item.id === location.areaId) ?? null;
    this.editor = {
      kind: 'location',
      mode: 'edit',
      id: location.id,
      name: location.name,
      address: '',
      siteId: area?.siteId ?? this.sites[0]?.id ?? '',
      areaId: area?.id ?? ''
    };
  }

  closeEditor(): void {
    if (this.saving) return;
    this.editor = null;
  }

  onEditorSiteChange(): void {
    if (!this.editor || this.editor.kind !== 'location') return;
    const areaOptions = this.areasForSite(this.editor.siteId);
    if (!areaOptions.some((area) => area.id === this.editor?.areaId)) {
      this.editor.areaId = areaOptions[0]?.id ?? '';
    }
  }

  editorTitle(): string {
    if (!this.editor) return '';
    const labels: Record<EditorKind, string> = {
      site: 'sede',
      area: 'área',
      location: 'ubicación'
    };
    return `${this.editor.mode === 'create' ? 'Crear' : 'Editar'} ${labels[this.editor.kind]}`;
  }

  async saveEditor(): Promise<void> {
    const editor = this.editor;
    const clientId = this.clientId();
    if (!editor || !clientId || this.saving) return;

    const name = editor.name.trim();
    if (!name) {
      this.errorMessage = 'El nombre es obligatorio.';
      return;
    }
    if (editor.kind !== 'site' && !editor.siteId) {
      this.errorMessage = 'Selecciona una sede.';
      return;
    }
    if (editor.kind === 'location' && !editor.areaId) {
      this.errorMessage = 'Selecciona un área.';
      return;
    }
    if (this.hasDuplicate(editor, name)) {
      this.errorMessage = `Ya existe ${this.indefiniteArticle(editor.kind)} ${name} en el nivel seleccionado.`;
      return;
    }

    this.saving = true;
    this.clearMessages();
    try {
      if (editor.kind === 'site') {
        if (editor.mode === 'create') {
          await this.biomed.createSite(clientId, name, editor.address.trim() || undefined);
        } else {
          await this.biomed.updateSite(clientId, editor.id!, {
            name,
            address: editor.address.trim() || null
          });
        }
      } else if (editor.kind === 'area') {
        if (editor.mode === 'create') {
          await this.biomed.createArea(clientId, name, editor.siteId);
        } else {
          await this.biomed.updateArea(clientId, editor.id!, name, editor.siteId);
        }
      } else if (editor.mode === 'create') {
        await this.biomed.createLocation(clientId, editor.areaId, name);
      } else {
        await this.biomed.updateLocation(clientId, editor.id!, {
          name,
          areaId: editor.areaId
        });
      }

      const action = editor.mode === 'create' ? 'creada' : 'actualizada';
      const noun = editor.kind === 'site' ? 'Sede' : editor.kind === 'area' ? 'Área' : 'Ubicación';
      this.editor = null;
      await this.loadCatalog(false);
      this.successMessage = `${noun} ${action} correctamente.`;
    } catch (error) {
      this.errorMessage = this.readApiError(error, 'No se pudo guardar el cambio.');
    } finally {
      this.saving = false;
    }
  }

  async deleteSite(site: SiteView): Promise<void> {
    if (!window.confirm(`¿Eliminar la sede "${site.name}"?`)) return;
    await this.deleteCatalogItem('site', site.id);
  }

  async deleteArea(area: AreaView): Promise<void> {
    if (!window.confirm(`¿Eliminar el área "${area.name}"?`)) return;
    await this.deleteCatalogItem('area', area.id);
  }

  async deleteLocation(location: LocationView): Promise<void> {
    if (!window.confirm(`¿Eliminar la ubicación "${location.name}"?`)) return;
    await this.deleteCatalogItem('location', location.id);
  }

  trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  private async loadCatalog(clearFeedback = true): Promise<void> {
    const clientId = this.clientId();
    if (!clientId) {
      this.errorMessage = 'La cuenta no tiene un cliente asignado.';
      return;
    }

    this.loading = true;
    if (clearFeedback) this.clearMessages();
    try {
      const [sites, areas, locations] = await Promise.all([
        this.biomed.listSites(clientId),
        this.biomed.listAreas(clientId),
        this.biomed.listLocations(clientId)
      ]);
      this.sites = sites
        .map((site) => ({ id: site.id, name: site.name, address: site.address ?? null }))
        .sort((left, right) => left.name.localeCompare(right.name, 'es'));
      this.areas = areas
        .map((area) => ({ id: area.id, name: area.name, siteId: area.site_id ?? null }))
        .sort((left, right) => left.name.localeCompare(right.name, 'es'));
      this.locations = locations
        .map((location) => ({ id: location.id, name: location.name, areaId: location.area_id ?? null }))
        .sort((left, right) => left.name.localeCompare(right.name, 'es'));
    } catch (error) {
      this.errorMessage = this.readApiError(error, 'No se pudieron cargar las sedes, áreas y ubicaciones.');
    } finally {
      this.loading = false;
    }
  }

  private async deleteCatalogItem(kind: EditorKind, id: string): Promise<void> {
    const clientId = this.clientId();
    if (!clientId || this.deletingId) return;

    this.deletingId = id;
    this.clearMessages();
    try {
      if (kind === 'site') await this.biomed.deleteSite(clientId, id);
      if (kind === 'area') await this.biomed.deleteArea(clientId, id);
      if (kind === 'location') await this.biomed.deleteLocation(clientId, id);
      await this.loadCatalog(false);
      const labels: Record<EditorKind, string> = {
        site: 'Sede eliminada correctamente.',
        area: 'Área eliminada correctamente.',
        location: 'Ubicación eliminada correctamente.'
      };
      this.successMessage = labels[kind];
    } catch (error) {
      this.errorMessage = this.readApiError(
        error,
        'No se puede eliminar porque tiene información o equipos asociados.'
      );
    } finally {
      this.deletingId = null;
    }
  }

  private hasDuplicate(editor: EditorState, name: string): boolean {
    const normalizedName = this.normalize(name);
    if (editor.kind === 'site') {
      return this.sites.some((site) => site.id !== editor.id && this.normalize(site.name) === normalizedName);
    }
    if (editor.kind === 'area') {
      return this.areas.some((area) =>
        area.id !== editor.id
        && area.siteId === editor.siteId
        && this.normalize(area.name) === normalizedName
      );
    }
    return this.locations.some((location) =>
      location.id !== editor.id
      && location.areaId === editor.areaId
      && this.normalize(location.name) === normalizedName
    );
  }

  private clientId(): string | null {
    return this.auth.currentUser()?.clientId ?? null;
  }

  private indefiniteArticle(kind: EditorKind): string {
    return kind === 'site' ? 'una sede llamada' : kind === 'area' ? 'un área llamada' : 'una ubicación llamada';
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private readApiError(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error && 'error' in error) {
      const response = (error as { error?: { message?: string } }).error;
      if (response?.message) return response.message;
    }
    return fallback;
  }
}
