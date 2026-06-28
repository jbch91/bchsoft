function normalizeMode(value) {
  const mode = String(value || 'dry-run').trim().toLowerCase();
  return ['dry-run', 'disabled', 'provider'].includes(mode) ? mode : 'dry-run';
}

export function whatsappMode() {
  return normalizeMode(process.env.ODONTOLOGY_WHATSAPP_MODE || process.env.WHATSAPP_MODE || 'dry-run');
}

export async function sendWhatsAppMessage({ to, message, provider = '', metadata = {} }) {
  const mode = whatsappMode();
  const recipient = String(to || '').trim();
  const body = String(message || '').trim();
  if (!recipient) {
    throw new Error('Número de WhatsApp requerido.');
  }
  if (!body) {
    throw new Error('Mensaje de WhatsApp requerido.');
  }
  if (mode === 'disabled') {
    throw new Error('WhatsApp está desactivado en el servidor.');
  }
  if (mode === 'dry-run') {
    console.log('WhatsApp dry-run', {
      to: recipient,
      provider: provider || 'sin_proveedor',
      message: body,
      metadata
    });
    return {
      ok: true,
      dryRun: true,
      provider: provider || 'dry-run',
      externalId: `dry-run-${Date.now()}`
    };
  }

  throw new Error('Proveedor WhatsApp real aún no conectado. Usa ODONTOLOGY_WHATSAPP_MODE=dry-run.');
}
