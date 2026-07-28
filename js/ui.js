;(function (HY) {
  'use strict'

  // ═══════════════════════════════════════════════════════════════════════════
  // M16 · ui.js — the shell and every component.
  //
  // This module owns the DOM and nothing else. It reads `HY.state.state` freely and it changes the
  // world only by calling another module's exported command (BIBLE §6). Two exceptions are
  // documented at their call sites: `set` (settings) and `a1.consumptionOrder` (the player's
  // eating order) have no owning setter anywhere in the simulation and §3 gives them no other home.
  //
  // Everything is constructed programmatically because shell.html contains one empty div. Nothing
  // here writes innerHTML, at any time, for any reason (06 §9.4 lint 11).
  // ═══════════════════════════════════════════════════════════════════════════

  // Siblings are read lazily, inside functions, so load order cannot matter for anything but core.
  function C () { return HY.core }
  function T () { return HY.core.TUNE }
  function STATE () { return HY.state }
  function S () { return HY.state.state }
  function A1 () { return HY.act1 }
  function E1 () { return HY.economy1 }
  function PJ () { return HY.projects }
  function LOG () { return HY.log }
  function CANVAS () { return HY.canvas }
  function FEEL () { return HY.feel }

  // ───────────────────────────────────────────────────────────────────────────
  // THE UI TUNE TABLE
  // Every number this module uses that is not already in core.TUNE. Durations that also appear in
  // ui.css appear there as the renderer's copy and here as the scheduler's; they are the same
  // figure on purpose, and 06 §6.2 is the source of both.
  // ───────────────────────────────────────────────────────────────────────────

  var U = {
    // shell (06 §4.3)
    PLATE_FRAC: [0.38, 0.22, 0.18],   // fraction of shell height at stage 0 / 1 / 2
    PLATE_MIN_PX: 40,
    CONSOLE_ROWS: 5,
    LEDGER_MAX_ROWS: 4,

    // motion (06 §6.2)
    D_PRESS: 70, D_STATE: 120, D_FADE: 180, D_RELEASE: 220,
    D_MOVE: 240, D_REVEAL: 320, D_ACT: 2600,
    ACT_HOLD_MS: 2400, ACT_LINE_GAP_MS: 700,

    // interaction (06 §5.5, §5.8, §5.11, §6.3)
    LONGPRESS_MS: 420, LONGPRESS_SLOP_PX: 10,
    DESTRUCT_MS: 400,
    REPEAT_DELAY_MS: 500, REPEAT_MS_1: 167, REPEAT_MS_2: 83, REPEAT_ACCEL_MS: 1500,
    REPEAT_HAPTIC_EVERY: 3,
    COST_SETTLE_MS: 220,
    SWIPE_DISMISS_PX: 96,
    TOAST_MS: 2600,
    DOT_SEEN_MS: 1200, DOT_SEEN_FRAC: 0.5,
    FLASH_GAIN_MS: 150, FLASH_LOSS_MS: 90,

    // haptics (06 §6.8) — the whole policy when feel.js is absent from the build
    HAP_PRESS: 8, HAP_REPEAT: 4, HAP_HOLD: 18, HAP_DESTRUCT: 22, HAP_REVEAL: 8, HAP_ERROR: 4,
    HAP_ACT: [12, 12, 30],

    // display (06 §3.3, §8.4)
    DISPLAY_MS: 100,
    RATE_TAU_S: 1.6,
    RATE_ZERO: 1e-6,
    ARIA_STRIP_MS: 3000, ARIA_CANVAS_MS: 5000, ARIA_STATUS_MS: 5000,
    SCROLL_QUIET_MS: 120,
    DPR_MAX: 2,

    // meters (06 §5.6)
    PIPS: 5,
    ASCII_N: 20, ASCII_FULL: '▓', ASCII_HEAD: '▒', ASCII_EMPTY: '░',
    SPARK: '▁▂▃▄▅▆▇█', SPARK_N: 8,

    // Act I panels
    BURST_5_AT: 5, BURST_MAX_AT: 20, BURST_MAX_STEPS: 64,
    MARKET_BUY_G: [1000, 10000],      // 01 §5A.5's two fixed sizes
    MARKET_FRAC: 0.25,
    SUGAR_WARN_FRAC: 0.85,            // 06 §5.1: the cap hairline turns amber above this
    COVER_WARN: 0.75,                 // 01 §6.8: the coverage bar reddens past this
    SIGNAL_METER_AT: 0.5,             // fraction of the DECIDE gate before the bar is worth drawing
    SLIDER_STEPS: 100,
    SOONER: -1, LATER: 1,

    // Act II panels
    STANDS_SHOWN: 10,         // rows of the ranked STANDS list; the header carries the true count
    FLUSH_BET_MAX: 0.25,      // fraction of held biomass the stake slider spans
    FLUSH_BET_DEFAULT: 0.40,  // of that span, so the slider opens on 10% of the book

    // Act III panels
    BANDS_SHOWN: 13,          // 03 §6.1 has thirteen and every one of them is a decision
    COMMIT_DEFAULT: 60,       // of SLIDER_STEPS — 03 §14.2's threshold sits near here on purpose
    ALLOC_STEPS: 20,          // the triangle is coarse: three sliders of twenty, not of a hundred
    ENGAGE_WARN: 0.9,         // predicted survivors below this fraction and the row says so
    STELLAR_WARN_S: 40        // 03 §11.3's warning window, so the row can count it down
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STRINGS
  // One object, named slots, no fragment concatenated with a number in a way that assumes English
  // word order (06 §8.5). Act I text carries no capital letter (BIBLE D68) — the capitals the
  // design asks for are applied by `text-transform`, never baked into a string.
  // ───────────────────────────────────────────────────────────────────────────

  var STR = {
    extend: 'extend',
    biomass: 'biomass',
    sugar: 'sugar',
    minerals: 'minerals',
    netSugar: 'net sugar',
    rot: 'rot',
    settings: 'settings',

    p_floor: 'the floor',
    p_tips: 'hyphal tips',
    p_market: 'the litter market',
    p_seasons: 'the year',
    p_understory: 'the understory',
    p_adaptations: 'adaptations',
    p_patches: 'patches',
    p_signal: 'signal',

    growTip: 'grow tip',
    nextTip: 'next tip',
    litterEaten: 'litter eaten',
    utilisation: 'utilisation',
    ofWhatFalls: 'of what falls here',
    conduction: 'conduction',
    onFloor: 'on the floor',
    forSale: 'for sale',
    roomFor: 'of {v} it holds',
    fair: 'fair',
    sell: 'sell',
    buy: 'buy',
    all: 'all',
    max: 'max',
    sooner: 'eat sooner',
    later: 'eat later',
    eaten: 'eaten {n}',

    moisture: 'moisture',
    warmth: 'warmth',
    year: 'year {n}',

    volume: 'volume',
    term: 'term',
    collateral: 'collateral',
    exclusive: 'exclusive',
    youPay: 'you pay',
    youGet: 'you get',
    overTerm: 'over term',
    coverage: 'coverage',
    sign: 'sign',
    renegotiate: 'renegotiate',
    exit: 'exit',
    accept: 'accept',
    decline: 'decline',
    deficit: 'deficit',
    standing: 'standing',
    delivered: 'delivered',
    shortfall: 'shortfall',
    suspended: 'suspended',
    atMost: '{v} at most, {n} seasons',

    claim: 'claim',
    claiming: 'claiming',
    places: '{n} of {k}',
    needsStanding: 'standing {n}',

    short: '{n} short',
    toEmpty: 'to empty',
    owed: 'g/s owed',
    nothing: '—',
    seasons: '{n} seasons',

    theme: 'theme', haptics: 'haptics', motion: 'motion', slow: 'slow',
    verbose: 'spoken status', tier: 'detail', textSize: 'text size',
    save: 'save', reset: 'reset',
    auto: 'auto', dark: 'dark', light: 'light', on: 'on', off: 'off',
    high: 'high', med: 'med', low: 'low',
    textSizeNote: 'text follows the size the phone is set to.',
    copy: 'copy', load: 'load', done: 'done',
    resetNote: 'this ends the run. everything but the sclerotia goes.',
    toastCopied: 'save copied',
    toastImportBad: 'import failed — checksum',
    toastReset: 'settings reset',

    // ── Act II ────────────────────────────────────────────────────────────────
    p_forest: 'the forest',
    p_stands: 'stands',
    p_mind: 'the mind',
    p_diff: 'differentiation',
    p_flush: 'the flush',
    p_weather: 'weather',
    p_pact: 'the pact book',
    p_offers: 'offers',
    p_log: 'the log',

    consumed: 'consumed',
    interface_: 'live interface',
    connectivity: 'connectivity',
    retention: 'retention',
    stands: '{n} of 61',
    advance: 'advance',
    denser: 'denser',
    survey: 'survey',
    seed: 'seed',
    kill: 'kill stand',
    colonising: 'colonising',
    density: 'density',
    litter: 'litter',
    humus: 'humus',
    unknown: 'unsurveyed',
    fog: 'nothing there yet',
    dead: 'dead',

    capacity: 'capacity',
    saturated: 'saturated',
    saturation: 'saturation',
    gain: 'gain',
    slots: 'slots',
    fillsIn: 'full in {v}',
    ripeness: 'ripeness',
    insight: 'insight',
    vesicles: 'vesicles',
    unspent: '{n} unspent',
    allocate: 'spend',
    pulse: 'pulse',
    ready: 'ready',
    cooling: '{v}',

    wind: 'wind',
    graze: 'grazing',
    mast: 'mast year',
    maturity: 'maturity',
    release: 'release',
    hold: 'hold',
    resume: 'resume',
    riskNow: 'risk',
    bestIn: 'best in {v}',
    slotsUsed: '{n} of {k}',
    spores: 'spores',
    noPrimordia: 'nothing is fruiting. knot one, and the weather decides the rest.',
    fruit: 'fruit',
    slotsFull: 'every slot is knotted',

    channels: 'channels',
    accord: 'accord',
    bookCost: 'book cost',
    strain: 'strain',
    bond: 'bond',
    comply: 'comply',
    sever: 'sever',
    renew: 'renew',
    stake: 'stake',
    noPacts: 'nobody has offered you anything yet.',
    noOffers: 'no offers on the table.',
    termLeft: '{v} left',
    channelsOf: '{n} of {k}',
    offerTerm: 'term',
    rootType: 'root type',
    forecast: 'forecast',
    forecastNone: 'nothing is knotted, so there is nothing to forecast.',
    keyNow: 'now',
    keyPast: 'measured',
    keySoon: 'forecast',
    keyDry: 'too dry',
    keyWet: 'too wet',
    keyGraze: 'grazing',
    mapKey: 'held stands are filled; the frontier is outlined; a dotted edge is a barrier.',
    collapseMap: 'collapse the map',
    expandMap: 'expand the map',

    // ── Act III ───────────────────────────────────────────────────────────────
    p_canopy: 'the canopy',
    p_void: 'the void',
    p_bands: 'bands',
    p_genome: 'the genome',
    p_loci: 'loci',
    p_fleet: 'the fleet',
    p_mortality: 'what kills you',
    p_hazards: 'the six hazards',
    p_lineages: 'lineages',
    p_engage: 'engagements',
    p_successor: 'the successor',
    p_synchrony: 'synchrony',
    p_endings: 'endings',

    t_void: 'void', t_genome: 'genome', t_fleet: 'fleet', t_lineages: 'lineages',

    carbon: 'carbon',
    craft: 'craft',
    alleles: 'alleles',
    biome: 'biome',
    settle: 'settle',
    reach: 'reach',
    escape: 'escape',
    reached: 'reached',
    unreached: 'not reached',
    needsFirst: 'needs another adaptation',
    tierShort: '{n} biomes first',
    canopyNote: 'spores land where you put them. every one you settle is carbon the void will ' +
      'need, and the canopy does not refill.',
    escapeNote: 'nothing here comes with you but the craft, the carbon and what you have learned.',

    band: 'band {n}',
    explored: 'explored',
    occupancy: 'occupancy',
    surplus: 'surplus',
    richness: 'richness',
    resource: 'resource',
    harvest: 'harvest',
    subsist: 'subsistence',
    nStar: 'best count',
    yours: 'yours',
    wild: 'wild',
    stellar: 'stellar event in {v}',
    noBands: 'the void is dark. nothing has been looked at yet.',
    voidKey: 'a solid arc is yours; a dashed arc is wild; the ring is the part you have looked at.',

    allocation: 'allocation',
    replicate: 'replicate',
    disperse: 'disperse',
    bank: 'bank',
    allocNote: 'every gram of surplus goes to one of three places, and the split is the act.',
    craftMass: 'craft mass',
    fidelity: 'fidelity',
    genomeLen: 'length',
    lociFree: '{n} unplaced',
    lociCost: 'next locus',
    raiseCap: 'raise cap',
    regenome: 'regenome',
    rewriting: 'rewriting · {v}',
    regenomeNote: 'a regenome empties every locus and gives you the window to place them again.',
    genomeNote: 'longer genomes cost mass, and mass is subsistence. eight axes, and no build ' +
      'takes more than four of them.',
    deaths: 'deaths, last {v}',
    noDeaths: 'nothing has died yet.',

    strainName: 'strain',
    sequenced: 'sequenced',
    unsequenced: 'unsequenced',
    sequence: 'sequence',
    engage: 'engage',
    predictLine: 'you win with {v} left',
    predictLose: 'you lose · {v} of theirs left',
    predictWide: 'unsequenced: anywhere from {lo} to {hi}',
    resolveIn: 'resolves in {v}',
    commit: 'commit',
    reinforce: 'reinforce',
    withdraw: 'withdraw',
    purge: 'purge',
    absorb: 'absorb',
    quarantine: 'quarantine',
    drifted: 'drift {v}',
    theirMass: 'theirs',
    distance: 'distance {n}',
    noStrains: 'nothing has diverged from you yet.',
    successorAge: 'age {v}',
    inEngagement: 'engaged',
    engageFull: 'you can only fight {n} at a time',

    upsilon: 'synchrony',
    phase: 'phase',
    period: 'period',
    entrainNote: 'a pulse drags the band it lands on toward the phase it arrived carrying.',
    endTake: 'hold to take',
    endTaken: 'taken',
    endShort: '{n} to go',
    wheelKey: 'each dot is a band; the line is where the fleet as a whole is pointing.',
    newGrowth: 'new growth',
    sclerotium: 'sclerotia',
    dismantling: 'dismantling'
  }

  var TYPE_NAME = {
    leaf: 'leaf litter', needle: 'needle mat', twig: 'fine deadfall',
    bark: 'bark slough', log: 'fallen log', stump: 'heartwood stump', carrion: 'carrion'
  }
  var SPECIES_NAME = {
    birch: 'birch', aspen: 'aspen', fir: 'douglas fir', hemlock: 'hemlock',
    oak: 'oak', elm: 'dying elm', beech: 'hollow beech'
  }
  var SEASON_LABEL = ['spring', 'summer', 'autumn', 'winter']
  // "eaten 1" is a quantity to anyone reading it for the first time; "eaten 1st" is a queue
  // position, which is what `consumptionOrder` actually is. Seven pools, seven ordinals.
  var ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th']

  // Currency glyphs, from BIBLE §2.1. One name, one symbol, one unit.
  var GLYPH = {
    biomass: 'g', sugar: 'sug', minerals: '⛬', signal: 'Σ', insight: 'Ψ',
    spores: '◦', accord: '⟡', diff: 'D',
    carbon: 'Χ', alleles: 'α', canon: '†', upsilon: 'ϒ'
  }
  // 03 §9.2's eight axes, in BIBLE §3's order forever, with the word each one actually means. The
  // three-letter key is what every other module calls the locus; nobody should have to learn it.
  var AXIS_NAME = {
    BAL: 'ballistospory', GER: 'germination', MYC: 'myceliation', SPO: 'sporulation',
    MEL: 'melanisation', DOR: 'dormancy', FID: 'fidelity', ANT: 'antagonism'
  }
  var AXIS_NOTE = {
    BAL: 'reach further, arrive sooner, land worse',
    GER: 'more of what lands takes hold',
    MYC: 'harvest more, and burn a little of the armour for it',
    SPO: 'replicate faster',
    MEL: 'survive radiation and predation',
    DOR: 'cheap to keep, slow to do anything',
    FID: 'copies stay copies',
    ANT: 'your craft fight back, and drift faster for it'
  }

  // 06 §4.4. Inline path data, 24 × 24, stroke=currentColor. No emoji, no icon font, no asset.
  // Five slots, and each one is a different organ in each act: the slot is the position, never the
  // subject. `d3`/`label3` are the Act III face of the same slot, from 06 §4.4's second table.
  var TAB_SLOTS = [
    { key: 'forest',
      label: 'forest', label3: 'void',
      d: ['M12 3.5 L18.5 13.5 H5.5 Z', 'M12 13.5 V20.5'],
      d3: ['M12 12 m-8.5 0 a8.5 8.5 0 1 0 17 0 a8.5 8.5 0 1 0 -17 0',
        'M12 12 m-3.5 0 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0'] },
    { key: 'mind',
      label: 'mind', label3: 'genome',
      d: ['M12 4.2 a2 2 0 1 0 .01 0 Z', 'M5.4 15.4 a2 2 0 1 0 .01 0 Z',
        'M18.6 15.4 a2 2 0 1 0 .01 0 Z', 'M11.2 7.6 L6.6 13.6', 'M12.8 7.6 L17.4 13.6',
        'M7.4 16.6 H16.6'],
      d3: ['M8 4 C14 8, 14 16, 8 20', 'M16 4 C10 8, 10 16, 16 20',
        'M9.4 8 H14.6', 'M9.4 16 H14.6'] },
    { key: 'flush',
      label: 'flush', label3: 'fleet',
      d: ['M4.5 13.2 a7.5 5.4 0 0 1 15 0 Z', 'M10.2 13.2 V19 a1.8 1.8 0 0 0 3.6 0 V13.2'],
      d3: ['M12 3.5 L15 11 L12 9.2 L9 11 Z', 'M12 12.5 V20.5'] },
    { key: 'pact',
      label: 'pact', label3: 'lineages',
      d: ['M10 7.5 a4.5 4.5 0 0 0 0 9', 'M14 7.5 a4.5 4.5 0 0 1 0 9', 'M10 12 H14'],
      d3: ['M12 4 V9', 'M12 9 L7 14 V20', 'M12 9 L17 14 V20'] },
    { key: 'log',
      label: 'log', label3: 'log',
      d: ['M4.5 7.5 H19.5', 'M4.5 12 H19.5', 'M4.5 16.5 H13'],
      d3: ['M4.5 7.5 H19.5', 'M4.5 12 H19.5', 'M4.5 16.5 H13'] }
  ]
  // The plate's collapse handle: a chevron, rotated 180° by the stylesheet when it is closed.
  var CHEVRON_D = ['M6 14.5 L12 8.5 L18 14.5']
  // The pulse glyph: a step change travelling, not a lightning bolt.
  var PULSE_D = ['M3 16 H8 L10.5 6 L14 18 L16.5 12 H21']
  var GEAR_D = [
    'M12 9.4 a2.6 2.6 0 1 0 .01 0 Z',
    'M12 3.6 v2', 'M12 18.4 v2', 'M3.6 12 h2', 'M18.4 12 h2',
    'M6.1 6.1 l1.4 1.4', 'M16.5 16.5 l1.4 1.4', 'M17.9 6.1 l-1.4 1.4', 'M7.5 16.5 l-1.4 1.4'
  ]
  var SVG_NS = 'http://www.w3.org/2000/svg'

  // ───────────────────────────────────────────────────────────────────────────
  // DOM PRIMITIVES
  // ───────────────────────────────────────────────────────────────────────────

  function doc () { return typeof document === 'undefined' ? null : document }
  function win () { return typeof window === 'undefined' ? null : window }

  function el (tag, cls, text) {
    var n = doc().createElement(tag)
    if (cls) n.className = cls
    if (text !== undefined && text !== null) n.textContent = String(text)
    return n
  }

  function btn (cls, text) {
    var b = el('button', cls, text)
    b.type = 'button'
    return b
  }

  function glyphSvg (paths, size) {
    var s = doc().createElementNS(SVG_NS, 'svg')
    var i, p
    s.setAttribute('viewBox', '0 0 24 24')
    s.setAttribute('width', String(size || 24))
    s.setAttribute('height', String(size || 24))
    s.setAttribute('fill', 'none')
    s.setAttribute('stroke', 'currentColor')
    s.setAttribute('stroke-width', '1.6')
    s.setAttribute('stroke-linecap', 'round')
    s.setAttribute('stroke-linejoin', 'round')
    s.setAttribute('aria-hidden', 'true')
    s.setAttribute('focusable', 'false')
    for (i = 0; i < paths.length; i++) {
      p = doc().createElementNS(SVG_NS, 'path')
      p.setAttribute('d', paths[i])
      s.appendChild(p)
    }
    return s
  }

  function on (node, ev, fn, passive) {
    node.addEventListener(ev, fn, passive === false ? false : { passive: true })
  }

  function setText (node, s) {
    s = String(s)
    if (node.__t === s) return
    node.__t = s
    node.textContent = s
  }

  function setAttr (node, k, v) { if (node.getAttribute(k) !== v) node.setAttribute(k, v) }
  function setData (node, k, v) { if (node.dataset[k] !== v) node.dataset[k] = v }
  function show (node, yes) { if (node.hidden === !yes) return; node.hidden = !yes }
  function clear (node) { while (node.firstChild) node.removeChild(node.firstChild) }
  function fill (f) { return C().clamp(f, 0, 1) }
  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }

  function nowMs () {
    var w = win()
    return (w && w.performance && w.performance.now) ? w.performance.now() : Date.now()
  }

  function interp (tpl, tok) {
    return tpl.replace(/\{(\w+)\}/g, function (m, k) {
      return tok[k] === undefined ? m : String(tok[k])
    })
  }

  // A count is an integer and reads as one: `8`, never `8.00`. The three-significant-figure
  // formatter is for quantities, and a tip is not a quantity.
  function whole (n) { return String(Math.round(num(n))) }

  function repeat (ch, n) {
    var out = ''
    for (var i = 0; i < n; i++) out += ch
    return out
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MOTION, THEME, HAPTICS
  // ───────────────────────────────────────────────────────────────────────────

  function liveState () {
    try { return HY.state ? S() : null } catch (e) { return null }
  }

  function osReducedMotion () {
    var w = win()
    if (!w || !w.matchMedia) return false
    try { return w.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false }
  }

  function reducedMotion () {
    var s = liveState()
    if (s && s.set && s.set.reduceMotion !== null && s.set.reduceMotion !== undefined) {
      return !!s.set.reduceMotion
    }
    return osReducedMotion()
  }

  // Every haptic funnels through here. When feel.js is present it owns the duty-cycle governor,
  // the settings toggle and the vestibular guard; when it is not, this is the whole policy.
  function haptic (ms, event) {
    var f = FEEL()
    if (f && f.feel) { f.feel(event || 'ui.tap', null); return }
    var s = liveState()
    if (s && s.set && s.set.haptics === false) return
    if (reducedMotion()) return
    var n = typeof navigator === 'undefined' ? null : navigator
    if (n && n.vibrate) { try { n.vibrate(ms) } catch (e) { /* a refused buzz is not an error */ } }
  }

  function store (k, v) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(k, v)
    } catch (e) { /* private mode is a supported configuration */ }
  }

  function recall (k) {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null
    } catch (e) { return null }
  }

  function setTheme (t) {
    var d = doc()
    if (t !== 'auto' && t !== 'dark' && t !== 'light') t = 'auto'
    if (d) d.documentElement.dataset.theme = t
    var s = liveState()
    if (s) s.set.theme = t
    store('hyphae.theme', t)
    return t
  }

  function applyMotionAttr () {
    var d = doc()
    if (!d) return
    var s = liveState()
    var v = s && s.set ? s.set.reduceMotion : null
    if (v === true) d.documentElement.dataset.motion = 'reduce'
    else if (v === false) d.documentElement.dataset.motion = 'full'
    else delete d.documentElement.dataset.motion
  }

  // 06 §3.3 R1. Where `tnum` is unavailable digits jitter as they interpolate, which is the single
  // ugliest thing an idle game can do; the fallback is the mono stack.
  function hasTabular (probe) {
    try {
      var cx = doc().createElement('canvas').getContext('2d')
      if (!cx) return true
      var f = getComputedStyle(probe).getPropertyValue('--font-ui')
      cx.font = '500 17px ' + (f || 'sans-serif')
      return Math.abs(cx.measureText('111111').width - cx.measureText('000000').width) < 0.5
    } catch (e) { return true }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRESS, LONG-PRESS, HOLD, REPEAT · 06 §6.3
  // The press contract fires the action on `pointerdown`, which removes ~90 ms of perceived
  // latency. It is used only where the action is neither destructive nor irreversible; a purchase
  // fires on release (`onUp`), and a destruction needs the 400 ms hold below.
  // ───────────────────────────────────────────────────────────────────────────

  function bindPress (node, fn, opts) {
    opts = opts || {}
    var mark = opts.state || node
    var down = false
    on(node, 'pointerdown', function (e) {
      if (e.button) return
      down = true
      setData(mark, 'press', '1')
      if (!opts.quiet) haptic(U.HAP_PRESS, opts.feel || 'ui.press')
      if (!opts.onUp && fn) fn(e)
    })
    function up (e) {
      if (!down) return
      down = false
      setData(mark, 'press', '0')
      if (opts.onUp && fn) fn(e)
    }
    on(node, 'pointerup', up)
    on(node, 'pointercancel', up)
    on(node, 'pointerleave', up)
    // Keyboard parity: Space and Enter do exactly what the thumb does (06 §8.3).
    on(node, 'keydown', function (e) {
      if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat) return
      e.preventDefault()
      setData(mark, 'press', '1')
      if (fn) fn(e)
    }, false)
    on(node, 'keyup', function () { setData(mark, 'press', '0') })
    return node
  }

  function bindLongPress (node, fn, stateNode) {
    var mark = stateNode || node
    var t = null
    var sx = 0
    var sy = 0
    on(node, 'pointerdown', function (e) {
      if (e.button) return
      sx = e.clientX
      sy = e.clientY
      setData(mark, 'hold', '1')
      t = setTimeout(function () {
        setData(mark, 'hold', '0')
        haptic(U.HAP_HOLD, 'ui.longpress')
        fn()
      }, U.LONGPRESS_MS)
    })
    function cancel () {
      if (t) clearTimeout(t)
      t = null
      setData(mark, 'hold', '0')
    }
    on(node, 'pointermove', function (e) {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > U.LONGPRESS_SLOP_PX) cancel()
    })
    on(node, 'pointerup', cancel)
    on(node, 'pointercancel', cancel)
    on(node, 'pointerleave', cancel)
    return node
  }

  // The destructive commit: a 400 ms press-and-hold, never a double tap and never a typed word.
  function bindHold (node, fn) {
    var t = null
    function start (e) {
      if (e && e.button) return
      setData(node, 'holding', '1')
      t = setTimeout(function () {
        setData(node, 'holding', '0')
        haptic(U.HAP_DESTRUCT, 'ui.destruct')
        fn()
      }, U.DESTRUCT_MS)
    }
    function stop () {
      if (t) clearTimeout(t)
      t = null
      setData(node, 'holding', '0')
    }
    on(node, 'pointerdown', start)
    on(node, 'pointerup', stop)
    on(node, 'pointercancel', stop)
    on(node, 'pointerleave', stop)
    on(node, 'keydown', function (e) {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(null) }
    }, false)
    on(node, 'keyup', stop)
    return node
  }

  // 06 §5.11. Auto-repeat exists because the player presses `+1` five times at minute one and the
  // row must not punish them for it. It stops the instant the purchase stops being possible.
  function bindRepeat (node, fn, stillOk) {
    var timer = null
    var t0 = 0
    var count = 0
    function stop () {
      if (timer) clearTimeout(timer)
      timer = null
      count = 0
    }
    function step () {
      if (!stillOk()) { stop(); return }
      fn()
      count += 1
      if (count % U.REPEAT_HAPTIC_EVERY === 0) haptic(U.HAP_REPEAT, 'ui.repeat')
      var fast = (nowMs() - t0) > (U.REPEAT_DELAY_MS + U.REPEAT_ACCEL_MS)
      timer = setTimeout(step, fast ? U.REPEAT_MS_2 : U.REPEAT_MS_1)
    }
    bindPress(node, function () {
      if (!stillOk()) { refuse(node); return }
      fn()
      t0 = nowMs()
      timer = setTimeout(step, U.REPEAT_DELAY_MS)
    })
    on(node, 'pointerup', stop)
    on(node, 'pointercancel', stop)
    on(node, 'pointerleave', stop)
    on(node, 'keyup', stop)
    return node
  }

  // A locked control is tappable and it answers. UP's greyed buttons are inert; the information
  // the player wants is exactly "how much more", and we have it (06 §5.2).
  function refuse (node) {
    haptic(U.HAP_ERROR, 'ui.error')
    if (node && node.dataset && node.dataset.short) announce(node.dataset.short)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // NUMBER SLOTS · 06 §3.3
  // A value is two spans: a mantissa and a suffix one step dimmer. The slot's width is reserved in
  // `ch` from the maximum expected string, never measured, so the layout cannot reflow when a
  // number grows a digit (R3) — the single most important typographic rule in the document.
  // ───────────────────────────────────────────────────────────────────────────

  function slot (cls) {
    var n = el('span', cls + ' num')
    n.__m = el('span', 'mant')
    n.__u = el('span', 'unit')
    n.appendChild(n.__m)
    n.appendChild(n.__u)
    return n
  }

  function splitNum (str) {
    var i = str.lastIndexOf(' ')
    return i < 0 ? [str, ''] : [str.slice(0, i), str.slice(i + 1)]
  }

  function joinUnit (suffix, unit) {
    if (!unit) return suffix
    if (!suffix) return unit
    return suffix + ' ' + unit
  }

  // R4: a suffix crossing cross-fades the suffix span alone. The mantissa always snaps, and no
  // digit is ever animated.
  function setSlot (n, str, unit) {
    var parts = splitNum(str)
    var suf = joinUnit(parts[1], unit)
    if (n.__m.__t !== parts[0]) {
      n.__m.__t = parts[0]
      n.__m.textContent = parts[0]
    }
    if (n.__u.__t === suf) return
    var had = !!n.__u.__t
    n.__u.__t = suf
    n.__u.textContent = suf
    if (!had || reducedMotion()) return
    setData(n.__u, 'fade', 'in')
    if (n.__fadeT) clearTimeout(n.__fadeT)
    n.__fadeT = setTimeout(function () { delete n.__u.dataset.fade }, U.D_FADE)
  }

  function setMass (n, g) { setSlot(n, C().fmtMass(g)) }

  // A composite readout — `812 / 1.24 k`, `12.0 kg + 90.0` — is one mantissa with one unit. It
  // must not go through splitNum, which would promote the last word of the phrase to the dimmer
  // suffix slot and read as a different number.
  function setRaw (n, mant, unit) {
    if (n.__m.__t !== mant) {
      n.__m.__t = mant
      n.__m.textContent = mant
    }
    unit = unit || ''
    if (n.__u.__t === unit) return
    n.__u.__t = unit
    n.__u.textContent = unit
  }

  // R6: rates are always signed and always suffixed with `/s`. Zero renders as an em dash, because
  // a hard zero is information and a floating zero is noise.
  function setRate (n, v, unit) {
    var a = Math.abs(v)
    if (!(a > U.RATE_ZERO)) {
      setSlot(n, STR.nothing, unit || '/s')
      setData(n, 'sign', 'zero')
      return
    }
    setSlot(n, (v > 0 ? '+' : '−') + C().fmt(a), unit || '/s')
    setData(n, 'sign', v > 0 ? 'pos' : 'neg')
  }

  // R4/R5: a discrete loss snaps and flashes; a discrete gain snaps and brightens. Never a
  // countdown, never a slot machine.
  function flashSlot (n, kind) {
    if (!n || reducedMotion()) return
    setData(n, 'flash', kind)
    if (n.__flashT) clearTimeout(n.__flashT)
    n.__flashT = setTimeout(function () {
      delete n.dataset.flash
    }, kind === 'loss' ? U.FLASH_LOSS_MS : U.FLASH_GAIN_MS)
  }

  function ascii (frac) {
    var f = Math.round(fill(frac) * U.ASCII_N)
    if (f >= U.ASCII_N) return repeat(U.ASCII_FULL, U.ASCII_N)
    return repeat(U.ASCII_FULL, f) + U.ASCII_HEAD + repeat(U.ASCII_EMPTY, U.ASCII_N - f - 1)
  }

  function spark (series) {
    if (!series || !series.length) return ''
    var n = Math.min(U.SPARK_N, series.length)
    var start = series.length - n
    var lo = Infinity
    var hi = -Infinity
    var i, v
    for (i = start; i < series.length; i++) {
      v = series[i]
      if (!(v > 0)) continue
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    if (!isFinite(lo) || !isFinite(hi)) return ''
    var span2 = hi - lo
    var out = ''
    for (i = start; i < series.length; i++) {
      v = span2 > 0 ? (series[i] - lo) / span2 : 0.5
      out += U.SPARK.charAt(C().clamp(Math.round(v * (U.SPARK.length - 1)), 0, U.SPARK.length - 1))
    }
    return out
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COMPONENTS · 06 §5
  // ───────────────────────────────────────────────────────────────────────────

  // `valuetext` is the human string, never the raw ratio (06 §8.4).
  function meterAria (n, v, text) {
    setAttr(n, 'aria-valuenow', String(Math.round(fill(v) * 100)))
    if (text) setAttr(n, 'aria-valuetext', text)
  }

  // Three kinds of meter, and they are not interchangeable (06 §5.6).
  function meter (kind, value) {
    var n, f, i, pips
    if (kind === 'pips') {
      n = el('div', 'pips')
      pips = []
      for (i = 0; i < U.PIPS; i++) {
        pips.push(el('span', 'pip'))
        n.appendChild(pips[i])
      }
      n.set = function (v, tone, text) {
        var k = Math.round(fill(v) * U.PIPS)
        for (var j = 0; j < U.PIPS; j++) setData(pips[j], 'on', j < k ? '1' : '0')
        if (tone) setData(n, 'tone', tone)
        meterAria(n, v, text)
      }
    } else if (kind === 'ascii') {
      // Zero elements, zero layout, one string comparison — and perfectly legible to a screen
      // reader once it carries its own label.
      n = el('span', 'ascii')
      n.set = function (v, tone, text) {
        setText(n, ascii(v))
        meterAria(n, v, text)
      }
    } else {
      n = el('div', 'meter')
      f = el('div', 'meter-fill')
      n.appendChild(f)
      n.set = function (v, tone, text, tick) {
        f.style.setProperty('--v', fill(v).toFixed(4))
        if (tone !== undefined) {
          if (tone) setData(n, 'tone', tone)
          else delete n.dataset.tone
        }
        meterAria(n, v, text)
        if (tick === undefined || tick === null) return
        if (!n.__tick) {
          n.__tick = el('div', 'meter-tick')
          n.appendChild(n.__tick)
        }
        n.__tick.style.setProperty('--t', fill(tick).toFixed(4))
      }
    }
    n.setAttribute('role', 'progressbar')
    n.setAttribute('aria-valuemin', '0')
    n.setAttribute('aria-valuemax', '100')
    n.set(value === undefined ? 0 : value)
    return n
  }

  function panel (id, spec) {
    spec = spec || {}
    var n = el('section', 'panel')
    n.dataset.panel = id
    var head = el('header', 'panel-head')
    var title = el('h2', 'panel-title', spec.title || id)
    title.id = 'p-' + id
    var count = el('span', 'panel-count num')
    head.appendChild(title)
    head.appendChild(count)
    var body = el('div', 'panel-body')
    n.appendChild(head)
    n.appendChild(body)
    setAttr(n, 'aria-labelledby', title.id)
    var api = {
      id: id,
      el: n,
      head: head,
      body: body,
      setTitle: function (s) { setText(title, s) },
      setCount: function (s) { setText(count, s === null || s === undefined ? '' : s) },
      empty: function (text) {
        if (!api.__empty) {
          api.__empty = el('p', 'panel-empty')
          body.appendChild(api.__empty)
        }
        setText(api.__empty, text || '')
        show(api.__empty, true)
      },
      unempty: function () { if (api.__empty) show(api.__empty, false) }
    }
    if (spec.count !== undefined) api.setCount(spec.count)
    return api
  }

  // The card IS the button (06 §5.4). A separate BUY inside a card doubles the tap targets, halves
  // the hit area and adds a second thing to look at.
  function card (spec) {
    spec = spec || {}
    var n = btn('card')
    n.dataset.id = spec.id || ''
    if (spec.pinned) n.dataset.pinned = '1'
    var top = el('div', 'card-top')
    var title = el('span', 'card-title', spec.title || '')
    var cost = el('span', 'card-cost num', spec.cost || '')
    top.appendChild(title)
    top.appendChild(cost)
    n.appendChild(top)
    n.appendChild(el('p', 'card-desc', spec.desc || ''))
    var dot = null
    var api = {
      el: n,
      setCost: function (s) { setText(cost, s) },
      setState: function (s) {
        if (n.dataset.s === s) return
        n.dataset.s = s
        setAttr(n, 'aria-disabled', s === 'afford' ? 'false' : 'true')
      },
      setLabel: function (s) { setAttr(n, 'aria-label', s) },
      markNew: function () {
        if (dot) return
        dot = el('span', 'newdot')
        n.appendChild(dot)
        n.__dotAt = 0
      },
      seen: function () { if (dot) setData(dot, 'seen', '1') },
      isNew: function () { return !!dot && dot.dataset.seen !== '1' }
    }
    // A purchase is irreversible, so this one fires on release rather than on down.
    if (spec.onPick) bindPress(n, spec.onPick, { onUp: true })
    return api
  }

  // The workhorse of every list. A `.row` is a plain block; when it is interactive its summary
  // lines live inside a single `.row-main` button and the expanded region is that button's
  // sibling, so a row never nests one control inside another.
  function row (spec) {
    spec = spec || {}
    var interactive = !!(spec.onPick || spec.expand)
    var n = el('div', 'row')
    var main = interactive ? btn('row-main') : null
    if (main) n.appendChild(main)
    var host = main || n
    var expand = null
    var api = {
      el: n,
      main: main,
      line: function () {
        var l = el('div', 'row-line')
        host.appendChild(l)
        return l
      },
      expander: function () {
        if (expand) return expand
        expand = el('div', 'row-expand')
        expand.hidden = true
        n.appendChild(expand)
        return expand
      },
      setExpanded: function (yes) {
        api.expander()
        show(expand, yes)
        setData(n, 'open', yes ? '1' : '0')
        if (main) setAttr(main, 'aria-expanded', yes ? 'true' : 'false')
      },
      isExpanded: function () { return !!expand && !expand.hidden },
      label: function (s) { setAttr(main || n, 'aria-label', s) }
    }
    function toggle () {
      var next = !api.isExpanded()
      api.setExpanded(next)
      if (next && spec.onOpen) spec.onOpen()
    }
    if (spec.expand) {
      api.expander()
      bindPress(main, toggle, { state: n })
      // Long-press is the secondary action, everywhere and only (01 §12.1). Where a row's primary
      // action *is* the expansion the two agree, which is what makes the gesture learnable.
      bindLongPress(main, toggle, n)
    } else if (spec.onPick) {
      bindPress(main, spec.onPick, { state: n })
      if (spec.onHold) bindLongPress(main, spec.onHold, n)
    }
    return api
  }

  function span (parent, cls, text) {
    var s = el('span', cls, text)
    parent.appendChild(s)
    return s
  }

  function actionButton (label, fn, opts) {
    var b = btn('act-btn', label)
    bindPress(b, function (e) {
      if (e && e.stopPropagation) e.stopPropagation()
      fn(b)
    }, { onUp: !(opts && opts.instant) })
    return b
  }

  function seg (options, current, onPick) {
    var n = el('div', 'seg')
    n.setAttribute('role', 'group')
    var buttons = []
    options.forEach(function (o) {
      var b = btn('', o.label)
      b.dataset.value = String(o.value)
      setAttr(b, 'aria-pressed', String(o.value) === String(current) ? 'true' : 'false')
      bindPress(b, function () {
        n.set(o.value)
        onPick(o.value)
      })
      buttons.push(b)
      n.appendChild(b)
    })
    n.set = function (v) {
      buttons.forEach(function (b) {
        setAttr(b, 'aria-pressed', b.dataset.value === String(v) ? 'true' : 'false')
      })
    }
    return n
  }

  // Every slider carries a numeric readout and a step count; a slider with no number is a toy
  // (06 §5.10). `input[type=range]` brings arrows, Page, Home/End and the ARIA with it.
  function slider (spec) {
    var wrap = el('div', 'field')
    var top = el('div', 'field-top')
    top.appendChild(el('span', 'field-lab', spec.label))
    var val = slot('field-val')
    top.appendChild(val)
    var input = el('input', 'slider')
    // 06 §5.10: the filled portion is --positive, or --signal from Act II on. The token is the
    // act's, not the control's, so the caller names it.
    if (spec.tone) setData(input, 'tone', spec.tone)
    input.type = 'range'
    input.min = '0'
    input.max = String(spec.steps || U.SLIDER_STEPS)
    input.step = '1'
    input.value = String(spec.value || 0)
    setAttr(input, 'aria-label', spec.label)
    var note = el('p', 'field-note')
    wrap.appendChild(top)
    wrap.appendChild(input)
    wrap.appendChild(note)
    function paint () {
      var m = Number(input.max) || 1
      input.style.setProperty('--p', (Number(input.value) / m).toFixed(4))
    }
    on(input, 'input', function () {
      paint()
      if (spec.onInput) spec.onInput(Number(input.value))
    }, false)
    wrap.setValue = function (v) {
      input.value = String(v)
      paint()
    }
    wrap.setMax = function (m) {
      if (input.max === String(m)) return
      input.max = String(m)
      paint()
    }
    wrap.setReadout = function (str, unit, aria) {
      setSlot(val, str, unit)
      if (aria) setAttr(input, 'aria-valuetext', aria)
    }
    wrap.setNote = function (s) { setText(note, s || '') }
    wrap.value = function () { return Number(input.value) }
    paint()
    return wrap
  }

  function checkbox (label, note, onToggle) {
    var b = btn('check')
    b.appendChild(el('span', 'check-box'))
    b.appendChild(el('span', 'check-lab', label))
    var n = el('span', 'check-note', note || '')
    b.appendChild(n)
    setAttr(b, 'aria-pressed', 'false')
    bindPress(b, function (e) {
      if (e && e.stopPropagation) e.stopPropagation()
      var next = b.getAttribute('aria-pressed') !== 'true'
      setAttr(b, 'aria-pressed', next ? 'true' : 'false')
      onToggle(next)
    })
    // `isOn`, not `value`: HTMLButtonElement already owns a string `value` property and would
    // stringify a function assigned to it.
    b.isOn = function () { return b.getAttribute('aria-pressed') === 'true' }
    b.setNote = function (s) { setText(n, s) }
    return b
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SHEET AND TOAST
  // There are no centred dialogs: a centred dialog on a phone puts its buttons in Zone C.
  // ───────────────────────────────────────────────────────────────────────────

  var openSheet = null

  function focusables (root) {
    var list = root.querySelectorAll('button, input, select, textarea, [tabindex]')
    var out = []
    var i
    for (i = 0; i < list.length; i++) {
      if (list[i].disabled || list[i].tabIndex < 0) continue
      out.push(list[i])
    }
    return out
  }

  function sheet (spec) {
    spec = spec || {}
    var host = view ? view.shell : doc().body
    var scrim = el('div', 'scrim')
    var n = el('div', 'sheet')
    n.setAttribute('role', 'dialog')
    n.setAttribute('aria-modal', 'true')
    var title = el('h2', 'sheet-title', spec.title || '')
    title.tabIndex = -1
    title.id = 'sheet-title-' + (spec.id || 'x')
    setAttr(n, 'aria-labelledby', title.id)
    var body = el('div', 'sheet-body')
    var foot = el('div', 'sheet-foot')
    n.appendChild(el('div', 'sheet-grab'))
    n.appendChild(title)
    n.appendChild(body)
    n.appendChild(foot)

    var opener = null
    function doOpen () {
      if (openSheet && openSheet !== api) openSheet.close()
      opener = doc().activeElement
      host.appendChild(scrim)
      host.appendChild(n)
      void n.offsetHeight              // one forced frame so the transform has a start value
      setData(scrim, 'open', '1')
      setData(n, 'open', '1')
      if (view) view.main.setAttribute('inert', '')
      openSheet = api
      title.focus()
    }
    function doClose () {
      setData(scrim, 'open', '0')
      setData(n, 'open', '0')
      if (view) view.main.removeAttribute('inert')
      openSheet = null
      setTimeout(function () {
        if (scrim.parentNode) scrim.parentNode.removeChild(scrim)
        if (n.parentNode) n.parentNode.removeChild(n)
      }, U.D_MOVE)
      if (opener && opener.focus) opener.focus()
    }

    var api = { el: n, body: body, foot: foot, open: doOpen, close: doClose }

    ;(spec.buttons || []).forEach(function (b) {
      var button
      if (b.destructive) {
        button = btn('sheet-btn hold')
        button.appendChild(el('span', 'hold-fill'))
        button.appendChild(el('span', 'hold-lab', b.label))
        bindHold(button, function () { b.onPick(api) })
      } else {
        button = btn('sheet-btn', b.label)
        bindPress(button, function () { b.onPick(api) }, { onUp: true })
      }
      foot.appendChild(button)
    })

    // A destructive sheet does not dismiss on a scrim tap: only Cancel, a swipe, or Escape.
    if (!spec.destructive) bindPress(scrim, doClose, { quiet: true })
    on(n, 'keydown', function (e) {
      if (e.key === 'Escape') { doClose(); return }
      if (e.key !== 'Tab') return
      var f = focusables(n)
      if (!f.length) return
      var first = f[0]
      var last = f[f.length - 1]
      if (e.shiftKey && doc().activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && doc().activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }, false)

    var sy = 0
    var dragging = false
    on(n, 'pointerdown', function (e) {
      sy = e.clientY
      dragging = true
    })
    on(n, 'pointerup', function (e) {
      if (dragging && e.clientY - sy > U.SWIPE_DISMISS_PX) doClose()
      dragging = false
    })

    if (spec.build) spec.build(body, api)
    return api
  }

  // Toasts acknowledge an action that produced no visible change, and nothing else. Game events
  // are console lines. There are three toasts in the whole game.
  var toastEl = null
  var toastT = null

  function toast (msg, undo) {
    if (!view) return null
    if (!toastEl) {
      toastEl = el('div', 'toast')
      toastEl.setAttribute('role', 'status')
      toastEl.__label = el('span', 'toast-label', '')
      toastEl.appendChild(toastEl.__label)
      view.shell.appendChild(toastEl)
    }
    setText(toastEl.__label, msg)
    if (toastEl.__undo) {
      toastEl.removeChild(toastEl.__undo)
      toastEl.__undo = null
    }
    if (undo) {
      var u = btn('toast-undo', 'undo')
      bindPress(u, function () {
        undo()
        setData(toastEl, 'open', '0')
      }, { onUp: true })
      toastEl.appendChild(u)
      toastEl.__undo = u
    }
    setData(toastEl, 'open', '1')
    if (toastT) clearTimeout(toastT)
    toastT = setTimeout(function () {
      if (toastEl) setData(toastEl, 'open', '0')
    }, U.TOAST_MS)
    return toastEl
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE TWO VOICES
  // The console is log.js's, entirely: it is the game speaking, five rows of narration, and
  // nothing else may be pushed into it. `announce` is the interface speaking — a shortfall, a
  // refusal, a counter-offer — and it is a diagnostic, not narration. It goes to a visually
  // hidden live region of its own so a screen reader hears the answer and the narrative console
  // is never overwritten by one.
  //
  // Every string `announce` carries is also on screen, next to the control that refused, before
  // the player ever taps it (06 §5.2). A sighted player is answered by the layout; a screen
  // reader is answered here. Neither is answered by the game's voice.
  // ───────────────────────────────────────────────────────────────────────────

  function announce (str) {
    if (!view || !str) return
    // An identical repeat leaves the node unchanged, and an unchanged live region is silent.
    // A trailing space is a different string and reads the same aloud.
    var next = view.announcer.textContent === str ? str + ' ' : str
    view.announcer.textContent = next
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE SHELL
  // ───────────────────────────────────────────────────────────────────────────

  var view = null

  function ledgerRow (parent, key) {
    var n = el('div', 'ledger-row')
    n.dataset.key = key
    n.setAttribute('role', 'group')
    n.hidden = true
    var lab = el('span', 'ledger-lab', '')
    var val = slot('ledger-val')
    var rate = slot('ledger-rate')
    var cap = el('div', 'ledger-cap')
    cap.hidden = true
    n.appendChild(lab)
    n.appendChild(val)
    n.appendChild(rate)
    n.appendChild(cap)
    parent.appendChild(n)
    return { el: n, lab: lab, val: val, rate: rate, cap: cap, key: key, sub: null }
  }

  function buildShell (root) {
    var v = {
      root: root,
      panels: {},
      order: [],
      cards: {},
      rates: {},
      tabs: [],
      tab: null,
      stage: 0,
      plateH: 0,
      act: 1,
      rev: null,
      lastDisplay: 0,
      lastRateT: 0,
      lastAria: 0,
      lastCanvasAria: 0,
      lastStatus: 0,
      scrolling: false,
      scrollT: 0
    }

    var shell = el('div', 'shell')
    shell.dataset.stage = '0'
    v.shell = shell

    var main = el('main', 'main')
    v.main = main
    var scroll = el('div', 'scroll scroll-main')
    v.scroll = scroll

    // ── the plate: two canvases, one of which is never cleared (06 §7.1) ──
    var plate = el('div', 'plate')
    var net = el('canvas')
    net.id = 'net'
    net.setAttribute('aria-hidden', 'true')
    var flux = el('canvas')
    flux.id = 'flux'
    flux.setAttribute('role', 'img')
    flux.setAttribute('aria-label', '')
    plate.appendChild(net)
    plate.appendChild(flux)
    // The handle exists from boot and is revealed by the stylesheet at stage 2, so the bar it sits
    // in never gains a control mid-act; the plate is simply not collapsible until it is competing
    // with a tabbed panel for the same column.
    var pt = btn('plate-toggle')
    pt.appendChild(glyphSvg(CHEVRON_D, 22))
    setAttr(pt, 'aria-label', STR.collapseMap)
    setAttr(pt, 'aria-expanded', 'true')
    // Hidden, not merely undisplayed: D02's cold-boot inventory is one button and it is EXTEND,
    // and a control the stylesheet happens not to paint is still a control in the DOM.
    pt.hidden = true
    bindPress(pt, togglePlate, { onUp: true })
    plate.appendChild(pt)
    v.plateToggle = pt
    v.plate = plate
    v.net = net
    v.flux = flux
    scroll.appendChild(plate)

    // ── the ledger: four rows, allocated at boot, shown as they are earned ──
    var ledger = el('div', 'ledger')
    ledger.dataset.scrolled = '0'
    v.ledger = ledger
    v.ledgerRows = []
    var keys = ['biomass', 'sugar', 'minerals', 'net']
    for (var i = 0; i < U.LEDGER_MAX_ROWS; i++) v.ledgerRows.push(ledgerRow(ledger, keys[i]))
    v.ledgerRows[0].el.dataset.lead = 'solo'

    var gear = btn('gear')
    gear.appendChild(glyphSvg(GEAR_D, 22))
    setAttr(gear, 'aria-label', STR.settings)
    gear.hidden = true
    bindPress(gear, openSettings, { onUp: true })
    ledger.appendChild(gear)
    v.gear = gear
    scroll.appendChild(ledger)

    v.stack = el('div', 'panels')
    scroll.appendChild(v.stack)

    // ── the hero: always the last element in the scroll, forever ──
    var hero = btn('hero')
    v.heroLab = el('span', 'hero-lab', STR.extend)
    hero.appendChild(v.heroLab)
    // The cost line exists from boot and is empty until a verb has a price. SETTLE has one — the
    // spores it spends — and that stock is the whole of Phase A, so it belongs on the button that
    // consumes it rather than in a strip row that is only true for twenty minutes.
    v.heroCost = el('span', 'hero-cost num', '')
    v.heroCost.hidden = true
    hero.appendChild(v.heroCost)
    v.hero = hero
    bindPress(hero, onHero, { feel: 'extend', quiet: true })
    scroll.appendChild(hero)
    v.tailEl = el('div', 'tail')
    scroll.appendChild(v.tailEl)

    main.appendChild(scroll)
    shell.appendChild(main)

    // ── the FAB: PULSE, from Act II, over everything ──
    var fab = btn('fab')
    fab.appendChild(glyphSvg(PULSE_D, 26))
    fab.hidden = true
    bindPress(fab, function () { firePulse(null) }, { onUp: true })
    bindLongPress(fab, openPulseModes, fab)
    v.fab = fab
    shell.appendChild(fab)

    // ── the tab bar: five slots from boot, hidden until Act II ──
    var bar = el('nav', 'tabbar')
    bar.setAttribute('role', 'tablist')
    bar.hidden = true
    v.tabbar = bar
    TAB_SLOTS.forEach(function (spec, idx) {
      var t = btn('tab')
      t.setAttribute('role', 'tab')
      t.setAttribute('aria-selected', 'false')
      t.tabIndex = -1
      t.dataset.tab = spec.key
      // Both faces are built once and one is hidden. Swapping a slot's meaning at the act break by
      // replacing its children would drop focus and restart the reveal animation on a tab that has
      // been earned for two hours.
      var g2 = glyphSvg(spec.d, 24)
      var g3 = glyphSvg(spec.d3, 24)
      // `hidden` is an HTMLElement property and an <svg> is not one, so setting it here does
      // nothing at all; the face that is showing is chosen by the stylesheet off <html data-act>,
      // which is the same attribute the whole Act III palette hangs from.
      g2.setAttribute('data-face', '2')
      g3.setAttribute('data-face', '3')
      if (spec.key === 'forest') g3.setAttribute('stroke-dasharray', '5 3')
      var lab = el('span', 'tab-lab', spec.label)
      t.appendChild(g2)
      t.appendChild(g3)
      t.appendChild(lab)
      t.appendChild(el('span', 'tab-ind'))
      bindPress(t, function () { setTab(spec.key) })
      bar.appendChild(t)
      v.tabs.push({
        key: spec.key, el: t, index: idx, earned: false, badge: null,
        spec: spec, glyph2: g2, glyph3: g3, lab: lab
      })
    })
    shell.appendChild(bar)

    // ── the console: the only *visible* live region, and log.js owns every word of it ──
    var con = el('footer', 'console')
    var inner = el('div', 'console-inner')
    inner.setAttribute('aria-live', 'polite')
    inner.setAttribute('aria-atomic', 'false')
    con.appendChild(inner)
    var cur = el('span', 'console-cur', '▌')
    cur.setAttribute('aria-hidden', 'true')
    con.appendChild(cur)
    v.console = con
    v.consoleInner = inner
    shell.appendChild(con)

    // ── the interface's own voice: shortfalls and refusals, spoken, never drawn ──
    v.announcer = el('div', 'vh')
    v.announcer.setAttribute('aria-live', 'polite')
    v.announcer.setAttribute('aria-atomic', 'true')
    shell.appendChild(v.announcer)

    // ── the coalesced spoken summary (06 §8.4), off by default ──
    v.statusVh = el('div', 'vh')
    v.statusVh.setAttribute('role', 'status')
    shell.appendChild(v.statusVh)

    root.appendChild(shell)
    return v
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MOUNT AND LAYOUT
  // ───────────────────────────────────────────────────────────────────────────

  // The two in-panel canvases are created inside a hidden panel, so canvas.js's first attach
  // measures them at zero and leaves the default 300 × 150 backing store in place; everything
  // drawn afterwards is then stretched by 150/44 vertically. They are told to re-measure the
  // first frame they actually have a box, and never again.
  function sizeLater (cv) {
    if (!cv || cv.__sized || !(cv.clientHeight > 0)) return
    cv.__sized = 1
    sizeCanvas(cv)
  }

  function sizeCanvas (cv) {
    var w = cv.clientWidth
    var h = cv.clientHeight
    if (!(w > 0 && h > 0)) return
    var dpr = Math.min((win() && win().devicePixelRatio) || 1, U.DPR_MAX)
    var bw = Math.round(w * dpr)
    var bh = Math.round(h * dpr)
    if (cv.width === bw && cv.height === bh) return
    cv.width = bw
    cv.height = bh
    var ctx = cv.getContext ? cv.getContext('2d') : null
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // The network is regenerable from (seed, n), so a resize is a legitimate re-seed and the
    // drawing module is told rather than left to discover it.
    if (typeof CustomEvent === 'function') {
      cv.dispatchEvent(new CustomEvent('hyphae:resize', { bubbles: true }))
    }
  }

  function layout () {
    if (!view) return
    var w = win()
    var h = view.shell.clientHeight || (w ? w.innerHeight : 780)
    var px = Math.max(U.PLATE_MIN_PX, Math.round(h * U.PLATE_FRAC[view.stage]))
    if (px !== view.plateH) {
      view.plateH = px
      // Written directly, in one frame. Height is a layout property and is never transitioned;
      // the content below fades instead and the resize lands under the fade (06 §4.3).
      view.shell.style.setProperty('--plate-px', px + 'px')
    }
    sizeCanvas(view.net)
    sizeCanvas(view.flux)
  }

  function mount (root) {
    var d = doc()
    if (!d) return null
    root = root || d.getElementById('app') || d.body
    clear(root)
    view = buildShell(root)
    definePanels(view)

    var s = liveState()
    setTheme(recall('hyphae.theme') || (s ? s.set.theme : 'auto'))
    applyMotionAttr()
    if (recall('hyphae.verbose') === '1') verbose = true
    if (!hasTabular(d.body)) d.documentElement.dataset.numfont = 'mono'

    // The console's row budget is measured by its owner, against its own strings.
    if (LOG() && LOG().mount) LOG().mount(view.consoleInner)

    on(view.scroll, 'scroll', function () {
      setData(view.ledger, 'scrolled', view.scroll.scrollTop > 0 ? '1' : '0')
      view.scrolling = true
      if (view.scrollT) clearTimeout(view.scrollT)
      view.scrollT = setTimeout(function () { view.scrolling = false }, U.SCROLL_QUIET_MS)
    })
    var w = win()
    if (w) {
      on(w, 'resize', layout)
      on(w, 'orientationchange', layout)
    }
    layout()

    // loop.js owns the single rAF in the build; when it is present we ride in it and start none of
    // our own (BIBLE §4.2).
    if (HY.loop && HY.loop.onFrame) HY.loop.onFrame(function () { render(liveState()) })

    render(s)
    return view
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COMMANDS — every state change the interface can cause, in one place.
  // ───────────────────────────────────────────────────────────────────────────

  // The hero is the act's own verb, not one particular verb that happens to be Act I's. There are
  // three of them across the game and each is the thing the player does more than any other thing:
  // EXTEND on the floor, SETTLE in the canopy, NEW GROWTH at the very end.
  function heroVerb (s) {
    if (!s) return null
    if (s.act === 1) return 'extend'
    if (s.act >= 3) {
      var fin = HY.finale
      var e = fin && fin.ending ? fin.ending(s) : null
      if (e && e.button) return 'newgrowth'
      if (s.phase === 'canopy') return 'settle'
    }
    return null
  }

  function onHero () {
    var s = liveState()
    if (!s) return
    if (LOG() && LOG().notifyInput) LOG().notifyInput()
    var verb = heroVerb(s)
    if (verb === 'extend' && A1() && A1().onExtend) A1().onExtend()
    else if (verb === 'settle' && HY.bloom) commit(function () { return HY.bloom.settle() })
    else if (verb === 'newgrowth' && HY.finale && HY.finale.newGrowth) HY.finale.newGrowth()
    // feel.js fires the extend haptic from act1's own call site; this is the fallback for a build
    // in which it has not been concatenated yet.
    if (!FEEL()) haptic(U.HAP_PRESS, 'extend')
  }

  function tipsAffordable () {
    var s = liveState()
    var a = A1()
    if (!s || !a) return 0
    var n = 0
    var g = num(s.res.biomass)
    var m = num(s.res.minerals)
    var t = s.a1.tips
    while (n < U.BURST_MAX_STEPS) {
      var cg = a.tipCost(t + n)
      var cm = a.tipMineralCost(t + n)
      if (g < cg || m < cm) break
      g -= cg
      m -= cm
      n += 1
    }
    return n
  }

  function buyTips (n) {
    var a = A1()
    if (!a) return 0
    var done = commit(function () {
      var k = 0
      for (var i = 0; i < n; i++) {
        if (!a.buyTip()) break
        k += 1
      }
      return k
    })
    if (done && view) flashSlot(view.ledgerRows[0].val, 'loss')
    return done
  }

  // `consumptionOrder` is player-ordered by §3 and no simulation module exposes a setter for it.
  // This is the one legal home for the permutation, and it is total: an adjacent swap, or nothing.
  function reorderPool (type, dir) {
    var s = liveState()
    if (!s || s.act !== 1) return false
    var o = s.a1.consumptionOrder
    var i = o.indexOf(type)
    var j = i + dir
    if (i < 0 || j < 0 || j >= o.length) return false
    var tmp = o[i]
    o[i] = o[j]
    o[j] = tmp
    return true
  }

  // The plate's window, opened and closed by the player and remembered. It is not a game state and
  // has no owning module, so it lives here beside the theme, which is the same kind of thing.
  function togglePlate () {
    if (!view) return false
    var min = view.shell.dataset.plate === 'min'
    setPlate(!min)
    store('hyphae.plate', min ? 'open' : 'min')
    return !min
  }

  function setPlate (min) {
    if (!view) return
    if (min) setData(view.shell, 'plate', 'min')
    else delete view.shell.dataset.plate
    setAttr(view.plateToggle, 'aria-label', min ? STR.expandMap : STR.collapseMap)
    setAttr(view.plateToggle, 'aria-expanded', min ? 'false' : 'true')
    // Only the frame moved; the canvas box is unchanged, so nothing is re-drawn and nothing is
    // re-seeded. layout() is still called because the panel stack below it grew.
    layout()
  }

  function setTab (id) {
    if (!view) return id
    view.tab = id
    view.tabs.forEach(function (t) {
      var sel = t.key === id
      setAttr(t.el, 'aria-selected', sel ? 'true' : 'false')
      t.el.tabIndex = sel ? 0 : -1
      // A badge clears when the tab is opened, not when the item is interacted with.
      if (sel && t.badge) {
        t.el.removeChild(t.badge)
        t.badge = null
      }
    })
    return id
  }

  function revealTab (id) {
    if (!view) return false
    var found = null
    view.tabs.forEach(function (x) { if (x.key === id) found = x })
    if (!found || found.earned) return false
    found.earned = true
    setData(found.el, 'earned', '1')
    if (!view.tab) setTab(id)
    return true
  }

  function revealPanel (id) {
    if (!view) return null
    var p = view.panels[id]
    if (!p || p.shown) return p || null
    p.shown = true
    // A panel arrives at the bottom of the existing stack, never in the middle, so nothing the
    // player was looking at moves. EXTEND, once it has joined the stack, stays after all of them:
    // it is the last row of the scroll and not the last panel to have arrived.
    view.stack.appendChild(p.view.el)
    // ADAPTATIONS is a global panel that started life on the MIND tab. In Act III that slot's
    // subject is the genome, so the tree stays below whatever the act itself puts there rather
    // than above it by seniority.
    var ad = view.panels.adaptations
    if (view.act >= 3 && id !== 'adaptations' && ad && ad.shown) view.stack.appendChild(ad.view.el)
    if (view.hero.parentNode === view.stack) view.stack.appendChild(view.hero)
    if (!reducedMotion()) p.view.el.classList.add('reveal')
    haptic(U.HAP_REVEAL, 'ui.reveal')
    return p
  }

  // A slot that has been earned can be taken back exactly once, at the Act II → III break, because
  // the slot's *subject* changes there: the GENOME tab is not the MIND tab with a new label, it is
  // a different organ that has not been unlocked yet. 06 §4.3's "the screen grows and then, in the
  // dismantle, shrinks" only reads as progress if the growing starts again.
  function unearnTab (id) {
    if (!view) return
    view.tabs.forEach(function (t) {
      if (t.key !== id) return
      t.earned = false
      delete t.el.dataset.earned
      if (view.tab === id) setTab('log')
    })
  }

  // The Act III cold shift: one attribute, cross-faded by the stylesheet over 2,600 ms.
  function setAct (n) {
    var d = doc()
    if (!d || !view) return n
    var was = view.act
    view.act = n
    // NEW GROWTH is a cold boot, and it calls this with 1. Without the reset the next run opened
    // in Act III's palette, behind Act III's tab bar, with the void's glyphs over Act I's panels —
    // the shell is the only thing in the build that does not rebuild itself on a new game.
    if (n === 1) {
      delete d.documentElement.dataset.act
      delete view.shell.dataset.dismantle
      view.stage = 0
      setData(view.shell, 'stage', '0')
      show(view.tabbar, false)
      show(view.plateToggle, false)
      setPlate(false)
      view.tabs.forEach(function (t) {
        t.earned = false
        delete t.el.dataset.earned
        setText(t.lab, t.spec.label)
      })
      view.tab = null
      placeHero(view, true)
      layout()
      return n
    }
    if (n >= 2) {
      view.stage = 2
      setData(view.shell, 'stage', '2')
      show(view.tabbar, true)
      // Stage 2's plate is a map beside a tabbed list rather than the whole picture, so the window
      // opens at whatever the player last left it at rather than always wide, and the handle that
      // moves it arrives in the same frame the tab bar does.
      show(view.plateToggle, true)
      setPlate(recall('hyphae.plate') === 'min')
      layout()
    }
    if (n >= 3) {
      d.documentElement.dataset.act = '3'
      view.tabs.forEach(function (t) { setText(t.lab, t.spec.label3) })
      // The void and the log are what Act III opens with (03 §23.1). The other three arrive again.
      if (was < 3) {
        unearnTab('flush')
        unearnTab('pact')
        // The project tree is a global panel that happens to have started on the MIND tab. In Act
        // III that tab's subject is the genome, so the tree steps to the bottom of the stack: this
        // is the one moment §4.5's "never reordered" yields, because the act break is precisely
        // when the shell is allowed to become a different shell.
        var ad = view.panels.adaptations
        if (ad && ad.shown) view.stack.appendChild(ad.view.el)
        if (view.hero.parentNode === view.stack) view.stack.appendChild(view.hero)
        setTab('forest')
      }
    }
    return n
  }

  // ───────────────────────────────────────────────────────────────────────────
  // REVEALS
  // ───────────────────────────────────────────────────────────────────────────

  var COLD = {
    substrate: false,
    tips: false,
    sugar: false,
    market: false,
    seasons: false,
    trees: false,
    projects: false,
    mineralWarn: false,
    mineralGate: false,
    signal: false,
    decide: false
  }

  // BIBLE §5.3. Act I's reveal predicates live in act1.reveals() because they are readings of the
  // Act I board; Act II's are readings of `proj.flags`, which no simulation module owns, so they
  // are derived here. Every one is monotone: a panel that has been earned is never taken back.
  function flagOn (s, k) { return !!(s.proj && s.proj.flags && s.proj.flags[k]) }

  function a2Reveals (s) {
    var w = HY.world
    return {
      substrate: false, tips: false, sugar: false, market: false, seasons: false,
      trees: false, mineralWarn: true, mineralGate: false, decide: false,
      projects: true,
      // Act II opens holding one claimed region; the map is worth showing from the first frame,
      // and `chemotaxis` is what makes it a place you can act on rather than a place you are.
      forest: true,
      stands: flagOn(s, 'chemotaxis'),
      signal: true,
      insight: flagOn(s, 'turgor'),
      diff: flagOn(s, 'differentiation'),
      pulse: flagOn(s, 'action_potential_ii'),
      flush: flagOn(s, 'primordium'),
      pact: flagOn(s, 'pact_first') || !!(HY.pactbook && HY.pactbook.isOpen && HY.pactbook.isOpen()),
      retention: flagOn(s, 'humic_retention'),
      necro: flagOn(s, 'necrotrophic_conversion'),
      claimed: w && w.claimedCount ? w.claimedCount() : 1
    }
  }

  // Act III's predicates read `proj.flags` and the phase, exactly as Act II's do. The one extra
  // reading is the dismantle: after an ending is taken, panels close on a timetable finale.js owns,
  // and a closed panel is the only non-monotone reveal in the build (06 §4.3 — the shell shrinks).
  function a3Reveals (s) {
    var dv = HY.divergence
    var fin = HY.finale
    var end = fin && fin.ending ? fin.ending(s) : null
    var closed = end && end.dismantle ? end.dismantle.closed : []
    var voidPhase = s.phase === 'void' || s.phase === 'dismantle'
    var strains = dv && dv.strains ? dv.strains(s) : []
    return {
      substrate: false, tips: false, sugar: false, market: false, seasons: false,
      trees: false, mineralWarn: true, mineralGate: false, decide: false,
      projects: true,
      canopy: !voidPhase,
      voidPhase: voidPhase,
      genome: flagOn(s, 'genome'),
      // The triangle is Translocation and nothing else: without it every gram banks itself and
      // there is no allocation to show (03 §8).
      fleet: flagOn(s, 'translocation'),
      lineages: strains.length > 0 || !!(s.a3 && s.a3.succ),
      wheel: flagOn(s, 'circadian_entrainment'),
      endings: flagOn(s, 'circadian_entrainment') || !!end ||
        !!(fin && fin.conditions && unmetCount(fin.conditions('ENCYST', s)) === 0),
      pulse: voidPhase || flagOn(s, 'action_potential_ii'),
      dismantle: closed,
      ending: end
    }
  }

  function unmetCount (rows) {
    var n = 0, i
    for (i = 0; rows && i < rows.length; i++) if (!rows[i].ok) n += 1
    return n
  }

  function revealFlags (s) {
    if (!s) return COLD
    if (s.act >= 3) { try { return a3Reveals(s) } catch (e) { return COLD } }
    if (s.act >= 2) { try { return a2Reveals(s) } catch (e) { return COLD } }
    var a = A1()
    if (!a || !a.reveals) return COLD
    try { return a.reveals() } catch (e) { return COLD }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER — from the one rAF. Reads state, writes only what changed.
  // ───────────────────────────────────────────────────────────────────────────

  // The stocks the ledger measures. Every one of them lives in `res` under its own name, and
  // carbon joins the list at the act break because it is Act III's biomass.
  var RATE_KEYS = ['biomass', 'sugar', 'minerals', 'signal', 'carbon']

  function rate (v, key, value, dt) {
    var r = v.rates[key]
    if (!r) {
      v.rates[key] = { last: value, v: 0, step: 0 }
      return
    }
    if (dt <= 0) return
    // `step` is what the player just spent or was just paid in one instant. A transaction is not
    // a rate: leaving it in makes an 82 g tip read as −33 g/s for two seconds while the stock it
    // describes is visibly rising. It is removed from the delta, never from the stock.
    var inst = (value - r.last - r.step) / dt
    r.last = value
    r.step = 0
    r.v += (inst - r.v) * (1 - Math.exp(-dt / U.RATE_TAU_S))
  }

  function rateOf (v, key) { return v.rates[key] ? v.rates[key].v : 0 }

  // Rates are measured, never re-derived. There is exactly one copy of every production formula and
  // it lives in the simulation; an EMA over the display slot is honest and costs four subtractions
  // a tenth of a second.
  //
  // It is measured against `t`, the simulated clock, and not against the wall — because those are
  // not the same clock. A catch-up tick, an offline reconcile and a backgrounded tab all move
  // hours of production into one display slot, and dividing that by a tenth of a real second
  // reports a rate the player never earned and cannot sustain. Per simulated second it is simply
  // the average they did earn. At 1× the two clocks agree and this changes nothing.
  function updateRates (v, s) {
    var simT = num(s.t)
    var dt = simT - v.lastRateT
    v.lastRateT = simT
    // A load, a reset or an act break moves the clock backwards. Rebaseline; a discontinuity is
    // not a rate either.
    if (dt < 0) { v.rates = {}; return }
    for (var i = 0; i < RATE_KEYS.length; i++) rate(v, RATE_KEYS[i], num(s.res[RATE_KEYS[i]]), dt)
  }

  // Every discrete transaction the interface performs is handed to the rate meters so they can
  // subtract it. A tap on EXTEND is deliberately *not* one of these: manual decomposition is
  // production, and a player holding the hero down is entitled to see the rate it earns them.
  function commit (fn) {
    var s = liveState()
    if (!view || !s) return fn()
    var before = []
    var i, r
    for (i = 0; i < RATE_KEYS.length; i++) before.push(num(s.res[RATE_KEYS[i]]))
    var out = fn()
    for (i = 0; i < RATE_KEYS.length; i++) {
      r = view.rates[RATE_KEYS[i]]
      if (r) r.step += num(s.res[RATE_KEYS[i]]) - before[i]
    }
    return out
  }

  function stage (v, s, rev) {
    var want = s.act >= 2 ? 2 : (rev.market ? 1 : 0)
    if (want === v.stage) return
    v.stage = want
    setData(v.shell, 'stage', String(want))
    layout()
  }

  // BIBLE §5.3, and P4: the tab bar is the progress bar. Slots are allocated at boot and earned one
  // at a time, so the bar never reflows when one arrives.
  function tabs (v, s, rev) {
    if (s.act < 2) return
    // `v.act < s.act`, not `< 2`: the old test made the Act III cold shift unreachable, because
    // v.act was already 2 when the act broke and setAct was never called a second time. Five hours
    // of Act III were painted in Act II's palette.
    if (v.act < s.act) setAct(s.act)
    if (s.act >= 3) {
      // The slot holding the project tree is never taken away — `genome` is bought from it. The
      // dismantle is the one thing that closes a slot, and a slot it has closed must not be
      // re-earned on the next frame by the same call that earned it in the first place.
      if (!dismantled(rev, 'forest')) revealTab('forest')
      if (!dismantled(rev, 'mind')) revealTab('mind')
      if (rev.fleet && !dismantled(rev, 'flush')) revealTab('flush')
      if (rev.lineages && !dismantled(rev, 'pact')) revealTab('pact')
      revealTab('log')
      dismantle(v, rev)
      return
    }
    if (rev.forest) revealTab('forest')
    if (rev.signal) revealTab('mind')
    if (rev.flush) revealTab('flush')
    if (rev.pact) revealTab('pact')
    revealTab('log')
  }

  // 06 §4.3: "It never shrinks except in the Act III dismantle, where it shrinks all the way to a
  // single button." finale.js owns the timetable and publishes which groups have closed; this
  // turns that list into the two things the shell has to do — take the slots away, and fade the
  // frame — and nothing else. The order is finale's, not ours.
  function dismantle (v, rev) {
    var d = rev.dismantle
    if (!d || !d.length) {
      if (v.shell.dataset.dismantle) delete v.shell.dataset.dismantle
      return
    }
    setData(v.shell, 'dismantle', d.indexOf('strip') >= 0 ? 'strip' : String(d.length))
    for (var i = 0; i < d.length; i++) {
      if (DISMANTLE_TAB[d[i]]) unearnTab(DISMANTLE_TAB[d[i]])
    }
  }

  function rotLine (r, rot) {
    if (rot > 0) {
      if (!r.sub) {
        r.sub = el('div', 'ledger-sub')
        r.el.parentNode.insertBefore(r.sub, r.el.nextSibling)
      }
      show(r.sub, true)
      setText(r.sub, '− ' + C().fmt(rot) + ' g/s (' + STR.rot + ')')
      return
    }
    if (r.sub) show(r.sub, false)
  }

  // Act II's strip. Biomass stays the lead because it is still what everything is bought with;
  // Signal takes the second row with its capacity, because saturation — not the level — is the
  // number every decision in the act is made against.
  function paintLedgerA2 (v, s, rev) {
    var g = HY.cognition
    var shown = 2

    var r0 = v.ledgerRows[0]
    show(r0.el, true)
    setText(r0.lab, STR.biomass)
    setMass(r0.val, num(s.res.biomass))
    setRate(r0.rate, rateOf(v, 'biomass'), 'g/s')
    setData(r0.el, 'lead', '1')

    var r1 = v.ledgerRows[1]
    show(r1.el, true)
    setText(r1.lab, STR.p_signal)
    var held = num(s.res.signal)
    var cap = g && g.Sc ? num(g.Sc(s)) : 0
    // Held only. `held / cap` is fifteen characters against an eight-character slot (BIBLE §2.5)
    // and it wrapped the strip; the capacity is what the hairline under the row is *for*, and the
    // MIND panel prints both in full.
    setSlot(r1.val, C().fmt(held), GLYPH.signal)
    show(r1.cap, true)
    var f = cap > 0 ? held / cap : 0
    r1.cap.style.setProperty('--v', fill(f).toFixed(4))
    var sat = !!(g && g.saturated && g.saturated(s))
    setData(r1.cap, 'tone', sat ? 'warn' : 'ok')
    if (sat) setSlot(r1.rate, STR.saturated, '')
    else setRate(r1.rate, rateOf(v, 'signal'), '/s')
    if (r1.sub) show(r1.sub, false)

    var r2 = v.ledgerRows[2]
    if (rev.insight) {
      shown += 1
      show(r2.el, true)
      setText(r2.lab, STR.insight)
      setSlot(r2.val, C().fmt(num(s.res.insight)), GLYPH.insight)
      setRate(r2.rate, g && g.insightRate ? num(g.insightRate(s)) : 0, '/s')
    } else {
      show(r2.el, false)
    }

    var r3 = v.ledgerRows[3]
    shown += 1
    show(r3.el, true)
    setText(r3.lab, STR.minerals)
    setSlot(r3.val, C().fmt(num(s.res.minerals)), GLYPH.minerals)
    setRate(r3.rate, rateOf(v, 'minerals'), '/s')

    show(v.gear, true)
    setData(v.ledger, 'gear', '1')
    return shown
  }

  // Act III's strip, 03 §23.1. Carbon leads because it is the only thing the void produces and the
  // only thing it spends; Signal keeps its capacity hairline because saturation still gates
  // Insight; the third row is the fleet you have, which in the canopy is spores you have not
  // planted yet and in the void is craft.
  function paintLedgerA3 (v, s, rev) {
    var g = HY.cognition
    var bl = HY.bloom

    var r0 = v.ledgerRows[0]
    show(r0.el, true)
    setText(r0.lab, STR.carbon)
    setSlot(r0.val, C().fmt(num(s.res.carbon)), GLYPH.carbon)
    setRate(r0.rate, rateOf(v, 'carbon'), GLYPH.carbon + '/s')
    setData(r0.el, 'lead', '1')
    if (r0.sub) show(r0.sub, false)

    var r1 = v.ledgerRows[1]
    show(r1.el, true)
    setText(r1.lab, STR.p_signal)
    var held = num(s.res.signal)
    var cap = g && g.Sc ? num(g.Sc(s)) : 0
    setSlot(r1.val, C().fmt(held), GLYPH.signal)
    show(r1.cap, true)
    r1.cap.style.setProperty('--v', fill(cap > 0 ? held / cap : 0).toFixed(4))
    var sat = !!(g && g.saturated && g.saturated(s))
    setData(r1.cap, 'tone', sat ? 'warn' : 'ok')
    if (sat) setSlot(r1.rate, STR.saturated, '')
    else setRate(r1.rate, rateOf(v, 'signal'), '/s')

    // Craft is a count and a count takes no unit: the row already says the word. The rate slot
    // carries the surplus the whole fleet is running, because a standing count with no direction
    // beside it is a number you cannot steer by.
    var r2 = v.ledgerRows[2]
    show(r2.el, true)
    setText(r2.lab, STR.craft)
    setSlot(r2.val, C().fmt(bl && bl.totalCraft ? num(bl.totalCraft(s)) : 0), '')
    setRate(r2.rate, bl && bl.Lambda ? num(bl.Lambda(s)) : 0, GLYPH.carbon + '/s')

    var r3 = v.ledgerRows[3]
    show(r3.el, true)
    setText(r3.lab, STR.insight)
    setSlot(r3.val, C().fmt(num(s.res.insight)), GLYPH.insight)
    setRate(r3.rate, g && g.insightRate ? num(g.insightRate(s)) : 0, '/s')

    show(v.gear, true)
    setData(v.ledger, 'gear', '1')
    return 4
  }

  function paintLedger (v, s, rev) {
    if (s.act >= 3) return paintLedgerA3(v, s, rev)
    if (s.act >= 2) return paintLedgerA2(v, s, rev)
    var shown = 1
    var r0 = v.ledgerRows[0]
    show(r0.el, true)
    setText(r0.lab, STR.biomass)
    setMass(r0.val, num(s.res.biomass))
    setRate(r0.rate, rateOf(v, 'biomass'), 'g/s')

    var r1 = v.ledgerRows[1]
    if (rev.sugar) {
      shown += 1
      show(r1.el, true)
      setText(r1.lab, STR.sugar)
      var cap = A1() && A1().sugarCap ? A1().sugarCap() : 0
      var held = num(s.res.sugar)
      setRaw(r1.val, C().fmt(held) + ' / ' + C().fmt(cap), '')
      setRate(r1.rate, rateOf(v, 'sugar'), 'g/s')
      show(r1.cap, true)
      var f = cap > 0 ? held / cap : 0
      r1.cap.style.setProperty('--v', fill(f).toFixed(4))
      setData(r1.cap, 'tone', f > U.SUGAR_WARN_FRAC ? 'warn' : 'ok')
      rotLine(r1, held > cap ? (held - cap) * T().A1.ROT_RATE : 0)
    } else {
      show(r1.el, false)
    }

    var r2 = v.ledgerRows[2]
    if (rev.mineralWarn || num(s.res.minerals) > 0) {
      shown += 1
      show(r2.el, true)
      setText(r2.lab, STR.minerals)
      setSlot(r2.val, C().fmt(num(s.res.minerals)), GLYPH.minerals)
      setRate(r2.rate, rateOf(v, 'minerals'), '/s')
    } else {
      show(r2.el, false)
    }

    var r3 = v.ledgerRows[3]
    if (rev.trees) {
      shown += 1
      show(r3.el, true)
      setText(r3.lab, STR.netSugar)
      var e = E1()
      var ns = e && e.netSugar ? e.netSugar() : 0
      setRate(r3.val, ns, 'g/s')
      // When the net goes negative the line gains a countdown. That single row is Act I's
      // unsold-inventory sawtooth (01 §5A.6).
      if (ns < 0) {
        // A duration in the rate slot is not a rate, so it says what it is counting down to.
        setRaw(r3.rate, C().fmtTime(num(s.res.sugar) / Math.max(1e-9, -ns)), STR.toEmpty)
        setData(r3.rate, 'sign', 'neg')
      } else {
        // The word "net" is only meaningful next to what was netted off. While the balance is
        // positive the second slot carries the committed outflow rather than an em dash.
        var owed = e && e.bookState ? num(e.bookState().committed) : 0
        if (owed > 0) setSlot(r3.rate, C().fmt(owed), STR.owed)
        else setSlot(r3.rate, STR.nothing, '')
        setData(r3.rate, 'sign', 'zero')
      }
    } else {
      show(r3.el, false)
    }

    // The one asymmetry in the strip: alone on screen, biomass is the display size; it steps down
    // to the hero size the moment a second row arrives.
    setData(r0.el, 'lead', shown === 1 ? 'solo' : '1')
    show(v.gear, shown > 1)
    setData(v.ledger, 'gear', shown > 1 ? '1' : '0')
  }

  // A live verb is pinned in the bottom band, because 06 §0.1 rule 2 says the primary action is
  // always there. A verb the act has finished with is not deleted — 06 §4.3 keeps EXTEND as the
  // last row of the FOREST tab's scroll — but it stops holding 92 px of thumb country while the
  // verbs that *are* live sit above the fold, which is what it did for the whole of Act II.
  function placeHero (v, pinned) {
    var want = pinned ? v.scroll : v.stack
    if (v.hero.parentNode === want) return
    want.insertBefore(v.hero, pinned ? v.tailEl : null)
  }

  function paintHero (v, s) {
    var verb = heroVerb(s)
    var state = 'idle'
    var label = STR.extend

    if (verb === 'settle') {
      label = STR.settle
      if (!(num(s.res.spores) > 0)) state = 'disabled'
    } else if (verb === 'newgrowth') {
      label = STR.newGrowth
      state = 'new'
    } else if (s.act === 1) {
      if (A1() && A1().totalSubstrate && !(A1().totalSubstrate() > 0)) state = 'disabled'
    } else {
      state = 'disabled'
    }

    setText(v.heroLab, label)
    show(v.heroCost, verb === 'settle')
    if (verb === 'settle') setText(v.heroCost, C().fmt(num(s.res.spores)) + ' ' + GLYPH.spores)
    placeHero(v, !!verb)
    // In Act II and in the void the button is a memorial, and a memorial belongs on the tab whose
    // subject it was. A live verb belongs on every tab, because it is the act's whole loop.
    show(v.hero, verb ? true : v.tab === 'forest')
    setData(v.hero, 'state', state)
    setAttr(v.hero, 'aria-label', verb === 'settle'
      ? label + ', ' + C().fmt(num(s.res.spores)) + ' ' + GLYPH.spores
      : label)
    paintFab(v, s)
  }

  // The FAB is PULSE and only PULSE (`06` §5.3). It is the one verb in Acts II and III that is
  // never automated at any price, so it is the one thing that gets a permanent thumb position.
  function paintFab (v, s) {
    var g = HY.cognition
    var on = s.act >= 2 && !!(v.rev && v.rev.pulse) && !!g
    show(v.fab, on)
    // The stack owes the FAB its own height at the end of the scroll, and only while it is there.
    if (on) setData(v.shell, 'fab', '1')
    else delete v.shell.dataset.fab
    if (!on) return
    var cd = num(s.cog.pulseCd)
    var max = g.pulseCooldown ? num(g.pulseCooldown(s)) : 0
    var cost = g.pulseCost ? num(g.pulseCost(s)) : 0
    var poor = num(s.res.signal) < cost
    if (cd > 0 && max > 0) {
      setAttr(v.fab, 'data-cool', '1')
      v.fab.style.setProperty('--p', (1 - cd / max).toFixed(3))
      setAttr(v.fab, 'aria-label', STR.pulse + ', ' + C().fmtTime(cd))
    } else {
      v.fab.removeAttribute('data-cool')
      setAttr(v.fab, 'aria-label', STR.pulse + ', ' +
        (poor ? C().fmt(cost) + ' ' + GLYPH.signal : STR.ready))
    }
    setData(v.fab, 'poor', poor ? '1' : '0')
  }

  // The epicentre is the claimed region the pulse will do the most good in, which for every mode
  // in Act II is the one carrying the most live interface. Choosing it here rather than making the
  // player pick a hex keeps the verb inside one tap; the radial that picks a *mode* is the
  // long-press, and that is the decision worth asking for.
  function pulseEpicentre (s) {
    var f = HY.forest
    var r = s.a2 && s.a2.regions
    // In Act III the epicentre is a band, and the band carrying the most craft is the one a pulse
    // reaches the most of — the same argument, one field further out.
    if (s.act >= 3) {
      var n = s.a3 && s.a3.bands ? s.a3.bands.n : null
      if (!n) return 0
      var bb = 0, most = -1, k
      for (k = 0; k < n.length; k++) { if (num(n[k]) > most) { most = num(n[k]); bb = k } }
      return bb
    }
    if (!f || !f.liveInterface || !r) return num(s.cog.pulseEpicentre)
    var best = -1, bv = -1, i
    for (i = 0; i < r.flags.length; i++) {
      var v2 = num(f.liveInterface(i, s))
      if (v2 > bv) { bv = v2; best = i }
    }
    return best >= 0 ? best : 0
  }

  function firePulse (mode) {
    var s = liveState()
    var g = HY.cognition
    if (!s || !g || !g.pulse) return false
    var list = g.modes(s)
    var m = mode || (list.length ? list[0] : null)
    if (!m) return false
    var okd = commit(function () { return g.pulse(m, pulseEpicentre(s)) })
    if (okd) {
      haptic(U.HAP_HOLD, 'ui.pulse')
      s.stats.pulses = num(s.stats.pulses) + 1
    } else {
      haptic(U.HAP_ERROR, 'ui.error')
    }
    return okd
  }

  // Long-press opens the mode picker (`06` §5.3). With one mode unlocked there is nothing to pick,
  // so the gesture agrees with the tap instead of opening an empty sheet.
  function openPulseModes () {
    var s = liveState()
    var g = HY.cognition
    if (!s || !g) return
    var list = g.modes(s)
    if (list.length < 2) { firePulse(null); return }
    var sh = sheet({ id: 'pulse', title: STR.pulse })
    list.forEach(function (m) {
      var r = el('div', 'sheet-row')
      r.appendChild(el('span', 'field-lab', m.toLowerCase()))
      r.appendChild(actionButton(STR.pulse, function () { firePulse(m); sh.close() }))
      sh.body.appendChild(r)
    })
    sh.open()
  }

  // The status strip is not a live region: a counter that changes ten times a second must never be
  // one. Each row is a group whose label is recomputed at most every three seconds (06 §8.4).
  // The strip's four rows carry a different stock in each act, and the spoken label has to follow
  // them. It did not: a screen reader heard "sugar" over the Signal row for the whole of Act II and
  // "net sugar" over Insight, which is worse than silence — it is a wrong number with a confident
  // name on it. The label is now built from the row's own painted label and value.
  function ariaRow (v, i, label, value, tail) {
    var r = v.ledgerRows[i]
    if (r.el.hidden) return
    setAttr(r.el, 'aria-label', label + ', ' + value + (tail ? ', ' + tail : ''))
  }

  function paintAria (v, s) {
    var g = HY.cognition
    if (s.act >= 3) {
      var bl = HY.bloom
      ariaRow(v, 0, STR.carbon, C().fmt(num(s.res.carbon)),
        rateOf(v, 'carbon') > 0 ? 'rising' : 'steady')
      ariaRow(v, 1, STR.p_signal, C().fmt(num(s.res.signal)) + ' of ' +
        C().fmt(g && g.Sc ? num(g.Sc(s)) : 0),
        g && g.saturated && g.saturated(s) ? STR.saturated : '')
      ariaRow(v, 2, STR.craft, C().fmt(bl && bl.totalCraft ? num(bl.totalCraft(s)) : 0),
        STR.surplus + ' ' + signed(bl && bl.Lambda ? num(bl.Lambda(s)) : 0))
      ariaRow(v, 3, STR.insight, C().fmt(num(s.res.insight)))
      return
    }
    ariaRow(v, 0, STR.biomass, C().fmtMass(num(s.res.biomass)),
      rateOf(v, 'biomass') > 0 ? 'rising' : 'steady')
    if (s.act >= 2) {
      ariaRow(v, 1, STR.p_signal, C().fmt(num(s.res.signal)) + ' of ' +
        C().fmt(g && g.Sc ? num(g.Sc(s)) : 0),
        g && g.saturated && g.saturated(s) ? STR.saturated : '')
      ariaRow(v, 2, STR.insight, C().fmt(num(s.res.insight)))
      ariaRow(v, 3, STR.minerals, C().fmt(num(s.res.minerals)))
      return
    }
    var cap = A1() && A1().sugarCap ? A1().sugarCap() : 0
    ariaRow(v, 1, STR.sugar, C().fmt(num(s.res.sugar)) + ' of ' + C().fmt(cap))
    ariaRow(v, 2, STR.minerals, C().fmt(num(s.res.minerals)))
    var e = E1()
    ariaRow(v, 3, STR.netSugar,
      C().fmt(e && e.netSugar ? e.netSugar() : 0) + ' per second')
  }

  // No canvas ever carries information that is not also available as text on the same screen; this
  // label is the text form of the same fact (06 §7.9).
  function paintCanvasAria (v, s) {
    // The plate draws three different things across the game and the label has to be the third of
    // them by Act III, or the last five hours are described as a network of threads that no longer
    // exists (06 §7.9: the canvas carries nothing that is not also text).
    if (s.act >= 3) {
      var bl = HY.bloom
      var occ = 0, i
      var f = a3Field(s)
      if (f) for (i = 0; i < f.n.length; i++) if (num(f.n[i]) > 0) occ += 1
      setAttr(v.flux, 'aria-label',
        occ + ' of ' + (f ? f.n.length : 0) + ' ' +
        (s.phase === 'canopy' ? 'biomes' : 'bands') + ' occupied, ' +
        C().fmt(bl && bl.totalCraft ? num(bl.totalCraft(s)) : 0) + ' craft')
      return
    }
    if (s.act >= 2) {
      var w = HY.world
      setAttr(v.flux, 'aria-label',
        (w && w.claimedCount ? w.claimedCount() : 0) + ' of 61 stands held, ' +
        (w && w.discoveredCount ? w.discoveredCount() : 0) + ' discovered. ' + STR.mapKey)
      return
    }
    var m = A1() && A1().hyphae ? A1().hyphae() : 0
    setAttr(v.flux, 'aria-label',
      C().fmt(m) + ' metres of thread, ' + C().fmt(s.a1.tips) + ' tips, ' +
      (rateOf(v, 'biomass') > 0 ? 'growing' : 'still'))
  }

  var verbose = false

  // The coalesced spoken summary, off by default (06 §8.4). Three facts, and they are the three
  // the current act is actually played on — not Act I's three repeated for five hours.
  function paintStatus (v, s) {
    var g = HY.cognition
    var bl = HY.bloom
    if (s.act >= 3) {
      setText(v.statusVh,
        STR.carbon + ' ' + C().fmt(num(s.res.carbon)) + '. ' +
        STR.craft + ' ' + C().fmt(bl && bl.totalCraft ? num(bl.totalCraft(s)) : 0) + '. ' +
        STR.surplus + ' ' + signed(bl && bl.Lambda ? num(bl.Lambda(s)) : 0) + ' per second.')
      return
    }
    if (s.act >= 2) {
      var w = HY.world
      setText(v.statusVh,
        STR.biomass + ' ' + C().fmtMass(num(s.res.biomass)) + '. ' +
        STR.p_signal + ' ' + C().fmt(num(s.res.signal)) + ' of ' +
        C().fmt(g && g.Sc ? num(g.Sc(s)) : 0) + '. ' +
        (w && w.claimedCount ? w.claimedCount() : 0) + ' stands.')
      return
    }
    var cap = A1() && A1().sugarCap ? A1().sugarCap() : 0
    setText(v.statusVh,
      STR.biomass + ' ' + C().fmtMass(num(s.res.biomass)) + '. ' +
      STR.sugar + ' ' + C().fmt(num(s.res.sugar)) + ' of ' + C().fmt(cap) + '. ' +
      s.a1.contracts.length + ' terms.')
  }

  // A new-item dot clears when it has been *seen*, which survives being scrolled past — strictly
  // more information than UP's twelve blinks, for very much less light (06 §6.4).
  function seeDots (v, t) {
    var w = win()
    var vh = w ? w.innerHeight : 780
    var k, c, r, visible
    for (k in v.cards) {
      if (!Object.prototype.hasOwnProperty.call(v.cards, k)) continue
      c = v.cards[k]
      if (!c.isNew() || !c.el.getBoundingClientRect) continue
      r = c.el.getBoundingClientRect()
      visible = Math.min(r.bottom, vh) - Math.max(r.top, 0)
      if (r.height > 0 && visible / r.height >= U.DOT_SEEN_FRAC) {
        if (!c.el.__dotAt) c.el.__dotAt = t
        else if (t - c.el.__dotAt >= U.DOT_SEEN_MS) c.seen()
      } else {
        c.el.__dotAt = 0
      }
    }
  }

  // One attribute write per changed card; CSS does the rest. This is the four-line architecture of
  // the teardown, made cheap enough for a phone.
  function syncCards (v) {
    var pj = PJ()
    if (!pj) return
    var k, c, entry
    for (k in v.cards) {
      if (!Object.prototype.hasOwnProperty.call(v.cards, k)) continue
      c = v.cards[k]
      entry = pj.byId(k)
      if (!entry) continue
      c.setState(!entry.buyable ? 'unbuyable' : (entry.cost() ? 'afford' : 'want'))
    }
  }

  // The 10 Hz slot: rates, panel bodies, cooldown rings and every ARIA label (BIBLE §4.2).
  //
  // Two callers reach this: loop.js's display timer and the rAF, which needs the reveal flags for
  // the frame it is about to paint. The slot therefore owns its own clock rather than trusting
  // either of them for a `dt`. It has to: when both were allowed to sample, each saw half the
  // delta and divided it by a whole slot, and every rate on screen read exactly half the truth.
  function display (v, s, t) {
    if (t - v.lastDisplay < U.DISPLAY_MS) return
    v.lastDisplay = t
    var rev = revealFlags(s)
    v.rev = rev
    updateRates(v, s)
    stage(v, s, rev)
    tabs(v, s, rev)
    v.order.forEach(function (id) {
      var p = v.panels[id]
      if (p.need(s, rev) && !p.shown) revealPanel(id)
      if (!p.shown) return
      var on = onTab(v, p, s)
      show(p.view.el, on)
      // A hidden panel costs nothing but a boolean: syncing five tabs' worth of rows at 10 Hz to
      // paint one of them is the whole reason a phone gets warm.
      if (on) p.sync(s, rev)
    })
    paintHero(v, s)
    if (t - v.lastAria >= U.ARIA_STRIP_MS) {
      v.lastAria = t
      paintAria(v, s)
    }
    if (t - v.lastCanvasAria >= U.ARIA_CANVAS_MS) {
      v.lastCanvasAria = t
      paintCanvasAria(v, s)
    }
    if (verbose && t - v.lastStatus >= U.ARIA_STATUS_MS) {
      v.lastStatus = t
      paintStatus(v, s)
    }
    seeDots(v, t)
  }

  function render (s) {
    if (!view) return
    s = s || liveState()
    if (!s) return
    var t = nowMs()

    // The display slot runs first so the ledger is painted against this frame's reveal flags
    // rather than the previous frame's; a row must never arrive one frame late. It throttles
    // itself, so calling it every frame costs one subtraction.
    display(view, s, t)

    paintLedger(view, s, view.rev || COLD)
    syncCards(view)

    var cv = CANVAS()
    if (!cv) return
    // The plate is the act: threads growing in Act I, sixty-one hexes in Act II, concentric arcs
    // in Act III. Growing the network past the first break would keep drawing a body that DECIDE
    // deleted, and drawing the map past the second would keep drawing a forest that is gone.
    if (s.act >= 3) {
      if (cv.drawVoid) cv.drawVoid(a3Field(s))
    } else if (s.act >= 2) {
      if (cv.drawMap && s.a2) cv.drawMap(s.a2.regions)
    } else {
      if (cv.growNetwork && A1() && A1().hyphae) cv.growNetwork(A1().hyphae())
      if (cv.drawNet) cv.drawNet()
    }
    // The two in-panel canvases are drawn only while their own tab is the one on screen: a strip
    // nobody can see costs the same milliseconds as one they can.
    // Not drawn until the box has been measured. The strip redraws at 1 Hz, so one frame painted
    // into an unsized 300 × 150 buffer is not a glitch that corrects itself next frame — it is a
    // squashed picture that stays on screen for a second, and then a blank one for another.
    if (view.tab === 'flush' && s.act === 2 && cv.drawForecast && HY.flush && HY.flush.strip) {
      sizeLater(view.forecastEl)
      if (view.forecastEl && view.forecastEl.__sized) cv.drawForecast(HY.flush.strip())
    }
    if (view.tab === 'forest' && s.act >= 3 && cv.drawWheel && HY.finale && HY.finale.wheel) {
      var wh = HY.finale.wheel(s)
      if (wh && wh.live) {
        sizeLater(view.wheel)
        cv.drawWheel(wh.phases, wh.mass)
      }
    }
    // Nothing draws while the finger is moving: this is worth ~1.5 ms per frame during the one
    // moment the player is most likely to notice jank (06 §6.7 rule 8).
    if (!view.scrolling && cv.drawFlux) cv.drawFlux(t)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT I PANELS
  // Each entry is { need, build, sync }. `need` is the reveal predicate, evaluated every display
  // slot; the panel is constructed once, on its first true, and appended at the bottom.
  // ═══════════════════════════════════════════════════════════════════════════

  // `tab` is the slot a panel belongs to once the tab bar exists. Act I has no tab bar, so a panel
  // with no tab is simply always on screen; in Act II a panel is on screen when its tab is the
  // selected one, which is how five tabs share one scroller without a router.
  function def (v, id, need, build, tab, live) {
    var p = {
      id: id, shown: false, view: null, tab: tab || null, sync: function () {},
      // A revealed panel is permanent *within its act*. Two things end one anyway: the act break,
      // where Act II's organs are gone rather than idle, and the dismantle, where 06 §4.3 has the
      // shell shrink to a single button. Both are stated here rather than smuggled into `need`,
      // because `need` is monotone by contract and these two are the exceptions to it.
      live: live || null
    }
    p.need = function (s, rev) {
      var yes = need(s, rev)
      if (yes && !p.view) {
        p.view = build(v, p)
        p.sync = p.__sync
      }
      return yes
    }
    v.panels[id] = p
    v.order.push(id)
  }

  // A panel is on screen when its act still has it and its tab is the selected one. Before the tab
  // bar exists there is no selected tab, so the act scope is the whole test — which matters because
  // NEW GROWTH returns a live shell to Act I without rebuilding it, and every panel the last run
  // earned is still in the stack.
  function onTab (v, p, s) {
    if (p.live && !p.live(s, v.rev || COLD)) return false
    if (s.act < 2) return true
    return p.tab === v.tab
  }

  // `dismantle` is finale.js's list of panel *groups* — the tab each one lives on. A group that is
  // closed takes its whole tab with it, which is what makes the screen empty rather than thin.
  var DISMANTLE_TAB = { lineages: 'pact', genome: 'mind', fleet: 'flush', void: 'forest' }

  function dismantled (rev, tab) {
    var d = rev && rev.dismantle
    var i
    if (!d || !d.length) return false
    for (i = 0; i < d.length; i++) if (DISMANTLE_TAB[d[i]] === tab) return true
    return false
  }

  function actI (s) { return s.act === 1 }
  function actII (s) { return s.act === 2 }
  function actIII (tab) {
    return function (s, rev) { return s.act >= 3 && !dismantled(rev, tab) }
  }

  // Ground becomes a decision the moment the utilisation alarm could conceivably fire, or the
  // moment the second place is worth what has been earned. Both figures are already in TUNE.
  function needPatches (s, rev) {
    if (!rev.projects) return false
    if (s.a1.patches > 1 || s.a1.claimInFlight) return true
    if (num(s.res.cumBiomass) >= T().A1.PATCH[1].biomass) return true
    var a = A1()
    return !!(a && a.utilisation && a.utilisation() >= T().A1.UTIL_ALARM)
  }

  // ── THE FLOOR ──────────────────────────────────────────────────────────────

  function poolRow (type) {
    var r = row({ expand: true })
    var l0 = r.line()
    span(l0, 'row-name', TYPE_NAME[type] || type)
    var pos = span(l0, 'row-sub', '')
    var amount = slot('row-num')
    l0.appendChild(amount)
    var l1 = r.line()
    var bar = meter('ascii', 0)
    l1.appendChild(bar)
    var capTxt = span(l1, 'row-num', '')

    var acts = el('div', 'row-actions')
    acts.appendChild(actionButton(STR.sooner, function () { reorderPool(type, U.SOONER) }))
    acts.appendChild(actionButton(STR.later, function () { reorderPool(type, U.LATER) }))
    r.expander().appendChild(acts)

    return {
      el: r.el,
      sync: function (s, order) {
        var held = num(s.a1.sub[type])
        var cap = E1() && E1().capOf ? E1().capOf(type) : 0
        var nth = ORDINAL[order - 1] || String(order)
        setMass(amount, held)
        setText(pos, interp(STR.eaten, { n: nth }))
        bar.set(cap > 0 ? held / cap : 0, '', C().fmtMass(held) + ' of ' + C().fmtMass(cap))
        // The bar has no scale of its own; the number beside it is the pool's ceiling, and it
        // says so rather than sitting there as a second unexplained mass.
        setText(capTxt, interp(STR.roomFor, { v: C().fmtMass(cap) }))
        r.label((TYPE_NAME[type] || type) + ', ' + C().fmtMass(held) + ' of ' + C().fmtMass(cap) +
          ', eaten ' + nth)
      }
    }
  }

  function buildFloor (v, p) {
    var pv = panel('floor', { title: STR.p_floor })
    var pools = el('div', 'pool-list')
    pv.body.appendChild(pools)
    var rows = {}

    var util = row({})
    var ul0 = util.line()
    span(ul0, 'row-name', STR.utilisation)
    // A bare percentage is a percentage of nothing until it says what of. This is the whole
    // content of the utilisation alarm: the fraction of the litterfall you are keeping up with.
    span(ul0, 'row-sub', STR.ofWhatFalls)
    var utilNum = slot('row-num')
    ul0.appendChild(utilNum)
    var utilBar = meter('fill', 0)
    utilBar.classList.add('meter--grow')
    util.line().appendChild(utilBar)
    pv.body.appendChild(util.el)

    var cond = row({})
    var cl0 = cond.line()
    span(cl0, 'row-name', STR.conduction)
    var condNum = span(cl0, 'row-num', STR.nothing)
    cond.el.hidden = true
    pv.body.appendChild(cond.el)

    p.__sync = function (s) {
      var seen = {}
      var n = 0
      s.a1.consumptionOrder.forEach(function (type) {
        if (s.a1.unlockedTypes.indexOf(type) < 0) return
        seen[type] = 1
        n += 1
        var r = rows[type]
        if (!r) {
          r = rows[type] = poolRow(type)
          pools.appendChild(r.el)
        }
        // The DOM order IS the eating order, so the list a screen reader walks and the list the
        // simulation walks are one list. Re-append only when the position actually moved.
        if (r.el.dataset.pos !== String(n)) {
          r.el.dataset.pos = String(n)
          pools.appendChild(r.el)
        }
        r.sync(s, n)
      })
      Object.keys(rows).forEach(function (k) { show(rows[k].el, !!seen[k]) })
      pv.setCount(n)

      var a = A1()
      var u = a && a.utilisation ? a.utilisation() : 0
      setRaw(utilNum, String(Math.round(fill(u) * 100)), '%')
      utilBar.set(u, u >= T().A1.UTIL_ALARM ? 'warn' : '',
        Math.round(fill(u) * 100) + ' percent of what falls', T().A1.UTIL_ALARM)

      show(cond.el, !!s.proj.flags.anastomosis)
      if (s.proj.flags.anastomosis) setText(condNum, STR.nothing)
    }
    p.view = pv
    return pv
  }

  // ── HYPHAL TIPS ────────────────────────────────────────────────────────────

  function buildTips (v, p) {
    var pv = panel('tips', { title: STR.p_tips })
    var r = row({})
    var l0 = r.line()
    // A bare mass beside three buttons is a price with no name on it.
    span(l0, 'row-sub', STR.nextTip)
    var costTxt = span(l0, 'row-name num', '')
    var minTxt = span(l0, 'row-sub num', '')
    var burst = el('div', 'burst')
    l0.appendChild(burst)

    // The answer to "why is that button grey" is on screen before the tap, not after it. This is
    // the same string `refuse` speaks, and it is here so that it never needs to be spoken.
    var lShort = r.line()
    var shortTxt = span(lShort, 'row-sub', '')
    setData(shortTxt, 'tone', 'cost')
    show(lShort, false)

    var b1 = btn('', '+1')
    var b5 = btn('', '+' + U.BURST_5_AT)
    var bMax = btn('', STR.max)
    show(b5, false)
    show(bMax, false)
    burst.appendChild(b1)
    burst.appendChild(b5)
    burst.appendChild(bMax)

    bindRepeat(b1, function () { buyTips(1) }, function () { return tipsAffordable() >= 1 })
    bindPress(b5, function () {
      if (tipsAffordable() < 1) { refuse(b5); return }
      buyTips(U.BURST_5_AT)
    })
    bindPress(bMax, function () {
      var n = tipsAffordable()
      if (n < 1) { refuse(bMax); return }
      buyTips(n)
    })

    var l1 = r.line()
    span(l1, 'row-sub', STR.litterEaten)
    var thru = slot('row-num')
    l1.appendChild(thru)
    pv.body.appendChild(r.el)

    // The cost updates *after* the press animation completes, not during, so the number the player
    // pressed is the number they saw. One setTimeout, and it is the difference between
    // "responsive" and "slippery" (06 §5.11).
    var settle = 0
    ;[b1, b5, bMax].forEach(function (b) {
      on(b, 'pointerdown', function () { settle = nowMs() + U.COST_SETTLE_MS })
    })

    p.__sync = function (s, rev) {
      pv.setCount(whole(s.a1.tips))
      // What the tips *are* eating, measured by the simulation, not what they could eat.
      // `throughputPerSec` is a tip-time budget, not a mass: soft litter buys more grams per
      // second of it than hard litter does, so it is not this row's number and never was. A bare
      // floor now reads as nothing being eaten, which is what is happening.
      setRate(thru, A1() ? A1().litterPerSec() : 0, 'g/s')
      if (nowMs() < settle) return
      var a = A1()
      var g = a ? a.tipCost(s.a1.tips) : 0
      var m = a ? a.tipMineralCost(s.a1.tips) : 0
      setText(costTxt, C().fmtMass(g))
      show(minTxt, rev.mineralWarn)
      if (rev.mineralWarn) {
        // A hard wall with no forecast is a bug report; a greyed zero that turns into a one is a
        // plan. This is the trigger/cost split applied to a cost line (01 §4 unlock 8).
        setText(minTxt, '· ' + C().fmt(m) + ' ' + GLYPH.minerals)
        setData(minTxt, 'tone', m > 0 ? 'cost' : 'forecast')
      }
      var afford = tipsAffordable()
      // Name the constraint that is actually binding. Once the mineral gate opens the tip a
      // player cannot buy is usually the one they have the grams for.
      var gapG = g - num(s.res.biomass)
      var gapM = m - num(s.res.minerals)
      var shortStr = interp(STR.short, {
        n: gapM > 0 && gapM >= gapG
          ? C().fmt(gapM) + ' ' + GLYPH.minerals
          : C().fmtMass(Math.max(0, gapG))
      })
      show(lShort, afford < 1)
      if (afford < 1) setText(shortTxt, shortStr)
      setData(b1, 's', afford >= 1 ? 'afford' : 'want')
      setData(b5, 's', afford >= U.BURST_5_AT ? 'afford' : 'want')
      setData(bMax, 's', afford >= 1 ? 'afford' : 'want')
      b1.dataset.short = shortStr
      b5.dataset.short = shortStr
      bMax.dataset.short = shortStr
      setAttr(b1, 'aria-label', STR.growTip + ', ' + C().fmtMass(g) +
        (m > 0 ? ', ' + C().fmt(m) + ' ' + STR.minerals : ''))
      setAttr(b5, 'aria-label', STR.growTip + ' ' + U.BURST_5_AT)
      setAttr(bMax, 'aria-label', STR.growTip + ' ' + STR.max)
      // Behavioural triggers: the wider buys appear when the narrow one has become a chore.
      show(b5, s.a1.tips >= U.BURST_5_AT)
      show(bMax, s.a1.tips >= U.BURST_MAX_AT)
    }
    p.view = pv
    return pv
  }

  // ── THE LITTER MARKET ──────────────────────────────────────────────────────

  function marketRow (type) {
    var r = row({})
    var mode = { sell: false }

    var l0 = r.line()
    span(l0, 'row-name', TYPE_NAME[type] || type)
    var side = btn('side-btn', STR.buy)
    setAttr(side, 'aria-pressed', 'false')
    l0.appendChild(side)
    var price = slot('row-num')
    l0.appendChild(price)

    var l1 = r.line()
    var arrow = span(l1, 'row-arrow', '·')
    var sparkEl = span(l1, 'row-ascii', '')
    var detail = span(l1, 'row-sub num', '')
    var stockTxt = span(l1, 'row-num', '')

    var l2 = r.line()
    // The same promise the tips row makes: the shortfall is on screen before the tap, so a
    // refusal never has to interrupt the console to say it.
    var shortTxt = span(l2, 'row-sub', '')
    setData(shortTxt, 'tone', 'cost')
    var burst = el('div', 'burst')
    l2.appendChild(burst)
    var buys = []

    function trade (grams, frac, source) {
      var s = liveState()
      var e = E1()
      if (!s || !e) return
      var g
      if (mode.sell) {
        var held = num(s.a1.sub[type])
        g = (grams === null || grams === undefined) ? held * frac : Math.min(grams, held)
        if (!(g > 0)) { refuse(source); return }
        commit(function () { e.sell(type, g) })
        if (view) flashSlot(view.ledgerRows[1].val, 'gain')
        return
      }
      var unit = e.unitPrice(type)
      var stock = s.a1.mkt[e.TYPES.indexOf(type)].stock
      var ceiling = Math.min(unit > 0 ? num(s.res.sugar) / unit : 0, stock)
      g = (grams === null || grams === undefined) ? ceiling * frac : Math.min(grams, ceiling)
      if (!(g > 0)) { refuse(source); return }
      commit(function () { e.buy(type, g) })
      if (view) flashSlot(view.ledgerRows[1].val, 'loss')
    }

    // The two fixed sizes are masses, and they carry their unit: `1.00 k` alone is a quantity of
    // nothing in particular next to a price quoted per gram.
    U.MARKET_BUY_G.forEach(function (g) {
      var b = btn('', C().fmtMass(g))
      bindPress(b, function () { trade(g, null, b) })
      burst.appendChild(b)
      buys.push({ el: b, kind: 'abs', g: g })
    })
    var bFrac = btn('', Math.round(U.MARKET_FRAC * 100) + '%')
    bindPress(bFrac, function () { trade(null, U.MARKET_FRAC, bFrac) })
    burst.appendChild(bFrac)
    buys.push({ el: bFrac, kind: 'frac', g: 0 })
    var bMax = btn('', STR.max)
    bindPress(bMax, function () { trade(null, 1, bMax) })
    burst.appendChild(bMax)
    buys.push({ el: bMax, kind: 'max', g: 0 })

    function flip () {
      mode.sell = !mode.sell
      setData(r.el, 'mode', mode.sell ? 'sell' : 'buy')
      setAttr(side, 'aria-pressed', mode.sell ? 'true' : 'false')
      setText(side, mode.sell ? STR.sell : STR.buy)
      setText(bMax, mode.sell ? STR.all : STR.max)
    }
    bindPress(side, flip)
    // 01 §12.1's promise: long-press is the secondary action, everywhere and only. The visible
    // toggle is the keyboard's route to the same place (06 §8.3).
    bindLongPress(r.el, flip)

    var lastPrice = 0
    return {
      el: r.el,
      sync: function (s) {
        var e = E1()
        var mkt = s.a1.mkt[e.TYPES.indexOf(type)]
        var unit = e.unitPrice(type)
        setSlot(price, C().fmt(unit), GLYPH.sugar + '/g')
        setText(arrow, unit > lastPrice ? '▲' : unit < lastPrice ? '▼' : '·')
        setData(arrow, 'dir', unit > lastPrice ? 'up' : unit < lastPrice ? 'down' : 'flat')
        lastPrice = unit
        setText(sparkEl, spark(e.priceHistory(type)))
        // The fair line is the whole content of `mycelial_ledger`: without it the player is
        // forecasting, and with it they are reading.
        setText(detail, (s.proj.flags.mycelial_ledger
          ? STR.fair + ' ' + C().fmt(e.fairValue(type)) + ' · '
          : '') + C().fmtMass(num(s.a1.sub[type])) + ' ' + STR.onFloor)
        setText(stockTxt, C().fmtMass(mkt.stock) + ' ' + STR.forSale)
        // The gap to the smallest size the player cannot yet buy: the next thing they want and
        // the only shortfall worth a line. Four shortfalls on one row is four numbers to read.
        var gap = 0
        buys.forEach(function (b) {
          var ok
          if (mode.sell) ok = num(s.a1.sub[type]) > 0
          else if (b.kind === 'abs') ok = num(s.res.sugar) >= b.g * unit && mkt.stock >= b.g
          else ok = num(s.res.sugar) > 0 && mkt.stock > 0
          setData(b.el, 's', ok ? 'afford' : 'want')
          var need = Math.max(0, b.g * unit - num(s.res.sugar))
          b.el.dataset.short = interp(STR.short, { n: C().fmt(need) + ' ' + GLYPH.sugar })
          if (!mode.sell && b.kind === 'abs' && need > 0 && (gap === 0 || need < gap)) gap = need
        })
        setText(shortTxt, gap > 0
          ? interp(STR.short, { n: C().fmt(gap) + ' ' + GLYPH.sugar })
          : '')
        r.label((TYPE_NAME[type] || type) + ', ' + C().fmt(unit) + ' sugar per gram, ' +
          C().fmtMass(mkt.stock) + ' for sale')
      }
    }
  }

  function buildMarket (v, p) {
    var pv = panel('market', { title: STR.p_market })
    var rows = {}
    p.__sync = function (s) {
      var e = E1()
      if (!e) return
      var n = 0
      e.TYPES.forEach(function (type) {
        if (s.a1.unlockedTypes.indexOf(type) < 0) {
          if (rows[type]) show(rows[type].el, false)
          return
        }
        n += 1
        if (!rows[type]) {
          rows[type] = marketRow(type)
          pv.body.appendChild(rows[type].el)
        }
        show(rows[type].el, true)
        rows[type].sync(s)
      })
      pv.setCount(n)
      if (n) pv.unempty()
      else pv.empty(LOG() ? LOG().EMPTY.market_sold_out : '')
    }
    p.view = pv
    return pv
  }

  // ── THE YEAR ───────────────────────────────────────────────────────────────

  function buildSeasons (v, p) {
    var pv = panel('seasons', { title: STR.p_seasons })
    var r = row({})
    var l0 = r.line()
    var seasonTxt = span(l0, 'row-name', '')
    var yearTxt = span(l0, 'row-sub', '')
    var phaseNum = slot('row-num')
    l0.appendChild(phaseNum)
    var phase = meter('fill', 0)
    phase.classList.add('meter--grow')
    r.line().appendChild(phase)
    var l2 = r.line()
    span(l2, 'row-sub', STR.moisture)
    var moist = slot('row-num')
    l2.appendChild(moist)
    var l3 = r.line()
    span(l3, 'row-sub', STR.warmth)
    var warm = slot('row-num')
    l3.appendChild(warm)
    pv.body.appendChild(r.el)

    var evRow = row({})
    var evTxt = span(evRow.line(), 'row-sub', '')
    evRow.el.hidden = true
    pv.body.appendChild(evRow.el)

    p.__sync = function (s) {
      var a = A1()
      setText(seasonTxt, SEASON_LABEL[s.a1.season])
      setText(yearTxt, interp(STR.year, { n: s.a1.year + 1 }))
      var left = (1 - num(s.a1.seasonPhase)) * T().CLOCK.SEASON_S
      setRaw(phaseNum, C().fmtTime(left), '')
      phase.set(num(s.a1.seasonPhase), '',
        SEASON_LABEL[s.a1.season] + ', ' + C().fmtTime(left) + ' left')
      setRaw(moist, C().fmt(num(s.a1.moisture)) + ' ×' +
        C().fmt(a && a.moistureMult ? a.moistureMult() : 1), '')
      setRaw(warm, C().fmt(a && a.tempMult ? a.tempMult() : 1), '×')
      show(evRow.el, s.a1.activeEvents.length > 0)
      if (s.a1.activeEvents.length) {
        setText(evTxt, s.a1.activeEvents.map(function (e) { return e.id }).join(' · '))
      }
      pv.setCount(SEASON_LABEL[s.a1.season])
    }
    p.view = pv
    return pv
  }

  // ── THE UNDERSTORY ─────────────────────────────────────────────────────────

  // One reconciliation for three lists: create what is new, sync what is live, remove what is gone.
  function reconcile (host, bag, items, keyOf, make, s) {
    var live = {}
    items.forEach(function (item) {
      var key = String(keyOf(item))
      live[key] = 1
      if (!bag[key]) {
        bag[key] = make(item)
        host.appendChild(bag[key].el)
      }
      bag[key].sync(s, item)
    })
    Object.keys(bag).forEach(function (k) {
      if (live[k]) return
      if (bag[k].el.parentNode) bag[k].el.parentNode.removeChild(bag[k].el)
      delete bag[k]
    })
  }

  function contractRow (id) {
    var r = row({ expand: true })
    var l0 = r.line()
    var name = span(l0, 'row-name', '')
    var state = span(l0, 'row-sub', '')
    var rateNum = slot('row-num')
    l0.appendChild(rateNum)

    var l1 = r.line()
    span(l1, 'row-sub', STR.delivered)
    var bar = meter('ascii', 0)
    l1.appendChild(bar)
    var left = span(l1, 'row-num', '')

    var l2 = r.line()
    var shortLab = span(l2, 'row-sub', '')
    var shortNum = span(l2, 'row-num', '')
    show(l2, false)

    var acts = el('div', 'row-actions')
    acts.appendChild(actionButton(STR.renegotiate, function () {
      if (E1()) commit(function () { E1().renegotiate(id) })
    }))
    acts.appendChild(actionButton(STR.exit, function () {
      if (E1()) commit(function () { E1().exitContract(id) })
    }))
    r.expander().appendChild(acts)

    return {
      el: r.el,
      sync: function (s, c) {
        var tree = E1().treeById(c.treeId)
        var label = tree ? (SPECIES_NAME[tree.species] || tree.species) : ''
        setText(name, label)
        setText(state, c.suspended ? STR.suspended : c.state)
        setSlot(rateNum, C().fmt(num(c.mineralRate)), GLYPH.minerals + '/s')
        var total = Math.max(1e-9, num(c.endT) - num(c.startT))
        var done = fill((num(s.t) - num(c.startT)) / total)
        bar.set(done, '', Math.round(done * 100) + ' percent of the term')
        setText(left, C().fmtTime(Math.max(0, num(c.endT) - num(s.t))))
        // The shortfall budget is 5% of one season's delivery — about eighteen seconds of
        // non-payment — and it is counted down in seconds on screen.
        var budget = num(c.sugarRate) * T().CLOCK.SEASON_S * T().A1.SHORTFALL_FRAC
        var sh = num(c.shortfall)
        show(l2, sh > 0)
        if (sh > 0) {
          setText(shortLab, STR.shortfall)
          setText(shortNum, C().fmtTime(Math.max(0, budget - sh) / Math.max(1e-9, c.sugarRate)))
          setData(shortNum, 'tone', 'warn')
        }
        r.label(label + ', ' + C().fmt(num(c.sugarRate)) + ' sugar per second for ' +
          C().fmt(num(c.mineralRate)) + ' minerals per second')
      }
    }
  }

  function solicitRow (id) {
    var r = row({})
    var l0 = r.line()
    var name = span(l0, 'row-name', '')
    var detail = span(l0, 'row-sub', '')
    var acts = el('div', 'row-actions')
    acts.appendChild(actionButton(STR.accept, function () {
      if (E1()) commit(function () { E1().acceptSolicitation(id) })
    }))
    acts.appendChild(actionButton(STR.decline, function () {
      if (E1()) commit(function () { E1().declineSolicitation(id) })
    }))
    r.el.appendChild(acts)
    return {
      el: r.el,
      sync: function (s, so) {
        var c = E1().contractById(id)
        var tree = c ? E1().treeById(c.treeId) : null
        setText(name, tree ? (SPECIES_NAME[tree.species] || tree.species) : '')
        setText(detail, C().fmt(num(so.volume)) + ' g/s · ' +
          interp(STR.seasons, { n: so.termSeasons }))
      }
    }
  }

  function summaryLine (host, label) {
    var l = el('div', 'row-line')
    span(l, 'row-sub', label)
    var n = slot('row-num')
    l.appendChild(n)
    host.appendChild(l)
    return n
  }

  // The negotiation is an inline expansion, not a sheet: 06 §5.8 caps the game at five sheets and
  // anything else that wants to be modal expands in place instead. Every number moves as the thumb
  // moves, and the coverage bar is the whole game — the player will learn to fear the number 100%.
  function treeRow (id, onOpen) {
    var r = row({
      expand: true,
      onOpen: function () {
        onOpen(id)
        refresh()
      }
    })
    var l0 = r.line()
    var name = span(l0, 'row-name', '')
    var age = span(l0, 'row-sub', '')
    var repNum = slot('row-num')
    l0.appendChild(repNum)
    var l1 = r.line()
    span(l1, 'row-sub', STR.deficit)
    var dBar = meter('ascii', 0)
    l1.appendChild(dBar)
    var l2 = r.line()
    span(l2, 'row-sub', STR.standing)
    var pips = meter('pips', 0)
    l2.appendChild(pips)

    var ex = r.expander()
    var volume = slider({ label: STR.volume, steps: U.SLIDER_STEPS, onInput: refresh })
    var term = slider({
      label: STR.term, steps: T().A1.TERM_MAX, value: T().A1.TERM_MIN, onInput: refresh
    })
    var coll = slider({ label: STR.collateral, steps: U.SLIDER_STEPS, onInput: refresh })
    var excl = checkbox(STR.exclusive, '', refresh)

    var summary = el('div', 'summary')
    var payNum = summaryLine(summary, STR.youPay)
    var getNum = summaryLine(summary, STR.youGet)
    var totNum = summaryLine(summary, STR.overTerm)
    var covLine = el('div', 'row-line')
    span(covLine, 'row-sub', STR.coverage)
    var cov = meter('fill', 0)
    cov.classList.add('meter--grow')
    covLine.appendChild(cov)
    summary.appendChild(covLine)

    // Refusal is a counter-offer, never a wall — and the counter-offer is standing on screen while
    // the thumb is still on the slider, not delivered as a reprimand after the tap.
    var counterLine = el('div', 'row-line')
    var counterTxt = span(counterLine, 'row-sub', '')
    setData(counterTxt, 'tone', 'cost')
    summary.appendChild(counterLine)

    function readTerms (s, tree) {
      var e1 = E1()
      return {
        volume: Math.max(0, e1.maxIntake(tree)) * (volume.value() / U.SLIDER_STEPS),
        term: C().clamp(term.value(), T().A1.TERM_MIN, e1.maxTerm(tree)),
        collateral: num(s.res.biomass) * (coll.value() / U.SLIDER_STEPS),
        exclusive: excl.isOn()
      }
    }

    function refresh () {
      var s = liveState()
      var e1 = E1()
      if (!s || !e1) return
      var tree = e1.treeById(id)
      if (!tree) return
      var t = readTerms(s, tree)
      var mineralRate = e1.offer(tree, t.volume, t.term, t.collateral, t.exclusive)
      volume.setReadout(C().fmt(t.volume), 'g/s', C().fmt(t.volume) + ' grams per second')
      term.setReadout(String(t.term), '', interp(STR.seasons, { n: t.term }))  // no suffix
      coll.setReadout(C().fmtMass(t.collateral), '', C().fmtMass(t.collateral))
      volume.setNote(C().fmt(e1.maxIntake(tree)) + ' g/s ' + STR.max)
      term.setNote(STR.max + ' ' + e1.maxTerm(tree))
      setSlot(payNum, C().fmt(t.volume), 'g/s')
      setSlot(getNum, C().fmt(mineralRate), GLYPH.minerals + '/s')
      setSlot(totNum, C().fmt(mineralRate * t.term * T().CLOCK.SEASON_S), GLYPH.minerals)
      var book = e1.bookState()
      var income = e1.netSugar() + book.committed
      var coverage = income > 0 ? (book.committed + t.volume) / income : 1
      cov.set(coverage, coverage >= 1 ? 'bad' : coverage > U.COVER_WARN ? 'warn' : '',
        Math.round(coverage * 100) + ' percent of what you make')
      var ok = e1.accepts(tree, t.volume, t.term, t.exclusive)
      setData(signBtn, 'state', ok ? 'idle' : 'locked')
      var ct = ok ? null : e1.counter(tree, t.volume, t.term, t.exclusive)
      setText(counterTxt, ct
        ? interp(STR.atMost, { v: C().fmt(ct.maxVolume) + ' g/s', n: ct.maxTerm })
        : '')
      show(counterLine, !!ct)
    }

    var signBtn = btn('hero hero--wide')
    signBtn.appendChild(el('span', 'hero-lab', STR.sign))
    bindPress(signBtn, function (e) {
      if (e && e.stopPropagation) e.stopPropagation()
      var s = liveState()
      var e1 = E1()
      var tree = e1 ? e1.treeById(id) : null
      if (!s || !tree) return
      var t = readTerms(s, tree)
      if (!e1.accepts(tree, t.volume, t.term, t.exclusive)) {
        haptic(U.HAP_ERROR, 'ui.error')
        // Refusal is a counter-offer, never a wall: the largest legal position today.
        var ct = e1.counter(tree, t.volume, t.term, t.exclusive)
        if (ct) {
          announce(interp(STR.atMost, { v: C().fmt(ct.maxVolume) + ' g/s', n: ct.maxTerm }))
        }
        return
      }
      commit(function () { e1.signContract(id, t.volume, t.term, t.collateral, t.exclusive) })
      r.setExpanded(false)
    }, { onUp: true })

    ex.appendChild(volume)
    ex.appendChild(term)
    ex.appendChild(coll)
    ex.appendChild(excl)
    ex.appendChild(summary)
    ex.appendChild(signBtn)

    return {
      el: r.el,
      collapse: function () { r.setExpanded(false) },
      sync: function (s, tree) {
        var label = SPECIES_NAME[tree.species] || tree.species
        setText(name, label)
        setText(age, whole(tree.age) + ' y')
        setRaw(repNum, whole(tree.rep), 'rep')
        var d = E1().carbonDeficit(tree)
        dBar.set(d, '', Math.round(d * 100) + ' percent short of carbon')
        pips.set(num(tree.rep) / T().A1.REP_MAX, '',
          whole(tree.rep) + ' of ' + T().A1.REP_MAX)
        r.label(label + ', deficit ' + Math.round(d * 100) + ' percent, standing ' +
          whole(tree.rep))
        if (r.isExpanded()) refresh()
      }
    }
  }

  function buildUnderstory (v, p) {
    var pv = panel('understory', { title: STR.p_understory })
    var contractsEl = el('div', 'sub-list')
    var solicitsEl = el('div', 'sub-list')
    var treesEl = el('div', 'sub-list')
    pv.body.appendChild(contractsEl)
    pv.body.appendChild(solicitsEl)
    pv.body.appendChild(treesEl)

    var contractRows = {}
    var solRows = {}
    var treeRows = {}
    var openTree = null

    p.__sync = function (s) {
      var e = E1()
      if (!e) return
      reconcile(contractsEl, contractRows, s.a1.contracts,
        function (c) { return c.id },
        function (c) { return contractRow(c.id) }, s)
      reconcile(solicitsEl, solRows, e.solicitations ? e.solicitations() : [],
        function (o) { return 's' + o.id },
        function (o) { return solicitRow(o.id) }, s)
      reconcile(treesEl, treeRows, s.a1.trees,
        function (t) { return t.id },
        function (t) {
          // Only one row is expanded at a time per list; opening a second closes the first in the
          // same frame (06 §4.6).
          return treeRow(t.id, function (openId) {
            if (openTree !== null && openTree !== openId && treeRows[openTree]) {
              treeRows[openTree].collapse()
            }
            openTree = openId
          })
        }, s)
      pv.setCount(s.a1.trees.length + ' · ' + whole(s.a1.netRep) + ' rep')
      if (s.a1.trees.length || s.a1.contracts.length) pv.unempty()
      else pv.empty(LOG() ? LOG().EMPTY.trees : '')
    }
    p.view = pv
    return pv
  }

  // ── ADAPTATIONS ────────────────────────────────────────────────────────────

  function buildAdaptations (v, p) {
    var pv = panel('adaptations', { title: STR.p_adaptations })

    function pick (entry) {
      if (!entry.buyable || !entry.cost()) {
        haptic(U.HAP_ERROR, 'ui.error')
        announce(entry.priceTag)
        return
      }
      commit(function () { PJ().purchase(entry.id) })
      if (view) flashSlot(view.ledgerRows[0].val, 'loss')
    }

    p.__sync = function (s) {
      var pj = PJ()
      if (!pj) return
      var list = pj.visible().filter(function (e) { return e.act === s.act })
      var live = {}
      list.forEach(function (entry) {
        live[entry.id] = 1
        var c = v.cards[entry.id]
        if (!c) {
          c = card({
            id: entry.id,
            title: entry.title,
            cost: entry.priceTag,
            desc: entry.description,
            pinned: entry.pinned,
            onPick: function () { pick(entry) }
          })
          v.cards[entry.id] = c
          c.markNew()
          if (!reducedMotion()) c.el.classList.add('reveal')
          // Cards keep their arrival order. The reveal queue re-sorts by affordability every tick;
          // re-ordering the DOM with it would make the panel twitch under the thumb.
          pv.body.appendChild(c.el)
        }
        c.setCost(entry.priceTag)
        c.setLabel(entry.title + '. ' + entry.priceTag + '.')
      })
      // A bought project is removed from the DOM. There is no completed tab.
      Object.keys(v.cards).forEach(function (k) {
        if (live[k]) return
        if (v.cards[k].el.parentNode) v.cards[k].el.parentNode.removeChild(v.cards[k].el)
        delete v.cards[k]
      })
      pv.setCount(list.length)
      if (list.length) pv.unempty()
      else pv.empty(LOG() ? LOG().EMPTY.adaptations : '')
    }
    p.view = pv
    return pv
  }

  // ── PATCHES ────────────────────────────────────────────────────────────────

  function buildPatches (v, p) {
    var pv = panel('patches', { title: STR.p_patches })
    var r = row({})
    var l0 = r.line()
    var have = span(l0, 'row-name', '')
    var gate = span(l0, 'row-sub', '')
    var cost = slot('row-num')
    l0.appendChild(cost)
    var prog = meter('fill', 0)
    prog.classList.add('meter--grow')
    r.line().appendChild(prog)
    var acts = el('div', 'row-actions')
    var claimBtn = actionButton(STR.claim, function (b) {
      var s = liveState()
      if (!s || !A1()) return
      if (!commit(function () { return A1().claimPatch(s.a1.patches + 1) })) refuse(b)
    })
    acts.appendChild(claimBtn)
    var actLine = r.line()
    var shortTxt = span(actLine, 'row-sub', '')
    setData(shortTxt, 'tone', 'cost')
    actLine.appendChild(acts)
    pv.body.appendChild(r.el)

    p.__sync = function (s) {
      var A = T().A1
      var next = s.a1.patches + 1
      setText(have, interp(STR.places, { n: s.a1.patches, k: A.PATCH_MAX }))
      pv.setCount(s.a1.patches)
      if (next > A.PATCH_MAX) {
        setRaw(cost, STR.nothing, '')
        setText(gate, '')
        setText(shortTxt, '')
        show(claimBtn, false)
        prog.set(1, '', 'all six')
        return
      }
      var spec = A.PATCH[next - 1]
      var needRep = A.PATCH_GATE_REP[next - 1]
      setRaw(cost, C().fmtMass(spec.biomass) + ' + ' + C().fmt(spec.minerals), GLYPH.minerals)
      setText(gate, needRep > 0 ? interp(STR.needsStanding, { n: needRep }) : '')
      var flight = s.a1.claimInFlight
      show(claimBtn, !flight)
      if (flight) {
        var pr = A1().claimProgress()
        setText(shortTxt, '')
        prog.set(pr, 'signal', STR.claiming + ', ' + Math.round(pr * 100) + ' percent')
        return
      }
      var canPay = num(s.res.biomass) >= spec.biomass &&
        num(s.res.minerals) >= spec.minerals && num(s.a1.netRep) >= needRep
      prog.set(Math.min(1, num(s.res.biomass) / spec.biomass), canPay ? '' : 'warn',
        C().fmtMass(num(s.res.biomass)) + ' of ' + C().fmtMass(spec.biomass))
      setData(claimBtn, 's', canPay ? 'afford' : 'want')
      claimBtn.dataset.short = interp(STR.short, {
        n: C().fmtMass(Math.max(0, spec.biomass - num(s.res.biomass)))
      })
      setText(shortTxt, canPay ? '' : claimBtn.dataset.short)
    }
    p.view = pv
    return pv
  }

  // ── SIGNAL ─────────────────────────────────────────────────────────────────

  function buildSignal (v, p) {
    var pv = panel('signal', { title: STR.p_signal })
    var r = row({})
    var l0 = r.line()
    span(l0, 'row-name', STR.p_signal)
    var val = slot('row-num')
    l0.appendChild(val)
    var bar = meter('fill', 0)
    bar.classList.add('meter--grow')
    var barLine = r.line()
    barLine.appendChild(bar)
    show(barLine, false)
    pv.body.appendChild(r.el)

    p.__sync = function (s, rev) {
      var held = num(s.res.signal)
      var target = T().A1.DECIDE_SIGNAL
      setSlot(val, C().fmt(held), GLYPH.signal)
      pv.setCount(C().fmt(held))
      // Signal arrives with no uses at all for eight to fifteen minutes. The bar is drawn only once
      // it is close enough to the gate to be a plan rather than a mystery.
      var near = rev.decide || held >= target * U.SIGNAL_METER_AT
      show(barLine, near)
      if (near) bar.set(held / target, 'signal', C().fmt(held) + ' of ' + C().fmt(target))
    }
    p.view = pv
    return pv
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT II PANELS
  //
  // Every number on screen here is read through a module's published surface — world.card,
  // flush.card, pactbook.card, cognition.Sr — and every one of them arrives with its own label.
  // The act is sixty-one stands, a weather process and a book of counterparties; a column of
  // unlabelled figures would be a spreadsheet of a forest, which is the one thing it must not be.
  // ═══════════════════════════════════════════════════════════════════════════

  function pct (f) { return Math.round(fill(f) * 100) + '%' }

  // Maturity is canopy-driven (`02` §7.4), so the stand with the most shade over it is the one a
  // primordium should be knotted under. There is never a reason to choose otherwise, which is why
  // the panel chooses and the player sizes the bet instead.
  function bestCanopy (s) {
    var f = HY.forest
    var r = s.a2 && s.a2.regions
    if (!f || !f.canopy || !r) return -1
    var best = -1, bv = -1, i
    for (i = 0; i < r.flags.length; i++) {
      if (!(r.flags[i] & 0x04) || (r.flags[i] & 0x10)) continue   // claimed, not necrotized
      var c = num(f.canopy(i, s))
      if (c > bv) { bv = c; best = i }
    }
    return best
  }
  function secs (v) { return isFinite(v) ? C().fmtTime(Math.max(0, v)) : STR.nothing }

  // A labelled figure: the name on the left, the value in a monospaced slot on the right. This is
  // the only shape a bare number is allowed to take anywhere in Act II.
  function statLine (r, label) {
    var l = r.line()
    span(l, 'row-name', label)
    var n = slot('row-num')
    l.appendChild(n)
    return n
  }

  // A bar carries a caption only when the figure above it does not already name what is being
  // filled; a bar captioned with the same word as the line above it is noise, not a label.
  function barLine (r, label) {
    if (label) span(r.line(), 'row-sub', label)
    var m = meter('fill', 0)
    m.classList.add('meter--grow')
    r.line().appendChild(m)
    return m
  }

  // ── THE FOREST ─────────────────────────────────────────────────────────────

  function buildForest (v, p) {
    var pv = panel('forest', { title: STR.p_forest })

    var r = row({})
    var eaten = statLine(r, STR.consumed)
    var eatenBar = barLine(r, null)
    var held = statLine(r, STR.p_stands)
    var iface = statLine(r, STR.interface_)
    var conn = statLine(r, STR.connectivity)
    pv.body.appendChild(r.el)

    // The retention dial is failure detection made into a control (BIBLE §5.3): it appears the
    // first time a stand's humus falls below the switch, and not before.
    var dial = slider({
      label: STR.retention,
      steps: U.SLIDER_STEPS,
      tone: 'signal',
      onInput: function (n) {
        var f = HY.forest
        if (f && f.setRho) f.setRho(n / U.SLIDER_STEPS * T().A2.RHO_MAX)
      }
    })
    show(dial, false)
    pv.body.appendChild(dial)

    p.__sync = function (s, rev) {
      var f = HY.forest
      var w = HY.world
      if (!f) return
      var fc = f.forestConsumed ? num(f.forestConsumed(s)) : 0
      setSlot(eaten, pct(fc), '')
      eatenBar.set(fc, fc > 0.88 ? 'warn' : 'signal', pct(fc) + ' ' + STR.consumed)
      var n = w && w.claimedCount ? w.claimedCount() : 0
      setSlot(held, interp(STR.stands, { n: n }), '')
      setSlot(iface, C().fmt(f.totalInterface ? num(f.totalInterface(s)) : 0), '')
      setSlot(conn, (w && w.connectivity ? num(w.connectivity()) : 1).toFixed(2), '×')
      pv.setCount(pct(fc))
      show(dial, !!rev.retention)
      if (rev.retention && f.globalRho) {
        var g2 = num(f.globalRho(s)) / T().A2.RHO_MAX
        // Seeded once, from the simulation's own value, and never written again: the thumb owns
        // the control after that, and a 10 Hz writeback would fight the drag.
        if (!dial.__seeded) { dial.__seeded = 1; dial.setValue(Math.round(g2 * U.SLIDER_STEPS)) }
        dial.setReadout(pct(g2), '', STR.retention + ' ' + pct(g2))
        // The dial's whole reason to exist is the stand nearest the humus switch, so the note is
        // that number and not an average — an average hides exactly the stand that is failing.
        dial.setNote(STR.humus + ' ' + (f.minHumus ? num(f.minHumus(s)).toFixed(2) : STR.nothing))
      }
    }
    p.view = pv
    return pv
  }

  // ── STANDS ─────────────────────────────────────────────────────────────────

  function standRow () {
    var r = row({ expand: true })
    var l0 = r.line()
    var name = span(l0, 'row-name', '')
    var note = span(l0, 'row-sub', '')
    var state = slot('row-num')
    l0.appendChild(state)

    var l1 = r.line()
    var terr = span(l1, 'row-sub', '')

    var colLab = span(r.line(), 'row-sub', STR.colonising)
    var col = meter('ascii', 0)
    colLab.parentNode.appendChild(col)
    var dLab = span(r.line(), 'row-sub', STR.density)
    var dens = meter('ascii', 0)
    dLab.parentNode.appendChild(dens)

    var ex = r.expander()
    var litter = el('div', 'row-line')
    var litterLab = span(litter, 'row-sub', STR.litter)
    var litterVal = slot('row-num')
    litter.appendChild(litterVal)
    ex.appendChild(litter)
    var humus = el('div', 'row-line')
    span(humus, 'row-sub', STR.humus)
    var humusVal = slot('row-num')
    humus.appendChild(humusVal)
    ex.appendChild(humus)
    var acts = el('div', 'row-actions')
    ex.appendChild(acts)

    var advBtn = actionButton(STR.advance, function (b) {
      var w = HY.world
      if (!w || !commit(function () { return w.startAdvance(api.id) })) refuse(b)
    })
    var densBtn = actionButton(STR.denser, function (b) {
      var w = HY.world
      if (!w || !commit(function () { return w.buyDensity(api.id) })) refuse(b)
    })
    var killBtn = actionButton(STR.kill, function (b) {
      var f = HY.forest
      if (!f || !commit(function () { return f.killStand(api.id) })) refuse(b)
    })
    acts.appendChild(advBtn)
    acts.appendChild(densBtn)
    acts.appendChild(killBtn)
    void litterLab

    var api = {
      el: r.el,
      id: -1,
      sync: function (s, c) {
        api.id = c.id
        setText(name, c.name || STR.unknown)
        // Terrain and species are known the moment a hex is discovered; SURVEY buys the litter
        // *band*, which is what `card.band` carries. Saying "unsurveyed" over a stand you are
        // standing in was simply wrong.
        setText(terr, c.terrain ? (c.terrain + ' · ' + c.species) : STR.fog)
        setText(note, c.necrotized ? STR.dead : (c.advancing ? STR.colonising : ''))
        // One figure per row, and it is the one the row is asking a question about: what the next
        // step costs while there is one, and the stand's standing when there is not.
        if (c.density) setSlot(state, C().fmtMass(c.density.cost), '')
        else if (!c.claimed && c.advance) setSlot(state, C().fmtMass(c.advance.cost), '')
        else setSlot(state, c.claimed ? STR.standing : STR.fog, '')
        col.set(c.col, '', STR.colonising + ' ' + pct(c.col))
        dens.set(c.d, '', STR.density + ' ' + pct(c.d))
        setSlot(litterVal, C().fmtMass(c.L), '')
        setSlot(humusVal, c.h.toFixed(2), '')
        show(advBtn, !c.claimed && !!c.advance)
        show(densBtn, !!c.density)
        show(killBtn, !!c.claimed && !c.necrotized && !!(view && view.rev && view.rev.necro))
        if (c.advance) {
          setData(advBtn, 's', c.advance.blocked ? 'want' : 'afford')
          setAttr(advBtn, 'aria-label',
            STR.advance + ' ' + c.name + ', ' + C().fmtMass(c.advance.cost))
        }
        if (c.density) {
          setAttr(densBtn, 'aria-label', STR.denser + ', ' + C().fmtMass(c.density.cost))
        }
        r.label(c.name + ', ' + (c.claimed ? STR.standing : STR.advance) + ', ' +
          STR.density + ' ' + pct(c.d))
      }
    }
    return api
  }

  function buildStands (v, p) {
    var pv = panel('stands', { title: STR.p_stands })
    var bag = {}
    p.__sync = function (s) {
      var w = HY.world
      if (!w || !w.list) return
      var all = w.list(s)
      // `world.list` is already ranked the way a thumb wants it — advancing, then held, then the
      // frontier by how much a claim would help. Sixty-one six-line rows is a spreadsheet; the top
      // of that ranking is the decision, and the count in the header keeps the rest honest.
      var list = all.length > U.STANDS_SHOWN ? all.slice(0, U.STANDS_SHOWN) : all
      reconcile(pv.body, bag, list, function (c) { return c.id }, function () {
        return standRow()
      }, s)
      pv.setCount(all.length)
      if (list.length) pv.unempty()
      else pv.empty(STR.fog)
    }
    p.view = pv
    return pv
  }

  // ── THE MIND ───────────────────────────────────────────────────────────────

  function buildMind (v, p) {
    var pv = panel('mind', { title: STR.p_mind })

    var r = row({})
    var sig = statLine(r, STR.p_signal)
    var sigBar = barLine(r, null)
    var rateN = statLine(r, STR.gain)
    var fills = statLine(r, STR.saturation)
    pv.body.appendChild(r.el)

    var r2 = row({})
    var ins = statLine(r2, STR.insight)
    var ripe = statLine(r2, STR.ripeness)
    var ripeBar = barLine(r2, null)
    pv.body.appendChild(r2.el)
    show(r2.el, false)

    p.__sync = function (s, rev) {
      var g = HY.cognition
      if (!g) return
      var held = num(s.res.signal)
      var cap = num(g.Sc(s))
      var sr = num(g.Sr(s))
      setSlot(sig, C().fmt(held) + ' / ' + C().fmt(cap), GLYPH.signal)
      sigBar.set(cap > 0 ? held / cap : 0, g.saturated(s) ? 'warn' : 'signal',
        C().fmt(held) + ' of ' + C().fmt(cap) + ' ' + STR.capacity)
      setSlot(rateN, '+' + C().fmt(sr), GLYPH.signal + '/s')
      setSlot(fills, g.saturated(s) ? STR.saturated : interp(STR.fillsIn, { v: secs(g.fillsIn(s)) }), '')
      pv.setCount(C().fmt(held))

      show(r2.el, !!rev.insight)
      if (!rev.insight) return
      var rp = num(g.ripeness(s))
      setSlot(ins, C().fmt(num(s.res.insight)), GLYPH.insight)
      setSlot(ripe, pct(rp), '')
      // Ripeness is the whole Insight economy: it only climbs while the pool is *full*, which is a
      // failure state everywhere else in the genre. The bar says so by filling only when saturated.
      ripeBar.set(rp, g.saturated(s) ? 'signal' : '', STR.ripeness + ' ' + pct(rp))
    }
    p.view = pv
    return pv
  }

  // ── DIFFERENTIATION ────────────────────────────────────────────────────────

  function buildDiff (v, p) {
    var pv = panel('diff', { title: STR.p_diff })
    var r = row({})
    var free = statLine(r, STR.p_diff)
    var condN = statLine(r, STR.conduction)
    var vesN = statLine(r, STR.vesicles)
    var acts = el('div', 'row-actions')
    var condBtn = actionButton(STR.conduction, function (b) {
      var g = HY.cognition
      if (!g || !g.allocate('cond', 1)) refuse(b)
    })
    var vesBtn = actionButton(STR.vesicles, function (b) {
      var g = HY.cognition
      if (!g || !g.allocate('ves', 1)) refuse(b)
    })
    acts.appendChild(condBtn)
    acts.appendChild(vesBtn)
    r.line().appendChild(acts)
    pv.body.appendChild(r.el)

    p.__sync = function (s) {
      var g = HY.cognition
      if (!g) return
      var un = num(g.unallocated(s))
      setSlot(free, interp(STR.unspent, { n: un }), GLYPH.diff)
      setSlot(condN, String(num(s.cog.dCond)), '')
      setSlot(vesN, String(num(s.cog.dVes)), '')
      pv.setCount(un > 0 ? String(un) : '')
      setData(condBtn, 's', un > 0 ? 'afford' : 'want')
      setData(vesBtn, 's', un > 0 ? 'afford' : 'want')
    }
    p.view = pv
    return pv
  }

  // ── THE FLUSH ──────────────────────────────────────────────────────────────

  function buildWeather (v, p) {
    var pv = panel('weather', { title: STR.p_weather })
    var r = row({})
    var wet = statLine(r, STR.moisture)
    var wetBar = barLine(r, null)
    var windN = statLine(r, STR.wind)
    var grazeN = statLine(r, STR.graze)
    var mastN = statLine(r, STR.mast)
    pv.body.appendChild(r.el)

    p.__sync = function () {
      var fl = HY.flush
      if (!fl || !fl.weather) return
      var w = fl.weather()
      setSlot(wet, w.W.toFixed(2), '')
      wetBar.set(w.W, w.W < 0.25 ? 'warn' : '', STR.moisture + ' ' + w.W.toFixed(2))
      setSlot(windN, w.windSpeed.toFixed(2), '')
      setSlot(grazeN, w.graze.toFixed(2), '')
      setSlot(mastN, w.mast ? STR.on : STR.nothing, '')
      pv.setCount(w.W.toFixed(2))
    }
    p.view = pv
    return pv
  }

  function primordiumRow () {
    var r = row({ expand: true })
    var l0 = r.line()
    var name = span(l0, 'row-name', '')
    var mode = span(l0, 'row-sub', '')
    var yieldN = slot('row-num')
    l0.appendChild(yieldN)
    var mLab = span(r.line(), 'row-sub', STR.maturity)
    var mBar = meter('ascii', 0)
    mLab.parentNode.appendChild(mBar)
    var ex = r.expander()
    var riskLine = el('div', 'row-line')
    span(riskLine, 'row-sub', STR.riskNow)
    var riskN = slot('row-num')
    riskLine.appendChild(riskN)
    ex.appendChild(riskLine)
    var bestLine = el('div', 'row-line')
    var bestTxt = span(bestLine, 'row-sub', '')
    ex.appendChild(bestLine)
    var acts = el('div', 'row-actions')
    var relBtn = actionButton(STR.release, function (b) {
      var fl = HY.flush
      if (!fl || !commit(function () { return fl.release(api.id) })) refuse(b)
    })
    var holdBtn = actionButton(STR.hold, function () {
      var fl = HY.flush
      if (fl && fl.hold) fl.hold(api.id, !api.held)
    })
    acts.appendChild(relBtn)
    acts.appendChild(holdBtn)
    ex.appendChild(acts)

    var api = {
      el: r.el,
      id: -1,
      held: false,
      sync: function (s, c) {
        api.id = c.id
        api.held = !!c.held
        setText(name, c.name)
        setText(mode, c.held ? STR.hold : '')
        setSlot(yieldN, C().fmt(c.now), GLYPH.spores)
        mBar.set(c.m, c.risk > 0.02 ? 'warn' : '', STR.maturity + ' ' + pct(c.m))
        setSlot(riskN, pct(1 - c.survive), '')
        setText(bestTxt, interp(STR.bestIn, { v: secs(c.bestIn) }) + ' · ' +
          C().fmt(c.best) + ' ' + GLYPH.spores)
        setText(holdBtn, c.held ? STR.resume : STR.hold)
        r.label(c.name + ', ' + STR.maturity + ' ' + pct(c.m) + ', ' +
          C().fmt(c.now) + ' spores if released now')
      }
    }
    return api
  }

  function buildFlush (v, p) {
    var pv = panel('flush', { title: STR.p_flush })

    // 06 §7.7's strip. It belongs here and not on the plate because it is a reading of ONE
    // sub-game — this region's moisture, past and bought-forward — and the plate is a reading of
    // the whole world. canvas.js finds it by id and sizes it on its own next attach.
    var fore = el('canvas', 'strip-canvas')
    fore.id = 'forecast'
    fore.setAttribute('role', 'img')
    fore.setAttribute('aria-label', '')
    pv.body.appendChild(fore)
    var key = el('div', 'strip-key')
    span(key, '', STR.keyPast)
    var keySoon = span(key, '', STR.keySoon)
    setData(keySoon, 'tone', 'signal')
    var keyDry = span(key, '', STR.keyDry)
    setData(keyDry, 'tone', 'warn')
    var keyGraze = span(key, '', STR.keyGraze)
    setData(keyGraze, 'tone', 'neg')
    pv.body.appendChild(key)
    v.forecastEl = fore
    v.forecastKey = key

    var head = row({})
    var slotsN = statLine(head, STR.slots)
    var sporesN = statLine(head, STR.spores)

    // Nothing fruits on its own: a primordium is a bet the player places, so the panel needs the
    // verb or the whole sub-game is a read-out. The stake is a fraction of held biomass because
    // that is the quantity the decision is actually about (`02` §7.1), and the stand is the one
    // with the most canopy over it — the choice that is never wrong, leaving the *size* as the
    // decision worth making.
    var bet = slider({
      label: STR.stake,
      steps: U.SLIDER_STEPS,
      tone: 'signal',
      value: Math.round(U.FLUSH_BET_DEFAULT * U.SLIDER_STEPS)
    })
    head.line().appendChild(bet)
    var fruitBtn = actionButton(STR.fruit, function (b) {
      var s = liveState()
      var fl = HY.flush
      if (!s || !fl) return
      var i = bestCanopy(s)
      var vol = num(s.res.biomass) * (bet.value() / U.SLIDER_STEPS) * U.FLUSH_BET_MAX
      if (i < 0 || !commit(function () { return fl.newPrimordium(i, vol) })) refuse(b)
    })
    var actLine = head.line()
    var betTxt = span(actLine, 'row-sub', '')
    setData(betTxt, 'tone', 'cost')
    var acts = el('div', 'row-actions')
    acts.appendChild(fruitBtn)
    actLine.appendChild(acts)
    pv.body.appendChild(head.el)

    var bag = {}
    p.__sync = function (s) {
      var fl = HY.flush
      if (!fl || !fl.list) return
      var list = fl.list()
      var free = fl.used() < fl.slots()
      setSlot(slotsN, interp(STR.slotsUsed, { n: fl.used(), k: fl.slots() }), '')
      setSlot(sporesN, C().fmt(num(s.res.spores)), GLYPH.spores)
      var vol = num(s.res.biomass) * (bet.value() / U.SLIDER_STEPS) * U.FLUSH_BET_MAX
      bet.setReadout(C().fmtMass(vol), '', STR.stake + ' ' + C().fmtMass(vol))
      show(fruitBtn, free)
      setData(fruitBtn, 's', free && vol > 0 ? 'afford' : 'want')
      setText(betTxt, free ? '' : STR.slotsFull)
      reconcile(pv.body, bag, list, function (c) { return c.id }, function () {
        return primordiumRow()
      }, s)
      pv.setCount(list.length)
      if (list.length) pv.unempty()
      else pv.empty(STR.noPrimordia)

      // The strip is a picture of two numbers the player has bought: how wet it has been, and how
      // wet it is going to be for as far ahead as the forecast reaches. Both are said in words
      // here, because the canvas carries nothing that is not also text on the same screen.
      var st = fl.strip ? fl.strip() : null
      var hzn = st ? num(st.horizon) : 0
      show(key, !!st)
      show(keySoon, hzn > 0)
      setText(keySoon, hzn > 0 ? STR.keySoon + ' ' + C().fmtTime(hzn) : '')
      setAttr(fore, 'aria-label', st
        ? STR.moisture + ' ' + num(st.hist[st.hist.length - 1]).toFixed(2) +
          (hzn > 0 ? ', ' + STR.forecast + ' ' + C().fmtTime(hzn) : ', ' + STR.forecastNone)
        : STR.forecastNone)
    }
    p.view = pv
    return pv
  }

  // ── THE PACT BOOK ──────────────────────────────────────────────────────────

  function pactRow () {
    var r = row({ expand: true })
    var l0 = r.line()
    var name = span(l0, 'row-name', '')
    var guild = span(l0, 'row-sub', '')
    var rateN = slot('row-num')
    l0.appendChild(rateN)
    var chLine = r.line()
    span(chLine, 'row-sub', STR.channels)
    var pips = meter('pips', 0)
    chLine.appendChild(pips)
    // Strain is the number that ends a pact, so it gets a real meter and a real percentage. The
    // ascii bar 06 §5.6(c) licenses is for stand rows and band rows — twenty grey block glyphs at
    // 13 px read as texture, and texture is the wrong instrument for the one figure on the row
    // that is counting down to a default.
    var sLine = r.line()
    span(sLine, 'row-sub', STR.strain)
    var strain = meter('fill', 0)
    strain.classList.add('meter--grow')
    sLine.appendChild(strain)
    var strainN = slot('row-num')
    sLine.appendChild(strainN)

    var ex = r.expander()
    var bondLine = el('div', 'row-line')
    span(bondLine, 'row-sub', STR.bond)
    var bondN = slot('row-num')
    bondLine.appendChild(bondN)
    ex.appendChild(bondLine)
    var termLine = el('div', 'row-line')
    var termTxt = span(termLine, 'row-sub', '')
    ex.appendChild(termLine)
    var acts = el('div', 'row-actions')
    acts.appendChild(actionButton(STR.comply, function (b) {
      var pb = HY.pactbook
      if (!pb || !commit(function () { return pb.comply(api.id) })) refuse(b)
    }))
    acts.appendChild(actionButton(STR.renew, function (b) {
      var pb = HY.pactbook
      if (!pb || !commit(function () { return pb.renew(api.id) })) refuse(b)
    }))
    acts.appendChild(actionButton(STR.sever, function (b) {
      var pb = HY.pactbook
      if (!pb || !commit(function () { return pb.sever(api.id) })) refuse(b)
    }))
    ex.appendChild(acts)

    var api = {
      el: r.el,
      id: -1,
      sync: function (s, c) {
        api.id = c.id
        setText(name, c.name)
        setText(guild, c.guild + (c.notice ? ' · notice' : ''))
        setSlot(rateN, c.rateText || C().fmt(c.rate), '')
        pips.set(c.chMax > 0 ? c.ch / c.chMax : 0, '', c.ch + ' of ' + c.chMax + ' ' + STR.channels)
        strain.set(c.strain, c.warn ? 'warn' : 'signal', STR.strain + ' ' + pct(c.strain))
        setSlot(strainN, pct(c.strain), '')
        setData(strainN, 'tone', c.warn ? 'warn' : '')
        setData(r.el, 'live', c.warn ? 'warn' : '1')
        setSlot(bondN, c.bond.toFixed(2), '×' + c.bondMult.toFixed(2))
        setText(termTxt, interp(STR.termLeft, { v: secs(c.termLeft) }))
        r.label(c.name + ', ' + c.guild + ', ' + STR.strain + ' ' + pct(c.strain))
      }
    }
    return api
  }

  function offerRow () {
    var r = row({ expand: true })
    var l0 = r.line()
    var name = span(l0, 'row-name', '')
    var guild = span(l0, 'row-sub', '')
    var stake = slot('row-num')
    l0.appendChild(stake)
    var l1 = r.line()
    var terms = span(l1, 'row-sub', '')
    var ex = r.expander()

    // An offer is negotiable, and until now nothing said so: pactbook has carried setOfferChannels
    // and setOfferTerm since it was written and the panel called neither, so every pact in the game
    // was signed on whatever the generator happened to roll. Both are sliders, because both move
    // the stake continuously and the stake is the number the decision is actually about.
    var chDial = slider({
      label: STR.channels,
      steps: 1,
      tone: 'signal',
      onInput: function (n) {
        var pb = HY.pactbook
        if (pb && pb.setOfferChannels) pb.setOfferChannels(api.id, n)
      }
    })
    var termDial = slider({
      label: STR.offerTerm,
      steps: 1,
      tone: 'signal',
      onInput: function (n) {
        var pb = HY.pactbook
        if (pb && pb.setOfferTerm) pb.setOfferTerm(api.id, n)
      }
    })
    ex.appendChild(chDial)
    ex.appendChild(termDial)
    var rootSeg = el('div', 'row-line')
    ex.appendChild(rootSeg)
    var rootCtl = null

    var acts = el('div', 'row-actions')
    acts.appendChild(actionButton(STR.sign, function (b) {
      var pb = HY.pactbook
      if (!pb || !commit(function () { return pb.sign(api.id) })) refuse(b)
    }))
    acts.appendChild(actionButton(STR.decline, function () {
      var pb = HY.pactbook
      if (pb && pb.declineOffer) pb.declineOffer(api.id)
    }))
    ex.appendChild(acts)
    var api = {
      el: r.el,
      id: -1,
      sync: function (s, o) {
        api.id = o.id
        setText(name, o.name)
        setText(guild, o.guild)
        setSlot(stake, C().fmtMass(o.stake), '')
        setText(terms, interp(STR.channelsOf, { n: o.ch, k: o.chMax }) + ' ' + STR.channels +
          ' · ' + interp(STR.seasons, { n: o.termPeriods }) + ' · ' + secs(o.left))
        setData(r.el, 's', o.affordable ? 'afford' : 'want')
        chDial.setMax(Math.max(1, o.chMax))
        if (!chDial.__seeded) { chDial.__seeded = 1; chDial.setValue(o.ch) }
        chDial.setReadout(String(o.ch), '', STR.channels + ' ' + o.ch)
        termDial.setMax(Math.max(1, o.maxTerm))
        if (!termDial.__seeded) { termDial.__seeded = 1; termDial.setValue(o.termPeriods) }
        termDial.setReadout(String(o.termPeriods), '',
          interp(STR.seasons, { n: o.termPeriods }))
        // Both dials move the same number, so that number is printed once, under the pair.
        termDial.setNote(STR.collateral + ' ' + C().fmtMass(o.stake))
        if (o.rootTypes && !rootCtl) {
          rootCtl = seg(o.rootTypes.map(function (t) { return { label: t, value: t } }),
            o.rootType, function (val) {
              var pb = HY.pactbook
              // The offer carries labels; setOfferType matches on the key, and the two differ only
              // in case (05 §4.1's ROOT_TYPES).
              if (pb && pb.setOfferType) pb.setOfferType(api.id, String(val).toUpperCase())
            })
          span(rootSeg, 'row-sub', STR.rootType)
          rootSeg.appendChild(rootCtl)
        }
        show(rootSeg, !!o.rootTypes)
        r.label(o.aria)
      }
    }
    return api
  }

  function buildPact (v, p) {
    var pv = panel('pact', { title: STR.p_pact })
    var head = row({})
    var chN = statLine(head, STR.channels)
    var accN = statLine(head, STR.accord)
    var costN = statLine(head, STR.bookCost)
    pv.body.appendChild(head.el)
    var bag = {}
    p.__sync = function (s) {
      var pb = HY.pactbook
      if (!pb || !pb.list) return
      var h = pb.header()
      if (h) {
        setSlot(chN, h.channels + ' / ' + h.channelCap, '')
        setSlot(accN, C().fmt(h.accord), GLYPH.accord)
        setSlot(costN, C().fmt(h.cost), 'g/s')
      }
      var list = pb.list()
      reconcile(pv.body, bag, list, function (c) { return c.id }, function () {
        return pactRow()
      }, s)
      pv.setCount(list.length)
      if (list.length) pv.unempty()
      else pv.empty(STR.noPacts)
    }
    p.view = pv
    return pv
  }

  function buildOffers (v, p) {
    var pv = panel('offers', { title: STR.p_offers })
    var bag = {}
    p.__sync = function (s) {
      var pb = HY.pactbook
      if (!pb || !pb.offers) return
      var list = pb.offers()
      reconcile(pv.body, bag, list, function (o) { return o.id }, function () {
        return offerRow()
      }, s)
      pv.setCount(list.length)
      if (list.length) pv.unempty()
      else pv.empty(STR.noOffers)
    }
    p.view = pv
    return pv
  }

  // ── THE LOG ────────────────────────────────────────────────────────────────

  function buildLog (v, p) {
    var pv = panel('log', { title: STR.p_log })
    var host = el('div', 'logring')
    pv.body.appendChild(host)
    var lastN = -1
    p.__sync = function (s) {
      var ring = s.log && s.log.ring ? s.log.ring : []
      if (ring.length === lastN) return
      lastN = ring.length
      clear(host)
      // Newest first: the console below reads bottom-up, and a player opening the tab is looking
      // for the line that just went past, not the one from an hour ago.
      // The ring stores one tone character and then the text; log.js owns the encoding and the
      // console strips it the same way.
      for (var i = ring.length - 1; i >= 0; i--) {
        host.appendChild(el('p', 'logline', String(ring[i]).slice(1)))
      }
      pv.setCount(ring.length)
    }
    p.view = pv
    return pv
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT III PANELS
  //
  // The act is eight biomes, then thirteen bands, eight loci, six causes of death, a book of
  // defectors and a wheel. Every one of those is a *list of the same shape*, so every one of them
  // is a `.row` with a name, one leading figure, and the bars underneath — the same component Act
  // I introduced on the litter floor. Nothing new was invented for the last act; what changed is
  // what the rows are about.
  //
  // Two rules hold everywhere below. First: no bare number. Every figure arrives through statLine
  // or a slot with a unit and a label beside it. Second: the leading figure on a row is the number
  // the row is asking a question about — SURPLUS on a band, mass on a locus, survivors on a strain
  // — because a row whose big number is not its decision is a row that has to be read twice.
  // ═══════════════════════════════════════════════════════════════════════════

  function BL () { return HY.bloom }
  function DV () { return HY.divergence }
  function FIN () { return HY.finale }

  function signed (v) { return (v >= 0 ? '+' : '−') + C().fmt(Math.abs(v)) }

  // A one-line caption under a canvas or a control. It is the text form of whatever the picture
  // says (06 §7.9) and it never says "tap".
  function note (host, text) {
    var n = el('p', 'note', text)
    host.appendChild(n)
    return n
  }

  // statLine and barLine take a `row`, because that is what they were written against. An expander
  // is the same list of lines with a different parent, so it is handed the same one-method shape
  // rather than either helper gaining a second signature.
  function lines (host) {
    return { line: function () { var d = el('div', 'row-line'); host.appendChild(d); return d } }
  }

  // The plate is the act's field, and in Act III the field has two shapes. drawVoid wants
  // { e, n, ncap }; the canopy's eight biomes are the same three quantities under other names, so
  // the same thirteen-arc renderer draws them and the player sees one instrument all act.
  function a3Field (s) {
    if (!s.a3) return null
    if (s.phase === 'canopy') {
      var bi = s.a3.biomes
      var e = [], n = [], cap = [], i, max = 1
      for (i = 0; i < bi.n.length; i++) if (num(bi.n[i]) > max) max = num(bi.n[i])
      for (i = 0; i < bi.n.length; i++) {
        e.push(bi.reached[i] ? 1 : 0)
        n.push(num(bi.n[i]))
        cap.push(max)
      }
      return { e: e, n: n, ncap: cap }
    }
    return s.a3.bands
  }

  // ── THE CANOPY ─────────────────────────────────────────────────────────────

  function biomeRow () {
    var r = row({ expand: true })
    var l0 = r.line()
    var name = span(l0, 'row-name', '')
    var tag = span(l0, 'row-tag', '')
    var craftN = slot('row-num')
    l0.appendChild(craftN)

    var l1 = r.line()
    var state = span(l1, 'row-sub', '')

    var occLab = span(r.line(), 'row-sub', STR.occupancy)
    var occ = meter('ascii', 0)
    occLab.parentNode.appendChild(occ)

    var ex = r.expander()
    var exw = lines(ex)
    var sur = statLine(exw, STR.surplus)
    var res = statLine(exw, STR.resource)
    var acts = el('div', 'row-actions')
    ex.appendChild(acts)
    var reachBtn = actionButton(STR.reach, function (b) {
      var bl = BL()
      if (!bl || !commit(function () { return bl.reach(api.id) })) refuse(b)
    })
    acts.appendChild(reachBtn)

    var api = {
      el: r.el,
      id: -1,
      sync: function (s, c) {
        api.id = c.id
        var bl = BL()
        setText(name, c.name)
        var can = !!(bl && bl.canReach && bl.canReach(s, c.id))
        var cost = bl && bl.reachCost ? num(bl.reachCost(s)) : 0
        setText(tag, c.reached ? STR.reached : (can ? C().fmt(cost) + ' ' + GLYPH.signal : ''))
        setData(tag, 'tone', c.reached ? 'signal' : '')
        show(tag, !!tag.textContent)
        setSlot(craftN, C().fmt(c.n), '')
        setText(state, c.reached
          ? STR.harvest + ' ' + C().fmt(c.harvest) + ' ' + GLYPH.carbon + '/s'
          : (can ? STR.unreached : STR.needsFirst))
        var f = c.NCAP > 0 ? c.n / c.NCAP : 0
        occ.set(f, '', STR.occupancy + ' ' + pct(f))
        setSlot(sur, signed(c.surplus), GLYPH.carbon + '/s')
        setData(sur, 'tone', c.surplus >= 0 ? 'pos' : 'neg')
        setSlot(res, C().fmt(c.X), GLYPH.carbon)
        show(reachBtn, !c.reached)
        setData(reachBtn, 's', can && num(s.res.signal) >= cost ? 'afford' : 'want')
        setData(r.el, 'live', c.reached ? '1' : '0')
        r.label(c.name + ', ' + (c.reached ? STR.reached : STR.unreached) + ', ' +
          C().fmt(c.n) + ' craft, ' + STR.surplus + ' ' + signed(c.surplus))
      }
    }
    return api
  }

  function buildCanopy (v, p) {
    var pv = panel('canopy', { title: STR.p_canopy })
    var head = row({})
    var craftN = statLine(head, STR.craft)
    var sporeN = statLine(head, STR.spores)
    var lamN = statLine(head, STR.surplus)
    pv.body.appendChild(head.el)
    note(pv.body, STR.canopyNote)

    var bag = {}
    p.__sync = function (s) {
      var bl = BL()
      if (!bl || !bl.list) return
      setSlot(craftN, C().fmt(num(bl.totalCraft(s))), '')
      setSlot(sporeN, C().fmt(num(s.res.spores)), GLYPH.spores)
      var lam = num(bl.Lambda(s))
      setSlot(lamN, signed(lam), GLYPH.carbon + '/s')
      setData(lamN, 'tone', lam >= 0 ? 'pos' : 'neg')
      reconcile(pv.body, bag, bl.list(s), function (c) { return c.id }, biomeRow, s)
      pv.setCount(C().fmt(num(bl.totalCraft(s))))
    }
    p.view = pv
    return pv
  }

  // ── THE VOID ───────────────────────────────────────────────────────────────

  function bandRow () {
    var r = row({ expand: true })
    // Three lines, ~100 px collapsed. 03 §23.3 draws four, but the fourth was `X` and `λ` — two
    // figures that only matter once you are already reading the band closely, which is what the
    // expander is for. The three that survive are the three every scan is made of.
    var l0 = r.line()
    var name = span(l0, 'row-name', '')
    var tag = span(l0, 'row-tag', '')
    // SURPLUS is the most important number in the act (03 §23.3), so it is the row's lead figure,
    // it is named in the same line rather than captioned under it, and it is on every row whether
    // the band is doing well or not.
    span(l0, 'row-sub', STR.surplus)
    var surN = slot('row-num')
    l0.appendChild(surN)

    var l1 = r.line()
    span(l1, 'row-sub', STR.occupancy)
    var occ = meter('fill', 0)
    occ.classList.add('meter--grow')
    l1.appendChild(occ)
    var occN = slot('row-num')
    l1.appendChild(occN)

    var l2 = r.line()
    var expTxt = span(l2, 'row-sub', '')
    var richTxt = span(l2, 'row-sub', STR.richness)
    var richN = slot('row-num')
    l2.appendChild(richN)
    void richTxt   // the caption is static; the slot beside it is what moves

    var ex = r.expander()
    var wrap = lines(ex)
    var resN = statLine(wrap, STR.resource)
    var harvN = statLine(wrap, STR.harvest)
    var subN = statLine(wrap, STR.subsist)
    var wildN = statLine(wrap, STR.wild)
    var starN = statLine(wrap, STR.nStar)

    var api = {
      el: r.el,
      id: -1,
      sync: function (s, c) {
        api.id = c.id
        setText(name, interp(STR.band, { n: c.id < 10 ? '0' + c.id : String(c.id) }))
        setSlot(surN, signed(c.surplus), GLYPH.carbon + '/s')
        setData(surN, 'tone', c.surplus > 0 ? 'pos' : (c.surplus < 0 ? 'neg' : ''))
        var f = c.NCAP > 0 ? c.n / c.NCAP : 0
        setSlot(occN, C().fmt(c.n), '')
        // The tick is `n*`, and it only appears once H4 has been bought: the act's best question
        // is "how many craft is the right number", and selling the answer early would end it.
        occ.set(f, c.surplus < 0 ? 'warn' : 'signal',
          C().fmt(c.n) + ' of ' + C().fmt(c.NCAP) + ' ' + STR.occupancy,
          c.showStar && c.NCAP > 0 ? c.nStar / c.NCAP : undefined)
        setText(expTxt, STR.explored + ' ' + pct(c.e))
        setSlot(richN, c.richKnown ? c.rich.toFixed(2) : STR.nothing, '×')
        var wildHere = num(c.wild)
        setText(tag, wildHere > 0 ? STR.wild : '')
        setData(tag, 'tone', wildHere > c.n ? 'neg' : 'warn')
        show(tag, wildHere > 0)
        setData(r.el, 'live', c.surplus < 0 ? 'warn' : (c.n > 0 ? '1' : '0'))
        setSlot(resN, C().fmt(c.X), GLYPH.carbon)
        setSlot(harvN, C().fmt(c.harvest), GLYPH.carbon + '/s')
        setSlot(subN, C().fmt(c.subsist), GLYPH.carbon + '/s')
        setSlot(wildN, C().fmt(wildHere), '')
        setSlot(starN, c.showStar ? C().fmt(c.nStar) : STR.nothing, '')
        r.label(interp(STR.band, { n: c.id }) + ', ' + STR.surplus + ' ' + signed(c.surplus) +
          ' carbon per second, ' + C().fmt(c.n) + ' craft of ' + C().fmt(c.NCAP) + ', ' +
          STR.explored + ' ' + pct(c.e))
      }
    }
    return api
  }

  function buildVoid (v, p) {
    var pv = panel('void', { title: STR.p_void })
    var head = row({})
    var occN = statLine(head, STR.p_bands)
    var craftN = statLine(head, STR.craft)
    var lamN = statLine(head, STR.surplus)
    var warnTxt = span(head.line(), 'row-sub', '')
    setData(warnTxt, 'tone', 'cost')
    pv.body.appendChild(head.el)
    note(pv.body, STR.voidKey)

    var bag = {}
    p.__sync = function (s) {
      var bl = BL()
      if (!bl || !bl.list) return
      var list = bl.list(s)
      var occ = 0, i
      for (i = 0; i < list.length; i++) if (list[i].n > 0) occ += 1
      setSlot(occN, occ + ' / ' + list.length, '')
      setSlot(craftN, C().fmt(num(bl.totalCraft(s))), '')
      var lam = num(bl.Lambda(s))
      setSlot(lamN, signed(lam), GLYPH.carbon + '/s')
      setData(lamN, 'tone', lam >= 0 ? 'pos' : 'neg')
      // A stellar warning is the one thing in the act that is about to happen rather than
      // happening, so it gets the header's only sentence.
      var w = bl.stellarWarnings ? bl.stellarWarnings() : []
      setText(warnTxt, w.length
        ? interp(STR.stellar, { v: secs(w[0].inS) }) + ' · ' +
          interp(STR.band, { n: w[0].band })
        : '')
      show(warnTxt, w.length > 0)
      reconcile(pv.body, bag, list, function (c) { return c.id }, bandRow, s)
      pv.setCount(occ + ' / ' + list.length)
    }
    p.view = pv
    return pv
  }

  // ── SYNCHRONY ──────────────────────────────────────────────────────────────

  function buildSynchrony (v, p) {
    var pv = panel('synchrony', { title: STR.p_synchrony })
    var cv = el('canvas', 'wheel-canvas')
    cv.id = 'wheel'
    cv.setAttribute('role', 'img')
    cv.setAttribute('aria-label', '')
    pv.body.appendChild(cv)
    v.wheel = cv
    var head = row({})
    var ups = statLine(head, STR.upsilon)
    var upsBar = barLine(head, null)
    var worst = span(head.line(), 'row-sub', '')
    pv.body.appendChild(head.el)
    note(pv.body, STR.wheelKey + ' ' + STR.entrainNote)

    p.__sync = function (s) {
      var fin = FIN()
      if (!fin || !fin.wheel) return
      var w = fin.wheel(s)
      if (!w) return
      setSlot(ups, w.upsilon.toFixed(3), GLYPH.upsilon)
      // The ring on the canvas is ENDING A's threshold; the bar carries it as a tick so the same
      // fact survives a greyscale screenshot and a screen reader.
      upsBar.set(w.upsilon, w.upsilon >= w.ring ? 'signal' : 'warn',
        STR.upsilon + ' ' + w.upsilon.toFixed(3) + ' of ' + w.ring.toFixed(2), w.ring)
      // 03 §23.5: the wheel is completable from text alone. The band furthest from the resultant
      // is the only one the player can act on, so it is the one named.
      var i, bx = 0, by = 0, m
      for (i = 0; i < w.phases.length; i++) {
        m = w.mass && w.mass[i] > 0 ? w.mass[i] : 0
        bx += Math.cos(2 * Math.PI * w.phases[i]) * m
        by += Math.sin(2 * Math.PI * w.phases[i]) * m
      }
      var mean = Math.atan2(by, bx) / (2 * Math.PI)
      var far = -1, fd = -1
      for (i = 0; i < w.phases.length; i++) {
        if (!(w.mass && w.mass[i] > 0)) continue
        var d = Math.abs(((w.phases[i] - mean) % 1 + 1.5) % 1 - 0.5)
        if (d > fd) { fd = d; far = i }
      }
      setText(worst, far >= 0
        ? interp(STR.band, { n: far }) + ' · ' + fd.toFixed(2) + ' ' + STR.phase
        : '')
      show(worst, far >= 0)
      setAttr(cv, 'aria-label', STR.upsilon + ' ' + w.upsilon.toFixed(3) + '. ' +
        (far >= 0 ? interp(STR.band, { n: far }) + ' is ' + fd.toFixed(2) + ' turns from the rest.'
          : ''))
      pv.setCount(w.upsilon.toFixed(2))
    }
    p.view = pv
    return pv
  }

  // ── THE ENDINGS ────────────────────────────────────────────────────────────

  function condRow (host) {
    var n = el('div', 'cond')
    var mark = span(n, 'cond-mark', '·')
    var lab = span(n, '', '')
    var val = slot('cond-num')
    n.appendChild(val)
    host.appendChild(n)
    return {
      el: n,
      set: function (c) {
        setData(n, 'met', c.ok ? '1' : '0')
        setText(mark, c.ok ? '✓' : '·')
        setText(lab, String(c.label).toLowerCase())
        // A condition is a pair, always: what you have and what it wants. One of the two alone is
        // a number with nothing to compare it to.
        setSlot(val, C().fmt(c.have) + ' / ' + C().fmt(c.want), '')
      }
    }
  }

  function endingCard () {
    var n = btn('card card--end hold')
    n.appendChild(el('span', 'hold-fill'))
    var top = el('div', 'card-top')
    var title = el('span', 'card-title', '')
    var state = el('span', 'card-cost num', '')
    top.appendChild(title)
    top.appendChild(state)
    n.appendChild(top)
    var conds = el('div', 'card-conds')
    n.appendChild(conds)
    var rows = []
    var api = {
      el: n,
      key: '',
      sync: function (s, e) {
        api.key = e.key
        setText(title, e.title)
        setText(state, e.taken ? STR.endTaken
          : (e.available ? STR.endTake : interp(STR.endShort, { n: e.unmet.length })))
        n.dataset.s = e.taken ? 'unbuyable' : (e.available ? 'afford' : 'want')
        setAttr(n, 'aria-disabled', e.available && !e.taken ? 'false' : 'true')
        var i
        for (i = 0; i < e.conditions.length; i++) {
          if (!rows[i]) rows.push(condRow(conds))
          rows[i].set(e.conditions[i])
        }
        for (i = e.conditions.length; i < rows.length; i++) show(rows[i].el, false)
        setAttr(n, 'aria-label', e.title + ', ' +
          (e.taken ? STR.endTaken
            : e.available ? STR.endTake
              : interp(STR.endShort, { n: e.unmet.length })))
      }
    }
    // An ending is the most irreversible thing in the game, so it is the 400 ms hold and not a tap
    // (06 §5.5's destructive commit, used here for its fourth and last time).
    bindHold(n, function () {
      var fin = FIN()
      if (fin && fin.takeEnding) fin.takeEnding(api.key)
    })
    return api
  }

  function buildEndings (v, p) {
    var pv = panel('endings', { title: STR.p_endings })
    var bag = {}
    p.__sync = function (s) {
      var fin = FIN()
      if (!fin || !fin.endings) return
      var list = fin.endings(s)
      reconcile(pv.body, bag, list, function (e) { return e.key }, endingCard, s)
      var i, ready = 0
      for (i = 0; i < list.length; i++) if (list[i].available) ready += 1
      pv.setCount(ready > 0 ? String(ready) : '')
    }
    p.view = pv
    return pv
  }

  // ── THE GENOME ─────────────────────────────────────────────────────────────

  function axisRow (key, idx) {
    var r = row({})
    var l0 = r.line()
    span(l0, 'row-name', key.toLowerCase())
    var countN = slot('row-num')
    l0.appendChild(countN)
    var st = el('div', 'stepper')
    var minus = btn('', '−')
    var plus = btn('', '+')
    setAttr(minus, 'aria-label', 'lower ' + AXIS_NAME[key])
    setAttr(plus, 'aria-label', 'raise ' + AXIS_NAME[key])
    st.appendChild(minus)
    st.appendChild(plus)
    l0.appendChild(st)
    // The full word, and one line saying what the axis does to the fleet. Three letters and a
    // number is a spreadsheet of a genome, which is the one thing this panel must not be.
    span(r.line(), 'row-sub', AXIS_NAME[key])
    r.el.appendChild(el('p', 'row-note', AXIS_NOTE[key]))

    function step (d) {
      var s = liveState()
      var bl = BL()
      if (!s || !bl) return false
      return commit(function () { return bl.setLocus(idx, num(s.a3.loci[idx]) + d) })
    }
    bindPress(plus, function () { if (!step(1)) refuse(plus) }, { onUp: true })
    bindPress(minus, function () { if (!step(-1)) refuse(minus) }, { onUp: true })

    return {
      el: r.el,
      sync: function (s) {
        var bl = BL()
        var have = num(s.a3.loci[idx])
        setSlot(countN, String(have), '')
        // Lowering a locus is legal only inside a REGENOME window (03 §9.4), so the minus is a
        // live control for exactly as long as that window lasts and a refusal the rest of the time.
        var canDown = !!(bl && bl.rewriting && bl.rewriting(s)) && have > 0
        var cost = bl && bl.nextLocusCost ? num(bl.nextLocusCost(s)) : Infinity
        setData(minus, 's', canDown ? 'afford' : 'want')
        setData(plus, 's', num(s.res.insight) >= cost ? 'afford' : 'want')
        setData(r.el, 'live', have > 0 ? '1' : '0')
      }
    }
  }

  function buildGenome (v, p) {
    var pv = panel('genome', { title: STR.p_genome })
    var head = row({})
    var lenN = statLine(head, STR.genomeLen)
    var massN = statLine(head, STR.craftMass)
    var fidN = statLine(head, STR.fidelity)
    var fidBar = barLine(head, null)
    var costN = statLine(head, STR.lociCost)
    pv.body.appendChild(head.el)
    note(pv.body, STR.genomeNote)

    var rows = []
    var axes = (HY.bloom && HY.bloom.AXES) || []
    var i
    for (i = 0; i < axes.length; i++) {
      rows.push(axisRow(axes[i], i))
      pv.body.appendChild(rows[i].el)
    }

    var foot = row({})
    var capN = statLine(foot, STR.p_loci)
    var acts = el('div', 'row-actions')
    var capBtn = actionButton(STR.raiseCap, function (b) {
      var dv = DV()
      if (!dv || !commit(function () { return dv.raiseLociCap() })) refuse(b)
    })
    var regenBtn = btn('act-btn hold')
    regenBtn.appendChild(el('span', 'hold-fill'))
    regenBtn.appendChild(el('span', 'hold-lab', STR.regenome))
    bindHold(regenBtn, function () {
      var bl = BL()
      if (bl) commit(function () { return bl.regenome() })
    })
    acts.appendChild(capBtn)
    acts.appendChild(regenBtn)
    foot.line().appendChild(acts)
    var regenNote = span(foot.line(), 'row-sub', STR.regenomeNote)
    setData(regenNote, 'tone', 'cost')
    pv.body.appendChild(foot.el)

    p.__sync = function (s) {
      var bl = BL()
      var dv = DV()
      if (!bl) return
      var len = num(bl.genomeLength(s))
      setSlot(lenN, String(len), '')
      setSlot(massN, C().fmt(num(bl.craftMass(s))), '')
      var fid = num(bl.effFid(s))
      setSlot(fidN, fid.toFixed(3), '')
      fidBar.set(fid, fid < 0.9 ? 'warn' : 'signal', STR.fidelity + ' ' + fid.toFixed(3))
      var cost = num(bl.nextLocusCost(s))
      setSlot(costN, C().fmt(cost), GLYPH.insight)
      setSlot(capN, num(s.a3.lociBought) + ' / ' + num(s.a3.lociCap), '')
      var capCost = dv && dv.capCost ? num(dv.capCost(s)) : Infinity
      setText(capBtn, STR.raiseCap + ' · ' + C().fmt(capCost) + ' ' + GLYPH.alleles)
      setData(capBtn, 's', num(s.res.alleles) >= capCost ? 'afford' : 'want')
      var rw = !!bl.rewriting(s)
      setText(regenBtn.lastChild, rw
        ? interp(STR.rewriting, { v: secs(num(s.a3.regenomeAt) - num(s.t)) })
        : STR.regenome + ' · ' + C().fmt(num(bl.regenomeCost(s))) + ' ' + GLYPH.carbon)
      setData(regenBtn, 's', !rw && num(s.res.carbon) >= num(bl.regenomeCost(s))
        ? 'afford' : 'want')
      for (var k = 0; k < rows.length; k++) rows[k].sync(s)
      pv.setCount(String(len))
    }
    p.view = pv
    return pv
  }

  // ── THE FLEET: the triangle, and what kills you ────────────────────────────

  function buildFleet (v, p) {
    var pv = panel('fleet', { title: STR.p_fleet })
    var head = row({})
    var harvN = statLine(head, STR.harvest)
    var subN = statLine(head, STR.subsist)
    var surN = statLine(head, STR.surplus)
    pv.body.appendChild(head.el)

    // 03 §8 is a triangle and a triangle on a phone is three sliders that renormalise: the
    // barycentric pad is a beautiful control that cannot be operated with a thumb, and every one
    // of the three numbers has to be readable while the other two move.
    var body = el('div', 'row')
    var bars = [null, null, null]
    var labels = [STR.replicate, STR.disperse, STR.bank]
    function push () {
      var s = liveState()
      var bl = BL()
      if (!s || !bl) return
      bl.setAlloc(bars[0].value(), bars[1].value(), bars[2].value())
      s.stats.reallocations = num(s.stats.reallocations) + 1
    }
    var i
    for (i = 0; i < 3; i++) {
      bars[i] = slider({ label: labels[i], steps: U.ALLOC_STEPS, tone: 'signal', onInput: push })
      body.appendChild(bars[i])
    }
    pv.body.appendChild(body)
    note(pv.body, STR.allocNote)

    var seeded = false
    p.__sync = function (s) {
      var bl = BL()
      if (!bl) return
      var a = bl.alloc(s)
      var h = 0, sub = 0, k
      var list = bl.list(s)
      for (k = 0; k < list.length; k++) { h += num(list[k].harvest); sub += num(list[k].subsist) }
      setSlot(harvN, C().fmt(h), GLYPH.carbon + '/s')
      setSlot(subN, C().fmt(sub), GLYPH.carbon + '/s')
      setSlot(surN, signed(h - sub), GLYPH.carbon + '/s')
      setData(surN, 'tone', h - sub >= 0 ? 'pos' : 'neg')
      if (!seeded) {
        seeded = true
        for (k = 0; k < 3; k++) bars[k].setValue(Math.round(a[k] * U.ALLOC_STEPS))
      }
      // The readout is the normalised share, not the raw slider step: three sliders of twenty are
      // a ratio, and printing the step would print a number the simulation never sees.
      for (k = 0; k < 3; k++) {
        bars[k].setReadout(pct(a[k]), '', labels[k] + ' ' + pct(a[k]))
      }
      bars[0].setNote(C().fmt((h - sub) * a[0]) + ' ' + GLYPH.carbon + '/s ' + STR.replicate)
      bars[1].setNote(C().fmt((h - sub) * a[1]) + ' ' + GLYPH.carbon + '/s ' + STR.disperse)
      bars[2].setNote(C().fmt((h - sub) * a[2]) + ' ' + GLYPH.carbon + '/s ' + STR.bank)
      pv.setCount(pct(a[0]) + ' / ' + pct(a[1]) + ' / ' + pct(a[2]))
    }
    p.view = pv
    return pv
  }

  // One block per cause: the name and the two numbers on one line, the bar under them, and 03
  // §11.7's sentence under that — but only for the causes that are actually killing something.
  // Interleaving six labels with six explanations gave twelve lines with no visual hierarchy, and
  // the count on a cause with no deaths was a `0.00` competing for attention with the one that had
  // just taken a tenth of the fleet.
  function causeBlock (host, hazard) {
    var l = el('div', 'row-line')
    span(l, 'row-sub', hazard.name.toLowerCase())
    var n = slot('row-num')
    var share = slot('row-num')
    share.style.minWidth = '4ch'
    l.appendChild(n)
    l.appendChild(share)
    host.appendChild(l)
    var bl = el('div', 'row-line')
    var bar = meter('ascii', 0)
    bl.appendChild(bar)
    host.appendChild(bl)
    var q = el('p', 'row-note', hazard.line)
    host.appendChild(q)
    return {
      name: hazard.name,
      set: function (r) {
        bar.set(r.frac, r.frac > 0.4 ? 'warn' : '', hazard.name.toLowerCase() + ' ' + pct(r.frac))
        setSlot(n, r.count > 0 ? C().fmt(r.count) : STR.nothing, '')
        setSlot(share, r.count > 0 ? pct(r.frac) : '', '')
        setData(share, 'tone', r.frac > 0.4 ? 'warn' : '')
        show(q, r.count > 0)
      }
    }
  }

  function buildMortality (v, p) {
    var pv = panel('mortality', { title: STR.p_mortality })
    var rows = []
    var body = el('div', 'row')
    pv.body.appendChild(body)
    var hazards = (HY.bloom && HY.bloom.HAZARD_CARD) || []
    for (var i = 0; i < hazards.length; i++) rows.push(causeBlock(body, hazards[i]))
    p.__sync = function (s) {
      var bl = BL()
      if (!bl || !bl.mortality) return
      var m = bl.mortality(s)
      // The header carries the window, not the total: a total over six causes says nothing, and
      // "deaths, last 2:00" is the sentence that makes all six of them readable.
      pv.setCount(m.total > 0 ? interp(STR.deaths, { v: C().fmtTime(m.window) }) : '')
      for (var k = 0; k < rows.length && k < m.rows.length; k++) rows[k].set(m.rows[k])
      show(body, m.total > 0)
      if (m.total > 0) pv.unempty()
      else pv.empty(STR.noDeaths)
    }
    p.view = pv
    return pv
  }

  // ── LINEAGES ───────────────────────────────────────────────────────────────

  function strainRow () {
    var r = row({ expand: true })
    var l0 = r.line()
    var name = span(l0, 'row-name', '')
    var tag = span(l0, 'row-tag', '')
    var massN = slot('row-num')
    l0.appendChild(massN)
    var l1 = r.line()
    var where = span(l1, 'row-sub', '')
    var predTxt = el('p', 'row-note', '')
    r.el.appendChild(predTxt)

    var ex = r.expander()
    // The commit fraction is the whole of 03 §14.2: the square law makes 0.6 of a fleet worth 0.36
    // of it, so the size of the bet is the decision and the button is only the confirmation.
    var stake = slider({ label: STR.commit, steps: U.SLIDER_STEPS, tone: 'signal',
      value: U.COMMIT_DEFAULT })
    ex.appendChild(stake)
    var acts = el('div', 'row-actions')
    ex.appendChild(acts)
    var seqBtn = actionButton(STR.sequence, function (b) {
      var dv = DV()
      if (!dv || !commit(function () { return dv.sequence(api.id) })) refuse(b)
    })
    var engBtn = actionButton(STR.engage, function (b) {
      var dv = DV()
      if (!dv || !commit(function () { return dv.engage(api.id, stake.value() / U.SLIDER_STEPS) })) {
        refuse(b)
      }
    })
    var reinBtn = actionButton(STR.reinforce, function (b) {
      var dv = DV()
      if (!dv || !commit(function () { return dv.reinforce(api.id) })) refuse(b)
    })
    var wdBtn = actionButton(STR.withdraw, function (b) {
      var dv = DV()
      if (!dv || !commit(function () { return dv.withdraw(api.id) })) refuse(b)
    })
    var absBtn = actionButton(STR.absorb, function (b) {
      var dv = DV()
      if (!dv || !commit(function () { return dv.absorb(api.id) })) refuse(b)
    })
    var qtBtn = actionButton(STR.quarantine, function (b) {
      var dv = DV()
      if (!dv || !commit(function () { return dv.quarantine(api.id) })) refuse(b)
    })
    acts.appendChild(seqBtn)
    acts.appendChild(engBtn)
    acts.appendChild(reinBtn)
    acts.appendChild(wdBtn)
    acts.appendChild(absBtn)
    acts.appendChild(qtBtn)

    var api = {
      el: r.el,
      id: -1,
      sync: function (s, e) {
        api.id = e.id
        var dv = DV()
        var succ = s.a3 && s.a3.succ === e
        setText(name, e.name || STR.strainName)
        var fighting = !!e.eng
        setText(tag, succ ? STR.p_successor
          : fighting ? STR.inEngagement
            : e.sequenced ? STR.sequenced : STR.unsequenced)
        setData(tag, 'tone', succ ? 'neg' : fighting ? 'warn' : e.sequenced ? 'signal' : '')
        var mass = 0, i
        for (i = 0; i < e.w.length; i++) mass += num(e.w[i])
        setSlot(massN, C().fmt(mass), '')
        var d = dv && dv.distance ? dv.distance(e, s) : 0
        setText(where, interp(STR.band, { n: e.origin }) + ' · ' +
          interp(STR.distance, { n: d }) +
          (succ ? ' · ' + interp(STR.successorAge, { v: secs(dv.succAge(s)) }) : ''))

        // The prediction is the panel's reason to exist: an unsequenced foe is a *range*, and the
        // width of that range is exactly what Ψ buys (03 §13.5).
        var pr = dv && dv.predict ? dv.predict(e.id, stake.value() / U.SLIDER_STEPS) : null
        if (!pr) setText(predTxt, '')
        else if (pr.wide) {
          setText(predTxt, interp(STR.predictWide, {
            lo: (pr.lo.win ? '+' : '−') + C().fmt(pr.lo.survivors),
            hi: (pr.hi.win ? '+' : '−') + C().fmt(pr.hi.survivors)
          }))
        } else {
          setText(predTxt, interp(pr.win ? STR.predictLine : STR.predictLose,
            { v: C().fmt(pr.survivors) }) + ' · ' +
            interp(STR.resolveIn, { v: secs(pr.tResolve) }))
        }

        var conc = dv && dv.maxConcurrent ? dv.maxConcurrent(s) : 1
        var busy = dv && dv.engagements ? dv.engagements(s).length : 0
        show(seqBtn, !e.sequenced && !succ)
        show(engBtn, !fighting)
        show(reinBtn, fighting)
        show(wdBtn, fighting)
        show(absBtn, !fighting && !succ)
        show(qtBtn, !fighting && !succ)
        var seq = dv && dv.seqCost ? num(dv.seqCost(s)) : Infinity
        setText(seqBtn, STR.sequence + ' · ' + C().fmt(seq) + ' ' + GLYPH.insight)
        setData(seqBtn, 's', num(s.res.insight) >= seq ? 'afford' : 'want')
        setData(engBtn, 's', busy < conc ? 'afford' : 'want')
        setAttr(engBtn, 'aria-label', busy < conc ? STR.engage
          : interp(STR.engageFull, { n: conc }))
        var ab = dv && dv.absorbCost ? num(dv.absorbCost(s)) : Infinity
        setText(absBtn, STR.absorb + ' · ' + C().fmt(ab) + ' ' + GLYPH.insight)
        setData(absBtn, 's', num(s.res.insight) >= ab ? 'afford' : 'want')
        var qt = dv && dv.quarantineCost ? num(dv.quarantineCost(e.origin)) : Infinity
        setText(qtBtn, STR.quarantine + ' · ' + C().fmt(qt) + ' ' + GLYPH.carbon)
        setData(qtBtn, 's', num(s.res.carbon) >= qt ? 'afford' : 'want')

        setData(r.el, 'live', succ ? 'neg' : fighting ? 'warn' : '1')
        r.label((e.name || STR.strainName) + ', ' + C().fmt(mass) + ' craft, ' +
          (e.sequenced ? STR.sequenced : STR.unsequenced) +
          (fighting ? ', ' + STR.inEngagement : ''))
      }
    }
    return api
  }

  function buildLineages (v, p) {
    var pv = panel('lineages', { title: STR.p_lineages })
    var head = row({})
    var nStrain = statLine(head, STR.p_lineages)
    var shareN = statLine(head, STR.theirMass)
    var shareBar = barLine(head, null)
    var driftN = statLine(head, STR.drifted.replace(' {v}', ''))
    pv.body.appendChild(head.el)

    var bag = {}
    p.__sync = function (s) {
      var dv = DV()
      if (!dv || !dv.strains) return
      var list = dv.strains(s).slice()
      if (s.a3 && s.a3.succ) list.push(s.a3.succ)
      setSlot(nStrain, String(list.length), '')
      var share = dv.strainShare ? num(dv.strainShare(s)) : 0
      setSlot(shareN, pct(share), '')
      shareBar.set(share, share > 0.5 ? 'bad' : (share > 0.25 ? 'warn' : ''),
        STR.theirMass + ' ' + pct(share))
      setSlot(driftN, (dv.driftFraction ? num(dv.driftFraction(s)) : 0).toFixed(3), '')
      reconcile(pv.body, bag, list, function (e) { return e.id }, strainRow, s)
      pv.setCount(list.length)
      if (list.length) pv.unempty()
      else pv.empty(STR.noStrains)
    }
    p.view = pv
    return pv
  }

  function definePanels (v) {
    def(v, 'floor', function (s, rev) { return rev.substrate }, buildFloor, null, actI)
    def(v, 'tips', function (s, rev) { return rev.tips }, buildTips, null, actI)
    def(v, 'market', function (s, rev) { return rev.market }, buildMarket, null, actI)
    def(v, 'seasons', function (s, rev) { return rev.seasons }, buildSeasons, null, actI)
    def(v, 'understory', function (s, rev) { return rev.trees }, buildUnderstory, null, actI)
    def(v, 'patches', needPatches, buildPatches, null, actI)
    def(v, 'signal', function (s, rev) { return s.act === 1 && rev.signal }, buildSignal,
      null, actI)
    // Act II. Adaptations is the one panel that spans all three acts, so it lives on the MIND slot
    // and has no Act I tab at all. Everything else in Act II is scoped to Act II by `live`: the
    // forest is not idle in Act III, it is gone, and a panel reporting on it would be a lie.
    def(v, 'forest', function (s, rev) { return s.act >= 2 && rev.forest }, buildForest,
      'forest', actII)
    def(v, 'stands', function (s, rev) { return s.act >= 2 && rev.stands }, buildStands,
      'forest', actII)
    def(v, 'mind', function (s, rev) { return s.act >= 2 && rev.signal }, buildMind, 'mind', actII)
    def(v, 'diff', function (s, rev) { return s.act >= 2 && rev.diff }, buildDiff, 'mind', actII)
    def(v, 'adaptations', function (s, rev) { return rev.projects }, buildAdaptations, 'mind',
      function (s, rev) { return s.act < 3 || !dismantled(rev, 'mind') })
    // FLUSH before WEATHER: both arrive on the same frame, and the one carrying the verb goes
    // first. The other order put four read-only figures between the top of the tab and the only
    // button on it, and FRUIT was below the fold from the moment the tab existed.
    def(v, 'flush', function (s, rev) { return s.act >= 2 && rev.flush }, buildFlush,
      'flush', actII)
    def(v, 'weather', function (s, rev) { return s.act >= 2 && rev.flush }, buildWeather,
      'flush', actII)
    def(v, 'pact', function (s, rev) { return s.act >= 2 && rev.pact }, buildPact, 'pact', actII)
    def(v, 'offers', function (s, rev) { return s.act >= 2 && rev.pact }, buildOffers,
      'pact', actII)

    // Act III. The two field panels share the VOID slot because they are the same field in two
    // phases; the canopy is not a place you go back to.
    def(v, 'canopy', function (s, rev) { return s.act >= 3 && rev.canopy }, buildCanopy,
      'forest', function (s, rev) { return s.act >= 3 && rev.canopy && !dismantled(rev, 'forest') })
    def(v, 'void', function (s, rev) { return s.act >= 3 && rev.voidPhase }, buildVoid,
      'forest', actIII('forest'))
    def(v, 'synchrony', function (s, rev) { return s.act >= 3 && rev.wheel }, buildSynchrony,
      'forest', actIII('forest'))
    def(v, 'endings', function (s, rev) { return s.act >= 3 && rev.endings }, buildEndings,
      'forest', actIII('forest'))
    def(v, 'genome', function (s, rev) { return s.act >= 3 && rev.genome }, buildGenome,
      'mind', actIII('mind'))
    def(v, 'fleet', function (s, rev) { return s.act >= 3 && rev.fleet }, buildFleet,
      'flush', actIII('flush'))
    def(v, 'mortality', function (s, rev) { return s.act >= 3 && rev.fleet }, buildMortality,
      'flush', actIII('flush'))
    def(v, 'lineages', function (s, rev) { return s.act >= 3 && rev.lineages }, buildLineages,
      'pact', actIII('pact'))

    def(v, 'log', function (s) { return s.act >= 2 }, buildLog, 'log',
      function (s) { return s.act >= 2 })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS · 06 §8.6. Nine rows, one screen, no submenus.
  // `set` is UI-owned in BIBLE §3 and no simulation module exposes a setter for it, so this is the
  // one place in the build that writes it.
  // ═══════════════════════════════════════════════════════════════════════════

  var tierPref = 'auto'

  function persist () { if (STATE() && STATE().save) STATE().save() }

  function reinitModules () {
    var s = liveState()
    ;['log', 'projects', 'act1', 'economy1'].forEach(function (n) {
      if (!HY[n] || !HY[n].init) return
      try { HY[n].init(s) } catch (e) { /* a module refusing a cold start is not fatal here */ }
    })
  }

  function rebuild () {
    if (!view) return
    var root = view.root
    if (openSheet) openSheet.close()
    toastEl = null
    view = null
    mount(root)
  }

  function settingRow (body, label, control) {
    var r = el('div', 'sheet-row')
    r.appendChild(el('span', 'field-lab', label))
    r.appendChild(control)
    body.appendChild(r)
    return r
  }

  function openSettings () {
    var s = liveState()
    var sh = sheet({
      id: 'settings',
      title: STR.settings,
      buttons: [{ label: STR.done, onPick: function (api) { api.close() } }],
      build: function (body) {
        settingRow(body, STR.theme, seg([
          { value: 'auto', label: STR.auto },
          { value: 'dark', label: STR.dark },
          { value: 'light', label: STR.light }
        ], s ? s.set.theme : 'auto', function (val) {
          setTheme(val)
          persist()
        }))

        settingRow(body, STR.haptics, seg([
          { value: 'on', label: STR.on },
          { value: 'off', label: STR.off }
        ], s && s.set.haptics ? 'on' : 'off', function (val) {
          if (s) s.set.haptics = val === 'on'
          persist()
        }))

        // An in-app override in both directions, because many people have the OS setting on for
        // reasons that have nothing to do with a five-line console.
        settingRow(body, STR.motion, seg([
          { value: 'auto', label: STR.auto },
          { value: 'full', label: STR.on },
          { value: 'reduce', label: STR.off }
        ], s && s.set.reduceMotion === null ? 'auto' : (s && s.set.reduceMotion ? 'reduce' : 'full'),
        function (val) {
          if (s) s.set.reduceMotion = val === 'auto' ? null : val === 'reduce'
          applyMotionAttr()
          persist()
        }))

        // SLOW doubles every deadline and changes not one rate. Twitch is not the skill we test.
        settingRow(body, STR.slow, seg([
          { value: 'off', label: STR.off },
          { value: 'on', label: STR.on }
        ], s && s.set.slow ? 'on' : 'off', function (val) {
          if (s) s.set.slow = val === 'on'
          persist()
        }))

        settingRow(body, STR.verbose, seg([
          { value: 'off', label: STR.off },
          { value: 'on', label: STR.on }
        ], verbose ? 'on' : 'off', function (val) {
          verbose = val === 'on'
          store('hyphae.verbose', verbose ? '1' : '0')
        }))

        settingRow(body, STR.tier, seg([
          { value: 'auto', label: STR.auto },
          { value: 'high', label: STR.high },
          { value: 'med', label: STR.med },
          { value: 'low', label: STR.low }
        ], tierPref, function (val) {
          tierPref = val
          if (CANVAS() && CANVAS().setTier && val !== 'auto') CANVAS().setTier(val.toUpperCase())
        }))

        body.appendChild(el('p', 'sheet-note', STR.textSize + ' — ' + STR.textSizeNote))

        var code = el('textarea', 'sheet-code')
        setAttr(code, 'aria-label', STR.save)
        code.spellcheck = false
        body.appendChild(code)
        var saveRow = el('div', 'row-actions')
        saveRow.appendChild(actionButton(STR.copy, function () {
          if (!STATE()) return
          code.value = STATE().exportB64()
          code.select()
          var n = typeof navigator === 'undefined' ? null : navigator
          if (n && n.clipboard) n.clipboard.writeText(code.value).catch(function () {})
          toast(STR.toastCopied)
        }))
        saveRow.appendChild(actionButton(STR.load, function () {
          if (!STATE()) return
          if (!STATE().importB64(code.value.trim())) {
            toast(STR.toastImportBad)
            return
          }
          rebuild()
        }))
        body.appendChild(saveRow)

        var reset = btn('sheet-btn hold hero--danger')
        reset.appendChild(el('span', 'hold-fill'))
        reset.appendChild(el('span', 'hold-lab', STR.reset))
        bindHold(reset, function () {
          if (!STATE()) return
          var cur = liveState()
          STATE().init(STATE().newGame(cur ? cur.seed : 0, cur ? cur.meta : null))
          reinitModules()
          rebuild()
          toast(STR.toastReset)
        })
        var resetRow = el('div', 'row-actions')
        resetRow.appendChild(reset)
        body.appendChild(resetRow)
        body.appendChild(el('p', 'sheet-note', STR.resetNote))
      }
    })
    sh.open()
    return sh
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT TRANSITION · 06 §6.6. Three luminance changes in four seconds; under reduced motion the
  // same words at the same intervals with no motion at all — the words were always the content and
  // the motion was always just the frame.
  // ═══════════════════════════════════════════════════════════════════════════

  function transition (lines, onDone) {
    if (!view) {
      if (onDone) onDone()
      return
    }
    var reduced = reducedMotion()
    setData(view.shell, 'transition', '1')
    haptic(U.HAP_ACT[0], 'act.begin')
    var curtain = el('div', 'curtain')
    view.main.appendChild(curtain)
    var i = 0
    function step () {
      if (i >= lines.length) {
        haptic(U.HAP_ACT[2], 'act.end')
        setData(view.shell, 'transition', '0')
        if (curtain.parentNode) curtain.parentNode.removeChild(curtain)
        if (onDone) onDone()
        return
      }
      curtain.appendChild(el('p', 'curtain-line', lines[i]))
      i += 1
      setTimeout(step, U.ACT_LINE_GAP_MS)
    }
    setTimeout(function () {
      haptic(U.HAP_ACT[1], 'act.mid')
      step()
    }, reduced ? 0 : U.ACT_HOLD_MS)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SELF-TEST — D02's cold-boot inventory, asserted element by element.
  // A detached shell rendered against a fresh save. At cold boot every reveal is false, so this is
  // exactly the screen D02 describes and nothing has to be stubbed in order to see it.
  // ═══════════════════════════════════════════════════════════════════════════

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }
    var d = doc()
    if (!d) return f

    var host = d.createElement('div')
    var keepView = view
    var keepToast = toastEl
    view = buildShell(host)
    definePanels(view)
    var s = STATE().newGame(0, null)
    var i

    paintLedger(view, s, COLD)
    view.order.forEach(function (id) {
      ok(!view.panels[id].need(s, COLD), 'D02: panel "' + id + '" is revealed at t=0')
    })
    paintHero(view, s)

    // 1 · one plate, two surfaces, one of which is never cleared
    ok(host.querySelectorAll('.plate').length === 1, 'D02: expected exactly one canvas plate')
    ok(host.querySelectorAll('.plate canvas').length === 2, 'D02: expected net and flux canvases')
    ok(host.querySelector('#net').getAttribute('aria-hidden') === 'true',
      'D02: the structural canvas must be aria-hidden')
    ok(host.querySelector('#flux').getAttribute('role') === 'img',
      'D02: the flux canvas must carry role=img')

    // 2 · BIOMASS 0 g, and nothing else in the ledger
    var rows = host.querySelectorAll('.ledger-row')
    var visibleRows = []
    for (i = 0; i < rows.length; i++) if (!rows[i].hidden) visibleRows.push(rows[i])
    ok(visibleRows.length === 1, 'D02: expected exactly one ledger row, saw ' + visibleRows.length)
    if (visibleRows.length === 1) {
      var r = visibleRows[0]
      ok(r.querySelector('.ledger-lab').textContent === STR.biomass,
        'D02: the first ledger row must be biomass')
      var parts = splitNum(C().fmtMass(0))
      ok(r.querySelector('.ledger-val .mant').textContent === parts[0],
        'D02: biomass must read "' + parts[0] + '"')
      ok(r.querySelector('.ledger-val .unit').textContent === 'g',
        'D02: biomass must be shown in grams')
      ok(r.dataset.lead === 'solo', 'D02: alone on screen, biomass is the display size')
      ok(r.querySelector('.ledger-rate').dataset.sign === 'zero',
        'D02: a zero rate renders as an em dash, never +0.00')
    }

    // 3 · exactly one button on screen, and it says EXTEND
    var live = []
    var buttons = host.querySelectorAll('button')
    for (i = 0; i < buttons.length; i++) {
      if (buttons[i].hidden) continue
      if (buttons[i].closest && buttons[i].closest('[hidden]')) continue
      live.push(buttons[i])
    }
    ok(live.length === 1, 'D02: expected exactly one button at t=0, saw ' + live.length)
    if (live.length === 1) {
      ok(live[0].className === 'hero', 'D02: the one button must be the hero')
      ok(live[0].textContent === STR.extend, 'D02: the hero must read "' + STR.extend + '"')
    }
    ok(host.querySelector('.gear').hidden, 'D02: there is no settings affordance at t=0')
    ok(host.querySelector('.tabbar').hidden, 'D02: there is no tab bar in Act I')

    // 4 · a five-row console, and it is the only live region anybody can see
    ok(!!host.querySelector('.console'), 'D02: the console must exist')
    var inner = host.querySelector('.console-inner')
    ok(inner && inner.getAttribute('aria-live') === 'polite',
      'D02: the console is the aria-live region')
    ok(host.querySelectorAll('[aria-live]:not(.vh)').length === 1,
      'D02: exactly one visible aria-live region exists')
    ok(inner && inner.childNodes.length <= 1, 'D02: the console holds at most one line at t=0')
    ok(U.CONSOLE_ROWS === 5, 'D02: the console is a five-row window')

    // The interface's own voice is a separate, visually hidden channel: a diagnostic must never
    // land in the console, which is the game speaking and log.js's alone.
    ok(!!view.announcer && view.announcer.className === 'vh' &&
      view.announcer.getAttribute('aria-live') === 'polite',
      'the announcer is a visually hidden live region')
    var consoleBefore = inner ? inner.childNodes.length : -1
    announce('240 g short')
    ok(view.announcer.textContent === '240 g short', 'announce writes to the announcer')
    ok(inner && inner.childNodes.length === consoleBefore,
      'announce must not add a line to the narrative console')
    announce('240 g short')
    ok(view.announcer.textContent !== '240 g short',
      'a repeated announcement must change the node or the reader stays silent')
    view.announcer.textContent = ''

    // 5 · nothing else. No chrome of any kind, ever.
    ok(host.querySelectorAll('.panel').length === 0, 'D02: no panel is mounted at t=0')
    ok(host.querySelectorAll('.sheet').length === 0, 'D02: no sheet exists at t=0')
    ok(host.querySelectorAll('.scrim').length === 0, 'D02: no scrim exists at t=0')
    ok(host.querySelectorAll('.toast').length === 0, 'D02: no toast exists at t=0')
    ok(host.querySelectorAll('.curtain').length === 0, 'D02: no title card exists at t=0')
    ok(host.querySelectorAll('img, picture, video, iframe, dialog, form, input, select')
      .length === 0, 'D02: no media, dialog or form element exists at t=0')
    ok(host.querySelectorAll('h1').length === 0, 'D02: there is no heading above the game')

    var onScreen = (view.main.textContent + ' ' + view.console.textContent).toLowerCase()
    var banned = ['title', 'logo', 'menu', 'tutorial', 'welcome', 'cookie', 'rotate',
      'orientation', 'continue', 'new game', 'settings', 'sound', 'privacy', 'accept']
    for (i = 0; i < banned.length; i++) {
      ok(onScreen.indexOf(banned[i]) < 0,
        'D02: the word "' + banned[i] + '" appears on the cold-boot screen')
    }

    // 6 · the hero is the last thing in the scroll, forever (06 §4.3, P4)
    var kids = host.querySelector('.scroll-main').children
    ok(kids[kids.length - 2] === host.querySelector('.hero'),
      'D02: the hero must be the last element in the scroll, before the tail')
    ok(!!(host.querySelector('.console').compareDocumentPosition(host.querySelector('.hero')) &
      d.DOCUMENT_POSITION_PRECEDING), 'D02: the console sits below the hero')

    // ── beyond D02: the invariants a component can quietly break ──
    ok(U.PLATE_FRAC[0] === 0.38, '06 §4.3: the cold-boot plate is 38% of the shell')
    ok(U.LEDGER_MAX_ROWS === 4, '06 §5.1: the ledger is four rows maximum, ever')
    ok(U.PIPS === 5, '06 §5.6: five pips, never more, never fewer')
    ok(T().UI.TAP_MIN_PX === 44 && U.LONGPRESS_MS === 420,
      '06 §5.5 / §8.3: the tap floor is 44 px and the long-press is 420 ms')
    ok(U.D_PRESS === 70 && U.D_RELEASE === 220,
      '06 §5.2: press is 70 ms front-loaded and release is 220 ms long-tailed')
    ok(splitNum('4.12 T')[1] === 'T' && splitNum('812')[1] === '',
      'a value splits into a mantissa and a suffix; a bare number has no suffix')
    ok(joinUnit('T', '') === 'T' && joinUnit('', 'g/s') === 'g/s' &&
      joinUnit('k', 'g/s') === 'k g/s', 'a unit joins a suffix without leaving a stray space')
    ok(ascii(0).length === U.ASCII_N && ascii(0.5).length === U.ASCII_N &&
      ascii(1).length === U.ASCII_N,
      'the ASCII meter is a fixed 20 characters at every value')
    ok(ascii(1) === repeat(U.ASCII_FULL, U.ASCII_N), 'a full ASCII meter carries no head glyph')
    ok(spark([]) === '', 'an empty price history draws nothing rather than a flat line')
    ok(spark([1, 1, 1]).length === 3, 'a flat price history draws one glyph per sample')
    ok(interp(STR.short, { n: '240 g' }) === '240 g short',
      'strings interpolate through named slots')
    ok(TAB_SLOTS.length === T().UI.TAB_SLOTS, '06 §4.4: five tab slots are allocated at boot')

    // The display slot is the one clock the rate meters run on. loop.js schedules it at
    // DISPLAY_HZ and the rAF calls it too; if the two periods disagree the throttle drops
    // samples and every rate on screen is wrong by the ratio between them.
    ok(U.DISPLAY_MS === 1000 / T().CLOCK.DISPLAY_HZ,
      'BIBLE §4.2: the display slot period must equal the display timer period')

    // A transaction is a step in the stock, not a rate. Neither of these is visible in a
    // screenshot and both of them were wrong.
    var rv = { rates: {} }
    rate(rv, 'biomass', 100, 0.1)
    rate(rv, 'biomass', 110, 0.1)
    ok(rateOf(rv, 'biomass') > 0, 'a rising stock reads as a positive rate')
    rv.rates.biomass.step -= 50                      // the player buys a 50 g tip
    rate(rv, 'biomass', 61, 0.1)                     // 110 − 50 spent + 1 g produced
    ok(rateOf(rv, 'biomass') > 0,
      'a purchase must not turn a rising stock into a falling rate')
    ok(rv.rates.biomass.step === 0, 'a step is consumed by the sample that follows it')
    ok(ORDINAL.length === Object.keys(TYPE_NAME).length,
      'seven typed pools have seven queue positions')
    ok(Object.keys(TYPE_NAME).length === 7, 'seven typed pools have seven names')
    ok(GLYPH.minerals === '⛬' && GLYPH.signal === 'Σ' && GLYPH.sugar === 'sug',
      'BIBLE §2.1: one name, one symbol, one unit')

    // Act I text carries no capital letter (D68) and no exclamation mark exists in the build (D67).
    // The capitals the design asks for are applied by text-transform.
    function lint (tableName, table) {
      for (var k in table) {
        if (!Object.prototype.hasOwnProperty.call(table, k)) continue
        ok(!/[A-Z]/.test(table[k]), 'D68: ' + tableName + '.' + k + ' contains a capital letter')
        ok(table[k].indexOf('!') < 0, 'D67: ' + tableName + '.' + k + ' contains an exclamation')
      }
    }
    lint('STR', STR)
    lint('TYPE_NAME', TYPE_NAME)
    lint('SPECIES_NAME', SPECIES_NAME)
    for (i = 0; i < SEASON_LABEL.length; i++) {
      ok(!/[A-Z]/.test(SEASON_LABEL[i]), 'D68: SEASON_LABEL[' + i + '] has a capital letter')
    }
    for (i = 0; i < TAB_SLOTS.length; i++) {
      ok(!/[A-Z]/.test(TAB_SLOTS[i].label), 'D68: tab label "' + TAB_SLOTS[i].label + '" has a capital')
    }

    // ── ACT II ───────────────────────────────────────────────────────────────
    // Every Act II panel belongs to a tab that exists, and every tab the reveal graph can earn
    // has at least one panel behind it. A tab that opens onto nothing is worse than no tab.
    var slotKeys = {}
    for (i = 0; i < TAB_SLOTS.length; i++) slotKeys[TAB_SLOTS[i].key] = 0
    view.order.forEach(function (id) {
      var p = view.panels[id]
      if (!p.tab) return
      ok(Object.prototype.hasOwnProperty.call(slotKeys, p.tab),
        'panel "' + id + '" is on tab "' + p.tab + '", which is not one of the five slots')
      slotKeys[p.tab] += 1
    })
    for (var key in slotKeys) {
      if (!Object.prototype.hasOwnProperty.call(slotKeys, key)) continue
      ok(slotKeys[key] > 0, 'tab "' + key + '" has no panel behind it')
    }

    // The Act II reveal graph, BIBLE §5.3: FOREST from the first frame, everything else earned.
    var a2 = STATE().newGame(0, null)
    a2.act = 2
    a2.phase = 'network'
    var cold2 = a2Reveals(a2)
    ok(cold2.forest === true, '§5.3: the FOREST panel must be there from the act break')
    ok(cold2.signal === true, '§5.3: cognition is live from the act break')
    ok(cold2.stands === false, '§5.3: STANDS is gated on chemotaxis')
    ok(cold2.insight === false, '§5.3: Insight is gated on turgor')
    ok(cold2.flush === false, '§5.3: FLUSH is gated on primordium')
    ok(cold2.diff === false, '§5.3: D allocation is gated on differentiation')
    ok(cold2.pulse === false, '§5.3: PULSE is gated on action_potential_ii')
    a2.proj.flags.chemotaxis = 1
    a2.proj.flags.turgor = 1
    a2.proj.flags.primordium = 1
    a2.proj.flags.differentiation = 1
    a2.proj.flags.action_potential_ii = 1
    a2.proj.flags.humic_retention = 1
    var warm = a2Reveals(a2)
    ok(warm.stands && warm.insight && warm.flush && warm.diff && warm.pulse && warm.retention,
      '§5.3: an Act II gate did not open when its flag was set')

    // A panel is on screen when its tab is selected and at no other time; the Act I panels have
    // no tab and so cannot survive into an act that deleted what they were showing.
    view.tab = 'forest'
    ok(onTab(view, { tab: 'forest' }, a2), 'the selected tab does not show its own panels')
    ok(!onTab(view, { tab: 'mind' }, a2), 'an unselected tab is painting')
    ok(!onTab(view, { tab: null }, a2), 'an Act I panel survived DECIDE on screen')
    ok(onTab(view, { tab: null }, { act: 1 }), 'an Act I panel is hidden during Act I')

    view = keepView
    toastEl = keepToast
    return f
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE SURFACE (BIBLE §6 M16)
  // ═══════════════════════════════════════════════════════════════════════════

  HY.ui = {
    mount: mount,
    render: render,
    panel: panel,
    card: card,
    row: row,
    meter: meter,
    sheet: sheet,
    toast: toast,
    setTab: setTab,
    revealTab: revealTab,
    revealPanel: revealPanel,
    setTheme: setTheme,
    setAct: setAct,
    announce: announce,

    // The rest of this module's own surface: the 10 Hz display slot loop.js schedules, the act
    // cinematic, the rotation hook, and the sheet the gear opens.
    display: function () {
      var s = liveState()
      if (view && s) display(view, s, nowMs())
    },
    transition: transition,
    layout: layout,
    openSettings: openSettings,
    // The reveal flags this module is painting against. A panel that has not arrived is either a
    // gate that has not opened or a predicate that threw; without this the two look identical.
    reveals: function () { var s = liveState(); return s ? revealFlags(s) : null },
    get mounted () { return !!view },
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
