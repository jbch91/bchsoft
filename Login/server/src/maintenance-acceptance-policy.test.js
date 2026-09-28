import test from 'node:test';
import assert from 'node:assert/strict';
import { maintenanceAcceptanceError } from './maintenance-acceptance-policy.js';
import { isMaintenanceReportFullySigned, maintenancePreventiveItemPhase } from './maintenance-workflow.js';

const report = { created_by:'engineer', area_responsible_required:true, acceptance_delegate_user_id:'store' };
const user = {sub:'store',roles:['almacenista'],permissions:['maintenance:report:sign']};

test('only the selected storekeeper with signing permission substitutes the chief', () => {
  assert.equal(maintenanceAcceptanceError(report,user),null);
  for (const other of [{...user,sub:'other'}, {...user,permissions:[]}, {...user,roles:['responsable_area']}]) {
    assert.ok(maintenanceAcceptanceError(report,other));
  }
  assert.ok(maintenanceAcceptanceError({},user));
  assert.equal(maintenanceAcceptanceError({},user,{alreadySigned:true}),null);
});

test('delegation still requires the engineer and the exact storekeeper signature', () => {
  const engineer = {user_id:'engineer',role:'ingeniero_biomedico'};
  const store = {user_id:'store',role:'almacenista'};
  for (const type of ['preventivo','correctivo']) {
    assert.equal(isMaintenanceReportFullySigned({...report,type},[store]),false);
    assert.equal(isMaintenanceReportFullySigned({...report,type},[engineer,{...store,user_id:'other'}]),false);
    assert.equal(isMaintenanceReportFullySigned({...report,type},[engineer,{...store,role:'responsable_area'}]),false);
    assert.equal(isMaintenanceReportFullySigned({...report,type},[engineer,store]),true);
  }
});

test('signed protocols leave the pending-signature phase even when awaiting spare parts', () => {
  const item = {...report,report_id:'report',has_engineer_signature:true,request_status:'espera_repuesto'};
  assert.equal(maintenancePreventiveItemPhase(item),'pending_signature');
  assert.equal(maintenancePreventiveItemPhase({...item,has_delegate_signature:true}),'completed');
  assert.equal(maintenancePreventiveItemPhase({...item,has_area_responsible_signature:true}),'pending_signature');
});
