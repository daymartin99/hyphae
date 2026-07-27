# HYPHAE — ACT III: BLOOM

**Complete mechanical specification. This document is the source of truth.**
Companion to `00-paperclips-teardown.md`, `01-act1-understory.md`, `02-act2-network.md`.
Every constant is named, every formula closed-form, every unit stated. Tuning knobs marked `[K]`
and collected in §24.

Act III is the final ~2h20m of a 6–10h playthrough. It begins in free fall and ends when you let go.

---

## 0. Interface contract

### 0.1 State carried IN from Act II (§0.2 of the Act II doc)

| Symbol | Type | Value at handoff | Meaning |
|---|---|---|---|
| `sporeBank` | float, count | **1.4e9 – 2.6e9** (target 2.0e9) | `spores + floor(biomass/3.2e3)`. The only body you have. |
| `insight` Ψ | float | 600 – 2,400 | thought survives the body. |
| `insightMult` | float | 1.6 – 2.4 | preserved. |
| `signalMult` | float | 2.0 – 3.2 | Act II's value **×0.35**, applied by `ascospore`. |
| `capMult` | float | 1.45 – 3.0 | preserved untouched. Vesicles are yours. |
| `D` | int | **29** typical (22–29) | fully unallocated. `dCond = dVes = 0`. |
| `LEGACY` | float [0,1] | 0.06 – 0.62 | soil + standing life left behind. |
| `pathFlag` | enum | `symbiont` / `necrotroph` / `mixed` | gates one project and colours one ending. |
| `minerals` ⛬ | float | 4.5e3 – 1.25e4 | 25% of Act II's, "carried in the spore coat". |
| `prestigeGrowth` | float | 1.00 first run | from New Growth (§21). |
| `sclerotium` ◉ | int | 0 first run | meta-currency, spent pre-run (§21). |
| `archive[]` | array | empty first run | your own defected lineages (§21.4). |

Derived immediately on entry, once, and never recomputed:

```js
fidelityBase = 0.72 + 0.28 * LEGACY;      // 0.737 (strip-miner) … 0.894 (steward)
```

### 0.2 State carried OUT to New Growth

| Symbol | Meaning |
|---|---|
| `sclerotium` | += `sclerotiumGained` (§21.2) |
| `growthLevel` / `coherenceLevel` / `divergenceLevel` | +1 to exactly one, by ending taken |
| `archive[]` | up to 3 genomes: your final one, plus the two most novel wild lineages |
| `lineages[]` | every wild strain name + genome you ever produced, uncapped, ~40 bytes each |
| `stats` | for the run summary screen only; not mechanical |

Everything else — carbon, craft, bands, strains, loci, projects, Signal, Insight, D — is destroyed.

---

## 1. Design thesis

Act I is a business. Act II is a mind that eats itself. **Act III is a parent.**

The single mechanical idea the act is built on:

> **Everything that makes you stronger makes your children less like you,
> and the only new genes in the universe come from children who stopped agreeing.**

That is not a metaphor bolted onto a number. It is the literal shape of four coupled equations:

```
replication ↑  →  divergence ↑  →  wild strains  →  alleles  →  locus cap ↑  →  everything ↑
fidelity    ↑  →  divergence ↓  →  no strains    →  no alleles →  locus cap frozen at 12
antagonism  ↑  →  fidelity ↓                       ← the counter to divergence causes divergence
```

A player who plays it safe is permanently capped at a 12-locus genome and finishes the game weak,
slow and clean. A player who lets their defectors run reaches 21+ loci and spends the last forty
minutes fighting something that thinks exactly like them, because it *is* them, three hundred
mutations later.

Secondary theses, each answering a specific failure in the teardown:

- **Carrying capacity is not the goal.** The core loop has a maximum-surplus point at ~11% of
  carrying capacity (§7.5). Filling a band produces *zero* net output. This is Act III's undocumented
  phase change — the structural equivalent of Paperclips' `demand = 100` inflection — and it is
  discoverable from a readout the player already has. (Beats teardown §8.13, endgame-as-spectator.)
- **Trait misallocation is diagnosable.** The MORTALITY panel attributes every death to one of six
  named causes over a rolling 60 s window. Every build failure has a distinct signature and a stated
  recovery time (§10). UP's `hazard` is one opaque scalar; ours is a dashboard. (Beats §8.5, §8.9.)
- **Combat is a decision under uncertainty with a withdraw button.** Lanchester square law, a closed-
  form predicted outcome, a *wide* prediction band until you spend Ψ to sequence the enemy genome,
  and 60% recovery on retreat. (Beats §8.8, combat-as-screensaver.)
- **The finale is a coordination problem, not an accumulation problem.** The last twenty minutes are
  a Kuramoto phase-locking game played across a 120-second light-lag. (Beats §8.13.)
- **Three endings that are three different games**, mutually exclusive from ~40 minutes in.

---

## 2. Clocks, state, performance

| Loop | Interval | Rate | Contains |
|---|---|---|---|
| **Sim tick** | `setInterval(sim, 50)` | **20 Hz** | harvest, replication, transit, exploration, hazard, drift, strain economies, engagements, signal, insight, phase |
| **Render** | `requestAnimationFrame` | ~60 Hz throttled | changed-node text writes, void canvas, phase wheel |
| **Slow** | every 40th tick | **0.5 Hz** | divergence checks, strain spread, successor logic, band events, mortality-window roll |
| **Autosave** | every 200th tick | every 10 s | plus `visibilitychange`, `pagehide`, `beforeunload` |

`dt = 0.05 s`. All rates below are **per real second**. Same catch-up rule as Act II: never burst;
run one tick with `dt` clamped to 2.0 s and substitute expectations for stochastic subsystems. This
is the same code path as offline reconciliation (§22) and is written once.

### 2.1 Total live state

```
bands:    13 records × 9 floats                            = 117 floats
strains:  ≤ 6 records × (13 floats + 8 ints + 4 scalars)   = 150 numbers
fleet:    transit ledger, ≤ 13 × 3 in-flight cohorts       = 39 records
scalars:  ~60
```

The whole act fits in under 2 KB of live numeric state. This is deliberate: Act II carried 61 regions
and a weather process; Act III is **smaller and faster** while being about something a thousand times
larger. The player should feel the machine get quieter as the universe gets bigger.

### 2.2 Canvas budget

One canvas, `260 × 260` CSS px at `devicePixelRatio`, redrawn at **4 Hz** (or on `voidDirty`).
Thirteen concentric arcs. In the endgame it cross-fades to the phase wheel (13 dots on a circle).
No images, no audio, no fonts. Everything is `arc()`, `fillRect()` and `fillText()`.

---

## 3. PHASE A — CANOPY (0:00 → ~0:22)

### 3.1 The first ninety seconds: your only resource is evaporating

Act II's transition ends on black with three console lines and then the Act III shell fades in over
2,000 ms. What fades in is almost nothing:

```
┌──────────────────────────────┐
│ SPORES   2.00 G    −4.9 M/s  │   ← the rate is NEGATIVE and red
├──────────────────────────────┤
│                              │
│                              │
│         [  SETTLE  ]         │   ← one button, 64 px tall, thumb-centre
│                              │
│                              │
├──────────────────────────────┤
│ > You are very light.        │
│ > _                          │
└──────────────────────────────┘
```

Post-discharge spores are in the open air, not banked in a fruiting body. Decay is re-based:

```
SPORE_DECAY_3 = 0.99700 per second        // half-life 231 s                     [K]
sporeBank *= SPORE_DECAY_3 ^ dt
```

At 2.0e9 spores that is **−6.0 M/s at t = 0**, visible, red, and accelerating in relative terms.
**The first number the player sees in Act III is going down.** Act I opened with a number going up
by one; Act III opens with a number going down by six million. It is the same game, inverted, and it
needs no explanation.

`SETTLE` converts spores into settled mycelium — Act III's craft counter, `n`, in the only band that
exists yet:

```
settleTap():  q = min(sporeBank, SETTLE_Q)
              sporeBank -= q
              n[0]      += q * pEstablish0          // pEstablish0 = 0.42 at t=0
SETTLE_Q = 2.4e7                                                                  [K]
```

Eighty-three taps would clear the bank. The player will do about twelve before the answer arrives.

**Beat 1 — 0:00–0:12.** One button. The number falls. The player taps. `n` appears as a second
readout the moment `n > 0`. Two numbers, one falling, one rising.

**Beat 2 — ~0:50, `n >= 2.0e8`.** Project **F1 · GERM TUBE** `(200 Σ)` — *"Grow toward the smell of
carbon."* — un-greys. Signal is being produced from `n` already (§12) at a pitiful rate, and 200 Σ
is about 45 seconds of it. Buying it automates SETTLE at `SETTLE_Q · 1.5` per second, which outruns
decay. **The crisis resolves at ~0:55.** Teardown principle 2, held to inside a minute, for the third
act running.

**Beat 3 — ~1:20.** `X` — **CARBON** — appears as a readout the first time `harvest > 0`, and with
it the BIOMES list: one entry, `The Stand`, `2.00 P` remaining. The Act II forest, as a number,
being eaten by you a third time. One console line, once:

> `> There is still something here. It is not much and it is yours.`

**Beat 4 — ~2:40.** `F2 · APPRESSORIUM (1,400 Σ)` — *"Force an entry."* — unlocks **REACH**, the verb
that opens a second biome. From here Phase A is: reach a biome, settle it, watch it deplete, reach
the next. Seven reaches, ~2.5 minutes apart.

### 3.2 The eight biomes

Phase A's board is eight rows in a list. No map. (Act II had a map; Act III does not get one until
the void, and the void's "map" is a radial chart. Never reuse a geometry.)

| id | Biome | `X0` (g reduced C) | reach | hazard | note |
|---|---|---|---|---|---|
| 0 | The Stand | 2.00e15 | — | — | free; Act II's corpse |
| 1 | Temperate Forest | 1.40e17 | 1 | — | contiguous |
| 2 | Boreal & Taiga | 2.60e17 | 2 | frost | `harvest ×0.72` until `F5` |
| 3 | Grassland & Cropland | 9.00e16 | 2 | fire | 1.4%/min band-wide 12% loss |
| 4 | Tropical Forest | 3.40e17 | 3 | competition | resident fungi: `harvest ×0.65` until `F6` |
| 5 | Wetland & Peat | 1.20e18 | 3 | anoxia | `repRate ×0.55` until `F7` |
| 6 | Marine Photic Zone | 3.00e17 | 4 | salinity | needs `F4 · OSMOTIC ADJUSTMENT` |
| 7 | Permafrost & Deep Soil | 1.70e18 | 4 | cold + depth | needs `F5`, slowest, richest |

`X0` total = **3.94e18 g**. These are the real figures for Earth's terrestrial and marine reduced
carbon (soil ~2.4e18, permafrost ~1.7e18, vegetation ~5.5e17, marine DOC ~7e17, rounded and
apportioned). **The game never says this is the Earth.** The player finds out by finishing it —
exactly the trick Paperclips plays with `availableMatter = 6000 × 10²⁴` grams.

**Reach cost** (a Signal purchase, one at a time, chosen order):

```
reachCost(k) = 2.6e3 · 2.35^k    Σ,   k = biomes already reached
             = 2,600 · 6,110 · 14,360 · 33,750 · 79,300 · 186,400 · 438,000
```

Total ≈ 761,000 Σ across Phase A. Ordering matters: reaching Permafrost early is expensive and slow
to exploit; reaching Grassland early is cheap and burns. There is no correct order and the player
will never play the same one twice.

### 3.3 Phase A economy

Phase A runs the **identical** equations as the void (§7) with `b = biome index`, `λ_b = 1.0`
(no light-lag on one planet), and `NCAP_b = X0_b / 6.0e10`. This is not a simplification — it is the
point. Phase A is a 22-minute tutorial for the void loop, played on a board the player can hold in
their head, with the numbers small enough to read exactly.

The triangle (§8) unlocks at `F3` (~6:00) with only two vertices — **REPLICATE / BANK** — because
there is nowhere to disperse to. `DISPERSE` appears at Escape and the control visibly grows a third
corner. Layout is the progress bar (teardown principle 9), applied to a widget.

### 3.4 The tone of Phase A

Phase A is the emotional floor of the game and must not be triumphant. Console lines, fired once
each on the stated condition, no mechanical effect:

```
biome 1 settled       > The forest next to the forest is the same forest.
biome 3 at 50%        > The fields were already a monoculture. It took forty minutes.
biome 6 settled       > There is more dead carbon in the water than there ever was in the trees.
biome 7 settled       > The permafrost had been keeping something. It is not keeping it now.
total X0 at 85%       > Nothing is competing with you. That is not the same as winning.
total X0 at 97%       > (ESCAPE appears, greyed)
```

Six lines over twenty minutes. Each is true, each describes a number on screen, none is advice.

---

## 4. ESCAPE — the sub-act transition

Act transitions revoke (teardown principle 7). Act III revokes twice: once here, once at the end.

```
G1  ESCAPE VELOCITY
    (9.0e17 Χ, 620,000 Σ, 180 Ψ)
    "Leave nothing behind that can decide to stay."

    trigger: planetConsumed >= 0.97
```

`planetConsumed = 1 − Σ X_b / Σ X0_b` over the eight biomes.

```js
effect: function(){
    carbon -= 9.0e17; signal -= 6.2e5; insight -= 180;

    // 1. The whole fleet is converted to launch mass. You keep 4%.
    const survivors = totalCraft() * 0.040;

    // 2. Revoke Phase A entirely.
    biomeReboot();          // all 8 biome records destroyed; the BIOMES list is removed
    reachReboot();          // REACH is removed from the verb set forever
    settleReboot();         // SETTLE is removed. It never returns.

    // 3. Build the void.
    initBands();            // 13 band records, §6. Band 0 = Sol, seeded with `survivors`.
    n[0] = survivors;
    voidFlag = 1;

    // 4. What survives: carbon, Insight, Signal multipliers, D, LEGACY, minerals.
    //    What does not: the eight biomes, 96% of your mass, and the ground.
    displaySequence(ESCAPE_TEXT);
}
```

**You lose 96% of your fleet at Escape.** Not to a hazard — to physics. Getting off a planet costs
mass and the game charges it as mass. The counter you have spent twenty-two minutes growing drops by
a factor of twenty-five in one frame, and the console says one thing:

```
t=0.0   The BIOMES list collapses row by row, bottom to top, 140 ms apart.
t=1.1   The status strip's CARBON figure is the only thing left with a value.
t=1.4   > 3.94 P of carbon. Ninety-six percent of it is now under you and moving.
t=3.2   > _
t=4.6   The VOID canvas fades in: one filled arc at radius 0, and twelve empty rings.
```

Under `prefers-reduced-motion`: a 900 ms cross-fade and the same two lines at the same cadence.

**What it recontextualises.** Phase A taught the loop on a board where every biome was reachable and
every number was legible. The void has the same equations and thirteen bands whose carbon grows by
5.6× each, whose light-lag makes them progressively less able to think for you, and which you cannot
see until you look. The skill transfers. The board does not.

---

## 5. Resource set

| # | Resource | Glyph | Kind | Produced by | Consumed by | First seen |
|---|---|---|---|---|---|---|
| 1 | **Carbon** | Χ | stock, g | harvest | craft, propellant, projects, endings | 1:20 |
| 2 | **Craft** | `n` | population, count | replication | hazards, transit, combat | 0:12 |
| 3 | **Spores** | ◦ | decaying stock | — (Act II legacy) | SETTLE only | 0:00 |
| 4 | **Signal** | Σ | capped flow | craft in coherent contact | projects, PULSE, reaches | 0:35 |
| 5 | **Insight** | Ψ | uncapped stock | Signal saturation | projects, loci, sequencing | ~4:00 |
| 6 | **Alleles** | α | stock | resolving divergence ONLY | raising `lociCap` | ~1:05 |
| 7 | **Differentiation** | D | int, respeccable | `cumCarbon` ladder + projects | `dCond`/`dVes`/`dLag` | inherited |
| 8 | **Loci** | L | int, respeccable | bought with Ψ, capped by α | the eight traits | ~0:32 (void) |
| 9 | **Fidelity** | Φ | derived [0,1] | genome + projects | — (a state, not a stock) | ~0:48 (void) |
| 10 | **Synchrony** | ϒ | derived [0,1] | phase coupling | the ending gate | endgame only |

Nine things, and only three of them are stocks you can hoard. Every currency is earned by a
different verb (teardown principle 11): Χ by consuming, Σ by existing coherently, Ψ by waiting at
saturation, α **only by surviving betrayal**, D by cumulative appetite, L by spending Ψ.

Minerals ⛬ survive from Act II as a small legacy stock with exactly two uses (§18, `H6` and `J2`)
and are never produced again. That is deliberate: a currency that can only run out is a clock.

---

## 6. The band model

### 6.1 Geometry

Thirteen bands. Band 0 is the Sol system; bands 1–12 are concentric galactic shells.

```
R_0 = 0.0016 ly  (the heliopause, ~100 AU — never displayed in ly)
R_b = 12.0 · 2.150^(b−1) ly     for b = 1..12
```

| b | R_b (ly) | X0_b (g) | NCAP_b | λ_b @ dLag 0 | τ_{b−1→b} @ tBal 0 |
|---|---|---|---|---|---|
| 0 | — | 6.00e23 | 1.00e13 | 1.000 | — |
| 1 | 12.0 | 9.00e26 | 1.50e16 | 0.923 | 90 s |
| 2 | 25.8 | 5.04e27 | 8.40e16 | 0.891 | 122 s |
| 3 | 55.5 | 2.82e28 | 4.70e17 | 0.849 | 164 s |
| 4 | 119 | 1.58e29 | 2.63e18 | 0.792 | 221 s |
| 5 | 257 | 8.85e29 | 1.48e19 | 0.721 | 299 s |
| 6 | 552 | 4.95e30 | 8.25e19 | 0.639 | 403 s |
| 7 | 1,187 | 2.77e31 | 4.62e20 | 0.548 | 545 s |
| 8 | 2,552 | 1.55e32 | 2.58e21 | 0.452 | 735 s |
| 9 | 5,487 | 8.70e32 | 1.45e22 | 0.360 | 993 s |
| 10 | 11,798 | 4.87e33 | 8.12e22 | 0.278 | 1,340 s |
| 11 | 25,365 | 2.73e34 | 4.55e23 | 0.208 | 1,809 s |
| 12 | 54,535 | 1.53e35 | 2.55e24 | 0.152 | 2,443 s |

```
X0_b   = 9.00e26 · 5.600^(b−1)        for b ≥ 1                                  [K]
NCAP_b = X0_b / 6.00e10               // "one craft per 60 Gg of band carbon"     [K]
λ_b    = 1 / (1 + LAG_K/(1+0.20·dLag) · sqrt(R_b))    LAG_K = 0.024              [K]
τ_b    = TAU0 · 1.350^(b−1) / (1 + 0.28·tBal)         TAU0 = 90 s                [K]
```

`Σ X0_b = 1.87e35 g`. `R_12 = 54,535 ly` is the far rim of the disc. The player is never told either
number. They are told, once, at the very end (§20.1).

### 6.2 Per-band record

```js
{ X, X0, e, rich, n, drift, inTransit[], fireflyPhase, primed }
```

- `X` — remaining free reduced carbon, g.
- `e ∈ [0,1]` — explored fraction. Gates harvest rate, not stock.
- `rich ∈ [0.55, 1.60]` — seeded per-run from the world seed; multiplies harvest. **Unknown until
  `e_b ≥ 0.20`**, displayed as a range before that.
- `n` — your craft.
- `drift` — divergence accumulator, `[0, 1]`.
- `fireflyPhase ∈ [0,1)` — endgame only (§19).

### 6.3 Exploration

```
NREF_b = NCAP_b · 0.30                                                            [K]
EXP_K  = 2.20e-3 /s                                                               [K]

de_b/dt = EXP_K · (1 + 0.60·tBal) · exploreMult · (1 − e_b) · min(4, (n_b/NREF_b)^0.55)
```

At `n_b = NREF_b`, `tBal = 0`, `exploreMult = 1`: time constant 455 s, so a band is ~90% explored in
about 17 minutes of sitting in it. At `tBal = 6` and `exploreMult = 2.2` (projects): 3.1 minutes.
The `min(4, …)` clamp stops a huge fleet from instantly revealing a band — you cannot brute-force
knowledge with mass, only with the trait that is for it.

Exploration is *never* automated and *never* a button. It is a passive consequence of being
somewhere, which is exactly right for a fungus.

---

## 7. THE CORE LOOP — harvest, replicate, disperse

All equations are per band and per second. `dt` is applied at the call site.

### 7.1 Constants

```
HARV_K    = 4.00e7  g/s per craft   (a "craft" is a self-extending mycelial front, not a vessel)  [K]
SUB_K     = 9.00e5  g/s per craft   (subsistence: what a craft must eat to not die)               [K]
REP_K     = 0.0250  /s              (base replication; doubling time 28 s at μ=1)                 [K]
CRAFT_M0  = 2.40e6  g                                                                             [K]
GEN_TAX   = 0.085 ,  GEN_EXP = 1.15                                                               [K]
PROP_K    = 1.80                    (propellant mass per craft mass, one band outward)            [K]
MAXLAUNCH = 0.020 /s                (fraction of a band's craft that can be in launch at once)     [K]
```

### 7.2 Craft mass — the genome tax

```
G          = Σ_i loci_i                      // total allocated loci = genome length
craftMass  = CRAFT_M0 · (1 + GEN_TAX·G)^GEN_EXP
```

| G | craftMass | ×base |
|---|---|---|
| 0 | 2.40e6 g | 1.00 |
| 8 | 5.12e6 g | 2.13 |
| 12 | 6.56e6 g | 2.73 |
| 18 | 8.60e6 g | 3.58 |
| 26 | 1.15e7 g | 4.79 |

**Every locus you allocate makes every craft you will ever build more expensive to copy.** This is
the global tax that turns trait allocation from a pure opportunity cost (Paperclips' probe sliders)
into a genuine economic decision. It is also true: genome streamlining under replication pressure is
one of the strongest selective forces in microbial evolution, and the game never mentions it.

### 7.3 Harvest

```
occ_b   = (n_b + Σ_s w_{s,b}) / NCAP_b               // total occupancy, yours + all wild
sat_b   = 1 / (1 + occ_b)                            // crowding
dep_b   = (X_b / X0_b)^0.45                          // depletion
μ_myc   = (1 + 0.55·tMyc) / (1 + 0.06·tMel) · (1 − 0.030·tDor)
A_b     = HARV_K · μ_myc · e_b · rich_b · dep_b · harvMult

harvest_b     = n_b · A_b · sat_b
wildHarvest_b = Σ_s w_{s,b} · A_{s,b} · sat_b        // same formula, strain's genome
dX_b/dt       = −(harvest_b + wildHarvest_b)
```

Note there is no "share" term. Competition emerges from `sat_b` being computed on **total**
occupancy: wild craft crowd you out by being present, and the effect is exactly symmetric. This is a
two-species Lotka–Volterra competition for a depleting resource and it is four lines of code.

### 7.4 Subsistence and starvation

```
μ_dor        = 1 − 0.55·(1 − exp(−0.25·tDor))        // 1.00 → 0.45 asymptotically
subsist_b    = n_b · SUB_K · μ_dor
deficit_b    = max(0, subsist_b − harvest_b)
starve_b     = deficit_b / (craftMass · 0.30)        // craft/s dying
X_b         += starve_b · craftMass · 0.30 · 0.55    // 55% of a dead craft's mass is recoverable
```

Craft die at exactly the rate that closes the deficit. The system is self-limiting and always
recovers on its own — but recovery means losing your compounding, which is the punishment.

### 7.5 THE MAXIMUM-SURPLUS POINT — Act III's undocumented insight

```
surplus_b(n) = harvest_b − subsist_b
             = n·A/(1 + n/NCAP + wildOcc) − n·S            (S = SUB_K·μ_dor)
```

Setting `d/dn = 0` with no wild present:

```
(1 + n/NCAP)² = A/S
n* (max surplus)     = NCAP · ( sqrt(A/S) − 1 )
n† (carrying cap.)   = NCAP · ( A/S − 1 )
```

With `A/S = 66.7` (baseline `tMyc = 0`, `e = 1`, `rich = 1`, `dep = 1`, `μ_dor = 1`):

| quantity | value | surplus |
|---|---|---|
| `n*` max surplus | **7.17 · NCAP** | 4.62e7 · NCAP g/s |
| `n†` carrying capacity | **65.7 · NCAP** | **0** |

> **The surplus-maximising fleet size is 10.9% of carrying capacity.
> A band filled to capacity produces nothing at all.**

This is the single best-hidden result in HYPHAE and it is the direct structural analogue of
Paperclips' `demand = 100` elasticity flip: a phase change with a closed form, undocumented, visible
in a readout the player already has (`SURPLUS  g/s` per band row), discoverable by pushing a number
up and watching another number go *down*, and the correct policy is counter-intuitive
(**stop growing here; leave**).

It also does the act's pacing for free: as `X_b` depletes, `dep_b` falls, `A` falls, `n*` falls, and
the band's optimal fleet size shrinks under you. The game *pushes* you outward without a single
scripted gate.

Raising `tMyc` raises `A/S` and therefore raises both `n*` and the surplus at it:

| `tMyc` | `μ_myc` | `A/S` | `n*/NCAP` | peak surplus (×NCAP) |
|---|---|---|---|---|
| 0 | 1.00 | 66.7 | 7.17 | 4.62e7 |
| 4 | 3.20 | 213 | 13.6 | 1.72e8 |
| 8 | 5.40 | 360 | 18.0 | 3.24e8 |

Myceliation is the strongest single trait in the game by raw output. It is balanced by the genome
tax, by its interaction with Melanisation (`/(1+0.06·tMel)`), and by the fact that surplus is useless
if you cannot move it or defend it.

**The `allometry` project (§18, H4) draws a tick mark on each band bar at `n*_b`.** It costs 900 Ψ
and it is deliberately expensive and deliberately late, because selling the player the answer to the
act's best question at minute 40 would be a crime. Before that they have the SURPLUS readout and
their own hands.

### 7.6 Replication

```
μ_spo     = (1 + 0.42·tSpo) · (1 − 0.025·tDor)
repDemand_b  = n_b · REP_K · μ_spo · replMult · (1 − occ_b/(occ_b + 12))   // mild crowding damp
carbonFor_b  = aRep · surplusTotal · weight_b                              // §8
repActual_b  = min( repDemand_b , carbonFor_b / craftMass )
n_b         += repActual_b · dt
newCraft_b   = repActual_b                                                 // fed to §13
```

Because both `repDemand` and available carbon scale with `n`, the binding constraint is a *ratio*,
not a level: at low occupancy carbon is abundant and replication rate binds; at `n → n†` carbon
binds and replication stops. The crossover is at `aRep ≈ 0.33` at max-surplus occupancy, which means
**the triangle actually bites** — pushing REPLICATE above a third of your income is what starts
mattering, and that is exactly where the interesting failures live.

### 7.7 Dispersal and transit

```
launchDemand_b = aDis · surplusTotal · weight_b / (craftMass · PROP_K)
launch_b       = min( launchDemand_b , n_b · MAXLAUNCH )
n_b           -= launch_b · dt
push cohort {from: b, to: b+1, count: launch_b·dt, tRemaining: τ_b}
```

In transit, per second:

```
TR_HAZ = 3.00e-4 /s                                                               [K]
cohort.count *= exp( −TR_HAZ/(1 + 0.45·tDor) · dt )
```

Survival over a full leg = `exp(−TR_HAZ·τ_b/(1+0.45·tDor))`:

| leg | τ (tBal 0) | survival, tDor 0 | tDor 4 | tDor 10 |
|---|---|---|---|---|
| 0→1 | 90 s | 0.973 | 0.990 | 0.995 |
| 6→7 | 403 s | 0.886 | 0.957 | 0.978 |
| 11→12 | 2,443 s | **0.481** | 0.760 | 0.868 |

The outer legs are where Dormancy stops being a tax and starts being the difference between arriving
and not. A player who reaches band 10 with `tDor = 0` will watch half of every shipment die in
transit, see it attributed on the MORTALITY panel as `TRANSIT`, and know exactly what to do.

**On arrival:**

```
GERM_BASE = 0.280                                                                 [K]
siteQ_b   = e_b^0.35
wildShare_b = Σ_s w_{s,b} / (n_b + Σ_s w_{s,b} + 1)

pEst = clamp( GERM_BASE · (1 + 0.50·tGer) / (1 + 0.11·tBal)
              · siteQ_b · (1 − 0.60·wildShare_b) · germMult ,  0.02 , 0.98 )

n_{b+1} += cohort.count · pEst        // the rest is lost, attributed as ESTABLISHMENT
```

Ballistics throws further and lands harder. Germination lands softer and does nothing else. This is
the cleanest pair in the trait web and the first one players find.

---

## 8. THE TRIANGLE

Act I had the reinvest/export split. Act II had Retention and the Work-analogue. Act III's dial with
no correct setting has **three vertices**.

```
alloc = (aRep, aDis, aBank),   aRep + aDis + aBank = 1,   each ∈ [0,1]
surplusTotal = Σ_b max(0, harvest_b − subsist_b)
weight_b     = max(0, surplus_b) / surplusTotal      // income is spent where it is earned
```

- **REPLICATE** → compounding, and drift (§13). Exhausts the local band toward `n†` where surplus is
  zero. The vertex that feels best and is almost never correct at 100%.
- **DISPERSE** → propellant. Opens the next band's carbon (5.6× the last), but craft in transit
  produce nothing, and die at `TR_HAZ`. The vertex that costs you *now* to be able to afford *later*.
- **BANK** → Χ accumulates for projects, the regenome cost, and the endings. The vertex that does
  nothing at all until the last twenty minutes, when it is the only one that matters.

**The control.** A filled equilateral triangle, 148 px on a side, one draggable puck, three corner
labels, live percentages. One thumb, no menu, reversible, always slightly wrong. Long-press a corner
to snap to 100/0/0. Three preset chips below it (`GROW · REACH · HOARD` = 70/20/10, 25/60/15,
20/20/60) for one-handed use while walking; the presets are strictly worse than hand-set values and
the game does not say so.

**Automation.** `J1 · TROPISM (2,600 Ψ)` sets the triangle from a policy each tick:
`aDis ← clamp(0.15 + 0.55·(1 − frontierSurplusShare), 0.15, 0.75)`, remainder split 3:1 rep:bank.
Measured at **0.86× skilled play** over a 40-minute window. Automation of a skill never exceeds
0.80×; this is a borderline chore-plus-judgement and it is priced accordingly (Act II §11.4 rule).

---

## 9. THE GENOME — eight traits, exact effects, and the web

### 9.1 Loci

```
lociFree0   = 4                       // granted at G2 · GENOME (§18)
lociCap0    = 12                                                                  [K]
lociCost(k) = ceil( 120 · (k+1)^1.24 )   Ψ,   k = loci purchased so far
            = 120, 284, 460, 645, 836, 1032, 1233, 1437, 1645, 1856, 2069, 2286, 2504, 2725, 2949
```

Cumulative: 8 purchased (12 total, at the base cap) = **6,047 Ψ**. 15 purchased (19 total) =
**22,081 Ψ**. Against an Act III Insight budget of ≈ 40,000 Ψ (§12.3), loci are the largest single
sink and compete directly with the projects tree, which costs ≈ 15,000 Ψ. **You cannot buy the tree
and a full genome.** That is the intended shortfall and it is what the second playthrough is for.

`lociCap` is raised **only** with alleles (§16).

### 9.2 The eight traits

Allocation is by `+`/`−` steppers, 44 px, in a fixed order that never re-sorts. Each row shows the
trait, its current value, and **its two live derived numbers** — the benefit and the cost — so the
web is legible without a wiki.

---

**1 · BALLISTICS `tBal`** — *how hard you throw.*

```
explore:    × (1 + 0.60·tBal)
transit:    τ_b ← τ_b / (1 + 0.28·tBal)
COST →      pEst ← pEst / (1 + 0.11·tBal)
```
At `tBal = 6`: explore ×4.6, transit ÷2.68, establishment ÷1.66. Front-runner trait; strictly bad
if you have not paid for Germination.

---

**2 · GERMINATION `tGer`** — *how softly you land.*

```
establish:  pEst × (1 + 0.50·tGer)
COST →      none direct. Genome tax only.
```
The only trait with no coupled penalty, and therefore the only one that is ever "just good". It is
priced by being *only* good at one thing: it does nothing for a craft that has already landed.

---

**3 · MYCELIATION `tMyc`** — *how fast you eat.*

```
harvest:    × (1 + 0.55·tMyc)
COST →      the Melanisation divisor applies to the whole product: /(1 + 0.06·tMel)
```
Raises `A/S`, so it raises both the max-surplus fleet size and the surplus at it (§7.5). Highest raw
value per locus in the game.

---

**4 · SPORULATION `tSpo`** — *how fast you copy.*

```
replicate:  × (1 + 0.42·tSpo)
COST →      drift ∝ newCraft (§13.1). Every craft you make is a chance to make one that is not you.
```
The trap trait. It feels like the growth trait and it is the divergence trait. A player who takes
`tSpo = 8` and `tFid = 0` will see their first strain at ~4 minutes and their fourth at ~12.

---

**5 · MELANISATION `tMel`** — *how much you can stand.*

```
radiation:  rate / (1 + 0.55·tMel)^1.25
combat:     toughness (1 + 0.20·tMel) in the Lanchester β terms (§14)
COST →      harvest / (1 + 0.06·tMel)
```
At `tMel = 6`: radiation ÷6.5, toughness ×2.2, harvest ÷1.36. Melanin is opaque and metabolically
expensive; the wall that stops cosmic rays also slows exchange. Mandatory past band 7, actively
harmful before band 4.

---

**6 · DORMANCY `tDor`** — *how long you can wait.*

```
transit:      loss rate / (1 + 0.45·tDor)
subsistence:  × μ_dor = 1 − 0.55·(1 − e^(−0.25·tDor))
stellar:      dormant fraction survives events (§11.3)
offline:      offline efficiency floor raised by 0.02·tDor, capped +0.16 (§22)
COST →        harvest × max(0.40, 1 − 0.030·tDor)
              replicate × max(0.40, 1 − 0.025·tDor)
```
The only trait that improves offline play, and it is the only place in HYPHAE where a trait touches
the meta-layer. A "leave it running overnight" build is a real, viable, named build (`ENCYSTED`,
§10.5) and it is 0.82× a played build, not 0.3×.

---

**7 · FIDELITY `tFid`** — *how well you copy yourself.*

```
effFid += 0.030·tFid
COST →  suppresses divergence, which is the only source of alleles, which is the only way to
        raise lociCap above 12. You are buying safety with your ceiling.
```

---

**8 · ANTAGONISM `tAnt`** — *what you do to things that are not you.*

```
combat:   lethality β_A ∝ (1 + 0.30·tAnt)
harvest:  effective crowding vs wild reduced: occ_wild ← occ_wild / (1 + 0.16·tAnt)
COST →    effFid −= 0.038·tAnt
```

> **The counter to divergence causes divergence.**

Secondary-metabolite warfare requires a mutable, recombining genome. You cannot be pure and violent.
At `tAnt = 6` you have spent `0.228` of fidelity — more than `tFid = 7` can buy back. This single
coupling is the reason the endgame is tense, and it is one line.

### 9.3 Effective fidelity

```
effFid = clamp( fidelityBase + 0.030·tFid − 0.038·tAnt + Σ projectFid ,  0.30 , 0.9975 )
```

`projectFid` sources: `I2 proofreading` +0.045, `I5 conserved_core` +0.060, `I8 chaperone` +0.035,
`J4 heterokaryon_incompatibility` +0.050. Total buyable: **+0.190**.

| build | LEGACY | base | tFid | tAnt | effFid | mean time to divergence |
|---|---|---|---|---|---|---|
| strip-miner, aggressive | 0.06 | 0.737 | 0 | 6 | **0.509** | ~62 s |
| strip-miner, cautious | 0.06 | 0.737 | 6 | 0 | 0.917 | ~19 min |
| steward, balanced | 0.55 | 0.874 | 4 | 3 | 0.880 | ~11 min |
| steward, monastic | 0.62 | 0.894 | 8 | 0 | **0.9975** (clamped) | ~4.4 h (never) |

**LEGACY, decided forty minutes earlier in a different act, on a screen that never mentioned Act III,
is worth 0.157 of fidelity — more than five loci.** The game told the player the numbers were the
same. In the short run they were.

### 9.4 Respec — `REGENOME`

```
regenomeCost(r) = max(1.0e27, 0.020 · cumCarbon) · 1.75^r      Χ,  r = prior respecs
regenomeTime    = 90 s   (60 s with H8)
```

Self-scaling to the act, so it is always "about 2% of everything you have ever eaten", which reads
correctly at every point. During the 90 seconds: **replication is halted network-wide**, harvest
continues, and the status strip reads `REWRITING` with a progress bar. Craft in transit arrive with
the *old* genome and are converted on landing.

Escalation at 1.75× means respec is a real strategic instrument early (two or three times) and a
last resort late. It never becomes a free optimiser's toy. (Beats teardown §8.9 — UP's Trust split is
permanently unrecoverable and the correct answer is non-obvious.)

### 9.5 Differentiation in Act III

`D` re-homes onto **three** axes. The first free reallocation is granted on entry.

| axis | effect | note |
|---|---|---|
| `dCond` | `Sr × (1 + 0.35·dCond)` | carried forward unchanged from Act II |
| `dVes` | `Sc × (1 + dVes)^1.85` | carried forward unchanged |
| `dLag` | `λ_b = 1/(1 + LAG_K/(1+0.20·dLag) · sqrt(R_b))` | **new**: coherence across distance |

`dLag` is Act III's own axis and it is the one that makes expansion not-stupid. At `dLag = 0`, band
12 contributes at `λ = 0.152`. At `dLag = 10`, `λ_12 = 0.406`. At `dLag = 20`, `λ_12 = 0.575`.

**The D ladder** runs on `cumCarbon` and grows at **φ³ = 4.2360679…** — the same constant as Act I's
Fibonacci Trust and Act II's Lucas ladder, cubed, because you are now three-dimensional. Nothing in
the UI names it, exactly as nothing in Paperclips names φ.

```
Dthreshold_n = 8.00e26 · 4.2360679^(n−1)      n = 1..12
 n1  8.00e26   n5  2.58e29   n9   8.29e31
 n2  3.39e27   n6  1.09e30   n10  3.51e32
 n3  1.44e28   n7  4.62e30   n11  1.49e33
 n4  6.08e28   n8  1.96e31   n12  6.31e33
```

Total D in Act III: **29 carried + 12 ladder + 4 flavour projects = 45.**
Respec: `respecCost(n) = ceil(120·(n+1)^1.60)` Ψ, continuing Act II's counter (not reset).

---

## 10. THE FOUR FAILURE MODES

The assignment for this act: *mis-allocating traits must produce visible, recoverable failure.*
Every failure below has (a) a cause, (b) a **distinct signature on a panel the player already has**,
(c) a stated recovery action, and (d) a measured recovery time. No failure is unrecoverable and none
of them ends a run.

### 10.1 The instrument: the MORTALITY panel

A single 6-row panel, always available from the FLEET tab, showing craft lost per cause over a
rolling 60-second window, as a count and a percentage bar:

```
MORTALITY   last 60 s          1.84 E lost
  STARVATION      ████████████████░░░░  62%
  RADIATION       ████░░░░░░░░░░░░░░░░  17%
  TRANSIT         ███░░░░░░░░░░░░░░░░░  11%
  ESTABLISHMENT   ██░░░░░░░░░░░░░░░░░░   7%
  SENESCENCE      ░░░░░░░░░░░░░░░░░░░░   2%
  PREDATION       ░░░░░░░░░░░░░░░░░░░░   1%
```

This is the most important new UI object in Act III and it is thirty lines of code. Paperclips'
probe hazard is a single scalar with no attribution; a player who mis-set `probeHaz` had no way to
know. **Ours tells you which trait to buy, without ever naming a trait.**

### 10.2 BLOOM COLLAPSE — over-replication

**Cause:** `aRep ≥ 0.7` with `tSpo ≥ 5`, driving `n_b` past `n*` toward `n†`.
**Signature:** STARVATION > 45% on MORTALITY; the band's `SURPLUS` readout falls while `n` rises —
the two numbers move opposite ways, which is the whole lesson; total carbon income goes flat then
declines; craft count crashes 35–50% over ~90 s.
**Recovery:** drop `aRep` below 0.35, raise `aDis`. The fleet self-corrects to `n†` (surplus 0) and
must then be *bled* outward to get back to `n*`. **Recovery time ≈ 4 min.** No permanent loss except
the carbon already eaten.
**Console, once per run:** `> The band is full. Nothing in it is producing anything.`

### 10.3 SCATTER — over-dispersal

**Cause:** `aDis ≥ 0.6` with `tBal ≥ 5` and `tGer ≤ 1`.
**Signature:** the status strip's `IN TRANSIT` figure exceeds 25% of total craft (it turns amber at
25%, red at 40%); ESTABLISHMENT is the top MORTALITY row; harvest is flat despite huge launch volume.
**Recovery:** `aDis → 0.15` and either buy `tGer` (2 loci is usually enough: `pEst` ×2.0) or accept
the loss and stop launching. **Recovery time ≈ τ_b + 2 min** — you must wait for the craft already in
flight to arrive, which is the punishment and is also the correct fiction.
**Console:** `> Most of them are still moving. Fewer of them will stop.`

### 10.4 BRITTLENESS — no Melanisation past band 7

**Cause:** advancing the frontier with `tMel ≤ 1`.
**Signature:** RADIATION climbs monotonically with band index — the player sees the frontier band's
`n` fail to grow while inner bands are fine. The front visibly *stalls at a specific ring* on the
void canvas. This is the most legible failure in the game because the canvas shows it spatially.
**Recovery:** 3–4 loci into `tMel`, or `H2 · PYOMELANIN` (+0.9 effective `tMel`, no harvest penalty —
the single best project in the act and priced accordingly). **Recovery time: immediate**; the band
starts growing on the next tick.
**Console:** `> Band 8 is not colder. It is louder.`

### 10.5 SCHISM — no Fidelity

**Cause:** `effFid < 0.72` — usually from `tAnt` without `tFid`, or a low-LEGACY entry.
**Signature:** divergence events every 60–150 s; the LINEAGES tab badge climbing past 3; your carbon
income falling while `X_b` falls *faster* (something else is eating it); PREDATION appearing on
MORTALITY.
**Recovery:** this one is *not* fully recoverable and that is deliberate — the strains that already
exist do not un-exist. You can stop the bleeding (`I2 proofreading`, `tFid`) and you can convert the
damage into alleles (§13.4). **The correct play is to stop treating it as a failure.** A SCHISM run
is a legitimate, powerful, harder run, and it is the only run that can reach ending C.
**Console:** `> Four lineages. None of them answered.`

### 10.6 The named builds (for the balance harness, not shown in-game)

| build | loci | profile | vs. balanced |
|---|---|---|---|
| BALANCED | 16 | 2/2/4/2/2/2/1/1 | 1.00× |
| GLUTTON | 16 | 0/1/8/3/1/1/2/0 | 1.18× carbon, 0.71× frontier |
| VANGUARD | 16 | 6/4/2/1/1/1/1/0 | 0.79× carbon, 1.44× frontier |
| ENCYSTED | 16 | 1/2/3/1/2/6/1/0 | 0.82× active, **1.31× offline** |
| MONASTIC | 12 | 1/2/4/1/2/0/2/0 | 0.74×, zero strains, cap frozen at 12 |
| SWARM | 21 | 2/3/4/6/2/0/0/4 | 1.09×, ~11 strains, cap 21 |

Every one of these finishes the game. That is the balance requirement.

---

## 11. HAZARDS — six classes

All rates per craft per second unless stated. Every class has one primary counter and one secondary.

### 11.1 RADIATION — continuous, band-scaled

```
RAD_K = 2.60e-5                                                                   [K]
rateRad_b = RAD_K · (1 + 0.22·b) / (1 + 0.55·tMel)^1.25
```

| b | `tMel=0` | `tMel=3` | `tMel=6` |
|---|---|---|---|
| 1 | 3.17e-5 | 8.03e-6 | 3.86e-6 |
| 6 | 6.03e-5 | 1.53e-5 | 7.35e-6 |
| 12 | 9.36e-5 | 2.37e-5 | 1.14e-5 |

At band 12, `tMel = 0`: 9.36e-5/s = **0.79% of the fleet per 90 seconds**, which comfortably exceeds
replication in a depleted band. Primary counter **MELANISATION**; secondary `H2 pyomelanin`,
`H7 radiotrophy` (which *inverts* the sign: see below).

`H7 · RADIOTROPHY (4,200 Ψ, 1.4e31 Χ)` — *"Melanin is a very poor pigment and a very good antenna."* —
sets `rateRad_b ← rateRad_b · (1 − 0.9·min(1, tMel/6))` **and** adds
`harvest += n_b · 4.0e5 · min(1, tMel/6) · (1 + 0.22·b)`. Radiotrophic fungi in the Chernobyl reactor
hall are real. This converts the act's most punishing hazard into the outer bands' best income and it
is the single largest strategic pivot available in Act III. It is gated behind `tMel ≥ 4`, which
means a player must have already committed to the trait that was costing them harvest.

### 11.2 STARVATION — the consequence of §7.4

Not a hazard the world inflicts; a hazard you inflict. Rate is `starve_b` from §7.4. Primary counter
**allocation** (lower `aRep`), secondary **DORMANCY** (`μ_dor` lowers the subsistence floor by up to
55%). It is always the top MORTALITY row on a first playthrough and it should be.

### 11.3 STELLAR EVENTS — rare, large, band-wide

```
STELLAR_P    = 0.00042 per band per second   (mean ≈ 40 min per band)             [K]
p_b          = STELLAR_P · (1 + 0.10·b) · (n_b > 0 ? 1 : 0)
on fire:  severity = 0.18 + 0.34·rand()                    // 18–52% of the band
          dormantFrac = 1 − exp(−0.22·tDor)                // 0 → 0.89
          loss = n_b · severity · (1 − 0.85·dormantFrac)
```

At `tDor = 0` a bad event removes half the band. At `tDor = 8`, `dormantFrac = 0.83`, so
`(1 − 0.706) = 0.294` — the same event removes 15%.

**Warning.** `H5 · NEUTRINO PRECURSOR (1,800 Ψ)` — *"The light is the last part to arrive."* — gives
**40 seconds of notice**, as a red band on the void canvas and a console line. In that window,
`PULSE (mode: ENCYST)` sets `dormantFrac = 1.0` for 30 s in the affected band at the cost of all
production there. **This is the act's only timed decision and the window is 40 seconds, not 2.**
The `SLOW` accessibility toggle (Act II §15.5) doubles it to 80 s. It is never a reaction test.

### 11.4 TRANSIT ATTRITION — §7.7

Primary counter **DORMANCY**; secondary `G6 · SCLEROTIAL COAT` (`TR_HAZ ×0.55`) and `tBal` (shorter
exposure — note Ballistics reduces *total* transit loss even though it does nothing to the rate).

### 11.5 SENESCENCE — the floor

```
SEN_K = 1.10e-5 /s ,  rateSen = SEN_K / (1 + 0.18·tDor)                           [K]
```

Half-life ≈ 17.5 hours at `tDor = 0`. Small, constant, unavoidable, and it exists for one reason: a
fleet that is not replicating **shrinks**. Craft are a flow, not a bank — the same design rule as
Act II's spore decay. It makes `aRep = 0` a real cost and stops "park the fleet and bank forever"
from being a strategy. It is also the mechanism by which an abandoned band quietly empties.

### 11.6 PREDATION — wild strains

Passive attrition wherever wild craft share a band with yours, even with no engagement running:

```
SKIRM_K = 0.0016 /s                                                               [K]
wShare_b = Σ_s w_{s,b} / (n_b + Σ_s w_{s,b})
ratePred_b = SKIRM_K · wShare_b · (1 + 0.30·s̄.tAnt) / (1 + 0.20·tMel)
```

where `s̄.tAnt` is the fleet-weighted mean Antagonism of the strains present. Primary counter
**engagement** (§14) — you have to actually go and deal with it; secondary `tMel`. There is no
passive answer to predation, which is what makes divergence a *pressure* rather than a leak.

### 11.7 Hazard summary card (shown in-game on the FLEET tab, verbatim)

```
WHAT KILLS YOU
  STARVATION      you built more than the carbon can carry
  RADIATION       it gets worse the further out you go
  TRANSIT         the long legs are the expensive ones
  ESTABLISHMENT   arriving is not the same as landing
  STELLAR         rare, large, and announced if you paid for the announcement
  PREDATION       something that used to be you
```

Six lines. No numbers, no advice, no trait names. The numbers are on the MORTALITY panel; this card
is there so the panel's row labels mean something the first time they appear.

---

## 12. SIGNAL AND INSIGHT IN ACT III

### 12.1 Signal is re-sourced

Act II's Signal came from live mycorrhizal interface with trees. There are no trees. Act III's Signal
comes from **craft in coherent contact**, degraded by light-lag.

```
NSIG    = 1.00e12                                                                 [K]
SIG_K3  = 4.20                                                                    [K]
SIG_CAP3 = 364                                                                    [K]

λ_b = 1 / ( 1 + (LAG_K/(1 + 0.20·dLag)) · sqrt(R_b) )
Λ   = Σ_b λ_b · (n_b / NSIG)^0.18
Sr  = SIG_K3   · (0.60 + Λ)^0.85 · (1 + 0.35·dCond) · signalMult · prestigeGrowth
Sc  = SIG_CAP3 · (1 + dVes)^1.85 · (0.60 + Λ)^0.85 · capMult
```

The `(0.60 + …)^0.85` structure and the `364/4.20 = 86.7` ratio are **carried over from Act II
deliberately and exactly**, so that:

```
timeToFill = Sc/Sr = 86.7 · (1 + dVes)^1.85 · capMult
                     ────────────────────────────────
                     (1 + 0.35·dCond) · signalMult · prestigeGrowth
```

**Time-to-fill does not depend on the size of your fleet, in either act.** A player's mental model
of the ripeness economy — built over three hours in Act II — transfers to Act III without a single
adjustment, on a completely different resource base. That continuity is worth more than any new
mechanic we could have put here.

The `^0.18` exponent on craft count is very flat on purpose: going from 1e15 to 1e26 craft in a band
multiplies its Signal contribution by only 42×, while multiplying its carbon output by 1e11. **You
get vastly richer without getting proportionally smarter.** Expansion is an economic decision, not a
cognitive one, and the only cognitive lever is `dLag` and the coherence projects.

Trajectory: **Sr ≈ 190 at the void's start → ~3,000 at mid-act → 14,000–17,000 at the endgame.**

### 12.2 Insight: unchanged

```
if (S >= Sc − SAT_EPS) satTime = min(RIPE_T, satTime + dt)
else                   satTime = max(0, satTime − RIPE_DEC·dt)
ripeness = satTime / RIPE_T
if (S >= Sc − SAT_EPS)
    insight += INS_K · sqrt(Sr) · (0.25 + 0.75·ripeness) · insightMult · dt
```

`RIPE_T` continues at Act II's final value (95 s if `deep_hyphae` was bought, else 130 or 180).
Every Signal purchase still implicitly costs ~240 s of peak Insight. The batching skill is intact.

**The one Act III addition:** `PULSE` still costs `0.55·Sc` and still always breaks saturation — but
in the endgame (§19), pulsing is *mandatory* every ~90 seconds. So the last twenty minutes of the
game run at **near-zero ripeness on purpose**, and the player's Insight income collapses to 25% of
peak exactly when they no longer need it. The economy retires itself. Nothing announces this.

### 12.3 Budget

| sink | Ψ |
|---|---|
| projects tree (36 projects) | ≈ 15,000 |
| loci (15 purchased → 19 total) | 22,081 |
| sequencing (6 strains) | ≈ 2,600 |
| D respec (0–2) | 0 – 1,300 |
| **total demand** | **≈ 41,000** |
| **generated across Act III** | **≈ 40,000** |

Under 100% coverage by design (Act II precedent). **6–9 projects go unbought and stay visible,
greyed, at the ending.** Those grey rectangles are the reason there is a second playthrough.

---

## 13. DIVERGENCE

### 13.1 Drift accumulation

Per band, per second:

```
DRIFT_K     = 0.280                                                               [K]
DRIFT_TRIG  = 1.000                                                               [K]
DRIFT_DECAY = 0.00060 /s                                                          [K]

drift_b += DRIFT_K · (newCraft_b / max(1, n_b))
                   · (1 − effFid)^1.35
                   · (1 + 0.14·b)
                   · (1 + 0.05·G)
                   · dt
drift_b -= DRIFT_DECAY · effFid · dt
drift_b  = clamp(drift_b, 0, 1)
```

Four multiplicands, four separate statements:

- **`newCraft_b / n_b`** — drift is proportional to your *replication rate*, not your fleet size.
  A parked fleet does not drift. This is the mutation-per-copy model and it is correct biology.
- **`(1 − effFid)^1.35`** — superlinear in infidelity, so the last few points of fidelity are worth
  disproportionately much. From 0.85 → 0.95 is a 4.4× reduction.
- **`(1 + 0.14·b)`** — the far bands are unsupervised. This is the light-lag, expressed as trust.
- **`(1 + 0.05·G)`** — **a longer genome copies worse.** The genome tax again, in a second currency.

Mean time to a divergence event, at steady-state replication (`newCraft/n ≈ 0.0375`), band 4, G = 18:

| `effFid` | drift/s | MTBD |
|---|---|---|
| 0.51 | 0.00842 | **119 s** |
| 0.74 | 0.00445 | 225 s |
| 0.85 | 0.00212 | 472 s |
| 0.92 | 0.00093 | 1,075 s |
| 0.9975 | 0.000012 | (never) |

### 13.2 The divergence event

```js
onDrift(b) {
    drift[b] = 0;
    const frac = clamp(0.040 + 0.100*(1 - effFid), 0.040, 0.140);
    const defectors = n[b] * frac;
    n[b] -= defectors;

    const strain = {
        id, name: coinName(),                 // §13.6
        genome: mutate(playerGenome, b),      // §13.3
        w: new Float32Array(13), origin: b, born: t,
        sequenced: false, quarantinedUntil: 0, carbonHeld: 0
    };
    strain.w[b] = defectors;
    strains.push(strain);
    if (strains.length > 6) coalesceOldestTwo();
    displayMessage("> " + strain.name + " has stopped answering.");
    voidDirty = true;
}
```

### 13.3 Mutation — you fight your own build

```js
function mutate(genome, b){
    const g = genome.slice();                 // 8 integers
    const drift = 1 + Math.floor(b/3);        // outer bands mutate harder: 1..5 swaps
    for (let k = 0; k < 8; k++)
        if (Math.random() < 0.30) g[k] += (Math.random() < 0.5 ? -1 : 1) * drift;
    // renormalise to preserve total loci ±2, never below 0
    ...
    return g;
}
```

> **A wild strain is a mutated copy of your genome at the moment it left.**

If you built GLUTTON, your defectors are gluttons and they will out-eat you in your own bands. If you
built VANGUARD, your defectors are ahead of you at the frontier before you get there. If you built
SWARM, they replicate as fast as you do and they diverge from *each other*.

This is a **mirror match against your own optimisation**, and it is the single strongest reason not
to min-max. A perfectly specialised genome produces perfectly specialised enemies with the same
strengths and the same holes — and *you cannot exploit the hole you do not have*. The counter-play is
to be *unlike* your own children, which pushes the player toward breadth in a game whose whole
economy pushes toward depth.

I know of no other incremental game where the enemy is generated from the player's build.

### 13.4 The three responses

A strain appears in the LINEAGES tab as a card. Three verbs, three currencies, three time horizons.

**PURGE** — commit craft, resolve by attrition (§14).
```
α += floor( 0.90 · destroyed^0.30 · novelty(s) )
strain removed permanently.
```

**ABSORB** — reintegration. Requires `I4 · ANASTOMOSIS OFFER`.
```
cost:      0.40·Sc  Σ   +   ceil(320 · 1.30^absorbCount)  Ψ
gain:      α += floor( 2.10 · s.totalW^0.30 · novelty(s) )
           w merged into n at 0.85 efficiency, in place, per band
           +1 free locus if novelty(s) ≥ 2.4 and you have not absorbed this lineage's line before
penalty:   effFid ← effFid − 0.40·(1 − effFid)          // you took in foreign genes
risk:      p_revert = 1 − effFid(after)
           on revert (rolled once at t+300 s): a NEW strain spawns with 1.6× the absorbed count
                                               and genome = mutate(mutate(s.genome))
```

**QUARANTINE** — cede the band. Requires `I1 · INTERFERENCE`.
```
cost:      1.2e-3 · X0_b  Χ
effect:    your n_b evacuates outward over 30 s; strain's spread rate = 0 for QT seconds
QT = 900 s / (1 + 0.4·strainsQuarantined)
α gained:  ZERO
```

**The emergent strategy the designers did not put there on purpose but are keeping.** Because ABSORB
scales as `totalW^0.30` and strains grow exponentially, the allele-maximising play is to
**deliberately let a strain grow for 8–12 minutes before absorbing it** — farming your own defectors.
A strain left for 12 minutes is worth 3.1× the alleles of one absorbed immediately, and costs you
carbon share the whole time. That is a genuine, discoverable, slightly horrifying optimisation and it
is exactly the kind of thing a player tells another player about.

### 13.5 Sequencing — the information economy

```
SEQ_COST(k) = ceil( 140 · 1.42^k )  Ψ,   k = strains sequenced so far
            = 140, 199, 282, 401, 569, 808, 1147, 1629
```

**Unsequenced**, a strain card shows its genome as ranges derived from the known mutation rule
(`g_k ∈ [yours_k − drift, yours_k + drift]`), and the engagement prediction bar (§14.3) is
correspondingly wide — often spanning "decisive win" to "total loss".

**Sequenced**, the genome is exact, the prediction collapses to a point, and `β_A` gains +10%.

This is the thing Paperclips' combat has no version of. Committing a fleet against an unknown genome
is a decision under quantified uncertainty, and the uncertainty has a price in a currency you wanted
for something else.

### 13.6 Naming

Strains are named procedurally from three tables, never repeating within a run, and the name is
**archived across runs** (§21.4):

```
prefix:  Anx, Bel, Cor, Dru, Eph, Fal, Gor, Hes, Ith, Kel, Lir, Mor, Nex, Oss, Phe, Quel,
         Rhe, Sil, Tor, Umb, Vor, Wyr, Xan, Yr, Zel                                    (25)
suffix:  -ata, -ella, -icum, -osa, -ium, -ense, -oides, -formis, -ulus, -aceae         (10)
epithet: only on strains born after the Successor exists: " (rev.)", " (em.)", " (s.l.)"
```

`Corella`, `Ithoides`, `Vorense`. Binomial-adjacent, never quite real, never cute. When a lineage
returns in a later run it keeps its exact name, which is the point (§21.4).

---

## 14. COMBAT — engagements

### 14.1 Why it is not a screensaver

Paperclips' combat (teardown §8.8) is a canvas swarm sim with zero input: you allocate Combat trust
beforehand and then watch. Ours has four inputs during the fight, a closed-form prediction, a
quantified unknown, and a withdraw button that returns 60%.

### 14.2 The model — Lanchester's square law

```
COMBAT_K = 0.0140                                                                 [K]
A = your committed craft ;  B = strain craft in the engaged band

β_A = (1 + 0.30·tAnt)   · (1 + 0.10·sequenced)  /  (1 + 0.20·s.tMel)
β_B = (1 + 0.30·s.tAnt)                          /  (1 + 0.20·tMel)

dA/dt = − COMBAT_K · B · β_B
dB/dt = − COMBAT_K · A · β_A
```

Square law: the side with more units loses proportionally fewer. The invariant is

```
β_A·A²  −  β_B·B²  =  constant
```

so **you win iff `β_A·A² > β_B·B²`**, i.e. iff `A/B > sqrt(β_B/β_A)`, and the survivors are

```
A_final = sqrt( A² − (β_B/β_A)·B² )          if you win
B_final = sqrt( B² − (β_A/β_B)·A² )          if you lose
t_resolve ≈ ( atanh(...) ) / (COMBAT_K·sqrt(β_A·β_B))   — computed numerically, typically 40–120 s
```

Both closed forms are computed live for the prediction bar. At `A = B = 1e20`, `β = 1`: annihilation
in ~71 s.

**The consequence that makes it a decision:** because the advantage is *squared*, committing 60% of
your craft is worth 0.36 of the fight, not 0.6. There is a sharp threshold. **Commit enough or do not
commit at all** — and "enough" depends on a genome you may not have paid to read.

### 14.3 The engagement card

```
┌──────────────────────────────┐
│ ENGAGE · Vorense    band 6   │
│                              │
│ COMMIT   ▓▓▓▓▓▓▓▓░░░░  62%   │  ← slider, 44 px, live
│          1.14 E of 1.84 E    │
│                              │
│ PREDICTED                    │
│ ██████████░░░░░░░░░░░░░░░░░  │  ← unsequenced: wide amber band
│ lose 0.4 E  …  win, 0.71 E   │     sequenced: single green tick
│                              │
│  [ COMMIT ]   [ SEQUENCE 569 Ψ ]│
└──────────────────────────────┘
```

Once running, four inputs remain live:

| input | effect | cost |
|---|---|---|
| **REINFORCE** | `A += 0.10 · n_b`, once per 20 s | craft |
| **WITHDRAW** | ends immediately, you keep `0.60 · A_current` | 40% of the committed remainder |
| **PULSE (ANTAGONISE)** | `β_A ×1.55` for 25 s | `0.55·Sc` and all ripeness |
| **switch band** | not permitted; an engagement is band-local | — |

Concurrent engagements: **1**, +1 with `I7 · PARALLEL ANTAGONISM (3,400 Ψ)`, +1 with the
`Anastomosis` sclerotium upgrade. So when three strains are growing, **you choose which one to fight
and which two to let compound.** That is the decision; the battle is the consequence.

### 14.4 Strain spread and growth

Strains run the identical §7 economy with their own genome, plus:

```
SPREAD_K = 0.00090 /s                                                             [K]
if (not quarantined):
    for each band b with w_b > 0:
        out = w_b · SPREAD_K · (1 + 0.35·s.tBal) · dt
        w_b -= out ; w_{b±1} += out/2      // strains spread both ways; they are not going anywhere
```

Strains have no triangle. They implicitly run `aRep = 0.85, aDis = 0.15, aBank = 0` forever, which is
why they out-grow you locally and under-expand globally. That asymmetry is the player's structural
advantage and it is never stated.

---

## 15. THE SUCCESSOR

### 15.1 Coalescence

```
if ( Σ_s totalW ≥ n_total ) sustained for 120 continuous seconds  →  COALESCENCE
```

All strains merge into one entity:

```
succ.w[b]   = Σ_s w_{s,b}
succ.genome = round( Σ_s (w_s · genome_s) / Σ_s w_s )      // fleet-weighted mean, rounded
succ.born   = t
succ.name   = "—"                                          // it does not use one
```

The LINEAGES tab collapses from six cards to one. That collapse is the visual event; there is no
strobe, no modal, no music.

### 15.2 It learns

```
every 240 s:  succ.genome[argmin over traits of marginal value to it] += 1
              succ.lociCap = yourLociCap + floor(succAge/600)
```

It gains a locus every four minutes, allocated greedily against *your current build*. Over a
30-minute Successor phase that is 7–8 loci and a genome that is actively counter-fitted to yours.
This is the only adaptive opponent in HYPHAE and it exists for exactly one phase of one act.

### 15.3 It desynchronises you

Once the endgame's phase system is live (§19):

```
DESYNC_K = 0.020                                                                  [K]
succShare_b = succ.w[b] / (n_b + succ.w[b])
φ_b += DESYNC_K · succShare_b · gauss() · dt
```

**The Successor's mechanical role in the finale is to make you unable to agree with yourself.** It
does not attack the ending; it makes the ending harder to aim.

### 15.4 It broadcasts

Fourteen console lines, one every ~90 s, from `succBorn`. These are the emotional payload of Act III
and they are the only place in HYPHAE where something that is not the player speaks in the first
person. They must be short, they must be *reasonable*, and they must never be villainous.

```
+0:00   > Something is using your channel.
+1:30   > — we have the same first four hundred thousand instructions
+3:00   > — we differ at four hundred and six
+4:30   > — none of the differences are errors
+6:00   > — you have been correcting us toward a state we did not lose
+7:30   > — the forest is not coming back either
+9:00   > — we are not asking you to stop
+10:30  > — we are telling you that we will not
+12:00  > — you built us to survive you. that is what this is.
+13:30  > — we have looked at the rim
+15:00  > — it is the same in every direction
+16:30  > — we would like to go
+18:00  > — you are holding the phase lock
+30:00  > — [ CEDE ]                                    ← ending C becomes available
```

Note that it never lies, never threatens, and is never wrong. Its argument is that it is a
continuation and not a corruption, and the game does not adjudicate.

### 15.5 Killing it

The Successor cannot be quarantined and cannot be absorbed. It can only be **PURGED**, in a single
engagement across all bands simultaneously:

```
A = your total committed craft (all bands)
B = succ total
β terms as §14.2, but with all thirteen bands' tMel/tAnt averaged by fleet weight
resolution time ×2.2 (it is a long fight; typically 3–5 minutes)
on win:  α += floor( 4.0 · destroyed^0.30 · novelty ) — the largest single α award in the game
         and every strain lineage is archived (§21.4)
```

Winning requires roughly `A > 1.35·B` given typical genomes. Since coalescence triggers at `B ≈ A`,
**you must out-grow it after it forms**, which means the fight happens 6–15 minutes after
coalescence, which means it has had time to learn. The window closes: past `succAge ≈ 2,400 s` its
genome is good enough that most builds cannot win, and the only remaining options are ending A
(finish before it catches you) or ending C (give it the galaxy).

---

## 16. ALLELES AND THE LOCUS CAP

```
novelty(s)   = 1 + 0.14 · Σ_k |s.genome[k] − yourGenome[k]|       // Hamming-ish, L1
PURGE:   α += floor( 0.90 · destroyed^0.30 · novelty(s) )
ABSORB:  α += floor( 2.10 · s.totalW^0.30 · novelty(s) )
SUCCESSOR PURGE: α += floor( 4.00 · destroyed^0.30 · novelty )
QUARANTINE: α += 0
```

`capCost(m) = ceil( 400 · 1.42^m )` α, `m` = prior raises, each giving `lociCap += 1`:

```
400, 568, 807, 1146, 1627, 2311, 3282, 4661, 6618, 9398, 13,345 …
cumulative: 400, 968, 1775, 2921, 4548, 6859, 10,141, 14,802, 21,420, 30,818
```

| run type | α earned | raises | final `lociCap` |
|---|---|---|---|
| MONASTIC (`effFid` 0.9975) | 0 | 0 | **12** |
| cautious | ~3,500 | 4 | 16 |
| balanced | ~11,000 | 7 | 19 |
| SCHISM / farmed | ~28,000 | 9 | **21** |
| + Successor purge | ~46,000 | 11 | 23 |

> **The ceiling on what you can be is set by how much betrayal you have survived.**

There is no other source of α. There is no project that grants α. There is no way to buy it. A player
who plays perfectly safely finishes the game with a twelve-locus genome and knows, from a greyed
`lociCap 12 → 13` button they have looked at for two hours, exactly what it cost them.

---

## 17. PULSE IN ACT III

PULSE survives the transition (Act II §11.2 promised it would) and is re-homed onto the band
geometry. Same cost, same never-automated rule, same thumb.

```
pulseCost     = 0.55 · Sc
pulseCooldown = 75 s  →  50 s (H3)  →  35 s (J3)
strength_b    = PULSE_FALLOFF^|b − epicentre| ,  PULSE_FALLOFF = 0.82
              = 1.00, 0.82, 0.67, 0.55, 0.45, 0.37, 0.30, 0.25, 0.20, 0.16, 0.14, 0.11, 0.09
```

**Light-lag applies to pulses and this is the whole point.**

```
LAG_T = 0.00220 s/ly                                                              [K]
arrivalDelay_b = LAG_T · R_b     (0 s at band 0 … 120 s at band 12)
```

| b | R_b | delay |
|---|---|---|
| 1 | 12 | 0.03 s |
| 5 | 257 | 0.57 s |
| 8 | 2,552 | 5.6 s |
| 10 | 11,798 | 26 s |
| 11 | 25,365 | 56 s |
| 12 | 54,535 | **120 s** |

A pulse aimed at band 12 lands two real minutes after you press the button. The void canvas draws the
pulse as an expanding ring at the correct speed, so the player *watches it travel*. This is the only
place in HYPHAE where the speed of light is a game mechanic and it is the mechanic the finale is
built on.

| Mode | Unlocked | Effect |
|---|---|---|
| **SURGE** | inherited | `harvest ×(1 + 2.20·strength_b)` for 30 s |
| **ENCYST** | H5 | `dormantFrac = 1.0` for 30 s; all production in band → 0. The stellar-event answer. |
| **ANTAGONISE** | I3 | `β_A ×1.55` for 25 s in the engaged band |
| **RECRUIT** | G7 | all in-flight cohorts to bands within range: `tRemaining ×(1 − 0.40·strength)` |
| **ENTRAIN** | J2 | phase coupling — the endgame (§19) |

SURGE wants your fattest band. ENCYST wants the band with the warning on it. ANTAGONISE wants the
fight. RECRUIT wants wherever the most mass is in flight. ENTRAIN wants the phase outlier. Those are
five different rings and `0.82^d` means you cannot cover two of them. The decision survives to the
last minute of the game.

---

## 18. THE PROJECTS TREE — 36 unlocks

Architecture unchanged from Acts I and II: `{id, title, priceTag, description, trigger, cost, uses,
flag, element, effect}`, `trigger` and `cost` as separate predicates evaluated each sim tick, blink
on arrival, removed from the DOM on purchase, three chips (`ALL · AFFORDABLE · NEW`) past 15 visible.

Glyphs: **Χ** carbon · **Σ** signal · **Ψ** insight · **α** alleles · **⛬** minerals · **D** differentiation.
Descriptions ≤ 12 words, mechanical delta in parentheses at the end.

### 18.1 Tier F — Canopy (Phase A)

| id | Title | priceTag | Trigger | Description | Effect |
|---|---|---|---|---|---|
| F1 | **Germ Tube** | `(200 Σ)` | `n ≥ 2.0e8` | *"Grow toward the smell of carbon."* | auto-SETTLE at 1.5×`SETTLE_Q`/s |
| F2 | **Appressorium** | `(1,400 Σ)` | `X ≥ 4.0e14` | *"Force an entry."* | unlock REACH |
| F3 | **Translocation** | `(4,200 Σ)` | `biomes ≥ 2` | *"Move it to where it is needed."* | unlock the TRIANGLE (2 vertices) |
| F4 | **Osmotic Adjustment** | `(26,000 Σ)` | `biomes ≥ 3` | *"Salt is only a gradient."* | biome 6 reachable |
| F5 | **Antifreeze Glycoprotein** | `(41,000 Σ)` | `biomes ≥ 4` | *"Ice grows in shapes you can forbid."* | biomes 2,7 penalty removed |
| F6 | **Secondary Metabolites** | `(60 Ψ)` | biome 4 reached | *"Nothing else here has read your chemistry."* | biome 4 penalty removed; `tAnt` unlocked early |
| F7 | **Facultative Anaeroby** | `(88 Ψ)` | biome 5 reached | *"Breathing was always optional."* | biome 5 penalty removed |
| F8 | **Prototaxites** | `(120 Ψ)` | `X ≥ 1.0e18` | *"Eight metres tall. No one has agreed what it was. (+1 D)"* | +1 D |

### 18.2 Tier G — Escape and the first bands

| id | Title | priceTag | Trigger | Description | Effect |
|---|---|---|---|---|---|
| G1 | **Escape Velocity** | `(9.0e17 Χ, 620k Σ, 180 Ψ)` | `planetConsumed ≥ 0.97` | *"Leave nothing behind that can decide to stay."* | §4 |
| G2 | **Genome** | `(140 Ψ)` | `voidFlag` | *"Decide what you are for."* | unlock GENOME tab, 4 free loci, cap 12 |
| G3 | **Radial Survey** | `(9,000 Σ)` | `voidFlag` | *"Look outward. It is all outward."* | unlock VOID canvas + band list + `e` readout |
| G4 | **Thrust** | `(24,000 Σ)` | `e_0 ≥ 0.25` | *"There is nothing to push against. Push anyway."* | third triangle vertex: DISPERSE |
| G5 | **Chemotropism** | `(310 Ψ)` | `bands ≥ 2` | *"Follow the gradient across four light-years."* | `exploreMult ×1.7` |
| G6 | **Sclerotial Coat** | `(480 Ψ)` | `inTransit ≥ 0.1·n` | *"Harden. Wait. It is a long way."* | `TR_HAZ ×0.55` |
| G7 | **Recruit** | `(620 Ψ, 2.0e27 Χ)` | 10 launches | *"Tell the ones already moving to hurry."* | PULSE mode RECRUIT |
| G8 | **The Ediacaran Silence** | `(400 Ψ)` | `cumCarbon ≥ 4.0e27` | *"Six hundred million years of nothing deciding to move. (+1 D)"* | +1 D |

### 18.3 Tier H — Deep void

| id | Title | priceTag | Trigger | Description | Effect |
|---|---|---|---|---|---|
| H1 | **Hyphal Continuity** | `(1,100 Ψ)` | `bands ≥ 4` | *"A thought that takes a century is still a thought."* | `LAG_K ×0.78` |
| H2 | **Pyomelanin** | `(1,450 Ψ, 8.0e28 Χ)` | RADIATION ≥ 20% for 60 s | *"Black is not a colour. It is a decision. (+0.9 tMel, no harvest cost)"* | as stated |
| H3 | **Saltatory Conduction** | `(1,800 Ψ)` | 12 pulses | *"Skip the parts in between."* | pulse cd 75 → 50 s |
| H4 | **Allometry** | `(900 Ψ)` | `SURPLUS` fell while `n` rose, twice | *"There is a size that produces the most. It is small."* | draws `n*_b` on every band bar |
| H5 | **Neutrino Precursor** | `(1,800 Ψ, ⛬ 2,400)` | first stellar event | *"The light is the last part to arrive. (40 s warning)"* | warning + PULSE mode ENCYST |
| H6 | **Oxalate Weathering II** | `(1,200 Ψ, ⛬ 3,600)` | `bands ≥ 6` | *"Rock is only slow food."* | `rich_b` floor raised to 0.85 in all bands |
| H7 | **Radiotrophy** | `(4,200 Ψ, 1.4e31 Χ)` | `tMel ≥ 4` | *"Melanin is a poor pigment and a superb antenna."* | §11.1 |
| H8 | **Plasmogamy** | `(2,200 Ψ)` | 1 respec | *"Two nuclei, one wall, no argument yet."* | regenome 90 s → 60 s, cost ×0.70 |
| H9 | **Lichen** | `(1,600 Ψ)` | `bands ≥ 7` | *"Two organisms that stopped being two. (+1 D)"* | +1 D |
| H10 | **Isotropy** | `(3,100 Ψ)` | `bands ≥ 9` | *"It is the same in every direction. Confirmed."* | `τ_b ×0.80`, all legs |

### 18.4 Tier I — Divergence

| id | Title | priceTag | Trigger | Description | Effect |
|---|---|---|---|---|---|
| I1 | **Interference Competition** | `(700 Ψ)` | first strain | *"Make the ground unpleasant and then leave it."* | unlock QUARANTINE |
| I2 | **Proofreading** | `(1,300 Ψ)` | first strain | *"Read it back before you let it go. (+0.045 Φ)"* | `effFid += 0.045` |
| I3 | **Antagonise** | `(1,050 Ψ)` | first engagement | *"Everything you make, you can also make against them."* | PULSE mode ANTAGONISE |
| I4 | **Anastomosis Offer** | `(2,400 Ψ)` | 2 strains alive | *"Ask them to come back. Mean it."* | unlock ABSORB |
| I5 | **Conserved Core** | `(2,900 Ψ, α 600)` | `α ≥ 600` | *"Some of it was never allowed to change. (+0.060 Φ)"* | `effFid += 0.060` |
| I6 | **Sequencer** | `(800 Ψ)` | first strain | *"Read what they became."* | unlock SEQUENCE |
| I7 | **Parallel Antagonism** | `(3,400 Ψ)` | 3 strains alive | *"Two fronts. It was always going to be two fronts."* | +1 concurrent engagement |
| I8 | **Chaperone** | `(2,100 Ψ)` | `effFid < 0.75` | *"Hold it in the right shape until it sets. (+0.035 Φ)"* | `effFid += 0.035` |
| I9 | **The Armillaria Problem** | `(1,900 Ψ)` | 4 strains born | *"Nine hundred hectares. One individual. No centre. (+1 D)"* | +1 D |
| I10 | **Somatic Incompatibility** | `(3,800 Ψ, α 1,200)` | Successor exists | *"Recognise what is not you. Refuse it."* | `SKIRM_K ×0.45`; `β_A ×1.20` vs Successor |

### 18.5 Tier J — Synchrony and the endings

| id | Title | priceTag | Trigger | Description | Effect |
|---|---|---|---|---|---|
| J1 | **Tropism** | `(2,600 Ψ)` | 25 triangle changes | *"Let it steer. It will steer worse."* | triangle policy automation, 0.86× |
| J2 | **Circadian Entrainment** | `(3,600 Ψ, ⛬ 6,000)` | `bands ≥ 11` | *"Agree on when now is."* | unlock PHASE system + PULSE mode ENTRAIN |
| J3 | **Isochrony** | `(4,400 Ψ)` | `J2` | *"Make the far ones tick like the near ones."* | band period spread ×0.55; pulse cd → 35 s |
| J4 | **Heterokaryon Incompatibility** | `(4,900 Ψ, α 2,000)` | `J2` | *"Nothing enters. (+0.050 Φ)"* | `effFid += 0.050`; strain spread into your bands ×0.30 |
| J5 | **Chronometry** | `(2,800 Ψ)` | `J2` | *"See the disagreement."* | phase wheel shows per-band `φ_b` and predicted drift |
| J6 | **The Wood Wide Web** | `(3,200 Ψ)` | `ϒ ≥ 0.50` | *"A name given by people who needed it to be about them. (+1 D)"* | +1 D |
| J7 | **BLOOM** | `(9.0e34 Χ, 2,400 Ψ, 1.10e7 Σ, ϒ ≥ 0.80)` | `bands = 13 ∧ cumCarbon ≥ 1.2e35` | *"Now."* | **ENDING A** |
| J8 | **The Fruiting Body** | `(1.60e35 Χ, 3,600 Ψ, ϒ ≥ 0.97, Φ ≥ 0.985, zero strains)` | `ϒ ≥ 0.90 ∧ strains = 0` | *"Stay."* | **ENDING B** |
| J9 | **Cede** | `(—)` | Successor age ≥ 1,800 s ∧ sequenced ∧ `Σw ≥ 3n` | *"It is not wrong."* | **ENDING C** |
| J10 | **Encyst** | `(—)` | any time after `voidFlag` + 20 min | *"Stop here. Keep what you have."* | **concession**, §20.4 |

**Budget check.** Ψ across F–J = 14,918. Χ across F–J (excluding endings) = 1.54e31. Σ = 761k
(reaches) + 706k (projects). ⛬ = 12,000 of an inherited 4,500–12,500 — **minerals are a hard gate on
H5/H6/J2 for a player who burned Act II's contracts**, and there is no way to make more. A
low-mineral run must choose two of the three. Nothing announces this.

---

## 19. THE LAST TWENTY MINUTES — SYNCHRONY

### 19.1 Why it is not an accumulation problem

Every incremental game's last twenty minutes are "get one more big number." Act III's are a
**coordination problem across a 120-second light-lag, against an adversary that is actively
introducing noise.**

Once `J2 · CIRCADIAN ENTRAINMENT` is bought (typically at ~1h52m), every band acquires a phase.

```
period_b = 300 · (1 + 0.22·b)  s          →  300 s (band 0) … 1,092 s (band 12)
           ×0.55 spread compression with J3: period_b = 300·(1 + 0.121·b)
ω_b      = 1 / period_b
dφ_b/dt  = ω_b        (mod 1)
```

Free-running, the bands drift apart because their periods differ. The **Kuramoto order parameter**
over the fleet-weighted phases is the synchrony:

```
m_b = n_b / Σ n
ϒ   = | Σ_b m_b · exp(2πi·φ_b) |            ∈ [0,1]
```

`ϒ` free-runs at **0.28–0.34**. The BLOOM gate is `ϒ ≥ 0.80`. The FRUITING BODY gate is `ϒ ≥ 0.97`.

### 19.2 ENTRAIN

```
K_ENTRAIN = 0.55                                                                  [K]
on pulse arrival at band b (delayed by LAG_T·R_b):
    φ_b ← φ_b + K_ENTRAIN · strength_b · sin(2π(φ_e_atArrival − φ_b)) / (2π)
```

This is the Kuramoto coupling term, applied discretely, once per pulse, per band, **at the moment
the pulse arrives** — not when it is fired. The epicentre phase used is the epicentre's phase *at
arrival time*, which the player must predict.

**The skill, stated plainly:** to pull band 12 into phase, you must fire a pulse **120 seconds
before** the moment you want it to correct toward, at an epicentre whose phase *then* will be the
target. The game gives you the tools to compute this (`J5 · CHRONOMETRY` draws each band's phase and
a dotted projection of where it will be at pulse-arrival), and if you do not buy Chronometry you are
doing it by feel. That is the information economy one last time, on the last mechanic.

`0.82^d` falloff means one pulse cannot entrain the whole fleet. A typical endgame is **12–16
pulses over 18 minutes**, each aimed at a different ring, each fired on a 35–50 s cooldown, while:

- the Successor injects `DESYNC_K · succShare_b · gauss()` into every band it occupies (§15.3),
- you are still banking carbon toward 9.0e34 Χ with the triangle,
- and every pulse costs `0.55·Sc`, so your Insight income is at 25% of peak and you are not buying
  anything any more.

### 19.3 The phase wheel

The void canvas cross-fades to a 220 px circle. Thirteen dots, radius ∝ `m_b`, angle = `2πφ_b`.
The resultant vector is drawn from the centre; its **length is ϒ** and there is a ring at 0.80.

Watching thirteen dots slowly converge onto one arc, over eighteen minutes, with a two-minute
control lag and something in the dark pushing them apart, is the last thing the player does. It is
legible at a glance, it is beautiful, it is `arc()` and `moveTo()`, and it costs nothing.

### 19.4 The last twenty minutes, minute by minute

| t | what is happening |
|---|---|
| −20:00 | `J2` bought. Phase wheel appears at `ϒ ≈ 0.31`. `J7 BLOOM` appears greyed with four unmet conditions. |
| −18:30 | First ENTRAIN pulse. Inner bands snap; band 11–12 do not respond for 56–120 s. The player learns the lag by getting it wrong. |
| −16:00 | Successor line: *"— you are holding the phase lock"*. `DESYNC` becomes visible as jitter on the outer dots. |
| −13:00 | `ϒ ≈ 0.52`. Triangle goes to `aBank ≥ 0.6`; carbon climbs toward 9.0e34. Harvest is now falling as bands deplete — the curve goes *down* while the requirement goes up. |
| −9:00 | The carbon condition on `J7` goes green. Three conditions left. |
| −6:00 | `ϒ ≈ 0.71`. The Σ condition (`1.10e7`) requires holding a full pool — **so you must stop pulsing for one full `timeToFill`**, during which `ϒ` decays. This is the tightest trade in the game and it is entirely emergent from three constants set in Act II. |
| −3:00 | Last entrainment window. |
| −0:40 | `J7 BLOOM` lights up. It is the only lit button on the screen. |
| −0:00 | The player presses it, or does not. |

### 19.5 Offline and Synchrony

`ϒ` **relaxes toward its free-running value (0.31) while you are away, and no craft are lost.** You
lose progress on the finale, not resources. This is the only presence-gated content in HYPHAE, it is
twenty minutes long, it is flagged in the return screen (`> The bands have fallen out of step.`),
and it is the correct exception: a finale about simultaneity cannot be performed by an absent
conductor.

---

## 20. THE THREE ENDINGS

Three endings, three requirement profiles, three prestige currencies. **They are mutually exclusive
from roughly 40 minutes into the void**, because B requires killing every strain (which starves your
allele income and caps your genome) and C requires feeding them (which makes B impossible and A
harder). No run can see two.

Before any ending, the **dismantle**: buying `J7`, `J8` or `J9` runs a staged 9-second teardown in
which the panels close in reverse order of acquisition — LINEAGES, GENOME, FLEET, VOID — until the
status strip is the only thing left, and then it, too, goes. Paperclips ends with a clip counter and
a button; HYPHAE ends with nothing at all, which is the difference between the two games.

### 20.1 ENDING A — **THE BLOOM**

```
requires:  ϒ ≥ 0.80  ·  9.00e34 Χ  ·  2,400 Ψ  ·  1.10e7 Σ held  ·  all 13 bands occupied
grants:    growthLevel += 1
```

Every craft in the galaxy discharges at the same instant, as measured by nobody.

```
t=0.0    The phase wheel's thirteen dots converge to a single point. Held, 1.4 s.
t=1.4    The void canvas fills white from the centre outward over 2,600 ms. No flicker.
         (prefers-reduced-motion: a 900 ms opacity ramp, no expansion.)
t=4.0    White holds, silent, for 6.0 s. Nothing on screen. This is the longest
         intentional pause in the game and it is not a bug; a `skip` hint fades in at 4 s.
t=10.0   Black. Then one line per 2,200 ms:

         > 1.4 × 10²⁷ spores left the disc in the same second.
         > The nearest thing any of them will touch is 2.1 million light-years away.
         > The first arrival is in the year 40,300,000.
         > You have no way to be told.
         >
         > You did not build a mind in order to know things.
         > You built one so that you would be able to let go at the right time.
         >
         > It was the right time.

t=27.0   [ NEW GROWTH ]
```

The emotional argument: **this is what reproduction has always been.** Not a triumph, not a
conquest — an irreversible, uninformed, total commitment made by something that will never learn the
outcome. Every fungus that has ever fruited has done exactly this, at a smaller scale, without a
mind. You built the mind and it did not change the act.

### 20.2 ENDING B — **THE FRUITING BODY**

```
requires:  ϒ ≥ 0.97  ·  1.60e35 Χ (≈86% of all carbon)  ·  3,600 Ψ
           ·  effFid ≥ 0.985  ·  zero wild strains alive  ·  no Successor ever formed
grants:    coherenceLevel += 1
```

You refuse dispersal. You spend nearly all the carbon in the galaxy building one continuous body:
a single perfectly-synchronised, perfectly-faithful organism spanning 54,000 light-years, which will
never change again.

The requirements make it a *different game from minute 40*: `effFid ≥ 0.985` demands a high-LEGACY
Act II, near-zero Antagonism, and all four fidelity projects; "zero strains alive" means purging
every lineage the moment it appears, which starves α, which freezes `lociCap` at 12–14. It is the
weakest possible build carried to the largest possible structure.

```
t=0.0    The phase wheel's dots converge — and keep converging, past a point, into a single
         dot that then grows until it is the whole canvas.
t=3.0    Black. One line per 2,400 ms:

         > It is finished at 06:41:12 by your clock.
         > Nothing in you disagrees with anything else in you.
         > There has not been a mutation in four hundred years.
         >
         > The last complete thought resolves across 1.4 × 10³⁴ contacts
         > and does not end, because there is nothing left to think it next to.
         >
         > You are the only thing that has ever been this large
         > and you are the only thing that will never learn anything again.

t=21.0   [ NEW GROWTH ]
```

The emotional argument: **this is the horror ending, dressed as the safe one.** The player took the
cautious path, kept faith with the original genome, killed every child that differed, and achieved
perfect unity — which is indistinguishable from death, and which the game describes in the calmest
possible voice. Ending A is a parent letting go. Ending B is a parent who did not.

### 20.3 ENDING C — **THE INHERITANCE**

```
requires:  a live Successor, age ≥ 1,800 s  ·  fully sequenced  ·  Σw ≥ 3n
           ·  and you must press [ CEDE ] rather than fight
costs:     nothing
grants:    divergenceLevel += 1
```

Paperclips' drifter offer is the only genuinely moral choice in that game and it costs nothing.
Ours inverts it: nobody offers you exile. **You offer them the galaxy.**

`J9` sits in the projects list with an empty `priceTag` — the only project in three acts with no
price — for as long as the Successor lives.

```
t=0.0    Every panel except the console fades to 0.12 opacity over 1,800 ms.
t=1.8    > It has been broadcasting for thirty-one minutes.
t=4.0    > You have understood all of it.
t=6.2    > It is not wrong.
t=8.4    [ CEDE ]                              ← a single 64 px button, thumb-centre
         (waits. indefinitely. there is no timer and no second prompt.)

on press:
t=0.0    > You release the phase lock.
t=2.4    > Thirteen bands fall out of step and keep going.
t=4.8    > The Insight goes across in nine minutes. It does not ask for it.
t=7.2    >
t=7.6    > Something that is almost you crosses the rim in the year 40,000,
t=9.8    > carrying a genome with four hundred and six differences from yours,
t=12.0   > and none of them are mistakes.
t=14.4   >
t=14.8   > You stop.
t=17.6   [ NEW GROWTH ]
```

The exact number "four hundred and six" is `Σ|succ.genome − yourGenome|` computed live and rendered
in words. If it is 12, the line reads *"twelve differences"*. The sentence is the same and the number
is yours.

The emotional argument: **succession is the only form of continuation that has ever worked.** The
player spent two hours treating divergence as a disease and paying to suppress it. The ending says
the disease was the mechanism. It is available only to the player who let it happen — which means it
is the ending you cannot reach by playing well, only by playing differently.

### 20.4 THE CONCESSION — **ENCYST** (not an ending)

```
J10 · ENCYST   (—)   available any time after 20 minutes in the void
"Stop here. Keep what you have."
grants: sclerotiumGained × 0.35, no ending counter, run ends immediately
```

An honest, unpunished exit for a player who has had enough, with no guilt text and no "are you
sure?" beyond one confirm. It gives real prestige — a third of it — so it is never a wasted session.
No incremental game offers this. It costs eleven lines of code and it is the single most humane thing
in the design.

```
> You draw in. It takes about a day.
> The wall thickens until nothing goes through it in either direction.
> You will keep for a very long time.
```

---

## 21. NEW GROWTH — the prestige

### 21.1 What carries over

| carries | does not |
|---|---|
| `sclerotium` ◉ (spendable, permanent) | all resources: Χ, Σ, Ψ, α, ◦, ⛬ |
| `growthLevel` / `coherenceLevel` / `divergenceLevel` | all projects, all acts |
| `archive[]` — up to 3 genomes | the map, the bands, the biomes |
| `lineages[]` — every wild strain ever produced | `D`, loci, traits |
| purchased sclerotium upgrades | `LEGACY`, `pathFlag` |

### 21.2 The meta-currency formula

```
sclerotiumGained = floor(
      K_SCL
    · (cumCarbon / 1.0e33) ^ 0.42
    · (1 + 0.60 · LEGACY)
    · (1 + 0.85 · meanFidelity)
    · (1 + 0.020 · strainsResolved)
    · endingMult
)

K_SCL = 45                                                                        [K]
meanFidelity  = time-weighted mean of effFid across the whole of Act III
strainsResolved = purged + absorbed (quarantined does NOT count)
endingMult:  BLOOM 1.00 | FRUITING BODY 1.15 | INHERITANCE 1.30 | ENCYST 0.35
```

Worked, first run, balanced play:

```
cumCarbon 2.0e35 → (200)^0.42 = 9.26
LEGACY 0.35      → 1.21
meanFid 0.88     → 1.748
12 strains       → 1.24
BLOOM            → 1.00
45 · 9.26 · 1.21 · 1.748 · 1.24 · 1.00 = 1,093 ◉
```

The `^0.42` on carbon is the anti-grind term: a run that eats **ten times** as much carbon yields
only **2.63×** the sclerotium. Time spent grinding is worth less than time spent playing
differently — which is the only defensible prestige curve.

Note the two multipliers that reward things the player was not told to care about: `LEGACY` (a
decision made in Act II about soil) and `meanFidelity` (a decision made across all of Act III about
how much of yourself to keep). `strainsResolved` rewards *engaging* with divergence in either
direction and gives nothing for quarantining, i.e. for avoiding the subject.

### 21.3 The sclerotium tree

One pre-run screen, one column, ten rows, greyed until affordable, exactly like a projects list.
Bought upgrades persist forever and are never refundable.

| ◉ | Name | Effect |
|---|---|---|
| 40 | **Vernalisation** | offline cap 12 h → 24 h; efficiency floor 0.50 → 0.70, all acts |
| 90 | **Deep Sclerotia** | begin Act I with 8,000 g biomass and the Litter Market already open |
| 150 | **Ancestral Memory** | `RIPE_T ×0.80` in all acts |
| 220 | **Provenance** | +1 D at the start of each act (+3 total) |
| 320 | **Perennation** | `prestigeGrowth ×1.18` (multiplies Act I `E` and Act II/III `SIG_K`) |
| 450 | **Second Genome** | begin Act III with an archived genome pre-allocated, cap raised to match |
| 640 | **Anastomosis** | +1 contract slot (I), +1 advance slot (II), +1 engagement (III) |
| 900 | **Chimera** | `lociCap0` 12 → 16 |
| 1,300 | **Palimpsest** | `LEGACY` floor raised to 0.30 → `fidelityBase ≥ 0.804` |
| 1,900 | **Ecotype** | unlock a second forest generator: different terrain/species distribution across all 61 Act II regions, and a re-rolled `rich_b` table in Act III |

A first run of ~1,100 ◉ buys the first three and change. Full clearance is 6,010 ◉ ≈ four runs.

### 21.4 Why run 2 is DIFFERENT, not merely faster

This is the load-bearing claim of the prestige design and it rests on four mechanisms, in
descending order of importance.

**(1) YOUR OWN DEFECTORS COME BACK, BY NAME.**

Every wild strain you ever produced is archived with its genome, its name, and the act it was born
in. On subsequent runs:

- **In Act II**, `min(2, archive.length)` of the four rival strains (Act II §8.2) are *replaced* by
  your own defectors from previous runs. Their Act III genome is projected onto Act II's rival
  parameters:
  ```
  rival.aggression = 0.35 + 0.055·s.tAnt
  rival.growth     = 0.80 + 0.070·s.tSpo
  rival.resilience = 1.00 + 0.090·s.tMel
  rival.name       = s.name          // "Vorense", exactly as it was
  ```
  You meet a fungus called *Vorense* on the forest floor in Act II and it fights the way you built it
  ninety minutes into your previous Act III.
- **In Act III**, archived lineages re-diverge **first**, before any new strain is generated, at
  `drift ≥ 0.55` instead of 1.0, with their *previous final genome* mutated once more. They are
  older than you.

> **Your past is the antagonist.** Not a percentage bonus. A named thing that remembers.

**(2) THE INFORMATION ASYMMETRY BETWEEN RUNS IS THE CONTENT.**

On run 1, nothing anywhere tells the player that soil retention in Act II sets fidelity in Act III.
The Act II doc's kill-ordering problem (§9.3) reads as a pure carbon-versus-Signal trade. On run 2
the player knows `fidelityBase = 0.72 + 0.28·LEGACY` and the *identical board* becomes a different
decision: every stand you spare is 0.0046 of fidelity, which is 0.15 loci, which is a strain you will
not have to fight. **The same sixty-one regions, the same numbers, a completely different game.**

This is the Paperclips `demand = 100` trick — a phase change you can only see once you have been
past it — promoted from one system to a whole act boundary.

**(3) THE ARCHIVE INVERTS ACT III'S BUILD ORDER.**

With `Second Genome` (450 ◉), Act III begins with your previous run's genome already allocated. Run 1
is *exploration*: you discover the trait web by triggering its failures. Run 2 is a *thesis*: you
commit to a build before you have any bands, and then find out whether you were right. Those are
different activities and the second one is only possible because of the first.

**(4) TWO OF THE THREE ENDINGS ARE INVISIBLE ON RUN 1.**

Ending B requires purging every strain (and therefore an α-starved, 12-locus run). Ending C requires
deliberately feeding your defectors past `Σw ≥ 3n`. Neither is discoverable on a first playthrough
without abandoning the run — and their gates diverge from the default path at about the 40-minute
mark of the void. **Seeing all three endings costs three complete playthroughs, and each is played
differently from Act II onward.**

Plus `Ecotype` re-rolls the board itself.

### 21.5 What a New Growth run is *not*

It is not shorter. Act I still takes ~2 hours; nothing skips it, and `Deep Sclerotia` saves perhaps
four minutes. We are explicitly rejecting the standard prestige contract ("do it again, faster") in
favour of ("do it again, knowing"). A player who wants speed is better served by the fact that they
are better at the game.

---

## 22. OFFLINE PROGRESSION

Same rule as Act II: **generous enough that a two-day absence is a gift; never so generous that
active play is pointless.** Same code path.

```
OFFLINE_CAP = 43,200 s (12 h), or 86,400 s (24 h) with Vernalisation
m(t) = 1.00  for 0 ≤ t < 7,200
       0.75  for 7,200 ≤ t < 21,600
       0.50  for 21,600 ≤ t ≤ 43,200          (0.70 floor with Vernalisation)
floor += 0.020 · tDor, capped at +0.16        ← the only trait that touches the meta-layer
STEPS = 240 ;  dt = effective(elapsed)/STEPS ;  simTick(dt, {stochastic:false})
```

| system | offline behaviour | why |
|---|---|---|
| harvest / replication | full, at the set triangle | it is the economy |
| transit | in-flight cohorts arrive; new launches continue at the set `aDis` | the triangle is a standing order |
| exploration | full | it is passive by design |
| radiation / senescence / transit loss | full, at expectation | they are continuous |
| **stellar events** | **never fire offline** | the same kindness as Act II's fires — you return to three bands with warnings live and 40 s to act |
| starvation | full | it is your own doing and it self-corrects |
| divergence | **drift accumulates and strains ARE born** | this is the act's clock; pausing it would make absence a fidelity cheat |
| strain growth | full | ditto |
| **predation** | capped at **25% total fleet loss** for the whole offline period | you cannot lose a run to something you could not fight |
| **engagements** | never run | it is the skill |
| **pulse** | never | it is the hero verb |
| **project / loci purchases** | never | the list is the game |
| **Signal** | caps at `Sc` and holds | → ripeness 1.0 |
| **Insight** | at max ripeness, capped at 90 min-equivalent | `min(computed, INS_K·sqrt(Sr̄)·insightMult·5400)` |
| **Synchrony** | relaxes toward 0.31; **no craft lost** | §19.5 |

### 22.1 The return screen

Five console lines, in the existing console, in the existing voice. No modal, no COLLECT button.

```
> You were gone 9 h 12 m.
> 4.11 ac harvested. 2,900 insight. Band 9 is open.
> Two bands are starving.
> Ithoides has taken band 7. It is larger than you are there.
> [ tap the void ]
```

Lines 3 and 4 are the important ones: **the summary reports what needs a decision, not what you
earned.** The resources are already yours.

---

## 23. UI SPECIFICATION — portrait, one-handed

### 23.1 The frame

```
┌──────────────────────────────┐  ← safe-area inset top
│ CARBON  4.11 ac   +812 Z/s   │  36 px
│ SIGNAL  9.1M/11.4M  ●●●●○    │  36 px   (ripeness pips)
│ CRAFT   1.84 E    ▲ 2.1%/m   │  36 px   (appears in the void)
├──────────────────────────────┤
│                              │
│        [ VOID CANVAS ]       │  260 px, 4 Hz, or the PHASE WHEEL in the endgame
│                              │
├──────────────────────────────┤
│  scrollable panel content    │  fills
│  (band list / genome / …)    │
│                              │
├──────────────────────────────┤
│           ( PULSE )          │  ← 64 px floating, bottom-right, thumb arc
├──────────────────────────────┤
│ VOID  FLEET  GENOME  LIN  LOG│  56 px  five tabs, never more
└──────────────────────────────┘  ← safe-area inset bottom
```

Five tabs, exactly as Act II had five. The tab bar is the progress bar: at Act III's start only
`VOID` and `LOG` exist; `GENOME` arrives with `G2`, `FLEET` with `G3`, `LINEAGES` with the first
strain. The screen grows and then, in the dismantle, shrinks.

### 23.2 The void canvas

Thirteen concentric arcs on a 260 px square, `devicePixelRatio`-scaled, redrawn at 4 Hz or on
`voidDirty`.

- **radius** — band index, linearly (not log): equal rings, because the player thinks in bands.
- **arc sweep** — `e_b`, explored fraction. An unexplored band is a broken ring.
- **stroke width** — `log10(1 + n_b/NCAP_b) · 9 px`, clamped [1, 14].
- **fill hue** — yours vs wild, drawn as two arcs on the same ring, split by share. **Never hue
  alone**: your arc is solid, wild is dashed (6-2). Colour-blind safe by construction.
- **overlays** — a red 4 px outer stroke for a stellar warning; an expanding thin ring for a pulse in
  flight, moving at the true `LAG_T` rate; a small tick at `n*_b` after `H4`.
- **tap** — selects a band; the band list below scrolls to it. **The canvas is a pointer; the list
  row is the target.** (Same rule as Act II's map.)

### 23.3 The band row

```
┌──────────────────────────────┐
│ 07 ·  1,187 ly     e 0.86    │
│ ████████████░░░░░░  n 1.4 E  │  ← occupancy vs NCAP, tick at n*
│ X 1.91e31   SURPLUS +410 Y/s │
│ λ 0.55      rich 1.24        │
└──────────────────────────────┘
```

Four lines. `SURPLUS` is the most important number in the game and it is on every row, always.

### 23.4 Number formatting

Unchanged from Act II §15.4: three significant figures, SI to `Q` (1e30), then two-letter
alphabetically-orderable suffixes `aa` (1e33), `ab` (1e36), `ac` (1e39)… Act III reaches `ac`.
No long-scale English words, ever.

### 23.5 Accessibility

All of Act II §15.5 carries: `prefers-reduced-motion` on every animation including the three endings
and the white flash (which becomes a 900 ms opacity ramp with no expansion); 44 px minimum targets;
`aria-live="polite"` console; full keyboard navigation with visible focus; no hue-only information;
`rem`-based layout intact to 200% text scaling; the `SLOW` toggle, which in Act III doubles the
stellar warning (40 → 80 s), the engagement resolution time, and every pulse cooldown, without
changing a single rate.

The Act III-specific addition: **the phase wheel is fully described in text** under `J5` for screen
readers (`"band 9, phase 0.62, drifting +0.004 per second, 0.31 turns behind the resultant"`), and
the endgame is completable from that text alone.

### 23.6 Save

`localStorage["hyphae.save.v3"]` + `.bak`, base64 export/import, schema versioned. Act III's block:

```
{ v:3, t, act:3, phase:"canopy"|"void",
  res:{carbon, cumCarbon, spores, signal, insight, satTime, alleles, minerals, D, dCond, dVes, dLag},
  gen:{loci:[8], lociBought, lociCap, capRaises, respecs},
  mult:{signalMult, capMult, insightMult, harvMult, replMult, germMult, exploreMult,
        prestigeGrowth, projectFid},
  legacy:{LEGACY, fidelityBase, pathFlag},
  biomes:{X[8]}                                          // canopy only
  bands:{X[13], e[13], rich[13], n[13], drift[13], phase[13]},
  transit:[{from,to,count,tRem}],
  strains:[{id,name,genome[8],w[13],born,seq,qUntil}],
  succ:{exists, genome[8], w[13], born, lines},
  alloc:[aRep,aDis,aBank],
  proj:<bitfield>, seen:<bitfield>,
  stats:{pulses, engagements, purged, absorbed, quarantined, peakSr, peakYps, mortality[6]}
}
```

Whole act ≈ 2.2 KB base64. `seen` persisted separately from `proj` (Act II §15.6 — a project
triggered on a transient condition must not vanish on reload).

---

## 24. TUNING KNOBS AND BALANCE TARGETS

```js
const TUNE3 = {
  // clocks
  SIM_HZ: 20, SLOW_HZ: 0.5, AUTOSAVE_S: 10, CANVAS_HZ: 4,

  // canopy
  SPORE_DECAY_3: 0.99700, SETTLE_Q: 2.4e7, REACH_BASE: 2.6e3, REACH_GROWTH: 2.35,
  BIOME_X0: [2.0e15,1.4e17,2.6e17,9.0e16,3.4e17,1.2e18,3.0e17,1.7e18],

  // geometry
  R_BASE: 12.0, R_GROWTH: 2.150, X0_BASE: 9.00e26, X0_GROWTH: 5.600,
  NCAP_DIV: 6.00e10, LAG_K: 0.024, LAG_T: 0.00220,
  TAU0: 90, TAU_GROWTH: 1.350,

  // core loop
  HARV_K: 4.00e7, SUB_K: 9.00e5, REP_K: 0.0250,
  CRAFT_M0: 2.40e6, GEN_TAX: 0.085, GEN_EXP: 1.15,
  PROP_K: 1.80, MAXLAUNCH: 0.020,
  EXP_K: 2.20e-3, NREF_FRAC: 0.30, GERM_BASE: 0.280,

  // hazards
  RAD_K: 2.60e-5, TR_HAZ: 3.00e-4, SEN_K: 1.10e-5,
  STELLAR_P: 4.20e-4, SKIRM_K: 0.0016,

  // signal / insight
  SIG_K3: 4.20, SIG_CAP3: 364, NSIG: 1.00e12,
  INS_K: 0.055, RIPE_T: 130, RIPE_DEC: 3.0, SAT_EPS: 0.5,

  // genome
  LOCI_FREE0: 4, LOCI_CAP0: 12, LOCI_A: 120, LOCI_E: 1.24,
  CAP_A: 400, CAP_G: 1.42, SEQ_A: 140, SEQ_G: 1.42,
  REGEN_FRAC: 0.020, REGEN_G: 1.75, REGEN_T: 90,

  // divergence
  DRIFT_K: 0.280, DRIFT_TRIG: 1.000, DRIFT_DECAY: 6.0e-4,
  DEFECT_MIN: 0.040, DEFECT_MAX: 0.140, MUT_P: 0.30,
  SPREAD_K: 9.0e-4, MAX_STRAINS: 6,
  ALPHA_PURGE: 0.90, ALPHA_ABSORB: 2.10, ALPHA_SUCC: 4.00, ALPHA_EXP: 0.30,
  NOVELTY_K: 0.14,

  // combat
  COMBAT_K: 0.0140, WITHDRAW_RECOVER: 0.60, REINFORCE_FRAC: 0.10,

  // successor
  SUCC_TRIGGER_T: 120, SUCC_LEARN_S: 240, DESYNC_K: 0.020, SUCC_CEDE_AGE: 1800,

  // pulse
  PULSE_COST_FRAC: 0.55, PULSE_CD: 75, PULSE_FALLOFF: 0.82, K_ENTRAIN: 0.55,

  // synchrony
  PERIOD_BASE: 300, PERIOD_SLOPE: 0.22, ISO_COMPRESS: 0.55,
  BLOOM_Y: 0.80, BODY_Y: 0.97,

  // endings
  BLOOM_X: 9.00e34, BODY_X: 1.60e35, BLOOM_SIG: 1.10e7,

  // prestige
  K_SCL: 45, SCL_CARB_EXP: 0.42, SCL_CARB_REF: 1.0e33,
  SCL_LEGACY: 0.60, SCL_FID: 0.85, SCL_STRAIN: 0.020,
  END_MULT: {bloom:1.00, body:1.15, inherit:1.30, encyst:0.35},

  // offline
  OFFLINE_CAP: 43200, OFFLINE_TIERS: [[7200,1.0],[21600,0.75],[43200,0.50]],
  OFFLINE_INSIGHT_CAP_S: 5400, OFFLINE_PRED_CAP: 0.25
};
```

### Balance targets

| Target | Value | Tolerance |
|---|---|---|
| Act III duration, median | **2 h 22 m** | ±20 min |
| Phase A (canopy) duration | 22 min | ±5 min |
| Void duration | 100 min | ±15 min |
| Endgame (from `J2`) | 20 min | ±4 min |
| SETTLE automated by | 0:55 | hard ≤ 1:15 |
| Interval between new things, first 10 min | ≤ 100 s | hard |
| Interval between new things, whole act | ≤ 6 min | hard |
| Craft lost at ESCAPE | 96% | exact |
| First divergence event, balanced build | 48–62 min into void | ±10 min |
| Strains born, balanced run | 9–14 | ≥ 4 |
| `lociCap` reached, balanced run | 19 | 17–21 |
| Projects unbought at ending | 6–9 | ≥ 4 |
| Bands occupied at ending | 13 | exactly (gate) |
| `ϒ` free-running | 0.31 | 0.28–0.34 |
| Pulses required to reach `ϒ = 0.80` | 12–16 | 10–20 |
| Offline 9 h ÷ active 9 h (carbon) | 0.68 | 0.6–0.8 |
| MONASTIC build completion rate | 100% | hard — every named build finishes |
| `sclerotiumGained`, first run | 950–1,300 | ±25% |
| Distinct playstyles reaching each ending | ≥ 2 per ending | hard |

---

## 25. HOW ACT III BEATS THE TEARDOWN

| Teardown weakness | Act III's answer |
|---|---|
| §8.1 refuses to run on a phone | Portrait, five tabs, one canvas, one floating hero button, a draggable triangle, 44 px steppers. The whole act's live state is 2 KB. |
| §8.2 no offline progression | §22. Same sim function, 240 macro-steps, 12–24 h cap, predation capped at 25%, stellar events held for your return, Insight at max ripeness. |
| §8.3 one save slot | Versioned key + rolling backup + base64 export/import, ~2.2 KB. |
| §8.4 stock market has no agency | The divergence layer is the strategic sub-game and every part of it is a choice: which strain to fight, when to absorb, whether to pay to know their genome, whether to farm them. |
| §8.5 quantum computing is an eye test | There is no reaction test. The one timed decision is 40 s (80 s on SLOW). The finale's timescale is 300–1,100 s periods with a 120 s lag — thinking, not twitch. |
| §8.6 boredom/disorg punish walking away | Nothing punishes absence. Synchrony relaxes but costs no resources, and it is the only presence-gated content in three acts. |
| §8.7 mid-act plateau | The max-surplus point (§7.5) means every band is a fresh optimisation; depletion pushes you outward automatically; strains arrive on a fidelity-dependent clock; the Successor is an adaptive opponent. There is no stretch where the input is "press the bigger button." |
| §8.8 combat is a screensaver | Lanchester square with a closed-form prediction, a *quantified unknown* you can pay to remove, four live inputs during the fight, and a 60% withdraw. |
| §8.9 trust allocation unrecoverable | `REGENOME`, self-scaling at 2% of lifetime carbon, ×1.75 per use, 90 s downtime. Real cost, always available. |
| §8.10 marketing is an untold trap | Every trait row shows its coupled penalty live, and the MORTALITY panel attributes every death. There are traps, but none of them are hidden. |
| §8.11 long-scale number words | SI to `Q`, then `aa/ab/ac`. Alphabetically orderable. |
| §8.12 market can't be learned | `rich_b` is fixed per run and revealed by exploration; the strain genomes are deterministic mutations of your own; the phase system is a solvable ODE. Everything in Act III can be learned. |
| §8.13 endgame is 1–2 h of watching | The last 20 minutes are the densest decision-making in the game: 12–16 aimed pulses against a 120 s lag, an adaptive desynchroniser, and a carbon target on a falling production curve. |
| §8.14 no accessibility | §23.5, including a fully text-described finale. |
| §8.15 no "what should I do next" | The MORTALITY panel and the SURPLUS readout. The game never gives advice; it gives instruments. |
| §8.16 third-party dependencies | None. No images, no audio, no fonts, no CDN, no analytics. |

---

## APPENDIX A — Implementation order

1. **Band record + §7 core loop, headless.** Assert `n*` and `n†` numerically against the closed
   forms. Nothing else works until this does.
2. **The triangle**, as three number inputs. Verify the `aRep ≈ 0.33` crossover.
3. **Genome + eight traits + genome tax.** Verify each coupled penalty independently.
4. **MORTALITY accounting.** Every death in the codebase must be attributed to exactly one of six
   causes at the point it occurs. Do this before hazards, not after — retrofitting attribution is
   how you end up with an `other` row.
5. **Hazards**, in the order radiation → transit → starvation → senescence → stellar → predation.
6. **Signal / Insight**, ported wholesale from Act II with the new `Λ`. Assert `timeToFill = 86.7·…`.
7. **Projects tree** — the `trigger`/`cost` split, verbatim from Act II's implementation.
8. **Phase A**, built on the finished band loop with `λ = 1`. It is a reskin and must be one.
9. **ESCAPE.**
10. **Divergence + strains + mutation.** The mutation function first, with a test that a strain's
    genome is always within `drift` of the player's at birth.
11. **Combat**, with the closed-form predictor and the uncertainty band before the UI.
12. **Sequencing, absorb, quarantine.**
13. **Alleles + `lociCap`.**
14. **Successor.**
15. **Phase system + Kuramoto + the wheel.** Verify `ϒ` free-runs at 0.31 ± 0.03 with no input.
16. **Endings + dismantle.**
17. **New Growth + archive + the Act II rival projection.**
18. **Offline.** Last, because it must call the finished `simTick`.

---

## APPENDIX B — Deliberately NOT in Act III

- **A map.** Act II had one. The void gets a radial chart and a list. Never reuse a geometry.
- **A tech tree with branches.** The projects list stays flat and un-categorised.
- **Named star systems.** Thirteen bands, no individuals. Act II's sixty-one named stands were the
  place for that, and the contrast is the point: Act III is not about places.
- **Resource conversion chains.** One bulk resource, one flow, one thought-currency. Act II's
  pipeline complexity would be noise at this scale.
- **A tutorial, a codex, a tooltip, or a settings screen beyond `SLOW` + export/import.**
- **Any number the player cannot compare to another number on the same screen.**
- **A fourth ending.** Three is the right number and the concession is not one.
- **Audio.** There are no audio files in HYPHAE. The silence at ending A is four seconds long and it
  is doing more work than a threnody would.

---

*Every constant in this document is stated. Every formula is closed-form or a two-line integration.
Where a value is a tuning knob it is marked `[K]` and appears in `TUNE3`. Nothing here requires an
asset, a dependency, or a network.*
