;(function (HY) {
  'use strict'

  // M10 · flush.js — the Act II weather process and the risk sub-game (BIBLE §6 M10).
  //
  // Owns: `a2.W`, `a2.Wmom`, `a2.windSpeed`, `a2.windDir`, `a2.mastAt`, `a2.mastUntil` and the
  // whole of `a2.flush`. Owns the spore stock's decay in both acts. Nothing else in the build may
  // write those keys; `05` §0.1 is binding — the Pact Book does not own the weather, it observes
  // it. One process, two consumers.
  //
  // Does NOT own: the map (world.js), litter/standing/humus/canopy/fire (forest.js), Signal
  // (cognition.js), PULSE (cognition.js delivers BLOOM here through onPulse). All read lazily and
  // feature-detected, so this file runs alone in a harness and runs in the build.
  //
  // The sub-game's whole shape is one inequality: **exposure grows as m² while yield grows as
  // m^1.6**. Because those two exponents differ there is always an interior optimum m*, and
  // because the hazard's environment term is a function of the weather, m* moves every couple of
  // minutes and can be forecast but not known. That is the entire design: one bet, on a 60–400 s
  // horizon, whose only verb is TIME IT.
  //
  // The forecast is not a simulation of a forecast. `stepWeather` integrates the OU walk with its
  // exact transition kernel, and `forecast(tau)` is that same kernel evaluated forward — so the
  // band the player reads is the process's true conditional law, at any dt, sim rate or step size.
  //
  // Numbers that cross a module boundary live in HY.core.TUNE.A2. What lives below is this
  // module's own table: the wind and graze cycles, the morph roll, the yield and overripe shape,
  // the slot ladder and the strip's geometry. Nothing else reads it and it moves as a unit.

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
  function feel (ev, params) { if (HY.feel && HY.feel.feel) HY.feel.feel(ev, params) }

  // §3 a2.regions.flags. world.js writes bits 0–3 and forest.js 4–6; this file only reads them.
  var RF_CLAIMED = 4
  var RF_NECROTIZED = 16

  // ───────────────────────────────────────────────────────────────────────────
  // DATA TABLE — `02` §7, `04`'s Act II flush entries
  // ───────────────────────────────────────────────────────────────────────────

  // The morph, `02` §7.1. One σ, three independent draws, three different clamps: robustness is
  // symmetric about 1, fecundity is skewed long, hygroscopy is skewed short. The bounds are what
  // make a garbage morph a cheap fast flush and a 1.7-fecundity morph worth babysitting.
  var MORPH_SIGMA = 0.34
  var MORPH = {
    rob: { lo: 0.55, hi: 1.65 },
    fec: { lo: 0.60, hi: 1.80 },
    hyg: { lo: 0.60, hi: 1.45 }
  }

  // Slots, `02` §7.1: 1 → 4 → 6 → 9. Richest owned flag wins, so the ladder is order-independent.
  var SLOT_LADDER = [
    { flag: 'ballistospory', n: 9 },
    { flag: 'mast_synchrony', n: 6 },
    { flag: 'sporulation_reflex', n: 4 }
  ]
  var SLOTS_BASE = 1

  // Wind, `02` §7.2 — a second, slower OU pair, plus a prevailing rotation that is deterministic
  // so that "the wind has been going that way for ten minutes" is a real, learnable fact.
  var WIND = { theta: 0.004, sigma: 0.011, mean: 0.45, min: 0.02, max: 1.00 }
  var WDIR_SIGMA = 0.0018        // rad/√s
  var WDIR_DRIFT = 0.00035       // rad/s, the prevailing rotation

  // Per-region moisture, `02` §7.2. The swing is a phase-offset copy of the seasonal term, so two
  // stands three rings apart are dry in different weeks and the map has a texture in time.
  var MOIST_SWING = 0.10

  // Graze pressure, `02` §7.6. Peaks at 0.55 for ~200 s in every 900: seasons of caution, on a
  // longer and more legible cycle than the weather itself.
  var GRAZE = { amp: 0.55, period: 900, phase: 1.1, exp: 1.6 }

  // The hazard environment, `02` §7.5. Both are one-sided: a stand at m = 0.5 is in no danger at
  // all, which is what makes the two dotted lines on the strip the only numbers that matter.
  var HAZ_M_MIN = 0.15           // maturity below which a primordium is not yet exposed
  var DESIC_T = 0.28, DESIC_K = 3.20
  var WET_T = 0.86, WET_K = 2.60

  // Maturation, `02` §7.4. The moisture term is `02` §9.1's hump — the same curve forest.js
  // decomposes through, restated here rather than reached for, because a hump that disagreed
  // between the two files would make the flush profitable exactly where decomposition was not.
  var HUMP_A = 0.10, HUMP_B = 3.60
  var MAT_CANOPY_A = 0.55, MAT_CANOPY_B = 0.45
  var MAT_DENS_A = 0.70, MAT_DENS_B = 0.30
  var CANOPY_FALLBACK = 0.80     // harness only: the value a mid-canopy stand carries

  // Release, `02` §7.7. V is sublinear so two small bets beat one large one on yield alone, and
  // m is superlinear so patience is the only thing that ever beats spreading.
  var V_EXP = 0.78
  var OVERRIPE_M = 1.25, OVERRIPE_K = 0.55, OVERRIPE_E = 1.40, OVERRIPE_FLOOR = 0.15
  // Maturity ceiling. Not an arbitrary clamp: 1 − 0.55·(m − 1.25)^1.40 reaches the 0.15 floor at
  // m = 2.61, and past that point waiting changes nothing at all, so nothing matures past it.
  var M_CAP = 2.60
  var DISPERSE_A = 0.45, DISPERSE_B = 0.85
  var YIELD_CANOPY_A = 0.70, YIELD_CANOPY_B = 0.30
  var FIRST_FLUSH = 3.00         // × on the first release of the act, then 1.00 forever

  // The forecast band, `02` §7.3. Index is the horizon tier; k is the multiple of one standard
  // deviation drawn. Buying a longer horizon also buys a *narrower* band — that is the "buying the
  // house edge" purchase, and it buys information rather than outcome.
  var BAND_K = [0, 1.15, 0.95, 0.75]

  // Automation, `02` §7.11 / §11.4. AUTO_M is a fixed maturity that ignores the weather entirely.
  // A reflex fires early — that is what makes it a reflex — and 0.70 is the maturity at which the
  // resulting expected value comes out at TUNE.A2.AUTO_RELEASE (0.55) of a skilled release in the
  // ideal weather the published table is quoted for. The ratio is EMERGENT from the policy and is
  // never applied as a multiplier anywhere; the self-test measures it rather than assuming it.
  // Per unit of time reflex play is much closer (0.70×) because it also cycles faster, which is
  // why the project is still worth buying and still worth overriding.
  var AUTO_M = 0.70

  // Mast Years, `02` §7.10. The yield multiple is TUNE (MAST_MULT); these two are the cost of it.
  var MAST_HAZ = 1.5
  var MAST_MAT = 2.5

  // The UNDERGROUND mode (`04` `hypogeous_fruiting`): hazard 0, dispersal 0, no spores and no
  // territory, returning biomass at 6.2× committed V at m = 1.0. A safe, boring bond for bad
  // weather — and the one flush whose optimum is a property of the overripe curve alone.
  var MODE_EPIGEOUS = 0
  var MODE_HYPOGEOUS = 1
  var HYPO_K = 6.2

  // Drought detection. The threshold is the desiccation threshold, because a drought the hazard
  // does not notice is not a drought. `hypogeous_fruiting` is gated on surviving one.
  var DROUGHT_MIN_S = 45
  var DROUGHT_EXIT = 0.34

  // BLOOM (`02` §11.2), delivered by cognition.js. The immunity window is carried on the event.
  var BLOOM_M = 0.18
  var BLOOM_IMMUNE_S = 20

  // The trend arrow's smoothing. `a2.Wmom` is the only weather quantity that cannot be recomputed
  // from a single frame, which is why §3 stores it.
  var TREND_TAU = 20

  // The strip, `06` §7.7: 120 samples, 300 s of history. The window is history + horizon on ONE
  // uniform time axis, so slope means the same thing on both sides of the divider — and the
  // bought horizon visibly takes the strip over as it grows, which is the progression made
  // literal. The ring is sampled finer than the strip needs and downsampled on read.
  var STRIP_N = 120
  var HIST_S = 300
  var HIST_STEP = 2.5

  // Search resolution for the forecast-implied optimum. 48 steps across a 600 s horizon is 12.5 s
  // of quantisation on a marker the player is reading off a 390 px strip.
  var SEARCH_N = 48
  var SEARCH_MIN_S = 240

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE STATE
  // ───────────────────────────────────────────────────────────────────────────

  // Two independent streams, seeded from the save's seed the way economy1's price walk is: the
  // weather must not shift because a hazard happened to be rolled this tick.
  var wwalk = null           // weather and wind innovations
  var hwalk = null           // hazard rolls and the mast jitter
  var seeded = -1

  var hist = null            // Float32Array ring of W, HIST_STEP apart
  var histN = 0, histW = 0, histAt = 0

  var wAcc = 0               // s of accumulated weather time, drained at MARKET_HZ
  var nextId = 1
  var droughtSince = -1      // sim time the current dry spell began, −1 when not dry
  var bloomUntil = -1        // sim time BLOOM's hazard immunity expires
  var mastWarned = 0         // the mastAt a warning has already been given for
  var lastAct = 0

  function walkW () {
    var s = S()
    if (!wwalk || seeded !== s.seed) reseed(s)
    return wwalk
  }
  function walkH () {
    var s = S()
    if (!hwalk || seeded !== s.seed) reseed(s)
    return hwalk
  }
  function reseed (s) {
    seeded = s.seed
    wwalk = C().rng(C().hash32('weather', s.seed))
    hwalk = C().rng(C().hash32('hazard', s.seed))
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE WEATHER PROCESS — BIBLE §4 step 2
  // ───────────────────────────────────────────────────────────────────────────

  // The deterministic half of the mean. It is deterministic on purpose: a process with no trend,
  // no momentum and no memory has no skill in it (`00` §8.12), and this is the memory.
  function season (t) {
    var a = A()
    return a.W_SEASON_AMP * Math.sin(2 * Math.PI * t / T().CLOCK.WEATHER_PERIOD)
  }

  function meanAt (t) { return A().OU_MEAN + season(t) }

  // The exact transition kernel of the OU process, not an Euler step. Two consequences, both
  // load-bearing: the walk has the same law whether it is integrated at 20 Hz, at 1 Hz or in one
  // 120-second offline macro-step, and `forecast()` below is literally this function's mean and
  // standard deviation read forward instead of applied.
  function ouStep (w, t0, dt, stochastic) {
    var a = A()
    var decay = Math.exp(-a.OU_THETA * dt)
    var mu0 = meanAt(t0)
    var mu1 = meanAt(t0 + dt)
    var next = mu1 + (w - mu0) * decay
    if (stochastic) {
      var sd = a.OU_SIGMA * Math.sqrt((1 - decay * decay) / (2 * a.OU_THETA))
      next += sd * walkW().gauss()
    }
    return C().clamp(next, a.W_MIN, a.W_MAX)
  }

  function ouStepScalar (v, mean, theta, sigma, dt, lo, hi, stochastic) {
    var decay = Math.exp(-theta * dt)
    var next = mean + (v - mean) * decay
    if (stochastic) {
      var sd = sigma * Math.sqrt((1 - decay * decay) / (2 * theta))
      next += sd * walkW().gauss()
    }
    return C().clamp(next, lo, hi)
  }

  // BIBLE §4 step 2. Offline, `gauss()` is never drawn at all — not scaled, not suppressed after
  // the fact — so the weather relaxes to `W̄ + season(t)` and is *boring* while you are away,
  // which is exactly right for a sub-game that is a thing you do with your hands (D32).
  function stepWeather (dt, opts) {
    var s = S()
    if (!s || s.act !== 2 || !(dt > 0)) return
    var o = opts || { stochastic: true, offline: false }
    var stoch = o.stochastic !== false

    // The walk is a 1 Hz process (TUNE.CLOCK.MARKET_HZ). Accumulating rather than stepping at the
    // sim rate keeps the number of innovations independent of the sim period, which is what makes
    // the act break's 10 Hz → 20 Hz swap invisible in the weather.
    var period = 1 / T().CLOCK.MARKET_HZ
    wAcc += dt
    if (wAcc < period && stoch) return
    var step = wAcc
    wAcc = 0

    var t0 = num(s.t) - step
    var before = num(s.a2.W)
    var after = ouStep(before, t0, step, stoch)
    s.a2.W = after
    s.a2.windSpeed = ouStepScalar(num(s.a2.windSpeed), WIND.mean, WIND.theta, WIND.sigma,
      step, WIND.min, WIND.max, stoch)

    var dir = num(s.a2.windDir) + WDIR_DRIFT * step
    if (stoch) dir += WDIR_SIGMA * Math.sqrt(step) * walkW().gauss()
    s.a2.windDir = wrapAngle(dir)

    // The trend arrow. An EMA over TREND_TAU rather than the raw difference, because a 1 Hz
    // difference on a σ = 0.028 innovation is noise and would flicker the arrow every second.
    var k = 1 - Math.exp(-step / TREND_TAU)
    s.a2.Wmom = num(s.a2.Wmom) + ((after - before) / step - num(s.a2.Wmom)) * k

    sample(s, after)
    stepDrought(s, after)
  }

  function wrapAngle (a) {
    var TAU = Math.PI * 2
    a = a % TAU
    return a < 0 ? a + TAU : a
  }

  // A drought is the weather crossing the desiccation threshold and staying there long enough to
  // have cost something. Surviving one is what arms Hypogeous Fruiting — the project that lets you
  // stop taking the bet, offered only to a player who has already lost it once.
  function stepDrought (s, w) {
    if (w < DESIC_T) {
      if (droughtSince < 0) droughtSince = num(s.t)
      return
    }
    if (droughtSince < 0 || w < DROUGHT_EXIT) return
    if (num(s.t) - droughtSince >= DROUGHT_MIN_S) stat(s, 'droughtsSurvived', 1)
    droughtSince = -1
  }

  function W () {
    var s = S()
    return s && s.a2 ? C().clamp(num(s.a2.W), A().W_MIN, A().W_MAX) : A().OU_MEAN
  }

  function wind () {
    var s = S()
    if (!s || !s.a2) return { speed: WIND.mean, dir: 0 }
    return { speed: C().clamp(num(s.a2.windSpeed), WIND.min, WIND.max), dir: wrapAngle(num(s.a2.windDir)) }
  }

  function grazePressure (t) {
    var s = S()
    var at = t === undefined ? (s ? num(s.t) : 0) : num(t)
    var x = Math.sin(2 * Math.PI * at / GRAZE.period + GRAZE.phase)
    return x <= 0 ? 0 : GRAZE.amp * Math.pow(x, GRAZE.exp)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PER-REGION MOISTURE — 61 independent walks would be unreadable, so there is one
  // ───────────────────────────────────────────────────────────────────────────

  function terrainOf (s, i) {
    var tab = HY.forest && HY.forest.TERRAIN
    if (tab && tab.length) return tab[s.a2.regions.terrain[i] % tab.length]
    return { moistOff: 0, damp: 1 }
  }

  // A stable per-region phase, so the same seed gives the same map the same weather forever.
  function mPhase (s, i) {
    return (C().hash32('mphase', s.seed, i) / 4294967296) * Math.PI * 2
  }

  function moistureFrom (s, i, w, t) {
    var a = A()
    var ter = terrainOf(s, i)
    // Clay halves the region's deviation from the mean — a physical fact about clay soils and a
    // mechanically real safe harbour, which is why it is applied to the deviation and not the level.
    var damped = a.OU_MEAN + (w - a.OU_MEAN) * num(ter.damp || 1)
    var raw = damped + num(ter.moistOff) +
      MOIST_SWING * Math.sin(2 * Math.PI * t / T().CLOCK.WEATHER_PERIOD + mPhase(s, i))
    return C().clamp(raw, a.W_MIN, a.W_MAX)
  }

  function moistureAt (regionId) {
    var s = S()
    if (!s || !s.a2 || !s.a2.regions) return A().OU_MEAN
    var i = Math.floor(regionId)
    if (!(i >= 0 && i < s.a2.regions.terrain.length)) return W()
    return moistureFrom(s, i, W(), num(s.t))
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE FORECAST — the honest OU conditional, and the thing the player actually buys
  // ───────────────────────────────────────────────────────────────────────────

  function horizonTier (s) {
    if (flagOn(s, 'ballistospory')) return 3
    if (flagOn(s, 'mast_synchrony')) return 2
    if (flagOn(s, 'barometric_sense')) return 1
    return 0
  }

  // An ALARM contract pays in information rather than minerals: +90 s of horizon, in that region
  // only. pactbook.js owns the term; this reads it and works without it.
  function alarmAt (i) {
    var p = HY.pactbook
    if (!p || !(i >= 0)) return false
    if (p.alarmRegion) return !!p.alarmRegion(i)
    if (p.hasAlarm) return !!p.hasAlarm(i)
    return false
  }

  function forecastHorizon (regionId) {
    var s = S()
    if (!s) return 0
    var tier = horizonTier(s)
    var h = A().FORECAST_H[tier] || 0
    if (h > 0 && flagOn(s, 'alarm_contracts') && regionId !== undefined && alarmAt(Math.floor(regionId))) {
      h += A().FORECAST_ALARM_BONUS
    }
    return h
  }

  function bandK (s) { return BAND_K[horizonTier(s)] || BAND_K[1] }

  // E[W(t+τ)] and SD[W(t+τ)] — the closed form of `02` §7.3, which is the same kernel `ouStep`
  // integrates with. With a regionId the affine per-region transform is applied to both, so the
  // band is drawn in the space the two danger lines live in and can simply be looked at.
  function forecast (tau, regionId) {
    var s = S()
    var a = A()
    if (!s || !s.a2) return { t: 0, mean: a.OU_MEAN, sd: 0, lo: a.OU_MEAN, hi: a.OU_MEAN, k: 0 }
    var t = num(s.t)
    var x = Math.max(0, num(tau))
    var decay = Math.exp(-a.OU_THETA * x)
    var mean = meanAt(t + x) + (W() - meanAt(t)) * decay
    var sd = a.OU_SIGMA * Math.sqrt((1 - decay * decay) / (2 * a.OU_THETA))
    var k = bandK(s)
    var i = regionId === undefined ? -1 : Math.floor(regionId)
    if (i >= 0 && s.a2.regions && i < s.a2.regions.terrain.length) {
      var damp = num(terrainOf(s, i).damp || 1)
      sd *= damp
      mean = moistureFrom(s, i, mean, t + x)
    } else {
      mean = C().clamp(mean, a.W_MIN, a.W_MAX)
    }
    return {
      t: t + x,
      mean: mean,
      sd: sd,
      k: k,
      lo: C().clamp(mean - k * sd, a.W_MIN, a.W_MAX),
      hi: C().clamp(mean + k * sd, a.W_MIN, a.W_MAX)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE STRIP — one uniform time axis, past and future, 44 px tall
  // ───────────────────────────────────────────────────────────────────────────

  function sample (s, w) {
    if (!hist) hist = new Float32Array(Math.ceil(HIST_S / HIST_STEP))
    var t = num(s.t)
    if (histN > 0 && t - histAt < HIST_STEP) return
    hist[histW] = w
    histW = (histW + 1) % hist.length
    if (histN < hist.length) histN++
    histAt = t
  }

  // The ring, oldest first, in seconds-ago order. A cold load has no history at all, so the strip
  // opens flat at the current value and fills in over five minutes rather than lying about a past.
  function histAgo (ago) {
    if (!hist || histN === 0) return W()
    var idx = Math.round(ago / HIST_STEP)
    if (idx >= histN) idx = histN - 1
    if (idx < 0) idx = 0
    var at = (histW - 1 - idx + hist.length * 2) % hist.length
    return hist[at]
  }

  // Everything canvas.drawForecast needs plus the three things `02` §7.3 asks for that a plain
  // series cannot carry: the uncertainty envelope, the two danger thresholds, and one ▲ per
  // primordium at its forecast-implied release moment.
  function strip (regionId) {
    var s = S()
    var a = A()
    if (!s || !s.a2) return null
    var i = regionId
    if (i === undefined) {
      var live = s.a2.flush && s.a2.flush.length ? s.a2.flush[0] : null
      i = live ? live.regionId : -1
    }
    if (!(i >= 0)) i = -1

    var t = num(s.t)
    var hzn = forecastHorizon(i >= 0 ? i : undefined)
    var span = HIST_S + hzn
    var step = span / (STRIP_N - 1)
    var nh = Math.max(2, Math.round(HIST_S / step) + 1)
    var out = {
      hist: [], fore: [], lo: [], hi: [], graze: [],
      releases: [], markers: [],
      danger: [DESIC_T, WET_T],
      horizon: hzn,
      step: step,
      divider: nh - 1,
      region: i,
      k: hzn > 0 ? bandK(s) : 0
    }

    var j, ago, w
    for (j = 0; j < nh; j++) {
      ago = (nh - 1 - j) * step
      w = histAgo(ago)
      out.hist.push(i >= 0 ? moistureFrom(s, i, w, t - ago) : C().clamp(w, a.W_MIN, a.W_MAX))
      out.graze.push(grazePressure(t - ago))
    }
    for (j = 1; j <= STRIP_N - nh; j++) {
      var f = forecast(j * step, i >= 0 ? i : undefined)
      out.fore.push(f.mean)
      out.lo.push(f.lo)
      out.hi.push(f.hi)
      out.graze.push(grazePressure(t + j * step))
    }

    // The ▲ markers. Only drawn once a forecast has been bought, because before that the game has
    // no honest estimate to offer and inventing one would be the tutorial this game does not have.
    if (hzn > 0 && s.a2.flush) {
      for (j = 0; j < s.a2.flush.length; j++) {
        var mk = marker(s.a2.flush[j])
        if (!mk) continue
        var at = out.divider + mk.tau / step
        if (at > STRIP_N - 1) at = STRIP_N - 1
        out.releases.push(at)
        out.markers.push({ id: s.a2.flush[j].id, at: at, tau: mk.tau, m: mk.m })
      }
    }
    return out
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIMORDIA
  // ───────────────────────────────────────────────────────────────────────────

  function slots () {
    var s = S()
    if (!s) return 0
    if (!flagOn(s, 'primordium')) return 0
    for (var j = 0; j < SLOT_LADDER.length; j++) {
      if (flagOn(s, SLOT_LADDER[j].flag)) return SLOT_LADDER[j].n
    }
    return SLOTS_BASE
  }

  function used () {
    var s = S()
    return s && s.a2 && s.a2.flush ? s.a2.flush.length : 0
  }

  function trait (r, lim) {
    return C().clamp(1 + MORPH_SIGMA * r.gauss(), lim.lo, lim.hi)
  }

  // The morph is rolled and SHOWN before a gram is committed (BIBLE §6 M10), so it must be a pure
  // function of state rather than a draw held in a variable: a player who reloads to reroll a
  // morph gets the same morph, and the UI can show it without having decided anything.
  function morphFor (regionId) {
    var s = S()
    var r = C().rng(C().hash32('morph', s.seed, Math.floor(regionId), num(s.stats.flushes), used()))
    return { rob: trait(r, MORPH.rob), fec: trait(r, MORPH.fec), hyg: trait(r, MORPH.hyg) }
  }

  function pending (regionId) {
    var s = S()
    if (!s || !canFruit(s, Math.floor(regionId))) return null
    var m = morphFor(regionId)
    m.regionId = Math.floor(regionId)
    m.free = slots() - used()
    return m
  }

  function canFruit (s, i) {
    if (s.act !== 2 || !s.a2 || !s.a2.regions) return false
    if (!(i >= 0 && i < s.a2.regions.flags.length)) return false
    if (!(s.a2.regions.flags[i] & RF_CLAIMED)) return false
    // A killed stand has no living tissue to knot: necrotrophy costs fruiting, and that is the
    // price the KILL STAND decision is actually paying.
    if (s.a2.regions.flags[i] & RF_NECROTIZED) return false
    return true
  }

  function newPrimordium (regionId, V) {
    var s = S()
    var i = Math.floor(regionId)
    if (!s || !flagOn(s, 'primordium') || !canFruit(s, i)) return null
    if (used() >= slots()) return null
    var v = num(V)
    if (!(v > 0) || num(s.res.biomass) < v) return null

    var m = morphFor(i)
    var p = {
      id: nextId++,
      regionId: i,
      V: v,
      m: 0,
      rob: m.rob,
      fec: m.fec,
      hyg: m.hyg,
      bornAt: num(s.t),
      mode: MODE_EPIGEOUS
    }
    C().setStock(s.res, 'biomass', num(s.res.biomass) - v)
    s.a2.flush.push(p)
    return p
  }

  function find (id) {
    var s = S()
    if (!s || !s.a2 || !s.a2.flush) return null
    for (var j = 0; j < s.a2.flush.length; j++) if (s.a2.flush[j].id === id) return s.a2.flush[j]
    return null
  }

  // The UNDERGROUND mode is a per-primordium choice made before it is exposed. Switching a knot
  // that is already at risk would let the player retreat out of a bet they had already lost.
  function setMode (id, mode) {
    var s = S()
    var p = find(id)
    if (!p || !s || !flagOn(s, 'hypogeous_fruiting')) return false
    if (p.m > HAZ_M_MIN) return false
    p.mode = mode === MODE_HYPOGEOUS ? MODE_HYPOGEOUS : MODE_EPIGEOUS
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MATURITY, HAZARD, YIELD — the three curves the whole sub-game is made of
  // ───────────────────────────────────────────────────────────────────────────

  function moistureF (m) { return HUMP_A + HUMP_B * m * (1 - m) }

  function canopyAt (i) {
    if (HY.forest && HY.forest.canopy) {
      var c = num(HY.forest.canopy(i))
      if (c >= 0) return C().clamp(c, 0, 1)
    }
    return CANOPY_FALLBACK
  }

  function densityAt (s, i) {
    return C().clamp(num(s.a2.regions.d[i]), 0, 1)
  }

  function mastOpen (s) {
    var t = num(s.t)
    return num(s.a2.mastUntil) > 0 && t >= num(s.a2.mastAt) && t < num(s.a2.mastUntil)
  }

  function matSpeed (s) {
    return mult(s, 'matSpeed', 1) * (mastOpen(s) ? MAST_MAT : 1)
  }

  function hazMult (s) {
    return mult(s, 'hazMult', 1) * (mastOpen(s) ? MAST_HAZ : 1)
  }

  function sporeMult (s) {
    return mult(s, 'sporeMult', 1) * (mastOpen(s) ? A().MAST_MULT : 1)
  }

  // `02` §7.4, at an arbitrary region moisture so the same function serves both the live tick and
  // the forward integration the marker is built from.
  function matRateAt (s, p, mReg) {
    return (1 / A().MAT_TIME) * moistureF(mReg) *
      (MAT_CANOPY_A + MAT_CANOPY_B * canopyAt(p.regionId)) *
      (MAT_DENS_A + MAT_DENS_B * densityAt(s, p.regionId)) *
      matSpeed(s)
  }

  function matRate (p) {
    var s = S()
    return matRateAt(s, p, moistureAt(p.regionId))
  }

  function hazardEnv (mReg, t) {
    return 1 +
      DESIC_K * Math.max(0, DESIC_T - mReg) +
      WET_K * Math.max(0, mReg - WET_T) +
      grazePressure(t)
  }

  // `02` §7.5. The m² is the crux: exposure grows as the square of maturity while yield grows as
  // m^1.6, so there is always a moment past which waiting is negative EV — and that moment is a
  // function of the weather, which is why the forecast is worth money.
  function hazardRate (s, p, mReg, t) {
    if (p.mode === MODE_HYPOGEOUS) return 0
    if (p.m <= HAZ_M_MIN) return 0
    if (bloomUntil > num(s.t)) return 0
    return A().HAZ_BASE * Math.pow(p.m, A().EXPOSURE_EXP) *
      hazardEnv(mReg, t) * p.hyg / p.rob * hazMult(s)
  }

  function overripe (m) {
    if (m <= OVERRIPE_M) return 1
    return Math.max(OVERRIPE_FLOOR, 1 - OVERRIPE_K * Math.pow(m - OVERRIPE_M, OVERRIPE_E))
  }

  function overripeSlope (m) {
    if (m <= OVERRIPE_M) return 0
    var raw = 1 - OVERRIPE_K * Math.pow(m - OVERRIPE_M, OVERRIPE_E)
    if (raw <= OVERRIPE_FLOOR) return 0
    return -OVERRIPE_K * OVERRIPE_E * Math.pow(m - OVERRIPE_M, OVERRIPE_E - 1)
  }

  function dispersalF (ws) { return DISPERSE_A + DISPERSE_B * ws }

  // `02` §7.7. Both branches share the maturity shape, which is what makes UNDERGROUND a genuine
  // alternative rather than a different game: the verb is still TIME IT, only the risk is gone.
  function yieldAt (s, p, m) {
    var shape = Math.pow(m, A().YIELD_EXP) * overripe(m)
    if (p.mode === MODE_HYPOGEOUS) return HYPO_K * p.V * shape
    var first = num(s.stats.flushes) === 0 ? FIRST_FLUSH : 1
    return A().SPORE_K * Math.pow(p.V, V_EXP) * shape *
      dispersalF(wind().speed) * p.fec *
      (YIELD_CANOPY_A + YIELD_CANOPY_B * canopyAt(p.regionId)) *
      sporeMult(s) * first
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE OPTIMUM — never shown; the marker is an estimate of it that can be wrong
  // ───────────────────────────────────────────────────────────────────────────

  // d/dm log EV = 0. Yield's log-derivative is 1.60/m plus the overripe term; the hazard's is the
  // instantaneous loss rate divided by the maturation rate, i.e. risk per unit of maturity. The
  // function is monotone decreasing in m, so a bisection is exact rather than a search.
  function evSlope (s, p, m, mReg, t) {
    var probe = { m: m, mode: p.mode, hyg: p.hyg, rob: p.rob, regionId: p.regionId, V: p.V }
    var mdot = matRateAt(s, probe, mReg)
    if (!(mdot > 0)) return -1
    var yieldTerm = A().YIELD_EXP / m + overripeSlope(m) / overripe(m)
    return yieldTerm - hazardRate(s, probe, mReg, t) / mdot
  }

  // The true optimum at the *current* weather. The UI never shows this (BIBLE §6 M10); it exists
  // so the automation can be measured against skilled play and so the self-test can check that the
  // interior optimum exists and moves with the hazard the way `02` §7.7's table says it does.
  function optimum (p, mReg, t) {
    var s = S()
    var m0 = mReg === undefined ? moistureAt(p.regionId) : mReg
    var at = t === undefined ? num(s.t) : t
    var lo = HAZ_M_MIN, hi = M_CAP
    if (evSlope(s, p, hi, m0, at) > 0) return hi
    if (evSlope(s, p, lo, m0, at) < 0) return lo
    for (var j = 0; j < 24; j++) {
      var mid = (lo + hi) / 2
      if (evSlope(s, p, mid, m0, at) > 0) lo = mid; else hi = mid
    }
    return (lo + hi) / 2
  }

  // The forecast-implied optimum: integrate maturity forward through the forecast MEAN and stop
  // where the expected-value slope turns over. It uses the centre line and nothing else, which is
  // precisely why a player who reads the band and overrides it beats the marker — the mean is not
  // where the risk lives, the tail is.
  function marker (p) {
    var s = S()
    if (!s) return null
    var hzn = forecastHorizon(p.regionId)
    if (!(hzn > 0)) return null
    var span = Math.max(hzn, SEARCH_MIN_S)
    var dt = span / SEARCH_N
    var m = p.m
    var t = num(s.t)
    var probe = { m: m, mode: p.mode, hyg: p.hyg, rob: p.rob, regionId: p.regionId, V: p.V }
    for (var j = 0; j <= SEARCH_N; j++) {
      var tau = j * dt
      var mReg = forecast(tau, p.regionId).mean
      probe.m = m
      if (evSlope(s, probe, Math.max(m, HAZ_M_MIN), mReg, t + tau) <= 0) {
        return { tau: Math.min(tau, hzn), m: m }
      }
      if (m >= M_CAP) return { tau: Math.min(tau, hzn), m: M_CAP }
      m = Math.min(M_CAP, m + matRateAt(s, probe, mReg) * dt)
    }
    return { tau: hzn, m: m }
  }

  // What the card shows: what you get now, what you would get if you waited for the marker, and
  // the probability of still having it then. Three numbers, one decision, no tutorial.
  function estimate (id) {
    var s = S()
    var p = typeof id === 'object' ? id : find(id)
    if (!s || !p) return null
    var now = yieldAt(s, p, Math.max(p.m, 1e-6))
    var mk = marker(p)
    if (!mk) return { now: now, best: now, bestIn: 0, survive: 1, m: p.m }

    var dt = Math.max(mk.tau, 1e-6) / SEARCH_N
    var m = p.m, surv = 1, t = num(s.t)
    var probe = { m: m, mode: p.mode, hyg: p.hyg, rob: p.rob, regionId: p.regionId, V: p.V }
    for (var j = 0; j < SEARCH_N; j++) {
      var tau = j * dt
      var mReg = forecast(tau, p.regionId).mean
      probe.m = m
      surv *= Math.exp(-hazardRate(s, probe, mReg, t + tau) * dt)
      m = Math.min(M_CAP, m + matRateAt(s, probe, mReg) * dt)
    }
    return { now: now, best: yieldAt(s, p, Math.max(m, 1e-6)), bestIn: mk.tau, survive: surv, m: m }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BIBLE §4 STEP 11 — maturity, hazards, the mast window, fire
  // ───────────────────────────────────────────────────────────────────────────

  function stepMaturity (dt, opts) {
    var s = S()
    if (!s || s.act !== 2 || !(dt > 0) || !s.a2.flush.length) return
    void opts
    var list = s.a2.flush
    for (var j = 0; j < list.length; j++) {
      var p = list[j]
      p.m = Math.min(M_CAP, num(p.m) + matRateAt(s, p, moistureAt(p.regionId)) * dt)
    }
  }

  function stepHazards (dt, stochastic, opts) {
    var s = S()
    if (!s || s.act !== 2 || !(dt > 0) || !s.a2.flush.length) return
    var o = opts || {}
    var stoch = stochastic !== false
    var t = num(s.t)
    var list = s.a2.flush
    var keep = []
    for (var j = 0; j < list.length; j++) {
      var p = list[j]
      var rate = hazardRate(s, p, moistureAt(p.regionId), t)
      if (!(rate > 0)) { keep.push(p); continue }
      if (stoch) {
        // 1 − e^(−rate·dt) rather than rate·dt: a catch-up tick may carry two seconds, and a raw
        // product would silently exceed 1 and destroy everything at once.
        if (walkH().next() < 1 - Math.exp(-rate * dt)) { destroy(s, p); continue }
        keep.push(p)
      } else {
        // Offline and catch-up: expected value, exactly `02` §14.2. A flush left out in a drought
        // comes back diminished, never zero — the forest does not take things while you are away.
        var loss = C().clamp(rate * dt, 0, 1) * (1 - A().HAZ_ROBUST * p.rob)
        p.V = Math.max(0, num(p.V) * (1 - loss))
        keep.push(p)
      }
    }
    if (keep.length !== list.length) s.a2.flush = keep
    void o
  }

  function destroy (s, p) {
    // A robust morph salvages up to 58% of the bet (0.35 × 1.65): the morph bars you were shown
    // before committing were the odds, and they were true.
    var back = A().HAZ_ROBUST * p.rob * num(p.V)
    if (back > 0) C().setStock(s.res, 'biomass', num(s.res.biomass) + back)
    feel('fail.event')
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RELEASE
  // ───────────────────────────────────────────────────────────────────────────

  function release (id) {
    var s = S()
    var p = typeof id === 'object' ? id : find(id)
    if (!s || !p || s.act !== 2) return 0
    var gain = yieldAt(s, p, Math.max(num(p.m), 1e-6))
    if (p.mode === MODE_HYPOGEOUS) {
      C().setStock(s.res, 'biomass', num(s.res.biomass) + gain)
    } else {
      C().setStock(s.res, 'spores', num(s.res.spores) + gain)
    }
    var list = s.a2.flush
    for (var j = 0; j < list.length; j++) if (list[j] === p) { list.splice(j, 1); break }
    stat(s, 'flushes', 1)
    // The one ascending gesture in the game, scaled by how well it went: the sound is the score.
    feel('flush.release', { yieldScale: C().clamp(num(p.m), 0.55, 1.30) })
    return gain
  }

  // Automation, `02` §11.4 and §14.3. Two policies, both worse than a present player by a
  // published margin, and both switched off inside a mast window — you either show up for the ×6
  // or you leave it on the table.
  function autoRelease (o) {
    var s = S()
    if (!s || s.act !== 2 || !s.a2.flush.length) return
    if (!flagOn(s, 'sporulation_reflex')) return
    if (mastOpen(s)) return
    var alarm = flagOn(s, 'alarm_contracts')
    var list = s.a2.flush.slice()
    for (var j = 0; j < list.length; j++) {
      var p = list[j]
      if (p.hold) continue
      var want = AUTO_M
      if (alarm && alarmAt(p.regionId)) {
        var mk = marker(p)
        // The alarm policy fires when the forecast says the moment has arrived, not at a number.
        if (!mk || mk.tau > 0) continue
        want = Math.max(HAZ_M_MIN, mk.m)
      }
      if (num(p.m) >= want) release(p)
    }
    void o
  }

  // The player's override of the automation, per primordium (`02` §11.1, 1:40 — the automation
  // retires the tap and the override is the new verb).
  function hold (id, on) {
    var p = find(id)
    if (!p) return false
    p.hold = on !== false ? 1 : 0
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MAST YEARS
  // ───────────────────────────────────────────────────────────────────────────

  function schedule (s) {
    var a = A()
    var jitter = (walkH().next() * 2 - 1) * a.MAST_JITTER
    s.a2.mastAt = num(s.t) + a.MAST_PERIOD + jitter
    s.a2.mastUntil = num(s.a2.mastAt) + a.MAST_LEN
  }

  function stepMast (dt, opts) {
    var s = S()
    if (!s || s.act !== 2 || !(dt > 0)) return
    var o = opts || {}
    if (!flagOn(s, 'mast_synchrony')) return
    if (!(num(s.a2.mastUntil) > 0)) { schedule(s); return }

    // The timer pauses while you are away: a ×6 window that opened and closed unattended would be
    // a punishment for having a life, and the whole point of the window is that you are there.
    if (o.offline) {
      s.a2.mastAt = num(s.a2.mastAt) + dt
      s.a2.mastUntil = num(s.a2.mastUntil) + dt
      return
    }

    var t = num(s.t)
    var at = num(s.a2.mastAt)
    if (mastWarned !== at && t >= at - A().MAST_WARN && t < at) {
      mastWarned = at
      feel('warn.minor')
    }
    if (t >= at && t < at + Math.min(dt, 1) && mastWarned === at) feel('warn.major')
    if (t >= num(s.a2.mastUntil)) schedule(s)
  }

  function mast () {
    var s = S()
    if (!s || !s.a2) return { armed: false, open: false, inS: 0, leftS: 0 }
    var armed = flagOn(s, 'mast_synchrony') && num(s.a2.mastUntil) > 0
    var t = num(s.t)
    return {
      armed: armed,
      open: armed && mastOpen(s),
      warning: armed && t >= num(s.a2.mastAt) - A().MAST_WARN && t < num(s.a2.mastAt),
      inS: armed ? Math.max(0, num(s.a2.mastAt) - t) : 0,
      leftS: armed && mastOpen(s) ? Math.max(0, num(s.a2.mastUntil) - t) : 0
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BIBLE §4 STEP 7 — spore decay
  // ───────────────────────────────────────────────────────────────────────────

  function decayPerSecond (s) {
    if (s.act >= 3) {
      // BIBLE §2.3: Act III Phase A decays regardless of Seed Bank. The act opens on a number
      // going down, and that is the first thing it has to say.
      return s.phase === 'canopy' ? T().A3.SPORE_DECAY_3 : 1
    }
    if (s.act !== 2) return 1
    return flagOn(s, 'seed_bank') ? 1 : A().SPORE_DECAY
  }

  function stepSporeDecay (dt, opts) {
    var s = S()
    if (!s || !(dt > 0)) return
    void opts
    var k = decayPerSecond(s)
    if (k >= 1) return
    var v = num(s.res.spores)
    if (!(v > 0)) return
    C().setStock(s.res, 'spores', v * Math.pow(k, dt))
  }

  // Seed Bank's on-demand conversion, at SPORE_DIVISOR — the same rate ASCOSPORE uses on whatever
  // you are still holding, so the project is a decision about when, never about how much.
  function convert (grams) {
    var s = S()
    if (!s || !flagOn(s, 'seed_bank')) return 0
    var g = Math.min(num(grams), num(s.res.biomass))
    if (!(g > 0)) return 0
    var got = Math.floor(g / A().SPORE_DIVISOR)
    if (!(got > 0)) return 0
    C().setStock(s.res, 'biomass', num(s.res.biomass) - got * A().SPORE_DIVISOR)
    C().setStock(s.res, 'spores', num(s.res.spores) + got)
    return got
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PULSE — BLOOM arrives here from cognition.js
  // ───────────────────────────────────────────────────────────────────────────

  function onPulse (ev) {
    if (!ev || ev.mode !== 'BLOOM') return
    var s = S()
    if (!s || s.act !== 2 || !s.a2.flush.length) return
    var g = HY.cognition
    for (var j = 0; j < s.a2.flush.length; j++) {
      var p = s.a2.flush[j]
      var str = g && g.pulseStrength ? num(g.pulseStrength(ev.epicentre, p.regionId)) : 1
      p.m = Math.min(M_CAP, num(p.m) + BLOOM_M * str)
    }
    bloomUntil = num(ev.until) > num(s.t) ? num(ev.until) : num(s.t) + BLOOM_IMMUNE_S
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE STEPS loop.js DRIVES
  // ───────────────────────────────────────────────────────────────────────────

  function stepSpoilage (dt, o) { stepSporeDecay(dt, o) }

  function stepRisk (dt, opts) {
    var s = S()
    if (!s || s.act !== 2 || !(dt > 0)) return
    var o = opts || { stochastic: true, offline: false }
    if (lastAct !== 2) { lastAct = 2; enter(s) }
    stepMaturity(dt, o)
    stepHazards(dt, o.stochastic !== false, o)
    autoRelease(o)
    stepMast(dt, o)
    // Fire accumulation is BIBLE §4 step 11's and forest.js owns the quantity. stepFire is keyed
    // to s.t and self-guards, so calling it here is safe whether or not step 4 reached it first.
    if (HY.forest && HY.forest.stepFire) HY.forest.stepFire(dt, o)
  }

  function enter (s) {
    if (!(num(s.a2.W) > 0)) s.a2.W = A().OU_MEAN
    if (!(num(s.a2.windSpeed) > 0)) s.a2.windSpeed = A().WIND_BOOT
    var top = 0
    for (var j = 0; j < s.a2.flush.length; j++) top = Math.max(top, num(s.a2.flush[j].id))
    nextId = top + 1
    hist = null; histN = 0; histW = 0; histAt = 0
    sample(s, num(s.a2.W))
  }

  // ───────────────────────────────────────────────────────────────────────────
  // READOUTS — the UI reads these and never touches a2.flush
  // ───────────────────────────────────────────────────────────────────────────

  function regionName (i) {
    if (HY.world && HY.world.regionName) return HY.world.regionName(i)
    if (HY.forest && HY.forest.regionName) return HY.forest.regionName(i)
    return 'Stand ' + i
  }

  function card (p) {
    var s = S()
    var est = estimate(p)
    return {
      id: p.id,
      regionId: p.regionId,
      name: regionName(p.regionId),
      m: num(p.m),
      V: num(p.V),
      rob: p.rob, fec: p.fec, hyg: p.hyg,
      mode: p.mode,
      held: !!p.hold,
      age: num(s.t) - num(p.bornAt),
      moisture: moistureAt(p.regionId),
      risk: hazardRate(s, p, moistureAt(p.regionId), num(s.t)),
      now: est ? est.now : 0,
      best: est ? est.best : 0,
      bestIn: est ? est.bestIn : 0,
      survive: est ? est.survive : 1
    }
  }

  function list () {
    var s = S()
    if (!s || !s.a2 || !s.a2.flush) return []
    var out = []
    for (var j = 0; j < s.a2.flush.length; j++) out.push(card(s.a2.flush[j]))
    return out
  }

  function weather () {
    var s = S()
    var w = wind()
    return {
      W: W(),
      trend: s ? num(s.a2.Wmom) : 0,
      windSpeed: w.speed,
      windDir: w.dir,
      graze: grazePressure(),
      horizon: forecastHorizon(),
      band: s ? bandK(s) : 0,
      mast: mast()
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // §6's GENERIC MODULE SURFACE
  // ───────────────────────────────────────────────────────────────────────────

  function init (s) {
    s = s || S()
    if (!s || !s.a2) return
    reseed(s)
    wAcc = 0
    droughtSince = -1
    bloomUntil = -1
    mastWarned = 0
    lastAct = s.act
    enter(s)
  }

  // loop.js drives the three steps directly, in BIBLE §4's order; this exists for a harness
  // holding the module on its own, and the loop never calls it.
  function tick (s, dt, o) {
    void s
    stepWeather(dt, o)
    stepSpoilage(dt, o)
    stepRisk(dt, o)
  }

  function serialise () { return null }     // every persistent byte lives in §3's a2
  function migrate () { return true }

  // ASCOSPORE has just deleted the weather, the map and the flush. Everything below is derived
  // from a world that no longer exists.
  function reboot () {
    wAcc = 0
    hist = null; histN = 0; histW = 0; histAt = 0
    nextId = 1
    droughtSince = -1
    bloomUntil = -1
    mastWarned = 0
    lastAct = 0
  }

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

    var keep = HY.state.exportB64()
    try {
      var a = A(), s, i, j, p

      // ── the weather process ────────────────────────────────────────────────
      HY.state.init(HY.state.newGame(4242, null))
      s = S(); s.act = 2
      if (HY.world && HY.world.init) HY.world.init(s)
      if (HY.forest && HY.forest.init) HY.forest.init(s)
      init(s)

      // The exact kernel must be sim-rate independent: 600 s in 1 s steps and 600 s in one step
      // must land on the same deterministic value when nothing is drawn.
      var wA = a.OU_MEAN + 0.30, wB = wA, t0 = 0
      for (i = 0; i < 600; i++) wA = ouStep(wA, t0 + i, 1, false)
      wB = ouStep(wB, t0, 600, false)
      near(wA, wB, 1e-9, 'the OU kernel is not step-size invariant')

      // Deterministic relaxation: with no innovation W must converge on W̄ + season(t).
      s.a2.W = 0.95; s.t = 0
      for (i = 0; i < 400; i++) { s.t += 1; stepWeather(1, { stochastic: false, offline: true }) }
      near(num(s.a2.W), meanAt(num(s.t)), 0.02, 'offline weather did not relax to the seasonal mean')

      // Stochastically it must have the OU stationary law: sd = σ/√(2θ) = 0.198.
      s.a2.W = a.OU_MEAN; s.t = 0
      var sum = 0, sq = 0, n = 0
      for (i = 0; i < 6000; i++) {
        s.t += 1
        stepWeather(1, { stochastic: true, offline: false })
        if (i > 600) { var d = num(s.a2.W) - meanAt(num(s.t)); sum += d; sq += d * d; n++ }
      }
      var sd = Math.sqrt(sq / n - (sum / n) * (sum / n))
      near(sd, a.OU_SIGMA / Math.sqrt(2 * a.OU_THETA), 0.06, 'W is not at its stationary spread')
      within(num(s.a2.W), a.W_MIN, a.W_MAX, 'W left its clamp')

      // ── the forecast is the process's own conditional law ──────────────────
      s.a2.W = 0.80; s.t = 1000
      var fc = forecast(0)
      near(fc.mean, 0.80, 1e-9, 'forecast(0) is not the present value')
      near(fc.sd, 0, 1e-12, 'forecast(0) has a band')
      var tau = 300
      var pred = forecast(tau).mean
      // Run the deterministic kernel forward by hand: the forecast must BE that number.
      var byHand = ouStep(0.80, 1000, tau, false)
      near(pred, byHand, 1e-9, 'the forecast disagrees with the kernel that integrates the walk')
      ok(forecast(600).sd > forecast(120).sd, 'the band does not widen with the horizon')
      near(forecast(1e6).sd, a.OU_SIGMA / Math.sqrt(2 * a.OU_THETA), 1e-6,
        'the band does not converge on the stationary spread')

      // Empirical coverage: the ±1.15 SD band is a 75% band and must actually contain 75%.
      var inside = 0, trials = 1200
      for (i = 0; i < trials; i++) {
        var w0 = a.OU_MEAN + (i % 7 - 3) * 0.08
        s.a2.W = C().clamp(w0, 0.12, 0.88); s.t = 0
        var band = forecast(180)
        for (j = 0; j < 180; j++) { s.t += 1; stepWeather(1, { stochastic: true, offline: false }) }
        var landed = num(s.a2.W)
        if (landed >= band.lo - 1e-9 && landed <= band.hi + 1e-9) inside++
      }
      within(inside / trials, 0.68, 0.86, 'the ±1.15 SD band does not cover ~75% of outcomes')

      // ── horizon ladder ─────────────────────────────────────────────────────
      s = S(); s.proj.flags = {}
      near(forecastHorizon(), 0, 0, 'a fresh Act II has a forecast')
      s.proj.flags.barometric_sense = 1
      near(forecastHorizon(), a.FORECAST_H[1], 0, 'Barometric Sense did not open the 120 s horizon')
      near(bandK(s), 1.15, 1e-9, 'the B4 band is not ±1.15 SD')
      s.proj.flags.mast_synchrony = 1
      near(forecastHorizon(), a.FORECAST_H[2], 0, 'Mast Synchrony did not open the 300 s horizon')
      near(bandK(s), 0.95, 1e-9, 'the D1 band did not narrow')
      s.proj.flags.ballistospory = 1
      near(forecastHorizon(), a.FORECAST_H[3], 0, 'Ballistospory did not open the 600 s horizon')
      near(bandK(s), 0.75, 1e-9, 'the E1 band did not narrow')

      // ── the strip ──────────────────────────────────────────────────────────
      var st = strip(-1)
      ok(!!st, 'no strip')
      near(st.hist.length + st.fore.length, STRIP_N, 0, 'the strip is not 120 samples')
      near(st.lo.length, st.fore.length, 0, 'the band does not cover the forecast')
      near(st.graze.length, STRIP_N, 0, 'the graze band does not span the strip')
      ok(st.danger[0] === DESIC_T && st.danger[1] === WET_T, 'the danger lines are not the hazard thresholds')
      for (i = 0; i < st.fore.length; i++) {
        ok(st.lo[i] <= st.fore[i] + 1e-9 && st.hi[i] >= st.fore[i] - 1e-9, 'the band does not contain its centre')
      }
      ok(st.hi[st.hi.length - 1] - st.lo[st.lo.length - 1] >
         st.hi[0] - st.lo[0], 'the band does not widen across the strip')
      s.proj.flags = { barometric_sense: 1 }
      var narrow = strip(-1)
      ok(narrow.divider > st.divider, 'a shorter horizon did not give back strip to the past')

      // ── slots ──────────────────────────────────────────────────────────────
      s.proj.flags = {}
      near(slots(), 0, 0, 'FLUSH is open before Primordium')
      s.proj.flags.primordium = 1
      near(slots(), 1, 0, 'Primordium did not open one slot')
      s.proj.flags.sporulation_reflex = 1
      near(slots(), 4, 0, 'Sporulation Reflex did not open four slots')
      s.proj.flags.mast_synchrony = 1
      near(slots(), 6, 0, 'Mast Synchrony did not open six slots')
      s.proj.flags.ballistospory = 1
      near(slots(), 9, 0, 'Ballistospory did not open nine slots')

      // ── the morph ──────────────────────────────────────────────────────────
      s.proj.flags = { primordium: 1 }
      var rob = 0, fec = 0, hyg = 0, N = 400
      for (i = 0; i < N; i++) {
        s.stats.flushes = i
        var mm = morphFor(3)
        within(mm.rob, MORPH.rob.lo, MORPH.rob.hi, 'robustness left its clamp')
        within(mm.fec, MORPH.fec.lo, MORPH.fec.hi, 'fecundity left its clamp')
        within(mm.hyg, MORPH.hyg.lo, MORPH.hyg.hi, 'hygroscopy left its clamp')
        rob += mm.rob; fec += mm.fec; hyg += mm.hyg
      }
      near(rob / N, 1, 0.06, 'the robustness roll is not centred on 1')
      near(fec / N, 1, 0.08, 'the fecundity roll is not centred on 1')
      near(hyg / N, 1, 0.06, 'the hygroscopy roll is not centred on 1')
      s.stats.flushes = 0
      var shown = morphFor(3)
      near(morphFor(3).rob, shown.rob, 0,
        'the morph shown before commitment is not the morph committed')

      // ── committing ─────────────────────────────────────────────────────────
      var rgn = s.a2.regions
      rgn.flags[3] |= RF_CLAIMED
      rgn.d[3] = 0.5
      C().setStock(s.res, 'biomass', 1e9)
      ok(newPrimordium(4, 1e6) === null, 'a primordium grew on an unclaimed stand')
      p = newPrimordium(3, 1e6)
      ok(!!p, 'a claimed stand refused a primordium')
      near(num(s.res.biomass), 1e9 - 1e6, 1, 'the commitment was not deducted')
      near(p.rob, shown.rob, 0, 'the committed morph is not the one that was shown')
      ok(newPrimordium(3, 1e6) === null, 'a second primordium fitted in one slot')
      ok(newPrimordium(3, 1e30) === null, 'a bet larger than the bank was accepted')

      // ── maturation ─────────────────────────────────────────────────────────
      // `02` §7.4's worked case: base speed, mid canopy, d = 0.5, ideal moisture ⇒ ~1/285 per s.
      var savedCanopy = HY.forest ? HY.forest.canopy : null
      if (HY.forest) HY.forest.canopy = function () { return 0.978 }
      s.a2.W = 0.50
      var rate = matRateAt(s, p, 0.5)
      near(1 / rate, 285, 12, 'the base maturation time is not ~285 s')
      p.m = 0
      for (i = 0; i < 285; i++) stepMaturity(1, { stochastic: false })
      near(p.m, 1, 0.06, 'a primordium did not reach maturity in its own maturation time')
      ok(p.m <= M_CAP, 'maturity passed its ceiling')

      // ── the interior optimum, against `02` §7.7's table ─────────────────────
      // The table is quoted at dm/dt = 1/285 with hazMult 1 and a neutral morph; m* is the root of
      // 1.60/m = HAZ_BASE·m²·hazardEnv/ṁ, i.e. the cube root of 1.60·ṁ/(HAZ_BASE·hazardEnv).
      var neutral = { m: 1, mode: MODE_EPIGEOUS, hyg: 1, rob: 1, regionId: 3, V: 1e6 }
      var rows = [[1.00, 1.42], [1.26, 1.29], [1.58, 1.16], [1.23, 1.31], [1.55, 1.17], [2.13, 1.02]]
      for (i = 0; i < rows.length; i++) {
        var closed = Math.pow(A().YIELD_EXP * rate / (A().HAZ_BASE * rows[i][0]), 1 / 3)
        near(closed, rows[i][1], 0.08, '`02` §7.7 row ' + i + ': m* is off the published table')
      }

      // The published table is quoted at "no graze", and the graze cycle is deterministic, so there
      // is a known instant at which to check it: half a graze period puts sin() through π and the
      // one-sided term is exactly zero.
      var quiet = GRAZE.period / 2
      near(grazePressure(quiet), 0, 1e-12, 'the instant the published table is quoted at is not graze-free')

      // The solver must find that root, and it must move earlier in every direction that raises the
      // hazard environment — drought, waterlogging, a fragile morph.
      s.a2.W = 0.50; s.t = quiet
      var mStarIdeal = optimum(neutral, 0.50, quiet)
      within(mStarIdeal, 1.20, 1.50, 'the ideal-weather optimum is not in the published band')
      ok(optimum(neutral, 0.10, quiet) < mStarIdeal, 'a hard drought did not move the optimum earlier')
      ok(optimum(neutral, 0.95, quiet) < mStarIdeal, 'waterlogging did not move the optimum earlier')
      ok(optimum(neutral, 0.50, 0) < mStarIdeal, 'the graze cycle did not move the optimum earlier')
      ok(optimum({ m: 1, mode: MODE_EPIGEOUS, hyg: 1.45, rob: 0.55, regionId: 3, V: 1e6 }, 0.50, quiet) <
         mStarIdeal - 0.05, 'a fragile morph did not move the optimum earlier')

      // Exposure m² against yield m^1.6 is the whole design. One forward integration of the
      // maturation path carries survival with it, so every maturity on the path has an honest
      // expected value attached and the curve can simply be searched — no first-order condition
      // involved. If the solver above and this scan disagree, the ▲ marker points at a maturity the
      // game does not actually pay for, which is the one bug this sub-game cannot survive.
      var evPath = function (at) {
        var probe = { m: 0.02, mode: MODE_EPIGEOUS, hyg: 1, rob: 1, regionId: 3, V: 1e6 }
        var q0 = { mode: MODE_EPIGEOUS, V: 1e6, fec: 1, regionId: 3 }
        var surv = 1, mm2 = 0.02, dtx = 0.25, path = []
        while (mm2 < M_CAP) {
          probe.m = mm2
          path.push({ m: mm2, ev: yieldAt(s, q0, mm2) * surv })
          surv *= Math.exp(-hazardRate(s, probe, 0.50, at) * dtx)
          mm2 += matRateAt(s, probe, 0.50) * dtx
        }
        return path
      }
      var evOf = function (path, m) {
        var best = path[0]
        for (var z = 1; z < path.length; z++) {
          if (Math.abs(path[z].m - m) < Math.abs(best.m - m)) best = path[z]
        }
        return best.ev
      }
      var evPeak = function (path) {
        var best = path[0]
        for (var z = 1; z < path.length; z++) if (path[z].ev > best.ev) best = path[z]
        return best
      }

      var pathIdeal = evPath(quiet)
      var peak = evPeak(pathIdeal)
      near(peak.m, mStarIdeal, 0.03, 'the optimum solver disagrees with a brute-force scan of EV')
      ok(peak.ev > evOf(pathIdeal, mStarIdeal - 0.30), 'EV is not rising into the optimum')
      ok(peak.ev > evOf(pathIdeal, mStarIdeal + 0.30), 'EV is not falling out of the optimum')

      // `02` §7.7's "+66%" column is the yield at the published m* against the yield at m = 1.0 —
      // the size of the prize for holding on, before the coin is flipped.
      var q1 = { mode: MODE_EPIGEOUS, V: 1e6, fec: 1, regionId: 3 }
      near(yieldAt(s, q1, rows[0][1]) / yieldAt(s, q1, 1.0), 1.66, 0.03,
        'holding to the published m* is not worth the published +66% of yield')
      // Net of the risk taken to get there it is smaller, and it must still be worth taking.
      within(peak.ev / evOf(pathIdeal, 1.0), 1.15, 1.30,
        'skilled release does not beat the naive release-at-maturity heuristic')
      // At the graze peak the edge collapses, which is what makes graze "seasons of caution".
      var pathGraze = evPath(0)
      ok(evPeak(pathGraze).ev / evOf(pathGraze, 1.0) <
         peak.ev / evOf(pathIdeal, 1.0) - 0.05, 'the graze cycle does not flatten the skill edge')

      // ── hazards ────────────────────────────────────────────────────────────
      p.m = 0.10
      var before = s.a2.flush.length
      for (i = 0; i < 200; i++) stepHazards(1, true, {})
      near(s.a2.flush.length, before, 0, 'a primordium below m = 0.15 was exposed')
      p.m = 1.2
      s.a2.W = 0.05                      // hard drought: the hazard should be visible in seconds
      var died = 0
      for (i = 0; i < 4000 && s.a2.flush.length; i++) stepHazards(1, true, {})
      if (!s.a2.flush.length) died = 1
      ok(died === 1, 'a mature primordium in a hard drought survived an hour')
      near(num(s.res.biomass) > 1e9 - 1e6, true, 0, 'destruction returned no salvage at all')

      // Offline: never destroyed, only diminished (`02` §14.2).
      C().setStock(s.res, 'biomass', 1e9)
      p = newPrimordium(3, 1e6)
      p.m = 1.2
      var v0 = p.V
      for (i = 0; i < 600; i++) stepHazards(1, false, { offline: true })
      ok(s.a2.flush.length === 1, 'an offline hazard destroyed a primordium')
      ok(p.V < v0 && p.V > 0, 'offline hazard did not apply expected value')

      // ── release ────────────────────────────────────────────────────────────
      s.a2.W = 0.50
      s.res.spores = 0
      p.V = 1e6; p.m = 1.0; p.fec = 1; p.mode = MODE_EPIGEOUS
      s.stats.flushes = 1                 // past the first-flush bonus
      var y1 = release(p.id)
      ok(y1 > 0, 'a release produced nothing')
      near(num(s.res.spores), y1, 1e-6, 'the release did not land in the spore stock')
      near(s.a2.flush.length, 0, 0, 'the released primordium is still in the slot')
      near(num(s.stats.flushes), 2, 0, 'stats.flushes did not count the release')

      // Yield superlinear in m, sublinear in V — the two exponents the optimum is made of.
      var q = { mode: MODE_EPIGEOUS, V: 1e6, fec: 1, regionId: 3 }
      near(yieldAt(s, q, 1.2) / yieldAt(s, q, 1.0), Math.pow(1.2, a.YIELD_EXP), 1e-9,
        'yield does not grow as m^1.60')
      var big = { mode: MODE_EPIGEOUS, V: 4e6, fec: 1, regionId: 3 }
      near(yieldAt(s, big, 1) / yieldAt(s, q, 1), Math.pow(4, V_EXP), 1e-9,
        'yield is not sublinear in the bet size')
      ok(yieldAt(s, q, 2.4) < yieldAt(s, q, 1.9), 'the overripe penalty never bites')
      near(overripe(M_CAP + 0.02), OVERRIPE_FLOOR, 1e-9,
        'the maturity ceiling is not where the overripe penalty saturates')

      // ── automation is worse than skilled play, by the published margin ─────
      // TUNE.A2.AUTO_RELEASE is a claim about the game, not an input to it: nothing multiplies by
      // it. The reflex fires at a fixed maturity and this is the ratio that falls out.
      near(evOf(pathIdeal, AUTO_M) / peak.ev, a.AUTO_RELEASE, 0.05,
        'reflex release is not TUNE.A2.AUTO_RELEASE of skilled play')
      ok(evOf(pathGraze, AUTO_M) / evPeak(pathGraze).ev > a.AUTO_RELEASE,
        'the reflex does not close the gap when the weather punishes patience')

      // ── UNDERGROUND ────────────────────────────────────────────────────────
      C().setStock(s.res, 'biomass', 1e9)
      p = newPrimordium(3, 1e6)
      s.proj.flags.hypogeous_fruiting = 1
      ok(setMode(p.id, MODE_HYPOGEOUS), 'the UNDERGROUND mode was refused')
      near(hazardRate(s, p, 0.02, 0), 0, 0, 'UNDERGROUND is not hazard-free')
      p.m = 1.0
      var bio = num(s.res.biomass)
      var back = release(p.id)
      near(back, HYPO_K * 1e6, 1, 'UNDERGROUND does not return 6.2× committed V at m = 1')
      near(num(s.res.biomass), bio + back, 1, 'the UNDERGROUND return did not land in biomass')

      // ── mast ───────────────────────────────────────────────────────────────
      s.proj.flags.mast_synchrony = 1
      s.a2.mastAt = 0; s.a2.mastUntil = 0
      stepMast(1, { stochastic: true, offline: false })
      ok(num(s.a2.mastAt) > num(s.t), 'no mast window was scheduled')
      within(num(s.a2.mastAt) - num(s.t), a.MAST_PERIOD - a.MAST_JITTER, a.MAST_PERIOD + a.MAST_JITTER,
        'the mast window ignored its jitter bounds')
      near(num(s.a2.mastUntil) - num(s.a2.mastAt), a.MAST_LEN, 1e-9, 'the mast window is not 90 s')

      var atWas = num(s.a2.mastAt)
      for (i = 0; i < 10; i++) { s.t += 10; stepMast(10, { stochastic: false, offline: true }) }
      near(num(s.a2.mastAt) - atWas, 100, 1e-6, 'the mast timer did not pause offline')

      s.t = num(s.a2.mastAt) + 1
      ok(mastOpen(s), 'the window did not open')
      near(sporeMult(s), a.MAST_MULT, 1e-9, 'a mast window is not ×6 on yield')
      near(hazMult(s), MAST_HAZ, 1e-9, 'a mast window is not ×1.5 on hazard')
      near(matSpeed(s), MAST_MAT, 1e-9, 'a mast window is not ×2.5 on maturation')
      C().setStock(s.res, 'biomass', 1e9)
      p = newPrimordium(3, 1e6)
      p.m = 1.0
      s.proj.flags.sporulation_reflex = 1
      autoRelease({})
      near(s.a2.flush.length, 1, 0, 'auto-release ran inside a mast window')
      s.t = num(s.a2.mastUntil) + 1
      autoRelease({})
      near(s.a2.flush.length, 0, 0, 'auto-release did not fire outside the window')

      // ── spore decay ────────────────────────────────────────────────────────
      s.act = 2; s.proj.flags = {}
      C().setStock(s.res, 'spores', 1e6)
      stepSporeDecay(13860, {})           // half-life 3 h 51 m
      near(num(s.res.spores), 5e5, 5e3, 'the Act II spore half-life is not 3 h 51 m')
      s.proj.flags.seed_bank = 1
      C().setStock(s.res, 'spores', 1e6)
      stepSporeDecay(13860, {})
      near(num(s.res.spores), 1e6, 1e-3, 'Seed Bank did not switch decay off')
      s.act = 3; s.phase = 'canopy'
      C().setStock(s.res, 'spores', 1e6)
      stepSporeDecay(231, {})
      near(num(s.res.spores), 5e5, 5e3, 'the Act III Phase A half-life is not 231 s')

      // Seed Bank's conversion, at the divisor the transition itself uses.
      s.act = 2
      C().setStock(s.res, 'biomass', 1e6)
      C().setStock(s.res, 'spores', 0)
      var got = convert(1e6)
      near(got, Math.floor(1e6 / a.SPORE_DIVISOR), 0, 'Seed Bank converted at the wrong rate')
      near(num(s.res.spores), got, 1e-9, 'the converted spores did not land')

      // ── graze ──────────────────────────────────────────────────────────────
      var gzTop = 0, high = 0
      for (i = 0; i < GRAZE.period; i++) {
        var gp = grazePressure(i)
        gzTop = Math.max(gzTop, gp)
        if (gp > GRAZE.amp * 0.5) high++
      }
      near(gzTop, GRAZE.amp, 1e-3, 'graze pressure does not peak at 0.55')
      within(high, 150, 260, 'graze pressure is not high for ~200 s in 900')
      ok(grazePressure(0) >= 0, 'graze pressure went negative')

      // ── clay is a safe harbour ─────────────────────────────────────────────
      if (HY.forest && HY.forest.TERRAIN) {
        var loamI = -1, clayI = -1
        for (i = 0; i < rgn.terrain.length; i++) {
          if (rgn.terrain[i] === 0 && loamI < 0) loamI = i
          if (rgn.terrain[i] === 2 && clayI < 0) clayI = i
        }
        if (loamI >= 0 && clayI >= 0) {
          s.a2.W = 0.05
          var dLoam = Math.abs(moistureFrom(s, loamI, 0.05, 0) - a.OU_MEAN)
          var dClay = Math.abs(moistureFrom(s, clayI, 0.05, 0) - a.OU_MEAN)
          ok(dClay < dLoam, 'clay did not damp the drought')
        }
      }

      // ── drought detection ──────────────────────────────────────────────────
      s.act = 2; s.stats.droughtsSurvived = 0
      s.a2.W = 0.50; s.t = 0; droughtSince = -1
      for (i = 0; i < 200; i++) { s.t += 1; s.a2.W = 0.10; stepDrought(s, 0.10) }
      near(num(s.stats.droughtsSurvived), 0, 0, 'a drought counted before it ended')
      stepDrought(s, 0.60)
      near(num(s.stats.droughtsSurvived), 1, 0, 'surviving a drought was not recorded')

      if (savedCanopy && HY.forest) HY.forest.canopy = savedCanopy
    } catch (e) {
      f.push('THREW: ' + (e && e.message ? e.message : e))
    }
    try { HY.state.importB64(keep) } catch (e2) { void 0 }
    reboot()
    if (S()) init(S())
    return f
  }

  HY.flush = {
    // BIBLE §6 M10
    stepWeather: stepWeather,
    W: W,
    moistureAt: moistureAt,
    wind: wind,
    forecast: forecast,
    forecastHorizon: forecastHorizon,
    newPrimordium: newPrimordium,
    stepMaturity: stepMaturity,
    stepHazards: stepHazards,
    release: release,
    stepMast: stepMast,
    stepSporeDecay: stepSporeDecay,

    // the steps loop.js drives (BIBLE §4 steps 2, 7, 11) and the pulse arrival
    stepSpoilage: stepSpoilage,
    stepRisk: stepRisk,
    onPulse: onPulse,

    // §6's generic module surface
    init: init,
    tick: tick,
    serialise: serialise,
    migrate: migrate,
    reboot: reboot,

    // the readouts the UI and the other act modules read across the boundary
    strip: strip,
    card: card,
    list: list,
    weather: weather,
    mast: mast,
    grazePressure: grazePressure,
    slots: slots,
    used: used,
    pending: pending,
    estimate: estimate,
    matRate: matRate,
    hold: hold,
    setMode: setMode,
    convert: convert,
    MODE_EPIGEOUS: MODE_EPIGEOUS,
    MODE_HYPOGEOUS: MODE_HYPOGEOUS,

    __selftest: __selftest
  }
})(window.HY = window.HY || {})
