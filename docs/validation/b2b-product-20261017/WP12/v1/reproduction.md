# Preparation check reproduction

From `/workspace/klisteniapp`, source `/workspace/.onboarding/activate.sh`.
These commands verify preparation and retained pure regressions; none executes
the 88 reserved product browser scenarios. Consult `checks.json` for actual
results and the distinction between tested code and final documentation head.

```sh
node apps/b2c-web/e2e/fixtures/b2b-product/validate-preparation.mjs
node --test apps/b2c-web/e2e/fixtures/b2b-product/report-validation.test.mjs
node --test apps/b2c-web/test/health-import.test.ts packages/scene-schema/tests/health.test.ts
node --check apps/b2c-web/e2e/fixtures/b2b-product/run-browser.mjs
pnpm --filter @klisteniapp/b2c-web typecheck
pnpm exec eslint apps/b2c-web/e2e/fixtures/b2b-product/*.ts apps/b2c-web/e2e/fixtures/b2b-product/*.mjs
pnpm check:b2b:boundaries
git diff --check
```

The exact additional synthetic health fixture assertions executed were:

```sh
node --input-type=module - <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEmptyHealthData } from '@klisteniapp/scene-schema';
import { previewHealthImport } from './apps/b2c-web/src/lib/health-import.ts';
const root = './apps/b2c-web/e2e/fixtures/b2b-product/health/';
const raw = readFileSync(root + 'synthetic-v1.json', 'utf8');
const now = new Date('2026-10-17T12:00:00Z');
const initial = createEmptyHealthData();
const preview = previewHealthImport(raw, initial, now);
assert.equal(preview.ok, true);
assert.deepEqual(preview.counts, {total:2, added:2, duplicates:0});
assert.deepEqual(initial, createEmptyHealthData());
const duplicate = previewHealthImport(raw, preview.health, now);
assert.equal(duplicate.ok, true);
assert.deepEqual(duplicate.counts, {total:2, added:0, duplicates:2});
const conflict = JSON.parse(raw);
conflict.records.measurements[0].weightKg = 74;
assert.equal(previewHealthImport(JSON.stringify(conflict), preview.health, now).ok, false);
assert.equal(previewHealthImport(readFileSync(root + 'unsupported.csv','utf8'), initial, now).ok, false);
assert.equal(previewHealthImport('PK\u0003\u0004synthetic-unsupported-zip', initial, now).ok, false);
console.log(JSON.stringify({check:'baseline-pure-health-fixture',passed:5,failed:0,b2bConsentTestsExecuted:0}));
JS
```

Browser smoke used the installed `local-smoke.py` sequentially for `chromium`
then `webkit`, targeting a task-owned Python loopback server on port 48712 with
only a static synthetic HTML page. It was stopped after execution. The helper's
current startup instructions govern reproduction, including cached image ID,
nonroot/sandbox policy and internal relay cleanup; do not substitute native
launch flags, bypass certificates or use it as the app's 1.63 matrix.

The Atlas commit CLI hardcodes its own root. To check app commit text with the
unchanged official function, the actual successful invocation was:

```sh
python3 - <<'PY'
import runpy
from pathlib import Path
module = runpy.run_path('/workspace/sysadmin-workspace/tools/check_engineering_content.py')
errors, count = module['commits'](Path('/workspace/klisteniapp'), 'd65261d18de4522fb9a66104aabb5750104fb8b8')
print({'check':'Atlas commits(root,base)', 'commits':count, 'errors':errors})
raise SystemExit(bool(errors))
PY
```

The Cloud identity guard and PR title/body check use the official Atlas helper
paths; PR check inputs live in task-local `/tmp/wp12-pr-title.txt` and
`/tmp/wp12-pr-body.md`, while the authoritative published metadata is on the
draft PR. Validate live metadata after any edit. No inherited global Git
identity, authentication or configuration was changed.
