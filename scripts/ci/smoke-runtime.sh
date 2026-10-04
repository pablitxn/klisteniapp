#!/bin/sh
set -eu
# Run inside the static image. No backend, analytics collector or external calls.
test "$(id -u)" -eq 1000
nginx -t
nginx -g 'daemon off;' &
nginx_pid=$!
trap 'kill "$nginx_pid" 2>/dev/null || true' EXIT INT TERM
i=0
until wget -q -O /tmp/klisteni-health http://127.0.0.1:8080/healthz; do
  i=$((i + 1)); test "$i" -lt 20; sleep 1
done
test "$(cat /tmp/klisteni-health)" = ok
wget -q -O /tmp/klisteni-index http://127.0.0.1:8080/
grep -q 'Klisteni' /tmp/klisteni-index
wget -q -O /tmp/klisteni-privacy http://127.0.0.1:8080/privacy
cmp /tmp/klisteni-index /tmp/klisteni-privacy
asset="$(sed -n 's/.*src="\([^"]*\/assets\/[^"]*\.js\)".*/\1/p' /tmp/klisteni-index | head -1)"
test -n "$asset"
wget -S -O /dev/null "http://127.0.0.1:8080$asset" 2>/tmp/klisteni-asset-headers
grep -q 'max-age=31536000, immutable' /tmp/klisteni-asset-headers
grep -q "script-src 'self'" /tmp/klisteni-asset-headers
reject() {
  expected="$1"; shift
  if wget -S -O /tmp/klisteni-rejected "$@" 2>/tmp/klisteni-rejected-headers; then
    echo 'Request unexpectedly accepted' >&2; exit 1
  fi
  grep -q "HTTP/1.1 $expected" /tmp/klisteni-rejected-headers
}
reject 404 http://127.0.0.1:8080/assets/missing.js
reject 404 http://127.0.0.1:8080/models/missing.glb
reject 404 http://127.0.0.1:8080/previews/missing.webp
reject 404 http://127.0.0.1:8080/umami/script.js
reject 404 --post-data='{}' http://127.0.0.1:8080/umami/api/send
# BusyBox wget hides headers after an HTTP error; curl keeps the error response.
curl --silent --show-error --max-time 5 --dump-header /tmp/klisteni-api-headers \
  --output /tmp/klisteni-api-body http://127.0.0.1:8080/api/healthz
grep -q 'HTTP/1.1 503' /tmp/klisteni-api-headers
grep -q 'Content-Type: application/json' /tmp/klisteni-api-headers
grep -q 'Cache-Control: no-store' /tmp/klisteni-api-headers
grep -q '"error"' /tmp/klisteni-api-body
echo 'Static image smoke passed: health, SPA, caching, CSP, analytics disabled and API boundary.'
