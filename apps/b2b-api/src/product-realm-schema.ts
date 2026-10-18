/** Additive only: old sessions are never silently promoted into unified authority. */
export const PRODUCT_REALM_MIGRATION_ID = '009-product-unified-realm';
export const PRODUCT_REALM_SCHEMA = `
CREATE TABLE b2b_unified_session_context (
  session_id text PRIMARY KEY REFERENCES b2b_auth_session(id) ON DELETE CASCADE,
  origin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
`;
