// Disposable local fixture using the same authentication/state code as accounts.
import { readFileSync } from 'node:fs';
import { readConfig } from '../apps/api/src/config.ts';
import { createPool } from '../apps/api/src/database.ts';
import { createAuth } from '../apps/api/src/auth.ts';
import { migrate } from '../apps/api/src/migrate.ts';
import { createProvisionedUser } from '../apps/api/src/operator-service.ts';
import { StateRepository } from '../apps/api/src/state.ts';

const config = readConfig();
const database = new URL(config.databaseUrl);
if (config.production || config.origin !== 'http://127.0.0.1:4192'
  || database.hostname !== '127.0.0.1' || database.port !== '54329' || database.pathname !== '/klisteni'
  || config.smtp || config.billing) throw new Error('UI fixture requires the isolated local development configuration');
const login = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as { email: string; name: string; password: string };
if (login.email !== 'ui-admin@example.test') throw new Error('Unexpected local fixture account');
const pool = createPool(config);
try {
  await migrate(pool, createAuth(pool, config));
  const existing = await pool.query<{ id: string; name: string }>('SELECT id, name FROM auth_user WHERE email = $1', [login.email]);
  const user = existing.rows[0] ?? await createProvisionedUser(pool, config, login);
  await pool.query("UPDATE auth_user SET role = 'admin' WHERE id = $1", [user.id]);
  await pool.query('UPDATE account_access SET lifetime = true WHERE user_id = $1', [user.id]);
  await new StateRepository(pool).get(user);
  console.info('Local schema ready; isolated test administrator available. Existing practice is preserved.');
} finally { await pool.end(); }
