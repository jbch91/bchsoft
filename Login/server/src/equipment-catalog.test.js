import test from 'node:test';
import assert from 'node:assert/strict';
import {
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

test('normaliza espacios, mayúsculas y tildes del catálogo', () => {
  assert.equal(normalizeCatalogText('  MONÍTOR   de Signos  '), 'monitor de signos');
});

test('construye el árbol equipo, marca y modelo sin duplicar nodos', () => {
  const tree = buildEquipmentCatalogTree([
    {
      equipment_id: 'equipment-1',
      equipment_name: 'Monitor de signos vitales',
      brand_id: 'brand-1',
      brand_name: 'Mindray',
      model_id: 'model-2',
      model_name: 'uMEC 12'
    },
    {
      equipment_id: 'equipment-1',
      equipment_name: 'Monitor de signos vitales',
      brand_id: 'brand-1',
      brand_name: 'Mindray',
      model_id: 'model-1',
      model_name: 'BeneVision N12'
    },
    {
      equipment_id: 'equipment-2',
      equipment_name: 'Desfibrilador',
      brand_id: null,
      brand_name: null,
      model_id: null,
      model_name: null
    }
  ]);

  assert.deepEqual(tree, [
    { id: 'equipment-2', name: 'Desfibrilador', brands: [] },
    {
      id: 'equipment-1',
      name: 'Monitor de signos vitales',
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
