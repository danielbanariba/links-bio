// YouTube player island — GLOBAL + PERSISTENT across client-side navigation.
//
// Originally ported from the Reflex `_PLAYER_JS` IIFE, this island used to be
// rendered per-album-page with build-time props and mounted ONCE per page. With
// Astro View Transitions (<ClientRouter />) the metal-archive section is now a
// single client-side app: this island is rendered from Navbar.astro with
// `transition:persist`, so the SAME instance (and its YT.Player) survives every
// navigation — audio keeps playing while the user browses, like a real music app.
//
// It owns the entire interactive surface: the YT iframe (#yt-player inside
// #mini-player, which lives in the #np-dock), the now-playing bar, the "Up next"
// list and the overlay states (loader / error / timeout / buffering).
//
// PLAY FROM ANY CARD + QUEUE:
//   Every AlbumCard with a video renders a <button data-play-card> next to its
//   link. A click builds a QUEUE of albums from the nearest [data-queue] row or
//   grid (else every [data-play-card] on the page), in DOM order, starting at
//   the pressed card. When an album ends — or cannot be embedded (YT errors
//   2/5/100/101/150) — the next one plays; at the end playback stops. Prev/next
//   on the bar move between ALBUMS. The queue logic itself is pure: lib/queue.ts.
//   The queue lives in this persisted island, so it survives navigation.
//
// VISIBILITY (YouTube embed rules: viewport >= 200x200 while playing, and the
// player must be visible for autoplay): the dock and the bar are hidden until
// the first play. The iframe is still RENDERED off-screen (never display:none)
// so it can be cued. The same click handler that starts playback sets
// #np-root[data-open], which makes the bar and the video visible; closing (x)
// stops playback, removes data-open and clears the queue. The state lives on
// that persisted element (not on <body>, which ClientRouter replaces).
//
// DATA MODEL:
//   - An album page renders a JSON data island:
//       <script type="application/json" id="metal-np-data">{ videoId, ... }</script>
//     with the album, its tracklist and (via the tracklist) per-track seeking.
//   - Cards carry the same facts as data attributes (video id, band, title...).
//   Tracks are only known on the album page (or after playing from it), so the
//   bar shows a track name only then; otherwise it shows the album.
//
// LIFECYCLE — CRITICAL because transition:persist means useEffect runs ONCE:
//   - useEffect (once): load the YT API, attach the delegated document click
//     handler, start the 1s progress interval, add the astro:page-load listener.
//   - astro:page-load: if NO player is built yet and the page has something to
//     play (its album, else its first card) and window.YT is ready, BUILD the
//     player CUED with that video (cueing needs no user gesture). If a player
//     already exists, DON'T touch it (keep current playback).
//   - PLAY (click): the player is already built+cued, so loadVideoById() runs
//     SYNCHRONOUSLY inside the click handler — the user-gesture is preserved
//     so autoplay is allowed. THIS IS THE #1 THING THAT BREAKS IF DONE WRONG.
//
// WHAT WAS PRESERVED EXACTLY:
//   - playerVars, the buffering spinner, the 1s progress tick (only while
//     state===1) with per-track auto-advance, the 8s API-load timeout + retry,
//     the class-based multi-surface sync and the share() feedback.

import { useEffect, useRef } from 'preact/hooks';
import {
  buildQueue,
  nextIndex,
  prevIndex,
  markUnplayable,
  withIndex,
  upNext,
  type Queue,
} from '../lib/queue.js';

interface PlayerTrack {
  idx: number;
  name: string;
  seconds: number;
}

// Shape of the JSON the album page renders into #metal-np-data.
interface NpData {
  videoId: string;
  albumId?: number;
  youtubeUrl: string;
  albumColor: string;
  albumTitle: string;
  bandName: string;
  coverThumb: string;
  tracks: PlayerTrack[];
}

// One album in the play queue. Built from a card's data attributes or from the
// album page's NpData; carries everything the bar and "Up next" paint.
interface QItem {
  videoId: string;
  albumId: string;
  band: string;
  title: string;
  thumb: string;
  href: string;
  youtubeUrl: string;
  color: string;
}

// A play requested before the player could take it. Playback starts only from
// onReady consuming this, so a close (x) that clears it cancels the start; and
// startSeconds is the position the request asked for (a tracklist row), which
// a later row click may still move while the iframe boots.
interface PendingPlay {
  data: NpData;
  startSeconds: number;
}

// Props spread onto the dock while it is closed: `inert` keeps the off-screen
// iframe and its links out of the tab order and the accessibility tree.
const INERT = { inert: true } as Record<string, unknown>;

// Minimal YT typings — the IFrame API is loaded at runtime, no @types package.
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function Player() {
  // The YT.Player instance and the currently-active track index. Refs (not
  // state) because changing them must never trigger a Preact re-render — the
  // now-playing UI is updated imperatively, which keeps the autoplay path
  // synchronous (no await/render between the click and playVideo()).
  const playerRef = useRef<any>(null);
  const currentIdxRef = useRef<number>(-1);
  const apiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // The videoId currently loaded into the player, and the tracks of the album
  // that is PLAYING (not necessarily the page being viewed). Stored so prev/next
  // and per-track auto-advance work even after navigating away from that album.
  const loadedVideoIdRef = useRef<string>('');
  const playingTracksRef = useRef<PlayerTrack[]>([]);

  // The play queue (albums) and a video requested before the player could take
  // it (iframe still booting): loaded as soon as the player is ready.
  const queueRef = useRef<Queue<QItem> | null>(null);
  const pendingRef = useRef<PendingPlay | null>(null);

  // Refs to the now-playing bar nodes we mutate imperatively.
  const rootRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const dockTitleRef = useRef<HTMLAnchorElement>(null);
  const dockBandRef = useRef<HTMLAnchorElement>(null);
  const upNextSecRef = useRef<HTMLElement>(null);
  const upNextListRef = useRef<HTMLOListElement>(null);
  const npNameRef = useRef<HTMLAnchorElement>(null);
  const npArtistRef = useRef<HTMLSpanElement>(null);
  const npCoverRef = useRef<HTMLImageElement>(null);
  const npYoutubeRef = useRef<HTMLAnchorElement>(null);
  const npGlyphRef = useRef<HTMLSpanElement>(null);
  const npSpinnerRef = useRef<HTMLSpanElement>(null);
  const npProgressRef = useRef<HTMLDivElement>(null);
  const npProgressFillRef = useRef<HTMLDivElement>(null);
  const miniPlayerRef = useRef<HTMLDivElement>(null);
  const ytHostRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<HTMLDivElement>(null);
  const ytErrorLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // ─── read the current page's album data island (#metal-np-data) ──────────
    // Returns null on pages with no playable album (browse, forms, facets).
    const readNpData = (): NpData | null => {
      const el = document.getElementById('metal-np-data');
      if (!el || !el.textContent) return null;
      try {
        const data = JSON.parse(el.textContent) as NpData;
        if (!data || !data.videoId) return null;
        return data;
      } catch {
        return null;
      }
    };

    // ─── cards / page data → queue items ────────────────────────────────────
    const ytWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
    const itemFromCard = (el: HTMLElement): QItem | null => {
      const d = el.dataset;
      if (!d.videoId) return null;
      return {
        videoId: d.videoId,
        albumId: d.albumId || '',
        band: d.band || '',
        title: d.title || '',
        thumb: d.thumb || '',
        href: d.href || '#',
        youtubeUrl: ytWatchUrl(d.videoId),
        color: '',
      };
    };
    const itemFromData = (d: NpData): QItem => ({
      videoId: d.videoId,
      albumId: d.albumId != null ? String(d.albumId) : '',
      band: d.bandName || '',
      title: d.albumTitle || '',
      thumb: d.coverThumb || '',
      href: d.albumId != null ? `/metal-archive/album/${d.albumId}` : window.location.pathname,
      youtubeUrl: d.youtubeUrl || ytWatchUrl(d.videoId),
      color: d.albumColor || '',
    });
    const dataFromItem = (it: QItem): NpData => ({
      videoId: it.videoId,
      youtubeUrl: it.youtubeUrl,
      albumColor: it.color,
      albumTitle: it.title,
      bandName: it.band,
      coverThumb: it.thumb,
      tracks: [],
    });
    // Every playable card under `scope`, in DOM order.
    const cardItems = (scope: ParentNode): QItem[] =>
      Array.from(scope.querySelectorAll<HTMLElement>('[data-play-card]'))
        .map(itemFromCard)
        .filter((i): i is QItem => !!i);
    // What to cue on page load so the first tap can play synchronously: this
    // page's album, else its first playable card. Null on pages with neither.
    const cueSource = (): NpData | null => {
      const data = readNpData();
      if (data) return data;
      const first = document.querySelector<HTMLElement>('[data-play-card]');
      const item = first ? itemFromCard(first) : null;
      return item ? dataFromItem(item) : null;
    };

    // ─── overlay helpers (loader / error / timeout) ─────────────────────────
    const show = (el: HTMLElement | null) => { if (el) el.style.display = 'flex'; };
    const hide = (el: HTMLElement | null) => { if (el) el.style.display = 'none'; };
    const hideAllOverlays = () => {
      hide(loaderRef.current);
      hide(errorRef.current);
      hide(timeoutRef.current);
    };

    // ─── multi-surface sync (Now Playing hero + the fixed bottom bar) ────────
    // The album page renders a big "now playing" hero AND the bottom bar, both
    // with play/pause + progress. We update EVERY matching element by class so
    // all control surfaces stay in lockstep no matter which one was pressed.
    const setAllProgress = (pct: string) => {
      document.querySelectorAll<HTMLElement>('.js-progress-fill').forEach((el) => {
        el.style.width = pct;
      });
      // Mirror the visual fill onto the accessible progressbar (read-only): the
      // role="progressbar" container exposes aria-valuenow for screen readers.
      const now = String(Math.round(parseFloat(pct) || 0));
      document.querySelectorAll('.js-progressbar').forEach((el) => {
        el.setAttribute('aria-valuenow', now);
      });
    };
    const setPP = (state: 'playing' | 'paused' | 'buffering' | 'error') => {
      document.querySelectorAll('.js-pp').forEach((el) => {
        el.setAttribute('data-state', state);
        // aria-pressed reflects whether playback is active so the SR announces
        // play/pause. "buffering" is transitional toward playing -> pressed.
        // "error" means nothing is playing, same as "paused".
        el.setAttribute('aria-pressed', state === 'playing' || state === 'buffering' ? 'true' : 'false');
      });
    };
    // R3-004: the ONLY way a .js-pp control may show data-state="error" is
    // through setPP('error') above, so it is always cleared the same way any
    // other state is. clearPPError() resets JUST the controls that are
    // currently showing a stale error back to "paused" -- used on retry, on
    // loading a different video, and on every page load/navigation, without
    // ever touching a control that is legitimately "playing"/"buffering"
    // (e.g. the persistent now-playing bar mid-playback across a nav).
    const clearPPError = () => {
      document.querySelectorAll('.js-pp[data-state="error"]').forEach((el) => {
        el.setAttribute('data-state', 'paused');
        el.setAttribute('aria-pressed', 'false');
      });
    };
    const fmtTime = (s: number) => {
      if (!Number.isFinite(s) || s < 0) s = 0;
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    };
    const setTimes = (cur: number, dur: number) => {
      document.querySelectorAll('.js-time-current').forEach((el) => { el.textContent = fmtTime(cur); });
      if (dur > 0) {
        document.querySelectorAll('.js-time-total').forEach((el) => { el.textContent = fmtTime(dur); });
      }
    };
    const setNpTitle = (name: string) => {
      if (!name) return;
      document.querySelectorAll('.js-np-title').forEach((el) => { el.textContent = name; });
      // Announce the new track in the polite live region so the player is no
      // longer "mute" for screen readers. The node lives in the persistent
      // render below (#np-live) so it survives navigation.
      const live = document.getElementById('np-live');
      if (live) live.textContent = `Now playing: ${name}`;
    };

    // ─── active-row highlight (visual .track-active + a11y aria-current) ─────
    // Single source of truth so every place that highlights a row keeps the
    // class and aria-current in lockstep. Clears both on all rows, then sets
    // both on the target (when present on the current page).
    const clearActiveRows = () => {
      document.querySelectorAll('[data-track-idx]').forEach((r) => {
        r.classList.remove('track-active');
        r.removeAttribute('aria-current');
      });
    };
    const markRowActive = (rowEl: Element | null) => {
      if (!rowEl) return;
      rowEl.classList.add('track-active');
      rowEl.setAttribute('aria-current', 'true');
    };

    // ─── now-playing button glyph <-> spinner (buffering) ───────────────────
    const npSetGlyph = (ch: string) => {
      const g = npGlyphRef.current;
      const sp = npSpinnerRef.current;
      if (g) { g.textContent = ch; g.style.display = ''; }
      if (sp) sp.style.display = 'none';
      setPP(ch === '⏸' ? 'playing' : 'paused');
    };
    const npSetBuffering = () => {
      const g = npGlyphRef.current;
      const sp = npSpinnerRef.current;
      if (g) g.style.display = 'none';
      if (sp) sp.style.display = 'block';
      npProgressRef.current?.classList.add('np-loading');
      setPP('buffering');
    };
    const npClearBuffering = () => {
      npProgressRef.current?.classList.remove('np-loading');
    };

    // ─── 8s API-load timeout (slow/saturated network) ───────────────────────
    const clearApiTimeout = () => {
      if (apiTimeoutRef.current) { clearTimeout(apiTimeoutRef.current); apiTimeoutRef.current = null; }
    };
    const armApiTimeout = () => {
      clearApiTimeout();
      if (window.YT && window.YT.Player) return;
      // #3: a visitor whose network/firewall/extension blocks youtube.com must
      // still reach the loader, the 8s timeout overlay and its Retry button.
      // They live in the dock, which stays rendered (off-screen) before the
      // first play and becomes visible when it starts, so arming them here is
      // enough -- no separate reveal step.
      show(loaderRef.current);
      apiTimeoutRef.current = setTimeout(() => {
        // R3-005: whichever branch this takes, the loader must not be left
        // spinning. If the API became ready without clearApiTimeout() having
        // run yet (e.g. onYouTubeIframeAPIReady is still mid-flight), there is
        // nothing useful to show here -- cueFromPage()/onReady will take over
        // and hide it properly. Hiding it unconditionally first, then only
        // showing the timeout overlay when the API is genuinely still not
        // ready, means a spinner-only mini-player is never left behind.
        hide(loaderRef.current);
        if (window.YT && window.YT.Player) return;
        show(timeoutRef.current);
      }, 8000);
    };

    // ─── theme the player chrome (color only — safe while merely cued) ───────
    const themePlayer = (color: string) => {
      if (!color) return;
      miniPlayerRef.current?.style.setProperty('--album-color', color);
      document.getElementById('now-playing-bar')?.style.setProperty('--album-color', color);
    };

    // ─── paint the bar + dock for the album that just STARTED playing ────────
    const currentItem = (): QItem | null => {
      const q = queueRef.current;
      return q ? q.items[q.index] || null : null;
    };
    // First line of the bar: the active track when the tracks are known (album
    // page), else the album. The second line carries the band, plus the album
    // when the first line is a track. The first line links to the album page.
    const setBarName = (trackName: string) => {
      const item = currentItem();
      if (!item) return;
      if (npNameRef.current) npNameRef.current.textContent = trackName || item.title;
      if (npArtistRef.current) {
        npArtistRef.current.textContent = trackName ? `${item.band} · ${item.title}` : item.band;
      }
    };
    const paintBar = (item: QItem) => {
      if (npCoverRef.current) {
        npCoverRef.current.src = item.thumb;
        npCoverRef.current.style.visibility = item.thumb ? 'visible' : 'hidden';
      }
      if (npNameRef.current) npNameRef.current.href = item.href;
      if (npYoutubeRef.current) npYoutubeRef.current.href = item.youtubeUrl;
      if (ytErrorLinkRef.current) ytErrorLinkRef.current.href = item.youtubeUrl;
      if (dockTitleRef.current) {
        dockTitleRef.current.textContent = item.title;
        dockTitleRef.current.href = item.href;
      }
      if (dockBandRef.current) {
        dockBandRef.current.textContent = item.band;
        dockBandRef.current.href = `/metal-archive/browse?q=${encodeURIComponent(item.band)}`;
      }
      themePlayer(item.color || '');
      setBarName('');
    };

    // "Up next": the next 3 playable albums, each a button that jumps to it.
    // Built with createElement/textContent: titles are data, never markup.
    const paintUpNext = () => {
      const list = upNextListRef.current;
      if (!list) return;
      list.textContent = '';
      const q = queueRef.current;
      const items = q ? upNext(q, 3) : [];
      for (const it of items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'np-up';
        btn.setAttribute('data-np-jump', String(q ? q.items.indexOf(it) : -1));
        btn.setAttribute('aria-label', `Play ${it.title} by ${it.band}`);
        if (it.thumb) {
          const img = document.createElement('img');
          img.className = 'np-up__cover';
          img.src = it.thumb;
          img.alt = '';
          img.width = 44;
          img.height = 44;
          btn.appendChild(img);
        }
        const text = document.createElement('span');
        text.className = 'np-up__text';
        const title = document.createElement('span');
        title.className = 'np-up__title';
        title.textContent = it.title;
        const band = document.createElement('span');
        band.className = 'np-up__band';
        band.textContent = it.band;
        text.append(title, band);
        btn.appendChild(text);
        const li = document.createElement('li');
        li.appendChild(btn);
        list.appendChild(li);
      }
      if (upNextSecRef.current) upNextSecRef.current.hidden = items.length === 0;
    };

    // Prev/next are album-level and only meaningful once a queue exists. Also
    // re-run on every navigation: the album page's own copies are fresh markup.
    const updateTransport = () => {
      const q = queueRef.current;
      const hasNext = !!q && nextIndex(q) >= 0;
      document.querySelectorAll<HTMLButtonElement>('[data-np-next]').forEach((b) => { b.disabled = !hasNext; });
      document.querySelectorAll<HTMLButtonElement>('[data-np-prev]').forEach((b) => { b.disabled = !q; });
    };

    // The column on desktop starts below the (sticky) navbar, whose height varies.
    const syncDockTop = () => {
      const nav = document.querySelector<HTMLElement>('.navbar');
      if (nav && dockRef.current) dockRef.current.style.setProperty('--np-top', `${nav.offsetHeight}px`);
    };
    // The open/closed state lives on #np-root, a PERSISTED element: <body> is
    // replaced by ClientRouter on every navigation, so a class there would be lost.
    const isOpen = () => !!rootRef.current && rootRef.current.hasAttribute('data-open');
    const openPlayer = () => {
      rootRef.current?.setAttribute('data-open', '');
      dockRef.current?.removeAttribute('inert');
      syncDockTop();
    };

    // ─── build the YT.Player ────────────────────────────────────────────────
    // Always built CUED (autoplay=0): playback starts only from onReady consuming
    // a still-pending request (pendingRef). An autoplay playerVar would start the
    // video at iframe load, before onReady, where a close (x) cannot stop it.
    const buildPlayer = (data: NpData) => {
      const el = ytHostRef.current;
      if (!el) return;
      if (!data.videoId || !window.YT || !window.YT.Player) return;

      // API available — cancel the slow-network timeout.
      clearApiTimeout();
      if (el.querySelector('iframe')) return; // already built

      loadedVideoIdRef.current = data.videoId;
      playingTracksRef.current = data.tracks || [];
      // Tint the player with the cued album's color. The dock and the bar stay
      // hidden until the first play (startItem opens them), so nothing to reveal.
      if (miniPlayerRef.current && data.albumColor) {
        miniPlayerRef.current.style.setProperty('--album-color', data.albumColor);
      }
      // Point the error-overlay "Open on YouTube" link at the cued album now, so
      // a video that fails to EMBED on cue (before any play) still links out.
      if (ytErrorLinkRef.current) ytErrorLinkRef.current.href = data.youtubeUrl || '#';

      playerRef.current = new window.YT.Player(el, {
        width: '100%',
        height: '100%',
        videoId: data.videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          iv_load_policy: 3,
          fs: 0,
          showinfo: 0,
          enablejsapi: 1,
          autoplay: 0,
        },
        events: {
          onReady: () => {
            hideAllOverlays();
            // A play requested while the iframe was still booting, at the
            // position it asked for. Nothing pending (never requested, or closed
            // with the x meanwhile) leaves the player cued and silent.
            const pend = pendingRef.current;
            if (!pend) return;
            pendingRef.current = null;
            try {
              playerRef.current?.loadVideoById({ videoId: pend.data.videoId, startSeconds: pend.startSeconds });
            } catch { /* ignore */ }
          },
          onError: () => {
            // 2 invalid param, 5 HTML5 error, 100 removed/private,
            // 101/150 embedding disabled. Any of these = unplayable here:
            // with a queue, skip to the next album; only when there is none
            // (or it was the last one) show the overlay.
            if (skipUnplayable()) return;
            hide(loaderRef.current);
            hide(timeoutRef.current);
            show(errorRef.current);
            npClearBuffering();
            // #9: the corner overlay used to be the ONLY visible feedback --
            // the clicked control (e.g. the hero play button) kept its normal
            // idle glyph the whole time. npSetGlyph('▶') would call setPP()
            // with "paused", so call setPP('error') directly instead -- every
            // .js-pp control gets its own "error" state (R3-004: routed
            // through setPP, same as every other state, instead of writing
            // the attribute directly and bypassing it).
            setPP('error');
          },
          onStateChange: (e: any) => {
            if (e.data === 1 || e.data === 3) {
              hide(errorRef.current);
              hide(timeoutRef.current);
            }
            if (e.data === 3) { npSetBuffering(); return; }   // buffering
            npClearBuffering();
            if (e.data === 1) { npSetGlyph('⏸'); }            // playing
            else if (e.data === 2) { npSetGlyph('▶'); }       // paused
            else if (e.data === 0) {                          // ended (whole video)
              npSetGlyph('▶');
              // Single-video albums end here. Fill the bar (we reached the end)
              // rather than leaving it mid-track.
              setAllProgress('100%');
              // Go on to the next album by itself; at the end of the queue stop.
              const q = queueRef.current;
              const n = q ? nextIndex(q) : -1;
              if (n >= 0) goTo(n);
            }
          },
        },
      });
    };

    // ─── lazy-cue on page load ──────────────────────────────────────────────
    // Build the player CUED (no autoplay, no gesture needed) so the very first
    // click can play synchronously. Only runs when nothing is built yet. Cues
    // the album of the page, else the page's first playable card. A play that
    // arrived before any player existed (pendingRef) builds with ITS album and
    // stays pending: onReady starts it, unless a close (x) cleared it first.
    const cueFromPage = () => {
      if (playerRef.current) return;             // already have a player — leave playback alone
      const pend = pendingRef.current;
      const data = pend ? pend.data : cueSource();
      if (!data) return;                          // nothing playable on this page
      if (!window.YT || !window.YT.Player) return; // API not ready yet — onYouTubeIframeAPIReady retries
      // Show the loader while the iframe boots; onReady/onError hide the overlays.
      show(loaderRef.current);
      buildPlayer(data);
    };

    // ─── retry (re-inject the API script if the first load failed) ──────────
    const retryPlayer = () => {
      hide(timeoutRef.current);
      hide(errorRef.current);
      clearPPError();
      show(loaderRef.current);
      if (window.YT && window.YT.Player) { cueFromPage(); return; }
      const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
      armApiTimeout();
    };

    // ─── reset the progress fill immediately on track change ────────────────
    // Without this the bar keeps the OLD track's width until the next 1s tick,
    // so jumping to another track looks like the progress "didn't move".
    const npResetProgress = () => {
      setAllProgress('0%');
    };

    // ─── the single source of truth for "make track N the active one" ───────
    // Click, prev/next, play-album and auto-advance ALL funnel through here so
    // the now-playing name, the active-row highlight, currentIdxRef and the
    // progress bar are updated identically no matter how the change was
    // triggered.
    //
    // CRITICAL: seekTo + playVideo run synchronously here. No await before the
    // play call, no fetch, no backend round-trip — when this is reached from a
    // click the user-gesture is preserved so the browser permits autoplay.
    const activateRow = (rowEl: Element) => {
      const sec = parseInt(rowEl.getAttribute('data-seconds') || '0', 10) || 0;
      const idx = parseInt(rowEl.getAttribute('data-track-idx') || '-1', 10);
      const p = playerRef.current;
      if (p && typeof p.seekTo === 'function') {
        try {
          p.seekTo(sec, true);
          p.playVideo();
        } catch {
          // swallow — a not-yet-ready player simply ignores the gesture
        }
      } else if (pendingRef.current) {
        // The iframe is still booting and a start is pending: move it to this row,
        // so onReady plays from here and not from the earlier request. Only a
        // request for THIS page's album is ours to move: a pending start for any
        // other album keeps its own position.
        const page = readNpData();
        if (page && pendingRef.current.data.videoId === page.videoId) pendingRef.current.startSeconds = sec;
      }
      clearActiveRows();
      markRowActive(rowEl);
      currentIdxRef.current = idx;
      npResetProgress();

      const nameNode = rowEl.querySelector('[data-track-name]');
      const name = nameNode ? (nameNode.textContent || '').trim() : '';
      if (name) setBarName(name);
      setNpTitle(name);   // big hero title follows the active track
    };

    // Click-path alias kept for readability at the call site.
    const playTrackAt = (rowEl: Element) => activateRow(rowEl);

    // Find a row element by its data-track-idx and activate it.
    const selectTrackByIndex = (idx: number): boolean => {
      const target = document.querySelector(`[data-track-idx="${idx}"]`);
      if (!target) return false;
      activateRow(target);
      return true;
    };

    // ─── make an album from the queue the one that plays ───────────────────
    // The single funnel for card ▶, the album page's Play, next/prev, auto-next,
    // error skips and "Up next" jumps. Tracks (and the tracklist rows) are only
    // known for the album of the page being viewed; any other album starts at 0
    // and shows its album name.
    //
    // CRITICAL: openPlayer() and loadVideoById() run synchronously, so when this
    // is reached from a click the user-gesture is preserved and the browser
    // permits autoplay, and the video is already visible when playback starts.
    const trackNameAt = (idx: number, tracks: PlayerTrack[]): string => {
      if (idx < 0) return '';
      const node = document.querySelector(`[data-track-idx="${idx}"] [data-track-name]`);
      const fromRow = node ? (node.textContent || '').trim() : '';
      return fromRow || (tracks[idx] ? tracks[idx].name || '' : '');
    };
    const startItem = (item: QItem, opts: { startSeconds?: number; trackIdx?: number } = {}) => {
      const pageData = readNpData();
      const onItsPage = !!pageData && pageData.videoId === item.videoId;
      const tracks = onItsPage && pageData ? pageData.tracks || [] : [];
      const idx = onItsPage ? (opts.trackIdx ?? (tracks.length ? 0 : -1)) : -1;
      const startSeconds = opts.startSeconds ?? (idx >= 0 && tracks[idx] ? tracks[idx].seconds || 0 : 0);

      openPlayer();
      const p = playerRef.current;
      if (p && typeof p.loadVideoById === 'function') {
        try {
          p.loadVideoById({ videoId: item.videoId, startSeconds });
        } catch { /* ignore — player not ready */ }
      } else {
        // No player yet, or its iframe is still booting: load it as soon as it can,
        // at the requested position and with the album's tracks.
        pendingRef.current = { data: { ...dataFromItem(item), tracks }, startSeconds };
        if (!p) cueFromPage();
      }
      // R3-004: loading a different video makes any previous error moot --
      // clear it the same way retryPlayer() does, instead of letting it
      // linger on the controls until the new video happens to error too.
      clearPPError();
      hide(errorRef.current);
      loadedVideoIdRef.current = item.videoId;
      playingTracksRef.current = tracks;
      currentIdxRef.current = idx;
      npResetProgress();
      paintBar(item);

      clearActiveRows();
      let name = '';
      if (idx >= 0) {
        const row = document.querySelector(`[data-track-idx="${idx}"]`);
        if (row) markRowActive(row);
        name = trackNameAt(idx, tracks);
      }
      setBarName(name);
      if (name) setNpTitle(name);
      paintUpNext();
      updateTransport();
    };

    const goTo = (i: number) => {
      const q = queueRef.current;
      if (!q || !q.items[i]) return;
      queueRef.current = withIndex(q, i);
      startItem(q.items[i]);
    };
    const goNext = () => {
      const q = queueRef.current;
      const n = q ? nextIndex(q) : -1;
      if (n >= 0) goTo(n);
    };
    const goPrev = () => {
      const q = queueRef.current;
      if (!q) return;
      const n = prevIndex(q);
      if (n >= 0) goTo(n);
      else startItem(q.items[q.index]);   // first album: restart it
    };

    // A video that cannot be embedded (YT errors 2/5/100/101/150): mark it and go
    // to the next playable album. Returns false at the end of the queue (or with
    // no queue), where the caller shows the "Video unavailable" overlay instead.
    const skipUnplayable = (): boolean => {
      const q = queueRef.current;
      if (!q || !q.items[q.index]) return false;
      const marked = markUnplayable(q, q.items[q.index].videoId);
      queueRef.current = marked;
      const n = nextIndex(marked);
      if (n < 0) { paintUpNext(); updateTransport(); return false; }
      goTo(n);
      return true;
    };

    // Play the album of the page being viewed: the queue is this album first,
    // then the other playable cards on the page (the album's similar albums).
    const startPageAlbum = (pageData: NpData, startSeconds: number, idx: number) => {
      const item = itemFromData(pageData);
      queueRef.current = buildQueue([item, ...cardItems(document)], item.videoId);
      startItem(item, { startSeconds, trackIdx: idx });
    };

    // × on the bar: stop, hide the bar and the video, forget the queue.
    const closePlayer = () => {
      const p = playerRef.current;
      if (p && typeof p.stopVideo === 'function') {
        try { p.stopVideo(); } catch { /* ignore */ }
      }
      rootRef.current?.removeAttribute('data-open');
      dockRef.current?.setAttribute('inert', '');
      queueRef.current = null;
      pendingRef.current = null;
      loadedVideoIdRef.current = '';
      playingTracksRef.current = [];
      currentIdxRef.current = -1;
      clearActiveRows();
      npResetProgress();
      hideAllOverlays();
      setPP('paused');
      paintUpNext();
      updateTransport();
    };

    // Landed on the album that is playing: its tracklist is known now, so show
    // and highlight the track the video is currently in (when it has timestamps).
    const syncPlayingTrack = (data: NpData) => {
      if (data.tracks && data.tracks.length) playingTracksRef.current = data.tracks;
      const tracks = playingTracksRef.current;
      let idx = currentIdxRef.current;
      if (idx < 0 && tracks.some((t) => (t.seconds || 0) > 0)) {
        let cur = 0;
        try { cur = playerRef.current.getCurrentTime() || 0; } catch { /* ignore */ }
        tracks.forEach((t, i) => { if ((t.seconds || 0) <= cur) idx = i; });
        currentIdxRef.current = idx;
      }
      if (idx < 0) return;
      const row = document.querySelector(`[data-track-idx="${idx}"]`);
      if (row) markRowActive(row);
      const name = trackNameAt(idx, tracks);
      if (name) { setBarName(name); setNpTitle(name); }
    };

    // Is the album on the CURRENT page the same one currently loaded/playing?
    const pageIsPlayingAlbum = (data: NpData | null): boolean =>
      !!data && !!loadedVideoIdRef.current && data.videoId === loadedVideoIdRef.current;

    const togglePlay = () => {
      const p = playerRef.current;
      if (!p) return;
      let state = -1;
      try { state = p.getPlayerState(); } catch { /* ignore */ }
      if (state === 1) {
        try { p.pauseVideo(); } catch { /* ignore */ }
        return;
      }
      try { p.playVideo(); } catch { /* ignore */ }
    };

    // Tracks of the PLAYING album (survives navigation), falling back to the
    // current page's rows when nothing is playing yet.
    const playingTrackCount = () => {
      if (playingTracksRef.current.length) return playingTracksRef.current.length;
      return document.querySelectorAll('[data-track-idx]').length;
    };

    const playAlbum = () => {
      const first = document.querySelector('[data-track-idx]');
      if (first) { playTrackAt(first); return; }
      // No tracklist — just play the video from the start.
      const p = playerRef.current;
      if (p && typeof p.playVideo === 'function') {
        try { p.seekTo(0, true); } catch { /* ignore */ }
        p.playVideo();
      }
    };

    // Smart main button (the big Now Playing play/pause): toggles when something
    // is loaded, otherwise starts the album from the first track.
    const mainPlayPause = () => {
      const p = playerRef.current;
      if (!p) return;
      let state = -1;
      try { state = p.getPlayerState(); } catch { /* ignore */ }
      if (state === 1) { try { p.pauseVideo(); } catch { /* ignore */ } return; }   // playing -> pause
      if (state === 2 || state === 3) { try { p.playVideo(); } catch { /* ignore */ } return; } // paused/buffering -> resume
      playAlbum();   // unstarted / cued / ended -> start (keeps the row highlight)
    };

    // Share: native share sheet when available, else copy the URL — and ALWAYS
    // give visible feedback (the old version copied silently, so it looked dead).
    const share = async (btn: Element | null) => {
      const url = window.location.href;
      const title = document.title;
      if (navigator.share) {
        try { await navigator.share({ title, url }); return; } catch { return; }
      }
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      const label = btn ? btn.querySelector('span') : null;
      if (label) {
        const prev = label.textContent;
        label.textContent = 'Link copied';
        setTimeout(() => { label.textContent = prev; }, 1600);
      }
    };

    // Start-second of a track in the PLAYING album by index (auto-advance).
    const trackSeconds = (idx: number): number | null => {
      const t = playingTracksRef.current[idx];
      if (t) return t.seconds || 0;
      const row = document.querySelector(`[data-track-idx="${idx}"]`);
      if (!row) return null;
      return parseInt(row.getAttribute('data-seconds') || '0', 10) || 0;
    };

    // ─── progress bar tick — only while actually playing (state 1) ──────────
    // Also drives per-track auto-advance: these albums are ONE long video where
    // each "track" is a timestamp, so YT only fires `ended` (state 0) at the
    // very end of the video. To advance the now-playing name/highlight as the
    // video crosses each track boundary, we compare currentTime against the
    // NEXT track's start second here and re-activate the row when we pass it.
    const progressTick = () => {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      try {
        if (p.getPlayerState && p.getPlayerState() !== 1) return;
      } catch { return; }
      try {
        const dur = p.getDuration();
        const cur = p.getCurrentTime();
        if (!dur) return;
        const pct = Math.min(100, (cur / dur) * 100);
        setAllProgress(pct + '%');
        setTimes(cur, dur);

        // Auto-advance: if playback has crossed into the next track's range,
        // update the name + highlight (no seek — playback is already there).
        // Uses the PLAYING album's track list so it works even after navigating.
        const cnt = playingTrackCount();
        const cur_i = currentIdxRef.current;
        if (cnt > 1 && cur_i >= 0 && cur_i < cnt - 1) {
          const nextStart = trackSeconds(cur_i + 1);
          // Only meaningful when tracks actually carry distinct timestamps.
          if (nextStart && nextStart > 0 && cur >= nextStart) {
            currentIdxRef.current = cur_i + 1;
            // Highlight the new row only if it is on the page being viewed.
            const target = document.querySelector(`[data-track-idx="${cur_i + 1}"]`);
            let name = '';
            if (target) {
              clearActiveRows();
              markRowActive(target);
              const nameNode = target.querySelector('[data-track-name]');
              name = nameNode ? (nameNode.textContent || '').trim() : '';
            }
            if (!name) {
              const t = playingTracksRef.current[cur_i + 1];
              name = t ? t.name : '';
            }
            if (name) {
              setBarName(name);
              setNpTitle(name);
            }
          }
        }
      } catch { /* ignore */ }
    };
    progressIntervalRef.current = setInterval(() => {
      try { progressTick(); } catch { /* ignore */ }
    }, 1000);

    // ─── single delegated click handler (capture phase, like Reflex) ────────
    // CRITICAL: everything that triggers playback runs SYNCHRONOUSLY here so the
    // user-gesture is preserved and the browser allows autoplay.
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!t || !t.closest) return;
      // Retry sits inside #mini-player; handle first and stop so the click
      // doesn't trigger anything else.
      const retry = t.closest('[data-mp-retry]');
      if (retry) { e.stopPropagation(); retryPlayer(); return; }

      // ▶ on an album card: queue the card's row/grid (else every card on the
      // page), starting at this card. It is a <button>, never inside the card's
      // <a>, so no navigation to suppress.
      const cardBtn = t.closest<HTMLElement>('[data-play-card]');
      if (cardBtn) {
        const item = itemFromCard(cardBtn);
        if (!item) return;
        const scope = cardBtn.closest('[data-queue]') || document;
        queueRef.current = buildQueue(cardItems(scope), item.videoId);
        startItem(item);
        return;
      }

      // Transport that does NOT start a NEW album just acts on the player.
      const toggle = t.closest('[data-np-toggle]');
      if (toggle) { togglePlay(); return; }
      const prev = t.closest('[data-np-prev]');
      if (prev) { goPrev(); return; }
      const nxt = t.closest('[data-np-next]');
      if (nxt) { goNext(); return; }
      const jump = t.closest<HTMLElement>('[data-np-jump]');
      if (jump) { goTo(parseInt(jump.getAttribute('data-np-jump') || '-1', 10)); return; }
      const close = t.closest('[data-np-close]');
      if (close) { closePlayer(); return; }
      const shareBtn = t.closest('[data-share]');
      if (shareBtn) { share(shareBtn); return; }

      // Play actions on an album page: a track row, the "play album" button, or
      // the big main play/pause. They may target the album that is already
      // loaded and open (seek / toggle) OR start it: the first play on this page,
      // or a different album than the one loaded. Starting builds the queue.
      const row = t.closest('[data-track-idx]');
      const play = row ? null : t.closest('[data-play-album]');
      const main = row || play ? null : t.closest('[data-np-main]');
      if (!row && !play && !main) return;

      const pageData = readNpData();
      // A row or play button only means something on the page of a playable album.
      // A page with a tracklist but no video id has no #metal-np-data and nothing to
      // start: acting on its rows would seek the OTHER album that is loaded, or move
      // that album's pending start.
      if (!pageData) return;
      const needsStart = !pageIsPlayingAlbum(pageData) || !isOpen();
      const hasTracks = !!(pageData.tracks && pageData.tracks.length);

      if (row) {
        if (needsStart) {
          const idx = parseInt(row.getAttribute('data-track-idx') || '-1', 10);
          const sec = parseInt(row.getAttribute('data-seconds') || '0', 10) || 0;
          startPageAlbum(pageData, sec, idx);
          return;
        }
        playTrackAt(row);
        return;
      }
      if (needsStart) {
        // Play album / the big main button: start THIS album from its first track.
        startPageAlbum(pageData, hasTracks ? pageData.tracks[0].seconds || 0 : 0, hasTracks ? 0 : -1);
        return;
      }
      if (play) { playAlbum(); return; }
      if (main) { mainPlayPause(); return; }
    };
    document.addEventListener('click', onClick, true);

    // ─── per-navigation hook (initial load AND every client-side navigation) ──
    // With ClientRouter this fires after each swap. We use it to lazy-cue the
    // player from the new page's data island. If a player already exists we do
    // NOT touch it — playback continues across navigation (the whole point).
    const onPageLoad = () => {
      cueFromPage();
      updateTransport();
      syncDockTop();
      // R3-004: the hero .js-pp button on the page we just swapped in is
      // fresh markup (default "paused"), but the PERSISTENT now-playing-bar
      // toggle is the same DOM node from before the swap and keeps whatever
      // data-state it had. A stale "error" there would misrepresent this new
      // page as broken even though nothing has been attempted on it yet.
      // clearPPError() only touches controls actually showing "error" (never
      // "playing"/"buffering"), so it never interrupts audio still playing
      // across the navigation.
      clearPPError();
      // If the page we just landed on IS the album currently playing, sync the
      // active-row highlight (its rows are fresh markup after the swap) and the
      // track name, which is only known from this page's tracklist.
      const data = readNpData();
      if (data && isOpen() && pageIsPlayingAlbum(data)) syncPlayingTrack(data);
    };
    document.addEventListener('astro:page-load', onPageLoad);

    // ─── kick off the API load ──────────────────────────────────────────────
    // The previous onYouTubeIframeAPIReady (if any other island/page set one)
    // is preserved so we never clobber an unrelated callback.
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') { try { prevReady(); } catch { /* ignore */ } }
      clearApiTimeout();
      cueFromPage();
    };

    if (window.YT && window.YT.Player) {
      // API already present (e.g. SPA re-mount) — cue from whatever page we're on.
      cueFromPage();
    } else {
      // Inject the IFrame API once. If it's mid-load the existing tag is reused;
      // onYouTubeIframeAPIReady fires for everyone. Only arm the timeout when
      // the current page actually has an album to load.
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      }
      if (cueSource()) armApiTimeout();
    }
    updateTransport();
    syncDockTop();
    // Closed, the dock is off-screen: keep it out of the tab order until a play.
    if (!isOpen()) dockRef.current?.setAttribute('inert', '');
    window.addEventListener('resize', syncDockTop);

    // ─── teardown ───────────────────────────────────────────────────────────
    // In practice this island persists (transition:persist) for the whole
    // metal-archive session, so teardown only runs on a full document unload.
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('astro:page-load', onPageLoad);
      window.removeEventListener('resize', syncDockTop);
      clearApiTimeout();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
      }
      playerRef.current = null;
    };
    // Runs ONCE — the island persists across navigation via transition:persist,
    // so this effect must not depend on any per-page value (there are no props).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── render: dock (video + overlays + Up next) + now-playing bar ───────────
  // Everything sits in #np-root (display: contents). Before the first play the
  // dock is rendered off-screen (the iframe must exist to be cued) and the bar
  // is hidden; the first play sets #np-root[data-open]. The bar starts EMPTY and
  // is filled by paintBar() on every album start. --album-color is unset until
  // then (CSS falls back to the amber accent).
  return (
    <div id="np-root" ref={rootRef}>
      <aside id="np-dock" ref={dockRef} aria-label="Now playing video" {...INERT}>
        <div id="mini-player" ref={miniPlayerRef}>
          <div id="yt-player" ref={ytHostRef} style={{ width: '100%', height: '100%' }} />

          <div id="mini-player-loader" class="mp-overlay" ref={loaderRef} style={{ display: 'none' }}>
            <div class="mp-spinner" />
            <span style={{ color: 'var(--text-body)', fontSize: '0.72em', marginTop: '0.6em' }}>
              Loading player...
            </span>
          </div>

          <div id="mini-player-error" class="mp-overlay" ref={errorRef} style={{ display: 'none' }}>
            <span style={{ color: 'var(--text-header)', fontSize: '0.8em', fontWeight: 600 }}>
              Video unavailable
            </span>
            <span style={{ color: 'var(--text-footer)', fontSize: '0.7em', marginTop: '0.3em', textAlign: 'center' }}>
              This video cannot be played here.
            </span>
            <a
              ref={ytErrorLinkRef}
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--primary)', fontSize: '0.75em', textDecoration: 'none', marginTop: '0.6em', fontWeight: 600 }}
            >
              Open on YouTube ↗
            </a>
          </div>

          <div id="mini-player-timeout" class="mp-overlay" ref={timeoutRef} style={{ display: 'none' }}>
            <span style={{ color: 'var(--text-header)', fontSize: '0.78em', fontWeight: 600, textAlign: 'center' }}>
              The player is taking a while to load.
            </span>
            <span style={{ color: 'var(--text-footer)', fontSize: '0.7em', marginTop: '0.3em' }}>
              Check your internet connection.
            </span>
            <button
              type="button"
              data-mp-retry="1"
              style={{
                background: 'var(--primary)', color: 'var(--text-header)', border: 'none',
                cursor: 'pointer', fontSize: '0.72em', padding: '0.4em 1em',
                borderRadius: '2px', marginTop: '0.7em', fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        </div>

        {/* Desktop column only (hidden below 1100px by CSS): who is playing + what is next. */}
        <div class="np-dock__meta">
          <a class="np-dock__title" ref={dockTitleRef} href="#"></a>
          <a class="np-dock__band" ref={dockBandRef} href="#"></a>
        </div>
        <section class="np-upnext" ref={upNextSecRef} aria-label="Up next" hidden>
          <h2 class="np-upnext__h">Up next</h2>
          <ol class="np-upnext__list" ref={upNextListRef}></ol>
        </section>
      </aside>

      <div id="now-playing-bar">
        {/* left: cover + album (or track) / band */}
        <div class="np-left">
          <img id="now-playing-cover" class="np-cover" ref={npCoverRef} src="" alt="" style={{ visibility: 'hidden' }} />
          <div class="np-text">
            <a id="now-playing-name" ref={npNameRef} class="np-name" href="#"></a>
            <span id="now-playing-artist" ref={npArtistRef} class="np-artist"></span>
          </div>
        </div>

        {/* center: transport + progress. Prev/next move between albums in the queue. */}
        <div class="np-center">
          <div class="np-controls">
            <button type="button" class="np-icon-btn" aria-label="Previous album" data-np-prev="1">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M5 6h2v12H5zM19 6v12l-9-6z"/></svg>
            </button>
            <button type="button" id="now-playing-toggle" class="np-toggle js-pp" aria-label="Play or pause" data-np-toggle="1" data-state="paused">
              <svg class="ic ic-play" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>
              <svg class="ic ic-pause" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM14 5h4v14h-4z"/></svg>
              <span class="ic ic-spinner" aria-hidden="true"></span>
            </button>
            <button type="button" class="np-icon-btn" aria-label="Next album" data-np-next="1">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M17 6h2v12h-2zM5 6v12l9-6z"/></svg>
            </button>
          </div>
          <div id="now-playing-progress" ref={npProgressRef} class="np-progress">
            <div id="now-playing-progress-fill" ref={npProgressFillRef} class="np-progress-fill js-progress-fill" />
          </div>
        </div>

        {/* right: youtube link — full label on desktop, compact icon button on
            mobile (the label is hidden ≤767px, the icon stays tappable ≥44px) —
            and the close button. */}
        <div class="now-playing-right np-right">
          <a
            id="now-playing-youtube"
            ref={npYoutubeRef}
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            class="np-yt-link"
            aria-label="Watch on YouTube"
          >
            <svg class="np-yt-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M23 12s0-3.8-.5-5.6a3 3 0 0 0-2.1-2.1C18.6 3.8 12 3.8 12 3.8s-6.6 0-8.4.5A3 3 0 0 0 1.5 6.4C1 8.2 1 12 1 12s0 3.8.5 5.6a3 3 0 0 0 2.1 2.1c1.8.5 8.4.5 8.4.5s6.6 0 8.4-.5a3 3 0 0 0 2.1-2.1C23 15.8 23 12 23 12zM10 15.5v-7l6 3.5z"/></svg>
            <span class="np-yt-label">Watch on YouTube ↗</span>
          </a>
          <button type="button" class="np-icon-btn np-close" aria-label="Close player" data-np-close="1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
      </div>

      {/* Polite live region — announces the active track to screen readers when
          the now-playing title changes (setNpTitle writes here). Visually
          hidden; lives in the persistent render so it survives navigation. */}
      <span class="sr-only" aria-live="polite" id="np-live"></span>
    </div>
  );
}
