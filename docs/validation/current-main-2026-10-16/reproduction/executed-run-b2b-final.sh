#!/usr/bin/env bash
set -u
cd /workspace/klisteniapp
source /workspace/qa-20261016/environment-b2b.sh
while [ ! -f /workspace/qa-20261016/b2b-member-download-fix/report.json ]; do sleep 2; done
python3 - <<'PY'
import json
p=json.load(open('/workspace/qa-20261016/b2b-member-download-fix/report.json'))
assert p['stats']['expected']==2 and p['stats']['unexpected']==0 and p['stats']['skipped']==0
PY
if [ $? -ne 0 ]; then exit 1; fi
python3 /workspace/qa-20261016/record-run.py b2b-brand-admin-download-fix
QA_RUN_OUTPUT=/workspace/qa-20261016/b2b-brand-admin-download-fix QA_INTEGRATION_ROLE=brand-admin pnpm --filter @klisteniapp/b2c-web exec playwright test --config=/workspace/qa-20261016/integration-http.config.ts --project=brand-admin-chromium-narrow --project=brand-admin-webkit-narrow --grep='administrator filters a persisted partial' > /workspace/qa-20261016/b2b-brand-admin-download-fix.log 2>&1
result=$?
echo "b2b-brand-admin-download-fix $result" >> /workspace/qa-20261016/exit-codes.txt
if [ "$result" -ne 0 ]; then exit "$result"; fi
for role in member trainer anonymous brand-admin; do
  python3 /workspace/qa-20261016/record-run.py "b2b-$role-final"
  QA_RUN_OUTPUT="/workspace/qa-20261016/b2b-$role-final" QA_INTEGRATION_ROLE="$role" pnpm --filter @klisteniapp/b2c-web exec playwright test --config=/workspace/qa-20261016/integration-http.config.ts > "/workspace/qa-20261016/b2b-$role-final.log" 2>&1
  echo "b2b-$role-final $?" >> /workspace/qa-20261016/exit-codes.txt
done
