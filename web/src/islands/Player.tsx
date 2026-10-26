// YouTube player island — GLOBAL + PERSISTENT across client-side navigation.
//
// Rendered once from Footer.astro with `transition:persist`, so the SAME instance
// (and its YT.Player) survives every ClientRouter navigation: the music keeps
// playing while the listener browses, like a music app.
//
// It owns every surface of the player:
//   - the mini player bar (#now-playing-bar): album, band and track, prev / play /
//     next, open the full player, close (x), and a thin progress line;
//   - the desktop right panel while something plays (#np-dock): the video, the
//     album, then the queue (the album's tracks, then the next album);
//   - the now-playing view (#np-view): desktop and tablet show it in place of the
//     page, the phone as a full-screen sheet. Big art (the video), "Playing from",
//     title, band, meta, genre, Share / YouTube / Info, a progress bar cut into the
//     album's tracks, shuffle / prev / play / next / repeat, volume, the tracklist;
//   - the floating video tile (#np-tile, phone and tablet while the view is closed);
//   - the ONE YouTube iframe (#yt-player inside #mini-player) and its overlays.
//
// THE ONE IFRAME (lib/playerStage.ts): moving an iframe in the DOM reloads it, so
// #mini-player never moves. It is a fixed box laid over whichever slot is on
// screen (the panel, the view's art, the tile), sized to it on every change of
// surface, layout, size or position, and animated between slots. YouTube's embed
// rules hold on every surface: while it plays the player is at least 200x200,
// inside the viewport, not covered (nothing is above it) and not cropped (in a
// square slot the 16:9 video is shown whole, over the slot's blurred cover, or
// letterboxed by YouTube itself when the slot is too small for that).
//
// STATE lives on #np-root, a PERSISTED element (<body> is replaced on every
// navigation): data-active while an album is loaded (playing or paused),
// data-view while the now-playing view is open, data-surface where the video is.
// The attribute is data-active, not the pre-shell data-open: global.css (the
// bio's stylesheet, which cannot change) still lays out a docked video for
// [data-open], and styles/archive.css owns the shell's layout instead.
//
// PLAY FROM ANY CARD + QUEUE (lib/queue.ts, pure): a card's ▶ queues the cards of
// its nearest [data-queue] (else the page), in DOM order, starting at that card.
// When an album ends, or cannot be embedded (YT errors 2/5/100/101/150), the next
// one plays; at the end playback stops. Shuffle reorders what is still to come,
// repeat plays the album again. Prev/next move between ALBUMS; the album's tracks
// are seeked from the queue list, the progress bar and the album page.
//
// TRACKS: every album is ONE long video and a track is a start time in it
// (lib/segments.ts). The album page brings its own (#metal-np-data); any other
// album's come from /metal-archive/album/<id>.json (lib/albumInfo.ts), fetched
// when it starts. Without timestamps there are no segments: never invented ones.
//
// ACCENT (lib/accent.ts): while an album is in the player its accent is the
// whole archive's; otherwise the page's own, else the stylesheet's amber.
// paintAccent() writes it on <html> and on the incoming document before a swap.
//
// LIFECYCLE — CRITICAL because transition:persist means useEffect runs ONCE:
//   - useEffect: load the YT API, attach the delegated listeners, start the 1s
//     progress tick, follow astro:page-load / astro:before-swap.
//   - astro:page-load: with no player built yet and something to play on the page,
//     BUILD the player CUED (no gesture needed). An existing player is never touched.
//   - PLAY (click): the player is already cued, so loadVideoById() runs
//     SYNCHRONOUSLY inside the click handler and the browser allows the sound.
//     THIS IS THE #1 THING THAT BREAKS IF DONE WRONG: no await before it.

import { useEffect, useRef } from 'preact/hooks';
import {
  buildQueue,
  nextIndex,
  prevIndex,
  markUnplayable,
  withIndex,
  upNext,
  extendQueue,
  shuffleUpcoming,
  restoreOrder,
  afterEnd,
  leadWith,
  type Queue,
} from '../lib/queue.js';
import {
  ACCENT_VARS,
  accentDeclarations,
  decodeAccent,
  resolveAccent,
  type AccentTokens,
} from '../lib/accent.js';
import { ICONS, GLYPH_PLAY, GLYPH_PAUSE, type IconName } from '../lib/icons.js';
import { rememberRecent, browserStorage, RECENT_EVENT } from '../lib/recent.js';
import { coverArtElement } from '../lib/coverArtDom.js';
import { NOW_EVENT, type NowInfo } from '../lib/now.js';
import { loadAlbumInfo, type AlbumInfo } from '../lib/albumInfo.js';
import { trackSpans, trackAt, timeAtX, xAtTime, type Span, type Box } from '../lib/segments.js';
import {
  pickSurface,
  videoBox,
  fitsInside,
  nearestCorner,
  otherSide,
  tileAt,
  type Corner,
  type Layout,
  type Rect,
  type Surface,
} from '../lib/playerStage.js';

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
  accent?: string; // encoded accent tokens (lib/accent.ts encodeAccent)
  albumTitle: string; // as shown (lib/title.ts displayTitle)
  bandName: string;
  coverThumb: string;
  cover?: string; // square crop or YouTube frame (lib/coverDisplay.ts decides how to draw it)
  meta?: string; // "United States · 2016 · Deathcore"
  bandHref?: string; // the band's page, else a Browse search
  tracks: PlayerTrack[];
}

// One album in the play queue. Built from a card's data attributes or from the
// album page's NpData; carries everything the player's surfaces, the sidebar's
// Recent list and the home hero show.
interface QItem {
  videoId: string;
  albumId: string;
  band: string;
  title: string;
  thumb: string;
  cover: string;
  meta: string;
  bandHref: string;
  href: string;
  youtubeUrl: string;
  accent: AccentTokens | null;
}

// A play requested before the player could take it. Playback starts only from
// onReady consuming this, so a close (x) that clears it cancels the start; and
// startSeconds is the position the request asked for (a tracklist row), which
// a later row click may still move while the iframe boots.
interface PendingPlay {
  data: NpData;
  startSeconds: number;
}

// Where the queue came from, for the view's "Playing from".
interface Source {
  label: string;
  href: string;
}

// The glyph of a card's play button: ▶ while idle, ⏸ while that album plays.
const PLAY_PATH = GLYPH_PLAY;
const PAUSE_PATH = GLYPH_PAUSE;

// Props spread onto parts that start hidden: `inert` keeps them (and their links)
// out of the tab order and the accessibility tree until the player opens them.
const INERT = { inert: true } as Record<string, unknown>;

// Where the tile was last left, kept per browser (a convenience: storage may be
// unavailable, which only means the default corner).
const CORNER_KEY = 'ma:tile-corner';
const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];

// Minimal YT typings — the IFrame API is loaded at runtime, no @types package.
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** One line icon (lib/icons.ts), decorative: its control carries the name. */
function Ic({ name, cls }: { name: IconName; cls?: string }) {
  return (
    <svg
      class={cls ? `ma-i ${cls}` : 'ma-i'}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

export default function Player() {
  // The YT.Player instance and the active track index. Refs (not state) because
  // changing them must never trigger a Preact re-render — every surface is
  // updated imperatively, which keeps the autoplay path synchronous (no
  // await/render between the click and playVideo()).
  const playerRef = useRef<any>(null);
  const currentIdxRef = useRef<number>(-1);
  const apiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // The videoId currently loaded into the player, and the tracks of the album
  // that is PLAYING (not necessarily the page being viewed). Stored so the track
  // highlight and the queue work after navigating away from that album.
  const loadedVideoIdRef = useRef<string>('');
  const playingTracksRef = useRef<PlayerTrack[]>([]);

  // The play queue (albums) and a video requested before the player could take
  // it (iframe still booting): loaded as soon as the player is ready.
  const queueRef = useRef<Queue<QItem> | null>(null);
  // The [data-queue] element the queue was built from (null for any other source):
  // it can gain cards after that ("Load more" on Browse).
  const queueScopeRef = useRef<Element | null>(null);
  const pendingRef = useRef<PendingPlay | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const viewRef = useRef<HTMLElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const npNameRef = useRef<HTMLSpanElement>(null);
  const npArtistRef = useRef<HTMLSpanElement>(null);
  const npTrackRef = useRef<HTMLSpanElement>(null);
  const npArtRef = useRef<HTMLSpanElement>(null);
  const npProgressRef = useRef<HTMLDivElement>(null);
  const miniPlayerRef = useRef<HTMLDivElement>(null);
  const ytHostRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<HTMLDivElement>(null);
  const ytErrorLinkRef = useRef<HTMLAnchorElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Every surface of the player inside this island, by its data hook.
    const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));

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
        cover: d.cover || d.thumb || '',
        meta: d.meta || '',
        bandHref: d.bandHref || '',
        href: d.href || '#',
        youtubeUrl: ytWatchUrl(d.videoId),
        accent: decodeAccent(d.accent),
      };
    };
    const itemFromData = (d: NpData): QItem => ({
      videoId: d.videoId,
      albumId: d.albumId != null ? String(d.albumId) : '',
      band: d.bandName || '',
      title: d.albumTitle || '',
      thumb: d.coverThumb || '',
      cover: d.cover || d.coverThumb || '',
      meta: d.meta || '',
      bandHref: d.bandHref || '',
      href: d.albumId != null ? `/metal-archive/album/${d.albumId}` : window.location.pathname,
      youtubeUrl: d.youtubeUrl || ytWatchUrl(d.videoId),
      accent: decodeAccent(d.accent),
    });
    const dataFromItem = (it: QItem): NpData => ({
      videoId: it.videoId,
      youtubeUrl: it.youtubeUrl,
      albumTitle: it.title,
      bandName: it.band,
      coverThumb: it.thumb,
      cover: it.cover,
      tracks: [],
    });
    // Every playable card under `scope`, in DOM order.
    const cardItems = (scope: ParentNode): QItem[] =>
      Array.from(scope.querySelectorAll<HTMLElement>('[data-play-card]'))
        .map(itemFromCard)
        .filter((i): i is QItem => !!i);
    // What to cue on page load so the first tap can play synchronously: this
    // page's album, else the first playable card of its content. Null on pages
    // with neither. The right panel's Most played rows are on every page, so they
    // do not count: a form page must not load a YouTube player for them.
    const cueSource = (): NpData | null => {
      const data = readNpData();
      if (data) return data;
      const first = document.querySelector<HTMLElement>('#main [data-play-card]');
      const item = first ? itemFromCard(first) : null;
      return item ? dataFromItem(item) : null;
    };

    // "Playing from": the queue's own label (data-from on it or an ancestor: the
    // home's Latest uploads, a row, the panel's Most played), else the page's
    // heading. Read when the queue is built, so it stays right after navigating.
    const sourceOf = (el: Element | null): Source => {
      const tagged = el?.closest<HTMLElement>('[data-from]');
      if (tagged?.dataset.from) {
        return { label: tagged.dataset.from, href: tagged.dataset.fromHref || window.location.pathname };
      }
      const h1 = document.querySelector<HTMLElement>('#main h1');
      const label = (h1?.innerText || document.title || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' — ');
      return { label: label || 'Metal Archive', href: window.location.pathname + window.location.search };
    };
    const sourceRef = { current: { label: '', href: '#' } as Source };

    // ─── overlay helpers (loader / error / timeout) ─────────────────────────
    const show = (el: HTMLElement | null) => { if (el) el.style.display = 'flex'; };
    const hide = (el: HTMLElement | null) => { if (el) el.style.display = 'none'; };
    const hideAllOverlays = () => {
      hide(loaderRef.current);
      hide(errorRef.current);
      hide(timeoutRef.current);
    };

    // ─── multi-surface sync (the album page's hero + the player's surfaces) ──
    // The album page renders a big "now playing" hero with play/pause + progress;
    // the player has its own. Every matching element is updated by class, so all
    // control surfaces stay in lockstep no matter which one was pressed.
    //
    // The player's surfaces always show the album that plays. The hero (outside
    // the player) belongs to the album of its page: it shows time and progress
    // only while THAT album plays, and its own idle state otherwise.
    const heroLive = () => isOpen() && pageIsPlayingAlbum(readNpData());
    const setAllProgress = (pct: string) => {
      const live = heroLive();
      const shown = (el: Element) => (live || root.contains(el) ? pct : '0%');
      document.querySelectorAll<HTMLElement>('.js-progress-fill').forEach((el) => {
        el.style.width = shown(el);
      });
      // Mirror the visual fill onto the accessible progressbar (read-only): the
      // role="progressbar" container exposes aria-valuenow for screen readers.
      document.querySelectorAll('.js-progressbar').forEach((el) => {
        el.setAttribute('aria-valuenow', String(Math.round(parseFloat(shown(el)) || 0)));
      });
    };
    // The label says what pressing the control does, so it replaces aria-pressed
    // (a toggle whose name already flips would be announced twice over). The
    // state comes from the control's own data-state: "buffering" is transitional
    // toward playing, "error" means nothing is playing, same as "paused".
    const labelPP = (el: Element) => {
      const s = el.getAttribute('data-state');
      el.setAttribute('aria-label', s === 'playing' || s === 'buffering' ? 'Pause' : 'Play');
      el.removeAttribute('aria-pressed');
    };
    const setPP = (state: 'playing' | 'paused' | 'buffering' | 'error') => {
      document.querySelectorAll('.js-pp').forEach((el) => {
        el.setAttribute('data-state', state);
        labelPP(el);
      });
    };
    // The ONLY way a .js-pp control shows data-state="error" is setPP('error'), so
    // it is always cleared the same way. clearPPError() resets JUST the controls
    // showing a stale error back to "paused" — on retry, on loading a different
    // video and on every navigation — never one that is playing or buffering.
    const clearPPError = () => {
      document.querySelectorAll('.js-pp[data-state="error"]').forEach((el) => {
        el.setAttribute('data-state', 'paused');
        labelPP(el);
      });
    };
    const fmtTime = (s: number) => {
      if (!Number.isFinite(s) || s < 0) s = 0;
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    };
    const setTimes = (cur: number, dur: number) => {
      const live = heroLive();
      document.querySelectorAll('.js-time-current').forEach((el) => { el.textContent = live ? fmtTime(cur) : '0:00'; });
      document.querySelectorAll<HTMLElement>('.js-time-total').forEach((el) => {
        // The page renders the album's length ("37 min"); keep it to restore when idle.
        if (el.dataset.idle === undefined) el.dataset.idle = el.textContent || '';
        if (!live) el.textContent = el.dataset.idle;
        else if (dur > 0) el.textContent = fmtTime(dur);
      });
    };
    // The polite live region keeps the player from being "mute" for screen
    // readers. The node lives in the persistent render below (#np-live) so it
    // survives navigation. Callers write it once per change, never per tick.
    const announce = (text: string) => {
      const live = document.getElementById('np-live');
      if (live) live.textContent = text;
    };
    const nowPlayingText = (item: QItem) => `Now playing: ${item.title} by ${item.band}`;
    const setNpTitle = (name: string) => {
      if (!name) return;
      document.querySelectorAll('.js-np-title').forEach((el) => { el.textContent = name; });
      announce(`Now playing: ${name}`);
    };

    // ─── active-row highlight on the album page (class + aria-current) ───────
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

    // ─── buffering on the progress line ─────────────────────────────────────
    const npSetBuffering = () => {
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
      // A visitor whose network blocks youtube.com still reaches the loader, the
      // 8s timeout overlay and its Retry button: they live on the video box, which
      // stays rendered (off-screen) before the first play and shows when it starts.
      show(loaderRef.current);
      apiTimeoutRef.current = setTimeout(() => {
        // Never leave the spinner behind: hide it first, and show the timeout
        // only when the API is genuinely still not ready.
        hide(loaderRef.current);
        if (window.YT && window.YT.Player) return;
        show(timeoutRef.current);
      }, 8000);
    };

    // ─── the archive's accent, on <html> (see ACCENT at the top) ─────────────
    const playingAccent = (): AccentTokens | null => (isOpen() ? currentItem()?.accent ?? null : null);
    const paintAccent = (html: HTMLElement) => {
      const tokens = resolveAccent(playingAccent(), decodeAccent(html.getAttribute('data-accent')));
      const values = tokens ? accentDeclarations(tokens) : null;
      for (const name of ACCENT_VARS) {
        if (values) html.style.setProperty(name, values[name]);
        else html.style.removeProperty(name);
      }
    };

    // ─── short notice above the player ──────────────────────────────────────
    // Non-blocking: never over the video, takes no clicks and goes away by
    // itself. Screen readers get the same words through #np-live (see announce),
    // so the visible copy is aria-hidden instead of being read twice.
    const NOTICE_MS = 5000;
    const clearNotice = () => {
      if (noticeTimerRef.current) { clearTimeout(noticeTimerRef.current); noticeTimerRef.current = null; }
      if (noticeRef.current) noticeRef.current.hidden = true;
    };
    const showNotice = (text: string) => {
      const el = noticeRef.current;
      if (!el) return;
      clearNotice();
      el.textContent = text;
      el.hidden = false;
      noticeTimerRef.current = setTimeout(clearNotice, NOTICE_MS);
    };

    const currentItem = (): QItem | null => {
      const q = queueRef.current;
      return q ? q.items[q.index] || null : null;
    };
    const bandLink = (item: QItem) => item.bandHref || `/metal-archive/browse?q=${encodeURIComponent(item.band)}`;

    // ─── the album's tracks inside its one video (lib/segments.ts) ───────────
    // Spans need the video's length; until the player reports it there are none.
    const durationRef = { current: 0 };
    const spansRef = { current: [] as Span[] };
    const spansKeyRef = { current: '' };
    const infoRef = { current: null as AlbumInfo | null };
    const refreshSpans = (): boolean => {
      const tracks = playingTracksRef.current;
      const spans = trackSpans(tracks.map((t) => t.seconds || 0), durationRef.current);
      const key = `${loadedVideoIdRef.current}|${spans.map((s) => s.start).join(',')}|${durationRef.current}`;
      spansRef.current = spans;
      if (key === spansKeyRef.current) return false;
      spansKeyRef.current = key;
      return true;
    };
    const trackLabel = (idx: number) => {
      const t = playingTracksRef.current[idx];
      return t ? `${idx + 1}. ${t.name}` : '';
    };

    // Third line of the bar: the track that plays, when the tracks are known.
    const setBarName = (trackName: string) => {
      const idx = currentIdxRef.current;
      if (npTrackRef.current) npTrackRef.current.textContent = trackName && idx >= 0 ? `${idx + 1}. ${trackName}` : trackName;
    };

    // ─── paint every surface for the album that just STARTED ────────────────
    const posterOfRef = { current: '' };
    const paintPosters = (item: QItem) => {
      if (posterOfRef.current === item.videoId) return;
      posterOfRef.current = item.videoId;
      // The cover where the video is about to sit (seen while it moves between
      // slots), and blurred behind the 16:9 video in the square art.
      $$('[data-np-poster]').forEach((el) => el.replaceChildren(coverArtElement(item.cover, '', 'eager')));
      $$('[data-np-blur]').forEach((el) => {
        el.textContent = '';
        if (!item.cover) return;
        const img = document.createElement('img');
        img.src = item.cover;
        img.alt = '';
        img.decoding = 'async';
        el.appendChild(img);
      });
      if (npArtRef.current) npArtRef.current.replaceChildren(coverArtElement(item.cover, '', 'eager'));
    };
    const paintView = () => {
      const item = currentItem();
      if (!item) return;
      const info = infoRef.current;
      $$('[data-np-title]').forEach((el) => { el.textContent = item.title; });
      $$<HTMLAnchorElement>('[data-np-band]').forEach((el) => { el.textContent = item.band; el.href = bandLink(item); });
      $$<HTMLAnchorElement>('[data-np-album]').forEach((el) => { el.href = item.href; });
      $$<HTMLAnchorElement>('[data-np-yt]').forEach((el) => { el.href = item.youtubeUrl; });
      $$('[data-np-meta]').forEach((el) => {
        el.textContent = info?.meta || item.meta;
        el.hidden = !el.textContent;
      });
      $$('[data-np-tags]').forEach((el) => {
        el.textContent = '';
        if (info?.genre) {
          const a = document.createElement('a');
          a.className = 'np-tag';
          a.href = info.genre.href;
          a.textContent = info.genre.label;
          el.appendChild(a);
        }
        el.hidden = !info?.genre;
      });
      const src = sourceRef.current;
      $$<HTMLAnchorElement>('[data-np-from]').forEach((el) => { el.href = src.href; });
      $$('[data-np-from-label]').forEach((el) => { el.textContent = src.label; });
      paintPosters(item);
    };
    const paintBar = (item: QItem) => {
      if (npNameRef.current) npNameRef.current.textContent = item.title;
      if (npArtistRef.current) npArtistRef.current.textContent = item.band;
      if (npTrackRef.current) npTrackRef.current.textContent = '';
      if (ytErrorLinkRef.current) ytErrorLinkRef.current.href = item.youtubeUrl;
      paintAccent(document.documentElement);
      paintView();
      // Every way an album starts (card, next/prev, auto-next, jump) paints here,
      // so this is the one place that tells a screen reader the album changed.
      announce(nowPlayingText(item));
    };

    // ─── the queue: the album's tracks, then the next album ────────────────
    // Rows are rebuilt when the album, its tracks or their spans change, and only
    // re-marked when the track changes. Built with createElement/textContent:
    // titles are data, never markup.
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text) n.textContent = text;
      return n;
    };
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const albumMinutes = () => {
      const m = infoRef.current?.minutes;
      if (m) return m;
      return durationRef.current > 0 ? Math.round(durationRef.current / 60) : 0;
    };
    const countText = () => {
      const n = playingTracksRef.current.length;
      const min = albumMinutes();
      return [n ? plural(n, 'track') : '', min ? `${min} min` : ''].filter(Boolean).join(' · ');
    };
    const trackRows = (item: QItem): HTMLLIElement[] => {
      const spans = spansRef.current;
      return playingTracksRef.current.map((t, i) => {
        const li = el('li');
        const seekable = !!spans[i];
        const row = el(seekable ? 'button' : 'div', 'np-trk');
        if (row instanceof HTMLButtonElement) {
          row.type = 'button';
          row.setAttribute('data-np-seek', String(spans[i].start));
        }
        row.setAttribute('data-np-track', String(i));
        const n = el('span', 'np-trk__n', String(i + 1));
        const name = el('span', 'np-trk__name');
        name.append(el('b', '', t.name), el('small', '', item.band));
        row.append(n, name);
        if (spans[i]) row.append(el('span', 'np-trk__len', fmtTime(spans[i].end - spans[i].start)));
        li.appendChild(row);
        return li;
      });
    };
    const albumButton = (it: QItem, index: number, cls: string) => {
      const btn = el('button', cls);
      btn.type = 'button';
      btn.setAttribute('data-np-jump', String(index));
      btn.setAttribute('aria-label', `Play ${it.title} by ${it.band}`);
      btn.appendChild(coverArtElement(it.cover, `${cls}__art`));
      const text = el('span', `${cls}__text`);
      text.append(el('b', '', it.title), el('small', '', it.band));
      btn.appendChild(text);
      return btn;
    };
    const paintQueue = () => {
      const item = currentItem();
      const q = queueRef.current;
      const tracks = playingTracksRef.current;
      // Desktop right panel: Up next = the tracks then the next album; with no
      // tracks known, the next three albums.
      $$('[data-np-queue="dock"]').forEach((box) => {
        box.textContent = '';
        if (!item || !q) return;
        const head = el('p', 'np-queue__h');
        head.append(el('span', '', 'Up next'), el('small', '', countText()));
        box.appendChild(head);
        if (tracks.length) {
          const ol = el('ol', 'np-trks');
          ol.append(...trackRows(item));
          box.appendChild(ol);
          const n = nextIndex(q);
          if (n >= 0) {
            box.appendChild(el('p', 'np-queue__h', 'Then'));
            box.appendChild(albumButton(q.items[n], n, 'np-next'));
          }
        } else {
          const ol = el('ol', 'np-queue__albums');
          for (const it of upNext(q, 3)) {
            const li = el('li');
            li.appendChild(albumButton(it, q.items.indexOf(it), 'np-next'));
            ol.appendChild(li);
          }
          if (ol.childElementCount) box.appendChild(ol);
          else head.remove();
        }
      });
      // The view's tracklist (phone and tablet: there is no right panel).
      $$('[data-np-queue="view"]').forEach((box) => {
        const ol = box.querySelector('[data-np-tracks]');
        const count = box.querySelector('[data-np-count]');
        if (ol) ol.replaceChildren(...(item ? trackRows(item) : []));
        if (count) count.textContent = countText();
        box.hidden = !item || tracks.length === 0;
      });
      markQueueRow();
      paintChapters();
    };
    // The current track: an equaliser instead of its number, the accent, and
    // aria-current. Tracks before it read as heard.
    const markQueueRow = () => {
      const idx = currentIdxRef.current;
      $$('.np-trk').forEach((row) => {
        const i = Number(row.getAttribute('data-np-track'));
        const n = row.querySelector('.np-trk__n');
        const was = row.classList.contains('is-current');
        const on = i === idx;
        row.classList.toggle('is-past', idx >= 0 && i < idx);
        if (was === on && n?.childElementCount === (on ? 1 : 0)) return;
        row.classList.toggle('is-current', on);
        if (on) row.setAttribute('aria-current', 'true');
        else row.removeAttribute('aria-current');
        if (n) {
          n.textContent = on ? '' : String(i + 1);
          if (on) {
            const eq = el('span', 'ma-eq');
            eq.setAttribute('aria-hidden', 'true');
            eq.append(el('i'), el('i'), el('i'), el('i'));
            n.appendChild(eq);
          }
        }
      });
    };

    // ─── the view's segmented progress bar and its track chart ──────────────
    // One segment per track (flex-grow = its length), or one for the whole album
    // when the tracks have no usable timestamps. Rebuilt when the spans change.
    const barSpans = (): Span[] =>
      spansRef.current.length ? spansRef.current : durationRef.current > 0 ? [{ start: 0, end: durationRef.current }] : [];
    const paintSegments = () => {
      const spans = barSpans();
      $$('[data-np-prog]').forEach((prog) => {
        const segs = prog.querySelector('[data-np-segs]');
        if (!segs) return;
        segs.replaceChildren(
          ...spans.map((s) => {
            const seg = el('span', 'np-seg');
            seg.style.flexGrow = String(Math.max(1, s.end - s.start));
            seg.appendChild(el('i'));
            return seg;
          }),
        );
        prog.setAttribute('aria-valuemax', String(Math.round(durationRef.current)));
      });
    };
    const paintChapters = () => {
      const spans = spansRef.current;
      const max = Math.max(1, ...spans.map((s) => s.end - s.start));
      $$('[data-np-chapters]').forEach((fig) => {
        const bars = fig.querySelector('[data-np-bars]');
        if (bars) {
          bars.replaceChildren(
            ...spans.map((s, i) => {
              const b = el('button');
              b.type = 'button';
              b.setAttribute('data-np-seek', String(s.start));
              b.setAttribute('aria-label', `Track ${i + 1}, ${playingTracksRef.current[i]?.name ?? ''}`);
              b.style.height = `${Math.round(22 + 78 * ((s.end - s.start) / max))}%`;
              return b;
            }),
          );
        }
        fig.hidden = spans.length < 2;
      });
      markChapter();
    };
    const markChapter = () => {
      const idx = currentIdxRef.current;
      const total = spansRef.current.length;
      $$('[data-np-chapters]').forEach((fig) => {
        fig.querySelectorAll('[data-np-bars] button').forEach((b, i) => {
          b.className = i < idx ? 'is-past' : i === idx ? 'is-current' : '';
        });
        const cap = fig.querySelector('figcaption');
        const t = playingTracksRef.current[idx];
        if (cap) {
          cap.textContent = '';
          if (t && idx >= 0) cap.append(`Track ${idx + 1} of ${total}`, el('span', 'np-dot', '·'), el('b', '', t.name));
        }
      });
    };
    // Fill each segment up to `cur` and move the thumb there; the times beside it.
    const scrubRef = { current: null as null | { prog: HTMLElement; t: number } };
    const segBoxes = (prog: HTMLElement): Box[] => {
      const left = prog.getBoundingClientRect().left;
      return Array.from(prog.querySelectorAll<HTMLElement>('.np-seg')).map((s) => {
        const r = s.getBoundingClientRect();
        return { left: r.left - left, width: r.width };
      });
    };
    const paintProgress = (cur: number) => {
      const spans = barSpans();
      const dur = durationRef.current;
      const idx = currentIdxRef.current;
      const t = playingTracksRef.current[idx];
      $$('[data-np-prog]').forEach((prog) => {
        const at = scrubRef.current?.prog === prog ? scrubRef.current.t : cur;
        prog.querySelectorAll<HTMLElement>('.np-seg').forEach((seg, i) => {
          const s = spans[i];
          const fill = seg.firstElementChild as HTMLElement | null;
          if (!s || !fill) return;
          const f = at >= s.end ? 1 : at <= s.start ? 0 : (at - s.start) / (s.end - s.start);
          fill.style.width = `${f * 100}%`;
        });
        const thumb = prog.querySelector<HTMLElement>('.np-thumb');
        if (thumb) thumb.style.transform = `translateX(${xAtTime(spans, segBoxes(prog), at)}px)`;
        prog.setAttribute('aria-valuenow', String(Math.round(at)));
        prog.setAttribute(
          'aria-valuetext',
          `${fmtTime(at)} of ${fmtTime(dur)}${t && idx >= 0 ? `, track ${idx + 1}: ${t.name}` : ''}`,
        );
      });
      const shown = scrubRef.current ? scrubRef.current.t : cur;
      $$('[data-np-elapsed]').forEach((e) => { e.textContent = fmtTime(shown); });
      $$('[data-np-remain]').forEach((e) => { e.textContent = dur > 0 ? `-${fmtTime(dur - shown)}` : ''; });
    };

    // The track playing at `cur` (from the spans): when it changes, every surface
    // that names it follows (album page rows, bar, queue, chart, live region).
    const syncTrack = (cur: number) => {
      const spans = spansRef.current;
      if (!spans.length) return;
      const idx = trackAt(spans, cur);
      if (idx === currentIdxRef.current) return;
      currentIdxRef.current = idx;
      const row = document.querySelector(`[data-track-idx="${idx}"]`);
      if (row && pageIsPlayingAlbum(readNpData())) {
        clearActiveRows();
        markRowActive(row);
      }
      const name = trackNameAt(idx, playingTracksRef.current);
      setBarName(name);
      setNpTitle(name);
      markQueueRow();
      markChapter();
    };

    // Prev/next are album-level and only meaningful once a queue exists. Also
    // re-run on every navigation: the album page's own copies are fresh markup.
    const updateTransport = () => {
      const q = queueRef.current;
      const hasNext = !!q && nextIndex(q) >= 0;
      document.querySelectorAll<HTMLButtonElement>('[data-np-next]').forEach((b) => { b.disabled = !hasNext; });
      document.querySelectorAll<HTMLButtonElement>('[data-np-prev]').forEach((b) => { b.disabled = !q; });
    };

    // The open/closed state lives on #np-root, a PERSISTED element: <body> is
    // replaced by ClientRouter on every navigation, so a class there would be lost.
    const isOpen = () => root.hasAttribute('data-active');
    const isViewOpen = () => root.hasAttribute('data-view');
    const openPlayer = () => {
      if (isOpen()) return;
      root.setAttribute('data-active', '');
      dockRef.current?.removeAttribute('inert');
      tileRef.current?.removeAttribute('inert');
      requestStage(400);
    };

    // A card's ▶ shows ⏸ (and says "Pause ...") while ITS album plays; every other
    // card, and every card while paused, shows ▶. Only buttons that change are
    // touched, so it is cheap to run each second, which also covers cards rendered
    // later (search results, a page swap).
    const syncCards = () => {
      let state = -1;
      try { state = playerRef.current.getPlayerState(); } catch { /* not ready */ }
      const id = state === 1 || state === 3 ? loadedVideoIdRef.current : '';
      const paint = (b: HTMLElement, on: boolean) => {
        if (b.hasAttribute('data-playing') === on) return;
        b.toggleAttribute('data-playing', on);
        // data-keep-label: a button whose visible text is its name ("Play album"
        // in the home hero); a generated label would no longer contain that text.
        if (!b.hasAttribute('data-keep-label')) {
          b.setAttribute('aria-label', `${on ? 'Pause' : 'Play'} ${b.dataset.title} by ${b.dataset.band}`);
        }
        // [data-glyph] marks the ▶ inside a cover button, which may hold other
        // drawings (the live recordings' microphone).
        (b.querySelector('[data-glyph] path') || b.querySelector('path'))?.setAttribute('d', on ? PAUSE_PATH : PLAY_PATH);
        // A button that names itself ("Play album" on the album page) says Pause
        // while its album plays; the label is its visible text, so it follows.
        const text = b.querySelector<HTMLElement>('[data-label-on]');
        if (text) text.textContent = (on ? text.dataset.labelOn : text.dataset.labelOff) ?? text.textContent;
      };
      document.querySelectorAll<HTMLElement>('[data-play-card]').forEach((b) => paint(b, !!id && b.dataset.videoId === id));
      // A band page's Play: Pause while any album of its scope plays.
      document.querySelectorAll<HTMLElement>('[data-play-scope]:not([data-shuffle])').forEach((b) => {
        const scope = document.getElementById(b.dataset.playScope || '');
        paint(b, !!id && !!scope && cardItems(scope).some((i) => i.videoId === id));
      });
    };

    // What plays, for the page parts that follow it (lib/now.ts): written on the
    // persisted #np-root so a page that arrives later reads it at once, and
    // announced on document. Starting an album also puts it first in the
    // sidebar's Recent list (lib/recent.ts; storage may be unavailable, which
    // only means the list is not kept).
    const publishNow = (item: QItem | null) => {
      const now: NowInfo | null = item
        ? {
            id: item.albumId || item.videoId,
            videoId: item.videoId,
            title: item.title,
            band: item.band,
            href: item.href,
            cover: item.cover,
            meta: item.meta,
            bandHref: item.bandHref,
          }
        : null;
      if (now) {
        root.setAttribute('data-now', JSON.stringify(now));
        rememberRecent(browserStorage(), { id: now.id, title: now.title, band: now.band, href: now.href, cover: now.cover });
      } else {
        root.removeAttribute('data-now');
      }
      document.dispatchEvent(new CustomEvent(NOW_EVENT, { detail: now }));
      if (now) document.dispatchEvent(new CustomEvent(RECENT_EVENT));
    };

    // controls=0 leaves nothing in the video to operate, so the iframe is not a
    // Tab stop. The player's own buttons are the controls; the video is to watch.
    const skipIframeInTabOrder = () => {
      miniPlayerRef.current?.querySelector('iframe')?.setAttribute('tabindex', '-1');
    };

    // ═══ THE STAGE: one iframe laid over the slot on screen ═══════════════════
    const mqPhone = window.matchMedia('(max-width: 767px)');
    const mqDesktop = window.matchMedia('(min-width: 1100px)');
    const mqCalm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const layout = (): Layout => (mqPhone.matches ? 'phone' : mqDesktop.matches ? 'desktop' : 'tablet');
    const slotEl = (s: Surface) => root.querySelector<HTMLElement>(`[data-np-slot="${s}"]`);
    // The square art shows the 16:9 video whole over its blurred cover; the
    // panel and the tile are too small for that and get a square iframe.
    const fitOf = (s: Surface) => (s === 'art' ? 'video' : 'fill');
    const rectOf = (e: Element): Rect => {
      const r = e.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    const viewportRect = (): Rect => ({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });
    const intersect = (a: Rect, b: Rect): Rect => {
      const left = Math.max(a.left, b.left);
      const top = Math.max(a.top, b.top);
      const right = Math.min(a.left + a.width, b.left + b.width);
      const bottom = Math.min(a.top + a.height, b.top + b.height);
      return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    };
    // A slot is usable when the video box in it is >= 200x200 and wholly visible
    // inside what holds it (the view or the panel, which clip and scroll) and the
    // viewport. Half a pixel of rounding is forgiven.
    const usable = (s: 'panel' | 'art'): boolean => {
      const slot = slotEl(s);
      const holder = s === 'art' ? viewRef.current : dockRef.current;
      if (!slot || !holder) return false;
      const box = videoBox(rectOf(slot), fitOf(s));
      const b = intersect(rectOf(holder), viewportRect());
      return fitsInside(box, { left: b.left - 0.5, top: b.top - 0.5, width: b.width + 1, height: b.height + 1 });
    };

    // ─── the tile's place: a corner of the free area ────────────────────────
    const cornerRef = { current: 'br' as Corner };
    try {
      const saved = window.localStorage.getItem(CORNER_KEY) as Corner | null;
      if (saved && CORNERS.includes(saved)) cornerRef.current = saved;
    } catch { /* storage unavailable: the default corner */ }
    const saveCorner = (c: Corner) => {
      cornerRef.current = c;
      try { window.localStorage.setItem(CORNER_KEY, c); } catch { /* not kept */ }
    };
    // The viewport less the top bar and, at the bottom, the mini player and the
    // tab bar (the tile never covers them), less the side rail or panels.
    const tileArea = (): Rect => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const lay = layout();
      const pad = lay === 'phone' ? 12 : 20;
      const topBar = document.querySelector('.ma-top');
      const top = Math.max(0, topBar ? topBar.getBoundingClientRect().bottom : 0) + 8;
      let bottom = vh;
      for (const sel of ['#now-playing-bar', '.ma-tabbar']) {
        const b = document.querySelector(sel);
        const r = b?.getBoundingClientRect();
        if (r && r.height > 0 && r.top < vh) bottom = Math.min(bottom, r.top);
      }
      bottom -= 12;
      const side = document.querySelector('.ma-side')?.getBoundingClientRect();
      const left = (side && side.width > 0 && side.right > 0 && side.right < vw / 2 ? side.right : 0) + pad;
      let right = vw - pad;
      if (lay === 'desktop' && dockRef.current) {
        const d = dockRef.current.getBoundingClientRect();
        if (d.width > 0 && d.left > vw / 2) right = d.left - pad;
      }
      return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    };
    const dragRef = { current: null as null | { id: number; x: number; y: number; left: number; top: number; moved: boolean } };
    const suppressTileClickRef = { current: false };
    const placeTile = (animate: boolean) => {
      const tile = tileRef.current;
      const slot = slotEl('tile');
      if (!tile || !slot || dragRef.current?.moved) return;
      const pos = tileAt(cornerRef.current, tileArea(), { width: tile.offsetWidth, height: tile.offsetHeight }, slot.offsetTop);
      tile.dataset.corner = cornerRef.current;
      tile.classList.toggle('is-settling', animate && !mqCalm.matches);
      tile.style.left = `${Math.round(pos.left)}px`;
      tile.style.top = `${Math.round(pos.top)}px`;
      const grip = tile.querySelector('[data-np-tile-grip]');
      grip?.setAttribute('aria-label', `Move the video to the ${cornerRef.current[1] === 'l' ? 'right' : 'left'}`);
      if (animate) requestStage(450);
    };

    // ─── the frame loop: decide, place, follow ──────────────────────────────
    // A change (open, view, resize, a drag) asks for frames; while they last the
    // wrapper follows its slot, which may be moving (the phone sheet sliding up,
    // the tile settling in a corner). A change of surface flies the video from
    // the old box to the new one, unless reduced motion is asked for.
    const stage = {
      raf: 0,
      until: 0,
      surface: 'hidden' as Surface,
      box: null as Rect | null,
      fly: null as null | { from: Rect; start: number; dur: number },
    };
    const requestStage = (followMs = 0) => {
      stage.until = Math.max(stage.until, performance.now() + followMs);
      if (!stage.raf) stage.raf = requestAnimationFrame(stageFrame);
    };
    const ease = (p: number) => 1 - Math.pow(1 - p, 3);
    const lerp = (a: Rect, b: Rect, p: number): Rect => ({
      left: a.left + (b.left - a.left) * p,
      top: a.top + (b.top - a.top) * p,
      width: a.width + (b.width - a.width) * p,
      height: a.height + (b.height - a.height) * p,
    });
    const stageFrame = (now: number) => {
      stage.raf = 0;
      applyStage(now);
      if (now < stage.until || stage.fly) stage.raf = requestAnimationFrame(stageFrame);
    };
    const applyStage = (now: number) => {
      const wrap = miniPlayerRef.current;
      if (!wrap) return;
      const surface = pickSurface({ open: isOpen(), view: isViewOpen(), layout: layout(), usable });
      if (surface !== stage.surface) {
        const from = stage.box;
        root.setAttribute('data-surface', surface);
        if (surface === 'tile') placeTile(false);
        stage.fly = from && stage.surface !== 'hidden' && surface !== 'hidden' && !mqCalm.matches
          ? { from, start: now, dur: 460 }
          : null;
        stage.surface = surface;
      }
      if (surface === 'hidden') {
        stage.box = null;
        wrap.style.removeProperty('left');
        wrap.style.removeProperty('top');
        wrap.style.removeProperty('width');
        wrap.style.removeProperty('height');
        return;
      }
      const slot = slotEl(surface);
      if (!slot) return;
      const target = videoBox(rectOf(slot), fitOf(surface));
      let box = target;
      if (stage.fly) {
        const p = Math.min(1, (now - stage.fly.start) / stage.fly.dur);
        box = lerp(stage.fly.from, target, ease(p));
        if (p >= 1) stage.fly = null;
      }
      stage.box = box;
      wrap.style.left = `${box.left}px`;
      wrap.style.top = `${box.top}px`;
      wrap.style.width = `${box.width}px`;
      wrap.style.height = `${box.height}px`;
    };
    // YouTube allows starting the next album on its own only while the player is
    // more than half visible.
    const videoMostlyVisible = (): boolean => {
      const b = stage.box;
      if (!b || stage.surface === 'hidden') return false;
      const v = intersect(b, viewportRect());
      return v.width * v.height > (b.width * b.height) / 2;
    };

    // ─── the now-playing view ───────────────────────────────────────────────
    // Desktop and tablet: in place of the page (the page's scroll is kept and
    // restored). Phone: a full-screen sheet, the page behind it inert. Escape and
    // its close buttons shut it and give focus back to what opened it.
    const viewOpenerRef = { current: null as HTMLElement | null };
    const viewScrollRef = { current: 0 };
    const inertedRef = { current: [] as Element[] };
    const setPageInert = (on: boolean) => {
      inertedRef.current.forEach((n) => n.removeAttribute('inert'));
      inertedRef.current = [];
      if (!on) return;
      for (const child of Array.from(document.body.children)) {
        if (child.contains(root) || child.hasAttribute('inert')) continue;
        child.setAttribute('inert', '');
        inertedRef.current.push(child);
      }
    };
    const applyViewMode = () => {
      const view = viewRef.current;
      if (!view) return;
      const sheet = layout() === 'phone';
      if (sheet) {
        view.setAttribute('role', 'dialog');
        view.setAttribute('aria-modal', 'true');
      } else {
        view.setAttribute('role', 'region');
        view.removeAttribute('aria-modal');
      }
      setPageInert(isViewOpen() && sheet);
    };
    const openView = (opener: HTMLElement | null) => {
      if (!isOpen() || isViewOpen()) return;
      viewOpenerRef.current = opener;
      viewScrollRef.current = window.scrollY;
      root.setAttribute('data-view', '');
      viewRef.current?.removeAttribute('inert');
      applyViewMode();
      paintView();
      paintSegments();
      paintChapters();
      paintProgress(currentTime());
      requestStage(700);
      // Desktop and tablet: the top bar's "Close player"; the phone: the sheet's chevron.
      const close =
        layout() === 'phone'
          ? viewRef.current?.querySelector<HTMLElement>('.np-head [data-np-close-view]')
          : document.querySelector<HTMLElement>('.ma-top [data-np-close-view]');
      (close || viewRef.current?.querySelector<HTMLElement>('.np-play'))?.focus({ preventScroll: true });
    };
    const closeView = (opts: { restore?: boolean } = {}) => {
      if (!isViewOpen()) return;
      const restore = opts.restore !== false;
      root.removeAttribute('data-view');
      viewRef.current?.setAttribute('inert', '');
      setPageInert(false);
      requestStage(700);
      if (!restore) return;
      const y = viewScrollRef.current;
      if (layout() !== 'phone') window.scrollTo(0, y);
      const back = viewOpenerRef.current;
      const target = back && back.isConnected && back.getClientRects().length
        ? back
        : root.querySelector<HTMLElement>('#now-playing-bar [data-np-open]');
      target?.focus({ preventScroll: true });
    };

    // ─── the tile: drag to a corner, the grip moves it to the other side ────
    const onTileDown = (e: PointerEvent) => {
      const tile = tileRef.current;
      if (!tile || e.button !== 0 || stage.surface !== 'tile') return;
      // No native drag: Chromium otherwise starts dragging an image under the
      // pointer and cancels the pointer (pointercancel) as soon as it moves.
      e.preventDefault();
      dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: tile.offsetLeft, top: tile.offsetTop, moved: false };
    };
    const onTileMove = (e: PointerEvent) => {
      const d = dragRef.current;
      const tile = tileRef.current;
      if (!d || !tile || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 8) return;
        d.moved = true;
        tile.classList.remove('is-settling');
        tile.classList.add('is-dragging');
        try { tile.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      const maxLeft = window.innerWidth - tile.offsetWidth;
      const maxTop = window.innerHeight - tile.offsetHeight;
      tile.style.left = `${Math.min(maxLeft, Math.max(0, d.left + dx))}px`;
      tile.style.top = `${Math.min(maxTop, Math.max(0, d.top + dy))}px`;
      requestStage(0);
    };
    const onTileUp = (e: PointerEvent) => {
      const d = dragRef.current;
      const tile = tileRef.current;
      if (!d || !tile || e.pointerId !== d.id) return;
      dragRef.current = null;
      if (!d.moved) return;
      tile.classList.remove('is-dragging');
      suppressTileClickRef.current = true;
      setTimeout(() => { suppressTileClickRef.current = false; }, 0);
      const r = tile.getBoundingClientRect();
      saveCorner(nearestCorner({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, tileArea()));
      placeTile(true);
    };
    const onTileKey = (e: KeyboardEvent) => {
      const grip = (e.target as Element)?.closest?.('[data-np-tile-grip]');
      if (!grip) return;
      const c = cornerRef.current;
      const next: Corner | null =
        e.key === 'ArrowLeft' ? `${c[0]}l` as Corner
        : e.key === 'ArrowRight' ? `${c[0]}r` as Corner
        : e.key === 'ArrowUp' ? `t${c[1]}` as Corner
        : e.key === 'ArrowDown' ? `b${c[1]}` as Corner
        : null;
      if (!next) return;
      e.preventDefault();
      if (next === c) return;
      saveCorner(next);
      placeTile(true);
    };

    // ─── build the YT.Player ────────────────────────────────────────────────
    // Always built CUED (autoplay=0): playback starts only from onReady consuming
    // a still-pending request (pendingRef). An autoplay playerVar would start the
    // video at iframe load, before onReady, where a close (x) cannot stop it.
    const buildPlayer = (data: NpData) => {
      const host = ytHostRef.current;
      if (!host) return;
      if (!data.videoId || !window.YT || !window.YT.Player) return;

      // API available — cancel the slow-network timeout.
      clearApiTimeout();
      if (host.querySelector('iframe')) return; // already built

      loadedVideoIdRef.current = data.videoId;
      playingTracksRef.current = data.tracks || [];
      // No accent here: a cued album is not in the player until startItem opens it.
      // Point the error-overlay "Open on YouTube" link at the cued album now, so
      // a video that fails to EMBED on cue (before any play) still links out.
      if (ytErrorLinkRef.current) ytErrorLinkRef.current.href = data.youtubeUrl || '#';

      playerRef.current = new window.YT.Player(host, {
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
            skipIframeInTabOrder();   // the iframe surely exists by now
            hideAllOverlays();
            syncVolume();
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
            // Every .js-pp control gets its own "error" state (through setPP,
            // like every other state), so the pressed control does not keep
            // showing an idle glyph while nothing can play.
            setPP('error');
          },
          onStateChange: (e: any) => {
            syncCards();
            if (e.data === 1 || e.data === 3) {
              hide(errorRef.current);
              hide(timeoutRef.current);
            }
            if (e.data === 3) { npSetBuffering(); return; }   // buffering
            npClearBuffering();
            if (e.data === 1) { setPP('playing'); readDuration(); }   // playing
            else if (e.data === 2) { setPP('paused'); }               // paused
            else if (e.data === 0) {                                  // ended (whole video)
              setPP('paused');
              // Single-video albums end here. Fill the bar (we reached the end)
              // rather than leaving it mid-track.
              setAllProgress('100%');
              // Repeat plays it again; else the next album by itself, unless the
              // video is not visible enough for YouTube to allow that. At the end
              // of the queue stop, unless its scope has gained cards since.
              const q0 = queueRef.current;
              if (q0 && afterEnd(q0, repeatRef.current) === q0.index && q0.items[q0.index]) {
                try { playerRef.current.seekTo(0, true); playerRef.current.playVideo(); } catch { /* ignore */ }
                return;
              }
              topUpQueue();
              const q = queueRef.current;
              const n = q ? nextIndex(q) : -1;
              if (n >= 0 && videoMostlyVisible()) goTo(n);
            }
          },
        },
      });
      // Right after the constructor too, so a Tab before onReady cannot land in it.
      skipIframeInTabOrder();
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

    // ─── reset the progress immediately on a track or album change ───────────
    // Without this the bars keep the OLD position until the next 1s tick.
    const npResetProgress = () => {
      setAllProgress('0%');
      setTimes(0, 0);
      paintProgress(0);
    };
    const currentTime = (): number => {
      try { return playerRef.current?.getCurrentTime?.() || 0; } catch { return 0; }
    };
    // The video's length, once the player knows it: the spans, the segments, the
    // track lengths and the "-remaining" time all need it.
    const readDuration = () => {
      let d = 0;
      try { d = playerRef.current?.getDuration?.() || 0; } catch { /* not ready */ }
      if (!(d > 0) || Math.abs(d - durationRef.current) < 0.5) return;
      durationRef.current = d;
      if (refreshSpans()) { paintQueue(); paintSegments(); }
    };

    // ─── the album page's tracklist rows: "make track N the active one" ──────
    // Click, play-album and the page's own controls funnel through here so the
    // track name, the row highlight and the progress update the same way.
    //
    // CRITICAL: seekTo + playVideo run synchronously here. No await before the
    // play call — when this is reached from a click the user gesture is
    // preserved, so the browser permits the sound.
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
      markQueueRow();
      markChapter();
    };

    // Seek inside the album that plays (the queue's rows, the chart, the bar).
    const seekTo = (sec: number, play: boolean) => {
      const p = playerRef.current;
      if (!p || typeof p.seekTo !== 'function' || !isOpen()) return;
      try {
        p.seekTo(sec, true);
        if (play) p.playVideo();
      } catch { /* not ready */ }
      paintProgress(sec);
      syncTrack(sec);
      if (durationRef.current > 0) setAllProgress(`${Math.min(100, (sec / durationRef.current) * 100)}%`);
    };

    // ─── make an album from the queue the one that plays ───────────────────
    // The single funnel for card ▶, the album page's Play, next/prev, auto-next,
    // error skips and queue jumps. The album page's tracks are known at once;
    // any other album's arrive from its JSON a moment later (see the top).
    //
    // CRITICAL: openPlayer() and loadVideoById() run synchronously, so when this
    // is reached from a click the user gesture is preserved and the browser
    // permits the sound, and the video is already visible when playback starts.
    const trackNameAt = (idx: number, tracks: PlayerTrack[]): string => {
      if (idx < 0) return '';
      const node = pageIsPlayingAlbum(readNpData())
        ? document.querySelector(`[data-track-idx="${idx}"] [data-track-name]`)
        : null;
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
      clearNotice();   // an older "skipped" notice is about a previous album
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
      // Loading a different video makes any previous error moot: clear it the
      // same way retryPlayer() does.
      clearPPError();
      hide(errorRef.current);
      loadedVideoIdRef.current = item.videoId;
      playingTracksRef.current = tracks;
      currentIdxRef.current = idx;
      durationRef.current = 0;
      infoRef.current = null;
      refreshSpans();
      npResetProgress();
      syncCards();
      paintBar(item);
      publishNow(item);

      clearActiveRows();
      let name = '';
      if (idx >= 0) {
        const row = document.querySelector(`[data-track-idx="${idx}"]`);
        if (row) markRowActive(row);
        name = trackNameAt(idx, tracks);
      }
      setBarName(name);
      if (name) setNpTitle(name);
      topUpQueue();
      paintQueue();
      paintSegments();
      updateTransport();
      requestStage(400);

      // The rest of the album's facts: its tracks (unless the page gave them),
      // meta line and genre. Only applied while that album is still the one.
      if (item.albumId) {
        loadAlbumInfo(item.albumId).then((info) => {
          if (!info || loadedVideoIdRef.current !== item.videoId) return;
          infoRef.current = info;
          if (!playingTracksRef.current.length && info.tracks.length) {
            playingTracksRef.current = info.tracks.map((t, i) => ({ idx: i, name: t.name, seconds: t.seconds }));
          }
          readDuration();
          refreshSpans();
          paintView();
          paintQueue();
          paintSegments();
          syncTrack(currentTime());
        });
      }
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

    // ─── shuffle and repeat (the view's side buttons) ───────────────────────
    // Shuffle remembers the built order to go back to it; it stays on for the
    // next queue too, like a music app. Repeat plays the album again when it ends.
    const shuffleRef = { current: false };
    const orderRef = { current: null as QItem[] | null };
    const repeatRef = { current: false };
    const paintModes = () => {
      $$('[data-np-shuffle]').forEach((b) => b.setAttribute('aria-pressed', String(shuffleRef.current)));
      $$('[data-np-repeat]').forEach((b) => b.setAttribute('aria-pressed', String(repeatRef.current)));
    };
    const applyShuffle = (q: Queue<QItem>): Queue<QItem> => {
      orderRef.current = q.items;
      return shuffleUpcoming(q);
    };
    const toggleShuffle = () => {
      shuffleRef.current = !shuffleRef.current;
      const q = queueRef.current;
      if (q) {
        if (shuffleRef.current) queueRef.current = applyShuffle(q);
        else if (orderRef.current) queueRef.current = restoreOrder(q, orderRef.current);
      }
      if (!shuffleRef.current) orderRef.current = null;
      paintModes();
      paintQueue();
      updateTransport();
      announce(shuffleRef.current ? 'Shuffle on' : 'Shuffle off');
    };
    const toggleRepeat = () => {
      repeatRef.current = !repeatRef.current;
      paintModes();
      announce(repeatRef.current ? 'Repeat album on' : 'Repeat album off');
    };
    // A new queue (a ▶, the album page's Play) takes the shuffle that is on.
    const setQueue = (q: Queue<QItem> | null) => {
      orderRef.current = null;
      queueRef.current = q && shuffleRef.current ? applyShuffle(q) : q;
    };

    // A queue only holds the cards its scope had when it was built, and a scope can
    // gain more ("Load more" on Browse). At the end of the queue, rebuild it from
    // the same scope element when that now has playable albums after the current
    // one. A scope that left the page (a ClientRouter swap) can gain nothing.
    // Returns true when the queue grew.
    const topUpQueue = (): boolean => {
      const q = queueRef.current;
      const scope = queueScopeRef.current;
      if (!q || nextIndex(q) >= 0 || !scope || !scope.isConnected) return false;
      const longer = extendQueue(q, cardItems(scope));
      if (!longer) return false;
      queueRef.current = shuffleRef.current ? applyShuffle(longer) : longer;
      return true;
    };

    // A video that cannot be embedded (YT errors 2/5/100/101/150): mark it and go
    // to the next playable album. Returns false at the end of the queue (or with
    // no queue), where the caller shows the "Video unavailable" overlay instead.
    const skipUnplayable = (): boolean => {
      const q = queueRef.current;
      if (!q || !q.items[q.index]) return false;
      const failed = q.items[q.index];
      queueRef.current = markUnplayable(q, failed.videoId);
      topUpQueue();
      const marked = queueRef.current;
      const n = nextIndex(marked);
      if (n < 0) { paintQueue(); updateTransport(); return false; }
      goTo(n);
      // The next album starts on its own: say why the one the listener picked did
      // not play. One announcement carries both facts (goTo just announced the
      // new album and this replaces it).
      const skipped = `Skipped ${failed.title}: not available on YouTube`;
      showNotice(skipped);
      announce(`${skipped}. ${nowPlayingText(marked.items[n])}`);
      return true;
    };

    // Play the album of the page being viewed: the queue is this album first,
    // then the other playable cards on the page (the album's similar albums).
    const startPageAlbum = (pageData: NpData, startSeconds: number, idx: number) => {
      const item = itemFromData(pageData);
      setQueue(buildQueue([item, ...cardItems(document)], item.videoId));
      queueScopeRef.current = null;
      sourceRef.current = sourceOf(null);
      startItem(item, { startSeconds, trackIdx: idx });
    };

    // × on the bar: stop, hide every surface, forget the queue.
    const closePlayer = () => {
      const p = playerRef.current;
      if (p && typeof p.stopVideo === 'function') {
        try { p.stopVideo(); } catch { /* ignore */ }
      }
      closeView({ restore: false });
      root.removeAttribute('data-active');
      dockRef.current?.setAttribute('inert', '');
      tileRef.current?.setAttribute('inert', '');
      clearNotice();
      queueRef.current = null;
      orderRef.current = null;
      queueScopeRef.current = null;
      pendingRef.current = null;
      loadedVideoIdRef.current = '';
      playingTracksRef.current = [];
      currentIdxRef.current = -1;
      durationRef.current = 0;
      infoRef.current = null;
      posterOfRef.current = '';
      refreshSpans();
      clearActiveRows();
      npResetProgress();
      syncCards();
      hideAllOverlays();
      setPP('paused');
      paintQueue();
      paintSegments();
      updateTransport();
      requestStage(0);
      paintAccent(document.documentElement);   // back to the page's colour, or amber
      publishNow(null);
    };

    // Landed on the album that is playing: its tracklist is known now, so show
    // and highlight the track the video is currently in (when it has timestamps).
    const syncPlayingTrack = (data: NpData) => {
      if (data.tracks && data.tracks.length) playingTracksRef.current = data.tracks;
      if (refreshSpans()) { paintQueue(); paintSegments(); }
      const tracks = playingTracksRef.current;
      let idx = currentIdxRef.current;
      if (idx < 0 && spansRef.current.length) {
        idx = trackAt(spansRef.current, currentTime());
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

    // YT player state: 1 playing, 2 paused, 3 buffering, 0 ended, 5 cued, -1
    // unstarted. -1 as well while the player does not exist or is not ready.
    const playerState = (): number => {
      try { return playerRef.current.getPlayerState(); } catch { return -1; }
    };
    const togglePlay = () => {
      const p = playerRef.current;
      if (!p) return;
      const state = playerState();
      if (state === 1) {
        try { p.pauseVideo(); } catch { /* ignore */ }
        return;
      }
      try { p.playVideo(); } catch { /* ignore */ }
    };

    const playAlbum = () => {
      const first = document.querySelector('[data-track-idx]');
      if (first) { activateRow(first); return; }
      // No tracklist — just play the video from the start.
      const p = playerRef.current;
      if (p && typeof p.playVideo === 'function') {
        try { p.seekTo(0, true); } catch { /* ignore */ }
        p.playVideo();
      }
    };

    // Smart main button (the album page's big play/pause): toggles when something
    // is loaded, otherwise starts the album from the first track.
    const mainPlayPause = () => {
      const p = playerRef.current;
      if (!p) return;
      const state = playerState();
      if (state === 1) { try { p.pauseVideo(); } catch { /* ignore */ } return; }   // playing -> pause
      if (state === 2 || state === 3) { try { p.playVideo(); } catch { /* ignore */ } return; } // paused/buffering -> resume
      playAlbum();   // unstarted / cued / ended -> start (keeps the row highlight)
    };

    // Share: the native share sheet when there is one, else copy the URL, and
    // ALWAYS give visible feedback (copying silently looks dead).
    //  - [data-share] (the album page): this page.
    //  - [data-np-share] (the player): the album that plays, wherever this is.
    const copied = (btn: Element) => {
      announce('Link copied');
      const label = btn.querySelector('[data-share-label]') || (btn.hasAttribute('data-share') ? btn.querySelector('span') : null);
      if (label) {
        const prev = label.textContent;
        label.textContent = 'Link copied';
        setTimeout(() => { label.textContent = prev; }, 1600);
      } else {
        btn.setAttribute('data-copied', '');
        setTimeout(() => btn.removeAttribute('data-copied'), 1600);
      }
    };
    const share = async (btn: Element, url: string, title: string) => {
      if (navigator.share) {
        try { await navigator.share({ title, url }); return; } catch { return; }
      }
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      copied(btn);
    };

    // ─── volume (desktop and tablet; phones set it with their own buttons) ────
    const syncVolume = () => {
      let v = 100;
      try {
        v = Math.round(playerRef.current?.getVolume?.() ?? 100);
        if (playerRef.current?.isMuted?.()) v = 0;
      } catch { /* not ready */ }
      paintVolume(v);
    };
    const paintVolume = (v: number) => {
      $$<HTMLInputElement>('[data-np-volume]').forEach((input) => {
        input.value = String(v);
        input.style.setProperty('--v', `${v}%`);
        input.setAttribute('aria-valuetext', `${v}%`);
      });
      $$('[data-np-volume-out]').forEach((o) => { o.textContent = `${v}%`; });
    };
    const onVolume = (e: Event) => {
      const input = (e.target as Element)?.closest?.<HTMLInputElement>('[data-np-volume]');
      if (!input) return;
      const v = Math.max(0, Math.min(100, Number(input.value) || 0));
      try {
        playerRef.current?.setVolume?.(v);
        if (v > 0) playerRef.current?.unMute?.();
      } catch { /* not ready */ }
      paintVolume(v);
    };

    // ─── progress tick — only while actually playing (state 1) ──────────────
    // Moves every progress surface, and follows the album's tracks: these albums
    // are ONE long video, so YT only fires `ended` at the very end; the current
    // track comes from the playback position and the tracks' spans.
    const progressTick = () => {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      try {
        if (p.getPlayerState && p.getPlayerState() !== 1) return;
      } catch { return; }
      try {
        readDuration();
        const dur = durationRef.current;
        const cur = p.getCurrentTime();
        if (!dur) return;
        const pct = Math.min(100, (cur / dur) * 100);
        setAllProgress(pct + '%');
        setTimes(cur, dur);
        paintProgress(cur);
        syncCards();
        // "Load more" may have added cards while the last album plays: Next and
        // the queue should show them now, not only when it ends.
        if (topUpQueue()) { paintQueue(); updateTransport(); }
        syncTrack(cur);
      } catch { /* ignore */ }
    };
    progressIntervalRef.current = setInterval(() => {
      try { progressTick(); } catch { /* ignore */ }
    }, 1000);

    // ─── the view's progress bar: click, drag and keys seek ─────────────────
    const scrubTime = (prog: HTMLElement, clientX: number) =>
      timeAtX(barSpans(), segBoxes(prog), clientX - prog.getBoundingClientRect().left);
    const onProgDown = (e: PointerEvent) => {
      const prog = (e.target as Element)?.closest?.<HTMLElement>('[data-np-prog]');
      if (!prog || e.button !== 0 || !barSpans().length) return;
      e.preventDefault();
      try { prog.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      prog.classList.add('is-scrubbing');
      scrubRef.current = { prog, t: scrubTime(prog, e.clientX) };
      paintProgress(currentTime());
    };
    const onProgMove = (e: PointerEvent) => {
      const s = scrubRef.current;
      if (!s) return;
      s.t = scrubTime(s.prog, e.clientX);
      paintProgress(currentTime());
    };
    const onProgUp = () => {
      const s = scrubRef.current;
      if (!s) return;
      scrubRef.current = null;
      s.prog.classList.remove('is-scrubbing');
      seekTo(s.t, false);
    };
    const onProgKey = (e: KeyboardEvent) => {
      const prog = (e.target as Element)?.closest?.('[data-np-prog]');
      if (!prog || !isOpen()) return;
      const dur = durationRef.current;
      const cur = currentTime();
      const to =
        e.key === 'ArrowRight' || e.key === 'ArrowUp' ? cur + 5
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? cur - 5
        : e.key === 'PageUp' ? cur + 30
        : e.key === 'PageDown' ? cur - 30
        : e.key === 'Home' ? 0
        : e.key === 'End' ? dur - 1
        : null;
      if (to === null) return;
      e.preventDefault();
      seekTo(Math.max(0, Math.min(dur > 0 ? dur - 1 : to, to)), false);
    };

    // ─── single delegated click handler (capture phase) ─────────────────────
    // CRITICAL: everything that triggers playback runs SYNCHRONOUSLY here so the
    // user gesture is preserved and the browser allows the sound.
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!t || !t.closest) return;
      // A drag of the tile ends with a click on it: that click is not a tap.
      if (suppressTileClickRef.current && t.closest('#np-tile')) {
        e.preventDefault();
        e.stopPropagation();
        suppressTileClickRef.current = false;
        return;
      }
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
        // The album that is already loaded: pause/resume it, never restart it. Only
        // while it is playing, paused or buffering (YT states 1/2/3): after an error,
        // the load-timeout overlay or the end, the ▶ starts it again, as a retry.
        if (isOpen() && item.videoId === loadedVideoIdRef.current && [1, 2, 3].includes(playerState())) {
          togglePlay();
          return;
        }
        const scope = cardBtn.closest('[data-queue]') || document;
        setQueue(buildQueue(cardItems(scope), item.videoId));
        // Only an element can be rebuilt later: `document` would silently turn into
        // whatever page is open when the queue ends.
        queueScopeRef.current = scope instanceof Element ? scope : null;
        sourceRef.current = sourceOf(scope instanceof Element ? scope : cardBtn);
        startItem(item);
        return;
      }

      // Play and Shuffle on a band page: the albums of the element that
      // data-play-scope names (its discography). Play starts at the album the
      // button names (the most played) and pauses/resumes while one of them plays;
      // Shuffle turns shuffle on and starts at a random one. Either way the start
      // goes first and every other album of the scope follows (leadWith).
      const scopeBtn = t.closest<HTMLElement>('[data-play-scope]');
      if (scopeBtn) {
        const scopeEl = document.getElementById(scopeBtn.dataset.playScope || '');
        const items = scopeEl ? cardItems(scopeEl) : [];
        if (items.length === 0) return;
        const shuffle = scopeBtn.hasAttribute('data-shuffle');
        if (!shuffle && isOpen() && items.some((i) => i.videoId === loadedVideoIdRef.current) && [1, 2, 3].includes(playerState())) {
          togglePlay();
          return;
        }
        if (shuffle && !shuffleRef.current) {
          shuffleRef.current = true;
          paintModes();
          announce('Shuffle on');
        }
        const start = shuffle
          ? items[Math.floor(Math.random() * items.length)]
          : items.find((i) => i.videoId === scopeBtn.dataset.videoId) || items[0];
        setQueue(buildQueue(leadWith(items, start.videoId), start.videoId));
        // Not rebuilt from the scope later: its page order is not this queue's.
        queueScopeRef.current = null;
        sourceRef.current = sourceOf(scopeEl);
        startItem(start);
        return;
      }

      // The player's own controls and the page's, that do NOT start a NEW album.
      const openBtn = t.closest<HTMLElement>('[data-np-open]');
      if (openBtn) { openView(openBtn); return; }
      if (t.closest('[data-np-close-view]')) { closeView(); return; }
      if (t.closest('[data-np-toggle]')) { togglePlay(); return; }
      if (t.closest('[data-np-prev]')) { goPrev(); return; }
      if (t.closest('[data-np-next]')) { goNext(); return; }
      if (t.closest('[data-np-shuffle]')) { toggleShuffle(); return; }
      if (t.closest('[data-np-repeat]')) { toggleRepeat(); return; }
      const grip = t.closest('[data-np-tile-grip]');
      if (grip) { saveCorner(otherSide(cornerRef.current)); placeTile(true); return; }
      const jump = t.closest<HTMLElement>('[data-np-jump]');
      if (jump) { goTo(parseInt(jump.getAttribute('data-np-jump') || '-1', 10)); return; }
      const seek = t.closest<HTMLElement>('[data-np-seek]');
      if (seek && root.contains(seek)) { seekTo(Number(seek.getAttribute('data-np-seek')) || 0, true); return; }
      if (t.closest('[data-np-close]')) { closePlayer(); return; }
      const npShare = t.closest('[data-np-share]');
      if (npShare) {
        const item = currentItem();
        if (item) share(npShare, new URL(item.href, window.location.origin).href, `${item.title} by ${item.band}`);
        return;
      }
      const shareBtn = t.closest('[data-share]');
      if (shareBtn) { share(shareBtn, window.location.href, document.title); return; }
      if (t.closest('[data-np-scroll-tracks]')) {
        viewRef.current?.querySelector('[data-np-queue="view"]')?.scrollIntoView({ behavior: mqCalm.matches ? 'auto' : 'smooth' });
        return;
      }

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
        activateRow(row);
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

    // Escape closes the view (not while typing in a field, which may use it).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isViewOpen() || e.defaultPrevented) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'range') return;
      if (tag === 'TEXTAREA') return;
      e.preventDefault();
      closeView();
    };
    document.addEventListener('keydown', onKey);
    root.addEventListener('keydown', onTileKey);
    root.addEventListener('keydown', onProgKey);
    root.addEventListener('input', onVolume);
    // The drag follows the pointer on document: a fast first move can leave the
    // tile before the pointer is captured (capturing at pointerdown would send a
    // plain tap's click to the tile instead of the grip or the video button).
    tileRef.current?.addEventListener('pointerdown', onTileDown);
    document.addEventListener('pointermove', onTileMove);
    document.addEventListener('pointerup', onTileUp);
    document.addEventListener('pointercancel', onTileUp);
    root.addEventListener('pointerdown', onProgDown);
    root.addEventListener('pointermove', onProgMove);
    root.addEventListener('pointerup', onProgUp);
    root.addEventListener('pointercancel', onProgUp);

    // ─── per-navigation hook (initial load AND every client-side navigation) ──
    // With ClientRouter this fires after each swap. We use it to lazy-cue the
    // player from the new page's data island. If a player already exists we do
    // NOT touch it — playback continues across navigation (the whole point).
    const onPageLoad = () => {
      paintAccent(document.documentElement);
      cueFromPage();
      updateTransport();
      syncCards();
      // The hero .js-pp button on the page we just swapped in is fresh markup
      // (default "paused"), while the PERSISTENT player toggles keep their state.
      // A stale "error" there would misrepresent this new page as broken.
      // clearPPError() only touches controls actually showing "error", so it
      // never interrupts audio still playing across the navigation.
      clearPPError();
      const data = readNpData();
      const onPlayingAlbum = isOpen() && pageIsPlayingAlbum(data);
      // The page we landed on IS the album that is playing: its hero button is
      // fresh markup stuck at "paused", while the video plays. The persisted bar
      // toggle is the node setPP kept current: copy its state to the new controls.
      if (onPlayingAlbum) {
        const state = document.getElementById('now-playing-toggle')?.getAttribute('data-state');
        if (state) document.querySelectorAll('.js-pp').forEach((n) => n.setAttribute('data-state', state));
      }
      // The hero button of the new page is fresh markup with the page's static
      // label; give it the one that matches its state.
      document.querySelectorAll('.js-pp').forEach(labelPP);
      // Sync the active-row highlight (its rows are fresh markup after the
      // swap) and the track name, which is only known from this page's tracklist.
      if (data && onPlayingAlbum) syncPlayingTrack(data);
      requestStage(400);
    };
    document.addEventListener('astro:page-load', onPageLoad);

    // ClientRouter replaces <html>'s attributes with the next page's, which carry
    // THAT page's colour (or none). Paint the incoming document first, so the
    // swap never shows the page's colour for a moment while an album plays. The
    // view closes: the listener asked for another page.
    const onBeforeSwap = (e: Event) => {
      const next = (e as Event & { newDocument?: Document }).newDocument;
      if (next?.documentElement) paintAccent(next.documentElement);
      closeView({ restore: false });
    };
    document.addEventListener('astro:before-swap', onBeforeSwap);

    // Layout, size and scroll changes move or resize the slots.
    const onResize = () => {
      if (stage.surface === 'tile') placeTile(false);
      requestStage(200);
    };
    const onLayout = () => {
      if (isViewOpen()) applyViewMode();
      onResize();
    };
    window.addEventListener('resize', onResize);
    mqPhone.addEventListener('change', onLayout);
    mqDesktop.addEventListener('change', onLayout);
    viewRef.current?.addEventListener('scroll', () => requestStage(0), { passive: true });
    dockRef.current?.addEventListener('scroll', () => requestStage(0), { passive: true });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => requestStage(0)) : null;
    $$('[data-np-slot]').forEach((s) => ro?.observe(s));

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
    paintAccent(document.documentElement);
    paintModes();
    // The first astro:page-load can fire before this island hydrates: label the
    // controls of the page we hydrated on now, too.
    document.querySelectorAll('.js-pp').forEach(labelPP);

    // ─── teardown ───────────────────────────────────────────────────────────
    // In practice this island persists (transition:persist) for the whole
    // metal-archive session, so teardown only runs on a full document unload.
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointermove', onTileMove);
      document.removeEventListener('pointerup', onTileUp);
      document.removeEventListener('pointercancel', onTileUp);
      document.removeEventListener('astro:page-load', onPageLoad);
      document.removeEventListener('astro:before-swap', onBeforeSwap);
      window.removeEventListener('resize', onResize);
      mqPhone.removeEventListener('change', onLayout);
      mqDesktop.removeEventListener('change', onLayout);
      ro?.disconnect();
      if (stage.raf) cancelAnimationFrame(stage.raf);
      clearApiTimeout();
      clearNotice();
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

  // ─── render ────────────────────────────────────────────────────────────────
  // Everything sits in #np-root (display: contents). Before the first play the
  // surfaces are hidden and the video box is rendered off-screen (the iframe has
  // to exist to be cued). Every surface starts EMPTY and is filled on each album
  // start; the [data-np-*] hooks are what the effect above writes into.
  const playIcons = (
    <>
      <svg class="ic ic-play" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z" /></svg>
      <svg class="ic ic-pause" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM14 5h4v14h-4z" /></svg>
    </>
  );
  const from = (cls: string) => (
    <p class={`np-from ${cls}`}>
      <span class="np-caps">Playing from</span>
      <a data-np-from href="#"><span data-np-from-label></span><Ic name="right" /></a>
    </p>
  );
  return (
    <div id="np-root" ref={rootRef}>
      {/* Desktop (>= 1100px, styles/archive.css): the right panel while an album
          is loaded. Labels, not headings: they repeat on every page. */}
      <aside id="np-dock" ref={dockRef} aria-label="Now playing" {...INERT}>
        <div class="np-dock__head">
          <p class="np-dock__label np-dock__label--now">Now playing</p>
          <p class="np-dock__label np-dock__label--queue">Queue</p>
          <button type="button" class="ma-circle np-dock__open" data-np-open aria-label="Open the full player">
            <Ic name="expand" />
          </button>
        </div>
        <button type="button" class="np-slot np-slot--panel" data-np-slot="panel" data-np-open aria-label="Open the full player">
          <span class="np-slot__art" data-np-poster></span>
        </button>
        <div class="np-dock__meta">
          <a class="np-dock__title" data-np-album data-np-title href="#"></a>
          <a class="np-dock__band" data-np-band href="#"></a>
        </div>
        <section class="np-queue" data-np-queue="dock" aria-label="Queue"></section>
      </aside>

      {/* The now-playing view: in place of the page on desktop and tablet, a
          full-screen sheet on the phone (role and modality set when it opens). */}
      <section id="np-view" ref={viewRef} class="np-view" aria-labelledby="np-title" {...INERT}>
        <div class="np-glow" aria-hidden="true" data-np-blur></div>
        <header class="np-head">
          <span class="np-head__grab" aria-hidden="true"></span>
          <button type="button" class="ma-circle" data-np-close-view aria-label="Close the player"><Ic name="down" /></button>
          {from('np-from--head')}
          <a class="ma-circle" data-np-album href="#" aria-label="Album details"><Ic name="info" /></a>
        </header>
        <div class="np-art np-slot" data-np-slot="art">
          <span class="np-art__blur" aria-hidden="true" data-np-blur></span>
        </div>
        <div class="np-scroll">
          <div class="np-info">
            {from('np-from--side')}
            <div class="np-id">
              <h2 class="np-title" id="np-title" data-np-title></h2>
              <a class="np-band" data-np-band href="#"></a>
              <p class="np-meta" data-np-meta hidden></p>
              <div class="np-tags" data-np-tags hidden></div>
              <div class="np-actions">
                <button type="button" class="np-iconbtn" data-np-share aria-label="Share"><Ic name="share" /></button>
                <a class="np-iconbtn" data-np-yt href="#" target="_blank" rel="noopener noreferrer" aria-label="Watch on YouTube"><Ic name="yt" /></a>
                <a class="np-iconbtn" data-np-album href="#" aria-label="Album details"><Ic name="info" /></a>
              </div>
            </div>
            <figure class="np-chap" data-np-chapters hidden>
              <div class="np-chap__bars" role="group" aria-label="Tracks by length" data-np-bars></div>
              <figcaption></figcaption>
            </figure>
          </div>

          <div class="np-transport">
            <div class="np-prog" data-np-prog role="slider" tabindex={0} aria-label="Seek" aria-valuemin={0} aria-valuemax={0} aria-valuenow={0}>
              <span class="np-segs" data-np-segs></span>
              <span class="np-thumb" aria-hidden="true"></span>
            </div>
            <div class="np-times"><span data-np-elapsed>0:00</span><span data-np-remain></span></div>
            <div class="np-ctrls">
              <button type="button" class="np-ctrl np-ctrl--side" data-np-shuffle aria-pressed="false" aria-label="Shuffle"><Ic name="shuffle" /></button>
              <button type="button" class="np-ctrl" data-np-prev aria-label="Previous album"><Ic name="prev" /></button>
              <button type="button" class="np-play js-pp" data-np-toggle data-state="paused" aria-label="Play">
                {playIcons}
                <span class="ic ic-spinner" aria-hidden="true"></span>
              </button>
              <button type="button" class="np-ctrl" data-np-next aria-label="Next album"><Ic name="next" /></button>
              <button type="button" class="np-ctrl np-ctrl--side" data-np-repeat aria-pressed="false" aria-label="Repeat album"><Ic name="repeat" /></button>
            </div>
            <div class="np-lower">
              <label class="np-vol">
                <Ic name="volume" />
                <input type="range" min={0} max={100} step={1} value={100} aria-label="Volume" data-np-volume />
                <span data-np-volume-out>100%</span>
              </label>
              <a class="np-link" data-np-yt href="#" target="_blank" rel="noopener noreferrer"><Ic name="yt" />Watch on YouTube</a>
            </div>
          </div>

          {/* Phone: the actions as a row of pills. */}
          <div class="np-secondary">
            <button type="button" data-np-share><span class="np-pill"><Ic name="share" /></span><span data-share-label>Share</span></button>
            <a data-np-yt href="#" target="_blank" rel="noopener noreferrer"><span class="np-pill"><Ic name="yt" /></span>YouTube</a>
            <button type="button" data-np-scroll-tracks><span class="np-pill"><Ic name="queue" /></span>Tracks</button>
            <button type="button" data-np-shuffle aria-pressed="false"><span class="np-pill"><Ic name="shuffle" /></span>Shuffle</button>
          </div>

          {/* Phone and tablet: the tracklist (desktop has it in the right panel). */}
          <section class="np-tracks" data-np-queue="view" aria-labelledby="np-tracks-h" hidden>
            <div class="np-tracks__head"><h3 id="np-tracks-h">Tracklist</h3><small data-np-count></small></div>
            <ol class="np-trks" data-np-tracks></ol>
          </section>
        </div>
      </section>

      {/* Phone and tablet with the view closed: the floating video. Drag it to a
          corner; the grip moves it to the other side; a tap opens the player. */}
      <div id="np-tile" ref={tileRef} data-corner="br" {...INERT}>
        <button type="button" class="np-tile__grip" data-np-tile-grip aria-label="Move the video to the left"><span aria-hidden="true"></span></button>
        <button type="button" class="np-slot np-tile__video" data-np-slot="tile" data-np-open aria-label="Open the full player">
          <span class="np-slot__art" data-np-poster></span>
        </button>
      </div>

      {/* THE video box: fixed, laid over the active slot by the stage (never moved
          in the DOM). Its overlays are the only parts that take clicks. */}
      <div id="mini-player" ref={miniPlayerRef}>
        <div id="yt-player" ref={ytHostRef} style={{ width: '100%', height: '100%' }} />

        <div id="mini-player-loader" class="mp-overlay" ref={loaderRef} style={{ display: 'none' }}>
          <div class="mp-spinner" />
          <span class="mp-overlay__text">Loading player…</span>
        </div>

        <div id="mini-player-error" class="mp-overlay" ref={errorRef} style={{ display: 'none' }}>
          <span class="mp-overlay__title">Video unavailable</span>
          <span class="mp-overlay__text">This video cannot be played here.</span>
          <a ref={ytErrorLinkRef} href="#" target="_blank" rel="noopener noreferrer" class="mp-overlay__link">
            Open on YouTube ↗
          </a>
        </div>

        <div id="mini-player-timeout" class="mp-overlay" ref={timeoutRef} style={{ display: 'none' }}>
          <span class="mp-overlay__title">The player is taking a while to load.</span>
          <span class="mp-overlay__text">Check your internet connection.</span>
          <button type="button" class="mp-retry" data-mp-retry="1">Retry</button>
        </div>
      </div>

      {/* The mini player bar. */}
      <div id="now-playing-bar" class="mbar">
        {/* "Skipped <album>: not available on YouTube" for a few seconds. Hidden
            from assistive tech: the same words go through #np-live. */}
        <p class="np-notice" ref={noticeRef} aria-hidden="true" hidden></p>

        <button type="button" class="mbar__open" data-np-open>
          <span class="sr-only">Open the full player: </span>
          <span class="mbar__art" ref={npArtRef}></span>
          <span class="mbar__text">
            <span id="now-playing-name" class="mbar__title" ref={npNameRef}></span>
            <span id="now-playing-artist" class="mbar__band" ref={npArtistRef}></span>
            <span class="mbar__track" ref={npTrackRef}></span>
          </span>
        </button>

        {/* Prev/next move between albums in the queue. */}
        <div class="mbar__ctrl np-controls">
          <button type="button" class="mbar__btn mbar__prev" aria-label="Previous album" data-np-prev="1"><Ic name="prev" /></button>
          <button type="button" id="now-playing-toggle" class="np-toggle js-pp" aria-label="Play" data-np-toggle="1" data-state="paused">
            {playIcons}
            <span class="ic ic-spinner" aria-hidden="true"></span>
          </button>
          <button type="button" class="mbar__btn" aria-label="Next album" data-np-next="1"><Ic name="next" /></button>
        </div>
        <div class="mbar__end">
          <button type="button" class="mbar__btn mbar__expand" data-np-open aria-label="Open the full player"><Ic name="expand" /></button>
          <button type="button" class="mbar__btn np-close" aria-label="Close player" data-np-close="1"><Ic name="close" /></button>
        </div>
        <div id="now-playing-progress" ref={npProgressRef} class="mbar__line">
          <div id="now-playing-progress-fill" class="np-progress-fill js-progress-fill" />
        </div>
      </div>

      {/* Polite live region — announces the album, the track and the player's
          own changes to screen readers. Lives in the persistent render. */}
      <span class="sr-only" aria-live="polite" id="np-live"></span>
    </div>
  );
}
