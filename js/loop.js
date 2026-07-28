;(function (HY) {
  'use strict'

  // M3 · loop.js — the composition root.
  //
  // This file contains no game logic. It owns ordering and nothing else: if a
  // formula ever appears here it belongs in the module that owns the quantity.
  //
  // Two facts drive the whole design. First, BIBLE §4 fixes an interleaved order
  // across modules, so the loop drives each module's individual steps rather
  // than its tick() — calling act1.tick() then economy1.tick() would decompose
  // substrate before the market and the trees had moved, and §4.1's first
  // invariant forbids exactly that. Second, offline reconciliation runs this
  // same simTick with {stochastic:false}; there is no second copy of anything,
  // which is what makes a 12-hour absence reproduce byte for byte.

  function C () { return HY.core }
  function S () { return HY.state.state }
  function T () { return HY.core.TUNE }
  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }

  var running = false
  var simTimer = 0
  var dispTimer = 0
  var rafId = 0
  var simHz = 0
  var lastSimMs = 0
  var frameSubs = []
  var tickNo = 0
  var logEvery = 10          // step 16 runs at 1 Hz, so every 10th tick in Act I
  var assertEvery = 200
  var booted = false

  function nowMs () {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE TICK — BIBLE §4, in order
  // ───────────────────────────────────────────────────────────────────────────

  // Acts II and III are not built yet. Every step that belongs to them is a
  // feature-detected no-op, which is also exactly how they will be introduced.
  function simTick (dt, opts) {
    if (!(dt > 0)) return
    var s = S()
    if (!s) return
    var o = opts || { stochastic: true, offline: false }
    var act = s.act
    var a1 = HY.act1, ec = HY.economy1
    // act1.stepSeason advances s.t itself whenever nobody else has — it has to, because the season
    // boundary is a loop over a phase it derives from the clock. That makes it the owner of the
    // clock for as long as Act I is running, and a second owner here cost the player a double step
    // on the first tick after init() and after DECIDE, when act1's guard had nothing to compare to.
    var seasonOwnsClock = !!(act === 1 && a1 && a1.stepSeason)

    // 1 · Clock. Season phase and the boundary events that hang off it. The loop moves the clock
    //     only where no act module is there to move it, so it is advanced exactly once per tick.
    if (seasonOwnsClock) a1.stepSeason(dt, o)
    else s.t += dt

    // 2 · Environment. Offline this relaxes toward the seasonal mean because
    //     the modules read opts.stochastic rather than drawing.
    if (act === 1 && a1) a1.stepEnvironment(dt)
    if (act === 2 && HY.flush) HY.flush.stepWeather(dt, o)

    // 3 · Supply — BEFORE production, always (§4.1). Production reads stocks
    //     that supply has just written.
    if (act === 1 && ec) { ec.stepMarket(dt, o); ec.stepTrees(dt) }
    if (act === 2 && HY.forest) HY.forest.stepSupply(dt, o)

    // 4 · Production.
    if (act === 1 && a1) a1.stepDecomposition(dt)
    if (act === 2 && HY.forest) HY.forest.stepDecomp(dt, o)
    if (act === 3 && HY.bloom) HY.bloom.stepHarvest(dt, o)

    // 5 · Subsistence and continuous losses. Mortality is attributed where it
    //     happens, so this must precede the hazards in step 11.
    if (act === 3 && HY.bloom) HY.bloom.stepSubsist(dt, o)

    // 6 · Allocation and conversion. Feeds step 11's drift term.
    if (act === 3 && HY.bloom) HY.bloom.stepAllocation(dt, o)

    // 7 · Caps and spoilage. The signal clamp is deliberately not here.
    if (act === 1 && a1) a1.stepSpoilage(dt)
    if (act >= 2 && HY.flush) HY.flush.stepSpoilage(dt, o)

    // 8 · The strategic layer.
    if (act === 1 && ec) ec.deliverContracts(dt, o)
    if (act >= 2 && ec) ec.stepMineralExchange(dt, o)
    if (act === 2 && HY.pactbook) HY.pactbook.step(dt, o)
    if (act === 3 && HY.divergence) HY.divergence.stepEngagements(dt, o)

    // 9 · Cognition. The clamp sits here, after every producer and consumer of
    //     Signal has run, so saturation is measured on the net.
    if (HY.cognition) HY.cognition.step(dt, o)

    // 10 · Territory.
    if (act === 1 && a1) { a1.stepClaim(); a1.stepNeighbours(s, false) }
    if (act === 2 && HY.world) HY.world.step(dt, o)
    if (act === 3 && HY.bloom) HY.bloom.stepExploration(dt, o)

    // 11 · Risk. Offline, hazards apply expected value and nothing ignites.
    if (act === 2 && HY.flush) HY.flush.stepRisk(dt, o)
    if (act === 3 && HY.divergence) HY.divergence.step(dt, o)

    // 12 · Pulse. Never runs offline — a decision must not resolve while away.
    if (!o.offline && HY.cognition && HY.cognition.stepPulse) HY.cognition.stepPulse(dt, o)

    // 13 · Synchrony.
    if (act === 3 && HY.finale) HY.finale.step(dt, o)

    // 14 · Ladders and derived milestones.
    if (HY.cognition && HY.cognition.stepLadders) HY.cognition.stepLadders(dt, o)
    if (act === 3 && HY.bloom && HY.bloom.stepLadders) HY.bloom.stepLadders(dt, o)

    // 15 · Unlocks. Last of the gameplay steps: a project must never be revealed
    //      against a half-updated world.
    if (HY.projects) HY.projects.manageProjects(s)

    // 16 · Log, at 1 Hz.
    tickNo++
    if (HY.log && tickNo % logEvery === 0) HY.log.manageLog(s)

    // 17 · Assertions, dev only, cheap because they are rare.
    if (assertEvery && tickNo % assertEvery === 0 && HY.harness && HY.harness.assert) {
      HY.harness.assert(s)
    }

    // 18 · Autosave counter, plus the module's own event hooks.
    if (!o.offline && HY.state.tick) HY.state.tick(s, dt, o)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // OFFLINE
  // ───────────────────────────────────────────────────────────────────────────

  // The tiered schedule of 08 §10.1: full value for the first stretch away,
  // then diminishing. Integrated rather than sampled so that returning after
  // seven hours cannot be gamed by returning after six and then after one.
  function effective (elapsedS) {
    var O = T().OFFLINE
    var cap = S() && S().proj && S().proj.flags && S().proj.flags.vernalisation
      ? O.CAP_VERNALISATION : O.CAP
    var left = C().clamp(elapsedS, 0, cap)
    var acc = 0, prev = 0, i, tier
    for (i = 0; i < O.TIERS.length && left > 0; i++) {
      tier = O.TIERS[i]
      var width = Math.min(left, tier[0] - prev)
      if (width > 0) { acc += width * tier[1]; left -= width }
      prev = tier[0]
    }
    return acc
  }

  // `wallClock` is seconds since the epoch, written by state.save() and by the cold-boot save, and
  // read only here. state.now() is the single reader of the platform clock so the two sides cannot
  // drift apart again; passing `nowS` explicitly is how the harness and the D35 determinism check
  // hold the clock still.
  function reconcileOffline (nowS) {
    var s = S()
    if (!s) return 0
    var at = nowS === undefined ? HY.state.now() : nowS
    // A save with no wall clock at all is one this build has never written. Treating it as "just
    // now" costs nothing; treating it as the epoch would hand out the offline cap on first sight.
    var elapsed = s.wallClock > 0 ? Math.max(0, at - s.wallClock) : 0
    s.wallClock = at
    if (!(elapsed > 1)) return 0

    var eff = effective(elapsed)
    if (!(eff > 0)) return 0

    var STEPS = T().OFFLINE.STEPS
    var dt = eff / STEPS
    var opts = { stochastic: false, offline: true }
    if (HY.log && HY.log.freeze) HY.log.freeze()
    for (var i = 0; i < STEPS; i++) simTick(dt, opts)
    if (HY.log && HY.log.thaw) HY.log.thaw()
    if (HY.log && HY.log.returnBurst) HY.log.returnBurst(elapsed, eff)
    return eff
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCHEDULING — one rAF, two intervals (§4.2)
  // ───────────────────────────────────────────────────────────────────────────

  function setSimRate (hz) {
    if (hz === simHz) return
    simHz = hz
    logEvery = Math.max(1, Math.round(hz / T().CLOCK.LOG_HZ))
    if (simTimer) clearInterval(simTimer)
    simTimer = setInterval(simStep, 1000 / hz)
  }

  function simStep () {
    var t = nowMs()
    var behind = (t - lastSimMs) / 1000
    lastSimMs = t
    var K = T().CLOCK

    // A stalled tab (backgrounded, or a long GC) must not burst: one catch-up
    // tick, deterministic, capped. Bursting would let a hidden tab out-earn a
    // visible one, which is the opposite of the promise.
    if (behind > K.CATCHUP_BEHIND_S) {
      simTick(Math.min(behind, K.CATCHUP_MAX_DT), { stochastic: false, offline: false })
      return
    }
    simTick(1 / simHz, { stochastic: true, offline: false })
  }

  function displayStep () {
    if (HY.ui && HY.ui.display) HY.ui.display(S())
  }

  function frame (ts) {
    rafId = requestAnimationFrame(frame)
    var s = S()
    if (HY.ui && HY.ui.render) HY.ui.render(s)
    if (HY.canvas) {
      if (HY.canvas.growNetwork && HY.act1 && HY.act1.hyphae) HY.canvas.growNetwork(HY.act1.hyphae())
      if (HY.canvas.drawNet) HY.canvas.drawNet()
    }
    for (var i = 0; i < frameSubs.length; i++) frameSubs[i](ts, s)
  }

  function onFrame (fn) { if (typeof fn === 'function') frameSubs.push(fn) }

  function onVisibility () {
    var hidden = typeof document !== 'undefined' && document.hidden
    if (hidden) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
      if (HY.feel && HY.feel.suspendAll) HY.feel.suspendAll()
      // Saving on the way out is best-effort: storage may be full or blocked,
      // and that is not worth interrupting the player to report.
      if (HY.state.save) { try { HY.state.save() } catch (e) { void 0 } }
    } else {
      lastSimMs = nowMs()
      if (!rafId) rafId = requestAnimationFrame(frame)
      if (HY.feel && HY.feel.resumeAll) HY.feel.resumeAll()
    }
  }

  function start () {
    if (running) return
    running = true
    lastSimMs = nowMs()
    setSimRate(S().act === 1 ? T().CLOCK.SIM_HZ_A1 : T().CLOCK.SIM_HZ_A23)
    dispTimer = setInterval(displayStep, 1000 / T().CLOCK.DISPLAY_HZ)
    if (typeof requestAnimationFrame === 'function') rafId = requestAnimationFrame(frame)
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', onVisibility)
    }
  }

  function stop () {
    running = false
    if (simTimer) { clearInterval(simTimer); simTimer = 0 }
    if (dispTimer) { clearInterval(dispTimer); dispTimer = 0 }
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
    simHz = 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BOOT
  // ───────────────────────────────────────────────────────────────────────────

  function boot () {
    if (booted) return
    booted = true

    var save = null
    try { save = HY.state.load() } catch (e) { save = null }
    HY.state.init(save || null)
    var s = S()

    // Order matters only here: log and ui must exist before anything can want
    // to write a line or reveal a panel.
    var mods = ['log', 'projects', 'act1', 'economy1', 'cognition', 'world', 'forest',
      'flush', 'pactbook', 'bloom', 'divergence', 'finale', 'feel', 'canvas', 'ui']
    for (var i = 0; i < mods.length; i++) {
      var m = HY[mods[i]]
      if (m && m.init) { try { m.init(s) } catch (e) { logBootFault(mods[i], e) } }
    }

    var root = typeof document !== 'undefined' ? document.getElementById('app') : null
    if (HY.ui && HY.ui.mount && root) HY.ui.mount(root)

    reconcileOffline()
    start()
  }

  function logBootFault (name, err) {
    // A module that cannot start must not take the game with it: the player
    // keeps a running save, and the fault is loud in the console rather than
    // silent behind a blank screen.
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('hyphae: ' + name + '.init failed — continuing without it', err)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DEBUG — the screenshot harness and the balance simulator drive these
  // ───────────────────────────────────────────────────────────────────────────

  function fastForward (seconds, opts) {
    var s = S()
    if (!s || !(seconds > 0)) return 0
    // Deliberately the live cadence, not one big step: the point of a
    // fast-forward is to reach a state the player could actually have reached.
    var dt = s.act === 1 ? T().CLOCK.DT_A1 : T().CLOCK.DT_A23
    var n = Math.ceil(seconds / dt)
    var o = opts || { stochastic: true, offline: false }
    for (var i = 0; i < n; i++) simTick(dt, o)
    return n
  }

  // The policy `play` follows, named rather than sprinkled. These are harness
  // numbers, not balance: they describe how the stand-in player behaves, and the
  // game's own tables stay the only source of what that behaviour costs.
  var PLAY = {
    TIP_MARGIN: 1.25,        // × tipCost before reinvesting, the margin a player watching the number leaves
    BUY_CAP: 5000,           // purchases per call; a ceiling so one long run cannot spin forever
    BUFFER_S: 120,           // s of demand to keep on the floor: a buffer is a flow, not a fill level
    SUGAR_KEEP: 0.50,        // fraction of sugar held back, so contracts stay signable
    COVERAGE: 0.60           // ceiling on committed ÷ income, the ratio the tree card itself warns on
  }

  // Advancing the clock is not the same as playing: Act I yields nothing at all
  // until the player extends something, so a pure fastForward reaches a state no
  // real player is ever in. This drives the actual verbs at a human cadence and
  // buys the obvious thing when it can afford it, which is what a screenshot or
  // a balance run should be looking at.
  function play (seconds, opts) {
    var s = S()
    if (!s || !(seconds > 0)) return 0
    var o = opts || {}
    var taps = o.tapsPerSec === undefined ? 2 : o.tapsPerSec
    var dt = s.act === 1 ? T().CLOCK.DT_A1 : T().CLOCK.DT_A23
    var perSec = Math.round(1 / dt)
    var sopts = { stochastic: o.stochastic !== false, offline: false }
    var bought = 0
    for (var sec = 0; sec < seconds; sec++) {
      for (var k = 0; k < taps; k++) if (HY.act1 && HY.act1.onExtend) HY.act1.onExtend()
      for (var j = 0; j < perSec; j++) simTick(dt, sopts)
      if (o.buy === false) continue
      // Act I is a liquidity business before it is a clicker: a stand-in that
      // never restocks the floor eats its way to zero substrate and then holds a
      // dead EXTEND for the rest of the run, which is a state no player is in
      // and the wrong picture for a screenshot or a balance number.
      if (o.restock !== false) restockFloor(s)
      if (HY.act1 && HY.act1.buyTip && HY.act1.tipCost) {
        // Reinvest greedily but leave a margin, the way a player watching the
        // number actually behaves.
        while (s.res.biomass >= HY.act1.tipCost() * PLAY.TIP_MARGIN && bought < PLAY.BUY_CAP) {
          if (!HY.act1.buyTip()) break
          bought++
        }
      }
      // Projects are the only thing that moves the game forward: the act breaks
      // are gated behind them, so a stand-in that buys none of them never leaves
      // Act I however long it is run for.
      if (o.projects !== false) bought += buyProjects()
      if (o.contracts !== false) signContracts(s)
      s = S()
    }
    return bought
  }

  // Cheapest-first, which is the order `visible()` already sorts into, and one
  // pass per second so a purchase that reveals another waits a beat — the same
  // rhythm the player reads the panel at.
  function buyProjects () {
    var pj = HY.projects
    if (!pj || !pj.visible || !pj.purchase) return 0
    var list = pj.visible(), n = 0, i
    for (i = 0; i < list.length; i++) {
      if (!list[i].buyable) continue
      if (pj.affordRatio(list[i]) > 1) continue
      if (pj.purchase(list[i].id)) n++
    }
    return n
  }

  // Buy the cheapest unlocked litter first, which is the consumption order the
  // game itself defaults to, and never spend the whole book.
  //
  // The target is minutes of demand, not a fraction of the bin: the floor's caps
  // run to tens of kilograms while a mid-act sugar book is three figures, so
  // "fill the bin" is an order the player can never afford and the bot would
  // spend every gram of sugar forever trying.
  function restockFloor (s) {
    var e1 = HY.economy1
    if (!e1 || !e1.buy || s.act !== 1 || !s.a1) return
    var want = HY.act1.throughputPerSec() * PLAY.BUFFER_S
    if (!(want > 0) || totalFloor(s) >= want) return
    var budget = num(s.res.sugar) * (1 - PLAY.SUGAR_KEEP)
    var order = (s.a1.unlockedTypes || []).slice()
    order.sort(function (a, b) { return e1.unitPrice(a) - e1.unitPrice(b) })
    for (var i = 0; i < order.length && budget > 0; i++) {
      var k = order[i]
      var short = want - totalFloor(s)
      if (!(short > 0)) return
      var price = e1.unitPrice(k)
      if (!(price > 0)) continue
      var room = e1.capOf(k) - num(s.a1.sub[k])
      var g = Math.min(short, room, budget / price)
      if (!(g > 0)) continue
      budget -= e1.buy(k, g) * price
    }
  }

  function totalFloor (s) {
    var t = 0, i, types = HY.economy1.TYPES
    for (i = 0; i < types.length; i++) t += num(s.a1.sub[types[i]])
    return t
  }

  // Selling sugar forward is the only thing in Act I that pays a mineral, and
  // minerals gate the whole back half of the catalog and every tip past the
  // twenty-fourth. A stand-in that never signs stalls at that wall with a
  // seven-figure biomass and nothing to spend it on.
  //
  // The position is sized off the coverage ratio the tree card already shows,
  // and the term is the shortest legal one: this is a harness keeping itself
  // solvent, not a model of good trading.
  function signContracts (s) {
    var e1 = HY.economy1
    if (!e1 || !e1.signContract || s.act !== 1 || !s.a1) return
    var trees = s.a1.trees
    if (!trees || !trees.length) return
    var income = e1.netSugar() + e1.committedSugarPerSec()
    if (!(income > 0)) return
    var head = PLAY.COVERAGE * income - e1.committedSugarPerSec()
    if (!(head > 0)) return
    var term = T().A1.TERM_MIN
    for (var i = 0; i < trees.length && head > 0; i++) {
      var vol = Math.min(head, e1.maxIntake(trees[i]))
      if (!(vol > 0) || !e1.accepts(trees[i], vol, term, false, 0)) continue
      if (e1.signContract(trees[i].id, vol, term, 0, false)) head -= vol
    }
  }

  function selftest () {
    var names = ['core', 'state', 'log', 'projects', 'act1', 'economy1', 'ui', 'canvas', 'feel',
      'cognition', 'world', 'forest', 'flush', 'pactbook', 'bloom', 'divergence', 'finale']
    var out = []
    for (var i = 0; i < names.length; i++) {
      var m = HY[names[i]]
      if (!m || !m.__selftest) continue
      var r
      try { r = m.__selftest() } catch (e) { out.push(names[i] + ': THREW ' + e.message); continue }
      for (var j = 0; j < r.length; j++) out.push(names[i] + ': ' + r[j])
    }
    return out
  }

  HY.loop = {
    start: start,
    stop: stop,
    simTick: simTick,
    reconcileOffline: reconcileOffline,
    setSimRate: setSimRate,
    onFrame: onFrame,
    effective: effective,
    get running () { return running },
    get ticks () { return tickNo }
  }

  HY.debug = { fastForward: fastForward, play: play, selftest: selftest }
  HY.boot = boot
})(window.HY = window.HY || {})
