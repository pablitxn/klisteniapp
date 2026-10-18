#!/usr/bin/env bash
set -euo pipefail
docker run --rm --pull=never --name b2b-v13-runtime-smoke --network none --init --user pwuser \
 --security-opt no-new-privileges \
 --security-opt seccomp=/workspace/.onboarding/browser-support/seccomp_profile.json \
 --shm-size=1g \
 --mount type=bind,src=/tmp/b2b-integration-v13/browser-runtime,dst=/runtime,readonly \
 -e PLAYWRIGHT_BROWSERS_PATH=/runtime/browsers \
 -e NO_PROXY=127.0.0.1,localhost -e no_proxy=127.0.0.1,localhost \
 klisteni-browser:1.62.0 node /runtime/runtime-smoke.mjs
