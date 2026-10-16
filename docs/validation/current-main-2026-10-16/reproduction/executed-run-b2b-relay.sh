#!/usr/bin/env bash
set -u
cd /workspace/klisteniapp
source /workspace/qa-20261016/environment-b2b.sh
for role in member trainer anonymous brand-admin; do
  QA_RUN_OUTPUT="/workspace/qa-20261016/b2b-$role-relay" QA_INTEGRATION_ROLE="$role" pnpm --filter @klisteniapp/b2c-web exec playwright test --config=/workspace/qa-20261016/integration-http.config.ts > "/workspace/qa-20261016/b2b-$role-relay.log" 2>&1
  echo "b2b-$role-relay $?" >> /workspace/qa-20261016/exit-codes.txt
done
