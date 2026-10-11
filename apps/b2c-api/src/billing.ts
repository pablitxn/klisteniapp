import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { AccessRepository } from './access.ts';
import type { Config } from './config.ts';
import { HttpError } from './errors.ts';
import { lockUser } from './state.ts';

export const CheckoutInputSchema = z.object({ plan: z.enum(['monthly', 'yearly']) }).strict();
export const BILLING_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS billing_subscription (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  provider_id text UNIQUE,
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  months integer NOT NULL CHECK (months IN (1, 12)),
  status text NOT NULL DEFAULT 'creating',
  checkout_url text,
  create_attempted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE billing_subscription ADD COLUMN IF NOT EXISTS create_attempted boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS billing_one_open_subscription ON billing_subscription(user_id) WHERE status NOT IN ('cancelled', 'failed');
CREATE TABLE IF NOT EXISTS billing_payment (
  provider_id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES billing_subscription(id) ON DELETE CASCADE,
  status text NOT NULL,
  paid_through timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

type Subscription = { id: string; user_id: string; provider_id: string | null; plan: 'monthly' | 'yearly'; amount: string; months: number; status: string; checkout_url: string | null; create_attempted: boolean };
const AmountSchema = z.union([z.number(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]).transform(Number).pipe(z.number().finite().nonnegative());
const ProviderSubscriptionSchema = z.object({ id: z.string(), external_reference: z.string(), status: z.enum(['pending', 'authorized', 'paused', 'cancelled']), init_point: z.url().optional(), auto_recurring: z.object({ frequency: z.number(), frequency_type: z.string(), transaction_amount: AmountSchema, currency_id: z.string() }) });
const InvoiceSchema = z.object({ id: z.union([z.string(), z.number()]).transform(String), preapproval_id: z.string(), payment: z.object({ id: z.union([z.string(), z.number()]).nullable().optional() }).nullable().optional() });
const PaymentSchema = z.object({ id: z.union([z.string(), z.number()]).transform(String), status: z.string(), live_mode: z.boolean(), transaction_amount: AmountSchema, transaction_amount_refunded: z.number().optional(), currency_id: z.string(), collector_id: z.union([z.string(), z.number()]).transform(String), date_approved: z.string().nullable(), external_reference: z.string().nullable().optional() });
const disabled = () => new HttpError(503, 'BILLING_UNAVAILABLE', 'Las suscripciones de prueba todavía no están configuradas. El modo local sigue siendo gratuito.');
const providerFailure = () => new HttpError(502, 'BILLING_PROVIDER_ERROR', 'Mercado Pago no pudo confirmar la operación. Volvé a consultar el estado antes de intentarlo otra vez.');
function providerData<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw providerFailure();
  return parsed.data;
}
const mismatch = () => new HttpError(502, 'BILLING_RESOURCE_MISMATCH', 'No pudimos verificar los datos de la suscripción de prueba.');

/** Months are calendar months, clamped to the last day (Jan 31 -> Feb 28). */
export function paidPeriodEnd(approved: Date, months: number): Date {
  const date = new Date(approved);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}

/** No secret => no acceptance. Query id is the exact identifier in MP's manifest. */
export function validWebhookSignature(secret: string, signature: string, requestId: string, dataId: string, now = Date.now()): boolean {
  if (!secret || !/^[A-Za-z0-9_-]{1,200}$/.test(dataId) || !/^[A-Za-z0-9_-]{1,200}$/.test(requestId)) return false;
  const parts = signature.split(',').map(part => part.trim().split('='));
  const timestamps = parts.filter(([key]) => key === 'ts');
  const hashes = parts.filter(([key]) => key === 'v1');
  if (timestamps.length !== 1 || hashes.length !== 1) return false;
  const ts = timestamps[0][1], v1 = hashes[0][1];
  if (!/^\d{10,13}$/.test(ts ?? '') || !/^[a-f0-9]{64}$/i.test(v1 ?? '')) return false;
  const time = Number(ts) * (ts.length <= 10 ? 1000 : 1);
  if (Math.abs(now - time) > 5 * 60_000) return false;
  const expected = createHmac('sha256', secret).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest();
  return timingSafeEqual(expected, Buffer.from(v1, 'hex'));
}

export class MercadoPagoClient {
  config: NonNullable<Config['billing']>;
  constructor(config: NonNullable<Config['billing']>) { this.config = config; }
  async request(path: string, method = 'GET', body?: unknown, idempotencyKey?: string): Promise<unknown> {
    try {
      const result = await fetch(`https://api.mercadopago.com${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!result.ok) throw providerFailure();
      return await result.json();
    } catch { throw providerFailure(); }
  }
  async seller(): Promise<string> {
    const data = providerData(z.object({ id: z.union([z.number(), z.string()]).transform(String), tags: z.array(z.string()), site_id: z.string() }), await this.request('/users/me'));
    if (!data.tags.includes('test_user') || data.site_id !== 'MLA') throw new HttpError(503, 'SANDBOX_ACCOUNT_REQUIRED', 'Configurá una cuenta vendedora de prueba de Argentina para usar estas suscripciones.');
    return data.id;
  }
  subscription(id: string) { return this.request(`/preapproval/${encodeURIComponent(id)}`).then(value => providerData(ProviderSubscriptionSchema, value)); }
  invoice(id: string) { return this.request(`/authorized_payments/${encodeURIComponent(id)}`).then(value => providerData(InvoiceSchema, value)); }
  payment(id: string) { return this.request(`/v1/payments/${encodeURIComponent(id)}`).then(value => providerData(PaymentSchema, value)); }
  async invoices(id: string) {
    const invoices: z.infer<typeof InvoiceSchema>[] = [];
    for (let offset = 0; offset < 1000;) {
      const value = providerData(z.object({ results: z.array(InvoiceSchema), paging: z.object({ total: z.number().int().nonnegative() }) }), await this.request(`/authorized_payments/search?preapproval_id=${encodeURIComponent(id)}&limit=100&offset=${offset}`));
      invoices.push(...value.results);
      if (offset + value.results.length >= value.paging.total) return invoices;
      if (!value.results.length) throw providerFailure();
      offset += value.results.length;
    }
    throw providerFailure();
  }
  async findSubscription(reference: string) {
    for (let offset = 0; offset < 1000;) {
      const page = providerData(z.object({ results: z.array(z.object({ id: z.string(), external_reference: z.string().optional() })), paging: z.object({ total: z.number().int().nonnegative() }) }),
        await this.request(`/preapproval/search?payer_email=${encodeURIComponent(this.config.payerEmail)}&limit=100&offset=${offset}`));
      const found = page.results.filter(item => item.external_reference === reference);
      if (found.length > 1) throw mismatch();
      if (found[0]) return this.subscription(found[0].id);
      if (offset + page.results.length >= page.paging.total) return null;
      if (!page.results.length) throw providerFailure();
      offset += page.results.length;
    }
    throw providerFailure();
  }
}

export class BillingService {
  pool: Pool; config: Config; client: MercadoPagoClient | null; now: () => Date;
  constructor(pool: Pool, config: Config, client = config.billing ? new MercadoPagoClient(config.billing) : null, now = () => new Date()) {
    this.pool = pool; this.config = config; this.client = client; this.now = now;
  }
  enabled() { if (!this.client || !this.config.billing) throw disabled(); return { client: this.client, settings: this.config.billing }; }
  async transaction<T>(userId: string, operation: (db: PoolClient) => Promise<T>) {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await lockUser(db, userId);
      const value = await operation(db);
      await db.query('COMMIT');
      return value;
    } catch (error) { await db.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { db.release(); }
  }
  async status(userId: string) {
    const rows = await this.pool.query<Subscription>('SELECT * FROM billing_subscription WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1', [userId]);
    const row = rows.rows[0];
    const settings = this.config.billing;
    return {
      mode: settings ? 'sandbox' as const : 'disabled' as const,
      plans: settings ? [
        { id: 'monthly', label: 'Mensual', amount: settings.monthlyAmount, currency: 'ARS', months: 1 },
        { id: 'yearly', label: 'Anual', amount: settings.yearlyAmount, currency: 'ARS', months: 12 },
      ] : [],
      subscription: row ? { id: row.id, plan: row.plan, status: row.status, checkoutUrl: row.checkout_url } : null,
      access: await new AccessRepository(this.pool, this.now).get(userId),
    };
  }
  async checkout(userId: string, plan: 'monthly' | 'yearly') {
    const { client, settings } = this.enabled();
    await client.seller(); // Test seller check happens BEFORE creating any remote mandate.
    const access = await new AccessRepository(this.pool, this.now).get(userId);
    if (access.status === 'lifetime') throw new HttpError(409, 'LIFETIME_ACCESS', 'Tu cuenta ya tiene acceso vitalicio.');
    // Persist the reference before the network call; a timeout must not lose it.
    const attempt = await this.transaction(userId, async db => {
      await this.requirePurchasable(db, userId);
      const existing = (await db.query<Subscription>("SELECT * FROM billing_subscription WHERE user_id=$1 AND status NOT IN ('cancelled','failed')", [userId])).rows[0];
      if (existing) {
        if (existing.plan !== plan) throw new HttpError(409, 'SUBSCRIPTION_EXISTS', 'Cancelá la suscripción anterior antes de cambiar de plan.');
        return { row: existing, create: false };
      }
      const row = (await db.query<Subscription>(`INSERT INTO billing_subscription (id,user_id,plan,amount,months,create_attempted) VALUES ($1,$2,$3,$4,$5,true) RETURNING *`,
        [randomUUID(), userId, plan, plan === 'monthly' ? settings.monthlyAmount : settings.yearlyAmount, plan === 'monthly' ? 1 : 12])).rows[0];
      return { row, create: true };
    });
    const { row } = attempt;
    return this.transaction(userId, async db => {
      await this.requirePurchasable(db, userId);
      const current = (await db.query<Subscription>('SELECT * FROM billing_subscription WHERE id=$1', [row.id])).rows[0];
      if (current.checkout_url && ['pending', 'authorized'].includes(current.status)) return { checkoutUrl: current.checkout_url };
      if (current.status !== 'creating') throw new HttpError(409, 'SUBSCRIPTION_EXISTS', 'Consultá el estado de tu suscripción antes de continuar.');
      // Only the process that persisted this first attempt can POST. Subsequent
      // requests recover by reference, even if the previous network call timed out.
      const remote = attempt.create ? providerData(ProviderSubscriptionSchema, await client.request('/preapproval', 'POST', {
        reason: `Klisteni nube ${plan === 'monthly' ? 'mensual' : 'anual'} · prueba`,
        external_reference: row.id, payer_email: settings.payerEmail, status: 'pending',
        auto_recurring: { frequency: row.months, frequency_type: 'months', transaction_amount: Number(row.amount), currency_id: 'ARS' },
        back_url: `${this.config.origin}/?billing=return`,
      }, row.id)) : await client.findSubscription(row.id);
      if (!remote) throw new HttpError(409, 'CHECKOUT_UNCONFIRMED', 'Todavía no pudimos localizar el alta anterior. No creamos otra suscripción para evitar duplicados; volvé a consultar o contactá al administrador.');
      this.validateSubscription(row, remote);
      if (!remote.init_point) throw providerFailure();
      const checkoutUrl = new URL(remote.init_point);
      if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'www.mercadopago.com.ar' || checkoutUrl.username || checkoutUrl.password) throw mismatch();
      await db.query('UPDATE billing_subscription SET provider_id=$2,status=$3,checkout_url=$4,updated_at=now() WHERE id=$1', [row.id, remote.id, remote.status, checkoutUrl.href]);
      return { checkoutUrl: checkoutUrl.href };
    });
  }
  async requirePurchasable(db: PoolClient, userId: string) {
    const found = (await db.query('SELECT u.disabled, a.lifetime FROM auth_user u JOIN account_access a ON a.user_id=u.id WHERE u.id=$1', [userId])).rows[0];
    if (!found || found.disabled) throw new HttpError(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar.');
    if (found.lifetime) throw new HttpError(409, 'LIFETIME_ACCESS', 'Tu cuenta ya tiene acceso vitalicio.');
  }
  validateSubscription(row: Subscription, remote: z.infer<typeof ProviderSubscriptionSchema>) {
    if (remote.external_reference !== row.id || (row.provider_id && remote.id !== row.provider_id)
      || remote.auto_recurring.frequency !== row.months || remote.auto_recurring.frequency_type !== 'months'
      || remote.auto_recurring.currency_id !== 'ARS' || Math.round(remote.auto_recurring.transaction_amount * 100) !== Math.round(Number(row.amount) * 100)) throw mismatch();
  }
  async reconcile(row: Subscription, invoiceId?: string) {
    const { client } = this.enabled();
    if (!row.provider_id) return;
    const seller = await client.seller();
    await this.transaction(row.user_id, async db => {
      const remote = await client.subscription(row.provider_id!);
      this.validateSubscription(row, remote);
      const invoices = invoiceId ? [await client.invoice(invoiceId)] : await client.invoices(row.provider_id!);
      for (const invoice of invoices) {
        if (invoice.preapproval_id !== row.provider_id) throw mismatch();
        if (!invoice.payment?.id) continue;
        const payment = await client.payment(String(invoice.payment.id));
        if (payment.id !== String(invoice.payment.id) || payment.live_mode || payment.collector_id !== seller || payment.currency_id !== 'ARS'
          || Math.round(payment.transaction_amount * 100) !== Math.round(Number(row.amount) * 100)
          || (payment.external_reference && payment.external_reference !== row.id)) throw mismatch();
        const approved = payment.date_approved ? new Date(payment.date_approved) : null;
        const paid = payment.status === 'approved' && !(payment.transaction_amount_refunded && payment.transaction_amount_refunded > 0);
        if (paid && (!approved || !Number.isFinite(approved.getTime()) || approved.getTime() > this.now().getTime() + 60_000)) throw mismatch();
        const end = paid ? paidPeriodEnd(approved!, row.months) : null;
        const saved = await db.query(`INSERT INTO billing_payment (provider_id,subscription_id,status,paid_through) VALUES ($1,$2,$3,$4)
          ON CONFLICT (provider_id) DO UPDATE SET status=EXCLUDED.status,paid_through=EXCLUDED.paid_through,updated_at=now()
          WHERE billing_payment.subscription_id=EXCLUDED.subscription_id RETURNING provider_id`, [payment.id, row.id, paid ? 'approved' : payment.status === 'approved' ? 'refunded' : payment.status, end]);
        if (!saved.rowCount) throw mismatch();
      }
      await db.query('UPDATE billing_subscription SET status=$2,updated_at=now() WHERE id=$1', [row.id, remote.status]);
      await db.query(`UPDATE account_access SET paid_through=(SELECT max(p.paid_through) FROM billing_payment p JOIN billing_subscription s ON s.id=p.subscription_id WHERE s.user_id=$1 AND p.status='approved') WHERE user_id=$1`, [row.user_id]);
    });
  }
  async refresh(userId: string) {
    if (!this.config.billing) return this.status(userId);
    // Include cancelled subscriptions: refunds can retract a previously paid period.
    const rows = await this.pool.query<Subscription>('SELECT * FROM billing_subscription WHERE user_id=$1 AND provider_id IS NOT NULL ORDER BY created_at DESC LIMIT 20', [userId]);
    for (const row of rows.rows) await this.reconcile(row);
    return this.status(userId);
  }
  async cancel(userId: string) {
    const { client } = this.enabled();
    await client.seller();
    await this.transaction(userId, async db => {
      const row = (await db.query<Subscription>("SELECT * FROM billing_subscription WHERE user_id=$1 AND status NOT IN ('cancelled','failed')", [userId])).rows[0];
      if (!row) return;
      if (!row.provider_id) throw new HttpError(409, 'CHECKOUT_UNCONFIRMED', 'El alta anterior sigue sin confirmarse. Reintentá el mismo plan para recuperar su estado.');
      const remote = providerData(ProviderSubscriptionSchema, await client.request(`/preapproval/${encodeURIComponent(row.provider_id)}`, 'PUT', { status: 'cancelled' }));
      this.validateSubscription(row, remote);
      if (remote.status !== 'cancelled') throw providerFailure();
      await db.query("UPDATE billing_subscription SET status='cancelled',updated_at=now() WHERE id=$1", [row.id]);
    });
    return this.status(userId); // Cancellation stops renewals; already-paid time remains.
  }
  async webhook(type: string, id: string) {
    const { client } = this.enabled();
    if (type === 'subscription_preapproval') {
      const row = (await this.pool.query<Subscription>('SELECT * FROM billing_subscription WHERE provider_id=$1', [id])).rows[0];
      if (row) await this.reconcile(row);
    } else if (type === 'subscription_authorized_payment') {
      const invoice = await client.invoice(id);
      const row = (await this.pool.query<Subscription>('SELECT * FROM billing_subscription WHERE provider_id=$1', [invoice.preapproval_id])).rows[0];
      if (row) await this.reconcile(row, id);
    } else if (type === 'payment') {
      // Only an already attributed invoice payment is eligible. Never use a
      // caller-supplied external_reference to credit an unrelated account.
      const row = (await this.pool.query<Subscription>('SELECT s.* FROM billing_subscription s JOIN billing_payment p ON p.subscription_id=s.id WHERE p.provider_id=$1', [id])).rows[0];
      if (row) await this.reconcile(row);
    }
    return { ok: true };
  }
}
