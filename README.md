# Cast Overlay for Jellyfin

Shows the cast of whatever you're watching when you pause, in jellyfin-web based clients
(browser, Jellyfin Media Player, and the mobile apps that wrap the web client).

Targets Jellyfin **10.11.11+**.

## Building

No local .NET SDK is needed; everything runs in Docker.

```sh
scripts/dotnet.sh build Jellyfin.Plugin.CastOverlay.slnx -c Release
```
