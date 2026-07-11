import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { BiomedService } from '../../biomed/biomed.service';
import { LocationsManagementComponent } from './locations-management.component';

describe('LocationsManagementComponent', () => {
  const biomedStub = {
    listSites: () => Promise.resolve([
      { id: 'site-1', name: 'Sede principal', address: 'Dirección' }
    ]),
    listAreas: () => Promise.resolve([
      { id: 'area-1', name: 'Urgencias', site_id: 'site-1' }
    ]),
    listLocations: () => Promise.resolve([
      { id: 'location-1', name: 'Sala 1', area_id: 'area-1' }
    ])
  };
  const authUser = {
    id: 'user-1',
    username: 'ingeniero',
    displayName: 'Ingeniero Biomédico',
    clientId: 'client-1',
    role: 'ingeniero_biomedico',
    roles: ['ingeniero_biomedico'],
    permissions: ['areas:manage']
  };
  const authStub = {
    currentUser: () => authUser,
    hasRole: (roles: string | readonly string[]) => {
      const required = Array.isArray(roles) ? roles : [roles];
      return required.some((role) => authUser.roles.includes(role));
    },
    hasPermission: (permissions: string | readonly string[]) => {
      const required = Array.isArray(permissions) ? permissions : [permissions];
      return required.every((permission) => authUser.permissions.includes(permission));
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationsManagementComponent],
      providers: [
        provideRouter([]),
        { provide: BiomedService, useValue: biomedStub },
        { provide: AuthService, useValue: authStub }
      ]
    }).compileComponents();
  });

  it('abre el modal para crear una ubicación', async () => {
    const fixture = TestBed.createComponent(LocationsManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.management-actions button')
    );
    const createLocationButton = buttons.find((button) =>
      button.textContent?.trim() === 'Crear ubicación'
    );

    expect(createLocationButton).toBeTruthy();
    createLocationButton!.click();
    fixture.detectChanges();

    expect(element.querySelector('.editor-modal')).not.toBeNull();
    expect(element.querySelector('select[name="editorArea"]')).not.toBeNull();
  });
});
