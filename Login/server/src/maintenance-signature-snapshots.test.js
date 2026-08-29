import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createMaintenanceSignatureSnapshot,
  isMaintenanceSignatureSnapshotPath
} from './maintenance-signature-snapshots.js';

test('conserva una copia de la firma independiente del perfil del usuario', async (t) => {
  const rootDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'inbi-maintenance-signature-'));
  t.after(() => fs.promises.rm(rootDir, { recursive: true, force: true }));

  const sourceDir = path.join(rootDir, 'uploads', 'users', 'user-1');
  const sourcePath = path.join(sourceDir, 'signature.png');
  const originalSignature = Buffer.from('firma-original-del-reporte');
  await fs.promises.mkdir(sourceDir, { recursive: true });
  await fs.promises.writeFile(sourcePath, originalSignature);

  const snapshot = await createMaintenanceSignatureSnapshot({
    rootDir,
    clientId: 'client-1',
    reportId: 'report-1',
    sourceSignaturePath: '/uploads/users/user-1/signature.png'
  });

  assert.equal(isMaintenanceSignatureSnapshotPath(snapshot.publicPath, 'report-1'), true);
  assert.equal((await fs.promises.readFile(snapshot.fullPath)).toString(), originalSignature.toString());
  assert.match(snapshot.sha256, /^[a-f0-9]{64}$/);

  await fs.promises.writeFile(sourcePath, Buffer.from('firma-nueva-del-perfil'));
  assert.equal((await fs.promises.readFile(snapshot.fullPath)).toString(), originalSignature.toString());
});

test('rechaza rutas de firma por fuera del almacenamiento autorizado', async (t) => {
  const rootDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'inbi-maintenance-signature-'));
  t.after(() => fs.promises.rm(rootDir, { recursive: true, force: true }));

  await assert.rejects(
    createMaintenanceSignatureSnapshot({
      rootDir,
      clientId: 'client-1',
      reportId: 'report-1',
      sourceSignaturePath: '../firma.png'
    }),
    (error) => error?.code === 'INVALID_SIGNATURE_PATH'
  );
});
