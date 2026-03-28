import { query } from './db.js';

export async function listReaderAccess(userId, clientId) {
  const { rows } = await query(
    'SELECT area_id, location_id FROM reader_access WHERE user_id = $1 AND client_id = $2',
    [userId, clientId]
  );
  return rows;
}

export async function replaceReaderAccess(userId, clientId, areaIds, locationIds) {
  await query('DELETE FROM reader_access WHERE user_id = $1 AND client_id = $2', [userId, clientId]);
  for (const areaId of areaIds) {
    await query(
      'INSERT INTO reader_access (user_id, client_id, area_id, location_id) VALUES ($1,$2,$3,$4)',
      [userId, clientId, areaId, null]
    );
  }
  for (const locationId of locationIds) {
    await query(
      'INSERT INTO reader_access (user_id, client_id, area_id, location_id) VALUES ($1,$2,$3,$4)',
      [userId, clientId, null, locationId]
    );
  }
}
