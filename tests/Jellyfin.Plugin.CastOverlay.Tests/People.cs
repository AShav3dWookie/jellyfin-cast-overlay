using Jellyfin.Data.Enums;
using MediaBrowser.Controller.Entities;

namespace Jellyfin.Plugin.CastOverlay.Tests;

internal static class People
{
    public static PersonInfo Actor(string name, string? role = null, int? sortOrder = null)
        => new() { Name = name, Role = role, Type = PersonKind.Actor, SortOrder = sortOrder };

    public static PersonInfo GuestStar(string name, string? role = null, int? sortOrder = null)
        => new() { Name = name, Role = role, Type = PersonKind.GuestStar, SortOrder = sortOrder };

    public static PersonInfo Director(string name)
        => new() { Name = name, Type = PersonKind.Director };
}
