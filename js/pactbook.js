;(function (HY) {
  'use strict'

  // M11 · pactbook.js — THE PACT BOOK (BIBLE §6 M11, spec `05-strategic-subgame.md`).
  //
  // Owns: bandwidth (the integer channel budget), the six guilds, partner generation with hidden
  // traits and hidden exposure vectors, the five-factor covariance model, cost and congestion,
  // strain, the three-stage ladder, six guild-specific breaches, ACCORD, the offer system,
  // brokering, and the P6 liquidation.
  //
  // Does NOT own: the weather (`05` §0.1 is binding — flush.js runs one OU process and this file is
  // a second consumer of it), the map (world.js), the biology (forest.js), Signal or Insight
  // (cognition.js). Every one of those is read lazily and feature-detected, so this module runs in
  // a headless harness with nothing else loaded and runs unchanged in the build.
  //
  // The layer's whole intellectual content is that partners are not independent. Two pacts that
  // look unrelated may both be long moisture, and `F2 CANOPY` declines monotonically across the act
  // because you are eating the forest — so ROOT and CROWN are decaying assets and BROOD and RIVAL
  // are compounding ones, and nothing in the game ever says so. Everything below exists to make
  // that fact discoverable from numbers the player can read on a phone.
  //
  // Numbers that cross a module boundary live in `HY.core.TUNE.A2`. What lives below is this
  // module's own data — the guild table, the eighteen named partners, the sixteen traits and the
  // `05` §14 knob block — one table that no other module reads and that moves as a unit.

  // ───────────────────────────────────────────────────────────────────────────
  // LAZY MODULE ACCESS
  // ───────────────────────────────────────────────────────────────────────────

  function C () { return HY.core }
  function T () { return HY.core.TUNE }
  function A () { return HY.core.TUNE.A2 }
  function S () { return HY.state.state }

  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }
  function flagOn (s, id) { return !!(s && s.proj && s.proj.flags && s.proj.flags[id]) }
  function stat (s, k, n) { if (s && s.stats && typeof s.stats[k] === 'number') s.stats[k] += n }
  function fire (id, tokens) { if (HY.log && HY.log.logFire) HY.log.logFire(id, tokens) }
  function feel (ev, params) { if (HY.feel && HY.feel.feel) HY.feel.feel(ev, params) }
  function notice (kind, tokens) { if (HY.log && HY.log.notice) HY.log.notice(kind, tokens) }

  // ───────────────────────────────────────────────────────────────────────────
  // THE KNOB BLOCK — `05` §14, plus the four constants `08` §4.8 supersedes
  // ───────────────────────────────────────────────────────────────────────────
  //
  // `08` §4.8 replaces `05` §2.5's linear congestion law `1 + 0.012·totalChannels` with a convex
  // law in *pacts held*, `1 + 0.052·k^1.42`, and that law is in TUNE (CONGEST_K, CONGEST_EXP).
  // Substituting it into `05`'s cost formula at the published book shapes of §2.4 roughly doubles
  // the overhead at a full book, which would leave the layer's headline number — "a full book eats
  // 44% of gross biomass" — false by a factor of two. CH_COST_FRAC is therefore refitted from
  // `05`'s 0.019 so that §2.5's published cost-fraction *table* survives the substitution: at the
  // §2.4 shapes (3 ch/2 pacts … 19 ch/9 pacts) 0.0120 reproduces 4.1% · 9.9% · 18.1% · 30.6% ·
  // 49.6% against the published 5.9% · 12.2% · 21.3% · 31.1% · 44.3%. The design target — an
  // interior optimum near seven pacts, and a late book that costs roughly half of gross — holds.

  var PB = {
    V: 1,

    CH_COST_FRAC: 0.0120,       // × gross biomass rate, per channel, before congestion
    CAP_BASE: 2,                // channels before any territory
    CAP_K: 1.45,                // × ln(1 + claimedCount), floored
    ACCORD_CH_MAX: 8,           // hard cap on channels bought with ⟡ (`05` §2.3)
    CH_MAX_PER_PACT: 5,         // no single pact may exceed this (`05` §3.1)

    TAU_BOND: 900,              // s
    BOND_K: 1.60,
    BOND_EXP: 1.20,
    PLASTICITY: 0.55,           // → 0.22 with pact_plasticity

    SHOCK_GAIN: 0.42,
    SHOCK_LO: 0.15, SHOCK_HI: 2.60,   // asymmetric: a partner starving is the interesting case
    BETA_SD: 0.42,
    BETA_CLAMP: 1.20,
    ENV_STRESS_K: 0.80,

    STRAIN_RATE: 0.0020,        // /s
    STRAIN_UNPAID: 0.90,
    STRAIN_ENV: 1.15,
    STRAIN_CROWD: 0.30,         // per pact over tolerance
    STRAIN_NEGLECT: 1.20,       // ch == 0
    STRAIN_BOND: 0.22,          // old partners forgive you
    STRAIN_BASE: 0.16,          // baseline forgiveness; 0.30 with PATIENT
    STRAIN_PATIENT: 0.30,
    STRAIN_YIELD: 0.85,         // yield ×(1 − this·strain)

    WARN_AT: 0.55, NOTICE_AT: 0.80, BREACH_HOLD: 45,
    NOTICE_WINDOW: 90,          // s to comply

    ACC_K: 0.85,
    ACC_OFFLINE: 0.60,          // adversity you did not personally witness pays less
    ACC_BOND_GRANT: 25,         // once, at bond ≥ 0.632
    ACC_BOND_GATE: 0.632,
    ACC_NOTICE_GRANT: 40,       // ×(1 + bond), on a NOTICE resolved without breaching
    ACC_EXACT_GRANT: 15,        // once, at the first exact-β reveal
    HONOUR_K: 60, HONOUR_CH_EXP: 0.50, HONOUR_TERM_EXP: 0.70,
    HONOUR_P6: 2.50,
    SEVER_K: 18,
    STAKE_K: 0.90, STAKE_S: 60, STAKE_TERM: 0.35,

    OFFER_GAP: 210, OFFER_DECLINE_K: 0.25,
    OFFER_LIFE: 600, OFFER_MAX: 2,
    OFFER_EXPIRE_REFUSE: 420, OFFER_DECLINE_REFUSE: 240,
    QUALITY_A: 0.72, QUALITY_G: 0.0028, QUALITY_B: 0.0018,
    TERM_MIN: 1, TERM_MAX: 6,
    MAXTERM_G: 16, MAXTERM_B: 24,
    REP_MAX: 100, REP_START: 50,
    REP_BREACH_GUILD: 12, REP_BREACH_BOOK: 4,
    REP_SEVER_GUILD: 2,
    REP_HONOUR_GUILD: 3, REP_HONOUR_BOOK: 1,

    REVEAL_AT: [180, 600, 1500],   // s of cumulative tenure, × traitThresholdMult
    BAND_TENURE: 240,              // β banded at ±BETA_SD
    EXACT_TENURE: 600,             // β exact

    LAPSE_TENURE: 0.35,            // × tenure when a term lapses unrenewed
    RENEW_WINDOW: 60,              // s to renew before the pact lapses
    CHANNEL_LOCK: 120,             // s the channels stay full of them after a breach

    ROOT_T_REF: 1e11, ROOT_T_EXP: 0.42,
    NODULE_HUMUS: 0.40,
    BROOD_BASE_S: 9.5,             // seconds-of-gross per delivery
    BROOD_INTERVAL: 240,           // s, base mean interval
    BROOD_CH_EXP: 1.35, BROOD_INT_EXP: 0.35, BROOD_INT_BOND: 0.70,
    BROOD_RAID: 0.06,              // fraction of biomass taken on a BROOD breach
    BROOD_GUILD_STRAIN: 0.25,
    GHOST_RIPE: 0.30,
    GHOST_FLOOR_K: 0.06, GHOST_FLOOR_EXP: 0.55,
    GHOST_BREACH_HOLD: 600,        // s the channels stay consumed and pay nothing
    CROWN_T_EXP: 0.30,
    CROWN_FH_EXP: 0.50,
    CROWN_BLIND: 400,              // s of forecastHorizon := 0
    ROOT_SCAR: 0.45, ROOT_SCAR_S: 300,   // liveInterface ×0.55 for 300 s, charged against Signal
    NODULE_SCAR: 0.92,             // permanent × on enzymePower
    RIVAL_ADV: 0.05, RIVAL_ADV_EXP: 1.20, RIVAL_ADV_MIN: 0.55,
    RIVAL_BREACH_STR: 0.30, RIVAL_BREACH_S: 600, RIVAL_BREACH_SPREAD: 0.0006,

    CROSS_A: 0.55, CROSS_B: 0.85,  // yield ×(0.55 + 0.85·(1 − strain_bound))
    CROSS_PREMIUM: 1.30,
    CROSS_BREACH_STRAIN: 0.40,
    CROSS_RATE: 0.30,              // fraction of P4+ offers that are cross-pacts
    KEYSTONE_MULT: 1.08, KEYSTONE_GATE: 0.30,
    TRIANGLE_SHOCK: 1.18, TRIANGLE_RELIEF: 0.06,
    DEMAND_GAP: 480,               // s between inter-partner demands (P5)
    DEMAND_WINDOW: 180,            // s to comply
    DEMAND_STRAIN: 0.35,

    SLOW_DT: 2.0,                  // s, the strategic tick (`05` §19.1 runs at 0.5 Hz)
    MAX_SUB: 64,                   // sub-steps per call, so an offline macro-step stays bounded
    LEDGER_N: 120,                 // samples, 1 Hz ring buffer, never saved

    LEGACY_ACC_W: 0.25, LEGACY_ACC_REF: 9000,
    LEGACY_HONOUR: 0.010, LEGACY_BREACH: 0.006,

    DRY_TARGET: 0.24, DRY_LEN: 300,      // THE DRY WEEK
    TURN_DROP: 0.18, TURN_LEN: 60,       // THE TURN
    QUIET_LEN: 400, QUIET_FLOOR: 0.15,   // THE QUIET
    SHOCK_DRY_FC: 0.10, SHOCK_TURN_FC: 0.34, SHOCK_QUIET_FC: 0.66,
    SHOCK_DRY_BOND: 0.50,

    HEDGE_TRIGGER: 1.00, HEDGE_HOLD: 400,      // |bookβ1| this large, this long → a Bryoria offers
    COMMIT_CH: 5, COMMIT_HOLD: 900,            // channels held this long with no reallocation
    COMMIT_PREMIUM: 1.45,
    MERCY_BREACHES: 3, MERCY_PREMIUM: 1.25     // three breaches in one guild → a hand extended
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE GUILD TABLE — `05` §4.0
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Read down the `beta[1]` column. ROOT +0.80 and CROWN +0.55 die with the forest; BROOD −0.40 and
  // RIVAL −0.25 thrive on its death. Act II's central tragedy, expressed as a covariance matrix.
  // Read the GHOST row: all zeros. Every portfolio game needs a cash position; ours is a parasite.

  var ROOT = 0, NODULE = 1, BROOD = 2, GHOST = 3, CROWN = 4, RIVAL = 5
  var NGUILD = 6, NFACTOR = 5

  var GUILDS = [
    { key: 'ROOT', label: 'root', glyph: '⊥', alpha: 0.80, costMod: 1.00, tol: 4,
      bound: true, base: 26, phase: 1, unit: '⛬/s',
      beta: [0.35, 0.80, -0.15, 0.20, -0.10] },
    { key: 'NODULE', label: 'nodule', glyph: '◍', alpha: 1.00, costMod: 0.75, tol: 2,
      bound: true, base: 0.085, phase: 1, unit: '× gross',
      beta: [0.45, 0.20, 0.55, 0.70, -0.05] },
    { key: 'BROOD', label: 'brood', glyph: '⬡', alpha: 1.35, costMod: 1.45, tol: 2,
      bound: true, base: 1.00, phase: 2, unit: '× gross',
      beta: [0.60, -0.40, 0.35, 0.10, 0.25] },
    { key: 'GHOST', label: 'ghost', glyph: '◌', alpha: 0.55, costMod: 1.20, tol: 5,
      bound: false, base: 0.22, phase: 2, unit: 'Ψ/s',
      beta: [0.00, 0.10, 0.00, 0.15, 0.00] },
    { key: 'CROWN', label: 'crown', glyph: '△', alpha: 1.00, costMod: 0.85, tol: 3,
      bound: true, base: 0.10, phase: 3, unit: '× Σ',
      beta: [0.20, 0.55, -0.30, -0.10, 0.00] },
    { key: 'RIVAL', label: 'rival', glyph: '✕', alpha: 1.20, costMod: 1.60, tol: 1,
      bound: false, base: 0.0022, phase: 4, unit: 'threat/s',
      beta: [-0.10, -0.25, 0.00, 0.00, -0.85] }
  ]

  var FACTOR_NAME = ['MOISTURE', 'CANOPY', 'SEASON', 'DECAY', 'PRESSURE']
  var FACTOR_SHORT = ['M', 'C', 'S', 'D', 'P']

  // The three ROOT payout types (`02` §10.2's contract types, surviving as a signing-time choice).
  // They cost identically. INTERFACE pays in Signal via the whole network rather than the region,
  // so it is right when your book is large and your forest intact; MINERAL is right when you need
  // density steps now.
  var ROOT_TYPES = [
    { key: 'MINERAL', label: 'mineral', mult: 1.00 },
    { key: 'INTERFACE', label: 'interface', mult: 0.00 },
    { key: 'ALARM', label: 'alarm', mult: 0.35 }
  ]

  // ───────────────────────────────────────────────────────────────────────────
  // THE PARTNERS — `05` §4.1–4.6. Eighteen named instances plus procedural ROOT stands.
  // ───────────────────────────────────────────────────────────────────────────
  //
  // `betaFix` is a per-factor override applied AFTER the guild-biased roll, and it is the reason
  // Bryoria and the cyanolichen — same guild, same payout formula — are a straddle when held
  // together. `min`/`max` clamp the rolled value; `set` replaces it outright.

  var PARTNERS = [
    // ── NODULE ──
    { id: 'frankia', guild: NODULE, name: 'the alder nodules', rarity: 1.0,
      baseMult: 1.00, tauMult: 1.60, bondKMult: 1.00,
      betaFix: { 3: { min: 0.75 } },
      note: 'bonds slowly, caps highest' },
    { id: 'rhizobium', guild: NODULE, name: 'the vetch in the clearing', rarity: 1.0,
      baseMult: 1.30, tauMult: 0.55, bondKMult: 0.60,
      betaFix: { 2: { mag: 0.90 } },
      note: 'a seasonal instrument' },
    { id: 'streptomyces', guild: NODULE, name: 'the grey filaments', rarity: 1.0,
      baseMult: 0.90, tauMult: 1.00, bondKMult: 1.00, tolDelta: -1,
      note: 'will not share a book for long' },

    // ── BROOD ──
    { id: 'atta', guild: BROOD, name: 'the leafcutters under the beech', rarity: 1.0,
      baseMult: 1.15, intervalMod: 1.00, tolDelta: -1,
      note: 'the largest lumps' },
    { id: 'reticulitermes', guild: BROOD, name: 'the termites in the standing dead', rarity: 1.0,
      baseMult: 0.80, intervalMod: 1.45, convertsTL: 0.004 / 60,
      note: 'it makes its own substrate' },
    { id: 'dendroctonus', guild: BROOD, name: 'the beetle brood', rarity: 1.0,
      baseMult: 1.05, intervalMod: 1.25, killsTrees: 1.40,
      note: 'a partner whose success destroys your cognition' },

    // ── GHOST ──
    { id: 'monotropa', guild: GHOST, name: 'the ghost pipe', rarity: 1.0,
      baseMult: 1.00, betaZero: true,
      note: 'it does not care what the weather does' },
    { id: 'corallorhiza', guild: GHOST, name: 'the coralroot', rarity: 1.0,
      baseMult: 0.85, ripeCoef: 0.11,
      note: 'a higher floor under the ripeness' },
    { id: 'voyria', guild: GHOST, name: 'the pale gentian', rarity: 0.7,
      baseMult: 0.75, revealAll: true,
      note: 'it lets you see, and it is bad at its job' },

    // ── CROWN ──
    { id: 'lobaria', guild: CROWN, name: 'the lungwort on the north faces', rarity: 1.0,
      baseMult: 1.00, fh: 45,
      note: 'the balanced one' },
    { id: 'bryoria', guild: CROWN, name: 'the horsehair lichen', rarity: 1.0,
      baseMult: 0.55, fh: 95, betaFix: { 0: { max: -0.75 } },
      note: 'the book’s standard moisture hedge' },
    { id: 'cyanolichen', guild: CROWN, name: 'the black crust', rarity: 1.0,
      baseMult: 1.55, fh: 20, betaFix: { 0: { min: 0.90 } },
      note: 'the highest-yield, highest-exposure asset there is' },

    // ── RIVAL ──
    { id: 'armillaria', guild: RIVAL, name: 'the honey fungus', rarity: 0.8,
      baseMult: 1.55, strainDrift: 0.0009, ally: 0,
      note: 'always drifting toward breach' },
    { id: 'trichoderma', guild: RIVAL, name: 'Trichoderma', rarity: 1.0,
      baseMult: 0.90, costModOverride: 1.20, tauMult: 0.50, bondKMult: 0.45, ally: 2,
      note: 'the disposable ally' },
    { id: 'hypholoma', guild: RIVAL, name: 'Hypholoma', rarity: 1.0,
      baseMult: 0.70, tolDelta: 1, ally: 3,
      note: 'the only rival that tolerates a second' }
  ]

  // ───────────────────────────────────────────────────────────────────────────
  // THE SIXTEEN TRAITS — `05` §8. Three distinct per partner: 560 combinations.
  // ───────────────────────────────────────────────────────────────────────────

  var TRAITS = [
    { id: 'patient', label: 'patient', line: 'survives droughts' },
    { id: 'fickle', label: 'fickle', line: 'jittery, unpredictable' },
    { id: 'deep', label: 'deep', line: 'bonds fast' },
    { id: 'shallow', label: 'shallow', line: 'never becomes an anchor' },
    { id: 'generous', label: 'generous', line: 'just pays more' },
    { id: 'thin', label: 'thin', line: 'just pays less' },
    { id: 'prolific', label: 'prolific', line: 'rewards concentration' },
    { id: 'sated', label: 'sated', line: 'rewards spreading' },
    { id: 'hygrophile', label: 'hygrophile', line: 'doubles down on moisture' },
    { id: 'xerophile', label: 'xerophile', line: 'inverts moisture exposure' },
    { id: 'jealous', label: 'jealous', line: 'will not share' },
    { id: 'gregarious', label: 'gregarious', line: 'will share' },
    { id: 'vengeful', label: 'vengeful', line: 'do not fail this one' },
    { id: 'old', label: 'old', line: 'a gift: it arrives already known' },
    { id: 'watchful', label: 'watchful', line: 'reveals its guild' },
    { id: 'keystone', label: 'keystone', line: 'everything else is worth more' }
  ]
  var TRAIT_BY_ID = {}
  ;(function () { for (var i = 0; i < TRAITS.length; i++) TRAIT_BY_ID[TRAITS[i].id] = TRAITS[i] })()

  var TRAIT_FICKLE_AMP = 0.12, TRAIT_FICKLE_BIAS = 0.45
  var TRAIT_DEEP_TAU = 0.62, TRAIT_SHALLOW_K = 0.55
  var TRAIT_GENEROUS = 1.35, TRAIT_THIN = 0.72
  var TRAIT_PROLIFIC = 0.15, TRAIT_SATED = -0.20
  var TRAIT_HYGRO = 1.90, TRAIT_XERO = 1.30
  var TRAIT_OLD_TENURE = 600
  var TRAIT_VENGEFUL = 2.0

  // The guild-specific NOTICE demands (`05` §6.2). GHOST cannot be appeased: you cannot buy a
  // parasite's goodwill, you can only change the weather it lives in.
  var DEMANDS = [
    { guild: ROOT, text: 'more sugar', costFrac: 0.09, relief: 0.45, kind: 'biomass' },
    { guild: NODULE, text: 'more channels', relief: 0.50, kind: 'channel' },
    { guild: BROOD, text: 'tribute', costFrac: 0.055, relief: 0.45, kind: 'biomass' },
    { guild: GHOST, text: 'nothing', relief: 0, kind: 'none' },
    { guild: CROWN, text: 'a longer term', relief: 0.40, kind: 'term' },
    { guild: RIVAL, text: 'land', relief: 0.60, kind: 'land' }
  ]
  var DEMAND_CH_HOLD = 300     // s the extra NODULE channel must stay

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE STATE — everything derived, recomputed each strategic tick
  // ───────────────────────────────────────────────────────────────────────────

  var F = [0, 0, 0, 0, 0]          // the five factor readings
  var acc = 0                      // seconds accumulated toward the next strategic tick
  var rand = null                  // the module's stochastic stream; deterministic from s.seed
  var gross = 0                    // grossBiomassRate, BEFORE pact effects (`05` §2.5)
  var congestion = 1
  var bookCost = 0                 // g/s
  var undoSeq = 0
  var undos = {}
  var LAST = {                     // the per-tick attribution the readouts and the selftest read
    noduleFrac: 0, broodRate: 0, ghostPsi: 0, rootMin: 0, crownSig: 0, rivalCut: 0,
    passive: 0, delivered: 0, accord: 0
  }

  function rng () {
    if (!rand) rand = C().rng(C().hash32(num(S() && S().seed), 'pactbook'))
    return rand
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE SAVE BLOCK — `05` §19.2, versioned separately inside a2.pact
  // ───────────────────────────────────────────────────────────────────────────
  //
  // projects.js writes `slots`, `projectChannels`, `traitThresholdMult`, `autoRenew`, `plasticity`
  // and `noduleScars` into this object before this module has ever run, so `ensure` fills gaps and
  // never overwrites.

  function ensure (s) {
    if (!s || !s.a2) return null
    var b = s.a2.pact
    if (!b || typeof b !== 'object') { b = {}; s.a2.pact = b }
    if (b.v === undefined) b.v = PB.V
    if (!(b.pacts instanceof Array)) b.pacts = []
    if (!(b.offers instanceof Array)) b.offers = []
    if (!b.partners || typeof b.partners !== 'object') b.partners = {}
    if (!(b.guildRep instanceof Array) || b.guildRep.length !== NGUILD) {
      b.guildRep = [PB.REP_START, PB.REP_START, PB.REP_START,
        PB.REP_START, PB.REP_START, PB.REP_START]
    }
    if (!(b.triangles instanceof Array)) b.triangles = []
    if (!(b.reconciled instanceof Array)) b.reconciled = []
    if (typeof b.bookRep !== 'number') b.bookRep = PB.REP_START
    if (typeof b.slots !== 'number') b.slots = 0
    if (typeof b.accordChannels !== 'number') b.accordChannels = 0
    if (typeof b.projectChannels !== 'number') b.projectChannels = 0
    if (typeof b.traitThresholdMult !== 'number') b.traitThresholdMult = 1
    if (typeof b.plasticity !== 'number') b.plasticity = PB.PLASTICITY
    if (typeof b.autoRenew !== 'number') b.autoRenew = 0
    if (typeof b.noduleScars !== 'number') b.noduleScars = 0
    if (typeof b.nextId !== 'number') b.nextId = 1
    if (typeof b.lastOfferAt !== 'number') b.lastOfferAt = 0
    if (typeof b.declines !== 'number') b.declines = 0
    if (typeof b.shocksFired !== 'number') b.shocksFired = 0
    if (typeof b.honouredP6 !== 'number') b.honouredP6 = 0
    if (typeof b.breachedP6 !== 'number') b.breachedP6 = 0
    if (typeof b.phase !== 'number') b.phase = 1
    if (typeof b.advFactor !== 'number') b.advFactor = 1
    if (typeof b.lastDemandAt !== 'number') b.lastDemandAt = 0
    if (typeof b.betaHighSince !== 'number') b.betaHighSince = 0
    if (typeof b.stableSince !== 'number') b.stableSince = 0
    if (typeof b.blindUntil !== 'number') b.blindUntil = 0
    if (typeof b.chLockUntil !== 'number') b.chLockUntil = 0
    if (typeof b.chLocked !== 'number') b.chLocked = 0
    if (typeof b.dryUntil !== 'number') b.dryUntil = 0
    if (typeof b.dryFrom !== 'number') b.dryFrom = 0
    if (typeof b.turnOffset !== 'number') b.turnOffset = 0
    if (typeof b.turnUntil !== 'number') b.turnUntil = 0
    if (typeof b.quietUntil !== 'number') b.quietUntil = 0
    if (typeof b.rivalSpreadUntil !== 'number') b.rivalSpreadUntil = 0
    if (typeof b.channels !== 'number') b.channels = 0
    if (typeof b.channelCap !== 'number') b.channelCap = 0
    return b
  }

  function open (s) {
    var b = ensure(s)
    return !!(b && s.act === 2 && b.slots > 0)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WORLD READS — every one feature-detected, every one lazy
  // ───────────────────────────────────────────────────────────────────────────

  function claimed (s) {
    if (HY.world && HY.world.claimedCount) return HY.world.claimedCount(s)
    var f = s.a2.regions.flags, i, n = 0
    for (i = 0; i < f.length; i++) if (f[i] & 4) n++
    return n
  }

  function grossRate (s) {
    return HY.forest && HY.forest.biomassRate ? num(HY.forest.biomassRate(s)) : 0
  }

  function fc (s) {
    if (HY.forest && HY.forest.forestConsumed) return num(HY.forest.forestConsumed(s))
    return C().clamp(num(s.res.extracted) / A().EXTRACT_TARGET, 0, 1)
  }

  function weather (s) {
    if (HY.flush && HY.flush.W) return num(HY.flush.W())
    return num(s.a2.W)
  }

  function neighboursOf (i) {
    return HY.world && HY.world.neighbours ? HY.world.neighbours(i) : []
  }

  function regionName (i) {
    if (HY.world && HY.world.regionName) return HY.world.regionName(i)
    return 'stand ' + i
  }

  function speciesAt (s, i) {
    var sp = HY.forest && HY.forest.SPECIES ? HY.forest.SPECIES : null
    if (!sp) return { name: 'stand', kappa: 1, canopy: 1 }
    return sp[num(s.a2.regions.sp0[i]) % sp.length]
  }

  function terrainAt (s, i) {
    var tr = HY.forest && HY.forest.TERRAIN ? HY.forest.TERRAIN : null
    if (!tr) return { name: 'Loam', mineralMod: 1 }
    return tr[num(s.a2.regions.terrain[i]) % tr.length]
  }

  function canopyAt (s, i) {
    if (HY.forest && HY.forest.canopy) return num(HY.forest.canopy(i, s))
    var t0 = num(s.a2.regions.T0[i])
    return t0 > 0 ? C().clamp(num(s.a2.regions.T[i]) / t0, 0, 1) : 0
  }

  function ripenessNow (s) {
    return HY.cognition && HY.cognition.ripeness ? num(HY.cognition.ripeness(s)) : 0
  }

  function srNow (s) {
    return HY.cognition && HY.cognition.Sr ? num(HY.cognition.Sr(s)) : 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 1 · recomputeFactors — `05` §5.2
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Every factor is a normalised, signed reading of a state variable the player can already see
  // somewhere else. Nothing here is a private random walk. F2 is the long thesis: `ΣT/ΣT0` runs
  // 1.00 → ~0.05 across the act, so F2 runs +1.00 → −0.90, monotonically, and every β2-positive
  // partner is a decaying asset. Nothing in the game ever says so.

  function lifeFraction (s) {
    if (HY.forest && HY.forest.legacyLife) return C().clamp(num(HY.forest.legacyLife(s)), 0, 1)
    var r = s.a2.regions, i, t = 0, t0 = 0
    for (i = 0; i < r.T.length; i++) { t += num(r.T[i]); t0 += num(r.T0[i]) }
    return t0 > 0 ? C().clamp(t / t0, 0, 1) : 0
  }

  function humusMean (s) {
    var r = s.a2.regions, i, t = 0, n = 0
    for (i = 0; i < r.h.length; i++) {
      if (!(r.flags[i] & 4)) continue
      t += num(r.h[i]); n++
    }
    return n > 0 ? t / n : 0.5
  }

  function pressureMean (s) {
    var r = s.a2.regions, i, t = 0
    var n = claimed(s)
    for (i = 0; i < r.rivalStr.length; i++) t += C().clamp(num(r.rivalStr[i]), 0, 1)
    return n > 0 ? t / n : 0
  }

  function f1From (w) { return C().clamp((w - A().OU_MEAN) / 0.25, -2, 2) }

  function recomputeFactors (s) {
    var b = ensure(s)
    var w = weather(s)

    // THE DRY WEEK is scripted, and `05` §0.1 forbids this module from owning the weather. The
    // shock therefore scripts the *lens*, not the process: F1 is dragged along a 300-second path
    // to the reading a W of 0.24 would give, and the OU walk underneath is untouched.
    if (b.dryUntil > s.t) {
      var prog = C().clamp((s.t - b.dryFrom) / Math.max(1, PB.DRY_LEN), 0, 1)
      w = w + (PB.DRY_TARGET - w) * prog
    }
    F[0] = f1From(w)

    // THE TURN is a mass mortality elsewhere on the map: a persistent offset on the canopy reading
    // that decays back into the true value as the true value overtakes it.
    var life = lifeFraction(s)
    F[1] = C().clamp((life - 0.50) * 2 - (b.turnUntil > s.t ? b.turnOffset *
      C().clamp((s.t - (b.turnUntil - PB.TURN_LEN)) / PB.TURN_LEN, 0, 1) * 2 : 0), -1, 1)
    if (b.turnUntil > 0 && b.turnUntil <= s.t) F[1] = C().clamp((life - 0.50) * 2 - b.turnOffset * 2, -1, 1)

    F[2] = Math.sin(2 * Math.PI * num(s.t) / T().CLOCK.WEATHER_PERIOD)
    F[3] = C().clamp((humusMean(s) - 0.50) * 2, -1, 1)
    F[4] = C().clamp((pressureMean(s) - 0.20) * 2.5, -1, 1)
    return F
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PACT MATH — `05` §3.2, §4, §5.3
  // ───────────────────────────────────────────────────────────────────────────

  function guildOf (p) { return GUILDS[p.guild] || GUILDS[0] }
  function partnerDef (id) {
    for (var i = 0; i < PARTNERS.length; i++) if (PARTNERS[i].id === id) return PARTNERS[i]
    return null
  }
  function has (p, trait) { return p.traits && p.traits.indexOf(trait) >= 0 }

  function tauOf (p) {
    var d = partnerDef(p.partnerId)
    var tau = PB.TAU_BOND * (d && d.tauMult ? d.tauMult : 1)
    if (has(p, 'deep')) tau *= TRAIT_DEEP_TAU
    return tau
  }

  function bondKOf (p) {
    var d = partnerDef(p.partnerId)
    var k = PB.BOND_K * (d && d.bondKMult ? d.bondKMult : 1)
    if (has(p, 'shallow')) k *= TRAIT_SHALLOW_K
    return k
  }

  function bondOf (p) { return 1 - Math.exp(-Math.max(0, num(p.tenure)) / tauOf(p)) }

  function bondMultOf (p) {
    return Math.min(A().BOND_MAX, 1 + bondKOf(p) * Math.pow(bondOf(p), PB.BOND_EXP))
  }

  function alphaOf (p) {
    var a = guildOf(p).alpha
    if (has(p, 'prolific')) a += TRAIT_PROLIFIC
    if (has(p, 'sated')) a += TRAIT_SATED
    return Math.max(0.05, a)
  }

  function toleranceOf (p) {
    var g = guildOf(p)
    var d = partnerDef(p.partnerId)
    var t = g.tol + (d && d.tolDelta ? d.tolDelta : 0)
    if (has(p, 'jealous')) t -= 1
    if (has(p, 'gregarious')) t += 2
    return Math.max(1, t)
  }

  function costModOf (p) {
    var d = partnerDef(p.partnerId)
    if (d && d.costModOverride) return d.costModOverride
    return guildOf(p).costMod
  }

  function baseOf (p) {
    var g = guildOf(p)
    var d = partnerDef(p.partnerId)
    var base = g.base * (d && d.baseMult ? d.baseMult : 1) * num(p.quality || 1)
    if (has(p, 'generous')) base *= TRAIT_GENEROUS
    if (has(p, 'thin')) base *= TRAIT_THIN
    if (p.guild === ROOT) base *= ROOT_TYPES[num(p.rootType)].mult
    return base
  }

  function dot (beta) {
    var i, t = 0
    for (i = 0; i < NFACTOR; i++) t += num(beta[i]) * F[i]
    return t
  }

  function shockOf (p) {
    return C().clamp(1 + PB.SHOCK_GAIN * dot(p.beta), PB.SHOCK_LO, PB.SHOCK_HI)
  }

  // `05` §4.1–4.6. Each guild's world anchor: the term that ties a payout to a place, so a book is
  // a claim about the map and not just about arithmetic.
  function scaleOf (s, p) {
    var i = p.regionId
    var r = s.a2.regions
    if (p.guild === ROOT) {
      if (!(i >= 0)) return 0
      return speciesAt(s, i).kappa *
        Math.pow(Math.max(0, num(r.T[i])) / PB.ROOT_T_REF, PB.ROOT_T_EXP) *
        terrainAt(s, i).mineralMod
    }
    if (p.guild === NODULE) {
      return 1 + PB.NODULE_HUMUS * (i >= 0 ? C().clamp(num(r.h[i]), 0, 1) : humusMean(s))
    }
    if (p.guild === GHOST) return 1 + PB.GHOST_RIPE * ripenessNow(s)
    if (p.guild === CROWN) {
      if (!(i >= 0)) return 0
      var t0 = num(r.T0[i])
      var frac = t0 > 0 ? C().clamp(num(r.T[i]) / t0, 0, 1) : 0
      return canopyAt(s, i) * Math.pow(frac, PB.CROWN_T_EXP)
    }
    return 1
  }

  // KEYSTONE is how P4 begins: a keystone partner turns the book from a list into a graph. It is
  // worth protecting because of what else you own, and its NOTICE demands are suddenly worth paying
  // at almost any price.
  function keystoneMult (b, self) {
    var i, n = 1
    for (i = 0; i < b.pacts.length; i++) {
      var q = b.pacts[i]
      if (q === self || !live(q)) continue
      if (has(q, 'keystone') && num(q.strain) < PB.KEYSTONE_GATE) n *= PB.KEYSTONE_MULT
    }
    return n
  }

  function crossMult (b, p) {
    if (!p.boundTo) return 1
    var q = byId(b, p.boundTo)
    if (!q || !live(q)) return PB.CROSS_A
    return PB.CROSS_A + PB.CROSS_B * (1 - C().clamp(num(q.strain), 0, 1))
  }

  function triangleMult (b, p) {
    var i, j
    for (i = 0; i < b.triangles.length; i++) {
      for (j = 0; j < b.triangles[i].length; j++) {
        if (b.triangles[i][j] === p.id) return PB.TRIANGLE_SHOCK
      }
    }
    return 1
  }

  // The universal yield equation, `05` §4. Units differ by guild, deliberately: six guilds exist so
  // that six different activities pay you, not so that one activity pays six different amounts.
  function yieldOf (s, b, p) {
    if (!live(p) || !(p.ch > 0)) return 0
    if (p.mutedUntil > s.t) return 0
    return baseOf(p) *
      Math.pow(p.ch, alphaOf(p)) *
      bondMultOf(p) *
      shockOf(p) * triangleMult(b, p) *
      keystoneMult(b, p) * crossMult(b, p) *
      (1 - PB.STRAIN_YIELD * C().clamp(num(p.strain), 0, 1)) *
      scaleOf(s, p)
  }

  function byId (b, id) {
    for (var i = 0; i < b.pacts.length; i++) if (b.pacts[i].id === id) return b.pacts[i]
    return null
  }

  function offerById (b, id) {
    for (var i = 0; i < b.offers.length; i++) if (b.offers[i].id === id) return b.offers[i]
    return null
  }

  // A pact under NOTICE is still live: a demand is a demand, not a suspension. If a NOTICE froze
  // the yield, the cost and the strain, strain would stop at 0.80 and no breach could ever occur —
  // which is the bug that turns the whole ladder into decoration.
  function live (p) { return p.state === 'active' || p.state === 'notice' }

  function guildCount (b, g) {
    var i, n = 0
    for (i = 0; i < b.pacts.length; i++) if (b.pacts[i].guild === g && live(b.pacts[i])) n++
    return n
  }

  function activePacts (b) {
    var i, out = []
    for (i = 0; i < b.pacts.length; i++) if (live(b.pacts[i])) out.push(b.pacts[i])
    return out
  }

  function totalChannels (b) {
    var i, n = 0
    for (i = 0; i < b.pacts.length; i++) if (live(b.pacts[i])) n += num(b.pacts[i].ch)
    return n
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BANDWIDTH — `05` §2.2–2.5
  // ───────────────────────────────────────────────────────────────────────────

  function channelCap (st) {
    var s = st || S()
    var b = ensure(s)
    if (!b) return 0
    var cap = PB.CAP_BASE + Math.floor(PB.CAP_K * Math.log(1 + claimed(s))) +
      num(b.accordChannels) + num(b.projectChannels)
    return Math.max(A().CHANNELS_MIN, Math.min(A().CHANNELS_MAX, cap))
  }

  function channelsFree (st) {
    var s = st || S()
    var b = ensure(s)
    if (!b) return 0
    return Math.max(0, channelCap(s) - totalChannels(b) - num(b.chLocked))
  }

  function slots (st) {
    var s = st || S()
    var b = ensure(s)
    if (!b) return 0
    return Math.min(A().SLOTS_MAX, num(b.slots))
  }

  // `08` §4.8: convex in *pacts held*, so the optimum book size against a linear yield is interior
  // and sits near seven. "Is my book too big" is a real question with a real answer.
  function congestionOf (k) {
    return 1 + A().CONGEST_K * Math.pow(Math.max(0, k), A().CONGEST_EXP)
  }

  function channelCost (st) {
    var s = st || S()
    var b = ensure(s)
    if (!b) return Infinity
    var n = num(b.accordChannels)
    if (n >= PB.ACCORD_CH_MAX) return Infinity
    return Math.ceil(A().CHANNEL_A * Math.pow(n + 1, A().CHANNEL_E))
  }

  function passiveMineral (st) {
    var s = st || S()
    if (!s || s.act !== 2) return 0
    return A().PASSIVE_MIN_K * Math.pow(Math.max(0, claimed(s)), A().PASSIVE_MIN_EXP)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 3 · recomputeCosts — `05` §2.5
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Total cost is computed globally from the book's shape and then attributed pro-rata by
  // `ch · costMod`, so every card can show its own honest cost line and the lines sum to the header.

  function recomputeCosts (s, b) {
    gross = grossRate(s)
    var act = activePacts(b)
    congestion = congestionOf(act.length)
    var i, weight = 0
    for (i = 0; i < act.length; i++) weight += act[i].ch * costModOf(act[i])
    bookCost = PB.CH_COST_FRAC * gross * weight * congestion
    for (i = 0; i < act.length; i++) {
      var w = act[i].ch * costModOf(act[i])
      act[i].cost = weight > 0 ? bookCost * (w / weight) : 0
    }
    b.channels = totalChannels(b)
    b.channelCap = channelCap(s)
    return bookCost
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 4 · chargeCosts
  // ───────────────────────────────────────────────────────────────────────────

  function chargeCosts (s, b, dt) {
    var act = activePacts(b), i
    var owed = bookCost * dt
    var held = num(s.res.biomass)
    var paidFrac = owed > 0 ? C().clamp(held / owed, 0, 1) : 1
    if (owed > 0) C().setStock(s.res, 'biomass', Math.max(0, held - owed * paidFrac))
    // A pact with no channels costs nothing and is therefore paid nothing: `demandMet` is 0, not 1.
    // That reading is what makes `05` §3.3's promise true — a parked pact dies in about four
    // minutes rather than ten — without moving a single published coefficient.
    for (i = 0; i < act.length; i++) act[i].demandMet = act[i].ch > 0 ? paidFrac : 0
    return paidFrac
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 6 · applyYields
  // ───────────────────────────────────────────────────────────────────────────

  function applyYields (s, b, dt, o) {
    var act = activePacts(b), i, p
    var noduleFrac = 0, ghostPsi = 0, rootMin = 0, crownSig = 0, ripeFloor = 0
    var crownFH = 0, rivalFactor = 1

    for (i = 0; i < act.length; i++) {
      p = act[i]
      p.yield = yieldOf(s, b, p)
      if (p.guild === ROOT) rootMin += p.yield
      else if (p.guild === NODULE) noduleFrac += p.yield
      else if (p.guild === GHOST) {
        ghostPsi += p.yield
        var d = partnerDef(p.partnerId)
        var coef = d && d.ripeCoef ? d.ripeCoef : PB.GHOST_FLOOR_K
        if (p.ch > 0 && p.mutedUntil <= s.t) ripeFloor += coef * Math.pow(p.ch, PB.GHOST_FLOOR_EXP)
      } else if (p.guild === CROWN) {
        crownSig += p.yield
        var cd = partnerDef(p.partnerId)
        if (cd && cd.fh) crownFH += cd.fh * Math.pow(Math.max(0, p.ch), PB.CROWN_FH_EXP) * bondMultOf(p)
      } else if (p.guild === RIVAL) {
        rivalFactor *= (1 - PB.RIVAL_ADV * Math.pow(Math.max(0, p.ch), PB.RIVAL_ADV_EXP))
      }
    }

    // ROOT ⊥ and the always-on floor. `passiveMineral` is never displayed as a pact: it is the
    // guarantee that there is no dead end, and it is slow, boring and unmissable.
    var passive = passiveMineral(s)
    var minerals = (rootMin + passive) * dt
    if (minerals > 0) {
      C().setStock(s.res, 'minerals', num(s.res.minerals) + minerals)
      stat(s, 'mineralEarned', minerals)
    }

    // NODULE ◍ pays as a fraction of the biomass rate. Crediting the product here rather than
    // writing s.mult.yieldMult keeps `grossBiomassRate` meaning "before pact effects", which is
    // what `05` §2.5's cost law requires, and keeps this module out of the projects multiplier.
    if (noduleFrac > 0 && gross > 0) {
      var gain = noduleFrac * gross * dt
      C().setStock(s.res, 'biomass', num(s.res.biomass) + gain)
      C().setStock(s.res, 'cumBiomass', num(s.res.cumBiomass) + gain)
    }

    // GHOST ◌ pays in thought, and raises the floor under ripeness — a floor on the multiplier,
    // never on saturation (BIBLE §7 C31).
    if (ghostPsi > 0) C().setStock(s.res, 'insight', num(s.res.insight) + ghostPsi * dt)
    s.mult.ripenessFloor = C().clamp(ripeFloor, 0, A().RIPE_FLOOR_CAP)

    // CROWN △ pays as a fraction of the Signal rate. Step 8 runs before cognition's step 9, so the
    // credit is clamped to Sc with everything else and its overflow feeds Insight, correctly.
    if (crownSig > 0) {
      C().setStock(s.res, 'signal', num(s.res.signal) + crownSig * srNow(s) * dt)
    }
    b.crownFH = crownFH

    // A ROOT breach costs you cognition: liveInterface ×0.55 in that region for 300 s. The scar is
    // charged as a Signal debit proportional to the region's share of the interface, which is the
    // same quantity the multiplier would have removed.
    if (b.rootScar && b.rootScar.until > s.t && HY.forest && HY.forest.totalInterface) {
      var tot = num(HY.forest.totalInterface(s))
      if (tot > 0) {
        var share = num(HY.forest.liveInterface(b.rootScar.region, s)) / tot
        C().setStock(s.res, 'signal',
          Math.max(0, num(s.res.signal) - PB.ROOT_SCAR * share * srNow(s) * dt))
      }
    }

    // RIVAL ✕ pays nothing you can spend. It buys territory: pressure falls where your ally is,
    // advancing gets cheaper, and their holdings become free information.
    applyRival(s, b, act, dt)
    var advTarget = Math.max(PB.RIVAL_ADV_MIN, rivalFactor)
    if (Math.abs(advTarget - num(b.advFactor)) > 1e-9) {
      var prev = num(b.advFactor) || 1
      s.mult.advCostMult = num(s.mult.advCostMult) / prev * advTarget
      b.advFactor = advTarget
    }

    // BROOD ⬡ partners change the world they live in. Reticulitermes makes its own substrate;
    // Dendroctonus kills the stands that are also your Signal, and you can watch it on the map.
    applyBroodWorld(s, act, dt, o)

    LAST.noduleFrac = noduleFrac
    LAST.ghostPsi = ghostPsi
    LAST.rootMin = rootMin
    LAST.crownSig = crownSig
    LAST.passive = passive
  }

  function applyRival (s, b, act, dt) {
    var r = s.a2.regions, i, k, j, cut = 0
    for (i = 0; i < act.length; i++) {
      var p = act[i]
      if (p.guild !== RIVAL || !(p.yield > 0)) continue
      var d = partnerDef(p.partnerId)
      var ally = d && d.ally !== undefined ? d.ally : 0
      var targets = []
      for (k = 0; k < r.rival.length; k++) {
        if (num(r.rivalStr[k]) <= 0) continue
        if (r.rival[k] === ally) { targets.push(k); continue }
        var nb = neighboursOf(k)
        for (j = 0; j < nb.length; j++) if (r.rival[nb[j]] === ally) { targets.push(k); break }
      }
      if (!targets.length) continue
      var per = p.yield * dt / targets.length
      for (k = 0; k < targets.length; k++) {
        var was = num(r.rivalStr[targets[k]])
        r.rivalStr[targets[k]] = Math.max(0, was - per)
        cut += was - r.rivalStr[targets[k]]
      }
      // Free surveying of a quarter of the map: the ally shows you what it can see.
      for (k = 0; k < r.rival.length; k++) if (r.rival[k] === ally) r.flags[k] |= 3
    }
    // A rival breach blooms across a third of the map, and keeps blooming for ten minutes.
    if (b.rivalSpreadUntil > s.t) {
      for (k = 0; k < r.rivalStr.length; k++) {
        if (num(r.rivalStr[k]) > 0) {
          r.rivalStr[k] = C().clamp(num(r.rivalStr[k]) + PB.RIVAL_BREACH_SPREAD * dt, 0, 1)
        }
      }
    }
    LAST.rivalCut = cut
  }

  function applyBroodWorld (s, act, dt, o) {
    var r = s.a2.regions, i, k
    for (i = 0; i < act.length; i++) {
      var p = act[i]
      if (p.guild !== BROOD || !(p.regionId >= 0) || !(p.ch > 0)) continue
      var d = partnerDef(p.partnerId)
      if (!d) continue
      if (d.convertsTL) {
        var moved = num(r.T[p.regionId]) * d.convertsTL * dt
        if (moved > 0) {
          r.T[p.regionId] = Math.max(0, num(r.T[p.regionId]) - moved)
          r.L[p.regionId] = num(r.L[p.regionId]) + moved
        }
      }
      if (d.killsTrees) {
        var extra = (d.killsTrees - 1) * 0.0004 * dt
        var hit = [p.regionId].concat(neighboursOf(p.regionId).slice(0, 2))
        for (k = 0; k < hit.length; k++) {
          r.T[hit[k]] = Math.max(0, num(r.T[hit[k]]) * (1 - extra))
        }
      }
    }
    void o
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 7 · rollBroodDeliveries — `05` §4.3
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Runs AFTER yields so `shockMult` is current. The card shows both `+1.00× gross` and
  // `last 5: 71s 118s 46s 92s 61s` — the mean and the lived experience, side by side, because the
  // gap between them is the whole feeling of the guild.

  function broodSize (s, b, p) {
    return PB.BROOD_BASE_S * gross *
      Math.pow(Math.max(0, p.ch), PB.BROOD_CH_EXP) *
      bondMultOf(p) * shockOf(p) * triangleMult(b, p) *
      keystoneMult(b, p) * crossMult(b, p) *
      (1 - PB.STRAIN_YIELD * C().clamp(num(p.strain), 0, 1)) *
      (partnerDef(p.partnerId) ? partnerDef(p.partnerId).baseMult : 1) *
      (has(p, 'generous') ? TRAIT_GENEROUS : 1) * (has(p, 'thin') ? TRAIT_THIN : 1) *
      num(p.quality || 1)
  }

  function broodInterval (p) {
    var d = partnerDef(p.partnerId)
    var im = d && d.intervalMod ? d.intervalMod : 1
    var den = Math.pow(Math.max(1e-6, p.ch), PB.BROOD_INT_EXP) *
      (1 + PB.BROOD_INT_BOND * bondOf(p)) * im
    return PB.BROOD_INTERVAL / Math.max(1e-6, den)
  }

  function rollBroodDeliveries (s, b, dt, o) {
    var act = activePacts(b), i, delivered = 0, rate = 0
    for (i = 0; i < act.length; i++) {
      var p = act[i]
      if (p.guild !== BROOD || !(p.ch > 0) || p.mutedUntil > s.t) continue
      var Sz = broodSize(s, b, p)
      var I = broodInterval(p)
      if (!(Sz > 0 && I > 0)) continue
      rate += Sz / I
      p.rate = Sz / I
      var got = 0
      if (o && o.stochastic === false) {
        // Offline and catch-up apply expected value, never sampled lumps: a lump you did not see
        // is not a lump, and variance you were not present for is not a decision.
        got = Sz * dt / I
      } else if (rng().next() < dt / I) {
        got = Sz
        p.lastAt = p.lastAt === undefined ? num(s.t) : p.lastAt
        if (!(p.gaps instanceof Array)) p.gaps = []
        p.gaps.push(Math.round(num(s.t) - p.lastAt))
        if (p.gaps.length > 5) p.gaps.shift()
        p.lastAt = num(s.t)
      }
      if (got > 0) {
        C().setStock(s.res, 'biomass', num(s.res.biomass) + got)
        C().setStock(s.res, 'cumBiomass', num(s.res.cumBiomass) + got)
        delivered += got
      }
    }
    LAST.delivered = delivered
    LAST.broodRate = gross > 0 ? rate / gross : 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 8 · updateStrain — `05` §6.1
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Six terms, all visible on one sheet. Every bad outcome in this layer is traceable. Note
  // `− 0.22·bond`: old partners forgive you. Loyalty is a mechanic, not a mood.

  function strainTerms (s, b, p) {
    var unpaid = PB.STRAIN_UNPAID * (1 - C().clamp(num(p.demandMet), 0, 1))
    var over = guildCount(b, p.guild) - toleranceOf(p)
    var crowd = PB.STRAIN_CROWD * Math.max(0, over)
    var neglect = p.ch === 0 ? PB.STRAIN_NEGLECT : 0
    var exposure = PB.STRAIN_ENV * num(p.envStress)
    var relief = -PB.STRAIN_BOND * bondOf(p)
    var baseline = -(has(p, 'patient') ? PB.STRAIN_PATIENT : PB.STRAIN_BASE)
    return {
      unpaid: unpaid, exposure: exposure, crowding: crowd, neglect: neglect,
      relief: relief, baseline: baseline,
      net: unpaid + exposure + crowd + neglect + relief + baseline
    }
  }

  function updateStrain (s, b, dt, o) {
    var act = activePacts(b), i
    for (i = 0; i < act.length; i++) {
      var p = act[i]
      var tm = strainTerms(s, b, p)
      var d = tm.net * PB.STRAIN_RATE * dt
      var pd = partnerDef(p.partnerId)
      // Armillaria is designed to betray you, and it is legible from this line on the card from the
      // first minute. That is not a trap.
      if (pd && pd.strainDrift) d += pd.strainDrift * dt
      if (has(p, 'fickle')) {
        var jitter = (o && o.stochastic === false) ? (0.5 - TRAIT_FICKLE_BIAS)
          : (rng().next() - TRAIT_FICKLE_BIAS)
        d += TRAIT_FICKLE_AMP * jitter * (dt / PB.SLOW_DT)
      }
      if (isTriangled(b, p.id)) d -= PB.TRIANGLE_RELIEF * (dt / PB.SLOW_DT)
      p.dStrain = dt > 0 ? d / dt : 0
      p.strainTerms = tm
      var cap = (o && o.offline) ? A().STRAIN_CAP : 1
      p.strain = C().clamp(num(p.strain) + d, 0, cap)
    }
  }

  function isTriangled (b, id) {
    var i, j
    for (i = 0; i < b.triangles.length; i++) {
      for (j = 0; j < b.triangles[i].length; j++) if (b.triangles[i][j] === id) return true
    }
    return false
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 9 · checkLadder — `05` §6.2, §7
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Three stages, no coin flips anywhere. A breach can never occur offline, because strain is
  // capped at 0.95 while away and the hold timer only advances at 1.00.

  function checkLadder (s, b, dt, o) {
    var i
    for (i = b.pacts.length - 1; i >= 0; i--) {
      var p = b.pacts[i]
      if (!live(p)) continue
      var st = C().clamp(num(p.strain), 0, 1)

      if (st >= PB.WARN_AT && !p.warned) {
        p.warned = true
        fire('a2.strain_high', { partner: p.name })
      }
      if (st < PB.WARN_AT) p.warned = false

      if (st >= PB.NOTICE_AT && p.state === 'active') {
        p.state = 'notice'
        p.noticeAt = num(s.t)
        feel('pact_notice', { guild: guildOf(p).key })
      }

      if (p.state === 'notice') {
        // The compliance window does not run while you are away: a decision that resolves in your
        // absence is a decision the game took from you (BIBLE P5).
        if (o && o.offline) p.noticeAt = num(s.t)
        if (st < PB.NOTICE_AT) { p.state = 'active'; p.noticeAt = null; resolveNotice(s, b, p) }
      }

      if (st >= 1 - 1e-9) {
        p.holdAt = num(p.holdAt) + dt
        if (p.holdAt >= PB.BREACH_HOLD && !(o && o.offline)) breach(s, b, p)
      } else {
        p.holdAt = 0
      }
    }
  }

  function resolveNotice (s, b, p) {
    var grant = PB.ACC_NOTICE_GRANT * (1 + bondOf(p))
    grantAccord(s, b, p, grant)
  }

  // Six breaches, six different currencies of pain, and each one is the thing that guild was
  // protecting you from. Nothing here is a flat "you lose N resources".
  function breach (s, b, p) {
    var g = guildOf(p)
    var scale = has(p, 'vengeful') ? TRAIT_VENGEFUL : 1
    var r = s.a2.regions

    p.state = 'breached'
    p.breachedAt = num(s.t)
    b.chLocked = num(b.chLocked) + p.ch
    b.chLockUntil = Math.max(num(b.chLockUntil), num(s.t) + PB.CHANNEL_LOCK)
    partnerRec(b, p.partnerId).grudge = 1
    partnerRec(b, p.partnerId).refuseUntil = num(s.t) + 900
    b.guildRep[p.guild] = C().clamp(b.guildRep[p.guild] - PB.REP_BREACH_GUILD * scale, 0, PB.REP_MAX)
    b.bookRep = C().clamp(b.bookRep - PB.REP_BREACH_BOOK * scale, 0, PB.REP_MAX)
    stat(s, 'pactsBreached', 1)
    if (phaseOf(s) >= 6) b.breachedP6 = num(b.breachedP6) + 1

    if (p.guild === ROOT) {
      b.rootScar = { region: p.regionId, until: num(s.t) + PB.ROOT_SCAR_S * scale }
    } else if (p.guild === NODULE) {
      s.mult.E = num(s.mult.E) * Math.pow(PB.NODULE_SCAR, scale)
      b.noduleScars = num(b.noduleScars) + 1
    } else if (p.guild === BROOD) {
      C().setStock(s.res, 'biomass', num(s.res.biomass) * (1 - PB.BROOD_RAID * scale))
      var i
      for (i = 0; i < b.pacts.length; i++) {
        var q = b.pacts[i]
        if (q !== p && q.guild === BROOD && live(q)) {
          q.strain = C().clamp(num(q.strain) + PB.BROOD_GUILD_STRAIN, 0, 1)
        }
      }
    } else if (p.guild === GHOST) {
      // It does not leave. The only breach that costs you the resource itself.
      p.state = 'squatting'
      p.mutedUntil = num(s.t) + PB.GHOST_BREACH_HOLD * scale
      b.chLocked = Math.max(0, num(b.chLocked) - p.ch)
    } else if (p.guild === CROWN) {
      b.blindUntil = num(s.t) + PB.CROWN_BLIND * scale
    } else if (p.guild === RIVAL) {
      var d = partnerDef(p.partnerId)
      var ally = d && d.ally !== undefined ? d.ally : 0
      var k, j
      for (k = 0; k < r.rival.length; k++) {
        var near = r.rival[k] === ally
        if (!near) {
          var nb = neighboursOf(k)
          for (j = 0; j < nb.length; j++) if (r.rival[nb[j]] === ally) { near = true; break }
        }
        if (near) r.rivalStr[k] = C().clamp(num(r.rivalStr[k]) + PB.RIVAL_BREACH_STR * scale, 0, 1)
      }
      b.rivalSpreadUntil = num(s.t) + PB.RIVAL_BREACH_S
    }

    // Cross-pacts fail together. You can be perfectly hedged against moisture and still lose four
    // pacts because one keystone breached.
    var m
    for (m = 0; m < b.pacts.length; m++) {
      if (b.pacts[m].boundTo === p.id && live(b.pacts[m])) {
        b.pacts[m].strain = C().clamp(num(b.pacts[m].strain) + PB.CROSS_BREACH_STRAIN, 0, 1)
      }
    }
    // A triangle is a stronger, more fragile machine: if any member breaches, all three breach
    // penalties are doubled and the triangle is destroyed.
    breakTriangles(b, p, s)

    fire('a2.first_breach', { partner: p.name, guild: g.label })
    feel('pact_breach', { guild: g.key })
  }

  function breakTriangles (b, p, s) {
    var i, j
    for (i = b.triangles.length - 1; i >= 0; i--) {
      if (b.triangles[i].indexOf(p.id) < 0) continue
      for (j = 0; j < b.triangles[i].length; j++) {
        var q = byId(b, b.triangles[i][j])
        if (q && q !== p && live(q)) q.strain = C().clamp(num(q.strain) + 0.30, 0, 1)
      }
      b.triangles.splice(i, 1)
      void s
    }
  }

  function partnerRec (b, id) {
    if (!b.partners[id]) b.partners[id] = { grudge: 0, refuseUntil: 0, dislikes: [], everSigned: 0 }
    return b.partners[id]
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 10 · accrueAccord — `05` §10
  // ───────────────────────────────────────────────────────────────────────────
  //
  // ACCORD accrues only while you are being hurt, in proportion to how much you have committed and
  // how long you have been there. A player who holds only easy pacts in good weather earns almost
  // none. This is the direct structural descendant of Creativity-while-Operations-are-full.

  function grantAccord (s, b, p, amount) {
    if (!(amount > 0)) return 0
    C().setStock(s.res, 'accord', num(s.res.accord) + amount)
    C().setStock(s.res, 'accordLifetime', num(s.res.accordLifetime) + amount)
    if (p) p.accordPaid = num(p.accordPaid) + amount
    return amount
  }

  function accrueAccord (s, b, dt, o) {
    var act = activePacts(b), i, total = 0
    var eff = (o && o.offline) ? PB.ACC_OFFLINE : 1
    for (i = 0; i < act.length; i++) {
      var p = act[i]
      var adv = num(p.adverse)
      if (b.quietUntil > s.t) adv = Math.max(adv, PB.QUIET_FLOOR)
      if (!(adv > 0) || !(p.ch > 0)) continue
      total += grantAccord(s, b, p,
        PB.ACC_K * Math.pow(p.ch, 0.50) * bondOf(p) * adv * dt * eff)
    }
    LAST.accord = dt > 0 ? total / dt : 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 11 · advanceTenure — and the information schedule of `05` §5.4
  // ───────────────────────────────────────────────────────────────────────────
  //
  // You learn a partner by keeping it. A player who churns pacts every ten minutes is playing
  // blindfolded forever, and the game never tells them so. The information is free; the price is
  // commitment.

  function revealThresholds (b) {
    var m = num(b.traitThresholdMult) || 1
    return [PB.REVEAL_AT[0] * m, PB.REVEAL_AT[1] * m, PB.REVEAL_AT[2] * m]
  }

  function advanceTenure (s, b, dt) {
    var act = activePacts(b), i, k
    var th = revealThresholds(b)
    for (i = 0; i < act.length; i++) {
      var p = act[i]
      p.tenure = num(p.tenure) + dt
      p.cumTenure = num(p.cumTenure) + dt
      p.bond = bondOf(p)

      for (k = 0; k < 3; k++) {
        if (p.cumTenure >= th[k] && !(p.known & (1 << k))) {
          p.known |= (1 << k)
          stat(s, 'traitsRevealed', 1)
        }
      }
      if (!p.bondGrant && p.bond >= PB.ACC_BOND_GATE) {
        p.bondGrant = 1
        grantAccord(s, b, p, PB.ACC_BOND_GRANT)
      }
      if (!p.exactGrant && p.cumTenure >= PB.EXACT_TENURE) {
        p.exactGrant = 1
        grantAccord(s, b, p, PB.ACC_EXACT_GRANT)
      }
    }
  }

  function betaState (s, b, p) {
    if (!flagOn(s, 'pact_chemotaxis')) return 'opaque'
    var i
    for (i = 0; i < b.pacts.length; i++) {
      var q = b.pacts[i]
      if (!live(q)) continue
      if (q.partnerId === 'voyria') return 'exact'
      if (has(q, 'watchful') && q.guild === p.guild && q !== p) return 'exact'
    }
    if (num(p.cumTenure) >= PB.EXACT_TENURE) return 'exact'
    if (num(p.cumTenure) >= PB.BAND_TENURE) return 'banded'
    return 'prior'
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 12 · checkExpiry — `05` §3.4
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Expiry is the one thing the Pact Book asks you to be present for. Nine pacts on 1–6 term
  // periods produce roughly one expiry every 6–9 minutes: frequent enough to bring you back and
  // sparse enough never to feel like a chore.

  function honourAccord (p, phase) {
    var a = PB.HONOUR_K * Math.pow(Math.max(1, p.ch), PB.HONOUR_CH_EXP) *
      Math.pow(Math.max(1, p.termPeriods), PB.HONOUR_TERM_EXP)
    return phase >= 6 ? a * PB.HONOUR_P6 : a
  }

  function severCost (p) {
    var s = S()
    var rem = Math.max(0, num(p.endsAt) - num(s ? s.t : 0))
    return Math.ceil(PB.SEVER_K * p.ch * (1 + bondOf(p)) * Math.sqrt(rem / 60))
  }

  function checkExpiry (s, b) {
    var i, lapsed = 0
    for (i = b.pacts.length - 1; i >= 0; i--) {
      var p = b.pacts[i]
      if (!live(p)) continue
      if (num(s.t) < num(p.endsAt)) continue
      var phase = phaseOf(s)
      if (num(b.autoRenew) > 0) {
        // Automation is always worse than skilled play, and we tell you by how much: a fixed two
        // periods is a 54% honour-accord haircut against a hand-renewed six, forever.
        grantAccord(s, b, p, honourAccord(p, phase))
        stat(s, 'pactsHonoured', 1)
        if (phase >= 6) b.honouredP6 = num(b.honouredP6) + 1
        p.termPeriods = num(b.autoRenew)
        p.signedAt = num(s.t)
        p.endsAt = num(s.t) + p.termPeriods * A().TERM_PERIOD_S
        continue
      }
      if (p.renewUntil === undefined) { p.renewUntil = num(s.t) + PB.RENEW_WINDOW; continue }
      if (num(s.t) < p.renewUntil) continue
      grantAccord(s, b, p, honourAccord(p, phase))
      stat(s, 'pactsHonoured', 1)
      if (phase >= 6) b.honouredP6 = num(b.honouredP6) + 1
      b.guildRep[p.guild] = C().clamp(b.guildRep[p.guild] + PB.REP_HONOUR_GUILD, 0, PB.REP_MAX)
      b.bookRep = C().clamp(b.bookRep + PB.REP_HONOUR_BOOK, 0, PB.REP_MAX)
      p.tenure = num(p.tenure) * PB.LAPSE_TENURE
      p.state = 'lapsed'
      returnStake(s, p)
      partnerRec(b, p.partnerId).refuseUntil = 0
      lapsed++
    }
    if (lapsed > 0) notice('pact_expired', { k: lapsed })
    reapDead(s, b)
  }

  function reapDead (s, b) {
    var i
    for (i = b.pacts.length - 1; i >= 0; i--) {
      var p = b.pacts[i]
      if (p.state === 'squatting' && num(p.mutedUntil) <= num(s.t)) { p.state = 'breached' }
      if (p.state === 'breached' || p.state === 'lapsed' || p.state === 'severed' ||
          p.state === 'honoured') {
        if (p.reapAt === undefined) p.reapAt = num(s.t) + 6
        if (num(s.t) >= p.reapAt) b.pacts.splice(i, 1)
      }
    }
    if (num(b.chLockUntil) <= num(s.t)) b.chLocked = 0
  }

  function returnStake (s, p) {
    if (num(p.stake) > 0) {
      C().setStock(s.res, 'biomass', num(s.res.biomass) + num(p.stake))
      p.stake = 0
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 13 · maybeGenerateOffer — `05` §11
  // ───────────────────────────────────────────────────────────────────────────
  //
  // There is no partner catalogue and no browse screen. Offers arrive. Declining is a skill and it
  // is free to acquire.

  function phaseOf (s) {
    var c = fc(s)
    if (c >= 0.85) return 6
    if (c >= 0.62) return 5
    if (c >= 0.38) return 4
    if (c >= 0.18) return 3
    if (c >= 0.06) return 2
    return 1
  }

  function qualityMult (b, g) {
    return PB.QUALITY_A + PB.QUALITY_G * num(b.guildRep[g]) + PB.QUALITY_B * num(b.bookRep)
  }

  function maxTerm (b, g) {
    return C().clamp(Math.floor(1 + num(b.guildRep[g]) / PB.MAXTERM_G + num(b.bookRep) / PB.MAXTERM_B),
      PB.TERM_MIN, PB.TERM_MAX)
  }

  function guildDemandBias (b, g, phase) {
    var gd = GUILDS[g]
    if (gd.phase > phase) return 0
    var n = guildCount(b, g)
    var w = 1
    if (n === 0) w *= 1.45
    if (n >= gd.tol) w *= 0.35
    return w
  }

  function eligibleRegions (s, g) {
    var r = s.a2.regions, i, out = []
    for (i = 0; i < r.flags.length; i++) {
      if (!(r.flags[i] & 4)) continue              // claimed
      if (r.flags[i] & 16) continue                // necrotized
      if (g === ROOT) {
        var t0 = num(r.T0[i])
        if (!(num(r.d[i]) >= 0.30)) continue
        if (!(t0 > 0 && num(r.T[i]) >= 0.35 * t0)) continue
      }
      if (g === CROWN && !(canopyAt(s, i) >= 0.70)) continue
      out.push(i)
    }
    return out
  }

  function regionTaken (b, g, i) {
    var k
    for (k = 0; k < b.pacts.length; k++) {
      var p = b.pacts[k]
      if (!live(p)) continue
      if (p.regionId === i && p.guild === g) return true
    }
    return false
  }

  function candidatePool (s, b, phase) {
    var out = [], i, g
    for (i = 0; i < PARTNERS.length; i++) {
      var d = PARTNERS[i]
      if (GUILDS[d.guild].phase > phase) continue
      var rec = b.partners[d.id]
      if (rec && rec.refuseUntil > s.t) continue
      if (heldPartner(b, d.id)) continue
      var regions = GUILDS[d.guild].bound ? eligibleRegions(s, d.guild) : [-1]
      var region = -1
      for (g = 0; g < regions.length; g++) {
        if (regions[g] < 0 || !regionTaken(b, d.guild, regions[g])) { region = regions[g]; break }
      }
      if (GUILDS[d.guild].bound && region < 0) continue
      out.push({ def: d, guild: d.guild, region: region,
        w: (d.rarity || 1) * qualityMult(b, d.guild) * guildDemandBias(b, d.guild, phase) })
    }
    // ROOT stands are procedural: one per eligible region, named for the place.
    var rr = eligibleRegions(s, ROOT)
    for (i = 0; i < rr.length; i++) {
      if (regionTaken(b, ROOT, rr[i])) continue
      var pid = 'root_' + rr[i]
      var rrec = b.partners[pid]
      if (rrec && rrec.refuseUntil > s.t) continue
      if (heldPartner(b, pid)) continue
      out.push({ def: null, guild: ROOT, region: rr[i],
        w: qualityMult(b, ROOT) * guildDemandBias(b, ROOT, phase) })
    }
    return out
  }

  function heldPartner (b, id) {
    var i
    for (i = 0; i < b.pacts.length; i++) if (b.pacts[i].partnerId === id) return true
    for (i = 0; i < b.offers.length; i++) if (b.offers[i].partnerId === id) return true
    return false
  }

  // The generator picks a GUILD by demand bias and then a partner inside it. Without the
  // per-guild normalisation a mid-act map offers twenty procedural ROOT stands against three named
  // nodules, and `guildDemandBias`'s "you have none of these" nudge is drowned by counting.
  function weightedPick (pool, r) {
    var i, total = 0, byGuild = [0, 0, 0, 0, 0, 0]
    for (i = 0; i < pool.length; i++) byGuild[pool[i].guild]++
    for (i = 0; i < pool.length; i++) {
      pool[i].w = Math.max(0, pool[i].w) / Math.max(1, byGuild[pool[i].guild])
    }
    for (i = 0; i < pool.length; i++) total += Math.max(0, pool[i].w)
    if (!(total > 0)) return null
    var x = r.next() * total
    for (i = 0; i < pool.length; i++) {
      x -= Math.max(0, pool[i].w)
      if (x <= 0) return pool[i]
    }
    return pool[pool.length - 1]
  }

  // β is rolled once, at generation, from a guild-biased distribution, and then never moves. The
  // reveal schedule hides the player's *knowledge* of it, never its effect.
  function rollBeta (guild, def, traits, r) {
    var g = GUILDS[guild], i, beta = []
    for (i = 0; i < NFACTOR; i++) {
      beta.push(C().clamp(g.beta[i] + PB.BETA_SD * r.gauss(), -PB.BETA_CLAMP, PB.BETA_CLAMP))
    }
    if (def && def.betaZero) for (i = 0; i < NFACTOR; i++) beta[i] = beta[i] * 0.08
    if (def && def.betaFix) {
      for (i in def.betaFix) {
        if (!Object.prototype.hasOwnProperty.call(def.betaFix, i)) continue
        var fx = def.betaFix[i], k = +i
        if (fx.set !== undefined) beta[k] = fx.set
        if (fx.min !== undefined) beta[k] = Math.max(beta[k], fx.min)
        if (fx.max !== undefined) beta[k] = Math.min(beta[k], fx.max)
        if (fx.mag !== undefined) beta[k] = (beta[k] < 0 ? -1 : 1) * fx.mag
      }
    }
    if (traits.indexOf('hygrophile') >= 0) beta[0] = C().clamp(beta[0] * TRAIT_HYGRO, -PB.BETA_CLAMP, PB.BETA_CLAMP)
    if (traits.indexOf('xerophile') >= 0) beta[0] = C().clamp(-Math.abs(beta[0]) * TRAIT_XERO, -PB.BETA_CLAMP, PB.BETA_CLAMP)
    return beta
  }

  function rollTraits (r, phase) {
    var pool = [], i
    for (i = 0; i < TRAITS.length; i++) {
      if (TRAITS[i].id === 'keystone' && phase < 2) continue
      pool.push(TRAITS[i].id)
    }
    var out = []
    while (out.length < 3 && pool.length) {
      var k = r.int(pool.length)
      // Exactly one keystone in the P2 pool, two in P3, 22% in P4+ (`05` §8).
      if (pool[k] === 'keystone') {
        var p = phase >= 4 ? 0.22 : phase >= 3 ? 0.10 : 0.05
        if (r.next() > p) { pool.splice(k, 1); continue }
      }
      out.push(pool[k])
      pool.splice(k, 1)
    }
    return out
  }

  function generateOffer (s, b, cand, opts) {
    var phase = phaseOf(s)
    var pid = cand.def ? cand.def.id : 'root_' + cand.region
    var r = C().rng(C().hash32(num(s.seed), 'offer', pid, Math.floor(num(s.t))))
    var traits = rollTraits(r, phase)
    if (opts && opts.traits) traits = opts.traits.slice()
    var beta = rollBeta(cand.guild, cand.def, traits, r)
    var q = qualityMult(b, cand.guild) * ((opts && opts.premium) || 1)
    var name = cand.def ? cand.def.name
      : 'the ' + speciesAt(s, cand.region).name.toLowerCase() + ' at ' + regionName(cand.region)

    var dislikes = []
    if (phase >= 5) {
      var k = r.int(PARTNERS.length)
      if (PARTNERS[k].id !== pid) dislikes.push(PARTNERS[k].id)
    }
    partnerRec(b, pid).dislikes = dislikes

    var o = {
      id: b.nextId++,
      partnerId: pid,
      guild: cand.guild,
      regionId: cand.region,
      name: name,
      beta: beta,
      traits: traits,
      quality: q,
      maxTerm: maxTerm(b, cand.guild),
      ch: 1,
      termPeriods: Math.min(2, maxTerm(b, cand.guild)),
      rootType: 0,
      boundTo: (opts && opts.boundTo) || null,
      expiresAt: num(s.t) + PB.OFFER_LIFE,
      note: cand.def ? cand.def.note : 'a stand that will trade minerals for sugar'
    }
    if (phase >= 4 && !o.boundTo && r.next() < PB.CROSS_RATE) {
      var act = activePacts(b)
      if (act.length) {
        o.boundTo = act[r.int(act.length)].id
        o.quality *= PB.CROSS_PREMIUM
      }
    }
    b.offers.push(o)
    b.lastOfferAt = num(s.t)
    return o
  }

  // Three offers are generated by what the player has been doing rather than by the pool. These are
  // the offers players remember, and they cost about twenty lines.
  function behaviouralOffer (s, b, phase) {
    var i, g
    // Three breaches in one guild: a hand extended. The threshold is measured from the STARTING
    // reputation, not from the ceiling — against the ceiling it is true on the first frame of the
    // act and every offer in the run comes from the lowest-numbered guild.
    for (g = 0; g < NGUILD; g++) {
      if (num(b.guildRep[g]) > PB.REP_START - PB.REP_BREACH_GUILD * PB.MERCY_BREACHES) continue
      if (GUILDS[g].phase > phase) continue
      var pool = candidatePool(s, b, phase)
      for (i = 0; i < pool.length; i++) {
        if (pool[i].guild !== g) continue
        return generateOffer(s, b, pool[i],
          { traits: ['patient', 'generous', rollTraits(rng(), phase)[0]], premium: PB.MERCY_PREMIUM })
      }
    }
    // Book β1 magnitude sustained: here is your hedge.
    if (b.betaHighSince > 0 && num(s.t) - b.betaHighSince > PB.HEDGE_HOLD) {
      b.betaHighSince = 0
      var bry = null, p2 = candidatePool(s, b, phase)
      for (i = 0; i < p2.length; i++) if (p2[i].def && p2[i].def.id === 'bryoria') bry = p2[i]
      if (bry) return generateOffer(s, b, bry, {})
    }
    // Sustained commitment: you like commitment, here is more.
    if (b.stableSince > 0 && num(s.t) - b.stableSince > PB.COMMIT_HOLD &&
        totalChannels(b) >= PB.COMMIT_CH && phase >= 4) {
      b.stableSince = num(s.t)
      var act = activePacts(b), biggest = null
      for (i = 0; i < act.length; i++) if (!biggest || act[i].ch > biggest.ch) biggest = act[i]
      var p3 = candidatePool(s, b, phase)
      if (biggest && p3.length) {
        return generateOffer(s, b, weightedPick(p3, rng()) || p3[0],
          { boundTo: biggest.id, premium: PB.COMMIT_PREMIUM })
      }
    }
    return null
  }

  function maybeGenerateOffer (s, b, o) {
    if (o && o.offline) return null            // offers do not generate offline; the pool refreshes
    if (b.quietUntil > s.t) return null        // THE QUIET: 400 s in which nothing arrives
    var i
    for (i = b.offers.length - 1; i >= 0; i--) {
      if (num(b.offers[i].expiresAt) <= num(s.t)) {
        partnerRec(b, b.offers[i].partnerId).refuseUntil = num(s.t) + PB.OFFER_EXPIRE_REFUSE
        b.offers.splice(i, 1)
      }
    }
    if (b.offers.length >= PB.OFFER_MAX) return null
    if (activePacts(b).length >= slots(s)) return null
    var gap = PB.OFFER_GAP * (1 + PB.OFFER_DECLINE_K * num(b.declines))
    if (num(s.t) < num(b.lastOfferAt) + gap) return null
    var phase = phaseOf(s)
    var beh = behaviouralOffer(s, b, phase)
    if (beh) return beh
    var pool = candidatePool(s, b, phase)
    var pick = weightedPick(pool, rng())
    if (!pick) return null
    return generateOffer(s, b, pick, {})
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 14 · writeLedgers — the only allocation in the tick
  // ───────────────────────────────────────────────────────────────────────────

  var ledgers = {}

  function writeLedgers (s, b) {
    var act = activePacts(b), i
    var slot = Math.floor(num(s.t)) % PB.LEDGER_N
    for (i = 0; i < act.length; i++) {
      var p = act[i]
      if (!ledgers[p.id] || ledgers[p.id].length !== PB.LEDGER_N) {
        ledgers[p.id] = new Float32Array(PB.LEDGER_N)
      }
      ledgers[p.id][slot] = p.guild === BROOD ? num(p.rate) : num(p.yield)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCRIPTED SHOCKS — `05` §11.4. One per act-third, because a designed first experience of each
  // failure mode is worth more than a random one.
  // ───────────────────────────────────────────────────────────────────────────

  function maybeShocks (s, b) {
    var c = fc(s), i
    if (!(b.shocksFired & 1) && c >= PB.SHOCK_DRY_FC) {
      for (i = 0; i < b.pacts.length; i++) {
        if (live(b.pacts[i]) && bondOf(b.pacts[i]) >= PB.SHOCK_DRY_BOND) {
          b.shocksFired |= 1
          b.dryFrom = num(s.t)
          b.dryUntil = num(s.t) + PB.DRY_LEN
          break
        }
      }
    }
    if (!(b.shocksFired & 2) && c >= PB.SHOCK_TURN_FC) {
      b.shocksFired |= 2
      b.turnOffset = PB.TURN_DROP
      b.turnUntil = num(s.t) + PB.TURN_LEN
    }
    if (!(b.shocksFired & 4) && c >= PB.SHOCK_QUIET_FC) {
      b.shocksFired |= 4
      b.quietUntil = num(s.t) + PB.QUIET_LEN
    }
  }

  // Inter-partner demands, P5. Generated from tolerance conflicts and from the per-partner
  // `dislikes[]` list rolled at generation: "one of us."
  function maybeInterDemand (s, b) {
    if (phaseOf(s) < 5) return null
    if (num(s.t) < num(b.lastDemandAt) + PB.DEMAND_GAP) return null
    var act = activePacts(b), i, k
    for (i = 0; i < act.length; i++) {
      var p = act[i]
      if (bondOf(p) < 0.7 || p.demandAbout) continue
      var dis = partnerRec(b, p.partnerId).dislikes || []
      for (k = 0; k < act.length; k++) {
        var q = act[k]
        if (q === p) continue
        // Brokering is permanent: a RECONCILEd pair never argues again, whatever the table says.
        if (reconciledPair(b, p.partnerId, q.partnerId)) continue
        var conflict = dis.indexOf(q.partnerId) >= 0 ||
          (q.guild === p.guild && guildCount(b, p.guild) > toleranceOf(p))
        if (!conflict) continue
        p.demandAbout = { pactId: q.id, at: num(s.t), name: q.name }
        b.lastDemandAt = num(s.t)
        return p
      }
    }
    return null
  }

  function resolveInterDemands (s, b) {
    var act = activePacts(b), i
    for (i = 0; i < act.length; i++) {
      var p = act[i]
      if (!p.demandAbout) continue
      var q = byId(b, p.demandAbout.pactId)
      if (!q || !live(q)) { p.demandAbout = null; continue }
      if (num(s.t) - p.demandAbout.at >= PB.DEMAND_WINDOW) {
        p.strain = C().clamp(num(p.strain) + PB.DEMAND_STRAIN, 0, 1)
        p.demandAbout = null
      }
    }
  }

  // Behavioural bookkeeping the offer generator reads.
  function trackBehaviour (s, b, dt) {
    var e = bookExposure(s)
    if (Math.abs(e.beta[0]) > PB.HEDGE_TRIGGER) {
      if (!b.betaHighSince) b.betaHighSince = num(s.t)
    } else b.betaHighSince = 0
    if (!b.stableSince) b.stableSince = num(s.t)
    void dt
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE FOURTEEN SUB-STEPS — `05` §19.1, in that exact order
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Order matters. Get it wrong and strain oscillates: step 8 reads `demandMet` from step 4, and
  // step 7 reads the `shockMult` step 2 wrote and step 5/6 consumed.

  function stepPacts (dtSlow, opts) {
    var s = S()
    if (!s || s.act !== 2 || !(dtSlow > 0)) return
    var b = ensure(s)
    if (!b || !b.slots) return
    var o = opts || { stochastic: true, offline: false }
    var act, i

    // 1 · recomputeFactors
    recomputeFactors(s)
    b.phase = phaseOf(s)
    maybeShocks(s, b)

    // 2 · per pact: shockMult, envStress, adverse
    act = activePacts(b)
    for (i = 0; i < act.length; i++) {
      var d = dot(act[i].beta)
      act[i].shock = C().clamp(1 + PB.SHOCK_GAIN * d, PB.SHOCK_LO, PB.SHOCK_HI)
      act[i].envStress = Math.max(0, -d) * PB.ENV_STRESS_K
      act[i].adverse = Math.max(0, -d)
    }

    // 3 · recomputeCosts
    recomputeCosts(s, b)

    // 4 · chargeCosts
    chargeCosts(s, b, dtSlow)

    // 5 · per pact: yield_p   (written inside applyYields, which is step 6's first act)
    // 6 · applyYields
    applyYields(s, b, dtSlow, o)

    // 7 · rollBroodDeliveries — after yields, so shockMult is current
    rollBroodDeliveries(s, b, dtSlow, o)

    // 8 · updateStrain — uses demandMet from step 4
    updateStrain(s, b, dtSlow, o)
    resolveInterDemands(s, b)

    // 9 · checkLadder
    checkLadder(s, b, dtSlow, o)

    // 10 · accrueAccord — uses adverse from step 2
    accrueAccord(s, b, dtSlow, o)

    // 11 · advanceTenure
    advanceTenure(s, b, dtSlow)

    // 12 · checkExpiry
    checkExpiry(s, b)

    // 13 · maybeGenerateOffer
    maybeInterDemand(s, b)
    // The behavioural triggers describe what the PLAYER has been doing; while they are away they
    // have done nothing, and the exposure scan they need is the most expensive read in the tick.
    if (!(o && o.offline)) trackBehaviour(s, b, dtSlow)
    maybeGenerateOffer(s, b, o)

    // 14 · writeLedgers
    writeLedgers(s, b)
  }

  // loop.js drives this every sim tick (BIBLE §4 step 8). The Pact Book runs at 0.5 Hz, so the
  // remainder is carried rather than dropped.
  //
  // Offline takes one strategic step per macro-step rather than sub-dividing it. BIBLE §4.1 already
  // fixes the offline granularity at 240 steps of `effective/240`, and every term this module
  // accumulates — strain, tenure, ACCORD, the BROOD expected value — is linear in dt, so
  // sub-dividing a 66-second macro-step into thirty-three identical two-second ones changes no
  // number and costs 30× the work. Measured: 497 ms → 12 ms for a twelve-hour reconcile, against
  // BIBLE §4.1's ≤ 40 ms budget.
  function step (dt, opts) {
    var s = S()
    if (!s || s.act !== 2 || !(dt > 0)) return
    if (opts && opts.offline) { stepPacts(dt, opts); return }
    acc += dt
    var n = 0
    while (acc >= PB.SLOW_DT && n < PB.MAX_SUB) {
      stepPacts(PB.SLOW_DT, opts)
      acc -= PB.SLOW_DT
      n++
    }
    if (acc >= PB.SLOW_DT) { stepPacts(acc, opts); acc = 0 }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE COMMAND SURFACE — every player verb. UI never mutates state directly.
  // ───────────────────────────────────────────────────────────────────────────

  function stakeRequired (s, ch, termPeriods) {
    return PB.STAKE_K * grossRate(s) * PB.STAKE_S * ch * (1 + PB.STAKE_TERM * termPeriods)
  }

  function setOfferChannels (offerId, n) {
    var s = S(), b = ensure(s)
    var o = offerById(b, offerId)
    if (!o) return false
    o.ch = C().clamp(Math.round(n), 1, Math.min(PB.CH_MAX_PER_PACT, Math.max(1, channelsFree(s))))
    return o.ch
  }

  function setOfferTerm (offerId, n) {
    var s = S(), b = ensure(s)
    var o = offerById(b, offerId)
    if (!o) return false
    o.termPeriods = C().clamp(Math.round(n), PB.TERM_MIN, o.maxTerm)
    return o.termPeriods
  }

  function setOfferType (offerId, typeKey) {
    var s = S(), b = ensure(s)
    var o = offerById(b, offerId)
    if (!o || o.guild !== ROOT) return false
    var i
    for (i = 0; i < ROOT_TYPES.length; i++) if (ROOT_TYPES[i].key === typeKey) { o.rootType = i; return i }
    return false
  }

  function sign (offerId, ch, termPeriods) {
    var s = S()
    if (!s || s.act !== 2) return null
    var b = ensure(s)
    var o = offerById(b, offerId)
    if (!o) return null
    if (activePacts(b).length >= slots(s)) return null
    var want = C().clamp(Math.round(ch === undefined ? o.ch : ch), 1, PB.CH_MAX_PER_PACT)
    if (want > channelsFree(s)) return null
    var term = C().clamp(Math.round(termPeriods === undefined ? o.termPeriods : termPeriods),
      PB.TERM_MIN, o.maxTerm)
    var stake = stakeRequired(s, want, term)
    if (num(s.res.biomass) < stake) return null
    C().setStock(s.res, 'biomass', num(s.res.biomass) - stake)

    var p = {
      id: b.nextId++,
      partnerId: o.partnerId,
      guild: o.guild,
      regionId: o.regionId,
      name: o.name,
      rootType: o.rootType || 0,
      ch: want,
      tenure: o.traits.indexOf('old') >= 0 ? TRAIT_OLD_TENURE : 0,
      cumTenure: o.traits.indexOf('old') >= 0 ? TRAIT_OLD_TENURE : 0,
      strain: 0,
      stake: stake,
      termPeriods: term,
      signedAt: num(s.t),
      endsAt: num(s.t) + term * A().TERM_PERIOD_S,
      beta: o.beta.slice(),
      traits: o.traits.slice(),
      quality: o.quality,
      known: 0,
      noticeAt: null,
      accordPaid: 0,
      boundTo: o.boundTo || null,
      mutedUntil: 0,
      holdAt: 0,
      demandMet: 1,
      state: 'active',
      bond: 0,
      order: b.pacts.length
    }
    b.pacts.push(p)
    b.offers.splice(b.offers.indexOf(o), 1)
    partnerRec(b, p.partnerId).everSigned = 1
    b.stableSince = num(s.t)
    stat(s, 'contractsSigned', 1)
    fire('a2.first_pact', { partner: p.name })
    if (p.guild === GHOST) fire('a2.ghost', { partner: p.name, guild: 'ghost' })
    feel('pact_sign', { guild: guildOf(p).key })
    return p
  }

  function declineOffer (offerId) {
    var s = S(), b = ensure(s)
    var o = offerById(b, offerId)
    if (!o) return false
    partnerRec(b, o.partnerId).refuseUntil = num(s.t) + PB.OFFER_DECLINE_REFUSE
    b.declines = num(b.declines) + 1
    b.offers.splice(b.offers.indexOf(o), 1)
    return true
  }

  // `05` §3.3. Read the direction carefully, because it is counter-intuitive and it is the point:
  // wide pacts are cheap to adjust, narrow ones are expensive. Your big positions are your flexible
  // ones, which inverts the usual incremental-game intuition and gives experts something to know.
  function setChannels (pactId, n) {
    var s = S()
    if (!s || s.act !== 2) return null
    var b = ensure(s)
    var p = byId(b, pactId)
    if (!p || !live(p)) return null
    var old = num(p.ch)
    var free = channelsFree(s) + old
    var want = C().clamp(Math.round(n), 0, Math.min(PB.CH_MAX_PER_PACT, free))
    if (want === old) return null
    var token = { id: ++undoSeq, pactId: pactId, ch: old, tenure: num(p.tenure) }
    undos[token.id] = token

    var delta = Math.abs(want - old)
    p.ch = want
    // Setting ch = 0 does NOT apply the penalty formula; it applies neglect, which drives strain to
    // 1.0 in about 140 seconds. A parked pact dies. There is no free storage.
    if (want > 0) {
      p.tenure = num(p.tenure) * Math.exp(-num(b.plasticity) * delta / Math.max(1, old))
    }
    p.bond = bondOf(p)
    stat(s, 'reallocations', 1)
    b.stableSince = num(s.t)
    feel('pact_scrub', { ch: want })
    return token
  }

  // The UNDO toast is essential because the action costs tenure. It restores the exact prior value,
  // not a recomputed one.
  function undo (token) {
    var s = S(), b = ensure(s)
    var t = token && token.id ? undos[token.id] : null
    if (!t) return false
    var p = byId(b, t.pactId)
    if (!p) return false
    p.ch = t.ch
    p.tenure = t.tenure
    p.bond = bondOf(p)
    stat(s, 'reallocations', -1)
    delete undos[t.id]
    return true
  }

  function sever (pactId) {
    var s = S()
    if (!s || s.act !== 2) return false
    var b = ensure(s)
    var p = byId(b, pactId)
    if (!p || !live(p)) return false
    var cost = severCost(p)
    if (num(s.res.accord) < cost) return false
    C().setStock(s.res, 'accord', num(s.res.accord) - cost)
    returnStake(s, p)
    p.state = 'severed'
    b.guildRep[p.guild] = C().clamp(b.guildRep[p.guild] - PB.REP_SEVER_GUILD, 0, PB.REP_MAX)
    partnerRec(b, p.partnerId).refuseUntil = num(s.t) + 300
    partnerRec(b, p.partnerId).grudge = 0
    var i
    for (i = 0; i < b.pacts.length; i++) if (b.pacts[i].demandAbout &&
      b.pacts[i].demandAbout.pactId === pactId) b.pacts[i].demandAbout = null
    feel('pact_sever', { guild: guildOf(p).key })
    return cost
  }

  // Complying is often correct and never automatic. GHOST's inability to be appeased is the guild's
  // whole character: you cannot buy a parasite's goodwill, you can only change the weather it lives
  // in — i.e. rebalance the book.
  function comply (pactId) {
    var s = S()
    if (!s || s.act !== 2) return false
    var b = ensure(s)
    var p = byId(b, pactId)
    if (!p || p.state !== 'notice') return false
    if (num(s.t) - num(p.noticeAt) > PB.NOTICE_WINDOW) return false
    var d = DEMANDS[p.guild]
    if (d.kind === 'none') return false
    if (d.kind === 'biomass') {
      var cost = d.costFrac * num(s.res.biomass)
      if (!(cost > 0)) return false
      C().setStock(s.res, 'biomass', num(s.res.biomass) - cost)
    } else if (d.kind === 'channel') {
      if (channelsFree(s) < 1) return false
      p.ch = Math.min(PB.CH_MAX_PER_PACT, p.ch + 1)
      p.chReturnAt = num(s.t) + DEMAND_CH_HOLD
    } else if (d.kind === 'term') {
      p.termPeriods = Math.min(PB.TERM_MAX, p.termPeriods + 2)
      p.endsAt = num(p.endsAt) + 2 * A().TERM_PERIOD_S
    } else if (d.kind === 'land') {
      var r = s.a2.regions, i, gave = -1
      for (i = 0; i < r.flags.length; i++) {
        if ((r.flags[i] & 4) && num(r.rivalStr[i]) > 0) { gave = i; break }
      }
      if (gave < 0) return false
      r.flags[gave] &= ~4
      r.d[gave] = 0; r.col[gave] = 0
    }
    p.strain = C().clamp(num(p.strain) - d.relief, 0, 1)
    p.state = 'active'
    p.noticeAt = null
    p.holdAt = 0
    resolveNotice(s, b, p)
    feel('pact_comply', { guild: guildOf(p).key })
    return true
  }

  function renew (pactId, termPeriods) {
    var s = S()
    if (!s || s.act !== 2) return false
    var b = ensure(s)
    var p = byId(b, pactId)
    if (!p || !live(p)) return false
    if (num(s.t) < num(p.endsAt)) return false
    var phase = phaseOf(s)
    grantAccord(s, b, p, honourAccord(p, phase))
    stat(s, 'pactsHonoured', 1)
    if (phase >= 6) b.honouredP6 = num(b.honouredP6) + 1
    b.guildRep[p.guild] = C().clamp(b.guildRep[p.guild] + PB.REP_HONOUR_GUILD, 0, PB.REP_MAX)
    b.bookRep = C().clamp(b.bookRep + PB.REP_HONOUR_BOOK, 0, PB.REP_MAX)
    p.termPeriods = C().clamp(Math.round(termPeriods === undefined ? p.termPeriods : termPeriods),
      PB.TERM_MIN, maxTerm(b, p.guild))
    p.signedAt = num(s.t)
    p.endsAt = num(s.t) + p.termPeriods * A().TERM_PERIOD_S
    p.renewUntil = undefined
    feel('pact_renew', { guild: guildOf(p).key })
    return true
  }

  function buyChannel () {
    var s = S()
    if (!s || s.act !== 2) return false
    var b = ensure(s)
    var cost = channelCost(s)
    if (!isFinite(cost) || num(s.res.accord) < cost) return false
    C().setStock(s.res, 'accord', num(s.res.accord) - cost)
    b.accordChannels = num(b.accordChannels) + 1
    feel('pact_channel', { n: b.accordChannels })
    if (HY.log && HY.log.bought) HY.log.bought('channel')
    return cost
  }

  function reconcileCost (a, c) {
    var s = S(), b = ensure(s)
    var pa = byId(b, a), pb = byId(b, c)
    if (!pa || !pb) return Infinity
    return Math.ceil(A().RECONCILE_K * (1 + num(pa.strain) + num(pb.strain)))
  }

  function reconcile (a, c) {
    var s = S()
    if (!s || s.act !== 2) return false
    var b = ensure(s)
    if (phaseOf(s) < 5) return false
    var pa = byId(b, a), pb = byId(b, c)
    if (!pa || !pb || pa === pb) return false
    var cost = reconcileCost(a, c)
    if (num(s.res.accord) < cost) return false
    C().setStock(s.res, 'accord', num(s.res.accord) - cost)
    b.reconciled.push([pa.partnerId, pb.partnerId])
    dropDislike(b, pa.partnerId, pb.partnerId)
    dropDislike(b, pb.partnerId, pa.partnerId)
    return cost
  }

  function dropDislike (b, from, to) {
    var rec = partnerRec(b, from)
    var k = rec.dislikes.indexOf(to)
    if (k >= 0) rec.dislikes.splice(k, 1)
  }

  function reconciledPair (b, a, c) {
    var i
    for (i = 0; i < b.reconciled.length; i++) {
      var r = b.reconciled[i]
      if ((r[0] === a && r[1] === c) || (r[0] === c && r[1] === a)) return true
    }
    return false
  }

  function triangleCost (a, c, d) {
    var s = S(), b = ensure(s)
    var ps = [byId(b, a), byId(b, c), byId(b, d)], i, st = 0, bo = 0
    for (i = 0; i < 3; i++) {
      if (!ps[i]) return Infinity
      st += num(ps[i].strain); bo += bondOf(ps[i])
    }
    return Math.ceil(A().TRIANGLE_K * (3 + st) / (1 + bo / 3))
  }

  // A stronger, more fragile machine: +18% on typically 60% of the book against a doubled tail risk
  // on three positions. Leverage — not the word, the thing.
  function triangle (a, c, d) {
    var s = S()
    if (!s || s.act !== 2) return false
    var b = ensure(s)
    if (phaseOf(s) < 5) return false
    if (a === c || c === d || a === d) return false
    var ps = [byId(b, a), byId(b, c), byId(b, d)], i
    for (i = 0; i < 3; i++) if (!ps[i] || ps[i].state !== 'active') return false
    if (isTriangled(b, a) || isTriangled(b, c) || isTriangled(b, d)) return false
    var cost = triangleCost(a, c, d)
    if (num(s.res.accord) < cost) return false
    C().setStock(s.res, 'accord', num(s.res.accord) - cost)
    b.triangles.push([a, c, d])
    return cost
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FACTORS AND EXPOSURE — `05` §5.5, §5.6
  // ───────────────────────────────────────────────────────────────────────────

  function factors (st) {
    var s = st || S()
    if (s && s.a2) recomputeFactors(s)
    var out = [], i
    for (i = 0; i < NFACTOR; i++) out.push({ key: FACTOR_NAME[i], short: FACTOR_SHORT[i], value: F[i] })
    return out
  }

  function bookMultWith (b, over) {
    var act = activePacts(b), i, k, total = totalChannels(b)
    if (!(total > 0)) return { beta: [0, 0, 0, 0, 0], mult: 1 }
    var beta = [0, 0, 0, 0, 0], mult = 0
    for (i = 0; i < act.length; i++) {
      var p = act[i]
      var share = p.ch / total
      var d = 0
      for (k = 0; k < NFACTOR; k++) {
        beta[k] += share * num(p.beta[k])
        d += num(p.beta[k]) * (over && over[k] !== undefined ? over[k] : F[k])
      }
      mult += share * C().clamp(1 + PB.SHOCK_GAIN * d, PB.SHOCK_LO, PB.SHOCK_HI)
    }
    return { beta: beta, mult: mult }
  }

  // Three canned scenarios, each recomputing bookMult with one factor forced. A risk report a phone
  // can show in three lines. It is the first thing an expert reads and the last thing a novice
  // understands, and the gap between those two facts is where the hours live.
  function bookExposure (st) {
    var s = st || S()
    if (!s || !s.a2) return { beta: [0, 0, 0, 0, 0], mult: 1, tests: [], factors: [], perPact: [] }
    var b = ensure(s)
    recomputeFactors(s)
    var base = bookMultWith(b, null)

    var wP15 = A().OU_MEAN
    if (HY.flush && HY.flush.forecast) {
      var f = HY.flush.forecast(300)
      wP15 = num(f.mean) - 1.04 * num(f.sd)
    }
    var dry = bookMultWith(b, { 0: f1From(wP15) }).mult
    var gone = bookMultWith(b, { 1: -0.90 }).mult
    var trough = bookMultWith(b, { 2: -1.00 }).mult

    var act = activePacts(b), i, k, per = []
    for (i = 0; i < act.length; i++) {
      var row = { id: act[i].id, name: act[i].name, glyph: guildOf(act[i]).glyph, beta: [] }
      var vis = betaState(s, b, act[i])
      for (k = 0; k < NFACTOR; k++) {
        row.beta.push(vis === 'opaque' ? null
          : vis === 'prior' ? GUILDS[act[i].guild].beta[k]
            : num(act[i].beta[k]))
      }
      row.state = vis
      per.push(row)
    }

    return {
      beta: base.beta,
      mult: base.mult,
      factors: F.slice(),
      names: FACTOR_NAME,
      shorts: FACTOR_SHORT,
      tests: [
        { label: 'if it dries out', mult: dry },
        { label: 'if the canopy goes', mult: gone },
        { label: 'at the trough', mult: trough }
      ],
      perPact: per,
      forecast: HY.flush && HY.flush.forecast ? HY.flush.forecast(300) : null
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE PHONE READOUTS — `05` §13
  // ───────────────────────────────────────────────────────────────────────────
  //
  // This module is a `sim/*` module and builds no DOM (BIBLE §6: no sim module may import a ui
  // module). What it exports instead is the exact card model of §13.2 — five rows, one 44 px touch
  // strip, an 8-character value slot and a full `aria-label` — so the view layer is transcription
  // and every number on screen has exactly one source.

  function pips (n, max) {
    var out = '', i
    for (i = 0; i < max; i++) out += i < n ? '●' : '○'
    return out
  }

  function bar (frac, width) {
    var w = width || 10
    var n = Math.round(C().clamp(frac, 0, 1) * w), out = '', i
    for (i = 0; i < w; i++) out += i < n ? '█' : '░'
    return out
  }

  function caretFor (d) {
    var m = Math.abs(d) * 100
    var n = m < 0.05 ? 0 : m < 0.20 ? 1 : m < 0.60 ? 2 : 3
    if (!n) return ''
    var ch = d > 0 ? '▲' : '▼', out = '', i
    for (i = 0; i < n; i++) out += ch
    return out
  }

  function fmt (v) { return C().fmt(v) }

  // THE NUMBER ONLY. Its unit is the guild's, and GUILDS has carried the right string for all six
  // since it was written — while this function hand-rolled six notations that between them led
  // with the glyph (`Ψ 0.30/s`, `⛬ 37.1/s` — nothing else in the game puts the unit first), glued
  // the `/s` to the digits, and left RIVAL as `−0.0030/s`, a rate naming no quantity at all. All
  // six then landed whole in the mantissa, so none of it drew dim — one row under this panel's
  // own `book cost 18.7 M g/s`, which does. 06 §3.3: the caller states the boundary, and the
  // boundary is after the number.
  function rateText (s, p) {
    void s
    if (p.guild === BROOD) return '+' + (num(p.rate) / Math.max(1e-9, gross)).toFixed(2)
    if (p.guild === NODULE || p.guild === CROWN) return '+' + (num(p.yield)).toFixed(2)
    if (p.guild === RIVAL) return '−' + (num(p.yield)).toFixed(4)
    return fmt(num(p.yield))
  }

  function rateUnit (p) { return guildOf(p).unit }

  function traitCells (s, b, p) {
    var out = [], i
    for (i = 0; i < 3; i++) {
      if (p.known & (1 << i)) {
        var t = TRAIT_BY_ID[p.traits[i]]
        out.push({ known: true, id: p.traits[i], label: t ? t.label : p.traits[i], line: t ? t.line : '' })
      } else {
        out.push({ known: false, at: Math.round(revealThresholds(b)[i]) })
      }
    }
    void s
    return out
  }

  function termLeft (s, p) {
    return Math.max(0, num(p.endsAt) - num(s.t))
  }

  function card (id) {
    var s = S()
    if (!s || !s.a2) return null
    var b = ensure(s)
    var p = byId(b, id)
    if (!p) return null
    var g = guildOf(p)
    var st = C().clamp(num(p.strain), 0, 1)
    var ledger = ledgers[p.id]
    var spark = [], i
    if (ledger) for (i = 0; i < PB.LEDGER_N; i++) spark.push(ledger[i])
    var chMax = Math.min(PB.CH_MAX_PER_PACT, channelCap(s))
    var m = {
      id: p.id,
      guild: g.key,
      glyph: g.glyph,
      name: p.name,
      note: p.state,
      state: p.state,
      ch: num(p.ch),
      chMax: chMax,
      pips: pips(num(p.ch), chMax),
      rate: p.guild === BROOD ? num(p.rate) : num(p.yield),
      rateText: rateText(s, p),
      rateUnit: rateUnit(p),
      spark: spark,
      bond: bondOf(p),
      bondMult: bondMultOf(p),
      bondBar: bar(bondOf(p)),
      strain: st,
      strainBar: bar(st),
      strainTicks: [PB.WARN_AT, PB.NOTICE_AT, 1],
      caret: caretFor(num(p.dStrain)),
      warn: st >= PB.WARN_AT,
      traits: traitCells(s, b, p),
      termLeft: termLeft(s, p),
      termPeriods: num(p.termPeriods),
      notice: p.state === 'notice'
        ? { left: Math.max(0, PB.NOTICE_WINDOW - (num(s.t) - num(p.noticeAt))),
          demand: DEMANDS[p.guild].text, can: DEMANDS[p.guild].kind !== 'none' }
        : null,
      demandAbout: p.demandAbout
        ? { name: p.demandAbout.name,
          left: Math.max(0, PB.DEMAND_WINDOW - (num(s.t) - p.demandAbout.at)) }
        : null,
      boundTo: p.boundTo ? (byId(b, p.boundTo) || { name: 'a pact that is gone' }).name : null,
      severCost: severCost(p),
      renewable: num(s.t) >= num(p.endsAt),
      cost: num(p.cost)
    }
    m.aria = m.name + ', ' + g.label + ' guild, ' + m.ch + ' of ' + chMax + ' channels, ' +
      (m.rateText + ' ' + m.rateUnit).replace('×', ' times ') +
      ', bond ' + m.bondMult.toFixed(2) + ' times, strain ' +
      st.toFixed(2) + ' ' + (num(p.dStrain) > 0 ? 'rising' : 'falling') + ', ' +
      Math.round(m.termLeft / 60) + ' minutes remaining'
    return m
  }

  function list () {
    var s = S()
    if (!s || !s.a2) return []
    var b = ensure(s)
    var out = [], i
    for (i = 0; i < b.pacts.length; i++) {
      var c = card(b.pacts[i].id)
      if (c) out.push(c)
    }
    return out
  }

  function header () {
    var s = S()
    if (!s || !s.a2) return null
    var b = ensure(s)
    var cap = channelCap(s)
    var used = totalChannels(b)
    return {
      accord: num(s.res.accord),
      channels: used,
      channelCap: cap,
      channelPips: pips(used, cap),
      locked: num(b.chLocked),
      slots: slots(s),
      pacts: activePacts(b).length,
      congestion: congestion,
      cost: bookCost,
      costFrac: gross > 0 ? bookCost / gross : 0,
      bookMult: bookExposure(s).mult,
      channelCost: channelCost(s),
      accordChannels: num(b.accordChannels),
      accordChannelsMax: PB.ACCORD_CH_MAX,
      offers: b.offers.length,
      phase: phaseOf(s),
      passive: passiveMineral(s)
    }
  }

  function detail (id) {
    var s = S()
    if (!s || !s.a2) return null
    var b = ensure(s)
    var p = byId(b, id)
    if (!p) return null
    var c = card(id)
    var tm = p.strainTerms || strainTerms(s, b, p)
    var vis = betaState(s, b, p)
    var rows = [], k
    for (k = 0; k < NFACTOR; k++) {
      rows.push({
        name: FACTOR_NAME[k],
        value: vis === 'opaque' ? null : vis === 'prior' ? GUILDS[p.guild].beta[k] : num(p.beta[k]),
        band: vis === 'banded' ? PB.BETA_SD : 0,
        state: vis
      })
    }
    c.strainBreakdown = [
      { label: 'unpaid', v: tm.unpaid },
      { label: 'exposure', v: tm.exposure },
      { label: 'crowding', v: tm.crowding },
      { label: 'neglect', v: tm.neglect },
      { label: 'bond relief', v: tm.relief },
      { label: 'baseline', v: tm.baseline },
      { label: 'net', v: tm.net * PB.STRAIN_RATE * 100 }
    ]
    c.exposure = rows
    c.deliveries = (p.gaps || []).slice()
    c.stake = num(p.stake)
    c.paid = num(p.accordPaid)
    c.costShare = bookCost > 0 ? num(p.cost) / bookCost : 0
    c.partnerNote = (partnerDef(p.partnerId) || {}).note || ''
    c.rootType = p.guild === ROOT ? ROOT_TYPES[num(p.rootType)].label : null
    return c
  }

  function offers () {
    var s = S()
    if (!s || !s.a2) return []
    var b = ensure(s)
    var out = [], i
    for (i = 0; i < b.offers.length; i++) {
      var o = b.offers[i]
      var g = GUILDS[o.guild]
      out.push({
        id: o.id,
        guild: g.key,
        glyph: g.glyph,
        name: o.name,
        note: o.note,
        ch: o.ch,
        chMax: Math.min(PB.CH_MAX_PER_PACT, Math.max(1, channelsFree(s))),
        termPeriods: o.termPeriods,
        maxTerm: o.maxTerm,
        rootTypes: o.guild === ROOT ? ROOT_TYPES.map(function (t) { return t.label }) : null,
        rootType: o.guild === ROOT ? ROOT_TYPES[o.rootType].label : null,
        boundTo: o.boundTo ? (byId(b, o.boundTo) || { name: 'a pact that is gone' }).name : null,
        stake: stakeRequired(s, o.ch, o.termPeriods),
        affordable: num(s.res.biomass) >= stakeRequired(s, o.ch, o.termPeriods) &&
          o.ch <= channelsFree(s) && activePacts(b).length < slots(s),
        left: Math.max(0, num(o.expiresAt) - num(s.t)),
        prior: GUILDS[o.guild].beta.slice(),
        aria: o.name + ', ' + g.label + ' guild offer, ' + o.ch + ' channels, ' +
          o.termPeriods + ' terms, ' + Math.round((num(o.expiresAt) - num(s.t)) / 60) +
          ' minutes to decide'
      })
    }
    return out
  }

  // The pip strip is the hero interaction and it is a slider disguised as pips: on a phone, two
  // 24 px buttons are a worse target than one 44 px strip, and dragging lets the player feel the
  // yield curve — sublinear for a ROOT pact, superlinear for a BROOD one. That is how the α table
  // gets taught, without a single word.
  function scrub (pactId, x, width) {
    var s = S()
    if (!s) return null
    var b = ensure(s)
    var p = byId(b, pactId)
    if (!p || !(width > 0)) return null
    var chMax = Math.min(PB.CH_MAX_PER_PACT, channelCap(s))
    var want = C().clamp(Math.round(x / width * chMax), 0, Math.min(chMax, channelsFree(s) + p.ch))
    var was = p.ch
    p.ch = want
    var preview = { ch: want, rate: yieldOf(s, b, p), rateText: rateText(s, p), rateUnit: rateUnit(p) }
    p.ch = was
    return preview
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CROSS-MODULE READS — forest.js, flush.js, log.js and projects.js call these
  // ───────────────────────────────────────────────────────────────────────────

  function regionHasPact (i) {
    var s = S()
    if (!s || s.act !== 2 || !s.a2) return false
    var b = ensure(s)
    var k = Math.floor(i)
    for (var j = 0; j < b.pacts.length; j++) {
      var p = b.pacts[j]
      if (!live(p)) continue
      // Only an INTERFACE ROOT pact sets `hasContract_i` — the ×1.50 on liveInterface is what the
      // player bought when they chose that type over minerals (`05` §4.1).
      if (p.guild === ROOT && p.regionId === k && num(p.rootType) === 1) return true
    }
    return false
  }

  function alarmRegion (i) {
    var s = S()
    if (!s || s.act !== 2 || !s.a2) return false
    var b = ensure(s)
    var k = Math.floor(i)
    for (var j = 0; j < b.pacts.length; j++) {
      var p = b.pacts[j]
      if (!live(p)) continue
      if (p.guild === ROOT && p.regionId === k && num(p.rootType) === 2) return true
    }
    return false
  }

  function forecastBonus () {
    var s = S()
    if (!s || s.act !== 2 || !s.a2) return 0
    var b = ensure(s)
    return num(b.crownFH)
  }

  function forecastBlind () {
    var s = S()
    if (!s || s.act !== 2 || !s.a2) return false
    return num(ensure(s).blindUntil) > num(s.t)
  }

  // A stand that burns, is retaken or is killed voids its pact instantly and permanently.
  function voidRegion (i) {
    var s = S()
    if (!s || !s.a2) return 0
    var b = ensure(s)
    var k = Math.floor(i), n = 0, j
    for (j = 0; j < b.pacts.length; j++) {
      var p = b.pacts[j]
      if (p.regionId !== k) continue
      if (!live(p)) continue
      if (!GUILDS[p.guild].bound) continue
      returnStake(s, p)
      p.state = 'lapsed'
      p.reapAt = num(s.t)
      n++
    }
    return n
  }

  function legacyTerm () {
    var s = S()
    if (!s || !s.a2) return 0
    var b = ensure(s)
    return PB.LEGACY_ACC_W * C().clamp(num(s.res.accordLifetime) / PB.LEGACY_ACC_REF, 0, 1) +
      PB.LEGACY_HONOUR * num(b.honouredP6) -
      PB.LEGACY_BREACH * num(b.breachedP6)
  }

  function maxStrain () {
    var s = S()
    if (!s || !s.a2) return 0
    var b = ensure(s), i, m = 0
    for (i = 0; i < b.pacts.length; i++) {
      if (live(b.pacts[i])) m = Math.max(m, num(b.pacts[i].strain))
    }
    return m
  }

  function pacts () {
    var s = S()
    if (!s || !s.a2) return []
    return activePacts(ensure(s))
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ───────────────────────────────────────────────────────────────────────────

  function init (st) {
    var s = st || S()
    if (!s) return
    ensure(s)
    acc = 0
    ledgers = {}
    undos = {}
    rand = C().rng(C().hash32(num(s.seed), 'pactbook'))
    if (s.a2) recomputeFactors(s)
  }

  function tick (s, dt, o) { void s; step(dt, o) }

  function serialise (s) { return ensure(s) }

  function migrate (save, from) {
    if (!save || !save.a2) return save
    if (!save.a2.pact || typeof save.a2.pact !== 'object') save.a2.pact = {}
    void from
    return save
  }

  // ASCOSPORE DISCHARGE revokes the act. forest.js has already emptied `a2.pact`; this drops every
  // derived cache so nothing survives into Act III.
  function reboot () {
    var s = S()
    acc = 0
    ledgers = {}
    undos = {}
    if (s && s.a2) { s.a2.pact = {}; ensure(s) }
    if (s && s.mult) { s.mult.ripenessFloor = 0 }
    F = [0, 0, 0, 0, 0]
    gross = 0; congestion = 1; bookCost = 0
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
      var s, b, i, k

      // ── a headless Act II with a claimed, living map ───────────────────────
      function world (seed) {
        HY.state.init(HY.state.newGame(seed || 90210, null))
        s = S()
        s.act = 2
        if (HY.world && HY.world.init) HY.world.init(s)
        if (HY.forest && HY.forest.init) HY.forest.init(s)
        if (HY.flush && HY.flush.init) HY.flush.init(s)
        if (HY.cognition && HY.cognition.init) HY.cognition.init(s)
        init(s)
        var r = s.a2.regions
        for (i = 0; i < 12; i++) { r.flags[i] |= 4 | 1 | 2; r.d[i] = 0.8; r.col[i] = 1 }
        C().setStock(s.res, 'biomass', 1e12)
        b = ensure(s)
        b.slots = 9
        b.projectChannels = 12
        s.proj.flags.pact_chemotaxis = 1
        return b
      }

      // A pact built by hand, so a strategy comparison is a comparison of DECISIONS and not of
      // partner rolls: same partner, same β, same traits, same region, only `ch` and count differ.
      function make (guild, ch, region, opts) {
        var o = opts || {}
        // The default partner is deliberately NOT one of the eighteen: a strategy comparison must
        // not silently pick up Frankia's ×1.60 bond constant.
        var p = {
          id: b.nextId++, partnerId: o.partnerId || 'harness_neutral',
          guild: guild, regionId: region === undefined ? -1 : region,
          name: 'test ' + guild + '/' + b.nextId, rootType: o.rootType || 0,
          ch: ch, tenure: o.tenure || 0, cumTenure: o.tenure || 0, strain: o.strain || 0,
          stake: 0, termPeriods: 6, signedAt: 0, endsAt: 1e9,
          beta: o.beta ? o.beta.slice() : [0, 0, 0, 0, 0],
          traits: o.traits ? o.traits.slice() : [], quality: 1,
          known: 0, noticeAt: null, accordPaid: 0, boundTo: null, mutedUntil: 0,
          holdAt: 0, demandMet: 1, state: 'active', bond: 0, order: 0
        }
        b.pacts.push(p)
        return p
      }

      function clearBook () { b.pacts.length = 0; b.offers.length = 0; b.triangles.length = 0 }

      // ── §3.2 the bond table, exactly ──────────────────────────────────────
      world()
      var probe = make(GHOST, 1, -1)
      var BONDS = [[0, 1.000], [120, 1.135], [300, 1.341], [600, 1.667], [900, 1.900],
        [1800, 2.360], [3600, 2.570]]
      for (i = 0; i < BONDS.length; i++) {
        probe.tenure = BONDS[i][0]
        // §3.2's table is printed to three decimals off a rounded `bond` column; the tolerance is
        // that rounding, not slack. The two endpoints are exact.
        near(bondMultOf(probe), BONDS[i][1], 0.025, 'bondMult at tenure ' + BONDS[i][0])
      }
      near(bondOf({ tenure: PB.TAU_BOND, partnerId: 'x', traits: [] }), 1 - Math.exp(-1), 1e-12,
        'bond at one tau is not 1 − 1/e')
      near(bondMultOf({ tenure: 0, partnerId: 'x', traits: [] }), 1.000, 1e-12, 'bondMult floor')
      near(bondMultOf({ tenure: 1e9, partnerId: 'x', traits: [] }), 1 + PB.BOND_K, 1e-9,
        'bondMult ceiling is not 1 + BOND_K')

      // ── §3.3 the tenure penalty table, and its counter-intuitive direction ─
      clearBook()
      var PEN = [[1, 1, 0.577], [1, 2, 0.333], [1, 3, 0.192], [2, 1, 0.760], [2, 2, 0.577],
        [3, 1, 0.832], [3, 2, 0.692], [3, 3, 0.577], [4, 1, 0.872], [4, 2, 0.760],
        [5, 1, 0.895], [5, 2, 0.801], [5, 3, 0.717]]
      for (i = 0; i < PEN.length; i++) {
        clearBook()
        var pp = make(GHOST, PEN[i][0], -1, { tenure: 1000 })
        // The penalty is |Δ|; at the 5-channel cap the only legal move of that size is downward,
        // and it must cost exactly the same.
        var up = PEN[i][0] + PEN[i][1], down = PEN[i][0] - PEN[i][1]
        var target = up <= PB.CH_MAX_PER_PACT ? up : down
        // A move to zero is neglect, not reallocation, and pays no tenure penalty at all — so the
        // one row whose only legal move is to zero is asserted against the closed form instead.
        if (target < 1) {
          near(Math.exp(-PB.PLASTICITY * PEN[i][1] / PEN[i][0]), PEN[i][2], 0.004,
            'tenure penalty ch ' + PEN[i][0] + ' Δ' + PEN[i][1])
          continue
        }
        setChannels(pp.id, target)
        near(pp.tenure / 1000, PEN[i][2], 0.004,
          'tenure penalty ch ' + PEN[i][0] + ' Δ' + PEN[i][1])
      }
      ok(Math.exp(-PB.PLASTICITY * 1 / 4) > Math.exp(-PB.PLASTICITY * 1 / 1),
        'wide pacts are not cheaper to adjust than narrow ones')

      // ── §4.0 the α column IS the decision: same channels, different shape ──
      // GHOST α=0.55 wants spreading; BROOD α=1.35 wants concentration. Four channels, two books.
      clearBook()
      s.t = 0
      var neutral = [0, 0, 0, 0, 0]
      var spreadG = 0, concG = 0
      clearBook()
      for (i = 0; i < 4; i++) make(GHOST, 1, -1, { beta: neutral, partnerId: 'monotropa' })
      recomputeFactors(s); recomputeCosts(s, b)
      for (i = 0; i < b.pacts.length; i++) spreadG += yieldOf(s, b, b.pacts[i])
      clearBook()
      make(GHOST, 4, -1, { beta: neutral, partnerId: 'monotropa' })
      recomputeCosts(s, b)
      concG = yieldOf(s, b, b.pacts[0])
      ok(spreadG > concG * 1.80,
        'four 1-channel ghosts (' + spreadG.toFixed(3) + ') did not beat one 4-channel ghost (' +
        concG.toFixed(3) + ') by the α=0.55 margin')
      near(spreadG / concG, 4 / Math.pow(4, 0.55), 0.02, 'the GHOST spread ratio is not 4/4^0.55')

      clearBook()
      for (i = 0; i < 4; i++) make(BROOD, 1, 0, { beta: neutral, partnerId: 'atta' })
      recomputeCosts(s, b)
      var spreadB = 0
      for (i = 0; i < b.pacts.length; i++) spreadB += broodSize(s, b, b.pacts[i]) / broodInterval(b.pacts[i])
      clearBook()
      make(BROOD, 4, 0, { beta: neutral, partnerId: 'atta' })
      recomputeCosts(s, b)
      var concB = broodSize(s, b, b.pacts[0]) / broodInterval(b.pacts[0])
      ok(concB > spreadB * 2.0,
        'one 4-channel brood (' + concB.toExponential(3) + ') did not beat four 1-channel broods (' +
        spreadB.toExponential(3) + ') by the α=1.35 margin')

      // The two guilds must want OPPOSITE shapes on the same budget. That single fact is the layer.
      ok((spreadG / concG) > 1 && (spreadB / concB) < 1,
        'the guilds do not disagree about book shape: GHOST spread ' + (spreadG / concG).toFixed(2) +
        '×, BROOD spread ' + (spreadB / concB).toFixed(2) + '×')

      // ── §2.5 cost is convex in the number of pacts, so the optimum is interior ─
      near(congestionOf(4), 1.371, 0.01, 'congestion at 4 pacts')
      near(congestionOf(9), 2.178, 0.02, 'congestion at 9 pacts')
      // Convexity is the property that makes the book size a decision at all: the marginal cost of
      // the k-th pact must rise, so a linear asset has an INTERIOR optimum rather than "buy more of
      // everything". Against a 0.0359×-gross-per-channel asset — the level `08` §4.8's k ≈ 7 claim
      // implies — the optimum must land on seven.
      var LINEAR_Y = 0.0359
      var bestK = 0, best = -Infinity, prevMarg = -Infinity, convex = true
      for (k = 1; k <= 14; k++) {
        var netK = k * LINEAR_Y - PB.CH_COST_FRAC * k * congestionOf(k)
        var marg = PB.CH_COST_FRAC * (k * congestionOf(k) - (k - 1) * congestionOf(k - 1))
        if (marg < prevMarg - 1e-12) convex = false
        prevMarg = marg
        if (netK > best) { best = netK; bestK = k }
      }
      ok(convex, 'the marginal cost of an extra pact does not rise with book size')
      within(bestK, 6, 8, 'the optimal book size is not interior at k ≈ 7 (08 §4.8)')
      // And a bigger book must really be worse past the knee, not merely flat.
      ok((14 * LINEAR_Y - PB.CH_COST_FRAC * 14 * congestionOf(14)) < best * 0.90,
        'a fourteen-pact book is not materially worse than the seven-pact optimum')

      // ── §5.3 exposure: the SAME channels, hedged and unhedged ─────────────
      // Two books, three channels each, identical guild, identical everything except the sign of
      // β1. Under a drought the hedged book must survive and the unhedged one must not.
      clearBook()
      var LONG = [1.0, 0, 0, 0, 0], SHORT = [-1.0, 0, 0, 0, 0]
      for (i = 0; i < 3; i++) make(CROWN, 1, i, { beta: LONG, partnerId: 'cyanolichen' })
      recomputeFactors(s)
      F[0] = -1.6
      var longMult = bookMultWith(b, null).mult
      clearBook()
      make(CROWN, 1, 0, { beta: LONG, partnerId: 'cyanolichen' })
      make(CROWN, 1, 1, { beta: LONG, partnerId: 'cyanolichen' })
      make(CROWN, 1, 2, { beta: SHORT, partnerId: 'bryoria' })
      var hedgedMult = bookMultWith(b, null).mult
      ok(hedgedMult > longMult * 1.20,
        'hedging one channel of three did not help in a drought: long ×' + longMult.toFixed(3) +
        ' vs hedged ×' + hedgedMult.toFixed(3))
      near(longMult, C().clamp(1 + PB.SHOCK_GAIN * -1.6, PB.SHOCK_LO, PB.SHOCK_HI), 1e-9,
        'the all-long book multiplier is not the shock formula')

      // The same hedge must COST something when the weather is kind: no free lunch.
      F[0] = 1.6
      var hedgedGood = bookMultWith(b, null).mult
      clearBook()
      for (i = 0; i < 3; i++) make(CROWN, 1, i, { beta: LONG, partnerId: 'cyanolichen' })
      var longGood = bookMultWith(b, null).mult
      ok(longGood > hedgedGood,
        'the hedge was free in good weather: long ×' + longGood.toFixed(3) + ' vs hedged ×' +
        hedgedGood.toFixed(3))

      // ── §5.6 the three stress tests must actually differ ───────────────────
      clearBook()
      make(ROOT, 2, 0, { beta: [0.3, 0.9, -0.1, 0.2, -0.1], partnerId: 'root_0' })
      make(BROOD, 2, 1, { beta: [0.6, -0.5, 0.3, 0.1, 0.2], partnerId: 'atta' })
      var ex = bookExposure(s)
      ok(ex.tests.length === 3, 'there are not three stress tests')
      ok(Math.abs(ex.tests[1].mult - ex.mult) > 1e-6,
        'the canopy stress test returned the current multiplier')
      near(ex.beta[1], 0.5 * 0.9 + 0.5 * -0.5, 1e-9, 'book β is not channel-weighted')

      // ── §6.1 strain, term by term ─────────────────────────────────────────
      // `05` §6.1's formula and its calibration table disagree with each other: rows 1 and 2 are
      // exactly `terms · 0.0020`, rows 3–6 are not (they imply 3.96×, 0.83×, 5.67× and 3.37× that
      // rate respectively, so no single scaling reconciles them). The formula is the normative code
      // block and is what ships; what is asserted below is the formula's own arithmetic plus the
      // three tempo commitments §6.1 and §3.3 make in prose, which the formula does honour.
      clearBook()
      var q = make(ROOT, 2, 0, { beta: neutral, partnerId: 'root_0' })
      function dStrainOf (p2, envStress, met, bond) {
        p2.envStress = envStress; p2.demandMet = met
        p2.tenure = -tauOf(p2) * Math.log(1 - bond)
        return strainTerms(s, b, p2).net * PB.STRAIN_RATE
      }
      near(dStrainOf(q, 0, 1, 0), -0.00032, 1e-6, 'healthy new pact strain rate')
      near(dStrainOf(q, 0, 1, 0.96), -0.00074, 5e-6, 'healthy mature pact strain rate')
      near(dStrainOf(q, 0.72, 1, 0.96), (1.15 * 0.72 - 0.22 * 0.96 - 0.16) * 0.0020, 1e-9,
        'the six strain terms do not sum to the published formula')
      near(dStrainOf(q, 0, 0.5, 0), (0.90 * 0.5 - 0.16) * PB.STRAIN_RATE, 1e-9,
        'half-paid strain rate')
      // Paying half of what you owe must be a slow death, not a fast one: over 20 minutes to NOTICE.
      ok(PB.NOTICE_AT / dStrainOf(q, 0, 0.5, 0) > 1200, 'underpaying kills too quickly')

      // §6.1's prose: "Four minutes of a real drought puts a mature pact into NOTICE." A real
      // drought is W at its floor against a long-moisture partner — envStress 1.6, not 0.72.
      var droughtRate = dStrainOf(q, PB.ENV_STRESS_K * 2.0, 1, 0.96)
      within(PB.NOTICE_AT / droughtRate, 180, 360,
        'four minutes of a real drought does not reach NOTICE (s)')

      // §3.3's promise: a parked pact dies. It costs nothing, so it is paid nothing.
      q.ch = 0
      q.tenure = -tauOf(q) * Math.log(1 - 0.9)
      q.envStress = 0; q.demandMet = 0
      var neglectRate = strainTerms(s, b, q).net * PB.STRAIN_RATE
      within(1 / neglectRate, 200, 400, 'a parked pact does not die in a few minutes (s)')
      ok(neglectRate > droughtRate, 'parking a pact is safer than a drought')

      // Old partners forgive you: loyalty is insurance, and it is worth a real amount of adversity.
      q.ch = 2; q.envStress = 0.72; q.demandMet = 1
      q.tenure = 0
      var young = strainTerms(s, b, q).net
      q.tenure = 4 * PB.TAU_BOND
      var oldp = strainTerms(s, b, q).net
      ok(oldp < young, 'a four-hour partner does not tolerate more adversity than a new one')
      // The break-even exposure a pact can carry before strain rises at all.
      var breakYoung = PB.STRAIN_BASE / PB.STRAIN_ENV
      var breakOld = (PB.STRAIN_BASE + PB.STRAIN_BOND * (1 - Math.exp(-4))) / PB.STRAIN_ENV
      ok(breakOld > breakYoung * 1.20,
        'bond relief buys less than 20% more tolerable adversity: ' + breakYoung.toFixed(3) +
        ' → ' + breakOld.toFixed(3))

      // ── §6.2 the ladder, driven by the world, with nothing drawn ──────────
      clearBook()
      var lad = make(NODULE, 2, 0, { beta: [1, 0, 0, 0, 0], partnerId: 'streptomyces' })
      s.t = 0
      s.a2.W = A().W_MIN                       // the drought is in the weather, not in a poked global
      var toNotice = 0
      while (lad.state === 'active' && toNotice < 4000) {
        s.t += PB.SLOW_DT
        stepPacts(PB.SLOW_DT, { stochastic: false, offline: false })
        toNotice += PB.SLOW_DT
      }
      ok(lad.state === 'notice', 'a pact under sustained adverse exposure never reached NOTICE')
      within(toNotice, 120, 900, 'time to NOTICE under a hard drought (s)')
      near(F[0], -2, 1e-9, 'the drought did not reach the F1 clamp')

      // The same pact, hedged: β1 negative, same weather, must never strain at all.
      clearBook()
      var safe = make(NODULE, 2, 0, { beta: [-1, 0, 0, 0, 0], partnerId: 'streptomyces' })
      for (i = 0; i < 500; i++) { s.t += PB.SLOW_DT; stepPacts(PB.SLOW_DT, { stochastic: false, offline: false }) }
      near(num(safe.strain), 0, 1e-9,
        'a β1-negative pact strained in the drought that broke the β1-positive one')

      // ── §7 / §14.2 breach is deterministic and offline is safe ─────────────
      clearBook()
      var off = make(ROOT, 3, 0, { beta: [1, 0, 0, 0, 0], partnerId: 'root_0', strain: 0.94 })
      s.t = 0
      var tenure0 = 0
      for (i = 0; i < 18000; i++) {           // 10 hours of strategic ticks, offline
        s.t += PB.SLOW_DT
        stepPacts(PB.SLOW_DT, { stochastic: false, offline: true })
      }
      ok(off.state !== 'breached', 'a ten-hour absence produced a breach')
      ok(num(off.strain) <= A().STRAIN_CAP + 1e-9, 'offline strain passed its hard cap')
      near(num(off.tenure) - tenure0, 36000, 1, 'tenure did not accrue at full rate while away')
      ok(num(off.noticeAt) === null || num(s.t) - num(off.noticeAt) < PB.NOTICE_WINDOW,
        'a NOTICE issued offline burned its compliance window while the player was away')

      // ── §2.3 the channel ladder, and the fact you cannot buy everything ────
      world()
      b.accordChannels = 0
      var cum = 0
      for (i = 0; i < PB.ACCORD_CH_MAX; i++) {
        cum += channelCost(s)
        b.accordChannels = i + 1
      }
      within(cum, 3600, 4400, 'eight ACCORD channels do not cost what 08 §4.8 says')
      b.accordChannels = PB.ACCORD_CH_MAX
      ok(!isFinite(channelCost(s)), 'the ninth ACCORD channel was purchasable')

      // ── §11.2–11.3 the offer generator picks a GUILD, not a region ────────
      // A mid-act map offers ~20 procedural ROOT stands against 3 named nodules. If the pool is
      // weighted by counting, a player is offered nothing but trees for three hours and never sees
      // the α column at all. Over 400 draws at P3 every unlocked guild must appear.
      world(37)
      b.slots = 9
      var seen = [0, 0, 0, 0, 0, 0]
      C().setStock(s.res, 'extracted', 0.25 * A().EXTRACT_TARGET)
      for (i = 0; i < 400; i++) {
        var pool2 = candidatePool(s, b, phaseOf(s))
        var pk2 = weightedPick(pool2, rng())
        if (pk2) seen[pk2.guild]++
      }
      for (k = 0; k < NGUILD; k++) {
        if (GUILDS[k].phase > phaseOf(s)) { ok(seen[k] === 0, GUILDS[k].key + ' was offered before its phase'); continue }
        ok(seen[k] > 20, GUILDS[k].key + ' was offered ' + seen[k] + '/400 times — the pool is ' +
          'weighted by counting regions rather than by guild')
      }
      // RIVAL arrives at P4 and not before, and when it arrives it must actually be reachable.
      C().setStock(s.res, 'extracted', 0.45 * A().EXTRACT_TARGET)
      var sawRival = 0
      for (i = 0; i < 400; i++) {
        var pool3 = candidatePool(s, b, phaseOf(s))
        var pk3 = weightedPick(pool3, rng())
        if (pk3 && pk3.guild === RIVAL) sawRival++
      }
      ok(phaseOf(s) === 4, 'fc 0.45 is not phase P4')
      ok(sawRival > 20, 'RIVAL was offered ' + sawRival + '/400 times at P4')

      // And the mercy offer must NOT be live on a book with no breaches in it.
      near(b.guildRep[0], PB.REP_START, 1e-9, 'guild reputation does not start at REP_START')
      ok(!behaviouralOffer(s, b, phaseOf(s)) || b.offers.length > 0,
        'a behavioural offer fired on a book that had done nothing')

      // ── §1.1 the floor: passiveMineral guarantees no dead end ─────────────
      world()
      var r2 = s.a2.regions
      for (i = 0; i < 61; i++) r2.flags[i] |= 4
      near(passiveMineral(s), 0.90 * Math.pow(61, 0.60), 0.01, 'the passive mineral floor')
      within(passiveMineral(s), 9.5, 11.5, 'the floor at 61 claimed is not ~10.4 ⛬/s')

      // ── the headline: two players, same budget, different DECISIONS ───────
      // Both run 1800 s with identical partners and identical weather. A holds four channels in one
      // BROOD and one GHOST and never touches them; B churns — reallocating every 120 s — and pays
      // §3.3 for it. Nothing stochastic runs. The gap is decisions, not variance.
      function play (churn) {
        world(7)
        clearBook()
        s.t = 0
        make(BROOD, 3, 0, { beta: neutral, partnerId: 'atta' })
        make(GHOST, 1, -1, { beta: neutral, partnerId: 'monotropa' })
        var psi0 = num(s.res.insight), cum0 = num(s.res.cumBiomass), acc0 = num(s.res.accordLifetime)
        var t = 0
        while (t < 1800) {
          s.t += PB.SLOW_DT
          stepPacts(PB.SLOW_DT, { stochastic: false, offline: false })
          t += PB.SLOW_DT
          if (churn && Math.round(t) % 120 === 0) {
            var pk = b.pacts[0]
            setChannels(pk.id, pk.ch === 3 ? 2 : 3)
          }
        }
        return {
          psi: num(s.res.insight) - psi0,
          biomass: num(s.res.cumBiomass) - cum0,
          accord: num(s.res.accordLifetime) - acc0,
          bond: bondMultOf(b.pacts[0])
        }
      }
      var held = play(false)
      var churned = play(true)
      ok(held.bond > churned.bond * 1.25,
        'churning did not cost bond: held ' + held.bond.toFixed(3) + '× vs churned ' +
        churned.bond.toFixed(3) + '×')
      ok(held.biomass > churned.biomass * 1.10,
        'thirty minutes of churn cost less than 10% of BROOD income: held ' +
        held.biomass.toExponential(3) + ' vs churned ' + churned.biomass.toExponential(3))

      // ── the same budget spent on the RIGHT shape vs the WRONG shape ───────
      // Five channels. Correct: 4 in BROOD (α 1.35) + 1 ghost. Backwards: 1 brood + 4 spread ghosts
      // is right for GHOST but wrong for BROOD; the point is that the two orders are not equal.
      function shaped(broodCh, ghostSpread) {
        world(11)
        clearBook()
        s.t = 0
        make(BROOD, broodCh, 0, { beta: neutral, partnerId: 'atta' })
        for (i = 0; i < ghostSpread; i++) make(GHOST, 1, -1, { beta: neutral, partnerId: 'monotropa' })
        var m0 = num(s.res.cumBiomass), p0 = num(s.res.insight), t = 0
        while (t < 900) { s.t += PB.SLOW_DT; stepPacts(PB.SLOW_DT, { stochastic: false, offline: false }); t += PB.SLOW_DT }
        return { g: num(s.res.cumBiomass) - m0, psi: num(s.res.insight) - p0 }
      }
      var concentrated = shaped(4, 1)
      var flat = shaped(1, 4)
      ok(concentrated.g > flat.g * 2.5,
        'concentrating five channels in BROOD did not beat spreading them: ' +
        concentrated.g.toExponential(3) + ' vs ' + flat.g.toExponential(3))
      ok(flat.psi > concentrated.psi * 2.5,
        'spreading five channels across GHOSTs did not beat concentrating them: ' +
        flat.psi.toExponential(3) + ' vs ' + concentrated.psi.toExponential(3))

      // ── ACCORD accrues only while the world is hurting you ────────────────
      world(13)
      clearBook()
      s.t = 0
      make(ROOT, 3, 0, { beta: [1, 0, 0, 0, 0], partnerId: 'root_0', tenure: 3600 })
      recomputeFactors(s)
      var kind = num(s.res.accordLifetime)
      for (i = 0; i < 120; i++) { s.t += PB.SLOW_DT; F[0] = 2; stepPacts(PB.SLOW_DT, { stochastic: false, offline: false }); F[0] = 2 }
      var goodWeather = num(s.res.accordLifetime) - kind
      world(13)
      clearBook()
      s.t = 0
      var hurt = make(ROOT, 3, 0, { beta: [1, 0, 0, 0, 0], partnerId: 'root_0', tenure: 3600 })
      var before = num(s.res.accordLifetime)
      for (i = 0; i < 120; i++) {
        s.t += PB.SLOW_DT
        stepPacts(PB.SLOW_DT, { stochastic: false, offline: false })
        hurt.adverse = 0.89
        accrueAccord(s, b, PB.SLOW_DT, { stochastic: false, offline: false })
      }
      var badWeather = num(s.res.accordLifetime) - before
      ok(badWeather > goodWeather * 5,
        'ACCORD did not require adversity: ' + badWeather.toFixed(1) + ' ⟡ hurt vs ' +
        goodWeather.toFixed(1) + ' ⟡ comfortable')
      // §10.1's worked number: 3 ch, bond 0.958, adverse 0.89, 240 s → ~301 ⟡.
      near(PB.ACC_K * Math.pow(3, 0.5) * 0.958 * 0.89 * 240, 301, 6,
        'the §10.1 worked ACCORD example')

      // ── the information schedule: you learn a partner by keeping it ────────
      world(17)
      clearBook()
      var learn = make(CROWN, 1, 0, { beta: [0.5, 0.5, 0, 0, 0], partnerId: 'lobaria' })
      ok(betaState(s, b, learn) === 'prior', 'a fresh pact is not at the guild prior')
      learn.cumTenure = PB.BAND_TENURE
      ok(betaState(s, b, learn) === 'banded', 'β did not band at 240 s')
      learn.cumTenure = PB.EXACT_TENURE
      ok(betaState(s, b, learn) === 'exact', 'β did not become exact at 600 s')
      learn.cumTenure = 0
      make(GHOST, 1, -1, { partnerId: 'voyria' })
      ok(betaState(s, b, learn) === 'exact', 'a Voyria did not reveal the book')
      s.proj.flags.pact_chemotaxis = 0
      ok(betaState(s, b, learn) === 'opaque', 'β was visible before Chemotaxis')
      s.proj.flags.pact_chemotaxis = 1

      // ── the guild identities: six things to lose, six different breaches ───
      world(19)
      for (k = 0; k < NGUILD; k++) {
        clearBook()
        var vict = make(k, 2, 0, { beta: neutral, partnerId: PARTNERS[0].id })
        vict.partnerId = k === ROOT ? 'root_0' : (function () {
          for (i = 0; i < PARTNERS.length; i++) if (PARTNERS[i].guild === k) return PARTNERS[i].id
          return PARTNERS[0].id
        })()
        var E0 = num(s.mult.E), bio0 = num(s.res.biomass), sig0 = num(s.res.rivalStr)
        void sig0
        breach(s, b, vict)
        var moved = (k === NODULE && num(s.mult.E) < E0) ||
          (k === BROOD && num(s.res.biomass) < bio0 * 0.99) ||
          (k === ROOT && !!b.rootScar) ||
          (k === GHOST && vict.state === 'squatting') ||
          (k === CROWN && b.blindUntil > s.t) ||
          (k === RIVAL && b.rivalSpreadUntil > s.t)
        ok(moved, GUILDS[k].key + ' breach had no guild-specific effect')
      }

      // ── the sub-order is load-bearing ─────────────────────────────────────
      ok(String(stepPacts).indexOf('recomputeFactors') <
        String(stepPacts).indexOf('chargeCosts'), 'factors are computed after costs are charged')
      ok(String(stepPacts).indexOf('chargeCosts') <
        String(stepPacts).indexOf('updateStrain'), 'strain is updated before demandMet is written')
      ok(String(stepPacts).indexOf('rollBroodDeliveries') <
        String(stepPacts).indexOf('updateStrain'), 'brood deliveries roll after strain')

      // ── the phone card model is complete and legible at 390 px ────────────
      world(23)
      clearBook()
      var shown = make(BROOD, 3, 0, { beta: [0.6, -0.4, 0.3, 0.1, 0.2], partnerId: 'dendroctonus' })
      shown.known = 1
      stepPacts(PB.SLOW_DT, { stochastic: false, offline: false })
      var cm = card(shown.id)
      ok(!!cm, 'card() returned nothing for a live pact')
      ok(cm.pips.length === cm.chMax, 'the pip strip is not chMax pips wide')
      ok(cm.bondBar.length === 10 && cm.strainBar.length === 10, 'the bars are not 10 cells')
      ok(cm.strainTicks.length === 3, 'the strain bar has no tick marks')
      ok(cm.traits.length === 3, 'a card does not show three trait slots')
      ok(cm.aria.indexOf('brood guild') > 0 && cm.aria.indexOf('channels') > 0,
        'the aria label does not read the card')
      ok((cm.rateText + ' ' + cm.rateUnit).length <= 20,
        'the rate slot is too long for 390 px: ' + cm.rateText + ' ' + cm.rateUnit)
      // The split is the whole point, and it has to hold for all six guilds rather than the one
      // this block happens to build: the mantissa carries digits only, and the unit is the
      // guild's own string rather than a notation invented at the call site.
      for (k = 0; k < NGUILD; k++) {
        var gp = make(k, 2, 0, { beta: [0, 0, 0, 0, 0] })
        var pc = card(gp.id)
        ok(!/[⛬ΨΣ]|\/s|gross|×/.test(pc.rateText),
          GUILDS[k].key + ' put its unit in the mantissa: ' + pc.rateText)
        ok(pc.rateUnit === GUILDS[k].unit,
          GUILDS[k].key + ' is not quoted in its guild unit: ' + pc.rateUnit)
        ok((pc.rateText + ' ' + pc.rateUnit).length <= 20,
          GUILDS[k].key + ' rate is too long for 390 px: ' + pc.rateText + ' ' + pc.rateUnit)
      }
      var dm = detail(shown.id)
      ok(dm.strainBreakdown.length === 7, 'the strain breakdown is not six terms and a net')
      ok(dm.exposure.length === NFACTOR, 'the detail sheet does not show five factors')
      var hd = header()
      ok(hd.channelPips.length === hd.channelCap, 'the header pips do not match the cap')
      within(hd.costFrac, 0, 1, 'the book cost fraction left [0,1]')

      // The scrub preview must move the readout and must not commit.
      var was = shown.ch
      var pv = scrub(shown.id, 1.0, 1.0)
      ok(pv && pv.ch === Math.min(PB.CH_MAX_PER_PACT, channelCap(s)), 'a full-width scrub did not fill the strip')
      ok(shown.ch === was, 'scrubbing committed a channel change')

      // UNDO restores the exact prior tenure, not a recomputed one.
      shown.tenure = 1234.5
      var tok = setChannels(shown.id, 5)
      ok(shown.tenure < 1234.5, 'a reallocation cost no tenure')
      undo(tok)
      near(shown.tenure, 1234.5, 1e-9, 'UNDO did not restore the exact tenure')
      ok(shown.ch === was, 'UNDO did not restore the channel count')

      // ── the long thesis: F2 declines, so ROOT rots and BROOD compounds ─────
      world(29)
      clearBook()
      var rootP = make(ROOT, 2, 0, { beta: [0, 0.9, 0, 0, 0], partnerId: 'root_0' })
      var broodP = make(BROOD, 2, 1, { beta: [0, -0.5, 0, 0, 0], partnerId: 'atta' })
      F[1] = 1.0
      var rEarly = shockOf(rootP), bEarly = shockOf(broodP)
      F[1] = -0.9
      var rLate = shockOf(rootP), bLate = shockOf(broodP)
      ok(rLate < rEarly * 0.55, 'a β2-positive ROOT did not decay across the act')
      ok(bLate > bEarly * 1.30, 'a β2-negative BROOD did not compound across the act')

      // ── LEGACY carry-out ──────────────────────────────────────────────────
      world(31)
      C().setStock(s.res, 'accordLifetime', 7600)
      b.honouredP6 = 7
      near(legacyTerm(), 0.25 * (7600 / 9000) + 0.070, 1e-6, 'the LEGACY pact term')
      C().setStock(s.res, 'accordLifetime', 0)
      b.honouredP6 = 0
      near(legacyTerm(), 0, 1e-9, 'a player who ignored the layer contributed to LEGACY')
    } catch (e) {
      f.push('THREW ' + (e && e.message ? e.message : e))
    }
    try { HY.state.importB64(keep) } catch (e) { void 0 }
    return f
  }

  // ───────────────────────────────────────────────────────────────────────────

  HY.pactbook = {
    // BIBLE §6 M11
    stepPacts: stepPacts,
    setChannels: setChannels,
    sign: sign,
    sever: sever,
    comply: comply,
    renew: renew,
    buyChannel: buyChannel,
    reconcile: reconcile,
    triangle: triangle,
    bookExposure: bookExposure,
    factors: factors,
    passiveMineral: passiveMineral,
    isOpen: function () { var s = S(); return open(s) },

    // the step loop.js drives (BIBLE §4 step 8)
    step: step,

    // §6's generic module surface
    init: init,
    tick: tick,
    serialise: serialise,
    migrate: migrate,
    reboot: reboot,

    // the player verbs the view layer calls, and the readouts it paints
    undo: undo,
    scrub: scrub,
    declineOffer: declineOffer,
    setOfferChannels: setOfferChannels,
    setOfferTerm: setOfferTerm,
    setOfferType: setOfferType,
    header: header,
    list: list,
    card: card,
    detail: detail,
    offers: offers,
    channelCap: channelCap,
    channelCost: channelCost,
    channelsFree: channelsFree,
    slots: slots,
    severCost: severCost,
    reconcileCost: reconcileCost,
    triangleCost: triangleCost,
    honourAccord: honourAccord,
    stakeRequired: stakeRequired,
    phase: function () { var s = S(); return s ? phaseOf(s) : 1 },
    congestion: congestionOf,
    // Where the book's income actually came from this tick, by guild. The header's one honest
    // answer to "is my book too big" needs both halves, not just the cost line.
    attribution: function () {
      return { minerals: LAST.rootMin, passive: LAST.passive, biomassFrac: LAST.noduleFrac,
        broodFrac: LAST.broodRate, insight: LAST.ghostPsi, signalFrac: LAST.crownSig,
        rivalCut: LAST.rivalCut, accord: LAST.accord, cost: bookCost, gross: gross }
    },

    // the readouts the other act modules and the console ask for
    regionHasPact: regionHasPact,
    alarmRegion: alarmRegion,
    forecastBonus: forecastBonus,
    forecastBlind: forecastBlind,
    voidRegion: voidRegion,
    legacyTerm: legacyTerm,
    maxStrain: maxStrain,
    pacts: pacts,
    GUILDS: GUILDS,
    TRAITS: TRAITS,
    PARTNERS: PARTNERS,
    ROOT_TYPES: ROOT_TYPES,
    FACTOR_NAME: FACTOR_NAME,

    __selftest: __selftest
  }
})(window.HY = window.HY || {})
