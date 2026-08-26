import { query, withTransaction } from './db.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function accessError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeIds(values, label) {
  const unique = Array.from(
    new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))
  );
  if (unique.some((value) => !UUID_PATTERN.test(value))) {
    throw accessError('INVALID_AREA_SCOPE', `${label} contienen un identificador inválido.`);
  }
  return unique;
}

export async function listReaderAccess(userId, clientId) {
  const { rows } = await query(
    'SELECT area_id, location_id FROM reader_access WHERE user_id = $1 AND client_id = $2',
    [userId, clientId]
  );
  return rows;
}

export async function replaceReaderAccess(userId, clientId, areaIds, locationIds) {
  const safeAreaIds = normalizeIds(areaIds, 'Las áreas');
  const safeLocationIds = normalizeIds(locationIds, 'Las ubicaciones');

  return withTransaction(async (client) => {
    const { rows: scopeRows } = await client.query(
      `SELECT c.schema_name, u.client_id,
              ARRAY_REMOVE(ARRAY_AGG(r.name), NULL) AS roles
       FROM clients c
       JOIN users u ON u.id = $1
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE c.id = $2
       GROUP BY c.schema_name, u.client_id`,
      [userId, clientId]
    );
    const scope = scopeRows[0];
    if (!scope || scope.client_id !== clientId) {
      throw accessError('INVALID_AREA_SCOPE', 'El usuario no pertenece al cliente seleccionado.');
    }
    if (!scope.roles?.some((role) => ['lector', 'responsable_area'].includes(role))) {
      throw accessError('INVALID_AREA_SCOPE_ROLE', 'Este usuario no utiliza alcance por áreas o ubicaciones.');
    }

    const schema = scope.schema_name;
    if (safeAreaIds.length) {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS count FROM "${schema}".areas WHERE id = ANY($1::uuid[])`,
        [safeAreaIds]
      );
      if (rows[0]?.count !== safeAreaIds.length) {
        throw accessError('INVALID_AREA_SCOPE', 'Una o más áreas no pertenecen al cliente.');
      }
    }
    if (safeLocationIds.length) {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS count FROM "${schema}".locations WHERE id = ANY($1::uuid[])`,
        [safeLocationIds]
      );
      if (rows[0]?.count !== safeLocationIds.length) {
        throw accessError('INVALID_AREA_SCOPE', 'Una o más ubicaciones no pertenecen al cliente.');
      }
    }

    await client.query(
      'DELETE FROM reader_access WHERE user_id = $1 AND client_id = $2',
      [userId, clientId]
    );
    if (safeAreaIds.length) {
      await client.query(
        `INSERT INTO reader_access (user_id, client_id, area_id, location_id)
         SELECT $1, $2, area_id, NULL::uuid
         FROM UNNEST($3::uuid[]) AS scoped(area_id)`,
        [userId, clientId, safeAreaIds]
      );
    }
    if (safeLocationIds.length) {
      await client.query(
        `INSERT INTO reader_access (user_id, client_id, area_id, location_id)
         SELECT $1, $2, NULL::uuid, location_id
         FROM UNNEST($3::uuid[]) AS scoped(location_id)`,
        [userId, clientId, safeLocationIds]
      );
    }

    return { areaIds: safeAreaIds, locationIds: safeLocationIds };
  });
}
