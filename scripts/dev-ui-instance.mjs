// Full local UI workspace. Never connects to a deployed API or database.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('..', import.meta.url));
const cache = resolve(root, '.cache/ui-instance');
mkdirSync(cache, { recursive: true, mode: 0o700 });
const composeEnv = resolve(root, 'deploy/.env');
if (!existsSync(composeEnv)) {
  const result = spawnSync(process.execPath, ['deploy/init-local-env.mjs'], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(1);
}
const secrets = parseEnv(readFileSync(composeEnv, 'utf8'));
for (const key of ['KLISTENI_DB_PASSWORD', 'BETTER_AUTH_SECRET']) {
  if (!/^[a-f0-9]{64}$/.test(secrets[key] ?? '')) throw new Error(`Unexpected local ${key} format`);
}
const override = resolve(cache, 'compose.yaml');
writeFileSync(override, 'services:\n  db:\n    ports: ["127.0.0.1:54329:5432"]\n', { mode: 0o600 });
const composeArgs = ['compose', '-p', 'klisteni-ui', '--env-file', composeEnv, '-f', resolve(root, 'deploy/compose.local.yaml'), '-f', override, '--profile', 'instance'];
const databaseUrl = new URL('postgresql://127.0.0.1:54329/klisteni');
databaseUrl.username = 'klisteni';
databaseUrl.password = secrets.KLISTENI_DB_PASSWORD;
const apiEnv = resolve(cache, 'api.env');
writeFileSync(apiEnv, [
  `DATABASE_URL=${databaseUrl.href}`,
  `BETTER_AUTH_SECRET=${secrets.BETTER_AUTH_SECRET}`,
  'APP_ORIGIN=http://127.0.0.1:4192', 'HOST=127.0.0.1', 'PORT=3001',
  'NODE_ENV=development', 'BILLING_MODE=disabled', '',
].join('\n'), { mode: 0o600 });
const loginPath = resolve(cache, 'login.private.json');
if (!existsSync(loginPath)) writeFileSync(loginPath, JSON.stringify({
  email: 'ui-admin@example.test', name: 'Prueba local',
  password: `Local-UI-${randomBytes(18).toString('hex')}`,
}), { mode: 0o600, flag: 'wx' });

// Exclude unrelated provider configuration inherited from the operator shell.
const localEnv = { ...process.env };
// Node gives inherited values precedence over --env-file; keep this instance local.
for (const key of ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'APP_ORIGIN', 'HOST', 'PORT', 'NODE_ENV', 'BILLING_MODE']) {
  delete localEnv[key];
}
for (const key of Object.keys(localEnv)) {
  if (/^(?:SMTP_|MP_|VITE_UMAMI_|TRUSTED_CLIENT_IP_HEADER)/.test(key)) delete localEnv[key];
}
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
function run(command, args, options = {}) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd: root, env: localEnv, stdio: 'inherit', ...options });
    children.add(child);
    child.once('error', reject);
    child.once('exit', code => {
      children.delete(child);
      if (code === 0) accept(); else reject(new Error(`${command} exited with ${code}`));
    });
  });
}
try {
  await run('docker', [...composeArgs, 'up', '-d', '--wait', '--wait-timeout', '60', 'db']);
  await run(process.execPath, [`--env-file=${apiEnv}`, 'scripts/seed-ui-instance.ts', loginPath]);
  if (!process.argv.includes('--prepare')) {
    console.info('Local instance: http://127.0.0.1:4192 (API 3001; private PostgreSQL 54329).');
    console.info('Test login is stored privately in .cache/ui-instance/login.private.json.');
    console.info('Ctrl-C stops web/API and keeps local records. Database remains available.');
    await Promise.all([
      run(process.execPath, [`--env-file=${apiEnv}`, '--watch', 'apps/b2c-api/src/server.ts']),
      run('pnpm', ['--filter', '@klisteniapp/b2c-web', 'dev', '--host', '127.0.0.1', '--port', '4192', '--strictPort'], {
        env: { ...localEnv, VITE_APP_MODE: 'instance', KLISTENI_PUBLIC_PROFILE_FILE: resolve(root, 'apps/b2c-web/instance-profile.example.json'), KLISTENI_API_URL: 'http://127.0.0.1:3001' },
      }),
    ]);
  }
} catch (error) {
  if (!stopping) console.error(error instanceof Error ? error.message : 'Local instance failed');
  stop(1);
}
