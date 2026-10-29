using Jellyfin.Plugin.CastOverlay.Injection;

namespace Jellyfin.Plugin.CastOverlay.Tests;

public class IndexHtmlTransformerTests
{
    private const string Html = "<html><head></head><body><div id=\"reactRoot\"></div></body></html>";

    [Fact]
    public void Inject_InsertsBeforeClosingBody()
    {
        var result = IndexHtmlTransformer.Inject(Html, "<script></script>");

        Assert.Equal("<html><head></head><body><div id=\"reactRoot\"></div><script></script></body></html>", result);
    }

    [Fact]
    public void Inject_AppendsWhenThereIsNoBody()
    {
        var result = IndexHtmlTransformer.Inject("<div></div>", "<script></script>");

        Assert.Equal("<div></div><script></script>", result);
    }

    [Fact]
    public void Inject_IsIdempotent()
    {
        var tag = IndexHtmlTransformer.ScriptTag("1.0.0.0");

        var once = IndexHtmlTransformer.Inject(Html, tag);
        var twice = IndexHtmlTransformer.Inject(once, tag);

        Assert.Equal(once, twice);
    }

    [Fact]
    public void ScriptTag_IsRelativeAndVersioned()
    {
        var tag = IndexHtmlTransformer.ScriptTag("1.2.3.4");

        Assert.Contains("src=\"../CastOverlay/ClientScript?v=1.2.3.4\"", tag, System.StringComparison.Ordinal);
        Assert.Contains(IndexHtmlTransformer.Marker, tag, System.StringComparison.Ordinal);
        Assert.Contains("defer", tag, System.StringComparison.Ordinal);
    }

    [Fact]
    public void Transform_InjectsIntoPayloadContents()
    {
        var result = IndexHtmlTransformer.Transform(new TransformationPayload { Contents = Html });

        Assert.Contains("../CastOverlay/ClientScript?v=", result, System.StringComparison.Ordinal);
        Assert.EndsWith("</script></body></html>", result, System.StringComparison.Ordinal);
    }

    [Fact]
    public void Transform_HandlesNullContents()
    {
        var result = IndexHtmlTransformer.Transform(new TransformationPayload());

        Assert.StartsWith("<script", result, System.StringComparison.Ordinal);
    }
}
