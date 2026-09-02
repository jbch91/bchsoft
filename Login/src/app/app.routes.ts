import { Routes } from '@angular/router';
import { accessGuard } from './auth/auth.guard';
import {
  BIOMEDICAL_FEATURE_POLICIES,
  BiomedicalFeatureKey
} from './core/biomedical-access-policy';

function biomedicalRouteData(featureKey: BiomedicalFeatureKey) {
  const policy = BIOMEDICAL_FEATURE_POLICIES[featureKey];
  return {
    suiteKey: 'biomedico',
    moduleKey: 'moduleKey' in policy ? policy.moduleKey : undefined,
    permissionsAny: [...policy.permissionsAny],
    excludedRoles: 'excludedRoles' in policy ? [...policy.excludedRoles] : undefined
  };
}

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
    path: 'catalogo-biomedico',
    loadComponent: () =>
      import('./pages/biomedical-catalog-admin/biomedical-catalog-admin.component').then(
        (m) => m.BiomedicalCatalogAdminComponent
      ),
    canActivate: [accessGuard],
    data: {
      platformOnly: true,
      roles: ['superuser', 'admin', 'saas_admin'],
      permissions: ['platform:biomedical_catalog:manage']
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
    data: { ...biomedicalRouteData('hojas_de_vida'), assetCategory: 'biomedical' }
  },
  {
    path: 'hojas-de-vida-industriales',
    loadComponent: () => import('./pages/hojas-de-vida/hojas-de-vida.component').then((m) => m.HojasDeVidaComponent),
    canActivate: [accessGuard],
    data: { ...biomedicalRouteData('hojas_de_vida_industriales'), assetCategory: 'industrial' }
  },
  {
    path: 'inventario',
    loadComponent: () => import('./pages/inventario/inventario.component').then((m) => m.InventarioComponent),
    canActivate: [accessGuard],
    data: biomedicalRouteData('inventario')
  },
  {
    path: 'sedes-areas-ubicaciones',
    loadComponent: () => import('./pages/locations-management/locations-management.component').then((m) => m.LocationsManagementComponent),
    canActivate: [accessGuard],
    data: biomedicalRouteData('sedes_areas_ubicaciones')
  },
  {
    path: 'guias-rapidas',
    loadComponent: () => import('./pages/quick-guides/quick-guides.component').then((m) => m.QuickGuidesComponent),
    canActivate: [accessGuard],
    data: biomedicalRouteData('guias_rapidas')
  },
  {
    path: 'q/:assetId',
    loadComponent: () => import('./pages/asset-qr/asset-qr.component').then((m) => m.AssetQrComponent),
    canActivate: [accessGuard],
    data: biomedicalRouteData('reportes_mantenimiento')
  },
  {
    path: 'mantenimiento',
    loadComponent: () => import('./pages/maintenance/maintenance.component').then((m) => m.MaintenanceComponent),
    canActivate: [accessGuard],
    data: biomedicalRouteData('reportes_mantenimiento')
  },
  {
    path: 'mantenimiento-industrial',
    loadComponent: () => import('./pages/maintenance/maintenance.component').then((m) => m.MaintenanceComponent),
    canActivate: [accessGuard],
    data: {
      ...biomedicalRouteData('reportes_mantenimiento_industrial'),
      assetCategory: 'industrial'
    }
  },
  {
    path: 'cronogramas',
    loadComponent: () => import('./pages/cronogramas/cronogramas.component').then((m) => m.CronogramasComponent),
    canActivate: [accessGuard],
    data: { ...biomedicalRouteData('cronogramas'), assetCategory: 'biomedical' }
  },
  {
    path: 'cronogramas-industriales',
    loadComponent: () => import('./pages/cronogramas/cronogramas.component').then((m) => m.CronogramasComponent),
    canActivate: [accessGuard],
    data: { ...biomedicalRouteData('cronogramas_industriales'), assetCategory: 'industrial' }
  },
  {
    path: 'calibraciones',
    loadComponent: () => import('./pages/calibraciones/calibraciones.component').then((m) => m.CalibracionesComponent),
    canActivate: [accessGuard],
    data: biomedicalRouteData('calibraciones')
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
