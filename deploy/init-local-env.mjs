// Local convenience only: writes new secrets with mode 0600, never prints them.
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const path = fileURLToPath(new URL('.env', import.meta.url));
const secret = () => randomBytes(32).toString('hex');
try {
  writeFileSync(path, `# Local Compose only. Never commit or share this file.\nPOSTGRES_ADMIN_PASSWORD=${secret()}\nKLISTENI_DB_PASSWORD=${secret()}\nBETTER_AUTH_SECRET=${secret()}\n`, { mode: 0o600, flag: 'wx' });
  console.info('Created deploy/.env with private local secrets. Existing files are never replaced.');
} catch (error) {
  if (error.code === 'EEXIST') throw new Error('deploy/.env already exists; kept unchanged.');
  throw error;
}
