import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument as PdfReaderDocument } from 'pdf-lib';
import PDFDocument from 'pdfkit';
import { buildMaintenanceReportPdf } from './pdf.js';

function buildReportBuffer(signatures) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    buildMaintenanceReportPdf(doc, {
      client: {
        name: 'CLIENTE DE PRUEBA',
        nit: '900000000-1',
        city: 'BOGOTA',
        address: 'DIRECCION DE PRUEBA',
        email: 'pruebas@example.test',
        logo_path: null
      },
      asset: {
        asset_category: 'biomedical',
        code: 'EQ-001',
        name: 'MONITOR DE SIGNOS VITALES',
        brand: 'MARCA',
        model: 'MODELO',
        serial: 'SERIE-001',
        site_name: 'SEDE PRINCIPAL',
        area_name: 'URGENCIAS',
        location_name: 'OBSERVACION'
      },
      request: {
        type: 'preventivo',
        created_at: '2026-08-20T12:00:00.000Z'
      },
      report: {
        type: 'preventivo',
        created_at: '2026-08-20T15:00:00.000Z',
        summary: 'Mantenimiento preventivo realizado.',
        findings: 'Equipo en condiciones operativas.',
        actions_taken: 'Limpieza, ajuste y pruebas funcionales.',
        maintenance_checks: ['revision_visual'],
        maintenance_activities: ['limpieza_externa'],
        maintenance_tests: ['encendido_apagado'],
        asset_status_after: 'operativo',
        asset_status_observations: null,
        requires_spare_parts: false,
        spare_parts_needed: null,
        spare_parts_status: 'no_aplica'
      },
      signatures
    });
    doc.end();
  });
}

test('genera firmas legibles con nombres largos y más de una fila', async () => {
  const buffer = await buildReportBuffer([
    {
      role: 'ingeniero_biomedico',
      display_name: 'INGENIERO BIOMEDICO CON UN NOMBRE EXTENSO DE PRUEBA',
      signed_at: '2026-08-20T16:00:00.000Z',
      signature_path: null
    },
    {
      role: 'responsable_area',
      display_name: 'RESPONSABLE PRINCIPAL DEL AREA DE URGENCIAS Y OBSERVACION',
      signed_at: '2026-08-20T17:00:00.000Z',
      signature_path: null
    },
    {
      role: 'almacenista',
      display_name: 'RESPONSABLE DE ALMACEN Y SUMINISTROS BIOMEDICOS',
      signed_at: '2026-08-20T18:00:00.000Z',
      signature_path: null
    }
  ]);

  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  const pdf = await PdfReaderDocument.load(buffer);
  assert.ok(pdf.getPageCount() >= 2);
});
