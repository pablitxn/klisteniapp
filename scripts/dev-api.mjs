// Watch this entrypoint so Node tracks the API's imported TypeScript modules.
// Local settings take precedence over credentials inherited from the shell.
import { setupDev } from './dev-environment.mjs';

const product = process.argv[2];
if (!['b2c', 'b2b'].includes(product)) throw new Error('Use dev-api.mjs b2c|b2b');
const local = setupDev();
for (const key of Object.keys(process.env)) {
  if (/^(?:DATABASE_URL|TEST_DATABASE_URL|BETTER_AUTH_SECRET|APP_ORIGIN|HOST|PORT|NODE_ENV|TRUSTED_CLIENT_IP_HEADER|BILLING_MODE|SMTP_.*|MP_.*|B2B_.*)$/.test(key)) delete process.env[key];
}
const env = { ...(product === 'b2c' ? local.b2c : local.b2b) };
for (const key of ['B2B_MIGRATION_DATABASE_URL', 'B2B_DEMO_PASSWORD']) delete env[key];
Object.assign(process.env, env);
await import(product === 'b2c' ? '../apps/b2c-api/src/server.ts' : '../apps/b2b-api/src/server.ts');
