import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { cleanupFixture, fixtureDatabaseUrl } from "./fixture-safety.ts";

const url = (host, query = "") => "postgresql://" + host + "/fixture_test" + (query ? "?" + query : "");

test("fixture destinations preserve loopback hosts and explicit ports", () => {
  for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
    assert.equal(fixtureDatabaseUrl(url(host)).hostname, host);
    assert.equal(fixtureDatabaseUrl(url(host)).port, "5432");
    assert.equal(fixtureDatabaseUrl(url(host + ":54331")).port, "54331");
  }
});

test("the PostgreSQL CI service requires an explicit opt-in", () => {
  assert.throws(() => fixtureDatabaseUrl(url("postgres")));
  assert.equal(fixtureDatabaseUrl(url("postgres"), { allowCiServiceHost: true }).hostname, "postgres");
  assert.throws(() => fixtureDatabaseUrl(url("outside.invalid"), { allowCiServiceHost: true }));
});

test("routing and identity query overrides fail before connection construction", () => {
  for (const query of [
    "host=outside.invalid", "%68ost=outside.invalid", "host=localhost&host=outside.invalid",
    "host=%2Ftmp%2Ffixture-socket", "HOST=localhost", "port=54331", "%70ort=54331",
    "user=fixture_user", "password=" + randomUUID(), "hostaddr=192.0.2.1",
    "database=another_fixture", "dbname=another_fixture", "connectionString=invalid",
    "sslcert=fixture-cert", "sslkey=fixture-key", "sslrootcert=fixture-root",
  ]) assert.throws(() => fixtureDatabaseUrl(url("localhost", query)));
});

test("decoded NUL cannot inject PostgreSQL startup fields", () => {
  for (const input of [
    "postgresql://fixture%00search_path%00public@localhost/fixture_test",
    "postgresql://fixture:synthetic%00@localhost/fixture_test",
    "postgresql://localhost/fixture_test%00search_path%00public",
    url("localhost", "application_name=fixture%00search_path%00public"),
    url("localhost", "options=-c%20search_path%3Dpublic%00"),
    url("localhost", "sslmode=disable%00"),
  ]) assert.throws(() => fixtureDatabaseUrl(input));
  assert.equal(fixtureDatabaseUrl("postgresql://fixture%2500@localhost/fixture_test").username, "fixture%2500");
});

test("database selection cannot fall back to ambient state", () => {
  for (const input of [undefined, "", "postgresql://localhost", "postgresql://localhost/",
    "https://localhost/fixture_test", "socket:/tmp/fixture", "postgresql://localhost:0/fixture_test",
    url("localhost") + "#fragment"]) assert.throws(() => fixtureDatabaseUrl(input));
});

test("supported session and TLS settings survive canonicalization", () => {
  const result = fixtureDatabaseUrl(url("localhost", "application_name=fixture&sslmode=verify-full&options=-csearch_path%3Dpublic"));
  assert.equal(result.searchParams.get("application_name"), "fixture");
  assert.equal(result.searchParams.get("sslmode"), "verify-full");
  assert.equal(result.searchParams.get("options"), "-csearch_path=public");
});

test("invalid configuration errors never include supplied credential material", () => {
  const sensitive = randomUUID();
  for (const input of ["not a url " + sensitive, "postgresql://fixture:" + sensitive + "@outside.invalid/fixture_test"]) {
    assert.throws(() => fixtureDatabaseUrl(input), error => !String(error).includes(sensitive));
  }
});

test("cleanup attempts every stage after each possible failure", async () => {
  const names = ["recovery", "http", "scoped-pool", "schema", "admin-pool"];
  for (const failure of [null, ...names]) {
    const calls = [];
    const steps = names.map(name => async () => {
      calls.push(name);
      if (name === failure) throw new Error("Synthetic cleanup failure");
    });
    if (failure) await assert.rejects(cleanupFixture(steps), AggregateError);
    else await cleanupFixture(steps);
    assert.deepEqual(calls, names);
  }
});

test("cleanup reports multiple failures after all steps have run", async () => {
  let calls = 0;
  await assert.rejects(cleanupFixture([async () => { calls++; throw new Error("one"); },
    async () => { calls++; throw new Error("two"); }]), error => error instanceof AggregateError && error.errors.length === 2);
  assert.equal(calls, 2);
});
