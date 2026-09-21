import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNotLocatedClosure } from './maintenance-not-located.js';
import { maintenancePreventiveItemPhase, summarizeMaintenancePreventiveProgress,
  isMaintenanceReportFullySigned, maintenanceReportEngineerReopenError } from './maintenance-workflow.js';

const payload = { verifiedOn:'2026-09-21',searchedLocation:'CONSULTA EXTERNA',
  reason:'Se revisaron consultorios y almacenamiento sin localizar el equipo.',confirmed:true };

test('not located requires explicit confirmation, real search date and justification', () => {
  assert.deepEqual(normalizeNotLocatedClosure(payload,'2026-09-21'), {
    verifiedOn:payload.verifiedOn,searchedLocation:payload.searchedLocation,reason:payload.reason
  });
  for (const change of [{confirmed:false},{confirmed:'true'},{verifiedOn:'2026-02-30'},
    {verifiedOn:'2026-09-22'},{verifiedOn:''},{reason:'No esta'},{reason:'x'.repeat(1001)},
    {searchedLocation:''},{searchedLocation:'x'.repeat(251)}]) {
    assert.throws(() => normalizeNotLocatedClosure({...payload,...change},'2026-09-21'),{status:400});
  }
});

test('constancia is finalized by engineer alone, not counted as performed or overdue', () => {
  const item={report_id:'report',closure_kind:'not_located',has_engineer_signature:true,
    request_status:'firmado',completion_source:'software_report',is_overdue:true,planned_date:'2026-08-01'};
  assert.equal(maintenancePreventiveItemPhase(item),'not_located');
  assert.equal(maintenancePreventiveItemPhase({...item,has_engineer_signature:false}),'pending_signature');
  const summary=summarizeMaintenancePreventiveProgress([item],{year:2026,month:8}).monthly;
  assert.equal(summary.not_located,1); assert.equal(summary.completed,0);
  assert.equal(summary.completion_percent,0); assert.equal(summary.overdue,0);
  const report={closure_kind:'not_located',type:'preventivo',created_by:'engineer'};
  const signatures=[{role:'ingeniero_biomedico',user_id:'engineer'}];
  assert.equal(isMaintenanceReportFullySigned(report,signatures),true);
  assert.equal(isMaintenanceReportFullySigned({...report,closure_kind:'maintenance'},signatures),false);
  assert.equal(isMaintenanceReportFullySigned(report,[]),false);
  assert.equal(maintenanceReportEngineerReopenError(report,signatures,'engineer'),'already_finalized');
});
