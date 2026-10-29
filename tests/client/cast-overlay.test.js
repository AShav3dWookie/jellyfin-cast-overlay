'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const overlay = require(path.join(__dirname, '../../src/Jellyfin.Plugin.CastOverlay/Web/cast-overlay.js'));

function response(overrides = {}) {
    return {
        ItemId: 'item1',
        ItemName: 'The Movie',
        Cast: [
            { Id: 'p1', Name: 'Avery Testington', Role: 'Captain', Kind: 'Actor', PrimaryImageTag: 'tag1' },
            { Id: 'p2', Name: 'Blake Fixturewood', Kind: 'Actor' }
        ],
        Display: { Enabled: true, ShowDelayMs: 1000, Position: 'Left' },
        ...overrides
    };
}

/** Manual clock and timers so the controller's timing can be stepped. */
function fakeClock() {
    let now = 0;
    let nextId = 1;
    const timers = new Map();
    return {
        now: () => now,
        setTimeout: (fn, ms) => {
            const id = nextId++;
            timers.set(id, { fn, at: now + ms });
            return id;
        },
        clearTimeout: (id) => timers.delete(id),
        advance(ms) {
            now += ms;
            for (const [id, t] of [...timers]) {
                if (t.at <= now) {
                    timers.delete(id);
                    t.fn();
                }
            }
        },
        pending: () => timers.size
    };
}

function harness(fetchResult) {
    const clock = fakeClock();
    const calls = { show: [], hide: 0, fetch: 0 };
    const state = { paused: true, fetchResult };
    const controller = overlay.createController({
        fetchCast: () => {
            calls.fetch++;
            return typeof state.fetchResult === 'function' ? state.fetchResult() : Promise.resolve(state.fetchResult);
        },
        show: (r) => calls.show.push(r),
        hide: () => calls.hide++,
        isPaused: () => state.paused,
        now: clock.now,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout
    });
    return { clock, calls, state, controller };
}

describe('initials', () => {
    it('uses first and last word', () => {
        assert.equal(overlay.initials('Avery Q. Testington'), 'AT');
    });

    it('handles single names and odd whitespace', () => {
        assert.equal(overlay.initials('  cher  '), 'C');
    });

    it('falls back for empty names', () => {
        assert.equal(overlay.initials(''), '?');
        assert.equal(overlay.initials(null), '?');
    });
});

describe('imageUrl', () => {
    const apiClient = {
        getUrl: (p, q) => `http://server/${p}?${new URLSearchParams(q)}`
    };

    it('builds a tagged, sized primary image url', () => {
        const url = overlay.imageUrl(apiClient, { Id: 'p1', PrimaryImageTag: 'abc' });
        assert.equal(url, 'http://server/Items/p1/Images/Primary?fillHeight=128&fillWidth=128&quality=90&tag=abc');
    });

    it('returns null without an image tag or id', () => {
        assert.equal(overlay.imageUrl(apiClient, { Id: 'p1' }), null);
        assert.equal(overlay.imageUrl(apiClient, { PrimaryImageTag: 'abc' }), null);
    });
});

describe('render', () => {
    let doc;
    beforeEach(() => {
        doc = new JSDOM('<!doctype html><body></body>').window.document;
    });

    const urlFor = (m) => (m.PrimaryImageTag ? `/img/${m.Id}` : null);

    it('renders title, members, roles and photos', () => {
        const node = overlay.render(doc, response(), urlFor);

        assert.equal(node.id, 'castOverlay');
        assert.equal(node.querySelector('.castOverlay-title').textContent, 'The Movie');
        const members = [...node.querySelectorAll('.castOverlay-member')];
        assert.equal(members.length, 2);
        assert.equal(members[0].querySelector('.castOverlay-name').textContent, 'Avery Testington');
        assert.equal(members[0].querySelector('.castOverlay-role').textContent, 'Captain');
        assert.equal(members[0].querySelector('img.castOverlay-photo').getAttribute('src'), '/img/p1');
        assert.equal(members[1].querySelector('.castOverlay-role'), null);
        assert.equal(members[1].querySelector('.castOverlay-initials').textContent, 'BF');
    });

    it('is decorative for assistive tech and does not block the player', () => {
        const node = overlay.render(doc, response(), urlFor);
        assert.equal(node.getAttribute('aria-hidden'), 'true');
    });

    it('applies the right-hand position', () => {
        const node = overlay.render(doc, response({ Display: { Enabled: true, ShowDelayMs: 0, Position: 'Right' } }), urlFor);
        assert.ok(node.classList.contains('castOverlay-right'));
    });

    it('treats metadata as text, not HTML', () => {
        const r = response({ ItemName: '<img src=x onerror=alert(1)>', Cast: [{ Name: '<b>Bold</b>', Role: '<i>x</i>' }] });
        const node = overlay.render(doc, r, urlFor);

        assert.equal(node.querySelectorAll('b, i, .castOverlay-title img').length, 0);
        assert.equal(node.querySelector('.castOverlay-name').textContent, '<b>Bold</b>');
    });
});

describe('controller', () => {
    it('shows after the configured delay while still paused', async () => {
        const { clock, calls, controller } = harness(response());

        await controller.onPause();
        clock.advance(999);
        assert.equal(calls.show.length, 0);
        clock.advance(1);

        assert.equal(calls.show.length, 1);
        assert.equal(calls.show[0].ItemName, 'The Movie');
    });

    it('counts time spent fetching towards the delay', async () => {
        const { clock, calls, controller } = harness(() => {
            clock.advance(400);
            return Promise.resolve(response());
        });

        await controller.onPause();
        clock.advance(600);

        assert.equal(calls.show.length, 1);
    });

    it('does not show if resumed before the delay', async () => {
        const { clock, calls, state, controller } = harness(response());

        await controller.onPause();
        clock.advance(500);
        state.paused = false;
        controller.onResume();
        clock.advance(5000);

        assert.equal(calls.show.length, 0);
        assert.equal(clock.pending(), 0);
    });

    it('ignores a fetch that resolves after resuming', async () => {
        let resolveFetch;
        const { clock, calls, state, controller } = harness(() => new Promise((r) => { resolveFetch = r; }));

        const pending = controller.onPause();
        state.paused = false;
        controller.onResume();
        resolveFetch(response());
        await pending;
        clock.advance(5000);

        assert.equal(calls.show.length, 0);
    });

    it('hides on resume', () => {
        const { calls, controller } = harness(response());

        controller.onResume();

        assert.equal(calls.hide, 1);
    });

    it('only honours the latest of repeated pauses', async () => {
        const { clock, calls, controller } = harness(response());

        await controller.onPause();
        clock.advance(500);
        await controller.onPause();
        clock.advance(999);
        assert.equal(calls.show.length, 0);
        clock.advance(1);

        assert.equal(calls.show.length, 1);
        assert.equal(calls.fetch, 2);
    });

    for (const [name, value] of [
        ['nothing is playing', null],
        ['the overlay is disabled', response({ Display: { Enabled: false, ShowDelayMs: 0, Position: 'Left' } })],
        ['there is no cast', response({ Cast: [] })]
    ]) {
        it(`shows nothing when ${name}`, async () => {
            const { clock, calls, controller } = harness(value);

            await controller.onPause();
            clock.advance(10000);

            assert.equal(calls.show.length, 0);
        });
    }

    it('swallows fetch failures', async () => {
        const { clock, calls, controller } = harness(() => Promise.reject(new Error('offline')));

        await controller.onPause();
        clock.advance(10000);

        assert.equal(calls.show.length, 0);
    });
});

describe('fetchNowPlaying', () => {
    const client = (result) => ({
        getUrl: (p) => `http://server/${p}`,
        ajax: (req) => {
            client.lastRequest = req;
            return typeof result === 'function' ? result() : Promise.resolve(result);
        }
    });

    it('requests the NowPlaying endpoint', async () => {
        const c = client({ status: 200, json: () => Promise.resolve(response()) });
        const result = await overlay.fetchNowPlaying(c);

        assert.equal(client.lastRequest.url, 'http://server/CastOverlay/NowPlaying');
        assert.equal(client.lastRequest.type, 'GET');
        assert.equal(result.ItemName, 'The Movie');
    });

    it('returns null for 204 No Content', async () => {
        assert.equal(await overlay.fetchNowPlaying(client({ status: 204 })), null);
    });

    it('accepts an already-parsed body', async () => {
        const result = await overlay.fetchNowPlaying(client(response()));
        assert.equal(result.ItemName, 'The Movie');
    });

    it('returns null on errors', async () => {
        assert.equal(await overlay.fetchNowPlaying(client(() => Promise.reject(new Error('x')))), null);
    });
});

describe('init', () => {
    function setup() {
        const dom = new JSDOM('<!doctype html><head></head><body><div class="videoPlayerContainer"></div><div id="reactRoot"></div></body>', {
            pretendToBeVisual: true
        });
        const win = dom.window;
        const fetches = [];
        win.ApiClient = {
            getUrl: (p, q) => `http://server/${p}${q ? `?${new URLSearchParams(q)}` : ''}`,
            ajax: () => {
                fetches.push(1);
                return Promise.resolve({ status: 200, json: () => Promise.resolve(response({ Display: { Enabled: true, ShowDelayMs: 0, Position: 'Left' } })) });
            }
        };
        overlay.init(win);
        return { win, doc: win.document, fetches };
    }

    function addVideo(doc) {
        const video = doc.createElement('video');
        video.className = 'htmlvideoplayer';
        doc.querySelector('.videoPlayerContainer').appendChild(video);
        return video;
    }

    function setPaused(video, paused) {
        Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
    }

    const tick = (win, ms = 0) => new Promise((r) => win.setTimeout(r, ms));

    it('marks itself loaded', () => {
        const { win } = setup();
        assert.equal(win.__castOverlayLoaded, true);
    });

    it('shows the overlay after the video container on pause and removes it on play', async () => {
        const { win, doc } = setup();
        const video = addVideo(doc);
        await tick(win);

        setPaused(video, true);
        video.dispatchEvent(new win.Event('pause'));
        await tick(win, 10);

        const node = doc.getElementById('castOverlay');
        assert.ok(node, 'overlay shown');
        assert.equal(node.previousElementSibling.className, 'videoPlayerContainer');
        assert.ok(node.classList.contains('castOverlay-visible'));
        assert.ok(doc.getElementById('castOverlayStyles'));

        setPaused(video, false);
        video.dispatchEvent(new win.Event('play'));
        assert.equal(doc.getElementById('castOverlay'), null);
    });

    it('starts below the player header', async () => {
        const { win, doc } = setup();
        const header = doc.createElement('div');
        header.className = 'skinHeader';
        header.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 0, width: 0, height: 100 });
        doc.body.appendChild(header);
        const video = addVideo(doc);
        await tick(win);

        setPaused(video, true);
        video.dispatchEvent(new win.Event('pause'));
        await tick(win, 10);

        assert.equal(doc.getElementById('castOverlay').style.paddingTop, '112px');
    });

    it('starts below the lowest of several player headers', async () => {
        const { win, doc } = setup();
        [60, 100, 0].forEach((bottom) => {
            const header = doc.createElement('div');
            header.className = 'skinHeader';
            header.getBoundingClientRect = () => ({ top: 0, bottom, left: 0, right: 0, width: 0, height: bottom });
            doc.body.appendChild(header);
        });
        const video = addVideo(doc);
        await tick(win);

        setPaused(video, true);
        video.dispatchEvent(new win.Event('pause'));
        await tick(win, 10);

        assert.equal(doc.getElementById('castOverlay').style.paddingTop, '112px');
    });

    it('attaches listeners only once per video', async () => {
        const { win, doc, fetches } = setup();
        const video = addVideo(doc);
        await tick(win);
        doc.body.appendChild(doc.createElement('div'));
        await tick(win);

        setPaused(video, true);
        video.dispatchEvent(new win.Event('pause'));
        await tick(win, 10);

        assert.equal(fetches.length, 1);
    });

    it('removes the overlay when the player goes away', async () => {
        const { win, doc } = setup();
        const video = addVideo(doc);
        await tick(win);
        setPaused(video, true);
        video.dispatchEvent(new win.Event('pause'));
        await tick(win, 10);
        assert.ok(doc.getElementById('castOverlay'));

        video.remove();
        await tick(win);

        assert.equal(doc.getElementById('castOverlay'), null);
    });
});
