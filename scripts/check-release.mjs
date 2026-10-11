// Release verification is deliberately serial: browser suites own build outputs.
// Both database URLs must point to disposable databases; no silent integration skips.
import { spawnSync } from 'node:child_process';

const steps = [
  'check',
  'test:api',
  'test:accounts',
  'test:b2b:api',
  'test:b2b:e2e',
  'test:e2e',
  'test:analytics',
];
const browserSteps = new Set(['test:accounts', 'test:b2b:e2e', 'test:e2e', 'test:analytics']);
const argumentsFor = step => [step, ...(browserSteps.has(step) ? ['--retries=0'] : [])];
if (process.argv.includes('--list')) {
  console.info(steps.map(step => `pnpm ${argumentsFor(step).join(' ')}`).join('\n'));
  process.exit(0);
}
function testDatabase(key) {
  let url;
  try { url = new URL(process.env[key]); } catch { /* Report names, never credentials. */ }
  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol) || !/(?:test|demo)/i.test(url.pathname)) {
    throw new Error(`${key} must identify an explicitly disposable test/demo PostgreSQL database.`);
  }
  return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
}
try {
  if (testDatabase('TEST_DATABASE_URL') === testDatabase('B2B_TEST_DATABASE_URL')) {
    throw new Error('B2B and B2C verification require independent databases.');
  }
  for (const step of steps) {
    const env = { ...process.env };
    if (step === 'check') {
      delete env.TEST_DATABASE_URL;
      delete env.B2B_TEST_DATABASE_URL;
    }
    const args = argumentsFor(step);
    console.info(`\nRelease verification: pnpm ${args.join(' ')}`);
    const result = spawnSync('pnpm', args, { env, stdio: 'inherit' });
    if (result.error) throw new Error(`Could not start pnpm ${step}: ${result.error.message}`);
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  console.info('Release code checks passed. Record deployment and physical-device acceptance separately.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Release verification failed.');
  process.exitCode = 1;
}
