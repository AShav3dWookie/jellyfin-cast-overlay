# Cast Overlay for Jellyfin

Pause a movie or episode and, after a moment, a panel slides in listing who's in it: headshots,
actor names and the characters they play. Resume, and it's gone.

- Works in jellyfin-web based clients: browsers, Jellyfin Media Player, and the Android/iOS apps
  that wrap the web client. Native clients (Android TV, Swiftfin, Roku, Kodi) can't load plugin
  scripts, so they aren't supported.
- Episodes show the series regulars first, then that episode's guest stars.
- Uses the cast metadata already in your library; nothing is fetched from the internet.

Requires Jellyfin **10.11.11** or newer 10.11.x.

## Installation

### 1. Install File Transformation (required)

Cast Overlay adds its script to the web client through the
[File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) plugin,
so your Jellyfin install files are never modified. Jellyfin has no plugin dependency mechanism,
so this has to be installed first, by hand:

1. **Dashboard → Plugins → Repositories → +**, and add
   `https://www.iamparadox.dev/jellyfin/plugins/manifest.json`
2. **Catalog → File Transformation → Install**

### 2. Install Cast Overlay

Copy `Jellyfin.Plugin.CastOverlay.dll` into a `Cast Overlay` folder in your server's `plugins`
directory, then restart Jellyfin.

After restarting, open **Dashboard → Plugins → Cast Overlay**. If File Transformation is missing,
or registering with it failed, the settings page shows a warning.

## Settings

| Setting | Default | |
|---|---|---|
| Show the cast overlay when playback is paused | On | |
| Delay before showing | 1500 ms | Stops the panel flashing up on quick pauses. |
| Maximum cast members | 12 | |
| Include guest stars on episodes | On | |
| Position | Left | Left or right side of the screen. |

## How it works

```
jellyfin-web ── index.html ──▶ File Transformation ──▶ + <script src="../CastOverlay/ClientScript">
     │
     │ on <video> pause
     ▼
GET /CastOverlay/NowPlaying ──▶ finds this device's session ──▶ cast + display settings
```

- `GET /CastOverlay/NowPlaying`: the cast of whatever the calling device is playing
  (`204` if nothing).
- `GET /CastOverlay/Items/{itemId}/Cast?positionTicks=`: the cast of any item the user can access.
- `GET /CastOverlay/Status` (admin): whether the script is hooked into the web client.

The client script only relies on the global `ApiClient` and the `<video class="htmlvideoplayer">`
element, not on jellyfin-web internals. `positionTicks` is accepted but unused for now; it's
where filtering to who is on screen (X-Ray style) would plug in.

## Development

Only Docker is needed; the .NET SDK and Node run in containers.

```sh
scripts/dotnet.sh build Jellyfin.Plugin.CastOverlay.slnx -c Release   # build
scripts/dotnet.sh test Jellyfin.Plugin.CastOverlay.slnx               # .NET unit tests
scripts/test-client.sh                                                 # client script unit tests
e2e/run.sh                                                             # end-to-end tests
```

`e2e/run.sh` starts a fresh `jellyfin/jellyfin:10.11.11` with File Transformation and this plugin
installed, generates a small test library (a movie, and a series episode with guest stars), and
drives jellyfin-web with Playwright. Use `KEEP=1 e2e/run.sh` to leave the server running on
http://localhost:8197 (user `admin`, password `cast-overlay-e2e`). The HTML report, with
screenshots of the overlay, ends up in `e2e/playwright-report`.

## License

GPLv3, like the Jellyfin plugin template this project starts from.
