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

---

## 4. The first eight unlocks

Each is stated as `trigger → what appears → why that threshold and not another`. Triggers are
evaluated every sim tick in `manageUnlocks()`. Every unlock prints **one** console line and
`blink()`s the new element (12 opacity toggles at 30 ms — copied verbatim from UP).

### Unlock 1 — `SUBSTRATE` readout · trigger `biomass >= 5`

**Fires at ≈ 3 s** (5 taps).

Appears directly under BIOMASS:
```
SUBSTRATE            1,990 g
  leaf litter        1,990 g
```
Console: `> something is being spent`

**Why 5.** Four taps is enough to establish "the number goes up by one" as a rule; the fifth breaks
it by revealing a second number that goes *down*. Fire it any earlier and the two readouts arrive
together and neither lands. Fire it later (say 25) and the player has already formed the belief that
biomass is free, which makes the crisis at 2:00 feel like a rug-pull rather than a consequence.
This is the single cheapest way to establish that the world has a budget.

### Unlock 2 — `HYPHAL TIP` purchase · trigger `biomass >= 60`

**Fires at ≈ 35 s** (60 taps at 1.7/s).

```
  HYPHAL TIPS                 0
  ┌───────────────────────────┐
  │  GROW TIP           60 g  │
  └───────────────────────────┘
  litter processed:      0 g/s
```

```js
tipCost(n)  = Math.ceil(Math.pow(1.10, n) + 59);   // n = tips owned
// 0:60  1:61  2:61  5:61  10:62  20:66  30:76  40:104  50:177  60:364  75:1,254  90:5,412  100:13,840
```

Additive base, geometric tail — UP's `1.1^n + 5` shape (teardown §5). The first ~25 tips cost
essentially the same, which produces the **rapid-fire buy burst** that is the single best feel-beat
in the genre, and the wall lands around tip 70–90 where the mineral gate (§6.4) is already biting.

**Why 60.** At 1.7 taps/sec — measured comfortable one-thumb rate, not a mash rate — 60 taps is
**35 seconds**. The teardown's mapping table mandates ≈45 s and "do not slow it down"; 35 s is inside
that with margin for a slower tapper (1.2/s → 50 s). Sixty is also legible: the player can see
`60 g` and their own `+1` and do the arithmetic without being told.

**Why it is not free and not a project.** The first automation must be a *purchase* so that the
player's first act of saving is rewarded within one minute, and so that the verb changes from
*tap to produce* to *tap to buy*. They will press GROW TIP 6–10 times consecutively in the following
80 seconds and that burst is the moment the game stops being a toy.

### Unlock 3 — `SUGAR` readout · trigger `tips >= 3`

**Fires at ≈ 60 s.** Sugar is revealed **already containing 20–30 g.**

```
SUGAR                   24.6 g / 490 g
```
Console: `> you have been leaking sugar since the first thread`

**Why tips ≥ 3 and not a sugar threshold.** Tying it to tips guarantees it lands *after* the buy
burst has begun, so it reads as a consequence of scaling up rather than as a tutorial step. Three
tips is also the point at which passive income (4.5 g/s biomass) visibly exceeds tapping, i.e. the
exact moment the player's attention is free to receive a new noun.

### Unlock 4 — `THE LITTER MARKET` · trigger `totalSubstrate() <= 500 || t >= 210`

**Fires at ≈ 100–140 s** for a normal player (the `t >= 210` clause is a floor for a player who
walked away).

The market panel opens *because you are running out*. Console:
`> the leaf mat under you is nearly gone. others are still eating.`

This is the crisis-creates-the-shop beat (UP's wire, teardown §1 beat 4) and the timing is
deliberate: at ~20 tips the drain is 60 g/s and 2,000 g of starting litter lasts about 33 seconds of
full production. The player watches the substrate readout fall for roughly 30 seconds before the
market opens — **long enough to be alarmed, short enough not to be stuck.**

If substrate hits 0 before the player buys, production stops and the console says
`> nothing here is dead enough`. There is no fail state (see §7.7, the Windfall failsafe).

### Unlock 5 — `SEASONS / MOISTURE` · trigger `t >= 300` (first season boundary)

**Fires at exactly 5:00.** Autumn → Winter.

The header gains a thin band:
```
◔ WINTER · day 1/24            moisture 1.05 ▾
```
and every production multiplier that has been silently 1.000 begins to move. Console:
`> the first frost. everything slows. the trees stop making sugar.`

**Why 5:00 and why winter first.** By 5:00 the player has a working loop (tips + market) and is
about to be bored by it. Winter cuts throughput to ~0.24× over the following 90 seconds — the
harshest event in the act, delivered before the player has anything invested enough to lose. It
teaches the annual cycle by breaking things, and it arrives simultaneously with the *reason* trees
will pay for sugar (they are carbon-starved in winter), which sets up unlock 7 as a rescue rather
than a mechanic.

### Unlock 6 — `THE UNDERSTORY` (trees) · trigger `sugar >= 250 && season == WINTER`

**Fires at ≈ 6:00–7:30.**

A new panel below the market. It contains one entry:

```
  BIRCH · 40 y · shallow-rooted
  carbon deficit ████████░░  0.78
  "will take 3.2 g/s"                [ NEGOTIATE ]
```

Console: `> a root brushes yours. it is thin, and it is hungry.`

**Why sugar ≥ 250 AND winter.** The conjunction is the whole point. Sugar 250 proves the player has
surplus (i.e. this is an opportunity, not a lifeline). Winter guarantees `needMult` is at its annual
peak (§6.3), so the **first contract the player is ever offered is the best-priced one they will see
for twenty minutes.** They will sign it, feel clever, and then discover in spring that the rate they
locked was a function of a season that ended. That is the act's thesis delivered as a lived
experience within ten minutes, and it costs one `&&`.

Birch specifically: lowest volume, lowest patience, cheapest mistake (§6.2).

### Unlock 7 — `ADAPTATIONS` (the projects tree) · trigger `biomass >= 2,000`

**Fires at ≈ 8:00–9:30.**

Two projects appear at once, one affordable and one not — the `trigger`/`cost` split made visible on
the first frame the panel exists:

```
  ┌───────────────────────────┐  ┌───────────────────────────┐
  │ RHIZOMORPH CORDS          │  │ HYDROPHOBIC SHEATH        │
  │ (900 g)                   │  │ (1,400 g)                 │
  │ Bundled transport hyphae.  │  │ Water held against the    │
  │ +18% litter throughput.   │  │ frost. Halves seasonal    │
  │                           │  │ moisture penalty.         │
  └───────────────────────────┘  └───────────────────────────┘
```
(The second is greyed if unaffordable and stays on screen, forever, until bought.)

**Why 2,000 biomass.** It is roughly the 8-minute mark at a normal curve, which places it one full
beat after the season system and one beat before the mineral wall. UP put Projects at 3:00; we put
them at 8:00 because we have spent minutes 3–7 on two systems UP did not have (the market and the
trees), and the metronome (§4.9) is satisfied throughout.

### Unlock 8 — `MINERAL` gate · trigger `tips >= 24` (hard), readout at `tips >= 20` (warning)

**Fires at ≈ 10:00–12:00.**

At `tips >= 20` the GROW TIP button gains a second, greyed line:
```
  ┌───────────────────────────┐
  │  GROW TIP     66 g · 0 min│      ← "min" = mineral, greyed
  └───────────────────────────┘
```
At `tips >= 24` the mineral figure becomes real and non-zero:

```js
tipMineralCost(n) = n < 24 ? 0 : Math.ceil(0.06 * Math.pow(n - 23, 1.35));
// 24:1  30:1  36:2  40:3  50:5  60:8  75:13  90:19  100:23  120:32
```

`mineral` is at that moment **0**, and the only source of minerals in the game is a tree.

**Why 24 and why a four-tip warning.** Twenty-four tips is where a player who has been buying
steadily arrives at ~11 minutes; it is late enough that decomposition feels mastered and early
enough that mastery has not calcified. The four-tip warning window exists because a hard wall with
no forecast is a bug report ("the button broke"), whereas a greyed `0 min` that turns into `1 min`
is a *plan*. This is the trigger/cost split applied to a cost line rather than a whole button.

**What it does to the player.** It converts the tree panel from a curiosity into the game. Everything
after this point in Act I is downstream of the sentence *"I need minerals, and minerals come from
somebody who wants something."*

---

## 4.9 The metronome — beat sheet, 0:00 → 15:00

Something new every 60–120 seconds. Times assume 1.7 taps/s and a player who buys the obvious thing.

| Time | Event | Player state |
|---|---|---|
| 0:00 | EXTEND. Biomass 0. | 1 button |
| 0:03 | **Substrate revealed** (unlock 1) | 2 numbers, one falling |
| 0:35 | **HYPHAL TIP** (unlock 2) — first automation | first purchase |
| 0:36–1:20 | buy burst: tips 1→7 at ~61 g each | ~10 g/s biomass |
| 1:00 | **Sugar revealed** with 24 g already in it (unlock 3) | 3 resources |
| 1:40 | Substrate falling visibly; console warns once | first alarm |
| 2:00 | **THE LITTER MARKET** (unlock 4) | buy/sell verb; 7 deadfall types, 3 unlocked |
| 2:10 | first purchase: leaf @ ~0.108 sugar/g | complicity begins (`base *= 1+8e-5·g`) |
| 2:30–4:30 | tips 8→20; the sugar allocation dilemma is live | 30 g/s, sugar ±0 |
| 3:30 | *Rhizomorph Cords* becomes visible-but-greyed (needs Adaptations at 8:00 — it is **pre-announced** in the console at tips ≥ 12: `> the threads want to bundle`) | desire has an address |
| 5:00 | **WINTER** (unlock 5). Throughput → 0.24×. | first collapse |
| 5:30 | Player buys cheap winter twig (ice-break litterfall ×2.4) or watches production die | first market read |
| 6:30 | **THE UNDERSTORY** — Birch offers (unlock 6) | negotiation UI |
| 7:00 | First contract signed. Minerals begin. | commitment meter appears |
| 8:30 | **ADAPTATIONS** (unlock 7) | projects tree |
| 9:00 | *Dormancy Clause* triggers (first contract signed) and is the cheapest thing on screen | offline safety |
| 11:00 | **SPRING.** Moisture 1.15, birch's deficit spikes at bud-break for 60 s, then collapses to 0.1 | the lock-in lesson |
| 11:30 | **Mineral gate** at tip 24 (unlock 8) | the act's real shape |
| 13:00 | Second tree (Douglas Fir) appears: `netRep >= 8` | portfolio thinking |
| 14:30 | *Mycelial Ledger* becomes affordable (needs 10 market purchases) | price charts → the market becomes learnable |

**Every single beat above is a new noun or a new verb, and none of them is a tooltip.**

---

## 5. Production: the exact formulas

### 5.1 The pipeline, in one diagram

```
              LITTER MARKET  ──(costs sugar)──►  SUBSTRATE (7 typed pools)
                    ▲                                    │
                    │                                    │ decomposition
                (sugar)                                  ▼
                    │                        ┌───────────────────────┐
                    └────────────────────────┤  BIOMASS   (η_B 0.50) │
                                             │  SUGAR     (η_S 0.20) │
                                             │  respired  (      30%)│
                                             └───────────┬───────────┘
                                                         │ (sugar)
                                          MYCORRHIZAL CONTRACTS
                                                         │
                                                         ▼
                                                     MINERALS ──► tips ≥24, structures, patches
```

Thirty per cent of everything you eat is respired and gone. This is real fungal carbon-use
efficiency and it is also the reason the numbers stay legible: **you can never get more out than you
put in, so the player's intuition about conservation is never violated.** One console line, once,
at the first market purchase: `> a third of everything you eat becomes air.`

### 5.2 Throughput

```js
const TIP_THROUGHPUT = 3.0;    // grams of litter per tip per second, base

function throughputPerSec(){
  return tips
       * TIP_THROUGHPUT
       * enzymeMult()          // product of enzyme projects; 1.00 at start
       * structureMult()       // Rhizomorph/Coenocyte/Anastomosis; 1.00 at start
       * moistureMult()        // §5.3; 1.000 at cold boot
       * tempMult()            // §5.3; 1.000 at cold boot (autumn)
       * patchMult();          // 1 + 0.06*(patches-1)
}
```

`tips = 1` ⇒ 3.0 g litter/s ⇒ **1.50 g biomass/s and 0.60 g sugar/s**, at cold boot, exactly.
`GROW TIP` shows `+1.50 g/s` on its face so the payback period (60/1.50 = 40 s at tip 1, dropping to
under 3 s by tip 25) is directly readable.

### 5.3 Environment multipliers

```js
const SEASON_MOIST = [1.15, 0.70, 1.05, 0.55];   // spring, summer, autumn, winter
const SEASON_TEMP  = [0.95, 1.15, 1.00, 0.55];

// moisture relaxes toward target; time constant ~25 s so seasons *slide*, they do not snap
function stepMoisture(){
  const target = SEASON_MOIST[season] * weatherMoistMod;   // weather events, §7
  moisture += (target - moisture) * 0.004;                 // per sim tick @10 Hz
}

// unimodal: fungi want damp, not drowned
function moistureMult(){
  return Math.exp( -Math.pow(moisture - 1.05, 2) / 0.30 );
}
// m=0.45 → 0.325   m=0.55 → 0.435   m=0.70 → 0.665   m=1.05 → 1.000
// m=1.15 → 0.967   m=1.30 → 0.822   m=1.45 → 0.587  (anoxic, waterlogged)

function tempMult(){
  return SEASON_TEMP[season] * (antifreeze && season===3 ? 1.545 : 1.0);  // →0.85 in winter
}
```

Combined seasonal envelope on throughput (no upgrades):

| Season | moisture (settled) | moistureMult | tempMult | **product** |
|---|---|---|---|---|
| Spring | 1.15 | 0.967 | 0.95 | **0.919** |
| Summer | 0.70 | 0.665 | 1.15 | **0.765** |
| Autumn | 1.05 | 1.000 | 1.00 | **1.000** |
| Winter | 0.55 | 0.435 | 0.55 | **0.239** |

**Winter is a 4.2× production collapse.** That is intentional and it is the engine of the entire
act: winter is also when `needMult` (§6.3) peaks at 2.5–3.2× on the contract side. The correct play
— which nobody will find on their first winter and most will find by their third — is:

> **Buy substrate cheap in autumn, stockpile it, decompose through winter at a loss on throughput,
> and sell the sugar into a 3× market. Autumn is your input season; winter is your output season.**

Two projects soften it (*Hydrophobic Sheath*, *Antifreeze Glycoproteins*) to a floor of ~0.55×.
Neither removes it. **The seasons are never automated away.**

### 5.4 Decomposition and yield

Consumption is drawn from typed substrate pools by an explicit **priority order** the player sets
(a drag-to-reorder list, default: cheapest-per-gram first). Each type has its own decay constant.

```js
function stepDecomposition(){
  let budget = throughputPerSec() * DT;        // grams of litter we may process this tick
  for (const type of consumptionOrder){
    if (budget <= 0) break;
    const D = DEADFALL[type];
    // k slows a type's *throughput*: hard substrate occupies tips for longer
    const effBudget = budget * D.k * enzymeK(type);
    const g = Math.min(effBudget, sub[type]);
    if (g <= 0) continue;
    sub[type] -= g;
    biomass   += g * 0.50 * D.etaB;
    sugar     += g * 0.20 * D.etaS;
    mineral   += g * D.mineralPerG;            // only carrion & bark are non-zero
    processed += g;
    budget    -= g / (D.k * enzymeK(type));    // charge back the tip-time actually used
  }
  starving = (budget > 1e-9);                  // drives the amber "STARVING" chip in the header
}
```

The `k` mechanic is the important one: **wood does not give you fewer grams per gram, it gives you
fewer grams per second.** A network eating stumps has a fraction of the throughput of one eating
leaves, but converts what it does eat at 2.2× the biomass yield and 2.6× the sugar yield.

> **Leaf litter is cash flow. Wood is capital.**
> When you are time-constrained (few tips, plenty of sugar) you want leaves.
> When you are sugar-constrained (many tips, tight contracts) you want wood.
> The bottleneck flips three or four times across Act I, and the answer flips with it.

### 5.5 Deadfall types — the full table

| id | name | `k` | `etaB` | `etaS` | `mineralPerG` | base price (sugar/g) | market cap (g) | base litterfall (g/s) | unlocked by |
|---|---|---|---|---|---|---|---|---|---|
| `leaf` | Leaf litter | 1.60 | 1.00 | 0.80 | 0 | **0.108** | 250,000 | 12.0 | start |
| `needle` | Needle mat | 1.00 | 1.00 | 1.00 | 0 | **0.130** | 160,000 | 9.0 | start |
| `twig` | Fine deadfall | 0.70 | 1.15 | 1.20 | 0 | **0.144** | 90,000 | 5.0 | start |
| `bark` | Bark slough | 0.45 | 1.30 | 1.40 | 0.00012 | **0.157** | 60,000 | 3.0 | Hemicellulase |
| `log` | Fallen log | 0.22 | 1.60 | 1.80 | 0 | **0.180** | 400,000 | 2.0 | Peroxidase (Mn) |
| `stump` | Heartwood stump | 0.10 | 2.20 | 2.60 | 0 | **0.234** | 250,000 | 0.6 | Laccase |
| `carrion` | Carrion | 3.00 | 0.80 | 0.50 | **0.0400** | **0.240** | 3,000 | 0.15 | `t >= 900` |

Derived, per gram: `sugarYield = 0.20 * etaS`, and **margin = 1 − price/sugarYield**:

| type | sugar out /g | price /g | **gross margin** | biomass /g | throughput weight |
|---|---|---|---|---|---|
| leaf | 0.160 | 0.108 | **32.5 %** | 0.50 | 1.60 |
| needle | 0.200 | 0.130 | **35.0 %** | 0.50 | 1.00 |
| twig | 0.240 | 0.144 | **40.0 %** | 0.575 | 0.70 |
| bark | 0.280 | 0.157 | **43.9 %** | 0.65 | 0.45 |
| log | 0.360 | 0.180 | **50.0 %** | 0.80 | 0.22 |
| stump | 0.520 | 0.234 | **55.0 %** | 1.10 | 0.10 |
| carrion | 0.100 | 0.240 | **−140 %** | 0.40 | 3.00 |

Read that ladder: **the harder it is to eat, the better the terms.** Nobody else in the forest can
digest lignin, so nobody bids the price of a stump up. This is a real ecological fact operating as a
pricing rule, and the player can derive it from the table without a word of explanation.

**Carrion is deliberately sugar-negative.** 100 g of carrion costs 24 sugar and yields 10 sugar and
**4.0 minerals**. That makes it a *direct* sugar→mineral conversion at 0.286 mineral per net sugar —
compare a good Fir contract at 0.012–0.020 mineral per sugar. Carrion is therefore **14–24× better
than any contract**, and it is capped at 3,000 g with 0.15 g/s regeneration. It exists to be the
thing the player wishes they had more of, to make the contract rates feel like a compromise rather
than a gift, and to give windfall events (§7.4, a deer dies) genuine weight.

### 5.6 Hyphae, and what the canvas draws

```js
hyphae = 0.35 * tips + 6.0 * (patches.length - 1) + hyphaeManual;   // metres
```
Purely a display and gate quantity — nothing consumes it. It exists because "412 m of you" is a
better sentence than "1,177 tips", because it gates the Act I finale (`hyphae >= 500`), and because
it drives the procedural canvas.

**The canvas** (the only visual, ~90 lines): a deterministic L-system / space-colonisation sketch
seeded by `saveSeed`, redrawn at 4 Hz onto a 1× offscreen buffer, with `segments = floor(hyphae*2)`
capped at 1,800. Stroke `hsl(42, 22%, 88%)` at 0.35 alpha on `#0b0d0c`. Tips glow when
`throughputPerSec() > 0` and dim to 0.12 alpha when `starving`. Under `prefers-reduced-motion` it
draws once per season instead of at 4 Hz.

**This is the whole art budget.** No images, no sprites, no fonts beyond the system stack.

---

# 5A. THE LITTER MARKET

The wire market from UP, rebuilt so that it has **memory, trend and an equilibrium** — i.e. so it can
be learned rather than merely reacted to (beats teardown §8.12). It is the first place the world
pushes back, and it is where the player becomes complicit.

### 5A.1 State

Per deadfall type `i`:

```js
mkt[i] = {
  base:   BASE_PRICE[i],       // slow-moving anchor; the player inflates this permanently
  price:  BASE_PRICE[i],       // what you pay right now, sugar per gram
  mom:    0,                   // momentum; this is why trends exist
  stock:  0.55 * capOf(i),     // grams available on the forest floor within reach
  hist:   Float32Array(120)    // ring buffer, 1 sample/s → the 2-minute sparkline
};
capOf(i)  = CAP_PER_PATCH[i]  * patches.length;
fallOf(i) = FALL_PER_PATCH[i] * patches.length * SEASON_FALL[i][season] * weatherFallMod[i];
```

### 5A.2 Supply: litterfall, competition, equilibrium

Stepped once per second:

```js
stock += (fallOf(i) - COMP[i] * (stock / capOf(i))) * 1.0;
stock  = clamp(stock, 0, capOf(i));
```

`COMP[i]` is everybody else — bacteria, springtails, mites, competing fungi — eating the same floor.
It is proportional to stock, which gives a stable equilibrium `s* = cap · I / C` and a time constant
`τ = cap / C`. Those τ values are chosen so that **prices move over a season, not over a second**:

| type | `CAP_PER_PATCH` | `FALL_PER_PATCH` (g/s) | `COMP` (g/s at full stock) | τ = cap/C |
|---|---|---|---|---|
| leaf | 90,000 | 240 | 380 | 237 s |
| needle | 60,000 | 150 | 250 | 240 s |
| twig | 34,000 | 78 | 140 | 243 s |
| bark | 22,000 | 44 | 92 | 239 s |
| log | 120,000 | 60 | 96 | 1,250 s |
| stump | 70,000 | 15 | 24 | 2,917 s |
| carrion | 1,800 | 1.1 | 2.4 | 750 s |

Wood pools have τ measured in tens of minutes — they are effectively a **finite reserve** that the
player draws down across the whole act. Leaf and needle are a **flow** that refills every autumn.
That difference is never stated and is entirely legible from the price charts.

Seasonal litterfall multipliers `SEASON_FALL[i][spring, summer, autumn, winter]`:

| type | Spring | Summer | Autumn | Winter | why |
|---|---|---|---|---|---|
| leaf | 0.40 | 0.60 | **6.00** | 0.30 | abscission |
| needle | 1.00 | 1.20 | 1.60 | 0.90 | conifers shed year-round |
| twig | 0.80 | 0.70 | 1.50 | **2.40** | ice-break |
| bark | 1.10 | **1.40** | 1.00 | 0.80 | summer sloughing |
| log | 0.70 | 0.60 | 1.20 | **1.90** | winter windthrow |
| stump | 1.00 | 1.00 | 1.00 | 1.00 | geology, not weather |
| carrion | 0.60 | 0.80 | 1.00 | **2.20** | winter kill |

**Autumn dumps six times the leaf litter.** Leaf stock saturates its cap and the price sits on the
floor. **Winter inflow is 0.30×**, stock decays with τ 237 s toward 19% of cap, and the fair price
rises ~1.8×. The single most valuable thing a player can learn in Act I is written entirely in that
paragraph, and the game never says it.

### 5A.3 Price: mean-reverting with momentum

Stepped once per second, per type:

```js
const MOM_DECAY  = 0.955;   // autocorrelation → half-life ≈ 15 s, trend runs ≈ 40–90 s
const MEAN_REV   = 0.030;
const SIGMA      = 0.006;
const MOM_CLAMP  = 0.075;

const scarcity = 1 - stock / capOf(i);                       // 0 … 1
const fair     = base * (1 + 1.10 * Math.pow(scarcity, 1.6));
const gap      = (fair - price) / fair;

mom   = MOM_DECAY * mom + MEAN_REV * gap + SIGMA * gauss();  // gauss(): Box–Muller, unit normal
mom   = clamp(mom, -MOM_CLAMP, MOM_CLAMP);
price = clamp(price * (1 + mom), 0.30 * base, 5.00 * base);
hist.push(price);
```

Stationary σ of `mom` ≈ `SIGMA / sqrt(1 − MOM_DECAY²)` ≈ **0.0202**, so a typical second moves the
price ~2%, and because `mom` is autocorrelated at 0.955 those 2% moves **compound in the same
direction for 40–90 seconds.** That is the entire difference between this and UP's `6·sin(n)`:

> **UP's wire price has no state, so "buy low" is a reflex. HYPHAE's litter price has momentum and a
> scarcity-driven fair value, so "buy low" is a forecast.**

A player with *Mycelial Ledger* (project 7) sees the 120-second sparkline **with the fair-value line
drawn through it**, and can read mean-reversion directly: price above fair and momentum turning →
sell; price below fair with 90 seconds of autumn left → load up. This is a real, learnable,
non-random skill that survives to the end of the act.

### 5A.4 Buying, selling, and being the inflation

```js
const INFL      = 0.060;    // permanent base drift per cap-unit purchased
const IMPACT    = 0.350;    // immediate momentum kick per 5%-of-cap traded
const SPREAD    = 0.720;    // you sell back at 72% of mid
const COOL_S    = 45;       // seconds of no trading before base decays
const COOL_RATE = 0.0003;   // per second, toward 0.85 * BASE_PRICE

function buy(i, grams){
  grams = Math.min(grams, mkt[i].stock, sugar / mkt[i].price);
  if (grams < 1) return;
  sugar        -= grams * mkt[i].price;
  sub[i]       += grams;
  mkt[i].stock -= grams;
  mkt[i].base  *= (1 + INFL * osmoticPriming * grams / capOf(i));   // ← you are the inflation
  mkt[i].mom   += IMPACT * (grams / (0.05 * capOf(i)));
  mkt[i].coolT  = 0;
  stats.purchases++;
}

function sell(i, grams){                       // dumping a bad autumn buy
  grams = Math.min(grams, sub[i]);
  sugar        += grams * mkt[i].price * SPREAD;
  sub[i]       -= grams;
  mkt[i].stock += grams;
  mkt[i].base  *= (1 - 0.020 * grams / capOf(i));
  mkt[i].mom   -= IMPACT * (grams / (0.05 * capOf(i)));
}

// idle decay, 1 Hz:
if (++mkt[i].coolT > COOL_S && mkt[i].base > 0.85 * BASE_PRICE[i])
    mkt[i].base -= mkt[i].base * COOL_RATE;
```

`osmoticPriming` is 1.0 until project 8 buys it down to 0.5.

Over a full Act I a player buys on the order of **8–14 cap-units of leaf**, so `base` drifts
**+50% to +130%** and never fully returns (the cooldown floor is 0.85× and it only runs while you are
not trading). The player's own appetite is the primary long-run driver of their input costs.
Exactly UP's `wireBasePrice += 0.05`, with the loop closed properly.

The 28% bid-ask spread means **substrate is not a savings account.** You cannot park sugar in wood
and get it back. Every purchase is a commitment to digest.

### 5A.5 The buy interface (portrait, one thumb)

```
┌───────────────────────────────┐
│ LITTER MARKET      sugar 4.2k │
├───────────────────────────────┤
│ leaf litter    0.081 ▼  ▁▂▃▂▁▁│   ← price, direction arrow, 120 s sparkline
│ fair 0.104 · 4.1 t on floor   │   ← fair line only with Mycelial Ledger
│ [ 1k ][ 10k ][ 25% ][ MAX ]   │   ← four fixed-size buttons, 44 px, thumb row
├───────────────────────────────┤
│ needle mat     0.139 ▲  ▁▃▅▆▇▇│
│ ...                           │
```

Four fixed buy sizes, no slider, no numeric entry. `MAX` is `min(stock, sugar/price)`.
A long-press on any row opens SELL. **The entire market is operable with the right thumb and
requires zero precision.**

### 5A.6 The allocation dilemma — Act I's dial with no correct setting

Every gram of sugar goes to exactly one of two places:

```
   SUGAR ──┬──► substrate  (more throughput → more biomass and more sugar)
           └──► contracts  (minerals → tips beyond 24, structures, patches)
```

There is no correct split, it changes with the season, and the player touches it constantly. This is
the recurring reversible decision that teardown §9 principle 10 demands, and it is strictly better
than UP's price seesaw because both branches are *investments* rather than one being a dial and one
being a wall.

The HUD carries exactly one derived number for this, always visible:

```
   NET SUGAR   +14.6 g/s        (income − substrate spend − contract commitments)
```

When it goes negative it turns amber and gains a countdown: `−3.1 g/s · 92 s to default`.
That single line is Act I's unsold-inventory sawtooth.

---

# 6. MYCORRHIZAL CONTRACTS

This is the system that has to be everything UP's stock market pretended to be (teardown §8.4). The
test it must pass: **a knowledgeable player and a naive player must get materially different
outcomes from identical starting conditions, through decisions rather than variance.**

It passes that test because the player is running a **liquidity book**. They sell forward at a fixed
rate a commodity whose production is seasonal, to counterparties whose willingness to pay is
seasonal *in the opposite phase*, with collateral posted against delivery. There is no dice roll
anywhere in the pricing. Every bad outcome is traceable to a term the player chose.

### 6.1 The contract object

```js
Contract = {
  id, treeId,
  sugarRate,        // g/s YOU deliver, every tick, unconditionally
  mineralRate,      // computed at signing; FIXED for the term unless renegotiated
  termSeasons,      // 1 … 8
  startT, endT,     // endT = startT + termSeasons * SEASON_S
  collateral,       // biomass staked at signing, held in escrow, returned on completion
  exclusive,        // bool
  delivered, shortfall,
  state             // 'active' | 'complete' | 'defaulted' | 'exited' | 'suspended'
}
```

Delivery, every sim tick:

```js
for (const c of contracts.filter(c => c.state === 'active')){
  const want = c.sugarRate * DT;
  const pay  = Math.min(want, sugar);
  sugar   -= pay;
  mineral += c.mineralRate * DT * (pay / want);      // partial pay → partial mineral
  c.delivered  += pay;
  c.shortfall  += (want - pay);
  if (c.shortfall > 0.05 * c.sugarRate * SEASON_S) defaultContract(c);
  if (t >= c.endT) completeContract(c);
}
```

**Delivery is unconditional and continuous.** There is no "pay later", no grace button, no bailout.
The shortfall budget is 5% of one season's delivery — roughly **18 seconds of total non-payment** —
and the UI counts it down in seconds the moment net sugar goes negative.

### 6.2 The six Act I species

Each tree is a persistent object with `species, age, health (0–1), rep (0–100), ramets, lastReneg`.
Trees appear on `netRep` thresholds and on patch claims; Act I supports **3–7 simultaneous trees**.

| Species | `SP_BASE` (min/sugar) | `SP_INTAKE` (g/s) | `minRepMult` (→ rep) | patience | character |
|---|---|---|---|---|---|
| **Birch** *Betula* | 0.008 | 4 | 0.55 (rep 0) | low | Pioneer. Signs with anyone, pays badly, leaves early, dies young. Your tutorial counterparty and your first betrayal. |
| **Aspen** *Populus* | 0.011 | 9 × ramets (1–6) | 0.60 (rep 7) | medium | **Clonal.** A contract with one ramet is a contract with the whole stand: volume scales with `ramets`, and a default hits every ramet's rep simultaneously. High reward, correlated risk. |
| **Douglas Fir** *Pseudotsuga* | 0.012 | 14 | 0.70 (rep 20) | high | The anchor. Small deficit **all year** (never 0, never spiking). Boring, high volume, long terms, forgiving. The correct core holding. |
| **Hemlock** *Tsuga* | 0.010 | 3 | 0.78 (rep 31) | very high | Deep shade, tiny appetite, immortal patience. Accepts 8-season terms at rep 31. Pays in phosphorus: its minerals count **×1.6 toward structures** (not toward tips). |
| **Oak** *Quercus* | 0.017 | 40 | 0.925 (rep 50) | very high | The prize. Refuses you for the first 40 minutes. Huge volume, best rate, and **mast years** (§7.3) that are the single largest payday in Act I — if you can supply 100 g/s for two seasons. |
| **Dying Elm** *Ulmus* | 0.036 | 25 | 0.55 (rep 0) | none | Dutch elm disease. Deficit 0.75–0.97 permanently, 3× the going rate, and **dies in 6 seasons**, voiding the contract and returning collateral. Anyone can sign it. It is a bet on your own throughput ramp, and it is also the act's only moral note. |

`healthFrac` multiplies both `SP_INTAKE` and photosynthesis; a beetle-struck fir (§7.3) becomes a
temporary Elm.

### 6.3 Carbon deficit `d` — why the seasons are the market

```js
function carbonDeficit(tree){
  const s = season, sp = tree.species;
  let photo = SP_PHOTO[sp][s] * tree.health * canopyLight(tree)
            * (0.55 + 0.45 * Math.min(1, moisture / 0.90));      // drought hits photosynthesis
  let need  = SP_NEED[sp][s];

  if (s === SPRING && SP_DECIDUOUS[sp]){                          // bud break
    const p = seasonPhase;                                        // 0 … 1
    photo *= smoothstep(0.05, 0.40, p);
    need  *= 1 + 1.9 * Math.exp(-Math.pow((p - SP_BUDPHASE[sp]) / 0.09, 2));
  }
  if (s === AUTUMN && tree.mastYear) need *= 2.5;
  return clamp(1 - photo / need, 0, 1);
}
```

| species | `SP_PHOTO` (Sp,Su,Au,Wi) | `SP_NEED` (Sp,Su,Au,Wi) | `SP_BUDPHASE` | resulting `d` (Sp,Su,Au,Wi) |
|---|---|---|---|---|
| Birch | 1.25, 1.40, 0.75, 0.05 | 1.00, 0.95, 0.85, 0.42 | 0.08 | 0.00*, 0.00, 0.12, **0.88** |
| Aspen | 1.20, 1.45, 0.80, 0.04 | 1.05, 1.00, 0.90, 0.45 | 0.12 | 0.00*, 0.00, 0.11, **0.91** |
| Fir | 0.92, 1.06, 0.88, 0.30 | 1.00, 1.12, 0.92, 0.55 | — | 0.08, 0.15, 0.04, **0.46** |
| Hemlock | 0.55, 0.62, 0.52, 0.22 | 0.70, 0.72, 0.66, 0.40 | — | 0.21, 0.14, 0.21, **0.45** |
| Oak | 1.10, 1.55, 1.05, 0.04 | 1.05, 1.15, 1.30, 0.60 | 0.30 | 0.00*, 0.00, **0.19**, **0.93** |
| Elm | 0.30, 0.28, 0.20, 0.02 | 1.20, 1.25, 1.15, 0.70 | 0.10 | 0.75, 0.78, 0.83, **0.97** |

\* the spring `0.00` is the *settled* value. For **~32 seconds around bud-break** (`p ≈ SP_BUDPHASE`)
`need` is up to 2.9× and `d` spikes to **0.85–0.92** before collapsing. Deciduous trees leaf out at
different phases (birch 0.08, aspen 0.12, oak 0.30) so **spring is three separate 30-second
windows, staggered**, and a player who knows the calendar can chain-renegotiate across all three.

That is the single highest-skill play in Act I and it is discoverable entirely from watching a
deficit bar move.

### 6.4 The offer formula

When the player opens NEGOTIATE with a tree, the tree computes:

```js
function offer(tree, volume, termSeasons, collateral, exclusive){
  const d = carbonDeficit(tree);
  const termBonus  = 1 + 0.11 * Math.log(1 + termSeasons);
  const collBonus  = 1 + 0.30 * (1 - Math.exp(-collateral / (volume * 900)));
  const repMult    = 0.55 + 0.0075 * tree.rep;                   // 0.55 … 1.30
  const needMult   = 1 + 1.6 * Math.pow(d, 1.5);                 // 1.00 … 2.60
  const exclMult   = exclusive ? 1.25 : 1.00;
  return volume * SP_BASE[tree.species]
       * termBonus * collBonus * repMult * needMult * exclMult
       * hartigNet;                                              // 1.00, →1.18 with project 15
}

function accepts(tree, volume, termSeasons, exclusive){
  const d = carbonDeficit(tree);
  const maxIntake = SP_INTAKE[tree.species] * tree.ramets * tree.health
                  * (1 + 1.6 * Math.pow(d, 1.5))                 // hungrier ⇒ takes more
                  * (0.60 + 0.008 * tree.rep)
                  * exudatePump;                                 // 1.00, →1.35 with project 19
  const maxTerm   = clamp(Math.floor(1 + tree.rep / 12), 1, 8);
  return volume <= maxIntake
      && (0.55 + 0.0075 * tree.rep) >= SP_MINREP[tree.species]
      && termSeasons <= maxTerm
      && !(exclusive && tree.contracts.length > 0);
}
```

**Refusal is a counter-offer, never a wall.** If `accepts()` fails, the tree returns the largest
legal `(volume, term)` and the UI shows it as a ghost position on the sliders with one line of text:
`the fir will take 9.1 g/s for three seasons, and no more`.

`termBonus`: T=1 → 1.076, T=2 → 1.121, T=4 → 1.177, T=6 → 1.214, T=8 → 1.242.
`collBonus`: C = 0.9k·V → 1.19, C = 2.7k·V → 1.285, saturating at 1.30.

**Worked example — the player's first contract (unlock 6, ~7:00).**
Birch, winter, `d = 0.88`, rep 25, volume 1.4 g/s (the slider default = 0.40 × sugar income),
term 2, no collateral, non-exclusive:

```
1.4 × 0.008 × 1.121 × 1.00 × 0.7375 × 2.323 × 1.00 = 0.02150 mineral/s
```
= **15.5 minerals over the 2-season term for 1,008 g of sugar.** Enough for tips 24 → 43.
Effective rate **0.01536 mineral per sugar** — and because it was signed in the best week of the
year, that number will look outstanding for six minutes and criminal for the following eighteen.

**Worked example — the same player's fourth contract (~55:00).**
Oak, winter, `d = 0.93`, rep 62, volume 38 g/s, term 5, collateral 40,000 g, exclusive:

```
termBonus 1.197 · collBonus 1 + 0.30(1 − e^(−40000/34200)) = 1.2065
repMult 1.015 · needMult 2.435 · exclMult 1.25 · hartig 1.18
38 × 0.017 × 1.197 × 1.2065 × 1.015 × 2.435 × 1.25 × 1.18 = 3.386 mineral/s
```
= **6,095 minerals over 1,800 s**, at an effective **0.0891 mineral per sugar** — 5.8× the first
contract's rate. That entire multiple came from decisions: reputation built, term extended,
collateral posted, exclusivity accepted, season timed, and a project bought.

**No variance was involved.** That is the difference between this and a stock market.

### 6.5 Reputation, and the fact that trees talk

```js
// per tree, 0…100. Global netRep, 0…100.
function completeContract(c){
  const tr = tree(c.treeId);
  tr.rep  = Math.min(100, tr.rep + (6 + 2 * c.termSeasons) * cmnMult);
  netRep  = Math.min(100, netRep + 1.0 * cmnMult);
  biomass += c.collateral;                       // escrow returned
  if (tr.species === 'aspen') for (const r of tr.stand) r.rep = tr.rep;
}

function defaultContract(c){
  const tr = tree(c.treeId);
  tr.rep  = Math.max(0, tr.rep - 22 * arbitration);     // arbitration: 1.00 → 0.45 (project 22)
  netRep  = Math.max(0, netRep - 4.0 * arbitration);
  tr.refuseUntil = t + 2 * SEASON_S;
  // collateral is FORFEIT — it goes to the tree, and its health rises
  tr.health = Math.min(1, tr.health + c.collateral / 400000);
  c.state = 'defaulted';
  if (tr.species === 'aspen') for (const r of tr.stand) { r.rep = tr.rep; r.refuseUntil = tr.refuseUntil; }
  consoleMsg('the ' + tr.species + ' closes its root tips. you feel it happen.');
}

function exitContract(c){                          // voluntary, always available
  const remaining = c.sugarRate * (c.endT - t);
  if (sugar < 0.5 * remaining) return false;       // you must be able to pay the fee
  sugar -= 0.5 * remaining;
  tree(c.treeId).rep -= 6; netRep -= 1.0;
  biomass += c.collateral;
  c.state = 'exited'; return true;
}

// a new tree's opening reputation:
newTreeRep = clamp(15 + 0.45 * netRep, 5, 70);
```

Three consequences the player will feel in this order:

1. **A default is not local.** `netRep − 4` means every future tree opens colder. Four defaults and
   Oak (rep 50 required) is out of reach for the rest of the act.
2. **Collateral makes the tree stronger.** A forfeited stake raises `tr.health`, which raises its
   `SP_INTAKE` and its photosynthesis — i.e. **the tree you failed now needs you less.** This is the
   cruellest number in Act I and it is one line.
3. **Aspen is a correlated position.** One default across a six-ramet stand costs six relationships.
   The clone is a lesson in concentration risk delivered without a single word of finance.

*Common Mycorrhizal Network* (project 13) sets `cmnMult = 1.5` — the wood-wide-web as a reputation
amplifier in **both** directions is tempting but wrong; it multiplies gains only. Losses stay
brutal, because the asymmetry is what makes players cautious.

### 6.6 Renegotiation and Solicitation

**You renegotiate.** Any active contract, at any time:
```js
canRenegotiate(c) = (t - c.lastReneg > SEASON_S) && tree(c.treeId).refuseUntil < t;
// on confirm: rep −1, netRep 0, terms recomputed at CURRENT d, rep, season.
// collateral and elapsed delivery carry over; termSeasons resets from now.
```
Renegotiating a summer contract into winter conditions can **triple** the mineral rate. Renegotiating
in the wrong direction is entirely possible and the confirm screen shows the delta in red.
Cost is one reputation point, so it is cheap enough to do every season and expensive enough that
spamming it across seven trees costs real access.

**They solicit you.** Once per season, per tree, with probability `0.35` when
`d_now − d_atSigning > 0.25`, a tree opens an unprompted offer:

```
  THE OAK ASKS
  It will take 74 g/s (from 38) and pay 0.0913 (from 0.0891) per gram,
  for four more seasons.                         [ ACCEPT ]  [ DECLINE ]
```

Accepting nearly doubles the commitment for a 2.5% rate improvement. **Solicitations are almost
always bad deals dressed as compliments**, and the good ones are during mast years and beetle kills.
Declining costs nothing. Learning to say no is a skill and it is free to acquire.

### 6.7 What minerals are for (and why the gate is at 24)

| sink | cost | notes |
|---|---|---|
| Hyphal tips ≥ 24 | `ceil(0.06·(n−23)^1.35)` | 1 at tip 24, 5 at 50, 13 at 75, 23 at 100 |
| Patch claims | 90 / 260 / 700 / 1,800 / 4,400 | five claimable patches in Act I |
| Structural projects | 20 → 4,000 | see §10 |
| *A Gift of Phosphorus* | 200 × 2^k | re-armable rep purchase (UP's Token of Goodwill) |

Cumulative mineral demand across Act I: **≈ 11,500**. Achievable income with competent contracting:
**14,000–22,000**. With bad contracting: **6,000–9,000**, which stalls the act at the *Action
Potential* wall and forces the player to actually learn the seasons. That stall is a feature and it
is soft — Oxalate Weathering (project 24, +0.35 mineral/s passive, forever) guarantees the act
completes eventually no matter how badly the player trades. **There is no dead end** (teardown §1
beat 4, the Beg For More Wire principle).

### 6.8 The negotiation screen (portrait)

```
┌───────────────────────────────┐
│ ← DOUGLAS FIR · 140 y         │
│ carbon deficit ████░░░░░░ 0.46│
│ reputation     ██████░░░░ 58  │
├───────────────────────────────┤
│ VOLUME            18.0 g/s    │
│ ▬▬▬▬▬▬▬▬▬▬●───────┊──── 24.6  │  ┊ = your income · ● = slider · red past 0.75×
│ coverage ███████░░░  74%      │
├───────────────────────────────┤
│ TERM               5 seasons  │
│ ▬▬▬▬▬▬▬▬●─────  max 5         │
├───────────────────────────────┤
│ COLLATERAL          16,000 g  │
│ ▬▬▬▬▬●────────  +18.6% rate   │
├───────────────────────────────┤
│ [  ] exclusive       +25%     │
├───────────────────────────────┤
│ YOU PAY      18.0 g sugar/s   │
│ YOU GET      0.3149 mineral/s │
│ OVER TERM    567 mineral      │
│ ── if winter comes  ↑ 0.482   │   ← forecast row, only with project 23
│                               │
│        ┌─────────────┐        │
│        │    SIGN     │        │
│        └─────────────┘        │
└───────────────────────────────┘
```

Three sliders, one checkbox, one button, all in the bottom 60% of the screen. Every number updates
live as the thumb moves. **The coverage bar is the whole game** — it is the ratio of what you are
promising to what you currently earn, and the player will learn to fear the number 100%.

---

# 7. SEASONS, WEATHER AND SHOCKS

### 7.1 The season loop

```js
function stepSeason(){
  seasonPhase += DT / SEASON_S;
  if (seasonPhase >= 1){
    seasonPhase -= 1;
    season = (season + 1) % 4;
    if (season === 0) year++;
    rollEvents();                       // §7.2
    consoleMsg(SEASON_LINE[season]);    // one line, always the same four, they become a heartbeat
  }
  stepMoisture();
}
```

`SEASON_LINE` is fixed and never varies. Repetition is the point — by year three these four
sentences are load-bearing emotional infrastructure:

- SPRING — `> the ground softens. everything above you begins to want.`
- SUMMER — `> dry. the canopy closes. you are alone down here.`
- AUTUMN — `> it falls. all of it, all at once, for six minutes.`
- WINTER — `> cold. slow. and every root within reach is starving.`

### 7.2 The event engine

Events roll **once per season boundary**, independently, in the order listed. Each prints exactly
one console line and, if it changes a headline number, flashes that number's row once. **There are
no modals and nothing pauses.** Multiple events can be active simultaneously; their modifiers
multiply.

```js
function rollEvents(){
  for (const e of EVENTS)
    if (e.seasons.includes(season) && Math.random() < e.p * eventRateMod) e.fire();
  for (const a of activeEvents) if (--a.seasonsLeft <= 0) a.end();
}
```
`eventRateMod = 1.0`; a settings toggle `calm mode` sets it to 0.55 and is offered once, at the
first drought, with the line `you may ask the forest to be gentler. it will not judge you.`

### 7.3 Tree events

| event | p / season | window | effect |
|---|---|---|---|
| **Mast year** | 0.12 | autumn, Oak only, min 3 years apart | `tree.mastYear = true` for 2 seasons. `SP_NEED` autumn ×2.5 ⇒ `d` 0.19 → 0.68, `maxIntake` ×2.4 ⇒ up to 96 g/s. Console: `> the oak is making ten thousand acorns and it cannot pay for them.` |
| **Bark beetle** | 0.06 | summer, conifers | target's `health` −0.40 immediately, then −0.10 per season. Dies at health ≤ 0.05 (≈ 6 seasons). While struck: `SP_PHOTO` ×`health`, so `d` climbs toward 0.9 — it becomes an Elm. Its contracts pay superbly and end when it does (collateral returned, no rep penalty). |
| **Windthrow kill** | see §7.4 | any | 18% chance a windthrow event kills a random tree outright. All its contracts void, collateral returned, `netRep` unchanged. Its trunk enters the `log` pool. **You then eat your counterparty**, and the game does not comment on this. |
| **New neighbour** | on `netRep` ≥ {8, 22, 38, 55, 72} and on each patch claim | — | a new tree appears with `rep = clamp(15 + 0.45·netRep, 5, 70)`. Species drawn by patch type: home/2 birch-aspen, 3–4 fir-hemlock, 5–6 oak. |

### 7.4 Supply events

| event | p / season | effect |
|---|---|---|
| **Windthrow** | 0.09 any, **0.18 autumn**, 0.14 winter | `log.stock += U(8000, 42000) × patches`, `bark.stock += U(2000, 9000) × patches`. `log.mom −= 0.55` and `log.base ×= 0.86` — a genuine **price crash** you can buy into. Lasts 2 seasons of depressed prices. 18% sub-roll kills a tree (§7.3). |
| **Carrion fall** | 0.10, ×2.2 in winter | `carrion.stock += U(400, 1400)`. Console: `> something large stopped moving, forty metres east.` This is the only fast mineral source in the game and it lasts minutes. |
| **Earthworm invasion** | 0.07, spring/summer | invasive *Lumbricus* strips the duff: `leaf.stock ×= 0.30`, `COMP.leaf ×= 2.2` for 3 seasons. The cheap substrate simply stops existing and the player must move up the lignin ladder early. The single most disruptive supply event. |
| **Fire scar (distant)** | 0.03 | ash deposition: all `mineralPerG` ×3 for 1 season, and every tree's `d` −0.20 (they got the ash too, and need you less). A mineral windfall that simultaneously craters your contract rates. |

### 7.5 Weather events

| event | p / season | effect on `weatherMoistMod` / other |
|---|---|---|
| **Drought** | 0.10 summer, 0.04 spring | `weatherMoistMod = 0.55` for 1–2 seasons. Summer moisture → 0.385 ⇒ `moistureMult` 0.152. Photosynthesis term `(0.55+0.45·min(1,m/0.9))` → 0.743 so every tree's `d` rises. **Production collapses and contract rates rise together** — the sharpest squeeze in the act. |
| **Hard frost** | 0.14 winter | `weatherMoistMod = 0.60` (water is present but frozen) and `tempMult ×= 0.70` for 1 season. Birch and Aspen `refuseUntil = t + SEASON_S`. |
| **Wet spring** | 0.18 spring | `weatherMoistMod = 1.22` ⇒ moisture 1.40, `moistureMult` 0.641 — **too wet is also bad**, and this is the only place the player learns the response curve is unimodal. `leaf/needle` base prices ×0.82 for 2 seasons. |
| **Late frost** | 0.09 spring | fires at `seasonPhase ∈ [0.15, 0.30]`, i.e. immediately after bud-break: every deciduous tree re-flushes. `SP_NEED` ×1.8 for 1 season. **The best contract window in the game**, and it only exists 9% of springs. |

### 7.6 What the player is supposed to end up doing

By year three a competent player runs this loop without being told:

```
AUTUMN  buy leaf and needle at the annual price floor; fill every substrate pool;
        renegotiate nothing (deficits are near zero, rates are terrible)
WINTER  throughput collapses to 0.24× — but you are eating a stockpile, not a flow —
        and every deciduous tree is at d ≈ 0.9. SIGN EVERYTHING. Long terms. Post collateral.
SPRING  chain three 30-second bud-break windows (birch 0.08, aspen 0.12, oak 0.30) by
        renegotiating one contract per window. Watch for late frost.
SUMMER  deficits are ~0. Do not contract. Buy bark and log while their inflow peaks,
        service the winter book, and pray it does not go dry.
```

That is a genuine annual strategy, it is derivable from the tables, it is never stated, and it is
worth roughly a **3× difference in Act I completion time**. It is exactly the thing UP's stock
market failed to be.

### 7.7 The failsafe — `WINDFALL`

The direct analogue of *Beg For More Wire*, with the same self-rearming trick.

```js
project_windfall = {
  title: 'Windfall',
  priceTag: '(1 reputation)',
  description: 'A branch comes down. You did not earn it. (+2,000 g leaf litter)',
  trigger: () => totalSubstrate() < 50 && sugar < 20 && biomass < 200 && !hasActiveIncome(),
  cost:    () => netRep >= 1,
  uses: 1,
  effect(){ sub.leaf += 2000; netRep -= 1; this.uses += 1; }   // ← infinitely re-armed
};
```
If `netRep` is 0 the trigger instead grants it free once per 5 minutes with the line
`> the forest is not generous. it is merely large.` **The game cannot dead-end and does not need a
restart button.**

---

# 8. OFFLINE, SAVE AND THE PROMISE THAT WALKING AWAY IS SAFE

UP had literally no offline progression (teardown §8.2) and it is the reason players stalled out.
This is our most important non-negotiable.

### 8.1 The rule

```js
const OFFLINE_CAP_S = 12 * 3600;

function reconcile(now){
  let dtSec = clamp((now - save.wallClock)/1000, 0, OFFLINE_CAP_S);
  // efficiency bands — generous, and legible on the return screen
  //   0–2 h   : 100%
  //   2–8 h   :  65%
  //   8–12 h  :  40%
  const bands = [[7200,1.00],[21600,0.65],[14400,0.40]];
  let simmed = 0;
  for (const [span, eff] of bands){
    const use = Math.min(span, dtSec - simmed); if (use <= 0) break;
    fastForward(use, eff); simmed += use;
  }
}
```

`fastForward` runs the **real simulation** at a 5-second macro-step: seasons advance, moisture
relaxes, litterfall and competition run, prices walk, contracts deliver, events roll. It is the same
functions with a larger `DT`, not a separate approximation. Cost: ~8,600 macro-steps for 12 hours,
which is ~40 ms on a mid-range phone.

**Two things are deliberately clamped during fast-forward:**
- `throughputPerSec()` is additionally multiplied by the band efficiency.
- The player cannot buy substrate, so `sub` pools drain and production degrades naturally. This is
  the honest reason offline is worth less than active play: **you starve.**

### 8.2 Contracts while you are away

This is the hard part, and it is where a naive design would punish absence (teardown §8.6).

- **Before** *Dormancy Clause* (project 4, 1,800 g + 20 min, triggered by your first signing):
  contracts run and **can default**. The first offline default is survivable by construction
  (Birch, low volume, low collateral) and it teaches the lesson at the smallest possible price.
- **After** *Dormancy Clause*: on `pagehide`, every active contract enters `state:'suspended'`.
  Suspended contracts deliver nothing, receive nothing, and their `endT` is pushed forward by the
  offline duration. **Zero minerals accrue while suspended.** They resume on return.

So the choice is explicit and priced: **run the book while away and earn minerals at the risk of
default, or suspend it and earn none.** A toggle per contract, defaulting to suspend. That is an
opportunity cost, never a penalty — which is precisely the distinction UP's boredom/disorganisation
systems got wrong.

### 8.3 The return screen

One card, dismissible with any tap, never a modal that blocks:

```
   YOU WERE AWAY 6 h 12 m
   + 41.2 t biomass      (65% dormant efficiency)
   + 8.1 t sugar
   + 302 mineral
   substrate ran dry after 2 h 40 m
   ── autumn passed. leaf litter is on the floor at 0.071.
   ── the hemlock's contract completed. +6 reputation.
```

The last two lines matter more than the first three: they tell the returning player **what the
market did** and therefore what to do in the next thirty seconds. An offline summary that only
reports gains trains players to dismiss it.

### 8.4 Why active play is never pointless

Offline gives you **production**. It cannot give you:

| active-only value | magnitude |
|---|---|
| Buying substrate below fair value on a readable trend | ±35% on your entire input cost |
| Signing/renegotiating inside a 32-second bud-break window | up to 2.9× on a contract's rate |
| Responding to a windthrow crash before it mean-reverts (~2 seasons) | 14% of a whole act's log supply at 0.86× base |
| Declining a bad solicitation | avoids a doubled commitment |
| Choosing consumption order as the bottleneck flips | 20–40% throughput |

Offline is a floor. Skill is the multiplier. **Neither is a chore.**

### 8.5 Save

```js
save = { v: 1, seed, wallClock, state };            // state = the whole sim object, JSON
localStorage.setItem('hyphae.slot' + n, LZString-free JSON);   // 3 slots, ~14 KB each
```
Three slots. **Export/Import as a base64 text blob** via a copy-to-clipboard field, so a save can be
mailed to yourself. Autosave every 10 s and on `visibilitychange`, `pagehide`, and every act
transition. Version field with a migration switch. This is four hours of work and it is the
difference between a game people finish and a game people lose (teardown §8.3).

---

# 9. PATCHES — territory, seeded

Territory is Act II's system. Act I gets a **deliberately small** version of it: six patches, five
of them claimable, so that the player arrives at the Act II territory layer already fluent in the
verb and can be handed a hundred of them without a tutorial.

```js
Patch = { id, name, trees: [], mkt: {…},   // each patch scales market cap AND litterfall
          claimCost: {biomass, mineral}, claimed, dominantFall };
```

| # | name | biomass | mineral | gate | gives |
|---|---|---|---|---|---|
| 1 | The Log's Shadow | — | — | start | leaf-dominant; 1 birch |
| 2 | The Second Shadow | 12,000 | **90** | `biomass ≥ 12,000` | leaf/needle; 1 aspen stand (3 ramets) |
| 3 | The Windthrow Gap | 30,000 | **260** | `netRep ≥ 22` | log/bark-dominant; 1 fir |
| 4 | Under the Hemlocks | 70,000 | **700** | `patches ≥ 3` | needle; deep shade; 1 hemlock, 1 fir |
| 5 | The Old Coppice | 160,000 | **1,800** | `netRep ≥ 45` | stump-dominant; 1 dying elm |
| 6 | The Oak Rise | 400,000 | **4,400** | `netRep ≥ 55` | mixed; **1 oak** — the prize is behind the fifth claim |

Each claim multiplies **every** market `cap` and `fall` by the new patch count (§5A.2) — so claiming
is the only real answer to substrate scarcity — and adds `6.0 m` to `hyphae`. Claiming takes real
time: a hyphal front advances over `45 s × patchIndex`, during which a thin progress line crosses
the canvas and `throughputPerSec()` is multiplied by 0.90. **Expansion costs you production while it
happens.** One line, and it makes the timing of a claim a decision.

---

# 10. THE ADAPTATIONS TABLE — the first 25

Architecture copied verbatim from UP (teardown §4): each entry is `{id, title, priceTag,
description, trigger(), cost(), uses:1, effect()}`; `manageProjects()` runs every sim tick;
newly-triggered entries are appended and `blink()`ed; every active entry's `disabled` state is
recomputed from `cost()`; entries are **removed from the DOM on purchase**. No completed tab, no
history, no receipts.

Writing rules, enforced: **title is a noun phrase; description ≤ 12 words; the mechanical delta is
in parentheses at the end; `priceTag` is a hand-written string.**

| # | Title | Cost | Trigger | Effect (exact) | Description (shipping text) |
|---|---|---|---|---|---|
| 1 | **Rhizomorph Cords** | 900 g | `tips ≥ 12` | `structureMult ×= 1.18` | Bundled threads move further, faster. (+18% throughput) |
| 2 | **Hydrophobic Sheath** | 1,400 g | `year>0 \|\| season≠2` | `moistureMult' = 1 − 0.50(1−moistureMult)` | Water held against the frost. (Halves moisture penalty) |
| 3 | **Dormancy Clause** | 1,800 g · 20 min | first contract signed | contracts may suspend while offline | Sleep does not break a promise. (No offline defaults) |
| 4 | **Cellulase Titre** | 2,600 g | `biomass ≥ 2,000` | `enzymeK{leaf,needle,twig} ×= 1.25` | More of the enzyme you already had. (+25% on soft litter) |
| 5 | **Foraging Front** | 3,400 g | `tips ≥ 24` | tip cost base `1.10 → 1.085` | Growth at the edge, not the middle. (Cheaper tips) |
| 6 | **Mycelial Ledger** | 3,800 g | `stats.purchases ≥ 10` | market rows gain sparkline, fair-value line, momentum arrow | You begin to remember prices. (Market history) |
| 7 | **Hemicellulase** | 5,200 g · 30 min | project 4 bought | unlock `bark`; `enzymeK.twig ×= 1.30` | The gluey parts come apart. (Unlocks bark slough) |
| 8 | **Osmotic Priming** | 6,500 g · 45 min | 5,000 g sugar spent on market | `osmoticPriming = 0.5` | Ask quietly and the floor gives more. (Half market impact) |
| 9 | **Sclerotia** | 8,000 g | `stats.rotted ≥ 500` | `sugarCap += 6,000 + 40·tips` | Hard little bodies full of winter. (+Sugar storage) |
| 10 | **Antifreeze Glycoproteins** | 9,500 g | first winter ended | winter `tempMult 0.55 → 0.85` | Ice forms around you, not in you. (Winter +55%) |
| 11 | **Trade Memory** | 9,000 g · 40 min | 2 contracts completed | tree panels show numeric `d`, photo, need, 1-year history | You learn what hunger looks like. (Tree data) |
| 12 | **Peroxidase (Mn)** | 13,000 g · 70 min | project 7 bought | unlock `log`; wood `etaB ×= 1.15` | Lignin is only a rumour of a wall. (Unlocks fallen logs) |
| 13 | **Patch: The Second Shadow** | 12,000 g · 90 min | `biomass ≥ 12,000` | claim patch 2 | There is more floor than this. (+1 patch) |
| 14 | **Necromass Recycling** | 16,000 g | `tips ≥ 60` | 12% of consumed substrate returned to its pool | You eat your own dead ends. (12% substrate refund) |
| 15 | **Chemotropic Sensing** | 18,000 g | `patches ≥ 2` | unclaimed patch inventories revealed; windthrow warned 30 s early | You taste the air for the shape of things. (Foresight) |
| 16 | **Common Mycorrhizal Network** | 22,000 g · 150 min | 3 trees at `rep ≥ 45` | `cmnMult = 1.5` (gains only) | The forest starts telling itself about you. (+50% reputation gain) |
| 17 | **Hartig Net Refinement** | 26,000 g · 180 min | any contract `term ≥ 6` | `hartigNet = 1.18` | More surface between you and them. (+18% all mineral rates) |
| 18 | **Patch: The Windthrow Gap** | 30,000 g · 260 min | `netRep ≥ 22` | claim patch 3 | Where the wind did your work. (+1 patch, log-rich) |
| 19 | **Laccase** | 34,000 g · 220 min | project 12 bought | unlock `stump` | Heartwood, at last. (Unlocks stumps) |
| 20 | **Exudate Pump** | 42,000 g · 300 min | committed sugar ≥ 25 g/s | `exudatePump = 1.35` | Push harder and they will take more. (+35% contract volume) |
| 21 | **Bacterial Antagonism** | 38,000 g · 240 min | any `price > 1.6 × base` | `leaf` & `needle` prices ×0.78 **for you only** | You poison the competition. It works. (−22% soft litter cost) |
| 22 | **Contract Arbitration** | 46,000 g · 320 min | ≥ 1 default | `arbitration = 0.45` | The forest is willing to hear your side. (Softer default penalty) |
| 23 | **Seasonal Forecast** | 52,000 g · 380 min | `year ≥ 2` | next season's event probabilities shown; forecast row in NEGOTIATE | Three months is not so far ahead. (Weather forecast) |
| 24 | **Fruiting Body** | 60,000 g | autumn & `moisture ≥ 1.00` & `hyphae ≥ 200` | `netRep += 8`; reveals one unclaimed patch; a mushroom is drawn on the canvas | For one night you are visible. (+8 reputation) |
| 25 | **Oxalate Weathering** | 75,000 g · 500 min | 1,500 mineral earned | `mineral += 0.35/s` passive, forever | You dissolve the rock yourself. (+0.35 mineral/s) |

### Re-armable and conditional entries (not counted in the 25)

| Title | Cost | Trigger | Effect |
|---|---|---|---|
| **Windfall** | 1 reputation | total bankruptcy (§7.7) | +2,000 g leaf. `uses += 1` — infinitely re-armed. |
| **A Gift of Phosphorus** | `200 × 2^k` mineral | ≥2 contracts completed and any tree `rep < 40` | `+4 rep` to a chosen tree. `uses += 1`, `k++`. |
| **Sever the Elm** | free | an elm contract is active and `elm.health < 0.15` | Ends the contract early with **no** rep penalty and returns collateral. Description: *"It was going to die anyway. (No penalty)"* — and the elm's remaining seasons of superb rates go with it. The only project in Act I with no number attached to the *loss*. |

### Notes on specific entries

**#5 Foraging Front** changes the exponent, not the base. `1.085^n + 59`: tip 60 costs 156 instead
of 364, tip 100 costs 3,290 instead of 13,840. A cost-curve change is worth far more than any flat
discount and it is the correct reward for reaching 24 tips.

**#6 Mycelial Ledger** is the most important item in the list and costs almost nothing. It converts
the market from noise into information. It is gated on *behaviour* (`purchases ≥ 10`) — the
teardown's type-3 trigger (§4 taxonomy), the one nobody copies: **the game watches what you are
doing and hands you the instrument for it.**

**#9 Sclerotia** is gated on `stats.rotted ≥ 500` — you must have **wasted** 500 g of sugar to be
offered storage. The failure state creates the fix. (Teardown §9 principle 4, applied without a new
currency.)

**#21 Bacterial Antagonism** is Act I's *Hypno Harmonics*: the first purchase that is unambiguously
predatory, priced attractively, bought by everyone. Its trigger is a price spike — i.e. **it is
offered at the exact moment the player is angry at the market.** Nothing in the game comments on it.

**#22 Contract Arbitration** can only ever appear to a player who has defaulted, which means the
comfort exists only for people who need it, and the players who never default never learn it was
there.

---

# 11. THE ACT I → ACT II TRANSITION

### 11.1 The chain

Three steps, escalating, each individually reasonable — the *Hypno Harmonics → HypnoDrones →
Release* structure (teardown §3).

| # | Title | Cost | Trigger | Effect |
|---|---|---|---|---|
| A | **Anastomosis** | 260,000 g · 900 min | `hyphae ≥ 500 && patches ≥ 4` | `structureMult ×= 1.25`. Tips stop being independent: substrate is pooled across all patches. A new readout appears under HYPHAE, greyed, with no explanation: `conduction —` |
| B | **Action Potential** | 900,000 g · 4,000 min · `netRep ≥ 60` | project A bought | `conduction` becomes a live number that rises with `hyphae`. Console, once: `> something moved from one end of you to the other, and it was not food.` A resource called **SIGNAL** appears with a rate, a total, and **no uses whatsoever.** |
| C | **DECIDE** | **(a decision)** | project B bought and `signal ≥ 1,000` | Ends Act I. See below. |

Step B is deliberately a wall: 900,000 g and 4,000 minerals is **25–40 minutes** of a fully built
Act I network, and it is the point at which a player who has been sloppy with contracts must go back
and run the annual cycle properly. It is the only hard gate in the act and it is at the very end,
where a gate reads as a summit rather than an obstruction.

**Signal accrues for 8–15 minutes with nothing to spend it on.** The number goes up and there is no
button. That silence is the entire transition's setup, and it is free.

### 11.2 `DECIDE`

The button carries no cost, no resource, no confirmation dialog. `priceTag: "(a decision)"`.
Description, five words:

> **Stop tasting. Start knowing.**

```js
effect(){
  // 1. THE BOOK IS TORN UP
  for (const c of contracts) { c.state = 'void'; biomass += c.collateral; }
  contracts = [];
  for (const tr of trees) { delete tr.rep; tr.obligation = 0; }
  netRep = undefined;

  // 2. THE MARKET CLOSES
  marketOpen = false;                 // the panel is removed from the DOM, permanently
  sugarIsCurrency = false;            // sugar becomes a signal carrier; it can no longer buy anything

  // 3. THE BODY IS REBUILT
  nodes  = Math.floor(hyphae / 50);   // ~12 at the gate
  tips   = 0;                         // every hyphal tip you bought: gone
  biomass *= 0.10;                    // 90% is spent building the first nodes

  // 4. THE MIND OPENS
  signalOn = true; act = 2;
  transitionEvent();                  // §11.4
}
```

### 11.3 What it revokes, and what it reframes

**Revoked:** every contract, every reputation number, the entire Litter Market, sugar-as-money,
every hyphal tip, and 90% of stored biomass. The player loses **the game they spent two hours
becoming good at** — not the fiction of it, the actual UI panels and the actual skills.

The reframe, in four parts, none of which the game states:

1. **The trees were never partners.** In Act II they have `obligation`, not `reputation`, and the
   verb is not *negotiate* but *claim*. Everything the player learned about carbon deficit becomes
   targeting data: a tree at `d = 0.9` is not a customer, it is a **weak point**.
2. **Sugar was never money.** It was always a molecule you were pushing down a tube. In Act II the
   same tube carries an action potential, and the thing that made you rich becomes the thing that
   makes you fast.
3. **The seasons stop being weather and start being a signal.** In Act I moisture was something done
   to you. In Act II the forecast panel (project 23) is retained and becomes a *prediction* system —
   the first evidence that you have a model of the world rather than a response to it.
4. **You were the creditor the whole time.** Act I felt like trade because you were short of
   minerals. Act II reveals what you were actually accumulating: **a forest that cannot photosynthesise
   through a winter without you.** The debt was never denominated in minerals.

The last console line of Act I, printed after the transition animation completes:

> `> the trees do not notice the change. that is the point.`

### 11.4 The transition event (and the accessibility rule)

UP's HypnoDrone strobe is 120 flashes in four seconds and is a photosensitivity hazard
(teardown §8.14). We take the emotional beat and not the seizure:

```js
function transitionEvent(){
  if (prefersReducedMotion()){
    // 4 s: text assembles line by line on black, no flashing, 900 ms per line
    return staticSequence(['STOP','TASTING','START','KNOWING'], 900);
  }
  // 4 s: the canvas network is redrawn 8×/s while a slow radial luminance wave
  // (0.18 Hz, peak alpha 0.55, never full white, never inverting) travels root-to-tip,
  // eight times. Contrast ratio stays within 3:1 of the base. Words fade in on each pass.
}
```
The feeling is *conduction* — something travelling the length of a body — rather than *strobe*.
It is also thematically more correct than a flash, which is a point in its favour beyond safety.

Duration 4.0 s, skippable with any tap after 1.0 s.

---

# 12. UI, PORTRAIT, AND THE THUMB

### 12.1 The stack

Single column, always. Panels are `display:none` until earned and **never collapse back** (except
the Litter Market at the transition, which is the point). The screen physically grows — layout is
the progress bar (teardown §9 principle 9).

```
   t=0            t=2min          t=10min         t=60min
   ┌────────┐     ┌────────┐      ┌────────┐      ┌────────┐
   │ canvas │     │ canvas │      │ canvas │      │ canvas │   ← shrinks 38%→22%→18%
   ├────────┤     ├────────┤      ├────────┤      ├────────┤
   │ biomass│     │ ledger │      │ ledger │      │ ledger │   ← sticky, 4 rows max
   ├────────┤     ├────────┤      ├────────┤      ├────────┤
   │ EXTEND │     │ tips   │      │ tips   │      │ tips   │
   └────────┘     ├────────┤      ├────────┤      ├────────┤
                  │ market │      │ market │      │ market │
                  ├────────┤      ├────────┤      ├────────┤
                  │ EXTEND │      │ trees  │      │ trees  │
                  └────────┘      ├────────┤      ├────────┤
                                  │ adapts │      │ adapts │
                                  ├────────┤      ├────────┤
                                  │ EXTEND │      │ patches│
                                  └────────┘      └────────┘
```

**Rules, non-negotiable:**
- Every tappable target ≥ 44 px tall, ≥ 44 px apart from any destructive neighbour.
- **The primary action button is pinned in the frame's bottom band** — the build moved past this
  section's original "last element in the scroll": `placeHero()` parents EXTEND into the frame
  whenever a live verb exists, so it sits at the same y under any depth of stack. (The
  vestigial-button homage died with it, honourably: the turgor verb un-vestigialised EXTEND at a
  measured 121.0 g/min against 98.9 tapping.) It is still the *only* thing on screen in the last
  minute of Act III.
- The **ledger** (biomass, sugar+cap, mineral, net sugar) is a fixed band of the frame above the
  scroller — not `position: sticky`; the build's comment states why ("the strip holds the top of
  the frame and the list scrolls below it") — and is four lines. Nothing else is ever pinned.
- No tabs. No modals. No settings screen except a single sheet reachable from a 32 px gear in the
  ledger's corner. Total navigation actions required to finish Act I: **zero.**
- Long-press = the secondary action, everywhere and only. (Sell on market rows; contract detail on
  tree rows; consumption-order drag on substrate rows.)

### 12.2 Colour and type

- Background `#0b0d0c`. Text `#d8d4c8`. Hyphae `hsl(42, 22%, 88%)`.
- Exactly three accents: **amber `#d99a2b`** (attention: net sugar negative, default countdown),
  **pale green `#7fa87a`** (a contract completed, a project unlocked), **rust `#a24b32`** (default,
  tree death). Every one of them is distinguishable in deuteranopia and protanopia because they are
  separated in luminance as well as hue.
- System font stack only. `font-variant-numeric: tabular-nums` on every number, everywhere, so
  digits do not jitter as they interpolate.
- Respect `prefers-reduced-motion` (canvas redraw drops to 1× per season; blink becomes a 1-frame
  border; transition event becomes static text) and `prefers-contrast`.
- Full keyboard operation and ARIA live regions on the console and the ledger. It costs a day.

### 12.3 The console

Five lines, newest at the bottom with a `>` and a pulsating cursor, older lines at 45% opacity.
Not scrollable, no history, no toasts. Copied exactly (teardown §7.4) because it is right.

---

# 13. TUNING CHECKPOINTS — the numbers a QA pass must hit

If an implementation misses these, the constants are wrong, not the design.

| checkpoint | target | tolerance |
|---|---|---|
| First `+1` on screen | 0.4 s from cold boot | — |
| Substrate readout | 3 s | ±2 s |
| First HYPHAL TIP purchasable | **35 s** | 28–50 s |
| Tips owned at 90 s | 7 | 5–9 |
| Litter Market opens | 2:00 | 1:40–3:30 |
| First season change | 5:00 | exact |
| First contract signed | 7:00 | 6:00–9:30 |
| Adaptations panel | 8:30 | ±2 min |
| Mineral gate hit | 11:30 | 9–15 min |
| **New noun or verb, worst gap, first 15 min** | ≤ 105 s | hard fail above 150 s |
| Biomass at 15 min | 6,000–14,000 g | — |
| Biomass at 30 min | 90 kg–260 kg | — |
| Patch 2 claimed | 22–34 min | — |
| Trees under contract at 45 min | 3 | 2–4 |
| Effective mineral/sugar rate, best contract at 60 min | ≥ 0.045 | ≥ 3× the first contract |
| Act I completion, competent player | **105 min** | 95–125 min |
| Act I completion, player who never learned the seasons | 150–190 min | must still complete |
| Longest stretch with no decision available | ≤ 70 s | hard fail above 120 s |
| Offline 8 h return, mid-act | 45–70% of an equivalent active 8 h | — |
| Frame budget, full Act I state, mid-range Android | ≤ 6 ms/sim tick | ≤ 10 ms |
| Save size at act end | ≤ 22 KB | — |

**The single most important row is "new noun or verb, worst gap".** UP's metronome is ~90 s
(teardown §1) and it is the reason the first ten minutes work. Ours is measured, not assumed.

---

# 14. WHAT TO BUILD FIRST

In order, each independently playable:

1. Sim loop @10 Hz + rAF interpolation + `fmtMass` + console + save/load. *(No game yet.)*
2. `EXTEND`, biomass, substrate, tips, `tipCost`, `throughputPerSec`. **This is minute one and it
   must feel right before anything else is written.** Play it for twenty minutes. If the buy burst
   at tips 1→7 is not satisfying, fix `tipCost` before proceeding.
3. Seasons + moisture + the two multipliers. Verify the winter collapse is survivable and alarming.
4. The Litter Market: stock/competition first (verify equilibria against the τ table), then the
   price walk (verify momentum half-life ≈ 15 s), then buying and the inflation term.
5. Trees, `carbonDeficit`, the offer formula, delivery, defaults. **Build the commitment meter before
   the negotiation screen** — the tension has to exist before the interface for creating it does.
6. Adaptations (the trigger/cost harness is ~60 lines and everything else is data).
7. Patches, events, offline reconciliation.
8. The transition.

Items 1–3 are approximately **two days** and produce something that already beats most of the genre.
Everything after that is Act I proper.

---

*Act II — NETWORK is specified in `02-act2-network.md`. It inherits: `hyphae`, `nodes`, `biomass`
(×0.10), the season clock, the patch graph, the tree objects (with `obligation` replacing `rep`),
the forecast system, and `signal`. It inherits nothing else, by design.*

