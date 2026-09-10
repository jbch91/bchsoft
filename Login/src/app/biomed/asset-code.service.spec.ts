import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BiomedService } from './biomed.service';

describe('asset code HTTP contract', () => {
  let service: BiomedService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [BiomedService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BiomedService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.useRealTimers(); TestBed.resetTestingModule(); });

  it('encodes manual codes safely and excludes only the current asset', async () => {
    const pending = service.getAssetCodeSuggestion('client-a', { code: 'H/1 & 2', assetId: 'asset-a' });
    const req = http.expectOne(r => r.url.endsWith('/biomed/client-a/asset-code'));
    expect(req.request.params.get('code')).toBe('H/1 & 2');
    expect(req.request.params.get('assetId')).toBe('asset-a');
    req.flush({ code: 'H/1 & 2', available: false, suggestion: 'H-0001', prefix: 'H-' });
    expect((await pending).available).toBe(false);
  });

  it('releases a stalled availability check after ten seconds', async () => {
    vi.useFakeTimers();
    const pending = service.getAssetCodeSuggestion('client-a');
    const rejected = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    const req = http.expectOne(r => r.url.endsWith('/asset-code'));
    await vi.advanceTimersByTimeAsync(10001);
    await rejected;
    expect(req.cancelled).toBe(true);
  });

  it('sends automatic mode explicitly and returns the code finally assigned by the server', async () => {
    const pending = service.createAsset('client-a', { code: 'H-0001', name: 'EQUIPO', automaticCode: true, maintenanceFrequency: 'trimestral' });
    const req = http.expectOne(r => r.url.endsWith('/biomed/client-a/assets'));
    expect(req.request.body.get('automaticCode')).toBe('true');
    expect(req.request.body.get('maintenanceFrequency')).toBe('trimestral');
    req.flush({ id: 'asset-a', code: 'H-0002', codeAdjusted: true });
    expect((await pending).code).toBe('H-0002');
  });

  it('does not auto-number a manually entered code', async () => {
    const pending = service.createAsset('client-a', { code: 'MANUAL-99', name: 'EQUIPO' });
    const req = http.expectOne(r => r.url.endsWith('/biomed/client-a/assets'));
    expect(req.request.body.has('automaticCode')).toBe(false);
    req.flush({ id: 'asset-a', code: 'MANUAL-99' });
    await pending;
  });
});
