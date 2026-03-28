import { query } from './db.js';
import { createNotification, listUsersByRoleAndClient } from './maintenance.js';
import { sendNotificationEmail } from './mailer.js';

export async function sendPreventiveRemindersForClient(clientId) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const threeDays = new Date(today);
  threeDays.setDate(threeDays.getDate() + 3);
  const threeDaysStr = threeDays.toISOString().slice(0, 10);

  const { rows } = await query(
    `SELECT id, planned_date
     FROM maintenance_requests
     WHERE client_id = $1
       AND type = 'preventivo'
       AND source = 'cronograma'
       AND status NOT IN ('reportado', 'firmado')
       AND (planned_date = $2 OR planned_date = $3)`,
    [clientId, todayStr, threeDaysStr]
  );

  if (!rows.length) return;

  const engineers = await listUsersByRoleAndClient('ingeniero_biomedico', clientId);
  const almacenistas = await listUsersByRoleAndClient('almacenista', clientId);
  const lectores = await listUsersByRoleAndClient('lector', clientId);
  const recipients = [...engineers, ...almacenistas, ...lectores];

  for (const request of rows) {
    const isToday = request.planned_date === todayStr;
    const reminderField = isToday ? 'reminder_day_sent_at' : 'reminder_3_sent_at';

    const alreadySent = await query(
      `SELECT 1
       FROM maintenance_requests
       WHERE id = $1 AND ${reminderField} IS NOT NULL`,
      [request.id]
    );
    if (alreadySent.rows.length) continue;

    const title = isToday
      ? 'Inicio de mantenimiento preventivo'
      : 'Recordatorio: mantenimiento preventivo próximo';
    const message = isToday
      ? `Hoy inicia el mantenimiento preventivo programado (${request.planned_date}).`
      : `Faltan 3 días para iniciar el mantenimiento preventivo (${request.planned_date}).`;

    for (const user of recipients) {
      await createNotification({
        userId: user.id,
        clientId,
        title,
        message,
        link: '/mantenimiento'
      });
      if (user.email) {
        try {
          await sendNotificationEmail({
            to: user.email,
            subject: title,
            text: message
          });
        } catch (error) {
          console.error('Email notificación falló', error);
        }
      }
    }

    await query(
      `UPDATE maintenance_requests
       SET ${reminderField} = NOW()
       WHERE id = $1`,
      [request.id]
    );
  }
}

export async function sendPreventiveRemindersForAllClients() {
  const { rows } = await query('SELECT id FROM clients');
  for (const row of rows) {
    await sendPreventiveRemindersForClient(row.id);
  }
}

async function listLectorUsersForArea(clientId, areaId, schema) {
  const { rows } = await query(
    `SELECT DISTINCT u.id, u.email, u.display_name
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     JOIN reader_access ra ON ra.user_id = u.id AND ra.client_id = $1
     LEFT JOIN "${schema}".locations lo ON lo.id = ra.location_id
     WHERE u.client_id = $1
       AND u.is_active = TRUE
       AND r.name = 'lector'
       AND (ra.area_id = $2 OR lo.area_id = $2)`,
    [clientId, areaId]
  );
  return rows;
}

export async function sendTrainingRemindersForClient(clientId) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const threeDays = new Date(today);
  threeDays.setDate(threeDays.getDate() + 3);
  const threeDaysStr = threeDays.toISOString().slice(0, 10);

  const clientResult = await query('SELECT schema_name FROM clients WHERE id = $1', [clientId]);
  const schema = clientResult.rows[0]?.schema_name;
  if (!schema) return;

  const { rows } = await query(
    `SELECT id, area_id, planned_date
     FROM training_schedule_items
     WHERE planned_date IN ($1, $2)
       AND status <> 'done'`,
    [todayStr, threeDaysStr]
  );
  if (!rows.length) return;

  const engineers = await listUsersByRoleAndClient('ingeniero_biomedico', clientId);
  const almacenistas = await listUsersByRoleAndClient('almacenista', clientId);

  for (const item of rows) {
    const isToday = item.planned_date === todayStr;
    const reminderField = isToday ? 'reminder_day_sent_at' : 'reminder_3_sent_at';

    const alreadySent = await query(
      `SELECT 1
       FROM training_schedule_items
       WHERE id = $1 AND ${reminderField} IS NOT NULL`,
      [item.id]
    );
    if (alreadySent.rows.length) continue;

    const lectores = await listLectorUsersForArea(clientId, item.area_id, schema);
    const recipients = [...engineers, ...almacenistas, ...lectores];
    const uniqueRecipients = new Map();
    for (const user of recipients) {
      uniqueRecipients.set(user.id, user);
    }

    const title = isToday
      ? 'Inicio de capacitación programada'
      : 'Recordatorio: capacitación próxima';
    const message = isToday
      ? `Hoy inicia la capacitación programada (${item.planned_date}).`
      : `Faltan 3 días para la capacitación programada (${item.planned_date}).`;

    for (const user of uniqueRecipients.values()) {
      await createNotification({
        userId: user.id,
        clientId,
        title,
        message,
        link: '/cronogramas'
      });
      if (user.email) {
        try {
          await sendNotificationEmail({
            to: user.email,
            subject: title,
            text: message
          });
        } catch (error) {
          console.error('Email notificación falló', error);
        }
      }
    }

    await query(
      `UPDATE training_schedule_items
       SET ${reminderField} = NOW()
       WHERE id = $1`,
      [item.id]
    );
  }
}

export async function sendTrainingRemindersForAllClients() {
  const { rows } = await query('SELECT id FROM clients');
  for (const row of rows) {
    await sendTrainingRemindersForClient(row.id);
  }
}

export async function sendCalibrationRemindersForClient(clientId) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const week = new Date(today);
  week.setDate(week.getDate() + 7);
  const weekStr = week.toISOString().slice(0, 10);

  const clientResult = await query('SELECT schema_name FROM clients WHERE id = $1', [clientId]);
  const schema = clientResult.rows[0]?.schema_name;
  if (!schema) return;

  const { rows } = await query(
    `SELECT i.id, i.planned_date, a.area_id
     FROM calibration_schedule_items i
     JOIN calibration_schedules s ON s.id = i.schedule_id
     JOIN "${schema}".assets a ON a.id = i.asset_id
     WHERE s.client_id = $1
       AND i.status <> 'done'
       AND i.planned_date IN ($2, $3)`,
    [clientId, todayStr, weekStr]
  );
  if (!rows.length) return;

  const almacenistas = await listUsersByRoleAndClient('almacenista', clientId);

  for (const item of rows) {
    const isToday = item.planned_date === todayStr;
    const reminderField = isToday ? 'reminder_day_sent_at' : 'reminder_week_sent_at';

    const alreadySent = await query(
      `SELECT 1
       FROM calibration_schedule_items
       WHERE id = $1 AND ${reminderField} IS NOT NULL`,
      [item.id]
    );
    if (alreadySent.rows.length) continue;

    const lectores = await listLectorUsersForArea(clientId, item.area_id, schema);
    const recipients = [...almacenistas, ...lectores];
    const uniqueRecipients = new Map();
    for (const user of recipients) {
      uniqueRecipients.set(user.id, user);
    }

    const title = isToday
      ? 'Inicio de calibración programada'
      : 'Recordatorio: calibración próxima';
    const message = isToday
      ? `Hoy inicia la calibración programada (${item.planned_date}).`
      : `Faltan 7 días para la calibración programada (${item.planned_date}).`;

    for (const user of uniqueRecipients.values()) {
      await createNotification({
        userId: user.id,
        clientId,
        title,
        message,
        link: '/calibraciones'
      });
      if (user.email) {
        try {
          await sendNotificationEmail({
            to: user.email,
            subject: title,
            text: message
          });
        } catch (error) {
          console.error('Email notificación falló', error);
        }
      }
    }

    await query(
      `UPDATE calibration_schedule_items
       SET ${reminderField} = NOW()
       WHERE id = $1`,
      [item.id]
    );
  }
}

export async function sendCalibrationRemindersForAllClients() {
  const { rows } = await query('SELECT id FROM clients');
  for (const row of rows) {
    await sendCalibrationRemindersForClient(row.id);
  }
}
