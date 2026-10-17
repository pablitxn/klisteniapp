#!/usr/bin/env bash
set -euo pipefail
runtime_root=${1:?Pass the task-owned runtime directory}
engine=${2:?chromium or webkit}
case "$engine" in chromium|webkit) ;; *) exit 2;; esac
runtime_root=$(realpath "$runtime_root")
case "$runtime_root" in /workspace/wp12-runtime-*|/tmp/wp12-runtime-*) ;; *) echo 'Use a task-owned runtime directory' >&2; exit 2;; esac
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
image='mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27'
test -f "$runtime_root/node_modules/@playwright/test/package.json"
test "$(sha256sum "$runtime_root/seccomp_profile.json" | cut -d ' ' -f 1)" = 'cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849'
cp "$script_dir/transport-probe.mjs" "$runtime_root/transport-probe.mjs"
chmod a+rx "$runtime_root"
chmod a+r "$runtime_root/transport-probe.mjs" "$runtime_root/seccomp_profile.json"
chmod -R a+rX "$runtime_root/node_modules"
export DOCKER_HOST=unix:///var/run/docker.sock
unset DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
docker image inspect "$image" >/dev/null
container_name="wp12-runtime-${engine}-$$"
cleanup() { docker rm -f "$container_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
docker run --rm --pull=never --name "$container_name" --init --network none \
  --user pwuser --security-opt no-new-privileges \
  --security-opt "seccomp=$runtime_root/seccomp_profile.json" --shm-size=1g \
  --mount "type=bind,src=$runtime_root,dst=/harness,readonly" \
  "$image" node /harness/transport-probe.mjs "$engine"
