import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NavigationCancel, NavigationEnd, NavigationError, provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { App } from './app';
import { AuthService } from './auth/auth.service';
import { SessionTimeoutService } from './auth/session-timeout.service';

describe('App', () => {
  let events: Subject<NavigationError | NavigationEnd | NavigationCancel>;
  let auth: {
    currentUser: WritableSignal<null>;
    sessionState: WritableSignal<'checking' | 'ready' | 'connection-error'>;
    sessionValidationMessage: WritableSignal<string>;
    isAuthenticated: () => boolean;
    initializeSession: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    events = new Subject();
    sessionStorage.clear();
    auth = {
      currentUser: signal(null),
      sessionState: signal<'checking' | 'ready' | 'connection-error'>('ready'),
      sessionValidationMessage: signal(''),
      isAuthenticated: () => false,
      initializeSession: vi.fn().mockResolvedValue(false)
    };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: SessionTimeoutService, useValue: { start: vi.fn(), stop: vi.fn() } }
      ]
    }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'events', 'get').mockReturnValue(events.asObservable());
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the public outlet without the authenticated shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
    expect(compiled.querySelector('.app-shell')).toBeNull();
  });

  it('muestra una recuperación clara sin destruir el outlet cuando falla la conexión', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const outlet = fixture.nativeElement.querySelector('router-outlet');
    auth.sessionValidationMessage.set('Tus datos de acceso se conservaron.');
    auth.sessionState.set('connection-error');
    fixture.detectChanges();

    const gate = fixture.nativeElement.querySelector('.session-gate') as HTMLElement;
    expect(gate.textContent).toContain('No pudimos conectar con el servidor');
    expect(gate.textContent).toContain('se conservaron');
    expect(fixture.nativeElement.querySelector('router-outlet')).toBe(outlet);
  });

  it.each([
    new TypeError('Failed to fetch dynamically imported module: https://example.test/chunk-OLD.js'),
    new TypeError('error loading dynamically imported module: https://example.test/chunk-OLD.js'),
    new TypeError('Importing a module script failed.'),
    new Error('Loading chunk 12 failed.'),
    'Failed to fetch dynamically imported module: /chunk-OLD.js'
  ])('recarga una sola vez cuando detecta un módulo desactualizado (%s)', async (error) => {
    const fixture = TestBed.createComponent(App);
    const reload = vi.spyOn(fixture.componentInstance, 'reloadApplication').mockImplementation(() => {});
    await fixture.whenStable();
    events.next(new NavigationError(1, '/cronogramas', error));
    await fixture.whenStable();
    expect(reload).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('inbi_chunk_reload_v1')).toContain('/cronogramas');
  });

  it('evita ciclos de recarga y muestra una recuperación manual si el módulo vuelve a fallar', async () => {
    sessionStorage.setItem(
      'inbi_chunk_reload_v1',
      JSON.stringify({ route: '/cronogramas', createdAt: Date.now() })
    );
    const fixture = TestBed.createComponent(App);
    const reload = vi.spyOn(fixture.componentInstance, 'reloadApplication').mockImplementation(() => {});
    await fixture.whenStable();
    events.next(new NavigationError(1, '/cronogramas', new Error('Loading chunk 12 failed.')));
    await fixture.whenStable();
    const notice = fixture.nativeElement.querySelector('.module-load-notice') as HTMLElement;
    expect(notice.getAttribute('role')).toBe('alert');
    expect(notice.textContent).toContain('Guarda los cambios pendientes');
    expect(reload).not.toHaveBeenCalled();
    notice.querySelector('button')!.click();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('no confunde denegaciones de acceso ni errores del componente con módulos desactualizados', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    for (const error of [new Error('Forbidden'), new TypeError('Workbook is not a constructor'), { status: 403 }, null]) {
      events.next(new NavigationError(1, '/calibraciones', error));
      await fixture.whenStable();
      expect(fixture.componentInstance.moduleLoadFailed()).toBe(false);
    }
    events.next(new NavigationCancel(2, '/calibraciones', 'Guard rejected'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.module-load-notice')).toBeNull();
  });

  it('retira el aviso al navegar correctamente y no elimina el contenido de la página', async () => {
    const fixture = TestBed.createComponent(App);
    vi.spyOn(fixture.componentInstance, 'reloadApplication').mockImplementation(() => {});
    await fixture.whenStable();
    const outlet = fixture.nativeElement.querySelector('router-outlet');
    events.next(new NavigationError(1, '/calibraciones', new Error('Importing a module script failed.')));
    await fixture.whenStable();
    expect(fixture.componentInstance.moduleLoadFailed()).toBe(true);
    expect(fixture.nativeElement.querySelector('router-outlet')).toBe(outlet);
    events.next(new NavigationEnd(2, '/login', '/login'));
    await fixture.whenStable();
    expect(fixture.componentInstance.moduleLoadFailed()).toBe(false);
    expect(fixture.nativeElement.querySelector('.module-load-notice')).toBeNull();
  });

  it('deja de escuchar errores cuando se destruye la aplicación', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.destroy();
    events.next(new NavigationError(1, '/cronogramas', new Error('Importing a module script failed.')));
    expect(fixture.componentInstance.moduleLoadFailed()).toBe(false);
  });
});
