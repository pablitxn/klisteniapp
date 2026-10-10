# B2B API

This service owns its PostgreSQL database, Better Auth identities and sessions. It does not read B2C tables, subscription entitlements or credentials. The member application and backoffice share one B2B origin; `/api/b2b` is reverse-proxied to this service. The consumer product retains its own origin and database.

The full HTTP contract and editable Zod schemas are in `packages/b2b-contracts/src/index.ts`. Organization writes require `Origin` and `X-Klisteni-B2B-Account` matching the session's user ID. Bodies are JSON except the raw binary upload endpoint. Every organization operation checks the current membership. A coach can view and assign only their assigned students; a member can record only their own assigned program. Published assignments include immutable exercise and machine snapshots. Submitted executions are immutable: an exact repeated ID/content is idempotent, different content returns a conflict.

## Configuration and database ownership

Use the `B2B_` environment names in `.env.example`. Runtime credentials should have CONNECT, schema USAGE and SELECT/INSERT/UPDATE/DELETE on B2B tables, plus sequence usage, without CREATE/ALTER/DROP. `B2B_MIGRATION_DATABASE_URL` supplies separate DDL credentials for the explicit migration command; it is not used by the server. Configure default grants under the migration owner so newly migrated tables remain accessible to the runtime role. Do not reuse the B2C database or auth secret.

Run `pnpm --filter @klisteniapp/b2b-api migrate` before starting the release. Migrations are versioned and serialized; the HTTP readiness probe requires the latest known migration. Runtime startup never performs schema changes. PostgreSQL roles and grants belong to deployment provisioning, not runtime migrations.

## Operator commands

Passwords come from private environment files or a secret manager and are never command-line arguments or output. Run the following from the repository root with your dedicated B2B environment loaded:

```sh
pnpm --filter @klisteniapp/b2b-api bootstrap
node apps/b2b-api/src/operator.ts create-organization
node apps/b2b-api/src/operator.ts service-access
```

The one-time bootstrap requires `B2B_BOOTSTRAP_EMAIL`, `B2B_BOOTSTRAP_NAME`, `B2B_BOOTSTRAP_PASSWORD`, `B2B_ORG_SLUG` and `B2B_ORG_NAME`. It creates the first platform operator and their organization administrator membership atomically.

To onboard subsequent gyms, `create-organization` requires `B2B_ADMIN_EMAIL`, `B2B_ADMIN_NAME`, `B2B_ORG_SLUG` and `B2B_ORG_NAME`. Supply `B2B_ADMIN_PASSWORD` only when creating a new identity. Existing email identities are reused without changing their name or password. An exact repeat returns `created:false`; a conflicting slug fails rather than overwriting the gym. The command seeds the reusable library independently of B2C.

`service-access` requires `B2B_ORG_SLUG` and `B2B_SERVICE_ENABLED=true|false`; optional `B2B_SERVICE_ENDS_AT` is an ISO timestamp, with omission clearing the end date. This gym contract is independent of B2C payment status. A suspended/expired gym permits authorized historical reads but rejects new business writes.

## Synthetic demo and tests

`seed-demo` creates `atlas-demo` and `sur-demo`, each with `admin`, `coach` and `member` addresses at `atlas.example.test` or `sur.example.test`. It also creates shared machine models, separate physical units, a custom exercise, a versioned routine and an assignment. Rerunning preserves identities and demo edits. `B2B_DEMO_PASSWORD` must contain at least 12 characters. No demo password is hard-coded.

Both seeding and resetting require `B2B_DEMO_MODE=true`, a non-production environment and a database name containing `b2b` and `demo` or `test`. Reset additionally requires the existing demo marker and explicit confirmation:

```sh
pnpm --filter @klisteniapp/b2b-api seed-demo
pnpm --filter @klisteniapp/b2b-api reset-demo --confirm-demo-reset
pnpm --filter @klisteniapp/b2b-api seed-demo
```

Reset only clears explicitly listed B2B-owned tables; it preserves migration history and never discovers unrelated tables to truncate. Uploaded bytes are retained even when the synthetic demo metadata is reset; no automatic deletion or global directory cleanup runs. Stop demo clients before reset. Use migration/operator credentials for reset because a least-privilege runtime role does not need TRUNCATE.

Integration tests require `B2B_TEST_DATABASE_URL` pointing to a disposable database. They create a random schema, run real Better Auth and PostgreSQL operations and drop only that schema. Coverage includes cross-gym isolation, unassigned coaches, membership revocation, queued writes, invitation account reuse, optimistic edits, immutable history, model adaptations, public QR filtering and demo reset guards.

## Library and publication

The shared exercise package is copied into B2B as an initial snapshot; reseeding does not silently overwrite existing base content. Base exercise IDs remain stable and animation IDs are separately validated against the supported visual library. Three generic machine definitions and six machine exercise templates live only in B2B. The templates are drafts requiring local adaptation and human review; no animation or 3D machine model is invented. A gym adapts a base model using `derivedFromId` and `derivedFromVersion`, or a template using `baseExerciseId`, without modifying the base.

Administrators manage models and units; administrators and coaches manage exercises. Local models/exercises move explicitly from draft to reviewed to published, recording the actor in the audit log. Editing invalidates review. Updates and transitions require `expectedRevision`. Unit batches are transactional and accept an idempotency ID, so an exact retry returns the original units. Withdrawing a unit removes it from member/public views; `public:false` removes its public QR destination. Public units also require a published model and website. Existing assignments retain prior exercise and model snapshots.

Website drafts contain activities, opening hours and gallery assets. Publication freezes that content and the current brand; edits remain private until the administrator publishes again. New organizations start unpublished. The migration preserves previously public installations. Unpublishing revokes public pages and public media access. Setup progress is derived from saved content, while `websitePublished` distinguishes an available website from a fully current publication.

## Persistent media

Set an absolute `B2B_MEDIA_ROOT` owned by the API runtime user, on an independent persistent B2B volume. Without it, media endpoints return503. `B2B_MEDIA_QUOTA_MB` defaults to256 per gym. Upload through `POST /api/b2b/orgs/:id/media?kind=image|video|model3d&label=...` with raw bytes and the matching Content-Type, Origin and account header. Administrators/coaches may upload; members cannot. Limits are8MiB for images,32MiB for videos and24MiB for GLB. At most two uploads run concurrently in one API process.

Accepted types are static JPEG/PNG/WebP, MP4/WebM and self-contained static GLB2. Type and bounded container structures are validated; PNG additionally validates its compressed scanlines. JPEG/WebP/video codecs are not fully decoded by the API. SVG, external GLB resources, extensions and animation are rejected. No media-provider credentials or dependency on B2C storage exists.

Files are immutable and addressed by generated IDs. Database metadata owns tenant identity, kind, byte size and hash. Every content write validates uploaded asset ownership and type. Local upload URLs must retain the canonical `/api/b2b/media/:id` form and original asset ID. Do not expose this volume through a static server: the API checks current public references or membership and historical assignment access before streaming, including byte ranges. Responses use no-store so unpublishing revokes subsequent anonymous requests. The library endpoint reports usage and quota; file deletion is intentionally absent to retain history. Back up both the database and media volume. Remote HTTPS references remain supported but their bytes are not copied or made immutable by this service.
