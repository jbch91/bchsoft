import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MaintenanceService } from './maintenance.service';

describe('maintenance signature HTTP lifecycle', () => {
  let service: MaintenanceService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MaintenanceService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MaintenanceService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.useRealTimers(); TestBed.resetTestingModule(); });

  it('returns confirmation from the server without a second POST', async () => {
    const pending = service.signReport('report-1');
    const req = http.expectOne((r) => r.url.endsWith('/maintenance/reports/report-1/sign'));
    expect(req.request.method).toBe('POST');
    const response = { reportId: 'report-1', signed_by_me: true, is_fully_signed: true };
    req.flush(response);
    expect(await pending).toEqual(response);
  });

  it('bounds a stalled signing request and never retries it automatically', async () => {
    vi.useFakeTimers();
    const pending = service.signReport('report-1');
    const rejected = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    const req = http.expectOne((r) => r.url.endsWith('/sign'));
    await vi.advanceTimersByTimeAsync(30001);
    await rejected;
    expect(req.cancelled).toBe(true);
    http.expectNone((r) => r.method === 'POST');
  });

  it('bounds the read used to reconcile a lost signing response', async () => {
    vi.useFakeTimers();
    const pending = service.listReports('client-1', { assetId: 'asset-1' });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    const req = http.expectOne((r) => r.url.includes('/maintenance/reports/client-1'));
    expect(req.request.url).toContain('assetId=asset-1');
    await vi.advanceTimersByTimeAsync(20001);
    await rejected;
    expect(req.cancelled).toBe(true);
  });
});
