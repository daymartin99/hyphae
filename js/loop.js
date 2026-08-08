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
    // The act transitions are paced in the player's seconds, not the sim's 1 Hz log slot: the
    // display clock pumps them whenever it is alive, and log.js falls back to the sim clock when
    // it is not (headless, or a harness fast-forwarding synchronously).
    if (HY.log && HY.log.pumpSequence) HY.log.pumpSequence()
    if (HY.ui && HY.ui.display) HY.ui.display(S())
  }

  function frame (ts) {
    rafId = requestAnimationFrame(frame)
    var s = S()
    // The plate belongs to ui.render, which knows which act's picture the frame wants. Driving the
    // canvas from here as well drew the Act I network over the Act II map every second frame.
    if (HY.ui && HY.ui.render) HY.ui.render(s)
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

    reinitModules(s)

    var root = typeof document !== 'undefined' ? document.getElementById('app') : null
    if (HY.ui && HY.ui.mount && root) HY.ui.mount(root)

    reconcileOffline()
    start()
  }

  // Order matters only here: log and ui must exist before anything can want to
  // write a line or reveal a panel. This is also the repair path for an import:
  // module-scope caches (economy1's id counters, the market walk, pact books)
  // are rehydrated only by init, so a state swapped in by importB64 without
  // this pass keeps simulating with the previous run's counters — D35 found
  // the fingerprint as a tree id that crept 6 -> 7 -> 8 across reconciles of
  // the same exported save.
  function reinitModules (s) {
    // The stand-in player's own memory has to reset with the run: its sticky
    // savings goal (`saver`) otherwise survives an import, and a warm page
    // mid-goal refuses purchases a cold boot of the same save makes — the two
    // then diverge on the very first second, in the buyer, not the sim.
    saver = null
    tickNo = 0
    var mods = ['log', 'projects', 'act1', 'economy1', 'cognition', 'world', 'forest',
      'flush', 'pactbook', 'bloom', 'divergence', 'finale', 'feel', 'canvas', 'ui']
    for (var i = 0; i < mods.length; i++) {
      var m = HY[mods[i]]
      if (m && m.init) { try { m.init(s) } catch (e) { logBootFault(mods[i], e) } }
    }
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
    COVERAGE: 0.60,          // ceiling on committed ÷ income, the ratio the tree card itself warns on
    SAVE_RATE: 0.50,         // fraction of new income set aside for the thing being saved for
    SAVE_STALE_S: 420,       // s a savings goal may fail to get closer before the bot gives up on it
    ROUTINE_S: 90,           // s of income under which a purchase is routine and never raids the bank
    RATE_TAU: 60,            // s of smoothing on the measured income rates
    FORGIVE_GROWTH: 4,      // × income growth after which abandoned goals are reconsidered
    COND_SHARE: 0.50,       // fraction of the D budget spent on rate before capacity is asked for
    VES_SLACK: 2            // surplus Vesicle points tolerated before the book is reallocated
  }

  // What the stand-in is saving for: the cheapest thing on screen it cannot yet
  // afford, which is P3's "visible-and-saved-for" made operational. Without it the bot
  // reinvests every gram into tips forever and never banks the 900,000 g + 4,000 ⛬ the
  // exit project costs — Act I compounds beautifully and never ends.
  //
  // The reserve is a *bank filled out of income*, not the goal's whole price. Refusing
  // to buy a tip until the full price is on hand starves the engine that pays for it:
  // measured, that policy held the network at 19 tips for a hundred minutes. Half of
  // each second's earnings compounds into tips and half accrues toward the goal, so
  // both curves keep moving and the goal still arrives.
  //
  // The one remaining failure is a goal that never arrives, so patience is bounded: a
  // goal is kept while its affordRatio keeps falling, and abandoned once it has stopped
  // closing for SAVE_STALE_S. Nothing unreachable can stall a run.
  function Saver (act, s) {
    this.act = act
    this.id = null
    this.best = Infinity
    this.stale = 0
    this.dead = {}
    this.bankG = 0
    this.bankMin = 0
    this.rateG = 0
    this.rateMin = 0
    this.forgiveAt = 0
    this.isDoor = false
    this.lastCum = num(s.res.cumBiomass)
    this.lastEarned = num(s.stats.mineralEarned)
  }

  // One saver per act, held across calls, so driving a run in chunks behaves exactly
  // like driving it in one go — patience that resets every 120 s is not patience.
  var saver = null
  function saverFor (s) {
    if (!saver || saver.act !== s.act) saver = new Saver(s.act, s)
    return saver
  }

  // A goal is sticky until it is bought or goes stale. Re-choosing the cheapest
  // unaffordable entry every second made the bot oscillate: the moment the bank made
  // something affordable it stopped being the goal, the next entry became the goal,
  // and the new bank blocked the purchase the old bank had been saving for. Nothing
  // was ever bought and no float ever survived a minute.
  Saver.prototype.pick = function (dt) {
    var pj = HY.projects
    if (!pj || !pj.visible) return null

    // The act's own exit outranks everything and is never abandoned. It is not one option among
    // six: it is the only entry on the board that leads anywhere, its price is the largest in the
    // act by design, and its spore component decays while the player saves for it. Letting the
    // ordinary staleness rule retire it cost a measured run the whole of Act III — the bank was
    // released at minute 460, biomass went back into the book, and ASCOSPORE sat visible and
    // unaffordable for the following six hours.
    var door = this.door()
    if (door) {
      this.id = door.id
      this.isDoor = true
      this.stale = 0
      return pj.priceOf(door.id) || {}
    }
    this.isDoor = false

    var held = this.id && !pj.isBought(this.id) && !this.dead[this.id] ? pj.byId(this.id) : null
    if (held) {
      var hr = pj.affordRatio(held.id)
      if (hr < this.best) { this.best = hr; this.stale = 0 } else this.stale += dt
      if (this.stale < PLAY.SAVE_STALE_S) return pj.priceOf(held.id) || {}
      this.dead[held.id] = 1
    }
    this.id = null
    var list = pj.visible(), pick = null, pickR = Infinity, i, r
    for (i = 0; i < list.length; i++) {
      // Failsafes and re-armables are never a goal: they are always cheap, never
      // finished, and saving for one is saving for nothing.
      if (!list[i].buyable || list[i].rearm || isOneWay(list[i]) || this.dead[list[i].id]) continue
      r = pj.affordRatio(list[i])
      if (r > 1 && r < pickR) { pickR = r; pick = list[i] }
    }
    if (!pick) return null
    this.id = pick.id
    this.best = pickR
    this.stale = 0
    return pj.priceOf(pick.id) || {}
  }

  // The reserve for this second. Capped by the goal's price (there is no point banking
  // past it) and by what is actually held (a purchase elsewhere spends the bank too).
  Saver.prototype.reserve = function (s, dt) {
    var cum = num(s.res.cumBiomass), earned = num(s.stats.mineralEarned)
    var dG = Math.max(0, cum - this.lastCum), dM = Math.max(0, earned - this.lastEarned)
    this.lastCum = cum
    this.lastEarned = earned
    // Income per second, smoothed. It is what tells a routine purchase from a raid on the
    // savings, and it has to be measured rather than asked for: no module publishes a single
    // "income" number that spans a market, seven decomposing pools and a contract book.
    var a = dt > 0 ? Math.min(1, dt / PLAY.RATE_TAU) : 0
    this.rateG += (dG / Math.max(dt, 1e-6) - this.rateG) * a
    this.rateMin += (dM / Math.max(dt, 1e-6) - this.rateMin) * a
    this.forgive()
    var price = this.pick(dt)
    if (!price) { this.bankG = 0; this.bankMin = 0; return null }
    // Saving half of each second's income out of a rising curve is how a player reaches a normal
    // goal. It is the wrong model for an act transition, because by the time one is on screen the
    // curve it would be funded out of has already gone to zero — Act II's exit becomes visible at
    // fc ≥ 0.97, when there is no forest left to earn from. What is held is all there will ever be,
    // so the whole of it is spoken for the moment the door appears.
    if (this.isDoor) {
      this.bankG = Math.min(num(price.g), num(s.res.biomass))
      this.bankMin = Math.min(num(price.min), num(s.res.minerals))
      return { g: this.bankG, min: this.bankMin }
    }
    this.bankG = Math.min(num(price.g), num(s.res.biomass), this.bankG + dG * PLAY.SAVE_RATE)
    this.bankMin = Math.min(num(price.min), num(s.res.minerals), this.bankMin + dM * PLAY.SAVE_RATE)
    return { g: this.bankG, min: this.bankMin }
  }

  // Whether buying `p` now would spend the bank. Tips are not the only way to lose a
  // float: measured, the bot banked 368,000 g toward the act's exit and then spent it
  // on the sixth patch at 400,000 g + 4,400 ⛬, which reset the savings and eventually
  // aged the exit out as unreachable. The goal itself is never blocked.
  //
  // Only *large* purchases compete with a goal. A player saving for the act's exit still buys the
  // enzyme upgrade that pays for itself in a minute, because the upgrade is how the exit arrives
  // sooner — and measured, a bank that blocked everything held `enzymeMult` at exactly 1.00 for the
  // whole of Act I and jammed three trap entries into the six visible slots for two hours, with
  // `anastomosis` (the act's own exit chain) parked in the reveal queue behind them. A purchase
  // costing under ROUTINE_S seconds of measured income is routine and never touches the bank.
  Saver.prototype.blocks = function (p) {
    if (!p || p.id === this.id) return false
    var s = S(), pj = HY.projects
    var price = pj.priceOf(p.id) || {}
    if (this.routine(price)) return false
    if (this.bankG > 0 && num(s.res.biomass) - num(price.g) < this.bankG) return true
    if (this.bankMin > 0 && num(s.res.minerals) - num(price.min) < this.bankMin) return true
    // An act transition is priced in currencies nothing else in the run is: Act II's exit wants
    // 1.6e6 Σ *held*, and Signal is the one resource in the game with a hard cap it sits against.
    // Measured, a stand-in that guarded only grams watched the pool climb to 1.0e6 and fall back to
    // 1.5e5 every ten minutes, forever, because it spent it on whatever else had gone affordable
    // on the way up.
    //
    // The test is the exact one, not a proxy: would this purchase leave the door still payable?
    // A blanket ban on touching any of the door's currencies also banned `seed_bank`, which is the
    // only way to make the 4.0e8 ◦ the door asks for — the goal blocking its own prerequisite.
    if (!this.isDoor) return false
    var chain = EXIT_CHAIN[this.id]
    if (chain && chain.indexOf(p.id) >= 0) return false
    var goal = pj.priceOf(this.id) || {}
    var k
    for (k in goal) {
      if (!Object.prototype.hasOwnProperty.call(goal, k)) continue
      if (!(num(goal[k]) > 0)) continue
      if (pj.holding(k) - num(price[k]) < num(goal[k])) return true
    }
    return false
  }

  // The visible, unbought, unaffordable act transition, if there is one.
  Saver.prototype.door = function () {
    var pj = HY.projects
    var list = pj.visible(), i, p
    for (i = 0; i < list.length; i++) {
      p = list[i]
      if (!TAKES_DOOR[p.id] || !p.buyable) continue
      if (pj.affordRatio(p) > 1) return p
    }
    return null
  }

  // Patience is bounded, but so is the judgement that bounded it. A goal abandoned as unreachable
  // at 200 g/s is an afternoon's work at 2,000 g/s, and a stand-in that never revisits the verdict
  // ends up with no goal at all, an empty bank and every gram going into the next tip: measured,
  // that state held Act I from minute 285 to minute 465 with `anastomosis` — the exit chain —
  // permanently written off. The whole set is reconsidered once income has quadrupled.
  Saver.prototype.forgive = function () {
    if (this.rateG <= this.forgiveAt * PLAY.FORGIVE_GROWTH) return
    this.forgiveAt = this.rateG
    this.dead = {}
  }

  // Whether spending `amount` of one currency outside the catalog — a REACH, a survey, a stake —
  // would leave the act's exit unpayable. Act III's verbs are priced in Σ and so is its exit.
  Saver.prototype.wouldStarveDoor = function (key, amount) {
    if (!this.isDoor) return false
    var pj = HY.projects
    var goal = pj.priceOf(this.id) || {}
    return num(goal[key]) > 0 && pj.holding(key) - num(amount) < num(goal[key])
  }

  Saver.prototype.routine = function (price) {
    return num(price.g) <= this.rateG * PLAY.ROUTINE_S &&
           num(price.min) <= this.rateMin * PLAY.ROUTINE_S
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
    wanted = o.want === 'A' || o.want === 'B' || o.want === 'C' ? o.want : ''
    for (var sec = 0; sec < seconds; sec++) {
      for (var k = 0; k < taps; k++) if (HY.act1 && HY.act1.onExtend) HY.act1.onExtend()
      for (var j = 0; j < perSec; j++) simTick(dt, sopts)
      if (o.buy === false) continue
      if (s.act === 2) { bought += playAct2(s, o); s = S(); continue }
      if (s.act === 3) { bought += playAct3(s, o); s = S(); continue }
      // Act I is a liquidity business before it is a clicker: a stand-in that
      // never restocks the floor eats its way to zero substrate and then holds a
      // dead EXTEND for the rest of the run, which is a state no player is in
      // and the wrong picture for a screenshot or a balance number.
      if (o.restock !== false) restockFloor(s)
      var sv = o.save === false ? null : saverFor(s)
      var goal = sv ? sv.reserve(s, 1) : null
      if (HY.act1 && HY.act1.buyTip && HY.act1.tipCost) {
        // Reinvest greedily but leave a margin, the way a player watching the
        // number actually behaves — and never below what is being saved for.
        while (bought < PLAY.BUY_CAP && affordsTip(s, goal)) {
          if (!HY.act1.buyTip()) break
          bought++
        }
      }
      // Projects are the only thing that moves the game forward: the act breaks
      // are gated behind them, so a stand-in that buys none of them never leaves
      // Act I however long it is run for.
      if (o.projects !== false) bought += buyProjects(sv)
      if (o.contracts !== false) signContracts(s)
      s = S()
    }
    return bought
  }

  // Differentiation, allocated the way the two readouts on screen actually read.
  //
  // Vesicle raises the pool; Conduction fills it faster. Because BIBLE §9.4 fixes
  // timeToFill = 86.7·(1+dVes)^1.85 / ((1+0.35·dCond)·C·signalMult), the two axes are not
  // interchangeable and the naive "always Vesicle" policy is close to the worst one available:
  // measured, seventeen points of Vesicle put time-to-fill at 15,500 s, the pool never filled,
  // and Insight — which accrues *only* while the pool is full — stayed at zero for four hours of
  // Act II while the whole Ψ half of the catalog sat greyed.
  //
  // So Vesicle is bought only for headroom the player can name: enough pool to pay for the most
  // expensive Σ price currently on screen. Everything else goes to Conduction, which is what turns
  // saturated seconds into Insight.
  function allocateD (s) {
    var g = HY.cognition
    if (!g || !g.unallocated) return
    var want = poolWanted(s)
    var short = poolShort(s)
    if (g.unallocated(s) > 0) {
      // Conduction is the default home for a point — it is what turns saturated seconds into
      // Insight — but it is not free once Photoreception is holding the floor up, because the
      // floor is solved against the rate and a faster rate is a smaller reserve. Measured, the
      // stand-in reached Sc = 1.599e6 against a 1.600e6 Σ gate and then spent its last five points
      // on Conduction, which pushed the capacity back down below the price it had just cleared.
      // So each point asks the capacity whether it can spare it.
      if (short) { g.allocate('ves', 1); return }
      // Nothing on the board needs capacity *yet*. That is not a reason to spend the whole budget
      // on rate: ASCOSPORE hands back every point at once, and a book that immediately puts all of
      // them into Conduction meets Act III's first two prices — 200 Σ and 1,400 Σ — with a capacity
      // of 488 Σ and has to buy a 1,576 Ψ reallocation out of an Insight income it does not have
      // yet. Measured, REACH never opened, the one settled biome depleted under the fleet, and the
      // run starved to zero craft. Half the budget goes to work; half waits to see what is asked.
      if (num(s.cog.dCond) >= Math.floor(num(s.res.D) * PLAY.COND_SHARE)) return
      if (capWithOneMoreCond(s, g) >= want) g.allocate('cond', 1)
      return
    }
    // Every point is spent and the pool still cannot reach the price on screen. That is what
    // Reabsorption is for, and it is the only move left: the act's exit costs 1.6e6 Σ against a
    // capacity that scales as (1+dVes)^1.85, so a book of pure Conduction cannot pay it however
    // long it waits. The points come straight back and the next second starts re-spending them.
    //
    // But reallocating returns every point at once, so the capacity — and with it the clamp — drops
    // to its bare base and whatever the pool held is cut away. Doing that on a book that cannot
    // reach the price at ANY allocation is a sawtooth, not a plan: measured, it climbed to 1.4e6 Σ
    // and fell to 8.0e4 every seventy minutes for the rest of the run. So ask the question first —
    // would the whole budget in Vesicle actually clear it? — and only pay if the answer is yes.
    if (!g.respec || !g.respecCost) return
    if (num(s.res.insight) < num(g.respecCost(s))) return
    // REGENOME is the third claim on Insight and the largest — the cost grows with every one taken,
    // and by the void it is four figures. Measured, a run that had banked ENDING B's 3,600 Ψ (4,635
    // held at minute 606, every other row green or closing) spent 2,679 of it on a reallocation in
    // the following minute, dropped the pool from 2.85e6 Σ to 2.87e4 Σ on the same tick, and never
    // saw either number again inside the act. An ending outranks a tidier book.
    if (endgameSpare('insight') < num(g.respecCost(s))) return
    if (short) {
      if (capAtFullVesicle(s, g) < want) return
      g.respec()
      return
    }
    // The other half of the same question, and the one the stand-in never asked. Vesicle is bought
    // for headroom the player can name — but the name expires. Act II's exit wants 1.6e6 Σ *held*,
    // which forces the book to dVes 13, and nothing in Act III ever asks for a pool that large
    // again: the void's prices are 2,400–18,000 Σ against an Sc that the fleet's own Λ carries into
    // the millions. The points stayed where Act II left them, and because §9.4 fixes
    // timeToFill = 86.7·(1+dVes)^1.85/((1+0.35·dCond)·C·signalMult), dVes 13 is a 5,188-second pool.
    //
    // Measured, that one stale allocation is the whole of the missing endgame: across a 780-minute
    // run the pool saturated on no tick at all, so Insight — which accrues only while it is full —
    // came to 0 Ψ/min against ENDING A's 2,400 Ψ, and no ending could fire at any amount of carbon.
    // The same save with the surplus released (dVes 3, time-to-fill 277 s) saturates continuously,
    // ripens to 1.00 and makes 93 Ψ/min. Releasing it is not a cleverer strategy than the one the
    // policy above already states; it is that policy, applied when the price it was sized against
    // has been paid.
    var lean = leanestVes(s, g, want)
    if (lean < 0 || num(s.cog.dVes) < lean + PLAY.VES_SLACK) return
    // The reallocation is priced in Ψ and so is an act's exit. A saver holding a door has first
    // claim on Insight, exactly as `spendInsightOnLoci` does.
    if (saver && saver.isDoor && saver.wouldStarveDoor('psi', num(g.respecCost(s)))) return
    g.respec()
  }

  // The smallest Vesicle allocation that still clears `want` if the whole budget is behind it. −1
  // when no allocation clears it, which is the shortage branch's problem and not this one's.
  // Capacity does not read Conduction at all, so this is a search over one axis.
  function leanestVes (s, g, want) {
    var budget = num(s.res.D), v
    for (v = 0; v <= budget; v++) if (capAt(s, g, v, budget - v) >= want) return v
    return -1
  }

  // Sc under a hypothetical allocation, asked of cognition rather than re-derived here: the
  // capacity formula belongs to that module and a second copy would be a second thing to keep true.
  function capAt (s, g, ves, cond) {
    var v0 = s.cog.dVes, c0 = s.cog.dCond, l0 = s.cog.dLag
    s.cog.dVes = ves; s.cog.dCond = cond; s.cog.dLag = 0
    var cap = num(g.Sc(s))
    s.cog.dVes = v0; s.cog.dCond = c0; s.cog.dLag = l0
    return cap
  }

  function capAtFullVesicle (s, g) { return capAt(s, g, num(s.res.D), 0) }

  function capWithOneMoreCond (s, g) {
    return capAt(s, g, num(s.cog.dVes), num(s.cog.dCond) + 1)
  }

  // Whether the pool cannot hold what is on the board. While that is true, Insight has exactly one
  // job — paying for the reallocation that fixes it — and every other claim on it waits.
  //
  // Measured, this was the whole of Act III: the act opens with D freed and no Σ price in sight, so
  // the book went 26 points into Conduction; `appressorium` then arrived at 1,400 Σ against a
  // capacity of 488 Σ; the reallocation cost 1,576 Ψ; and the genome spent the Insight down to
  // three digits every time it crossed a hundred. REACH never opened, the one settled biome
  // depleted, n† fell under the standing fleet, and the run starved to zero craft with 6.81e14 Χ
  // banked and nothing left to spend it on.
  function poolShort (s) {
    var g = HY.cognition
    return !!g && !!g.Sc && num(g.Sc(s)) < poolWanted(s)
  }

  // The largest Σ price on the board. A pool that cannot reach it is a pool that makes a visible
  // entry permanently unbuyable however long the player waits.
  //
  // A pulse is deliberately NOT one of those prices, though this used to ask for one. `pulseCost`
  // is `0.55·Sc` — a fraction of the pool, not a number in Σ — so a pool can always afford a pulse
  // the moment it is full, and asking capacity to cover one is asking it to exceed 55% of itself.
  // Measured, that circularity was a floor under the whole Vesicle book: releasing the surplus
  // settled at dVes 9 rather than 0 because every point removed made the pulse it was sized against
  // cheaper by exactly as much, which held time-to-fill at 2,116 s and the pool below saturation
  // for the whole of the void.
  function poolWanted (s) {
    var pj = HY.projects, g = HY.cognition
    if (!pj || !pj.visible || !g || !g.Sc) return 0
    var want = 0
    var list = pj.visible(), i, pr
    for (i = 0; i < list.length; i++) {
      pr = pj.priceOf(list[i].id) || {}
      if (num(pr.sig) > want) want = num(pr.sig)
    }
    // Not every Σ price is a project. REACH is the one verb Act III cannot proceed without — as
    // X_0 depletes, n† falls under the standing fleet and the only answer is another biome — and
    // it is priced in Σ outside the catalog. A pool sized only against the visible cards reached
    // 1.74e3 Σ against a 2.60e3 Σ first REACH, and the fleet starved in the biome it could not
    // leave, twice, with the button on screen the whole time.
    if (s.phase === 'canopy' && HY.bloom && HY.bloom.reachCost && HY.bloom.canReach) {
      for (i = 1; i < 8; i++) {
        if (!HY.bloom.canReach(s, i)) continue
        if (num(HY.bloom.reachCost(s)) > want) want = num(HY.bloom.reachCost(s))
        break
      }
    }
    return want
  }

  // Act II's verbs. The act has no clicker at all — everything is a decision — so a stand-in that
  // only ticks the clock watches a saturated Signal pool do nothing for three hours.
  function playAct2 (s, o) {
    var n = 0
    allocateD(s)
    var sv = o.save === false ? null : saverFor(s)
    if (sv) sv.reserve(s, 1)
    if (o.projects !== false) n += buyProjects(sv)
    if (o.territory !== false) n += advanceFrontier(s, sv)
    if (o.flush !== false) { releaseRipe(s); knotPrimordium(s, sv) }
    if (o.pacts !== false) signPacts(s)
    if (o.kill !== false) killSpentStand(s)
    if (o.spores !== false) topUpSpores(s)
    return n
  }

  // The exit wants 4.0e8 ◦ held at the instant it is bought, and by fc ≥ 0.97 there is no canopy
  // left to fruit in — the only remaining source is Seed Bank's conversion, which is exactly what
  // it is priced at fc ≥ 0.90 for. Convert only the shortfall: every gram spent here is a gram
  // missing from the exit's 5.33e11 g leg.
  function topUpSpores (s) {
    var fl = HY.flush, pj = HY.projects
    if (!fl || !fl.convert || !pj || !pj.priceOf) return
    var price = pj.priceOf('ascospore_discharge')
    if (!price) return
    // One whole spore of headroom, because the conversion floors: a flush leaves a fractional
    // count, and asking for exactly the shortfall converted 113 g into floor(113/270) = 0 spores
    // forever. Measured, a run sat at 399,999,999.58 ◦ against a 4.0e8 ◦ price indefinitely.
    var short = num(price.spore) - num(s.res.spores) + 1
    if (!(short > 1)) return
    // Never at the cost of the gram leg: the bank has to clear both at once.
    var spare = num(s.res.biomass) - num(price.g)
    if (!(spare > 0)) return
    fl.convert(Math.min(spare, short * T().A2.SPORE_DIVISOR))
  }

  // The turn. Eighty per cent of the forest's carbon is alive (BIBLE M9), and `EXTRACT_TARGET` is
  // 4.00e12 g against an `L0_total` of 1.42e12 — so a run that only eats what has already fallen
  // tops out near fc 0.30 and stops. Measured, that is exactly what happened: all 61 stands claimed,
  // litter 99% spent, 4.06e12 g still standing, and the act frozen at fc 0.311 for four hours.
  //
  // A stand is killed only once its own litter is spent, which is both the least destructive order
  // available and the one the LEGACY term rewards: every stand still standing at ASCOSPORE is
  // 0.45·(ΣT/ΣT0) of the number that sets `fidelityBase` for the whole of Act III.
  var KILL_SPENT = 0.02          // L/L0 under which a stand has nothing left to give but its wood

  function killSpentStand (s) {
    var f = HY.forest
    if (!f || !f.killStand || !f.necrotized) return
    var r = s.a2 && s.a2.regions
    if (!r) return
    var i, worst = -1, wv = Infinity, l0, frac
    for (i = 0; i < r.flags.length; i++) {
      if (!(r.flags[i] & 0x04) || (r.flags[i] & 0x10)) continue    // claimed, not already dead
      l0 = num(r.L0[i])
      frac = l0 > 0 ? num(r.L[i]) / l0 : 0
      if (frac > KILL_SPENT) continue
      // Poorest first: the stand with the least standing wood costs the least LEGACY to take.
      if (num(r.T[i]) < wv) { wv = num(r.T[i]); worst = i }
    }
    if (worst >= 0) f.killStand(worst)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ACT III — the verbs, in the order the act reveals them
  // ───────────────────────────────────────────────────────────────────────────

  // Act III shares no verb with either act before it. Nothing here is a fallback: a stand-in that
  // reaches the void and keeps calling Act I's buttons sits on nothing at all — measured, `vis = 0`
  // and `carbon = 0` for five hours, because the act's first flag (`germ_tube`) is gated on
  // `n ≥ 2.0e8` and nothing had ever been settled.
  function playAct3 (s, o) {
    var n = 0
    allocateD(s)
    var sv = o.save === false ? null : saverFor(s)
    if (sv) sv.reserve(s, 1)
    if (o.projects !== false) n += buyProjects(sv)
    if (s.phase === 'canopy') settleAndReach(s, sv)
    if (o.triangle !== false) steerTriangle(s)
    if (o.genome !== false && !poolShort(s)) spendInsightOnLoci(s, sv)
    if (o.strains !== false) handleStrains(s)
    if (o.entrain !== false) entrainWorst(s)
    if (o.ending !== false) takeAnEnding(s)
    return n
  }

  // Phase A. SETTLE is the whole opening — it is the only thing that turns the spore bank into a
  // fleet — and REACH is the only thing that opens a second biome to grow into.
  //
  // But SETTLE is not free growth. BIBLE M13's closed form puts the surplus-maximising fleet at
  // n* = NCAP·(√(A/S) − 1) and carrying capacity at n† = NCAP·(A/S − 1), which is 9.2× larger, and
  // a fleet past n† dies faster than it breeds. Measured, emptying the whole spore bank into biome
  // zero took the fleet to 7.07e8 against an n* of about a tenth of that, and eighty seconds later
  // there were no craft and no spores left anywhere — an unrecoverable wipe-out in Phase A, where
  // ENCYST is not yet available. The bank is the reserve; it is settled up to the surplus peak and
  // no further.
  function settleAndReach (s, sv) {
    var b = HY.bloom
    if (!b) return
    if (b.settle && !overPeak(s, b)) b.settle(s)
    if (!b.canReach || !b.reach || !b.reachCost) return
    // Never out of the exit's reserve: ESCAPE is priced in Σ too.
    // Never out of the exit's reserve: ESCAPE VELOCITY is priced in Σ too.
    if (sv && sv.isDoor && sv.wouldStarveDoor('sig', num(b.reachCost(s)))) return
    for (var i = 1; i < 8; i++) if (b.canReach(s, i) && b.reach(i, s)) return
  }

  // Whether the standing fleet is past the point where another craft brings back less than it eats.
  var CROWDED = 1.10          // × Σn*, the margin the readout is steered to rather than the cliff

  function overPeak (s, b) {
    if (!b.nStar || !b.totalCraft) return false
    var star = 0, i
    var rows = s.phase === 'canopy' ? s.a3.biomes.n : s.a3.bands.n
    for (i = 0; i < rows.length; i++) star += num(b.nStar(i, s))
    return star > 0 && num(b.totalCraft(s)) > star * CROWDED
  }

  // The triangle. Past the peak, replication is turned nearly off rather than merely down: a fifth
  // of the surplus still going into new craft is enough to carry a fleet from n* to beyond n†,
  // which is where it stops producing and starts dying.
  function steerTriangle (s) {
    var b = HY.bloom
    if (!b || !b.setAlloc) return
    var a = overPeak(s, b) ? A3_ALLOC.CROWDED : A3_ALLOC.GROWING
    // Banking the whole surplus once every shell is reached looks like the right last move and is
    // not: measured, a run playing for ENDING B ends with all thirteen bands at 100.0% consumed —
    // the void's whole 1.04e36 Χ eaten — against 1.53e35 Χ banked, and the missing 85% is not
    // waste, it is the fleet that did the eating. Taking replication and dispersal to zero at that
    // point banked a larger share of a collapsing harvest: 1.48e35 Χ, worse by 3%, and ENDING A
    // arrived thirteen minutes later. The crowded triangle stands.
    // ENDING C's last row is `THEIRS ≥ 3 × yours`, and a fleet still replicating out of 70% of its
    // surplus outgrows lineages that started as a rounding error on it. Ceding is a decision about
    // the triangle before it is a decision about the button: replication goes to the floor and the
    // surplus is banked, which is also what pays for the carbon every ending wants.
    //
    // Not before there is something to cede to, and not before it can be read. C's mass row is
    // unmet from the first tick of the act — there is no Successor yet, so `wild ≥ 3 × mine` reads
    // false — and a run that took that as "stop replicating" never grew a fleet at all: measured,
    // it sat in the canopy at 2.56e14 Χ for the whole 780 minutes and ESCAPE VELOCITY was never
    // payable. Gating on the Successor alone was the same mistake one stage later: SEQUENCE is an
    // instrument priced at 8.0e28 Χ, a fleet that stops replicating stops earning carbon, and that
    // run finished on 1.30e23 Χ with SUCCESSOR, AGE and THEIRS green and SEQUENCED the only row
    // left. You cannot hand on what you never built, and you cannot name what you never read.
    if (wanted === 'C' && s.a3.succ && s.a3.succ.sequenced && endgameWants('mass')) a = A3_ALLOC.CEDING
    // Disperse only once there is somewhere to disperse to; before G4 the vertex does not exist and
    // bloom folds its share into BANK anyway, so asking for it early is not a mistake, only a no-op.
    b.setAlloc(a[0], a[1], a[2], s)
  }

  // aRep · aDis · aBank. Growing pays for the fleet that harvests; crowded stops feeding a band
  // that is past its own surplus peak and banks the carbon the endings are priced in.
  var A3_ALLOC = {
    GROWING: [0.70, 0.20, 0.10],
    CROWDED: [0.02, 0.38, 0.60],
    CEDING: [0.00, 0.20, 0.80]
  }

  // Ψ has exactly two homes in Act III: loci and the divergence economy. Loci first — every axis
  // multiplies a rate, and the genome tax is paid in craft mass rather than in Insight.
  function spendInsightOnLoci (s, sv) {
    var b = HY.bloom
    if (!b || !b.setLocus || !b.AXES) return
    var loci = s.a3.loci
    if (!loci) return
    // The door's reserve covers every currency it is priced in, not just grams and Σ. Insight was
    // the omission: `settleAndReach` already refuses to spend the exit's Signal, but nothing stopped
    // the genome spending the exit's Insight, and a locus is bought every second the budget allows.
    // Measured, a run held 108,657 Σ against an 80,000 Σ door and 15.27 Ψ against its Ψ leg,
    // because every point of Insight the act had produced was already in the genome.
    if (sv && sv.isDoor && sv.wouldStarveDoor('psi', num(b.nextLocusCost(s)))) return
    // The last door of all is an ending, and it is priced in Ψ too — 2,400 for A, 3,600 for B. It
    // never appears in the catalog, so no saver has ever guarded it, and the genome spent every
    // point the void produced: measured, a run that made 13,490 Ψ with the genome held still ended
    // a 780-minute run holding 309 Ψ with the genome running. An ending is not one claim on Insight
    // among several; from the moment the void opens it is the only one.
    //
    // The one exception is the axis the same ending named. An ending is a conjunction, and Insight
    // banked for one of its rows is worth nothing if another row needs Insight to close: measured,
    // a run playing for ENDING B reached 3,601 Ψ against its 3,600 Ψ row at minute 462 holding
    // Φ 0.9799 against 0.9850, and from that second the bank was one point deep, no locus was ever
    // affordable again, and the fidelity row could not move for the remaining 338 minutes. Ψ is a
    // flow — the void makes about 70 a minute while the pool is saturated — and Φ is a stock that
    // only the genome moves, so the flow yields to the stock and re-banks afterwards. It is bounded
    // by `favoured()` itself, which stops naming an axis the moment the row it was named for closes.
    var first = favoured()
    if (first < 0 && endgameSpare('insight') < num(b.nextLocusCost(s))) return
    // A locus is not free: craftMass = 2.40e6·(1+0.085·G)^1.15, so every point makes every craft
    // heavier to keep alive. Buying them into a fleet that is already at its surplus peak is
    // buying subsistence, and the peak is exactly where the margin to pay for it is thinnest.
    // The ending's own axis is exempt for the same reason: a fleet trimmed to its peak is still a
    // fleet with an ending it cannot reach.
    if (first < 0 && overPeak(s, b)) return
    // Round-robin, lowest axis first, so the genome stays broad. BIBLE M14: a perfectly specialised
    // genome produces perfectly specialised defectors with the same holes, and you cannot exploit a
    // hole you do not have.
    //
    // Broad is right for a run with no ending in mind. It is wrong for two of the three: fidelity
    // is `fidelityBase + 0.030·tFid − 0.038·tAnt + boughtFid`, so ENDING B's Φ ≥ 0.985 is bought on
    // the FID axis and spent on the ANT one, and ENDING C wants the opposite — a fidelity low
    // enough to keep producing the defectors it is about. Measured, a broad genome finished B's run
    // at Φ 0.979 against 0.985, one ANT point short of the ending, with every other row green.
    var lo = leastOf(loci, banned(), first)
    if (lo < 0) return
    b.setLocus(lo, num(loci[lo]) + 1, s)
  }

  // The genome's eight axes, in BIBLE §3's order: BAL GER MYC SPO MEL DOR FID ANT. Only the last
  // two are named here, because only the last two move fidelity.
  var AXIS_FID = 6, AXIS_ANT = 7

  // Φ held above ENDING B's requirement, so one reintegration cannot drop it back under. Two FID
  // points' worth: the axis is +0.030 each and the whole band is 0.30–0.9975 wide.
  var FID_MARGIN = 0.020

  function inVoidNow () {
    var s = S()
    return !!s && s.act === 3 && s.phase === 'void'
  }

  // The axis this run will not spend on at all. B's Φ ≥ 0.985 is −0.038 per ANT point, so one is
  // enough to put the ending out of reach; C is about producing defectors and FID is what stops
  // them existing.
  function banned () {
    if (wanted === 'B') return AXIS_ANT
    if (wanted === 'C') return AXIS_FID
    return -1
  }

  // The axis this run fills first, while it is still buying something the ending named — and only
  // while. A fixed quota was wrong in both directions: four FID points carried ENDING B's fidelity
  // to 0.998 against a 0.985 requirement, and the three wasted points are three the harvest axes
  // did not get, which is why that run banked 1.51e35 Χ against a 1.60e35 Χ gate. Fidelity is
  // bought until it is bought, then the genome goes back to being broad (BIBLE M14).
  //
  // C's is later still. Sequencing is an instrument priced at 8.0e28 Χ, and an ANT-first genome
  // reaches Φ 0.735 inside the first hour of the act: measured, the lineages ate the fleet that was
  // meant to pay for the instrument, carbon stopped at 2.02e24 Χ, and SEQUENCED was the one row of
  // four that never went green. Grow, buy the instrument, and only then become worth defecting from.
  function favoured () {
    // A margin, not a threshold. Fidelity is not a stock the genome alone sets: ABSORB books a
    // permanent fidelity debt, so a book that stops buying FID the tick the row goes green watches
    // the next reintegration take it back. Measured, a run holding every other ENDING B row —
    // 1.56e35 Χ, 3,722 Ψ, ϒ 0.9998, no lineage, no Successor — finished at Φ 0.9759 against 0.9850,
    // having been over it an hour earlier.
    // And not before the void. Φ is only ever read by the ending, while Phase A is a planet that
    // has to be eaten to 97% before ESCAPE VELOCITY exists at all — and fidelity does nothing for
    // harvest. Measured, a book that started filling FID with the act's first locus never left the
    // canopy: 8.61e13 Χ at minute 780 against an ESCAPE gate of 9.0e17, in a run whose sibling with
    // the same target banked 1.52e35.
    if (wanted === 'B') {
      if (!inVoidNow()) return -1
      return endgameSpare('fidelity') < FID_MARGIN ? AXIS_FID : -1
    }
    if (wanted === 'C') {
      return HY.projects && HY.projects.isBought && HY.projects.isBought('sequencer') ? AXIS_ANT : -1
    }
    return -1
  }

  // The lowest axis the run is willing to spend on: `first` is filled ahead of everything else,
  // `ban` is never filled at all. −1 when every axis is banned, which these rules never do.
  function leastOf (loci, ban, first) {
    var i, lo = -1
    if (first >= 0) return first
    for (i = 0; i < loci.length; i++) {
      if (i === ban) continue
      if (lo < 0 || num(loci[i]) < num(loci[lo])) lo = i
    }
    return lo
  }

  // The allele economy, which is the only source of the locus cap. PURGE and ABSORB both pay; a
  // strain left alone pays nothing and eats the bands it sits in.
  //
  // Unless the run is playing for THE INHERITANCE, in which case a strain left alone is the whole
  // point: ENDING C wants a Successor — which forms only from two or more living lineages holding
  // more mass than you — aged half an hour, sequenced, and finally three times your size. Killing
  // them is how the other two endings are reached and is exactly what makes C unreachable.
  function handleStrains (s) {
    var d = HY.divergence
    if (!d || !d.strains) return
    if (wanted === 'C') { inherit(s, d); return }
    var list = d.strains(s)
    if (!list || !list.length) return
    var id = list[0].id
    // ABSORB is priced in Ψ and Σ, and the ending is priced in Ψ. α bought with the ending's
    // Insight is α that costs the run its ending, so the free verb is the only one available until
    // the bank is clear of it.
    var psi = d.absorbCost ? num(d.absorbCost(s).psi) : Infinity
    if (endgameSpare('insight') >= psi && d.absorb && d.absorb(id)) return
    if (d.purge) d.purge(id)
  }

  // ENDING C's four rows, in the order they can be worked. Nothing here fights: the lineages are
  // left to grow, the Successor is sequenced the moment the instrument exists, and replication is
  // turned down so that what they hold can pass what you do.
  function inherit (s, d) {
    var succ = s.a3.succ
    if (succ) {
      if (!succ.sequenced && d.sequence) d.sequence('succ')
      return
    }
    // Before coalescence, defend — until the instrument is bought. SEQUENCE is priced at 8.0e28 Χ
    // and carbon is harvested by craft, so a run that stops defending on the act's first defector
    // is handing the void to lineages while it still has an instrument to buy: measured, peak fleet
    // 1.50e19 against a healthy act's 2.50e25, carbon stalled at 3.97e27, and SEQUENCED was the one
    // row of C's four that never went green in 780 minutes. Feed them once you can read them.
    if (HY.projects && HY.projects.isBought && HY.projects.isBought('sequencer')) return
    var list = d.strains(s)
    if (list && list.length && d.purge) d.purge(list[0].id)
  }

  // The last twenty minutes. ENTRAIN is never automated by any project (D77) and is the only thing
  // that raises ϒ, so a stand-in that never fires one cannot reach ENDING A or B at any amount of
  // carbon. The verb is a PULSE, not a direct write — the light-lag delivery in finale.onPulse is
  // the mechanic — so the stand-in fires the pulse and lets the act resolve it.
  //
  // It stops as soon as ϒ is over the ring, and that is not tidiness: a pulse costs 0.55·Sc, which
  // always breaks saturation, and ENDING A wants 1.10e7 Σ *held*. The last thing the run has to do
  // is stand still for one full time-to-fill while ϒ decays. Nothing announces that; it is the
  // tightest trade in the game (BIBLE §6 M15) and the policy has to respect it.
  function entrainWorst (s) {
    var f = HY.finale, g = HY.cognition
    if (!f || !f.wheel || !g || !g.pulse) return
    var w = f.wheel(s)
    if (!w || !w.live || !w.mass || !w.mass.length) return
    if (num(w.upsilon) >= num(w.ring)) return
    // Synchrony is bought with the same seconds Insight is, and it is bought second. A pulse costs
    // 0.55·Sc and therefore always breaks saturation; Insight accrues only while the pool is full.
    // So while the ending's Ψ leg is still short, every pulse is a withdrawal from the condition
    // that takes hours against one that takes minutes — ϒ climbs from its free-running 0.31 to over
    // the ring inside about fifteen minutes of pulses and decays back in twenty, whereas 2,400 Ψ is
    // an hour of standing still. Measured, a stand-in that pulsed on sight held ϒ at 1.00 for two
    // hours and finished a 780-minute run on 309 Ψ, with carbon and bands long since green.
    //
    // This is `03` §19.4's last twenty minutes read in the only order that closes: bank the waiting
    // currency first, then spend the pool on the phase lock, then stand still for one time-to-fill.
    if (endgameWants('insight')) return
    // Epicentre: the heaviest band. `0.82^d` falloff means the pulse pulls hardest where it lands,
    // and landing it on the fleet's centre of mass moves the resultant instead of chasing it.
    var epi = 0, i
    for (i = 1; i < w.mass.length; i++) if (num(w.mass[i]) > num(w.mass[epi])) epi = i
    g.pulse('ENTRAIN', epi)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WHICH ENDING THIS RUN IS FOR
  // ───────────────────────────────────────────────────────────────────────────

  // '' | 'A' | 'B' | 'C', set by play()'s `want` option. Empty is the honest default and the one a
  // first run is in: walk toward whichever ending is nearest and take it when it lights.
  //
  // Naming one is not a cheat code — it is the only way a stand-in can express the thing D27 is
  // about. The three endings are mutually exclusive from roughly forty minutes into the void (`03`
  // §20) because they want opposite things of the same two verbs: B wants every lineage killed and
  // the genome's FID axis; C wants them fed, sequenced and eventually larger than you, which needs
  // the ANT axis and a fidelity low enough to keep producing defectors. A policy with no target
  // does one of those by accident and can never do the other, so a bot without this option cannot
  // reach two of the three endings however long it is run for — which is a fact about the harness,
  // not about the game.
  var wanted = ''

  // The row the run is playing toward, with its unmet conditions. Without a target this is the
  // game's own "nearest ending" readout.
  function targetEnding (s) {
    var f = HY.finale
    if (!f || !f.endingAvailable) return null
    if (!wanted) return f.endingAvailable(s)
    if (!f.endings) return f.endingAvailable(s)
    var list = f.endings(s), i
    for (i = 0; i < list.length; i++) if (list[i].key === wanted) return list[i]
    return null
  }

  // Whether the ending this run is walking toward is still short of a named condition. `finale`
  // already reports exactly that, so the policy reads the game's own readout rather than keeping a
  // second opinion about what an ending costs.
  function endgameWants (id) {
    var e = targetEnding()
    if (!e || e.taken || !e.unmet) return false
    return e.unmet.indexOf(id) >= 0
  }

  // How much of a stock the ending does not need, which is the only part of it that may be spent.
  //
  // A threshold is not enough here and the difference cost a measured run its ending: gating the
  // genome on "the Ψ row is unmet" stops spending at 3,599 Ψ and resumes at 3,601, so the stand-in
  // banked ENDING B's 3,600 Ψ at minute 541, spent 2,162 of it on loci in the same minute, and was
  // holding 1,440 Ψ at minute 591 when the carbon row finally went green — with synchrony at 1.00
  // and every other condition met. The ending is a price, so it is banked like one.
  function endgameSpare (id) {
    var e = targetEnding()
    if (!e || e.taken || !e.conditions) return Infinity
    var i, row
    for (i = 0; i < e.conditions.length; i++) {
      row = e.conditions[i]
      if (row.id === id) return num(row.have) - num(row.want)
    }
    return Infinity
  }

  // The run ends when an ending is available. Which one is not chosen: `endingAvailable` reports
  // the first that has cleared its conditions, and the conditions are what the run's own build
  // decided several hours earlier.
  function takeAnEnding (s) {
    var f = HY.finale
    if (!f || !f.takeEnding) return
    // With a target named, only that one is taken. A run playing for C reaches A's conditions on
    // the way past — carbon and bands are common to both — and a stand-in that presses the first
    // lit button proves nothing about the other two endings.
    var e = targetEnding(s)
    if (e && e.available && !e.taken) f.takeEnding(e.id)
  }

  // A slot that is not knotted is a slot earning nothing, and the stake is the decision rather
  // than the timing — the estimator handles the timing.
  //
  // Not before the third stand, though. Act II opens on one region at d = 0.30, and until the
  // board is wider than that the whole book is the bootstrap: measured, staking a tenth of it on
  // fruiting held the run at one stand for two hours, because `chemotaxis` needs 400 Σ, 400 Σ
  // needs a vesicle, a vesicle needs `differentiation`, and that needs cumulative mass the
  // fruiting was eating.
  var FLUSH_STAKE = 0.05
  var FLUSH_AFTER_CLAIMED = 3

  function knotPrimordium (s, sv) {
    var fl = HY.flush
    var f = HY.forest
    var w = HY.world
    if (!fl || !fl.newPrimordium || !f || !f.canopy) return
    if (!w || !w.claimedCount || w.claimedCount(s) < FLUSH_AFTER_CLAIMED) return
    if (fl.used() >= fl.slots()) return
    var r = s.a2 && s.a2.regions
    if (!r) return
    // A stake is a purchase, and it answers to the bank like every other one. It is the only spend
    // in the act that was not: measured, the act's exit sat affordable-but-for-grams while the
    // stand-in staked a twentieth of its remaining biomass on a fresh primordium every few seconds
    // into a forest with no canopy left to fruit in — 6.4e11 g at fc 0.99 down to 7.8e10 by the
    // time the pool had refilled, and the transition was never payable again.
    var stake = num(s.res.biomass) * FLUSH_STAKE
    if (sv && sv.bankG > 0 && num(s.res.biomass) - stake < sv.bankG) return
    var best = -1, bv = -1, i
    for (i = 0; i < r.flags.length; i++) {
      if (!(r.flags[i] & 0x04) || (r.flags[i] & 0x10)) continue
      var c = num(f.canopy(i, s))
      if (c > bv) { bv = c; best = i }
    }
    if (best >= 0) fl.newPrimordium(best, stake)
  }

  // Offers expire. A book that never signs earns no Accord, and Accord is the only currency in
  // the act that cannot be bought with anything else.
  function signPacts (s) {
    var pb = HY.pactbook
    if (!pb || !pb.offers || !pb.sign) return
    var list = pb.offers(), i
    for (i = 0; i < list.length; i++) {
      if (list[i].affordable && pb.sign(list[i].id)) return
    }
    void s
  }

  // Cheapest frontier region first, then density on what is already held: the same order the
  // STANDS list already sorts into, and the one `08` §4.4 prices for.
  function advanceFrontier (s, sv) {
    var w = HY.world
    if (!w || !w.list) return 0
    var list = w.list(s), n = 0, i, c
    for (i = 0; i < list.length; i++) {
      c = list[i]
      if (c.claimed || !c.advance || c.advance.blocked) continue
      if (!(num(s.res.biomass) >= c.advance.cost)) continue
      if (sv && sv.bankG > 0 && num(s.res.biomass) - c.advance.cost < sv.bankG) continue
      if (w.startAdvance(c.id)) { n++; break }
    }
    for (i = 0; i < list.length; i++) {
      c = list[i]
      if (!c.density) continue
      if (!(num(s.res.biomass) >= c.density.cost)) continue
      if (sv && sv.bankG > 0 && num(s.res.biomass) - c.density.cost < sv.bankG) continue
      if (w.buyDensity(c.id)) { n++; break }
    }
    return n
  }

  // Release at the estimator's own optimum: `flush.card` already reports when the expected yield
  // peaks, and waiting past it is negative EV by construction (`02` §7.5).
  function releaseRipe (s) {
    var fl = HY.flush
    if (!fl || !fl.list) return
    var list = fl.list(), i
    for (i = 0; i < list.length; i++) {
      if (list[i].held) continue
      if (list[i].bestIn <= 0 && list[i].now > 0) fl.release(list[i].id)
    }
    void s
  }

  // Tips are never routine, however cheap one is. A project is bought once and its multiplier is
  // permanent; a tip is an unbounded sink with a superlinear price, and a stand-in allowed to treat
  // it as routine spends every gram on the next tip forever. Measured: exempting tips from the bank
  // walked the network to the 400-tip assertion cap and pushed DECIDE from 250 minutes to 510,
  // because nothing was ever banked toward the exit chain.
  function affordsTip (s, goal) {
    var a1 = HY.act1
    var g = num(s.res.biomass) - a1.tipCost() * PLAY.TIP_MARGIN
    if (!(g >= 0)) return false
    if (goal && goal.g > 0 && g < goal.g) return false
    if (goal && goal.min > 0) {
      var m = num(s.res.minerals) - a1.tipMineralCost(num(s.a1.tips) + 1)
      if (m < goal.min) return false
    }
    return true
  }

  // The one-way doors the harness is allowed to walk through. Everything else tagged
  // `irreversible` is a decision the design wants a human to weigh — a trap, a fork, a
  // rule change or an ending — and a stand-in that takes them all is not modelling a
  // player, it is vandalising the run. `autolysis` in particular is free and re-armable,
  // so a blind buyer re-buys it the instant tips pass 40 and holds the network at 40
  // tips against a 255-tip handoff, which is exactly how Act I became unleavable.
  //
  // `necrotrophic_conversion` joins them because it is not a fork, it is the act's second half:
  // BIBLE M9 requires killing at least 46% of the standing forest to reach `EXTRACT_TARGET`, and a
  // stand-in that declines the verb freezes at fc 0.31 with nothing left to eat.
  var TAKES_DOOR = {
    decide: 1, ascospore_discharge: 1, escape_velocity: 1, necrotrophic_conversion: 1
  }

  // What a door cannot be paid without. Both of Act II's are priced in the same currencies the
  // exit is, so guarding the exit's bank against everything also guarded it against these — and
  // without them the exit is not merely slower, it is arithmetically unreachable:
  //
  //   photoreception  the only thing holding Sc up once the forest is eaten; without it the pool
  //                   caps at ~9e4 Σ against a 1.6e6 Σ price, at every allocation of D
  //   seed_bank       the only source of spores after fc ≥ 0.97, when there is no canopy left to
  //                   fruit in; without it the held 4.0e8 ◦ decays away instead of accumulating
  //
  // Both are cheap beside the exit and both are on the board before it is. A player buys them.
  var EXIT_CHAIN = { ascospore_discharge: ['photoreception', 'seed_bank'] }

  function isOneWay (p) {
    return p.kinds && p.kinds.indexOf('irreversible') >= 0 && !TAKES_DOOR[p.id]
  }

  // Cheapest-first, which is the order `visible()` already sorts into, and one
  // pass per second so a purchase that reveals another waits a beat — the same
  // rhythm the player reads the panel at.
  function buyProjects (sv) {
    var pj = HY.projects
    if (!pj || !pj.visible || !pj.purchase) return 0
    var list = pj.visible(), n = 0, i, p
    for (i = 0; i < list.length; i++) {
      p = list[i]
      if (!p.buyable || isOneWay(p)) continue
      if (pj.affordRatio(p) > 1) continue
      if (sv && sv.blocks(p)) continue
      if (starvesPhase(p)) continue
      if (pj.purchase(p.id)) n++
    }
    return n
  }

  // The one Act III purchase that has to be saved for, and the only currency in the act that a
  // purchase cannot be waited out of.
  //
  // Minerals are never produced in Act III (BIBLE §2.1) — every ⛬ spent there comes out of the
  // quarter that survived ASCOSPORE and is never replaced. Three void entries want them: 2,400 for
  // a radiation warning, 3,600 for a richness floor, and 6,000 for `circadian_entrainment`, which
  // is the PHASE system, the wheel and the ENTRAIN verb. `visible()` is sorted cheapest-first, so a
  // buyer working down the list spends 6,000 ⛬ on the first two and can never afford the third.
  //
  // Missing the third does not cost a multiplier, it costs the act: without PHASE the wheel is not
  // live, ϒ reads its free-running 0.31 forever, and ENDING A and ENDING B are unreachable at any
  // amount of carbon. Measured, a run met every other row of ENDING B — 1.63e35 Χ against 1.60e35,
  // 5,724 Ψ against 3,600, Φ 0.995 against 0.985, no lineage and no Successor — and finished at
  // ϒ 0.310, having spent its 6,000 ⛬ on the warning and the floor at minute 430.
  var PHASE_GATE = 'circadian_entrainment'

  function starvesPhase (p) {
    var s = S(), pj = HY.projects
    if (!s || s.act !== 3 || p.id === PHASE_GATE) return false
    var gate = pj.byId(PHASE_GATE)
    if (!gate || !gate.buyable || pj.isBought(PHASE_GATE)) return false
    var need = num((pj.priceOf(PHASE_GATE) || {}).min)
    if (!(need > 0)) return false
    return num(s.res.minerals) - num((pj.priceOf(p.id) || {}).min) < need
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

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — the harness policy, which is the thing that decides whether a run
  // can leave Act I at all. Everything here is an assertion about the stand-in's
  // *behaviour*, not about the existence of a function.
  // ───────────────────────────────────────────────────────────────────────────

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }
    var pj = HY.projects
    if (!pj || !pj.byId) return ['projects.js is absent; the harness policy cannot be checked']

    // ── one-way doors ────────────────────────────────────────────────────────
    // The act transition is taken; every other irreversible entry is a decision left alone.
    // `autolysis` is the one that mattered: free, re-armable, −20% tips, and a blind buyer
    // re-armed it forever and held the network at 40 tips against a 255-tip handoff.
    var mustTake = ['decide']
    var mustLeave = ['autolysis', 'forward_contracts', 'perennial_mycelium', 'ghost_pipe_compact',
      'the_charter', 'total_conversion', 'quiescence']
    var i, p
    for (i = 0; i < mustTake.length; i++) {
      p = pj.byId(mustTake[i])
      if (!p) { f.push('missing project ' + mustTake[i]); continue }
      ok(!isOneWay(p), 'the harness refuses the act transition ' + mustTake[i])
    }
    for (i = 0; i < mustLeave.length; i++) {
      p = pj.byId(mustLeave[i])
      if (!p) { f.push('missing project ' + mustLeave[i]); continue }
      ok(isOneWay(p), 'the harness would blindly buy the one-way door ' + mustLeave[i])
    }

    // ── the saver banks, and the bank is what blocks ─────────────────────────
    var fake = {
      res: { cumBiomass: 0, biomass: 1000, minerals: 100 },
      stats: { mineralEarned: 0 },
      act: 1
    }
    var sv = new Saver(1, fake)
    sv.pick = function () { return { g: 500, min: 40 } }        // a fixed goal, so the bank is the test
    ok(sv.reserve(fake, 1).g === 0, 'the bank is not empty before any income arrives')
    fake.res.cumBiomass = 200
    fake.stats.mineralEarned = 20
    var r1 = sv.reserve(fake, 1)
    ok(Math.abs(r1.g - 200 * PLAY.SAVE_RATE) < 1e-9,
      'the bank does not take SAVE_RATE of new income: got ' + r1.g)
    ok(Math.abs(r1.min - 20 * PLAY.SAVE_RATE) < 1e-9,
      'the mineral bank does not take SAVE_RATE of new income: got ' + r1.min)
    // It never banks past the goal, and never past what is actually held.
    fake.res.cumBiomass = 1e9
    fake.stats.mineralEarned = 1e9
    var r2 = sv.reserve(fake, 1)
    ok(r2.g === 500 && r2.min === 40, 'the bank overshot the goal it is saving for')
    fake.res.biomass = 120
    ok(sv.reserve(fake, 1).g === 120, 'the bank survived a purchase that spent it')

    // Half of income compounds: a tip is affordable while the float clears the bank, and only
    // then. Refusing every tip until the goal's whole price is on hand starved the engine that
    // pays for it — measured, that policy held the network at 19 tips for a hundred minutes.
    if (HY.act1 && HY.act1.tipCost) {
      var stub = { res: { biomass: 0, minerals: 1e6 }, a1: { tips: 0 } }
      var cost = 100
      var saved = HY.act1.tipCost
      var savedMin = HY.act1.tipMineralCost
      HY.act1.tipCost = function () { return cost }
      HY.act1.tipMineralCost = function () { return 0 }
      stub.res.biomass = cost * PLAY.TIP_MARGIN + 40
      ok(affordsTip(stub, { g: 0, min: 0 }), 'a tip is refused with no bank and the price in hand')
      ok(affordsTip(stub, { g: 30, min: 0 }), 'a tip is refused with the bank covered')
      ok(!affordsTip(stub, { g: 60, min: 0 }), 'a tip was bought out of the bank')
      HY.act1.tipCost = saved
      HY.act1.tipMineralCost = savedMin
    }

    // ── the goal is sticky ───────────────────────────────────────────────────
    // Re-choosing the cheapest unaffordable entry every second made the bot oscillate: the moment
    // the bank made something affordable it stopped being the goal, and the next goal's bank
    // blocked the purchase the old bank had been saving for.
    var sv2 = new Saver(1, fake)
    var ratio = 4
    var stubPj = {
      visible: function () { return [{ id: 'a', buyable: true, kinds: [] }] },
      affordRatio: function () { return ratio },
      priceOf: function () { return { g: 10 } },
      isBought: function () { return false },
      byId: function (id) { return { id: id, buyable: true, kinds: [] } }
    }
    var realPj = HY.projects
    HY.projects = stubPj
    sv2.pick(1)
    ok(sv2.id === 'a', 'the saver did not adopt the only unaffordable entry')
    ratio = 0.5                                   // now affordable: it must stay the goal
    sv2.pick(1)
    ok(sv2.id === 'a', 'the saver dropped its goal the instant the goal became affordable')
    stubPj.isBought = function () { return true }
    sv2.pick(1)
    ok(sv2.id === null, 'the saver kept saving for something it had already bought')
    // Patience is bounded: a goal that stops closing is abandoned, so nothing unreachable stalls.
    var sv3 = new Saver(1, fake)
    stubPj.isBought = function () { return false }
    ratio = 3
    sv3.pick(1)
    sv3.pick(PLAY.SAVE_STALE_S + 1)
    ok(sv3.dead.a === 1, 'a goal that never gets closer is never abandoned')
    HY.projects = realPj

    return f
  }

  function selftest () {
    var names = ['core', 'state', 'log', 'projects', 'act1', 'economy1', 'ui', 'canvas', 'feel',
      'cognition', 'world', 'forest', 'flush', 'pactbook', 'loop', 'bloom', 'divergence', 'finale']
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
    reinitModules: reinitModules,
    get running () { return running },
    get ticks () { return tickNo },
    __selftest: __selftest
  }

  HY.debug = {
    fastForward: fastForward,
    play: play,
    selftest: selftest,
    // What the stand-in is currently saving for, so a run that stalls can be read
    // rather than guessed at.
    saver: function () {
      return saver ? { goal: saver.id, g: saver.bankG, min: saver.bankMin, stale: saver.stale } : null
    }
  }
  HY.boot = boot
})(window.HY = window.HY || {})
