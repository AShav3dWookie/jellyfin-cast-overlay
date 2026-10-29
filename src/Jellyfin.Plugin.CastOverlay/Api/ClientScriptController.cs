using System.Net.Mime;
using Jellyfin.Plugin.CastOverlay.Injection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.CastOverlay.Api;

/// <summary>
/// Serves the overlay script and reports injection status.
/// </summary>
[ApiController]
[Route("CastOverlay")]
public class ClientScriptController : ControllerBase
{
    private const string ScriptResource = "Jellyfin.Plugin.CastOverlay.Web.cast-overlay.js";

    private readonly InjectionStatus _status;

    /// <summary>
    /// Initializes a new instance of the <see cref="ClientScriptController"/> class.
    /// </summary>
    /// <param name="status">The injection status.</param>
    public ClientScriptController(InjectionStatus status)
    {
        _status = status;
    }

    /// <summary>
    /// Gets the overlay client script.
    /// </summary>
    /// <remarks>Anonymous because it is loaded by a plain script tag before the user signs in.</remarks>
    /// <response code="200">The script was returned.</response>
    /// <returns>The script file.</returns>
    [HttpGet("ClientScript")]
    [AllowAnonymous]
    [Produces("application/javascript")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult GetClientScript()
    {
        var stream = typeof(ClientScriptController).Assembly.GetManifestResourceStream(ScriptResource);
        if (stream is null)
        {
            return NotFound();
        }

        // The script tag carries the plugin version, so the file can be cached between upgrades.
        Response.Headers.CacheControl = "public, max-age=86400";
        return File(stream, "application/javascript; charset=utf-8");
    }

    /// <summary>
    /// Gets whether the overlay script is hooked into jellyfin-web.
    /// </summary>
    /// <response code="200">The status was returned.</response>
    /// <returns>The injection status.</returns>
    [HttpGet("Status")]
    [Authorize(Policy = "RequiresElevation")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<InjectionStatus> GetStatus() => _status;
}
