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

<!--NEXT-->
