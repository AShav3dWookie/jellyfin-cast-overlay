namespace Jellyfin.Plugin.CastOverlay.Injection;

/// <summary>
/// Whether the overlay script has been hooked into jellyfin-web.
/// </summary>
public enum InjectionState
{
    /// <summary>
    /// Registration hasn't run yet.
    /// </summary>
    Pending,

    /// <summary>
    /// The transformation is registered with File Transformation.
    /// </summary>
    Registered,

    /// <summary>
    /// The File Transformation plugin isn't installed.
    /// </summary>
    FileTransformationMissing,

    /// <summary>
    /// File Transformation is installed but registration failed.
    /// </summary>
    Failed
}
