#!/usr/bin/env bash
# End-to-end test run: builds the plugin, starts a fresh Jellyfin 12.3 with File Transformation
# and the plugin installed, then drives jellyfin-web with Playwright. Only Docker is required.
#
# Usage: e2e/run.sh                 run the suite against Jellyfin 12.3 and tear down
#        JELLYFIN=12.4 e2e/run.sh   run it against another supported Jellyfin version
#        KEEP=1 e2e/run.sh          leave Jellyfin running afterwards (http://localhost:${E2E_PORT:-8197})
set -euo pipefail

E2E="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$E2E/.." && pwd)"
STATE="$E2E/.state"
CACHE="$E2E/.cache"

# Each Jellyfin version needs its own File Transformation build.
JELLYFIN="${JELLYFIN:-12.3}"
FT_VERSION="3.0.3.0"
case "$JELLYFIN" in
    12.3) JELLYFIN_TAG="12.3.20261023-013714"; FT_MD5="26e3ccaee0ca023cef039b1c668c606c" ;;
    12.4) JELLYFIN_TAG="12.4.20261026-211555"; FT_MD5="6fb4ddc8dc5324ea4e587f8549618748" ;;
    *) echo "Unsupported JELLYFIN=$JELLYFIN (expected 12.3 or 12.4)" >&2; exit 2 ;;
esac
export JELLYFIN_IMAGE="jellyfin/jellyfin:$JELLYFIN_TAG"
FT_URL="https://github.com/IAmParadox27/jellyfin-plugin-file-transformation/releases/download/$FT_VERSION/Release-$JELLYFIN.0.zip"
PLUGIN_VERSION="$(sed -n 's/.*<Version>\(.*\)<\/Version>.*/\1/p' "$ROOT/Directory.Build.props")"

# Git Bash on Windows needs Windows-style paths for bind mounts.
host_path() {
    if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else echo "$1"; fi
}
docker_run() { MSYS_NO_PATHCONV=1 docker run --rm "$@"; }
compose() { MSYS_NO_PATHCONV=1 docker compose -f "$(host_path "$E2E/docker-compose.yml")" "$@"; }

echo "==> Resetting state"
compose down --volumes --remove-orphans >/dev/null 2>&1 || true
# Jellyfin writes as root inside the container, so clean up from a container too.
docker_run -v "$(host_path "$E2E"):/e2e" busybox:1.37 rm -rf /e2e/.state
mkdir -p "$STATE/config/plugins" "$STATE/cache" "$STATE/media" "$CACHE"

echo "==> Building plugin $PLUGIN_VERSION"
"$ROOT/scripts/dotnet.sh" publish src/Jellyfin.Plugin.CastOverlay/Jellyfin.Plugin.CastOverlay.csproj \
    -c Release -o /src/artifacts/plugin --nologo -v quiet
PLUGIN_DIR="$STATE/config/plugins/Cast Overlay_$PLUGIN_VERSION"
mkdir -p "$PLUGIN_DIR"
cp "$ROOT/artifacts/plugin/Jellyfin.Plugin.CastOverlay.dll" "$PLUGIN_DIR/"

echo "==> Installing File Transformation $FT_VERSION for Jellyfin $JELLYFIN"
FT_ZIP="$CACHE/file-transformation-$FT_VERSION-$JELLYFIN.zip"
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
