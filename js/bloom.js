;(function (HY) {
  'use strict'

  // M13 · bloom.js — Act III's economy (BIBLE §6 M13).
  //
  // Owns: the eight Phase A biomes, ESCAPE, the thirteen bands, harvest, subsistence, the four
  // continuous hazards, the allocation triangle, replication, dispersal, transit and arrival,
  // exploration, the eight-locus genome with its mass tax and REGENOME, Λ, planetConsumed, and the
  // six-cause mortality ledger.
  //
  // Does NOT own: drift, strains, combat or the Successor (divergence.js), Signal and Insight
  // (cognition.js, which reads Λ from here), phase and the endings (finale.js), the project
  // catalogue (projects.js, which calls escape() and reads effFid/planetConsumed). Every one of
  // those is reached lazily and feature-detected, so this module runs alone in a harness.
  //
  // The act's whole shape is one equation. `harvest = n·A/(1 + n/NCAP)` is a hump in n, so a band
  // has a fleet size that produces the most (`n*`) and a fleet size that produces nothing (`n†`),
  // and `n*` is a tenth of `n†`. Nothing below is timed or scripted: `A` falls as `X` depletes, so
  // `n*` falls under the player and the correct policy — stop growing here, leave — arrives on its
  // own. That is BIBLE D24 and the two assertions in __selftest are the only proof that ships.
  //
  // Every death routes through attribute() at the point it occurs (BIBLE §4 step 5). There is no
  // `other` row and there is no way to add one: the six causes are the MORTALITY panel and the
  // panel is the act's answer to "what should I do next".
  //
  // Numbers that cross a module boundary are in `HY.core.TUNE.A3`. What lives below is the biome
  // table of `03` §3.2 and the three reconciliations §3.3's "identical equations" needs to be
  // literally true, which no other module reads.

  // ───────────────────────────────────────────────────────────────────────────
  // LAZY MODULE ACCESS
  // ───────────────────────────────────────────────────────────────────────────

  function C () { return HY.core }
  function T () { return HY.core.TUNE }
  function A () { return HY.core.TUNE.A3 }
  function S () { return HY.state.state }

  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }
  function flagOn (s, id) { return !!(s.proj && s.proj.flags && s.proj.flags[id]) }
  function mult (s, k) {
    var v = s.mult ? s.mult[k] : undefined
    return typeof v === 'number' && isFinite(v) && v > 0 ? v : 1
  }
  function stat (s, k, n) { if (s.stats && typeof s.stats[k] === 'number') s.stats[k] += n }
  function fire (id, tokens) { if (HY.log && HY.log.logFire) HY.log.logFire(id, tokens) }

  // ───────────────────────────────────────────────────────────────────────────
  // THE GENOME'S AXES — `03` §9.2, in BIBLE §3's order, forever
  // ───────────────────────────────────────────────────────────────────────────

  var AXES = ['BAL', 'GER', 'MYC', 'SPO', 'MEL', 'DOR', 'FID', 'ANT']
  var BAL = 0, GER = 1, MYC = 2, SPO = 3, MEL = 4, DOR = 5, FID = 6, ANT = 7

  // `03` §9.2's coefficients. Each is the slope on one locus count, named for the quantity it
  // moves, so the trait web is one table rather than eight scattered expressions.
  var TRAIT = {
    BAL_EXPLORE: 0.60,      // explore × (1 + this·tBal)
    BAL_TRANSIT: 0.28,      // τ ÷ (1 + this·tBal)
    BAL_EST: 0.11,          // pEst ÷ (1 + this·tBal)   ← the coupled cost
    GER_EST: 0.50,          // pEst × (1 + this·tGer)
    MYC_HARV: 0.55,         // harvest × (1 + this·tMyc)
    MEL_HARV: 0.06,         // harvest ÷ (1 + this·tMel) ← Myceliation's coupled cost
    MEL_RAD: 0.55,          // radiation ÷ (1 + this·tMel)^1.25
    MEL_RAD_EXP: 1.25,
    MEL_PRED: 0.20,         // predation ÷ (1 + this·tMel)
    SPO_REP: 0.42,          // replicate × (1 + this·tSpo)
    DOR_TRANSIT: 0.45,      // transit hazard ÷ (1 + this·tDor)
    DOR_SUB: 0.55,          // μ_dor = 1 − this·(1 − e^(−0.25·tDor))
    DOR_SUB_E: 0.25,
    DOR_SEN: 0.18,          // senescence ÷ (1 + this·tDor)
    DOR_STELLAR: 0.22,      // dormantFrac = 1 − e^(−this·tDor)
    DOR_HARV: 0.030,        // harvest × max(FLOOR, 1 − this·tDor)
    DOR_REP: 0.025,         // replicate × max(FLOOR, 1 − this·tDor)
    DOR_FLOOR: 0.40,        // the floor both Dormancy costs stop at
    ANT_PRED: 0.30,         // a strain's lethality × (1 + this·tAnt)
    ANT_CROWD: 0.16         // wild crowding ÷ (1 + this·tAnt)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MORTALITY — the six causes, in BIBLE §3's order, forever
  // ───────────────────────────────────────────────────────────────────────────

  var CAUSE = { STARVE: 0, RAD: 1, TRANSIT: 2, ESTAB: 3, SENESCE: 4, PREDATION: 5 }
  var CAUSE_LABEL = ['STARVATION', 'RADIATION', 'TRANSIT', 'ESTABLISHMENT', 'SENESCENCE', 'PREDATION']

  // `03` §11.7, verbatim, shown on the FLEET tab. Six lines, no numbers, no advice, no trait names:
  // it exists so the MORTALITY panel's row labels mean something the first time they appear.
  var HAZARD_CARD = [
    { name: 'STARVATION', line: 'you built more than the carbon can carry' },
    { name: 'RADIATION', line: 'it gets worse the further out you go' },
    { name: 'TRANSIT', line: 'the long legs are the expensive ones' },
    { name: 'ESTABLISHMENT', line: 'arriving is not the same as landing' },
    { name: 'STELLAR', line: 'rare, large, and announced if you paid for the announcement' },
    { name: 'PREDATION', line: 'something that used to be you' }
  ]

  // ───────────────────────────────────────────────────────────────────────────
  // THE EIGHT BIOMES — `03` §3.2
  // ───────────────────────────────────────────────────────────────────────────
  //
  // `tier` is the number of biomes that must already be reached. `needs` is a project that must be
  // owned before the row can be reached at all; `lifts` is the project that removes this row's
  // penalty. `03` §18.1's F5 removes "biomes 2,7 penalty", which is why the two cold rows share a
  // lift, and §3.2's "needs F5" on row 7 is its tier-4 door, not a second gate: F5's published
  // effect is a penalty removal and nothing else.

  var BIOMES = [
    { name: 'The Stand', tier: 0, harvMod: 1.00, repMod: 1.00, needs: null, lifts: null, hazard: null },
    { name: 'Temperate Forest', tier: 1, harvMod: 1.00, repMod: 1.00, needs: null, lifts: null, hazard: null },
    { name: 'Boreal & Taiga', tier: 2, harvMod: 0.72, repMod: 1.00, needs: null, lifts: 'antifreeze_glycoprotein', hazard: 'frost' },
    { name: 'Grassland & Cropland', tier: 2, harvMod: 1.00, repMod: 1.00, needs: null, lifts: null, hazard: 'fire' },
    { name: 'Tropical Forest', tier: 3, harvMod: 0.65, repMod: 1.00, needs: null, lifts: 'secondary_metabolites', hazard: 'competition' },
    { name: 'Wetland & Peat', tier: 3, harvMod: 1.00, repMod: 0.55, needs: null, lifts: 'facultative_anaeroby', hazard: 'anoxia' },
    { name: 'Marine Photic Zone', tier: 4, harvMod: 1.00, repMod: 1.00, needs: 'osmotic_adjustment', lifts: null, hazard: 'salinity' },
    { name: 'Permafrost & Deep Soil', tier: 4, harvMod: 0.72, repMod: 1.00, needs: null, lifts: 'antifreeze_glycoprotein', hazard: 'cold' }
  ]

  // Grassland burns. `03` §3.2: 1.4% per minute, 12% of the row, and it is the Phase A analogue of
  // the void's stellar events — the same attribution (RADIATION) and the same counter.
  var FIRE_P_PER_MIN = 0.014
  var FIRE_LOSS = 0.12

  // ───────────────────────────────────────────────────────────────────────────
  // THE THREE RECONCILIATIONS
  // ───────────────────────────────────────────────────────────────────────────

  // 1 · A/S. K21 publishes HARV_K = 4.00e7 and K22 SUB_K = 9.00e5, whose ratio is 44.4; `08` §3.8
  //     and TUNE's own AS_RATIO publish 66.7, from which n* = 7.17·NCAP and n† = 65.7·NCAP follow.
  //     Both cannot hold. D24 makes n* = 7.17·NCAP a shipping assertion and K21 carries the
  //     registry's strongest sensitivity (−31) — moving it moves the act's whole carbon clock —
  //     so the subsistence coefficient in use is HARV_K/AS_RATIO = 5.997e5 g/s. K22's stated guard
  //     (A/S ≥ 20) holds with room, and every published quantity that depends only on the ratio
  //     (n*, n†, n*/n† = 0.109, the μ_myc table of §7.5) comes out exact.
  function subCoefBase () { return A().HARV_K / A().AS_RATIO }

  // 2 · Phase A's scale. A tap of SETTLE hands you 1.0e7 craft and GERM_TUBE wants 2.0e8 of them,
  //     while the eight biomes' 3.94e18 g buy only 6.57e7 units of NCAP at the void's 6.0e10 g per
  //     craft — The Stand alone would carry 33,000. A settled front on a forest floor is not the
  //     same object as a self-extending front crossing a galactic shell, and at 1e−3 of its mass,
  //     appetite and footprint every published Phase A number becomes true at once: The Stand's
  //     max-surplus fleet is 2.39e8 (GERM_TUBE_N to two figures), the planet's is 4.71e11, and the
  //     planet is eaten in 28 minutes at n* against §24's 22-minute Phase A. A/S is untouched
  //     because the scale divides harvest and subsistence alike, so §3.3's "identical equations"
  //     is literally true and n*/NCAP is 7.17 in both phases. ESCAPE then charges 96% of the count
  //     and the survivors are void craft: getting off the planet costs what it costs because you
  //     have to become something a thousand times larger to do it.
  var CANOPY_SCALE = 1.0e-3

  // 3 · Band 0's carbon. §6.1's table gives row 0 as 6.00e23 g and NCAP 1.00e13; TUNE publishes
  //     only the b ≥ 1 law (X0_BASE · X0_GROWTH^(b−1)), which does not reach row 0.
  var BAND0_X0 = 6.00e23

  // SETTLE's establishment probability. `03` §3.1 states it as a bare 0.42 and `09`'s console line
  // states it in words — "Forty-two in a hundred take hold" — so it is a published number in two
  // places and not the arrival pEst of §7.7, which no one has paid for yet at t = 0.
  var SETTLE_P_EST = 0.42

  // Auto-SETTLE, F1's effect: 1.5 × SETTLE_Q of spores per second, which outruns SPORE_DECAY_3.
  var AUTOSETTLE_RATE = 1.5

  // REACH opens a biome; a biome with no craft in it can never grow into, because both replication
  // and exploration are proportional to what is already there. The verb therefore moves a quarter
  // of the standing fleet through the door, taken proportionally from every row already held.
  var REACH_SEED = 0.25

  // Phase A recovers 55% of a starved craft's mass to the biome, exactly as the void does.
  var STARVE_MASS_FRAC = 0.30      // fraction of craftMass a craft must lose to die
  var STARVE_RECOVER = 0.55        // fraction of that mass the ground gets back

  // Project consequences that belong to quantities this module owns. They live here rather than in
  // TUNE because nothing outside this file reads them.
  var COAT_TR = 0.55               // G6 sclerotial_coat: TR_HAZ ×
  var ISOTROPY_TAU = 0.80          // H10 isotropy: τ ×
  var CONTINUITY_LAG = 0.78        // H1 hyphal_continuity: LAG_K ×
  var RADIOTROPHY_CUT = 0.9        // H7: rateRad × (1 − this·min(1, tMel/6))
  var RADIOTROPHY_GAIN = 4.0e5     // H7: harvest += n·this·min(1, tMel/6)·(1 + 0.22·b)
  var RADIOTROPHY_MEL = 6          // the tMel at which H7's inversion is complete
  var SOMATIC_PRED = 0.45          // I9 somatic_incompatibility: SKIRM_K ×
  var PLASMOGAMY_COST = 0.70       // H8: regenomeCost ×
  var PLASMOGAMY_T = 60            // H8: REGEN_T →
  var RAD_BAND_SLOPE = 0.22        // §11.1: rateRad ∝ (1 + this·b)
  var STELLAR_BAND_SLOPE = 0.10    // §11.3: p_b ∝ (1 + this·b)
  var STELLAR_SEV_MIN = 0.18       // §11.3 severity = this + SPAN·rand()
  var STELLAR_SEV_SPAN = 0.34
  var STELLAR_DORMANT = 0.85       // loss × (1 − this·dormantFrac)
  var PRECURSOR_S = 40             // H5: seconds of notice
  var SURPLUS_HUMP_S = 240         // §10.2's console latch: surplus falling while n rises
  var REP_CROWD_DAMP = 12          // §7.6: (1 − occ/(occ + this))
  var EXPLORE_CLAMP = 4            // §6.3: min(this, (n/NREF)^0.55)
  var EXPLORE_EXP = 0.55
  var DEP_EXP = 0.45               // §7.3: dep = (X/X0)^this
  var SITEQ_EXP = 0.35             // §7.7: siteQ = e^this
  var WILD_EST = 0.60              // §7.7: pEst × (1 − this·wildShare)
  var PEST_MIN = 0.02, PEST_MAX = 0.98
  // §6.3 grows exploration from wherever a band already is, and §7.3 makes harvest exactly
  // proportional to it — `A_b = HARV_K · μ_myc · e_b · rich · dep`. A band nobody has ever stood in
  // has e = 0, so its harvest is exactly zero, so §7.4's deficit is the whole of subsistence and
  // the arriving party dies at n·SUB_K/(craftMass·0.30) per second. Measured: DISPERSE landed
  // 5.5e11 craft in band 1 and thirty-five seconds later there were 9.34e6 of them, then none; the
  // void never held more than one band in a seven-hour run, in every run, because the first
  // instant of every colonisation divides the act's own economy by nothing.
  //
  // Landing is not the same as arriving unannounced. `arrivalPEst` (§7.7) already models whether a
  // craft found a workable site — that is what `siteQ` is — so a craft that lands has, by
  // construction, found one. This is the exploration that fact represents, and it is the boundary
  // condition §6.3 assumes and never states. A/S = 66.7·e at baseline, so break-even is e = 0.0150;
  // at 0.060 a landing party runs A/S = 4.0, which puts n† at 3.0·NCAP and n* at 1.0·NCAP — it can
  // feed itself and compound, and it still has 94% of the band left to learn the slow way.
  var LANDING_E = 0.060

  var RICH_MIN = 0.55, RICH_SPAN = 1.05    // §6.2: rich ∈ [0.55, 1.60]
  var RICH_KNOWN_E = 0.20          // §6.2: rich is unknown until e ≥ this
  var LAMBDA_REF = 1.0             // §3.3: λ_b = 1 on one planet
  var OFFLINE_PRED_CAP = 0.25      // §22: predation capped at 25% of the fleet for the whole absence

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE-LOCAL STATE
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Residual accumulators (`08` §2.3 P2). `a3.bands.nResid` is in §3's shape; the other three are
  // held here because a residual is by construction below 1e−9 of its stock, so losing one to a
  // reload costs less than the rounding it was there to prevent, and §3 is a contract this module
  // does not get to extend.
  var xResid = null
  var carbonResid = 0
  var cumResid = 0

  var cumReplicated = 0            // craft ever made, for `09`'s senescence line
  var cumSenesced = 0
  var lastAct = 0
  var wasOffline = false
  var predBudget = Infinity        // craft predation may still take this offline window
  var warnings = []                // { band, at } — H5's 40 s notice; never crosses a reload
  var humpFor = 0                  // s a band has spent with surplus falling while n rose
  var lastHumpN = 0, lastHumpSurplus = 0
  var newCraft = null              // repActual_b of the frame, read by divergence.js (§13.1)

  // ───────────────────────────────────────────────────────────────────────────
  // GEOMETRY
  // ───────────────────────────────────────────────────────────────────────────

  function inVoid (s) { return s.phase === 'void' || s.phase === 'dismantle' || s.phase === 'ended' }
  function inCanopy (s) { return s.act === 3 && !inVoid(s) }

  function bandCount () { return A().BANDS }

  // §6.1. Band 0 is the Sol system and is never displayed in light-years.
  function bandRadius (b) {
    var a = A()
    return b <= 0 ? 0 : a.R_BASE * Math.pow(a.R_GROWTH, b - 1)
  }

  function bandX0 (b) {
    var a = A()
    return b <= 0 ? BAND0_X0 : a.X0_BASE * Math.pow(a.X0_GROWTH, b - 1)
  }

  // §6.1: "one craft per 60 Gg of band carbon". In the canopy the craft is a thousandth of the
  // size, so the same carbon carries a thousand times as many of them.
  function ncapDiv (s) { return A().NCAP_DIV * (inCanopy(s) ? CANOPY_SCALE : 1) }

  function X0of (s, b) {
    return inCanopy(s) ? num(A().BIOME_X0[b]) : bandX0(b)
  }

  function NCAP (s, b) { return X0of(s, b) / ncapDiv(s) }

  // §6.3's reference fleet: the size at which a band explores at its nominal time constant.
  function NREF (s, b) { return NCAP(s, b) * A().NREF_FRAC }

  // §6.1's λ, with H1's shortening. dLag is Act III's own D axis and the only cognitive lever on
  // distance; on one planet there is no distance and λ is 1.
  function lambda (s, b) {
    if (inCanopy(s)) return LAMBDA_REF
    var a = A()
    var k = a.LAG_K * (flagOn(s, 'hyphal_continuity') ? CONTINUITY_LAG : 1)
    return 1 / (1 + (k / (1 + 0.20 * num(s.cog.dLag))) * Math.sqrt(bandRadius(b)))
  }

  // §7.7's τ for the leg out of band `from`. TAU0 is the 0→1 leg, so the exponent is `from`.
  function legTau (s, from) {
    var a = A()
    var t = a.TAU0 * Math.pow(a.TAU_GROWTH, Math.max(0, from)) / (1 + a_BAL_TRANSIT(s))
    if (flagOn(s, 'isotropy')) t *= ISOTROPY_TAU
    return t
  }
  function a_BAL_TRANSIT (s) { return TRAIT.BAL_TRANSIT * locus(s, BAL) }

  // ───────────────────────────────────────────────────────────────────────────
  // THE GENOME
  // ───────────────────────────────────────────────────────────────────────────

  function locus (s, i) {
    var L = s.a3 && s.a3.loci
    return L && typeof L[i] === 'number' ? Math.max(0, L[i]) : 0
  }

  function genomeLength (s) {
    var i, g = 0
    for (i = 0; i < AXES.length; i++) g += locus(s, i)
    return g
  }

  // §7.2, and BIBLE §2.2's craftMass verbatim. Every locus makes every craft you will ever build
  // more expensive to copy, which is what turns trait allocation from an opportunity cost into an
  // economic one. §7.2's illustrative table was tabulated against a larger tax; the formula wins.
  function craftMass (state) {
    var s = state || S()
    if (!s) return 0
    var a = A()
    var m = a.CRAFT_M0 * Math.pow(1 + a.GEN_TAX * genomeLength(s), a.GEN_EXP)
    return inCanopy(s) ? m * CANOPY_SCALE : m
  }

  // §9.3. `fidelityBase` was fixed on entry to Act III from a decision made forty minutes earlier
  // in a different act; boughtFid is capped at +0.24 by projects.js (BIBLE §7 C20).
  function effFid (state) {
    var s = state || S()
    if (!s) return 0
    var a = A()
    return C().clamp(
      num(s.carry.fidelityBase) +
      a.FID_PER_FID_LOCUS * locus(s, FID) -
      a.FID_PER_ANT_LOCUS * locus(s, ANT) +
      num(s.mult.boughtFid), a.FID_MIN, a.FID_MAX)
  }

  // §9.1 with `08` §4.6's coefficients (which supersede 03's 120/1.24). k = loci already purchased.
  function locusCost (k) {
    var a = A()
    return Math.ceil(a.LOCI_A * Math.pow(Math.max(0, k) + 1, a.LOCI_E))
  }

  function lociFree (s) { return num(s.a3.lociFree) }
  function lociPlaced (s) { return genomeLength(s) }
  function lociBudget (s) { return lociFree(s) + num(s.a3.lociBought) }
  function lociRoom (s) { return Math.min(num(s.a3.lociCap), A().LOCI_MAX) }
  function nextLocusCost (s) { return locusCost(num(s.a3.lociBought)) }

  // Raising a locus spends Ψ once the free grant and everything already paid for are placed.
  // Lowering is only legal inside a REGENOME window, because that is precisely what a REGENOME
  // buys: §9.4's respec is the only way the genome comes apart.
  function setLocus (axis, v, state) {
    var s = state || S()
    if (!s || s.act !== 3) return false
    var i = typeof axis === 'string' ? AXES.indexOf(axis.toUpperCase()) : Math.floor(axis)
    if (!(i >= 0 && i < AXES.length)) return false
    var want = Math.max(0, Math.floor(num(v)))
    var have = locus(s, i)
    if (want === have) return true

    if (want < have) {
      if (!(num(s.a3.regenomeAt) > num(s.t))) return false
      s.a3.loci[i] = want
      return true
    }

    var add = want - have
    if (lociPlaced(s) + add > lociRoom(s)) return false
    var free = Math.max(0, lociBudget(s) - lociPlaced(s))
    var buy = Math.max(0, add - free)
    var k = num(s.a3.lociBought), cost = 0, j
    for (j = 0; j < buy; j++) cost += locusCost(k + j)
    if (cost > num(s.res.insight)) return false
    if (cost > 0) C().setStock(s.res, 'insight', num(s.res.insight) - cost)
    s.a3.lociBought = k + buy
    s.a3.loci[i] = want
    return true
  }

  // §9.4. Self-scaling to the act, so it always reads as "about 2% of everything you have ever
  // eaten". The escalation counter is proj.uses, which is §3's home for a repeatable action;
  // cog.respecs is cognition's D ladder and inflating it here would silently reprice that.
  function regenomeCost (state) {
    var s = state || S()
    if (!s) return Infinity
    var a = A()
    var r = num(s.proj.uses.regenome)
    var base = Math.max(1.0e27, a.REGEN_FRAC * num(s.res.cumCarbon)) * Math.pow(a.REGEN_G, r)
    return flagOn(s, 'plasmogamy') ? base * PLASMOGAMY_COST : base
  }

  function regenomeTime (s) { return flagOn(s, 'plasmogamy') ? PLASMOGAMY_T : A().REGEN_T }

  function regenome (state) {
    var s = state || S()
    if (!s || s.act !== 3) return false
    if (num(s.a3.regenomeAt) > num(s.t)) return false
    var cost = regenomeCost(s)
    if (!(num(s.res.carbon) >= cost)) return false
    C().setStock(s.res, 'carbon', num(s.res.carbon) - cost)
    var i
    for (i = 0; i < AXES.length; i++) s.a3.loci[i] = 0
    s.a3.regenomeAt = num(s.t) + regenomeTime(s)
    s.proj.uses.regenome = num(s.proj.uses.regenome) + 1
    stat(s, 'respecs', 1)
    fire('a3.regenome')
    return true
  }

  function rewriting (s) { return num(s.a3.regenomeAt) > num(s.t) }

  // ───────────────────────────────────────────────────────────────────────────
  // THE FIELD — eight biomes or thirteen bands, one set of equations (§3.3)
  // ───────────────────────────────────────────────────────────────────────────

  function field (s) { return inCanopy(s) ? s.a3.biomes : s.a3.bands }
  function count (s) { return inCanopy(s) ? BIOMES.length : bandCount() }
  function live (s, b) { return inCanopy(s) ? !!s.a3.biomes.reached[b] : true }

  // Explored fraction. A reached biome is a place you are standing on; a band is a place you have
  // to look at first, and band 0 is the system you have just spent twenty-two minutes eating.
  function explored (s, b) {
    if (inCanopy(s)) return s.a3.biomes.reached[b] ? 1 : 0
    return C().clamp(num(s.a3.bands.e[b]), 0, 1)
  }

  function richness (s, b) {
    if (inCanopy(s)) return 1
    var r = num(s.a3.bands.rich[b])
    return r > 0 ? r : 1
  }

  // §6.2: unknown until e ≥ 0.20, displayed as a range before that. The UI asks; the sim never does.
  function richKnown (s, b) { return inCanopy(s) || explored(s, b) >= RICH_KNOWN_E }

  function biomeHarvMod (s, b) {
    var r = BIOMES[b]
    if (!r) return 1
    if (r.lifts && flagOn(s, r.lifts)) return 1
    return r.harvMod
  }

  function biomeRepMod (s, b) {
    var r = BIOMES[b]
    if (!r) return 1
    if (r.lifts && flagOn(s, r.lifts)) return 1
    return r.repMod
  }

  function totalCraft (state) {
    var s = state || S()
    if (!s) return 0
    var i, t = 0
    for (i = 0; i < s.a3.biomes.n.length; i++) t += num(s.a3.biomes.n[i])
    for (i = 0; i < s.a3.bands.n.length; i++) t += num(s.a3.bands.n[i])
    for (i = 0; i < s.a3.transit.length; i++) t += num(s.a3.transit[i].count)
    return t
  }

  // Total fleet loss with nothing left to reseed from. Replication, exploration and dispersal are
  // all proportional to what is already standing, and SETTLE is the only source that is not — so a
  // run with no craft and no spores can never produce another craft, in either phase, at any price.
  //
  // `08` §5.3 L5 promises that this state is answered by ENCYST "at zero cost … a bad ending, not a
  // dead end", but `03` §20.4 gates ENCYST on twenty minutes *in the void*, and the state is
  // reachable in Phase A, before `void_t` is ever stamped. Measured, that is exactly where the
  // reference player landed: fleet zero at planetConsumed 0.206 in the canopy, with the board
  // frozen for the remaining seven hours of the run and no ending of any kind offered. `08` wins on
  // precedence, so being stranded is a second, independent trigger for the concession.
  function stranded (state) {
    var s = state || S()
    if (!s || s.act !== 3) return false
    // Act III opens with a full spore bank and an empty board; that is the opening, not the end.
    return totalCraft(s) <= 0 && num(s.res.spores) <= 0
  }

  function inTransit (state) {
    var s = state || S()
    if (!s) return 0
    var i, t = 0
    for (i = 0; i < s.a3.transit.length; i++) t += num(s.a3.transit[i].count)
    return t
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WILD OCCUPANCY — divergence.js owns the strains; this file only competes with them
  // ───────────────────────────────────────────────────────────────────────────

  function wildIn (s, b) {
    var st = s.a3.strains, i, w = 0, rec
    if (st) {
      for (i = 0; i < st.length; i++) {
        rec = st[i]
        if (rec && rec.w && typeof rec.w[b] === 'number') w += num(rec.w[b])
      }
    }
    if (s.a3.succ && s.a3.succ.w && typeof s.a3.succ.w[b] === 'number') w += num(s.a3.succ.w[b])
    return w
  }

  // Fleet-weighted mean Antagonism of everything present that is not you (§11.6).
  function wildAnt (s, b) {
    var st = s.a3.strains, i, w = 0, acc = 0, rec, m
    if (st) {
      for (i = 0; i < st.length; i++) {
        rec = st[i]
        if (!rec || !rec.w || !rec.genome) continue
        m = num(rec.w[b])
        if (!(m > 0)) continue
        w += m
        acc += m * Math.max(0, num(rec.genome[ANT]))
      }
    }
    if (s.a3.succ && s.a3.succ.w && s.a3.succ.genome) {
      m = num(s.a3.succ.w[b])
      if (m > 0) { w += m; acc += m * Math.max(0, num(s.a3.succ.genome[ANT])) }
    }
    return w > 0 ? acc / w : 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE CORE LOOP — §7, per band, per second
  // ───────────────────────────────────────────────────────────────────────────

  // §7.3's μ_myc, with §9.2's Dormancy floor on the harvest cost.
  function muMyc (s) {
    return (1 + TRAIT.MYC_HARV * locus(s, MYC)) / (1 + TRAIT.MEL_HARV * locus(s, MEL)) *
      Math.max(TRAIT.DOR_FLOOR, 1 - TRAIT.DOR_HARV * locus(s, DOR))
  }

  // §7.4's μ_dor: 1.00 → 0.45 asymptotically. Dormancy lowers the floor you must eat to.
  function muDor (s) {
    return 1 - TRAIT.DOR_SUB * (1 - Math.exp(-TRAIT.DOR_SUB_E * locus(s, DOR)))
  }

  function muSpo (s) {
    return (1 + TRAIT.SPO_REP * locus(s, SPO)) *
      Math.max(TRAIT.DOR_FLOOR, 1 - TRAIT.DOR_REP * locus(s, DOR))
  }

  function depletion (s, b) {
    var f = field(s)
    var x0 = X0of(s, b)
    if (!(x0 > 0)) return 0
    return Math.pow(C().clamp(num(f.X[b]) / x0, 0, 1), DEP_EXP)
  }

  // §7.3's A_b: the per-craft harvest coefficient, everything but the crowding term.
  function harvCoef (s, b) {
    var a = A()
    var k = a.HARV_K * (inCanopy(s) ? CANOPY_SCALE : 1)
    var mod = inCanopy(s) ? biomeHarvMod(s, b) : 1
    return k * muMyc(s) * explored(s, b) * richness(s, b) * depletion(s, b) * mult(s, 'harvMult') * mod
  }

  // §7.4's S: what a craft must eat not to die.
  function subCoef (s) {
    return subCoefBase() * (inCanopy(s) ? CANOPY_SCALE : 1) * muDor(s)
  }

  // §7.3. Wild craft crowd you out by being present and the effect is exactly symmetric; §9.2's
  // Antagonism reduces what their presence costs you and nothing else.
  function occupancy (s, b) {
    var cap = NCAP(s, b)
    if (!(cap > 0)) return 0
    var mine = num(field(s).n[b])
    var wild = wildIn(s, b) / (1 + TRAIT.ANT_CROWD * locus(s, ANT))
    return (mine + wild) / cap
  }

  function wildOcc (s, b) {
    var cap = NCAP(s, b)
    if (!(cap > 0)) return 0
    return (wildIn(s, b) / (1 + TRAIT.ANT_CROWD * locus(s, ANT))) / cap
  }

  // §11.1's H7. The act's most punishing hazard becomes the outer bands' best income, and it is
  // gated behind the trait that was costing harvest all along.
  function radiotrophyGain (s, b) {
    if (!flagOn(s, 'radiotrophy')) return 0
    var m = Math.min(1, locus(s, MEL) / RADIOTROPHY_MEL)
    return RADIOTROPHY_GAIN * (inCanopy(s) ? CANOPY_SCALE : 1) * m * (1 + RAD_BAND_SLOPE * b)
  }

  function harvestOf (state, b) {
    var s = state || S()
    if (!s || !live(s, b)) return 0
    var n = num(field(s).n[b])
    if (!(n > 0)) return 0
    return n * (harvCoef(s, b) / (1 + occupancy(s, b)) + radiotrophyGain(s, b))
  }

  function subsistOf (state, b) {
    var s = state || S()
    if (!s) return 0
    return num(field(s).n[b]) * subCoef(s)
  }

  function surplus (b, state) {
    var s = state || S()
    if (!s) return 0
    return harvestOf(s, b) - subsistOf(s, b)
  }

  // §7.5, the closed form, generalised to a band that already has something else living in it:
  //   surplus(n) = n·A/(1 + n/NCAP + wildOcc) − n·S
  //   d/dn = 0   ⇒   (1 + n/NCAP + wildOcc)² = A·(1 + wildOcc)/S
  //   surplus = 0 ⇒   n† = NCAP·(A/S − 1 − wildOcc)
  // With no wild present these collapse to §7.5's published pair, and at baseline to 7.17·NCAP
  // and 65.7·NCAP. Nothing in the UI names either; the SURPLUS readout is the whole instrument.
  function nStar (b, state) {
    var s = state || S()
    if (!s) return 0
    var A_b = harvCoef(s, b), S_b = subCoef(s), w = wildOcc(s, b)
    if (!(A_b > 0) || !(S_b > 0)) return 0
    var r = Math.sqrt(A_b * (1 + w) / S_b) - (1 + w)
    return r > 0 ? NCAP(s, b) * r : 0
  }

  function nDagger (b, state) {
    var s = state || S()
    if (!s) return 0
    var A_b = harvCoef(s, b), S_b = subCoef(s), w = wildOcc(s, b)
    if (!(A_b > 0) || !(S_b > 0)) return 0
    var r = A_b / S_b - 1 - w
    return r > 0 ? NCAP(s, b) * r : 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RESIDUAL-SAFE WRITES (`08` §2.3 P2)
  // ───────────────────────────────────────────────────────────────────────────

  // Craft are countable. Continuous attrition never reaches zero on its own, so a band that has
  // been abandoned or eaten out otherwise keeps a denormal tail — 1e−180 craft — for the rest of
  // the run, and every readout downstream has to pretend that is a fleet. Below one craft it is
  // not a fleet; it is an empty band, and the canvas should draw it as one.
  var CRAFT_FLOOR = 1

  function floorN (v) { return v < CRAFT_FLOOR ? 0 : v }

  function addN (s, b, dn) {
    var f = field(s)
    if (inCanopy(s)) { f.n[b] = floorN(Math.max(0, num(f.n[b]) + dn)); return }
    var resid = s.a3.bands.nResid
    resid[b] = num(resid[b]) + dn
    var n = num(f.n[b])
    if (Math.abs(resid[b]) > n * T().NUM.RESID_REL || resid[b] + n <= 0) {
      f.n[b] = floorN(Math.max(0, n + resid[b]))
      resid[b] = 0
    }
  }

  function addX (s, b, dx) {
    var f = field(s)
    var i = b + (inCanopy(s) ? 0 : BIOMES.length)
    if (!xResid) xResid = new Float64Array(BIOMES.length + bandCount())
    xResid[i] += dx
    var x = num(f.X[b])
    if (Math.abs(xResid[i]) > x * T().NUM.RESID_REL || xResid[i] + x <= 0) {
      f.X[b] = Math.max(0, x + xResid[i])
      xResid[i] = 0
    }
  }

  function addCarbon (s, dc) {
    carbonResid += dc
    var v = num(s.res.carbon)
    if (Math.abs(carbonResid) > v * T().NUM.RESID_REL || carbonResid + v <= 0) {
      C().setStock(s.res, 'carbon', v + carbonResid)
      carbonResid = 0
    }
  }

  function addCumCarbon (s, dc) {
    cumResid += dc
    var v = num(s.res.cumCarbon)
    if (cumResid > v * T().NUM.RESID_REL) {
      C().setStock(s.res, 'cumCarbon', v + cumResid)
      cumResid = 0
    }
  }

  // Carbon actually available to be spent this frame, residual included, so a spend never drives
  // the stock negative and never silently loses the fraction the residual is holding.
  function heldCarbon (s) { return Math.max(0, num(s.res.carbon) + carbonResid) }

  function heldX (s, b) {
    var i = b + (inCanopy(s) ? 0 : BIOMES.length)
    return Math.max(0, num(field(s).X[b]) + (xResid ? xResid[i] : 0))
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MORTALITY — the ledger, and the only way a craft may die
  // ───────────────────────────────────────────────────────────────────────────

  // The rolling window is one exponential accumulator per cause rather than a ring buffer: at
  // steady state m_i settles at rate·MORTALITY_WINDOW, which is exactly "craft lost in the last
  // sixty seconds", and it costs six multiplications a tick instead of a queue.
  function attribute (cause, n, state) {
    var s = state || S()
    if (!s || !(n > 0)) return 0
    var i = typeof cause === 'string' ? CAUSE[cause.toUpperCase()] : Math.floor(cause)
    if (!(i >= 0 && i < A().MORTALITY_CAUSES)) return 0
    s.a3.mortality[i] = num(s.a3.mortality[i]) + n
    if (i === CAUSE.SENESCE) cumSenesced += n
    return n
  }

  // Every death in this module goes through here, at the point it occurs. Retrofitting attribution
  // is how a build ends up with an `other` row.
  function kill (s, b, n, cause) {
    var f = field(s)
    var have = num(f.n[b])
    var take = Math.min(have, Math.max(0, n))
    if (!(take > 0)) return 0
    if (inCanopy(s)) f.n[b] = floorN(have - take)
    else addN(s, b, -take)
    attribute(cause, take, s)
    return take
  }

  function decayMortality (s, dt) {
    var w = A().MORTALITY_WINDOW
    if (!(w > 0) || !(dt > 0)) return
    var k = Math.exp(-dt / w), i
    for (i = 0; i < s.a3.mortality.length; i++) s.a3.mortality[i] = num(s.a3.mortality[i]) * k
  }

  function mortality (state) {
    var s = state || S()
    if (!s) return { total: 0, window: A().MORTALITY_WINDOW, rows: [] }
    var i, total = 0, rows = []
    for (i = 0; i < s.a3.mortality.length; i++) total += num(s.a3.mortality[i])
    for (i = 0; i < s.a3.mortality.length; i++) {
      rows.push({
        id: i,
        label: CAUSE_LABEL[i],
        count: num(s.a3.mortality[i]),
        frac: total > 0 ? num(s.a3.mortality[i]) / total : 0
      })
    }
    return { total: total, window: A().MORTALITY_WINDOW, rows: rows }
  }

  // `09`'s senescence line: craft are a flow, not a bank, and this is the number that says so.
  function senescedFraction () {
    return cumReplicated > 0 ? cumSenesced / cumReplicated : 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 4 · PRODUCTION — auto-SETTLE, then harvest
  // ───────────────────────────────────────────────────────────────────────────

  function stepHarvest (dt, opts, state) {
    var s = state || S()
    if (!s || s.act !== 3 || !(dt > 0)) return
    var o = opts || { stochastic: true, offline: false }
    enter(s, o)

    if (inCanopy(s)) autoSettle(s, dt)

    var n = count(s), b, h, drawn
    for (b = 0; b < n; b++) {
      if (!live(s, b)) continue
      h = harvestOf(s, b)
      if (!(h > 0)) continue
      // A band cannot be harvested past what is in it. Clamping the draw rather than the rate is
      // what makes a depleted band go quiet instead of going negative.
      drawn = Math.min(h * dt, heldX(s, b))
      if (!(drawn > 0)) continue
      addX(s, b, -drawn)
      addCarbon(s, drawn)
      addCumCarbon(s, drawn)
    }
  }

  // F1's effect. Auto-SETTLE at 1.5 × SETTLE_Q per second is the number that outruns
  // SPORE_DECAY_3, and it is the whole of the act's opening crisis.
  function autoSettle (s, dt) {
    if (!flagOn(s, 'germ_tube')) return
    var q = Math.min(num(s.res.spores), A().SETTLE_Q * AUTOSETTLE_RATE * dt)
    if (!(q > 0)) return
    C().setStock(s.res, 'spores', num(s.res.spores) - q)
    s.a3.biomes.n[0] = num(s.a3.biomes.n[0]) + q * SETTLE_P_EST
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 5 · SUBSISTENCE AND THE CONTINUOUS LOSSES
  // ───────────────────────────────────────────────────────────────────────────

  function stepSubsist (dt, opts, state) {
    var s = state || S()
    if (!s || s.act !== 3 || !(dt > 0)) return
    var o = opts || { stochastic: true, offline: false }
    enter(s, o)
    stepStarvation(s, dt)
    stepRadiation(s, dt)
    stepSenescence(s, dt)
    stepPredation(s, dt, o)
    stepStellar(s, dt, o)
  }

  // §7.4. Craft die at exactly the rate that closes the deficit, so the system is self-limiting
  // and always recovers on its own — but recovery means losing your compounding, which is the
  // punishment. 55% of a dead craft's mass goes back to the ground it was standing on.
  function stepStarvation (s, dt) {
    var n = count(s), b, sub, harv, deficit, dead, m = craftMass(s) * STARVE_MASS_FRAC
    if (!(m > 0)) return
    for (b = 0; b < n; b++) {
      if (!live(s, b) || !(num(field(s).n[b]) > 0)) continue
      sub = subsistOf(s, b)
      harv = harvestOf(s, b)
      // Subsistence is paid out of what the band itself brought in: craft eat where they stand,
      // never out of the bank, or banking would starve you and BANK would be a trap.
      addCarbon(s, -Math.min(sub, harv) * dt)
      deficit = sub - harv
      if (!(deficit > 0)) continue
      dead = kill(s, b, deficit * dt / m, CAUSE.STARVE)
      if (dead > 0) {
        addX(s, b, dead * m * STARVE_RECOVER)
        fire('a3.first_starve', { band: bandName(s, b) })
      }
    }
  }

  // §11.1. Worse the further out you go, and the counter is a trait that costs harvest — until H7
  // inverts it and the frontier becomes the income.
  function radRate (s, b) {
    var a = A()
    var r = a.RAD_K * (1 + RAD_BAND_SLOPE * b) /
      Math.pow(1 + TRAIT.MEL_RAD * locus(s, MEL), TRAIT.MEL_RAD_EXP)
    if (flagOn(s, 'radiotrophy')) {
      r *= 1 - RADIOTROPHY_CUT * Math.min(1, locus(s, MEL) / RADIOTROPHY_MEL)
    }
    return r
  }

  function stepRadiation (s, dt) {
    if (inCanopy(s)) return          // a planet has an atmosphere; the void does not
    var n = count(s), b, rate
    for (b = 0; b < n; b++) {
      if (!(num(s.a3.bands.n[b]) > 0)) continue
      rate = radRate(s, b)
      if (!(rate > 0)) continue
      kill(s, b, num(s.a3.bands.n[b]) * (1 - Math.exp(-rate * dt)), CAUSE.RAD)
    }
  }

  // §11.5. Small, constant, unavoidable, and the reason a fleet that is not replicating shrinks.
  function stepSenescence (s, dt) {
    var a = A()
    var rate = a.SEN_K / (1 + TRAIT.DOR_SEN * locus(s, DOR))
    if (!(rate > 0)) return
    var n = count(s), b, k = 1 - Math.exp(-rate * dt)
    for (b = 0; b < n; b++) {
      if (!live(s, b) || !(num(field(s).n[b]) > 0)) continue
      kill(s, b, num(field(s).n[b]) * k, CAUSE.SENESCE)
    }
  }

  // §11.6. There is no passive answer to predation — you have to go and deal with it — which is
  // what makes divergence a pressure rather than a leak.
  function stepPredation (s, dt, o) {
    var a = A()
    var k = a.SKIRM_K * (flagOn(s, 'somatic_incompatibility') ? SOMATIC_PRED : 1)
    if (!(k > 0)) return
    var n = count(s), b, mine, wild, share, rate, took
    for (b = 0; b < n; b++) {
      mine = num(field(s).n[b])
      if (!(mine > 0)) continue
      wild = wildIn(s, b)
      if (!(wild > 0)) continue
      share = wild / (mine + wild)
      rate = k * share * (1 + TRAIT.ANT_PRED * wildAnt(s, b)) /
        (1 + TRAIT.MEL_PRED * locus(s, MEL))
      if (!(rate > 0)) continue
      took = mine * (1 - Math.exp(-rate * dt))
      // §22: you cannot lose a run to something you could not fight. Offline predation is capped
      // at a quarter of the fleet for the whole absence, budgeted once on the way out.
      if (o.offline) {
        took = Math.min(took, predBudget)
        predBudget -= took
      }
      kill(s, b, took, CAUSE.PREDATION)
    }
  }

  // §11.3. Rare, large, band-wide — and announced, if you paid for the announcement. Never fires
  // offline: you come back to live warnings and forty seconds to act, which is the same kindness
  // Act II's fires are given.
  function stepStellar (s, dt, o) {
    if (o.stochastic === false || o.offline) return
    var a = A(), b, n = count(s)
    // A precursor that has finished counting down fires now, wherever the player left it.
    var i = 0
    while (i < warnings.length) {
      if (warnings[i].at <= num(s.t)) { detonate(s, warnings[i].band); warnings.splice(i, 1) } else i++
    }
    for (b = 0; b < n; b++) {
      if (!live(s, b) || !(num(field(s).n[b]) > 0)) continue
      var p = (inCanopy(s) ? canopyEventP(s, b) : a.STELLAR_P * (1 + STELLAR_BAND_SLOPE * b)) * dt
      if (!(p > 0) || Math.random() >= p) continue
      if (!inCanopy(s) && flagOn(s, 'neutrino_precursor')) {
        warnings.push({ band: b, at: num(s.t) + PRECURSOR_S * (s.set.slow ? 2 : 1) })
      } else {
        detonate(s, b)
      }
    }
  }

  // Phase A's analogue: the grass has burned every year for twenty million years.
  function canopyEventP (s, b) {
    return BIOMES[b] && BIOMES[b].hazard === 'fire' ? FIRE_P_PER_MIN / 60 : 0
  }

  function detonate (s, b) {
    if (!live(s, b)) return 0
    var have = num(field(s).n[b])
    if (!(have > 0)) return 0
    var lost
    if (inCanopy(s)) {
      lost = have * FIRE_LOSS
      fire('a3.grass_fire')
    } else {
      var sev = STELLAR_SEV_MIN + STELLAR_SEV_SPAN * Math.random()
      // ENCYST buys a dormant fraction of 1.0 for thirty seconds at the cost of all production
      // there. It is the act's only timed decision and the window is forty seconds, not two.
      var encysted = HY.cognition && HY.cognition.pulseEffect
        ? num(HY.cognition.pulseEffect('ENCYST', b)) : 0
      var dormant = encysted > 0 ? 1 : 1 - Math.exp(-TRAIT.DOR_STELLAR * locus(s, DOR))
      lost = have * sev * (1 - STELLAR_DORMANT * dormant)
    }
    stat(s, 'radiationHazards', 1)
    return kill(s, b, lost, CAUSE.RAD)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 6 · THE TRIANGLE — allocation, replication, dispersal, transit
  // ───────────────────────────────────────────────────────────────────────────

  // §8. Income is spent where it is earned, so a band that is producing nothing gets nothing and
  // the frontier funds itself out of the frontier.
  function setAlloc (aRep, aDis, aBank, state) {
    var s = state || S()
    if (!s) return false
    var r = Math.max(0, num(aRep)), d = Math.max(0, num(aDis)), k = Math.max(0, num(aBank))
    var t = r + d + k
    if (!(t > 0)) return false
    s.a3.alloc[0] = r / t
    s.a3.alloc[1] = d / t
    s.a3.alloc[2] = k / t
    return true
  }

  // The triangle the sim actually runs. Before F3 there is no control at all, so there is nowhere
  // for surplus to go but the bank; before G4 there is nowhere to disperse to, so DISPERSE's share
  // falls back to BANK rather than evaporating. The control visibly grows its vertices (§3.3) and
  // the allocation the player set is never quietly rewritten underneath them.
  function liveAlloc (s) {
    if (!flagOn(s, 'translocation')) return [0, 0, 1]
    var r = num(s.a3.alloc[0]), d = num(s.a3.alloc[1]), k = num(s.a3.alloc[2])
    var t = r + d + k
    if (!(t > 0)) return A().ALLOC_BOOT.slice()
    r /= t; d /= t; k /= t
    if (inCanopy(s) || !flagOn(s, 'thrust')) { k += d; d = 0 }
    return [r, d, k]
  }

  function stepAllocation (dt, opts, state) {
    var s = state || S()
    if (!s || s.act !== 3 || !(dt > 0)) return
    var o = opts || { stochastic: true, offline: false }
    enter(s, o)

    var n = count(s), b, sur = [], total = 0
    if (!newCraft || newCraft.length !== n) newCraft = new Float64Array(n)
    for (b = 0; b < n; b++) {
      sur[b] = Math.max(0, surplus(b, s))
      total += sur[b]
      newCraft[b] = 0
    }

    var al = liveAlloc(s)
    if (total > 0) {
      stepReplication(dt, s, sur, total, al[0])
      stepDispersal(dt, s, sur, total, al[1])
    }
    stepTransit(dt, s, o)
  }

  // §7.6. Both repDemand and available carbon scale with n, so the binding constraint is a ratio,
  // not a level: at low occupancy the rate binds, at n → n† the carbon binds and replication
  // stops on its own. During a REGENOME it is halted network-wide (§9.4) and harvest continues.
  //
  // The vertex scales the rate ceiling as well as the carbon budget, because at these constants the
  // budget alone is not a control. §7.6 puts the crossover — where carbon rather than rate binds —
  // at aRep ≈ 0.33, and that is not reachable from the published numbers: per-craft surplus at n*
  // is (√(A/S) − 1)·S = 4.30e6 g/s against a craft mass of 2.40e6 g, so one craft's income buys
  // 1.79 craft per second against a REP_K ceiling of 0.0157/s and the true crossover is aRep =
  // 0.0087. Below one per cent the vertex did nothing; above it every setting was the same setting
  // and the fleet crossed from n* to n† in 202 s. Measured, that made the triangle uncontrollable —
  // the reference player pinned REPLICATE at 0.02 from minute 16, the fleet still grew sixteenfold
  // to n†, surplus fell to zero, and Phase A banked 2.87e17 Χ against ESCAPE's 9.0e17 Χ with the
  // rest of the planet going into subsistence. A vertex is a fraction of a maximum, so it is
  // applied to the maximum. REPLICATE at 0.70 is 70% of REP_K and still crosses n* to n† in 289 s,
  // which keeps BLOOM COLLAPSE (§10.2) five minutes away from anyone who wants it; REPLICATE at
  // 0.02 is a fleet that holds its size. The carbon term is untouched and is still the term that
  // stops replication dead at n†, where surplus is zero.
  function stepReplication (dt, s, sur, total, aRep) {
    if (rewriting(s) || !(aRep > 0)) return
    var m = craftMass(s)
    if (!(m > 0)) return
    var n = count(s), b, occ, demand, budget, act, spend, mod
    for (b = 0; b < n; b++) {
      if (!live(s, b) || !(sur[b] > 0)) continue
      occ = occupancy(s, b)
      mod = inCanopy(s) ? biomeRepMod(s, b) : 1
      demand = num(field(s).n[b]) * A().REP_K * aRep * muSpo(s) * mult(s, 'replMult') * mod *
        (1 - occ / (occ + REP_CROWD_DAMP))
      budget = aRep * total * (sur[b] / total)
      act = Math.min(demand, budget / m)
      if (!(act > 0)) continue
      spend = Math.min(act * m * dt, heldCarbon(s))
      act = spend / (m * dt)
      if (!(act > 0)) continue
      addCarbon(s, -spend)
      addN(s, b, act * dt)
      newCraft[b] = act
      cumReplicated += act * dt
    }
  }

  // §7.7. Craft in transit produce nothing and die at TR_HAZ: DISPERSE is the vertex that costs
  // you now to be able to afford later, and PROP_K makes it cost 1.8 craft-masses of propellant
  // for every craft that leaves.
  //
  // MAXLAUNCH is scaled by the vertex for the same reason REP_K is: a band's income buys 0.995
  // launches per craft per second against a ceiling of 0.020, so the carbon term crosses over at
  // aDis = 0.020 and above that every DISPERSE setting empties a band at exactly the same rate.
  // Scaled, the vertex reads as what the triangle says it is — the fraction of the fleet leaving —
  // and DISPERSE at 0.20 clears a band in 250 s against transit legs of 90 to 2,443 s.
  function stepDispersal (dt, s, sur, total, aDis) {
    if (inCanopy(s) || !(aDis > 0)) return
    var a = A(), m = craftMass(s)
    if (!(m > 0)) return
    var n = count(s), b, demand, launch, spend
    for (b = 0; b < n - 1; b++) {
      if (!(sur[b] > 0) || !(num(s.a3.bands.n[b]) > 0)) continue
      demand = aDis * total * (sur[b] / total) / (m * a.PROP_K)
      launch = Math.min(demand, num(s.a3.bands.n[b]) * a.MAXLAUNCH * aDis)
      if (!(launch > 0)) continue
      spend = Math.min(launch * dt * m * a.PROP_K, heldCarbon(s))
      launch = spend / (m * a.PROP_K * dt)
      if (!(launch > 0)) continue
      addCarbon(s, -spend)
      addN(s, b, -launch * dt)
      pushTransit(s, b, launch * dt, legTau(s, b))
    }
  }

  // One launch record per band per tick is twenty records a second per leg, and a leg is up to
  // 1,340 s long (`TAU_GROWTH^10`), so a fully-dispersing void carries tens of thousands of live
  // records. Measured, the void reached 30,979 of them: `a3.transit` serialised to 2.16 MB of a
  // 2.18 MB save — the whole rest of Act III is 20 KB — which is past what localStorage will take,
  // and iterating it twenty times a second is most of the act's frame cost.
  //
  // Launches on the same leg in the same second are indistinguishable to everything downstream:
  // the readout is a total in transit, attrition is a rate applied uniformly, and arrival is a
  // count times pEst. So they are one record, and the quantum is one second against a shortest leg
  // of ninety. Nothing the player can see moves.
  var TRANSIT_QUANTUM_S = 1.0

  function pushTransit (s, from, count, tRem) {
    var list = s.a3.transit, i
    for (i = list.length - 1; i >= 0; i--) {
      if (list[i].from !== from) continue
      // The list is append-ordered, so the newest record for this leg is the only merge candidate;
      // anything older has already drifted more than a quantum away.
      if (tRem - num(list[i].tRem) < TRANSIT_QUANTUM_S) {
        list[i].count = num(list[i].count) + count
        return
      }
      break
    }
    list.push({ from: from, to: from + 1, count: count, tRem: tRem })
  }

  // §7.7's attrition and arrival. The outer legs are where Dormancy stops being a tax and starts
  // being the difference between arriving and not; the MORTALITY panel says which of the two you
  // are paying for without ever naming the trait.
  function stepTransit (dt, state, opts) {
    var s = state || S()
    if (!s || !(dt > 0)) return
    void opts
    var a = A()
    var haz = a.TR_HAZ / (1 + TRAIT.DOR_TRANSIT * locus(s, DOR)) *
      (flagOn(s, 'sclerotial_coat') ? COAT_TR : 1)
    var keep = Math.exp(-haz * dt)
    var list = s.a3.transit, i = 0, c, lost, land
    while (i < list.length) {
      c = list[i]
      lost = num(c.count) * (1 - keep)
      c.count = num(c.count) - lost
      attribute(CAUSE.TRANSIT, lost, s)
      c.tRem = num(c.tRem) - dt
      if (c.tRem > 0 && c.count > 0) { i++; continue }
      if (c.count > 0) {
        land = c.count * arrivalPEst(s, c.to)
        addN(s, c.to, land)
        attribute(CAUSE.ESTAB, c.count - land, s)
        // The site the survivors landed on is a site they surveyed to land on (see LANDING_E).
        if (land > 0 && num(s.a3.bands.e[c.to]) < LANDING_E) s.a3.bands.e[c.to] = LANDING_E
        stat(s, 'targetsReached', 1)
      }
      list.splice(i, 1)
    }
  }

  // §7.7. Ballistics throws further and lands harder; Germination lands softer and does nothing
  // else. The cleanest pair in the trait web and the first one players find.
  function arrivalPEst (s, b) {
    var a = A()
    var mine = num(field(s).n[b]), wild = wildIn(s, b)
    var share = (mine + wild) > 0 ? wild / (mine + wild + 1) : 0
    var p = a.GERM_BASE * (1 + TRAIT.GER_EST * locus(s, GER)) /
      (1 + TRAIT.BAL_EST * locus(s, BAL)) *
      Math.pow(explored(s, b), SITEQ_EXP) * (1 - WILD_EST * share) * mult(s, 'germMult')
    return C().clamp(p, PEST_MIN, PEST_MAX)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 10 · EXPLORATION — §6.3
  // ───────────────────────────────────────────────────────────────────────────

  // Never automated and never a button: a passive consequence of being somewhere, which is exactly
  // right for a fungus. The min(4, …) clamp is why you cannot brute-force knowledge with mass.
  function stepExploration (dt, opts, state) {
    var s = state || S()
    if (!s || s.act !== 3 || !(dt > 0) || inCanopy(s)) return
    void opts
    var a = A(), n = count(s), b, ref, x, de
    for (b = 0; b < n; b++) {
      var e = num(s.a3.bands.e[b])
      if (e >= 1) continue
      ref = NREF(s, b)
      if (!(ref > 0)) continue
      x = Math.min(EXPLORE_CLAMP, Math.pow(num(s.a3.bands.n[b]) / ref, EXPLORE_EXP))
      if (!(x > 0)) continue
      de = a.EXP_K * (1 + TRAIT.BAL_EXPLORE * locus(s, BAL)) * mult(s, 'exploreMult') * (1 - e) * x
      s.a3.bands.e[b] = C().clamp(e + de * dt, 0, 1)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 14 · LADDERS AND DERIVED MILESTONES
  // ───────────────────────────────────────────────────────────────────────────

  // cognition.js owns the D grants in both acts; what belongs here is `pc`, the mortality window,
  // and the one behavioural latch nothing else can see — the band whose SURPLUS is falling while
  // its `n` rises. That is BLOOM COLLAPSE (§10.2) and it is the act's central lesson, so the
  // console names it once and never explains it.
  function stepLadders (dt, opts, state) {
    var s = state || S()
    if (!s || s.act !== 3 || !(dt > 0)) return
    void opts
    decayMortality(s, dt)

    var b = biggest(s)
    if (b < 0) { humpFor = 0; return }
    var nb = num(field(s).n[b]), sb = surplus(b, s)
    if (nb > lastHumpN && sb < lastHumpSurplus) humpFor += dt
    else humpFor = 0
    lastHumpN = nb
    lastHumpSurplus = sb
    if (humpFor >= SURPLUS_HUMP_S) fire('a3.max_surplus')
  }

  function biggest (s) {
    var n = count(s), b, best = -1, bv = 0
    for (b = 0; b < n; b++) {
      if (!live(s, b)) continue
      if (num(field(s).n[b]) > bv) { bv = num(field(s).n[b]); best = b }
    }
    return best
  }

  function bandName (s, b) {
    return inCanopy(s) ? (BIOMES[b] ? BIOMES[b].name : '' + b) : 'Band ' + b
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Λ — what cognition.js reads instead of Act II's live interface (§12.1)
  // ───────────────────────────────────────────────────────────────────────────

  // The ^0.18 exponent is very flat on purpose: a band that is 1e11 times richer is 42 times
  // smarter. You get vastly richer without getting proportionally cleverer, so expansion is an
  // economic decision and the only cognitive lever is dLag.
  //
  // NSIG is a reference *count*, so in the canopy it is counted in canopy craft — the last constant
  // reconciliation 2 had left in void units, and the one that decided whether Phase A finishes.
  // Λ is what Act III's Sc and Sr are both built on (§12.1), so a Λ measured against a craft a
  // thousand times too large made Phase A's own published prices unpayable at every allocation of
  // D: measured, Sc peaked at 4.57e5 Σ against a seventh REACH of 4.38e5 Σ and an ESCAPE of 6.20e5
  // Σ, and — because Λ loses a whole term each time a biome empties — the ceiling then receded
  // faster than 214 Σ/s could fill it. The run reached 2.65e5 Σ at minute 75, watched Sc fall
  // through it, never opened Permafrost (1.70e18 g, 42% of the planet), stalled at pc 0.578 against
  // an ESCAPE_PC of 0.97, and starved to zero craft at minute 107 with 1.73e18 Χ banked and nothing
  // left that could spend it. In canopy units Λ is 14.7 at a whole-planet n* rather than 4.25,
  // which is 2.66× on both Sc and Sr, and §3.3's "identical equations" becomes true of the
  // cognition the equations are read through as well as of the equations.
  function Lambda (state) {
    var s = state || S()
    if (!s || s.act !== 3) return 0
    var a = A(), n = count(s), b, acc = 0, q
    var ref = a.NSIG * (inCanopy(s) ? CANOPY_SCALE : 1)
    for (b = 0; b < n; b++) {
      q = num(field(s).n[b]) / ref
      if (!(q > 0)) continue
      acc += lambda(s, b) * Math.pow(q, a.LAMBDA_EXP)
    }
    return acc
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DERIVED READOUTS
  // ───────────────────────────────────────────────────────────────────────────

  // BIBLE §2.2: pc = 1 − ΣX_b/ΣX0_b over the eight biomes. The player is never told the total.
  function planetConsumed (state) {
    var s = state || S()
    if (!s || s.act !== 3) return 0
    // A biome table that has never been seeded is not a planet that has been eaten. Reading the
    // empty Act I shape as pc = 1 is how ESCAPE VELOCITY offered itself on a cold boot.
    if (!s.a3.biomes.reached[0]) return 0
    var X0 = A().BIOME_X0, i, held = 0, all = 0
    for (i = 0; i < X0.length; i++) { held += num(s.a3.biomes.X[i]); all += num(X0[i]) }
    return all > 0 ? C().clamp(1 - held / all, 0, 1) : 0
  }

  function biomeDepleted (i) {
    var s = S()
    if (!s) return 0
    var x0 = num(A().BIOME_X0[i])
    return x0 > 0 ? C().clamp(1 - num(s.a3.biomes.X[i]) / x0, 0, 1) : 0
  }

  // A row of the BIOMES list or the band row: everything the panel shows and nothing it does not.
  function card (b, state) {
    var s = state || S()
    if (!s) return null
    return {
      id: b,
      name: bandName(s, b),
      reached: live(s, b),
      n: num(field(s).n[b]),
      X: num(field(s).X[b]),
      X0: X0of(s, b),
      e: explored(s, b),
      rich: richness(s, b),
      richKnown: richKnown(s, b),
      NCAP: NCAP(s, b),
      harvest: harvestOf(s, b),
      subsist: subsistOf(s, b),
      surplus: surplus(b, s),
      nStar: nStar(b, s),
      nDagger: nDagger(b, s),
      wild: wildIn(s, b),
      // H4 buys the tick mark and nothing else. Selling the player the answer to the act's best
      // question at minute forty would be a crime, so it is expensive and it is late.
      showStar: flagOn(s, 'allometry')
    }
  }

  function list (state) {
    var s = state || S()
    if (!s) return []
    var n = count(s), b, out = []
    for (b = 0; b < n; b++) out.push(card(b, s))
    return out
  }

  // H5's forty seconds of notice, as the void canvas and the console want it.
  function stellarWarnings () {
    var s = S(), out = [], i
    if (!s) return out
    for (i = 0; i < warnings.length; i++) {
      out.push({ band: warnings[i].band, inS: Math.max(0, warnings[i].at - num(s.t)) })
    }
    return out
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PHASE A's VERBS
  // ───────────────────────────────────────────────────────────────────────────

  // §3.1. The first number the player sees in Act III is going down, and this is the only thing
  // that can be done about it. Forty-two in a hundred take hold; the rest are on rock or in water.
  function settle (state) {
    var s = state || S()
    if (!s || !inCanopy(s)) return 0
    var q = Math.min(num(s.res.spores), A().SETTLE_Q)
    if (!(q > 0)) return 0
    C().setStock(s.res, 'spores', num(s.res.spores) - q)
    var got = q * SETTLE_P_EST
    s.a3.biomes.n[0] = num(s.a3.biomes.n[0]) + got
    stat(s, 'seededCount', 1)
    fire('a3.settle')
    return got
  }

  function reachedCount (s) {
    var i, k = 0
    for (i = 0; i < s.a3.biomes.reached.length; i++) if (s.a3.biomes.reached[i]) k++
    return k
  }

  // §3.2. Ordering matters and there is no correct order: 2,600 · 6,110 · 14,360 · 33,750 ·
  // 79,300 · 186,400 · 438,000 Σ, and the player will never play the same one twice.
  function reachCost (state) {
    var s = state || S()
    if (!s) return Infinity
    var a = A()
    return a.REACH_BASE * Math.pow(a.REACH_GROWTH, Math.max(0, reachedCount(s) - 1))
  }

  function canReach (s, b) {
    if (!inCanopy(s) || !flagOn(s, 'appressorium')) return false
    if (!(b > 0 && b < BIOMES.length) || s.a3.biomes.reached[b]) return false
    if (BIOMES[b].needs && !flagOn(s, BIOMES[b].needs)) return false
    return reachedCount(s) >= BIOMES[b].tier
  }

  function reach (biomeId, state) {
    var s = state || S()
    if (!s) return false
    var b = Math.floor(num(biomeId))
    if (!canReach(s, b)) return false
    var cost = reachCost(s)
    if (!(num(s.res.signal) >= cost)) return false
    C().setStock(s.res, 'signal', num(s.res.signal) - cost)
    s.a3.biomes.reached[b] = 1

    // A biome with nothing in it can never be grown into, because replication and exploration are
    // both proportional to what is already there. REACH is the door and it carries a quarter of
    // the standing fleet through, taken proportionally from every row already held.
    var i, fleet = 0
    for (i = 0; i < s.a3.biomes.n.length; i++) fleet += num(s.a3.biomes.n[i])
    var seed = fleet * REACH_SEED
    if (seed > 0) {
      for (i = 0; i < s.a3.biomes.n.length; i++) {
        if (i === b) continue
        s.a3.biomes.n[i] = num(s.a3.biomes.n[i]) * (1 - REACH_SEED)
      }
      s.a3.biomes.n[b] = num(s.a3.biomes.n[b]) + seed
    }
    stat(s, 'claimedCount', 1)
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ESCAPE VELOCITY — the sub-act transition (§4, BIBLE D26)
  // ───────────────────────────────────────────────────────────────────────────

  // You lose 96% of your fleet. Not to a hazard — to physics. Getting off a planet costs mass and
  // the game charges it as mass, exactly, never stochastically, and never through attribute():
  // this is not a death, it is a conversion, and putting it on the MORTALITY panel would be a lie.
  function escape (state) {
    var s = state || S()
    if (!s || s.act !== 3 || inVoid(s)) return false
    var a = A()
    var survivors = totalCraft(s) * (1 - a.ESCAPE_LOSS)
    var i

    // 1 · Revoke Phase A entirely. The eight rows, the verb that opened them, and the verb that
    //     filled them. SETTLE never returns.
    for (i = 0; i < s.a3.biomes.X.length; i++) {
      s.a3.biomes.X[i] = 0
      s.a3.biomes.n[i] = 0
      s.a3.biomes.reached[i] = 0
    }
    s.a3.transit.length = 0
    C().setStock(s.res, 'spores', 0)

    // 2 · Build the void. Thirteen bands; band 0 is Sol, and it is the one place there is nothing
    //     left to explore, which is also the only reason the void can be bootstrapped at all.
    initBands(s)
    s.a3.bands.n[0] = survivors
    s.a3.bands.e[0] = 1

    // 3 · What survives: carbon, Insight, the Signal multipliers, D, LEGACY, minerals.
    s.phase = 'void'
    s.proj.flags.void_t = num(s.t)
    xResid = null
    carbonResid = 0
    cumResid = 0
    for (i = 0; i < s.a3.mortality.length; i++) s.a3.mortality[i] = 0
    warnings.length = 0
    if (HY.log && HY.log.playSequence) HY.log.playSequence('escape')
    if (HY.state && HY.state.save) { try { HY.state.save() } catch (e) { void 0 } }
    return true
  }

  function initBands (s) {
    var n = bandCount(), b, h
    for (b = 0; b < n; b++) {
      s.a3.bands.X[b] = bandX0(b)
      s.a3.bands.n[b] = 0
      s.a3.bands.nResid[b] = 0
      s.a3.bands.e[b] = 0
      s.a3.bands.drift[b] = 0
      s.a3.bands.phase[b] = 0
      // Richness is seeded from the world seed, so the same seed reproduces the same galaxy
      // forever, and it is unknown to the player until the band is a fifth explored.
      h = C().hash32(s.seed, 'rich', b) / 4294967296
      s.a3.bands.rich[b] = RICH_MIN + RICH_SPAN * h
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE LIFECYCLE
  // ───────────────────────────────────────────────────────────────────────────

  // Called from the first line of every step, so the act break, a load and a harness's cold start
  // all take the same path. `enter` is idempotent and cheap; the boundary work is not.
  function enter (s, o) {
    if (o && o.offline !== wasOffline) {
      wasOffline = !!(o && o.offline)
      // §22's cap is budgeted once for the whole absence, not per macro-step.
      if (wasOffline) predBudget = totalCraft(s) * OFFLINE_PRED_CAP
      else predBudget = Infinity
    }
    if (lastAct === 3) return
    lastAct = 3
    seedCanopy(s)
  }

  // BIBLE §2.2: fidelityBase = 0.72 + 0.28·legacy, written on entry to Act III and never
  // recomputed. It is recomputed here on every entry anyway, because `legacy` is written once by
  // ASCOSPORE and destroyed nothing since — a function of a frozen input is a snapshot however
  // often it is evaluated, and this way a reload cannot lose it and §3 gains no key.
  function seedCanopy (s) {
    var a = A()
    s.carry.fidelityBase = a.FID_BASE_A + a.FID_BASE_B * C().clamp(num(s.carry.legacy), 0, 1)
    if (inVoid(s)) {
      if (!(num(s.a3.bands.X[bandCount() - 1]) > 0)) initBands(s)
      return
    }
    // The eight biomes exist from the first frame of the act; only The Stand is reachable, and it
    // is 0.05% of the planet. Everything else is a number the player cannot touch yet.
    var i, seeded = false
    for (i = 0; i < s.a3.biomes.X.length; i++) if (num(s.a3.biomes.X[i]) > 0) seeded = true
    if (!seeded) {
      for (i = 0; i < s.a3.biomes.X.length; i++) s.a3.biomes.X[i] = num(a.BIOME_X0[i])
    }
    s.a3.biomes.reached[0] = 1
  }

  function init (s) {
    s = s || S()
    xResid = null
    carbonResid = 0
    cumResid = 0
    warnings.length = 0
    humpFor = 0
    lastHumpN = 0
    lastHumpSurplus = 0
    newCraft = null
    predBudget = Infinity
    wasOffline = false
    lastAct = s ? (s.act === 3 ? 0 : s.act) : 0
    if (s && s.act === 3) { lastAct = 3; seedCanopy(s) }
  }

  function tick (s, dt, o) {
    s = s || S()
    if (!s || s.act !== 3 || !(dt > 0)) return
    stepHarvest(dt, o, s)
    stepSubsist(dt, o, s)
    stepAllocation(dt, o, s)
    stepExploration(dt, o, s)
    stepLadders(dt, o, s)
  }

  function serialise () { return null }         // every persistent byte lives in §3's a3
  function migrate () { return true }

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — D24 first, because it is the act
  // ───────────────────────────────────────────────────────────────────────────

  // A sandbox, so nothing here can perturb a live run. Every function that matters takes its state
  // explicitly for exactly this reason.
  function sandbox (phase) {
    var s = HY.state.newGame(0x9E3779B9, { sclerotium: 0, upgrades: [], runs: 0 })
    s.act = 3
    s.phase = phase || 'canopy'
    s.carry.legacy = 0
    seedCanopy(s)
    if (phase === 'void') { initBands(s); s.a3.bands.e[0] = 1 }
    return s
  }

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }
    function near (a, b, tol, label) {
      if (!(Math.abs(a - b) <= tol)) f.push(label + ': got ' + a + ', want ' + b + ' ±' + tol)
    }
    if (!HY.state || !HY.state.newGame) return ['state.js is absent; bloom cannot be checked']
    var a = A()

    // ── D24 · the maximum-surplus point ──────────────────────────────────────
    // Baseline is §7.5's: tMyc = 0, e = 1, rich = 1, dep = 1, μ_dor = 1, no wild. Band 5 is picked
    // because it is neither of the two ends of the geometry.
    var v = sandbox('void')
    var B = 5
    v.a3.bands.e[B] = 1
    v.a3.bands.rich[B] = 1
    v.a3.bands.X[B] = bandX0(B)
    var cap = NCAP(v, B)
    near(harvCoef(v, B) / subCoef(v), a.AS_RATIO, 1e-9 * a.AS_RATIO,
      'A/S at baseline is not AS_RATIO')
    near(nStar(B, v) / cap, a.N_STAR_K, 5e-3, 'n* is not N_STAR_K·NCAP')
    near(nDagger(B, v) / cap, a.N_DAGGER_K, 5e-3, 'n† is not N_DAGGER_K·NCAP')
    near(nStar(B, v) / nDagger(B, v), 0.109, 1e-3, 'n*/n† is not 10.9%')

    // A band filled to capacity produces nothing at all. This is the assertion; the readout is
    // the only place the player ever meets it.
    v.a3.bands.n[B] = nDagger(B, v)
    var sAtCap = surplus(B, v)
    var flow = subsistOf(v, B)
    ok(flow > 0, 'the capacity band has no subsistence flow to measure against')
    ok(Math.abs(sAtCap) <= 1e-9 * flow,
      'a band at carrying capacity does not produce exactly zero: ' + sAtCap + ' of ' + flow)

    // …and n* really is the maximum, not merely a formula: sample either side of it.
    v.a3.bands.n[B] = nStar(B, v)
    var peak = surplus(B, v)
    v.a3.bands.n[B] = nStar(B, v) * 0.80
    var lo = surplus(B, v)
    v.a3.bands.n[B] = nStar(B, v) * 1.25
    var hi = surplus(B, v)
    ok(peak > lo && peak > hi, 'surplus is not maximised at n*: ' + lo + ' / ' + peak + ' / ' + hi)

    // As X depletes, n* falls under the player. No scripted gate does this; depletion does.
    var nStarFull = nStar(B, v)
    v.a3.bands.X[B] = bandX0(B) * 0.25
    ok(nStar(B, v) < nStarFull, 'n* does not fall as the band depletes')
    v.a3.bands.X[B] = bandX0(B)

    // Myceliation raises A/S and therefore both n* and the surplus at it (§7.5's table).
    v.a3.loci[MYC] = 4
    near(harvCoef(v, B) / subCoef(v), a.AS_RATIO * 3.20, 1e-6 * a.AS_RATIO * 3.20,
      'tMyc = 4 does not put A/S at 213')
    v.a3.loci[MYC] = 0

    // ── the genome tax ───────────────────────────────────────────────────────
    var m0 = craftMass(v)
    v.a3.loci[GER] = 8
    var m8 = craftMass(v)
    near(m8, a.CRAFT_M0 * Math.pow(1 + a.GEN_TAX * 8, a.GEN_EXP), 1,
      'craftMass does not follow BIBLE §2.2')
    ok(m8 > m0, 'a longer genome does not cost more to copy')
    v.a3.loci[GER] = 0

    // ── fidelity ─────────────────────────────────────────────────────────────
    // The counter to divergence causes divergence: six Antagonism costs more fidelity than seven
    // Fidelity can buy back (§9.2).
    v.carry.legacy = 0.06
    seedCanopy(v)
    near(num(v.carry.fidelityBase), a.FID_BASE_A + a.FID_BASE_B * 0.06, 1e-12,
      'fidelityBase is not 0.72 + 0.28·legacy')
    v.a3.loci[ANT] = 6
    var fidAnt = effFid(v)
    v.a3.loci[ANT] = 0
    v.a3.loci[FID] = 7
    var fidFid = effFid(v)
    v.a3.loci[FID] = 0
    ok(num(v.carry.fidelityBase) - fidAnt > fidFid - num(v.carry.fidelityBase),
      'tAnt = 6 costs less fidelity than tFid = 7 buys')
    v.a3.loci[ANT] = 26
    ok(effFid(v) >= a.FID_MIN, 'effFid fell through its floor')
    v.a3.loci[ANT] = 0
    v.carry.legacy = 0

    // ── ESCAPE destroys exactly 96% ──────────────────────────────────────────
    var c = sandbox('canopy')
    c.a3.biomes.reached[3] = 1
    c.a3.biomes.n[0] = 4.0e8
    c.a3.biomes.n[3] = 1.0e8
    c.a3.transit.push({ from: 0, to: 1, count: 2.5e7, tRem: 10 })
    var before = totalCraft(c)
    ok(escape(c), 'ESCAPE refused a state that met its conditions')
    near(totalCraft(c) / before, 1 - a.ESCAPE_LOSS, 1e-12,
      'ESCAPE did not destroy exactly ESCAPE_LOSS of the fleet')
    ok(c.phase === 'void', 'ESCAPE did not open the void')
    ok(c.a3.bands.n[0] === before * (1 - a.ESCAPE_LOSS), 'the survivors did not land in band 0')
    var i, biomesLeft = 0
    for (i = 0; i < c.a3.biomes.X.length; i++) biomesLeft += c.a3.biomes.X[i] + c.a3.biomes.n[i]
    ok(biomesLeft === 0, 'ESCAPE left a biome standing')
    ok(c.a3.transit.length === 0, 'ESCAPE left craft in flight')
    ok(mortality(c).total === 0, 'ESCAPE attributed its conversion as mortality')
    near(bandX0(12) / bandX0(11), a.X0_GROWTH, 1e-9, 'the band carbon ladder is wrong')
    // §6.1's table rounds each step; the law is the number that ships, and the two agree to 0.2%.
    near(bandRadius(12), a.R_BASE * Math.pow(a.R_GROWTH, 11), 1e-6,
      'band 12 does not follow the radius law')
    near(bandRadius(12), 54535, 120, 'band 12 is not at the rim of the disc')
    near(lambda(c, 12), 0.152, 1e-3, 'λ_12 is not 0.152 at dLag 0')
    near(lambda(c, 1), 0.923, 1e-3, 'λ_1 is not 0.923 at dLag 0')

    // ── mortality is attributed, and only through attribute() ────────────────
    var d = sandbox('void')
    d.a3.bands.n[3] = 1.0e12
    kill(d, 3, 2.0e11, CAUSE.RAD)
    var mo = mortality(d)
    near(mo.rows[CAUSE.RAD].count, 2.0e11, 1, 'a radiation death was not attributed')
    near(mo.total, 2.0e11, 1, 'the ledger holds a death it was not told about')
    near(mo.rows[CAUSE.RAD].frac, 1, 1e-9, 'the panel percentage is wrong')
    ok(mo.rows.length === a.MORTALITY_CAUSES, 'the ledger is not six causes wide')
    for (i = 0; i < mo.rows.length; i++) ok(!!CAUSE_LABEL[i], 'cause ' + i + ' has no label')
    ok(attribute('nonsense', 5, d) === 0, 'the ledger accepted a seventh cause')
    // The window is 60 s: a death decays to 1/e of itself over exactly that.
    decayMortality(d, a.MORTALITY_WINDOW)
    near(num(d.a3.mortality[CAUSE.RAD]) / 2.0e11, Math.exp(-1), 1e-9,
      'the rolling window is not MORTALITY_WINDOW long')

    // Starvation kills at the rate that closes the deficit, attributes STARVE, and hands the
    // ground back 55% of what it took (§7.4).
    var e = sandbox('void')
    e.a3.bands.e[4] = 1
    e.a3.bands.rich[4] = 1
    e.a3.bands.n[4] = nDagger(4, e) * 4          // four times what the band can carry
    var xBefore = e.a3.bands.X[4], nBefore = e.a3.bands.n[4]
    stepStarvation(e, 1)
    ok(e.a3.bands.n[4] < nBefore, 'an over-full band did not starve')
    near(num(e.a3.mortality[CAUSE.STARVE]), nBefore - e.a3.bands.n[4], 1e-3,
      'starvation was not attributed at the point it occurred')
    ok(e.a3.bands.X[4] > xBefore, 'a starved craft returned no mass to the band')

    // ── the transit ledger ───────────────────────────────────────────────────
    var g = sandbox('void')
    g.a3.bands.e[1] = 1
    g.a3.bands.n[1] = 0
    g.a3.transit.push({ from: 0, to: 1, count: 1.0e12, tRem: 1 })
    stepTransit(1, g, { stochastic: false, offline: false })
    ok(g.a3.transit.length === 0, 'an arrived cohort stayed in flight')
    var landed = num(g.a3.bands.n[1]) + num(g.a3.bands.nResid[1])
    var lost = num(g.a3.mortality[CAUSE.TRANSIT]) + num(g.a3.mortality[CAUSE.ESTAB])
    near(landed + lost, 1.0e12, 1e3, 'craft went missing between launch and landing')
    ok(num(g.a3.mortality[CAUSE.TRANSIT]) > 0, 'a full leg cost nothing in transit')
    ok(num(g.a3.mortality[CAUSE.ESTAB]) > 0, 'every craft in the cohort established')
    // Ballistics shortens the leg; Germination lands more of it. The cleanest pair in the web.
    var tau0 = legTau(g, 6)
    g.a3.loci[BAL] = 6
    ok(legTau(g, 6) < tau0, 'Ballistics did not shorten the leg')
    var pBal = arrivalPEst(g, 1)
    g.a3.loci[GER] = 4
    ok(arrivalPEst(g, 1) > pBal, 'Germination did not soften the landing')
    g.a3.loci[BAL] = 0; g.a3.loci[GER] = 0
    near(legTau(g, 11), a.TAU0 * Math.pow(a.TAU_GROWTH, 11), 1,
      'the 11→12 leg is not the longest wait in HYPHAE')

    // ── the triangle sums to one and spends only what it earns ───────────────
    var h = sandbox('void')
    setAlloc(3, 1, 1, h)
    near(h.a3.alloc[0] + h.a3.alloc[1] + h.a3.alloc[2], 1, 1e-12, 'alloc does not sum to 1')
    near(h.a3.alloc[0], 0.60, 1e-12, 'setAlloc did not normalise')
    ok(!setAlloc(0, 0, 0, h), 'setAlloc accepted an all-zero triangle')
    var al = liveAlloc(h)
    near(al[0] + al[1] + al[2], 1, 1e-12, 'the live triangle does not sum to 1')
    ok(al[1] === 0, 'DISPERSE had a share before THRUST was bought')
    ok(al[0] === 0 && al[2] === 1, 'surplus did not bank before the triangle existed')

    // ── Λ, and the timeToFill identity it has to preserve ────────────────────
    var k = sandbox('void')
    k.a3.bands.n[0] = 1.0e12
    var lam1 = Lambda(k)
    near(lam1, 1, 1e-9, 'Λ is not 1 for one NSIG of craft at band 0')
    k.a3.bands.n[0] = 1.0e23
    // ^0.18 is flat on purpose: 1e11 times the mass is 42 times the contribution.
    near(Lambda(k) / lam1, Math.pow(1e11, a.LAMBDA_EXP), 1e-6 * Math.pow(1e11, a.LAMBDA_EXP),
      'the Λ exponent is not LAMBDA_EXP')
    k.cog.dLag = 10
    ok(lambda(k, 12) > 0.152, 'dLag did not buy coherence across distance')

    // ── the genome is bought, not conjured ───────────────────────────────────
    var p = sandbox('void')
    p.a3.lociFree = a.LOCI_FREE0
    p.res.insight = 0
    ok(setLocus('MYC', 4, p), 'the four free loci could not be placed')
    ok(!setLocus('MYC', 5, p), 'a fifth locus was placed with no Insight')
    p.res.insight = locusCost(0) + locusCost(1)
    ok(setLocus('MYC', 6, p), 'two paid loci were refused with the price in hand')
    near(num(p.res.insight), 0, 1e-9, 'the paid loci were not charged')
    ok(!setLocus('MYC', 3, p), 'a locus came back out without a REGENOME')
    p.a3.lociCap = 6
    ok(!setLocus('BAL', 1, p), 'the locus cap was exceeded')
    p.a3.lociCap = a.LOCI_CAP0
    p.res.cumCarbon = 5.0e29
    near(regenomeCost(p), a.REGEN_FRAC * 5.0e29, 1e18, 'regenomeCost is not 2% of lifetime carbon')
    p.res.carbon = regenomeCost(p)
    ok(regenome(p), 'REGENOME refused with its price in hand')
    ok(genomeLength(p) === 0, 'REGENOME left the genome standing')
    ok(rewriting(p), 'REGENOME did not halt replication')
    ok(setLocus('DOR', 6, p), 'the freed loci could not be re-placed')
    near(regenomeCost(p) / (a.REGEN_FRAC * 5.0e29), a.REGEN_G, 1e-9,
      'the REGENOME price did not escalate')

    // ── Phase A ──────────────────────────────────────────────────────────────
    var q = sandbox('canopy')
    near(planetConsumed(q), 0, 1e-12, 'an untouched planet reads as consumed')
    q.res.spores = a.SETTLE_Q * 4
    var got = settle(q)
    near(got, a.SETTLE_Q * SETTLE_P_EST, 1, 'SETTLE does not take hold at 0.42')
    near(num(q.res.spores), a.SETTLE_Q * 3, 1, 'SETTLE did not spend a full charge of spores')
    // The Stand's max-surplus fleet is what GERM_TUBE asks for: twenty taps, and the crisis is over.
    near(nStar(0, q) / a.GERM_TUBE_N, 1, 0.25,
      'The Stand cannot carry the fleet GERM_TUBE wants')
    q.a3.biomes.X[0] = 0
    ok(planetConsumed(q) > 0 && planetConsumed(q) < 0.01,
      'The Stand is not 0.05% of the planet')
    ok(!canReach(q, 1), 'REACH worked without APPRESSORIUM')
    q.proj.flags.appressorium = 1
    ok(canReach(q, 1), 'the first biome was not reachable')
    ok(!canReach(q, 6), 'the marine biome was reachable without OSMOTIC ADJUSTMENT')
    near(reachCost(q), a.REACH_BASE, 1e-9, 'the first REACH is not REACH_BASE')
    q.res.signal = reachCost(q)
    var fleetBefore = q.a3.biomes.n[0]
    ok(reach(1, q), 'REACH refused with its price in hand')
    ok(q.a3.biomes.n[1] > 0, 'REACH opened a biome with nothing in it')
    near(q.a3.biomes.n[0] + q.a3.biomes.n[1], fleetBefore, 1,
      'REACH created or destroyed craft')
    near(reachCost(q), a.REACH_BASE * a.REACH_GROWTH, 1e-6, 'the reach ladder did not escalate')
    ok(biomeHarvMod(q, 2) < 1, 'the boreal frost penalty is missing')
    q.proj.flags.antifreeze_glycoprotein = 1
    ok(biomeHarvMod(q, 2) === 1 && biomeHarvMod(q, 7) === 1,
      'ANTIFREEZE GLYCOPROTEIN did not lift both cold penalties')

    // ── a canopy run actually runs ───────────────────────────────────────────
    // Not "the functions exist": a minute of the real tick, and carbon has to arrive without the
    // fleet dying, because that is what §3's beats one to three claim.
    var r = sandbox('canopy')
    r.res.spores = 2.0e9
    var taps
    for (taps = 0; taps < 20; taps++) settle(r)
    var n0 = r.a3.biomes.n[0]
    ok(n0 >= a.GERM_TUBE_N, 'twenty taps do not reach GERM_TUBE_N: ' + n0)
    var opts = { stochastic: false, offline: false }
    var secs
    for (secs = 0; secs < 60; secs++) tick(r, 1, opts)
    ok(num(r.res.carbon) > 0, 'a minute of Phase A harvested no carbon')
    ok(r.a3.biomes.n[0] > n0 * 0.5, 'the opening fleet starved: ' + r.a3.biomes.n[0])
    ok(num(r.res.cumCarbon) >= num(r.res.carbon), 'cumCarbon fell behind carbon')

    // ── a void run actually runs, and the fleet compounds ────────────────────
    var z = sandbox('void')
    z.a3.bands.n[0] = 4.0e9
    z.proj.flags.translocation = 1
    z.proj.flags.thrust = 1
    setAlloc(0.70, 0.20, 0.10, z)
    var z0 = z.a3.bands.n[0]
    for (secs = 0; secs < 300; secs++) tick(z, 1, opts)
    ok(z.a3.bands.n[0] > z0, 'five minutes in band 0 did not compound: ' + z.a3.bands.n[0])
    ok(z.a3.bands.e[0] === 1, 'band 0 stopped being home')
    ok(num(z.res.carbon) > 0, 'the void banked nothing at aBank = 0.10')
    ok(inTransit(z) > 0 || num(z.a3.bands.n[1]) > 0, 'DISPERSE launched nothing in five minutes')
    ok(isFinite(totalCraft(z)) && totalCraft(z) > 0, 'the fleet went non-finite')
    for (i = 0; i < bandCount(); i++) {
      ok(z.a3.bands.X[i] >= 0, 'band ' + i + ' went negative')
      ok(z.a3.bands.n[i] >= 0, 'band ' + i + ' has negative craft')
    }
    ok(num(z.res.carbon) >= 0, 'carbon went negative')

    return f
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE SURFACE — BIBLE §6 M13
  // ───────────────────────────────────────────────────────────────────────────

  HY.bloom = {
    // Phase A
    settle: settle,
    reach: reach,
    reachCost: reachCost,
    canReach: canReach,
    escape: escape,

    // the loop, in BIBLE §4's order
    stepHarvest: stepHarvest,
    stepSubsist: stepSubsist,
    stepSubsistence: stepSubsist,
    stepAllocation: stepAllocation,
    stepReplication: stepReplication,
    stepDispersal: stepDispersal,
    stepTransit: stepTransit,
    stepExploration: stepExploration,
    stepLadders: stepLadders,

    // the triangle and the closed form
    setAlloc: setAlloc,
    alloc: liveAlloc,
    surplus: surplus,
    nStar: nStar,
    nDagger: nDagger,
    harvestOf: harvestOf,
    subsistOf: subsistOf,

    // the genome
    craftMass: craftMass,
    effFid: effFid,
    setLocus: setLocus,
    locusCost: locusCost,
    nextLocusCost: nextLocusCost,
    genomeLength: genomeLength,
    regenome: regenome,
    regenomeCost: regenomeCost,
    regenomeTime: regenomeTime,
    rewriting: rewriting,
    AXES: AXES,

    // mortality — attribute() is the only way a craft may die
    attribute: attribute,
    mortality: mortality,
    senescedFraction: senescedFraction,
    HAZARD_CARD: HAZARD_CARD,
    CAUSE: CAUSE,

    // the readouts cognition, projects, log and ui ask for across the boundary
    Lambda: Lambda,
    planetConsumed: planetConsumed,
    biomeDepleted: biomeDepleted,
    totalCraft: totalCraft,
    stranded: stranded,
    inTransit: inTransit,
    wildIn: wildIn,
    newCraftIn: function (b) { return newCraft && newCraft[b] ? newCraft[b] : 0 },
    bandRadius: bandRadius,
    bandX0: bandX0,
    NCAP: function (b, s) { return NCAP(s || S(), b) },
    lambda: function (b, s) { return lambda(s || S(), b) },
    stellarWarnings: stellarWarnings,
    card: card,
    list: list,
    BIOMES: BIOMES,

    // §6's generic module surface
    init: init,
    tick: tick,
    serialise: serialise,
    migrate: migrate,

    __selftest: __selftest
  }
})(window.HY = window.HY || {})
