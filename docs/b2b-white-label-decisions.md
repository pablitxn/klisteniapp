<a id="wl-0-inventario-y-decisiones-de-implementación"></a>

# WL-0: inventory and implementation decisions

**October 11, 2026** checkpoint concretizes [white-label plan](b2b-white-label.md)
on received code. Decisions WL-1–WL-8, not implementation/deployment evidence;
[roadmap](roadmap-implementacion.md) stage results. Later validation retains own revision.

<a id="1-límite-y-recorrido-de-la-entrega"></a>

## 1. Delivery boundary and journey

Organization brand/customer boundary; branch own stable identity/mandatory org.
One B2B/PostgreSQL Atlas Centro-Norte/Sur Centro-Oeste, different hosts same runtime.
Independent B2C apps/DB/cookies/accounts/subscriptions. First vertical create branch/
authorize people/units/prescribe/log/monitor. Person trainer Centro/member Norte;
explicit brand-branch-role selection when multiple.
Excluded production/real DNS/cross-domain SSO/per-client builds/arbitrary CSS-JS/
deferred previews. Headless VPS no physical Safari-iPhone/voice/WebGL/printed QR replacement.

<a id="2-inventario-comprobado-en-el-checkout-anterior-a-wl-1"></a>

## 2. Verified pre-WL-1 inventory

| Area | Found state | Affected files/obligation |
| --- | --- | --- |
| Schema | Own SQL001-initial/002-catalog-lifecycle/003-content-media, no Prisma | database.ts/migrate.ts additive backfill/composite integrity |
| Accounts | Independent Better Auth, baseURL-trustedOrigins single config.origin/host-only cookie | auth.ts/config.ts server-brand origin/session binding/generic wrong-membership rejection |
| HTTP | Host-forwarded auth sanitization/global mutation origin | http.ts resolve before auth-public-media/current exact origin/before streaming |
| Transactions | organization() lock/session-membership revalidation | service.ts/organization-context.ts retain serialization/add branch-role-grants |
| People | One b2b_membership.role/brand, unscoped b2b_coach_assignment | service.ts, packages/b2b-contracts/src/organization.ts, People.tsx admin-vs-branch grants |
| Inventory | Free-text unit.location/org-only queries | equipment/index.ts, Equipment.tsx, QRCodes.tsx, catalog contracts mandatory branch/availability/context QR |
| Library | Brand/global model-exercise ownership, brand program-version | catalog/index.ts, training/index.ts, contracts-domain retain reuse/provenance/branch availability |
| Prescriptions/history | Org-only assignments-executions/immutable version snapshots | training/repository.ts, rules.ts, training contracts branch/historical auth |
| Website | Org singleton b2b_website, brand-content publication | service.ts, Website.tsx, websiteDraft.ts, PublicGym.tsx independent identity/branch publication |
| Media | Org ownership/staff-wide/member references | service.ts: mediaAccess, media.ts, MediaLibrary.tsx, ContentMedia.tsx host-branch GET-HEAD-Range |
| Invitations | Hashed/expired/one-use, no branch | service.ts, org contracts, Invitation.tsx Principal backfill/correct-brand consumption |
| Client/session | me all memberships/apps role-brand lists/stale-response cancellation | b2b-client/src, b2b-react/src, ApplicationProvider.tsx, Workspace.tsx host-scoped/validated context/cleanup |
| Drafts | Org-account-assignment; editor org-account-type-entity | sessionDraft.ts, editorDraftStorage.ts, useEditorDraft.tsx version keys/operational branch-role |
| Proxy | Local Host→loopback, Nginx host/forwarded stripping | scripts/b2b-gateway.mjs, docker/nginx.b2b.conf normalized-host explicit trust |
| Fixtures/operator | Atlas-Sur/no branches | demo.ts, operator.ts, setup-runtime-E2E scripts/two branches-domains-negative cases |
| Tests | Disposable API schemas/one-origin three-project Playwright | apps/b2b-api/tests, apps/b2c-web/playwright.b2b.config.ts, B2B suites/two-host-old migration-D01–D19 |

API paths relative apps/b2b-api/src; frontend abbreviations features/root/b2b-ui by domain.

<a id="3-entidades-y-compatibilidad"></a>

## 3. Entities and compatibility

Add branches/grants/domains/brand-bound sessions/versioned identity/preferences-
capabilities/branch publication. Composite FK(organization_id, branch_id); real Sur
ID cannot bind Atlas. Per-brand unique slugs, not authorization. Brand membership
active/admin retained; legacy coach-member migration compatibility only, new operational
grants, no max-role from another branch.

Branch units/coaching/assignments/executions/location-contact-schedule-public content/
scoped uploads. Models/exercises/programs possible brand library, explicit availability-
modify permissions. Centro-only trainer cannot publish/edit Norte because same org.
Migration deterministic **Principal**, existing operational data/IDs/location retained;
admins brand, staff-members original Principal only. Old invitations server Principal,
token-expiry-one-use retained, no later-branch access.

No indiscriminate snapshot JSON rewrites. Migrated assignment-execution/versioned
adapter supplies historic context, immutable exercise-model content. History actual
record branch, not current selector. Version b2b_unit_batch keys/results, no Centro
replay Norte units. Tables-columns→backfill→anomaly checks→constraints-indexes→strict
contracts. Inconsistent cross-brand abort, no silent correction. Domain activation
old unbound sessions new login.

<a id="4-matriz-de-permisos-efectiva"></a>

## 4. Effective permission matrix

Trusted host→active brand→brand session→active membership→authorized branch-role→
permission→resource. Client header-body-query-localStorage alone grants nothing.

| Action | Brand admin | Branch trainer | Branch member |
| --- | --- | --- | --- |
| Brand-theme-capabilities/branches-people | Own brand | No | No |
| Domain verify-activate-transfer | Platform operator; admin request only | No | No |
| Operational catalog/inventory | Selected branch | Granted branches | Granted/permitted content |
| Unit create-move-archive/branch website publish | Identified branch | No | No |
| Shared brand-library edit | Yes | Explicit scoped resources only | No |
| Prescribe | Selected branch/authorized member | Assigned member same branch | No |
| Execute | Not for someone else | Only authorized member role | Own/authorized active branch |
| Current activity | Selected branch/explicit implemented aggregate | Assigned members selected branch | Own |
| History after operational branch access lost | Own brand | No without current permissions/relationship | Own/active brand membership |
| Private media | Own-brand property/reference | Granted scope/reference | Authorized content/own snapshot |
| Export | Authorized own-brand records | Current scope if offered | Own history/active membership |

No implicit trainer aggregation; admin selects operational branch. Future aggregate
explicit scope/dedicated authorization-query. Revocations share org lock with writes,
queued old permission rejected. Context change invalidates pending/remounts keyed
consumers/only own drafts. Logout/revoke sensitive cleanup/cross-tab notice, not
recall already-received bytes.

<a id="5-traslados-archivo-y-salida-de-marca"></a>

## 5. Transfer, archive and brand exit

**Person:**explicit destination grant/source revoke; old assignment branch unchanged.
New prescriptions destination access/coaching, queued origin rejects after revoke.
Active brand member retains own historic executions/snapshots, not current inventory/
unreferenced private media.
**Unit:**same brand/active destination; incompatible active assignments block. Explicit
close-reassign affected prescriptions first, no homonymous automatic substitute.
Missing retirement functionality retains blocker/limit. Historic QR/ID retained,
destination only after publication/auth confirmed.
**Archive:**row/history retained; no new assignment-execution-inventory/public operational
publication. Own/admin history remains, no trainer escalation. Explicit restore, no
automatic revoked grants.
**Full brand exit:**immediate sessions/access revoke, records retained/authorized admin
controlled export; member may export before exit if flow exists. No public download/
automatic deletion/undefined contractual retention promises. Legal deletion-retention
not WL automated; offboarding UI describes retained data/lost access.

<a id="6-dominios-y-sesiones"></a>

## 6. Domains and sessions

Normalized unique registry organization/state/verification/revision/primary-alias.
WL no default for unknown-malformed-pending-paused-disabled. Configured proxy-only
host identity, strips client values. Internal health/readiness data-free exception.
Server session brand/current domain association; copied cookies/reactivated-reassigned
host grants nothing. Binding for auth/get-session, me, media, website, invitations, exports/
legacy links. Me current host brand only, foreign login generic/no usable session.
Exact current origin auth-writes; Atlas/Sur not interchangeable. Host-only/HttpOnly/
SameSite/HTTPS Secure, no shared cookie/SSO. Verified aliases registry primary only,
association changes immediate cache-session invalidation.

Website/QR/new invite canonical primary. g-slug current brand only; directory if
retained known-public redirects, not login bypass. Invite secrets no query/logs.
No legacy cross-host transfer absent proven mechanism; safe canonical continuation,
not token relocation to unvalidated destination.

<a id="7-temas-publicación-y-módulos-iniciales"></a>

## 7. Themes, publication and initial modules

Versioned distinguishable Atlas compact-geometric/Sur spacious-rounded. Palette/
catalog fonts/forms/logo/text/images/readable validated tokens, no customer HTML-CSS-JS.
Login/selectors/website/member-management/empty-error/browser title shared published
identity. Authorized draft/explicit audited versioned publish-restore; preview no
other-session/form effect. Brand website/branch website/minimal login identity
separate cycles; website withdrawal retains login. Migration last public identity,
not differing private draft.

Effective capability=platform∩brand∩branch∩user permission∩service conditions.
Branch cannot elevate; auth/authz/own history-export foundational, not optional.

| Module | Dependencies | Disable policy |
| --- | --- | --- |
| Public website | Independent minimum identity | Public read-publish removed/draft-version history retained/login |
| Equipment/QR | Available catalog/branch inventory | Block new operations-publication/public QR; authorized historic snapshots |
| Plan/space | Website; unit points equipment | Hide current plan/block edit-publish; no media-history deletion |
| Media | Authorized private storage | Block uploads-selections; published/snapshot references readable |
| Guided voice | Training/written instruction | Hide-stop voice; text-training retained |

Equipment/media off not silently invalidate active routine; historic authorization
retained even unavailable new prescriptions. Branch-hidden library affects new
selection, not base/assigned versions; cross-branch private publication explicit authorization.

<a id="8-checkpoints-y-evidencia-exigida"></a>

## 8. Required checkpoints and evidence

1. WL-1 old-empty fixtures migrate/Principal IDs-data-roles/two branches each/composite FK rejection.
2. WL-2/3 two hosts/same runtime/reject wrong host-proxy-origin/foreign login/copied cookie/cross role/queued revoke.
3. WL-4 admin→trainer→member→monitor each/new-old invitations/context draft.
4. WL-5/6 separate publication-restore/UI-API module policies/availability-transfer-archive/historic access.
5. WL-7/8 primary-alias-offboarding/controlled-CA historical HTTPS/D01–D19 three engines/joint DB-media-config restore/B2C regressions. Future tests follow current no-bypass/trust-change rule.

Disposable DB/schema/documented commands/new evidence.508e9e1 base only; per phase
SHA-diff/commands/result/topology/skips/risks. No authorized production/DNS/physical
claim. Blocking risks: org-only operational queries/legacy-derived permissions/
media before brand check/stale domain cache/global unbound login/cross-branch
idempotent inventory-drafts/mutable snapshot adapters/two paths instead of origins/
DB-only restore without compatible media-config.

After branches/grants no old org-only binary. Compatible binary/forward fix or
quiesced coordinated restore with preserved current state; record recovery point/
post-backup writes, no deletion to fake compatibility. Theme rollback no schema-permission rollback.
