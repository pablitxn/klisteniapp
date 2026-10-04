import { Pool } from 'pg';
import type { Config } from './config.ts';

export function createPool(config: Pick<Config, 'databaseUrl'>, max = 10): Pool {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    application_name: 'klisteniapp-api',
  });
  pool.on('error', () => { console.error('PostgreSQL idle connection failed'); });
  return pool;
}

export const APP_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS personal_state (
  user_id text PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  settings jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS personal_log (
  user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('workout', 'cardio')),
  payload jsonb,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  CHECK ((deleted AND payload IS NULL) OR (NOT deleted AND payload IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS account_token (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('activation', 'recovery')),
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  user_id text REFERENCES auth_user(id) ON DELETE CASCADE,
  created_by text REFERENCES auth_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'not_requested'
    CHECK (delivery_status IN ('not_requested', 'smtp_accepted', 'unavailable', 'failed')),
  smtp_accepted_at timestamptz
);
CREATE INDEX IF NOT EXISTS account_token_email_idx ON account_token(email);
CREATE TABLE IF NOT EXISTS account_bootstrap (
  id text PRIMARY KEY CHECK (id = 'first-admin'),
  token_id text NOT NULL REFERENCES account_token(id)
);
CREATE TABLE IF NOT EXISTS account_rate_limit (
  key text PRIMARY KEY,
  count integer NOT NULL,
  expires_at timestamptz NOT NULL
);
`;
