# WP12 v7: early failures during continuing R16

R16 is still running; this is a selected failure checkpoint, not its completed
result or an accepted matrix. It remains on application
`00b9f855746a7dd8c8ddfc97991e3a2163fa5ac8`, QA
`127440fa30ca7b0e54048a2ce2003a04edd7725d`, actual unified Chromium320.
The parent explicitly instructed continuation without restarting/discarding this
run while a later Close amendment is composed. No application fix is made here.

## WP09/root: incomplete completion feedback is cleared

ALTERNATIVES-009 creates a real prescribed workout with a published reviewed
per-side target, records source actual work, selects the target and records only
its left-side rows. Clicking actual `Completar sesión explícitamente` keeps
server status partial but shows no alert. The original alert assertion fails;
it has not been removed. The snapshot still has empty right-side inputs and
`Sincronizado. Guardar no completa la sesión.`

Static evidence in `useProductTrainingSession.ts`: `serialize` catches a queued
exception and resolves after `setError`. `save` unconditionally invokes
`synchronize` afterward. `prepareWorkoutContent` throws for missing target
coverage, but synchronization of the unchanged valid partial content clears the
error. This is a code-supported explanation for lost completion feedback, not a
new browser pass. It also warrants checking invalid void/correction saves.

Requested owner action: preserve the validation failure and stop that save before
synchronizing unchanged content. Do not weaken minimum/per-side completion,
misrepresent partial work as completed, or bypass durability/authorization.
Retain the browser assertion and rerun on the exact composed fix head. The pending
ordinary-Close patch explicitly retains the general queue's catch behavior; its
native component results do not independently resolve this browser failure.

## Root/health: reconnect revalidation still cannot display allowed data

HEALTH-005 imports/grants through the owner UI; the actual trainer displays
measurements. Native offline hides them, and persistent-store checks find no
health marker. After native online, actual `Volver a validar consentimiento`,
then `Validar y mostrar datos`, the page shows a generic error instead of the
measurements. The original final visibility assertion fails at line238.

The actual trainer snapshot says `No se pudo completar la operación. Actualizá el
estado antes de continuar.` Its trace has successful event subscriptions and two
successful health responses before offline; no new health request reaches the
network after the explicit reconnect controls. These are not event429s and do not
reopen the previous gateway leak. See the exact encoded error context and
[network projection](health-reconnect-network.json). Data stays hidden, so this
is a revalidation/availability failure, not evidence of a privacy leak.

Root should inspect the shared health gate's renewed lifetime versus the outer
root request guard and readiness. `TrainerHealthGate` uses its own stream.ready
while `healthClient` obtains `context.requestSignal` from the outer root guard.
A local guard/abort failure is a plausible cause; that last statement is an
inference requiring owner reproduction. Preserve current authority checks and
hide-on-offline/revoke behavior; do not solve it by bypassing the guard or adding
unbounded retries. Minimal reproduction is the real HEALTH-005 scenario at this
head with its normal synthetic fixtures and source-bound UI actions.

## Missing actual reviewed time-target variant

ALTERNATIVES-011 fails before browser target selection because the actual
publication helper cannot find a canonical reviewed duration target with no
equipment. `apps/b2b-api/src/catalog/reviewed-projection.ts` currently hardcodes
`targetDose.mode: 'repetitions'` and `durationSeconds: null`. No real duration
target can be selected by this helper on this candidate.

The pinned work-packages WP09 exact browser scope includes a target
reps-to-time/per-side/count switch. ALTERNATIVES-008 currently exercises the
opposite timed-source-to-repetition-target boundary, and that action passed;
it does not prove a reviewed repetitions-to-duration direction. ALTERNATIVES-011
also asks for generic selected target unit/rest/sets/laterality behavior, which
can independently use an existing real reviewed target. Do not erase the
specific missing direction or invent a reviewed relationship/dose in QA.

CONTRACT/ALTERNATIVES/root should resolve the exact accepted reviewed-duration
fixture/interface/provenance needed for the directional plan obligation, or
explicitly reconcile the scope. The 37-exercise/42-link historical evidence and
no-inherited-review guard remain unchanged. This is a fixture/acceptance gap,
not a claim that a nonexistent target's UI malfunctioned.

## Evidence and next steps

[Failure snapshot](failure-snapshot.json) pins the source, original error-context
hashes and retained task-local trace hashes. Full trace transport/session bytes
stay task-local; encoded error contexts provide durable synthetic evidence.
Prior v1-v6 are immutable. Current run resources remain active, quotas unchanged,
and ordinary auth idle-window pacing is separate from these failures. No final
R16 totals are claimed here. HTTPS remains separately unavailable.

After parent publishes the composed Close fix, add actual-route delayed edit/
Close, durable selection, visible storage failure/retry/export, and immediate
revocation cancellation coverage. Preserve current results by source. Parent
retains ownership of application/shared files and orchestration.
