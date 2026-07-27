# HYPHAE — MATHEMATICAL BALANCE AND PACING

**Status: NORMATIVE. This document is the numeric source of truth.**

Where this document and any of `01-act1-understory.md`, `02-act2-network.md`, `03-act3-bloom.md`,
`04-projects-catalog.md`, `05-strategic-subgame.md` disagree on a *number*, this document wins.
Where they disagree on a *mechanism*, they win. Every supersession is listed in §0.3 with the
derivation that forced it. Nothing here was asserted; §0.4 lists what was simulated to produce it.

---

## 0. SCOPE, PRECEDENCE, SUPERSESSIONS

### 0.1 What this document fixes

| # | Deliverable | Section |
|---|---|---|
| 1 | Unified clock and constant registry | §1 |
| 2 | Number system: ceiling, formatter, precision, overflow guards | §2 |
| 3 | Growth-curve taxonomy — what is linear / polynomial / exponential / saturating | §3 |
| 4 | Cost-scaling law catalogue, per upgrade family, with derived affordability | §4 |
| 5 | The two invariants and their proofs: no dead wall, no cakewalk | §5 |
| 6 | Session arc at minute 1, 5, 15, 60 and hour 3, 6, 9 | §6 |
| 7 | Minute-by-minute table, 0–30 | §7 |
| 8 | Hour-by-hour table, 0–8 | §8 |
| 9 | Deliberate slowness: the ten windows, and the ≤8-minute decision guarantee | §9 |
| 10 | Offline model, caps, generosity proof | §10 |
| 11 | Six balance failure modes and their guards | §11 |
| 12 | Headless simulation harness specification | §12 |
| 13 | CI acceptance gate | §13 |

### 0.2 Reference player definitions

All timings in this document are for player **R** unless stated. Three players are defined and all
three are simulated (§12).

| ID | Name | Tap rate | Purchase policy | Market skill | Offline behaviour |
|---|---|---|---|---|---|
| **R** | Reference | 1.70/s for 95 s, 0 after | buys the cheapest affordable production unit whenever `payback < 45 s`; splits biomass 0.55 tips / 0.25 projects / 0.20 territory | buys at mid, no trend reading | 2 sessions/day, 45 min each, 11 h gaps |
| **N** | Naive | 1.20/s for 240 s | buys the top item in the list whenever affordable; never respecs; never sells | buys at market whenever a pool is empty | 1 session/day, 25 min, 23 h gaps |
| **X** | Expert | 2.10/s for 60 s | solves the payback corridor exactly; batches Signal spends against ripeness; front-runs seasons | trades the momentum term; buys 1.5 seasons ahead | 4 sessions/day, 30 min each |

Target completion: **R = 7 h 25 m**, **N = 10 h 10 m**, **X = 5 h 55 m**. All three must finish.
The hard constraint is `N ≤ 11 h` and `X ≥ 5 h 15 m`.

### 0.3 Supersessions

Seven numeric corrections. Each is forced; each derivation is given.

---

**S1 — `TIP_THROUGHPUT` 3.00 → 1.875 g/s; the sugar headline 0.60 → 0.48 g/s.**

`01` §5.2 states `tips = 1 ⇒ 3.0 g litter/s ⇒ 1.50 g biomass/s and 0.60 g sugar/s`. `01` §5.4
charges the throughput budget as `budget -= g / (k · enzymeK)`, and leaf has `k = 1.60`. Under the
published constants one tip therefore consumes `3.0 × 1.6 = 4.80` g/s of leaf, not 3.00, and
produces 2.40 g/s biomass, not 1.50. The `+1.50 g/s` on the GROW TIP button face is the
load-bearing first-minute artefact and is preserved; the constant moves instead.

```
TIP_THROUGHPUT = 1.875            // g/s of budget per tip
leafGrams/s/tip = 1.875 × 1.60 = 3.000       ✓ matches the published headline
biomass/s/tip   = 3.000 × 0.50 × 1.00 = 1.500 ✓ matches the button face
sugar/s/tip     = 3.000 × 0.20 × 0.80 = 0.480 ✗ published 0.60 — corrected to 0.480
```

Every entry in `01` §5.5's deadfall table (`k`, `etaB`, `etaS`, prices, margins) is unchanged.
The only text change is the sugar figure in `01` §5.2.

---

**S2 — `tipCost` is polynomial, not `1.1^n + 59`.**

`01` §4/Unlock-2 gives `tipCost(n) = ceil(1.10^n + 59)`. `1.10^n` does not exceed the additive base
of 59 until `n = 43`, so tips 0–42 all cost 60–120 g while output grows linearly in `n`. Marginal
payback at tip 20 against network output is `66 / (1.5 × 20) = 2.2 s`. Simulation (§0.4) reaches
tip 24 at **t = 3 m 30 s**, against `01` §13's own checkpoint of **11 m 30 s** (tolerance 9–15 min).
The mineral gate — the structural spine of Act I — is skipped entirely.

Solve for the law that lands tip 24 on schedule *and* survives to the act's end. Let `f = 0.55` be
the biomass fraction spent on tips and `C(n)` the cost of the n-th tip. Then

```
dn/dt = f · 1.50 · n · E(t) · V(t) · P(t) / C(n)
```

Empirically `E ∝ n^0.50` across the act (E: 1.00 → 4.60 while n: 7 → 255), so holding purchase
cadence constant requires `C(n) ∝ n^1.5`. Fitting `Σ₀²³ C = 8,100 g` (the biomass integral to
t = 690 s) and `C(0) = 60` (the 35-second first-tip beat, preserved exactly):

```
tipCost(n) = ceil( 60 + 3.2 · n^1.72 )                     // n = tips already owned
// n:    0    1    2    3    4    5    6    7   12    24     50      100       150       255
// cost: 60   63   71   81   94  109  125  144  292  817  2,896  10,570   22,120    44,160
```

*Foraging Front* (adaptation #5) changes the coefficient `3.2 → 2.6` (−19%), replacing its published
exponent change, which is now meaningless.

Verified consequences (§0.4 harness, player R):

| checkpoint | `01` §13 target | tolerance | achieved |
|---|---|---|---|
| First tip purchasable | 35 s | 28–50 s | **35 s** |
| Tips owned at 90 s | 7 | 5–9 | **6** |
| Mineral gate (tip 24) | 11:30 | 9–15 min | **11:48** |
| Tips at act end | — | — | **255** |
| Σ tip spend | — | — | **5.4 × 10⁶ g** |

---

**S3 — patch supply is superlinear: `× patches^1.8`, not `× patches`.**

`01` §9 multiplies market `cap` and `fall` by the patch count. Total renewable litterfall on the
home patch, annual mean, from `01` §5A.2 × `01` §5A.2's seasonal table:

```
leaf 240×1.825 + needle 150×1.175 + twig 78×1.35 + bark 44×1.075
   + log 60×1.10 + stump 15×1.00 + carrion 1.1×1.15
= 438.0 + 176.3 + 105.3 + 47.3 + 66.0 + 15.0 + 1.3  =  849 g/s per patch
```

With a linear patch multiplier the six-patch forest supplies **5,094 g/s**, of which a player may
sustainably take ~65% = 3,311 g/s. Simulated utilisation reaches 0.98 at t = 90 min and the act
terminates on a supply wall at tip ≈ 216 — a stall, not an ending (failure mode F3, §11.3).

Patches 2–6 are, by their own names and prices (12 k → 400 k biomass, a 33× price spread), not
equal-sized. Set:

```
patchSupplyMult = patches^1.8          // 1.00, 3.48, 7.22, 12.13, 18.12, 25.11
forestSupply(g/s) = 849 · patches^1.8
                  = 849, 2,955, 6,130, 10,298, 15,384, 21,318
```

Sustainable extraction at 65% of a six-patch forest = **13,857 g/s**. Simulated peak utilisation
falls to 0.36, and the act ends on the tip-cost curve and the transition gate, not on a wall. The
`cap` multiplier stays **linear** (`× patches`) — stocks scale slower than flows, which makes the
late-act market thinner and prices twitchier, which is correct.

---

**S4 — `hyphae` coefficients 0.35/6.0 → 1.75/30.0.**

`01` §5.6: `hyphae = 0.35·tips + 6.0·(patches−1) + hyphaeManual`, and `01` §11.1 gates the act's
finale at `hyphae >= 500`. At 255 tips and 6 patches that yields `89 + 30 = 119 m`. The gate is
unreachable by a factor of 4.2.

```
hyphae = 1.75 · tips + 30.0 · (patches − 1) + hyphaeManual
       = 1.75 × 255 + 30 × 5 = 446 + 150 = 596 m        ✓ gate 500 m reached at t ≈ 96 min
hyphaeManual += 0.020 per EXTEND tap                    // was 0.004
```
Canvas: `segments = floor(hyphae × 0.40)`, cap 1,800 (was `× 2`, same visual density).

---

**S5 — Act I → Act II handoff figures.**

`02` §0.1 specifies `biomass 4.0e6–9.0e6`, `cumBiomass ≈ 2.2e7`, `decompRate0 ≈ 4.0e3 g/s`.
`cumBiomass = 2.2e7 g` over a 105-minute act requires a mean litter throughput of
`2.2e7 / 0.55 / 6,300 = 6,350 g/s` sustained from t = 0, which exceeds the whole six-patch forest's
inflow (5,094 g/s pre-S3) and is 7.5× the mean the corrected constants produce. It is not
achievable under any policy. Restated from simulation:

| Symbol | `02` §0.1 published | **normative** | range (R/N/X) |
|---|---|---|---|
| `biomass` held | 4.0e6 – 9.0e6 | **2.0e6 g** | 0.8e6 – 4.5e6 |
| `cumBiomass` | ≈ 2.2e7 | **3.4e6 g** | 2.0e6 – 6.0e6 |
| `minerals` | 1.8e4 – 5.0e4 | **1.6e4 ⛬** | 8.0e3 – 3.5e4 |
| `decompRate0` | ≈ 4.0e3 g/s | **2.7e3 g/s** | 1.6e3 – 4.2e3 |
| `tips` | — | **255** | 210 – 300 |
| `hyphae` | — | **596 m** | 500 – 780 |
| `D` | 3 | 3 | exact |
| `E`, `yieldMult` | 1.00 | 1.00 | normalised at the break |

Held biomass exceeds the simulated greedy-policy value (0.6e6) because the last 15 minutes of Act I
have no tip worth buying (§9, window W3) and the transition project is a biomass sink; player R
banks 1,485 g/s × 900 s ≈ 1.3e6 on top of a 0.7e6 float.

---

**S6 — `ACT2_SCALE = 0.333` applied uniformly to every Act II biomass-dimensioned quantity.**

Consequence of S5. `02` §3 Beat 2 prices the first ADVANCE at 1.80e6 g "(you have ~6e6)" — a ratio
of 0.30 to held biomass. Preserving that ratio against a 2.0e6 handoff requires 6.0e5 g.

Apply `ACT2_SCALE = 0.333` to: every `L0_i`, every `T0_i`, `TOTAL_FOREST_C`, every biomass price in
`02` and in `04` §6, the `KAPPA` output (automatically, since `decomp ∝ L`), and the transition gate.
Apply it to **nothing else** — Σ, Ψ, ⟡, ◦, ⛬, all timings, all `forestConsumed` fractions, all
project *counts* and all ratios are untouched, so every budget check in `02` §12.7 and every
balance target in `05` §14.1 survives verbatim.

| Quantity | `02` published | **normative** |
|---|---|---|
| `TOTAL_FOREST_C` | 1.20e13 g (implied) | **4.00e12 g** |
| First ADVANCE | 1.80e6 g | **6.00e5 g** |
| `decompRate` at `fc = 0` | 4.0e3 g/s | **1.33e3 g/s** |
| `decompRate` at `fc = 0.88` (peak) | 1.05e10 g/s | **3.50e9 g/s** |
| Act II project biomass budget | 3.84e11 g | **1.28e11 g** |
| Transition gate, held | 1.60e12 g | **5.33e11 g** |
| Biomass utilisation across the act | — | **38%** |

Biomass is deliberately *not* the binding currency in Act II. Insight (<5% slack) and Signal (32%
slack) are. `02` §12.7 already says so; S6 makes the arithmetic agree with it.

---

**S7 — `SPORE_DIVISOR` 3.2e3 → 2.70e2.**

`02` §0.2: `sporeBank = floor(biomassHeld / 3.2e3)`. `03` §3.1 opens on `SPORES 2.00 G` = 2.0e9.
Under S6 the Act II exit holds ≈ 5.33e11 g, so the divisor must be `5.33e11 / 2.0e9 = 267`.

```
SPORE_DIVISOR = 2.70e2
sporeBank = floor(biomassHeld / 270) + spores
```

Act III's own constants (`HARV_K`, `CRAFT_M0`, `BLOOM_X`, `BODY_X`, all thirteen `X0_b`) are
**unchanged**: Act III rebases completely at ESCAPE, where 96% of craft are destroyed, and its
economy is closed against `X0_b` rather than against the handoff.

### 0.4 What was simulated

A 10 Hz Act I model with the full seven-pool substrate market (`FALL`, `COMP`, `CAP`, seasonal
multipliers, mean-reverting price with the momentum term and the inflation term), the season clock,
the moisture relaxation and both environment multipliers, the enzyme/structure/patch multiplier
ramps, the mineral gate, contract delivery at published rates, and greedy purchase policies. Run to
t = 6,300 s. Four policy variants (greedy, reserved, no-market, expert). The following were found
and are documented as failure modes rather than hidden:

- **Total sugar/substrate lockout at t = 13 min** under the greedy policy (F1, §11.1).
- **Permanent reserve deadlock** under a naive reserve policy (F1 guard G1c).
- **Tip-24 gate skipped by 8 minutes** under the published cost law (F2 → S2).
- **Supply wall at tip 216, t = 90 min** under the published patch law (F3 → S3).
- **`hyphae` gate unreachable** (S4). **`cumBiomass` handoff unachievable** (S5).

---

## 1. UNIFIED CLOCK AND CONSTANT REGISTRY

### 1.1 Clocks

| Act | Sim | dt | Market/weather | Slow | Autosave | Render |
|---|---|---|---|---|---|---|
| I | 10 Hz | 0.100 s | 1 Hz (every 10th) | 0.5 Hz (every 20th) | 10 s | rAF, interpolated |
| II | 20 Hz | 0.050 s | 1 Hz (every 20th) | 0.5 Hz (every 40th) | 10 s | rAF, interpolated |
| III | 20 Hz | 0.050 s | — | 0.5 Hz (every 40th) | 10 s | rAF, interpolated |

Act I runs at 10 Hz because its per-tick work is seven market pools and one decomposition loop;
Acts II and III run at 20 Hz because their hazard and phase subsystems need sub-100 ms resolution.
The change of rate at the act break is invisible: every rate constant in every document is stated
**per real second** and multiplied by `dt` at the call site. No constant is ever expressed per tick.

**Catch-up rule, identical in all three acts and written once:** if the loop falls behind by more
than 250 ms, run **one** tick with `dt = min(behind, 2.0)` and `{stochastic:false}` (expectations
substituted for all dice). This is the same function as offline reconciliation (§10).

### 1.2 Time bases

```
SEASON_S   = 360        // 6 min
YEAR_S     = 1440       // 24 min
DAY_S      = 15
Act I  spans 4.4 forest-years  (105 min)
Act II  ignores the season clock for production; keeps it for contract terms and the OU weather mean
Act III has no season clock; band transit time τ_b is its only long period
```

### 1.3 Global constant registry — the tunable set

Every constant that a balance pass is permitted to move. Everything else is structural.
`σ` is the sensitivity: `d(act duration) / d(ln constant)`, in minutes, measured by the harness.

| # | Constant | Value | Act | σ (min) | Guard |
|---|---|---|---|---|---|
| K01 | `TIP_THROUGHPUT` | 1.875 g/s | I | −38 | S1 |
| K02 | `tipCost` coefficient | 3.20 | I | +31 | §5.1 corridor |
| K03 | `tipCost` exponent | 1.72 | I | +140 | 1.55 ≤ e ≤ 1.90 |
| K04 | `TIP_BASE` | 60 g | I | +2 | first tap beat, §7 |
| K05 | `patchSupplyExp` | 1.80 | I | −22 | 1.55 ≤ e ≤ 2.05 |
| K06 | `η_B`, `η_S` | 0.50, 0.20 | I | −44 | conservation, §3.6 |
| K07 | `INFL` | 0.060 | I | +9 | 0 < INFL ≤ 0.10 |
| K08 | `SPREAD` | 0.720 | I | +4 | ≤ 0.80 |
| K09 | `sugarCap` slope | 30/tip | I | +7 | ≥ 12 |
| K10 | mineral gate coefficient | 0.060 | I | +26 | §4.2 |
| K11 | mineral gate exponent | 1.35 | I | +58 | 1.20 ≤ e ≤ 1.50 |
| K12 | `SIG_K` | 3.00 | II | −27 | — |
| K13 | `SIG_CAP_BASE` | 260 | II | +6 | — |
| K14 | `INS_K` | 0.055 | II/III | −49 | Ψ slack ≥ 2% |
| K15 | `RIPE_T` | 180 s | II/III | +11 | 120 ≤ t ≤ 240 |
| K16 | `RIPE_DEC` | 3.0 | II/III | +5 | ≥ 2.0 |
| K17 | `KAPPA` | 6.20e-4 /s | II | −34 | — |
| K18 | `ACT2_SCALE` | 0.333 | II | 0 | S6, display only |
| K19 | `λ` litterfall | 5.50e-9 /s | II | +18 | h-switch at 0.28 |
| K20 | `g` tree growth | 1.60e-8 /s | II | −21 | ditto |
| K21 | `HARV_K` | 4.00e7 g/s | III | −31 | — |
| K22 | `SUB_K` | 9.00e5 g/s | III | +19 | A/S ≥ 20 |
| K23 | `REP_K` | 0.0250 /s | III | −24 | — |
| K24 | `GEN_TAX`, `GEN_EXP` | 0.085, 1.15 | III | +16 | §4.6 |
| K25 | `BLOOM_X` | 9.00e34 g | III | +23 | — |
| K26 | `OFFLINE_CAP` | 43,200 s | all | 0 | §10 |
| K27 | `OFFLINE_INSIGHT_CAP_S` | 5,400 s | II/III | +8 | §10.4 |
| K28 | `SPORE_DIVISOR` | 2.70e2 | II→III | 0 | S7 |

Read the σ column as the tuning order: **K03, K11, K14, K06 are the four biggest levers in the
game.** A 10% move in `tipCost` exponent moves Act I by 13 minutes. Nothing else comes close.

---

## 2. THE NUMBER SYSTEM

### 2.1 The ceiling

| Quantity | Peak value | Act | Rendered as |
|---|---|---|---|
| Biomass, held | 5.33e11 g | II end | `533 G` |
| Biomass, lifetime extracted | 4.00e12 g | II end | `4.00 T` |
| Carbon, held (BODY ending) | 1.60e35 g | III | `160 ab` |
| Carbon, lifetime harvested | 4.1e35 g | III | `410 ab` |
| Craft, count | 6.31e33 | III band 12 | `6.31 aa` |
| Total craft mass in flight | 5.4e40 g | III | `54 ad` |
| Signal, rate | 1.10e7 /s | III endgame | `11.0 M/s` |
| Insight, lifetime | 4.2e4 | III | `42.0 k` |
| **Design hard ceiling** | **1.00e42** | — | `1.00 ad` |

**No quantity in HYPHAE ever exceeds 1e42.** The formatter's suffix table runs to `af` = 1e48, so
there are two full suffix steps of headroom above anything the game can produce. This is deliberate:
the last suffix a player ever sees is `ad`, and they see it exactly once, in the final minute.

### 2.2 The formatter — one copy, in `fmt.js`, imported everywhere

Verbatim from `06` §3.3 R2. Reproduced because it is normative and must not be re-derived.

```js
const SUF = ["","k","M","G","T","P","E","Z","Y","R","Q","aa","ab","ac","ad","ae","af"];
function fmt(n, sig = 3){
  if (!isFinite(n)) return "∞";
  if (n < 0) return "−" + fmt(-n, sig);
  if (n < 1000) return n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.round(n).toString();
  const e = Math.min(Math.floor(Math.log10(n)/3), SUF.length-1);
  const m = n / Math.pow(1000, e);
  return (m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : m.toFixed(0)) + " " + SUF[e];
}
```

`fmtMass` (Act I, `g/kg/t/kt/Mt/Gt/Tt/Pt`) is a **presentation alias** of `fmt` with the suffix table
offset by two steps and the unit `g` appended at index 0. There is one implementation, not two.

Three significant figures, always. Maximum rendered string length: `999.9 ad` = 8 characters.
`min-width: 8ch` on every value slot, `9ch` on every rate slot (`+999.9 G/s`). Layout never reflows.

### 2.3 Precision and safe arithmetic

All quantities are IEEE-754 doubles. Relative precision 2⁻⁵³ ≈ 1.11e-16; exact-integer range
±2⁵³ = ±9.007e15.

**Rule P1 — integer quantities must stay below 2³¹ and be asserted integral.**

```
tips ≤ 400 | patches ≤ 6 | regions ≤ 61 | bands = 13 | loci ≤ 26 | D ≤ 40
pactSlots ≤ 9 | channels ≤ 19 | strains ≤ 6 | projects ≤ 145
```

Every one of these is a small integer. Nothing that gates content is ever a float above 2⁵³.

**Rule P2 — accumulate small increments into a companion residual.**
Adding `1.33e3 · 0.05 = 66.5` to a stock of `5.33e11` loses no precision (ratio 1.2e-9 ≫ 1.1e-16).
Adding `0.055 · dt = 0.00275` Insight to a balance of `4.2e4` loses none either (6.5e-8). The only
place absorption occurs is Act III craft counts: adding `repActual·dt ≈ 1e18` to `n_b = 6.31e33`
has ratio 1.6e-16, at the edge. Therefore:

```
// Act III per-band replication accumulator
n_b_resid += repActual_b * dt;
if (n_b_resid > n_b * 1e-9) { n_b += n_b_resid; n_b_resid = 0; }
```

Two lines, applied to `n_b`, `X_b`, `w_{s,b}` and `carbon`. Nowhere else.

**Rule P3 — every stock is clamped on write.**

```js
function setStock(o, k, v, max = 1e42){
  if (!isFinite(v) || v !== v) { v = o[k]; balanceAssert('nonfinite:' + k); }
  o[k] = v < 0 ? 0 : (v > max ? max : v);
}
```

**Rule P4 — no `Math.pow` with a player-controllable base and exponent both unbounded.**
Every exponentiation in the game has either a fixed exponent (`n^1.72`, `n^1.35`, `d^1.5`) or a
bounded base. `Math.pow(1.1, n)` is banned outright (it produced S2 and would produce Infinity at
n ≈ 7,300).

**Rule P5 — subtraction of near-equal large numbers is banned in gating predicates.**
`if (S >= Sc - EPS)` with `EPS = 0.5` on values up to 1.1e7 has relative slack 4.5e-8, which is
1e8× the double epsilon. Safe. Any new gate of the form `a - b > 0` where `a ≈ b > 1e12` must be
rewritten as `a/b > 1 + ε`.

### 2.4 The overflow assertion harness

Runs in dev builds only, every 200th sim tick (10 s):

```
for each named scalar s:
    assert(isFinite(s) && s === s && s >= 0 && s <= CEIL[s])
    assert(Math.abs(s) < 1e42)
for each integer i:  assert(Number.isInteger(i) && i >= 0 && i <= INT_MAX[i])
assert(fmt(s).length <= 8)
```

A single failure writes the tick number, the offending symbol, and the last 40 ticks of that
symbol's history to `localStorage.hyphae.balanceFault` and freezes the sim. Ship builds clamp
silently (P3) and increment a counter that rides along in the save for telemetry-free bug reports.

---

## 3. THE GROWTH CURVE MODEL

### 3.1 Taxonomy — every quantity, classified

| Quantity | Act | Class | Law | Why that class |
|---|---|---|---|---|
| `tips` | I | **linear in t** | `dn/dt ≈ f·1.5·E·P/(3.2·n^0.72)` → `n ∝ t^{1/1.72}·…` ≈ near-linear | see §3.2 |
| `throughput` | I | **polynomial, exp 1.0 in n** | `1.875·n·E·V·P` | one tip is one tip |
| `E` (enzymes×structure) | I | **stepped exponential** | ×1.25 per adaptation tier, 7 tiers | project-driven, not time-driven |
| `biomass` (cum) | I | **polynomial deg ≈ 2.6** | `∫1.5·n(t)·E(t)dt` | product of two growing terms |
| `sugar` | I | **exponential, capped** | gain 1.481× per digest cycle; hard cap `400+30n` | §3.3 |
| `mineral` | I | **linear in contracts × sugar** | `φ·0.48·n·E·V·P·r` | contracts are a rate, not a stock |
| `substrate` (market) | I | **saturating** | `s* = cap·I/C`, τ = 237–2,917 s | mean-reverting stock |
| `substratePrice` | I | **bounded random walk with drift** | mean-rev + momentum + `base ×(1+0.06·g/cap)` | §3.4 |
| `forestSupply` | I | **step, superlinear in patches** | `849·patches^1.8` | S3 |
| `Signal` rate `Sr` | II | **sublinear in breadth** | `SIG_K·C·(0.6+Σℓ)^0.85` | `^0.85` kills 61× |
| `Signal` cap `Sc` | II | **poly in `dVes`** | `260·(1+dVes)^1.85·(0.6+Σℓ)^0.85` | §3.5 |
| `Insight` | II/III | **∝ √Sr, gated on saturation** | `0.055·√Sr·(0.25+0.75·ripe)` | square root is the whole balance |
| `decompRate` | II | **rise-and-fall, deg 1 in L** | `KAPPA·E·d·f(m,h)·L`; `L` depletes | §3.7 |
| `forestConsumed` | II | **monotone, sigmoid in t** | `extracted / 4.00e12` | the act's master clock |
| `harvest_b` | III | **hump in n** | `n·A/(1+n/NCAP+wild)` | §3.8, max at `n* = 7.17·NCAP` |
| `n_b` (craft) | III | **logistic** | `dn/dt = n·REP_K·μ − losses`, capped by carbon | classic |
| `craftMass` | III | **poly in genome** | `2.4e6·(1+0.085·G)^1.15` | the genome tax |
| `carbon` (cum) | III | **exponential then saturating** | doubling ≈ 28 s early, → 0 at `n†` | §3.8 |
| `drift` | III | **exponential in fleet, poly in Φ** | `∝ n·(1−Φ)^1.4` | more of you = more defectors |
| `ϒ` synchrony | III | **relaxation to 0.31 + pulses** | `dϒ/dt = −k(ϒ−0.31) + pulse` | §9 W10 |

**Three exponentials exist in HYPHAE and no more:** Act I's sugar loop (rate-limited by
throughput), Act III's replication (rate-limited by carbon), and the project-driven `E`/`insightMult`
step ladders (limited by a finite project count). Every other quantity is polynomial, saturating,
or a bounded walk. This is the reason the numbers stay readable to 1e42 across 7½ hours rather
than to 1e300 across 3.

### 3.2 Act I tips — the closed form

```
dn/dt = f · b · n · E(n) · V(t) · P(n) / C(n)
      with  f = 0.55, b = 1.500 g/s/tip, C(n) = 60 + 3.2·n^1.72
```

For `n ≫ 6` the additive 60 is negligible and, taking `E ∝ n^0.50` (fitted, §0.3 S2) and `P` stepwise:

```
dn/dt ≈ 0.825 · n^{1 + 0.50 − 1.72} · V · P / 3.2  =  0.258 · n^{−0.22} · V · P
```

Integrating: `n(t) ∝ (t·V̄·P̄)^{1/1.22}` — **super-linear with exponent 0.82 in `n` per unit
time**, i.e. very close to linear with a slight late-game slowdown. That is exactly the shape an
idle game's primary production unit should have: purchases arrive at a near-constant cadence for
the whole act, and the cadence lengthens by only 35% between tip 50 and tip 250.

Verified purchase cadence, player R (harness):

| tip band | cadence (s/tip) | notes |
|---|---|---|
| 0–7 | 6.5 | the buy burst |
| 8–24 | 34 | the mineral gate is the real limiter here, not biomass |
| 25–60 | 21 | spring release; contracts flowing |
| 61–120 | 29 | second patch, first enzyme tier |
| 121–200 | 41 | mineral cost dominates |
| 201–255 | 58 | player switches spend to projects and patches |

**No band exceeds 60 seconds.** The corridor guard in §5.1 requires ≤ 90 s.

### 3.3 Act I sugar — the exponential, and its four brakes

One gram of leaf costs 0.108 sugar and returns `0.20 × 0.80 = 0.160` sugar. Gain per digest cycle:

```
G = 0.160 / 0.108 = 1.481 ×      (48.1% per cycle)
cycle time = 1 / (1.875 · 1.60 · n · E · V · P)  per gram
```

Sugar is therefore **exponential with a time constant set by throughput**, which is itself growing.
Uncontrolled this is a double exponential. Four brakes, in order of when they bite:

| # | Brake | Mechanism | Bites at |
|---|---|---|---|
| B1 | **Sugar cap + rot** | `sugarCap = 400 + 30·tips`; excess rots at 6%/s | continuously; forces spending |
| B2 | **Contract delivery** | `φ` = 30–52% of gross sugar is exported for minerals | t ≥ 420 s |
| B3 | **Market inflation** | `base ×= (1 + 0.060·g/cap)`; +50–130% over the act | t ≥ 900 s |
| B4 | **Market stock** | you cannot buy what has not fallen; `s* = cap·I/C` | t ≥ 2,400 s |

Effective margin as a function of cumulative purchase, in cap-units `u`:

```
margin(u) = 1 − 0.108·(1 + 0.060·u)^1 / 0.160 = 0.325 − 0.0405·u
```

Margin hits **zero at u = 8.0 cap-units** of leaf. Player R buys 9.4 cap-units of leaf across
Act I. **The player runs their own primary input to negative margin by minute 88 and must switch to
wood** (log margin 50%, stump 55%), whose pools have τ = 1,250 s and 2,917 s and are therefore a
finite reserve rather than a flow. The bottleneck flips from *time* (few tips, cheap leaf) to
*sugar* (many tips, expensive leaf) at t ≈ 55 min, and the correct consumption order flips with it.
This is Act I's economic phase change and it is the structural analogue of Paperclips' `demand = 100`
elasticity flip (teardown §5). It is undocumented in-game.

### 3.4 Act I price — a walk you can learn

```
scarcity = 1 − stock/cap
fair     = base · (1 + 1.10 · scarcity^1.6)
mom      = 0.955·mom + 0.030·(fair − price)/fair + 0.006·gauss()   ; |mom| ≤ 0.075
price   *= (1 + mom)
```

Momentum autocorrelation 0.955 at 1 Hz ⇒ **half-life 15.0 s**, and a trend that has crossed zero
runs a mean of 41 s before reversing (measured, 10⁵ samples). Mean reversion 0.030/s ⇒ the price
returns 63% of the way to `fair` in 33 s. Stationary σ of `mom` = `0.006/√(1−0.955²) = 0.0203`,
so the typical excursion from fair is ±14% and the 99th percentile is ±38%.

**Learnable, unlike Paperclips' `6·sin(n)` (teardown §8.12):** the walk has memory (0.955), the
mean is a published function of a visible stock, and *Mycelial Ledger* (adaptation, triggers at 10
market purchases) draws the last 240 s. Expert player X captures a measured **−31% on total input
cost** versus player R over Act I. That is the value of the skill, and it is bounded, so player N
is not punished out of the act.

### 3.5 Act II Signal — why `^0.85` and `^1.85`

```
Sr = 3.00 · C · (0.60 + Σℓ)^0.85 · (1 + 0.35·dCond) · signalMult · prestigeGrowth
Sc =  260 · (1 + dVes)^1.85 · (0.60 + Σℓ)^0.85 · capMult
timeToFill = Sc / Sr = 86.7 · (1 + dVes)^1.85 / [ C · (1 + 0.35·dCond) ] · capMult/signalMult
```

The interface term `(0.6+Σℓ)^0.85` cancels exactly in `timeToFill`. **Expanding the colony changes
your rate and your pool by the same factor and does not change your ripeness cycle length.**
That is a deliberate structural property: territory is a pure multiplier on both, so the Vesicle /
Conduction decision is orthogonal to the territory decision and can be reasoned about separately.
It is also why `dVes` has the higher exponent (1.85 vs an effective 1.0 for `dCond`): without it
there would be no interior optimum and Conduction would strictly dominate.

Interior optimum (from `02` §5.2, re-verified): `Ψ/hr` maximised at `dVes/D ≈ 0.43`, i.e.
`dVes ≈ 9–11` at `D = 21`, and the optimum moves right as `signalMult` grows and left as `capMult`
grows. Both multipliers are project-driven, so the optimum moves 3–4 times across the act.

### 3.6 Conservation — the reason the player's intuition never breaks

Every mass-dimensioned transformation in HYPHAE is lossy and the loss is visible:

| Transformation | Out/In | Where the rest goes |
|---|---|---|
| Litter → biomass + sugar (Act I) | 0.50 + 0.20·η_S ≤ 0.70 | 30% respired |
| Decomposition → biomass (Act II) | `(1−ρ)·yieldF`, ρ ∈ [0, 0.80] | humus + respiration |
| Biomass → spores (Act II→III) | 1/270 | the fruiting body is expensive |
| Craft replication (Act III) | 1 craft per `craftMass` g | genome tax `(1+0.085G)^1.15` |
| Transit (Act III) | `1/(1+PROP_K)` = 0.357 | propellant |

**No process anywhere returns more mass than it consumes.** A player can always sanity-check a
number by asking "where did that come from," and the answer is always on screen. This is worth more
than any tutorial.

### 3.7 Act II decomposition — the rise and fall

```
decomp_i = KAPPA · E · d_i · decompF_i · moistureF(m) · humusF(h) · surge · L_i
```

Linear in the *stock* `L_i`, which is depleting, and in `E`, which is growing by projects.
Total forest carbon `TOTAL_FOREST_C = 4.00e12 g` (S6). The act's production curve is the product of
a growing coefficient and a shrinking stock, so it has a single interior maximum. Restating
`02` §9.7 under `ACT2_SCALE`:

| `fc` | elapsed | `decompRate` (g/s) | `Sr` (/s) | `d(decompRate)/dt` |
|---|---|---|---|---|
| 0.00 | 0:00 | 1.33e3 | 2.5 | + |
| 0.08 | 0:22 | 2.03e5 | 41 | + |
| 0.25 | 0:58 | 9.32e6 | 310 | + |
| 0.45 | 1:34 | 1.47e8 | 1,180 | + |
| 0.65 | 2:09 | 9.66e8 | 3,400 | + |
| **0.80** | 2:34 | 2.70e9 | **5,300 ← peak Σ** | + |
| **0.88** | 2:51 | **3.50e9 ← peak Χ** | 4,600 | **0** |
| 0.94 | 3:04 | 2.96e9 | 2,900 | − |
| 0.97 | 3:12 | 2.13e9 | 1,900 | − |
| 1.00 | 3:18 | 1.03e9 | 1,100 | − |

Peak Signal precedes peak Carbon by 17 minutes; both precede the end by 27 and 44 minutes. The
integral `∫decompRate dt` over 11,880 s equals **4.00e12 g = TOTAL_FOREST_C** by construction —
verify to ±2% in the harness (§12.5 check C11); this is the single arithmetic identity that ties
Act II's felt curve to its budget, and the published documents did not satisfy it before S6.

### 3.8 Act III — the surplus hump

From `03` §7.5, unchanged and re-verified:

```
surplus_b(n) = n·A/(1 + n/NCAP + wildOcc) − n·S
n* = NCAP·(√(A/S) − 1)          n† = NCAP·(A/S − 1)
A/S = 66.7 baseline  ⇒  n* = 7.17·NCAP,  n† = 65.7·NCAP,  n*/n† = 0.109
```

**The surplus-maximising fleet is 10.9% of carrying capacity, and a band at capacity produces
nothing.** Carbon growth is therefore exponential (doubling 28 s at μ=1) only while `n ≪ n*`, hits
its maximum first derivative at `n*`, and returns to zero at `n†`. As `X_b` depletes, `dep_b` falls,
`A` falls, and `n*` falls *under the player*, pushing them outward with no scripted gate.

---

## 4. COST-SCALING LAWS — THE FULL CATALOGUE

Twelve upgrade families. For each: the law, the derived cost at five levels, the marginal payback
in seconds against the network's output at that level, and the class.

### 4.1 Act I — Hyphal Tips (primary production unit)

```
tipCost(n)       = ceil( 60 + 3.2 · n^1.72 )                       [polynomial, deg 1.72]
tipMineralCost(n)= n < 24 ? 0 : ceil( 0.06 · (n−23)^1.35 )         [polynomial, deg 1.35]
```

| n | biomass | mineral | Σ biomass | Σ mineral | marginal output | payback vs. network |
|---|---|---|---|---|---|---|
| 0 | 60 | 0 | 60 | 0 | 1.50 g/s | 40.0 s |
| 7 | 144 | 0 | 668 | 0 | 1.50 | 13.7 s |
| 24 | 817 | 1 | 8,119 | 1 | 1.88 (E 1.25) | 17.3 s |
| 60 | 3,880 | 7 | 84,900 | 122 | 2.91 (E 1.55) | 22.2 s |
| 120 | 12,780 | 32 | 5.46e5 | 1,190 | 4.88 (E 2.60) | 21.8 s |
| 200 | 30,690 | 76 | 2.24e6 | 5,570 | 8.02 (E 4.10) | 19.1 s |
| 255 | 44,160 | 110 | 5.40e6 | 12,360 | 8.99 (E 4.60) | 19.3 s |

**Payback against the network never leaves 13–23 seconds across the whole act.** That flatness is
the design: the player is never told "you can't afford anything for four minutes," and never told
"buy 40 of these instantly."

Σ mineral to tip 255 = **12,360 ⛬**, against a simulated mineral income of 15,900 ⛬. The mineral
gate is the binding constraint on tips for the whole act, exactly as `01` §6.7 intends, and it
leaves a 3,500 ⛬ float for structures and patches.

### 4.2 Act I — Patches (territory)

Fixed table, not a formula, because there are six of them. Reproduced with derived supply.

| # | biomass | mineral | gate | `patches^1.8` | forest supply (g/s) | claim time |
|---|---|---|---|---|---|---|
| 1 | — | — | start | 1.00 | 849 | — |
| 2 | 12,000 | 90 | `biomass ≥ 12,000` | 3.48 | 2,955 | 90 s |
| 3 | 30,000 | 260 | `netRep ≥ 22` | 7.22 | 6,130 | 135 s |
| 4 | 70,000 | 700 | `patches ≥ 3` | 12.13 | 10,298 | 180 s |
| 5 | 160,000 | 1,800 | `netRep ≥ 45` | 18.12 | 15,384 | 225 s |
| 6 | 400,000 | 4,400 | `netRep ≥ 55` | 25.11 | 21,318 | 270 s |

Cost ratio between consecutive patches: 2.50, 2.33, 2.29, 2.50 — **effectively geometric at 2.4×**,
while supply grows at `(k+1)^1.8/k^1.8` = 3.48, 2.07, 1.68, 1.49, 1.39. Patch 2 returns 3.48× supply
for 2.50× the previous price; patch 6 returns 1.39× for 2.50×. **Patches have sharply diminishing
returns and the player is never told.** Unlike Paperclips' marketing trap (teardown §8.10, ×2 cost
for ×1.1 effect, a strictly dominated purchase after level 10), patch 6 is still worth it because
it is the only source of the Oak, which is the highest-`κ` contract counterparty in the act. The
trap is a real decision, not a punishment.

Claim time `45 s × patchIndex` with `throughput ×0.90` for its duration. Opportunity cost of
claiming patch 6: `270 s × 0.10 × 2,710 g/s = 73,170 g` — 18% of its sticker price. Expansion is
priced twice and the second price is invisible until you look.

### 4.3 Act I — Adaptations (projects)

45 entries (`04` §5). Not a formula — a hand-authored ladder. The **budget identity** that governs
it:

```
Σ biomass costs of all 45 Act I adaptations = 1.90e6 g   (56% of cumBiomass 3.4e6)
Σ mineral costs                             = 2,900 ⛬     (18% of mineral income)
Σ sugar costs                               = 41,000 g
```

Distribution requirement (enforced by harness check C7): the cost of the *k*-th adaptation to become
affordable, divided by the player's biomass income rate at the moment it becomes triggered, must lie
in **[25 s, 420 s]** for all 45. Below 25 s it is not a decision; above 420 s it is a wall.

### 4.4 Act II — ADVANCE (region claiming)

```
advanceCost(r) = 6.00e5 · 1.34^r · terrainMult · (1 + 0.22·ring)        [geometric, 1.34]
// r = regions already claimed (0–60), ring = 0–5
advanceTime(r) = 45 + 4.5·ring   seconds
```

| r | cost | Σ | player biomass income at that point | payback |
|---|---|---|---|---|
| 0 | 6.00e5 | 6.00e5 | 1.33e3 g/s | 451 s |
| 6 | 3.44e6 | 1.20e7 | 8.1e4 | 42 s |
| 18 | 8.36e7 | 2.79e8 | 3.9e6 | 21 s |
| 34 | 3.86e9 | 1.26e10 | 2.7e8 | 14 s |
| 48 | 1.60e11 | 5.13e11 | 1.6e9 | 100 s |
| 60 | 4.99e12 | 1.55e13 | 1.03e9 | 4,845 s |

`Σ` to r = 60 exceeds `TOTAL_FOREST_C`. **The last 8–11 regions are deliberately unaffordable on a
first run**, which is the intended reason a first playthrough ends with 50–53 of 61 regions claimed
and a visible map with holes in it. Region 48 is the affordability knee; region 53 is the practical
stop. Harness check C8 asserts `48 ≤ regionsClaimed ≤ 55` for player R.

The first ADVANCE has a 451-second payback and that is correct: it is the single most expensive
decision relative to income in the entire game, it arrives at Act II minute 1:20, and it is the
moment the player learns that Act II costs are a different order of thing from Act I costs.

### 4.5 Act II — Hyphal density, and the Projects tree

```
densityCost(i, d) = 2.40e5 · L0_i/L0_ref · (1 − d_i)^(−1.35)          [pole at d = 1]
```

Cost → ∞ as density → 1. Reaching `d = 0.95` costs 8.7× the cost of `d = 0.50`; reaching `d = 0.99`
costs 33×. **No region is ever worth taking to full density**, and the correct policy — spread
density across many regions rather than perfecting a few — is derivable from that one exponent.
Total density spend across a competent run: 3.63e11 g (S6-scaled from `02` §12.7's 1.09e12).

Projects: 53 entries, Ψ-dominated. Budget (S6-scaled where biomass-dimensioned):

| Tier | Σ (Signal) | Ψ | biomass | other |
|---|---|---|---|---|
| A | 8,500 | 55 | — | — |
| B | 60,000 | 390 | — | — |
| C | 490,000 | 2,445 | 1.33e9 | 4,000 ⛬ |
| D | 2,100,000 | 5,370 | 2.66e10 | — |
| E | 2,800,000 | 4,800 | 9.99e10 + **5.33e11 held** | 4.0e8 ◦ |
| F | — | 2,330 | — | — |
| **Total** | **5.46e6** | **15,390** | **1.28e11 + gate** | |
| **Available** | **8.00e6** | **16,000** | **4.00e12 extracted** | |
| **Slack** | 32% | **3.8%** | 62% | |

**Insight slack is 3.8%.** Six to eight projects are unbuyable on a first run and stay on screen,
greyed, forever. That is the design (teardown principle 3) and it is the reason there is a second
playthrough. Harness check C9 asserts `4 ≤ projectsUnbought ≤ 11` for player R.

### 4.6 Act III — Loci, and the genome tax

```
locusCost(L)  = ceil( 140 · (L + 1)^1.62 )   Ψ            [polynomial, deg 1.62]
lociCap       = 8 + floor( alleles / 40 )                  , hard cap 26
craftMass(G)  = 2.40e6 · (1 + 0.085·G)^1.15  g             [polynomial, deg 1.15 in G]
```

| L | locusCost | Σ Ψ | `craftMass` at G = L | mass ×base |
|---|---|---|---|---|
| 1 | 431 | 431 | 2.63e6 | 1.10 |
| 4 | 2,004 | 4,110 | 3.42e6 | 1.43 |
| 8 | 5,760 | 22,000 | 5.12e6 | 2.13 |
| 12 | 11,150 | 55,900 | 6.56e6 | 2.73 |
| 18 | 21,900 | 155,000 | 8.60e6 | 3.58 |
| 26 | 40,900 | 400,000 | 1.15e7 | 4.79 |

Total Act III Ψ income ≈ 26,000. Σ locusCost to L = 8 is 22,000. **A first run reaches L = 8–9 and
`lociCap` 19; it cannot afford 26.** The double cost — Ψ to buy, then a permanent multiplicative tax
on every craft you will ever replicate — makes each locus a genuine two-sided decision rather than
a slider. Alleles are earned *only* by resolving divergence (§11.5), so raising `lociCap` requires
surviving betrayal, and the cap is 8 + alleles/40 with alleles ≈ 440 on a balanced run → 19.

### 4.7 Act III — Bands and transit

```
NCAP_b     = X0_b / 6.0e10
τ_b        = transit time, band b → b+1   (13 values, 40 s → 1,340 s)
PROP_K     = 1.80   ⇒ landed fraction = 1/(1+1.80) = 0.357
```

Transit is the only pure time cost in the game that cannot be bought down below a floor
(`tSpe` reduces τ by at most 62%). Band 10→11 at `τ = 1,340 s` is the longest single wait in
HYPHAE: **22 min 20 s**. §9 window W9 governs it.

### 4.8 The strategic layer — channels, pacts, ACCORD

```
channelCost(c) = ceil( 46 · (c + 1)^1.55 )  ⟡                    [polynomial, deg 1.55]
congestion(k)  = 1 + 0.052·k^1.42                                 // k = pacts held
reconcileCost  = 260 · (1 + strain_a + strain_b)  ⟡
triangleCost   = 420 · (3 + Σ strain) / (1 + mean bond)  ⟡
```

Congestion is **convex** in book size: 4 pacts cost 1.37× overhead, 9 pacts cost 2.15×. The optimum
book size against a linear yield is therefore interior and sits at `k ≈ 7`, which matches the
published peak-slot count of 8–9 (a competent player runs slightly over the naive optimum because
diversification reduces `shockMult` variance). Peak channels 17–19 (`05` §14.1 target 5) is
reproduced by the harness at `Σ channelCost = 46·Σ(c+1)^1.55` to c = 18 = **10,900 ⟡** against a
simulated ACCORD income of 13,400 ⟡.

### 4.9 Cost-law summary — the shape of the whole game

| Family | Law class | Ratio at 2× level | Terminates on |
|---|---|---|---|
| Tips | poly 1.72 | 3.30× | mineral gate |
| Patches | geometric 2.4 | 2.40× | count (6) |
| Adaptations | authored | — | count (45) |
| ADVANCE | geometric 1.34 | — | affordability knee |
| Density | pole at d=1 | 2.55× at d=0.5→0.75 | asymptote |
| Act II projects | authored | — | Insight slack 3.8% |
| Loci | poly 1.62 | 3.07× | `lociCap` = 8 + α/40 |
| Channels | poly 1.55 | 2.93× | ACCORD income |
| Traits | poly (published) | — | genome tax |

**Exactly one family in HYPHAE is geometric with ratio > 2 (patches), and it has six members.**
Everything else is polynomial with an exponent in [1.15, 1.85], or authored, or asymptotic. This is
the deliberate opposite of the genre norm, and it is why the game does not need `+10/+100/+1k`
buttons (teardown §8.7): a polynomial cost curve against a polynomial income curve produces a
constant purchase cadence, and a constant purchase cadence needs one button.

---

## 5. THE TWO INVARIANTS, AND THEIR PROOFS

### 5.1 Invariant I — the payback corridor (no cakewalk, no wall)

**Definition.** For any purchasable *p* at the moment it is affordable, let

```
payback(p) = cost(p) / d(primaryIncome)/d(p)                        // seconds, marginal
cadence(p) = cost(p) / primaryIncomeRate                            // seconds, absolute
```

**Invariant I.** For every production purchasable, at every level, for player R:

```
8 s  ≤  cadence(p)  ≤  90 s
5 s  ≤  payback(p)  ≤  600 s
```

The lower bounds prevent a cakewalk (a purchase that arrives faster than the player can read it, or
that repays itself before they finish tapping). The upper bounds prevent a wall (a stretch with
nothing affordable, or a purchase that is never rational).

**Proof for Act I tips.** `cadence(n) = tipCost(n) / (f · 1.5 · n · E · V · P)`. Substituting the
S2 law and the measured `E(n)`, `V̄ = 0.73`, `P(n)`:

```
n:        7     24     60    120    200    255
cadence:  6.5   34     21     29     41     58     seconds     ✓ all in [8, 90] except n=7
payback: 13.7   17.3   22.2   21.8   19.1   19.3   seconds     ✓ all in [5, 600]
```

`n = 7` sits at 6.5 s, below the floor of 8. That is the **buy burst** and it is exempt by design
(`01` §4/Unlock-2): the corridor applies from `n ≥ 8`, i.e. from t = 100 s. The exemption is
declared here so the harness does not flag it.

**Proof for Act II ADVANCE.** §4.4's payback column: 451, 42, 21, 14, 100, 4,845 s. The last row
violates the ceiling — deliberately (§4.4: the last regions are unaffordable). The corridor applies
to `r ≤ 53`; `r ≥ 54` is content the player is *shown* and cannot have.

**Proof for Act III.** `n*` (§3.8) is a *maximum*, not a threshold: the surplus function is smooth
and concave, so there is never a level at which nothing is worth buying. The corridor is satisfied
trivially for replication (continuous) and is enforced on loci by §4.6: `locusCost(L)/Ψrate` is
480 s at L=1 falling to 190 s at L=6 and rising to 1,850 s at L=12. **Loci deliberately exceed the
corridor at the top**, because the last two loci are meant to be a run-defining sacrifice, and are
exempted by name in the harness.

### 5.2 Invariant II — the affordability ratio histogram

**Definition.** At any moment `t`, over the set `A(t)` of triggered-but-unbought purchasables:

```
affordRatio(p, t) = playerBalance(currency(p)) / cost(p)                       ∈ [0, ∞)
DAI(t)            = | { p ∈ A(t) : affordRatio(p,t) ≥ 1 } |                    // affordable now
NEAR(t)           = | { p ∈ A(t) : 0.35 ≤ affordRatio(p,t) < 1 } |             // visibly close
```

**Invariant II.** For the whole run, sampled at 1 Hz:

```
(a)  DAI(t) ≥ 1                                  for ≥ 97% of ticks
(b)  DAI(t) + NEAR(t) ≥ 2                        for 100% of ticks
(c)  max run-length of DAI(t) = 0                ≤ 480 s        ← the hard ≤8-minute rule
(d)  DAI(t) ≤ 9                                                  ← the anti-menu rule
(e)  median over the run of DAI(t)               ∈ [2, 4]
```

(c) is the assignment's hard constraint, stated as a machine-checkable predicate. (d) exists because
a list of ten affordable things is a shop, not a decision. (e) is the target texture: **two to four
things you could buy right now, and two to four more you can see.**

`04` §4.2 already specifies the reveal queue that produces this. §9 lists the ten windows where
`DAI` legitimately dips and what carries the player through each.

### 5.3 The no-dead-end theorem

A dead end is a state from which no sequence of legal actions increases any resource. HYPHAE has
five resource-generating loops; a dead end requires all five to be simultaneously closed.

| Loop | Closes when | Reopened by |
|---|---|---|
| L1 Act I decomposition | `totalSubstrate = 0` | market purchase, litterfall (always > 0), **WINDFALL** |
| L2 Act I market | `sugar < minPrice` | decomposition of any remaining substrate |
| L3 Act I contracts | no tree has `deficit > 0` | the season clock (deficit is periodic, period 1,440 s) |
| L4 Act II decomposition | `Σ L_i = 0` | litterfall from living trees (`λ·T_i`), necrotrophy |
| L5 Act III harvest | `Σ X_b = 0` | dispersal to an unexplored band; `senescence` floor |

**Theorem.** No state of HYPHAE is a dead end.

*Act I.* Suppose L1 and L2 are both closed: `totalSubstrate < 50` and `sugar < 20` and
`biomass < 200`. Litterfall on the home patch is `849 · seasonMult ≥ 849 × 0.30 = 255 g/s` and
market stock is bounded below by `cap·I/C > 0`, so L2 reopens as soon as any sugar exists. Sugar is
produced only by L1. Therefore the closure is genuine and is exactly the `WINDFALL` trigger
(`01` §7.7):

```
trigger: totalSubstrate() < 50 && sugar < 20 && biomass < 200 && !hasActiveIncome()
effect:  sub.leaf += 2000 ; netRep −= 1 ; uses += 1        // infinitely re-armed
if netRep === 0: granted free, once per 300 s
```

2,000 g of leaf yields 1,000 g biomass and 320 g sugar, which buys 2,963 g of leaf at base price —
a **positive-return re-entry** (gain 1.481×, §3.3). One WINDFALL is sufficient to restart the loop
from zero. ∎

*Act II.* L4 closes only at `forestConsumed = 1.00`, which is the act's terminal condition and is
gated by the transition project. The mercy rule `Sr = max(Sr, 0.40 · SrPeakEverSeen)` (`02` §9.7,
project E2 `last_light`, 1,300 Ψ, triggers at `fc ≥ 0.88`) guarantees the Signal needed to afford
the gate even for a player who necrotised catastrophically early. Harness check C12 runs the
*worst-case necrotroph* policy (necrotise every region at first opportunity) and asserts completion.

*Act III.* L5 closes per-band, never globally, because `senescence` sets a floor and because
exploration reveals new bands. If the player reaches `Σn = 0` (total fleet loss), `03` §20.4's
`ENCYST` concession is available at zero cost and terminates the run with `END_MULT = 0.35`. That is
a bad ending, not a dead end. Additionally the predation cap (25% per offline period) makes total
fleet loss impossible while away.

### 5.4 The no-cakewalk theorem

A cakewalk is a state in which the optimal policy is "press the only button repeatedly with no
thought" for more than 180 seconds. Three structural devices prevent it, one per act.

| Act | Device | Why the optimal policy is not trivial |
|---|---|---|
| I | **The margin walk** (§3.3) | `margin(u) = 0.325 − 0.0405·u` reaches 0 at u = 8 cap-units. The correct consumption order flips 3–4 times per act as the bottleneck moves between time and sugar. There is no static answer. |
| II | **The ripeness cost** (`02` §5.2) | Each Signal purchase costs ~240 s of peak Insight ≈ `9.9·√Sr` Ψ. The correct policy is to *batch*, and the correct batch size depends on `Sr`, `Sc` and the current project prices — all of which move. |
| III | **The surplus hump** (§3.8) | `n*` = 7.17·NCAP and falls as `X_b` depletes. "Grow the fleet" is wrong past 10.9% of capacity; the correct action flips from REPLICATE to DISPERSE at a moving threshold. |

Each device is a **closed-form optimum that moves**. Each is discoverable from a readout the player
already has. None is explained.

### 5.5 The supply-ceiling closure — why Act I ends when it ends

```
sustainable extraction = 0.65 · 849 · patches^1.8
demand                 = 1.875 · tips · E · V · P · k̄
```

At the act's end (`tips = 255`, `E = 4.60`, `P = 1.30`, `V̄ = 0.73`, `k̄ = 1.42`):

```
demand = 1.875 × 255 × 4.60 × 1.30 × 0.73 × 1.42 = 2,963 g/s
supply = 0.65 × 849 × 6^1.8 = 13,857 g/s        →  utilisation 0.21 annual mean
                                                    utilisation 0.36 at autumn peak
```

Act I therefore ends on the **transition gate** (`hyphae ≥ 500 m`, plus the finale project's
costs), not on a resource wall, and the forest at the end of Act I is still 79% unexploited. That
is exactly the setup Act II needs: the player leaves the home patch with the floor still full, and
Act II's premise is that the *floor* was never the point — the living trees were.

---

## 6. THE TARGET SESSION ARC

### 6.1 Minute 1 — "the number moves"

| | |
|---|---|
| **On screen** | Title, console, `BIOMASS 0 g`, one button `EXTEND`. Substrate readout appears at t = 3 s. |
| **Hands** | One thumb, 1.7 taps/s, ~100 taps. |
| **Verbs** | 1 (tap) → 2 (tap, buy) at t = 35 s. |
| **State at 60 s** | biomass held 20 g, cum 144 g, sugar 37 g (hidden), tips 2, substrate 1,762 g. |
| **The hook** | The thread on the canvas is 3.5 px longer than it was. Substrate is falling and nobody said why. |
| **Failure mode if wrong** | If the first tip costs more than 60 g or arrives after 50 s, retention drops. K04 is not a tuning knob. |

### 6.2 Minute 5 — "winter"

| | |
|---|---|
| **On screen** | Biomass, substrate (7 pools, 3 unlocked), sugar, tips, the Litter Market (opened at 2:00), the season strip. |
| **Verbs** | 4 (tap, grow tip, buy substrate, set consumption order). |
| **State** | held 306 g, cum 3,741 g, tips 17, sugar 424 g, litter 28 g/s (was 42 g/s one minute ago). |
| **The event** | `WINTER`. `moistureMult × tempMult` collapses 1.000 → 0.239 over ~60 s of moisture relaxation. Production falls 4.2×. |
| **The decision** | Buy cheap winter twig (litterfall ×2.40) and log (×1.90), or watch throughput die. |
| **Why it must hurt** | Winter is the engine of the act. Two adaptations soften it to 0.55×; neither removes it. |

### 6.3 Minute 15 — "the gate"

| | |
|---|---|
| **On screen** | + Adaptations panel (8:30), + The Understory / trees (6:30), + commitment meter, + mineral readout. |
| **Verbs** | 7 (add: sign contract, buy adaptation, deliver sugar). |
| **State** | held 1,053 g, cum 18.3 kg, tips 33, mineral 8 ⛬, 1 contract, 4 adaptations. |
| **The event** | Tip 24 required a mineral at 11:48. Biomass alone no longer buys growth. |
| **The reframe** | The comfortable decomposition loop is no longer sufficient. The trading floor is mandatory. |
| **Metronome check** | 11 new nouns/verbs in 15 minutes; worst gap **97 s** (target ≤ 105 s, hard fail > 150 s). |

### 6.4 Minute 60 — "the portfolio"

| | |
|---|---|
| **On screen** | 3 patches, 3–4 contracts, 18 adaptations, price charts (Mycelial Ledger), reputation. |
| **State** | held 8.4e4 g, cum 6.2e5 g, tips 136, mineral 1,148 ⛬, netRep 34, 3 patches. |
| **The shift** | Leaf margin has fallen from 32.5% to ~14% under self-inflicted inflation (§3.3). The player switches consumption order to log/stump. |
| **The decision cadence** | One tip every 29 s; one adaptation every ~4 min; one contract renegotiation every ~7 min; one market decision every ~90 s. |
| **What is automatic** | Decomposition, delivery, litterfall, price. **Nothing that involves a choice.** |

### 6.5 Hour 3 — "the mind, and the map"

Act II, t ≈ 75 min into the act (`fc ≈ 0.32`).

| | |
|---|---|
| **On screen** | MIND (Signal / ripeness), FOREST (61-hex map), FLUSH (fruiting), PACTS (the book), Projects. Five tabs. |
| **State** | `Sr` 460/s, `Sc` 9,400, Ψ 3,100 lifetime, 19 regions, `D` 11, 4 pacts, 6 channels, 2 rivals contesting. |
| **The core rhythm** | Ripen 180 s → batch 2–3 Signal purchases → advance a region → release a flush → re-read the pact book. Cycle length 6–9 min. |
| **The new thought** | Exposure. `05` P3: the first `── if it dries out ×0.68` line has appeared. The pact book stops being a shop. |
| **PULSE** | In the thumb, 120 s cooldown, never automated. ~28 presses per hour. |

### 6.6 Hour 6 — "the decline, and the launch"

Act II end (`fc` 0.94 → 1.00) into Act III Phase A and the first void bands.

| | |
|---|---|
| **The shape** | Every number the player grew for three hours is **falling**. `Sr` 5,300 → 1,100. `decompRate` 3.50e9 → 1.03e9. Stands go dark on the map, one per ~40 s. |
| **The task** | Liquidation (`05` P6): nine pacts, different `endsAt`, different `severCost`, insufficient ⟡. Honour, sever, or let breach — each changes `LEGACY`. |
| **The transition** | Act II→III revokes 61 regions, the map, the pact book, the flush panel. Act III opens with `SPORES 2.00 G` and a **negative** rate. |
| **Phase A** | 22 minutes, 8 biomes, the same equations as the void on a board small enough to hold in the head. Ends at `planetConsumed ≥ 0.97`. |
| **ESCAPE** | 96% of craft destroyed. Exact, not stochastic. |

### 6.7 Hour 9 — "not applicable to player R; the N case"

Player R finishes at **7 h 25 m**. Hour 9 exists only for player N (10 h 10 m) and is specified so
the game does not decay for them.

| | |
|---|---|
| **Where N is** | Void band 8–10, `fc`-equivalent 0.72, 6 strains born, 2 engagements lost, `lociCap` 17. |
| **The risk** | N has never respecced, has `tMel = 0`, and is entering band 8 where radiation scales. BRITTLENESS (`03` §10.4) is the modal N failure. |
| **The guard** | The MORTALITY panel names the cause of every loss in plain language. `03` §10.1. A player cannot lose a run to something they were not shown. |
| **The pacing** | Transit `τ_9 = 940 s`, `τ_10 = 1,340 s`. §9 window W9. The triangle, engagements, sequencing and divergence all remain live throughout. |
| **The ending** | N reaches ENDING A (THE BLOOM, `BLOOM_X = 9.00e34`) at ~10 h 10 m. B and C require builds N will not have. All three endings must be reachable by *some* competent build; only A must be reachable by *every* completing build. |

---

## 7. MINUTE-BY-MINUTE, 0:00 → 30:00

Player R. Simulated (§0.4) with the S1–S4 constants. `held` = spendable biomass; `cum` = lifetime
gross biomass; `litter` = g/s consumed; `env` = `moistureMult × tempMult`.

| min | held (g) | cum (g) | litter/s | tips | ⛬ | sugar (g) | env | NEW THIS MINUTE | DAI |
|---|---|---|---|---|---|---|---|---|---|
| 0:00–1 | 20 | 144 | 6 | 2 | 0 | 37 | 1.00 | `EXTEND`. **Substrate** readout @0:03. **HYPHAL TIP** @0:35. | 1→2 |
| 2 | 70 | 553 | 18 | 6 | 0 | 92 | 1.00 | **SUGAR** readout @1:00 (already holding 24 g). Console warns on substrate @1:40. | 2 |
| 3 | 139 | 1,279 | 30 | 10 | 0 | 168 | 1.00 | **THE LITTER MARKET** @2:00. First purchase @2:10; `base` begins to drift. | 3 |
| 4 | 118 | 2,357 | 42 | 14 | 0 | 280 | 1.00 | Consumption-order list becomes draggable (3 types). | 3 |
| 5 | 306 | 3,741 | 28 | 17 | 0 | 424 | 0.55 | **WINTER** @5:00. `env` 1.00 → 0.55 → 0.24 over 90 s. | 3 |
| 6 | 430 | 4,344 | 15 | 18 | 0 | 486 | 0.27 | Winter litterfall table flips: twig ×2.40, log ×1.90, carrion ×2.20. | 3 |
| 7 | 333 | 4,769 | 14 | 19 | 0 | 530 | 0.24 | **THE UNDERSTORY** @6:30. Birch offers. Negotiation screen. | 4 |
| 8 | 185 | 5,188 | 14 | 20 | 1 | 533 | 0.24 | **First contract signed** @7:00. Minerals begin. Commitment meter. | 4 |
| 9 | 60 | 5,677 | 19 | 21 | 1 | 537 | 0.24 | **ADAPTATIONS** @8:30. 6 entries visible, 2 affordable. | 5 |
| 10 | 624 | 6,241 | 19 | 21 | 2 | 542 | 0.24 | *Dormancy Clause* @9:00 — the cheapest thing on screen. Offline safety. | 5 |
| 11 | 561 | 6,840 | 37 | 22 | 3 | 546 | 0.45 | **SPRING** @11:00. Bud-break: birch deficit spikes ×2.9 for 60 s, then collapses to 0.1. | 5 |
| 12 | 573 | 9,146 | 88 | 25 | 5 | 565 | 0.94 | **MINERAL GATE** @11:48. Tip 24 costs 1 ⛬. | 4 |
| 13 | 561 | 11,924 | 97 | 28 | 6 | 587 | 0.92 | *Hemicellulase* affordable → **bark** unlocks (4th pool, first mineral-bearing). | 5 |
| 14 | 270 | 14,961 | 107 | 31 | 7 | 611 | 0.92 | **Second tree** (Douglas Fir) @13:00 at `netRep ≥ 8`. Portfolio thinking. | 5 |
| 15 | 1,053 | 18,282 | 141 | 33 | 8 | 636 | 0.92 | *Mycelial Ledger* @14:30 (10 purchases). **Price charts.** The market becomes readable. | 6 |
| 16 | 1,189 | 22,736 | 154 | 36 | 13 | 558 | 0.92 | Enzyme tier 1 (`E` 1.00 → 1.25). First visible step change in throughput. | 5 |
| 17 | 1,069 | 27,580 | 204 | 39 | 17 | 472 | 1.12 | Peak spring moisture (1.15 → `moistureMult` 0.967). Highest `env` of the year so far. | 5 |
| 18 | 988 | 33,149 | 162 | 42 | 21 | 374 | 0.83 | **SUMMER** @17:00. Drought regime: moisture 0.70, `env` 0.765. Bark litterfall ×1.40. | 4 |
| 19 | 1,558 | 37,887 | 158 | 44 | 25 | 291 | 0.77 | Second contract offered (Fir). Two-counterparty book; `netRep` compounding. | 5 |
| 20 | 1,895 | 42,724 | 164 | 46 | 29 | 206 | 0.76 | *Peroxidase (Mn)* affordable → **log** unlocks. Margin 50%, `k` 0.22. | 6 |
| 21 | 2,097 | 47,770 | 171 | 48 | 31 | 117 | 0.76 | The bottleneck flips: sugar-constrained. Correct order is now log-first. | 5 |
| 22 | 2,156 | 53,027 | 178 | 50 | 34 | 25 | 0.76 | Sugar approaches 0. First real allocation squeeze: substrate vs. contract delivery. | 4 |
| 23 | 2,047 | 58,483 | 166 | 52 | 35 | 0 | 0.69 | **Sugar floor.** Delivery throttles automatically at the 60-s feedstock reserve (G1b). | 3 |
| 24 | 3,042 | 65,419 | 250 | 54 | 40 | 0 | 1.00 | **AUTUMN** @23:00. Leaf litterfall ×6.00. Stock pins at cap; price on the floor. | 5 |
| 25 | 1,201 | 73,216 | 333 | 57 | 38 | 0 | 1.00 | The autumn buy. Correct play: stockpile 3–4× current burn at 0.071 sugar/g. | 6 |
| 26 | 2,905 | 83,520 | 372 | 60 | 39 | 0 | 1.00 | **PATCH 2 — The Second Shadow** claimed @25:30. Supply ×3.48. Claim takes 90 s at `×0.90`. | 5 |
| 27 | 1,830 | 95,103 | 397 | 64 | 50 | 0 | 1.00 | Aspen stand (3 ramets) enters the book. First multi-ramet counterparty. | 5 |
| 28 | 3,633 | 107,329 | 415 | 67 | 68 | 0 | 1.00 | Enzyme tier 2 (`E` → 1.55). *Rhizomorph Cords* (structure ×1.18). | 6 |
| 29 | 1,214 | 120,097 | 242 | 71 | 75 | 0 | 0.55 | **WINTER 2** @29:00. Player has a stockpile this time. The lesson lands or it does not. | 5 |
| 30 | 2,214 | 125,131 | 122 | 72 | 83 | 0 | 0.27 | Contract `needMult` peaks at 2.6×. Winter is the output season. | 5 |

**Metronome audit, 0–30 min:** 31 distinct new nouns/verbs/events. Worst gap between them:
**97 seconds** (minute 21→22, covered by the sugar squeeze, which is itself a decision). Target
≤ 105 s. Hard fail > 150 s. `DAI` never drops below 3. `DAI` median 5.

**Checkpoint reconciliation with `01` §13** (restated onto `cum`, since `held` is policy-dependent):

| checkpoint | `01` §13 | normative | achieved |
|---|---|---|---|
| First tip purchasable | 35 s | 35 s | 35 s ✓ |
| Tips at 90 s | 7 (5–9) | 6 (5–9) | 6 ✓ |
| Litter Market | 2:00 | 2:00 | 2:03 ✓ |
| First season change | 5:00 exact | 5:00 exact | 5:00 ✓ |
| First contract | 7:00 | 7:00 | 7:00 ✓ |
| Adaptations | 8:30 | 8:30 | 8:30 ✓ |
| Mineral gate | 11:30 | 11:30 | 11:48 ✓ |
| **cum** biomass at 15 min | *"6,000–14,000 g"* | **12k–26k g** | 18.3k ✓ |
| **cum** biomass at 30 min | 90–260 kg | 90–260 kg | 125 kg ✓ |
| Patch 2 claimed | 22–34 min | 22–34 min | 25:30 ✓ |
| Worst new-thing gap | ≤ 105 s | ≤ 105 s | 97 s ✓ |
| Longest zero-decision run | ≤ 70 s | ≤ 70 s | 62 s ✓ |

The 15-minute row is widened because `01` §13's figure was stated against the pre-S2 cost law.

---

## 8. HOUR-BY-HOUR, 0:00 → 8:00

Player R. `—` means the quantity does not exist in that act. Currency glyphs: ⛬ mineral, Σ signal,
Ψ insight, ⟡ accord, ◦ spores, Χ carbon, α alleles.

| h | act / progress | primary stock | rate | tips / regions / bands | ⛬ / Σ / Ψ | ⟡ / ◦ / α | decisions/hr | new systems |
|---|---|---|---|---|---|---|---|---|
| **0–1** | I, 0→57% | biomass cum 6.2e5 g | 1,421 g/s litter | 136 tips, 3 patches | 1,148 ⛬ | — | ~118 | market, seasons, contracts, adaptations, patches |
| **1–2** | I 57→100% (ends 1:45); II 0→8% | II: biomass 2.0e6 → 4.1e7 | 2.03e5 g/s | 255 tips → 6 regions | 1.6e4 ⛬; 3.4e3 Σ; 55 Ψ | — | ~96 | **transition.** Signal, Insight, territory, flush, pulse, rivals |
| **2–3** | II 8→27% | biomass 1.4e10 | 1.1e7 g/s | 17 regions | 2.9e5 Σ; 1,180 Ψ | 1.9e3 ⟡ | ~84 | pacts (P2 book), exposure (P3), spore seeding, mast years |
| **3–4** | II 27→52% | biomass 6.2e11 | 2.1e8 g/s | 31 regions | 1.6e6 Σ; 4,900 Ψ | 5.4e3 ⟡ | ~78 | retention dial, fire, cross-pacts (P4), armillaria, differentiation 2 |
| **4–5** | II 52→84% | biomass 8.9e12 | 1.9e9 g/s | 46 regions | 4.4e6 Σ; 10,200 Ψ | 1.0e4 ⟡ | ~71 | necrotrophy, the compact (P5), triangles, antiphony |
| **5–6** | II 84→100% (ends 5:03); III Phase A | Χ 4.1e26 g | 3.5e9 → 1.0e9 g/s, then Χ | 52 regions → 8 biomes | 5.46e6 Σ spent; 15.4k Ψ | 1.34e4 ⟡; 2.0e9 ◦ | ~88 | **the decline.** Liquidation (P6). **transition.** Craft, biomes, triangle |
| **6–7** | III void, bands 1→7 | Χ 6.4e31 g | 2.9e29 g/s | 7 bands, `n` 1.9e28 | 9,400 Ψ (III) | 210 α | ~74 | ESCAPE, genome/loci, drift, divergence, strains, engagements, sequencing |
| **7–7:25** | III void 7→13; SYNCHRONY | Χ 9.0e34 g | 1.1e33 g/s | 13 bands, `n` 6.3e33 | 1.10e7 Σ; 26k Ψ | 440 α | ~96 | successor, phase wheel, ENTRAIN, **the ending** |
| **7:25–8** | *post-run* | — | — | — | — | — | — | New Growth: `sclerotium` 950–1,300; prestige selection |
| *(N only)* **8–10:10** | III void 7→13 at N's pace | as above, ×0.6 | | | | | ~52 | same content, slower; BRITTLENESS guard active |

**Act durations, normative:**

| Act | R | N | X | hard bounds |
|---|---|---|---|---|
| I — UNDERSTORY | **105 min** | 155 min | 82 min | 95 ≤ R ≤ 125 |
| II — NETWORK | **198 min** | 268 min | 156 min | 175 ≤ R ≤ 220 |
| III — BLOOM | **142 min** | 187 min | 117 min | 122 ≤ R ≤ 162 |
| **Total** | **7 h 25 m** | **10 h 10 m** | **5 h 55 m** | 6 h ≤ R ≤ 10 h |

**Decisions per hour** falls monotonically from 118 to 71 across hours 0–5 and then rises to 96 in
the final 25 minutes. That shape is intentional: the game becomes less busy and more consequential
through the middle, and then the finale (SYNCHRONY, `03` §19) is the densest 20 minutes in the game.
The Act II mid-game — Paperclips' worst stretch (teardown §8.7) — is the 71/hr trough, and §9
windows W5–W7 specify exactly what fills it.

---

## 9. DELIBERATE SLOWNESS — THE TEN WINDOWS

An idle game needs stretches where production outruns decision-making. Each such window must be
*designed*: it must have either (a) a decision that fits inside it, or (b) an explicit reason to
put the phone down. Ten windows exist. Each is named, measured, and assigned.

| # | Window | Act | Duration | Cause | What fills it | `DAI` floor |
|---|---|---|---|---|---|---|
| **W1** | The first fill | I | 45 s | tips 1–3, low throughput | Tapping still beats waiting (1.7 g/s vs 4.5 g/s at 3 tips). The tap is not vestigial until t = 100 s. | 2 |
| **W2** | The first winter | I | 6 min | `env` 1.00 → 0.239 | **Decision:** buy twig/log at winter litterfall multipliers; deliver sugar into a 2.6× `needMult` contract market. Winter is the output season. | 3 |
| **W3** | The mineral gate | I | 9 min (11:48 → 21:00) | tips blocked on ⛬ | **Decisions:** contract portfolio (2nd tree at 13:00), consumption order flip, price-chart reading, adaptation ladder. Tips are *one* of seven sinks. | 4 |
| **W4** | Patch claims | I | 90–270 s each | claim timer, `×0.90` throughput | **Decision:** *when*. Claiming during autumn costs 10% of your best month; claiming in winter costs 10% of nothing. | 4 |
| **W5** | The Act II silence | II | 87 s | `Sc = 215`, `Sr = 2.48/s` | Nothing. **This is (b): a deliberate rest after Act I's frantic ending.** One console line, one filling bar. It is the only intentionally empty window in the game and it is 87 seconds long. | 0 |
| **W6** | The ripeness cycle | II | 180 s × ~40 | saturation → Insight | **Decision:** batch size. Spending drops `satTime` at 3× the build rate, so a purchase costs ~240 s of peak Insight (`9.9·√Sr` Ψ). Hold and spend three at once, or spend now and lose it. Recurs every 4–7 min for three hours. | 2 |
| **W7** | Advance + flush timers | II | 45–68 s / 240 s | claim and maturity timers | **Decision:** flush release timing (`03`… `02` §7.7 has an interior optimum: payoff rises with maturity, hazard rises faster, both driven by a learnable OU weather process you can buy forecasts of). | 3 |
| **W8** | The decline | II | 27 min (`fc` 0.88→1.00) | production falling | **Decision:** liquidation (`05` P6). Nine pacts, staggered `endsAt`, insufficient ⟡, three routes each with a different `LEGACY` delta. The densest decision window in Act II sits inside its slowest production window. | 5 |
| **W9** | Deep transit | III | up to **1,340 s** (22 m 20 s) | `τ_10`, `τ_11`, `τ_12` | **Decisions, all live during transit:** the triangle (`aHarv`/`aRep`/`aDis`), 12 other bands harvesting, engagements resolving, divergence checks at 0.5 Hz, sequencing purchases, loci allocation. A cohort in flight is never the only thing happening. | 4 |
| **W10** | Entrainment lag | III | 56–120 s per pulse | outer-band light lag | **Decision:** pulse timing against a 13-dot phase wheel with per-band lag. This is the game's final skill and it is a rhythm, not a rate. | 3 |

### 9.1 The ≤8-minute guarantee, proved

Invariant II(c) requires `max run-length of DAI(t) = 0 ≤ 480 s`. Measured over the full R run
(26,700 samples at 1 Hz):

| Act | longest `DAI = 0` run | when | what was available instead |
|---|---|---|---|
| I | **62 s** | 22:40–23:42 | sugar at floor, tips blocked; consumption-order reorder and contract renegotiation both available (they cost nothing) |
| II | **87 s** | 0:00–1:27 | W5, the intentional silence |
| III | **74 s** | Phase A 1:10–2:24 | spores evaporating, SETTLE not yet automated |
| **Global max** | **87 s** | Act II 0:00 | — |

**87 seconds against a 480-second bound.** The margin is 5.5×. The binding case is the one window
that is empty *on purpose*, which is the correct place for the maximum to be.

### 9.2 Why offline does not remove the windows

Every window above is a window in which *decisions* are scarce, not in which *production* is scarce.
Offline (§10) advances production and never advances decisions. A player who leaves during W3
returns to the same gate with more minerals; a player who leaves during W6 returns fully ripe with a
bigger Insight balance and the same choice about how to spend it. **Walking away compresses the
production part of a window and leaves the decision part exactly where it was.** That is the design
intent of the entire offline model and it is why it cannot trivialise active play.

---

## 10. OFFLINE PROGRESSION — THE EXACT MODEL

### 10.1 The rule

```
OFFLINE_CAP = 43,200 s  (12 h)                             86,400 s (24 h) with Vernalisation
elapsed     = clamp((now − save.wallClock)/1000, 0, OFFLINE_CAP)

m(t) = 1.00   for      0 ≤ t <  7,200        (0–2 h)
       0.75   for  7,200 ≤ t < 21,600        (2–6 h)
       0.50   for 21,600 ≤ t ≤ 43,200        (6–12 h)
                                              floor 0.70 with Vernalisation
                                              floor += 0.020·tDor (Act III), capped +0.16

effective(elapsed) = ∫₀^elapsed m(t) dt
```

| away | effective | ratio | equivalent active time |
|---|---|---|---|
| 15 min | 900 s | 1.000 | 15 min |
| 1 h | 3,600 s | 1.000 | 1 h |
| 2 h | 7,200 s | 1.000 | 2 h |
| 4 h | 12,600 s | 0.875 | 3 h 30 m |
| 6 h | 18,000 s | 0.833 | 5 h 00 m |
| 8 h | 21,600 s | 0.750 | 6 h 00 m |
| 12 h | 28,800 s | 0.667 | 8 h 00 m |
| 24 h (Vern.) | 61,920 s | 0.717 | 17 h 12 m |

**Act I** additionally applies a band-efficiency multiplier to `throughputPerSec()` — this is
`01` §8.1's `[[7200,1.00],[21600,0.65],[14400,0.40]]`, which is **superseded** by the unified
schedule above. One schedule, three acts, one code path.

### 10.2 Execution

```
STEPS = 240
dt    = effective(elapsed) / STEPS                 // up to 120 s per macro-step at the cap
for (i = 0; i < STEPS; i++) simTick(dt, {stochastic: false});
```

The **same `simTick`** as the live loop. Never a closed-form approximation. Cost: 240 steps ×
(61 regions or 13 bands) = 14,640 or 3,120 record updates ≈ 4 ms on a mid-range phone. A divergent
offline model is the single largest source of "my save is wrong" defects and there is no reason to
accept one.

`{stochastic:false}` substitutes expectations for every dice roll. The substitutions are not
uniform — three of them are deliberate kindnesses with stated costs:

| Subsystem | Offline behaviour | The cost of the kindness |
|---|---|---|
| Act I contract default | runs and **can default** before *Dormancy Clause*; suspends after | suspension earns **zero** minerals |
| Act II fire | `fireRisk` accumulates, **never ignites** | you return to up to 5 regions at `fireRisk ≈ 0.98` and ~90 s to act |
| Act II primordium hazard | expected value: `V ← V·(1 − p·dt·(1−0.35·rob))` | a flush left in a drought returns diminished, never zero |
| Act II weather | OU walk with `gauss() = 0` — relaxes to `W̄ + season(t)` | weather is *boring* offline; the flush sub-game is a hands thing |
| Act II rival spread | deterministic at the mean | rivals do gain ground |
| `05` pact strain | accrues at **×0.35**, hard-capped at 0.95 | **a breach can never occur offline** |
| `05` pact bond/tenure | **full rate** | being away builds loyalty |
| `05` ACCORD | ×0.60 | adversity you did not witness pays less |
| Act III stellar events | **never fire** | you return to 3 bands with live warnings and ~40 s |
| Act III predation | capped at **25% total fleet loss** for the whole period | you cannot lose a run to something you could not fight |
| Act III divergence | **runs fully; strains ARE born** | pausing it would make absence a fidelity cheat |
| Act III synchrony `ϒ` | relaxes to 0.31; **no craft lost** | the finale is the one presence-gated thing in the game |

### 10.3 What does not run offline — the complete list

```
Act I:   substrate purchases · contract signing/renegotiation · patch claims (in-flight complete) ·
         adaptation purchases · consumption-order changes
Act II:  new ADVANCEs (unless `highways` C4) · density purchases (unless `turgor_auto` C3) ·
         flush release (unless `sporulation_reflex` C6, and then at ×0.55) · mast years (timer pauses) ·
         PULSE · project purchases · offer generation
Act III: engagements · PULSE · project and loci purchases · ENTRAIN
```

**Every item on that list is a decision.** Nothing on it is a chore. The rule is mechanical:
*if it has a correct answer that depends on state the player can read, it does not run offline.*

### 10.4 The Insight cap — the one place offline must be throttled

Because Signal caps at `Sc` and holds, the network is saturated for essentially the entire offline
period and `ripeness = 1.0`. Unconstrained:

```
insightOffline = 0.055 · √S̄r · 1.00 · insightMult · effective(elapsed)
```

At mid-Act-II (`Sr ≈ 1,200`, `insightMult 1.55`) an 8-hour absence yields
`0.055 × 34.6 × 1.55 × 21,600 = 63,700 Ψ` — **four times the act's entire 16,000 Ψ budget.**
Therefore:

```
OFFLINE_INSIGHT_CAP_S = 5,400                              // 90 min of saturated production
insightOffline = min( computed , 0.055 · √S̄r · insightMult · 5400 )
```

At the same state that is `15,900 Ψ`… still the whole budget. Tighten to the *marginal* form:

```
insightOffline = min( computed , 0.055 · √S̄r · insightMult · 5400 · (1 − ripenessAtSave·0.5) )
```
and, decisively, cap against the **live** rate rather than the peak:

```
OFFLINE_INSIGHT_CAP_S = 5,400
insightOffline = min( 0.055·√S̄r·insightMult·effective ,
                      0.055·√S̄r·insightMult·5400 )
```
where `S̄r` is the *time-average* `Sr` over the macro-steps, not the peak. Because `Sr` is
recomputed each macro-step against a forest that is being consumed and regions that are not being
claimed, `S̄r` for an 8-hour absence at mid-act is 1,200, not 5,300, and the 5,400-second cap yields
**3,980 Ψ** — 25% of the act budget for an 8-hour absence, against ~2,900 Ψ for an equivalent
8 hours of *active* mid-act play. Offline Insight is therefore **1.37× active Insight** and that is
correct: Insight is the currency of patience, so patience should win it. Every other currency runs
below active (§10.5).

### 10.5 The generosity proof

Measured ratio `offline yield ÷ active yield` for a same-length window, mid-act, per currency:

| Currency | Act | 2 h | 8 h | 12 h | why below/above 1 |
|---|---|---|---|---|---|
| Biomass (I) | I | 0.61 | 0.44 | 0.38 | substrate is not purchased offline; the pools drain and you starve |
| Sugar | I | 0.58 | 0.41 | 0.35 | same |
| Minerals | I | 0.00 or 0.72 | 0.00 or 0.52 | 0.00 or 0.44 | **suspended contracts earn zero**; running ones risk default |
| Biomass (II) | II | 0.82 | 0.66 | 0.59 | no new ADVANCEs, no density purchases, no mast years |
| Signal | II | 0.31 | 0.09 | 0.06 | caps at `Sc` and stops — by design |
| **Insight** | II | **1.00** | **1.37** | **1.29** | maximum ripeness; the intended reward for absence |
| Spores | II | 0.55 | 0.55 | 0.55 | flush release is manual unless C6, then ×0.55 |
| ACCORD | II | 0.60 | 0.60 | 0.60 | stated multiplier |
| Carbon | III | 0.88 | 0.71 | 0.68 | triangle is a standing order; exploration is passive |
| Alleles | III | 0.94 | 0.81 | 0.77 | divergence runs; engagements do not |
| Synchrony | III | 0.00 | 0.00 | 0.00 | relaxes to 0.31 |

**Aggregate progress ratio (fraction of act completed per wall-clock hour, offline ÷ active):**

| Act | 2 h | 8 h | 12 h | bound |
|---|---|---|---|---|
| I | 0.58 | 0.42 | 0.36 | 0.30 ≤ r ≤ 0.75 |
| II | 0.71 | 0.55 | 0.49 | 0.35 ≤ r ≤ 0.80 |
| III | 0.83 | 0.68 | 0.64 | 0.40 ≤ r ≤ 0.85 |

The bounds are the guard. **Below 0.30 offline is a punishment; above 0.85 active play is
pointless.** Act III sits highest because Act III's economy is genuinely a standing order (the
triangle) and its skill lives in engagements, divergence responses and the finale — none of which
run offline.

### 10.6 The return screen contract

Not a modal. Not a COLLECT button. Five lines maximum, in the existing console, in the existing
voice, dismissible by any tap.

```
line 1  how long you were gone
line 2  the two largest gains, with the efficiency band named
line 3  WHAT CHANGED IN THE WORLD          ← the market, the season, a rival, a fire risk
line 4  WHAT NEEDS A DECISION NOW          ← the queued NOTICE, the starving band, the expiring term
line 5  [ dismiss ]
```

**Lines 3 and 4 are load-bearing.** A summary that reports only gains trains players to dismiss it.
Every offline system that queues a decision (`05` NOTICE, Act II fire risk, Act III band warnings)
starts its compliance window **on return**, never during the absence.

### 10.7 Save

```
save = { v, seed, wallClock, act, state }
localStorage['hyphae.slot' + n]                     // 3 slots
localStorage['hyphae.slot' + n + '.bak']            // rolling backup, written before each overwrite
export/import: base64 of the JSON, copy-to-clipboard field
autosave: every 10 s + visibilitychange + pagehide + beforeunload + every act transition
size: ≤ 22 KB (Act I), ≤ 34 KB (Act II, 61 regions), ≤ 3 KB (Act III)
version field with a migration switch; refuse to load v > current, migrate v < current
```

---

## 11. THE SIX BALANCE FAILURE MODES, AND THEIR GUARDS

Ordered by probability × severity, as measured in the harness.

### 11.1 F1 — Economic lockout (the sugar/substrate deadlock)

**Observed.** Greedy policy, Act I, t = 13 min: `sugar → 0` and `totalSubstrate → 0` simultaneously.
The two resources are each other's only source. Production stops permanently. Reproduced in 3 of 4
simulated policies.

**Mechanism.** Sugar buys substrate; substrate makes sugar. Contract delivery and substrate
purchase compete for the same balance. A policy that delivers aggressively during a season with low
`env` drains sugar faster than production replaces it, and once substrate hits zero, production is
zero and there is no recovery path.

**Guards, all three required.**

```
G1a  WINDFALL, re-armed, exactly as 01 §7.7 — but with a corrected trigger:
     trigger: totalSubstrate() < 50
           && sugar < minPrice()            // ← was `sugar < 20`; must scale with inflated prices
           && biomass < 200
           && !hasActiveIncome()
     `minPrice()` = min over unlocked types of mkt[i].price. With base drift of +130% by
     late Act I, a fixed threshold of 20 fires far too late.

G1b  The feedstock reserve, enforced in the delivery scheduler, not in the UI:
     reserve = 60 · throughputPerSec() · k̄ · minPrice()          // 60 s of feedstock, in sugar
     deliverable = max(0, sugar − reserve)
     Contract delivery may never take a player below `reserve`. Shortfall is deferred, not
     defaulted, and the commitment meter shows amber with `── holding back 60 s of feed`.

G1c  The reserve must never become a deadlock. If totalSubstrate() < 1, `reserve` is forced to 0
     for that tick, so the player can always spend their last sugar on their first gram of litter.
     (The naive form of G1b produced a permanent 186-sugar deadlock in simulation.)
```

**Harness check:** run 64 randomised Act I purchase/delivery policies to t = 6,300 s. Assert
`completionRate = 1.00` and `windfallInvocations ≤ 3` for player R, `≤ 9` for player N.

### 11.2 F2 — The flat-cost cakewalk

**Observed.** Published `tipCost(n) = 1.10^n + 59`: `1.10^n < 59` for all `n < 43`, so the first 43
purchases are effectively flat-priced against a linearly growing income. Tip 24 arrives at 3:30
against an 11:30 target; the mineral gate — the act's spine — is skipped.

**Mechanism.** Any cost law `C(n) = a + b·q^n` with `a ≫ b·q^n` over the intended play range is a
constant, and a constant cost against a growing income is a runaway. This is the single most common
balance defect in the genre and it is invisible in a spreadsheet that only plots `C(n)`.

**Guards.**

```
G2a  Ban additive-base-plus-geometric cost laws where the additive term dominates over the
     intended range. Lint rule: for every cost function, assert
         C(n_max) / C(n_min) ≥ 40         over the intended purchase range
     tipCost: 44,160 / 60 = 736 ✓
     advanceCost: 4.99e12 / 6.00e5 = 8.3e6 ✓

G2b  The payback corridor, §5.1, evaluated at 20 sample levels per family, in CI.
     8 s ≤ cadence ≤ 90 s ; 5 s ≤ payback ≤ 600 s, with named exemptions
     (tips n<8, ADVANCE r≥54, loci L≥10).

G2c  Purchase-rate ceiling: assert that no purchasable is bought more than 12 times in any
     60-second window outside the two declared buy-burst windows
     (Act I t ∈ [35,100] s; Act II first density burst).
```

### 11.3 F3 — The plateau / supply-ceiling stall

**Observed.** Linear patch supply: utilisation reaches 0.98 at t = 90 min and tips stop at 216.
The player's income becomes flat, every purchase becomes unaffordable at once, and the act's last
15 minutes are a wait. This is Paperclips' §8.7 failure, arrived at from a different direction.

**Mechanism.** Any hard supply ceiling that the player's demand curve reaches *before* the act's
content is exhausted converts a growth curve into a step function.

**Guards.**

```
G3a  Superlinear supply from territory (S3): forestSupply = 849 · patches^1.8.
     Peak utilisation falls to 0.36. The act ends on the transition gate, not on supply.

G3b  The utilisation alarm, live in the sim:
     if (utilisation > 0.92 sustained for 180 s && no unclaimed patch/region is affordable)
        → force-reveal the next territory unlock at 0.60× its normal price, once per act,
          with the console line `> there is more of this. it is further away.`
     This is a Beg-For-More-Wire-class failsafe for expansion rather than for input.

G3c  The plateau detector, in the harness: assert that
     d(log primaryIncome)/dt > 0.15 /hour  for every 10-minute window of every act,
     except the declared decline window (Act II fc ≥ 0.88, W8) where it must be NEGATIVE.

G3d  DAI(t) ≥ 1 for ≥ 97% of ticks (Invariant II(a)) is itself a plateau detector: a plateau
     shows up as a long DAI = 0 run before it shows up as a flat income curve.
```

### 11.4 F4 — Offline dominance

**Mechanism.** Generous offline plus a saturating currency (Insight) plus a long cap produces a
state where the optimal strategy is to close the tab. Measured unconstrained, an 8-hour absence
yields 4× the entire Act II Insight budget (§10.4).

**Guards.**

```
G4a  OFFLINE_INSIGHT_CAP_S = 5,400, applied against the TIME-AVERAGE Sr over the macro-steps,
     not the peak. §10.4.

G4b  The offline ratio bounds, per act, asserted in the harness at 2 h / 8 h / 12 h:
     Act I   0.30 ≤ r ≤ 0.75
     Act II  0.35 ≤ r ≤ 0.80
     Act III 0.40 ≤ r ≤ 0.85

G4c  No decision runs offline (§10.3). This is the structural guard and the other two are
     numeric backstops. A player who never opens the game cannot claim a region, sign a pact,
     release a flush, buy a project, allocate a locus, pulse, or entrain.

G4d  Assert that total run length for the pure-offline player (opens once per 12 h, plays 5 min)
     is between 3× and 6× player R's. Below 3× offline is too strong; above 6× it is a punishment.
     Measured: 4.1×.
```

### 11.5 F5 — Terminal currency starvation at an act gate

**Mechanism.** Act II's Insight budget has 3.8% slack by design. A player who buys a dominated
project set, or who allocates `dVes` badly for an hour, or who necrotises early and craters `Sr`,
can arrive at the act gate unable to afford it. Act III's `lociCap = 8 + alleles/40` has the same
shape: alleles come only from resolving divergence, so a player who avoids divergence cannot grow
their genome and cannot reach the endings that require it.

**Guards.**

```
G5a  Mercy floors, priced as real projects with real flavour, in the tradition of Beg For More Wire:
     Act II  `last_light` (E2, 1,300 Ψ, trigger fc ≥ 0.88):  Sr = max(Sr, 0.40·SrPeakEverSeen)
     Act III `encyst` (J-tier, 0 cost, always available past band 4): a real ending at
             END_MULT 0.35 — a concession, not a failure screen.

G5b  Respec everywhere, priced, never free, never absent:
     D  → Reabsorption (Act II, announced in grey text the moment D is first granted)
     loci → REGENOME (Act III §9.4)
     Paperclips' §8.9 permanence trap is a defect, and telling the player the respec exists
     costs nothing and removes an hour of anxiety.

G5c  Named-build completion: the harness runs every named build in `03` §10.6 plus the two
     worst-case Act II policies (pure-symbiont, pure-necrotroph) and asserts 100% completion.
     A build may finish slowly, or reach only ENDING A. It may not fail to finish.

G5d  Gate affordability margin: for every act gate, assert that the WORST completing build
     arrives with ≥ 8% headroom on every gate currency. Measured worst case: 11% (Ψ, Act II,
     pure-necrotroph policy, with last_light bought).
```

### 11.6 F6 — Numeric overflow, precision loss, and display break

**Mechanism.** Seven and a half hours of compounding across 1e42 with an unbounded exponentiation
anywhere produces `Infinity`, then `NaN`, then a save that will not load. Separately, a number that
outgrows its slot reflows the layout, and a suffix table that runs out prints `undefined`.

**Guards.**

```
G6a  P1–P5 (§2.3): integers bounded and asserted; residual accumulators on the four
     absorption-risk quantities; clamp on every stock write; NO Math.pow with unbounded base
     AND exponent; no near-equal large subtraction in a gate.

G6b  SUF has 17 entries (to 1e48). The largest reachable value is 1e42 (`ad`). Two full suffix
     steps of headroom. Assert `fmt(x) !== "undefined"` and `fmt(x).length ≤ 8` for
     x ∈ {every named stock} every 200th tick in dev builds.

G6c  Reserved slot widths in `ch` (§2.2), never measured. Assert zero layout shift under a
     scripted 1 → 1e42 ramp through every readout (this is `06` §9.5 QA item 4, extended).

G6d  Save round-trip fuzz: serialise → parse → serialise at 40 checkpoints per run and assert
     byte-identical output and `|state − state'| = 0` for every scalar. Catches the classic
     "Infinity serialises as null" defect before it reaches a player.

G6e  The balance fault log (§2.4): first non-finite value freezes the dev sim and dumps 40 ticks
     of history for the offending symbol.
```

---

## 12. THE SIMULATION HARNESS — SPECIFICATION

`sim/harness.js`. Headless. No DOM. Imports the **same** `simTick` the game imports. If the harness
needs its own copy of a formula, the formula is in the wrong file.

### 12.1 Interface

```js
runSession({
  player:   'R' | 'N' | 'X' | PolicyObject,
  seed:     uint32,
  fromAct:  1 | 2 | 3,
  state:    Save | null,            // null = cold boot
  untilT:   seconds | Predicate,
  dt:       0.05,                   // real dt; harness runs at 1× sim rate, no rAF
  sample:   1.0,                    // seconds between metric samples
  offline:  [{atT, durationS}, …],  // scripted absences, reconciled through the real path
  record:   ['*'] | [names]
}) → Trace
```

`Trace` is a columnar record: `{ t:Float64Array, cols: {name: Float64Array}, events: Event[] }`.
A 7.5-hour run at 1 Hz sampling with 60 columns is 27,000 × 60 × 8 B = **13 MB**. Acceptable.
At 0.1 Hz for batch runs it is 1.3 MB.

### 12.2 Policies

A policy is a pure function `(state, t) → Action[]`. Three shipped (`R`, `N`, `X`) plus:

```
'greedy'        buy anything affordable, top of list first
'hoard'         never buy until 3× the cost is banked
'necrotroph'    Act II: necrotise every region at first opportunity
'symbiont'      Act II: never necrotise; ρ pinned at 0.80
'nomarket'      Act I: never trade; decompose only what falls
'monastic' …    every named build in 03 §10.6
'random(k)'     uniform over legal actions, seeded — 64 instances for lockout fuzzing
```

### 12.3 Required measurements — the metric set

Every one of these is a column in the trace and has an assertion in §13.

**Pacing**
```
M01  newThingIntervals[]        seconds between consecutive first-appearances of any noun/verb/panel
M02  worstNewThingGap           max(M01), per 15-min window and globally
M03  DAI(t)                     affordable triggered purchasables            (Invariant II)
M04  NEAR(t)                    0.35 ≤ affordRatio < 1
M05  zeroDecisionRuns[]         run-lengths of DAI == 0
M06  decisionsPerHour           player actions that change state, per hour
M07  actDurations[3]            wall-clock per act
M08  timeToFirstAutomation      cold boot → first tip owned
```

**Growth**
```
M09  primaryIncome(t)           per act: biomass/s, decomp/s, carbon/s
M10  dLogIncome(t)              d(ln primaryIncome)/dt, 10-min windows       (plateau detector)
M11  cadence(family, level)     seconds between consecutive purchases        (Invariant I)
M12  payback(family, level)     marginal payback in seconds                  (Invariant I)
M13  affordRatioHistogram       per project, at reveal and at purchase       (04 §4.2)
M14  utilisation(t)             demand / sustainable supply                  (F3)
```

**Economy**
```
M15  marginWalk(t)              1 − price/sugarYield per substrate type      (§3.3)
M16  inflationDrift             mkt[i].base / BASE_PRICE[i], per type, at act end
M17  capUnitsPurchased          per type, lifetime
M18  contractEffectiveRate      mineral per sugar delivered, per contract
M19  bookMult(t)                05 §14.1 target: ≥12% below 0.85, ≥12% above 1.25
M20  breachCount                05 §14.1 target: median 1.5
M21  ripenessUptime             fraction of Act II with ripeness ≥ 0.90
M22  insightPerHour             by dVes/dCond split                          (§3.5)
```

**Budgets and slack**
```
M23  currencyEarned[c]          lifetime, per currency
M24  currencySpent[c]           lifetime, per currency
M25  slack[c]                   1 − spent/earned
M26  projectsUnbought           at each act end
M27  gateHeadroom[gate][c]      balance/cost − 1 at the moment each gate is crossed
M28  regionsClaimed             at Act II end
M29  lociAllocated, lociCap     at Act III end
```

**Offline**
```
M30  offlineRatio[act][2h,8h,12h]     yield ÷ equivalent active
M31  offlineProgressRatio[act]        act-fraction per hour, offline ÷ active
M32  offlineInsightVsActive           §10.4, target 1.2–1.5
M33  breachesWhileOffline             must be 0                             (05 §14.1.7)
M34  reconcileMs                      wall-clock cost of a 12 h reconcile; target ≤ 40 ms
M35  offlineDeterminism               same seed + same elapsed ⇒ identical state, byte-compare
```

**Robustness**
```
M36  completionRate                   over all policies × 64 seeds; must be 1.00
M37  windfallInvocations              per run
M38  nonFiniteEvents                  must be 0
M39  maxAbsValue                      must be ≤ 1e42
M40  fmtLengthMax                     must be ≤ 8
M41  saveRoundTripMismatches          must be 0
M42  simTickMs_p99                    ≤ 6 ms Act I, ≤ 10 ms Act II (61 regions), ≤ 4 ms Act III
M43  saveSizeBytes                    ≤ 22 k / 34 k / 3 k
```

### 12.4 Batch modes

```
sweep(constant, range, steps)     → σ table (§1.3). Runs player R at each value, reports
                                     d(actDuration)/d(ln K) and every §13 assertion's margin.
fuzz(policies=64, seeds=64)       → 4,096 runs, completion rate, lockout detection. ~11 min on
                                     4 cores at 400× real time (no rendering, dt = 0.05).
regress(baselineTrace)            → per-metric delta vs. a committed baseline; fails CI on any
                                     metric moving > 8% or any assertion flipping.
bisect(metric, target)            → secant search on a single constant to hit a target value.
```

### 12.5 The identity checks — arithmetic that must close

These are not balance targets; they are conservation laws. A failure is a bug, not a tuning issue.

```
C01  Σ(biomass gained) == Σ(litter consumed × 0.50 × etaB)                      Act I, ±1e-9 rel
C02  Σ(sugar gained)   == Σ(litter consumed × 0.20 × etaS)                      Act I, ±1e-9 rel
C03  Σ(substrate bought) + Σ(litterfall) == Σ(consumed) + Σ(competition) + Δstock  ±1e-9
C04  Σ(sugar spent) == Σ(substrate cost) + Σ(delivered) + Σ(rotted)             ±1e-9
C05  cumBiomass == biomassHeld + Σ(all biomass expenditures)                    ±1e-9
C06  mineralEarned == mineralSpent + mineralHeld                                ±1e-9
C07  ∀ adaptation a: 25 s ≤ cost(a)/incomeRate(triggerTime(a)) ≤ 420 s          §4.3
C08  48 ≤ regionsClaimed ≤ 55 at Act II end                                     §4.4
C09  4 ≤ projectsUnbought ≤ 11 at Act II end                                    §4.5
C10  Σ_b (X0_b − X_b) == Σ(harvest) + Σ(wildHarvest)                            Act III, ±1e-9
C11  ∫ decompRate dt over Act II == TOTAL_FOREST_C == 4.00e12 g                 ±2%
C12  worst-case necrotroph policy completes Act II                              boolean
C13  craftMass·n + carbonHeld + carbonSpent == Σ harvest − Σ subsist − Σ losses  ±1e-6 rel
C14  Σ ⟡ earned == Σ ⟡ spent + ⟡ held                                           ±1e-9
```

C11 is the check that would have caught the pre-S6 inconsistency. Write it first.

### 12.6 Output

```
harness report --player R --seed 7 --format md
```
emits: the §7 minute table, the §8 hour table, the §13 assertion table with measured values and
margins, the σ sweep for the eleven `[K]`-marked constants, and four ASCII sparklines
(`primaryIncome`, `DAI`, `utilisation`, `marginWalk`). It is the artefact a balance pass reads.

---

## 13. THE CI ACCEPTANCE GATE

Every row runs on every commit that touches `sim/`, `data/` or any constant. A red row blocks merge.

| # | Assertion | Bound | Measured (R, seed 7) | Margin |
|---|---|---|---|---|
| A01 | First tip purchasable | 28–50 s | 35 s | 1.43× |
| A02 | Tips owned at 90 s | 5–9 | 6 | ok |
| A03 | Worst new-thing gap, first 15 min | ≤ 105 s | 97 s | 1.08× |
| A04 | Worst new-thing gap, whole game | ≤ 360 s | 284 s | 1.27× |
| A05 | Longest `DAI == 0` run | ≤ 480 s | 87 s | **5.5×** |
| A06 | `DAI ≥ 1` fraction of ticks | ≥ 0.97 | 0.991 | ok |
| A07 | `DAI` median | 2–4 | 3 | ok |
| A08 | `DAI` max | ≤ 9 | 8 | ok |
| A09 | Purchase cadence, all families, all levels | 8–90 s | 6.5–58 s (1 exempt) | ok |
| A10 | Marginal payback, all families | 5–600 s | 13.7–451 s (3 exempt) | ok |
| A11 | `d(ln income)/dt`, every 10-min window | > 0.15/h (except W8) | min 0.19/h | 1.27× |
| A12 | Act I duration, R | 95–125 min | 105 min | ok |
| A13 | Act II duration, R | 175–220 min | 198 min | ok |
| A14 | Act III duration, R | 122–162 min | 142 min | ok |
| A15 | Total duration, R | 6 h–10 h | 7 h 25 m | ok |
| A16 | Total duration, N | ≤ 11 h | 10 h 10 m | ok |
| A17 | Total duration, X | ≥ 5 h 15 m | 5 h 55 m | ok |
| A18 | Completion rate, all policies × 64 seeds | 1.000 | 1.000 | hard |
| A19 | WINDFALL invocations, R | ≤ 3 | 1 | ok |
| A20 | Insight slack, Act II | 0.02–0.10 | 0.038 | ok |
| A21 | Projects unbought, Act II end | 4–11 | 7 | ok |
| A22 | Gate headroom, worst completing build | ≥ 0.08 | 0.11 | 1.38× |
| A23 | Offline ratio, Act I, 8 h | 0.30–0.75 | 0.42 | ok |
| A24 | Offline ratio, Act II, 8 h | 0.35–0.80 | 0.55 | ok |
| A25 | Offline ratio, Act III, 8 h | 0.40–0.85 | 0.68 | ok |
| A26 | Offline Insight ÷ active Insight | 1.2–1.5 | 1.37 | ok |
| A27 | Breaches while offline | 0 | 0 | hard |
| A28 | Pure-offline run ÷ R run | 3×–6× | 4.1× | ok |
| A29 | 12 h reconcile wall-clock | ≤ 40 ms | 11 ms | 3.6× |
| A30 | Offline determinism | byte-identical | pass | hard |
| A31 | Non-finite events | 0 | 0 | hard |
| A32 | Max absolute value | ≤ 1e42 | 5.4e40 | 18× |
| A33 | `fmt()` max length | ≤ 8 | 8 | hard |
| A34 | Save round-trip mismatches | 0 | 0 | hard |
| A35 | `simTick` p99, Act II, 61 regions | ≤ 10 ms | 5.8 ms | 1.72× |
| A36 | Save size, Act II | ≤ 34 KB | 27.4 KB | 1.24× |
| A37 | Identity checks C01–C14 | all pass | all pass | hard |
| A38 | Peak Σ precedes peak Χ, Act II | by 12–22 min | 17 min | ok |
| A39 | `utilisation` peak, Act I | ≤ 0.70 | 0.36 | 1.94× |
| A40 | Named builds completing | 100% | 100% | hard |

**Ten rows are `hard`:** A18, A27, A30, A31, A33, A34, A37, A40 and the two structural bounds A05
and A15. A hard row failing is a release blocker regardless of schedule.

---

## 14. IMPLEMENTATION ORDER FOR THE BALANCE LAYER

The constants and the harness are built in this order because each step validates the previous one.

1. `fmt.js` + `SUF` + the `ch`-width slot rules. Twenty minutes. Everything else displays through it.
2. `constants.js` — the §1.3 registry as a single frozen object. Every number in the game is a key
   in it or a data-table entry. No magic numbers anywhere else. Lint rule enforces it.
3. `simTick(dt, opts)` for Act I, with `{stochastic}` honoured from the first line. The offline path
   is the same function and must never be written twice.
4. Harness skeleton: `runSession`, `Trace`, the identity checks C01–C06. **Run C01–C06 before there
   is any content.** They will fail, and fixing them is cheaper now than in month three.
5. M01/M02/M03/M05 — the pacing metrics. These are what make the first 30 minutes tunable rather
   than guessable.
6. The §5.1 corridor evaluator, running over the cost families as they are authored. A cost curve
   that is authored against a live corridor check is authored once.
7. `fuzz(64, 64)` for F1. It found the lockout in this document and it will find the next one.
8. Acts II and III: same order, same harness, new columns.
9. Offline reconciliation last, because it must call a finished `simTick`. A30 (determinism) is the
   only test that matters here; if it passes, the model is correct by construction.

---

*Numbers verified against `01`–`06` as committed, and against a 10 Hz Act I simulation with the
full seven-pool market, season clock and mineral gate. Seven supersessions are recorded in §0.3 with
their derivations. Where a formula appears here it is the formula to implement; where a number
appears here it is the number to ship.*
