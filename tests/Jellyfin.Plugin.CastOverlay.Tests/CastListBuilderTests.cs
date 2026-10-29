using System.Linq;
using Jellyfin.Plugin.CastOverlay.Cast;
using MediaBrowser.Controller.Entities;
using static Jellyfin.Plugin.CastOverlay.Tests.People;

namespace Jellyfin.Plugin.CastOverlay.Tests;

public class CastListBuilderTests
{
    private static readonly PersonInfo[] None = [];

    private static string[] Names(System.Collections.Generic.IEnumerable<PersonInfo> people)
        => people.Select(p => p.Name).ToArray();

    [Fact]
    public void Movie_OrdersActorsBySortOrderWithUnorderedLast()
    {
        PersonInfo[] item = [Actor("C"), Actor("B", sortOrder: 1), Actor("A", sortOrder: 0), Actor("D")];

        var result = CastListBuilder.Build(item, None, includeGuestStars: true, maxCount: 10);

        Assert.Equal(["A", "B", "C", "D"], Names(result));
    }

    [Fact]
    public void ExcludesCrew()
    {
        PersonInfo[] item = [Director("Director"), Actor("Actor")];

        var result = CastListBuilder.Build(item, None, includeGuestStars: true, maxCount: 10);

        Assert.Equal(["Actor"], Names(result));
    }

    [Fact]
    public void Episode_PutsSeriesActorsThenEpisodeActorsThenGuestStars()
    {
        PersonInfo[] series = [Actor("Regular 2", sortOrder: 1), Actor("Regular 1", sortOrder: 0)];
        PersonInfo[] episode = [GuestStar("Guest"), Actor("Episode Actor")];

        var result = CastListBuilder.Build(episode, series, includeGuestStars: true, maxCount: 10);

        Assert.Equal(["Regular 1", "Regular 2", "Episode Actor", "Guest"], Names(result));
    }

    [Fact]
    public void Episode_ExcludesGuestStarsWhenDisabled()
    {
        PersonInfo[] series = [Actor("Regular")];
        PersonInfo[] episode = [GuestStar("Guest")];

        var result = CastListBuilder.Build(episode, series, includeGuestStars: false, maxCount: 10);

        Assert.Equal(["Regular"], Names(result));
    }

    [Fact]
    public void DeduplicatesByNameIgnoringCase_FirstWins()
    {
        PersonInfo[] series = [Actor("Jane Doe", "Series Role")];
        PersonInfo[] episode = [GuestStar("jane doe", "Guest Role")];

        var result = CastListBuilder.Build(episode, series, includeGuestStars: true, maxCount: 10);

        var person = Assert.Single(result);
        Assert.Equal("Jane Doe", person.Name);
        Assert.Equal("Series Role", person.Role);
    }

    [Fact]
    public void Duplicate_FillsMissingRoleFromLaterCredit()
    {
        PersonInfo[] series = [Actor("Jane Doe")];
        PersonInfo[] episode = [Actor("Jane Doe", "Detective")];

        var result = CastListBuilder.Build(episode, series, includeGuestStars: true, maxCount: 10);

        Assert.Equal("Detective", Assert.Single(result).Role);
    }

    [Fact]
    public void Duplicate_BeyondLimitStillFillsRole()
    {
        PersonInfo[] series = [Actor("A"), Actor("B")];
        PersonInfo[] episode = [Actor("C"), Actor("A", "Role A")];

        var result = CastListBuilder.Build(episode, series, includeGuestStars: true, maxCount: 2);

        Assert.Equal(["A", "B"], Names(result));
        Assert.Equal("Role A", result[0].Role);
    }

    [Fact]
    public void DoesNotMutateInputs()
    {
        var regular = Actor("Jane Doe");
        PersonInfo[] episode = [Actor("Jane Doe", "Detective")];

        CastListBuilder.Build(episode, [regular], includeGuestStars: true, maxCount: 10);

        Assert.Null(regular.Role);
    }

    [Fact]
    public void TruncatesToMaxCount()
    {
        PersonInfo[] item = [Actor("A"), Actor("B"), Actor("C")];

        var result = CastListBuilder.Build(item, None, includeGuestStars: true, maxCount: 2);

        Assert.Equal(["A", "B"], Names(result));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void NonPositiveMaxCount_ReturnsEmpty(int maxCount)
    {
        var result = CastListBuilder.Build([Actor("A")], None, includeGuestStars: true, maxCount: maxCount);

        Assert.Empty(result);
    }

    [Fact]
    public void SkipsBlankNames()
    {
        PersonInfo[] item = [Actor(string.Empty), Actor("  "), Actor("A")];

        var result = CastListBuilder.Build(item, None, includeGuestStars: true, maxCount: 10);

        Assert.Equal(["A"], Names(result));
    }
}
