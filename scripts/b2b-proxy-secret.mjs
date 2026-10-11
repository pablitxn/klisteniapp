// Generates a local protected Nginx map; never print the shared secret.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const secret = process.env.B2B_PROXY_SECRET;
if (!secret || !/^[a-zA-Z0-9_-]{32,256}$/.test(secret)) {
  throw new Error('B2B_PROXY_SECRET must contain 32-256 URL-safe characters');
}
if (!process.argv[2]) throw new Error('Provide a private output file path');
writeFileSync(resolve(process.argv[2]), `map "" $b2b_proxy_secret { default "${secret}"; }\n`, { mode: 0o600, flag: 'wx' });
