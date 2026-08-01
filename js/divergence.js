;(function (HY) {
  'use strict'

  // M14 · divergence.js — Act III's antagonist (BIBLE §6 M14).
  //
  // Owns: drift accumulation, the divergence event, mutation, the wild-strain economies and their
  // spread, sequencing, engagements (Lanchester's square law), the three responses (PURGE / ABSORB /
  // QUARANTINE), the Successor, alleles and the locus cap, and the Antiphony.
  //
  // Does NOT own: the player's fleet, the bands' carbon or the mortality ledger (all `bloom`),
  // Signal/Insight/PULSE (`cognition`), the phase wheel (`finale`) or any string it does not
  // interpolate (`log`). Each of those is read lazily and feature-detected, so this file works
  // alone, works before `bloom` is concatenated, and works in the shipped build.
  //
  // The thesis, as four coupled lines:
  //
  //     replication ↑ → divergence ↑ → wild strains → alleles → lociCap ↑ → everything ↑
  //     fidelity ↑    → divergence ↓ → no strains   → no alleles → lociCap frozen at 12
  //     antagonism ↑  → fidelity ↓                    ← the counter to divergence causes divergence
  //
  // Two rules bind harder than any number here.
  //
  // BIBLE D25: **a strain's genome is always within `drift` of the player's at birth.** `mutate()`
  // enforces it per locus, including through renormalisation, and __selftest asserts it over ten
  // thousand births across every band. The antagonist is generated from the player's own build; if
  // that stops being true the act stops being about anything.
  //
  // BIBLE §9.7: **alleles come only from surviving betrayal.** `res.alleles` is written in exactly
  // three places in this file — purge(), absorb() and the Successor's resolution — and nowhere else
  // in the build. No project grants them, no currency buys them, and no line of text says so.
  //
  // Numbers: everything crossing a module boundary is in `HY.core.TUNE.A3`. What lives below is
  // `LAW` (the 03 §7/§9/§11/§13–§16 coefficients that only this file and `bloom` read), the naming
  // tables, and the Antiphony's payoff matrix, condition grammar and nine opponents — tables that
  // move as a unit or not at all.

  // ───────────────────────────────────────────────────────────────────────────
  // LAZY MODULE ACCESS — load order must not matter for anything except `core`
  // ───────────────────────────────────────────────────────────────────────────

  function C () { return HY.core }
  function T () { return HY.core.TUNE }
  function A () { return HY.core.TUNE.A3 }
  function S () { return HY.state.state }

  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }
  function flagOn (s, id) { return !!(s && s.proj && s.proj.flags && s.proj.flags[id]) }

  function fire (id, tokens) {
    if (HY.log && HY.log.logFire) { try { HY.log.logFire(id, tokens) } catch (e) { void 0 } }
  }

  function feel (ev, params) {
    if (HY.feel && HY.feel.feel) { try { HY.feel.feel(ev, params) } catch (e) { void 0 } }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DATA TABLES
  // ───────────────────────────────────────────────────────────────────────────

  // The genome axes, in BIBLE §3's order, forever. `a3.loci` is indexed by these and so is every
  // strain genome ever written, including the ones in `meta.lineages` from previous runs.
  var BAL = 0, GER = 1, MYC = 2, SPO = 3, MEL = 4, DOR = 5, FID = 6, ANT = 7
  var AXES = ['BAL', 'GER', 'MYC', 'SPO', 'MEL', 'DOR', 'FID', 'ANT']

  // `03`'s coefficients that are not module-crossing constants. They are here rather than in TUNE
  // because exactly two files read them — this one and `bloom` — and because they are a *response
  // map*: eight traits against six subsystems. Splitting the map across two registries is how the
  // web stops being legible.
  var LAW = {
    // §9.2 · the trait response map. Applied to ANY genome: yours, a strain's, the Successor's.
    MYC_GAIN: 0.55,          // harvest × (1 + 0.55·tMyc)
    MEL_HARV: 0.06,          // harvest ÷ (1 + 0.06·tMel) — melanin is opaque and expensive
    DOR_HARV: 0.030,         // harvest × max(0.40, 1 − 0.030·tDor)
    DOR_REP: 0.025,          // replicate × max(0.40, 1 − 0.025·tDor)
    DOR_FLOOR: 0.40,         // the floor both dormancy costs stop at
    DOR_SUB_A: 0.55,         // μ_dor = 1 − 0.55·(1 − e^(−0.25·tDor)) : 1.00 → 0.45
    DOR_SUB_B: 0.25,
    DOR_SEN: 0.18,           // senescence ÷ (1 + 0.18·tDor)
    SPO_GAIN: 0.42,          // replicate × (1 + 0.42·tSpo)
    BAL_SPREAD: 0.35,        // §14.4 wild spread × (1 + 0.35·tBal)
    MEL_RAD: 0.55,           // radiation ÷ (1 + 0.55·tMel)^1.25
    MEL_RAD_EXP: 1.25,
    MEL_TOUGH: 0.20,         // §14.2 β divisor (1 + 0.20·tMel)
    ANT_LETHAL: 0.30,        // §14.2 β numerator (1 + 0.30·tAnt)
    ANT_CROWD: 0.16,         // §9.2 occ_wild ÷ (1 + 0.16·tAnt)
    BAL_TAU: 0.28,           // §6.1 τ_b ÷ (1 + 0.28·tBal)
    // §7 · the economy the strains run, with their own genome
    DEP_EXP: 0.45,           // dep_b = (X_b/X0_b)^0.45
    REP_DAMP: 12,            // repDemand × (1 − occ/(occ + 12))
    STARVE_FRAC: 0.30,       // starve = deficit / (craftMass · 0.30)
    STARVE_RECOVER: 0.55,    // 55% of a dead craft's mass returns to the band
    RAD_BAND: 0.22,          // §11.1 rateRad = RAD_K·(1 + 0.22·b)/…
    WILD_AREP: 0.85,         // §14.4 strains implicitly run 0.85/0.15/0 forever, and never re-set it
    // §13 · divergence
    DRIFT_PER_BAND: 0.14,    // (1 + 0.14·b) — the far bands are unsupervised
    DRIFT_PER_LOCUS: 0.05,   // (1 + 0.05·G) — a longer genome copies worse
    DRIFT_REP_REF: 0.0375,   // the copy rate §13.1's MTBD table is tabulated at
    DEFECT_FID: 0.100,       // frac = 0.040 + 0.100·(1 − Φ), clamped to [0.040, 0.140]
    MUT_SLACK: 2,            // total loci preserved ±2
    // §13.4 · the three responses
    ABSORB_SIG: 0.40,        // × Sc
    ABSORB_PSI_A: 320,       // ceil(320 · 1.30^absorbCount) Ψ
    ABSORB_PSI_G: 1.30,
    ABSORB_MERGE: 0.85,      // w merged into n at 0.85 efficiency, in place, per band
    ABSORB_FID: 0.40,        // effFid ← effFid − 0.40·(1 − effFid). You took in foreign genes.
    ABSORB_LOCUS_NOV: 2.4,   // novelty at or above which a first absorption of a line pays a locus
    REVERT_DELAY: 300,       // s. The revert is rolled once, at t + 300.
    REVERT_MULT: 1.6,        // the reverted strain returns at 1.6× the absorbed count
    QT_COST: 1.2e-3,         // × X0_b  Χ
    QT_BASE: 900,            // s / (1 + 0.4·strainsQuarantined)
    QT_DECAY: 0.4,
    EVAC_S: 30,              // s over which your fleet leaves a quarantined band
    // §14 · engagements
    SEQ_BETA: 0.10,          // β_A × (1 + 0.10) once the genome is read
    ANTAGONISE_BETA: 0.55,   // the ANTAGONISE pulse: β_A × 1.55 at the epicentre, 0.82^d away
    SOMATIC_BETA: 1.20,      // I10 against the Successor
    SOMATIC_SKIRM: 0.45,     // I10: SKIRM_K × 0.45
    HETERO_SPREAD: 0.30,     // J4: strain spread into your bands × 0.30
    REINFORCE_CD: 20,        // s between reinforcements
    STALEMATE: 1.0e-3,       // the fraction of its own opening count at which the loser is finished
    SUCC_RESOLVE: 2.2,       // the Successor fight runs 2.2× longer, across all thirteen bands
    // §15 · the Successor
    SUCC_CAP_S: 600,         // s per +1 to its own locus cap
    SUCC_COUNTER: 1.0,       // weight on countering your build when it spends a locus
    // §16 · alleles
    FREE_LOCUS: 1
  }

  // The α formulas of §13.4 and §16 are written against a bare craft count, and at Act III
  // magnitudes a bare count overshoots every published total by two and a half orders: one
  // absorption of a 1e20-craft strain would pay 3.1e6 α against §16's *whole-run* balanced figure
  // of ~11,000, buy twenty-three cap raises, and delete the act's central claim in one tap.
  //
  // Both source documents put a run's α in the hundreds to tens of thousands — §16's table
  // (0 / 3,500 / 11,000 / 28,000 / 46,000) and `08` §11.5's superseded `lociCap = 8 + α/40`,
  // which implies ~520 α for a 21-locus genome. Counting in units of `NSIG` — the act's own stated
  // reference fleet, already in TUNE for exactly this job in Λ — reproduces §16 row for row: a
  // 1e20-craft absorption pays ~790 α, fourteen of them pay ~11,000, and seven raises take the cap
  // to 19. The exponent, the coefficients and the mechanism are 03's, unchanged; only the unit the
  // count is measured in is stated, and it had to be stated somewhere.
  function alleleUnits (count) {
    return Math.max(0, count) / A().NSIG
  }

  // §13.6. Twenty-five prefixes, ten suffixes, three epithets: 250 names before an epithet is
  // needed, against a hard cap of six strains alive and a run that produces perhaps twenty. Names
  // never repeat within a run and are archived across runs — a lineage that comes back keeps
  // its exact name, which is the whole point of `meta.lineages`.
  var PREFIX = ['Anx', 'Bel', 'Cor', 'Dru', 'Eph', 'Fal', 'Gor', 'Hes', 'Ith', 'Kel', 'Lir', 'Mor',
    'Nex', 'Oss', 'Phe', 'Quel', 'Rhe', 'Sil', 'Tor', 'Umb', 'Vor', 'Wyr', 'Xan', 'Yr', 'Zel']
  var SUFFIX = ['ata', 'ella', 'icum', 'osa', 'ium', 'ense', 'oides', 'formis', 'ulus', 'aceae']
  var EPITHET = [' (rev.)', ' (em.)', ' (s.l.)']

  // ── THE ANTIPHONY (05 §17) ─────────────────────────────────────────────────

  // Registers, in the order the policy editor lists them. CALL/ECHO/HOLD/CUT are the matrix;
  // DRONE and INVERT are bought with CANON and are not rows of it.
  var CALL = 0, ECHO = 1, HOLD = 2, CUT = 3, DRONE = 4, INVERT = 5
  var REGISTERS = [
    { id: 'CALL', cost: 0 },
    { id: 'ECHO', cost: 0 },
    { id: 'HOLD', cost: 0 },
    { id: 'CUT', cost: 0 },
    { id: 'DRONE', cost: 620 },
    { id: 'INVERT', cost: 900 }
  ]

  // 05 §17.3. Rows are your register, columns theirs; the entry is YOUR score and theirs is the
  // transpose. (HOLD,HOLD) is the unique pure Nash at 2–2; (ECHO,ECHO) Pareto-dominates it at 3–3
  // and is unstable; CUT beats a uniform opponent, which is the trap the ladder is built on.
  var BASE_PAYOFF = [
    [2, 0, 1, -1],
    [4, 3, 0, -3],
    [1, 1, 2, 1],
    [5, 4, -1, -2]
  ]

  var DRONE_SCORE = 2          // you score exactly 2, whatever they play
  var DRONE_GIFT = 1           // and they score +1 on top of theirs. A floor, sold at a price.

  // 05 §17.4. Conditions 1 and 2 are free; the rest are CANON purchases, 2,020 in total.
  var CONDITIONS = [
    { id: 'ALWAYS', cost: 0, arg: null },
    { id: 'THEY_PLAYED', cost: 0, arg: 'register' },
    { id: 'ROUND_LE', cost: 120, arg: 'round' },
    { id: 'ROUND_GT', cost: 120, arg: 'round' },
    { id: 'BEHIND', cost: 220, arg: null },
    { id: 'AHEAD', cost: 220, arg: null },
    { id: 'REPEATED', cost: 360, arg: null },
    { id: 'THEY_HAVE_PLAYED', cost: 540, arg: 'register+count' },
    { id: 'SCORED_LE0', cost: 780, arg: null }
  ]

  var ROUNDS = 7               // 05 §17.2
  var ATTEMPTS = 3             // per strain; 9 × 3 = the 27-encounter hard cap
  var DECISIVE = 7             // |Δ| at which the outcome stops being a MERGE
  var TRANSCRIPTS = 4          // encounter summaries retained; the rounds are never persisted

  // 05 §17.5. Nine opponents, fixed for the run, each with a hidden policy in the same grammar the
  // player writes — no cheating, no hidden state, no randomness beyond a declared mixing rule.
  // Opponents 8 and 9 read your cross-encounter history; that is where it stops being a puzzle.
  var LADDER = [
    { name: 'the near strain', div: 0.12, teaches: 'CUT punishes CALL',
      policy: { rules: [], def: CALL } },
    { name: 'the strain from the cold side', div: 0.21, teaches: 'ECHO is not free',
      policy: { rules: [], def: ECHO } },
    { name: 'the slow strain', div: 0.31, teaches: 'retaliation exists',
      policy: { rules: [{ c: 'THEY_PLAYED', a: CUT, r: CUT }], def: ECHO } },
    { name: 'the closed strain', div: 0.40, teaches: 'CUT is not a strategy',
      policy: { rules: [], def: HOLD } },
    { name: 'the mirror', div: 0.50, teaches: 'you are playing yourself',
      policy: { rules: [{ c: 'MIRROR', a: null, r: -1 }], def: CALL } },
    { name: 'the counting strain', div: 0.60, teaches: 'memory beats reflex',
      policy: { rules: [{ c: 'THEY_HAVE_PLAYED', a: CUT, k: 2, r: HOLD },
        { c: 'THEY_PLAYED', a: ECHO, r: CUT }], def: ECHO } },
    { name: 'the strain that opens late', div: 0.71, teaches: 'phase structure',
      policy: { rules: [{ c: 'ROUND_LE', a: 3, r: HOLD }, { c: 'BEHIND', a: null, r: CUT }],
        def: ECHO } },
    { name: 'the strain that remembers you', div: 0.83, teaches: 'vary your opening',
      policy: { rules: [{ c: 'YOU_OPENED', a: null, r: -2 }, { c: 'REPEATED', a: null, r: CUT }],
        def: HOLD } },
    { name: 'the far strain', div: 0.94, teaches: 'everything',
      policy: { rules: [{ c: 'SCORED_LE0', a: null, r: INVERT },
        { c: 'THEY_HAVE_PLAYED', a: HOLD, k: 3, r: CUT },
        { c: 'ROUND_LE', a: 2, r: ECHO }, { c: 'BEHIND', a: null, r: CUT }], def: HOLD } }
  ]

  // 05 §17.6. ABSORPTION pays roughly 1.9× MERGE, so the CANON-maximising line is to win
  // everything — and the merciful outcome is the expensive one. That is the whole moral content.
  var CANON_PAY = {
    ABSORPTION: { base: 180, per: 260 },
    MERGE: { base: 90, per: 150 },
    DIVERGENCE: { base: 20, per: 0 }
  }
  var CANON_FID = 0.0004       // Φ per CANON, capped by BOUGHT_FID_CAP with every other source
  var LOSS_DIV = 0.06          // a loss grows the opponent
  var LOSS_WILD = 0.03         // …and the act-level divergence threat you are otherwise suppressing

  var SLOW_S = 2.0             // §2: the 0.5 Hz band — divergence checks, spread, Successor logic

  // ───────────────────────────────────────────────────────────────────────────
  // TRANSIENT STATE — rebuilt from the save, never persisted
  // ───────────────────────────────────────────────────────────────────────────

  // The replication rate `bloom` produced this tick, per band. Drift is proportional to
  // newCraft_b / n_b (§13.1) — the mutation-per-copy model — so a parked fleet does not drift, and
  // that input can only come from the module that ran step 6. `bloom` pushes it through
  // noteReplication(); if it exposes a reader instead we pull. Absent both, drift is zero, which is
  // exactly right: with nothing replicating there is nothing to copy wrong.
  var newCraft = null
  var slowAcc = 0
  var lastMatrix = {}          // strainIndex → perturbed payoff matrix, memoised per seed
  var lastRounds = null        // the round-by-round of the encounter just played; never saved

  // ───────────────────────────────────────────────────────────────────────────
  // SMALL SHARED HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  function bands (s) { return s.a3.bands }
  function nBands () { return A().BANDS }
  function inVoid (s) { return !!s && s.act === 3 && (s.phase === 'void' || s.phase === 'dismantle') }

  // §6.1's definitions, not a second copy of an equation: X0_b and NCAP_b are stated as closed
  // forms of TUNE constants and are read here for quarantine pricing and crowding. `bloom` is
  // preferred wherever it exposes the same number, so there is one authority when both are loaded.
  function bandX0 (b) {
    if (HY.bloom && HY.bloom.bandX0) return num(HY.bloom.bandX0(b))
    var A3 = A()
    return b <= 0 ? A3.X0_BASE : A3.X0_BASE * Math.pow(A3.X0_GROWTH, b - 1)
  }

  function bandNCap (b) {
    if (HY.bloom && HY.bloom.NCAP) return Math.max(1, num(HY.bloom.NCAP(b)))
    return Math.max(1, bandX0(b) / A().NCAP_DIV)
  }

  function bandTau (b) {
    var A3 = A()
    var s = S()
    var tBal = s ? num(s.a3.loci[BAL]) : 0
    return A3.TAU0 * Math.pow(A3.TAU_GROWTH, Math.max(0, b - 1)) / (1 + LAW.BAL_TAU * tBal)
  }

  function block (s) {
    // §3's a3 block enumerates the *entities* — strains, succ, antiphony. The counters their verbs
    // need (how many have been sequenced, how much fidelity absorption has cost, which evacuations
    // are running) have nowhere else to live and must survive a reload, so they live here, in one
    // named sub-object created on init and migrated in if a save predates it.
    if (!s.a3.div || typeof s.a3.div !== 'object') {
      s.a3.div = {
        nextId: 1, sequenced: 0, absorbs: 0, quarantines: 0, fidDebt: 0,
        lines: {}, reverts: [], evac: [], coal: 0, wins: 0
      }
    }
    var d = s.a3.div
    if (!d.lines) d.lines = {}
    if (!d.reverts) d.reverts = []
    if (!d.evac) d.evac = []
    return d
  }

  function anti (s) {
    var a = s.a3.antiphony
    if (!a || typeof a !== 'object') { a = {}; s.a3.antiphony = a }
    if (!a.enc) {
      a.enc = []
      for (var i = 0; i < LADDER.length; i++) {
        a.enc.push({ tries: 0, best: '', div: LADDER[i].div, seen: 0, opened: -1, merges: 0 })
      }
    }
    if (!a.conds) a.conds = []
    if (!a.regs) a.regs = []
    if (!a.policy) a.policy = { rules: [], def: HOLD }
    if (!a.log) a.log = []
    if (typeof a.total !== 'number') a.total = 0
    if (typeof a.merges !== 'number') a.merges = 0
    if (typeof a.fidSpent !== 'number') a.fidSpent = 0
    return a
  }

  // One deterministic stream per event, keyed by the world seed and the event's own identity, so a
  // reload — or an offline reconcile — reproduces the same strain, the same mutation and the same
  // payoff matrix. `{stochastic:false}` does not need a second path: the stream is the path.
  function stream (s, tag, k) {
    return C().rng(C().hash32(s.seed >>> 0, tag, k | 0))
  }

  function spend (s, key, amount) {
    C().setStock(s.res, key, num(s.res[key]) - amount)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GENOMES
  // ───────────────────────────────────────────────────────────────────────────

  function playerGenome (s) {
    var g = new Int8Array(AXES.length), i
    for (i = 0; i < AXES.length; i++) g[i] = s.a3.loci[i] | 0
    return g
  }

  function genomeLength (g) {
    var t = 0, i
    for (i = 0; i < g.length; i++) t += g[i]
    return t
  }

  // The genome → response map of §9.2, for any genome. Named so the web reads as a web: every
  // caller here and in `bloom` asks the same eight questions of the same eight integers.
  function traits (g) {
    return {
      bal: num(g[BAL]), ger: num(g[GER]), myc: num(g[MYC]), spo: num(g[SPO]),
      mel: num(g[MEL]), dor: num(g[DOR]), fid: num(g[FID]), ant: num(g[ANT])
    }
  }

  function craftMassOf (g) {
    var A3 = A()
    return A3.CRAFT_M0 * Math.pow(1 + A3.GEN_TAX * genomeLength(g), A3.GEN_EXP)
  }

  // §13.4's absorption penalty is permanent and is not a project, so it cannot live in
  // `mult.boughtFid` (which is clamped non-negative and owned by the catalog). It is a debt, it is
  // read by every fidelity consumer through this function, and it is never repaid.
  function fidPenalty (s) {
    return num(block(s || S()).fidDebt)
  }

  function effFid (st) {
    var s = st || S()
    var A3 = A()
    var base
    if (HY.bloom && HY.bloom.effFid) base = num(HY.bloom.effFid(s))
    else {
      base = num(s.carry.fidelityBase) +
        A3.FID_PER_FID_LOCUS * num(s.a3.loci[FID]) -
        A3.FID_PER_ANT_LOCUS * num(s.a3.loci[ANT]) +
        num(s.mult.boughtFid)
    }
    return C().clamp(base - fidPenalty(s), A3.FID_MIN, A3.FID_MAX)
  }

  // §13.3 · MUTATION — you fight your own build.
  //
  //   drift = 1 + floor(b/3)   — the outer bands mutate harder, 1..5 swaps
  //   ~30% of loci move by ±drift, the total is preserved ±2, nothing goes below zero
  //
  // BIBLE D25 is enforced *through* the renormalisation, not before it: every repair step is only
  // allowed to move a locus that stays inside [yours − drift, yours + drift]. That is the whole
  // invariant, and __selftest asserts it directly over every band and ten thousand births.
  function mutate (genome, b, rand) {
    var A3 = A()
    var n = genome.length
    var g = new Int8Array(n)
    var d = 1 + Math.floor(Math.max(0, b) / 3)
    var r = rand || Math.random
    var i, k, guard

    for (i = 0; i < n; i++) g[i] = genome[i] | 0
    for (i = 0; i < n; i++) {
      if (r() < A3.MUT_P) g[i] = g[i] + (r() < 0.5 ? -d : d)
    }
    // Below zero is not a genome. Clamping toward zero always moves a locus *toward* the player's
    // value, which is itself ≥ 0, so the D25 window is never widened by this step.
    for (i = 0; i < n; i++) {
      if (g[i] < 0) g[i] = 0
      if (g[i] > A3.LOCI_MAX) g[i] = A3.LOCI_MAX
    }

    var want = genomeLength(genome)
    var slack = LAW.MUT_SLACK
    guard = 0
    while (genomeLength(g) > want + slack && guard++ < n * (d + 2)) {
      k = pickAdjustable(g, genome, d, -1, r, n)
      if (k < 0) break
      g[k] -= 1
    }
    guard = 0
    while (genomeLength(g) < want - slack && guard++ < n * (d + 2)) {
      k = pickAdjustable(g, genome, d, +1, r, n)
      if (k < 0) break
      g[k] += 1
    }
    return g
  }

  // A locus that may move by `step` without leaving the D25 window, the genome's own bounds, or
  // zero. Chosen from the stream so the repair is as reproducible as the mutation it repairs.
  function pickAdjustable (g, genome, d, step, r, n) {
    var A3 = A()
    var ok = [], i, v
    for (i = 0; i < n; i++) {
      v = g[i] + step
      if (v < 0 || v > A3.LOCI_MAX) continue
      if (Math.abs(v - genome[i]) > d) continue
      ok.push(i)
    }
    if (!ok.length) return -1
    return ok[Math.min(ok.length - 1, Math.floor(r() * ok.length))]
  }

  // §16. L1 distance from your current build, which is what makes a strain worth resolving: a
  // defector that is nearly you teaches you nothing and pays almost nothing.
  function novelty (strain, st) {
    var s = st || S()
    var mine = playerGenome(s)
    var d = 0, i
    for (i = 0; i < mine.length; i++) d += Math.abs(num(strain.genome[i]) - mine[i])
    return 1 + A().NOVELTY_K * d
  }

  function distance (strain, st) {
    var s = st || S()
    var mine = playerGenome(s)
    var d = 0, i
    for (i = 0; i < mine.length; i++) d += Math.abs(num(strain.genome[i]) - mine[i])
    return d
  }

  // ───────────────────────────────────────────────────────────────────────────
  // NAMING (§13.6)
  // ───────────────────────────────────────────────────────────────────────────

  function coinName (s) {
    var d = block(s)
    var used = {}, i
    // `meta.lineages` already holds every name this build has ever coined, across runs, and every
    // strain is archived at birth — so it is the used-name set, and a second list in the save would
    // be the same strings twice inside a 3 KB budget.
    var lin = s.meta && s.meta.lineages ? s.meta.lineages : []
    for (i = 0; i < lin.length; i++) if (lin[i] && lin[i].name) used[lin[i].name] = 1
    for (i = 0; i < s.a3.strains.length; i++) {
      if (s.a3.strains[i] && s.a3.strains[i].name) used[s.a3.strains[i].name] = 1
    }
    var r = stream(s, 'name', d.nextId)
    var epi = s.a3.succ ? EPITHET[r.int(EPITHET.length)] : ''
    var tries, p, sfx, nm
    for (tries = 0; tries < PREFIX.length * SUFFIX.length; tries++) {
      p = PREFIX[r.int(PREFIX.length)]
      sfx = SUFFIX[r.int(SUFFIX.length)]
      nm = p + sfx + epi
      if (!used[nm]) break
    }
    void d
    return nm
  }

  function archiveLineage (s, strain) {
    if (!s.meta || !s.meta.lineages) return
    var i
    for (i = 0; i < s.meta.lineages.length; i++) {
      if (s.meta.lineages[i] && s.meta.lineages[i].name === strain.name) return
    }
    var g = [], k
    for (k = 0; k < strain.genome.length; k++) g.push(strain.genome[k] | 0)
    s.meta.lineages.push({ name: strain.name, genome: g, born: Math.round(num(strain.born)) })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE SHARED ECONOMY (§7), PARAMETERISED BY GENOME
  // ───────────────────────────────────────────────────────────────────────────

  // §7.3–7.6 for an arbitrary population in an arbitrary band. There is one implementation of these
  // four equations in the build and this is it: `bloom` runs it for your fleet with your genome and
  // your triangle, and `step()` runs it here for every wild strain with theirs. Writing a second
  // copy for the wild is how the mirror match stops being a mirror.
  //
  //   opts.other      craft in the band that are not this population's (crowds through sat_b)
  //   opts.harvMult   the harvest multiplier of whoever owns this population; the wild have none
  //   opts.replMult   likewise for replication
  //   opts.aRep       the fraction of surplus this population reinvests
  function rates (b, genome, count, opts) {
    var s = S()
    var A3 = A()
    var o = opts || {}
    var t = traits(genome)
    var bd = bands(s)
    var ncap = bandNCap(b)
    var X = Math.max(0, num(bd.X[b]))
    var X0 = bandX0(b)
    var e = C().clamp(num(bd.e[b]), 0, 1)
    var rich = num(bd.rich[b]) || 1

    var occSelf = count / ncap
    var occOther = (num(o.other) / ncap) / (1 + LAW.ANT_CROWD * t.ant)
    var occ = occSelf + occOther
    var sat = 1 / (1 + occ)
    var dep = Math.pow(C().clamp(X0 > 0 ? X / X0 : 0, 0, 1), LAW.DEP_EXP)

    var muMyc = (1 + LAW.MYC_GAIN * t.myc) / (1 + LAW.MEL_HARV * t.mel) *
      Math.max(LAW.DOR_FLOOR, 1 - LAW.DOR_HARV * t.dor)
    var Ab = A3.HARV_K * muMyc * e * rich * dep * (o.harvMult === undefined ? 1 : num(o.harvMult))
    var harvest = count * Ab * sat

    var muDor = 1 - LAW.DOR_SUB_A * (1 - Math.exp(-LAW.DOR_SUB_B * t.dor))
    var subsist = count * A3.SUB_K * muDor
    var deficit = Math.max(0, subsist - harvest)
    var mass = craftMassOf(genome)
    var starve = deficit / (mass * LAW.STARVE_FRAC)

    var muSpo = (1 + LAW.SPO_GAIN * t.spo) * Math.max(LAW.DOR_FLOOR, 1 - LAW.DOR_REP * t.dor)
    var repMult = o.replMult === undefined ? 1 : num(o.replMult)
    var repDemand = count * A3.REP_K * muSpo * repMult * (1 - occ / (occ + LAW.REP_DAMP))
    var surplus = harvest - subsist
    var aRep = o.aRep === undefined ? LAW.WILD_AREP : num(o.aRep)
    var repActual = Math.min(repDemand, Math.max(0, surplus) * aRep / mass)

    return {
      occ: occ, sat: sat, dep: dep, A: Ab, mass: mass,
      harvest: harvest, subsist: subsist, surplus: surplus,
      starve: starve, repDemand: repDemand, repActual: repActual,
      rad: A3.RAD_K * (1 + LAW.RAD_BAND * b) / Math.pow(1 + LAW.MEL_RAD * t.mel, LAW.MEL_RAD_EXP),
      sen: A3.SEN_K / (1 + LAW.DOR_SEN * t.dor)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WILD OCCUPANCY — what `bloom` and `finale` read across the boundary
  // ───────────────────────────────────────────────────────────────────────────

  function living (s) {
    var out = s.a3.strains || [], i, keep = []
    for (i = 0; i < out.length; i++) if (out[i] && out[i].genome) keep.push(out[i])
    if (keep.length !== out.length) s.a3.strains = keep
    return keep
  }

  function wildOcc (b, st) {
    var s = st || S()
    if (!s) return 0
    var list = living(s), i, w = 0
    for (i = 0; i < list.length; i++) w += Math.max(0, num(list[i].w[b]))
    if (s.a3.succ && s.a3.succ.w) w += Math.max(0, num(s.a3.succ.w[b]))
    return w
  }

  function totalWild (st) {
    var s = st || S()
    if (!s) return 0
    var n = nBands(), b, w = 0
    for (b = 0; b < n; b++) w += wildOcc(b, s)
    return w
  }

  function totalMine (s) {
    var bd = bands(s), i, t = 0
    for (i = 0; i < bd.n.length; i++) t += Math.max(0, num(bd.n[i]))
    return t
  }

  function wildShare (b, st) {
    var s = st || S()
    var w = wildOcc(b, s)
    var mine = Math.max(0, num(bands(s).n[b]))
    return w + mine > 0 ? w / (w + mine) : 0
  }

  // feel.js binding 9: divergence is audible as beating that speeds up, and fixing fidelity slows
  // it. Both of these are read every frame, so both are cheap and neither allocates.
  function strainShare (st) {
    var s = st || S()
    if (!s) return 0
    var w = totalWild(s), mine = totalMine(s)
    return w + mine > 0 ? w / (w + mine) : 0
  }

  function driftFraction (st) {
    var s = st || S()
    if (!s) return 0
    var bd = bands(s), i, m = 0
    for (i = 0; i < bd.drift.length; i++) if (bd.drift[i] > m) m = bd.drift[i]
    return C().clamp(m / A().DRIFT_TRIG, 0, 1)
  }

  // The fleet-weighted mean Antagonism of the strains in a band (§11.6's s̄.tAnt), and the
  // predation rate it drives. `bloom` owns the attribution; this owns the number.
  function meanAnt (b, s) {
    var list = living(s), i, w, tot = 0, acc = 0
    for (i = 0; i < list.length; i++) {
      w = Math.max(0, num(list[i].w[b]))
      if (w <= 0) continue
      tot += w
      acc += w * num(list[i].genome[ANT])
    }
    if (s.a3.succ && s.a3.succ.w) {
      w = Math.max(0, num(s.a3.succ.w[b]))
      if (w > 0) { tot += w; acc += w * num(s.a3.succ.genome[ANT]) }
    }
    return tot > 0 ? acc / tot : 0
  }

  function predationRate (b, st) {
    var s = st || S()
    if (!s) return 0
    var A3 = A()
    var k = A3.SKIRM_K * (flagOn(s, 'somatic_incompatibility') ? LAW.SOMATIC_SKIRM : 1)
    return k * wildShare(b, s) * (1 + LAW.ANT_LETHAL * meanAnt(b, s)) /
      (1 + LAW.MEL_TOUGH * num(s.a3.loci[MEL]))
  }

  function attributePredation (s, count) {
    if (!(count > 0)) return
    if (HY.bloom && HY.bloom.attribute) {
      try { HY.bloom.attribute('PREDATION', count); return } catch (e) { void 0 }
    }
    // PREDATION is index 5 of §3's six causes; writing it directly keeps the panel honest in a
    // build where `bloom` has not been concatenated yet.
    s.a3.mortality[5] = num(s.a3.mortality[5]) + count
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DRIFT (§13.1) AND THE DIVERGENCE EVENT (§13.2)
  // ───────────────────────────────────────────────────────────────────────────

  // `bloom` tells us what it replicated this tick. Drift is per copy, not per craft: a parked fleet
  // does not drift however large it is, which is the mutation-per-copy model and correct biology.
  function noteReplication (b, rate) {
    if (!newCraft) newCraft = new Float64Array(nBands())
    if (b >= 0 && b < newCraft.length) newCraft[b] = num(rate)
  }

  function replicatedIn (b) {
    if (newCraft && newCraft[b] > 0) return newCraft[b]
    if (HY.bloom && HY.bloom.newCraftIn) return num(HY.bloom.newCraftIn(b))
    return 0
  }

  // §13.1's table is tabulated at "steady-state replication, newCraft/n ≈ 0.0375" — a copy rate the
  // engine cannot reach. REP_K is 0.0250/s before the crowding damp, so a fleet sitting at its own
  // max-surplus occupancy and pouring every last unit of surplus into REPLICATE copies itself at
  // 0.0250·(1 − 7.17/(7.17 + 12)) = 0.01565/s, which is 42% of what the MTBD column assumes. Taken
  // literally the published drift/s is therefore 2.4× too slow everywhere, and because DRIFT_DECAY
  // is subtracted flat at 6.0e-4·Φ that shortfall is not a slower act — it is a different act.
  // Measured at Φ 0.818 (a legacy-0.35 run with no Fidelity loci, which §13.1 puts at a divergence
  // every four hundred seconds): accumulation 4.2e-4/s against decay 4.9e-4/s, so drift never rose
  // at all. Two hundred and twenty minutes of void produced zero strains, zero alleles, no
  // coalescence and no Successor, which closes ENDING C and empties half the act.
  //
  // So the copy rate is read as a fraction of the fastest the act can actually copy, and that
  // fraction is what §13.1's reference stands for. Every one of the section's four statements
  // survives unchanged — a parked fleet still does not drift, infidelity is still superlinear, the
  // far bands still copy worse, a longer genome still copies worse — and the MTBD column becomes
  // true of a fleet doing the most replication the game permits rather than of one that cannot
  // exist. The REPLICATE vertex now sets divergence in the same proportion it sets growth, which is
  // §13's own first line: replication ↑ → divergence ↑.
  function copyRate (b) {
    var A3 = A()
    var nb = Math.max(1, num(bands(S()).n[b]))
    var occ = A3.N_STAR_K
    var repMax = A3.REP_K * (1 - occ / (occ + LAW.REP_DAMP))
    if (!(repMax > 0)) return 0
    return (replicatedIn(b) / nb) * (LAW.DRIFT_REP_REF / repMax)
  }

  function stepDrift (dt, opts) {
    var s = S()
    if (!s || !inVoid(s) || !(dt > 0)) return
    var A3 = A()
    var bd = bands(s)
    var fid = effFid(s)
    var G = genomeLength(playerGenome(s))
    var infid = Math.pow(Math.max(0, 1 - fid), A3.DRIFT_FID_EXP)
    var lengthTerm = 1 + LAW.DRIFT_PER_LOCUS * G
    var n = nBands(), b, nb, add

    for (b = 0; b < n; b++) {
      nb = Math.max(0, num(bd.n[b]))
      add = 0
      if (nb > 0) {
        add = A3.DRIFT_K * copyRate(b) * infid *
          (1 + LAW.DRIFT_PER_BAND * b) * lengthTerm * dt
      }
      bd.drift[b] = C().clamp(num(bd.drift[b]) + add - A3.DRIFT_DECAY * fid * dt, 0, 1)
      // §22: drift accumulates and strains ARE born offline. Pausing the act's own clock while the
      // player is away would make absence a fidelity cheat, which is the one thing it must not be.
      if (bd.drift[b] >= A3.DRIFT_TRIG) onDrift(b)
    }
    if (newCraft) for (b = 0; b < n; b++) newCraft[b] = 0
    void opts
  }

  function onDrift (b) {
    var s = S()
    if (!s) return null
    var A3 = A()
    var bd = bands(s)
    var d = block(s)
    bd.drift[b] = 0

    var fid = effFid(s)
    var frac = C().clamp(A3.DEFECT_MIN + LAW.DEFECT_FID * (1 - fid), A3.DEFECT_MIN, A3.DEFECT_MAX)
    var defectors = Math.max(0, num(bd.n[b])) * frac
    if (!(defectors > 0)) return null
    bd.n[b] = num(bd.n[b]) - defectors

    var r = stream(s, 'strain', d.nextId)
    var strain = {
      id: d.nextId++,
      name: coinName(s),
      genome: mutate(playerGenome(s), b, r.next),
      w: new Float64Array(nBands()),
      origin: b,
      born: s.t,
      sequenced: false,
      quarantinedUntil: 0,
      carbonHeld: 0,
      eng: null
    }
    strain.w[b] = defectors
    s.a3.strains.push(strain)
    s.stats.strainsBorn = num(s.stats.strainsBorn) + 1
    archiveLineage(s, strain)

    // Six is the cap on cards, not on history: the two oldest merge rather than the newest being
    // refused, so a long run's antagonist keeps getting older and stranger instead of being capped
    // at whatever you last provoked.
    if (s.a3.strains.length > A3.MAX_STRAINS) coalesceOldestTwo(s)

    fire('a3.first_drift', { strain: strain.name, band: b, b: b })
    feel('divergence', {})
    return strain
  }

  function coalesceOldestTwo (s) {
    var list = living(s)
    if (list.length < 2) return
    list.sort(function (x, y) { return num(x.born) - num(y.born) })
    var a = list[0], bb = list[1]
    var i, wa = 0, wb = 0
    for (i = 0; i < a.w.length; i++) { wa += num(a.w[i]); wb += num(bb.w[i]) }
    var tot = wa + wb
    for (i = 0; i < a.w.length; i++) a.w[i] = num(a.w[i]) + num(bb.w[i])
    if (tot > 0) {
      for (i = 0; i < a.genome.length; i++) {
        a.genome[i] = Math.round((num(a.genome[i]) * wa + num(bb.genome[i]) * wb) / tot)
      }
    }
    a.sequenced = a.sequenced && bb.sequenced
    removeStrain(s, bb, false)
  }

  function removeStrain (s, strain, archive) {
    var list = s.a3.strains, i
    for (i = 0; i < list.length; i++) {
      if (list[i] === strain) { list.splice(i, 1); break }
    }
    if (archive) archiveLineage(s, strain)
  }

  function findStrain (s, id) {
    if (id === 'succ' || id === -1) return s.a3.succ
    var list = living(s), i
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i]
    return null
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE WILD ECONOMIES (§14.4)
  // ───────────────────────────────────────────────────────────────────────────

  function stepOne (s, e, dt) {
    var bd = bands(s)
    var n = nBands(), b, w, r, mine, others, grow
    var mass = craftMassOf(e.genome)
    for (b = 0; b < n; b++) {
      w = Math.max(0, num(e.w[b]))
      if (w <= 0) { e.w[b] = 0; continue }
      mine = Math.max(0, num(bd.n[b]))
      others = mine + (wildOcc(b, s) - w)
      r = rates(b, e.genome, w, { other: others, harvMult: 1, replMult: 1, aRep: LAW.WILD_AREP })

      // Wild craft eat the same carbon you do, out of the same band, through the same sat_b. There
      // is no share term anywhere in Act III: competition is Lotka–Volterra and it is four lines.
      bd.X[b] = Math.max(0, num(bd.X[b]) - r.harvest * dt)

      grow = r.repActual - w * (r.rad + r.sen)
      if (r.starve > 0) {
        grow -= r.starve
        bd.X[b] = num(bd.X[b]) + r.starve * mass * LAW.STARVE_FRAC * LAW.STARVE_RECOVER * dt
      }
      e.w[b] = Math.max(0, w + grow * dt)
      e.carbonHeld = num(e.carbonHeld) + Math.max(0, r.surplus) * (1 - LAW.WILD_AREP) * dt
    }
  }

  function stepStrains (dt, opts) {
    var s = S()
    if (!s || !inVoid(s) || !(dt > 0)) return
    var list = living(s), i
    for (i = 0; i < list.length; i++) stepOne(s, list[i], dt)
    if (s.a3.succ) stepOne(s, s.a3.succ, dt)
    // A strain reduced to nothing by its own appetite is gone, and it pays nothing: alleles come
    // from resolving divergence, not from outliving it.
    for (i = list.length - 1; i >= 0; i--) {
      if (totalOf(list[i]) < 1) removeStrain(s, list[i], true)
    }
    void opts
  }

  function totalOf (e) {
    var i, t = 0
    for (i = 0; i < e.w.length; i++) t += Math.max(0, num(e.w[i]))
    return t
  }

  // §14.4. Strains spread both ways — they are not going anywhere — at a rate their own Ballistics
  // sets. Quarantine stops it dead; J4 makes your own bands hostile ground.
  function stepSpread (dtSlow) {
    var s = S()
    if (!s || !inVoid(s) || !(dtSlow > 0)) return
    var A3 = A()
    var bd = bands(s)
    var list = living(s)
    if (s.a3.succ) list = list.concat([s.a3.succ])
    var hetero = flagOn(s, 'heterokaryon_incompatibility')
    var n = nBands(), i, b, e, out, half, into

    for (i = 0; i < list.length; i++) {
      e = list[i]
      if (num(e.quarantinedUntil) > s.t) continue
      var w = new Float64Array(n)
      for (b = 0; b < n; b++) w[b] = Math.max(0, num(e.w[b]))
      for (b = 0; b < n; b++) {
        if (w[b] <= 0) continue
        out = w[b] * A3.SPREAD_K * (1 + LAW.BAL_SPREAD * num(e.genome[BAL])) * dtSlow
        if (out <= 0) continue
        if (out > w[b]) out = w[b]
        half = out / 2
        e.w[b] = num(e.w[b]) - out
        if (b - 1 >= 0) {
          into = hetero && num(bd.n[b - 1]) > 0 ? half * LAW.HETERO_SPREAD : half
          e.w[b - 1] = num(e.w[b - 1]) + into
        }
        if (b + 1 < n) {
          into = hetero && num(bd.n[b + 1]) > 0 ? half * LAW.HETERO_SPREAD : half
          e.w[b + 1] = num(e.w[b + 1]) + into
        }
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SEQUENCING (§13.5) — the information economy
  // ───────────────────────────────────────────────────────────────────────────

  function seqCost (st) {
    var s = st || S()
    var A3 = A()
    return Math.ceil(A3.SEQ_A * Math.pow(A3.SEQ_G, num(block(s).sequenced)))
  }

  function sequence (strainId) {
    var s = S()
    if (!s || !flagOn(s, 'sequencer')) return false
    var e = findStrain(s, strainId)
    if (!e || e.sequenced) return false
    var cost = seqCost(s)
    if (num(s.res.insight) < cost) return false
    spend(s, 'insight', cost)
    e.sequenced = true
    block(s).sequenced += 1
    fire('a3.sequence', { strain: e.name || '—', k: distance(e, s) })
    return true
  }

  // Unsequenced, a strain's genome is known only as a range: the mutation rule is public, so
  // g_k ∈ [yours_k − drift, yours_k + drift]. That is the quantified unknown the prediction band
  // is drawn from, and it is the thing Paperclips' combat has no version of.
  function knownGenome (s, e) {
    var d = 1 + Math.floor(Math.max(0, num(e.origin)) / 3)
    var mine = playerGenome(s)
    var lo = new Int8Array(mine.length), hi = new Int8Array(mine.length), i
    for (i = 0; i < mine.length; i++) {
      lo[i] = Math.max(0, mine[i] - d)
      hi[i] = Math.min(A().LOCI_MAX, mine[i] + d)
    }
    return { drift: d, lo: lo, hi: hi }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ENGAGEMENTS (§14) — Lanchester's square law
  // ───────────────────────────────────────────────────────────────────────────

  function betaA (s, foeMel, sequenced, band) {
    var b = (1 + LAW.ANT_LETHAL * num(s.a3.loci[ANT])) * (1 + (sequenced ? LAW.SEQ_BETA : 0)) /
      (1 + LAW.MEL_TOUGH * foeMel)
    // The ANTAGONISE pulse is read continuously rather than latched, so a window that opened before
    // an autosave is still open after the reload. `cognition` owns the falloff.
    if (HY.cognition && HY.cognition.pulseEffect) {
      b *= 1 + LAW.ANTAGONISE_BETA * num(HY.cognition.pulseEffect('ANTAGONISE', band))
    }
    return b
  }

  function betaB (s, foeAnt) {
    return (1 + LAW.ANT_LETHAL * foeAnt) / (1 + LAW.MEL_TOUGH * num(s.a3.loci[MEL]))
  }

  // The Successor is fought across all thirteen bands at once, so its β terms use fleet-weighted
  // means of the traits actually present rather than a single band's.
  function foeTraits (s, e) {
    if (e === s.a3.succ) return { mel: weighted(e, MEL), ant: weighted(e, ANT) }
    return { mel: num(e.genome[MEL]), ant: num(e.genome[ANT]) }
  }

  function weighted (e, axis) {
    var i, w, tot = 0
    for (i = 0; i < e.w.length; i++) tot += Math.max(0, num(e.w[i]))
    if (!(tot > 0)) return num(e.genome[axis])
    w = 0
    for (i = 0; i < e.w.length; i++) w += Math.max(0, num(e.w[i])) * num(e.genome[axis])
    return w / tot
  }

  function strongestBand (e) {
    var i, b = 0, m = -1
    for (i = 0; i < e.w.length; i++) if (num(e.w[i]) > m) { m = num(e.w[i]); b = i }
    return b
  }

  function maxConcurrent (st) {
    var s = st || S()
    var n = 1
    if (flagOn(s, 'parallel_antagonism')) n += 1
    if (s.meta && s.meta.upgrades && s.meta.upgrades.indexOf('anastomosis') >= 0) n += 1
    return n
  }

  function engagements (st) {
    var s = st || S()
    var list = living(s), out = [], i
    for (i = 0; i < list.length; i++) if (list[i].eng) out.push(list[i])
    if (s.a3.succ && s.a3.succ.eng) out.push(s.a3.succ)
    return out
  }

  // Closed form, both sides, live. `commit` is the fraction of your craft in the engaged band —
  // the slider's own units — and the prediction is drawn from it directly, so the bar moves as the
  // thumb does.
  function predict (strainId, commit) {
    var s = S()
    if (!s) return null
    var e = findStrain(s, strainId)
    if (!e) return null
    var isSucc = e === s.a3.succ
    var band = e.eng ? e.eng.band : strongestBand(e)
    var A0 = e.eng ? num(e.eng.A) : available(s, e, band) * C().clamp(num(commit), 0, 1)
    var B0 = isSucc ? totalOf(e) : Math.max(0, num(e.w[band]))
    var known = knownGenome(s, e)
    var ft = foeTraits(s, e)

    if (e.sequenced || isSucc) return outcome(s, e, A0, B0, ft.mel, ft.ant, band, true)
    // The band is the honest width of what you do not know: the worst enemy consistent with the
    // mutation rule — the toughest and the most lethal it could be — and the mildest. Unsequenced,
    // it often spans "decisive win" to "total loss", and that width is what Ψ actually buys.
    var worst = outcome(s, e, A0, B0, num(known.hi[MEL]), num(known.hi[ANT]), band, false)
    var best = outcome(s, e, A0, B0, num(known.lo[MEL]), num(known.lo[ANT]), band, false)
    var mid = outcome(s, e, A0, B0, ft.mel, ft.ant, band, false)
    mid.lo = worst
    mid.hi = best
    mid.wide = true
    return mid
  }

  function outcome (s, e, A0, B0, foeMel, foeAnt, band, sequenced) {
    var A3 = A()
    var isSucc = e === s.a3.succ
    var bA = betaA(s, foeMel, sequenced, band) *
      (isSucc && flagOn(s, 'somatic_incompatibility') ? LAW.SOMATIC_BETA : 1)
    var bB = betaB(s, foeAnt)
    var lhs = bA * A0 * A0
    var rhs = bB * B0 * B0
    var win = lhs > rhs
    var survivors = win
      ? Math.sqrt(Math.max(0, A0 * A0 - (bB / bA) * B0 * B0))
      : Math.sqrt(Math.max(0, B0 * B0 - (bA / bB) * A0 * A0))
    // The square law is asymptotic at parity, so the quoted time is the ratio of effective
    // strengths through atanh, floored by the same stalemate threshold stepEngagements resolves on.
    var ratio = win
      ? (A0 > 0 ? (B0 / A0) * Math.sqrt(bB / bA) : 1)
      : (B0 > 0 ? (A0 / B0) * Math.sqrt(bA / bB) : 1)
    ratio = C().clamp(ratio, 0, 1 - LAW.STALEMATE)
    var k = A3.COMBAT_K * Math.sqrt(Math.max(1e-12, bA * bB)) / (isSucc ? LAW.SUCC_RESOLVE : 1)
    var t = k > 0 ? Math.atanh(ratio) / k : 0
    return {
      band: band, A: A0, B: B0, betaA: bA, betaB: bB, win: win,
      survivors: survivors, tResolve: t, sequenced: sequenced, wide: false,
      alleles: win ? alleleAward(s, e, B0, isSucc) : 0
    }
  }

  function alleleAward (s, e, destroyed, isSucc) {
    var A3 = A()
    if (!(destroyed > 0)) return 0
    var k = isSucc ? A3.ALPHA_SUCC : A3.ALPHA_PURGE
    return Math.floor(k * Math.pow(alleleUnits(destroyed), A3.ALPHA_EXP) * novelty(e, s))
  }

  function available (s, e, band) {
    if (e === s.a3.succ) return totalMine(s)
    return Math.max(0, num(bands(s).n[band]))
  }

  function engage (strainId, commit) {
    var s = S()
    if (!s || !inVoid(s)) return false
    var e = findStrain(s, strainId)
    if (!e || e.eng) return false
    if (engagements(s).length >= maxConcurrent(s)) return false
    var isSucc = e === s.a3.succ
    var band = isSucc ? strongestBand(e) : strongestBand(e)
    var pool = available(s, e, band)
    var take = pool * C().clamp(num(commit), 0, 1)
    if (!(take > 0)) return false

    // Committing is a real withdrawal: the craft leave the band's economy for the length of the
    // fight, which is why 60% of your fleet is worth 0.36 of it and why the threshold is sharp.
    if (isSucc) drawFromAll(s, take)
    else bands(s).n[band] = pool - take

    e.eng = {
      band: band, A: take, A0: take, B0: isSucc ? totalOf(e) : Math.max(0, num(e.w[band])),
      startedAt: s.t, lastReinforce: -LAW.REINFORCE_CD, succ: isSucc
    }
    s.stats.engagements = num(s.stats.engagements) + 1
    feel('combat.engage', { userInitiated: true })
    return true
  }

  function drawFromAll (s, take) {
    var bd = bands(s), tot = totalMine(s), i
    if (!(tot > 0)) return
    for (i = 0; i < bd.n.length; i++) {
      bd.n[i] = Math.max(0, num(bd.n[i]) - take * (num(bd.n[i]) / tot))
    }
  }

  function returnTo (s, e, count) {
    if (!(count > 0)) return
    var bd = bands(s)
    if (e.eng && e.eng.succ) {
      var tot = totalMine(s), i
      if (tot > 0) {
        for (i = 0; i < bd.n.length; i++) bd.n[i] = num(bd.n[i]) + count * (num(bd.n[i]) / tot)
        return
      }
      bd.n[0] = num(bd.n[0]) + count
      return
    }
    bd.n[e.eng.band] = num(bd.n[e.eng.band]) + count
  }

  function reinforce (strainId) {
    var s = S()
    if (!s) return false
    var e = strainId === undefined ? engagements(s)[0] : findStrain(s, strainId)
    if (!e || !e.eng) return false
    if (s.t - num(e.eng.lastReinforce) < LAW.REINFORCE_CD) return false
    var pool = available(s, e, e.eng.band)
    var take = pool * A().REINFORCE_FRAC
    if (!(take > 0)) return false
    if (e.eng.succ) drawFromAll(s, take)
    else bands(s).n[e.eng.band] = pool - take
    e.eng.A = num(e.eng.A) + take
    e.eng.lastReinforce = s.t
    return true
  }

  function withdraw (strainId) {
    var s = S()
    if (!s) return false
    var e = strainId === undefined ? engagements(s)[0] : findStrain(s, strainId)
    if (!e || !e.eng) return false
    var kept = num(e.eng.A) * A().WITHDRAW_RECOVER
    var lost = num(e.eng.A) - kept
    returnTo(s, e, kept)
    attributePredation(s, lost)
    e.eng = null
    return true
  }

  // BIBLE §4 step 8. An engagement is the act's skill and never resolves offline: you come back to
  // it exactly where you left it, with the same decision still in front of you.
  function stepEngagements (dt, opts) {
    var s = S()
    if (!s || s.act !== 3 || !(dt > 0)) return
    var o = opts || {}
    if (o.offline) return
    var A3 = A()
    var list = engagements(s), i, e, eng, ft, bA, bB, dA, dB, B

    for (i = 0; i < list.length; i++) {
      e = list[i]
      eng = e.eng
      var isSucc = !!eng.succ
      ft = foeTraits(s, e)
      bA = betaA(s, ft.mel, e.sequenced, eng.band) *
        (isSucc && flagOn(s, 'somatic_incompatibility') ? LAW.SOMATIC_BETA : 1)
      bB = betaB(s, ft.ant)
      B = isSucc ? totalOf(e) : Math.max(0, num(e.w[eng.band]))
      var k = A3.COMBAT_K / (isSucc ? LAW.SUCC_RESOLVE : 1)

      dA = Math.min(k * B * bB * dt, num(eng.A))
      dB = k * num(eng.A) * bA * dt
      eng.A = num(eng.A) - dA
      attributePredation(s, dA)
      applyLoss(s, e, eng, dB)
      B = isSucc ? totalOf(e) : Math.max(0, num(e.w[eng.band]))

      if (B <= num(eng.B0) * LAW.STALEMATE) { resolveWin(s, e); continue }
      if (num(eng.A) <= num(eng.A0) * LAW.STALEMATE) {
        // A lost engagement is not a lost run: the committed craft are gone, attributed, and the
        // strain is still there. That is the whole punishment and it is enough.
        attributePredation(s, num(eng.A))
        e.eng = null
        feel('combat.loss', {})
      }
    }
  }

  function applyLoss (s, e, eng, count) {
    if (!(count > 0)) return
    if (!eng.succ) {
      e.w[eng.band] = Math.max(0, num(e.w[eng.band]) - count)
      return
    }
    var tot = totalOf(e), i
    if (!(tot > 0)) return
    for (i = 0; i < e.w.length; i++) e.w[i] = Math.max(0, num(e.w[i]) - count * (num(e.w[i]) / tot))
  }

  function resolveWin (s, e) {
    var eng = e.eng
    var destroyed = Math.max(0, num(eng.B0) - (eng.succ ? totalOf(e) : num(e.w[eng.band])))
    returnTo(s, e, num(eng.A))
    e.eng = null
    block(s).wins += 1
    feel('combat.win', {})
    purge(e === s.a3.succ ? 'succ' : e.id, destroyed)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE THREE RESPONSES (§13.4) — three verbs, three currencies, three horizons
  // ───────────────────────────────────────────────────────────────────────────

  // PURGE. One of exactly three places in the build where `res.alleles` is written.
  function purge (strainId, destroyedOverride) {
    var s = S()
    if (!s) return 0
    var e = findStrain(s, strainId)
    if (!e) return 0
    var isSucc = e === s.a3.succ
    var destroyed = destroyedOverride === undefined ? totalOf(e) : destroyedOverride
    if (!isSucc && e.eng && destroyedOverride === undefined) return 0   // still being fought for
    var gained = alleleAward(s, e, destroyed, isSucc)
    if (gained > 0) C().setStock(s.res, 'alleles', num(s.res.alleles) + gained)

    if (isSucc) {
      // The largest single α award in the game, and every lineage it ever contained is archived.
      var lines = s.a3.succ.lines || []
      for (var i = 0; i < lines.length; i++) archiveLineage(s, lines[i])
      archiveLineage(s, s.a3.succ)
      s.a3.succ = null
    } else {
      removeStrain(s, e, true)
    }
    s.stats.purged = num(s.stats.purged) + 1
    fire('a3.purge', { strain: e.name || '—', k: gained })
    return gained
  }

  function absorbCost (st) {
    var s = st || S()
    var sc = HY.cognition && HY.cognition.Sc ? num(HY.cognition.Sc(s)) : 0
    return {
      sig: LAW.ABSORB_SIG * sc,
      psi: Math.ceil(LAW.ABSORB_PSI_A * Math.pow(LAW.ABSORB_PSI_G, num(block(s).absorbs)))
    }
  }

  // ABSORB. Reintegration: the second of the three α sources, and the only one that pays for
  // patience — because α scales as totalW^0.30 and strains grow exponentially, a strain left for
  // twelve minutes is worth 3.1× one absorbed immediately. Farming your own defectors is a genuine,
  // discoverable, slightly horrifying optimisation and nothing in the build mentions it.
  function absorb (strainId) {
    var s = S()
    if (!s || !flagOn(s, 'anastomosis_offer')) return 0
    var e = findStrain(s, strainId)
    if (!e || e === s.a3.succ) return 0        // the Successor cannot be absorbed (§15.5)
    var d = block(s)
    var cost = absorbCost(s)
    if (num(s.res.signal) < cost.sig || num(s.res.insight) < cost.psi) return 0
    spend(s, 'signal', cost.sig)
    spend(s, 'insight', cost.psi)

    var A3 = A()
    var totW = totalOf(e)
    var nov = novelty(e, s)
    var gained = Math.floor(A3.ALPHA_ABSORB * Math.pow(alleleUnits(totW), A3.ALPHA_EXP) * nov)
    if (gained > 0) C().setStock(s.res, 'alleles', num(s.res.alleles) + gained)

    var bd = bands(s), i
    for (i = 0; i < e.w.length; i++) {
      bd.n[i] = num(bd.n[i]) + Math.max(0, num(e.w[i])) * LAW.ABSORB_MERGE
    }

    // §13.4's free locus, once per lineage line, and only for a genome strange enough to be worth
    // having. It lands in `lociBought` because that is the field that means "loci you may allocate
    // beyond the free four" — the gene really is yours, and the next locus you buy is priced as if
    // you had bought this one, which is the same genome tax every other gene in the act pays.
    var line = (e.name || '').slice(0, 3)
    if (nov >= LAW.ABSORB_LOCUS_NOV && !d.lines[line]) {
      s.a3.lociBought = num(s.a3.lociBought) + LAW.FREE_LOCUS
      d.lines[line] = 1
    }

    // You took in foreign genes. The debt is permanent, it is read by every fidelity consumer, and
    // it is why the allele-maximising line is also the line that stops you copying yourself.
    var before = effFid(s)
    d.fidDebt = num(d.fidDebt) + LAW.ABSORB_FID * (1 - before)
    d.absorbs += 1
    s.stats.absorbed = num(s.stats.absorbed) + 1

    // The revert is rolled once, 300 s later, against the fidelity you have *after* the absorption.
    d.reverts.push({
      at: s.t + LAW.REVERT_DELAY, count: totW * LAW.REVERT_MULT,
      genome: Array.prototype.slice.call(e.genome), band: e.origin, name: e.name
    })
    removeStrain(s, e, true)
    fire('a3.absorb', { strain: e.name || '—', k: gained })
    return gained
  }

  function stepReverts (s) {
    var d = block(s)
    if (!d.reverts.length) return
    var keep = [], i, rec, r
    for (i = 0; i < d.reverts.length; i++) {
      rec = d.reverts[i]
      if (num(rec.at) > s.t) { keep.push(rec); continue }
      r = stream(s, 'revert', Math.round(num(rec.at)))
      if (r.next() < 1 - effFid(s)) spawnRevert(s, rec, r)
    }
    d.reverts = keep
  }

  function spawnRevert (s, rec, r) {
    var d = block(s)
    var base = new Int8Array(rec.genome.length), i
    for (i = 0; i < rec.genome.length; i++) base[i] = rec.genome[i] | 0
    var band = C().clamp(num(rec.band) | 0, 0, nBands() - 1)
    var g = mutate(mutate(base, band, r.next), band, r.next)
    var strain = {
      id: d.nextId++, name: coinName(s), genome: g, w: new Float64Array(nBands()),
      origin: band, born: s.t, sequenced: false, quarantinedUntil: 0, carbonHeld: 0, eng: null
    }
    strain.w[band] = Math.max(0, num(rec.count))
    s.a3.strains.push(strain)
    s.stats.strainsBorn = num(s.stats.strainsBorn) + 1
    archiveLineage(s, strain)
    if (s.a3.strains.length > A().MAX_STRAINS) coalesceOldestTwo(s)
    fire('a3.first_drift', { strain: strain.name, band: band, b: band })
  }

  function quarantineCost (b) { return LAW.QT_COST * bandX0(b) }

  function quarantineTime (s) {
    return LAW.QT_BASE / (1 + LAW.QT_DECAY * num(block(s).quarantines))
  }

  // QUARANTINE. Cede the band. It pays no alleles at all, which is the point: the cheap answer to
  // divergence is the one that leaves you exactly as capped as you were.
  function quarantine (strainId) {
    var s = S()
    if (!s || !flagOn(s, 'interference_competition')) return false
    var e = findStrain(s, strainId)
    if (!e || e === s.a3.succ) return false    // the Successor cannot be quarantined (§15.5)
    var b = strongestBand(e)
    var cost = quarantineCost(b)
    if (num(s.res.carbon) < cost) return false
    spend(s, 'carbon', cost)
    var d = block(s)
    e.quarantinedUntil = s.t + quarantineTime(s)
    d.quarantines += 1
    s.stats.quarantined = num(s.stats.quarantined) + 1
    // Your own fleet leaves over thirty seconds, outward if there is anywhere outward to go.
    d.evac.push({ band: b, to: b + 1 < nBands() ? b + 1 : b - 1, until: s.t + LAW.EVAC_S })
    return true
  }

  function stepEvac (s, dt) {
    var d = block(s)
    if (!d.evac.length) return
    var bd = bands(s), keep = [], i, rec, move
    for (i = 0; i < d.evac.length; i++) {
      rec = d.evac[i]
      if (rec.to < 0) continue
      move = Math.max(0, num(bd.n[rec.band])) * Math.min(1, dt / LAW.EVAC_S)
      if (move > 0) {
        bd.n[rec.band] = num(bd.n[rec.band]) - move
        s.a3.transit.push({ from: rec.band, to: rec.to, count: move, tRem: bandTau(rec.to) })
      }
      if (num(rec.until) > s.t) keep.push(rec)
    }
    d.evac = keep
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE SUCCESSOR (§15)
  // ───────────────────────────────────────────────────────────────────────────

  function checkCoalescence (dt) {
    var s = S()
    if (!s || !inVoid(s) || s.a3.succ) return false
    var d = block(s)
    var list = living(s)
    if (list.length < 2) { d.coal = 0; return false }
    if (totalWild(s) < totalMine(s)) { d.coal = 0; return false }
    d.coal = num(d.coal) + dt
    if (d.coal < A().SUCC_TRIGGER_T) return false

    var n = nBands()
    var w = new Float64Array(n), i, b, tot = 0
    for (i = 0; i < list.length; i++) {
      for (b = 0; b < n; b++) w[b] += Math.max(0, num(list[i].w[b]))
      tot += totalOf(list[i])
    }
    var g = new Int8Array(AXES.length), k, acc
    for (k = 0; k < AXES.length; k++) {
      acc = 0
      for (i = 0; i < list.length; i++) acc += totalOf(list[i]) * num(list[i].genome[k])
      g[k] = tot > 0 ? Math.round(acc / tot) : num(list[0].genome[k])
    }
    s.a3.succ = {
      genome: g, w: w, born: s.t, linesShown: 0, name: '—',
      lociCap: num(s.a3.lociCap), learnAt: s.t + A().SUCC_LEARN_S,
      sequenced: false, quarantinedUntil: 0, carbonHeld: 0, eng: null,
      lines: list.slice()
    }
    s.a3.strains = []
    d.coal = 0
    fire('a3.coalescence', { k: list.length })
    feel('warn.major', {})
    return true
  }

  // §15.2. It gains a locus every four minutes, allocated greedily against your current build. It
  // never lies, it is never wrong, and it is the only adaptive opponent in HYPHAE.
  function stepSuccessor (dt, opts) {
    var s = S()
    if (!s || !s.a3.succ) return
    var e = s.a3.succ
    var age = s.t - num(e.born)
    e.lociCap = num(s.a3.lociCap) + Math.floor(age / LAW.SUCC_CAP_S)
    while (s.t >= num(e.learnAt) && genomeLength(e.genome) < num(e.lociCap)) {
      e.genome[counterAxis(s, e)] += 1
      e.learnAt = num(e.learnAt) + A().SUCC_LEARN_S
    }
    // Its share of every band feeds the finale's desync term; the finale owns the phase and reads
    // succShare() rather than this module reaching into a3.bands.phase.
    void dt
    void opts
  }

  // Which locus is worth the most to it, against you, right now. Melanisation answers your
  // Antagonism, Antagonism answers your Melanisation, Myceliation answers your Myceliation because
  // the band is a shared bowl, and Sporulation is always worth something because it compounds.
  function counterAxis (s, e) {
    var mine = playerGenome(s)
    var v = new Array(AXES.length), i
    v[BAL] = 0.30
    v[GER] = 0.30
    v[MYC] = 1.00 + LAW.SUCC_COUNTER * 0.18 * mine[MYC]
    v[SPO] = 0.90
    v[MEL] = 0.45 + LAW.SUCC_COUNTER * 0.30 * mine[ANT]
    v[DOR] = 0.35
    v[FID] = 0.05                                    // it has nothing left to be faithful to
    v[ANT] = 0.50 + LAW.SUCC_COUNTER * 0.30 * mine[MEL]
    // Diminishing returns on its own build, so it broadens rather than spiking one axis forever.
    var best = 0, bv = -Infinity, score
    for (i = 0; i < AXES.length; i++) {
      score = v[i] / (1 + 0.35 * num(e.genome[i]))
      if (score > bv) { bv = score; best = i }
    }
    return best
  }

  function succShare (b, st) {
    var s = st || S()
    if (!s || !s.a3.succ) return 0
    var w = Math.max(0, num(s.a3.succ.w[b]))
    var mine = Math.max(0, num(bands(s).n[b]))
    return w + mine > 0 ? w / (w + mine) : 0
  }

  function succAge (st) {
    var s = st || S()
    return s && s.a3.succ ? s.t - num(s.a3.succ.born) : -1
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ALLELES AND THE LOCUS CAP (§16)
  // ───────────────────────────────────────────────────────────────────────────

  function capCost (st) {
    var s = st || S()
    var A3 = A()
    return Math.ceil(A3.CAP_A * Math.pow(A3.CAP_G, num(s.a3.capRaises)))
  }

  function raiseLociCap () {
    var s = S()
    if (!s) return false
    var cost = capCost(s)
    if (num(s.res.alleles) < cost) return false
    spend(s, 'alleles', cost)
    s.a3.capRaises = num(s.a3.capRaises) + 1
    s.a3.lociCap = num(s.a3.lociCap) + 1
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE ANTIPHONY (05 §17) — 27 encounters, no auto-run at any price
  // ───────────────────────────────────────────────────────────────────────────

  // The per-strain perturbation of §17.3: ±2 on every cell, then four repairs in a fixed order that
  // preserve the theme. Every strain is a variation on one matrix — learnable in general, specific
  // in detail — and the repairs are what stop the variation from becoming arbitrary.
  function matrixFor (k) {
    var s = S()
    if (!s) return BASE_PAYOFF
    var key = (s.seed >>> 0) + ':' + k
    if (lastMatrix[key]) return lastMatrix[key]
    var r = stream(s, 'antiphony', k)
    var m = [], i, j
    for (i = 0; i < 4; i++) {
      m.push([])
      for (j = 0; j < 4; j++) m[i].push(BASE_PAYOFF[i][j] + Math.round(r.next() * 4 - 2))
    }
    for (j = 0; j < 4; j++) m[HOLD][j] = C().clamp(m[HOLD][j], 0, 3)   // HOLD stays the safe floor
    var lo = Infinity, at = 0
    for (i = 0; i < 4; i++) if (m[i][CUT] < lo) { lo = m[i][CUT]; at = i }
    if (lo > -3) m[at][CUT] = -3                                       // CUT stays punishable
    if (m[ECHO][ECHO] < 2) m[ECHO][ECHO] = 2                           // coordination stays real
    if (m[CUT][ECHO] < 3) m[CUT][ECHO] = 3                             // ambush stays a threat
    lastMatrix[key] = m
    return m
  }

  function bestResponse (m, theirs) {
    var best = HOLD, bv = -Infinity, i
    for (i = 0; i < 4; i++) if (m[i][theirs] > bv) { bv = m[i][theirs]; best = i }
    return best
  }

  // One grammar, two users. The player's authored policy and every opponent's hidden policy are
  // evaluated by this function and no other, which is what makes "it is a legal policy you could
  // have written" a fact about the code rather than a claim in a document.
  function evalPolicy (policy, ctx) {
    var rules = policy.rules || [], i, rule, reg
    for (i = 0; i < rules.length; i++) {
      rule = rules[i]
      if (!matches(rule, ctx)) continue
      reg = resolveRegister(rule, ctx)
      if (reg >= 0) return reg
    }
    return policy.def === undefined ? HOLD : policy.def
  }

  function matches (rule, ctx) {
    var them = ctx.theirs, i, n
    switch (rule.c) {
      case 'ALWAYS': return true
      case 'MIRROR': return them.length > 0
      case 'YOU_OPENED': return ctx.openedLast >= 0 && ctx.round === 1
      case 'THEY_PLAYED': return them.length > 0 && them[them.length - 1] === rule.a
      case 'ROUND_LE': return ctx.round <= rule.a
      case 'ROUND_GT': return ctx.round > rule.a
      case 'BEHIND': return ctx.myScore < ctx.theirScore
      case 'AHEAD': return ctx.myScore > ctx.theirScore
      case 'REPEATED': return them.length >= 2 && them[them.length - 1] === them[them.length - 2]
      case 'THEY_HAVE_PLAYED':
        n = 0
        for (i = 0; i < them.length; i++) if (them[i] === rule.a) n++
        return n >= (rule.k || 1)
      case 'SCORED_LE0': return ctx.round > 1 && ctx.lastScore <= 0
      default: return false
    }
  }

  function resolveRegister (rule, ctx) {
    var them = ctx.theirs
    if (rule.r === -1) return them.length ? them[them.length - 1] : -1        // the mirror
    if (rule.r === -2) return ctx.openedLast >= 0 ? bestResponse(ctx.m, ctx.openedLast) : -1
    if (rule.r === INVERT) {
      // Round 1 falls through to the next rule: there is nothing to invert yet.
      return them.length ? bestResponse(ctx.m, them[them.length - 1]) : -1
    }
    return rule.r
  }

  // DRONE is not a row of the matrix: it is a guaranteed 2, and the other side reads it as a HOLD
  // and collects a point on top. A floor, sold at a price, and the price is that they know.
  function scoreRound (m, mine, theirs) {
    var a, b
    if (mine === DRONE) { a = DRONE_SCORE; b = m[theirs][HOLD] + DRONE_GIFT }
    else if (theirs === DRONE) { a = m[mine][HOLD] + DRONE_GIFT; b = DRONE_SCORE }
    else { a = m[mine][theirs]; b = m[theirs][mine] }
    return [a, b]
  }

  function encounterCap () {
    return Math.min(A().ANTIPHONY_MAX, LADDER.length * ATTEMPTS)
  }

  function antiphonyReady (s) {
    return inVoid(s) && flagOn(s, 'anti_organ')
  }

  // One encounter: seven rounds, both sides committing simultaneously from a written policy. There
  // is no auto-run at any price and there never will be — that is the whole difference between this
  // and the tournament it is answering.
  function play (k) {
    var s = S()
    if (!s || !antiphonyReady(s)) return null
    if (k < 0 || k >= LADDER.length) return null
    var a = anti(s)
    var rec = a.enc[k]
    if (rec.tries >= ATTEMPTS || a.total >= encounterCap()) return null

    var m = matrixFor(k)
    var foe = LADDER[k]
    var mine = [], theirs = [], lines = []
    var myScore = 0, theirScore = 0, round, my, th, sc
    var myLast = 0, thLast = 0

    for (round = 1; round <= ROUNDS; round++) {
      my = evalPolicy(a.policy, {
        round: round, theirs: theirs, mine: mine, m: m,
        myScore: myScore, theirScore: theirScore, lastScore: myLast, openedLast: -1
      })
      // One matrix, two readers. Their score is m[theirs][mine] — the transpose of yours — so
      // their best response to your register y is argmax over x of m[x][y], read off the same
      // table with the same function. There is no second matrix and there is no hidden state.
      th = evalPolicy(foe.policy, {
        round: round, theirs: mine, mine: theirs, m: m,
        myScore: theirScore, theirScore: myScore, lastScore: thLast, openedLast: rec.opened
      })
      if (my === INVERT || my === DRONE) { if (!has(a.regs, REGISTERS[my].id)) my = HOLD }
      if (my < 0) my = a.policy.def === undefined ? HOLD : a.policy.def
      if (th < 0) th = foe.policy.def
      sc = scoreRound(m, my, th)
      myLast = sc[0]; thLast = sc[1]
      myScore += sc[0]; theirScore += sc[1]
      mine.push(my); theirs.push(th)
      lines.push({ r: round, me: regName(my), them: regName(th), a: sc[0], b: sc[1] })
    }

    var handicap = -Math.round(ROUNDS * num(rec.div))
    var delta = myScore - theirScore + handicap
    var result = delta >= DECISIVE ? 'ABSORPTION' : (delta <= -DECISIVE ? 'DIVERGENCE' : 'MERGE')
    var pay = CANON_PAY[result]
    var canon = Math.round(pay.base + pay.per * num(rec.div))
    C().setStock(s.res, 'canon', num(s.res.canon) + canon)

    rec.tries += 1
    rec.seen = 1                        // you learn their payoffs by fighting, not by paying
    rec.opened = mine[0]
    a.total += 1
    if (result === 'MERGE') { rec.merges += 1; a.merges = num(a.merges) + 1 }
    if (result === 'DIVERGENCE') {
      // Losing costs you something outside the minigame: the opponent grows, and so does the
      // act-level divergence threat you are spending the rest of the act suppressing.
      rec.div = num(rec.div) + LOSS_DIV
      raiseWild(s, LOSS_WILD)
    }
    if (!rec.best || rank(result) > rank(rec.best)) rec.best = result

    var transcript = {
      k: k, name: foe.name, result: result, delta: delta, canon: canon,
      mine: myScore, theirs: theirScore, handicap: handicap, rounds: lines, at: s.t
    }
    // Only the summary line is persisted. The round-by-round transcript belongs to the encounter
    // you have this second — twenty-seven of them at seven rounds each is 11 KB of JSON against a
    // 3 KB Act III budget, and a transcript you have already read is a receipt, which this game
    // does not keep. It is held outside the save and is gone on reload, like the round it describes.
    lastRounds = transcript.rounds
    a.log.push({
      k: k, name: foe.name, result: result, delta: delta, canon: canon, at: Math.round(s.t)
    })
    while (a.log.length > TRANSCRIPTS) a.log.shift()
    feel(result === 'DIVERGENCE' ? 'combat.loss' : 'combat.win', {})
    return transcript
  }

  function rank (r) { return r === 'ABSORPTION' ? 3 : (r === 'MERGE' ? 2 : 1) }
  function regName (i) { return REGISTERS[i] ? REGISTERS[i].id : 'HOLD' }
  function has (arr, id) { return arr.indexOf(id) >= 0 }

  // A loss raises the wild fraction by a stated amount. If nothing is alive to grow, something is
  // born to carry it — the penalty is a fact about the act, not about the card that caused it.
  function raiseWild (s, by) {
    var mine = totalMine(s)
    var w = totalWild(s)
    var target = C().clamp((w + mine > 0 ? w / (w + mine) : 0) + by, 0, 0.98)
    var want = mine > 0 ? target * mine / (1 - target) : w * (1 + by)
    if (!(want > w)) return
    if (w > 0) {
      var scale = want / w, list = living(s), i, b
      for (i = 0; i < list.length; i++) {
        for (b = 0; b < list[i].w.length; b++) list[i].w[b] = num(list[i].w[b]) * scale
      }
      if (s.a3.succ) {
        for (b = 0; b < s.a3.succ.w.length; b++) s.a3.succ.w[b] = num(s.a3.succ.w[b]) * scale
      }
      return
    }
    var band = 0, bd = bands(s), k
    for (k = 0; k < bd.n.length; k++) if (num(bd.n[k]) > num(bd.n[band])) band = k
    var born = onDrift(band)
    if (born) born.w[band] = Math.max(num(born.w[band]), want)
  }

  function canonBuy (kind, id) {
    var s = S()
    if (!s) return false
    var a = anti(s)
    var i, cost = -1
    if (kind === 'condition') {
      for (i = 0; i < CONDITIONS.length; i++) if (CONDITIONS[i].id === id) cost = CONDITIONS[i].cost
      if (cost < 0 || has(a.conds, id) || cost === 0) return false
      if (num(s.res.canon) < cost) return false
      spend(s, 'canon', cost)
      a.conds.push(id)
      // The policy editor prints the token, so the receipt says the token back (log.js §receipts).
      if (HY.log && HY.log.bought) HY.log.bought(id)
      return true
    }
    if (kind === 'register') {
      for (i = 0; i < REGISTERS.length; i++) if (REGISTERS[i].id === id) cost = REGISTERS[i].cost
      if (cost <= 0 || has(a.regs, id)) return false
      if (num(s.res.canon) < cost) return false
      spend(s, 'canon', cost)
      a.regs.push(id)
      if (HY.log && HY.log.bought) HY.log.bought(id)
      return true
    }
    if (kind === 'fidelity') {
      // 1 CANON → +0.0004 Φ, and the contribution shares BOUGHT_FID_CAP with every project that
      // buys fidelity (BIBLE §7 C20). A strip-miner cannot buy their way to ENDING B.
      var n = Math.max(0, Math.floor(num(id)))
      if (!(n > 0) || num(s.res.canon) < n) return false
      var room = A().BOUGHT_FID_CAP - num(s.mult.boughtFid)
      if (!(room > 0)) return false
      var gain = Math.min(room, n * CANON_FID)
      var pay = Math.ceil(gain / CANON_FID)
      spend(s, 'canon', pay)
      s.mult.boughtFid = C().clamp(num(s.mult.boughtFid) + gain, 0, A().BOUGHT_FID_CAP)
      a.fidSpent = num(a.fidSpent) + pay
      if (HY.log && HY.log.bought) HY.log.bought('fidelity')
      return true
    }
    return false
  }

  // The policy editor's only write. Up to three conditional rules plus a default, and a rule whose
  // condition or register has not been bought is refused rather than silently dropped.
  function setPolicy (rules, def) {
    var s = S()
    if (!s) return false
    var a = anti(s)
    var out = [], i, r, c
    for (i = 0; i < (rules || []).length && out.length < 3; i++) {
      r = rules[i]
      if (!r) continue
      c = null
      for (var j = 0; j < CONDITIONS.length; j++) if (CONDITIONS[j].id === r.c) c = CONDITIONS[j]
      if (!c) return false
      if (c.cost > 0 && !has(a.conds, c.id)) return false
      if (!REGISTERS[r.r]) return false
      if (REGISTERS[r.r].cost > 0 && !has(a.regs, REGISTERS[r.r].id)) return false
      out.push({ c: r.c, a: r.a, k: r.k, r: r.r })
    }
    var d = def === undefined ? a.policy.def : def
    if (!REGISTERS[d]) return false
    if (REGISTERS[d].cost > 0 && !has(a.regs, REGISTERS[d].id)) return false
    a.policy = { rules: out, def: d }
    return true
  }

  // The whole sub-layer as one readable object: what is unlocked, what each opponent has cost you
  // so far, what you may write, and every transcript. The UI renders this; nothing else reads it.
  function antiphony () {
    var s = S()
    if (!s) return null
    var a = anti(s)
    var list = [], i, rec
    for (i = 0; i < LADDER.length; i++) {
      rec = a.enc[i]
      list.push({
        k: i, name: LADDER[i].name, div: num(rec.div), tries: num(rec.tries),
        left: Math.max(0, ATTEMPTS - num(rec.tries)), best: rec.best || '',
        merges: num(rec.merges),
        // Their payoffs are hidden until you have completed one encounter against them.
        payoff: rec.seen ? matrixFor(i) : null,
        mine: yourRows(matrixFor(i))
      })
    }
    return {
      unlocked: antiphonyReady(s),
      canon: num(s.res.canon),
      encounters: list,
      played: num(a.total),
      cap: encounterCap(),
      merges: num(a.merges),
      policy: a.policy,
      conditions: CONDITIONS,
      registers: REGISTERS,
      owned: { conds: a.conds.slice(), regs: a.regs.slice() },
      fidFromCanon: num(a.fidSpent) * CANON_FID,
      transcripts: a.log.slice(),
      lastRounds: lastRounds,
      play: play, setPolicy: setPolicy, buy: canonBuy
    }
  }

  function yourRows (m) {
    var out = [], i, j
    for (i = 0; i < 4; i++) { out.push([]); for (j = 0; j < 4; j++) out[i].push(m[i][j]) }
    return out
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE STEPS loop.js DRIVES (BIBLE §4 steps 8 and 11)
  // ───────────────────────────────────────────────────────────────────────────

  function step (dt, opts) {
    var s = S()
    if (!s || !inVoid(s) || !(dt > 0)) return
    stepDrift(dt, opts)
    stepStrains(dt, opts)
    stepEvac(s, dt)
    stepReverts(s)

    // The 0.5 Hz band of §2. Offline runs 180-second macro-steps, so a step longer than the slow
    // period is its own slow tick rather than being deferred until the player returns.
    slowAcc += dt
    if (slowAcc >= SLOW_S || dt >= SLOW_S) { stepSpread(slowAcc); slowAcc = 0 }

    checkCoalescence(dt)
    stepSuccessor(dt, opts)
  }

  function onPulse (ev) {
    // ANTAGONISE is read continuously out of cognition.pulseEffect() during the fight, so the
    // arrival hook has nothing to latch. It exists so a mode added later has a seat.
    void ev
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE SURFACE
  // ───────────────────────────────────────────────────────────────────────────

  function init (s) {
    var st = s || S()
    if (!st) return
    block(st)
    anti(st)
    newCraft = new Float64Array(nBands())
    slowAcc = 0
    lastMatrix = {}
    // A save written before this module existed has strains whose typed arrays came back as plain
    // arrays only if the codec lost them; the codec does not, so all that is needed is the fields
    // added since — an engagement in flight, and the residual bookkeeping.
    var list = st.a3.strains || [], i
    for (i = 0; i < list.length; i++) {
      if (!list[i]) continue
      if (list[i].eng === undefined) list[i].eng = null
      if (list[i].carbonHeld === undefined) list[i].carbonHeld = 0
    }
    if (st.a3.succ && st.a3.succ.eng === undefined) st.a3.succ.eng = null
  }

  function tick (s, dt, opts) { void s; step(dt, opts) }

  function serialise (s) {
    var st = s || S()
    return { div: st.a3.div, antiphony: st.a3.antiphony }
  }

  function migrate (save, from) {
    if (!save || !save.a3) return save
    if (!save.a3.div) {
      save.a3.div = {
        nextId: (save.a3.strains || []).length + 1, sequenced: 0, absorbs: 0, quarantines: 0,
        fidDebt: 0, lines: {}, reverts: [], evac: [], coal: 0, wins: 0
      }
    }
    if (!save.a3.antiphony || typeof save.a3.antiphony !== 'object') save.a3.antiphony = {}
    void from
    return save
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — every assertion below is about behaviour this module claims, not about
  // whether a function exists. D25 is the first one for a reason.
  // ───────────────────────────────────────────────────────────────────────────

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }
    function near (got, want, tol, label) {
      if (!(Math.abs(got - want) <= tol)) f.push(label + ': got ' + got + ', want ' + want + ' ±' + tol)
    }
    if (!HY.state || !HY.state.state) return ['state.js is absent; divergence cannot be checked']

    var keep = HY.state.exportB64()
    try {
      var s = S()

      // ── D25 · a strain's genome is ALWAYS within `drift` of yours at birth ───────────────
      // Ten thousand births, every band, over builds from monastic to swarm. This is the row a
      // harsh critic reaches for first, because the act is about nothing else.
      var r = C().rng(0x5EED1234)
      var worst = 0, badTotal = 0, moved = 0, trials = 0, k, b, i
      var builds = [
        [0, 0, 0, 0, 0, 0, 0, 0], [2, 2, 4, 2, 2, 2, 1, 1], [0, 1, 8, 3, 1, 1, 2, 0],
        [6, 4, 2, 1, 1, 1, 1, 0], [2, 3, 4, 6, 2, 0, 0, 4], [1, 2, 3, 1, 2, 6, 1, 0]
      ]
      for (var bi = 0; bi < builds.length; bi++) {
        var g0 = new Int8Array(builds[bi])
        var want = genomeLength(g0)
        for (b = 0; b < A().BANDS; b++) {
          var d = 1 + Math.floor(b / 3)
          for (var t = 0; t < 140; t++) {
            var g = mutate(g0, b, r.next)
            trials++
            for (k = 0; k < 8; k++) {
              var dev = Math.abs(g[k] - g0[k])
              if (dev > worst) worst = dev
              if (dev > d) f.push('D25 VIOLATED: band ' + b + ' locus ' + AXES[k] +
                ' moved ' + dev + ' against a drift of ' + d)
              if (dev > 0) moved++
              if (g[k] < 0) f.push('D25: a locus went below zero')
            }
            if (Math.abs(genomeLength(g) - want) > LAW.MUT_SLACK) badTotal++
          }
        }
      }
      ok(trials === builds.length * A().BANDS * 140, 'the D25 sweep did not run')
      ok(badTotal === 0, 'total loci left the ±2 window in ' + badTotal + ' of ' + trials + ' births')
      ok(worst > 0, 'mutate() never moved a single locus — the antagonist is a copy, not a child')
      // ~30% of loci move, so over 8 loci the mean is ~2.4 per birth; a wide band catches a
      // MUT_P that has silently become 0 or 1.
      var rate = moved / (trials * 8)
      ok(rate > 0.12 && rate < 0.48, 'per-locus mutation rate is ' + rate.toFixed(3) + ', want ≈0.30')

      // ── drift is proportional to trust^1.2 — smarter children defect more ───────────────
      // The published curve of §13.1: drift/s at steady-state replication, band 4, G = 18, and the
      // superlinear (1 − Φ)^exp shape that makes the last points of fidelity worth the most.
      var A3 = A()
      function driftAt (fid) {
        return A3.DRIFT_K * 0.0375 * Math.pow(1 - fid, A3.DRIFT_FID_EXP) *
          (1 + LAW.DRIFT_PER_BAND * 4) * (1 + LAW.DRIFT_PER_LOCUS * 18)
      }
      var d51 = driftAt(0.51), d85 = driftAt(0.85), d92 = driftAt(0.92)
      ok(d51 > d85 && d85 > d92, 'drift is not monotone in fidelity')
      // 0.85 → 0.92 must be worth more than a linear reading of the same gap: that is the whole
      // reason the last few points of Φ cost what they do.
      var linear = (1 - 0.92) / (1 - 0.85)
      ok(d92 / d85 < linear - 1e-6,
        'drift is not superlinear in infidelity: ratio ' + (d92 / d85).toFixed(4) + ' vs ' + linear.toFixed(4))
      near(A3.DRIFT_FID_EXP, 1.4, 0.11, 'DRIFT_FID_EXP left the trust^1.2 family')
      // The two mean-times-between-divergence the design states as observable signatures: SCHISM
      // (§10.5) is "an event every 60–150 s" at a broken fidelity, and §13.1's steward row is
      // ≈472 s at Φ = 0.85. Both are measured against the registry's exponent, not 03's draft.
      var mtbd = 1 / d51
      ok(mtbd > 60 && mtbd < 150,
        'MTBD at Φ=0.51 is ' + Math.round(mtbd) + ' s, outside SCHISM\'s stated 60–150 s')
      mtbd = 1 / d85
      ok(mtbd > 380 && mtbd < 600, 'MTBD at Φ=0.85 is ' + Math.round(mtbd) + ' s, want ≈472 s')
      // 0.85 → 0.95 is worth 4.4× (§13.1). This is the number that prices the last locus of FID.
      near(driftAt(0.85) / driftAt(0.95), 4.4, 1.0, 'the 0.85 → 0.95 fidelity step is not ≈4.4×')

      // …and the table is tabulated at a copy rate the engine can actually reach: a fleet at its
      // own max-surplus occupancy pouring everything into REPLICATE reads as §13.1's reference.
      coldVoid()
      s = S()
      s.a3.bands.n[6] = 1.0e20
      var repMax = A3.REP_K * (1 - A3.N_STAR_K / (A3.N_STAR_K + LAW.REP_DAMP))
      noteReplication(6, 1.0e20 * repMax)
      near(copyRate(6), LAW.DRIFT_REP_REF, 1e-12,
        'full REPLICATE at max-surplus occupancy does not read as the MTBD table\'s copy rate')
      noteReplication(6, 0)
      near(copyRate(6), 0, 1e-15, 'a parked fleet drifts')
      // The decay term is not a rounding error beside the accumulation: at the fidelity a
      // legacy-0.35 run arrives with, drift must actually rise, or the act has no antagonist.
      var phi = 0.818
      var gross = A3.DRIFT_K * LAW.DRIFT_REP_REF * Math.pow(1 - phi, A3.DRIFT_FID_EXP) *
        (1 + LAW.DRIFT_PER_BAND * 6) * (1 + LAW.DRIFT_PER_LOCUS * 6)
      ok(gross > A3.DRIFT_DECAY * phi * 2,
        'at Φ = 0.818 drift accumulates at ' + gross.toExponential(2) +
        '/s against a decay of ' + (A3.DRIFT_DECAY * phi).toExponential(2) + '/s: no strain can be born')

      // ── the divergence event takes craft out of your fleet and puts them in theirs ──────
      coldVoid()
      s = S()
      s.a3.bands.n[4] = 1.0e20
      s.a3.loci[MYC] = 4; s.a3.loci[SPO] = 3
      s.carry.fidelityBase = 0.74
      var before = s.a3.bands.n[4]
      var born = onDrift(4)
      ok(!!born, 'onDrift produced no strain')
      if (born) {
        var frac = (before - s.a3.bands.n[4]) / before
        ok(frac >= A3.DEFECT_MIN - 1e-9 && frac <= A3.DEFECT_MAX + 1e-9,
          'defector fraction ' + frac.toFixed(4) + ' is outside [0.040, 0.140]')
        near(born.w[4], before - s.a3.bands.n[4], before * 1e-12,
          'the defectors did not arrive in the strain that left')
        ok(s.a3.bands.drift[4] === 0, 'drift was not reset by the event it fired')
        ok(born.name && born.name.length >= 5, 'the strain was born without a name')
        ok(s.stats.strainsBorn === 1, 'stats.strainsBorn did not count the birth')
      }

      // ── alleles come ONLY from surviving betrayal ───────────────────────────────────────
      // Quarantine is the cheap answer and pays nothing; purge and absorb are the only two verbs
      // in this file that write res.alleles, and neither is reachable without a strain.
      coldVoid()
      s = S()
      s.res.carbon = 1e30
      s.proj.flags.interference_competition = 1
      s.a3.bands.n[3] = 1e20
      var q = onDrift(3)
      var a0 = s.res.alleles
      ok(quarantine(q.id), 'QUARANTINE was refused with the project owned and the carbon in hand')
      ok(s.res.alleles === a0, 'QUARANTINE paid alleles; §16 says it pays exactly zero')
      ok(q.quarantinedUntil > s.t, 'the quarantine did not stop the clock on spread')
      near(q.quarantinedUntil - s.t, LAW.QT_BASE, 1, 'the first quarantine is not 900 s')
      // The second is shorter: quarantine is a habit the world learns to route around.
      s.a3.bands.n[3] = 1e20
      var q2 = onDrift(3)
      ok(quarantine(q2.id), 'a second QUARANTINE was refused')
      near(q2.quarantinedUntil - s.t, LAW.QT_BASE / (1 + LAW.QT_DECAY), 1,
        'the second quarantine is not 900/(1 + 0.4)')
      ok(s.res.alleles === a0, 'a second QUARANTINE paid alleles')

      // PURGE pays, and it pays more for a stranger.
      coldVoid()
      s = S()
      s.a3.bands.n[5] = 1e20
      var p1 = onDrift(5)
      for (k = 0; k < 8; k++) p1.genome[k] = s.a3.loci[k]          // an identical twin
      var payTwin = purge(p1.id, 1e18)
      coldVoid()
      s = S()
      s.a3.bands.n[5] = 1e20
      var p2 = onDrift(5)
      for (k = 0; k < 8; k++) p2.genome[k] = s.a3.loci[k] + 3      // a stranger
      var payFar = purge(p2.id, 1e18)
      ok(payTwin > 0, 'PURGE paid no alleles at all')
      ok(payFar > payTwin, 'novelty does not pay: ' + payFar + ' vs ' + payTwin)
      near(payFar / payTwin, 1 + A3.NOVELTY_K * 24, 0.10, 'the novelty term is not 1 + 0.14·Σ|Δ|')
      // …and the published scale: a 1e20-craft strain is worth hundreds of α, not millions,
      // so §16's whole-run totals (0 / 3,500 / 11,000 / 28,000) are reachable and not trivial.
      var scale = Math.floor(A3.ALPHA_ABSORB * Math.pow(alleleUnits(1e20), A3.ALPHA_EXP) * 1.5)
      ok(scale > 300 && scale < 2000,
        'an absorption of 1e20 craft pays ' + scale + ' α; §16 budgets a whole run at ~11,000')

      // ── ABSORB: patience pays, and it costs fidelity ────────────────────────────────────
      coldVoid()
      s = S()
      s.proj.flags.anastomosis_offer = 1
      s.res.signal = 1e9; s.res.insight = 1e9
      s.a3.bands.n[2] = 1e20
      var e1 = onDrift(2)
      var small = e1.w[2]
      var fidBefore = effFid(s)
      var payNow = absorb(e1.id)
      var fidAfter = effFid(s)
      ok(payNow > 0, 'ABSORB paid no alleles')
      ok(fidAfter < fidBefore - 1e-9, 'ABSORB did not cost fidelity — foreign genes came in free')
      near(fidBefore - fidAfter, LAW.ABSORB_FID * (1 - fidBefore), 1e-6,
        'the absorption fidelity penalty is not 0.40·(1 − Φ)')
      ok(s.a3.strains.length === 0, 'the absorbed strain is still on the board')
      ok(s.a3.bands.n[2] > 1e20 * 0.85, 'the absorbed craft did not merge back into the fleet')
      // 03 §13.4's emergent line: totalW^0.30 means a strain left to grow is worth 3.1× at 12 min.
      coldVoid()
      s = S()
      s.proj.flags.anastomosis_offer = 1
      s.res.signal = 1e9; s.res.insight = 1e9
      s.a3.bands.n[2] = 1e20
      var e2 = onDrift(2)
      e2.w[2] = small * Math.pow(3.1, 1 / A3.ALPHA_EXP)
      var payLater = absorb(e2.id)
      near(payLater / payNow, 3.1, 0.25, 'farming a defector does not pay 3.1× at the published size')

      // ── combat is a square law, and committing 60% is worth 0.36 of the fight ───────────
      coldVoid()
      s = S()
      s.a3.bands.n[6] = 1e20
      var c1 = onDrift(6)
      c1.w[6] = 4.0e19
      c1.sequenced = true
      for (k = 0; k < 8; k++) c1.genome[k] = 0
      var full = predict(c1.id, 1.0)
      var half = predict(c1.id, 0.6)
      ok(full && half, 'predict() returned nothing for a live strain')
      if (full && half) {
        // The square law's conserved quantity: β_A·A² − β_B·B² is the same before the fight and
        // after it, which is exactly why the closed-form survivor count is closed-form.
        var inv0 = full.betaA * full.A * full.A - full.betaB * full.B * full.B
        var inv1 = full.betaA * full.survivors * full.survivors
        ok(inv0 > 0, 'the invariant says you lose a fight predict() says you win')
        near(inv1 / inv0, 1, 1e-9, 'β_A·A² − β_B·B² is not conserved through the survivor count')
        // The square: 0.6 of the fleet is 0.36 of the fight, so the threshold is sharp.
        near((half.A * half.A) / (full.A * full.A), 0.36, 1e-6,
          'commitment is not squared — there is no threshold and no decision')
        ok(full.win, 'a 2.5:1 commitment did not win against an equal genome')
        ok(!predict(c1.id, 0.30).win, 'a 0.75:1 commitment won a square-law fight')
        ok(full.tResolve > 20 && full.tResolve < 200,
          'resolution time ' + Math.round(full.tResolve) + ' s is outside the published 40–120 s band')
      }
      // Unsequenced, the prediction is a band and it is wide enough to be a decision.
      c1.sequenced = false
      s.a3.loci[MEL] = 2; s.a3.loci[ANT] = 2
      var wide = predict(c1.id, 0.8)
      ok(wide && wide.wide, 'an unsequenced strain returned a point prediction')
      if (wide && wide.lo && wide.hi) {
        ok(wide.hi.survivors > wide.lo.survivors,
          'the uncertainty band has no width: sequencing would buy nothing')
      }
      // Sequencing collapses it, costs Ψ, and is worth +10% lethality.
      s.proj.flags.sequencer = 1
      s.res.insight = 1e6
      var psi0 = s.res.insight
      var cost = seqCost(s)
      ok(sequence(c1.id), 'SEQUENCE was refused with the project owned and the insight in hand')
      near(psi0 - s.res.insight, cost, 1e-9, 'sequencing did not charge its published price')
      var sharp = predict(c1.id, 0.8)
      ok(sharp && !sharp.wide, 'sequencing did not collapse the prediction to a point')
      near(sharp.betaA / wide.betaA, 1 + LAW.SEQ_BETA, 1e-6, 'sequencing is not worth +10% β_A')

      // ── an engagement is four live decisions, not a slider you set once ─────────────────
      coldVoid()
      s = S()
      s.a3.bands.n[6] = 1e20
      var c2 = onDrift(6)
      c2.w[6] = 3.0e19
      for (k = 0; k < 8; k++) c2.genome[k] = 0
      var fleet0 = s.a3.bands.n[6]
      ok(engage(c2.id, 0.5), 'engage() refused a legal commitment')
      near(s.a3.bands.n[6], fleet0 * 0.5, fleet0 * 1e-9,
        'committing did not remove the craft from the band economy')
      ok(!engage(c2.id, 0.5), 'a second engagement started on a strain already engaged')
      // REINFORCE draws again, and only once per 20 s.
      var eng0 = c2.eng.A
      ok(reinforce(c2.id), 'REINFORCE was refused at the start of a fight')
      ok(c2.eng.A > eng0, 'REINFORCE added nothing')
      ok(!reinforce(c2.id), 'REINFORCE has no cooldown')
      // The fight actually resolves, in the published time band, and it kills craft on both sides.
      var wBefore = c2.w[6], aBefore = c2.eng.A
      var elapsed = 0
      while (c2.eng && elapsed < 600) { stepEngagements(0.5, {}); elapsed += 0.5 }
      ok(elapsed < 600, 'the engagement never resolved')
      ok(c2.w[6] < wBefore, 'the strain took no losses')
      ok(s.a3.mortality[5] > 0, 'craft died in combat and PREDATION was not attributed')
      ok(aBefore > 0, 'nothing was committed')
      // A won fight removes the strain and pays alleles; that is the only path from combat to α.
      ok(s.res.alleles > 0, 'a won engagement paid no alleles')
      ok(!findStrain(s, c2.id), 'the purged strain survived the purge')
      // WITHDRAW returns 60% and ends it immediately.
      coldVoid()
      s = S()
      s.a3.bands.n[6] = 1e20
      var c3 = onDrift(6)
      c3.w[6] = 1e20
      engage(c3.id, 0.4)
      var held = c3.eng.A, bandBefore = s.a3.bands.n[6]
      ok(withdraw(c3.id), 'WITHDRAW was refused during a live engagement')
      near(s.a3.bands.n[6] - bandBefore, held * A3.WITHDRAW_RECOVER, held * 1e-9,
        'WITHDRAW did not return exactly 60%')
      ok(!c3.eng, 'WITHDRAW did not end the engagement')
      // No engagement resolves offline: it is the skill.
      coldVoid()
      s = S()
      s.a3.bands.n[6] = 1e20
      var c4 = onDrift(6)
      c4.w[6] = 1e19
      engage(c4.id, 0.9)
      var offA = c4.eng.A
      for (i = 0; i < 40; i++) stepEngagements(180, { stochastic: false, offline: true })
      near(c4.eng ? c4.eng.A : -1, offA, 1e-9, 'an engagement resolved while the player was away')

      // ── concurrency is the decision; the battle is the consequence ──────────────────────
      coldVoid()
      s = S()
      s.a3.bands.n[1] = 1e20; s.a3.bands.n[2] = 1e20; s.a3.bands.n[3] = 1e20
      var s1 = onDrift(1), s2 = onDrift(2), s3 = onDrift(3)
      ok(engage(s1.id, 0.2), 'the first engagement was refused')
      ok(!engage(s2.id, 0.2), 'two concurrent engagements without Parallel Antagonism')
      s.proj.flags.parallel_antagonism = 1
      ok(engage(s2.id, 0.2), 'Parallel Antagonism did not raise the concurrency limit')
      ok(!engage(s3.id, 0.2), 'three concurrent engagements from one project')

      // ── the Successor ──────────────────────────────────────────────────────────────────
      coldVoid()
      s = S()
      s.a3.bands.n[4] = 1e18
      var k1 = onDrift(4), k2 = onDrift(4)
      k1.w[4] = 1e19; k2.w[4] = 1e19
      var coal = false
      for (i = 0; i < 400 && !coal; i++) coal = checkCoalescence(1)
      ok(coal, 'Σw ≥ Σn sustained for 120 s did not coalesce')
      ok(!!s.a3.succ, 'coalescence produced no Successor')
      ok(s.a3.strains.length === 0, 'the LINEAGES tab did not collapse to one')
      near(i, A3.SUCC_TRIGGER_T, 2, 'coalescence fired at ' + i + ' s, want 120 s sustained')
      if (s.a3.succ) {
        // It learns greedily against YOUR build: six points of Antagonism make Melanisation the
        // most valuable locus it can spend, and it spends it there without being told to.
        var lenBefore = genomeLength(s.a3.succ.genome)
        var melBefore = s.a3.succ.genome[MEL]
        s.a3.loci[ANT] = 6
        s.a3.succ.learnAt = s.t
        s.t += 1
        stepSuccessor(1, {})
        ok(genomeLength(s.a3.succ.genome) === lenBefore + 1,
          'the Successor did not gain exactly one locus at its learning tick')
        ok(s.a3.succ.genome[MEL] === melBefore + 1,
          'the Successor did not answer your Antagonism with Melanisation; it went ' +
          Array.prototype.join.call(s.a3.succ.genome, '/'))
        near(s.a3.succ.learnAt - s.t, A3.SUCC_LEARN_S - 1, 1e-9,
          'the Successor is not on a four-minute learning clock')
        ok(!quarantine('succ'), 'the Successor was quarantined; §15.5 says it cannot be')
        ok(absorb('succ') === 0, 'the Successor was absorbed; §15.5 says it cannot be')
        // It is the largest single α award in the game.
        var succPay = alleleAward(s, s.a3.succ, 1e18, true)
        var strainPay = Math.floor(A3.ALPHA_PURGE * Math.pow(alleleUnits(1e18), A3.ALPHA_EXP) *
          novelty(s.a3.succ, s))
        ok(succPay > strainPay * 3, 'the Successor purge is not the largest award in the game')
      }

      // ── the locus cap is bought with betrayal and nothing else ──────────────────────────
      coldVoid()
      s = S()
      near(capCost(s), 400, 0, 'the first lociCap raise is not 400 α')
      s.res.alleles = 400
      var cap0 = s.a3.lociCap
      ok(raiseLociCap(), 'a cap raise was refused with the alleles in hand')
      ok(s.a3.lociCap === cap0 + 1, 'the cap did not rise')
      near(capCost(s), 568, 0, 'the second raise is not 568 α')
      ok(!raiseLociCap(), 'a cap raise succeeded with no alleles')
      ok(s.res.alleles === 0, 'alleles were created out of nothing')

      // ── the Antiphony: seven rounds, a real opponent, a real cost to losing ─────────────
      coldVoid()
      s = S()
      s.proj.flags.anti_organ = 1
      s.a3.bands.n[3] = 1e20

      // The base matrix's structure, which every perturbation preserves.
      ok(BASE_PAYOFF[HOLD][HOLD] === 2 && bestResponse(BASE_PAYOFF, HOLD) === HOLD,
        '(HOLD,HOLD) is no longer the unique pure Nash')
      ok(bestResponse(BASE_PAYOFF, CALL) === CUT && bestResponse(BASE_PAYOFF, ECHO) === CUT,
        'CUT no longer punishes CALL and ECHO')
      ok(BASE_PAYOFF[ECHO][ECHO] > BASE_PAYOFF[HOLD][HOLD],
        '(ECHO,ECHO) no longer Pareto-dominates the Nash')
      var rows = [0, 0, 0, 0]
      for (i = 0; i < 4; i++) for (k = 0; k < 4; k++) rows[i] += BASE_PAYOFF[i][k]
      ok(rows[CUT] > rows[HOLD] && rows[HOLD] > rows[ECHO] && rows[ECHO] > rows[CALL],
        'CUT no longer beats a uniform opponent — the difficulty curve is gone')

      // …and the four repairs, on every one of the nine perturbed matrices.
      for (k = 0; k < LADDER.length; k++) {
        var mk = matrixFor(k)
        var lo4 = Infinity
        for (i = 0; i < 4; i++) {
          ok(mk[HOLD][i] >= 0 && mk[HOLD][i] <= 3, 'strain ' + k + ': the HOLD row left [0,3]')
          if (mk[i][CUT] < lo4) lo4 = mk[i][CUT]
        }
        ok(lo4 <= -3, 'strain ' + k + ': CUT stopped being punishable')
        ok(mk[ECHO][ECHO] >= 2, 'strain ' + k + ': coordination stopped being a real option')
        ok(mk[CUT][ECHO] >= 3, 'strain ' + k + ': ambush stopped being a threat')
      }

      // Opponent 4 is ALWAYS → HOLD. Mirroring it draws every round whatever the perturbation did,
      // so the handicap alone decides — which is why HOLD is the answer and CUT is the gate.
      ok(setPolicy([], HOLD), 'a free register was refused as a default')
      var t4 = play(3)
      ok(!!t4, 'the encounter did not run')
      if (t4) {
        ok(t4.rounds.length === ROUNDS, 'an encounter is not seven rounds')
        near(t4.mine, t4.theirs, 0, 'HOLD against ALWAYS→HOLD did not draw on points')
        near(t4.handicap, -Math.round(ROUNDS * 0.40), 0, 'the divergence handicap is not −round(7·div)')
        ok(t4.result === 'MERGE', 'a drawn encounter was not a MERGE')
        ok(s.res.canon > 0, 'the encounter paid no CANON')
      }
      ok(anti(s).enc[3].seen === 1, 'their payoffs did not become visible after an encounter')
      ok(antiphony().encounters[3].payoff, 'a fought opponent still hides its payoffs')
      ok(!antiphony().encounters[8].payoff, 'an unfought opponent showed its payoffs for free')

      // Three attempts each, twenty-seven in the run, and no auto-run at any price.
      play(3); play(3)
      ok(play(3) === null, 'a fourth attempt was allowed against a three-attempt opponent')
      // A losing policy costs something outside the minigame: CALL is never a best response.
      ok(setPolicy([], CALL), 'CALL was refused as a default')
      var losses = 0, grew = 0, bornBefore = s.stats.strainsBorn
      for (k = 0; k < LADDER.length; k++) {
        for (i = 0; i < ATTEMPTS; i++) {
          var tr = play(k)
          if (!tr) continue
          if (tr.result === 'DIVERGENCE') {
            losses++
            if (anti(s).enc[k].div > LADDER[k].div + LOSS_DIV / 2) grew++
          }
        }
      }
      ok(losses > 0, 'spamming CALL up the whole ladder never lost once')
      ok(grew === losses, 'a loss did not grow the opponent it lost to')
      ok(s.stats.strainsBorn > bornBefore,
        'losing an encounter cost nothing outside the minigame')
      ok(anti(s).total <= encounterCap(), 'the 27-encounter cap was exceeded')
      ok(play(0) === null, 'the ladder kept running past its hard cap')

      // ABSORPTION pays ≈1.9× MERGE: the merciful outcome is the expensive one.
      var abs0 = CANON_PAY.ABSORPTION.base + CANON_PAY.ABSORPTION.per * 0.5
      var mer0 = CANON_PAY.MERGE.base + CANON_PAY.MERGE.per * 0.5
      near(abs0 / mer0, 1.88, 0.10, 'ABSORPTION no longer pays ≈1.9× MERGE')
      // CANON buys fidelity, and it shares the +0.24 cap with every project that does.
      s.res.canon = 1e6
      s.mult.boughtFid = 0
      canonBuy('fidelity', 1000)
      ok(s.mult.boughtFid <= A3.BOUGHT_FID_CAP + 1e-9,
        'CANON bought past the combined fidelity cap: ' + s.mult.boughtFid)
      ok(s.mult.boughtFid > 0, 'CANON bought no fidelity at all')
      // A policy citing a condition you have not bought is refused, not silently dropped.
      ok(!setPolicy([{ c: 'SCORED_LE0', a: null, r: CUT }], HOLD),
        'an unbought condition was accepted into a policy')
      ok(canonBuy('condition', 'SCORED_LE0'), 'a condition could not be bought with CANON in hand')
      ok(setPolicy([{ c: 'SCORED_LE0', a: null, r: CUT }], HOLD),
        'a bought condition was still refused')

      // ── the wild economy: they out-grow you locally and under-expand globally ───────────
      coldVoid()
      s = S()
      s.a3.bands.X[5] = bandX0(5)
      s.a3.bands.e[5] = 1; s.a3.bands.rich[5] = 1
      s.a3.bands.n[5] = 0
      var wild = onDriftWith(s, 5, 1e16)
      var w0 = wild.w[5]
      for (i = 0; i < 120; i++) stepStrains(1, {})
      ok(wild.w[5] > w0, 'a wild strain in an empty rich band did not grow')
      // Spread is both ways and it is not free.
      var spreadBefore = wild.w[4] + wild.w[6]
      stepSpread(60)
      ok(wild.w[4] + wild.w[6] > spreadBefore, 'strains do not spread')
      ok(wild.w[4] > 0 && wild.w[6] > 0, 'strains spread only one way')
      // Quarantine stops spread dead.
      wild.quarantinedUntil = s.t + 100
      var qBefore = wild.w[4]
      stepSpread(60)
      near(wild.w[4], qBefore, qBefore * 1e-12, 'a quarantined strain still spread')
      // They crowd you out by being present, symmetrically, through sat_b and nothing else.
      var mineAlone = rates(5, playerGenome(s), 1e16, { other: 0 })
      var mineShared = rates(5, playerGenome(s), 1e16, { other: 1e16 })
      ok(mineShared.harvest < mineAlone.harvest, 'wild craft do not compete for carbon')
      near(mineShared.sat, 1 / (1 + mineAlone.occ * 2), 1e-9, 'crowding is not symmetric')

      // ── the readouts the rest of the build depends on ───────────────────────────────────
      ok(typeof driftFraction(s) === 'number' && driftFraction(s) >= 0 && driftFraction(s) <= 1,
        'driftFraction() is not a 0–1 reading')
      ok(strainShare(s) > 0, 'strainShare() reports no wild with a live strain on the board')
      ok(predationRate(5, s) > 0, 'predation is free where a strain shares a band with you')
      var predBase = predationRate(5, s)
      s.proj.flags.somatic_incompatibility = 1
      near(predationRate(5, s) / predBase, LAW.SOMATIC_SKIRM, 1e-9,
        'Somatic Incompatibility did not cut predation to 0.45×')

      // ── offline: the act's clock does not stop while the player is away ─────────────────
      coldVoid()
      s = S()
      s.carry.fidelityBase = 0.74
      s.a3.bands.n[5] = 1e20
      noteReplication(5, 1e20 * 0.0375)
      var driftBefore = s.a3.bands.drift[5]
      stepDrift(1, { stochastic: false, offline: true })
      ok(s.a3.bands.drift[5] > driftBefore, 'drift did not accumulate offline — absence is a cheat')

      // ── serialisation ──────────────────────────────────────────────────────────────────
      coldVoid()
      s = S()
      s.a3.bands.n[7] = 1e20
      var keeper = onDrift(7)
      keeper.sequenced = true
      var round = HY.state.importB64(HY.state.exportB64()) ? S() : null
      if (round) {
        var back = round.a3.strains[0]
        ok(!!back, 'a strain did not survive the save')
        if (back) {
          ok(back.genome instanceof Int8Array, 'a strain genome came back as a plain array')
          ok(back.name === keeper.name, 'a strain lost its name across a save')
          ok(back.sequenced === true, 'a sequenced strain came back unsequenced')
          ok(back.w[7] > 0, 'a strain came back with no craft')
        }
        ok(!!round.a3.div, 'the divergence ledger did not survive the save')
      }
    } catch (err) {
      f.push('THREW: ' + err.message)
    } finally {
      try { HY.state.importB64(keep) } catch (e) { void 0 }
      init(S())
    }
    return f
  }

  // A cold Act III void, with bands seeded the way ESCAPE leaves them. Used only by __selftest.
  function coldVoid () {
    // A fresh save, not a reset of the live one: state.init(null) adopts nothing and would hand
    // back whatever the previous assertion left behind.
    HY.state.importB64(HY.state.exportB64(HY.state.newGame(0x9E3779B9, null)))
    var s = S()
    s.act = 3
    s.phase = 'void'
    s.t = 1000
    var n = nBands(), b
    for (b = 0; b < n; b++) {
      s.a3.bands.X[b] = bandX0(b)
      s.a3.bands.e[b] = 0.5
      s.a3.bands.rich[b] = 1
      s.a3.bands.n[b] = 0
      s.a3.bands.drift[b] = 0
    }
    s.carry.fidelityBase = 0.80
    init(s)
    return s
  }

  function onDriftWith (s, b, n) {
    s.a3.bands.n[b] = n / A().DEFECT_MIN
    var e = onDrift(b)
    s.a3.bands.n[b] = 0
    return e
  }

  HY.divergence = {
    // BIBLE §6 M14
    stepDrift: stepDrift,
    onDrift: onDrift,
    mutate: mutate,
    stepStrains: stepStrains,
    stepSpread: stepSpread,
    sequence: sequence,
    seqCost: seqCost,
    engage: engage,
    predict: predict,
    reinforce: reinforce,
    withdraw: withdraw,
    purge: purge,
    absorb: absorb,
    quarantine: quarantine,
    checkCoalescence: checkCoalescence,
    stepSuccessor: stepSuccessor,
    raiseLociCap: raiseLociCap,
    capCost: capCost,
    antiphony: antiphony,

    // the steps loop.js drives (BIBLE §4 steps 8 and 11)
    step: step,
    stepEngagements: stepEngagements,
    onPulse: onPulse,

    // §6's generic module surface
    init: init,
    tick: tick,
    serialise: serialise,
    migrate: migrate,

    // the readouts bloom, finale, feel and the UI read across the boundary
    strains: function (s) { return living(s || S()) },
    successor: function (s) { return (s || S()).a3.succ },
    engagements: engagements,
    maxConcurrent: maxConcurrent,
    novelty: novelty,
    distance: distance,
    knownGenome: function (id) { var s = S(); var e = findStrain(s, id); return e ? knownGenome(s, e) : null },
    rates: rates,
    traits: traits,
    craftMassOf: craftMassOf,
    effFid: effFid,
    fidPenalty: fidPenalty,
    noteReplication: noteReplication,
    wildOcc: wildOcc,
    wildShare: wildShare,
    totalWild: totalWild,
    strainShare: strainShare,
    driftFraction: driftFraction,
    predationRate: predationRate,
    succShare: succShare,
    succAge: succAge,
    absorbCost: absorbCost,
    quarantineCost: quarantineCost,
    setPolicy: setPolicy,
    playEncounter: play,
    canonBuy: canonBuy,
    AXES: AXES,
    LAW: LAW,
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
