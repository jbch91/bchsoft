import {
  sendPreventiveRemindersForAllClients,
  sendTrainingRemindersForAllClients,
  sendCalibrationRemindersForAllClients
} from '../src/preventive-reminders.js';
import { pool } from '../src/db.js';

try {
  await sendPreventiveRemindersForAllClients();
  await sendTrainingRemindersForAllClients();
  await sendCalibrationRemindersForAllClients();
} catch (error) {
  console.error('Error enviando recordatorios preventivos', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
