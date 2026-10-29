using System;
using System.Linq;
using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.CastOverlay.Injection;

/// <summary>
/// Registers the index.html transformation with the File Transformation plugin on startup.
/// </summary>
/// <remarks>
/// File Transformation can't be referenced directly because plugins load into separate
/// load contexts, so everything goes through reflection, including building its
/// Newtonsoft <c>JObject</c> payload, to avoid depending on its Newtonsoft version.
/// </remarks>
public class FileTransformationRegistrar : IHostedService
{
    /// <summary>
    /// The id of our transformation registration.
    /// </summary>
    public static readonly Guid TransformationId = Guid.Parse("5a01b71d-7a95-4a92-ab89-081d5db16c62");

    private const string FileTransformationAssemblyName = "Jellyfin.Plugin.FileTransformation";
    private const string PluginInterfaceTypeName = "Jellyfin.Plugin.FileTransformation.PluginInterface";

    private readonly InjectionStatus _status;
    private readonly ILogger<FileTransformationRegistrar> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="FileTransformationRegistrar"/> class.
    /// </summary>
    /// <param name="status">The shared injection status.</param>
    /// <param name="logger">The logger.</param>
    public FileTransformationRegistrar(InjectionStatus status, ILogger<FileTransformationRegistrar> logger)
    {
        _status = status;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        var assembly = AssemblyLoadContext.All
            .SelectMany(c => c.Assemblies)
            .FirstOrDefault(a => string.Equals(a.GetName().Name, FileTransformationAssemblyName, StringComparison.Ordinal));
        if (assembly is null)
        {
            _status.State = InjectionState.FileTransformationMissing;
            _status.Message = "The File Transformation plugin is not installed, so the overlay can't be added to the web client.";
            _logger.LogError("Cast Overlay requires the File Transformation plugin; the overlay will not appear until it is installed");
            return Task.CompletedTask;
        }

        try
        {
            Register(assembly);
            _status.State = InjectionState.Registered;
            _status.Message = null;
            _logger.LogInformation("Cast Overlay registered its index.html transformation with File Transformation");
        }
        catch (Exception ex) when (ex is TargetInvocationException or InvalidOperationException or MissingMethodException)
        {
            _status.State = InjectionState.Failed;
            _status.Message = "Registering with File Transformation failed: " + (ex.InnerException ?? ex).Message;
            _logger.LogError(ex, "Cast Overlay failed to register with File Transformation");
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private static void Register(Assembly fileTransformation)
    {
        var register = fileTransformation.GetType(PluginInterfaceTypeName)?.GetMethod("RegisterTransformation")
            ?? throw new InvalidOperationException(PluginInterfaceTypeName + ".RegisterTransformation was not found.");

        // RegisterTransformation takes a JObject; build it with that type's own Parse method.
        var payloadType = register.GetParameters().Single().ParameterType;
        var parse = payloadType.GetMethod("Parse", BindingFlags.Public | BindingFlags.Static, [typeof(string)])
            ?? throw new InvalidOperationException(payloadType.FullName + ".Parse(string) was not found.");

        var json = JsonSerializer.Serialize(new
        {
            id = TransformationId,
            fileNamePattern = "^index\\.html$",
            callbackAssembly = typeof(IndexHtmlTransformer).Assembly.FullName,
            callbackClass = typeof(IndexHtmlTransformer).FullName,
            callbackMethod = nameof(IndexHtmlTransformer.Transform)
        });

        register.Invoke(null, [parse.Invoke(null, [json])]);
    }
}
