/*
 * Cast Overlay client script, injected into jellyfin-web by the Cast Overlay plugin.
 *
 * When the video player is paused for longer than the configured delay, shows the cast of the
 * playing item. Relies only on the global ApiClient and the <video> element, not on
 * jellyfin-web internals, so it survives web client updates.
 */
(function (root) {
    'use strict';

    var OVERLAY_ID = 'castOverlay';
    var STYLE_ID = 'castOverlayStyles';
    var VIDEO_SELECTOR = 'video.htmlvideoplayer';
    var HIDE_EVENTS = ['play', 'playing', 'seeking', 'emptied', 'ended', 'abort'];
    var IMAGE_SIZE = 128;
    var HEADER_GAP = 12;

    var STYLES = [
        '#castOverlay{position:fixed;top:0;bottom:0;left:0;width:min(26em,45vw);box-sizing:border-box;',
        'padding:5em 2em 9em;display:flex;flex-direction:column;pointer-events:none;color:#fff;',
        'background:linear-gradient(to right,rgba(0,0,0,.85),rgba(0,0,0,.55) 65%,rgba(0,0,0,0));',
        'opacity:0;transition:opacity .35s ease;text-shadow:0 1px 3px rgba(0,0,0,.6)}',
        '#castOverlay.castOverlay-right{left:auto;right:0;text-align:right;',
        'background:linear-gradient(to left,rgba(0,0,0,.85),rgba(0,0,0,.55) 65%,rgba(0,0,0,0))}',
        '#castOverlay.castOverlay-visible{opacity:1}',
        '.castOverlay-heading{margin:0;font-size:.8em;font-weight:600;letter-spacing:.14em;text-transform:uppercase;opacity:.7}',
        '.castOverlay-title{margin:.2em 0 1em;font-size:1.35em;font-weight:600;line-height:1.2}',
        '.castOverlay-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.8em;overflow:hidden}',
        '.castOverlay-member{display:flex;align-items:center;gap:.9em;min-width:0}',
        '.castOverlay-right .castOverlay-member{flex-direction:row-reverse}',
        '.castOverlay-photo{flex:none;width:3.2em;height:3.2em;border-radius:50%;object-fit:cover;',
        'background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-weight:600;text-shadow:none}',
        '.castOverlay-text{min-width:0}',
        '.castOverlay-name,.castOverlay-role{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.castOverlay-name{font-weight:600}',
        '.castOverlay-role{font-size:.9em;opacity:.75}',
        '@media (max-width:600px){#castOverlay{width:75vw;font-size:.85em;padding:4em 1em 7em}}',
        '@media (prefers-reduced-motion:reduce){#castOverlay{transition:none}}'
    ].join('');

    /** Up to two initials for a person without a photo. */
    function initials(name) {
        var words = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) {
            return '?';
        }

        var first = words[0].charAt(0);
        var last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
        return (first + last).toUpperCase();
    }

    function imageUrl(apiClient, member) {
        if (!member.Id || !member.PrimaryImageTag) {
            return null;
        }

        return apiClient.getUrl('Items/' + member.Id + '/Images/Primary', {
            fillHeight: IMAGE_SIZE,
            fillWidth: IMAGE_SIZE,
            quality: 90,
            tag: member.PrimaryImageTag
        });
    }

    function el(doc, tag, className, text) {
        var node = doc.createElement(tag);
        if (className) {
            node.className = className;
        }

        if (text) {
            node.textContent = text;
        }

        return node;
    }

    /** Builds the overlay element for a NowPlaying response. Does not insert it. */
    function render(doc, response, getImageUrl) {
        var overlay = el(doc, 'div');
        overlay.id = OVERLAY_ID;
        overlay.setAttribute('aria-hidden', 'true');
        if (response.Display && response.Display.Position === 'Right') {
            overlay.classList.add('castOverlay-right');
        }

        overlay.appendChild(el(doc, 'h2', 'castOverlay-heading', 'Cast'));
        overlay.appendChild(el(doc, 'p', 'castOverlay-title', response.ItemName));

        var list = el(doc, 'ul', 'castOverlay-list');
        response.Cast.forEach(function (member) {
            var item = el(doc, 'li', 'castOverlay-member');
            var src = getImageUrl(member);
            var photo;
            if (src) {
                photo = el(doc, 'img', 'castOverlay-photo');
                photo.alt = '';
                photo.src = src;
            } else {
                photo = el(doc, 'div', 'castOverlay-photo castOverlay-initials', initials(member.Name));
            }

            var text = el(doc, 'div', 'castOverlay-text');
            text.appendChild(el(doc, 'div', 'castOverlay-name', member.Name));
            if (member.Role) {
                text.appendChild(el(doc, 'div', 'castOverlay-role', member.Role));
            }

            item.appendChild(photo);
            item.appendChild(text);
            list.appendChild(item);
        });
        overlay.appendChild(list);

        return overlay;
    }

    /**
     * Decides when to show and hide the overlay. Platform hooks are injected so the timing
     * logic can be unit tested.
     *
     * hooks.fetchCast() -> Promise<response|null>
     * hooks.show(response), hooks.hide()
     * hooks.isPaused() -> boolean
     * hooks.now(), hooks.setTimeout(fn, ms), hooks.clearTimeout(id)
     */
    function createController(hooks) {
        var generation = 0;
        var timer = null;

        function cancel() {
            generation++;
            if (timer !== null) {
                hooks.clearTimeout(timer);
                timer = null;
            }
        }

        return {
            onPause: function () {
                cancel();
                var current = generation;
                var pausedAt = hooks.now();
                return hooks.fetchCast().then(function (response) {
                    if (current !== generation || !hooks.isPaused()) {
                        return;
                    }

                    if (!response || !response.Display || !response.Display.Enabled || !response.Cast || response.Cast.length === 0) {
                        return;
                    }

                    var remaining = Math.max(0, response.Display.ShowDelayMs - (hooks.now() - pausedAt));
                    timer = hooks.setTimeout(function () {
                        timer = null;
                        if (current === generation && hooks.isPaused()) {
                            hooks.show(response);
                        }
                    }, remaining);
                }, function () {
                    // Ignore: the overlay is best-effort and must never disturb playback.
                });
            },
            onResume: function () {
                cancel();
                hooks.hide();
            }
        };
    }

    function fetchNowPlaying(apiClient) {
        return Promise.resolve(apiClient.ajax({ type: 'GET', url: apiClient.getUrl('CastOverlay/NowPlaying') }))
            .then(function (res) {
                if (!res || res.status === 204) {
                    return null;
                }

                return typeof res.json === 'function' ? res.json() : res;
            })
            .catch(function () {
                return null;
            });
    }

    function ensureStyles(doc) {
        if (doc.getElementById(STYLE_ID)) {
            return;
        }

        var style = el(doc, 'style');
        style.id = STYLE_ID;
        style.textContent = STYLES;
        doc.head.appendChild(style);
    }

    function hideOverlay(doc) {
        var existing = doc.getElementById(OVERLAY_ID);
        if (existing) {
            existing.remove();
        }
    }

    function showOverlay(doc, video, apiClient, response) {
        hideOverlay(doc);
        ensureStyles(doc);
        var overlay = render(doc, response, function (member) {
            return imageUrl(apiClient, member);
        });

        // Directly after the video container: above the video, below the player controls.
        var container = video.closest('.videoPlayerContainer');
        if (container && container.parentNode) {
            container.insertAdjacentElement('afterend', overlay);
        } else {
            doc.body.appendChild(overlay);
        }

        // Start below the player's header, whose height varies with title length and screen size.
        // Jellyfin 12 renders a legacy and a React header; hidden ones measure zero.
        var headers = doc.querySelectorAll('.skinHeader');
        var headerBottom = 0;
        for (var i = 0; i < headers.length; i++) {
            headerBottom = Math.max(headerBottom, headers[i].getBoundingClientRect().bottom);
        }
        var paddingTop = parseFloat(doc.defaultView.getComputedStyle(overlay).paddingTop) || 0;
        if (headerBottom + HEADER_GAP > paddingTop) {
            overlay.style.paddingTop = (headerBottom + HEADER_GAP) + 'px';
        }

        // Force a style flush so the opacity transition runs.
        void overlay.offsetWidth;
        overlay.classList.add('castOverlay-visible');
    }

    function attach(win, video) {
        if (video.__castOverlay) {
            return;
        }

        var doc = win.document;
        var controller = createController({
            fetchCast: function () {
                return win.ApiClient ? fetchNowPlaying(win.ApiClient) : Promise.resolve(null);
            },
            show: function (response) {
                showOverlay(doc, video, win.ApiClient, response);
            },
            hide: function () {
                hideOverlay(doc);
            },
            isPaused: function () {
                return video.paused && video.isConnected;
            },
            now: function () {
                return Date.now();
            },
            setTimeout: function (fn, ms) {
                return win.setTimeout(fn, ms);
            },
            clearTimeout: function (id) {
                win.clearTimeout(id);
            }
        });

        video.__castOverlay = controller;
        video.addEventListener('pause', function () {
            // jellyfin-web pauses before tearing down at the end of playback; skip that.
            if (!video.ended) {
                controller.onPause();
            }
        });
        HIDE_EVENTS.forEach(function (name) {
            video.addEventListener(name, controller.onResume);
        });
    }

    function init(win) {
        var doc = win.document;

        function scan() {
            var videos = doc.querySelectorAll(VIDEO_SELECTOR);
            for (var i = 0; i < videos.length; i++) {
                attach(win, videos[i]);
            }

            // Leaving the player removes the video without a reliable event.
            if (videos.length === 0) {
                hideOverlay(doc);
            }
        }

        new win.MutationObserver(scan).observe(doc.body, { childList: true, subtree: true });
        scan();
        win.__castOverlayLoaded = true;
        console.debug('[CastOverlay] client script loaded');
    }

    var api = {
        initials: initials,
        imageUrl: imageUrl,
        render: render,
        createController: createController,
        fetchNowPlaying: fetchNowPlaying,
        init: init
    };

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else if (root.document) {
        if (root.document.body) {
            init(root);
        } else {
            root.document.addEventListener('DOMContentLoaded', function () {
                init(root);
            });
        }
    }
})(typeof window !== 'undefined' ? window : this);
