using System;

namespace Jellyfin.Plugin.CastOverlay.Cast;

/// <summary>
/// A single person shown in the overlay.
/// </summary>
/// <param name="Id">The person's library item id, or <c>null</c> if the person has no library item.</param>
/// <param name="Name">The person's name.</param>
/// <param name="Role">The character played, if known.</param>
/// <param name="Kind">The person's credit type, e.g. <c>Actor</c> or <c>GuestStar</c>.</param>
/// <param name="PrimaryImageTag">The cache tag of the person's primary image, or <c>null</c> if there is none.</param>
public sealed record CastMember(
    Guid? Id,
    string Name,
    string? Role,
    string Kind,
    string? PrimaryImageTag);
