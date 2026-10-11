// Complete, isolated local B2B environment. Secrets stay in ignored .cache/b2b.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { createGateway } from './b2b-gateway.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const children = new Set();
let stopping = false;
let gateway;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  gateway?.close();
  for (const child of children) {
    try { if (process.platform === 'win32') child.kill('SIGTERM'); else process.kill(-child.pid, 'SIGTERM'); }
    catch { /* Already exited. */ }
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop());
function run(command, args, { env = process.env, capture = false } = {}) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd: root, env, detached: process.platform !== 'win32', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    children.add(child);
    let output = '';
    if (capture) child.stdout.on('data', data => { output += data; });
    child.once('error', reject);
    child.once('exit', code => {
      children.delete(child);
      if (code === 0 || stopping) accept(output); else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

try {
  await run(process.execPath, ['deploy/init-b2b-env.mjs']);
  const envFile = resolve(root, '.cache/b2b/local.env');
  const local = parseEnv(readFileSync(envFile, 'utf8'));
  // Refuse an edited env that accidentally points this local helper at a real DB.
  for (const key of ['B2B_DATABASE_URL', 'B2B_MIGRATION_DATABASE_URL']) {
    const url = new URL(local[key]);
    if (url.hostname !== '127.0.0.1' || url.port !== '54330' || url.pathname !== '/klisteni_b2b_demo') throw new Error(`Unexpected local ${key} destination`);
  }
  if (local.B2B_APP_ORIGIN !== 'http://127.0.0.1:4200' || local.B2B_DEMO_MODE !== 'true') throw new Error('Unexpected local B2B origin or demo mode');
  const env = { ...process.env, ...local };
  // Keep local uploads inside the private B2B directory, including existing env files.
  env.B2B_MEDIA_ROOT = resolve(root, '.cache/b2b/media');
  env.B2B_MEDIA_QUOTA_MB = local.B2B_MEDIA_QUOTA_MB ?? '256';
  for (const key of Object.keys(env)) {
    if (/^(DATABASE_URL|TEST_DATABASE_URL|BETTER_AUTH_SECRET|APP_ORIGIN|BILLING_MODE|SMTP_|MP_|VITE_UMAMI_)/.test(key)) delete env[key];
  }
  await run('docker', ['compose', '--env-file', envFile, '-f', 'deploy/compose.b2b.yaml', 'up', '-d', '--wait', '--wait-timeout', '60', 'db'], { env });
  await run(process.execPath, ['apps/b2b-api/src/migrate.ts'], { env });
  const reset = process.argv.includes('--reset-demo');
  if (reset) await run(process.execPath, ['apps/b2b-api/src/operator.ts', 'reset-demo', '--confirm-demo-reset'], { env, capture: true });
  const seed = await run(process.execPath, ['apps/b2b-api/src/operator.ts', 'seed-demo'], { env, capture: true });
  writeFileSync(resolve(root, '.cache/b2b/demo.private.json'), seed, { mode: 0o600 });
  console.info('B2B: http://127.0.0.1:4200/g/atlas-demo · Gestión: http://127.0.0.1:4200/manage');
  console.info('Demo accounts are in .cache/b2b/demo.private.json; password is B2B_DEMO_PASSWORD in .cache/b2b/local.env.');
  if (!process.argv.includes('--prepare')) {
    const built = process.argv.includes('--built');
    if (built) await run('pnpm', ['build:b2b'], { env });
    const runtime = { ...env };
    for (const key of ['B2B_MIGRATION_DATABASE_URL', 'B2B_POSTGRES_PASSWORD', 'B2B_DB_PASSWORD', 'B2B_DEMO_PASSWORD']) delete runtime[key];
    gateway = createGateway({ built });
    await new Promise((accept, reject) => { gateway.once('error', reject); gateway.listen(4200, '127.0.0.1', accept); });
    const servers = [run(process.execPath, ['apps/b2b-api/src/server.ts'], { env: runtime })];
    if (!built) {
      servers.push(run('pnpm', ['--filter', '@klisteniapp/b2b-web', 'dev'], { env: runtime }));
    }
    console.info('Ctrl-C stops B2B applications. Its local database and demo records remain available.');
    await Promise.race(servers);
    stop();
    await Promise.allSettled(servers);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'B2B local startup failed');
  stop(1);
}
