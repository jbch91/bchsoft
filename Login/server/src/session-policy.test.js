import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeSessionDevice,
  normalizeMaxActiveSessions,
  normalizeSessionContext
} from './session-policy.js';

test('limita la cantidad configurable de sesiones activas', () => {
  assert.equal(normalizeMaxActiveSessions(undefined), 3);
  assert.equal(normalizeMaxActiveSessions(''), 3);
  assert.equal(normalizeMaxActiveSessions('5'), 5);
  assert.equal(normalizeMaxActiveSessions('0'), 1);
  assert.equal(normalizeMaxActiveSessions('99'), 10);
});

test('describe navegadores y dispositivos habituales', () => {
  assert.equal(
    describeSessionDevice('Mozilla/5.0 (iPhone) AppleWebKit/605.1 Version/17.0 Mobile Safari/604.1'),
    'Safari en iPhone'
  );
  assert.equal(
    describeSessionDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0 Safari/537.36'),
    'Google Chrome en Mac'
  );
});

test('normaliza metadatos sin permitir valores descontrolados', () => {
  assert.deepEqual(normalizeSessionContext({ userAgent: ' Browser ', ipAddress: ' 127.0.0.1 ' }), {
    userAgent: 'Browser',
    ipAddress: '127.0.0.1'
  });
  assert.equal(normalizeSessionContext({ userAgent: 'x'.repeat(700) }).userAgent?.length, 500);
});
