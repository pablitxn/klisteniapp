#!/usr/bin/env bash
set -euo pipefail
docker run --rm --pull=never --network none --init --user pwuser \
 --security-opt no-new-privileges \
 --security-opt seccomp=/workspace/.onboarding/browser-support/seccomp_profile.json \
 --shm-size=1g \
 --mount type=bind,src=/tmp/b2b-route-browser-setup,dst=/runtime,readonly \
 --mount type=bind,src=/tmp/b2b-route-proof-v9,dst=/harness,readonly \
 -e NO_PROXY=route-proof.test,127.0.0.1,localhost \
 -e no_proxy=route-proof.test,127.0.0.1,localhost \
 -e PLAYWRIGHT_BROWSERS_PATH=/runtime/browsers \
 klisteni-browser:1.62.0 node /harness/run.mjs
