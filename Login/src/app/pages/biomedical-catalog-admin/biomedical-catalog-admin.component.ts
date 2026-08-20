import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BiomedicalCatalogAdminService,
  BiomedicalCatalogBrand,
  BiomedicalCatalogEquipment,
  BiomedicalCatalogModel,
  BiomedicalCatalogNode,
  BiomedicalCatalogNodeType,
  BiomedicalCatalogReviewStatus,
  BiomedicalCatalogSyncResult
} from '../../admin/biomedical-catalog-admin.service';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';

type CatalogFilter = 'all' | BiomedicalCatalogReviewStatus;
type CatalogModalMode = 'create' | 'edit' | 'review' | 'merge';

interface ParentOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-biomedical-catalog-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ModuleTabsComponent],
  templateUrl: './biomedical-catalog-admin.component.html',
  styleUrl: './biomedical-catalog-admin.component.scss'
})
export class BiomedicalCatalogAdminComponent implements OnInit {
  catalog: BiomedicalCatalogEquipment[] = [];
  loading = true;
  saving = false;
  search = '';
  statusFilter: CatalogFilter = 'all';
  errorMessage = '';
  successMessage = '';

  readonly expandedEquipment = new Set<string>();
  readonly expandedBrands = new Set<string>();

  modalMode: CatalogModalMode | null = null;
  modalType: BiomedicalCatalogNodeType = 'equipment';
  modalNode: BiomedicalCatalogNode | null = null;
  modalName = '';
  modalParentId = '';
  modalTargetId = '';
  modalNotes = '';
  reviewDecision: 'approve' | 'reject' = 'approve';
  reviewCascade = true;

  constructor(
    private readonly catalogAdmin: BiomedicalCatalogAdminService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadCatalog();
  }

  get filteredCatalog(): BiomedicalCatalogEquipment[] {
    const search = this.search.trim().toLocaleUpperCase('es');
    return this.catalog
      .map((equipment) => {
        const equipmentPath = equipment.name;
        const brands = equipment.brands
          .map((brand) => {
            const brandPath = `${equipment.name} ${brand.name}`;
            const models = brand.models.filter((model) =>
              this.matchesFilters(model, `${brandPath} ${model.name}`, search)
            );
            if (!this.matchesFilters(brand, brandPath, search) && !models.length) return null;
            return { ...brand, models };
          })
          .filter((brand): brand is BiomedicalCatalogBrand => Boolean(brand));
        if (!this.matchesFilters(equipment, equipmentPath, search) && !brands.length) return null;
        return { ...equipment, brands };
      })
      .filter((equipment): equipment is BiomedicalCatalogEquipment => Boolean(equipment));
  }

  get totalEquipment(): number {
    return this.catalog.length;
  }

  get totalBrands(): number {
    return this.catalog.reduce((total, equipment) => total + equipment.brands.length, 0);
  }

  get totalModels(): number {
    return this.catalog.reduce(
      (total, equipment) =>
        total + equipment.brands.reduce((brandTotal, brand) => brandTotal + brand.models.length, 0),
      0
    );
  }

  get pendingCount(): number {
    return this.allNodes().filter((node) => node.reviewStatus === 'pending').length;
  }

  get modalTitle(): string {
    if (this.modalMode === 'merge') return `Fusionar ${this.nodeTypeLabel(this.modalType).toLowerCase()}`;
    if (this.modalMode === 'review') {
      return this.reviewDecision === 'approve' ? 'Aprobar propuesta' : 'Rechazar propuesta';
    }
    const action = this.modalMode === 'create' ? 'Crear' : 'Editar';
    return `${action} ${this.nodeTypeLabel(this.modalType).toLowerCase()}`;
  }

  get parentOptions(): ParentOption[] {
    const canUsePendingParent = this.modalMode === 'edit'
      && this.modalNode?.reviewStatus !== 'approved';
    if (this.modalType === 'brand') {
      return this.catalog
        .filter((equipment) =>
          equipment.isActive
          && (equipment.reviewStatus === 'approved' || canUsePendingParent)
        )
        .map((equipment) => ({ id: equipment.id, label: equipment.name }));
    }
    if (this.modalType === 'model') {
      return this.catalog.flatMap((equipment) =>
        equipment.brands
          .filter((brand) =>
            brand.isActive
            && (brand.reviewStatus === 'approved' || canUsePendingParent)
          )
          .map((brand) => ({ id: brand.id, label: `${equipment.name} / ${brand.name}` }))
      );
    }
    return [];
  }

  get mergeTargets(): ParentOption[] {
    const sourceId = this.modalNode?.id;
    if (this.modalType === 'equipment') {
      return this.catalog
        .filter((equipment) =>
          equipment.id !== sourceId && equipment.reviewStatus === 'approved' && equipment.isActive
        )
        .map((equipment) => ({ id: equipment.id, label: equipment.name }));
    }
    if (this.modalType === 'brand') {
      return this.catalog.flatMap((equipment) =>
        equipment.brands
          .filter((brand) =>
            brand.id !== sourceId && brand.reviewStatus === 'approved' && brand.isActive
          )
          .map((brand) => ({ id: brand.id, label: `${equipment.name} / ${brand.name}` }))
      );
    }
    return this.catalog.flatMap((equipment) =>
      equipment.brands.flatMap((brand) =>
        brand.models
          .filter((model) =>
            model.id !== sourceId && model.reviewStatus === 'approved' && model.isActive
          )
          .map((model) => ({
            id: model.id,
            label: `${equipment.name} / ${brand.name} / ${model.name}`
          }))
      )
    );
  }

  async loadCatalog(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      this.catalog = await this.catalogAdmin.list();
      this.expandPendingBranches();
    } catch (error) {
      this.errorMessage = this.errorText(error, 'No se pudo cargar el catálogo biomédico global.');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  setStatusFilter(filter: CatalogFilter): void {
    this.statusFilter = filter;
  }

  clearFilters(): void {
    this.search = '';
    this.statusFilter = 'all';
  }

  isEquipmentExpanded(equipmentId: string): boolean {
    return this.hasActiveFilters() || this.expandedEquipment.has(equipmentId);
  }

  isBrandExpanded(brandId: string): boolean {
    return this.hasActiveFilters() || this.expandedBrands.has(brandId);
  }

  toggleEquipment(equipmentId: string): void {
    this.toggleSetValue(this.expandedEquipment, equipmentId);
  }

  toggleBrand(brandId: string): void {
    this.toggleSetValue(this.expandedBrands, brandId);
  }

  openCreate(type: BiomedicalCatalogNodeType, parent?: BiomedicalCatalogNode): void {
    this.resetModal();
    this.modalMode = 'create';
    this.modalType = type;
    this.modalParentId = parent?.id || '';
  }

  openEdit(node: BiomedicalCatalogNode): void {
    this.resetModal();
    this.modalMode = 'edit';
    this.modalType = node.type;
    this.modalNode = node;
    this.modalName = node.name;
    this.modalParentId = node.type === 'brand' ? node.equipmentId : node.type === 'model' ? node.brandId : '';
  }

  openReview(node: BiomedicalCatalogNode, decision: 'approve' | 'reject'): void {
    this.resetModal();
    this.modalMode = 'review';
    this.modalType = node.type;
    this.modalNode = node;
    this.reviewDecision = decision;
    this.reviewCascade = decision === 'approve';
  }

  openMerge(node: BiomedicalCatalogNode): void {
    this.resetModal();
    this.modalMode = 'merge';
    this.modalType = node.type;
    this.modalNode = node;
  }

  closeModal(): void {
    if (this.saving) return;
    this.resetModal();
  }

  async saveModal(): Promise<void> {
    if (!this.modalMode || this.saving) return;
    this.errorMessage = '';
    this.successMessage = '';

    if ((this.modalMode === 'create' || this.modalMode === 'edit') && !this.modalName.trim()) {
      this.errorMessage = 'Escribe el nombre del elemento.';
      return;
    }
    if (
      (this.modalMode === 'create' || this.modalMode === 'edit')
      && this.modalType !== 'equipment'
      && !this.modalParentId
    ) {
      this.errorMessage = 'Selecciona el nivel superior del árbol.';
      return;
    }
    if (this.modalMode === 'merge' && !this.modalTargetId) {
      this.errorMessage = 'Selecciona el elemento aprobado que conservarás.';
      return;
    }

    this.saving = true;
    try {
      let sync: BiomedicalCatalogSyncResult | null = null;
      if (this.modalMode === 'create') {
        await this.catalogAdmin.createNode({
          type: this.modalType,
          name: this.modalName.trim(),
          parentId: this.modalType === 'equipment' ? null : this.modalParentId
        });
        this.successMessage = `${this.nodeTypeLabel(this.modalType)} creado y aprobado.`;
      } else if (this.modalMode === 'edit' && this.modalNode) {
        const result = await this.catalogAdmin.updateNode(this.modalType, this.modalNode.id, {
          name: this.modalName.trim(),
          parentId: this.modalType === 'equipment' ? undefined : this.modalParentId
        });
        sync = result.sync;
        this.successMessage = `${this.nodeTypeLabel(this.modalType)} actualizado.`;
      } else if (this.modalMode === 'review' && this.modalNode) {
        const result = await this.catalogAdmin.reviewNode(this.modalType, this.modalNode.id, {
          decision: this.reviewDecision,
          cascade: this.reviewDecision === 'approve' && this.reviewCascade,
          notes: this.modalNotes.trim() || null
        });
        sync = result.sync;
        this.successMessage = this.reviewDecision === 'approve'
          ? 'Propuesta aprobada y publicada en el catálogo.'
          : 'Propuesta rechazada.';
      } else if (this.modalMode === 'merge' && this.modalNode) {
        const result = await this.catalogAdmin.mergeNode(
          this.modalType,
          this.modalNode.id,
          this.modalTargetId
        );
        sync = result.sync;
        this.successMessage = 'Elementos fusionados. Se conservó el destino seleccionado.';
      }
      if (sync && (sync.assets || sync.guides)) {
        this.successMessage += ` Se sincronizaron ${sync.assets} equipo(s) y ${sync.guides} guía(s).`;
      }
      this.resetModal();
      await this.loadCatalog();
    } catch (error) {
      this.errorMessage = this.errorText(error, 'No se pudo completar la operación del catálogo.');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async toggleActive(node: BiomedicalCatalogNode): Promise<void> {
    const action = node.isActive ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Confirmas ${action} ${node.name}?`)) return;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const result = await this.catalogAdmin.updateNode(node.type, node.id, {
        isActive: !node.isActive
      });
      this.successMessage = `${this.nodeTypeLabel(node.type)} ${node.isActive ? 'desactivado' : 'activado'}.`;
      if (result.sync.assets || result.sync.guides) {
        this.successMessage += ` Se sincronizaron ${result.sync.assets} equipo(s) y ${result.sync.guides} guía(s).`;
      }
      await this.loadCatalog();
    } catch (error) {
      this.errorMessage = this.errorText(error, 'No se pudo cambiar el estado del elemento.');
      this.cdr.detectChanges();
    }
  }

  statusLabel(status: BiomedicalCatalogReviewStatus): string {
    return status === 'approved' ? 'Aprobado' : status === 'pending' ? 'Pendiente' : 'Rechazado';
  }

  nodeTypeLabel(type: BiomedicalCatalogNodeType): string {
    return type === 'equipment' ? 'Equipo' : type === 'brand' ? 'Marca' : 'Modelo';
  }

  originLabel(node: BiomedicalCatalogNode): string {
    if (!node.submittedClientName && !node.submittedByName) return 'Creado por plataforma';
    return [node.submittedClientName, node.submittedByName].filter(Boolean).join(' / ');
  }

  formatDate(value: string | null): string {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  trackById(_index: number, item: BiomedicalCatalogNode): string {
    return item.id;
  }

  private matchesFilters(node: BiomedicalCatalogNode, path: string, search: string): boolean {
    const statusMatches = this.statusFilter === 'all' || node.reviewStatus === this.statusFilter;
    const searchMatches = !search || path.toLocaleUpperCase('es').includes(search);
    return statusMatches && searchMatches;
  }

  private hasActiveFilters(): boolean {
    return Boolean(this.search.trim()) || this.statusFilter !== 'all';
  }

  private allNodes(): BiomedicalCatalogNode[] {
    return this.catalog.flatMap((equipment) => [
      equipment,
      ...equipment.brands.flatMap((brand) => [brand, ...brand.models])
    ]);
  }

  private expandPendingBranches(): void {
    for (const equipment of this.catalog) {
      const equipmentHasPending = equipment.reviewStatus === 'pending'
        || equipment.brands.some(
          (brand) => brand.reviewStatus === 'pending' || brand.models.some((model) => model.reviewStatus === 'pending')
        );
      if (equipmentHasPending) this.expandedEquipment.add(equipment.id);
      for (const brand of equipment.brands) {
        if (brand.reviewStatus === 'pending' || brand.models.some((model) => model.reviewStatus === 'pending')) {
          this.expandedBrands.add(brand.id);
        }
      }
    }
  }

  private toggleSetValue(values: Set<string>, id: string): void {
    if (values.has(id)) values.delete(id);
    else values.add(id);
  }

  private resetModal(): void {
    this.modalMode = null;
    this.modalType = 'equipment';
    this.modalNode = null;
    this.modalName = '';
    this.modalParentId = '';
    this.modalTargetId = '';
    this.modalNotes = '';
    this.reviewDecision = 'approve';
    this.reviewCascade = true;
  }

  private errorText(error: unknown, fallback: string): string {
    const candidate = error as { error?: { message?: string }; message?: string };
    return candidate?.error?.message || candidate?.message || fallback;
  }
}
