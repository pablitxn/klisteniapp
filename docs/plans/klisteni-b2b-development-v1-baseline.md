# Local baseline verification — 2026-10-17

Application `d65261d18de4522fb9a66104aabb5750104fb8b8` on `docs/b2b-development-plan-v1`; Atlas `ce45d206a2ed4035f8003a3303abd1fff98e09b8`. Git tracked tree clean before/after checks; no implementation, lockfile, branch, credential or trust changes. Local synthetic PostgreSQL17.11 only.

PASS: **602/602 tests, 0 failed, 0 skipped**, 14 uncached workspace tasks plus26 root tests. B2B API82, B2C API97. PASS:14 uncached typecheck tasks,14 uncached lint tasks, boundaries/format,16 uncached build tasks. Existing >500kB chunk warnings.

**FAIL (pre-existing):** `pnpm previews:check`: exercise74 and body24 pass; Yoga extraction receipt assertion fails. Receipt/input changes include lockfile/generate-yoga-previews/preview-browser/preview-capture-state, as documented in prior gaps.json; not repaired.

**BLOCKED (no browser cases executed):** Chromium system browser fails SUID sandbox helper configuration; local app-locked WebKit2359 fails missing libharfbuzz-icu.so.0. Cached Docker image contains Chromium1234/WebKit2336 (Playwright1.62), not app1.63 runtimes1243/2359. No TLS/sandbox relaxation or substitute-runtime full-suite claim. Prior1218 local browser results remain historical, not rerun passes. B2B mobile/desktop/white-label browser acceptance remains pending.

**Tooling distinction:** PATH initially exposed pnpm11.25 despite required12.7. `pnpm exec` initially attempted automatic dependency verification/install and failed to create home data directory; no dependency/source changes. All primary checks then used `/tmp/klisteni-baseline-20261017/bin/pnpm`, exporting `pnpm_config_verify_deps_before_run=false` and delegating to `/opt/codex/runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm` (11.25). Exact Node and locked dependencies were used. Later discovered existing startup `/workspace/.onboarding/activate.sh` supplies pnpm12.7 at `/workspace/.onboarding/tools/node_modules/.bin/pnpm`; executed five shared B2B package suites with that exact binary:50/50 pass, no failures/skips. Primary602/lint/types/build receipt is explicitly pnpm11.25; not represented as12.7.

The harness `run.py` captures command/start/duration/exit and supplies a sanitized environment with only PATH/HOME/LANG/TMPDIR plus local synthetic database URLs, CI/telemetry settings, `VITE_APP_MODE=instance` and example public profile. No dependency installation, real providers, production, private environment or TLS modifications. `browser-probe.json` process exit0 means both probes completed; individual browser outcomes in its log are FAIL.

| Command (prefixed by `python3 /tmp/klisteni-baseline-20261017/run.py <name>`) | Exit | Seconds |
| --- | ---: | ---: |
| `pnpm test --force --concurrency=2` | 0 | 170.529 |
| `pnpm exec turbo run typecheck --force --concurrency=2` | 0 | 77.702 |
| `pnpm lint --force --concurrency=2` | 0 | 31.27 |
| `pnpm exec turbo run lint --force --concurrency=2` | 0 | 57.444 |
| `pnpm exec turbo run build --force --concurrency=1` | 0 | 114.925 |
| `pnpm previews:check` | 1 | 7.596 |
| `/workspace/.onboarding/tools/node_modules/.bin/pnpm --filter @klisteniapp/b2b-contracts --filter @klisteniapp/b2b-domain --filter @klisteniapp/b2b-client --filter @klisteniapp/b2b-react --filter @klisteniapp/b2b-ui test` | 0 | 2.6 |
| `node /tmp/klisteni-baseline-20261017/browser-probe.cjs` | 0 | 2.011 |

`pnpm lint --force --concurrency=2` forwards those extra arguments to Prettier, which ignored them; its workspace lint had8 cache hits. The separately recorded `pnpm exec turbo run lint --force --concurrency=2` passed14 uncached tasks. Boundary/format check was executed in the root lint wrapper.

Expected regression commands after planned implementation (source existing activation first; dedicated local disposable DB URLs required):

```sh
source /workspace/.onboarding/activate.sh
pnpm check:b2b:boundaries
pnpm format:b2b:check
pnpm exec turbo run lint typecheck --force --concurrency=2
TEST_DATABASE_URL=<local-b2c-test-db> B2B_TEST_DATABASE_URL=<local-b2b-test-db> pnpm test --force --concurrency=2
VITE_APP_MODE=instance KLISTENI_PUBLIC_PROFILE_FILE=instance-profile.example.json pnpm exec turbo run build --force --concurrency=1
pnpm previews:check
# After compatible sandboxed browsers are available:
B2B_TEST_DATABASE_URL=<local-b2b-test-db> pnpm test:b2b:e2e
```

Inspect configs before white-label/release wrappers. The checked white-label config includes an SPKI exception; no white-label TLS helper/runner was executed. Keep valid-trust HTTPS/Secure cookies, physical QR/voice/devices, real email/payments/providers, GPU/model/Blender/content acceptance and prior archive/CI gaps separate. `check`, `check:all`, `check:release` were not run to completion; no release-green claim. No new archive/CI/provider claim.

Instructions read: application AGENTS, Atlas AGENTS/root AGENTS, actual local atlas-navigate skill and source-of-truth policy; relevant wiki/current-main2026-10-16 receipt/checks/gaps; discovered current onboarding browser startup/report. Task container cleaned up after tests; existing persistent development containers/volumes remain unchanged.


## Evidence custody

The committed [structured summary](klisteni-b2b-development-v1-baseline.json) records commands, revisions, counts and limits. Raw task logs were frozen in `/tmp/klisteni-baseline-20261017.tar.gz`, SHA-256 `b26bbcc0f2db8c9580b23885b4e3e9e3f197b9312d01be358ad314ebb7a7ffb3`. This path is local and ephemeral; remote archival/retrieval is not claimed. The plan PR versions the sanitized report/summary rather than raw runtime logs. Existing October 16 evidence and archive gates remain unchanged.
