# Design System — Daniel Banariba Portfolio

**Direction:** B — Xerox Underground
**Status:** SOURCE OF TRUTH. All pages consume this. Page-level overrides live in `design-system/pages/<page>.md`.
**Last updated:** 2026-04-19

---

## 1. Identity & Voice

**Who:** Daniel Banariba — productor audiovisual para bandas de metal underground en Honduras y LatAm. 6000+ subs YouTube, 40+ videos, 100+ bandas documentadas. También dev web.

**Aesthetic reference:** Zines xerografiados, flyers de shows de sótano, portadas de demo cassette 90s, zines tipo *Sick Mosh*, *Maximum Rocknroll*, *Slayer Mag*, inserts de Earache/Relapse/Peaceville.

**Voice:** Crudo, directo, underground, pro sin corporate. Anti-fashion. Anti-template. Anti-AI-slop. Lo-fi por elección, no por pobreza.

**Anti-references:** Pitchfork-metal, Decibel airport-metal, Netflix-thumbnails, A24-portfolio, Figma-brutalism 2024 (acid yellow on black is CANCELLED for this brand), glassmorphism, gradient-slop, emoji anywhere.

---

## 2. Color Tokens

Dark-only. No light mode. No exceptions. Underground no usa light mode.

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#09090B` | Canvas. Rich black, 1 step off `#000` to avoid OLED burn and let text breathe. |
| `--bg-elevated` | `#0F0F11` | Cards, sections that need separation from canvas. Subtle. |
| `--fg` | `#F5F1E8` | Primary text + display. **Bone off-white** (color de papel de zine viejo). NEVER pure `#FFFFFF` — pure white reads digital-Netflix, bone reads printed-paper. |
| `--fg-muted` | `#A1A1AA` | Secondary text, metadata, timestamps, counters. Zinc-400 equivalent. |
| `--fg-dim` | `#52525B` | Tertiary text, dividers with text, "read more" hints. |
| `--accent` | `#8B0000` | **Blood red desaturado** (sangre seca, no rojo Coca-Cola). Reserved for: primary CTA hovers, active states, destructive actions, "LIVE" / "NEW" tags. **Use surgically — max 1 element per viewport.** |
| `--accent-hover` | `#A30000` | Only on hover of accent elements. |
| `--border` | `#27272A` | Default 2px borders on cards, sections, CTAs. Zinc-800. |
| `--border-strong` | `#3F3F46` | Dividers between major sections, marquee rails. Zinc-700. |
| `--border-inverted` | `#F5F1E8` | Borders on accent/inverted blocks (card flood inversion). |

**Rules:**
- **NO gradients.** Ever. Flat color only.
- **NO shadows.** Depth comes from 2px borders + flat color blocks.
- **NO glow/blur effects.** Exception: a single `text-shadow` hairline on the hero band-name marquee for slight CRT-scan feel (optional, subtle).
- **NO additional accent colors.** Blood red is THE accent. Don't add blue, green, orange "for variety".

---

## 3. Typography

Tri-stack. Each font has ONE job — don't mix roles.

### Fonts

| Role | Font | Weight | Source |
|------|------|--------|--------|
| Display (hero, section headlines) | **Archivo Black** | 900 (only weight it ships) | Google Fonts |
| Body + UI | **Inter** | 400, 500, 600, 700 | Google Fonts |
| Metadata, labels, counters, stats, marquee | **JetBrains Mono** | 400, 500 | Google Fonts |
| Existing brand/decorative | **Pulse_virgin** (already in repo) | — | Local (keep for logo/brand moments only, don't use in body) |

**Why this stack:**
- Archivo Black = band-logo vibe, massive, condensed-adjacent, uppercase-friendly. Zero elegance, maximum impact.
- Inter for body because readability wins. This is not a poster, people need to read project descriptions.
- JetBrains Mono for labels = tracklist / tape-insert / terminal vibe. Underground credibility via technical honesty.
- Pulse_virgin (already in `styles/fonts.py`) can stay for the H1 identity moment if we want to honor the existing brand — but not as a workhorse.

### Type Scale (mobile / desktop)

| Token | Mobile | Desktop | Weight | Case | Tracking | Leading | Font |
|-------|--------|---------|--------|------|----------|---------|------|
| `display-hero` | 56px | 96px | 900 | UPPERCASE | `-0.03em` | 0.9 | Archivo Black |
| `display-xl` | 40px | 64px | 900 | UPPERCASE | `-0.02em` | 0.95 | Archivo Black |
| `display-lg` | 32px | 48px | 900 | UPPERCASE | `-0.01em` | 1.0 | Archivo Black |
| `heading-lg` | 24px | 32px | 700 | Title Case | `-0.01em` | 1.2 | Inter |
| `heading-md` | 20px | 24px | 600 | Title Case | `0` | 1.3 | Inter |
| `body-lg` | 18px | 18px | 400 | — | `0` | 1.6 | Inter |
| `body` | 16px | 16px | 400 | — | `0` | 1.6 | Inter |
| `body-sm` | 14px | 14px | 400 | — | `0` | 1.5 | Inter |
| `label` | 12px | 12px | 500 | UPPERCASE | `+0.12em` | 1.4 | JetBrains Mono |
| `caption` | 11px | 11px | 400 | UPPERCASE | `+0.15em` | 1.4 | JetBrains Mono |

**Rules:**
- Every `label`, `caption`, and metadata string (views, year, dates, "WATCH NOW", "BAND SUBMISSIONS") is **UPPERCASE mono with wide tracking**. No exceptions.
- Display text is always UPPERCASE.
- Body text is normal case.
- No italics anywhere except for band names in quotes (rare).
- Line-height NEVER below 0.9. Above 1.7 also banned — this is brutal, not airy.

---

## 4. Spacing Scale

Base unit = **4px**. Rhythm multiples of 4/8.

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Icon-to-label gaps, tight inline |
| `space-2` | 8px | Default small gap |
| `space-3` | 12px | Form field gaps |
| `space-4` | 16px | Default component padding |
| `space-5` | 24px | Card padding, section inner gap |
| `space-6` | 32px | Between related sections |
| `space-8` | 48px | Between major sections on mobile |
| `space-10` | 64px | Between major sections on desktop |
| `space-12` | 96px | Hero vertical breathing |
| `space-16` | 128px | Landing-level dividers on desktop |

**Container max-width:** keep the existing `MAX_WIDTH` approach. Target `640px` for bio/links column, `1280px` for Metal Archive grid (already defined, leave it).

---

## 5. Borders, Radius, Shape

- **`--radius: 0px` on EVERYTHING.** Buttons, cards, images, inputs, avatars. Zero exceptions.
  - Exception allowed: the avatar circle in the header (existing `rx.avatar` with radius) — keep IF you want to preserve the current identity, OR switch to square frame with 2px border for full commitment. **Recommendation: square with 2px border**, frame the face like a mugshot on a flyer.
- **Border width:**
  - `1px` — hairline dividers between list items, subtle separators
  - `2px` — default on cards, buttons, sections
  - `4px` — section dividers, hero bottom rule, "brutal" emphasis moments
- **Border color default:** `--border` (`#27272A`)
- **Border color on hover/focus:** `--fg` (`#F5F1E8`) — pops without being loud

---

## 6. Motion Tokens

Underground motion. No cinematic. No bouncy. No "delightful".

| Token | Value | Easing | Usage |
|-------|-------|--------|-------|
| `motion-instant` | 0ms | — | State inversions (card flood on press) — must feel mechanical |
| `motion-fast` | 100ms | `linear` | Hover color changes, border color shifts |
| `motion-base` | 150ms | `ease-out` | Button hover fills, link underlines |
| `motion-marquee` | 6000ms | `linear` infinite | Band-name / stack marquee loop |
| `motion-reveal` | 250ms | `ease-out` | Scroll reveals (optional, max 1-2 per viewport) |

**Rules:**
- **NO scale animations** on cards/buttons. Scale = App-Store. We're zine.
- **NO bouncy springs.** Linear and ease-out only.
- `prefers-reduced-motion: reduce` disables marquee and reveals. Respected always.
- Press state is **instant color inversion** (bg ↔ fg), not a smooth fade.

---

## 7. Component Patterns

### Buttons / Link Cards

**Default state:**
- `background: transparent` | `border: 2px solid var(--border)` | `radius: 0` | `padding: 16px 20px`
- Text: Inter 600, 14–16px
- Left-aligned content for link cards (icon + label + trailing arrow on hover)

**Hover state:**
- `background: var(--fg)` | `color: var(--bg)` | `border-color: var(--fg)`
- **INSTANT inversion**, no fade (100ms linear max)

**Active / pressed:**
- Same as hover but with `border: 2px solid var(--accent)` flash (150ms)

**Primary CTA (e.g. Metal Archive button):**
- Default: `bg: transparent` | `border: 2px solid var(--fg)` | text `var(--fg)`
- Hover: full `var(--accent)` blood-red fill, text becomes `var(--fg)`, border matches accent
- This is the ONLY element on the landing allowed to use blood red.

### Cards (video thumbnails, Metal Archive album cards)

- `background: var(--bg-elevated)` | `border: 2px solid var(--border)` | `radius: 0`
- Image: fills card width, aspect 16:9 for video, 1:1 for album art
- Metadata row below image: JetBrains Mono 11–12px uppercase, tracking `+0.12em`, color `--fg-muted`
- Title: Inter 600, 16–18px, `--fg`
- Hover: `border-color: var(--fg)` + subtle overlay on image (`rgba(9,9,11,0.3)` with "PLAY" label in mono uppercase centered)

### Marquee (Band names ticker)

- Height: 48px (mobile) / 64px (desktop)
- Border-top + border-bottom 2px `--border-strong`
- Content: band names separated by `·` or `✦`, JetBrains Mono 500, uppercase, tracking `+0.2em`
- Speed: 6s linear infinite
- Fade edges: NONE. Hard clip only. (Fade edges = designer-brutalism. Hard clip = real zine.)
- `--accent` color for every 7th or 11th band name (prime numbers = irregular = feels xerox)

### Social icons row

- SVG only (Lucide / Heroicons / custom).
- Size: 24×24px with 44×44px hit-box (padding).
- Default color: `--fg-muted`. Hover: `--fg`. 100ms linear.
- Gap: `space-4` (16px).

### Avatar / Header portrait

- **Option A (recommended):** square 160px with 2px `--border-strong` border, radius 0 — frames the face like a flyer mugshot.
- **Option B (preserve current):** keep circle avatar but add 2px `--fg-muted` border ring.

### Stats pills (years coding, years editing)

- `border: 2px solid var(--border)` | `padding: 6px 10px` | `radius: 0`
- Number: Archivo Black 900, 24–32px, `--fg`
- Label below: JetBrains Mono 10–11px uppercase tracking `+0.15em`, `--fg-muted`
- Horizontal stack, gap `space-4`

---

## 8. Page Section Patterns

### Hero (portfolio index top)

1. Optional marquee of band names at very top (or tech stack), full-bleed
2. Square portrait frame (left on desktop, top on mobile)
3. Name in `display-hero` — UPPERCASE, Archivo Black, tight leading (can wrap across 2 lines: `DANIEL` / `BANARIBA`)
4. Role line in JetBrains Mono label style: `VIDEO PRODUCTION · METAL UNDERGROUND · HONDURAS`
5. Stats row (years coding, years editing, bands documented)
6. Primary description paragraph in Inter body
7. 4px section divider

### Links / Social column

- Single-column stack of link cards (not grid)
- Each card full-width, 2px border, padding 16/20
- Icon left, label center-left, arrow indicator right (appears on hover)
- Instant inversion on hover

### Projects / Audiovisual

- Grid 1 col mobile → 2 col tablet → 3 col desktop
- Thumbnails 16:9, 2px border, 0 radius
- Band name (title case, Inter 600) + year/view metadata (mono uppercase)

### Contact / Footer

- Large-format email address (display-lg, Archivo Black, UPPERCASE) — make it the hero of the footer
- 4px section divider above
- Copyright in JetBrains Mono 11px uppercase

---

## 9. Accessibility (non-negotiable)

- **Contrast:** `--fg` (`#F5F1E8`) on `--bg` (`#09090B`) = **~17:1** ✅ WCAG AAA
- `--fg-muted` (`#A1A1AA`) on `--bg` = **~7.2:1** ✅ AAA
- `--accent` (`#8B0000`) on `--bg` = **~3.3:1** — ONLY use for ≥18pt text or non-text UI (borders, icons). Never small body text.
- **Focus rings:** 2px solid `--fg` offset 2px. VISIBLE. Do NOT remove.
- **Touch targets:** 44×44px minimum. Enforced on social icons via padding.
- **Reduced motion:** `prefers-reduced-motion: reduce` kills marquee + reveals.
- All icon-only buttons have `aria-label`. All images have `alt`.

---

## 10. Anti-patterns (NEVER DO)

1. `border-radius > 0` anywhere structural
2. Box-shadows, drop-shadows, glow effects
3. Gradients (background, text, or border)
4. Pure `#FFFFFF` as foreground (use bone `#F5F1E8`)
5. Acid yellow, neon anything, candy pink
6. Scale hover animations on cards (`scale(1.02)` etc.)
7. Bouncy spring physics
8. Emoji as icons (SVG only, always)
9. Multi-color accents (blood red ONLY)
10. Smooth cinematic easing > 300ms on micro-interactions
11. Glassmorphism, blur backgrounds, frosted cards
12. "Delightful" micro-animations on every element

---

## 11. Reflex Implementation Notes

This project uses **Reflex 0.8.28**, not raw React. All components are Python `rx.*` calls.

### Where this lives in code

- `links_bio/styles/colors.py` — extend `Color`, `TextColor` enums with new tokens. Do NOT hardcode hex in components.
- `links_bio/styles/fonts.py` — add `Font.ARCHIVO_BLACK`, `Font.INTER`, `Font.JETBRAINS_MONO`. Keep `Font.PULSE_VIRGIN` for existing brand moments.
- `links_bio/styles/styles.py` — extend `Size` enum and style dicts (`button_title_style`, `album_card_style`, etc.) with the new scale.
- Google Fonts → inject via `rx.script` or `rx.style` in `links_bio/links_bio.py` app root.

### Pattern for new tokens

```python
# styles/colors.py
class Color(Enum):
    BG = "#09090B"
    BG_ELEVATED = "#0F0F11"
    FG = "#F5F1E8"
    FG_MUTED = "#A1A1AA"
    FG_DIM = "#52525B"
    ACCENT = "#8B0000"
    ACCENT_HOVER = "#A30000"
    BORDER = "#27272A"
    BORDER_STRONG = "#3F3F46"
```

### Pattern for instant-inversion hover (Reflex)

```python
rx.link(
    "LABEL",
    _hover={
        "background_color": Color.FG.value,
        "color": Color.BG.value,
        "border_color": Color.FG.value,
    },
    transition="background-color 100ms linear, color 100ms linear, border-color 100ms linear",
    border=f"2px solid {Color.BORDER.value}",
    border_radius="0",
    padding="16px 20px",
)
```

### Marquee component

Reflex doesn't have a native marquee — build with `rx.box` + CSS keyframes via `rx.style` or a `style={"animation": "marquee 6s linear infinite"}` prop. Duplicate content inline to fake seamless loop.

---

## 12. Implementation Scope (for this refactor)

**In scope:**
- `links_bio/views/header.py` — apply display type, square portrait, stats pills, mono labels
- `links_bio/views/links.py` — apply link card pattern (instant inversion, 2px border, 0 radius, uppercase labels)
- `links_bio/styles/colors.py`, `fonts.py`, `styles.py` — extend enums and base styles
- Google Fonts import in app root

**Out of scope (for now — separate pass):**
- Metal Archive pages (already have their own `METAL_ARCHIVE_MAX_WIDTH` and styles — tackle in a dedicated page override under `design-system/pages/metal-archive.md`)
- Navbar / footer — can reuse new tokens but not restructuring here
- Form components (submit/newsletter/contact)

---

## Acceptance Criteria for the Refactor

- [ ] Zero hardcoded hex in `header.py` / `links.py` — everything via `Color` / `Font` / `Size` enums
- [ ] Zero `border_radius` > 0 on new components
- [ ] All labels/metadata in JetBrains Mono uppercase with wide tracking
- [ ] Hero uses Archivo Black display scale
- [ ] Primary CTA (Metal Archive button) uses blood red hover only
- [ ] Focus rings visible on every interactive element
- [ ] Mobile tested at 375px; touch targets ≥ 44px
- [ ] `prefers-reduced-motion` respected for marquee

---
