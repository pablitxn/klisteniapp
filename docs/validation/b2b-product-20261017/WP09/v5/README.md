# WP09 durable owner recovery checkpoint, v5

Feature source: `3a1d53ff79107c73fea1232f8fb275b911c18409` on frozen base
`0b611064a91b87b3a17274cabca5415bcf1d7d55`. Validation composition:
`591feb1fd6a29306b5dc08a70ae5335a0ce01422` plus the owned feature files
at that source and the exact validation-only dependency registration requested
in v4. No dependency, root, API, contract or QA-browser file is committed here.
Atlas context remains `ce45d206a2ed4035f8003a3303abd1fff98e09b8`.
This checkpoint supplements immutable v1-v4; it does not relabel their results.

## Implemented and tested

- IndexedDB upgrade 2 to 3 retains every existing workout and legacy backup.
  Owner selection is an atomic pointer to a verified actual document; the pointer
  is scoped by native origin, authenticated account, organization and real
  bootstrap realm mode/key, and can recover a prior branch after inactive,
  branchless reload. Missing/tampered pointers fail visibly without rewriting.
- New realm-bound workout keys coexist with unchanged old keys and unchanged
  server/session/operation identities. Explicit one-time old-key adoption copies
  original bytes/operations, retains the original and atomically claims its realm.
  Cross-tab pointer CAS and cross-realm adoption each have one winner.
- Explicit legacy resume/new UI inspects actual stored rows and the issued
  assignment, never writes or sends merely by opening. New work gets one durable
  ID with no actuals, operations or completion; existing pending bytes survive.
  Blocked v1 retries remain preserved/exportable, never translated or replayed.
- Account/realm/context cancellation hides departed state and aborts selection
  writes. Retired grants/assignments block new work; owner recovery/export survives.
  No health storage, service worker or new offline cold-start claim is introduced.

## Validation

Node 24.19.0, pnpm 12.7.0, frozen dependencies. On the composition above:
web unit tests **203 passed, zero failed/skipped**; all 14 root typecheck tasks,
all 14 lint tasks/formatting, boundaries and B2B build passed. See raw logs and
`results.json`. The API run first failed the intentional test-database name
assertion (`b2b_wp09_test`); `api.log` records that failure. The rerun uses a
new disposable synthetic PostgreSQL 17.11 database named `klisteni_b2b_test` on
task-local port 55439: **232 passed, zero failed/skipped**. See `api-rerun.log`. No real data,
providers, shared environments or credentials were used.

Native Playwright 1.63.0 / Chromium 153.0.8010.12, sandbox enabled, passed real
IndexedDB upgrade/reload/offline export, scoped visibility, actual competing
connections, cancelled queued transaction, pointer tamper/missing-document and
explicit mobile chooser/hook checks at native insecure `http://wp09-recovery.test`.
`native-browser.log`, `probe.tsx`, `run.mjs`, build and network logs retain the
proof and fixture inputs. The cached 1.62 OS image supplies libraries only;
1.63 driver and matching browser were mounted read-only. No browser crypto or
security properties, TLS trust, sandbox or auth behavior were shimmed. No
application requests were issued (zero), so this is owned storage/UI evidence,
not composed real authentication or whole-application acceptance. Initial
fictitious-host proxy failure was corrected only with exact-host resolution and
bypass; `network.log` retains it.

## Integration requests and remaining acceptance

`root-recovery-binding.patch` is an exact minimal pointer/realm/durable-callback
patch against candidate 591feb1, verified with `git apply --check`, **not applied**.
It replaces memory-only export selection and includes branchless inactive
recovery, while preserving the existing session authority. The root must thread
its actual bootstrap-derived recovery context; never synthesize a realm from a
branch. Error output is visible. The editor callback runs only after a durable
row exists and must be awaited. The patch intentionally is not the complete
legacy navigation: the root must retain its actual `legacyAssignments` DTO,
render owned `LegacyWorkoutEntryChoice` before new/resume, and route its selected
real document through the frozen session binding. Existing old unbound documents
use `findUnboundWorkout` and `UnboundWorkoutRecoveryChoice`; never auto-adopt or
create a new legacy ID on every open. UI tests must verify inactive direct reload
from the full application, not just in-memory navigation.

Amendment 007 at `efbed2dd1c7ed06092463a3eec4531c2a3e10075` arrived during this
checkpoint. Its first-correction/accepted-resume binding implementation continues
in a subsequent version. Do not treat the candidate's global supplement lookup
as safe retained-prescription resume. Root binding, amendment007 legacy correction,
WP06 composed authorization, QA-owned full browser acceptance and hosted CI
remain integration gates. Default feature replay remains disabled unless parent
explicitly enables the accepted integrated path. No deployment or main merge.

Raw logs preserve tool formatting and can trigger full-diff trailing-whitespace
checks; source-only whitespace checks pass. Prior frozen logs are not rewritten.
