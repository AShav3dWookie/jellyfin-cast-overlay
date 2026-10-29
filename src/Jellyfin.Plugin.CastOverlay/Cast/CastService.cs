using System;
using System.Collections.Generic;
using System.Linq;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Plugin.CastOverlay.Configuration;
using MediaBrowser.Controller.Drawing;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;

namespace Jellyfin.Plugin.CastOverlay.Cast;

/// <summary>
/// Default <see cref="ICastService"/> backed by the library's people metadata.
/// </summary>
public class CastService : ICastService
{
    private readonly ILibraryManager _libraryManager;
    private readonly IImageProcessor _imageProcessor;

    /// <summary>
    /// Initializes a new instance of the <see cref="CastService"/> class.
    /// </summary>
    /// <param name="libraryManager">The library manager.</param>
    /// <param name="imageProcessor">The image processor.</param>
    public CastService(ILibraryManager libraryManager, IImageProcessor imageProcessor)
    {
        _libraryManager = libraryManager;
        _imageProcessor = imageProcessor;
    }

    /// <inheritdoc />
    public CastResponse GetCast(BaseItem item, User? user, long? positionTicks, PluginConfiguration config)
    {
        ArgumentNullException.ThrowIfNull(item);
        ArgumentNullException.ThrowIfNull(config);

        IReadOnlyList<PersonInfo> seriesPeople = [];
        if (item is Episode episode && !episode.SeriesId.Equals(Guid.Empty)
            && _libraryManager.GetItemById(episode.SeriesId) is Series series)
        {
            seriesPeople = _libraryManager.GetPeople(series);
        }

        var people = CastListBuilder.Build(
            _libraryManager.GetPeople(item),
            seriesPeople,
            config.IncludeGuestStars,
            config.MaxCastMembers);

        var cast = people
            .Select(p => ToCastMember(p, user))
            .OfType<CastMember>()
            .ToList();

        return new CastResponse(
            item.Id,
            item.Name,
            positionTicks,
            cast,
            new DisplaySettings(config.Enabled, Math.Max(0, config.ShowDelayMs), config.Position.ToString()));
    }

    private CastMember? ToCastMember(PersonInfo person, User? user)
    {
        var entity = _libraryManager.GetPerson(person.Name);
        if (entity is null)
        {
            return new CastMember(null, person.Name, NullIfEmpty(person.Role), person.Type.ToString(), null);
        }

        // Mirrors how Jellyfin's own item DTOs hide people the user may not see.
        if (user is not null && !entity.IsVisible(user))
        {
            return null;
        }

        string? imageTag = null;
        if (entity.HasImage(ImageType.Primary, 0))
        {
            imageTag = _imageProcessor.GetImageCacheTag(entity, entity.GetImageInfo(ImageType.Primary, 0));
        }

        return new CastMember(entity.Id, person.Name, NullIfEmpty(person.Role), person.Type.ToString(), imageTag);
    }

    private static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;
}
