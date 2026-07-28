;(function (HY) {
  'use strict'

  // M12 · cognition.js — the shared mind (BIBLE §6 M12).
  //
  // Owns: Signal production and its hard capacity, the clamp, saturation, ripeness, Insight,
  // Differentiation (the ladders, allocation and respec) and PULSE — in every act that has them.
  //
  // Does NOT own: the interface term itself. Act II's Σ liveInterface belongs to `forest`, Act III's
  // Λ belongs to `bloom`, and connectivity C belongs to `world`. This file asks for those three
  // numbers and owns everything that happens to them afterwards, which is what lets one set of
  // formulas straddle two acts built on unrelated resource bases.
  //
  // The one identity that must survive both acts (BIBLE §9.4):
  //
  //     timeToFill = Sc/Sr = 86.7 · (1+dVes)^1.85 · capMult
  //                          ─────────────────────────────────────
  //                          C · (1+0.35·dCond) · signalMult · prestigeGrowth
  //
  // The interface term appears in Sr and Sc with the same exponent and cancels, so time-to-fill does
  // not depend on the size of the forest or the fleet. 260/3.00 and 364/4.20 are both 86.667, and
  // that is not a coincidence — it is the reason three hours of Act II intuition transfers to Act III
  // unchanged. If a change breaks the identity the change is wrong; __selftest() asserts it directly.
  //
  // Numbers: everything crossing a module boundary is in HY.core.TUNE. What lives below is the Act I
  // foreshadow coefficient, the pulse-mode table (durations, unlock flags, cooldown steps) and the
  // two Differentiation ladders — tables no other module reads, and which move as a unit or not at
  // all.

  // ───────────────────────────────────────────────────────────────────────────
  // LAZY MODULE ACCESS — load order must not matter for anything except `core`
  // ───────────────────────────────────────────────────────────────────────────

  function C () { return HY.core }
  function T () { return HY.core.TUNE }
  function S () { return HY.state.state }

  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }
  function flagOn (s, id) { return !!(s && s.proj && s.proj.flags && s.proj.flags[id]) }

  function feel (ev, params) {
    if (HY.feel && HY.feel.feel) HY.feel.feel(ev, params)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DATA TABLES
  // ───────────────────────────────────────────────────────────────────────────

  // Act I's Signal foreshadow. `01` §11.1 B: `conduction` "becomes a live number that rises with
  // hyphae", and §11.1 fixes the whole content of the beat — Signal accrues for **8–15 minutes**
  // with nothing to spend it on, against the 1,000 Σ DECIDE gate (A1.DECIDE_SIGNAL).
  //
  // The shape is Act II's, one act early, with hyphae standing in for live interface: writing a
  // second, differently-shaped rate here would mean the player learns one curve and then has it
  // replaced, and the whole point of the beat is that the number they are watching is the number
  // Act II is made of.
  //
  //   ell = hyphae / HYPHAE_GATE                       1.00 at the Anastomosis gate
  //   Sr  = A1_SIG_K · (0.60 + ell)^0.85 · signalMult · prestigeGrowth
  //
  // The reachable band is narrow because Act I's hyphae are: 1.75·tips + 30·(patches−1), with tips
  // asserted at ≤ 400 and patches at ≤ 6, so hyphae runs 500 m (the gate) to 850 m (everything
  // bought). At 0.85 that is
  //
  //   hyphae  500 m → Sr 1.267 Σ/s → 1,000 Σ in 13 m 09 s
  //   hyphae  596 m → Sr 1.396 Σ/s → 1,000 Σ in 11 m 56 s     (the normative handoff network)
  //   hyphae  850 m → Sr 1.726 Σ/s → 1,000 Σ in  9 m 39 s
  //
  // — the entire reachable range inside 8–15 minutes, with no cliff at either end, and a player who
  // keeps growing during the wait is rewarded rather than merely waiting.
  var A1_SIG_K = 0.85

  // PULSE (`02` §11.2, `03` §17). `dur` is the seconds the mode's window stays open after arrival;
  // an instantaneous mode has dur 0 and does all its work in the arrival hook. `flag` is per act
  // because RECRUIT and SURGE exist in both and are bought twice. A null flag means the mode is
  // inherited and needs no purchase.
  var MODES = {
    SURGE: { dur: 30, flag: { 2: 'action_potential_ii', 3: null } },
    REPEL: { dur: 60, flag: { 2: 'antibiosis' } },
    RECRUIT: { dur: 60, flag: { 2: 'septal_gating', 3: 'recruit' } },
    BLOOM: { dur: 20, flag: { 2: 'synchronous_flush' } },
    ENCYST: { dur: 30, flag: { 3: 'neutrino_precursor' } },
    ANTAGONISE: { dur: 25, flag: { 3: 'antagonise' } },
    ENTRAIN: { dur: 0, flag: { 3: 'circadian_entrainment' } }
  }

  // Cooldown ladders, cheapest first: the first owned flag wins. Act II 120 → 75 → 45,
  // Act III 75 → 50 → 35. The bases are TUNE (A2.PULSE_CD, A3.PULSE_CD); the steps are here
  // because they are project consequences and nothing outside this module reads them.
  var CD_STEPS = {
    2: [{ flag: 'saltatory_conduction', s: 45 }, { flag: 'septal_gating', s: 75 }],
    3: [{ flag: 'isochrony', s: 35 }, { flag: 'saltatory_conduction_void', s: 50 }]
  }

  // D57: SLOW doubles every timer-driven deadline, pulse cooldowns included (`06` §8.2), and
  // changes no rate. It is the accessibility setting, not a difficulty one.
  var SLOW_DEADLINE = 2

  // The Act II ladder is the Lucas sequence L(1)=1, L(2)=3 (`02` §4.5), read from L(2) so the first
  // rung is 3 — scaled by A2.D_LADDER_SCALE, which already carries ACT2_SCALE. Nineteen rungs; the
  // last sits above EXTRACT_TARGET and is reachable only on a slow, high-legacy run.
  var D_RUNGS_2 = 19
  var LUCAS = buildLucas(D_RUNGS_2)

  function buildLucas (n) {
    var out = [], a = 1, b = 3, i, t
    for (i = 0; i < n; i++) { out.push(b); t = a + b; a = b; b = t }
    return out
  }

  // The Act III ladder runs on cumCarbon and grows at φ³ (`03` §9.5). Twelve rungs: 29 carried plus
  // 12 plus 4 flavour projects is exactly D_MAX.
  var D3_BASE = 8.00e26
  var D3_PHI3 = 4.2360679
  var D_RUNGS_3 = 12

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE-LOCAL DERIVED STATE — nothing here is saved (§3.1 R1)
  // ───────────────────────────────────────────────────────────────────────────

  // How many rungs of each ladder have already been paid out. Both are functions of a monotone
  // stock (cumBiomass, cumCarbon), so they are recomputed on init and on any act change rather than
  // stored: a reloaded save re-derives exactly the same count and cannot double-grant.
  var granted2 = 0
  var granted3 = 0

  // The act cognition last stepped, so the I→II boundary can be seen from inside step 9. See
  // openMind() for why that boundary is this module's business.
  var lastAct = 0

  // Offline Insight is capped at OFFLINE.INSIGHT_CAP_S seconds of saturated production (`02` §14.4).
  // The cap is spent in simulated seconds rather than applied as a closing min(), because a
  // reconcile is 240 real simTicks and there is no closing moment to apply it at.
  var offlineSat = 0
  var wasOffline = false

  // ───────────────────────────────────────────────────────────────────────────
  // THE INTERFACE TERM — asked for, never computed here
  // ───────────────────────────────────────────────────────────────────────────

  // Act I's `conduction`: the readout `01` §11.1 promises under HYPHAE, in units of the finale gate,
  // so it reads 1.00 at the moment Anastomosis becomes affordable.
  function conduction (s) {
    var st = s || S()
    if (!st) return 0
    var h = HY.act1 && HY.act1.hyphae ? num(HY.act1.hyphae(st)) : 0
    return h / T().A1.HYPHAE_GATE
  }

  // Σ liveInterface (Act II) is forest's, Λ (Act III) is bloom's. Both are read through the module
  // surfaces BIBLE §6 names, feature-detected, so cognition boots and runs in a build where neither
  // has been concatenated yet — which is the state Act I ships in.
  function interfaceSum (s) {
    if (s.act === 3) return HY.bloom && HY.bloom.Lambda ? num(HY.bloom.Lambda()) : 0
    if (s.act === 2) return HY.forest && HY.forest.totalInterface ? num(HY.forest.totalInterface()) : 0
    return conduction(s)
  }

  // C = 1 + 0.14·(edges/nodes)^1.25, and it is world's. Act I has no geography and Act III's bands
  // are a line, so both read 1.00 — which is also the value that makes the timeToFill identity above
  // exact in Act III.
  function connectivity (s) {
    if (s.act !== 2) return T().A2.CONN_MIN
    if (!(HY.world && HY.world.connectivity)) return T().A2.CONN_MIN
    return C().clamp(num(HY.world.connectivity(s)), T().A2.CONN_MIN, T().A2.CONN_MAX)
  }

  // (0.60 + Σℓ)^0.85 — the one bracket shared by Sr and Sc, in both acts, so that it cancels.
  function ifaceTerm (s) {
    var A = T().A2
    return Math.pow(A.IFACE_BASE + Math.max(0, interfaceSum(s)), A.IFACE_EXP)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SIGNAL — rate and capacity
  // ───────────────────────────────────────────────────────────────────────────

  function sigK (s) {
    if (s.act === 3) return T().A3.SIG_K3
    if (s.act === 2) return T().A2.SIG_K
    return A1_SIG_K
  }

  function sigCapBase (s) {
    if (s.act === 3) return T().A3.SIG_CAP3
    if (s.act === 2) return T().A2.SIG_CAP_BASE
    // Act I has no capacity: Signal is a readout with no uses and the act ends when it passes a
    // threshold, so a clamp here could only ever stop the act from ending.
    return Infinity
  }

  // The raw rate, before the Photoreception mercy floor. SrPeak is recorded from this and never
  // from Sr(), or the floor would ratchet itself upward against its own record.
  function rawSr (s) {
    var A = T().A2
    return sigK(s) *
      connectivity(s) *
      ifaceTerm(s) *
      (1 + A.D_COND_STEP * num(s.cog.dCond)) *
      num(s.mult.signalMult) *
      num(s.mult.prestigeGrowth)
  }

  function Sr (state) {
    var s = state || S()
    if (!s) return 0
    var r = rawSr(s)
    // The anti-softlock floor (BIBLE §5.5). By fc ≥ 0.88 the forest that produced the Signal is
    // mostly eaten, and the act still has an 1.6e6 Σ gate in front of it.
    if (s.act === 2 && flagOn(s, 'photoreception')) {
      var A = T().A2
      r = Math.max(r, A.PHOTO_FLOOR * num(s.cog.SrPeak))
    }
    return r
  }

  function Sc (state) {
    var s = state || S()
    if (!s) return 0
    var base = sigCapBase(s)
    if (!isFinite(base)) return Infinity
    return base *
      Math.pow(1 + num(s.cog.dVes), T().A2.D_VES_EXP) *
      ifaceTerm(s) *
      num(s.mult.capMult)
  }

  // The denominator a meter or an audio bind should draw against — never the clamp. In Act I there
  // is no capacity, so the honest thing to fill a bar with is the decision the number is walking
  // toward. feel.js binds its CONDUCTION layer to this.
  function signalCap (state) {
    var s = state || S()
    if (!s) return 0
    if (s.act === 1) return T().A1.DECIDE_SIGNAL
    return Sc(s)
  }

  function timeToFill (state) {
    var s = state || S()
    if (!s) return Infinity
    var r = Sr(s)
    if (!(r > 0)) return Infinity
    return Sc(s) / r
  }

  // What the player actually steers by (`02` §4.6's fourth line).
  function fillsIn (state) {
    var s = state || S()
    if (!s) return Infinity
    var cap = Sc(s)
    if (!isFinite(cap)) return Infinity
    var r = Sr(s)
    if (!(r > 0)) return Infinity
    return Math.max(0, (cap - num(s.res.signal)) / r)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SATURATION, RIPENESS, INSIGHT
  // ───────────────────────────────────────────────────────────────────────────

  function ripeT (s) {
    var v = num(s.mult.ripeT)
    return v > 0 ? v : T().A2.RIPE_T
  }

  function ripeness (state) {
    var s = state || S()
    if (!s) return 0
    var A = T().A2
    // The GHOST floor is a floor on the *multiplier*, not on saturation: it never makes Insight
    // accrue, it only makes accrual worth more when it happens (BIBLE §2.2).
    var floor = C().clamp(num(s.mult.ripenessFloor), 0, A.RIPE_FLOOR_CAP)
    return C().clamp(Math.max(num(s.res.satTime) / ripeT(s), floor), 0, 1)
  }

  function saturated (state) {
    var s = state || S()
    if (!s || s.act < 2) return false
    var cap = Sc(s)
    if (!isFinite(cap)) return false
    return num(s.res.signal) >= cap - T().NUM.SAT_EPS
  }

  function insightRate (state) {
    var s = state || S()
    if (!s || !flagOn(s, 'turgor')) return 0
    var A = T().A2
    return A.INS_K * Math.sqrt(Math.max(0, Sr(s))) *
      (A.INS_RIPE_A + A.INS_RIPE_B * ripeness(s)) *
      num(s.mult.insightMult)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TICK STEP 9 · COGNITION
  // ───────────────────────────────────────────────────────────────────────────

  // Act I's Signal is a foreshadow with a different meaning: it exists only to be watched, and the
  // act ends the moment it crosses 1,000. Carrying that pile into Act II would hand the player
  // `chemotaxis` at 0:00 and saturation before the first claim, which deletes two of the opening's
  // beats (`02` §3, beats 0/1/4) and sets stats.everSaturated before the mechanic exists. BIBLE
  // §2.1 lists Signal's acts as II and III, so the Act I pool is not Act II's pool — the decision
  // spends it. act1.decide() performs the revocation; the resource is this module's, so the reset
  // is here, latched on the boundary rather than written into another module's transition.
  function openMind (s) {
    C().setStock(s.res, 'signal', 0)
    C().setStock(s.res, 'satTime', 0)
    s.cog.SrPeak = 0
    s.cog.pulseCd = 0
    s.cog.pulsesInFlight.length = 0
  }

  function step (dt, opts) {
    var s = S()
    if (!s || !(dt > 0)) return
    var o = opts || {}

    if (s.act !== lastAct) {
      if (lastAct === 1 && s.act === 2) openMind(s)
      if (lastAct === 2 && s.act === 3) freeReallocate()
      lastAct = s.act
      syncLadders(s)
    }

    // A reconcile is a run of offline ticks; the first of them opens a fresh Insight budget.
    if (o.offline && !wasOffline) offlineSat = 0
    wasOffline = !!o.offline

    if (s.act === 1) { stepSignalA1(s, dt); return }
    stepSignal(dt)
    stepInsight(dt)
  }

  // Act I. Nothing accrues until Action Potential is bought: the resource is the purchase's whole
  // effect, and a pool that filled before it existed would make the readout a receipt.
  function stepSignalA1 (s, dt) {
    if (!flagOn(s, 'action_potential')) return
    C().setStock(s.res, 'signal', num(s.res.signal) + Sr(s) * dt)
  }

  // BIBLE §4 step 9. The clamp is here — after every producer and consumer of Signal has run — so
  // saturation is measured on the net, and the excess is the Insight economy's entire input.
  function stepSignal (dt) {
    var s = S()
    if (!s || !(dt > 0) || s.act < 2) return
    var next = num(s.res.signal) + Sr(s) * dt
    var cap = Sc(s)
    if (isFinite(cap) && next > cap) {
      s.stats.signalOverflow = num(s.stats.signalOverflow) + (next - cap)
      next = cap
    }
    C().setStock(s.res, 'signal', next)
    if (!s.stats.everSaturated && saturated(s)) s.stats.everSaturated = true
  }

  // `02` §5.1, verbatim, plus the one addition the design claims: satTime ripens at +dt and decays
  // at −RIPE_DEC·dt, so a purchase that drops the pool costs roughly 240 s of peak Insight and the
  // player learns to batch without being told.
  function stepInsight (dt) {
    var s = S()
    if (!s || !(dt > 0) || s.act < 2) return
    var A = T().A2
    var sat = saturated(s)
    var st = num(s.res.satTime)
    st = sat ? Math.min(ripeT(s), st + dt) : Math.max(0, st - A.RIPE_DEC * dt)
    C().setStock(s.res, 'satTime', st)

    if (!sat || !flagOn(s, 'turgor')) return

    var gain = insightRate(s) * dt
    if (wasOffline) {
      var budget = T().OFFLINE.INSIGHT_CAP_S - offlineSat
      if (budget <= 0) return
      if (dt > budget) gain *= budget / dt
      offlineSat += Math.min(dt, budget)
    }
    C().setStock(s.res, 'insight', num(s.res.insight) + gain)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DIFFERENTIATION — the ladders, allocation, respec
  // ───────────────────────────────────────────────────────────────────────────

  function rung2 (n) { return LUCAS[n] * T().A2.D_LADDER_SCALE }
  function rung3 (n) { return D3_BASE * Math.pow(D3_PHI3, n) }

  function countPassed (value, rungs, at) {
    var n = 0
    while (n < rungs && value >= at(n)) n += 1
    return n
  }

  // Called whenever the module has no right to assume its counters: boot, load, act change. The
  // ladders are functions of monotone stocks, so re-deriving is both cheap and the only way to be
  // correct across a reload.
  function syncLadders (s) {
    granted2 = countPassed(num(s.res.cumBiomass), D_RUNGS_2, rung2)
    granted3 = countPassed(num(s.res.cumCarbon), D_RUNGS_3, rung3)
  }

  // BIBLE §4 step 14. The D grants live here rather than in bloom because D is this module's
  // currency in both acts; bloom's own stepLadders owns pc and the Act III derived milestones.
  function stepLadders (dt, opts) {
    var s = S()
    if (!s) return
    void dt; void opts

    if (s.act >= 2) {
      var want2 = countPassed(num(s.res.cumBiomass), D_RUNGS_2, rung2)
      if (want2 > granted2) { grantD(want2 - granted2); granted2 = want2 }
    }
    if (s.act === 3) {
      var want3 = countPassed(num(s.res.cumCarbon), D_RUNGS_3, rung3)
      if (want3 > granted3) { grantD(want3 - granted3); granted3 = want3 }
    }

    // SrPeak is the record the Photoreception floor is measured against, and `02`'s peak-signal
    // console line reads it. It is a high-water mark of the raw rate and never decays.
    if (s.act >= 2) {
      var r = rawSr(s)
      if (r > num(s.cog.SrPeak)) s.cog.SrPeak = r
    }
  }

  function grantD (n) {
    var s = S()
    if (!s || !(n > 0)) return 0
    var before = num(s.res.D)
    C().setStock(s.res, 'D', before + Math.floor(n), T().A2.D_MAX)
    return num(s.res.D) - before
  }

  var AXES = { cond: 'dCond', ves: 'dVes', lag: 'dLag', dCond: 'dCond', dVes: 'dVes', dLag: 'dLag' }

  function allocated (state) {
    var s = state || S()
    if (!s) return 0
    return num(s.cog.dCond) + num(s.cog.dVes) + num(s.cog.dLag)
  }

  function unallocated (state) {
    var s = state || S()
    if (!s) return 0
    return Math.max(0, num(s.res.D) - allocated(s))
  }

  function canAllocate (s) {
    if (s.act === 3) return true                 // the axes are inherited; the act opens on a respec
    return s.act === 2 && flagOn(s, 'differentiation')
  }

  function allocate (axis, n) {
    var s = S()
    if (!s) return false
    var key = AXES[axis]
    if (!key) return false
    if (key === 'dLag' && s.act !== 3) return false   // dLag exists only in Act III (BIBLE §3)
    if (!canAllocate(s)) return false
    var want = n === undefined ? 1 : Math.floor(n)
    if (!(want > 0) || want > unallocated(s)) return false
    s.cog[key] = num(s.cog[key]) + want
    return true
  }

  // ceil(120·(n+1)^1.60) Ψ. The counter is NOT reset at the act break, which is what stops respec
  // from becoming a free optimiser's toy in Act III after being a real instrument in Act II.
  function respecCost (state) {
    var s = state || S()
    if (!s) return Infinity
    var A = T().A2
    return Math.ceil(A.RESPEC_A * Math.pow(num(s.cog.respecs) + 1, A.RESPEC_E))
  }

  function respec () {
    var s = S()
    if (!s || s.act < 2) return false
    if (s.act === 2 && !flagOn(s, 'reabsorption')) return false
    var cost = respecCost(s)
    if (num(s.res.insight) < cost) return false
    C().setStock(s.res, 'insight', num(s.res.insight) - cost)
    unallocate(s)
    s.cog.respecs = num(s.cog.respecs) + 1
    return true
  }

  function unallocate (s) {
    s.cog.dCond = 0
    s.cog.dVes = 0
    s.cog.dLag = 0
    s.stats.respecs = num(s.stats.respecs) + 1
    s.stats.reallocations = num(s.stats.reallocations) + 1
  }

  // BIBLE §2.1 row 11: D is "freed for one reallocation at ASCOSPORE". That is the points coming
  // back, not a discount on a purchase — there is no entitlement to store, and no way for a player
  // who respecced in Act II to lose it. It fires on the II→III boundary for the same reason
  // openMind() fires on the I→II one: D is this module's currency and the transition is not.
  function freeReallocate () {
    var s = S()
    if (!s) return false
    unallocate(s)
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PULSE — the hero verb, never automated, in any act, at any price
  // ───────────────────────────────────────────────────────────────────────────

  function pulseCooldown (state) {
    var s = state || S()
    if (!s) return 0
    var base = s.act === 3 ? T().A3.PULSE_CD : T().A2.PULSE_CD
    var steps = CD_STEPS[s.act] || []
    for (var i = 0; i < steps.length; i++) {
      if (flagOn(s, steps[i].flag)) { base = steps[i].s; break }
    }
    return base * (s.set && s.set.slow ? SLOW_DEADLINE : 1)
  }

  // 0.55·Sc, always. That fraction is not a balance knob: it is what guarantees a pulse always
  // breaks saturation, which is the permanent tension between the tactile verb and patient thought.
  function pulseCost (state) {
    var s = state || S()
    if (!s) return Infinity
    return T().A2.PULSE_COST_FRAC * Sc(s)
  }

  function modeUnlocked (s, mode) {
    var m = MODES[mode]
    if (!m) return false
    if (!Object.prototype.hasOwnProperty.call(m.flag, s.act)) return false
    var flag = m.flag[s.act]
    return flag === null || flagOn(s, flag)
  }

  function modes (state) {
    var s = state || S()
    var out = [], k
    if (!s) return out
    for (k in MODES) {
      if (!Object.prototype.hasOwnProperty.call(MODES, k)) continue
      if (modeUnlocked(s, k)) out.push(k)
    }
    return out
  }

  // Axial hex distance, from state's own q/r arrays. world.hexDist is preferred when it exists, but
  // the falloff is the pulse's own geometry and must not stop working because worldgen has not run.
  function hexDist (a, b) {
    var s = S()
    if (HY.world && HY.world.hexDist) return num(HY.world.hexDist(a, b))
    var reg = s && s.a2 && s.a2.regions
    if (!reg || !reg.q) return 0
    var aq = reg.q[a] | 0, ar = reg.r[a] | 0
    var bq = reg.q[b] | 0, br = reg.r[b] | 0
    return (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs((-aq - ar) - (-bq - br))) / 2
  }

  // 0.82^distance — 1.00, 0.82, 0.67, 0.55, 0.45, … One pulse cannot cover two of the four places
  // on the map that want one, which is what makes the epicentre a decision.
  function pulseStrength (epicentre, target) {
    var s = S()
    if (!s) return 0
    var d = s.act === 3 ? Math.abs(Math.floor(target) - Math.floor(epicentre))
      : hexDist(Math.floor(epicentre), Math.floor(target))
    if (!(d >= 0)) return 0
    return Math.pow(T().A2.PULSE_FALLOFF, d)
  }

  // Band radius in light years. `03` §17's delay table and §12.1's λ_12 = 0.152 both require
  // R_BASE to be the radius of the *first* shell out, not of band 0: 12 · 2.15^11 = 54,456 ly at
  // band 12, which is the 120-second pulse the whole finale is built on, and sqrt of which puts
  // λ_12 on 0.1515. Band 0 is where you are, so its radius — and its light-lag — is zero.
  function bandRadius (b) {
    var A = T().A3
    return b <= 0 ? 0 : A.R_BASE * Math.pow(A.R_GROWTH, b - 1)
  }

  function bandLag (b) { return T().A3.LAG_T * bandRadius(b) }

  function pulseReady (state) {
    var s = state || S()
    if (!s || s.act < 2) return false
    return num(s.cog.pulseCd) <= 0
  }

  function pulse (mode, epicentre) {
    var s = S()
    if (!s || s.act < 2) return false
    var m = MODES[mode]
    if (!m || !modeUnlocked(s, mode)) return false
    if (num(s.cog.pulseCd) > 0) return false

    var cost = pulseCost(s)
    if (!isFinite(cost) || num(s.res.signal) < cost) return false

    var epi = Math.max(0, Math.floor(num(epicentre)))
    C().setStock(s.res, 'signal', num(s.res.signal) - cost)
    s.cog.pulseMode = mode
    s.cog.pulseEpicentre = epi
    s.cog.pulseCd = pulseCooldown(s)
    s.stats.pulses = num(s.stats.pulses) + 1

    schedule(s, mode, epi, m.dur)
    feel('pulse.fire', { userInitiated: true })
    return true
  }

  // Act II delivers instantly; Act III delivers per band at LAG_T·R_b. Both write the same record
  // shape into cog.pulsesInFlight, which is the array §3 declares for exactly this — with `until`
  // added, because an effect window that did not survive a reload would be a decision the player
  // paid 0.55·Sc for and then lost to an autosave.
  function schedule (s, mode, epi, dur) {
    var list = s.cog.pulsesInFlight
    if (s.act !== 3) {
      list.push({ mode: mode, epicentre: epi, band: -1, arriveAt: s.t, until: s.t + dur, done: 0 })
      deliver(list[list.length - 1])
      return
    }
    var n = T().A3.BANDS, b, at, lag, sound = []
    for (b = 0; b < n; b++) {
      lag = bandLag(b)
      at = s.t + lag
      list.push({ mode: mode, epicentre: epi, band: b, arriveAt: at, until: at + dur, done: 0 })
      sound.push({ strength: pulseStrength(epi, b), dist: Math.abs(b - epi), pan: 0, lagSeconds: lag })
    }
    if (HY.feel && HY.feel.arrive) HY.feel.arrive(sound)
  }

  // Modules that care about a pulse implement onPulse(ev) and are told once, at the instant of
  // arrival. Everything continuous (SURGE's decomposition multiplier, REPEL's pressure terms) is
  // read back out of pulseEffect() instead, so a module that is not loaded costs nothing.
  var LISTENERS = ['world', 'forest', 'flush', 'bloom', 'divergence', 'finale']

  function deliver (rec) {
    if (rec.done) return
    rec.done = 1
    var ev = {
      mode: rec.mode,
      epicentre: rec.epicentre,
      band: rec.band,
      strength: rec.band >= 0 ? pulseStrength(rec.epicentre, rec.band) : 1,
      at: rec.arriveAt,
      until: rec.until
    }
    for (var i = 0; i < LISTENERS.length; i++) {
      var m = HY[LISTENERS[i]]
      if (!m || typeof m.onPulse !== 'function') continue
      try { m.onPulse(ev) } catch (e) { void 0 }
    }
  }

  // BIBLE §4 step 12. Never runs offline: a pulse is a decision, and a decision that resolved while
  // the player was away would make the promise in §9.6 false.
  function stepPulse (dt, opts) {
    var s = S()
    if (!s) return
    var o = opts || {}
    if (o.offline) return
    if (dt > 0) s.cog.pulseCd = Math.max(0, num(s.cog.pulseCd) - dt)

    var list = s.cog.pulsesInFlight
    var i, rec, keep = 0
    for (i = 0; i < list.length; i++) {
      rec = list[i]
      if (!rec) continue
      if (!rec.done && rec.arriveAt <= s.t) deliver(rec)
      if (rec.done && rec.until <= s.t) continue          // the window has closed; drop the record
      list[keep++] = rec
    }
    list.length = keep
  }

  // The continuous half of a pulse: 0 when no window of that mode covers `index`, else the falloff
  // strength. Callers turn it into their own multiplier — forest's SURGE is 1 + 2.20·strength.
  function pulseEffect (mode, index) {
    var s = S()
    if (!s) return 0
    var list = s.cog.pulsesInFlight
    var best = 0, i, rec, str
    for (i = 0; i < list.length; i++) {
      rec = list[i]
      if (!rec || rec.mode !== mode || !rec.done || rec.until <= s.t) continue
      if (rec.band >= 0 && Math.floor(index) !== rec.band) continue
      str = rec.band >= 0 ? pulseStrength(rec.epicentre, rec.band)
        : pulseStrength(rec.epicentre, index)
      if (str > best) best = str
    }
    return best
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE SURFACE
  // ───────────────────────────────────────────────────────────────────────────

  function init (s) {
    var st = s || S()
    if (!st) return
    lastAct = st.act
    offlineSat = 0
    wasOffline = false
    if (!st.cog.pulsesInFlight) st.cog.pulsesInFlight = []
    syncLadders(st)
    // DECIDE autosaves, and it does so between step 15 (where it runs) and the next tick's step 9
    // (where the boundary latch above would have fired). A save written in that one-tick window is
    // the only Act II save in existence with SrPeak still zero — stepLadders writes it on every
    // tick of the act — so it is an exact witness that the mind has not been opened yet.
    if (st.act === 2 && num(st.cog.SrPeak) === 0 && num(st.res.signal) > 0) openMind(st)
  }

  // §6's generic tick, for a caller that does not want the interleaved order. loop.js does want it
  // and drives the three steps directly, which is why this is not the path the game runs on.
  function tick (s, dt, opts) {
    void s
    step(dt, opts)
    stepPulse(dt, opts)
    stepLadders(dt, opts)
  }

  function serialise (s) {
    // Everything cognition owns already lives in §3's `res` and `cog` blocks, and §3.1 R1 forbids a
    // second copy. The only work here is dropping the delivery bookkeeping, which is re-derived.
    var st = s || S()
    var out = [], list = st.cog.pulsesInFlight, i
    for (i = 0; i < list.length; i++) {
      out.push({
        mode: list[i].mode, epicentre: list[i].epicentre, band: list[i].band,
        arriveAt: list[i].arriveAt, until: list[i].until, done: list[i].done ? 1 : 0
      })
    }
    return { pulsesInFlight: out }
  }

  function migrate (save, from) { void save; void from }

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — returns [] when healthy
  // ───────────────────────────────────────────────────────────────────────────

  // A cold-boot Act I run through the real simTick, driven to the end of the act.
  //
  // It exists to prove the one thing this module is load-bearing for: nothing else in the build
  // writes res.signal, so without cognition the game cannot leave Act I at all — `action_potential`
  // stays gated behind NEEDS.signalA1 and `decide` never triggers.
  //
  // WARM-UP is the real thing: loop.debug.play's stand-in taps, restocks the floor, buys tips,
  // signs contracts and buys every project it can afford, through the whole tick order. What that
  // stand-in does *not* yet do is run Act I's annual mineral strategy (`08` D20), and the two Act I
  // finale projects cost 4,900 ⛬ between them against the ~150 ⛬ it earns in an hour. So at the end
  // of the warm-up the network is credited to TUNE.HANDOFF — the *documented* Act I exit state,
  // which is where a competent player's hour and a half lands them. That credit is Act I's economy
  // being stood in for, and it is the only assistance in the run: from there the two projects
  // trigger on their own predicates, projects.js charges their real prices out of that network,
  // Signal accrues at cognition's own rate, `decide` reveals and is bought, and act1.decide() runs.
  var WARMUP_S = 1800
  var FINALE_CAP_S = 2400

  function playToDecide (seed) {
    HY.state.init(HY.state.newGame(seed, null))
    var mods = ['log', 'projects', 'act1', 'economy1', 'cognition'], i
    for (i = 0; i < mods.length; i++) {
      if (HY[mods[i]] && HY[mods[i]].init) HY[mods[i]].init(S())
    }
    HY.debug.play(WARMUP_S, { tapsPerSec: 2 })

    var s = S(), H = T().HANDOFF
    s.a1.tips = Math.max(s.a1.tips, H.TIPS)
    s.a1.patches = Math.max(s.a1.patches, 4)
    C().setStock(s.res, 'biomass', Math.max(num(s.res.biomass), H.BIOMASS))
    C().setStock(s.res, 'minerals', Math.max(num(s.res.minerals), H.MINERALS))

    var out = {
      warmupS: s.t, handoffHyphae: HY.act1.hyphae(s),
      signalAt: -1, decideAt: -1, act: 1, signal: 0, sr: 0, hyphae: 0
    }
    var dt = T().CLOCK.DT_A1
    var perSec = Math.round(1 / dt)
    var sec = 0, j
    // The finale is not a buying spree: a player at the end of Act I is saving for the two
    // projects, not for tip 256, so this drives the clock and the projects panel and nothing else.
    while (sec < FINALE_CAP_S) {
      if (HY.act1.onExtend) { HY.act1.onExtend(); HY.act1.onExtend() }
      for (j = 0; j < perSec; j++) HY.loop.simTick(dt, { stochastic: true, offline: false })
      buyRevealed()
      sec += 1
      s = S()
      if (out.signalAt < 0 && flagOn(s, 'action_potential')) {
        out.signalAt = s.t
        out.hyphae = HY.act1.hyphae(s)
        out.sr = Sr(s)
      }
      if (out.signalAt >= 0 && out.decideAt < 0 &&
          (s.act === 2 || num(s.res.signal) >= T().A1.DECIDE_SIGNAL)) {
        out.decideAt = s.t
        out.signal = num(s.res.signal)
      }
      if (s.act !== 1) { out.act = s.act; break }
    }
    return out
  }

  // Everything affordable except the re-armables. `autolysis` is free, pinned and permanently
  // affordable, and it deletes a fifth of the network every time it is taken; a driver that buys
  // whatever is cheapest takes it once a second and walks the hyphae backwards forever. Failsafes
  // are for a player who is stuck, and this one is not.
  function buyRevealed () {
    var pj = HY.projects
    if (!pj || !pj.visible || !pj.purchase) return
    var list = pj.visible(), i, p
    for (i = 0; i < list.length; i++) {
      p = list[i]
      if (p.rearm) continue
      if (p.buyable && pj.affordRatio(p) <= 1) pj.purchase(p.id)
    }
  }

  var LAST_RUN = null

  // The identity of §9.4 is a statement about how Sr and Sc move when the *forest* moves, so the
  // only honest way to sweep it is through the real path: a stand-in `forest` on the namespace, in
  // place for the length of the test and removed afterwards. No test hook exists in the shipped
  // code path, and the sweep exercises exactly the lines the game runs.
  var stub = { iface: 0, conn: 1 }

  function installStub () {
    HY.forest = { totalInterface: function () { return stub.iface } }
    HY.bloom = { Lambda: function () { return stub.iface } }
    HY.world = { connectivity: function () { return stub.conn } }
  }


  function restoreStub (forest, bloom, world) {
    if (forest) HY.forest = forest; else delete HY.forest
    if (bloom) HY.bloom = bloom; else delete HY.bloom
    if (world) HY.world = world; else delete HY.world
  }

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
    var hadForest = HY.forest, hadBloom = HY.bloom, hadWorld = HY.world
    try {
      var A = T().A2, s, i, k, want

      // ── the identity that must survive both acts (BIBLE §9.4) ─────────────
      near(A.SIG_CAP_BASE / A.SIG_K, A.TIME_TO_FILL_K, 0.05, 'Act II Sc/Sr base is not 86.7')
      near(T().A3.SIG_CAP3 / T().A3.SIG_K3, A.TIME_TO_FILL_K, 0.05, 'Act III Sc/Sr base is not 86.7')
      near(A.SIG_CAP_BASE / A.SIG_K, T().A3.SIG_CAP3 / T().A3.SIG_K3, 1e-12,
        'the two acts do not share the same Sc/Sr ratio, so intuition does not transfer')

      installStub()
      HY.state.init(HY.state.newGame(11, null))
      init(S())
      s = S(); s.act = 2; lastAct = 2

      // Time-to-fill must not move when the forest does: the interface term appears in Sr and Sc
      // with the same exponent and cancels. Sweep it over three orders of magnitude.
      var ifaces = [0, 0.4, 3, 17, 70, 400]
      var base = null
      for (i = 0; i < ifaces.length; i++) {
        stub.iface = ifaces[i]
        var ttf = timeToFill(s)
        if (base === null) base = ttf
        near(ttf, base, base * 1e-9, 'timeToFill moved with the forest at Σℓ = ' + ifaces[i])
        ok(Sr(s) > 0 && Sc(s) > 0, 'Sr or Sc went non-positive at Σℓ = ' + ifaces[i])
      }
      stub.iface = 12
      near(base, A.TIME_TO_FILL_K, 0.05, 'baseline timeToFill is not 86.7 s')

      // …and must move exactly as the closed form says when the allocation does. The two
      // degenerate builds of 02 §4.4 are included because they are the two the act is shaped
      // around: the Conduction build ripens constantly and buys many small things, the Vesicle
      // build ripens rarely and banks for projects the other build can never afford. 02 §4.4's
      // printed seconds are not reproducible from the formula BIBLE §9.4 makes law (its own row 1
      // is, the rest are not), so the formula is what is asserted here.
      var cases = [[0, 0, 1, 1, 1.00], [2, 2, 1.45, 1, 1.20], [5, 6, 1.45, 2.2, 1.42],
        [9, 12, 3.0, 8.0, 1.55], [3, 18, 3.0, 8.0, 1.55], [14, 4, 3.0, 8.0, 1.55]]
      for (i = 0; i < cases.length; i++) {
        s.cog.dVes = cases[i][0]; s.cog.dCond = cases[i][1]
        s.mult.capMult = cases[i][2]; s.mult.signalMult = cases[i][3]
        stub.conn = cases[i][4]
        want = (A.SIG_CAP_BASE / A.SIG_K) * Math.pow(1 + cases[i][0], A.D_VES_EXP) * cases[i][2] /
          (cases[i][4] * (1 + A.D_COND_STEP * cases[i][1]) * cases[i][3])
        near(timeToFill(s), want, want * 1e-9, 'timeToFill closed form, case ' + i)
      }
      // The Vesicle extreme must be an order of magnitude slower to ripen than the Conduction one,
      // or the allocation is a slider rather than a decision.
      ok(cases[5][0] > cases[4][0] && Math.pow(15, A.D_VES_EXP) /
        (1 + A.D_COND_STEP * 4) > 20 * Math.pow(4, A.D_VES_EXP) /
        (1 + A.D_COND_STEP * 18), 'the two degenerate builds are not far enough apart')
      s.cog.dVes = 0; s.cog.dCond = 0; s.mult.capMult = 1; s.mult.signalMult = 1; stub.conn = 1

      // Connectivity is in Sr and not in Sc, so a compact colony ripens faster on the same forest.
      stub.conn = 1.60
      ok(timeToFill(s) < base, 'connectivity did not shorten the fill time')
      stub.conn = 1

      // ── the clamp, the overflow ledger, and everSaturated ─────────────────
      HY.state.init(HY.state.newGame(12, null))
      init(S())
      s = S(); s.act = 2; lastAct = 2
      stub.iface = 1.0
      var cap = Sc(s)
      ok(isFinite(cap) && cap > 0, 'Act II Sc is not a finite positive number')
      var rate = Sr(s)
      C().setStock(s.res, 'signal', cap - 1)
      var over0 = num(s.stats.signalOverflow)
      stepSignal(10)                                  // ten seconds of a rate that overshoots hugely
      near(num(s.res.signal), cap, 1e-9, 'signal was not hard-clamped to Sc')
      near(num(s.stats.signalOverflow) - over0, rate * 10 - 1, Math.max(1e-9, rate * 1e-9),
        'the clamped excess did not land in stats.signalOverflow')
      ok(s.stats.everSaturated === true, 'everSaturated was not latched at the clamp')

      // ── Insight accrues ONLY while saturated, and ripening pays ───────────
      s.proj.flags.turgor = 1
      C().setStock(s.res, 'insight', 0)
      C().setStock(s.res, 'satTime', 0)
      C().setStock(s.res, 'signal', cap * 0.5)
      stepInsight(1)
      near(num(s.res.insight), 0, 0, 'Insight accrued below saturation')
      near(num(s.res.satTime), 0, 0, 'satTime rose while unsaturated')

      C().setStock(s.res, 'signal', cap)
      stepInsight(1)
      near(num(s.res.satTime), 1, 1e-9, 'satTime did not ripen at +dt while saturated')
      var first = num(s.res.insight)
      want = A.INS_K * Math.sqrt(Sr(s)) * (A.INS_RIPE_A + A.INS_RIPE_B * (1 / ripeT(s)))
      near(first, want, want * 1e-9, 'the Insight rate is not 02 §5.1')

      C().setStock(s.res, 'satTime', ripeT(s))
      C().setStock(s.res, 'insight', 0)
      stepInsight(1)
      want = A.INS_K * Math.sqrt(Sr(s))
      near(num(s.res.insight), want, want * 1e-9, 'full ripeness is not ×1.00')
      near(want / first, 1 / (A.INS_RIPE_A + A.INS_RIPE_B / ripeT(s)), 1e-9,
        'ripeness does not span 0.25 → 1.00 of the Insight rate')

      // …and satTime decays at RIPE_DEC× the rate it built. That asymmetry is the whole reason a
      // player learns to batch purchases: one spend costs ~240 s of peak Insight.
      C().setStock(s.res, 'signal', 0)
      C().setStock(s.res, 'satTime', 60)
      stepInsight(10)
      near(num(s.res.satTime), 60 - A.RIPE_DEC * 10, 1e-9, 'satTime did not decay at RIPE_DEC·dt')
      C().setStock(s.res, 'satTime', 5)
      stepInsight(10)
      near(num(s.res.satTime), 0, 0, 'satTime decayed past zero')
      near(ripeT(s) / A.RIPE_DEC + ripeT(s), 240, 1e-9,
        'the published 240 s cost of a purchase does not follow from RIPE_T and RIPE_DEC')

      // Insight is gated on Turgor: the pool saturates a minute before the player owns the idea.
      delete s.proj.flags.turgor
      C().setStock(s.res, 'signal', cap)
      C().setStock(s.res, 'insight', 0)
      stepInsight(1)
      near(num(s.res.insight), 0, 0, 'Insight accrued without Turgor')
      s.proj.flags.turgor = 1

      // The GHOST floor lifts the multiplier and never counts as saturation (BIBLE §2.2).
      s.mult.ripenessFloor = 0.30
      C().setStock(s.res, 'satTime', 0)
      near(ripeness(s), 0.30, 1e-9, 'the ripeness floor was not applied')
      C().setStock(s.res, 'signal', 0)
      C().setStock(s.res, 'insight', 0)
      stepInsight(1)
      near(num(s.res.insight), 0, 0, 'the ripeness floor made Insight accrue unsaturated')
      s.mult.ripenessFloor = 0
      near(ripeness(s), 0, 0, 'ripeness did not fall back to satTime/RIPE_T')

      // Offline: 90 minutes of perfect Insight, however long you were away (02 §14.4).
      C().setStock(s.res, 'insight', 0)
      C().setStock(s.res, 'satTime', ripeT(s))
      C().setStock(s.res, 'signal', Sc(s))
      wasOffline = false
      var capS = T().OFFLINE.INSIGHT_CAP_S
      var rateFull = A.INS_K * Math.sqrt(Sr(s)) * num(s.mult.insightMult)
      for (i = 0; i < T().OFFLINE.STEPS; i++) step(180, { stochastic: false, offline: true })
      near(num(s.res.insight), rateFull * capS, rateFull * capS * 1e-6,
        'offline Insight was not capped at INSIGHT_CAP_S of saturated production')
      ok(43200 * rateFull > 4 * num(s.res.insight), 'the offline cap is not actually binding')
      wasOffline = false

      // ── the two Differentiation ladders ───────────────────────────────────
      var pub = [1.50e9, 2.00e9, 3.50e9, 5.50e9, 9.00e9, 1.45e10, 2.35e10, 3.80e10, 6.15e10,
        9.95e10, 1.61e11, 2.605e11, 4.215e11, 6.820e11, 1.1035e12, 1.786e12, 2.889e12,
        4.675e12, 7.564e12]
      ok(LUCAS.length === D_RUNGS_2, 'the Act II ladder is not 19 rungs')
      for (i = 0; i < pub.length; i++) {
        // 02 §4.5 publishes the ladder pre-ACT2_SCALE, to four figures.
        near(rung2(i) / A.ACT2_SCALE, pub[i], pub[i] * 0.001, 'Lucas rung ' + (i + 1))
        if (i >= 2) near(LUCAS[i], LUCAS[i - 1] + LUCAS[i - 2], 0, 'the ladder is not a Lucas sequence')
      }
      near(rung2(0), A.D_TRIGGER, A.D_TRIGGER * 0.002,
        'the first rung and flags.differentiation do not coincide')
      var a3pub = [8.00e26, 3.39e27, 1.44e28, 6.08e28, 2.58e29, 1.09e30, 4.62e30, 1.96e31,
        8.29e31, 3.51e32, 1.49e33, 6.31e33]
      ok(a3pub.length === D_RUNGS_3, 'the Act III ladder is not 12 rungs')
      for (i = 0; i < a3pub.length; i++) {
        near(rung3(i) / a3pub[i], 1, 0.004, 'Act III φ³ rung ' + (i + 1))
      }
      // 3 carried + 19 + 7 flavour + 12 + 4 flavour = 45, which is the lifetime cap.
      near(3 + D_RUNGS_2 + 7 + D_RUNGS_3 + 4, A.D_MAX, 0, 'the D budget does not close on D_MAX')

      HY.state.init(HY.state.newGame(13, null))
      init(S())
      s = S(); s.act = 2; lastAct = 2
      syncLadders(s)
      C().setStock(s.res, 'D', 0)
      C().setStock(s.res, 'cumBiomass', rung2(0) * 0.999)
      stepLadders(1, {})
      near(num(s.res.D), 0, 0, 'a rung paid out below its threshold')
      C().setStock(s.res, 'cumBiomass', rung2(2))
      stepLadders(1, {})
      near(num(s.res.D), 3, 0, 'crossing three rungs at once did not pay three points')
      stepLadders(1, {})
      near(num(s.res.D), 3, 0, 'the ladder paid the same rung twice')
      granted2 = 0                                   // …and a reload must not re-grant either
      syncLadders(s)
      stepLadders(1, {})
      near(num(s.res.D), 3, 0, 'the ladder double-granted after a reload')
      C().setStock(s.res, 'cumBiomass', rung2(D_RUNGS_2 - 1))
      stepLadders(1, {})
      near(num(s.res.D), D_RUNGS_2, 0, 'the full Act II ladder is not 19 points')
      ok(num(s.cog.SrPeak) > 0, 'stepLadders did not record SrPeak')

      // ── allocation and respec ─────────────────────────────────────────────
      ok(!allocate('cond', 1), 'allocation opened without flags.differentiation')
      s.proj.flags.differentiation = 1
      ok(allocate('cond', 2) && num(s.cog.dCond) === 2, 'allocate(cond) did not take')
      ok(!allocate('lag', 1), 'dLag was allocatable outside Act III')
      ok(!allocate('ves', 1e6), 'allocation exceeded the unallocated pool')
      near(unallocated(s), num(s.res.D) - 2, 0, 'unallocated is not D − allocated')
      near(Sr(s) / (rawSr(s) / (1 + A.D_COND_STEP * 2)), 1 + A.D_COND_STEP * 2, 1e-9,
        'dCond is not +35% on Sr per point')

      // ceil(120·(n+1)^1.60), which is the law BIBLE §6 M12 states. 02 §4.5's printed list
      // (120, 363, 726, 1210, …) is 121 × the triangular numbers and does not come from that
      // formula; the formula wins and the escalation it gives is the one asserted.
      var costs = [120, 364, 696, 1103, 1576, 2110]
      for (i = 0; i < costs.length; i++) {
        s.cog.respecs = i
        near(respecCost(s), costs[i], 0, 'respecCost(' + i + ')')
      }
      s.cog.respecs = 0
      s.proj.flags.reabsorption = 1
      C().setStock(s.res, 'insight', 119)
      ok(!respec(), 'respec ran without paying for itself')
      C().setStock(s.res, 'insight', 500)
      ok(respec(), 'respec refused a paid-up player')
      near(num(s.cog.dCond), 0, 0, 'respec did not return the points')
      near(num(s.res.insight), 380, 0, 'respec did not charge 120 Ψ')
      near(num(s.cog.respecs), 1, 0, 'the respec counter did not advance')
      // The counter is NOT reset at the act break: Act III's next paid respec costs 364, not 120.
      near(respecCost(s), 364, 0, 'the respec counter did not carry into the next cost')
      s.act = 3; lastAct = 2
      ok(allocate('cond', 3) && num(s.cog.dCond) === 3, 'allocation did not carry into Act III')
      // …but ASCOSPORE frees the points once, for nothing, on the boundary itself.
      C().setStock(s.res, 'insight', 0)
      step(0.05, {})
      near(num(s.cog.dCond), 0, 0, 'ASCOSPORE did not free D for one reallocation')
      near(num(s.cog.respecs), 1, 0, 'the free reallocation charged the escalation counter')
      near(respecCost(s), 364, 0, 'the respec counter was reset at the act break')
      ok(allocate('lag', 1) && num(s.cog.dLag) === 1, 'dLag is not allocatable in Act III')

      // ── PULSE ─────────────────────────────────────────────────────────────
      HY.state.init(HY.state.newGame(14, null))
      init(S())
      s = S(); s.act = 2; lastAct = 2
      stub.iface = 6
      // Give the board a geometry: without worldgen every q,r is 0 and every distance is 0.
      for (i = 0; i < 9; i++) { s.a2.regions.q[i] = i; s.a2.regions.r[i] = 0 }
      s.proj.flags.action_potential_ii = 1
      near(pulseCost(s), A.PULSE_COST_FRAC * Sc(s), 1e-9, 'pulseCost is not 0.55·Sc')
      ok(pulseCost(s) < Sc(s), 'a pulse must be affordable from a full pool')
      C().setStock(s.res, 'signal', Sc(s))
      ok(saturated(s), 'a full pool is not saturated')
      ok(pulse('SURGE', 0), 'a ready, funded, unlocked SURGE was refused')
      ok(!saturated(s), 'a pulse did not break saturation — 0.55·Sc guarantees that it does')
      near(num(s.cog.pulseCd), A.PULSE_CD, 0, 'the cooldown did not arm at 120 s')
      near(num(s.stats.pulses), 1, 0, 'stats.pulses did not count the pulse')
      ok(!pulse('SURGE', 0), 'a second pulse fired inside the cooldown')
      ok(!pulse('REPEL', 0), 'REPEL fired without Antibiosis')
      ok(modes(s).length === 1 && modes(s)[0] === 'SURGE', 'the wrong set of modes is unlocked')

      // 0.82^d across the falloff table of 02 §11.2.
      for (k = 0; k <= 8; k++) {
        near(pulseEffect('SURGE', k), Math.pow(A.PULSE_FALLOFF, k), 1e-12,
          'pulse falloff at hex distance ' + k)
      }
      near(pulseEffect('REPEL', 0), 0, 0, 'a mode that never fired reported an open window')

      // The window closes on time and the record is pruned.
      s.t += MODES.SURGE.dur - 1
      stepPulse(MODES.SURGE.dur - 1, { offline: false })
      ok(pulseEffect('SURGE', 0) > 0, 'the SURGE window closed early')
      s.t += 2
      stepPulse(2, { offline: false })
      near(pulseEffect('SURGE', 0), 0, 0, 'the SURGE window did not close at 30 s')
      near(s.cog.pulsesInFlight.length, 0, 0, 'a closed window was not pruned')

      // It never runs offline, at any cooldown, in any act: a decision must not resolve while away.
      s.cog.pulseCd = 50
      stepPulse(10, { offline: true })
      near(num(s.cog.pulseCd), 50, 0, 'the pulse cooldown ran offline')
      stepPulse(10, { offline: false })
      near(num(s.cog.pulseCd), 40, 0, 'the pulse cooldown did not run online')

      s.set.slow = true
      near(pulseCooldown(s), A.PULSE_CD * SLOW_DEADLINE, 0, 'SLOW did not double the cooldown')
      s.set.slow = false
      s.proj.flags.septal_gating = 1
      near(pulseCooldown(s), 75, 0, 'Septal Gating did not take the cooldown to 75 s')
      s.proj.flags.saltatory_conduction = 1
      near(pulseCooldown(s), 45, 0, 'Saltatory Conduction did not take the cooldown to 45 s')

      // Act III: the light-lag is the mechanic (03 §17). Band 12 lands two real minutes later.
      s.act = 3; lastAct = 3
      s.cog.pulseCd = 0
      s.cog.pulsesInFlight.length = 0
      // 03 §17's table, every row: 0.03 s at band 1, 5.6 s at band 8, 120 s at band 12.
      near(bandLag(0), 0, 0, 'band 0 is not where you are')
      near(bandRadius(1), 12, 0.01, 'band 1 radius')
      near(bandRadius(5), 257, 2, 'band 5 radius')
      near(bandRadius(8), 2552, 10, 'band 8 radius')
      near(bandRadius(10), 11798, 40, 'band 10 radius')
      near(bandLag(11), 55.8, 0.5, 'band 11 lag is not ~56 s')
      near(bandLag(12), 120, 1.0, 'band 12 lag is not two real minutes')
      // …and the same radii put lambda_12 on 03 §12.1's 0.152, which is the other half of R_b.
      near(1 / (1 + T().A3.LAG_K * Math.sqrt(bandRadius(12))), 0.152, 0.002,
        'the band radii do not reproduce lambda_12')
      near(pulseCooldown(s), 75, 0, 'the Act III cooldown is not 75 s')
      C().setStock(s.res, 'signal', Sc(s))
      ok(pulse('SURGE', 0), 'SURGE is not inherited into Act III')
      near(pulseEffect('SURGE', 0), 0, 0, 'a pulse arrived before any time passed at all')
      s.t += 1
      stepPulse(1, { offline: false })
      near(pulseEffect('SURGE', 0), 1, 1e-9, 'the epicentre band never received the pulse')
      near(pulseEffect('SURGE', 12), 0, 0, 'band 12 heard the pulse before the light did')
      s.t += 121
      stepPulse(121, { offline: false })
      near(pulseEffect('SURGE', 12), Math.pow(A.PULSE_FALLOFF, 12), 1e-9,
        'band 12 never received the pulse')

      // ── Act I: the foreshadow, and the reason the act can end at all ──────
      restoreStub(hadForest, hadBloom, hadWorld)
      HY.state.init(HY.state.newGame(15, null))
      init(S())
      s = S()
      ok(!isFinite(Sc(s)), 'Act I has a Signal capacity, and a clamp there could only stall the act')
      near(signalCap(s), T().A1.DECIDE_SIGNAL, 0, 'the Act I meter denominator is not the gate')
      s.a1.tips = 255; s.a1.patches = 4
      near(conduction(s), HY.act1.hyphae(s) / T().A1.HYPHAE_GATE, 1e-12, 'conduction is not hyphae/gate')
      step(1, {})
      near(num(s.res.signal), 0, 0, 'Signal accrued before Action Potential')
      s.proj.flags.action_potential = 1
      step(1, {})
      near(num(s.res.signal), Sr(s), Sr(s) * 1e-9, 'Signal did not accrue with Action Potential')

      // 8–15 minutes of silence, across the whole reachable hyphal range (01 §11.1). Act I's tips
      // are capped at 400 and its patches at 6, so 500 m and 850 m are the two ends of the act.
      var span = [[Math.ceil(T().A1.HYPHAE_GATE / T().A1.HYPHAE_PER_TIP), 1], [255, 4],
        [T().NUM.INT_MAX.tips, T().A1.PATCH_MAX]]
      for (i = 0; i < span.length; i++) {
        s.a1.tips = span[i][0]; s.a1.patches = span[i][1]
        within(T().A1.DECIDE_SIGNAL / Sr(s), 480, 900,
          'time to the DECIDE gate at ' + Math.round(HY.act1.hyphae(s)) + ' m of hyphae')
      }

      // The pool the decision spends: Act II opens on 0 Σ, not on Act I's pile, or `chemotaxis` is
      // free at 0:00 and the network is saturated before the first claim.
      s.a1.tips = 255
      C().setStock(s.res, 'signal', 4000)
      s.act = 2
      step(0.05, {})
      near(num(s.res.signal), Sr(s) * 0.05, Sr(s) * 1e-6,
        'Act I Signal was carried into Act II and deleted the opening')
      // …and a save written inside the one tick between DECIDE and the next step 9 is repaired.
      C().setStock(s.res, 'signal', 4000)
      s.cog.SrPeak = 0
      init(s)
      near(num(s.res.signal), 0, 0, 'a save taken at the instant of DECIDE was not repaired')

      // ── the run that proves the act can be left at all ────────────────────
      var run = playToDecide(7)
      LAST_RUN = run
      ok(run.signalAt > 0, 'the Act I finale never reached Action Potential')
      ok(run.decideAt > 0, 'DECIDE never revealed: nothing else in the build writes res.signal')
      ok(run.act === 2, 'DECIDE revealed but buying it did not end the act')
      within(run.decideAt - run.signalAt, 480, 900,
        'Signal was not the promised 8–15 minutes of silence')
      // …and the very next tick of Act II opens on an empty pool rather than on Act I's pile.
      HY.loop.simTick(T().CLOCK.DT_A23, { stochastic: false, offline: false })
      ok(num(S().res.signal) < 1, 'Act II did not open on an empty pool: ' + num(S().res.signal))
      ok(S().stats.everSaturated === false, 'Act I Signal saturated the Act II pool at 0:00')
    } finally {
      restoreStub(hadForest, hadBloom, hadWorld)
      wasOffline = false
      HY.state.importB64(keep)
      // playToDecide() re-inits the Act I modules against a game of its own, so the ones it
      // touched are handed back the state the caller had, not the one the run ended on.
      var back = ['log', 'projects', 'act1', 'economy1', 'cognition'], bi
      for (bi = 0; bi < back.length; bi++) {
        if (HY[back[bi]] && HY[back[bi]].init) HY[back[bi]].init(S())
      }
    }
    return f
  }
  HY.cognition = {
    // BIBLE §6 M12
    Sr: Sr,
    Sc: Sc,
    timeToFill: timeToFill,
    stepSignal: stepSignal,
    stepInsight: stepInsight,
    ripeness: ripeness,
    grantD: grantD,
    allocate: allocate,
    respec: respec,
    respecCost: respecCost,
    pulseCost: pulseCost,
    pulse: pulse,
    pulseStrength: pulseStrength,

    // the steps loop.js drives (BIBLE §4 steps 9, 12, 14)
    step: step,
    stepPulse: stepPulse,
    stepLadders: stepLadders,

    // §6's generic module surface
    init: init,
    tick: tick,
    serialise: serialise,
    migrate: migrate,

    // the readouts the UI, feel and the other act modules read across the boundary
    signalCap: signalCap,
    fillsIn: fillsIn,
    saturated: saturated,
    insightRate: insightRate,
    conduction: conduction,
    connectivity: connectivity,
    allocated: allocated,
    unallocated: unallocated,
    modes: modes,
    pulseReady: pulseReady,
    pulseCooldown: pulseCooldown,
    pulseEffect: pulseEffect,
    bandLag: bandLag,
    MODES: MODES,
    get lastRun () { return LAST_RUN },
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
