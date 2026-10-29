#!/usr/bin/env bash
# Runs the .NET 9 SDK in Docker so no local SDK is needed.
# Usage: scripts/dotnet.sh build -c Release
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Git Bash on Windows needs a Windows-style path for the bind mount.
if command -v cygpath >/dev/null 2>&1; then
    ROOT="$(cygpath -m "$ROOT")"
fi

docker volume create castoverlay-nuget >/dev/null
MSYS_NO_PATHCONV=1 exec docker run --rm \
    -v "$ROOT:/src" \
    -v castoverlay-nuget:/root/.nuget/packages \
    -w /src \
    mcr.microsoft.com/dotnet/sdk:9.0 \
    dotnet "$@"
