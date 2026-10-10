import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../.cache/b2b', import.meta.url));
mkdirSync(directory, { recursive: true, mode: 0o700 });
const filename = resolve(directory, 'local.env');
if (!existsSync(filename)) {
  const db = randomBytes(32).toString('hex');
  const postgres = randomBytes(32).toString('hex');
  writeFileSync(filename, [
    `B2B_POSTGRES_PASSWORD=${postgres}`, `B2B_DB_PASSWORD=${db}`,
    `B2B_DATABASE_URL=postgresql://klisteni_b2b:${db}@127.0.0.1:54330/klisteni_b2b_demo`,
    `B2B_MIGRATION_DATABASE_URL=postgresql://postgres:${postgres}@127.0.0.1:54330/klisteni_b2b_demo`,
    `B2B_AUTH_SECRET=${randomBytes(32).toString('hex')}`,
    `B2B_DEMO_PASSWORD=Demo-${randomBytes(18).toString('hex')}`,
    `B2B_MEDIA_ROOT=${resolve(directory, 'media')}`, 'B2B_MEDIA_QUOTA_MB=256',
    'B2B_APP_ORIGIN=http://127.0.0.1:4200', 'B2B_HOST=127.0.0.1', 'B2B_PORT=4201',
    'B2B_DEMO_MODE=true', 'NODE_ENV=development', '',
  ].join('\n'), { mode: 0o600, flag: 'wx' });
}
console.info('Local B2B configuration is in .cache/b2b/local.env (private; never commit).');
