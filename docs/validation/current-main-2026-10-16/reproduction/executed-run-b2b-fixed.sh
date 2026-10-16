#!/usr/bin/env bash
set -u
cd /workspace/klisteniapp
source /workspace/qa-20261016/environment.sh
while ! rg -q '^visitor-instance-webkit-fixed ' /workspace/qa-20261016/exit-codes.txt; do sleep 5; done
QA_RUN_OUTPUT=/workspace/qa-20261016/visitor-demo-webkit-final VISITOR_INSTANCE=0 pnpm --filter @klisteniapp/b2c-web exec playwright test --config=/workspace/qa-20261016/visitor.config.ts --project=webkit-narrow --project=webkit-mobile --project=webkit-desktop > /workspace/qa-20261016/visitor-demo-webkit-final.log 2>&1
echo "visitor-demo-webkit-final $?" >> /workspace/qa-20261016/exit-codes.txt
for role in member trainer anonymous brand-admin; do
  QA_RUN_OUTPUT="/workspace/qa-20261016/b2b-$role-fixed" QA_INTEGRATION_ROLE="$role" pnpm --filter @klisteniapp/b2c-web exec playwright test --config=/workspace/qa-20261016/integration-http.config.ts > "/workspace/qa-20261016/b2b-$role-fixed.log" 2>&1
  echo "b2b-$role-fixed $?" >> /workspace/qa-20261016/exit-codes.txt
done
