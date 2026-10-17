# WP03 owner handoff

Frozen source: `22dd8743ce9e20cecfb7ddd098a75d0af1bef5ba`.
Base: `0b611064a91b87b3a17274cabca5415bcf1d7d55` (PR15 foundation plus WP13).
No shared owner files were edited. Parent owns dispatch, review, composition and main merge.

## INTEGRATION: exports and records composition

Apply `integration-exports.patch`: add the two domain subpaths to `packages/b2b-domain/package.json`.
No dependencies or lockfile additions are needed. Root domain barrel changes are unnecessary for these callers.
The native Node test resolution hook and external TypeScript paths used here are validation-only; remove their use once the owner applies the public exports.

Import `createRecordsServices` from `apps/b2b-api/src/schedule/index.ts` and instantiate once with the server clock (default: `new Date()`).
Register these exact named service handlers in WP01's ProductServices composition:

```ts
const records = createRecordsServices();
// Each handler receives ACCESS's current AuthorizedProductContext and parsed input.
const recordsHandlers = {
  occurrences: records.occurrences,
  moveOccurrence: records.moveOccurrence,
  week: records.week,
  sessions: records.sessions,
  sessionRevisions: records.sessionRevisions,
  saveSession: records.saveSession,
};
```

ACCESS registers only the corresponding frozen ProductEndpoints routes and contract-v2 header gate. It must authenticate and lock current session/host generation, tenant entitlement, active membership and selected branch grants before invoking these callbacks or exposing operation receipts. All services reuse `context.db`; the caller owns BEGIN/COMMIT/ROLLBACK. The feature handlers call `authorizeMember` before receipt lookup. Do not construct a context from request payload identity or role. New v2 HTTP routes are not installed by this feature PR.

## WP02: enrollment/period reconciliation

Import `prepareReconciliation`, `persistReconciliation` from `src/schedule/index.ts` and `enrollment`, `memberOccurrences` from `src/schedule/repository.ts`.

1. Lock the current enrollment first (`enrollment(context, id, true)`) and authorize current planning access. Enforce the enrollment CAS and operation replay in WP02's authorized transaction.
2. Build the full validated next Enrollment DTO. `b2b_enrollment_revision.content` must contain that complete DTO, as adopted by the ADR; stage rows contain each full Stage DTO.
3. Obtain existing occurrences for this enrollment. Call `prepareReconciliation(context, before, next, asOf)` before persisting the next planning revision. For initial enrollment pass `before = null`. Returned `planned` is the full ledger plan; `impacts` includes every existing occurrence's revision/date/eligibility and linked session IDs, including accepted date overrides. IDs for new rows are deterministic for the next enrollment revision.
4. Bind the preview hash to proposed content, current enrollment revision, complete impacts (including unchanged ones) and expiry. On apply, lock the same enrollment, recompute and compare the preview. This rejects a stale preview after a member reschedule, log correction or planning edit. Include newly planned obligations in the caller's preview/hash, not only removals.
5. Write the next enrollment revision and its stage rows before `persistReconciliation(context, previousOccurrences, planned)` so issued-stage FKs exist. Persist the head, receipt and planning audit in the same transaction. This helper owns occurrence head/revision writes only; WP02 owns preview validation and the planning audit/receipt.
6. Ending an enrollment supplies a fixed server `asOf` instant. It cancels only dates strictly after that instant's local calendar date. Past/today obligations remain eligible for authorized late actuals; actuals and issued lineage never change. A preview crossing a local date boundary must be refreshed.

Equal-length period translations retain stable identities by the prior schedule position, extensions retain existing dates and allocate new ordinals above the prior maximum, and weekday edits retain identities. Removed obligations stay cancelled with revisions. Existing timezone/date history is not reinterpreted when a later planning revision changes timezone; new obligations use the new explicitly confirmed zone. Weekly summaries derive from current eligible occurrence IDs and immutable latest actual revisions under enrollment locks, so both old and new weeks are recalculated on read without stored counters.

## WP04: target dose and historical supplement seam

New v2 prescriptions must freeze complete `RoutineVersionV2` source steps and directed reviewed relations, including each independent target dose, target exercise, provenance and conditions. Session validation matches the complete relation and own dose to this immutable publication and requires all confirmations. Selected target segment completion uses the target's range minimum, mode and per-side requirements. A switch retains earlier segments/actuals; switching back selects an existing unchanged segment. New relation availability and current equipment selection policy must be composed with WP04's alternatives endpoint; this module validates frozen prescription/confirmation, not live catalog enrichment.

For a legacy routine, write the separate immutable `b2b_routine_supplement` with its full RoutineVersionV2 snapshot. This consumer expects `source_snapshot_hash = SHA256(canonicalJson(original stored snapshot JSON))`, using the domain sessions canonicalizer (sorted object keys, arrays/scalars retained). It rejects a mismatched hash. Confirm this exact convention with CONTRACT/WP04 before integration.

Without a supplement, source-only legacy corrections use the explicitly identified legacy fixed-dose compatibility semantics; original v1 bytes and manual allowlists stay untouched and are never relabelled reviewed. Old unreviewed substitution actuals remain losslessly available in revision zero; a new selected target correction needs an explicitly supplied target-dose supplement. This case is an integration/interface dependency, not evidence that unsupported legacy target prescriptions were accepted. No target dose is invented.

## Parent / Astra and QA

Astra's contract-sensitive review is still required. Final new-route authorization and WP02 preview/apply tests must run on the composed WP01/WP02/WP04 head. No new Cloud dispatch was performed.

WP12 browser scenarios (QA owns implementation): 320/430/1440 Chromium/WebKit; Monday/Sunday/DST and enrollment timezone vs changed device timezone; two prescribed slots on one day; move a partial occurrence across a midweek stage edge within its week; reject an outside-week/completed move; four required/three complete/one partial yields one missed after close; offline late completion revises the closed week once; exact replay after a successor returns the old receipt; two-device CAS conflict retains local work; source-to-target duration/per-side switch and restore preserve all actuals; period preview lists linked logs and accepted overrides and becomes stale after any intervening mutation; period move preserves original routine/session navigation and never creates two absences; void/completed-to-partial correction; inactive/revoked replay denied; reactivation restores retained history. New v2 HTTP/browser and full build acceptance remain deferred to composition, not passed here.
