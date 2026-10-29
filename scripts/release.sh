#!/usr/bin/env bash
# Publishes the version in build.yaml as a GitHub release that Jellyfin installs and updates from.
# Add this repository in Jellyfin once; it never changes:
#   https://github.com/AShav3dWookie/jellyfin-cast-overlay/releases/latest/download/manifest.json
# Each release carries the plugin zip and a manifest listing every version so far: the previous
# release's manifest, extended.
#
# Runs from .github/workflows/release.yaml when a tag is pushed. HEAD must be tagged with the
# version (1.0.0.0 -> v1.0, 1.0.1.0 -> v1.0.1). Needs Docker and the GitHub CLI, logged in.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="src/Jellyfin.Plugin.CastOverlay"
REPO="${GITHUB_REPOSITORY:-AShav3dWookie/jellyfin-cast-overlay}"
OUT="$ROOT/artifacts/release"

die() { echo "release: $*" >&2; exit 1; }

version="$(sed -n 's/^version: "\(.*\)"/\1/p' "$ROOT/$PROJECT/build.yaml")"
props_version="$(sed -n 's/.*<Version>\(.*\)<\/Version>.*/\1/p' "$ROOT/Directory.Build.props")"
[ "$version" = "$props_version" ] \
    || die "build.yaml has version $version but Directory.Build.props has $props_version"
tag="v${version%.0}"; tag="${tag%.0}"
[ "$(git -C "$ROOT" rev-parse -q --verify "refs/tags/$tag^{commit}" || true)" = "$(git -C "$ROOT" rev-parse HEAD)" ] \
    || die "HEAD isn't tagged $tag: bump the version, commit, then tag and push $tag"
! gh release view "$tag" -R "$REPO" >/dev/null 2>&1 || die "release $tag already exists"

# Git Bash on Windows needs Windows-style paths for bind mounts.
host_root="$ROOT"
if command -v cygpath >/dev/null 2>&1; then host_root="$(cygpath -m "$ROOT")"; fi
jprm() {
    MSYS_NO_PATHCONV=1 docker run --rm -v "$host_root:/src" -v castoverlay-nuget:/root/.nuget/packages \
        -w /src castoverlay-jprm jprm --verbosity=info "$@"
}

echo "==> Building Cast Overlay $version"
docker build -q -t castoverlay-jprm -f "$ROOT/scripts/jprm.Dockerfile" "$ROOT/scripts" >/dev/null
# Created here, not by the container, so this user can still write to them on Linux.
rm -rf "$OUT" && mkdir -p "$OUT/repo"
jprm plugin build "$PROJECT" --output=artifacts/release --version="$version"
zip="$(ls "$OUT"/*.zip 2>/dev/null | head -n1)"
[ -n "$zip" ] || die "jprm produced no zip"

if gh release download -R "$REPO" --pattern manifest.json --dir "$OUT/repo" 2>/dev/null; then
    echo "==> Extending the previous release's manifest"
else
    echo "==> First release: new manifest"
    jprm repo init artifacts/release/repo
fi
# --plugin-url: the zip is served from this release, not from beside the manifest.
jprm repo add --plugin-url="https://github.com/$REPO/releases/download/$tag/$(basename "$zip")" \
    artifacts/release/repo "artifacts/release/$(basename "$zip")"

notes="$(sed -n '/^changelog: >/,$p' "$ROOT/$PROJECT/build.yaml" | tail -n +2 | sed 's/^  //' | tr '\n' ' ')

**Install:** first install [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) (see the README). Then in Jellyfin, *Dashboard → Plugins → Repositories → +*, add \`https://github.com/$REPO/releases/latest/download/manifest.json\`, install *Cast Overlay* from the catalogue and restart Jellyfin. Requires Jellyfin 12.3 or later."

echo "==> Publishing release $tag"
gh release create "$tag" -R "$REPO" --verify-tag --title "Cast Overlay $tag" --notes "$notes" \
    "$zip" "$OUT/repo/manifest.json"
