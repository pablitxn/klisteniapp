import type { Pool, PoolClient, Notification } from 'pg';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError } from './errors.ts';
export type EventScope = {
  actorId: string;
  organizationId: string;
  branchId?: string;
  sessionId: string;
  memberId?: string;
};
type Change = {
  schema: string;
  kind: string;
  organizationId: string | null;
  actorId: string | null;
  ownerId: string | null;
  branchId: string | null;
  sessionId: string | null;
};
function matches(change: Change, scope: EventScope) {
  if (change.sessionId) return change.sessionId === scope.sessionId;
  if (change.organizationId && change.organizationId !== scope.organizationId) return false;
  if (change.ownerId) return change.ownerId === scope.actorId || change.ownerId === scope.memberId;
  if (change.actorId) return change.actorId === scope.actorId || change.actorId === scope.memberId;
  if (change.branchId) return change.branchId === scope.branchId;
  return change.organizationId === scope.organizationId;
}
/** One lazy LISTEN connection per API process. A failed listener invalidates all
 * dependent views. Server shutdown releases the dedicated listener. */
export class ProductEventHub {
  private listeners = new Set<{ scope: EventScope; invalidate: () => void }>();
  private connection: PoolClient | null = null;
  private opening: Promise<void> | null = null;
  private schema = '';
  private closing = false;
  private pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  private fail = () => {
    const connection = this.connection;
    this.connection = null;
    connection?.removeAllListeners('notification');
    connection?.removeListener('error', this.fail);
    connection?.removeListener('end', this.fail);
    connection?.release(true);
    for (const listener of [...this.listeners]) listener.invalidate();
    this.listeners.clear();
  };
  private notification = (notification: Notification) => {
    if (notification.channel !== 'klisteni_b2b_invalidation' || !notification.payload) return;
    try {
      const change = JSON.parse(notification.payload) as Change;
      if (change.schema !== this.schema) return;
      for (const listener of [...this.listeners])
        if (matches(change, listener.scope)) listener.invalidate();
    } catch {
      this.fail();
    }
  };
  private async open() {
    if (this.closing) throw new Error('Event hub closed');
    if (this.connection) return;
    if (!this.opening)
      this.opening = (async () => {
        const client = await this.pool.connect();
        if (this.closing) {
          client.release();
          throw new Error('Event hub closed');
        }
        this.connection = client;
        client.on('error', this.fail);
        client.on('end', this.fail);
        client.on('notification', this.notification);
        try {
          this.schema = (await client.query('SELECT current_schema() AS schema')).rows[0].schema;
          await client.query('LISTEN klisteni_b2b_invalidation');
        } catch (error) {
          this.fail();
          throw error;
        }
      })().finally(() => {
        this.opening = null;
      });
    await this.opening;
  }
  async subscribe(scope: EventScope, invalidate: () => void) {
    await this.open();
    if (this.listeners.size >= 128)
      throw new HttpError(429, 'TOO_MANY_REQUESTS', 'Hay demasiadas conexiones activas.');
    const listener = { scope, invalidate };
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  close() {
    this.closing = true;
    this.fail();
  }
}
/** Subscribe BEFORE the short authorization transaction, then fence notifications
 * during authorization. No database lock survives into the streaming lifetime. */
export async function serveProductEvents(
  hub: ProductEventHub,
  request: IncomingMessage,
  response: ServerResponse,
  scope: EventScope,
  authorize: () => Promise<void>,
) {
  let closed = false,
    ready = false,
    checking = false;
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(lease);
    unsubscribe();
    if (ready && !response.destroyed) response.end('event: invalidate\ndata: {}\n\n');
  };
  const send = (event: string) => {
    if (!closed && !response.destroyed && !response.write(`event: ${event}\ndata: {}\n\n`)) close();
  };
  response.once('close', close);
  request.once('aborted', close);
  const lease = setTimeout(close, 45_000);
  try {
    unsubscribe = await hub.subscribe(scope, close);
    if (closed) {
      unsubscribe();
      return;
    }
    await authorize();
    if (closed) throw new HttpError(403, 'CONTEXT_REVOKED', 'El acceso cambió.');
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-accel-buffering': 'no',
    });
    ready = true;
    send('ready');
    heartbeat = setInterval(() => {
      if (checking || closed) return;
      checking = true;
      void authorize()
        .then(() => send('heartbeat'), close)
        .finally(() => {
          checking = false;
        });
    }, 5000);
  } catch (error) {
    close();
    throw error;
  }
}
