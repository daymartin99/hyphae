;(function (HY) {
  'use strict'

  // M7 · economy1.js — Act I's two-sided economy (BIBLE §6 M7).
  //
  // Two systems share this file because they share one thesis: a counterparty whose behaviour is a
  // response to yours, with a legible causal chain.
  //
  //   THE LITTER MARKET   a mean-reverting price walk with momentum, a scarcity-driven fair value
  //                       and a permanent self-inflicted inflation term. Instantiated twice: seven
  //                       substrate pools in Act I, and the single biomass/mineral pair of Act II.
  //   THE CONTRACT BOOK   six-plus species of tree whose willingness to pay is seasonal in the
  //                       opposite phase to your production, sold forward at a fixed rate against
  //                       posted collateral.
  //
  // BIBLE D21 is a hard requirement and it is enforced structurally rather than by review: every
  // function that can move a mineral rate — carbonDeficit, offer, accepts, signContract,
  // renegotiate, exitContract, deliverContracts — is a pure function of world state and player
  // choice. There is no rng handle in scope in any of them, and __selftest asserts that by reading
  // their own source text. The only randomness this module touches at all is the price innovation
  // (a supply process, disclosed as a sparkline) and the magnitude of a windthrow.
  //
  // Load order does not matter: core and state are read lazily, inside functions, and every Act II
  // and Act III module is feature-detected.

  function C () { return HY.core }
  function T () { return HY.core.TUNE }
  function S () { return HY.state ? HY.state.state : null }

  // log.js may not be mounted (headless harness, selftest); a missing console must never be an
  // exception at an event site.
  function say (id, tokens) {
    if (HY.log && HY.log.logFire) { try { HY.log.logFire(id, tokens) } catch (e) { /* console only */ } }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DATA TABLE 1 · DEADFALL (01 §5.5 for the biology, §5A.2 for the market)
  //
  // Seven rows of shape. `k` is the throughput weight — wood does not give fewer grams per gram,
  // it gives fewer grams per second — and it is the reason the bottleneck flips three or four
  // times across the act.
  //
  // `cap` and `fall` are 5A.2's CAP_PER_PATCH and FALL_PER_PATCH. Where 01 §5.5 prints a different
  // "market cap" and "base litterfall", 5A.2 governs: BIBLE §2.1 defines the substrate cap as
  // CAP_PER_PATCH·patches, and 5A.2's τ = cap/comp column is what the price dynamics were fitted
  // against. Using §5.5's numbers would move every τ and with it the whole learnability claim.
  // ───────────────────────────────────────────────────────────────────────────

  var DEADFALL = [
    { id: 'leaf',    k: 1.60, etaB: 1.00, etaS: 0.80, minPerG: 0,       price: 0.108, cap: 90000,  fall: 240, comp: 380 },
    { id: 'needle',  k: 1.00, etaB: 1.00, etaS: 1.00, minPerG: 0,       price: 0.130, cap: 60000,  fall: 150, comp: 250 },
    { id: 'twig',    k: 0.70, etaB: 1.15, etaS: 1.20, minPerG: 0,       price: 0.144, cap: 34000,  fall: 78,  comp: 140 },
    { id: 'bark',    k: 0.45, etaB: 1.30, etaS: 1.40, minPerG: 0.00012, price: 0.157, cap: 22000,  fall: 44,  comp: 92 },
    { id: 'log',     k: 0.22, etaB: 1.60, etaS: 1.80, minPerG: 0,       price: 0.180, cap: 120000, fall: 60,  comp: 96 },
    { id: 'stump',   k: 0.10, etaB: 2.20, etaS: 2.60, minPerG: 0,       price: 0.234, cap: 70000,  fall: 15,  comp: 24 },
    { id: 'carrion', k: 3.00, etaB: 0.80, etaS: 0.50, minPerG: 0.0400,  price: 0.240, cap: 1800,   fall: 1.1, comp: 2.4 }
  ]

  var TYPES = ['leaf', 'needle', 'twig', 'bark', 'log', 'stump', 'carrion']
  var U32 = 4294967296        // hash32's range; a stable hash used as a decision, never as a draw
  var IDX = {}
  for (var _i = 0; _i < TYPES.length; _i++) IDX[TYPES[_i]] = _i

  // Seasonal litterfall, [SPRING, SUMMER, AUTUMN, WINTER]. Autumn dumps six times the leaf litter
  // and winter takes it to 0.30×; that one row is the whole annual strategy and nothing states it.
  var SEASON_FALL = [
    [0.40, 0.60, 6.00, 0.30],   // leaf     abscission
    [1.00, 1.20, 1.60, 0.90],   // needle   conifers shed year-round
    [0.80, 0.70, 1.50, 2.40],   // twig     ice-break
    [1.10, 1.40, 1.00, 0.80],   // bark     summer sloughing
    [0.70, 0.60, 1.20, 1.90],   // log      winter windthrow
    [1.00, 1.00, 1.00, 1.00],   // stump    geology, not weather
    [0.60, 0.80, 1.00, 2.20]    // carrion  winter kill
  ]

  // ───────────────────────────────────────────────────────────────────────────
  // DATA TABLE 2 · SPECIES (01 §6.2, §6.3)
  //
  // `photo` and `need` are per season. `d = clamp(1 − photo/need, 0, 1)` and every mineral rate in
  // the act is a function of it, so this table is the annual calendar the player learns.
  //
  // `canopy` is crown rank. A tree standing under taller trees gets less light; that is the only
  // interaction between counterparties, and it makes the oak's arrival cost the hemlock something.
  // ───────────────────────────────────────────────────────────────────────────

  var SPECIES = {
    birch: {
      id: 'birch', base: 0.008, intake: 4, minRep: 0.55, canopy: 0.35, age0: 40,
      decid: true, bud: 0.08, conifer: false, clonal: false, ramets: 1, lifeSeasons: 0,
      photo: [1.25, 1.40, 0.75, 0.05], need: [1.00, 0.95, 0.85, 0.42]
    },
    aspen: {
      id: 'aspen', base: 0.011, intake: 9, minRep: 0.60, canopy: 0.40, age0: 70,
      decid: true, bud: 0.12, conifer: false, clonal: true, ramets: 3, lifeSeasons: 0,
      photo: [1.20, 1.45, 0.80, 0.04], need: [1.05, 1.00, 0.90, 0.45]
    },
    fir: {
      id: 'fir', base: 0.012, intake: 14, minRep: 0.70, canopy: 0.80, age0: 140,
      decid: false, bud: 0, conifer: true, clonal: false, ramets: 1, lifeSeasons: 0,
      photo: [0.92, 1.06, 0.88, 0.30], need: [1.00, 1.12, 0.92, 0.55]
    },
    hemlock: {
      id: 'hemlock', base: 0.010, intake: 3, minRep: 0.78, canopy: 0.55, age0: 220,
      decid: false, bud: 0, conifer: true, clonal: false, ramets: 1, lifeSeasons: 0,
      photo: [0.55, 0.62, 0.52, 0.22], need: [0.70, 0.72, 0.66, 0.40]
    },
    oak: {
      id: 'oak', base: 0.017, intake: 40, minRep: 0.925, canopy: 1.00, age0: 200,
      decid: true, bud: 0.30, conifer: false, clonal: false, ramets: 1, lifeSeasons: 0,
      photo: [1.10, 1.55, 1.05, 0.04], need: [1.05, 1.15, 1.30, 0.60], masts: true
    },
    elm: {
      id: 'elm', base: 0.036, intake: 25, minRep: 0.55, canopy: 0.70, age0: 90,
      decid: true, bud: 0.10, conifer: false, clonal: false, ramets: 1, lifeSeasons: 6,
      photo: [0.30, 0.28, 0.20, 0.02], need: [1.20, 1.25, 1.15, 0.70]
    },
    // The counterparty behind `the_hollow_beech`. Enormous appetite, shade-cast crown, a winter
    // deficit that never drops below 0.85, and — once that project is owned — a term length the
    // renegotiation rule cannot reach.
    beech: {
      id: 'beech', base: 0.014, intake: 60, minRep: 0.60, canopy: 0.85, age0: 160,
      decid: true, bud: 0.22, conifer: false, clonal: false, ramets: 1, lifeSeasons: 0,
      photo: [0.85, 1.05, 0.70, 0.03], need: [1.15, 1.20, 1.10, 0.62]
    }
  }

  // Which tree arrives with which patch (01 §9), and which arrives at which netRep threshold.
  // Both ladders are fixed rather than drawn, so "identical starting conditions" in D21 is literal:
  // two players who make different decisions face the same forest in the same order.
  var PATCH_TREES = [['birch'], ['aspen'], ['fir'], ['hemlock', 'fir'], ['elm'], ['oak']]
  var SPECIES_LIMIT = { fir: 2 }   // one of each, except the fir: Under the Hemlocks brings a second
  var REP_TREES = [
    { rep: 8, species: 'birch' },
    { rep: 22, species: 'aspen' },
    { rep: 38, species: 'fir' },
    { rep: 55, species: 'hemlock' },
    { rep: 72, species: 'beech' }
  ]

  // ───────────────────────────────────────────────────────────────────────────
  // DATA TABLE 3 · CONTRACT AND TREE COEFFICIENTS (01 §6.4–6.6, §7.3–7.4)
  // Every coefficient the offer formula, the acceptance test and the reputation ledger use.
  // ───────────────────────────────────────────────────────────────────────────

  var CT = {
    TERM_K: 0.11,             // termBonus = 1 + this·ln(1 + termSeasons)
    COLL_K: 0.30,             // collBonus ceiling, minus one
    COLL_SCALE: 900,          // g of collateral per (g/s of volume) per e-fold
    REP_A: 0.55,              // repMult intercept
    REP_B: 0.0075,            // repMult slope per reputation point
    NEED_K: 1.6,              // needMult = 1 + this·d^NEED_E
    NEED_E: 1.5,
    EXCL: 1.25,               // × on the rate for exclusivity
    INTAKE_REP_A: 0.60,       // maxIntake reputation intercept
    INTAKE_REP_B: 0.008,      // maxIntake reputation slope
    MAXTERM_DIV: 12,          // maxTerm = clamp(floor(1 + rep/this), TERM_MIN, TERM_MAX)
    PHOTO_M_A: 0.55,          // photosynthesis moisture term intercept
    PHOTO_M_B: 0.45,          // slope
    PHOTO_M_REF: 0.90,        // moisture at which the term saturates
    BUD_LO: 0.05,             // smoothstep bounds on spring leaf-out
    BUD_HI: 0.40,
    BUD_AMP: 1.9,             // need × (1 + this) at the exact peak of bud break
    BUD_W: 0.09,              // gaussian width of the bud-break window, in season phase
    MAST_NEED: 2.5,           // × autumn need in a mast year
    MAST_GAP_Y: 3,            // years between masts, minimum
    CANOPY_K: 0.10,           // light lost per unit of crown rank standing above you
    CANOPY_MIN: 0.55,         // floor on canopyLight
    FIRESCAR_D: 0.20,         // d reduction while distant ash is on the ground
    FIRESCAR_MINERAL: 3.0,    // × mineralPerG for the same season
    REP_DONE_A: 6,            // tree.rep += this + REP_DONE_B·termSeasons on completion
    REP_DONE_B: 2,
    NETREP_DONE: 1.0,
    // 01 §6.2 gives hemlock minerals that count ×1.6 "toward structures". That needs a second
    // mineral pool and §3 has exactly one, so the rider is not built rather than being faked with a
    // key the state shape does not have. Hemlock's distinctive value is what remains and it is
    // enough: the only counterparty that will sign an eight-season term at reputation 31.
    REP_FAIL: 22,             // tree.rep -= this·arbitration on default
    NETREP_FAIL: 4.0,
    REFUSE_SEASONS: 2,        // seasons a defaulted tree will not talk to you
    HEALTH_PER_COLL: 400000,  // g of forfeited collateral per unit of tree health
    EXIT_FRAC: 0.5,           // fee: this × the remaining delivery, in sugar
    EXIT_REP: 6,
    EXIT_NETREP: 1.0,
    RENEG_REP: 1,             // reputation cost of one renegotiation
    NEW_REP_A: 15,            // a new tree opens at clamp(this + NEW_REP_B·netRep, MIN, MAX)
    NEW_REP_B: 0.45,
    NEW_REP_MIN: 5,
    NEW_REP_MAX: 70,
    SOLICIT_P: 0.35,          // per tree per season, once the deficit has moved this far
    SOLICIT_D: 0.25,
    SOLICIT_VOL: 1.95,        // × the current volume — nearly double, for a 2.5% better rate
    SOLICIT_TERM: 4,          // seasons added
    TREE_MAX: 7,              // simultaneous counterparties
    DEATH_HEALTH: 0.05,       // health at or below which a tree stops being a counterparty
    BEETLE_HIT: 0.40,         // immediate health loss
    BEETLE_PER_SEASON: 0.10,  // continuous, while the infestation is active
    BEETLE_SEASONS: 6,
    BEECH_TERM: 12,           // the non-negotiable term `the_hollow_beech` signs
    OXALATE_RATE: 0.35        // ⛬/s, passive, scaled by hartigNet
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DATA TABLE 4 · MARKET-SIDE PROJECT EFFECTS AND THE ACT II EXCHANGE
  // ───────────────────────────────────────────────────────────────────────────

  var MK = {
    STEP_S: 1.0,              // s, the walk's natural step; every coefficient is calibrated here
    WIDE_AFTER: 12,           // s of backlog before the step is allowed to widen past STEP_S
    MAX_H: 10,                // s, widest step: MEAN_REV·h = 0.30, comfortably inside stability
    MAX_SUBSTEPS: 240,        // per call; a hard ceiling so one bad dt cannot stall a tick
    MIN_TRADE_G: 1,           // grams below which a fill is not worth a price impact
    ANTAGONISM: 0.78,         // × the printed price on leaf and needle, with bacterial_antagonism
    FORWARD_FILLS: 12,        // fills fixed by forward_contracts
    FORWARD_MARK: 1.05,       // × fair value, for each of them
    STANDING_PENALTY: 1.08,   // standing_order pays this much more than you would
    STANDING_FLOOR: 0.15,     // × cap: the stock level below which the standing order stops buying
    STANDING_MAX_FRAC: 0.02   // × cap per second: the automated fill rate
  }

  // 02 §10.4, verbatim. The same walk as the Litter Market with a different parameterisation,
  // demoted to one pair. P is grams of biomass per mineral.
  var MX = {
    P0: 125,                  // g biomass per ⛬ at the act break (2.0e6 g against 1.6e4 ⛬)
    REVERT: 0.0022,           // /s, pull of P toward Pbar
    MOM_GAIN: 0.019,          // /s, momentum's contribution to P
    SIGMA: 0.0090,            // /√s, innovation on P
    MOM_DECAY: 0.94,          // autocorrelation of momentum → trends on a ~60 s scale
    MOM_IN: 0.06,             // weight of the last relative move
    BUY_DRIFT: 0.00040,       // Pbar += this·n^0.55 per mineral bought
    SELL_DRIFT: 0.00018,      // Pbar -= this·n^0.55 per mineral sold — half as much, deliberately
    DRIFT_EXP: 0.55,
    PBAR_RELAX: 1 / 9000,     // /s, decay of Pbar toward P0 when untouched
    P_MIN: 8,                 // g/⛬, floor
    P_MAX: 4000               // g/⛬, ceiling
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DATA TABLE 5 · EVENTS OWNED BY THIS MODULE (01 §7.3–7.4)
  //
  // act1.js owns the roll (BIBLE §4 step 1). economy1 owns the table and the application, because
  // every payload here lands on a market row or a counterparty. Persistent modifiers are read from
  // `a1.activeEvents` on every tick, so they survive a reload without a second bookkeeping path.
  // ───────────────────────────────────────────────────────────────────────────

  var EVENTS = [
    { id: 'windthrow', domain: 'supply', seasons: [0, 1, 2, 3], p: 0.09,
      pBySeason: [0.09, 0.09, 0.18, 0.14], seasonsLeft: 2,
      logId: 'a1.windthrow' },
    { id: 'carrion', domain: 'supply', seasons: [0, 1, 2, 3], p: 0.10,
      pBySeason: [0.10, 0.10, 0.10, 0.22], seasonsLeft: 1,
      logId: 'a1.carrion' },
    { id: 'earthworm', domain: 'supply', seasons: [0, 1], p: 0.07, seasonsLeft: 3,
      logId: 'a1.earthworm' },
    { id: 'firescar', domain: 'supply', seasons: [0, 1, 2, 3], p: 0.03, seasonsLeft: 1,
      logId: 'a1.fire_scar' },
    { id: 'mast', domain: 'tree', seasons: [2], p: 0.12, seasonsLeft: 2, logId: 'a1.mast' },
    { id: 'beetle', domain: 'tree', seasons: [1], p: 0.06, seasonsLeft: CT.BEETLE_SEASONS,
      logId: 'a1.beetle' }
  ]

  var EV = {
    WINDTHROW_LOG: [8000, 42000],   // g of log per patch
    WINDTHROW_BARK: [2000, 9000],   // g of bark per patch
    WINDTHROW_MOM: -0.55,           // momentum shock on the log row
    WINDTHROW_BASE: 0.86,           // × the log row's base: a genuine, buyable price crash
    WINDTHROW_KILL_P: 0.18,         // sub-roll: the wind took a counterparty as well
    WINDTHROW_TRUNK: 0.55,          // × the dead tree's standing mass into the log pool
    TRUNK_MASS: 90000,              // g of trunk on a full-health canopy tree
    CARRION_G: [400, 1400],         // g, and the only fast mineral source in the game
    WORM_STRIP: 0.30,               // × leaf stock, immediately
    WORM_COMP: 2.2,                 // × leaf competition, while the invasion lasts
    WETSPRING_SOFT: 0.82            // × leaf and needle price while a wet spring lasts
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE-PRIVATE, NOT SAVED
  // ───────────────────────────────────────────────────────────────────────────

  // The 120-sample price ring of 5A.1. §3 excludes it from the save by design: it refills in 120 s
  // and costs 840 floats to persist.
  var hist = null
  var histFill = 0

  var acc = 0            // s of market time not yet stepped; sub-second phase, deliberately not saved
  var mxAcc = 0
  var ctx = { stochastic: true, offline: false }
  var lastPatches = 1
  var lastSeasonKey = -1
  var nextTreeId = 1
  var nextContractId = 1
  var solicits = []      // live solicitations; a decision, so it never survives an absence
  var standing = {}      // per-type standing-order overrides, a UI setting rather than game state
  var walk = null        // the price walk's own rng stream; never in scope in a pricing function
  var book = { deliveredSugar: 0, deferred: 0, reserve: 0 }

  // Reused rather than rebuilt: a twelve-hour reconcile calls walkCoef 240 times and five fresh
  // arrays per call is 1,200 allocations on the one path in the game with a hard millisecond budget.
  var coef = {
    h: 1, momDecay: 1, rev: 0, sig: 0, cool: 1,
    cap: [0, 0, 0, 0, 0, 0, 0], decay: [0, 0, 0, 0, 0, 0, 0], star: [0, 0, 0, 0, 0, 0, 0],
    mod: [1, 1, 1, 1, 1, 1, 1], floorBase: [0, 0, 0, 0, 0, 0, 0]
  }

  function opt (o) {
    if (!o) return ctx
    return {
      stochastic: o.stochastic === undefined ? true : !!o.stochastic,
      offline: !!o.offline
    }
  }

  function flag (s, id) { return !!(s.proj && s.proj.flags && s.proj.flags[id]) }
  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }

  // ───────────────────────────────────────────────────────────────────────────
  // THE LITTER MARKET · geometry
  // ───────────────────────────────────────────────────────────────────────────

  // S3/C7: supply is superlinear in patches, storage is linear. Stocks that scale slower than flows
  // are what make the late-act market thin and twitchy, and it is why claiming is the only real
  // answer to substrate scarcity.
  function capOf (type) {
    if (!known(type)) return 0
    var s = S()
    return DEADFALL[IDX[type]].cap * num(s.a1.patches)
  }

  function fallOf (type) {
    if (!known(type)) return 0
    var s = S(), i = IDX[type], A = T().A1
    var wf = s.a1.weatherFallMod && isFinite(s.a1.weatherFallMod[i]) ? s.a1.weatherFallMod[i] : 1
    return DEADFALL[i].fall * Math.pow(num(s.a1.patches), A.PATCH_SUPPLY_EXP) *
      SEASON_FALL[i][num(s.a1.season)] * wf
  }

  function compOf (type) {
    var i = IDX[type]
    var c = DEADFALL[i].comp * num(S().a1.patches)
    if (type === 'leaf' && eventActive('earthworm')) c *= EV.WORM_COMP
    return c
  }

  function totalSubstrate () {
    var s = S(), i, sum = 0
    for (i = 0; i < TYPES.length; i++) sum += num(s.a1.sub[TYPES[i]])
    return sum
  }

  // Every entry point that takes a type name from outside this file goes through this first: a
  // typo'd pool must be a no-op, not an exception inside a tick.
  function known (type) { return Object.prototype.hasOwnProperty.call(IDX, type) }

  function unlocked (type) {
    return known(type) && S().a1.unlockedTypes.indexOf(type) >= 0
  }

  function eventActive (id) {
    var s = S(), i, e = s.a1.activeEvents
    for (i = 0; i < e.length; i++) if (e[i] && e[i].id === id && e[i].seasonsLeft > 0) return e[i]
    return null
  }

  // Weather and supply events that move a price without moving the permanent base. Kept multiplicative
  // and outside `base` so they expire cleanly; the base only ever moves because the player traded.
  function eventPriceMod (type) {
    if ((type === 'leaf' || type === 'needle') && eventActive('wetspring')) return EV.WETSPRING_SOFT
    return 1
  }

  // The one place ash on the ground is worth anything. act1's decomposition reads this rather than
  // the raw table so the fire scar is felt where the player will notice it.
  function mineralPerG (type) {
    if (!known(type)) return 0
    var m = DEADFALL[IDX[type]].minPerG
    return eventActive('firescar') ? m * CT.FIRESCAR_MINERAL : m
  }

  function fairValue (type) {
    if (!known(type)) return 0
    var s = S(), i = IDX[type], A = T().A1
    var row = s.a1.mkt[i]
    var cap = capOf(type)
    var scarcity = cap > 0 ? C().clamp(1 - row.stock / cap, 0, 1) : 1
    return row.base * (1 + A.FAIR_K * Math.pow(scarcity, A.FAIR_EXP)) * eventPriceMod(type)
  }

  // What a gram actually costs this player, right now. Everything downstream — MAX buttons,
  // affordability, minPrice() and therefore the G1a failsafe and the G1b reserve — reads this and
  // not the printed price, because two projects drive a wedge between them.
  function unitPrice (type) {
    if (!known(type)) return 0
    var s = S(), row = s.a1.mkt[IDX[type]]
    if (forwardLeft(s) > 0) return MK.FORWARD_MARK * fairValue(type)
    var p = row.price * eventPriceMod(type)
    if ((type === 'leaf' || type === 'needle') && flag(s, 'bacterial_antagonism')) p *= MK.ANTAGONISM
    return p
  }

  function price (type) { return known(type) ? S().a1.mkt[IDX[type]].price : 0 }

  // forward_contracts is a trap and it is priced like one: a fixed 1.05 × fair for twelve fills,
  // which is above the median price you would otherwise pay and feels like safety. The fills spent
  // are counted in `proj.uses`, which is §3's per-project integer counter; the flag itself must
  // stay the untouched purchase marker that every other module tests.
  function forwardLeft (s) {
    if (!flag(s, 'forward_contracts')) return 0
    return Math.max(0, MK.FORWARD_FILLS - num(s.proj.uses.forward_contracts))
  }

  // The cheapest gram the player is currently allowed to buy. Stocked pools first; if the whole
  // floor is bare it still answers with a price, because G1a's failsafe compares the player's last
  // sugar against this number and an infinity there disarms the failsafe exactly when it is needed.
  function minPrice () {
    var s = S(), i, k, p, best = Infinity, bare = Infinity
    for (i = 0; i < TYPES.length; i++) {
      k = TYPES[i]
      if (!unlocked(k)) continue
      p = unitPrice(k)
      if (!(p > 0)) continue
      if (p < bare) bare = p
      if (s.a1.mkt[i].stock > 0 && p < best) best = p
    }
    return isFinite(best) ? best : bare
  }

  function priceHistory (type) {
    var i = IDX[type], out = [], j, n = Math.min(histFill, T().A1.HIST_LEN)
    if (!hist || !known(type)) return out
    for (j = n; j > 0; j--) out.push(hist[i][(histFill - j) % T().A1.HIST_LEN])
    return out
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE LITTER MARKET · the walk
  // ───────────────────────────────────────────────────────────────────────────

  // Everything that depends on `h` or on the world but not on the price, gathered once per call.
  // Neither the patch count nor the active-event list can change between the sub-steps of one call,
  // and seven pools × eighteen sub-steps × two hundred and forty macro-steps is the difference
  // between a twelve-hour reconcile that fits in D34's budget and one that costs 800 ms.
  function walkCoef (h) {
    var A = T().A1, i, k, tau, c = coef
    c.h = h
    c.momDecay = Math.pow(A.MOM_DECAY, h)
    c.rev = A.MEAN_REV * h
    c.sig = A.PRICE_SIGMA * Math.sqrt(h)
    c.cool = Math.pow(1 - A.COOL_RATE, h)
    for (i = 0; i < TYPES.length; i++) {
      k = TYPES[i]
      c.cap[i] = capOf(k)
      tau = c.cap[i] > 0 ? c.cap[i] / compOf(k) : 1
      c.decay[i] = Math.exp(-h / tau)
      c.star[i] = tau * fallOf(k)
      c.mod[i] = eventPriceMod(k)
      c.floorBase[i] = A.COOL_FLOOR * DEADFALL[i].price
    }
    return c
  }

  // One step of width `h` seconds. At h = 1 this is 01 §5A.3 term for term; the exponents are the
  // honest generalisation to a wider step and collapse back to the published coefficients exactly
  // at h = 1. Only an offline macro-step ever passes h > 1.
  //
  // Hot: an offline reconcile runs this ~4,300 times over seven pools. Locals and inline clamps
  // rather than core.clamp() — a namespace getter and a call per bound is 90,000 of each across a
  // twelve-hour return, and this is the only loop in the module where that is measurable.
  function walkStep (c, stochastic) {
    var s = S(), A = T().A1, i, row, cap, fair, gap, sc, m, p
    var mkt = s.a1.mkt, h = c.h
    var fairK = A.FAIR_K, fairE = A.FAIR_EXP, clampM = A.MOM_CLAMP
    var lo = A.PRICE_FLOOR, hi = A.PRICE_CEIL, coolS = A.COOL_S
    for (i = 0; i < TYPES.length; i++) {
      cap = c.cap[i]
      if (!(cap > 0)) continue
      row = mkt[i]

      // Supply. Solved rather than Euler-stepped: identical to 01's `stock += (fall − comp·s/cap)`
      // to six decimal places at h = 1, and unconditionally stable at the h an offline reconcile
      // uses. τ = cap/comp is 237 s for leaf and 2,917 s for stump, and that difference — a flow
      // that refills every autumn against a reserve you draw down across the act — is never stated.
      row.stock = c.star[i] + (row.stock - c.star[i]) * c.decay[i]
      if (!(row.stock > 0)) row.stock = 0
      else if (row.stock > cap) row.stock = cap

      // Price.
      sc = 1 - row.stock / cap
      if (!(sc > 0)) sc = 0
      else if (sc > 1) sc = 1
      // A saturated pool is the common case for most of autumn and for every pool the player is
      // not drawing on, and it is the one value of `sc` worth not paying a pow for.
      fair = row.base * (sc === 0 ? 1 : 1 + fairK * Math.pow(sc, fairE)) * c.mod[i]
      gap = fair > 0 ? (fair - row.price) / fair : 0
      m = c.momDecay * row.mom + c.rev * gap + (stochastic ? c.sig * walkGauss() : 0)
      if (!(m > -clampM)) m = -clampM
      else if (m > clampM) m = clampM
      row.mom = m
      p = row.price * (h === 1 ? 1 + m : Math.pow(1 + m, h))
      if (!(p > lo * row.base * c.mod[i])) p = lo * row.base * c.mod[i]
      else if (p > hi * row.base * c.mod[i]) p = hi * row.base * c.mod[i]
      row.price = p

      // The base only ever falls back toward 0.85× while you are not trading, and never below it.
      // The player's own appetite is the primary long-run driver of their input costs.
      row.coolT += h
      if (row.coolT > coolS && row.base > c.floorBase[i]) {
        row.base *= c.cool
        if (row.base < c.floorBase[i]) row.base = c.floorBase[i]
      }
    }
  }

  function walkGauss () {
    if (!walk) walk = C().rng(C().hash32('litter', S().seed))
    return walk.gauss()
  }

  function sample () {
    var s = S(), i, L = T().A1.HIST_LEN
    if (!hist) {
      hist = []
      for (i = 0; i < TYPES.length; i++) hist.push(new Float32Array(L))
    }
    for (i = 0; i < TYPES.length; i++) hist[i][histFill % L] = s.a1.mkt[i].price
    histFill += 1
  }

  // Live play always walks at exactly the 1 Hz the coefficients were fitted at; a backlog wider than
  // WIDE_AFTER seconds — which only an offline macro-step or a long catch-up produces — is walked in
  // steps of up to MAX_H instead. Ten seconds keeps the mean-reversion term at 0.30 per step, well
  // inside the stable régime, and it is a supply process rather than anything a decision reads.
  // Both walks pace themselves the same way, so the rule lives in one place. `owed` is the seconds
  // banked so far; the answer is a count and a width, and whatever it could not honestly consume.
  var pace = { n: 0, h: MK.STEP_S, rest: 0 }

  function paceSteps (owed) {
    var n = Math.floor(owed / MK.STEP_S), h = MK.STEP_S
    if (n < 1) { pace.n = 0; pace.h = h; pace.rest = owed; return pace }
    if (n > MK.WIDE_AFTER) {
      h = Math.min(MK.MAX_H, owed / MK.WIDE_AFTER)
      n = Math.floor(owed / h)
    }
    if (n > MK.MAX_SUBSTEPS) { n = MK.MAX_SUBSTEPS; h = owed / n }
    pace.n = n
    pace.h = h
    // A backlog this module cannot honestly walk is dropped rather than carried: loop.js never
    // hands over more than one macro-step at a time, and an unbounded accumulator would turn one
    // pathological call into a permanently slow tick.
    pace.rest = owed - n * h
    if (!(pace.rest > 0) || pace.rest > MK.MAX_H) pace.rest = 0
    return pace
  }

  function stepMarket (dt, o) {
    var s = S()
    if (!s || s.act !== 1) return
    var p = opt(o)
    var n, h, i, c
    acc += dt
    paceSteps(acc)
    n = pace.n
    h = pace.h
    if (n < 1) return
    acc = pace.rest
    c = walkCoef(h)
    // The sparkline is a 1 Hz record and 5A.1 already says it is not saved and refills in 120 s.
    // Feeding it ten-second offline steps would draw two hours of absence as two minutes of history.
    var record = (h === MK.STEP_S)
    var auto = flag(s, 'standing_order')
    for (i = 0; i < n; i++) {
      walkStep(c, p.stochastic)
      if (record) sample()
      if (auto) standingOrder(h)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE LITTER MARKET · trading
  // ───────────────────────────────────────────────────────────────────────────

  function buy (type, grams) {
    var s = S(), A = T().A1
    if (!s || s.act !== 1 || !unlocked(type)) return 0
    var i = IDX[type], row = s.a1.mkt[i], cap = capOf(type)
    var p = unitPrice(type)
    if (!(p > 0)) return 0
    var room = cap - num(s.a1.sub[type])
    grams = Math.min(num(grams), row.stock, s.res.sugar / p, room)
    if (!(grams >= MK.MIN_TRADE_G)) return 0

    var cost = grams * p
    C().setStock(s.res, 'sugar', s.res.sugar - cost)
    C().setStock(s.a1.sub, type, num(s.a1.sub[type]) + grams, cap)
    row.stock -= grams
    if (row.stock < 0) row.stock = 0

    // You are the inflation. Osmotic Priming halves it; nothing removes it.
    row.base *= 1 + A.INFL * num(s.mult.osmoticPriming) * grams / cap
    row.mom = C().clamp(row.mom + A.IMPACT * (grams / (0.05 * cap)), -A.MOM_CLAMP, A.MOM_CLAMP)
    row.coolT = 0

    if (forwardLeft(s) > 0) s.proj.uses.forward_contracts = num(s.proj.uses.forward_contracts) + 1

    s.stats.purchases += 1
    s.stats.sugarSpentOnMarket += cost
    if (cost > s.stats.largestSinglePurchase) s.stats.largestSinglePurchase = cost
    say(s.stats.purchases >= 10 ? 'a1.tenth_buy' : 'a1.first_buy')
    return grams
  }

  // The 28% spread is the whole message: substrate is not a savings account, and every purchase is
  // a commitment to digest. Gated on The Two-Sided Book, which is itself gated on having over-bought.
  function sell (type, grams) {
    var s = S(), A = T().A1
    if (!s || s.act !== 1 || !known(type) || !flag(s, 'two_sided_book')) return 0
    var i = IDX[type], row = s.a1.mkt[i], cap = capOf(type)
    grams = Math.min(num(grams), num(s.a1.sub[type]))
    if (!(grams >= MK.MIN_TRADE_G)) return 0

    C().setStock(s.res, 'sugar', s.res.sugar + grams * row.price * A.SPREAD)
    C().setStock(s.a1.sub, type, num(s.a1.sub[type]) - grams, cap)
    row.stock = Math.min(cap, row.stock + grams)
    row.base *= 1 - A.SELL_BASE_DROP * grams / cap
    if (row.base < A.COOL_FLOOR * DEADFALL[i].price) row.base = A.COOL_FLOOR * DEADFALL[i].price
    row.mom = C().clamp(row.mom - A.IMPACT * (grams / (0.05 * cap)), -A.MOM_CLAMP, A.MOM_CLAMP)
    row.coolT = 0
    return grams
  }

  // Standing Order: a chore automated, at a published margin. It buys at a ceiling of fair value and
  // pays 8% more than you would for the same gram, which is the number on its own card.
  function setStandingOrder (type, priceCeil, stockFloor) {
    standing[type] = { ceil: priceCeil, floor: stockFloor }
  }

  function standingOrder (h) {
    var s = S(), i, k, cfg, cap, ceil, floor, want, unit, got
    for (i = 0; i < TYPES.length; i++) {
      k = TYPES[i]
      if (!unlocked(k)) continue
      cap = capOf(k)
      cfg = standing[k] || {}
      ceil = isFinite(cfg.ceil) ? cfg.ceil : fairValue(k)
      floor = isFinite(cfg.floor) ? cfg.floor : MK.STANDING_FLOOR * cap
      unit = unitPrice(k) * MK.STANDING_PENALTY
      if (!(unit > 0) || unit > ceil) continue
      if (num(s.a1.sub[k]) >= floor) continue
      want = Math.min(MK.STANDING_MAX_FRAC * cap * h, s.res.sugar / unit)
      if (want < MK.MIN_TRADE_G) continue
      // The 8% is charged on what was actually filled, after the fill, so `buy` stays the one path
      // through which a gram of substrate can ever be acquired.
      got = buy(k, want)
      if (got > 0) {
        C().setStock(s.res, 'sugar',
          s.res.sugar - got * unitPrice(k) * (MK.STANDING_PENALTY - 1))
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE ACT II MINERAL EXCHANGE (02 §10.4) — the same walk, demoted to one pair
  // ───────────────────────────────────────────────────────────────────────────

  function mineralPrice () {
    var s = S()
    return s && s.a2.mineralMkt.P > 0 ? s.a2.mineralMkt.P : MX.P0
  }

  function stepMineralExchange (dt, o) {
    var s = S()
    if (!s || s.act !== 2) return
    var p = opt(o), m = s.a2.mineralMkt, n, h, i, prev, decay, relax
    if (!(m.P > 0)) { m.P = MX.P0; m.Pbar = MX.P0; m.momentum = 0 }
    mxAcc += dt
    paceSteps(mxAcc)
    n = pace.n
    h = pace.h
    if (n < 1) return
    mxAcc = pace.rest
    decay = Math.pow(MX.MOM_DECAY, h)
    relax = Math.exp(-h * MX.PBAR_RELAX)
    for (i = 0; i < n; i++) {
      prev = m.P
      m.P = C().clamp(
        m.P + MX.REVERT * h * (m.Pbar - m.P) + MX.MOM_GAIN * h * m.momentum +
          (p.stochastic ? MX.SIGMA * Math.sqrt(h) * walkGauss() : 0),
        MX.P_MIN, MX.P_MAX)
      // No `h` on the momentum input: the published form absorbs one step's relative move at a
      // gain of MOM_IN·h against a move that is itself h times larger, and the two cancel. Leaving
      // the h in would make a ten-second offline step read as a ten-times-stronger trend.
      m.momentum = decay * m.momentum + MX.MOM_IN * (m.P - prev) / Math.max(prev, 1e-9)
      m.Pbar = MX.P0 + (m.Pbar - MX.P0) * relax
    }
  }

  // n > 0 buys minerals with biomass; n < 0 sells minerals for biomass. The drift is asymmetric —
  // a heavy buyer permanently raises their own costs, and can watch it happen.
  function tradeMinerals (n) {
    var s = S()
    if (!s || s.act !== 2 || !n) return 0
    var m = s.a2.mineralMkt
    if (!(m.P > 0)) { m.P = MX.P0; m.Pbar = MX.P0; m.momentum = 0 }
    var q, cost
    if (n > 0) {
      q = Math.min(n, s.res.biomass / m.P)
      if (!(q > 0)) return 0
      cost = q * m.P
      C().setStock(s.res, 'biomass', s.res.biomass - cost)
      C().setStock(s.res, 'minerals', s.res.minerals + q)
      m.Pbar += MX.BUY_DRIFT * Math.pow(q, MX.DRIFT_EXP)
    } else {
      q = Math.min(-n, s.res.minerals)
      if (!(q > 0)) return 0
      C().setStock(s.res, 'minerals', s.res.minerals - q)
      C().setStock(s.res, 'biomass', s.res.biomass + q * m.P)
      m.Pbar = Math.max(MX.P_MIN, m.Pbar - MX.SELL_DRIFT * Math.pow(q, MX.DRIFT_EXP))
      q = -q
    }
    s.stats.mineralTrades += 1
    return q
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TREES · the counterparties
  // ───────────────────────────────────────────────────────────────────────────

  function treeById (id) {
    var t = S().a1.trees, i
    for (i = 0; i < t.length; i++) if (t[i] && t[i].id === id) return t[i]
    return null
  }

  function sp (tree) { return SPECIES[tree.species] || SPECIES.birch }

  // The only interaction between counterparties. A tree standing under taller crowns receives less
  // light, so the oak's arrival makes the hemlock hungrier and therefore better paid — and buying
  // The Oak Rise quietly re-rates the whole book. Deterministic, and a pure function of who is alive.
  function canopyLight (tree) {
    var s = S(), i, t = s.a1.trees, shade = 0, mine = sp(tree).canopy
    for (i = 0; i < t.length; i++) {
      if (!t[i] || t[i].id === tree.id) continue
      var d = sp(t[i]).canopy - mine
      if (d > 0) shade += d * C().clamp(num(t[i].health), 0, 1)
    }
    return C().clamp(1 - CT.CANOPY_K * shade, CT.CANOPY_MIN, 1)
  }

  // 01 §6.3, exactly. Three inputs the player can see (season, moisture, the tree's own health) and
  // one they can reason about (who is standing above it). No draw of any kind.
  function carbonDeficit (tree, seasonOverride, phaseOverride) {
    var s = S(), A = T().A1, spec = sp(tree)
    var season = seasonOverride === undefined ? num(s.a1.season) : seasonOverride
    var phase = phaseOverride === undefined ? num(s.a1.seasonPhase) : phaseOverride
    var moist = num(s.a1.moisture)

    var photo = spec.photo[season] * C().clamp(num(tree.health), 0, 1) * canopyLight(tree) *
      (CT.PHOTO_M_A + CT.PHOTO_M_B * Math.min(1, moist / CT.PHOTO_M_REF))
    var need = spec.need[season]

    if (season === A.SEASON_SPRING && spec.decid) {
      photo *= C().smoothstep(CT.BUD_LO, CT.BUD_HI, phase)
      var z = (phase - spec.bud) / CT.BUD_W
      need *= 1 + CT.BUD_AMP * Math.exp(-z * z)
    }
    if (season === A.SEASON_AUTUMN && mastActive(tree)) need *= CT.MAST_NEED
    if (!(need > 0)) return 0
    var d = C().clamp(1 - photo / need, 0, 1)
    if (eventActive('firescar')) d = C().clamp(d - CT.FIRESCAR_D, 0, 1)
    return d
  }

  // `mastYear` is the year the mast was granted, or −1 for never; the window is that autumn and the
  // winter that follows it. One number carries both the window and the three-year eligibility gap.
  // −1 rather than 0, because the boot season is autumn of year zero and a falsy sentinel would
  // silently swallow the first mast the game can produce.
  function mastYearOf (tree) {
    return typeof tree.mastYear === 'number' && isFinite(tree.mastYear) ? tree.mastYear : -1
  }

  function mastActive (tree) {
    var s = S(), A = T().A1, my = mastYearOf(tree)
    if (my < 0) return false
    var se = num(s.a1.season)
    return my === num(s.a1.year) && (se === A.SEASON_AUTUMN || se === A.SEASON_WINTER)
  }

  function mastEligible (tree) {
    var my = mastYearOf(tree)
    return !!sp(tree).masts && (my < 0 || num(S().a1.year) - my >= CT.MAST_GAP_Y)
  }

  function treeContracts (treeId) {
    var c = S().a1.contracts, i, out = []
    for (i = 0; i < c.length; i++) if (c[i].treeId === treeId && c[i].state === 'active') out.push(c[i])
    return out
  }

  function committedTo (treeId) {
    var c = treeContracts(treeId), i, v = 0
    for (i = 0; i < c.length; i++) v += num(c[i].sugarRate)
    return v
  }

  function committedSugarPerSec () {
    var c = S().a1.contracts, i, v = 0
    for (i = 0; i < c.length; i++) if (c[i].state === 'active' && !c[i].suspended) v += num(c[i].sugarRate)
    return v
  }

  // Trees arrive on reputation thresholds and on claims, at a reputation your record has already
  // set. Every arrival is deterministic: the ladder is a table, not a draw.
  function spawnTree (species, id) {
    var s = S()
    if (s.a1.trees.length >= CT.TREE_MAX) return null
    var spec = SPECIES[species]
    if (!spec) return null
    var t = {
      id: id === undefined ? nextTreeId++ : id,
      species: species,
      age: spec.age0,
      health: 1.00,
      rep: C().clamp(CT.NEW_REP_A + CT.NEW_REP_B * num(s.a1.netRep), CT.NEW_REP_MIN, CT.NEW_REP_MAX),
      ramets: spec.ramets,
      refuseUntil: 0,
      lastReneg: -T().CLOCK.SEASON_S,
      mastYear: -1,
      d: 0
    }
    if (t.id >= nextTreeId) nextTreeId = t.id + 1
    s.a1.trees.push(t)
    if (species === 'aspen') say('a1.aspen')
    else if (species === 'hemlock') say('a1.hemlock')
    say('a1.first_tree')
    return t
  }

  function treesOpen () {
    var s = S(), A = T().A1
    if (s.a1.trees.length > 0) return true
    return s.res.sugar >= A.TREES_SUGAR_G && num(s.a1.season) === A.SEASON_WINTER
  }

  function killTree (tree, reason) {
    var s = S(), i, c = s.a1.contracts
    // A tree that dies voids its book: collateral returns, reputation is untouched. You did not
    // break the promise; the promise stopped existing.
    for (i = c.length - 1; i >= 0; i--) {
      if (c[i].treeId !== tree.id) continue
      if (c[i].state === 'active') {
        C().setStock(s.res, 'biomass', s.res.biomass + num(c[i].collateral))
        c[i].state = 'exited'
      }
    }
    if (reason === 'windthrow') {
      var row = s.a1.mkt[IDX.log]
      row.stock = Math.min(capOf('log'),
        row.stock + EV.TRUNK_MASS * sp(tree).canopy * EV.WINDTHROW_TRUNK)
    }
    for (i = 0; i < s.a1.trees.length; i++) {
      if (s.a1.trees[i].id === tree.id) { s.a1.trees.splice(i, 1); break }
    }
    if (tree.species === 'elm') say('a1.elm_death')
    if (reason === 'windthrow') say('a1.windthrow_kill')
  }

  function stepTrees (dt) {
    var s = S()
    if (!s || s.act !== 1) return
    var SEASON = T().CLOCK.SEASON_S, i, t, spec, beetle

    if (treesOpen() && s.a1.trees.length === 0) claimTrees(1)
    if (num(s.a1.patches) > lastPatches) {
      if (treesOpen()) claimTrees(num(s.a1.patches))
      lastPatches = num(s.a1.patches)
    }
    if (treesOpen()) repTrees()

    beetle = eventActive('beetle')
    for (i = s.a1.trees.length - 1; i >= 0; i--) {
      t = s.a1.trees[i]
      spec = sp(t)
      t.age = num(t.age) + dt / T().CLOCK.YEAR_S

      // Dutch elm disease is a clock, not a roll: six seasons from full health to nothing, and the
      // contract it signs is a bet on your own throughput ramp against that clock.
      if (spec.lifeSeasons > 0) t.health = num(t.health) - dt / (spec.lifeSeasons * SEASON)
      if (beetle && beetle.payload && beetle.payload.treeId === t.id) {
        t.health = num(t.health) - CT.BEETLE_PER_SEASON * dt / SEASON
      }
      t.health = C().clamp(num(t.health), 0, 1)

      if (t.health <= CT.DEATH_HEALTH) { killTree(t, 'health'); continue }
      // Cached for cross-module reads (projects.js tests `tree.d`). Recomputed every tick and never
      // trusted on load; §3.1 R1's ban is on storing derived values, not on caching them within a
      // frame, and the alternative is 163 project triggers each recomputing a deficit.
      t.d = carbonDeficit(t)
    }

    var key = num(s.a1.year) * 4 + num(s.a1.season)
    if (key !== lastSeasonKey) {
      lastSeasonKey = key
      onSeasonBoundary(key)
    }
  }

  function claimTrees (patchCount) {
    var i, j, list
    for (i = 0; i < patchCount && i < PATCH_TREES.length; i++) {
      list = PATCH_TREES[i]
      for (j = 0; j < list.length; j++) {
        if (countSpecies(list[j]) >= (SPECIES_LIMIT[list[j]] || 1)) continue
        spawnTree(list[j])
      }
    }
  }

  function hasSpecies (k) { return countSpecies(k) > 0 }

  function countSpecies (k) {
    var t = S().a1.trees, i, n = 0
    for (i = 0; i < t.length; i++) if (t[i].species === k) n++
    return n
  }

  function repTrees () {
    var s = S(), i
    for (i = 0; i < REP_TREES.length; i++) {
      if (num(s.a1.netRep) < REP_TREES[i].rep) continue
      if (hasSpecies(REP_TREES[i].species)) continue
      spawnTree(REP_TREES[i].species)
    }
  }

  // Solicitations. They are almost always bad deals dressed as compliments, and declining is free.
  // Whether one arrives is decided by a stable hash of (tree, season) rather than a draw, so the
  // same run always solicits at the same moments — which is what D35 requires and what makes the
  // "learning to say no" skill teachable at all.
  function onSeasonBoundary (key) {
    var s = S(), i, t, dNow, dThen, h
    solicits.length = 0
    for (i = 0; i < s.a1.trees.length; i++) {
      t = s.a1.trees[i]
      var live = treeContracts(t.id)
      if (!live.length) continue
      dNow = carbonDeficit(t)
      dThen = deficitAt(t, live[0].startT)
      if (dNow - dThen <= CT.SOLICIT_D) continue
      h = C().hash32('solicit', t.id, key) / U32
      if (h >= CT.SOLICIT_P) continue
      solicits.push({
        id: live[0].id,
        treeId: t.id,
        volume: live[0].sugarRate * CT.SOLICIT_VOL,
        termSeasons: C().clamp(live[0].termSeasons + CT.SOLICIT_TERM,
          T().A1.TERM_MIN, T().A1.TERM_MAX)
      })
    }
  }

  // The season and phase at a past time, reconstructed rather than stored. `t`, `season` and
  // `seasonPhase` between them fix the whole calendar in both directions.
  function deficitAt (tree, pastT) {
    var s = S(), SEASON = T().CLOCK.SEASON_S
    var elapsed = num(s.t) - num(pastT)
    var absNow = num(s.a1.season) + num(s.a1.seasonPhase)
    var absThen = absNow - elapsed / SEASON
    var seasonThen = ((Math.floor(absThen) % 4) + 4) % 4
    var phaseThen = absThen - Math.floor(absThen)
    return carbonDeficit(tree, seasonThen, phaseThen)
  }

  function solicitations () { return solicits.slice() }

  function acceptSolicitation (contractId) {
    var i
    for (i = 0; i < solicits.length; i++) {
      if (solicits[i].id !== contractId) continue
      var so = solicits[i]
      solicits.splice(i, 1)
      var c = contractById(contractId)
      if (!c || c.state !== 'active') return false
      c.sugarRate = so.volume
      c.termSeasons = so.termSeasons
      return !!renegotiate(contractId, true)
    }
    return false
  }

  function declineSolicitation (contractId) {
    var i
    for (i = 0; i < solicits.length; i++) {
      if (solicits[i].id === contractId) { solicits.splice(i, 1); return true }
    }
    return false
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CONTRACTS · pricing. No rng handle is in scope below this line.
  // ───────────────────────────────────────────────────────────────────────────

  function offer (tree, volume, termSeasons, collateral, exclusive) {
    var s = S()
    if (!tree) return 0
    // Recomputed rather than read from the per-tick cache: the negotiation screen calls this while
    // a thumb is on a slider, and a deficit that is one frame stale is a number the player would
    // sign against.
    var d = carbonDeficit(tree)
    var termBonus = 1 + CT.TERM_K * Math.log(1 + Math.max(0, num(termSeasons)))
    var collBonus = 1 + CT.COLL_K *
      (1 - Math.exp(-num(collateral) / Math.max(1e-9, num(volume) * CT.COLL_SCALE)))
    var repMult = CT.REP_A + CT.REP_B * num(tree.rep)
    var needMult = 1 + CT.NEED_K * Math.pow(d, CT.NEED_E)
    var exclMult = exclusive ? CT.EXCL : 1.00
    return num(volume) * sp(tree).base *
      termBonus * collBonus * repMult * needMult * exclMult * num(s.mult.hartigNet)
  }

  function maxIntake (tree) {
    var s = S()
    var d = carbonDeficit(tree)
    return sp(tree).intake * Math.max(1, num(tree.ramets)) * C().clamp(num(tree.health), 0, 1) *
      (1 + CT.NEED_K * Math.pow(d, CT.NEED_E)) *
      (CT.INTAKE_REP_A + CT.INTAKE_REP_B * num(tree.rep)) * num(s.mult.exudatePump)
  }

  function maxTerm (tree) {
    var A = T().A1
    return C().clamp(Math.floor(1 + num(tree.rep) / CT.MAXTERM_DIV), A.TERM_MIN, A.TERM_MAX)
  }

  function accepts (tree, volume, termSeasons, exclusive) {
    var s = S()
    if (!tree) return false
    if (num(tree.refuseUntil) > num(s.t)) return false
    if (!(num(volume) > 0)) return false
    if (num(volume) + committedTo(tree.id) > maxIntake(tree)) return false
    if (CT.REP_A + CT.REP_B * num(tree.rep) < sp(tree).minRep) return false
    if (num(termSeasons) < T().A1.TERM_MIN || num(termSeasons) > maxTerm(tree)) return false
    if (exclusive && treeContracts(tree.id).length > 0) return false
    return true
  }

  // Refusal is a counter-offer, never a wall: the largest legal position this tree will take today.
  function counter (tree, volume, termSeasons, exclusive) {
    if (!tree) return null
    var s = S()
    if (num(tree.refuseUntil) > num(s.t)) return null
    if (CT.REP_A + CT.REP_B * num(tree.rep) < sp(tree).minRep) return null
    var v = Math.max(0, maxIntake(tree) - committedTo(tree.id))
    var tm = maxTerm(tree)
    var ex = !!exclusive && treeContracts(tree.id).length === 0
    return {
      volume: Math.min(num(volume), v),
      termSeasons: Math.min(Math.max(T().A1.TERM_MIN, num(termSeasons)), tm),
      exclusive: ex,
      maxVolume: v,
      maxTerm: tm
    }
  }

  function contractById (id) {
    var c = S().a1.contracts, i
    for (i = 0; i < c.length; i++) if (c[i].id === id) return c[i]
    return null
  }

  function signContract (treeId, volume, termSeasons, collateral, exclusive) {
    var s = S()
    var tree = treeById(treeId)
    if (!tree) return null
    // The Hollow Beech signs one term length and it is not on the slider. Everything else about the
    // position is still tested; only the term escapes the legal range, and nothing can renegotiate
    // out of it afterwards. Reading it twice is the whole cost of the project.
    var trap = tree.species === 'beech' && flag(s, 'the_hollow_beech')
    termSeasons = trap ? CT.BEECH_TERM : Math.round(num(termSeasons))
    collateral = Math.max(0, num(collateral))
    if (collateral > s.res.biomass) collateral = s.res.biomass
    if (!accepts(tree, volume, trap ? maxTerm(tree) : termSeasons, exclusive)) {
      say('a1.oak_refuse')
      return null
    }
    var rate = offer(tree, volume, termSeasons, collateral, exclusive)
    if (!(rate > 0)) return null

    C().setStock(s.res, 'biomass', s.res.biomass - collateral)
    var c = {
      id: nextContractId++,
      treeId: tree.id,
      sugarRate: num(volume),
      mineralRate: rate,
      termSeasons: termSeasons,
      startT: num(s.t),
      endT: num(s.t) + termSeasons * T().CLOCK.SEASON_S,
      collateral: collateral,
      exclusive: !!exclusive,
      delivered: 0,
      shortfall: 0,
      suspended: false,
      state: 'active'
    }
    s.a1.contracts.push(c)
    s.stats.contractsSigned += 1
    say('a1.first_contract')
    if (tree.species === 'oak') say('a1.oak_sign')
    if (tree.species === 'elm') say('a1.elm_offer')
    return c
  }

  // One reputation point, once a season, terms recomputed at the deficit and reputation you have
  // now. Renegotiating a summer contract into winter conditions triples the rate; renegotiating in
  // the wrong direction is entirely possible and nothing prevents it.
  function renegotiate (id, force) {
    var s = S(), SEASON = T().CLOCK.SEASON_S
    var c = contractById(id)
    if (!c || c.state !== 'active') return null
    var tree = treeById(c.treeId)
    if (!tree) return null
    if (!force) {
      if (num(s.t) - num(tree.lastReneg) <= SEASON) return null
      if (num(tree.refuseUntil) >= num(s.t)) return null
      // A twelve-season term is outside the legal range, so nothing can reach it. That is the trap.
      if (c.termSeasons > T().A1.TERM_MAX) return null
    }
    var term = Math.min(c.termSeasons, maxTerm(tree))
    if (term < T().A1.TERM_MIN) term = T().A1.TERM_MIN
    c.mineralRate = offer(tree, c.sugarRate, term, c.collateral, c.exclusive)
    c.termSeasons = term
    c.startT = num(s.t)
    c.endT = num(s.t) + term * SEASON
    c.shortfall = 0
    tree.lastReneg = num(s.t)
    tree.rep = C().clamp(num(tree.rep) - CT.RENEG_REP, 0, T().A1.REP_MAX)
    if (tree.species === 'aspen') syncStand(tree)
    return c
  }

  function exitContract (id) {
    var s = S()
    var c = contractById(id)
    if (!c || c.state !== 'active') return false
    var tree = treeById(c.treeId)
    var remaining = c.sugarRate * Math.max(0, c.endT - num(s.t))
    var fee = CT.EXIT_FRAC * remaining
    if (s.res.sugar < fee) return false
    C().setStock(s.res, 'sugar', s.res.sugar - fee)
    if (tree) {
      tree.rep = C().clamp(num(tree.rep) - CT.EXIT_REP, 0, T().A1.REP_MAX)
      if (tree.species === 'aspen') syncStand(tree)
    }
    C().setStock(s.a1, 'netRep', num(s.a1.netRep) - CT.EXIT_NETREP, T().A1.REP_MAX)
    C().setStock(s.res, 'biomass', s.res.biomass + num(c.collateral))
    c.state = 'exited'
    return true
  }

  // The clone is one counterparty wearing several trunks: a rep move on any aspen is a rep move on
  // all of them. Concentration risk, delivered without a word of finance.
  function syncStand (tree) {
    var t = S().a1.trees, i
    for (i = 0; i < t.length; i++) {
      if (t[i].species !== 'aspen' || t[i].id === tree.id) continue
      t[i].rep = tree.rep
      t[i].refuseUntil = Math.max(num(t[i].refuseUntil), num(tree.refuseUntil))
    }
  }

  function completeContract (c) {
    var s = S()
    var tree = treeById(c.treeId)
    c.state = 'complete'
    if (tree) {
      tree.rep = C().clamp(
        num(tree.rep) + (CT.REP_DONE_A + CT.REP_DONE_B * c.termSeasons) * num(s.mult.cmnMult),
        0, T().A1.REP_MAX)
      if (tree.species === 'aspen') syncStand(tree)
    }
    C().setStock(s.a1, 'netRep',
      num(s.a1.netRep) + CT.NETREP_DONE * num(s.mult.cmnMult), T().A1.REP_MAX)
    C().setStock(s.res, 'biomass', s.res.biomass + num(c.collateral))
    s.stats.contractsCompleted += 1
    say('a1.contract_done')
  }

  function defaultContract (c) {
    var s = S()
    var tree = treeById(c.treeId)
    c.state = 'defaulted'
    if (tree) {
      tree.rep = C().clamp(num(tree.rep) - CT.REP_FAIL * num(s.mult.arbitration), 0, T().A1.REP_MAX)
      tree.refuseUntil = num(s.t) + CT.REFUSE_SEASONS * T().CLOCK.SEASON_S
      // The collateral is forfeit, and it makes the tree healthier — which raises its intake and
      // its photosynthesis. The tree you failed now needs you less. One line, and it is the
      // cruellest number in the act.
      tree.health = C().clamp(num(tree.health) + num(c.collateral) / CT.HEALTH_PER_COLL, 0, 1)
      if (tree.species === 'aspen') syncStand(tree)
    }
    C().setStock(s.a1, 'netRep',
      num(s.a1.netRep) - CT.NETREP_FAIL * num(s.mult.arbitration), T().A1.REP_MAX)
    s.stats.defaults += 1
    say('a1.first_default')
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DELIVERY — unconditional, continuous, and reserved (BIBLE §4 step 8, 08 G1b/G1c)
  // ───────────────────────────────────────────────────────────────────────────

  // G1b's k̄. Decomposition charges tip-time as `budget -= g/(k·enzymeK)`, so the grams a second of
  // throughput actually consumes is `throughput · k · enzymeK` of whatever is next in the order.
  function nextK () {
    var k = nextType()
    return DEADFALL[IDX[k]].k * num(S().mult.enzymeK[k])
  }

  // What decomposition will actually eat next: the first pool in the player's own consumption order
  // that still holds something. It is the honest basis for both the feedstock reserve and the
  // net-sugar readout, and it moves whenever the player reorders the list.
  function nextType () {
    var s = S(), i, k
    for (i = 0; i < s.a1.consumptionOrder.length; i++) {
      k = s.a1.consumptionOrder[i]
      if (!unlocked(k)) continue
      if (num(s.a1.sub[k]) > 0) return k
    }
    return 'leaf'
  }

  function throughput () {
    var s = S()
    if (HY.act1 && HY.act1.throughputPerSec) return num(HY.act1.throughputPerSec())
    return T().A1.TIP_THROUGHPUT * num(s.a1.tips) *
      num(s.mult.enzymeMult) * num(s.mult.structureMult) * num(s.mult.patchMult)
  }

  // Sixty seconds of feedstock, priced in sugar, that contract delivery may never take. Shortfall
  // caused by the reserve is deferred, not defaulted — and the reserve collapses to zero the moment
  // the floor is bare, because otherwise the guard becomes the deadlock it exists to prevent.
  function reserveSugar () {
    var A = T().A1
    if (totalSubstrate() < 1) return 0
    var mp = minPrice()
    if (!isFinite(mp)) return 0
    return A.RESERVE_S * throughput() * nextK() * mp
  }

  function deliverContracts (dt, o) {
    var s = S()
    if (!s || s.act !== 1) return
    var p = opt(o), A = T().A1, SEASON = T().CLOCK.SEASON_S
    var i, c, tree, want, hardPay, pay, avail, dormant

    book.reserve = reserveSugar()
    book.deferred = 0
    avail = Math.max(0, s.res.sugar - book.reserve)
    dormant = p.offline && flag(s, 'dormancy_clause')

    // Seniority is signing order. Your newest and most speculative commitment is the one that fails
    // first, and that is the correct failure to have.
    for (i = 0; i < s.a1.contracts.length; i++) {
      c = s.a1.contracts[i]
      if (c.state !== 'active') continue
      tree = treeById(c.treeId)
      if (!tree) { c.state = 'exited'; continue }

      // Suspension is an absence toggle, not a pause button: it only bites offline, and only once
      // Dormancy Clause is owned. Otherwise a player could stop delivering and keep the term.
      if (dormant && c.suspended) {
        c.endT += dt
        continue
      }

      want = c.sugarRate * dt
      if (!(want > 0)) continue
      hardPay = Math.min(want, s.res.sugar)
      pay = Math.min(want, avail)
      if (pay < 0) pay = 0

      C().setStock(s.res, 'sugar', s.res.sugar - pay)
      avail -= pay
      book.deferred += hardPay - pay
      book.deliveredSugar += pay

      var mineral = c.mineralRate * dt * (pay / want)
      if (mineral > 0) {
        C().setStock(s.res, 'minerals', s.res.minerals + mineral)
        s.stats.mineralEarned += mineral
      }
      c.delivered += pay
      c.shortfall += (want - hardPay)

      // D32 is HARD: nothing is lost while away. Offline shortfall accrues and is reported on
      // return ("a term is short by n sugar. it has not ended.") but never executes the default.
      if (!p.offline && c.shortfall > A.SHORTFALL_FRAC * c.sugarRate * SEASON) {
        defaultContract(c)
        continue
      }
      if (num(s.t) >= c.endT) completeContract(c)
    }

    // Oxalate Weathering: the reason the act completes no matter how badly the player trades.
    if (flag(s, 'oxalate_weathering')) {
      var ox = CT.OXALATE_RATE * num(s.mult.hartigNet) * dt
      C().setStock(s.res, 'minerals', s.res.minerals + ox)
      s.stats.mineralEarned += ox
    }

    pruneContracts()
  }

  // Terminal contracts are kept for one season so the card can show how it ended, then dropped.
  // The save budget is 22 KB and a finished contract is 120 bytes of nothing.
  function pruneContracts () {
    var s = S(), SEASON = T().CLOCK.SEASON_S, i, c
    for (i = s.a1.contracts.length - 1; i >= 0; i--) {
      c = s.a1.contracts[i]
      if (c.state === 'active') continue
      if (num(s.t) - Math.max(num(c.endT), num(c.startT)) < SEASON) continue
      s.a1.contracts.splice(i, 1)
    }
  }

  function setSuspended (id, v) {
    var c = contractById(id)
    if (!c) return false
    c.suspended = !!v
    return true
  }

  // The HUD's one derived number, and the reason the coverage bar is the whole game. When it goes
  // negative the row turns amber and gains a countdown; that line is Act I's sawtooth.
  function netSugar () {
    var k = nextType()
    var income = throughput() * nextK() * T().A1.ETA_S * DEADFALL[IDX[k]].etaS
    return income - committedSugarPerSec()
  }

  function bookState () {
    return {
      reserve: book.reserve,
      deferred: book.deferred,
      deliveredSugar: book.deliveredSugar,
      committed: committedSugarPerSec()
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EVENTS — act1.js rolls; economy1 applies the half that lands on a price or a counterparty
  // ───────────────────────────────────────────────────────────────────────────

  function uni (r, lo, hi) { return r ? lo + (hi - lo) * r.next() : 0.5 * (lo + hi) }

  function applyEvent (id, r) {
    var s = S()
    if (!s || s.act !== 1) return null
    var i, ev = null
    for (i = 0; i < EVENTS.length; i++) if (EVENTS[i].id === id) ev = EVENTS[i]
    if (!ev) return null
    var payload = {}

    if (id === 'windthrow') {
      var pk = num(s.a1.patches)
      var lrow = s.a1.mkt[IDX.log]
      var brow = s.a1.mkt[IDX.bark]
      lrow.stock = Math.min(capOf('log'), lrow.stock + uni(r, EV.WINDTHROW_LOG[0], EV.WINDTHROW_LOG[1]) * pk)
      brow.stock = Math.min(capOf('bark'), brow.stock + uni(r, EV.WINDTHROW_BARK[0], EV.WINDTHROW_BARK[1]) * pk)
      lrow.mom = C().clamp(lrow.mom + EV.WINDTHROW_MOM, -T().A1.MOM_CLAMP, T().A1.MOM_CLAMP)
      lrow.base *= EV.WINDTHROW_BASE
      // The sub-roll that makes a windfall a bereavement, and then you eat your counterparty. It
      // never takes your last one, and offline it never fires at all: `r` is absent there and the
      // midpoint 0.5 is above the threshold, so an absence can never cost a relationship (D32).
      if (r && r.next() < EV.WINDTHROW_KILL_P && s.a1.trees.length > 1) {
        var victim = s.a1.trees[r.int(s.a1.trees.length)]
        payload.treeId = victim.id
        killTree(victim, 'windthrow')
      }
    } else if (id === 'carrion') {
      var crow = s.a1.mkt[IDX.carrion]
      crow.stock = Math.min(capOf('carrion'), crow.stock + uni(r, EV.CARRION_G[0], EV.CARRION_G[1]))
      s.stats.carrionEventsSeen += 1
    } else if (id === 'earthworm') {
      s.a1.mkt[IDX.leaf].stock *= EV.WORM_STRIP
    } else if (id === 'beetle') {
      var target = null
      for (i = 0; i < s.a1.trees.length; i++) {
        if (!sp(s.a1.trees[i]).conifer) continue
        if (!target || num(s.a1.trees[i].health) > num(target.health)) target = s.a1.trees[i]
      }
      if (!target) return null
      target.health = C().clamp(num(target.health) - CT.BEETLE_HIT, 0, 1)
      payload.treeId = target.id
    } else if (id === 'mast') {
      var oak = null
      for (i = 0; i < s.a1.trees.length; i++) {
        if (sp(s.a1.trees[i]).masts && mastEligible(s.a1.trees[i])) oak = s.a1.trees[i]
      }
      if (!oak) return null
      oak.mastYear = num(s.a1.year)
      payload.treeId = oak.id
    }

    s.a1.activeEvents.push({ id: id, seasonsLeft: ev.seasonsLeft, payload: payload })
    if (ev.logId) say(ev.logId)
    return payload
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE SURFACE PLUMBING
  // ───────────────────────────────────────────────────────────────────────────

  function init (s) {
    s = s || S()
    if (!s) return
    var i, row
    for (i = 0; i < TYPES.length; i++) {
      row = s.a1.mkt[i]
      if (!(row.base > 0)) {
        row.base = DEADFALL[i].price
        row.price = DEADFALL[i].price
        row.mom = 0
        row.stock = T().A1.STOCK_INIT_FRAC * DEADFALL[i].cap * num(s.a1.patches)
        row.coolT = 0
      }
    }
    if (!(s.a2.mineralMkt.P > 0)) {
      s.a2.mineralMkt.P = MX.P0
      s.a2.mineralMkt.Pbar = MX.P0
      s.a2.mineralMkt.momentum = 0
    }
    hist = null
    histFill = 0
    acc = 0
    mxAcc = 0
    solicits.length = 0
    standing = {}
    book = { deliveredSugar: 0, deferred: 0, reserve: 0 }
    walk = C().rng(C().hash32('litter', s.seed))
    lastPatches = num(s.a1.patches)
    lastSeasonKey = num(s.a1.year) * 4 + num(s.a1.season)
    nextTreeId = 1
    nextContractId = 1
    for (i = 0; i < s.a1.trees.length; i++) {
      if (s.a1.trees[i].id >= nextTreeId) nextTreeId = s.a1.trees[i].id + 1
    }
    for (i = 0; i < s.a1.contracts.length; i++) {
      if (s.a1.contracts[i].id >= nextContractId) nextContractId = s.a1.contracts[i].id + 1
    }
  }

  // loop.js calls the individual steps at their positions in §4's order; this exists for the
  // generic module contract and for the harness, and it holds the opts the steps read.
  function tick (s, dt, o) {
    ctx = opt(o)
    if (!s || s.act !== 1) { stepMineralExchange(dt, ctx); return }
    stepMarket(dt, ctx)
    stepTrees(dt)
    deliverContracts(dt, ctx)
  }

  function serialise () { return null }     // every persistent byte this module owns lives in §3

  function migrate () { return true }

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — returns [] when healthy
  // ───────────────────────────────────────────────────────────────────────────

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }
    function near (a, b, tol, label) {
      if (!(Math.abs(a - b) <= tol)) f.push(label + ': ' + a + ' vs ' + b)
    }

    var A = T().A1
    // A harness that loaded this module without ever touching `state` has no run to park, and
    // serialising a half-built save would give the restore at the end nothing to restore.
    var live = S()
    if (!live || !live.a1 || !live.a1.mkt) fresh(20260727)
    // state.adopt() empties the live object before refilling it, so the live instance cannot be
    // handed back to init() as its own backup. The run is parked as a serialised copy instead.
    var saved = HY.state.serialise()

    // ── D21, part one: no dice roll exists anywhere in contract pricing.
    // Asserted against the source text of every function that can move a mineral rate, so a future
    // edit that reaches for a draw fails the build rather than the review.
    var priced = [carbonDeficit, canopyLight, deficitAt, mastYearOf, mastActive, mastEligible, offer,
      maxIntake, maxTerm, accepts, counter, signContract, renegotiate, exitContract,
      deliverContracts, completeContract, defaultContract, syncStand, spawnTree, treeContracts,
      committedTo, reserveSugar, nextK, nextType, onSeasonBoundary]
    var banned = ['Math.random', 'walkGauss', '.gauss(', '.next(', '.int(', '.pick(']
    for (var pi = 0; pi < priced.length; pi++) {
      var src = Function.prototype.toString.call(priced[pi])
      for (var bi = 0; bi < banned.length; bi++) {
        if (src.indexOf(banned[bi]) >= 0) {
          f.push('pricing function ' + pi + ' reaches for ' + banned[bi])
        }
      }
    }

    // ── Tables.
    ok(DEADFALL.length === TYPES.length, 'deadfall table is not seven rows')
    ok(SEASON_FALL.length === TYPES.length, 'seasonal litterfall table is not seven rows')
    for (var ti = 0; ti < TYPES.length; ti++) {
      ok(DEADFALL[ti].id === TYPES[ti], 'deadfall row ' + ti + ' is out of order')
      ok(SEASON_FALL[ti].length === 4, 'seasonal row ' + ti + ' is not four seasons')
      // 5A.2's published τ, which is what makes prices move over a season rather than a second.
      var tau = DEADFALL[ti].cap / DEADFALL[ti].comp
      ok(tau > 200, 'τ for ' + TYPES[ti] + ' is ' + tau + ' s — prices would move over a second')
    }
    for (var sk in SPECIES) {
      if (!Object.prototype.hasOwnProperty.call(SPECIES, sk)) continue
      ok(SPECIES[sk].photo.length === 4 && SPECIES[sk].need.length === 4, sk + ' is not four seasons')
      // The acceptance test reads minRep through repMult, so every threshold must be reachable.
      var need = (SPECIES[sk].minRep - CT.REP_A) / CT.REP_B
      ok(need <= A.REP_MAX, sk + ' can never be reached: needs rep ' + need)
    }

    // ── A world to test against.
    var g = fresh(0x51EED1)
    init(g)

    // The published fair-value claims, both of which are the annual strategy in disguise.
    g.a1.season = A.SEASON_AUTUMN
    var lf = DEADFALL[IDX.leaf]
    var autumnStar = (lf.cap / lf.comp) * lf.fall * SEASON_FALL[IDX.leaf][A.SEASON_AUTUMN]
    ok(autumnStar >= lf.cap, 'autumn does not saturate the leaf pool')
    g.a1.season = A.SEASON_WINTER
    var winterStar = (lf.cap / lf.comp) * lf.fall * SEASON_FALL[IDX.leaf][A.SEASON_WINTER]
    var scarcity = 1 - winterStar / lf.cap
    var winterFair = 1 + A.FAIR_K * Math.pow(scarcity, A.FAIR_EXP)
    near(winterFair, 1.78, 0.05, 'winter fair value is not ~1.8× base')

    // The walk: momentum's half-life, and the stationary excursion.
    near(Math.pow(A.MOM_DECAY, 15), 0.5, 0.02, 'momentum half-life is not 15 s')
    near(A.PRICE_SIGMA / Math.sqrt(1 - A.MOM_DECAY * A.MOM_DECAY), 0.0203, 0.001,
      'stationary σ of momentum is not 0.0203')

    // Determinism of the whole market walk under {stochastic:false}.
    var snapA = marketSnapshot(g)
    g.a1.season = A.SEASON_AUTUMN
    for (var w = 0; w < 300; w++) stepMarket(1.0, { stochastic: false })
    var afterA = marketSnapshot(g)
    var g2 = fresh(0x51EED1)
    init(g2)
    g2.a1.season = A.SEASON_AUTUMN
    for (w = 0; w < 300; w++) stepMarket(1.0, { stochastic: false })
    ok(marketSnapshot(g2) === afterA, 'the deterministic walk is not reproducible')
    ok(snapA !== afterA, 'the walk did not move at all')

    // The two invariants that keep the offline path both stable and affordable. The first is the
    // Euler bound on the mean-reversion term; past 0.30 the price feedback oscillates and a
    // twelve-hour return lands 60% off. The second says one macro-step of a full offline reconcile
    // is always consumed in a single call, so no backlog can accumulate across the 240 of them.
    ok(A.MEAN_REV * MK.MAX_H <= 0.30 + 1e-12,
      'the widest market step is outside the stable régime')
    ok(MK.MAX_H * MK.MAX_SUBSTEPS >= T().OFFLINE.CAP / T().OFFLINE.STEPS,
      'a full offline macro-step cannot be walked in one call')
    ok(MK.WIDE_AFTER * MK.STEP_S >= T().CLOCK.CATCHUP_MAX_DT,
      'a live catch-up tick would widen the walk past its published 1 Hz step')

    // A wide offline step must land within a hair of many narrow ones: one code path, one answer.
    var g3 = fresh(0x51EED1)
    init(g3); g3.a1.season = A.SEASON_AUTUMN
    stepMarket(300, { stochastic: false })
    var wide = g3.a1.mkt[IDX.leaf].stock
    var narrow = JSON.parse(afterA).stock
    near(wide / narrow, 1.0, 0.02, 'a wide offline step diverges from narrow steps')

    // Inflation is permanent and it is yours.
    g = fresh(0x51EED1); init(g)
    g.a1.season = A.SEASON_AUTUMN
    C().setStock(g.res, 'sugar', 1e6)
    var base0 = g.a1.mkt[IDX.leaf].base
    buy('leaf', 3 * DEADFALL[IDX.leaf].cap * 0.10)
    ok(g.a1.mkt[IDX.leaf].base > base0, 'buying did not raise the base price')
    for (w = 0; w < 4000; w++) stepMarket(1.0, { stochastic: false })
    ok(g.a1.mkt[IDX.leaf].base > A.COOL_FLOOR * DEADFALL[IDX.leaf].price - 1e-9,
      'the base decayed through its floor')

    // ── D21, part two: the pricing formula is a pure function of its inputs.
    g = fresh(0x51EED1); init(g)
    g.a1.season = A.SEASON_WINTER
    g.a1.seasonPhase = 0.5
    var tr = spawnTree('birch')
    tr.rep = 25
    tr.d = carbonDeficit(tr)
    var r1 = offer(tr, 1.4, 2, 0, false)
    var r2 = offer(tr, 1.4, 2, 0, false)
    ok(r1 === r2, 'offer() is not deterministic')
    for (w = 0; w < 200; w++) ok(offer(tr, 1.4, 2, 0, false) === r1, 'offer() drifted across calls')

    // 01 §6.4's worked first contract, to four significant figures.
    near(carbonDeficit(tr), 0.881, 0.02, 'birch winter deficit')
    near(r1, 0.02150, 0.0006, "01 §6.4's worked first contract")

    // And its worked fourth contract, which is 5.8× the first and contains no variance at all.
    // Every one of that multiple's factors is a decision: reputation built, term extended,
    // collateral posted, exclusivity accepted, season timed, and one project bought.
    var oak = spawnTree('oak')
    oak.rep = 62
    g.mult.hartigNet = 1.18
    var r4 = offer(oak, 38, 5, 40000, true)
    g.mult.hartigNet = 1.00
    near(r4 / 38, 0.0891, 0.004, "01 §6.4's worked fourth contract, per gram")
    ok(r4 / 38 / (r1 / 1.4) > 5.0, 'the fourth contract is not several times the first')

    // Acceptance is a wall only in the sense that it hands back a counter-offer.
    ok(!accepts(oak, 1e6, 5, false), 'the oak accepted an impossible volume')
    var co = counter(oak, 1e6, 8, false)
    ok(co && co.volume < 1e6 && co.termSeasons <= maxTerm(oak), 'counter-offer is not legal')
    ok(accepts(oak, co.volume, co.termSeasons, false), 'the counter-offer is itself refused')

    // Reputation is not local, and collateral makes the tree stronger.
    var h0 = oak.health
    var c0 = signContract(oak.id, 5, 2, 1000, false)
    ok(c0, 'the oak refused a legal contract')
    C().setStock(g.res, 'biomass', 1e6)
    defaultContract(c0)
    ok(oak.health > h0 - 1e-9, 'a forfeited stake did not raise the tree it was forfeited to')
    ok(g.a1.netRep < 1e-9, 'a default did not cost net reputation')
    ok(oak.refuseUntil > g.t, 'a defaulted tree still talks to you')

    // ── G1b / G1c: the reserve, and the deadlock it must never become.
    g = fresh(0x51EED1); init(g)
    g.a1.tips = 40
    C().setStock(g.a1.sub, 'leaf', 5000)
    ok(reserveSugar() > 0, 'the feedstock reserve is not being held')
    C().setStock(g.a1.sub, 'leaf', 0)
    ok(reserveSugar() === 0, 'G1c: the reserve did not collapse on a bare floor')

    // ── The project wedges between the printed price and the price you pay.
    g = fresh(0x51EED1); init(g)
    var printed = unitPrice('leaf')
    g.proj.flags.bacterial_antagonism = 1
    near(unitPrice('leaf') / printed, MK.ANTAGONISM, 1e-9, 'bacterial antagonism is not 22% off')
    delete g.proj.flags.bacterial_antagonism
    g.proj.flags.forward_contracts = 1
    near(unitPrice('leaf'), MK.FORWARD_MARK * fairValue('leaf'), 1e-9,
      'forward contracts did not fix the fill at 1.05 × fair')
    C().setStock(g.res, 'sugar', 1e6)
    for (w = 0; w < MK.FORWARD_FILLS; w++) buy('leaf', 10)
    ok(forwardLeft(g) === 0, 'forward contracts did not run out after twelve fills')
    ok(flag(g, 'forward_contracts'), 'forward contracts corrupted its own purchase marker')
    ok(unitPrice('leaf') === price('leaf'), 'a spent forward contract still fixes the fill')

    // Selling is gated, and it is a 28% haircut when it opens.
    g = fresh(0x51EED1); init(g)
    C().setStock(g.a1.sub, 'leaf', 20000)
    ok(sell('leaf', 5000) === 0, 'selling was possible without The Two-Sided Book')
    g.proj.flags.two_sided_book = 1
    var sugar0 = g.res.sugar
    var sold = sell('leaf', 5000)
    ok(sold === 5000, 'the sell did not fill')
    near((g.res.sugar - sugar0) / (5000 * price('leaf')), A.SPREAD, 1e-9, 'the spread is not 28%')

    // ── The Hollow Beech: a term outside the legal range, and nothing can reach back into it.
    g = fresh(0x51EED1); init(g)
    g.a1.season = A.SEASON_WINTER
    C().setStock(g.res, 'biomass', 1e6)
    var beech = spawnTree('beech')
    beech.rep = 40
    g.proj.flags.the_hollow_beech = 1
    var bc = signContract(beech.id, 2, 3, 0, false)
    ok(bc && bc.termSeasons === CT.BEECH_TERM, 'the beech did not sign its own term')
    g.t += 2 * T().CLOCK.SEASON_S
    ok(renegotiate(bc.id) === null, 'a twelve-season term was renegotiable')

    // ── Offline: D32 is HARD. Nothing is lost while away.
    g = fresh(0x51EED1); init(g)
    g.a1.season = A.SEASON_WINTER
    C().setStock(g.res, 'biomass', 1e6)
    var away = spawnTree('birch')
    away.rep = 30
    var ac = signContract(away.id, 3, 2, 0, false)
    ok(ac, 'the away contract did not sign')
    C().setStock(g.res, 'sugar', 0)
    C().setStock(g.a1.sub, 'leaf', 0)
    for (w = 0; w < 240; w++) { g.t += 30; deliverContracts(30, { stochastic: false, offline: true }) }
    ok(ac.shortfall > 0, 'an unpayable term offline recorded no shortfall at all')
    ok(g.stats.defaults === 0, 'D32: a term defaulted while the player was away')

    // And Dormancy Clause is the priced alternative: zero minerals, and the term waits.
    g = fresh(0x51EED1); init(g)
    g.a1.season = A.SEASON_WINTER
    C().setStock(g.res, 'biomass', 1e6); C().setStock(g.res, 'sugar', 1e5)
    var dt2 = spawnTree('birch'); dt2.rep = 30
    var dc = signContract(dt2.id, 3, 2, 0, false)
    dc.suspended = true
    g.proj.flags.dormancy_clause = 1
    var end0 = dc.endT, min0 = g.res.minerals
    for (w = 0; w < 60; w++) { g.t += 10; deliverContracts(10, { stochastic: false, offline: true }) }
    near(dc.endT - end0, 600, 1e-6, 'a suspended term did not wait for the player')
    ok(g.res.minerals === min0, 'a suspended term paid minerals')

    // ── Solicitations arrive on a stable hash, not a draw.
    ok(C().hash32('solicit', 3, 7) === C().hash32('solicit', 3, 7), 'solicitation stream is unstable')

    // ── The mast window: the largest payday in the act, and it must be reachable in year zero,
    // which is the year the game boots into.
    g = fresh(0x51EED1); init(g)
    g.a1.season = A.SEASON_AUTUMN
    var moak = spawnTree('oak')
    ok(mastEligible(moak), 'a fresh oak is not eligible for a mast')
    applyEvent('mast', null)
    ok(mastActive(moak), 'a mast granted in year zero is not active')
    ok(!mastEligible(moak), 'an oak is immediately eligible for a second mast')
    var dry = carbonDeficit(moak)
    g.a1.year = CT.MAST_GAP_Y
    ok(mastEligible(moak), 'an oak never becomes eligible again')
    ok(!mastActive(moak), 'a mast window never closes')
    ok(dry > carbonDeficit(moak), 'a mast year did not deepen the deficit')

    // ── The Act II exchange: the same walk, and an asymmetric drift you can watch.
    g = fresh(0x51EED1); init(g)
    g.act = 2
    C().setStock(g.res, 'biomass', 1e9)
    var pbar0 = g.a2.mineralMkt.Pbar
    tradeMinerals(1000)
    ok(g.a2.mineralMkt.Pbar > pbar0, 'buying minerals did not raise their base')
    var up = g.a2.mineralMkt.Pbar - pbar0
    tradeMinerals(-1000)
    var down = pbar0 + up - g.a2.mineralMkt.Pbar
    near(down / up, MX.SELL_DRIFT / MX.BUY_DRIFT, 1e-9, 'the mineral drift is not asymmetric')
    for (w = 0; w < 600; w++) stepMineralExchange(1.0, { stochastic: false })
    ok(isFinite(g.a2.mineralMkt.P) && g.a2.mineralMkt.P > 0, 'the mineral price left the reals')

    // ── Numeric safety across a long, adversarial run (D39, D40).
    g = fresh(0xFA11ED); init(g)
    g.a1.unlockedTypes = TYPES.slice()
    g.a1.patches = A.PATCH_MAX
    var fz = C().rng(99), ti2
    for (w = 0; w < 4000; w++) {
      g.t += 1
      g.a1.seasonPhase += 1 / T().CLOCK.SEASON_S
      while (g.a1.seasonPhase >= 1) {
        g.a1.seasonPhase -= 1
        g.a1.season = (g.a1.season + 1) % 4
        if (g.a1.season === A.SEASON_SPRING) g.a1.year += 1
      }
      C().setStock(g.res, 'sugar', g.res.sugar + 200)
      C().setStock(g.res, 'biomass', g.res.biomass + 2000)
      stepMarket(1.0, { stochastic: true })
      if (fz.next() < 0.05) applyEvent(EVENTS[fz.int(EVENTS.length)].id, fz)
      if (fz.next() < 0.30) buy(TYPES[fz.int(TYPES.length)], fz.next() * 5e4)
      stepTrees(1.0, { stochastic: true })
      deliverContracts(1.0, { stochastic: true })
      for (ti2 = 0; ti2 < TYPES.length; ti2++) {
        var rw2 = g.a1.mkt[ti2]
        if (!isFinite(rw2.price) || !isFinite(rw2.base) || !isFinite(rw2.mom) || !isFinite(rw2.stock)) {
          f.push('market row ' + TYPES[ti2] + ' left the reals at t=' + g.t); w = 4000; break
        }
        if (rw2.stock < 0 || rw2.stock > capOf(TYPES[ti2]) + 1e-6) {
          f.push('market row ' + TYPES[ti2] + ' stock out of range: ' + rw2.stock); w = 4000; break
        }
        if (rw2.price < A.PRICE_FLOOR * rw2.base * 0.999 ||
            rw2.price > A.PRICE_CEIL * rw2.base * 1.001) {
          f.push('market row ' + TYPES[ti2] + ' price escaped its bounds'); w = 4000; break
        }
        if (Math.abs(rw2.mom) > A.MOM_CLAMP + 1e-9) {
          f.push('momentum escaped its clamp on ' + TYPES[ti2]); w = 4000; break
        }
      }
    }
    ok(C().faults.count >= 0 && isFinite(g.res.minerals) && g.res.minerals >= 0,
      'the fuzz run produced a non-finite mineral balance')
    ok(g.a1.trees.length <= CT.TREE_MAX, 'more counterparties than the act supports')

    // ── D20 vs naive play, simulated for sixty minutes from identical starting conditions.
    // Four boot phases, pooled. A single alignment is not a measurement: a term of exactly two
    // seasons re-signs at the same point in the calendar forever, so one start phase can hand the
    // naive book a bud-break window on every renewal and flatter it by 50%.
    var PHASES = [0.1667, 0.4167, 0.6667, 0.9167]
    var wm = 0, ws = 0, nm = 0, ns = 0, ph, wise, naive
    for (var pj = 0; pj < PHASES.length; pj++) {
      ph = PHASES[pj]
      wise = runPolicy(true, ph); wm += wise.minerals; ws += wise.sugar
      naive = runPolicy(false, ph); nm += naive.minerals; ns += naive.sugar
    }
    ok(ws > 0 && ns > 0, 'a policy delivered no sugar at all')
    var rw = wm / ws
    var rn = nm / ns
    ok(rw / rn >= 3.0, 'D20 is worth only ' + (rw / rn).toFixed(2) +
      '× (' + rw.toFixed(5) + ' vs ' + rn.toFixed(5) + ' ⛬ per sugar)')

    // Two runs of the same policy must agree exactly: the difference is decisions, not variance.
    var again = runPolicy(true, PHASES[0])
    var once = runPolicy(true, PHASES[0])
    ok(again.minerals === once.minerals && again.sugar === once.sugar,
      'the same policy produced two different books')

    var back = HY.state.init(HY.state.deserialise(saved))
    init(back)
    return f
  }

  function fresh (seed) { return HY.state.init(HY.state.newGame(seed)) }

  function marketSnapshot (s) {
    var i, out = []
    for (i = 0; i < TYPES.length; i++) {
      out.push([s.a1.mkt[i].base, s.a1.mkt[i].price, s.a1.mkt[i].mom, s.a1.mkt[i].stock])
    }
    return JSON.stringify({ rows: out, stock: s.a1.mkt[IDX.leaf].stock })
  }

  // The seasonal production envelope: moistureMult · tempMult at each season's settled moisture.
  // act1.js owns both curves; while it is absent the sixty-minute harness needs the same shape, and
  // it defers to the real functions the moment they exist so there is never a second copy in play.
  function seasonEnv (season) {
    var A = T().A1
    if (HY.act1 && HY.act1.moistureMult && HY.act1.tempMult) {
      return HY.act1.moistureMult() * HY.act1.tempMult()
    }
    var m = A.SEASON_MOIST[season]
    return Math.exp(-Math.pow(m - A.MOIST_OPT, 2) / A.MOIST_WIDTH) * A.SEASON_TEMP[season]
  }

  // A headless sixty minutes. Both policies get the same forest, the same seed, the same tip ramp,
  // the same seasonal production envelope (1.00 in autumn, 0.239 in winter) and the same sugar cap,
  // and the market runs with {stochastic:false} so both face an identical price path. Everything
  // that differs afterwards is a decision.
  function runPolicy (wise, phase0) {
    var A = T().A1, SEASON = T().CLOCK.SEASON_S
    var SIM_S = 3600, DT = 1.0
    var TIPS_0 = 3, TIPS_PER_S = 1 / 40, TIPS_MAX = 60
    var SUG_PER_TIP = 0.480, COVER = 0.75, COLL_PER_VOL = 2700
    var NAIVE_COVER = 0.75, NAIVE_TERM = 2
    var WISE_D = 0.70, RELOCK = 1.15, START_REP = 15

    var g = fresh(0xD20D21)
    init(g)
    g.a1.seasonPhase = phase0
    C().setStock(g.res, 'sugar', 400)
    C().setStock(g.res, 'biomass', 5e5)
    // The identical starting conditions D21 names: the same understory, in the same order, at the
    // same reputation. The oak is standing in both forests from the first second and refuses both
    // players until their record earns it, which is the point of it.
    var stock = ['birch', 'aspen', 'fir', 'hemlock', 'oak'], si
    for (si = 0; si < stock.length; si++) spawnTree(stock[si]).rep = START_REP

    var minerals0 = g.stats.mineralEarned
    book.deliveredSugar = 0

    for (var step = 0; step < SIM_S / DT; step++) {
      g.t += DT
      g.a1.seasonPhase += DT / SEASON
      while (g.a1.seasonPhase >= 1) {
        g.a1.seasonPhase -= 1
        g.a1.season = (g.a1.season + 1) % 4
        if (g.a1.season === A.SEASON_SPRING) g.a1.year += 1
      }
      g.a1.tips = Math.min(TIPS_MAX, Math.floor(TIPS_0 + g.t * TIPS_PER_S))
      var income = SUG_PER_TIP * g.a1.tips * seasonEnv(g.a1.season)
      C().setStock(g.res, 'sugar', g.res.sugar + income * DT)
      C().setStock(g.res, 'biomass', g.res.biomass + income * DT * 10)
      // Sugar you do not spend does not keep, so an autumn surplus cannot simply be banked against
      // a winter book. This is the constraint that makes over-committing a real error.
      var scap = A.SUGAR_CAP_BASE + A.SUGAR_CAP_SLOPE * g.a1.tips
      if (g.res.sugar > scap) {
        C().setStock(g.res, 'sugar', g.res.sugar - (g.res.sugar - scap) * A.ROT_RATE * DT)
      }

      stepMarket(DT, { stochastic: false })
      stepTrees(DT, { stochastic: false })

      var live = 0, k, cc, ct
      for (k = 0; k < g.a1.contracts.length; k++) if (g.a1.contracts[k].state === 'active') live++

      if (wise) {
        // D20, expressed entirely in numbers the tables already publish: sign only into a deep
        // deficit, best counterparty first, take the longest term that counterparty's trust allows,
        // post collateral to the saturation of collBonus, accept exclusivity, hold total coverage
        // under the winter production floor, and re-lock whenever the deficit has moved far enough
        // that the same volume is worth materially more.
        var rank = []
        for (k = 0; k < g.a1.trees.length; k++) {
          var tr = g.a1.trees[k]
          if (tr.d < WISE_D || treeContracts(tr.id).length) continue
          rank.push({ tree: tr, rate: offer(tr, 1, maxTerm(tr), COLL_PER_VOL, true) })
        }
        rank.sort(function (a, b) { return b.rate - a.rate })
        for (k = 0; k < rank.length; k++) {
          var head = COVER * income - committedSugarPerSec()
          var vol = Math.min(head, maxIntake(rank[k].tree))
          if (!(vol > 0)) continue
          var tm = maxTerm(rank[k].tree)
          if (!accepts(rank[k].tree, vol, tm, true)) continue
          signContract(rank[k].tree.id, vol, tm, COLL_PER_VOL * vol, true)
        }
        for (k = 0; k < g.a1.contracts.length; k++) {
          cc = g.a1.contracts[k]
          if (cc.state !== 'active') continue
          ct = treeById(cc.treeId)
          if (!ct) continue
          var now = offer(ct, cc.sugarRate, Math.min(cc.termSeasons, maxTerm(ct)),
            cc.collateral, cc.exclusive)
          if (now > RELOCK * cc.mineralRate) renegotiate(cc.id)
        }
      } else {
        // The naive book: sign the first tree that will take you, at the slider's default term,
        // post nothing, ask for nothing, and never look at the calendar.
        if (!live) {
          for (k = 0; k < g.a1.trees.length; k++) {
            var nt = g.a1.trees[k]
            var nv = Math.min(NAIVE_COVER * income, maxIntake(nt))
            if (!accepts(nt, nv, NAIVE_TERM, false)) continue
            signContract(nt.id, nv, NAIVE_TERM, 0, false)
            break
          }
        }
      }

      deliverContracts(DT, { stochastic: false })
    }

    return { minerals: g.stats.mineralEarned - minerals0, sugar: book.deliveredSugar }
  }

  // ───────────────────────────────────────────────────────────────────────────

  HY.economy1 = {
    // BIBLE §6 M7's surface
    stepMarket: stepMarket,
    buy: buy,
    sell: sell,
    fairValue: fairValue,
    priceHistory: priceHistory,
    stepTrees: stepTrees,
    carbonDeficit: carbonDeficit,
    offer: offer,
    accepts: accepts,
    signContract: signContract,
    renegotiate: renegotiate,
    exitContract: exitContract,
    deliverContracts: deliverContracts,
    stepMineralExchange: stepMineralExchange,

    // §6's generic module surface
    init: init,
    tick: tick,
    serialise: serialise,
    migrate: migrate,

    // Data other modules need rather than re-declare: act1's decomposition reads DEADFALL and
    // mineralPerG, projects.js reads minPrice for the G1a failsafe, ui reads the rest.
    DEADFALL: DEADFALL,
    TYPES: TYPES,
    SPECIES: SPECIES,
    EVENTS: EVENTS,
    mineralPerG: mineralPerG,
    minPrice: minPrice,
    price: price,
    unitPrice: unitPrice,
    capOf: capOf,
    fallOf: fallOf,
    totalSubstrate: totalSubstrate,
    counter: counter,
    maxIntake: maxIntake,
    maxTerm: maxTerm,
    treeById: treeById,
    contractById: contractById,
    committedSugarPerSec: committedSugarPerSec,
    netSugar: netSugar,
    bookState: bookState,
    setSuspended: setSuspended,
    setStandingOrder: setStandingOrder,
    solicitations: solicitations,
    acceptSolicitation: acceptSolicitation,
    declineSolicitation: declineSolicitation,
    applyEvent: applyEvent,
    mineralPrice: mineralPrice,
    tradeMinerals: tradeMinerals,
    spawnTree: spawnTree,

    __selftest: __selftest
  }
})(window.HY = window.HY || {})
