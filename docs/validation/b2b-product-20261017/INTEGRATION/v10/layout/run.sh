#!/usr/bin/env bash
set -euo pipefail
layout_engine=${1:?chromium or webkit}
case "$layout_engine" in
 chromium) layout_cache=/runtime/browsers ;;
 webkit) layout_cache=/runtime/webkit-ubuntu24-cache ;;
 *) exit 2 ;;
esac
docker run --rm --pull=never --network none --init --user pwuser \
 --security-opt no-new-privileges \
 --security-opt seccomp=/workspace/.onboarding/browser-support/seccomp_profile.json \
 --shm-size=1g \
 --mount type=bind,src=/tmp/b2b-route-browser-setup,dst=/runtime,readonly \
 --mount type=bind,src=/tmp/b2b-resume-layout-v10,dst=/harness,readonly \
 --mount type=bind,src=/tmp/b2b-resume-layout-v10/results,dst=/results \
 -e NO_PROXY=route-proof.test,127.0.0.1,localhost \
 -e no_proxy=route-proof.test,127.0.0.1,localhost \
 -e PLAYWRIGHT_BROWSERS_PATH="$layout_cache" \
 klisteni-browser:1.62.0 node /harness/run.mjs "$layout_engine"
