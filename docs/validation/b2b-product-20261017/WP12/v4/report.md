# WP12 v4 execution and recovery checkpoint

Date: 2026-10-17. Status: **real diagnostics completed; final acceptance blocked**.
Executor reads succeeded after the platform disconnect report. All bounded
operations finished; no browser run remains active. Parent retains orchestration,
application fixes, final head acceptance and merge authority.

| Input | Revision |
| --- | --- |
| Plan | `447d77ebb5587e319018e7b56003f0ef7299bb6c` |
| Original app base | `d65261d18de4522fb9a66104aabb5750104fb8b8` |
| Atlas | `ce45d206a2ed4035f8003a3303abd1fff98e09b8` |
| New application candidate | `591feb1fd6a29306b5dc08a70ae5335a0ce01422` |
| QA source | `896ae6be0c51819af0de6c2202b6e5555d493449` |

All88 reserved IDs now have source, including the36 missing after v3. The
[source map](scenario-source-map.json) preserves every package/assertion link.
[Coverage qualifications](coverage.md) distinguish source from execution and
remaining variants. Only nine distinct IDs have executed across these diagnostics;
eight have executed on candidate591feb1. The full88×6 matrix is not accepted.

## Completed results on candidate591feb1

Failures include timeouts; each run is separate, with no cross-head aggregation.

| Run | QA source | Actual scope | Passed | Failed | Skipped |
| --- | --- | --- | ---: | ---: | ---: |
| R6 | `1ad4038` | Seven IDs, Chromium/WebKit320 | 8 | 6 | 0 |
| R7 | `88cb270` | Remote revoke, reactivation, open/closed4/3/1; both engines320 | 6 | 0 | 0 |
| R9 | `896ae6b` | Health import, inactive admission, range publication, weekly accounting; all six projects | 23 | 1 | 0 |
| R10 | `896ae6b` | Chromium1440 editor retained >91seconds, then actual trainer conflict | 1 | 0 | 0 |

R9's sole failure is Chromium320 white-label history/calendar overflow: requested
320px, measured inner/document/body width343px. Other five projects passed that
scenario. [Measured attachment](chromium-320-viewport.json) and
[screenshot](screenshots/white-label-chromium-320-history.png) are retained.

R6 also exposed correction-reason entry loss in both engines. The textarea
returns to empty after a completed session, even after waiting for synchronized
UI state. This remains an application bug. HTTP workout WebCrypto is separately
assigned to WP09; the exact older-head trace is preserved and no secure-context
shim was added. [Concrete owner requests](owner-requests.md) identify sources,
known People/history/recovery/adoption work and missing local-adaptation fixtures.

The other R6 failures were two real login429s and two consent-response wait
assumptions. QA now paces real password admission without changing the10/minute
guard and verifies actual submitted health bytes, authoritative committed state
and refreshed UI after self-notification cancels a guarded response. R7/R9
exercise those changes. R8 was stopped deliberately after diagnosing the import
wait:5 passed,2 failed,1 interrupted,16 not run. No unrun cell was counted passed.

## Evidence, checks and preservation

[Run ledger](runs.json) contains per-cell outcomes, exact source qualification,
older04ac103 attempts and raw report/log hashes. Raw JSON is in `raw/`; byte-exact
logs use `.log.b64` (`base64 -d` to inspect). Older attempts are diagnostics,
not reruns on the new candidate. Initial R1/R2 traces were not retained across
the early container recreation; their JSON/logs remain. R3 traces and final
R4–R10 artifacts are retained under `/workspace/wp12-runtime-v4/evidence/`.
Trace archives remain task-local rather than being committed with synthetic
authentication tokens.

[Checks](checks.json): scoped TypeScript/ESLint, boundaries and whitespace passed;
collector6/6 passed. Each of the three configs discovers all528 cells; discovery
is not execution or HTTPS acceptance. The strict runner/inventory are unchanged
and still reject failed, missing, skipped or unavailable cells. R9 alone leaves
504 of528 required white-label cells undiscovered by its filtered execution.

[Production byte proof](application-source-proof.json) verifies787 expected
tracked files against591feb1, with no missing/mismatched file. Only QA-owned
specs/fixtures and additive v4 evidence differ from that parent candidate.
v1–v3 evidence, shared configs/seeds/contracts/manifests/lockfile are unchanged.
The actual frontend build passed with its existing chunk-size warning.

The official1.63 runtime used Chromium153.0.8010.12 and WebKit26.6, nonroot with
sandbox/trust policy intact. Native connectivity was true/false/true through
real offline/reconnect toggles in both engines. Temporary task containers,
PostgreSQL tmpfs and both task networks were removed after zero remaining fixture
schemas were confirmed. No persistent security/network change remains. Git push
recovered through the existing environment activation without credential changes.
See [reproduction](reproduction.md).

Valid-trust HTTPS inputs are absent. Full remaining browser execution, qualified
variants, application fixes and parent-accepted combined-head review remain.
No application unit/API totals were rerun or substituted for browser results;
Yoga/provenance, physical/release/provider/production gates retain their status.
No main merge, deployment or production/real-user operation occurred.
