;(function (HY) {
  'use strict'

  // M1 · core.js — the zero-dependency foundation (BIBLE §6 M1).
  //
  // Nothing in this file may read another module's namespace. Everything else in the build may
  // read this one at any time, in any load order.
  //
  // TUNE is the frozen constant registry of 08 §1.3, widened to every number those documents name
  // that crosses a module boundary. A number that lives inside exactly one module (the deadfall
  // table, the project catalog, the colour tokens, the string catalog) belongs to that module's own
  // data table instead — see the section headers below for where each of those lives.
  //
  // Supersessions are applied here, not at the call site. Where 08 S1–S7 or BIBLE §7 C1–C38 moved a
  // number, the moved value is what appears and the comment names the ruling. There is no key in
  // this object holding a superseded value.

  var GROUP = 1000            // SI grouping base; structural, not tunable
  var DASH = '—'         // em dash: the rendering of "no number", never "NaN"
  var MINUS = '−'        // U+2212, not hyphen-minus: it is the width of a digit
  var INF = '∞'

  // ───────────────────────────────────────────────────────────────────────────
  // THE CONSTANT REGISTRY
  // ───────────────────────────────────────────────────────────────────────────

  var TUNE = {

    // ── NUM · the number system (08 §2) ────────────────────────────────────
    NUM: {
      CEIL: 1e42,               // absolute value, any stock; design hard ceiling (08 §2.1)
      GROUP: GROUP,             // ratio between suffix steps
      SIG: 3,                   // significant figures, always (08 §2.2)
      MAX_LEN: 8,               // characters, maximum rendered length of fmt() (D41, HARD)
      VAL_CH: 8,                // ch, min-width of every value slot (08 §2.2)
      RATE_CH: 9,               // ch, min-width of every rate slot
      SAT_EPS: 0.5,             // Σ, the saturation gate slack (08 §2.3 P5)
      RESID_REL: 1e-9,          // dimensionless, flush a residual once it exceeds this × the stock
      ASSERT_EVERY: 200,        // sim ticks between dev-build overflow assertions (08 §2.4)
      INT_MAX: {                // 08 §2.3 P1 — every content-gating integer, asserted integral
        tips: 400,              // count
        patches: 6,             // count
        regions: 61,            // count
        bands: 13,              // count
        loci: 26,               // count
        D: 45,                  // count, lifetime (BIBLE §2.1; supersedes 08 P1's 40)
        pactSlots: 9,           // count
        channels: 19,           // count
        strains: 6,             // count
        projects: 163           // count (BIBLE §7 C2; supersedes 08 P1's 145)
      }
    },

    // ── CLOCK · unified clocks (08 §1.1, §1.2) ─────────────────────────────
    // No constant anywhere in the build is expressed per tick. The sim period changes at DECIDE and
    // the change is invisible because every rate is per real second and multiplied by dt.
    CLOCK: {
      SIM_HZ_A1: 10,            // Hz, Act I sim
      SIM_HZ_A23: 20,           // Hz, Acts II–III sim
      DT_A1: 0.100,             // s per Act I sim tick
      DT_A23: 0.050,            // s per Act II/III sim tick
      DISPLAY_HZ: 10,           // Hz, the one display timer (rates, rings, ARIA)
      MARKET_HZ: 1,             // Hz, price walk and weather walk
      SLOW_HZ: 0.5,             // Hz, the slow strategic step (pacts, rivals)
      LOG_HZ: 1,                // Hz, manageLog() — never faster (BIBLE §4 step 16)
      CANVAS_HZ: 4,             // Hz, canvas redraw ceiling
      AUTOSAVE_S: 10,           // s of simulated time between autosaves
      CATCHUP_BEHIND_S: 0.25,   // s behind before the loop runs a catch-up tick
      CATCHUP_MAX_DT: 2.0,      // s, largest single catch-up dt; never burst
      SEASON_S: 360,            // s, one Act I forest season (BIBLE §2.4: NOT the Act II period)
      YEAR_S: 1440,             // s, one forest-year = 4 seasons
      DAY_S: 15,                // s, flavour + contract term display
      WEATHER_PERIOD: 1800      // s, the Act II OU seasonal cycle (BIBLE §2.4: NOT a season)
    },

    // ── A1 · ACT I (01, 08 §0.3 S1–S5, §4.1–4.3) ───────────────────────────
    // The per-type deadfall table (k, etaB, etaS, mineralPerG, price, cap, fall) is economy1's data
    // table, not a tunable: it is seven rows of shape, and moving one row moves the act's meaning.
    A1: {
      // production
      TIP_THROUGHPUT: 1.875,    // g/s of litter budget per tip (K01, S1)
      TIP_BASE: 60,             // g, cost of the first tip — the 35-second beat (K04); not a knob
      TIP_COEF: 3.20,           // g, tipCost coefficient (K02, S2)
      TIP_EXP: 1.72,            // dimensionless, tipCost exponent (K03, S2); guard 1.55–1.90
      TIP_COEF_FORAGING: 2.60,  // g, tipCost coefficient after Foraging Front (S2; −19%)
      ETA_B: 0.50,             // fraction of litter mass → biomass (K06)
      ETA_S: 0.20,             // fraction of litter mass → sugar (K06)
      RESPIRED: 0.30,          // fraction of litter mass respired and gone (§3.6 conservation)
      // the mineral gate — the spine of the act
      MIN_WARN_TIPS: 20,        // tips, the greyed 0 ⛬ forecast on GROW TIP
      MIN_GATE_TIPS: 24,        // tips, first tip that costs a mineral (≈11:48)
      MIN_GATE_COEF: 0.060,     // ⛬, tipMineralCost coefficient (K10)
      MIN_GATE_EXP: 1.35,       // dimensionless, tipMineralCost exponent (K11); guard 1.20–1.50
      // sugar
      SUGAR_CAP_BASE: 400,      // g, sugarCap intercept
      SUGAR_CAP_SLOPE: 30,      // g per tip, sugarCap slope (K09); guard ≥ 12
      ROT_RATE: 0.060,          // /s of the excess above sugarCap (BIBLE §2.3)
      SCLEROTIA_ROT_GATE: 500,  // g rotted, lifetime, before Sclerotia triggers
      // hyphae (S4)
      HYPHAE_PER_TIP: 1.75,     // m per tip
      HYPHAE_PER_PATCH: 30.0,   // m per patch beyond the first
      HYPHAE_PER_TAP: 0.020,    // m per EXTEND tap
      HYPHAE_GATE: 500,         // m, the Act I finale gate
      // environment
      MOIST_RELAX_PER_S: 0.040, // /s toward target (BIBLE §2.2's 0.004 per 10 Hz tick, per second)
      MOIST_OPT: 1.05,          // moisture units, the peak of the response hump
      MOIST_WIDTH: 0.30,        // moisture units², the gaussian denominator
      MOIST_MIN: 0.15,          // moisture units, floor
      MOIST_MAX: 1.50,          // moisture units, ceiling
      SEASON_MOIST: [1.15, 0.70, 1.05, 0.55],  // moisture target by season SPRING SUMMER AUTUMN WINTER
      SEASON_TEMP: [0.95, 1.15, 1.00, 0.55],   // tempMult by season
      ANTIFREEZE_WINTER: 1.545, // × on tempMult in winter with Antifreeze Glycoproteins
      SEASON_SPRING: 0,         // season index
      SEASON_SUMMER: 1,         // season index
      SEASON_AUTUMN: 2,         // season index
      SEASON_WINTER: 3,         // season index
      // territory (S3, §4.2)
      PATCH_SUPPLY_EXP: 1.80,   // dimensionless, fall × patches^this (K05); cap stays linear
      PATCH_MULT_STEP: 0.06,    // × per patch beyond the first, on throughput
      PATCH_MAX: 6,             // count
      FOREST_SUPPLY_BASE: 849,  // g/s, annual-mean litterfall on one patch
      SUSTAINABLE_FRAC: 0.65,   // fraction of inflow a player may take indefinitely
      CLAIM_S_PER_INDEX: 45,    // s per patch index, claim duration
      CLAIM_THROUGHPUT: 0.90,   // × on throughput while a claim is in flight
      PATCH: [                  // index 0 is the home patch; costs are 08 §4.2
        { biomass: 0,      minerals: 0,    claimS: 0 },
        { biomass: 12000,  minerals: 90,   claimS: 90 },   // gate: biomass ≥ 12,000
        { biomass: 30000,  minerals: 260,  claimS: 135 },  // gate: netRep ≥ 22
        { biomass: 70000,  minerals: 700,  claimS: 180 },  // gate: patches ≥ 3
        { biomass: 160000, minerals: 1800, claimS: 225 },  // gate: netRep ≥ 45
        { biomass: 400000, minerals: 4400, claimS: 270 }   // gate: netRep ≥ 55
      ],
      PATCH_GATE_REP: [0, 0, 22, 0, 45, 55],   // netRep required per patch index (0 = none)
      // the litter market (01 §5A.3–5A.4; 08 §3.4)
      MOM_DECAY: 0.955,         // /s autocorrelation of price momentum → half-life 15.0 s
      MEAN_REV: 0.030,          // /s, pull of price toward fair
      PRICE_SIGMA: 0.006,       // /s, gaussian innovation on momentum
      MOM_CLAMP: 0.075,         // dimensionless, |mom| ceiling
      FAIR_K: 1.10,             // dimensionless, scarcity premium coefficient
      FAIR_EXP: 1.60,           // dimensionless, scarcity premium exponent
      PRICE_FLOOR: 0.30,        // × base, hard floor on price
      PRICE_CEIL: 5.00,         // × base, hard ceiling on price
      INFL: 0.060,              // permanent base drift per cap-unit purchased (K07); guard ≤ 0.10
      IMPACT: 0.350,            // momentum kick per 5%-of-cap traded
      SPREAD: 0.720,            // you sell back at this fraction of mid (K08); guard ≤ 0.80
      SELL_BASE_DROP: 0.020,    // base drop per cap-unit sold back
      COOL_S: 45,               // s of no trading before base decays
      COOL_RATE: 0.0003,        // /s, base decay while cool
      COOL_FLOOR: 0.85,         // × BASE_PRICE, the floor base decay cannot pass
      STOCK_INIT_FRAC: 0.55,    // × cap, market stock at cold boot
      HIST_LEN: 120,            // samples at 1 Hz; not saved, refills in 120 s
      // contracts (01 §6; 08 §11.1 G1b/G1c)
      TERM_MIN: 1,              // seasons
      TERM_MAX: 8,              // seasons
      REP_MAX: 100,             // reputation units, per tree and net
      RESERVE_S: 60,            // s of feedstock held back from delivery (G1b)
      SHORTFALL_FRAC: 0.05,     // fraction of one season's delivery ≈ 18 s of non-payment
      // failsafes (BIBLE §5.5; 08 §5.3, §11.3)
      WINDFALL_SUB: 50,         // g, totalSubstrate below which WINDFALL arms
      WINDFALL_BIOMASS: 200,    // g, biomass below which WINDFALL arms
      WINDFALL_LEAF: 2000,      // g of leaf granted
      WINDFALL_REP: 1,          // reputation units charged
      WINDFALL_FREE_S: 300,     // s between free grants at netRep 0
      PHOSPHORUS_BASE: 200,     // ⛬, A Gift of Phosphorus, doubling per use
      PHOSPHORUS_GROWTH: 2.0,   // × per use
      PHOSPHORUS_REP: 40,       // reputation, a tree below this arms the gift
      UTIL_ALARM: 0.92,         // utilisation sustained before the territory alarm fires
      UTIL_ALARM_S: 180,        // s of sustained utilisation required
      UTIL_ALARM_PRICE: 0.60,   // × normal price on the force-revealed territory, once per act
      // the reveal chain (BIBLE §5.2)
      REVEAL_SUBSTRATE_G: 5,        // g biomass
      REVEAL_TIPS_G: 60,            // g biomass
      REVEAL_SUGAR_TIPS: 3,         // tips
      MARKET_SUB_G: 500,            // g total substrate, or
      MARKET_T: 210,                // s elapsed
      SEASONS_T: 300,               // s elapsed, exactly
      TREES_SUGAR_G: 250,           // g sugar, and season == WINTER
      PROJECTS_BIOMASS_G: 2000,     // g biomass
      ACTION_POTENTIAL_REP: 60,     // netRep, with anastomosis owned
      DECIDE_SIGNAL: 1000,          // Σ held, with action_potential
      // cold boot (BIBLE §3)
      BOOT_SUB_LEAF: 2000,      // g of leaf on the floor at t = 0
      BOOT_SEASON: 2,           // AUTUMN
      BOOT_SEASON_PHASE: 0.1667, // fraction, so the first boundary lands at t = 300 s exactly
      BOOT_MOISTURE: 1.05       // moisture units: every multiplier reads 1.000
    },

    // ── HANDOFF · Act I → Act II, normative (08 S5) ─────────────────────────
    HANDOFF: {
      BIOMASS: 2.0e6,           // g held
      CUM_BIOMASS: 3.4e6,       // g lifetime gross
      MINERALS: 1.6e4,          // ⛬
      DECOMP_RATE0: 2.7e3,      // g/s at Act II t = 0
      TIPS: 255,                // count
      HYPHAE: 596,              // m
      D: 3,                     // Differentiation points
      BIOMASS_KEPT: 0.10        // × biomass surviving DECIDE (BIBLE P1)
    },

    // ── A2 · ACT II (02 §17, 05, 08 §3.5–3.7, §4.4–4.5, §4.8) ──────────────
    // Terrain tables, guild payoff shapes and the 61-hex worldgen rules are world/forest/pactbook
    // data tables. What lives here is what more than one module reads.
    A2: {
      ACT2_SCALE: 0.333,        // × on every biomass-dimensioned Act II quantity (K18, S6)
      // signal and capacity (08 §3.5) — the timeToFill identity depends on these four exponents
      SIG_K: 3.00,              // Σ/s coefficient (K12)
      SIG_CAP_BASE: 260,        // Σ, capacity intercept (K13)
      D_COND_STEP: 0.35,        // × per Conduction point on Sr
      D_VES_EXP: 1.85,          // dimensionless, Vesicle exponent on Sc
      IFACE_BASE: 0.60,         // dimensionless, the additive term inside the interface bracket
      IFACE_EXP: 0.85,          // dimensionless, interface exponent — identical in Sr and Sc
      TIME_TO_FILL_K: 86.7,     // s, Sc/Sr at baseline; BIBLE §9.4 forbids changing this identity
      // insight (08 §3.5, BIBLE §7 C18, C31)
      INS_K: 0.055,             // Ψ/s per √(Σ/s) (K14); guard Ψ slack ≥ 2%
      RIPE_T: 180,              // s to full ripeness (K15); guard 120–240. Act III inherits.
      RIPE_T_MEMORY: 130,       // s, after mycelial_memory (C7)
      RIPE_T_DEEP: 95,          // s, after deep_hyphae (D7)
      RIPE_DEC: 3.0,            // × the build rate at which satTime decays (K16); guard ≥ 2.0
      RIPE_FLOOR_CAP: 0.30,     // dimensionless, hard cap on GHOST ripenessFloor; not saturation
      INS_RIPE_A: 0.25,         // dimensionless, the un-ripened share of the Insight rate
      INS_RIPE_B: 0.75,         // dimensionless, the ripeness-scaled share
      // differentiation
      D_LADDER_SCALE: 1.665e8,  // g cumBiomass, the Lucas ladder scale (5.0e8 × ACT2_SCALE, C9)
      D_TRIGGER: 5.0e8,         // g cumBiomass, flags.differentiation (C9)
      D_MAX: 45,                // points, lifetime across Acts II and III
      RESPEC_A: 120,            // Ψ, respec coefficient; the counter is NOT reset at the act break
      RESPEC_E: 1.60,           // dimensionless, respec exponent
      // decomposition and the living forest (02 §17, S6)
      KAPPA: 6.20e-4,           // /s, decomposition coefficient (K17)
      LAMBDA: 5.50e-9,          // /s, litterfall from standing mass (K19); h-switch at 0.28
      TREE_G: 1.60e-8,          // /s, tree growth (K20)
      TMAX_MULT: 1.35,          // × T0, the standing-mass ceiling
      BASE_MORT: 9.0e-7,        // /s, background tree mortality
      NECRO_RATE: 8.5e-4,       // /s, necrotrophic conversion rate
      HUMUS_IN: 0.16,           // fraction of decomposed mass retained as humus at ρ = 1
      HUMUS_OUT_A: 2.80e-4,     // /s, humus mineralisation, low branch
      HUMUS_OUT_B: 9.50e-4,     // /s, humus mineralisation, high branch
      HUMUS_SCALE_F: 0.045,     // dimensionless, humusF scale
      HUMUS_SWITCH: 0.28,       // humus fraction: renewable stand above, mine below
      HUMUS_FIRE: 0.22,         // humus fraction below which fire becomes reachable
      RHO_MAX: 0.80,            // retention dial ceiling
      RHO_FLAT_MAX: 0.45,       // dial is flat to 1.5% on the short-run rate below this
      RHO_PINS: 5,              // per-region pins (10 with homeostasis)
      // world size (S6, BIBLE §7 C11) — per-region shape constants are renormalised by forest.js
      // so that ΣL0 == L0_TOTAL and ΣT0 == T0_TOTAL exactly.
      REGIONS: 61,              // count
      EXTRACT_TARGET: 4.00e12,  // g, the act's master clock: fc = extracted / this
      FOREST_TOTAL: 7.08e12,    // g of carbon in the forest at Act II t = 0
      L0_TOTAL: 1.42e12,        // g of litter at t = 0 (20% of the forest)
      T0_TOTAL: 5.66e12,        // g standing and alive at t = 0 (80% of the forest)
      LITTER_BASE: 1.15e10,     // g, per-region litter shape constant, unscaled
      STANDING_BASE: 4.60e10,   // g, per-region standing shape constant, unscaled
      RING_MULT: 0.55,          // × per hex ring outward, on both shape constants
      // territory (08 §4.4–4.5; BIBLE §7 C38)
      ADV_BASE: 6.00e5,         // g, first ADVANCE (1.80e6 × ACT2_SCALE, S6)
      ADV_GROWTH: 1.21,         // × per region already claimed (C38: 1.21 ships; the harness arbitrates)
      ADV_TIME: 45,             // s, base advance duration
      ADV_RING_TIME: 4.5,       // s per ring, added to advance duration
      ADV_RING_COST: 0.22,      // × per ring, added to advance cost
      DENS_BASE: 2.40e5,        // g, density step at d = 0, scaled by L0_i/L0_ref
      DENS_POLE_EXP: 1.35,      // dimensionless, (1 − d)^−this: no region is worth full density
      CONN_K: 0.14,             // dimensionless, connectivity coefficient
      CONN_EXP: 1.25,           // dimensionless, connectivity exponent
      CONN_MIN: 1.00,           // C floor
      CONN_MAX: 1.60,           // C ceiling
      SURVEY_COST: 120,         // Σ per region survey, requires substrate_assay
      SEED_BASE: 4.00e3,        // g, first spore seeding (1.20e4 × ACT2_SCALE, S6)
      SEED_GROWTH: 1.34,        // × per seeding
      // weather — flush.js owns this process; everyone else reads W() (05 §0.1)
      OU_THETA: 0.010,          // /s, mean-reversion rate of W
      OU_SIGMA: 0.028,          // /√s, innovation of W
      OU_MEAN: 0.52,            // dimensionless, W̄
      W_SEASON_AMP: 0.16,       // dimensionless, amplitude of the deterministic seasonal term
      W_MIN: 0.02,              // dimensionless, W floor
      W_MAX: 0.98,              // dimensionless, W ceiling
      WIND_BOOT: 0.45,          // dimensionless, wind speed at act start
      FORECAST_H: [0, 120, 300, 600],   // s of forecast horizon: none, B4, D1, E1
      FORECAST_ALARM_BONUS: 90, // s of extra horizon inside an ALARM region
      // flush
      MAT_TIME: 240,            // s to primordium maturity
      SPORE_K: 0.045,           // ◦ per g released
      HAZ_BASE: 0.0022,         // /s, base hazard rate on a maturing primordium
      YIELD_EXP: 1.60,          // dimensionless, yield grows as m^this
      EXPOSURE_EXP: 2.00,       // dimensionless, exposure grows as m^this — hence an interior m*
      HAZ_ROBUST: 0.35,         // × hazard reduction per unit robustness
      AUTO_RELEASE: 0.55,       // × skilled play; suspended entirely during a Mast Year
      SPORE_DECAY: 0.99995,     // per second (half-life 3 h 51 m); disabled by Seed Bank (E3)
      MAST_PERIOD: 2100,        // s between mast windows
      MAST_JITTER: 400,         // s, uniform jitter on the period
      MAST_WARN: 180,           // s of warning before a mast window opens
      MAST_LEN: 90,             // s the window stays open
      MAST_MULT: 6.0,           // × yield inside the window
      MAST_FLUSH_GATE: 40,      // flushes before flags.mast_synchrony
      // fire
      FIRE_ACC: 0.0055,         // /s, fireRisk accumulation below HUMUS_FIRE
      FIRE_DEC: 0.0090,         // /s, fireRisk decay above it
      FIRE_TRIG: 0.85,          // fireRisk at which ignition becomes possible
      FIRE_P: 0.030,            // /s, ignition probability once triggered; never fires offline
      // pulse (never automated, in any act, at any price)
      PULSE_COST_FRAC: 0.55,    // × Sc — guarantees a pulse always breaks saturation
      PULSE_CD: 120,            // s cooldown, Act II
      PULSE_FALLOFF: 0.82,      // × per hex/band of distance from the epicentre
      // the pact book (05; 08 §4.8)
      TERM_PERIOD_S: 1800,      // s, one pact term period — NOT a season (BIBLE §2.4)
      CHANNEL_A: 46,            // ⟡, channel cost coefficient
      CHANNEL_E: 1.55,          // dimensionless, channel cost exponent
      CHANNELS_MIN: 3,          // count at first unlock
      CHANNELS_MAX: 19,         // count, late act
      SLOTS_MIN: 2,             // pact slots at first unlock
      SLOTS_MAX: 9,             // pact slots, late act
      CONGEST_K: 0.052,         // dimensionless, congestion coefficient
      CONGEST_EXP: 1.42,        // dimensionless, congestion exponent — convex in book size
      RECONCILE_K: 260,         // ⟡, base reconcile cost
      TRIANGLE_K: 420,          // ⟡, base triangle cost
      BOND_MAX: 2.60,           // × bondMult ceiling, reached over ~1 h of tenure
      STRAIN_CAP: 0.95,         // strain hard cap while offline — a breach can never occur offline
      PASSIVE_MIN_K: 0.90,      // ⛬/s coefficient, the always-on mineral floor
      PASSIVE_MIN_EXP: 0.60,    // dimensionless, on claimedCount
      // act flags and gates (BIBLE §5.3)
      CHEMOTAXIS_SIG: 400,      // Σ, the first Act II purchase (≈0:40)
      PRIMORDIUM_INSIGHT: 8,    // Ψ, unlocks FLUSH
      ACTION_POTENTIAL_CLAIMED: 3,  // regions claimed, unlocks PULSE
      PACT_FIRST_FC: 0.004,     // fc
      HUMIC_RETENTION_H: 0.25,  // any region.h below this — failure detection
      NECRO_FC: 0.22,           // fc, unlocks KILL STAND
      PACT_CHEMO_PACTS: 3,      // pacts held, with maxTenure ≥ 600 s
      PACT_CHEMO_TENURE: 600,   // s
      PATH_FC: 0.60,            // fc required by both path projects
      CHARTER_LIFE: 0.55,       // LEGACY_LIFE at or above → symbiont path available
      CONVERSION_LIFE: 0.25,    // LEGACY_LIFE at or below → necrotroph path available
      PHOTO_FC: 0.88,           // fc, the anti-softlock floor arms
      PHOTO_FLOOR: 0.40,        // × SrPeak, the mercy floor on Sr
      PHOTO_COST: 1300,         // Ψ
      ASCOSPORE_FC: 0.97,       // fc, the transition becomes purchasable
      // the transition (BIBLE §2.2, §2.3)
      SPORE_DIVISOR: 270,       // g of held biomass per banked spore (K28, S7)
      LEGACY_HUMUS_W: 0.55,     // weight on humus mean in LEGACY
      LEGACY_LIFE_W: 0.45,      // weight on ΣT/ΣT0 in LEGACY
      ASCOSPORE_MINERALS: 0.25, // × minerals surviving the transition
      ASCOSPORE_SIGNAL_MULT: 0.35  // × signalMult at the transition
    },

    // ── A3 · ACT III (03 §24 TUNE3; 08 §4.6–4.7; BIBLE §7 C18, C20) ────────
    A3: {
      // canopy, phase A
      SPORE_DECAY_3: 0.99700,   // per second, Phase A only (half-life 231 s)
      SETTLE_Q: 2.4e7,          // ◦ per SETTLE
      REACH_BASE: 2.6e3,        // ◦, first REACH
      REACH_GROWTH: 2.35,       // × per REACH
      BIOME_X0: [2.0e15, 1.4e17, 2.6e17, 9.0e16, 3.4e17, 1.2e18, 3.0e17, 1.7e18],  // g carbon per biome
      GERM_TUBE_N: 2.0e8,       // craft, auto-SETTLE unlocks
      APPRESSORIUM_X: 4.0e14,   // g carbon, REACH and the biome list unlock
      ESCAPE_PC: 0.97,          // planetConsumed at which ESCAPE becomes available
      ESCAPE_LOSS: 0.96,        // fraction of craft destroyed — exact, never stochastic
      // band geometry
      BANDS: 13,                // count
      R_BASE: 12.0,             // ly, radius of band 0
      R_GROWTH: 2.150,          // × per band
      X0_BASE: 9.00e26,         // g carbon, band 0
      X0_GROWTH: 5.600,         // × per band
      NCAP_DIV: 6.00e10,        // g per unit NCAP: NCAP_b = X0_b / this
      LAG_K: 0.024,             // s per ly, pulse light-lag coefficient
      LAG_T: 0.00220,           // s per ly, transit lag coefficient
      TAU0: 90,                 // s, band 0 → 1 transit
      TAU_GROWTH: 1.350,        // × per band; band 10→11 is 1,340 s, the longest wait in HYPHAE
      PROP_K: 1.80,             // dimensionless: landed fraction = 1/(1+this) = 0.357
      MAXLAUNCH: 0.020,         // fraction of a band's fleet launchable per second
      // the core loop
      HARV_K: 4.00e7,           // g/s harvest coefficient (K21)
      SUB_K: 9.00e5,            // g/s subsistence coefficient (K22); guard A/S ≥ 20
      REP_K: 0.0250,            // /s replication coefficient (K23)
      AS_RATIO: 66.7,           // A/S at baseline ⇒ n* = 7.17·NCAP, n† = 65.7·NCAP
      N_STAR_K: 7.17,           // × NCAP, the surplus-maximising fleet
      N_DAGGER_K: 65.7,         // × NCAP, carrying capacity: a band filled here produces nothing
      CRAFT_M0: 2.40e6,         // g, craft mass at genome length 0
      GEN_TAX: 0.085,           // per locus, inside the mass bracket (K24)
      GEN_EXP: 1.15,            // dimensionless, mass exponent (K24)
      EXP_K: 2.20e-3,           // /s, exploration rate
      NREF_FRAC: 0.30,          // dimensionless, reference fleet fraction
      GERM_BASE: 0.280,         // dimensionless, base establishment probability
      ALLOC_BOOT: [0.70, 0.20, 0.10],  // aRep, aDis, aBank — must sum to 1 on every write
      // hazards; every death is attributed at the point it occurs, to one of six causes
      RAD_K: 2.60e-5,           // /s, radiation hazard coefficient
      TR_HAZ: 3.00e-4,          // /s, transit hazard
      SEN_K: 1.10e-5,           // /s, senescence
      STELLAR_P: 4.20e-4,       // /s, stellar event probability; never fires offline
      SKIRM_K: 0.0016,          // /s, predation/skirmish coefficient
      MORTALITY_WINDOW: 60,     // s, the rolling attribution window
      MORTALITY_CAUSES: 6,      // STARVE RAD TRANSIT ESTAB SENESCE PREDATION, in this order
      // signal and insight — same shapes as Act II, so the timeToFill identity survives
      SIG_K3: 4.20,             // Σ/s coefficient
      SIG_CAP3: 364,            // Σ, capacity intercept
      NSIG: 1.00e12,            // craft, the Λ reference fleet
      LAMBDA_EXP: 0.18,         // dimensionless, (n_b/NSIG)^this inside Λ
      // genome
      LOCI_FREE0: 4,            // loci granted free with flags.genome
      LOCI_CAP0: 12,            // starting lociCap; raised only with α
      LOCI_A: 140,              // Ψ, locusCost coefficient (08 §4.6: ceil(140·(L+1)^1.62))
      LOCI_E: 1.62,             // dimensionless, locusCost exponent (08 §4.6 supersedes 1.24)
      LOCI_MAX: 26,             // loci, hard cap on Σ loci
      CAP_A: 400,               // α, lociCap raise coefficient (C19: 03's mechanism wins)
      CAP_G: 1.42,              // × per raise
      SEQ_A: 140,               // Ψ, sequencing coefficient
      SEQ_G: 1.42,              // × per sequencing
      REGEN_FRAC: 0.020,        // × lifetime carbon, REGENOME cost
      REGEN_G: 1.75,            // × per REGENOME
      REGEN_T: 90,              // s of halted replication after a REGENOME
      // fidelity (BIBLE §2.2, §7 C20)
      FID_BASE_A: 0.72,         // intercept of fidelityBase = 0.72 + 0.28·legacy
      FID_BASE_B: 0.28,         // slope on legacy
      FID_PER_FID_LOCUS: 0.030, // Φ per FID locus
      FID_PER_ANT_LOCUS: 0.038, // Φ lost per ANT locus
      BOUGHT_FID_CAP: 0.24,     // Φ, hard cap on projects + CANON combined
      FID_MIN: 0.30,            // Φ floor
      FID_MAX: 0.9975,          // Φ ceiling
      // divergence — the only source of alleles in the game
      DRIFT_K: 0.280,           // /s coefficient on drift accumulation
      DRIFT_TRIG: 1.000,        // drift at which a divergence event fires
      DRIFT_DECAY: 6.0e-4,      // /s, drift decay
      DRIFT_FID_EXP: 1.4,       // dimensionless, drift ∝ n·(1−Φ)^this
      DEFECT_MIN: 0.040,        // fraction of a band's fleet that defects, minimum
      DEFECT_MAX: 0.140,        // maximum
      MUT_P: 0.30,              // fraction of loci mutated at birth; total preserved ±2
      SPREAD_K: 9.0e-4,         // /s, wild-strain spread
      MAX_STRAINS: 6,           // count alive at once
      ALPHA_PURGE: 0.90,        // α per purge
      ALPHA_ABSORB: 2.10,       // α per absorb
      ALPHA_SUCC: 4.00,         // α per Successor resolution
      ALPHA_EXP: 0.30,          // dimensionless, α scaling with strain size
      NOVELTY_K: 0.14,          // dimensionless, α bonus for genetic distance
      STRAIN_LINEAGES_DRIFT: 1.0,   // drift at which LINEAGES first appears
      ANASTOMOSIS_STRAINS: 2,   // strains alive before ABSORB is offered
      ANTI_ORGAN_WILD: 0.18,    // wildFraction at which the Antiphony unlocks
      ANTIPHONY_MAX: 27,        // encounters; the source cap on CANON
      // combat — Lanchester square, closed-form prediction, quantified unknown
      COMBAT_K: 0.0140,         // /s, engagement rate
      WITHDRAW_RECOVER: 0.60,   // fraction of the committed fleet recovered on withdraw
      REINFORCE_FRAC: 0.10,     // fraction of the home fleet per reinforce
      // the successor
      SUCC_TRIGGER_T: 120,      // s of Σw ≥ Σn sustained before coalescence
      SUCC_LEARN_S: 240,        // s, its learning period
      DESYNC_K: 0.020,          // /s, phase noise it injects into every band it occupies
      SUCC_CEDE_AGE: 1800,      // s of age before ENDING C is available
      // pulse and synchrony
      PULSE_CD: 75,             // s cooldown, Act III
      K_ENTRAIN: 0.55,          // dimensionless, entrainment strength on arrival
      PERIOD_BASE: 300,         // s, band 0 phase period
      PERIOD_SLOPE: 0.22,       // dimensionless, period growth per band
      ISO_COMPRESS: 0.55,       // dimensionless, isolation compression on the wheel
      UPSILON_FREE: 0.31,       // ϒ free-runs here with no input
      // endings (BIBLE §5.4)
      BLOOM_Y: 0.80,            // ϒ required by ENDING A
      BODY_Y: 0.97,             // ϒ required by ENDING B
      BLOOM_X: 9.00e34,         // g carbon, ENDING A (K25)
      BODY_X: 1.60e35,          // g carbon, ENDING B
      BLOOM_SIG: 1.10e7,        // Σ held, ENDING A — you must stop pulsing for one timeToFill
      BLOOM_PSI: 2400,          // Ψ, ENDING A
      BODY_PSI: 3600,           // Ψ, ENDING B
      BODY_FID: 0.985,          // Φ, ENDING B
      ENCYST_S: 1200,           // s in the void before ENCYST is offered
      // prestige
      K_SCL: 45,                // ◉ coefficient
      SCL_CARB_EXP: 0.42,       // dimensionless, on cumulative carbon
      SCL_CARB_REF: 1.0e33,     // g, the carbon reference
      SCL_LEGACY: 0.60,         // weight on legacy
      SCL_FID: 0.85,            // weight on fidelity
      SCL_STRAIN: 0.020,        // weight per strain survived
      END_MULT: { bloom: 1.00, body: 1.15, inherit: 1.30, encyst: 0.35 },  // × on ◉
      ARCHIVE_MAX: 3            // defectors carried into the next run, by name
    },

    // ── OFFLINE (08 §10) ───────────────────────────────────────────────────
    // One schedule, three acts, one code path. No decision runs offline, ever.
    OFFLINE: {
      CAP: 43200,               // s (12 h) (K26)
      CAP_VERNALISATION: 86400, // s (24 h) with Vernalisation
      TIERS: [[7200, 1.00], [21600, 0.75], [43200, 0.50]],  // [upperBound s, multiplier]
      VERN_FLOOR: 0.70,         // multiplier floor with Vernalisation
      DOR_FLOOR_STEP: 0.020,    // multiplier floor added per DOR locus (Act III)
      DOR_FLOOR_MAX: 0.16,      // cap on the DOR contribution
      STEPS: 240,               // macro-steps through the real simTick
      INSIGHT_CAP_S: 5400,      // s of saturated production, against the time-average Sr (K27)
      PRED_CAP: 0.25,           // fraction of the fleet predation may take, whole period
      STRAIN_MULT: 0.35,        // × pact strain accrual
      ACCORD_MULT: 0.60,        // × ACCORD accrual
      RETURN_LINES: 5           // lines in the return burst; lines 3 and 4 are load-bearing
    },

    // ── PROJ · the progression engine (04, BIBLE §6 M4) ────────────────────
    PROJ: {
      VISIBLE_CAP: 6,           // non-pinned revealed entries; pinned entries bypass it
      PINNED: 9,                // count of pinned entries in the catalog
      DAI_MAX: 9,               // affordable entries, including pinned (Invariant II(d))
      DAI_MEDIAN: [2, 4],       // target median band
      DEAD_AIR_MAX: 480,        // s, longest permitted run with nothing affordable (HARD)
      COUNT_A1: 45,             // entries
      COUNT_A2: 68,             // entries
      COUNT_A3: 50,             // entries
      COUNT: 163,               // entries total
      NEAR_RATIO: 0.35          // affordRatio at or above which an entry counts as NEAR
    },

    // ── LOG · the console (09, BIBLE §6 M5) ────────────────────────────────
    // The string catalog itself is log.js's data table.
    LOG: {
      HARD_GAP: 1.2,            // s, minimum between two rendered lines
      BURST_CAP: 6,             // lines per rolling window
      BURST_WINDOW: 20,         // s, the rolling window
      OBS_COOLDOWN: 240,        // s between idle observations
      RING: 200,                // lines retained for the LOG tab
      ROWS: 5,                  // rows visible; lines wrap (BIBLE §7 C15)
      RETURN_GAP: 1.2           // s between return-burst lines
    },

    // ── SAVE (08 §10.7, BIBLE §3.1) ────────────────────────────────────────
    SAVE: {
      SLOTS: 3,                 // plus a rolling .bak written before each overwrite
      PREFIX: 'hyphae.slot',    // localStorage key prefix
      FAULT_KEY: 'hyphae.balanceFault',  // dev-build fault dump
      MAX_BYTES_A1: 22528,      // bytes (22 KB)
      MAX_BYTES_A2: 34816,      // bytes (34 KB)
      MAX_BYTES_A3: 3072        // bytes (3 KB)
    },

    // ── UI · only what a sim module may legitimately need to know ──────────
    // Colour tokens, curves, durations and layout stages are ui.js's own token block.
    UI: {
      BASE_PX: 360,             // CSS px, the design base
      COLUMN_PX: 420,           // CSS px, the column width, forever
      TAP_MIN_PX: 44,           // CSS px, minimum tap target on both axes
      GRID_PX: 4,               // CSS px
      GUTTER_PX: 16,            // CSS px
      TAB_SLOTS: 5,             // allocated at boot, revealed one at a time
      ACT3_SHIFT_MS: 2600,      // ms, the Act III cold shift
      LUM_CHANGES_MAX: 3,       // per second, anywhere, ever (D51, HARD)
      SEG_PER_M: 0.40,          // canvas segments per metre of hyphae
      SEG_CAP: 1800,            // canvas segments, maximum
      AGE_WASH: 0.045           // fraction of a wash applied to the network once per season
    }
  }

  deepFreeze(TUNE)

  function deepFreeze (o) {
    var k, v
    for (k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue
      v = o[k]
      if (v && typeof v === 'object') deepFreeze(v)
    }
    return Object.freeze(o)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FORMATTING (08 §2.2)
  // ───────────────────────────────────────────────────────────────────────────

  var SUF = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y', 'R', 'Q',
             'aa', 'ab', 'ac', 'ad', 'ae', 'af']

  // fmtMass's table is SUF offset two steps with the unit appended: index 2 is `t`, because
  // 1e6 g is one tonne. Built rather than written out so the two tables cannot drift apart.
  var MASS_SUF = buildMassSuffixes()

  function buildMassSuffixes () {
    var out = ['g', 'kg'], i
    for (i = 2; i < SUF.length + 2; i++) out.push(SUF[i - 2] + 't')
    return out
  }

  // Mantissa at `sig` significant figures. Three digits before the point means zero after it.
  // Rounding is re-checked against its own result: 9.999 at three figures is 10.0, not 10.00, and
  // 99.99999999999999 (which is how 1e41/1e39 lands in a double) is 100, not 100.0 — the second
  // form is one character over budget once a two-letter suffix and a minus sign are added.
  function mantissa (m, sig) {
    var d = sig - 1 - (m < 10 ? 0 : m < 100 ? 1 : 2)
    if (d < 0) d = 0
    var s = m.toFixed(d)
    var v = parseFloat(s)
    var d2 = sig - 1 - (v < 10 ? 0 : v < 100 ? 1 : 2)
    if (d2 < 0) d2 = 0
    return d2 === d ? s : v.toFixed(d2)
  }

  function fmt (n, sig) {
    if (sig === undefined) sig = TUNE.NUM.SIG
    if (typeof n !== 'number') n = Number(n)
    // NaN is tested before finiteness: isFinite(NaN) is false, and the reference formatter would
    // print it as ∞, which is a lie the player would act on.
    if (n !== n) return DASH
    if (n === Infinity) return INF
    if (n === -Infinity) return MINUS + INF
    if (n < 0) return MINUS + fmt(-n, sig)

    var s, e, m
    if (n < GROUP) {
      s = mantissa(n, sig)
      // 999.6 is 1.00 k at three significant figures, not "1000" at four.
      if (parseFloat(s) < GROUP) return s
      n = GROUP
    }

    e = Math.floor(Math.log10(n) / 3)
    if (e < 1) e = 1
    m = n / Math.pow(GROUP, e)
    // log10 is not exact at the band edges (log10(1e33)/3 lands just under 11), so the mantissa is
    // corrected rather than trusted.
    if (m >= GROUP) { e += 1; m /= GROUP }
    s = mantissa(m, sig)
    if (parseFloat(s) >= GROUP) { e += 1; m /= GROUP; s = mantissa(m, sig) }
    // Above the table the value is beyond anything the design can produce (ceiling 1e42, table
    // 1e48). Rendering it as ∞ keeps the 8-character guarantee instead of spilling digits.
    if (e >= SUF.length) return INF
    return s + ' ' + SUF[e]
  }

  function fmtMass (g) {
    if (typeof g !== 'number') g = Number(g)
    if (g !== g) return DASH
    if (g === Infinity) return INF
    if (g === -Infinity) return MINUS + INF
    if (g < 0) return MINUS + fmtMass(-g)

    var sig = TUNE.NUM.SIG
    var s, e, m
    if (g < GROUP) {
      s = mantissa(g, sig)
      if (parseFloat(s) < GROUP) return s + ' ' + MASS_SUF[0]
      g = GROUP
    }
    e = Math.floor(Math.log10(g) / 3)
    if (e < 1) e = 1
    m = g / Math.pow(GROUP, e)
    if (m >= GROUP) { e += 1; m /= GROUP }
    s = mantissa(m, sig)
    if (parseFloat(s) >= GROUP) { e += 1; m /= GROUP; s = mantissa(m, sig) }
    if (e >= MASS_SUF.length) return INF
    return s + ' ' + MASS_SUF[e]
  }

  // Two shapes are needed and both are named in BIBLE §6: the countdown/elapsed form of 06 R7
  // (`3:51`, `2:14`, `2d 04:19`) and the absence form of 09 (`6 h 41 m`). `style` is optional so
  // every call site may keep writing fmtTime(s).
  function fmtTime (s, style) {
    if (typeof s !== 'number') s = Number(s)
    if (s !== s || s === Infinity || s === -Infinity) return DASH
    if (s < 0) s = 0
    s = Math.floor(s)
    var d = Math.floor(s / 86400)
    var h = Math.floor(s / 3600)
    var m = Math.floor((s % 3600) / 60)
    var sec = s % 60

    if (style === 'away') {
      if (h >= 1) return h + ' h ' + m + ' m'
      if (m >= 1) return m + ' m'
      return sec + ' s'
    }
    if (style === 'clock') {
      return pad2(h) + ':' + pad2(m) + ':' + pad2(sec)
    }
    if (d >= 1) return d + 'd ' + pad2(h % 24) + ':' + pad2(m)
    if (h >= 1) return h + ':' + pad2(m)
    return m + ':' + pad2(sec)
  }

  function pad2 (n) { return n < 10 ? '0' + n : '' + n }

  // ───────────────────────────────────────────────────────────────────────────
  // DETERMINISTIC RANDOMNESS
  // ───────────────────────────────────────────────────────────────────────────

  // xorshift128 over four uint32 words with additive tempering. 32-bit words rather than the
  // 64-bit pair of the canonical xorshift128+, because BigInt in a 20 Hz tick costs more than the
  // extra period is worth, and because uint32 arithmetic is bit-exact on every engine — which is
  // what D35 (byte-identical offline determinism) actually requires.
  function rng (seed) {
    var s = new Uint32Array(4)
    setSeed(s, seed)

    function nextU32 () {
      var t = s[3]
      var w = s[0]
      s[3] = s[2]; s[2] = s[1]; s[1] = w
      t ^= t << 11
      t ^= t >>> 8
      s[0] = (t ^ w ^ (w >>> 19)) >>> 0
      return (s[0] + s[1]) >>> 0
    }

    function next () { return nextU32() / 4294967296 }

    function int (n) {
      n = Math.floor(n)
      if (!(n > 0)) return 0
      var v = Math.floor(next() * n)
      return v >= n ? n - 1 : v
    }

    function pick (arr) {
      if (!arr || !arr.length) return undefined
      return arr[int(arr.length)]
    }

    // Box–Muller, second variate discarded. Caching it would put a bit of hidden state outside
    // `s`, and a save that round-trips `s` would then diverge from the run that wrote it.
    function gauss () {
      var u = 1 - next()          // (0, 1]: log(0) is not a number we can spend
      var v = next()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    }

    return {
      s: s,                                   // the live state; state.js serialises these 4 words
      next: next,
      gauss: gauss,
      pick: pick,
      int: int,
      save: function () { return [s[0], s[1], s[2], s[3]] },
      load: function (a) { s[0] = a[0] >>> 0; s[1] = a[1] >>> 0; s[2] = a[2] >>> 0; s[3] = a[3] >>> 0 }
    }
  }

  // An all-zero state is absorbing, so a zero seed is replaced by the golden-ratio constant the
  // save shape defaults to.
  function setSeed (s, seed) {
    var x = (seed >>> 0) || 0x9E3779B9
    for (var i = 0; i < 4; i++) {
      x ^= x << 13; x >>>= 0
      x ^= x >>> 17
      x ^= x << 5; x >>>= 0
      s[i] = x >>> 0
    }
  }

  // FNV-1a over the string form of every key, with a separator so hash32('a','bc') and
  // hash32('ab','c') are different streams.
  function hash32 () {
    var h = 0x811c9dc5
    for (var i = 0; i < arguments.length; i++) {
      var str = '' + arguments[i]
      h = Math.imul(h ^ 0x1f, 0x01000193)
      for (var j = 0; j < str.length; j++) h = Math.imul(h ^ str.charCodeAt(j), 0x01000193)
    }
    return h >>> 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // NUMERIC GUARDS (08 §2.3)
  // ───────────────────────────────────────────────────────────────────────────

  // Ship builds clamp silently and count; dev builds are expected to read this counter (08 §2.4).
  var faults = { count: 0, last: '' }

  function balanceAssert (what) {
    faults.count += 1
    faults.last = what
  }

  function clamp (v, lo, hi) {
    if (v !== v) return lo              // a NaN clamped to a range is the low end of it, not NaN
    return v < lo ? lo : (v > hi ? hi : v)
  }

  // The only legal write to a stock, anywhere in the build (08 §2.3 P3).
  function setStock (o, k, v, max) {
    if (max === undefined) max = TUNE.NUM.CEIL
    if (!isFinite(v) || v !== v) {
      balanceAssert('nonfinite:' + k)
      v = o[k]
      if (typeof v !== 'number' || !isFinite(v)) v = 0
    }
    o[k] = v < 0 ? 0 : (v > max ? max : v)
    return o[k]
  }

  function smoothstep (a, b, x) {
    if (b === a) return x < a ? 0 : 1
    var t = clamp((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — returns [] when healthy. Called by harness.js and by the dev boot path.
  // ───────────────────────────────────────────────────────────────────────────

  function __selftest () {
    var f = []
    function eq (got, want, label) {
      if (got !== want) f.push(label + ': got "' + got + '" want "' + want + '"')
    }
    function ok (cond, label) { if (!cond) f.push(label) }

    // fmt across ~30 representative magnitudes, every suffix step, both signs, and the edges.
    var cases = [
      [0, '0.00'], [0.004, '0.00'], [0.5, '0.50'], [1, '1.00'], [9.994, '9.99'],
      [9.999, '10.0'], [10, '10.0'], [37, '37.0'], [99.94, '99.9'], [100, '100'],
      [144, '144'], [999, '999'], [999.4, '999'], [999.6, '1.00 k'], [1000, '1.00 k'],
      [1234, '1.23 k'], [12345, '12.3 k'], [123456, '123 k'], [999999, '1.00 M'],
      [1e6, '1.00 M'], [2.7e3, '2.70 k'], [5.33e11, '533 G'], [1.1e7, '11.0 M'],
      [4.0e12, '4.00 T'], [1e15, '1.00 P'], [1e18, '1.00 E'], [1e21, '1.00 Z'],
      [1e24, '1.00 Y'], [1e27, '1.00 R'], [1e30, '1.00 Q'], [1e33, '1.00 aa'],
      [6.31e33, '6.31 aa'], [9.0e34, '90.0 aa'], [1e36, '1.00 ab'], [1e39, '1.00 ac'],
      [5.4e40, '54.0 ac'], [1e42, '1.00 ad'], [1e45, '1.00 ae'], [1e48, '1.00 af'],
      [-1500, MINUS + '1.50 k'], [-0.5, MINUS + '0.50'], [-1e42, MINUS + '1.00 ad'],
      [Infinity, INF], [-Infinity, MINUS + INF], [NaN, DASH]
    ]
    for (var i = 0; i < cases.length; i++) eq(fmt(cases[i][0]), cases[i][1], 'fmt(' + cases[i][0] + ')')

    // D41: never longer than 8 characters, never "undefined", across the whole reachable range.
    for (var p = -3; p <= 48; p++) {
      for (var mm = 1; mm < 10; mm++) {
        var x = mm * Math.pow(10, p)
        var r = fmt(x)
        ok(typeof r === 'string' && r.indexOf('undefined') < 0, 'fmt(' + x + ') is undefined')
        ok(r.length <= TUNE.NUM.MAX_LEN, 'fmt(' + x + ') = "' + r + '" is ' + r.length + ' chars')
        ok(fmt(-x).length <= TUNE.NUM.MAX_LEN, 'fmt(-' + x + ') too long')
      }
    }

    eq(fmtMass(999), '999 g', 'fmtMass(999)')
    eq(fmtMass(1000), '1.00 kg', 'fmtMass(1000)')
    eq(fmtMass(1e6), '1.00 t', 'fmtMass(1e6)')
    eq(fmtMass(5.33e11), '533 kt', 'fmtMass(5.33e11)')
    eq(fmtMass(NaN), DASH, 'fmtMass(NaN)')

    eq(fmtTime(231), '3:51', 'fmtTime(231)')
    eq(fmtTime(8040), '2:14', 'fmtTime(8040)')
    eq(fmtTime(100000), '1d 03:46', 'fmtTime(100000)')
    eq(fmtTime(24060, 'away'), '6 h 41 m', 'fmtTime away')
    eq(fmtTime(24060, 'clock'), '06:41:00', 'fmtTime clock')
    eq(fmtTime(NaN), DASH, 'fmtTime(NaN)')

    // rng: determinism, round-trip, and range.
    var a = rng(7), b = rng(7), i2, va, vb
    var seq = []
    for (i2 = 0; i2 < 200; i2++) {
      va = a.next(); vb = b.next()
      if (va !== vb) { f.push('rng diverged at draw ' + i2); break }
      ok(va >= 0 && va < 1, 'rng.next out of range at ' + i2)
      seq.push(va)
    }
    ok(rng(7).next() !== rng(8).next(), 'rng: distinct seeds gave the same first draw')

    var c = rng(12345)
    for (i2 = 0; i2 < 50; i2++) c.next()
    var snapshot = c.save()
    var tail = []
    for (i2 = 0; i2 < 50; i2++) tail.push(c.next())
    c.load(snapshot)
    for (i2 = 0; i2 < 50; i2++) {
      if (c.next() !== tail[i2]) { f.push('rng save/load diverged at ' + i2); break }
    }

    var d = rng(99), sum = 0, sumsq = 0, N = 4000
    for (i2 = 0; i2 < N; i2++) { var g = d.gauss(); ok(g === g, 'gauss produced NaN'); sum += g; sumsq += g * g }
    ok(Math.abs(sum / N) < 0.12, 'gauss mean ' + (sum / N) + ' is not near 0')
    ok(Math.abs(sumsq / N - 1) < 0.15, 'gauss variance ' + (sumsq / N) + ' is not near 1')

    var e2 = rng(3), seen = {}
    for (i2 = 0; i2 < 500; i2++) {
      var k2 = e2.int(7)
      ok(k2 >= 0 && k2 < 7 && k2 === Math.floor(k2), 'rng.int out of range: ' + k2)
      seen[k2] = 1
    }
    ok(Object.keys(seen).length === 7, 'rng.int did not cover its range')
    ok(e2.int(0) === 0, 'rng.int(0) must be 0')
    ok(e2.pick([]) === undefined, 'rng.pick on an empty array')
    ok(e2.pick(['a']) === 'a', 'rng.pick on a single element')
    ok(hash32('region', 4) === hash32('region', 4), 'hash32 is not stable')
    ok(hash32('a', 'bc') !== hash32('ab', 'c'), 'hash32 key separator missing')

    // setStock guards.
    var o = { a: 5 }
    var before = faults.count
    setStock(o, 'a', NaN)
    ok(o.a === 5, 'setStock(NaN) did not hold the previous value')
    setStock(o, 'a', Infinity)
    ok(o.a === 5, 'setStock(Infinity) did not hold the previous value')
    ok(faults.count === before + 2, 'setStock did not count both non-finite writes')
    setStock(o, 'a', -3)
    ok(o.a === 0, 'setStock(negative) did not clamp to 0')
    setStock(o, 'a', 1e50)
    ok(o.a === TUNE.NUM.CEIL, 'setStock did not clamp to the ceiling')
    setStock(o, 'a', 12, 10)
    ok(o.a === 10, 'setStock did not honour an explicit max')
    var o2 = {}
    setStock(o2, 'b', NaN)
    ok(o2.b === 0, 'setStock on a fresh key did not fall back to 0')

    ok(clamp(NaN, 2, 9) === 2, 'clamp(NaN) must return the low bound')
    ok(clamp(11, 2, 9) === 9 && clamp(-1, 2, 9) === 2 && clamp(5, 2, 9) === 5, 'clamp')
    ok(smoothstep(0, 1, -1) === 0 && smoothstep(0, 1, 2) === 1, 'smoothstep does not clamp')
    ok(Math.abs(smoothstep(0, 1, 0.5) - 0.5) < 1e-12, 'smoothstep midpoint')
    ok(smoothstep(1, 1, 2) === 1 && smoothstep(1, 1, 0) === 0, 'smoothstep on a zero-width band')

    ok(Object.isFrozen(TUNE) && Object.isFrozen(TUNE.A1) && Object.isFrozen(TUNE.A1.PATCH[0]),
      'TUNE is not deep-frozen')
    ok(SUF.length === 17, 'SUF must reach 1e48 for two steps of headroom above the 1e42 ceiling')

    return f
  }

  HY.core = {
    TUNE: TUNE,
    SUF: SUF,
    fmt: fmt,
    fmtMass: fmtMass,
    fmtTime: fmtTime,
    rng: rng,
    hash32: hash32,
    clamp: clamp,
    setStock: setStock,
    smoothstep: smoothstep,
    faults: faults,          // §2.4's silent-clamp counter; rides along in the save
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
