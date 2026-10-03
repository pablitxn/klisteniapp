#!/bin/sh
set -eu
# Executed inside the immutable release image. Collector rejection checks never
# send an accepted event to the production analytics service.
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
wget -q -O /tmp/klisteni-model http://127.0.0.1:8080/models/anatomy.glb
cmp /usr/share/nginx/html/models/anatomy.glb /tmp/klisteni-model
test "$(wc -c < /tmp/klisteni-model)" -gt 1000000
wget -S -O /dev/null http://127.0.0.1:8080/models/anatomy.glb 2>/tmp/klisteni-model-headers
grep -q 'Cache-Control: no-cache' /tmp/klisteni-model-headers
grep -q "script-src 'self'" /tmp/klisteni-model-headers
asset="$(sed -n 's/.*src="\([^"]*\/assets\/[^"]*\.js\)".*/\1/p' /tmp/klisteni-index | head -1)"
test -n "$asset"
wget -S -O /dev/null "http://127.0.0.1:8080$asset" 2>/tmp/klisteni-asset-headers
grep -q 'max-age=31536000, immutable' /tmp/klisteni-asset-headers
wget -S -O /tmp/klisteni-preview http://127.0.0.1:8080/previews/squat.webp 2>/tmp/klisteni-preview-headers
cmp /usr/share/nginx/html/previews/squat.webp /tmp/klisteni-preview
grep -q 'Cache-Control: no-cache' /tmp/klisteni-preview-headers
grep -q 'Content-Type: image/webp' /tmp/klisteni-preview-headers
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
reject 404 http://127.0.0.1:8080/umami/api/websites
reject 403 http://127.0.0.1:8080/umami/api/send
reject 403 --post-data='{}' --header='Content-Type: application/json' http://127.0.0.1:8080/umami/api/send
reject 415 --post-data='{}' --header='Origin: https://klisteniapp.orchid-labs.xyz' http://127.0.0.1:8080/umami/api/send
reject 403 --post-data='{}' http://127.0.0.1:8080/umami/script.js
echo 'Klisteni immutable image smoke passed: health, SPA, GLB, caching, CSP and proxy boundaries.'
