import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SIGNATURE_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function maintenanceSignatureError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function storedFilePath(rootDir, storedPath) {
  const relativePath = String(storedPath || '').replace(/^[/\\]+/, '');
  if (!relativePath) return null;

  const uploadsRoot = path.resolve(rootDir, 'uploads');
  const fullPath = path.resolve(rootDir, relativePath);
  if (fullPath !== uploadsRoot && !fullPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw maintenanceSignatureError(
      'INVALID_SIGNATURE_PATH',
      'La ruta de la firma no pertenece al almacenamiento autorizado.'
    );
  }
  return fullPath;
}

export function isMaintenanceSignatureSnapshotPath(signaturePath, reportId = null) {
  const normalized = `/${String(signaturePath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')}`;
  const basePattern = /^\/uploads\/clients\/[^/]+\/maintenance\/signatures\/([^/]+)\/[^/]+$/;
  const match = normalized.match(basePattern);
  if (!match) return false;
  return reportId ? match[1] === String(reportId) : true;
}

export async function createMaintenanceSignatureSnapshot({
  rootDir = process.cwd(),
  clientId,
  reportId,
  sourceSignaturePath
}) {
  if (!clientId || !reportId) {
    throw maintenanceSignatureError(
      'INVALID_SIGNATURE_CONTEXT',
      'El cliente y el reporte son requeridos para conservar la firma.'
    );
  }

  const sourcePath = storedFilePath(rootDir, sourceSignaturePath);
  if (!sourcePath) {
    throw maintenanceSignatureError('SIGNATURE_NOT_FOUND', 'La firma registrada no está disponible.');
  }

  let signatureBuffer;
  try {
    signatureBuffer = await fs.promises.readFile(sourcePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw maintenanceSignatureError('SIGNATURE_NOT_FOUND', 'La firma registrada no está disponible.');
    }
    throw error;
  }

  const sourceExtension = path.extname(sourcePath).toLowerCase();
  const extension = SIGNATURE_IMAGE_EXTENSIONS.has(sourceExtension) ? sourceExtension : '.png';
  const relativeDir = path.join(
    'uploads',
    'clients',
    String(clientId),
    'maintenance',
    'signatures',
    String(reportId)
  );
  const filename = `${randomUUID()}${extension}`;
  const relativePath = path.join(relativeDir, filename);
  const destinationPath = path.resolve(rootDir, relativePath);

  await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.promises.writeFile(destinationPath, signatureBuffer, { flag: 'wx' });

  return {
    fullPath: destinationPath,
    publicPath: `/${relativePath.replace(/\\/g, '/')}`,
    sha256: createHash('sha256').update(signatureBuffer).digest('hex')
  };
}

export async function removeMaintenanceSignatureSnapshot(fullPath) {
  if (!fullPath) return;
  try {
    await fs.promises.unlink(fullPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
