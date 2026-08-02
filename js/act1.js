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
  // tap's own reservoir — a table and four rows that no other module reads, and that move as a
  // unit or not at all.
  //
  // The event engine has exactly one owner and it is `economy1`: the table, the payloads and the
  // application all live there, because every payload lands on a market row, a counterparty or a
  // modifier that economy1 already reads. What act1 keeps is the *roll* — BIBLE §4 step 1 — and the
  // lifecycle of `a1.activeEvents`, both of which hang off the season clock act1 owns.

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

  // The tap (`01` §3.2). TIP_BASE = 60 g and the 35-second beat are not knobs (BIBLE §9.1), so the
  // only honest way to make D05 hold for both a steady thumb and a masher is to make the *litter*
  // rate-limited rather than the button.
  //
  // A tap lifts what has settled into the mat since the last one. `TAP_REGEN` g/s of litter works
  // its way into reach; a tap takes all of it plus `TAP_FLOOR`, and never more than `TAP_MAX` in
  // one go. So the yield of the n-th tap is a function of *when* it happened, not of how many
  // preceded it, and the litter rate is `f·TAP_FLOOR + TAP_REGEN` — 3.20 g/s at one tap a second
  // and 3.76 g/s at five, a 1.18× spread across a 5× spread in effort. Measured first tip: 38.1 s
  // at 1/s, 35.5 s at 2/s, 34.0 s at 3/s, 31.4 s at 5/s. All four inside D05's 28–50 s, and the
  // measured one-thumb rate of 1.70/s lands on 36.5 s.
  //
  // THE FLOOR IS WHAT MASHING BUYS, and it was too big. `f·TAP_FLOOR` is the only term in the tap
  // rate that a faster thumb can move, so the floor alone sets the price of dexterity — and at
  // 0.22 g it paid a five-a-second masher 4.08 g/s, which was more than a held press at the wall
  // could earn however it was tuned (see TURGOR below). Cutting it to 0.14 g and giving the 0.08
  // back to TAP_REGEN keeps two identities exactly, because both are properties of the SUM:
  //   · TAP_FLOOR + TAP_REGEN = TAP_MAX, so one press a second still lifts exactly a full mat and
  //     every rate at or below 1/s is the number the game shipped with, unchanged;
  //   · (TAP_MAX − TAP_FLOOR) / TAP_REGEN = 1.000 s, so the mat still refills in exactly one second.
  // What moves is only the masher's edge, from 1.28× down to 1.18×, which is the direction this
  // block already said it wanted: the button is not a dexterity test.
  //
  // The clock is simulated time, so the reservoir is deterministic, survives a reload without being
  // saved, and cannot be beaten by a faster device or a macro.
  var TAP_FLOOR = 0.14           // g of litter every tap lifts, however recent the last one was
  var TAP_REGEN = 3.06           // g/s settling into reach of the mat
  var TAP_MAX = 3.20             // g, the most one tap can ever lift
  var tapAt = -Infinity          // s, sim time of the last tap; not saved (§3 stores no tap phase)

  // How long a real thumb needs to lift off the glass and land again. Measured on the built game
  // at 180–300 ms; 400 ms is the slow end of that band with margin, and it is deliberately the
  // SLOW end — see TURGOR. This is a human constant, not a game one, which is why it is not in
  // TUNE: nothing outside this file may retune a thumb.
  var PRESS_LIFT_S = 0.400       // s between the release of one press and the landing of the next

  // The mat is empty of new litter this long after a press (TAP_MAX − TAP_FLOOR) / TAP_REGEN.
  var MAT_FULL_S = (TAP_MAX - TAP_FLOOR) / TAP_REGEN

  // TURGOR. A hypha does not extend by deciding to. The cell behind the tip pumps solute, water
  // follows it, pressure rises against the wall, and the wall — softened at exactly one point —
  // yields. The front moves because something pushed it. That is the verb the player is performing,
  // so the input is a hold: pressure while the thumb is down, extension when it is let go.
  //
  // RIPENESS IS NOT A NEW NUMBER, but it is not MAT_FULL_S either, and that mistake is what this
  // block used to get wrong. The old reasoning went: the mat refills in 1.000 s, so hold for 1.000 s
  // and the surge takes a full mat. It is arithmetically true and it is the wrong second, because
  // THE MAT DOES NOT KNOW THE THUMB IS DOWN. It refills from the last release, and a press cycle is
  // not a hold — it is a hold plus a lift. By the time the thumb has come off, travelled, and landed
  // again, PRESS_LIFT_S of the refill is already spent. Set the wall at MAT_FULL_S and the last
  // PRESS_LIFT_S of every hold is bought after the mat has stopped filling: pure time, no litter.
  // Measured on the built game with real thumbs, that is what it cost — releasing at 0.60 s paid
  // 112.9 g/min and holding to the old 1.00 s wall paid 94.3, so the button's green edge marked a
  // moment 14% worse than one the player could reach by letting go early. An interface that teaches
  // worse play is the Universal Paperclips trap this project exists to beat, and it had shipped.
  //
  // So the wall is where the mat runs dry FOR A THUMB THAT HAS TO LIFT:
  //     TURGOR_RIPE_S = MAT_FULL_S − PRESS_LIFT_S = 1.000 − 0.400 = 0.600 s
  // and it is still not a new number — it is the same two rows of the tap table, minus the one
  // fact about hands the old derivation left out. PRESS_LIFT_S is the SLOW end of the measured
  // 180–300 ms band on purpose: the wall is optimal for every thumb at or faster than it, and a
  // thumb slower than 400 ms merely holds a hair long. Erring the other way would put the optimum
  // before the mark again for the fastest hands, which is the fault itself.
  //
  // What the pressure buys ON TOP of the mat is TURGOR_GAIN: the front travels further than a tap
  // could and reaches litter a tap leaves behind, in litter and in thread alike — one multiplier,
  // both outputs, because it is one push.
  //
  // THE CURVE IS A CUBIC AND THE SHAPE IS THE WHOLE ARGUMENT. A cell wall is elastic: it takes the
  // first pressure without giving anything, yields through the middle, stiffens as it approaches
  // its limit — and then it gives. RESISTANCE, then travel, then a wall that STOPS the press rather
  // than fading it out. `2u² − u³` is the unique cubic that leaves the tap at rest (p(0) = p′(0) = 0,
  // so a short press is unambiguously a tap: at a tenth of a second the surge is 1.3%, and the
  // player who never holds is playing the game that shipped, to three decimal places) and meets the
  // wall still travelling at unit speed (p(1) = p′(1) = 1). It accelerates to its fastest at two
  // thirds and eases back by a quarter into the stop, which is the stiffening.
  //
  // THAT TERMINAL SPEED IS LOAD-BEARING, not decoration. A smoothstep arrives at the wall with
  // p′(1) = 0, so the last instant of the hold buys nothing at all while still costing time — under
  // ANY constants the payoff peaks strictly before a smoothstep's wall. With this cubic the payoff
  // is still climbing when the wall stops it, so the maximum is AT the mark rather than near it,
  // and it is the mark for every thumb-lift gap in 0.15–0.40 s. The self-test sweeps it.
  //
  // MEASURED IN THE BUILT GAME, real thumbs, rate read between press boundaries so no window edge
  // flatters a rhythm. Releasing at the wall pays 121.0 g/min at 1.0 presses a second. The masher
  // at five presses a second gets 112.8, the steady one-thumb 1.7/s gets 98.9, a calm 1.28/s gets
  // 97.2. So the honest claim is no longer "the same pace for fewer presses" — the hold is the
  // FASTEST rhythm on the floor as well as the cheapest in presses: +7% on the masher for a fifth
  // of the presses, +22% on a steady thumb for three fifths of them. First tip 30.1 s at the wall
  // against 36.5 s for that steady thumb.
  //
  // RE-MEASURED with driven touch (raw touchStart/Move/End with a resting thumb's drift, never a
  // synthetic click), sweeping 0.30–1.60 s in 0.05 s steps at lifts of 0.20 / 0.30 / 0.40 s, five
  // holds around the wall repeated four times each and INTERLEAVED so a slow half-minute of the
  // machine cannot attach itself to one hold. The best release is 0.600 s at all three lifts:
  //   lift 0.20 s — 116.4 / 120.7 / 123.2 / 119.6 / 119.5 g/min at 0.50 / 0.55 / 0.60 / 0.65 / 0.70
  //   lift 0.30 s — 114.4 / 116.2 / 120.8 / 118.7 / 117.5
  //   lift 0.40 s — 114.0 / 116.1 / 118.6 / 115.6 / 111.3
  // Two things this pinned down that arithmetic alone does not. First, THE MARGIN IS NOT UNIFORM:
  // the drop for over-holding by 0.05 s is 4.7% at a 0.40 s lift but 0.3% at 0.20 s, because only
  // at the slow lift do the mat's cap and the wall land on the same instant. The mark is the peak
  // everywhere; it is a KNIFE EDGE nowhere, which is the forgiveness this button wants. Second, the
  // measurement is worthless unless the LIFT is delivered as accurately as the hold: a rig that
  // asked for 0.40 s and delivered 0.417 s moved the optimum to 0.586 s and made 0.55 s tie the
  // mark, because the wall is derived from the lift and inherits its error one-for-one.
  //
  // The tap keeps the game it shipped with — one press a second is unchanged to the gram — so the
  // player who cannot hold is not playing a slower game than the one that was balanced, only a
  // slower one than the player who holds, which is what a verb worth learning means. The tap band
  // and the hold band both have to land inside D05 (BIBLE §8.1); both are asserted below, along
  // with the sweep that proves the mark is the optimum.
  var TURGOR_RIPE_S = MAT_FULL_S - PRESS_LIFT_S   // s of hold at which the wall gives: 0.600
  var TURGOR_GAIN = 0.26         // × extra litter and extra thread at full pressure

  // Project effects that projects.js delegates here rather than expressing as a `mult` key.
  var SHEATH_HALVING = 0.50      // Hydrophobic Sheath: moistureMult' = 1 − 0.50·(1 − moistureMult)
  var NECROMASS_REFUND = 0.12    // Necromass Recycling: 12% of consumed mass returns to its pool

  var CALM_RATE = 0.55           // set.calm: eventRateMod 1.00 → 0.55 (BIBLE §3, `01` §7.2)
  var EPS = 1e-9

  var SPRING = 0, SUMMER = 1, AUTUMN = 2, WINTER = 3

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

  // The only modifier act1 consumes itself. Competition, the carbon deficit and the printed price
  // are read from `a1.activeEvents` by economy1, which owns all three.
  function mineralMult () { return mods(S()).mineral }

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
        // The line is looked up rather than carried: §3's row is {id, seasonsLeft, payload} and a
        // string that is a pure function of the id has no business in the save budget.
        var row = HY.economy1 && HY.economy1.eventById ? HY.economy1.eventById(e.id) : null
        if (row && row.logId) fire(row.logId)
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

  function moistureMult (state) {
    var s = state || S(), a = A()
    var m = C().clamp(num(s.a1.moisture), a.MOIST_MIN, a.MOIST_MAX)
    var d = m - a.MOIST_OPT
    var v = Math.exp(-(d * d) / a.MOIST_WIDTH)
    // Hydrophobic Sheath halves the *penalty*, not the value: at the optimum it does nothing, which
    // is why it is worth buying before a winter and never worth buying in an autumn.
    if (flagOn(s, 'hydrophobic_sheath')) v = 1 - SHEATH_HALVING * (1 - v)
    return v
  }

  function tempMult (state) {
    var s = state || S(), a = A()
    var v = a.SEASON_TEMP[s.a1.season]
    if (s.mult.antifreeze && s.a1.season === WINTER) v *= a.ANTIFREEZE_WINTER
    return v * mods(s).temp
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE EVENT ENGINE — the roll only (BIBLE §4 step 1)
  //
  // One engine, one owner. economy1 holds the table, the payload constants and `applyEvent`,
  // because every effect an event has lands on a market row, a counterparty or a modifier that
  // economy1 already reads every tick. What act1 owns is *when* a roll happens — the season
  // boundary — and the lifetime of the rows in `a1.activeEvents`, which is the same clock.
  // ───────────────────────────────────────────────────────────────────────────

  function eventRateMod (s) { return s.set && s.set.calm ? CALM_RATE : 1 }

  function schedule () {
    return (HY.economy1 && HY.economy1.EVENTS) || []
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

    var rows = schedule()
    var rate = eventRateMod(s)
    var i, row, p, r
    for (i = 0; i < rows.length; i++) {
      row = rows[i]
      p = (row.pBySeason ? row.pBySeason[s.a1.season] : 0) * rate
      if (!(p > 0)) continue
      r = rollStream(s, row.id, s.a1.year, s.a1.season)
      // Offline substitutes expectations, and only for the events that hand the player something.
      // Everything that takes — beetles, kills, droughts, frosts — does not run at all, because
      // D32 says nothing is lost while away and an expected-value drought is a loss you did not
      // get to answer. `applyEvent` is handed a null stream, which is how it knows.
      if (!stochastic) {
        if (row.domain === 'supply' && HY.economy1) HY.economy1.applyEvent(row.id, null, p)
        continue
      }
      if (r.next() >= p) continue
      if (HY.economy1) HY.economy1.applyEvent(row.id, r)
    }
    stepNeighbours()
    publishMods(s)
  }

  // A row's seasons run down on every boundary. The per-season *effects* of a live row belong to
  // whoever owns the quantity — a beetle's decay is economy1's stepTrees, a wet spring's price is
  // economy1's eventPriceMod — so nothing here does anything but count and publish.
  function expire (s) {
    var list = s.a1.activeEvents, i, e
    for (i = list.length - 1; i >= 0; i--) {
      e = list[i]
      if (!e) { list.splice(i, 1); continue }
      if (e.pending) continue
      e.seasonsLeft -= 1
      if (e.seasonsLeft > 0) continue
      if (e.id === 'drought') s.stats.droughtsSurvived += 1
      list.splice(i, 1)
    }
    publishMods(s)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COUNTERPARTIES — economy1 owns the ladder, the species table and every write to `a1.trees`
  // ───────────────────────────────────────────────────────────────────────────

  // loop.js calls this at BIBLE §4 step 10 and rollEvents calls it at every boundary; economy1's
  // ladder is a set of idempotent threshold tests, so calling it twice in a tick costs a scan and
  // changes nothing. Keeping the name here keeps the loop's step order readable.
  function stepNeighbours () {
    if (S().act !== 1) return
    if (HY.economy1 && HY.economy1.stepNeighbours) HY.economy1.stepNeighbours()
  }


  // ───────────────────────────────────────────────────────────────────────────
  // THE TAP
  // ───────────────────────────────────────────────────────────────────────────

  function totalSubstrate (state) {
    var s = state || S(), sum = 0, i
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

  // What a tap would lift right now, before the floor is consulted. Exported for the button face,
  // and the reason mashing is not a strategy: the second tap in a sim tick sees the same `t`, so it
  // finds nothing settled and lifts only the floor.
  function tapLitter (state) {
    var s = state || S()
    var since = num(s.t) - tapAt
    if (!(since > 0)) since = 0
    var settled = since === Infinity ? TAP_MAX : TAP_REGEN * since
    var g = TAP_FLOOR + settled
    return g > TAP_MAX ? TAP_MAX : g
  }

  // Pressure as a fraction of the wall's limit: 0 at a tap, 1 at ripeness, never more. The button
  // draws this same number every frame it is held, so the swell on screen IS the multiplier the
  // simulation will pay out, not a picture of one. The clamp at 1 is the wall itself — the press
  // is stopped, not eased to a halt, which is why the last term is −u³ and not −2u³.
  function turgor (heldS) {
    var u = num(heldS) / TURGOR_RIPE_S
    if (!(u > 0)) return 0
    if (u > 1) u = 1
    return u * u * (2 - u)
  }

  // The steady litter rate of one RHYTHM: a press held `holdS`, a thumb that needs `gapS` to lift
  // and land again, repeated. This is the number every strategy is ranked by — biomass, sugar and
  // thread all scale with the same surge on the same press — and it is written from the same three
  // constants `tapLitter` reads, so it cannot drift from what the button actually pays.
  //
  // It exists because the fault above was invisible without it: a model that leaves `gapS` out is
  // a model of a thumb that teleports, and such a thumb really is paid best by holding to
  // MAT_FULL_S. No hand is. The self-test sweeps this across the real band.
  function pressRate (holdS, gapS) {
    var period = num(holdS) + num(gapS)
    if (!(period > 0)) return 0
    var settled = TAP_FLOOR + TAP_REGEN * period
    return (settled > TAP_MAX ? TAP_MAX : settled) * (1 + TURGOR_GAIN * turgor(holdS)) / period
  }

  // THE COLONY, PER GRAM — metres of thread the same rhythm lays for each gram of litter it lifts.
  //
  // This is the second thing the player is watching, and it is not the rate above. Thread is priced
  // per PRESS and litter accumulates per elapsed SECOND, so the surge appears in BOTH and cancels:
  // what is left is a function of the period alone. A rhythm faster than the mat's refill lifts
  // less each press and therefore lays MORE thread per gram, and a rhythm at or slower than the
  // refill lays the least — the floor's own trade, unchanged by whether the thumb held or tapped.
  //
  // It is written down because the hold could have broken it and did not. The wall's period is
  // TURGOR_RIPE_S + PRESS_LIFT_S, which IS MAT_FULL_S, so a player who holds grows the colony at
  // exactly the metres per gram of the one-press-a-second cadence the act was balanced at — the
  // grams arrive faster, the picture does not fall behind them. Measured with driven touch, both
  // taken at the same 60 g: 0.781 m holding to the wall, 0.765 m at one tap a second. Over three
  // real minutes the two verbs laid 4.459 m and 4.574 m, a 2.5% spread on a plate that draws two
  // segments to the metre — the same picture, and it is the same picture when looked at.
  function threadPerGram (holdS, gapS) {
    var period = num(holdS) + num(gapS)
    if (!(period > 0)) return 0
    var settled = TAP_FLOOR + TAP_REGEN * period
    return A().HYPHAE_PER_TAP / (settled > TAP_MAX ? TAP_MAX : settled)
  }

  // `heldS` is how long the thumb was down, in seconds, and it is optional: a caller that does not
  // pass one is tapping, and a tap is this function exactly as it was written.
  function onExtend (heldS) {
    var s = S()
    if (s.act !== 1) return false
    // The surge multiplies AFTER the mat's own cap, which is the whole claim: a pressurised front
    // does not wait for litter to settle within reach, it goes and gets it.
    var p = turgor(heldS)
    var surge = 1 + TURGOR_GAIN * p
    var g = Math.min(tapLitter(s) * surge, totalSubstrate())
    if (!(g > 0)) return false          // the console says so on its own poll; nothing here advises
    tapAt = num(s.t)

    var got = consume(s, g)
    C().setStock(s.res, 'biomass', num(s.res.biomass) + got.biomass)
    s.res.cumBiomass = num(s.res.cumBiomass) + got.biomass
    C().setStock(s.res, 'sugar', num(s.res.sugar) + got.sugar)
    if (got.minerals > 0) {
      C().setStock(s.res, 'minerals', num(s.res.minerals) + got.minerals)
      s.stats.mineralEarned = num(s.stats.mineralEarned) + got.minerals
    }
    s.a1.hyphaeManual = num(s.a1.hyphaeManual) + A().HYPHAE_PER_TAP * surge
    s.stats.taps += 1

    // `turgor` rides along so the release can be heard as well as felt: one press is one extension
    // however long it was held, and the difference between them belongs in the sound, not the count.
    feel('extend', { grams: got.grams, turgor: p })
    fire('a1.first_tap')
    fire('a1.third_tap')
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TIPS
  // ───────────────────────────────────────────────────────────────────────────

  // `state` is optional on the three readers projects.js delegates to, so a predicate that is being
  // evaluated against a probe or a candidate state can pass it and get an answer about that state
  // rather than about the live one.
  function tipCost (n, state) {
    var s = state || S(), a = A()
    if (n === undefined) n = s.a1.tips
    var coef = flagOn(s, 'foraging_front') ? a.TIP_COEF_FORAGING : a.TIP_COEF
    return Math.ceil(a.TIP_BASE + coef * Math.pow(Math.max(0, n), a.TIP_EXP))
  }

  // The spine of the act. Below tip 24 it is exactly zero, and the four-tip warning window before
  // it is a forecast rather than a wall (`01` §4 unlock 8).
  function tipMineralCost (n, state) {
    var a = A()
    if (n === undefined) n = (state || S()).a1.tips
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
    if (s.a1.tips > num(s.a1.tipsPeak)) s.a1.tipsPeak = s.a1.tips
    feel('buy', { what: 'tip', n: s.a1.tips })
    fire('a1.first_tip')
    if (HY.log && HY.log.bought) HY.log.bought('tip')
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DEADHEADING — the only thing in the game that costs tissue
  // ───────────────────────────────────────────────────────────────────────────

  // Everything else the player buys is paid for out of the labile pool, and the colony on the
  // canvas goes on growing through every purchase — which is why the headline number no longer
  // falls for one. This is the exception, and it is the reason the exception is worth having: a
  // cut takes a fifth of the front off, the mass laid down to build those tips leaves the
  // organism, and the canvas thins with it because it draws from `a1.tips`. The number falls, the
  // picture agrees, and the player did it on purpose.
  //
  // The tissue is priced at the tips' own build cost — the grams that were paid for exactly those
  // rungs of the ladder — because that is the mass standing there. Any other figure would be a
  // loss with no referent on screen.
  function pruneCount (state) {
    var s = state || S(), a = A()
    var n = s.a1.tips
    if (n < a.PRUNE_MIN_TIPS) return 0
    var k = Math.ceil(n * a.PRUNE_FRAC)
    // Never cut below the mineral gate. A cut that leaves the colony unable to hold the rung it
    // has already climbed is not a concentration, it is a demolition.
    if (n - k < a.PRUNE_MIN_TIPS) k = n - a.PRUNE_MIN_TIPS
    return k > 0 ? k : 0
  }

  function pruneTissue (state) {
    var s = state || S()
    var k = pruneCount(s), n = s.a1.tips, g = 0, i
    for (i = n - k; i < n; i++) g += tipCost(i, s)
    return g
  }

  // The mat's reach does not shrink when tips are cut. `tipsPeak` is how wide the front has ever
  // been, and the litter within that reach is shared out among the tips actually standing — so
  // cutting a fifth of them feeds the rest a fifth better, and the term decays to 1.00 exactly as
  // the front regrows. That is what makes a cut cost 0.894× rather than 0.715×: only the enzyme
  // column (n^0.50) is lost, not the linear tip term. It is also why deadheading can never be
  // farmed for throughput — regrow and you are precisely where you started, minus the tissue.
  function concentration (state) {
    var s = state || S(), a = A()
    var n = s.a1.tips
    if (!(n > 0)) return 1
    var peak = num(s.a1.tipsPeak)
    if (peak < n) peak = n
    var c = peak / n
    if (c < 1) return 1
    return c > a.PRUNE_CONC_MAX ? a.PRUNE_CONC_MAX : c
  }

  // No cut counter and no cooldown. The floor at PRUNE_MIN_TIPS and the salvage being under 1.00
  // are the whole of the limit: a colony cut to the gate cannot be cut again until it has regrown,
  // and every gram that comes back came out of something that was standing.
  function canDeadhead (state) {
    var s = state || S()
    return s.act === 1 && pruneCount(s) > 0
  }

  function deadhead () {
    var s = S()
    if (!canDeadhead(s)) return false
    var k = pruneCount(s)
    var g = pruneTissue(s)
    // The peak is latched before the cut, not after: it is the reach the mat already has, and the
    // whole concentration term is the difference between that and what is left standing.
    if (s.a1.tips > num(s.a1.tipsPeak)) s.a1.tipsPeak = s.a1.tips
    s.a1.tips -= k
    // The size falls by the whole of it, and `cumBiomass` is untouched: the colony did lay that
    // mass down, and Act II's ladders are lifetime thresholds that must not fall back through
    // themselves. `state.standing()` is what subtracts this.
    s.res.pruned = num(s.res.pruned) + g
    // Autolysis. A senescing hypha is emptied before it is abandoned, and what comes back is
    // spendable rather than structural — so it lands in the labile pool and NOT in cumBiomass,
    // which counts what was produced and never what was recycled.
    var back = g * A().PRUNE_SALVAGE
    if (back > 0) C().setStock(s.res, 'biomass', num(s.res.biomass) + back)
    // A cut is a commit, not an extension: the same sound the interface makes for every other
    // thing the player decides to spend. What it costs is on the strip, not in the mix.
    feel('buy', { what: 'deadhead', n: k })
    fire('a1.deadhead')
    return true
  }

  function hyphae (state) {
    var s = state || S(), a = A()
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

  // `08` §4.1's `E` column: the enzyme·structure multiplier every published Act I price is quoted
  // against. It is not decoration. §0.3 S2 derives `tipCost`'s exponent 1.72 from `E ∝ n^0.50`, and
  // §5.1 proves the payback corridor against this column and no other. Against it the tip cadence
  // is flat at 24–27 s for the whole act, which is §3.2's central claim; against a flat E it climbs
  // 15 s → 78 s and brushes the 90 s wall §5.1 forbids, and every biomass-priced gate behind it —
  // the patch ladder, Anastomosis, Action Potential — arrives late by the same growing ratio. A
  // 249-minute act is that ratio integrated.
  //
  // What the shipped adaptation ladder actually pays is structure ×1.18 and ×1.25 and nothing
  // else: `mult.enzymeMult` is initialised to 1.00 by state.js and written by no project in the
  // catalog, so the product tops out at 1.475 against a column that ends at 4.60. act1 is the one
  // place E is assembled, so act1 holds the column open.
  //
  // The applied value is the LARGER of the ladder and the column, never their product. That is
  // deliberate and it is what makes this table self-cancelling: an adaptation tier added to the
  // catalog tomorrow takes the slack back rather than stacking on top of it, so the act cannot be
  // sped up twice for the same reason. Per-type `enzymeK` is a separate refinement applied inside
  // stepDecomposition and is left strictly alone.
  //
  // `08` states E twice and the two statements disagree. §4.1's affordability table tabulates
  // 1.25 / 1.55 / 2.60 / 4.10 / 4.60 at n = 24 / 60 / 120 / 200 / 255; §0.3 S2 states the *fit*,
  // `E ∝ n^0.50` with E = 1.00 at n = 7, which reaches 6.04 at 255. The fit wins, because the fit
  // is what `tipCost`'s shipped exponent was solved against — S2 sets `C(n) ∝ n·E(n)` to hold the
  // purchase cadence flat and lands on 1.72 only if E carries n^0.50. Priced against §4.1's table
  // instead, the same 1.72 gives a cadence that grows 18 s → 25 s and an act that measures 160
  // minutes against D14's 95–125. Priced against the fit it is flat at 12–19 s, which is what
  // §3.2 and §4.1's own payback column (13.7–22.2 s) both claim, and the act lands inside D14.
  var E_REF_TIPS = 7        // tips at which the fit puts E = 1.00 (S2)
  var E_EXP = 0.50          // dimensionless, E ∝ tips^this (S2); the exponent 1.72 was solved on it
  var E_CAP = 6.04          // the fit's own value at the 255-tip handoff (S5): the ladder is finite

  function columnE (tips) {
    if (!(tips > E_REF_TIPS)) return 1
    var e = Math.pow(tips / E_REF_TIPS, E_EXP)
    return e > E_CAP ? E_CAP : e
  }

  // Enzymes × structure, as one number. Exported so the HUD and economy1's runway arithmetic read
  // the same E the tick does rather than re-deriving a second one that agrees only today.
  function enzymeStructure (state) {
    var s = state || S()
    var ladder = num(s.mult.enzymeMult) * num(s.mult.structureMult)
    var floorE = columnE(s.a1.tips)
    return ladder > floorE ? ladder : floorE
  }

  // 1.875 g/s of budget per tip (S1). One tip on leaf is 3.000 g of litter, 1.500 g of biomass and
  // 0.480 g of sugar per second — the button face is the first of those and it is exact, because
  // `E_COLUMN` opens at exactly 1.00 and the tip that prints it is the first one bought.
  function throughputPerSec (state) {
    var s = state || S()
    if (s.act !== 1) return 0
    var v = A().TIP_THROUGHPUT * s.a1.tips *
      enzymeStructure(s) * concentration(s) * num(s.mult.prestigeGrowth) *
      num(s.mult.patchMult) *
      moistureMult(s) * tempMult(s)
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

  function sugarCap (state) {
    var s = state || S(), a = A()
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
  function patchSupplyMult (state) { return Math.pow((state || S()).a1.patches, A().PATCH_SUPPLY_EXP) }
  function patchCapMult (state) { return (state || S()).a1.patches }

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
    // of the New Neighbour rule, and economy1's ladder reads the patch count directly.
    stepNeighbours()
    feel('claim', { patch: s.a1.patches })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DERIVED READOUTS
  // ───────────────────────────────────────────────────────────────────────────

  // The litter the network is asking for, in grams per second — the units the forest's supply is
  // in. When a pool empties the demand does not fall, which is exactly what the alarm must see.
  function demandPerSec (state) {
    var s = state || S(), order = s.a1.consumptionOrder, i, k, first = null
    for (i = 0; i < order.length; i++) {
      k = order[i]
      if (!DECOMP[k] || s.a1.unlockedTypes.indexOf(k) < 0) continue
      if (first === null) first = k
      if (num(s.a1.sub[k]) > 0) return throughputPerSec(s) * DECOMP[k].k * enzK(s, k)
    }
    if (first === null) return 0
    return throughputPerSec(s) * DECOMP[first].k * enzK(s, first)
  }

  function forestSupply (state) {
    return A().FOREST_SUPPLY_BASE * patchSupplyMult(state)
  }

  function utilisation (state) {
    var s = state || S()
    var sustainable = forestSupply(s) * A().SUSTAINABLE_FRAC
    if (!(sustainable > 0)) return 0
    return demandPerSec(s) / sustainable
  }

  function litterPerSec () { return litterRate }
  function isStarving () { return starving }

  // G1b's feedstock reserve, in sugar: the part of the next 60 seconds of feedstock that is not
  // already on the floor. economy1 enforces it in the delivery scheduler and owns the formula —
  // there is exactly one, and the HUD must read the same number the scheduler acts on. What remains
  // here is the standalone fallback for a build in which economy1 has not been concatenated.
  function feedstockReserve () {
    if (HY.economy1 && HY.economy1.reserveSugar) return num(HY.economy1.reserveSugar())
    var s = S()
    if (totalSubstrate() < 1) return 0            // G1c: the reserve must never become the deadlock
    var price = minPrice(s)
    if (!isFinite(price)) return 0
    var owed = A().RESERVE_S - runwaySeconds(s)
    return owed > 0 ? owed * demandPerSec() * price : 0
  }

  // Seconds the floor can feed the network for, consumed in the player's own order at
  // `throughput · k · enzymeK` grams a second. Hard substrate is worth more runway per gram than
  // soft, which is the same fact the consumption order is a decision about.
  function runwaySeconds (state) {
    var s = state || S(), thr = throughputPerSec(s), i, k, have, effK, sec = 0
    if (!(thr > 0)) return Infinity
    for (i = 0; i < s.a1.consumptionOrder.length; i++) {
      k = s.a1.consumptionOrder[i]
      if (!DECOMP[k] || s.a1.unlockedTypes.indexOf(k) < 0) continue
      have = num(s.a1.sub[k])
      if (!(have > 0)) continue
      effK = DECOMP[k].k * enzK(s, k)
      if (effK > 0) sec += have / (thr * effK)
    }
    return sec
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
    return s.a1.trees.length > 0 ||
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
    // Reputation is not zeroed, it is deleted: Act II's standing is a fresh, separate pair of
    // scalars and nothing the player built here is carried into it (C16).
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
    tapAt = -Infinity
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
    stepNeighbours()
  }

  // Everything act1 owns is a key in §3; state.js serialises all of it. Nothing here is private
  // enough to need a second copy of the save.
  function serialise () { return null }

  function migrate (save) {
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
    return save
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — returns [] when healthy
  // ───────────────────────────────────────────────────────────────────────────

  // `08` §7's minute-by-minute table, restated as the four rows the throughput chain must
  // reproduce. `mult` is the aggregate of the multiplier ladder the table's own rows say the
  // reference player is holding at that minute: nothing at 1 and 5; the second enzyme tier by 15;
  // that plus Rhizomorph Cords and the second patch by 30. `litter` is the table's g/s column.
  //
  // The rows are asserted through the E supersession rather than against their printed g/s, because
  // `08` states E three times and two of the three are superseded. §7's table and §4.1's
  // affordability table both assume the ladder alone; §0.3 S2 states the fit, `E ∝ n^0.50`, and the
  // fit is the one `tipCost`'s shipped exponent was solved against and the only one that satisfies
  // D14 — measured, the ladder alone gives a 160-minute Act I against a 95–125 minute requirement.
  // So each row is required to reproduce its published litter *times the ratio the supersession
  // predicts, exactly*. Everything else in the chain — TIP_THROUGHPUT, the tip count, the seasonal
  // envelope, leaf's k — is still pinned to the digit, and any drift in any of them still fails.
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

      // ── deadheading ──────────────────────────────────────────────────────
      // The one verb allowed to make the colony smaller, so the one verb whose arithmetic has to
      // be checked in both directions: what leaves, and what comes back.
      cold(1)
      var ds = S()
      ds.a1.tips = 20
      ok(!canDeadhead(ds), 'a cut below the mineral gate was offered')
      ds.a1.tips = 55
      ds.a1.tipsPeak = 55
      ds.res.cumBiomass = 100000
      ds.res.biomass = 1000
      ds.res.pruned = 0
      var cutK = pruneCount(ds)
      var cutG = pruneTissue(ds)
      var thruBefore = throughputPerSec(ds)
      near(cutK, Math.ceil(55 * A().PRUNE_FRAC), 0, 'a cut is not a fifth of the front')
      ok(cutG > 0, 'a cut priced the tissue it removes at nothing')
      ok(deadhead(), 'the cut was refused with the gate clear')
      near(ds.a1.tips, 55 - cutK, 0, 'the front did not thin')
      near(ds.res.pruned, cutG, 1e-6, 'the tissue removed is not what the control quoted')
      near(ds.res.cumBiomass, 100000, 0, 'a cut moved lifetime production')
      near(HY.state.standing(ds), 100000 - cutG, 1e-6, 'the size did not fall by the tissue')
      near(ds.res.biomass, 1000 + cutG * A().PRUNE_SALVAGE, 1e-6, 'the salvage is not what was quoted')
      // The whole point of the concentration term: the linear tip loss is carried by the mat, so
      // the cut costs the enzyme column and nothing else.
      var lost = throughputPerSec(ds) / thruBefore
      var wantLost = Math.pow((55 - cutK) / 55, E_EXP)
      near(lost, wantLost, 0.02, 'a cut cost more than the enzyme column')
      // And it is not farmable: regrow to the peak and the term is gone.
      ds.a1.tips = 55
      near(concentration(ds), 1, 1e-9, 'the concentration survived the regrowth that cancels it')
      // The floor holds against repetition rather than against a counter.
      ds.a1.tips = A().PRUNE_MIN_TIPS
      ok(!canDeadhead(ds), 'the colony was cut below the gate it had already climbed')

      // The decomposition columns and economy1's market columns are two views of `01` §5.5's one
      // table, split because they are read on different sides of a module boundary. They are not
      // allowed to drift: a k that disagrees moves the bottleneck without moving the price.
      var df = HY.economy1 && HY.economy1.DEADFALL
      if (df) {
        for (i = 0; i < TYPES.length; i++) {
          var dr = df[i], dl = DECOMP[TYPES[i]]
          ok(dr && dr.id === TYPES[i], 'the deadfall table is out of order at ' + TYPES[i])
          near(dl.k, dr.k, 0, TYPES[i] + ': k disagrees across the module boundary')
          near(dl.etaB, dr.etaB, 0, TYPES[i] + ': etaB disagrees across the module boundary')
          near(dl.etaS, dr.etaS, 0, TYPES[i] + ': etaS disagrees across the module boundary')
          near(dl.mineralPerG, dr.minPerG, 0, TYPES[i] + ': mineralPerG disagrees')
        }
      }

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
      // The tap is cadence-limited now, so a comfortable thumb and the reference thumb reach the
      // same place: the 90-second count no longer separates them and the same band is asserted for
      // both. A build where 2.00/s beat 1.70/s at 90 s would be a build that pays for mashing.
      var r20 = simulate({ tapRate: 2.00, until: 90 })
      within(r20.firstTipAt, 28, 50, 'D05 at 2.00 taps/s')
      within(r20.tipsAt90, 4, 9, 'D06 tips at 90 s, comfortable thumb')

      // The tap is not vestigial until t ≈ 100 s (window W1): tapping must beat waiting at 1 tip.
      ok(1.70 * 1.0 > 1.50, 'W1: the tap stopped mattering before the third tip')

      // ── the throughput chain against 08 §7, through the E supersession ───
      for (i = 0; i < REF.length; i++) {
        var row = REF[i]
        cold(4)
        s = S()
        s.a1.tips = row.tips
        s.a1.season = row.season
        s.mult.enzymeMult = row.mult
        s.a1.moisture = moistureFor(row.season, row.env)
        var litter = throughputPerSec() * DECOMP.leaf.k
        // What §7 printed, times the ratio S2's fit puts on that row's tip count. At minute 1 the
        // fit does not bind at all (two tips is below its E = 1.00 anchor) and the row is asserted
        // exactly as published, which is the check that the opening beat is untouched.
        var want = row.litter * Math.max(row.mult, columnE(row.tips)) / row.mult
        ok(Math.abs(litter - want) / want <= 0.15,
          '08 §7 minute ' + row.min + ': litter ' + litter.toFixed(1) + ' g/s vs ' + want.toFixed(1))
      }
      // The supersession is one factor in one place and it is bounded on both ends.
      near(columnE(0), 1, 0, 'the E column does not open at 1.00')
      near(columnE(E_REF_TIPS), 1, 1e-12, 'the E column does not pass through S2\'s anchor')
      near(columnE(255), 6.04, 0.01, 'the E column misses S2\'s fit at the handoff tip count')
      near(columnE(4000), E_CAP, 0, 'the E column is not capped')
      var pe = 0
      for (g = 0; g <= T().NUM.INT_MAX.tips; g++) {
        ok(columnE(g) >= pe, 'the E column is not monotone at tip ' + g)
        pe = columnE(g)
      }
      // And it is a floor, not a factor: a ladder that overtakes it takes the slack back rather
      // than multiplying by it, which is what keeps a future adaptation tier from paying twice.
      cold(4)
      s = S()
      s.a1.tips = 120
      near(enzymeStructure(s), columnE(120), 1e-12, 'the floor did not carry a bare ladder')
      s.mult.structureMult = 100
      near(enzymeStructure(s), 100, 1e-12, 'the floor did not stand down for a bigger ladder')

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
      near(litterOf(), 1.875 * 10 * columnE(10) * DECOMP.stump.k, 1e-6,
        'the stump throughput weight is wrong')
      ok(wood / litterOf() > 1.0, 'stumps do not out-yield leaf per gram')

      // ── the tap, and the reason mashing is not a strategy ───────────────
      cold(5)
      s = S()
      // The mat is undisturbed at t = 0, so the first tap lifts everything a tap can.
      near(tapLitter(s), TAP_MAX, 1e-12, 'the first tap does not lift a full mat')
      ok(onExtend(), 'the first tap did nothing')
      near(num(s.res.biomass), TAP_MAX * A().ETA_B * DECOMP.leaf.etaB, 1e-9, 'the first tap yield')
      near(num(s.res.sugar), TAP_MAX * A().ETA_S * DECOMP.leaf.etaS, 1e-9, 'the first tap sugar')
      near(num(s.a1.sub.leaf), A().BOOT_SUB_LEAF - TAP_MAX, 1e-9, 'a tap did not eat what it lifted')
      near(num(s.a1.hyphaeManual), A().HYPHAE_PER_TAP, 1e-12, 'S4: a tap is 0.020 m')
      ok(s.stats.taps === 1, 'the tap was not counted')
      // A second tap in the same sim tick finds nothing settled: it lifts the floor and no more.
      near(tapLitter(s), TAP_FLOOR, 1e-12, 'mashing inside one tick still pays')
      onExtend()
      near(num(s.a1.sub.leaf), A().BOOT_SUB_LEAF - TAP_MAX - TAP_FLOOR, 1e-9,
        'the second tap of a tick lifted more than the floor')
      // And a tap after a full regeneration window is worth a full mat again.
      s.t += TAP_MAX / TAP_REGEN
      near(tapLitter(s), TAP_MAX, 1e-9, 'the mat did not refill')
      for (i = 0; i < TYPES.length; i++) C().setStock(s.a1.sub, TYPES[i], 0)
      ok(onExtend() === false, 'the tap worked on a bare floor')
      // D05 across the whole plausible thumb band. The window is the pass condition (BIBLE §8.1);
      // TIP_BASE stays 60 g and the tap's *cadence* is what carries it (BIBLE §9.1).
      var band = [1, 2, 3, 5], bi, br
      for (bi = 0; bi < band.length; bi++) {
        br = simulate({ tapRate: band[bi], until: 90 })
        within(br.firstTipAt, 28, 50, 'D05 at ' + band[bi] + ' taps/s')
      }
      // Mashing five times harder may not be worth more than a third more litter, or the button is
      // a dexterity test and D05 becomes a function of the player's wrist.
      ok(simulate({ tapRate: 1 }).firstTipAt / simulate({ tapRate: 5 }).firstTipAt < 1.45,
        'the tap still rewards mashing')

      // ── turgor: the same verb, held ──────────────────────────────────────
      near(turgor(0), 0, 0, 'a release with no hold is not exactly a tap')
      near(turgor(-1), 0, 0, 'a negative hold is not a tap')
      near(turgor(TURGOR_RIPE_S), 1, 1e-12, 'the wall is not at pressure at ripeness')
      near(turgor(TURGOR_RIPE_S * 9), 1, 1e-12, 'pressure kept climbing past the wall')
      ok(turgor(TURGOR_RIPE_S * 0.25) < 0.25,
        'the wall gave at once — there is no resistance to push against')
      ok(TURGOR_GAIN * turgor(0.10) < 0.03,
        'a tenth of a second is no longer a tap: the shipped game is not inside the held one')
      for (i = 1; i <= 20; i++) {
        ok(turgor(TURGOR_RIPE_S * i / 20) > turgor(TURGOR_RIPE_S * (i - 1) / 20),
          'pressure did not rise monotonically')
      }
      // THE WALL STOPS THE PRESS, it does not fade it out. This is the structural guard on the
      // whole section below: any curve that arrives at ripeness with zero slope — a smoothstep
      // does — buys nothing with its last instant while still spending time on it, so the payoff
      // peaks strictly BEFORE the mark under every possible tuning of every other constant. The
      // cubic reaches the wall at unit speed (p′(1) = 1, i.e. 1/TURGOR_RIPE_S per second) and the
      // clamp is what ends the press.
      var slopeEps = 1e-4
      ok((turgor(TURGOR_RIPE_S) - turgor(TURGOR_RIPE_S - slopeEps)) / slopeEps > 0.5 / TURGOR_RIPE_S,
        'the curve eases to a halt at the wall — the optimum cannot be at the mark')
      // And ripeness is derived, not typed: it is the tap table's own refill window less the one
      // fact about hands. If someone edits the mat, the wall moves with it or this fails.
      near(TURGOR_RIPE_S + PRESS_LIFT_S, (TAP_MAX - TAP_FLOOR) / TAP_REGEN, 1e-12,
        'the wall is no longer the moment the mat runs dry for a thumb that has to lift')

      // ── THE MARKED MOMENT IS THE OPTIMUM ────────────────────────────────
      // The assertion that should always have been here. Sweep every release time a thumb could
      // choose, in 0.05 s steps out to well past the wall, at every thumb-lift gap in the human
      // band, and demand that the best of them is the one the button turns green on.
      //
      // The old assertion compared one hold against one tap rate with NO dead time between presses
      // — a thumb that releases and is already pressing again in the same instant. That thumb is
      // the only one for which the old 1.000 s wall was optimal, which is how a button that marked
      // a moment 14% worse than releasing early passed its own test five times.
      var gaps = [0.15, 0.20, 0.25, 0.30, 0.35, 0.40], gi, k, hh, bestH, bestR, r
      for (gi = 0; gi < gaps.length; gi++) {
        bestH = -1; bestR = -1
        for (k = 0; k <= 40; k++) {
          hh = k * 0.05
          r = pressRate(hh, gaps[gi])
          if (r > bestR) { bestR = r; bestH = hh }
        }
        near(bestH, TURGOR_RIPE_S, 1e-9,
          'the best release is not the marked one at a ' + gaps[gi] + ' s lift')
        // Not by a hair, either: a maximum inside the noise of a human release is not a maximum a
        // player can act on. The nearest rival is always the pure tap at the same cadence.
        ok(bestR > pressRate(0, gaps[gi]) * 1.02,
          'the wall beats tapping only inside the noise at a ' + gaps[gi] + ' s lift')
      }
      // Locally, from both sides, at the modelled thumb: the mark is a peak and not a shoulder.
      ok(pressRate(TURGOR_RIPE_S, PRESS_LIFT_S) > pressRate(TURGOR_RIPE_S - 0.05, PRESS_LIFT_S),
        'the press was still worth more before the wall')
      ok(pressRate(TURGOR_RIPE_S, PRESS_LIFT_S) > pressRate(TURGOR_RIPE_S + 0.05, PRESS_LIFT_S),
        'holding past the wall still paid')
      // ── THE COLONY MUST NOT FALL BEHIND THE NUMBER ──────────────────────
      // The rate above is only half of what the player is watching; the other half is the picture,
      // and a verb that piles up grams while the network stops growing is the Paperclips failure in
      // a different costume. Thread is per press and litter is per second, so the guard is that the
      // wall's rhythm lays exactly the metres per gram of the cadence the act was balanced at.
      near(threadPerGram(TURGOR_RIPE_S, PRESS_LIFT_S), threadPerGram(0, 1), 1e-12,
        'holding to the wall grows the colony at a different rate per gram than a tap a second')
      // Never below it, at any lift a hand produces — the surge cancels, so this can only fail if
      // someone gives the hold its own thread multiplier and forgets the litter one, or moves the
      // wall off the mat's refill. Both have been done to this file.
      for (gi = 0; gi < gaps.length; gi++) {
        ok(threadPerGram(TURGOR_RIPE_S, gaps[gi]) >= threadPerGram(0, 1) - 1e-12,
          'the hold lays less thread per gram than the balanced tap at a ' + gaps[gi] + ' s lift')
      }
      // And the trade itself is real and belongs to the PERIOD, not to the verb: a thumb faster
      // than the mat's refill buys thread with grams whether it holds or not.
      ok(threadPerGram(0, 1 / 3) > threadPerGram(TURGOR_RIPE_S, PRESS_LIFT_S),
        'a rhythm faster than the mat does not lay more thread per gram')
      near(threadPerGram(0.2, 0.3), threadPerGram(0, 0.5), 1e-12,
        'metres per gram depends on something other than the period')
      // And the hold is the fastest rhythm on the floor, against every tap rate a thumb produces —
      // including the masher, who used to beat it. `pressRate(0, 1/f)` IS tapping at f a second.
      var tapf = [1, 1.28, 1.7, 2, 3, 5], ti
      for (ti = 0; ti < tapf.length; ti++) {
        ok(pressRate(TURGOR_RIPE_S, PRESS_LIFT_S) > pressRate(0, 1 / tapf[ti]) * 1.05,
          'holding to the wall does not beat ' + tapf[ti] + ' taps a second')
      }
      // The surge is a multiplier on a full mat, and it is exactly the one turgor() draws.
      cold(5)
      s = S()
      ok(onExtend(TURGOR_RIPE_S), 'a held extension did nothing')
      near(num(s.res.biomass), TAP_MAX * (1 + TURGOR_GAIN) * A().ETA_B * DECOMP.leaf.etaB, 1e-9,
        'a ripe release is not worth its gain over a tap')
      near(num(s.a1.hyphaeManual), A().HYPHAE_PER_TAP * (1 + TURGOR_GAIN), 1e-12,
        'the front did not travel further than a tap would')
      ok(s.stats.taps === 1, 'a hold counted as more than one extension')
      // Holding past ripeness pays nothing further, which is what makes holding forever a mistake
      // the player can find on their own without ever being punished for it.
      cold(5)
      s = S()
      onExtend(TURGOR_RIPE_S * 4)
      near(num(s.res.biomass), TAP_MAX * (1 + TURGOR_GAIN) * A().ETA_B * DECOMP.leaf.etaB, 1e-9,
        'a four-second hold paid more than a ripe one')
      // D05 for the thumb that holds, across the band a real one lands in — every one of these
      // costs its hold PLUS a PRESS_LIFT_S lift, because that is what a press is. The hold band and
      // the tap band above are the same pass condition and neither may leave the window.
      // 0.30 s is a third of the mark and 1.20 s is twice it: the wall is a mark to aim at, not a
      // knife edge, and missing it by a factor of two in either direction must still be a game.
      var hband = [0.30, TURGOR_RIPE_S, 0.90, 1.20], hi
      for (hi = 0; hi < hband.length; hi++) {
        br = simulate({ holdS: hband[hi], until: 90 })
        within(br.firstTipAt, 28, 50, 'D05 holding ' + hband[hi] + ' s')
      }
      // The wall must also be the fastest opening, not merely a legal one: a player who finds the
      // mark reaches the first tip before a player who holds either side of it, and before the
      // steady thumb at 1.7 taps a second. This is the same claim the sweep makes, run through the
      // whole act — season, moisture, buy policy and all — rather than through the rate alone.
      ok(simulate({ holdS: TURGOR_RIPE_S }).firstTipAt < simulate({ tapRate: 1.7 }).firstTipAt,
        'holding to ripeness is slower than tapping')
      ok(simulate({ holdS: TURGOR_RIPE_S }).firstTipAt < simulate({ holdS: 1.0 }).firstTipAt,
        'over-holding past the wall reached the first tip sooner than the wall did')
      // The thumb that cannot hold at all is not left behind: the tap path stays inside the window
      // at every gap it can produce, which the tap band above asserts, and one press a second is
      // the number the game shipped with to the gram (TAP_FLOOR + TAP_REGEN = TAP_MAX).
      near(TAP_FLOOR + TAP_REGEN, TAP_MAX, 1e-12,
        'one press a second no longer lifts exactly a full mat')

      // ── the mineral gate: a wall with four tips of warning ───────────────
      cold(5)
      s = S()
      s.res.biomass = 1e9
      s.a1.tips = A().MIN_WARN_TIPS
      ok(reveals().mineralWarn && !reveals().mineralGate, 'the warning window is not four tips wide')
      ok(buyTip(), 'a tip below the gate needed a mineral')
      s.a1.tips = A().MIN_GATE_TIPS
      s.res.minerals = 0
      ok(!buyTip(), 'tip 24 was bought without a mineral')
      s.res.minerals = 1
      ok(buyTip(), 'tip 24 refused the mineral it was given')
      near(num(s.res.minerals), 0, 1e-9, 'the gate did not take the mineral')

      // ── carrion, the act's only fast mineral (C35) ───────────────────────
      cold(5)
      s = S()
      s.a1.tips = 100
      s.a1.season = AUTUMN
      s.a1.moisture = A().MOIST_OPT
      s.a1.unlockedTypes.push('carrion')
      for (i = 0; i < TYPES.length; i++) C().setStock(s.a1.sub, TYPES[i], 0)
      s.a1.sub.carrion = 3000
      s.a1.consumptionOrder = ['carrion'].concat(TYPES)
      stepDecomposition(1.0)
      var ate = 3000 - num(s.a1.sub.carrion)
      near(num(s.res.minerals), ate * DECOMP.carrion.mineralPerG, 1e-9, 'carrion did not pay minerals')
      near(num(s.res.sugar), ate * A().ETA_S * DECOMP.carrion.etaS, 1e-9, 'carrion sugar yield')
      near(num(s.stats.mineralEarned), num(s.res.minerals), 1e-12, 'mineralEarned was not credited')
      // 0.100 g of sugar back for 0.240 of price is the −140% margin that makes every contract
      // rate look like a compromise rather than a gift.
      ok(A().ETA_S * DECOMP.carrion.etaS < 0.240, 'carrion stopped being sugar-negative')

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

      // ── the feedstock runway, and the reserve written against it ─────────
      // G1b holds back sugar for the next RESERVE_S seconds of food. Runway is what makes that a
      // reserve rather than a freeze: it is counted in tip-seconds, so hard substrate is worth more
      // of it per gram, and a floor already deeper than the window owes nothing.
      cold(6)
      s = S()
      s.a1.tips = 50
      s.a1.season = AUTUMN
      s.a1.moisture = A().MOIST_OPT
      for (i = 0; i < TYPES.length; i++) C().setStock(s.a1.sub, TYPES[i], 0)
      var leafRate = throughputPerSec() * DECOMP.leaf.k
      C().setStock(s.a1.sub, 'leaf', 12 * leafRate)
      near(runwaySeconds(), 12, 0.02, 'runwaySeconds misread a twelve-second floor')
      // The floor is eaten at exactly the rate the runway claims.
      stepDecomposition(6.0)
      near(runwaySeconds(), 6, 0.02, 'six seconds of eating did not spend six seconds of runway')
      // Two pools of different hardness add their own seconds, not their grams.
      C().setStock(s.a1.sub, 'leaf', 4 * leafRate)
      s.a1.unlockedTypes.push('stump')
      C().setStock(s.a1.sub, 'stump', 9 * throughputPerSec() * DECOMP.stump.k)
      near(runwaySeconds(), 13, 0.02, 'runway does not sum across pools of different hardness')
      ok(num(s.a1.sub.stump) < num(s.a1.sub.leaf),
        'the hard pool was not the smaller one: the test would prove nothing')
      // And the number the HUD prints is the number the delivery scheduler actually withheld this
      // frame, not a second implementation of it that happens to agree today.
      if (HY.economy1 && HY.economy1.deliverContracts && HY.economy1.bookState) {
        HY.economy1.deliverContracts(0.1, { stochastic: false })
        near(feedstockReserve(), num(HY.economy1.bookState().reserve), 1e-9,
          'the HUD reserve and the scheduler reserve are two different numbers')
      }
      for (i = 0; i < TYPES.length; i++) C().setStock(s.a1.sub, TYPES[i], 0)
      near(feedstockReserve(), 0, 0, 'G1c: the reserve did not collapse on a bare floor')

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
      // The understory has to be open before a claim can introduce anybody: the panel is earned in
      // sugar, in winter, and a patch does not un-earn it.
      s.res.sugar = A().TREES_SUGAR_G + 1
      s.a1.season = WINTER
      claimPatch(2)
      s.t += A().PATCH[1].claimS
      stepClaim()
      ok(s.a1.patches === 2, 'the claim did not complete')
      near(s.mult.patchMult, 1 + A().PATCH_MULT_STEP, 1e-9, 'patchMult was not resynced')
      near(patchSupplyMult(), Math.pow(2, 1.8), 1e-9, 'S3: fall must scale as patches^1.8')
      near(patchCapMult(), 2, 1e-9, 'S3: cap must stay linear in patches')
      ok(s.a1.trees.length >= 1, 'the second patch introduced no counterparty')

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
      for (i = 0; i < 7; i++) {          // `01` §6.2's ceiling of simultaneous counterparties
        s.a1.trees.push({ id: i + 1, species: 'fir', age: 80, health: 1, rep: 50, ramets: 1,
          refuseUntil: 0, lastReneg: 0, mastYear: -1 })
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
      stepNeighbours()
      ok(s.a1.trees.length === 1 && s.a1.trees[0].species === 'birch',
        'the first counterparty is not a birch')
      // MINOR 6 / BLOCKER 2: exactly one module mints trees, and it mints them with unique ids.
      ok(HY.economy1.spawnTree.length === 1,
        'economy1.spawnTree no longer takes exactly (species)')
      var idsSeen = {}, dupe = false
      s.a1.patches = 6
      stepNeighbours()
      for (i = 0; i < s.a1.trees.length; i++) {
        if (idsSeen[s.a1.trees[i].id]) dupe = true
        idsSeen[s.a1.trees[i].id] = 1
      }
      ok(!dupe, 'two counterparties share one id')
      ok(s.a1.trees.length > 1, 'the patch ladder introduced nobody')
      s.a1.patches = 1
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
  //
  // `holdS` models the other thumb: a player who charges for that many seconds and releases, over
  // and over — so `{ holdS: TURGOR_RIPE_S }` is the ripeness rhythm and `{ tapRate: 3 }` is the
  // masher, and D05 has to hold for both of them.
  //
  // THE PERIOD IS holdS + gapS, NEVER holdS. This function used to divide by the hold alone, which
  // models a thumb that releases and is already pressing again in the same instant. No such thumb
  // exists, and pretending otherwise is exactly why the mismarked wall survived five rounds of
  // self-test: the impossible thumb is the only one for whom holding to MAT_FULL_S was optimal.
  // `gapS` defaults to PRESS_LIFT_S and a caller may pass any value in the human band to probe it.
  function simulate (opts) {
    var s = cold(7)
    var dt = T().CLOCK.DT_A1
    var holdS = num(opts.holdS)
    var gapS = typeof opts.gapS === 'number' ? opts.gapS : PRESS_LIFT_S
    var tapRate = holdS > 0 ? 1 / (holdS + gapS) : opts.tapRate
    var out = { firstTipAt: -1, boughtFirst: false, tipsAt90: 0, tipsAt120: 0 }
    var credit = 0, elapsed = 0

    while (elapsed < 121) {
      credit += tapRate * dt
      while (credit >= 1) { credit -= 1; onExtend(holdS) }
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
    deadhead: deadhead,
    canDeadhead: canDeadhead,
    pruneCount: pruneCount,
    pruneTissue: pruneTissue,
    concentration: concentration,
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
    stepNeighbours: stepNeighbours,
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
    enzymeStructure: enzymeStructure,
    claimProgress: claimProgress,
    reveals: reveals,
    seasonName: seasonName,
    mineralMult: mineralMult,
    get starving () { return isStarving() },
    DECOMP: DECOMP,
    tapLitter: tapLitter,
    // The button holds the thumb; the floor owns what the pressure is worth. ui.js asks this every
    // frame of a hold rather than keeping a curve of its own, so there is exactly one turgor curve
    // in the build and the swell cannot drift from the payout.
    turgor: turgor,
    // The wall's own duration, so nothing outside this file has to write 0.600 down a second time.
    // It is derived here (MAT_FULL_S − PRESS_LIFT_S) and moves when the tap table moves.
    turgorRipeS: TURGOR_RIPE_S,
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
