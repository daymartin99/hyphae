;(function (HY) {
  'use strict'

  // M17 · canvas.js — every drawn thing (BIBLE §6 M17, 06 §7).
  //
  // There are no images in HYPHAE. Four geometries, never reused across acts: Act I is a thread,
  // Act II is a hex map, Act III is a radial chart and then a phase wheel.
  //
  // The whole surface rests on one observation from 06 §7.1: the mycelial network is monotone.
  // Hyphae are never removed, so the structural layer is append-only and each redraw strokes only
  // the segments created since the last one. A network of 3,600 segments costs the same per frame
  // as one of 12. Everything transient lives on a second canvas that is cleared every draw and is
  // bounded by construction.
  //
  // The network model (grow / regenerate) is deliberately free of any DOM reference so it can be
  // exercised headlessly and so a resize is a re-derivation rather than a bitmap scale.

  function C () { return HY.core }
  function S () { return HY.state && HY.state.state }
  function doc () { return typeof document !== 'undefined' ? document : null }
  function nowMs () {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE MODULE'S DATA TABLES
  //
  // These are pixels, curves and milliseconds, which BIBLE §1's precedence order hands to
  // 06-ui-visual-language.md, and which live in no other module. Everything the simulation can
  // observe (rates, seasons, thresholds) is read from HY.core.TUNE instead.
  // ───────────────────────────────────────────────────────────────────────────

  var GROW = {
    // 06 §7.2, logical px, tuned for a 360 × 296 plate.
    SEG: 4.2,               // segment length at maturity
    SEG_BOOT: 9.0,          // segment length for the first nodes: one visible stroke at cold boot
    SEG_LERP_A: 40,         // node index at which SEG begins lerping 9 → 4.2
    SEG_LERP_B: 120,        // node index at which the lerp completes
    D_INF: 30,              // influence radius: an attractor pulls frontier nodes within this
    D_KILL: 6.5,            // kill radius: an attractor this close to any node is consumed
    JITTER: 0.14,           // radians, seeded, applied to each new segment's heading
    FRONTIER: 400,          // max nodes eligible to grow (the most recently created)
    NEW_MAX: 24,            // max nodes appended per growth call
    PULL_MAX: 3,            // × NEW_MAX: the work cap on the accumulate pass
    BUCKET: 12,             // max nodes indexed per spatial-hash cell
    CAP: 4000,              // typed-array capacity (06 §7.8: 4,000 × 14 B = 56 KB)
    A0_DIV: 220,            // px² of plate per initial attractor
    A0_MIN: 500,
    A0_MAX: 1800,
    REPLENISH_AT: 0.25,     // × A0: pool size below which the R2 sequence is resumed
    REPLENISH_ADD: 0.50,    // × A0: attractors added per replenish
    // An attractor the frontier has walked past can sit forever just outside D_INF of anything
    // that may still grow, holding the pool nominally full and starving replenishment. Culling it
    // after this many fruitless steps keeps the live pool concentrated where growth is happening;
    // the R2 sequence is infinite and resumable, so what is culled is immediately replaced.
    STALE_STEPS: 600,
    PLASTIC: 1.324717957244746,       // the plastic number, ρ; A1 = 1/ρ, A2 = 1/ρ²
    R2_BIAS: 0.72,          // v^this: biases attractor density up and out from the inoculation
    SEED_INSET: 4,          // px above the plate floor for the single seed node
    SEG_PER_M: 2,           // 06 §7.3: targetN = floor(hyphae · 2)
    MIN_TARGET: 2           // 06 §7.3 cold-boot override: one visible stroke from the first tap
  }

  var DRAW = {
    WIDTHS: [1.15, 0.85, 0.58],  // line width per generation bucket: thick at the origin
    GEN_B0: 6, GEN_B1: 16,       // generation bucket boundaries
    ALPHA: 0.35,                 // structural stroke alpha, dark theme
    ALPHA_LIGHT: 0.42,
    ALPHA_CONTRAST: 0.55,
    PALETTE_MS: 1000             // ms between token re-reads; a theme flip forces one immediately
  }

  var FLUX = {
    TIP_N: 60,               // trailing nodes that carry a tip glow
    TIP_R: 1.6,              // px
    TIP_A: 0.10, TIP_AMP: 0.10, TIP_PERIOD: 6, TIP_SPREAD: 0.7,
    TIP_STARVE_A: 0.04,      // alpha when throughput is zero; the colour drops to tertiary text
    TIP_STATIC_A: 0.15,      // the mean of the breath, held still under reduced motion
    PULSE_U: 0.22,           // path fraction per second
    PULSE_DOT: 2, PULSE_TRAIL: 5, PULSE_A: 0.7, PULSE_TRAIL_A: 0.2,
    PULSE_PATH_MIN: 10,      // nodes: shorter chains are not worth travelling
    PULSE_SPAWN_S: 1.4,      // s between pulse spawns while the book is live
    FB_MAX: 3,               // fruiting bodies
    FB_CAP_R: 7, FB_STIPE_W: 2, FB_STIPE_H: 9, FB_A: 0.55,
    HAZ_MAX: 2,
    HAZ_R: 3, HAZ_A: 0.4, HAZ_AMP: 0.2, HAZ_PERIOD: 1.5,
    // Under reduced motion the flux layer is redrawn on a state change rather than a clock. A
    // pending structural batch this large, or a season boundary, is a state change; a sine is not.
    REDUCED_BATCH: 240,
    REDUCED_FLUSH_S: 8,      // s: content appearing at 0.125 Hz is not motion, and 06 §7's
                             // season-only cadence would leave a cold-boot player looking at two
                             // pixels for six minutes, which is the one thing worse than motion.

    // THE RELEASE (01 §3.2, 07 §8.2). The hold builds pressure in the button and this is where the
    // pressure goes. One EXTEND is 0.020 m of thread, which is one twenty-fifth of a segment — the
    // structural layer cannot answer a single press and never could, so the answer is drawn on the
    // flux layer instead: the leading tips advance along their own headings, further for a fuller
    // charge, and the push then dissolves rather than snapping back. A hypha does not retract, so
    // what decays here is the probe's ink and never its length.
    SURGE_N: 24,             // leading tips the release pushes. The rest of the front does not move
    SURGE_PX: 3.2,           // px a release with no hold advances the front — a tap still goes
    SURGE_SPAN: 9.4,         // px more at full pressure, so a ripe hold travels near four times it
    SURGE_RISE: 150,         // ms of travel: the wall gives, the tip goes, it slows
    SURGE_FALL: 520,         // ms over which the probe's ink hands its length back to the mat
    SURGE_A: 0.55,           // probe alpha at full push — brighter than the mat, because it is new
    SURGE_HEAD: 0.62,        // × that, for the head: the thread it laid is the louder half of this
    SURGE_HZ: 30             // Hz a live surge borrows: 8 Hz draws a 150 ms push in one frame
  }

  var MAP = {
    RINGS: 4,                // axial radius: 1 + 6 + 12 + 18 + 24 = 61 regions
    PAD: 6,                  // px inset
    NET_ALPHA: 0.12,         // the Act I network persists behind the map at this alpha
    TERRAIN_A: [0.34, 0.16, 0.26, 0.10, 0.44, 0.06],   // Loam Sand Clay Scree Peat Burn
    STROKE_A: [0.20, 0.34, 0.72, 0.52],  // undiscovered, discovered, claimed, advancing
    BARRIER_INSET: 2.5, BARRIER_W: 2, BARRIER_DASH: [3, 2],
    RIVAL_R: 2.2, RIVAL_A: 0.75,
    DRAIN_W: 3,              // px: wide enough to take a region's own 1.5 px outline with its face
    DOT_R: 1.1               // the undiscovered marker
  }

  var VOID = {
    SIZE: 260,               // px, the Act III plate
    R0: 22,                  // px, radius of band 0
    STEP: 8.6,               // px per band: 13 bands inside 260 px with room for the stroke
    W_MIN: 1.0,              // px, arc width at an empty band
    W_MAX: 6.0,              // px: STEP − this leaves 2.6 px of sky between two saturated bands
    W_K: 2.4,                // px per decade of n/NCAP
    TRACK_W: 1,              // px, the unexplored remainder: a track, not a reading
    GAP_A: 0.16,             // alpha of that track
    START: -Math.PI / 2      // arcs open at twelve o'clock
  }

  var WHEEL = {
    R: 96,                   // px
    DOT_R: 3.0, DOT_R_MAX: 6.5,
    RING_AT: 0.80,           // the ϒ threshold ENDING A asks for
    RING_DASH: [3, 3],
    RESULT_W: 2
  }

  var FORECAST = {
    H: 44,                   // px, the strip height
    SAMPLES: 120,            // Float32Array ring: 120 samples at 1 Hz
    AMP: 38,                 // px of vertical travel
    STROKE_W: 1.5,
    FORE_A: 0.55,
    FORE_DASH: [4, 3],       // "predicted" is dashed, never hue alone
    MARK_W: 2, MARK_TRI: 6,
    // 02 §7.3's remaining primitives. The envelope is the widest thing on the strip so it is the
    // faintest; the two danger thresholds are dashed as well as coloured; the graze cycle rides
    // along the floor where it cannot be confused with moisture.
    BAND_A: 0.17,
    DANGER_A: 0.42,
    DANGER_DASH: [2, 4],
    GRAZE_H: 9, GRAZE_A: 0.22,
    HZ: 1
  }

  // The act transitions and the endings (09 §4, §5). Every number a sequence states travels in its
  // own payload; these are the ones 09 leaves to the drawing, and 06 §7 is where a millisecond that
  // belongs to the picture lives.
  var MOTION = {
    BINS: 6,                 // alpha buckets the conduction wave sorts its segments into
    BAND_W: 0.17,            // body-lengths: half-width of the travelling luminance band
    WAVE_BASE: 0.12,         // alpha the whole network holds between crests, × the envelope
    PASSES: 8,               // 01 §11.4's root-to-tip traversals, when the payload omits them
    PEAK: 0.55,              // 01 §11.4's peak alpha. Never full white, never inverting.
    WAVE_HZ: 0.18,           // 01 §11.4's envelope
    REDRAW_HZ: 8,            // 09 §4.1: "the drawn network is redrawn 8×/s"
    WAVE_MS: 3600,           // 09 §4.1's own clock: the wave leaves at 0.40 and the cut is at 4.00
    DRAIN_MS: 700,           // ms per ring of the ASCOSPORE map drain
    HOLD_MS: 1200,
    LIFT_MS: 1600,
    LIFT_STAGGER_MS: 400,
    LIFT_RISE: [4, 40],      // px, seeded per region
    VOID_MS: 1200,           // 09 §4.3 gives ESCAPE's beat but not the ramp; this is the ramp
    CONVERGE_MS: 1400,
    COLLAPSE_MS: 2400,
    COLLAPSE_AT: 0.35,       // fraction of ENDING B spent converging before the dot grows
    WHITE_MS: 2600,
    WHITE_HOLD_MS: 6000,
    DOT_R: 3.2,
    CROSSFADE_MS: 900
  }

  // 06 §7.8. MED is BIBLE §6 M17's spelling of 06's MID; both are accepted by setTier.
  var TIERS = {
    HIGH:  { dpr: 2, fluxHz: 8, segCap: 3600, pulses: 24 },
    MED:   { dpr: 2, fluxHz: 4, segCap: 2400, pulses: 12 },
    LOW:   { dpr: 1, fluxHz: 2, segCap: 1000, pulses: 4 },
    FLOOR: { dpr: 1, fluxHz: 0, segCap: 600,  pulses: 0 }
  }
  var TIER_ORDER = ['FLOOR', 'LOW', 'MED', 'HIGH']

  var PERF = {
    WARMUP: 90,              // frames of warmup before any automatic demotion
    WIN: 180,                // frames in the rolling p95 window
    RECOMPUTE: 30,           // frames between p95 recomputations
    HIGH_P95: 12, HIGH_CORES: 6,
    LOW_P95: 22, FLOOR_P95: 30,
    HOLD_S: 3,               // s a bad p95 must persist before demoting
    MEM_FLOOR_GB: 2,
    PROMOTE_S: 60,           // promotion is allowed at most this often…
    AFTER_DEMOTE_S: 10,      // …and never this soon after a demotion
    FRAME_MAX_MS: 100,       // samples above this are a tab wake, not a slow frame
    FRAME_60_MS: 16.7        // one frame at 60 Hz; the warmup's fallback clock
  }

  var BUDGET = {
    GROW_MS: 2.0,            // ms, one full grow() step, worst case
    FRAME_MS: 8.0,           // ms, the longest this module may ever hold the main thread
    DRAW_MS: 0.95,           // ms, the design cost of a frame's drawing at HIGH (BIBLE §6 M17)
    OWN_P95_MS: 3.0,         // ms, three times the design cost: past here the canvas is the
                             // reason frames are being dropped, and it degrades itself
    OWN_WIN: 60              // draw-cost samples in the rolling window
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE NETWORK MODEL — seeded space colonisation with a bounded frontier (06 §7.2)
  //
  // Pure function of (seed, n, W, H). No DOM, no clock, no Math.random.
  // ───────────────────────────────────────────────────────────────────────────

  var net = null

  function newNet (seed, W, H) {
    var A0 = clampI(Math.round(W * H / GROW.A0_DIV), GROW.A0_MIN, GROW.A0_MAX)
    var CELL = GROW.D_INF
    var GW = Math.max(1, Math.ceil(W / CELL))
    var GH = Math.max(1, Math.ceil(H / CELL))
    var n = {
      seed: seed >>> 0,
      W: W, H: H, A0: A0, CELL: CELL, GW: GW, GH: GH,
      x: new Float32Array(GROW.CAP),
      y: new Float32Array(GROW.CAP),
      par: new Int32Array(GROW.CAP),
      gen: new Uint8Array(GROW.CAP),
      fslot: new Int32Array(GROW.CAP),     // frontier slot, or −1 once evicted
      n: 0, drawn: 0, steps: 0,
      frontier: new Int32Array(GROW.FRONTIER),
      fCount: 0, fHead: 0,
      accX: new Float32Array(GROW.FRONTIER),
      accY: new Float32Array(GROW.FRONTIER),
      accN: new Uint8Array(GROW.FRONTIER),
      // Attractors are kept compact — live in [0, aCount) — and removed by swapping the last one
      // down. An `alive` flag would cost a branch per attractor per step for the same information.
      ax: new Float32Array(GROW.A0_MAX),
      ay: new Float32Array(GROW.A0_MAX),
      aMiss: new Uint16Array(GROW.A0_MAX),
      aCount: 0, aNext: 0,
      cell: new Int32Array(GW * GH * GROW.BUCKET),
      cellN: new Uint8Array(GW * GH),
      cellW: new Uint8Array(GW * GH)       // ring cursor: each cell indexes its most recent nodes
    }
    appendNode(n, W / 2, H - GROW.SEED_INSET, -1, 0)
    spawnAttractors(n, A0)
    return n
  }

  function clampI (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }

  // 06 §7.2: a cheap integer hash so the network is a pure function of (seed, n).
  function hash01 (seed, i) {
    var x = (seed ^ Math.imul(i | 0, 2654435761)) >>> 0
    x ^= x << 13; x >>>= 0
    x ^= x >>> 17
    x ^= x << 5; x >>>= 0
    return x / 4294967296
  }

  // R2 low-discrepancy sequence: deterministic, uniform without clumping, and resumable — which is
  // what lets the pool be replenished forever from a single integer cursor.
  function spawnAttractors (o, k) {
    var A1 = 1 / GROW.PLASTIC
    var A2 = A1 / GROW.PLASTIC
    var off = o.seed & 0xFFF
    for (var j = 0; j < k && o.aCount < GROW.A0_MAX; j++) {
      var i = o.aNext++
      var kk = i + off
      var u = (0.5 + A1 * kk) % 1
      var v = (0.5 + A2 * kk) % 1
      o.ax[o.aCount] = u * o.W
      // ^0.72 biases density toward the top of the plate, so the colony spreads up and out from an
      // inoculation point at bottom-centre — what a real mycelium looks like seen as a slice.
      o.ay[o.aCount] = o.H - Math.pow(v, GROW.R2_BIAS) * o.H
      o.aMiss[o.aCount] = 0
      o.aCount++
    }
  }

  function killAttractor (o, a) {
    var last = o.aCount - 1
    o.ax[a] = o.ax[last]; o.ay[a] = o.ay[last]; o.aMiss[a] = o.aMiss[last]
    o.aCount = last
  }

  function cellIndex (o, px, py) {
    var gx = (px / o.CELL) | 0
    var gy = (py / o.CELL) | 0
    if (gx < 0) gx = 0; else if (gx >= o.GW) gx = o.GW - 1
    if (gy < 0) gy = 0; else if (gy >= o.GH) gy = o.GH - 1
    return gy * o.GW + gx
  }

  function appendNode (o, px, py, parent, g) {
    if (o.n >= GROW.CAP) return -1
    var i = o.n
    o.x[i] = px; o.y[i] = py; o.par[i] = parent; o.gen[i] = g

    // The index is a per-cell ring of the most recent BUCKET nodes. Overflow is dropped from the
    // index, never from the network (06 §7.2) — and dropping the *oldest* is what keeps the query
    // useful, because the only nodes it ever wants are the ones that can still grow.
    var c = cellIndex(o, px, py)
    var w = o.cellW[c]
    o.cell[c * GROW.BUCKET + w] = i
    o.cellW[c] = (w + 1) % GROW.BUCKET
    if (o.cellN[c] < GROW.BUCKET) o.cellN[c]++

    // Frontier ring: push, evicting the oldest. Evicted nodes can never grow again, which is
    // exactly right — old hyphae do not branch, tips do.
    var f = o.fHead
    if (o.fCount === GROW.FRONTIER) {
      var old = o.frontier[f]
      if (old >= 0) o.fslot[old] = -1
    } else {
      o.fCount++
    }
    o.frontier[f] = i
    o.fslot[i] = f
    o.accX[f] = 0; o.accY[f] = 0; o.accN[f] = 0
    o.fHead = (f + 1) % GROW.FRONTIER

    o.n = i + 1
    return i
  }

  // 06 §7.3: the first thread is a single visible stroke that lengthens by a pixel or two every
  // few taps; SEG lerps 9 → 4.2 across nodes 40–120 as the colony becomes a colony.
  function segLen (i) {
    if (i <= GROW.SEG_LERP_A) return GROW.SEG_BOOT
    if (i >= GROW.SEG_LERP_B) return GROW.SEG
    var u = (i - GROW.SEG_LERP_A) / (GROW.SEG_LERP_B - GROW.SEG_LERP_A)
    return GROW.SEG_BOOT + (GROW.SEG - GROW.SEG_BOOT) * u
  }

  // Nearest indexed node, and separately the nearest node still on the frontier. The first decides
  // whether the attractor has been consumed; the second decides where it pulls. Splitting them
  // matters: an attractor swallowed by mature tissue must die even though nothing there can grow.
  //
  // Distances are compared squared and rooted twice at the end. This is called once per live
  // attractor per growth step — up to 1,800 times — and the two square roots it avoids are the
  // difference between the step fitting in its budget and not.
  var _bAny = -1, _bAnyD = 0, _bFront = -1, _bFrontD = 0

  function nearest (o, px, py) {
    _bAny = -1; var bestAny = Infinity
    _bFront = -1; var bestFront = Infinity
    var gx0 = (px / o.CELL) | 0
    var gy0 = (py / o.CELL) | 0
    var gy1 = gy0 + 1, gx1 = gx0 + 1
    for (var gy = gy0 - 1; gy <= gy1; gy++) {
      if (gy < 0 || gy >= o.GH) continue
      var row = gy * o.GW
      for (var gx = gx0 - 1; gx <= gx1; gx++) {
        if (gx < 0 || gx >= o.GW) continue
        var c = row + gx
        var cn = o.cellN[c]
        var base = c * GROW.BUCKET
        for (var k = 0; k < cn; k++) {
          var i = o.cell[base + k]
          var dx = px - o.x[i], dy = py - o.y[i]
          var d2 = dx * dx + dy * dy
          if (d2 < bestAny) { bestAny = d2; _bAny = i }
          if (d2 < bestFront && o.fslot[i] >= 0) { bestFront = d2; _bFront = i }
        }
      }
    }
    _bAnyD = _bAny < 0 ? Infinity : Math.sqrt(bestAny)
    _bFrontD = _bFront < 0 ? Infinity : Math.sqrt(bestFront)
  }

  // One growth step (06 §7.2). O(attractors × frontier-cells), never O(nodes).
  function grow (o) {
    var added = 0, pulled = 0
    var pullCap = GROW.NEW_MAX * GROW.PULL_MAX
    var a = 0

    // 1 · accumulate: each live attractor pulls its nearest frontier node.
    while (a < o.aCount && pulled < pullCap) {
      nearest(o, o.ax[a], o.ay[a])
      if (_bAny >= 0 && _bAnyD < GROW.D_KILL) { killAttractor(o, a); continue }
      if (_bFront >= 0 && _bFrontD <= GROW.D_INF && _bFrontD > 0) {
        var f = o.fslot[_bFront]
        o.accX[f] += (o.ax[a] - o.x[_bFront]) / _bFrontD
        o.accY[f] += (o.ay[a] - o.y[_bFront]) / _bFrontD
        if (o.accN[f] < 255) o.accN[f]++
        o.aMiss[a] = 0
        pulled++
      } else if (++o.aMiss[a] > GROW.STALE_STEPS) {
        killAttractor(o, a); continue
      }
      a++
    }

    // 2 · spawn. appendNode clears the accumulator of any slot it recycles, so a frontier slot
    // evicted inside this loop is simply skipped when the loop reaches it.
    for (var s = 0; s < o.fCount && added < GROW.NEW_MAX; s++) {
      if (!o.accN[s]) continue
      var i = o.frontier[s]
      var dx = o.accX[s], dy = o.accY[s]
      o.accX[s] = 0; o.accY[s] = 0; o.accN[s] = 0
      var m = Math.sqrt(dx * dx + dy * dy)
      if (!(m > 0)) continue
      dx /= m; dy /= m
      var th = Math.atan2(dy, dx) + (hash01(o.seed, o.n) * 2 - 1) * GROW.JITTER
      var L = segLen(o.n)
      var nx = o.x[i] + Math.cos(th) * L
      var ny = o.y[i] + Math.sin(th) * L
      if (appendNode(o, nx, ny, i, o.gen[i] < 255 ? o.gen[i] + 1 : 255) < 0) break
      added++
    }

    // 3 · replenish.
    if (o.aCount < o.A0 * GROW.REPLENISH_AT) spawnAttractors(o, Math.round(o.A0 * GROW.REPLENISH_ADD))
    o.steps++
    return added
  }

  // The save stores (seed, n) and nothing else: 8 bytes instead of 60 KB. Replaying grow() from an
  // empty net reproduces the network exactly, because grow() reads no clock and no PRNG state.
  function regenerate (seed, W, H, want, budgetMs) {
    var o = newNet(seed, W, H)
    var deadline = budgetMs > 0 ? nowMs() + budgetMs : 0
    var guard = 0
    while (o.n < want && guard++ < GROW.CAP) {
      if (grow(o) === 0 && o.aCount === 0) break
      if (deadline && (guard & 15) === 0 && nowMs() > deadline) break
    }
    return o
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SURFACES
  // ───────────────────────────────────────────────────────────────────────────

  var surf = {
    netEl: null, netCtx: null,
    fluxEl: null, fluxCtx: null,
    wheelEl: null, wheelCtx: null,
    foreEl: null, foreCtx: null,
    W: 360, H: 296,          // logical px of the plate
    dpr: 1,
    attached: false
  }

  var tier = 'MED'
  var manualTier = false
  var reduced = false
  var lightTheme = false
  var contrast = false

  // The stylesheet is the only authority on colour; these are the resolved dark primitives of
  // 06 §2.2 and exist purely so a headless or pre-first-paint call has something finite to write.
  // Every real draw calls refreshPalette() first, and the first such call always re-reads.
  var pal = { at: 0, hyphae: [232, 225, 211], bg: [7, 9, 6], signal: [98, 195, 154],
              tertiary: [122, 131, 113], spore: [239, 235, 221], negative: [162, 75, 50],
              attention: [217, 154, 43], line: [44, 51, 41], lineStrong: [58, 66, 54],
              surface1: [21, 25, 20], surface2: [27, 32, 26], text: [232, 225, 211] }

  function rgba (c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')' }

  function parseColor (str, fallback) {
    if (!str) return fallback
    var s = ('' + str).trim()
    if (s.charAt(0) === '#') {
      if (s.length === 4) {
        return [parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16), parseInt(s[3] + s[3], 16)]
      }
      if (s.length >= 7) {
        return [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)]
      }
      return fallback
    }
    var m = s.match(/(-?\d*\.?\d+)/g)
    if (m && m.length >= 3) return [Math.round(+m[0]), Math.round(+m[1]), Math.round(+m[2])]
    return fallback
  }

  function refreshPalette (force) {
    var d = doc()
    if (!d || !d.documentElement || typeof getComputedStyle !== 'function') return
    var t = nowMs()
    if (!force && t - pal.at < DRAW.PALETTE_MS) return
    pal.at = t
    var cs = getComputedStyle(d.documentElement)
    function tok (name, fb) { return parseColor(cs.getPropertyValue(name), fb) }
    pal.hyphae = tok('--hyphae-stroke', pal.hyphae)
    pal.bg = tok('--canvas-bg', pal.bg)
    pal.signal = tok('--signal', pal.signal)
    pal.tertiary = tok('--text-tertiary', pal.tertiary)
    pal.spore = tok('--spore-000', pal.spore)
    pal.negative = tok('--negative', pal.negative)
    pal.attention = tok('--attention', pal.attention)
    pal.line = tok('--line', pal.line)
    pal.lineStrong = tok('--line-strong', pal.lineStrong)
    pal.surface1 = tok('--surface-1', pal.surface1)
    pal.surface2 = tok('--surface-2', pal.surface2)
    pal.text = tok('--text-primary', pal.text)
    // Luminance of the canvas background is a more reliable theme probe than the media query,
    // because the player may have forced a theme in settings.
    lightTheme = (pal.bg[0] * 0.2126 + pal.bg[1] * 0.7152 + pal.bg[2] * 0.0722) > 128
  }

  function mq (q) {
    return typeof matchMedia === 'function' ? matchMedia(q) : null
  }

  function readMotion () {
    var s = S()
    if (s && s.set && s.set.reduceMotion !== null && s.set.reduceMotion !== undefined) {
      reduced = !!s.set.reduceMotion
      return
    }
    var m = mq('(prefers-reduced-motion: reduce)')
    reduced = !!(m && m.matches)
  }

  function strokeAlpha () {
    if (contrast) return DRAW.ALPHA_CONTRAST
    return lightTheme ? DRAW.ALPHA_LIGHT : DRAW.ALPHA
  }

  function T () { return TIERS[tier] || TIERS.MED }

  // ───────────────────────────────────────────────────────────────────────────
  // ATTACH / SIZE
  // ───────────────────────────────────────────────────────────────────────────

  function ctxOf (el) {
    if (!el || typeof el.getContext !== 'function') return null
    try { return el.getContext('2d') } catch (e) { return null }
  }

  function init () { attach(); return surf.attached }

  // The wheel and the forecast strip are revealed mid-act, long after the plate exists, so they
  // are looked up again on every attach and lazily by their own draw calls rather than once.
  function refreshOptional (d) {
    var w = d.getElementById('wheel')
    if (w !== surf.wheelEl) { surf.wheelEl = w; surf.wheelCtx = ctxOf(w) }
    var f = d.getElementById('forecast')
    if (f !== surf.foreEl) { surf.foreEl = f; surf.foreCtx = ctxOf(f) }
  }

  function attach () {
    var d = doc()
    if (!d) return false
    var netEl = d.getElementById('net')
    var fluxEl = d.getElementById('flux')
    if (!netEl || !fluxEl) return false
    if (surf.netEl === netEl && surf.fluxEl === fluxEl && surf.attached) {
      refreshOptional(d)
      resize()
      return true
    }

    surf.netEl = netEl; surf.netCtx = ctxOf(netEl)
    surf.fluxEl = fluxEl; surf.fluxCtx = ctxOf(fluxEl)
    refreshOptional(d)
    surf.attached = !!(surf.netCtx && surf.fluxCtx)

    if (!attach.bound) {
      attach.bound = true
      // ui.js dispatches this from its own sizeCanvas, after it has written width/height, so the
      // tier's dpr can override its unconditional min(dpr, 2).
      d.addEventListener('hyphae:resize', function () { resize() }, true)
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', debounced, false)
        window.addEventListener('orientationchange', debounced, false)
      }
      var m1 = mq('(prefers-reduced-motion: reduce)')
      var m2 = mq('(prefers-contrast: more)')
      var m3 = mq('(prefers-color-scheme: light)')
      bindMQ(m1, function () { readMotion(); invalidate() })
      bindMQ(m2, function () { contrast = !!(m2 && m2.matches); invalidate() })
      bindMQ(m3, function () { refreshPalette(true); invalidate() })
      contrast = !!(m2 && m2.matches)
      if (typeof MutationObserver === 'function') {
        // ui.js writes data-theme, data-act and data-motion on <html> when the player changes a
        // setting. All three move what this module draws and none of them fires a media query, so
        // the OS-level listeners above are not enough on their own.
        new MutationObserver(function () {
          readMotion(); refreshPalette(true); invalidate()
        }).observe(d.documentElement,
          { attributes: true, attributeFilter: ['data-theme', 'data-act', 'data-motion'] })
      }
      d.addEventListener('visibilitychange', function () {
        if (!d.hidden) { lastFlux = 0; frames.n = 0 }
      }, false)
    }

    readMotion()
    refreshPalette(true)
    resize()
    return surf.attached
  }

  function bindMQ (m, fn) {
    if (!m) return
    if (m.addEventListener) m.addEventListener('change', fn)
    else if (m.addListener) m.addListener(fn)
  }

  var resizeTimer = 0
  function debounced () {
    if (typeof window === 'undefined') return
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(function () { resizeTimer = 0; resize() }, 250)
  }

  function backingSize (el, dpr) {
    var w = el.clientWidth || surf.W
    var h = el.clientHeight || surf.H
    if (!(w > 0 && h > 0)) return null
    return { w: w, h: h, bw: Math.round(w * dpr), bh: Math.round(h * dpr) }
  }

  function sizeOne (el, ctx, dpr) {
    if (!el || !ctx) return
    var s = backingSize(el, dpr)
    if (!s) return
    if (el.width !== s.bw || el.height !== s.bh) { el.width = s.bw; el.height = s.bh }
    // The transform is re-applied unconditionally: assigning width resets it, and ui.js may have
    // sized the element itself with a different dpr on the frame before this one.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // Scaling a bitmap of hairlines looks terrible; regenerating from (seed, n) looks perfect and is
  // a function we already have (06 §7.6). 40 ms, once, debounced.
  function resize () {
    if (!surf.attached) return
    var dprMax = T().dpr
    var dev = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
    surf.dpr = Math.min(dev, dprMax)
    var s = backingSize(surf.netEl, surf.dpr)
    if (!s) return
    var geomChanged = (s.w !== surf.W || s.h !== surf.H)
    sizeOne(surf.netEl, surf.netCtx, surf.dpr)
    sizeOne(surf.fluxEl, surf.fluxCtx, surf.dpr)
    if (surf.wheelEl) sizeOne(surf.wheelEl, surf.wheelCtx, surf.dpr)
    if (surf.foreEl) sizeOne(surf.foreEl, surf.foreCtx, surf.dpr)
    surf.W = s.w; surf.H = s.h

    if (!net) {
      net = newNet(seedOf(), surf.W, surf.H)
    } else if (geomChanged) {
      net = regenerate(net.seed, surf.W, surf.H, net.n, 40)
      paths.length = 0
      pulses.length = 0
      surge = null
      depthN = -1
    }
    mapDirty = true
    invalidate()
  }

  function seedOf () {
    var s = S()
    return (s && typeof s.seed === 'number' ? s.seed : 0x9E3779B9) >>> 0
  }

  function ensureNet () {
    var want = seedOf()
    if (!net) { net = newNet(want, surf.W, surf.H); return }
    if (net.seed !== want) {
      // A new run, an import or a New Growth: the network is a different network.
      net = newNet(want, surf.W, surf.H)
      paths.length = 0
      pulses.length = 0
      // A push in flight belonged to tips this network no longer has.
      surge = null
      // The conduction wave's root-to-tip distances belong to the network that was replaced.
      depthN = -1
      clearNet()
    }
  }

  function clearNet () {
    if (!surf.netCtx) return
    surf.netCtx.clearRect(0, 0, surf.W, surf.H)
    net.drawn = 0
  }

  // `repaint` is the one thing that suspends the append-only contract. It is set when the ink
  // itself has changed under the drawing — a theme flip, a contrast change, the Act III cold
  // shift, a resize — because those leave every already-stroked colour wrong, and nothing short of
  // restroking the buffer can fix a bitmap. It is never set by growth; growth is always additive.
  var repaint = true
  function invalidate () { repaint = true; lastFlux = 0 }

  // ───────────────────────────────────────────────────────────────────────────
  // GROWTH — driven by the game, not by the clock (06 §7.3)
  // ───────────────────────────────────────────────────────────────────────────

  function targetFor (hyphaeM) {
    var m = typeof hyphaeM === 'number' && hyphaeM === hyphaeM ? hyphaeM : 0
    var want = Math.floor(m * GROW.SEG_PER_M)
    if (want < GROW.MIN_TARGET) want = GROW.MIN_TARGET
    var cap = Math.min(T().segCap, GROW.CAP)
    return want > cap ? cap : want
  }

  function growNetwork (hyphaeM) {
    if (!net) { attach(); ensureNet() } else ensureNet()
    if (!net) return 0
    var want = targetFor(hyphaeM)
    if (net.n >= want) return 0

    // A sudden jump — a patch claim is 30 m and therefore 60 nodes, an offline return can be 800 —
    // is throttled into a visible growth event of about two and a half seconds rather than a jump.
    // Under reduced motion there is no event to watch, so the whole catch-up runs at once inside a
    // hard millisecond budget.
    var budget = reduced ? GROW.CAP : GROW.NEW_MAX
    var t0 = nowMs()
    var added = 0, guard = 0
    while (net.n < want && added < budget && guard++ < 64) {
      var k = grow(net)
      added += k
      if (k === 0 && net.aCount === 0) break
      if (k === 0 && guard > 3) break
      if (nowMs() - t0 > BUDGET.FRAME_MS) break
    }
    return added
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE STRUCTURAL LAYER (06 §7.4) — append-only; the buffer is never cleared
  // ───────────────────────────────────────────────────────────────────────────

  var lastSeasonKey = -1
  var lastFlushAt = 0

  function drawNet () {
    sampleFrame()
    if (!surf.attached && !attach()) return
    if (!net) { ensureNet(); if (!net) return }
    // In Act II the hex map owns this surface and restrokes the network itself, behind the hexes.
    // Appending here as well would draw every new segment twice, at twice the alpha.
    var st = S()
    if (st && st.act >= 2) return
    seasonWash()
    if (repaint) { clearNet(); repaint = false }
    if (net.drawn >= net.n) return

    if (reduced) {
      var pending = net.n - net.drawn
      var t = nowMs()
      if (pending < FLUX.REDUCED_BATCH && t - lastFlushAt < FLUX.REDUCED_FLUSH_S * 1000) return
      lastFlushAt = t
    }

    var t0 = nowMs()
    var ctx = surf.netCtx
    refreshPalette(false)
    ctx.save()
    ctx.strokeStyle = rgba(pal.hyphae, 1)
    ctx.globalAlpha = strokeAlpha()
    ctx.lineCap = 'round'
    // One path per line-width bucket: three strokes, regardless of batch size. Thicker near the
    // origin, finer at the tips — anatomically correct and the cheapest possible depth cue.
    for (var b = 0; b < 3; b++) {
      ctx.lineWidth = DRAW.WIDTHS[b]
      ctx.beginPath()
      var any = false
      for (var i = net.drawn; i < net.n; i++) {
        var p = net.par[i]
        if (p < 0) continue
        if (bucketOf(net.gen[i]) !== b) continue
        ctx.moveTo(net.x[p], net.y[p])
        ctx.lineTo(net.x[i], net.y[i])
        any = true
      }
      if (any) ctx.stroke()
    }
    ctx.restore()
    net.drawn = net.n
    own(nowMs() - t0)
  }

  function bucketOf (g) { return g < DRAW.GEN_B0 ? 0 : (g < DRAW.GEN_B1 ? 1 : 2) }

  // Because the buffer is never cleared, it is aged with a single wash at each season boundary.
  // Over sixteen seasons the oldest growth decays to 0.955^16 = 0.48 of its alpha while recent
  // growth is at full strength: the network visibly remembers when you grew.
  function ageWash () {
    if (!surf.netCtx) return
    var w = C() ? C().TUNE.UI.AGE_WASH : 0.045
    var ctx = surf.netCtx
    ctx.save()
    ctx.setTransform(surf.dpr, 0, 0, surf.dpr, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    refreshPalette(false)
    ctx.fillStyle = rgba(pal.bg, w)
    ctx.fillRect(0, 0, surf.W, surf.H)
    ctx.restore()
  }

  function seasonWash () {
    var s = S()
    if (!s || s.act !== 1 || !s.a1) return
    var key = (s.a1.year | 0) * 4 + (s.a1.season | 0)
    if (lastSeasonKey < 0) { lastSeasonKey = key; return }
    if (key === lastSeasonKey) return
    lastSeasonKey = key
    ageWash()
    // Deliberately no invalidate(): the wash *is* the accumulated history, and repainting the
    // buffer from the model would throw away every season the player has already lived through.
    lastFlux = 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE FLUX LAYER (06 §7.5) — cleared and redrawn; everything on it is bounded
  // ───────────────────────────────────────────────────────────────────────────

  var lastFlux = 0
  var lastStateKey = ''
  var pulses = []
  var paths = []
  var lastPulseSpawn = 0

  // ── THE RELEASE · the one moment this surface answers the hand ─────────────
  // `{ at, adv }` while a release is travelling, else null. A gesture's echo, never game state: it
  // is not saved, it does not survive a new run, and a reload mid-push is a push that did not
  // happen. The extension it draws is already recorded in `hyphaeManual`; this only makes the beat
  // visible on the frame the thumb lifts, which is the beat the network was missing.
  var surge = null
  // Scratch for the per-node heading, module-level because this runs SURGE_N times a frame at
  // 30 Hz and an array per node per frame is a collection pause per surge.
  var dir = [0, 0]

  function surgeRelease (p) {
    // Reduced motion drops the button's own swell for exactly this reason and this follows it: the
    // grams are banked either way, and 670 ms of travel is decoration. The FLOOR tier has no flux
    // clock at all, so it has nothing to draw a push on.
    if (reduced || T().fluxHz <= 0) return
    var f = typeof p === 'number' && p === p ? (p < 0 ? 0 : (p > 1 ? 1 : p)) : 0
    surge = { at: nowMs(), adv: FLUX.SURGE_PX + FLUX.SURGE_SPAN * f }
  }

  // The push at `tMs`, as a distance and an ink, or null when there is nothing travelling. It rises
  // on an ease-out — the wall gives, the tip goes, it slows against what is in front of it — and
  // then holds its length while the ink falls away on a square, which is a thing being absorbed
  // rather than a thing being switched off.
  function surgeAt (tMs) {
    if (!surge) return null
    var t = tMs - surge.at
    if (t < 0) t = 0
    if (t >= FLUX.SURGE_RISE + FLUX.SURGE_FALL) {
      surge = null
      lastFlux = 0            // one clean frame, so the last probe is cleared and not left standing
      return null
    }
    if (t < FLUX.SURGE_RISE) {
      var u = 1 - t / FLUX.SURGE_RISE
      return { d: surge.adv * (1 - u * u * u), a: 1 }
    }
    var v = 1 - (t - FLUX.SURGE_RISE) / FLUX.SURGE_FALL
    return { d: surge.adv, a: v * v }
  }

  // A tip's own heading, unit length: the direction its last segment was laid in, which is the
  // direction turgor pushes it. The seed node has no parent and no history, so it goes up, which is
  // where it was going to grow anyway.
  function heading (i) {
    var p = net.par[i]
    var dx = p >= 0 ? net.x[i] - net.x[p] : 0
    var dy = p >= 0 ? net.y[i] - net.y[p] : -1
    var m = Math.sqrt(dx * dx + dy * dy)
    if (!(m > 1e-6)) { dir[0] = 0; dir[1] = -1; return }
    dir[0] = dx / m
    dir[1] = dy / m
  }

  // One path for every probe and one fill for every head: two draw calls for the whole front. The
  // head is the tip where it reached, drawn over the tip where it was — the pair IS the extension,
  // and it is why nothing here is a burst, a spark or a ring.
  function drawSurge (ctx, sg) {
    var first = Math.max(0, net.n - FLUX.SURGE_N)
    if (first >= net.n) return
    var TAU = Math.PI * 2
    var i
    ctx.save()
    ctx.globalAlpha = FLUX.SURGE_A * sg.a
    ctx.strokeStyle = rgba(pal.hyphae, 1)
    ctx.fillStyle = rgba(pal.hyphae, 1)
    ctx.lineWidth = DRAW.WIDTHS[2]
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (i = first; i < net.n; i++) {
      heading(i)
      ctx.moveTo(net.x[i], net.y[i])
      ctx.lineTo(net.x[i] + dir[0] * sg.d, net.y[i] + dir[1] * sg.d)
    }
    ctx.stroke()
    ctx.globalAlpha = FLUX.SURGE_A * FLUX.SURGE_HEAD * sg.a
    ctx.beginPath()
    for (i = first; i < net.n; i++) {
      heading(i)
      ctx.moveTo(net.x[i] + dir[0] * sg.d + FLUX.TIP_R, net.y[i] + dir[1] * sg.d)
      ctx.arc(net.x[i] + dir[0] * sg.d, net.y[i] + dir[1] * sg.d, FLUX.TIP_R, 0, TAU)
    }
    ctx.fill()
    ctx.restore()
  }

  function stateKey (s) {
    if (!s) return String(net ? net.n : 0)
    var fl = s.a2 && s.a2.flush ? s.a2.flush.length : 0
    return net.n + '|' + s.act + '|' + (s.a1 ? s.a1.tips : 0) + '|' + fl + '|' + (starving() ? 1 : 0)
  }

  function starving () {
    if (HY.act1 && typeof HY.act1.throughputPerSec === 'function') {
      try { return !(HY.act1.throughputPerSec() > 0) } catch (e) { return false }
    }
    return false
  }

  function drawFlux (tMs) {
    if (!surf.attached && !attach()) return
    if (!net) return
    // Belt and braces on top of rAF stopping: the game never animates something nobody is looking
    // at, and a backgrounded tab is budgeted at 0.4% of battery an hour.
    var d = doc()
    if (d && d.hidden) return
    if (typeof tMs !== 'number' || tMs !== tMs) tMs = nowMs()
    // A transition owns the plate for as long as it is running (09 §4, §5). It is drawn from here
    // because ui.js already calls this once per frame from the one rAF, so the only cinematic in
    // the game needs no second clock and no second compositor.
    if (drawMotion(tMs)) return
    var s = S()
    // A live release borrows the flux clock. The tier's 8 Hz is one frame inside a 150 ms push, and
    // the whole claim of the push is that the eye can follow it somewhere; the borrow is bounded by
    // the surge's own 670 ms and by the fact that only a thumb can start one.
    var sg = surgeAt(tMs)
    var hz = sg ? FLUX.SURGE_HZ : T().fluxHz

    if (reduced || hz <= 0) {
      // Once per state change, never on a clock. A static frame is always present — this branch
      // never leaves the surface blank, it only stops it from breathing.
      var key = stateKey(s)
      if (key === lastStateKey && lastFlux) return
      lastStateKey = key
    } else if (tMs - lastFlux < 1000 / hz) {
      return
    }
    lastFlux = tMs

    var t0 = nowMs()
    var ctx = surf.fluxCtx
    ctx.clearRect(0, 0, surf.W, surf.H)
    refreshPalette(false)
    var tSec = tMs / 1000

    drawTips(ctx, tSec)
    // After the tips, so the head sits over the tip it came from rather than under it.
    if (sg) drawSurge(ctx, sg)
    if (s && s.act >= 2) stepPulses(ctx, tSec, s)
    // Fruiting bodies and fire are Act II objects. The a2 block survives the transition in memory
    // until the save is next written, and drawing from it in Act III would put mushrooms in space.
    if (s && s.act === 2) {
      drawFruiting(ctx, s)
      drawHazards(ctx, tSec, s)
    }
    own(nowMs() - t0)
  }

  function drawTips (ctx, tSec) {
    var starve = starving()
    var col = starve ? pal.tertiary : pal.hyphae
    var first = Math.max(0, net.n - FLUX.TIP_N)
    var TAU = Math.PI * 2
    ctx.fillStyle = rgba(col, 1)
    for (var i = first; i < net.n; i++) {
      var a
      if (starve) a = FLUX.TIP_STARVE_A
      else if (reduced) a = FLUX.TIP_STATIC_A
      else a = FLUX.TIP_A + FLUX.TIP_AMP * Math.sin(TAU * tSec / FLUX.TIP_PERIOD + i * FLUX.TIP_SPREAD)
      ctx.globalAlpha = a
      ctx.beginPath()
      ctx.arc(net.x[i], net.y[i], FLUX.TIP_R, 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // Signal pulses travel precomputed root→tip chains chosen deterministically from the seed, so
  // the same save always animates the same routes.
  function buildPath (k) {
    if (net.n < FLUX.PULSE_PATH_MIN) return null
    var span = Math.max(1, Math.min(FLUX.TIP_N, net.n - 1))
    var tip = net.n - 1 - (C() ? C().hash32('pulse', net.seed, k) : k * 2654435761 >>> 0) % span
    if (tip < 1) tip = net.n - 1
    var chain = []
    var i = tip, guard = 0
    while (i >= 0 && guard++ < GROW.CAP) { chain.push(i); i = net.par[i] }
    if (chain.length < FLUX.PULSE_PATH_MIN) return null
    chain.reverse()
    return Int32Array.from(chain)
  }

  function stepPulses (ctx, tSec, s) {
    var cap = T().pulses
    if (cap <= 0) { pulses.length = 0; return }
    var live = !!(s.res && s.res.signal > 0)
    if (live && !reduced && pulses.length < cap && tSec - lastPulseSpawn > FLUX.PULSE_SPAWN_S) {
      lastPulseSpawn = tSec
      // Routes are built once and then reused: a root→tip chain is up to 4,000 integers and there
      // is no reason to walk the parent array again for a route the network already has.
      var p
      if (paths.length < cap) {
        p = buildPath(paths.length)
        if (p) paths.push(p)
      } else {
        p = paths[(pulses.length + paths.length) % paths.length]
      }
      if (p) pulses.push({ path: p, u: 0, at: tSec })
    }
    var TAU = Math.PI * 2
    for (var i = pulses.length - 1; i >= 0; i--) {
      var q = pulses[i]
      q.u = reduced ? 0.5 : (tSec - q.at) * FLUX.PULSE_U
      if (q.u >= 1) { pulses.splice(i, 1); continue }
      var L = q.path.length - 1
      var f = q.u * L
      var j = f | 0
      var frac = f - j
      var a0 = q.path[j], a1 = q.path[Math.min(j + 1, L)]
      var px = net.x[a0] + (net.x[a1] - net.x[a0]) * frac
      var py = net.y[a0] + (net.y[a1] - net.y[a0]) * frac
      var tf = Math.max(0, f - 2)
      var tj = tf | 0
      var tfrac = tf - tj
      var b0 = q.path[tj], b1 = q.path[Math.min(tj + 1, L)]
      var tx = net.x[b0] + (net.x[b1] - net.x[b0]) * tfrac
      var ty = net.y[b0] + (net.y[b1] - net.y[b0]) * tfrac
      ctx.strokeStyle = rgba(pal.signal, FLUX.PULSE_TRAIL_A)
      ctx.lineWidth = FLUX.PULSE_TRAIL
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke()
      ctx.fillStyle = rgba(pal.signal, FLUX.PULSE_A)
      ctx.beginPath(); ctx.arc(px, py, FLUX.PULSE_DOT, 0, TAU); ctx.fill()
    }
  }

  // A cap and a stipe drawn while the flush is live. The list is the canonical a2.flush block of
  // BIBLE §3, so this needs no Act II module to be correct.
  //
  // Once the map is up the body sits on its own region, not on a hyphal tip: a fruiting body two
  // hundred pixels from the stand it grew out of is a picture that lies.
  function drawFruiting (ctx, s) {
    var list = s.a2 && s.a2.flush
    if (!list || !list.length) return
    var regions = s.a2.regions
    var k = Math.min(FLUX.FB_MAX, list.length)
    var TAU = Math.PI * 2
    ctx.fillStyle = rgba(pal.spore, FLUX.FB_A)
    for (var i = 0; i < k; i++) {
      var rid = list[i].regionId | 0
      var at = mapGeom && regions ? hexCentre(rid, regions) : null
      var x, y
      if (at) {
        x = at.x; y = at.y + FLUX.FB_STIPE_H / 2
      } else {
        var span = Math.max(1, Math.min(FLUX.TIP_N, net.n - 1))
        var id = C() ? C().hash32('fb', net.seed, rid, i) : i
        var node = net.n - 1 - (id % span)
        if (node < 0) continue
        x = net.x[node]; y = net.y[node]
      }
      ctx.fillRect(x - FLUX.FB_STIPE_W / 2, y, FLUX.FB_STIPE_W, FLUX.FB_STIPE_H)
      ctx.beginPath()
      ctx.arc(x, y, FLUX.FB_CAP_R / 2, Math.PI, TAU)
      ctx.fill()
    }
  }

  // Fire risk at or past the ignition threshold, at the region's position on the map. Luminance
  // change is held to well under the three-per-second ceiling by the 1.5 s period.
  function drawHazards (ctx, tSec, s) {
    var r = s.a2 && s.a2.regions
    if (!r || !r.fireRisk || !mapGeom) return
    var trig = C() ? C().TUNE.A2.FIRE_TRIG : 0.85
    var a = reduced ? (FLUX.HAZ_A + FLUX.HAZ_AMP / 2)
      : FLUX.HAZ_A + FLUX.HAZ_AMP * Math.sin(Math.PI * 2 * tSec / FLUX.HAZ_PERIOD)
    ctx.strokeStyle = rgba(pal.negative, a)
    ctx.lineWidth = 1.5
    var drawn = 0
    for (var i = 0; i < r.fireRisk.length && drawn < FLUX.HAZ_MAX; i++) {
      if (r.fireRisk[i] < trig) continue
      var p = hexCentre(i, r)
      if (!p) continue
      ctx.beginPath()
      ctx.arc(p.x, p.y, FLUX.HAZ_R, 0, Math.PI * 2)
      ctx.stroke()
      drawn++
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ACT II · THE HEX MAP (BIBLE §6 M17) — 61 flat-top hexes, Path2D
  //
  // Drawn as a third pass on the *same* net canvas, behind which the Act I network persists at
  // 12% alpha. The canvas is a pointer, not a target: at 360 px a hex is ~34 px, below the 44 px
  // minimum, so a tap scrolls the list to that region's card and the card is the control.
  // ───────────────────────────────────────────────────────────────────────────

  var mapGeom = null
  var mapDirty = true
  var hexPath = null

  function buildMapGeom () {
    // A flat-top axial map of radius N spans 1.5·N hex radii each side plus one radius for the
    // corner column, and √3·N each side plus half a hex height. Derived rather than tabulated so
    // the two cannot drift apart if the map ever changes size.
    var N = MAP.RINGS
    var wUnits = 3 * N + 2
    var hUnits = Math.sqrt(3) * (2 * N + 1)
    var R = Math.min((surf.W - MAP.PAD * 2) / wUnits, (surf.H - MAP.PAD * 2) / hUnits)
    mapGeom = { R: R, cx: surf.W / 2, cy: surf.H / 2, sq3: Math.sqrt(3) }
    hexPath = new Path2D()
    for (var k = 0; k < 6; k++) {
      var th = Math.PI / 3 * k
      var px = Math.cos(th) * R, py = Math.sin(th) * R
      if (k === 0) hexPath.moveTo(px, py); else hexPath.lineTo(px, py)
    }
    hexPath.closePath()
  }

  function hexCentre (i, regions) {
    if (!mapGeom || !regions || !regions.q) return null
    var q = regions.q[i], r = regions.r[i]
    return {
      x: mapGeom.cx + mapGeom.R * 1.5 * q,
      y: mapGeom.cy + mapGeom.R * mapGeom.sq3 * (r + q / 2)
    }
  }

  function drawMap (regions) {
    sampleFrame()
    if (!surf.attached && !attach()) return
    if (!regions || !regions.q) return
    if (!net) { ensureNet(); if (!net) return }
    if (!mapGeom || mapDirty) { buildMapGeom(); mapDirty = false }
    var ctx = surf.netCtx
    var t0 = nowMs()
    refreshPalette(false)

    // The map owns the whole surface for this pass, so the append-only contract is suspended and
    // the structural layer is redrawn beneath it at the alpha of 06 §7.6.
    ctx.save()
    ctx.clearRect(0, 0, surf.W, surf.H)
    ctx.globalAlpha = MAP.NET_ALPHA
    ctx.strokeStyle = rgba(pal.hyphae, 1)
    ctx.lineCap = 'round'
    for (var b = 0; b < 3; b++) {
      ctx.lineWidth = DRAW.WIDTHS[b]
      ctx.beginPath()
      for (var i = 1; i < net.n; i++) {
        var p = net.par[i]
        if (p < 0 || bucketOf(net.gen[i]) !== b) continue
        ctx.moveTo(net.x[p], net.y[p]); ctx.lineTo(net.x[i], net.y[i])
      }
      ctx.stroke()
    }
    ctx.restore()
    net.drawn = net.n

    var n = regions.q.length
    for (var j = 0; j < n; j++) {
      var c = hexCentre(j, regions)
      if (!c) continue
      ctx.save()
      ctx.translate(c.x, c.y)
      paintHex(ctx, regions, j, 1)
      ctx.restore()
    }
    own(nowMs() - t0)
  }

  // One region's face, drawn at the origin: terrain fill, state stroke, any barrier edges, any
  // rival mark. `mul` scales every alpha in it, which is what lets the ASCOSPORE hex lift fade a
  // region out without the transition having to know how a region is drawn.
  function paintHex (ctx, regions, j, mul) {
    var flags = regions.flags ? regions.flags[j] : 0
    var discovered = !!(flags & 1)
    var state = (flags & 4) ? 2 : ((flags & 8) ? 3 : (discovered ? 1 : 0))
    if (!discovered) {
      ctx.globalAlpha = MAP.STROKE_A[0] * mul
      ctx.fillStyle = rgba(pal.lineStrong, 1)
      ctx.beginPath(); ctx.arc(0, 0, MAP.DOT_R, 0, Math.PI * 2); ctx.fill()
      return
    }
    var terr = regions.terrain ? regions.terrain[j] : 0
    var fillA = MAP.TERRAIN_A[terr % MAP.TERRAIN_A.length]
    // Colonisation is the second channel on terrain's fill density, so neither is hue-only.
    var col = regions.col ? regions.col[j] : 0
    ctx.globalAlpha = fillA * (0.45 + 0.55 * clamp01(col)) * mul
    ctx.fillStyle = rgba(state >= 2 ? pal.signal : pal.surface2, 1)
    ctx.fill(hexPath)
    ctx.globalAlpha = MAP.STROKE_A[state] * mul
    ctx.lineWidth = state >= 2 ? 1.5 : 1
    ctx.strokeStyle = rgba(state >= 2 ? pal.signal : pal.line, 1)
    ctx.stroke(hexPath)

    // Barriers are offset breaks: the blocked edge is redrawn inset and dashed, so the hex
    // boundary itself never carries two meanings at once.
    var bar = regions.barriers ? regions.barriers[j] : 0
    if (bar) drawBarriers(ctx, bar, mapGeom.R, mul)

    if (regions.rival && regions.rival[j] >= 0) {
      ctx.globalAlpha = MAP.RIVAL_A * mul
      ctx.fillStyle = rgba(pal.negative, 1)
      ctx.beginPath(); ctx.arc(0, -mapGeom.R * 0.42, MAP.RIVAL_R, 0, Math.PI * 2); ctx.fill()
    }
  }

  // Axial ring index: the hex distance from the centre region, which is the order the ASCOSPORE
  // drain runs in (09 §4.2, ring 4 inward).
  function ringOf (regions, j) {
    var q = regions.q[j], r = regions.r[j]
    return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2
  }

  function drawBarriers (ctx, mask, R, mul) {
    var inset = R - MAP.BARRIER_INSET
    ctx.save()
    ctx.globalAlpha = mul === undefined ? 1 : mul
    ctx.lineWidth = MAP.BARRIER_W
    ctx.strokeStyle = rgba(pal.lineStrong, 1)
    if (ctx.setLineDash) ctx.setLineDash(MAP.BARRIER_DASH)
    for (var e = 0; e < 6; e++) {
      if (!(mask & (1 << e))) continue
      var a0 = Math.PI / 3 * e
      var a1 = Math.PI / 3 * (e + 1)
      ctx.beginPath()
      ctx.moveTo(Math.cos(a0) * inset, Math.sin(a0) * inset)
      ctx.lineTo(Math.cos(a1) * inset, Math.sin(a1) * inset)
      ctx.stroke()
    }
    if (ctx.setLineDash) ctx.setLineDash([])
    ctx.restore()
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ACT III · THE VOID (13 concentric arcs) AND THE PHASE WHEEL
  // ───────────────────────────────────────────────────────────────────────────

  function ncapOf (bands, b) {
    if (bands.ncap) return bands.ncap[b]
    var t = C() ? C().TUNE.A3 : null
    if (!t || !bands.X) return 1
    return Math.max(1, (t.X0_BASE * Math.pow(t.X0_GROWTH, b)) / t.NCAP_DIV)
  }

  // Sweep is exploration, width is occupancy: thirteen arc() calls, cheap enough to redraw whole.
  function drawVoid (bands) {
    sampleFrame()
    if (!surf.attached && !attach()) return
    if (!bands || !bands.e) return
    var ctx = surf.netCtx
    var t0 = nowMs()
    refreshPalette(false)
    ctx.clearRect(0, 0, surf.W, surf.H)
    var cx = surf.W / 2, cy = surf.H / 2
    var nb = Math.min(bands.e.length, C() ? C().TUNE.A3.BANDS : 13)
    var fit = Math.min(surf.W, surf.H) / VOID.SIZE
    ctx.save()
    ctx.lineCap = 'butt'
    for (var b = 0; b < nb; b++) {
      var r = (VOID.R0 + VOID.STEP * b) * fit
      if (r <= 0) continue
      var e = clamp01(bands.e[b])
      var occ = bands.n ? bands.n[b] / ncapOf(bands, b) : 0
      var w = VOID.W_MIN + VOID.W_K * Math.log10(1 + (occ > 0 ? occ : 0))
      // The unexplored remainder is a hairline track at every band, never the band's own width:
      // an empty ring drawn eight pixels thick reads as a fleet that is not there.
      ctx.lineWidth = VOID.TRACK_W
      ctx.strokeStyle = rgba(pal.lineStrong, VOID.GAP_A)
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
      if (e <= 0) continue
      // Widths scale with the plate for the same reason the radii do: the sky between two bands
      // is the reading, and it has to survive a 900 px viewport as well as a 360 px one.
      ctx.lineWidth = (w > VOID.W_MAX ? VOID.W_MAX : w) * fit
      ctx.strokeStyle = rgba(pal.signal, 0.85)
      ctx.beginPath(); ctx.arc(cx, cy, r, VOID.START, VOID.START + Math.PI * 2 * e); ctx.stroke()
    }
    ctx.restore()
    own(nowMs() - t0)
  }

  function clamp01 (v) { return v > 1 ? 1 : (v < 0 || v !== v ? 0 : v) }

  // Thirteen dots, the resultant, and a ring at the ϒ ENDING A asks for. The wheel is fully
  // described in text elsewhere on the screen; this is the same information, drawn.
  function drawWheel (phases, mass) {
    if (!surf.attached && !attach()) return
    if (!surf.wheelCtx && doc()) { refreshOptional(doc()); if (surf.wheelCtx) resize() }
    var ctx = surf.wheelCtx || surf.fluxCtx
    if (!ctx || !phases || !phases.length) return
    var t0 = nowMs()
    refreshPalette(false)
    var el = surf.wheelCtx ? surf.wheelEl : surf.fluxEl
    var w = el.clientWidth || surf.W, h = el.clientHeight || surf.H
    ctx.clearRect(0, 0, w, h)
    var cx = w / 2, cy = h / 2
    var R = Math.min(WHEEL.R, Math.min(w, h) / 2 - WHEEL.DOT_R_MAX - 2)
    var TAU = Math.PI * 2

    ctx.save()
    ctx.strokeStyle = rgba(pal.line, 0.7)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke()

    ctx.strokeStyle = rgba(pal.attention, 0.75)
    if (ctx.setLineDash) ctx.setLineDash(WHEEL.RING_DASH)
    ctx.beginPath(); ctx.arc(cx, cy, R * WHEEL.RING_AT, 0, TAU); ctx.stroke()
    if (ctx.setLineDash) ctx.setLineDash([])

    var sx = 0, sy = 0, sm = 0
    for (var b = 0; b < phases.length; b++) {
      var m = mass && mass[b] > 0 ? mass[b] : 1
      var th = TAU * (phases[b] - Math.floor(phases[b]))
      var px = cx + Math.cos(th - Math.PI / 2) * R
      var py = cy + Math.sin(th - Math.PI / 2) * R
      sx += Math.cos(th) * m; sy += Math.sin(th) * m; sm += m
      var rad = WHEEL.DOT_R
      if (mass && sm > 0) rad = WHEEL.DOT_R + (WHEEL.DOT_R_MAX - WHEEL.DOT_R) * clamp01(m / (sm || 1))
      ctx.fillStyle = rgba(pal.signal, 0.85)
      ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill()
    }
    if (sm > 0) {
      var ux = sx / sm, uy = sy / sm
      var ups = Math.sqrt(ux * ux + uy * uy)
      var ang = Math.atan2(uy, ux) - Math.PI / 2
      ctx.strokeStyle = rgba(pal.text, 0.9)
      ctx.lineWidth = WHEEL.RESULT_W
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(ang) * R * ups, cy + Math.sin(ang) * R * ups)
      ctx.stroke()
    }
    ctx.restore()
    own(nowMs() - t0)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE ACT TRANSITIONS AND THE ENDINGS (09 §4, §5)
  //
  // log.js emits the sequences as steps; the ones of kind `motion` name a thing that has to happen
  // on screen. The named steps this module owns are the ones that are made of drawing:
  //
  //   canvasFull    DECIDE's conduction wave              01 §11.4, 09 §4.1
  //   mapDrain      the map desaturates ring 4 → ring 0   09 §4.2
  //   holdCore      the core is the last colour left      09 §4.2
  //   hexLift       the hexes rise and go                 09 §4.2
  //   voidCanvas    ESCAPE's arc and twelve rings         09 §4.3
  //   wheelConverge ENDING A's thirteen dots meet         09 §5.1
  //   fillWhite     the bloom                             09 §5.1
  //   holdWhite     six seconds of nothing                09 §5.1
  //   wheelCollapse ENDING B's dot, and then only it      09 §5.2
  //   cut           to black, no fade                     09 §4.1, §5
  //   crossfade     the reduced-motion path               09 §4.2, §4.3
  //
  // Everything else a sequence asks for — panels fading, lists collapsing, a panel closing, the
  // screen clearing — is DOM, and `motion()` answers null for it so the host knows it is theirs.
  //
  // What a motion owns is the PLATE, which is the canvas's whole world. Making the plate fill the
  // viewport — 09 §4.1's "the canvas fills the viewport", and what the dismantle's cleared screen
  // leaves behind before ENDING A — is a CSS size on an element this module does not own, and it
  // belongs to the same host that runs panelsFade and closePanel.
  //
  // A live motion owns the flux surface and paints the plate. The flux layer is already the one
  // that is cleared and redrawn every frame, it already sits above the append-only network, and
  // ui.js already calls drawFlux() from the single rAF — so a transition needs no second clock and
  // no second compositor. When the motion's time is up it holds its last frame rather than handing
  // the plate back: a transition that flickered back to the running game between two of its own
  // steps would be the one visible seam in the only cinematic in the game.
  //
  // Everything seeded is seeded from the run seed through hash01, so a transition looks the same
  // every time the same save reaches it. Under prefers-reduced-motion the motion is held at its
  // last frame for its whole duration — the still picture, never a blank plate.
  // ───────────────────────────────────────────────────────────────────────────

  var mo = null                       // the live motion, or null
  var depth = null, depthN = -1       // per-node root-to-tip distance, 0 at the seed node

  function plateR () {
    // Half the plate diagonal: the radius at which a disc drawn from the centre has covered
    // every corner, which is what "fills the canvas" means for a circle.
    return Math.sqrt(surf.W * surf.W + surf.H * surf.H) / 2
  }

  function coverPlate (ctx, colour, alpha) {
    ctx.globalAlpha = alpha
    ctx.fillStyle = rgba(colour, 1)
    ctx.fillRect(0, 0, surf.W, surf.H)
    ctx.globalAlpha = 1
  }

  function buildDepth () {
    if (!net) return
    var maxG = 1, i
    for (i = 0; i < net.n; i++) if (net.gen[i] > maxG) maxG = net.gen[i]
    depth = new Float32Array(net.n)
    for (i = 0; i < net.n; i++) depth[i] = net.gen[i] / maxG
    depthN = net.n
  }

  // 01 §11.4: "a slow radial luminance wave (0.18 Hz, peak alpha 0.55, never full white, never
  // inverting) travels root-to-tip, eight times" in 3.6 s. Eight passes in 3.6 s is 2.2 Hz, so
  // 0.18 Hz cannot also be the pass rate and the two numbers are two different things: `passes` is
  // the count of root-to-tip traversals, and `hz` is the envelope that swells the crest. At
  // 0.18 Hz the envelope is a raised cosine that reaches full at 2.78 s and is still near full when
  // the cut lands at 3.6 — it peaks once and never goes negative, which is what keeps this
  // conduction rather than the strobe the teardown refused.
  function drawConduction (ctx, u, o) {
    if (!net || net.n < 2) return
    if (depthN !== net.n) buildDepth()
    var passes = o.passes > 0 ? o.passes : MOTION.PASSES
    var peak = o.peakAlpha > 0 ? o.peakAlpha : MOTION.PEAK
    var hz = o.hz > 0 ? o.hz : MOTION.WAVE_HZ
    var env = 0.5 - 0.5 * Math.cos(Math.PI * 2 * hz * (mo.ms / 1000) * u)
    var head = (u * passes) % 1
    var w = MOTION.BAND_W
    var bins = MOTION.BINS
    var i, p, d, delta, a, b

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineWidth = DRAW.WIDTHS[1]
    ctx.strokeStyle = rgba(pal.hyphae, 1)

    // The whole body glows faintly under the crest, so what travels reads as something moving
    // through a thing that is there rather than as a light switching parts of it on.
    ctx.globalAlpha = MOTION.WAVE_BASE * env
    ctx.beginPath()
    for (i = 1; i < net.n; i++) {
      p = net.par[i]
      if (p < 0) continue
      ctx.moveTo(net.x[p], net.y[p]); ctx.lineTo(net.x[i], net.y[i])
    }
    ctx.stroke()

    // One path per alpha bucket: six strokes for the crest regardless of how large the body is.
    for (b = 0; b < bins; b++) {
      ctx.globalAlpha = peak * env * (b + 1) / bins
      ctx.lineWidth = DRAW.WIDTHS[1] + (b + 1) / bins
      ctx.beginPath()
      var any = false
      for (i = 1; i < net.n; i++) {
        p = net.par[i]
        if (p < 0) continue
        d = depth[i]
        delta = d - head
        // The band wraps: a pass that runs off the tips arrives at the root again.
        if (delta > 0.5) delta -= 1
        else if (delta < -0.5) delta += 1
        if (delta < 0) delta = -delta
        if (delta > w) continue
        a = 1 - delta / w
        if (Math.floor(a * bins) !== b && !(b === bins - 1 && a >= 1)) continue
        ctx.moveTo(net.x[p], net.y[p]); ctx.lineTo(net.x[i], net.y[i])
        any = true
      }
      if (any) ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }

  // Each region's fill drains to the background colour, one ring per perRingMs, outermost first.
  // The map itself is left alone on the net canvas: draining to the background IS painting the
  // background over it, and doing it that way means the drain costs 61 fills and no re-render.
  function drawMapDrain (ctx, u, o) {
    var s = S()
    var regions = s && s.a2 ? s.a2.regions : null
    if (!regions || !regions.q) return
    if (!mapGeom || mapDirty) { buildMapGeom(); mapDirty = false }
    var from = o.fromRing === undefined ? MAP.RINGS : o.fromRing
    var to = o.toRing === undefined ? 0 : o.toRing
    var steps = Math.max(1, from - to)
    var j, ring, k, a, c
    ctx.save()
    ctx.fillStyle = rgba(pal.bg, 1)
    // The region's own outline straddles the path, so half of it lies outside any fill of that
    // path. Stroking the same path in the background colour takes the edge with the face — without
    // it the drained rings keep a green wireframe and the core is not the last colour on screen.
    ctx.strokeStyle = rgba(pal.bg, 1)
    ctx.lineWidth = MAP.DRAIN_W
    for (j = 0; j < regions.q.length; j++) {
      ring = ringOf(regions, j)
      // The core is what the sequence holds on at 3.70 s, so it is never in the drain: `toRing` is
      // the ring the drain stops above, not the last ring it takes.
      if (ring <= to) continue
      k = from - ring
      a = clamp01(u * steps - k)
      if (a <= 0) continue
      c = hexCentre(j, regions)
      if (!c) continue
      ctx.globalAlpha = a
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.fill(hexPath)
      ctx.stroke(hexPath)
      ctx.restore()
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }

  // 09 §4.2: each polygon translates up 4–40 px, seeded, while its alpha goes to zero over
  // alphaMs, with a 0–400 ms per-region stagger. The drained plate is painted first, because the
  // hexes that are lifting are the ones the net canvas is still holding in their old positions.
  function drawHexLift (ctx, u, o) {
    var s = S()
    var regions = s && s.a2 ? s.a2.regions : null
    coverPlate(ctx, pal.bg, 1)
    if (!regions || !regions.q) return
    if (!mapGeom || mapDirty) { buildMapGeom(); mapDirty = false }
    var rise = o.risePx || MOTION.LIFT_RISE
    var stag = o.staggerMs || [0, MOTION.LIFT_STAGGER_MS]
    var fade = o.alphaMs > 0 ? o.alphaMs : MOTION.LIFT_MS
    var elapsed = mo.ms * u
    var j, c, h, st, local, f, alpha
    ctx.save()
    for (j = 0; j < regions.q.length; j++) {
      c = hexCentre(j, regions)
      if (!c) continue
      h = hash01(mo.seed, j)
      st = stag[0] + (stag[1] - stag[0]) * hash01(mo.seed ^ 0x5BF03635, j)
      local = elapsed - st
      if (local <= 0) { f = 0; alpha = 1 } else {
        f = clamp01(local / fade)
        alpha = 1 - f
      }
      if (alpha <= 0) continue
      ctx.save()
      ctx.translate(c.x, c.y - (rise[0] + (rise[1] - rise[0]) * h) * f)
      paintHex(ctx, regions, j, alpha)
      ctx.restore()
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }

  // 09 §4.3: "the VOID canvas fades in: one filled arc at radius 0, twelve empty rings."
  function drawVoidIn (ctx, u, o) {
    var rings = o.rings > 0 ? o.rings : 12
    var arcs = o.arcs > 0 ? o.arcs : 1
    var fit = Math.min(surf.W, surf.H) / VOID.SIZE
    var cx = surf.W / 2, cy = surf.H / 2
    var b, r
    coverPlate(ctx, pal.bg, 1)
    ctx.save()
    ctx.lineCap = 'butt'
    for (b = 0; b <= rings; b++) {
      r = (VOID.R0 + VOID.STEP * b) * fit
      if (r <= 0) continue
      ctx.lineWidth = VOID.TRACK_W
      ctx.globalAlpha = u
      ctx.strokeStyle = rgba(pal.lineStrong, VOID.GAP_A)
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
      if (b < arcs) {
        ctx.lineWidth = VOID.W_MIN * fit
        ctx.strokeStyle = rgba(pal.signal, 0.85)
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
      }
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }

  // The phase wheel, read live from finale. ENDING A's dots converge to one point on the rim;
  // ENDING B's keep going past it, collapse to the centre, and then the dot grows until it is the
  // whole plate (09 §5.1, §5.2). Both start from the wheel the player has been reading all act.
  function phasesNow () {
    var w = HY.finale && HY.finale.wheel ? HY.finale.wheel(S()) : null
    return (w && w.phases && w.phases.length) ? w : null
  }

  function meanAngle (ph, mass) {
    var sx = 0, sy = 0, b, m, th
    for (b = 0; b < ph.length; b++) {
      m = mass && mass[b] > 0 ? mass[b] : 1
      th = Math.PI * 2 * (ph[b] - Math.floor(ph[b]))
      sx += Math.cos(th) * m; sy += Math.sin(th) * m
    }
    return Math.atan2(sy, sx)
  }

  function drawWheelMotion (ctx, u, o, collapse) {
    var w = phasesNow()
    coverPlate(ctx, pal.bg, 1)
    if (!w) return
    var ph = w.phases, mass = w.mass
    var cx = surf.W / 2, cy = surf.H / 2
    var R = Math.min(WHEEL.R, Math.min(surf.W, surf.H) / 2 - WHEEL.DOT_R_MAX - 2)
    var TAU = Math.PI * 2
    var mean = meanAngle(ph, mass)
    // Converge over the first COLLAPSE_AT of ENDING B and the whole of ENDING A. ENDING B's growth
    // is linear and does not ease out (09 §5.2), so neither is the convergence it comes out of.
    var span = collapse ? MOTION.COLLAPSE_AT : 1
    var k = clamp01(u / span)
    var grow = collapse ? clamp01((u - span) / (1 - span)) : 0
    var b, th, ang, rad, px, py

    ctx.save()
    // The rim dims out as the dots leave it: what is left at the end is the dots, not the dial.
    ctx.globalAlpha = (1 - k) * 0.7
    ctx.strokeStyle = rgba(pal.line, 1)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke()

    rad = collapse ? R * (1 - k) : R
    ctx.globalAlpha = 0.85
    ctx.fillStyle = rgba(pal.signal, 1)
    for (b = 0; b < ph.length; b++) {
      th = TAU * (ph[b] - Math.floor(ph[b]))
      // Shortest way round, so a dot at 350° and one at 10° meet between them and not across.
      ang = th + wrapPi(mean - th) * k
      px = cx + Math.cos(ang - Math.PI / 2) * rad
      py = cy + Math.sin(ang - Math.PI / 2) * rad
      ctx.beginPath(); ctx.arc(px, py, MOTION.DOT_R, 0, TAU); ctx.fill()
    }
    if (grow > 0) {
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.arc(cx, cy, MOTION.DOT_R + (plateR() - MOTION.DOT_R) * grow, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }

  function wrapPi (a) {
    while (a > Math.PI) a -= Math.PI * 2
    while (a < -Math.PI) a += Math.PI * 2
    return a
  }

  // THE BLOOM. `--spore-000` is the game's white and the colour of the thing being released; there
  // is no second, whiter white in the build, and a hard #FFF would be the one ink in nine hours
  // that is not in the palette. From the centre it is a disc that grows to cover every corner;
  // under reduced motion 09 §5.1 asks for an opacity ramp with no expansion instead.
  function drawFillWhite (ctx, u, o) {
    var cx = surf.W / 2, cy = surf.H / 2
    coverPlate(ctx, pal.bg, 1)
    if (o.from === 'opacity') { coverPlate(ctx, pal.spore, u); return }
    ctx.save()
    ctx.globalAlpha = 1
    ctx.fillStyle = rgba(pal.spore, 1)
    ctx.beginPath(); ctx.arc(cx, cy, plateR() * u, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    ctx.globalAlpha = 1
  }

  // ───────────────────────────────────────────────────────────────────────────

  var MOTIONS = {
    canvasFull: {
      ms: function (o) { return o.ms > 0 ? o.ms : MOTION.WAVE_MS },
      hz: function (o) { return o.redrawHz > 0 ? o.redrawHz : MOTION.REDRAW_HZ },
      draw: drawConduction
    },
    mapDrain: {
      ms: function (o) {
        var from = o.fromRing === undefined ? MAP.RINGS : o.fromRing
        var to = o.toRing === undefined ? 0 : o.toRing
        return Math.max(1, from - to) * (o.perRingMs > 0 ? o.perRingMs : MOTION.DRAIN_MS)
      },
      draw: drawMapDrain
    },
    holdCore: {
      ms: function (o) { return o.ms > 0 ? o.ms : MOTION.HOLD_MS },
      // The drain, finished and standing still. The core is the only region with colour in it and
      // nothing moves for 1.2 s, which is the whole content of the beat.
      draw: function (ctx, u, o) { drawMapDrain(ctx, 1, o) }
    },
    hexLift: {
      ms: function (o) {
        var stag = o.staggerMs || [0, MOTION.LIFT_STAGGER_MS]
        return (o.alphaMs > 0 ? o.alphaMs : MOTION.LIFT_MS) + stag[1]
      },
      draw: drawHexLift
    },
    voidCanvas: {
      ms: function (o) { return o.ms > 0 ? o.ms : MOTION.VOID_MS },
      draw: drawVoidIn
    },
    wheelConverge: {
      ms: function (o) { return o.ms > 0 ? o.ms : MOTION.CONVERGE_MS },
      draw: function (ctx, u, o) { drawWheelMotion(ctx, u, o, false) }
    },
    wheelCollapse: {
      ms: function (o) { return o.ms > 0 ? o.ms : MOTION.COLLAPSE_MS },
      draw: function (ctx, u, o) { drawWheelMotion(ctx, u, o, true) }
    },
    fillWhite: {
      ms: function (o) { return o.ms > 0 ? o.ms : MOTION.WHITE_MS },
      draw: drawFillWhite
    },
    holdWhite: {
      ms: function (o) { return o.ms > 0 ? o.ms : MOTION.WHITE_HOLD_MS },
      // Six seconds of white and nothing else. The skip hint the payload describes is text, and
      // there has never been text on a canvas in this game.
      draw: function (ctx) { coverPlate(ctx, pal.spore, 1) }
    },
    cut: {
      ms: function (o) { return o.ms > 0 ? o.ms : 0 },
      // "Cut to black. No fade." The plate's own background is the black the rest of the game is
      // drawn on, and it is still the right colour if the player has forced the light theme.
      draw: function (ctx, u) { coverPlate(ctx, pal.bg, u) }
    },
    crossfade: {
      ms: function (o) { return o.ms > 0 ? o.ms : MOTION.CROSSFADE_MS },
      draw: function (ctx, u) { coverPlate(ctx, pal.bg, u) }
    }
  }

  // Returns the motion's duration in ms, or null if this module does not own the name — which is
  // how the host tells a drawn step from a DOM one without keeping a second copy of the list.
  function motion (name, opts) {
    var m = MOTIONS[name]
    if (!m) return null
    opts = opts || {}
    var ms = m.ms(opts)
    if (!(ms >= 0)) ms = 0
    mo = {
      name: name, opts: opts, draw: m.draw, ms: ms,
      hz: m.hz ? m.hz(opts) : 0,
      t0: nowMs(), last: 0, seed: seedOf()
    }
    lastFlux = 0
    return ms
  }

  function motionActive () { return !!mo }

  // Hands the plate back to the act. The last frame stays until something else draws over it,
  // which for every act is the next frame of its own structural pass.
  function stopMotion () {
    var was = !!mo
    mo = null
    if (was) { invalidate(); if (surf.fluxCtx) surf.fluxCtx.clearRect(0, 0, surf.W, surf.H) }
    return was
  }

  function drawMotion (tMs) {
    if (!mo) return false
    if (!surf.attached && !attach()) return true
    var ctx = surf.fluxCtx
    if (!ctx) return true
    // The conduction wave is asked for at 8 Hz by its own payload and costs a pass over the whole
    // network; every other motion is cheap and runs at the frame rate.
    if (mo.hz > 0 && mo.last && tMs - mo.last < 1000 / mo.hz) return true
    mo.last = tMs
    var u = mo.ms > 0 ? (tMs - mo.t0) / mo.ms : 1
    // Under reduced motion the still frame is the whole of the motion: the picture the sequence
    // was going to arrive at, held for as long as the sequence gives it. Never a blank plate.
    if (reduced) u = 1
    if (!(u >= 0)) u = 0
    if (u > 1) u = 1
    var t0 = nowMs()
    refreshPalette(false)
    ctx.clearRect(0, 0, surf.W, surf.H)
    mo.draw(ctx, u, mo.opts, mo)
    ctx.globalAlpha = 1
    own(nowMs() - t0)
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE FORECAST STRIP (06 §7.7) — full column width × 44 px, 1 Hz
  // ───────────────────────────────────────────────────────────────────────────

  var lastFore = 0

  function drawForecast (band) {
    if (!surf.attached && !attach()) return
    if (!surf.foreCtx && doc()) { refreshOptional(doc()); if (surf.foreCtx) resize() }
    var ctx = surf.foreCtx
    if (!ctx || !band) return
    var t = nowMs()
    if (t - lastFore < 1000 / FORECAST.HZ) return
    lastFore = t
    var t0 = nowMs()
    refreshPalette(false)

    var el = surf.foreEl
    var W = el.clientWidth || (C() ? C().TUNE.UI.COLUMN_PX : 420)
    var H = el.clientHeight || FORECAST.H
    ctx.clearRect(0, 0, W, H)

    var hist = band.hist || band.series
    var fore = band.fore || null
    if (!hist || !hist.length) return
    var nh = Math.min(hist.length, FORECAST.SAMPLES)
    var nf = fore ? fore.length : 0
    var total = nh + nf
    var step = W / Math.max(1, total - 1)
    var amp = Math.min(FORECAST.AMP, H - 4)

    function yOf (v) { return H - clamp01(v) * amp }

    ctx.save()

    // The graze cycle (02 §7.6) is the background danger level and it is deterministic, so it is
    // drawn across the whole window — past and future alike — hugging the floor.
    var graze = band.graze
    if (graze && graze.length >= total) {
      ctx.beginPath()
      ctx.moveTo(0, H)
      for (var g = 0; g < total; g++) ctx.lineTo(g * step, H - clamp01(graze[g]) * FORECAST.GRAZE_H)
      ctx.lineTo((total - 1) * step, H)
      ctx.closePath()
      ctx.fillStyle = rgba(pal.negative, FORECAST.GRAZE_A)
      ctx.fill()
    }

    // The two thresholds the hazard actually reads. They are the only numbers on the strip that
    // matter, so they are the only horizontals drawn.
    var danger = band.danger
    if (danger && danger.length) {
      ctx.save()
      ctx.lineWidth = 1
      ctx.strokeStyle = rgba(pal.negative, FORECAST.DANGER_A)
      if (ctx.setLineDash) ctx.setLineDash(FORECAST.DANGER_DASH)
      for (var d = 0; d < danger.length; d++) {
        var dy = Math.round(yOf(danger[d])) + 0.5
        ctx.beginPath(); ctx.moveTo(0, dy); ctx.lineTo(W, dy); ctx.stroke()
      }
      ctx.restore()
    }

    ctx.beginPath()
    ctx.moveTo(0, H)
    for (var i = 0; i < nh; i++) ctx.lineTo(i * step, yOf(hist[i]))
    ctx.lineTo((nh - 1) * step, H)
    ctx.closePath()
    ctx.fillStyle = rgba(pal.signal, 0.16)
    ctx.fill()

    ctx.beginPath()
    for (var j = 0; j < nh; j++) {
      if (j === 0) ctx.moveTo(0, yOf(hist[0])); else ctx.lineTo(j * step, yOf(hist[j]))
    }
    ctx.lineWidth = FORECAST.STROKE_W
    ctx.strokeStyle = rgba(pal.signal, 1)
    ctx.stroke()

    if (nf) {
      var xd = (nh - 1) * step
      ctx.beginPath()
      ctx.moveTo(xd, 0); ctx.lineTo(xd, H)
      ctx.lineWidth = 1
      ctx.strokeStyle = rgba(pal.lineStrong, 1)
      ctx.stroke()

      // The uncertainty envelope. It is the whole reason the strip exists: the centre line is what
      // the process will probably do and this is what it might do, and a player who reads the
      // second one beats a player who reads the first.
      var lo = band.lo, hi = band.hi
      if (lo && hi && lo.length === nf && hi.length === nf) {
        ctx.beginPath()
        ctx.moveTo(xd, yOf(hist[nh - 1]))
        for (var e = 0; e < nf; e++) ctx.lineTo((nh + e) * step, yOf(hi[e]))
        for (e = nf - 1; e >= 0; e--) ctx.lineTo((nh + e) * step, yOf(lo[e]))
        ctx.closePath()
        ctx.fillStyle = rgba(pal.signal, FORECAST.BAND_A)
        ctx.fill()
      }

      // "Predicted" is dashed as well as dimmer: never a hue-only distinction.
      ctx.beginPath()
      ctx.moveTo(xd, yOf(hist[nh - 1]))
      for (var k = 0; k < nf; k++) ctx.lineTo((nh + k) * step, yOf(fore[k]))
      ctx.lineWidth = FORECAST.STROKE_W
      ctx.strokeStyle = rgba(pal.signal, FORECAST.FORE_A)
      if (ctx.setLineDash) ctx.setLineDash(FORECAST.FORE_DASH)
      ctx.stroke()
      if (ctx.setLineDash) ctx.setLineDash([])
    }

    var rel = band.releases
    if (rel && rel.length) {
      ctx.fillStyle = rgba(pal.attention, 1)
      for (var m = 0; m < rel.length; m++) {
        var x = clamp01(rel[m] / Math.max(1, total - 1)) * W
        ctx.fillRect(x - FORECAST.MARK_W / 2, 0, FORECAST.MARK_W, H)
        ctx.beginPath()
        ctx.moveTo(x - FORECAST.MARK_TRI / 2, 0)
        ctx.lineTo(x + FORECAST.MARK_TRI / 2, 0)
        ctx.lineTo(x, FORECAST.MARK_TRI)
        ctx.closePath(); ctx.fill()
      }
    }
    ctx.restore()
    own(nowMs() - t0)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ADAPTIVE TIERING (06 §7.8) — measured, not guessed
  // ───────────────────────────────────────────────────────────────────────────

  var frames = { buf: new Float32Array(PERF.WIN), n: 0, w: 0, last: 0, since: 0, p95: 0 }
  var ownCost = { buf: new Float32Array(BUDGET.OWN_WIN), n: 0, w: 0, p95: 0 }
  var badSince = 0, lastDemote = -1e9, lastPromote = -1e9, boot = nowMs()

  function own (ms) {
    ownCost.buf[ownCost.w] = ms
    ownCost.w = (ownCost.w + 1) % BUDGET.OWN_WIN
    if (ownCost.n < BUDGET.OWN_WIN) ownCost.n++
  }

  var scratch = new Float32Array(PERF.WIN)
  function p95 (ring, len) {
    if (len < 8) return 0
    for (var i = 0; i < len; i++) scratch[i] = ring[i]
    var a = scratch.subarray(0, len)
    a.sort()                                  // TypedArray sorts numerically without a comparator
    return a[Math.min(len - 1, Math.floor(len * 0.95))]
  }

  // Called at the head of whichever structural pass owns the current act, so the tier keeps
  // tracking across an act break. Two calls inside one frame would otherwise inject a near-zero
  // delta and pull the p95 down, so a sub-millisecond gap is treated as the same frame.
  function sampleFrame () {
    var t = nowMs()
    if (frames.last) {
      var dt = t - frames.last
      if (dt < 1) return
      // A tab wake produces one enormous delta that is not a slow frame and must not demote.
      if (dt < PERF.FRAME_MAX_MS) {
        frames.buf[frames.w] = dt
        frames.w = (frames.w + 1) % PERF.WIN
        if (frames.n < PERF.WIN) frames.n++
        frames.since++
      }
    }
    frames.last = t
    if (frames.since >= PERF.RECOMPUTE) {
      frames.since = 0
      frames.p95 = p95(frames.buf, frames.n)
      ownCost.p95 = p95(ownCost.buf, ownCost.n)
      retier(t)
    }
  }

  function cores () {
    return (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4
  }
  function memGB () {
    return (typeof navigator !== 'undefined' && navigator.deviceMemory) || 4
  }

  function retier (t) {
    if (manualTier) return
    if (memGB() <= PERF.MEM_FLOOR_GB) { setTierInternal('FLOOR', t); return }
    // 06 §7.8's ninety frames of warmup, with a wall-clock escape hatch so a device that is
    // dropping frames badly enough to never reach ninety still gets demoted.
    if (frames.n < PERF.WARMUP && t - boot < PERF.WARMUP * PERF.FRAME_60_MS) return

    var p = frames.p95
    var want = null
    if (p > PERF.FLOOR_P95) want = 'FLOOR'
    else if (p > PERF.LOW_P95) want = 'LOW'

    // My own cost is measured separately: the canvas must never be the reason a frame is dropped,
    // so it degrades on its own budget before the frame p95 has degraded at all.
    if (!want && ownCost.p95 > BUDGET.OWN_P95_MS) want = demoteName()

    if (want) {
      if (!badSince) badSince = t
      if (t - badSince >= PERF.HOLD_S * 1000 && rank(want) < rank(tier)) {
        setTierInternal(want, t)
        badSince = 0
      }
      return
    }
    badSince = 0

    // Promotion is rate-limited so a thermally throttling phone does not oscillate.
    if (t - lastPromote < PERF.PROMOTE_S * 1000) return
    if (t - lastDemote < PERF.AFTER_DEMOTE_S * 1000) return
    // Promotion asks for the *design* cost, not merely the degrade threshold: a tier that is only
    // just inside its own budget has nothing left to pay for the extra work promotion brings.
    var target = (p < PERF.HIGH_P95 && cores() >= PERF.HIGH_CORES) ? 'HIGH' : 'MED'
    if (rank(target) > rank(tier) && ownCost.p95 < BUDGET.DRAW_MS) {
      setTierInternal(target, t)
      lastPromote = t
    }
  }

  function rank (name) { return TIER_ORDER.indexOf(name) }
  function demoteName () {
    var i = rank(tier)
    return TIER_ORDER[i > 0 ? i - 1 : 0]
  }

  // A lower segCap never deletes hyphae the player has already earned — targetFor() clamps future
  // growth and growNetwork() simply stops asking. Trimming the network back would make the picture
  // lie about the size of the thing, which is the one thing this canvas exists not to do.
  function setTierInternal (name, t) {
    if (!TIERS[name] || name === tier) return
    var before = TIERS[tier].dpr
    var wasRank = rank(tier)
    tier = name
    if (rank(name) < wasRank) lastDemote = t
    if (TIERS[name].dpr !== before) resize()
    invalidate()
  }

  // BIBLE §6 M17: HIGH | MED | LOW | FLOOR. 06 §7.8 spells MED as MID; both are taken, and AUTO
  // hands control back to the rolling p95.
  function setTier (t) {
    var name = ('' + t).toUpperCase()
    if (name === 'MID') name = 'MED'
    if (name === 'AUTO') {
      manualTier = false
      badSince = 0
      return tier
    }
    if (!TIERS[name]) return tier
    manualTier = true
    var prev = tier
    tier = name
    if (TIERS[name].dpr !== TIERS[prev].dpr) resize()
    invalidate()
    return tier
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — returns [] when healthy
  // ───────────────────────────────────────────────────────────────────────────

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }

    var W = 360, H = 296

    // 1 · determinism from the seed. Two nets built independently from the same seed must be
    // bit-identical, and the (seed, n) regeneration path must reproduce a live network exactly.
    var a = newNet(0x9E3779B9, W, H)
    var b = newNet(0x9E3779B9, W, H)
    var steps = 60
    for (var i = 0; i < steps; i++) { grow(a); grow(b) }
    ok(a.n === b.n, 'determinism: node counts diverged (' + a.n + ' vs ' + b.n + ')')
    var same = true
    for (var j = 0; j < a.n && same; j++) {
      if (a.x[j] !== b.x[j] || a.y[j] !== b.y[j] || a.par[j] !== b.par[j] || a.gen[j] !== b.gen[j]) {
        same = false
        f.push('determinism: node ' + j + ' differs between two runs of the same seed')
      }
    }
    ok(a.n > 200, 'growth: only ' + a.n + ' nodes after ' + steps + ' steps; the frontier is starving')

    // Grouping of grow() calls into frames must not change the result: the live path calls grow()
    // opportunistically, the load path calls it in a tight loop, and they must agree.
    var c = regenerate(0x9E3779B9, W, H, a.n, 0)
    ok(c.n === a.n, 'regenerate: reached ' + c.n + ' of ' + a.n)
    var reg = true
    for (var k = 0; k < a.n && reg; k++) {
      if (c.x[k] !== a.x[k] || c.y[k] !== a.y[k] || c.par[k] !== a.par[k]) {
        reg = false
        f.push('regenerate: node ' + k + ' differs from the live network')
      }
    }

    var d = newNet(0x12345678, W, H)
    for (var m = 0; m < steps; m++) grow(d)
    var differs = false
    for (var q = 1; q < Math.min(d.n, a.n); q++) if (d.x[q] !== a.x[q]) { differs = true; break }
    ok(differs, 'determinism: two different seeds produced the same network')

    // 2 · geometry. Every node hangs off its parent at a plausible segment length and stays on or
    // near the plate; a node adrift means the hash or the jitter is wrong.
    var maxSeg = 0, offPlate = 0
    for (var g = 1; g < a.n; g++) {
      var p = a.par[g]
      if (p < 0) { f.push('geometry: node ' + g + ' has no parent'); break }
      var dx = a.x[g] - a.x[p], dy = a.y[g] - a.y[p]
      var L = Math.sqrt(dx * dx + dy * dy)
      if (L > maxSeg) maxSeg = L
      if (a.x[g] < -GROW.SEG || a.x[g] > W + GROW.SEG || a.y[g] < -GROW.SEG || a.y[g] > H + GROW.SEG) offPlate++
    }
    ok(maxSeg <= GROW.SEG_BOOT + 1e-3, 'geometry: a segment is ' + maxSeg + ' px, above SEG_BOOT')
    ok(offPlate === 0, 'geometry: ' + offPlate + ' nodes left the plate')
    ok(a.par[0] === -1 && a.gen[0] === 0, 'geometry: the seed node is not the root')
    ok(Math.abs(a.x[0] - W / 2) < 1e-6 && Math.abs(a.y[0] - (H - GROW.SEED_INSET)) < 1e-6,
      'geometry: the inoculation point is not at bottom-centre')

    // 3 · the growth budget. A full step must stay inside GROW_MS, and a whole frame's worth of
    // growth inside FRAME_MS, or the canvas becomes the reason a frame is dropped.
    var e = newNet(0x0BADC0DE, W, H)
    for (var w = 0; w < 30; w++) grow(e)      // warm the frontier and the hash before measuring
    var worst = 0, totalMs = 0, N = 120
    for (var s = 0; s < N; s++) {
      var t0 = nowMs()
      grow(e)
      var el = nowMs() - t0
      totalMs += el
      if (el > worst) worst = el
    }
    var avg = totalMs / N
    ok(avg <= BUDGET.GROW_MS,
      'budget: mean grow() is ' + avg.toFixed(3) + ' ms, over the ' + BUDGET.GROW_MS + ' ms budget')
    ok(worst <= BUDGET.FRAME_MS,
      'budget: worst grow() is ' + worst.toFixed(3) + ' ms, over the ' + BUDGET.FRAME_MS + ' ms frame cap')

    // 4 · the caps hold. Nothing may exceed CAP, the frontier ring, or the attractor pool.
    var big = regenerate(0x51ACE, W, H, GROW.CAP + 500, 0)
    ok(big.n <= GROW.CAP, 'cap: the network grew past CAP (' + big.n + ')')
    // Reaching the cap is the proof that growth never permanently stalls: if the attractor pool
    // could be exhausted by bypassed points, this run would stop short and the plate would freeze
    // half-grown for the rest of the act.
    ok(big.n === GROW.CAP, 'growth: stalled at ' + big.n + ' of ' + GROW.CAP + ' nodes')
    ok(big.fCount <= GROW.FRONTIER, 'cap: the frontier ring overflowed')
    ok(big.aCount <= GROW.A0_MAX, 'cap: the attractor pool overflowed')
    var live = 0
    for (var fi = 0; fi < GROW.FRONTIER; fi++) {
      var ni = big.frontier[fi]
      if (fi < big.fCount && ni >= 0 && big.fslot[ni] === fi) live++
    }
    ok(live === big.fCount, 'frontier: ' + live + ' of ' + big.fCount + ' slots are self-consistent')

    // 5 · targets. Cold boot is one visible stroke; the tier cap is honoured.
    var was = tier, wasManual = manualTier
    setTier('HIGH')
    ok(targetFor(0) === GROW.MIN_TARGET, 'target: cold boot must ask for ' + GROW.MIN_TARGET + ' nodes')
    ok(targetFor(100) === 200, 'target: 100 m must ask for 200 nodes, got ' + targetFor(100))
    ok(targetFor(1e9) === TIERS.HIGH.segCap, 'target: HIGH did not clamp to its segCap')
    setTier('LOW')
    ok(targetFor(1e9) === TIERS.LOW.segCap, 'target: LOW did not clamp to its segCap')
    setTier('FLOOR')
    // Even the floor draws something. "Never nothing" is the whole contract of the static frame.
    ok(targetFor(0) >= GROW.MIN_TARGET && TIERS.FLOOR.segCap > 0,
      'target: FLOOR must still ask for a visible network')
    ok(setTier('MID') === 'MED', "setTier: 06's MID must alias BIBLE's MED")
    ok(setTier('nonsense') === 'MED', 'setTier: an unknown tier must be ignored')
    setTier('AUTO')
    ok(manualTier === false, 'setTier: AUTO must hand control back to the p95')
    // Restored through the public setter so the backing store is resized back with it; a
    // self-test that leaves the surface at the wrong dpr is a self-test that broke the game.
    setTier(was)
    if (!wasManual) setTier('AUTO')

    // 6 · the tier table agrees with core, and the tier ladder is ordered.
    if (C()) {
      ok(TIERS.MED.fluxHz === C().TUNE.CLOCK.CANVAS_HZ,
        'tier: the default flux rate must equal TUNE.CLOCK.CANVAS_HZ')
      ok(GROW.CAP >= TIERS.HIGH.segCap, 'cap: CAP is below the HIGH tier segCap')
    }
    for (var ti = 1; ti < TIER_ORDER.length; ti++) {
      ok(TIERS[TIER_ORDER[ti]].segCap > TIERS[TIER_ORDER[ti - 1]].segCap, 'tier: segCap is not monotone')
    }

    // 7 · helpers.
    ok(bucketOf(0) === 0 && bucketOf(5) === 0 && bucketOf(6) === 1 && bucketOf(15) === 1 &&
       bucketOf(16) === 2 && bucketOf(255) === 2, 'bucketOf: the generation buckets are wrong')
    ok(segLen(0) === GROW.SEG_BOOT && segLen(1000) === GROW.SEG &&
       segLen(80) > GROW.SEG && segLen(80) < GROW.SEG_BOOT, 'segLen: the 9 → 4.2 lerp is wrong')
    ok(hash01(1, 2) === hash01(1, 2) && hash01(1, 2) !== hash01(1, 3), 'hash01 is not a stable stream')
    var h1 = hash01(9, 9)
    ok(h1 >= 0 && h1 < 1, 'hash01 is out of range')
    var pc = parseColor('#E8E1D3', null)
    ok(pc && pc[0] === 232 && pc[1] === 225 && pc[2] === 211, 'parseColor: six-digit hex')
    var pc2 = parseColor('#abc', null)
    ok(pc2 && pc2[0] === 170 && pc2[1] === 187 && pc2[2] === 204, 'parseColor: three-digit hex')
    var pc3 = parseColor('rgb(1, 2, 3)', null)
    ok(pc3 && pc3[0] === 1 && pc3[2] === 3, 'parseColor: rgb()')
    ok(parseColor('', 'fb') === 'fb', 'parseColor: empty must fall through to the fallback')
    ok(clamp01(2) === 1 && clamp01(-1) === 0 && clamp01(NaN) === 0, 'clamp01')

    // 7b · the release. Every claim the verb makes about this surface, checked against the
    // envelope: a tap goes somewhere, a ripe hold goes further, the push never retracts, and the
    // whole thing is over inside its own budget. The rest of the module is stateless about it, so
    // the state it does keep is put back exactly as it was found.
    var wasSurge = surge
    var t0s = nowMs()
    surge = { at: t0s, adv: FLUX.SURGE_PX }
    var tapPush = surgeAt(t0s + FLUX.SURGE_RISE)
    surge = { at: t0s, adv: FLUX.SURGE_PX + FLUX.SURGE_SPAN }
    var ripePush = surgeAt(t0s + FLUX.SURGE_RISE)
    ok(tapPush && tapPush.d > 0, 'surge: a release with no hold must still push the front somewhere')
    ok(ripePush && ripePush.d > tapPush.d * 2,
      'surge: a ripe hold must visibly out-travel a tap, not merely beat it')
    var early = surgeAt(t0s + FLUX.SURGE_RISE * 0.5)
    ok(early && early.d < ripePush.d && early.d > 0, 'surge: the push does not travel over the rise')
    var late = surgeAt(t0s + FLUX.SURGE_RISE + FLUX.SURGE_FALL * 0.5)
    ok(late && late.d >= ripePush.d - 1e-9, 'surge: the push retracted — a hypha never does')
    ok(late && late.a < 1 && late.a > 0, 'surge: the ink did not fall away over the settle')
    ok(surgeAt(t0s + FLUX.SURGE_RISE + FLUX.SURGE_FALL) === null && surge === null,
      'surge: a push outlived its own envelope')
    surge = wasSurge

    // 8 · the transitions. Every `motion` step log.js can emit is either owned here or is DOM, and
    // the durations this module reports have to agree with the clock 09 §4 and §5 authored — a
    // wave that outlives its own cut is a transition with a seam in it.
    var seqs = HY.log && HY.log.SEQUENCES ? HY.log.SEQUENCES : null
    var DOM_STEPS = { panelsFade: 1, collapseList: 1, dimExcept: 1, closePanel: 1,
      reduceToButton: 1, addSpore: 1, clearScreen: 1 }
    if (seqs) {
      var sk
      for (sk in seqs) {
        if (!Object.prototype.hasOwnProperty.call(seqs, sk)) continue
        var lists = [seqs[sk].steps, seqs[sk].reduced]
        for (var li = 0; li < lists.length; li++) {
          if (!lists[li]) continue
          for (var si = 0; si < lists[li].length; si++) {
            var stp = lists[li][si]
            if (stp.kind !== 'motion') continue
            var what = stp.payload.what
            var got = motion(what, stp.payload)
            ok(got !== null || DOM_STEPS[what] === 1,
              'motion: ' + sk + "'s " + what + ' is neither drawn here nor a DOM step')
            if (got === null) continue
            // The next motion is when the plate changes hands — a word or a line lands on top of
            // whatever is drawn and does not take it — so that is the slot. A motion may not run
            // past its slot, EXCEPT into a cut: a cut is allowed to take the stragglers, which is
            // exactly what 09 §4.2 asks for when it lifts hexes on a 400 ms stagger over 1,600 ms
            // and then goes black at 1,600.
            var next = null, nextWhat = '', sj
            for (sj = si + 1; sj < lists[li].length; sj++) {
              if (lists[li][sj].kind !== 'motion' || lists[li][sj].at <= stp.at) continue
              next = lists[li][sj].at
              nextWhat = lists[li][sj].payload.what
              break
            }
            if (next !== null && nextWhat !== 'cut') {
              ok(got <= (next - stp.at) * 1000 + 1,
                'motion: ' + sk + "'s " + what + ' runs ' + got + ' ms into a ' +
                Math.round((next - stp.at) * 1000) + ' ms slot')
            }
          }
        }
      }
      stopMotion()
      ok(motion('nothingLikeThis') === null, 'motion: an unknown name must answer null')
      ok(motion('fillWhite', { ms: 2600 }) === 2600, 'motion: fillWhite ignored its payload ms')
      ok(motionActive() === true, 'motion: a started motion is not active')
      ok(stopMotion() === true && motionActive() === false, 'motion: stopMotion did not release')
      // The four beats 09 §4.2 times to the second, derived rather than tabulated.
      ok(motion('mapDrain', { fromRing: 4, toRing: 0, perRingMs: 700 }) === 2800,
        'motion: the ASCOSPORE drain is not 2.8 s')
      ok(motion('hexLift', { alphaMs: 1600, staggerMs: [0, 400] }) === 2000,
        'motion: the hex lift is not 2.0 s including its stagger')
      stopMotion()
    }
    // Every motion must survive being drawn with no state, no map and no wheel behind it: a
    // transition that throws is a game that stops on the one screen with no way back.
    try {
      for (var mn in MOTIONS) {
        if (!Object.prototype.hasOwnProperty.call(MOTIONS, mn)) continue
        motion(mn, {})
        drawMotion(nowMs())
        drawMotion(nowMs() + 1e6)
      }
      stopMotion()
    } catch (merr) {
      f.push('motion: ' + (merr && merr.message ? merr.message : merr))
      stopMotion()
    }
    ok(Math.abs(wrapPi(Math.PI * 2.5) - Math.PI * 0.5) < 1e-9, 'wrapPi does not fold to ±π')
    ok(Math.abs(wrapPi(-Math.PI * 2.5) + Math.PI * 0.5) < 1e-9, 'wrapPi is not symmetric')

    // 9 · the surface exists in full, and nothing throws without a DOM or without data.
    var api = ['growNetwork', 'drawNet', 'ageWash', 'drawMap', 'drawVoid', 'drawWheel',
               'drawForecast', 'setTier', 'drawFlux', 'init', 'motion', 'motionActive',
               'stopMotion']
    for (var ai = 0; ai < api.length; ai++) {
      ok(typeof HY.canvas[api[ai]] === 'function', 'surface: ' + api[ai] + ' is missing')
    }
    try {
      drawMap(null); drawVoid(null); drawWheel(null); drawForecast(null); ageWash()
    } catch (err) {
      f.push('surface: a draw call with no data threw: ' + (err && err.message ? err.message : err))
    }

    return f
  }

  // ───────────────────────────────────────────────────────────────────────────

  HY.canvas = {
    // BIBLE §6 M17
    growNetwork: growNetwork,
    drawNet: drawNet,
    ageWash: ageWash,
    drawMap: drawMap,
    drawVoid: drawVoid,
    drawWheel: drawWheel,
    drawForecast: drawForecast,
    setTier: setTier,

    // The act transitions and the endings (09 §4, §5). `motion` answers the duration in ms of a
    // step it owns and null for one it does not, so the sequence host can route a `motion` step
    // without keeping its own list of which ones are drawn and which are DOM.
    motion: motion,
    motionActive: motionActive,
    stopMotion: stopMotion,
    MOTIONS: MOTIONS,

    // The release. ui.js calls this at the instant a charge lifts and an extension was actually
    // paid for, with the same 0…1 pressure the button drew and the floor priced.
    surge: surgeRelease,

    // §6's generic module surface, plus the flux pass ui.js drives from the one rAF.
    init: init,
    drawFlux: drawFlux,
    resize: resize,
    invalidate: invalidate,

    get tier () { return tier },
    get nodes () { return net ? net.n : 0 },
    get frameP95 () { return frames.p95 },
    get costP95 () { return ownCost.p95 },
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
