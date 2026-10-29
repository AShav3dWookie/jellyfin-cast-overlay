using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.CastOverlay.Configuration;

/// <summary>
/// Plugin configuration.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Gets or sets a value indicating whether the overlay is shown on pause.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Gets or sets how long playback must stay paused before the overlay appears, in milliseconds.
    /// </summary>
    public int ShowDelayMs { get; set; } = 1500;

    /// <summary>
    /// Gets or sets the maximum number of cast members to show.
    /// </summary>
    public int MaxCastMembers { get; set; } = 12;

    /// <summary>
    /// Gets or sets a value indicating whether episode guest stars are included.
    /// </summary>
    public bool IncludeGuestStars { get; set; } = true;

    /// <summary>
    /// Gets or sets the side of the screen the overlay is drawn on.
    /// </summary>
    public OverlayPosition Position { get; set; } = OverlayPosition.Left;
}
