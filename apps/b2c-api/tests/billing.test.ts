import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { Pool } from 'pg';
import { AccessRepository } from '../src/access.ts';
import { createAuth } from '../src/auth.ts';
import { BillingService, MercadoPagoClient, paidPeriodEnd, validWebhookSignature } from '../src/billing.ts';
import { readConfig, type Config } from '../src/config.ts';
import { createPool } from '../src/database.ts';
import { HttpError } from '../src/errors.ts';
import { createApiServer } from '../src/http.ts';
import { migrate } from '../src/migrate.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const now = new Date('2026-10-04T12:00:00.000Z');
const settings: NonNullable<Config['billing']> = {
  mode: 'sandbox', accessToken: 'fake-test-seller-token', webhookSecret: 'billing-test-webhook-secret-long-enough',
  payerEmail: 'test-buyer@testuser.com', monthlyAmount: 100, yearlyAmount: 1000,
};
const code = (expected: string) => (error: unknown) => error instanceof HttpError && error.code === expected;

function signature(id: string, requestId: string, timestamp: string, secret = settings.webhookSecret): string {
  const hash = createHmac('sha256', secret).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${timestamp};`).digest('hex');
  return `ts=${timestamp},v1=${hash}`;
}

test('billing configuration defaults off and cannot enable live payments', () => {
  const base = { DATABASE_URL: 'postgresql://localhost/billing_test', BETTER_AUTH_SECRET: 'configuration-test-secret-1234567890', APP_ORIGIN: 'https://klisteni.test' };
  assert.equal(readConfig(base).billing, undefined);
  assert.throws(() => readConfig({ ...base, BILLING_MODE: 'production' }), /BILLING_MODE/);
  assert.throws(() => readConfig({ ...base, BILLING_MODE: 'sandbox' }), /Sandbox billing requires/);
  const sandbox = { ...base, BILLING_MODE: 'sandbox', MP_ACCESS_TOKEN: settings.accessToken, MP_WEBHOOK_SECRET: settings.webhookSecret, MP_SANDBOX_PAYER_EMAIL: settings.payerEmail, MP_MONTHLY_AMOUNT: '100.00', MP_YEARLY_AMOUNT: '1000' };
  assert.equal(readConfig(sandbox).billing?.monthlyAmount, 100);
  assert.throws(() => readConfig({ ...sandbox, APP_ORIGIN: 'http://localhost:5173' }), /HTTPS/);
  assert.throws(() => readConfig({ ...sandbox, MP_MONTHLY_AMOUNT: '0' }), /MP_MONTHLY_AMOUNT/);
  assert.throws(() => readConfig({ ...sandbox, MP_YEARLY_AMOUNT: '1000.001' }), /MP_YEARLY_AMOUNT/);
});

test('monthly and yearly paid periods preserve UTC time and clamp calendar boundaries', () => {
  assert.equal(paidPeriodEnd(new Date('2026-01-31T23:12:01.456Z'), 1).toISOString(), '2026-02-28T23:12:01.456Z');
  assert.equal(paidPeriodEnd(new Date('2024-02-29T08:15:00.000Z'), 12).toISOString(), '2025-02-28T08:15:00.000Z');
  assert.equal(paidPeriodEnd(new Date('2026-12-31T12:00:00.000Z'), 1).toISOString(), '2027-01-31T12:00:00.000Z');
});

test('webhook signatures reject tampering, missing secrets, duplicates and stale timestamps', () => {
  const id = 'AbC123', requestId = 'request-123';
  const millis = String(now.getTime()), seconds = String(Math.floor(now.getTime() / 1000));
  for (const timestamp of [millis, seconds]) {
    assert.equal(validWebhookSignature(settings.webhookSecret, signature(id, requestId, timestamp), requestId, id, now.getTime()), true);
  }
  const valid = signature(id, requestId, millis);
  assert.equal(validWebhookSignature('', valid, requestId, id, now.getTime()), false);
  assert.equal(validWebhookSignature(settings.webhookSecret, valid, 'different-request', id, now.getTime()), false);
  assert.equal(validWebhookSignature(settings.webhookSecret, valid, requestId, 'different-id', now.getTime()), false);
  assert.equal(validWebhookSignature(settings.webhookSecret, `${valid},ts=${millis}`, requestId, id, now.getTime()), false);
  assert.equal(validWebhookSignature(settings.webhookSecret, 'ts=invalid,v1=abc', requestId, id, now.getTime()), false);
  for (const delta of [-300_001, 300_001]) {
    const timestamp = String(now.getTime() + delta);
    assert.equal(validWebhookSignature(settings.webhookSecret, signature(id, requestId, timestamp), requestId, id, now.getTime()), false);
  }
});

type Recurrence = { frequency: number; frequency_type: string; transaction_amount: string | number; currency_id: string };
type RemoteSubscription = { id: string; external_reference: string; status: string; init_point: string; auto_recurring: Recurrence };
type RemoteInvoice = { id: string; preapproval_id: string; payment: { id: string } | null };
type RemotePayment = {
  id: string; status: string; live_mode: boolean; transaction_amount: number | string; transaction_amount_refunded: number;
  currency_id: string; collector_id: number | string; date_approved: string | null; external_reference: string | null;
};
type CreateBody = { external_reference: string; payer_email: string; status: string; auto_recurring: Recurrence; back_url: string };

/** Only the HTTP transport is replaced; production schemas and reconciliation run. */
class FakeMercadoPago extends MercadoPagoClient {
  subscriptions = new Map<string, RemoteSubscription>();
  invoiceRecords = new Map<string, RemoteInvoice>();
  payments = new Map<string, RemotePayment>();
  calls: { path: string; method: string; body?: unknown; idempotencyKey?: string }[] = [];
  sellerRecord = { id: 12345, tags: ['test_user'], site_id: 'MLA' };
  creationFailure: 'before' | 'after' | null = null;
  invoicePageSize = 100;
  constructor() { super(settings); }
  override async request(path: string, method = 'GET', body?: unknown, idempotencyKey?: string): Promise<unknown> {
    this.calls.push({ path, method, body: structuredClone(body), idempotencyKey });
    const url = new URL(path, 'https://provider.test');
    if (path === '/users/me') return structuredClone(this.sellerRecord);
    if (path === '/preapproval' && method === 'POST') {
      if (this.creationFailure === 'before') throw new HttpError(502, 'BILLING_PROVIDER_ERROR', 'Simulated connection failure');
      const input = body as CreateBody;
      assert.equal(input.payer_email, settings.payerEmail);
      assert.equal(input.status, 'pending');
      assert.equal('card_token_id' in input, false);
      const id = `sub-${randomUUID()}`;
      const remote: RemoteSubscription = { id, external_reference: input.external_reference, status: 'pending', init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${id}`, auto_recurring: { ...input.auto_recurring, transaction_amount: Number(input.auto_recurring.transaction_amount).toFixed(2) } };
      this.subscriptions.set(id, remote);
      if (this.creationFailure === 'after') throw new HttpError(502, 'BILLING_PROVIDER_ERROR', 'Simulated response lost after creation');
      return structuredClone(remote);
    }
    if (url.pathname === '/preapproval/search') {
      assert.equal(url.searchParams.get('payer_email'), settings.payerEmail);
      const rows = [...this.subscriptions.values()];
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 20);
      return { results: structuredClone(rows.slice(offset, offset + limit)), paging: { total: rows.length, offset, limit } };
    }
    if (url.pathname.startsWith('/preapproval/')) {
      const remote = this.subscriptions.get(decodeURIComponent(url.pathname.split('/').at(-1)!));
      assert.ok(remote, `Missing fake subscription: ${path}`);
      if (method === 'PUT') remote.status = (body as { status: string }).status;
      return structuredClone(remote);
    }
    if (url.pathname === '/authorized_payments/search') {
      const rows = [...this.invoiceRecords.values()].filter(invoice => invoice.preapproval_id === url.searchParams.get('preapproval_id'));
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Math.min(this.invoicePageSize, Number(url.searchParams.get('limit') ?? 20));
      return { results: structuredClone(rows.slice(offset, offset + limit)), paging: { total: rows.length, offset, limit } };
    }
    if (url.pathname.startsWith('/authorized_payments/')) {
      const invoice = this.invoiceRecords.get(decodeURIComponent(url.pathname.split('/').at(-1)!));
      assert.ok(invoice, `Missing fake invoice: ${path}`);
      return structuredClone(invoice);
    }
    if (url.pathname.startsWith('/v1/payments/')) {
      const payment = this.payments.get(decodeURIComponent(url.pathname.split('/').at(-1)!));
      assert.ok(payment, `Missing fake payment: ${path}`);
      return structuredClone(payment);
    }
    throw new Error(`Unexpected provider call: ${method} ${path}`);
  }
  addPayment(remote: RemoteSubscription, overrides: Partial<RemotePayment> = {}) {
    const payment: RemotePayment = { id: `payment-${randomUUID()}`, status: 'approved', live_mode: false, transaction_amount: remote.auto_recurring.transaction_amount, transaction_amount_refunded: 0, currency_id: 'ARS', collector_id: this.sellerRecord.id, date_approved: '2026-10-01T10:00:00.000Z', external_reference: remote.external_reference, ...overrides };
    const invoice = { id: `invoice-${randomUUID()}`, preapproval_id: remote.id, payment: { id: payment.id } };
    this.payments.set(payment.id, payment);
    this.invoiceRecords.set(invoice.id, invoice);
    return { payment, invoice };
  }
  get createCalls() { return this.calls.filter(call => call.method === 'POST' && call.path === '/preapproval'); }
}

describe('PostgreSQL subscription billing', { skip: !databaseUrl }, () => {
  let admin: Pool, pool: Pool, config: Config, auth: ReturnType<typeof createAuth>;
  const schema = `klisteni_billing_test_${randomUUID().replaceAll('-', '')}`;
  before(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    config = { databaseUrl: url.href, secret: 'billing-test-auth-secret-1234567890', origin: 'https://klisteni.test', host: '127.0.0.1', port: 3001, production: false, billing: settings };
    pool = createPool(config);
    auth = createAuth(pool, config);
    await migrate(pool, auth);
  });
  after(async () => {
    await pool?.end();
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
  });
  async function user() {
    const id = randomUUID();
    await pool.query(`INSERT INTO auth_user (id,name,email,"emailVerified","createdAt","updatedAt",disabled,role) VALUES ($1,'Billing test',$2,false,now(),now(),false,'user')`, [id, `${id}@example.test`]);
    await pool.query('INSERT INTO account_access (user_id,trial_ends_at) VALUES ($1,$2)', [id, new Date('2026-09-01T00:00:00Z')]);
    return id;
  }
  function fixture() {
    const provider = new FakeMercadoPago();
    const service = new BillingService(pool, config, provider, () => now);
    return { provider, service };
  }
  async function checkout(plan: 'monthly' | 'yearly' = 'monthly') {
    const id = await user();
    const { provider, service } = fixture();
    const result = await service.checkout(id, plan);
    const remote = [...provider.subscriptions.values()][0];
    assert.equal(result.checkoutUrl, remote.init_point);
    return { id, provider, service, remote };
  }
  async function access(id: string) { return new AccessRepository(pool, () => now).get(id); }

  test('disabled billing and non-test/non-Argentina sellers never create a mandate', async () => {
    const id = await user();
    const disabled = new BillingService(pool, { ...config, billing: undefined });
    assert.equal((await disabled.status(id)).mode, 'disabled');
    await assert.rejects(disabled.checkout(id, 'monthly'), code('BILLING_UNAVAILABLE'));
    for (const seller of [{ tags: [], site_id: 'MLA' }, { tags: ['test_user'], site_id: 'MLB' }]) {
      const { provider, service } = fixture();
      Object.assign(provider.sellerRecord, seller);
      await assert.rejects(service.checkout(id, 'monthly'), code('SANDBOX_ACCOUNT_REQUIRED'));
      assert.equal(provider.createCalls.length, 0);
    }
    assert.equal((await pool.query('SELECT count(*) FROM billing_subscription WHERE user_id=$1', [id])).rows[0].count, '0');
  });

  test('lifetime and disabled users cannot accidentally open a subscription', async () => {
    const id = await user();
    const { provider, service } = fixture();
    await pool.query('UPDATE account_access SET lifetime=true WHERE user_id=$1', [id]);
    await assert.rejects(service.checkout(id, 'monthly'), code('LIFETIME_ACCESS'));
    await pool.query('UPDATE account_access SET lifetime=false WHERE user_id=$1', [id]);
    await pool.query('UPDATE auth_user SET disabled=true WHERE id=$1', [id]);
    await assert.rejects(service.checkout(id, 'monthly'), code('UNAUTHENTICATED'));
    assert.equal(provider.createCalls.length, 0);
  });

  test('authorization without a payment leaves expired cloud access unchanged', async () => {
    const { id, provider, service, remote } = await checkout();
    remote.status = 'authorized';
    provider.invoiceRecords.set('invoice-pending', { id: 'invoice-pending', preapproval_id: remote.id, payment: null });
    const status = await service.refresh(id);
    assert.equal(status.subscription?.status, 'authorized');
    assert.equal(status.access.status, 'expired');
    assert.equal(status.access.paidThrough, null);
    assert.equal(status.access.cloudWrite, false);
  });

  for (const [plan, end, months] of [['monthly', '2026-11-01T10:00:00.000Z', 1], ['yearly', '2027-10-01T10:00:00.000Z', 12]] as const) {
    test(`${plan} requires a canonical approved payment and grants one calendar period`, async () => {
      const { id, provider, service, remote } = await checkout(plan);
      remote.status = 'authorized';
      const { payment } = provider.addPayment(remote);
      assert.equal(remote.auto_recurring.frequency, months);
      const status = await service.refresh(id);
      assert.equal(status.access.status, 'active');
      assert.equal(status.access.paidThrough, end);
      assert.ok(provider.calls.some(call => call.path === `/v1/payments/${payment.id}`));
      await service.refresh(id);
      assert.equal((await access(id)).paidThrough, end);
      assert.equal((await pool.query('SELECT count(*) FROM billing_payment WHERE provider_id=$1', [payment.id])).rows[0].count, '1');
    });
  }

  test('reordered invoice notifications and concurrent refreshes never extend periods twice', async () => {
    const { id, provider, service, remote } = await checkout();
    remote.status = 'authorized';
    const older = provider.addPayment(remote, { date_approved: '2026-09-01T10:00:00Z' });
    const newer = provider.addPayment(remote);
    await service.webhook('subscription_authorized_payment', newer.invoice.id);
    await service.webhook('subscription_authorized_payment', older.invoice.id);
    await Promise.all([service.refresh(id), service.refresh(id), service.webhook('subscription_authorized_payment', newer.invoice.id)]);
    assert.equal((await access(id)).paidThrough, '2026-11-01T10:00:00.000Z');
    assert.equal((await pool.query('SELECT count(*) FROM billing_payment WHERE subscription_id=$1', [remote.external_reference])).rows[0].count, '2');
    newer.payment.status = 'refunded';
    await service.webhook('payment', newer.payment.id);
    assert.equal((await access(id)).paidThrough, '2026-10-01T10:00:00.000Z');
    assert.equal((await access(id)).cloudWrite, false);
    await service.webhook('subscription_authorized_payment', newer.invoice.id);
    assert.equal((await access(id)).cloudWrite, false, 'Old webhook cannot resurrect a now-refunded canonical payment');
  });

  test('reconciliation follows a smaller provider page size and refuses incomplete pagination', async () => {
    const { id, provider, service, remote } = await checkout();
    provider.invoicePageSize = 1;
    for (const day of ['01', '02', '03']) provider.addPayment(remote, { date_approved: `2026-10-${day}T10:00:00Z` });
    await service.refresh(id);
    const searches = provider.calls.filter(call => call.path.startsWith('/authorized_payments/search?'));
    assert.deepEqual(searches.map(call => new URL(call.path, 'https://provider.test').searchParams.get('offset')), ['0', '1', '2']);
    assert.equal((await access(id)).paidThrough, '2026-11-03T10:00:00.000Z');
    provider.invoicePageSize = 0;
    await assert.rejects(service.refresh(id), code('BILLING_PROVIDER_ERROR'));
    assert.equal((await access(id)).paidThrough, '2026-11-03T10:00:00.000Z', 'Incomplete provider response cannot erase an existing confirmed period');
  });

  for (const status of ['pending', 'rejected', 'cancelled', 'charged_back']) {
    test(`a ${status} payment does not grant paid access`, async () => {
      const { id, provider, service, remote } = await checkout();
      provider.addPayment(remote, { status, date_approved: null });
      await service.refresh(id);
      assert.equal((await access(id)).paidThrough, null);
      assert.equal((await access(id)).cloudWrite, false);
    });
  }

  test('a refund retracts paid access while cancellation alone preserves it', async () => {
    const { id, provider, service, remote } = await checkout();
    const { payment } = provider.addPayment(remote);
    await service.refresh(id);
    const cancelled = await service.cancel(id);
    assert.equal(remote.status, 'cancelled');
    assert.equal(cancelled.subscription?.status, 'cancelled');
    assert.equal(cancelled.access.paidThrough, '2026-11-01T10:00:00.000Z');
    assert.equal(cancelled.access.cloudWrite, true);
    payment.transaction_amount_refunded = 10;
    await service.refresh(id);
    assert.equal((await access(id)).paidThrough, null);
    assert.equal((await access(id)).cloudWrite, false);
  });

  const mismatches: [string, Partial<RemotePayment>][] = [
    ['reference', { external_reference: 'another-account-reference' }],
    ['seller', { collector_id: 98765 }],
    ['currency', { currency_id: 'USD' }],
    ['amount', { transaction_amount: '1.00' }],
    ['live payment', { live_mode: true }],
    ['future approval', { date_approved: '2027-01-01T00:00:00Z' }],
  ];
  for (const [name, override] of mismatches) {
    test(`a payment with wrong ${name} cannot modify entitlement`, async () => {
      const { id, provider, service, remote } = await checkout();
      provider.addPayment(remote, override);
      await assert.rejects(service.refresh(id), code('BILLING_RESOURCE_MISMATCH'));
      assert.equal((await access(id)).paidThrough, null);
      assert.equal((await pool.query('SELECT count(*) FROM billing_payment WHERE subscription_id=$1', [remote.external_reference])).rows[0].count, '0');
    });
  }

  test('an incorrect subscription reference is rejected before reading its payments', async () => {
    const { id, provider, service, remote } = await checkout();
    provider.addPayment(remote);
    remote.external_reference = 'another-reference';
    await assert.rejects(service.refresh(id), code('BILLING_RESOURCE_MISMATCH'));
    assert.equal(provider.calls.some(call => call.path.startsWith('/v1/payments/')), false);
    assert.equal((await access(id)).paidThrough, null);
  });

  test('one payment cannot be assigned to another account even without an external reference', async () => {
    const { id, provider, service, remote } = await checkout();
    const original = provider.addPayment(remote, { external_reference: null });
    await service.refresh(id);
    const otherId = await user();
    await service.checkout(otherId, 'monthly');
    const otherRemote = [...provider.subscriptions.values()].find(item => item.id !== remote.id)!;
    const maliciousInvoice = { id: `invoice-${randomUUID()}`, preapproval_id: otherRemote.id, payment: { id: original.payment.id } };
    provider.invoiceRecords.set(maliciousInvoice.id, maliciousInvoice);
    await assert.rejects(service.refresh(otherId), code('BILLING_RESOURCE_MISMATCH'));
    assert.equal((await access(otherId)).paidThrough, null);
    assert.equal((await access(id)).paidThrough, '2026-11-01T10:00:00.000Z');
  });

  test('a lost create response is recovered by reference without sending another POST', async () => {
    const id = await user();
    const { provider, service } = fixture();
    provider.creationFailure = 'after';
    await assert.rejects(service.checkout(id, 'monthly'), code('BILLING_PROVIDER_ERROR'));
    assert.equal(provider.subscriptions.size, 1);
    const remote = [...provider.subscriptions.values()][0];
    provider.creationFailure = null;
    const recovered = await service.checkout(id, 'monthly');
    assert.equal(recovered.checkoutUrl, remote.init_point);
    await service.checkout(id, 'monthly');
    assert.equal(provider.createCalls.length, 1);
    assert.ok(provider.calls.some(call => call.path.startsWith('/preapproval/search?')));
    await assert.rejects(service.checkout(id, 'yearly'), code('SUBSCRIPTION_EXISTS'));
    assert.equal((await access(id)).paidThrough, null);
  });

  test('an unlocatable creation remains uncertain and never retries a remote creation', async () => {
    const id = await user();
    const { provider, service } = fixture();
    provider.creationFailure = 'before';
    await assert.rejects(service.checkout(id, 'monthly'), code('BILLING_PROVIDER_ERROR'));
    provider.creationFailure = null;
    await assert.rejects(service.checkout(id, 'monthly'), code('CHECKOUT_UNCONFIRMED'));
    await assert.rejects(service.checkout(id, 'monthly'), code('CHECKOUT_UNCONFIRMED'));
    await assert.rejects(service.cancel(id), code('CHECKOUT_UNCONFIRMED'));
    assert.equal(provider.createCalls.length, 1);
    assert.equal(provider.subscriptions.size, 0);
  });

  test('concurrent checkout clicks create only one remote subscription', async () => {
    const id = await user();
    const { provider, service } = fixture();
    const results = await Promise.allSettled([service.checkout(id, 'monthly'), service.checkout(id, 'monthly')]);
    assert.ok(results.some(result => result.status === 'fulfilled'));
    for (const result of results) {
      if (result.status === 'rejected') assert.ok(code('CHECKOUT_UNCONFIRMED')(result.reason));
    }
    assert.equal(provider.createCalls.length, 1);
    assert.equal(provider.subscriptions.size, 1);
  });

  test('HTTP webhooks validate signature and query/body agreement before canonical reconciliation', async () => {
    const { id, provider, service, remote } = await checkout();
    const { payment, invoice } = provider.addPayment(remote, { status: 'pending', date_approved: null });
    let server: Server | undefined;
    try {
      server = createApiServer({ auth, pool, config, billing: service });
      await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const post = (signed: string, bodyId = invoice.id) => fetch(`${base}/api/billing/webhook?data.id=${invoice.id}&type=subscription_authorized_payment`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'webhook-request', 'x-signature': signed },
        body: JSON.stringify({ type: 'subscription_authorized_payment', data: { id: bodyId }, status: 'approved' }),
      });
      assert.equal((await post('invalid')).status, 401);
      assert.equal((await post(signature(invoice.id, 'webhook-request', String(Date.now() - 600_000)))).status, 401);
      const signed = signature(invoice.id, 'webhook-request', String(Date.now()));
      assert.equal((await post(signed, 'another-invoice')).status, 400);
      const pending = await post(signed);
      assert.equal(pending.status, 200, await pending.text());
      assert.equal(pending.headers.get('cache-control'), 'no-store');
      assert.equal((await access(id)).paidThrough, null, 'Payload says approved; canonical payment is pending');
      payment.status = 'approved'; payment.date_approved = '2026-10-01T10:00:00Z';
      assert.equal((await post(signature(invoice.id, 'webhook-request', String(Date.now())))).status, 200);
      assert.equal((await access(id)).paidThrough, '2026-11-01T10:00:00.000Z');
    } finally {
      if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    }
  });
});
