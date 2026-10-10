import { createAuth } from './auth.ts';
import { readConfig } from './config.ts';
import { createPool } from './database.ts';
import { createApiServer } from './http.ts';
const config = readConfig();
const pool = createPool(config);
const server = createApiServer({ config, pool, auth: createAuth(pool, config) });
server.listen(config.port, config.host, () =>
  console.info(`B2B API listening on ${config.host}:${config.port}`),
);
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, 10000);
  timeout.unref();
  server.close(() => {
    void pool.end().finally(() => clearTimeout(timeout));
  });
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
server.on('error', () => {
  console.error('B2B listener failed');
  process.exitCode = 1;
  close();
});
