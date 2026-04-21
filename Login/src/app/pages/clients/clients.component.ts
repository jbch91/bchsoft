import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../admin/admin.service';
import { getPublicBase, joinBase } from '../../core/api-base';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import { UserMenuComponent } from '../../shared/user-menu/user-menu.component';

interface ClientView {
  id: string;
  name: string;
  nit: string;
  city: string;
  address: string | null;
  habilitationCode: string | null;
  email: string;
  logoPath: string | null;
  schemaName: string;
}

type ClientTab = 'list' | 'create';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModuleTabsComponent, UserMenuComponent],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss'
})
export class ClientsComponent implements OnInit {
  private readonly publicBase = getPublicBase();
  clients: ClientView[] = [];
  modules: { key: string; name: string; description?: string | null }[] = [];
  clientModules: Record<string, Set<string>> = {};
  searchTerm = '';
  filterCity = 'todos';
  filterModule = 'todos';
  activeClientTab: ClientTab = 'list';
  openClientId: string | null = null;
  editingClientId: string | null = null;
  editingModulesClientId: string | null = null;
  savingModulesClientId: string | null = null;
  moduleDraft = new Set<string>();
  editClient: { name: string; nit: string; city: string; address: string; habilitationCode: string; email: string } = {
    name: '',
    nit: '',
    city: '',
    address: '',
    habilitationCode: '',
    email: ''
  };
  loading = false;
  errorMessage = '';
  successMessage = '';

  name = '';
  nit = '';
  city = '';
  address = '';
  habilitationCode = '';
  email = '';
  logoFile: File | null = null;
  logoPreviewUrl: string | null = null;

  constructor(private readonly admin: AdminService, private readonly cdr: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> {
    await Promise.resolve();
    await this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const modules = await this.admin.listModules();
      this.modules = modules.map((mod) => ({
        key: mod.key,
        name: mod.name,
        description: mod.description
      }));
      const rows = await this.admin.listClients();
      this.clients = rows.map((row) => ({
        id: row.id,
        name: row.name,
        nit: row.nit,
        city: row.city,
        address: row.address ?? null,
        habilitationCode: row.habilitation_code,
        email: row.email,
        logoPath: row.logo_path,
        schemaName: row.schema_name
      }));
      await this.loadAllClientModules();
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron cargar los clientes.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async onCreateClient(): Promise<void> {
    if (!this.name || !this.nit || !this.city || !this.email || !this.address) {
      this.errorMessage = 'Completa los campos obligatorios.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.createClient({
        name: this.name.trim(),
        nit: this.nit.trim(),
        city: this.city.trim(),
        address: this.address.trim(),
        habilitationCode: this.habilitationCode.trim() || undefined,
        email: this.email.trim(),
        logoFile: this.logoFile
      });
      this.name = '';
      this.nit = '';
      this.city = '';
      this.address = '';
      this.habilitationCode = '';
      this.email = '';
      this.clearCreateLogo();
      this.successMessage = 'Cliente creado.';
      this.activeClientTab = 'list';
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo crear el cliente.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  async loadAllClientModules(): Promise<void> {
    const entries = await Promise.all(
      this.clients.map(async (client) => {
        const modules = await this.admin.listClientModules(client.id);
        return [client.id, new Set(modules.filter((m) => m.enabled).map((m) => m.key))] as const;
      })
    );
    this.clientModules = Object.fromEntries(entries);
  }

  toggleClientModule(clientId: string, moduleKey: string): void {
    if (this.editingModulesClientId !== clientId) return;
    if (this.moduleDraft.has(moduleKey)) {
      this.moduleDraft.delete(moduleKey);
    } else {
      this.moduleDraft.add(moduleKey);
    }
  }

  async saveClientModules(clientId: string): Promise<void> {
    const modules = Array.from(this.moduleDraft);
    this.savingModulesClientId = clientId;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.updateClientModules(clientId, modules);
      this.clientModules[clientId] = new Set(modules);
      this.editingModulesClientId = null;
      this.moduleDraft.clear();
      this.successMessage = 'Módulos actualizados.';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron actualizar los módulos del cliente.';
    } finally {
      this.savingModulesClientId = null;
      this.cdr.detectChanges();
    }
  }

  startEditModules(clientId: string): void {
    this.editingModulesClientId = clientId;
    this.moduleDraft = new Set(this.clientModules[clientId] ?? []);
    this.successMessage = '';
    this.errorMessage = '';
  }

  cancelEditModules(): void {
    this.editingModulesClientId = null;
    this.moduleDraft.clear();
  }

  startEditClient(client: ClientView): void {
    this.editingClientId = client.id;
    this.editClient = {
      name: client.name,
      nit: client.nit,
      city: client.city,
      address: client.address ?? '',
      habilitationCode: client.habilitationCode ?? '',
      email: client.email
    };
  }

  cancelEditClient(): void {
    this.editingClientId = null;
  }

  async saveClient(clientId: string): Promise<void> {
    await this.admin.updateClient(clientId, {
      name: this.editClient.name.trim(),
      nit: this.editClient.nit.trim(),
      city: this.editClient.city.trim(),
      address: this.editClient.address.trim(),
      habilitationCode: this.editClient.habilitationCode.trim() || undefined,
      email: this.editClient.email.trim()
    });
    this.editingClientId = null;
    await this.load();
  }

  async removeClient(clientId: string): Promise<void> {
    if (!confirm('¿Eliminar cliente?')) return;
    await this.admin.deleteClient(clientId);
    await this.load();
  }

  get filteredClients(): ClientView[] {
    const term = this.searchTerm.toLowerCase().trim();
    return this.clients.filter((client) => {
      const hay = `${client.name} ${client.nit} ${client.city} ${client.address ?? ''} ${client.email}`.toLowerCase();
      const matchesTerm = !term || hay.includes(term);
      const matchesCity = this.filterCity === 'todos' || client.city === this.filterCity;
      const matchesModule = this.filterModule === 'todos' || this.clientModules[client.id]?.has(this.filterModule);
      return matchesTerm && matchesCity && matchesModule;
    });
  }

  get cityOptions(): string[] {
    return Array.from(new Set(this.clients.map((client) => client.city).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  enabledModulesFor(clientId: string): { key: string; name: string }[] {
    const enabled = this.clientModules[clientId] ?? new Set<string>();
    return this.modules.filter((module) => enabled.has(module.key));
  }

  clearListFilters(): void {
    this.searchTerm = '';
    this.filterCity = 'todos';
    this.filterModule = 'todos';
  }

  setClientTab(tab: ClientTab): void {
    this.activeClientTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    if (tab === 'create') {
      this.cancelEditModules();
      this.editingClientId = null;
    }
  }

  onSelectCreateLogo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.logoFile = file;
    if (this.logoPreviewUrl) {
      URL.revokeObjectURL(this.logoPreviewUrl);
    }
    this.logoPreviewUrl = file ? URL.createObjectURL(file) : null;
  }

  clearCreateLogo(input?: HTMLInputElement): void {
    if (this.logoPreviewUrl) {
      URL.revokeObjectURL(this.logoPreviewUrl);
    }
    this.logoPreviewUrl = null;
    this.logoFile = null;
    if (input) {
      input.value = '';
    }
  }

  toggleClientOpen(clientId: string): void {
    const wasOpen = this.openClientId === clientId;
    this.openClientId = wasOpen ? null : clientId;
    this.cancelEditModules();
    this.editingClientId = null;
  }

  async onUploadLogo(client: ClientView, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) {
      return;
    }

    try {
      const updated = await this.admin.uploadClientLogo(client.id, input.files[0]);
      client.logoPath = updated.logo_path ?? client.logoPath;
      this.successMessage = 'Logo actualizado.';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo actualizar el logo.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  logoUrl(client: ClientView): string | null {
    if (!client.logoPath) {
      return null;
    }
    if (client.logoPath.startsWith('http')) {
      return client.logoPath;
    }
    return joinBase(this.publicBase, client.logoPath);
  }
}
