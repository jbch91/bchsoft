import test from 'node:test';
import assert from 'node:assert/strict';
import { spareInstallationDescription, resolveSpareInstallationDescription } from './maintenance-spare-description.js';

const context = { request: { type: 'preventivo', status: 'espera_repuesto', planned_date: '2026-08-01' },
  sourceReport: { type: 'preventivo', spare_parts_needed: 'BATERÍA' }, asset: { code: 'EQ-1', name: 'MONITOR' } };

test('description names the spare, equipment and scheduled period, not the later signature date', () => {
  assert.equal(spareInstallationDescription(context), 'Atención correctiva para instalar BATERÍA en el equipo EQ-1 - MONITOR. La necesidad del repuesto fue identificada durante el mantenimiento preventivo correspondiente a agosto de 2026.');
  assert.equal(spareInstallationDescription({ ...context, request: { ...context.request, planned_date: new Date('2026-08-01T00:00:00Z') } }), spareInstallationDescription(context));
});
test('missing period and corrective antecedents do not invent a preventive month', () => {
  assert.match(spareInstallationDescription({ ...context, request: { ...context.request, planned_date: null } }), /preventivo anterior\.$/);
  assert.match(spareInstallationDescription({ ...context, sourceReport: { type: 'correctivo' } }), /correctivo anterior\.$/);
});
test('edits and stored correction text take precedence over the suggestion', () => {
  assert.equal(resolveSpareInstallationDescription({ ...context, value: '  Texto personalizado\npor el ingeniero.  ' }), 'Texto personalizado por el ingeniero.');
  assert.equal(resolveSpareInstallationDescription({ ...context, correctionReport: { type: 'correctivo', request_description: 'Descripción guardada anteriormente.' } }), 'Descripción guardada anteriormente.');
  assert.equal(resolveSpareInstallationDescription(context), spareInstallationDescription(context));
});
test('rejects empty, oversized and non-text descriptions', () => {
  for (const value of ['', 'corto', 'x'.repeat(2001), [], {}, null, 42]) {
    assert.throws(() => resolveSpareInstallationDescription({ ...context, value }), { status: 400 });
  }
});
test('does not allow replacing an ordinary request or a preventive correction', () => {
  for (const extra of [{ request: { status: 'en_proceso' } }, { lifecycleAction: 'retire' }, { correctionReport: { type: 'preventivo', spare_parts_status: 'solicitado' } }]) {
    assert.equal(resolveSpareInstallationDescription({ ...context, ...extra }), null);
    assert.throws(() => resolveSpareInstallationDescription({ ...context, ...extra, value: 'Texto para otra solicitud.' }), { status: 400 });
  }
});
