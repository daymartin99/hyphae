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

## 7. THE FLUSH — the risk/allocation sub-game

This is the answer to the teardown's §8.4: *"the stock market has no agency."* The player of
Universal Paperclips cannot choose a stock, a price, an amount, or a moment to sell. In HYPHAE the
player chooses **where**, **how much**, **what kind**, and — the one that matters — **when**.

It is not a market. It is a **weather bet with an interior optimum that moves.**

### 7.1 The object: a primordium

You commit Biomass to a knot of tissue in a region you hold. It matures over minutes. While it
matures it is exposed. When you release it, it disperses spores downwind. Spores are the ranged
territory currency (§7.7) and the Act III seedbank.

```js
{
  id, regionId,
  V:          2.0e9,      // grams of biomass committed (the bet size)
  m:          0.0,        // maturity; can exceed 1.0 (overripe)
  morph: {                // rolled at creation, VISIBLE immediately
    robustness: 0.94,     // 0.55 … 1.65   hazard divisor
    fecundity:  1.21,     // 0.60 … 1.80   yield multiplier
    hygro:      0.83      // 0.60 … 1.45   moisture sensitivity multiplier
  },
  bornAt, released: false, destroyed: false
}
```

Morph roll: each trait `= clamp(1 + 0.34·N(0,1), lo, hi)`, three independent draws, **shown as three
short bars on the card before you commit a single gram** — you see the morph, then decide the size of
the bet. A garbage morph is a cheap-and-quick flush; a 1.7-fecundity morph is worth loading up and
babysitting through a storm.

Slots: **1 → 4 (`sporulation_reflex`, C6) → 6 (`mast_synchrony`, D1) → 9 (`ballistospory`, E1)**.

### 7.2 The weather process

A mean-reverting Ornstein–Uhlenbeck walk plus a deterministic seasonal term. Updated at 1 Hz.
It is deliberately **autocorrelated and partly deterministic**, so it can be *learned*, which is the
whole point (teardown §8.12: UP's `6·sin(n)` had no trend, no momentum, no memory, and therefore no
skill).

```
θ      = 0.0100  /s        relaxation rate  (time constant 100 s)          [K]
σ      = 0.0280  /√s       volatility                                      [K]
Wbar   = 0.52              long-run mean moisture                          [K]
SEASON = 1800  s           the "season" period — 30 minutes                [K]

each 1 Hz weather tick (dt=1):
  season = 0.16 · sin(2π · t / SEASON)
  W ← clamp( W + θ·(Wbar + season − W)·dt + σ·sqrt(dt)·gauss(), 0.02, 0.98 )
```

Per-region moisture, derived (not simulated — 61 independent OU walks would be unreadable):

```
raw_i = W + moistOff(terrain_i) + 0.10 · sin(2π·t/SEASON + mPhase_i)
m_i   = clamp( terrain_i == CLAY ? (Wbar + 0.5·(raw_i − Wbar)) : raw_i , 0.02, 0.98 )
```

Clay literally halves the region's deviation from the mean — a physical fact about clay soils and a
mechanically real safe harbour.

Wind is a second, slower OU pair:
```
windSpeed: θ=0.004, σ=0.011, mean 0.45, clamp [0.02, 1.0]
windDir:   a continuous angle φ; dφ/dt = 0.0018·gauss() + 0.00035  (a slow prevailing rotation)
           discretised to the nearest of the 6 hex directions for seeding, but drawn continuously
```

### 7.3 The forecast — the thing you buy

The system knows `θ`, `Wbar`, and `season(t)` exactly. The forecast is therefore the honest
conditional expectation of an OU process, with an honest uncertainty band:

```
E[W(t+τ) | W(t)] = μ(t+τ) + (W(t) − μ(t)) · e^(−θτ)      where μ(t) = Wbar + season(t)
SD[W(t+τ)]       = σ · sqrt( (1 − e^(−2θτ)) / (2θ) )
```

The forecast strip draws `E ± 1.15·SD` (an 75% band) out to `forecastHorizon` seconds.

| Source | Horizon | Band |
|---|---|---|
| start of Act II | 0 s (current value only) | — |
| `barometry` (B4) | **120 s** | ±1.15 SD |
| `alarm_contracts` (C10) | +90 s **in contracted regions only** | ±1.15 SD |
| `mast_synchrony` (D1) | **300 s** | ±0.95 SD |
| `ballistospory` (E1) | **600 s** | ±0.75 SD |

Narrowing the band is the "buying the house edge" pleasure the teardown identifies in UP's
`stockGainThreshold` — but here it buys *information*, which the player must still act on. Two
players with the same forecast will make different, defensible calls.

**Legibility on a phone:** the strip is 44 px tall, full width, with the present at x=0 and the
horizon at x=100%. A single filled band, one centre line, one dotted line at the danger thresholds
(0.28 and 0.86), and a small ▲ marker at each primordium's projected optimal release time. That is
five drawing primitives and it is completely readable at arm's length.

### 7.4 Maturation

```
MAT_TIME = 240 s base                                                        [K]

dm/dt = (1 / MAT_TIME)
      · moistureF(m_region)                 // §9.1, hump function peaking at m=0.5
      · (0.55 + 0.45 · canopy_region)       // shade holds humidity
      · (0.70 + 0.30 · d_region)            // denser mycelium feeds it faster
      · matSpeed                            // 1.00 → 1.45 (B4) → 2.10 (D1) → 3.40 (E1)
```

At base, in a mid-canopy loam stand at ideal moisture with d=0.5: `dm/dt = 1/240 · 1.0 · 0.99 · 0.85
= 1/285` ⇒ ~4m45s to maturity. With all upgrades and a hemlock stand: ~70 s. So the flush cycle time
falls from ~5 minutes to ~1 minute across the act, which is exactly the pacing you want — the
sub-game gets *faster and more frequent*, not obsolete.

### 7.5 Hazards — why waiting is a bet

Each sim tick, for every unreleased primordium with `m > 0.15`:

```
HAZ_BASE = 0.0022 /s                                                          [K]

hazardEnv(W) = 1
             + 3.20 · max(0, 0.28 − m_region)        // desiccation
             + 2.60 · max(0, m_region − 0.86)        // waterlogging / bacterial rot
             + grazePressure(t)                       // §7.6

p_destroy = HAZ_BASE · m^2 · hazardEnv · morph.hygro / morph.robustness · hazMult
```

`m^2` is the crux: **exposure grows as the square of maturity while yield grows as `m^1.6`.** So
there is always a moment past which waiting is negative EV, and that moment depends on the weather,
which is why the forecast is worth money.

On destruction: you lose `(1 − 0.35·robustness) · V`. A robust morph salvages up to 58% of the bet.
Console gets one line, from a rotating list:
`> Slugs found it.` / `> It dried before it opened.` / `> Rot, from the inside.` /
`> Something with hooves.` / `> It never had a chance in that sand.`

### 7.6 Graze pressure — the slow cycle

A third, very slow deterministic cycle, period 900 s, so that the *background* danger level is
learnable on a longer horizon than the weather:

```
grazePressure(t) = 0.55 · max(0, sin(2π·t/900 + 1.1))^1.6
```
Peaks at 0.55 for about 200 s out of every 900. It is drawn as a second thin band on the forecast
strip. Its purpose is to create *seasons of caution* — periods where the right play is small, fast,
frequent flushes rather than big slow ones. That variation is what stops the sub-game becoming a
solved routine.

### 7.7 Release — the payoff, and the interior optimum

```
SPORE_K = 0.045                                                               [K]

spores_gained = SPORE_K
              · V^0.78                              // sublinear in bet size
              · m^1.60                              // superlinear in patience
              · overripePenalty(m)
              · dispersalF(windSpeed)
              · morph.fecundity
              · (0.70 + 0.30 · canopy_region)
              · sporeMult                           // 1.00 → 2.80 (E1) → ×6 during a Mast Year
              · firstFlushBonus                     // 3.00 for the first flush only, then 1.00

overripePenalty(m) = m <= 1.25 ? 1.0
                              : 1 − 0.55 · (m − 1.25)^1.40      // clamped at 0.15
dispersalF(ws)     = 0.45 + 0.85 · ws
```

**The optimum.** Expected value of holding one more second at maturity `m`:

```
dEV/dm ∝ 1.60·m^0.60 · overripePenalty       (marginal yield)
p_loss/dm  ∝ HAZ_BASE · m^2 · hazardEnv / (dm/dt)   (marginal risk of total loss)
```

Setting these equal gives an optimal release maturity `m*` that is **a function of `hazardEnv`,
which is a function of the weather**. Worked, at base constants, `dm/dt = 1/285`:

| condition | `hazardEnv` | `m*` | EV vs releasing at m=1.0 |
|---|---|---|---|
| ideal (m_reg ≈ 0.5, no graze) | 1.00 | **1.42** | **+66%** |
| mild drought (m_reg = 0.20) | 1.26 | 1.29 | +47% |
| hard drought (m_reg = 0.10) | 1.58 | 1.16 | +26% |
| waterlogged (m_reg = 0.95) | 1.23 | 1.31 | +49% |
| graze peak, ideal moisture | 1.55 | 1.17 | +27% |
| graze peak + hard drought | 2.13 | 1.02 | +3% |

So skilled play is worth **up to +66% per flush** over the naive "release at maturity" heuristic, and
the correct answer changes every couple of minutes. That is a real strategy layer.

The UI does **not** tell you `m*`. Once you own `barometry` it draws the ▲ marker at the *forecast-
implied* optimum, which is an estimate that can be wrong — and a player who reads the band and
overrides the marker beats the marker by ~9%. Three tiers of skill: naive, marker-following, band-
reading. That is the ladder UP's stock market never had.

### 7.8 Spores as a currency

```
spores decay:  spores ← spores · 0.99995^(seconds)        // half-life 3h51m
               (decay disabled by `seedbank`, E3)
```

Sinks:
1. **Spore seeding** (§7.9) — claim non-adjacent regions.
2. **Contest** — dump spores into a rival-held region to add `+0.00012 · spores^0.55` to your
   colonisation pressure there for 60 s.
3. **Act III seedbank** — everything you hold at the transition, plus a conversion of held biomass.

Decay exists so that spores are a *flow* to be spent, not a bank to be hoarded — mirroring the
biology and keeping the flush loop urgent. It is mild enough that a two-hour absence costs ~30%,
which is inside the offline generosity budget.

### 7.9 Claiming, part 2 — spore seeding

Requires `anemophily` (B3). Target must be **discovered** and **downwind** of a region you hold:
the angle between the wind vector and the vector (holder → target) must be < 60°, i.e. within one
hex direction of the current `windDir`. `ballistospory` (E1) removes the wind constraint entirely.

```
SEED_BASE   = 1.20e4 spores                                                   [K]
SEED_GROWTH = 1.34                                                            [K]

seedCost(i) = SEED_BASE
            · SEED_GROWTH ^ seededCount
            · (1 + 0.45 · ring_i)
            · (1 + 2.20 · rivalStr_i)
            · (windSpeed >= 0.6 ? 0.75 : 1.00)      // a strong wind is a discount

on seeding: colonization_i += 0.40 · (1 − rivalStr_i)   immediately, then normal advance
            (a seeded region continues to colonise WITHOUT an adjacent claimed region —
             this is the only way across a barrier before C5)
```

Whole-map seeding programme ≈ 3.0e8 spores, against a lifetime production of ~4e9. So seeding is
affordable but never free, and every seed is a decision to *not* bank toward the transition gate.

**Why this makes territory interesting rather than busywork:** advance is cheap, contiguous, and
raises `C`; seeding is expensive, ranged, and *lowers* `C` by creating disconnected nodes. So the two
verbs pull in opposite directions on your Signal rate, and the right mix depends on where the barriers
are, where the Scree is, and which way the wind has been blowing. There is no dominant expansion order
and the map is different every run.

### 7.10 Mast Years

Unlocked by `mast_synchrony` (D1). Every `2100 ± 400` seconds, announced **180 seconds in advance**:

```
> Something is being decided across the whole forest at once.       (T−180 s)
> MAST                                                               (T−0)
duration 90 s.  sporeMult ×6.0.  hazMult ×1.5.  matSpeed ×2.5.
```

During a mast year the correct play is: pre-load every slot so they mature *into* the window, then
release inside 90 seconds under elevated hazard. It is the highest-skill, highest-stakes 90 seconds in
Act II and it recurs roughly every 35 minutes for the rest of the act.

**This is the specific answer to the teardown's §6 endnote** — "once you own AutoTourney the whole
subsystem becomes a passive faucet; the strategic content has a lifespan of maybe 40 minutes." Mast
Years give the flush sub-game a permanently-renewing high-agency mode that automation cannot touch
(§11.4 caps auto-release at 0.78× of skilled play, and auto-release is *disabled* during a mast
window with a one-line warning, so the player either shows up or leaves ×6 on the table).

### 7.11 Panel layout (portrait)

```
FLUSH
────────────────────────────────────────
 W 0.61 ↗   WIND ▶ 0.52   MAST in 14:22
 ┌────────────────────────────────────┐
 │▁▂▃▄▅▅▅▄▃▂▁  forecast 300 s   ▲  ▲ │   44 px
 └────────────────────────────────────┘
 ┌────────────────────────────────────┐
 │ Beech Hollow      m 1.31  ▓▓▓▓▓▓▒  │
 │ rob ▓▓▓▓▒ fec ▓▓▓▓▓▓ hyg ▓▓▒       │
 │ 2.0 G committed        [ RELEASE ] │   88 px, RELEASE is 56 px tall, right-aligned
 └────────────────────────────────────┘
 ┌────────────────────────────────────┐
 │ + NEW PRIMORDIUM                   │
 └────────────────────────────────────┘
```

Every interactive element is ≥ 44 px and in the lower two-thirds of the screen. `RELEASE` is the only
right-aligned button in the game, because it is the one you press in a hurry with a thumb.

---

## 8. RIVALS AND CONTESTED GROUND

### 8.1 Why rivals exist

Not for combat. UP's combat is a screensaver (teardown §8.8) and we are not building one. Rivals exist
to do three things:

1. **Make the map asymmetric** — the richest ground is held by someone.
2. **Create a genuine "let it burn" temptation** — *Armillaria* kills trees, which converts standing
   biomass into litter *for free*. Letting it run is sometimes correct. That is a strategic dilemma
   with no clean answer, which is what we want.
3. **Punish strip-mining spatially** — a region whose density you cannibalised is a region rivals
   retake, so overextraction has a *territorial* cost as well as a cognitive one.

There is no battle screen. Contest is a continuous tug-of-war resolved by investments made minutes
earlier, and it is visible as one amber bar on a region card.

### 8.2 The four strains

| id | Name | `γ` growth | `agg` | Trait |
|---|---|---|---|---|
| 0 | ***Armillaria*** | 0.00040 | 1.30 | **Necrotroph.** Adjacent regions (yours or not) suffer `treeMortality += 1.8e-4 · R /s`. Killed biomass becomes litter at 0.92 efficiency. |
| 1 | ***Trichoderma*** | 0.00110 | 0.85 | **Mycoparasite.** Your `d` gain in adjacent regions is ×0.75, and `d` decays at `2.5e-4·R /s` in regions adjacent to it. |
| 2 | ***Phellinus*** | 0.00022 | 1.55 | **Entrenched.** Your pressure against it is ×0.60. Displacing it is slow and expensive. Sits on the best ground. |
| 3 | ***Fomitopsis*** | 0.00016 | 0.70 | **Brown rot.** Weak, but when displaced it leaves `humus += 0.20`. The pleasant neighbour. |

At worldgen, **9 regions in rings 2–4 are rival-held** at `R = 0.35 + 0.4·rand`, distributed one per
strain minimum, with *Phellinus* preferentially placed on the two highest-`L0` regions in the map.
Rivals spread to unclaimed adjacent regions:

```
every slow tick (0.5 Hz), for each rival-held region with R > 0.55:
    for each unclaimed, unheld adjacent region j (barriers do NOT stop rivals):
        if (random() < 0.0035 · γ_rival · 200)   // ≈ 1 spread per 4–20 min per strain
            j.rival = this.rival ; j.rivalStr = 0.12
```

Rivals do not attack *claimed* regions directly; they grow into the empty forest ahead of you. The
race is real and it is visible on the map as amber creeping outward while you creep outward.

### 8.3 Contest resolution

```
yourPressure_i  = d_i · antibiosis · (1 + 0.25 · claimedNeighbours_i) · pulseRepel_i
                  · (rival_i == PHELLINUS ? 0.60 : 1.00)
theirPressure_i = rivalStr_i · agg(rival_i) · rivalAgg(terrain_i)

d(colonization)/dt = (1/advanceTime_i) · ( yourPressure − theirPressure )
d(rivalStr)/dt     = γ · rivalStr · (1 − rivalStr) · (1 − d_i)   −  0.0009 · yourPressure
```

Both bars move on the same card. If `yourPressure < theirPressure`, colonisation goes **backwards** —
you can lose a contest, slowly and visibly, and the correct response is to invest (density, antibiosis,
a REPEL pulse) or to walk away. Nothing is instant, nothing is a dice roll, everything is a
consequence of a purchase you already made.

`antibiosis`: 1.00 → 1.55 (B5) → 2.35 (with `laccase`, C2, which also confers antibiosis).

**Retaking.** If a claimed region's `d` falls below 0.15 (which happens when you necrotize it and stop
maintaining it, or under *Trichoderma* decay) and a rival holds an adjacent region, that rival begins
contesting your claim: `rivalStr` seeds at 0.10 and grows normally. Losing a claimed region sets
`claimed = false`, zeroes its interface contribution, and costs you `C`. It is recoverable, and it is
the game telling you, spatially, that you left something to rot.

### 8.4 The Armillaria dilemma, with numbers

*Armillaria* at `R = 0.9` adjacent to one of your ring-3 stands (`T0 = 1.256e11`):

```
treeMortality = 1.8e-4 · 0.9 = 1.62e-4 /s
```
Over 600 seconds it kills `1 − e^(−0.0972) = 9.3%` of `T`, i.e. **1.17e10 g**, of which 0.92 lands in
your litter pile: **+1.07e10 g of free litter**, worth ≈ 1.3e10 g of Biomass at `yieldF = 1.23`.

The cost: `liveInterface` for that stand falls by `1 − 0.907^0.6 = 5.7%` per 10 minutes, compounding.

So *Armillaria* is a machine that converts your Signal into Biomass at a fixed exchange rate, running
whether you like it or not, and **you decide how long to leave it plugged in.** Killing it costs a
REPEL pulse chain plus density investment; leaving it costs cognition. This is the whole act's thesis
delivered by an NPC.

There is no dialogue about it. There is an amber bar and a number going down.

---

## 9. CONSUMPTION PRESSURE — the tragedy, with numbers

### 9.1 Decomposition

Per claimed region, per second:

```
KAPPA = 6.20e-4  /s                                                            [K]

moistureF(m) = 0.10 + 3.60 · m · (1 − m)          // hump, peaks 1.00 at m=0.5
humusF(h)    = 0.45 + 0.55 · h

decomp_i = KAPPA
         · E                       // enzymePower, global, 1.00 → ~26 across the act
         · d_i
         · decompF_i               // species lignin, §6.5
         · moistureF(m_i)
         · humusF(h_i)
         · (terrain_i == PEAT && !aerenchyma ? 0.45 : 1.00)
         · surgeMult_i             // pulse, §11.2
         · L_i

L_i     -= decomp_i · dt
gain_i   = decomp_i · (1 − ρ_i) · yieldF_i · yieldMult
biomass    += gain_i · dt
cumBiomass += gain_i · dt
extracted  += gain_i · dt
```

Note `moistureF` is a **hump**, not a ramp: fungi want damp, not drowned. This is why Peat (moistOff
+0.34) is a problem before drainage and why a drought is a global slowdown, not just a fruiting
hazard. Weather therefore couples to the *main* production loop, which means the forecast strip is
useful even to a player who ignores the flush panel.

`decompF` for pure birch = 1.07, pure pine = 0.65: a **1.65× spread** in rate, inverted by a 1.27×
spread in `yieldF`. Net, birch stands are 1.35× faster in grams-out per gram-of-litter-per-second and
carry 39% less litter per hectare. Fast and shallow.

### 9.2 The living forest

```
λ  = 5.50e-9  /s        litterfall coefficient                                [K]
g  = 1.60e-8  /s        tree growth coefficient                               [K]
Tmax_i = 1.35 · T0_i

mycoBonus_i = 1 + 0.75 · min(1, d_i) · kappa_i          // your partnership feeds the tree

dT/dt = g · T_i · (0.25 + 0.75·h_i) · (1 − T_i/Tmax_i) · mycoBonus_i
      −     T_i · ( 9.0e-7 + armillariaPressure_i + necroRate_i )

litterfall_i = T_i · λ · (0.55 + 0.45·h_i)
L_i += ( litterfall_i + mortality_i · 0.92 ) · dt
```

**The equilibrium that defines everything.** Net standing biomass change is positive iff growth
exceeds litterfall+mortality. At `d=1, kappa=1, T=T0`:

| `h` | growth term | litterfall | net `dT/dt` | verdict |
|---|---|---|---|---|
| 1.00 | 6.62e-9·T | 5.50e-9·T | **+1.12e-9·T** | stand thickens |
| 0.60 | 5.09e-9·T | 4.51e-9·T | **+0.58e-9·T** | stable |
| 0.35 | 4.13e-9·T | 3.90e-9·T | **+0.23e-9·T** | marginal |
| 0.15 | 3.36e-9·T | 3.42e-9·T | **−0.06e-9·T** | slow decline |
| 0.00 | 2.78e-9·T | 3.02e-9·T | **−0.24e-9·T** | dying |

**Humus is the switch between a renewable stand and a mine.** Above h ≈ 0.28 a stand sustains itself
forever; below it, the stand is on a decades-long (in-game: ~2 hour) slide to zero, and with it goes
its Signal.

### 9.3 The Retention dial — one dial, no correct setting

Each region has `ρ ∈ [0, 0.80]`: the fraction of decomposed carbon you **return to the soil** instead
of taking as Biomass. Global default plus up to **5 pinned per-region overrides** (10 with `homeostasis`,
D5).

```
HUMUS_SCALE_i = 0.045 · L0_i

hIn_i  = decomp_i · ρ_i · 0.16 / HUMUS_SCALE_i
hOut_i = ( 2.80e-4 + 9.50e-4 · (1 − ρ_i) ) · h_i
       · (terrain_i == BURN ? 0.40 : 1.00)              // charcoal holds soil
dh/dt  = hIn_i − hOut_i
```

Equilibrium humus by `ρ` (at `d=1`, `L ≈ 0.5·L0`):

| ρ | `h_eq` | gross kept `(1−ρ)` | `humusF(h_eq)` | **net rate** | tree trend |
|---|---|---|---|---|---|
| 0.00 | 0.00 | 1.00 | 0.450 | **0.450** | dying |
| 0.15 | 0.15 | 0.85 | 0.533 | **0.453** | slow decline |
| 0.30 | 0.36 | 0.70 | 0.648 | **0.454** | marginal |
| 0.45 | 0.66 | 0.55 | 0.813 | **0.447** | stable |
| 0.60 | 1.00 | 0.40 | 1.000 | **0.400** | thickening |
| 0.75 | 1.00 | 0.25 | 1.000 | **0.250** | thickening |

**Read the "net rate" column.** Between ρ = 0 and ρ = 0.45 the short-run Biomass rate is flat to
within 1.5%. This is deliberate and it is the most important balance property in Act II:

> **The Retention dial is free in the short run and decisive in the long run.**

A player optimising the number in front of them will find no signal and will set it wherever. A player
who has understood the act will set it deliberately, because ρ actually controls:

- **Tree survival** ⇒ `liveInterface` ⇒ Signal ⇒ Insight ⇒ every multiplier (§4.1)
- **Fire risk** (§9.5) — low humus + low moisture burns
- **Reclaimability** — a region at `h = 0` can never be brought back
- **Fruiting yield** — via canopy, which depends on `T`
- **`LEGACY`** ⇒ Act III's genetic fidelity ⇒ the wild-strain threat (§13.4)

That is a dial with no correct setting whose consequences all arrive later than the decision. It is
the teardown's principle 10 executed with actual teeth.

**UI:** a single horizontal slider, 56 px tall, full width, with three labelled detents:
`TAKE  ·  HOLD  ·  FEED` at ρ = 0.10 / 0.35 / 0.60. Never shows the number ρ; shows the *consequence*:
`soil: falling` / `soil: holding` / `soil: building`. Pinned regions show a small ◈ on their card.

### 9.4 The stock/flow reality check — stated plainly

Total forest carbon:
```
LITTER_BASE   = 1.15e10 g       ring-0 loam baseline litter
STANDING_BASE = 4.60e10 g       ring-0 loam baseline standing tree biomass
ringMult(r)   = 1 + 0.55·r      // 1.00, 1.55, 2.10, 2.65, 3.20
Σ ringMult over 61 hexes = 160.0

L0_total = 160 · 1.15e10 · ⟨terrain·species mods⟩ ≈ 1.84e12 g       ("1.84 T")
T0_total = 160 · 4.60e10 · ⟨mods⟩                 ≈ 7.36e12 g       ("7.36 T")
FOREST_TOTAL = 9.20e12 g
EXTRACT_TARGET = 5.20e12 g      // the act-completion denominator                [K]
forestConsumed = extracted / EXTRACT_TARGET
```

**80% of the forest's carbon is alive.** The renewable flow — total litterfall across all 61 stands at
full health — is ≈ **3.3e4 g/s**, against an endgame extraction rate of ≈ **6.4e9 g/s**. That is
**0.0005%**.

Be honest about this in the design: *the renewable flow is not an alternative economy.* It cannot
fund the act and it is not meant to. Its job is to keep a stand's trees alive — and therefore its
Signal contribution alive — during the long periods when you are eating something else. The tragedy
of the commons in HYPHAE is **not** "sustainable vs. extractive". It is:

> **You will eat the forest. The question is the order, the rate, and what is still standing when
> you need to think.**

Litter alone (1.84e12) supplies only 35% of `EXTRACT_TARGET`. **You must kill at least
`(5.20 − 1.84)/7.36 = 46%` of the standing forest to finish Act II.** The remaining 54% is the
strategic space, and it maps directly onto `LEGACY`.

### 9.5 Fire — the commons punishing you directly

```
each slow tick (0.5 Hz), for each region with L > 0:
    dry = (h_i < 0.22) && (m_i < 0.26)
    fireRisk_i += dry ? (0.0055 · (0.22 − h_i)/0.22 · terrainFire_i · (1 − 0.55·canopy_i))
                      : −0.0090
    fireRisk_i = clamp(fireRisk_i, 0, 1)
    if (fireRisk_i > 0.85 && random() < 0.030) → IGNITE
```
`terrainFire`: Loam 1.0, Sand 1.8, Clay 0.7, Scree 1.2, Peat 2.4 (peat fires are real and terrible),
Burn 0.3.

**On ignition:**
```
L_i        ← 0.15 · L_i          // 85% of the litter is simply gone. Not converted. Gone.
T_i        ← 0.30 · T_i
d_i        ← 0.25 · d_i
humus_i    ← 0.45                // ash
terrain_i  ← BURN                // permanently
species_i  ← rebalanced 60% toward Birch (pioneer succession)
contract_i ← null
fireRisk_i ← 0
spread: each non-barrier neighbour with fireRisk > 0.55 ignites 1 slow-tick later
        (disabled entirely by `firebreak`, D6)
```

Console, three lines over three seconds:
```
> Old Scree Break is burning.
> Nothing is being decomposed. It is being deleted.
> [ 4.1 T of litter lost ]
```

A mid-act fire in a ring-3 stand destroys ~4e10 g of litter — roughly **twelve minutes of total
production at that point in the act.** It is the single most punishing event in Act II and it is
**entirely self-inflicted**: it requires you to have driven humus below 0.22, which requires ρ near
zero, which you chose because the short-run rate looked identical.

That is the teardown's principle 5 — *make the player complicit in the mechanic they will later
regret* — executed precisely. UP made you the wire inflation. HYPHAE makes you the drought.

`firebreak` (D6, 520 Ψ + 8.0e10 g) reduces ignition probability ×0.25 and stops spread. It is
deliberately priced so that the first fire happens *before* you can afford it.

### 9.6 Necrotrophy — the turn

`necrotroph` (C1, 240 Ψ + 90,000 Σ), available at `forestConsumed ≥ 0.22`.

Title: **"Necrotrophic Conversion."** Description: **"Stop asking."**

It unlocks a per-region action, `KILL STAND`, with a confirmation that is one word (`KILL`) and a
consequence line that is one sentence.

```
necroRate_i = 0.00085 /s · necroMult      // necroMult 1.00 → 3.00 with `total_conversion` (D9)
while necrotizing:
    killed   = T_i · necroRate_i · dt
    T_i     -= killed
    L_i     += killed · 0.92
    contract_i = null            // immediately and permanently
    region.necrotized = true     // irreversible flag; T can never regrow
```

Half-life of a stand under necrotrophy: `ln2 / 0.00085 = 815 s` (13.6 min), or 272 s with D9.

**The exchange rate, stated exactly.** For a ring-3 loam stand (`T0 = 1.256e11`, `L0 = 3.15e10`):

| | keep it alive | kill it |
|---|---|---|
| Biomass delivered | litterfall only: `4.5e-9 · T = 565 g/s` forever | `+1.156e11 g` of litter over ~40 min, then nothing |
| `liveInterface` contribution | ≈ 1.00 (at d=1, contracted, loam/beech) | → 0.00, permanently |
| Signal cost at Σinterface = 45 | — | `(46.0^0.85 − 45.0^0.85)/45.6^0.85 = 1.87%` of **all** Signal |
| Fruiting in that stand | full canopy | canopy → 0.15 within 20 min |
| `LEGACY_LIFE` cost | — | `1.256e11 / 7.36e12 = 1.71%` of the act's legacy budget |

Killing forty stands out of sixty-one is roughly **−52% Signal, −52% Insight rate**, in exchange for
finishing the act about 35 minutes sooner. Both are real strategies. The game never says which is
better, and the *ending you can reach in Act III* differs.

### 9.7 The decline arc — the act's real shape

Because `decomp ∝ L` and `L` is a depleting stock, and because Signal ∝ live interface which
necrotrophy destroys, the act's production curve is **not** monotone. Modelled over a typical run:

| `forestConsumed` | elapsed | `decompRate` | `Sr` | what it feels like |
|---|---|---|---|---|
| 0% | 0:00 | 4.0e3 g/s | 2.5 /s | quiet |
| 8% | 0:22 | 6.1e5 | 41 | opening out |
| 25% | 0:58 | 2.8e7 | 310 | mastery |
| 45% | 1:34 | 4.4e8 | 1,180 | the machine hums |
| 65% | 2:09 | 2.9e9 | 3,400 | peak breadth |
| **80%** | **2:34** | **8.1e9** | **5,300 ← PEAK SIGNAL** | everything is enormous |
| 88% | 2:51 | **1.05e10 ← PEAK CARBON** | 4,600 ↓ | *something is wrong* |
| 94% | 3:04 | 8.9e9 ↓ | 2,900 ↓ | stands going dark on the map |
| 97% | 3:12 | 6.4e9 ↓ | 1,900 ↓ | the gate is affordable, barely |
| 100% | 3:18 | 3.1e9 ↓ | 1,100 ↓ | there is nothing left to say |

**Peak Signal precedes peak Carbon by about 17 minutes, and both precede the end.** The last 25
minutes of Act II are a managed decline in which every number you have spent three hours growing is
visibly falling and you are spending everything down to reach a single button. No incremental game
ends an act this way. It is the correct ending for this fiction and it is *emergent* — nothing in the
code scripts a decline; the decline is what happens when a system eats its own substrate.

**The mercy rule.** A player who necrotizes too aggressively too early can, in principle, crater their
Signal below the level needed to afford the transition. `last_light` (E2, 1,300 Ψ, trigger
`forestConsumed ≥ 0.88`) sets a floor:
```
Sr = max( Sr_computed, 0.40 · SrPeakEverSeen )
```
Title: **"Photoreception."** Description: **"Learn to face the sky."** It is a real project with real
flavour that happens to be an anti-softlock device, in the tradition of *Beg for More Wire*.

---
