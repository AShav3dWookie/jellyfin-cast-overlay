namespace Jellyfin.Plugin.CastOverlay.Injection;

/// <summary>
/// The payload File Transformation passes to a transformation callback.
/// </summary>
public class TransformationPayload
{
    /// <summary>
    /// Gets or sets the current contents of the file being served.
    /// </summary>
    public string? Contents { get; set; }
}
