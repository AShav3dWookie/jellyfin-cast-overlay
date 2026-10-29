import {
    ADMIN_PASSWORD,
    ADMIN_USER,
    DEFAULT_TEST_CONFIG,
    api,
    saveState,
    setPluginConfig,
    waitFor
} from './lib/jellyfin';

interface Item {
    Id: string;
    Name: string;
    Type: string;
    SeriesId?: string;
    People?: { Id: string; Name: string }[];
}

// A 64x64 solid orange PNG, used as a person headshot.
const HEADSHOT_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAUElEQVR42u3PQQkAAAgEsMtiUOOawwi+hcEKLNP1WgQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQErsAC56Zhad3vy5YAAAAASUVORK5CYII=';

async function completeStartupWizard(): Promise<void> {
    const info = await waitFor('Jellyfin to accept requests', async () =>
        api<{ StartupWizardCompleted: boolean }>('/System/Info/Public'));
    if (info.StartupWizardCompleted) {
        return;
    }

    await api('/Startup/Configuration', {
        body: { UICulture: 'en-US', MetadataCountryCode: 'US', PreferredMetadataLanguage: 'en' }
    });
    // GET initialises the first user before it can be renamed.
    await api('/Startup/User');
    await api('/Startup/User', { body: { Name: ADMIN_USER, Password: ADMIN_PASSWORD } });
    await api('/Startup/RemoteAccess', { body: { EnableRemoteAccess: true } });
    await api('/Startup/Complete', { method: 'POST' });
}

async function addLibrary(token: string, name: string, collectionType: string, mediaPath: string, types: string[]) {
    const query = new URLSearchParams({ name, collectionType, refreshLibrary: 'false' });
    await api(`/Library/VirtualFolders?${query}`, {
        token,
        body: {
            LibraryOptions: {
                PathInfos: [{ Path: mediaPath }],
                EnableRealtimeMonitor: false,
                // Fixtures are fictional; keep metadata local and deterministic.
                TypeOptions: types.map((type) => ({ Type: type, MetadataFetchers: [], ImageFetchers: [] }))
            }
        }
    });
}

export default async function globalSetup(): Promise<void> {
    await completeStartupWizard();

    const auth = await api<{ AccessToken: string; User: { Id: string } }>('/Users/AuthenticateByName', {
        body: { Username: ADMIN_USER, Pw: ADMIN_PASSWORD }
    });
    const token = auth.AccessToken;

    // Skip when re-running the suite against a server kept alive with KEEP=1.
    const folders = await api<{ Name: string }[]>('/Library/VirtualFolders', { token });
    if (!folders.some((f) => f.Name === 'Movies')) {
        await addLibrary(token, 'Movies', 'movies', '/media/movies', ['Movie']);
        await addLibrary(token, 'Shows', 'tvshows', '/media/tv', ['Series', 'Season', 'Episode']);
        await api('/Library/Refresh', { token, method: 'POST' });
    }

    const items = await waitFor('library scan to pick up the fixtures', async () => {
        const result = await api<{ Items: Item[] }>(
            `/Users/${auth.User.Id}/Items?Recursive=true&IncludeItemTypes=Movie,Episode,Series&Fields=People`,
            { token });
        const movie = result.Items.find((i) => i.Type === 'Movie');
        const episode = result.Items.find((i) => i.Type === 'Episode');
        const series = result.Items.find((i) => i.Type === 'Series');
        const ready = movie?.People?.length === 4 && (episode?.People?.length ?? 0) >= 2 && (series?.People?.length ?? 0) === 2;
        return ready ? { movie: movie!, episode: episode!, series: series! } : undefined;
    });

    const headshotPerson = items.movie.People!.find((p) => p.Name === 'Avery Testington')!;
    await api(`/Items/${headshotPerson.Id}/Images/Primary`, {
        token,
        rawBody: HEADSHOT_PNG_BASE64,
        contentType: 'image/png'
    });

    await setPluginConfig(token, DEFAULT_TEST_CONFIG);

    saveState({
        token,
        userId: auth.User.Id,
        movieId: items.movie.Id,
        episodeId: items.episode.Id,
        seriesId: items.series.Id,
        headshotPersonId: headshotPerson.Id
    });
}
