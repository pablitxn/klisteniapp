/** Platform operator only. No HTTP route exposes domain activation or reassignment. */
import { randomBytes } from 'node:crypto';
import { resolve4, resolve6, resolveTxt } from 'node:dns/promises';
import { connect } from 'node:tls';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { normalizeDomainHost } from './domain-context.ts';
import { readConfig } from './config.ts';
import { createPool } from './database.ts';

type DomainRow = {
  host: string;
  organization_id: string;
  status: 'requested' | 'verified' | 'active' | 'paused';
  primary_domain: boolean;
  generation: number;
  verification_token: string;
  verified_at: Date | null;
  dns_verified_at: Date | null;
  tls_verified_at: Date | null;
  tls_expires_at: Date | null;
};
export type DomainEvidence = {
  ownership: boolean;
  addresses: string[];
  tlsExpiresAt: string;
  certificateFingerprint: string;
};
export type DomainProbe = (host: string, challenge: string) => Promise<DomainEvidence>;

async function transaction<T>(pool: Pool, run: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    // Serialize domain lifecycle changes, including principal replacement and reassignment.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('b2b:domain-lifecycle',0))");
    const result = await run(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

async function domain(db: PoolClient, host: string): Promise<DomainRow> {
  const row = (
    await db.query<DomainRow>('SELECT * FROM b2b_domain WHERE host=$1 FOR UPDATE', [host])
  ).rows[0];
  if (!row) throw new Error('Unknown B2B domain');
  return row;
}
async function audit(db: PoolClient, row: DomainRow, action: string) {
  await db.query('INSERT INTO b2b_audit(organization_id,action,resource_id) VALUES($1,$2,$3)', [
    row.organization_id,
    `domain.${action}`,
    row.host,
  ]);
}

export async function requestDomain(pool: Pool, organizationId: string, input: string) {
  const host = normalizeDomainHost(input),
    token = randomBytes(24).toString('hex');
  return transaction(pool, async (db) => {
    const existing = (await db.query<DomainRow>('SELECT * FROM b2b_domain WHERE host=$1', [host]))
      .rows[0];
    if (existing) throw new Error('Domain already registered; pausing does not release ownership');
    const row = (
      await db.query<DomainRow>(
        `INSERT INTO b2b_domain(host,organization_id,verification_token) VALUES($1,$2,$3) RETURNING *`,
        [host, organizationId, token],
      )
    ).rows[0];
    await audit(db, row, 'requested');
    return {
      host,
      organizationId,
      status: row.status,
      txtName: `_klisteni-b2b.${host.split(':')[0]}`,
      txtValue: `klisteni-b2b=${token}`,
    };
  });
}

/** Live read-only DNS and CA-validated TLS probe. Failure never activates a domain. */
export const probeDomain: DomainProbe = async (host, challenge) => {
  const [hostname, portText] = host.split(':');
  const [txt, ipv4, ipv6] = await Promise.all([
    resolveTxt(`_klisteni-b2b.${hostname}`),
    resolve4(hostname).catch(() => [] as string[]),
    resolve6(hostname).catch(() => [] as string[]),
  ]);
  const tls = await new Promise<{ tlsExpiresAt: string; certificateFingerprint: string }>(
    (done, reject) => {
      const socket = connect(
        {
          host: hostname,
          port: portText ? Number(portText) : 443,
          servername: hostname,
          rejectUnauthorized: true,
        },
        () => {
          const certificate = socket.getPeerCertificate();
          socket.end();
          if (!socket.authorized || !certificate.valid_to || !certificate.fingerprint256)
            return reject(new Error('Domain TLS verification failed'));
          done({
            tlsExpiresAt: new Date(certificate.valid_to).toISOString(),
            certificateFingerprint: certificate.fingerprint256,
          });
        },
      );
      socket.setTimeout(10000, () =>
        socket.destroy(new Error('Domain TLS verification timed out')),
      );
      socket.once('error', reject);
    },
  );
  return {
    ownership: txt.some((parts) => parts.join('') === `klisteni-b2b=${challenge}`),
    addresses: [...ipv4, ...ipv6],
    ...tls,
  };
};

export function validateDomainEvidence(
  evidence: DomainEvidence,
  expectedAddresses: string[],
  now = new Date(),
) {
  if (!evidence.ownership) throw new Error('Domain TXT ownership verification failed');
  if (
    !expectedAddresses.length ||
    !evidence.addresses.length ||
    evidence.addresses.some((address) => !expectedAddresses.includes(address))
  )
    throw new Error('Domain DNS does not exclusively point at the expected ingress addresses');
  const expires = new Date(evidence.tlsExpiresAt);
  if (
    !Number.isFinite(expires.valueOf()) ||
    expires.valueOf() <= now.valueOf() ||
    !evidence.certificateFingerprint
  )
    throw new Error('Domain TLS certificate is invalid or expired');
  return expires;
}

export async function verifyDomain(
  pool: Pool,
  input: string,
  expectedAddresses: string[],
  probe: DomainProbe = probeDomain,
) {
  const host = normalizeDomainHost(input);
  const before = (await pool.query<DomainRow>('SELECT * FROM b2b_domain WHERE host=$1', [host]))
    .rows[0];
  if (!before) throw new Error('Unknown B2B domain');
  let evidence: DomainEvidence, expires: Date;
  try {
    evidence = await probe(host, before.verification_token);
    expires = validateDomainEvidence(evidence, expectedAddresses);
  } catch (error) {
    // A failed renewal is actionable: do not keep serving an old DNS/TLS assertion.
    // Check generation so a slow probe cannot revoke a newly reassigned domain.
    await transaction(pool, async (db) => {
      const row = await domain(db, host);
      if (row.status === 'active' && row.generation === before.generation) {
        await db.query(
          `UPDATE b2b_domain SET status='paused',primary_domain=false,
          generation=generation+1,updated_at=now() WHERE host=$1`,
          [host],
        );
        await audit(db, row, 'verification-failed');
      }
    });
    throw error;
  }
  return transaction(pool, async (db) => {
    const row = await domain(db, host);
    if (
      row.generation !== before.generation ||
      row.verification_token !== before.verification_token
    )
      throw new Error('Domain changed during verification; retry the checks');
    const result = (
      await db.query<DomainRow>(
        `UPDATE b2b_domain SET status=CASE WHEN status='active' THEN 'active' ELSE 'verified' END,
       verified_at=now(),dns_verified_at=now(),tls_verified_at=now(),tls_expires_at=$2,
       verification_evidence=$3,generation=generation+1,updated_at=now() WHERE host=$1 RETURNING *`,
        [host, expires, JSON.stringify(evidence)],
      )
    ).rows[0];
    await audit(db, row, 'verified');
    return {
      host,
      status: result.status,
      generation: result.generation,
      tlsExpiresAt: expires.toISOString(),
    };
  });
}

export async function activateDomain(pool: Pool, input: string, primary = false) {
  const host = normalizeDomainHost(input);
  return transaction(pool, async (db) => {
    const row = await domain(db, host);
    if (
      !row.verified_at ||
      !row.dns_verified_at ||
      !row.tls_verified_at ||
      !row.tls_expires_at ||
      row.tls_expires_at.valueOf() <= Date.now()
    )
      throw new Error('Verify current ownership, DNS and TLS before activation');
    if (row.status === 'paused')
      throw new Error('Paused domains require fresh verification before activation');
    if (row.status !== 'verified' && row.status !== 'active')
      throw new Error('Verify the domain before activation');
    if (row.primary_domain && !primary)
      throw new Error('Keep --primary when reactivating the current primary domain');
    if (primary) {
      await db.query(
        `UPDATE b2b_domain SET primary_domain=false,generation=generation+1,updated_at=now()
        WHERE organization_id=$1`,
        [row.organization_id],
      );
    } else if (
      !(
        await db.query(
          `SELECT host FROM b2b_domain WHERE organization_id=$1
      AND primary_domain AND status='active' AND tls_expires_at>now()`,
          [row.organization_id],
        )
      ).rowCount
    )
      throw new Error('Activate a verified primary domain before its aliases');
    const result = (
      await db.query<DomainRow>(
        `UPDATE b2b_domain SET status='active',primary_domain=$2,
      generation=generation+1,updated_at=now() WHERE host=$1 RETURNING *`,
        [host, primary],
      )
    ).rows[0];
    await audit(db, row, primary ? 'primary-activated' : 'alias-activated');
    return {
      host,
      organizationId: row.organization_id,
      status: result.status,
      primary,
      generation: result.generation,
    };
  });
}

export async function pauseDomain(pool: Pool, input: string) {
  const host = normalizeDomainHost(input);
  return transaction(pool, async (db) => {
    const row = await domain(db, host);
    await db.query(
      `UPDATE b2b_domain SET status='paused',primary_domain=false,
      generation=generation+1,updated_at=now() WHERE host=$1`,
      [host],
    );
    await audit(db, row, 'paused');
    return { host, status: 'paused' };
  });
}

/** Ownership remains reserved while paused. Transfer requires this explicit operator action. */
export async function reassignDomain(pool: Pool, input: string, organizationId: string) {
  const host = normalizeDomainHost(input);
  return transaction(pool, async (db) => {
    const row = await domain(db, host);
    if (row.status !== 'paused') throw new Error('Pause the domain before explicit reassignment');
    if (row.organization_id === organizationId)
      throw new Error('Domain already belongs to this organization');
    await audit(db, row, 'ownership-released');
    // Contexts must not survive a transfer, even if auth cookies remain in a browser.
    await db.query('DELETE FROM b2b_session_context WHERE domain_host=$1', [host]);
    const token = randomBytes(24).toString('hex');
    await db.query(
      `UPDATE b2b_domain SET organization_id=$2,status='requested',primary_domain=false,
      verified_at=NULL,dns_verified_at=NULL,tls_verified_at=NULL,tls_expires_at=NULL,
      verification_token=$3,verification_evidence='',generation=generation+1,updated_at=now()
      WHERE host=$1`,
      [host, organizationId, token],
    );
    await audit(db, { ...row, organization_id: organizationId }, 'reassigned');
    return {
      host,
      organizationId,
      status: 'requested',
      txtName: `_klisteni-b2b.${host.split(':')[0]}`,
      txtValue: `klisteni-b2b=${token}`,
    };
  });
}

export async function domainDiagnostics(pool: Pool) {
  return (
    await pool.query(`SELECT host,organization_id,status,primary_domain,generation,
    verified_at,dns_verified_at,tls_verified_at,tls_expires_at,
    CASE WHEN tls_expires_at<=now() THEN 'expired'
      WHEN tls_expires_at<now()+interval '14 days' THEN 'renew-soon'
      WHEN status='active' THEN 'ready' ELSE 'inactive' END AS diagnostic
    FROM b2b_domain ORDER BY organization_id,host`)
  ).rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, host, organizationId] = process.argv.slice(2);
  const pool = createPool(readConfig());
  try {
    let result: unknown;
    if (command === 'request' && host && organizationId)
      result = await requestDomain(pool, organizationId, host);
    else if (command === 'verify' && host)
      result = await verifyDomain(
        pool,
        host,
        (process.env.B2B_DOMAIN_EXPECTED_ADDRESSES ?? '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      );
    else if (command === 'activate' && host)
      result = await activateDomain(pool, host, process.argv.includes('--primary'));
    else if (command === 'pause' && host) result = await pauseDomain(pool, host);
    else if (command === 'reassign' && host && organizationId)
      result = await reassignDomain(pool, host, organizationId);
    else if (command === 'diagnose') result = await domainDiagnostics(pool);
    else
      throw new Error(
        'Use: request HOST ORG | verify HOST | activate HOST [--primary] | pause HOST | reassign HOST ORG | diagnose',
      );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}
