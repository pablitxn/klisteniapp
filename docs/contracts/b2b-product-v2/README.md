# B2B product contract v2 handoff

The final dependency SHA is recorded in the parent handoff/PR receipt. The earlier checkpoint is not a freeze. Read the adopted [ADR](../../adr/b2b-training-v2.md), [WP13 reservation](wp13-boundary.md) and generated [endpoint inventory](endpoints.json).

| Package | Frozen interfaces | Owned implementation |
| --- | --- | --- |
| WP01 | ProductAccess/Member/Invitation; access/people/updateMember/inviteMember/audit; AuthorizedProductContext | Current branch-scoped authorization, role hierarchy, v2 context and own route wiring |
| WP02 | RoutineDraft/AssignableRoutine, GoalProgram/Enrollment/PeriodPreview, PlanningServices | Planning modules and legacy training facade; use final SQL names/columns |
| WP03 | Occurrence/SessionRecord/SessionRevision/Outbox/Receipt/WeekSummary, RecordsServices | Schedule/session services and domain rules; preserve issued linkage and revisions |
| WP04 | ReviewedRelation/EffectiveSegment/RoutineVersionV2/LegacySupplement | Catalog enrichment, own-dose eligibility and segments; no historical JSON edits |
| WP05 | OwnHealth/Consent/ConsentedHealth/Import; HealthServices; product-health-adapter | Owner health and consent transactions with canonical API-only semantic validation |
| WP12 | Legacy/range fixture product-v2.json; endpoint/DTO registry | Reserved cross-feature scenarios/fixtures; shared config requests to INTEGRATION |
| WP13 | Reserved health-import subpath | Integrated parser/wrapper/export; ordinary tests without resolution overrides |

Parent can dispatch WP01/WP02/WP03/WP04/WP05 on separate ownership using the existing full prompts, this ADR and the frozen SHA. Minimal first wave remains WP01/WP02/WP04; WP05 is independent if capacity permits. WP03 can compile concurrently; final acceptance waits for WP01/WP02/WP04. This thread launches no additional worker.

Integration order: foundation plus WP13; WP01 context; WP02 planning/WP04 catalog; WP03 records and WP05 health; WP06 under sequential ACCESS lease; UI packages per existing graph; final composition and WP12 acceptance; WP15 canonical Atlas receipt after actual evidence.

CONTRACT/INTEGRATION retain DTOs, migration registry/readiness/schema, export maps, manifests, lockfile, boundary checker and shared registration. ACCESS takes http/service/context only on explicit parent handoff. Producers submit exact registration requests rather than editing shared files. No worker edits migration 006 or creates competing reserved fields; request an owner-reviewed successor contract. WP12 owns cross-feature browser specs, so feature workers keep their unit/integration tests distinct.

New mutable records use expectedRevision zero and first accepted revision one. Revision snapshots and exact operation responses are append-only. SQL protects relational identity; services validate schedule/dose/completion semantics. Existing v1 routine rows retain schema_version one and untouched JSON. V2 writers explicitly use two. Never infer an old schedule or flatten new content through old DTOs.

WP00 acceptance is contract/migration/compatibility/races, API regression and static checks on disposable synthetic PostgreSQL. It has no browser-layout deliverable. QA matching-runtime smoke is separate from application/database/HTTPS acceptance; unexecuted product scenarios remain unexecuted. Historical Yoga, physical-device and Blender gates remain outside this foundation.
