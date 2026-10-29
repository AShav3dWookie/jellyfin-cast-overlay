using System;
using System.Linq;
using Jellyfin.Plugin.CastOverlay.Cast;
using Jellyfin.Plugin.CastOverlay.Configuration;
using MediaBrowser.Controller.Drawing;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using Moq;
using static Jellyfin.Plugin.CastOverlay.Tests.People;

namespace Jellyfin.Plugin.CastOverlay.Tests;

public class CastServiceTests
{
    private readonly Mock<ILibraryManager> _libraryManager = new();
    private readonly Mock<IImageProcessor> _imageProcessor = new();
    private readonly CastService _service;

    public CastServiceTests()
    {
        _libraryManager.Setup(m => m.GetPeople(It.IsAny<BaseItem>())).Returns([]);
        _service = new CastService(_libraryManager.Object, _imageProcessor.Object);
    }

    private void SetPeople(BaseItem item, params PersonInfo[] people)
        => _libraryManager.Setup(m => m.GetPeople(item)).Returns(people);

    private Person AddPersonEntity(string name, bool withImage)
    {
        var person = new Person { Id = Guid.NewGuid(), Name = name };
        if (withImage)
        {
            person.ImageInfos = [new ItemImageInfo { Type = ImageType.Primary, Path = "/people/" + name + ".jpg" }];
        }

        _libraryManager.Setup(m => m.GetPerson(name)).Returns(person);
        return person;
    }

    [Fact]
    public void Movie_MapsPeopleWithImagesAndIds()
    {
        var movie = new Movie { Id = Guid.NewGuid(), Name = "The Movie" };
        SetPeople(movie, Actor("Jane Doe", "Hero"), Actor("No Entity"));
        var jane = AddPersonEntity("Jane Doe", withImage: true);
        _imageProcessor.Setup(m => m.GetImageCacheTag(jane, It.IsAny<ItemImageInfo>())).Returns("tag-1");

        var response = _service.GetCast(movie, null, 123, new PluginConfiguration());

        Assert.Equal(movie.Id, response.ItemId);
        Assert.Equal("The Movie", response.ItemName);
        Assert.Equal(123, response.PositionTicks);
        Assert.Collection(
            response.Cast,
            m => Assert.Equal(new CastMember(jane.Id, "Jane Doe", "Hero", "Actor", "tag-1"), m),
            m => Assert.Equal(new CastMember(null, "No Entity", null, "Actor", null), m));
    }

    [Fact]
    public void PersonWithoutImage_HasNoImageTag()
    {
        var movie = new Movie { Id = Guid.NewGuid(), Name = "The Movie" };
        SetPeople(movie, Actor("Jane Doe"));
        var jane = AddPersonEntity("Jane Doe", withImage: false);

        var response = _service.GetCast(movie, null, null, new PluginConfiguration());

        var member = Assert.Single(response.Cast);
        Assert.Equal(jane.Id, member.Id);
        Assert.Null(member.PrimaryImageTag);
    }

    [Fact]
    public void Episode_IncludesSeriesCast()
    {
        var series = new Series { Id = Guid.NewGuid(), Name = "The Show" };
        var episode = new Episode { Id = Guid.NewGuid(), Name = "Pilot", SeriesId = series.Id };
        _libraryManager.Setup(m => m.GetItemById(series.Id)).Returns(series);
        SetPeople(series, Actor("Regular", "Lead"));
        SetPeople(episode, GuestStar("Guest", "Villain"));

        var response = _service.GetCast(episode, null, null, new PluginConfiguration());

        Assert.Equal(["Regular", "Guest"], response.Cast.Select(c => c.Name));
        Assert.Equal(["Actor", "GuestStar"], response.Cast.Select(c => c.Kind));
    }

    [Fact]
    public void Episode_WithMissingSeries_UsesEpisodeCastOnly()
    {
        var episode = new Episode { Id = Guid.NewGuid(), Name = "Pilot", SeriesId = Guid.NewGuid() };
        SetPeople(episode, GuestStar("Guest"));

        var response = _service.GetCast(episode, null, null, new PluginConfiguration());

        Assert.Equal(["Guest"], response.Cast.Select(c => c.Name));
    }

    [Fact]
    public void AppliesConfiguration()
    {
        var movie = new Movie { Id = Guid.NewGuid(), Name = "The Movie" };
        SetPeople(movie, Actor("A"), Actor("B"), Actor("C"));
        var config = new PluginConfiguration
        {
            Enabled = false,
            MaxCastMembers = 2,
            ShowDelayMs = -50,
            Position = OverlayPosition.Right
        };

        var response = _service.GetCast(movie, null, null, config);

        Assert.Equal(2, response.Cast.Count);
        Assert.Equal(new DisplaySettings(false, 0, "Right"), response.Display);
    }
}
