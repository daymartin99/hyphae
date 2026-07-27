# HYPHAE — ACT II: NETWORK

**Complete mechanical specification. This document is the source of truth.**
Companion to `00-paperclips-teardown.md`. Every constant here is named, every formula closed-form,
every unit stated. Where a value is a tuning knob it is marked `[K]` and listed in §17.

Act II is the middle ~3h15m of a 6–10h playthrough. It begins the moment the network gains
signalling and ends when the forest is gone.

---

## 0. Interface contract with Act I and Act III

Act I and Act III are specified elsewhere. This is the exact boundary. Act I's doc must conform to
the "in" column; Act III's doc must conform to the "out" column.

### 0.1 State carried IN from Act I

| Symbol | Type | Value at handoff | Meaning |
|---|---|---|---|
| `biomass` | float, grams | **4.0e6 – 9.0e6** (target 6.0e6) | the bulk currency. Carries over untouched. |
| `cumBiomass` | float, grams | ≈ 2.2e7 | lifetime gross biomass. Drives the Differentiation ladder. |
| `minerals` | float, arbitrary "mineral units" (⛬) | 1.8e4 – 5.0e4 | from mycorrhizal contracts. Carries over. |
| `contracts[]` | array | 2–5 active | Act I's tree contracts. Re-homed into regions (§10). |
| `substratePrice`, `mineralPrice` | float | market state | the Act I two-sided market persists, demoted (§10.4). |
| `decompRate0` | float, g/s | **≈ 4.0e3** | player's gross decomposition rate at transition. |
| `D` | int | **3** | Differentiation points. Act I grants exactly 3. |
| `enzymePower E` | float | **1.00** | Act I ends with E normalised to 1. |
| `yieldMult` | float | **1.00** | ditto. |
| `prestigeGrowth` | float | 1.00 (first run) | from Act III's "New Growth". Multiplies `E` and `SIG_K`. |

Everything else in Act I's state (the substrate stalls, the manual `EXTEND` button, the deadfall
queue, the Act I upgrade list) is **revoked** at the Act I→II transition. That transition is Act I's
document's problem; this document assumes it has happened.

### 0.2 State carried OUT to Act III

| Symbol | Value | Meaning |
|---|---|---|
| `sporeBank` | `floor(biomassHeld / 3.2e3)` + `spores` | Act III's starting seed stock. |
| `insight` | preserved in full | thought survives the body. Act III's Projects continue to cost Ψ. |
| `D` | preserved, reallocated free once | Differentiation re-homes onto Act III's axes. |
| `LEGACY` | float [0,1] | see §13.4. Sets Act III's `fidelityBase = 0.72 + 0.28·LEGACY`. |
| `pathFlag` | `"symbiont"` \| `"necrotroph"` \| `"mixed"` | which of D8/D9 was taken (or neither). Gates one Act III ending. |
| `insightMult`, `signalMult` | preserved | Act III adds to them. |

Everything else — the 61 regions, hyphal density, contracts, rivals, the fruiting panel, the map —
is destroyed. See §13.

---

## 1. Design thesis for Act II

Act I is a business. Act III is a diaspora. **Act II is a mind that is made of the thing it eats.**

The single mechanical idea the whole act is built on:

> **Biomass comes from dead wood. Signal comes from living trees.
> You cannot finish the act without eating the living trees.**

That is not a dilemma with a right answer; it is a *scheduling* problem across sixty-one places.
Every region is simultaneously fuel and neuron. Killing a stand converts a permanent, compounding
cognitive asset into a large one-time pile of carbon. The act's difficulty curve is not "the numbers
get bigger" — it is that **your Signal rate peaks around 80% consumed and then falls**, because you
have eaten your own brain, and the last 20 minutes of the act are a controlled decline in which you
spend down everything you have and leave.

No incremental game I know of has a production curve that goes *down* before an act break. It is the
correct shape for this fiction and it emerges from the model rather than being scripted.

Secondary theses, each answering a specific failure in Universal Paperclips (§ refs to the teardown):

- **The territory layer's connectivity bonus makes the *shape* of your colony matter**, not just its
  size, so expansion is a spatial decision rather than a purchase. (Beats §8.7, the Act II plateau.)
- **The fruiting sub-game has a genuine interior optimum that moves**, because payoff rises with
  maturity while hazard rises faster, and both are driven by a mean-reverting weather process you can
  learn and buy forecasts of. (Beats §8.4 no-agency and §8.12 unreadable market.)
- **Saturation-fed Insight with a ripeness term makes patience an explicit, quantified strategy**,
  and makes walking away *strictly good*. (Beats §8.2 no offline and §8.6 punishing inattention.)
- **Every allocation is respeccable for a real price.** (Beats §8.9.)
- **Pulse** is a manual, positional, never-automated hero verb that stays in the player's thumb for
  the entire act. (Beats §8.13, endgame-as-spectator.)

---

## 2. Clocks, architecture, performance

Phone-first means we do not copy UP's 100 Hz `innerHTML` firehose. We separate simulation from
presentation.

| Loop | Interval | Rate | Contains |
|---|---|---|---|
| **Sim tick** | `setInterval(sim, 50)` | **20 Hz** | decomposition, tree growth, humus, signal, insight, colonisation, rival pressure, primordium maturity, hazard rolls, pulse timers |
| **Render** | `requestAnimationFrame` | ~60 Hz, throttled | DOM text writes (only changed nodes), canvas map, bars |
| **Weather** | inside sim, every 20th tick | **1 Hz** | the OU walk, wind, forecast band recompute |
| **Slow** | inside sim, every 40th tick | **0.5 Hz** | region event rolls, fire checks, contract re-pricing, rival spread |
| **Autosave** | inside sim, every 200th tick | every 10 s | plus `visibilitychange`, `pagehide`, `beforeunload` |

`dt = 0.05` seconds in every sim formula below unless stated. All rates in this document are
**per real second**; multiply by `dt` at the call site. Never accumulate in per-tick units — that is
how UP's `harvesterRate = 26180337` ended up meaning nothing to a reader.

**Catch-up:** if `performance.now()` shows the sim fell behind by more than 250 ms (backgrounded tab,
slow phone), do NOT run a burst of ticks. Run **one** tick with a larger `dt`, clamped to
`dt ≤ 2.0` s, and skip stochastic subsystems (hazard rolls, event rolls) for that tick, applying
their expected values instead. This is the same code path as offline reconciliation (§14) and must
be written once.

**Render discipline:** `renderText(el, str)` compares `el.__last` before assigning. On a 61-region
list only ~4 cards are on screen; virtualise the list past 24 rows. Canvas map redraws only when
`mapDirty` is set (a claim completes, a rival bar crosses 5%, the viewport pans) or at 4 Hz for the
breathing animation, whichever is rarer.

**Performance headroom is a design resource** (teardown principle 12) — but on a phone the resource
we are spending it on is *battery*, so we spend it on 60 Hz interpolation of a 20 Hz sim, which looks
identical and costs a quarter as much.

---

## 3. The opening: Act II's first twelve minutes, beat by beat

The metronome from the teardown — **something new every ~90 seconds** — is non-negotiable. Here it is.

**Beat 0 — 0:00. One new panel.**
The Act I transition has just fired. The screen shows the ACT I panels greyed and lifting away, then a
single new panel:

```
MIND
────────────────────────────
Signal      0 / 215
            ▁▁▁▁▁▁▁▁▁▁▁▁
            +2.5 / s
```

Console: `> Something in the network is repeating itself.`

There is **nothing to do**. The bar fills. This is deliberate: Act I ended with frantic market
management; the first thirty seconds of Act II are silence. Sc = 215, Sr = 2.48/s ⇒ 87 seconds to fill.

**Beat 1 — 0:40. The first project blinks.**
`chemotaxis` — **"Chemotaxis"** (400 Σ) — *"Sense the gradient."*
It is greyed (you have ~100 Σ). It lights at 0:40. Buying it un-hides the FOREST panel: a small canvas
showing your core stand and six silhouetted neighbours, plus a **STANDS** list with one card.

**Beat 2 — 1:20. The first claim.**
Tap a neighbour card → `ADVANCE` → cost 1.80e6 g (you have ~6e6), 45 s timer. A thin root line
animates across the map edge. First time the world has geography.

**Beat 3 — 2:05. The claim lands, and Signal jumps.**
`Sr` goes 2.48 → 3.6/s, visibly. The lesson — *territory is cognition* — is taught by a number
changing, not by text. Console: `> Beech Hollow. Something there is willing to talk.`

**Beat 4 — 2:45. Saturation.**
Signal hits 215/215 for the first time. `saturation` project appears (1,600 Σ) —
**"Turgor"** — *"The pressure has nowhere to go."*
Buying it unlocks **Insight** and the **RIPENESS** meter. Console:
`> It becomes something else.`

**Beat 5 — 4:10. The first fruiting body.**
`primordium` — **"Primordium"** (10 Ψ) — *"A knot in the wood, deciding."*
FLUSH panel appears. One slot. You commit biomass, a 240-second maturity bar starts, and a weather
strip appears above it: a single number, `MOISTURE 0.54 ↗`, with no forecast yet. You have no idea
what it means. You will in six minutes.

**Beat 6 — 5:40. The first release, and the first spore.**
Release at whatever maturity you like. The first flush is deliberately generous (`firstFlushBonus
= 3.0`) so the payoff reads clearly. Spores appear as a currency. Console:
`> Ten million of them. Nine million will land on stone.`

**Beat 7 — 7:00. First rival contact.**
A ring-2 region adjacent to your frontier shows a second bar, amber, filling slowly:
`Armillaria ▓▓░░░░░░ 21%`. No explanation. `antibiosis` will appear when you try to advance into it.

**Beat 8 — 8:20. PULSE.**
`action_potential` — **"Action Potential"** (45 Ψ) — *"Say it all at once."*
A 64 px circular button docks bottom-right, inside the right-thumb arc. Tapping it opens a three-item
radial. Only SURGE is unlocked. Cooldown 120 s. **This button is in the player's thumb for the next
three hours and never automates.**

**Beat 9 — 10:00. The first Differentiation point.**
`cumBiomass` crosses 1.5e9. Console:
`> The network has enough of itself to specialise.`
A two-way allocation appears: **CONDUCTION** (throughput) vs **VESICLE** (capacity), with the fill-time
and Insight-rate consequences shown live as you hover each, and a line of small grey text:
`Reabsorption will let you undo this.` — because UP's §8.9 permanence trap is a bug, not a feature,
and telling the player the respec exists costs nothing and removes an hour of anxiety.

**Beat 10 — 11:30. Spore seeding.**
`anemophily` (40 Ψ) unlocks seeding non-adjacent regions **downwind**. The wind arrow on the map
becomes load-bearing. The map is now a thing you read.

By minute 12 the player has: 4–6 regions, Signal ~40/s, Insight ~120 lifetime, 1 D allocated,
2 primordia cycled, one rival on the border, and a Pulse button. Six systems, all visible, all on one
portrait screen.

---

## 4. SIGNAL — the cognition resource

### 4.1 What produces it

Signal is not produced by a building. It is produced by **live mycorrhizal interface**: the surface
area at which your hyphae are in exchange with a *living* root. Dead wood gives you carbon and
nothing else.

Per claimed region *i*:

```
liveInterface_i =  d_i
                 × (T_i / T0_i)^0.60          // living tree biomass, relative to pristine
                 × ζ(terrain_i)               // conductance, §6.4
                 × κ(species_i)               // mycorrhizal compatibility, §6.5
                 × (1 + 0.50 · hasContract_i) // §10
```

where `d_i` = `hyphalDensity_i ∈ [0,1]`, `T_i` = standing tree biomass in grams, `T0_i` = its
pristine value.

The `^0.60` exponent matters: a stand at 50% tree mortality still delivers 66% of its interface.
Trees degrade gracefully; the cliff only arrives at the end. This keeps the mid-act from being a
knife-edge and makes the final collapse feel sudden, which is correct.

### 4.2 Network shape: connectivity

```
nodes = number of claimed regions
edges = number of unordered adjacent pairs (i,j) where both are claimed AND the shared
        edge is not a barrier (§6.6)

C = 1 + 0.14 · ( edges / max(1, nodes) )^1.25
```

`edges/nodes` for a straight chain → ~1.0 (C = 1.14). For a solid hex blob at n=37 → 2.43
(C ≈ 1.60). For a scattered spore-seeded archipelago → ~0.3 (C ≈ 1.03).

**This is why territory is not busywork.** A greedy player who spore-seeds the six richest stands in
the forest gets a lot of carbon and a stupid network. A player who grows a compact blob gets 55% more
Signal from the same regions. The two strategies are both viable and they *look different on the map*.

### 4.3 Throughput

```
SIG_K = 3.00                                  [K]
Sr = SIG_K
   × C
   × ( 0.60 + Σ_i liveInterface_i )^0.85
   × ( 1 + 0.35 · dCond )
   × signalMult
   × prestigeGrowth
```

The `0.60 +` term is the core stand's floor — it guarantees a non-zero opening rate and prevents
divide-by-zero flavour. The `^0.85` is the sublinear return on breadth that keeps a 61-region colony
from being 61× a 1-region colony.

Trajectory: **2.5 signal/s at 0:00 → ~5,300 signal/s at the transition.** Lifetime Signal generated
across the act ≈ **8.0e6**. The project tree spends ≈ 5.2e6 of that (§12).

### 4.4 Capacity

```
SIG_CAP_BASE = 260                            [K]
Sc = SIG_CAP_BASE
   × ( 1 + dVes )^1.85
   × ( 0.60 + Σ_i liveInterface_i )^0.85
   × capMult
```

**Note the deliberate structural property:** the interface term appears in *both* `Sr` and `Sc` with
the same exponent, so

```
timeToFill = Sc / Sr
           = (SIG_CAP_BASE / SIG_K) · (1+dVes)^1.85 · capMult
             ─────────────────────────────────────────────────
                  C · (1 + 0.35·dCond) · signalMult · prestigeGrowth

           = 86.7 · (1+dVes)^1.85 · capMult
             ────────────────────────────────
             C · (1+0.35·dCond) · signalMult
```

**Time-to-fill does not depend on the size of your forest.** It depends only on your allocation and
your upgrades. This is the single most important balance decision in Act II: it means the saturation
tension (§5) is preserved identically at minute 5 and at minute 190, without any hand-tuning, and it
means the player's mental model — "Vesicle makes it take longer to ripen, Conduction makes it
shorter" — is exactly true forever.

Worked values:

| dVes | dCond | capMult | signalMult | C | timeToFill |
|---|---|---|---|---|---|
| 0 | 0 | 1.0 | 1.0 | 1.00 | **87 s** |
| 2 | 2 | 1.45 | 1.0 | 1.20 | **185 s** |
| 5 | 6 | 1.45 | 2.2 | 1.42 | **196 s** |
| 9 | 12 | 3.0 | 8.0 | 1.55 | **294 s** |
| 3 | 18 | 3.0 | 8.0 | 1.55 | **41 s** |
| 14 | 4 | 3.0 | 8.0 | 1.55 | **1,024 s** |

The last two rows are the two degenerate builds and both are *playable and different*: the
Conduction build ripens constantly and buys many small things; the Vesicle build ripens rarely and
banks for the expensive tier-D and tier-E projects, several of which cost more than a low-Vesicle
player's entire pool and are therefore literally unbuyable.

**Hard gate:** `ascospore` (the act transition, §13) costs 1,600,000 Σ, and you cannot hold more than
`Sc`. At endgame interface (Σ liveInterface ≈ 70, term ≈ 37.2) and capMult = 3, you need
`260 · (1+dVes)^1.85 · 37.2 · 3 ≥ 1.6e6` ⇒ `(1+dVes)^1.85 ≥ 55.1` ⇒ **dVes ≥ 9**. The tree
therefore tells the player the minimum Vesicle investment, and it tells them by greying out a button
they can see for an hour beforehand. That is the trigger/cost split doing structural work.

### 4.5 Differentiation points

`D` is Act II's Trust analogue. It is granted by hitting cumulative-biomass milestones and by five
flavour projects. It is spent on `dCond` / `dVes`, and it is **respeccable**.

**The ladder** is the **Lucas sequence** (2,1,3,4,7,11,18,29,47,76,…) scaled by 5e8 grams. Same
golden-ratio growth as UP's Fibonacci, a different sequence, and — like UP — nothing in the UI names
it. (`L(n) = L(n-1) + L(n-2)`, `L(1)=1, L(2)=3`.)

```
D thresholds on cumBiomass (grams):
 #1  1.50e9     #6  1.45e10    #11 1.61e11    #16 1.786e12
 #2  2.00e9     #7  2.35e10    #12 2.605e11   #17 2.889e12
 #3  3.50e9     #8  3.80e10    #13 4.215e11   #18 4.675e12
 #4  5.50e9     #9  6.15e10    #14 6.820e11   #19 7.564e12*
 #5  9.00e9     #10 9.95e10    #15 1.1035e12
```
\*#19 sits above `EXTRACT_TARGET` (5.2e12) and is reachable only on a slow, high-legacy run — it is a
deliberate reward for the Symbiont path, which extracts more total carbon at lower intensity.

Total D available in Act II: **3 (carried) + 19 (ladder) + 7 (flavour projects) = 29.**

On grant: `displayMessage("The network has enough of itself to specialise.")` and the D panel blinks
(12 toggles @ 30 ms, or a 400 ms opacity ramp under `prefers-reduced-motion`).

**Respec — `reabsorption` (C8, 150 Ψ):**
```
respecCost(n) = ceil( 120 · (n+1)^1.60 )   Ψ,  n = number of prior respecs
              = 120, 363, 726, 1210, 1815, 2541 …
```
Returns all D to unallocated. The escalation means respec is a real strategic instrument early and a
last resort late, and it never becomes a free optimiser's toy.

### 4.6 Signal display

```
SIGNAL   184.2k / 512.7k
▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░  +1.42k/s      fills in 3m 51s
RIPENESS ●●●○○         ×0.71
```
Four lines. `fills in` is the number the player actually steers by. `RIPENESS` is five pips because
five is countable at a glance and a percentage is not.

---

## 5. INSIGHT — the saturation currency

Copied from Universal Paperclips verbatim in its core rule, because the teardown is right that it is
the best idea in that game:

> **Insight accrues only while the Signal pool is full.**

Then improved in exactly one way: a **ripeness** term that makes *how long* you have been saturated
matter, not just *whether*.

### 5.1 The model

```
EPS      = 0.5            // signal units of slack tolerated
RIPE_T   = 180.0          // seconds of continuous saturation to full ripeness   [K]
RIPE_DEC = 3.0            // decay multiplier when not saturated                 [K]
INS_K    = 0.055                                                                 [K]

each sim tick:
  if (S >= Sc - EPS) {
      satTime = min(RIPE_T, satTime + dt)
  } else {
      satTime = max(0, satTime - RIPE_DEC * dt)
  }
  ripeness = satTime / RIPE_T                              // 0 … 1

  if (S >= Sc - EPS) {
      insight += INS_K * sqrt(Sr) * (0.25 + 0.75*ripeness) * insightMult * dt
  }
```

`RIPE_T` drops 180 → 130 s with `mycelial_memory` (C7) and 130 → 95 s with `deep_hyphae` (D7).

### 5.2 Why this rewards patience — and why that is a *decision*, not a tax

Three consequences, all intended, all legible:

**(a) Spending Signal has a hidden Insight cost.**
Buying a project drops `S` below `Sc`. `satTime` then decays at 3× the rate it built. If you were
fully ripe (180 s banked) and you spend, you lose 180 s of ripeness in 60 s of downtime, and then
need another 180 s of saturation to get back. Net: **a single purchase costs roughly 240 seconds of
peak Insight production**, i.e. `0.75 · INS_K · sqrt(Sr) · 240` ≈ `9.9 · sqrt(Sr)` Insight. At
Sr = 2,500 that is ~495 Ψ — comparable to a tier-C project. **Every Signal purchase is implicitly
also an Insight purchase, and the exchange rate is visible in the ripeness meter.**

The player therefore learns, without being told, to **batch**: hold, ripen, then spend two or three
Signal projects in one burst, eating one ripeness reset instead of three. That is a real, recurring,
skill-expressing decision that arrives every few minutes for the entire act, and it costs eleven
lines of code.

**(b) Walking away is strictly good.**
Offline (§14) the network is saturated for essentially the whole elapsed period, so offline Insight
runs at full ripeness. A player who closes the tab for two hours returns to a maximally-ripe network
and a fat Insight balance. This is the exact inverse of UP's boredom/disorganisation taxes
(teardown §8.6) — we reward the behaviour the genre promises instead of punishing it.

**(c) Vesicle vs Conduction becomes a genuine dilemma with no dominant answer.**
`insightRate ∝ sqrt(Sr)`, and `Sr` scales with `dCond`. So Conduction directly raises Insight rate.
But high Conduction also means `timeToFill` is short, which means saturation is easy, which sounds
purely good — except the *pool* is small, so you must spend often (each spend costing ripeness), and
the expensive projects are unbuyable. High Vesicle means long ripening cycles, low spend frequency,
high ripeness uptime, and access to the whole tree — but a lower `sqrt(Sr)` coefficient.

Expected Insight per hour, two builds at the same total D = 21:

| build | Sr | sqrt(Sr) | timeToFill | ripeness uptime | Ψ/hr |
|---|---|---|---|---|---|
| dCond 18 / dVes 3 | 4,940 | 70.3 | 41 s | 0.31 | **2,340** |
| dCond 12 / dVes 9 | 3,900 | 62.4 | 294 s | 0.68 | **3,180** |
| dCond 4 / dVes 17 | 2,120 | 46.0 | 1,340 s | 0.87 | **2,760** |

There is an interior optimum around dVes ≈ 9–11, it is not obvious, and it *moves* as `signalMult`
and `capMult` change. That is exactly the shape a permanent allocation should have — and there is a
respec, so getting it wrong for forty minutes is a lesson rather than a run-ender.

### 5.3 Insight budget

Lifetime Insight generated across Act II, mid-build, with average `insightMult ≈ 1.9`:
**≈ 16,000 Ψ.** The project tree costs ≈ 15,400 Ψ (§12.7). There is deliberately less than 5% slack:
**you cannot buy everything**, and the D8/D9 branch is mutually exclusive, so a first playthrough
leaves 6–8 projects unbought and visible. Those greyed rectangles are the reason there is a second
playthrough.

---

## 6. THE TERRITORY LAYER

### 6.1 Why it exists

Three jobs, in order of importance:

1. **It is the substrate of Signal.** Regions are not score; they are the organ. This is what stops
   territory from being the "collect all the checkboxes" busywork it is in most incrementals.
2. **It is the board on which the consumption tragedy plays out** (§9). Sixty-one independent
   fuel-or-neuron decisions with spatial coupling.
3. **It gives the Pulse a geometry** (§11.2), which turns the hero verb into a positional choice.

### 6.2 Shape: 61 hexes, five rings

Axial coordinates `(q, r)`, `s = -q-r`. Ring 0 = the core (1 hex). Rings 1–4 = 6, 12, 18, 24 hexes.
**Total 61.**

```js
const HEX_DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
function ringOf(q,r){ return (Math.abs(q)+Math.abs(r)+Math.abs(-q-r))/2; }
function neighbours(q,r){ return HEX_DIRS.map(([dq,dr])=>[q+dq, r+dr]).filter(inBounds); }
function hexDist(a,b){ return (Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs(a.s-b.s))/2; }
```

61 is chosen because: it is the largest ring-count that fits a phone canvas at ≥ 30 px hex width in
portrait at 360 CSS px; it gives a max hex-distance of 8 (so `0.82^dist` Pulse falloff has a
meaningful range); and 61 stands is enough that you never memorise them but few enough that by the
end you have opinions about specific ones.

### 6.3 The region record

```js
{
  id:        17,
  q: 1, r: -3, s: 2,
  ring:      3,
  name:      "Beech Hollow",         // procedural, §6.9
  terrain:   2,                      // enum, §6.4
  species:   [[1,0.62],[3,0.38]],    // [speciesId, weight], weights sum to 1
  lignin:    1.27,                   // Σ w·Λ(sp), cached
  decompF:   0.763,                  // 1.55 - 0.62·lignin, cached
  yieldF:    1.233,                  // 0.70 + 0.42·lignin, cached
  kappa:     0.977,                  // Σ w·κ(sp), cached mycorrhizal compat

  L0:        2.415e10,               // pristine litter stock, grams
  L:         2.415e10,               // current litter stock
  T0:        9.660e10,               // pristine standing tree biomass, grams
  T:         9.660e10,               // current standing biomass
  humus:     0.62,                   // h ∈ [0,1]
  moisture:  0.54,                   // m ∈ [0,1], derived each weather tick
  mPhase:    2.13,                   // rad, this region's seasonal phase offset

  discovered: true,                  // terrain + species visible
  surveyed:   false,                 // exact L, T visible (else shown as a band)
  claimed:    true,
  colonization: 1.0,                 // 0..1 advance progress
  advancing:  false,
  d:         0.40,                   // hyphalDensity, 10 steps of 0.1
  rho:       0.30,                   // Retention dial, §9.3 (local override or global)
  rhoPinned: false,                  // true if this region overrides the global dial

  rival:     0,                      // -1 none, else rival id
  rivalStr:  0.0,                    // R ∈ [0,1]

  contract:  null,                   // §10
  barriers:  0b010010,               // bitmask over HEX_DIRS: edges that cannot be crossed
  fireRisk:  0.0,                    // accumulator, §9.5
  events:    [],                     // active region events
  necrotized: false                  // §9.6, irreversible
}
```

The whole board is `Array(61)` of these. At 20 Hz that is 1,220 record-updates per second: nothing.

### 6.4 Terrain (6 kinds)

| id | Name | `litterMod` | `ζ` conductance | `moistOff` | `rivalAgg` | `mineralMod` | Special |
|---|---|---|---|---|---|---|---|
| 0 | **Loam** | 1.00 | 1.00 | +0.00 | 1.00 | 1.00 | — |
| 1 | **Sand** | 0.55 | 1.35 | −0.22 | 0.85 | 0.60 | fire risk ×1.8 |
| 2 | **Clay** | 1.25 | 0.70 | +0.18 | 1.05 | 1.15 | damps weather: `Δm` from W is halved |
| 3 | **Scree** | 0.25 | 1.60 | −0.10 | 0.60 | **3.00** | no trees above ring 2 (`T0 ×0.35`) |
| 4 | **Peat** | **2.20** | 0.55 | +0.34 | 1.30 | 0.75 | `decompF ×0.45` until `aerenchyma` (C9) |
| 5 | **Burn** | 0.35 | 1.10 | −0.06 | 0.45 | 1.40 | humus regen ×2.5; birch-dominant |

Scree is the mineral mine and the signal superconductor with almost no carbon. Peat is a vast larder
you cannot open until you buy the drainage project. Clay is the only terrain that is *safe* in bad
weather, which makes it the correct place to site fruiting bodies during a drought. Burn is created,
not generated (§9.5) — the forest makes its own burn scars when you overextract.

**Generation:** ring 0 is always Loam. Rings 1–4 weighted-random with post-hoc repair to guarantee
**≥ 3 Scree, ≥ 2 Peat, exactly 0 Burn at start**, and no more than 2 same-terrain regions adjacent.
Weights: Loam 0.40, Clay 0.20, Sand 0.18, Scree 0.11, Peat 0.11.

### 6.5 Species (5 kinds)

| id | Name | `Λ` lignin | `κ` compat | `litterSpMod` | `canopy` | note |
|---|---|---|---|---|---|---|
| 0 | Oak (*Quercus*) | 1.38 | 0.85 | 1.15 | 0.90 | slow, rich, standoffish |
| 1 | Beech (*Fagus*) | 1.20 | 1.00 | 1.05 | 0.98 | the baseline partner |
| 2 | Birch (*Betula*) | 0.78 | 0.72 | 0.70 | 0.62 | pioneer; fast, poor, thin canopy |
| 3 | Pine (*Pinus*) | 1.45 | 1.10 | 0.85 | 0.75 | best partner, worst litter |
| 4 | Hemlock (*Tsuga*) | 1.30 | 0.94 | 0.95 | 1.00 | densest shade — best fruiting |

Derived per region from the weighted mix:
```
lignin  = Σ w_sp · Λ_sp
decompF = 1.55 − 0.62 · lignin      // ∈ [0.65, 1.07] — hard wood decomposes slowly
yieldF  = 0.70 + 0.42 · lignin      // ∈ [1.03, 1.31] — but yields more per gram
kappa   = Σ w_sp · κ_sp
canopy  = Σ w_sp · canopy_sp        // used by fruiting (§7.4) and fire (§9.5)
```

The `decompF`/`yieldF` opposition is the whole species system: **fast stands are shallow, slow stands
are deep.** Birch is where you go when you need carbon *now*; pine is where you go when you need to
think.

### 6.6 Adjacency and barriers

Each region carries a 6-bit `barriers` mask over `HEX_DIRS`. A set bit means that shared edge is
impassable to hyphal advance (a stream, a deer trail, a forestry road, a limestone shelf).
Barriers are symmetric — generate once, write both sides.

Generation: three **barrier chains** are laid down at worldgen, each a random walk of 5–9 contiguous
edges from the map's outer boundary inward, never enclosing a region completely. Result: the forest
is cut into 4 irregular sectors, and the ring-3/4 rich stands are usually behind at least one barrier.

Barriers do three things:
1. They make **spore seeding** (§7.7) *necessary* rather than merely convenient — wind-borne spores
   cross barriers, hyphae do not.
2. They make `edges/nodes` (and hence C, §4.2) genuinely constrained by geography, so the
   connectivity bonus is a puzzle rather than a formality.
3. They give `bridging` (C5, 260 Ψ) a real feeling of unlocking the map.

Barrier edges are drawn on the canvas as a **break in the hex outline plus a 2 px offset stroke** —
readable at 30 px hex width, which is the actual constraint.

### 6.7 Discovery and information economy

Three states: **unknown → discovered → surveyed.**

- **Unknown**: drawn as a flat silhouette. No name, no data.
- **Discovered**: automatic when the region becomes adjacent to a claimed region, or when a spore
  lands in it (even a failed seeding attempt). Reveals name, terrain, species mix, current rival.
  Reveals `L` and `T` only as a **band**: `≈ 18 – 34 G`.
- **Surveyed**: costs 120 Σ, instant, requires `substrate_assay` (A5). Reveals exact `L`, `T`,
  `humus`, and adds a 2-line yield projection to the card.

The band width is `±0.28` of true value, seeded per-region so it does not shimmer. This is a cheap,
honest info-economy: it gives Signal an early sink that is not a project, it makes the frontier feel
uncertain, and it makes `substrate_assay` one of the most-loved purchases in the act because it turns
a fog into a spreadsheet.

### 6.8 Claiming, part 1 — hyphal advance

The contiguous, cheap, slow route. Requires an adjacent claimed region and a non-barrier edge.

```
ADV_BASE   = 1.80e6 g                                    [K]
ADV_GROWTH = 1.21                                        [K]

advanceCost(i) = ADV_BASE
               · ADV_GROWTH ^ claimedCount
               · terrainAdv(terrain_i)                   // Loam 1.0, Clay 1.15, Sand 0.9,
                                                         // Scree 1.4, Peat 1.3, Burn 0.75
               · (1 + 0.60 · ring_i)
               · advCostMult                             // 1.00 → 0.82 (rhizomorph) → 0.66 (highways)
               · (barrierCrossed ? 2.40 : 1.00)

advanceTime(i) = 45 s · (1 + 0.35 · ring_i) / advanceSpeed
```

At `claimedCount` 60: `1.21^60 = 9.3e4`, so the last region costs ≈ 1.67e11 g and the **whole
expansion programme costs ≈ 9.6e11 g**, about 18% of Act II's total extraction. Big enough to matter,
small enough that expansion is never the only thing you are doing.

While `advancing`, `colonization` fills linearly at `1/advanceTime` per second, modulated by rival
pressure (§8.3). Concurrent advances are limited by `advanceSlots`: **1 → 3 (`rhizomorph`, B2) →
6 (`highways`, C4) → 10 (`far_dispersal`, E1)**.

Cancelling an advance refunds `0.60 · spent`.

### 6.9 Names

Procedural, two-part, from three lists, seeded by region id so a name is stable forever:

```
QUALIFIER = [Old, Low, High, Black, White, Red, Long, Deep, Wet, Cold, Still, Sour,
             Broken, Standing, Hollow, Bare, Green, Blind, Thin, Far]
FEATURE   = [Beech, Oak, Pine, Birch, Hemlock, Alder, Elder, Ash, Rowan, Holly,
             Stone, Scree, Bog, Ford, Slope, Shelf, Bank, Ditch, Cairn, Fell]
FORM      = [Hollow, Stand, Reach, Bottom, Rise, Wood, Copse, Break, Ground, Sink,
             Turn, Fold, Cross, Bend, End, Lee, Shade, Draw, Head, Foot]

name(id) = pick(QUALIFIER, h1) + " " + pick(FEATURE, h2) + " " + pick(FORM, h3)
           // with a 45% chance of dropping the QUALIFIER for rhythm
// "Beech Hollow" · "Old Scree Break" · "Bog Bottom" · "Broken Alder Reach" · "Stone Lee"
```

Species in the name is correlated with the actual dominant species 70% of the time and deliberately
wrong 30% of the time, because that is how place names work.

### 6.10 Hyphal density

The per-region investment dial, and the second-biggest Biomass sink after necrotrophy pays out.
Bought in **ten steps of 0.1**. Requires biomass *and* minerals — this is what keeps Act I's contract
economy load-bearing for the whole of Act II.

```
densityStepCost(i, k) = 0.0035 · L0_i · 1.55^k          grams,   k = 0..9
densityStepMinerals(i,k) = 3.5e-4 · densityStepCost(i,k) ⛬
```

Full density on one region costs `0.0035 · L0 · (1.55^10 − 1)/0.55 = 0.59 · L0` — **maxing a stand
costs about six-tenths of what the stand holds in litter**, and the stand also holds 4× that in
standing biomass. It always eventually repays; it is rarely the *most* urgent purchase. That is the
correct shape for a per-unit upgrade in a game with 61 units.

`d` affects: decomposition rate (linearly), live interface (linearly), rival pressure (linearly),
fruiting maturation (weakly), and litterfall via `mycoBonus` (§9.2).

Density is the first thing automated (`turgor_auto`, C3) and the automation is a **target dial per
terrain class**, not a blanket "buy everything" — see §11.4.

---
