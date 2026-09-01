import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument as PdfReaderDocument } from 'pdf-lib';
import PDFDocument from 'pdfkit';
import { buildMaintenanceReportPdf, formatMaintenanceDate } from './pdf.js';

function buildReportBuffer(signatures, requestOverrides = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
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
        created_at: '2026-08-20T12:00:00.000Z',
        planned_date: '2026-08-20',
        deadline_date: '2026-08-31',
        ...requestOverrides
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

test('conserva sin desplazamiento las fechas de calendario del cronograma', () => {
  assert.equal(formatMaintenanceDate('2026-08-20'), '20/08/2026');
  assert.equal(formatMaintenanceDate('2026-08-31'), '31/08/2026');
});

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
  assert.ok(pdf.getPageCount() >= 3);
  assert.ok(pdf.getPageCount() <= 5);
});

test('documenta la ejecución extemporánea sin alterar el periodo programado', async () => {
  const buffer = await buildReportBuffer([], {
    assigned_name: 'INGENIERO DE PRUEBA',
    late_execution_authorized_at: '2026-09-01T14:00:00.000Z',
    late_execution_authorized_by_name: 'ADMINISTRADOR DEL CLIENTE',
    late_execution_reason: 'El cierre operativo de agosto fue autorizado de forma excepcional para completar la trazabilidad pendiente sin modificar las fechas del cronograma original.'.repeat(3)
  });

  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  const pdf = await PdfReaderDocument.load(buffer);
  assert.ok(pdf.getPageCount() >= 2);
  assert.ok(pdf.getPageCount() <= 5);
});
