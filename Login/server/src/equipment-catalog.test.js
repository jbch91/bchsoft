import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminEquipmentCatalogTree,
  buildEquipmentCatalogTree,
  canonicalizeCatalogValue,
  normalizeCatalogText
} from './equipment-catalog.js';

test('guarda los valores del catálogo en mayúsculas y conserva tildes', () => {
  assert.equal(
    canonicalizeCatalogValue('  monitor   de signos vitales  '),
    'MONITOR DE SIGNOS VITALES'
  );
  assert.equal(canonicalizeCatalogValue('báscula pediátrica'), 'BÁSCULA PEDIÁTRICA');
});

test('construye el árbol administrativo con estado y trazabilidad de revisión', () => {
  const tree = buildAdminEquipmentCatalogTree({
    equipmentRows: [{
      id: 'equipment-1',
      name: 'MONITOR DE SIGNOS VITALES',
      review_status: 'pending',
      is_active: true,
      submission_count: 2,
      submitted_by_name: 'Ingeniero Biomédico',
      submitted_client_name: 'Centro de Salud',
      submitted_at: '2026-08-18T10:00:00.000Z',
      last_submitted_at: '2026-08-18T11:00:00.000Z',
      reviewed_at: null,
      reviewed_by_name: null,
      review_notes: null,
      created_at: '2026-08-18T10:00:00.000Z',
      updated_at: '2026-08-18T11:00:00.000Z'
    }],
    brandRows: [{
      id: 'brand-1',
      equipment_id: 'equipment-1',
      name: 'MINDRAY',
      review_status: 'approved',
      is_active: true,
      submission_count: 0,
      submitted_at: null,
      last_submitted_at: null,
      submitted_by_name: null,
      submitted_client_name: null,
      reviewed_at: '2026-08-18T12:00:00.000Z',
      reviewed_by_name: 'Administrador SaaS',
      review_notes: 'Marca verificada',
      created_at: '2026-08-18T10:00:00.000Z',
      updated_at: '2026-08-18T12:00:00.000Z'
    }],
    modelRows: [{
      id: 'model-1',
      brand_id: 'brand-1',
      name: 'UMEC 12',
      review_status: 'approved',
      is_active: true,
      submission_count: 0,
      submitted_at: null,
      last_submitted_at: null,
      submitted_by_name: null,
      submitted_client_name: null,
      reviewed_at: null,
      reviewed_by_name: null,
      review_notes: null,
      created_at: '2026-08-18T10:00:00.000Z',
      updated_at: '2026-08-18T10:00:00.000Z'
    }]
  });

  assert.equal(tree[0].reviewStatus, 'pending');
  assert.equal(tree[0].submissionCount, 2);
  assert.equal(tree[0].submittedClientName, 'Centro de Salud');
  assert.equal(tree[0].brands[0].reviewStatus, 'approved');
  assert.equal(tree[0].brands[0].models[0].name, 'UMEC 12');
});

test('normaliza espacios, mayúsculas y tildes del catálogo', () => {
  assert.equal(normalizeCatalogText('  MONÍTOR   de Signos  '), 'monitor de signos');
});

test('construye el árbol equipo, marca y modelo sin duplicar nodos', () => {
  const tree = buildEquipmentCatalogTree([
    {
      equipment_id: 'equipment-1',
      equipment_name: 'Monitor de signos vitales',
      asset_category: 'biomedical',
      brand_id: 'brand-1',
      brand_name: 'Mindray',
      model_id: 'model-2',
      model_name: 'uMEC 12'
    },
    {
      equipment_id: 'equipment-1',
      equipment_name: 'Monitor de signos vitales',
      asset_category: 'biomedical',
      brand_id: 'brand-1',
      brand_name: 'Mindray',
      model_id: 'model-1',
      model_name: 'BeneVision N12'
    },
    {
      equipment_id: 'equipment-2',
      equipment_name: 'Desfibrilador',
      asset_category: 'biomedical',
      brand_id: null,
      brand_name: null,
      model_id: null,
      model_name: null
    }
  ]);

  assert.deepEqual(tree, [
    {
      id: 'equipment-2',
      name: 'Desfibrilador',
      assetCategory: 'biomedical',
      brands: []
    },
    {
      id: 'equipment-1',
      name: 'Monitor de signos vitales',
      assetCategory: 'biomedical',
      brands: [
        {
          id: 'brand-1',
          name: 'Mindray',
          models: [
            { id: 'model-1', name: 'BeneVision N12' },
            { id: 'model-2', name: 'uMEC 12' }
          ]
        }
      ]
    }
  ]);
});
