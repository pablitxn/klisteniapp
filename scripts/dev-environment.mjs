// Private settings for the root Compose + Turbo workflow. Existing files survive.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

export const root = fileURLToPath(new URL('..', import.meta.url));
const secretKeys = ['DEV_POSTGRES_PASSWORD', 'DEV_DB_PASSWORD', 'DEV_AUTH_SECRET',
  'DEV_B2B_POSTGRES_PASSWORD', 'DEV_B2B_DB_PASSWORD', 'DEV_B2B_AUTH_SECRET'];

function createPrivate(path, content) {
  if (!existsSync(path)) writeFileSync(path, content, { mode: 0o600, flag: 'wx' });
}
function envText(values) {
  return '# Generated local development settings. Never commit or share.\n'
    + Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
}

export function setupDev(directory = root) {
  const cache = resolve(directory, '.cache/dev');
  mkdirSync(cache, { recursive: true, mode: 0o700 });
  const composeEnv = resolve(directory, '.env');
  createPrivate(composeEnv, envText(Object.fromEntries(secretKeys.map(key => [key, randomBytes(32).toString('hex')]))));
  const secrets = parseEnv(readFileSync(composeEnv, 'utf8'));
  for (const key of secretKeys) {
    if (!/^[a-f0-9]{64}$/.test(secrets[key] ?? '')) throw new Error(`Root .env is missing a valid ${key}; existing settings were preserved.`);
  }
  if (secrets.DEV_AUTH_SECRET === secrets.DEV_B2B_AUTH_SECRET) throw new Error('Local B2C and B2B auth secrets must differ.');

  const loginPath = resolve(cache, 'b2c-login.private.json');
  createPrivate(loginPath, JSON.stringify({ email: 'dev-admin@example.test', name: 'Admin local', password: `Local-${randomBytes(18).toString('hex')}` }, null, 2) + '\n');
  const passwordPath = resolve(cache, 'b2b-password.env');
  createPrivate(passwordPath, envText({ B2B_DEMO_PASSWORD: `Demo-${randomBytes(18).toString('hex')}` }));
  const password = parseEnv(readFileSync(passwordPath, 'utf8')).B2B_DEMO_PASSWORD;
  if (!password || password.length < 12 || password.length > 128) throw new Error('Invalid local B2B demo password; existing settings were preserved.');

  const b2c = {
    DATABASE_URL: `postgresql://klisteni:${secrets.DEV_DB_PASSWORD}@127.0.0.1:54331/klisteni`,
    BETTER_AUTH_SECRET: secrets.DEV_AUTH_SECRET, APP_ORIGIN: 'http://127.0.0.1:5173',
    HOST: '127.0.0.1', PORT: '3001', NODE_ENV: 'development', BILLING_MODE: 'disabled',
  };
  const b2b = {
    B2B_DATABASE_URL: `postgresql://klisteni_b2b:${secrets.DEV_B2B_DB_PASSWORD}@127.0.0.1:54332/klisteni_b2b_demo`,
    B2B_MIGRATION_DATABASE_URL: `postgresql://postgres:${secrets.DEV_B2B_POSTGRES_PASSWORD}@127.0.0.1:54332/klisteni_b2b_demo`,
    B2B_AUTH_SECRET: secrets.DEV_B2B_AUTH_SECRET, B2B_APP_ORIGIN: 'http://127.0.0.1:4200',
    B2B_HOST: '127.0.0.1', B2B_PORT: '4201', B2B_DEMO_MODE: 'true',
    B2B_MEDIA_ROOT: resolve(cache, 'media'), B2B_MEDIA_QUOTA_MB: '256',
    B2B_DEMO_PASSWORD: password, NODE_ENV: 'development',
  };
  const web = {
    VITE_APP_MODE: 'instance', KLISTENI_PUBLIC_PROFILE_FILE: './instance-profile.example.json',
    KLISTENI_API_URL: 'http://127.0.0.1:3001',
  };
  for (const [app, expected] of [['b2c-api', b2c], ['b2b-api', b2b], ['b2c-web', web]]) {
    const path = resolve(directory, `apps/${app}/.env.development.local`);
    createPrivate(path, envText(expected));
    const actual = parseEnv(readFileSync(path, 'utf8'));
    for (const [key, value] of Object.entries(expected)) {
      if (actual[key] !== value) throw new Error(`apps/${app}/.env.development.local has a conflicting ${key}; existing settings were preserved.`);
    }
  }
  return { b2c, b2b, cache, loginPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    setupDev();
    console.info('Local settings ready. Run docker compose up and turbo run dev in separate terminals.');
    console.info('Private demo logins: .cache/dev/b2c-login.private.json and .cache/dev/b2b-password.env');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
