import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const invalid = message => Object.assign(new Error(message), { status: 400 });
const upper = value => value.toLocaleUpperCase('es-CO');
const MAX_LOGO_BYTES = 1024 * 1024;

export function normalizeReportPresentation(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Presentación del informe inválida.');
  const mode = input.mode || 'internal';
  if (!['internal', 'external'].includes(mode)) throw invalid('Selecciona el tipo de prestador.');
  const field = (key, limit) => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
      throw invalid(`Revisa el campo ${key}; máximo ${limit} caracteres.`);
    }
    return value.trim();
  };
  const result = {
    mode, providerName: upper(field('providerName', 160)), providerNit: upper(field('providerNit', 40)),
    providerContact: field('providerContact', 180), contract: upper(field('contract', 120)),
    recipient: upper(field('recipient', 160)), observations: field('observations', 1800),
    providerLogo: field('providerLogo', Math.ceil(MAX_LOGO_BYTES * 4 / 3) + 100)
  };
  if (mode === 'external' && !result.providerName) throw invalid('Indica la razón social del prestador externo.');
  if (mode === 'internal') {
    result.providerName = ''; result.providerNit = ''; result.providerContact = ''; result.providerLogo = '';
  }
  return result;
}

export async function normalizeReportLogo(value) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_LOGO_BYTES * 4 / 3) + 100) throw invalid('El logo admite hasta 1 MB.');
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw invalid('El logo debe ser una imagen PNG o JPG.');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_LOGO_BYTES) throw invalid('El logo admite hasta 1 MB.');
  try {
    const source = sharp(buffer, { limitInputPixels: 8000000 });
    const metadata = await source.metadata();
    if (!['png', 'jpeg'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Invalid format');
    const output = await source.rotate().resize(600, 240, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    return `data:image/png;base64,${output.toString('base64')}`;
  } catch {
    throw invalid('No se pudo leer el logo. Usa una imagen PNG o JPG válida de hasta 8 megapíxeles.');
  }
}

export async function clientReportLogo(client, root = process.cwd()) {
  if (!client.logo_path || !client.id) return '';
  // Only the authenticated tenant's stored logo can be read, never a request-supplied path or URL.
  const directory = path.resolve(root, 'uploads', 'clients', client.id);
  const filename = path.resolve(root, String(client.logo_path).replace(/^\//, ''));
  if (!filename.startsWith(directory + path.sep)) return '';
  try {
    const canonicalDirectory=path.resolve(await fs.realpath(root),'uploads','clients',client.id);
    const real = await fs.realpath(filename);
    if (!real.startsWith(canonicalDirectory + path.sep)) return '';
    if ((await fs.stat(real)).size > MAX_LOGO_BYTES) return '';
    return await normalizeReportLogo(`data:image/png;base64,${(await fs.readFile(real)).toString('base64')}`);
  } catch { return ''; }
}

export async function presentActivityReport(report, input = {}) {
  const presentation = normalizeReportPresentation(input);
  presentation.providerLogo = await normalizeReportLogo(presentation.providerLogo);
  const client = { ...report.client, logoDataUrl: await clientReportLogo(report.client) };
  delete client.logo_path;
  const notes = [...(report.notes || []),
    'CONSOLIDADO INFORMATIVO. NO SUSTITUYE LOS PROTOCOLOS ORIGINALES NI SUS FIRMAS.'];
  if (presentation.mode === 'external') notes.push(
    'PRESTADOR DECLARADO PARA ESTE INFORME. LA EMPRESA NO ES UN FILTRO AUTOMÁTICO: LOS REGISTROS INCLUIDOS CORRESPONDEN AL ALCANCE E INGENIERO SELECCIONADOS.');
  return { ...report, client, presentation, notes };
}

export function reportPresentationLines(report) {
  const p = report.presentation || { mode: 'internal' };
  return [
    `PRESTACIÓN: ${p.mode === 'external' ? 'EMPRESA EXTERNA' : 'SERVICIO PROPIO DE LA INSTITUCIÓN'}`,
    ...(p.contract ? [`CONTRATO / ORDEN: ${p.contract}`] : []),
    ...(p.recipient ? [`DIRIGIDO A: ${p.recipient}`] : [])
  ];
}
