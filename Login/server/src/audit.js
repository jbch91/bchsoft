import { query } from './db.js';

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

export async function listAuditLogs(limit = 50) {
  const { rows } = await query(
    `SELECT id, actor_user_id, actor_username, action, target_user_id, target_username, details, created_at
     FROM audit_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}
