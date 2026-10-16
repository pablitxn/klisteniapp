#!/usr/bin/env bash
set -u
cd /workspace/klisteniapp
source /workspace/qa-20261016/environment.sh
while [ ! -f /workspace/qa-20261016/visitor-demo/report.json ]; do sleep 5; done
run_suite() {
  local label="$1" config="$2"
  shift 2
  QA_RUN_OUTPUT="/workspace/qa-20261016/$label" pnpm --filter @klisteniapp/b2c-web exec playwright test --config="/workspace/qa-20261016/$config.config.ts" "$@" > "/workspace/qa-20261016/$label.log" 2>&1
  local result=$?
  echo "$label $result" >> /workspace/qa-20261016/exit-codes.txt
}
VISITOR_INSTANCE=1 run_suite visitor-instance visitor
for profile in chromium-narrow chromium-wide chromium-desktop webkit-narrow webkit-wide webkit-desktop; do
  run_suite "selfservice-$profile" b2c-qa --project="$profile"
  run_suite "extras-$profile" b2c-qa-extra --project="$profile"
done
run_suite b2c-admin admin
for role in member trainer anonymous brand-admin; do
  QA_INTEGRATION_ROLE="$role" run_suite "b2b-$role" integration-http
done
