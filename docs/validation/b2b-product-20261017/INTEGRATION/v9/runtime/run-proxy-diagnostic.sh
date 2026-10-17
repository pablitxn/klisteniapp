#!/usr/bin/env bash
set -euo pipefail
docker run --rm --pull=never --network none --init --user pwuser \
  --security-opt no-new-privileges \
  --security-opt seccomp=/workspace/.onboarding/browser-support/seccomp_profile.json \
  --shm-size=1g \
  --mount type=bind,src=/tmp/b2b-route-browser-setup,dst=/harness,readonly \
  -e PLAYWRIGHT_BROWSERS_PATH=/harness/browsers \
  -e NO_PROXY=route-proof.test,127.0.0.1,localhost \
  -e no_proxy=route-proof.test,127.0.0.1,localhost \
  klisteni-browser:1.62.0 node /harness/proxy-diagnostic.mjs
