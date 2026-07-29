;(function (HY) {
  'use strict'

  // M2 · state.js — the §3 shape (BIBLE §6 M2).
  //
  // This file is the only place in the build that constructs, validates, serialises, migrates or
  // stores the save. Typed-array (de)serialisation for `a2.regions` and `a3.bands` lives here and
  // nowhere else, as does every `localStorage` call.
  //
  // Load order does not matter: `core` is read lazily inside functions, and `state` itself is a
  // getter that builds the cold-boot save on first touch.

  var DEFAULT_SEED = 0x9E3779B9   // §3's literal; also the value core.rng() falls back to
  var CURRENT = 1                 // §3 `v`. Bump on ANY key rename or removal.

  // The seven Act I substrate pools, in the order §3 writes them. This is a vocabulary, not a
  // tuning table — the per-type economics (k, etaB, etaS, price, cap, fall) belong to economy1.
  var TYPES = ['leaf', 'needle', 'twig', 'bark', 'log', 'stump', 'carrion']
  var BOOT_TYPES = ['leaf', 'needle', 'twig']

  // The eight Act III loci, in the order §3 fixes forever. Only the count is load-bearing here.
  var LOCUS_AXES = ['BAL', 'GER', 'MYC', 'SPO', 'MEL', 'DOR', 'FID', 'ANT']

  // The five keys of one Litter Market row. state.js owns the row's *shape*; economy1 writes the
  // base prices and opening stock from its own deadfall table on init.
  var MKT_KEYS = ['base', 'price', 'mom', 'stock', 'coolT']

  var SER_TYPE = '$t'             // typed-array envelope: constructor code
  var SER_LEN = '$n'              // element count
  var SER_DATA = '$b'             // base64 payload; ABSENT means "all zero"

  var MS_PER_S = 1000             // unit conversion, not a tunable

  function C () { return HY.core }
  function TUNE () { return HY.core.TUNE }

  // Wall clock, in SECONDS since the epoch. Seconds is the unit of every duration in the build —
  // TUNE holds nothing per-tick and nothing in milliseconds — and `wallClock` exists to be
  // subtracted from a later reading by the offline reconciler. One unit on both sides is the whole
  // point: a millisecond stamp read as seconds is off by a factor of a thousand, which reads as
  // "last played forty years from now" and silently disables offline progress forever.
  // This is the only clock reader in the build; loop.js reconciles against HY.state.now().
  function now () { return Date.now() / MS_PER_S }

  // ───────────────────────────────────────────────────────────────────────────
  // TYPED-ARRAY CODEC
  // ───────────────────────────────────────────────────────────────────────────

  var TA_CTOR = {
    i8: Int8Array, u8: Uint8Array, i16: Int16Array, u16: Uint16Array,
    i32: Int32Array, u32: Uint32Array, f32: Float32Array, f64: Float64Array
  }

  var TA_CODE = {
    Int8Array: 'i8', Uint8Array: 'u8', Int16Array: 'i16', Uint16Array: 'u16',
    Int32Array: 'i32', Uint32Array: 'u32', Float32Array: 'f32', Float64Array: 'f64'
  }

  // `isView` rejects everything that is not a view in one cheap call, so the string form is only
  // ever built for arrays that really are typed. Brand-checked rather than `instanceof` so an array
  // that came from a worker or the harness's sandbox is still recognised as its own type.
  function taCode (v) {
    if (!v || typeof v !== 'object' || !ArrayBuffer.isView(v)) return ''
    return TA_CODE[Object.prototype.toString.call(v).slice(8, -1)] || ''
  }

  function isEnvelope (v) {
    return !!v && typeof v === 'object' && typeof v[SER_TYPE] === 'string' && TA_CTOR[v[SER_TYPE]]
  }

  // Byte order is the platform's. Every device that can run this build is little-endian, and a
  // DataView pass over 20 × 61 elements twice per autosave would cost more than the portability is
  // worth; if a big-endian target ever appears it becomes a v2 migration, not a format change.
  //
  // An all-zero array carries no payload. At Act I every one of the twenty region arrays and every
  // Act III array is zero, and at Act III the region arrays have been zeroed by ASCOSPORE — so the
  // 3 KB Act III budget (§3.1 rule 7) is met without the shape ever changing.
  function taEncode (arr) {
    var e = {}, i, allZero = true
    e[SER_TYPE] = taCode(arr)
    e[SER_LEN] = arr.length
    for (i = 0; i < arr.length; i++) {
      if (arr[i] !== 0) { allZero = false; break }
    }
    if (!allZero) e[SER_DATA] = bytesToB64(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength))
    return e
  }

  function taDecode (e) {
    var Ctor = TA_CTOR[e[SER_TYPE]]
    var n = e[SER_LEN] | 0
    var out = new Ctor(n)
    var bytes, view, i
    if (typeof e[SER_DATA] === 'string' && e[SER_DATA].length) {
      bytes = b64ToBytes(e[SER_DATA])
      view = new Uint8Array(out.buffer)
      // A truncated or over-long payload is copied as far as it agrees rather than thrown on: a
      // clipped paste should cost the player the tail of one array, not the whole save.
      for (i = 0; i < view.length && i < bytes.length; i++) view[i] = bytes[i]
    }
    return out
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BASE64 — URL-safe, unpadded, whitespace-tolerant on the way back in
  // ───────────────────────────────────────────────────────────────────────────

  var B64_CHUNK = 0x8000          // characters per fromCharCode.apply call; above this engines throw

  function bytesToB64 (u8) {
    var s = '', i
    for (i = 0; i < u8.length; i += B64_CHUNK) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + B64_CHUNK))
    }
    // `+` and `/` survive a text field but not a URL or a chat client that linkifies; `=` is the
    // character most often eaten by a double-click selection. All three are removed symmetrically.
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  function b64ToBytes (str) {
    var s = String(str).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
    while (s.length % 4) s += '='
    var bin = atob(s)
    var u8 = new Uint8Array(bin.length), i
    for (i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
    return u8
  }

  // The save contains em dashes, `Σ`, `⛬` and procedural names, so btoa() cannot see the string
  // directly. TextEncoder where it exists; the hand-rolled path keeps the build honest on an old
  // Android WebView, and both produce the same bytes.
  function utf8Encode (str) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(str)
    var out = [], i, c, c2
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i)
      if (c < 0x80) out.push(c)
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F))
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
        c2 = str.charCodeAt(++i)
        c = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00)
        out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F))
      } else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F))
    }
    return new Uint8Array(out)
  }

  function utf8Decode (u8) {
    if (typeof TextDecoder === 'function') return new TextDecoder().decode(u8)
    var s = '', i = 0, c, n
    while (i < u8.length) {
      c = u8[i++]
      if (c < 0x80) n = c
      else if (c < 0xE0) n = ((c & 0x1F) << 6) | (u8[i++] & 0x3F)
      else if (c < 0xF0) n = ((c & 0x0F) << 12) | ((u8[i++] & 0x3F) << 6) | (u8[i++] & 0x3F)
      else n = ((c & 0x07) << 18) | ((u8[i++] & 0x3F) << 12) | ((u8[i++] & 0x3F) << 6) | (u8[i++] & 0x3F)
      if (n > 0xFFFF) {
        n -= 0x10000
        s += String.fromCharCode(0xD800 + (n >> 10), 0xDC00 + (n & 0x3FF))
      } else s += String.fromCharCode(n)
    }
    return s
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE §3 SHAPE
  // ───────────────────────────────────────────────────────────────────────────

  function zeros (Ctor, n) { return new Ctor(n) }

  function newRegions (n) {
    return {
      q: zeros(Int8Array, n), r: zeros(Int8Array, n),
      terrain: zeros(Uint8Array, n),
      sp0: zeros(Uint8Array, n), sp1: zeros(Uint8Array, n), w0: zeros(Float32Array, n),
      L0: zeros(Float32Array, n), L: zeros(Float32Array, n),
      T0: zeros(Float32Array, n), T: zeros(Float32Array, n),
      h: zeros(Float32Array, n), d: zeros(Float32Array, n), rho: zeros(Float32Array, n),
      col: zeros(Float32Array, n),
      flags: zeros(Uint8Array, n),
      rival: zeros(Int8Array, n), rivalStr: zeros(Float32Array, n),
      barriers: zeros(Uint8Array, n), fireRisk: zeros(Float32Array, n),
      phase: zeros(Float32Array, n)      // unused in Act II; the array shape is act-invariant
    }
  }

  function newMeta (src) {
    var m = {
      sclerotium: 0,
      upgrades: [],
      growthLevel: 0, coherenceLevel: 0, divergenceLevel: 0,
      archive: [],
      lineages: [],
      runs: 0
    }
    if (src && typeof src === 'object') {
      // meta is the one block a prestige does not clear, so it arrives from the previous run and is
      // copied field-by-field rather than adopted wholesale: a malformed carry must not poison a
      // fresh save's shape.
      if (isNum(src.sclerotium)) m.sclerotium = src.sclerotium
      if (isArr(src.upgrades)) m.upgrades = src.upgrades.slice()
      if (isNum(src.growthLevel)) m.growthLevel = src.growthLevel
      if (isNum(src.coherenceLevel)) m.coherenceLevel = src.coherenceLevel
      if (isNum(src.divergenceLevel)) m.divergenceLevel = src.divergenceLevel
      if (isArr(src.archive)) m.archive = deepClone(src.archive)
      if (isArr(src.lineages)) m.lineages = deepClone(src.lineages)
      if (isNum(src.runs)) m.runs = src.runs
    }
    return m
  }

  function newGame (seed, meta) {
    var T = TUNE()
    var A1 = T.A1, A2 = T.A2, A3 = T.A3
    var NREG = A2.REGIONS
    var NBAND = A3.BANDS
    var NBIOME = A3.BIOME_X0.length
    var s, i, row

    s = {
      v: CURRENT,
      seed: (seed >>> 0) || DEFAULT_SEED,
      // §3's literal is 0, but a save that is adopted and then reconciled before its first autosave
      // would read 0 as "last played at the epoch" and hand the player twelve hours of offline on a
      // cold boot. The invariant that matters is "wallClock is the only input to reconciliation";
      // stamping it at construction, in the same seconds that save() and loop.reconcileOffline()
      // use, is what makes that input correct from the first frame of a first run.
      wallClock: now(),
      act: 1,
      phase: 'understory',
      t: 0,

      res: {
        biomass: 0, cumBiomass: 0, extracted: 0,
        sugar: 0, minerals: 0,
        signal: 0, insight: 0, satTime: 0,
        spores: 0, accord: 0, accordLifetime: 0,
        carbon: 0, cumCarbon: 0,
        alleles: 0, canon: 0, D: 0
      },

      mult: {
        enzymeMult: 1.00,
        enzymeK: { leaf: 1, needle: 1, twig: 1, bark: 1, log: 1, stump: 1, carrion: 1 },
        structureMult: 1.00,
        patchMult: 1.00,
        osmoticPriming: 1.00,
        hartigNet: 1.00,
        exudatePump: 1.00,
        cmnMult: 1.00,
        arbitration: 1.00,
        antifreeze: false,
        sclerotiaBonus: 0,
        perennial: false,
        E: 1.00,
        yieldMult: 1.00,
        signalMult: 1.00,
        capMult: 1.00,
        insightMult: 1.00,
        antibiosis: 1.00,
        advCostMult: 1.00,
        advanceSpeed: 1.00,
        matSpeed: 1.00,
        sporeMult: 1.00,
        hazMult: 1.00,
        necroMult: 1.00,
        ripeT: A2.RIPE_T,
        ripenessFloor: 0.00,
        harvMult: 1.00, replMult: 1.00, germMult: 1.00, exploreMult: 1.00,
        boughtFid: 0.00,
        prestigeGrowth: 1.00
      },

      cog: {
        dCond: 0, dVes: 0, dLag: 0,
        respecs: 0,
        SrPeak: 0,
        pulseCd: 0,
        pulseMode: 'SURGE',
        pulseEpicentre: 0,
        pulsesInFlight: []
      },

      a1: {
        tips: 0,
        hyphaeManual: 0,
        season: A1.BOOT_SEASON,
        seasonPhase: A1.BOOT_SEASON_PHASE,
        year: 0,
        moisture: A1.BOOT_MOISTURE,
        weatherMoistMod: 1.00,
        weatherFallMod: [],
        sub: {},
        consumptionOrder: TYPES.slice(),
        unlockedTypes: BOOT_TYPES.slice(),
        mkt: [],
        patches: 1,
        claimInFlight: null,
        netRep: 0,
        trees: [],
        contracts: [],
        activeEvents: []
      },

      a2: {
        W: A2.OU_MEAN, Wmom: 0, windSpeed: A2.WIND_BOOT, windDir: 0,
        mastAt: 0, mastUntil: 0,
        regions: newRegions(NREG),
        flush: [],
        pact: {},
        mineralMkt: { P: 0, Pbar: 0, momentum: 0 },
        legacyHumus: 0, legacyLife: 0
      },

      a3: {
        biomes: {
          X: zeros(Float64Array, NBIOME),
          n: zeros(Float64Array, NBIOME),
          reached: zeros(Uint8Array, NBIOME)
        },
        bands: {
          X: zeros(Float64Array, NBAND), e: zeros(Float32Array, NBAND),
          rich: zeros(Float32Array, NBAND),
          n: zeros(Float64Array, NBAND), nResid: zeros(Float64Array, NBAND),
          drift: zeros(Float32Array, NBAND), phase: zeros(Float32Array, NBAND)
        },
        transit: [],
        alloc: A3.ALLOC_BOOT.slice(),
        loci: zeros(Int8Array, LOCUS_AXES.length),
        lociBought: 0, lociCap: A3.LOCI_CAP0, capRaises: 0,
        regenomeAt: 0,
        strains: [],
        succ: null,
        mortality: zeros(Float64Array, A3.MORTALITY_CAUSES),
        antiphony: {},
        upsilon: A3.UPSILON_FREE
      },

      carry: {
        legacy: 0,
        fidelityBase: A3.FID_BASE_A,
        pathFlag: 'mixed',
        sporeBank: 0
      },

      proj: { bought: [], seen: [], uses: {}, flags: {}, queue: [] },

      log: { fired: [], ring: [], lastObsAt: 0, lastLineAt: 0, openingLines: 0 },

      stats: {
        taps: 0, purchases: 0, sugarSpentOnMarket: 0, rotted: 0, largestSinglePurchase: 0,
        contractsSigned: 0, contractsCompleted: 0, defaults: 0, mineralEarned: 0,
        wintersEnded: 0, carrionEventsSeen: 0, offlineSeconds: 0,
        densityBuys: 0, flushes: 0, pulses: 0, seededCount: 0, claimedCount: 0,
        rivalContacts: 0, barrierBlocks: 0, droughtsSurvived: 0, ignitions: 0,
        signalOverflow: 0, mineralTrades: 0, everSaturated: false,
        reallocations: 0, pactsHonoured: 0, pactsBreached: 0, traitsRevealed: 0,
        releases: 0, targetsReached: 0, engagements: 0, purged: 0, absorbed: 0, quarantined: 0,
        radiationHazards: 0, entryAttempts: 0, strainsBorn: 0, respecs: 0,
        windfalls: 0, endingsReached: 0
      },

      set: {
        theme: 'auto',
        sound: 'sparse',
        haptics: true,
        slow: false,
        calm: false,
        reduceMotion: null
      },

      meta: newMeta(meta)
    }

    for (i = 0; i < TYPES.length; i++) {
      s.a1.sub[TYPES[i]] = 0
      s.a1.weatherFallMod.push(1)
      row = {}
      // Zeroed rows: the base price, cap-derived opening stock and cooldown are economy1's to write
      // from its own deadfall table. state.js owns the row's shape and nothing else about it.
      for (var j = 0; j < MKT_KEYS.length; j++) row[MKT_KEYS[j]] = 0
      s.a1.mkt.push(row)
    }
    s.a1.sub.leaf = A1.BOOT_SUB_LEAF

    return s
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SHAPE VALIDATION — dev only, one pass over §3, every fault reported
  // ───────────────────────────────────────────────────────────────────────────

  function isNum (v) { return typeof v === 'number' && isFinite(v) }
  function isArr (v) { return Object.prototype.toString.call(v) === '[object Array]' }
  // Brand-checked rather than prototype-checked: a save that arrives from an iframe, a worker or
  // the harness's sandbox has a different `Object.prototype` and would fail an identity test.
  function isPlain (v) {
    return !!v && typeof v === 'object' && Object.prototype.toString.call(v) === '[object Object]'
  }

  var SHAPE_CACHE = null

  function ta (code, n) { return 'ta:' + code + ':' + n }

  // A checker for a plain array of exactly `n` finite numbers (weatherFallMod, alloc).
  function numArray (n, sumsToOne) {
    return function (v, path, out) {
      if (!isArr(v)) { out.push(path + ': expected an array, got ' + kindOf(v)); return }
      if (v.length !== n) out.push(path + ': expected length ' + n + ', got ' + v.length)
      var i, sum = 0
      for (i = 0; i < v.length; i++) {
        if (!isNum(v[i])) out.push(path + '[' + i + ']: expected a finite number, got ' + kindOf(v[i]))
        else sum += v[i]
      }
      if (sumsToOne && v.length === n && Math.abs(sum - 1) > 1e-9) {
        out.push(path + ': must sum to 1, sums to ' + sum)
      }
    }
  }

  function mktCheck (v, path, out) {
    if (!isArr(v)) { out.push(path + ': expected an array, got ' + kindOf(v)); return }
    if (v.length !== TYPES.length) out.push(path + ': expected ' + TYPES.length + ' rows, got ' + v.length)
    for (var i = 0; i < v.length; i++) {
      if (!isPlain(v[i])) { out.push(path + '[' + i + ']: expected an object'); continue }
      for (var k = 0; k < MKT_KEYS.length; k++) {
        if (!isNum(v[i][MKT_KEYS[k]])) {
          out.push(path + '[' + i + '].' + MKT_KEYS[k] + ': expected a finite number')
        }
      }
    }
  }

  function poolsCheck (v, path, out) {
    if (!isPlain(v)) { out.push(path + ': expected an object, got ' + kindOf(v)); return }
    for (var i = 0; i < TYPES.length; i++) {
      if (!isNum(v[TYPES[i]])) out.push(path + '.' + TYPES[i] + ': expected a finite number')
    }
  }

  function buildShape () {
    if (SHAPE_CACHE) return SHAPE_CACHE
    var T = TUNE()
    var NREG = T.A2.REGIONS, NBAND = T.A3.BANDS
    var NBIOME = T.A3.BIOME_X0.length, NCAUSE = T.A3.MORTALITY_CAUSES
    var NLOC = LOCUS_AXES.length
    var reg = {}
    var f32 = ['w0', 'L0', 'L', 'T0', 'T', 'h', 'd', 'rho', 'col', 'rivalStr', 'fireRisk', 'phase']
    var u8 = ['terrain', 'sp0', 'sp1', 'flags', 'barriers']
    var i8 = ['q', 'r', 'rival']
    var i
    for (i = 0; i < f32.length; i++) reg[f32[i]] = ta('f32', NREG)
    for (i = 0; i < u8.length; i++) reg[u8[i]] = ta('u8', NREG)
    for (i = 0; i < i8.length; i++) reg[i8[i]] = ta('i8', NREG)

    SHAPE_CACHE = {
      v: 'num', seed: 'num', wallClock: 'num', act: 'num', phase: 'str', t: 'num',

      res: {
        biomass: 'num', cumBiomass: 'num', extracted: 'num', sugar: 'num', minerals: 'num',
        signal: 'num', insight: 'num', satTime: 'num', spores: 'num', accord: 'num',
        accordLifetime: 'num', carbon: 'num', cumCarbon: 'num', alleles: 'num', canon: 'num',
        D: 'num'
      },

      mult: {
        enzymeMult: 'num',
        enzymeK: {
          leaf: 'num', needle: 'num', twig: 'num', bark: 'num',
          log: 'num', stump: 'num', carrion: 'num'
        },
        structureMult: 'num', patchMult: 'num', osmoticPriming: 'num', hartigNet: 'num',
        exudatePump: 'num', cmnMult: 'num', arbitration: 'num', antifreeze: 'bool',
        sclerotiaBonus: 'num', perennial: 'bool',
        E: 'num', yieldMult: 'num', signalMult: 'num', capMult: 'num', insightMult: 'num',
        antibiosis: 'num', advCostMult: 'num', advanceSpeed: 'num', matSpeed: 'num',
        sporeMult: 'num', hazMult: 'num', necroMult: 'num', ripeT: 'num', ripenessFloor: 'num',
        harvMult: 'num', replMult: 'num', germMult: 'num', exploreMult: 'num', boughtFid: 'num',
        prestigeGrowth: 'num'
      },

      cog: {
        dCond: 'num', dVes: 'num', dLag: 'num', respecs: 'num', SrPeak: 'num',
        pulseCd: 'num', pulseMode: 'str', pulseEpicentre: 'num', pulsesInFlight: 'arr'
      },

      a1: {
        tips: 'num', hyphaeManual: 'num', season: 'num', seasonPhase: 'num', year: 'num',
        moisture: 'num', weatherMoistMod: 'num', weatherFallMod: numArray(TYPES.length, false),
        sub: poolsCheck, consumptionOrder: 'arr', unlockedTypes: 'arr', mkt: mktCheck,
        patches: 'num', claimInFlight: 'objOrNull', netRep: 'num',
        trees: 'arr', contracts: 'arr', activeEvents: 'arr'
      },

      a2: {
        W: 'num', Wmom: 'num', windSpeed: 'num', windDir: 'num',
        mastAt: 'num', mastUntil: 'num',
        regions: reg,
        flush: 'arr',
        pact: 'obj',
        mineralMkt: { P: 'num', Pbar: 'num', momentum: 'num' },
        legacyHumus: 'num', legacyLife: 'num'
      },

      a3: {
        biomes: { X: ta('f64', NBIOME), n: ta('f64', NBIOME), reached: ta('u8', NBIOME) },
        bands: {
          X: ta('f64', NBAND), e: ta('f32', NBAND), rich: ta('f32', NBAND),
          n: ta('f64', NBAND), nResid: ta('f64', NBAND),
          drift: ta('f32', NBAND), phase: ta('f32', NBAND)
        },
        transit: 'arr',
        alloc: numArray(3, true),
        loci: ta('i8', NLOC),
        lociBought: 'num', lociCap: 'num', capRaises: 'num',
        regenomeAt: 'num',
        strains: 'arr',
        succ: 'objOrNull',
        mortality: ta('f64', NCAUSE),
        antiphony: 'obj',
        upsilon: 'num'
      },

      carry: { legacy: 'num', fidelityBase: 'num', pathFlag: 'str', sporeBank: 'num' },

      proj: { bought: 'arr', seen: 'arr', uses: 'obj', flags: 'obj', queue: 'arr' },

      log: { fired: 'arr', ring: 'arr', lastObsAt: 'num', lastLineAt: 'num', openingLines: 'num' },

      stats: {
        taps: 'num', purchases: 'num', sugarSpentOnMarket: 'num', rotted: 'num',
        largestSinglePurchase: 'num', contractsSigned: 'num', contractsCompleted: 'num',
        defaults: 'num', mineralEarned: 'num', wintersEnded: 'num', carrionEventsSeen: 'num',
        offlineSeconds: 'num', densityBuys: 'num', flushes: 'num', pulses: 'num',
        seededCount: 'num', claimedCount: 'num', rivalContacts: 'num', barrierBlocks: 'num',
        droughtsSurvived: 'num', ignitions: 'num', signalOverflow: 'num', mineralTrades: 'num',
        everSaturated: 'bool', reallocations: 'num', pactsHonoured: 'num', pactsBreached: 'num',
        traitsRevealed: 'num', releases: 'num', targetsReached: 'num', engagements: 'num',
        purged: 'num', absorbed: 'num', quarantined: 'num', radiationHazards: 'num',
        entryAttempts: 'num', strainsBorn: 'num', respecs: 'num', windfalls: 'num',
        endingsReached: 'num'
      },

      set: {
        theme: 'str', sound: 'str', haptics: 'bool', slow: 'bool', calm: 'bool',
        reduceMotion: 'boolOrNull'
      },

      meta: {
        sclerotium: 'num', upgrades: 'arr', growthLevel: 'num', coherenceLevel: 'num',
        divergenceLevel: 'num', archive: 'arr', lineages: 'arr', runs: 'num'
      }
    }
    return SHAPE_CACHE
  }

  // The enumerations §3 spells out. A value outside the set is a bug in whoever wrote it, and it is
  // cheaper to name here than to debug as a rendering fault three panels later.
  var ENUMS = {
    phase: ['understory', 'network', 'canopy', 'void', 'dismantle', 'ended'],
    // Cognition's real mode table, not the draft this validator was first
    // written against — SUSTAIN and PROBE never shipped, and rejecting ENTRAIN
    // meant importB64 refused the game's own Act III export (found at 473 min,
    // pulseMode 'ENTRAIN'). A save the game wrote must always re-import.
    'cog.pulseMode': ['SURGE', 'REPEL', 'RECRUIT', 'BLOOM', 'ENCYST', 'ANTAGONISE', 'ENTRAIN'],
    'carry.pathFlag': ['symbiont', 'necrotroph', 'mixed'],
    'set.theme': ['auto', 'dark', 'light'],
    'set.sound': ['off', 'sparse', 'full']
  }

  function kindOf (v) {
    if (v === null) return 'null'
    if (v === undefined) return 'undefined'
    var c = taCode(v)
    if (c) return c + '[' + v.length + ']'
    if (isArr(v)) return 'array'
    if (typeof v === 'number' && !isFinite(v)) return String(v)
    return typeof v
  }

  function checkLeaf (spec, v, path, out) {
    var parts, code, n
    switch (spec) {
      case 'num':
        if (!isNum(v)) out.push(path + ': expected a finite number, got ' + kindOf(v))
        return
      case 'str':
        if (typeof v !== 'string') { out.push(path + ': expected a string, got ' + kindOf(v)); return }
        if (ENUMS[path] && ENUMS[path].indexOf(v) < 0) {
          out.push(path + ': "' + v + '" is not one of ' + ENUMS[path].join(' | '))
        }
        return
      case 'bool':
        if (typeof v !== 'boolean') out.push(path + ': expected a boolean, got ' + kindOf(v))
        return
      case 'boolOrNull':
        if (v !== null && typeof v !== 'boolean') {
          out.push(path + ': expected a boolean or null, got ' + kindOf(v))
        }
        return
      case 'arr':
        if (!isArr(v)) out.push(path + ': expected an array, got ' + kindOf(v))
        return
      case 'obj':
        if (!isPlain(v)) out.push(path + ': expected an object, got ' + kindOf(v))
        return
      case 'objOrNull':
        if (v !== null && !isPlain(v)) out.push(path + ': expected an object or null, got ' + kindOf(v))
        return
      default:
        parts = spec.split(':')
        code = parts[1]; n = +parts[2]
        if (taCode(v) !== code) {
          out.push(path + ': expected ' + code + '[' + n + '], got ' + kindOf(v))
        } else if (v.length !== n) {
          out.push(path + ': expected length ' + n + ', got ' + v.length)
        }
    }
  }

  function walk (spec, v, path, out) {
    var k, p
    if (typeof spec === 'function') { spec(v, path, out); return }
    if (typeof spec === 'string') { checkLeaf(spec, v, path, out); return }
    if (!isPlain(v)) { out.push(path + ': expected an object, got ' + kindOf(v)); return }
    for (k in spec) {
      if (!Object.prototype.hasOwnProperty.call(spec, k)) continue
      p = path ? path + '.' + k : k
      if (!Object.prototype.hasOwnProperty.call(v, k)) { out.push(p + ': missing'); continue }
      walk(spec[k], v[k], p, out)
    }
  }

  function assertShape (save) {
    var out = []
    if (!isPlain(save)) return ['<root>: expected an object, got ' + kindOf(save)]
    walk(buildShape(), save, '', out)
    if (isNum(save.act) && (save.act < 1 || save.act > 3 || save.act !== Math.floor(save.act))) {
      out.push('act: expected 1 | 2 | 3, got ' + save.act)
    }
    if (isNum(save.v) && save.v > CURRENT) out.push('v: ' + save.v + ' is newer than CURRENT ' + CURRENT)
    return out
  }

  // ───────────────────────────────────────────────────────────────────────────
  // (DE)SERIALISATION
  // ───────────────────────────────────────────────────────────────────────────

  function deepClone (v) {
    var out, k, i
    if (v === null || typeof v !== 'object') return v
    if (taCode(v)) return new v.constructor(v)
    if (isArr(v)) {
      out = new Array(v.length)
      for (i = 0; i < v.length; i++) out[i] = deepClone(v[i])
      return out
    }
    out = {}
    for (k in v) if (Object.prototype.hasOwnProperty.call(v, k)) out[k] = deepClone(v[k])
    return out
  }

  // Insertion order is preserved on both legs, which is what makes export → import → export
  // byte-identical and lets the D37 fuzz compare strings rather than walk objects.
  function serialise (save) {
    return encodeValue(save === undefined ? st() : save)
  }

  function encodeValue (v) {
    var out, k, i
    if (v === null) return null
    if (typeof v === 'number') {
      // JSON has no NaN and no Infinity; both stringify to `null`, which reloads as a type error
      // three modules away. A non-finite stock is already a fault by the time it reaches here.
      return isFinite(v) ? v : 0
    }
    if (typeof v !== 'object') return v
    if (taCode(v)) return taEncode(v)
    if (isArr(v)) {
      out = new Array(v.length)
      for (i = 0; i < v.length; i++) out[i] = encodeValue(v[i])
      return out
    }
    out = {}
    for (k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue
      if (typeof v[k] === 'function' || v[k] === undefined) continue
      out[k] = encodeValue(v[k])
    }
    return out
  }

  function deserialise (plain) { return decodeValue(plain) }

  function decodeValue (v) {
    var out, k, i
    if (v === null || typeof v !== 'object') return v
    if (isEnvelope(v)) return taDecode(v)
    if (isArr(v)) {
      out = new Array(v.length)
      for (i = 0; i < v.length; i++) out[i] = decodeValue(v[i])
      return out
    }
    out = {}
    for (k in v) if (Object.prototype.hasOwnProperty.call(v, k)) out[k] = decodeValue(v[k])
    return out
  }

  // The live instance keeps its object identity across loads, imports and New Growth, so a module
  // that cached `HY.state.state` in a closure is never left holding a dead save.
  function adopt (src) {
    var live = st(), k
    // Adopting the live instance into itself is a no-op by definition, and it has to be written
    // down: load() and importB64() both adopt and then hand the live object back, and boot() feeds
    // what load() returned straight into init(), which adopts again. Without this line the second
    // adopt deletes every key of the run and then copies them back from the object it has just
    // emptied — a reload landed the player on a save with no `res`, no `a1` and no way back.
    if (src === live) return live
    for (k in live) if (Object.prototype.hasOwnProperty.call(live, k)) delete live[k]
    for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) live[k] = src[k]
    return live
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MIGRATION — additive only
  // ───────────────────────────────────────────────────────────────────────────

  // Add every key the template has and the save lacks, without touching a key the save already
  // holds. Nothing is removed: a key this version no longer reads (C24's `nodes`) costs bytes, and
  // deleting it is what turns a migration into a data loss when a fix has to be rolled back.
  function fillDefaults (target, tmpl) {
    var k, tv, sv
    for (k in tmpl) {
      if (!Object.prototype.hasOwnProperty.call(tmpl, k)) continue
      tv = tmpl[k]
      if (!Object.prototype.hasOwnProperty.call(target, k) || target[k] === undefined) {
        target[k] = deepClone(tv)
        continue
      }
      sv = target[k]
      if (taCode(tv)) {
        if (taCode(sv) !== taCode(tv) || sv.length !== tv.length) target[k] = deepClone(tv)
      } else if (isPlain(tv)) {
        if (isPlain(sv)) fillDefaults(sv, tv)
        else target[k] = deepClone(tv)
      } else if (isArr(tv) && !isArr(sv)) {
        target[k] = deepClone(tv)
      } else if (typeof tv === 'number' && !isNum(sv)) {
        target[k] = tv
      } else if (typeof tv === 'boolean' && typeof sv !== 'boolean') {
        target[k] = tv
      } else if (typeof tv === 'string' && typeof sv !== 'string') {
        target[k] = tv
      }
    }
  }

  // v0 is every save written before §3 was frozen. It has no single canonical shape, so the
  // migration is defined as "reach the §3 shape without discarding a value you already hold".
  function m0to1 (sv) {
    fillDefaults(sv, newGame(sv.seed, sv.meta))
  }

  function migrate (save, from) {
    var v = isNum(from) ? from : (isNum(save.v) ? save.v : 0)
    if (v > CURRENT) return save     // never downgrade; load() and importB64() have already refused
    // Deliberate fall-through: a save enters the switch at its own version and runs every step
    // above it, in order. A new version adds one case at the bottom and touches nothing else.
    switch (v) {
      case 0:
        m0to1(save)
        /* falls through */
      default:
        break
    }
    save.v = CURRENT
    return save
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STORAGE — guarded; a hostile localStorage costs the player one honest line, never the session
  // ───────────────────────────────────────────────────────────────────────────

  var mem = {}                 // in-memory mirror; always written, and the fallback for every read
  var storageOK = true         // whether the last storage call we made succeeded
  var retryAt = 0              // s, wall clock: while degraded, when storage is worth trying again
  var announced = false        // whether this failure episode has been reported to the player
  var quiet = false            // suppresses the player-facing line; set only by __selftest, which
                               // provokes storage failures and must not spend log.js's once-latch
  var lastError = ''
  var lastBytes = 0

  // A storage failure is nearly always temporary — a full quota that a background tab frees, a
  // private-mode store that returns on the next navigation, a transient SecurityError. Latching it
  // off for the life of the session turns "one autosave was lost" into "the whole run was lost",
  // and the player is never told which happened. So the flag is a state, not a verdict: writes are
  // retried, and the retry is rate-limited to the autosave cadence so a genuinely dead store costs
  // one throw per autosave rather than one per call.
  function storageReady () { return storageOK || now() >= retryAt }

  function degrade (e) {
    var name = e && e.name ? e.name : String(e)
    storageOK = false
    retryAt = now() + TUNE().CLOCK.AUTOSAVE_S
    if (announced) return
    announced = true
    // The session itself is intact — play continues against `mem` — so what the player needs to
    // know is that it will not survive the tab, and which of the two reasons it is. A full store
    // has an answer (export the run); a blocked one does not.
    // Wrapped because this can fire from load() before log.init has run, and a module that cannot
    // take the message is not a reason to lose the save that provoked it.
    if (!quiet && HY.log && HY.log.notice) {
      try { HY.log.notice(/quota|full/i.test(name) ? 'quota' : 'no_storage') } catch (err) { void 0 }
    }
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('hyphae: local storage is unavailable (' + name +
        '); this session is being kept in memory only until it comes back.')
    }
  }

  function recovered () {
    if (storageOK) return
    storageOK = true
    retryAt = 0
    // The announcement latch is released with the flag, so a second outage is reported like the
    // first. Nothing is said to the player: the console line said the run was in memory "until it
    // comes back", and the next autosave has just made that true. Log entries are log.js's
    // vocabulary and this module does not get to invent one.
    announced = false
    if (typeof console !== 'undefined' && console.info) {
      console.info('hyphae: local storage is writable again; the run is being persisted.')
    }
  }

  function lsGet (key) {
    if (storageReady()) {
      try {
        var v = window.localStorage.getItem(key)
        recovered()
        if (v !== null && v !== undefined) return v
      } catch (e) { degrade(e) }
    }
    return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null
  }

  function lsSet (key, value) {
    mem[key] = value           // the mirror is written first, so a quota failure never loses a turn
    if (!storageReady()) return false
    try {
      window.localStorage.setItem(key, value)
      recovered()
      return true
    } catch (e) { degrade(e); return false }
  }

  function clampSlot (n) {
    var slots = TUNE().SAVE.SLOTS
    var i = Math.floor(n)
    if (!(i >= 0)) i = 0
    if (i >= slots) i = slots - 1
    return i
  }

  function slotKey (n) { return TUNE().SAVE.PREFIX + clampSlot(n) }

  var curSlot = 0

  function budgetFor (act) {
    var S = TUNE().SAVE
    return act >= 3 ? S.MAX_BYTES_A3 : (act === 2 ? S.MAX_BYTES_A2 : S.MAX_BYTES_A1)
  }

  // What this session last wrote into each slot key. The rolling .bak is by definition the previous
  // contents of the slot, and for every write after the first we are the one who put them there, so
  // there is nothing to look up: remembering the string removes a synchronous getItem from every
  // autosave. Storage is still read once per slot per session, on the first save, because a
  // previous session's contents are the one thing we do not know.
  var lastWritten = {}

  function save (slot) {
    var s = st()
    var key, json, prev, ok
    if (slot === undefined) slot = curSlot
    curSlot = clampSlot(slot)
    key = slotKey(curSlot)

    s.wallClock = now()        // §3.1 rule 4: the only writer of wallClock is the autosave
    // §3: the ring is trimmed on save. It is the one unbounded array in the shape, and an
    // untrimmed one is worth more bytes than the entire Act II board.
    if (isArr(s.log && s.log.ring) && s.log.ring.length > TUNE().LOG.RING) {
      s.log.ring.splice(0, s.log.ring.length - TUNE().LOG.RING)
    }
    json = JSON.stringify(serialise(s))
    lastBytes = json.length

    prev = Object.prototype.hasOwnProperty.call(lastWritten, key) ? lastWritten[key] : lsGet(key)

    // The rolling .bak is the previous contents of this slot, written before the slot is touched.
    // It is the difference between a write torn by a kill mid-string and a lost run.
    if (prev !== null && prev !== undefined) lsSet(key + '.bak', prev)
    ok = lsSet(key, json)
    lastWritten[key] = json
    return ok
  }

  // Parse → migrate → validate. Returns the §3-shaped save, or null with `reason` set. Shared by
  // the slot loader and by importB64 so a pasted save and a stored one are judged identically.
  function parseSave (raw) {
    var parsed, obj, faults
    if (typeof raw !== 'string' || !raw.length) return { save: null, reason: 'empty' }
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      return { save: null, reason: 'unreadable' }
    }
    if (!isPlain(parsed)) return { save: null, reason: 'unreadable' }
    if (isNum(parsed.v) && parsed.v > CURRENT) {
      // Refusing is the only safe answer: a newer schema may have renamed a key this build still
      // writes, and loading it would silently destroy the newer save on the next autosave.
      return { save: null, reason: 'newer: save is v' + parsed.v + ', this build reads v' + CURRENT }
    }

    obj = deserialise(parsed)
    if (obj.v !== CURRENT) migrate(obj, isNum(obj.v) ? obj.v : 0)

    faults = assertShape(obj)
    if (faults.length) {
      // A save that survived JSON but not §3 has been hand-edited or half-written. One repair pass
      // against the current template, then a second opinion; if it still fails, refuse it rather
      // than boot into a state whose types no other module expects.
      fillDefaults(obj, newGame(obj.seed, obj.meta))
      faults = assertShape(obj)
      if (faults.length) return { save: null, reason: 'malformed: ' + faults[0] }
    }
    return { save: obj, reason: '' }
  }

  function load (slot) {
    var key, got, bak
    lastError = ''
    if (slot === undefined) slot = curSlot
    key = slotKey(slot)
    got = parseSave(lsGet(key))

    // The rolling backup is only worth writing if something reads it. A slot torn by a write that
    // was interrupted mid-string is exactly the case it was written for. A save from a newer build
    // is not: silently reverting a player to their previous session and then autosaving over the
    // newer one is a worse outcome than refusing.
    if (!got.save && got.reason !== 'empty' && got.reason.indexOf('newer') !== 0) {
      bak = parseSave(lsGet(key + '.bak'))
      if (bak.save) {
        got = bak
        got.reason = 'recovered: slot ' + clampSlot(slot) + ' was unreadable, its backup was not'
      }
    }

    lastError = got.reason
    if (!got.save) return null

    // Whatever we thought we had written here, someone else may have written since — a second tab
    // shares this origin. The next save re-reads the slot once rather than rolling a .bak that was
    // never the slot's contents.
    delete lastWritten[key]

    curSlot = clampSlot(slot)
    sinceSave = 0
    return adopt(got.save)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EXPORT / IMPORT
  // ───────────────────────────────────────────────────────────────────────────

  // Pure: it does not stamp wallClock. That belongs to the autosave, and keeping export free of it
  // is what lets the fuzz harness compare two exports of the same state as strings.
  function exportB64 (save) {
    return bytesToB64(utf8Encode(JSON.stringify(serialise(save === undefined ? st() : save))))
  }

  function importB64 (str) {
    var text, got
    lastError = ''
    if (typeof str !== 'string' || !str.replace(/\s+/g, '').length) {
      lastError = 'empty'
      return false
    }
    try {
      text = utf8Decode(b64ToBytes(str))
    } catch (e) {
      lastError = 'unreadable'
      return false
    }
    got = parseSave(text)
    lastError = got.reason
    if (!got.save) return false

    adopt(got.save)
    sinceSave = 0
    // The object swap is not the whole job: modules keep private counters that
    // only their init() rehydrates, and a state simulated against another
    // run's counters diverges from a cold boot of the same save (D35). The
    // composition root owns the order; absent it (a bare node harness), the
    // import still lands and the harness is expected to init what it loads.
    if (HY.loop && HY.loop.reinitModules) HY.loop.reinitModules(st())
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // AUTOSAVE — tick step 18, plus the four event hooks
  // ───────────────────────────────────────────────────────────────────────────

  var sinceSave = 0
  var bound = false

  function tick (s, dt, opts) {
    if (opts && opts.offline) return false   // reconciliation writes once, on return, not 240 times
    sinceSave += dt
    if (sinceSave < TUNE().CLOCK.AUTOSAVE_S) return false
    sinceSave = 0
    return save(curSlot)
  }

  function bindHooks () {
    if (bound || typeof window === 'undefined' || !window.addEventListener) return
    bound = true
    var flush = function () { save(curSlot) }
    // No handler returns a value: D60 forbids "are you sure you want to leave".
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flush()
      })
    }
  }

  function init (s, slot) {
    if (s) adopt(s)
    else st()
    if (isNum(slot)) curSlot = clampSlot(slot)
    sinceSave = 0
    bindHooks()
    return st()
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE LIVE INSTANCE
  // ───────────────────────────────────────────────────────────────────────────

  var live = null

  // Constructed on first read, not at load time, so this file may be concatenated before core.js
  // without caring.
  function st () {
    if (!live) live = newGame(DEFAULT_SEED, null)
    return live
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — returns [] when healthy
  // ───────────────────────────────────────────────────────────────────────────

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }

    var keep = serialise(st())          // the live save is a player's; nothing below may disturb it
    var keptSlot = curSlot
    // Everything the storage sections stand on its head is captured here rather than inside the
    // try: a test that throws half way through must still hand the player back their session, and
    // section 5 goes as far as dropping the live instance to imitate a reload.
    var keptLive = live
    var savedMem = mem, savedOK = storageOK, savedRetry = retryAt
    var savedAnn = announced, savedWritten = lastWritten, savedQuiet = quiet
    try {
      // 1 · a cold-boot save is §3-shaped.
      var g = newGame(1234, null)
      var faults = assertShape(g)
      ok(faults.length === 0, 'newGame does not conform to §3: ' + faults.slice(0, 4).join(' | '))
      ok(g.v === CURRENT, 'newGame wrote v' + g.v + ', expected ' + CURRENT)
      ok(g.a1.sub.leaf === TUNE().A1.BOOT_SUB_LEAF, 'newGame did not put leaf litter on the floor')
      ok(g.a1.mkt.length === TYPES.length, 'newGame market has ' + g.a1.mkt.length + ' rows')
      ok(g.a2.regions.L.length === TUNE().A2.REGIONS, 'region arrays are the wrong length')
      ok(g.a3.bands.phase.length === TUNE().A3.BANDS, 'band arrays are the wrong length')
      ok(g.meta.runs === 0 && g.meta.sclerotium === 0, 'newGame did not zero meta')

      // meta carries across New Growth and must survive construction.
      var g2 = newGame(9, { sclerotium: 7, runs: 3, upgrades: ['a'], archive: [{ name: 'x' }] })
      ok(g2.meta.sclerotium === 7 && g2.meta.runs === 3 && g2.meta.upgrades[0] === 'a',
        'newGame(meta) did not carry meta')
      ok(g2.meta.archive !== undefined && g2.meta.archive[0] && g2.meta.archive[0].name === 'x',
        'newGame(meta) did not deep-copy archive')
      g2.meta.upgrades.push('b')
      ok(assertShape(g2).length === 0, 'newGame(meta) does not conform to §3')

      // assertShape actually detects damage.
      var bad = newGame(2, null)
      delete bad.res.sugar
      bad.a1.tips = 'four'
      bad.set.haptics = 1
      bad.a3.loci = [0, 0, 0, 0, 0, 0, 0, 0]
      bad.phase = 'canopyish'
      var badFaults = assertShape(bad)
      ok(badFaults.length >= 5, 'assertShape found only ' + badFaults.length + ' of 5 planted faults')
      ok(badFaults.join('|').indexOf('res.sugar: missing') >= 0, 'assertShape missed a missing key')
      ok(badFaults.join('|').indexOf('a1.tips') >= 0, 'assertShape missed a mistyped number')
      ok(badFaults.join('|').indexOf('a3.loci') >= 0, 'assertShape missed a de-typed array')
      ok(badFaults.join('|').indexOf('phase') >= 0, 'assertShape missed an out-of-enum phase')

      // 2 · a played save round-trips byte-identically through export/import.
      var p = newGame(0xABCDEF, null)
      p.t = 4321.5
      p.res.biomass = 1.2345678901234e9
      p.res.sugar = 987.6543
      p.a1.tips = 255
      p.a1.hyphaeManual = 0.02 * 813
      p.a1.trees.push({ id: 3, species: 'quercus', age: 12, health: 0.83, rep: 61, ramets: 2 })
      p.a1.contracts.push({ id: 1, treeId: 3, sugarRate: 4.5, termSeasons: 3, state: 'live' })
      p.a1.mkt[0].base = 0.42
      p.a1.mkt[0].price = 0.51
      p.proj.bought.push('rhizomorph_cords', 'anastomosis')
      p.proj.seen.push('rhizomorph_cords', 'anastomosis', 'laccase_cascade', 'windfall')
      p.proj.uses.windfall = 3
      p.proj.flags.anastomosis = 1
      p.log.ring.push('the leaves are not where you left them —')
      p.stats.everSaturated = true
      p.set.reduceMotion = true
      p.act = 2
      p.phase = 'network'
      // Non-trivial typed-array content, including the signed and float edges.
      var i
      for (i = 0; i < p.a2.regions.q.length; i++) {
        p.a2.regions.q[i] = (i % 9) - 4
        p.a2.regions.rival[i] = i === 7 ? -1 : 0
        p.a2.regions.terrain[i] = i % 6
        p.a2.regions.L[i] = 1.15e10 * (1 + i / 61)
        p.a2.regions.h[i] = 0.28 + i * 1e-4
        p.a2.regions.flags[i] = i < 3 ? 0x07 : 0
      }
      for (i = 0; i < p.a3.bands.X.length; i++) {
        p.a3.bands.X[i] = 9.0e26 * Math.pow(5.6, i)
        p.a3.bands.phase[i] = i / 13
      }
      p.a3.loci[2] = 4
      p.a3.loci[7] = -1
      p.a3.mortality[3] = 12345.678
      p.a3.strains.push({
        id: 1, name: 'the one that went north',
        genome: new Int8Array([1, 0, 3, -2, 0, 1, 0, 2]),
        w: new Float64Array(TUNE().A3.BANDS),
        origin: 4, born: 900, sequenced: false, quarantinedUntil: 0
      })
      p.a3.strains[0].w[4] = 6.02e23
      ok(assertShape(p).length === 0, 'the fixture save does not conform to §3')

      var b1 = exportB64(p)
      ok(b1.indexOf('\n') < 0 && b1.indexOf('\r') < 0, 'exportB64 emitted a raw newline')
      ok(/^[A-Za-z0-9_-]+$/.test(b1), 'exportB64 emitted a character a text field would eat')
      ok(importB64(b1) === true, 'importB64 refused its own export: ' + lastError)
      var b2 = exportB64()
      ok(b1 === b2, 'export/import is not byte-identical (' + b1.length + ' vs ' + b2.length + ' chars)')

      // The same string, mauled the way a paste mauls it.
      ok(importB64('  ' + b1.slice(0, 40) + '\n' + b1.slice(40) + '\t\n') === true,
        'importB64 could not survive a wrapped paste: ' + lastError)
      ok(exportB64() === b1, 'a wrapped paste did not restore the same state')

      var r = st()
      ok(r.a2.regions.q[5] === (5 % 9) - 4, 'Int8 region data did not round-trip')
      ok(r.a2.regions.rival[7] === -1, 'a negative Int8 did not round-trip')
      ok(r.a2.regions.flags[0] === 0x07, 'region flag bits did not round-trip')
      ok(r.a2.regions.L[3] === p.a2.regions.L[3], 'Float32 region data did not round-trip')
      ok(r.a3.bands.X[12] === p.a3.bands.X[12], 'Float64 band data did not round-trip')
      ok(r.a3.loci[7] === -1, 'a negative locus did not round-trip')
      ok(r.a3.mortality[3] === 12345.678, 'the mortality ledger did not round-trip')
      ok(r.a3.strains[0].genome instanceof Int8Array && r.a3.strains[0].genome[3] === -2,
        'a strain genome did not round-trip as a typed array')
      ok(r.a3.strains[0].w[4] === 6.02e23, 'a strain weight vector did not round-trip')
      ok(r.a2.regions.phase.length === TUNE().A2.REGIONS && r.a2.regions.phase[0] === 0,
        'the all-zero shortcut did not restore a zeroed array')
      ok(r.res.biomass === 1.2345678901234e9, 'a double lost precision through export')

      // seen must survive separately from bought (§3.1 rule 2).
      ok(r.proj.bought.length === 2 && r.proj.seen.length === 4,
        'proj.seen did not round-trip separately from proj.bought')
      ok(r.proj.seen.indexOf('laccase_cascade') >= 0 && r.proj.bought.indexOf('laccase_cascade') < 0,
        'a triggered-but-unbought project was lost on reload')
      ok(r.proj.uses.windfall === 3, 'proj.uses did not round-trip')

      // 3 · a v0 save migrates cleanly.
      var old = serialise(newGame(77, null))
      old.v = 0
      delete old.carry                    // a block that did not exist
      delete old.res.cumCarbon            // a key added later
      delete old.a3.bands.nResid          // a typed array added later
      delete old.stats.windfalls
      delete old.set.reduceMotion
      old.a1.nodes = 11                   // C24 deleted this; the migration must tolerate it
      old.mult.ripeT = undefined
      var mig = migrate(deserialise(old), 0)
      var migFaults = assertShape(mig)
      ok(migFaults.length === 0, 'v0 migration left ' + migFaults.length + ' faults: ' +
        migFaults.slice(0, 3).join(' | '))
      ok(mig.v === CURRENT, 'migration did not set v to CURRENT')
      ok(mig.seed === 77, 'migration lost the seed')
      ok(mig.carry.fidelityBase === TUNE().A3.FID_BASE_A, 'migration did not default fidelityBase')
      ok(mig.mult.ripeT === TUNE().A2.RIPE_T, 'migration did not default ripeT')
      ok(mig.a3.bands.nResid instanceof Float64Array &&
        mig.a3.bands.nResid.length === TUNE().A3.BANDS, 'migration did not add the residual array')
      ok(mig.a1.nodes === 11, 'migration removed a key instead of leaving it (additive only)')

      // A save from the future is refused rather than downgraded.
      var future = serialise(newGame(5, null))
      future.v = CURRENT + 1
      ok(importB64(bytesToB64(utf8Encode(JSON.stringify(future)))) === false,
        'importB64 accepted a save newer than CURRENT')
      ok(lastError.indexOf('newer') === 0, 'the refusal did not name the version')
      ok(importB64('not a save at all !!!') === false, 'importB64 accepted rubbish')

      // 4 · slots, the rolling .bak, and a hostile localStorage.
      // Against the mirror only. A self-test that wrote through to localStorage would overwrite
      // the slot of whoever ran it, which is the exact failure the slot system exists to prevent.
      // `retryAt` at infinity is what holds it there now that a degraded store is retried, and
      // `quiet` keeps the deliberate failures below out of the player's console.
      mem = {}; lastWritten = {}; storageOK = false; retryAt = Infinity; quiet = true
      adopt(deserialise(parseB64(b1)))
      st().t = 100
      ok(save(1) !== undefined, 'save(1) threw')
      ok(mem[slotKey(1)] !== undefined, 'save did not write the slot')
      ok(mem[slotKey(1) + '.bak'] === undefined, 'save wrote a .bak over an empty slot')
      var firstWrite = mem[slotKey(1)]
      st().t = 200
      save(1)
      ok(mem[slotKey(1) + '.bak'] === firstWrite, 'the rolling .bak is not the previous slot write')
      ok(mem[slotKey(1)] !== firstWrite, 'the second save did not overwrite the slot')
      ok(load(1) !== null, 'load(1) refused a save it had just written: ' + lastError)
      ok(st().t === 200, 'load(1) restored the wrong write')
      ok(load(2) === null && lastError === 'empty', 'load of an empty slot did not report empty')
      ok(slotKey(99) === slotKey(TUNE().SAVE.SLOTS - 1), 'slot index is not clamped')

      // A slot torn mid-write falls back to its rolling backup, and says so.
      mem[slotKey(1)] = firstWrite.slice(0, firstWrite.length >> 1)
      ok(load(1) !== null, 'a torn slot did not fall back to its .bak: ' + lastError)
      ok(st().t === 100, 'the .bak fallback restored the wrong write')
      ok(lastError.indexOf('recovered') === 0, 'the .bak fallback was silent')
      // A slot from a newer build is refused outright rather than reverted to its backup.
      var newer = JSON.parse(firstWrite)
      newer.v = CURRENT + 1
      mem[slotKey(1)] = JSON.stringify(newer)
      ok(load(1) === null && lastError.indexOf('newer') === 0,
        'a slot newer than CURRENT was not refused')

      // 5 · a played run survives a reload. This is what the file is for, and it is the one path
      //     that runs load() and init() against the same object: boot() hands what load() returned
      //     straight to init(s), and both of them adopt.
      mem = {}; lastWritten = {}
      adopt(newGame(0xC0FFEE, null))
      var pi
      if (HY.act1 && HY.act1.onExtend) for (pi = 0; pi < 60; pi++) HY.act1.onExtend()
      // Deterministic ticks: the assertion is about persistence, not about the market's dice.
      if (HY.loop && HY.loop.simTick) {
        for (pi = 0; pi < 600; pi++) {
          HY.loop.simTick(TUNE().CLOCK.DT_A1, { stochastic: false, offline: false })
        }
      } else {
        st().t = 60
      }
      var playedT = st().t, playedB = st().res.biomass, playedTaps = st().stats.taps
      ok(playedT > 0, 'the reload fixture never advanced its clock')
      save(1)
      var atSave = exportB64()           // after the save: save() is the writer of wallClock
      live = null                        // exactly what a reload does to this module
      var reloaded = init(load(1))
      ok(reloaded === st(), 'init did not return the live instance')
      ok(Object.keys(st()).length > 1, 'a reload left the live save with ' +
        Object.keys(st()).length + ' keys')
      ok(exportB64() === atSave, 'a reload did not restore the run byte for byte')
      ok(st().t === playedT, 'a reload lost the clock: ' + st().t + ' vs ' + playedT)
      ok(st().res.biomass === playedB, 'a reload lost the biomass')
      ok(st().stats.taps === playedTaps, 'a reload lost the tap count')
      ok(st().wallClock > 0, 'a reload restored a save with no wall clock')
      live = keptLive                    // the reload imitation is over; give the modules back the
                                         // identity they cached before it started

      // 6 · a degraded store is retried, and recovering from it is silent but complete.
      var fake = {}
      var fakeLS = {
        getItem: function (k) {
          return Object.prototype.hasOwnProperty.call(fake, k) ? fake[k] : null
        },
        setItem: function (k, v) { fake[k] = String(v) },
        removeItem: function (k) { delete fake[k] }
      }
      var realLS0 = null, swapped = false
      try {
        realLS0 = window.localStorage
        Object.defineProperty(window, 'localStorage', { configurable: true, value: fakeLS })
        swapped = true
      } catch (e) { swapped = false }
      if (swapped) {
        mem = {}; lastWritten = {}; storageOK = false; announced = true
        retryAt = now() + TUNE().CLOCK.AUTOSAVE_S
        ok(save(0) === false, 'a degraded save touched storage inside its retry window')
        ok(fake[slotKey(0)] === undefined, 'a degraded save wrote through anyway')
        retryAt = 0                      // the cooldown, expired
        st().t += 1
        ok(save(0) === true, 'a store that works again was never retried')
        ok(fake[slotKey(0)] !== undefined, 'the retried save did not reach storage')
        ok(storageOK === true, 'a successful write did not clear the degraded flag')
        ok(announced === false, 'recovery did not release the announcement latch')

        // 7 · what one autosave costs in synchronous storage calls.
        var calls = { get: 0, set: 0 }
        fake = {}
        fakeLS.getItem = function (k) {
          calls.get++
          return Object.prototype.hasOwnProperty.call(fake, k) ? fake[k] : null
        }
        fakeLS.setItem = function (k, v) { calls.set++; fake[k] = String(v) }
        mem = {}; lastWritten = {}; storageOK = true; retryAt = 0
        st().t += 1
        save(2)
        ok(calls.get === 1, 'the first save of a session read the slot ' + calls.get + ' times')
        var n = 5, si
        calls.get = 0; calls.set = 0
        for (si = 0; si < n; si++) { st().t += TUNE().CLOCK.AUTOSAVE_S; save(2) }
        ok(calls.get === 0, 'an autosave still reads the slot back: ' + calls.get + ' getItem calls')
        ok(calls.set === 2 * n, 'an autosave wrote ' + (calls.set / n) + ' keys, expected 2')
        ok(fake[slotKey(2) + '.bak'] !== fake[slotKey(2)] && fake[slotKey(2) + '.bak'] !== undefined,
          'the rolling backup stopped being the previous distinct write')
        // The guarantee the read was carrying: .bak is the slot's previous contents, exactly.
        var prevSlot = fake[slotKey(2)]
        st().t += TUNE().CLOCK.AUTOSAVE_S
        save(2)
        ok(fake[slotKey(2) + '.bak'] === prevSlot, 'the .bak is no longer the previous slot write')

        try {
          Object.defineProperty(window, 'localStorage', { configurable: true, value: realLS0 })
        } catch (e) { /* the property is gone for this page; mem still carries the session */ }
      }

      // 8 · storage that throws on every call: play continues, exactly one warning is emitted.
      mem = {}; lastWritten = {}; storageOK = true; retryAt = 0; announced = false
      var realWarn = console.warn, warnCount = 0
      console.warn = function () { warnCount++ }
      var realLS = null, hadLS = false
      try {
        realLS = window.localStorage
        hadLS = true
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get: function () { throw new Error('SecurityError') }
        })
      } catch (e) { hadLS = false }
      if (hadLS) {
        save(0); save(0); load(0)
        console.warn = realWarn
        try {
          Object.defineProperty(window, 'localStorage', { configurable: true, value: realLS })
        } catch (e) { /* the property is gone for this page; mem still carries the session */ }
        ok(warnCount === 1, 'a hostile localStorage produced ' + warnCount + ' warnings, expected 1')
        ok(storageOK === false, 'a throwing localStorage did not degrade to memory')
        ok(mem[slotKey(0)] !== undefined, 'the in-memory mirror was not written after degrading')
        ok(load(0) !== null, 'load could not read back the in-memory mirror: ' + lastError)
      } else {
        console.warn = realWarn
      }
    } catch (e) {
      f.push('threw: ' + (e && e.stack ? e.stack : e))
    }

    mem = savedMem; storageOK = savedOK; retryAt = savedRetry
    announced = savedAnn; lastWritten = savedWritten; quiet = savedQuiet
    if (keptLive) live = keptLive
    curSlot = keptSlot
    adopt(deserialise(keep))
    sinceSave = 0
    return f
  }

  function parseB64 (b64) { return JSON.parse(utf8Decode(b64ToBytes(b64))) }

  // ───────────────────────────────────────────────────────────────────────────

  HY.state = {
    newGame: newGame,
    save: save,
    load: load,
    exportB64: exportB64,
    importB64: importB64,
    migrate: migrate,
    assertShape: assertShape,

    // The build's one wall clock, in seconds. loop.js reconciles against this rather than reading
    // Date.now() itself, because two readers is how the units drifted apart in the first place.
    now: now,

    // §6's generic module surface.
    init: init,
    tick: tick,
    serialise: serialise,
    deserialise: deserialise,

    CURRENT: CURRENT,
    get lastError () { return lastError },
    get lastBytes () { return lastBytes },
    get overBudget () { return lastBytes > budgetFor(st().act) },
    get slot () { return curSlot },
    __selftest: __selftest
  }

  // `state` is a getter with no setter: the live instance is read freely and written through
  // core.setStock, and an accidental `HY.state.state = x` throws under 'use strict' instead of
  // silently orphaning every module that cached it.
  Object.defineProperty(HY.state, 'state', {
    enumerable: true,
    get: st
  })
})(window.HY = window.HY || {})
