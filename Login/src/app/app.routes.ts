import { Routes } from '@angular/router';
import { accessGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [accessGuard]
  },
  {
    path: 'administracion-saas',
    loadComponent: () => import('./pages/clients/clients.component').then((m) => m.ClientsComponent),
    canActivate: [accessGuard],
    data: {
      permissionsAny: [
        'clients:manage',
        'saas:access',
        'saas:clients:view',
        'saas:clients:update',
        'saas:subscriptions:manage',
        'saas:plans:manage',
        'saas:client_admins:reset_password'
      ]
    }
  },
  {
    path: 'clientes',
    loadComponent: () => import('./pages/clients/clients.component').then((m) => m.ClientsComponent),
    canActivate: [accessGuard],
    data: { roles: ['superuser'], permissions: ['clients:manage'] }
  },
  {
    path: 'clientes/nuevo',
    loadComponent: () => import('./pages/clients-create/clients-create.component').then((m) => m.ClientsCreateComponent),
    canActivate: [accessGuard],
    data: { roles: ['superuser'], permissions: ['clients:create'] }
  },
  {
    path: 'clientes/administrar',
    loadComponent: () => import('./pages/clients-manage/clients-manage.component').then((m) => m.ClientsManageComponent),
    canActivate: [accessGuard],
    data: { roles: ['superuser'], permissions: ['clients:manage'] }
  },
  {
    path: 'reportes',
    loadComponent: () => import('./pages/reports/reports.component').then((m) => m.ReportsComponent),
    canActivate: [accessGuard],
    data: { permissions: ['reports:view'] }
  },
  {
    path: 'usuarios',
    loadComponent: () => import('./pages/users/users.component').then((m) => m.UsersComponent),
    canActivate: [accessGuard],
    data: { permissions: ['users:manage'] }
  },
  {
    path: 'roles-permisos',
    loadComponent: () => import('./pages/users/users.component').then((m) => m.UsersComponent),
    canActivate: [accessGuard],
    data: { permissions: ['users:manage'] }
  },
  {
    path: 'auditoria',
    loadComponent: () => import('./pages/audit/audit.component').then((m) => m.AuditComponent),
    canActivate: [accessGuard],
    data: { permissionsAny: ['users:manage', 'audit:client:view', 'saas:audit:view'] }
  },
  {
    path: 'hojas-de-vida',
    loadComponent: () => import('./pages/hojas-de-vida/hojas-de-vida.component').then((m) => m.HojasDeVidaComponent),
    canActivate: [accessGuard],
    data: { suiteKey: 'biomedico', moduleKey: 'hojas_de_vida', permissionsAny: ['hb:create', 'hb:view', 'read:all'] }
  },
  {
    path: 'inventario',
    loadComponent: () => import('./pages/inventario/inventario.component').then((m) => m.InventarioComponent),
    canActivate: [accessGuard],
    data: { suiteKey: 'biomedico', moduleKey: 'inventario', permissionsAny: ['hb:create', 'hb:view', 'read:all'] }
  },
  {
    path: 'guias-rapidas',
    loadComponent: () => import('./pages/quick-guides/quick-guides.component').then((m) => m.QuickGuidesComponent),
    canActivate: [accessGuard],
    data: { suiteKey: 'biomedico', moduleKey: 'guias_rapidas', permissionsAny: ['quick_guides:view', 'quick_guides:create', 'quick_guides:edit', 'quick_guides:approve', 'quick_guides:delete', 'hb:view', 'read:all'] }
  },
  {
    path: 'mantenimiento',
    loadComponent: () => import('./pages/maintenance/maintenance.component').then((m) => m.MaintenanceComponent),
    canActivate: [accessGuard],
    data: { suiteKey: 'biomedico', moduleKey: 'reportes_mantenimiento', permissionsAny: ['maintenance:request:create', 'maintenance:report:create', 'maintenance:report:sign', 'read:all'] }
  },
  {
    path: 'cronogramas',
    loadComponent: () => import('./pages/cronogramas/cronogramas.component').then((m) => m.CronogramasComponent),
    canActivate: [accessGuard],
    data: { suiteKey: 'biomedico', moduleKey: 'cronogramas', permissionsAny: ['schedules:manage'] }
  },
  {
    path: 'calibraciones',
    loadComponent: () => import('./pages/calibraciones/calibraciones.component').then((m) => m.CalibracionesComponent),
    canActivate: [accessGuard],
    data: { suiteKey: 'biomedico', moduleKey: 'calibraciones', permissionsAny: ['calibration:schedule:manage', 'calibration:report:upload', 'read:all'] }
  },
  {
    path: 'odontologia',
    loadComponent: () => import('./pages/odontologia/odontologia.component').then((m) => m.OdontologiaComponent),
    canActivate: [accessGuard],
    data: {
      suiteKey: 'odontologico',
      moduleKey: 'odontologia',
      permissionsAny: [
        'software:odontologico:access',
        'odontology:access',
        'odontology:patients:manage',
        'odontology:patients:import',
        'odontology:clinical_records:manage',
        'odontology:appointments:manage',
        'odontology:settings:manage',
        'odontology:odontogram:manage',
        'odontology:periodontogram:manage',
        'odontology:consents:manage',
        'odontology:treatment_plans:manage',
        'odontology:attachments:manage',
        'odontology:inventory:manage',
        'odontology:sterilization:manage',
        'odontology:payments:manage',
        'odontology:financial:view',
        'odontology:prescriptions:manage',
        'odontology:documents:manage',
        'odontology:reports:view'
      ]
    }
  },
  {
    path: 'no-autorizado',
    loadComponent: () => import('./pages/not-authorized/not-authorized.component').then((m) => m.NotAuthorizedComponent)
  },
  { path: '**', redirectTo: 'login' }
];
