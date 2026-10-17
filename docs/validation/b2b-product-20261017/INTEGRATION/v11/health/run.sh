#!/usr/bin/env bash
set -euo pipefail
engine="${1:-chromium}"
cache="browsers"
if [[ "$engine" == "webkit" ]]; then cache="webkit-ubuntu24-cache"; fi
docker run --rm --pull=never --network bridge --init --user pwuser \
 --security-opt no-new-privileges \
 --security-opt seccomp=/workspace/.onboarding/browser-support/seccomp_profile.json \
 --shm-size=1g \
 --mount type=bind,src=/tmp/b2b-route-browser-setup,dst=/runtime,readonly \
 --mount type=bind,src=/tmp/b2b-health-readiness-v11,dst=/harness,readonly \
 -e NO_PROXY=127.0.0.1,localhost -e no_proxy=127.0.0.1,localhost \
 -e PLAYWRIGHT_BROWSERS_PATH="/runtime/$cache" \
 klisteni-browser:1.62.0 node /harness/run.mjs "$engine"
