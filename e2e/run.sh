#!/usr/bin/env bash
# End-to-end test run: builds the plugin, starts a fresh Jellyfin 10.11 with File Transformation
# and the plugin installed, then drives jellyfin-web with Playwright. Only Docker is required.
#
# Usage: e2e/run.sh            run the suite and tear down
#        KEEP=1 e2e/run.sh     leave Jellyfin running afterwards (http://localhost:${E2E_PORT:-8197})
set -euo pipefail

E2E="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$E2E/.." && pwd)"
STATE="$E2E/.state"
CACHE="$E2E/.cache"

JELLYFIN_IMAGE="jellyfin/jellyfin:10.11.11"
FT_VERSION="3.0.3.0"
FT_URL="https://github.com/IAmParadox27/jellyfin-plugin-file-transformation/releases/download/$FT_VERSION/Release-10.11.11.zip"
FT_MD5="3ffc219a5c91c9509926cccb0fc9d913"
PLUGIN_VERSION="$(sed -n 's/.*<Version>\(.*\)<\/Version>.*/\1/p' "$ROOT/Directory.Build.props")"

# Git Bash on Windows needs Windows-style paths for bind mounts.
host_path() {
    if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else echo "$1"; fi
}
docker_run() { MSYS_NO_PATHCONV=1 docker run --rm "$@"; }
compose() { MSYS_NO_PATHCONV=1 docker compose -f "$(host_path "$E2E/docker-compose.yml")" "$@"; }

echo "==> Resetting state"
compose down --volumes --remove-orphans >/dev/null 2>&1 || true
rm -rf "$STATE"
mkdir -p "$STATE/config/plugins" "$STATE/cache" "$STATE/media" "$CACHE"

echo "==> Building plugin $PLUGIN_VERSION"
"$ROOT/scripts/dotnet.sh" publish src/Jellyfin.Plugin.CastOverlay/Jellyfin.Plugin.CastOverlay.csproj \
    -c Release -o /src/artifacts/plugin --nologo -v quiet
PLUGIN_DIR="$STATE/config/plugins/Cast Overlay_$PLUGIN_VERSION"
mkdir -p "$PLUGIN_DIR"
cp "$ROOT/artifacts/plugin/Jellyfin.Plugin.CastOverlay.dll" "$PLUGIN_DIR/"

echo "==> Installing File Transformation $FT_VERSION"
FT_ZIP="$CACHE/file-transformation-$FT_VERSION.zip"
md5_ok() { docker_run -v "$(host_path "$CACHE"):/cache" busybox:1.37 sh -c "echo '$FT_MD5  /cache/$(basename "$FT_ZIP")' | md5sum -c -s"; }
if [ ! -f "$FT_ZIP" ] || ! md5_ok; then
    curl -fsSL -o "$FT_ZIP" "$FT_URL"
    md5_ok || { echo "File Transformation checksum mismatch" >&2; exit 1; }
fi
docker_run -v "$(host_path "$CACHE"):/cache:ro" -v "$(host_path "$STATE/config/plugins"):/plugins" busybox:1.37 \
    unzip -oq "/cache/$(basename "$FT_ZIP")" -d "/plugins/File Transformation_$FT_VERSION"

echo "==> Generating test media"
MEDIA="$STATE/media"
mkdir -p "$MEDIA/movies/Cast Overlay Test Movie (2024)" "$MEDIA/tv/Overlay Test Show/Season 01"
if [ ! -f "$CACHE/sample.webm" ]; then
    # VP8/Vorbis so Playwright's Chromium (no proprietary codecs) can direct-play it.
    docker_run -v "$(host_path "$CACHE"):/out" --entrypoint /usr/lib/jellyfin-ffmpeg/ffmpeg "$JELLYFIN_IMAGE" \
        -loglevel error -f lavfi -i "testsrc2=size=640x360:rate=24" -f lavfi -i "sine=frequency=440" \
        -t 120 -c:v libvpx -deadline realtime -cpu-used 8 -b:v 300k -c:a libvorbis /out/sample.webm
fi
cp "$CACHE/sample.webm" "$MEDIA/movies/Cast Overlay Test Movie (2024)/Cast Overlay Test Movie (2024).webm"
cp "$E2E/fixtures/movies/movie.nfo" "$MEDIA/movies/Cast Overlay Test Movie (2024)/Cast Overlay Test Movie (2024).nfo"
cp "$E2E/fixtures/tv/Overlay Test Show/tvshow.nfo" "$MEDIA/tv/Overlay Test Show/tvshow.nfo"
cp "$CACHE/sample.webm" "$MEDIA/tv/Overlay Test Show/Season 01/Overlay Test Show S01E01.webm"
cp "$E2E/fixtures/tv/Overlay Test Show/Season 01/episode.nfo" "$MEDIA/tv/Overlay Test Show/Season 01/Overlay Test Show S01E01.nfo"

echo "==> Running Playwright"
status=0
compose up --abort-on-container-exit --exit-code-from playwright || status=$?

if [ "$status" -ne 0 ]; then
    echo "==> Jellyfin log (tail)"
    compose logs --no-color --tail 80 jellyfin || true
fi

if [ "${KEEP:-0}" != "1" ]; then
    compose down --volumes --remove-orphans >/dev/null 2>&1 || true
fi

exit "$status"
