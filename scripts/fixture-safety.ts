/** Pure fixture guards; never import these restrictions into production pools. */
export function fixtureDatabaseUrl(
  value: string | undefined,
  { allowCiServiceHost = false }: { allowCiServiceHost?: boolean } = {},
): URL {
  if (!value) throw new Error("TEST_DATABASE_URL is required for fixture databases.");
  let url: URL;
  try {
    url = new URL(value);
    // Match the driver's decoding without exposing the supplied URL in errors.
    const decoded = [decodeURIComponent(url.username), decodeURIComponent(url.password),
      decodeURI(url.pathname), ...url.searchParams.keys(), ...url.searchParams.values()];
    if (decoded.some(value => value.includes("\0"))) throw new Error("Invalid startup field.");
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hash) {
    throw new Error("Fixture databases require a PostgreSQL URL without a fragment.");
  }
  const hosts = ["127.0.0.1", "localhost", "[::1]"];
  if (allowCiServiceHost) hosts.push("postgres");
  if (!hosts.includes(url.hostname)) {
    throw new Error("Fixture databases require loopback or the explicitly enabled CI service.");
  }
  if (url.pathname.length <= 1) {
    throw new Error("Fixture databases require an explicit database path.");
  }
  // Keep only non-routing session/TLS options. Routing, identity overrides
  // and certificate-file query parameters are deliberately unsupported.
  const allowedParameters = new Set(["application_name", "options", "sslmode"]);
  for (const name of url.searchParams.keys()) {
    if (!allowedParameters.has(name)) {
      throw new Error("Unsupported fixture database query parameter.");
    }
  }
  // Pin the default so ambient PGPORT cannot select another local service.
  if (!url.port) url.port = "5432";
  if (Number(url.port) < 1 || Number(url.port) > 65535) {
    throw new Error("Fixture database port must be between 1 and 65535.");
  }
  return url;
}

/** Attempt every run-owned cleanup step even when an earlier step fails. */
export async function cleanupFixture(steps: Array<() => Promise<unknown>>): Promise<void> {
  const errors: unknown[] = [];
  for (const step of steps) {
    try { await step(); } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, "Fixture cleanup failed.");
}
