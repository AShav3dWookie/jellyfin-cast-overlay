# Cast Overlay for Jellyfin

Shows the cast of whatever you're watching when you pause, in jellyfin-web based clients
(browser, Jellyfin Media Player, and the mobile apps that wrap the web client).

Targets Jellyfin **10.11.11+**.

## Building

No local .NET SDK is needed; everything runs in Docker.

```sh
scripts/dotnet.sh build Jellyfin.Plugin.CastOverlay.slnx -c Release
```

## Testing

```sh
scripts/dotnet.sh test Jellyfin.Plugin.CastOverlay.slnx
```

Client script unit tests (Node + jsdom, in Docker):

```sh
scripts/test-client.sh
```

End-to-end tests start a fresh Jellyfin 10.11.11 in Docker with File Transformation and this plugin
installed, generate a small test library, and drive jellyfin-web with Playwright:

```sh
e2e/run.sh          # KEEP=1 leaves Jellyfin running on http://localhost:8197 (admin / cast-overlay-e2e)
```
