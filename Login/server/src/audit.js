import { query } from './db.js';

const ADMIN_AUDIT_ACTION_FILTER = [
  "al.action LIKE 'CLIENT_%'",
  "al.action LIKE 'SUBSCRIPTION_%'",
  "al.action LIKE 'ROLE_%'",
  "al.action LIKE 'BIOMEDICAL_CATALOG_%'",
  `(
    al.action LIKE 'USER_%'
    AND COALESCE(al.details->>'clientId', '') = ''
    AND NOT EXISTS (
      SELECT 1
      FROM users target_user
      WHERE target_user.id = al.target_user_id
        AND target_user.client_id IS NOT NULL
    )
  )`
].join(' OR ');

export async function logAudit({
  actorUserId,
  actorUsername,
  action,
  targetUserId,
  targetUsername,
  details
}) {
  await query(
    `INSERT INTO audit_logs
     (actor_user_id, actor_username, action, target_user_id, target_username, details)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [actorUserId, actorUsername, action, targetUserId, targetUsername, details || null]
  );
}

export async function listAuditLogs(limit = 50, options = {}) {
  const params = [];
  const filters = [];
  if (options.adminOnly) {
    filters.push(`(${ADMIN_AUDIT_ACTION_FILTER})`);
  }
  if (options.odontologyOnly) {
    filters.push("al.action LIKE 'ODONTOLOGY_%'");
  }
  if (options.clientId) {
    params.push(options.clientId);
    filters.push(`al.details->>'clientId' = $${params.length}`);
  }
  if (options.actorClientId) {
    params.push(options.actorClientId);
    filters.push(`EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = al.actor_user_id
        AND u.client_id = $${params.length}
    )`);
  }
  params.push(limit);
  const { rows } = await query(
    `SELECT al.id, al.actor_user_id, al.actor_username, al.action, al.target_user_id, al.target_username, al.details, al.created_at
     FROM audit_logs al
     ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
     ORDER BY al.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}
