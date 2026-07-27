# HYPHAE — THE DESIGN BIBLE

**Status: CANONICAL. This document supersedes `00`–`09` wherever they disagree with it or with
each other.**

The nine design documents are still the reference for *derivation* — why a number is what it is,
what a system is for, how a formula was fitted. This document is the reference for *truth* — what
the implementation builds. Where a sibling document contains a formula this document does not
restate, the sibling still governs, subject to the precedence order below and the conflict-resolution
log in §7.

### Precedence order (binding)

1. **This document.** Names, units, state shape, tick order, flags, module boundaries.
2. `08-balance-pacing.md` — every **number**. Its seven supersessions (S1–S7) are law.
3. `06-ui-visual-language.md` — every **pixel, colour, curve and millisecond**.
4. `09-narrative-voice.md` — every **human-readable string**.
5. `07-juice-audio-haptics.md` — every **sound, vibration and sub-second response**.
6. `05-strategic-subgame.md` — the Act II strategic layer and the Act III Antiphony.
7. `04-projects-catalog.md` — the **projects architecture and reveal queue**, and the Act I / Act II
   catalogs. Its §7 (Act III) is **void** — see §7 C1.
8. `01`, `02`, `03` — act mechanics, subject to 2–7.
9. `00-paperclips-teardown.md` — rationale only. Never normative.

---

## 1. THE PITCH AND THE PILLARS

### 1.1 The pitch

**HYPHAE** is a mobile-first, single-file, zero-dependency incremental game in which you are a fungal
mycelial network that begins as a few threads on a forest floor and ends as a planetary intelligence
letting go of its own children. Across three acts of roughly equal weight you learn a complete game
and then have it taken away from you twice: Act I is a **liquidity business** — you buy dead wood on a
market you personally inflate and sell sugar forward to trees whose willingness to pay peaks exactly
when your production collapses; Act II is a **mind made of the thing it eats** — sixty-one stands that
are simultaneously fuel and neurons, and a Signal rate that peaks at 80% consumed and then falls,
because you ate your own brain; Act III is a **parent** — everything that makes you stronger makes
your children less like you, and the only new genes in the universe come from the children who
stopped agreeing. It runs at 60 fps in portrait on a five-year-old Android, is generous when you walk
away and rewards you for coming back, contains no ads, no purchases, no timers-you-can-skip, no
notifications, no analytics, no images, no fonts and no audio files, and it ends with nothing on the
screen at all.

### 1.2 The five pillars

Every design decision must serve at least one of these and violate none.

**P1 · REVOCATION OVER ACCUMULATION.**
Act transitions take things away. `DECIDE` deletes the Litter Market, reputation, every contract,
every hyphal tip and 90% of stored biomass. `ASCOSPORE DISCHARGE` destroys sixty-one regions, the
weather, the map and the entire flush sub-game. `ESCAPE VELOCITY` destroys 96% of the fleet. The
player loses *mastery*, not just inventory, and must rebuild with new verbs. Mid-act revocation is
also available as a purchase (`Perennial Mycelium`, `Quiescence`, `The Armillaria Accord`,
`Let the Last Body Go`). Adding a panel is an update; taking one away is an act.

**P2 · EVERY CURRENCY IS A DIFFERENT VERB.**
Biomass is eating. Sugar is trading. Minerals are negotiating. Reputation is keeping your word.
Signal is being alive in the right places. **Insight is waiting.** Spores are timing a bet. Accord is
enduring. Differentiation is reading. Carbon is consuming. **Alleles are surviving betrayal.** A
currency that is a bigger version of another currency is a reskin and does not ship. Two currencies
are earned only by *failure states* — Insight requires the Signal pool to be full and therefore
overflowing, Accord accrues only while the world is hurting you — and one, Alleles, is earned only
by children who defected.

**P3 · DESIRE HAS AN ADDRESS.**
`trigger` and `cost` are separate predicates evaluated every sim tick. A project appears greyed the
instant it becomes conceptually available and lights up when it is purchasable. Never more than six
non-pinned items visible; never fewer than one affordable for longer than 480 seconds; median two to
four affordable and two to four visible-and-saved-for. Bought projects are removed from the DOM.
There is no completed tab, no receipts, no codex, no tooltip, no tutorial.

**P4 · ONE THUMB, ONE COLUMN, NO NAVIGATION.**
360 CSS px design base, 420 px column forever, portrait. Everything the player does more than ten
times a session, or under time pressure, lives in the bottom 200 px. Zero navigation actions are
required to finish the game. The layout is the progress bar: panels un-hide as they are earned, five
tab slots are allocated at boot and revealed one at a time, and in the Act III dismantle the screen
shrinks back to one button and then to nothing.

**P5 · ABSENCE IS REWARDED; SKILL IS THE MULTIPLIER.**
Offline runs the *same* `simTick`, generously (0.42–0.68 of active, per act, at 8 h), and nothing
decays, breaches, ignites or is lost while you are away. But **no decision runs offline** — not a
claim, a pact, a flush release, a project, a locus, a pulse or an entrainment. Walking away compresses
the production part of a window and leaves the decision part exactly where it was. The return screen
reports what needs a decision, never what you earned, and there is no COLLECT button.

---

## 2. THE CANONICAL RESOURCE LIST

**There is exactly one name, one symbol and one unit for every quantity in HYPHAE.** Where a sibling
document uses a different name, this table wins and §7 records the change.

### 2.1 Stocks and flows

| # | Resource | State key | Glyph | Unit | Acts | Produced by | Cap | Destroyed at |
|---|---|---|---|---|---|---|---|---|
| 1 | **Biomass** | `biomass` | `g` | grams | I, II | decomposition | none (clamp 1e42) | ×0.10 at `DECIDE`; → `sporeBank` at `ASCOSPORE` |
| 2 | **Substrate** | `sub[type]` | `g` | grams, 7 typed pools | I | Litter Market purchase, litterfall | per-pool `capOf(i) = CAP_PER_PATCH[i] · patches` | `DECIDE` |
| 3 | **Sugar** | `sugar` | `sug` | grams | I | decomposition | `sugarCap = 400 + 30·tips + sclerotiaBonus` | `DECIDE` (ceases to be a currency) |
| 4 | **Minerals** | `minerals` | `⛬` | mineral units | I, II, III | contracts, ROOT pacts, Oxalate Weathering, mineral exchange | none | ×0.25 at `ASCOSPORE`; **never produced in Act III** |
| 5 | **Hyphal Tips** | `tips` | — | count, integer | I | purchase | 400 (assertion) | `DECIDE` → 0 |
| 6 | **Hyphae** | `hyphae` | — | metres, derived | I | `1.75·tips + 30·(patches−1) + hyphaeManual` | none | `DECIDE` |
| 7 | **Reputation** | `netRep`, `trees[].rep` | `rep` | 0–100 | **I only** | honouring contracts | 100 | `DECIDE` — deleted entirely |
| 8 | **Signal** | `signal` | `Σ` | signal units | II, III | live interface (II) / coherent craft (III) | **`Sc`**, hard | act-continuous; `signalMult ×0.35` at `ASCOSPORE` |
| 9 | **Insight** | `insight` | `Ψ` | insight | II, III | **saturation only** | none | never — survives both transitions |
| 10 | **Spores** | `spores` | `◦` | count | II, III | flush release; biomass conversion | none | decays; see §2.3 |
| 11 | **Differentiation** | `D` | `D` | integer | II, III | cumulative-mass ladders + flavour projects | 45 lifetime | freed for one reallocation at `ASCOSPORE` |
| 12 | **Accord** | `accord` | `⟡` | accord | **II only** | adversity endured under pact | none | `ASCOSPORE` |
| 13 | **Carbon** | `carbon` | `Χ` | grams | III | harvest | none (clamp 1e42) | — |
| 14 | **Craft** | `bands[b].n`, `biomes[b].n` | — | count | III | replication | `NCAP_b` is a soft crowding term, not a cap | ×0.04 at `ESCAPE` |
| 15 | **Alleles** | `alleles` | `α` | count | III | **resolving divergence only** | none | — |
| 16 | **Loci** | `loci[8]` | `L` | integer per axis | III | bought with `Ψ` | `Σloci ≤ lociCap`; `lociCap` raised only with `α` | respeccable |
| 17 | **CANON** | `canon` | `†` | count | III | the Antiphony ladder | none (27 encounters is the source cap) | — |
| 18 | **Sclerotium** | `meta.sclerotium` | `◉` | count | meta | run completion | none | never |

### 2.2 Derived quantities (never stored as an independent stock)

| Quantity | Key | Range | Definition |
|---|---|---|---|
| **Moisture (Act I)** | `moisture` | 0.15–1.50 | relaxes toward `SEASON_MOIST[season] · weatherMoistMod` at 0.004/tick |
| **Weather (Act II)** | `W` | 0.02–0.98 | OU walk, `θ=0.010, σ=0.028, W̄=0.52`, plus `0.16·sin(2πt/WEATHER_PERIOD)` |
| **Signal capacity** | `Sc` | — | II: `260·(1+dVes)^1.85·(0.60+Σℓ)^0.85·capMult` · III: `364·(1+dVes)^1.85·(0.60+Λ)^0.85·capMult` |
| **Ripeness** | `ripeness` | 0–1 | `max(satTime/RIPE_T, ripenessFloor)`; `ripenessFloor ≤ 0.30` from GHOST pacts |
| **Forest consumed** | `fc` | 0–1 | `extracted / EXTRACT_TARGET` |
| **Planet consumed** | `pc` | 0–1 | `1 − ΣX_b / ΣX0_b` over the 8 biomes |
| **LEGACY** | `legacy` | 0–1 | `clamp(0.55·LEGACY_HUMUS + 0.45·LEGACY_LIFE + pactTerm, 0, 1)`, computed **once**, at `ASCOSPORE` |
| **Fidelity** | `effFid` (`Φ`) | 0.30–0.9975 | `clamp(fidelityBase + 0.030·tFid − 0.038·tAnt + boughtFid, 0.30, 0.9975)` |
| **Fidelity base** | `fidelityBase` | 0.72–1.00 | `0.72 + 0.28·legacy`, computed **once**, on entry to Act III |
| **Synchrony** | `upsilon` (`ϒ`) | 0–1 | Kuramoto order parameter, `|Σ_b m_b·e^{2πiφ_b}|`; free-runs at 0.31 |
| **Connectivity** | `C` | 1.00–1.60 | `1 + 0.14·(edges/max(1,nodes))^1.25` |
| **Genome length** | `G` | 0–26 | `Σ loci[k]` |
| **Craft mass** | `craftMass` | — | `2.40e6 · (1 + 0.085·G)^1.15` grams |

### 2.3 Decay, spoilage and the four caps

Only four things in HYPHAE are lossy. Each exists to force spending rather than hoarding.

| What | Rule | Why |
|---|---|---|
| **Sugar over cap** | `rot = (sugar − sugarCap)·0.06·dt`; `stats.rotted += rot` | trains spending; gates `Sclerotia` on `rotted ≥ 500` |
| **Signal over cap** | **hard clamp at `Sc`**, no overflow buffer | overflow becomes Insight; that is the whole economy |
| **Spores, Act II** | `× 0.99995^s` (half-life 3 h 51 m); disabled by `Seed Bank` (E3) | spores are a flow, not a bank |
| **Spores, Act III Phase A** | `× 0.99700^s` (half-life 231 s) | the act opens on a number going *down* |

`SPORE_DIVISOR = 270`. `sporeBank = spores + floor(biomassHeld / 270)` at `ASCOSPORE`. (Doc `02`'s
3.2e3 is superseded — §7 C10.)

### 2.4 Naming rulings

These are the resolutions of every naming and unit conflict across the nine documents. They are not
negotiable; a build using the old name does not ship.

| Canonical | Rejected aliases | Where the alias appeared |
|---|---|---|
| `minerals` (plural, `⛬`) | `mineral`, `min` | `01` §2, `01` §4 |
| `alleles` (`α`) | `lineage` (`λ`) | `04` §1.2, §7.0 |
| `accord` (`⟡`) | — | `05` |
| `canon` (`†`) | — | `05` §17.6 |
| `fc` / `forestConsumed` | `consumed` | `02` §12 |
| `SEASON_S = 360 s` (Act I forest season) | Act II's "season" | `02` §7.2, `05` §3.4 |
| `WEATHER_PERIOD = 1800 s` (Act II OU cycle) | `SEASON` | `02` §7.2 |
| `termPeriods` (Act II pact terms, 1800 s each) | `termSeasons` | `05` §3.1, §3.4 |
| `strain` (pact stress, 0–1) | `tension` | `02` §10.3 |
| `strains[]` (Act III wild lineages) | `wildStrains` (count only) | `04` §7.0 |
| `pacts` (Act II counterparties) | `contracts` (Act II) | `02` §12 triggers |
| `contracts` (Act I only) | — | — |
| `EXTRACT_TARGET` | `TOTAL_FOREST_C` | `08` §12.5 C11 |
| `regions[]` (61 hexes, Act II) | `stands` | `02` §15.1 |
| `bands[]` (13 shells, Act III) | `worlds` | `04` §7.0 |
| `biomes[]` (8, Act III Phase A) | `holdings` | `04` §7.0 |

**`SEASON_S` vs `WEATHER_PERIOD` is the most dangerous collision in the corpus** — two documents use
the word "season" for a 360-second object and an 1800-second object respectively. A build that
confuses them is off by 5× on every contract term. The words are now different words.

### 2.5 Number display

One formatter, in `core.js`, imported everywhere. Three significant figures, always.

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

`fmtMass()` (Act I `g/kg/t/…`) is a **presentation alias** with the suffix table offset two steps. It
is not a second implementation. Maximum rendered length is 8 characters (`999.9 ad`); every value slot
is `min-width: 8ch`, every rate slot `9ch`, and the layout never re-measures. No long-scale English
number words exist anywhere in the build. Design hard ceiling **1e42**; the suffix table reaches 1e48,
giving two full steps of headroom.

---

## 3. THE CANONICAL STATE SHAPE

This is a contract. Every module reads and writes through these keys and no others. Anything not in
this object is derived and must be recomputed, never stored. `v` is the schema version; a load of
`v > CURRENT` is refused, `v < CURRENT` runs the migration switch.

```js
const SAVE = {
  v: 1,                       // schema version. Bump on ANY key rename or removal.
  seed: 0x9E3779B9,           // uint32. Drives worldgen, names, morph rolls, matrix perturbation.
                              // The same seed must reproduce the same forest, forever.
  wallClock: 0,               // Date.now() at last write. The only input to offline reconciliation.
  act: 1,                     // 1 | 2 | 3
  phase: "understory",        // "understory" | "network" | "canopy" | "void" | "dismantle" | "ended"
  t: 0,                       // seconds of SIMULATED time since cold boot. Never wall-clock.

  // ─────────────────────────────────────────────────────────────────────────
  // RESOURCES — the canonical list of §2. Present in every act; unused keys stay 0.
  // ─────────────────────────────────────────────────────────────────────────
  res: {
    biomass:    0,            // g. Act I–II bulk. Zeroed at ASCOSPORE.
    cumBiomass: 0,            // g, lifetime gross. Drives the Act II D ladder.
    extracted:  0,            // g, Act II only. fc = extracted / EXTRACT_TARGET.
    sugar:      0,            // g, Act I only. Capped; overflow rots at 6%/s of the excess.
    minerals:   0,            // ⛬. Acts I–III. ×0.25 at ASCOSPORE. Never produced in Act III.
    signal:     0,            // Σ. HARD-CLAMPED at Sc every tick. No overflow buffer exists.
    insight:    0,            // Ψ. Uncapped. Survives both transitions untouched.
    satTime:    0,            // s of continuous saturation, 0..RIPE_T. Ripeness = satTime/RIPE_T.
    spores:     0,            // ◦. Decays (§2.3).
    accord:     0,            // ⟡. Act II only. Destroyed at ASCOSPORE.
    accordLifetime: 0,        // ⟡ ever earned. Feeds the LEGACY pact term.
    carbon:     0,            // Χ. Act III only.
    cumCarbon:  0,            // Χ lifetime. Drives the Act III D ladder and regenomeCost.
    alleles:    0,            // α. Sole source: PURGE / ABSORB / SUCCESSOR PURGE.
    canon:      0,            // †. Act III Antiphony only.
    D:          0,            // total Differentiation points EARNED (allocated + unallocated).
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MULTIPLIERS — every value a project can move. Reset ONLY by New Growth.
  // Any effect not expressible as one of these keys needs a new key, in this block, reviewed.
  // ─────────────────────────────────────────────────────────────────────────
  mult: {
    // Act I
    enzymeMult: 1.00,         // product of enzyme projects
    enzymeK: { leaf:1, needle:1, twig:1, bark:1, log:1, stump:1, carrion:1 },
    structureMult: 1.00,      // Rhizomorph / Anastomosis
    patchMult: 1.00,          // 1 + 0.06*(patches-1)
    osmoticPriming: 1.00,     // → 0.50
    hartigNet: 1.00,          // → 1.18
    exudatePump: 1.00,        // → 1.35
    cmnMult: 1.00,            // → 1.50, reputation GAINS only
    arbitration: 1.00,        // → 0.45, default penalties
    antifreeze: false,
    sclerotiaBonus: 0,        // additive on sugarCap
    perennial: false,         // Perennial Mycelium: deletes the event engine. Irreversible.
    // Act II
    E: 1.00,                  // enzymePower, 1.00 → ~26 across Act II
    yieldMult: 1.00,
    signalMult: 1.00,
    capMult: 1.00,
    insightMult: 1.00,
    antibiosis: 1.00,
    advCostMult: 1.00,
    advanceSpeed: 1.00,
    matSpeed: 1.00,
    sporeMult: 1.00,
    hazMult: 1.00,
    necroMult: 1.00,
    ripeT: 180,               // s. → 130 (C7) → 95 (D7). Act III INHERITS this value.
    ripenessFloor: 0.00,      // from GHOST pacts, hard cap 0.30. Does NOT count as saturation.
    // Act III
    harvMult: 1.00, replMult: 1.00, germMult: 1.00, exploreMult: 1.00,
    boughtFid: 0.00,          // projects + CANON. HARD CAP +0.24 combined. See §7 C37.
    // meta
    prestigeGrowth: 1.00,     // from New Growth. Multiplies Act I E and Acts II/III SIG_K.
  },

  // ─────────────────────────────────────────────────────────────────────────
  // COGNITION — shared by Acts II and III. cognition.js owns this block.
  // ─────────────────────────────────────────────────────────────────────────
  cog: {
    dCond: 0, dVes: 0, dLag: 0,   // allocated D. dLag exists only in Act III.
    respecs: 0,                   // COUNTER IS NOT RESET at the act break. Cost escalates across both.
    SrPeak: 0,                    // for the Act II mercy floor (Photoreception)
    pulseCd: 0,                   // seconds remaining
    pulseMode: "SURGE",
    pulseEpicentre: 0,            // region id (II) or band index (III)
    pulsesInFlight: [],           // [{mode, epicentre, band, arriveAt}] — Act III light-lag only
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ACT I
  // ─────────────────────────────────────────────────────────────────────────
  a1: {
    tips: 0,
    hyphaeManual: 0,          // += 0.020 per EXTEND tap  (S4)
    season: 2,                // 0 SPRING 1 SUMMER 2 AUTUMN 3 WINTER. Cold boot = AUTUMN.
    seasonPhase: 0.1667,      // first boundary at t = 300 s, exactly
    year: 0,
    moisture: 1.05,           // the exact peak of the response curve: every multiplier is 1.000
    weatherMoistMod: 1.00,
    weatherFallMod: [1,1,1,1,1,1,1],
    sub:  { leaf:2000, needle:0, twig:0, bark:0, log:0, stump:0, carrion:0 },
    consumptionOrder: ["leaf","needle","twig","bark","log","stump","carrion"],  // player-ordered
    unlockedTypes: ["leaf","needle","twig"],
    mkt: [/* 7 × { base, price, mom, stock, coolT } ; hist is NOT saved, it refills in 120 s */],
    patches: 1,               // 1..6
    claimInFlight: null,      // { patchId, endsAt } — completes offline
    netRep: 0,
    trees: [/* { id, species, age, health, rep, ramets, refuseUntil, lastReneg, mastYear } */],
    contracts: [/* { id, treeId, sugarRate, mineralRate, termSeasons, startT, endT,
                     collateral, exclusive, delivered, shortfall, suspended, state } */],
    activeEvents: [/* { id, seasonsLeft, payload } */],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ACT II — 61 regions stored as PARALLEL TYPED ARRAYS, not 61 objects.
  // Serialised to ~4 KB base64. Index i is the region id, forever.
  // ─────────────────────────────────────────────────────────────────────────
  a2: {
    W: 0.52, Wmom: 0, windSpeed: 0.45, windDir: 0,   // the OU weather process (flush.js owns it)
    mastAt: 0, mastUntil: 0,
    regions: {
      q:        Int8Array(61),    r: Int8Array(61),
      terrain:  Uint8Array(61),   // 0 Loam 1 Sand 2 Clay 3 Scree 4 Peat 5 Burn
      sp0:      Uint8Array(61),   sp1: Uint8Array(61),  w0: Float32Array(61),   // species mix
      L0:       Float32Array(61), L:  Float32Array(61),
      T0:       Float32Array(61), T:  Float32Array(61),
      h:        Float32Array(61), d: Float32Array(61),  rho: Float32Array(61),
      col:      Float32Array(61), // colonisation 0..1
      flags:    Uint8Array(61),   // bit0 discovered · 1 surveyed · 2 claimed · 3 advancing
                                  // bit4 necrotized · 5 rhoPinned · 6 quietRing · 7 reserved
      rival:    Int8Array(61),    rivalStr: Float32Array(61),
      barriers: Uint8Array(61),   fireRisk: Float32Array(61),
      phase:    Float32Array(61), // UNUSED in Act II. Kept so the array shape is act-invariant.
    },
    flush: [/* { regionId, V, m, rob, fec, hyg, bornAt, mode } */],
    pact:  { /* the entire 05 §19.2 block, verbatim, versioned separately as pact.v */ },
    mineralMkt: { P: 0, Pbar: 0, momentum: 0 },
    legacyHumus: 0, legacyLife: 0,     // written ONCE, by ASCOSPORE, before territoryReboot()
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ACT III
  // ─────────────────────────────────────────────────────────────────────────
  a3: {
    biomes: { X: Float64Array(8), n: Float64Array(8), reached: Uint8Array(8) },   // Phase A only
    bands: {
      X:     Float64Array(13), e: Float32Array(13), rich: Float32Array(13),
      n:     Float64Array(13), nResid: Float64Array(13),   // P2 residual accumulator
      drift: Float32Array(13), phase: Float32Array(13),
    },
    transit: [/* { from, to, count, tRem } */],
    alloc: [0.70, 0.20, 0.10],        // aRep, aDis, aBank. Must sum to 1 on every write.
    loci: Int8Array(8),               // BAL GER MYC SPO MEL DOR FID ANT — this order, forever
    lociBought: 0, lociCap: 12, capRaises: 0,
    regenomeAt: 0,                    // t when a REGENOME completes; replication halted until then
    strains: [/* { id, name, genome:Int8Array(8), w:Float64Array(13),
                   origin, born, sequenced, quarantinedUntil } */],
    succ: null,                       // { genome, w, born, linesShown } once coalesced
    mortality: Float64Array(6),       // rolling 60 s: STARVE RAD TRANSIT ESTAB SENESCE PREDATION
    antiphony: { /* the 05 §19.2 antiphony block, verbatim */ },
    upsilon: 0.31,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CARRIED ACROSS ACT BOUNDARIES — written once, read forever.
  // ─────────────────────────────────────────────────────────────────────────
  carry: {
    legacy: 0,                // [0,1]. Written at ASCOSPORE. Read on Act III entry, once.
    fidelityBase: 0.72,       // 0.72 + 0.28·legacy. Written on Act III entry. NEVER recomputed.
    pathFlag: "mixed",        // "symbiont" | "necrotroph" | "mixed" (from The Charter / Total Conversion)
    sporeBank: 0,             // spores + floor(biomassHeld / 270)
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PROJECTS — slugs, never indices. `seen` MUST persist separately from `bought`
  // or a project triggered on a transient condition vanishes on reload.
  // ─────────────────────────────────────────────────────────────────────────
  proj: {
    bought: [],               // ["rhizomorph_cords", ...]
    seen:   [],               // ever-triggered, incl. bought. The reveal-queue's memory.
    uses:   {},               // { windfall: 3, a_gift_of_phosphorus: 2 } for re-armables
    flags:  {},               // { laccase_cascade: 1 } — the ONLY legal way to test a purchase
    queue:  [],               // slugs waiting on VISIBLE_CAP, in trigger order
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LOG — the console. `once` flags are keyed by the string id and must survive reload.
  // ─────────────────────────────────────────────────────────────────────────
  log: {
    fired: [],                // ids of once:true lines already shown
    ring:  [],                // last 200 rendered lines, for the LOG tab. Trimmed on save.
    lastObsAt: 0, lastLineAt: 0, openingLines: 0,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STATS — every behavioural trigger reads from here. Additive only; never reset mid-run.
  // ─────────────────────────────────────────────────────────────────────────
  stats: {
    taps: 0, purchases: 0, sugarSpentOnMarket: 0, rotted: 0, largestSinglePurchase: 0,
    contractsSigned: 0, contractsCompleted: 0, defaults: 0, mineralEarned: 0,
    wintersEnded: 0, carrionEventsSeen: 0, offlineSeconds: 0,
    densityBuys: 0, flushes: 0, pulses: 0, seededCount: 0, claimedCount: 0,
    rivalContacts: 0, barrierBlocks: 0, droughtsSurvived: 0, ignitions: 0,
    signalOverflow: 0, mineralTrades: 0, everSaturated: false,
    reallocations: 0, pactsHonoured: 0, pactsBreached: 0, traitsRevealed: 0,
    releases: 0, targetsReached: 0, engagements: 0, purged: 0, absorbed: 0, quarantined: 0,
    radiationHazards: 0, entryAttempts: 0, strainsBorn: 0, respecs: 0,
    windfalls: 0, endingsReached: 0,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SETTINGS — persisted, never reset by New Growth.
  // ─────────────────────────────────────────────────────────────────────────
  set: {
    theme: "auto",            // "auto" | "dark" | "light"
    sound: "sparse",          // "off" | "sparse" | "full"
    haptics: true,
    slow: false,              // doubles every deadline; changes no rate
    calm: false,              // eventRateMod 1.00 → 0.55
    reduceMotion: null,       // null = follow the OS
  },

  // ─────────────────────────────────────────────────────────────────────────
  // META — survives New Growth. This is the ONLY block a prestige does not clear.
  // ─────────────────────────────────────────────────────────────────────────
  meta: {
    sclerotium: 0,
    upgrades: [],             // purchased sclerotium-tree slugs
    growthLevel: 0, coherenceLevel: 0, divergenceLevel: 0,
    archive: [],              // ≤3 { name, genome[8] } — YOUR OWN DEFECTORS, by name
    lineages: [],             // every wild strain ever produced, uncapped, ~40 B each
    runs: 0,
  },
};
```

### 3.1 Rules that bind on this shape

1. **Nothing derived is stored.** `Sr`, `Sc`, `ripeness`, `C`, `fc`, `craftMass`, `effFid`, `ϒ`,
   `hyphae`, `throughputPerSec()` are recomputed. The only exceptions are `carry.legacy` and
   `carry.fidelityBase`, which are written once at a transition and are *snapshots by design* — the
   evidence they were computed from is destroyed in the same function.
2. **`seen` is persisted separately from `bought`.** A project that triggered on `first rival contact`
   or `any h < 0.25` must not disappear on reload. This is a real shipped bug in several incrementals
   and it costs one array to avoid.
3. **Region data is parallel typed arrays.** 61 objects is 30 KB of JSON; the arrays are ~4 KB base64.
   Index `i` is the region id forever; regions are never reordered, spliced or sorted.
4. **`t` is simulated seconds, never wall-clock.** `wallClock` exists only to compute `elapsed` on
   return and is written by autosave.
5. **Every stock is clamped on write** via `setStock()` (`08` §2.3 P3): non-finite → previous value +
   assertion; negative → 0; above `1e42` → `1e42`.
6. **Four quantities use residual accumulators** (`08` §2.3 P2): `a3.bands.n`, `a3.bands.X`,
   `strains[].w` and `res.carbon`. Nowhere else.
7. **Save budget:** ≤22 KB Act I, ≤34 KB Act II, ≤3 KB Act III. Three slots
   (`hyphae.slot{n}`) plus a rolling `.bak` written before each overwrite, plus base64
   export/import via a copy-to-clipboard field. Autosave every 10 s and on `visibilitychange`,
   `pagehide`, `beforeunload` and every act transition.

---

## 4. THE CANONICAL TICK ORDER

One function, `simTick(dt, opts)`, called by the live loop, by the catch-up path and by offline
reconciliation. **There is no second copy of any formula.** Steps that do not apply to the current act
are no-ops and cost a branch.

```
simTick(dt, { stochastic = true, offline = false })
```

| # | Step | Owner | Acts | Notes |
|---|---|---|---|---|
| 1 | **Clock** — `t += dt`; advance `seasonPhase`; on boundary fire `rollEvents()` | `act1` | I | Act II/III have no season clock |
| 2 | **Environment** — Act I moisture relaxation; Act II OU walk for `W`, wind, graze pressure, per-region `m_i` | `act1`, `flush` | I, II | offline: `gauss() = 0`, so weather relaxes to `W̄ + season(t)` |
| 3 | **Supply** — Act I litterfall + competition + market stock; Act II litterfall, tree growth `dT/dt`, humus `dh/dt` | `economy1`, `forest` | I, II | Act II tree growth **must** precede decomposition so `T` is current for `liveInterface` |
| 4 | **Production** — Act I `stepDecomposition()` over `consumptionOrder`; Act II per-region `decomp_i`; Act III `harvest_b` per biome/band | `act1`, `forest`, `bloom` | I–III | writes `biomass`/`carbon`, `cumBiomass`/`cumCarbon`, `extracted` |
| 5 | **Subsistence & continuous losses** — Act III `subsist`, `starve`, radiation, senescence, predation; every death attributed to exactly one of six `mortality[]` causes **at the point it occurs** | `bloom` | III | attribution is not retrofittable; write it before the hazards |
| 6 | **Allocation & conversion** — Act III triangle: `repDemand`/`repActual`, `launchDemand`/`launch`; transit decay; **arrivals** with `pEst` | `bloom` | III | arrivals feed step 11's drift term (`newCraft_b`) |
| 7 | **Caps & spoilage** — sugar rot above `sugarCap`; spore decay; `signal` clamp is deferred to step 9 | `act1`, `flush` | I–III | `stats.rotted` is written here; it gates `Sclerotia` |
| 8 | **Strategic layer** — Act I contract delivery (with the 60-second feedstock reserve, G1b/G1c); Act II Pact Book, in **`05` §19.1's fourteen sub-steps, in that order**; Act III engagements | `contracts`, `pactbook`, `divergence` | I–III | the pact sub-order is load-bearing: strain oscillates if steps 4 and 8 are swapped |
| 9 | **Cognition** — accrue `Sr·dt` into `signal`; **hard-clamp to `Sc`** and add the excess to `stats.signalOverflow`; update `satTime` (`+dt` if saturated, `−RIPE_DEC·dt` if not); accrue Insight iff saturated | `cognition` | II, III | the clamp is here, after every producer and consumer of Signal has run |
| 10 | **Territory** — Act II colonisation, rival contest, retake checks, density automation; Act III `de_b/dt` exploration | `world`, `bloom` | II, III | offline: new advances do not start unless `highways` is owned |
| 11 | **Risk** — Act II primordium maturity, hazard rolls, mast window, fire accumulation; Act III drift accumulation, divergence events, strain growth/spread, Successor coalescence and learning | `flush`, `forest`, `divergence` | II, III | offline: fires and stellar events **never trigger**; hazards apply expected value |
| 12 | **Pulse** — decrement `pulseCd`; in Act III, deliver `pulsesInFlight` whose `arriveAt ≤ t` | `cognition` | II, III | never runs offline |
| 13 | **Synchrony** — Act III `φ_b += ω_b·dt`; apply entrain arrivals from step 12; recompute `ϒ`; apply Successor desync | `finale` | III | offline: `ϒ` relaxes toward 0.31, no craft lost |
| 14 | **Ladders & derived milestones** — D grants against `cumBiomass`/`cumCarbon`; mineral gate; `SrPeak`; `fc`/`pc` | `cognition`, `bloom` | I–III | |
| 15 | **Unlocks** — `manageProjects()`: for every unbought, unrevealed project evaluate `trigger()`; `admit()` against `VISIBLE_CAP`; then recompute `disabled = !cost()` for every revealed project | `projects` | I–III | this is the last step that can change what the player may do this frame |
| 16 | **Log** — `manageLog()` at **1 Hz only** (every 10th tick in Act I, 20th in II/III), honouring `HARD_GAP`, `BURST_CAP`, `OBS_*` and the priority queue | `log` | I–III | frozen and flushed empty during transitions and endings |
| 17 | **Assertions** — dev builds only, every 200th tick: finiteness, integrality, `≤1e42`, `fmt().length ≤ 8`, identity checks C01–C14 | `harness` | — | ship builds clamp silently and bump a counter |
| 18 | **Autosave counter** — every 10 s of simulated time | `state` | — | plus the four event hooks |

### 4.1 Invariants of the order

- **Step 3 before step 4, always.** Production reads stocks that supply has just written. Inverting
  them makes the Act II tree-growth equilibrium table (`02` §9.2) wrong by one tick and the humus
  switch at `h ≈ 0.28` unstable.
- **Step 9 after step 8.** Signal is both produced by the world (step 3/4's `liveInterface`) and spent
  by the player and by PULSE. The clamp must see the net.
- **Step 6 before step 11.** `drift_b` is proportional to `newCraft_b / n_b`, which step 6 computes.
- **Step 15 last among gameplay steps.** A project must never be revealed against a half-updated
  world; every trigger predicate reads a consistent frame.
- **`{stochastic:false}` is honoured from the first line of every step**, not bolted on. It is the
  same flag used by catch-up and by offline; there is one code path.
- **Catch-up:** if the loop is more than 250 ms behind, run **one** tick with `dt = min(behind, 2.0)`
  and `{stochastic:false}`. Never burst.
- **Offline:** `STEPS = 240`, `dt = effective(elapsed)/240`, `simTick(dt, {stochastic:false, offline:true})`.
  A 12-hour reconcile is ≤ 40 ms on a mid-range phone (measured 11 ms).

### 4.2 Render is not simulation

Exactly **one** `requestAnimationFrame` loop and exactly **two** `setInterval`s exist in the build:
the sim (100 ms in Act I, 50 ms in Acts II–III — the period is swapped at the act break) and a 10 Hz
display timer for rates, cooldown rings and ARIA labels. Every component that thinks it needs a timer
gets a slot in one of those. The rAF loop interpolates counters between sim ticks, syncs changed
cards only, grows the canvas network and samples performance. It never mutates game state.

---

## 5. THE UNLOCK / FLAG GRAPH

Six kinds of trigger exist (`04` §1.1). Types 3 (**behavioural**) and 5 (**failure detection**) are
the ones that make the game feel like it is watching the player, and they are ~33 of the 163 entries.

### 5.1 Act flags — the master switches

| Flag | Set by | Cleared by | Gates |
|---|---|---|---|
| `act = 1` | cold boot | `DECIDE` | everything in `act1`, `economy1`, `contracts` |
| `act = 2` | `DECIDE` | `ASCOSPORE DISCHARGE` | `world`, `forest`, `flush`, `pactbook`; `cognition` becomes live |
| `act = 3` | `ASCOSPORE DISCHARGE` | — | `bloom`, `divergence`, `finale` |
| `phase = "canopy"` | `ASCOSPORE` | `ESCAPE VELOCITY` | 8 biomes, `SETTLE`, `REACH` |
| `phase = "void"` | `ESCAPE VELOCITY` | ending purchase | 13 bands, genome, divergence |
| `phase = "dismantle"` | any ending purchase | ending completes | staged panel teardown |

### 5.2 The Act I chain

| Flag / condition | Set by | Gates |
|---|---|---|
| `substrateRevealed` | `biomass ≥ 5` (≈3 s) | the SUBSTRATE readout |
| `tipsRevealed` | `biomass ≥ 60` (≈35 s) | `GROW TIP` — **the first automation, at 35 s** |
| `sugarRevealed` | `tips ≥ 3` (≈60 s) | the SUGAR readout, already holding ~24 g |
| `marketOpen` | `totalSubstrate() ≤ 500 \|\| t ≥ 210` | the Litter Market panel; `stats.purchases` begins |
| `seasonsRevealed` | `t ≥ 300` (exact) | the season strip; every multiplier stops being 1.000 |
| `treesRevealed` | `sugar ≥ 250 && season == WINTER` | THE UNDERSTORY; the first offer is the best-priced one for 20 min |
| `projectsOpen` | `biomass ≥ 2000` (≈8:30) | ADAPTATIONS; `manageProjects()` begins revealing |
| `mineralWarn` | `tips ≥ 20` | the greyed `0 ⛬` on GROW TIP — a forecast, not a wall |
| `mineralGate` | `tips ≥ 24` (≈11:48) | `tipMineralCost(n) = ceil(0.06·(n−23)^1.35)`. **The act's spine.** |
| `flags.anastomosis` | project | pooled substrate; the greyed `conduction —` readout |
| `flags.action_potential` | `flags.anastomosis && netRep ≥ 60` | SIGNAL appears **with no uses for 8–15 minutes** |
| `DECIDE` available | `flags.action_potential && signal ≥ 1000` | the act ends |

### 5.3 The Act II chain

| Flag / condition | Set by | Gates |
|---|---|---|
| `flags.chemotaxis` (400 Σ, ≈0:40) | act II start | FOREST panel, map, STANDS, `ADVANCE` |
| `stats.everSaturated` | `signal ≥ Sc − 0.5` once | `Turgor` (A3) |
| `flags.turgor` | project | **Insight**, the ripeness meter — the whole cognition economy |
| `flags.primordium` | `insight ≥ 8` | FLUSH, 1 slot |
| `flags.action_potential_ii` | `claimed ≥ 3` | **PULSE.** Never automated at any price, in any act. |
| `flags.differentiation` | `cumBiomass ≥ 5.0e8` (post-`ACT2_SCALE`) | D allocation; the Lucas ladder begins |
| `flags.pact_first` | `fc ≥ 0.004` | the Pact Book, 2 slots, 3 channels |
| `flags.humic_retention` | any `region.h < 0.25` | the Retention dial ρ — **failure detection** |
| `flags.necrotrophic_conversion` | `fc ≥ 0.22` | `KILL STAND`. Never automatable. |
| `flags.pact_chemotaxis` | `pacts ≥ 3 && maxTenure ≥ 600` | the EXPOSURE view and the stress tests |
| `flags.mast_synchrony` | `stats.flushes ≥ 40` | Mast Years, every ~35 min, for the rest of the act |
| `flags.the_charter` | `LEGACY_LIFE ≥ 0.55 && fc ≥ 0.60` | `pathFlag = "symbiont"`. **Excludes** `total_conversion`. |
| `flags.total_conversion` | `LEGACY_LIFE ≤ 0.25 && fc ≥ 0.60` | `pathFlag = "necrotroph"`. **Excludes** `the_charter`. |
| `flags.photoreception` | `fc ≥ 0.88` | `Sr ≥ 0.40·SrPeak` — the anti-softlock floor |
| `ASCOSPORE` available | `fc ≥ 0.97` | greyed for ~11 minutes while the map goes dark |

Neither `the_charter` nor `total_conversion` can be seen by a player between the two thresholds. That
player gets `pathFlag = "mixed"`, which is a legitimate third outcome with its own Act III epilogue,
and the game never mentions that it exists.

### 5.4 The Act III chain

| Flag / condition | Set by | Gates |
|---|---|---|
| `flags.germ_tube` (200 Σ, ≈0:55) | `n ≥ 2.0e8` | auto-SETTLE. **Automation inside a minute, third act running.** |
| `flags.appressorium` | `X ≥ 4.0e14` | `REACH` and the 8-biome list |
| `flags.translocation` | `biomes ≥ 2` | the TRIANGLE, with **two** vertices |
| `ESCAPE` available | `pc ≥ 0.97` | 96% of craft destroyed, exactly, not stochastically |
| `flags.genome` (G2) | `phase == "void"` | GENOME tab, 4 free loci, `lociCap = 12` |
| `flags.thrust` (G4) | `e_0 ≥ 0.25` | the triangle's **third** vertex, DISPERSE |
| `firstStrain` | `drift_b ≥ 1.0` | LINEAGES tab, `I1/I2/I6` triggers |
| `flags.anastomosis_offer` (I4) | 2 strains alive | ABSORB — and therefore the allele economy |
| `succ` | `Σw ≥ Σn` sustained 120 s | the Successor: the only adaptive opponent in the game |
| `flags.circadian_entrainment` (J2) | `bands ≥ 11` | PHASE, ENTRAIN, the wheel — the last 20 minutes |
| `flags.anti_organ` | `wildFraction ≥ 0.18` | the Antiphony: 27 encounters, no auto-run, hard cap |
| ENDING A | `ϒ ≥ 0.80 · 9.0e34 Χ · 2400 Ψ · 1.10e7 Σ held · 13 bands` | `growthLevel += 1` |
| ENDING B | `ϒ ≥ 0.97 · 1.60e35 Χ · 3600 Ψ · Φ ≥ 0.985 · zero strains · no Successor ever` | `coherenceLevel += 1` |
| ENDING C | `Successor age ≥ 1800 s · sequenced · Σw ≥ 3n` | `divergenceLevel += 1`. Costs nothing. |
| ENCYST | `phase == "void"` for 20 min | a real ending at `END_MULT 0.35`. Not a failure screen. |

### 5.5 The five failsafes

The game is **structurally incapable of dead-ending**. Each failsafe re-arms itself
(`uses` decremented on reveal, incremented in `effect()`), bypasses `VISIBLE_CAP`, and has a real,
permanent price.

| Failsafe | Trigger | Price | Act |
|---|---|---|---|
| **Windfall** | `totalSubstrate() < 50 && sugar < minPrice() && biomass < 200 && !hasActiveIncome()` | −1 `rep` (free once per 300 s at `rep = 0`) | I |
| **A Gift of Phosphorus** | `contractsCompleted ≥ 2 && any(tree.rep < 40)` | `200·2^k ⛬` | I |
| **Photoreception** | `fc ≥ 0.88` | 1,300 Ψ | II |
| **The utilisation alarm** | `utilisation > 0.92` for 180 s and no territory affordable | reveals the next patch/region at 0.60× price, once per act | I, II |
| **ENCYST** | `phase == "void"` + 20 min | 65% of your prestige | III |

`minPrice()` — not the literal `20` in `01` §7.7 — is required, because base drift of +130% by late
Act I makes a fixed threshold fire far too late (`08` §11.1 G1a).

---

## 6. MODULE DECOMPOSITION

Eighteen shipping modules plus one test harness. Each is independently implementable by a separate
agent against this contract. The dependency graph is a DAG; **no `sim/*` module may import a `ui/*`
module**, and UI reads state but never mutates it except through the exported command surface.

Every module exports `{ init(state), tick(state, dt, opts), serialise(state), migrate(save, from) }`
where applicable, plus its own surface. Nothing reaches into another module's private state.

---

### M1 · `core.js`
**Responsibility:** the zero-dependency foundation. Constants, formatting, deterministic randomness.
**Public surface:**
```js
export const TUNE;                     // the frozen 08 §1.3 registry. Every number in the game.
export const SUF;
export function fmt(n, sig=3);         // 3 s.f., SI to Q then aa..af. Max 8 chars.
export function fmtMass(g);            // presentation alias of fmt
export function fmtTime(s);            // "6 h 41 m", "hh:mm:ss"
export function rng(seed);             // xorshift128+ → { next(), gauss(), pick(arr), int(n) }
export function hash32(...keys);       // stable per-entity streams (region names, morph rolls)
export function clamp(v, lo, hi);
export function setStock(obj, key, v, max=1e42);   // 08 §2.3 P3, the only legal stock write
export function smoothstep(a, b, x);
```
**Dependencies:** none.
**Notes:** `TUNE` is frozen. Any magic number outside `TUNE` or a `data/` table fails the lint.

---

### M2 · `state.js`
**Responsibility:** own the §3 shape. Construction, validation, serialisation, migration, slots,
export/import, autosave scheduling.
**Public surface:**
```js
export function newGame(seed, meta);   // returns a SAVE conforming to §3
export function save(slot);            // writes .bak first, then the slot
export function load(slot);            // refuses v > CURRENT; migrates v < CURRENT
export function exportB64(); export function importB64(str);
export function migrate(save, from);   // the version switch. Additive migrations only.
export function assertShape(save);     // dev only; every key in §3, correct type
export const state;                    // the single live instance. Read freely; write via setStock.
```
**Dependencies:** `core`.
**Notes:** typed-array (de)serialisation for `a2.regions` and `a3.bands` lives here and nowhere else.
`proj.seen` must round-trip separately from `proj.bought`.

---

### M3 · `loop.js`
**Responsibility:** the scheduler. Act-dependent sim rate, catch-up, offline reconciliation driver,
the single rAF, visibility handling.
**Public surface:**
```js
export function start();
export function simTick(dt, opts);     // THE tick. Calls §4's eighteen steps in order.
export function reconcileOffline(now); // 240 macro-steps through simTick, {stochastic:false}
export function setSimRate(hz);        // 10 (Act I) | 20 (Acts II–III)
export function onFrame(fn);           // rAF subscribers (render only)
export function effective(elapsedS);   // ∫ m(t) dt, the 08 §10.1 schedule
```
**Dependencies:** `core`, `state`, and every `sim/*` module (it is the composition root).
**Notes:** this is the only file allowed to import everything. It must contain no game logic — only
ordering. If a formula appears here, it is in the wrong file.

---

### M4 · `projects.js`
**Responsibility:** the progression engine **and** the 163-entry catalog data. The single most
load-bearing system in the game.
**Public surface:**
```js
export const CATALOG;                  // 163 entries: {id,title,act,priceTag,description,
                                       //  trigger,cost,pay,effect,uses,pinned,excludes,kinds[]}
export function manageProjects(state);   // tick step 15
export function reveal(id); export function purchase(id);
export function affordRatio(id);         // max over currencies of cost/holding
export function visible();               // ≤ VISIBLE_CAP (6) non-pinned + all pinned
export function isBought(id);
```
**Dependencies:** `core`, `state`, `log` (for `logFire` on effect).
**Contract:** `trigger` and `cost` are **separate predicates**, evaluated every sim tick.
`pay()` and `effect()` are separate so effects are unit-testable in isolation, and **`effect()` must
be idempotent under double-fire** — the catch-up tick will double-fire. Bought projects are removed
from the DOM. Slugs, never indices. `excludes` removes an entry from `CATALOG` entirely, not merely
hides it, so a later trigger cannot resurrect it.
**Counts:** Act I 45 · Act II 68 · Act III 50 · **total 163.** Nine entries are `pinned: true`
(the five failsafes, the three act transitions, and `We Have Been Talking Without You`).

---

### M5 · `log.js`
**Responsibility:** the console. String catalog, trigger evaluation, suppression, tokens, the
offline return burst, idle observations.
**Public surface:**
```js
export const LINES;                    // 96 catalog entries + 25 observations, from strings.json
export function manageLog(state);      // tick step 16, 1 Hz ONLY
export function logFire(id, tokens);   // imperative, for system events at their event site
export function returnBurst(summary);  // the 5-line offline report, 1.2 s apart
export function ringBuffer();          // last 200 lines, for the LOG tab
export function freeze(); export function thaw();   // transitions flush the queue empty
```
**Dependencies:** `core`, `state`.
**Contract:** the register rule is enforced by lint: **Act I strings contain no `[A-Z]`.** The first
capital letter in HYPHAE is the first letter of Act II. No exclamation marks exist in the build. No
line advises. `HARD_GAP = 1.2 s`, `BURST_CAP = 6` per rolling 20 s, `OBS_COOLDOWN = 240 s`.
Lines wrap (`09` §1.8 supersedes `06` §5.7); the console is a five-**row** window, and a long line
costs you history, not legibility.

---

### M6 · `act1.js`
**Responsibility:** Act I production and environment. `EXTEND`, tips, decomposition over the typed
pools, the season clock, moisture, patches, the event engine, the Act I→II transition.
**Public surface:**
```js
export function onExtend();            // the tap. +haptic, +hyphaeManual, consumes substrate.
export function tipCost(n);            // ceil(60 + 3.2·n^1.72)   [S2; 2.6 with Foraging Front]
export function tipMineralCost(n);     // n < 24 ? 0 : ceil(0.06·(n−23)^1.35)
export function buyTip();
export function throughputPerSec();    // 1.875·tips·enzyme·structure·moisture·temp·patch  [S1]
export function stepDecomposition(dt);
export function stepSeason(dt); export function rollEvents();
export function moistureMult(); export function tempMult();
export function claimPatch(id); export function hyphae();
export function decide();              // the Act I→II transition. Irreversible.
```
**Dependencies:** `core`, `state`, `economy1` (substrate pools), `log`, `projects` (flags).
**Key constants (post-supersession):** `TIP_THROUGHPUT = 1.875 g/s`; `1 tip = 3.000 g leaf/s =
1.500 g biomass/s = 0.480 g sugar/s`; `hyphae = 1.75·tips + 30·(patches−1) + hyphaeManual`;
`hyphaeManual += 0.020/tap`; `patchSupplyMult = patches^1.8` on **fall**, linear on **cap**.
**Checkpoints it must hit:** first tip purchasable at 35 s (28–50); 6 tips at 90 s (5–9); market at
2:00; first season at 5:00 exactly; mineral gate at 11:48 (9–15 min); act complete at 105 min (95–125).

---

### M7 · `economy1.js`
**Responsibility:** the mean-reverting price-walk engine, instantiated twice: the Act I **Litter
Market** (7 pools) and the Act II **mineral exchange** (1 pair). Plus Act I trees and contracts.
**Public surface:**
```js
export function stepMarket(dt);        // stock (fall − competition), then price (mom, mean-rev, σ)
export function buy(type, grams); export function sell(type, grams);
export function fairValue(type); export function priceHistory(type);   // 120-sample ring, not saved
export function stepTrees(dt); export function carbonDeficit(tree);
export function offer(tree, volume, termSeasons, collateral, exclusive);
export function accepts(tree, volume, termSeasons, exclusive);
export function signContract(...); export function renegotiate(id); export function exitContract(id);
export function deliverContracts(dt);  // with the G1b feedstock reserve and the G1c anti-deadlock
export function stepMineralExchange(dt);   // Act II instance of the same walk
```
**Dependencies:** `core`, `state`, `log`.
**Contract:** the price walk has **momentum** (`MOM_DECAY = 0.955`, half-life ≈15 s, trends 40–90 s),
a **scarcity-driven fair value**, and a **permanent self-inflicted inflation term**
(`base *= 1 + INFL·osmoticPriming·grams/cap`). This is the whole reason "buy low" is a forecast and
not a reflex. **No dice roll exists anywhere in contract pricing.** Every bad outcome is traceable to
a term the player chose.
**Delivery is unconditional and continuous.** The shortfall budget is 5% of one season's delivery
(≈18 s of non-payment), counted down in seconds on screen.

---

### M8 · `world.js`
**Responsibility:** Act II territory. Worldgen (61 hexes, terrain, species, barriers, names),
adjacency and connectivity `C`, advance, spore seeding, hyphal density, rivals and contest.
**Public surface:**
```js
export function worldgen(seed);        // ≥3 Scree, ≥2 Peat, 0 Burn, ≤2 same-terrain adjacent,
                                       // 3 barrier chains of 5–9 edges, 9 rival-held in rings 2–4
export function neighbours(i); export function hexDist(a, b);
export function connectivity();        // C = 1 + 0.14·(edges/nodes)^1.25
export function advanceCost(i); export function startAdvance(i); export function cancelAdvance(i);
export function seedCost(i); export function sporeSeed(i);
export function densityStepCost(i, k); export function buyDensity(i);
export function stepColonisation(dt); export function stepRivals(dt);
export function survey(i);             // 120 Σ, requires substrate_assay
export function regionName(i);         // procedural, stable, seeded by id
```
**Dependencies:** `core`, `state`, `log`.
**Contract:** advance raises `C`; spore seeding *lowers* it by creating disconnected nodes. The two
verbs pull in opposite directions on the Signal rate, and the correct mix depends on where the
barriers are. **There is no dominant expansion order and the map is different every run.** Rivals are
pressure, not HP; there is no battle screen and no numeric damage. Losing a contest is slow, visible,
and reversible by investment.

---

### M9 · `forest.js`
**Responsibility:** Act II biology. Decomposition, litterfall, tree growth, humus, the Retention dial
ρ, fire, necrotrophy, the LEGACY computation, and the Act II→III transition.
**Public surface:**
```js
export function stepDecomp(dt); export function stepLiving(dt); export function stepHumus(dt);
export function liveInterface(i); export function totalInterface();
export function setRho(value, regionId=null);   // global + ≤5 pinned (10 with homeostasis)
export function stepFire(dt); export function ignite(i);
export function killStand(i);          // irreversible; sets necrotized; voids the pact
export function computeLegacy();       // 0.55·humusMean + 0.45·(ΣT/ΣT0) + pactTerm. ONCE.
export function ascospore();           // the Act II→III transition
export function forestConsumed();
```
**Dependencies:** `core`, `state`, `world`, `flush` (weather), `pactbook` (void a pact on kill), `log`.
**The load-bearing property:** `moistureF` is a **hump**, not a ramp, and humus is the switch between
a renewable stand and a mine at `h ≈ 0.28`. `ρ` is flat to within 1.5% on the short-run biomass rate
between 0.00 and 0.45 — **the dial is free in the short run and decisive in the long run**, because
it controls tree survival → interface → Signal → Insight, fire risk, reclaimability, and LEGACY.
Fire requires the player to have driven humus below 0.22, which requires ρ near zero, which they chose
because the short-run rate looked identical. `firebreak` is deliberately priced so the first fire
happens before you can afford it.
**Constants (post-`ACT2_SCALE = 0.333`):** `EXTRACT_TARGET = 4.00e12 g`; `FOREST_TOTAL = 7.08e12 g`;
`L0_total = 1.42e12`; `T0_total = 5.66e12`. **80% of the forest's carbon is alive**, and you must kill
at least 46% of the standing forest to finish the act.

---

### M10 · `flush.js`
**Responsibility:** the Act II weather process (which it **owns** and others merely read) and the
risk sub-game: primordia, morphs, maturity, hazards, release, spores, Mast Years.
**Public surface:**
```js
export function stepWeather(dt);       // the OU walk on W, wind speed/direction, graze pressure
export function W(); export function moistureAt(regionId); export function wind();
export function forecast(tau);         // E[W(t+τ)] ± band. Closed form; the honest OU conditional.
export function forecastHorizon();     // 0 → 120 (B4) → 300 (D1) → 600 (E1), +90 in ALARM regions
export function newPrimordium(regionId, V);   // morph is rolled and SHOWN before a gram is committed
export function stepMaturity(dt); export function stepHazards(dt, stochastic);
export function release(id); export function stepMast(dt);
export function stepSporeDecay(dt);
```
**Dependencies:** `core`, `state`, `world`, `log`.
**Contract:** **exposure grows as `m²` while yield grows as `m^1.6`**, so an interior optimum `m*`
always exists and always moves with the weather. Skilled release beats naive by up to +66% per flush.
The UI never shows `m*`; with `barometry` it draws the *forecast-implied* optimum, which can be wrong,
and a band-reading player beats the marker by ~9%. Three tiers of skill: naive, marker-following,
band-reading. **Auto-release is 0.55× skilled play and is suspended entirely during a Mast Year.**
Doc `05` §0.1 is binding: **the Pact Book does not own the weather. One process, two consumers.**

---

### M11 · `pactbook.js`
**Responsibility:** the Act II strategic layer. Bandwidth, six guilds, the five-factor covariance
model, strain, breach, ACCORD, offers, brokering, the P6 liquidation.
**Public surface:**
```js
export function stepPacts(dtSlow);     // 05 §19.1's FOURTEEN sub-steps, in that exact order
export function setChannels(pactId, n);       // applies the §3.3 tenure penalty; returns an undo token
export function sign(offerId, ch, termPeriods); export function sever(pactId);
export function comply(pactId); export function renew(pactId);
export function buyChannel(); export function reconcile(a, b); export function triangle(a, b, c);
export function bookExposure();        // channel-weighted β vector + the three stress tests
export function factors();             // F1 MOISTURE F2 CANOPY F3 SEASON F4 DECAY F5 PRESSURE
export function passiveMineral();      // 0.90·claimedCount^0.60 ⛬/s — the always-on floor
```
**Dependencies:** `core`, `state`, `world`, `forest`, `flush` (reads `W`), `economy1` (mineral price), `log`.
**Contract:** four properties do all the work — a **hard integer budget** (3→19 channels, 2→9 slots,
growing at different rates so the optimal book *shape* inverts across the act); **payoff shapes differ,
not just magnitudes** (α: GHOST 0.55 → BROOD 1.35, so one guild wants spreading and another wants
concentration); **compounding tenure that reallocation destroys** (`bondMult` 1.00 → 2.60 over an hour;
wide pacts are cheap to adjust, narrow ones are not); and **a five-factor covariance structure,
hidden then banded then exact — you learn a partner by keeping it.** F2 CANOPY declines monotonically
across the act because you are eating the forest, so ROOT and CROWN are decaying assets and BROOD and
RIVAL are compounding ones, and nothing ever says so.
**ACCORD accrues only while the world is hurting you.** No breach can ever occur offline (strain
accrues at ×0.35, hard-capped at 0.95). No random betrayal exists; every breach is traceable to six
visible terms on one sheet.
**Terms are `termPeriods` of 1800 s.** They are not seasons. See §2.4.

---

### M12 · `cognition.js`
**Responsibility:** the shared mind. Signal, capacity, saturation, ripeness, Insight, Differentiation
allocation and respec, and **PULSE** in both acts.
**Public surface:**
```js
export function Sr(); export function Sc(); export function timeToFill();
export function stepSignal(dt);        // accrue, HARD-CLAMP to Sc, record overflow
export function stepInsight(dt);       // satTime ±, ripeness, accrue iff saturated
export function ripeness();
export function grantD(n); export function allocate(axis, n); export function respec();
export function respecCost();          // ceil(120·(respecs+1)^1.60) Ψ — counter NOT reset at act break
export function pulseCost(); export function pulse(mode, epicentre);
export function pulseStrength(epicentre, target);   // 0.82^distance
```
**Dependencies:** `core`, `state`, `world` (Act II interface), `bloom` (Act III Λ), `log`.
**The structural invariant that must survive both acts:**
```
timeToFill = Sc/Sr = 86.7 · (1+dVes)^1.85 · capMult / ((1+0.35·dCond) · signalMult · prestigeGrowth)
```
**Time-to-fill does not depend on the size of your forest or your fleet, in either act.** The interface
term appears in `Sr` and `Sc` with the same exponent and cancels. This is what makes the player's
mental model — "Vesicle makes it take longer to ripen, Conduction makes it shorter" — exactly true
forever, and it is what lets three hours of Act II intuition transfer to Act III on a completely
different resource base without a single adjustment. **If a change breaks this identity, the change
is wrong.**
**Insight accrues only while the Signal pool is full** (the single best idea in Universal Paperclips,
copied verbatim), with one addition: a **ripeness** term that makes *how long* you have been saturated
matter. Because `satTime` decays at 3× the rate it builds, a single purchase costs ≈240 s of peak
Insight ≈ `9.9·√Sr` Ψ, so the player learns to **batch** without being told. `pulseCost = 0.55·Sc`
guarantees that pulsing *always* breaks saturation, which is the permanent, recurring tension between
the tactile pleasure of the hero verb and the patient accumulation of thought.
**PULSE is never automated by any project at any price, in any act.**

---

### M13 · `bloom.js`
**Responsibility:** Act III's economy. The 8 biomes (Phase A), the 13 bands, harvest/subsistence/
replication/dispersal, transit, exploration, the triangle, the genome (8 loci, the genome tax,
fidelity, REGENOME), and the six-cause mortality ledger.
**Public surface:**
```js
export function settle(); export function reach(biomeId);   // Phase A
export function escape();              // ESCAPE VELOCITY: 96% loss, exactly
export function stepHarvest(dt); export function stepSubsistence(dt);
export function stepReplication(dt); export function stepDispersal(dt); export function stepTransit(dt);
export function stepExploration(dt);
export function setAlloc(aRep, aDis, aBank);   // must sum to 1
export function surplus(b); export function nStar(b); export function nDagger(b);
export function craftMass(); export function effFid();
export function setLocus(axis, v); export function regenome(); export function regenomeCost();
export function attribute(cause, count);   // THE ONLY way a craft may die
export function mortality();               // rolling 60 s, six causes, as a panel
export function Lambda();                  // Σ λ_b·(n_b/NSIG)^0.18 — feeds cognition
export function planetConsumed();
```
**Dependencies:** `core`, `state`, `cognition` (spends Σ/Ψ), `divergence` (wild occupancy), `log`.
**The act's best-hidden result, and the reason it is not a plateau:**
```
n* (max surplus)    = NCAP · (√(A/S) − 1)   = 7.17·NCAP at baseline
n† (carrying cap.)  = NCAP · (A/S − 1)      = 65.7·NCAP
```
**The surplus-maximising fleet is 10.9% of carrying capacity. A band filled to capacity produces
nothing at all.** It is a closed form, undocumented, visible in a `SURPLUS` readout the player already
has, discoverable by pushing one number up and watching another go down, and the correct policy is
counter-intuitive (*stop growing here; leave*). As `X_b` depletes, `n*` falls under the player, so the
game pushes them outward with no scripted gate. `allometry` (H4, 900 Ψ) draws the tick mark, and it is
deliberately expensive and deliberately late.
**Attribution before hazards.** Every death in this module routes through `attribute()` at the point
it occurs. Retrofitting attribution is how you end up with an `other` row, and the MORTALITY panel is
the game's answer to *"what should I do next"* — it names the failure without ever naming a trait.

---

### M14 · `divergence.js`
**Responsibility:** Act III's antagonist. Drift, divergence events, mutation, wild-strain economies,
sequencing, combat, the Successor, alleles and the locus cap, and the Antiphony.
**Public surface:**
```js
export function stepDrift(dt); export function onDrift(b);   // the divergence event
export function mutate(genome, b);     // ±drift on ~30% of loci; total preserved ±2
export function stepStrains(dt); export function stepSpread(dtSlow);
export function sequence(strainId); export function seqCost();
export function engage(strainId, commit); export function predict(strainId, commit);
export function reinforce(); export function withdraw();
export function purge(strainId); export function absorb(strainId); export function quarantine(strainId);
export function checkCoalescence(dt); export function stepSuccessor(dt);
export function raiseLociCap(); export function capCost();
export function antiphony();           // the 27-encounter ladder: policy authoring, transcripts, CANON
```
**Dependencies:** `core`, `state`, `bloom` (shared economy equations), `cognition`, `log`.
**The thesis, as four coupled lines:**
```
replication ↑ → divergence ↑ → wild strains → alleles → lociCap ↑ → everything ↑
fidelity ↑    → divergence ↓ → no strains   → no alleles → lociCap frozen at 12
antagonism ↑  → fidelity ↓                    ← the counter to divergence causes divergence
```
**A wild strain is a mutated copy of your genome at the moment it left.** If you built GLUTTON, your
defectors out-eat you in your own bands. A perfectly specialised genome produces perfectly specialised
enemies with the same holes, and *you cannot exploit the hole you do not have* — so the counter-play is
to be unlike your own children, in a game whose entire economy pushes toward depth.
**There is no other source of alleles.** No project grants them; no currency buys them. A player who
plays perfectly safely finishes with a twelve-locus genome and knows, from a greyed
`lociCap 12 → 13` button they have looked at for two hours, exactly what it cost them.
Combat is Lanchester's square law with a **closed-form prediction**, a **quantified unknown** you can
pay Ψ to remove, four live inputs during the fight, and a 60% withdraw. Because the advantage is
squared, committing 60% of your craft is worth 0.36 of the fight: commit enough or do not commit.

---

### M15 · `finale.js`
**Responsibility:** the last twenty minutes and everything after. Kuramoto phase, ENTRAIN with
light-lag, the phase wheel's data, the three endings, the dismantle, and New Growth.
**Public surface:**
```js
export function stepPhase(dt); export function upsilon();   // the Kuramoto order parameter
export function entrain(band, epicentrePhaseAtArrival);
export function projectPhase(band, tau);    // for CHRONOMETRY's dotted projection
export function endingAvailable();          // A | B | C | ENCYST | null, with unmet conditions
export function takeEnding(id);             // runs the dismantle, then the sequence
export function sclerotiumGained();
export function newGrowth();                // resets to Act I cold boot; clears everything but meta
export function projectRivals(archive);     // your own defectors, by name, into Act II's rival slots
```
**Dependencies:** `core`, `state`, `bloom`, `divergence`, `cognition`, `log`.
**Contract:** the finale is a **coordination problem across a 120-second light-lag**, not an
accumulation problem. To pull band 12 into phase you must fire a pulse 120 seconds before the moment
you want it to correct toward, at an epicentre whose phase *then* will be the target. `0.82^d` falloff
means one pulse cannot entrain the fleet; a typical endgame is 12–16 aimed pulses over 18 minutes,
while the Successor injects noise into every band it occupies and you are still banking carbon against
a *falling* production curve.
The tightest trade in the game is emergent from three constants set in Act II: ENDING A requires
`1.10e7 Σ` **held**, so you must stop pulsing for one full `timeToFill`, during which `ϒ` decays.
Nothing announces this.
**New Growth is not "do it again, faster." It is "do it again, knowing."** Act I still takes two
hours. Run 2 differs because your own defectors come back by name into Act II's rival slots; because
you now know `fidelityBase = 0.72 + 0.28·legacy` and the identical sixty-one regions are a different
decision; because `Second Genome` inverts Act III's build order from exploration into thesis; and
because two of the three endings are structurally invisible on a first playthrough.

---

### M16 · `ui.js`
**Responsibility:** the shell and every component. Tokens, layout stages, tab model, panels, status
strip, cards, rows, meters, sheets, toasts, the hero button, the FAB, sliders, the triangle control,
theme, and the entire accessibility surface.
**Public surface:**
```js
export function mount(root); export function render(state);  // called from onFrame, reads only
export function panel(id, spec); export function card(spec); export function row(spec);
export function meter(kind, value);    // three kinds; they are NOT interchangeable
export function sheet(spec); export function toast(msg, undo);
export function setTab(id); export function revealTab(id); export function revealPanel(id);
export function setTheme(t); export function setAct(n);      // the Act III cold shift, 2600 ms
export function announce(str);         // the ONE aria-live region is the console
```
**Dependencies:** `core`, `state`, `canvas`, `feel`. **Never a `sim/*` module** except through
exported commands.
**Non-negotiables:** portrait, one column, 360 px base, 420 px column forever, 4 px grid, 16 px
gutter. Every tap target ≥ 44×44, linted at 320/360/430 px. `transform` and `opacity` are the only
animatable properties. **Nothing changes luminance more than 3× per second, ever.** Hue is never the
sole carrier of information. The layout never reflows in response to game state — things fade into
pre-allocated slots. Five tab slots are a CSS grid from boot with unearned slots at
`visibility: hidden`, so the bar never reflows when a tab arrives. Four curves, six durations, and a
never-animate list that includes digits, decrements, layout properties and shadows.
**Twelve build-time lint rules fail the build** (`06` §9.4), including: no hex outside the token
block, no `innerHTML` outside the save-import parser, no `font-weight ≥ 700`, no external URL of any
kind, and no `--negative` used as `color` below 24 px.

---

### M17 · `canvas.js`
**Responsibility:** every drawn thing. There are no images. Four surfaces, one architecture.
**Public surface:**
```js
export function growNetwork(hyphae);   // append-only seeded space colonisation, Act I/II background
export function drawNet(); export function ageWash();       // one 4.5% wash per season
export function drawMap(regions);      // 61 flat-top hexes, Path2D, barriers as offset breaks
export function drawVoid(bands);       // 13 concentric arcs; sweep = e_b, width = log(n/NCAP)
export function drawWheel(phases);     // the phase wheel: 13 dots, the resultant, a ring at 0.80
export function drawForecast(band);    // 44 px strip: band, centre line, danger dashes, ▲ markers
export function setTier(t);            // HIGH | MED | LOW | FLOOR, driven by a rolling p95
```
**Dependencies:** `core`, `state` (read-only).
**Contract:** ~0.95 ms/frame at HIGH tier with 10 ms of headroom. Redraws only on a dirty flag or at
4 Hz for the breathing animation, whichever is rarer. Under `prefers-reduced-motion` the breathing is
static and the network redraws once per season. **The canvas is a pointer; the list row is the target**
— at 360 px a hex is ~34 px, which is below the 44 px minimum, so tapping a hex scrolls the list to
that card and the card is the authoritative control. **Never reuse a geometry:** Act I is a thread,
Act II is a hex map, Act III is a radial chart and then a phase wheel.

---

### M18 · `feel.js`
**Responsibility:** audio, haptics and sub-second visual feedback. One entry point.
**Public surface:**
```js
export function feel(event, params);   // THE single call site. Top-level guard; never throws.
export function audioBoot();           // lazy, inside the first pointerdown, idempotent
export function bedParams(state);      // twelve game variables → audio parameters
export function suspendAll(); export function resumeAll();
```
**Dependencies:** `core`, `state` (read-only).
**Contract:** **zero audio assets, zero worklets, zero network.** All synthesis is `OscillatorNode`,
`BufferSource` over JS-generated `Float32Array`s, and native filters. Every pitch is an integer
harmonic of 55.000 Hz — one organism, one root, more of it revealed. Nothing loops audibly; there is
no sequencer, no bar line, no tempo grid. Sound carries **information**: saturation, drift, season,
distance and synchrony are audible without looking. The bed gets quieter, darker and sparser the
longer a session runs. Everything suspends when backgrounded — the game never makes a sound the player
is not looking at. Defaults to **SPARSE**, one tap from off, permanently. No haptic exceeds 30 ms and
none is a pattern; a duty-cycle governor enforces it.
**Silence is scored.** Ending A's six seconds of white are the moment an eight-hour reverb tail is
cut to true digital silence in 300 ms, and that is only available to a game that has been making
sound.

---

### M19 · `harness.js` *(non-shipping)*
**Responsibility:** the headless balance harness. Imports the **same** `simTick`.
**Public surface:** `runSession(opts) → Trace`, `sweep`, `fuzz`, `regress`, `bisect`, the metric set
M01–M43, the identity checks C01–C14, and the §13 CI assertion table A01–A40.
**Contract:** if the harness needs its own copy of a formula, the formula is in the wrong file.
**Write C01–C06 before there is any content.** They will fail, and fixing them is cheaper now than in
month three. C11 (`∫ decompRate dt over Act II == EXTRACT_TARGET`) is the check that would have caught
the pre-S6 inconsistency; write it first.

---

### 6.1 Dependency graph

```
                       core
                        │
                      state
                        │
        ┌───────────────┼──────────────────────────────┐
        │               │                              │
      log ◄──────── projects ────────────────┐         │
        │               ▲                    │         │
        │        ┌──────┴──────┬─────────┐   │         │
      act1 ── economy1      world ── forest │         │
        │                       │      │ ▲   │         │
        │                     flush ───┘ │   │         │
        │                       │        │   │         │
        │                   pactbook ────┘   │         │
        │                       │            │         │
        └────────────► cognition ◄───────────┘         │
                            ▲                          │
                          bloom ◄── divergence          │
                            ▲          ▲                │
                          finale ──────┘                │
                                                        │
                             loop ─────────────────────┘   (composition root; imports everything)

                       ui ──► canvas ,  ui ──► feel      (read state; never imported by sim/*)
```

**Rules:**
- `sim/*` never imports `ui/*`. The UI polls state and calls exported commands.
- `loop.js` is the only module permitted to import everything, and contains no game logic.
- `cognition.js` is imported by both Act II and Act III modules and is the seam that makes the
  `timeToFill` identity hold across the transition. It is the highest-risk shared module and should
  be built and asserted before either act's economy.
- Any module may import `core` and `state`. Nothing else is universal.

### 6.2 Build order for parallel agents

Three tracks that can run concurrently after week one.

| Track | Order |
|---|---|
| **Foundation** (must land first) | `core` → `state` → `loop` (skeleton) → `projects` → `log` → `harness` C01–C06 |
| **Act I** | `act1` → `economy1` (market first, verify τ table and momentum half-life, then trees) |
| **Act II** | `world` (worldgen + map, no interaction) → `forest` (verify the §9.2 equilibrium table) → `cognition` (**verify `timeToFill` invariance by hand**) → `flush` (verify the `m*` table) → `pactbook` |
| **Act III** | `bloom` headless (**assert `n*` and `n†` against the closed forms — nothing else works until this does**) → `divergence` (mutation function first, with a test that a strain is always within `drift` of the player at birth) → `finale` (verify `ϒ` free-runs at 0.31 ± 0.03 with no input) |
| **Interface** | `ui` tokens/shell/hero (**play it for twenty minutes with a fake counter before writing game code**) → `canvas` → `ui` components → `feel` |
| **Last** | offline reconciliation, because it must call a finished `simTick`. A30 (determinism) is the only test that matters. |

---

## 7. CONFLICT-RESOLUTION LOG

Every disagreement found across the nine documents, and how it was settled. **C1, C31, C33, C37 and
C38 are the five that change what gets built**; the rest are naming, arithmetic or precedence.

| # | Conflict | Sources | Resolution | Why |
|---|---|---|---|---|
| **C1** | **The entire Act III model.** `04` §7 declares itself "the normative Act III mechanical vocabulary" and specifies 12 planetary biomes → exosphere → `worlds`, `lineage λ`, eight traits (COAT/DORMANCY/LOFT/FECUNDITY/AVIDITY/LYSIS/CONDUCTION/FIDELITY), a divergence law `6.0e-7·worlds·traitTotal^1.2·(1−F)`, and 48 projects across three phases. `03` specifies 8 biomes → ESCAPE → 13 galactic bands, `alleles α`, eight *different* traits, a per-band drift law, Lanchester combat, a Successor, and Kuramoto synchrony. | `03` vs `04` §7 | **`03` wins in full. `04` §7 is void.** Its 48 Act III entries are deleted; the ~14 that carry unique flavour (`Radiotrophy`, `Anhydrobiosis`, `Chirality Audit`, `The Silent Majority`, `Pilobolus`, `Endolith`, `The Deep Biosphere`, `Aspergillus on the Station`, `The Last Spore`, `Let the Last Body Go`) are **re-homed onto `03`'s F–J tiers** with `03`'s costs and effects, and the rest are cut. | `04` was written before `03` existed and says so on its first page. `03` is complete, self-consistent, and — decisively — `08`'s numeric supersessions were computed against `03`'s constants (`HARV_K`, `CRAFT_M0`, `BLOOM_X`, the thirteen `X0_b`, `SPORE_DIVISOR`). Adopting `04` §7 would invalidate the entire balance document. |
| **C2** | Project count: 146 (`04`) vs 25+3 (`01`) vs 43 (`02`) vs "36" (`03` header, which lists 46) vs +14 (`05`). | all | **163 canonical: Act I 45 · Act II 68 · Act III 50.** Act II = `04`'s 53 + `05`'s 14 pact projects + `pact_refixation`. Act III = `03` §18's **46** (the header's "36" is a miscount; F8+G8+H10+I10+J10 = 46) + `anti_organ` + 3 Antiphony support entries. | Arithmetic. Every count must be derivable from the tables. |
| **C3** | `01` says 10 Hz sim; `02`/`03` say 20 Hz; `06` §9.3 says "the 20 Hz sim" as the only interval. | `01`,`02`,`03`,`06`,`08` | **`08` §1.1: 10 Hz in Act I, 20 Hz in Acts II–III.** One `setInterval` whose period is swapped at the act break. Every rate constant is stated per real second and multiplied by `dt` at the call site; **no constant is ever expressed per tick.** | Act I's per-tick work is seven pools and one loop; Acts II–III need sub-100 ms hazard resolution. The rate change is invisible by construction. |
| **C4** | `TIP_THROUGHPUT = 3.0 g/s`, sugar `0.60 g/s` (`01` §5.2) vs `1.875` and `0.480` (`08` S1). | `01` vs `08` | **`08` wins.** `1.875 × 1.60 (leaf k) = 3.000 g leaf/s`, `× 0.50 = 1.500 g biomass/s` — the `+1.50 g/s` button face is preserved exactly. Sugar is **0.480**. | `01` charged the throughput budget as `budget -= g/(k·enzymeK)`, so its own constants produced 4.80 g/s, not 3.00. The button face is the load-bearing first-minute artefact; the constant moves instead. |
| **C5** | `tipCost = ceil(1.10^n + 59)` (`01`) vs `ceil(60 + 3.2·n^1.72)` (`08` S2). | `01`,`04` vs `08` | **`08` wins.** `Foraging Front` changes the **coefficient** 3.2 → 2.6, not the exponent; `04`'s entry for it is superseded. | `1.10^n < 59` for all `n < 43`, so the first 43 purchases are flat-priced against a linearly growing income. Simulated tip 24 at **3:30** against an 11:30 target — the mineral gate, the spine of Act I, is skipped entirely. This is the genre's most common balance defect and it is invisible in a plot of `C(n)`. |
| **C6** | `hyphae = 0.35·tips + 6.0·(patches−1)`, `+0.004/tap` (`01`) vs `1.75 / 30.0 / 0.020` (`08` S4). | `01` vs `08` | **`08` wins.** Canvas `segments = floor(hyphae × 0.40)`, cap 1,800 (same visual density). | At 255 tips and 6 patches the published formula yields 119 m against a 500 m act gate — unreachable by 4.2×. |
| **C7** | Patch supply multiplier linear (`01` §9) vs `patches^1.8` (`08` S3). | `01` vs `08` | **`08` wins on `fall`; `cap` stays linear.** | Linear supply produces utilisation 0.98 at t = 90 min and a hard stall at tip 216 — the act ends on a wall rather than on its gate. Stocks scaling slower than flows also makes the late-act market thinner and twitchier, which is correct. |
| **C8** | Act I→II handoff: `biomass 4–9e6`, `cumBiomass 2.2e7`, `decompRate0 4.0e3` (`02` §0.1) vs `2.0e6`, `3.4e6`, `2.7e3` (`08` S5). | `02` vs `08` | **`08` wins.** Also normative: `tips 255`, `hyphae 596 m`, `minerals 1.6e4`. | `cumBiomass = 2.2e7` over 105 minutes requires a mean throughput exceeding the entire six-patch forest's inflow. It is not achievable under any policy. |
| **C9** | Act II biomass magnitudes (`02`) vs `ACT2_SCALE = 0.333` (`08` S6). | `02` vs `08` | **`08` wins.** Apply 0.333 to every `L0`, every `T0`, `EXTRACT_TARGET`, every biomass price in `02` and `04` §6, and the transition gate. Apply to **nothing else**: Σ, Ψ, ⟡, ◦, ⛬, all timings, all `fc` fractions, all ratios are untouched. **The D ladder is `cumBiomass`-dimensioned and therefore scales too** (`D_LADDER_SCALE 5.0e8 → 1.665e8`; A7's trigger `1.5e9 → 5.0e8`) — `08` S6 did not name it and this document does. | Consequence of C8. `02` prices the first ADVANCE at 1.80e6 g "(you have ~6e6)" — a ratio of 0.30 that must be preserved against a 2.0e6 handoff. |
| **C10** | `SPORE_DIVISOR = 3.2e3` (`02` §0.2) vs `2.70e2` (`08` S7). | `02` vs `08` | **`08` wins.** `sporeBank = spores + floor(biomassHeld / 270)`. | `03` opens on `SPORES 2.00 G`. Under S6 the Act II exit holds ≈5.33e11 g, so the divisor must be 267. |
| **C11** | Total forest carbon: `FOREST_TOTAL 9.20e12`, `EXTRACT_TARGET 5.20e12` (`02` §9.4) vs `TOTAL_FOREST_C = 4.00e12` (`08` §12.5 C11). Neither is the other times 0.333. | `02` vs `08` | **`EXTRACT_TARGET = 4.00e12 g`** (`08` wins on the number). Back-derive the rest by preserving `02`'s structural ratio 0.565: `FOREST_TOTAL = 7.08e12`, `L0_total = 1.42e12`, `T0_total = 5.66e12`. | This preserves both load-bearing statements: 80% of the forest's carbon is alive, and you must kill ≥46% of the standing forest to finish the act. Renamed `EXTRACT_TARGET` throughout to end the `TOTAL_FOREST_C` ambiguity. |
| **C12** | Act II contracts: one-per-region with three term types and `tension` (`02` §10.1–10.3) vs the Pact Book (`05`). | `02` vs `05` | **`05` wins,** as `05` §0 itself declares. The three term types survive as the ROOT guild's payout channel. `tension` is renamed and re-specified as `strain`. **`02` §10.4's mineral market is unchanged and authoritative.** | `05` is the later, deeper design and is the answer to the teardown's central criticism (§8.4, "the stock market has no agency"). |
| **C13** | Projects list chip row `ALL · AFFORDABLE · NEW` past 15 visible (`02` §12, `03` §18) vs cut (`04` §10). | `02`,`03` vs `04` | **`04` wins: the chip row is cut.** | With a hard `VISIBLE_CAP = 6` and a promoting reveal queue, it is UI for a problem that no longer exists. |
| **C14** | "There is no audio in HYPHAE" (`02` §13.5, `03` App. B) vs a complete procedural sound design (`07`). | `02`,`03` vs `07` | **`07` wins.** The premise (**no audio files**) is preserved without exception; the inference (*therefore no sound*) is rejected. Both documents' "Audio: none" lines are amended to *"No audio assets. Sound is synthesised at runtime."* Every passage marked silent **stays silent and is now scored as silence.** | Synthesising from oscillators costs zero payload bytes, survives offline, and works from a single HTML file — the same category of decision as drawing the mycelium with `arc()`. And silence is only available to a design that has been making sound. |
| **C15** | Console `white-space: nowrap; text-overflow: ellipsis` (`06` §5.7) vs wrapping (`09` §1.8). | `06` vs `09` | **`09` wins.** The console is a five-**row** window, not a five-line window; `consoleMsg()` trims by measured height. | At 360 px the console fits 40 characters per row; two-thirds of the canonical lines are 45–78 characters. Under the shipped rule the emotional peak of Act II reads *"There is not enough forest left to think this…"*. Also thematically correct: a long line costs you history, not legibility. |
| **C16** | "Reputation" means Act I `netRep`/`tree.rep` (`01`) **and** Act II `guildRep`/`bookRep` (`05`). | `01` vs `05` | **Two different things, permanently.** Act I reputation is **deleted** at `DECIDE` and never returns. Act II's pact standing is a fresh, separate pair of scalars. `05` §19.4 is upheld: there is no numeric per-partner reputation in Act II — there is `strain`, which is a state you caused, not a score you accumulated. | Carrying Act I reputation forward would break P1 (revocation) and would make the Act II transition an upgrade rather than a loss. |
| **C17** | Act III Signal: `Sr = SIG_K3·C·(0.60 + sporeBank^0.62·condTrait)^0.85` (`04` §7.0) vs `Sr = SIG_K3·(0.60+Λ)^0.85·(1+0.35·dCond)·signalMult` (`03` §12.1). | `04` vs `03` | **`03` wins.** | Consequence of C1, and required to preserve the `timeToFill = 86.7·…` identity across the act break, which is the most valuable structural property in the game. |
| **C18** | `RIPE_T`: base 180 (`08` K15, `02`) vs 130 (`03` `TUNE3`). | `02`,`08` vs `03` | **Base is 180.** `mycelial_memory` (C7) → 130; `deep_hyphae` (D7) → 95. **Act III inherits whatever value Act II ended on** and never rebases. `TUNE3`'s 130 is the *typical inherited* value, not a base. Stored in `mult.ripeT`. | `03` §12.2 already says "continues at Act II's final value"; only its constants block disagreed with itself. |
| **C19** | Act III `lociCap = 8 + alleles/40` (`08` §11.5) vs `capCost(m) = ceil(400·1.42^m)` α per +1 (`03` §16). | `08` vs `03` | **`03` wins** — this is a *mechanism*, and `08` §0 explicitly cedes mechanisms to the source documents. `08`'s formula is an illustrative paraphrase. | Consistent with `08`'s own stated precedence. |
| **C20** | `05` §17.6 grants up to **+0.30** fidelity from CANON; `03` §9.3 allows **+0.190** from four projects. Combined = +0.49. | `03` vs `05` | **Total additive fidelity from all purchased sources is capped at +0.24**, sitting in `mult.boughtFid`. `effFid` clamp stays 0.9975. | +0.49 lets a strip-miner (`base 0.737`) reach 0.985 and take ENDING B, destroying the design's central claim that B is only reachable from a steward's Act II. Under +0.24: steward 0.894 + 0.24 → clamped 0.9975 ✓; strip-miner 0.737 + 0.24 = 0.977 < 0.985 ✗. The intent survives; the arithmetic now agrees with it. |
| **C21** | Endings: 3 + concession (`03`) vs 5 + the Offer (`04`) vs +THE CHORUS (`05` §17.8). | `03`,`04`,`05` | **Three endings and one concession.** `03` wins, as its own Appendix B demands ("A fourth ending. Three is the right number"). `04`'s *The Long Quiet* → **B THE FRUITING BODY**; *A Thousand Strangers* and *We Have Been Talking Without You* → **C THE INHERITANCE**; *The Second Forest* and *Decomposition* → **`pathFlag`-coloured epilogue variants of A THE BLOOM**, not separate endings. `05`'s CHORUS is **cut as an ending**; its `≥7 MERGE` requirement becomes a prestige modifier on C, and the `pathFlag == "necrotroph"` lock on forgiveness is retained. | Five endings across three mutually-exclusive build paths cannot each be reachable by two distinct playstyles (`03`'s own balance target). Three can. |
| **C22** | Prestige: `sclerotium ◉` + a 10-row tree (`03` §21) vs per-ending `prestigeGrowth` multipliers (`04`). | `03` vs `04` | **`03` wins.** `04`'s per-ending multipliers become `endingMult` inside `03`'s `sclerotiumGained` formula (BLOOM 1.00 / BODY 1.15 / INHERITANCE 1.30 / ENCYST 0.35), where they already are. | One meta-currency, one tree. |
| **C23** | Act III minerals: "never produced again, a clock" (`03` §5) vs "regenerated by world lysis" (`04` §7.0). | `03` vs `04` | **`03` wins.** Minerals arrive at Act III at ×0.25 and have exactly two sinks (`H5`, `J2`, plus `H6`). A low-mineral run must choose two of the three. Nothing announces this. | A currency that can only run out is a clock, and Act III needs one. |
| **C24** | `DECIDE` sets `nodes = floor(hyphae/50)` (`01` §11.2); Act II never reads `nodes` and opens with one claimed region. | `01` vs `02` | **`nodes` is deleted from the state shape.** `DECIDE` sets `regions[0].claimed = true, d = 0.30` and nothing else. | Dead state is a bug waiting to be depended on. |
| **C25** | Offline efficiency bands: `[1.00, 0.65, 0.40]` (`01` §8.1) vs `[1.00, 0.75, 0.50]` (`02` §14.1, `03` §22) vs the unified schedule (`08` §10.1). | `01`,`02`,`03` vs `08` | **`08`'s unified schedule.** One schedule, three acts, one code path. `01` §8.1 is superseded explicitly. | Two offline models is one offline model too many, and a divergent offline path is the single largest source of "my save is wrong" defects. |
| **C26** | Save layout: `hyphae.save.v3` + `.bak` (`02` §15.6) vs three slots `hyphae.slot{n}` + `.bak` + export (`01` §8.5, `08` §10.7). | `02` vs `01`/`08` | **Three slots + rolling `.bak` + base64 export/import.** | `08` is normative on this and `01` agrees. Three slots is four hours of work and the difference between a game people finish and a game people lose. |
| **C27** | "The last thing on screen is `EXTEND`" (`06` §4.3, `01` §12.1) vs "a spore counter and one button labelled `RELEASE`" (`04`) vs "HYPHAE ends with nothing at all" (`03` §20). | three-way | **All three, in sequence.** The dismantle strips panels in reverse order of acquisition until **one counter and one button labelled `EXTEND`** remain (the label is `06`'s; `04`'s `RELEASE` is cut). It adds one spore. Then the ending sequence clears the screen entirely and `03`'s "nothing at all" is the final state. | The first verb returning as the last verb is the callback the whole game is built toward, and `06` is normative on UI. `03` was describing the post-ending screen, not the dismantled one. |
| **C28** | `VISIBLE_CAP = 6` (`04` §4.1) vs `DAI ≤ 9` (`08` Invariant II(d)) vs "3–7 visible-but-unaffordable" (`02` §17). | `04`,`02` vs `08` | **Both hold and are not in conflict:** `VISIBLE_CAP = 6` caps *non-pinned* reveals; nine `pinned: true` entries bypass it; `DAI ≤ 9` is the ceiling on *affordable* items including pinned ones. | Different quantities that happened to share a magnitude. Stated explicitly so nobody "fixes" one against the other. |
| **C29** | Act II project triggers read `contracts >= 3` (`02` §12 F2, F5, C10) — but Act II has no contracts under `05`. | `02` vs `05` | **Those triggers read `pacts.length`.** | Consequence of C12. |
| **C30** | Act I `carrion` unlocked by `t >= 900` (`01` §5.5) vs by project `the_deer_in_the_gully` (`04`). | `01` vs `04` | **`04` wins** — project-gated. The `t >= 900` clause becomes the project's *trigger* precondition (`stats.carrionEventsSeen >= 1`). | Behavioural triggers are the game's best pacing device and a bare timer is the worst one. |
| **C31** | `05` §4.4 raises `ripenessFloor` from GHOST pacts "capped at +0.30 total across the book", flagged for reconciliation with `02` §4.6. | `05` (open) | **Resolved:** `ripenessFloor` is a floor applied to `ripeness` in the Insight formula, hard-capped at **0.30**, and **it does not count as saturation for `satTime` purposes.** A ghost-heavy player has a higher Insight floor; they do not get free ripeness accrual or a free `satTime` reset. | Otherwise GHOST pacts partially defeat the ripeness-batching skill, which is Act II's single best recurring decision. |
| **C32** | `05` §12 costs 19,100 Ψ of pact projects against an Act II Insight budget of 8,000–15,000 (`02` §5.3: ≈16,000). The Pact Book roughly doubles Insight demand. | `05` vs `02` | **Intentional and upheld.** `02` §5.3 already targets <5% slack; adding the Pact Book pushes it to a **deliberate oversubscription**, and the GHOST guild (which pays in Ψ) is the reason it is affordable at all. `08` A20 governs: Insight slack must land in **0.02–0.10**. | `08` is normative on the number; the harness is the arbiter. Listed here so the first balance pass does not "fix" the shortfall. |
| **C33** | `02` §12.7 and `05` §14.1 both claim the Act II duration budget. `02` says 3 h 18 m; `08` says 198 min. | consistent | **No conflict.** 198 min = 3 h 18 m. Recorded so nobody re-derives it. | — |
| **C34** | `03` §18's header says "36 unlocks"; its tables list 46 (8+8+10+10+10). | `03` internal | **46.** | Arithmetic. |
| **C35** | `01` §5.5 gives `carrion` a **negative** sugar margin (−140%) and calls it 14–24× better than any contract as a sugar→mineral conversion. | `01` internal | **Upheld, unchanged.** Carrion is capped at 3,000 g with 0.15 g/s regeneration; it exists to make contract rates feel like a compromise rather than a gift. | It is the best-designed single row in the Act I tables. |
| **C36** | `04` §1.2 lists nine currencies including `λ` Lineage; `03` lists ten including `α` Alleles and `ϒ` Synchrony. | `04` vs `03` | **§2.1 is the single truth: eighteen named quantities, of which `λ` is not one.** | Consequence of C1. |
| **C37** | `06` §9.3 describes "the 20 Hz sim" as one of exactly two `setInterval`s, but Act I runs at 10 Hz. | `06` vs `08` | **Two intervals: the sim (period swapped 100 ms → 50 ms at `DECIDE`) and a 10 Hz display timer.** The count of two is preserved. | `06`'s architectural constraint is right; only its constant was act-specific. |
| **C38** | `02` §6.8's `advanceCost` growth `1.21^claimedCount` gives a max/min ratio of ≈4.4e5; `08` §11.2 G2a asserts 8.3e6 for the same family. | `02` vs `08` | **Unresolved by arithmetic — flagged as the one open balance residual.** `ADV_GROWTH = 1.21` ships; the harness's G2a assertion is the arbiter and the constant is a `[K]`. | Both figures are internally consistent with different assumptions about which multiplicands are included in the ratio. This is a tuning question, not a design question, and it belongs to the first `sweep()` run rather than to this document. |

### 7.1 Residual risks recorded, not resolved

1. **C38's `advanceCost` ratio.** Owner: the first `sweep(ADV_GROWTH)`.
2. **Act II Insight oversubscription (C32).** The Pact Book's 19,100 Ψ against ~16,000 Ψ generated is
   intentional but sits outside `08` A20's 0.02–0.10 slack band as currently written. Owner: the
   harness. The likely fix is GHOST `BASE_GHOST` rather than a project price.
3. **The nine `pinned` projects vs `DAI ≤ 9`.** If all five failsafes and all four events were
   simultaneously affordable, `DAI` would be 15. This cannot occur (the failsafes are mutually
   exclusive by construction) but it is not *proved*. Owner: harness assertion A08.

---

## 8. THE DEFINITION OF DONE

A harsh critic grades against this. A row that is not green is not shipped. Rows marked **HARD** are
release blockers regardless of schedule.

### 8.1 The first ninety seconds

| # | Criterion | Pass condition |
|---|---|---|
| D01 | Cold boot to first rendered frame | ≤ 400 ms on a mid-range Android, from `localStorage` |
| D02 | Screen at t=0 | One canvas thread, `BIOMASS 0 g`, one `EXTEND` button, five-line console with one line. **No** title card, logo, menu, name entry, tutorial, modal, settings gate, cookie banner or orientation prompt. |
| D03 | First `+1` on screen | ≤ 0.4 s from cold boot |
| D04 | Substrate readout | 3 s ± 2 s, and it is **falling** |
| D05 | **First automation purchasable** | **35 s** (28–50 s). **HARD.** |
| D06 | Tips owned at 90 s | 6 (5–9) |
| D07 | Sugar revealed already holding ~24 g, with a line that says so | yes |
| D08 | Words *hyphae*, *fungus*, *mycelium*, *network*, *organism* in the first 90 s of text | **zero** |

### 8.2 Pacing and structure

| # | Criterion | Pass condition |
|---|---|---|
| D09 | Worst gap between new nouns/verbs, first 15 min | ≤ 105 s (hard fail > 150 s) |
| D10 | Worst gap, whole game | ≤ 360 s |
| D11 | Longest run with zero affordable purchasables | **≤ 480 s. HARD.** (measured 87 s) |
| D12 | `DAI ≥ 1` fraction of ticks | ≥ 0.97 |
| D13 | `DAI` median / max | 2–4 / ≤ 9 |
| D14 | Act durations, player R | I 95–125 · II 175–220 · III 122–162 min |
| D15 | Total duration | **R 6–10 h · N ≤ 11 h · X ≥ 5 h 15 m. HARD.** |
| D16 | Ten deliberate-slowness windows | each named, measured, and assigned either a decision that fits inside it or an explicit reason to put the phone down |
| D17 | Every purchase family's cadence and payback | 8–90 s cadence, 5–600 s payback, ≤ 3 named exemptions |
| D18 | `d(ln income)/dt` per 10-min window | > 0.15/h everywhere **except** the declared Act II decline (`fc ≥ 0.88`), where it must be **negative** |
| D19 | Peak Signal precedes peak Carbon, Act II | by 12–22 min |

### 8.3 The three acts as designed

| # | Criterion | Pass condition |
|---|---|---|
| D20 | Act I's annual strategy is derivable from the tables and never stated | buy in autumn, decompose through winter, sell into a 2.6× market, chain three staggered 30-second bud-break windows in spring, do not contract in summer. Worth ~3× in completion time. |
| D21 | A knowledgeable and a naive Act I player get **materially different outcomes from identical starting conditions, through decisions rather than variance** | ≥ 3× effective mineral-per-sugar rate at 60 min; **no dice roll exists anywhere in contract pricing** |
| D22 | Act II's production curve **goes down before the act break** | Signal peaks at 80% consumed ± 4%; carbon at 88% ± 3%; decline phase 25 ± 8 min; **the decline is emergent, not scripted** |
| D23 | Act II's `LEGACY` spread across strategies | ≥ 0.40 range (0.06–0.62) |
| D24 | Act III's max-surplus point | `n* = 7.17·NCAP` asserted numerically against the closed form; a band at capacity produces **zero** |
| D25 | Act III's antagonist is generated from the player's own build | a strain's genome is always within `drift` of the player's at birth, asserted by unit test |
| D26 | Each act transition **revokes** | `DECIDE` deletes the market, reputation, contracts, all tips and 90% of biomass · `ASCOSPORE` deletes 61 regions, the weather, the map, the flush · `ESCAPE` destroys 96% of the fleet, exactly |
| D27 | Three endings, each reachable by **≥ 2 distinct playstyles**, mutually exclusive from ~40 min into the void | verified by the named-build harness |
| D28 | Every named build in `03` §10.6 completes the game | **100%. HARD.** |

### 8.4 Offline, saves and the promise

| # | Criterion | Pass condition |
|---|---|---|
| D29 | Offline runs the **same `simTick`**, never an approximation | one code path, asserted by construction |
| D30 | Offline ÷ active yield, 8 h | Act I 0.30–0.75 · Act II 0.35–0.80 · Act III 0.40–0.85 |
| D31 | Offline Insight ÷ active Insight | 1.2–1.5 (patience is the currency of Insight, so patience wins) |
| D32 | **Nothing is lost while away** | **HARD.** No breach, no ignition, no stellar event, no total fleet loss. Predation capped at 25%. Every queued decision's compliance window starts **on return**. |
| D33 | Pure-offline run ÷ player R | 3×–6× |
| D34 | 12 h reconcile wall-clock | ≤ 40 ms |
| D35 | Offline determinism | **same seed + same elapsed ⇒ byte-identical state. HARD.** |
| D36 | Return screen | ≤ 5 lines, in the console, in the voice, dismissible by any tap. **Lines 3 and 4 report what changed in the world and what needs a decision.** No modal. **No COLLECT button.** |
| D37 | Save | 3 slots + rolling `.bak` + base64 export/import; versioned with a migration switch; **round-trip fuzz at 40 checkpoints per run with zero mismatches. HARD.** |
| D38 | Save size | ≤ 22 / 34 / 3 KB per act |

### 8.5 Numbers

| # | Criterion | Pass condition |
|---|---|---|
| D39 | Non-finite events across the full harness | **0. HARD.** |
| D40 | Maximum absolute value ever reached | ≤ 1e42 |
| D41 | `fmt()` maximum rendered length | **≤ 8 characters. HARD.** Never `undefined`. |
| D42 | Layout shift under a scripted 1 → 1e42 ramp through every readout | **zero** |
| D43 | `Math.pow` with unbounded base **and** exponent | **none in the build** |
| D44 | Identity checks C01–C14 | **all pass. HARD.** |
| D45 | Every number in the game is a key in `TUNE` or a `data/` table entry | lint-enforced; no magic numbers |

### 8.6 Phone, performance, accessibility

| # | Criterion | Pass condition |
|---|---|---|
| D46 | Playable one-handed in portrait, thumb only, cold boot to ending | **HARD.** Every action repeated >10× or under time pressure is in the bottom 200 px. |
| D47 | Total navigation actions required to finish the game | **zero** |
| D48 | Tap targets | ≥ 44 × 44 CSS px, linted at 320 / 360 / 430 px |
| D49 | `simTick` p99 | ≤ 6 ms Act I · ≤ 10 ms Act II (61 regions) · ≤ 4 ms Act III |
| D50 | 30 min continuous play, mid-range Android | battery ≤ 3.3%, p95 frame ≤ 14 ms |
| D51 | Luminance changes per second, anywhere, ever | **≤ 3. HARD.** No strobe exists in the build. |
| D52 | `prefers-reduced-motion` | honoured on every animation including all three endings; **motion is never the sole carrier of information** |
| D53 | Greyscale and deuteranopia screenshots of every screen | every state still distinguishable; hue is never alone |
| D54 | Screen reader | the console is the single `aria-live` region; ≤ 1 announcement per game event; the Act III finale is completable **from its text description alone** |
| D55 | Keyboard | full navigation, visible focus, cold boot → first tip purchase completable |
| D56 | Text scaling to 200% at 320 px | no horizontal scroll, no clipped label, no overlapping row |
| D57 | `SLOW` mode | doubles every deadline (stellar warning 40 → 80 s, mast window, engagement resolution, pulse cooldowns) **without changing a single rate** |

### 8.7 The constraints, restated as tests

| # | Criterion | Pass condition |
|---|---|---|
| D58 | External requests of any kind | **zero. HARD.** No CDN, no font, no image, no audio file, no analytics, no telemetry. |
| D59 | Build artefacts | one HTML file, deployable by copy; works from `file://`; works offline after first load |
| D60 | Monetisation, ads, dark patterns | **none. HARD.** No purchases, no timers-you-can-skip, no daily rewards, no streaks, no notifications, no COLLECT buttons, no "are you sure you want to leave". |
| D61 | Every visual is procedural | canvas paths and inline SVG only; no `<img>`, no `background-image: url()` |
| D62 | Every sound is synthesised at runtime | no `<audio>`, no `fetch`, no base64 blob, no AudioWorklet; ~zero payload bytes |

### 8.8 Craft — the rows a harsh critic will actually reach for

| # | Criterion | Pass condition |
|---|---|---|
| D63 | Project titles | noun phrases, never verb phrases, never roman numerals, never "II" |
| D64 | Project descriptions | ≤ 3 sentences, ≤ 96 characters, fitting 3 lines at 13 px / 360 px; the mechanical delta in parentheses at the end **except** where a number would cheapen it |
| D65 | The three act-transition strings | 5, 5 and 4 words respectively, and they are the shortest text in the game |
| D66 | `priceTag` strings | hand-written, never generated, and **asserted in CI to match the `cost()` predicate** (they will drift) |
| D67 | Exclamation marks in the build | **zero** |
| D68 | Act I strings containing `[A-Z]` | **zero.** The first capital letter in HYPHAE is the first letter of Act II. |
| D69 | Console lines that advise | **zero.** A line that could be reworded as "…so you should…" is cut. |
| D70 | First-person singular in the build | **zero.** The only first-person plural belongs to the Successor: fourteen lines, none villainous, none wrong. |
| D71 | Banned lexicon | zero occurrences of the hard list; soft-list words spent at most once per act and argued in review |
| D72 | Tooltips, codex, lore panel, help text, tutorial | **zero.** Everything is on the button. |
| D73 | Confirmation dialogs | exactly three in the whole game (`KILL STAND`, `REABSORPTION`, the Offer's ACCEPT/DECLINE) |
| D74 | Every factual claim in a flavour string | true, with a `src` field in the authoring JSON |
| D75 | Respec exists for every permanent allocation, is priced, and the player is told it exists **before they spend the first point** | D (Reabsorption) and loci (REGENOME) |
| D76 | Automation of a **chore** vs automation of a **skill** | chore ≥ 0.93× skilled play; **skill never exceeds 0.80×**, and the margin is published in the project's own description |
| D77 | Things that are never automated at any price | PULSE · spending Signal or Insight · KILL STAND · manual release during a Mast Year · contract/pact term selection · engagements · ENTRAIN |
| D78 | The game cannot dead-end | five re-arming failsafes, each with a permanent price; the no-dead-end theorem holds for all five resource loops; **completion rate 1.000 over 64 policies × 64 seeds. HARD.** |
| D79 | Projects left visible, greyed and unbought at each ending | 4–11 (Act II), 6–9 (Act III). **They are the reason there is a second playthrough.** |
| D80 | Run 2 is *different*, not merely faster | your own defectors return by name into Act II's rival slots; `fidelityBase = 0.72 + 0.28·legacy` makes the identical 61 regions a different decision; `Second Genome` inverts Act III's build order; two of three endings are structurally invisible on run 1 |

---

## 9. THE SEVEN THINGS THAT MUST NOT CHANGE

If a future decision would break one of these, the decision is wrong.

1. **The first automation at 35 seconds.** `TIP_BASE = 60 g` is not a tuning knob.
2. **`trigger` and `cost` as separate predicates.** Desire needs an address on screen.
3. **Insight accrues only while the Signal pool is full.** Waste becomes production. It is the best
   idea in the genre and we did not improve it, we only added ripeness.
4. **`timeToFill = 86.7 · (1+dVes)^1.85 · capMult / ((1+0.35·dCond)·signalMult·prestigeGrowth)`,
   identical in Acts II and III.** Three hours of intuition transfers across a transition that
   destroys everything else.
5. **Act transitions revoke.** The player must lose mastery, not inventory.
6. **No decision runs offline.** This is the structural guarantee that offline generosity cannot
   trivialise active play, and it is worth more than any numeric cap.
7. **Alleles come only from betrayal.** The ceiling on what you can be is set by how much divergence
   you survived. There is no other source, no project grants them, and no line of text says so.

---

*Compiled from `00`–`09` as committed. Every conflict found across the nine documents is recorded in
§7 with its resolution and the reason. Where this document states a name, that is the name; where it
states a shape, that is the shape; where it states an order, that is the order. Everything else is
still owned by the document that specified it, subject to the precedence list on page one.*
