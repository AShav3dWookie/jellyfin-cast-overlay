using System;
using System.Globalization;

namespace Jellyfin.Plugin.CastOverlay.Injection;

/// <summary>
/// Adds the overlay script to jellyfin-web's index.html.
/// </summary>
public static class IndexHtmlTransformer
{
    /// <summary>
    /// Marker used to keep the injection idempotent.
    /// </summary>
    public const string Marker = "data-cast-overlay";

    /// <summary>
    /// Builds the script tag for the given plugin version.
    /// </summary>
    /// <param name="version">The plugin version, used to bust the browser cache on upgrade.</param>
    /// <returns>The script tag.</returns>
    public static string ScriptTag(string version)
    {
        // Relative to /web/, so it also works when Jellyfin is hosted under a base URL.
        return string.Format(
            CultureInfo.InvariantCulture,
            "<script defer {0} src=\"../CastOverlay/ClientScript?v={1}\"></script>",
            Marker,
            Uri.EscapeDataString(version));
    }

    /// <summary>
    /// Inserts <paramref name="scriptTag"/> before the closing body tag.
    /// </summary>
    /// <param name="html">The original HTML.</param>
    /// <param name="scriptTag">The script tag to insert.</param>
    /// <returns>The transformed HTML, or the original if it already contains the script.</returns>
    public static string Inject(string html, string scriptTag)
    {
        ArgumentNullException.ThrowIfNull(html);
        ArgumentNullException.ThrowIfNull(scriptTag);

        if (html.Contains(Marker, StringComparison.Ordinal))
        {
            return html;
        }

        var bodyEnd = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        return bodyEnd < 0
            ? html + scriptTag
            : html.Insert(bodyEnd, scriptTag);
    }

    /// <summary>
    /// Callback invoked by the File Transformation plugin for index.html.
    /// </summary>
    /// <param name="payload">The file contents, deserialized by File Transformation.</param>
    /// <returns>The transformed file contents.</returns>
    public static string Transform(TransformationPayload payload)
    {
        ArgumentNullException.ThrowIfNull(payload);

        var version = typeof(IndexHtmlTransformer).Assembly.GetName().Version?.ToString() ?? "0";
        return Inject(payload.Contents ?? string.Empty, ScriptTag(version));
    }
}
