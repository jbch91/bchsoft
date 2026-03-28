import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { query, pool } from '../src/db.js';

dotenv.config();

async function seedSuperUser() {
  const username = 'bch';
  const displayName = 'Super Usuario BCH';
  const password = 'bch';
  const passwordHash = await bcrypt.hash(password, 12);

  const { rows: existing } = await query(
    'SELECT id FROM users WHERE username = $1',
    [username]
  );

  let userId;
  if (existing.length) {
    userId = existing[0].id;
  } else {
    const { rows } = await query(
      'INSERT INTO users (username, display_name, password_hash) VALUES ($1,$2,$3) RETURNING id',
      [username, displayName, passwordHash]
    );
    userId = rows[0].id;
  }

  const { rows: roleRows } = await query(
    'SELECT id FROM roles WHERE name = $1',
    ['superuser']
  );

  if (roleRows.length) {
    await query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, roleRows[0].id]
    );
  }

  console.log('Superuser listo. Usuario: bch / contraseña: bch');
}

async function run() {
  try {
    await seedSuperUser();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
