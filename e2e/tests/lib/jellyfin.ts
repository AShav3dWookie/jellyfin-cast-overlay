import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const BASE_URL = process.env.JELLYFIN_URL ?? 'http://localhost:8197';
export const ADMIN_USER = 'admin';
export const ADMIN_PASSWORD = 'cast-overlay-e2e';
export const PLUGIN_ID = '0c59cd6c-1dee-4578-82a2-b9f377548402';

const STATE_FILE = path.join(__dirname, '..', '..', '.state', 'e2e.json');

/** Ids and credentials captured by global setup. */
export interface E2EState {
    token: string;
    userId: string;
    movieId: string;
    episodeId: string;
    seriesId: string;
    /** Person who gets an uploaded headshot. */
    headshotPersonId: string;
}

export function saveState(state: E2EState): void {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function loadState(): E2EState {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as E2EState;
}

function authHeader(token?: string, deviceId = 'cast-overlay-e2e-api'): string {
    const parts = [
        'Client="CastOverlayE2E"',
        'Device="Node"',
        `DeviceId="${deviceId}"`,
        'Version="1.0.0"'
    ];
    if (token) {
        parts.push(`Token="${token}"`);
    }

    return `MediaBrowser ${parts.join(', ')}`;
}

export interface RequestOptions {
    method?: string;
    body?: unknown;
    rawBody?: string;
    contentType?: string;
    token?: string;
    deviceId?: string;
    /** Return the raw Response instead of throwing on non-2xx. */
    raw?: boolean;
}

export async function api<T = unknown>(urlPath: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
        Authorization: authHeader(options.token, options.deviceId)
    };
    let body: string | undefined;
    if (options.rawBody !== undefined) {
        body = options.rawBody;
        headers['Content-Type'] = options.contentType ?? 'application/octet-stream';
    } else if (options.body !== undefined) {
        body = JSON.stringify(options.body);
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(BASE_URL + urlPath, {
        method: options.method ?? (body === undefined ? 'GET' : 'POST'),
        headers,
        body
    });
    if (options.raw) {
        return response as T;
    }

    if (!response.ok) {
        throw new Error(`${options.method ?? 'GET'} ${urlPath} -> ${response.status}: ${await response.text()}`);
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
}

export async function waitFor<T>(
    description: string,
    probe: () => Promise<T | undefined>,
    timeoutMs = 120_000,
    intervalMs = 1_000
): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline) {
        try {
            const result = await probe();
            if (result !== undefined) {
                return result;
            }
        } catch (error) {
            lastError = error;
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Timed out waiting for ${description}${lastError ? `: ${String(lastError)}` : ''}`);
}

export interface PluginConfig {
    Enabled: boolean;
    ShowDelayMs: number;
    MaxCastMembers: number;
    IncludeGuestStars: boolean;
    Position: 'Left' | 'Right';
}

export const DEFAULT_TEST_CONFIG: PluginConfig = {
    Enabled: true,
    // Shorter than the default so the suite stays quick, but long enough to test quick pauses.
    ShowDelayMs: 1000,
    MaxCastMembers: 12,
    IncludeGuestStars: true,
    Position: 'Left'
};

export async function setPluginConfig(token: string, config: Partial<PluginConfig>): Promise<void> {
    const current = await api<PluginConfig>(`/Plugins/${PLUGIN_ID}/Configuration`, { token });
    await api(`/Plugins/${PLUGIN_ID}/Configuration`, { token, body: { ...current, ...config } });
}
