<a id="marca-blanca-b2b-dominios-marcas-y-múltiples-sedes"></a>

# White-label B2B: domains, brands and multiple branches

Defined/implemented **October 11, 2026**, original **WL-0–WL-8 locally implemented/
verified** codex/b2b-white-label. [Checkpoints](roadmap-implementacion.md#checkpoints-de-marca-blanca-nueva-evidencia),
[new validation](b2b-white-label-validation.md) separate automated/local/physical;
later-authorized [public Atlas-Sur pilot](b2b-white-label-deployment.md) own actual HTTPS evidence.

<a id="1-objetivo-y-decisiones-de-producto"></a>

## 1. Objective and product decisions

Shared B2B for company-owned domain/identity/design/content/modules;**multiple
branches per brand from first delivery**, explicit user decision. Domain brand
before login; session/permission/chosen branch workspace.

- Brand/company=organization/customer boundary; Atlas/Sur separate/multiple branches.
- Branch=own establishment/address-hours-equipment-authorized people/activity, not
  another org/free-text machine location.
- Shared registered domains→same web/API/PostgreSQL, org/branch isolation; B2C independent.
- One B2B identity/person, multi-brand-branch, current permissions, no foreign-role grant.
- Branded pre-login, authorized member-trainer-admin destination/explicit multi-option selection.
- Shared configurable themes/templates/modules/code/update; content/program/inventory ownership/availability explicit.

Excluded cross-domain SSO/shared B2C identity/per-client repos-builds/arbitrary
customer CSS-JS/native app/automatic billing/new Blender authoring. Mac-off remote
work creates no offline app.

<a id="2-recorrido-esperado"></a>

## 2. Expected journey

**Local HTTPS fixtures**, not public domains:

| Entry | Experience |
| --- | --- |
| https://atlas.b2b.test/ | Atlas website/branches |
| /sedes/centro on Atlas | Centro schedule-activity-contact/public equipment |
| /login on Atlas | Published identity before person known |
| /app on Atlas | Member training/authorized branch |
| /manage on Atlas | Trainer/admin by permission/branch |
| https://sur.b2b.test/ | Same app/Sur branches |

Atlas admin Centro-Norte/staff-members/machines/publish identity-website-content/QR;
Centro trainer prescribed Centro equipment/member domain-QR/execution/authorized
monitor. Repeat Norte/two Sur branches, no mixed contexts. Public website no membership;
Sur-only login no authorized Atlas session; multi-brand separate-domain sessions,
only granted branch choices.

<a id="3-base-previa-y-cambios-implementados"></a>

## 3. Previous base and implemented changes

| Area | Pre-WL | Change |
| --- | --- | --- |
| Organizations | Membership/one org role/API validation | Brand plus branches/scoped permission |
| Origins | Single B2B_APP_ORIGIN auth-writes | Registry/per-request brand |
| Login/session | Global login/me multi-org membership | Brand-bound/domain-scoped/authorized branch |
| Navigation | g-slug/app/manage/org selector | Domain entry/branches/shared login/context-role destinations |
| Identity | Name-description-color-logo-contact-address | Pre-login publication/versioned themes-templates |
| Website | Org brand-content draft/publication | Brand presentation/branch-public content/independent access |
| Equipment/training | Org entities/free-text location | Branch ownership/context assignment/historic branch snapshots |
| Features | Roles/service state | Brand-branch modules/UI-API |

Actual entrypoints: [configuration](../apps/b2b-api/src/config.ts), [authentication](../apps/b2b-api/src/auth.ts), [HTTP](../apps/b2b-api/src/http.ts), [service](../apps/b2b-api/src/service.ts), [organization context](../apps/b2b-api/src/organization-context.ts), [data](../apps/b2b-api/src/database.ts), [migrations](../apps/b2b-api/src/migrate.ts), [operator](../apps/b2b-api/src/operator.ts), [contracts](../packages/b2b-contracts/src/organization.ts), [React session](../packages/b2b-react/src/use-session.ts), [member app](../apps/b2b-web/src/App.tsx), [gym management](../apps/b2b-web/src/app/Workspace.tsx), [shared UI](../packages/b2b-ui/src/components.tsx), [local proxy](../scripts/b2b-gateway.mjs) and [Nginx](../docker/nginx.b2b.conf).

Implemented proxy independent secret/exact IP/active per-request registry/exact origin;
[operation](b2b-white-label-runtime.md). Client Host/Forwarded not trusted.

<a id="4-modelo-de-marca-sede-y-permisos"></a>

## 4. Brand, branch and permission model

[WL-0](b2b-white-label-decisions.md) policy, WL-1 contracts/additive004-005.

| Entity | Ownership/rule |
| --- | --- |
| Organization | Brand/service/identity-theme/catalog/domains |
| Branch | Mandatory org/stable ID/per-brand slug/name/address-contact/timezone-hours/active-archived |
| Membership | Active account-org/prerequisite branch permissions |
| Permission | Brand admin or specific branch trainer-member, no foreign role |
| Domain | Unique normalized host/org/verification-activation/primary-alias |
| Reusable model-exercise-program | Shared base/brand-owned/explicit branch availability |
| Unit | Mandatory org-branch/location within branch |
| Assignment/execution | Org/practice branch/authorized people/prescription-historic context |
| Private media | Brand/optional branch/reference permission, not ID knowledge |

<a id="reglas-de-acceso-para-la-primera-entrega"></a>

### First-delivery access rules

Admin whole own brand/selects operational branch/explicit aggregate scope. Trainer
only granted branches/assigned members, not every brand member. Member own routines-
records/multi-branch/assignment place-units. Trainer Centro/member Norte possible,
no global role/first-list choice. Backend domain→brand→active membership→branch→
action→resource; client request no grant, operational/historic auth separate.
Revalidate new/queued operations; context invalidation sensitive cleanup/cross-tab/
late-response discard, not recall received bytes. Draft-cache brand-branch-account-work context.
Archive blocks new assignment/activity, retains owner/admin history, no trainer
escalation. Active brand member retains own old-branch executions/snapshot-media
through specific history authorization, not operational inventory/new sessions/others.
Full exit retains records/no autonomous access, pre-exit export or controlled operator,
no automatic deletion. Person transfer future access only; unit historical/active
assignments explicitly resolved before move, not implicit Norte→Centro substitution.

<a id="migración-de-organizaciones-existentes"></a>

### Existing-organization migration

Deterministic **Principal**, existing units/assignments/logs/relationships; preserve
IDs/content/location/identities/snapshots, versioned historical adapter. Existing
admins brand/staff-member original Principal, then normal new branches; fixture two
from start. Pending old invitations expiration/one-use: admin brand/staff-member
Principal equivalent, no new branch privilege. Server migrated data, not client parameter.
Additive entities→backfill→integrity→mandatory indexes-constraints→new contracts.
Cross-brand valid branchId rejected; document anomalies, no silent relocation.

<a id="5-dominios-contexto-y-sesiones"></a>

## 5. Domains, context and sessions

<a id="resolución-antes-del-login"></a>

### Resolve before login

1. Registered HTTPS/configured proxy-normalized identity only.
2. Active registry, no unknown-malformed-unverified-disabled customer/default.
3. Implemented GET /api/b2b/context published identity/public branches/theme-navigation only, no people-membership-private permissions/drafts.
4. Exact current-origin auth-writes, Atlas registration no Atlas→Sur POST; defined internal health exposure.

All auth/me/org-branch/website/QR/media/invite/export context.
atlas.b2b.test/g/sur-demo or unauthorized Norte ID no implicit change.

<a id="login-y-permisos"></a>

### Login and permissions

Better Auth credentials/server brand association, check before usable session;
generic errors no foreign membership disclosure. Host-limited HTTPS cookies/
origin plus server brand binding, copying no access. Me current brand/granted branches.
Authorized QR-invite branch first, last valid selection next; one auto/multiple selector.
Member/app; trainer/manage monitoring; admin/manage brand-branch prep/admin. Authorized
internal deep links only. Revoked branch-grant invalidates persistent selection;
logout own-domain sensitive cleanup, global credential-revocation policy explicit,
no SSO/broad shared cookie.

<a id="ciclo-de-vida-operativo"></a>

### Operational lifecycle

Request→ownership→DNS→HTTPS certificate→activate, evidence-date/one primary/verified
alias redirect. Gym admin requests, operator verifies. Renewal/DNS-TLS failure/pause/
primary switch/unlink; no abandoned-domain automatic reassign. Immediate session-cache
invalidation, old cookie cannot restore. Old-domain access only verified-enabled.

<a id="enlaces-y-compatibilidad"></a>

### Links and compatibility

- Absolute website-invite-QR-shared links registered primary/optional branch-unit, not arbitrary Host.
- General public known g-slug redirects possible, no private directory/global-login bypass.
- Legacy current-brand only/normalized, foreign reject; old invitation org-branch-role-expiry-one-use retained.
- No session token redirects. Legacy invite transfer narrowly canonical, secret-free query-logs, defined/tested before enable.
- Explicit historic resource mapping, no JSON-wide replacements; record printed QR continuity/reprint.

<a id="6-identidad-diseño-módulos-y-contenido"></a>

## 6. Identity, design, modules and content

<a id="identidad-y-diseño-publicados"></a>

### Published identity/design

Atlas/Sur clearly distinct logo/name/palette/allowed-font catalog/component forms/
entry images-text/layout templates, shared validated tokens/defaults/contrast, no
arbitrary scripts/styles. Login/branch selector/website/member/manage/empty-error/
browser metadata. Versioned private draft/public identity-theme, authorized preview
no other-session change; explicit audited publish-restore, no form-training loss.
Identity/website independent; unpublish retains minimum login-error identity.
Brand/branch explicit revisions, Centro edit not Norte publication. Migration prior
public identity retained/reconcile differing private brand. Branch inherits visuals,
own contact-hours-activity-photo-plan. Branch-specific domain/different design
future, working multi-branch required now.

<a id="módulos-y-catálogo"></a>

### Modules and catalog

Platform entitlement∩brand-branch preference∩user permission/service. UI/backend
same effective policy; branch disable allowed, not elevation. Explicit existing
website/equipment-QR/plan/media/voice registry/dependencies/disable behavior per WL-0.
Auth/authorization/history-export not casual optional toggles. Module reads/writes/
publication/in-flight policy, snapshots retained/no silent active instruction loss.
Backend immediate, no website-publication delay. Shared/brand content explicit branch
availability; physical units branch. Provenance/no base mutation; hide future selection
not historical prescription; cross-branch private publication explicit authorization.
Media/previews/caches scoped brand-branch-publication.

<a id="7-entregas-y-dependencias"></a>

## 7. Deliveries and dependencies

Original planning states all **pending**, not current implementation claim; later
checkpoint table records completed. Each identifiable commit/behavior/evidence.

| ID | Delivery | Dependency | Closeout |
| --- | --- | --- | --- |
| WL-0 | Inventory/contracts-branches-roles-domains-compatibility | Base | Agreed journey/permission matrix/affected data-migration |
| WL-1 | Branch-grant-domain-theme-capability contracts/migrations | WL-0 | Existing-data retention/two×two fixtures/cross-FK rejection |
| WL-2 | Trusted proxy/domain/public context | WL-1 | Two actual test hosts/same runtime/published own context/unknown reject |
| WL-3 | Brand session/branch auth/all routes | WL-2 | Brand login/roles/revoke-ID attacks API |
| WL-4 | Entry/branch-multi-management/role destinations/links | WL-3 | Admin branches-access/full domain journey/invite-QR-deep links |
| WL-5 | Themes/templates/private preview/public identity-websites | WL-4 | Distinct all surfaces/branch-independent publish/restore |
| WL-6 | Capabilities/availability/transfer-archive | WL-4/WL-5 contracts | UI-API permissions/history/isolation |
| WL-7 | Domains/DNS-TLS/aliases/origin migration/diagnostics | WL-2 + WL-3–6 | Lifecycle/shared runtime/platform rollback |
| WL-8 | Integrated acceptance/realistic migration/HTTPS pilot | WL-1–7 | New E2E-runtime/QR continuity/physical limits |

WL-0→1→2→3→4→5-6→8;7 starts after 2/before 8. WL-4 first vertical already two branches,
not second delivery. Relevant matrix per phase, not isolation postponed.

<a id="trabajo-concreto-por-paquete"></a>

### Package work

| Area | Planned refactor |
| --- | --- |
| b2b-contracts | Org-branch/grants/context/session/theme/capabilities/versioned public-private DTO |
| b2b-domain | Effective permission/content availability/unit-branch compatibility pure |
| apps/b2b-api | Request context/migration/reused central auth/content-people-media-training-publication/operator |
| b2b-client | Same-origin context/validated branch/typed errors/coherent routes-versions |
| b2b-react | Brand session/branch loads/cancel-cleanup/cache-draft context keys |
| b2b-ui | Shared login/context selector/validated theme/variants |
| member-web | Brand-branch website/login/selection/correct place-inventory training |
| b2b-web management | Branch-people-grants/content/identity-publication/visible scope |
| Proxy/scripts | Fixture hosts/HTTPS/readiness/demo/migrate/smoke/domain diagnostics |

No frontend auth ownership/B2C app imports. Strict contracts/API/frontend coordinated release.

<a id="8-matriz-de-aceptación-de-punta-a-punta"></a>

## 8. End-to-end acceptance matrix

Minimum two×two brands-branches/themes/admins/single-multi-branch trainers/unassigned
trainer/single-multi members/multi-brand differing-role person. Same-label foreign
units/shared-private content/historic routines.

| ID | Case | Required result |
| --- | --- | --- |
| D01 | Two domains/same image-service | Correct pre-login brand, no customer build switch |
| D02 | Unknown-unverified/forged proxy/direct API | No brand/private resources |
| D03 | Atlas member-trainer-admin login | Granted branches/context-role destinations |
| D04 | Sur-only Atlas login | Reject/no session/foreign disclosure |
| D05 | Multi-brand/differing roles | Independent contexts/no max-role inheritance |
| D06 | Changed org-branch-resource IDs URL-body-storage | API cross-reject, not hidden UI only |
| D07 | Foreign cookie-Origin/revoke/queued | Auth fail/UI sensitive-late cleanup |
| D08 | New-existing-used-expired/wrong domain-branch/pre-backfill invite | Correct consent-context-role; Principal equivalence, no reused-identity escalation |
| D09 | One branch public/other draft/foreign g-slug | Correct publication/unpublish retains login |
| D10 | Private-direct media/HEAD-Range/cache | Permission-publication/brand-branch isolation |
| D11 | Branch/staff-member/prescribe-execute | Correct inventory-assignment; unassigned trainer cannot read |
| D12 | Person-unit transfer/revoke/archive | Explicit active resolution/own history active membership/no operating access/intact snapshots/no archived writes |
| D13 | Unsaved context switch | Warning/recovery/isolated keys, no foreign save |
| D14 | Two themes/preview-publish-restore-reload | Consistent/private draft/contrast/fallback |
| D15 | Disabled brand-branch/direct API | Read-write-history policy/no branch elevation |
| D16 | Old-new QR/primary-alias-switch-unlink | Authorized mappings, no open redirect/token logs |
| D17 | Admin→trainer→member→monitor | Both brands/two branches/retry |
| D18 | Old-empty migration/restart/joint restore | Historic IDs-data-permissions/new config-media |
| D19 | B2C/demo/shared packages | No B2B domain-session-DB dependency/applicable regressions |

Desktop-touch Chromium/touch WebKit **two hostnames same instance**, single origin
not domain isolation. Historical controlled fixture-CA allowance did not prove
production TLS; future runs current no-bypass/no-trust-change rule. Disposable API
DB/schemas, VPS headless/screens-traces/reproduction without Mac; physical Safari-
iPhone/WebGL/voice/printed QR separate.

<a id="9-migración-release-y-recuperación"></a>

## 9. Migration, release and recovery

1. Inventory revision/schema/org/implicit branches/membership-links-data-media;
   independent restored copy for migration.
2. Additive schema/brand-branch code/coordinated strict DTO UI-API/min compatible
   version/old-session policy; domain enable requires reauthentication.
3. Test domains/WL-8, pilot only verified domains/reviewed content.
4. Pilot branch-identity-link-QR-permission checks then expand; scoped errors without
   emails/tokens/passwords/full private URLs.
5. DB-media-config/domain-proxy-TLS recovery; theme restore not migration reversal.

**Rollback limit:**old org-only binary after branch grants could leak across branches,
not default allowed. Compatible prior binary/forward fix/ensured coordinated old
state restore, no data/branch deletion for compatibility. Quiesce/preserve current
consistent copy, restore separately/verify before switch, reconcile later writes/
record recovery point/unresolved loss.508e9e1 historic reports not this architecture;
new commit-clean tree-or-identified diff/images-schema/topology/results-skips-limits,
local smoke not public deploy. Deferred previews/full check-CI gates retained,
no hash-snapshot-CI edits to fake full acceptance.

<a id="10-continuación-desde-otra-instancia-de-codex"></a>

## 10. Continue from another Codex instance

[VPS](development-vps.md), Git checkpoint/remote gitlab main/verify SHA, planned local
work published before Mac-off; no env-cache-session-DB-private media copying.
Continue current checkpoints/WL-8 evidence, [WL-0](b2b-white-label-decisions.md)
modules-variants-transfer-history. **Multi-branch first delivery implemented.**
Reading grants no public domain/deployment operation.

| Stage | State | Commit/evidence |
| --- | --- | --- |
| WL-0 | Complete | a451d9c/inventory-permissions-decisions |
| WL-1 | Complete | 5fdf22d004; d0a9011005/public profile; migration5/5 |
| WL-2/3/7 | Implemented/tested | d0a9011/domain-session-auth/API76/76 |
| WL-4/5/6 | Complete | 15660fd/login-branch-themes-modules/UI30/30 |
| WL-8 | Complete authorized local scope | API76/76, E2E30/30, B2C3/3, images6/6, restore6/6;[new evidence](b2b-white-label-validation.md) |
| Public domains | Outside original execution | No customer DNS-cert/production then; later pilot own evidence |

Update table/roadmap actual stage/evidence, historical release scope retained.
