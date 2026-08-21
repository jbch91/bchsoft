import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument as PdfReaderDocument } from 'pdf-lib';
import {
  buildBlankMaintenanceProtocolBatchPdf,
  normalizeBlankMaintenanceProtocolRequest
} from './blank-maintenance-protocols.js';

const assets = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'EQ-001',
    name: 'MONITOR DE SIGNOS VITALES',
    brand: 'MINDRAY',
    model: 'UMEC 12',
    serial: 'SERIE-001',
    status: 'operativo',
    site_name: 'SEDE PRINCIPAL',
    area_name: 'URGENCIAS',
    location_name: 'OBSERVACION'
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    code: 'EQ-002',
    name: 'DESFIBRILADOR',
    brand: 'ZOLL',
    model: 'R SERIES',
    serial: 'SERIE-002',
    status: 'fuera_de_servicio',
    site_name: 'SEDE PRINCIPAL',
    area_name: 'URGENCIAS',
    location_name: 'REANIMACION'
  }
];

test('normaliza una selección y elimina identificadores repetidos', () => {
  const result = normalizeBlankMaintenanceProtocolRequest({
    scope: 'selected',
    reason: '  Contingencia   documental autorizada  ',
    assetIds: [assets[0].id, assets[0].id, assets[1].id]
  });

  assert.deepEqual(result, {
    value: {
      scope: 'selected',
      reason: 'Contingencia documental autorizada',
      assetIds: [assets[0].id, assets[1].id]
    }
  });
});

test('rechaza lotes seleccionados sin equipos, motivo o UUID válido', () => {
  assert.match(
    normalizeBlankMaintenanceProtocolRequest({ scope: 'selected', reason: 'Motivo válido', assetIds: [] }).error,
    /Selecciona al menos un equipo/
  );
  assert.match(
    normalizeBlankMaintenanceProtocolRequest({ scope: 'all_active', reason: 'corto' }).error,
    /al menos 10 caracteres/
  );
  assert.match(
    normalizeBlankMaintenanceProtocolRequest({ scope: 'selected', reason: 'Motivo suficientemente largo', assetIds: ['otro-cliente'] }).error,
    /identificadores de equipo inválidos/
  );
});

test('genera una página física en blanco por cada equipo', async () => {
  const buffer = await buildBlankMaintenanceProtocolBatchPdf({
    client: {
      name: 'CENTRO DE SALUD SAN JUAN DE DIOS',
      nit: '900000000-1',
      logo_path: null
    },
    assets,
    batchCode: 'PMF-PRUEBA001'
  });

  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  const pdf = await PdfReaderDocument.load(buffer);
  assert.equal(pdf.getPageCount(), assets.length);
});
