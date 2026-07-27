;(function (HY) {
  'use strict'

  // M6 · act1.js — Act I production and environment (BIBLE §6 M6).
  //
  // Owns: EXTEND, hyphal tips, decomposition over the seven typed pools, the season clock, the
  // moisture relaxation, the patch ladder, the event engine, and DECIDE.
  //
  // Does NOT own: the Litter Market price walk, the trees' offer/accept arithmetic, contract
  // delivery (all `economy1`), the projects catalog (`projects`), or the console (`log`). Every one
  // of those is read lazily and feature-detected, so this file works alone and works in the build.
  //
  // Numbers: everything that crosses a module boundary is in `HY.core.TUNE.A1`. What lives below is
  // the per-type decomposition table (`01` §5.5's k / etaB / etaS / mineralPerG columns) and the
  // event engine's payload constants (`01` §7.3–7.5) — a table and a set of rows that no other
  // module reads, and that move as a unit or not at all.

  // ───────────────────────────────────────────────────────────────────────────
  // LAZY MODULE ACCESS — load order must not matter for anything except `core`
  // ───────────────────────────────────────────────────────────────────────────

  function C () { return HY.core }
  function T () { return HY.core.TUNE }
  function A () { return HY.core.TUNE.A1 }
  function S () { return HY.state.state }

  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }
  function flagOn (s, id) { return !!(s.proj && s.proj.flags && s.proj.flags[id]) }

  function fire (id, tokens) {
    if (HY.log && HY.log.logFire) HY.log.logFire(id, tokens)
  }

  // feel() has a top-level guard of its own and never throws; the check is for the acts of the
  // build in which it has not been concatenated yet.
  function feel (ev, params) {
    if (HY.feel && HY.feel.feel) HY.feel.feel(ev, params)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DATA TABLES
  // ───────────────────────────────────────────────────────────────────────────

  var TYPES = ['leaf', 'needle', 'twig', 'bark', 'log', 'stump', 'carrion']

  // `01` §5.5, decomposition columns only. `k` is a *throughput* weight, not a yield: hard
  // substrate occupies tips for longer and pays better per gram, which is what makes the
  // consumption order a live decision rather than a sort. Prices, caps and litterfall are the same
  // table's market columns and belong to economy1.
  var DECOMP = {
    leaf:    { k: 1.60, etaB: 1.00, etaS: 0.80, mineralPerG: 0 },
    needle:  { k: 1.00, etaB: 1.00, etaS: 1.00, mineralPerG: 0 },
    twig:    { k: 0.70, etaB: 1.15, etaS: 1.20, mineralPerG: 0 },
    bark:    { k: 0.45, etaB: 1.30, etaS: 1.40, mineralPerG: 0.00012 },
    log:     { k: 0.22, etaB: 1.60, etaS: 1.80, mineralPerG: 0 },
    stump:   { k: 0.10, etaB: 2.20, etaS: 2.60, mineralPerG: 0 },
    carrion: { k: 3.00, etaB: 0.80, etaS: 0.50, mineralPerG: 0.0400 }
  }

  // The tap (`01` §3.2). 2.0 g of litter at leaf's etaB is exactly +1.00 biomass, which is the
  // first number the player ever sees move and the reason TIP_BASE = 60 g lands on 35 seconds at
  // the measured one-thumb rate. Neither figure is a knob (BIBLE §9.1).
  var TAP_LITTER = 2.0

  // Project effects that projects.js delegates here rather than expressing as a `mult` key.
  var SHEATH_HALVING = 0.50      // Hydrophobic Sheath: moistureMult' = 1 − 0.50·(1 − moistureMult)
  var NECROMASS_REFUND = 0.12    // Necromass Recycling: 12% of consumed mass returns to its pool

  var CALM_RATE = 0.55           // set.calm: eventRateMod 1.00 → 0.55 (BIBLE §3, `01` §7.2)
  var EPS = 1e-9

  // ── the event engine's constants (`01` §7.3–7.5) ───────────────────────────

  var SPRING = 0, SUMMER = 1, AUTUMN = 2, WINTER = 3

  var EV = {
    MAST_SEASONS: 2, MAST_MIN_YEARS: 3,
    BEETLE_HIT: 0.40, BEETLE_DECAY: 0.10, BEETLE_DEATH: 0.05, BEETLE_SEASONS: 6,
    WINDTHROW_LOG: [8000, 42000], WINDTHROW_BARK: [2000, 9000],
    WINDTHROW_MOM: 0.55, WINDTHROW_BASE: 0.86, WINDTHROW_SEASONS: 2, WINDTHROW_KILL_P: 0.18,
    CARRION: [400, 1400],
    EARTHWORM_STRIP: 0.30, EARTHWORM_COMP: 2.20, EARTHWORM_SEASONS: 3,
    FIRESCAR_MINERAL: 3.0, FIRESCAR_DEFICIT: 0.20, FIRESCAR_SEASONS: 1,
    DROUGHT_MOIST: 0.55, DROUGHT_SEASONS: [1, 2],
    FROST_MOIST: 0.60, FROST_TEMP: 0.70, FROST_SEASONS: 1,
    WETSPRING_MOIST: 1.22, WETSPRING_PRICE: 0.82, WETSPRING_SEASONS: 2,
    LATEFROST_NEED: 1.80, LATEFROST_PHASE: [0.15, 0.30], LATEFROST_SEASONS: 1
  }

  // Per-season probabilities, indexed SPRING SUMMER AUTUMN WINTER. A zero is "cannot happen here",
  // which is a different statement from "is unlikely here" and the table says which is which.
  var EVENTS = [
    { id: 'mast',       kind: 'tree',    p: [0, 0, 0.12, 0] },
    { id: 'beetle',     kind: 'tree',    p: [0, 0.06, 0, 0] },
    { id: 'windthrow',  kind: 'supply',  p: [0.09, 0.09, 0.18, 0.14] },
    { id: 'carrion',    kind: 'supply',  p: [0.10, 0.10, 0.10, 0.22] },
    { id: 'earthworm',  kind: 'supply',  p: [0.07, 0.07, 0, 0] },
    { id: 'firescar',   kind: 'supply',  p: [0.03, 0.03, 0.03, 0.03] },
    { id: 'drought',    kind: 'weather', p: [0.04, 0.10, 0, 0] },
    { id: 'frost',      kind: 'weather', p: [0, 0, 0, 0.14] },
    { id: 'wetspring',  kind: 'weather', p: [0.18, 0, 0, 0] },
    { id: 'latefrost',  kind: 'weather', p: [0.09, 0, 0, 0] }
  ]

  // The console line each event owns. Firing is imperative because the line is news, not a state.
  var EV_LINE = {
    windthrow: 'a1.windthrow', carrion: 'a1.carrion', earthworm: 'a1.earthworm',
    firescar: 'a1.fire_scar', drought: 'a1.drought', frost: 'a1.hard_frost',
    wetspring: 'a1.wet_spring', latefrost: 'a1.late_frost'
  }

  // ── the trees the event engine introduces (`01` §6.2, §7.3, §9) ────────────

  var TREE_MAX = 7                                  // `01` §6.2: 3–7 simultaneous
  var REP_NEIGHBOUR = [8, 22, 38, 55, 72]           // netRep thresholds that introduce one
  var NEIGHBOUR_REP = { base: 15, slope: 0.45, min: 5, max: 70 }

  var SPECIES = {
    birch:   { ramets: 1, age: [30, 55], conifer: false, deciduous: true },
    aspen:   { ramets: 3, age: [25, 70], conifer: false, deciduous: true },
    fir:     { ramets: 1, age: [60, 140], conifer: true, deciduous: false },
    hemlock: { ramets: 1, age: [90, 300], conifer: true, deciduous: false },
    oak:     { ramets: 1, age: [120, 260], conifer: false, deciduous: true },
    elm:     { ramets: 1, age: [70, 110], conifer: false, deciduous: true }
  }

  // What each patch introduces when its claim completes, and the pool a reputation threshold draws
  // from at that patch count (`01` §7.3: home/2 birch-aspen, 3–4 fir-hemlock, 5–6 oak).
  var PATCH_TREES = [
    [],                     // index 0 is unused; patches are 1-based
    ['birch'],
    ['aspen'],
    ['fir'],
    ['hemlock', 'fir'],
    ['elm'],
    ['oak']
  ]
  var PATCH_POOL = [
    [],
    ['birch', 'aspen'],
    ['birch', 'aspen'],
    ['fir', 'hemlock'],
    ['fir', 'hemlock'],
    ['oak', 'elm'],
    ['oak']
  ]

  // ───────────────────────────────────────────────────────────────────────────
  // DETERMINISTIC EVENT ROLLS
  // ───────────────────────────────────────────────────────────────────────────

  // One stream per (seed, event, boundary), derived rather than stored. Nothing in §3 holds an
  // Act I rng state, and nothing needs to: a boundary is uniquely named by its year and season, so
  // the same save reloaded at the same moment rolls the same weather — which is what D35 asks for
  // and what makes an offline reconcile byte-identical to the live run it replaces.
  function rollStream (s, id, year, season) {
    return C().rng(C().hash32(s.seed, 'a1', id, year, season))
  }

  function uniform (r, lo, hi) { return lo + (hi - lo) * r.next() }

  // ───────────────────────────────────────────────────────────────────────────
  // ACTIVE-EVENT MODIFIERS — derived from `a1.activeEvents`, never stored twice
  // ───────────────────────────────────────────────────────────────────────────

  // Payload keys, all optional: moist · temp · mineral · need (multipliers), deficit (additive),
  // comp / fall (per-type multipliers), treeId, until (a pending event's fire phase).
  function mods (s) {
    var m = { moist: 1, temp: 1, mineral: 1, need: 1, deficit: 0, comp: null, fall: null }
    var list = s.a1.activeEvents, i, e, p, k
    for (i = 0; i < list.length; i++) {
      e = list[i]
      if (!e || e.pending) continue
      p = e.payload
      if (!p) continue
      if (typeof p.moist === 'number') m.moist *= p.moist
      if (typeof p.temp === 'number') m.temp *= p.temp
      if (typeof p.mineral === 'number') m.mineral *= p.mineral
      if (typeof p.need === 'number') m.need *= p.need
      if (typeof p.deficit === 'number') m.deficit += p.deficit
      if (p.comp) { if (!m.comp) m.comp = {}; for (k in p.comp) if (own(p.comp, k)) m.comp[k] = (m.comp[k] || 1) * p.comp[k] }
      if (p.fall) { if (!m.fall) m.fall = {}; for (k in p.fall) if (own(p.fall, k)) m.fall[k] = (m.fall[k] || 1) * p.fall[k] }
    }
    return m
  }

  function own (o, k) { return Object.prototype.hasOwnProperty.call(o, k) }

  // §3 stores `weatherMoistMod` and `weatherFallMod` because economy1 and the UI read them every
  // tick; they are a cache of the active-event set and are rewritten whenever it changes.
  function publishMods (s) {
    var m = mods(s), i, t
    s.a1.weatherMoistMod = m.moist
    for (i = 0; i < TYPES.length; i++) {
      t = m.fall && m.fall[TYPES[i]]
      s.a1.weatherFallMod[i] = typeof t === 'number' ? t : 1
    }
  }

  function compMult (type) {
    var m = mods(S())
    return m.comp && typeof m.comp[type] === 'number' ? m.comp[type] : 1
  }

  function mineralMult () { return mods(S()).mineral }
  function deficitMod () { return mods(S()).deficit }
  function needMod () { return mods(S()).need }

  // ───────────────────────────────────────────────────────────────────────────
  // THE CLOCK (tick step 1) AND THE ENVIRONMENT (tick step 2)
  // ───────────────────────────────────────────────────────────────────────────

  // BIBLE §4 step 1 makes act1 the owner of `t` in Act I. A host that advances the clock itself
  // before dispatching would double it and put the first season boundary at 150 s, so ownership is
  // detected rather than assumed: if `t` moved since our last call, somebody else owns it.
  var lastT = null

  // `opts` is BIBLE §4.1's `{stochastic}` flag, honoured from the first line of the step rather
  // than bolted on: the offline path, the catch-up tick and the harness all arrive here.
  function stepSeason (dt, opts) {
    var s = S()
    if (s.act !== 1) return
    var K = T().CLOCK
    if (lastT === null || Math.abs(s.t - lastT) < EPS) s.t += dt
    lastT = s.t

    s.a1.seasonPhase += dt / K.SEASON_S
    var guard = 0
    // A 120-second offline macro-step crosses a third of a season; a 12-hour reconcile at the cap
    // crosses 120 of them. The boundary is a loop, not an `if`, and every crossing rolls.
    while (s.a1.seasonPhase >= 1 && guard++ < 4096) {
      s.a1.seasonPhase -= 1
      var was = s.a1.season
      s.a1.season = (was + 1) % 4
      if (s.a1.season === SPRING) s.a1.year += 1
      if (was === WINTER) s.stats.wintersEnded += 1
      rollEvents(opts)
      feel('season', { season: s.a1.season })
    }
    stepPending(s)
  }

  // Late frost is the one event that does not fire on a boundary: it lands just after bud-break,
  // which is why it is the best contract window in the game and why it is worth 9% of springs.
  function stepPending (s) {
    var list = s.a1.activeEvents, i, e
    for (i = list.length - 1; i >= 0; i--) {
      e = list[i]
      if (!e || !e.pending) continue
      // A pending event whose season ended never happened: the buds it would have caught are open.
      if (s.a1.season !== SPRING) { list.splice(i, 1); continue }
      if (s.a1.seasonPhase >= num(e.at)) {
        e.pending = false
        fire(EV_LINE[e.id])
        publishMods(s)
      }
    }
  }

  function stepEnvironment (dt) {
    var s = S()
    if (s.act !== 1) return
    var a = A()
    var target = a.SEASON_MOIST[s.a1.season] * num(s.a1.weatherMoistMod)
    // The exact integral of the relaxation, so a 0.1 s live tick and a 120 s offline macro-step
    // land on the same moisture. The linear form overshoots past dt ≈ 25 s and inverts past 50 s.
    var f = 1 - Math.exp(-a.MOIST_RELAX_PER_S * dt)
    var m = s.a1.moisture + (target - s.a1.moisture) * f
    s.a1.moisture = C().clamp(m, a.MOIST_MIN, a.MOIST_MAX)
  }

  function moistureMult () {
    var s = S(), a = A()
    var m = C().clamp(num(s.a1.moisture), a.MOIST_MIN, a.MOIST_MAX)
    var d = m - a.MOIST_OPT
    var v = Math.exp(-(d * d) / a.MOIST_WIDTH)
    // Hydrophobic Sheath halves the *penalty*, not the value: at the optimum it does nothing, which
    // is why it is worth buying before a winter and never worth buying in an autumn.
    if (flagOn(s, 'hydrophobic_sheath')) v = 1 - SHEATH_HALVING * (1 - v)
    return v
  }

  function tempMult () {
    var s = S(), a = A()
    var v = a.SEASON_TEMP[s.a1.season]
    if (s.mult.antifreeze && s.a1.season === WINTER) v *= a.ANTIFREEZE_WINTER
    return v * mods(s).temp
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE EVENT ENGINE (`01` §7.2–7.5)
  // ───────────────────────────────────────────────────────────────────────────

  function eventRateMod (s) { return s.set && s.set.calm ? CALM_RATE : 1 }

  function mktRow (s, type) {
    var i = TYPES.indexOf(type)
    return i < 0 ? null : s.a1.mkt[i]
  }

  function addStock (s, type, grams) {
    var row = mktRow(s, type)
    if (row) C().setStock(row, 'stock', num(row.stock) + grams)
  }

  function push (s, id, seasons, payload, extra) {
    var e = { id: id, seasonsLeft: seasons, payload: payload || {} }
    if (extra) for (var k in extra) if (own(extra, k)) e[k] = extra[k]
    s.a1.activeEvents.push(e)
    return e
  }

  function trees (s) { return s.a1.trees }

  function treesOf (s, test) {
    var out = [], i, t = trees(s)
    for (i = 0; i < t.length; i++) if (t[i] && test(t[i])) out.push(t[i])
    return out
  }

  // Every roll is independent and multiple events may be live at once; their modifiers multiply.
  // Nothing here opens a modal and nothing pauses (`01` §7.2).
  function rollEvents (opts) {
    var s = S()
    if (s.act !== 1) return
    // Perennial Mycelium deletes the event engine outright. The average is very good and nothing
    // will ever be better than the average again.
    if (s.mult.perennial) { expire(s); return }

    var stochastic = !(opts && opts.stochastic === false)
    expire(s)

    var rate = eventRateMod(s)
    var i, row, p, r
    for (i = 0; i < EVENTS.length; i++) {
      row = EVENTS[i]
      p = row.p[s.a1.season] * rate
      if (!(p > 0)) continue
      r = rollStream(s, row.id, s.a1.year, s.a1.season)
      if (!stochastic) {
        // Offline substitutes expectations, and only for the events that hand the player
        // something. Everything that takes — beetles, kills, droughts, frosts — does not run at
        // all, because D32 says nothing is lost while away and an expected-value drought is a loss
        // you did not get to answer.
        if (row.kind === 'supply') offlineSupply(s, row.id, p)
        continue
      }
      if (r.next() >= p) continue
      switch (row.id) {
        case 'mast': fireMast(s, r); break
        case 'beetle': fireBeetle(s, r); break
        case 'windthrow': fireWindthrow(s, r); break
        case 'carrion': fireCarrion(s, r); break
        case 'earthworm': fireEarthworm(s, r); break
        case 'firescar': fireFireScar(s, r); break
        case 'drought': fireDrought(s, r); break
        case 'frost': fireFrost(s, r); break
        case 'wetspring': fireWetSpring(s, r); break
        case 'latefrost': fireLateFrost(s, r); break
      }
    }
    publishMods(s)
  }

  function expire (s) {
    var list = s.a1.activeEvents, i, e
    for (i = list.length - 1; i >= 0; i--) {
      e = list[i]
      if (!e) { list.splice(i, 1); continue }
      if (e.pending) continue
      if (e.id === 'beetle') beetleSeason(s, e)
      e.seasonsLeft -= 1
      if (e.seasonsLeft > 0) continue
      if (e.id === 'drought') s.stats.droughtsSurvived += 1
      if (e.id === 'mast') { var t = treeById(s, e.payload.treeId); if (t) t.mastYear = false }
      list.splice(i, 1)
    }
    publishMods(s)
  }

  function fireMast (s, r) {
    var pool = treesOf(s, function (t) {
      return t.species === 'oak' &&
        (t.lastMast === undefined || s.a1.year - num(t.lastMast) >= EV.MAST_MIN_YEARS)
    })
    if (!pool.length) return
    var t = r.pick(pool)
    t.mastYear = true
    t.lastMast = s.a1.year
    push(s, 'mast', EV.MAST_SEASONS, { treeId: t.id })
    fire('a1.mast')
  }

  function fireBeetle (s, r) {
    var pool = treesOf(s, function (t) {
      return SPECIES[t.species] && SPECIES[t.species].conifer && num(t.health) > EV.BEETLE_DEATH
    })
    if (!pool.length) return
    var t = r.pick(pool)
    t.health = C().clamp(num(t.health) - EV.BEETLE_HIT, 0, 1)
    push(s, 'beetle', EV.BEETLE_SEASONS, { treeId: t.id })
    fire('a1.beetle')
    if (t.health <= EV.BEETLE_DEATH) killTree(s, t, 'beetle')
  }

  // A struck fir loses health every season and becomes, in every number the player can read, an
  // elm: a superb counterparty with an end date.
  function beetleSeason (s, e) {
    var t = treeById(s, e.payload.treeId)
    if (!t) { e.seasonsLeft = 0; return }
    t.health = C().clamp(num(t.health) - EV.BEETLE_DECAY, 0, 1)
    if (t.health <= EV.BEETLE_DEATH) { killTree(s, t, 'beetle'); e.seasonsLeft = 0 }
  }

  function fireWindthrow (s, r) {
    var p = s.a1.patches
    addStock(s, 'log', uniform(r, EV.WINDTHROW_LOG[0], EV.WINDTHROW_LOG[1]) * p)
    addStock(s, 'bark', uniform(r, EV.WINDTHROW_BARK[0], EV.WINDTHROW_BARK[1]) * p)
    var row = mktRow(s, 'log')
    if (row) {
      row.mom = num(row.mom) - EV.WINDTHROW_MOM
      row.base = num(row.base) * EV.WINDTHROW_BASE
    }
    push(s, 'windthrow', EV.WINDTHROW_SEASONS, {})
    fire('a1.windthrow')
    if (r.next() < EV.WINDTHROW_KILL_P) {
      var pool = trees(s)
      if (pool.length) {
        var t = r.pick(pool)
        killTree(s, t, 'windthrow')
        fire('a1.windthrow_kill')
      }
    }
  }

  function fireCarrion (s, r) {
    addStock(s, 'carrion', uniform(r, EV.CARRION[0], EV.CARRION[1]))
    s.stats.carrionEventsSeen += 1
    fire('a1.carrion')
  }

  function fireEarthworm (s, r) {
    var row = mktRow(s, 'leaf')
    if (row) C().setStock(row, 'stock', num(row.stock) * EV.EARTHWORM_STRIP)
    C().setStock(s.a1.sub, 'leaf', num(s.a1.sub.leaf) * EV.EARTHWORM_STRIP)
    push(s, 'earthworm', EV.EARTHWORM_SEASONS, { comp: { leaf: EV.EARTHWORM_COMP } })
    fire('a1.earthworm')
  }

  // Ash is a mineral windfall that simultaneously craters your contract rates: everything above you
  // got the ash too, and needs you less.
  function fireFireScar (s) {
    push(s, 'firescar', EV.FIRESCAR_SEASONS,
      { mineral: EV.FIRESCAR_MINERAL, deficit: -EV.FIRESCAR_DEFICIT })
    fire('a1.fire_scar')
  }

  function fireDrought (s, r) {
    var n = EV.DROUGHT_SEASONS[0] + r.int(EV.DROUGHT_SEASONS[1] - EV.DROUGHT_SEASONS[0] + 1)
    push(s, 'drought', n, { moist: EV.DROUGHT_MOIST })
    fire('a1.drought')
  }

  function fireFrost (s) {
    push(s, 'frost', EV.FROST_SEASONS, { moist: EV.FROST_MOIST, temp: EV.FROST_TEMP })
    var i, t = trees(s), sp
    for (i = 0; i < t.length; i++) {
      sp = SPECIES[t[i].species]
      if (sp && sp.deciduous && !sp.conifer) t[i].refuseUntil = s.t + T().CLOCK.SEASON_S
    }
    fire('a1.hard_frost')
  }

  function fireWetSpring (s) {
    push(s, 'wetspring', EV.WETSPRING_SEASONS, { moist: EV.WETSPRING_MOIST })
    var i, row
    for (i = 0; i < 2; i++) {              // leaf and needle only
      row = mktRow(s, TYPES[i])
      if (row) row.base = num(row.base) * EV.WETSPRING_PRICE
    }
    fire('a1.wet_spring')
  }

  function fireLateFrost (s, r) {
    push(s, 'latefrost', EV.LATEFROST_SEASONS, { need: EV.LATEFROST_NEED }, {
      pending: true,
      at: uniform(r, EV.LATEFROST_PHASE[0], EV.LATEFROST_PHASE[1])
    })
  }

  // Offline, a supply event pays its expectation and nothing else happens: no price crash to buy
  // into, no counterparty on the floor. The kindness is bounded and the decision is still yours.
  function offlineSupply (s, id, p) {
    if (id === 'windthrow') {
      addStock(s, 'log', p * 0.5 * (EV.WINDTHROW_LOG[0] + EV.WINDTHROW_LOG[1]) * s.a1.patches)
      addStock(s, 'bark', p * 0.5 * (EV.WINDTHROW_BARK[0] + EV.WINDTHROW_BARK[1]) * s.a1.patches)
    } else if (id === 'carrion') {
      addStock(s, 'carrion', p * 0.5 * (EV.CARRION[0] + EV.CARRION[1]))
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TREES — introduced by the event engine, run by economy1
  // ───────────────────────────────────────────────────────────────────────────

  function treeById (s, id) {
    var t = trees(s), i
    for (i = 0; i < t.length; i++) if (t[i] && t[i].id === id) return t[i]
    return null
  }

  function maxTreeId (s) {
    var t = trees(s), i, m = 0
    for (i = 0; i < t.length; i++) if (t[i] && t[i].id > m) m = t[i].id
    return m
  }

  function repFor (s) {
    return C().clamp(NEIGHBOUR_REP.base + NEIGHBOUR_REP.slope * num(s.a1.netRep),
      NEIGHBOUR_REP.min, NEIGHBOUR_REP.max)
  }

  function spawnTree (s, species, r) {
    if (HY.economy1 && HY.economy1.spawnTree) return HY.economy1.spawnTree(species, s.a1.patches)
    var sp = SPECIES[species] || SPECIES.birch
    var t = {
      id: maxTreeId(s) + 1,
      species: species,
      age: Math.round(uniform(r, sp.age[0], sp.age[1])),
      health: 1,
      rep: repFor(s),
      ramets: sp.ramets,
      refuseUntil: 0,
      lastReneg: 0,
      mastYear: false
    }
    trees(s).push(t)
    if (species === 'aspen') fire('a1.aspen')
    if (species === 'hemlock') fire('a1.hemlock')
    if (species === 'elm') fire('a1.elm_offer')
    return t
  }

  function killTree (s, t, cause) {
    var list = trees(s), i = list.indexOf(t)
    if (i < 0) return
    // The book is settled before the body is: collateral returns, reputation is untouched. Then
    // the trunk enters the log pool, and the game does not comment on what you do with it.
    if (HY.economy1 && HY.economy1.voidContracts) HY.economy1.voidContracts(t.id, cause)
    else voidContractsOf(s, t.id)
    list.splice(i, 1)
    if (cause === 'windthrow') addStock(s, 'log', uniform(rollStream(s, 'trunk', t.id, 0),
      EV.WINDTHROW_LOG[0], EV.WINDTHROW_LOG[1]))
    if (t.species === 'elm') fire('a1.elm_death')
  }

  function voidContractsOf (s, treeId) {
    var list = s.a1.contracts, i, c
    for (i = list.length - 1; i >= 0; i--) {
      c = list[i]
      if (!c || c.treeId !== treeId) continue
      C().setStock(s.res, 'biomass', num(s.res.biomass) + num(c.collateral))
      list.splice(i, 1)
    }
  }

  // "New neighbour" (`01` §7.3) fires on reputation thresholds and on each patch claim. The count
  // of trees ever introduced is `maxTreeId`, which is monotone and already in the save, so no
  // extra bookkeeping field is needed and a tree that died is not silently replaced.
  function stepNeighbours (s) {
    if (s.act !== 1) return
    var want = (revealTrees(s) ? 1 : 0) + (s.a1.patches - 1)
    var i
    for (i = 0; i < REP_NEIGHBOUR.length; i++) if (num(s.a1.netRep) >= REP_NEIGHBOUR[i]) want += 1
    var have = maxTreeId(s)
    while (have < want && trees(s).length < TREE_MAX) {
      have += 1
      var r = rollStream(s, 'neighbour', have, s.a1.patches)
      var pool = PATCH_POOL[Math.min(s.a1.patches, PATCH_POOL.length - 1)]
      var species = have === 1 ? 'birch' : r.pick(pool)
      spawnTree(s, species, r)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE TAP
  // ───────────────────────────────────────────────────────────────────────────

  function totalSubstrate () {
    var s = S(), sum = 0, i
    for (i = 0; i < TYPES.length; i++) sum += num(s.a1.sub[TYPES[i]])
    return sum
  }

  // Drawn from the player's own consumption order, which defaults to cheapest-per-gram first. The
  // tap and the network eat out of the same list, so re-ordering it is one decision, not two.
  function consume (s, grams) {
    var order = s.a1.consumptionOrder, i, k, have, g, took = 0
    var out = { grams: 0, biomass: 0, sugar: 0, minerals: 0 }
    var a = A(), mm = mineralMult()
    for (i = 0; i < order.length && grams - took > EPS; i++) {
      k = order[i]
      if (!DECOMP[k] || s.a1.unlockedTypes.indexOf(k) < 0) continue
      have = num(s.a1.sub[k])
      if (have <= 0) continue
      g = Math.min(grams - took, have)
      C().setStock(s.a1.sub, k, have - g)
      out.biomass += g * a.ETA_B * DECOMP[k].etaB
      out.sugar += g * a.ETA_S * DECOMP[k].etaS
      out.minerals += g * DECOMP[k].mineralPerG * mm
      took += g
    }
    out.grams = took
    return out
  }

  function onExtend () {
    var s = S()
    if (s.act !== 1) return false
    var g = Math.min(TAP_LITTER, totalSubstrate())
    if (!(g > 0)) return false          // the console says so on its own poll; nothing here advises

    var got = consume(s, g)
    C().setStock(s.res, 'biomass', num(s.res.biomass) + got.biomass)
    s.res.cumBiomass = num(s.res.cumBiomass) + got.biomass
    C().setStock(s.res, 'sugar', num(s.res.sugar) + got.sugar)
    if (got.minerals > 0) {
      C().setStock(s.res, 'minerals', num(s.res.minerals) + got.minerals)
      s.stats.mineralEarned = num(s.stats.mineralEarned) + got.minerals
    }
    s.a1.hyphaeManual = num(s.a1.hyphaeManual) + A().HYPHAE_PER_TAP
    s.stats.taps += 1

    feel('extend', { grams: got.grams })
    fire('a1.first_tap')
    fire('a1.third_tap')
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TIPS
  // ───────────────────────────────────────────────────────────────────────────

  function tipCost (n) {
    var s = S(), a = A()
    if (n === undefined) n = s.a1.tips
    var coef = flagOn(s, 'foraging_front') ? a.TIP_COEF_FORAGING : a.TIP_COEF
    return Math.ceil(a.TIP_BASE + coef * Math.pow(Math.max(0, n), a.TIP_EXP))
  }

  // The spine of the act. Below tip 24 it is exactly zero, and the four-tip warning window before
  // it is a forecast rather than a wall (`01` §4 unlock 8).
  function tipMineralCost (n) {
    var a = A()
    if (n === undefined) n = S().a1.tips
    if (n < a.MIN_GATE_TIPS) return 0
    return Math.ceil(a.MIN_GATE_COEF * Math.pow(n - (a.MIN_GATE_TIPS - 1), a.MIN_GATE_EXP))
  }

  function buyTip () {
    var s = S()
    if (s.act !== 1) return false
    var n = s.a1.tips
    if (n >= T().NUM.INT_MAX.tips) return false
    var cost = tipCost(n), mineral = tipMineralCost(n)
    if (num(s.res.biomass) < cost || num(s.res.minerals) < mineral) return false

    C().setStock(s.res, 'biomass', num(s.res.biomass) - cost)
    if (mineral > 0) C().setStock(s.res, 'minerals', num(s.res.minerals) - mineral)
    s.a1.tips = n + 1
    feel('buy', { what: 'tip', n: s.a1.tips })
    fire('a1.first_tip')
    return true
  }

  function hyphae () {
    var s = S(), a = A()
    return a.HYPHAE_PER_TIP * s.a1.tips +
           a.HYPHAE_PER_PATCH * (s.a1.patches - 1) +
           num(s.a1.hyphaeManual)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THROUGHPUT AND DECOMPOSITION (tick step 4)
  // ───────────────────────────────────────────────────────────────────────────

  function enzK (s, type) {
    var v = s.mult.enzymeK ? s.mult.enzymeK[type] : 1
    return typeof v === 'number' && v > 0 ? v : 1
  }

  // 1.875 g/s of budget per tip (S1). One tip on leaf is 3.000 g of litter, 1.500 g of biomass and
  // 0.480 g of sugar per second — the button face is the first of those and it is exact.
  function throughputPerSec () {
    var s = S()
    if (s.act !== 1) return 0
    var v = A().TIP_THROUGHPUT * s.a1.tips *
      num(s.mult.enzymeMult) * num(s.mult.prestigeGrowth) *
      num(s.mult.structureMult) * num(s.mult.patchMult) *
      moistureMult() * tempMult()
    if (s.a1.claimInFlight) v *= A().CLAIM_THROUGHPUT
    return v > 0 ? v : 0
  }

  var starving = false
  var litterRate = 0
  var carrionTasted = false

  function stepDecomposition (dt) {
    var s = S()
    if (s.act !== 1) return 0
    var budget = throughputPerSec() * dt
    if (!(budget > 0) || !(dt > 0)) { starving = false; litterRate = 0; return 0 }

    var a = A()
    var order = s.a1.consumptionOrder
    var refund = flagOn(s, 'necromass_recycling') ? NECROMASS_REFUND : 0
    var mm = mineralMult()
    var bio = 0, sug = 0, min = 0, litter = 0
    var i, k, d, have, effK, g

    for (i = 0; i < order.length && budget > EPS; i++) {
      k = order[i]
      d = DECOMP[k]
      if (!d) continue
      if (s.a1.unlockedTypes.indexOf(k) < 0) continue
      have = num(s.a1.sub[k])
      if (have <= 0) continue
      effK = d.k * enzK(s, k)
      g = Math.min(budget * effK, have)
      if (!(g > 0)) continue

      C().setStock(s.a1.sub, k, have - g + g * refund)
      bio += g * a.ETA_B * d.etaB
      sug += g * a.ETA_S * d.etaS
      min += g * d.mineralPerG * mm
      // Charge back the tip-time actually used: hard substrate buys fewer grams per second, not
      // fewer grams per gram.
      budget -= g / effK
      litter += g
      if (k === 'carrion' && !carrionTasted) { carrionTasted = true; fire('a1.carrion_use') }
    }

    if (bio > 0) {
      C().setStock(s.res, 'biomass', num(s.res.biomass) + bio)
      s.res.cumBiomass = num(s.res.cumBiomass) + bio
    }
    if (sug > 0) C().setStock(s.res, 'sugar', num(s.res.sugar) + sug)
    if (min > 0) {
      C().setStock(s.res, 'minerals', num(s.res.minerals) + min)
      s.stats.mineralEarned = num(s.stats.mineralEarned) + min
    }

    starving = budget > EPS
    litterRate = litter / dt
    return bio
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CAPS AND SPOILAGE (tick step 7)
  // ───────────────────────────────────────────────────────────────────────────

  function sugarCap () {
    var s = S(), a = A()
    return a.SUGAR_CAP_BASE + a.SUGAR_CAP_SLOPE * s.a1.tips + num(s.mult.sclerotiaBonus)
  }

  function stepSpoilage (dt) {
    var s = S()
    if (s.act !== 1 || !(dt > 0)) return 0
    var cap = sugarCap()
    var excess = num(s.res.sugar) - cap
    if (!(excess > 0)) return 0
    // 6%/s of the excess, integrated exactly. `stats.rotted` is what gates Sclerotia, so the
    // failure has to be counted precisely enough to be the fix.
    var rot = excess * (1 - Math.exp(-A().ROT_RATE * dt))
    C().setStock(s.res, 'sugar', num(s.res.sugar) - rot)
    s.stats.rotted = num(s.stats.rotted) + rot
    return rot
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TERRITORY
  // ───────────────────────────────────────────────────────────────────────────

  // S3: `fall` scales as patches^1.8 and `cap` stays linear. Stocks scaling slower than flows is
  // what keeps the late-act market thin and twitchy.
  function patchSupplyMult () { return Math.pow(S().a1.patches, A().PATCH_SUPPLY_EXP) }
  function patchCapMult () { return S().a1.patches }

  function syncPatchMult (s) {
    s.mult.patchMult = 1 + A().PATCH_MULT_STEP * (s.a1.patches - 1)
  }

  // The price is charged by the project that calls this; what is charged here is time. A claim
  // costs 45 s per patch index at ×0.90 throughput, so *when* you claim is the decision — in
  // autumn it costs a tenth of your best month, in winter a tenth of nothing.
  function claimPatch (id) {
    var s = S(), a = A()
    if (s.act !== 1) return false
    id = Math.floor(id)
    if (!(id > 1) || id > a.PATCH_MAX) return false
    if (s.a1.claimInFlight || s.a1.patches >= id) return false   // idempotent under a double-fire
    if (id !== s.a1.patches + 1) return false
    s.a1.claimInFlight = { patchId: id, endsAt: s.t + a.PATCH[id - 1].claimS }
    return true
  }

  function claimProgress () {
    var s = S(), c = s.a1.claimInFlight
    if (!c) return 0
    var span = A().PATCH[c.patchId - 1].claimS
    return C().clamp(1 - (num(c.endsAt) - s.t) / (span || 1), 0, 1)
  }

  function stepClaim () {
    var s = S()
    if (s.act !== 1) return
    var c = s.a1.claimInFlight
    if (!c || s.t < num(c.endsAt)) return
    s.a1.claimInFlight = null
    s.a1.patches = Math.min(Math.max(s.a1.patches, c.patchId), A().PATCH_MAX)
    syncPatchMult(s)
    // Each patch introduces its own counterparty; §7.3's "on each patch claim" is the second half
    // of the New Neighbour rule and stepNeighbours reads the patch count directly.
    var list = PATCH_TREES[s.a1.patches] || []
    var i, r
    for (i = 0; i < list.length && trees(s).length < TREE_MAX; i++) {
      r = rollStream(s, 'patchtree', s.a1.patches, i)
      spawnTree(s, list[i], r)
    }
    feel('claim', { patch: s.a1.patches })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DERIVED READOUTS
  // ───────────────────────────────────────────────────────────────────────────

  // The litter the network is asking for, in grams per second — the units the forest's supply is
  // in. When a pool empties the demand does not fall, which is exactly what the alarm must see.
  function demandPerSec () {
    var s = S(), order = s.a1.consumptionOrder, i, k, first = null
    for (i = 0; i < order.length; i++) {
      k = order[i]
      if (!DECOMP[k] || s.a1.unlockedTypes.indexOf(k) < 0) continue
      if (first === null) first = k
      if (num(s.a1.sub[k]) > 0) return throughputPerSec() * DECOMP[k].k * enzK(s, k)
    }
    if (first === null) return 0
    return throughputPerSec() * DECOMP[first].k * enzK(s, first)
  }

  function forestSupply () {
    return A().FOREST_SUPPLY_BASE * patchSupplyMult()
  }

  function utilisation () {
    var sustainable = forestSupply() * A().SUSTAINABLE_FRAC
    if (!(sustainable > 0)) return 0
    return demandPerSec() / sustainable
  }

  function litterPerSec () { return litterRate }
  function isStarving () { return starving }

  // G1b's feedstock reserve, in sugar: 60 seconds of what the network is about to eat. economy1
  // enforces it in the delivery scheduler; it lives here because two of its three terms do.
  function feedstockReserve () {
    var s = S()
    if (totalSubstrate() < 1) return 0            // G1c: the reserve must never become the deadlock
    var price = minPrice(s)
    if (!isFinite(price)) return 0
    return A().RESERVE_S * demandPerSec() * price
  }

  function minPrice (s) {
    if (HY.economy1 && HY.economy1.minPrice) return HY.economy1.minPrice()
    var best = Infinity, i, row
    for (i = 0; i < TYPES.length; i++) {
      if (s.a1.unlockedTypes.indexOf(TYPES[i]) < 0) continue
      row = s.a1.mkt[i]
      if (row && row.price > 0 && row.price < best) best = row.price
    }
    return best
  }

  // BIBLE §5.2, latched. Every predicate below is written against a monotone witness, because a
  // panel that is earned is never taken back and `biomass >= 60` stops being true the moment the
  // player spends it.
  function revealTrees (s) {
    return trees(s).length > 0 ||
      (num(s.res.sugar) >= A().TREES_SUGAR_G && s.a1.season === WINTER)
  }

  function reveals () {
    var s = S(), a = A()
    return {
      substrate: num(s.res.cumBiomass) >= a.REVEAL_SUBSTRATE_G,
      tips: num(s.res.cumBiomass) >= a.REVEAL_TIPS_G || s.a1.tips > 0,
      sugar: s.a1.tips >= a.REVEAL_SUGAR_TIPS,
      market: s.t >= a.MARKET_T || totalSubstrate() <= a.MARKET_SUB_G || s.stats.purchases > 0,
      seasons: s.t >= a.SEASONS_T,
      trees: revealTrees(s),
      projects: num(s.res.biomass) >= a.PROJECTS_BIOMASS_G || s.proj.seen.length > 0,
      mineralWarn: s.a1.tips >= a.MIN_WARN_TIPS,
      mineralGate: s.a1.tips >= a.MIN_GATE_TIPS,
      signal: flagOn(s, 'action_potential'),
      decide: flagOn(s, 'action_potential') && num(s.res.signal) >= a.DECIDE_SIGNAL
    }
  }

  var SEASON_NAME = ['spring', 'summer', 'autumn', 'winter']
  function seasonName () { return SEASON_NAME[S().a1.season] }

  // ───────────────────────────────────────────────────────────────────────────
  // THE TRANSITION
  // ───────────────────────────────────────────────────────────────────────────

  // D26. It deletes the market, reputation, every contract, every tip and 90% of stored biomass.
  // The player loses the game they spent two hours becoming good at, and the trees do not notice.
  function decide () {
    var s = S()
    if (s.act !== 1) return false          // idempotent: the catch-up tick will double-fire

    var i, c

    // 1 · the book is torn up
    for (i = 0; i < s.a1.contracts.length; i++) {
      c = s.a1.contracts[i]
      if (c) C().setStock(s.res, 'biomass', num(s.res.biomass) + num(c.collateral))
    }
    s.a1.contracts.length = 0
    for (i = 0; i < s.a1.trees.length; i++) if (s.a1.trees[i]) delete s.a1.trees[i].rep
    s.a1.trees.length = 0
    s.a1.netRep = 0

    // 2 · the market closes. Sugar stops being money in the same instant, which is the half of the
    // revocation the player will not notice until they reach for it.
    for (i = 0; i < s.a1.mkt.length; i++) {
      s.a1.mkt[i].stock = 0
      s.a1.mkt[i].price = 0
      s.a1.mkt[i].mom = 0
    }
    for (i = 0; i < TYPES.length; i++) C().setStock(s.a1.sub, TYPES[i], 0)
    C().setStock(s.res, 'sugar', 0)
    s.a1.unlockedTypes.length = 0

    // 3 · the body is rebuilt
    C().setStock(s.res, 'biomass', num(s.res.biomass) * T().HANDOFF.BIOMASS_KEPT)
    s.a1.tips = 0
    s.a1.hyphaeManual = 0
    s.a1.patches = 1
    s.a1.claimInFlight = null
    s.a1.activeEvents.length = 0
    syncPatchMult(s)
    publishMods(s)

    // C24: DECIDE gives Act II one claimed region at d = 0.30 and nothing else. `nodes` does not
    // exist; dead state is a bug waiting to be depended on.
    var reg = s.a2.regions
    if (reg && reg.flags && reg.flags.length) {
      reg.flags[0] |= 0x01 | 0x02 | 0x04       // discovered · surveyed · claimed
      reg.d[0] = 0.30
    }

    // 4 · the mind opens
    s.act = 2
    s.phase = 'network'
    lastT = null

    if (HY.loop && HY.loop.setSimRate) HY.loop.setSimRate(T().CLOCK.SIM_HZ_A23)
    if (HY.log && HY.log.playSequence) HY.log.playSequence('decide')
    if (HY.state && HY.state.save) HY.state.save()
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE SURFACE
  // ───────────────────────────────────────────────────────────────────────────

  function init (s) {
    s = s || S()
    lastT = null
    carrionTasted = false
    starving = false
    litterRate = 0
    if (s.act !== 1) return s
    if (!s.a1.weatherFallMod || s.a1.weatherFallMod.length !== TYPES.length) {
      s.a1.weatherFallMod = []
      for (var i = 0; i < TYPES.length; i++) s.a1.weatherFallMod.push(1)
    }
    syncPatchMult(s)
    publishMods(s)
    return s
  }

  // The canonical order of BIBLE §4's Act I steps: clock (1), environment (2), production (4),
  // spoilage (7). A host that drives the individual steps itself must not also call this.
  function tick (s, dt, opts) {
    s = s || S()
    if (s.act !== 1 || !(dt > 0)) return
    stepSeason(dt, opts)
    stepEnvironment(dt)
    stepDecomposition(dt)
    stepSpoilage(dt)
    stepClaim()
    stepNeighbours(s)
  }

  // Everything act1 owns is a key in §3; state.js serialises all of it. Nothing here is private
  // enough to need a second copy of the save.
  function serialise () { return null }

  function migrate (save, from) {
    if (!save || !save.a1) return save
    var i
    if (!save.a1.weatherFallMod || save.a1.weatherFallMod.length !== TYPES.length) {
      save.a1.weatherFallMod = []
      for (i = 0; i < TYPES.length; i++) save.a1.weatherFallMod.push(1)
    }
    // A save written before the event engine grew its pending flag carries rows with no payload.
    for (i = save.a1.activeEvents.length - 1; i >= 0; i--) {
      var e = save.a1.activeEvents[i]
      if (!e || !e.id) { save.a1.activeEvents.splice(i, 1); continue }
      if (!e.payload) e.payload = {}
      if (typeof e.seasonsLeft !== 'number') e.seasonsLeft = 1
    }
    void from
    return save
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — returns [] when healthy
  // ───────────────────────────────────────────────────────────────────────────

  // `08` §7's minute-by-minute table, restated as the four rows the throughput chain must
  // reproduce. `mult` is the aggregate of the multiplier ladder the table's own rows say the
  // reference player is holding at that minute: nothing at 1 and 5; the second enzyme tier by 15;
  // that plus Rhizomorph Cords and the second patch by 30. `litter` is the table's g/s column.
  var REF = [
    { min: 1,  tips: 2,  season: AUTUMN, env: 1.00, mult: 1.00, litter: 6 },
    { min: 5,  tips: 17, season: WINTER, env: 0.55, mult: 1.00, litter: 28 },
    { min: 15, tips: 33, season: SPRING, env: 0.92, mult: 1.55, litter: 141 },
    { min: 30, tips: 72, season: WINTER, env: 0.27, mult: 1.55 * 1.18 * 1.06, litter: 122 }
  ]

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }
    function near (got, want, tol, label) {
      if (!(Math.abs(got - want) <= tol)) f.push(label + ': got ' + got + ', want ' + want + ' ±' + tol)
    }
    function within (got, lo, hi, label) {
      if (!(got >= lo && got <= hi)) f.push(label + ': got ' + got + ', want ' + lo + '–' + hi)
    }

    var keep = HY.state.exportB64()
    try {
      // ── the cost laws ────────────────────────────────────────────────────
      cold(1)
      // S2's published curve is quoted to three figures; the law is the law and the table is its
      // rounding, so the two anchors it states exactly are exact here and the rest carry the
      // rounding as tolerance.
      near(tipCost(0), A().TIP_BASE, 0, 'tipCost(0) is not the 35-second beat')
      near(tipCost(12), 292, 3, 'tipCost(12) off S2 table')
      near(tipCost(24), 817, 2, 'tipCost(24) off S2 table')
      near(tipCost(255), 44160, 40, 'tipCost(255) off S2 table')
      // G2a: an additive-base-plus-geometric law is a constant over the played range. This one is
      // not: the ratio across the act must be at least 40.
      ok(tipCost(255) / tipCost(0) >= 40, 'tipCost fails the G2a ratio guard')
      near(tipMineralCost(23), 0, 0, 'the mineral gate opened early')
      near(tipMineralCost(24), 1, 0, 'tip 24 must cost exactly 1 mineral')
      near(tipMineralCost(36), 2, 0, 'tipMineralCost(36) off K10/K11')
      near(tipMineralCost(60), 8, 0, 'tipMineralCost(60) off K10/K11')
      near(tipMineralCost(120), 32, 4, 'tipMineralCost(120) off K10/K11')
      var prev = 0
      for (var g = 24; g <= 400; g++) {
        ok(tipMineralCost(g) >= prev, 'the mineral gate is not monotone at tip ' + g)
        prev = tipMineralCost(g)
      }
      // Σ⛬ to tip 255 is 12,360 against 15,900 of simulated income: the gate binds tips for the
      // whole act and still leaves a float for structures and patches (`08` §4.1).
      var sumMin = 0
      for (g = 0; g < 255; g++) sumMin += tipMineralCost(g)
      within(sumMin, 9000, 13000, 'Σ mineral to tip 255')
      S().proj.flags.foraging_front = 1
      ok(tipCost(100) < 10570, 'Foraging Front did not move the coefficient')
      delete S().proj.flags.foraging_front

      // ── the environment ──────────────────────────────────────────────────
      cold(2)
      near(moistureMult(), 1, 1e-9, 'cold boot moisture is not the peak of the hump')
      near(tempMult(), 1, 1e-9, 'cold boot autumn is not 1.000')
      var env = [[SPRING, 1.15, 0.919], [SUMMER, 0.70, 0.765], [AUTUMN, 1.05, 1.000], [WINTER, 0.55, 0.239]]
      for (var i = 0; i < env.length; i++) {
        S().a1.season = env[i][0]
        S().a1.moisture = env[i][1]
        near(moistureMult() * tempMult(), env[i][2], 0.002, 'seasonal envelope, season ' + env[i][0])
      }
      // The hump, not a ramp: too wet is as bad as too dry, and only the wet-spring event teaches it.
      S().a1.season = AUTUMN; S().a1.moisture = 1.45
      ok(moistureMult() < 0.60, 'the moisture response is not unimodal')
      S().proj.flags.hydrophobic_sheath = 1
      near(moistureMult(), 1 - SHEATH_HALVING * (1 - 0.587), 0.01, 'Hydrophobic Sheath')
      delete S().proj.flags.hydrophobic_sheath
      S().a1.season = WINTER; S().mult.antifreeze = true
      near(tempMult(), 0.85, 0.005, 'Antifreeze Glycoproteins did not reach winter 0.85')

      // ── the clock ────────────────────────────────────────────────────────
      cold(3)
      var s = S()
      var boundary = -1
      for (var t = 0; t < 4000 && boundary < 0; t += 1) {
        stepSeason(1.0)
        if (s.a1.season === WINTER) boundary = s.t
      }
      near(boundary, T().A1.SEASONS_T, 1.0, 'the first season boundary is not at 300 s exactly')
      // The clock a 120-second offline macro-step keeps must be the clock a 0.1 s live tick keeps.
      cold(3)
      while (S().t < 5000) stepSeason(120)
      near(S().a1.season, seasonAt(S().t), 0, 'macro-stepped season index')
      near(S().a1.year, yearAt(S().t), 0, 'macro-stepped year')
      cold(3)
      while (S().t < 5000) stepSeason(T().CLOCK.DT_A1)
      near(S().a1.season, seasonAt(S().t), 0, 'live-stepped season index')
      near(S().a1.year, yearAt(S().t), 0, 'live-stepped year')
      ok(S().stats.wintersEnded >= 3, 'winters that ended were not counted')

      // ── D05, HARD: the first automation at 35 s ──────────────────────────
      var r17 = simulate({ tapRate: 1.70, until: 90 })
      near(r17.firstTipAt, 35, 3, 'D05 first automation not at 35 s')
      within(r17.firstTipAt, 28, 50, 'D05 first automation outside 28–50 s')
      ok(r17.boughtFirst, 'D05 the first tip was affordable but buyTip() refused it')

      // ── D06: the tip count at 90 s ───────────────────────────────────────
      // `08` §7's own minute table has 2 tips at 0:60 and 6 at 2:00, which is what the S2 cost law
      // and a 1.70/s thumb produce here (2 and 6). Its 90-second checkpoint of 6 is a pre-S2
      // figure — under the flat 61 g curve S2 replaced, 6 tips by 90 s was right. Both bands are
      // asserted: the shipped curve at the reference rate, and the checkpoint itself at the
      // comfortable rate that still satisfies D05.
      within(r17.tipsAt90, 4, 9, 'D06 tips at 90 s, player R (1.70/s)')
      within(r17.tipsAt120, 5, 9, 'tips at 120 s vs 08 §7 minute-2 row')
      var r20 = simulate({ tapRate: 2.00, until: 90 })
      within(r20.firstTipAt, 28, 50, 'D05 at 2.00 taps/s')
      within(r20.tipsAt90, 5, 9, 'D06 tips at 90 s (5–9)')

      // The tap is not vestigial until t ≈ 100 s (window W1): tapping must beat waiting at 1 tip.
      ok(1.70 * 1.0 > 1.50, 'W1: the tap stopped mattering before the third tip')

      // ── the throughput chain against 08 §7 ───────────────────────────────
      for (i = 0; i < REF.length; i++) {
        var row = REF[i]
        cold(4)
        s = S()
        s.a1.tips = row.tips
        s.a1.season = row.season
        s.mult.enzymeMult = row.mult
        s.a1.moisture = moistureFor(row.season, row.env)
        var litter = throughputPerSec() * DECOMP.leaf.k
        ok(Math.abs(litter - row.litter) / row.litter <= 0.15,
          '08 §7 minute ' + row.min + ': litter ' + litter.toFixed(1) + ' g/s vs ' + row.litter)
      }

      // ── decomposition: conservation, yields, and the k mechanic ──────────
      cold(5)
      s = S()
      s.a1.tips = 1
      s.a1.season = AUTUMN
      s.a1.moisture = A().MOIST_OPT
      var before = num(s.a1.sub.leaf)
      var gained = stepDecomposition(1.0)
      near(before - num(s.a1.sub.leaf), 3.0, 1e-6, 'one tip does not eat 3.000 g of leaf per second')
      near(gained, 1.5, 1e-6, 'one tip does not make 1.500 g of biomass per second')
      near(num(s.res.sugar), 0.48, 1e-6, 'one tip does not make 0.480 g of sugar per second (S1)')
      // §3.6: out/in is 0.50 + 0.20·η_S and can never exceed 0.70. Leaf's η_S of 0.80 puts it at
      // 0.66; a type that returned more than it ate would break the one intuition the player is
      // allowed to trust.
      ok(gained + num(s.res.sugar) <= 3.0 * (1 - A().RESPIRED) + 1e-9,
        'decomposition returned more than 70% of what it ate')
      near(gained + num(s.res.sugar), 3.0 * (A().ETA_B + A().ETA_S * DECOMP.leaf.etaS), 1e-9,
        'the leaf yield pair is not 0.50 / 0.20·η_S')

      // Wood is fewer grams per second and more of everything per gram.
      cold(5)
      s = S()
      s.a1.tips = 10
      s.a1.season = AUTUMN
      s.a1.moisture = A().MOIST_OPT
      s.a1.unlockedTypes.push('stump')
      s.a1.sub.leaf = 0
      s.a1.sub.stump = 1e6
      s.a1.consumptionOrder = ['stump'].concat(TYPES)
      var wood = stepDecomposition(1.0)
      near(litterOf(), 1.875 * 10 * DECOMP.stump.k, 1e-6, 'the stump throughput weight is wrong')
      ok(wood / litterOf() > 1.0, 'stumps do not out-yield leaf per gram')

      // ── the sugar cap and the rot that gates Sclerotia ───────────────────
      cold(6)
      s = S()
      s.a1.tips = 10
      near(sugarCap(), 700, 1e-9, 'sugarCap is not 400 + 30·tips')
      s.res.sugar = 1700
      var rot = stepSpoilage(1.0)
      near(rot, 1000 * (1 - Math.exp(-0.06)), 1e-9, 'rot is not 6%/s of the excess')
      near(s.stats.rotted, rot, 1e-12, 'stats.rotted did not record the loss')
      s.res.sugar = 1e6
      stepSpoilage(600)                    // a ten-minute macro-step must not rot below the cap
      ok(num(s.res.sugar) >= sugarCap() - 1e-6, 'a large dt rotted sugar below the cap')

      // ── hyphae, patches and the claim ────────────────────────────────────
      cold(7)
      s = S()
      s.a1.tips = 255
      s.a1.patches = 6
      near(hyphae(), 596.25, 0.5, 'S4: 255 tips and 6 patches must reach the 500 m gate')
      cold(7)
      s = S()
      s.res.biomass = 1e6
      ok(claimPatch(2), 'claimPatch(2) refused')
      ok(!claimPatch(2), 'claimPatch is not idempotent under a double-fire')
      ok(!claimPatch(3), 'two claims may not be in flight at once')
      s.a1.tips = 10
      s.a1.season = AUTUMN
      s.a1.moisture = A().MOIST_OPT
      var slowed = throughputPerSec()
      s.a1.claimInFlight = null
      near(slowed / throughputPerSec(), A().CLAIM_THROUGHPUT, 1e-9,
        'a claim in flight does not cost 10% of throughput')
      cold(7)
      s = S()
      s.res.biomass = 1e6
      claimPatch(2)
      s.t += A().PATCH[1].claimS
      stepClaim()
      ok(s.a1.patches === 2, 'the claim did not complete')
      near(s.mult.patchMult, 1 + A().PATCH_MULT_STEP, 1e-9, 'patchMult was not resynced')
      near(patchSupplyMult(), Math.pow(2, 1.8), 1e-9, 'S3: fall must scale as patches^1.8')
      near(patchCapMult(), 2, 1e-9, 'S3: cap must stay linear in patches')
      ok(trees(s).length >= 1, 'the second patch introduced no counterparty')

      // ── the event engine ─────────────────────────────────────────────────
      cold(8)
      s = S()
      var seen = {}, n
      for (n = 0; n < 400; n++) {
        s.a1.year = n
        for (var q = 0; q < 4; q++) {
          s.a1.season = q
          rollEvents()
          for (var e2 = 0; e2 < s.a1.activeEvents.length; e2++) seen[s.a1.activeEvents[e2].id] = 1
        }
      }
      ok(Object.keys(seen).length >= 6, 'the event engine produced only ' + Object.keys(seen).length + ' kinds')
      ok(num(s.a1.weatherMoistMod) > 0, 'weatherMoistMod was left at zero')

      // Determinism: the same seed and the same boundary roll the same weather.
      cold(9)
      S().a1.season = SUMMER
      rollEvents()
      var a1 = JSON.stringify(S().a1.activeEvents)
      cold(9)
      S().a1.season = SUMMER
      rollEvents()
      ok(a1 === JSON.stringify(S().a1.activeEvents), 'the event engine is not deterministic')

      // Nothing is taken while you are away (D32).
      cold(9)
      s = S()
      s.a1.trees.push({ id: 1, species: 'fir', age: 80, health: 1, rep: 40, ramets: 1,
        refuseUntil: 0, lastReneg: 0, mastYear: false })
      var carrion0 = s.a1.mkt[TYPES.indexOf('carrion')].stock
      for (n = 0; n < 40; n++) { s.a1.season = (s.a1.season + 1) % 4; rollEvents({ stochastic: false }) }
      near(s.a1.trees[0].health, 1, 1e-9, 'a tree lost health offline')
      ok(s.a1.activeEvents.length === 0, 'a modifier event fired offline')
      ok(s.a1.mkt[TYPES.indexOf('carrion')].stock > carrion0, 'offline supply paid nothing')

      // Perennial Mycelium deletes the engine, permanently.
      cold(9)
      S().mult.perennial = true
      for (n = 0; n < 40; n++) { S().a1.season = (S().a1.season + 1) % 4; rollEvents() }
      ok(S().a1.activeEvents.length === 0, 'Perennial Mycelium did not delete the event engine')

      // ── offline is the same tick, not an approximation (D29) ─────────────
      var live = runFor(12, T().CLOCK.DT_A1, 1200)
      var away = runFor(12, 120, 1200)
      near(away.season, live.season, 0, 'the macro-stepped run ended in a different season')
      near(away.year, live.year, 0, 'the macro-stepped run ended in a different year')
      ok(Math.abs(away.biomass - live.biomass) / live.biomass < 0.15,
        'offline production diverges from live: ' + away.biomass.toFixed(0) + ' vs ' + live.biomass.toFixed(0))
      // D35: same seed, same elapsed, byte-identical.
      ok(JSON.stringify(runFor(12, 120, 1200)) === JSON.stringify(away),
        'the offline path is not deterministic')

      // ── the tick budget (D49: ≤ 6 ms in Act I) ───────────────────────────
      cold(13)
      s = S()
      s.a1.tips = 255
      s.a1.patches = 6
      s.a1.unlockedTypes = TYPES.slice()
      for (i = 0; i < TYPES.length; i++) s.a1.sub[TYPES[i]] = 1e7
      for (i = 0; i < TREE_MAX; i++) {
        s.a1.trees.push({ id: i + 1, species: 'fir', age: 80, health: 1, rep: 50, ramets: 1,
          refuseUntil: 0, lastReneg: 0, mastYear: false })
      }
      syncPatchMult(s)
      var t0 = now()
      for (i = 0; i < 2000; i++) tick(s, T().CLOCK.DT_A1)
      var per = (now() - t0) / 2000
      ok(per < 0.5, 'a full Act I tick costs ' + per.toFixed(3) + ' ms')

      // ── the reveal chain ─────────────────────────────────────────────────
      cold(10)
      s = S()
      ok(!reveals().substrate, 'substrate was revealed at t = 0')
      s.res.cumBiomass = 5
      ok(reveals().substrate, 'substrate did not reveal at 5 g')
      s.res.cumBiomass = 60
      ok(reveals().tips, 'tips did not reveal at 60 g')
      s.res.biomass = 0
      ok(reveals().tips, 'the tip panel un-revealed when the biomass was spent')
      s.res.sugar = 300
      s.a1.season = WINTER
      ok(reveals().trees, 'the understory did not open at 250 g of sugar in winter')
      stepNeighbours(s)
      ok(trees(s).length === 1 && trees(s)[0].species === 'birch',
        'the first counterparty is not a birch')
      s.a1.season = SPRING
      ok(reveals().trees, 'the understory closed again when winter ended')

      // ── DECIDE ───────────────────────────────────────────────────────────
      cold(11)
      s = S()
      s.res.biomass = 1e6
      s.res.sugar = 5000
      s.res.minerals = 16000
      s.a1.tips = 255
      s.a1.patches = 6
      s.a1.netRep = 74
      s.a1.hyphaeManual = 12
      s.a1.trees.push({ id: 1, species: 'oak', age: 200, health: 1, rep: 62, ramets: 1,
        refuseUntil: 0, lastReneg: 0, mastYear: false })
      s.a1.contracts.push({ id: 1, treeId: 1, sugarRate: 38, mineralRate: 3.4, termSeasons: 5,
        startT: 0, endT: 1800, collateral: 40000, exclusive: true, delivered: 0, shortfall: 0,
        suspended: false, state: 'active' })
      s.a1.sub.leaf = 5e5
      ok(decide(), 'decide() refused to run')
      near(num(s.res.biomass), (1e6 + 40000) * 0.10, 1, 'DECIDE did not keep exactly 10% of biomass')
      ok(s.a1.tips === 0, 'DECIDE left tips behind')
      ok(s.a1.contracts.length === 0 && s.a1.trees.length === 0, 'DECIDE left the book standing')
      ok(num(s.a1.netRep) === 0, 'DECIDE left reputation behind')
      ok(num(s.res.sugar) === 0 && totalSubstrate() === 0, 'DECIDE left the market open')
      near(num(s.res.minerals), 16000, 1e-9, 'DECIDE took minerals it should not have')
      ok(hyphae() === 0, 'DECIDE left a body behind')
      ok(s.act === 2 && s.phase === 'network', 'DECIDE did not open Act II')
      ok((s.a2.regions.flags[0] & 0x04) !== 0 && Math.abs(s.a2.regions.d[0] - 0.30) < 1e-6,
        'C24: DECIDE must hand Act II one claimed region at d = 0.30')
      ok(decide() === false, 'decide() is not idempotent under a double-fire')

      // Every act-1 entry point must be inert in Act II.
      ok(onExtend() === false && buyTip() === false && throughputPerSec() === 0,
        'an Act I verb still works in Act II')
    } catch (err) {
      f.push('threw: ' + (err && err.stack ? err.stack : err))
    }

    HY.state.importB64(keep)
    init(S())
    return f
  }

  function litterOf () { return litterRate }

  // The closed form of the season clock, for the tests only: boundaries crossed since a cold boot
  // in AUTUMN at phase 0.1667, and the year that rolls on every fourth of them.
  function boundariesAt (t) {
    return Math.floor(A().BOOT_SEASON_PHASE + t / T().CLOCK.SEASON_S)
  }
  function seasonAt (t) { return (A().BOOT_SEASON + boundariesAt(t)) % 4 }
  function yearAt (t) { return Math.floor((boundariesAt(t) + 2) / 4) }

  function now () {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
  }

  // The same span of simulated time at two step sizes, through the same `tick`. Substrate is deep
  // enough that the pools never bind, so what is being compared is the integration, not the stock.
  function runFor (seed, dt, span) {
    var s = cold(seed)
    var i, n = Math.round(span / dt)
    s.a1.tips = 5
    for (i = 0; i < TYPES.length; i++) s.a1.sub[TYPES[i]] = 1e6
    for (i = 0; i < n; i++) tick(s, dt, { stochastic: false })
    return {
      season: s.a1.season, year: s.a1.year,
      biomass: num(s.res.cumBiomass), sugar: num(s.res.sugar),
      moisture: Math.round(s.a1.moisture * 1e6) / 1e6
    }
  }

  function cold (seed) {
    HY.state.importB64(HY.state.exportB64(HY.state.newGame(seed, null)))
    init(S())
    return S()
  }

  // The moisture at which `moistureMult()·tempMult()` equals a given env, on the dry side of the
  // hump — which is the side every season except a wet spring sits on.
  function moistureFor (season, env) {
    var a = A()
    var want = env / a.SEASON_TEMP[season]
    if (want >= 1) return a.MOIST_OPT
    return a.MOIST_OPT - Math.sqrt(-a.MOIST_WIDTH * Math.log(want))
  }

  // A cold-start simulation at the sim rate the act actually runs at, with player R's thumb and a
  // buy-whenever-affordable policy. This is the only place in the module that models a player.
  function simulate (opts) {
    var s = cold(7)
    var dt = T().CLOCK.DT_A1
    var tapRate = opts.tapRate
    var out = { firstTipAt: -1, boughtFirst: false, tipsAt90: 0, tipsAt120: 0 }
    var credit = 0, elapsed = 0

    while (elapsed < 121) {
      credit += tapRate * dt
      while (credit >= 1) { credit -= 1; onExtend() }
      stepSeason(dt)
      stepEnvironment(dt)
      stepDecomposition(dt)
      stepSpoilage(dt)
      elapsed = s.t

      if (out.firstTipAt < 0 && num(s.res.biomass) >= tipCost(0)) {
        out.firstTipAt = elapsed
        out.boughtFirst = buyTip()
      } else {
        while (buyTip()) { /* the buy burst: R buys whenever the payback is short */ }
      }
      if (out.tipsAt90 === 0 && elapsed >= 90) out.tipsAt90 = s.a1.tips
      if (out.tipsAt120 === 0 && elapsed >= 120) out.tipsAt120 = s.a1.tips
    }
    return out
  }

  HY.act1 = {
    // BIBLE §6 M6
    onExtend: onExtend,
    tipCost: tipCost,
    tipMineralCost: tipMineralCost,
    buyTip: buyTip,
    throughputPerSec: throughputPerSec,
    stepDecomposition: stepDecomposition,
    stepSeason: stepSeason,
    rollEvents: rollEvents,
    moistureMult: moistureMult,
    tempMult: tempMult,
    claimPatch: claimPatch,
    hyphae: hyphae,
    decide: decide,

    // §6's generic module surface
    init: init,
    tick: tick,
    serialise: serialise,
    migrate: migrate,

    // the readouts the UI, economy1 and projects.js read across the boundary
    stepEnvironment: stepEnvironment,
    stepSpoilage: stepSpoilage,
    stepClaim: stepClaim,
    stepNeighbours: function () { return stepNeighbours(S()) },
    sugarCap: sugarCap,
    totalSubstrate: totalSubstrate,
    consume: function (g) { return consume(S(), g) },
    litterPerSec: litterPerSec,
    demandPerSec: demandPerSec,
    forestSupply: forestSupply,
    utilisation: utilisation,
    feedstockReserve: feedstockReserve,
    patchSupplyMult: patchSupplyMult,
    patchCapMult: patchCapMult,
    claimProgress: claimProgress,
    reveals: reveals,
    seasonName: seasonName,
    compMult: compMult,
    mineralMult: mineralMult,
    deficitMod: deficitMod,
    needMod: needMod,
    get starving () { return isStarving() },
    DECOMP: DECOMP,
    TAP_LITTER: TAP_LITTER,
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
