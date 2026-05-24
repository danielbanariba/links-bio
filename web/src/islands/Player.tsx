// YouTube player island — GLOBAL + PERSISTENT across client-side navigation.
//
// Originally ported from the Reflex `_PLAYER_JS` IIFE, this island used to be
// rendered per-album-page with build-time props and mounted ONCE per page. With
// Astro View Transitions (<ClientRouter />) the metal-archive section is now a
// single client-side app: this island is rendered from Navbar.astro with
// `transition:persist`, so the SAME instance (and its YT.Player) survives every
// navigation — audio keeps playing while the user browses, like a real music app.
//
// It owns the entire interactive surface: the hidden/expandable YT iframe
// (#yt-player inside the mini-player), the now-playing bar, and the overlay
// states (loader / error / timeout / buffering).
//
// DATA MODEL (no props anymore):
//   Each album page renders a JSON data island:
//     <script type="application/json" id="metal-np-data">{ videoId, ... }</script>
//   The island reads it on `astro:page-load` (initial load + every navigation).
//
// LIFECYCLE — CRITICAL because transition:persist means useEffect runs ONCE:
//   - useEffect (once): load the YT API, attach the delegated document click
//     handler, start the 1s progress interval, add the astro:page-load listener.
//   - astro:page-load: read #metal-np-data; if NO player is built yet AND album
//     data exists AND window.YT is ready, BUILD the player CUED with that videoId
//     (cueing needs no user gesture). If a player already exists, DON'T touch it
//     (keep current playback).
//   - FIRST PLAY (click): the player is already built+cued, so seekTo()+playVideo()
//     run SYNCHRONOUSLY inside the click handler — the user-gesture is preserved
//     so autoplay is allowed. THIS IS THE #1 THING THAT BREAKS IF DONE WRONG.
//   - SWITCH ALBUM (click on a different album's page): read THAT page's
//     #metal-np-data and call loadVideoById() SYNCHRONOUSLY in the click handler
//     (it loads+autoplays, gesture preserved), then repaint the now-playing bar.
//
// WHAT WAS PRESERVED EXACTLY:
//   - playerVars, the YT error codes (2/5/100/101/150), the buffering spinner,
//     the 1s progress tick (only while state===1) with per-track auto-advance,
//     the 8s API-load timeout + retry, the class-based multi-surface sync, the
//     share() feedback, and the mini-player expand toggle.

import { useEffect, useRef } from 'preact/hooks';

interface PlayerTrack {
  idx: number;
  name: string;
  seconds: number;
}

// Shape of the JSON the album page renders into #metal-np-data.
interface NpData {
  videoId: string;
  youtubeUrl: string;
  albumColor: string;
  albumTitle: string;
  bandName: string;
  coverThumb: string;
  tracks: PlayerTrack[];
}

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

  // Refs to the now-playing bar nodes we mutate imperatively.
  const npNameRef = useRef<HTMLSpanElement>(null);
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
    };
    const setPP = (state: 'playing' | 'paused' | 'buffering') => {
      document.querySelectorAll('.js-pp').forEach((el) => el.setAttribute('data-state', state));
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
      apiTimeoutRef.current = setTimeout(() => {
        if (window.YT && window.YT.Player) return;
        hide(loaderRef.current);
        show(timeoutRef.current);
      }, 8000);
    };

    // ─── theme the player chrome (color only — safe while merely cued) ───────
    const themePlayer = (color: string) => {
      if (!color) return;
      miniPlayerRef.current?.style.setProperty('--album-color', color);
      document.getElementById('now-playing-bar')?.style.setProperty('--album-color', color);
    };

    // ─── paint the now-playing bar for the album that just STARTED playing ───
    // Updates cover, artist, the two YouTube links and the accent color so the
    // persistent bar reflects whatever is currently playing (not the page being
    // viewed). The bar starts EMPTY and is filled here on first play / switch.
    const paintNowPlaying = (data: NpData) => {
      if (npCoverRef.current) {
        npCoverRef.current.src = data.coverThumb || '';
        npCoverRef.current.style.visibility = data.coverThumb ? 'visible' : 'hidden';
      }
      if (npArtistRef.current) npArtistRef.current.textContent = data.bandName || '';
      const href = data.youtubeUrl || '#';
      if (npYoutubeRef.current) npYoutubeRef.current.href = href;
      if (ytErrorLinkRef.current) ytErrorLinkRef.current.href = href;
      themePlayer(data.albumColor || '');
    };

    // ─── build the YT.Player ────────────────────────────────────────────────
    // `autoplay` distinguishes a lazy cue (initial page load, no gesture) from
    // a gesture-driven first build that should start playing immediately.
    const buildPlayer = (data: NpData, autoplay: boolean) => {
      const el = ytHostRef.current;
      if (!el) return;
      if (!data.videoId || !window.YT || !window.YT.Player) return;

      // API available — cancel the slow-network timeout.
      clearApiTimeout();
      if (el.querySelector('iframe')) return; // already built

      loadedVideoIdRef.current = data.videoId;
      playingTracksRef.current = data.tracks || [];
      // Reveal the mini-player now that it has real content (it starts hidden so
      // pages with no album — browse, forms, facets — don't show an empty box)
      // and tint it with the cued album's color. The now-playing BAR stays empty
      // (default accent, "Select a track") until the user presses play, when
      // paintNowPlaying fills it — see the click path.
      if (miniPlayerRef.current) {
        miniPlayerRef.current.style.display = '';
        if (data.albumColor) miniPlayerRef.current.style.setProperty('--album-color', data.albumColor);
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
          autoplay: autoplay ? 1 : 0,
        },
        events: {
          onReady: () => {
            hideAllOverlays();
            // A gesture-driven first build asks for playback explicitly too,
            // covering browsers that ignore the autoplay playerVar.
            if (autoplay) {
              try { playerRef.current?.playVideo(); } catch { /* ignore */ }
            }
          },
          onError: () => {
            // 2 invalid param, 5 HTML5 error, 100 removed/private,
            // 101/150 embedding disabled. Any of these = unplayable here.
            hide(loaderRef.current);
            hide(timeoutRef.current);
            show(errorRef.current);
            npClearBuffering();
            npSetGlyph('▶');
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
            }
          },
        },
      });
    };

    // ─── lazy-cue on page load ──────────────────────────────────────────────
    // Build the player CUED (no autoplay, no gesture needed) so the very first
    // click can play synchronously. Only runs when nothing is built yet.
    const cueFromPage = () => {
      if (playerRef.current) return;             // already have a player — leave playback alone
      const data = readNpData();
      if (!data) return;                          // page has no playable album
      if (!window.YT || !window.YT.Player) return; // API not ready yet — onYouTubeIframeAPIReady retries
      // Show the loader while the iframe boots; onReady/onError hide the overlays.
      show(loaderRef.current);
      buildPlayer(data, false);
    };

    // ─── retry (re-inject the API script if the first load failed) ──────────
    const retryPlayer = () => {
      hide(timeoutRef.current);
      hide(errorRef.current);
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
      }
      document.querySelectorAll('[data-track-idx]').forEach((r) => r.classList.remove('track-active'));
      rowEl.classList.add('track-active');
      currentIdxRef.current = idx;
      npResetProgress();

      const nameNode = rowEl.querySelector('[data-track-name]');
      const name = nameNode ? (nameNode.textContent || '').trim() : '';
      if (npNameRef.current && name) npNameRef.current.textContent = name;
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

    // ─── switch to a DIFFERENT album (the page being viewed is not the one
    //     playing). Loads + autoplays synchronously (gesture preserved) and
    //     repaints the now-playing bar. `startSeconds` lets a track click on the
    //     new album jump straight to that track. ────────────────────────────
    const switchAlbum = (data: NpData, startSeconds: number, idx: number) => {
      const p = playerRef.current;
      if (p && typeof p.loadVideoById === 'function') {
        try {
          p.loadVideoById({ videoId: data.videoId, startSeconds });
        } catch { /* ignore — player not ready */ }
      }
      loadedVideoIdRef.current = data.videoId;
      playingTracksRef.current = data.tracks || [];
      currentIdxRef.current = idx;
      npResetProgress();
      paintNowPlaying(data);

      // Highlight + name from the page's tracklist (we are on the new album's
      // page when switching, so its rows are in the DOM).
      document.querySelectorAll('[data-track-idx]').forEach((r) => r.classList.remove('track-active'));
      let name = '';
      if (idx >= 0) {
        const row = document.querySelector(`[data-track-idx="${idx}"]`);
        if (row) {
          row.classList.add('track-active');
          const nameNode = row.querySelector('[data-track-name]');
          name = nameNode ? (nameNode.textContent || '').trim() : '';
        }
      }
      if (!name && data.tracks && data.tracks.length && idx >= 0 && data.tracks[idx]) {
        name = data.tracks[idx].name || '';
      }
      if (name) {
        if (npNameRef.current) npNameRef.current.textContent = name;
        setNpTitle(name);
      } else if (npNameRef.current) {
        npNameRef.current.textContent = data.albumTitle || 'Now playing';
      }
    };

    // Is the album on the CURRENT page the same one currently loaded/playing?
    const pageIsPlayingAlbum = (data: NpData | null): boolean =>
      !!data && !!loadedVideoIdRef.current && data.videoId === loadedVideoIdRef.current;

    const togglePlay = () => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const s = p.getPlayerState();
        if (s === 1) p.pauseVideo();
        else p.playVideo();
      } catch { /* ignore */ }
    };

    // Tracks of the PLAYING album (survives navigation), falling back to the
    // current page's rows when nothing is playing yet.
    const playingTrackCount = () => {
      if (playingTracksRef.current.length) return playingTracksRef.current.length;
      return document.querySelectorAll('[data-track-idx]').length;
    };

    const navTrack = (delta: number) => {
      const count = playingTrackCount();
      if (!count) return;
      // From the "Select a track" state (idx -1), Next starts at 0 and Prev also
      // starts at 0 rather than wrapping to a negative index.
      const current = currentIdxRef.current < 0 ? (delta > 0 ? -1 : 0) : currentIdxRef.current;
      let next = current + delta;
      if (next < 0) next = 0;
      if (next > count - 1) next = count - 1;

      // Prefer the DOM row (we're on the playing album's page) so name/highlight
      // come straight from markup. Otherwise seek using the stored track list —
      // playback continues even though that album's rows aren't on this page.
      if (selectTrackByIndex(next)) return;
      const t = playingTracksRef.current[next];
      if (!t) return;
      const p = playerRef.current;
      if (p && typeof p.seekTo === 'function') {
        try { p.seekTo(t.seconds, true); p.playVideo(); } catch { /* ignore */ }
      }
      currentIdxRef.current = next;
      npResetProgress();
      if (npNameRef.current && t.name) npNameRef.current.textContent = t.name;
      setNpTitle(t.name);
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
        label.textContent = 'Link copied!';
        setTimeout(() => { label.textContent = prev; }, 1600);
      }
    };

    const toggleMiniSize = () => { miniPlayerRef.current?.classList.toggle('expanded'); };

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
              document.querySelectorAll('[data-track-idx]').forEach((r) => r.classList.remove('track-active'));
              target.classList.add('track-active');
              const nameNode = target.querySelector('[data-track-name]');
              name = nameNode ? (nameNode.textContent || '').trim() : '';
            }
            if (!name) {
              const t = playingTracksRef.current[cur_i + 1];
              name = t ? t.name : '';
            }
            if (name) {
              if (npNameRef.current) npNameRef.current.textContent = name;
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
      // doesn't also resize the player.
      const retry = t.closest('[data-mp-retry]');
      if (retry) { e.stopPropagation(); retryPlayer(); return; }

      // Transport that does NOT start a NEW album just acts on the player.
      const toggle = t.closest('[data-np-toggle]');
      if (toggle) { togglePlay(); return; }
      const prev = t.closest('[data-np-prev]');
      if (prev) { navTrack(-1); return; }
      const nxt = t.closest('[data-np-next]');
      if (nxt) { navTrack(1); return; }
      const shareBtn = t.closest('[data-share]');
      if (shareBtn) { share(shareBtn); return; }
      const mini = t.closest('[data-mini-toggle]');
      if (mini) { toggleMiniSize(); return; }

      // Play actions: a track row, the "play album" button, or the big main
      // play/pause. These may target the CURRENT page's album (already cued) OR
      // a DIFFERENT album (switch). Decide using the page's #metal-np-data.
      const row = t.closest('[data-track-idx]');
      const play = row ? null : t.closest('[data-play-album]');
      const main = row || play ? null : t.closest('[data-np-main]');
      if (!row && !play && !main) return;

      const pageData = readNpData();
      const isSwitch = pageData && !pageIsPlayingAlbum(pageData);

      if (row) {
        const idx = parseInt(row.getAttribute('data-track-idx') || '-1', 10);
        const sec = parseInt(row.getAttribute('data-seconds') || '0', 10) || 0;
        if (isSwitch && pageData) { switchAlbum(pageData, sec, idx); return; }
        // Same album as the cued/playing one: fill the bar (first play) then seek.
        if (pageData) paintNowPlaying(pageData);
        playTrackAt(row);
        return;
      }
      if (play) {
        if (isSwitch && pageData) {
          const startSeconds = pageData.tracks && pageData.tracks.length ? (pageData.tracks[0].seconds || 0) : 0;
          switchAlbum(pageData, startSeconds, pageData.tracks && pageData.tracks.length ? 0 : -1);
          return;
        }
        if (pageData) paintNowPlaying(pageData);
        playAlbum();
        return;
      }
      if (main) {
        // The big main button on a DIFFERENT album's page starts THAT album.
        if (isSwitch && pageData) {
          const startSeconds = pageData.tracks && pageData.tracks.length ? (pageData.tracks[0].seconds || 0) : 0;
          switchAlbum(pageData, startSeconds, pageData.tracks && pageData.tracks.length ? 0 : -1);
          return;
        }
        if (pageData) paintNowPlaying(pageData);
        mainPlayPause();
        return;
      }
    };
    document.addEventListener('click', onClick, true);

    // ─── per-navigation hook (initial load AND every client-side navigation) ──
    // With ClientRouter this fires after each swap. We use it to lazy-cue the
    // player from the new page's data island. If a player already exists we do
    // NOT touch it — playback continues across navigation (the whole point).
    const onPageLoad = () => {
      cueFromPage();
      // If the page we just landed on IS the album currently playing, sync the
      // active-row highlight (its rows are fresh markup after the swap).
      const data = readNpData();
      if (data && pageIsPlayingAlbum(data) && currentIdxRef.current >= 0) {
        const row = document.querySelector(`[data-track-idx="${currentIdxRef.current}"]`);
        if (row) row.classList.add('track-active');
      }
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
      if (readNpData()) armApiTimeout();
    }

    // ─── teardown ───────────────────────────────────────────────────────────
    // In practice this island persists (transition:persist) for the whole
    // metal-archive session, so teardown only runs on a full document unload.
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('astro:page-load', onPageLoad);
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

  // ─── render: mini-player (with overlays) + now-playing bar ────────────────
  // Mirrors mini_player.py + now_playing_bar.py. Hidden on mobile via CSS
  // (#mini-player + .now-playing-right are display:none ≤767px).
  //
  // No props now: the bar starts EMPTY ("Select a track", no cover) and is
  // filled by paintNowPlaying() on first play. --album-color is unset until then
  // (CSS falls back to the amber accent), then set imperatively per album.
  return (
    <>
      <div id="mini-player" ref={miniPlayerRef} data-mini-toggle="1" style={{ display: 'none' }}>
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
            Can't play it here.
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
            Check your connection.
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

      <div id="now-playing-bar">
        {/* left: cover + track/band */}
        <div class="np-left">
          <img id="now-playing-cover" class="np-cover" ref={npCoverRef} src="" alt="" style={{ visibility: 'hidden' }} />
          <div class="np-text">
            <span id="now-playing-name" ref={npNameRef} class="np-name">Select a track</span>
            <span id="now-playing-artist" ref={npArtistRef} class="np-artist"></span>
          </div>
        </div>

        {/* center: transport + progress */}
        <div class="np-center">
          <div class="np-controls">
            <button type="button" class="np-icon-btn" aria-label="Previous track" data-np-prev="1">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M5 6h2v12H5zM19 6v12l-9-6z"/></svg>
            </button>
            <button type="button" id="now-playing-toggle" class="np-toggle js-pp" aria-label="Play / pause" data-np-toggle="1" data-state="paused">
              <svg class="ic ic-play" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>
              <svg class="ic ic-pause" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM14 5h4v14h-4z"/></svg>
              <span class="ic ic-spinner" aria-hidden="true"></span>
            </button>
            <button type="button" class="np-icon-btn" aria-label="Next track" data-np-next="1">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M17 6h2v12h-2zM5 6v12l9-6z"/></svg>
            </button>
          </div>
          <div id="now-playing-progress" ref={npProgressRef} class="np-progress">
            <div id="now-playing-progress-fill" ref={npProgressFillRef} class="np-progress-fill js-progress-fill" />
          </div>
        </div>

        {/* right: youtube link (hidden on mobile) */}
        <div class="now-playing-right np-right">
          <a id="now-playing-youtube" ref={npYoutubeRef} href="#" target="_blank" rel="noopener noreferrer" class="np-yt-link">
            Watch on YouTube ↗
          </a>
        </div>
      </div>
    </>
  );
}
