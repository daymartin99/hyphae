;(function (HY) {
  'use strict'

  // M8 · world.js — Act II territory (BIBLE §6 M8).
  //
  // Owns: the 61-hex board's *shape* — axial coordinates, terrain, species mix, barrier chains,
  // procedural names, rivals — and every verb that moves the frontier: ADVANCE, SEED, SURVEY,
  // density, and the contest with the four rival strains. Owns `q r terrain sp0 sp1 w0 col d
  // barriers rival rivalStr` and flag bits 0–3 of `a2.regions`.
  //
  // Does NOT own: L0/T0/L/T/h/rho/fireRisk (forest.js writes those onto whatever shape it finds
  // here, renormalised so ΣL0 and ΣT0 hit TUNE exactly), the weather (flush.js), Signal
  // (cognition.js), pacts (pactbook.js). Every one of them is read lazily and feature-detected, so
  // this file runs alone in a harness and runs in the build.
  //
  // The act's territory thesis, in two sentences. ADVANCE is contiguous and cheap and *raises* the
  // connectivity term C; SEED is ranged and expensive and *lowers* it by making disconnected nodes.
  // Both feed the same Signal rate, they pull in opposite directions, and which one is right
  // depends on where the barriers are — so there is no dominant expansion order and the map is
  // different every run.
  //
  // What lives below is the terrain-advance table, the four strains, the name lists and the
  // worldgen weights: one data table nothing else reads, that moves as a unit or not at all. Every
  // number that crosses a module boundary is in HY.core.TUNE.A2.

  // ───────────────────────────────────────────────────────────────────────────
  // LAZY MODULE ACCESS
  // ───────────────────────────────────────────────────────────────────────────

  function C () { return HY.core }
  function T () { return HY.core.TUNE }
  function A () { return HY.core.TUNE.A2 }
  function S () { return HY.state.state }

  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }
  function flagOn (s, id) { return !!(s.proj && s.proj.flags && s.proj.flags[id]) }
  function mult (s, k, dflt) {
    var v = s.mult ? s.mult[k] : undefined
    return typeof v === 'number' && isFinite(v) && v > 0 ? v : dflt
  }
  function stat (s, k, n) { if (s.stats && typeof s.stats[k] === 'number') s.stats[k] += n }
  function fire (id, tokens) { if (HY.log && HY.log.logFire) HY.log.logFire(id, tokens) }
  function feel (ev, params) { if (HY.feel && HY.feel.feel) HY.feel.feel(ev, params) }

  // §3 a2.regions.flags. Bits 0–3 are written here; 4–6 belong to forest.js; 7 stays reserved.
  var RF_DISCOVERED = 1
  var RF_SURVEYED = 2
  var RF_CLAIMED = 4
  var RF_ADVANCING = 8
  var RF_NECROTIZED = 16

  // ───────────────────────────────────────────────────────────────────────────
  // DATA TABLES — `02` §6.2, §6.4, §6.8, §6.9, §8.2
  // ───────────────────────────────────────────────────────────────────────────

  var HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
  var RINGS = 4                               // 1 + 6 + 12 + 18 + 24 = 61
  // The terrain enum every table below is indexed by. forest.js, canvas.js and projects.js index
  // the same six ids in the same order (`02` §6.4), so the whole set is named even where this file
  // only needs four of them: a table whose keys are half-named is a table that gets mis-edited.
  var LOAM = 0, SAND = 1, CLAY = 2, SCREE = 3, PEAT = 4, BURN = 5
  var NTERRAIN = 6

  // `02` §6.8's terrain multiplier on advanceCost, and §6.4's rivalAgg. Scree is dear because it is
  // stone; Burn is cheap because nothing there is defending itself.
  var TERRAIN_ADV = [1.00, 0.90, 1.15, 1.40, 1.30, 0.75]
  var TERRAIN_RIVAL = [1.00, 0.85, 1.05, 0.60, 1.30, 0.45]
  var TERRAIN_NAME = ['loam', 'sand', 'clay', 'scree', 'peat', 'burn']

  // Worldgen weights, `02` §6.4. Burn is created by fire, never generated.
  var TERRAIN_W = [0.40, 0.18, 0.20, 0.11, 0.11, 0.00]
  var MIN_SCREE = 3, MIN_PEAT = 2
  var MAX_SAME_NEIGHBOURS = 2                 // "no more than 2 same-terrain regions adjacent"
  var REPAIR_PASSES = 24                      // bounded: worldgen must terminate on every seed

  // Species ids are forest.js's table order: 0 Oak · 1 Beech · 2 Birch · 3 Pine · 4 Hemlock.
  var NSPECIES = 5
  var SPECIES_NAME = ['oak', 'beech', 'birch', 'pine', 'hemlock']

  // Which trees stand on which ground. Birch is the pioneer on burn and scree; pine takes the wet
  // acid ground and the stone; the beech/oak mix is the ordinary forest. This is the only place the
  // two tables meet, and it is why terrain reads as a place rather than as a modifier.
  var SPECIES_W = [
    [0.30, 0.35, 0.10, 0.10, 0.15],           // Loam
    [0.05, 0.10, 0.30, 0.45, 0.10],           // Sand
    [0.35, 0.25, 0.05, 0.10, 0.25],           // Clay
    [0.05, 0.05, 0.35, 0.45, 0.10],           // Scree
    [0.05, 0.10, 0.20, 0.45, 0.20],           // Peat
    [0.05, 0.05, 0.70, 0.15, 0.05]            // Burn
  ]
  var MIX_MIN = 0.55, MIX_SPAN = 0.40         // w0 ∈ [0.55, 0.95]: a stand always has a dominant

  // `02` §6.4's litterMod, needed here — and only here — to rank stands by richness before
  // forest.js has written L0. The ranking is scale-free, so it agrees with the renormalised array.
  var TERRAIN_LITTER = [1.00, 0.55, 1.25, 0.25, 2.20, 0.35]
  var SPECIES_LITTER = [1.15, 1.05, 0.70, 0.85, 0.95]

  // `02` §8.2, the four strains. γ is logistic growth per second, `agg` the pressure coefficient.
  var ARMILLARIA = 0, TRICHODERMA = 1, PHELLINUS = 2, FOMITOPSIS = 3
  var RIVALS = [
    { key: 'armillaria', name: 'Armillaria', gamma: 0.00040, agg: 1.30, line: 'a2.armillaria' },
    { key: 'trichoderma', name: 'Trichoderma', gamma: 0.00110, agg: 0.85, line: 'a2.trichoderma' },
    { key: 'phellinus', name: 'Phellinus', gamma: 0.00022, agg: 1.55, line: 'a2.phellinus' },
    { key: 'fomitopsis', name: 'Fomitopsis', gamma: 0.00016, agg: 0.70, line: 'a2.fomitopsis' }
  ]
  var RIVAL_SEATS = 9                         // regions held at worldgen, rings 2–4
  var RIVAL_R_MIN = 0.35, RIVAL_R_SPAN = 0.40 // R = 0.35 + 0.4·rand
  var PHELLINUS_SEATS = 2                     // it takes the two richest stands in the forest

  // Contest, `02` §8.3.
  var CONTEST_NBR = 0.25                      // ×(1 + 0.25·claimedNeighbours) on your pressure
  // The pressure an advancing front carries before the stand is yours. Chosen, not tuned:
  // 0.80·(1 + 0.25·1) = 1.000, so the canonical first ADVANCE — one claimed neighbour, no rival,
  // no chemistry — takes exactly ADV_TIME seconds and the number on the button is the truth. Every
  // extra claimed neighbour makes the same advance faster, which is the adjacency decision.
  var ADV_FRONT = 0.80
  var PHELLINUS_RESIST = 0.60                 // your pressure against it is ×0.60
  var TRICHO_D_DECAY = 2.5e-4                 // /s ·R, on your density in adjacent regions
  var TRICHO_D_GAIN = 0.75                    // × on density bought adjacent to it
  var RIVAL_PUSHBACK = 0.0009                 // /s ·yourPressure, subtracted from rivalStr
  var RETAKE_D = 0.15                         // your density below this invites a neighbour in
  var RETAKE_SEED = 0.10                      // the rivalStr a retake starts at
  var REPEL_THEIRS = 0.45, REPEL_YOURS = 0.30 // `02` §11.2's REPEL, ×(1 ∓ k·strength)
  var RECRUIT_COL = 0.35                      // colonisation added instantly by a RECRUIT pulse
  var RECRUIT_SLOT = 1                        // extra advance slot while its window is open
  var OFFLINE_HOLD_FLOOR = 0.25               // a contested stand you hold cannot fall past this
                                              // while you are away (BIBLE P5)

  // Spread. `02` §8.2 rolls a die every slow tick; this creeps at the same mean rate instead.
  // Two reasons. Offline reconciliation must reproduce the live run byte for byte and a Bernoulli
  // that is skipped offline is a second code path; and BIBLE §6 M8 is explicit that rivals are
  // pressure rather than HP and that losing ground is *slow and visible*. A bar that fills is both.
  // 0.0035·γ·200 per 2 s = 0.35·γ /s of spread probability; reaching the seed level 0.12 at that
  // rate is 0.042·γ per second, which is one Trichoderma spread per source-pair per 43 minutes and
  // — across the strain's five to ten frontier stands — the "1 per 4–20 min" of `02` §8.2.
  var SPREAD_K = 0.042
  var SPREAD_FROM = 0.55                      // a rival only spreads from a region it holds firmly
  var FOMITOPSIS_HUMUS = 0.20                 // it leaves the ground better than it found it

  // Density, 08 §4.5: densityCost = 2.40e5 · L0_i/L0_ref · (1 − d)^(−1.35). 08 states the
  // coefficient and the pole but never L0_ref, and its own act total (3.63e11 g) only closes if the
  // first step on a stand is `02` §6.10's 0.0035·L0. That fraction *is* the reference: it fixes
  // L0_ref at 6.86e7 g and makes both documents true at once, which is why it is written as a
  // fraction here rather than as a fourth magic number.
  var DENS_FIRST_FRAC = 0.0035
  var DENS_STEP = 0.10                        // ten steps, `02` §6.10
  // Minerals are NOT a fraction of the gram cost: a currency that is a scaled copy of another
  // currency is a reskin (BIBLE P2). The ion budget is the *membrane*, not the wood, so it scales
  // with the step and the ring and not at all with how much litter the stand happens to hold. Full
  // density everywhere costs ≈8.4e4 ⛬ against ≈9e4 ⛬ of passive income across the act: affordable,
  // never free, and the reason Act I's contract book is still load-bearing at minute 180.
  var DENS_MIN_A = 12
  var DENS_MIN_RING = 0.55

  // The density automation (`turgor_regulation`, C3) is a per-terrain target dial, not a blanket
  // "buy everything" — `02` §11.4 prices it at 0.93× of skilled play, which it earns by buying
  // cheapest-first instead of best-marginal-value and by stopping at a generic target.
  var DENS_TARGET_DEFAULT = [0.80, 0.50, 0.70, 0.60, 0.70, 0.30]
  var AUTO_DENS_BUDGET = 0.25                 // never spend more than this share of held biomass
  var AUTO_ADV_BUDGET = 0.35                  // ditto, on an automated advance
  var AUTO_SLOW_S = 2.0                       // s — automation and rival spread run at 0.5 Hz

  // Advance slots, `02` §6.8 and §7.1, on this build's project slugs.
  var SLOTS = [
    { flag: null, n: 1 },
    { flag: 'rhizomorphs', n: 3 },
    { flag: 'rhizomorph_highways', n: 6 },
    { flag: 'ballistospory', n: 10 }
  ]
  var ADV_CANCEL_REFUND = 0.60
  var BARRIER_COST = 2.40                     // × advanceCost to cross a bridged edge
  // The density a landed advance leaves behind. The front *is* hyphae — the grams you spent
  // crossing the edge are in the stand when it opens — and it is the same 0.30 DECIDE gives the
  // core, so `02` §3's beat 3 is true: the claim lands and Sr moves 2.5 → 3.6 where you can see it.
  // It also puts a fresh stand above RETAKE_D, so §8.3's "d *falls* below 0.15" means what it says.
  var CLAIM_D = 0.30

  // Seeding, `02` §7.9.
  var SEED_RING = 0.45, SEED_RIVAL = 2.20
  var SEED_WIND_FAST = 0.60, SEED_WIND_DISCOUNT = 0.75
  var SEED_COL = 0.40                         // colonisation granted on landing, ×(1 − rivalStr)
  var SEED_ARC = Math.PI / 3                  // "within one hex direction of the current windDir"
  var SPORE_CONTEST_K = 1.6e-4                // `02` §7.8's 60 s of 0.00012·spores^0.55, integrated
  var SPORE_CONTEST_EXP = 0.55

  // The information economy, `02` §6.7. The band is ±0.28 of true, seeded per region so it does not
  // shimmer between frames.
  var BAND_FRAC = 0.28

  var EXPANSION_POLICIES = ['compact', 'rich', 'contested']

  // Names, `02` §6.9.
  var QUALIFIER = ['Old', 'Low', 'High', 'Black', 'White', 'Red', 'Long', 'Deep', 'Wet', 'Cold',
    'Still', 'Sour', 'Broken', 'Standing', 'Hollow', 'Bare', 'Green', 'Blind', 'Thin', 'Far']
  var FEATURE = ['Beech', 'Oak', 'Pine', 'Birch', 'Hemlock', 'Alder', 'Elder', 'Ash', 'Rowan',
    'Holly', 'Stone', 'Scree', 'Bog', 'Ford', 'Slope', 'Shelf', 'Bank', 'Ditch', 'Cairn', 'Fell']
  var FORM = ['Hollow', 'Stand', 'Reach', 'Bottom', 'Rise', 'Wood', 'Copse', 'Break', 'Ground',
    'Sink', 'Turn', 'Fold', 'Cross', 'Bend', 'End', 'Lee', 'Shade', 'Draw', 'Head', 'Foot']
  var SPECIES_FEATURE = [1, 0, 3, 2, 4]       // species id → its index in FEATURE
  var NAME_DROP_Q = 0.45                      // chance the qualifier is dropped, for rhythm
  var NAME_TRUE_SP = 0.70                     // chance the feature names the actual dominant tree

  var EPS = 1e-9

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE STATE
  //
  // Everything persistent is in §3's typed arrays; state.js is the only module allowed to
  // serialise them. What is cached here is either derivable from `seed` (the generated map, the
  // names, the adjacency index) or is a policy rather than progress.
  // ───────────────────────────────────────────────────────────────────────────

  var gen = null              // the pure worldgen result, keyed by seed
  var genSeed = -1
  var adj = null              // Int16Array(61·6): neighbour id per direction, −1 for the boundary
  var ringOf = null           // Uint8Array(61)
  var names = null
  var nreg = 0
  var slowAt = 0              // sim time of the next 0.5 Hz pass
  var lastAct = 0             // the act this module last saw, so DECIDE is noticed from step()
  var contacted = null        // Uint8Array(61): a rival on this hex has already spoken

  // §3 allocates world.js no scalar block, so the two automation policies are session state rather
  // than save state. That is the honest trade: they are *policy*, not progress — a reload restores
  // the documented defaults and nothing the player earned is lost.
  var densTarget = null
  var expansionPolicy = 'compact'

  // ───────────────────────────────────────────────────────────────────────────
  // GEOMETRY
  // ───────────────────────────────────────────────────────────────────────────

  // The spiral: ring 0, then each ring outward, walking the six sides. Index i is the region id
  // forever (§3.1), and the index bands are 1·6·12·18·24 — which is also the fallback forest.js
  // assumes when this file is absent, so `ring` reads the same either way.
  function spiral (n) {
    var out = [[0, 0]], k, side, step, q = 0, r = 0
    for (k = 1; k <= n && out.length < 61; k++) {
      q = HEX_DIRS[4][0] * k; r = HEX_DIRS[4][1] * k
      for (side = 0; side < 6; side++) {
        for (step = 0; step < k; step++) {
          out.push([q, r])
          q += HEX_DIRS[side][0]; r += HEX_DIRS[side][1]
        }
      }
    }
    return out
  }

  function ringAt (q, r) { return (Math.abs(q) + Math.abs(r) + Math.abs(-q - r)) / 2 }

  function buildIndex (coords) {
    var n = coords.length, i, k, j
    adj = new Int16Array(n * 6)
    ringOf = new Uint8Array(n)
    var key = {}
    for (i = 0; i < n; i++) {
      key[coords[i][0] + ',' + coords[i][1]] = i
      ringOf[i] = ringAt(coords[i][0], coords[i][1])
    }
    for (i = 0; i < n; i++) {
      for (k = 0; k < 6; k++) {
        j = key[(coords[i][0] + HEX_DIRS[k][0]) + ',' + (coords[i][1] + HEX_DIRS[k][1])]
        adj[i * 6 + k] = j === undefined ? -1 : j
      }
    }
  }

  function neighbours (i) {
    var out = [], k, j
    if (!adj) return out
    for (k = 0; k < 6; k++) { j = adj[i * 6 + k]; if (j >= 0) out.push(j) }
    return out
  }

  function dirTo (i, j) {
    var k
    for (k = 0; k < 6; k++) if (adj[i * 6 + k] === j) return k
    return -1
  }

  // Accepts region ids (which is how cognition's PULSE falloff calls it) or {q,r} records.
  function hexDist (a, b) {
    var s = S()
    var reg = s && s.a2 ? s.a2.regions : null
    var aq, ar, bq, br
    if (a && typeof a === 'object') { aq = num(a.q); ar = num(a.r) } else if (reg) {
      aq = reg.q[Math.floor(a)] | 0; ar = reg.r[Math.floor(a)] | 0
    } else return 0
    if (b && typeof b === 'object') { bq = num(b.q); br = num(b.r) } else if (reg) {
      bq = reg.q[Math.floor(b)] | 0; br = reg.r[Math.floor(b)] | 0
    } else return 0
    return (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs((-aq - ar) - (-bq - br))) / 2
  }

  // Flat-top axial → the plane, for the wind test and nothing else. Two scalar helpers rather than
  // a point object: `downwind` runs this 61 times per card and the STANDS list is 61 cards, so an
  // allocation here is four thousand short-lived objects every time the panel redraws.
  var SQ3 = Math.sqrt(3)
  function px (reg, i) { return 1.5 * reg.q[i] }
  function py (reg, i) { return SQ3 * (reg.r[i] + reg.q[i] / 2) }

  // ───────────────────────────────────────────────────────────────────────────
  // WORLDGEN — a pure function of the seed
  //
  // Pure because the names depend on it and the names must be stable forever. A stand that burns
  // has its species mix rewritten in state; re-deriving the *original* map from the seed is what
  // stops "Beech Hollow" becoming "Birch Ground" on the next reload.
  // ───────────────────────────────────────────────────────────────────────────

  function pickWeighted (u, w) {
    var t = 0, i
    for (i = 0; i < w.length; i++) t += w[i]
    var x = u * t
    for (i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i }
    return w.length - 1
  }

  function sameNeighbours (terrain, i) {
    var k, j, n = 0
    for (k = 0; k < 6; k++) {
      j = adj[i * 6 + k]
      if (j >= 0 && terrain[j] === terrain[i]) n++
    }
    return n
  }

  function genMap (seed) {
    var coords = spiral(RINGS)
    var n = coords.length
    buildIndex(coords)

    var g = {
      n: n,
      q: new Int8Array(n), r: new Int8Array(n),
      terrain: new Uint8Array(n),
      sp0: new Uint8Array(n), sp1: new Uint8Array(n), w0: new Float32Array(n),
      barriers: new Uint8Array(n),
      rival: new Int8Array(n), rivalStr: new Float32Array(n),
      shape: new Float64Array(n)
    }
    var i, k, j
    for (i = 0; i < n; i++) { g.q[i] = coords[i][0]; g.r[i] = coords[i][1] }

    var R = C().rng(C().hash32(seed, 'worldgen'))

    // ── terrain ──────────────────────────────────────────────────────────────
    g.terrain[0] = LOAM                                    // ring 0 is always Loam
    for (i = 1; i < n; i++) g.terrain[i] = pickWeighted(R.next(), TERRAIN_W)

    // Repair, in the order the constraints bind: adjacency first (it moves the most tiles), then
    // the guaranteed minima, then adjacency again so the minima did not create a clump.
    repairAdjacency(g.terrain, R)
    ensureMinimum(g.terrain, SCREE, MIN_SCREE, R)
    ensureMinimum(g.terrain, PEAT, MIN_PEAT, R)
    repairAdjacency(g.terrain, R)

    // ── species ──────────────────────────────────────────────────────────────
    // Drawn from a per-region hash stream rather than from R, so regionName() can re-derive a
    // stand's original mix without replaying the whole generator.
    for (i = 0; i < n; i++) {
      var sp = speciesRoll(seed, i, g.terrain[i])
      g.sp0[i] = sp[0]; g.sp1[i] = sp[1]; g.w0[i] = sp[2]
      g.shape[i] = (1 + A().RING_MULT * ringOf[i]) * TERRAIN_LITTER[g.terrain[i]] *
        (sp[2] * SPECIES_LITTER[sp[0]] + (1 - sp[2]) * SPECIES_LITTER[sp[1]])
    }

    // ── barriers: three chains of 5–9 contiguous edges, from the boundary inward ──
    for (k = 0; k < 3; k++) layChain(g, R)
    // Never enclose a region completely: a stand behind six barriers is unreachable before C5 and
    // unreadable after it. Four is the most any hex may carry.
    for (i = 0; i < n; i++) {
      var open = 0
      for (k = 0; k < 6; k++) if (adj[i * 6 + k] >= 0 && !(g.barriers[i] & (1 << k))) open++
      for (k = 0; k < 6 && open < 2; k++) {
        j = adj[i * 6 + k]
        if (j < 0 || !(g.barriers[i] & (1 << k))) continue
        g.barriers[i] &= ~(1 << k)
        var back = dirTo(j, i)
        if (back >= 0) g.barriers[j] &= ~(1 << back)
        open++
      }
    }

    // ── rivals: nine seats in rings 2–4, one per strain minimum ──────────────
    for (i = 0; i < n; i++) g.rival[i] = -1
    var pool = []
    for (i = 1; i < n; i++) if (ringOf[i] >= 2) pool.push(i)
    // Phellinus does not spread; it is simply already where the good ground is.
    var rich = pool.slice().sort(function (a, b) { return g.shape[b] - g.shape[a] })
    var seats = 0, taken = {}
    for (k = 0; k < PHELLINUS_SEATS && k < rich.length; k++) {
      taken[rich[k]] = 1
      g.rival[rich[k]] = PHELLINUS
      g.rivalStr[rich[k]] = RIVAL_R_MIN + RIVAL_R_SPAN * R.next()
      seats++
    }
    // One of each remaining strain first, then fill at random: the guarantee is a floor, not a quota.
    var order = [ARMILLARIA, TRICHODERMA, FOMITOPSIS]
    for (k = 0; k < order.length && seats < RIVAL_SEATS; k++) {
      j = freeSeat(pool, taken, R)
      if (j < 0) break
      taken[j] = 1; g.rival[j] = order[k]
      g.rivalStr[j] = RIVAL_R_MIN + RIVAL_R_SPAN * R.next()
      seats++
    }
    while (seats < RIVAL_SEATS) {
      j = freeSeat(pool, taken, R)
      if (j < 0) break
      taken[j] = 1; g.rival[j] = R.int(RIVALS.length)
      g.rivalStr[j] = RIVAL_R_MIN + RIVAL_R_SPAN * R.next()
      seats++
    }
    return g
  }

  function freeSeat (pool, taken, R) {
    var tries, j
    for (tries = 0; tries < 200; tries++) {
      j = pool[R.int(pool.length)]
      // Rivals do not start adjacent to the core: the first two minutes must be uncontested.
      if (taken[j] || dirTo(0, j) >= 0) continue
      return j
    }
    for (tries = 0; tries < pool.length; tries++) if (!taken[pool[tries]]) return pool[tries]
    return -1
  }

  // Scoring a candidate on the region *and its neighbours* is what makes the repair converge:
  // scoring the region alone lets two adjacent violators hand the violation back and forth forever.
  function clumpScore (terrain, i) {
    var own = sameNeighbours(terrain, i), k, j, pen = 0
    for (k = 0; k < 6; k++) {
      j = adj[i * 6 + k]
      if (j >= 0 && sameNeighbours(terrain, j) > MAX_SAME_NEIGHBOURS) pen++
    }
    return own + 4 * pen
  }

  // A monotone patch of four or more reads as a blank area rather than as ground, so a region may
  // carry at most two neighbours of its own kind. With five legal terrains over six neighbours a
  // fix always exists locally; the passes exist because fixing one region can break its neighbour,
  // and the offset rotation stops two adjacent violators from swapping forever.
  function repairAdjacency (terrain, R) {
    var pass, i, j, k, cand, cn, best, bestN, off
    for (pass = 0; pass < REPAIR_PASSES; pass++) {
      var bad = 0
      off = R.int(NTERRAIN)
      for (var v = 0; v < terrain.length; v++) {
        if (sameNeighbours(terrain, v) <= MAX_SAME_NEIGHBOURS) continue
        // Ring 0 is always Loam (`02` §6.4), so when the core is the region with too many Loam
        // neighbours the fix has to be applied to a neighbour instead. It is the same repair.
        i = v
        if (v === 0) {
          i = -1
          for (k = 0; k < 6; k++) {
            j = adj[k]
            if (j >= 0 && terrain[j] === terrain[0] && (i < 0 || clumpScore(terrain, j) > clumpScore(terrain, i))) i = j
          }
          if (i < 0) continue
        }
        best = terrain[i]; bestN = clumpScore(terrain, i)
        for (k = 0; k < NTERRAIN; k++) {
          cand = (k + off + pass) % NTERRAIN
          if (TERRAIN_W[cand] <= 0 || cand === terrain[i]) continue
          var was = terrain[i]
          terrain[i] = cand
          cn = clumpScore(terrain, i)
          terrain[i] = was
          if (cn < bestN) { bestN = cn; best = cand }
        }
        terrain[i] = best
        if (sameNeighbours(terrain, i) > MAX_SAME_NEIGHBOURS) bad++
      }
      if (!bad) {
        for (i = 0; i < terrain.length; i++) {
          if (sameNeighbours(terrain, i) > MAX_SAME_NEIGHBOURS) { bad++; break }
        }
        if (!bad) return
      }
    }
  }

  function ensureMinimum (terrain, code, want, R) {
    var i, have = 0
    for (i = 0; i < terrain.length; i++) if (terrain[i] === code) have++
    var guard = 0
    while (have < want && guard++ < 400) {
      i = 1 + R.int(terrain.length - 1)
      if (terrain[i] === code || terrain[i] === SCREE || terrain[i] === PEAT) continue
      var was = terrain[i]
      terrain[i] = code
      if (sameNeighbours(terrain, i) > MAX_SAME_NEIGHBOURS) { terrain[i] = was; continue }
      have++
    }
  }

  // A chain runs *alongside* a path, not across it: walk inward from the rim, and at every hex on
  // the walk block the edge on one fixed side. Consecutive blocked edges then share a vertex, so
  // the canvas draws one continuous stream or road rather than a scatter of dashes, and the walk's
  // own corridor stays open — a barrier that enclosed its own path would strand the stands behind
  // it, which is the one thing `02` §6.6 forbids.
  function layChain (g, R) {
    var len = 5 + R.int(5)                    // 5–9 edges
    var pool = [], i, k
    for (i = 0; i < g.n; i++) if (ringOf[i] === RINGS) pool.push(i)
    var cur = pool[R.int(pool.length)]

    // Head inward: the chain has to start at the map's edge and reach into it.
    var travel = 0, bestRing = 99
    for (k = 0; k < 6; k++) {
      var nb = adj[cur * 6 + k]
      if (nb >= 0 && ringOf[nb] < bestRing) { bestRing = ringOf[nb]; travel = k }
    }
    var side = R.next() < 0.5 ? 1 : 5         // ±60° off the direction of travel
    var laid = 0, guard = 0

    while (laid < len && guard++ < 40) {
      var sd = (travel + side) % 6
      var j = adj[cur * 6 + sd]
      if (j >= 0 && !(g.barriers[cur] & (1 << sd))) {
        g.barriers[cur] |= (1 << sd)
        var back = dirTo(j, cur)
        if (back >= 0) g.barriers[j] |= (1 << back)   // barriers are symmetric, always
        laid++
      }
      var nxt = adj[cur * 6 + travel]
      if (nxt < 0) {
        // The walk has run out of map: turn along the rim rather than stopping short.
        travel = (travel + (R.next() < 0.5 ? 1 : 5)) % 6
        nxt = adj[cur * 6 + travel]
        if (nxt < 0) break
      }
      cur = nxt
      if (R.next() < 0.30) travel = (travel + (R.next() < 0.5 ? 1 : 5)) % 6
    }
  }

  function speciesRoll (seed, i, terrain) {
    var h = C().rng(C().hash32(seed, 'species', i))
    var w = SPECIES_W[terrain % SPECIES_W.length]
    var a = pickWeighted(h.next(), w)
    var w2 = w.slice()
    w2[a] = 0
    var b = pickWeighted(h.next(), w2)
    if (b === a) b = (a + 1) % NSPECIES
    return [a, b, MIX_MIN + MIX_SPAN * h.next()]
  }

  function ensureGen (s) {
    var seed = (s && s.seed) >>> 0
    if (gen && genSeed === seed) return gen
    gen = genMap(seed)
    genSeed = seed
    names = null
    nreg = gen.n
    return gen
  }

  // BIBLE §6 M8. Writes the generated shape into §3's arrays; forest.js then renormalises L0/T0
  // onto it, which is why this runs first in loop.js's init order.
  function worldgen (seed) {
    var s = S()
    if (!s || !s.a2) return false
    if (seed !== undefined && seed !== null) s.seed = seed >>> 0
    var g = genMap(s.seed >>> 0)
    gen = g; genSeed = s.seed >>> 0; names = null
    var r = s.a2.regions, i
    nreg = Math.min(g.n, r.q.length)
    for (i = 0; i < nreg; i++) {
      r.q[i] = g.q[i]; r.r[i] = g.r[i]
      r.terrain[i] = g.terrain[i]
      r.sp0[i] = g.sp0[i]; r.sp1[i] = g.sp1[i]; r.w0[i] = g.w0[i]
      r.barriers[i] = g.barriers[i]
      r.rival[i] = g.rival[i]; r.rivalStr[i] = g.rivalStr[i]
      r.col[i] = (r.flags[i] & RF_CLAIMED) ? 1 : 0
    }
    contacted = new Uint8Array(nreg)
    discover(s)
    return true
  }

  function generated (s) {
    var r = s.a2.regions, i
    for (i = 1; i < r.q.length; i++) if (r.q[i] || r.r[i]) return true
    return false
  }

  // ───────────────────────────────────────────────────────────────────────────
  // NAMES — `02` §6.9. Stable forever, seeded by region id, unmoved by fire.
  // ───────────────────────────────────────────────────────────────────────────

  function regionName (i) {
    var s = S()
    if (!s) return ''
    var g = ensureGen(s)
    if (!names) names = new Array(g.n)
    i = Math.floor(i)
    if (!(i >= 0 && i < g.n)) return ''
    if (names[i]) return names[i]
    var h = C().rng(C().hash32(s.seed, 'name', i))
    var q = QUALIFIER[h.int(QUALIFIER.length)]
    var featIdx
    // Correlated with the dominant tree 70% of the time and deliberately wrong the rest, because
    // that is how place names work: the beeches were cut two hundred years ago and the name stayed.
    if (h.next() < NAME_TRUE_SP) featIdx = SPECIES_FEATURE[g.sp0[i] % NSPECIES]
    else featIdx = h.int(FEATURE.length)
    var f = FEATURE[featIdx]
    var form = FORM[h.int(FORM.length)]
    names[i] = (h.next() < NAME_DROP_Q ? '' : q + ' ') + f + ' ' + form
    return names[i]
  }

  // ───────────────────────────────────────────────────────────────────────────
  // QUERIES
  // ───────────────────────────────────────────────────────────────────────────

  function claimed (i, st) { return !!((st || S()).a2.regions.flags[i] & RF_CLAIMED) }
  function discovered (i, st) { return !!((st || S()).a2.regions.flags[i] & RF_DISCOVERED) }
  function surveyed (i, st) { return !!((st || S()).a2.regions.flags[i] & RF_SURVEYED) }
  function advancing (i, st) { return !!((st || S()).a2.regions.flags[i] & RF_ADVANCING) }

  function claimedCount (st) {
    var s = st || S(), f = s.a2.regions.flags, i, n = 0
    for (i = 0; i < f.length; i++) if (f[i] & RF_CLAIMED) n++
    return n
  }

  function discoveredCount (st) {
    var s = st || S(), f = s.a2.regions.flags, i, n = 0
    for (i = 0; i < f.length; i++) if (f[i] & RF_DISCOVERED) n++
    return n
  }

  function advancingCount (st) {
    var s = st || S(), f = s.a2.regions.flags, i, n = 0
    for (i = 0; i < f.length; i++) if (f[i] & RF_ADVANCING) n++
    return n
  }

  function claimedNeighbours (i, st) {
    var s = st || S(), k, j, n = 0
    for (k = 0; k < 6; k++) {
      j = adj ? adj[i * 6 + k] : -1
      if (j >= 0 && (s.a2.regions.flags[j] & RF_CLAIMED)) n++
    }
    return n
  }

  function barrierBetween (i, k, st) {
    return !!((st || S()).a2.regions.barriers[i] & (1 << k))
  }

  // An edge counts toward C when both ends are claimed and the edge is passable — which after
  // Bridging Strands includes the edges you paid to cross. `02` §4.2's edges/nodes, exactly.
  function netShape (st) {
    var s = st || S()
    var r = s.a2.regions, i, k, j
    var bridged = flagOn(s, 'bridging_strands')
    var out = { nodes: 0, edges: 0, bridged: bridged }
    for (i = 0; i < r.flags.length; i++) {
      if (!(r.flags[i] & RF_CLAIMED)) continue
      out.nodes++
      for (k = 0; k < 6; k++) {
        j = adj ? adj[i * 6 + k] : -1
        if (j <= i) continue                                 // each unordered pair once
        if (!(r.flags[j] & RF_CLAIMED)) continue
        if ((r.barriers[i] & (1 << k)) && !bridged) continue
        out.edges++
      }
    }
    return out
  }

  function fromShape (nodes, edges) {
    if (!nodes) return A().CONN_MIN
    var a = A()
    return C().clamp(1 + a.CONN_K * Math.pow(edges / nodes, a.CONN_EXP), a.CONN_MIN, a.CONN_MAX)
  }

  function connectivity (st) {
    var s = st || S()
    if (!s || !s.a2) return A().CONN_MIN
    var sh = netShape(s)
    return fromShape(sh.nodes, sh.edges)
  }

  // What C would become if you claimed i. This is the whole reason the map is a decision rather
  // than a checklist, and the card shows it before a gram is committed. Closed form on the shape
  // rather than a re-scan, so the STANDS list costs one pass over the board and not sixty-one.
  function connectivityIf (i, shape, st) {
    var s = st || S()
    var r = s.a2.regions
    var sh = shape || netShape(s)
    if (r.flags[i] & RF_CLAIMED) return fromShape(sh.nodes, sh.edges)
    var k, j, gained = 0
    for (k = 0; k < 6; k++) {
      j = adj ? adj[i * 6 + k] : -1
      if (j < 0 || !(r.flags[j] & RF_CLAIMED)) continue
      if ((r.barriers[i] & (1 << k)) && !sh.bridged) continue
      gained++
    }
    return fromShape(sh.nodes + 1, sh.edges + gained)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DISCOVERY AND SURVEY — `02` §6.7
  // ───────────────────────────────────────────────────────────────────────────

  function discover (s) {
    var r = s.a2.regions, i, k, j, opened = 0
    for (i = 0; i < nreg; i++) {
      if (!(r.flags[i] & RF_CLAIMED)) continue
      r.flags[i] |= RF_DISCOVERED
      for (k = 0; k < 6; k++) {
        j = adj[i * 6 + k]
        if (j < 0 || (r.flags[j] & RF_DISCOVERED)) continue
        r.flags[j] |= RF_DISCOVERED
        opened++
        announceRival(s, j)
      }
    }
    return opened
  }

  // The first time a strain is visible it says one thing about itself, once, and never again.
  function announceRival (s, i) {
    var r = s.a2.regions
    if (r.rival[i] < 0 || !(r.flags[i] & RF_DISCOVERED)) return
    if (!contacted || contacted.length !== nreg) contacted = new Uint8Array(nreg)
    if (contacted[i]) return
    contacted[i] = 1
    stat(s, 'rivalContacts', 1)
    var strain = RIVALS[r.rival[i] % RIVALS.length]
    fire(strain.line, { region: regionName(i), strain: strain.name })
  }

  // The band a discovered-but-unsurveyed stand shows instead of a figure. Seeded per region so it
  // is the same wrong number every time you look at it — a fog, not a shimmer.
  function band (i, value) {
    var s = S()
    var h = C().rng(C().hash32(s.seed, 'band', i))
    var skew = (h.next() - 0.5) * 2 * BAND_FRAC * 0.5
    var mid = value * (1 + skew)
    return [mid * (1 - BAND_FRAC), mid * (1 + BAND_FRAC)]
  }

  function survey (i) {
    var s = S()
    if (!s || s.act !== 2) return false
    i = Math.floor(i)
    var r = s.a2.regions
    if (!(i >= 0 && i < nreg)) return false
    if (!flagOn(s, 'substrate_assay')) return false
    if (!(r.flags[i] & RF_DISCOVERED) || (r.flags[i] & RF_SURVEYED)) return false
    var cost = A().SURVEY_COST
    if (num(s.res.signal) < cost) return false
    C().setStock(s.res, 'signal', num(s.res.signal) - cost)
    r.flags[i] |= RF_SURVEYED
    feel('buy', { region: i })
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ADVANCE — `02` §6.8, 08 §4.4
  // ───────────────────────────────────────────────────────────────────────────

  function advanceSlots (st) {
    var s = st || S(), i, n = SLOTS[0].n
    for (i = 1; i < SLOTS.length; i++) if (flagOn(s, SLOTS[i].flag)) n = SLOTS[i].n
    return n + (recruitOpen(s) ? RECRUIT_SLOT : 0)
  }

  // A RECRUIT window is a record in §3's cog.pulsesInFlight; reading it is cheaper and more honest
  // than mirroring cognition's timer here.
  function recruitOpen (s) {
    var list = s.cog && s.cog.pulsesInFlight, i
    if (!list) return false
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].mode === 'RECRUIT' && list[i].done && list[i].until > s.t) return true
    }
    return false
  }

  // The cheapest passable edge into i from ground you already hold, as a direction index on the
  // *neighbour*. −1 when there is no claimed neighbour at all.
  function bestEntry (i, st) {
    var s = st || S()
    var r = s.a2.regions
    var bridged = flagOn(s, 'bridging_strands')
    var k, j, open = -1, cross = -1
    for (k = 0; k < 6; k++) {
      j = adj[i * 6 + k]
      if (j < 0 || !(r.flags[j] & RF_CLAIMED)) continue
      if (r.barriers[i] & (1 << k)) { if (cross < 0) cross = k; continue }
      if (open < 0) open = k
    }
    if (open >= 0) return { dir: open, barrier: false }
    if (cross >= 0) return { dir: cross, barrier: true, blocked: !bridged }
    return null
  }

  function advanceCost (i, st) {
    var s = st || S()
    var a = A()
    i = Math.floor(i)
    var r = s.a2.regions
    var entry = bestEntry(i, s)
    var cost = a.ADV_BASE *
      Math.pow(a.ADV_GROWTH, claimedCount(s)) *
      TERRAIN_ADV[r.terrain[i] % TERRAIN_ADV.length] *
      (1 + a.ADV_RING_COST * ringOf[i]) *
      mult(s, 'advCostMult', 1)
    if (entry && entry.barrier) cost *= BARRIER_COST
    return cost
  }

  // The published 45 s is the one-neighbour case; every extra claimed neighbour shortens it, and a
  // rival lengthens it or reverses it outright.
  function advanceTime (i, st) {
    var s = st || S()
    var a = A()
    return (a.ADV_TIME + a.ADV_RING_TIME * ringOf[Math.floor(i)]) / mult(s, 'advanceSpeed', 1)
  }

  // You only push where you actually are: on ground you hold, that is its hyphal density; on
  // ground you are advancing into, it is the front. Everywhere else it is nothing — a rival on the
  // far side of the map must not decay because you exist. `prospective` answers the card's
  // question instead of the tick's: *what would happen if I started this advance now.*
  function yourPressure (i, st, prospective) {
    var s = st || S()
    var r = s.a2.regions
    var own
    if (r.flags[i] & RF_CLAIMED) own = C().clamp(num(r.d[i]), 0, 1)
    else if ((r.flags[i] & RF_ADVANCING) || prospective) own = ADV_FRONT
    else own = 0
    if (!(own > 0)) return 0
    var p = own * mult(s, 'antibiosis', 1) * (1 + CONTEST_NBR * claimedNeighbours(i, s))
    if (r.rival[i] === PHELLINUS) p *= PHELLINUS_RESIST
    var repel = HY.cognition && HY.cognition.pulseEffect ? num(HY.cognition.pulseEffect('REPEL', i)) : 0
    if (repel > 0) p *= (1 + REPEL_YOURS * repel)
    return p
  }

  function theirPressure (i, st) {
    var s = st || S()
    var r = s.a2.regions
    if (r.rival[i] < 0) return 0
    var p = C().clamp(num(r.rivalStr[i]), 0, 1) *
      RIVALS[r.rival[i] % RIVALS.length].agg *
      TERRAIN_RIVAL[r.terrain[i] % TERRAIN_RIVAL.length]
    var repel = HY.cognition && HY.cognition.pulseEffect ? num(HY.cognition.pulseEffect('REPEL', i)) : 0
    if (repel > 0) p *= (1 - REPEL_THEIRS * repel)
    return p
  }

  // Why an ADVANCE is refused, as a string the card prints. Never a silent no.
  function advanceBlocked (i, st) {
    var s = st || S()
    var r = s.a2.regions
    if (!(i >= 0 && i < nreg)) return 'no such stand'
    if (s.act !== 2) return 'not now'
    if (!flagOn(s, 'chemotaxis')) return 'no gradient'
    if (r.flags[i] & RF_CLAIMED) return 'held'
    if (r.flags[i] & RF_ADVANCING) return 'advancing'
    if (!(r.flags[i] & RF_DISCOVERED)) return 'unknown'
    if (advancingCount(s) >= advanceSlots(s)) return 'no slot'
    var entry = bestEntry(i, s)
    if (!entry) return 'not adjacent'
    if (entry.blocked) return 'barrier'
    return null
  }

  function startAdvance (i) {
    var s = S()
    i = Math.floor(i)
    var why = advanceBlocked(i, s)
    if (why) {
      if (why === 'barrier') { stat(s, 'barrierBlocks', 1); fire('a2.barrier') }
      if (why) feel('deny', { region: i })
      return false
    }
    var r = s.a2.regions
    r.flags[i] |= RF_ADVANCING
    if (!(num(r.col[i]) > 0)) r.col[i] = 0
    return true
  }

  // §3 has no escrow key and this file is right not to invent one, so an advance is paid for by
  // the metre rather than up front: `cost × Δcolonisation` every tick, out of held biomass. Three
  // things fall out of that and all three are good. A refund is a fact about visible state instead
  // of a hidden ledger; an advance you cannot feed *stalls* rather than completing on credit, so
  // six slots is a budget decision and not a free win; and the price you pay is the price on the
  // card at the moment you pay it.
  function cancelAdvance (i) {
    var s = S()
    i = Math.floor(i)
    var r = s.a2.regions
    if (!(i >= 0 && i < nreg) || !(r.flags[i] & RF_ADVANCING)) return false
    var back = ADV_CANCEL_REFUND * C().clamp(num(r.col[i]), 0, 1) * advanceCost(i, s)
    r.flags[i] &= ~RF_ADVANCING
    r.col[i] = 0
    C().setStock(s.res, 'biomass', num(s.res.biomass) + back)
    return back
  }

  function completeClaim (s, i) {
    var r = s.a2.regions
    r.flags[i] |= RF_CLAIMED | RF_DISCOVERED
    r.flags[i] &= ~RF_ADVANCING
    r.col[i] = 1
    if (num(r.d[i]) < CLAIM_D) r.d[i] = CLAIM_D
    // Displacing a rival ends the contest; Fomitopsis leaves the ground better than it found it.
    if (r.rival[i] >= 0) {
      if (r.rival[i] === FOMITOPSIS) r.h[i] = C().clamp(num(r.h[i]) + FOMITOPSIS_HUMUS, 0, 1)
      r.rival[i] = -1
      r.rivalStr[i] = 0
    }
    stat(s, 'claimedCount', 1)
    discover(s)
    fire('a2.first_claim', { region: regionName(i) })
    feel('claim', { region: i })
  }

  function loseClaim (s, i) {
    var r = s.a2.regions
    r.flags[i] &= ~(RF_CLAIMED | RF_ADVANCING)
    r.col[i] = 0
    var strain = r.rival[i] >= 0 ? RIVALS[r.rival[i] % RIVALS.length].name : 'the forest'
    fire('a2.rival_take', { region: regionName(i), strain: strain })
    feel('fail', { region: i })
  }

  // BIBLE §4 step 10. Colonisation, in one pass: advances in flight are paid for and moved, held
  // ground under contest is defended or lost.
  function stepColonisation (dt, o) {
    var s = S()
    if (!s || s.act !== 2 || !(dt > 0)) return
    var r = s.a2.regions, i
    var opts = o || {}
    for (i = 0; i < nreg; i++) {
      var isAdv = !!(r.flags[i] & RF_ADVANCING)
      var isMine = !!(r.flags[i] & RF_CLAIMED)
      if (!isAdv && !isMine) continue
      if (isMine && r.rival[i] < 0) { r.col[i] = 1; continue }   // nothing is happening here

      var net = yourPressure(i, s) - theirPressure(i, s)
      var rate = net / advanceTime(i, s)
      var dcol = rate * dt

      if (isAdv && dcol > 0) {
        // Pay by the metre. A shortfall slows the advance rather than stopping it dead, which is
        // what the biomass bar on the card is showing you.
        var cost = advanceCost(i, s)
        var want = cost * dcol
        var have = num(s.res.biomass)
        if (want > have) { dcol *= have > 0 ? have / want : 0; want = have }
        if (want > 0) C().setStock(s.res, 'biomass', have - want)
      }
      if (!(dcol === dcol)) dcol = 0
      var col = C().clamp(num(r.col[i]) + dcol, 0, 1)
      // BIBLE P5: nothing is lost while you are away. A contest on ground you hold runs down to a
      // floor and stops, so twelve hours away costs you a stand that needs a decision rather than
      // a stand that is gone — which is what `02` §14.5's return burst is for.
      if (isMine && opts.offline && col < OFFLINE_HOLD_FLOOR) col = Math.min(OFFLINE_HOLD_FLOOR, num(r.col[i]))
      r.col[i] = col
      if (isAdv && col >= 1 - EPS) completeClaim(s, i)
      else if (isMine && col <= EPS) loseClaim(s, i)
    }
    // Discovery is information, not a decision, so it runs offline too: a player who comes back to
    // a completed advance must come back to the frontier it opened.
    discover(s)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SPORE SEEDING — `02` §7.9
  // ───────────────────────────────────────────────────────────────────────────

  // Downwind of *any* region you hold, within one hex direction of the current wind.
  function downwind (i, st) {
    var s = st || S()
    if (flagOn(s, 'ballistospory')) return true
    var r = s.a2.regions, j
    var a = num(s.a2.windDir)
    var wx = Math.cos(a), wy = Math.sin(a)
    var tx = px(r, i), ty = py(r, i)
    var arc = Math.cos(SEED_ARC)
    for (j = 0; j < nreg; j++) {
      if (!(r.flags[j] & RF_CLAIMED)) continue
      var dx = tx - px(r, j), dy = ty - py(r, j)
      var len = Math.sqrt(dx * dx + dy * dy)
      if (!(len > 0)) continue
      if ((dx * wx + dy * wy) / len >= arc) return true
    }
    return false
  }

  function seedCost (i, st) {
    var s = st || S()
    var a = A()
    i = Math.floor(i)
    var r = s.a2.regions
    return a.SEED_BASE *
      Math.pow(a.SEED_GROWTH, num(s.stats.seededCount)) *
      (1 + SEED_RING * ringOf[i]) *
      (1 + SEED_RIVAL * C().clamp(num(r.rivalStr[i]), 0, 1)) *
      (num(s.a2.windSpeed) >= SEED_WIND_FAST ? SEED_WIND_DISCOUNT : 1)
  }

  function seedBlocked (i, st) {
    var s = st || S()
    var r = s.a2.regions
    if (!(i >= 0 && i < nreg)) return 'no such stand'
    if (s.act !== 2) return 'not now'
    if (!flagOn(s, 'anemophily')) return 'no wind sense'
    if (r.flags[i] & RF_CLAIMED) return 'held'
    if (r.flags[i] & RF_ADVANCING) return 'advancing'
    if (!(r.flags[i] & RF_DISCOVERED)) return 'unknown'
    if (advancingCount(s) >= advanceSlots(s)) return 'no slot'
    if (!downwind(i, s)) return 'upwind'
    if (num(s.res.spores) < seedCost(i, s)) return 'not enough spores'
    return null
  }

  // Seeding is the only way across a barrier before Bridging Strands, and it is the verb that
  // *lowers* C: a stand on the far side of the road is a node with no edges.
  function sporeSeed (i) {
    var s = S()
    i = Math.floor(i)
    if (seedBlocked(i, s)) { feel('deny', { region: i }); return false }
    var r = s.a2.regions
    var cost = seedCost(i, s)
    C().setStock(s.res, 'spores', num(s.res.spores) - cost)
    stat(s, 'seededCount', 1)
    r.flags[i] |= RF_DISCOVERED | RF_ADVANCING
    r.col[i] = C().clamp(num(r.col[i]) + SEED_COL * (1 - C().clamp(num(r.rivalStr[i]), 0, 1)), 0, 1)
    announceRival(s, i)
    fire('a2.spore_land', { region: regionName(i) })
    feel('claim', { region: i })
    return true
  }

  // The third spore sink of `02` §7.8: pressure bought outright. Sixty seconds of
  // 0.00012·spores^0.55, integrated into one push, because a per-region timer would need a key §3
  // does not have and the integral is the thing the player is buying anyway.
  function sporeContest (i, n) {
    var s = S()
    i = Math.floor(i)
    if (!s || s.act !== 2 || !(i >= 0 && i < nreg)) return 0
    var r = s.a2.regions
    if (r.rival[i] < 0) return 0
    n = Math.min(num(n), num(s.res.spores))
    if (!(n > 0)) return 0
    C().setStock(s.res, 'spores', num(s.res.spores) - n)
    var push = SPORE_CONTEST_K * Math.pow(n, SPORE_CONTEST_EXP)
    r.col[i] = C().clamp(num(r.col[i]) + push, 0, 1)
    return push
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HYPHAL DENSITY — `02` §6.10, 08 §4.5
  // ───────────────────────────────────────────────────────────────────────────

  function densStep (i, st) {
    var s = st || S()
    return Math.round(C().clamp(num(s.a2.regions.d[i]), 0, 1) / DENS_STEP)
  }

  function densityStepCost (i, k, st) {
    var s = st || S()
    i = Math.floor(i)
    if (k === undefined || k === null) k = densStep(i, s)
    var d = C().clamp(k * DENS_STEP, 0, 1 - DENS_STEP)
    return DENS_FIRST_FRAC * num(s.a2.regions.L0[i]) * Math.pow(1 - d, -A().DENS_POLE_EXP)
  }

  function densityStepMinerals (i, k, st) {
    var s = st || S()
    i = Math.floor(i)
    if (k === undefined || k === null) k = densStep(i, s)
    var d = C().clamp(k * DENS_STEP, 0, 1 - DENS_STEP)
    return DENS_MIN_A * Math.pow(1 - d, -A().DENS_POLE_EXP) * (1 + DENS_MIN_RING * ringOf[i])
  }

  // Trichoderma is a mycoparasite: it does not take your ground, it taxes what you put into it.
  function densityGainMult (i, st) {
    var s = st || S()
    var r = s.a2.regions, k, j
    for (k = 0; k < 6; k++) {
      j = adj[i * 6 + k]
      if (j >= 0 && r.rival[j] === TRICHODERMA && num(r.rivalStr[j]) > 0.05) return TRICHO_D_GAIN
    }
    return 1
  }

  function buyDensity (i) {
    var s = S()
    i = Math.floor(i)
    if (!s || s.act !== 2 || !(i >= 0 && i < nreg)) return false
    var r = s.a2.regions
    if (!(r.flags[i] & RF_CLAIMED)) return false
    var k = densStep(i, s)
    if (k >= Math.round(1 / DENS_STEP)) return false
    var g = densityStepCost(i, k, s), m = densityStepMinerals(i, k, s)
    if (num(s.res.biomass) < g || num(s.res.minerals) < m) { feel('deny', { region: i }); return false }
    C().setStock(s.res, 'biomass', num(s.res.biomass) - g)
    C().setStock(s.res, 'minerals', num(s.res.minerals) - m)
    r.d[i] = C().clamp(num(r.d[i]) + DENS_STEP * densityGainMult(i, s), 0, 1)
    stat(s, 'densityBuys', 1)
    feel('buy', { region: i })
    if (HY.log && HY.log.bought) HY.log.bought('density')
    return true
  }

  function densityTargets () {
    if (!densTarget) densTarget = Float32Array.from(DENS_TARGET_DEFAULT)
    return densTarget
  }

  function setDensityTarget (terrain, value) {
    var t = densityTargets()
    terrain = Math.floor(terrain)
    if (!(terrain >= 0 && terrain < t.length)) return false
    t[terrain] = C().clamp(num(value), 0, 1)
    return true
  }

  function setExpansionPolicy (name) {
    if (EXPANSION_POLICIES.indexOf(name) < 0) return false
    expansionPolicy = name
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RIVALS — `02` §8.2, §8.3
  // ───────────────────────────────────────────────────────────────────────────

  function stepRivals (dt, o) {
    var s = S()
    if (!s || s.act !== 2 || !(dt > 0)) return
    var r = s.a2.regions, i, k, j
    // Adversity accrues at TUNE.OFFLINE.STRAIN_MULT while you are away — the same 0.35 the Pact
    // Book applies to strain, for the same reason: the world may keep moving, but it may not use
    // your absence to win.
    var away = (o && o.offline) ? T().OFFLINE.STRAIN_MULT : 1

    for (i = 0; i < nreg; i++) {
      if (r.rival[i] < 0) continue
      var strain = RIVALS[r.rival[i] % RIVALS.length]
      var R = C().clamp(num(r.rivalStr[i]), 0, 1)
      var d = C().clamp(num(r.d[i]), 0, 1)
      // Logistic in its own occupancy, throttled by your density, pushed back by your pressure.
      // At d = 1 the growth term vanishes outright: a stand you have actually invested in cannot
      // be taken, which is what makes "losing is reversible by investment" true rather than kind.
      var dR = strain.gamma * away * R * (1 - R) * (1 - d) - RIVAL_PUSHBACK * yourPressure(i, s)
      r.rivalStr[i] = C().clamp(R + dR * dt, 0, 1)
      // A contest that reaches zero is over, on your ground and on empty ground alike: an amber bar
      // reading 0% forever is a card telling the player something is happening when nothing is.
      if (r.rivalStr[i] <= 0) r.rival[i] = -1

      // Trichoderma decays your density in what it neighbours.
      if (r.rival[i] === TRICHODERMA && r.rivalStr[i] > 0) {
        for (k = 0; k < 6; k++) {
          j = adj[i * 6 + k]
          if (j < 0 || !(r.flags[j] & RF_CLAIMED)) continue
          r.d[j] = C().clamp(num(r.d[j]) - TRICHO_D_DECAY * r.rivalStr[i] * dt, 0, 1)
        }
      }
    }

    // Retake: a stand you stopped maintaining is a stand a neighbour walks into. This is the
    // territorial price of strip-mining, and it is charged where the player can see it.
    for (i = 0; i < nreg; i++) {
      if (!(r.flags[i] & RF_CLAIMED) || r.rival[i] >= 0) continue
      if (num(r.d[i]) >= RETAKE_D) continue
      for (k = 0; k < 6; k++) {
        j = adj[i * 6 + k]
        if (j < 0 || r.rival[j] < 0 || (r.flags[j] & RF_CLAIMED)) continue
        if (num(r.rivalStr[j]) < SPREAD_FROM) continue
        r.rival[i] = r.rival[j]
        r.rivalStr[i] = RETAKE_SEED
        break
      }
    }
  }

  // The slow half: spread into the empty forest ahead of you. Barriers do not stop rivals.
  function stepSpread (dts, o) {
    var s = S()
    var r = s.a2.regions, i, k, j
    var away = (o && o.offline) ? T().OFFLINE.STRAIN_MULT : 1
    for (i = 0; i < nreg; i++) {
      if (r.rival[i] < 0 || num(r.rivalStr[i]) <= SPREAD_FROM) continue
      var strain = RIVALS[r.rival[i] % RIVALS.length]
      for (k = 0; k < 6; k++) {
        j = adj[i * 6 + k]
        if (j < 0) continue
        if (r.flags[j] & (RF_CLAIMED | RF_ADVANCING)) continue
        if (r.rival[j] >= 0 && r.rival[j] !== r.rival[i]) continue
        if (r.rival[j] < 0) r.rival[j] = r.rival[i]
        r.rivalStr[j] = C().clamp(num(r.rivalStr[j]) + SPREAD_K * strain.gamma * away * dts, 0, 1)
        if (r.flags[j] & RF_DISCOVERED) announceRival(s, j)
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // AUTOMATION — `02` §11.1 and §11.4. Chores only, at a published margin.
  // ───────────────────────────────────────────────────────────────────────────

  function autoDensity (s) {
    if (!flagOn(s, 'turgor_regulation')) return
    var r = s.a2.regions, i
    var t = densityTargets()
    var budget = AUTO_DENS_BUDGET * num(s.res.biomass)
    var best = -1, bestCost = Infinity
    for (i = 0; i < nreg; i++) {
      if (!(r.flags[i] & RF_CLAIMED)) continue
      var k = densStep(i, s)
      if (k * DENS_STEP >= t[r.terrain[i] % t.length] - EPS) continue
      var g = densityStepCost(i, k, s)
      if (g > budget || g >= bestCost) continue
      if (num(s.res.minerals) < densityStepMinerals(i, k, s)) continue
      best = i; bestCost = g
    }
    if (best >= 0) buyDensity(best)
  }

  function autoAdvance (s, offline) {
    if (!flagOn(s, 'rhizomorph_highways')) return
    if (advancingCount(s) >= advanceSlots(s)) return
    var r = s.a2.regions, i
    var budget = AUTO_ADV_BUDGET * num(s.res.biomass)
    var sh = netShape(s)
    var c0 = fromShape(sh.nodes, sh.edges)
    var best = -1, bestScore = -Infinity
    for (i = 0; i < nreg; i++) {
      if (advanceBlocked(i, s)) continue
      // Never start a fight the front cannot win: an advance at net-negative pressure sits in a
      // slot forever at zero progress, and an automation that does that is worse than no
      // automation. Deciding to fight for a contested stand anyway stays the player's to make.
      if (yourPressure(i, s, true) <= theirPressure(i, s)) continue
      var cost = advanceCost(i, s)
      if (cost > budget) continue
      var score
      if (expansionPolicy === 'rich') score = num(r.L0[i]) / cost
      else if (expansionPolicy === 'contested') score = (r.rival[i] >= 0 ? 1 : 0) + claimedNeighbours(i, s) / 6
      else score = connectivityIf(i, sh, s) - c0 + claimedNeighbours(i, s) * 1e-3
      if (score > bestScore) { bestScore = score; best = i }
    }
    if (best >= 0 && !offline) startAdvance(best)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PULSE — the one continuous effect this module cannot read back out of cognition
  // ───────────────────────────────────────────────────────────────────────────

  // RECRUIT lands instantly on every advance in flight. REPEL and SURGE are windows and are read
  // through cognition.pulseEffect() at the point of use, so a build without them costs nothing.
  function onPulse (ev) {
    if (!ev || ev.mode !== 'RECRUIT') return
    var s = S()
    if (!s || s.act !== 2) return
    var r = s.a2.regions, i
    for (i = 0; i < nreg; i++) {
      if (!(r.flags[i] & RF_ADVANCING)) continue
      var str = HY.cognition && HY.cognition.pulseStrength
        ? num(HY.cognition.pulseStrength(ev.epicentre, i))
        : Math.pow(A().PULSE_FALLOFF, hexDist(ev.epicentre, i))
      r.col[i] = C().clamp(num(r.col[i]) + RECRUIT_COL * str, 0, 1)
      if (r.col[i] >= 1 - EPS) completeClaim(s, i)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BIBLE §4 STEP 10
  // ───────────────────────────────────────────────────────────────────────────

  function step (dt, o) {
    var s = S()
    if (!s || s.act !== 2 || !(dt > 0)) return
    if (!adj || nreg !== s.a2.regions.q.length) init(s)
    if (lastAct !== 2) { lastAct = 2; slowAt = num(s.t); enter(s) }
    var opts = o || { stochastic: true, offline: false }

    stepRivals(dt, opts)
    stepColonisation(dt, opts)

    // The 0.5 Hz strategic pass, keyed to simulated time so an offline macro-step of 120 s runs it
    // once with the right dt rather than 60 times with the wrong one.
    if (s.t >= slowAt) {
      var dts = Math.min(Math.max(AUTO_SLOW_S, s.t - slowAt + AUTO_SLOW_S), A().TERM_PERIOD_S)
      slowAt = s.t + AUTO_SLOW_S
      stepSpread(dts, opts)
      // BIBLE §4 step 10: offline, new advances do not start unless the highways project is owned,
      // and no density is bought unless the automation is. Expansion is a decision.
      if (!opts.offline || flagOn(s, 'turgor_regulation')) autoDensity(s)
      autoAdvance(s, opts.offline && !flagOn(s, 'rhizomorph_highways'))
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE VIEW MODEL — one card, 390 px wide, four controls (`02` §15.3)
  //
  // The panel is a renderer: everything it needs to draw a stand, including *why* a button is
  // disabled and what claiming would do to C, is computed here so no formula lives in ui.js.
  // ───────────────────────────────────────────────────────────────────────────

  function speciesText (i, st) {
    var s = st || S()
    var r = s.a2.regions
    var a = SPECIES_NAME[r.sp0[i] % NSPECIES], b = SPECIES_NAME[r.sp1[i] % NSPECIES]
    return num(r.w0[i]) >= 0.90 ? a : a + '/' + b
  }

  function card (i, st, shape) {
    var s = st || S()
    i = Math.floor(i)
    if (!s || !s.a2 || !(i >= 0 && i < nreg)) return null
    var sh = shape || netShape(s)
    var r = s.a2.regions
    var isDisc = !!(r.flags[i] & RF_DISCOVERED)
    var isSurv = !!(r.flags[i] & RF_SURVEYED)
    var isMine = !!(r.flags[i] & RF_CLAIMED)
    var out = {
      id: i,
      name: isDisc ? regionName(i) : '',
      ring: ringOf[i],
      discovered: isDisc,
      surveyed: isSurv,
      claimed: isMine,
      advancing: !!(r.flags[i] & RF_ADVANCING),
      necrotized: !!(r.flags[i] & RF_NECROTIZED),
      terrain: isDisc ? TERRAIN_NAME[r.terrain[i] % NTERRAIN] : '',
      species: isDisc ? speciesText(i, s) : '',
      neighbours: claimedNeighbours(i, s),
      col: C().clamp(num(r.col[i]), 0, 1),
      d: C().clamp(num(r.d[i]), 0, 1),
      h: num(r.h[i]),
      L: num(r.L[i]), L0: num(r.L0[i]),
      litterFrac: num(r.L0[i]) > 0 ? C().clamp(num(r.L[i]) / num(r.L0[i]), 0, 1) : 0,
      band: isSurv ? null : band(i, num(r.L[i])),
      rival: null,
      advance: null,
      seed: null,
      density: null
    }
    if (r.rival[i] >= 0 && isDisc) {
      var strain = RIVALS[r.rival[i] % RIVALS.length]
      out.rival = {
        id: r.rival[i], name: strain.name, key: strain.key,
        strength: C().clamp(num(r.rivalStr[i]), 0, 1),
        yours: yourPressure(i, s, true), theirs: theirPressure(i, s)
      }
      out.rival.winning = out.rival.yours > out.rival.theirs
    }
    if (!isMine && isDisc) {
      var why = advanceBlocked(i, s)
      var net = yourPressure(i, s, true) - theirPressure(i, s)
      out.advance = {
        cost: advanceCost(i, s),
        seconds: net > 0 ? advanceTime(i, s) / net : Infinity,
        blocked: why,
        barrier: !!(bestEntry(i, s) || {}).barrier,
        // The number that makes the map a decision: what this claim does to the network's shape.
        connFrom: fromShape(sh.nodes, sh.edges),
        connTo: connectivityIf(i, sh, s)
      }
      var why2 = seedBlocked(i, s)
      out.seed = { cost: seedCost(i, s), blocked: why2, downwind: why2 !== 'upwind' }
    }
    if (isMine) {
      var k = densStep(i, s)
      out.density = k >= Math.round(1 / DENS_STEP) ? null : {
        step: k,
        next: (k + 1) * DENS_STEP,
        cost: densityStepCost(i, k, s),
        minerals: densityStepMinerals(i, k, s),
        taxed: densityGainMult(i, s) < 1
      }
    }
    return out
  }

  // The STANDS list, already ordered the way a thumb wants it: what you hold, then what is moving,
  // then the frontier by how much it would help, then the fog.
  function list (st) {
    var s = st || S()
    var out = [], i
    if (!s || !s.a2) return out
    var sh = netShape(s)
    for (i = 0; i < nreg; i++) {
      var c = card(i, s, sh)
      if (c && c.discovered) out.push(c)
    }
    out.sort(function (a, b) {
      var ra = rank(a), rb = rank(b)
      if (ra !== rb) return ra - rb
      if (ra === 2) return (b.advance.connTo - b.advance.connFrom) - (a.advance.connTo - a.advance.connFrom)
      return a.id - b.id
    })
    return out
  }

  function rank (c) {
    if (c.advancing) return 0
    if (c.claimed) return 1
    if (!c.advance || !c.advance.blocked) return 2
    return 3
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE LIFECYCLE
  // ───────────────────────────────────────────────────────────────────────────

  function init (s) {
    s = s || S()
    if (!s || !s.a2) return
    nreg = s.a2.regions.q.length
    // The index and the ring table are geometry, not save data: rebuild them before anything can
    // ask for a neighbour.
    ensureGen(s)
    // Act III has already destroyed the board. Regenerating it would resurrect the map ASCOSPORE
    // deleted, which is the one thing a transition must never do.
    if (s.act < 3 && !generated(s)) worldgen(s.seed)
    contacted = new Uint8Array(nreg)
    var r = s.a2.regions, i
    for (i = 0; i < nreg; i++) {
      if (r.flags[i] & RF_CLAIMED) r.col[i] = 1
      // A save written before this module existed has rival[] full of zeroes, which reads as
      // "Armillaria everywhere". −1 is the only honest value for empty ground.
      if (!generated(s) && r.rivalStr[i] <= 0) r.rival[i] = -1
      // A discovered rival already spoke in the run that wrote this save. Marking it
      // contacted keeps "once, and never again" true across reloads — announcing it
      // again here would re-fire its line and re-count stats.rivalContacts on every
      // boot and every import, and an import must never mutate the save (D37).
      if ((r.flags[i] & RF_DISCOVERED) && r.rival[i] >= 0) contacted[i] = 1
    }
    lastAct = s.act
    if (s.act === 2) enter(s)
    slowAt = num(s.t)
    densTarget = Float32Array.from(DENS_TARGET_DEFAULT)
    expansionPolicy = 'compact'
  }

  // Entering Act II. DECIDE flips the act mid-run without calling init, so this is driven from
  // step() the first tick the act is 2 as well as from a cold boot into a mid-act save.
  function enter (s) {
    discover(s)
    // DECIDE hands Act II one claimed region without touching the counter, and log.js's first-claim
    // line is written against "claimed == 2" — the core plus the first advance. Seeding the counter
    // once, and only from zero, makes `02` §3's beat 3 land on the advance the player actually made.
    if (!num(s.stats.claimedCount)) s.stats.claimedCount = claimedCount(s)
  }

  // forest.ascospore() calls this after it has zeroed the board.
  function reboot () {
    gen = null; genSeed = -1; names = null; contacted = null
    slowAt = 0; lastAct = 0
  }

  // loop.js drives step() directly, in BIBLE §4's order; this exists for a harness holding the
  // module on its own, and the loop never calls it.
  function tick (s, dt, o) { void s; step(dt, o) }

  function serialise () { return null }        // every persistent byte lives in §3's a2.regions
  function migrate () { return true }

  // ───────────────────────────────────────────────────────────────────────────
  // SELFTEST
  // ───────────────────────────────────────────────────────────────────────────

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }
    function near (got, want, tol, label) {
      if (!(Math.abs(got - want) <= tol)) f.push(label + ': got ' + got + ', want ' + want + ' ±' + tol)
    }
    function within (got, lo, hi, label) {
      if (!(got >= lo && got <= hi)) f.push(label + ': got ' + got + ', want ' + lo + '–' + hi)
    }

    // A cold Act II board: state, then this module's shape, then forest's L0/T0 renormalised onto
    // it — which is loop.js's init order and the only order in which L0 exists at all.
    function cold (seedN) {
      HY.state.init(HY.state.newGame(seedN, null))
      var st = S()
      st.act = 2
      init(st)
      if (HY.forest && HY.forest.init) HY.forest.init(st)
      return st
    }

    var keep = HY.state.exportB64()
    try {
      var a = A(), i, j, k, s, seedN, n

      // ── geometry ─────────────────────────────────────────────────────────
      var coords = spiral(RINGS)
      ok(coords.length === a.REGIONS, 'the spiral is not 61 hexes: ' + coords.length)
      var seenXY = {}
      for (i = 0; i < coords.length; i++) {
        var kk = coords[i][0] + ',' + coords[i][1]
        ok(!seenXY[kk], 'duplicate hex at ' + kk)
        seenXY[kk] = 1
        ok(ringAt(coords[i][0], coords[i][1]) <= RINGS, 'a hex escaped ring 4')
        ok(Math.abs(coords[i][0]) <= 127 && Math.abs(coords[i][1]) <= 127, 'q/r overflow Int8')
      }
      var bands = [0, 0, 0, 0, 0]
      for (i = 0; i < coords.length; i++) bands[ringAt(coords[i][0], coords[i][1])]++
      ok(bands.join(',') === '1,6,12,18,24', 'ring sizes are ' + bands.join(','))
      // Index bands must reproduce the spiral, or forest.js's fallback ring differs from ours.
      var acc = 0
      for (i = 0; i < 5; i++) {
        for (j = acc; j < acc + bands[i]; j++) {
          ok(ringAt(coords[j][0], coords[j][1]) === i, 'index ' + j + ' is not in ring ' + i)
        }
        acc += bands[i]
      }

      // ── worldgen, over many seeds: the guarantees are guarantees ─────────
      for (seedN = 1; seedN <= 40; seedN++) {
        var g = genMap(seedN * 7919)
        var counts = [0, 0, 0, 0, 0, 0]
        for (i = 0; i < g.n; i++) counts[g.terrain[i]]++
        ok(g.terrain[0] === LOAM, 'seed ' + seedN + ': ring 0 is not Loam')
        ok(counts[SCREE] >= MIN_SCREE, 'seed ' + seedN + ': only ' + counts[SCREE] + ' Scree')
        ok(counts[PEAT] >= MIN_PEAT, 'seed ' + seedN + ': only ' + counts[PEAT] + ' Peat')
        ok(counts[BURN] === 0, 'seed ' + seedN + ': Burn exists at worldgen')
        var clump = 0, barr = 0, seats = 0, strains = {}
        for (i = 0; i < g.n; i++) {
          if (sameNeighbours(g.terrain, i) > MAX_SAME_NEIGHBOURS) clump++
          var open = 0, mask = 0
          for (k = 0; k < 6; k++) {
            j = adj[i * 6 + k]
            if (j < 0) continue
            if (g.barriers[i] & (1 << k)) {
              mask++
              // Symmetry: generate once, write both sides.
              ok(!!(g.barriers[j] & (1 << dirTo(j, i))), 'seed ' + seedN + ': asymmetric barrier')
            } else open++
          }
          barr += mask
          ok(open >= 2, 'seed ' + seedN + ': region ' + i + ' is walled in')
          if (g.rival[i] >= 0) {
            seats++
            strains[g.rival[i]] = 1
            ok(ringOf[i] >= 2, 'seed ' + seedN + ': a rival sits inside ring 2')
            within(g.rivalStr[i], RIVAL_R_MIN, RIVAL_R_MIN + RIVAL_R_SPAN, 'seed ' + seedN + ': rivalStr')
          }
          ok(g.w0[i] >= MIX_MIN - 1e-6 && g.w0[i] <= MIX_MIN + MIX_SPAN + 1e-6,
            'seed ' + seedN + ': species weight out of range')
          ok(g.sp0[i] !== g.sp1[i], 'seed ' + seedN + ': a stand is a mix of one species')
        }
        ok(clump === 0, 'seed ' + seedN + ': ' + clump + ' regions have >2 same-terrain neighbours')
        ok(seats === RIVAL_SEATS, 'seed ' + seedN + ': ' + seats + ' rival seats, want 9')
        ok(Object.keys(strains).length === RIVALS.length,
          'seed ' + seedN + ': only ' + Object.keys(strains).length + ' strains placed')
        // Three chains of 5–9 edges, written on both sides: 30–54 bits before overlaps, and two
        // chains that cross share an edge, so the floor is a little lower than 3×5×2.
        within(barr, 24, 54, 'seed ' + seedN + ': barrier bits')
      }

      // Determinism: the same seed must reproduce the same forest, forever (§3).
      var g1 = genMap(4242), g2 = genMap(4242), g3 = genMap(4243)
      var same = true, diff = false
      for (i = 0; i < g1.n; i++) {
        if (g1.terrain[i] !== g2.terrain[i] || g1.barriers[i] !== g2.barriers[i] ||
            g1.rival[i] !== g2.rival[i] || g1.sp0[i] !== g2.sp0[i]) same = false
        if (g1.terrain[i] !== g3.terrain[i]) diff = true
      }
      ok(same, 'the same seed did not reproduce the same forest')
      ok(diff, 'two different seeds produced the same terrain')

      // ── the live board ───────────────────────────────────────────────────
      s = cold(4242)
      n = nreg
      ok(n === a.REGIONS, 'the live board is ' + n + ' regions')
      for (i = 0; i < n; i++) ok(s.a2.regions.rival[i] >= -1, 'rival id out of range')
      var held = 0
      for (i = 0; i < n; i++) if (s.a2.regions.rival[i] >= 0) held++
      ok(held === RIVAL_SEATS, 'the live board has ' + held + ' rival-held regions')

      // Names: stable, non-empty, and unmoved by the species mix changing under them (fire).
      var n17 = regionName(17)
      ok(!!n17 && n17.length > 2, 'regionName(17) is empty')
      ok(regionName(17) === n17, 'regionName is not stable within a session')
      s.a2.regions.sp0[17] = 2; s.a2.regions.w0[17] = 0.6
      names = null
      ok(regionName(17) === n17, 'a fire renamed the stand')
      var uniq = {}
      for (i = 0; i < n; i++) uniq[regionName(i)] = 1
      within(Object.keys(uniq).length, 45, 61, 'region names collide too often')

      // ── connectivity, `02` §4.2 ──────────────────────────────────────────
      var r = s.a2.regions
      for (i = 0; i < n; i++) { r.flags[i] = 0; r.col[i] = 0; r.d[i] = 0; r.rival[i] = -1; r.rivalStr[i] = 0 }
      r.barriers[0] = 0
      near(connectivity(s), a.CONN_MIN, 1e-12, 'C on an empty board is not 1.00')
      r.flags[0] |= RF_CLAIMED
      near(connectivity(s), 1.00, 1e-12, 'C on a single node is not 1.00')
      // A compact blob must beat a chain of the same size. Blob: the core and its six neighbours.
      var blob = [0], chain = [0]
      for (k = 0; k < 6; k++) blob.push(adj[k])
      var cur = 0
      for (k = 0; k < 6; k++) { cur = adj[cur * 6 + 0] >= 0 ? adj[cur * 6 + 0] : cur; chain.push(cur) }
      function claimOnly (ids) {
        var z
        for (z = 0; z < n; z++) { r.flags[z] &= ~RF_CLAIMED; r.barriers[z] = 0 }
        for (z = 0; z < ids.length; z++) r.flags[ids[z]] |= RF_CLAIMED
        return connectivity(s)
      }
      var cBlob = claimOnly(blob), cChain = claimOnly(chain)
      ok(cBlob > cChain, 'a compact blob (' + cBlob + ') did not beat a chain (' + cChain + ')')
      within(cBlob, 1.10, a.CONN_MAX, 'blob C')
      within(cChain, 1.00, 1.12, 'chain C')
      // The identity projects.js inverts must round-trip.
      var e = Math.pow(Math.max(0, (cBlob - 1) / a.CONN_K), 1 / a.CONN_EXP)
      near(1 + a.CONN_K * Math.pow(e, a.CONN_EXP), cBlob, 1e-9, 'C does not invert')
      // A barrier between two claimed regions removes an edge, and Bridging Strands restores it.
      claimOnly(blob)
      var cOpen = connectivity(s)
      r.barriers[0] |= 1
      r.barriers[adj[0]] |= (1 << dirTo(adj[0], 0))
      ok(connectivity(s) < cOpen, 'a barrier did not cost connectivity')
      s.proj.flags.bridging_strands = 1
      near(connectivity(s), cOpen, 1e-12, 'Bridging Strands did not restore the edge')
      delete s.proj.flags.bridging_strands
      r.barriers[0] = 0; r.barriers[adj[0]] = 0

      // ── the advance ──────────────────────────────────────────────────────
      s = cold(4242)
      r = s.a2.regions
      s.proj.flags.chemotaxis = 1
      for (i = 0; i < n; i++) { r.flags[i] = 0; r.col[i] = 0; r.rival[i] = -1; r.rivalStr[i] = 0; r.barriers[i] = 0 }
      r.flags[0] = RF_DISCOVERED | RF_SURVEYED | RF_CLAIMED
      r.d[0] = 0.30; r.col[0] = 1
      discover(s)
      ok(discovered(1, s), 'a neighbour of the core was not discovered')
      var target = adj[0]
      near(advanceCost(target, s), a.ADV_BASE * a.ADV_GROWTH * TERRAIN_ADV[r.terrain[target]] *
        (1 + a.ADV_RING_COST * 1), 1, 'advanceCost off 08 §4.4')
      // 08 §4.4's first-advance number, on the canonical ring-0 loam case.
      near(a.ADV_BASE, 6.00e5, 1, 'ADV_BASE moved')

      C().setStock(s.res, 'biomass', 1e9)
      ok(startAdvance(target) === true, 'startAdvance refused a legal advance')
      ok(startAdvance(target) === false, 'the same advance started twice')
      var other = -1
      for (k = 1; k < 6; k++) if (adj[k] >= 0 && adj[k] !== target) { other = adj[k]; break }
      ok(startAdvance(other) === false, 'a second advance started with one slot')
      s.proj.flags.rhizomorphs = 1
      ok(advanceSlots(s) === 3, 'Rhizomorphs did not open three slots')
      ok(startAdvance(other) === true, 'the second slot was refused')
      cancelAdvance(other)

      // The canonical single-neighbour advance takes exactly ADV_TIME, and the price is paid in
      // full across it — no more, no less.
      var before = num(s.res.biomass)
      var cost0 = advanceCost(target, s)
      var t0 = s.t, guard = 0
      while (!(r.flags[target] & RF_CLAIMED) && guard++ < 40000) {
        s.t += 0.05
        stepColonisation(0.05, { stochastic: false, offline: false })
      }
      near(s.t - t0, a.ADV_TIME + a.ADV_RING_TIME * 1, 0.35, 'a one-neighbour advance is not 49.5 s')
      near(before - num(s.res.biomass), cost0, cost0 * 0.02, 'the advance did not cost its price')
      ok(claimed(target, s), 'the advance did not land')
      ok(s.stats.claimedCount >= 1, 'claimedCount did not move')
      near(r.d[target], CLAIM_D, 1e-6, 'a landed advance did not leave its front behind as density')
      // `02` §3 beat 3: the claim lands and the Signal rate moves where the player can see it.
      // Territory is cognition, taught by a number changing rather than by a sentence.
      if (HY.cognition && HY.cognition.Sr && HY.forest && HY.forest.totalInterface) {
        var srAfter = num(HY.cognition.Sr())
        r.flags[target] &= ~RF_CLAIMED
        var srBefore = num(HY.cognition.Sr())
        r.flags[target] |= RF_CLAIMED
        ok(srAfter > srBefore * 1.20,
          'the first claim did not visibly move Sr: ' + srBefore.toFixed(2) + ' → ' + srAfter.toFixed(2))
      }

      // Adjacency is the decision the map is made of: the front's pressure is ADV_FRONT·(1+0.25·k)
      // and the canonical one-neighbour case is exactly 1.000, so a pocket lands faster than a
      // tendril and the published ADV_TIME is the truth for the case the player first meets.
      var lone = -1, pocket = -1
      for (i = 1; i < n; i++) {
        if (claimed(i, s)) continue
        var kn = claimedNeighbours(i, s)
        if (kn === 1 && lone < 0) lone = i
        if (kn >= 2 && pocket < 0) pocket = i
      }
      ok(lone >= 0, 'no single-neighbour frontier stand to measure')
      if (lone >= 0) near(yourPressure(lone, s, true), 1, 1e-9, 'a one-neighbour front is not 1.000')
      if (pocket >= 0) {
        near(yourPressure(pocket, s, true), ADV_FRONT * (1 + CONTEST_NBR * claimedNeighbours(pocket, s)),
          1e-9, 'front pressure is not ADV_FRONT·(1 + 0.25·claimedNeighbours)')
        ok(yourPressure(pocket, s, true) > yourPressure(lone, s, true),
          'a well-connected advance is not stronger than a lone tendril')
      }

      // Cancelling refunds 0.60 of what has been spent, and nothing more.
      var t2 = -1
      for (i = 1; i < n; i++) if (!advanceBlocked(i, s)) { t2 = i; break }
      if (t2 >= 0) {
        startAdvance(t2)
        var spend0 = num(s.res.biomass)
        for (k = 0; k < 200; k++) { s.t += 0.05; stepColonisation(0.05, {}) }
        var spent = spend0 - num(s.res.biomass)
        var col2 = r.col[t2]
        var refund = cancelAdvance(t2)
        near(refund, ADV_CANCEL_REFUND * spent, Math.max(1, spent * 0.05), 'the cancel refund is wrong')
        ok(col2 > 0 && r.col[t2] === 0, 'cancel did not clear the progress')
      }

      // An advance nobody can fund stalls instead of completing on credit.
      var t3 = -1
      for (i = 1; i < n; i++) if (!advanceBlocked(i, s)) { t3 = i; break }
      if (t3 >= 0) {
        startAdvance(t3)
        C().setStock(s.res, 'biomass', 0)
        for (k = 0; k < 400; k++) { s.t += 0.05; stepColonisation(0.05, {}) }
        ok(r.col[t3] < 0.02, 'an unfunded advance progressed anyway: ' + r.col[t3])
        cancelAdvance(t3)
      }

      // ── barriers block, and Bridging Strands unblocks ────────────────────
      var bi = -1
      for (i = 1; i < n && bi < 0; i++) {
        if ((r.flags[i] & RF_CLAIMED) || !(r.flags[i] & RF_DISCOVERED)) continue
        if (claimedNeighbours(i, s) > 0) bi = i
      }
      ok(bi >= 0, 'no frontier stand to wall off')
      if (bi >= 0) {
        // Every way in has to be blocked, or the advance simply comes round the other side — which
        // is itself the property being asserted.
        var walls = []
        for (k = 0; k < 6; k++) {
          j = adj[bi * 6 + k]
          if (j < 0 || !(r.flags[j] & RF_CLAIMED)) continue
          r.barriers[bi] |= (1 << k)
          r.barriers[j] |= (1 << dirTo(j, bi))
          walls.push(j)
        }
        var blocks0 = s.stats.barrierBlocks
        var openCost = advanceCost(bi, s) / BARRIER_COST
        ok(advanceBlocked(bi, s) === 'barrier', 'a barrier did not block the advance')
        ok(startAdvance(bi) === false, 'an advance crossed a barrier without Bridging Strands')
        ok(s.stats.barrierBlocks === blocks0 + 1, 'a blocked advance did not arm Bridging Strands')
        s.proj.flags.bridging_strands = 1
        ok(advanceBlocked(bi, s) === null, 'Bridging Strands did not open the edge')
        near(advanceCost(bi, s) / openCost, BARRIER_COST, 1e-9, 'the barrier crossing is not 2.40×')
        delete s.proj.flags.bridging_strands
        r.barriers[bi] = 0
        for (k = 0; k < walls.length; k++) r.barriers[walls[k]] = 0
      }

      // ── density ──────────────────────────────────────────────────────────
      ok(r.L0[0] > 0, 'forest.js has not seeded L0 — the density test is measuring nothing')
      near(densityStepCost(0, 0, s), DENS_FIRST_FRAC * r.L0[0], 1e-3, 'the first density step moved')
      // The pole is the design: 08 §4.5's prose figures (8.7×, 33×) are inconsistent with its own
      // −1.35, so the exponent is the authority and what is asserted is the property it exists for.
      near(densityStepCost(0, 9, s) / densityStepCost(0, 0, s), Math.pow(0.1, -a.DENS_POLE_EXP), 1e-6,
        'the density pole is not (1−d)^−1.35')
      ok(Math.pow(0.01, -a.DENS_POLE_EXP) / Math.pow(0.5, -a.DENS_POLE_EXP) > 20,
        'the last tenth of density is not the expensive one — no region is ever worth filling')
      var d0 = r.d[0]
      C().setStock(s.res, 'biomass', 1e12); C().setStock(s.res, 'minerals', 1e6)
      var buys0 = s.stats.densityBuys
      ok(buyDensity(0) === true, 'buyDensity refused an affordable step')
      near(r.d[0], d0 + DENS_STEP, 1e-6, 'the density step is not 0.1')
      ok(s.stats.densityBuys === buys0 + 1, 'densityBuys did not move — Turgor Regulation never arms')
      C().setStock(s.res, 'minerals', 0)
      ok(buyDensity(0) === false, 'density was bought without minerals')
      C().setStock(s.res, 'minerals', 1e6)
      ok(buyDensity(999) === false, 'buyDensity accepted a region that does not exist')

      // Full density on the whole board, in minerals, against the act's passive income. This is the
      // property that keeps Act I's contract book load-bearing at minute 180.
      var minTotal = 0
      for (i = 0; i < n; i++) for (k = 0; k < 10; k++) minTotal += densityStepMinerals(i, k, s)
      var passive = a.PASSIVE_MIN_K * Math.pow(45, a.PASSIVE_MIN_EXP) * 11880
      within(minTotal / passive, 0.5, 2.5, 'full density costs ' + (minTotal / passive) + '× the act mineral income')

      // ── rivals ───────────────────────────────────────────────────────────
      s = cold(4242); r = s.a2.regions
      var rid = -1
      for (i = 0; i < n; i++) if (r.rival[i] === PHELLINUS) { rid = i; break }
      ok(rid >= 0, 'no Phellinus on the board')
      // Phellinus sits on rich ground: it should be above the median stand.
      var shape = ensureGen(s).shape
      var better = 0
      for (i = 0; i < n; i++) if (shape[i] > shape[rid]) better++
      ok(better < n / 2, 'Phellinus is not on the good ground')

      // A rival you are not touching is a rival you are not touching. This is the difference
      // between a board that grows against you and a board that quietly clears itself.
      var idle = -1
      for (i = 0; i < n; i++) if (r.rival[i] >= 0 && claimedNeighbours(i, s) === 0) { idle = i; break }
      ok(idle >= 0, 'no rival stands away from the core to leave alone')
      if (idle >= 0) {
        var idle0 = r.rivalStr[idle]
        for (k = 0; k < 12000; k++) { s.t += 0.05; stepRivals(0.05, {}) }
        ok(r.rivalStr[idle] > idle0, 'a rival nobody is fighting decayed on its own')
        ok(yourPressure(idle, s) === 0, 'you exert pressure on ground you are not on')
      }

      // Pressure: your density decides the contest, and full density always evicts.
      var ri = -1
      for (i = 0; i < n; i++) if (r.rival[i] === ARMILLARIA) { ri = i; break }
      if (ri >= 0) {
        r.rivalStr[ri] = 0.60
        r.flags[ri] |= RF_CLAIMED | RF_DISCOVERED
        r.d[ri] = 1.0
        var R0 = r.rivalStr[ri]
        for (k = 0; k < 2000; k++) { s.t += 0.05; stepRivals(0.05, {}) }
        ok(r.rivalStr[ri] < R0, 'a fully colonised stand did not push the rival back')
        r.d[ri] = 0.0
        r.rivalStr[ri] = 0.30
        var R1 = r.rivalStr[ri]
        for (k = 0; k < 2000; k++) { s.t += 0.05; stepRivals(0.05, {}) }
        ok(r.rivalStr[ri] > R1, 'a stand at d = 0 did not lose ground')
      }

      // Retake: a claimed stand you stopped maintaining, next to a strong rival, is contested and
      // then lost — and re-claimable afterwards.
      s = cold(99); r = s.a2.regions
      var src = -1, victim = -1
      for (i = 0; i < n && victim < 0; i++) {
        if (r.rival[i] < 0) continue
        for (k = 0; k < 6; k++) {
          j = adj[i * 6 + k]
          if (j >= 0 && r.rival[j] < 0) { src = i; victim = j; break }
        }
      }
      ok(victim >= 0, 'no rival has a free neighbour to take')
      if (victim >= 0) {
        r.rivalStr[src] = 0.95
        r.flags[victim] |= RF_CLAIMED | RF_DISCOVERED
        r.col[victim] = 1
        r.d[victim] = 0.05
        var lost = false
        for (k = 0; k < 200000 && !lost; k++) {
          s.t += 0.05
          stepRivals(0.05, {})
          stepColonisation(0.05, {})
          if (!(r.flags[victim] & RF_CLAIMED)) lost = true
        }
        ok(lost, 'a stand at d = 0.05 next to a rival at R = 0.95 was never taken')
        ok(r.rival[victim] >= 0, 'the taker did not end up holding it')
        // Reversible by investment: put the density back and the contest turns around.
        r.d[victim] = 1.0
        r.flags[victim] |= RF_ADVANCING
        C().setStock(s.res, 'biomass', 1e14)
        for (k = 0; k < 200000 && !(r.flags[victim] & RF_CLAIMED); k++) {
          s.t += 0.05
          stepRivals(0.05, {})
          stepColonisation(0.05, {})
        }
        ok(!!(r.flags[victim] & RF_CLAIMED), 'a lost stand could not be retaken at full density')
        ok(r.rival[victim] < 0, 'retaking did not displace the rival')
      }

      // Spread: rivals grow into the empty forest, and never into ground you hold.
      s = cold(4242); r = s.a2.regions
      var seat = -1
      for (i = 0; i < n; i++) if (r.rival[i] === TRICHODERMA) { seat = i; break }
      if (seat >= 0) {
        r.rivalStr[seat] = 0.90
        var nb = neighbours(seat)
        for (k = 0; k < nb.length; k++) { r.rival[nb[k]] = -1; r.rivalStr[nb[k]] = 0 }
        r.flags[nb[0]] |= RF_CLAIMED
        stepSpread(2600)
        ok(r.rivalStr[nb[nb.length - 1]] > 0.05, 'a strong rival did not spread in 43 minutes')
        ok(r.rival[nb[0]] < 0, 'a rival spread into a claimed region')
      }

      // ── seeding ──────────────────────────────────────────────────────────
      s = cold(4242); r = s.a2.regions
      s.proj.flags.chemotaxis = 1
      for (i = 0; i < n; i++) { r.flags[i] = 0; r.col[i] = 0; r.rival[i] = -1; r.rivalStr[i] = 0 }
      r.flags[0] = RF_DISCOVERED | RF_CLAIMED; r.col[0] = 1; r.d[0] = 0.3
      discover(s)
      var far = -1
      for (i = 1; i < n; i++) if (ringOf[i] >= 2) { r.flags[i] |= RF_DISCOVERED; if (far < 0) far = i }
      ok(seedBlocked(far, s) === 'no wind sense', 'seeding was possible without Anemophily')
      s.proj.flags.anemophily = 1
      C().setStock(s.res, 'spores', 1e9)
      // Point the wind straight at the target so the geometry test is the thing being tested.
      s.a2.windDir = Math.atan2(py(r, far) - py(r, 0), px(r, far) - px(r, 0))
      ok(downwind(far, s) === true, 'a target dead downwind read as upwind')
      s.a2.windDir += Math.PI
      ok(downwind(far, s) === false || claimedNeighbours(far, s) > 0, 'an upwind target read as downwind')
      s.proj.flags.ballistospory = 1
      ok(downwind(far, s) === true, 'Ballistospory did not remove the wind constraint')
      delete s.proj.flags.ballistospory
      s.a2.windDir = Math.atan2(py(r, far) - py(r, 0), px(r, far) - px(r, 0))
      var sc0 = seedCost(far, s)
      var spores0 = num(s.res.spores)
      ok(sporeSeed(far) === true, 'sporeSeed refused a legal seeding')
      near(spores0 - num(s.res.spores), sc0, 1, 'seeding did not cost its price')
      near(r.col[far], SEED_COL, 1e-6, 'seeding did not grant 0.40 colonisation')
      ok(advancing(far, s), 'a seeded region is not advancing')
      near(seedCost(far, s) / sc0, a.SEED_GROWTH, 1e-6, 'seedCost did not escalate')
      // A seeded region continues without an adjacent claim — the only way across before C5.
      ok(claimedNeighbours(far, s) === 0, 'the seeding test target was adjacent after all')
      C().setStock(s.res, 'biomass', 1e12)
      for (k = 0; k < 40000 && !claimed(far, s); k++) { s.t += 0.05; stepColonisation(0.05, {}) }
      ok(claimed(far, s), 'a seeded region did not colonise without an adjacent claim')
      // And it lowers C, which is the whole point of the two verbs pulling apart.
      var cSeed = connectivity(s)
      ok(cSeed < 1.06, 'a disconnected seeded node did not cost connectivity: ' + cSeed)

      // ── survey ───────────────────────────────────────────────────────────
      s = cold(4242); r = s.a2.regions
      r.flags[3] |= RF_DISCOVERED
      C().setStock(s.res, 'signal', 1e5)
      ok(survey(3) === false, 'survey worked without Substrate Assay')
      s.proj.flags.substrate_assay = 1
      var sig0 = num(s.res.signal)
      ok(survey(3) === true, 'survey refused a legal survey')
      near(sig0 - num(s.res.signal), a.SURVEY_COST, 1e-9, 'survey did not cost 120 Σ')
      ok(surveyed(3, s), 'survey did not set the flag')
      ok(survey(3) === false, 'the same region was surveyed twice')
      // The band does not shimmer: the same region reads the same twice.
      var b1 = band(7, 1e10), b2 = band(7, 1e10)
      ok(b1[0] === b2[0] && b1[1] === b2[1], 'the litter band shimmers between reads')
      ok(b1[0] < 1e10 * 1.3 && b1[1] > 1e10 * 0.7, 'the litter band does not bracket the truth')

      // ── automation, and the offline rule (BIBLE §4 step 10) ──────────────
      s = cold(4242); r = s.a2.regions
      s.proj.flags.chemotaxis = 1
      for (i = 0; i < n; i++) { r.flags[i] = 0; r.col[i] = 0; r.rival[i] = -1; r.rivalStr[i] = 0 }
      r.flags[0] = RF_DISCOVERED | RF_CLAIMED; r.col[0] = 1; r.d[0] = 0.3
      discover(s)
      C().setStock(s.res, 'biomass', 1e14); C().setStock(s.res, 'minerals', 1e9)
      var adv0 = advancingCount(s)
      s.t += 10; step(1, { stochastic: false, offline: true })
      ok(advancingCount(s) === adv0, 'an advance started offline without Rhizomorph Highways')
      s.proj.flags.rhizomorph_highways = 1
      s.t += 10; step(1, { stochastic: false, offline: true })
      ok(advancingCount(s) > adv0, 'Rhizomorph Highways did not advance offline')
      var dens0 = s.stats.densityBuys
      s.t += 10; step(1, { stochastic: false, offline: true })
      ok(s.stats.densityBuys === dens0, 'density was bought offline without Turgor Regulation')
      s.proj.flags.turgor_regulation = 1
      s.t += 10; step(1, { stochastic: false, offline: true })
      ok(s.stats.densityBuys > dens0, 'Turgor Regulation did not buy offline')
      // BIBLE P5: twelve hours away may cost you ground you were reaching for, never ground you
      // hold. A contested claim runs down to the floor and waits for a decision.
      var vic = -1
      for (i = 1; i < n && vic < 0; i++) if (r.flags[i] & RF_CLAIMED) vic = i
      if (vic >= 0) {
        r.d[vic] = 0.02
        r.rival[vic] = PHELLINUS
        r.rivalStr[vic] = 1.0
        r.col[vic] = 1
        for (k = 0; k < 240; k++) {
          s.t += 120
          stepRivals(120, { stochastic: false, offline: true })
          stepColonisation(120, { stochastic: false, offline: true })
        }
        ok(!!(r.flags[vic] & RF_CLAIMED), 'a claimed stand was taken while the player was away')
        near(r.col[vic], OFFLINE_HOLD_FLOOR, 1e-6, 'the offline hold floor is not where it says')
        // And the moment they are back, the same contest resolves normally.
        stepColonisation(60, { stochastic: false, offline: false })
        ok(r.col[vic] < OFFLINE_HOLD_FLOOR, 'the contest did not resume on return')
        r.rival[vic] = -1; r.rivalStr[vic] = 0; r.col[vic] = 1; r.d[vic] = 0.5
      }

      // The automation is a target dial, not "buy everything": it stops where the table says.
      for (k = 0; k < 4000; k++) { s.t += 2; step(2, { stochastic: false, offline: false }) }
      var tgt = densityTargets()
      var over = 0
      for (i = 0; i < n; i++) {
        if (!(r.flags[i] & RF_CLAIMED)) continue
        if (r.d[i] > tgt[r.terrain[i]] + DENS_STEP + 1e-6) over++
      }
      ok(over === 0, over + ' stands were automated past their terrain target')

      // ── the card, which is the whole of the UI's knowledge ───────────────
      var c0card = card(0, s)
      ok(c0card && c0card.claimed && c0card.name, 'card(0) is not a held, named stand')
      ok(c0card.density === null || c0card.density.cost > 0, 'card density cost is not positive')
      var frontier = null
      for (i = 1; i < n && !frontier; i++) {
        var cc2 = card(i, s)
        if (cc2 && cc2.advance && !cc2.advance.blocked) frontier = cc2
      }
      if (frontier) {
        ok(frontier.advance.connTo >= frontier.advance.connFrom,
          'claiming an adjacent stand did not raise C on the card')
        ok(frontier.advance.seconds > 0 && isFinite(frontier.advance.seconds), 'card advance time')
      }
      ok(list(s).length === discoveredCount(s), 'the STANDS list is not every discovered stand')

      // ── hexDist, which PULSE falloff rides on ────────────────────────────
      ok(hexDist(0, 0) === 0, 'hexDist to self is not 0')
      ok(hexDist(0, adj[0]) === 1, 'hexDist to a neighbour is not 1')
      var maxd = 0
      for (i = 0; i < n; i++) for (j = 0; j < n; j++) maxd = Math.max(maxd, hexDist(i, j))
      ok(maxd === 8, 'the map diameter is ' + maxd + ', want 8')

      // ── act guards ───────────────────────────────────────────────────────
      s.act = 1
      var col1 = r.col[0]
      step(1, {})
      near(r.col[0], col1, 1e-12, 'world stepped in Act I')
      ok(startAdvance(1) === false, 'an advance started in Act I')
      s.act = 2
    } catch (err) {
      f.push('THREW: ' + (err && err.message ? err.message : err))
    } finally {
      try { HY.state.importB64(keep) } catch (e) { void 0 }
      var back = S()
      if (back) init(back)
    }
    return f
  }

  HY.world = {
    // BIBLE §6 M8
    worldgen: worldgen,
    neighbours: neighbours,
    hexDist: hexDist,
    connectivity: connectivity,
    advanceCost: advanceCost,
    startAdvance: startAdvance,
    cancelAdvance: cancelAdvance,
    seedCost: seedCost,
    sporeSeed: sporeSeed,
    densityStepCost: densityStepCost,
    buyDensity: buyDensity,
    stepColonisation: stepColonisation,
    stepRivals: stepRivals,
    survey: survey,
    regionName: regionName,
    claimed: claimed,
    // The return report names who took a region while nobody watched (09 §6.6 rival_take).
    rivalNameAt: function (i, st) {
      var r = (st || S()).a2.regions
      return r.rival[i] >= 0 ? RIVALS[r.rival[i] % RIVALS.length].name : null
    },

    // the step loop.js drives (BIBLE §4 step 10) and the pulse arrival
    step: step,
    onPulse: onPulse,

    // §6's generic module surface
    init: init,
    tick: tick,
    serialise: serialise,
    migrate: migrate,
    reboot: reboot,

    // the readouts the UI, projects and the other act modules read across the boundary
    card: card,
    list: list,
    ringOf: function (i) { return ringOf ? ringOf[Math.floor(i)] : 0 },
    claimedCount: claimedCount,
    discoveredCount: discoveredCount,
    advancingCount: advancingCount,
    advanceSlots: advanceSlots,
    advanceTime: advanceTime,
    advanceBlocked: advanceBlocked,
    connectivityIf: connectivityIf,
    claimedNeighbours: claimedNeighbours,
    barrierBetween: barrierBetween,
    densityStepMinerals: densityStepMinerals,
    densityTargets: densityTargets,
    setDensityTarget: setDensityTarget,
    setExpansionPolicy: setExpansionPolicy,
    get expansionPolicy () { return expansionPolicy },
    seedBlocked: seedBlocked,
    downwind: downwind,
    sporeContest: sporeContest,
    yourPressure: yourPressure,
    theirPressure: theirPressure,
    band: band,
    speciesText: speciesText,
    RIVALS: RIVALS,
    TERRAIN_NAME: TERRAIN_NAME,
    EXPANSION_POLICIES: EXPANSION_POLICIES,
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
