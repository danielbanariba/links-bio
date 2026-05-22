// YouTube player island — ported faithfully from the Reflex `_PLAYER_JS` IIFE
// in links_bio/pages/metal_archive/album_detail.py.
//
// It owns the entire interactive surface: the hidden/expandable YT iframe
// (#yt-player inside the mini-player), the now-playing bar, and the overlay
// states (loader / error / timeout / buffering).
//
// WHAT WAS DROPPED vs the Reflex version (and WHY):
//   - window.__metalPlayerInit guard           -> each album is its own static
//   - window.metalSyncPlayer / cueVideoById     page now; the island mounts
//   - the body MutationObserver (froze main      ONCE and builds the player on
//     thread)                                    mount. No SPA navigation, so
//   - the on_load rx.call_script workaround      none of that machinery exists.
//   - runtime node-vibrant + metalApplyVibrant  -> color is baked at BUILD time
//     + the requestIdleCallback / tryVibrant       into --album-color (vibrant.ts).
//     retry loop
//
// WHAT WAS PRESERVED EXACTLY:
//   - The autoplay fix: a tracklist row click calls seekTo()+playVideo()
//     SYNCHRONOUSLY inside the click handler (no await, no backend round-trip)
//     so the browser keeps the user-gesture and allows playback.
//   - playerVars, the YT error codes, the buffering spinner, the 1s progress
//     tick (only while state===1), the 8s API-load timeout + retry.

import { useEffect, useRef } from 'preact/hooks';

interface PlayerTrack {
  idx: number;
  name: string;
  seconds: number;
}

interface PlayerProps {
  videoId: string;
  albumTitle: string;
  bandName: string;
  coverThumb: string;
  youtubeUrl: string;
  tracks: PlayerTrack[];
}

// Minimal YT typings — the IFrame API is loaded at runtime, no @types package.
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function Player(props: PlayerProps) {
  const { videoId, albumTitle, bandName, coverThumb, youtubeUrl, tracks } = props;

  // The YT.Player instance and the currently-active track index. Refs (not
  // state) because changing them must never trigger a Preact re-render — the
  // now-playing UI is updated imperatively, exactly like the Reflex version
  // touched the DOM directly, which keeps the autoplay path synchronous.
  const playerRef = useRef<any>(null);
  const currentIdxRef = useRef<number>(-1);
  const apiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs to the now-playing bar nodes we mutate imperatively.
  const npNameRef = useRef<HTMLSpanElement>(null);
  const npGlyphRef = useRef<HTMLSpanElement>(null);
  const npSpinnerRef = useRef<HTMLSpanElement>(null);
  const npProgressRef = useRef<HTMLDivElement>(null);
  const npProgressFillRef = useRef<HTMLDivElement>(null);
  const miniPlayerRef = useRef<HTMLDivElement>(null);
  const ytHostRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ─── overlay helpers (loader / error / timeout) ─────────────────────────
    const show = (el: HTMLElement | null) => { if (el) el.style.display = 'flex'; };
    const hide = (el: HTMLElement | null) => { if (el) el.style.display = 'none'; };
    const hideAllOverlays = () => {
      hide(loaderRef.current);
      hide(errorRef.current);
      hide(timeoutRef.current);
    };

    // ─── now-playing button glyph <-> spinner (buffering) ───────────────────
    const npSetGlyph = (ch: string) => {
      const g = npGlyphRef.current;
      const sp = npSpinnerRef.current;
      if (g) { g.textContent = ch; g.style.display = ''; }
      if (sp) sp.style.display = 'none';
    };
    const npSetBuffering = () => {
      const g = npGlyphRef.current;
      const sp = npSpinnerRef.current;
      if (g) g.style.display = 'none';
      if (sp) sp.style.display = 'block';
      npProgressRef.current?.classList.add('np-loading');
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

    // ─── build the YT.Player ────────────────────────────────────────────────
    const buildPlayer = () => {
      const el = ytHostRef.current;
      if (!el) return;
      if (!videoId || !window.YT || !window.YT.Player) return;

      // API available — cancel the slow-network timeout.
      clearApiTimeout();
      if (el.querySelector('iframe')) return; // already built

      playerRef.current = new window.YT.Player(el, {
        width: '100%',
        height: '100%',
        videoId: videoId,
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
        },
        events: {
          onReady: () => { hideAllOverlays(); },
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
              if (npProgressFillRef.current) npProgressFillRef.current.style.width = '100%';
            }
          },
        },
      });
    };

    // ─── retry (re-inject the API script if the first load failed) ──────────
    const retryPlayer = () => {
      hide(timeoutRef.current);
      hide(errorRef.current);
      show(loaderRef.current);
      if (window.YT && window.YT.Player) { buildPlayer(); return; }
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
      if (npProgressFillRef.current) npProgressFillRef.current.style.width = '0%';
    };

    // ─── the single source of truth for "make track N the active one" ───────
    // Click, prev/next, play-album and auto-advance ALL funnel through here so
    // the now-playing name, the active-row highlight, currentIdxRef and the
    // progress bar are updated identically no matter how the change was
    // triggered. (Previously prev/next reused this via playTrackAt, but the
    // progress fill was never reset on a track change.)
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

    const togglePlay = () => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const s = p.getPlayerState();
        if (s === 1) p.pauseVideo();
        else p.playVideo();
      } catch { /* ignore */ }
    };

    const trackCount = () => document.querySelectorAll('[data-track-idx]').length;

    const navTrack = (delta: number) => {
      const count = trackCount();
      if (!count) return;
      // From the "Select a track" state (idx -1), Next starts at 0 and Prev also
      // starts at 0 rather than wrapping to a negative index.
      const current = currentIdxRef.current < 0 ? (delta > 0 ? -1 : 0) : currentIdxRef.current;
      let next = current + delta;
      if (next < 0) next = 0;
      if (next > count - 1) next = count - 1;
      selectTrackByIndex(next);
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

    const toggleMiniSize = () => { miniPlayerRef.current?.classList.toggle('expanded'); };

    // Start-second of a track row by index (for auto-advance boundary checks).
    const trackSeconds = (idx: number): number | null => {
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
        if (npProgressFillRef.current) npProgressFillRef.current.style.width = pct + '%';

        // Auto-advance: if playback has crossed into the next track's range,
        // update the name + highlight (no seek — playback is already there).
        const cnt = trackCount();
        const cur_i = currentIdxRef.current;
        if (cnt > 1 && cur_i >= 0 && cur_i < cnt - 1) {
          const nextStart = trackSeconds(cur_i + 1);
          // Only meaningful when tracks actually carry distinct timestamps.
          if (nextStart && nextStart > 0 && cur >= nextStart) {
            const target = document.querySelector(`[data-track-idx="${cur_i + 1}"]`);
            if (target) {
              document.querySelectorAll('[data-track-idx]').forEach((r) => r.classList.remove('track-active'));
              target.classList.add('track-active');
              currentIdxRef.current = cur_i + 1;
              const nameNode = target.querySelector('[data-track-name]');
              const name = nameNode ? (nameNode.textContent || '').trim() : '';
              if (npNameRef.current && name) npNameRef.current.textContent = name;
            }
          }
        }
      } catch { /* ignore */ }
    };
    progressIntervalRef.current = setInterval(() => {
      try { progressTick(); } catch { /* ignore */ }
    }, 1000);

    // ─── single delegated click handler (capture phase, like Reflex) ────────
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!t || !t.closest) return;
      // Retry sits inside #mini-player; handle first and stop so the click
      // doesn't also resize the player.
      const retry = t.closest('[data-mp-retry]');
      if (retry) { e.stopPropagation(); retryPlayer(); return; }
      const row = t.closest('[data-track-idx]');
      if (row) { playTrackAt(row); return; }
      const play = t.closest('[data-play-album]');
      if (play) { playAlbum(); return; }
      const toggle = t.closest('[data-np-toggle]');
      if (toggle) { togglePlay(); return; }
      const prev = t.closest('[data-np-prev]');
      if (prev) { navTrack(-1); return; }
      const nxt = t.closest('[data-np-next]');
      if (nxt) { navTrack(1); return; }
      const mini = t.closest('[data-mini-toggle]');
      if (mini) { toggleMiniSize(); return; }
    };
    document.addEventListener('click', onClick, true);

    // ─── kick off the API load ──────────────────────────────────────────────
    // The previous onYouTubeIframeAPIReady (if any other island/page set one)
    // is preserved so we never clobber an unrelated callback.
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') { try { prevReady(); } catch { /* ignore */ } }
      clearApiTimeout();
      buildPlayer();
    };

    if (window.YT && window.YT.Player) {
      buildPlayer();
    } else {
      // Inject the IFrame API once. If it's mid-load from a prior mount the
      // existing tag is reused; onYouTubeIframeAPIReady fires for everyone.
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      }
      armApiTimeout();
    }

    // ─── teardown ───────────────────────────────────────────────────────────
    return () => {
      document.removeEventListener('click', onClick, true);
      clearApiTimeout();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
      }
      playerRef.current = null;
    };
    // Mount once per page (album pages are separate static pages). Props are
    // build-time constants for a given page, so an empty dep array is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── render: mini-player (with overlays) + now-playing bar ────────────────
  // Mirrors mini_player.py + now_playing_bar.py. Hidden on mobile via CSS
  // (#mini-player + .now-playing-right are display:none ≤767px).
  return (
    <>
      <div id="mini-player" ref={miniPlayerRef} data-mini-toggle="1">
        <div id="yt-player" ref={ytHostRef} style={{ width: '100%', height: '100%' }} />

        <div id="mini-player-loader" class="mp-overlay" ref={loaderRef}>
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
            href={youtubeUrl || '#'}
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
          <img id="now-playing-cover" class="np-cover" src={coverThumb} alt="" />
          <div class="np-text">
            <span id="now-playing-name" ref={npNameRef} class="np-name">Select a track</span>
            <span id="now-playing-artist" class="np-artist">{bandName}</span>
          </div>
        </div>

        {/* center: transport + progress */}
        <div class="np-center">
          <div class="np-controls">
            <button type="button" class="np-icon-btn" aria-label="Previous" data-np-prev="1">⏮</button>
            <button type="button" id="now-playing-toggle" class="np-toggle" aria-label="Play / pause" data-np-toggle="1">
              <span id="now-playing-toggle-glyph" ref={npGlyphRef}>▶</span>
              <span id="now-playing-toggle-spinner" ref={npSpinnerRef} class="mp-spinner mp-spinner-sm" style={{ display: 'none' }} />
            </button>
            <button type="button" class="np-icon-btn" aria-label="Next" data-np-next="1">⏭</button>
          </div>
          <div id="now-playing-progress" ref={npProgressRef} class="np-progress">
            <div id="now-playing-progress-fill" ref={npProgressFillRef} class="np-progress-fill" />
          </div>
        </div>

        {/* right: youtube link (hidden on mobile) */}
        <div class="now-playing-right np-right">
          <a id="now-playing-youtube" href={youtubeUrl || '#'} target="_blank" rel="noopener noreferrer" class="np-yt-link">
            Watch on YouTube ↗
          </a>
        </div>
      </div>
    </>
  );
}
