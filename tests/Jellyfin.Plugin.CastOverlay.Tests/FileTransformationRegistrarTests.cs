using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Plugin.CastOverlay.Injection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Jellyfin.Plugin.CastOverlay.Tests;

public class FileTransformationRegistrarTests
{
    [Fact]
    public async Task StartAsync_WithoutFileTransformation_ReportsMissing()
    {
        // File Transformation is never loaded into the test process.
        var status = new InjectionStatus();
        var registrar = new FileTransformationRegistrar(status, NullLogger<FileTransformationRegistrar>.Instance);

        await registrar.StartAsync(CancellationToken.None);

        Assert.Equal(InjectionState.FileTransformationMissing, status.State);
        Assert.Contains("File Transformation", status.Message, System.StringComparison.Ordinal);
    }
}
