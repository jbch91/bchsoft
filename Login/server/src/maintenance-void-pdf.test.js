import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWarrantyVoidPdf } from './maintenance-warranty-void-pdf.js';

function documentText(destination) {
  const text = [];
  const doc = { page: { width: 612 }, font: () => doc, fontSize: () => doc,
    fillColor: () => doc, moveDown: () => doc, text: value => { text.push(value); return doc; } };
  buildWarrantyVoidPdf(doc, { client: { name: 'CLIENTE QA', nit: 'QA' }, asset: { code: 'QA', name: 'EQUIPO QA' },
    report: { id: 'original-report', voided_at: '2026-09-22', void_reason: 'REGISTRO ERRONEO',
      void_details: { destination, plannedDate: '2026-08-18', warrantyReleaseDate: '2027-01-01', replacementReportId: 'new-certificate' } } });
  return text.join('\n');
}

test('not-located annulment identifies the replacement and never labels the equipment as covered by warranty', () => {
  const text = documentText('not_located');
  assert.match(text, /EQUIPO NO LOCALIZADO/);
  assert.match(text, /NEW-CERTIFICATE/);
  assert.match(text, /NO SE VERIFICÓ EL ESTADO OPERATIVO/);
  assert.doesNotMatch(text, /GARANTÍA/);
});

test('warranty annulment retains its existing coverage wording', () => {
  const text = documentText('warranty');
  assert.match(text, /CUBIERTO POR GARANTÍA/);
  assert.match(text, /01\/01\/2027/);
  assert.doesNotMatch(text, /NEW-CERTIFICATE|EQUIPO NO LOCALIZADO/);
});
