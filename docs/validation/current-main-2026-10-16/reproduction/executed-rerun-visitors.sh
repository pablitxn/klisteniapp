#!/usr/bin/env bash
set -u
cd /workspace/klisteniapp
source /workspace/qa-20261016/environment.sh
while ! test -f /workspace/qa-20261016/exit-codes.txt || ! rg -q '^b2b-brand-admin ' /workspace/qa-20261016/exit-codes.txt; do sleep 5; done
for mode in demo instance; do
  instance=0
  if [ "$mode" = instance ]; then instance=1; fi
  QA_RUN_OUTPUT="/workspace/qa-20261016/visitor-$mode-webkit-fixed" VISITOR_INSTANCE="$instance" pnpm --filter @klisteniapp/b2c-web exec playwright test --config=/workspace/qa-20261016/visitor.config.ts --project=webkit-narrow --project=webkit-mobile --project=webkit-desktop > "/workspace/qa-20261016/visitor-$mode-webkit-fixed.log" 2>&1
  echo "visitor-$mode-webkit-fixed $?" >> /workspace/qa-20261016/exit-codes.txt
done
