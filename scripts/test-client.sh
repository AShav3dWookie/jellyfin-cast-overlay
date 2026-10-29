#!/usr/bin/env bash
# Runs the client script unit tests in a Node container.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if command -v cygpath >/dev/null 2>&1; then
    ROOT="$(cygpath -m "$ROOT")"
fi

MSYS_NO_PATHCONV=1 exec docker run --rm \
    -v "$ROOT:/src" \
    -v castoverlay-client-node-modules:/src/tests/client/node_modules \
    -w /src/tests/client \
    node:24.22.1-bookworm-slim \
    sh -c "npm ci --no-audit --no-fund --loglevel=error && node --test"
