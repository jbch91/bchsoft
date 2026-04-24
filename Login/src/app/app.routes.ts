import { Routes } from '@angular/router';
import { accessGuard } from './auth/auth.guard';
import { LoginComponent } from './auth/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ClientsComponent } from './pages/clients/clients.component';
import { ClientsCreateComponent } from './pages/clients-create/clients-create.component';
import { ClientsManageComponent } from './pages/clients-manage/clients-manage.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { NotAuthorizedComponent } from './pages/not-authorized/not-authorized.component';
import { UsersComponent } from './pages/users/users.component';
import { AuditComponent } from './pages/audit/audit.component';
import { HojasDeVidaComponent } from './pages/hojas-de-vida/hojas-de-vida.component';
import { InventarioComponent } from './pages/inventario/inventario.component';
import { MaintenanceComponent } from './pages/maintenance/maintenance.component';
import { CronogramasComponent } from './pages/cronogramas/cronogramas.component';
import { CalibracionesComponent } from './pages/calibraciones/calibraciones.component';
import { QuickGuidesComponent } from './pages/quick-guides/quick-guides.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [accessGuard]
  },
  {
    path: 'clientes',
    component: ClientsComponent,
    canActivate: [accessGuard],
    data: { permissions: ['clients:manage'] }
  },
  {
    path: 'clientes/nuevo',
    component: ClientsCreateComponent,
    canActivate: [accessGuard],
    data: { permissions: ['clients:create'] }
  },
  {
    path: 'clientes/administrar',
    component: ClientsManageComponent,
    canActivate: [accessGuard],
    data: { permissions: ['clients:manage'] }
  },
  {
    path: 'reportes',
    component: ReportsComponent,
    canActivate: [accessGuard],
    data: { permissions: ['reports:view'] }
  },
  {
    path: 'usuarios',
    component: UsersComponent,
    canActivate: [accessGuard],
    data: { permissions: ['users:manage'] }
  },
  {
    path: 'auditoria',
    component: AuditComponent,
    canActivate: [accessGuard],
    data: { permissions: ['users:manage'] }
  },
  {
    path: 'hojas-de-vida',
    component: HojasDeVidaComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['hb:create', 'hb:view', 'read:all'] }
  },
  {
    path: 'inventario',
    component: InventarioComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['hb:create', 'hb:view', 'read:all'] }
  },
  {
    path: 'guias-rapidas',
    component: QuickGuidesComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['quick_guides:view', 'quick_guides:create', 'quick_guides:edit', 'quick_guides:approve', 'quick_guides:delete', 'hb:view', 'read:all'] }
  },
  {
    path: 'mantenimiento',
    component: MaintenanceComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['maintenance:request:create', 'maintenance:report:create', 'maintenance:report:sign', 'read:all'] }
  },
  {
    path: 'cronogramas',
    component: CronogramasComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['schedules:manage'] }
  },
  {
    path: 'calibraciones',
    component: CalibracionesComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['calibration:schedule:manage', 'calibration:report:upload', 'read:all'] }
  },
  { path: 'no-autorizado', component: NotAuthorizedComponent },
  { path: '**', redirectTo: 'login' }
];
