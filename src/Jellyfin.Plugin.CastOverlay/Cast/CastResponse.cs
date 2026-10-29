using System;
using System.Collections.Generic;

namespace Jellyfin.Plugin.CastOverlay.Cast;

/// <summary>
/// The overlay payload for one item.
/// </summary>
/// <param name="ItemId">The item id.</param>
/// <param name="ItemName">The item name.</param>
/// <param name="PositionTicks">The playback position the cast was resolved for, if known.</param>
/// <param name="Cast">The cast to display.</param>
/// <param name="Display">Display settings for the client.</param>
public sealed record CastResponse(
    Guid ItemId,
    string ItemName,
    long? PositionTicks,
    IReadOnlyList<CastMember> Cast,
    DisplaySettings Display);
