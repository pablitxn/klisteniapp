import { readConfig } from './config.ts';
import { createPool } from './database.ts';
import { createAuth } from './auth.ts';
import { createApiServer } from './http.ts';

const config = readConfig();
const pool = createPool(config);
const server = createApiServer({ config, pool, auth: createAuth(pool, config) });
server.listen(config.port, config.host, () => { console.info(`Klisteniapp API listening on ${config.host}:${config.port}`); });
let closing = false;
function shutdown(): void {
  if (closing) return;
  closing = true;
  // A lost database connection can leave in-flight operations unsettled even
  // after HTTP sockets close. Bound shutdown inside Kubernetes' grace period.
  const deadline = setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 10000);
  deadline.unref();
  server.close(() => { void pool.end().finally(() => clearTimeout(deadline)); });
}
server.on('error', () => { console.error('API listener failed'); process.exitCode = 1; shutdown(); });
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
