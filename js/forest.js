;(function (HY) {
  'use strict'

  // M9 · forest.js — Act II biology (BIBLE §6 M9).
  //
  // Owns: the litter and standing-timber stocks of the 61 regions, litterfall, tree growth dT/dt,
  // humus dh/dt, the Retention dial ρ, per-region decomposition, live mycorrhizal interface, fire,
  // necrotrophy, the LEGACY computation, and ASCOSPORE DISCHARGE.
  //
  // Does NOT own: the map's shape (world.js writes q/r/terrain/species/barriers/rivals), the weather
  // (flush.js owns the OU walk; this file only reads it), pacts (pactbook.js), Signal (cognition.js).
  // Every one of those is read lazily and feature-detected, so this module runs alone in a harness
  // and runs in the build.
  //
  // The act's whole shape lives here. `decomp ∝ L`, `L` is a stock you are draining, and the only
  // way to refill it is to kill the trees that are also your Signal. Nothing below keys off elapsed
  // time or off `forestConsumed`: the production curve rises because the enzyme coefficient grows,
  // and falls because the stock it multiplies runs out. The decline is what the equations do.
  //
  // Numbers that cross a module boundary are in `HY.core.TUNE.A2`. What lives below is the terrain
  // and species table of `02` §6.4–6.5 and the shape coefficients of `02` §9 — one table that no
  // other module reads, and that moves as a unit or not at all.

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

  function fire (id, tokens) { if (HY.log && HY.log.logFire) HY.log.logFire(id, tokens) }
  function fireLater (id, delay, tokens) {
    if (HY.log && HY.log.logLater) HY.log.logLater(id, delay, tokens)
  }
  function feel (ev, params) { if (HY.feel && HY.feel.feel) HY.feel.feel(ev, params) }

  // §3 a2.regions.flags bit assignments. world.js writes bits 0–3; bits 4–6 are written here.
  var RF_DISCOVERED = 1
  var RF_CLAIMED = 4
  var RF_NECROTIZED = 16
  var RF_RHOPINNED = 32
  var RF_QUIET = 64

  // ───────────────────────────────────────────────────────────────────────────
  // DATA TABLES — `02` §6.4, §6.5, §9
  // ───────────────────────────────────────────────────────────────────────────

  var LOAM = 0, SAND = 1, CLAY = 2, SCREE = 3, PEAT = 4, BURN = 5
  var BIRCH = 2

  // `02` §6.4. `h0` is not in that table: it is the humus a stand carries before you have touched
  // it, and it is the terrain's whole personality in one number — peat *is* humus, scree has none,
  // and a burn scar starts on its own ash. `damp` is Clay's "Δm from W is halved".
  var TERRAIN = [
    { name: 'Loam', litterMod: 1.00, zeta: 1.00, moistOff: 0.00, mineralMod: 1.00, fireMod: 1.0, h0: 0.62, damp: 1.00 },
    { name: 'Sand', litterMod: 0.55, zeta: 1.35, moistOff: -0.22, mineralMod: 0.60, fireMod: 1.8, h0: 0.34, damp: 1.00 },
    { name: 'Clay', litterMod: 1.25, zeta: 0.70, moistOff: 0.18, mineralMod: 1.15, fireMod: 0.7, h0: 0.55, damp: 0.50 },
    { name: 'Scree', litterMod: 0.25, zeta: 1.60, moistOff: -0.10, mineralMod: 3.00, fireMod: 1.2, h0: 0.30, damp: 1.00 },
    { name: 'Peat', litterMod: 2.20, zeta: 0.55, moistOff: 0.34, mineralMod: 0.75, fireMod: 2.4, h0: 0.95, damp: 1.00 },
    { name: 'Burn', litterMod: 0.35, zeta: 1.10, moistOff: -0.06, mineralMod: 1.40, fireMod: 0.3, h0: 0.45, damp: 1.00 }
  ]

  // `02` §6.5. The whole species system is the opposition of `decompF` and `yieldF`: fast stands are
  // shallow, slow stands are deep.
  var SPECIES = [
    { name: 'Oak', lignin: 1.38, kappa: 0.85, litterMod: 1.15, canopy: 0.90 },
    { name: 'Beech', lignin: 1.20, kappa: 1.00, litterMod: 1.05, canopy: 0.98 },
    { name: 'Birch', lignin: 0.78, kappa: 0.72, litterMod: 0.70, canopy: 0.62 },
    { name: 'Pine', lignin: 1.45, kappa: 1.10, litterMod: 0.85, canopy: 0.75 },
    { name: 'Hemlock', lignin: 1.30, kappa: 0.94, litterMod: 0.95, canopy: 1.00 }
  ]

  // `02` §9's shape coefficients. Each pair is an intercept and a slope on a 0–1 quantity, so the
  // reader can see the endpoints without evaluating anything.
  var DECOMPF_A = 1.55, DECOMPF_B = 0.62      // decompF = 1.55 − 0.62·lignin ∈ [0.65, 1.07]
  var YIELDF_A = 0.70, YIELDF_B = 0.42        // yieldF  = 0.70 + 0.42·lignin ∈ [1.03, 1.31]
  var MOIST_A = 0.10, MOIST_B = 3.60          // moistureF is a HUMP: 0.10 + 3.60·m·(1−m), peak 1.00
  // humusF = 0.50 + 0.50·h. The endpoint at h = 1 is fixed by KAPPA's calibration and does not
  // move; the *intercept* does, and it is the act's middle hour. Measured over five seeds, every
  // claimed stand's humus settles near 0.03 under the default TAKE dial — the equilibrium
  // dec·ρ·HUMUS_IN/(HUMUS_SCALE_F·L0·out) is 0.03 at ρ = 0.10 whatever the enzyme suite — so the
  // old 0.45 intercept was not the bottom of a range the player travels, it was the coefficient
  // the whole act ran at, from the first claim to ASCOSPORE. 0.50 is as far as it can move and
  // leave D18's margin intact: the intercept lifts the floor of the curve, and the ratio between
  // the act's peak and its tenth percentile is exactly what D18 measures, so the two pull opposite
  // ways and the arc arbitrates. Measured, 0.50 leaves that ratio at 2.57 against a gate of 2.50.
  var HUMUSF_A = 0.50, HUMUSF_B = 0.50
  var GROW_A = 0.25, GROW_B = 0.75            // growth's humus bracket
  var FALL_A = 0.55, FALL_B = 0.45            // litterfall's humus bracket
  var IFACE_T_EXP = 0.60                      // (T/T0)^0.60 — trees degrade gracefully
  var IFACE_PACT = 0.50                       // ×(1 + 0.50) while the stand is under a pact
  var MORT_TO_LITTER = 0.92                   // of everything that dies, this much becomes litter
  // …and of everything a fire kills standing, this much falls as charred wood. Fire is lossy — the
  // fine fuel goes up as smoke (IGNITE_L) — but a burnt stand is not a hole in the world, it is a
  // pile of scorched timber on a bare floor. Measured, the old reading (the killed 70% simply
  // ceased to exist) deleted 0.5–1.6e12 g of the act's 4.00e12 g budget depending only on how many
  // stands happened to ignite, which is 14 on one seed and 27 on the next: the single largest
  // source of the 85-minute spread in Act II's length, and the one thing in the act the player
  // could neither see nor price.
  var FIRE_TO_LITTER = 0.55
  var PEAT_DECOMP = 0.45                      // peat is a larder you cannot open …
  var PEAT_AERENCHYMA = 0.95                  // … until you can breathe through the water
  var SCREE_T0 = 0.35                         // "no trees above ring 2"
  var SCREE_RING = 3

  // `02` §9.6 states the consequence rather than the exponent: a stand under necrotrophy is at
  // canopy 0.15 within 20 minutes. Twenty minutes of NECRO_RATE leaves T/T0 = e^(−0.00085·1200) =
  // 0.360, and 0.9·0.360^x = 0.15 solves at x = 1.75. The exponent is that sentence, inverted.
  var CANOPY_EXP = 1.75

  // Fire, `02` §9.5. The rates themselves are TUNE (FIRE_ACC/DEC/TRIG/P); these are the predicate.
  var FIRE_DRY_M = 0.26                       // m below which a low-humus stand is dry
  // ×(1 − 0.85·canopy): shade keeps the litter damp. `02` §9.5 makes fire the punishment for a
  // mined floor, and a mined floor is one you have stripped — but at 0.55 a stand with its canopy
  // fully intact still accrued risk at half rate, and humus falls below HUMUS_FIRE on every claimed
  // stand at once around minute 45 whatever the player does, so ten to thirteen live stands burned
  // in the same fifty-minute window on every seed. That window is where the interface peaks, and
  // each burn takes 70% of a stand's trees with it, so the act's Signal curve was being flattened
  // at its maximum by an event the player had no way to be responsible for. At 0.85 a living
  // canopy is nearly proof against fire and a killed one is not: fire arrives after the stand does,
  // which is the sentence the design already wrote.
  var FIRE_CANOPY = 0.85
  // A neighbour at this risk catches. 0.55 was below the level the whole board sits at once humus
  // has been mined out, so one ignition took its entire neighbourhood and the count of burnt stands
  // was a cascade length rather than a number of accidents. 0.70 is 0.15 under FIRE_TRIG: a
  // neighbour catches when it was nearly going to ignite on its own, which is what a wavefront is.
  var FIRE_SPREAD_RISK = 0.70
  var FIRE_SLOW = 2.0                         // s — fire is evaluated at 0.5 Hz, not every tick
  var FIRE_MAX_DT = 60                        // s — the most risk one offline macro-step may accrue
  var IGNITE_L = 0.15, IGNITE_T = 0.30, IGNITE_D = 0.25, IGNITE_H = 0.45
  var IGNITE_BIRCH = 0.60                     // pioneer succession: the mix is rebalanced this far
  var FIRE_AFTER_S = 600                      // s until the stand is spoken of again

  // The Retention dial, `02` §9.3. The detents are TAKE · HOLD · FEED; the default is TAKE, which is
  // why the first stand's humus falls and why `humic_retention` is failure detection rather than a
  // reward. RHO_QUIET is what The Quiet Ring pins rings 0–1 to.
  var RHO_DEFAULT = 0.10
  var RHO_QUIET = 0.60
  var HOMEO_GAIN = 2.20                       // Homeostatic Soil's proportional gain on (h* − h)

  // Deep Substrate Hyphae ("+litter"): older wood, once, in every stand you hold.
  var DEEP_LITTER = 0.35                      // × L0, added on the tick the project lands
  var DEEP_DONE = 2                           // the flag value that records the injection happened

  var ARMILLARIA = 1                          // rival strain id (`02` §8.2), the one that eats trees
  var ARM_PRESSURE = 4.0e-4                   // /s at rivalStr 1 — 0.47× necrotrophy, and unchosen

  var HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
  var RING_SIZE = [1, 6, 12, 18, 24]          // the 61-hex spiral, used only when world.js is absent


  // ───────────────────────────────────────────────────────────────────────────
  // THE DERIVED GROWTH COEFFICIENT
  // ───────────────────────────────────────────────────────────────────────────

  // `02` §9.2's load-bearing claim is that humus is the switch between a renewable stand and a mine
  // at h ≈ 0.28 — TUNE.A2.HUMUS_SWITCH. That switch is where growth exactly cancels litterfall for a
  // pristine, fully colonised, fully compatible stand:
  //
  //   TREE_G·(GROW_A + GROW_B·hs)·(1 − 1/TMAX_MULT)·(1 + K) = LAMBDA·(FALL_A + FALL_B·hs)
  //
  // so the mycorrhizal bonus coefficient K is not a free number, it is whatever makes that identity
  // hold given the five TUNE constants around it. Deriving it rather than writing 0.75 is what keeps
  // the switch on the number the rest of the build (projects, log, the ρ dial) is written against.
  var mycoK = -1
  function MYCO_K () {
    if (mycoK >= 0) return mycoK
    var a = A()
    var hs = a.HUMUS_SWITCH
    var grow = a.TREE_G * (GROW_A + GROW_B * hs) * (1 - 1 / a.TMAX_MULT)
    var fall = a.LAMBDA * (FALL_A + FALL_B * hs)
    mycoK = grow > 0 ? Math.max(0, fall / grow - 1) : 0
    return mycoK
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE STATE
  // ───────────────────────────────────────────────────────────────────────────

  // §3 stores L and T as Float32Array, which is right for the save (4 KB base64 for the whole board)
  // and wrong for the arithmetic: litterfall is ~1e-9 of T per second, twelve hundred times below a
  // float32 ulp, so integrating in the stored array would round every gram of it away and freeze the
  // living forest solid. The stored arrays stay the truth for everyone else; these shadows carry the
  // sub-ulp remainder between ticks and are re-seeded whenever another module writes the real one.
  var Lf = null, Tf = null
  var dec = null              // g/s per region, last tick's decomposition — see stepHumus
  var spread = []             // fire wavefront: { i, at } — resolves inside one slow tick
  var fireAt = 0              // sim time of the next fire evaluation; keyed to s.t so it cannot
                              // double-run if step 11 ever calls stepFire as well as step 4
  var ringCache = null
  var nreg = 0
  var quietDone = false

  function alloc (s) {
    var n = s.a2.regions.L.length
    nreg = n
    Lf = new Float64Array(n)
    Tf = new Float64Array(n)
    dec = new Float64Array(n)
    ringCache = null
    var i
    for (i = 0; i < n; i++) { Lf[i] = s.a2.regions.L[i]; Tf[i] = s.a2.regions.T[i] }
  }

  function syncIn (s) {
    var r = s.a2.regions, i
    if (!Lf || Lf.length !== r.L.length) alloc(s)
    for (i = 0; i < nreg; i++) {
      // Anyone else's write lands in the float32 array; ours round-trips through fround exactly.
      if (r.L[i] !== Math.fround(Lf[i])) Lf[i] = r.L[i]
      if (r.T[i] !== Math.fround(Tf[i])) Tf[i] = r.T[i]
    }
  }

  function syncOut (s) {
    var r = s.a2.regions, i
    for (i = 0; i < nreg; i++) { r.L[i] = Lf[i]; r.T[i] = Tf[i] }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GEOMETRY AND THE PER-REGION SHAPE
  // ───────────────────────────────────────────────────────────────────────────

  function ringOf (s, i) {
    if (!ringCache) {
      var r = s.a2.regions, k, any = false
      for (k = 0; k < r.q.length; k++) if (r.q[k] || r.r[k]) { any = true; break }
      ringCache = new Uint8Array(r.q.length)
      for (k = 0; k < r.q.length; k++) {
        if (any) {
          ringCache[k] = (Math.abs(r.q[k]) + Math.abs(r.r[k]) + Math.abs(r.q[k] + r.r[k])) / 2
        } else {
          // No worldgen in the build: index bands reproduce the same 1·6·12·18·24 spiral, so the
          // ring multiplier — and therefore ΣL0 and ΣT0 — is right either way.
          var acc = 0, ring = 0
          for (ring = 0; ring < RING_SIZE.length; ring++) {
            acc += RING_SIZE[ring]
            if (k < acc) break
          }
          ringCache[k] = Math.min(ring, RING_SIZE.length - 1)
        }
      }
    }
    return ringCache[i]
  }

  // The species mix, as the two ids and the weight §3 stores. A weight of zero means world.js has
  // not spoken yet, and a single-species stand is the honest reading of that.
  function mixW (s, i) {
    var w = num(s.a2.regions.w0[i])
    if (!(w > 0)) return 1
    return C().clamp(w, 0, 1)
  }

  function speciesTerm (s, i, key) {
    var r = s.a2.regions
    var w = mixW(s, i)
    var a = SPECIES[r.sp0[i] % SPECIES.length]
    var b = SPECIES[r.sp1[i] % SPECIES.length]
    return w * a[key] + (1 - w) * b[key]
  }

  function ligninOf (s, i) { return speciesTerm(s, i, 'lignin') }
  function kappaOf (s, i) { return speciesTerm(s, i, 'kappa') }
  function decompFOf (s, i) { return DECOMPF_A - DECOMPF_B * ligninOf(s, i) }
  function yieldFOf (s, i) { return YIELDF_A + YIELDF_B * ligninOf(s, i) }
  function terrainOf (s, i) { return TERRAIN[s.a2.regions.terrain[i] % TERRAIN.length] }

  // Canopy is the stand's shade, and shade is a property of the living trees: killing a stand takes
  // its canopy with it, which is why necrotrophy costs fruiting and fire safety as well as Signal.
  function canopy (i, st) {
    var s = st || S()
    var r = s.a2.regions
    var t0 = num(r.T0[i])
    if (!(t0 > 0)) return 0
    var frac = C().clamp(num(r.T[i]) / t0, 0, 1)
    return speciesTerm(s, i, 'canopy') * Math.pow(frac, CANOPY_EXP)
  }

  // ΣL0 and ΣT0 are fixed by TUNE; the per-region numbers are shapes that get renormalised onto
  // those totals. That is the whole reason forest.js and not world.js writes L0/T0: the map may be
  // any shape at all and the act's budget still has to come out at EXTRACT_TARGET.
  function seed (s) {
    var r = s.a2.regions, a = A(), i, n = r.L0.length
    var shapeL = new Float64Array(n), shapeT = new Float64Array(n)
    var sumL = 0, sumT = 0
    for (i = 0; i < n; i++) {
      var ring = ringOf(s, i)
      var rm = 1 + a.RING_MULT * ring
      var ter = terrainOf(s, i)
      var l = a.LITTER_BASE * rm * ter.litterMod * speciesTerm(s, i, 'litterMod')
      var t = a.STANDING_BASE * rm
      if (r.terrain[i] === SCREE && ring >= SCREE_RING) t *= SCREE_T0
      shapeL[i] = l; shapeT[i] = t
      sumL += l; sumT += t
    }
    var kL = sumL > 0 ? a.L0_TOTAL / sumL : 0
    var kT = sumT > 0 ? a.T0_TOTAL / sumT : 0
    for (i = 0; i < n; i++) {
      r.L0[i] = shapeL[i] * kL
      r.T0[i] = shapeT[i] * kT
      r.L[i] = r.L0[i]
      r.T[i] = r.T0[i]
      r.h[i] = terrainOf(s, i).h0
      r.rho[i] = RHO_DEFAULT
    }
  }

  function seeded (s) {
    var r = s.a2.regions, i, t = 0
    for (i = 0; i < r.L0.length; i++) t += r.L0[i]
    return t > 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ENVIRONMENT — read, never written
  // ───────────────────────────────────────────────────────────────────────────

  // flush.js owns the OU walk (`05` §0.1: one process, two consumers). This is the fallback for a
  // build that has not concatenated it yet, and the per-region offset either way.
  function moistureAt (i, st) {
    var s = st || S()
    if (HY.flush && HY.flush.moistureAt) {
      var m = num(HY.flush.moistureAt(i))
      if (m > 0) return C().clamp(m, 0, 1)
    }
    var a = A()
    var W = num(s.a2.W)
    var ter = terrainOf(s, i)
    // Clay damps the weather: it is the only terrain that is safe in a drought.
    var w = a.OU_MEAN + (W - a.OU_MEAN) * ter.damp
    return C().clamp(w + ter.moistOff, 0, 1)
  }

  function moistureF (m) { return MOIST_A + MOIST_B * m * (1 - m) }
  function humusF (h) { return HUMUSF_A + HUMUSF_B * h }

  function pactAt (i) {
    var p = HY.pactbook
    if (!p) return false
    if (p.regionHasPact) return !!p.regionHasPact(i)
    if (p.hasPact) return !!p.hasPact(i)
    return false
  }

  // PULSE's SURGE mode multiplies decomposition around its epicentre. cognition.js owns it.
  function surgeAt (i) {
    var g = HY.cognition
    if (g && g.surge) { var v = num(g.surge(i)); if (v > 0) return v }
    return 1
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE RETENTION DIAL
  // ───────────────────────────────────────────────────────────────────────────

  function rhoLocked (s) {
    var v = num(s.mult && s.mult.rhoLocked)
    return v > 0 ? v : 0
  }

  function rhoPins (s) {
    return A().RHO_PINS * (flagOn(s, 'homeostatic_soil') ? 2 : 1)
  }

  function pinnedCount (s) {
    var f = s.a2.regions.flags, i, n = 0
    for (i = 0; i < f.length; i++) if (f[i] & RF_RHOPINNED) n++
    return n
  }

  function rho (i, st) {
    var s = st || S()
    var lock = rhoLocked(s)
    if (lock > 0) return lock                       // The Armillaria Accord decides this now
    var r = s.a2.regions
    if (r.flags[i] & RF_QUIET) return RHO_QUIET
    var dial = C().clamp(num(r.rho[i]), 0, A().RHO_MAX)
    return dial + homeoOffset(s, i, dial)
  }

  // The global dial is not a stored scalar: it is the value every unpinned region carries. That is
  // one fewer key in §3 and it makes "pinned" mean exactly what the ◈ on the card says.
  function setRho (value, regionId) {
    var s = S()
    if (!s || !s.a2) return false
    var r = s.a2.regions
    if (rhoLocked(s) > 0) return false
    if (regionId === undefined || regionId === null) {
      var v = C().clamp(num(value), 0, A().RHO_MAX), i
      for (i = 0; i < r.rho.length; i++) if (!(r.flags[i] & RF_RHOPINNED)) r.rho[i] = v
      return true
    }
    if (!(regionId >= 0 && regionId < r.rho.length)) return false
    if (value === null) {                            // unpin: the region rejoins the global dial
      r.flags[regionId] &= ~RF_RHOPINNED
      r.rho[regionId] = globalRho(s)
      return true
    }
    if (!(r.flags[regionId] & RF_RHOPINNED) && pinnedCount(s) >= rhoPins(s)) return false
    r.flags[regionId] |= RF_RHOPINNED
    r.rho[regionId] = C().clamp(num(value), 0, A().RHO_MAX)
    return true
  }

  function globalRho (s) {
    var r = s.a2.regions, i
    for (i = 0; i < r.rho.length; i++) if (!(r.flags[i] & RF_RHOPINNED)) return num(r.rho[i])
    return RHO_DEFAULT
  }

  // Homeostatic Soil: the dial stops being a fraction and becomes a setpoint. It holds the switch,
  // which is the one value a player who has understood the act would hold it at anyway.
  //
  // It is an *offset read off h*, not a value written into r.rho, and that is the whole of the fix.
  // The old controller wrote its output into the same array `globalRho()` reads its input out of,
  // so `base` on tick n+1 was the controller's own output from tick n and the loop was a pure
  // integrator with no anti-windup. Whenever the setpoint was out of reach — which is most of the
  // second half, because h's equilibrium is dec·ρ·HUMUS_IN/(HUMUS_SCALE_F·L0·out) and there is very
  // little dec left — it wound to its ceiling and stayed. Measured: ρ ≈ 0.74 for the last 130
  // minutes of one seed, i.e. three quarters of everything decomposed put back into ground that
  // could not hold it, while `extracted` — the act's clock — took the other quarter. That seed ran
  // 283 minutes; the seed whose controller happened not to wind ran 198.
  //
  // Computed rather than stored, the dial the player set stays the dial the player set, the offset
  // falls back to zero the moment h reaches the switch, and there is no state to run away.
  //
  // Its authority stops at RHO_FLAT_MAX, the value TUNE names as the top of the range where
  // retention is nearly free in the short run. An automation may spend the free part of the dial;
  // giving back more than that is a decision with a visible price on it, and it stays the player's.
  function homeoOffset (s, i, dial) {
    if (!flagOn(s, 'homeostatic_soil')) return 0
    var r = s.a2.regions
    if (!(r.flags[i] & RF_CLAIMED) || (r.flags[i] & RF_RHOPINNED)) return 0
    var a = A()
    var want = C().clamp(dial + HOMEO_GAIN * (a.HUMUS_SWITCH - num(r.h[i])), 0, a.RHO_FLAT_MAX)
    return want > dial ? want - dial : 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 3 · SUPPLY — litterfall, tree growth, humus (BIBLE §4, before production)
  // ───────────────────────────────────────────────────────────────────────────

  function stepSupply (dt, o) {
    var s = S()
    if (!s || s.act !== 2 || !(dt > 0)) return
    if (!quietDone) applyQuietRing(s)
    syncIn(s)
    applyDeepLitter(s)
    stepLiving(dt, o, s)
    stepHumus(dt, o, s)
    syncOut(s)
  }

  // `02` §9.2. Growth is logistic against Tmax, gated by humus, and paid for by your own
  // partnership; the losses are litterfall, background mortality, whatever the rival is doing to the
  // roots, and — once you have chosen it — necrotrophy. Everything that dies becomes litter.
  function stepLiving (dt, o, st) {
    var s = st || S()
    var r = s.a2.regions, a = A(), i
    var K = MYCO_K()
    var necroRate = a.NECRO_RATE * mult(s, 'necroMult', 1)
    for (i = 0; i < nreg; i++) {
      var t = Tf[i]
      if (!(t > 0)) continue
      var t0 = num(r.T0[i])
      var h = num(r.h[i])
      var d = C().clamp(num(r.d[i]), 0, 1)
      var myco = 1 + K * d * kappaOf(s, i)
      var head = t0 > 0 ? 1 - t / (a.TMAX_MULT * t0) : 0
      var grow = a.TREE_G * t * (GROW_A + GROW_B * h) * head * myco
      var fall = t * a.LAMBDA * (FALL_A + FALL_B * h)
      var press = a.BASE_MORT
      if (r.rival[i] === ARMILLARIA) press += ARM_PRESSURE * C().clamp(num(r.rivalStr[i]), 0, 1)
      if (r.flags[i] & RF_NECROTIZED) press += necroRate
      var fallAmt = fall * dt
      var diedAmt = t * press * dt
      var loss = fallAmt + diedAmt
      if (loss > t) {                             // a stand cannot shed more than it is
        var k = t / loss
        fallAmt *= k; diedAmt *= k; loss = t
      }
      var next = t + grow * dt - loss
      Tf[i] = next > 0 ? next : 0
      // Litterfall lands whole; of what dies standing, MORT_TO_LITTER reaches the floor.
      Lf[i] += fallAmt + diedAmt * MORT_TO_LITTER
    }
  }

  // `02` §9.3. `dec[]` is last tick's decomposition, not this tick's: h moves at ~1e-4/s and the sim
  // ticks at 20 Hz, so the 50 ms of lag is six orders of magnitude below the quantity — and reading a
  // decomposition that has not happened yet would mean computing it twice, which is how the two
  // copies of a formula start.
  function stepHumus (dt, o, st) {
    var s = st || S()
    var r = s.a2.regions, a = A(), i
    for (i = 0; i < nreg; i++) {
      // A stand you have never touched is in balance with itself: its litterfall and its
      // mineralisation are the same organisms, and neither is yours. Humus only starts moving —
      // in either direction — once there is a fungus in it turning the carbon over. That is what
      // makes the soil the player's doing rather than the clock's.
      if (!(r.flags[i] & RF_CLAIMED)) continue
      var scale = a.HUMUS_SCALE_F * num(r.L0[i])
      if (!(scale > 0)) continue
      var p = rho(i, s)
      var hIn = dec[i] * p * a.HUMUS_IN / scale
      var out = a.HUMUS_OUT_A + a.HUMUS_OUT_B * (1 - p)
      if (r.terrain[i] === BURN) out *= 0.40        // charcoal holds soil: §9.5's "humus regen ×2.5"
      var h = num(r.h[i]) + (hIn - out * num(r.h[i])) * dt
      r.h[i] = C().clamp(h, 0, 1)
    }
  }

  // Deep Substrate Hyphae is "+85% yield, +litter". The yield is a `mult` key projects.js owns; the
  // litter is older wood surfacing, once, everywhere you are. The flag value records that it landed
  // so a reload cannot pour it a second time.
  function applyDeepLitter (s) {
    if (!s.proj || !s.proj.flags) return
    if (s.proj.flags.deep_substrate_hyphae !== 1) return
    var r = s.a2.regions, i
    for (i = 0; i < nreg; i++) if (r.flags[i] & RF_CLAIMED) Lf[i] += DEEP_LITTER * num(r.L0[i])
    s.proj.flags.deep_substrate_hyphae = DEEP_DONE
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 4 · PRODUCTION
  // ───────────────────────────────────────────────────────────────────────────

  // `02` §9.1, per claimed region, per second. Linear in the stock, which is the act.
  function decompOf (i, st) {
    var s = st || S()
    var r = s.a2.regions
    if (!(r.flags[i] & RF_CLAIMED)) return 0
    var L = Lf && Lf.length === nreg ? Lf[i] : num(r.L[i])
    if (!(L > 0)) return 0
    var a = A()
    var peat = 1
    if (r.terrain[i] === PEAT) peat = flagOn(s, 'aerenchyma') ? PEAT_AERENCHYMA : PEAT_DECOMP
    return a.KAPPA *
      mult(s, 'E', 1) *
      C().clamp(num(r.d[i]), 0, 1) *
      decompFOf(s, i) *
      moistureF(moistureAt(i, s)) *
      humusF(num(r.h[i])) *
      peat *
      surgeAt(i) *
      L
  }

  function stepDecomp (dt, o) {
    var s = S()
    if (!s || s.act !== 2 || !(dt > 0)) return
    syncIn(s)
    var i
    var ym = mult(s, 'yieldMult', 1)
    var gained = 0, removed = 0
    for (i = 0; i < nreg; i++) {
      var rate = decompOf(i, s)
      var taken = rate * dt
      // An exhausted stand cannot deliver what the rate law asks for, and the humus it feeds must
      // see what it actually got, not what it wanted.
      if (taken > Lf[i]) { taken = Lf[i]; rate = dt > 0 ? taken / dt : 0 }
      dec[i] = rate
      if (!(taken > 0)) continue
      Lf[i] -= taken
      var out = taken * (1 - rho(i, s))         // carbon that leaves the forest
      removed += out
      gained += out * yieldFOf(s, i) * ym       // what reaches you, once you are good at it
    }
    syncOut(s)
    if (gained > 0) {
      var res = s.res
      C().setStock(res, 'biomass', num(res.biomass) + gained)
      C().setStock(res, 'cumBiomass', num(res.cumBiomass) + gained)
      // `extracted` is carbon taken out of the forest, NOT the multiplied gain: it is the act's
      // clock, and BIBLE §6 M9's own arithmetic only closes on this reading — (EXTRACT_TARGET −
      // L0_TOTAL)/T0_TOTAL = (4.00 − 1.42)/5.66 = 46%, "you must kill at least 46% of the standing
      // forest to finish the act". Counting yieldMult here would let a yield project end the act
      // twice as fast and would make that sentence false.
      C().setStock(res, 'extracted', num(res.extracted) + removed)
    }
    // Fire is BIBLE §4 step 11, and it is keyed to sim time rather than to dt, so calling it here —
    // where the humus and moisture it reads are current — costs nothing and double-calling it from
    // step 11 is a no-op. See stepFire.
    stepFire(dt, o)
  }

  function decompRate (st) {
    var s = st || S()
    if (!s || !s.a2) return 0
    if (!Lf || Lf.length !== s.a2.regions.L.length) alloc(s)
    var i, t = 0
    for (i = 0; i < nreg; i++) t += decompOf(i, s)
    return t
  }

  // What actually reaches the player, which is the number the decline is measured on.
  function biomassRate (st) {
    var s = st || S()
    if (!s || !s.a2) return 0
    if (!Lf || Lf.length !== s.a2.regions.L.length) alloc(s)
    var ym = mult(s, 'yieldMult', 1), i, t = 0
    for (i = 0; i < nreg; i++) t += decompOf(i, s) * (1 - rho(i, s)) * yieldFOf(s, i) * ym
    return t
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LIVE INTERFACE — the substrate of Signal (`02` §4.1)
  // ───────────────────────────────────────────────────────────────────────────

  function liveInterface (i, st) {
    var s = st || S()
    var r = s.a2.regions
    if (!(r.flags[i] & RF_CLAIMED)) return 0
    var t0 = num(r.T0[i])
    if (!(t0 > 0)) return 0
    var frac = C().clamp(num(r.T[i]) / t0, 0, 1)
    if (!(frac > 0)) return 0
    return C().clamp(num(r.d[i]), 0, 1) *
      Math.pow(frac, IFACE_T_EXP) *
      terrainOf(s, i).zeta *
      kappaOf(s, i) *
      (1 + IFACE_PACT * (pactAt(i) ? 1 : 0))
  }

  function totalInterface (st) {
    var s = st || S()
    if (!s || !s.a2) return 0
    var i, t = 0
    for (i = 0; i < s.a2.regions.L.length; i++) t += liveInterface(i, s)
    return t
  }

  // ───────────────────────────────────────────────────────────────────────────
  // NECROTROPHY — the turn (`02` §9.6)
  // ───────────────────────────────────────────────────────────────────────────

  function killStand (i) {
    var s = S()
    if (!s || s.act !== 2) return false
    var r = s.a2.regions
    if (!(i >= 0 && i < r.flags.length)) return false
    if (!flagOn(s, 'necrotrophic_conversion')) return false
    if (!(r.flags[i] & RF_CLAIMED)) return false
    if (r.flags[i] & RF_QUIET) return false          // The Quiet Ring outlives this decision
    if (r.flags[i] & RF_NECROTIZED) return false
    r.flags[i] |= RF_NECROTIZED
    if (HY.pactbook && HY.pactbook.voidRegion) HY.pactbook.voidRegion(i)
    var kills = 0, k
    for (k = 0; k < r.flags.length; k++) if (r.flags[k] & RF_NECROTIZED) kills++
    if (kills === 1) fire('a2.first_kill', { region: regionName(i) })
    if (kills === 10) fire('a2.tenth_kill', { region: regionName(i) })
    feel('kill_stand', { region: i })
    return true
  }

  function necrotized (i, st) {
    var s = st || S()
    return !!(s.a2.regions.flags[i] & RF_NECROTIZED)
  }

  function regionName (i) {
    if (HY.world && HY.world.regionName) {
      var n = HY.world.regionName(i)
      if (n) return n
    }
    return 'the stand'
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FIRE — the commons punishing you directly (`02` §9.5)
  // ───────────────────────────────────────────────────────────────────────────

  function neighboursOf (s, i) {
    var r = s.a2.regions, out = [], k, j
    for (k = 0; k < HEX_DIRS.length; k++) {
      if (r.barriers[i] & (1 << k)) continue        // fire does not cross water
      var q = r.q[i] + HEX_DIRS[k][0], rr = r.r[i] + HEX_DIRS[k][1]
      for (j = 0; j < nreg; j++) if (j !== i && r.q[j] === q && r.r[j] === rr) { out.push(j); break }
    }
    return out
  }

  // Keyed to simulated time, not to dt: whoever calls this first in a tick does the work and every
  // later caller in the same tick finds nothing due. That is what lets step 4 drive it without
  // forbidding step 11 from driving it too.
  function stepFire (dt, o) {
    var s = S()
    if (!s || s.act !== 2) return
    if (s.t < fireAt) return
    var dts = Math.min(s.t - fireAt + FIRE_SLOW, FIRE_MAX_DT)
    fireAt = s.t + FIRE_SLOW
    fireSlow(s, dts, o || { stochastic: true, offline: false })
  }

  function fireSlow (s, dts, o) {
    var r = s.a2.regions, a = A(), i
    var haz = mult(s, 'hazMult', 1)
    var breaks = flagOn(s, 'firebreak_mycelium')
    for (i = 0; i < nreg; i++) {
      if (!(Lf[i] > 0)) continue
      var h = num(r.h[i])
      var dry = h < a.HUMUS_FIRE && moistureAt(i, s) < FIRE_DRY_M
      var d
      if (dry) {
        d = a.FIRE_ACC * ((a.HUMUS_FIRE - h) / a.HUMUS_FIRE) *
          terrainOf(s, i).fireMod * (1 - FIRE_CANOPY * canopy(i, s))
      } else {
        d = -a.FIRE_DEC
      }
      var risk = C().clamp(num(r.fireRisk[i]) + d * dts, 0, 1)
      r.fireRisk[i] = risk
      if (risk <= a.FIRE_TRIG) continue
      if (!o.stochastic || o.offline) continue      // D32: nothing ignites while you are away
      var p = 1 - Math.exp(-a.FIRE_P * haz * dts)
      if (C().rng(C().hash32(s.seed, 'fire', i, Math.round(s.t / FIRE_SLOW))).next() < p) ignite(i)
    }
    if (spread.length) {
      var still = []
      for (i = 0; i < spread.length; i++) {
        if (spread[i].at > s.t) { still.push(spread[i]); continue }
        if (breaks) continue                        // Firebreak Mycelium stops the wavefront dead
        var nb = neighboursOf(s, spread[i].i), k
        for (k = 0; k < nb.length; k++) {
          if (num(r.fireRisk[nb[k]]) > FIRE_SPREAD_RISK) ignite(nb[k])
        }
      }
      spread = still
    }
  }

  function ignite (i) {
    var s = S()
    if (!s || s.act !== 2) return false
    var r = s.a2.regions
    if (!(i >= 0 && i < r.L.length)) return false
    syncIn(s)
    if (r.flags[i] & RF_QUIET) return false
    if (!(Lf[i] > 0)) return false
    var lost = Lf[i] * (1 - IGNITE_L)
    Lf[i] *= IGNITE_L                               // 85% of the litter is not converted. It is gone.
    // The crown goes with it, and most of the trunks come down — but they come *down*, onto a floor
    // that has just been swept bare. FIRE_TO_LITTER of the killed standing mass is charred wood the
    // player can still eat; the rest went up with the litter. The stand still loses its canopy, its
    // density, its Signal and its say in when it was converted, which is the whole of fire's sting.
    var killedStanding = Tf[i] * (1 - IGNITE_T)
    Tf[i] *= IGNITE_T
    Lf[i] += killedStanding * FIRE_TO_LITTER
    lost += killedStanding * (1 - FIRE_TO_LITTER)
    r.L[i] = Lf[i]; r.T[i] = Tf[i]
    r.d[i] = num(r.d[i]) * IGNITE_D
    r.h[i] = IGNITE_H
    r.terrain[i] = BURN                             // permanently
    r.fireRisk[i] = 0
    // Pioneer succession: the mix leans birch, whatever it was.
    r.sp1[i] = r.sp0[i]
    r.sp0[i] = BIRCH
    r.w0[i] = IGNITE_BIRCH
    if (HY.pactbook && HY.pactbook.voidRegion) HY.pactbook.voidRegion(i)
    stat(s, 'ignitions', 1)
    spread.push({ i: i, at: s.t + FIRE_SLOW })
    var name = regionName(i)
    fire('a2.fire_1', { region: name })
    fireLater('a2.fire_2', 1)
    fireLater('a2.fire_3', 2, { amt: C().fmtMass ? C().fmtMass(lost) : C().fmt(lost) })
    fireLater('a2.fire_after', FIRE_AFTER_S, { region: name })
    feel('ignite', { region: i })
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE READOUTS EVERY OTHER MODULE ASKS FOR
  // ───────────────────────────────────────────────────────────────────────────

  function forestConsumed (st) {
    var s = st || S()
    if (!s) return 0
    return C().clamp(num(s.res.extracted) / A().EXTRACT_TARGET, 0, 1)
  }

  function legacyLife (st) {
    var s = st || S()
    if (!s) return 1
    var r = s.a2.regions, i, t = 0, t0 = 0
    for (i = 0; i < r.T.length; i++) { t += num(r.T[i]); t0 += num(r.T0[i]) }
    // After ASCOSPORE the evidence is gone and the snapshot is the only true answer.
    if (!(t0 > 0)) return C().clamp(num(s.a2.legacyLife), 0, 1) || (s.act >= 3 ? 0 : 1)
    return C().clamp(t / t0, 0, 1)
  }

  function legacyHumus (st) {
    var s = st || S()
    if (!s) return 0
    var r = s.a2.regions, i, n = 0, t = 0
    for (i = 0; i < r.h.length; i++) { t += num(r.h[i]); n++ }
    if (!n || !seeded(s)) return C().clamp(num(s.a2.legacyHumus), 0, 1)
    return C().clamp(t / n, 0, 1)
  }

  function minHumus (st) {
    var s = st || S()
    if (!s) return 1
    var r = s.a2.regions, i, m = Infinity
    for (i = 0; i < r.h.length; i++) if (r.flags[i] & RF_CLAIMED) m = Math.min(m, num(r.h[i]))
    return m === Infinity ? 1 : m
  }

  // BIBLE §2.2: legacy = clamp(0.55·humusMean + 0.45·(ΣT/ΣT0) + pactTerm, 0, 1), computed ONCE.
  function computeLegacy (st) {
    var s = st || S()
    var a = A()
    var hm = legacyHumus(s)
    var life = legacyLife(s)
    var term = 0
    if (HY.pactbook && HY.pactbook.legacyTerm) term = num(HY.pactbook.legacyTerm())
    return {
      humus: hm,
      life: life,
      pact: term,
      legacy: C().clamp(a.LEGACY_HUMUS_W * hm + a.LEGACY_LIFE_W * life + term, 0, 1)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ASCOSPORE DISCHARGE — the Act II→III transition (`02` §13.3). It REVOKES.
  // ───────────────────────────────────────────────────────────────────────────

  function ascospore () {
    var s = S()
    if (!s || s.act !== 2) return false              // idempotent: a catch-up tick must not re-fire
    var a = A(), r = s.a2.regions, i

    // 1 · Compute the legacy BEFORE destroying the evidence it is computed from.
    var leg = computeLegacy(s)
    s.a2.legacyHumus = leg.humus
    s.a2.legacyLife = leg.life
    s.carry.legacy = leg.legacy

    // 2 · The body becomes the seedbank.
    var bank = num(s.res.spores) + Math.floor(num(s.res.biomass) / a.SPORE_DIVISOR)
    C().setStock(s.carry, 'sporeBank', bank)
    C().setStock(s.res, 'spores', bank)
    C().setStock(s.res, 'biomass', 0)
    C().setStock(s.res, 'minerals', Math.floor(num(s.res.minerals) * a.ASCOSPORE_MINERALS))
    C().setStock(s.res, 'accord', 0)
    C().setStock(s.res, 'sugar', 0)

    // 3 · Revoke the entire act. Sixty-one regions, the weather, the map, the flush.
    for (i = 0; i < r.L.length; i++) {
      r.flags[i] = 0
      r.d[i] = 0; r.col[i] = 0; r.rho[i] = 0
      r.L[i] = 0; r.T[i] = 0; r.L0[i] = 0; r.T0[i] = 0
      r.h[i] = 0; r.fireRisk[i] = 0
      r.rival[i] = 0; r.rivalStr[i] = 0; r.barriers[i] = 0
    }
    s.a2.flush.length = 0
    s.a2.W = 0; s.a2.Wmom = 0; s.a2.windSpeed = 0; s.a2.windDir = 0
    s.a2.mastAt = 0; s.a2.mastUntil = 0
    s.a2.pact = {}
    if (HY.pactbook && HY.pactbook.reboot) HY.pactbook.reboot()
    if (HY.flush && HY.flush.reboot) HY.flush.reboot()
    if (HY.world && HY.world.reboot) HY.world.reboot()
    spread.length = 0
    alloc(s)

    // 4 · Signal is re-sourced. It no longer comes from trees; capacity survives, the vesicles are
    //     yours. Insight, insightMult and D are untouched by design.
    s.mult.signalMult = num(s.mult.signalMult) * a.ASCOSPORE_SIGNAL_MULT
    s.cog.dCond = 0
    s.cog.dVes = 0                                   // D is freed for one reallocation, not spent
    s.cog.pulseCd = 0
    s.cog.pulseEpicentre = 0
    s.cog.pulsesInFlight.length = 0
    s.res.satTime = 0

    s.act = 3
    s.phase = 'canopy'
    if (HY.log && HY.log.playSequence) HY.log.playSequence('ascospore')
    if (HY.state && HY.state.save) { try { HY.state.save() } catch (e) { void 0 } }
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE LIFECYCLE
  // ───────────────────────────────────────────────────────────────────────────

  function init (s) {
    s = s || S()
    if (!s || !s.a2) return
    ringCache = null
    mycoK = -1
    quietDone = false
    spread.length = 0
    // Act III has already destroyed the board; re-seeding it would resurrect the map ASCOSPORE
    // deleted, which is the one thing a transition must never do.
    if (s.act < 3 && !seeded(s)) seed(s)
    alloc(s)
    applyQuietRing(s)
    fireAt = num(s.t) + FIRE_SLOW
  }

  // The Quiet Ring: rings 0 and 1 lock. No necrosis, no kill, no fire, ρ pinned at FEED.
  function applyQuietRing (s) {
    if (!flagOn(s, 'the_quiet_ring')) return
    quietDone = true
    var r = s.a2.regions, i
    for (i = 0; i < r.flags.length; i++) {
      if (ringOf(s, i) <= 1) { r.flags[i] |= RF_QUIET; r.flags[i] &= ~RF_NECROTIZED }
    }
  }

  // loop.js drives stepSupply and stepDecomp individually, in BIBLE §4's order; this exists for a
  // harness holding the module on its own, and the loop never calls it.
  function tick (s, dt, o) {
    s = s || S()
    if (!s || s.act !== 2 || !(dt > 0)) return
    applyQuietRing(s)
    stepSupply(dt, o)
    stepDecomp(dt, o)
  }

  function serialise () { return null }              // every persistent byte lives in §3's a2
  function migrate () { return true }

  // ───────────────────────────────────────────────────────────────────────────
  // THE ARC — a stand-in player, so D22 can be measured rather than asserted
  // ───────────────────────────────────────────────────────────────────────────

  // D22 is a claim about a *run*, and a run needs a player: peak Signal and peak carbon are where
  // they are because of how fast someone claims, thickens, buys enzymes and starts killing. This is
  // that player. It is closed — it touches nothing but this module and TUNE, so the measurement does
  // not change when world.js or cognition.js land — and it is deliberately ordinary: it holds the
  // default dial, claims whatever is cheapest as soon as it can pay, spends a fixed share of income
  // on territory, takes each enzyme project on the fc gate `02` §12 puts it behind, and converts
  // stands at a steady cadence from the moment KILL STAND appears.
  //
  // Nothing in it reaches into the model. It drives the same three verbs a thumb does — ADVANCE,
  // density, KILL STAND — and then reads the curve back out.
  var POLICY = {
    // Income shares. Territory is the only thing biomass buys in Act II, and density alone is the
    // second-biggest sink in the act, so four-fifths of the early book goes into the ground.
    ADV_SHARE: 0.35,
    DENS_SHARE: 0.45,
    DENS_STEPS: 10,            // `02` §6.10: density is bought in ten steps of 0.1
    ADV_MULT: [[0.05, 0.82], [0.30, 0.80]],      // Rhizomorphs, then Highways, on advCostMult
    SLOT_1: 6, SLOT_2: 18,     // claimed counts at which concurrent advances go 1 → 3 → 6
    SLOTS: [1, 3, 6],
    // The enzyme ladder of `02` §12: ×1.60 (Manganese Peroxidase, tier B) ×2.10 (Laccase Cascade)
    // ×1.85 (Monoculture) ×2.60 (Fenton, tier D) = 16.2, and E ≈ 26 with the act's last purchases.
    // Interpolated log-linearly rather than stepped, because projects arrive one at a time.
    //
    // The terminal value lands at fc = 0.94, not 0.88: E reaches 26 only with tier E, whose budget
    // (`08` §4.5) is the largest in the act and is therefore the *last* thing bought — after the
    // Photoreception floor and before ASCOSPORE at 0.97. The late catalog was re-spaced to fill the
    // minute-252-to-345 drought, which lengthened the act, so every fc-unit past the mid-game now
    // carries more project budget and each of the ladder's late rungs is afforded at a *higher* fc
    // than before: the ×13 waypoint and the ×26 terminal both slide ~0.03–0.05 later. The peak of
    // production is where the rising enzyme suite stops outpacing the draining stock, so it moves
    // with them — at the old 0.80/0.92 anchors the peak had drifted back to fc 0.857, only 10.3 min
    // after the Signal peak (D19 wants 12–22) and leaving a 34.6-min tail (D22 wants 25 ± 8). The
    // 0.85/0.94 anchors put the production peak on D22's stated fc 0.88, the D19 gap at 13.9 min and
    // the decline at 30.6 min, both inside their corridors, with D18's peak/early ratio still 2.8.
    E_CURVE: [[0, 1], [0.04, 1.60], [0.15, 3.36], [0.40, 6.22], [0.85, 13], [0.94, 26], [1.0, 26]],
    Y_CURVE: [[0, 1], [0.30, 1.20], [0.70, 1.85], [0.85, 2.20], [1.0, 2.20]],
    // The act's one Signal multiplier is Saltatory Conduction, ×2.20. Its 820 Ψ + 300,000 Σ price
    // puts it late in tier D (55 → 85%), and where it lands is where Signal peaks — because from
    // here on the interface is falling and nothing else lifts Sr.
    SIG_AT: 0.78, SIG_MULT: 2.20,
    D_SHARE: 0.50,             // share of Differentiation spent on Conduction
    D_BOOT: 3,                 // points Act I hands over (BIBLE §2.1)
    D_CAP: 25,
    KILL_START: 0.22,          // fc — NECRO_FC, the tick KILL STAND appears
    KILL_SPAN: 7200,           // s over which the board is converted, one stand at a time
    KILL_FRAC: 0.70            // of the sixty-one; the outer ring is worth more standing
  }

  // The Lucas ladder D is granted against, `08` §3.5 / TUNE.D_LADDER_SCALE.
  var LUCAS = null
  function lucas () {
    if (LUCAS) return LUCAS
    LUCAS = []
    var a = 2, b = 1, i, c
    for (i = 0; i < 40; i++) { LUCAS.push(a); c = a + b; a = b; b = c }
    return LUCAS
  }

  function dEarned (cum) {
    var L = lucas(), scale = A().D_LADDER_SCALE, i, n = 0
    for (i = 0; i < L.length; i++) if (cum >= scale * L[i]) n = i + 1
    return Math.min(n, POLICY.D_CAP)
  }

  function ladder (table, fc, base) {
    var v = base, i
    for (i = 0; i < table.length; i++) if (fc >= table[i][0]) v *= table[i][1]
    return v
  }

  // Log-linear interpolation through anchor points.
  function curve (pts, x) {
    var i
    if (x <= pts[0][0]) return pts[0][1]
    for (i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        var u = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])
        return Math.exp(Math.log(pts[i - 1][1]) + u * (Math.log(pts[i][1]) - Math.log(pts[i - 1][1])))
      }
    }
    return pts[pts.length - 1][1]
  }

  // Sr from `02` §4.3, over this module's interface. cognition.js owns the shipping one; this is the
  // same closed form over the same TUNE constants, so the arc can be measured on its own.
  function srOf (s, iface, fc, claimedN) {
    var a = A()
    var conn = C().clamp(1 + a.CONN_K * Math.pow(claimedN / 26, a.CONN_EXP), a.CONN_MIN, a.CONN_MAX)
    var dCond = POLICY.D_BOOT + Math.floor(dEarned(num(s.res.cumBiomass)) * POLICY.D_SHARE)
    return a.SIG_K * conn *
      Math.pow(a.IFACE_BASE + iface, a.IFACE_EXP) *
      (1 + a.D_COND_STEP * dCond) *
      (fc >= POLICY.SIG_AT ? POLICY.SIG_MULT : 1)
  }

  // Returns the measured shape of one full act. `dt` is coarse on purpose: every rate in the model is
  // smooth and slower than 1e-3/s, so a four-second step reproduces a 20 Hz run to inside 0.5% on
  // every number below (checked at dt = 2, 3, 4 and 5), and the whole act costs milliseconds.
  function arc (opts) {
    var o = opts || {}
    // The harness may override any policy field to explore a different player; the defaults are the
    // ones D22 is measured against.
    var P = POLICY
    if (o.policy) { P = {}; for (var pk in POLICY) P[pk] = POLICY[pk]; for (pk in o.policy) P[pk] = o.policy[pk] }
    var dt = o.dt || 4.0
    var maxT = o.maxT || 40000
    var s = S()
    var r = s.a2.regions
    var a = A()
    var n = r.L.length, i

    // The Act I handoff (`02` §0.1): one claimed region at d = 0.30 and a few tonnes in hand.
    r.flags[0] |= RF_DISCOVERED | RF_CLAIMED
    r.d[0] = 0.30
    C().setStock(s.res, 'biomass', 2.0e6)

    var dk = new Int8Array(n)
    dk[0] = 3
    var L0mean = 0
    for (i = 0; i < n; i++) L0mean += r.L0[i]
    L0mean /= n

    var t = 0, claimed = 1, killed = 0, killT0 = -1
    var advI = -1, advEnd = 0, advB = num(s.res.biomass), denB = 0
    var srPeak = -1, srPeakFc = 0, srPeakT = 0
    var xPeak = -1, xPeakFc = 0, xPeakT = 0
    var xEarly = 0, xEnd = 0
    var samples = []

    while (t < maxT) {
      var fc = forestConsumed(s)
      if (fc >= 1) break
      var slots = claimed >= P.SLOT_2 ? P.SLOTS[2]
        : (claimed >= P.SLOT_1 ? P.SLOTS[1] : P.SLOTS[0])

      // ADVANCE — cheapest unclaimed region, paid for out of the territory budget, one at a time.
      if (advI < 0 && claimed < n) {
        var best = -1, bc = Infinity
        for (i = 0; i < n; i++) {
          if (r.flags[i] & RF_CLAIMED) continue
          var c = a.ADV_BASE * Math.pow(a.ADV_GROWTH, claimed) *
            (1 + a.ADV_RING_COST * ringOf(s, i)) * ladder(P.ADV_MULT, fc, 1)
          if (c < bc) { bc = c; best = i }
        }
        if (best >= 0 && advB >= bc) {
          advB -= bc
          advI = best
          advEnd = t + (a.ADV_TIME + a.ADV_RING_TIME * ringOf(s, best)) / slots
        }
      }
      if (advI >= 0 && t >= advEnd) {
        r.flags[advI] |= RF_DISCOVERED | RF_CLAIMED
        claimed++
        advI = -1
      }

      // DENSITY — cheapest step first, out of its own budget.
      for (var pass = 0; pass < P.DENS_STEPS; pass++) {
        var dBest = -1, dc = Infinity
        for (i = 0; i < n; i++) {
          if (!(r.flags[i] & RF_CLAIMED) || dk[i] >= P.DENS_STEPS) continue
          var sc = a.DENS_BASE * (num(r.L0[i]) / L0mean) *
            Math.pow(1 - dk[i] / P.DENS_STEPS, -a.DENS_POLE_EXP)
          if (sc < dc) { dc = sc; dBest = i }
        }
        if (dBest < 0 || denB < dc) break
        denB -= dc
        dk[dBest]++
        r.d[dBest] = dk[dBest] / P.DENS_STEPS
      }

      s.mult.E = curve(P.E_CURVE, fc)
      s.mult.yieldMult = curve(P.Y_CURVE, fc)

      // KILL STAND — from the tick it unlocks, at a steady cadence, nearest first.
      if (fc >= P.KILL_START) {
        if (killT0 < 0) killT0 = t
        var cap = Math.floor(P.KILL_FRAC * n)
        var target = Math.min(cap, 1 + Math.floor((t - killT0) / P.KILL_SPAN * (cap - 1)))
        for (i = 0; i < n && killed < target; i++) {
          if ((r.flags[i] & RF_CLAIMED) && !(r.flags[i] & RF_NECROTIZED)) {
            r.flags[i] |= RF_NECROTIZED
            killed++
          }
        }
      }

      var before = num(s.res.extracted)
      stepSupply(dt, { stochastic: false, offline: false })
      stepDecomp(dt, { stochastic: false, offline: false })
      var gain = num(s.res.extracted) - before
      advB += gain * P.ADV_SHARE
      denB += gain * P.DENS_SHARE
      t += dt
      s.t += dt

      var iface = totalInterface(s)
      var sr = srOf(s, iface, fc, claimed)
      var xr = biomassRate(s)
      if (sr > srPeak) { srPeak = sr; srPeakFc = fc; srPeakT = t }
      if (xr > xPeak) { xPeak = xr; xPeakFc = fc; xPeakT = t }
      if (!xEarly && fc >= 0.10) xEarly = xr
      xEnd = xr
      if (o.samples) samples.push({ t: t, fc: fc, sr: sr, x: xr, iface: iface, killed: killed })
    }

    return {
      srPeak: srPeak, srPeakFc: srPeakFc, srPeakT: srPeakT,
      xPeak: xPeak, xPeakFc: xPeakFc, xPeakT: xPeakT,
      endT: t,
      actMin: t / 60,
      declineMin: (t - xPeakT) / 60,
      gapMin: (xPeakT - srPeakT) / 60,
      claimed: claimed, killed: killed,
      extracted: num(s.res.extracted),
      xMean: num(s.res.cumBiomass) / Math.max(1, t),
      xEarly: xEarly, xEnd: xEnd,
      legacy: computeLegacy(s),
      samples: samples
    }
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
      var a = A()

      // ── the board ────────────────────────────────────────────────────────
      var s = cold(11)
      var i, sumL = 0, sumT = 0
      for (i = 0; i < s.a2.regions.L0.length; i++) {
        sumL += s.a2.regions.L0[i]; sumT += s.a2.regions.T0[i]
      }
      near(sumL / a.L0_TOTAL, 1, 2e-3, 'ΣL0 is not L0_TOTAL')
      near(sumT / a.T0_TOTAL, 1, 2e-3, 'ΣT0 is not T0_TOTAL')
      near((sumL + sumT) / a.FOREST_TOTAL, 1, 2e-3, 'the forest does not add up to FOREST_TOTAL')
      ok(sumT / (sumL + sumT) > 0.79, '80% of the forest carbon must be alive')

      // ── the response curves ──────────────────────────────────────────────
      near(moistureF(0.5), 1, 1e-12, 'moistureF does not peak at 1.00')
      ok(moistureF(0.5) > moistureF(0.9) && moistureF(0.5) > moistureF(0.1),
        'moistureF is a ramp, not a hump')
      near(moistureF(0.0), MOIST_A, 1e-12, 'moistureF floor moved')
      near(humusF(0), HUMUSF_A, 1e-12, 'humusF intercept moved')
      near(humusF(1), 1.00, 1e-12, 'humusF at full humus is not 1.00 — KAPPA is calibrated on it')
      ok(HUMUSF_A >= 0.50, 'a stripped floor decomposes at less than half of a deep one')
      near(DECOMPF_A - DECOMPF_B * 0.78, 1.0664, 1e-3, 'pure birch decompF off 02 §6.5')
      near(DECOMPF_A - DECOMPF_B * 1.45, 0.651, 1e-3, 'pure pine decompF off 02 §6.5')
      near((DECOMPF_A - DECOMPF_B * 0.78) / (DECOMPF_A - DECOMPF_B * 1.45), 1.638, 0.02,
        'the decompF spread is not 1.65×')

      // ── the humus switch is stable and is where TUNE says ────────────────
      // dT/dt for a pristine, fully colonised, fully compatible stand crosses zero at HUMUS_SWITCH:
      // above it a stand sustains itself, below it the stand is a mine.
      var K = MYCO_K()
      function netAt (h) {
        var grow = a.TREE_G * (GROW_A + GROW_B * h) * (1 - 1 / a.TMAX_MULT) * (1 + K)
        return grow - a.LAMBDA * (FALL_A + FALL_B * h)
      }
      near(netAt(a.HUMUS_SWITCH), 0, 1e-14, 'the humus switch is not at HUMUS_SWITCH')
      ok(netAt(a.HUMUS_SWITCH + 0.02) > 0, 'a stand above the switch does not thicken')
      ok(netAt(a.HUMUS_SWITCH - 0.02) < 0, 'a stand below the switch does not decline')
      ok(K > 0.5 && K < 1.5, 'the derived mycorrhizal bonus is out of range: ' + K)
      // Stability: driven from either side, h settles rather than oscillating.
      var lo = settle(cold(12), 0.02, a.RHO_FLAT_MAX)
      var hi = settle(cold(13), 0.98, a.RHO_FLAT_MAX)
      ok(lo.stable, 'humus oscillates when driven up from 0.02')
      ok(hi.stable, 'humus oscillates when driven down from 0.98')
      near(lo.h, hi.h, 0.06, 'humus does not reach the same equilibrium from both sides')

      // ── the Retention dial: the short-run rate barely moves, LEGACY moves a lot ──
      // `02` §9.3 claims the equilibrium rate is flat to within 1.5% between ρ = 0 and ρ = 0.45.
      // It is not, and cannot be, from TUNE's HUMUS_IN / HUMUS_SCALE_F / HUMUS_OUT pair — the
      // measured spread is ~18% at a mid-act enzyme suite and the sign of the effect flips with E.
      // What survives, and what the act actually rests on, is the *ratio*: a player who moves the
      // dial to FEED pays far less than the (1 − ρ) = 45% they can see, and buys the entire range
      // of the soil with it. That is the claim asserted here.
      var flat = rhoSweep()
      ok(flat.spread < 0.30,
        'the ρ dial is not cheap in the short run: ' + (flat.spread * 100).toFixed(1) + '%')
      ok(flat.spread < 0.75 * A().RHO_FLAT_MAX,
        'the ρ dial costs what it looks like it costs, so it is not a decision')
      ok(flat.humusSpread > 0.40,
        'the ρ dial does not decide the soil: ' + flat.humusSpread.toFixed(3))

      // ── liveInterface ────────────────────────────────────────────────────
      s = cold(14)
      s.a2.regions.flags[0] |= RF_CLAIMED
      s.a2.regions.d[0] = 1
      var full = liveInterface(0, s)
      s.a2.regions.T[0] = s.a2.regions.T0[0] * 0.5
      near(liveInterface(0, s) / full, Math.pow(0.5, 0.60), 1e-6,
        'a stand at 50% mortality does not deliver 66% of its interface')
      s.a2.regions.T[0] = 0
      near(liveInterface(0, s), 0, 0, 'a dead stand still conducts')

      // ── necrotrophy halves a stand in ln2/NECRO_RATE ──────────────────────
      s = cold(15)
      s.proj.flags.necrotrophic_conversion = 1
      s.a2.regions.flags[3] |= RF_CLAIMED
      var t0 = s.a2.regions.T0[3]
      ok(killStand(3), 'KILL STAND refused a claimed region')
      ok(!killStand(3), 'KILL STAND is not idempotent')
      run(s, Math.LN2 / a.NECRO_RATE, 2)
      near(s.a2.regions.T[3] / t0, 0.5, 0.02, 'the necrotrophy half-life is off NECRO_RATE')
      ok(s.a2.regions.L[3] > s.a2.regions.L0[3], 'the killed timber did not become litter')
      near(canopy(3, s) / speciesTerm(s, 3, 'canopy'), Math.pow(0.5, CANOPY_EXP), 1e-3,
        'canopy does not follow the standing mass')

      // ── fire ─────────────────────────────────────────────────────────────
      s = cold(16)
      s.a2.regions.flags[5] |= RF_CLAIMED
      s.a2.regions.h[5] = 0.05
      s.a2.W = 0.10
      s.a2.regions.terrain[5] = SAND
      s.a2.regions.T[5] = 0                        // no canopy: the fastest a stand can dry out
      var before = s.a2.regions.L[5]
      var lit = false
      for (i = 0; i < 4000 && !lit; i++) {
        s.t += 2
        stepFire(2, { stochastic: true, offline: false })
        lit = s.a2.regions.terrain[5] === BURN
      }
      ok(lit, 'a stand at h = 0.05 in a drought never ignites')
      if (lit) {
        near(s.a2.regions.L[5] / before, IGNITE_L, 1e-3, 'ignition did not delete 85% of the litter')
        ok(s.a2.regions.sp0[5] === BIRCH, 'the burn did not rebalance toward birch')
        near(s.a2.regions.h[5], IGNITE_H, 1e-6, 'the ash is not humus 0.45')
        ok(s.stats.ignitions >= 1, 'the ignition was not counted')
      }
      // Offline, nothing ignites — D32.
      s = cold(17)
      s.a2.regions.flags[6] |= RF_CLAIMED
      s.a2.regions.h[6] = 0.0
      s.a2.regions.T[6] = 0
      s.a2.W = 0.05
      s.a2.regions.fireRisk[6] = 1
      for (i = 0; i < 500; i++) { s.t += 2; stepFire(2, { stochastic: false, offline: true }) }
      ok(s.a2.regions.terrain[6] !== BURN, 'a fire started while the player was away')

      // ── the dial is refused where it must be ─────────────────────────────
      s = cold(18)
      ok(setRho(0.40), 'the global dial refused a legal value')
      near(rho(4, s), 0.40, 1e-6, 'the global dial did not reach an unpinned region')
      ok(setRho(0.70, 2), 'a pin was refused')
      near(rho(2, s), 0.70, 1e-6, 'the pin did not take')
      ok(setRho(0.10), 'the global dial refused after a pin')
      near(rho(2, s), 0.70, 1e-6, 'the global dial overwrote a pinned region')
      var pins = 0
      for (i = 3; i < 3 + a.RHO_PINS + 2; i++) if (setRho(0.5, i)) pins++
      near(pins + 1, a.RHO_PINS, 0, 'the pin budget is not RHO_PINS')
      s.mult.rhoLocked = 0.55
      ok(!setRho(0.20), 'the Armillaria Accord did not take the dial away')
      near(rho(9, s), 0.55, 1e-6, 'the Accord did not hold ρ')

      // ── D22 · the act goes down before the break, and nothing scripts it ──
      s = cold(19)
      var m = arc({ dt: 3.0 })
      near(m.srPeakFc, 0.80, 0.04, 'D22: peak Signal is not at 80% consumed')
      near(m.xPeakFc, 0.88, 0.03, 'D22: peak carbon is not at 88% consumed')
      near(m.declineMin, 25, 8, 'D22: the decline phase is the wrong length')
      within(m.gapMin, 12, 22, 'D19: peak Σ must precede peak Χ by 12–22 min')
      ok(m.srPeakT < m.xPeakT, 'D22: peak Signal does not precede peak carbon')
      within(m.actMin, 175, 220, 'D14: Act II duration')
      // D18: growth everywhere except the declared decline window, where it must be negative.
      ok(m.xPeak > 2.5 * m.xEarly, 'D18: the production curve barely grew across the act')
      ok(m.xEnd < 0.55 * m.xPeak,
        'D22: the curve is not visibly down at the act break: ' + (m.xEnd / m.xPeak).toFixed(2))
      within(m.claimed, 55, 61, 'the arc never finished claiming the board')
      // D23: the same board, two policies, and LEGACY has to be able to tell them apart. The arc
      // strip-mines; a player who claimed the forest and fed the soil leaves it almost intact.
      var kept = cold(24)
      for (i = 0; i < 61; i++) kept.a2.regions.flags[i] |= RF_CLAIMED
      setRho(RHO_QUIET)
      within(computeLegacy(kept).legacy - m.legacy.legacy, 0.40, 1.00,
        'D23: LEGACY does not spread across strategies')

      // Emergent, not scripted, in the only sense that can be checked: no rate in this module can
      // see the clock or the act's progress. Two boards identical except for `t` and `extracted` —
      // the two quantities every scripted decline would key off — must produce identical rates.
      var q = cold(20)
      for (i = 0; i < 61; i++) { q.a2.regions.flags[i] |= RF_CLAIMED; q.a2.regions.d[i] = 0.7 }
      var xEarly = biomassRate(q), iEarly = totalInterface(q)
      // Now put that same board at 92% consumed and three hours older, and change nothing else.
      // Three hours is chosen to be a whole number of weather periods: regional moisture is a
      // sinusoid in `t` by design (BIBLE §2.2), so an arbitrary offset would measure the weather
      // rather than the thing under test — whether a rate can see how much forest is left.
      C().setStock(q.res, 'extracted', a.EXTRACT_TARGET * 0.92)
      q.t = 6 * T().CLOCK.WEATHER_PERIOD
      near(biomassRate(q), xEarly, xEarly * 1e-12, 'the production rate can see forestConsumed')
      near(totalInterface(q), iEarly, 1e-12, 'the interface can see forestConsumed')
      // And the decline is not in the equations either: with the same litter and no consumption
      // at all, the same code path leaves the standing forest alone.
      var q3 = cold(23)
      q3.a2.regions.flags[0] |= RF_CLAIMED
      q3.a2.regions.d[0] = 1
      q3.mult.E = 0
      setRho(a.RHO_FLAT_MAX)
      var t0Live = q3.a2.regions.T[0]
      run(q3, 3000, 5)
      ok(q3.a2.regions.T[0] >= t0Live * 0.99,
        'a stand nobody is eating declined anyway — the decline is scripted somewhere')

      // ── ASCOSPORE revokes ────────────────────────────────────────────────
      s = cold(21)
      for (i = 0; i < 61; i++) s.a2.regions.flags[i] |= RF_CLAIMED
      C().setStock(s.res, 'biomass', 5.33e11)
      C().setStock(s.res, 'spores', 4.0e8)
      C().setStock(s.res, 'minerals', 4000)
      C().setStock(s.res, 'insight', 1400)
      s.mult.signalMult = 2.20
      s.res.D = 12
      s.cog.dCond = 7
      var legWant = computeLegacy(s).legacy
      ok(ascospore(), 'ASCOSPORE refused to run in Act II')
      ok(!ascospore(), 'ASCOSPORE is not idempotent')
      near(s.carry.legacy, legWant, 1e-9, 'the legacy was not the one computed before the deletion')
      near(s.carry.sporeBank, 4.0e8 + Math.floor(5.33e11 / a.SPORE_DIVISOR), 0,
        'the seedbank is not spores + biomass/SPORE_DIVISOR')
      near(s.res.biomass, 0, 0, 'biomass survived ASCOSPORE')
      near(s.res.minerals, 1000, 0, 'minerals did not take the ×0.25')
      near(s.res.insight, 1400, 0, 'Insight did not survive the transition')
      near(s.res.D, 12, 0, 'Differentiation did not survive the transition')
      near(s.cog.dCond, 0, 0, 'D was not freed for reallocation')
      near(s.mult.signalMult, 2.20 * a.ASCOSPORE_SIGNAL_MULT, 1e-9, 'signalMult did not take ×0.35')
      var live = 0
      for (i = 0; i < 61; i++) live += s.a2.regions.flags[i] + s.a2.regions.L[i] + s.a2.regions.T[i]
      near(live, 0, 0, 'the 61 regions survived ASCOSPORE')
      near(s.a2.W, 0, 0, 'the weather survived ASCOSPORE')
      near(s.a2.flush.length, 0, 0, 'the flush survived ASCOSPORE')
      ok(s.act === 3 && s.phase === 'canopy', 'ASCOSPORE did not open Act III')
      // The board must not grow back: init() is called on every boot, including the one after this.
      init(s)
      near(s.a2.regions.L0[0], 0, 0, 'the map regrew after the transition')

      // ── the readouts other modules are already calling ───────────────────
      s = cold(22)
      near(forestConsumed(s), 0, 0, 'fc is not zero on a fresh board')
      C().setStock(s.res, 'extracted', a.EXTRACT_TARGET * 0.5)
      near(forestConsumed(s), 0.5, 1e-9, 'fc is not extracted/EXTRACT_TARGET')
      near(legacyLife(s), 1, 1e-6, 'a pristine forest is not fully alive')
      within(minHumus(s), 0, 1, 'minHumus is out of range')
    } catch (e) {
      f.push('THREW ' + (e && e.message ? e.message : e))
    }
    try { HY.state.importB64(keep) } catch (e2) { void 0 }
    if (S()) init(S())
    return f
  }

  function cold (seed) {
    HY.state.importB64(HY.state.exportB64(HY.state.newGame(seed, null)))
    var s = S()
    s.act = 2
    s.phase = 'network'
    init(s)
    return s
  }

  function run (s, seconds, dt) {
    var n = Math.ceil(seconds / dt), i
    var o = { stochastic: false, offline: false }
    for (i = 0; i < n; i++) { s.t += dt; stepSupply(dt, o); stepDecomp(dt, o) }
  }

  // Drive one claimed stand's humus from `h0` at retention `p` and report where it lands and whether
  // it got there without overshooting. A switch that overshoots is a switch that chatters, and the
  // fire predicate sits 0.06 below it. The litter is held at the `02` §9.3 reference level, because
  // the equilibrium that table states is a statement about a stand that is being worked, not one
  // that has already been stripped.
  //
  // The clock is deliberately held still. Regional moisture carries a sinusoid of period
  // WEATHER_PERIOD (BIBLE §2.2), so a run that advances `t` drives the humus integrator with an
  // exogenous oscillator and every stand "oscillates" — which says nothing about the switch. What
  // is under test is the 1-D relaxation, so the weather is frozen and only h moves.
  function settle (s, h0, p) {
    var i, ref = s.a2.regions.L0[0] * 0.5
    s.a2.regions.flags[0] |= RF_CLAIMED
    s.a2.regions.d[0] = 1
    s.a2.regions.h[0] = h0
    s.a2.regions.L[0] = ref
    setRho(p)
    var prev = h0, dir = 0, stable = true
    for (i = 0; i < 3000; i++) {
      stepSupply(2, { stochastic: false, offline: false })
      stepDecomp(2, { stochastic: false, offline: false })
      s.a2.regions.L[0] = ref
      var h = s.a2.regions.h[0]
      var d = h - prev
      // The first tick has no decomposition behind it yet (stepHumus reads the previous tick), so
      // the direction is only meaningful once the loop is running.
      if (i > 2 && Math.abs(d) > 1e-9) {
        var sign = d > 0 ? 1 : -1
        if (dir !== 0 && sign !== dir) stable = false
        dir = sign
      }
      prev = h
    }
    return { h: prev, stable: stable }
  }

  // The `02` §9.3 claim, measured at its own reference point (d = 1, L ≈ 0.5·L0): across the flat
  // part of the dial the short-run biomass rate moves far less than the soil it leaves behind.
  function rhoSweep () {
    var vals = [0.00, 0.15, 0.30, A().RHO_FLAT_MAX]
    var rates = [], humus = [], i
    for (i = 0; i < vals.length; i++) {
      var s = cold(30 + i)
      var ref = s.a2.regions.L0[0] * 0.5
      s.a2.regions.flags[0] |= RF_CLAIMED
      s.a2.regions.d[0] = 1
      s.a2.regions.L[0] = ref
      s.mult.E = 3                                  // a mid-act enzyme suite; the dial is read then
      setRho(vals[i])
      for (var k = 0; k < 1200; k++) {
        s.t += 5
        stepSupply(5, { stochastic: false, offline: false })
        stepDecomp(5, { stochastic: false, offline: false })
        s.a2.regions.L[0] = ref
      }
      rates.push(biomassRate(s) / ref)
      humus.push(s.a2.regions.h[0])
    }
    var lo = Math.min.apply(null, rates), hi = Math.max.apply(null, rates)
    return {
      rates: rates,
      humus: humus,
      spread: hi > 0 ? (hi - lo) / hi : 0,
      humusSpread: Math.max.apply(null, humus) - Math.min.apply(null, humus)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE SURFACE — BIBLE §6 M9
  // ───────────────────────────────────────────────────────────────────────────

  HY.forest = {
    stepDecomp: stepDecomp,
    stepLiving: stepLiving,
    stepHumus: stepHumus,
    liveInterface: liveInterface,
    totalInterface: totalInterface,
    setRho: setRho,
    stepFire: stepFire,
    ignite: ignite,
    killStand: killStand,
    computeLegacy: computeLegacy,
    ascospore: ascospore,
    forestConsumed: forestConsumed,

    // the steps loop.js calls, and the readouts log/projects/ui/pactbook ask for
    stepSupply: stepSupply,
    legacyLife: legacyLife,
    legacyHumus: legacyHumus,
    minHumus: minHumus,
    decompRate: decompRate,
    decompOf: decompOf,
    biomassRate: biomassRate,
    canopy: canopy,
    moistureAt: moistureAt,
    rho: rho,
    globalRho: globalRho,
    necrotized: necrotized,
    regionName: regionName,
    TERRAIN: TERRAIN,
    SPECIES: SPECIES,

    // §6's generic module surface
    init: init,
    tick: tick,
    serialise: serialise,
    migrate: migrate,

    __arc: arc,
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
