import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../admin/admin.service';
import { getPublicBase, joinBase } from '../../core/api-base';

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

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss'
})
export class ClientsComponent implements OnInit {
  private readonly publicBase = getPublicBase();
  clients: ClientView[] = [];
  modules: { key: string; name: string; description?: string | null }[] = [];
  clientModules: Record<string, Set<string>> = {};
  searchTerm = '';
  openClientId: string | null = null;
  editingClientId: string | null = null;
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
        email: this.email.trim()
      });
      this.name = '';
      this.nit = '';
      this.city = '';
      this.address = '';
      this.habilitationCode = '';
      this.email = '';
      this.successMessage = 'Cliente creado.';
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
    const current = new Set(this.clientModules[clientId] ?? []);
    if (current.has(moduleKey)) {
      current.delete(moduleKey);
    } else {
      current.add(moduleKey);
    }
    this.clientModules[clientId] = current;
  }

  async saveClientModules(clientId: string): Promise<void> {
    const modules = Array.from(this.clientModules[clientId] ?? []);
    await this.admin.updateClientModules(clientId, modules);
    this.successMessage = 'Módulos actualizados.';
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
    if (!term) return this.clients;
    return this.clients.filter((client) => {
      const hay = `${client.name} ${client.nit} ${client.city} ${client.address ?? ''} ${client.email}`.toLowerCase();
      return hay.includes(term);
    });
  }

  toggleClientOpen(clientId: string): void {
    this.openClientId = this.openClientId === clientId ? null : clientId;
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
