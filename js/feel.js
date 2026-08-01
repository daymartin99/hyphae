;(function (HY) {
  'use strict'

  // M18 · feel.js — audio, haptics and sub-second visual feedback (BIBLE §6 M18; doc 07).
  //
  // Zero assets. Every pitch is an integer harmonic of 55.000 Hz, every sound is a composition of
  // the six primitives of 07 §2.5, and the whole thing is silent until the player's first
  // pointerdown because browsers will not start an AudioContext without one — which is correct
  // behaviour we do not fight.
  //
  // TWO RULINGS WORTH READING BEFORE EDITING:
  //
  // 1. 07 §2.3 asks for `setInterval(bedTick, 200)`. BIBLE §4.2 permits exactly two setIntervals in
  //    the whole build and neither is ours. The 5 Hz bed clock therefore rides the callbacks that
  //    already exist — the frame loop when `HY.loop` is present, and our own `tick()` otherwise —
  //    gated on wall time so that being driven from both at once is harmless. There is no third
  //    timer. Everything else here is a one-shot setTimeout, which §4.2 does not restrict.
  //
  // 2. Sound defaults to SPARSE (BIBLE §3 `set.sound`, 07 §11.1), not to full. Nothing plays before
  //    a gesture, and the *bed* — the thing a player means when they say "the sound" — stays off
  //    until they accept the one-time offer at the first season turn. The choice lives in
  //    `state.set.sound` and persists with the save. No key is added to the §3 shape.

  // ───────────────────────────────────────────────────────────────────────────
  // CONSTANTS · 07 §12.3, widened to every number this file needs
  // ───────────────────────────────────────────────────────────────────────────

  var AUD = {
    mode: 'sparse',                  // off | sparse | full — mirrors state.set.sound
    F0: 55.0,
    master: 0.50,                    // −6 dB of headroom
    nowPad: 0.012,
    lookahead: 0.30,
    bedClockMs: 200,
    limiter: { threshold: -6, knee: 0, ratio: 20, attack: 0.003, release: 0.25 },

    palette: {
      1: [2, 3, 4, 5, 6, 8, 10, 12],
      2: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14],
      3: [8, 11, 13, 16, 17, 19, 21, 23],
      ng: [2, 3, 4, 5, 6, 8, 10, 12, 16, 24]
    },

    drone: {
      low: { det: 1.50, lp: 420, Q: 0.6, pan: -0.18, g: 0.115 },
      mid: { det: 1.20, lp: 1150, Q: 0.5, pan: 0.22, g: 0.072 },
      high: { det: 0.50, lp: 2400, Q: 0.4, pan: -0.05, g: 0.038 }
    },

    grain: {
      1: { mean: 11.0, decay: 2.6, g: 0.055, send: 0.34, pan: 0.55 },
      2: { mean: 7.5, decay: 3.2, g: 0.062, send: 0.42, pan: 0.65 },
      3: { mean: 14.0, decay: 5.0, g: 0.048, send: 0.58, pan: 0.80 }
    },

    air: { len: 11.13, lenLow: 5.57, rateB: 0.6180339, gA: 1.00, gB: 0.72,
           panA: -0.42, panB: 0.38, level: 0.020, Q: 0.85, lpHz: 1100, trim: 0.70 },

    ir: {
      SOIL: { tail: 1.90, preDelayMs: 11, buildSec: 0.14, hiHz: 3200, loFloorHz: 260,
              brightSec: 0.55, diffuse: 0.90, spreadMs: 3.5, targetRms: 0.045,
              seed: 0x48595048 + 1, taps: [[7, 0.30], [13, 0.22], [19, 0.17], [29, 0.12], [41, 0.09]] },
      CHAMBER: { tail: 3.40, preDelayMs: 19, buildSec: 0.22, hiHz: 5200, loFloorHz: 190,
                 brightSec: 1.10, diffuse: 0.86, spreadMs: 5.5, targetRms: 0.045,
                 seed: 0x48595048 + 2,
                 taps: [[11, 0.26], [18, 0.20], [27, 0.16], [37, 0.13], [53, 0.10], [71, 0.07]] },
      VOID: { tail: 6.40, preDelayMs: 34, buildSec: 0.55, hiHz: 7400, loFloorHz: 120,
              brightSec: 2.60, diffuse: 0.78, spreadMs: 9.0, targetRms: 0.045,
              seed: 0x48595048 + 3, taps: [[23, 0.14], [41, 0.11], [67, 0.08]] }
    },
    irDecay60: 6.908,                // ln(1000): exp(−t/tauA) is −60 dB at t = tail

    tier: {
      HIGH: { irScale: 1.00, irCh: 2, voices: 12, grainRate: 1.00, air2: true, cond: true },
      MID: { irScale: 0.80, irCh: 2, voices: 10, grainRate: 1.00, air2: true, cond: true },
      LOW: { irScale: 0.45, irCh: 1, voices: 6, grainRate: 0.60, air2: false, cond: false },
      FLOOR: { fdn: true, irScale: 0, irCh: 1, voices: 4, grainRate: 0.00, air2: false, cond: false }
    },

    fdn: [ { ms: 23.7, fb: 0.62, lp: 1600, pan: -0.35 },
           { ms: 31.1, fb: 0.58, lp: 1400, pan: 0.30 },
           { ms: 43.3, fb: 0.54, lp: 1150, pan: 0.00 } ],

    duck: [ null,
            { db: -1.5, atk: 40, rel: 600 },
            { db: -3.0, atk: 40, rel: 900 },
            { db: -5.0, atk: 60, rel: 1400 },
            { db: -9.0, atk: 120, rel: 2600 } ],

    ladder: [4, 5, 6, 8, 6, 5], ladderResetMs: 1200, ladderHoldStep: 2,

    session: { freeMin: 8, dbPerOct: -3.0, dbFloor: -9.0, tiltPerOct: -2.0, tiltFloor: -6.0,
               sparsePerOct: 0.50, tau: 30.0, resetAwayMs: 1200000 },

    gov: { maxPerSec: 9, coalesceMs: 250, coalesceN: 3, gateAfterVisibleMs: 400,
           coalesceGain: 1.35, coalesceHaptic: 12, transitionLeadMs: 250 },

    hap: { budgetMsPerSec: 60, maxPer10s: 12, lowBattery: 0.15, lowBudgetMsPerSec: 30,
           minMs: 4, lowScale: 0.5 },

    // ── primitive shapes (07 §2.5), stated in prose there and tabulated here ──
    pluck: { amps: [1.00, 0.28, 0.11], decayExp: 0.72, attack: 0.004, trans: 0.16, tail: 0.05 },
    knock: { transQ: 3.2, transA: 0.001, bodyA: 0.002, bodyAmp: 0.55, droop: 0.94 },
    stone: { cents: 14, lp: 900, Q: 0.7, attack: 0.002 },
    breath: { minAttack: 0.025, rateLo: 0.7, rateSpan: 0.6, Q: 1.1 },
    sweep: { Q: 6.0, sineMul: 0.251 },     // −12 dB on the sine riding the moving centre
    trans: { qMul: 1.6, Q: 1.4, attack: 0.0005, dur: 0.014 },
    noise: { whiteS: 1.00, pinkS: 2.00, offsetFrac: 0.8 },
    eps: 1e-4,                       // exponentialRamp cannot reach zero
    voiceRelease: 0.040,             // s — a stolen voice is released, never cut

    cond: { n2: 11, n3: 17, Q: 6.0, gain: 0.030, exp: 2.2, detune: 6.0, tau: 1.2, collapse: 0.18 },

    grainRule: { leap: 3, redraws: 6, gainLo: 0.70, gainSpan: 0.60, attack: 0.020,
                 panLo: 0.25, panSpan: 0.55 },

    // ── 07 §4.6, the twelve bindings ────────────────────────────────────────
    bind: {
      tiltHz: 2800,
      seasonTilt: [1.5, 2.5, 0.0, -5.0],          // SPRING SUMMER AUTUMN WINTER
      seasonHigh: [1.00, 1.15, 0.85, 0.45],
      seasonTau: 20,
      airMoistA: 0.55, airMoistB: 0.85, moistTau: 8,
      windFcA: 0.6, windTau: 12,
      sendA: 0.18, sendB: 0.30, sendTau: 15,
      fcGrainB: 1.9, fcLowB: 0.45, fcTau: 30,
      driftA: 0.5, driftB: 26, driftTau: 6,
      shadowN: 11, shadowK: 0.018, shadowTau: 4,
      syncPool: 8, syncJitter: 0.55, syncMean: 4.2, syncGainA: 0.048, syncGainB: 0.027, syncTau: 3
    },

    xfade: { ir: 0.60, palette: 6.0, unduck: 2.60, curveN: 33, mode: 6.0 },

    // 07 §10 lifecycle, §2.3 R6's rebase and §3.3's slicing budget. Seconds unless named ms.
    life: { sliceMs: 1.2, suspendFadeS: 0.035, suspendAtMs: 140, resumeFadeS: 0.13,
            offStopMs: 400, rebaseS: 1.4, ouCatchupMaxMs: 600000, ouStepS: 5,
            returnAwayMs: 60000, releaseMs: 200, modeFadeS: 0.10 },
    srDuck: { db: -6, ms: 2500 },     // 07 §11.2 — audio never competes with a screen reader

    // ── micro-feedback (07 §8) ──────────────────────────────────────────────
    fx: {
      rippleMs: 340, rippleAlpha: 0.16, rippleScale: 0.62,
      flashMs: 90, flashBigMs: 140, flashBigRatio: 8,
      revealMs: 320, dotHoldMs: 1200, dotFadeMs: 180, revealStaggerMs: 40,
      meterHot: 0.92, meterFull: 1.0, meterClear: 0.88, meterMs: 180,
      framesPerSec: 60, minMoveFrames: 2, extraDigits: 2,
      scrollIdleMs: 120
    }
  }

  // Act drone palettes (07 §4.2). `null` is a muted voice, not a missing one.
  var PALETTE = {
    1: { low: { 2: 1.00, 3: 0.42, 4: 0.26 },
         mid: { 5: 1.00, 6: 0.55, 8: 0.30 },
         high: { 10: 1.00, 12: 0.50, 16: 0.22 } },
    2: { low: { 2: 0.90, 3: 0.40, 4: 0.24, 7: 0.16 },
         mid: { 5: 0.85, 6: 0.50, 8: 0.30, 9: 0.22, 11: 0.14 },
         high: { 10: 0.90, 12: 0.46, 14: 0.28, 16: 0.20 } },
    3: { low: null,
         mid: { 8: 0.60, 11: 0.34, 13: 0.22 },
         high: { 16: 0.50, 17: 0.30, 19: 0.24, 23: 0.14 } },
    ng: { low: { 2: 1.00, 3: 0.42, 4: 0.26 },
          mid: { 5: 1.00, 6: 0.55, 8: 0.30, 16: 0.18 },
          high: { 10: 1.00, 12: 0.50, 16: 0.30, 24: 0.14 } }
  }

  // Grain partial pools with draw weights (07 §4.3), sorted ascending so the voice-leading rule
  // can measure a leap as a distance in index space.
  var GRAIN_POOL = {
    1: [[4, 2], [5, 3], [6, 3], [8, 4], [10, 3], [12, 2]],
    2: [[5, 2], [6, 2], [7, 3], [8, 3], [9, 3], [10, 2], [11, 2], [12, 2], [14, 1]],
    3: [[8, 3], [11, 2], [13, 2], [16, 3], [17, 2], [19, 2], [21, 1], [23, 1]]
  }

  // The nine Ornstein–Uhlenbeck modulators (07 §4.2). No LFO node exists in this build.
  var MOD_DEF = [
    { k: 'lowDet', th: 0.09, mu: 1.50, sg: 0.55, lo: 0.6, hi: 2.8 },
    { k: 'midDet', th: 0.11, mu: 1.20, sg: 0.45, lo: 0.5, hi: 2.4 },
    { k: 'highDet', th: 0.14, mu: 0.50, sg: 0.28, lo: 0.15, hi: 1.3 },
    { k: 'lowAmp', th: 0.06, mu: 1.00, sg: 0.16, lo: 0.72, hi: 1.22 },
    { k: 'midAmp', th: 0.08, mu: 1.00, sg: 0.22, lo: 0.55, hi: 1.30 },
    { k: 'highAmp', th: 0.10, mu: 0.85, sg: 0.30, lo: 0.30, hi: 1.35 },
    { k: 'airFc', th: 0.07, mu: Math.log(420), sg: 0.30, lo: Math.log(170), hi: Math.log(950) },
    { k: 'airAmp', th: 0.05, mu: 1.00, sg: 0.25, lo: 0.45, hi: 1.40 },
    { k: 'tilt', th: 0.04, mu: 0.0, sg: 0.45, lo: -3.5, hi: 1.5 }
  ]

  var T_SMOOTH = 0.9               // s — every OU value lands with setTargetAtTime, never a step

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE-LOCAL STATE
  // ───────────────────────────────────────────────────────────────────────────

  var ctx = null
  var ready = false
  var booted = false               // audioBoot() has run once, successfully or not
  var pendingResume = false
  var unavailable = false          // no AudioContext constructor on this platform at all

  var G = null                     // the bus graph
  var NB = {}                      // the baked noise library
  var IR = { name: '', active: 'A', pending: '' }
  var fdn = null

  var bed = null                   // { drone:{low,mid,high}, air, cond, shadow }
  var MODS = null
  var nextGrainAt = 0
  var lastGrainN = -1
  var lastGrainPan = 1
  var bedRunning = false
  var lastBedAt = 0

  var voices = []
  var deferred = []                // { at, fn } — pulse arrivals beyond the lookahead horizon
  var timers = []                  // every scheduled one-shot, so a skip can cancel all of them
  var hapticTimers = []

  var lastFired = {}
  var coalesce = {}
  var onsets = []
  var warnLatch = {}
  var meterLatch = {}

  var sessionStart = nowMs()
  var hiddenAt = 0
  var visibleAt = -Infinity        // rule 1 gates the return from hidden, never the cold boot
  var offlineMode = false
  var silenceUntil = 0
  var transitionUntil = 0
  var transitionOwns = false
  var scrolling = false
  var scrollTimer = 0
  var batteryScale = 1
  var hapEvents = []
  var hapMs = []
  var forceSync = false            // selftest only: run sliced jobs to completion inline
  var attached = false
  var ariaBound = false
  var curAct = 1
  var lastTapAt = 0
  var ladderI = 0

  // ───────────────────────────────────────────────────────────────────────────
  // LAZY NAMESPACE READS — load order must not matter for anything but `core`
  // ───────────────────────────────────────────────────────────────────────────

  function C () { return HY.core }
  function st () { try { return HY.state ? HY.state.state : null } catch (e) { return null } }
  function doc () { return typeof document === 'undefined' ? null : document }
  function win () { return typeof window === 'undefined' ? null : window }
  function nowMs () {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
  }

  function hz (n) { return AUD.F0 * n }
  function dbToLin (db) { return Math.pow(10, db / 20) }
  function clamp (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }

  // The audio RNG is seeded from the wall clock and is deliberately NOT the simulation's stream:
  // determinism of a save must not depend on how many sounds were played (07 §2.4 R8).
  var arnd = mulberry32((Date.now() & 0x7fffffff) | 1)

  function mulberry32 (a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0
      var t = Math.imul(a ^ a >>> 15, 1 | a)
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
  }

  function gauss () {
    var u = 1 - arnd()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * arnd())
  }

  function tierName () {
    var t = 'MID'
    try {
      if (HY.canvas && HY.canvas.tier) t = ('' + HY.canvas.tier).toUpperCase()
    } catch (e) { /* the canvas is optional; MID is the documented default */ }
    if (t === 'MED') t = 'MID'                      // 06 §7.8 spells it MED; 07 §3.4 spells it MID
    return AUD.tier[t] ? t : 'MID'
  }

  function tier () { return AUD.tier[tierName()] }

  function mode () {
    var s = st()
    var m = s && s.set && s.set.sound
    if (m === 'off' || m === 'sparse' || m === 'full') AUD.mode = m
    if (unavailable) return 'off'
    return AUD.mode
  }

  function hapticsOn () {
    var s = st()
    if (s && s.set && s.set.haptics === false) return false
    return true
  }

  function reducedMotion () {
    var s = st()
    if (s && s.set && s.set.reduceMotion !== null && s.set.reduceMotion !== undefined) {
      return !!s.set.reduceMotion
    }
    var w = win()
    if (!w || !w.matchMedia) return false
    try { return w.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false }
  }

  function later (ms, fn) {
    if (typeof setTimeout !== 'function') { fn(); return 0 }
    var id = setTimeout(function () {
      drop(timers, id)
      try { fn() } catch (e) { /* a timer is not a place to throw from */ }
    }, ms)
    timers.push(id)
    return id
  }

  function drop (arr, v) { var i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1) }

  function cancelTimers () {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i])
    timers.length = 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LIFECYCLE AND THE GESTURE GATE · 07 §2.1
  // ───────────────────────────────────────────────────────────────────────────

  // Called from the first pointerdown, and idempotent. If anything in here fails, the mode becomes
  // 'off' and every later call is a no-op: the game never throws because of audio.
  function audioBoot () {
    if (booted) {
      if (pendingResume) tryPendingResume()
      return
    }
    booted = true
    var w = win()
    var AC = w && (w.AudioContext || w.webkitAudioContext)
    if (!AC) { unavailable = true; AUD.mode = 'off'; return }
    try {
      ctx = new AC({ latencyHint: 'interactive' })     // never force sampleRate; read it
    } catch (e) {
      try { ctx = new AC() } catch (e2) { ctx = null }
    }
    if (!ctx) { unavailable = true; AUD.mode = 'off'; return }
    try {
      buildGraph()
      bakeNoise()
      scheduleIR(spaceFor(actOf()))
      ctx.onstatechange = function () {
        if (ctx && ctx.state === 'interrupted') pendingResume = true
      }
      var p = ctx.resume()
      if (p && p.then) p.then(onResumed, onResumed); else onResumed()
    } catch (e) {
      unavailable = true
      AUD.mode = 'off'
      ctx = null
    }
  }

  function onResumed () {
    ready = true
    bedStart()
  }

  function tryPendingResume () {
    if (!ctx) return
    pendingResume = false
    try { ctx.resume() } catch (e) { pendingResume = true }
  }

  function actOf () {
    var s = st()
    var a = s && s.act
    return a === 2 || a === 3 ? a : 1
  }

  function spaceFor (act) { return act === 3 ? 'VOID' : act === 2 ? 'CHAMBER' : 'SOIL' }

  // ───────────────────────────────────────────────────────────────────────────
  // THE BUS GRAPH · 07 §2.2 — 37 steady-state nodes
  // ───────────────────────────────────────────────────────────────────────────

  function gain (v) { var n = ctx.createGain(); n.gain.value = v; return n }

  function filt (type, f, q) {
    var n = ctx.createBiquadFilter()
    n.type = type
    n.frequency.value = f
    if (q !== undefined) n.Q.value = q
    return n
  }

  // StereoPannerNode is absent on some older WebKit builds. A missing panner costs the stereo
  // field, not the sound, so it degrades to a plain gain rather than to silence.
  function panner (p) {
    if (ctx.createStereoPanner) {
      var n = ctx.createStereoPanner()
      n.pan.value = clamp(p, -1, 1)
      return n
    }
    return gain(1)
  }

  function buildGraph () {
    var lim = ctx.createDynamicsCompressor()
    var L = AUD.limiter
    lim.threshold.value = L.threshold
    lim.knee.value = L.knee
    lim.ratio.value = L.ratio
    lim.attack.value = L.attack
    lim.release.value = L.release
    lim.connect(ctx.destination)

    var master = gain(AUD.master)
    master.connect(lim)

    var verbOut = gain(1)
    verbOut.connect(master)
    var convA = ctx.createConvolver(); convA.normalize = false
    var convB = ctx.createConvolver(); convB.normalize = false
    var xfA = gain(0), xfB = gain(0)
    convA.connect(xfA); xfA.connect(verbOut)
    convB.connect(xfB); xfB.connect(verbOut)
    var verbIn = gain(1)
    verbIn.connect(convA)
    verbIn.connect(convB)

    var uiGain = gain(1)
    uiGain.connect(master)
    var uiSend = gain(1)
    uiSend.connect(verbIn)

    var bedMix = gain(1)
    var bedTilt = filt('highshelf', AUD.bind.tiltHz)
    bedTilt.gain.value = 0
    var bedDuck = gain(1)
    var bedGain = gain(0)                     // the bed starts silent; only FULL mode raises it
    var bedSend = gain(AUD.bind.sendA)
    bedMix.connect(bedTilt)
    bedTilt.connect(bedDuck)
    bedDuck.connect(bedGain)
    bedDuck.connect(bedSend)
    bedGain.connect(master)
    bedSend.connect(verbIn)

    G = { lim: lim, master: master, verbIn: verbIn, verbOut: verbOut,
          convA: convA, convB: convB, xfA: xfA, xfB: xfB,
          uiGain: uiGain, uiSend: uiSend,
          bedMix: bedMix, bedTilt: bedTilt, bedDuck: bedDuck, bedGain: bedGain, bedSend: bedSend }

    if (tier().fdn) buildFDN()
  }

  // FLOOR fallback (07 §3.5): three mutually prime delays, each lowpassed in its feedback path.
  // Not beautiful. Present. That is the correct trade on a device already dropping frames.
  function buildFDN () {
    if (fdn || !G) return
    fdn = []
    for (var i = 0; i < AUD.fdn.length; i++) {
      var D = AUD.fdn[i]
      var dl = ctx.createDelay(1.0)
      dl.delayTime.value = D.ms / 1000
      var fb = gain(D.fb)
      var lp = filt('lowpass', D.lp, 0.7)
      var pan = panner(D.pan)
      G.verbIn.connect(dl)
      dl.connect(lp)
      lp.connect(fb)
      fb.connect(dl)
      lp.connect(pan)
      pan.connect(G.verbOut)
      fdn.push({ dl: dl, fb: fb, lp: lp, pan: pan })
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GENERATED BUFFERS · 07 §2.4
  // ───────────────────────────────────────────────────────────────────────────

  function whiteGen () { return function () { return arnd() * 2 - 1 } }

  // Kellett's pink filter, verbatim. Not a 1/f FFT.
  function pinkGen () {
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    return function () {
      var w = arnd() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.96900 * b2 + w * 0.1538520
      b3 = 0.86650 * b3 + w * 0.3104856
      b4 = 0.55000 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.0168980
      var out = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
      return out
    }
  }

  function fill (seconds, ch, gen) {
    var sr = ctx.sampleRate
    var n = Math.max(1, Math.round(seconds * sr))
    var buf = ctx.createBuffer(ch, n, sr)
    for (var c = 0; c < ch; c++) {
      var d = buf.getChannelData(c)
      var g = gen()
      for (var i = 0; i < n; i++) d[i] = g()
    }
    return buf
  }

  // AIR is pink through a one-pole lowpass at 1.1 kHz, trimmed. It is the only large buffer, so it
  // is generated in slices: 11.13 s of stereo is ~1.07 M samples and a straight-line fill would
  // blow the 8 ms main-thread budget on a phone.
  function airGen (sr) {
    var pink = pinkGen()
    var a = 1 - Math.exp(-2 * Math.PI * AUD.air.lpHz / sr)
    var lp = 0
    return function () {
      lp += a * (pink() - lp)
      return lp * AUD.air.trim
    }
  }

  function bakeNoise () {
    NB.white = fill(AUD.noise.whiteS, 1, whiteGen)
    NB.pink = fill(AUD.noise.pinkS, 1, pinkGen)
    NB.air = null
    var t = tier()
    var ch = t.air2 ? 2 : 1
    var secs = t.air2 ? AUD.air.len : AUD.air.lenLow
    var sr = ctx.sampleRate
    var n = Math.max(1, Math.round(secs * sr))
    var buf = ctx.createBuffer(ch, n, sr)
    var c = 0, i = 0, g = airGen(sr), d = buf.getChannelData(0)
    runSliced(function (deadline) {
      while (i < n) {
        d[i++] = g()
        if ((i & 0x3ff) === 0 && nowMs() > deadline) return false
      }
      c += 1
      if (c >= ch) return true
      d = buf.getChannelData(c); g = airGen(sr); i = 0
      return false
    }, function () { NB.air = buf; if (bedRunning) airStart() })
  }

  // One slicing runner for every expensive generator. ≤1.2 ms of work per frame; when there is no
  // rAF (the harness, the selftest) it runs to completion inline, which is the correct behaviour
  // for a context that is not painting anything.
  function runSliced (step, done) {
    var w = win()
    if (forceSync || !w || !w.requestAnimationFrame) {
      var guard = 0
      while (!step(Infinity) && ++guard < 1e6) { /* inline */ }
      done()
      return
    }
    var tick = function () {
      var deadline = nowMs() + AUD.life.sliceMs
      if (step(deadline)) done(); else w.requestAnimationFrame(tick)
    }
    w.requestAnimationFrame(tick)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // REVERB · 07 §3 — a procedurally generated impulse response
  // ───────────────────────────────────────────────────────────────────────────

  // Four things separate this from noise × exp(−t): pre-delay, discrete early reflections, a
  // density build-up ramp, and a lowpass whose cutoff falls over the tail. The last two are what
  // make it sound like a room rather than like a demo.
  function makeIRJob (P) {
    var sr = ctx.sampleRate
    var N = Math.max(1, Math.ceil(P.tail * sr))
    var ch = P.channels
    var buf = ctx.createBuffer(ch, N, sr)
    var rnd = mulberry32(P.seed)
    var tauA = P.tail / AUD.irDecay60
    var preD = Math.min(N - 1, Math.floor(P.preDelayMs / 1000 * sr))
    var c = -1, i = 0, lp = 0, sum = 0, phase = 3, d = null

    function openChannel () {
      c += 1
      if (c >= ch) return false
      d = buf.getChannelData(c)
      var skew = c ? P.spreadMs / 1000 : 0
      for (var k = 0; k < P.taps.length; k++) {
        var idx = Math.floor((P.taps[k][0] / 1000 + skew * (0.6 + 0.8 * rnd())) * sr)
        if (idx < N) d[idx] += P.taps[k][1] * (rnd() < 0.5 ? -1 : 1)
      }
      i = preD; lp = 0; sum = 0; phase = 0
      return true
    }

    function step (deadline) {
      for (;;) {
        if (phase === 3) {
          if (!openChannel()) { normaliseRMS(buf, P.targetRms); return true }
        }
        if (phase === 0) {                                   // the diffuse tail
          while (i < N) {
            var t = (i - preD) / sr
            var build = 1 - Math.exp(-t / P.buildSec)
            var env = Math.exp(-t / tauA) * build
            var fc = P.hiHz * Math.exp(-t / P.brightSec) + P.loFloorHz
            var a = 1 - Math.exp(-2 * Math.PI * fc / sr)
            lp += a * ((rnd() * 2 - 1) - lp)
            d[i] += lp * env * P.diffuse
            i += 1
            if ((i & 0xfff) === 0 && nowMs() > deadline) return false
          }
          i = 0; phase = 1
        }
        if (phase === 1) {                                   // DC measurement
          while (i < N) {
            sum += d[i]
            i += 1
            if ((i & 0xffff) === 0 && nowMs() > deadline) return false
          }
          sum /= N; i = 0; phase = 2
        }
        if (phase === 2) {                                   // DC removal
          while (i < N) {
            d[i] -= sum
            i += 1
            if ((i & 0xffff) === 0 && nowMs() > deadline) return false
          }
          phase = 3
        }
      }
    }

    return { step: step, buffer: buf }
  }

  // Spaces swap at matched loudness, so a tier change or an act transition never reads as a volume
  // change wearing a reverb costume.
  function normaliseRMS (buf, target) {
    var ch = buf.numberOfChannels, n = buf.length, sum = 0, c, i, d
    for (c = 0; c < ch; c++) {
      d = buf.getChannelData(c)
      for (i = 0; i < n; i++) sum += d[i] * d[i]
    }
    var rms = Math.sqrt(sum / Math.max(1, n * ch))
    if (!(rms > 0)) return
    var k = target / rms
    for (c = 0; c < ch; c++) {
      d = buf.getChannelData(c)
      for (i = 0; i < n; i++) d[i] *= k
    }
  }

  function irParams (name) {
    var P = AUD.ir[name]
    var t = tier()
    var out = {}
    for (var k in P) if (Object.prototype.hasOwnProperty.call(P, k)) out[k] = P[k]
    out.tail = P.tail * (t.irScale || 1)
    out.channels = t.irCh
    return out
  }

  function scheduleIR (name) {
    if (!ctx || !G) return
    if (tier().fdn) { buildFDN(); IR.name = name; return }
    if (IR.pending === name) return
    IR.pending = name
    var job = makeIRJob(irParams(name))
    runSliced(job.step, function () {
      IR.pending = ''
      installIR(name, job.buffer)
    })
  }

  // Two convolvers, always, with an equal-power crossfade — so the room can change during a
  // transition without a gap. The idle convolver's buffer is nulled after the fade, which is what
  // actually releases the memory.
  function installIR (name, buffer) {
    if (!G || !ctx) return
    var toB = IR.active === 'A'
    var inNode = toB ? G.convB : G.convA
    var inGain = toB ? G.xfB : G.xfA
    var outNode = toB ? G.convA : G.convB
    var outGain = toB ? G.xfA : G.xfB
    try { inNode.buffer = buffer } catch (e) { return }
    var t = ctx.currentTime
    var dur = IR.name ? AUD.xfade.ir : 0.01
    equalPower(inGain.gain, outGain.gain, t, dur)
    IR.active = toB ? 'B' : 'A'
    IR.name = name
    later(dur * 1000 + 60, function () {
      if (IR.active !== (toB ? 'B' : 'A')) return
      try { outNode.buffer = null } catch (e) { /* some engines refuse null; the gain is 0 either way */ }
    })
  }

  function equalPower (up, down, t, dur) {
    var n = AUD.xfade.curveN
    var a = new Float32Array(n), b = new Float32Array(n)
    for (var i = 0; i < n; i++) {
      var x = i / (n - 1) * Math.PI / 2
      a[i] = Math.sin(x)
      b[i] = Math.cos(x)
    }
    try {
      up.cancelScheduledValues(t); down.cancelScheduledValues(t)
      up.setValueCurveAtTime(a, t, dur)
      down.setValueCurveAtTime(b, t, dur)
    } catch (e) {
      up.setValueAtTime(1, t); down.setValueAtTime(0, t)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // VOICES · 07 §5.5 G3 — polyphony cap, stealing, release
  // ───────────────────────────────────────────────────────────────────────────

  // Every sound owns one gain node between its content and the bus. That node is what makes a
  // stolen voice releasable over 40 ms instead of cut, and a cut voice is a click.
  function voice (weight, out, send) {
    if (!ctx || !G) return null
    steal()
    var v = { at: ctx.currentTime, w: weight || 0, g: gain(1), send: null, dead: false }
    v.g.connect(out || G.uiGain)
    if (send > 0) {
      v.send = gain(send)
      v.g.connect(v.send)
      v.send.connect(out === G.bedMix ? G.bedSend : G.uiSend)
    }
    voices.push(v)
    return v
  }

  function endVoice (v) {
    if (!v || v.dead) return
    v.dead = true
    drop(voices, v)
    try { v.g.disconnect() } catch (e) { /* already gone */ }
    if (v.send) { try { v.send.disconnect() } catch (e) { /* already gone */ } }
  }

  function releaseVoice (v) {
    if (!v || v.dead) return
    var t = ctx.currentTime
    try {
      v.g.gain.cancelScheduledValues(t)
      v.g.gain.setTargetAtTime(0, t, AUD.voiceRelease / 3)
    } catch (e) { /* the ramp is a courtesy; the disconnect below is the guarantee */ }
    later(AUD.voiceRelease * 1000 + 20, function () { endVoice(v) })
  }

  // Steal the oldest voice whose weight is lowest — never the newest. The victim leaves the pool
  // immediately so the cap is honoured this instant, and fades out over the next 40 ms.
  function steal () {
    var cap = tier().voices
    var guard = 0
    while (voices.length >= cap && ++guard <= cap + 1) {
      var pick = 0
      for (var i = 1; i < voices.length; i++) {
        var a = voices[i], b = voices[pick]
        if (a.w < b.w || (a.w === b.w && a.at < b.at)) pick = i
      }
      releaseVoice(voices.splice(pick, 1)[0])
    }
  }

  function releaseAllVoices (ms) {
    var list = voices.slice()
    for (var i = 0; i < list.length; i++) {
      var v = list[i]
      try {
        v.g.gain.cancelScheduledValues(ctx.currentTime)
        v.g.gain.setTargetAtTime(0, ctx.currentTime, (ms / 1000) / 3)
      } catch (e) { /* see releaseVoice */ }
      endVoiceLater(v, ms + 40)
    }
  }

  function endVoiceLater (v, ms) { later(ms, function () { endVoice(v) }) }

  function srcOf (buffer, out, rate) {
    var s = ctx.createBufferSource()
    s.buffer = buffer
    if (rate !== undefined) s.playbackRate.value = rate
    s.connect(out)
    return s
  }

  // A finished source releases everything it fed. There is no game state behind this: 07 §8.5 is
  // explicit that no onended handler may ever advance the simulation.
  function onDone (src, nodes) {
    src.onended = function () {
      for (var i = 0; i < nodes.length; i++) {
        try { nodes[i].disconnect() } catch (e) { /* already released */ }
      }
    }
  }

  // Every consumer of a noise buffer starts at a random offset. Two knocks never use the same
  // noise, and this single line is the difference between "a click" and "a click".
  function startNoise (s, t, buf) {
    var off = arnd() * buf.duration * AUD.noise.offsetFrac
    try { s.start(t, off) } catch (e) { try { s.start(t) } catch (e2) { /* dead context */ } }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE TIMBRE ALPHABET · 07 §2.5 — four materials, six primitives
  //
  // WOOD  knock          you touched something      send ≤ 0.06
  // WATER drop, pluck    something was gained       send 0.16–0.50
  // STONE stone          something is wrong         send 0, always, no exceptions
  // BREATH breath, sweep something changed shape    send ≥ 0.30
  //
  // STONE's zero send is the most important line in the sound design: every other material is in
  // the room, and failure is in your hand.
  // ───────────────────────────────────────────────────────────────────────────

  function outBus (o) { return (o && o.bus) || (G && G.uiGain) }

  // The shared onset. Every pitched attack in the game carries one; a sine with an instant attack
  // is the loudest tell of amateur synthesis.
  function transient (t, f, g, dur, v) {
    if (!NB.white || !v) return
    var bp = filt('bandpass', f * AUD.trans.qMul, AUD.trans.Q)
    var env = gain(0)
    var s = srcOf(NB.white, bp)
    bp.connect(env)
    env.connect(v.g)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(g, t + AUD.trans.attack)
    env.gain.exponentialRampToValueAtTime(AUD.eps, t + AUD.trans.attack + dur)
    startNoise(s, t, NB.white)
    s.stop(t + dur + AUD.trans.attack + 0.02)
    onDone(s, [s, bp, env])
  }

  // WATER · the workhorse. Three sines at n, 2n, 3n, each with its own decay: T_k = T_1 / k^0.72.
  // Highs die first, as they do in every physical object, so the tone darkens as it decays.
  function pluck (t, n, o) {
    if (!ctx || !G) return null
    o = o || {}
    var v = o.voice || voice(o.weight || 0, outBus(o), o.send || 0)
    if (!v) return null
    var f = hz(n), g = o.gain === undefined ? 0.1 : o.gain, T = o.decay || 0.5
    var atk = o.attack === undefined ? AUD.pluck.attack : o.attack
    var dest = v.g
    if (o.pan !== undefined) {
      var p = panner(o.pan)
      p.connect(v.g)
      dest = p
    }
    var longest = 0
    for (var k = 1; k <= 3; k++) {
      var a = AUD.pluck.amps[k - 1] * g
      var Tk = T / Math.pow(k, AUD.pluck.decayExp)
      if (Tk > longest) longest = Tk
      var osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f * k
      var env = gain(0)
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(a, t + atk)
      env.gain.exponentialRampToValueAtTime(AUD.eps, t + atk + Tk)
      osc.connect(env)
      env.connect(dest)
      osc.start(t)
      osc.stop(t + atk + Tk + AUD.pluck.tail)
      onDone(osc, [osc, env])
    }
    if (o.trans !== 0) transient(t, f, g * (o.trans === undefined ? AUD.pluck.trans : o.trans), AUD.trans.dur, v)
    if (!o.voice) endVoiceLater(v, (t - ctx.currentTime + atk + longest + AUD.pluck.tail) * 1000 + 120)
    return v
  }

  // WOOD · contact. A bandpassed noise burst over a sine body whose pitch droops 6% as it decays —
  // ten lines of nothing, and the reason it sounds like a finger on wood rather than a beep.
  function knock (t, n, o) {
    if (!ctx || !G || !NB.white) return null
    o = o || {}
    var v = o.voice || voice(o.weight || 0, outBus(o), o.send || 0)
    if (!v) return null
    var f = hz(n), g = o.gain === undefined ? 0.1 : o.gain
    var nD = (o.nDecay === undefined ? 55 : o.nDecay) / 1000
    var bD = (o.bDecay === undefined ? 90 : o.bDecay) / 1000

    var bp = filt('bandpass', f, o.Q === undefined ? AUD.knock.transQ : o.Q)
    var nEnv = gain(0)
    var s = srcOf(NB.white, bp)
    bp.connect(nEnv)
    nEnv.connect(v.g)
    nEnv.gain.setValueAtTime(0, t)
    nEnv.gain.linearRampToValueAtTime(g, t + AUD.knock.transA)
    nEnv.gain.exponentialRampToValueAtTime(AUD.eps, t + AUD.knock.transA + nD)
    startNoise(s, t, NB.white)
    s.stop(t + nD + 0.04)
    onDone(s, [s, bp, nEnv])

    var osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f, t)
    osc.frequency.exponentialRampToValueAtTime(f * AUD.knock.droop, t + bD)
    var bEnv = gain(0)
    bEnv.gain.setValueAtTime(0, t)
    bEnv.gain.linearRampToValueAtTime(g * AUD.knock.bodyAmp, t + AUD.knock.bodyA)
    bEnv.gain.exponentialRampToValueAtTime(AUD.eps, t + AUD.knock.bodyA + bD)
    osc.connect(bEnv)
    bEnv.connect(v.g)
    osc.start(t)
    osc.stop(t + bD + 0.04)
    onDone(osc, [osc, bEnv])

    if (!o.voice) endVoiceLater(v, (t - ctx.currentTime + Math.max(nD, bD)) * 1000 + 140)
    return v
  }

  // WATER · gain / commit. Always downward: an upward glide reads as a question, a downward glide
  // reads as an answer.
  function drop_ (t, n0, n1, o) {
    if (!ctx || !G) return null
    o = o || {}
    var v = o.voice || voice(o.weight || 0, outBus(o), o.send || 0)
    if (!v) return null
    var g = o.gain === undefined ? 0.1 : o.gain
    var T = o.decay || 0.4
    var glide = o.glide || 0.2
    var osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(hz(n0), t)
    osc.frequency.exponentialRampToValueAtTime(hz(n1), t + glide)
    var env = gain(0)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(g, t + 0.003)
    env.gain.exponentialRampToValueAtTime(AUD.eps, t + 0.003 + T)
    osc.connect(env)
    env.connect(v.g)
    osc.start(t)
    osc.stop(t + T + 0.05)
    onDone(osc, [osc, env])
    if (!o.voice) endVoiceLater(v, (t - ctx.currentTime + T) * 1000 + 120)
    return v
  }

  // STONE · failure, denial, warning. A detuned triangle pair through a lowpass. The 14-cent
  // detune beats about twice inside a 900 ms decay: unstable, not an alarm. Send is never read.
  function stone (t, n, o) {
    if (!ctx || !G) return null
    o = o || {}
    var v = o.voice || voice(o.weight || 0, outBus(o), 0)
    if (!v) return null
    var g = o.gain === undefined ? 0.1 : o.gain
    var T = o.decay || 0.3
    var cents = o.cents === undefined ? AUD.stone.cents : o.cents
    var lp = filt('lowpass', o.lp === undefined ? AUD.stone.lp : o.lp, o.Q === undefined ? AUD.stone.Q : o.Q)
    var env = gain(0)
    lp.connect(env)
    env.connect(v.g)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(g, t + AUD.stone.attack)
    env.gain.exponentialRampToValueAtTime(AUD.eps, t + AUD.stone.attack + T)
    var made = []
    for (var i = 0; i < 2; i++) {
      var osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = hz(n) * (i ? Math.pow(2, -cents / 1200) : 1)
      osc.connect(lp)
      osc.start(t)
      osc.stop(t + T + 0.05)
      made.push(osc)
    }
    onDone(made[1], [made[0], made[1], lp, env])
    if (!o.voice) endVoiceLater(v, (t - ctx.currentTime + T) * 1000 + 120)
    return v
  }

  // BREATH · reveal, transition, space. Attack is never below 25 ms: a breath with a fast attack
  // is a hiss.
  function breath (t, f0, f1, o) {
    if (!ctx || !G || !NB.pink) return null
    o = o || {}
    var v = o.voice || voice(o.weight || 0, outBus(o), o.send === undefined ? 0.30 : o.send)
    if (!v) return null
    var g = o.gain === undefined ? 0.1 : o.gain
    var atk = Math.max(AUD.breath.minAttack, o.attack || 0)
    var hold = o.hold || 0
    var rel = o.release || 0.4
    var bp = filt('bandpass', f0, o.Q === undefined ? AUD.breath.Q : o.Q)
    if (f1 && f1 !== f0) bp.frequency.exponentialRampToValueAtTime(f1, t + atk + hold + rel)
    var env = gain(0)
    var s = srcOf(NB.pink, bp, AUD.breath.rateLo + AUD.breath.rateSpan * arnd())
    bp.connect(env)
    env.connect(v.g)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(g, t + atk)
    env.gain.setValueAtTime(g, t + atk + hold)
    env.gain.exponentialRampToValueAtTime(AUD.eps, t + atk + hold + rel)
    startNoise(s, t, NB.pink)
    s.stop(t + atk + hold + rel + 0.05)
    onDone(s, [s, bp, env])
    if (!o.voice) endVoiceLater(v, (t - ctx.currentTime + atk + hold + rel) * 1000 + 120)
    return v
  }

  // BREATH · propagation. Downward is discharge. Upward exists twice in the whole game.
  function sweep (t, f0, f1, o) {
    if (!ctx || !G || !NB.pink) return null
    o = o || {}
    var v = o.voice || voice(o.weight || 0, outBus(o), o.send === undefined ? 0.44 : o.send)
    if (!v) return null
    var g = o.gain === undefined ? 0.1 : o.gain
    var dur = o.dur || 0.7
    var bp = filt('bandpass', f0, o.Q === undefined ? AUD.sweep.Q : o.Q)
    bp.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
    var env = gain(0)
    var s = srcOf(NB.pink, bp, AUD.breath.rateLo + AUD.breath.rateSpan * arnd())
    bp.connect(env)
    env.connect(v.g)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(g, t + Math.max(0.008, o.attack || 0.008))
    env.gain.exponentialRampToValueAtTime(AUD.eps, t + dur)
    startNoise(s, t, NB.pink)
    s.stop(t + dur + 0.05)

    var osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f0, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
    var oEnv = gain(0)
    oEnv.gain.setValueAtTime(0, t)
    oEnv.gain.linearRampToValueAtTime(g * AUD.sweep.sineMul, t + 0.012)
    oEnv.gain.exponentialRampToValueAtTime(AUD.eps, t + dur)
    osc.connect(oEnv)
    oEnv.connect(v.g)
    osc.start(t)
    osc.stop(t + dur + 0.05)

    onDone(s, [s, bp, env])
    onDone(osc, [osc, oEnv])
    if (!o.voice) endVoiceLater(v, (t - ctx.currentTime + dur) * 1000 + 140)
    return v
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE BED · 07 §4 — a loopless generative ambient
  // ───────────────────────────────────────────────────────────────────────────

  // One PeriodicWave carries the whole partial subset, so a single oscillator produces three
  // frequencies at zero extra cost and every oscillator in the build runs at 55.000 Hz.
  function makeWave (parts) {
    var keys = Object.keys(parts).map(Number)
    var nMax = Math.max.apply(null, keys) + 1
    var real = new Float32Array(nMax + 1), imag = new Float32Array(nMax + 1)
    for (var i = 0; i < keys.length; i++) imag[keys[i]] = parts[keys[i]]
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false })
  }

  function droneVoice (name, parts) {
    var D = AUD.drone[name]
    var vg = gain(parts ? D.g : 0)
    var lp = filt('lowpass', D.lp, D.Q)
    var pan = panner(D.pan)
    vg.connect(lp); lp.connect(pan); pan.connect(G.bedMix)
    var wave = parts ? makeWave(parts) : null
    var osc = []
    for (var i = 0; i < 2; i++) {
      var o = ctx.createOscillator()
      if (wave) o.setPeriodicWave(wave)
      o.frequency.value = AUD.F0
      o.detune.value = i ? -D.det : D.det
      o.connect(vg)
      try { o.start() } catch (e) { /* a context that refuses to start is a context we do not use */ }
      osc.push(o)
    }
    return { name: name, g: vg, lp: lp, pan: pan, osc: osc, base: D.g, mul: 1, season: 1, fc: 1 }
  }

  // The bed is only *built* in FULL. In SPARSE the context is alive and UI voices play, but no
  // oscillator runs — which is the whole difference between 07 §9.3's 0.8 %/h and 0.15 %/h.
  function bedStart () {
    if (!ctx || !G || bedRunning) return
    if (mode() !== 'full') return
    bedRunning = true
    MODS = MOD_DEF.map(function (m) {
      return { k: m.k, x: m.mu, th: m.th, mu: m.mu, sg: m.sg, lo: m.lo, hi: m.hi }
    })
    var pal = PALETTE[curAct] || PALETTE[1]
    bed = {
      low: droneVoice('low', pal.low),
      mid: droneVoice('mid', pal.mid),
      high: droneVoice('high', pal.high),
      air: null, cond: null, shadow: null,
      airMul: 1, sendMul: 1, grainMean: 1, grainGain: 1, grainPool: 0, grainJitter: 1, grainPan: 1
    }
    airStart()
    if (curAct >= 2) condStart()
    nextGrainAt = ctx.currentTime + AUD.life.rebaseS
    applyMode()
    bedStep(true)
  }

  // The only looping element in the build, and inaudible as one: two sources over the same buffer
  // at a ratio of φ⁻¹, so the composite has no period at all.
  function airStart () {
    if (!ctx || !G || !bed || !NB.air || bed.air) return
    var bp = filt('bandpass', Math.exp(MODS ? M('airFc') : MOD_DEF[6].mu), AUD.air.Q)
    var ag = gain(AUD.air.level)
    bp.connect(ag); ag.connect(G.bedMix)
    var srcs = []
    var n = tier().air2 ? 2 : 1
    for (var i = 0; i < n; i++) {
      var p = panner(i ? AUD.air.panB : AUD.air.panA)
      var vg = gain(i ? AUD.air.gB : AUD.air.gA)
      var s = srcOf(NB.air, vg, i ? AUD.air.rateB : 1)
      s.loop = true
      vg.connect(p); p.connect(bp)
      try { s.start(ctx.currentTime, arnd() * NB.air.duration) } catch (e) { /* see droneVoice */ }
      srcs.push({ s: s, vg: vg, p: p })
    }
    bed.air = { bp: bp, g: ag, srcs: srcs, base: AUD.air.level }
  }

  // The readout layer. A high partial fades in and pulls into tune as the Signal pool fills; the
  // player learns to hear ripeness in about ten minutes and stops looking at the meter.
  function condStart () {
    if (!ctx || !G || !bed || bed.cond || !tier().cond) return
    var n = curAct >= 3 ? AUD.cond.n3 : AUD.cond.n2
    var osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = hz(n)
    var bp = filt('bandpass', hz(n), AUD.cond.Q)
    var g = gain(0)
    osc.connect(bp); bp.connect(g); g.connect(G.bedMix)
    try { osc.start() } catch (e) { /* see droneVoice */ }
    bed.cond = { osc: osc, bp: bp, g: g, n: n }
  }

  function condCollapse (t, dur) {
    if (!bed || !bed.cond) return
    try {
      bed.cond.g.gain.cancelScheduledValues(t)
      bed.cond.g.gain.setTargetAtTime(0, t, dur / 3)
    } catch (e) { /* the tension releases visually either way */ }
  }

  // The Successor's note (07 §4.6 binding 10) is the undecimal tritone, and it is the only voice
  // in the game that is not ours.
  function shadowStart () {
    if (!ctx || !G || !bed || bed.shadow) return
    var osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = hz(AUD.bind.shadowN)
    var g = gain(0)
    osc.connect(g); g.connect(G.bedMix)
    try { osc.start() } catch (e) { /* see droneVoice */ }
    bed.shadow = { osc: osc, g: g }
  }

  function ouStep (dt) {
    if (!MODS) return
    for (var i = 0; i < MODS.length; i++) {
      var m = MODS[i]
      m.x += m.th * (m.mu - m.x) * dt + m.sg * Math.sqrt(dt) * gauss()
      m.x = clamp(m.x, m.lo, m.hi)
    }
  }

  function M (k) {
    if (!MODS) return 0
    for (var i = 0; i < MODS.length; i++) if (MODS[i].k === k) return MODS[i].x
    return 0
  }

  // Every binding lands here, so this is the one place a NaN can be stopped. A parameter method
  // given a non-finite value throws in real WebAudio, and one missing world variable must never be
  // able to take the audio thread down with it.
  function ramp (param, v, tau, t) {
    if (!param || typeof v !== 'number' || !isFinite(v)) return
    try {
      param.setTargetAtTime(v, t === undefined ? ctx.currentTime : t, Math.max(0.001, tau))
    } catch (e) { /* a dead or closing context is not an error */ }
  }

  // ── long-session softening (07 §4.7): quieter, darker, sparser, on one curve ──
  function sessionMinutes () { return (nowMs() - sessionStart) / 60000 }

  function sessionK () {
    var s = sessionMinutes()
    var f = AUD.session.freeMin
    return s <= f ? 0 : Math.log(s / f) / Math.LN2
  }

  function applyBedParams (t) {
    if (!bed || !MODS) return
    var S = AUD.session
    var k = sessionK()
    var trimDb = clamp(S.dbPerOct * k, S.dbFloor, 0)
    var tiltDb = clamp(S.tiltPerOct * k, S.tiltFloor, 0)

    bed.low.osc[0].detune.setTargetAtTime(M('lowDet'), t, T_SMOOTH)
    bed.low.osc[1].detune.setTargetAtTime(-M('lowDet'), t, T_SMOOTH)
    bed.mid.osc[0].detune.setTargetAtTime(M('midDet'), t, T_SMOOTH)
    bed.mid.osc[1].detune.setTargetAtTime(-M('midDet'), t, T_SMOOTH)
    // Binding 9: divergence is audible as beating that speeds up, so the high pair's detune is
    // driven by drift rather than by its own walk once there is any drift to hear.
    var hd = bed.driftDet !== undefined ? bed.driftDet : M('highDet')
    bed.high.osc[0].detune.setTargetAtTime(hd, t, T_SMOOTH)
    bed.high.osc[1].detune.setTargetAtTime(-hd, t, T_SMOOTH)

    var pal = PALETTE[curAct] || PALETTE[1]
    ramp(bed.low.g.gain, pal.low ? bed.low.base * M('lowAmp') * bed.low.fc * dip(bed.low) : 0, T_SMOOTH, t)
    ramp(bed.mid.g.gain, bed.mid.base * M('midAmp') * dip(bed.mid), T_SMOOTH, t)
    ramp(bed.high.g.gain, bed.high.base * M('highAmp') * bed.high.season * dip(bed.high), T_SMOOTH, t)

    if (bed.air) {
      ramp(bed.air.bp.frequency, Math.exp(M('airFc')) * bed.windFc, AUD.bind.windTau, t)
      var airDipMul = bed.airDip === undefined ? 1 : bed.airDip
      ramp(bed.air.g.gain, bed.air.base * M('airAmp') * bed.airMul * airDipMul, AUD.bind.moistTau, t)
    }
    ramp(G.bedTilt.gain, M('tilt') + bed.seasonTilt + tiltDb + (bed.tiltEvent || 0), AUD.bind.seasonTau, t)
    ramp(G.bedGain.gain, bedLevel() * dbToLin(trimDb), S.tau, t)
    ramp(G.bedSend.gain, bed.sendTarget, AUD.bind.sendTau, t)
  }

  function dip (v) { return v.dip === undefined ? 1 : v.dip }

  function bedLevel () { return mode() === 'full' ? 1 : 0 }

  function applyMode () {
    if (!ctx || !G) return
    var t = ctx.currentTime
    var trim = dbToLin(clamp(AUD.session.dbPerOct * sessionK(), AUD.session.dbFloor, 0))
    ramp(G.bedGain.gain, bedLevel() * trim, mode() === 'full' ? AUD.xfade.mode : AUD.life.modeFadeS, t)
  }

  // ── grains (07 §4.3) — Poisson-scheduled, voice-led ──
  function grainMean () {
    var g = AUD.grain[curAct] || AUD.grain[1]
    var k = sessionK()
    var mean = g.mean * (1 + AUD.session.sparsePerOct * k) * (bed ? bed.grainMean : 1)
    var rate = tier().grainRate
    if (!(rate > 0)) return Infinity
    return mean / rate
  }

  function grainInterval () {
    var mean = grainMean()
    if (!isFinite(mean)) return Infinity
    var iv = -Math.log(1 - arnd()) * mean
    // 07 §4.6.1: as ϒ rises the Poisson process narrows toward a period. jitter 0 is periodic.
    if (bed && bed.grainJitter < 1) iv = mean + (iv - mean) * bed.grainJitter
    return iv
  }

  // Two rules make this melodic rather than pointillistic: no immediate repeat, and no leap wider
  // than three steps in the pool. The result wanders and never jumps.
  function drawGrain () {
    var pool = GRAIN_POOL[curAct] || GRAIN_POOL[1]
    var width = bed && bed.grainPool ? Math.max(1, bed.grainPool) : pool.length
    if (width < pool.length) pool = pool.slice(0, width)
    var total = 0, i
    for (i = 0; i < pool.length; i++) total += pool[i][1]
    var prevIdx = -1
    for (i = 0; i < pool.length; i++) if (pool[i][0] === lastGrainN) prevIdx = i
    if (pool.length === 1) return pool[0][0]
    var cand = -1
    for (var attempt = 0; attempt <= AUD.grainRule.redraws; attempt++) {
      var r = arnd() * total, acc = 0, idx = pool.length - 1
      for (i = 0; i < pool.length; i++) { acc += pool[i][1]; if (r <= acc) { idx = i; break } }
      if (pool[idx][0] === lastGrainN) continue
      cand = idx
      if (prevIdx < 0 || Math.abs(idx - prevIdx) <= AUD.grainRule.leap) return pool[idx][0]
    }
    // The redraw budget bounds the search for a small leap. It does not license a repeated note:
    // R1 is absolute, so an exhausted search steps to the neighbour instead.
    if (cand >= 0) return pool[cand][0]
    return pool[prevIdx > 0 ? prevIdx - 1 : Math.min(1, pool.length - 1)][0]
  }

  function spawnGrain (t) {
    var cfg = AUD.grain[curAct] || AUD.grain[1]
    var n = drawGrain()
    lastGrainN = n
    var span = cfg.pan * (bed ? bed.grainPan : 1)
    var p = -Math.sign(lastGrainPan || 1) * (AUD.grainRule.panLo + AUD.grainRule.panSpan * arnd())
    p = clamp(p, -span, span)
    lastGrainPan = p || 1
    var R = AUD.grainRule
    pluck(t, n, {
      decay: cfg.decay,
      gain: (cfg.g * (bed ? bed.grainGain : 1)) * (R.gainLo + R.gainSpan * arnd()),
      send: cfg.send,
      attack: R.attack,
      pan: p,
      bus: G.bedMix,
      weight: 0
    })
  }

  // The 5 Hz bed clock. BIBLE §4.2 permits no timer of our own, so this is driven by tick() and by
  // the frame loop, and is idempotent within its own period.
  function bedStep (force) {
    if (!ctx || !ready || !bedRunning) return
    var d = doc()
    if (d && d.hidden) return
    var wall = nowMs()
    if (!force && wall - lastBedAt < AUD.bedClockMs) return
    var dt = force ? AUD.bedClockMs / 1000 : Math.min(1.0, (wall - lastBedAt) / 1000)
    lastBedAt = wall
    var t = ctx.currentTime

    ouStep(dt)
    bedParams(st())
    applyBedParams(t)
    flushDeferred(wall)

    if (mode() !== 'full') { nextGrainAt = t + AUD.life.rebaseS; return }
    var guard = 0
    while (nextGrainAt < t + AUD.lookahead && ++guard < 8) {
      var iv = grainInterval()
      if (!isFinite(iv)) { nextGrainAt = t + AUD.life.rebaseS; break }
      spawnGrain(Math.max(nextGrainAt, t + AUD.nowPad))
      nextGrainAt += iv
    }
    // Never fire a burst of grains that were "missed" (07 §2.3 R6).
    if (nextGrainAt < t) nextGrainAt = t + AUD.life.rebaseS
  }

  function flushDeferred (wall) {
    for (var i = deferred.length - 1; i >= 0; i--) {
      if (deferred[i].at <= wall) {
        var fn = deferred[i].fn
        deferred.splice(i, 1)
        try { fn() } catch (e) { /* an arrival that cannot play is not an error */ }
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GAME STATE → AUDIO PARAMETER · 07 §4.6, all twelve bindings
  //
  // The bed is an instrument panel, not a soundtrack. Every binding whose source module does not
  // exist yet reads its documented rest value, so Act I sounds finished rather than partial.
  // ───────────────────────────────────────────────────────────────────────────

  function bedParams (s) {
    var B = AUD.bind
    var out = {
      seasonTilt: 0, highSeason: 1, moisture: 1, airMul: 1, windFc: 1,
      sat: 0, send: B.sendA, grainMean: 1, lowFc: 1, driftDet: undefined,
      shadow: 0, upsilon: 0, sessionK: sessionK()
    }
    if (!s) s = st()
    if (!s) { if (bed) assignBed(out); return out }

    var act = s.act === 2 || s.act === 3 ? s.act : 1

    // 1 & 2 · season → bed tilt and the top of the sound. Winter is dark, not quiet, and the high
    // voice leaves in winter and comes back. There is no season one-shot (07 §5.3.1).
    if (act === 1) {
      var se = clamp(num(s.a1 && s.a1.season) | 0, 0, 3)
      out.seasonTilt = B.seasonTilt[se]
      out.highSeason = B.seasonHigh[se]
    }

    // 3 · moisture → the air layer. Act I keeps moisture on its own 0.15–1.50 scale, so it is
    // normalised here rather than carrying a second unit into the audio.
    var A1 = C() && C().TUNE ? C().TUNE.A1 : null
    if (act === 1 && A1) {
      out.moisture = clamp((num(s.a1 && s.a1.moisture) - A1.MOIST_MIN) / (A1.MOIST_MAX - A1.MOIST_MIN), 0, 1)
    } else {
      out.moisture = clamp(num(s.a2 && s.a2.W), 0, 1)
    }
    out.airMul = B.airMoistA + B.airMoistB * out.moisture

    // 4 · wind brightens the air layer.
    out.windFc = 1 + B.windFcA * clamp(num(s.a2 && s.a2.windSpeed), 0, 1)

    // 5 · saturation → CONDUCTION. Ripeness is audible; this one layer justifies the whole system.
    var cap = signalCap(s)
    out.sat = cap > 0 ? clamp(num(s.res && s.res.signal) / cap, 0, 1) : 0

    // 6 · connectivity → reverb amount. A larger network is in a larger room.
    var conn = 0
    if (HY.world && HY.world.connectivity) {
      var span = A2 ? A2.CONN_MAX - A2.CONN_MIN : 1
      try {
        conn = clamp((num(HY.world.connectivity(s)) - (A2 ? A2.CONN_MIN : 1)) / span, 0, 1)
      } catch (e) { conn = 0 }
    }
    out.send = B.sendA + B.sendB * conn

    // 7 & 8 · the forest gets quieter as you eat it, and the floor thins out under you.
    var fc = 0
    var A2 = C() && C().TUNE ? C().TUNE.A2 : null
    if (act === 2 && A2) fc = clamp(num(s.res && s.res.extracted) / A2.EXTRACT_TARGET, 0, 1)
    out.grainMean = 1 + B.fcGrainB * fc * fc
    out.lowFc = 1 - B.fcLowB * fc

    // 9 · divergence is audible as beating that speeds up. Fixing fidelity slows it.
    if (act === 3 && HY.divergence && HY.divergence.driftFraction) {
      try {
        out.driftDet = B.driftA + B.driftB * clamp(num(HY.divergence.driftFraction(s)), 0, 1)
      } catch (e) { out.driftDet = undefined }
    }

    // 10 · the Successor has a note.
    if (act === 3 && HY.divergence && HY.divergence.strainShare) {
      try {
        out.shadow = B.shadowK * clamp(num(HY.divergence.strainShare(s)), 0, 1)
      } catch (e) { out.shadow = 0 }
    }

    // 11 · the Synchrony collapse: the palette narrows, the field centres, the grains speed up.
    if (act === 3) out.upsilon = clamp(num(s.a3 && s.a3.upsilon), 0, 1)

    if (bed) assignBed(out)
    return out
  }

  function signalCap (s) {
    if (HY.cognition && HY.cognition.signalCap) {
      try { return num(HY.cognition.signalCap(s)) } catch (e) { return 0 }
    }
    return 0
  }

  function assignBed (p) {
    var B = AUD.bind
    bed.seasonTilt = p.seasonTilt
    bed.high.season = p.highSeason
    bed.airMul = p.airMul
    bed.windFc = p.windFc
    bed.sendTarget = p.send
    bed.low.fc = p.lowFc
    bed.grainMean = p.grainMean
    bed.driftDet = p.driftDet

    if (p.sat > 0 || bed.cond) {
      condStart()
      if (bed.cond) {
        var t = ctx.currentTime
        ramp(bed.cond.g.gain, AUD.cond.gain * Math.pow(p.sat, AUD.cond.exp), AUD.cond.tau, t)
        ramp(bed.cond.osc.detune, AUD.cond.detune * (1 - p.sat), AUD.cond.tau, t)
      }
    }
    if (p.shadow > 0) {
      shadowStart()
      if (bed.shadow) ramp(bed.shadow.g.gain, p.shadow, B.shadowTau, ctx.currentTime)
    }

    var y = p.upsilon
    if (curAct >= 3 && y > 0) {
      // At ϒ = 0.31 this is eight scattered pitches across the field; at ϒ = 0.80 it is one note,
      // 440 Hz, dead centre, every 4.2 s, in a six-second room. Nothing in the UI mentions it.
      bed.grainPool = Math.ceil(B.syncPool * (1 - y))
      bed.grainJitter = B.syncJitter * (1 - y)      // fraction of the exponential spread retained
      bed.grainMean = B.syncMean / (AUD.grain[3].mean || 1)
      bed.grainGain = (B.syncGainA + B.syncGainB * y) / AUD.grain[3].g
      bed.grainPan = 1 - y
    } else {
      bed.grainPool = 0
      bed.grainJitter = 1
      bed.grainGain = 1
      bed.grainPan = 1
    }
  }

  // ── the act palette crossfade (07 §4.2) ──
  function setActPalette (act, seconds) {
    curAct = act === 2 || act === 3 ? act : 1
    if (!bed || !ctx) return
    var pal = PALETTE[curAct] || PALETTE[1]
    var t = ctx.currentTime
    var names = ['low', 'mid', 'high']
    for (var i = 0; i < names.length; i++) {
      var v = bed[names[i]]
      var parts = pal[names[i]]
      if (!parts) { ramp(v.g.gain, 0, seconds / 3, t); continue }
      var wave = makeWave(parts)
      for (var j = 0; j < v.osc.length; j++) v.osc[j].setPeriodicWave(wave)
    }
    if (curAct >= 2) condStart()
    lastGrainN = -1
  }

  // ── ducking (07 §4.8) ──
  // Taps do not duck. A duck on every tap at three taps a second is a tremolo.
  function duck (w, t) {
    if (!ctx || !G) return
    var D = AUD.duck[w]
    if (!D) return
    if (t === undefined) t = ctx.currentTime
    try {
      G.bedDuck.gain.cancelScheduledValues(t)
      G.bedDuck.gain.setTargetAtTime(dbToLin(D.db), t, D.atk / 3000)
      G.bedDuck.gain.setTargetAtTime(1.0, t + D.atk / 1000 + 0.05, D.rel / 3000)
    } catch (e) { /* a duck that cannot be scheduled is not worth an exception */ }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE TAP LADDER · 07 §5.4 — why two hundred taps in a row is a phrase
  // ───────────────────────────────────────────────────────────────────────────

  // Six steps, so every sixth tap lands back on 220 Hz and sustained tapping has a downbeat. The
  // reset threshold is longer than any deliberate tap gap and shorter than any pause for thought,
  // so the phrase restarts exactly when the player restarts.
  function tapPartial (step) {
    var t = nowMs()
    if (t - lastTapAt > AUD.ladderResetMs) ladderI = 0
    lastTapAt = t
    var n = AUD.ladder[ladderI % AUD.ladder.length]
    ladderI += (step || 1)
    return n
  }

  // Coalescence plays one instance a step up the act palette rather than three of the same note.
  function nextPartial (n) {
    var pal = AUD.palette[curAct] || AUD.palette[1]
    var i = pal.indexOf(n)
    return i < 0 || i + 1 >= pal.length ? n : pal[i + 1]
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE MASTER EVENT TABLE · 07 §5.2
  //
  // `g` scale, `s` send, `w` duck weight, `h` haptic ms, `ioi` minimum inter-onset ms.
  // `self` marks the closed list of 07 §7.3 H4 — the events allowed to buzz without the player
  // having caused them. Adding a sound to a mechanic is a row here, never a change at a call site.
  // ───────────────────────────────────────────────────────────────────────────

  var EVENTS = {

    'tap.extend': { g: 0.100, s: 0.05, w: 0, h: 8, ioi: 55, play: function (t, p, o) {
      knock(t, o.n === undefined ? tapPartial(1) : o.n,
        { gain: o.g, send: o.s, nDecay: 55, bDecay: 90, Q: 3.2 })
    } },

    // Reflex Arc advances the ladder by two, so holding produces a flatter phrase than tapping.
    // Holding and tapping sound different, which is the correct reward for a project that changed
    // the verb.
    'tap.hold': { g: 0.060, s: 0.04, w: 0, h: 4, ioi: 300, play: function (t, p, o) {
      knock(t, o.n === undefined ? tapPartial(AUD.ladderHoldStep) : o.n,
        { gain: o.g, send: o.s, nDecay: 40, bDecay: 62, Q: 3.2 })
    } },

    'tap.ui': { g: 0.070, s: 0.03, w: 0, h: 8, ioi: 40, play: function (t, p, o) {
      knock(t, o.n === undefined ? 4 : o.n, { gain: o.g, send: o.s, nDecay: 38, bDecay: 60, Q: 3.6 })
    } },

    'tap.deny': { g: 0.090, s: 0, w: 0, h: 4, ioi: 260, play: function (t, p, o) {
      stone(t, o.n === undefined ? 3 : o.n, { gain: o.g, cents: 22, decay: 0.150, lp: 900, Q: 0.7 })
    } },

    'buy.tick': { g: 0.050, s: 0.02, w: 0, h: 4, hEvery: 3, ioi: 70, play: function (t, p, o) {
      knock(t, o.n === undefined ? 6 : o.n, { gain: o.g, send: o.s, nDecay: 26, bDecay: 40, Q: 4.0 })
    } },

    'buy.commit': { g: 0.130, s: 0.16, w: 1, h: 8, ioi: 140, play: function (t, p, o) {
      drop_(t, 6, 5, { gain: o.g, send: o.s, glide: 0.200, decay: 0.220, weight: 1 })
      pluck(t + 0.030, o.n === undefined ? 10 : o.n, { gain: o.g * 0.75, send: o.s, decay: 0.420, weight: 1 })
    } },

    'unlock.reveal': { g: 0.110, s: 0.30, w: 1, h: 8, self: true, ioi: 220, play: function (t, p, o) {
      breath(t, 560, 1400, { gain: o.g, send: o.s, Q: 1.1, attack: 0.040, release: 0.420, weight: 1 })
      pluck(t + 0.060, o.n === undefined ? 8 : o.n, { gain: o.g * 0.8, send: o.s, decay: 0.420, weight: 1 })
    } },

    'project.complete': { g: 0.200, s: 0.42, w: 2, h: 14, ioi: 400, play: function (t, p, o) {
      breath(t, 300, 900, { gain: o.g * 0.35, send: o.s, Q: 1.3, attack: 0.060, release: 0.900, weight: 2 })
      pluck(t, 5, { gain: o.g, send: o.s, decay: 0.900, weight: 2 })
      pluck(t + 0.040, 8, { gain: o.g * 0.72, send: o.s, decay: 0.720, weight: 2 })
      pluck(t + 0.095, 12, { gain: o.g * 0.55, send: o.s, decay: 0.560, weight: 2 })
    } },

    // 07 §5.2 prints this row's last two columns transposed (a 700 ms haptic is impossible under
    // §7.2's 30 ms ceiling). §7.2 governs: haptic 12, IOI 700.
    'milestone': { g: 0.150, s: 0.38, w: 2, h: 12, self: true, ioi: 700, play: function (t, p, o) {
      pluck(t, 4, { gain: o.g, send: o.s, decay: 0.700, weight: 2 })
      pluck(t + 0.110, 6, { gain: o.g * 0.78, send: o.s, decay: 0.620, weight: 2 })
      pluck(t + 0.240, 9, { gain: o.g * 0.60, send: o.s, decay: 0.520, weight: 2 })
    } },

    'contract.offer': { g: 0.075, s: 0.34, w: 1, h: 0, ioi: 500, play: function (t, p, o) {
      breath(t, 300, 700, { gain: o.g, send: o.s, Q: 2.2, attack: 0.060, release: 0.380, weight: 1 })
    } },

    // A just fifth. Agreement.
    'contract.sign': { g: 0.140, s: 0.36, w: 2, h: 12, ioi: 400, play: function (t, p, o) {
      pluck(t, 4, { gain: o.g, send: o.s, decay: 0.620, weight: 2 })
      pluck(t + 0.130, 6, { gain: o.g * 0.8, send: o.s, decay: 0.560, weight: 2 })
    } },

    'contract.break': { g: 0.135, s: 0, w: 2, h: 18, self: true, ioi: 600, play: function (t, p, o) {
      stone(t, 3, { gain: o.g, cents: 14, decay: 0.420, lp: 700, Q: 0.8, weight: 2 })
      stone(t + 0.110, 3, { gain: o.g * 0.8, cents: 14, decay: 0.420, lp: 700, Q: 0.8, weight: 2 })
    } },

    'market.fill': { g: 0.050, s: 0.03, w: 0, h: 0, ioi: 120, play: function (t, p, o) {
      knock(t, 8, { gain: o.g, send: o.s, nDecay: 30, bDecay: 46, Q: 4.4 })
    } },

    // No one-shot, ever. Twenty season turns in a playthrough would become wallpaper by the fourth,
    // so the season is expressed entirely as bed movement (§4.6 bindings 1 and 2).
    'season.turn': { g: 0, s: 0, w: 0, h: 0, ioi: 0, bedOnly: true, play: null },

    'pulse.fire': { g: 0.240, s: 0.44, w: 3, h: 18, ioi: 900, play: function (t, p, o) {
      sweep(t, 1800, 220, { dur: 0.70, Q: 6.0, gain: o.g, send: o.s, weight: 3 })
      drop_(t + 0.020, 2, 1, { glide: 0.620, decay: 0.700, gain: o.g * 0.42, send: o.s, weight: 3 })
      condCollapse(t, AUD.cond.collapse)
    } },

    // You hear the size of your network. In Act III the lag the player must learn to predict is
    // audible, which is a mechanic taught by sound.
    'pulse.arrive': { g: 0.070, s: 0.40, w: 0, h: 0, ioi: 130, play: function (t, p, o) {
      var d = Math.min(6, Math.max(0, num(p.dist)))
      var strength = p.strength === undefined ? 1 : num(p.strength)
      pluck(t, 8 - d, { gain: o.g * strength, send: o.s, decay: 0.520, pan: num(p.pan) })
    } },

    // The only ascending gesture in the game, on the one mechanic that is about patience paying
    // off: root, fifth, octave, octave-and-a-fifth.
    'flush.release': { g: 0.280, s: 0.50, w: 3, h: 22, ioi: 800, play: function (t, p, o) {
      var y = p.yieldScale === undefined ? 1 : clamp(num(p.yieldScale), 0.55, 1.30)
      var g = o.g * y
      breath(t, 700, 2600, { gain: g * 0.4, send: o.s, Q: 1.4, attack: 0.040, release: 1.400, weight: 3 })
      var steps = [[6, 0], [9, 0.070], [12, 0.150], [18, 0.260]]
      for (var i = 0; i < steps.length; i++) {
        pluck(t + steps[i][1], steps[i][0],
          { gain: g * (1 - i * 0.14), send: o.s, decay: 1.400 - i * 0.22, weight: 3 })
      }
    } },

    'claim.complete': { g: 0.150, s: 0.40, w: 2, h: 12, ioi: 400, play: function (t, p, o) {
      pluck(t, 6, { gain: o.g, send: o.s, decay: 0.640, weight: 2 })
      pluck(t + 0.120, 9, { gain: o.g * 0.78, send: o.s, decay: 0.560, weight: 2 })
    } },

    'warn.minor': { g: 0.110, s: 0, w: 1, h: 0, latch: true, ioi: 900, play: function (t, p, o) {
      stone(t, 5, { gain: o.g, cents: 14, decay: 0.180, lp: 1100, Q: 0.7, weight: 1 })
    } },

    // §5.2's H column reads 0 here; §7.2 makes it 12 with "Exception: this one you need." The
    // haptic table governs its own column.
    'warn.major': { g: 0.170, s: 0, w: 3, h: 12, self: true, latch: true, ioi: 2500, play: function (t, p, o) {
      stone(t, 5, { gain: o.g, cents: 14, decay: 0.420, lp: 850, Q: 0.8, weight: 3 })
      stone(t + 0.240, 5, { gain: o.g * 0.85, cents: 20, decay: 0.420, lp: 850, Q: 0.8, weight: 3 })
      tiltEvent(-4, 3000)
    } },

    // The sound of something stopping. There is no jumpscare in HYPHAE.
    'fail.event': { g: 0.190, s: 0, w: 4, h: 22, self: true, ioi: 3000, play: function (t, p, o) {
      stone(t, 2, { gain: o.g, cents: 26, decay: 0.900, lp: 520, Q: 0.9, weight: 4 })
      voiceDip('high', 6000)
    } },

    'combat.engage': { g: 0.110, s: 0.36, w: 2, h: 0, self: true, ioi: 1500, play: function (t, p, o) {
      breath(t, 180, 520, { gain: o.g, send: o.s, Q: 1.6, attack: 0.090, release: 0.600, weight: 2 })
    } },

    'combat.win': { g: 0.130, s: 0.38, w: 2, h: 12, self: true, ioi: 1500, play: function (t, p, o) {
      pluck(t, 6, { gain: o.g, send: o.s, decay: 0.520, weight: 2 })
      pluck(t + 0.090, 9, { gain: o.g * 0.8, send: o.s, decay: 0.460, weight: 2 })
    } },

    'combat.loss': { g: 0.150, s: 0, w: 3, h: 18, self: true, ioi: 1500, play: function (t, p, o) {
      stone(t, 4, { gain: o.g, cents: 18, decay: 0.520, lp: 900, Q: 0.7, weight: 3 })
      airDip(0.4, 2000)
    } },

    // Thirteen of these overlap into one sustained note. The player wins by building it out of
    // thirteen separate acts of correction.
    'entrain.lock': { g: 0.115, s: 0.62, w: 1, h: 8, self: true, ioi: 260, play: function (t, p, o) {
      pluck(t, 8, { gain: o.g, send: o.s, decay: 2.400, attack: 0.006, weight: 1 })
    } },

    'divergence': { g: 0.150, s: 0, w: 3, h: 22, self: true, ioi: 3000, play: function (t, p, o) {
      stone(t, 11, { gain: o.g, cents: 34, decay: 0.700, lp: 1500, Q: 1.1, weight: 3 })
    } },

    'offline.return': { g: 0.095, s: 0.46, w: 1, h: 0, ioi: 0, play: function (t, p, o) {
      breath(t, 240, 900, { gain: o.g, send: o.s, Q: 1.3, attack: 0.400, release: 1.000, weight: 1 })
      if (G && mode() === 'full') {
        G.bedGain.gain.setValueAtTime(0, t)
        ramp(G.bedGain.gain, bedLevel(), 3.0, t)
      }
    } },

    // §7.2 has rows §5.2 does not, because a haptic is not always a sound. A long press and a
    // destructive hold are *felt* confirmations; inventing a tone for them would break §5.1 P2,
    // which says no sound invents a synthesis method and the palette is the palette.
    'ui.longpress': { g: 0, s: 0, w: 0, h: 18, ioi: 260, play: null },
    'ui.destruct': { g: 0, s: 0, w: 0, h: 22, ioi: 400, play: null },

    // The act-transition sequence, 12 → 12 → 30, as three separate calls. Never an array: an
    // array is a pattern the OS owns and that keeps buzzing after the player has skipped. The
    // score fires these too, and the inter-onset interval collapses the duplicate.
    'act.begin': { g: 0, s: 0, w: 0, h: 12, self: true, ioi: 1000, play: null },
    'act.mid': { g: 0, s: 0, w: 0, h: 12, self: true, ioi: 1000, play: null },
    'act.end': { g: 0, s: 0, w: 0, h: 30, self: true, ioi: 1000, play: null },

    'save': { g: 0, s: 0, w: 0, h: 0, ioi: 0, play: null },     // silent, always
    'error': { g: 0, s: 0, w: 0, h: 0, ioi: 0, play: null }     // silent, always
  }

  // Existing call sites in act1.js and ui.js use the short verb. The canonical names of §5.2 are
  // the table's keys; these are the aliases, in one place, rather than a rename across four files.
  var ALIAS = {
    extend: 'tap.extend', hold: 'tap.hold', tap: 'tap.ui', ui: 'tap.ui',
    deny: 'tap.deny', buy: 'buy.commit', tick: 'buy.tick', claim: 'claim.complete',
    season: 'season.turn', reveal: 'unlock.reveal', complete: 'project.complete',
    fill: 'market.fill', pulse: 'pulse.fire', flush: 'flush.release', fail: 'fail.event',
    'ui.tap': 'tap.ui', 'ui.press': 'tap.ui', 'ui.repeat': 'buy.tick',
    'ui.error': 'tap.deny', 'ui.reveal': 'unlock.reveal'
  }

  // A three-second tilt dip under warn.major, and a two-second air duck under combat.loss: two
  // events that change the room rather than adding a note to it.
  function tiltEvent (db, ms) {
    if (!bed) return
    bed.tiltEvent = db
    later(ms, function () { if (bed) bed.tiltEvent = 0 })
  }

  // Both dips live on their own multiplier: bedParams() rewrites `airMul` and `season` every
  // 200 ms from the world, and an event that wrote to those would be erased on the next bed step.
  function airDip (mul, ms) {
    if (!bed) return
    bed.airDip = mul
    later(ms, function () { if (bed) bed.airDip = 1 })
  }

  function voiceDip (name, ms) {
    if (!bed || !bed[name]) return
    var v = bed[name]
    v.dip = 0
    later(ms, function () { v.dip = 1 })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HAPTICS · 07 §7
  //
  // Nothing exceeds 30 ms and nothing is an array. An array is a pattern the OS owns and that keeps
  // buzzing after the player has skipped the transition; separate calls can be cancelled.
  // ───────────────────────────────────────────────────────────────────────────

  function canVibrate () {
    return typeof navigator !== 'undefined' && !!navigator.vibrate
  }

  // iOS Safari has never implemented the Vibration API, so every gate above is
  // correct and every buzz on an iPhone is silently dropped. What Safari 17.4+
  // does give is real system haptics on a switch control, and toggling one from
  // script fires them — so on that platform the switch IS the vibration motor.
  // One hidden control, reused: it is visually hidden rather than display:none
  // because a control that is not rendered is not actuated either.
  var hapSwitch = null

  function canSwitchHaptic () {
    var d = doc()
    if (!d || typeof d.createElement !== 'function') return false
    try { return 'switch' in d.createElement('input') } catch (e) { return false }
  }

  function switchHaptic () {
    var d = doc()
    if (!d || !d.body) return false
    if (!hapSwitch) {
      var input = d.createElement('input')
      input.type = 'checkbox'
      input.setAttribute('switch', '')
      input.id = 'hy-hap'
      input.tabIndex = -1
      input.setAttribute('aria-hidden', 'true')
      var label = d.createElement('label')
      label.setAttribute('for', 'hy-hap')
      label.setAttribute('aria-hidden', 'true')
      var box = d.createElement('div')
      box.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;' +
        'opacity:0;pointer-events:none;overflow:hidden'
      box.appendChild(input)
      box.appendChild(label)
      d.body.appendChild(box)
      hapSwitch = { input: input, label: label }
    }
    // The toggle is the haptic; its state is meaningless and nothing reads it.
    try { hapSwitch.label.click() } catch (e) { return false }
    return true
  }

  // H1 · duty cycle. Two ring buffers, no queue: a queued buzz arrives after the thing it
  // described. Excess is dropped.
  function hapticBudget (ms) {
    var t = nowMs()
    while (hapMs.length && t - hapMs[0].t > 1000) hapMs.shift()
    while (hapEvents.length && t - hapEvents[0] > 10000) hapEvents.shift()
    var budget = (batteryScale < 1 ? AUD.hap.lowBudgetMsPerSec : AUD.hap.budgetMsPerSec)
    var used = 0
    for (var i = 0; i < hapMs.length; i++) used += hapMs[i].ms
    if (used + ms > budget) return false
    if (hapEvents.length >= AUD.hap.maxPer10s) return false
    hapMs.push({ t: t, ms: ms })
    hapEvents.push(t)
    return true
  }

  function haptic (ms) {
    if (!(ms > 0)) return false
    if (!hapticsOn() || reducedMotion() || scrolling) return false
    if (!canVibrate() && !canSwitchHaptic()) return false
    if (offlineMode) return false
    if (nowMs() - visibleAt < AUD.gov.gateAfterVisibleMs) return false
    var d = doc()
    if (d && d.hidden) return false
    var v = Math.max(AUD.hap.minMs, Math.round(ms * batteryScale))
    if (!hapticBudget(v)) return false
    // Duration is not expressible on the switch path — iOS picks the weight —
    // so the budget above still governs how OFTEN it can fire, which is the
    // part that matters for not being annoying.
    if (!canVibrate()) return switchHaptic()
    try { navigator.vibrate(v) } catch (e) { return false }
    return true
  }

  function hapticAt (delayMs, ms) {
    var id = setTimeout(function () { drop(hapticTimers, id); haptic(ms) }, delayMs)
    hapticTimers.push(id)
    return id
  }

  function hapticCancel () {
    for (var i = 0; i < hapticTimers.length; i++) clearTimeout(hapticTimers[i])
    hapticTimers.length = 0
    if (canVibrate()) { try { navigator.vibrate(0) } catch (e) { /* nothing to cancel */ } }
  }

  // Progressive, optional, never announced, never blocked on.
  function watchBattery () {
    if (typeof navigator === 'undefined' || !navigator.getBattery) return
    try {
      navigator.getBattery().then(function (b) {
        var read = function () {
          batteryScale = (b.level < AUD.hap.lowBattery && !b.charging) ? AUD.hap.lowScale : 1
        }
        read()
        b.addEventListener('levelchange', read)
        b.addEventListener('chargingchange', read)
      }, function () { /* a browser that refuses is a browser at full duty cycle */ })
    } catch (e) { /* see above */ }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GOVERNORS · 07 §5.5, and the gate of §5.6
  // ───────────────────────────────────────────────────────────────────────────

  // The gate is the answer to "when NOT to fire". Each of these has produced a shipped game that
  // people mute.
  function gateClosed (name) {
    var d = doc()
    if (d && d.hidden) return true                                   // 6
    if (offlineMode) return true                                     // 2
    var t = nowMs()
    if (t - visibleAt < AUD.gov.gateAfterVisibleMs) return true      // 1
    if (t < silenceUntil) return true                                // 8 — scored silence
    if (t < transitionUntil && !transitionOwns) return true          // 7
    if (name === 'save' || name === 'error') return true             // §5.2: silent, always
    return false
  }

  function governors (name, E, p) {
    var t = nowMs()

    // G4 · no more than nine UI onsets per second, measured over a rolling window. Excess is
    // dropped, never queued.
    while (onsets.length && t - onsets[0] > 1000) onsets.shift()
    if (onsets.length >= AUD.gov.maxPerSec) return null

    var c = coalesce[name] || (coalesce[name] = { n: 0, at: 0 })
    if (t - c.at > AUD.gov.coalesceMs) c.n = 0
    c.at = t

    // G1 · minimum inter-onset interval. A suppressed call falls through to G2 rather than playing.
    // An event that has never fired is not "recently fired": the clock origin is page load, so a
    // default of 0 would mute every 3-second event for the first three seconds of the game.
    var last = lastFired[name]
    if (E.ioi && last !== undefined && t - last < E.ioi) {
      c.n += 1
      // G2 · coalescence. Five reveals in one frame are a tier, not a jackpot: one sound, one
      // 12 ms haptic, five independent visual arrivals.
      if (c.n >= AUD.gov.coalesceN) {
        c.n = 0
        lastFired[name] = t
        onsets.push(t)
        return { coalesced: true, gain: AUD.gov.coalesceGain }
      }
      return null
    }

    // 07 §5.6 rule 11: a warning never re-fires for the same underlying condition until it clears.
    if (E.latch && p && p.cause !== undefined) {
      if (warnLatch[name] === p.cause) return null
      warnLatch[name] = p.cause
    }

    c.n = 0
    lastFired[name] = t
    onsets.push(t)
    return { coalesced: false, gain: 1 }
  }

  function clearWarn (name, cause) {
    if (cause === undefined || warnLatch[name] === cause) delete warnLatch[name]
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE SINGLE ENTRY POINT · 07 §12.1
  //
  // Gameplay code never touches AudioContext, navigator.vibrate or a feedback class. There is one
  // function, it is a table lookup, and it has a top-level guard: it never throws.
  // ───────────────────────────────────────────────────────────────────────────

  function feel (event, p) {
    try {
      return feelInner(event, p || {})
    } catch (e) {
      return false
    }
  }

  function feelInner (event, p) {
    var name = ALIAS[event] || event
    var E = EVENTS[name]
    if (!E) return false
    if (gateClosed(name)) return false

    var g = governors(name, E, p)
    if (!g) return false

    var m = mode()
    if (E.play && m !== 'off' && ready && ctx && !(m === 'sparse' && E.bedOnly)) {
      var o = {
        g: E.g * g.gain * (p.gain === undefined ? 1 : num(p.gain)),
        s: E.s,
        n: g.coalesced && p.n !== undefined ? nextPartial(p.n) : p.n
      }
      if (g.coalesced && o.n === undefined && name === 'unlock.reveal') o.n = nextPartial(8)
      E.play(ctx.currentTime + AUD.nowPad, p, o)
    }

    // H4 · never for an event the player did not cause, except the closed `self` list.
    var wantsHaptic = p.userInitiated !== false || E.self
    if (E.h && wantsHaptic) {
      if (E.hEvery) {
        E.count = (E.count || 0) + 1
        if (E.count % E.hEvery === 0) haptic(E.h)
      } else {
        haptic(g.coalesced ? AUD.gov.coalesceHaptic : E.h)
      }
    }

    if (E.w) duck(E.w, ctx ? ctx.currentTime : 0)
    if (name === 'season.turn') seasonTurned()
    return true
  }

  // The one-time offer (07 §11.1). One console line, once, in eight hours — log.js owns the string
  // and its `once` flag, so nothing is added to the §3 save shape to remember it.
  function seasonTurned () {
    if (mode() !== 'sparse') return
    try {
      if (HY.log && HY.log.logFire) HY.log.logFire('feel.sound_offer')
    } catch (e) { /* a build without the line simply never makes the offer */ }
  }

  function acceptOffer () { setMode('full') }

  function setMode (m) {
    if (m !== 'off' && m !== 'sparse' && m !== 'full') return AUD.mode
    AUD.mode = m
    var s = st()
    if (s && s.set) s.set.sound = m
    if (m === 'off') {
      // A12: every oscillator stopped within 400 ms, then the context suspended, then zero CPU.
      hapticCancel()
      releaseAllVoices(AUD.life.releaseMs)
      if (ctx && G) ramp(G.master.gain, 0, 0.12)
      later(AUD.life.offStopMs, function () {
        bedStop()
        if (ctx && ctx.state === 'running') { try { ctx.suspend() } catch (e) { /* already gone */ } }
      })
    } else {
      if (ctx && ctx.state !== 'running') { try { ctx.resume() } catch (e) { pendingResume = true } }
      if (ctx && G) ramp(G.master.gain, AUD.master, AUD.life.modeFadeS)
      // Accepting the offer plays nothing immediately: the bed fades in over six seconds.
      if (m === 'full') bedStart()
      applyMode()
    }
    return AUD.mode
  }

  function setHaptics (on) {
    var s = st()
    if (s && s.set) s.set.haptics = !!on
    hapticCancel()
    return !!on
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LIFECYCLE · 07 §10 — HYPHAE never makes a sound the player is not looking at.
  //
  // This is a values position, not a battery optimisation, and it is not negotiable even if a
  // player asks for it. No background audio, no MediaSession, no wake lock, ever.
  // ───────────────────────────────────────────────────────────────────────────

  function suspendAll () {
    hapticCancel()
    deferred.length = 0                      // cancelled, not deferred, and never replayed
    hiddenAt = nowMs()
    bedRunningPause()
    if (!ctx) return
    try {
      // suspend() on a running graph clicks, so the master fades over ~120 ms first.
      ramp(G && G.master ? G.master.gain : null, 0, AUD.life.suspendFadeS)
    } catch (e) { /* the suspend below is the guarantee */ }
    later(AUD.life.suspendAtMs, function () {
      if (!ctx) return
      if (doc() && !doc().hidden && mode() !== 'off') return   // came back inside the fade
      try { ctx.suspend() } catch (e) { /* an engine that refuses is already idle */ }
    })
  }

  function bedRunningPause () { lastBedAt = nowMs() }

  // SOUND off stops every oscillator rather than muting it, so the tier's idle cost really is zero
  // and a later FULL rebuilds the bed from the current act's palette.
  function bedStop () {
    if (!bed) { bedRunning = false; return }
    var parts = [bed.low, bed.mid, bed.high]
    var i, j
    for (i = 0; i < parts.length; i++) {
      for (j = 0; j < parts[i].osc.length; j++) {
        try { parts[i].osc[j].stop(); parts[i].osc[j].disconnect() } catch (e) { /* already stopped */ }
      }
      try { parts[i].g.disconnect(); parts[i].lp.disconnect(); parts[i].pan.disconnect() } catch (e) { /* gone */ }
    }
    if (bed.air) {
      for (i = 0; i < bed.air.srcs.length; i++) {
        try { bed.air.srcs[i].s.stop(); bed.air.srcs[i].s.disconnect() } catch (e) { /* already stopped */ }
      }
      try { bed.air.bp.disconnect(); bed.air.g.disconnect() } catch (e) { /* gone */ }
    }
    var extra = [bed.cond, bed.shadow]
    for (i = 0; i < extra.length; i++) {
      if (!extra[i]) continue
      try { extra[i].osc.stop(); extra[i].osc.disconnect(); extra[i].g.disconnect() } catch (e) { /* gone */ }
    }
    bed = null
    bedRunning = false
  }

  function resumeAll () {
    visibleAt = nowMs()
    var away = hiddenAt ? visibleAt - hiddenAt : 0
    // 07 §4.7.1: time backgrounded does not count, and twenty minutes away is a fresh session —
    // the bed comes back at full level, which is a quiet reward for having left.
    if (away >= AUD.session.resetAwayMs) sessionStart = visibleAt
    else if (away > 0) sessionStart += away
    hiddenAt = 0

    if (mode() === 'off' || !ctx) return
    if (ctx.state === 'interrupted') { pendingResume = true; return }
    try { ctx.resume() } catch (e) { pendingResume = true }

    // Advance the OU walk rather than restoring it. A player who returns after four hours must not
    // hear the identical sound they left; that is the one way an aperiodic bed can be caught.
    var L = AUD.life
    var steps = Math.min(away, L.ouCatchupMaxMs) / (L.ouStepS * 1000)
    for (var i = 0; i < steps; i++) ouStep(L.ouStepS)

    nextGrainAt = ctx.currentTime + L.rebaseS      // rebase, never catch up
    lastBedAt = nowMs()
    ramp(G && G.master ? G.master.gain : null, AUD.master, L.resumeFadeS)

    if (away >= L.returnAwayMs) {
      later(AUD.gov.gateAfterVisibleMs + 20, function () { feel('offline.return') })
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ACT TRANSITIONS AND ENDINGS · 07 §6 — scored to the existing visual timelines
  //
  // Reduced motion collapses the visuals and does NOT collapse the audio: audio is not a
  // vestibular hazard, and a player who turned off motion has done nothing to deserve a lesser
  // transition. The obvious implementation gates both behind one flag, and that is wrong.
  // ───────────────────────────────────────────────────────────────────────────

  function at (ms, fn) { later(ms, function () { if (transitionOwns) fn() }) }

  function beginScore (totalMs) {
    transitionOwns = true
    transitionUntil = nowMs() + totalMs + AUD.gov.transitionLeadMs
  }

  function endScore () { transitionOwns = false; transitionUntil = 0 }

  function silence (ms) { silenceUntil = Math.max(silenceUntil, nowMs() + ms); deferred.length = 0 }

  // A skipped transition must stop vibrating immediately and must not leave an orphan node.
  function skipScore () {
    cancelTimers()
    hapticCancel()
    endScore()
    silenceUntil = 0
    if (ctx) {
      releaseAllVoices(300)
      ramp(G && G.master ? G.master.gain : null, AUD.master, 0.10)
      duck(0)
      if (G) { try { G.bedDuck.gain.cancelScheduledValues(ctx.currentTime) } catch (e) { /* gone */ } }
    }
  }

  // Act I → Act II, DECIDE. Total 4,000 ms.
  function scoreDecide () {
    beginScore(4000)
    var t0 = ctx ? ctx.currentTime : 0
    duck(4, t0)
    feel('act.begin')
    scheduleIR('CHAMBER')
    at(200, function () {
      breath(ctx.currentTime + AUD.nowPad, 180, 900,
        { Q: 1.4, attack: 0.600, release: 1.400, gain: 0.16, send: 0.55, weight: 4 })
    })
    // The only upward sweep in the game outside flush.release, tracking the luminance wave's radius.
    at(600, function () {
      sweep(ctx.currentTime + AUD.nowPad, 240, 1500,
        { dur: 2.40, Q: 5.0, gain: 0.20, send: 0.58, weight: 4 })
    })
    // The 7th and 11th partials enter under the sweep and are not consciously heard arriving.
    at(1400, function () { setActPalette(2, AUD.xfade.palette) })
    at(2400, function () {
      feel('act.mid')
      releaseAllVoices(300)
      silence(1600)                       // only the sweep's tail remains, in the new CHAMBER
    })
    at(4000, function () {
      feel('act.end')
      endScore()
      if (G) ramp(G.bedDuck.gain, 1, AUD.xfade.unduck / 3)
      condStart()
      if (bed && bed.cond) bed.cond.g.gain.value = 0
    })
  }

  // Act II → Act III, ESCAPE. Total ~11.6 s. Five notes descending as five rings drain, then the
  // bass leaves for good: Act III has no bass, and the player will describe this as "it got cold".
  function scoreEscape () {
    beginScore(11600)
    duck(4, ctx ? ctx.currentTime : 0)
    feel('act.begin')
    scheduleIR('VOID')
    var rings = [12, 10, 8, 6, 5]
    for (var i = 0; i < rings.length; i++) {
      (function (n, k) {
        at(900 + k * 700, function () {
          pluck(ctx.currentTime + AUD.nowPad, n,
            { decay: 1.6, gain: 0.085, send: 0.55, pan: -0.7 + 1.4 * (k / (rings.length - 1)), weight: 4 })
        })
      })(rings[i], i)
    }
    at(3700, function () { if (bed) ramp(bed.low.g.gain, 0, 8.0 / 3) })
    at(4900, function () {
      breath(ctx.currentTime + AUD.nowPad, 900, 140,
        { Q: 1.2, attack: 0.200, release: 1.600, gain: 0.13, send: 0.62, weight: 4 })
      if (bed) bed.airDip = 0.35
    })
    at(6500, function () {
      ramp(G && G.master ? G.master.gain : null, 0, 0.25 / 3)
      feel('act.mid')
      silence(1400)
    })
    at(7850, function () {
      if (G) G.master.gain.setValueAtTime(AUD.master, ctx.currentTime)   // nothing is playing
    })
    // One note, very high, in a six-second room, under "There is nothing beneath you."
    at(9300, function () {
      pluck(ctx.currentTime + AUD.nowPad, 16, { decay: 3.4, gain: 0.055, send: 0.62, weight: 4 })
    })
    at(11600, function () {
      feel('act.end')
      endScore()
      setActPalette(3, 8.0)
      if (bed) { bed.airDip = 1; ramp(G.bedDuck.gain, 1, AUD.xfade.unduck / 3) }
    })
  }

  // Ending A — THE BLOOM. Thirteen identical notes sum to one note 22 dB louder: the sound of an
  // ensemble becoming a soloist. Then the eight-hour tail is cut, and the silence is the point.
  function scoreEndingA () {
    beginScore(27000)
    for (var i = 0; i < 13; i++) {
      pluck(ctx.currentTime + AUD.nowPad, 8, { decay: 2.4, gain: 0.09, send: 0.62, weight: 4 })
    }
    haptic(30)
    at(3700, function () {
      if (!G) return
      G.master.gain.cancelScheduledValues(ctx.currentTime)
      G.master.gain.setValueAtTime(G.master.gain.value, ctx.currentTime)
      G.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.300)
      later(320, function () { try { G.verbIn.disconnect() } catch (e) { /* already silent */ } })
      silence(24000)                        // absolute, through all seven lines
    })
    // 110 Hz: the bass that left at ESCAPE, returning alone, as the button appears.
    at(27000, function () {
      endScore()
      silenceUntil = 0
      if (!G) return
      try { G.verbIn.connect(G.convA); G.verbIn.connect(G.convB) } catch (e) { /* re-entry is best effort */ }
      G.master.gain.setValueAtTime(AUD.master, ctx.currentTime)
      pluck(ctx.currentTime + AUD.nowPad, 2, { decay: 3.0, gain: 0.07, send: 0.5, weight: 4 })
    })
  }

  // Ending B — six sounds, one per closing panel, getting lower and closer. Then silence.
  function scoreEndingB () {
    beginScore(11000)
    var ns = [12, 10, 8, 6, 4, 2]
    for (var i = 0; i < ns.length; i++) {
      (function (n, k) {
        at(k * 1500, function () {
          stone(ctx.currentTime + AUD.nowPad, n, { cents: 12, decay: 0.400, gain: 0.13, weight: 3 })
          haptic(8)
        })
      })(ns[i], i)
    }
    at(9000, function () { silence(2200); ramp(G && G.master ? G.master.gain : null, 0, 0.3) })
    at(11000, endScore)
  }

  // Ending C — the bed does not stop. It becomes something else's. No one-shots at all.
  function scoreEndingC () {
    beginScore(12000)
    shadowStart()
    if (bed) {
      ramp(bed.shadow ? bed.shadow.g.gain : null, AUD.drone.mid.g, 12.0 / 3)
      ramp(bed.mid.g.gain, 0, 12.0 / 3)
      ramp(bed.high.g.gain, 0, 12.0 / 3)
    }
    at(12000, endScore)
  }

  // ENCYST — the longest fade in the game, for the ending that is not one.
  function scoreEncyst () {
    beginScore(20000)
    breath(ctx.currentTime + AUD.nowPad, 120, 400,
      { attack: 0.900, release: 2.600, gain: 0.10, send: 0.62, weight: 4 })
    ramp(G && G.bedGain ? G.bedGain.gain : null, 0, 20.0 / 3)
    at(20000, endScore)
  }

  var SCORES = { decide: scoreDecide, escape: scoreEscape,
                 A: scoreEndingA, B: scoreEndingB, C: scoreEndingC, encyst: scoreEncyst }

  function score (which) {
    var fn = SCORES[which]
    if (!fn || !ctx || !ready) return false
    try { fn() } catch (e) { endScore() }
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MICRO-FEEDBACK · 07 §8
  // ───────────────────────────────────────────────────────────────────────────

  // The ripple, the dim tail digits, the flash hold and the reveal dot are the only visual rules
  // this module owns, so they ship with it rather than sitting in another agent's stylesheet.
  // Tokens only: no hex, no URL, no font.
  var FX_CSS =
    '[data-fx]{position:relative;overflow:hidden;}' +
    '[data-fx]::after{content:"";position:absolute;left:var(--rx,50%);top:var(--ry,50%);' +
    'width:2px;height:2px;border-radius:50%;pointer-events:none;' +
    'background:var(--fx-tone,var(--text-tertiary));opacity:var(--ro,0);' +
    'transform:translate(-50%,-50%) scale(var(--s,0));}' +
    '[data-fx="1"]::after{transition:transform var(--fx-ms,340ms) var(--ease-out),' +
    'opacity var(--fx-ms,340ms) var(--ease-out);}' +
    '.fx-dim{color:var(--text-tertiary);}' +
    '[data-fx-flash="1"]{color:var(--text-max);}' +
    '.fx-new{position:absolute;top:var(--sp-6,4px);inset-inline-end:var(--sp-6,4px);' +
    'width:6px;height:6px;border-radius:50%;background:var(--positive);' +
    'transition:opacity 180ms linear;}' +
    '@media (prefers-reduced-motion:reduce){[data-fx]::after{display:none;}}' +
    ':root[data-motion="reduce"] [data-fx]::after{display:none;}'

  var styleDone = false

  function ensureStyle () {
    if (styleDone) return
    var d = doc()
    if (!d || !d.head) return
    styleDone = true
    var el = d.createElement('style')
    el.id = 'hy-feel-fx'
    el.textContent = FX_CSS
    d.head.appendChild(el)
  }

  // ── 8.1 · number roll-ups ────────────────────────────────────────────────
  //
  // A counter reading 4.12 kg that updates every 100 ms with a change below 0.01 kg is visually
  // static, and it reads as broken. That is a precision bug, not an animation problem: the number
  // must never be still while the rate is non-zero.
  function basePrecision (m) { return m < 10 ? 2 : m < 100 ? 1 : 0 }

  function displayPrecision (value, ratePerSec) {
    var v = Math.abs(num(value)), r = Math.abs(num(ratePerSec))
    var e = v < 1000 ? 0 : Math.floor(Math.log(v) / Math.LN10 / 3)
    var scale = Math.pow(1000, e)
    var m = v / scale
    var perFrame = (r / scale) / AUD.fx.framesPerSec
    var base = basePrecision(m)
    // A stopped counter is not a broken counter: extra places are earned by movement only.
    if (!(perFrame > 0)) return base
    for (var d = base; d <= base + AUD.fx.extraDigits; d++) {
      // The least significant digit must change at least once every two rendered frames.
      if (perFrame >= (1 / AUD.fx.minMoveFrames) * Math.pow(10, -d)) return d
    }
    return base + AUD.fx.extraDigits
  }

  // Splits a value into the scannable part, the moving part, and the suffix. The dim tail is a
  // truncation of the full string rather than a second rounding, because rounding the bright part
  // independently would make the concatenation say something the value does not.
  function numParts (value, ratePerSec) {
    var core = C()
    var v = num(value)
    var neg = v < 0
    if (neg) v = -v
    var out = { base: '', extra: '', suffix: '', neg: neg }
    if (!isFinite(value) || value !== value) { out.base = core ? core.fmt(value) : '' + value; return out }
    var SUF = core ? core.SUF : ['']
    var e = v < 1000 ? 0 : Math.floor(Math.log(v) / Math.LN10 / 3)
    if (e >= SUF.length) { out.base = core ? core.fmt(value) : '' + value; return out }
    var m = v / Math.pow(1000, e)
    if (m >= 1000) { e += 1; m /= 1000 }
    var d = displayPrecision(v, ratePerSec)
    var full = m.toFixed(d)
    if (parseFloat(full) >= 1000 && e + 1 < SUF.length) {
      e += 1; m /= 1000; d = displayPrecision(v, ratePerSec); full = m.toFixed(d)
    }
    var b = basePrecision(m)
    var cut = m.toFixed(b).length
    out.base = full.slice(0, cut)
    out.extra = full.slice(cut)
    out.suffix = e > 0 ? ' ' + SUF[e] : ''
    return out
  }

  // R3 · interpolation, not animation. The value moves, the string is regenerated, no glyph is
  // ever transformed. R5 · never interpolate across a suffix boundary — 999 g → 1.00 kg would
  // briefly read 0.99 kg and look like a bug.
  function lerpDisplay (last, value, alpha) {
    var a = num(last), b = num(value)
    if (a === 0 || b === 0) return b
    if (Math.floor(Math.log(Math.abs(a)) / Math.LN10 / 3) !== Math.floor(Math.log(Math.abs(b)) / Math.LN10 / 3)) return b
    return a + (b - a) * clamp(num(alpha), 0, 1)
  }

  function writeNum (el, value, ratePerSec, opts) {
    if (!el) return ''
    ensureStyle()
    var o = opts || {}
    var p = numParts(value, ratePerSec)
    var txt = (p.neg ? '−' : '') + p.base + p.extra + p.suffix
    if (el.__fxLast === txt) return txt
    el.__fxLast = txt
    var d = doc()
    if (!el.__fxMain && d) {
      el.textContent = ''
      el.__fxMain = d.createElement('span')
      el.__fxDim = d.createElement('span')
      el.__fxDim.className = 'fx-dim'
      el.__fxSuf = d.createElement('span')
      el.appendChild(el.__fxMain)
      el.appendChild(el.__fxDim)
      el.appendChild(el.__fxSuf)
    }
    if (el.__fxMain) {
      el.__fxMain.textContent = (p.neg ? '−' : '') + p.base
      el.__fxDim.textContent = p.extra
      el.__fxSuf.textContent = p.suffix
    } else {
      el.textContent = txt
    }
    // R4 · large discrete gains snap and flash, and bigger gains flash longer. Nothing scales,
    // nothing translates, and no digit is animated.
    if (o.gain !== undefined && o.tickDelta) {
      var big = Math.abs(num(o.gain)) > AUD.fx.flashBigRatio * Math.abs(num(o.tickDelta))
      flash(el, big ? AUD.fx.flashBigMs : AUD.fx.flashMs)
    }
    return txt
  }

  function flash (el, ms) {
    if (!el || reducedMotion()) return
    el.setAttribute('data-fx-flash', '1')
    if (el.__fxFlash) clearTimeout(el.__fxFlash)
    el.__fxFlash = setTimeout(function () {
      el.__fxFlash = 0
      el.removeAttribute('data-fx-flash')
    }, ms)
  }

  // ── 8.2 · the ripple ─────────────────────────────────────────────────────
  //
  // Runs in parallel with the 70 ms press scale, never after it. The pseudo-element is declared in
  // CSS and is never allocated on press; will-change is removed on transitionend, because a
  // permanently promoted layer per button is a memory leak.
  function ripple (el, ev, weight) {
    if (!el || reducedMotion()) return false
    ensureStyle()
    var r
    try { r = el.getBoundingClientRect() } catch (e) { return false }
    var x = ev && ev.clientX !== undefined ? ev.clientX - r.left : r.width / 2
    var y = ev && ev.clientY !== undefined ? ev.clientY - r.top : r.height / 2
    var s = Math.max(r.width, r.height) * AUD.fx.rippleScale / 2
    var tone = weight === 'deny' ? 'var(--negative)'
      : (num(weight) >= 1 ? 'var(--positive)' : 'var(--text-tertiary)')

    el.style.setProperty('--rx', x + 'px')
    el.style.setProperty('--ry', y + 'px')
    el.style.setProperty('--fx-tone', tone)
    el.style.setProperty('--fx-ms', AUD.fx.rippleMs + 'ms')
    el.setAttribute('data-fx', '0')
    el.style.setProperty('--s', '0')
    el.style.setProperty('--ro', String(AUD.fx.rippleAlpha))
    void el.offsetWidth                                    // commit the reset before the transition
    el.style.willChange = 'transform'
    el.setAttribute('data-fx', '1')
    el.style.setProperty('--s', String(Math.max(1, s)))
    el.style.setProperty('--ro', '0')
    if (!el.__fxBound) {
      el.__fxBound = true
      el.addEventListener('transitionend', function () { el.style.willChange = '' })
    }
    return true
  }

  // ── 8.3 · meters ─────────────────────────────────────────────────────────
  //
  // The fill brightens as it approaches full — no pulsing, no glow, no shimmer — and the arrival
  // haptic is latched, because a meter hovering at 1.0 would otherwise buzz forever.
  function meterSet (el, v, key) {
    if (!el) return 0
    var val = clamp(num(v), 0, 1)
    var fill = el.classList && el.classList.contains('meter-fill') ? el
      : (el.querySelector ? el.querySelector('.meter-fill') : null)
    var target = fill || el
    target.style.setProperty('--v', String(val))
    if (val >= AUD.fx.meterHot) target.setAttribute('data-hot', '1')
    else target.removeAttribute('data-hot')

    var k = key || 'meter'
    if (val >= AUD.fx.meterFull && !meterLatch[k]) {
      meterLatch[k] = true
      haptic(4)
    } else if (val < AUD.fx.meterClear) {
      meterLatch[k] = false
    }
    return val
  }

  // ── 8.4 · the "something new" pulse ──────────────────────────────────────
  //
  // Haptic and audio are both at t=0; the visual is allowed to be the slow one, because vision
  // tolerates ~100 ms of lag before causality breaks and touch and hearing tolerate ~20 ms. Never
  // delay the haptic or the audio to match the visual.
  function reveal (el, opts) {
    var o = opts || {}
    watchAria()
    feel('unlock.reveal', { userInitiated: o.userInitiated === true })
    if (!el) return false
    ensureStyle()
    var d = doc()
    if (o.index) el.style.animationDelay = (o.index * AUD.fx.revealStaggerMs) + 'ms'
    if (el.classList) el.classList.add('reveal')
    if (!d) return true
    var dot = d.createElement('span')
    dot.className = 'fx-new'
    dot.setAttribute('aria-hidden', 'true')
    el.appendChild(dot)
    var fade = function () {
      setTimeout(function () {
        dot.style.opacity = '0'
        setTimeout(function () { if (dot.parentNode) dot.parentNode.removeChild(dot) }, AUD.fx.dotFadeMs)
      }, AUD.fx.dotHoldMs)
    }
    var w = win()
    if (w && w.IntersectionObserver) {
      var io = new w.IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].intersectionRatio >= 0.5) { io.disconnect(); fade(); return }
        }
      }, { threshold: [0.5] })
      io.observe(el)
    } else {
      fade()
    }
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WIRING
  // ───────────────────────────────────────────────────────────────────────────

  function attach () {
    if (attached) return
    attached = true
    var d = doc(), w = win()
    if (!d || !w) return

    // The context is created inside the first pointerdown — which in HYPHAE is always the first
    // EXTEND tap, so the first sound the player ever hears is their own first action.
    d.addEventListener('pointerdown', function () {
      audioBoot()
      if (pendingResume) tryPendingResume()
    }, { capture: true, passive: true })

    d.addEventListener('visibilitychange', function () {
      if (d.hidden) suspendAll(); else resumeAll()
    })
    w.addEventListener('pagehide', function (e) {
      suspendAll()
      if (ctx && e && e.persisted === false) {
        try { ctx.close() } catch (err) { /* a closed context cannot be closed twice */ }
        ctx = null; ready = false; booted = false; G = null; bed = null; bedRunning = false
      }
    })
    w.addEventListener('freeze', suspendAll)
    w.addEventListener('resume', resumeAll)

    // A vibration during a flick reads as the phone malfunctioning (07 §7.3 H2).
    d.addEventListener('scroll', function () {
      scrolling = true
      if (scrollTimer) clearTimeout(scrollTimer)
      scrollTimer = setTimeout(function () { scrolling = false; scrollTimer = 0 }, AUD.fx.scrollIdleMs)
    }, { capture: true, passive: true })

    watchBattery()
    watchAria()
    ensureStyle()
  }

  // Audio never competes with a screen reader: the bed ducks 6 dB for 2.5 s whenever an aria-live
  // region updates. Three lines, and it is the difference between usable and hostile.
  function watchAria () {
    if (ariaBound) return
    var d = doc(), w = win()
    if (!d || !w || !w.MutationObserver) return
    var live = d.querySelector('[aria-live]')
    if (!live) return                       // the console has not mounted yet; init() retries
    ariaBound = true
    var obs = new w.MutationObserver(function () {
      if (!ctx || !G || mode() !== 'full') return
      var t = ctx.currentTime
      ramp(G.bedGain.gain, bedLevel() * dbToLin(AUD.srDuck.db), 0.04, t)
      later(AUD.srDuck.ms, function () { applyMode() })
    })
    obs.observe(live, { childList: true, characterData: true, subtree: true })
  }

  function init (s) {
    attach()
    var state = s || st()
    if (state && state.set && state.set.sound) AUD.mode = state.set.sound
    curAct = state && (state.act === 2 || state.act === 3) ? state.act : 1
    sessionStart = nowMs()
    // The frame loop, when it exists, gives the bed a 5 Hz slot without adding a timer of our own.
    try {
      if (HY.loop && HY.loop.onFrame) HY.loop.onFrame(function () { bedStep(false) })
    } catch (e) { /* tick() drives the bed on its own when there is no loop module */ }
    return HY.feel
  }

  // BIBLE §6's generic module surface. Offline reconciliation runs through the same simTick, so
  // this is also where the "no sound for anything that happened while away" rule is enforced: the
  // whole feel layer is muted for the duration and yields exactly one sound afterwards.
  function tick (s, dt, opts) {
    var wasOffline = offlineMode
    offlineMode = !!(opts && opts.offline)
    if (offlineMode && !wasOffline) { hapticCancel(); deferred.length = 0 }
    if (offlineMode) return
    var state = s || st()
    if (state) {
      var a = state.act === 2 || state.act === 3 ? state.act : 1
      // A palette that is wrong for the act happens only on a load, never on a transition: a
      // transition owns the crossfade and has already set it.
      if (a !== curAct && !transitionOwns) setActPalette(a, AUD.xfade.palette)
      if (bed && ctx && ready) {
        var space = spaceFor(a)
        if (IR.name !== space && IR.pending !== space && !transitionOwns) scheduleIR(space)
      }
    }
    bedStep(false)
  }

  // The turgor pulse (07 §8.2) is drawn on the flux surface, which canvas.js owns. We ask; if the
  // surface has no such verb the tap still has its haptic, its knock and its ripple.
  function turgor () {
    try {
      if (HY.canvas && HY.canvas.turgor) HY.canvas.turgor()
    } catch (e) { /* a missing pulse is not a failed tap */ }
  }

  // Deferred pulse arrivals beyond the 300 ms scheduling horizon (07 §5.3). A 120-second start()
  // offset survives suspension badly, so these ride the bed clock and are cancelled on suspend.
  function arrive (list) {
    if (!list || !list.length) return 0
    var sorted = list.slice().sort(function (a, b) { return num(b.strength) - num(a.strength) })
    var n = Math.min(6, sorted.length)                 // six audible arrivals per pulse, max
    var fired = 0
    for (var i = 0; i < n; i++) {
      var r = sorted[i]
      if (num(r.strength) < 0.20) continue             // floor: never audible below this
      fired += 1
      var lag = num(r.lagSeconds) * 1000
      var p = { dist: r.dist, strength: r.strength, pan: r.pan, userInitiated: false }
      if (lag <= AUD.lookahead * 1000) later(lag, mkArrive(p))
      else deferred.push({ at: nowMs() + lag, fn: mkArrive(p) })
    }
    return fired
  }

  function mkArrive (p) { return function () { feel('pulse.arrive', p) } }

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — returns [] when healthy. Runs entirely against a mocked AudioContext so it can
  // never take the audio device, and restores every global it touched.
  // ───────────────────────────────────────────────────────────────────────────

  function MockParam (v) { this.value = v; this.calls = 0 }
  MockParam.prototype.setValueAtTime = function (v) { this.value = v; this.calls++; return this }
  MockParam.prototype.linearRampToValueAtTime = function (v) { this.value = v; this.calls++; return this }
  MockParam.prototype.exponentialRampToValueAtTime = function (v) {
    if (!(v > 0)) throw new Error('exponentialRamp to a non-positive value')
    this.value = v; this.calls++; return this
  }
  MockParam.prototype.setTargetAtTime = function (v) { this.value = v; this.calls++; return this }
  MockParam.prototype.setValueCurveAtTime = function () { this.calls++; return this }
  MockParam.prototype.cancelScheduledValues = function () { return this }

  function mockCtx (counter) {
    function node (extra) {
      var n = { connect: function (d) { return d }, disconnect: function () {} }
      counter.nodes += 1
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) n[k] = extra[k]
      return n
    }
    var c = {
      sampleRate: 48000,
      currentTime: 1.0,
      state: 'suspended',
      destination: { connect: function () {}, disconnect: function () {} },
      createGain: function () { return node({ gain: new MockParam(1) }) },
      createOscillator: function () {
        return node({
          type: 'sine', frequency: new MockParam(440), detune: new MockParam(0),
          setPeriodicWave: function () {},
          start: function () { counter.starts += 1 }, stop: function () {}
        })
      },
      createBiquadFilter: function () {
        return node({ type: 'lowpass', frequency: new MockParam(1000), Q: new MockParam(1), gain: new MockParam(0) })
      },
      createStereoPanner: function () { return node({ pan: new MockParam(0) }) },
      createBufferSource: function () {
        return node({
          buffer: null, loop: false, playbackRate: new MockParam(1),
          start: function () { counter.starts += 1 }, stop: function () {}
        })
      },
      createConvolver: function () { return node({ buffer: null, normalize: true }) },
      createDelay: function () { return node({ delayTime: new MockParam(0) }) },
      createDynamicsCompressor: function () {
        return node({ threshold: new MockParam(0), knee: new MockParam(0), ratio: new MockParam(1),
                      attack: new MockParam(0), release: new MockParam(0) })
      },
      createPeriodicWave: function () { return {} },
      createBuffer: function (ch, len, sr) {
        var data = []
        for (var i = 0; i < ch; i++) data.push(new Float32Array(len))
        return {
          numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr,
          getChannelData: function (i) { return data[i] }
        }
      },
      resume: function () { c.state = 'running'; return { then: function (f) { f(); return { then: function () {} } } } },
      suspend: function () { c.state = 'suspended'; return { then: function (f) { f() } } },
      close: function () { c.state = 'closed'; return { then: function (f) { f() } } }
    }
    return c
  }

  function resetAll () {
    cancelTimers(); hapticCancel()
    ctx = null; ready = false; booted = false; unavailable = false; pendingResume = false
    G = null; bed = null; MODS = null; NB = {}; fdn = null
    IR = { name: '', active: 'A', pending: '' }
    voices.length = 0; deferred.length = 0
    lastFired = {}; coalesce = {}; onsets = []; warnLatch = {}; meterLatch = {}
    hapEvents = []; hapMs = []
    bedRunning = false; lastBedAt = 0; nextGrainAt = 0; lastGrainN = -1; lastGrainPan = 1
    silenceUntil = 0; transitionUntil = 0; transitionOwns = false; offlineMode = false
    ladderI = 0; lastTapAt = 0; curAct = 1
    visibleAt = -Infinity
  }

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }

    var w = win()
    var realAC = w ? w.AudioContext : undefined
    var realWK = w ? w.webkitAudioContext : undefined
    var realRAF = w ? w.requestAnimationFrame : undefined
    var realVib = (typeof navigator !== 'undefined') ? navigator.vibrate : undefined
    var savedMode = AUD.mode
    var counter = { nodes: 0, starts: 0, ctors: 0 }
    var vibes = []
    var restoreVibrate = false

    forceSync = true
    try {
      // 1 · nothing runs before a user gesture, and nothing throws without one.
      resetAll()
      setMode('full')                          // the preference lives in state.set.sound, not in AUD
      if (w) w.AudioContext = function () { counter.ctors += 1; return mockCtx(counter) }
      if (w) w.webkitAudioContext = undefined
      if (w) w.requestAnimationFrame = undefined

      ok(feel('tap.extend') === false || ctx === null, 'a feel() call created a context before any gesture')
      ok(ctx === null, 'ctx exists before audioBoot')
      ok(counter.ctors === 0, 'an AudioContext was constructed without a gesture')
      ok(feel('nope.not.an.event') === false, 'an unknown event was not rejected')

      // 2 · boot is idempotent and builds the whole graph.
      audioBoot()
      ok(counter.ctors === 1, 'audioBoot constructed ' + counter.ctors + ' contexts')
      audioBoot()
      ok(counter.ctors === 1, 'audioBoot is not idempotent')
      ok(ready === true, 'audioBoot did not reach ready')
      ok(!!G && !!G.master && !!G.lim && !!G.verbIn && !!G.bedMix, 'the bus graph was not built')
      ok(!!NB.white && !!NB.pink && !!NB.air, 'the noise library was not baked')
      ok(NB.white.length === 48000, 'NB.white is not 1.00 s at 48 kHz')
      ok(NB.air.numberOfChannels === 2, 'NB.air is not stereo at MID tier')
      ok(!!bed && !!bed.low && !!bed.mid && !!bed.high, 'the drone did not start')
      ok(IR.name === 'SOIL', 'the SOIL impulse response was not installed, got "' + IR.name + '"')

      // 3 · the IR generator produces a finite, non-silent, DC-free tail.
      var job = makeIRJob(irParams('SOIL'))
      var guard = 0
      while (!job.step(Infinity) && ++guard < 1e5) { /* inline */ }
      var d0 = job.buffer.getChannelData(0)
      var sum = 0, energy = 0, bad = 0
      for (var i = 0; i < d0.length; i++) {
        if (d0[i] !== d0[i] || !isFinite(d0[i])) bad += 1
        sum += d0[i]; energy += d0[i] * d0[i]
      }
      ok(bad === 0, 'the impulse response contains ' + bad + ' non-finite samples')
      ok(energy > 0, 'the impulse response is silent')
      ok(Math.abs(sum / d0.length) < 1e-6, 'the impulse response carries DC')
      ok(Math.abs(Math.sqrt(energy / d0.length) - AUD.ir.SOIL.targetRms) < AUD.ir.SOIL.targetRms,
        'the impulse response was not RMS-normalised')

      // 4 · every recipe in the master table constructs without error.
      var names = Object.keys(EVENTS)
      var probe = { dist: 3, strength: 0.55, pan: -0.4, yieldScale: 1.1, cause: 'probe' }
      for (var e = 0; e < names.length; e++) {
        var E = EVENTS[names[e]]
        if (!E.play) continue
        var before = counter.nodes
        try {
          E.play(ctx.currentTime + AUD.nowPad, probe, { g: E.g, s: E.s, n: undefined })
        } catch (err) {
          f.push('recipe ' + names[e] + ' threw: ' + (err && err.message ? err.message : err))
        }
        ok(counter.nodes > before, 'recipe ' + names[e] + ' allocated no nodes')
        ok(E.h <= 30, 'haptic for ' + names[e] + ' is ' + E.h + ' ms, above the 30 ms ceiling')
        ok(E.s === 0 || E.s >= 0.02, 'send for ' + names[e] + ' is out of range')
      }

      // 5 · every pitch in the game is an integer harmonic of 55 Hz.
      for (var a = 1; a <= 3; a++) {
        var pal = AUD.palette[a]
        for (var q = 0; q < pal.length; q++) {
          ok(pal[q] === Math.round(pal[q]) && pal[q] > 0, 'palette ' + a + ' holds a non-integer partial')
          ok(Math.abs(hz(pal[q]) - 55 * pal[q]) < 1e-9, 'hz() is not 55 × n')
        }
      }
      ok(Math.abs(hz(8) - 440) < 1e-9, 'partial 8 is not 440 Hz')

      // 6 · STONE never sends to reverb, and no material breaks its send band (07 §5.1 P5).
      ok(EVENTS['tap.deny'].s === 0 && EVENTS['warn.minor'].s === 0 && EVENTS['warn.major'].s === 0 &&
         EVENTS['fail.event'].s === 0 && EVENTS['contract.break'].s === 0 &&
         EVENTS['combat.loss'].s === 0 && EVENTS.divergence.s === 0, 'a STONE event sends to reverb')
      ok(EVENTS['tap.extend'].s <= 0.06 && EVENTS['tap.ui'].s <= 0.06 &&
         EVENTS['buy.tick'].s <= 0.06 && EVENTS['market.fill'].s <= 0.06, 'a WOOD event sends above 0.06')
      for (e = 0; e < names.length; e++) {
        ok(EVENTS[names[e]].g <= 0.28, names[e] + ' peaks above the −13 dBFS ceiling of §5.1 P6')
      }

      // 7 · the tap ladder is a six-step phrase that resets after a pause.
      ladderI = 0; lastTapAt = 0
      var seq = []
      for (i = 0; i < 12; i++) { lastTapAt = nowMs(); seq.push(tapPartial(1)) }
      ok(seq.slice(0, 6).join(',') === AUD.ladder.join(','), 'the tap ladder is not the six-step cycle')
      ok(seq[6] === AUD.ladder[0], 'the ladder does not return to the root on the seventh tap')
      lastTapAt = nowMs() - AUD.ladderResetMs - 1
      ok(tapPartial(1) === AUD.ladder[0], 'a 1.2 s pause did not reset the ladder')

      // 8 · governors: IOI suppression, coalescence into one sound, and the 9/s global ceiling.
      resetGov()
      ok(!!governors('tap.ui', EVENTS['tap.ui'], {}), 'the first call was governed away')
      ok(!governors('tap.ui', EVENTS['tap.ui'], {}), 'G1 did not suppress inside the IOI')
      ok(!governors('tap.ui', EVENTS['tap.ui'], {}), 'G1 did not suppress the second call')
      var co = governors('tap.ui', EVENTS['tap.ui'], {})
      ok(!!co && co.coalesced === true, 'G2 did not coalesce three suppressed calls into one')
      ok(Math.abs(co.gain - AUD.gov.coalesceGain) < 1e-9, 'the coalesced call is not 1.35× gain')
      resetGov()
      var played = 0
      for (i = 0; i < 40; i++) if (governors('milestone', { ioi: 0 }, {})) played += 1
      ok(played <= AUD.gov.maxPerSec, 'G4 allowed ' + played + ' onsets in one second')

      // 9 · warnings latch until the condition clears (rule 11).
      resetGov()
      ok(!!governors('warn.major', EVENTS['warn.major'], { cause: 'fire:7' }), 'the first warning was dropped')
      delete lastFired['warn.major']            // isolate the latch from the inter-onset interval
      ok(!governors('warn.major', EVENTS['warn.major'], { cause: 'fire:7' }), 'a latched warning re-fired')
      clearWarn('warn.major', 'fire:7')
      delete lastFired['warn.major']
      ok(!!governors('warn.major', EVENTS['warn.major'], { cause: 'fire:7' }), 'a cleared warning did not re-arm')

      // 10 · the gate. Hidden, offline, scored silence and a running transition all close it.
      resetGov()
      ok(gateClosed('save') === true && gateClosed('error') === true, 'save/error are not silent')
      offlineMode = true
      ok(gateClosed('tap.ui') === true, 'the gate is open during offline reconciliation')
      ok(feel('project.complete') === false, 'an offline-reconciled event made a sound')
      offlineMode = false
      silenceUntil = nowMs() + 500
      ok(gateClosed('tap.ui') === true, 'the gate is open during a scored silence')
      silenceUntil = 0
      transitionUntil = nowMs() + 500; transitionOwns = false
      ok(gateClosed('tap.ui') === true, 'the gate is open during an act transition')
      transitionOwns = true
      ok(gateClosed('tap.ui') === false, 'the transition cannot play its own score')
      transitionUntil = 0; transitionOwns = false
      visibleAt = nowMs()
      ok(gateClosed('tap.ui') === true, 'the gate is open inside 400 ms of becoming visible')
      visibleAt = -Infinity

      // 11 · haptics: the ceiling, the duty cycle, and no arrays, ever.
      if (typeof navigator !== 'undefined') {
        restoreVibrate = true
        navigator.vibrate = function (v) { vibes.push(v); return true }
      }
      hapEvents = []; hapMs = []
      var fired = 0
      for (i = 0; i < 200; i++) if (haptic(8)) fired += 1
      ok(fired <= AUD.hap.maxPer10s, 'the haptic flood fired ' + fired + ' times, cap is ' + AUD.hap.maxPer10s)
      var totalMs = 0
      for (i = 0; i < vibes.length; i++) {
        ok(typeof vibes[i] === 'number', 'navigator.vibrate was called with a pattern array')
        ok(vibes[i] <= 30, 'a haptic of ' + vibes[i] + ' ms exceeded the 30 ms ceiling')
        totalMs += vibes[i]
      }
      ok(totalMs <= AUD.hap.budgetMsPerSec, 'the duty cycle spent ' + totalMs + ' ms in one second')
      scrolling = true
      ok(haptic(8) === false, 'a haptic fired while scrolling')
      scrolling = false
      offlineMode = true
      ok(haptic(8) === false, 'a haptic fired for an offline-reconciled event')
      offlineMode = false

      // 12 · adaptive precision — the number is never still while the rate is non-zero.
      ok(displayPrecision(4.12, 0) === 2, 'displayPrecision ignored the base precision at rest')
      ok(displayPrecision(144, 0) === 0, 'displayPrecision is wrong above 100')
      ok(displayPrecision(4120, 30) > 2, 'a slow accrual did not earn extra digits')
      ok(displayPrecision(4120, 1e9) === 2, 'a fast accrual was given digits it does not need')
      ok(displayPrecision(4.12, 1e-9) === basePrecision(4.12) + AUD.fx.extraDigits,
        'displayPrecision exceeded two extra places')
      var np = numParts(1234, 0.4)
      ok(np.suffix === ' k', 'numParts lost the suffix')
      ok((np.base + np.extra).indexOf('1.23') === 0, 'numParts truncated the scannable part wrongly')
      ok(numParts(NaN, 0).base === C().fmt(NaN), 'numParts did not defer to fmt for NaN')
      ok(lerpDisplay(999, 1001, 0.5) === 1001, 'lerpDisplay interpolated across a suffix boundary')
      ok(lerpDisplay(100, 200, 0.5) === 150, 'lerpDisplay does not interpolate')

      // 13 · the bed evolves per act and the drone never repeats.
      setActPalette(2, 0.01)
      ok(curAct === 2, 'setActPalette did not move the act')
      ok(!!bed.cond, 'CONDUCTION was not instantiated for Act II')
      setActPalette(3, 0.01)
      ok(PALETTE[3].low === null, 'Act III still has a bass voice')
      setActPalette(1, 0.01)
      var x0 = MODS.map(function (m) { return m.x })
      for (i = 0; i < 50; i++) ouStep(0.2)
      var moved = 0
      for (i = 0; i < MODS.length; i++) {
        if (MODS[i].x !== x0[i]) moved += 1
        ok(MODS[i].x >= MODS[i].lo && MODS[i].x <= MODS[i].hi, 'modulator ' + MODS[i].k + ' left its clamp')
        ok(MODS[i].x === MODS[i].x, 'modulator ' + MODS[i].k + ' went non-finite')
      }
      ok(moved === MODS.length, 'the OU walk is not moving every modulator')

      // 14 · grains: no immediate repeat, no leap wider than three, and a real Poisson spread.
      lastGrainN = -1
      var last = -1, repeats = 0, leaps = 0
      var pool = GRAIN_POOL[1].map(function (r) { return r[0] })
      for (i = 0; i < 400; i++) {
        var n = drawGrain()
        lastGrainN = n
        if (n === last) repeats += 1
        if (last >= 0 && Math.abs(pool.indexOf(n) - pool.indexOf(last)) > AUD.grainRule.leap) leaps += 1
        last = n
      }
      ok(repeats === 0, 'a grain repeated immediately ' + repeats + ' times')
      // The redraw budget is six, so a wide leap is possible and rare by design; a line that never
      // leapt would be a scale, and a line that leapt often would be pointillistic.
      ok(leaps < 400 * 0.05, 'a grain leapt further than three pool steps ' + leaps + ' times in 400')

      // 15 · the twelve bindings run against a real state without throwing.
      var s = st()
      var bp = bedParams(s)
      ok(bp && typeof bp.seasonTilt === 'number' && bp.seasonTilt === bp.seasonTilt, 'bedParams gave no season tilt')
      ok(bp.send >= AUD.bind.sendA - 1e-9, 'bedParams sent below the documented floor')
      ok(bedParams(null) !== undefined, 'bedParams(null) threw')

      // 16 · session softening is monotonic, bounded, and never audible as a change.
      sessionStart = nowMs()
      ok(sessionK() === 0, 'the session curve started above zero')
      sessionStart = nowMs() - 64 * 60000
      ok(Math.abs(sessionK() - 3) < 0.05, 'the session curve is not log2 in eight-minute octaves')
      ok(clamp(AUD.session.dbPerOct * sessionK(), AUD.session.dbFloor, 0) === AUD.session.dbFloor,
        'the session trim did not reach its floor')
      sessionStart = nowMs()

      // 17 · every scored transition and ending runs and releases the bus.
      var scores = Object.keys(SCORES)
      for (i = 0; i < scores.length; i++) {
        resetGov()
        transitionOwns = false; transitionUntil = 0; silenceUntil = 0
        ok(score(scores[i]) === true, 'score ' + scores[i] + ' refused to run')
        skipScore()
        ok(transitionOwns === false, 'skipping score ' + scores[i] + ' left it owning the bus')
        ok(hapticTimers.length === 0, 'skipping score ' + scores[i] + ' left a scheduled haptic')
      }

      // 18 · voice stealing honours the tier cap and never leaves an orphan.
      resetAll(); setMode('full')
      if (w) w.AudioContext = function () { counter.ctors += 1; return mockCtx(counter) }
      audioBoot()
      for (i = 0; i < 60; i++) pluck(ctx.currentTime, 8, { decay: 0.4, gain: 0.05 })
      ok(voices.length <= tier().voices, 'polyphony reached ' + voices.length + ', cap is ' + tier().voices)

      // 19 · SPARSE keeps the context alive and the bed unbuilt — that is the whole difference
      // between someone on a bus at 08:10 and someone who asked for a drone.
      resetAll()
      setMode('sparse')
      if (w) w.AudioContext = function () { counter.ctors += 1; return mockCtx(counter) }
      audioBoot()
      ok(ready === true, 'SPARSE did not start a context')
      ok(bed === null, 'the bed was built in SPARSE')
      ok(feel('tap.ui') === true, 'SPARSE refused a UI sound')
      var startsSparse = counter.starts
      bedStep(true)
      ok(counter.starts === startsSparse, 'SPARSE scheduled a grain')
      setMode('full')
      ok(!!bed && !!bed.low && bed.low.osc.length === 2, 'FULL did not build the drone')
      ok(!!bed.air, 'FULL did not build the AIR layer')
      bedStop()
      ok(bed === null && bedRunning === false, 'bedStop left the bed standing')

      // 20 · a browser with no AudioContext at all, and one whose constructor throws.
      resetAll()
      if (w) { w.AudioContext = undefined; w.webkitAudioContext = undefined }
      audioBoot()
      ok(unavailable === true && AUD.mode === 'off', 'a missing AudioContext did not degrade to off')
      feel('tap.extend')
      ok(ctx === null, 'feel() built a context after the platform was declared unavailable')
      resetAll()
      var startsBefore = counter.starts
      if (w) w.AudioContext = function () { throw new Error('blocked') }
      audioBoot()
      ok(ctx === null && AUD.mode === 'off', 'a throwing AudioContext was not caught')
      feel('project.complete')
      ok(ctx === null && counter.starts === startsBefore, 'feel() played into a dead context')

      // 21 · micro-feedback: the roll-up, the ripple, the meter latch and the reveal pulse all
      // run against an element, and none of them may throw when there is no document at all.
      var el = fakeEl()
      writeNum(el, 1234, 0.4)
      ok(elText(el).indexOf('1.23') === 0, 'writeNum did not render the scannable part first')
      ok(elText(el).indexOf(' k') > 0, 'writeNum lost the suffix')
      ok(el.__fxDim === undefined || el.__fxDim.textContent.length > 0,
        'writeNum earned no moving digits on a slow accrual')
      var lastWritten = el.__fxLast
      writeNum(el, 1234, 0.4)
      ok(el.__fxLast === lastWritten, 'writeNum rewrote an unchanged string')
      writeNum(el, 0, 0)
      ok(elText(el).indexOf('0.00') === 0, 'writeNum cannot render zero')

      meterLatch = {}
      meterSet(el, 0.5, 'probe')
      ok(el.attrs['data-hot'] === undefined, 'a half-full meter is already brightening')
      meterSet(el, 0.95, 'probe')
      ok(el.attrs['data-hot'] === '1', 'the meter did not brighten as it approached full')
      meterSet(el, 1.0, 'probe')
      ok(meterLatch.probe === true, 'the meter arrival did not latch')
      meterSet(el, 1.0, 'probe')
      ok(meterLatch.probe === true, 'the latch was released by a second full reading')
      meterSet(el, 0.5, 'probe')
      ok(meterLatch.probe === false, 'the latch did not clear below 0.88')
      ok(el.style.props['--v'] === '0.5', 'the meter fill is not driven by --v')

      ok(ripple(null) === false, 'ripple(null) did not decline')
      ripple(el, { clientX: 10, clientY: 4 }, 1)
      ok(el.attrs['data-fx'] === '1', 'the ripple never started')
      ok(el.style.props['--rx'] === '10px', 'the ripple did not take the pointer origin')
      ok(parseFloat(el.style.props['--s']) > 0, 'the ripple has no scale target')
      ok(el.style.props['--ro'] === '0', 'the ripple does not fade out')

      resetGov()
      ok(reveal(null) === false, 'reveal(null) did not decline the element half')
      // IntersectionObserver accepts only a real Element, so the DOM half of
      // reveal() has to be exercised against one wherever a document exists.
      ok(reveal(doc() ? doc().createElement('div') : fakeEl()) === true,
        'reveal did not run against an element')

      // 22 · the surface itself.
      var api = ['feel', 'audioBoot', 'bedParams', 'suspendAll', 'resumeAll']
      for (i = 0; i < api.length; i++) ok(typeof HY.feel[api[i]] === 'function', 'surface: ' + api[i] + ' is missing')
    } catch (err) {
      f.push('threw: ' + (err && err.stack ? err.stack : err))
    }

    forceSync = false
    resetAll()
    AUD.mode = savedMode
    if (w) {
      if (realAC === undefined) delete w.AudioContext; else w.AudioContext = realAC
      if (realWK === undefined) delete w.webkitAudioContext; else w.webkitAudioContext = realWK
      if (realRAF === undefined) delete w.requestAnimationFrame; else w.requestAnimationFrame = realRAF
    }
    if (restoreVibrate) {
      if (realVib === undefined) { try { delete navigator.vibrate } catch (e) { navigator.vibrate = undefined } }
      else navigator.vibrate = realVib
    }
    visibleAt = -Infinity
    return f
  }

  function resetGov () { lastFired = {}; coalesce = {}; onsets = []; warnLatch = {} }

  // A stand-in for a pressable. Real enough for every write the micro-feedback layer makes, and
  // available in a harness that has no DOM at all.
  function fakeEl () {
    return {
      attrs: {},
      style: { props: {}, setProperty: function (k, v) { this.props[k] = v } },
      classList: { add: function () {}, contains: function () { return false } },
      querySelector: function () { return null },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: 120, height: 44 } },
      setAttribute: function (k, v) { this.attrs[k] = v },
      removeAttribute: function (k) { delete this.attrs[k] },
      addEventListener: function () {},
      appendChild: function () {},
      textContent: ''
    }
  }

  function elText (el) {
    if (el.__fxMain) return el.__fxMain.textContent + el.__fxDim.textContent + el.__fxSuf.textContent
    return el.textContent
  }

  // ───────────────────────────────────────────────────────────────────────────

  // The gesture listener is installed at load rather than at init(), because the context must be
  // created inside the *first* pointerdown and there is no guarantee anything calls init() before
  // the player touches the screen. Everything it binds is idempotent and passive.
  attach()

  HY.feel = {
    // BIBLE §6 M18
    feel: feel,
    audioBoot: audioBoot,
    bedParams: bedParams,
    suspendAll: suspendAll,
    resumeAll: resumeAll,

    // §6's generic module surface
    init: init,
    tick: tick,

    // settings (07 §11.1) and the one-time offer
    setMode: setMode,
    setHaptics: setHaptics,
    acceptOffer: acceptOffer,
    get mode () { return mode() },
    get available () { return !unavailable },
    get hapticsAvailable () { return canVibrate() || canSwitchHaptic() },

    // the score for act transitions and endings (07 §6)
    score: score,
    skipScore: skipScore,
    setAct: setActPalette,
    arrive: arrive,
    clearWarn: clearWarn,

    // micro-feedback (07 §8)
    displayPrecision: displayPrecision,
    numParts: numParts,
    lerpDisplay: lerpDisplay,
    writeNum: writeNum,
    ripple: ripple,
    meterSet: meterSet,
    reveal: reveal,
    turgor: turgor,
    haptic: haptic,
    hapticAt: hapticAt,
    hapticCancel: hapticCancel,

    AUD: AUD,
    get ready () { return ready },
    get voices () { return voices.length },
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
