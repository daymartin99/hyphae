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

    // 1 · Clock. Season phase and the boundary events that hang off it.
    s.t += dt
    if (act === 1 && a1) a1.stepSeason(dt, o)

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

  function reconcileOffline (nowS) {
    var s = S()
    if (!s) return 0
    var elapsed = Math.max(0, (nowS === undefined ? Date.now() / 1000 : nowS) - (s.wallClock || 0))
    s.wallClock = nowS === undefined ? Date.now() / 1000 : nowS
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
      if (o.buy !== false && HY.act1 && HY.act1.buyTip && HY.act1.tipCost) {
        // Reinvest greedily but leave a margin, the way a player watching the
        // number actually behaves.
        while (s.res.biomass >= HY.act1.tipCost() * 1.25 && bought < 5000) {
          if (!HY.act1.buyTip()) break
          bought++
        }
      }
    }
    return bought
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
