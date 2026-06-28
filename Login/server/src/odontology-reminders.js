import { query } from './db.js';
import { sendNotificationEmail } from './mailer.js';
import { createOdontologyAppointmentReminderLog } from './odontology.js';
import { sendWhatsAppMessage, whatsappMode } from './whatsapp.js';

const TIME_ZONE = 'America/Bogota';
const AUTOMATIC_REMINDER_KINDS = [
  { kind: 'day_before', label: 'manana', offsetDays: 1 },
  { kind: 'same_day', label: 'hoy', offsetDays: 0 }
];

function dateStringInBogota(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function dateWithOffset(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

function formatAppointmentDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE
  }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`));
}

function timeOnly(value) {
  return String(value || '').slice(0, 5);
}

function buildAppointmentReminderMessage(appointment, reminder) {
  const dateLabel = formatAppointmentDate(appointment.scheduled_date);
  const timeLabel = `${timeOnly(appointment.start_time)} - ${timeOnly(appointment.end_time)}`;
  const intro = reminder.kind === 'same_day'
    ? 'Te recordamos que tu cita odontologica es hoy.'
    : 'Te recordamos que tu cita odontologica es manana.';

  return [
    `Hola ${appointment.patient_name},`,
    '',
    intro,
    `Institucion: ${appointment.client_name || 'INBIHOSPITALARIO'}`,
    `Fecha: ${dateLabel}`,
    `Hora: ${timeLabel}`,
    `Odontologo: ${appointment.dentist_name || 'Por confirmar'}`,
    `Procedimiento: ${appointment.procedure_name || 'Consulta odontologica'}`,
    `Sede: ${appointment.site_name || 'Por confirmar'}`,
    appointment.chair_name ? `Unidad: ${appointment.chair_name}` : '',
    '',
    'Si necesitas reprogramar o cancelar, por favor comunicate con la institucion.',
    '',
    'INBIHOSPITALARIO'
  ].filter(Boolean).join('\n');
}

function renderTemplate(template, appointment, reminder) {
  const dateLabel = formatAppointmentDate(appointment.scheduled_date);
  const timeLabel = `${timeOnly(appointment.start_time)} - ${timeOnly(appointment.end_time)}`;
  const values = {
    patient_name: appointment.patient_name || '',
    appointment_date: dateLabel,
    appointment_time: timeLabel,
    dentist_name: appointment.dentist_name || 'Por confirmar',
    site_name: appointment.site_name || 'Por confirmar',
    procedure_name: appointment.procedure_name || 'Consulta odontologica',
    client_name: appointment.client_name || 'INBIHOSPITALARIO'
  };
  const fallback = buildAppointmentReminderMessage(appointment, reminder);
  return String(template || fallback).replace(/\{\{([a-z_]+)\}\}/gi, (_, key) => values[key] ?? '');
}

async function listDueReminders({ scheduledDate, reminderKind, channel }) {
  const isWhatsapp = channel === 'whatsapp';
  const recipientFilter = isWhatsapp
    ? `NULLIF(TRIM(p.phone), '') IS NOT NULL
       AND os.enable_whatsapp_reminders = TRUE
       AND NULLIF(TRIM(COALESCE(os.whatsapp_provider, '')), '') IS NOT NULL
       AND NULLIF(TRIM(COALESCE(os.whatsapp_business_phone, '')), '') IS NOT NULL`
    : `NULLIF(TRIM(p.email), '') IS NOT NULL`;
  const { rows } = await query(
    `SELECT a.id,
            a.client_id,
            a.patient_id,
            a.scheduled_date::text AS scheduled_date,
            a.start_time::text AS start_time,
            a.end_time::text AS end_time,
            a.status,
            p.full_name AS patient_name,
            p.email AS patient_email,
            p.phone AS patient_phone,
            c.name AS client_name,
            u.display_name AS dentist_name,
            s.name AS site_name,
            ch.name AS chair_name,
            pt.name AS procedure_name,
            os.enable_whatsapp_reminders,
            os.whatsapp_provider,
            os.whatsapp_business_phone,
            os.whatsapp_day_before_template,
            os.whatsapp_same_day_template
     FROM odontology_appointments a
     JOIN odontology_patients p ON p.id = a.patient_id
     JOIN clients c ON c.id = a.client_id
     JOIN odontology_settings os ON os.client_id = a.client_id
     JOIN client_software_access csa ON csa.client_id = c.id
       AND csa.suite_key = 'odontologico'
       AND csa.enabled = TRUE
       AND COALESCE(csa.license_status, 'trial') NOT IN ('suspended', 'expired')
     JOIN users u ON u.id = a.dentist_user_id
     LEFT JOIN odontology_sites s ON s.id = a.site_id
     LEFT JOIN odontology_chairs ch ON ch.id = a.chair_id
     LEFT JOIN odontology_procedure_types pt ON pt.id = a.procedure_type_id
     LEFT JOIN odontology_appointment_reminders sent ON sent.appointment_id = a.id
       AND sent.channel = $3
       AND sent.reminder_kind = $2
       AND sent.status = 'sent'
     LEFT JOIN odontology_appointment_reminders recent_attempt ON recent_attempt.appointment_id = a.id
       AND recent_attempt.channel = $3
       AND recent_attempt.reminder_kind = $2
       AND recent_attempt.sent_at > NOW() - INTERVAL '6 hours'
     WHERE a.scheduled_date = $1::date
       AND ${recipientFilter}
       AND sent.id IS NULL
       AND recent_attempt.id IS NULL
       AND LOWER(a.status) NOT LIKE '%cancel%'
       AND LOWER(a.status) NOT LIKE '%no asist%'
       AND LOWER(a.status) NOT LIKE '%atendid%'
     ORDER BY a.scheduled_date ASC, a.start_time ASC
     LIMIT 500`,
    [scheduledDate, reminderKind, channel]
  );
  return rows;
}

async function getAppointmentForManualReminder({ clientId, appointmentId }) {
  const { rows } = await query(
    `SELECT a.id,
            a.client_id,
            a.patient_id,
            a.scheduled_date::text AS scheduled_date,
            a.start_time::text AS start_time,
            a.end_time::text AS end_time,
            a.status,
            p.full_name AS patient_name,
            p.email AS patient_email,
            p.phone AS patient_phone,
            c.name AS client_name,
            u.display_name AS dentist_name,
            s.name AS site_name,
            ch.name AS chair_name,
            pt.name AS procedure_name,
            os.enable_whatsapp_reminders,
            os.whatsapp_provider,
            os.whatsapp_business_phone,
            os.whatsapp_day_before_template,
            os.whatsapp_same_day_template
     FROM odontology_appointments a
     JOIN odontology_patients p ON p.id = a.patient_id
     JOIN clients c ON c.id = a.client_id
     JOIN odontology_settings os ON os.client_id = a.client_id
     JOIN users u ON u.id = a.dentist_user_id
     LEFT JOIN odontology_sites s ON s.id = a.site_id
     LEFT JOIN odontology_chairs ch ON ch.id = a.chair_id
     LEFT JOIN odontology_procedure_types pt ON pt.id = a.procedure_type_id
     WHERE a.client_id = $1
       AND a.id = $2
     LIMIT 1`,
    [clientId, appointmentId]
  );
  return rows[0] || null;
}

async function sendEmailReminder(appointment, reminder) {
  const subject = reminder.kind === 'same_day'
    ? 'Recordatorio: tu cita odontologica es hoy'
    : 'Recordatorio: cita odontologica manana';
  const message = buildAppointmentReminderMessage(appointment, reminder);

  try {
    await sendNotificationEmail({
      to: appointment.patient_email,
      subject,
      text: message
    });
    try {
      await createOdontologyAppointmentReminderLog({
        clientId: appointment.client_id,
        appointmentId: appointment.id,
        channel: 'email',
        recipientName: appointment.patient_name,
        recipientEmail: appointment.patient_email,
        recipientPhone: appointment.patient_phone,
        subject,
        message,
        status: 'sent',
        reminderKind: reminder.kind
      });
    } catch (error) {
      if (error?.code === '23505') {
        return { sent: 0, failed: 0 };
      }
      throw error;
    }
    return { sent: 1, failed: 0 };
  } catch (error) {
    await createOdontologyAppointmentReminderLog({
      clientId: appointment.client_id,
      appointmentId: appointment.id,
      channel: 'email',
      recipientName: appointment.patient_name,
      recipientEmail: appointment.patient_email,
      recipientPhone: appointment.patient_phone,
      subject,
      message,
      status: 'failed',
      reminderKind: reminder.kind,
      errorMessage: error?.message || 'No se pudo enviar el correo.'
    });
    console.error('Email recordatorio odontologico automatico fallo', error);
    return { sent: 0, failed: 1 };
  }
}

async function sendWhatsappReminder(appointment, reminder) {
  const template = reminder.kind === 'same_day'
    ? appointment.whatsapp_same_day_template
    : appointment.whatsapp_day_before_template;
  const message = renderTemplate(template, appointment, reminder);
  const subject = `WhatsApp ${whatsappMode()}: ${reminder.kind}`;

  try {
    await sendWhatsAppMessage({
      to: appointment.patient_phone,
      message,
      provider: appointment.whatsapp_provider,
      metadata: {
        clientId: appointment.client_id,
        appointmentId: appointment.id,
        reminderKind: reminder.kind
      }
    });
    try {
      await createOdontologyAppointmentReminderLog({
        clientId: appointment.client_id,
        appointmentId: appointment.id,
        channel: 'whatsapp',
        recipientName: appointment.patient_name,
        recipientEmail: appointment.patient_email,
        recipientPhone: appointment.patient_phone,
        subject,
        message,
        status: 'sent',
        reminderKind: reminder.kind
      });
    } catch (error) {
      if (error?.code === '23505') {
        return { sent: 0, failed: 0 };
      }
      throw error;
    }
    return { sent: 1, failed: 0 };
  } catch (error) {
    await createOdontologyAppointmentReminderLog({
      clientId: appointment.client_id,
      appointmentId: appointment.id,
      channel: 'whatsapp',
      recipientName: appointment.patient_name,
      recipientEmail: appointment.patient_email,
      recipientPhone: appointment.patient_phone,
      subject,
      message,
      status: 'failed',
      reminderKind: reminder.kind,
      errorMessage: error?.message || 'No se pudo preparar el WhatsApp.'
    });
    console.error('WhatsApp recordatorio odontologico fallo', error);
    return { sent: 0, failed: 1 };
  }
}

export async function sendManualOdontologyAppointmentWhatsappReminder({ clientId, appointmentId, actorUserId = null }) {
  const appointment = await getAppointmentForManualReminder({ clientId, appointmentId });
  if (!appointment) {
    return { error: 'NOT_FOUND', message: 'Cita no encontrada.' };
  }
  if (!appointment.patient_phone) {
    return { error: 'VALIDATION', message: 'El paciente no tiene teléfono registrado.' };
  }
  if (!appointment.enable_whatsapp_reminders || !appointment.whatsapp_provider || !appointment.whatsapp_business_phone) {
    return { error: 'VALIDATION', message: 'WhatsApp no está preparado para este cliente.' };
  }

  const today = dateStringInBogota();
  const tomorrow = dateStringInBogota(dateWithOffset(new Date(), 1));
  const appointmentDate = String(appointment.scheduled_date || '').slice(0, 10);
  const template = appointmentDate === tomorrow
    ? appointment.whatsapp_day_before_template
    : appointment.whatsapp_same_day_template;
  const message = renderTemplate(template, appointment, { kind: appointmentDate === tomorrow ? 'day_before' : 'same_day' });
  const subject = `WhatsApp ${whatsappMode()}: manual`;

  try {
    await sendWhatsAppMessage({
      to: appointment.patient_phone,
      message,
      provider: appointment.whatsapp_provider,
      metadata: {
        clientId: appointment.client_id,
        appointmentId: appointment.id,
        reminderKind: 'manual',
        scheduledDate: appointmentDate,
        triggeredAt: today
      }
    });
    const reminder = await createOdontologyAppointmentReminderLog({
      clientId: appointment.client_id,
      appointmentId: appointment.id,
      channel: 'whatsapp',
      recipientName: appointment.patient_name,
      recipientEmail: appointment.patient_email,
      recipientPhone: appointment.patient_phone,
      subject,
      message,
      status: 'sent',
      reminderKind: 'manual',
      actorUserId
    });
    return { reminder };
  } catch (error) {
    const reminder = await createOdontologyAppointmentReminderLog({
      clientId: appointment.client_id,
      appointmentId: appointment.id,
      channel: 'whatsapp',
      recipientName: appointment.patient_name,
      recipientEmail: appointment.patient_email,
      recipientPhone: appointment.patient_phone,
      subject,
      message,
      status: 'failed',
      reminderKind: 'manual',
      errorMessage: error?.message || 'No se pudo preparar el WhatsApp.',
      actorUserId
    });
    console.error('WhatsApp recordatorio odontologico manual fallo', error);
    return {
      error: 'SEND_FAILED',
      message: 'No se pudo preparar el recordatorio por WhatsApp.',
      reminder
    };
  }
}

export async function sendOdontologyAppointmentRemindersForAllClients({ now = new Date() } = {}) {
  const stats = {
    scanned: 0,
    sent: 0,
    failed: 0
  };

  for (const reminder of AUTOMATIC_REMINDER_KINDS) {
    const scheduledDate = dateStringInBogota(dateWithOffset(now, reminder.offsetDays));
    const emailAppointments = await listDueReminders({
      scheduledDate,
      reminderKind: reminder.kind,
      channel: 'email'
    });
    stats.scanned += emailAppointments.length;

    for (const appointment of emailAppointments) {
      const result = await sendEmailReminder(appointment, reminder);
      stats.sent += result.sent;
      stats.failed += result.failed;
    }

    const whatsappAppointments = await listDueReminders({
      scheduledDate,
      reminderKind: reminder.kind,
      channel: 'whatsapp'
    });
    stats.scanned += whatsappAppointments.length;

    for (const appointment of whatsappAppointments) {
      const result = await sendWhatsappReminder(appointment, reminder);
      stats.sent += result.sent;
      stats.failed += result.failed;
    }
  }

  return stats;
}
