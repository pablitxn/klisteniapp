import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { createAuth } from './auth.ts';
import { AccountAdministration } from './accounts.ts';
import { readConfig } from './config.ts';
import { createPool } from './database.ts';
import { HttpError } from './errors.ts';
import { createProvisionedUser, operateUser, PasswordSchema } from './operator-service.ts';

function hiddenPrompt(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('A terminal is required, or pass --password-stdin');
  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = process.stdin.isRaw;
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = (error?: Error) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003' || character === '\u0004') { finish(new Error('Cancelled')); return; }
        if (character === '\r' || character === '\n') { finish(); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ' && value.length < 128) value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function passwordFromInput(fromPipe: boolean): Promise<string> {
  if (fromPipe) {
    if (process.stdin.isTTY) throw new Error('--password-stdin expects a pipe');
    let value = '';
    for await (const chunk of process.stdin) {
      value += String(chunk);
      if (value.length > 1024) throw new Error('Password input too long');
    }
    value = value.replace(/\r?\n$/, '');
    if (/[\r\n]/.test(value)) throw new Error('Expected one password line');
    return PasswordSchema.parse(value);
  }
  const password = PasswordSchema.parse(await hiddenPrompt('Contraseña (12–128 caracteres): '));
  if (password !== await hiddenPrompt('Repetí la contraseña: ')) throw new Error('Passwords do not match');
  return password;
}

export async function main(): Promise<void> {
  const { positionals, values } = parseArgs({ allowPositionals: true, strict: true, options: {
    email: { type: 'string' }, name: { type: 'string' }, 'send-email': { type: 'boolean', default: false }, 'show-link': { type: 'boolean', default: false }, reissue: { type: 'boolean', default: false }, 'password-stdin': { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
  } });
  if (values.help) {
    console.info('users <bootstrap|recovery> --email EMAIL [--name NAME] [--send-email] [--show-link] [--reissue]\nusers <create|reset-password|disable|enable|revoke-sessions> --email EMAIL [--name NAME] [--password-stdin]');
    return;
  }
  const [action] = positionals;
  if (positionals.length !== 1 || !['bootstrap', 'recovery', 'create', 'reset-password', 'disable', 'enable', 'revoke-sessions'].includes(action) || !values.email) throw new Error('Invalid operator command; use --help');
  if (['create', 'bootstrap'].includes(action) && !values.name) throw new Error('--name is required');
  if (['bootstrap', 'recovery'].includes(action) && !values['send-email'] && !values['show-link']) throw new Error('Choose --send-email or --show-link explicitly');
  const config = readConfig();
  let pool: Pool | undefined;
  try {
    const password = ['create', 'reset-password'].includes(action) ? await passwordFromInput(values['password-stdin']) : undefined;
    pool = createPool(config);
    if (action === 'bootstrap' || action === 'recovery') {
      const service = new AccountAdministration(pool, createAuth(pool, config), config);
      const target = action === 'recovery' ? await pool.query<{ id: string }>('SELECT id FROM auth_user WHERE email = $1', [values.email.toLowerCase()]) : null;
      if (action === 'recovery' && !target?.rows[0]) throw new HttpError(404, 'USER_NOT_FOUND', 'No existe ese usuario.');
      const result = action === 'bootstrap'
        ? await service.bootstrap({ email: values.email, name: values.name!, sendEmail: values['send-email'], reissue: values.reissue })
        : await service.recovery(undefined, target!.rows[0].id, values['send-email']);
      console.info(JSON.stringify({ invitation: result.invitation, delivery: result.delivery }));
      // This is an explicit operator export, never an HTTP/application log.
      if (values['show-link']) console.info(result.url);
      if (values['send-email'] && result.delivery.status !== 'smtp_accepted') process.exitCode = 1;
      return;
    }
    const id = action === 'create'
      ? (await createProvisionedUser(pool, config, { email: values.email, name: values.name!, password: password! })).id
      : await operateUser(pool, createAuth(pool, config), values.email, action as 'reset-password' | 'disable' | 'enable' | 'revoke-sessions', password);
    console.info(`${action} completed for user ${id}`);
  } finally { await pool?.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); }
  catch (error) {
    console.error(error instanceof HttpError ? error.message : 'Operator command failed. Check arguments, password requirements, and database access.');
    process.exitCode = 1;
  }
}
