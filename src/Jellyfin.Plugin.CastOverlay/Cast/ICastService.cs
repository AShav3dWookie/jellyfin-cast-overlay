using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Plugin.CastOverlay.Configuration;
using MediaBrowser.Controller.Entities;

namespace Jellyfin.Plugin.CastOverlay.Cast;

/// <summary>
/// Resolves the cast to show for an item.
/// </summary>
public interface ICastService
{
    /// <summary>
    /// Gets the overlay payload for an item.
    /// </summary>
    /// <param name="item">The playing item.</param>
    /// <param name="user">The user the cast is resolved for, used for visibility checks.</param>
    /// <param name="positionTicks">
    /// The playback position. Unused for now; reserved for filtering to who is on screen.
    /// </param>
    /// <param name="config">The plugin configuration.</param>
    /// <returns>The overlay payload.</returns>
    CastResponse GetCast(BaseItem item, User? user, long? positionTicks, PluginConfiguration config);
}
