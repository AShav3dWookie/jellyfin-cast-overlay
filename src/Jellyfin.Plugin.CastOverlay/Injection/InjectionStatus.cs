namespace Jellyfin.Plugin.CastOverlay.Injection;

/// <summary>
/// Tracks the result of registering with File Transformation, for the settings page.
/// </summary>
public class InjectionStatus
{
    /// <summary>
    /// Gets or sets the current state.
    /// </summary>
    public InjectionState State { get; set; } = InjectionState.Pending;

    /// <summary>
    /// Gets or sets a human-readable explanation of the state.
    /// </summary>
    public string? Message { get; set; }
}
