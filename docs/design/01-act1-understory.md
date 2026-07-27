# HYPHAE — ACT I: UNDERSTORY

**Complete mechanical specification. This document is the source of truth.**
Companion to `00-paperclips-teardown.md`. Every formula here is written to be typed directly into
JavaScript. Where a constant appears it is final unless a later tuning pass supersedes it in this file.

Scope: from the cold-boot first frame to the moment the player presses `DECIDE` and Act I ceases to
exist. Detailed minute-by-minute for the first 90 minutes; systemically complete for all of Act I
(expected length **95–160 minutes** for a first-time player).

---

## 0. Thesis for the act

> Act I is a **liquidity game wearing the costume of a nature documentary.**

The player learns exactly one hard lesson, and it is not "numbers go up". It is:

> **You are always short of the thing you promised.**

Everything in Act I is built to deliver that: you buy your food on a market with a moving price, you
sell the proceeds forward on fixed-rate contracts to counterparties who need you least in summer and
most in winter, and the seasons move the price of both at once. Biomass goes up the whole time. That
is the *reward*. The *game* is the gap between committed sugar and earned sugar.

Universal Paperclips' Act I taught optimisation under a moving input price (wire). We keep that and
add the thing UP faked with its stock market: **a counterparty who can say no, remember, and leave.**

Three copies-without-modification from the teardown (§9 principles 2, 3, 4):
- **Automation inside the first minute.** First autonomous producer at ~0:35.
- **`trigger` / `cost` split.** Everything visible-but-grey the instant it is conceptually available.
- **Overflow becomes a currency.** Deferred to Act II (Signal→Insight) by canon, but Act I seeds it:
  sugar over the storage cap *rots* visibly, which is what makes the player want Sclerotia.

Three beats we improve on:
- **Offline progression is generous and safe** (§4 of the Offline spec below).
- **The strategic layer has real agency** — species, terms, collateral, renegotiation, reputation.
- **The market has memory and trend**, so it can be *learned* rather than merely reacted to
  (beats teardown §8.12).

---

## 1. Clocks, units and global constants

```js
const SIM_HZ   = 10;          // simulation ticks per second
const DT       = 0.1;         // seconds per sim tick
const MARKET_HZ = 1;          // price walk: every 10th sim tick
const RENDER   = 'rAF';       // display interpolates between sim ticks; never simulate in rAF
const AUTOSAVE_S = 10;        // plus: on 'visibilitychange', 'pagehide', and every act transition
```

10 Hz, not 100 Hz. Phone battery is a design resource and 100 Hz `innerHTML` (teardown §7.8) is a
desktop luxury. Liveness is recovered by **interpolating the displayed counters in
`requestAnimationFrame`** from `lastValue → value` across the 100 ms window, so counters appear
to run continuously at 60 fps while the sim runs at 10 Hz. Sub-integer counters tick visibly.

### Time

```js
const SEASON_S = 360;              // one season = 6 real minutes
const YEAR_S   = 1440;             // one forest-year = 24 real minutes
const DAY_S    = 15;               // 24 days per season; flavour + contract term display
// Season index: 0 SPRING, 1 SUMMER, 2 AUTUMN, 3 WINTER
// Cold boot: season = AUTUMN, seasonPhase = 0.1667  →  first season boundary at t = 300 s
```

A first playthrough of Act I spans **4–6.5 forest-years**. The annual cycle is the largest structure
in the act; the player must live through at least three winters to have learned it, which is the
real reason Act I is ~2 hours.

### Numbers

All masses are grams. Display via a single formatter:

```js
const MASS_SUFFIX = ['g','kg','t','kt','Mt','Gt','Tt','Pt'];   // ×1000 each
function fmtMass(g){
  let i=0, v=g;
  while (v >= 1000 && i < MASS_SUFFIX.length-1){ v/=1000; i++; }
  const d = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return v.toFixed(d) + ' ' + MASS_SUFFIX[i];
}
```
Sugar uses the same formatter. Minerals are unitless integers-with-2dp, suffixed `k/M/G`.
**No long-scale English words, ever** (teardown §8.11).

---

## 2. Act I resource set

| # | Resource | Symbol | Kind | Produced by | Consumed by | First seen |
|---|---|---|---|---|---|---|
| 1 | **Biomass** | `biomass` | stock, g | decomposition | every upgrade, tips, patches | t = 0 |
| 2 | **Substrate** | `sub[type]` | stock, g, 7 typed pools | bought on Litter Market | decomposition | t ≈ 3 s |
| 3 | **Sugar** | `sugar` | stock, g, **capped** | decomposition | buying substrate; contract delivery | t ≈ 50 s |
| 4 | **Minerals** | `mineral` | stock | mycorrhizal contracts; Oxalate Weathering | tips ≥ 24, structures, patches | t ≈ 5 min |
| 5 | **Hyphal Tips** | `tips` | count | bought | — (production units) | t ≈ 35 s |
| 6 | **Hyphae** | `hyphae` | derived, metres | `hyphae = 0.35 * tips + patchFronts` | display + gates | t ≈ 35 s |
| 7 | **Moisture** | `moisture` | env, 0.15–1.50 | season + weather | — | t = 300 s |
| 8 | **Reputation** | `tree.rep`, `netRep` | 0–100, per-tree + global | honoured contracts | defaults, early exits | t ≈ 7 min |

Six things the player *has*, two things the world *does to them*. That is the whole ledger.
Nothing else is added in Act I. (**Signal** appears in the last 90 seconds of the act, as a readout
with no uses, and is Act II's problem.)

### Why exactly these

- **Biomass** is the paperclip: the monotone counter, the thing you are, the price of everything.
- **Substrate** is the wire: a purchased input on a moving market that you personally inflate.
- **Sugar** is the money — but unlike UP's dollars it is *also produced by the same process as the
  counter*, which means the player's single allocation decision (**reinvest into throughput vs.
  export for capability**) is live from minute two and never resolves.
- **Minerals** are the gate. Biomass alone cannot buy growth past tip 24. This is what forces the
  player off the comfortable decomposition loop and onto the trading floor.
- **Moisture** and **Reputation** are the two ways the world pushes back — one impersonal and
  cyclical, one personal and remembered.

### Sugar cap (and why it exists)

```js
sugarCap = 400 + 30 * tips + sclerotiaBonus;     // sclerotiaBonus = 0 until project 9
// each sim tick:
if (sugar > sugarCap){ const rot = (sugar - sugarCap) * 0.06 * DT; sugar -= rot; rotted += rot; }
```
Overflow **rots at 6%/s of the excess** and the UI shows a small red `−x.x g/s (rot)` under the sugar
readout. This does three jobs: it prevents hoarding sugar to trivially cover contracts, it makes
Sclerotia (project 9) the most wanted item in the middle of the act, and it trains the player to
*spend* — either into substrate or into contracts — which is the act's whole verb.

### The fiction, stated once

Textbook mycorrhiza runs the other way: the tree gives sugar, the fungus gives minerals. HYPHAE
inverts it and **the inversion is deliberate and load-bearing.** You are a saprotroph first; you eat
the dead. You have carbon and no minerals. The trees have deep roots into mineral horizons and
hydraulically lift what you cannot reach — and in winter, in shade, in drought, in a mast year, they
are carbon-starved and you are not.

So in Act I **you are the creditor.** You are buying the forest's dependence one contract at a time,
and you think you are trading. Act II collects.

Never explain this in-game. One console line at the first contract signing:

> `The birch takes what you offer. It does not ask what you are.`

---

## 3. The first tap

### 3.1 The cold-boot screen (portrait, one column, nothing above the fold that is not needed)

```
┌───────────────────────────────┐
│                               │   ← 38% of viewport: black, with a
│                               │      procedurally drawn pale thread,
│           ╱                   │      one canvas stroke, drifting 1px
│          ╱                    │      every 400 ms. That is the entire
│         ╱                     │      art budget for the first minute.
│                               │
├───────────────────────────────┤
│  BIOMASS                 0 g  │
│                               │
├───────────────────────────────┤
│                               │
│        ┌─────────────┐        │
│        │   EXTEND    │        │   ← 64 px tall, 62% width, centred,
│        └─────────────┘        │      bottom third: thumb country.
│                               │
├───────────────────────────────┤
│ > the forest floor is warm  ▌ │   ← 5-line console, newest with cursor
└───────────────────────────────┘
```

No tutorial. No modal. No settings gate. No name entry. No "welcome". The word **EXTEND** and a
number that says 0 are the entire instruction set, exactly as `Make Paperclip` was
(teardown §9 principle 1).

The button is at the **bottom**, not the top: on a phone the top of the screen is where you *read*
and the bottom is where you *touch*. This inverts UP's desktop layout and it is non-negotiable for
every screen in the game.

### 3.2 What the tap does

```js
const TAP_LITTER = 2.0;       // grams of litter processed per tap
function onExtend(){
  const g = Math.min(TAP_LITTER, totalSubstrate());
  if (g <= 0){ consoleMsg("nothing here is dead enough"); return; }
  consumeSubstrate(g);                  // drawn from the cheapest available typed pool
  biomass += g * 0.50 * etaB(type);     // +1.00 at cold boot
  sugar   += g * 0.20 * etaS(type);     // +0.32 at cold boot (leaf, etaS 0.8) — not yet displayed
  hyphaeManual += 0.004;                // cosmetic: the drawn thread lengthens
  haptic(8);                            // 8 ms; respects prefers-reduced-motion & a settings toggle
}
```

**Screen:** `BIOMASS 0 g` → `1.00 g`. The thread on the canvas grows by four thousandths of a metre,
which is 1–2 px, which is exactly enough to notice on the fifth tap and not before.

**Hands:** one thumb, one button, ~1.7 taps/sec sustained.

**Feel:** the number moves by exactly 1 and there is an 8 ms haptic. The canvas thread is the only
thing on screen that is not a number, and it is *yours*, and it is growing. That is the whole
first three seconds and it needs to be nothing else.

**What the player does not know:** `sugar` is already accumulating, invisibly, at 0.32/tap. It is
revealed at t≈50 s with ~15 g already in it. Retroactive discovery of a resource you have been
producing all along is worth more than the same resource introduced empty, and it costs nothing.

**What the player also does not know:** `substrate` starts at **2,000 g** and every tap eats 2 of
them. They are already in a supply crisis. This is the wire lesson (teardown §1 beat 0), transposed:
*the seed of the crisis is on screen at t=0 and is not remarked upon.*

### 3.3 Cold-boot state

```js
const NEW_GAME = {
  t: 0, biomass: 0, sugar: 0, mineral: 0, tips: 0,
  sub: { leaf: 2000, needle: 0, twig: 0, bark: 0, log: 0, stump: 0, carrion: 0 },
  season: 2 /*AUTUMN*/, seasonPhase: 0.1667, moisture: 1.05,
  netRep: 0, trees: [], contracts: [],
  marketOpen: false, projectsOpen: false, patches: [PATCH_HOME],
  flags: {}
};
```
`moisture = 1.05` is the exact peak of the moisture response curve (§5.3), so every multiplier in
the game is **1.000** for the first five minutes. The first numbers the player sees are clean
integers. Complexity arrives when the first season turns, and not one second earlier.

<!--NEXT-->
