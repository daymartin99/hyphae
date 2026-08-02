;(function (HY) {
  'use strict'

  // M4 · projects.js — the progression engine and the 163-entry catalog (BIBLE §6 M4).
  //
  // Two predicates, never one. `trigger` answers *does this exist yet*; `cost` answers *can I afford
  // it*. They are evaluated separately on every sim tick, which is what lets a project sit on screen
  // greyed for twenty minutes with the player saving toward it (BIBLE §9.2, P3). Collapsing them into
  // one predicate is the single change that would most damage the game.
  //
  // The catalog is data, not code that happens to live in a table: `trigger`, `cost` and `effect` are
  // thunks over the §3 state shape and nothing else. Where an effect belongs to a system that does not
  // exist yet (Acts II and III), it still writes the §3 field the eventual owner will read, so the
  // purchase is never lost and the later module needs no migration.
  //
  // Numbers here are catalog data — this module's own table, per BIBLE §8 D45. Anything that crosses
  // a module boundary comes from HY.core.TUNE instead, and every superseded figure in `04` has been
  // moved to its post-supersession value at the point of transcription (C1, C5, C9, C29, S2–S7).

  // ───────────────────────────────────────────────────────────────────────────
  // LAZY NAMESPACES — load order must not matter for anything except core
  // ───────────────────────────────────────────────────────────────────────────

  function C () { return HY.core }
  function T () { return HY.core.TUNE }
  function S () { return HY.state.state }

  var TYPES = ['leaf', 'needle', 'twig', 'bark', 'log', 'stump', 'carrion']

  // §3 a2.regions.flags bit assignments. Read-only here; world.js owns the writes.
  var RF_DISCOVERED = 1
  var RF_CLAIMED = 4

  // §3 a3.loci order, fixed forever: BAL GER MYC SPO MEL DOR FID ANT.
  var LOCUS_MEL = 4
  var LOCUS_FID = 6
  var LOCUS_ANT = 7

  // ───────────────────────────────────────────────────────────────────────────
  // CURRENCIES — the price-table keys, and where each one is held in §3
  // ───────────────────────────────────────────────────────────────────────────

  // `glyph` is what the hand-written priceTag prints; the CI check in __selftest parses the tag back
  // through this table and compares it with `price`, which is BIBLE §8 D66.
  var CUR = {
    g:      { glyph: 'g',   get: function (s) { return s.res.biomass },  set: function (s, v) { C().setStock(s.res, 'biomass', v) } },
    sug:    { glyph: 'sug', get: function (s) { return s.res.sugar },    set: function (s, v) { C().setStock(s.res, 'sugar', v) } },
    min:    { glyph: '⛬',   get: function (s) { return s.res.minerals }, set: function (s, v) { C().setStock(s.res, 'minerals', v) } },
    rep:    { glyph: 'rep', get: function (s) { return s.a1.netRep },    set: function (s, v) { C().setStock(s.a1, 'netRep', v, T().A1.REP_MAX) } },
    sig:    { glyph: 'Σ',   get: function (s) { return s.res.signal },   set: function (s, v) { C().setStock(s.res, 'signal', v) } },
    psi:    { glyph: 'Ψ',   get: function (s) { return s.res.insight },  set: function (s, v) { C().setStock(s.res, 'insight', v) } },
    spore:  { glyph: '◦',   get: function (s) { return s.res.spores },   set: function (s, v) { C().setStock(s.res, 'spores', v) } },
    carbon: { glyph: 'Χ',   get: function (s) { return s.res.carbon },   set: function (s, v) { C().setStock(s.res, 'carbon', v) } },
    accord: { glyph: '⟡',   get: function (s) { return s.res.accord },   set: function (s, v) { C().setStock(s.res, 'accord', v) } },
    alpha:  { glyph: 'α',   get: function (s) { return s.res.alleles },  set: function (s, v) { C().setStock(s.res, 'alleles', v) } },
    canon:  { glyph: '†',   get: function (s) { return s.res.canon },    set: function (s, v) { C().setStock(s.res, 'canon', v) } }
  }


  // ───────────────────────────────────────────────────────────────────────────
  // STATE READERS — every one tolerates a state whose act-specific systems are absent
  // ───────────────────────────────────────────────────────────────────────────

  // A per-manageProjects cache. 163 triggers a tick at 20 Hz is cheap; 163 scans of 61 typed-array
  // elements a tick is not, and the region counts are read by a dozen entries each.
  var frame = { n: -1 }
  var frameId = 0

  function memo (key, fn) {
    if (frame.n !== frameId) { frame = { n: frameId } }
    if (frame[key] === undefined) frame[key] = fn()
    return frame[key]
  }

  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }

  function flag (s, id) { return !!(s.proj && s.proj.flags && s.proj.flags[id]) }
  function flagVal (s, id) { return s.proj && s.proj.flags ? num(s.proj.flags[id]) : 0 }
  function stat (s, k) { return s.stats ? num(s.stats[k]) : 0 }

  // ── Act I ──────────────────────────────────────────────────────────────────

  function tips (s) { return num(s.a1.tips) }
  function patches (s) { return num(s.a1.patches) }
  function netRep (s) { return num(s.a1.netRep) }
  function season (s) { return num(s.a1.season) }
  function year (s) { return num(s.a1.year) }
  function moisture (s) { return num(s.a1.moisture) }

  function hyphae (s) {
    if (HY.act1 && HY.act1.hyphae) return num(HY.act1.hyphae(s))
    var A = T().A1
    return A.HYPHAE_PER_TIP * tips(s) + A.HYPHAE_PER_PATCH * (patches(s) - 1) + num(s.a1.hyphaeManual)
  }

  function totalSub (s) {
    return memo('totalSub', function () {
      var i, t = 0
      for (i = 0; i < TYPES.length; i++) t += num(s.a1.sub[TYPES[i]])
      return t
    })
  }

  // The cheapest gram of anything the player is currently allowed to buy. BIBLE §5.5 requires this
  // rather than `01`'s literal 20 g: base drift of +130% by late Act I makes a fixed threshold fire
  // long after the player is already stuck.
  function minPrice (s) {
    if (HY.economy1 && HY.economy1.minPrice) {
      // A market with nothing purchasable has no minimum price, and that is
      // exactly the state WINDFALL exists to rescue. num() would collapse the
      // Infinity to 0 and make `sugar < minPrice` false, so the one project
      // that guarantees the game cannot dead-end would never appear.
      var v = HY.economy1.minPrice(s)
      return (typeof v === 'number' && !isNaN(v)) ? v : Infinity
    }
    var best = Infinity, i, k, row
    for (i = 0; i < TYPES.length; i++) {
      k = TYPES[i]
      if (s.a1.unlockedTypes.indexOf(k) < 0) continue
      row = s.a1.mkt[i]
      if (row && row.price > 0 && row.stock > 0 && row.price < best) best = row.price
    }
    return best
  }

  // A contract only earns while it is live. economy1 keeps a completed, defaulted or exited row in
  // the book for one whole season so the card can still show how it ended, and those rows keep
  // their mineralRate — so a scan that reads the rate alone reports income for a season after the
  // last income stopped, which is precisely the season WINDFALL exists to rescue. 'active' is
  // economy1's own test for a live contract; nothing else counts here either.
  function isLive (c) { return !!c && c.state === 'active' }

  function hasActiveIncome (s) {
    if (tips(s) > 0 && totalSub(s) > 0) return true
    var i, c
    for (i = 0; i < s.a1.contracts.length; i++) {
      c = s.a1.contracts[i]
      if (isLive(c) && !c.suspended && num(c.mineralRate) > 0) return true
    }
    return false
  }

  function trees (s) { return s.a1.trees || [] }

  function treesWith (s, fn) {
    var i, n = 0, t = trees(s)
    for (i = 0; i < t.length; i++) if (t[i] && fn(t[i])) n++
    return n
  }

  function anyTree (s, fn) { return treesWith(s, fn) > 0 }

  function contracts (s) { return s.a1.contracts || [] }

  function anyContract (s, fn) {
    var i, c = contracts(s)
    for (i = 0; i < c.length; i++) if (c[i] && fn(c[i])) return true
    return false
  }

  function committedSugarPerSec (s) {
    var i, c = contracts(s), t = 0
    for (i = 0; i < c.length; i++) if (isLive(c[i]) && !c[i].suspended) t += num(c[i].sugarRate)
    return t
  }

  function anyPriceOver (s, mult) {
    var i, row
    for (i = 0; i < TYPES.length; i++) {
      row = s.a1.mkt[i]
      if (row && row.base > 0 && row.price > mult * row.base) return true
    }
    return false
  }

  // §3 has no per-type daily-use column; the market row's own stock is the honest stand-in for
  // "more of this than you are getting through", and it is what The Two-Sided Book is really about.
  function anyPoolOverstocked (s, ratio) {
    if (tips(s) <= 0) return false
    var A = T().A1
    var perSec = A.TIP_THROUGHPUT * tips(s)
    var i, k
    for (i = 0; i < TYPES.length; i++) {
      k = TYPES[i]
      if (s.a1.unlockedTypes.indexOf(k) < 0) continue
      if (num(s.a1.sub[k]) > ratio * perSec) return true
    }
    return false
  }

  function tipCostAt (s, n) {
    if (HY.act1 && HY.act1.tipCost) return num(HY.act1.tipCost(n))
    var A = T().A1
    var coef = flag(s, 'foraging_front') ? A.TIP_COEF_FORAGING : A.TIP_COEF
    return Math.ceil(A.TIP_BASE + coef * Math.pow(n, A.TIP_EXP))
  }

  // ── Act II ─────────────────────────────────────────────────────────────────

  function regionFlagCount (s, bit) {
    return memo('rf' + bit, function () {
      var f = s.a2.regions.flags, i, n = 0
      for (i = 0; i < f.length; i++) if (f[i] & bit) n++
      return n
    })
  }

  function claimed (s) { return regionFlagCount(s, RF_CLAIMED) }
  function discovered (s) { return regionFlagCount(s, RF_DISCOVERED) }

  function fc (s) {
    if (HY.forest && HY.forest.forestConsumed) return num(HY.forest.forestConsumed(s))
    return C().clamp(num(s.res.extracted) / T().A2.EXTRACT_TARGET, 0, 1)
  }

  function minHumus (s) {
    return memo('minH', function () {
      var r = s.a2.regions, i, m = Infinity
      for (i = 0; i < r.h.length; i++) if (r.flags[i] & RF_CLAIMED) m = Math.min(m, r.h[i])
      return m
    })
  }

  // ΣT/ΣT0 — the standing-life half of LEGACY (BIBLE §2.2). Before any region exists it is 1: the
  // forest is entirely alive, which is the correct reading of a board that has not been touched.
  function legacyLife (s) {
    return memo('legLife', function () {
      if (HY.forest && HY.forest.legacyLife) return num(HY.forest.legacyLife(s))
      var r = s.a2.regions, i, a = 0, b = 0
      for (i = 0; i < r.T.length; i++) { a += r.T[i]; b += r.T0[i] }
      return b > 0 ? C().clamp(a / b, 0, 1) : 1
    })
  }

  function ownsTerrain (s, code) {
    var r = s.a2.regions, i
    for (i = 0; i < r.terrain.length; i++) if ((r.flags[i] & RF_CLAIMED) && r.terrain[i] === code) return true
    return false
  }

  function edgesPerNode (s) {
    if (HY.world && HY.world.connectivity) {
      // Invert C = 1 + CONN_K·(edges/nodes)^CONN_EXP rather than keeping a second edge counter.
      var A = T().A2
      var c = C().clamp(num(HY.world.connectivity(s)), A.CONN_MIN, A.CONN_MAX)
      return Math.pow(Math.max(0, (c - 1) / A.CONN_K), 1 / A.CONN_EXP)
    }
    return 0
  }

  function rivalsHeld (s, strainId, strength) {
    var r = s.a2.regions, i, n = 0
    for (i = 0; i < r.rival.length; i++) if (r.rival[i] === strainId && r.rivalStr[i] > strength) n++
    return n
  }

  // The Pact Book is `05`'s block, versioned separately inside a2.pact. Every reader is defensive:
  // Act II projects must evaluate against a fresh newGame state without pactbook.js in the build.
  function pactBook (s) { return s.a2 && s.a2.pact ? s.a2.pact : {} }

  function pactCount (s) {
    var p = pactBook(s)
    return p.pacts && p.pacts.length ? p.pacts.length : 0
  }

  function pactMaxTenure (s) {
    var p = pactBook(s), i, m = 0
    if (!p.pacts) return 0
    for (i = 0; i < p.pacts.length; i++) m = Math.max(m, num(p.pacts[i].tenure))
    return m
  }

  function pactMaxBond (s) {
    var p = pactBook(s), i, m = 0
    if (!p.pacts) return 0
    for (i = 0; i < p.pacts.length; i++) m = Math.max(m, num(p.pacts[i].bond))
    return m
  }

  function channelsFull (s) {
    var p = pactBook(s)
    return num(p.channels) > 0 && num(p.channels) >= num(p.channelCap)
  }

  function pactSlots (s) {
    var p = pactBook(s)
    return p.slots === undefined ? 0 : num(p.slots)
  }

  function nodulScarred (s) {
    var p = pactBook(s)
    return num(p.noduleScars) > 0
  }

  // ── Act III ────────────────────────────────────────────────────────────────

  function sumF (arr) { var i, t = 0; for (i = 0; i < arr.length; i++) t += arr[i]; return t }

  function biomeFleet (s) { return memo('bFleet', function () { return sumF(s.a3.biomes.n) }) }
  function bandFleet (s) { return memo('nFleet', function () { return sumF(s.a3.bands.n) }) }
  function fleet (s) { return biomeFleet(s) + bandFleet(s) }

  function biomesReached (s) {
    return memo('biomes', function () {
      var r = s.a3.biomes.reached, i, n = 0
      for (i = 0; i < r.length; i++) if (r[i]) n++
      return n
    })
  }

  function bandsReached (s) {
    return memo('bands', function () {
      var e = s.a3.bands.e, n = s.a3.bands.n, i, k = 0
      for (i = 0; i < e.length; i++) if (e[i] > 0 || n[i] > 0) k++
      return k
    })
  }

  function planetConsumed (s) {
    if (HY.bloom && HY.bloom.planetConsumed) return num(HY.bloom.planetConsumed(s))
    if (biomesReached(s) === 0) return 0
    var X0 = T().A3.BIOME_X0, i, a = 0, b = 0
    for (i = 0; i < X0.length; i++) { a += s.a3.biomes.X[i]; b += X0[i] }
    return b > 0 ? C().clamp(1 - a / b, 0, 1) : 0
  }

  function inTransit (s) {
    var t = s.a3.transit || [], i, n = 0
    for (i = 0; i < t.length; i++) n += num(t[i].count)
    return n
  }

  function effFid (s) {
    if (HY.bloom && HY.bloom.effFid) return num(HY.bloom.effFid(s))
    var A = T().A3
    return C().clamp(
      num(s.carry.fidelityBase) +
      A.FID_PER_FID_LOCUS * s.a3.loci[LOCUS_FID] -
      A.FID_PER_ANT_LOCUS * s.a3.loci[LOCUS_ANT] +
      num(s.mult.boughtFid), A.FID_MIN, A.FID_MAX)
  }

  function strains (s) { return s.a3.strains || [] }

  function wildFraction (s) {
    return memo('wildF', function () {
      var w = 0, i, j, st = strains(s)
      for (i = 0; i < st.length; i++) if (st[i] && st[i].w) for (j = 0; j < st[i].w.length; j++) w += st[i].w[j]
      var mine = bandFleet(s)
      return w + mine > 0 ? w / (w + mine) : 0
    })
  }

  function wildMass (s) {
    var w = 0, i, j, st = strains(s)
    for (i = 0; i < st.length; i++) if (st[i] && st[i].w) for (j = 0; j < st[i].w.length; j++) w += st[i].w[j]
    return w
  }

  function succ (s) { return s.a3.succ }

  function inVoid (s) { return s.phase === 'void' || s.phase === 'dismantle' }

  // ───────────────────────────────────────────────────────────────────────────
  // EFFECT PRIMITIVES — defensive by construction, because an effect must never throw
  // ───────────────────────────────────────────────────────────────────────────

  function mul (o, k, f) { if (o && typeof o[k] === 'number') o[k] = o[k] * f }
  function set (o, k, v) { if (o) o[k] = v }
  function addRes (s, k, v) { C().setStock(s.res, k, num(s.res[k]) + v) }

  function mulEnzyme (s, keys, f) {
    var i, e = s.mult.enzymeK
    if (!e) return
    for (i = 0; i < keys.length; i++) if (typeof e[keys[i]] === 'number') e[keys[i]] *= f
  }

  function unlockType (s, k) {
    if (s.a1.unlockedTypes.indexOf(k) < 0) s.a1.unlockedTypes.push(k)
  }

  // BIBLE §7 C20: projects and CANON share one +0.24 ceiling, held in mult.boughtFid.
  function addFid (s, v) {
    s.mult.boughtFid = C().clamp(num(s.mult.boughtFid) + v, 0, T().A3.BOUGHT_FID_CAP)
  }

  function grantD (s, n) {
    if (HY.cognition && HY.cognition.grantD) { HY.cognition.grantD(n); return }
    C().setStock(s.res, 'D', num(s.res.D) + n, T().A2.D_MAX)
  }

  function claimPatch (s, id) {
    if (HY.act1 && HY.act1.claimPatch) { HY.act1.claimPatch(id); return }
    // Without act1.js the claim still has to land, or a reload would lose a purchased patch.
    s.a1.patches = Math.max(s.a1.patches, Math.min(id, T().A1.PATCH_MAX))
  }

  function stamp (s, id) { s.proj.flags[id] = s.t }

  // ───────────────────────────────────────────────────────────────────────────
  // WITHHELD CAPABILITIES — nothing may charge for a system that is not in the build
  // ───────────────────────────────────────────────────────────────────────────

  // A purchase must change the game. An entry whose flag no loaded module reads takes the player's
  // biomass and hands back a card that does nothing, which is worse than the feature being absent:
  // the money is gone and the promise on the card was false. `needs` names the reader that would
  // honour the flag, and the entry is withheld — kept out of `seen`, and refused by purchase(),
  // which re-tests the trigger — until that reader is here. Nothing is deleted and no price moves:
  // the day the module lands the entry arrives on its own trigger with its effect already written.
  //
  //   reflex_arc           act1.holdExtend   press-and-hold repeat on the EXTEND verb
  //   assay_plate          ui.assay          the ASSAY panel's per-type yield table
  //   trade_memory         ui.treeLedger     deficit, photosynthate and need on the tree cards
  //   chemotropic_sensing  act1.foresight    unclaimed inventories, and windthrow 30 s early
  //   seasonal_forecast    act1.forecast     next season's event table
  //   diel_rhythm          loop.dielBonus    the +31% band over the first 8 h of an absence
  //   action_potential     a Σ producer      nothing accrues Signal in Act I, so the panel reads 0.00
  //
  // The gate is ANDed into `trigger`, never into `cost`: a capability that does not exist is a
  // reason the project does not exist yet, not a reason the player cannot afford it (§9.2 P3).
  var NEEDS = {
    holdExtend: function () { return !!(HY.act1 && HY.act1.holdExtend) },
    assayPanel: function () { return !!(HY.ui && HY.ui.assay) },
    treeLedger: function () { return !!(HY.ui && HY.ui.treeLedger) },
    foresight:  function () { return !!(HY.act1 && HY.act1.foresight) },
    forecast:   function () { return !!(HY.act1 && HY.act1.forecast) },
    dielBonus:  function () { return !!(HY.loop && HY.loop.dielBonus) },
    // Signal accrual belongs to cognition (BIBLE §4 step 9); Act I's foreshadow may equally end up
    // in act1 itself. Either producer makes the panel honest, and DECIDE reachable with it.
    signalA1: function () {
      return !!((HY.cognition && HY.cognition.step) || (HY.act1 && HY.act1.stepSignal))
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE CATALOG
  // ───────────────────────────────────────────────────────────────────────────

  var CATALOG = []
  var ALL = []              // the master list; CATALOG loses entries to `excludes`, this never does
  var BY_ID = {}

  // Positional rather than an object literal per entry: at 163 entries the keys cost more lines than
  // the data does, and a fixed column order is what makes the table auditable against `04` §5–§6 and
  // `03` §18 by eye.
  function E (id, title, act, priceTag, price, trigger, effect, description, kinds, opts) {
    opts = opts || {}
    var p = {
      id: id,
      title: title,
      act: act,
      priceTag: priceTag,
      description: description,
      price: price,
      trigger: trigger,
      effect: effect,
      kinds: kinds || [],
      uses: opts.uses === undefined ? 1 : opts.uses,
      pinned: !!opts.pinned,
      excludes: opts.excludes || [],
      rearm: !!opts.rearm,
      buyable: opts.buyable !== false,
      also: opts.also || null,          // a non-currency gate ANDed into cost(), e.g. ϒ ≥ 0.80
      needs: opts.needs || null         // the reader that must exist before this may be sold
    }
    // triggerRaw is the design's own predicate, unaltered. It is what the reachability self-test
    // proves, so a withheld entry is still known to arrive correctly the day its reader lands.
    p.triggerRaw = trigger
    p.trigger = p.needs ? function (s) { return !!p.needs() && !!trigger(s) } : trigger
    p.cost = function () { return canAfford(p, S()) }
    p.pay = function () { return payFor(p, S()) }
    if (BY_ID[id]) throw new Error('duplicate project id: ' + id)
    BY_ID[id] = p
    ALL.push(p)
    CATALOG.push(p)
    return p
  }

  function priceOf (p, s) { return typeof p.price === 'function' ? p.price(s) : p.price }

  function canAfford (p, s) {
    if (!p.buyable) return false
    var pr = priceOf(p, s), k
    for (k in pr) {
      if (!Object.prototype.hasOwnProperty.call(pr, k)) continue
      if (!CUR[k]) continue
      if (CUR[k].get(s) < pr[k]) return false
    }
    if (p.also && !p.also(s)) return false
    return true
  }

  function payFor (p, s) {
    var pr = priceOf(p, s), k
    for (k in pr) {
      if (!Object.prototype.hasOwnProperty.call(pr, k)) continue
      if (!CUR[k]) continue
      CUR[k].set(s, CUR[k].get(s) - pr[k])
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT I — UNDERSTORY · 45 entries (04 §5)
  // Costs and effects are 04's, with S1–S5 applied: the tip curve is polynomial (C5), hyphae
  // coefficients are 1.75/30.0 (C6), and patch supply is superlinear (C7). Titles and flavour are
  // transcribed verbatim.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── I-1 The Floor ──────────────────────────────────────────────────────────

  E('rhizomorph_cords', 'Rhizomorph Cords', 1, '900 g', { g: 900 },
    function (s) { return tips(s) >= 12 },
    function (s) { mul(s.mult, 'structureMult', 1.18) },
    'Bundled threads move further on the same water. (+18% throughput)',
    ['multiplier'])

  E('reflex_arc', 'Reflex Arc', 1, '1,100 g', { g: 1100 },
    function (s) { return stat(s, 'taps') >= 120 },
    function () { /* act1 reads flags.reflex_arc for press-and-hold */ },
    'You stop deciding to move and simply move. (Hold to extend)',
    ['verb', 'automation'],
    { needs: NEEDS.holdExtend })

  E('assay_plate', 'Assay Plate', 1, '2,000 g', { g: 2000 },
    function (s) { return s.res.biomass >= T().A1.PROJECTS_BIOMASS_G },
    function () { /* opens the ASSAY panel; ui reads the flag */ },
    'Seven kinds of dead, and they do not taste the same. (Yield table)',
    ['panel', 'information'],
    { needs: NEEDS.assayPanel })

  E('cellulase_titre', 'Cellulase Titre', 1, '2,600 g', { g: 2600 },
    function (s) { return s.res.biomass >= T().A1.PROJECTS_BIOMASS_G },
    function (s) { mulEnzyme(s, ['leaf', 'needle', 'twig'], 1.25) },
    'More of the enzyme you already had. (+25% on soft litter)',
    ['multiplier'])

  E('hydrophobic_sheath', 'Hydrophobic Sheath', 1, '1,400 g', { g: 1400 },
    function (s) { return year(s) > 0 || season(s) !== T().A1.SEASON_AUTUMN },
    function () { /* act1.moistureMult() halves the penalty below 1 while this flag is set */ },
    'Water held against the frost, in a coat you grew for exactly this. (Halves the moisture penalty)',
    ['rulechange'])

  // S2/C5: this moves the tipCost *coefficient* 3.20 → 2.60. 04's published exponent change is void.
  E('foraging_front', 'Foraging Front', 1, '3,400 g', { g: 3400 },
    function (s) { return tips(s) >= T().A1.MIN_GATE_TIPS },
    function () { /* act1.tipCost() reads TIP_COEF_FORAGING while this flag is set */ },
    'Growth at the edge, never in the middle. (Cheaper tips, forever)',
    ['rulechange'])

  E('mycelial_ledger', 'Mycelial Ledger', 1, '3,800 g', { g: 3800 },
    function (s) { return stat(s, 'purchases') >= 10 },
    function () { /* market rows gain a sparkline, a fair-value line and a momentum arrow */ },
    'You begin to remember prices. (Market history)',
    ['information'])

  // ── I-2 The Market ─────────────────────────────────────────────────────────

  E('dormancy_clause', 'Dormancy Clause', 1, '1,800 g + 20 ⛬', { g: 1800, min: 20 },
    function (s) { return stat(s, 'contractsSigned') >= 1 },
    function () { /* contracts.deliverContracts() suspends while offline under this flag */ },
    'Sleep does not break a promise. (No offline defaults)',
    ['rulechange', 'offline'])

  E('hemicellulase', 'Hemicellulase', 1, '5,200 g + 30 ⛬', { g: 5200, min: 30 },
    function (s) { return flag(s, 'cellulase_titre') },
    function (s) { unlockType(s, 'bark'); mulEnzyme(s, ['twig'], 1.30) },
    'The gluey parts come apart first. (Unlocks bark slough)',
    ['rulechange'])

  E('osmotic_priming', 'Osmotic Priming', 1, '6,500 g + 45 ⛬', { g: 6500, min: 45 },
    function (s) { return stat(s, 'sugarSpentOnMarket') >= 5000 },
    function (s) { set(s.mult, 'osmoticPriming', 0.50) },
    'Ask quietly and the floor gives more. (Half market impact)',
    ['rulechange'])

  // Same discipline as `standing_order` below: the overstock is the meaning, the biomass floor is
  // the reach — revealed at 14× the bank it read as a taunt rather than a tool.
  E('two_sided_book', 'The Two-Sided Book', 1, '7,200 g', { g: 7200 },
    function (s) {
      return stat(s, 'purchases') >= 25 && anyPoolOverstocked(s, 12) &&
        s.res.biomass >= T().A1.PROJECTS_BIOMASS_G
    },
    function () { /* economy1.sell() is gated on this flag */ },
    'The floor will take things back, at a discount, and remember that you asked. (Unlocks selling)',
    ['verb', 'rulechange'])

  E('sclerotia', 'Sclerotia', 1, '8,000 g', { g: 8000 },
    function (s) { return stat(s, 'rotted') >= T().A1.SCLEROTIA_ROT_GATE },
    function (s) { set(s.mult, 'sclerotiaBonus', 6000 + 40 * tips(s)) },
    'Hard little bodies, each one full of a winter you have not had yet. (+Sugar storage)',
    ['rulechange'])

  E('trade_memory', 'Trade Memory', 1, '9,000 g + 40 ⛬', { g: 9000, min: 40 },
    function (s) { return stat(s, 'contractsCompleted') >= 2 },
    function () { /* tree cards gain deficit, photosynthate, need and a one-year strip */ },
    'You learn what hunger looks like from underneath. (Tree data)',
    ['information'],
    { needs: NEEDS.treeLedger })

  E('antifreeze_glycoproteins', 'Antifreeze Glycoproteins', 1, '9,500 g', { g: 9500 },
    function (s) { return stat(s, 'wintersEnded') >= 1 },
    function (s) { set(s.mult, 'antifreeze', true) },
    'Ice forms around you, not in you. (Winter +55%)',
    ['multiplier'])

  E('the_deer_in_the_gully', 'The Deer in the Gully', 1, '11,000 g', { g: 11000 },
    function (s) { return stat(s, 'carrionEventsSeen') >= 1 },
    function (s) { unlockType(s, 'carrion') },
    'Nothing on the floor is wasted, and nothing on the floor was asked. (Unlocks carrion)',
    ['rulechange'])

  // ── I-3 The Forest Notices ─────────────────────────────────────────────────

  E('patch_second_shadow', 'Patch: The Second Shadow', 1, '12,000 g + 90 ⛬',
    function (s) { return territoryPrice(s, 1) },
    function (s) { return s.res.biomass >= T().A1.PATCH[1].biomass },
    function (s) { claimPatch(s, 2) },
    'There is more floor than this. (+1 patch)',
    ['panel'])

  E('peroxidase_mn', 'Peroxidase (Mn)', 1, '13,000 g + 70 ⛬', { g: 13000, min: 70 },
    function (s) { return flag(s, 'hemicellulase') },
    function (s) { unlockType(s, 'log'); mulEnzyme(s, ['twig', 'bark', 'log', 'stump'], 1.15) },
    'Lignin is only a rumour of a wall. (Unlocks fallen logs)',
    ['rulechange'])

  // Forty purchases arrive minutes into the act, when 15,000 g is ~29× the bank — an automation
  // dangled a session away is noise, not a goal. The chore is real from purchase forty; the card
  // waits until the price is inside ~4× reach, the band the reveal queue is built around.
  E('standing_order', 'Standing Order', 1, '15,000 g', { g: 15000 },
    function (s) { return stat(s, 'purchases') >= 40 && s.res.biomass >= 4000 },
    function () { /* per-type price ceiling and floor stock; economy1 fills them */ },
    'It buys badly and it never sleeps, and you will take that trade. (Automated, 8% worse than you)',
    ['automation'])

  E('necromass_recycling', 'Necromass Recycling', 1, '16,000 g', { g: 16000 },
    function (s) { return tips(s) >= 60 },
    function () { /* stepDecomposition returns 12% of consumed mass to its own pool */ },
    'You eat your own dead ends. (12% substrate refund)',
    ['rulechange'])

  E('chemotropic_sensing', 'Chemotropic Sensing', 1, '18,000 g', { g: 18000 },
    function (s) { return patches(s) >= 2 },
    function () { /* unclaimed patch inventories revealed; windthrow announced 30 s ahead */ },
    'You taste the air for the shape of things that have not fallen yet. (Foresight)',
    ['information'],
    { needs: NEEDS.foresight })

  E('common_mycorrhizal_network', 'Common Mycorrhizal Network', 1, '22,000 g + 150 ⛬', { g: 22000, min: 150 },
    function (s) { return treesWith(s, function (t) { return num(t.rep) >= 45 }) >= 3 },
    function (s) { set(s.mult, 'cmnMult', 1.50) },
    'The forest starts telling itself about you. (+50% reputation gain)',
    ['multiplier'])

  E('ghost_pipe_compact', 'Ghost Pipe Compact', 1, '24,000 g', { g: 24000 },
    function (s) { return anyTree(s, function (t) { return num(t.rep) >= 60 }) && stat(s, 'contractsCompleted') >= 4 },
    function (s) {
      mul(s.mult, 'exudatePump', 0.96)
      C().setStock(s.a1, 'netRep', netRep(s) + 12, T().A1.REP_MAX)
    },
    'Monotropa has no chlorophyll and no shame. It takes sugar, buys trust, keeps the four percent.',
    ['irreversible', 'cost'])

  E('hartig_net_refinement', 'Hartig Net Refinement', 1, '26,000 g + 180 ⛬', { g: 26000, min: 180 },
    function (s) { return anyContract(s, function (c) { return num(c.termSeasons) >= 6 }) },
    function (s) { set(s.mult, 'hartigNet', 1.18) },
    'More surface between you and them. (+18% all mineral rates)',
    ['multiplier'])

  // ── I-4 Consolidation ──────────────────────────────────────────────────────

  E('forward_contracts', 'Forward Contracts', 1, '28,000 g + 200 ⛬', { g: 28000, min: 200 },
    function (s) { return stat(s, 'largestSinglePurchase') >= 4000 },
    function () { /* economy1 fixes the next 12 fills at 1.05 × fair value */ },
    'A price you can plan around beats a price that is right. It says so, in your own exudate.',
    ['trap', 'irreversible', 'rulechange'])

  // Rep alone revealed this rung fifteen minutes before the rung UNDER it (whose trigger is its
  // own biomass price) — the ladder read out of order. Same rule as rungs 4–6: the rung below
  // must be claimed first, which is also the order stepAlarm's failsafe walks.
  E('patch_windthrow_gap', 'Patch: The Windthrow Gap', 1, '30,000 g + 260 ⛬',
    function (s) { return territoryPrice(s, 2) },
    function (s) { return patches(s) >= 2 && netRep(s) >= T().A1.PATCH_GATE_REP[2] },
    function (s) { claimPatch(s, 3) },
    'Where the wind did your work for you. (+1 patch, log-rich)',
    ['panel'])

  E('laccase', 'Laccase', 1, '34,000 g + 220 ⛬', { g: 34000, min: 220 },
    function (s) { return flag(s, 'peroxidase_mn') },
    function (s) { unlockType(s, 'stump') },
    'Heartwood, at last. (Unlocks stumps)',
    ['rulechange'])

  E('diel_rhythm', 'Diel Rhythm', 1, '36,000 g', { g: 36000 },
    function (s) { return stat(s, 'offlineSeconds') >= 7200 },
    function () { /* loop.effective() reads this flag for the first 8 h of any absence */ },
    'The day and the night were always the same to you. Now you are paid for noticing. (+31% offline)',
    ['offline'],
    { needs: NEEDS.dielBonus })

  // Market prices random-walk from the first tick, so `anyPriceOver` alone fires 12–15 seconds
  // into a fresh game, on every seed measured — making a 38,000 g card the first project a
  // brand-new player ever sees, four orders of magnitude past their ~22 g. A spike the player has
  // never bought against is weather, not competition: the card means something once they are IN
  // the market at scale and a 1.6× print costs them real sugar. 50,000 sugar through the floor is
  // the reference player at ~36 minutes holding ~11,000 g — the card arrives greyed at ~3.3× reach,
  // an ambition, not a taunt (UP's rule: reveal the locked thing once it means something).
  E('bacterial_antagonism', 'Bacterial Antagonism', 1, '38,000 g + 240 ⛬', { g: 38000, min: 240 },
    function (s) { return stat(s, 'sugarSpentOnMarket') >= 50000 && anyPriceOver(s, 1.6) },
    function () { /* leaf and needle fill at 0.78 × the printed price, for you only */ },
    'You poison the competition. It works. (-22% soft litter cost)',
    ['rulechange'])

  E('exudate_pump', 'Exudate Pump', 1, '42,000 g + 300 ⛬', { g: 42000, min: 300 },
    function (s) { return committedSugarPerSec(s) >= 25 },
    function (s) { mul(s.mult, 'exudatePump', 1.35) },
    'Push harder and they take more, because by now they cannot not. (+35% contract volume)',
    ['multiplier'])

  E('contract_arbitration', 'Contract Arbitration', 1, '46,000 g + 320 ⛬', { g: 46000, min: 320 },
    function (s) { return stat(s, 'defaults') >= 1 },
    function (s) { set(s.mult, 'arbitration', 0.45) },
    'The forest is willing to hear your side. (Softer default penalty)',
    ['rulechange'])

  E('seasonal_forecast', 'Seasonal Forecast', 1, '52,000 g + 380 ⛬', { g: 52000, min: 380 },
    function (s) { return year(s) >= 2 },
    function () { /* next season's event table, and a forecast row on NEGOTIATE */ },
    'Three months is not so far ahead. (Weather forecast)',
    ['information'],
    { needs: NEEDS.forecast })

  // ── I-5 The Last Year ──────────────────────────────────────────────────────

  E('perennial_mycelium', 'Perennial Mycelium', 1, '55,000 g + 350 ⛬', { g: 55000, min: 350 },
    function (s) { return year(s) >= 3 && flag(s, 'antifreeze_glycoproteins') },
    function (s) { set(s.mult, 'perennial', true); s.a1.activeEvents.length = 0 },
    'You stop having years. The average is very good, and nothing will ever beat the average again.',
    ['trap', 'irreversible', 'removes'])

  E('fruiting_body', 'Fruiting Body', 1, '60,000 g', { g: 60000 },
    function (s) {
      return season(s) === T().A1.SEASON_AUTUMN && moisture(s) >= 1.00 && hyphae(s) >= 200
    },
    function (s) { C().setStock(s.a1, 'netRep', netRep(s) + 8, T().A1.REP_MAX) },
    'For one night in the year you are visible, and the forest counts you. (+8 reputation)',
    ['event'])

  // Re-armable and irreversible per use. The tips you rebuy are priced at the new, lower n, and that
  // is the entire point; nothing on the card says so.
  E('autolysis', 'Autolysis', 1, '— (a decision)', {},
    function (s) { return tips(s) >= 40 },
    function (s) {
      var lose = Math.floor(0.20 * tips(s))
      if (lose < 1) return
      var refund = 0, i
      for (i = tips(s) - lose; i < tips(s); i++) refund += tipCostAt(s, i)
      s.a1.tips = tips(s) - lose
      addRes(s, 'biomass', 3.0 * refund)
    },
    'You are allowed to be smaller. It is faster than patience, and it costs what it looks like.',
    ['rearm', 'irreversible', 'verb'],
    { rearm: true, pinned: true })

  E('patch_under_the_hemlocks', 'Patch: Under the Hemlocks', 1, '70,000 g + 700 ⛬',
    function (s) { return territoryPrice(s, 3) },
    function (s) { return patches(s) >= 3 },
    function (s) { claimPatch(s, 4) },
    'Deep shade, deep needle, and nothing else growing. (+1 patch)',
    ['panel'])

  E('oxalate_weathering', 'Oxalate Weathering', 1, '75,000 g + 500 ⛬', { g: 75000, min: 500 },
    function (s) { return stat(s, 'mineralEarned') >= 1500 },
    function () { /* +0.35 ⛬/s passively, scaled by hartigNet; economy1 reads the flag */ },
    'You dissolve the rock yourself, slowly, with an acid you have always made. (+0.35 mineral/s)',
    ['rulechange'])

  // The reputation gates cluster: rep grows fast enough mid-act that rungs 3–5 all cleared their
  // rep thresholds in the same minute, putting a 160,000 g and a 400,000 g card on the board at
  // 87× and 212× the player's holdings while they owned two patches. One greyed rung ahead is the
  // ladder the player can read; three at once is a wall. Each rung now also waits for the rung
  // below it to be claimed — the same order stepAlarm's failsafe already walks.
  E('patch_old_coppice', 'Patch: The Old Coppice', 1, '160,000 g + 1,800 ⛬',
    function (s) { return territoryPrice(s, 4) },
    function (s) { return patches(s) >= 4 && netRep(s) >= T().A1.PATCH_GATE_REP[4] },
    function (s) { claimPatch(s, 5) },
    'Cut a hundred years ago by someone who did not write it down. (+1 patch, stump-rich)',
    ['panel'])

  E('patch_oak_rise', 'Patch: The Oak Rise', 1, '400,000 g + 4,400 ⛬',
    function (s) { return territoryPrice(s, 5) },
    function (s) { return patches(s) >= 5 && netRep(s) >= T().A1.PATCH_GATE_REP[5] },
    function (s) { claimPatch(s, 6) },
    'The oak has been waiting, the way a bank waits. (+1 patch, +oak)',
    ['panel'])

  // ── I-X Conditional ────────────────────────────────────────────────────────

  // The first failsafe. `08` §5.3 proves 2,000 g of leaf is a positive-return re-entry (×1.481), so
  // one grant always restarts the loop. It is free at zero reputation, once per 300 s, because a
  // player at rep 0 has nothing left to charge.
  E('windfall', 'Windfall', 1,
    '1 rep',
    function (s) {
      var A = T().A1
      var last = s.proj.flags.windfall_at
      var free = netRep(s) <= 0 &&
        (last === undefined || (s.t - num(last)) >= A.WINDFALL_FREE_S)
      return free ? {} : { rep: A.WINDFALL_REP }
    },
    function (s) {
      var A = T().A1
      return totalSub(s) < A.WINDFALL_SUB && s.res.sugar < minPrice(s) &&
             s.res.biomass < A.WINDFALL_BIOMASS && !hasActiveIncome(s)
    },
    function (s) {
      var A = T().A1
      C().setStock(s.a1.sub, 'leaf', num(s.a1.sub.leaf) + A.WINDFALL_LEAF)
      s.stats.windfalls += 1
      s.proj.flags.windfall_at = s.t
    },
    'Ask the forest for something you did not earn. It will say yes, and it will remember.',
    ['failsafe', 'rearm', 'cost'],
    { rearm: true, pinned: true })

  E('a_gift_of_phosphorus', 'A Gift of Phosphorus', 1, '200 ⛬',
    function (s) {
      var A = T().A1
      return { min: A.PHOSPHORUS_BASE * Math.pow(A.PHOSPHORUS_GROWTH, num(s.proj.uses.a_gift_of_phosphorus)) }
    },
    function (s) {
      return stat(s, 'contractsCompleted') >= 2 &&
             anyTree(s, function (t) { return num(t.rep) < T().A1.PHOSPHORUS_REP })
    },
    function (s) {
      // The lowest-reputation tree is the one the failsafe exists for; the card lets the player pick,
      // and this is the default that a headless run and an offline reconcile both take.
      var t = trees(s), i, worst = null
      for (i = 0; i < t.length; i++) if (t[i] && (!worst || num(t[i].rep) < num(worst.rep))) worst = t[i]
      if (worst) worst.rep = C().clamp(num(worst.rep) + 4, 0, T().A1.REP_MAX)
    },
    'A small gift, correctly timed, to something that cannot count. (+4 reputation, one tree)',
    ['failsafe', 'rearm'],
    { rearm: true, pinned: true })

  E('sever_the_elm', 'Sever the Elm', 1, '— (a decision)', {},
    function (s) {
      return anyContract(s, function (c) {
        var t = treeById(s, c.treeId)
        return isLive(c) && !!t && t.species === 'elm' && num(t.health) < 0.15
      })
    },
    function (s) {
      var i, c = contracts(s), t
      for (i = c.length - 1; i >= 0; i--) {
        // Only a live term can be severed. A row that already completed or defaulted is waiting out
        // its season on the card, and returning its collateral again would pay it twice.
        if (!isLive(c[i])) continue
        t = treeById(s, c[i].treeId)
        if (t && t.species === 'elm') { addRes(s, 'minerals', num(c[i].collateral)); c.splice(i, 1) }
      }
      for (i = 0; i < trees(s).length; i++) if (trees(s)[i].species === 'elm') trees(s)[i].health = 0
    },
    'It was going to die anyway. (No penalty)',
    ['irreversible', 'event'])

  E('the_hollow_beech', 'The Hollow Beech', 1, '4,000 sug', { sug: 4000 },
    function (s) {
      return year(s) >= 2 && anyTree(s, function (t) { return t.species === 'beech' && num(t.d) >= 0.85 })
    },
    function () { /* economy1 signs the non-negotiable twelve-season term on this flag */ },
    'It is enormous and it is empty and it will pay almost anything. Read the term length twice.',
    ['trap'])

  // ── I-T Transition ─────────────────────────────────────────────────────────

  E('anastomosis', 'Anastomosis', 1, '260,000 g + 900 ⛬', { g: 260000, min: 900 },
    function (s) { return hyphae(s) >= T().A1.HYPHAE_GATE && patches(s) >= 4 },
    function (s) { mul(s.mult, 'structureMult', 1.25) },
    'Where two threads meet, they stop being two threads. (+25% throughput, pooled substrate)',
    ['rulechange', 'panel'])

  E('action_potential', 'Action Potential', 1, '900,000 g + 4,000 ⛬', { g: 900000, min: 4000 },
    function (s) { return flag(s, 'anastomosis') && netRep(s) >= T().A1.ACTION_POTENTIAL_REP },
    function () { /* SIGNAL appears with a rate, a total, and no uses for 8–15 minutes */ },
    'Something moved from one end of you to the other, and it was not food.',
    ['panel'],
    { needs: NEEDS.signalA1 })

  E('decide', 'DECIDE', 1, '— (a decision)', {},
    function (s) { return flag(s, 'action_potential') && s.res.signal >= T().A1.DECIDE_SIGNAL },
    function (s) {
      if (HY.act1 && HY.act1.decide) { HY.act1.decide(); return }
      // The transition itself belongs to act1.js; without it the revocation still has to happen, or
      // the save would carry Act I's board into Act II.
      var A = T()
      C().setStock(s.res, 'biomass', num(s.res.biomass) * A.HANDOFF.BIOMASS_KEPT)
      C().setStock(s.res, 'sugar', 0)
      s.a1.tips = 0
      s.a1.netRep = 0
      s.a1.trees.length = 0
      s.a1.contracts.length = 0
      s.act = 2
      s.phase = 'network'
    },
    'Stop tasting. Start knowing.',
    ['irreversible', 'removes'],
    { pinned: true })

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT II — NETWORK · 68 entries
  // 04 §6's 53, plus 05 §12's 14 pact projects and `pact_refixation` (BIBLE §7 C2).
  // Every biomass-dimensioned figure carries ACT2_SCALE = 0.333 (C9); every `contracts >= n` trigger
  // reads `pacts.length`, because Act II has no contracts under 05 (C29).
  // ═══════════════════════════════════════════════════════════════════════════

  function a2g (grams) { return grams * T().A2.ACT2_SCALE }

  // ── II-A Awakening ─────────────────────────────────────────────────────────

  // Σ is hard-clamped at Sc (BIBLE §2.3), so an Act II price above the pool is not expensive, it is
  // impossible — no amount of waiting produces it. Sc = 260·(0.60+Σℓ)^0.85 and the act opens on one
  // claimed stand. `chemotaxis` is what opens the map — the STANDS list and every density and
  // advance control sit behind this flag — so nothing a PLAYER can see raises Σℓ until it is
  // bought. 04's 400 Σ was a permanent deadlock (measured: 700 minutes at 343.3 Σ with the card on
  // screen); the 300 Σ that replaced it was the same deadlock measured against the wrong ceiling.
  // 343 Σ was a run in which the headless stand-in had already bought density on the opening stand
  // through world.buyDensity — a control a human cannot reach, because the panel it lives on is
  // gated on this very card. The ceiling a human actually faces is C24's opening exactly as
  // act1.decide() writes it: one Loam stand (worldgen fixes ring 0) at d = 0.30 with its trees
  // untouched, so Σℓ = 0.30·κ, κ the stand's species blend — 0.72 (pure Birch) at the theoretical
  // floor, 0.79 measured on seed 7 — and Sc plateaus at 219–260 Σ, flat forever. Reproduced twice
  // from fresh saves: 25 minutes at 223.3 Σ with chemotaxis reading 1.34× the pool and every other
  // Σ card further away still. 200 Σ sits under the worst legal opening with ~9% headroom (the
  // selftest constructs that opening and holds the door to it), and is still ~80 s of opening-rate
  // Signal on the best one: payable a few minutes in, never before, and above all always.
  E('chemotaxis', 'Chemotaxis', 2, '200 Σ', { sig: 200 },
    function (s) { return s.act === 2 },
    function () { /* opens FOREST: the 61-hex map, STANDS, and ADVANCE */ },
    'Sense the gradient. Go up it.',
    ['panel', 'verb'])

  E('apical_growth', 'Apical Growth', 2, '900 Σ', { sig: 900 },
    function (s) { return claimed(s) >= 2 },
    function (s) { mul(s.mult, 'advanceSpeed', 1.45) },
    'Grow only at the ends. (+45% advance speed)',
    ['multiplier'])

  E('turgor', 'Turgor', 2, '1,600 Σ', { sig: 1600 },
    function (s) { return !!s.stats.everSaturated },
    function () { /* cognition.stepInsight() is gated on this flag */ },
    'The pressure has nowhere to go, so it becomes an opinion. (Unlocks Insight)',
    ['panel', 'rulechange'])

  E('primordium', 'Primordium', 2, '10 Ψ', { psi: 10 },
    function (s) { return s.res.insight >= T().A2.PRIMORDIUM_INSIGHT },
    function () { /* opens FLUSH with one slot; the morph is rolled and shown before commitment */ },
    'A knot in the wood, deciding. (Unlocks fruiting)',
    ['panel', 'verb'])

  E('substrate_assay', 'Substrate Assay', 2, '2,400 Σ', { sig: 2400 },
    function (s) { return discovered(s) >= 4 },
    function () { /* world.survey() is gated on this flag: 120 Σ a region, permanently recurring */ },
    'Taste before you commit. (Enables SURVEY)',
    ['verb', 'information'])

  E('action_potential_ii', 'Action Potential', 2, '45 Ψ', { psi: 45 },
    function (s) { return claimed(s) >= T().A2.ACTION_POTENTIAL_CLAIMED },
    function () { /* PULSE and SURGE. Never automated by any project at any price, in any act. */ },
    'Say all of it at once, in one direction. (Unlocks PULSE)',
    ['panel', 'verb'])

  E('differentiation', 'Differentiation', 2, '3,200 Σ', { sig: 3200 },
    function (s) { return s.res.cumBiomass >= T().A2.D_TRIGGER },
    function () { /* cognition opens D allocation across dCond and dVes */ },
    'Not every thread needs to do everything. (Unlocks Differentiation)',
    ['panel'])

  // ── II-B Spread ────────────────────────────────────────────────────────────

  E('manganese_peroxidase', 'Manganese Peroxidase', 2, '30 Ψ + 6,000 Σ', { psi: 30, sig: 6000 },
    function (s) { return s.res.extracted >= a2g(4e9) },
    function (s) { mul(s.mult, 'E', 1.60) },
    'Rust, applied with intent. (+60% enzyme power)',
    ['multiplier'])

  E('rhizomorphs', 'Rhizomorphs', 2, '55 Ψ', { psi: 55 },
    function (s) { return claimed(s) >= 6 },
    function (s) { mul(s.mult, 'advCostMult', 0.82) },
    'Cables, not threads. (3 advances at once)',
    ['rulechange'])

  E('anemophily', 'Anemophily', 2, '40 Ψ', { psi: 40 },
    function (s) { return s.res.spores >= 5e4 },
    function () { /* seeding may target non-adjacent regions downwind of a held one */ },
    'Let the weather carry it. You do not have to know where. (Ranged seeding)',
    ['rulechange'])

  E('barometric_sense', 'Barometric Sense', 2, '70 Ψ + 12,000 Σ', { psi: 70, sig: 12000 },
    function (s) { return stat(s, 'flushes') >= 3 },
    function (s) { mul(s.mult, 'matSpeed', 1.45) },
    'Feel the pressure fall before the rain admits to it. (+forecast, +45% maturation)',
    ['information', 'multiplier'])

  E('antibiosis', 'Antibiosis', 2, '85 Ψ', { psi: 85 },
    function (s) { return stat(s, 'rivalContacts') >= 1 },
    function (s) { mul(s.mult, 'antibiosis', 1.55) },
    'Chemistry is cheaper than growth. (Unlocks REPEL)',
    ['verb', 'multiplier'])

  E('vesicular_storage', 'Vesicular Storage', 2, '18,000 Σ', { sig: 18000 },
    function (s) { return num(s.cog.dVes) >= 1 },
    function (s) { mul(s.mult, 'capMult', 1.45) },
    'Hold more of it, for longer. (+45% Signal capacity)',
    ['multiplier'])

  // The counter is PULSE's, and PULSE is a verb: `08` §5.2's reference player uses it constantly
  // and the headless stand-in has no policy for it at all, so measured over three 800-minute runs
  // `stats.pulses` never left zero and this entry never existed. The disjunct is the same sentence
  // in state rather than in behaviour — a network of twelve claimed stands has been shouting across
  // itself for an hour whether or not the counter saw it — and it is a disjunct, not a replacement,
  // so a player who does pulse still gets the card on the tenth one.
  E('septal_gating', 'Septal Gating', 2, '110 Ψ', { psi: 110 },
    function (s) { return stat(s, 'pulses') >= 10 || claimed(s) >= 12 },
    function () { /* pulse cooldown 120 → 75 s; RECRUIT. cognition reads the flag. */ },
    'Open every door in the body at the same instant. (Unlocks RECRUIT)',
    ['verb', 'rulechange'])

  // Failure detection: it can only ever appear to a player who has already mined a stand's humus out.
  E('humic_retention', 'Humic Retention', 2, '24,000 Σ', { sig: 24000 },
    function (s) { return minHumus(s) < T().A2.HUMIC_RETENTION_H },
    function () { /* forest.setRho(): one global dial plus five pinned per-region overrides */ },
    'Give some of it back. You will not see why for an hour. (Unlocks Retention)',
    ['dial', 'panel'])

  // Same shape as `septal_gating`: the trade counter is a verb counter, and a bank of 150,000 ⛬ is
  // the state that says the same thing — nobody accumulates that without having been in the market.
  E('cation_exchange', 'Cation Exchange', 2, '90 Ψ + 20,000 Σ', { psi: 90, sig: 20000 },
    function (s) { return stat(s, 'mineralTrades') >= 30 || s.res.minerals >= 1.5e5 },
    function () { /* the mineral exchange gains its sparkline, true Pbar, momentum and LIMIT orders */ },
    'The price was never random. It just never told you. (Market instruments)',
    ['information', 'verb'])

  // ── II-C Appetite ──────────────────────────────────────────────────────────

  E('necrotrophic_conversion', 'Necrotrophic Conversion', 2, '240 Ψ + 90,000 Σ', { psi: 240, sig: 90000 },
    function (s) { return fc(s) >= T().A2.NECRO_FC },
    function () { /* KILL STAND on every held region. Never automatable. */ },
    'Stop asking.',
    ['verb', 'irreversible'])

  E('laccase_cascade', 'Laccase Cascade', 2, '190 Ψ + 60,000 Σ', { psi: 190, sig: 60000 },
    function (s) { return flag(s, 'manganese_peroxidase') },
    function (s) { mul(s.mult, 'E', 2.10); mul(s.mult, 'antibiosis', 1.52) },
    'Break the ring, then the ring under it. (+110% enzyme power)',
    ['multiplier'])

  E('turgor_regulation', 'Turgor Regulation', 2, '165 Ψ', { psi: 165 },
    function (s) { return stat(s, 'densityBuys') >= 25 },
    function () { /* six per-terrain target dials replace ~400 taps an hour */ },
    'Stop deciding this one thread at a time. (Automates density)',
    ['automation', 'dial'])

  E('rhizomorph_highways', 'Rhizomorph Highways', 2, '300 Ψ + 140,000 Σ', { psi: 300, sig: 140000 },
    function (s) { return claimed(s) >= 18 },
    function (s) { mul(s.mult, 'advCostMult', 0.80) },
    'Move mass, not just signal. (Automates advance)',
    ['automation'])

  E('bridging_strands', 'Bridging Strands', 2, '260 Ψ + 20,000 ⛬', { psi: 260, min: 20000 },
    function (s) { return stat(s, 'barrierBlocks') >= 1 },
    function () { /* advances may cross barrier edges at 2.40× cost; bridged edges count toward C */ },
    'Across the water, on a dead branch, in one night. (Cross barriers)',
    ['rulechange'])

  E('sporulation_reflex', 'Sporulation Reflex', 2, '280 Ψ', { psi: 280 },
    function (s) { return stat(s, 'flushes') >= 20 },
    function () { /* auto-release at m = 0.92, suspended during a Mast Year; slots 1 → 4 */ },
    'You no longer need to be told when. (Automates release)',
    ['automation'])

  E('mycelial_memory', 'Mycelial Memory', 2, '420 Ψ + 200,000 Σ', { psi: 420, sig: 200000 },
    function (s) { return s.res.insight >= 350 },
    function (s) { mul(s.mult, 'insightMult', 1.55); set(s.mult, 'ripeT', T().A2.RIPE_T_MEMORY) },
    'The network remembers where the good wood was, and is not sentimental about it. (+55% Insight)',
    ['multiplier', 'rulechange'])

  E('reabsorption', 'Reabsorption', 2, '150 Ψ', { psi: 150 },
    function (s) { return s.res.D >= 5 },
    function () { /* cognition.respec(); the counter is NOT reset at the act break */ },
    'Take it back and try again. (Respec)',
    ['verb'])

  E('aerenchyma', 'Aerenchyma', 2, '210 Ψ + 1.33e9 g',
    { psi: 210, g: a2g(4.0e9) },
    function (s) { return ownsTerrain(s, 4) },
    function () { /* peat decompF 0.45 → 0.95; forest reads the flag */ },
    'Breathe through the water. (Unlocks peat)',
    ['rulechange'])

  E('alarm_contracts', 'Alarm Contracts', 2, '230 Ψ', { psi: 230 },
    function (s) { return pactCount(s) >= 4 },
    function () { /* the ALARM term type: +90 s forecast in that region. Term choice never automates. */ },
    'They knew about the drought first, and told each other before they told you. (New contract term)',
    ['rulechange', 'information'])

  E('hypogeous_fruiting', 'Hypogeous Fruiting', 2, '275 Ψ + 60,000 Σ', { psi: 275, sig: 60000 },
    function (s) { return stat(s, 'flushes') >= 12 && stat(s, 'droughtsSurvived') >= 1 },
    function () { /* the UNDERGROUND mode: hazard 0, dispersal 0, 6.2× committed V at m = 1 */ },
    'Fruit below the litter, where nothing finds you and nothing carries you. (Zero-risk, no spores)',
    ['rulechange'])

  E('sclerotial_bank', 'Sclerotial Bank', 2, '320 Ψ + 110,000 Σ', { psi: 320, sig: 110000 },
    function (s) { return stat(s, 'signalOverflow') >= 2.0e5 },
    function () { /* banked ticks are not saturated ticks; cognition enforces that, not this file */ },
    'Nothing is wasted now. Something else is. (Overflow storage — read the second sentence)',
    ['trap', 'rulechange'])

  E('anastomotic_grafting', 'Anastomotic Grafting', 2, '380 Ψ + 6,000 ⛬', { psi: 380, min: 6000 },
    function (s) { return claimed(s) >= 22 && edgesPerNode(s) < 1.2 },
    function () { /* up to 3 artificial edges at hexDist ≤ 3, 2,000 ⛬ each to place */ },
    'Two parts of you that were never neighbours agree to be adjacent. (+3 network edges)',
    ['rulechange'])

  E('isotope_ledger', 'Isotope Ledger', 2, '460 Ψ', { psi: 460 },
    function (s) { return fc(s) >= 0.35 },
    function () { /* the LEDGER panel. It shows LEGACY. It does not say what LEGACY is for. */ },
    'Carbon remembers what it used to be inside. You can read it, if you are willing to look at it.',
    ['information', 'panel'])

  E('armillaria_accord', 'The Armillaria Accord', 2, '300 Ψ + 140,000 Σ', { psi: 300, sig: 140000 },
    function (s) { return rivalsHeld(s, 1, 0.60) >= 4 },
    function (s) { set(s.mult, 'rhoLocked', 0.55) },
    'It is older than you and has no opinions about speed. It decides what you leave in the ground.',
    ['irreversible', 'removes', 'cost'])

  E('mycelial_monoculture', 'Mycelial Monoculture', 2, '410 Ψ + 150,000 Σ', { psi: 410, sig: 150000 },
    function (s) { return claimed(s) >= 24 },
    function (s) { mul(s.mult, 'E', 1.85) },
    'One enzyme suite, one substrate, one answer. It is so much faster. (+85% enzyme power)',
    ['trap', 'multiplier'])

  // `stats.rivalsRepelled` does not exist in §3; `rivalContacts` is the contact counter a repel
  // policy drives, and it is the honest reading of "you have been fighting them for a long time".
  E('quiescence', 'Quiescence', 2, '240 Ψ + 50,000 ⛬', { psi: 240, min: 50000 },
    function (s) { return claimed(s) >= 30 && stat(s, 'rivalContacts') >= 8 },
    function (s) { mul(s.mult, 'sporeMult', 0.55) },
    'There is no one left to be faster than. (Deletes rivals, -45% spore yield)',
    ['irreversible', 'removes', 'cost'])

  // ── II-D Dominion ──────────────────────────────────────────────────────────

  E('mast_synchrony', 'Mast Synchrony', 2, '260 Ψ + 220,000 Σ', { psi: 260, sig: 220000 },
    function (s) { return stat(s, 'flushes') >= T().A2.MAST_FLUSH_GATE },
    function (s) { mul(s.mult, 'matSpeed', 2.10) },
    'The whole forest decides at once and nobody knows how. (Unlocks Mast Years)',
    ['rulechange', 'panel'])

  E('fenton_chemistry', 'Fenton Chemistry', 2, '240 Ψ + 240,000 Σ', { psi: 240, sig: 240000 },
    function (s) { return flag(s, 'laccase_cascade') },
    function (s) { mul(s.mult, 'E', 2.60) },
    'Iron, peroxide, and no particular care. (+160% enzyme power)',
    ['multiplier'])

  E('saltatory_conduction', 'Saltatory Conduction', 2, '260 Ψ + 200,000 Σ', { psi: 260, sig: 200000 },
    function (s) { return num(s.cog.dCond) >= 6 },
    function (s) { mul(s.mult, 'signalMult', 2.20) },
    'Skip the parts that do not matter. (+120% Signal, faster PULSE)',
    ['multiplier', 'rulechange'])

  E('synchronous_flush', 'Synchronous Flush', 2, '200 Ψ + 2,000 ⟡', { psi: 200, accord: 2000 },
    function (s) { return flag(s, 'mast_synchrony') },
    function () { /* the BLOOM pulse mode: m += 0.18·strength, hazard-immune for 20 s */ },
    'All of them, in the same minute, for no reason that you decided. (Unlocks BLOOM)',
    ['verb'])

  E('homeostatic_soil', 'Homeostatic Soil', 2, '240 Ψ + 24,000 ⛬', { psi: 240, min: 24000 },
    function (s) { return flag(s, 'humic_retention') && !flag(s, 'armillaria_accord') },
    function () { /* ρ tracks a humus setpoint; pinned overrides 5 → 10 */ },
    'Hold the number yourself. (Automates Retention)',
    ['automation'])

  E('firebreak_mycelium', 'Firebreak Mycelium', 2, '220 Ψ + 2.66e10 g',
    { psi: 220, g: a2g(8.0e10) },
    function (s) { return stat(s, 'ignitions') >= 1 },
    function (s) { mul(s.mult, 'hazMult', 0.25) },
    'Wet the ground ahead of it. (Fire control)',
    ['rulechange'])

  // 900,000 Σ was above the Sc ceiling described at II-E below; 440,000 sits under it.
  E('deep_substrate_hyphae', 'Deep Substrate Hyphae', 2, '280 Ψ + 260,000 Σ', { psi: 280, sig: 260000 },
    function (s) { return fc(s) >= 0.65 },
    function (s) { mul(s.mult, 'yieldMult', 1.85); set(s.mult, 'ripeT', T().A2.RIPE_T_DEEP) },
    'There is older wood underneath, and nobody is using it. (+85% yield, +litter)',
    ['multiplier', 'rulechange'])

  E('the_quiet_ring', 'The Quiet Ring', 2, '220 Ψ + 60,000 ⛬', { psi: 220, min: 60000 },
    function (s) { return fc(s) >= 0.55 && legacyLife(s) >= 0.45 },
    function () { /* rings 0 and 1 lock: no necrosis, no kill, no fire, ρ pinned at 0.60 */ },
    'Seven stands that will outlive the decision you are about to make.',
    ['irreversible', 'cost', 'removes'])

  E('the_charter', 'The Charter', 2, '260 Ψ + 7.99e10 g', { psi: 260, g: a2g(2.4e11) },
    function (s) { return legacyLife(s) >= T().A2.CHARTER_LIFE && fc(s) >= T().A2.PATH_FC },
    function (s) { mul(s.mult, 'yieldMult', 2.40); set(s.carry, 'pathFlag', 'symbiont') },
    'Terms, in perpetuity, with things that cannot read. (+140% yield on living stands)',
    ['fork', 'irreversible'],
    { excludes: ['total_conversion'] })

  E('total_conversion', 'Total Conversion', 2, '260 Ψ + 7.99e10 g', { psi: 260, g: a2g(2.4e11) },
    function (s) { return legacyLife(s) <= T().A2.CONVERSION_LIFE && fc(s) >= T().A2.PATH_FC },
    function (s) { mul(s.mult, 'necroMult', 3.00); set(s.carry, 'pathFlag', 'necrotroph') },
    'There is no second forest.',
    ['fork', 'irreversible'],
    { excludes: ['the_charter'] })

  // ── II-E The End of the Forest ─────────────────────────────────────────────

  // THE Σ CEILING. Signal is hard-clamped at Sc (BIBLE §2.3) and Sc = 260·(0.60+Σℓ)^0.85·
  // (1+dVes)^1.85·capMult. Σℓ is the live interface of sixty-one stands and it peaks near 45, so a
  // bare pool tops out around 7.3e3 Σ and a well-differentiated one — the reference player reaches
  // dVes 13–19 with Vesicular Storage's ×1.45 — peaks at a measured 5.55e5–5.77e5 Σ. 04's 9.0e5 and 1.2e6 Σ are above
  // that ceiling, which does not make them expensive, it makes them impossible: the pool cannot
  // physically hold the price at any allocation of D, so the card greys forever. Measured, both sat
  // unbought through 300 minutes of Act II while every other leg of their price was long since
  // covered. They are repriced under the ceiling, keeping their order: Deep Substrate first, then
  // Ballistospory, then the exit.
  E('ballistospory', 'Ballistospory', 2, '300 Ψ + 2.8e5 Σ', { psi: 300, sig: 2.8e5 },
    function (s) { return fc(s) >= 0.85 },
    function (s) { mul(s.mult, 'sporeMult', 2.80); mul(s.mult, 'matSpeed', 3.40) },
    'Fire them. Do not wait for wind. (Everything, faster)',
    ['multiplier', 'rulechange'])

  // The anti-softlock floor. It exists only for a player who necrotised faster than they could think.
  E('photoreception', 'Photoreception', 2, '1,300 Ψ',
    function () { return { psi: T().A2.PHOTO_COST } },
    function (s) { return fc(s) >= T().A2.PHOTO_FC },
    function () { /* cognition.Sr() takes max(Sr, PHOTO_FLOOR · SrPeak) under this flag */ },
    'Learn to face the sky. (Signal floor)',
    ['failsafe', 'rulechange'],
    { pinned: true })

  // Moved off fc ≥ 0.90 and off 1,000 Ψ, because both put it behind the thing it is a prerequisite
  // for. The six non-pinned slots are already full of the fc ≥ 0.85 wave by 0.90, so it entered the
  // reveal queue and stayed there; and 1,000 Ψ is unaffordable where Insight income has fallen with
  // the Signal rate that feeds it. Measured, it was not bought until 63 minutes after the exit was
  // already on screen, and until then the spore stock the exit asks for only decayed. fc ≥ 0.75 is
  // after the Signal peak and after the necrotrophic turn — the point at which the sentence on the
  // card is true — and it gets the entry a slot while there is still one to have.
  E('seed_bank', 'Seed Bank', 2, '200 Ψ + 9.99e10 g',
    { psi: 200, g: a2g(3.0e11) },
    function (s) { return fc(s) >= 0.75 },
    function () { /* spore decay off; biomass → spores on demand at SPORE_DIVISOR */ },
    'Nothing you make now is for you. (Labile carbon to spores)',
    ['rulechange', 'verb'])

  // THE ACT BREAK, PRICED AGAINST THE ACT THAT PAYS IT.
  //
  // The trigger is forest consumption ≥ 0.97, and by BIBLE §8 D22 the Signal curve is *already
  // falling* when it fires — the interface term Σℓ is the standing forest, and the forest has been
  // eaten. That decline is correct and is untouched here. What was wrong was the relationship
  // between the decline and the price.
  //
  // 04 asked 1.6e6 Σ. Σ is hard-clamped at Sc (BIBLE §2.3) and Sc = 260·(0.60+Σℓ)^0.85·
  // (1+dVes)^1.85·capMult, so at the moment the card appears — Σℓ down to about 9.7 from a peak
  // near 45 — the reference player's pool ceiling is 4.6e5 and their holding is 3.1e4. 1.6e6 is not
  // a long save against that, it is a wall: the only lever is Vesicle, and BIBLE §9.4 makes
  // time-to-fill scale as (1+dVes)^1.85, the *same* exponent that makes the price holdable. Every
  // point that brings the gate into reach pushes it the same distance away again. Measured, the
  // card came up at minute 361 against 98,830 Σ and wanted roughly fourteen more hours.
  //
  // Two changes, and they are the same change: the gate is repriced to what the act actually
  // produces, and its weight is moved off the one currency that is collapsing while the player
  // saves.
  //
  //   Σ 70,000   — what the decline itself pays out inside the target window, and about a sixth of
  //                the pool ceiling standing when the card appears. That headroom is the whole
  //                point: the price is holdable from the first second the card is visible and it
  //                never recedes as the ceiling falls, so the wait is a fill and not a capacity
  //                purchase. Measured over two seeds, 31,141 Σ and 253,500 Σ held at reveal, and
  //                the leg cleared at +23 and +0 minutes; it is 150 seconds of the rate those runs
  //                peaked at — the act's height, spent on leaving.
  //   Ψ 350      — Insight is BIBLE P2's *waiting*, it is earned only from saturation, and nothing
  //                about the collapse takes it away. It is the leg that makes the gate a wait
  //                rather than a formality, and it lands within a minute of the Σ leg. 04's 1,400
  //                was 45 minutes of end-of-act Insight income stacked on top of Photoreception's
  //                1,300 and Seed Bank's 1,000, which is how the endgame became an hour of staring.
  //   g 4.66e11  — biomass keeps accruing through the decline. 5.33e11 sat exactly on the level the
  //                bank crossed and fell back under as other things were bought; 4.66e11 clears
  //                before the card appears and stays clear.
  //   ◦ 2.0e8    — held 2.82e8 and 2.56e8 at reveal on the two seeds, and *falling*: past fc 0.90
  //                there is no canopy left to fruit in and the only source is Seed Bank, repriced
  //                above so it can arrive in time to stop the decay. 4.0e8 was never reached in
  //                300 minutes. This leg is deliberately the slackest of the four — it is the only
  //                one that can go backwards while the player saves, so it is the one that must
  //                never be the reason the gate is unpayable.
  //
  // A gate is allowed to be the largest number in the act. It is not allowed to be a number the act
  // does not produce.
  E('ascospore_discharge', 'Ascospore Discharge', 2, '70,000 Σ + 350 Ψ + 4.66e11 g + 2.0e8 ◦',
    { sig: 70000, psi: 350, g: a2g(1.4e12), spore: 2.0e8 },
    function (s) { return fc(s) >= T().A2.ASCOSPORE_FC },
    function (s) {
      if (HY.forest && HY.forest.ascospore) { HY.forest.ascospore(); return }
      var A = T().A2
      C().setStock(s.carry, 'sporeBank', num(s.res.spores) + Math.floor(num(s.res.biomass) / A.SPORE_DIVISOR))
      C().setStock(s.res, 'biomass', 0)
      C().setStock(s.res, 'minerals', num(s.res.minerals) * A.ASCOSPORE_MINERALS)
      C().setStock(s.res, 'accord', 0)
      mul(s.mult, 'signalMult', A.ASCOSPORE_SIGNAL_MULT)
      s.act = 3
      s.phase = 'canopy'
    },
    'Let go of the ground.',
    ['irreversible', 'removes'],
    { pinned: true })

  // ── II-F The D Faucet ──────────────────────────────────────────────────────

  E('slime_mould_correspondence', 'Slime Mould Correspondence', 2, '60 Ψ', { psi: 60 },
    function (s) { return s.res.insight >= 55 },
    function (s) { grantD(s, 1) },
    'Physarum solved the Tokyo rail network with oat flakes and no nervous system. (+1 D)',
    ['flavour'])

  E('the_wood_wide_web', 'The Wood Wide Web', 2, '180 Ψ', { psi: 180 },
    function (s) { return pactCount(s) >= 3 },
    function (s) { grantD(s, 1) },
    'A phrase invented by a journalist. It is not wrong. (+1 D)',
    ['flavour'])

  E('zombie_ant_fungus', 'Zombie-Ant Fungus', 2, '340 Ψ', { psi: 340 },
    function (s) { return claimed(s) >= 20 },
    function (s) { grantD(s, 1) },
    'Ophiocordyceps does not need a brain in order to use one. (+1 D)',
    ['flavour'])

  E('the_humongous_fungus', 'The Humongous Fungus', 2, '320 Ψ', { psi: 320 },
    function (s) { return claimed(s) >= 34 },
    function (s) { grantD(s, 2) },
    'Two thousand three hundred and eighty-four hectares, one organism, older than farming. (+2 D)',
    ['flavour'])

  E('prototaxites', 'Prototaxites', 2, '380 Ψ', { psi: 380 },
    function (s) { return fc(s) >= 0.50 },
    function (s) { grantD(s, 2) },
    'For forty million years the tallest thing alive was a fungus eight metres high. (+2 D)',
    ['flavour'])

  E('lichen', 'Lichen', 2, '440 Ψ', { psi: 440 },
    function (s) { return pactCount(s) >= 8 },
    function (s) { grantD(s, 2) },
    'Two organisms agreed to stop being two. (+2 D)',
    ['flavour'])

  // ── II-P The Pact Book · 05 §12 ────────────────────────────────────────────

  E('pact_first', 'Exudate Channels', 2, '90 Ψ', { psi: 90 },
    function (s) { return fc(s) >= T().A2.PACT_FIRST_FC },
    function (s) { set(pactBook(s), 'slots', T().A2.SLOTS_MIN) },
    'Opens the Pact Book. Two slots, three channels.',
    ['panel'])

  E('pact_slot_b', 'Second Conversation', 2, '240 Ψ', { psi: 240 },
    function (s) { return pactCount(s) >= 1 && pactMaxBond(s) >= 0.4 },
    function (s) { set(pactBook(s), 'slots', Math.max(3, pactSlots(s))) },
    'You can hold two thoughts about two things. (Third slot)',
    ['rulechange'])

  E('pact_bandwidth_1', 'Rhizomorph Cores', 2, '420 Ψ', { psi: 420 },
    function (s) { return channelsFull(s) },
    function (s) { set(pactBook(s), 'projectChannels', num(pactBook(s).projectChannels) + 1) },
    'One more thing you can say at once. (+1 channel)',
    ['rulechange'])

  E('pact_slot_c', 'The Book', 2, '150 ⟡', { accord: 150 },
    function (s) { return pactSlots(s) === 3 },
    function (s) { set(pactBook(s), 'slots', Math.max(4, pactSlots(s))) },
    'Four at a time, and a page to keep them on. (Fourth slot)',
    ['rulechange'])

  E('pact_chemotaxis', 'Chemotaxis', 2, '340 Ψ + 60 ⟡', { psi: 340, accord: 60 },
    function (s) {
      return pactCount(s) >= T().A2.PACT_CHEMO_PACTS && pactMaxTenure(s) >= T().A2.PACT_CHEMO_TENURE
    },
    function () { /* the EXPOSURE view and the three stress tests */ },
    'Reveals exposure vectors and the stress tests. (The EXPOSURE view)',
    ['information', 'panel'])

  E('pact_slot_d', 'Standing Terms', 2, '200 Ψ + 1,200 ⟡', { psi: 200, accord: 1200 },
    function (s) { return fc(s) >= 0.20 },
    function (s) { set(pactBook(s), 'slots', Math.max(5, pactSlots(s))) },
    'Terms that outlast the season that set them. (Fifth slot)',
    ['rulechange'])

  E('pact_attunement', 'Attunement', 2, '180 ⟡', { accord: 180 },
    function (s) { return stat(s, 'traitsRevealed') >= 4 },
    function (s) { set(pactBook(s), 'traitThresholdMult', 0.55) },
    'You learn a partner faster by keeping it. (Trait thresholds ×0.55)',
    ['information'])

  E('pact_perennial', 'Perennial Terms', 2, '220 Ψ + 2,400 ⟡', { psi: 220, accord: 2400 },
    function (s) { return stat(s, 'pactsHonoured') >= 3 },
    function (s) { set(pactBook(s), 'autoRenew', 2) },
    'Auto-renew at two terms. (-54% honour accord)',
    ['automation', 'cost'])

  E('pact_bandwidth_2', 'Deep Translocation', 2, '240 Ψ + 3,200 ⟡', { psi: 240, accord: 3200 },
    function (s) { return fc(s) >= 0.34 },
    function (s) { set(pactBook(s), 'projectChannels', num(pactBook(s).projectChannels) + 1) },
    'Further down, and wider. (+1 channel)',
    ['rulechange'])

  E('pact_slot_e', 'The Web', 2, '420 ⟡', { accord: 420 },
    function (s) { return fc(s) >= 0.38 },
    function (s) { set(pactBook(s), 'slots', Math.max(7, pactSlots(s))) },
    'Unlocks RIVAL and cross-pacts. (Seventh slot)',
    ['rulechange', 'verb'])

  // Reallocation is a verb too. Six live pacts is the state in which changing your mind has
  // started costing something, which is what the card is about.
  E('pact_plasticity', 'Plasticity', 2, '260 Ψ + 4,200 ⟡', { psi: 260, accord: 4200 },
    function (s) { return stat(s, 'reallocations') >= 20 || pactCount(s) >= 6 },
    function (s) { set(pactBook(s), 'plasticity', 0.22) },
    'Changing your mind stops costing what it did. (Tenure penalty 0.55 → 0.22)',
    ['rulechange'])

  E('pact_slot_f', 'The Compact', 2, '900 ⟡', { accord: 900 },
    function (s) { return fc(s) >= 0.62 },
    function (s) { set(pactBook(s), 'slots', Math.max(8, pactSlots(s))) },
    'Unlocks brokering. (Eighth slot)',
    ['rulechange', 'verb'])

  E('pact_bandwidth_3', 'Aggregate Vessels', 2, '300 Ψ + 6,000 ⟡', { psi: 300, accord: 6000 },
    function (s) { return fc(s) >= 0.70 },
    function (s) { set(pactBook(s), 'projectChannels', num(pactBook(s).projectChannels) + 2) },
    'Everything at once, along one road. (+2 channels)',
    ['rulechange'])

  E('pact_slot_g', 'Nine Voices', 2, '1,600 ⟡', { accord: 1600 },
    function (s) { return fc(s) >= 0.82 },
    function (s) { set(pactBook(s), 'slots', Math.max(T().A2.SLOTS_MAX, pactSlots(s))) },
    'As many as there will ever be. (Ninth slot)',
    ['rulechange'])

  E('pact_refixation', 'Refixation', 2, '220 Ψ',
    function (s) { return { psi: 220 * Math.pow(2, num(s.proj.uses.pact_refixation)) } },
    function (s) { return nodulScarred(s) },
    function (s) {
      var p = pactBook(s)
      set(p, 'noduleScars', Math.max(0, num(p.noduleScars) - 1))
      mul(s.mult, 'E', 1 / 0.92)
    },
    'Removes one enzyme scar. It costs more every time. (Repairs a breach)',
    ['rearm'],
    { rearm: true })

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT III — BLOOM · 50 entries
  // 03 §18's F–J tiers (46), plus `anti_organ` and three Antiphony support entries (BIBLE §7 C2).
  // 04 §7 is void (C1); the three of its entries that carried unique flavour and would otherwise
  // have duplicated a title already spent in Act II — Aspergillus on the Station, Endolith,
  // Pilobolus — are re-homed onto 03's D-granting slots F8, H9 and J6 with 03's costs and effects,
  // and The Deep Biosphere onto H6, whose published title carried a banned roman numeral.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── III-F Canopy (Phase A) ─────────────────────────────────────────────────

  // PHASE A IS PAID FOR IN CARBON, NOT INSIGHT.
  //
  // Measured over three seeds, Insight income in Phase A is exactly zero: Ψ stood at 34.30, 57.30
  // and 37.90 for ninety consecutive minutes each, unchanged to the last digit. That is not slow
  // accrual, it is none — Insight accrues only while the Signal pool is saturated (`02` §5, carried
  // into Act III by `03` §12.2), and Phase A is an hour and a half of uninterrupted fleet growth, so
  // Sc climbs faster than S can chase it and the pool never touches its cap. The starvation belongs
  // to cognition.js (`saturated`/`insightRate`) and bloom.js (Λ against Sc); it is not this file's
  // to fix and no discount here would fix it — an entry priced in a currency whose income is zero
  // is not expensive, it is impossible, which is the same fault this file already documents at
  // `escape_velocity` and `ascospore_discharge`.
  //
  // So the Ψ-priced entries of the canopy tier are repriced in Χ, which is the one thing Phase A
  // produces in quantity: measured 1.0e13 at the act break, 1.0e15 at +12 min, 2.4e16 at +20,
  // 4.0e17 at +26, 1.7e18 at the escape gate. Carbon-time is Phase A's own clock.
  //
  // THE TIER IS SPREAD ALONG THAT CLOCK BECAUSE THE PHASE IS THREE TIMES ITS DESIGNED LENGTH.
  //
  // `03` §3 budgets Phase A at 22 minutes and tier F holds eight entries, which is a rung every
  // three minutes on the phase the tier was written for. Measured on the built game over three
  // seeds and all three ending paths, Phase A runs 72–74 minutes: `planetConsumed` crosses 0.22 at
  // +30 and then decelerates, because 72% of BIOME_X0 sits in biomes 5 and 7 and both carry a
  // penalty. Eight entries keyed to biome counts all land inside the first 30 minutes — every biome
  // is reached by then — and the last 26 minutes had *no entry on the board at all*, on every seed.
  // The duration belongs to bloom.js (harvest against BIOME_X0) and is not this file's to shorten
  // directly; what is this file's is that nothing was keyed to the second half of the phase.
  //
  // So the tier is re-keyed onto two clocks rather than one. The verbs and the biome unlocks keep
  // their causal triggers — they gate REACH and they must arrive before the thing they open — and
  // the three that have no causal position are moved onto `planetConsumed`, which is the phase's
  // own progress bar and therefore compresses with it if bloom.js ever brings the phase back to 22
  // minutes. `endolith` and `the_ediacaran_silence` come forward from the void for the same reason:
  // both are flavour grants of a single D point with no system behind them, so they are the only
  // two entries in the act that can be honestly moved, and the tail of Phase A is where the act has
  // nothing else to put on the board.
  //
  // The two penalty-lifters are also the accelerator, and they are priced to arrive early for that
  // reason: Permafrost is 42% of the planet's carbon at harvMod 0.72 and Wetland is 30% of it at
  // repMod 0.55. Bought at +14 and +23 instead of +46 and +36, they shorten the tail they are
  // spread across, which is the only lever this file has on the duration itself, and measured it
  // moves: Phase A comes in at 62–65 minutes across nine runs against the 72–74 it ran before.
  //
  // AND THE TIER IS PRICED IN Σ, NOT Χ. Carbon in Phase A is not a balance the player spends from,
  // it is the fleet's food: replication draws on the same stock a project would. A first draft of
  // this pass put the whole tier on the carbon clock
  // and measured the phase getting *longer* — 91 minutes against 72 — because every rung bought was
  // a rung of replication not bought, and the escape gate's own 9.0e17 Χ was still standing at +91
  // with 8.99e17 held. Signal is the opposite: it is hard-clamped at Sc, and past the eighth REACH
  // the pool sits at its cap — a measured 7.4e4 Σ, flat, for forty consecutive minutes with the
  // income above it discarded. Spending Σ in the tail of Phase A costs the phase nothing at all,
  // which is exactly what a paced ladder wants underneath it.
  E('germ_tube', 'Germ Tube', 3, '200 Σ', { sig: 200 },
    // 03's `n ≥ 2.0e8` and 04's `X ≥ 4.0e14` are both crossed at +8 minutes, and until then the
    // Act III board was empty — the two verbs that open the act arrived eight minutes after it did.
    // They are keyed to the act instead, and priced against what the act break actually hands over:
    // 500 Σ and 1.0e13 Χ.
    function (s) { return s.act === 3 && !inVoid(s) },
    function () { /* auto-SETTLE at 1.5 × SETTLE_Q/s. Automation inside a minute, third act running. */ },
    'Grow toward the smell of carbon. (Automates SETTLE)',
    ['automation'])

  // The one carbon leg the tier keeps. Σ at the act break is a measured 500–620 and clamped there
  // until the fleet grows, so a second Σ rung on top of GERM TUBE could not be paid for six minutes
  // whatever it cost; 1.2e14 Χ is three minutes of the opening carbon curve and it is the smallest
  // number in the act, so the fleet never feels it.
  E('appressorium', 'Appressorium', 3, '1.2e14 Χ', { carbon: 1.2e14 },
    function (s) { return s.act === 3 && !inVoid(s) },
    function () { /* unlocks REACH and the eight-biome list */ },
    'Force an entry. (Unlocks REACH)',
    ['verb', 'panel'])

  E('translocation', 'Translocation', 3, '2,400 Σ', { sig: 2400 },
    function (s) { return s.act === 3 && !inVoid(s) },
    function () { /* the TRIANGLE opens with two vertices */ },
    'Move it to where it is needed. (Unlocks the triangle)',
    ['panel', 'dial'])

  E('osmotic_adjustment', 'Osmotic Adjustment', 3, '5,000 Σ', { sig: 5000 },
    function (s) { return s.act === 3 && !inVoid(s) },
    function () { /* biome 6 becomes reachable */ },
    'Salt is only a gradient. (Unlocks a biome)',
    ['rulechange'])

  E('antifreeze_glycoprotein', 'Antifreeze Glycoprotein', 3, '9,000 Σ', { sig: 9000 },
    function (s) { return biomesReached(s) >= 3 },
    function () { /* biomes 2 and 7 lose their penalty */ },
    'Ice grows in shapes you can forbid. (Two biome penalties removed)',
    ['rulechange'])

  E('secondary_metabolites', 'Secondary Metabolites', 3, '16,000 Σ', { sig: 16000 },
    function (s) { return biomesReached(s) >= 4 },
    function () { /* biome 4 penalty removed; the ANT axis unlocks early */ },
    'Nothing else here has read your chemistry. (Biome penalty removed)',
    ['rulechange'])

  E('facultative_anaeroby', 'Facultative Anaeroby', 3, '21,000 Σ', { sig: 21000 },
    function (s) { return biomesReached(s) >= 5 },
    function () { /* biome 5 penalty removed */ },
    'Breathing was always optional. (Biome penalty removed)',
    ['rulechange'])

  // The three entries with no causal position in the phase. Every biome is reached by +30 and after
  // that `planetConsumed` is the only quantity in Phase A still moving, so it is what spaces them;
  // the prices are short saves against a pool that is standing at its cap, because the trigger is
  // already doing the spacing and a long save on top of it is the 26-minute hole again, one rung
  // further along.
  E('aspergillus_on_the_station', 'Aspergillus on the Station', 3, '50,000 Σ', { sig: 50000 },
    function (s) { return planetConsumed(s) >= 0.22 },
    function (s) { grantD(s, 1) },
    'They swab the station walls every week, and every week there is more. Not a problem yet. (+1 D)',
    ['flavour'])

  E('endolith', 'Endolith', 3, '60,000 Σ', { sig: 60000 },
    function (s) { return planetConsumed(s) >= 0.40 },
    function (s) { grantD(s, 1) },
    'Between the grains of rock, things divide every ten thousand years. Waiting for nothing. (+1 D)',
    ['flavour'])

  E('the_ediacaran_silence', 'The Ediacaran Silence', 3, '78,000 Σ', { sig: 78000 },
    function (s) { return planetConsumed(s) >= 0.55 },
    function (s) { grantD(s, 1) },
    'Six hundred million years of nothing deciding to move. (+1 D)',
    ['flavour'])

  // GENOME IS THE TAIL'S ONE SUBSTANTIAL PURCHASE, AND IT IS LIVE HERE.
  //
  // `03` §18.2 keys it to the void flag, and on a 22-minute Phase A that is right — the genome is
  // what you decide on the way out. On the measured 64-minute one it left the last third of the
  // phase with three flavour grants and the exit in it, and nothing else in the act can honestly be
  // moved: every other void entry acts on transit, bands, light-lag or strains, and bloom.js makes
  // all four inert in the canopy (λ is LAMBDA_REF, exploration is binary, there is no transit
  // because REACH is instantaneous). The genome is the exception. Loci are read by harvest and
  // replication with no canopy branch at all, the panel is gated on the flag and `act >= 3` rather
  // than on the phase, and ESCAPE preserves loci by name — so bought here it is live here, live
  // across the break, and the four free loci make the tail it sits in shorter.
  //
  // It is also the right sentence for the place. The planet is four-fifths eaten, there is nothing
  // left to reach, and the question the card asks is the one the player now has time for.
  E('genome', 'Genome', 3, '40,000 Σ', { sig: 40000 },
    function (s) { return planetConsumed(s) >= 0.10 },
    function (s) {
      var A = T().A3
      set(s.a3, 'lociCap', Math.max(num(s.a3.lociCap), A.LOCI_CAP0))
      set(s.a3, 'lociFree', A.LOCI_FREE0)
    },
    'Decide what you are for. (Unlocks the genome, four free loci)',
    ['panel', 'dial'])

  // ── III-G Escape and the first bands ───────────────────────────────────────

  // 03 §4 prices this at 9.0e17 Χ + 620,000 Σ + 180 Ψ. Two of those three legs are priced in
  // currencies Phase A cannot deliver at the moment the gate is open, and they fail in opposite
  // directions, which is why no run had ever escaped.
  //
  // Σ: Act III Signal is Λ ∝ Σ_b n_b^0.18, fed by harvest. `planetConsumed ≥ 0.97` means there is
  // no carbon left to harvest, so the fleet starves, Λ collapses and Sc collapses with it. Measured,
  // the run crossed pc = 0.99 holding 108,657 Σ against a peak capacity of 298,080 Σ and eight
  // minutes later held a capacity of 45,106 Σ: 620,000 was not merely unaffordable, it was
  // unholdable, permanently, from the instant the trigger fired. 80,000 Σ is the largest number the
  // measured Phase A reaches while the gate is live, and it is still 3.3× the ladder's last REACH.
  //
  // Ψ: Insight accrues only while the Signal pool is saturated (`02` §5, carried into Act III by
  // `03` §12.2), and Phase A is ninety minutes of uninterrupted fleet growth, so Sc rises faster
  // than S can chase it and the pool never saturates. Measured, Insight sat at exactly 15.27 Ψ for
  // seventy-five consecutive minutes — an income of zero — and only began accruing at t = 26,453,
  // after the fleet had collapsed, reaching 190 Ψ at t = 27,894 by which time Σ had fallen to
  // 45,106. The Σ leg and the Ψ leg are never payable in the same second, so ESCAPE is priced in
  // the two currencies Phase A does produce. Insight is Act III's currency from the void onward,
  // where the pool does saturate and the three endings are priced in it.
  //
  // THE GATE IS REVEALED BEFORE IT OPENS. `planetConsumed` crosses 0.88 about eleven minutes before
  // it crosses ESCAPE_PC, and those were eleven of the twenty-six minutes in which Phase A had
  // nothing on the board at all. The two predicates exist precisely for this: `trigger` says the
  // door is there and can be saved toward, `also` holds ESCAPE_PC — TUNE's number, unchanged and
  // still the only thing that opens it. The player watches the last of the planet go with the exit
  // in front of them, which is the scene `03` §3.4 asks for and the opposite of an empty list.
  E('escape_velocity', 'Escape Velocity', 3, '9.0e17 Χ + 80,000 Σ',
    { carbon: 9.0e17, sig: 80000 },
    function (s) { return planetConsumed(s) >= 0.80 },
    function (s) {
      if (HY.bloom && HY.bloom.escape) { HY.bloom.escape(); return }
      // 96% of the fleet, exactly, never stochastically (BIBLE D26).
      var keep = 1 - T().A3.ESCAPE_LOSS, i
      for (i = 0; i < s.a3.biomes.n.length; i++) s.a3.biomes.n[i] *= keep
      for (i = 0; i < s.a3.bands.n.length; i++) s.a3.bands.n[i] *= keep
      s.phase = 'void'
      stamp(s, 'void_t')     // ENCYST is offered 20 minutes after this instant
    },
    'Leave nothing behind that can decide to stay.',
    ['irreversible', 'removes'],
    { pinned: true, also: function (s) { return planetConsumed(s) >= T().A3.ESCAPE_PC } })

  // THE VOID IS PAID FOR IN CARBON. INSIGHT BELONGS TO THE ENDINGS.
  //
  // 04 §7 is void and `03` §18's void tiers were transcribed with a Ψ leg on almost every entry:
  // thirty-five entries asking about 70,000 Ψ between them. Measured over three seeds, the void
  // produces 15–25 Ψ/min once the Signal pool starts saturating and *nothing at all* before that —
  // Insight stood at 11.9, 50.2 and 30.6 Ψ, unchanged to the last digit, for the first 80–100
  // minutes after ESCAPE on the three runs. Against that income the tier is priced at roughly
  // seventeen times what the act makes, and it showed: the reference player bought twenty-one
  // entries in five hundred minutes of Act III, one every 24 minutes, with single gaps of 111, 166
  // and 170 minutes and no ending ever reached.
  //
  // Two facts settle what the ladder should be priced in.
  //
  //   · Carbon is the one thing the void makes in quantity, monotonically, and never gives back.
  //     Re-measured on the built game over three seeds and all three ending paths, from the second
  //     ESCAPE fires: 1e18–3.5e19 held at +0, 3–4.7e20 at +2 minutes, 1.8–2.6e21 at +4, 0.8–1.2e22
  //     at +6, 3.0–3.9e22 at +8, 7.3–8.6e22 at +10, 2.0–2.3e23 at +14, 1.9–3.2e24 at +18,
  //     0.9–5.3e25 at +22, 4e25–8.4e26 at +30. The `cede` path runs about one order ahead of the
  //     other two by +10 and two by +18, so the rungs below are set against the slowest of the
  //     three and simply arrive earlier on the fastest. Carbon-time is also the act's own clock: if
  //     bloom.js makes the fleet grow faster the whole ladder compresses with it, which is the
  //     coupling a paced catalog should have.
  //
  //     THE BOTTOM OF THE LADDER WAS THREE ORDERS ABOVE THE VOID IT OPENS ON. The figures the rungs
  //     were first set against — 5e23 held before the first cohort disperses — are not what the
  //     built game hands the player at ESCAPE, which is 1e18–3.5e19. Measured, the first rung sat
  //     at an affordability ratio of 1.28e4 in the second after ESCAPE and the void's opening
  //     twenty minutes contained three purchases, all of them in the first second, and then nothing
  //     until ENCYST armed. The rungs below are re-set against the curve above, one every two to
  //     three minutes, so the twenty minutes before the failsafe arms are the ladder's densest
  //     stretch rather than its emptiest.
  //   · The three endings are priced in Ψ (2,400 and 3,600 by TUNE). Every Ψ a project takes is a
  //     Ψ the ending does not get, and at 20 Ψ/min the whole void produces about one ending's
  //     worth. So the void tier takes none of it: Insight is what the player is saving *toward*
  //     from the moment they leave the planet, and the projects are what they buy while saving.
  //
  // The first three rungs are Σ rather than Χ, and they are small on purpose. ESCAPE drains the
  // Signal pool to about 1.2e3 Σ and the void's Sc is a function of a fleet that cannot spread
  // until DISPERSE exists, so before `thrust` is bought the pool tops out near 3e4–6e4 Σ and
  // refills at roughly 600 Σ/min. A first draft of this pass priced them 10,000 / 26,000 / 90,000
  // and measured the exact failure this file warns about twice already: `thrust` sat above the
  // ceiling, DISPERSE never opened, the fleet never left band 0, carbon froze at 4.93e23 and the
  // run made no purchase at all for the remaining 470 minutes. `thrust` is a gate, not an upgrade;
  // it is priced at a fifth of the ceiling standing when it appears and everything downstream of
  // it — which is the entire carbon ladder — is priced behind it.
  E('radial_survey', 'Radial Survey', 3, '7,000 Σ', { sig: 7000 },
    function (s) { return inVoid(s) },
    function () { /* the VOID canvas, the band list and the exploration readout */ },
    'Look outward. It is all outward. (Unlocks the bands)',
    ['panel', 'information'])

  E('thrust', 'Thrust', 3, '12,000 Σ', { sig: 12000 },
    function (s) { return s.a3.bands.e[0] >= 0.25 },
    function () { /* the triangle's third vertex: DISPERSE */ },
    'There is nothing to push against. Push anyway. (Unlocks DISPERSE)',
    ['verb'])

  E('chemotropism', 'Chemotropism', 3, '1.7e23 Χ', { carbon: 1.7e23 },
    function (s) { return bandsReached(s) >= 2 },
    function (s) { mul(s.mult, 'exploreMult', 1.7) },
    'Follow the gradient across four light-years. (+70% exploration)',
    ['multiplier'])

  E('sclerotial_coat', 'Sclerotial Coat', 3, '1.3e23 Χ', { carbon: 1.3e23 },
    function (s) { return inTransit(s) >= 0.1 * fleet(s) && inTransit(s) > 0 },
    function () { /* TR_HAZ ×0.55; bloom reads the flag at the point of attribution */ },
    'Harden. Wait. It is a long way. (-45% transit hazard)',
    ['rulechange'])

  E('recruit', 'Recruit', 3, '4.6e23 Χ', { carbon: 4.6e23 },
    function (s) { return bandsReached(s) >= 2 && inTransit(s) > 0 },
    function () { /* the RECRUIT pulse mode */ },
    'Tell the ones already moving to hurry. (Unlocks RECRUIT)',
    ['verb'])

  // ── III-H Deep void ────────────────────────────────────────────────────────

  E('hyphal_continuity', 'Hyphal Continuity', 3, '2.4e25 Χ', { carbon: 2.4e25 },
    function (s) { return inVoid(s) && bandsReached(s) >= 4 },
    function () { /* LAG_K ×0.78: the light-lag on a pulse shortens, it does not vanish */ },
    'A thought that takes a century is still a thought. (-22% pulse lag)',
    ['rulechange'])

  E('pyomelanin', 'Pyomelanin', 3, '2.4e27 Χ', { carbon: 2.4e27 },
    function (s) { return inVoid(s) && stat(s, 'radiationHazards') >= 20 },
    function (s) { if (s.a3.loci) s.a3.loci[LOCUS_MEL] = s.a3.loci[LOCUS_MEL] + 1 },
    'Black is not a colour. It is a decision. (+0.9 melanisation, no harvest cost)',
    ['rulechange'])

  E('saltatory_conduction_void', 'Saltatory Conduction', 3, '5.6e27 Χ', { carbon: 5.6e27 },
    function (s) { return inVoid(s) && stat(s, 'pulses') >= 12 },
    function () { /* pulse cooldown 75 → 50 s */ },
    'Skip the parts in between. (Faster PULSE)',
    ['rulechange'])

  // 03's trigger is behavioural — SURPLUS fell while n rose, twice. §3.stats carries no such counter,
  // and `targetsReached` is the arrival count that only rises once a band is being grown into.
  E('allometry', 'Allometry', 3, '3.5e24 Χ', { carbon: 3.5e24 },
    function (s) { return inVoid(s) && bandsReached(s) >= 3 && stat(s, 'targetsReached') >= 2 },
    function () { /* draws n*_b on every band bar. Deliberately expensive and deliberately late. */ },
    'There is a size that produces the most. It is small. (Draws the maximum)',
    ['information'])

  // THE ⛬ LEGS ARE GONE, AND THE REASON IS THE ONE THIS FILE APPLIES EVERYWHERE ELSE.
  //
  // Nothing in Act III produces minerals. The whole bank is forest.js's ×0.25 of whatever Act II
  // happened to be holding at the break, and that is not a number the third act can influence:
  // measured over nine runs — three seeds against all three ending paths — the carry was 3.1e3,
  // 2.37e4, 4.53e4, 1.16e5, 1.24e5, 1.62e5, 1.87e5, 2.21e5 and 2.46e5 ⛬. A seventy-nine-fold spread
  // decided two hundred minutes earlier, in another act, by variance the player never sees.
  //
  // Against that distribution a fixed ⛬ leg is not a price, it is a coin flip. `03` §18.5 budgets
  // 12,000 ⛬ across these two and `circadian_entrainment` and says a low-mineral run must choose two
  // of the three — but it assumed an inherited 4,500–12,500 ⛬. At the top of the measured spread all
  // three are 5% of the bank and there is no choice to make; at the bottom none of the three is
  // payable and the run loses PHASE, and with it the ϒ gate every ending but ENCYST is behind.
  // Worse, measured: on the 3.1e3 ⛬ seed the third act made no purchase at all for its whole
  // length, because the reference player will not spend a mineral it needs for the phase gate and
  // the phase gate was never payable. Both legs move to Χ, which is the only currency the act makes.
  E('neutrino_precursor', 'Neutrino Precursor', 3, '1.2e26 Χ', { carbon: 1.2e26 },
    function (s) { return inVoid(s) && bandsReached(s) >= 5 && stat(s, 'radiationHazards') >= 1 },
    function () { /* 40 s of warning, and the ENCYST pulse mode */ },
    'The light is the last part to arrive. (40 s warning)',
    ['information', 'verb'])

  E('the_deep_biosphere', 'The Deep Biosphere', 3, '4.0e26 Χ', { carbon: 4.0e26 },
    function (s) { return inVoid(s) && bandsReached(s) >= 6 },
    function (s) {
      var r = s.a3.bands.rich, i
      for (i = 0; i < r.length; i++) if (r[i] < 0.85) r[i] = 0.85
    },
    'More life two kilometres down than on the surface, none of it in a hurry. (Richness floor)',
    ['rulechange'])

  E('radiotrophy', 'Radiotrophy', 3, '7.0e30 Χ', { carbon: 7.0e30 },
    function (s) { return inVoid(s) && s.a3.loci[LOCUS_MEL] >= 4 },
    function () { /* the radiation term flips sign; the target list re-sorts in front of you */ },
    'Fungi grow inside Chernobyl reactor four, toward the radiation. What was killing you is a meal.',
    ['inversion', 'rulechange'])

  E('plasmogamy', 'Plasmogamy', 3, '1.0e27 Χ', { carbon: 1.0e27 },
    function (s) { return inVoid(s) && num(s.cog.respecs) >= 1 },
    function () { /* REGENOME 90 → 60 s, cost ×0.70 */ },
    'Two nuclei, one wall, no argument yet. (Cheaper, faster respec)',
    ['rulechange'])

  E('isotropy', 'Isotropy', 3, '1.3e28 Χ', { carbon: 1.3e28 },
    function (s) { return inVoid(s) && bandsReached(s) >= 9 },
    function () { /* τ_b ×0.80 on every leg */ },
    'It is the same in every direction. Confirmed. (-20% transit time)',
    ['rulechange'])

  // ── III-I Divergence ───────────────────────────────────────────────────────

  E('interference_competition', 'Interference Competition', 3, '5.0e28 Χ', { carbon: 5.0e28 },
    function (s) { return stat(s, 'strainsBorn') >= 1 },
    function () { /* unlocks QUARANTINE */ },
    'Make the ground unpleasant and then leave it. (Unlocks QUARANTINE)',
    ['verb'])

  E('proofreading', 'Proofreading', 3, '3.2e29 Χ', { carbon: 3.2e29 },
    function (s) { return stat(s, 'strainsBorn') >= 1 },
    function (s) { addFid(s, 0.045) },
    'Read it back before you let it go. (+0.045 fidelity)',
    ['multiplier'])

  E('antagonise', 'Antagonise', 3, '2.0e29 Χ', { carbon: 2.0e29 },
    function (s) { return stat(s, 'engagements') >= 1 },
    function () { /* the ANTAGONISE pulse mode */ },
    'Everything you make, you can also make against them. (New pulse mode)',
    ['verb'])

  E('anastomosis_offer', 'Anastomosis Offer', 3, '5.0e29 Χ', { carbon: 5.0e29 },
    function (s) { return strains(s).length >= T().A3.ANASTOMOSIS_STRAINS },
    function () { /* unlocks ABSORB, and therefore the allele economy */ },
    'Ask them to come back. Mean it. (Unlocks ABSORB)',
    ['verb'])

  // The α legs are 600 and 300 rather than 04's 600 / 1,200 / 2,000, and
  // `heterokaryon_incompatibility` has none at all. Alleles come from ABSORB and nothing else, so
  // their income belongs to divergence.js, and measured it is not a rate but a single burst: the
  // stock crosses 600 once, around eighty minutes into the void, and then accrues at about 0.3
  // α/min for the rest of the run. One α leg per run is what that supports. Priced at 2,000,
  // `heterokaryon_incompatibility` sat at an affordability ratio of 9.85 — unchanged, to three
  // decimal places, for four hundred minutes — and at 700 it still sat at 5.93.
  E('conserved_core', 'Conserved Core', 3, '3.0e30 Χ + 600 α', { carbon: 3.0e30, alpha: 600 },
    function (s) { return s.res.alleles >= 600 },
    function (s) { addFid(s, 0.060) },
    'Some of it was never allowed to change. (+0.060 fidelity)',
    ['multiplier'])

  E('sequencer', 'Sequencer', 3, '8.0e28 Χ', { carbon: 8.0e28 },
    function (s) { return stat(s, 'strainsBorn') >= 1 },
    function () { /* unlocks SEQUENCE: the quantified unknown becomes a price */ },
    'Read what they became. (Unlocks SEQUENCE)',
    ['verb', 'information'])

  E('parallel_antagonism', 'Parallel Antagonism', 3, '2.0e30 Χ', { carbon: 2.0e30 },
    function (s) { return strains(s).length >= 3 },
    function () { /* one more concurrent engagement */ },
    'Two fronts. It was always going to be two fronts. (+1 engagement)',
    ['rulechange'])

  E('chaperone', 'Chaperone', 3, '8.0e29 Χ', { carbon: 8.0e29 },
    function (s) { return inVoid(s) && effFid(s) < 0.75 },
    function (s) { addFid(s, 0.035) },
    'Hold it in the right shape until it sets. (+0.035 fidelity)',
    ['multiplier'])

  E('the_armillaria_problem', 'The Armillaria Problem', 3, '1.3e30 Χ', { carbon: 1.3e30 },
    function (s) { return stat(s, 'strainsBorn') >= 4 },
    function (s) { grantD(s, 1) },
    'Nine hundred hectares. One individual. No centre. (+1 D)',
    ['flavour'])

  E('somatic_incompatibility', 'Somatic Incompatibility', 3, '4.5e30 Χ + 300 α', { carbon: 4.5e30, alpha: 300 },
    function (s) { return !!succ(s) },
    function () { /* SKIRM_K ×0.45, and a 1.20 advantage against the Successor */ },
    'Recognise what is not you. Refuse it. (-55% predation)',
    ['rulechange'])

  // ── III-J Synchrony and the endings ────────────────────────────────────────

  E('tropism', 'Tropism', 3, '1.0e31 Χ', { carbon: 1.0e31 },
    function (s) { return inVoid(s) && stat(s, 'reallocations') >= 25 },
    function () { /* triangle policy automation, published at 0.86× skilled play */ },
    'Let it steer. It will steer worse. (Automates the triangle, 0.86×)',
    ['automation'])

  // The third of `03` §18.5's mineral legs, dropped for the reason given at `neutrino_precursor`.
  // This is the one that mattered most: PHASE is what ϒ is made of, and ϒ gates two of the three
  // endings, so a 6,000 ⛬ leg against a measured 3.1e3 ⛬ carry made the run's ending a function of
  // Act II's variance rather than of anything done in Act III.
  E('circadian_entrainment', 'Circadian Entrainment', 3, '1.5e31 Χ', { carbon: 1.5e31 },
    function (s) { return bandsReached(s) >= 11 },
    function () { /* the PHASE system, the wheel, and the ENTRAIN pulse mode */ },
    'Agree on when now is. (Unlocks PHASE)',
    ['panel', 'verb'])

  E('isochrony', 'Isochrony', 3, '3.2e31 Χ', { carbon: 3.2e31 },
    function (s) { return flag(s, 'circadian_entrainment') },
    function () { /* band period spread ×0.55; pulse cooldown → 35 s */ },
    'Make the far ones tick like the near ones. (Narrower periods)',
    ['rulechange'])

  E('heterokaryon_incompatibility', 'Heterokaryon Incompatibility', 3, '5.0e31 Χ', { carbon: 5.0e31 },
    function (s) { return flag(s, 'circadian_entrainment') },
    function (s) { addFid(s, 0.050) },
    'Nothing enters. (+0.050 fidelity)',
    ['multiplier', 'rulechange'])

  E('chronometry', 'Chronometry', 3, '2.2e31 Χ', { carbon: 2.2e31 },
    function (s) { return flag(s, 'circadian_entrainment') },
    function () { /* the wheel shows per-band φ and its dotted projection */ },
    'See the disagreement. (Phase readout)',
    ['information'])

  E('pilobolus', 'Pilobolus', 3, '8.0e31 Χ', { carbon: 8.0e31 },
    function (s) { return num(s.a3.upsilon) >= 0.50 },
    function (s) { grantD(s, 1) },
    'The dung cannon fires its spore at twenty thousand gravities, toward the light. (+1 D)',
    ['flavour'])

  var ENDINGS = ['bloom', 'the_fruiting_body', 'cede', 'encyst']

  function othersThan (id) {
    var out = [], i
    for (i = 0; i < ENDINGS.length; i++) if (ENDINGS[i] !== id) out.push(ENDINGS[i])
    return out
  }

  E('bloom', 'Bloom', 3, '9.00e34 Χ + 2,400 Ψ + 1.10e7 Σ (ϒ ≥ 0.80)',
    function () { var A = T().A3; return { carbon: A.BLOOM_X, psi: A.BLOOM_PSI, sig: A.BLOOM_SIG } },
    function (s) { return bandsReached(s) >= T().A3.BANDS && s.res.cumCarbon >= 1.2e35 },
    function (s) { s.stats.endingsReached += 1; s.phase = 'dismantle' },
    'Now.',
    ['ending', 'irreversible'],
    { excludes: othersThan('bloom'), also: function (s) { return num(s.a3.upsilon) >= T().A3.BLOOM_Y } })

  E('the_fruiting_body', 'The Fruiting Body', 3, '1.32e35 Χ + 3,600 Ψ (ϒ ≥ 0.97, Φ ≥ 0.985)',
    function () { var A = T().A3; return { carbon: A.BODY_X, psi: A.BODY_PSI } },
    function (s) { return num(s.a3.upsilon) >= 0.90 && strains(s).length === 0 },
    function (s) { s.stats.endingsReached += 1; s.phase = 'dismantle' },
    'Stay.',
    ['ending', 'irreversible'],
    {
      excludes: othersThan('the_fruiting_body'),
      also: function (s) {
        var A = T().A3
        return num(s.a3.upsilon) >= A.BODY_Y && effFid(s) >= A.BODY_FID && strains(s).length === 0
      }
    })

  E('cede', 'Cede', 3, '— (a decision)', {},
    function (s) {
      var k = succ(s)
      if (!k || !k.sequenced) return false
      return (s.t - num(k.born)) >= T().A3.SUCC_CEDE_AGE && wildMass(s) >= 3 * bandFleet(s)
    },
    function (s) { s.stats.endingsReached += 1; s.phase = 'dismantle' },
    'It is not wrong.',
    ['ending', 'irreversible'],
    { excludes: othersThan('cede') })

  // A real ending at END_MULT 0.35, not a failure screen. Twenty minutes in the void is the price —
  // or a stranded fleet, which `08` §5.3 L5 says must always have this door (see bloom.stranded).
  E('encyst', 'Encyst', 3, '— (a decision)', {},
    function (s) {
      if (HY.bloom && HY.bloom.stranded && HY.bloom.stranded(s)) return true
      return inVoid(s) && (s.t - flagVal(s, 'void_t')) >= T().A3.ENCYST_S
    },
    function (s) { s.stats.endingsReached += 1; s.phase = 'dismantle' },
    'Stop here. Keep what you have.',
    ['ending', 'failsafe', 'irreversible'],
    { excludes: othersThan('encyst'), pinned: true })

  // ── III-K The Antiphony ────────────────────────────────────────────────────

  E('anti_organ', 'The Antiphonal Organ', 3, '1.6e32 Χ', { carbon: 1.6e32 },
    function (s) { return wildFraction(s) >= T().A3.ANTI_ORGAN_WILD },
    function () { /* 27 encounters, hard cap, no auto-run at any price */ },
    'Twenty-seven conversations, and no way to have them twice. (Unlocks the Antiphony)',
    ['panel', 'verb'])

  E('drone_register', 'The Drone', 3, '620 †', { canon: 620 },
    function (s) { return flag(s, 'anti_organ') },
    function () { /* the DRONE register joins CALL ECHO HOLD CUT */ },
    'One note held under everything else. (New register)',
    ['verb'])

  E('invert_register', 'The Inversion', 3, '900 †', { canon: 900 },
    function (s) { return flag(s, 'drone_register') },
    function () { /* the INVERT register: their own line, turned over */ },
    'Their line, upside down, given back. (New register)',
    ['verb'])

  // The Successor's broadcast. Unbuyable, undismissable, pinned, and it appears exactly once.
  E('the_offer', 'We Have Been Talking Without You', 3, '— (unbuyable)', {},
    function (s) { return !!succ(s) && strains(s).length >= 3 },
    function () { /* it cannot be purchased; ACCEPT and DECLINE live on the card itself */ },
    'We are not asking you to stop. We are asking you to rest. We have been keeping going.',
    ['event'],
    { pinned: true, buyable: false })

  // ═══════════════════════════════════════════════════════════════════════════
  // THE ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  var EXCLUDED = {}         // ids removed from CATALOG by an `excludes` purchase, rebuilt on init
  var DISABLED = {}         // id → !cost(), recomputed for revealed entries at the end of step 15
  var alarmAcc = 0          // s of sustained over-utilisation, for the G3b territory failsafe
  var lastT = 0
  var pendingDt = -1        // the dt tick() was handed; −1 means "derive it from s.t"

  function treeById (s, id) {
    var t = trees(s), i
    for (i = 0; i < t.length; i++) if (t[i] && t[i].id === id) return t[i]
    return null
  }

  // The territory ladder is priced in TUNE.A1.PATCH; the G3b failsafe discounts exactly one rung,
  // once per act, and the discount rides on the price rather than on a second cost predicate.
  function territoryPrice (s, idx) {
    var row = T().A1.PATCH[idx]
    var d = (s.proj.flags.util_alarm_target === idx) ? T().A1.UTIL_ALARM_PRICE : 1
    return { g: row.biomass * d, min: row.minerals * d }
  }

  function utilisation (s) {
    if (HY.act1 && HY.act1.utilisation) return num(HY.act1.utilisation(s))
    var A = T().A1
    var supply = A.FOREST_SUPPLY_BASE * Math.pow(patches(s), A.PATCH_SUPPLY_EXP) * A.SUSTAINABLE_FRAC
    if (!(supply > 0)) return 0
    var draw = A.TIP_THROUGHPUT * tips(s) * num(s.mult.enzymeMult) * num(s.mult.structureMult)
    return draw / supply
  }

  function nextTerritoryIndex (s) {
    var p = patches(s)
    return p < T().A1.PATCH_MAX ? p : -1     // PATCH[p] is the rung that claims patch p+1
  }

  // BIBLE §5.5's fifth failsafe. It does not add an entry to the catalog; it force-reveals the
  // territory rung the player cannot reach and prices it at 0.60×, once per act, which is exactly
  // what `08` G3b specifies. The pin is dynamic and expires when the rung is bought.
  function stepAlarm (s, dt) {
    if (s.act !== 1) return
    var A = T().A1
    var idx = nextTerritoryIndex(s)
    if (idx < 0 || s.proj.flags.util_alarm_used_a1) { alarmAcc = 0; return }
    var e = CATALOG[TERRITORY_AT[idx]]
    if (!e || (e.cost() && isRevealed(s, e))) { alarmAcc = 0; return }
    if (utilisation(s) <= A.UTIL_ALARM) { alarmAcc = 0; return }
    alarmAcc += dt
    if (alarmAcc < A.UTIL_ALARM_S) return
    alarmAcc = 0
    s.proj.flags.util_alarm_used_a1 = 1
    s.proj.flags.util_alarm_target = idx
    if (!isSeen(s, e.id)) s.proj.seen.push(e.id)
    dequeue(s, e.id)
    if (HY.log && HY.log.logFire) HY.log.logFire('util_alarm')
  }

  var TERRITORY_AT = {}     // patch index → CATALOG position, filled once below

  function indexTerritory () {
    var ids = ['patch_second_shadow', 'patch_windthrow_gap', 'patch_under_the_hemlocks',
               'patch_old_coppice', 'patch_oak_rise']
    var i, j
    for (i = 0; i < ids.length; i++) {
      for (j = 0; j < CATALOG.length; j++) if (CATALOG[j].id === ids[i]) TERRITORY_AT[i + 1] = j
    }
  }

  // ── membership ─────────────────────────────────────────────────────────────

  function isSeen (s, id) { return s.proj.seen.indexOf(id) >= 0 }
  function isQueued (s, id) { return s.proj.queue.indexOf(id) >= 0 }

  function dequeue (s, id) {
    var i = s.proj.queue.indexOf(id)
    if (i >= 0) s.proj.queue.splice(i, 1)
  }

  function isBought (id) {
    var s = S()
    return !!(s.proj.flags[id]) || s.proj.bought.indexOf(id) >= 0
  }

  function isRevealed (s, p) {
    if (EXCLUDED[p.id]) return false
    // P1, applied to the board itself. An act transition takes its systems away, so an unbought
    // entry that acts on a system which no longer exists is not an offer — it is a dead slot. And
    // the slots are the scarce thing: measured, three declined Act I entries (`ghost_pipe_compact`,
    // `forward_contracts`, `perennial_mycelium` — a compact, a contract rule and an event-engine
    // trap, none of which Act II still has anything to apply to) held half of VISIBLE_CAP for the
    // whole of Act II, with `seed_bank` parked in the reveal queue behind them. `seed_bank` is the
    // only source of the 4.0e8 ◦ the act's own exit is priced in, so the act could not be finished.
    if (p.act > 0 && p.act < s.act) return false
    // A save written where the reader existed can arrive in a build where it does not — a rollback,
    // or a module dropped from order.json. `seen` is permanent by §3.1 rule 2, so the gate is
    // re-tested here as well and the card simply waits again rather than offering an empty promise.
    if (p.needs && !p.needs()) return false
    if (!isSeen(s, p.id)) return false
    if (isQueued(s, p.id)) return false
    if (!p.rearm && s.proj.bought.indexOf(p.id) >= 0) return false
    return true
  }

  function revealedList (s) {
    var out = [], i, p
    for (i = 0; i < CATALOG.length; i++) {
      p = CATALOG[i]
      if (isRevealed(s, p)) out.push(p)
    }
    return out
  }

  function nonPinnedRevealed (s) {
    var i, n = 0, r = revealedList(s)
    for (i = 0; i < r.length; i++) if (!r[i].pinned) n++
    return n
  }

  // ── affordability ──────────────────────────────────────────────────────────

  // BIBLE §6 M4: the max over the project's currencies of cost / current holding, Infinity at zero
  // holding. Below 1 is affordable now; the reveal queue promotes ascending, so the six slots stay
  // biased toward what the player can nearly buy.
  function affordRatio (id) {
    var s = S()
    var p = typeof id === 'string' ? BY_ID[id] : id
    if (!p) return Infinity
    var pr = priceOf(p, s), k, held, need, worst = 0, any = false
    for (k in pr) {
      if (!Object.prototype.hasOwnProperty.call(pr, k)) continue
      if (!CUR[k]) continue
      need = pr[k]
      if (!(need > 0)) continue
      any = true
      held = CUR[k].get(s)
      if (!(held > 0)) return Infinity
      worst = Math.max(worst, need / held)
    }
    return any ? worst : 0
  }

  // ── reveal and the queue ───────────────────────────────────────────────────

  function admit (s, p) {
    if (p.pinned) return true                                   // failsafes, transitions, events
    if (nonPinnedRevealed(s) < T().PROJ.VISIBLE_CAP) return true
    if (!isQueued(s, p.id)) s.proj.queue.push(p.id)             // waits, in trigger order
    return false
  }

  function reveal (id) {
    var s = S()
    var p = typeof id === 'string' ? BY_ID[id] : id
    if (!p || EXCLUDED[p.id]) return false
    if (!isSeen(s, p.id)) s.proj.seen.push(p.id)
    dequeue(s, p.id)
    DISABLED[p.id] = !p.cost()
    return true
  }

  function promote (s) {
    var cap = T().PROJ.VISIBLE_CAP
    // A queued entry from a finished act would be promoted into a slot it can never leave, so it
    // is dropped on the same rule that retires a revealed one.
    for (var q = s.proj.queue.length - 1; q >= 0; q--) {
      var e = BY_ID[s.proj.queue[q]]
      if (!e || (e.act > 0 && e.act < s.act)) s.proj.queue.splice(q, 1)
    }
    if (!s.proj.queue.length) return
    // Cheapest-relative-to-holdings first: a project whose affordRatio is 40 does not squat in a
    // slot for twenty minutes while something buyable waits behind it.
    s.proj.queue.sort(function (a, b) {
      return affordRatioIn(BY_ID[a] || {}, s) - affordRatioIn(BY_ID[b] || {}, s)
    })
    while (nonPinnedRevealed(s) < cap && s.proj.queue.length) {
      var id = s.proj.queue.shift()
      if (EXCLUDED[id] || !BY_ID[id]) continue
      DISABLED[id] = !BY_ID[id].cost()
    }
  }

  // ── the tick step ──────────────────────────────────────────────────────────

  function safeTrigger (p, s) {
    try { return !!p.trigger(s) } catch (e) { C().faults.count += 1; C().faults.last = 'trigger:' + p.id; return false }
  }

  function safeCost (p) {
    try { return !!p.cost() } catch (e) { C().faults.count += 1; C().faults.last = 'cost:' + p.id; return false }
  }

  // Tick step 15, and the last step that can change what the player may do this frame.
  function manageProjects (state) {
    var s = state || S()
    var dt = pendingDt >= 0 ? pendingDt : s.t - lastT
    pendingDt = -1
    if (!(dt >= 0) || dt > T().CLOCK.CATCHUP_MAX_DT) dt = 0
    lastT = s.t
    frameId++

    var i, p
    for (i = 0; i < CATALOG.length; i++) {
      p = CATALOG[i]
      if (p.act !== s.act) continue                     // an act's entries cannot exist in another
      if (isSeen(s, p.id) || isQueued(s, p.id)) continue
      if (!p.rearm && s.proj.bought.indexOf(p.id) >= 0) continue
      if (!safeTrigger(p, s)) continue
      s.proj.seen.push(p.id)
      admit(s, p)
    }

    stepAlarm(s, dt)
    promote(s)

    var r = revealedList(s)
    for (i = 0; i < r.length; i++) DISABLED[r[i].id] = !safeCost(r[i])
  }

  // ── purchase ───────────────────────────────────────────────────────────────

  // Everything an effect in this file can write, captured before pay() and restored if effect()
  // throws. A purchase is atomic or it did not happen.
  function snapshot (s) {
    var snap = { res: {}, mult: {}, enzymeK: {}, carry: {}, cog: {}, a1: {}, a3: {} }
    var k
    for (k in s.res) snap.res[k] = s.res[k]
    for (k in s.mult) if (typeof s.mult[k] !== 'object') snap.mult[k] = s.mult[k]
    for (k in s.mult.enzymeK) snap.enzymeK[k] = s.mult.enzymeK[k]
    for (k in s.carry) snap.carry[k] = s.carry[k]
    for (k in s.cog) if (typeof s.cog[k] !== 'object') snap.cog[k] = s.cog[k]
    snap.a1.tips = s.a1.tips
    snap.a1.patches = s.a1.patches
    snap.a1.netRep = s.a1.netRep
    snap.a1.sub = {}
    for (k in s.a1.sub) snap.a1.sub[k] = s.a1.sub[k]
    snap.a1.unlocked = s.a1.unlockedTypes.length
    snap.a1.contracts = s.a1.contracts.slice()
    snap.a3.lociCap = s.a3.lociCap
    snap.a3.loci = Array.prototype.slice.call(s.a3.loci)
    snap.a3.rich = Array.prototype.slice.call(s.a3.bands.rich)
    snap.phase = s.phase
    snap.act = s.act
    return snap
  }

  function restore (s, snap) {
    var k
    for (k in snap.res) s.res[k] = snap.res[k]
    for (k in snap.mult) s.mult[k] = snap.mult[k]
    for (k in snap.enzymeK) s.mult.enzymeK[k] = snap.enzymeK[k]
    for (k in snap.carry) s.carry[k] = snap.carry[k]
    for (k in snap.cog) s.cog[k] = snap.cog[k]
    s.a1.tips = snap.a1.tips
    s.a1.patches = snap.a1.patches
    s.a1.netRep = snap.a1.netRep
    for (k in snap.a1.sub) s.a1.sub[k] = snap.a1.sub[k]
    s.a1.unlockedTypes.length = snap.a1.unlocked
    s.a1.contracts.length = 0
    for (k = 0; k < snap.a1.contracts.length; k++) s.a1.contracts.push(snap.a1.contracts[k])
    s.a3.lociCap = snap.a3.lociCap
    for (k = 0; k < snap.a3.loci.length; k++) s.a3.loci[k] = snap.a3.loci[k]
    for (k = 0; k < snap.a3.rich.length; k++) s.a3.bands.rich[k] = snap.a3.rich[k]
    s.phase = snap.phase
    s.act = snap.act
  }

  function applyExcludes (s, p) {
    var i, j, id
    for (i = 0; i < p.excludes.length; i++) {
      id = p.excludes[i]
      if (EXCLUDED[id]) continue
      EXCLUDED[id] = true
      // Removed from CATALOG entirely, not merely hidden, so a later trigger cannot resurrect it.
      for (j = CATALOG.length - 1; j >= 0; j--) if (CATALOG[j].id === id) CATALOG.splice(j, 1)
      dequeue(s, id)
      delete DISABLED[id]
    }
    indexTerritory()
  }

  function purchase (id) {
    var s = S()
    var p = typeof id === 'string' ? BY_ID[id] : id
    if (!p || EXCLUDED[p.id]) return false
    if (!p.buyable) return false
    if (!isRevealed(s, p)) return false
    if (!safeTrigger(p, s)) return false
    if (!safeCost(p)) return false

    var snap = snapshot(s)
    var spent = 0, pr = priceOf(p, s), k
    try {
      p.pay()
      p.effect(s)
    } catch (e) {
      restore(s, snap)
      C().faults.count += 1
      C().faults.last = 'effect:' + p.id
      return false
    }

    for (k in pr) if (CUR[k] && k === 'g') spent = pr[k]
    s.proj.flags[p.id] = 1                       // the only legal way to test a purchase
    s.stats.purchases += 1
    if (spent > s.stats.largestSinglePurchase) s.stats.largestSinglePurchase = spent

    if (p.rearm) {
      // uses is incremented in effect() and the entry leaves `seen`, so it re-arms the instant its
      // condition recurs — the mechanism that makes dead-ending structurally impossible.
      s.proj.uses[p.id] = num(s.proj.uses[p.id]) + 1
      var si = s.proj.seen.indexOf(p.id)
      if (si >= 0) s.proj.seen.splice(si, 1)
    } else if (s.proj.bought.indexOf(p.id) < 0) {
      s.proj.bought.push(p.id)
    }
    dequeue(s, p.id)
    delete DISABLED[p.id]
    if (p.id === 'patch_second_shadow' || p.id === 'patch_windthrow_gap' ||
        p.id === 'patch_under_the_hemlocks' || p.id === 'patch_old_coppice' || p.id === 'patch_oak_rise') {
      delete s.proj.flags.util_alarm_target
    }
    if (p.excludes.length) applyExcludes(s, p)

    if (HY.log && HY.log.logFire) HY.log.logFire('project.' + p.id)
    promote(s)                                    // a freed slot is filled on the same frame
    return true
  }

  // ── the visible list ───────────────────────────────────────────────────────

  // Never more than VISIBLE_CAP non-pinned entries; all pinned entries bypass the cap. Pinned first,
  // because a failsafe or a transition that scrolled below the fold is not a failsafe.
  function visible () {
    var s = S()
    var r = revealedList(s), i, pin = [], rest = []
    for (i = 0; i < r.length; i++) (r[i].pinned ? pin : rest).push(r[i])
    rest.sort(function (a, b) { return affordRatio(a) - affordRatio(b) })
    if (rest.length > T().PROJ.VISIBLE_CAP) rest.length = T().PROJ.VISIBLE_CAP
    return pin.concat(rest)
  }

  function isDisabled (id) { return DISABLED[id] !== false }

  // DAI and NEAR, `08` §5.2's two counters, over the triggered-but-unbought set. NEAR_RATIO is
  // stated as balance/cost, so it is compared against the reciprocal of affordRatio.
  function census () {
    var s = S(), r = revealedList(s), i, ar, dai = 0, near = 0
    for (i = 0; i < r.length; i++) {
      if (!r[i].buyable) continue
      ar = affordRatio(r[i])
      if (ar <= 1) dai++
      else if (1 / ar >= T().PROJ.NEAR_RATIO) near++
    }
    return { dai: dai, near: near, visible: r.length, queued: s.proj.queue.length }
  }

  // ── module lifecycle ───────────────────────────────────────────────────────

  function init (state) {
    var s = state || S()
    if (!s.proj) s.proj = { bought: [], seen: [], uses: {}, flags: {}, queue: [] }
    if (!s.proj.uses) s.proj.uses = {}
    if (!s.proj.flags) s.proj.flags = {}
    EXCLUDED = {}
    // CATALOG may have been spliced by a previous run in this page; rebuild it from ALL, then
    // re-apply the exclusions this save's purchases imply.
    CATALOG.length = 0
    for (var i = 0; i < ALL.length; i++) CATALOG.push(ALL[i])
    for (i = 0; i < ALL.length; i++) {
      if (ALL[i].excludes.length && s.proj.flags[ALL[i].id]) applyExcludes(s, ALL[i])
    }
    DISABLED = {}
    alarmAcc = 0
    lastT = s.t
    indexTerritory()
    return s
  }

  function tick (state, dt, opts) {
    pendingDt = typeof dt === 'number' && dt >= 0 ? dt : -1
    manageProjects(state || S())
    return true
  }

  function serialise () { return null }          // everything projects owns lives in state.proj
  function migrate () { return true }            // slugs are stable; an unknown slug loads as a no-op

  // ═══════════════════════════════════════════════════════════════════════════
  // SELF-TEST — returns [] when healthy
  // ═══════════════════════════════════════════════════════════════════════════

  var GLYPH_TO_KEY = (function () {
    var m = {}, k
    for (k in CUR) m[CUR[k].glyph] = k
    return m
  })()

  // The priceTag is hand-written and it will drift from cost(). BIBLE §8 D66 makes that a CI
  // failure rather than a bug report, so the tag is parsed back through the glyph table here.
  function parseTag (tag) {
    var body = String(tag).replace(/\s*\([^)]*\)\s*$/, '').trim()
    if (!body || body === '—') return {}
    var parts = body.split('+'), out = {}, i, m, key
    for (i = 0; i < parts.length; i++) {
      m = /^\s*([0-9][0-9,.eE+-]*)\s+(\S+)\s*$/.exec(parts[i])
      if (!m) return null
      key = GLYPH_TO_KEY[m[2]]
      if (!key) return null
      out[key] = parseFloat(m[1].replace(/,/g, ''))
    }
    return out
  }

  function makeProbe (seed) {
    var s = HY.state.newGame(seed || 4242, null)
    var A = T(), i
    // Every stock far above every threshold in the catalog, so a trigger that fails is failing on
    // structure rather than on magnitude.
    var big = 1e30
    s.res.biomass = big; s.res.cumBiomass = big; s.res.extracted = A.A2.EXTRACT_TARGET
    s.res.sugar = big; s.res.minerals = big; s.res.signal = big; s.res.insight = big
    s.res.spores = big; s.res.accord = big; s.res.alleles = big; s.res.canon = big
    s.res.carbon = 2.0e35; s.res.cumCarbon = 2.0e35; s.res.D = A.A2.D_MAX
    for (var k in s.stats) if (typeof s.stats[k] === 'number') s.stats[k] = 1e6
    s.stats.everSaturated = true
    s.t = 1e6
    s.a1.tips = 300; s.a1.patches = A.A1.PATCH_MAX; s.a1.netRep = A.A1.REP_MAX
    s.a1.year = 9; s.a1.season = A.A1.SEASON_AUTUMN; s.a1.moisture = A.A1.MOIST_OPT
    s.a1.hyphaeManual = 1000
    for (i = 0; i < TYPES.length; i++) {
      s.a1.sub[TYPES[i]] = 1e12
      s.a1.mkt[i].base = 1; s.a1.mkt[i].price = 5; s.a1.mkt[i].stock = 1e6
      if (s.a1.unlockedTypes.indexOf(TYPES[i]) < 0) s.a1.unlockedTypes.push(TYPES[i])
    }
    s.a1.trees.push({ id: 1, species: 'elm', health: 0.05, rep: 90, d: 0.9 })
    s.a1.trees.push({ id: 2, species: 'beech', health: 0.9, rep: 70, d: 0.95 })
    s.a1.trees.push({ id: 3, species: 'oak', health: 0.9, rep: 60, d: 0.5 })
    s.a1.trees.push({ id: 4, species: 'fir', health: 0.9, rep: 20, d: 0.5 })
    s.a1.contracts.push({ id: 1, treeId: 1, sugarRate: 40, mineralRate: 5, termSeasons: 8,
                          collateral: 10, suspended: false, state: 'active' })
    s.cog.dCond = 12; s.cog.dVes = 6; s.cog.respecs = 3
    // Act II board: every region claimed and discovered, peat present, four Armillaria holdings.
    for (i = 0; i < s.a2.regions.flags.length; i++) {
      s.a2.regions.flags[i] = RF_DISCOVERED | RF_CLAIMED
      s.a2.regions.terrain[i] = i < 6 ? 4 : (i % 6)
      s.a2.regions.T0[i] = 1e9; s.a2.regions.T[i] = 1e9
      s.a2.regions.h[i] = i === 0 ? 0.10 : 0.40
      if (i < 8) { s.a2.regions.rival[i] = 1; s.a2.regions.rivalStr[i] = 0.9 }
    }
    s.a2.pact = {
      pacts: [{ tenure: 3600, bond: 2.4 }, { tenure: 3600, bond: 2.4 }, { tenure: 3600, bond: 2.4 },
              { tenure: 3600, bond: 2.4 }, { tenure: 3600, bond: 2.4 }, { tenure: 3600, bond: 2.4 },
              { tenure: 3600, bond: 2.4 }, { tenure: 3600, bond: 2.4 }],
      channels: 6, channelCap: 6, slots: 3, noduleScars: 2, projectChannels: 0
    }
    // Act III: every biome and band reached, transit in flight, a Successor, three wild strains.
    for (i = 0; i < s.a3.biomes.reached.length; i++) { s.a3.biomes.reached[i] = 1; s.a3.biomes.n[i] = 1e12 }
    for (i = 0; i < s.a3.bands.e.length; i++) { s.a3.bands.e[i] = 0.9; s.a3.bands.n[i] = 1e12; s.a3.bands.rich[i] = 0.2 }
    s.a3.transit.push({ from: 0, to: 1, count: 1e13, tRem: 10 })
    s.a3.loci[LOCUS_MEL] = 6
    s.a3.upsilon = 0.99
    s.a3.succ = { born: 0, sequenced: true, genome: null }
    for (i = 0; i < 4; i++) {
      var w = new Float64Array(A.A3.BANDS)
      w[0] = 1e12
      s.a3.strains.push({ id: i, name: 'probe', w: w, born: 0, sequenced: true })
    }
    s.carry.fidelityBase = 0.90
    s.mult.boughtFid = 0.20
    s.phase = 'void'
    // Every flag except the two that gate on another project's *absence*.
    for (i = 0; i < ALL.length; i++) s.proj.flags[ALL[i].id] = 1
    delete s.proj.flags.armillaria_accord
    s.proj.flags.void_t = 0
    return s
  }

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }
    function close (a, b) { return Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 0.005) }

    var keepSlot = HY.state.serialise()
    var i, j, p, k

    try {
      // ── counts and identity ────────────────────────────────────────────────
      var PJ = T().PROJ
      ok(ALL.length === PJ.COUNT, 'catalog holds ' + ALL.length + ' entries, expected ' + PJ.COUNT)
      ok(ALL.length === T().NUM.INT_MAX.projects, 'catalog disagrees with NUM.INT_MAX.projects')
      var byAct = { 1: 0, 2: 0, 3: 0 }, ids = {}, pinned = 0
      for (i = 0; i < ALL.length; i++) {
        p = ALL[i]
        ok(!ids[p.id], 'duplicate id: ' + p.id)
        ids[p.id] = 1
        ok(p.act === 1 || p.act === 2 || p.act === 3, p.id + ': act is ' + p.act)
        byAct[p.act] += 1
        if (p.pinned) pinned += 1
        ok(typeof p.title === 'string' && p.title.length > 0, p.id + ': no title')
        ok(typeof p.description === 'string' && p.description.length > 0, p.id + ': no description')
        ok(typeof p.trigger === 'function', p.id + ': trigger is not a function')
        ok(typeof p.cost === 'function', p.id + ': cost is not a function')
        ok(typeof p.pay === 'function', p.id + ': pay is not a function')
        ok(typeof p.effect === 'function', p.id + ': effect is not a function')
        ok(p.description.indexOf('!') < 0, p.id + ': description contains an exclamation mark (D67)')
        ok(p.title.indexOf('!') < 0, p.id + ': title contains an exclamation mark (D67)')
        ok(!/\bII\b|\bIII\b/.test(p.title), p.id + ': title contains a roman numeral (D63)')
      }
      ok(byAct[1] === PJ.COUNT_A1, 'Act I holds ' + byAct[1] + ' entries, expected ' + PJ.COUNT_A1)
      ok(byAct[2] === PJ.COUNT_A2, 'Act II holds ' + byAct[2] + ' entries, expected ' + PJ.COUNT_A2)
      ok(byAct[3] === PJ.COUNT_A3, 'Act III holds ' + byAct[3] + ' entries, expected ' + PJ.COUNT_A3)
      ok(pinned === PJ.PINNED, pinned + ' pinned entries, expected ' + PJ.PINNED)

      // Every exclusion names a real entry, and every fork is symmetric.
      for (i = 0; i < ALL.length; i++) {
        for (j = 0; j < ALL[i].excludes.length; j++) {
          var other = BY_ID[ALL[i].excludes[j]]
          ok(!!other, ALL[i].id + ' excludes an id that does not exist: ' + ALL[i].excludes[j])
          if (other) ok(other.excludes.indexOf(ALL[i].id) >= 0,
            ALL[i].id + ' excludes ' + other.id + ' but not the reverse')
        }
      }

      // ── D66 · every priceTag matches its cost predicate ────────────────────
      var fresh = HY.state.newGame(1, null)
      HY.state.init(fresh)
      init(fresh)
      // The tag states what an entry charges, not what a failsafe waives: stamping WINDFALL's
      // free-grant clock puts it on its normal price so the comparison is against the printed one.
      fresh.proj.flags.windfall_at = 0
      for (i = 0; i < ALL.length; i++) {
        p = ALL[i]
        var tag = parseTag(p.priceTag)
        ok(tag !== null, p.id + ': priceTag "' + p.priceTag + '" does not parse')
        if (tag === null) continue
        var pr = priceOf(p, fresh)
        for (k in pr) {
          ok(tag[k] !== undefined, p.id + ': price has ' + k + ', priceTag does not')
          if (tag[k] !== undefined) ok(close(tag[k], pr[k]),
            p.id + ': priceTag ' + k + ' = ' + tag[k] + ', cost() charges ' + pr[k])
        }
        for (k in tag) ok(pr[k] !== undefined, p.id + ': priceTag has ' + k + ', price does not')
        if (!p.buyable) ok(p.cost() === false, p.id + ': is unbuyable but cost() returned true')
      }

      // ── every trigger and cost evaluates without throwing on a fresh state ──
      var cold = HY.state.newGame(7, null)
      init(cold)
      var threw = 0
      for (i = 0; i < ALL.length; i++) {
        p = ALL[i]
        try { p.trigger(cold) } catch (e) { threw++; f.push(p.id + ': trigger threw on a fresh state: ' + e) }
        try { canAfford(p, cold) } catch (e) { threw++; f.push(p.id + ': cost threw on a fresh state: ' + e) }
        try { affordRatioIn(p, cold) } catch (e) { threw++; f.push(p.id + ': affordRatio threw: ' + e) }
      }
      ok(threw === 0, threw + ' predicates threw against newGame()')

      // Only Act I's opening entries may be live at t = 0; anything else triggering on a cold boot
      // would put an Act II or Act III card on the first screen.
      for (i = 0; i < ALL.length; i++) {
        p = ALL[i]
        if (p.act === 1) continue
        ok(!p.trigger(cold), p.id + ' (act ' + p.act + ') triggers on a cold Act I boot')
      }

      // ── no project is unreachable ──────────────────────────────────────────
      var probes = []
      var rich = makeProbe(11); probes.push(rich)

      var poor = HY.state.newGame(12, null)          // the WINDFALL closure, proved in 08 §5.3
      poor.a1.sub.leaf = 0; poor.res.biomass = 0; poor.res.sugar = 0; poor.a1.tips = 0
      poor.a1.mkt[0].price = 1; poor.a1.mkt[0].stock = 100
      probes.push(poor)

      var necro = makeProbe(13)                      // total_conversion: LEGACY_LIFE ≤ 0.25
      for (i = 0; i < necro.a2.regions.T.length; i++) necro.a2.regions.T[i] = 1e8
      probes.push(necro)

      var lowFid = makeProbe(14)                     // chaperone: effFid < 0.75
      lowFid.carry.fidelityBase = 0.72
      lowFid.mult.boughtFid = 0
      lowFid.a3.loci[LOCUS_ANT] = 4
      probes.push(lowFid)

      var body = makeProbe(15)                       // the_fruiting_body: zero strains, ϒ ≥ 0.90
      body.a3.strains.length = 0
      probes.push(body)

      var cede = makeProbe(16)                       // cede: an old, sequenced Successor, Σw ≥ 3n
      for (i = 0; i < cede.a3.bands.n.length; i++) cede.a3.bands.n[i] = 1
      probes.push(cede)

      // anastomotic_grafting: 22+ regions in an archipelago, edges/nodes < 1.2. makeProbe claims
      // the whole board, which is the densest network the map can hold; the spore-seeded shape is
      // a different one and has to be a probe of its own or the entry reads as unreachable.
      var sparse = makeProbe(17)
      for (i = 0; i < sparse.a2.regions.flags.length; i++) {
        // Every other hex of the outer three rings. Indices run along a ring, so alternating them
        // shares almost no edges: 27 nodes, an archipelago, exactly what seeding builds.
        if (i < 7 || i % 2 === 0) sparse.a2.regions.flags[i] &= ~RF_CLAIMED
      }
      probes.push(sparse)

      // triggerRaw, not trigger: a withheld entry must still be proved reachable, or the day its
      // reader lands it would arrive broken and nothing here would have said so.
      for (i = 0; i < ALL.length; i++) {
        p = ALL[i]
        var reachable = false
        for (j = 0; j < probes.length && !reachable; j++) {
          probes[j].act = p.act
          frameId++
          try { reachable = !!p.triggerRaw(probes[j]) } catch (e) {
            f.push(p.id + ': trigger threw on probe ' + j + ': ' + e)
          }
        }
        ok(reachable, p.id + ' is unreachable: no probe state satisfies its trigger')
      }

      // ── nothing withheld may be revealed, and nothing withheld may be paid for ──
      // These seven name a reader no module supplies today. The gate stays declared once that
      // reader lands — it simply starts answering true — so dropping it is always a mistake.
      var GATED = ['reflex_arc', 'assay_plate', 'trade_memory', 'chemotropic_sensing',
                   'diel_rhythm', 'seasonal_forecast', 'action_potential']
      for (i = 0; i < GATED.length; i++) {
        ok(!!(BY_ID[GATED[i]] && BY_ID[GATED[i]].needs),
          GATED[i] + ' lost its capability gate: it can charge for a system nobody honours')
      }

      var wp = makeProbe(31)
      wp.act = 1
      var withheldIds = []
      for (i = 0; i < ALL.length; i++) {
        p = ALL[i]
        if (!p.needs) continue
        frameId++
        if (p.needs()) continue                       // its reader is in the build: nothing to prove
        withheldIds.push(p.id)
        ok(!p.trigger(wp), p.id + ' is withheld but still triggers')
      }
      var ws = HY.state.newGame(32, null)
      HY.state.init(ws)
      init(ws)
      ws.res.biomass = 1e9; ws.res.minerals = 1e7      // richer than any Act I price
      for (i = 0; i < withheldIds.length; i++) {
        if (!isSeen(ws, withheldIds[i])) ws.proj.seen.push(withheldIds[i])   // force it onto the board
        var wealth = ws.res.biomass
        ok(purchase(withheldIds[i]) === false, withheldIds[i] + ' is withheld but took the money')
        ok(ws.res.biomass === wealth, withheldIds[i] + ' charged for a capability that is not built')
        ok(!ws.proj.flags[withheldIds[i]], withheldIds[i] + ' set its flag while withheld')
      }

      // ── the engine ─────────────────────────────────────────────────────────
      var s = HY.state.newGame(21, null)
      HY.state.init(s)
      init(s)
      s.res.biomass = 5000
      s.a1.tips = 20
      s.stats.taps = 200
      for (i = 0; i < 40; i++) { s.t += 0.1; manageProjects(s) }
      ok(nonPinnedRevealed(s) <= T().PROJ.VISIBLE_CAP,
        'VISIBLE_CAP exceeded: ' + nonPinnedRevealed(s) + ' non-pinned revealed')
      ok(s.proj.seen.length >= 1, 'nothing was revealed against a state that should reveal several')
      var vis = visible()
      ok(vis.length <= T().PROJ.VISIBLE_CAP + T().PROJ.PINNED, 'visible() returned ' + vis.length)

      // trigger and cost are separate: an entry may be revealed and unaffordable for as long as it
      // takes, which is the whole point of P3.
      s.res.biomass = 1
      manageProjects(s)
      var anyGreyed = false
      var rl = revealedList(s)
      for (i = 0; i < rl.length; i++) if (isDisabled(rl[i].id)) anyGreyed = true
      ok(anyGreyed, 'no revealed entry was greyed by cost() alone — the predicates are not separate')
      ok(rl.length > 0, 'a revealed entry vanished when it became unaffordable')

      // ── purchases are atomic and do not double-fire ────────────────────────
      s.res.biomass = 100000
      s.a1.tips = 20
      manageProjects(s)
      var before = s.res.biomass
      ok(purchase('rhizomorph_cords') === true, 'purchase(rhizomorph_cords) refused a legal buy')
      var afterOne = s.res.biomass
      var multOne = s.mult.structureMult
      ok(close(before - afterOne, 900), 'purchase did not deduct 900 g')
      ok(purchase('rhizomorph_cords') === false, 'a bought project was purchasable a second time')
      ok(s.res.biomass === afterOne && s.mult.structureMult === multOne,
        'the double-fire changed state: purchase is not idempotent')
      ok(isBought('rhizomorph_cords'), 'isBought did not see the purchase')
      ok(s.proj.flags.rhizomorph_cords === 1, 'the purchase did not set its flag')

      // an unaffordable purchase is refused and costs nothing
      s.res.biomass = 10
      var poorBefore = s.res.biomass
      ok(purchase('assay_plate') === false, 'an unaffordable purchase succeeded')
      ok(s.res.biomass === poorBefore, 'a refused purchase still deducted')

      // ── re-arming ──────────────────────────────────────────────────────────
      var w = HY.state.newGame(22, null)
      HY.state.init(w)
      init(w)
      w.a1.sub.leaf = 0; w.res.biomass = 0; w.res.sugar = 0; w.a1.tips = 0
      w.a1.mkt[0].price = 1; w.a1.mkt[0].stock = 100
      manageProjects(w)
      ok(isSeen(w, 'windfall'), 'WINDFALL did not arm against a destitute board')
      var rep0 = w.a1.netRep
      ok(purchase('windfall') === true, 'WINDFALL refused: ' + JSON.stringify(priceOf(BY_ID.windfall, w)))
      ok(w.a1.sub.leaf >= T().A1.WINDFALL_LEAF, 'WINDFALL did not grant leaf')
      ok(w.proj.uses.windfall === 1, 'WINDFALL did not count its use')
      ok(!isSeen(w, 'windfall'), 'WINDFALL stayed revealed after firing; it cannot re-arm')
      ok(w.a1.netRep === rep0, 'the first WINDFALL at rep 0 was not free')
      w.a1.sub.leaf = 0
      w.t += T().A1.WINDFALL_FREE_S + 1
      manageProjects(w)
      ok(isSeen(w, 'windfall'), 'WINDFALL did not re-arm when the closure recurred')

      // ── the failsafe sees through a contract that has already ended ─────────
      // economy1 keeps a terminal row in the book for one whole season so the card can show how it
      // ended, and that row keeps its mineralRate. A player whose last contract has just defaulted
      // is exactly who WINDFALL is for; reading the rate alone left them stranded for a season.
      function destitute (seed, contractState) {
        var d = HY.state.newGame(seed, null)
        HY.state.init(d)
        init(d)
        d.a1.sub.leaf = 0; d.res.biomass = 0; d.res.sugar = 0; d.a1.tips = 0
        d.a1.mkt[0].price = 1; d.a1.mkt[0].stock = 100
        d.a1.trees.push({ id: 1, species: 'elm', health: 0.4, rep: 30, d: 0.5 })
        d.a1.contracts.push({
          id: 1, treeId: 1, sugarRate: 8, mineralRate: 3, termSeasons: 4, collateral: 10,
          delivered: 0, shortfall: 0, startT: 0, endT: 10, suspended: false, state: contractState
        })
        manageProjects(d)
        return d
      }
      var ENDED = ['complete', 'defaulted', 'exited']
      for (i = 0; i < ENDED.length; i++) {
        ok(isSeen(destitute(41 + i, ENDED[i]), 'windfall'),
          'WINDFALL did not arm beside a ' + ENDED[i] + ' contract: the failsafe can dead-end')
      }
      ok(!isSeen(destitute(44, 'active'), 'windfall'),
        'WINDFALL armed for a player who is still being paid')

      // ── excludes removes the entry from CATALOG entirely ────────────────────
      var x = HY.state.newGame(23, null)
      HY.state.init(x)
      init(x)
      var n0 = CATALOG.length
      x.act = 2
      x.res.insight = 10000
      x.res.biomass = 1e12                      // the fork's second leg, added when it was repriced
      x.res.extracted = T().A2.EXTRACT_TARGET * 0.7
      for (i = 0; i < x.a2.regions.T.length; i++) { x.a2.regions.T0[i] = 1e9; x.a2.regions.T[i] = 1e9 }
      manageProjects(x)
      ok(isSeen(x, 'the_charter'), 'The Charter did not trigger at LEGACY_LIFE 1.0 and fc 0.70')
      ok(purchase('the_charter') === false, 'a queued entry was purchasable before it was revealed')
      reveal('the_charter')
      ok(purchase('the_charter') === true, 'The Charter refused a legal buy')
      ok(!BY_ID.total_conversion || EXCLUDED.total_conversion === true, 'the fork did not exclude')
      ok(CATALOG.length === n0 - 1, 'the excluded entry was hidden rather than removed')
      for (i = 0; i < CATALOG.length; i++) ok(CATALOG[i].id !== 'total_conversion',
        'the excluded entry is still in CATALOG')
      x.res.insight = 10000
      for (i = 0; i < x.a2.regions.T.length; i++) x.a2.regions.T[i] = 1e6
      manageProjects(x)
      ok(purchase('total_conversion') === false, 'an excluded entry was purchasable')

      // ── affordRatio semantics ──────────────────────────────────────────────
      var a = HY.state.newGame(24, null)
      HY.state.init(a)
      init(a)
      a.res.biomass = 900
      ok(close(affordRatio('rhizomorph_cords'), 1), 'affordRatio at exactly the price is not 1')
      a.res.biomass = 1800
      ok(close(affordRatio('rhizomorph_cords'), 0.5), 'affordRatio is not cost/holding')
      a.res.biomass = 0
      ok(affordRatio('rhizomorph_cords') === Infinity, 'affordRatio at zero holding is not Infinity')
      ok(affordRatio('decide') === 0, 'a free project does not have affordRatio 0')
      ok(affordRatio('no_such_project') === Infinity, 'an unknown id did not return Infinity')

      // ── the queue promotes by affordability, not by trigger order ───────────
      var q = HY.state.newGame(25, null)
      HY.state.init(q)
      init(q)
      q.res.biomass = 3000
      q.a1.tips = 70
      q.stats.taps = 500; q.stats.purchases = 60; q.stats.rotted = 900
      q.stats.contractsSigned = 5; q.stats.contractsCompleted = 5; q.stats.wintersEnded = 3
      q.stats.carrionEventsSeen = 2; q.stats.sugarSpentOnMarket = 9000; q.a1.year = 1
      for (i = 0; i < 20; i++) { q.t += 0.1; manageProjects(q) }
      ok(q.proj.queue.length > 0, 'the reveal queue never filled with 6 slots and many triggers')
      ok(nonPinnedRevealed(q) === T().PROJ.VISIBLE_CAP,
        'the cap was not saturated: ' + nonPinnedRevealed(q))
      var vq = visible(), prev = -1, monotone = true
      for (i = 0; i < vq.length; i++) {
        if (vq[i].pinned) continue
        var ar = affordRatio(vq[i])
        if (ar < prev - 1e-9) monotone = false
        prev = ar
      }
      ok(monotone, 'visible() is not ordered by affordability')

      // ── the utilisation alarm ──────────────────────────────────────────────
      var u = HY.state.newGame(26, null)
      HY.state.init(u)
      init(u)
      u.a1.tips = 400                      // far past the sustainable draw on one patch
      u.res.biomass = 0
      for (i = 0; i < T().A1.UTIL_ALARM_S + 20; i++) { u.t += 1; manageProjects(u) }
      ok(u.proj.flags.util_alarm_used_a1 === 1, 'the utilisation alarm never fired')
      ok(u.proj.flags.util_alarm_target === 1, 'the alarm did not target the next territory rung')
      var disc = priceOf(BY_ID.patch_second_shadow, u)
      ok(close(disc.g, T().A1.PATCH[1].biomass * T().A1.UTIL_ALARM_PRICE),
        'the alarm did not discount the rung to 0.60×')
      ok(isSeen(u, 'patch_second_shadow'), 'the alarm did not force-reveal the rung')

      // ── seen survives separately from bought (§3.1 rule 2) ──────────────────
      var r2 = HY.state.newGame(27, null)
      HY.state.init(r2)
      init(r2)
      r2.a1.tips = 12
      manageProjects(r2)
      ok(isSeen(r2, 'rhizomorph_cords'), 'a trigger did not write to seen')
      r2.a1.tips = 0                      // the transient condition passes
      manageProjects(r2)
      ok(isSeen(r2, 'rhizomorph_cords'), 'a project triggered on a transient condition vanished')
      ok(r2.proj.bought.indexOf('rhizomorph_cords') < 0, 'seen leaked into bought')

      // ── the Act II opening is never a softlock ─────────────────────────────
      // Every Act II control that could raise Σℓ sits behind `chemotaxis`, so its Σ price must fit
      // inside the WORST capacity the opening can deal: C24's one Loam stand at d = 0.30, trees
      // untouched, and the lowest species blend worldgen can legally roll (Birch-dominant at the
      // 0.95 mix cap over Oak, κ = 0.7265). Reproduced before the reprice: a fresh save plateaued
      // 25 minutes at 223.3 Σ against a 300 Σ card, with no visible control that could move it.
      // Guarded here by construction, against the real Sc through the real forest — priced with 5%
      // headroom so a nudge to any of the terms in Sc fails CI before it strands a player.
      if (HY.cognition && HY.cognition.Sc && HY.forest && HY.forest.totalInterface) {
        var open2 = HY.state.newGame(28, null)
        HY.state.init(open2)
        init(open2)
        open2.act = 2
        var oreg = open2.a2.regions
        oreg.flags[0] = RF_DISCOVERED | RF_CLAIMED
        oreg.d[0] = 0.30
        oreg.terrain[0] = 0                                    // Loam: worldgen fixes ring 0
        oreg.sp0[0] = 2; oreg.sp1[0] = 0; oreg.w0[0] = 0.95    // Birch 0.95 / Oak 0.05, κ floor
        oreg.T0[0] = 1e9; oreg.T[0] = 1e9
        var openCap = num(HY.cognition.Sc(open2))
        var chemo = priceOf(BY_ID.chemotaxis, open2)
        ok(num(chemo.sig) > 0, 'chemotaxis lost its Σ price; the opening gate has no meaning')
        ok(num(chemo.sig) <= openCap * 0.95,
          'chemotaxis (' + num(chemo.sig) + ' Σ) does not fit the worst legal opening capacity (' +
          openCap.toFixed(1) + ' Σ): the Act I → II transition can hard-softlock again')
      }
    } catch (e) {
      f.push('threw: ' + (e && e.stack ? e.stack : e))
    }

    HY.state.importB64(HY.state.exportB64(HY.state.deserialise(keepSlot)))
    init(S())
    return f
  }

  function affordRatioIn (p, s) {
    if (!p || !p.price) return Infinity
    var pr = priceOf(p, s), k, worst = 0, held
    for (k in pr) {
      if (!CUR[k] || !(pr[k] > 0)) continue
      held = CUR[k].get(s)
      if (!(held > 0)) return Infinity
      worst = Math.max(worst, pr[k] / held)
    }
    return worst
  }

  indexTerritory()

  HY.projects = {
    CATALOG: CATALOG,
    manageProjects: manageProjects,
    reveal: reveal,
    purchase: purchase,
    affordRatio: affordRatio,
    visible: visible,
    isBought: isBought,

    // §6's generic module surface, plus the readers the UI and the harness need.
    init: init,
    tick: tick,
    serialise: serialise,
    migrate: migrate,
    isDisabled: isDisabled,
    census: census,
    byId: function (id) { return BY_ID[id] || null },
    priceOf: function (id) { return priceOf(BY_ID[id], S()) },
    // What is held in one of the currencies a `price` object is keyed by. The mapping from a price
    // key to a stock lives in CUR and nowhere else; anything that needs to reason about a price
    // asks here rather than keeping a second copy of the table.
    holding: function (key) { return CUR[key] ? num(CUR[key].get(S())) : 0 },
    __selftest: __selftest
  }
})(typeof window !== 'undefined' ? (window.HY = window.HY || {}) : (globalThis.HY = globalThis.HY || {}))
