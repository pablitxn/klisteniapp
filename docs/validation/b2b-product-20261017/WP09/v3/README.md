# WP09 production-read checkpoint amendment v3

Date: 2026-10-17. Parent supplied integrated dependency checkpoint
`4954accaf0e4a0c88f8179b949886b1fcece8fa7` and requested exact production read
interfaces. Read amendment 003 and its endpoint/client implementation at that
immutable SHA. Frozen branch base remains `0b611064a91b87b3a17274cabca5415bcf1d7d55`.
WP09 source head for this amendment: `20872798bf9b567c4e4792dc640915079c49d0b5`.
The published PR also includes its subsequent evidence-only commit.

## Exact reader/transport handoff

New app-local `features/training/sync/workoutClient.ts` exports:

```ts
const io = createWorkoutClient(signal => createProductV2Client(accountId, organizationId, {
  branchId,
  role: 'member',
  contextSignal: currentAccountContextSignal,
  signal,
  onAuthChange: refreshCurrentAccess,
}))
const stored = await io.routineVersion(issuedReference, currentAccountContextSignal)
const latest = await io.latestRevision(sessionId, currentAccountContextSignal)
// ProductTrainingSession consumes io.transport and:
// loadRemote: () => io.latestRevision(sessionId, currentAccountContextSignal)
```

`createProductV2Client` and `ProductV2Client` come from the actual registered
`@klisteniapp/b2b-client` root export. No new package subpath or shared registration
is requested. `routineVersion` calls exactly
`call('routineVersion', { id: reference.programId, version: reference.version })`.
It checks the returned stored discriminator/program/version and returns the
strict stored union unchanged. Members execute their issued immutable version;
`catalogExercises` and `routinePublications` are planning-choice reads and cannot
replace it. A legacy result remains schema 1. Use the existing explicit legacy
projection only when needed; unset dose/load/laterality must not become invented
assignable values or reviewed provenance. Continue exact legacy pending POST
transport and explicit legacy correction/supplement handling described in v1.

`latestRevision` calls exactly `sessionRevisions({ id })`, verifies every returned
v2 ID or legacy original execution ID, and selects the highest strict v2 actual
revision. A revision-zero-only response requires explicit legacy correction
projection; it is never fabricated as an accepted v2 revision. Both readers check
context cancellation before and after requests. `io.transport` binds the existing
`access` and `saveSession` operations using each runner signal. The integrator
still owns authenticated host/account/branch/context binding and workspace routes.
No injected replacement endpoint/DTO, mutable-draft fallback or auth bypass exists.

The WP11 adapter and signature remain exactly as [v2](../v2/README.md):
`exportOwnerLocalWorkout(store, { scope, access, signal }, sessionId)`.
Server exports never include this local-only envelope. No WP11 files were edited.

## Actual new validation

Created isolated `/workspace/wp09-checkpoint4954` from exact checkpoint 4954acc;
copied only the owned UI/test files byte-for-byte, then used Node 24.19.0,
pnpm 12.7.0 and `install --frozen-lockfile --ignore-scripts`. No dependency source,
manifest or export patch was needed in this new composition. The feature branch
still contains only owned UI/tests/evidence. [source-files.json](source-files.json)
identifies all 23 owned implementation/test files and their matching hashes.

- **93 composed UI tests passed, zero failures/skips**. This includes the previous
  82 WP09/base cases, six pinned alternative-presentation cases and five new actual
  client-interface checks: immutable route and context headers, discriminator/
  cancellation rejection, latest actual revision, access/save binding and untouched
  legacy stored routine.
- **2 targeted PostgreSQL production-read API tests passed, zero failures/skips**:
  actual v1/v2 publication discriminators/current scope and exact issued member
  immutable-read authority with foreign-scope denial.
- All **14 root typecheck tasks pass**. This supersedes v1's missing-WP02 check
  blocker for checkpoint 4954acc; it does not make the frozen standalone branch
  resolve dependency exports before integration.
- Web typecheck, boundaries, root lint/format and B2B build pass; see logs/results.

The earlier v1 full API 109/direct service 7/native matching Chromium evidence and
v2 82-test evidence remain frozen at their declared compositions. They are not
silently retested or added to the new two-API-test total. No new composed browser
acceptance is claimed. Test-only shared/API source was not changed. During
iteration an unregistered client subpath was corrected to its registered root
export before these passing checks.

## Remaining gates

The parent's retired-assignment API correction is pending with its owner and
requires no DTO change. Do not bypass a denied immutable read or retry a mutable
routine lookup. Actual WP06 binding/authorization acceptance, current alternative
eligibility amendments, Astra protocol review and QA's composed Chromium/WebKit/
viewport/brand/HTTPS matrix remain parent/integrator/producer/QA work. Default
`integrationAccepted` stays false. No product activation, main merge, provider,
real data, credential/security change or production deployment occurred.
V1/v2 evidence bytes remain unchanged. Later corrections use a new receipt.
