import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || 'true') === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    }),
    user,
    fromName: process.env.SMTP_FROM_NAME || 'BCHSOFT'
  };
}

export async function sendResetCode({ to, code }) {
  const { transporter, user, fromName } = getTransporter();
  const from = `${fromName} <${user}>`;
  const subject = 'Código de recuperación BCHSOFT';
  const text = `Tu código de recuperación es: ${code}.\nEste código expira en 30 minutos.`;

  await transporter.sendMail({
    from,
    to,
    subject,
    text
  });
}

export async function sendPasswordSetupCode({ to, code, clientName }) {
  const { transporter, user, fromName } = getTransporter();
  const from = `${fromName} <${user}>`;
  const subject = 'Activa tu cuenta en INBIHOSPITALARIO';
  const text = [
    `Se generó un acceso para tu cuenta${clientName ? ` de ${clientName}` : ''} en INBIHOSPITALARIO.`,
    '',
    `Tu código para crear o actualizar tu contraseña es: ${code}.`,
    'Este código expira en 30 minutos.',
    '',
    'En la pantalla de inicio de sesión, abre Recuperar contraseña, escribe este correo, el código recibido y define tu nueva contraseña.'
  ].join('\n');

  await transporter.sendMail({
    from,
    to,
    subject,
    text
  });
}

export async function sendActionConfirmationCode({ to, code, actionLabel, summary }) {
  const { transporter, user, fromName } = getTransporter();
  const from = `${fromName} <${user}>`;
  const subject = 'Código de confirmación INBIHOSPITALARIO';
  const text = [
    'Se solicitó confirmar una acción administrativa sensible.',
    '',
    `Acción: ${actionLabel || 'Acción administrativa'}`,
    summary ? `Detalle: ${summary}` : '',
    '',
    `Código de confirmación: ${code}`,
    'Este código expira en 10 minutos.',
    '',
    'Si no solicitaste esta acción, no compartas este código y revisa la sesión activa.'
  ].filter(Boolean).join('\n');

  await transporter.sendMail({
    from,
    to,
    subject,
    text
  });
}

export async function sendNotificationEmail({ to, subject, text }) {
  const { transporter, user, fromName } = getTransporter();
  const from = `${fromName} <${user}>`;
  await transporter.sendMail({
    from,
    to,
    subject,
    text
  });
}
