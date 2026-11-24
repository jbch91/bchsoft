import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { hospitalUsername, validateNewUsername } from './usernames.js';
import { sendPasswordSetupCode } from './mailer.js';

test('hospital usernames distinguish hospitals and normalize accents and separators', () => {
  assert.equal(hospitalUsername('FISIOTERAPÍA', { name: 'E.S.E. HOSPITAL SAN ANTONIO', city: 'Timaná' }), 'fisioterapia.san.antonio.timana');
  assert.equal(hospitalUsername('Fisioterapia', { name: 'ESE HOSPITAL SAN JUAN DE DIOS', city: 'El Pital' }), 'fisioterapia.san.juan.dios.pital');
  assert.notEqual(hospitalUsername('fisio', { name: 'Hospital San Antonio', city: 'Bogotá' }), hospitalUsername('fisio', { name: 'Hospital San Juan', city: 'Bogotá' }));
  assert.equal(hospitalUsername('Usuario', { name: 'Hospital de Timaná', city: 'Timaná' }), 'usuario.timana');
  assert.ok(hospitalUsername('u'.repeat(200), { name: 'h'.repeat(200), city: 'c'.repeat(200) }).length <= 80);
  assert.throws(() => hospitalUsername('!!!', { name: 'Hospital', city: 'Pital' }));
  assert.throws(() => validateNewUsername('\n\t'));
  assert.throws(() => validateNewUsername('a\nb'));
  assert.equal(validateNewUsername(' Fisio.Manual '), 'Fisio.Manual');
});

test('password setup message includes the chosen login and keeps the thirty-minute expiry', async (t) => {
  let sent;
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async message => { sent = message; } }));
  await sendPasswordSetupCode({ to: 'qa@example.invalid', code: '123456', username: 'fisioterapia.timana', clientName: 'Hospital QA' });
  assert.match(sent.text, /fisioterapia\.timana/);
  assert.match(sent.text, /30 minutos/);
});
