namespace Jellyfin.Plugin.CastOverlay.Cast;

/// <summary>
/// Client-side display settings, sent with every cast response so the client needs no extra request.
/// </summary>
/// <param name="Enabled">Whether the overlay is enabled.</param>
/// <param name="ShowDelayMs">How long playback must stay paused before showing the overlay.</param>
/// <param name="Position">Which side of the screen to draw on, <c>Left</c> or <c>Right</c>.</param>
public sealed record DisplaySettings(
    bool Enabled,
    int ShowDelayMs,
    string Position);
