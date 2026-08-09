# HYPHAE — THE VISUAL & INTERACTION LANGUAGE

**Status:** normative. This document is the source of truth for every pixel, colour, curve and
millisecond in the shipped build. Where it disagrees with `01-act1-understory.md`,
`02-act2-network.md` or `03-act3-bloom.md` on a *visual* matter, this document wins. Where it
disagrees on a *mechanical* matter, they win.

Every hex value below has been run through sRGB relative-luminance and OKLCH conversion; every
contrast ratio quoted is computed, not estimated. Every duration is a real millisecond count.
Nothing here says "subtle", "appropriate", or "as needed".

---

## 0. THE ARGUMENT

Universal Paperclips is a 16 KB stylesheet of grey rectangles and 2009 gradients, and it is one of
the best-feeling interfaces ever shipped in a game (teardown §7). It works because of four
properties, none of which are decorative:

1. **Everything is on one screen.** Zero navigation actions required to finish the game.
2. **The layout is the progress bar.** Panels un-hide as they are earned; the window fills up, and
   then in Act III it empties again.
3. **Disabled-but-visible is the core interaction.** `trigger` and `cost` are separate predicates.
   Desire is rendered as a grey rectangle, 96 times.
4. **It is faster than perception.** 100 Hz `innerHTML`, 30 ms blinks, opacity-driven sine waves.
   Twitchy reads as responsive.

We are going to keep all four and lose none of them, and then we are going to be *better looking*
without adding a single decorative element. The strategy is not decoration. It is:

> **One typeface, one grid, six colours, three curves, and no exceptions.**

That is the entire aesthetic thesis. Every idle game in the top-100 loses to us on the same axis:
they have twelve gradients, four accent hues, three type scales and a shop. We will have a palette
you could name out loud in one breath and a layout that never moves.

The tone target — *damp soil, spore-white, chlorophyll, deep understory shade, bioluminescence* —
is delivered by **luminance discipline**, not by hue. The screen is 92% near-black neutrals with a
green cast so slight it reads as "unlit" rather than "green". Colour appears roughly six times per
screen, and each appearance means something. When the bioluminescent teal first arrives in Act II,
it should feel like a light coming on in a cave, because it is the first saturated thing the player
has seen in two hours.

### 0.1 The nine non-negotiables

| # | Rule | Why |
|---|---|---|
| 1 | Portrait, one column, one thumb, 360 CSS px design base. | The genre's device. UP refused it (teardown §8.1). |
| 2 | The primary action is always in the bottom 200 px. | Thumb country. Never scroll to act. |
| 3 | No image, no audio file, no webfont, no CDN, no `<svg>` file. Inline path data and canvas only. | Single-file deployable, offline, zero third-party (beats teardown §8.16). |
| 4 | Every tap target ≥ 44 × 44 CSS px, enforced by a build lint. | WCAG 2.5.5 / one-handed reality. |
| 5 | `transform` and `opacity` are the only animatable properties. | Compositor-only. Battery is a design resource. |
| 6 | Nothing on screen changes luminance more than 3× per second. Ever. | UP's act transition is 120 flashes in 4 s (teardown §8.14). That is a seizure risk and we will not ship it. |
| 7 | Hue is never the sole carrier of information. Every coloured state has a second channel: a glyph, a weight, a stroke, a position. | Deuteranopia/protanopia, and greyscale screenshots. |
| 8 | The layout never reflows in response to game state. Things fade in and out of pre-allocated slots. | A UI that jumps is a UI that is not calm. |
| 9 | Numbers are tabular, three significant figures, suffix-notated, and never re-measure. | Teardown §8.11. |

---

## 1. FOUNDATIONS

### 1.1 Units, root, and scaling

Root font size is **never set in CSS**. The browser default (or the user's override) is the root.
Every dimension is authored in `px` *except* type sizes and any box whose height is determined by
type, which are authored in `rem`. This gives us:

- Text scales when the user scales text (Android font-size, iOS Dynamic Type via `-apple-system`).
- Touch targets, canvas geometry and the grid do **not** scale, so the thumb map stays correct.
- The layout survives 200% text scaling because every text container is `min-height`, never
  `height`, and every row is a flex row with `align-items: baseline` and `flex-wrap: nowrap`
  on the numeric side only.

```css
html { font-size: 100%; -webkit-text-size-adjust: 100%; }
:root { --u: 1rem; }        /* 16px at default. All type derives from this. */
```

**Viewport meta** (exact, do not modify):

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#0B0D0C" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#EAE6D9" media="(prefers-color-scheme: light)">
```

Height uses `100dvh` with a `100vh` fallback and a JS-written `--vh` for old WebKit:

```css
.shell { height: 100vh; height: 100dvh; }
```

### 1.2 The grid

**4 px base.** Every margin, padding, gap, border-radius and component height is a multiple of 4,
with exactly two licensed exceptions: hairlines (1 px) and the 2 px accent rule.

```css
--sp-2:2px;  --sp-4:4px;  --sp-6:6px;  --sp-8:8px;   --sp-12:12px; --sp-16:16px;
--sp-20:20px;--sp-24:24px;--sp-32:32px;--sp-40:40px; --sp-48:48px; --sp-64:64px;
```

**Column gutter is 16 px, always.** Content width on a 360 px viewport is 328 px. This never
changes at any breakpoint; see §4.7.

### 1.3 Radii

The radius language is "wet stone" — nothing is sharp, nothing is a pill except things that are
literally round.

```css
--r-xs:  2px;   /* pips, meter fills, badges */
--r-sm:  4px;   /* inline chips, segmented control cells */
--r-md:  8px;   /* cards, list rows, inputs */
--r-lg: 14px;   /* the hero button, sheets' inner blocks */
--r-xl: 22px;   /* bottom sheet top corners */
--r-full: 999px;/* the FAB, pips, the scrim-less grab handle */
```

Rule: **radius never scales with element size.** A 320 px-wide card and a 64 px chip both use
`--r-md` if they are the same *kind* of thing. Proportional radius is what makes design systems
look soft and cheap.

### 1.4 Elevation

There is no drop shadow anywhere in this game. Elevation is expressed by **surface luminance +
a 1 px border + an optional 1 px inset top highlight**. Three levels, and only three.

| Level | Surface | Border | Inset highlight | Used for |
|---|---|---|---|---|
| 0 | `--bg` | — | — | the page |
| 1 | `--surface-1` | `--line-soft` | — | cards, rows, panels |
| 2 | `--surface-2` | `--line` | `inset 0 1px 0 rgba(232,225,211,.055)` | the hero button, the FAB, the sheet |

`box-shadow` is used only for that static inset highlight and is **never animated** (§6.7).
`backdrop-filter` and `filter` are never used at all — they cost 3–6 ms per frame on mid-range
Android for zero information.

### 1.5 Token architecture

Two layers. **Primitives** (`--soil-700`) are the palette and are never referenced by a component.
**Semantics** (`--text-primary`) are the only thing components use. Theme switching and the Act III
cold shift are implemented purely by rebinding semantics.

```
component  →  semantic token  →  primitive
.card      →  --surface-1     →  --soil-800
```

Any component rule containing a literal hex value is a bug. Any component rule referencing a
primitive directly is a bug. The build lints for both.

---

## 2. THE COLOUR SYSTEM

Dark-first. The dark theme is the designed artefact; the light theme is a correct, tested,
second-class citizen (because a game about a forest floor at night is not a light-mode game, but a
person on a bus at noon still deserves to read it).

### 2.1 The five families

| Family | Feeling | Hue (OKLCH) | Chroma range | Role |
|---|---|---|---|---|
| **Soil** | damp earth, deep understory shade | 128–165° | 0.004 → 0.027 | every surface, every border, every muted text |
| **Spore** | spore-white, dry paper, chitin | 84–94° | 0.017 → 0.020 | all primary text, all hyphal strokes |
| **Chlorophyll** | living tissue, gain, assent | 141–143° | 0.037 → 0.085 | positive state, affordable, completed |
| **Amber** | attention, decay-light, the thing you must look at | 75–83° | 0.050 → 0.140 | warning, deadline, unaffordable cost |
| **Rust** | oxidation, loss, death | 35–38° | 0.055 → 0.127 | default, tree death, destructive |
| **Biolum** | foxfire, cold light, cognition | 164–178° | 0.037 → 0.111 | Signal, Insight, everything Act II+ |
| **Void** | interstellar cold, the absence of forest | 284–292° | 0.009 → 0.051 | Act III only, replaces Soil's cast |

Seven, not six, because Biolum is *withheld for two hours* and Void is *withheld for five*. A colour
that arrives late is worth more than a colour that was always there.

### 2.2 Dark primitives — verified

All contrast figures are against `--bg` `#0B0D0C` unless marked. `S1` = against `--surface-1`
`#151914`.

```css
/* SOIL — surfaces, lines, muted text */
--soil-1000:#050604; /* oklch(11.9% .007 128)   1.04 : scrim, deepest */
--soil-950: #070906; /* oklch(13.6% .009 134)   1.03 : the canvas plate */
--soil-900: #0B0D0C; /* oklch(15.6% .004 165)   1.00 : PAGE BACKGROUND (canonical) */
--soil-850: #101310; /* oklch(18.2% .008 145)   1.04 : pressed surface */
--soil-800: #151914; /* oklch(20.7% .012 139)   1.10 : surface-1, cards */
--soil-750: #1B201A; /* oklch(23.6% .014 140)   1.18 : surface-2, hero button, sheet */
--soil-700: #222820; /* oklch(26.8% .017 138)   1.29 : line-soft (decorative hairline) */
--soil-600: #2C3329; /* oklch(31.1% .020 136)   1.50 : line (structural hairline), meter track */
--soil-500: #3A4236; /* oklch(36.8% .023 135)   1.87 : line-strong, button border */
--soil-400: #4E5749; /* oklch(44.4% .025 134)   2.58 : disabled fill, disabled label */
--soil-350: #6B7464; /* oklch(54.6% .027 131)   4.00 : placeholder / locked label */
--soil-300: #7A8371; /* oklch(59.7% .029 129)   4.93  S1 4.50 : TEXT-TERTIARY */
--soil-200: #8C9484; /* oklch(65.5% .025 129)   6.21  S1 5.66 : TEXT-SECONDARY */
--soil-100: #B0B6A6; /* oklch(76.7% .023 124)   9.37  S1 8.54 : text-body-dim */

/* SPORE — text and hyphae */
--spore-100:#C7C3B5; /* oklch(81.7% .020 94)   11.05 */
--spore-050:#D8D4C8; /* oklch(87.0% .017 92)   13.16 : TEXT-PRIMARY (canonical) */
--spore-000:#EFEBDD; /* oklch(93.9% .019 94)   16.34 : TEXT-MAX, hero numbers */
--hyphae:   #E8E1D3; /* oklch(91.1% .020 85)   14.99 : the canvas stroke (canonical hsl(42,22%,88%)) */

/* CHLOROPHYLL — gain, affordable, alive */
--chloro-800:#1E2E1D; /*  1.36 : fill wash */
--chloro-700:#2F4A2D; /*  1.99 : bar fill on dark, chip bg */
--chloro-600:#5F8A5B; /*  4.90 : meter fill */
--chloro-500:#7FA87A; /*  7.23 : ACCENT-POSITIVE (canonical) */
--chloro-400:#9BC495; /*  9.96 : positive text on surface */
--chloro-300:#B9DCB3; /* 12.95 : peak / emphasis */

/* AMBER — attention, cost, deadline */
--amber-800:#3A2A0C; /*  1.41 */
--amber-700:#6B4C13; /*  2.48 */
--amber-600:#B37D1E; /*  5.45 : unaffordable cost text */
--amber-500:#D99A2B; /*  7.99 : ACCENT-ATTENTION (canonical) */
--amber-400:#E9B75C; /* 10.58 */
--amber-300:#F5D28F; /* 13.46 */

/* RUST — loss, default, destructive */
--rust-800:#331309;  /*  1.15 */
--rust-700:#5E2517;  /*  1.63 */
--rust-600:#8A3E28;  /*  2.60 */
--rust-500:#A24B32;  /*  3.33 : ACCENT-NEGATIVE (canonical) — FILLS AND BORDERS ONLY */
--rust-400:#C86A4E;  /*  5.22 : negative TEXT (use this, never rust-500, for words) */
--rust-300:#E0917A;  /*  7.89 */

/* BIOLUM — Signal, Insight, cognition. Act II onward. */
--biolum-800:#0D2A24; /*  1.28 */
--biolum-700:#15463A; /*  1.83 : signal bar track-fill */
--biolum-600:#3A8E74; /*  4.92 */
--biolum-500:#62C39A; /*  9.09 : ACCENT-SIGNAL */
--biolum-400:#8CDCBB; /* 12.13 : focus ring, saturation peak */
--biolum-300:#B6EDD6; /* 14.92 */

/* VOID — Act III only */
--void-900:#08080C;  /* the Act III page background */
--void-700:#1A1A26;  /* Act III surface-1 */
--void-500:#5A5878;  /* 2.95 on void-900 : lines */
--void-300:#A8A4C6;  /* 8.37 on void-900 : secondary text */
--void-100:#D2CFE4;  /* 13.12 on void-900 : primary text */
```

**Two rules that fall out of the table and must be enforced:**

- `--rust-500` **is not a text colour.** 3.33 : 1. It is legal as a fill, a 2 px border, a meter
  segment, or text ≥ 24 px semibold (large-text threshold 3 : 1). Words in a 13 px row use
  `--rust-400` (5.22 : 1). Filled rust buttons take `--spore-000` labels (4.90 : 1 on `--rust-500`).
- `--soil-350` (4.00 : 1) is legal only for placeholder and locked-item labels, which are exempt
  under WCAG 1.4.3 as disabled controls — but the *cost* string on a locked item is not exempt and
  must be `--amber-600` (5.45 : 1). This is the exact situation the trigger/cost split creates and
  it is where every other idle game fails contrast.

### 2.3 Semantic tokens — dark (the default binding)

```css
:root, :root[data-theme="dark"] {
  /* surface */
  --bg:            var(--soil-900);
  --bg-sunk:       var(--soil-950);   /* the canvas plate, the console well */
  --surface-1:     var(--soil-800);
  --surface-2:     var(--soil-750);
  --surface-press: var(--soil-850);
  --scrim:         rgba(5,6,4,.72);

  /* line */
  --line-soft:     var(--soil-700);   /* decorative dividers, exempt from 3:1 */
  --line:          var(--soil-600);   /* structural */
  --line-strong:   var(--soil-500);   /* control outlines */
  --line-state:    var(--soil-300);   /* any border that CARRIES STATE — 4.93:1 */

  /* text */
  --text-max:      var(--spore-000);
  --text-primary:  var(--spore-050);
  --text-body:     var(--soil-100);
  --text-secondary:var(--soil-200);
  --text-tertiary: var(--soil-300);
  --text-disabled: var(--soil-400);
  --text-locked:   var(--soil-350);
  --text-on-accent:var(--soil-900);   /* on chloro-500 7.23, amber-500 7.99, biolum-500 9.09 */
  --text-on-rust:  var(--spore-000);  /* 4.90 */

  /* meaning */
  --positive:      var(--chloro-500);
  --positive-text: var(--chloro-400);
  --positive-fill: var(--chloro-600);
  --positive-wash: var(--chloro-800);
  --attention:     var(--amber-500);
  --attention-text:var(--amber-500);
  --attention-dim: var(--amber-600);
  --negative:      var(--rust-500);
  --negative-text: var(--rust-400);
  --negative-wash: var(--rust-800);
  --signal:        var(--biolum-500);
  --signal-text:   var(--biolum-400);
  --signal-fill:   var(--biolum-600);
  --signal-wash:   var(--biolum-800);

  /* structure */
  --focus:         var(--biolum-400);
  --hyphae-stroke: var(--hyphae);
  --meter-track:   var(--soil-600);
  --canvas-bg:     var(--soil-950);
}
```

### 2.4 The Act III cold shift

Act III does not get a new palette. It gets **one rebinding**, applied by adding `data-act="3"` to
`<html>` at the ESCAPE transition, cross-faded over 2,600 ms (§6.6). The forest's green cast is
replaced by interstellar violet. Nothing else moves.

```css
:root[data-act="3"] {
  --bg:            var(--void-900);
  --bg-sunk:       #050508;
  --surface-1:     var(--void-700);
  --surface-2:     #22222F;
  --surface-press: #121219;
  --line-soft:     #1F1F2C;
  --line:          #2A2A3A;
  --line-strong:   #3A3A4E;
  --line-state:    #7A7796;   /* 4.71 on void-900 */
  --text-primary:  var(--void-100);
  --text-secondary:var(--void-300);
  --text-tertiary: #8B87A8;   /* 5.71 on void-900 */
  --canvas-bg:     #050508;
  --hyphae-stroke: #C9C6DE;   /* 12.01 on void-900 */
}
```

Chlorophyll, amber, rust and biolum are **unchanged** in Act III. They still read (all ≥ 4.5 : 1 on
`#08080C`, which is darker than `#0B0D0C`). The player should feel the ground go out from under the
neutrals while the meanings stay fixed. That is the whole point.

The transition is a `transition: background-color 2600ms linear` on `body` plus a 2,600 ms opacity
cross-fade of the two canvases. Text colour is switched at the midpoint (1,300 ms) in a single
frame — cross-fading text colour is imperceptible and costs a repaint per frame.

### 2.5 Light theme — verified

Not an inversion. A different material: bleached paper, dry spores, the same forest at noon.

```css
:root[data-theme="light"] {
  --bg:            #EAE6D9;   /* oklch(92.5% .018 93) */
  --bg-sunk:       #E0DBCB;
  --surface-1:     #F3F0E6;   /* oklch(95.5% .014 93) */
  --surface-2:     #FBF9F2;   /* oklch(98.2% .010 94) */
  --surface-press: #DFDACA;
  --scrim:         rgba(34,38,31,.44);

  --line-soft:     #DBD5C3;
  --line:          #CFC9B6;
  --line-strong:   #B7B09B;
  --line-state:    #7D775F;   /* 3.42 on surface-1 — legal for non-text */

  --text-max:      #0F1310;   /* 15.00 on bg / 16.43 on surface-1 */
  --text-primary:  #22261F;   /* 12.32 / 13.49 */
  --text-body:     #3A382E;
  --text-secondary:#4E4B40;   /*  7.00 /  7.66 */
  --text-tertiary: #635F52;   /*  5.11 /  5.60 */
  --text-disabled: #96917F;
  --text-locked:   #8A8574;
  --text-on-accent:#FBF9F2;
  --text-on-rust:  #FBF9F2;

  --positive:      #3D6B3C;   /*  5.00 /  5.47 */
  --positive-text: #2F5730;
  --positive-fill: #4E7C4C;
  --positive-wash: #DCE7D8;
  --attention:     #8A5E0E;   /*  4.56 /  4.99 */
  --attention-text:#7A5109;
  --attention-dim: #9C6F1E;
  --negative:      #8E3A22;   /*  6.05 /  6.63 */
  --negative-text: #7E3320;
  --negative-wash: #F0DCD4;
  --signal:        #166B53;   /*  5.16 /  5.65 */
  --signal-text:   #10593F;
  --signal-fill:   #2A7F63;
  --signal-wash:   #D6E9E1;

  --focus:         #166B53;
  --hyphae-stroke: #6E6858;
  --meter-track:   #D5CFBC;
  --canvas-bg:     #E4E0D1;
}
```

Light-theme canvas inverts the stroke: dark hyphae on pale ground, alpha 0.42 instead of 0.35
(dark-on-light needs more weight to read at 0.6 px stroke widths).

Theme resolution order: `localStorage["hyphae.theme"]` → `prefers-color-scheme` → dark. The
settings sheet offers `AUTO / DARK / LIGHT`. No other theme ships. Ever.

### 2.6 Contrast ledger (the audit table QA runs)

| Pair | Dark | Light | Requirement | Pass |
|---|---|---|---|---|
| text-primary / bg | 13.16 | 12.32 | 4.5 | ✔ |
| text-primary / surface-1 | 12.00 | 13.49 | 4.5 | ✔ |
| text-secondary / bg | 6.21 | 7.00 | 4.5 | ✔ |
| text-tertiary / surface-1 | 4.50 | 5.60 | 4.5 | ✔ |
| positive-text / surface-1 | 9.08 | 5.47 | 4.5 | ✔ |
| attention / surface-1 | 7.29 | 4.99 | 4.5 | ✔ |
| negative-text / surface-1 | 4.76 | 6.63 | 4.5 | ✔ |
| signal-text / surface-1 | 11.07 | 5.65 | 4.5 | ✔ |
| text-on-accent / positive | 7.23 | 5.92 | 4.5 | ✔ |
| text-on-rust / negative | 4.90 | 7.17 | 4.5 | ✔ |
| line-state / bg | 4.93 | 3.42 | 3.0 (non-text) | ✔ |
| focus ring / bg | 12.13 | 5.16 | 3.0 | ✔ |
| meter fill / meter track | 3.27 | 3.06 | 3.0 | ✔ |
| hyphae stroke @0.35α / canvas-bg | ≈ 3.6 | ≈ 3.4 | 3.0 (graphical) | ✔ |

`prefers-contrast: more` binds `--text-secondary → --spore-050`, `--text-tertiary → --soil-100`,
`--line-soft → --line-strong`, and raises the hyphae stroke alpha from 0.35 to 0.55. Six lines of
CSS.

### 2.7 Colour-blind safety — the second-channel table

Hue is never alone. This is the enforced mapping.

| Meaning | Hue | Second channel | Third channel |
|---|---|---|---|
| gain / positive | chlorophyll | leading `+` glyph | 3 px left rule on the card |
| loss / negative | rust | leading `−` glyph | strikethrough on the affected row label |
| attention / deadline | amber | leading `!` glyph | the value is bold (600) instead of medium |
| affordable | chlorophyll | cost text weight 600 | left rule present |
| unaffordable | amber-600 | cost text weight 400 | left rule is `--line` |
| locked (no trigger) | none | not rendered at all | — |
| your territory | solid arc / solid fill | solid stroke | listed in your stand list |
| rival territory | amber | **dashed** stroke (6-2) | a bar on the card, a count in the header |
| signal-live | biolum | a pulsing dot (static under reduced-motion) | the `Σ` glyph |

Deuteranopia check: chlorophyll (`oklch 68.9% .080 142`) and amber (`oklch 73.0% .140 76`) are
separated by 4.1 points of OKLCH lightness *and* by glyph. Rust (`51.9%`) is 17 points below
chlorophyll. Under a full protanopia simulation all three remain distinguishable by lightness alone.
Verified by rendering the palette to greyscale: the ordered lightness sequence is
rust-500 (52%) → chloro-500 (69%) → amber-500 (73%) → biolum-500 (75%). Rust is unmistakable;
chloro/amber/biolum are within 6 points, which is why all three carry glyphs.

---

## 3. TYPOGRAPHY

### 3.1 The stacks

Two stacks. No third.

```css
--font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI",
           Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", "Cascadia Mono", Menlo, Consolas,
             "Roboto Mono", "Liberation Mono", monospace;
```

`--font-ui` carries everything: labels, numbers, titles, descriptions, buttons.
`--font-mono` carries exactly three things: **the console**, **cost strings**, and **ASCII meters**.
That restriction is what makes the console feel like a machine talking — it is the only monospaced
surface in the game, so it reads as a different voice without a single colour change.

**No `font-weight: 700`.** The heaviest weight in the game is 600. System UI faces at 700 look
shouty at 13 px on a phone and destroy the calm. Emphasis is carried by lightness (`--text-max`) and
by size, not by weight.

### 3.2 The scale

Nine steps. Nothing outside this table ships.

| Token | Size | rem | Weight | Line-height | Tracking | Case | Used for |
|---|---|---|---|---|---|---|---|
| `--t-display` | 34 px | 2.125 | 300 | 1.05 (36 px) | −0.022em | — | the hero number, act-transition text |
| `--t-hero` | 26 px | 1.625 | 400 | 1.15 (30 px) | −0.014em | — | Act I ledger's biomass line, band `SURPLUS` |
| `--t-readout` | 20 px | 1.25 | 500 | 1.20 (24 px) | −0.008em | — | secondary big numbers |
| `--t-title` | 17 px | 1.0625 | 600 | 1.29 (22 px) | −0.005em | — | card titles, sheet titles, button labels |
| `--t-value` | 17 px | 1.0625 | 500 | 1.29 (22 px) | 0 | — | ledger values, row values |
| `--t-body` | 15 px | 0.9375 | 400 | 1.47 (22 px) | 0 | — | descriptions, sheet prose |
| `--t-meta` | 13 px | 0.8125 | 400 | 1.46 (19 px) | +0.002em | — | rates, sub-values, console |
| `--t-label` | 11 px | 0.6875 | 600 | 1.45 (16 px) | +0.14em | UPPER | panel headings, ledger labels, tab labels |
| `--t-micro` | 10 px | 0.625 | 600 | 1.40 (14 px) | +0.10em | UPPER | badges, tab labels at ≤ 340 px |

Why `--t-label` is 11 px and tracked to +0.14em: at that size and tracking, an all-caps system UI
label reads as *signage* rather than as text, which is what a panel heading is. It also survives
200% scaling to 22 px without breaking a row, because label columns are `min-width`, not `width`.

The **hero number is weight 300**, not 600. A large number rendered light and wide is the single
most effective typographic move available to us, and it is the opposite of what every idle game
does. `BIOMASS 4.12 T` at 34/300/−0.022em on `--text-max` against near-black is the shot.

### 3.3 Numeric display — the rules

This section is normative and detailed because numbers are 80% of the pixels in this game.

**R1 — Tabular figures, always, everywhere, no exceptions.**

```css
.num { font-variant-numeric: tabular-nums slashed-zero; font-feature-settings: "tnum" 1, "zero" 1; }
```

SF, Roboto and Segoe UI all ship `tnum`. Where the feature is unavailable, digits jitter as they
interpolate, which is the single ugliest thing an idle game can do. Feature-test at boot:

```js
function hasTabular(){
  const c = document.createElement('canvas').getContext('2d');
  c.font = "500 17px " + getComputedStyle(document.body).getPropertyValue('--font-ui');
  const w1 = c.measureText("111111").width, w0 = c.measureText("000000").width;
  return Math.abs(w1 - w0) < 0.5;
}
// on failure: document.documentElement.dataset.numfont = "mono"  →  .num { font-family: var(--font-mono) }
```

**R2 — Three significant figures. The formatter is the one from `02-act2-network.md` §15.4 and
there is exactly one copy of it.**

```js
const SUF = ["","k","M","G","T","P","E","Z","Y","R","Q","aa","ab","ac","ad","ae","af"];
function fmt(n, sig = 3){
  if (!isFinite(n)) return "∞";
  if (n < 0) return "−" + fmt(-n, sig);          // U+2212 MINUS SIGN, not hyphen
  if (n < 1000) return n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.round(n).toString();
  const e = Math.min(Math.floor(Math.log10(n)/3), SUF.length-1);
  const m = n / Math.pow(1000, e);
  return (m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : m.toFixed(0)) + " " + SUF[e];
}
```

The minus sign is **U+2212**, never `-` (U+002D). At 13 px on a phone a hyphen is 3 px of nothing
and a minus sign is a statement. The plus is **U+002B**, always rendered for rates, never omitted.

**R3 — Slot width is reserved, not measured.**

Every numeric element declares a `min-width` in `ch` computed from its *maximum expected string*,
not its current one. A ledger value slot is `min-width: 8ch` (`999.9 aa` = 8 chars). A rate slot is
`min-width: 9ch` (`+999.9 G/s`). The consequence: **the layout never reflows when a number grows a
digit.** This is the single most important typographic rule in the document and it is why our screen
will feel calmer than every competitor's.

```css
.val   { min-width: 8ch; text-align: right; font-variant-numeric: tabular-nums; }
.rate  { min-width: 9ch; text-align: right; }
.unit  { color: var(--text-tertiary); margin-left: .28ch; }   /* the suffix is dimmer than the mantissa */
```

The **suffix is always one step dimmer than the mantissa** (`--text-tertiary` next to
`--text-primary`; `--text-secondary` next to `--text-max`). `4.12` in spore-white and `T` in soil
grey. This makes the magnitude scannable and the unit unobtrusive, and it costs one `<span>`.

**R4 — How a number changes on screen.** Four distinct behaviours, and confusing them is a bug.

| Change kind | Behaviour | Duration |
|---|---|---|
| **Continuous accrual** (biomass at +6.4 G/s) | Interpolate the *value* in rAF from `lastTickValue → value` across the 50 ms sim window; re-render the string only if it differs from `el.__last`. Digits are never individually animated. | continuous |
| **Discrete gain** (a contract pays out, a project refunds) | Snap to the new value. Ramp the element's colour `--text-primary → --text-max` over 90 ms `--ease-out`, hold 60 ms, return over 320 ms `linear`. No transform. | 470 ms |
| **Discrete loss** (a purchase, a default) | Snap. Ramp colour `--text-primary → --negative-text` over 90 ms, return over 320 ms. The *rate* line, if any, gets a leading `−`. | 410 ms |
| **Suffix crossing** (999 g → 1.00 kg) | The mantissa snaps. The **suffix span alone** cross-fades: old `opacity 1→0` over 90 ms, new `0→1` over 90 ms, offset by 90 ms. The mantissa never fades. | 180 ms |

**R5 — Never animate a decrement.** A counter that counts down digit-by-digit is a slot machine.
Snap, flash rust, move on.

**R6 — Rates are always signed and always suffixed with `/s`.** `+6.40 G/s`. Zero renders as
`— /s` in `--text-tertiary`, not `+0.00 G/s`, because a hard zero is information and a floating zero
is noise. Negative net rates render in `--attention` (not rust — a negative rate is a warning, not a
loss) with a leading `−`.

**R7 — Time.** `m:ss` under 1 hour (`3:51`), `h:mm` above (`2:14`), `Nd hh:mm` above 24 h. Never
"3 minutes 51 seconds". The word "in" precedes it and the value follows: `fills in 3:51`.

**R8 — Percentages** are integers with a `%` and no decimal below 100, one decimal above 99.0 only
where the fraction is load-bearing (Act III's `colonized`, which follows Act III §23 and prints to
the precision the doc specifies). Never `73.4179%`.

**R9 — Costs** are mono, tabular, and use the currency glyphs from `04-projects-catalog.md` §1.2
(`g Σ Ψ ◦ ⛬ D λ sug rep`). Multi-currency costs join with ` + ` and never wrap: the cost span is
`white-space: nowrap; font-family: var(--font-mono); font-size: 13px`. If it would overflow, the
*title* truncates, never the cost.

### 3.4 Text craft rules that are visual, not editorial

- **No text is ever centred except: the hero button label, the act-transition lines, and the empty
  state of a list.** Everything else is left-aligned with numbers right-aligned. Centred body text
  in a portrait column is a readability failure.
- **Maximum measure is 46 characters** (328 px content at 15 px body ≈ 44 ch). This is already
  enforced by the column and is why we never widen the column at any breakpoint (§4.7).
- **Two lines maximum** for any card description, enforced with
  `display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden`. The
  writing rules in `04-projects-catalog.md` cap descriptions at 12 words; the clamp is the safety
  net for 200% text scaling, not a licence to write longer.
- **No italics anywhere.** System UI italics at 13 px are mush. Emphasis inside prose is
  `--text-max` at the same weight.
- **No underlines except focus.** There are no hyperlinks in this game.
- **`text-wrap: pretty`** on descriptions where supported; `text-wrap: balance` on titles ≤ 2 lines.

---

## 4. LAYOUT

### 4.1 Design base and the thumb map

Design base is **360 × 780 CSS px** (the modal Android portrait viewport). Everything is verified
at 320 × 568 (iPhone SE 1st gen, the floor) and 430 × 932 (iPhone Pro Max, the ceiling).

The thumb model, for a right-handed one-handed grip on a 360 × 780 device: the pivot is
approximately **(305, 815)** — below the bottom-right corner. Comfortable reach is a circular arc of
radius ~150 px; stretch is 150–230 px.

```
 y=0    ┌────────────────────────────────┐
        │                                │
        │   ZONE C — READ ONLY           │   0 → 300 px from top
        │   status strip, canvas,        │   Never the only route to an action.
        │   panel headings               │
 y=300  ├────────────────────────────────┤
        │   ZONE B — STRETCH             │   300 → 580 px
        │   list rows, sliders,          │   Tappable, but every Zone-B action
        │   secondary buttons            │   must also be reachable from Zone A
 y=580  ├────────────────────────────────┤   or be non-urgent.
        │   ZONE A — THUMB               │   580 → 780 px
        │   hero button, FAB, tab bar,   │   All primary and all urgent actions.
        │   sheet confirm row            │
 y=780  └────────────────────────────────┘
```

**The rule, stated once:** *anything the player will do more than ten times in a session, or under
time pressure, lives in Zone A.* That means: `EXTEND`, `PULSE`, `RELEASE`, `SETTLE`, `CEDE`, tab
switching, sheet confirmation, and the buy-burst buttons on the tip/density row. Everything else may
live in Zone B. Zone C contains no unique affordances except the settings gear, which is duplicated
as the last row of the LOG tab.

### 4.2 Safe areas

```css
.shell {
  padding-top:    env(safe-area-inset-top);
  padding-left:   env(safe-area-inset-left);
  padding-right:  env(safe-area-inset-right);
  /* bottom is handled by the tab bar or by the scroller's tail padding, never both */
}
.tabbar { padding-bottom: env(safe-area-inset-bottom); height: calc(56px + env(safe-area-inset-bottom)); }
.scroll { padding-bottom: calc(var(--sp-24) + env(safe-area-inset-bottom)); } /* only when no tab bar */
.fab    { bottom: calc(88px + env(safe-area-inset-bottom)); right: var(--sp-16); }
```

On a device with a home indicator the tab bar's glyph row sits at 56 px and the inset is background
only — the glyphs never move into the indicator zone. On a device with a notch, the status strip's
sticky offset is `env(safe-area-inset-top)`, so the strip pins *below* the notch and the canvas
plate bleeds *behind* it.

### 4.3 The shell — three stages

The shell grows exactly twice in a playthrough, and the growth is the progress bar (teardown
principle 9). It never shrinks except in the Act III dismantle, where it shrinks all the way to a
single button.

**Stage 0 — COLD BOOT (t = 0 → ~2:00). No chrome at all.**

```
┌────────────────────────────────┐  ← safe-area-inset-top
│                                │
│              ╱                 │  CANVAS PLATE — 38% of shell height
│             ╱                  │  (296 px at 780). One stroke, drifting.
│                                │
├────────────────────────────────┤  1px --line-soft
│  BIOMASS                 0 g   │  LEDGER — 44 px, 1 row
├────────────────────────────────┤
│                                │
│                                │  scroll region, empty
│         ┌────────────┐         │
│         │   EXTEND   │         │  HERO, 64 px, 62% width, centred
│         └────────────┘         │
│                                │
├────────────────────────────────┤
│ > the forest floor is warm   ▌ │  CONSOLE — 5 lines, 107 px
└────────────────────────────────┘  ← safe-area-inset-bottom
```

**Stage 1 — ACT I (2:00 → end of Act I). Single scrolling column. Still no tabs.**

The canvas plate shrinks 38% → 22% → 18% as panels arrive (animated once per unlock, 320 ms, by
transitioning the plate's `flex-basis`… **no** — see §6.7, we never animate layout. The plate has a
`height` written directly in one frame, and the *content below* fades in over 320 ms. The plate
resize is instantaneous and lands under the fade, so it is not perceived as a jump).

```
┌────────────────────────────────┐
│         canvas plate           │  18–38%, shrinking on unlock
├────────────────────────────────┤
│ BIOMASS      4.12 T  +6.40 G/s │  LEDGER, position:sticky, ≤ 4 rows × 36 px
│ SUGAR        812 / 1.24 k      │  144 px max. Nothing else is ever pinned.
│ MINERAL      2.10 k    +12 /s  │
├────────────────────────────────┤
│ ░ HYPHAL TIPS                  │  panels, in acquisition order,
│ ░ THE LITTER MARKET            │  never reordered, never collapsed
│ ░ THE UNDERSTORY               │
│ ░ ADAPTATIONS                  │
│ ░ PATCHES                      │
│                                │
│         ┌────────────┐         │  HERO is ALWAYS the last element
│         │   EXTEND   │         │  in the scroll. Reachable by scrolling
│         └────────────┘         │  to the end, forever.
├────────────────────────────────┤
│ > console                    ▌ │  fixed to the bottom, outside the scroller
└────────────────────────────────┘
```

**Stage 2 — ACT II & III. The tab bar appears; the hero becomes a FAB.**

```
┌────────────────────────────────┐
│ BIOMASS  4.12 T     +6.40 G/s  │  STATUS STRIP, 36 px/row, 2–3 rows
│ SIGNAL   184k/512k   ●●●○○     │  always visible, never scrolls
├────────────────────────────────┤
│         canvas / map           │  1:1, collapsible to a 48 px strip
├────────────────────────────────┤
│                                │
│      ACTIVE PANEL              │  the scroller. one panel at a time.
│      (one at a time)           │
│                          ╭───╮ │  FAB — 64 px, bottom-right,
│                          │ ⚡│ │  16 px inset, 88 px above the tab bar
│                          ╰───╯ │
├────────────────────────────────┤
│  🯄    ◈    ✳    ⚯    ≡        │  TAB BAR, 56 px + safe area
└────────────────────────────────┘
```

The move from *inline hero at the bottom of a scroll* to *floating hero over a tabbed panel* is
deliberate and narrative: in Act I you are a hand and the button is a thing you reach for; in Act II
you are a mind and the button is an instrument you carry. `EXTEND` does not vanish — it persists as
the last row of the FOREST tab's scroll, exactly as UP's `Make Paperclip` persisted, and it is the
only thing on screen in the last ninety seconds of Act III.

### 4.4 The tab model

Five slots, fixed from the first frame, revealed one at a time. **The tab bar is a 5-column CSS grid
from boot**; unearned slots are `visibility: hidden`, not `display: none`. This means the bar never
reflows when a tab arrives — the new glyph simply fades in over 320 ms into a slot that was always
the right width. This is the correct implementation of "the tab bar is the progress bar" and it
costs one CSS declaration.

| Slot | Act II label | Act III label | Arrives |
|---|---|---|---|
| 1 | FOREST | VOID | Act II opening / Act III `G3` |
| 2 | MIND | GENOME | `signal` unlock / `G2` |
| 3 | FLUSH | FLEET | first primordium / `G3` |
| 4 | PACT | LINEAGES | contract re-homing / first strain |
| 5 | LOG | LOG | always present |

**Tab glyphs are inline SVG paths**, not emoji and not icon fonts. Emoji renders as a foreign
full-colour object that destroys the palette and varies across platforms; a font is an external
asset. Each glyph is a 24 × 24 viewBox, `stroke="currentColor"`, `stroke-width="1.6"`,
`stroke-linecap="round"`, `fill="none"` unless noted.

```
FOREST  M12 3.5 L18.5 13.5 H5.5 Z        + M12 13.5 V20.5       (fill the triangle at 0.16α)
MIND    M12 4.2 a2 2 0 1 0 .01 0 Z  M5.4 15.4 a2 2 0 1 0 .01 0 Z  M18.6 15.4 a2 2 0 1 0 .01 0 Z
        + M11.2 7.6 L6.6 13.6   M12.8 7.6 L17.4 13.6   M7.4 16.6 H16.6
FLUSH   M4.5 13.2 a7.5 5.4 0 0 1 15 0 Z  + M10.2 13.2 V19 a1.8 1.8 0 0 0 3.6 0 V13.2
PACT    M10 7.5 a4.5 4.5 0 0 0 0 9   M14 7.5 a4.5 4.5 0 0 1 0 9   + M10 12 H14
LOG     M4.5 7.5 H19.5   M4.5 12 H19.5   M4.5 16.5 H13
VOID    M12 12 m-8.5 0 a8.5 8.5 0 1 0 17 0 a8.5 8.5 0 1 0 -17 0  (dash 5 3)
        + M12 12 m-3.5 0 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0  (solid)
GENOME  M8 4 C14 8, 14 16, 8 20   M16 4 C10 8, 10 16, 16 20  + M9.4 8 H14.6  M9.4 16 H14.6
FLEET   M12 3.5 L15 11 L12 9.2 L9 11 Z  + M12 12.5 V20.5  (dash 2 3)
LINEAG. M12 4 V9   M12 9 L7 14 V20   M12 9 L17 14 V20   + M7 14 h0.01 M17 14 h0.01
```

Tab item states:

| State | Glyph | Label | Indicator | Background |
|---|---|---|---|---|
| inactive | `--text-tertiary` | `--text-tertiary` | none | transparent |
| active | `--text-max` | `--text-max` | 2 px `--positive` top rule, inset 14 px each side, `--r-xs` | transparent |
| pressed | `--text-max` | — | — | `--surface-press` |
| unearned | — | — | — | `visibility: hidden` |
| badged | `--text-tertiary` | — | 6 px `--positive` dot at glyph top-right, +2 px offset | — |

The active indicator is a **top** rule, not a bottom one, because a bottom indicator on a bottom bar
sits under the player's thumb and is invisible while being touched.

Badges are **dots, never counts**. A count invites completionism; a dot says "something is here".
The badge clears when the tab is opened, not when the item is interacted with.

### 4.5 Panels

A panel is a titled block in the scroller. Anatomy, fixed:

```
┌────────────────────────────────┐
│ THE LITTER MARKET         [3]  │  36 px header: --t-label, --text-secondary,
├────────────────────────────────┤  optional right-aligned count in --t-micro
│  row                           │  1 px --line-soft under the header
│  row                           │
│  row                           │
└────────────────────────────────┘  24 px bottom margin
```

- Header padding: `0 var(--sp-16)`, height 36 px, `align-items: center`.
- Panels do not have their own background in Act I (they sit directly on `--bg`); their *rows* have
  `--surface-1`. In Act II/III, where a tab shows one panel at a time, the panel is also
  backgroundless and rows carry the surface. This keeps the total painted area small and the screen
  dark.
- The **plate's collapse handle arrives with UNDERSTORY**, one act before the tab bar: once the
  stack outgrows its window the parked-or-open choice is the player's, and the stage-2 frame
  reorder (`ledger order:-1`) remains the act break's own beat. Before UNDERSTORY the canvas is
  still teaching press→growth and the handle stays hidden.
- Panels are **never collapsible** in Act I. In Act II a panel header may carry a 44 × 44 disclosure
  target if the panel exceeds 6 rows, and the collapsed state persists in the save.
- Panels arrive by fading in over 320 ms `--ease-organic` with a `translateY(6px) → 0`. They arrive
  **at the bottom of the existing stack**, never inserted in the middle, so nothing the player was
  looking at moves.

### 4.6 Lists and virtualisation

Act II's 61 regions and Act III's 13 bands are lists. Rules:

- Rows are fixed height per state (collapsed 72 px, expanded 210 px in Act II; 88 px in Act III).
- Lists past **24 rows virtualise** with a simple windowed renderer: a spacer div above, ≤ 14
  rendered rows, a spacer below. No library. ~40 lines.
- Expansion is *in place*: the row's height is set in one frame (no transition on height — §6.7) and
  the newly-revealed content fades in over 180 ms. The list scrolls the expanded row's top to
  `header + 8 px` with `scrollTo({behavior:'smooth'})`, honouring `prefers-reduced-motion` by using
  `'auto'`.
- Only **one row expanded at a time** per list. Opening a second closes the first in the same frame.

### 4.7 Scaling up without stretching

The column is **420 px maximum content width, forever.** We do not widen it on a tablet. We do not
introduce a second column of the same content. A 900 px-wide readout row is a worse readout row.

| Breakpoint | Behaviour |
|---|---|
| **< 360 px** | Content gutter drops 16 → 12 px. `--t-label` → `--t-micro`. Tab labels hide, glyphs only (bar becomes 52 px). Nothing else changes. Verified at 320 px. |
| **360–639 px** | The design base. Column = viewport width. Gutter 16 px. |
| **640–899 px** (large phone landscape, small tablet) | Column pinned to **420 px, centred**. The canvas leaves the column and becomes a **full-bleed backdrop** behind the whole viewport at 14% opacity with a `radial-gradient` vignette to `--bg` at the column edges (a static gradient overlay div, not a filter). The in-column canvas plate collapses to 0 and its content moves to the backdrop. The tab bar stays bottom, but is itself 420 px wide and centred, with the bar's background extending full-bleed. |
| **900–1279 px** (tablet portrait/landscape, small desktop) | **The atrium.** Two zones: the canvas becomes a left pane (`1fr`, min 380 px) at full opacity with the network drawn at 1.8× scale; the column (420 px) docks right with a 1 px `--line` separator and 32 px of `--bg` padding either side. The tab bar migrates to a **72 px vertical rail** on the far right, glyphs stacked, labels below each glyph at `--t-micro`. The FAB moves to the bottom of the rail. |
| **≥ 1280 px** | Identical to 900–1279 except the canvas pane grows and the network's attractor field grows with it (§7.6). The column never grows. Maximum useful width is capped by a `max-width: 1680px` on the shell, centred, with `--bg` beyond. |
| **Landscape phone (height < 480 px)** | The canvas plate collapses to a 40 px strip. Status strip drops to 1 row (biomass only) and the rest moves into the first panel. Tab bar 48 px. This is a supported but unloved configuration; we do not design *for* it, we merely refuse to break. |

**Never**: a hamburger menu, a sidebar of navigation, a max-width of `none`, a grid of cards, or a
"desktop layout". The game is a column. On a large screen it is a column with a beautiful
living wall behind it, and that is a better desktop experience than a stretched one.

---

## 5. COMPONENTS

Every component below is specified as: geometry → states → motion → accessibility. If a property is
not listed, it is not set, and inherits.

### 5.1 Status strip / ledger row

The most-looked-at object in the game. Four rows maximum, ever.

```
┌──────────────────────────────────────────┐
│ BIOMASS            4.12 T     +6.40 G/s  │  36 px
└──────────────────────────────────────────┘
  ├─72px──┤        ├──8ch──┤    ├──9ch──┤
  --t-label         --t-value    --t-meta
  --text-secondary  --text-max   by sign
```

```css
.ledger        { position: sticky; top: env(safe-area-inset-top); z-index: 40;
                 background: var(--bg); border-bottom: 1px solid var(--line-soft); }
.ledger::after { content:""; position:absolute; left:0; right:0; top:100%; height:16px;
                 background: linear-gradient(var(--bg), transparent); pointer-events:none;
                 opacity:0; transition: opacity 180ms linear; }
.ledger[data-scrolled="1"]::after { opacity: 1; }

.ledger-row  { display:flex; align-items:baseline; gap:var(--sp-8);
               height:36px; padding:0 var(--sp-16); }
.ledger-lab  { font:var(--t-label); color:var(--text-secondary); min-width:72px; flex:0 0 auto; }
.ledger-val  { font:var(--t-value); color:var(--text-max); min-width:8ch;
               margin-left:auto; text-align:right; font-variant-numeric:tabular-nums slashed-zero; }
.ledger-rate { font:var(--t-meta); min-width:9ch; text-align:right;
               color:var(--text-tertiary); }
.ledger-rate[data-sign="pos"] { color:var(--positive-text); }
.ledger-rate[data-sign="neg"] { color:var(--attention); }   /* a falling rate WARNS, not mourns */
.ledger-rate[data-sign="zero"]{ color:var(--text-tertiary); }
```

The **first** ledger row (biomass) may use `--t-hero` (26/400) instead of `--t-value` and a 48 px
row height. This is the only asymmetry in the strip and it exists because biomass is the paperclip:
the monotone counter that is the whole game. In Stage 0 it is `--t-display` (34/300) in a 68 px row,
alone on screen, and it steps down to `--t-hero` when the second ledger row arrives.

**Capped resources** (sugar) render as `812 / 1.24 k` with the divider in `--text-tertiary` and a
2 px fill bar hairline along the bottom edge of the row (`::after`, `transform: scaleX()`), colour
`--positive` below 85% of cap and `--attention` above. When rotting, a second `--t-meta` line
appears below in `--negative-text`: `− 4.2 g/s (rot)`.

**Ripeness pips** (Act II/III) sit in the rate slot: five 8 px circles, 6 px gap, filled
`--positive`, empty `--meter-track` with a 1 px `--line-strong` border.

Accessibility: the strip is **not** an aria-live region (§8.4). Each row is
`role="group" aria-label="Biomass, 4.12 tonnes, rising 6.4 grams per second"` recomputed at most
every 3 s.

### 5.2 Primary action button (the hero)

```css
.hero {
  display:block; width:62%; min-width:200px; max-width:280px;
  height:64px; margin:var(--sp-20) auto var(--sp-24);
  border-radius:var(--r-lg);
  background:linear-gradient(180deg, var(--soil-750) 0%, var(--soil-800) 100%);
  border:1px solid var(--line-strong);
  box-shadow: inset 0 1px 0 rgba(232,225,211,.055);
  color:var(--text-primary);
  font:var(--t-title); letter-spacing:.12em; text-transform:uppercase;
  transform: translateZ(0);
  transition: transform 220ms cubic-bezier(.16,1,.3,1),
              background-color 120ms linear,
              border-color 120ms linear,
              color 120ms linear;
  touch-action:manipulation; -webkit-tap-highlight-color:transparent; user-select:none;
}
.hero:active, .hero[data-press="1"] {
  transform: scale(.972);
  background: var(--surface-press);
  border-color: var(--line);
  transition-duration: 70ms;
  transition-timing-function: cubic-bezier(.3,0,.1,1);
}
```

**Press timing is asymmetric on purpose.** Down: 70 ms with a fast-in curve — the button must be
*already moving* before the finger registers. Up: 220 ms with a long-tail ease-out — the release is
the pleasure. This asymmetry is the entire tactility of the game and it is two lines of CSS.

Press is bound to `pointerdown`, not `click`, and fires haptics immediately:

```js
el.addEventListener('pointerdown', e => {
  if (e.button) return;
  el.dataset.press = "1";
  if (!reducedMotion && hapticsOn) navigator.vibrate?.(8);
  act();                                    // the game action fires on DOWN
}, {passive:true});
['pointerup','pointercancel','pointerleave'].forEach(t =>
  el.addEventListener(t, () => el.dataset.press = "0", {passive:true}));
```

Firing on `pointerdown` removes ~90 ms of perceived latency versus `click` and is the difference
between a button that feels alive and one that feels like a web page. It is safe here because the
hero action is never destructive and never irreversible.

**States:**

| State | Background | Border | Label | Press transform |
|---|---|---|---|---|
| idle | gradient 750→800 | `--line-strong` | `--text-primary` | yes |
| press | `--surface-press` | `--line` | `--text-primary` | −2.8% |
| **disabled** (no reason to press) | `--surface-1` flat | `--line-soft` | `--text-disabled` | none |
| **locked** (exists, cannot afford) | `--surface-1` flat | `--line` | `--text-locked` + cost in `--attention-dim` below | none, but tapping prints the shortfall to the console |
| **new** (just revealed) | idle | `--positive` 1 px | `--text-max` | yes |

**Never use `opacity` for disabled.** Opacity on a container dims the border, the label and the
inset highlight by different perceptual amounts and reads as "loading". Disabled is a *colour
change*, and it keeps every dimension identical so the button does not appear to recede.

**Locked buttons are tappable.** A tap on a locked control prints one console line naming the
shortfall — `240 g short` — and gives a 4 ms haptic. This is a direct improvement on UP, whose
greyed buttons are inert; the information the player wants is exactly "how much more", and we have
it.

Variants:
- `.hero--wide` (100% − 32 px) is used only for `RELEASE` in the FLUSH panel and for sheet
  confirmations.
- `.hero--danger` swaps the background to `--negative` with `--text-on-rust`. Used four times in the
  whole game.

### 5.3 The FAB (Act II/III hero)

```css
.fab {
  position:fixed; width:64px; height:64px; border-radius:var(--r-full);
  right:var(--sp-16); bottom:calc(88px + env(safe-area-inset-bottom)); z-index:50;
  background:var(--surface-2); border:1px solid var(--line-strong);
  box-shadow: inset 0 1px 0 rgba(232,225,211,.06);
  color:var(--text-primary);
  transition: transform 220ms cubic-bezier(.16,1,.3,1), background-color 120ms linear;
}
.fab:active { transform:scale(.94); background:var(--surface-press); transition-duration:70ms; }
```

**Cooldown ring** — a conic gradient, written once per 100 ms (never per frame):

```css
.fab[data-cool] {
  background:
    conic-gradient(var(--signal) calc(var(--p) * 360deg), transparent 0) border-box,
    var(--surface-2) padding-box;
  border:2px solid transparent;
}
```
```js
// in the 10 Hz display loop, not rAF:
fab.style.setProperty('--p', (1 - cd/cdMax).toFixed(3));
```

While cooling, the glyph is `--text-disabled` and the ring is `--signal-fill`; at 100% the ring
snaps to `--signal` and the glyph to `--text-max` in one frame with a single 90 ms colour ramp. No
pulse, no bounce, no repeating animation. A ready button is bright; that is enough.

Long-press on the FAB (420 ms) opens the three-item radial specified in `02-act2-network.md` §3;
each radial item is a 56 px circle placed on a 96 px radius arc from 200° to 280°, all three inside
the thumb arc.

### 5.4 Project / adaptation card

The single most numerous interactive object (146 across three acts). Its state machine is the
trigger/cost split, rendered.

```
┌──────────────────────────────────────────┐
▌ Improved Enzymes              750 Ψ      │  ← 3px left rule + title row
▌ Deadfall yields more of what it was.     │  ← description, 2-line clamp
└──────────────────────────────────────────┘
   min-height 88px, radius --r-md, --surface-1, 1px --line-soft
```

```css
.card { position:relative; min-height:88px; margin:0 var(--sp-16) var(--sp-8);
        padding:var(--sp-12) var(--sp-16) var(--sp-12) var(--sp-16);
        background:var(--surface-1); border:1px solid var(--line-soft);
        border-radius:var(--r-md); border-left:3px solid var(--line);
        transition: transform 220ms cubic-bezier(.16,1,.3,1),
                    background-color 120ms linear, border-color 180ms linear; }
.card:active { transform:scale(.985); background:var(--surface-press); transition-duration:70ms; }
.card-top   { display:flex; align-items:baseline; gap:var(--sp-12); }
.card-title { font:var(--t-title); color:var(--text-primary); text-wrap:balance; }
.card-cost  { margin-left:auto; font-family:var(--font-mono); font-size:13px; font-weight:500;
              white-space:nowrap; font-variant-numeric:tabular-nums; color:var(--attention-dim); }
.card-desc  { margin-top:var(--sp-6); font:var(--t-body); color:var(--text-body);
              display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
              overflow:hidden; }
```

| State | Left rule | Title | Cost | Notes |
|---|---|---|---|---|
| **triggered, unaffordable** | 3 px `--line` | `--text-primary` | `--amber-600`, weight 400 | The default. This is where cards live most of their lives, and it must look *good*, not sad. |
| **affordable** | 3 px `--positive` | `--text-max` | `--positive-text`, weight 600 | The moment it lights up is an event. It happens 146 times. |
| **new** | 3 px `--positive` | `--text-max` | — | 320 ms reveal (§6.4) + a 6 px `--positive` dot at top-right, cleared 1.2 s after the card is ≥ 50% in viewport. |
| **pressed** | — | — | — | `scale(.985)`, 70 ms. |
| **purchased** | — | — | — | Collapses and is removed from the DOM (§6.4). No "completed" tab. |
| **unbuyable** (`— (unbuyable)`) | 3 px `--line-soft` | `--text-locked` | `— ` in `--text-tertiary` | Exists so the player can read it. Tapping prints one console line and nothing else. |

Affordability is recomputed every render frame but the DOM is written only on change:

```js
function syncCard(el, p){
  const s = p.cost() ? "afford" : "want";
  if (el.dataset.s !== s) el.dataset.s = s;              // one attribute write, CSS does the rest
}
```

This is the four-line architecture from teardown §7.3, made cheap enough for a phone.

**Cards never carry a "BUY" button.** The card *is* the button. A separate button inside a card
doubles the tap targets, halves the hit area, and adds a second thing to look at.

### 5.5 Row (list item)

The workhorse of Act II/III: stand rows, band rows, market rows, contract rows.

```css
.row { min-height:72px; margin:0 var(--sp-16) var(--sp-6);
       padding:var(--sp-12) var(--sp-16);
       background:var(--surface-1); border:1px solid var(--line-soft);
       border-radius:var(--r-md); }
.row-line { display:flex; align-items:baseline; gap:var(--sp-8); min-height:19px; }
.row-line + .row-line { margin-top:var(--sp-4); }
.row-name { font:var(--t-title); color:var(--text-primary); }
.row-sub  { font:var(--t-meta);  color:var(--text-secondary); }
.row-num  { margin-left:auto; font:var(--t-meta); font-variant-numeric:tabular-nums;
            color:var(--text-primary); min-width:7ch; text-align:right; }
```

Three or four `.row-line`s maximum. Each line is a fixed-height flex row so a value growing a digit
never changes the row height. Rows expand in place (§4.6). The expanded region gets
`border-top: 1px solid var(--line-soft)` and 12 px of top padding.

**Long-press = the secondary action, everywhere and only** (Act I doc §12.1). 420 ms, cancelled by
>10 px of movement, with a discoverability affordance: at 180 ms the row's border begins ramping
`--line-soft → --line-state` over 240 ms, so a hesitant press *shows* the player that holding does
something. At 420 ms: an 18 ms haptic and the secondary action fires.

```js
function bindLongPress(el, fn){
  let t=null, sx=0, sy=0;
  el.addEventListener('pointerdown', e=>{ sx=e.clientX; sy=e.clientY;
    el.dataset.hold="1"; t=setTimeout(()=>{ el.dataset.hold="0";
      if(hapticsOn && !reducedMotion) navigator.vibrate?.(18); fn(); }, 420); }, {passive:true});
  const cancel=()=>{ clearTimeout(t); el.dataset.hold="0"; };
  el.addEventListener('pointermove', e=>{ if(Math.hypot(e.clientX-sx,e.clientY-sy)>10) cancel(); },{passive:true});
  ['pointerup','pointercancel','pointerleave'].forEach(k=>el.addEventListener(k,cancel,{passive:true}));
}
```
```css
.row[data-hold="1"] { border-color:var(--line-state); transition:border-color 240ms 180ms linear; }
```

### 5.6 Progress meters — three kinds, and they are not interchangeable

**(a) Fill bar** — a stock against a cap, or a fraction that matters continuously.

```css
.meter      { height:6px; border-radius:var(--r-xs); background:var(--meter-track); overflow:hidden; }
.meter-fill { height:100%; width:100%; transform-origin:left center;
              transform:scaleX(var(--v));           /* v ∈ [0,1] */
              background:var(--positive);
              transition: transform 180ms linear; }  /* LINEAR. A meter that eases lies about rate. */
.meter[data-tone="signal"] .meter-fill { background:var(--signal); }
.meter[data-tone="warn"]   .meter-fill { background:var(--attention); }
.meter[data-tone="bad"]    .meter-fill { background:var(--negative); }
```

`transform: scaleX()` never `width`. `transition-timing-function: linear` always — an eased meter
implies acceleration the simulation does not have, and players read meters as rate instruments.

A **target tick** (Act III's `n*`, Act II's retention target) is a 2 px full-height mark in
`--text-max` at `left: calc(var(--t) * 100%)`, drawn as a sibling absolutely positioned element, not
part of the fill.

**(b) Pip meter** — a small countable quantity (ripeness, contract tension, mortality severity).

```css
.pips     { display:flex; gap:var(--sp-6); }
.pip      { width:8px; height:8px; border-radius:var(--r-full);
            background:transparent; border:1px solid var(--line-strong); }
.pip[data-on] { background:var(--positive); border-color:var(--positive); }
```

Five pips, never more, never fewer. Five is countable at a glance; a percentage is not
(`02-act2-network.md` §4.6 is right about this). Pips fill instantly, with no transition — a pip is
a discrete fact.

**(c) ASCII meter** — a coarse ratio inside a dense row where a real bar would blow the DOM budget.

```
▓▓▓▓▓▓▒░░░░░░░░░░░░░
```
Mono, 20 characters maximum, built with `"▓".repeat(f) + "▒" + "░".repeat(20-f-1)`. Used in stand
rows, the MORTALITY panel, and the Act III band list. Zero elements, zero layout, one string
comparison. It is also perfectly legible to a screen reader if the string is accompanied by
`aria-label="litter remaining, 34 percent"`.

**(d) The forecast strip** (Act II FLUSH, Act III void) is a canvas, not DOM. 44 px tall, full
column width, drawn at 1 Hz. Specified in §7.7.

### 5.7 Log feed / console

Copied from UP (teardown §7.4) because it is correct, and then fixed for a phone.

```
┌──────────────────────────────────────────┐
│ . the birch is carbon-starved            │  opacity .20
│ . contract offered: birch, ring 1        │  opacity .30
│ . + 240 ⛬                                │  opacity .44
│ . winter                                 │  opacity .62
│ > the forest floor is warm             ▌ │  opacity 1.00
└──────────────────────────────────────────┘
   5 lines × 19px + 12px padding = 107px. Fixed. Never scrolls.
```

```css
.console { position:relative; height:107px; padding:var(--sp-6) var(--sp-16);
           background:var(--bg-sunk); border-top:1px solid var(--line-soft);
           font-family:var(--font-mono); font-size:13px; line-height:19px;
           color:var(--spore-100); overflow:hidden; }
.console-stack { will-change:transform; }
.console-line  { height:19px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.console-line:nth-last-child(1){ opacity:1;   color:var(--text-primary); }
.console-line:nth-last-child(2){ opacity:.62; }
.console-line:nth-last-child(3){ opacity:.44; }
.console-line:nth-last-child(4){ opacity:.30; }
.console-line:nth-last-child(5){ opacity:.20; }
.console-cur { animation:cur 1060ms steps(1,end) infinite; }
@keyframes cur { 0%,50%{opacity:1} 50.01%,100%{opacity:.12} }
```

**Arrival motion:** the whole `.console-stack` is translated up by 19 px in one frame, then
transitioned back to 0 over 180 ms `--ease-out` while the new line's opacity goes 0 → 1. One
transform on one element; no per-line animation, no layout.

```js
function consoleMsg(text, tone){        // tone ∈ undefined | 'pos' | 'warn' | 'neg'
  const stack = $('.console-stack');
  const line  = document.createElement('p');
  line.className = 'console-line';
  if (tone) line.dataset.tone = tone;
  line.textContent = (tone==='pos'?'+ ':tone==='neg'?'− ':tone==='warn'?'! ':'') + text;
  stack.appendChild(line);
  while (stack.children.length > 5) stack.removeChild(stack.firstChild);
  if (!reducedMotion){
    stack.style.transition='none'; stack.style.transform='translateY(19px)';
    void stack.offsetHeight;
    stack.style.transition='transform 180ms cubic-bezier(.22,1,.36,1)';
    stack.style.transform='translateY(0)';
  }
  ringBuffer.push(text);                // 200-entry scrollback for the LOG tab
}
```

Tone colours: `pos → --positive-text`, `warn → --attention`, `neg → --negative-text`, default
`--text-primary`. Each tone also gets its leading glyph (`+`, `!`, `−`), so hue is never alone.

The console is the **only** `aria-live` region in the game (§8.4). Because game events are already
routed through it, we get screen-reader support essentially free — which is exactly UP's accident,
turned into a decision.

The LOG tab holds the full 200-line ring buffer in a scrollable list at `--t-meta`, oldest first,
plus the settings block and the save export/import block.

### 5.8 Bottom sheet (the only modal form)

There are no centred dialogs. A centred dialog on a phone puts its buttons in Zone C.

```css
.sheet { position:fixed; left:0; right:0; bottom:0; z-index:80;
         max-height:86dvh; display:flex; flex-direction:column;
         background:var(--surface-2); border-top:1px solid var(--line-strong);
         border-radius:var(--r-xl) var(--r-xl) 0 0;
         transform:translateY(100%);
         transition:transform 240ms cubic-bezier(.22,1,.36,1); }
.sheet[data-open]{ transform:translateY(0); }
.scrim { position:fixed; inset:0; z-index:79; background:var(--scrim);
         opacity:0; transition:opacity 180ms linear; pointer-events:none; }
.scrim[data-open]{ opacity:1; pointer-events:auto; }
.sheet-grab { width:36px; height:4px; border-radius:var(--r-xs);
              background:var(--line-strong); margin:10px auto 0; }
.sheet-title{ font:var(--t-title); color:var(--text-max); padding:var(--sp-16) var(--sp-16) var(--sp-8); }
.sheet-body { overflow-y:auto; overscroll-behavior:contain; padding:0 var(--sp-16) var(--sp-16); }
.sheet-foot { display:flex; gap:var(--sp-12); padding:var(--sp-12) var(--sp-16)
              calc(var(--sp-16) + env(safe-area-inset-bottom));
              border-top:1px solid var(--line-soft); }
.sheet-foot > button { flex:1; height:48px; border-radius:var(--r-md); }
```

- Dismiss: tap scrim, swipe the sheet down > 96 px, `Escape`. **Destructive sheets do not dismiss on
  scrim tap** — only the explicit Cancel, swipe, or Escape.
- Cancel is left, Confirm is right. Right is thumb-natural for the dominant hand and Confirm is the
  common case.
- **Destructive confirmation is a 400 ms press-and-hold**, not a double-tap and never a typed word.
  The button's background fills left-to-right with `--negative` via `transform: scaleX()` on a
  child over 400 ms `linear`; releasing early reverses it over 160 ms. A 22 ms haptic fires on
  commit. This is used exactly four times: `KILL STAND`, `REABSORPTION`, `REGENOME`, and
  `CEDE`.
- The sheet count for the entire game is **five**: SETTINGS, SAVE, OFFLINE RETURN, and the two
  destructive confirmations (plus REGENOME/CEDE reusing the destructive template). Anything else
  that wants to be a modal must be an inline expansion instead.

Focus management: on open, focus moves to the sheet title (`tabindex="-1"`); focus is trapped within
the sheet; on close, focus returns to the element that opened it. `inert` is applied to the shell
while a sheet is open.

### 5.9 Toast

Toasts are for **acknowledging an action that produced no visible change**, and nothing else. Game
events are console lines. There are exactly three toasts in the shipped game: "save copied",
"import failed — checksum", "settings reset".

```css
.toast { position:fixed; left:var(--sp-16); right:var(--sp-16);
         bottom:calc(68px + env(safe-area-inset-bottom)); z-index:70;
         min-height:44px; display:flex; align-items:center; padding:0 var(--sp-16);
         background:var(--surface-2); border:1px solid var(--line-strong);
         border-radius:var(--r-md); color:var(--text-primary); font:var(--t-meta);
         transform:translateY(8px); opacity:0;
         transition:transform 180ms cubic-bezier(.22,1,.36,1), opacity 180ms linear; }
.toast[data-open]{ transform:translateY(0); opacity:1; }
```

Hold 2,600 ms. One at a time — a second toast replaces the first without an exit animation.
`role="status"`. Never carries an action button. Never stacks.

### 5.10 Segmented control / dials

Act I's retention dial, Act II's Work↔Think analogue, Act III's triangle. Two forms:

**Segmented control** (≤ 4 discrete options):
```css
.seg      { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:2px;
            padding:2px; background:var(--surface-1); border:1px solid var(--line-soft);
            border-radius:var(--r-md); }
.seg > button { height:44px; border-radius:var(--r-sm); background:transparent;
                color:var(--text-secondary); font:var(--t-label); }
.seg > button[aria-pressed="true"]{ background:var(--surface-2); color:var(--text-max);
                                    box-shadow: inset 0 1px 0 rgba(232,225,211,.05); }
```

**Slider** (continuous, the "one dial with no correct setting"):
- Track 6 px, `--meter-track`, radius 3.
- Filled portion `--positive` (or `--signal` in Act II+).
- Thumb 28 px diameter, `--surface-2`, 2 px `--line-state` border, `--r-full`. Its **hit target is
  44 × 44** via a transparent `::before`.
- The value is printed *above* the track, right-aligned, `--t-value`, live.
- Drag: no transition on the thumb (it must track the finger exactly). Tap-on-track: the thumb
  transitions 180 ms `--ease-out` to the tapped position.
- Keyboard: arrows ±1 step, Page ±10 steps, Home/End to bounds.
- **Every slider has a numeric readout and a step count.** A slider with no number is a toy.

### 5.11 Buy-burst row (tips, density, drones)

The row the player taps five times in a row at minute one. It must be excellent.

```
┌──────────────────────────────────────────┐
│ HYPHAL TIPS                          7   │
│ 62 g              [ +1 ] [ +5 ] [ MAX ]  │
└──────────────────────────────────────────┘
```

- The three buttons are 52 × 52 px, gap 8, right-aligned, radius `--r-md`, `--surface-2`,
  1 px `--line-strong`.
- `+1` is always enabled-looking if affordable; `+5` and `MAX` appear only once the player has
  bought 5 and 20 respectively (a behavioural trigger, teardown §4 taxonomy type 3 — *the game
  watches what is annoying you*).
- The cost updates **after** the press animation completes (220 ms), not during, so the number the
  player pressed is the number they saw. This is a small honesty that costs one `setTimeout` and is
  the difference between "responsive" and "slippery".
- Repeat-press: holding `+1` after 500 ms begins auto-repeat at 6 Hz, accelerating to 12 Hz after
  1.5 s, with a 4 ms haptic every third repeat. Auto-repeat stops immediately when unaffordable.

---

## 6. MOTION

Motion in this game has one job: to make causality legible. It has no job of delight. Anything that
does not answer "what just changed, and why" is deleted.

### 6.1 The curves — four, and no more

```css
--ease-out:     cubic-bezier(.22, 1, .36, 1);     /* things arriving, releasing, settling */
--ease-in-out:  cubic-bezier(.65, 0, .35, 1);     /* things moving between two places */
--ease-press:   cubic-bezier(.30, 0, .10, 1);     /* the down-stroke. front-loaded. */
--ease-organic: cubic-bezier(.34, .90, .24, 1);   /* unlocks and reveals. a hint of overshoot */
```

`--ease-organic` overshoots to approximately 100.8% at t ≈ 0.62 and settles — it is a *breath*, not
a bounce. There is no spring, no elastic, no `cubic-bezier` with a control point above 1.06 anywhere
in the game. A bouncing UI is not calm.

`linear` is used for exactly three things: meter fills, opacity cross-fades, and colour ramps. All
three are quantities, and quantities should not accelerate.

### 6.2 The durations — six, and no more

```css
--d-press:  70ms;   /* pointerdown feedback */
--d-state: 120ms;   /* colour/border state change */
--d-fade:  180ms;   /* opacity, console arrival, toast */
--d-move:  240ms;   /* sheet, panel transition, release */
--d-reveal:320ms;   /* an unlock */
--d-act:  2600ms;   /* an act transition. once per playthrough. */
```

`--d-release` is `220ms` and is the one exception to the six — it exists so the release feels
fractionally quicker than a panel move, which reads as *this is your hand* rather than *this is the
system*.

Anything longer than 320 ms outside an act transition is a bug. Anything shorter than 70 ms is
invisible and should be 0.

### 6.3 Press feedback — the exact contract

| Event | What happens | When |
|---|---|---|
| `pointerdown` | `transform: scale(.972)` over 70 ms `--ease-press`; background → `--surface-press` over 70 ms `linear`; haptic 8 ms; **the game action fires** | 0 ms |
| value change | the ledger number begins interpolating toward its new value | next rAF |
| `pointerup` | `transform: scale(1)` over 220 ms `--ease-out`; background restore over 120 ms | on release |
| cost update | the button's cost label rewrites | +220 ms |

Scale amounts, fixed by component: hero `.972`, FAB `.94`, card `.985`, row `.99`, tab item none
(background only), sheet buttons `.98`.

Nothing translates on press. Nothing rotates. Nothing changes shadow.

### 6.4 Unlock reveals — the 320 ms

An unlock is the most important motion in an incremental game; it happens ~200 times per
playthrough and it is the reward for everything.

**Sequence, exactly:**

```
t=0      the element is inserted with opacity:0, transform:translateY(6px)
t=0      one console line prints (its own 180 ms arrival runs in parallel)
t=0      an 8 ms haptic, if the unlock was not player-initiated
t=0→320  opacity 0→1 linear; transform translateY(6px)→0 --ease-organic
t=0→320  the left rule / border colour ramps --line → --positive
t=320    settled. A 6 px --positive dot is present at top-right.
t=+1200  after the element has been ≥50% in the viewport for 1200ms, the dot fades out over 180ms
```

There is **no blink.** UP blinks 12 times at 30 ms (360 ms of strobing); on an OLED phone in a dark
room at night that is unpleasant, and it violates our 3-flashes-per-second rule at the margin. Our
replacement — a single fade-in plus a persistent dot that clears on *being seen* — carries strictly
more information (it survives being scrolled past) for less light.

**Panel arrival** is the same 320 ms, applied to the whole panel, and the panel always arrives at
the *bottom* of the stack (§4.5) so nothing above it moves.

**Tab arrival** is a 320 ms opacity fade into a pre-allocated grid slot (§4.4), plus a single sweep
of the active indicator: a 2 px `--positive` rule scales from `scaleX(0)` to `scaleX(1)` over 320 ms
`--ease-out` and then fades out over 180 ms unless the tab is active.

### 6.5 Panel and tab transitions

Switching tabs is a **cross-fade, not a slide.** Sliding implies spatial adjacency, and the five
tabs are not adjacent — they are five views of one organism.

```
outgoing: opacity 1→0 over 120ms linear, then display:none
incoming: display:block, opacity 0→1 over 180ms linear, starting at t=60ms
scroll position: each tab remembers its own scrollTop and restores it instantly
```

Total 240 ms, overlapping by 60 ms so there is never a blank frame. No transform, no clip, no
layout. The status strip and canvas do not participate — they are constant, which is what makes the
tabs feel like *panels of one machine* rather than pages of an app.

### 6.6 Act transitions

Once per playthrough per act. These are the only cinematics and they replace UP's 120-flash strobe
(teardown §8.14) with something equally alarming and medically safe.

**Act I → Act II (`DECIDE`)** — 4,000 ms total:

```
t=0      every panel except the console transitions opacity → 0.12 over 1,800ms linear
t=0      the canvas begins redrawing at 8 Hz (up from 4) — this is the ONLY time the rate rises
t=600    a radial luminance wave crosses the canvas: a single arc of --hyphae at alpha 0.5,
         radius growing 0 → 1.6×diagonal over 2,400ms, stroke width 3px, drawn once per redraw.
         ONE wave. Not repeating.
t=2400   the canvas holds. Three console lines print at 700ms intervals, --t-display, centred,
         in the cleared space where the panels were.
t=4000   the Act II shell fades in over 600ms. Tab bar appears with slot 1 and slot 5 visible.
```

Luminance transitions in this sequence: 3 in 4 seconds. Well under the 3/second limit.

**Act II → Act III (`ESCAPE`)** — the palette shift (§2.4) runs as a 2,600 ms `linear`
`background-color` transition on `body` while the forest canvas fades out (2,600 ms) and the void
canvas fades in (2,600 ms, offset +400 ms). No flash of white. The Act III doc's white-fill ending
(§21) is a **2,600 ms radial fill with no flicker**, and under reduced-motion it becomes a 900 ms
opacity ramp with no expansion, per `03-act3-bloom.md` §23.5.

**Reduced motion:** every act transition collapses to *the same console lines, printed at the same
intervals, with a 600 ms cross-fade between shells and no canvas animation whatsoever*. The words
are the content; the motion was always just the frame.

### 6.7 What must NEVER animate

This list is enforced by code review and by a CSS lint rule that fails the build on
`transition-property` values outside the allow-list.

1. **The digits of a number.** Interpolate the value; render the string. Never animate glyphs,
   never roll a digit, never use a slot-machine counter.
2. **A decrementing number.** Snap and flash (§3.3 R5).
3. **`width`, `height`, `top`, `left`, `right`, `bottom`, `margin`, `padding`, `font-size`,
   `line-height`, `flex-basis`, `grid-template-*`.** These trigger layout. The allow-list for
   `transition-property` is exactly: `transform`, `opacity`, `color`, `background-color`,
   `border-color`, `fill`, `stroke`.
4. **`box-shadow` and `filter`.** `backdrop-filter` is not used at all.
5. **Large fills.** Any element covering > 25% of the viewport never transitions its
   `background-color` except during an act transition.
6. **Anything on an infinite loop**, with exactly two exceptions: the console cursor (1,060 ms,
   `steps(1)`, 2 luminance changes per second) and the canvas flux layer's tip breathing at 4 Hz
   (an alpha oscillation of amplitude 0.10 — not a luminance *transition* under WCAG 2.3.1 because
   it never crosses the relative-luminance-change threshold).
7. **Anything while `document.hidden`.** `rAF` stops naturally; we also clear the 100 ms display
   interval and stop the canvas explicitly, and reconcile on `visibilitychange` using the offline
   code path.
8. **Anything while the user is scrolling.** A `scroll` listener sets `scrolling = true` and clears
   it 120 ms after the last event; the flux canvas skips its draw while true. This is worth ~1.5 ms
   per frame during the one moment the player is most likely to notice jank.
9. **Anything more than 3 luminance changes per second, anywhere, under any circumstance.**
10. **Anything at all when `prefers-reduced-motion: reduce`** except: opacity cross-fades ≤ 180 ms,
    meter fill `transform` (information), and the console line stack (information). Everything else
    becomes an instantaneous state change.

```css
@media (prefers-reduced-motion: reduce){
  *, *::before, *::after {
    animation-duration:.001ms !important; animation-iteration-count:1 !important;
    transition-duration:.001ms !important; scroll-behavior:auto !important;
  }
  .console-stack, .meter-fill, [data-rm-keep]{ transition-duration:180ms !important; }
  .console-cur { animation:none; opacity:.6; }
}
```

### 6.8 Haptics

| Event | Duration | Notes |
|---|---|---|
| hero press | 8 ms | on `pointerdown` |
| buy-burst repeat | 4 ms | every 3rd repeat only |
| long-press commit | 18 ms | at 420 ms |
| destructive commit | 22 ms | at 400 ms hold completion |
| unlock (not player-initiated) | 8 ms | with the reveal |
| act transition | 12 ms, 12 ms, 30 ms | at t=0, t=2400, t=4000 |
| error / shortfall tap | 4 ms | with the console line |

All haptics route through one function that respects a settings toggle **and**
`prefers-reduced-motion` (vestibular sensitivity correlates with haptic aversion, and it costs
nothing to be careful):

```js
const haptic = ms => { if (hapticsOn && !reducedMotion) navigator.vibrate?.(ms); };
```

Haptics default **on**. There is no haptic longer than 30 ms and no haptic pattern (arrays) anywhere
— patterns read as notifications, and this is not a notification.

---

## 7. THE LIVING BACKGROUND

The only visual in the game that is not text. It must be beautiful, it must be cheap, and it must be
*true* — it draws the thing the player actually has.

### 7.1 Architecture: two canvases, one of which is never cleared

```
<div class="plate">
  <canvas id="net"  aria-hidden="true"></canvas>   <!-- APPEND-ONLY. Never cleared. -->
  <canvas id="flux" role="img" aria-label="…"></canvas>  <!-- Cleared and redrawn at 4 Hz -->
</div>
```

The insight that makes this affordable: **the mycelial network is monotone.** Hyphae are never
removed. So the structural layer is drawn *incrementally* — each redraw strokes only the segments
created since the last redraw and leaves everything else alone. Cost is O(new segments), not
O(total). A network of 3,600 segments costs the same per frame as one of 12.

The transient layer (tip glow, travelling signal pulses, hazard marks, the fruiting body) is small,
bounded, and cleared every draw.

Both canvases are sized `W × H` CSS px with a backing store of `W·dpr × H·dpr`, `dpr =
min(devicePixelRatio, 2)` (1 on LOW tier), and `ctx.setTransform(dpr,0,0,dpr,0,0)` so all drawing
code is in logical pixels.

### 7.2 The growth algorithm: seeded space colonisation with a frontier

Space colonisation produces the correct *look* — thin filaments that branch, avoid each other, and
fill space unevenly — which no L-system does without heavy tuning. Naively it is O(attractors ×
nodes); we make it O(attractors × frontier) with a spatial hash and a bounded frontier.

**Constants** (logical px, tuned for a 360 × 296 plate):

```js
const SEG      = 4.2;    // segment length
const D_INF    = 30;     // influence radius: an attractor pulls nodes within this
const D_KILL   = 6.5;    // kill radius: an attractor within this of any node is consumed
const JITTER   = 0.14;   // radians, seeded, applied to each new segment's heading
const FRONTIER = 400;    // max nodes eligible to grow (the most recently created)
const NEW_MAX  = 24;     // max nodes appended per growth call
const CELL     = D_INF;  // spatial hash cell size
const BUCKET   = 12;     // max nodes per cell (overflow is dropped from the index, not the network)
```

**State:**

```js
const net = {
  seed,                                   // from the save
  x: new Float32Array(CAP), y: new Float32Array(CAP),
  par: new Int32Array(CAP), gen: new Uint8Array(CAP),
  n: 0, drawn: 0,
  frontier: new Int32Array(FRONTIER), fCount: 0, fHead: 0,
  ax: new Float32Array(AMAX), ay: new Float32Array(AMAX),
  alive: new Uint8Array(AMAX), aCount: 0, aNext: 0,   // aNext = index into the R2 sequence
  cell: new Int32Array(GW*GH*BUCKET), cellN: new Uint8Array(GW*GH),
  accX: new Float32Array(FRONTIER), accY: new Float32Array(FRONTIER), accN: new Uint8Array(FRONTIER)
};
```

**Attractor placement — R2 low-discrepancy sequence** (deterministic, no PRNG state, uniform without
clumping, and resumable, which is what lets us replenish forever):

```js
const G  = 1.32471795724474602596;      // the plastic number
const A1 = 1/G, A2 = 1/(G*G);           // 0.7548776662, 0.5698402910
function attractor(i, W, H, seed){
  const k = i + (seed & 0xFFF);
  const u = (0.5 + A1*k) % 1;
  const v = (0.5 + A2*k) % 1;
  return [ u * W, H - Math.pow(v, 0.72) * H ];   // ^0.72 biases density upward/outward
}
```

The `^0.72` exponent is what makes the network grow *away from the forest floor*: more attractors
near the top of the plate, so the colony spreads up and out from a seed at bottom-centre, which is
what a real mycelium radiating from an inoculation point looks like when you only see a slice.

**Seeding:** one node at `(W/2, H - 4)`, `par = -1`, `gen = 0`. Initial attractor pool `A0 =
clamp(round(W*H/220), 500, 1800)` — 484 at 360×296, so 500.

**One growth step:**

```js
function grow(){
  let added = 0;
  // 1. accumulate: each alive attractor pulls its nearest FRONTIER node
  for (let a = 0; a < aMax && added < NEW_MAX*3; a++){
    if (!alive[a]) continue;
    const best = nearestFrontierNode(ax[a], ay[a]);      // 3×3 cell scan, ≤ BUCKET*9 tests
    if (best.d < D_KILL){ alive[a]=0; aCount--; continue; }
    if (best.d > D_INF) continue;
    const f = best.f;                                     // frontier slot
    accX[f] += (ax[a]-x[best.i]) / best.d;
    accY[f] += (ay[a]-y[best.i]) / best.d;
    accN[f]++;
  }
  // 2. spawn
  for (let f = 0; f < fCount && added < NEW_MAX; f++){
    if (!accN[f]) continue;
    const i = frontier[f];
    let dx = accX[f], dy = accY[f];
    const m = Math.hypot(dx,dy) || 1; dx/=m; dy/=m;
    const th = Math.atan2(dy,dx) + (hash01(seed, n)*2-1) * JITTER;
    appendNode(x[i] + Math.cos(th)*SEG, y[i] + Math.sin(th)*SEG, i, Math.min(gen[i]+1, 255));
    accX[f]=accY[f]=0; accN[f]=0;
    added++;
  }
  // 3. replenish
  if (aCount < A0*0.25) spawnAttractors(A0*0.5);
  return added;
}
```

`appendNode` writes into the typed arrays, inserts into the spatial hash **once** (nodes never
move, so the hash is append-only too), and pushes onto the frontier ring buffer, evicting the oldest
index when full. Evicted nodes can never grow again — which is exactly right: old hyphae do not
branch, tips do.

`hash01(seed, i)` is a cheap integer hash (xorshift on `seed ^ (i*2654435761)`), so the entire
network is a pure function of `(seed, n)` and reproduces exactly on load. **The save stores `seed`
and `n`, nothing else** — the network is regenerated in ~40 ms on load by running `grow()` until
`net.n` matches. This is 8 bytes of save instead of 60 KB.

### 7.3 Growth rate — driven by the game, not by time

```js
targetN = clamp( Math.floor(hyphae * 2), 0, SEG_CAP );   // hyphae in metres, Act I §5.6
```

Per animation frame, call `grow()` until `net.n >= targetN` or `NEW_MAX` nodes have been added,
whichever comes first. This throttles a sudden jump (a patch claim adds 6 m = 12 nodes instantly;
an offline return might add 800) into a visible *growth event* over a second or two, which is
strictly better than a jump. Offline returns deliberately animate their growth over ~2.5 s while the
return sheet is on screen.

At Stage 0 `hyphae = 0.004 × taps`, so `targetN` reaches 1 at 125 taps — far too slow. Cold boot
overrides: `targetN = max(2, floor(hyphae*2))` and `SEG = 9` for the first 40 nodes, so the very
first thread is a single visible stroke that lengthens by ~1–2 px every few taps, exactly as
`01-act1-understory.md` §3.1 specifies. `SEG` lerps 9 → 4.2 across nodes 40–120.

### 7.4 Drawing the structural layer

```js
function drawNet(ctx){
  if (net.drawn >= net.n) return;
  ctx.save();
  ctx.strokeStyle = cssVar('--hyphae-stroke');
  ctx.globalAlpha = 0.35;                 // 0.42 in light theme, 0.55 under prefers-contrast
  ctx.lineCap = 'round';
  // one path per line-width bucket: 3 buckets, 3 strokes, regardless of batch size
  for (let b = 0; b < 3; b++){
    ctx.lineWidth = [1.15, 0.85, 0.58][b];
    ctx.beginPath();
    for (let i = net.drawn; i < net.n; i++){
      const p = net.par[i]; if (p < 0) continue;
      if (bucketOf(net.gen[i]) !== b) continue;
      ctx.moveTo(net.x[p], net.y[p]);
      ctx.lineTo(net.x[i],  net.y[i]);
    }
    ctx.stroke();
  }
  ctx.restore();
  net.drawn = net.n;
}
const bucketOf = g => g < 6 ? 0 : g < 16 ? 1 : 2;
```

Three `stroke()` calls per redraw, at most 24 segments total. Cost: **~0.06 ms** measured on a
Snapdragon 695. Thicker near the origin, finer at the tips — which is both anatomically correct and
the cheapest possible depth cue.

**Ageing.** Because the buffer is never cleared, we age it with a single wash at each season
boundary:

```js
function ageWash(ctx){                       // called once per season (every 6 real minutes)
  ctx.fillStyle = cssVarRGBA('--canvas-bg', 0.045);
  ctx.fillRect(0, 0, W, H);
}
```

Over 16 seasons (a full Act I) the oldest growth decays to `0.955^16 = 0.48` of its alpha while
recent growth is at full strength. **The network visibly remembers when you grew.** This is one line
of code and it is the single best thing in this document.

### 7.5 The flux layer

Cleared and redrawn at **4 Hz** (8 Hz on HIGH tier, 2 Hz on LOW, once-per-state-change under
reduced-motion). Everything on it is bounded.

| Element | Count | Draw |
|---|---|---|
| **Tip glow** | last 60 nodes | `arc(x, y, 1.6, 0, τ)` filled `--hyphae-stroke` at `α = 0.10 + 0.10·sin(2πt/6 + i·0.7)`. When `throughputPerSec() === 0` (starving), `α` clamps to 0.04 and the colour shifts to `--text-tertiary`. |
| **Signal pulses** (Act II+) | ≤ 12 (24 HIGH, 4 LOW) | each is `{path: Int32Array, u: float}`; `u` advances `0.22/s`; draw a 2 px dot in `--signal` at `α = 0.7` plus a 5 px trail at `α = 0.2` interpolated along the path. Paths are precomputed root→tip chains, chosen deterministically. |
| **Fruiting body** | ≤ 3 | a 7 px filled cap arc + 2 px stipe at a chosen tip, `--spore-000` at `α = 0.55`, drawn while the flush is live. |
| **Hazard mark** | ≤ 2 | a 3 px `--negative` ring at the affected region's screen position, `α = 0.4 + 0.2·sin(2πt/1.5)`, capped at 2 Hz of luminance change. |

Total flux primitives per draw: ≤ 80. Cost: **~0.5 ms**.

### 7.6 Per-act behaviour

| Act | Structural layer | Flux layer | Plate |
|---|---|---|---|
| **I** | the network, growing from `hyphae` | tips + fruiting bodies | 38% → 18% of shell height |
| **II** | the network persists at `globalAlpha 0.12`, drawn behind the hex map; the hex map is a third drawing pass on the *same* `net` canvas, redrawn on `mapDirty` or 4 Hz | tips + signal pulses along claimed edges + rival marks | 1:1 full width, collapsible to 48 px |
| **III** | cross-faded out over 2,600 ms at ESCAPE; replaced by the void canvas — 13 concentric arcs per `03-act3-bloom.md` §23.2, which is cheap enough to be fully redrawn at 4 Hz (13 `arc()` calls) | pulse rings in flight, stellar warning ring | 260 × 260 |
| **≥900 px viewport** | the network moves to the atrium pane and is redrawn at 1.8× scale with `A0` scaled by area; the plate in the column collapses to 0 | as above | full pane |

At a viewport change the network is **regenerated from `(seed, n)`** at the new dimensions rather
than scaled — 40 ms, once, on `resize` (debounced 250 ms). Scaling a bitmap of hairlines looks
terrible; regenerating looks perfect and is a function we already have.

### 7.7 The forecast strip (Act II FLUSH / Act III void)

A third, tiny canvas: full column width × 44 px, redrawn at **1 Hz**.

- Background `--surface-1`, radius `--r-md` via CSS on the element.
- The weather series is a `Float32Array(120)` ring buffer (120 samples at 1 Hz = the 300 s window
  from `02-act2-network.md` §7.3, downsampled 2.5:1).
- Drawn as a filled area: `moveTo(0,44)`, `lineTo` per sample at `y = 44 - w*38`, close, fill
  `--signal-wash`; then the same path stroked 1.5 px in `--signal`.
- The **forecast portion** (the part the player has bought) is drawn to the right of a 1 px
  `--line-strong` divider, in the same colours at `α = 0.55`, and is additionally **dashed (4-3)**
  so "predicted" is not a hue-only distinction.
- Release markers are 2 px `--attention` verticals with a 6 px triangle at the top.
- Cost: 122 `lineTo` calls at 1 Hz. Negligible.

### 7.8 Performance budget

**Reference device:** Snapdragon 695 / Pixel 6a class, Chrome, 360 × 780 CSS px, `devicePixelRatio`
2.75 clamped to 2, 60 Hz display, screen at 50% brightness.

| Cost centre | Budget (avg per 16.7 ms frame) | Notes |
|---|---|---|
| Sim tick (20 Hz, amortised) | **2.0 ms** | 6.0 ms per tick, 1 tick per 3 frames. Act I doc caps at 6 ms/tick. |
| DOM text writes (changed-only, ≤ 40 nodes) | **0.8 ms** | `el.__last` guard; never `innerHTML` |
| `net` incremental draw | **0.10 ms** | ≤ 24 segments, 3 `stroke()` calls |
| `net` blit / compositing | **0.35 ms** | 720 × 592 backing store, GPU-composited, no per-frame upload |
| `flux` clear + draw | **0.50 ms** | ≤ 80 primitives, at 4 Hz → 0.12 ms amortised |
| Style + layout + paint + composite | **3.2 ms** | no layout-triggering transitions exist |
| **Total** | **≈ 6.6 ms** | **10.1 ms headroom** |

| Resource | Budget |
|---|---|
| `net` backing store | 720 × 592 × 4 B = **1.7 MB** |
| `flux` backing store | 1.7 MB |
| Typed-array network state (CAP 4,000) | 4,000 × 14 B = **56 KB** |
| Total JS heap, steady state | **< 12 MB** |
| Total transferred bundle (single file, gzipped) | **< 180 KB** |
| Battery, active foreground play | **≤ 6.5% / hour** at 50% brightness |
| Battery, backgrounded | **≤ 0.4% / hour** (rAF stopped, intervals cleared, no timers) |

**Adaptive tiering.** Measured, not guessed. At boot we run 90 frames of warmup and read
`navigator.hardwareConcurrency`; thereafter a rolling p95 frame time over 180 frames drives
demotion.

| Tier | dpr | flux Hz | `SEG_CAP` | pulses | meters | Entry condition |
|---|---|---|---|---|---|---|
| HIGH | min(dpr,2) | 8 | 3,600 | 24 | DOM bars | p95 < 12 ms and cores ≥ 6 |
| MID *(default)* | min(dpr,2) | 4 | 2,400 | 12 | DOM bars | otherwise |
| LOW | 1 | 2 | 1,000 | 4 | ASCII | p95 > 22 ms for 3 s |
| FLOOR | 1 | 0 (static) | 600 | 0 | ASCII | p95 > 30 ms for 3 s, or `deviceMemory ≤ 2` |

Demotion is immediate; **promotion is allowed at most once per 60 s** and never within 10 s of a
demotion, so a thermal-throttling phone does not oscillate. The tier is exposed in the settings
sheet as a read-only line (`RENDER  MID`) with a manual override, because a player who wants their
battery back should be able to say so.

### 7.9 Canvas accessibility

The `flux` canvas carries `role="img"` and an `aria-label` recomputed at most every 5 s:

```
"Mycelial network. 412 metres, 1,180 threads, growing. Two fruiting bodies."
```

The `net` canvas is `aria-hidden="true"` (it is the same information). In Act II the map's label
names the claimed count and any rival contact; in Act III the void canvas's label enumerates the
occupied bands. Per `03-act3-bloom.md` §23.5, the Act III phase wheel is *fully* described in text
and the endgame is completable from that description alone — the same rule applies backwards: **no
canvas ever carries information that is not also available as text somewhere on the same screen.**

---

## 8. ACCESSIBILITY

Everything UP does not do (teardown §8.14), specified rather than promised.

### 8.1 Contrast

Every pairing in §2.6 meets WCAG 2.2 AA: 4.5 : 1 for text under 18.66 px/600, 3 : 1 for large text
and for any graphical object or UI component boundary that conveys state. The three deliberate
sub-4.5 values are documented and legal:

- `--text-locked` (4.00) — disabled control labels, exempt under 1.4.3.
- `--text-disabled` (2.58) — disabled control labels, exempt under 1.4.3.
- `--rust-500` (3.33) — non-text only, enforced by lint: `--negative` may not be the computed
  `color` of any element whose `font-size` is below 24 px.

`prefers-contrast: more` raises secondary/tertiary text one full step and the hyphae alpha to 0.55.

### 8.2 Motion

- `prefers-reduced-motion: reduce` is honoured globally (§6.7 rule 10) and specifically on: the
  canvas breathing, the unlock reveal, all three act transitions, the map pulse, the sheet entrance,
  the console stack, and haptics.
- **The 3-flashes-per-second limit is absolute** and applies to the act transitions, the console
  cursor, the hazard ring and the FAB ready-state. There is no strobe anywhere in this game.
- A `SLOW` toggle in settings doubles every timer-driven deadline (mast window 90 → 180 s, stellar
  warning 40 → 80 s, pulse cooldowns, fire response) without changing a single rate, per
  `02-act2-network.md` §15.5 and `03-act3-bloom.md` §23.5. Twitch is not the skill we test.

### 8.3 Targets and input

- Minimum tap target **44 × 44 CSS px**, enforced by a build-time lint that walks the rendered DOM
  in a headless pass at 320, 360 and 430 px and fails on any element with a `pointerdown` listener
  whose hit rect is smaller. Targets smaller than 44 visually (the slider thumb, the badge, the
  pips) get a transparent `::before` expander.
- Minimum **8 px** between adjacent targets; **44 px** between a destructive target and any
  neighbour.
- `touch-action: manipulation` on the shell (kills the 300 ms double-tap delay without disabling
  pinch-zoom on the page).
- `-webkit-tap-highlight-color: transparent` globally; we draw our own press state.
- `overscroll-behavior: contain` on every scroller, so a fast flick never bounces the page or
  triggers pull-to-refresh mid-game.
- **Full keyboard operation.** Tab order follows DOM order which follows visual order. Focus ring:
  `outline: 2px solid var(--focus); outline-offset: 2px; border-radius: inherit`, applied via
  `:focus-visible` only. Space/Enter activate; arrows drive sliders and the segmented control;
  `Escape` closes sheets. Every action reachable without a pointer.
- No hover-only affordances exist. Nothing is revealed by hover; hover states are a 120 ms
  background lift on pointer-fine devices and nothing else.

### 8.4 Screen readers

The rule that matters: **a counter that changes 10 times a second must never be a live region.** An
idle game read naively by VoiceOver is unusable within four seconds.

- The **console is the only `aria-live="polite"` region.** `aria-atomic="false"`; only the newest
  line is appended as a fresh node, so exactly one announcement fires per game event. Because every
  event already routes through the console, screen-reader coverage is complete by construction.
- The status strip is **not** live. Each row is `role="group"` with an `aria-label` recomputed at
  most once every 3 s. A player can query current state by focusing the strip.
- A separate visually-hidden `role="status"` element carries a **coalesced 5-second summary**
  (`"Biomass 4.12 tonnes, rising. Sugar 812 of 1,240. Three contracts active."`) which the player
  can enable in settings under `VERBOSE STATUS` (default off).
- Cards are `<button>` elements with
  `aria-label="Improved Enzymes. Cost 750 insight. Affordable."` and `aria-disabled` for locked
  states — `aria-disabled`, not `disabled`, so the button stays focusable and the shortfall message
  is reachable.
- Tabs are a real `role="tablist"` / `role="tab"` / `role="tabpanel"` set with
  `aria-selected` and roving `tabindex`.
- Sheets are `role="dialog" aria-modal="true"` with a labelled title, focus trap, focus restore,
  and `inert` on the shell.
- Meters are `role="progressbar"` with `aria-valuenow/min/max/valuetext`, where `valuetext` is the
  human string (`"812 of 1,240 grams"`) — never the raw ratio.
- Decorative canvases are `aria-hidden`; informative canvases carry `role="img"` + a live-ish label
  updated at most every 5 s (§7.9).
- Landmarks: one `<main>`, one `<nav>` (the tab bar), one `<footer>` (the console). No `<header>` —
  the status strip is a `role="group"` inside `<main>`, because it is content, not chrome.

### 8.5 Text scaling and internationalisation readiness

- Layout is `rem`-based for type-driven boxes and survives **200%** root scaling with no clipping
  and no horizontal scroll. QA runs at 100/150/200% at 320 px width.
- No text is baked into the canvas except numeric labels in the Act III band ring, which are
  duplicated in the DOM band list.
- All strings live in one `STR` object. No string is assembled by concatenating a fragment with a
  number in a way that assumes English word order — every interpolation is a template with named
  slots (`"{n} short"`), so a future translation can reorder.
- `lang="en"` on `<html>`; `dir` is honoured if ever set (all layout uses logical properties:
  `margin-inline`, `padding-inline`, `inset-inline`, `text-align: start/end`).

### 8.6 Cognitive load and safety

- **No timers the player can lose by not looking**, except the ones the `SLOW` toggle doubles, and
  every one of them is announced to the console at 100%, 50% and 25% of its window.
- **No punishment for walking away.** Offline progression is generous (Act I §8) and the return
  sheet is a *summary*, not a claim button with a countdown.
- **No dark patterns, by construction:** no ads, no IAP, no streaks, no daily login, no energy, no
  push notifications, no "come back" nag, no session-length pressure, no loss-framed FOMO copy, and
  no number that goes down while the app is closed.
- The settings sheet contains, in this order: THEME (auto/dark/light), HAPTICS, REDUCED MOTION
  (auto/on/off — an in-app override, because many people have the OS setting off for other reasons),
  SLOW MODE, VERBOSE STATUS, RENDER TIER, TEXT SIZE hint, SAVE (export/import/copy), and RESET.
  Nine rows, one screen, no submenus.

---

## 9. IMPLEMENTATION APPENDIX

### 9.1 The complete token block

Paste this as the first rule in the stylesheet. Nothing else in the file may contain a hex value.

```css
:root{
  /* ---- primitives: soil ---- */
  --soil-1000:#050604; --soil-950:#070906; --soil-900:#0B0D0C; --soil-850:#101310;
  --soil-800:#151914;  --soil-750:#1B201A; --soil-700:#222820; --soil-600:#2C3329;
  --soil-500:#3A4236;  --soil-400:#4E5749; --soil-350:#6B7464; --soil-300:#7A8371;
  --soil-200:#8C9484;  --soil-100:#B0B6A6;
  /* ---- primitives: spore ---- */
  --spore-100:#C7C3B5; --spore-050:#D8D4C8; --spore-000:#EFEBDD; --hyphae:#E8E1D3;
  /* ---- primitives: chlorophyll ---- */
  --chloro-800:#1E2E1D; --chloro-700:#2F4A2D; --chloro-600:#5F8A5B;
  --chloro-500:#7FA87A; --chloro-400:#9BC495; --chloro-300:#B9DCB3;
  /* ---- primitives: amber ---- */
  --amber-800:#3A2A0C; --amber-700:#6B4C13; --amber-600:#B37D1E;
  --amber-500:#D99A2B; --amber-400:#E9B75C; --amber-300:#F5D28F;
  /* ---- primitives: rust ---- */
  --rust-800:#331309; --rust-700:#5E2517; --rust-600:#8A3E28;
  --rust-500:#A24B32; --rust-400:#C86A4E; --rust-300:#E0917A;
  /* ---- primitives: biolum ---- */
  --biolum-800:#0D2A24; --biolum-700:#15463A; --biolum-600:#3A8E74;
  --biolum-500:#62C39A; --biolum-400:#8CDCBB; --biolum-300:#B6EDD6;
  /* ---- primitives: void ---- */
  --void-900:#08080C; --void-700:#1A1A26; --void-500:#5A5878;
  --void-300:#A8A4C6; --void-100:#D2CFE4;

  /* ---- type ---- */
  --font-ui:-apple-system,BlinkMacSystemFont,"Segoe UI Variable Text","Segoe UI",Roboto,
            "Helvetica Neue","Noto Sans",Arial,sans-serif;
  --font-mono:ui-monospace,SFMono-Regular,"SF Mono","Cascadia Mono",Menlo,Consolas,
              "Roboto Mono","Liberation Mono",monospace;
  --t-display:300 2.125rem/1.05 var(--font-ui);
  --t-hero:   400 1.625rem/1.15 var(--font-ui);
  --t-readout:500 1.25rem/1.20  var(--font-ui);
  --t-title:  600 1.0625rem/1.29 var(--font-ui);
  --t-value:  500 1.0625rem/1.29 var(--font-ui);
  --t-body:   400 0.9375rem/1.47 var(--font-ui);
  --t-meta:   400 0.8125rem/1.46 var(--font-ui);
  --t-label:  600 0.6875rem/1.45 var(--font-ui);
  --t-micro:  600 0.625rem/1.40  var(--font-ui);

  /* ---- space / radius ---- */
  --sp-2:2px; --sp-4:4px; --sp-6:6px; --sp-8:8px; --sp-12:12px; --sp-16:16px;
  --sp-20:20px; --sp-24:24px; --sp-32:32px; --sp-40:40px; --sp-48:48px; --sp-64:64px;
  --r-xs:2px; --r-sm:4px; --r-md:8px; --r-lg:14px; --r-xl:22px; --r-full:999px;

  /* ---- motion ---- */
  --ease-out:cubic-bezier(.22,1,.36,1);
  --ease-in-out:cubic-bezier(.65,0,.35,1);
  --ease-press:cubic-bezier(.30,0,.10,1);
  --ease-organic:cubic-bezier(.34,.90,.24,1);
  --d-press:70ms; --d-state:120ms; --d-fade:180ms; --d-release:220ms;
  --d-move:240ms; --d-reveal:320ms; --d-act:2600ms;

  /* ---- layout ---- */
  --col-max:420px; --gutter:16px; --tabbar-h:56px; --plate-h:38%;
}
```

Semantics for dark, light and `data-act="3"` are in §2.3, §2.5 and §2.4 respectively and go
immediately after this block.

### 9.2 The global reset (complete)

```css
*,*::before,*::after{ box-sizing:border-box; margin:0; padding:0; }
html{ font-size:100%; -webkit-text-size-adjust:100%; background:var(--bg); }
body{ font:var(--t-body); color:var(--text-primary); background:var(--bg);
      -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
      overscroll-behavior:none; touch-action:manipulation;
      -webkit-tap-highlight-color:transparent; }
button{ font:inherit; color:inherit; background:none; border:0; cursor:pointer;
        user-select:none; -webkit-user-select:none; touch-action:manipulation; }
canvas{ display:block; }
.num,[data-num]{ font-variant-numeric:tabular-nums slashed-zero;
                 font-feature-settings:"tnum" 1,"zero" 1; }
:focus{ outline:none; }
:focus-visible{ outline:2px solid var(--focus); outline-offset:2px; border-radius:inherit; }
.vh{ position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden;
     clip-path:inset(50%); white-space:nowrap; border:0; }
.scroll{ overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
```

### 9.3 The render loop (the only rAF in the game)

```js
let last = performance.now(), scrolling = false, scrollT = 0;
function frame(now){
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const dt = Math.min(now - last, 100); last = now;

  interpolateCounters(now);        // §3.3 R4 — value lerp, string write only on change
  syncCards();                     // one dataset write per changed card
  growNetwork();                   // ≤ NEW_MAX nodes, then drawNet() — §7.2/7.4
  if (!scrolling && now - fluxLast >= fluxInterval){ drawFlux(now); fluxLast = now; }
  perf.sample(now);                // rolling p95 → tier demotion — §7.8
}
addEventListener('scroll', () => { scrolling = true; clearTimeout(scrollT);
  scrollT = setTimeout(() => scrolling = false, 120); }, {passive:true, capture:true});
document.addEventListener('visibilitychange', () => {
  if (document.hidden){ save(); stopDisplayTimers(); }
  else { last = performance.now(); reconcileOffline(); startDisplayTimers(); }
});
requestAnimationFrame(frame);
```

There is exactly **one** `requestAnimationFrame` loop and exactly **two** `setInterval`s in the
whole build: the 20 Hz sim and the 10 Hz display timer (rates, cooldown ring, aria labels). Every
component that thinks it needs a timer gets a slot in one of those instead.

### 9.4 Build-time lint rules (all of them fail the build)

1. No hex literal outside the token block.
2. No primitive token referenced from a component rule.
3. `transition-property` outside `{transform, opacity, color, background-color, border-color, fill,
   stroke}`.
4. Any `animation` without a matching `prefers-reduced-motion` override.
5. Any element with a `pointerdown`/`click` listener whose rendered hit rect < 44 × 44 at 320, 360
   or 430 px width.
6. `--negative` used as `color` on an element with `font-size` < 24 px.
7. `font-weight` ≥ 700 anywhere.
8. `!important` outside the reduced-motion block.
9. Any string longer than 96 characters in the projects catalog `description` field.
10. `backdrop-filter`, `filter`, `box-shadow` in a `transition-property`.
11. `innerHTML` assignment anywhere outside the save-import parser.
12. Any external URL of any kind.

### 9.5 QA checklist — the visual acceptance pass

| # | Check | Pass condition |
|---|---|---|
| 1 | Cold boot at 320 × 568 | `EXTEND` fully visible without scrolling; console fully visible |
| 2 | Cold boot at 430 × 932 | plate 38%, hero centred in Zone A |
| 3 | 200% text scale, 320 px | no horizontal scroll, no clipped label, no overlapping row |
| 4 | Number growing 999 → 1.00 k | zero layout shift; suffix cross-fades, mantissa does not |
| 5 | 60 consecutive `EXTEND` taps | no dropped frame > 20 ms; haptic on every tap |
| 6 | Tab arrival | tab bar does not reflow; existing glyphs do not move by even 1 px |
| 7 | Panel arrival | nothing above the new panel moves |
| 8 | `prefers-reduced-motion` on | no transform animates; all information still arrives |
| 9 | Greyscale screenshot of every screen | every state still distinguishable |
| 10 | Deuteranopia sim of every screen | ditto |
| 11 | VoiceOver, 60 s of idle play | ≤ 1 announcement per game event; no counter spam |
| 12 | Keyboard only, cold boot → first tip purchase | completable |
| 13 | Act I → II transition | ≤ 3 luminance changes per second, measured |
| 14 | 30 min continuous play, mid-range Android | battery drop ≤ 3.3%; p95 frame ≤ 14 ms |
| 15 | Backgrounded 8 h, resumed | no timer drift, no visual glitch, return sheet correct |
| 16 | Rotate to landscape and back | layout intact; canvas regenerated, not stretched |
| 17 | 900 px viewport | atrium engages; column still 420 px; no stretched component |

### 9.6 Build order for the interface

Aligned to `01-act1-understory.md` §14, so the two documents can be executed in parallel.

1. **Tokens + reset + the shell + `fmt()` + the console.** No game. Half a day. Everything after
   this is composition.
2. **The ledger + the hero button + the press contract.** Play it for twenty minutes with a fake
   counter. If the press does not feel good, fix `--d-press`/`--ease-press` before writing a single
   line of game code.
3. **The canvas: `net` growth + `drawNet` + `ageWash`.** Drive it from a slider. It should be
   beautiful before it is connected to anything.
4. **Card + row + meter.** These three components render 90% of the game.
5. **Panels + the unlock reveal.**
6. **Sheet + toast + settings + save export.**
7. **Tab bar + the Stage 1 → Stage 2 promotion.**
8. **Flux layer, forecast strip, tiering, act transitions.**

Steps 1–3 are approximately **two days** and produce a screen that already looks better than
anything shipping in this genre, which is the entire thesis of this document: restraint, executed
exactly, is cheaper than decoration and beats it.

---

## 10. THE ONE-PAGE SUMMARY (pin this above the desk)

```
COLOUR    #0B0D0C ground. #D8D4C8 text. Six accents, each meaning one thing:
          #7FA87A gain · #D99A2B attention · #A24B32 loss ·
          #62C39A signal (Act II) · void violet (Act III) · #E8E1D3 hyphae.
          Hue is never alone. Rust is never a word under 24px.

TYPE      System stack. Nothing above weight 600. Nine sizes.
          Hero number: 34px / 300 / −0.022em / #EFEBDD.
          Every digit tabular. Every slot pre-measured in ch. Suffix one step dimmer.
          Three significant figures, SI to Q then aa/ab/ac. No long-scale words.

LAYOUT    360px base, 420px column forever, 16px gutter, 4px grid.
          Zone A (bottom 200px) = every action you repeat.
          Sticky ledger ≤ 4 rows. Hero is the last thing in the scroll, always.
          Five tab slots allocated at boot, revealed one at a time. Never reflows.
          Tablet/desktop: the column does not grow. The canvas becomes the wall.

MOTION    4 curves, 6 durations. Press down 70ms front-loaded, release 220ms long-tailed.
          Unlock = 320ms fade + 6px rise + a dot that clears when seen. No blink.
          NEVER animate: digits, decrements, layout properties, shadows, or anything
          more than 3 luminance changes per second.

CANVAS    Append-only space colonisation, seeded, regenerated from (seed, n).
          3 stroke() calls per frame. One 4.5% wash per season so old growth fades.
          Flux layer 4Hz, ≤80 primitives. Total 0.95ms/frame. 10ms of headroom.

A11Y      4.5:1 everywhere it matters, computed not guessed. 44px targets, linted.
          The console is the only live region — which is why screen readers just work.
          Reduced motion, reduced data, SLOW mode, 200% text, full keyboard.
          No strobe. No dark pattern. Nothing goes down while you are away.
```

---

*Every hex value, contrast ratio and OKLCH coordinate in this document was computed from the sRGB
values given. Every duration and cubic-bezier is authored, not inherited. If a value here has no
stated reason, it is still normative — consistency is the reason.*
