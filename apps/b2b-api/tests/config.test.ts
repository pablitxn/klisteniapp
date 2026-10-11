import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config.ts';
const env = {
  B2B_DATABASE_URL: 'postgres://example@example.test/klisteni_b2b',
  B2B_AUTH_SECRET: 'b2b-config-test-only-secret-with-length',
  B2B_APP_ORIGIN: 'http://localhost:4200',
};
test('B2B requires dedicated configuration and cannot inherit consumer credentials', () => {
  assert.throws(() =>
    readConfig({
      DATABASE_URL: env.B2B_DATABASE_URL,
      BETTER_AUTH_SECRET: env.B2B_AUTH_SECRET,
      APP_ORIGIN: env.B2B_APP_ORIGIN,
    }),
  );
  assert.throws(() => readConfig({ ...env, DATABASE_URL: env.B2B_DATABASE_URL }));
  assert.throws(() => readConfig({ ...env, BETTER_AUTH_SECRET: env.B2B_AUTH_SECRET }));
  assert.throws(() => readConfig({ ...env, NODE_ENV: 'production' }));
  assert.throws(() => readConfig({ ...env, B2B_APP_ORIGIN: 'http://localhost:4200/app' }));
  assert.equal(readConfig(env).port, 4201);
  assert.equal(readConfig(env).demoMode, false);
});
test('white-label mode requires its own proxy boundary and HTTPS in production', () => {
  const whiteLabel = { ...env, B2B_WHITE_LABEL: 'true' };
  assert.throws(() => readConfig(whiteLabel), /B2B_PROXY_SECRET/);
  assert.throws(
    () => readConfig({ ...whiteLabel, B2B_PROXY_SECRET: env.B2B_AUTH_SECRET }),
    /independent/,
  );
  assert.throws(() => readConfig({ ...env, B2B_TRUSTED_PROXY_ADDRESSES: '*' }), /exact IP/);
  const configured = {
    ...whiteLabel,
    B2B_PROXY_SECRET: 'proxy-config-test-only-secret-with-length',
  };
  assert.equal(readConfig(configured).whiteLabel, true);
  assert.equal(readConfig(configured).domainProtocol, 'https');
  assert.deepEqual(readConfig(configured).trustedProxyAddresses, ['127.0.0.1', '::1']);
  assert.throws(
    () =>
      readConfig({
        ...configured,
        B2B_APP_ORIGIN: 'https://app.example.test',
        NODE_ENV: 'production',
        B2B_DOMAIN_PROTOCOL: 'http',
      }),
    /require HTTPS/,
  );
});
