using System;
using System.Linq;
using System.Net.Mime;
using System.Threading.Tasks;
using Jellyfin.Plugin.CastOverlay.Cast;
using Jellyfin.Plugin.CastOverlay.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Net;
using MediaBrowser.Controller.Session;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.CastOverlay.Api;

/// <summary>
/// API used by the client overlay script.
/// </summary>
[ApiController]
[Route("CastOverlay")]
[Authorize]
[Produces(MediaTypeNames.Application.Json)]
public class CastOverlayController : ControllerBase
{
    private readonly ILibraryManager _libraryManager;
    private readonly ISessionManager _sessionManager;
    private readonly IAuthorizationContext _authorizationContext;
    private readonly ICastService _castService;

    /// <summary>
    /// Initializes a new instance of the <see cref="CastOverlayController"/> class.
    /// </summary>
    /// <param name="libraryManager">The library manager.</param>
    /// <param name="sessionManager">The session manager.</param>
    /// <param name="authorizationContext">The authorization context.</param>
    /// <param name="castService">The cast service.</param>
    public CastOverlayController(
        ILibraryManager libraryManager,
        ISessionManager sessionManager,
        IAuthorizationContext authorizationContext,
        ICastService castService)
    {
        _libraryManager = libraryManager;
        _sessionManager = sessionManager;
        _authorizationContext = authorizationContext;
        _castService = castService;
    }

    private static PluginConfiguration Config => Plugin.Instance?.Configuration ?? new PluginConfiguration();

    /// <summary>
    /// Gets the cast for an item.
    /// </summary>
    /// <param name="itemId">The item id.</param>
    /// <param name="positionTicks">The playback position. Reserved for filtering to who is on screen.</param>
    /// <response code="200">The cast was resolved.</response>
    /// <response code="404">The item doesn't exist or the user can't access it.</response>
    /// <returns>The overlay payload.</returns>
    [HttpGet("Items/{itemId}/Cast")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CastResponse>> GetItemCast([FromRoute] Guid itemId, [FromQuery] long? positionTicks)
    {
        var auth = await _authorizationContext.GetAuthorizationInfo(Request).ConfigureAwait(false);
        var item = _libraryManager.GetItemById<BaseItem>(itemId, auth.User);
        if (item is null)
        {
            return NotFound();
        }

        return _castService.GetCast(item, auth.User, positionTicks, Config);
    }

    /// <summary>
    /// Gets the cast for whatever the calling device is currently playing.
    /// </summary>
    /// <response code="200">The cast was resolved.</response>
    /// <response code="204">The calling device isn't playing anything.</response>
    /// <returns>The overlay payload.</returns>
    [HttpGet("NowPlaying")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<ActionResult<CastResponse>> GetNowPlayingCast()
    {
        var auth = await _authorizationContext.GetAuthorizationInfo(Request).ConfigureAwait(false);
        if (auth.User is null || string.IsNullOrEmpty(auth.DeviceId))
        {
            return NoContent();
        }

        var session = _sessionManager.Sessions.FirstOrDefault(s =>
            s.UserId.Equals(auth.UserId)
            && string.Equals(s.DeviceId, auth.DeviceId, StringComparison.Ordinal)
            && s.NowPlayingItem is not null);
        if (session is null)
        {
            return NoContent();
        }

        var item = _libraryManager.GetItemById<BaseItem>(session.NowPlayingItem.Id, auth.User);
        if (item is null)
        {
            return NoContent();
        }

        return _castService.GetCast(item, auth.User, session.PlayState?.PositionTicks, Config);
    }
}
