import reflex as rx
from links_bio.styles.styles import (
    ALBUM_DETAIL_MAX_WIDTH,
    XEROX_NOISE_URL,
    hero_section_style,
    hero_inner_style,
    hero_cover_style,
    hero_release_type_style,
    hero_band_name_style,
    hero_album_title_style,
    hero_meta_style,
    play_button_circle_style,
    track_table_header_style,
    track_table_row_style,
)
from links_bio.styles.colors import Color, TextColor
from links_bio.constants.images import DEFAULT_ALBUM_ARTWORK
from links_bio.states.metal_archive_state import MetalArchiveState
from links_bio.components.metal.metal_navbar import metal_navbar
from links_bio.components.metal.streaming_links import streaming_links
from links_bio.components.metal.album_card import album_card
from links_bio.components.metal.now_playing_bar import now_playing_bar
from links_bio.components.metal.mini_player import mini_player
from links_bio.components.footer import footer


_ALBUM_DETAIL_CSS = """
html, body { overflow-x: hidden; }
:root { --album-color: """ + Color.PRIMARY.value + """; }
body {
  background:
    radial-gradient(ellipse 120% 700px at top, var(--album-color) -30%, transparent 60%),
    """ + Color.BACKGROUND.value + """;
  background-attachment: fixed;
}
#album-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: """ + XEROX_NOISE_URL + """;
  background-repeat: repeat;
  opacity: 0.08;
  mix-blend-mode: overlay;
  pointer-events: none;
  z-index: 0;
}
#album-hero > * { position: relative; z-index: 1; }
.track-row { color: """ + TextColor.HEADER.value + """; }
.track-row:hover { background: """ + Color.SECONDARY.value + """4d; }
.track-row:hover .track-number { display: none; }
.track-row:hover .track-play-icon { display: inline; color: """ + TextColor.HEADER.value + """; }
.track-play-icon { display: none; font-size: 0.85em; }
.track-row.track-active { background: color-mix(in srgb, var(--album-color) 13%, transparent) !important; border-left: 2px solid var(--album-color) !important; }
.track-row.track-active .track-title { color: var(--album-color); font-weight: 500; }
.track-row.track-active .track-number { display: none; }
.track-row.track-active .track-active-icon { display: inline; color: var(--album-color) !important; }
.track-active-icon { display: none; font-size: 0.9em; }
#mini-player.expanded { width: 480px; height: 270px; }
#mini-player iframe { border: 0; pointer-events: none; }
@media (max-width: 767px) {
  #mini-player { display: none !important; }
  .now-playing-right { display: none !important; }
  #now-playing-bar { padding-left: 0.6em !important; padding-right: 0.6em !important; }
  #now-playing-bar .np-cover { width: 40px !important; height: 40px !important; }
  #now-playing-progress { max-width: 100% !important; }
  #album-hero h1 { letter-spacing: -0.02em; }
}
@media (max-width: 480px) {
  #now-playing-name, #now-playing-artist { max-width: 140px !important; }
}
body { padding-bottom: 80px; }
"""


_PLAYER_JS = """
(function() {
  if (window.__metalPlayerInit) return;
  window.__metalPlayerInit = true;

  var DEFAULT_HERO_GRADIENT =
    'linear-gradient(180deg, """ + Color.SECONDARY.value + """ 0%, """ + Color.SECONDARY.value + """80 35%, """ + Color.BACKGROUND.value + """ 100%)';

  function buildPlayer() {
    var el = document.getElementById('yt-player');
    if (!el) return;
    var vid = el.getAttribute('data-video-id');
    if (!vid || !window.YT || !window.YT.Player) return;

    if (el.querySelector('iframe')) {
      if (window.metalPlayer && typeof window.metalPlayer.cueVideoById === 'function') {
        try { window.metalPlayer.cueVideoById(vid); } catch (e) {}
      }
      return;
    }

    if (window.metalPlayer) {
      try { window.metalPlayer.destroy(); } catch (e) {}
      window.metalPlayer = null;
    }

    window.metalPlayer = new YT.Player('yt-player', {
      width: '100%',
      height: '100%',
      videoId: vid,
      playerVars: {
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        controls: 0,
        disablekb: 1,
        iv_load_policy: 3,
        fs: 0,
        showinfo: 0,
        enablejsapi: 1
      },
      events: {
        onStateChange: function(e) {
          var btn = document.getElementById('now-playing-toggle');
          if (!btn) return;
          if (e.data === 1) { btn.textContent = '⏸'; }
          else if (e.data === 2 || e.data === 0) { btn.textContent = '▶'; }
        }
      }
    });
  }

  window.onYouTubeIframeAPIReady = buildPlayer;
  if (window.YT && window.YT.Player) buildPlayer();

  var ytObserver = new MutationObserver(function() { buildPlayer(); });
  ytObserver.observe(document.body, { childList: true, subtree: true });

  window.playTrackAt = function(el) {
    if (!el) return;
    var sec = parseInt(el.getAttribute('data-seconds'), 10) || 0;
    var idx = parseInt(el.getAttribute('data-track-idx'), 10);
    if (window.metalPlayer && typeof window.metalPlayer.seekTo === 'function') {
      try {
        window.metalPlayer.seekTo(sec, true);
        window.metalPlayer.playVideo();
      } catch (err) {}
    }
    document.querySelectorAll('[data-track-idx]').forEach(function(r) {
      r.classList.remove('track-active');
    });
    el.classList.add('track-active');
    window.metalCurrentTrackIdx = idx;

    var nameNode = el.querySelector('[data-track-name]');
    var name = nameNode ? nameNode.textContent.trim() : '';
    var npName = document.getElementById('now-playing-name');
    if (npName && name) npName.textContent = name;
  };

  window.metalTogglePlay = function() {
    if (!window.metalPlayer) return;
    try {
      var s = window.metalPlayer.getPlayerState();
      if (s === 1) { window.metalPlayer.pauseVideo(); }
      else { window.metalPlayer.playVideo(); }
    } catch (err) {}
  };

  window.metalNavTrack = function(delta) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('[data-track-idx]'));
    if (!rows.length) return;
    var current = typeof window.metalCurrentTrackIdx === 'number' ? window.metalCurrentTrackIdx : -1;
    var next = current + delta;
    if (next < 0) next = 0;
    if (next > rows.length - 1) next = rows.length - 1;
    var target = rows.find(function(r){ return parseInt(r.getAttribute('data-track-idx'),10) === next; });
    if (target) window.playTrackAt(target);
  };

  window.metalToggleMiniSize = function() {
    var mp = document.getElementById('mini-player');
    if (mp) mp.classList.toggle('expanded');
  };

  window.metalApplyVibrant = function() {
    var img = document.getElementById('album-cover-img');
    var hero = document.getElementById('album-hero');
    if (!img || !hero) return;
    var applyFallback = function() {
      hero.style.background = DEFAULT_HERO_GRADIENT;
      document.documentElement.style.setProperty('--album-color', '""" + Color.PRIMARY.value + """');
    };
    var run = function() {
      if (!window.Vibrant) { applyFallback(); return; }
      try {
        Vibrant.from(img.src).getPalette().then(function(palette) {
          try {
            var swatch =
              palette.Vibrant || palette.DarkVibrant ||
              palette.Muted || palette.DarkMuted;
            if (!swatch) { applyFallback(); return; }
            var c = swatch.getHex();
            document.documentElement.style.setProperty('--album-color', c);
            hero.style.background =
              'linear-gradient(180deg, ' + c + 'cc 0%, ' + c + '55 40%, """ + Color.BACKGROUND.value + """ 100%)';
          } catch (inner) { applyFallback(); }
        }).catch(function(){ applyFallback(); });
      } catch (e) { applyFallback(); }
    };
    if (img.complete && img.naturalWidth > 0) run();
    else {
      img.addEventListener('load', run);
      img.addEventListener('error', applyFallback);
    }
  };

  window.metalProgressTick = function() {
    if (!window.metalPlayer || typeof window.metalPlayer.getCurrentTime !== 'function') return;
    try {
      var dur = window.metalPlayer.getDuration();
      var cur = window.metalPlayer.getCurrentTime();
      if (!dur) return;
      var pct = Math.min(100, (cur / dur) * 100);
      var bar = document.getElementById('now-playing-progress-fill');
      if (bar) bar.style.width = pct + '%';
    } catch (e) {}
  };
  setInterval(function() { try { window.metalProgressTick(); } catch(e){} }, 1000);

  function tryVibrant(retries) {
    if (window.Vibrant) { window.metalApplyVibrant(); return; }
    if (retries <= 0) return;
    setTimeout(function(){ tryVibrant(retries - 1); }, 200);
  }
  setTimeout(function(){ tryVibrant(20); }, 100);

  document.addEventListener('click', function(e) {
    var row = e.target.closest && e.target.closest('[data-track-idx]');
    if (row) { window.playTrackAt(row); return; }
    var play = e.target.closest && e.target.closest('[data-play-album]');
    if (play) {
      var first = document.querySelector('[data-track-idx]');
      if (first) { window.playTrackAt(first); }
      else if (window.metalPlayer && typeof window.metalPlayer.playVideo === 'function') {
        try { window.metalPlayer.seekTo(0, true); } catch(_) {}
        window.metalPlayer.playVideo();
      }
      return;
    }
    var toggle = e.target.closest && e.target.closest('[data-np-toggle]');
    if (toggle) { window.metalTogglePlay(); return; }
    var prev = e.target.closest && e.target.closest('[data-np-prev]');
    if (prev) { window.metalNavTrack(-1); return; }
    var nxt = e.target.closest && e.target.closest('[data-np-next]');
    if (nxt) { window.metalNavTrack(1); return; }
    var mini = e.target.closest && e.target.closest('[data-mini-toggle]');
    if (mini) { window.metalToggleMiniSize(); return; }
  }, true);
})();
"""


def _track_row(track: rx.Var, idx: rx.Var) -> rx.Component:
    return rx.el.div(
        rx.el.div(
            rx.el.span(
                track["track_number"],
                class_name="track-number",
                style={"color": TextColor.FOOTER.value},
            ),
            rx.el.span(
                "▸",
                class_name="track-play-icon",
            ),
            rx.el.span(
                "▸",
                class_name="track-active-icon",
            ),
            style={
                "text_align": "center",
                "font_size": "0.95em",
            },
        ),
        rx.el.span(
            track["track_name"],
            class_name="track-title",
            custom_attrs={"data-track-name": "1"},
            style={
                "color": TextColor.HEADER.value,
                "font_size": "0.95em",
                "overflow": "hidden",
                "text_overflow": "ellipsis",
                "white_space": "nowrap",
                "min_width": "0",
            },
        ),
        rx.el.span(
            track["timestamp"],
            style={
                "color": TextColor.FOOTER.value,
                "font_size": "0.85em",
                "text_align": "right",
                "font_variant_numeric": "tabular-nums",
            },
        ),
        class_name="track-row",
        custom_attrs={
            "data-track-idx": idx.to_string(),
            "data-seconds": track["seconds"].to_string(),
        },
        style=track_table_row_style,
    )


def _hero(album: rx.Var, artwork: rx.Var) -> rx.Component:
    n_tracks = MetalArchiveState.current_tracks.length()
    return rx.el.div(
        rx.el.div(
            rx.el.div(
                rx.el.img(
                    src=artwork,
                    id="album-cover-img",
                    alt=album["album_title"],
                    loading="eager",
                    style=hero_cover_style,
                ),
                rx.el.div(
                    rx.el.div(
                        album["release_type"],
                        style=hero_release_type_style,
                    ),
                    rx.el.h1(
                        album["band_name"],
                        style=hero_band_name_style,
                    ),
                    rx.el.div(
                        album["album_title"],
                        style=hero_album_title_style,
                    ),
                    rx.el.div(
                        rx.fragment(
                            rx.el.span(album["genre"]),
                            rx.el.span(" • ", style={"color": TextColor.FOOTER.value}),
                            rx.el.span(album["year"].to_string()),
                            rx.el.span(" • ", style={"color": TextColor.FOOTER.value}),
                            rx.el.span(n_tracks.to_string() + " canciones"),
                            rx.cond(
                                album["duration_minutes"] != 0,
                                rx.fragment(
                                    rx.el.span(" • ", style={"color": TextColor.FOOTER.value}),
                                    rx.el.span(album["duration_minutes"].to_string() + " min"),
                                ),
                            ),
                        ),
                        style=hero_meta_style,
                    ),
                    style={
                        "display": "flex",
                        "flex_direction": "column",
                        "gap": "0.6em",
                        "justify_content": "flex-end",
                        "min_width": "0",
                        "flex": "1",
                    },
                ),
                style={
                    "display": "flex",
                    "flex_direction": rx.breakpoints(initial="column", md="row"),
                    "align_items": rx.breakpoints(initial="center", md="flex-end"),
                    "text_align": rx.breakpoints(initial="center", md="left"),
                    "gap": rx.breakpoints(initial="1.2em", md="1.8em"),
                    "width": "100%",
                },
            ),
            rx.el.div(
                rx.el.button(
                    rx.el.span(
                        "▶",
                        style={
                            "font_size": "1.4em",
                            "margin_left": "0.15em",
                            "line_height": "1",
                        },
                    ),
                    custom_attrs={
                        "aria-label": "Reproducir álbum",
                        "data-play-album": "1",
                    },
                    style=play_button_circle_style,
                ),
                style={
                    "display": "flex",
                    "align_items": "center",
                    "gap": "0.8em",
                    "margin_top": "1.5em",
                    "justify_content": rx.breakpoints(initial="center", md="flex-start"),
                },
            ),
            style=hero_inner_style,
        ),
        id="album-hero",
        style=hero_section_style,
    )


def _tracklist() -> rx.Component:
    return rx.cond(
        MetalArchiveState.current_tracks_with_seconds.length() > 0,
        rx.el.section(
            rx.el.div(
                rx.el.div("#", style={"text_align": "center"}),
                rx.el.div("Título"),
                rx.el.div("⏱", style={"text_align": "right"}),
                style=track_table_header_style,
            ),
            rx.el.div(
                rx.foreach(
                    MetalArchiveState.current_tracks_with_seconds,
                    lambda track, idx: _track_row(track, idx),
                ),
                style={
                    "display": "flex",
                    "flex_direction": "column",
                    "gap": "0.1em",
                    "margin_top": "0.3em",
                },
            ),
            style={
                "width": "100%",
                "padding_x": "0.4em",
            },
        ),
    )


def _streaming_section(album: rx.Var) -> rx.Component:
    return rx.el.section(
        rx.el.div(
            "Escuchá este álbum en otras plataformas",
            style={
                "color": TextColor.FOOTER.value,
                "font_size": "0.75em",
                "letter_spacing": "0.1em",
                "text_transform": "uppercase",
                "font_weight": "500",
                "margin_bottom": "0.8em",
            },
        ),
        streaming_links(album),
        style={
            "width": "100%",
            "padding_top": "1.5em",
            "padding_bottom": "0.5em",
            "border_top": f"1px solid {Color.SECONDARY.value}",
            "margin_top": "1.5em",
        },
    )


def _similar_bands_section() -> rx.Component:
    return rx.cond(
        MetalArchiveState.current_similar_bands.length() > 0,
        rx.el.section(
            rx.el.h2(
                "Bandas similares",
                style={
                    "font_size": "1.3em",
                    "color": TextColor.HEADER.value,
                    "margin_bottom": "0.6em",
                },
            ),
            rx.el.div(
                rx.foreach(
                    MetalArchiveState.current_similar_bands,
                    lambda name: rx.el.span(
                        name,
                        style={
                            "background": Color.CONTENT.value,
                            "color": TextColor.BODY.value,
                            "padding": "0.4em 0.9em",
                            "border_radius": "999px",
                            "font_size": "0.85em",
                            "border": f"1px solid {Color.SECONDARY.value}",
                        },
                    ),
                ),
                style={
                    "display": "flex",
                    "flex_wrap": "wrap",
                    "gap": "0.5em",
                },
            ),
            style={
                "width": "100%",
                "padding_top": "1em",
            },
        ),
    )


def _similar_albums_section() -> rx.Component:
    return rx.cond(
        MetalArchiveState.similar_albums.length() > 0,
        rx.el.section(
            rx.el.h2(
                "Si te gustó esto, escuchá...",
                style={
                    "font_size": rx.breakpoints(initial="1.3em", md="1.6em"),
                    "color": TextColor.HEADER.value,
                    "margin_bottom": "0.8em",
                    "font_weight": "700",
                    "letter_spacing": "-0.01em",
                },
            ),
            rx.grid(
                rx.foreach(
                    MetalArchiveState.similar_albums,
                    album_card,
                ),
                columns=rx.breakpoints(initial="2", sm="3", md="4"),
                spacing="4",
                width="100%",
            ),
            style={
                "width": "100%",
                "padding_top": "1.5em",
            },
        ),
    )


def _more_to_explore_section() -> rx.Component:
    return rx.cond(
        MetalArchiveState.more_to_explore.length() > 0,
        rx.el.section(
            rx.el.div(
                rx.el.h2(
                    "Seguí explorando el archivo",
                    style={
                        "font_size": rx.breakpoints(initial="1.3em", md="1.6em"),
                        "color": TextColor.HEADER.value,
                        "font_weight": "700",
                        "letter_spacing": "-0.01em",
                    },
                ),
                rx.el.a(
                    "Ver todo →",
                    href="/metal-archive/browse",
                    style={
                        "color": Color.PRIMARY.value,
                        "font_size": "0.9em",
                        "text_decoration": "none",
                        "font_weight": "600",
                    },
                ),
                style={
                    "display": "flex",
                    "justify_content": "space-between",
                    "align_items": "center",
                    "margin_bottom": "0.8em",
                },
            ),
            rx.grid(
                rx.foreach(
                    MetalArchiveState.more_to_explore,
                    album_card,
                ),
                columns=rx.breakpoints(initial="2", sm="3", md="4"),
                spacing="4",
                width="100%",
            ),
            style={
                "width": "100%",
                "padding_top": "2em",
                "padding_bottom": "1em",
                "border_top": f"1px solid {Color.SECONDARY.value}",
                "margin_top": "2em",
            },
        ),
    )


def album_detail_page() -> rx.Component:
    album = MetalArchiveState.current_album
    artwork = rx.cond(
        album["album_artwork_url"] != "",
        album["album_artwork_url"],
        DEFAULT_ALBUM_ARTWORK,
    )

    return rx.box(
        rx.el.style(_ALBUM_DETAIL_CSS),
        metal_navbar(),
        rx.cond(
            MetalArchiveState.current_album.length() > 0,
            rx.box(
                rx.el.div(
                    _hero(album, artwork),
                    rx.el.div(
                        _tracklist(),
                        _streaming_section(album),
                        _similar_bands_section(),
                        _similar_albums_section(),
                        _more_to_explore_section(),
                        style={
                            "padding_x": rx.breakpoints(initial="1.2em", md="2.5em", lg="3em"),
                            "padding_top": "1.8em",
                            "padding_bottom": "2em",
                            "display": "flex",
                            "flex_direction": "column",
                            "gap": "0.5em",
                        },
                    ),
                    style={
                        "max_width": ALBUM_DETAIL_MAX_WIDTH,
                        "margin": "0 auto",
                        "width": "100%",
                    },
                ),
                mini_player(album["youtube_video_id"]),
                now_playing_bar(album),
                rx.script(src="https://www.youtube.com/iframe_api"),
                rx.script(src="https://cdn.jsdelivr.net/npm/node-vibrant@3.1.6/dist/vibrant.min.js"),
                rx.script(_PLAYER_JS),
                width="100%",
            ),
            rx.center(
                rx.text(
                    "Álbum no encontrado.",
                    color=TextColor.BODY.value,
                    font_size="1.2em",
                ),
                padding_y="5em",
            ),
        ),
        footer(),
    )
