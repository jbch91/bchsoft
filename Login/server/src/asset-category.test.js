import assert from 'node:assert/strict';
import test from 'node:test';
import { assetCategoryLabel, normalizeAssetCategory } from './asset-category.js';

test('normaliza las categorías de equipos admitidas', () => {
  assert.equal(normalizeAssetCategory(), 'biomedical');
  assert.equal(normalizeAssetCategory('BIOMÉDICO'), 'biomedical');
  assert.equal(normalizeAssetCategory('industrial'), 'industrial');
  assert.equal(assetCategoryLabel('industrial'), 'industrial');
});

test('rechaza categorías que mezclarían inventarios no soportados', () => {
  assert.throws(
    () => normalizeAssetCategory('odontológico'),
    (error) => error?.code === 'INVALID_ASSET_CATEGORY'
  );
});
