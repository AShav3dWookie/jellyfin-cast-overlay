using System;
using System.Collections.Generic;
using System.Linq;
using Jellyfin.Data.Enums;
using MediaBrowser.Controller.Entities;

namespace Jellyfin.Plugin.CastOverlay.Cast;

/// <summary>
/// Turns raw people metadata into the ordered cast list shown in the overlay.
/// </summary>
public static class CastListBuilder
{
    /// <summary>
    /// Builds the cast list for an item.
    /// </summary>
    /// <remarks>
    /// Episode metadata usually only carries guest stars, with the main cast stored on the series,
    /// so series actors come first, then any actors on the item itself, then guest stars.
    /// People are de-duplicated by name; the first occurrence wins.
    /// </remarks>
    /// <param name="itemPeople">People attached to the playing item.</param>
    /// <param name="seriesPeople">People attached to the item's series, or empty for non-episodes.</param>
    /// <param name="includeGuestStars">Whether guest stars are included.</param>
    /// <param name="maxCount">Maximum number of people to return.</param>
    /// <returns>The ordered cast list.</returns>
    public static IReadOnlyList<PersonInfo> Build(
        IReadOnlyList<PersonInfo> itemPeople,
        IReadOnlyList<PersonInfo> seriesPeople,
        bool includeGuestStars,
        int maxCount)
    {
        ArgumentNullException.ThrowIfNull(itemPeople);
        ArgumentNullException.ThrowIfNull(seriesPeople);

        if (maxCount <= 0)
        {
            return [];
        }

        var candidates = OfKind(seriesPeople, PersonKind.Actor)
            .Concat(OfKind(itemPeople, PersonKind.Actor));
        if (includeGuestStars)
        {
            candidates = candidates.Concat(OfKind(itemPeople, PersonKind.GuestStar));
        }

        var result = new List<PersonInfo>();
        var byName = new Dictionary<string, PersonInfo>(StringComparer.OrdinalIgnoreCase);
        foreach (var person in candidates)
        {
            if (string.IsNullOrWhiteSpace(person.Name))
            {
                continue;
            }

            if (byName.TryGetValue(person.Name, out var existing))
            {
                // A series regular's character name is sometimes only on the episode.
                if (string.IsNullOrWhiteSpace(existing.Role) && !string.IsNullOrWhiteSpace(person.Role))
                {
                    existing.Role = person.Role;
                }

                continue;
            }

            if (result.Count == maxCount)
            {
                continue;
            }

            var copy = new PersonInfo
            {
                Id = person.Id,
                ItemId = person.ItemId,
                Name = person.Name,
                Role = person.Role,
                Type = person.Type,
                SortOrder = person.SortOrder,
                ImageUrl = person.ImageUrl
            };
            byName[copy.Name] = copy;
            result.Add(copy);
        }

        return result;
    }

    private static IEnumerable<PersonInfo> OfKind(IEnumerable<PersonInfo> people, PersonKind kind)
    {
        // OrderBy is stable, so people without a sort order keep their metadata order.
        return people
            .Where(p => p.Type == kind)
            .OrderBy(p => p.SortOrder ?? int.MaxValue);
    }
}
