;(function (HY) {
  'use strict'

  // M15 · finale.js — the last twenty minutes and everything after (BIBLE §6 M15).
  //
  // Owns: the thirteen band phases and the Kuramoto order parameter ϒ, ENTRAIN arrivals across the
  // light-lag, the Successor's desync, the three endings and their gates, the staged dismantle, the
  // sclerotium formula, New Growth, and the projection of your own defectors into the next run's
  // Act II rival seats.
  //
  // Does NOT own: pulses (cognition schedules them and delivers them per band at LAG_T·R_b; this
  // module is one of its listeners), the Successor itself (divergence), craft or carbon (bloom), or
  // a single ending string — every line of every ending is `09` §5, verbatim, and lives in log.js's
  // SEQUENCES table. This module chooses which sequence plays, computes the only two live tokens
  // ({clock} and {k}), and drives the clock the words arrive on.
  //
  // The whole of the last twenty minutes is one idea. Every other incremental game's endgame is
  // "get one more big number"; this one is a coordination problem across a 120-second control lag,
  // against an adversary that is actively adding noise. To pull band 12 into phase you must fire a
  // pulse two minutes before the moment you want it to correct toward, at an epicentre whose phase
  // *then* will be the target. `0.82^d` means one pulse cannot reach the whole fleet, so the answer
  // is twelve to sixteen aimed pulses over eighteen minutes — and ENDING A also wants 1.10e7 Σ
  // *held*, which means one full timeToFill with no pulses at all, during which ϒ decays. Nothing
  // announces that trade; it is emergent from three constants set in Act II.
  //
  // ϒ is derived and is never stored as an independent stock (BIBLE §3.1 R1). `a3.upsilon` is a
  // cache of the measurement, written once per tick by stepPhase and read by projects, log and the
  // UI; the evidence it is computed from — `a3.bands.phase` — is right there beside it.
  //
  // Numbers that cross a module boundary are in `HY.core.TUNE.A3`. What lives below is this
  // module's own table: the dismantle's stage schedule, the relaxation's rate, and the four rows of
  // the ending catalogue, none of which any other module reads.

  // ───────────────────────────────────────────────────────────────────────────
  // LAZY MODULE ACCESS
  // ───────────────────────────────────────────────────────────────────────────

  function C () { return HY.core }
  function T () { return HY.core.TUNE }
  function A () { return HY.core.TUNE.A3 }
  function S () { return HY.state.state }

  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }
  function flagOn (s, id) { return !!(s && s.proj && s.proj.flags && s.proj.flags[id]) }

  var TAU = Math.PI * 2

  // Phase is an angle on [0,1). `x % 1` keeps the sign of x, and one negative phase turns every
  // cosine in the order parameter into the wrong quadrant, so the wrap is written once.
  function frac (x) {
    if (!isFinite(x)) return 0
    var v = x - Math.floor(x)
    return v < 0 ? v + 1 : (v >= 1 ? 0 : v)
  }

  // Signed distance to the nearest representative of the same angle, on [−0.5, 0.5].
  function wrapHalf (x) {
    var v = frac(x)
    return v > 0.5 ? v - 1 : v
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THIS MODULE'S OWN NUMBERS
  // ───────────────────────────────────────────────────────────────────────────

  var FIN = {
    // The dismantle (§20): panels close in reverse order of acquisition, then the strip goes too.
    DISMANTLE_S: 9.0,           // s, total teardown before the first word of an ending
    STAGE_S: 1.8,               // s between panel closes; five stages inside DISMANTLE_S
    OFFER_LAST: 8.4,            // s, the last step of `ending_c_offer` — the CEDE button

    // Offline relaxation (§19.5). ϒ falls back to its free-running value with this time constant:
    // ten minutes away costs most of a phase lock, which is what "you lose progress on the finale,
    // not resources" has to mean if it is to mean anything.
    RELAX_TAU: 300,             // s, one band-0 period
    RELAX_ITERS: 30,            // bisection steps; 2^-30 of the blend is far below display precision
    RELAX_EPS: 1e-6,            // ϒ, below which a relaxation step is not worth performing
    DRIFT_NOTICE: 0.06,         // ϒ lost across an absence before the return screen mentions it

    // The Successor's noise is drawn from a stream keyed on the sim clock rather than a running
    // generator, so a reload mid-endgame reproduces the same jitter instead of a new galaxy.
    DESYNC_QUANT: 0.05,         // s, the Act III tick — one draw per band per tick

    // §21.4's projection of an archived defector onto an Act II rival seat.
    RIVAL_AGG_A: 0.35, RIVAL_AGG_B: 0.055,      // aggression = a + b·tAnt
    RIVAL_GROW_A: 0.80, RIVAL_GROW_B: 0.070,    // growth     = a + b·tSpo
    RIVAL_RES_A: 1.00, RIVAL_RES_B: 0.090,      // resilience = a + b·tMel
    RIVAL_SEATS: 2,             // min(2, archive.length) of the four seats are replaced
    ARCHIVE_WILD: 2             // wild lineages carried out beside your own final genome
  }

  // Reverse order of acquisition: the last thing the player earned is the first thing to go. The
  // status strip is last because it is the only one of the five that was never earned.
  var PANELS = ['lineages', 'genome', 'fleet', 'void', 'strip']

  // The genome axes, in BIBLE §3's order, forever. Only three of them are read here.
  var SPO = 3, MEL = 4, ANT = 7

  // §20 and §5 of `09`. `seq` names the sequence in log.js's catalogue; `score` names the cue in
  // feel.js. `level` is the meta counter the ending increments — ENCYST increments none, which is
  // what makes it a concession and not an ending.
  var ENDINGS = [
    { key: 'A', id: 'bloom', title: 'THE BLOOM', seq: 'ending_a', score: 'A',
      level: 'growthLevel', mult: 'bloom' },
    { key: 'B', id: 'the_fruiting_body', title: 'THE FRUITING BODY', seq: 'ending_b', score: 'B',
      level: 'coherenceLevel', mult: 'body' },
    { key: 'C', id: 'cede', title: 'THE INHERITANCE', seq: 'ending_c_press', score: 'C',
      level: 'divergenceLevel', mult: 'inherit' },
    { key: 'ENCYST', id: 'encyst', title: 'ENCYST', seq: 'encyst', score: 'encyst',
      level: null, mult: 'encyst' }
  ]

  // §10.6's named builds, as genomes. The harness that proves D27 — three endings, each reachable
  // by at least two distinct playstyles — needs two *different* builds per ending, and these are
  // the six the balance document names. They are never shown in game.
  var BUILDS = {
    BALANCED: [2, 2, 4, 2, 2, 2, 1, 1],
    GLUTTON: [0, 1, 8, 3, 1, 1, 2, 0],
    VANGUARD: [6, 4, 2, 1, 1, 1, 1, 0],
    ENCYSTED: [1, 2, 3, 1, 2, 6, 1, 0],
    MONASTIC: [1, 2, 4, 1, 2, 0, 2, 0],
    SWARM: [2, 3, 4, 6, 2, 0, 0, 4]
  }
  var REACHED_BY = { A: ['GLUTTON', 'VANGUARD'], B: ['MONASTIC', 'ENCYSTED'], C: ['SWARM', 'BALANCED'] }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE STATE
  // ───────────────────────────────────────────────────────────────────────────

  // Everything that must survive a reload lives in `a3.fin`; everything that must not is here.
  var arriving = null         // the pulse record being delivered, for entrain()'s falloff
  var driving = ''            // '' | 'ending' | 'offer' | 'newgrowth' — which clock advanceReal owns
  var frameSeen = false       // an rAF has driven us at least once, so the sim must not double-step
  var framed = false          // the rAF subscription is permanent; loop has no way to unsubscribe
  var lastFrameMs = 0
  var pristineRivals = null   // world.js's own four strains, before any defector took a seat

  // §3's a3 block enumerates the entities. The finale's counters — whether the wheel has been
  // seeded, whether a Successor ever existed, the fidelity integral, which ending is running and
  // how far into it we are — have nowhere else to live and must survive a reload, so they live in
  // one named sub-object, exactly as divergence.js's own counters do.
  function block (s) {
    if (!s.a3.fin || typeof s.a3.fin !== 'object') {
      s.a3.fin = {
        seeded: 0, succEver: 0,
        fidAcc: 0, fidT: 0,
        ending: '', endT: 0, seq: 0, done: 0, button: 0,
        offered: 0, offerT: 0,
        relaxRef: -1, relaxT: 0, drifted: 0
      }
    }
    return s.a3.fin
  }

  function bandCount (s) {
    var n = T().A3.BANDS
    if (s && s.a3 && s.a3.bands && s.a3.bands.phase) n = Math.min(n, s.a3.bands.phase.length)
    return n
  }

  function inVoid (s) {
    return s.phase === 'void' || s.phase === 'dismantle' || s.phase === 'ended'
  }

  // The phase system is not a background process: it exists from the moment J2 is bought and not
  // one tick before. Until then ϒ reads its free-running value, because that is what thirteen
  // uncoupled populations are already doing — the project buys the instrument, not the physics.
  function livePhase (s) {
    return !!(s && s.act === 3 && inVoid(s) && flagOn(s, 'circadian_entrainment'))
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE PHASE MODEL — `03` §19.1
  // ───────────────────────────────────────────────────────────────────────────

  // period_b = 300·(1 + 0.22·b), compressed to 300·(1 + 0.121·b) by J3 · ISOCHRONY. The spread of
  // periods is the whole difficulty: identical periods would need no pulses at all.
  function period (b, state) {
    var s = state || S()
    var a = A()
    var slope = a.PERIOD_SLOPE * (flagOn(s, 'isochrony') ? a.ISO_COMPRESS : 1)
    return a.PERIOD_BASE * (1 + slope * Math.max(0, Math.floor(b)))
  }

  function omega (b, state) { return 1 / period(b, state) }

  function phaseOf (b, state) {
    var s = state || S()
    var i = Math.floor(num(b))
    if (!s || !s.a3.bands || i < 0 || i >= bandCount(s)) return 0
    return frac(s.a3.bands.phase[i])
  }

  function phaseArray (s) {
    var n = bandCount(s), out = new Array(n), b
    for (b = 0; b < n; b++) out[b] = frac(s.a3.bands.phase[b])
    return out
  }

  // m_b = n_b / Σn. An empty void weights every band alike rather than dividing by zero: with no
  // craft anywhere there is no fleet whose agreement could be measured, and 1/13 each is the
  // arrangement that says so.
  function fleetWeights (s) {
    var n = bandCount(s), w = new Array(n), b, tot = 0
    for (b = 0; b < n; b++) { w[b] = Math.max(0, num(s.a3.bands.n[b])); tot += w[b] }
    if (!(tot > 0)) { for (b = 0; b < n; b++) w[b] = 1 / n; return w }
    for (b = 0; b < n; b++) w[b] /= tot
    return w
  }

  // The Kuramoto order parameter: ϒ = |Σ m_b·e^{2πiφ_b}|. One is perfect agreement; thirteen
  // populations with different periods and nothing coupling them sit near 0.31.
  function orderParam (phases, w) {
    var x = 0, y = 0, i
    for (i = 0; i < phases.length; i++) {
      x += w[i] * Math.cos(TAU * phases[i])
      y += w[i] * Math.sin(TAU * phases[i])
    }
    return { x: x, y: y, r: Math.sqrt(x * x + y * y), ang: Math.atan2(y, x) / TAU }
  }

  function measure (s) {
    return C().clamp(orderParam(phaseArray(s), fleetWeights(s)).r, 0, 1)
  }

  function upsilon (state) {
    var s = state || S()
    if (!s) return 0
    if (!livePhase(s)) return A().UPSILON_FREE
    return measure(s)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RELAXATION — the offline promise of §19.5, performed on the phases
  // ───────────────────────────────────────────────────────────────────────────

  // ϒ is derived, so "ϒ relaxes toward 0.31 while you are away" has to be performed on the thing it
  // is derived from. The phases are blended toward one of two reference arrangements — thirteen
  // equal steps around the circle (what uncoupled oscillators become) or agreement — and the blend
  // is bisected until the order parameter lands on the wanted value. r is monotone in the blend on
  // both branches, so a bisection is exact, deterministic and allocation-light.
  //
  // A fleet concentrated in one band cannot decohere however long you are away, and that is
  // correct: ϒ is fleet-weighted, and a fleet that is all in one place agrees with itself.
  function blended (dev, target, u) {
    var out = new Array(dev.length), i
    for (i = 0; i < dev.length; i++) out[i] = dev[i] * (1 - u) + target[i] * u
    return out
  }

  // The most disagreeing arrangement this fleet can hold. Heaviest band first, each one placed
  // opposite the running resultant — the standard greedy for cancelling a weighted vector sum, and
  // the reason it has to be mass-aware is that ϒ is: thirteen bands spread evenly around the circle
  // are still 0.71 synchronous if the inner three carry half the craft.
  function spreadTarget (w) {
    var n = w.length, idx = [], i, b
    for (i = 0; i < n; i++) idx.push(i)
    idx.sort(function (p, q) { return w[q] - w[p] })
    var out = new Array(n), x = 0, y = 0, ang
    for (i = 0; i < n; i++) {
      b = idx[i]
      ang = (x === 0 && y === 0) ? 0 : Math.atan2(y, x) + Math.PI
      out[b] = wrapHalf(ang / TAU)
      x += w[b] * Math.cos(ang)
      y += w[b] * Math.sin(ang)
    }
    return out
  }

  function pull (s, want) {
    var n = bandCount(s)
    if (n <= 0) return 0
    var w = fleetWeights(s)
    var ph = phaseArray(s)
    var res = orderParam(ph, w)
    var cur = res.r
    if (Math.abs(want - cur) < FIN.RELAX_EPS) return cur
    var psi = res.ang, dev = new Array(n), i
    var spreading = want < cur
    // Maximal disagreement when spreading, dead agreement when concentrating.
    var target = spreading ? spreadTarget(w) : new Array(n)
    for (i = 0; i < n; i++) {
      dev[i] = wrapHalf(ph[i] - psi)
      if (!spreading) target[i] = 0
    }
    var lo = 0, hi = 1, mid, k, r
    for (k = 0; k < FIN.RELAX_ITERS; k++) {
      mid = (lo + hi) / 2
      r = orderParam(blended(dev, target, mid), w).r
      if (r > want) { if (spreading) lo = mid; else hi = mid } else { if (spreading) hi = mid; else lo = mid }
    }
    var u = (lo + hi) / 2
    var out = blended(dev, target, u)
    for (i = 0; i < n; i++) s.a3.bands.phase[i] = frac(psi + out[i])
    return orderParam(phaseArray(s), w).r
  }

  // The relaxation is measured from the agreement the player left behind, not from whatever the
  // last macro-step's advance happened to produce. Offline runs 240 steps of ~90 s each, and each
  // of those advances the phases by a third of a period or more — a decay written against the
  // post-advance reading would settle at whatever fixed point that jumping happens to have rather
  // than at the published free-running value.
  function relax (s, fin, dt) {
    var free = A().UPSILON_FREE
    fin.relaxT = num(fin.relaxT) + Math.max(0, dt)
    var r = pull(s, free + (num(fin.relaxRef) - free) * Math.exp(-num(fin.relaxT) / FIN.RELAX_TAU))
    // Latched inside the absence, not on the first live tick: the return screen is assembled the
    // instant reconciliation finishes, which is before any live tick has run.
    fin.drifted = (num(fin.relaxRef) - r >= FIN.DRIFT_NOTICE) ? 1 : 0
    return r
  }

  // The wheel appears at ϒ ≈ 0.31 (§19.4's −20:00 row). The arrangement is drawn from the world
  // seed so the same galaxy always opens on the same disagreement, and then relaxed onto the
  // free-running value so the number under the wheel is the published one on the first frame.
  function seedPhases (s) {
    var n = bandCount(s), b
    for (b = 0; b < n; b++) {
      s.a3.bands.phase[b] = C().hash32(s.seed, 'phase', b) / 4294967296
    }
    pull(s, A().UPSILON_FREE)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ENTRAIN — `03` §19.2, the Kuramoto coupling term, applied once per arrival
  // ───────────────────────────────────────────────────────────────────────────

  // 0.82^|b − epicentre|. cognition owns the falloff; this is the fallback for a call that did not
  // come through a delivered pulse record.
  function strengthFor (s, b) {
    if (arriving && arriving.band === b) return arriving.strength
    var epi = Math.floor(num(s.cog.pulseEpicentre))
    if (HY.cognition && HY.cognition.pulseStrength) return num(HY.cognition.pulseStrength(epi, b))
    return Math.pow(T().A2.PULSE_FALLOFF, Math.abs(b - epi))
  }

  // φ_b ← φ_b + K·strength_b·sin(2π(φ_e − φ_b))/2π, at the moment the pulse ARRIVES, against the
  // epicentre's phase *then*. The player fires against a prediction; this function only ever sees
  // the answer. Antiphase is a fixed point of sin() and it is meant to be: a band exactly opposite
  // the epicentre cannot be told which way to turn, and the fix is to aim somewhere else.
  function entrain (band, epicentrePhaseAtArrival, state) {
    var s = state || S()
    if (!s || !livePhase(s)) return 0
    var b = Math.floor(num(band))
    if (!(b >= 0 && b < bandCount(s))) return 0
    var str = strengthFor(s, b)
    if (!(str > 0)) return 0
    var here = frac(s.a3.bands.phase[b])
    var d = A().K_ENTRAIN * str * Math.sin(TAU * (frac(epicentrePhaseAtArrival) - here)) / TAU
    s.a3.bands.phase[b] = frac(here + d)
    return d
  }

  // cognition delivers one record per band, each at its own LAG_T·R_b, so this is called thirteen
  // times per ENTRAIN pulse across two minutes of real time — which is the mechanic.
  function onPulse (ev) {
    if (!ev || ev.mode !== 'ENTRAIN') return
    var s = S()
    if (!s || !livePhase(s)) return
    var b = Math.floor(num(ev.band))
    if (!(b >= 0 && b < bandCount(s))) return
    arriving = { band: b, strength: num(ev.strength) }
    entrain(b, phaseOf(Math.floor(num(ev.epicentre)), s))
    arriving = null
    // The return screen's one finale line asks for a decision, and this is the decision.
    block(s).drifted = 0
  }

  // J5 · CHRONOMETRY's dotted projection: where a band's phase will be in τ seconds. Fired against
  // the band's own arrival lag, this is exactly the prediction the player has to make by eye if
  // they did not buy it.
  function projectPhase (band, tau) {
    var s = S()
    if (!s) return 0
    var b = Math.floor(num(band))
    if (!(b >= 0 && b < bandCount(s))) return 0
    return frac(num(s.a3.bands.phase[b]) + omega(b, s) * num(tau))
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE SUCCESSOR'S DESYNC — `03` §15.3
  // ───────────────────────────────────────────────────────────────────────────

  function succShare (b, s) {
    if (HY.divergence && HY.divergence.succShare) return num(HY.divergence.succShare(b, s))
    if (!s.a3.succ || !s.a3.succ.w) return 0
    var w = Math.max(0, num(s.a3.succ.w[b]))
    var mine = Math.max(0, num(s.a3.bands.n[b]))
    return w + mine > 0 ? w / (w + mine) : 0
  }

  // It does not attack the ending. It makes the ending harder to aim: every band it occupies
  // acquires a random walk proportional to how much of that band is it rather than you.
  function desync (s, dt) {
    if (!s.a3.succ || !(dt > 0)) return 0
    var q = Math.floor(s.t / FIN.DESYNC_QUANT)
    var r = C().rng(C().hash32(s.seed, 'desync', q))
    var k = A().DESYNC_K, n = bandCount(s), b, share, moved = 0
    for (b = 0; b < n; b++) {
      share = succShare(b, s)
      if (!(share > 0)) continue
      var d = k * share * r.gauss() * dt
      s.a3.bands.phase[b] = frac(s.a3.bands.phase[b] + d)
      moved += Math.abs(d)
    }
    return moved
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BIBLE §4 STEP 13 — advance, arrivals, recompute, desync, in that order
  // ───────────────────────────────────────────────────────────────────────────

  function stepPhase (dt, opts, state) {
    var s = state || S()
    if (!s) return
    var o = opts || {}
    var fin = block(s)
    if (!livePhase(s)) {
      s.a3.upsilon = A().UPSILON_FREE
      return
    }
    if (!fin.seeded) { seedPhases(s); fin.seeded = 1 }
    // The relaxation is measured from the agreement the player walked away from, so the reference
    // is taken before the first macro-step advances anything.
    if (o.offline && !(num(fin.relaxRef) >= 0)) { fin.relaxRef = measure(s); fin.relaxT = 0 }

    var n = bandCount(s), b
    if (dt > 0) for (b = 0; b < n; b++) s.a3.bands.phase[b] = frac(s.a3.bands.phase[b] + omega(b, s) * dt)

    // Step 12 has already delivered this frame's arrivals through onPulse → entrain().
    // Offline, no pulse ever arrives and the fleet falls back toward its free-running disagreement.
    // Nothing here touches a3.bands.n: you lose the phase lock, never a craft.
    if (o.offline) relax(s, fin, dt)
    else if (num(fin.relaxRef) >= 0) { fin.relaxRef = -1; fin.relaxT = 0 }

    s.a3.upsilon = measure(s)

    // Desync last, as §4 orders it: the number the player reads is the one their own pulses
    // produced, and the Successor's jitter shows on the dots a frame later.
    if (o.stochastic !== false && !o.offline) desync(s, dt)
  }

  // What the phase wheel is drawn from (canvas.drawWheel) and what the screen reader is told.
  function wheel (state) {
    var s = state || S()
    if (!s) return null
    var n = bandCount(s), b
    var ph = phaseArray(s), w = fleetWeights(s), proj = null
    if (flagOn(s, 'chronometry')) {
      proj = new Array(n)
      for (b = 0; b < n; b++) {
        proj[b] = projectPhase(b, HY.cognition && HY.cognition.bandLag ? num(HY.cognition.bandLag(b)) : 0)
      }
    }
    return {
      live: livePhase(s),
      phases: ph,
      mass: w,
      projected: proj,
      upsilon: livePhase(s) ? measure(s) : A().UPSILON_FREE,
      ring: A().BLOOM_Y
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE THREE ENDINGS AND THE CONCESSION — `03` §20, BIBLE §5.4 and D27
  // ───────────────────────────────────────────────────────────────────────────

  function byKey (id) {
    var k = String(id === undefined || id === null ? '' : id).toUpperCase(), i
    for (i = 0; i < ENDINGS.length; i++) {
      if (ENDINGS[i].key === k || ENDINGS[i].id === String(id)) return ENDINGS[i]
    }
    return null
  }

  function effFid (s) {
    if (HY.bloom && HY.bloom.effFid) return num(HY.bloom.effFid(s))
    var a = A()
    return C().clamp(num(s.carry.fidelityBase) + a.FID_PER_FID_LOCUS * num(s.a3.loci[6]) -
      a.FID_PER_ANT_LOCUS * num(s.a3.loci[ANT]) + num(s.mult.boughtFid), a.FID_MIN, a.FID_MAX)
  }

  function livingStrains (s) {
    var out = s.a3.strains || [], i, k = 0
    for (i = 0; i < out.length; i++) if (out[i] && out[i].genome) k++
    return k
  }

  function totalCraft (s) {
    var i, t = 0
    for (i = 0; i < s.a3.bands.n.length; i++) t += Math.max(0, num(s.a3.bands.n[i]))
    return t
  }

  // The Successor is the wild once it has formed — divergence empties `strains` into it — so a
  // wild total that only counts `strains` reads zero at exactly the moment ENDING C is about it.
  function totalWild (s) {
    if (HY.divergence && HY.divergence.totalWild) return num(HY.divergence.totalWild(s))
    var w = 0, i, j, st = s.a3.strains || []
    for (i = 0; i < st.length; i++) if (st[i] && st[i].w) for (j = 0; j < st[i].w.length; j++) w += num(st[i].w[j])
    if (s.a3.succ && s.a3.succ.w) for (j = 0; j < s.a3.succ.w.length; j++) w += num(s.a3.succ.w[j])
    return w
  }

  function occupiedBands (s) {
    var n = bandCount(s), b, k = 0
    for (b = 0; b < n; b++) if (num(s.a3.bands.n[b]) > 0) k++
    return k
  }

  function succDistance (s) {
    if (!s.a3.succ || !s.a3.succ.genome) return 0
    var d = 0, i
    for (i = 0; i < s.a3.loci.length; i++) d += Math.abs(num(s.a3.succ.genome[i]) - num(s.a3.loci[i]))
    return d
  }

  function succAge (s) {
    return s.a3.succ ? s.t - num(s.a3.succ.born) : -1
  }

  function cond (id, label, have, want, ok) {
    return { id: id, label: label, have: have, want: want, ok: !!ok }
  }

  // Each ending's requirement profile, as rows. The rows exist so that the endings the player did
  // not take can be shown at the end, greyed, with the exact conditions they failed — which is the
  // reason there is a second playthrough (BIBLE D27).
  function conditions (key, state) {
    var s = state || S()
    var a = A(), out = []
    var ups = livePhase(s) ? measure(s) : num(s.a3.upsilon)
    var fin = block(s)
    if (key === 'A') {
      out.push(cond('upsilon', 'SYNCHRONY', ups, a.BLOOM_Y, ups >= a.BLOOM_Y))
      out.push(cond('carbon', 'CARBON', num(s.res.carbon), a.BLOOM_X, num(s.res.carbon) >= a.BLOOM_X))
      out.push(cond('insight', 'INSIGHT', num(s.res.insight), a.BLOOM_PSI, num(s.res.insight) >= a.BLOOM_PSI))
      out.push(cond('signal', 'SIGNAL HELD', num(s.res.signal), a.BLOOM_SIG, num(s.res.signal) >= a.BLOOM_SIG))
      out.push(cond('bands', 'BANDS', occupiedBands(s), bandCount(s), occupiedBands(s) >= bandCount(s)))
      return out
    }
    if (key === 'B') {
      out.push(cond('upsilon', 'SYNCHRONY', ups, a.BODY_Y, ups >= a.BODY_Y))
      out.push(cond('carbon', 'CARBON', num(s.res.carbon), a.BODY_X, num(s.res.carbon) >= a.BODY_X))
      out.push(cond('insight', 'INSIGHT', num(s.res.insight), a.BODY_PSI, num(s.res.insight) >= a.BODY_PSI))
      out.push(cond('fidelity', 'FIDELITY', effFid(s), a.BODY_FID, effFid(s) >= a.BODY_FID))
      out.push(cond('strains', 'LINEAGES', livingStrains(s), 0, livingStrains(s) === 0))
      // "No Successor ever formed" is a fact about the whole run, not about now: purging it does
      // not un-form it. It is latched in this module's own block the tick it first exists.
      out.push(cond('successor', 'NO SUCCESSOR', num(fin.succEver), 0, !fin.succEver && !s.a3.succ))
      return out
    }
    if (key === 'C') {
      var age = succAge(s), wild = totalWild(s), mine = totalCraft(s)
      out.push(cond('successor', 'SUCCESSOR', s.a3.succ ? 1 : 0, 1, !!s.a3.succ))
      out.push(cond('age', 'AGE', Math.max(0, age), a.SUCC_CEDE_AGE, age >= a.SUCC_CEDE_AGE))
      out.push(cond('sequenced', 'SEQUENCED', s.a3.succ && s.a3.succ.sequenced ? 1 : 0, 1,
        !!(s.a3.succ && s.a3.succ.sequenced)))
      out.push(cond('mass', 'THEIRS', wild, 3 * mine, wild >= 3 * mine && wild > 0))
      return out
    }
    if (key === 'ENCYST') {
      var since = inVoid(s) ? s.t - num(s.proj.flags.void_t) : 0
      // A stranded run satisfies the row outright: there is no fleet left to wait with, so waiting
      // twenty minutes for it would be twenty minutes of a frozen board (`08` §5.3 L5).
      var strand = !!(HY.bloom && HY.bloom.stranded && HY.bloom.stranded(s))
      out.push(cond('void', 'IN THE VOID', strand ? a.ENCYST_S : Math.max(0, since),
        a.ENCYST_S, strand || since >= a.ENCYST_S))
      return out
    }
    return out
  }

  function unmetOf (rows) {
    var out = [], i
    for (i = 0; i < rows.length; i++) if (!rows[i].ok) out.push(rows[i].id)
    return out
  }

  function available (key, state) {
    return unmetOf(conditions(key, state)).length === 0
  }

  // Every ending, always, with its conditions — including after one has been taken, when the three
  // not taken are still on the screen and still say exactly what they wanted.
  function endings (state) {
    var s = state || S()
    var fin = block(s)
    var out = [], i, rows
    for (i = 0; i < ENDINGS.length; i++) {
      rows = conditions(ENDINGS[i].key, s)
      out.push({
        key: ENDINGS[i].key,
        id: ENDINGS[i].id,
        title: ENDINGS[i].title,
        taken: fin.ending === ENDINGS[i].key,
        available: unmetOf(rows).length === 0,
        greyed: !!fin.ending && fin.ending !== ENDINGS[i].key,
        visible: true,
        conditions: rows,
        unmet: unmetOf(rows)
      })
    }
    return out
  }

  // A | B | C | null, with the unmet conditions carried along. The taken ending wins; then the
  // first available in catalogue order; then the nearest one, so the readout is never blank while
  // the player is working toward something.
  //
  // ENCYST is answering a different question and is never reported here unless it has actually been
  // taken. Its only condition is twenty minutes in the void, so from void + 20:00 it is permanently
  // "available" — and a readout that says so says it for the whole of the last hundred minutes,
  // over the top of the three endings the act is about. Measured, that ended every run at void +
  // 20:00: the reference player asks this function what is available, is told ENCYST, and concedes
  // a hundred minutes early with ϒ at its free-running 0.31, two bands occupied and 101 Ψ. The
  // concession is not hidden by this — `endings()` still lists all four rows with their conditions
  // and `encyst` is a pinned card on the board from the moment it opens (§5.4). It is simply not
  // the answer to "which ending is this run walking toward".
  function endingAvailable (state) {
    var s = state || S()
    if (!s || s.act !== 3) return null
    var list = endings(s), i, best = null
    for (i = 0; i < list.length; i++) if (list[i].taken) return list[i]
    for (i = 0; i < list.length; i++) {
      if (list[i].key === 'ENCYST') continue
      if (list[i].available) return list[i]
    }
    for (i = 0; i < list.length; i++) {
      if (list[i].key === 'ENCYST') continue
      if (!best || list[i].unmet.length < best.unmet.length) best = list[i]
    }
    return best
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE DISMANTLE AND THE ENDING CLOCK — `09` §5
  // ───────────────────────────────────────────────────────────────────────────

  // Nine seconds, five stages, silent. Paperclips ends with a clip counter and a button; HYPHAE
  // ends with nothing at all, and the nothing has to be arrived at rather than cut to.
  function dismantleAt (t) {
    var closed = [], i
    for (i = 0; i < PANELS.length; i++) if (t >= i * FIN.STAGE_S) closed.push(PANELS[i])
    return {
      t: t,
      closed: closed,
      stage: closed.length,
      stripGone: closed.indexOf('strip') >= 0,
      done: t >= FIN.DISMANTLE_S
    }
  }

  function takeEnding (id, state) {
    var s = state || S()
    if (!s || s.act !== 3) return false
    var e = byKey(id)
    if (!e) return false
    var fin = block(s)
    if (fin.ending) return false

    fin.ending = e.key
    fin.endT = 0
    fin.seq = 0
    fin.done = 0
    fin.button = 0
    s.phase = 'dismantle'
    // The project's own effect counts the ending it sold. A direct call — the harness, or a UI that
    // reached the verb another way — must count it exactly once too.
    if (!flagOn(s, e.id)) s.stats.endingsReached = num(s.stats.endingsReached) + 1

    if (s === S()) {
      driving = 'ending'
      // The dismantle is silent: no line fires during it (09 §5).
      if (HY.log && HY.log.freeze) HY.log.freeze()
      if (HY.state && HY.state.save) { try { HY.state.save() } catch (err) { void 0 } }
    }
    return true
  }

  function startSequence (s, fin) {
    var e = byKey(fin.ending)
    if (!e) return
    fin.seq = 1
    var tokens = null
    // The only two live tokens in three acts of ending text. {clock} is the real elapsed run time,
    // said once, in the ending that is about a thing which has stopped changing. {k} is
    // Σ|succ.genome − yourGenome|, rendered in words by log's own formatter: the sentence is the
    // same and the number is yours.
    if (e.key === 'B') tokens = { clock: num(s.t) }
    if (e.key === 'C') tokens = { k: succDistance(s) }
    if (HY.feel && HY.feel.score) { try { HY.feel.score(e.score) } catch (err) { void 0 } }
    if (HY.log && HY.log.playSequence) {
      HY.log.playSequence(e.seq, {
        tokens: tokens,
        onStep: function (st) { if (st && st.kind === 'button') fin.button = 1 }
      })
    }
  }

  // ENDING C is offered, not achieved: J9 sits in the list with an empty price for as long as the
  // Successor lives, and the offer plays once when the conditions first close.
  function offerCede (s, fin) {
    fin.offered = 1
    fin.offerT = 0
    if (s !== S()) return
    driving = 'offer'
    if (HY.log && HY.log.playSequence) HY.log.playSequence('ending_c_offer')
  }

  // One real-time clock for every paced thing this module owns. Real seconds, not sim seconds: the
  // words of an ending are paced in the player's time, and the rAF is what measures that. When
  // there is no rAF — the harness, a headless build — the sim step calls this instead, at the same
  // rate, because dt there is real seconds too.
  function advanceReal (dt) {
    var s = S()
    if (!s || !(dt > 0)) return
    var fin = block(s)

    if (driving === 'ending') {
      fin.endT = num(fin.endT) + dt
      if (!fin.seq) {
        if (fin.endT >= FIN.DISMANTLE_S) startSequence(s, fin)
        return
      }
      if (HY.log && HY.log.stepSequence) HY.log.stepSequence(dt)
      if (!fin.done && HY.log && HY.log.sequenceActive && !HY.log.sequenceActive()) {
        fin.done = 1
        fin.button = 1
        s.phase = 'ended'
        driving = ''
        if (HY.state && HY.state.save) { try { HY.state.save() } catch (err) { void 0 } }
      }
      return
    }

    if (driving === 'offer') {
      fin.offerT = num(fin.offerT) + dt
      if (HY.log && HY.log.stepSequence) HY.log.stepSequence(dt)
      // The offer waits indefinitely and there is no second prompt, so the console is given back
      // the moment the last line has landed: the player dismisses it by playing on.
      if (fin.offerT >= FIN.OFFER_LAST) {
        driving = ''
        if (HY.log && HY.log.thaw) HY.log.thaw()
      }
    }
  }

  function onFrame (ts) {
    var t = typeof ts === 'number' ? ts : 0
    if (!frameSeen) { frameSeen = true; lastFrameMs = t; return }
    var dt = (t - lastFrameMs) / 1000
    lastFrameMs = t
    // A backgrounded tab returns with one enormous frame; an ending is not skipped by it.
    if (dt > 0 && dt < 1) advanceReal(dt)
  }

  // What the shell needs to paint the last twenty seconds of the game.
  function ending (state) {
    var s = state || S()
    if (!s) return null
    var fin = block(s)
    if (!fin.ending) {
      return fin.offered ? { key: '', offer: true, cede: fin.offerT >= FIN.OFFER_LAST } : null
    }
    var e = byKey(fin.ending)
    var d = dismantleAt(num(fin.endT))
    return {
      key: fin.ending,
      title: e ? e.title : '',
      dismantle: d,
      speaking: !!fin.seq,
      done: !!fin.done,
      button: fin.button ? 'NEW GROWTH' : '',
      sclerotium: sclerotiumGained(s)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // NEW GROWTH — `03` §21
  // ───────────────────────────────────────────────────────────────────────────

  // The time-weighted mean of effFid across the whole of Act III. It is an integral, not a
  // snapshot, which is why it is accumulated on every tick rather than read at the end: a run that
  // spent forty minutes at 0.51 and then bought four fidelity projects has not been faithful.
  function meanFidelity (state) {
    var s = state || S()
    var fin = block(s)
    if (num(fin.fidT) > 0) return num(fin.fidAcc) / num(fin.fidT)
    return effFid(s)
  }

  function strainsResolved (s) {
    // Quarantine deliberately does not count. It is the option that avoids the subject.
    return num(s.stats.purged) + num(s.stats.absorbed)
  }

  // §21.2. The ^0.42 on carbon is the anti-grind term: ten times the carbon is 2.63× the
  // sclerotium, so time spent grinding is worth less than time spent playing differently.
  function sclerotiumGained (state) {
    var s = state || S()
    var a = A()
    var fin = block(s)
    var mult = a.END_MULT[fin.ending ? (byKey(fin.ending) || {}).mult : 'bloom']
    if (!isFinite(mult)) mult = a.END_MULT.bloom
    var carb = Math.max(0, num(s.res.cumCarbon)) / a.SCL_CARB_REF
    var v = a.K_SCL *
      Math.pow(carb, a.SCL_CARB_EXP) *
      (1 + a.SCL_LEGACY * C().clamp(num(s.carry.legacy), 0, 1)) *
      (1 + a.SCL_FID * C().clamp(meanFidelity(s), 0, 1)) *
      (1 + a.SCL_STRAIN * strainsResolved(s)) *
      mult
    return isFinite(v) ? Math.floor(v) : 0
  }

  // Up to three genomes out: your own final one, plus the two most novel wild lineages. Novelty is
  // the L1 distance from what you finished as, so what comes back is what you least resemble.
  function buildArchive (state) {
    var s = state || S()
    var mine = [], i, k
    for (i = 0; i < s.a3.loci.length; i++) mine.push(s.a3.loci[i] | 0)

    var cand = [], seen = {}
    function offer (name, genome, born) {
      if (!name || !genome || seen[name]) return
      var g = [], d = 0
      for (k = 0; k < mine.length; k++) {
        g.push(num(genome[k]) | 0)
        d += Math.abs(num(genome[k]) - mine[k])
      }
      seen[name] = 1
      cand.push({ name: name, genome: g, novelty: d, born: num(born) })
    }

    var st = s.a3.strains || []
    for (i = 0; i < st.length; i++) if (st[i] && st[i].genome) offer(st[i].name, st[i].genome, st[i].born)
    if (s.a3.succ && s.a3.succ.lines) {
      for (i = 0; i < s.a3.succ.lines.length; i++) {
        var ln = s.a3.succ.lines[i]
        if (ln && ln.genome) offer(ln.name, ln.genome, ln.born)
      }
    }
    var lin = (s.meta && s.meta.lineages) || []
    for (i = 0; i < lin.length; i++) if (lin[i]) offer(lin[i].name, lin[i].genome, lin[i].born)

    cand.sort(function (a, b) { return b.novelty - a.novelty || (a.name < b.name ? -1 : 1) })
    var out = [{ name: '—', genome: mine, self: 1 }]
    for (i = 0; i < cand.length && out.length <= FIN.ARCHIVE_WILD; i++) {
      out.push({ name: cand[i].name, genome: cand[i].genome, born: cand[i].born })
    }
    return out.slice(0, T().A3.ARCHIVE_MAX)
  }

  // Every wild strain ever produced, uncapped (§0.2). divergence archives them as they are resolved;
  // the ones still alive at the ending — and the lines the Successor swallowed — have never been
  // resolved and would otherwise be the only defectors that never come back.
  function allLineages (s) {
    var out = (s.meta.lineages || []).slice(), seen = {}, i
    for (i = 0; i < out.length; i++) if (out[i]) seen[out[i].name] = 1
    function keep (e) {
      if (!e || !e.name || !e.genome || seen[e.name]) return
      var g = [], k
      for (k = 0; k < e.genome.length; k++) g.push(num(e.genome[k]) | 0)
      seen[e.name] = 1
      out.push({ name: e.name, genome: g, born: Math.round(num(e.born)) })
    }
    var st = s.a3.strains || []
    for (i = 0; i < st.length; i++) keep(st[i])
    if (s.a3.succ && s.a3.succ.lines) for (i = 0; i < s.a3.succ.lines.length; i++) keep(s.a3.succ.lines[i])
    return out
  }

  // The one block a prestige does not clear, as it will be after this run. Pure: New Growth builds
  // it, the run-summary reads it, and the selftest can check it without ending anybody's game.
  function nextMeta (state) {
    var s = state || S()
    var fin = block(s)
    var e = byKey(fin.ending)
    var m = {
      sclerotium: num(s.meta.sclerotium) + sclerotiumGained(s),
      upgrades: (s.meta.upgrades || []).slice(),
      growthLevel: num(s.meta.growthLevel),
      coherenceLevel: num(s.meta.coherenceLevel),
      divergenceLevel: num(s.meta.divergenceLevel),
      archive: buildArchive(s),
      lineages: allLineages(s),
      runs: num(s.meta.runs) + 1
    }
    // Exactly one counter moves, and ENCYST moves none: a concession is not an ending.
    if (e && e.level) m[e.level] = num(m[e.level]) + 1
    return m
  }

  // Every module, in boot order, because a New Growth is a cold boot that keeps `meta`.
  var MODULES = ['log', 'projects', 'act1', 'economy1', 'cognition', 'world', 'forest',
    'flush', 'pactbook', 'bloom', 'divergence', 'finale', 'feel', 'canvas', 'ui']

  // It is not "do it again, faster" — Act I still takes two hours and nothing skips it. It is "do
  // it again, knowing": your own defectors come back by name into Act II's rival seats, you now
  // know that the soil you left sets the fidelity you start Act III with, and two of the three
  // endings are structurally invisible on a first playthrough.
  function newGrowth () {
    var s = S()
    if (!s) return null
    var meta = nextMeta(s)
    // Ecotype is the only thing that re-rolls the board; without it run 2 is the same sixty-one
    // regions and a completely different decision, which is the point of the whole prestige.
    var seed = (meta.upgrades.indexOf('ecotype') >= 0)
      ? C().hash32(s.seed, 'ecotype', meta.runs)
      : s.seed

    var fresh = HY.state.newGame(seed, meta)
    HY.state.init(fresh)
    var live = S()

    driving = ''
    frameSeen = false
    var i, m
    for (i = 0; i < MODULES.length; i++) {
      m = HY[MODULES[i]]
      if (m && m.init) { try { m.init(live) } catch (err) { void 0 } }
    }
    if (HY.ui && HY.ui.setAct) { try { HY.ui.setAct(1) } catch (err) { void 0 } }
    if (HY.feel && HY.feel.setAct) { try { HY.feel.setAct(1) } catch (err) { void 0 } }
    if (HY.loop && HY.loop.setSimRate) HY.loop.setSimRate(T().CLOCK.SIM_HZ_A1)

    // 09 §5.5: no summary screen. The console opens on the same five words as the very first line
    // of the game — which log.init has just spoken, because a New Growth *is* a cold boot — and on
    // run 2+ the correction of the player's assumption arrives fourteen seconds later. That line is
    // a guarded fire site in log's own catalogue, so it is fired rather than re-authored, and it is
    // not played as a sequence: the sequence would speak the opening line a second time.
    if (HY.log && HY.log.logLater) HY.log.logLater('x.new_growth', 14)
    if (HY.state && HY.state.save) { try { HY.state.save() } catch (err) { void 0 } }
    return live
  }

  // ───────────────────────────────────────────────────────────────────────────
  // YOUR PAST, AS THE ANTAGONIST — `03` §21.4
  // ───────────────────────────────────────────────────────────────────────────

  // Two of Act II's four strains are replaced by defectors from previous runs, projected onto the
  // rival parameters. You meet a fungus called Vorense on the forest floor ninety minutes into a
  // new run and it fights the way you built it ninety minutes into your last Act III.
  //
  // world.js publishes RIVALS as the seat table precisely so a seat can be taken; the pristine four
  // are kept here so that re-projecting, or a run with an empty archive, restores the forest.
  function seatFor (list, taken, agg) {
    var best = -1, bv = Infinity, i, d
    for (i = 0; i < list.length; i++) {
      if (taken[i]) continue
      d = Math.abs(num(list[i].agg) - agg)
      if (d < bv) { bv = d; best = i }
    }
    return best
  }

  function projectRivals (archive) {
    var W = HY.world
    if (!W || !W.RIVALS || !W.RIVALS.length) return 0
    var list = W.RIVALS, i, k
    if (!pristineRivals) {
      pristineRivals = []
      for (i = 0; i < list.length; i++) {
        pristineRivals.push({
          key: list[i].key, name: list[i].name, gamma: list[i].gamma,
          agg: list[i].agg, line: list[i].line
        })
      }
    }
    for (i = 0; i < list.length; i++) {
      list[i].key = pristineRivals[i].key
      list[i].name = pristineRivals[i].name
      list[i].gamma = pristineRivals[i].gamma
      list[i].agg = pristineRivals[i].agg
      list[i].line = pristineRivals[i].line
      list[i].resilience = 1
      list[i].defector = 0
    }

    var arch = archive || [], defectors = []
    for (i = 0; i < arch.length && defectors.length < FIN.RIVAL_SEATS; i++) {
      if (!arch[i] || arch[i].self || !arch[i].name || !arch[i].genome) continue
      defectors.push(arch[i])
    }
    if (!defectors.length) return 0

    var taken = {}, placed = 0
    for (k = 0; k < defectors.length; k++) {
      var g = defectors[k].genome
      var agg = FIN.RIVAL_AGG_A + FIN.RIVAL_AGG_B * num(g[ANT])
      var grow = FIN.RIVAL_GROW_A + FIN.RIVAL_GROW_B * num(g[SPO])
      var res = FIN.RIVAL_RES_A + FIN.RIVAL_RES_B * num(g[MEL])
      var seat = seatFor(list, taken, agg)
      if (seat < 0) break
      taken[seat] = 1
      list[seat].name = defectors[k].name
      list[seat].agg = agg
      list[seat].gamma = pristineRivals[seat].gamma * grow
      list[seat].resilience = res
      list[seat].defector = 1
      // The seat's first-contact line names the organism that used to sit in it, so a defector
      // arrives without one. It has a name on the card, which is the whole of what §21.4 promises.
      list[seat].line = null
      entrench(seat, res)
      placed++
    }
    return placed
  }

  // Resilience is how firmly it already holds what it holds. Applied to the seats a defector took
  // at worldgen, so a melanised defector starts entrenched rather than merely present.
  function entrench (seat, res) {
    var s = S()
    if (!s || !(res > 1) || !s.a2 || !s.a2.regions || !s.a2.regions.rival) return
    var r = s.a2.regions, i
    for (i = 0; i < r.rival.length; i++) {
      if (r.rival[i] === seat) r.rivalStr[i] = C().clamp(num(r.rivalStr[i]) * res, 0, 1)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE LIFECYCLE
  // ───────────────────────────────────────────────────────────────────────────

  // `03` §19.5: synchrony is the only presence-gated content in HYPHAE, and the one thing the
  // return screen has to say about it is that it is gone. It is a *need*, not a gain — the fourth
  // kind of line D36 reserves for what wants a decision — so it is registered as a row in log's own
  // needs table rather than copied into a second catalogue this module would have to keep in step.
  // Rank 95 puts it above a starving band: nothing else on the return screen is time-critical.
  function registerReturnNeed () {
    if (!HY.log || !HY.log.NEEDS) return
    var i
    for (i = 0; i < HY.log.NEEDS.length; i++) if (HY.log.NEEDS[i].kind === 'phase_drift') return
    HY.log.NEEDS.push({
      kind: 'phase_drift', act: 3, rank: 95, text: 'The bands have fallen out of step.'
    })
  }

  // What the return screen should say about the finale, if anything. Empty on every absence that
  // did not cost a phase lock, which is every absence before the last twenty minutes.
  function returnNeeds (state) {
    var s = state || S()
    if (!s) return []
    return block(s).drifted ? [{ kind: 'phase_drift', tokens: null }] : []
  }

  function step (dt, opts) {
    var s = S()
    if (!s || s.act !== 3) return
    var o = opts || {}
    var fin = block(s)

    // The fidelity integral runs across the whole act, both phases, online and off: it is what
    // "how much of yourself you kept" means, and it is worth 1.85× on the prestige.
    if (dt > 0) {
      fin.fidAcc = num(fin.fidAcc) + effFid(s) * dt
      fin.fidT = num(fin.fidT) + dt
    }
    // A Successor that has been purged still formed. ENDING B asks about the run, not about now.
    if (s.a3.succ) fin.succEver = 1

    stepPhase(dt, o, s)

    if (!o.offline) {
      // A purchase of J7/J8/J9/J10 sets phase = 'dismantle' in step 15, one step after this one.
      if (!fin.ending && s.phase === 'dismantle') {
        var e = detectEnding(s)
        if (e) takeEnding(e.key, s)
      }
      if (!fin.ending) {
        if (!fin.offered && available('C', s)) offerCede(s, fin)
        // The offer stands until the Successor dies or the player presses it.
        if (fin.offered && !s.a3.succ) { fin.offered = 0; if (driving === 'offer') driving = '' }
      }
      // Headless, or before the first animation frame, the sim is the only clock there is.
      if (!frameSeen && driving) advanceReal(dt)
    }
  }

  function detectEnding (s) {
    var i
    for (i = 0; i < ENDINGS.length; i++) if (flagOn(s, ENDINGS[i].id)) return ENDINGS[i]
    return null
  }

  function init (s) {
    s = s || S()
    arriving = null
    driving = ''
    frameSeen = false
    lastFrameMs = 0
    registerReturnNeed()
    if (!s) return
    var fin = block(s)
    // A reload during an ending replays it from the dismantle: the sequence player has no notion of
    // resuming mid-word, and nine seconds of silence is a cheaper price than half a sentence.
    if (fin.ending && !fin.done) {
      fin.seq = 0
      fin.endT = 0
      driving = 'ending'
      if (HY.log && HY.log.freeze) HY.log.freeze()
    }
    if (s.act === 3 && livePhase(s) && !fin.seeded) { seedPhases(s); fin.seeded = 1 }
    projectRivals(s.meta ? s.meta.archive : null)
    // Once only: init runs again on every New Growth, and a second subscription would advance every
    // ending at double speed for the rest of the session.
    if (!framed && HY.loop && HY.loop.onFrame) { framed = true; HY.loop.onFrame(onFrame) }
  }

  function tick (s, dt, o) {
    s = s || S()
    if (!s || s.act !== 3 || !(dt > 0)) return
    step(dt, o)
  }

  function serialise () { return null }        // every persistent byte lives in §3's a3.fin
  function migrate () { return true }

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — the free-run, the coordination problem, and D27
  // ───────────────────────────────────────────────────────────────────────────

  // A sandbox, so nothing here can perturb a live run. Every function that matters takes its state
  // explicitly for that reason, and the ones with side effects check `state === S()` first.
  function sandbox (opts) {
    var o = opts || {}
    var s = HY.state.newGame(0x9E3779B9, { sclerotium: 0, upgrades: [], runs: 0 })
    var b, n = T().A3.BANDS
    s.act = 3
    s.phase = 'void'
    s.proj.flags.void_t = 0
    s.proj.flags.circadian_entrainment = 1
    if (o.iso) s.proj.flags.isochrony = 1
    s.carry.legacy = 0.35
    s.carry.fidelityBase = A().FID_BASE_A + A().FID_BASE_B * 0.35
    // A real void fleet is heavier on the inside: Σm² over thirteen geometrically declining bands
    // is 0.124, and √(π·0.124/4) = 0.312, which is where the published free-run value comes from.
    var q = o.q === undefined ? 0.80 : o.q
    for (b = 0; b < n; b++) {
      s.a3.bands.n[b] = o.flat ? 1e12 : 1e12 * Math.pow(q, b)
      s.a3.bands.e[b] = 1
      s.a3.bands.phase[b] = C().hash32(s.seed, 'phase', b) / 4294967296
    }
    // Seeded already: the sandbox arranges its own phases, and stepPhase must relax the
    // arrangement under test rather than replacing it with the one J2 would have drawn.
    block(s).seeded = 1
    return s
  }

  function genome (s, name) {
    var g = BUILDS[name], i
    for (i = 0; i < g.length; i++) s.a3.loci[i] = g[i]
    return s
  }

  // Free-running: advance the phases with nothing coupling them and average the order parameter.
  function freeRun (s, seconds, dt) {
    var acc = 0, k = 0, steps = Math.round(seconds / dt), i, b, n = bandCount(s)
    for (i = 0; i < steps; i++) {
      for (b = 0; b < n; b++) s.a3.bands.phase[b] = frac(s.a3.bands.phase[b] + omega(b, s) * dt)
      acc += measure(s)
      k++
    }
    return { mean: acc / Math.max(1, k), last: measure(s) }
  }

  // The endgame, played. A pulse every `cd` seconds; each arrives band by band at its own
  // light-lag and couples that band to the epicentre's phase *at that moment*, with 0.82^d falloff.
  //
  // The epicentre is chosen the way a player with CHRONOMETRY chooses it: project every band to
  // where it will be when the pulse gets there, apply the coupling that epicentre would produce,
  // and keep the ring that leaves the fleet most in agreement. That is thirteen candidates and a
  // hundred and sixty-nine multiplications, and it is the whole skill of the last twenty minutes —
  // aiming at the crowd rather than at the outlier, two minutes early.
  function bandLagOf (b) {
    if (HY.cognition && HY.cognition.bandLag) return num(HY.cognition.bandLag(b))
    var a = T().A3
    return a.LAG_T * (b <= 0 ? 0 : a.R_BASE * Math.pow(a.R_GROWTH, b - 1))
  }

  function bestEpicentre (s, lag) {
    var n = bandCount(s), w = fleetWeights(s), horizon = lag[n - 1]
    var epi, b, best = 0, bv = -1
    var K = A().K_ENTRAIN, fall = T().A2.PULSE_FALLOFF
    for (epi = 0; epi < n; epi++) {
      var out = new Array(n)
      for (b = 0; b < n; b++) {
        var at = lag[b]
        var here = frac(s.a3.bands.phase[b] + omega(b, s) * at)
        var tgt = frac(s.a3.bands.phase[epi] + omega(epi, s) * at)
        var kicked = frac(here + K * Math.pow(fall, Math.abs(b - epi)) * Math.sin(TAU * (tgt - here)) / TAU)
        out[b] = frac(kicked + omega(b, s) * (horizon - at))
      }
      var r = orderParam(out, w).r
      if (r > bv) { bv = r; best = epi }
    }
    return best
  }

  function playEndgame (s, minutes, cd) {
    var t = 0, next = 0, dt = 0.5, n = bandCount(s), b, i
    var inflight = [], lag = []
    for (b = 0; b < n; b++) lag.push(bandLagOf(b))
    var pulses = 0
    while (t < minutes * 60) {
      for (b = 0; b < n; b++) s.a3.bands.phase[b] = frac(s.a3.bands.phase[b] + omega(b, s) * dt)
      t += dt
      if (t >= next) {
        var epi = bestEpicentre(s, lag)
        for (b = 0; b < n; b++) inflight.push({ b: b, epi: epi, at: t + lag[b] })
        next = t + cd
        pulses++
      }
      for (i = 0; i < inflight.length; i++) {
        if (inflight[i].at > t) continue
        var rec = inflight[i]
        var str = Math.pow(T().A2.PULSE_FALLOFF, Math.abs(rec.b - rec.epi))
        var here = frac(s.a3.bands.phase[rec.b])
        var tgt = frac(s.a3.bands.phase[rec.epi])
        s.a3.bands.phase[rec.b] = frac(here + A().K_ENTRAIN * str * Math.sin(TAU * (tgt - here)) / TAU)
        inflight.splice(i--, 1)
      }
    }
    return { upsilon: measure(s), pulses: pulses }
  }

  function __selftest () {
    var f = []
    function ok (c, label) { if (!c) f.push(label) }
    function near (a, b, tol, label) {
      if (!(Math.abs(a - b) <= tol)) f.push(label + ': got ' + a + ', want ' + b + ' ±' + tol)
    }
    if (!HY.state || !HY.state.newGame) return ['state.js is absent; finale cannot be checked']
    var a = A()

    // ── ϒ free-runs at 0.31 (BIBLE §7's Act III bring-up test) ───────────────
    var v = sandbox()
    var fr = freeRun(v, 20400, 1.7)
    near(fr.mean, a.UPSILON_FREE, 0.03, 'ϒ does not free-run at UPSILON_FREE with no input')
    ok(fr.last !== fr.mean, 'ϒ is pinned rather than free-running')

    // Nothing about the free run touches the fleet.
    var before = totalCraft(v)
    freeRun(v, 600, 1.0)
    near(totalCraft(v), before, 1e-6 * before, 'free-running the phases moved the fleet')

    // ── the coupling term ────────────────────────────────────────────────────
    // φ_e a quarter turn ahead of φ_b, at full strength: Δ = 0.55·sin(π/2)/2π = 0.0875.
    var e1 = sandbox()
    var i
    e1.a3.bands.phase[3] = 0
    arriving = { band: 3, strength: 1 }
    var d1 = entrain(3, 0.25, e1)
    near(d1, 0.0875, 5e-4, 'the entrainment step is not K/2π at quarter phase')
    near(frac(e1.a3.bands.phase[3]), 0.0875, 5e-4, 'the band did not move by the coupling term')
    // Distance costs: the same pulse eight rings out moves the band by 0.82^8 of that.
    e1.a3.bands.phase[3] = 0
    arriving = { band: 3, strength: Math.pow(T().A2.PULSE_FALLOFF, 8) }
    near(entrain(3, 0.25, e1), 0.0875 * Math.pow(T().A2.PULSE_FALLOFF, 8), 1e-5,
      'the falloff does not attenuate the coupling')
    // …and it converges: repeated coupling toward a fixed target closes the gap.
    e1.a3.bands.phase[3] = 0
    arriving = { band: 3, strength: 1 }
    for (i = 0; i < 60; i++) entrain(3, 0.25, e1)
    near(frac(e1.a3.bands.phase[3]), 0.25, 1e-3,
      'repeated entrainment does not converge on the epicentre phase')
    // Antiphase is a fixed point and it is meant to be: a band exactly opposite cannot be told
    // which way to turn, and the answer is to aim somewhere else.
    e1.a3.bands.phase[3] = 0
    near(entrain(3, 0.5, e1), 0, 1e-9, 'a band in antiphase was pushed one way or the other')
    arriving = null

    // The falloff is why one pulse cannot entrain the fleet: 0.82^12 is under a tenth.
    ok(Math.pow(T().A2.PULSE_FALLOFF, 12) < 0.10, 'the pulse falloff reaches the whole fleet')

    // ── the light-lag the finale is built on ─────────────────────────────────
    if (HY.cognition && HY.cognition.bandLag) {
      near(num(HY.cognition.bandLag(12)), 120, 2.0, 'a pulse to band 12 does not take 120 s')
      near(num(HY.cognition.bandLag(0)), 0, 1e-9, 'a pulse to band 0 is not instant')
    }

    // ── the coordination problem is solvable, and only by playing it ─────────
    // A player at the finale has bought J3 · ISOCHRONY: it is what puts the cooldown on 35 s and
    // compresses the period spread the pulses are fighting.
    var p = sandbox({ iso: true })
    var idle = freeRun(sandbox({ iso: true }), 18 * 60, 0.5).last
    var played = playEndgame(p, 18, 35)
    ok(played.upsilon >= a.BLOOM_Y,
      'eighteen minutes of aimed pulses did not reach ENDING A: ϒ ' + played.upsilon.toFixed(3))
    ok(played.pulses >= 12 && played.pulses <= 40,
      'the endgame took ' + played.pulses + ' pulses, not the 12–16 the design describes')
    ok(played.upsilon > idle, 'pulsing is no better than doing nothing')

    // ── offline: ϒ relaxes toward 0.31, and no craft is lost ─────────────────
    var off = sandbox()
    var b
    for (b = 0; b < bandCount(off); b++) off.a3.bands.phase[b] = 0.4      // perfect agreement, ϒ = 1
    near(measure(off), 1, 1e-6, 'thirteen identical phases are not perfectly synchronous')
    var craft = totalCraft(off)
    var dtOff = (43200 * 0.5) / T().OFFLINE.STEPS
    for (i = 0; i < T().OFFLINE.STEPS; i++) stepPhase(dtOff, { stochastic: false, offline: true }, off)
    near(off.a3.upsilon, a.UPSILON_FREE, 0.03, 'ϒ did not relax toward its free-running value offline')
    near(totalCraft(off), craft, 1e-6 * craft, 'craft were lost offline')
    // The return screen is assembled the instant reconciliation finishes, so the one line it has
    // to say about the finale must already be armed by then.
    ok(returnNeeds(off).length === 1 && returnNeeds(off)[0].kind === 'phase_drift',
      'a lost phase lock is not reported on the return screen')
    if (HY.log && HY.log.NEEDS) {
      var need = null
      for (i = 0; i < HY.log.NEEDS.length; i++) if (HY.log.NEEDS[i].kind === 'phase_drift') need = HY.log.NEEDS[i]
      ok(need && need.act === 3 && need.text === 'The bands have fallen out of step.',
        'the return line is not registered in the needs table')
    }
    // …and it relaxes upward as well as downward.
    var up = sandbox()
    pull(up, 0.05)
    for (i = 0; i < T().OFFLINE.STEPS; i++) stepPhase(dtOff, { stochastic: false, offline: true }, up)
    near(up.a3.upsilon, a.UPSILON_FREE, 0.03, 'ϒ did not relax upward toward its free-running value')

    // ── the Successor makes it harder to aim ─────────────────────────────────
    var sc = sandbox()
    var quiet = playEndgame(sandbox(), 8, 35).upsilon
    sc.a3.succ = { genome: new Int8Array(8), w: new Float64Array(T().A3.BANDS), born: 0,
      linesShown: 0, name: '—', sequenced: false }
    for (b = 0; b < bandCount(sc); b++) sc.a3.succ.w[b] = sc.a3.bands.n[b] * 2
    var moved = 0
    for (i = 0; i < 400; i++) { sc.t += 0.05; moved += desync(sc, 0.05) }
    ok(moved > 0, 'the Successor injects no phase noise at all')
    ok(quiet > 0, 'the quiet endgame produced no synchrony to compare against')

    // ── D27 · three endings, each reachable by two distinct playstyles ───────
    var key, builds, j, st, reached
    var keys = ['A', 'B', 'C']
    for (i = 0; i < keys.length; i++) {
      key = keys[i]
      builds = REACHED_BY[key]
      reached = 0
      for (j = 0; j < builds.length; j++) {
        st = playstyle(key, builds[j])
        if (available(key, st)) reached++
        else f.push('ENDING ' + key + ' is unreachable by ' + builds[j] + ': unmet ' +
          unmetOf(conditions(key, st)).join(','))
      }
      ok(reached >= 2, 'ENDING ' + key + ' is reachable by fewer than two playstyles')
    }

    // ── D27 · mutually exclusive, and the exclusion is structural ────────────
    var bState = playstyle('B', 'MONASTIC')
    var cState = playstyle('C', 'SWARM')
    ok(!available('C', bState), 'a FRUITING BODY run can also CEDE')
    ok(!available('B', cState), 'an INHERITANCE run can also become a FRUITING BODY')
    // Once a Successor has existed, B is closed forever however perfect everything else becomes.
    var closed = playstyle('B', 'MONASTIC')
    block(closed).succEver = 1
    ok(!available('B', closed), 'ENDING B reopened after a Successor had formed')
    ok(unmetOf(conditions('B', closed)).join(',') === 'successor',
      'the closed FRUITING BODY does not name the Successor as its one unmet condition')
    // C cannot be reached in under coalescence + age, so from a strain-free run the two paths have
    // already separated with more than half an hour left in them.
    ok(a.SUCC_TRIGGER_T + a.SUCC_CEDE_AGE >= 1900,
      'ENDING C is available less than half an hour after a run commits to it')

    // ── the paths not taken stay visible and greyed ──────────────────────────
    var end = playstyle('A', 'GLUTTON')
    takeEnding('A', end)
    var rows = endings(end)
    ok(rows.length === 4, 'the ending screen does not still list all four')
    var greyed = 0, listed = 0
    for (i = 0; i < rows.length; i++) {
      if (rows[i].taken) continue
      greyed += rows[i].greyed ? 1 : 0
      listed += rows[i].conditions.length > 0 ? 1 : 0
      ok(rows[i].visible, 'the ' + rows[i].key + ' path is hidden at the ending')
    }
    ok(greyed === 3, 'the three paths not taken are not greyed')
    ok(listed === 3, 'a path not taken does not still say what it wanted')
    ok(end.phase === 'dismantle', 'taking an ending did not begin the dismantle')
    ok(!takeEnding('B', end), 'a second ending was taken after the first')

    // ── the concession never stands in front of an ending ────────────────────
    // ENCYST clears its one condition twenty minutes into the void and never stops clearing it, so
    // a readout that reports it reports it for the rest of the run. Measured, that ended every
    // reference run at void + 20:00.
    var conc = playstyle('ENCYST', 'BALANCED')
    ok(available('ENCYST', conc), 'ENCYST is not available twenty minutes into the void')
    var pick = endingAvailable(conc)
    ok(pick && pick.key !== 'ENCYST', 'the concession was offered as the ending in reach')
    var stillListed = 0
    var encRows = endings(conc)
    for (i = 0; i < encRows.length; i++) if (encRows[i].key === 'ENCYST' && encRows[i].available) stillListed = 1
    ok(stillListed, 'ENCYST stopped being listed as an option at all')
    var reach = playstyle('A', 'GLUTTON')
    reach.t = a.ENCYST_S + 1
    var pickA = endingAvailable(reach)
    ok(pickA && pickA.key === 'A' && pickA.available,
      'ENDING A was not the ending in reach on a run that had cleared it')

    // ── the dismantle: reverse order of acquisition, nine seconds, then nothing ─
    var d0 = dismantleAt(0)
    ok(d0.closed.length === 1 && d0.closed[0] === 'lineages',
      'the dismantle does not begin with LINEAGES')
    ok(dismantleAt(FIN.STAGE_S * 3).closed.join(',') === 'lineages,genome,fleet,void',
      'the panels do not close in reverse order of acquisition')
    ok(dismantleAt(FIN.DISMANTLE_S).stripGone, 'the status strip survives the dismantle')
    ok(!dismantleAt(FIN.DISMANTLE_S - 0.1).done && dismantleAt(FIN.DISMANTLE_S).done,
      'the dismantle is not nine seconds long')

    // ── the ending text is 09's, and it is rendered ──────────────────────────
    if (HY.log && HY.log.SEQUENCES) {
      for (i = 0; i < ENDINGS.length; i++) {
        var seq = HY.log.SEQUENCES[ENDINGS[i].seq]
        ok(!!seq, 'the ' + ENDINGS[i].key + ' sequence is missing from the catalogue')
        if (!seq) continue
        var spoke = 0, btn = 0, k
        for (k = 0; k < seq.steps.length; k++) {
          if (seq.steps[k].kind === 'line') spoke++
          if (seq.steps[k].kind === 'button') btn++
        }
        ok(spoke >= 3, ENDINGS[i].key + ' renders fewer than three lines')
        ok(btn === 1, ENDINGS[i].key + ' does not end on exactly one button')
      }
      // The two live tokens interpolate rather than printing their braces.
      var bLine = 'It is finished at {clock} by your clock.'
      var got = HY.log.interpolate(bLine, { clock: 24072 }, null, null)
      ok(got.indexOf('{clock}') < 0 && got.indexOf('06:41:12') > 0,
        'ENDING B does not print the run clock: ' + got)
      var cLine = 'carrying a genome with {k} differences from yours,'
      var gotc = HY.log.interpolate(cLine, { k: 406 }, null, { k: 'kwords' })
      ok(gotc.indexOf('four hundred and six differences') > 0,
        'ENDING C does not render its difference count in words: ' + gotc)
    }

    // ── the prestige formula, against §21.2's worked example ─────────────────
    var w = sandbox()
    w.res.cumCarbon = 2.0e35
    w.carry.legacy = 0.35
    block(w).fidAcc = 0.88
    block(w).fidT = 1
    w.stats.purged = 12
    w.stats.absorbed = 0
    block(w).ending = 'A'
    near(sclerotiumGained(w), 1092, 2, 'the sclerotium formula does not match the worked example')
    // ^0.42 is the anti-grind term: ten times the carbon is 2.63× the reward, not ten.
    var base = sclerotiumGained(w)
    w.res.cumCarbon = 2.0e36
    near(sclerotiumGained(w) / base, 2.63, 0.02, 'the anti-grind exponent is not 0.42')
    w.res.cumCarbon = 2.0e35
    // The ending multipliers, in the order the design states them.
    block(w).ending = 'B'
    var body = sclerotiumGained(w)
    block(w).ending = 'C'
    var inh = sclerotiumGained(w)
    block(w).ending = 'ENCYST'
    var enc = sclerotiumGained(w)
    near(body / base, a.END_MULT.body, 0.01, 'THE FRUITING BODY does not pay 1.15×')
    near(inh / base, a.END_MULT.inherit, 0.01, 'THE INHERITANCE does not pay 1.30×')
    near(enc / base, a.END_MULT.encyst, 0.01, 'ENCYST does not pay a third')
    ok(enc > 0, 'ENCYST pays nothing, which would make it a failure screen')
    // meanFidelity is an integral, not a snapshot: forty minutes at 0.51 is not a faithful run.
    block(w).fidAcc = 0.51 * 2400 + 0.99 * 600
    block(w).fidT = 3000
    near(meanFidelity(w), 0.606, 1e-3, 'the fidelity mean is not time-weighted')

    // ── what carries over, and what does not ─────────────────────────────────
    var g = sandbox()
    genome(g, 'SWARM')
    g.res.cumCarbon = 2.0e35
    g.meta.sclerotium = 40
    g.meta.lineages = [
      { name: 'Vorense', genome: [2, 3, 4, 6, 2, 0, 0, 8], born: 100 },
      { name: 'Ithoides', genome: [2, 3, 4, 6, 2, 0, 0, 4], born: 200 },
      { name: 'Calaster', genome: [2, 3, 4, 6, 2, 0, 0, 5], born: 300 }
    ]
    block(g).ending = 'C'
    var meta = nextMeta(g)
    ok(meta.sclerotium > 40, 'New Growth did not add the run to the meta-currency')
    ok(meta.divergenceLevel === 1 && meta.growthLevel === 0 && meta.coherenceLevel === 0,
      'the wrong ending counter moved')
    ok(meta.runs === 1, 'the run counter did not move')
    ok(meta.archive.length === 3, 'the archive is not three genomes')
    ok(meta.archive[0].self === 1 && meta.archive[0].genome.join(',') === BUILDS.SWARM.join(','),
      'your own final genome did not carry over')
    ok(meta.archive[1].name === 'Vorense',
      'the most novel defector is not first out: got ' + meta.archive[1].name)
    // A defector still alive at the ending has never been resolved, so nothing else would ever
    // archive it — and it is the one the next run most deserves to meet.
    g.a3.strains = [{ name: 'Sennoids', genome: new Int8Array([2, 3, 4, 6, 2, 0, 0, 7]), w: [], born: 900 }]
    var withLive = nextMeta(g).lineages.map(function (x) { return x.name })
    ok(withLive.indexOf('Sennoids') >= 0, 'a strain alive at the ending was not archived')
    ok(withLive.length === 4, 'the lineage ledger duplicated a name: ' + withLive.join(','))
    g.a3.strains = []
    // ENCYST moves no counter at all.
    block(g).ending = 'ENCYST'
    var m2 = nextMeta(g)
    ok(m2.growthLevel + m2.coherenceLevel + m2.divergenceLevel === 0,
      'ENCYST incremented an ending counter')

    // Everything that is not meta is destroyed: the next run is a cold boot that remembers.
    var run2 = HY.state.newGame(g.seed, meta)
    ok(run2.act === 1 && run2.phase === 'understory', 'New Growth did not return to Act I')
    ok(run2.res.carbon === 0 && run2.res.insight === 0 && run2.res.alleles === 0,
      'a resource survived New Growth')
    ok(run2.a3.loci[2] === 0 && run2.a3.lociCap === a.LOCI_CAP0, 'the genome survived New Growth')
    ok(run2.meta.sclerotium === meta.sclerotium && run2.meta.archive.length === 3,
      'the meta block did not survive New Growth')
    // The one line in the game that acknowledges a previous run is a guarded fire site, and the
    // guard is the ending counters this module just moved.
    if (HY.log && HY.log.BY_ID && HY.log.BY_ID['x.new_growth']) {
      var ngl = HY.log.BY_ID['x.new_growth']
      ok(!!ngl.guard && ngl.guard(run2), 'the run-2 line will not fire after an ending')
      ok(!ngl.guard(HY.state.newGame(g.seed, null)), 'the run-2 line fires on a first run')
    }

    // ── your own defectors come back, by name ────────────────────────────────
    if (HY.world && HY.world.RIVALS) {
      var seats = HY.world.RIVALS
      var placed = projectRivals(meta.archive)
      ok(placed === 2, 'the archive did not take two of the four rival seats: ' + placed)
      var names = [], aggs = {}, i2
      for (i2 = 0; i2 < seats.length; i2++) { names.push(seats[i2].name); aggs[seats[i2].name] = seats[i2] }
      // Ithoides is SWARM's own genome exactly and is therefore the *least* novel of the three:
      // what comes back is what you least resemble.
      ok(names.indexOf('Vorense') >= 0 && names.indexOf('Calaster') >= 0 &&
        names.indexOf('Ithoides') < 0,
        'the defectors are not on the forest floor by name: ' + names.join(','))
      var vor = aggs.Vorense
      near(vor.agg, FIN.RIVAL_AGG_A + FIN.RIVAL_AGG_B * 8, 1e-9,
        'the defector fights with the wrong aggression')
      near(vor.resilience, FIN.RIVAL_RES_A + FIN.RIVAL_RES_B * 2, 1e-9,
        'the defector holds ground with the wrong resilience')
      ok(vor.defector === 1, 'the defector seat is not marked as one')
      ok(vor.line === null, 'a defector fires the console line of the strain it replaced')
      // Restoring is exact: a run with an empty archive meets the forest world.js generated.
      projectRivals([])
      var restored = 0
      for (i2 = 0; i2 < seats.length; i2++) {
        if (seats[i2].name === pristineRivals[i2].name && seats[i2].agg === pristineRivals[i2].agg &&
            seats[i2].gamma === pristineRivals[i2].gamma) restored++
      }
      ok(restored === seats.length, 'the pristine forest did not come back with an empty archive')
    }

    // ── the gates read the live world, not a snapshot ────────────────────────
    var liveS = S()
    if (liveS && liveS.act !== 3) {
      ok(endingAvailable(liveS) === null, 'an ending was offered outside Act III')
    }
    return f
  }

  // A state that a named build would actually be in at the moment its ending unlocks. Everything
  // here is a gate input and nothing is a fudge: the fidelity comes from LEGACY plus the build's
  // own FID loci plus the four fidelity projects, and the carbon and Insight are the published
  // requirements.
  function playstyle (key, buildName) {
    var a = A()
    var s = sandbox()
    genome(s, buildName)
    var b
    if (key === 'A') {
      pull(s, a.BLOOM_Y + 0.01)
      s.res.carbon = a.BLOOM_X * 1.01
      s.res.cumCarbon = 1.3e35
      s.res.insight = a.BLOOM_PSI
      s.res.signal = a.BLOOM_SIG
      for (b = 0; b < bandCount(s); b++) if (!(s.a3.bands.n[b] > 0)) s.a3.bands.n[b] = 1
      return s
    }
    if (key === 'B') {
      pull(s, a.BODY_Y + 0.005)
      s.res.carbon = a.BODY_X * 1.01
      s.res.cumCarbon = 2.0e35
      s.res.insight = a.BODY_PSI
      // A steward's Act II, plus all four fidelity projects (+0.190, inside the +0.24 cap).
      s.carry.legacy = 0.62
      s.carry.fidelityBase = a.FID_BASE_A + a.FID_BASE_B * 0.62
      s.mult.boughtFid = 0.190
      s.a3.strains = []
      s.a3.succ = null
      block(s).succEver = 0
      return s
    }
    if (key === 'C') {
      s.a3.succ = {
        genome: new Int8Array(BUILDS[buildName]), w: new Float64Array(T().A3.BANDS),
        born: 0, linesShown: 0, name: '—', sequenced: true, lines: []
      }
      s.a3.succ.genome[MEL] += 3
      s.t = a.SUCC_CEDE_AGE + 60
      for (b = 0; b < bandCount(s); b++) s.a3.succ.w[b] = s.a3.bands.n[b] * 3.2
      block(s).succEver = 1
      return s
    }
    s.t = a.ENCYST_S + 1
    return s
  }

  HY.finale = {
    // BIBLE §6 M15
    stepPhase: stepPhase,
    upsilon: upsilon,
    entrain: entrain,
    projectPhase: projectPhase,
    endingAvailable: endingAvailable,
    takeEnding: takeEnding,
    sclerotiumGained: sclerotiumGained,
    newGrowth: newGrowth,
    projectRivals: projectRivals,

    // the step loop.js drives (BIBLE §4 step 13) and the pulse arrival
    step: step,
    onPulse: onPulse,

    // §6's generic module surface
    init: init,
    tick: tick,
    serialise: serialise,
    migrate: migrate,

    // the readouts the UI, canvas, log and projects read across the boundary
    wheel: wheel,
    phaseOf: phaseOf,
    period: period,
    omega: omega,
    endings: endings,
    conditions: conditions,
    ending: ending,
    dismantleAt: dismantleAt,
    meanFidelity: meanFidelity,
    returnNeeds: returnNeeds,
    nextMeta: nextMeta,
    buildArchive: buildArchive,
    livePhase: livePhase,
    BUILDS: BUILDS,
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
