#!/usr/bin/env bash
set -euo pipefail
# Workspace-only libraries/plugins. This does not alter TLS validation or system trust.
QA_APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QA_WK_BUNDLE="${QA_WEBKIT_BUNDLE:-$QA_APP_ROOT/.cache/qa-anonymous/browsers/webkit-2359}/minibrowser-wpe"
QA_LIB_ROOT="$QA_APP_ROOT/.cache/qa-anonymous/libroot/usr/lib/x86_64-linux-gnu"
export TMPDIR="$QA_APP_ROOT/.cache/qa-anonymous/webkit-tmp"
export WPE_SHELL_MEDIA_DISK_CACHE_PATH="$TMPDIR"
export XDG_CACHE_HOME="$QA_APP_ROOT/.cache/qa-anonymous/webkit-cache"
export XDG_CONFIG_HOME="$QA_APP_ROOT/.cache/qa-anonymous/webkit-config"
mkdir -p "$TMPDIR" "$XDG_CACHE_HOME" "$XDG_CONFIG_HOME"
export WEBKIT_EXEC_PATH="$QA_WK_BUNDLE/bin"
export WEBKIT_INJECTED_BUNDLE_PATH="$QA_WK_BUNDLE/lib"
export WEBKIT_INSPECTOR_RESOURCES_PATH="$QA_WK_BUNDLE/share"
export LD_LIBRARY_PATH="$QA_WK_BUNDLE/lib:$QA_WK_BUNDLE/sys/lib:$QA_LIB_ROOT"
export GST_PLUGIN_PATH="$QA_LIB_ROOT/gstreamer-1.0"
export GST_REGISTRY="$QA_APP_ROOT/.cache/qa-anonymous/gst-browser.bin"
exec "$QA_WK_BUNDLE/bin/MiniBrowser" "$@"
