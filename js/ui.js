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
    CONSOLE_ROW_FALLBACK: 19,
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
    SOONER: -1, LATER: 1
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
    litterProcessed: 'litter processed',
    utilisation: 'utilisation',
    conduction: 'conduction',
    onFloor: 'on the floor',
    forSale: 'for sale',
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
    toastReset: 'settings reset'
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

  // Currency glyphs, from BIBLE §2.1. One name, one symbol, one unit.
  var GLYPH = { biomass: 'g', sugar: 'sug', minerals: '⛬', signal: 'Σ', insight: 'Ψ' }

  // 06 §4.4. Inline path data, 24 × 24, stroke=currentColor. No emoji, no icon font, no asset.
  var TAB_SLOTS = [
    { key: 'forest', label: 'forest', d: ['M12 3.5 L18.5 13.5 H5.5 Z', 'M12 13.5 V20.5'] },
    { key: 'mind',
      label: 'mind',
      d: ['M12 4.2 a2 2 0 1 0 .01 0 Z', 'M5.4 15.4 a2 2 0 1 0 .01 0 Z',
        'M18.6 15.4 a2 2 0 1 0 .01 0 Z', 'M11.2 7.6 L6.6 13.6', 'M12.8 7.6 L17.4 13.6',
        'M7.4 16.6 H16.6'] },
    { key: 'flush',
      label: 'flush',
      d: ['M4.5 13.2 a7.5 5.4 0 0 1 15 0 Z', 'M10.2 13.2 V19 a1.8 1.8 0 0 0 3.6 0 V13.2'] },
    { key: 'pact',
      label: 'pact',
      d: ['M10 7.5 a4.5 4.5 0 0 0 0 9', 'M14 7.5 a4.5 4.5 0 0 1 0 9', 'M10 12 H14'] },
    { key: 'log', label: 'log', d: ['M4.5 7.5 H19.5', 'M4.5 12 H19.5', 'M4.5 16.5 H13'] }
  ]
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
  // THE CONSOLE
  // log.js owns the strings and renders into the element this module hands it. `announce` is the
  // one path by which the interface itself may speak — a shortfall, a refusal — and it writes into
  // the same single aria-live region, so a screen reader hears one thing per event and no more.
  // ───────────────────────────────────────────────────────────────────────────

  // Rows, not messages, are the unit: a long line costs you history, not legibility (§7 C15).
  function trimConsole () {
    var stack = view.consoleInner
    var budget = U.CONSOLE_ROWS * view.consoleRowPx
    var guard = 0
    while (stack.scrollHeight > budget && stack.firstChild && stack.childNodes.length > 1) {
      stack.removeChild(stack.firstChild)
      if (++guard > U.CONSOLE_ROWS * 8) break
    }
  }

  function announce (str) {
    if (!view || !str) return
    var stack = view.consoleInner
    var prev = stack.lastChild
    if (prev && prev.firstChild) prev.firstChild.textContent = '. '
    var lineEl = el('div', 'console-line')
    lineEl.appendChild(el('span', 'console-gutter', '> '))
    lineEl.appendChild(el('span', 'console-text', str))
    if (!reducedMotion()) lineEl.className = 'console-line console-line-enter'
    stack.appendChild(lineEl)
    trimConsole()
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
    v.hero = hero
    bindPress(hero, onHero, { feel: 'extend', quiet: true })
    scroll.appendChild(hero)
    scroll.appendChild(el('div', 'tail'))

    main.appendChild(scroll)
    shell.appendChild(main)

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
      t.appendChild(glyphSvg(spec.d, 24))
      t.appendChild(el('span', 'tab-lab', spec.label))
      t.appendChild(el('span', 'tab-ind'))
      bindPress(t, function () { setTab(spec.key) })
      bar.appendChild(t)
      v.tabs.push({ key: spec.key, el: t, index: idx, earned: false, badge: null })
    })
    shell.appendChild(bar)

    // ── the console: the only aria-live region in the game ──
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
    v.consoleRowPx = U.CONSOLE_ROW_FALLBACK
    shell.appendChild(con)

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

    var w = win()
    if (w && w.getComputedStyle) {
      var lh = parseFloat(w.getComputedStyle(view.consoleInner).lineHeight)
      if (lh > 0 && isFinite(lh)) view.consoleRowPx = lh
    }
    if (LOG() && LOG().mount) LOG().mount(view.consoleInner)

    on(view.scroll, 'scroll', function () {
      setData(view.ledger, 'scrolled', view.scroll.scrollTop > 0 ? '1' : '0')
      view.scrolling = true
      if (view.scrollT) clearTimeout(view.scrollT)
      view.scrollT = setTimeout(function () { view.scrolling = false }, U.SCROLL_QUIET_MS)
    })
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

  function onHero () {
    var s = liveState()
    if (!s) return
    if (LOG() && LOG().notifyInput) LOG().notifyInput()
    if (s.act === 1 && A1() && A1().onExtend) A1().onExtend()
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
    var done = 0
    for (var i = 0; i < n; i++) {
      if (!a.buyTip()) break
      done += 1
    }
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
    // player was looking at moves.
    view.stack.appendChild(p.view.el)
    if (!reducedMotion()) p.view.el.classList.add('reveal')
    haptic(U.HAP_REVEAL, 'ui.reveal')
    return p
  }

  // The Act III cold shift: one attribute, cross-faded by the stylesheet over 2,600 ms.
  function setAct (n) {
    var d = doc()
    if (!d || !view) return n
    view.act = n
    if (n >= 3) d.documentElement.dataset.act = '3'
    if (n >= 2) {
      view.stage = 2
      setData(view.shell, 'stage', '2')
      show(view.tabbar, true)
      layout()
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

  function revealFlags (s) {
    var a = A1()
    if (!a || !a.reveals || !s || s.act !== 1) return COLD
    try { return a.reveals() } catch (e) { return COLD }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER — from the one rAF. Reads state, writes only what changed.
  // ───────────────────────────────────────────────────────────────────────────

  function rate (v, key, value, dt) {
    var r = v.rates[key]
    if (!r) {
      v.rates[key] = { last: value, v: 0 }
      return
    }
    if (dt <= 0) return
    var inst = (value - r.last) / dt
    r.last = value
    r.v += (inst - r.v) * (1 - Math.exp(-dt / U.RATE_TAU_S))
  }

  function rateOf (v, key) { return v.rates[key] ? v.rates[key].v : 0 }

  // Rates are measured, never re-derived. There is exactly one copy of every production formula and
  // it lives in the simulation; an EMA over the display slot is honest and costs four subtractions
  // a tenth of a second.
  function updateRates (v, s, dt) {
    rate(v, 'biomass', num(s.res.biomass), dt)
    rate(v, 'sugar', num(s.res.sugar), dt)
    rate(v, 'minerals', num(s.res.minerals), dt)
    rate(v, 'signal', num(s.res.signal), dt)
  }

  function stage (v, s, rev) {
    var want = s.act >= 2 ? 2 : (rev.market ? 1 : 0)
    if (want === v.stage) return
    v.stage = want
    setData(v.shell, 'stage', String(want))
    layout()
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

  function paintLedger (v, s, rev) {
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
        setRaw(r3.rate, C().fmtTime(num(s.res.sugar) / Math.max(1e-9, -ns)), '')
        setData(r3.rate, 'sign', 'neg')
      } else {
        setSlot(r3.rate, STR.nothing, '')
        setData(r3.rate, 'sign', 'zero')
      }
    } else {
      show(r3.el, false)
    }

    // The one asymmetry in the strip: alone on screen, biomass is the display size; it steps down
    // to the hero size the moment a second row arrives.
    setData(r0.el, 'lead', shown === 1 ? 'solo' : '1')
    show(v.gear, shown > 1)
  }

  function paintHero (v, s) {
    setText(v.heroLab, STR.extend)
    var state = 'idle'
    if (s.act === 1 && A1() && A1().totalSubstrate && !(A1().totalSubstrate() > 0)) {
      state = 'disabled'
    }
    setData(v.hero, 'state', state)
    setAttr(v.hero, 'aria-label', STR.extend)
  }

  // The status strip is not a live region: a counter that changes ten times a second must never be
  // one. Each row is a group whose label is recomputed at most every three seconds (06 §8.4).
  function paintAria (v, s) {
    setAttr(v.ledgerRows[0].el, 'aria-label',
      STR.biomass + ', ' + C().fmtMass(num(s.res.biomass)) + ', ' +
      (rateOf(v, 'biomass') > 0 ? 'rising' : 'steady'))
    if (!v.ledgerRows[1].el.hidden) {
      var cap = A1() && A1().sugarCap ? A1().sugarCap() : 0
      setAttr(v.ledgerRows[1].el, 'aria-label',
        STR.sugar + ', ' + C().fmt(num(s.res.sugar)) + ' of ' + C().fmt(cap))
    }
    if (!v.ledgerRows[2].el.hidden) {
      setAttr(v.ledgerRows[2].el, 'aria-label', STR.minerals + ', ' + C().fmt(num(s.res.minerals)))
    }
    if (!v.ledgerRows[3].el.hidden) {
      var e = E1()
      setAttr(v.ledgerRows[3].el, 'aria-label',
        STR.netSugar + ', ' + C().fmt(e && e.netSugar ? e.netSugar() : 0) + ' per second')
    }
  }

  // No canvas ever carries information that is not also available as text on the same screen; this
  // label is the text form of the same fact (06 §7.9).
  function paintCanvasAria (v, s) {
    var m = A1() && A1().hyphae ? A1().hyphae() : 0
    setAttr(v.flux, 'aria-label',
      C().fmt(m) + ' metres of thread, ' + C().fmt(s.a1.tips) + ' tips, ' +
      (rateOf(v, 'biomass') > 0 ? 'growing' : 'still'))
  }

  var verbose = false

  function paintStatus (v, s) {
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
  function display (v, s, dt, t) {
    var rev = revealFlags(s)
    v.rev = rev
    updateRates(v, s, dt)
    stage(v, s, rev)
    v.order.forEach(function (id) {
      var p = v.panels[id]
      if (p.need(s, rev) && !p.shown) revealPanel(id)
      if (p.shown) p.sync(s, rev)
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

    paintLedger(view, s, view.rev || COLD)
    syncCards(view)

    if (t - view.lastDisplay >= U.DISPLAY_MS) {
      var dt = (t - view.lastDisplay) / 1000
      view.lastDisplay = t
      display(view, s, dt > 1 ? 1 : dt, t)
    }

    var cv = CANVAS()
    if (!cv) return
    if (cv.growNetwork && A1() && A1().hyphae) cv.growNetwork(A1().hyphae())
    if (cv.drawNet) cv.drawNet()
    // Nothing draws while the finger is moving: this is worth ~1.5 ms per frame during the one
    // moment the player is most likely to notice jank (06 §6.7 rule 8).
    if (!view.scrolling && cv.drawFlux) cv.drawFlux(t)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT I PANELS
  // Each entry is { need, build, sync }. `need` is the reveal predicate, evaluated every display
  // slot; the panel is constructed once, on its first true, and appended at the bottom.
  // ═══════════════════════════════════════════════════════════════════════════

  function def (v, id, need, build) {
    var p = { id: id, shown: false, view: null, sync: function () {} }
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
        setMass(amount, held)
        setText(pos, interp(STR.eaten, { n: order }))
        bar.set(cap > 0 ? held / cap : 0, '', C().fmtMass(held) + ' of ' + C().fmtMass(cap))
        setText(capTxt, C().fmtMass(cap))
        r.label((TYPE_NAME[type] || type) + ', ' + C().fmtMass(held) + ', eaten ' + order)
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
    var costTxt = span(l0, 'row-name num', '')
    var minTxt = span(l0, 'row-sub num', '')
    var burst = el('div', 'burst')
    l0.appendChild(burst)

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
    span(l1, 'row-sub', STR.litterProcessed)
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
      pv.setCount(C().fmt(s.a1.tips))
      setRate(thru, A1() ? A1().throughputPerSec() : 0, 'g/s')
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
      var shortStr = interp(STR.short, { n: C().fmtMass(Math.max(0, g - num(s.res.biomass))) })
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
        e.sell(type, g)
        if (view) flashSlot(view.ledgerRows[1].val, 'gain')
        return
      }
      var unit = e.unitPrice(type)
      var stock = s.a1.mkt[e.TYPES.indexOf(type)].stock
      var ceiling = Math.min(unit > 0 ? num(s.res.sugar) / unit : 0, stock)
      g = (grams === null || grams === undefined) ? ceiling * frac : Math.min(grams, ceiling)
      if (!(g > 0)) { refuse(source); return }
      e.buy(type, g)
      if (view) flashSlot(view.ledgerRows[1].val, 'loss')
    }

    U.MARKET_BUY_G.forEach(function (g) {
      var b = btn('', C().fmt(g))
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
        buys.forEach(function (b) {
          var ok
          if (mode.sell) ok = num(s.a1.sub[type]) > 0
          else if (b.kind === 'abs') ok = num(s.res.sugar) >= b.g * unit && mkt.stock >= b.g
          else ok = num(s.res.sugar) > 0 && mkt.stock > 0
          setData(b.el, 's', ok ? 'afford' : 'want')
          b.el.dataset.short = interp(STR.short, {
            n: C().fmt(Math.max(0, b.g * unit - num(s.res.sugar))) + ' ' + GLYPH.sugar
          })
        })
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
    acts.appendChild(actionButton(STR.renegotiate, function () { if (E1()) E1().renegotiate(id) }))
    acts.appendChild(actionButton(STR.exit, function () { if (E1()) E1().exitContract(id) }))
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
      if (E1()) E1().acceptSolicitation(id)
    }))
    acts.appendChild(actionButton(STR.decline, function () {
      if (E1()) E1().declineSolicitation(id)
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
      setData(signBtn, 'state', e1.accepts(tree, t.volume, t.term, t.exclusive) ? 'idle' : 'locked')
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
      e1.signContract(id, t.volume, t.term, t.collateral, t.exclusive)
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
        setText(age, C().fmt(num(tree.age)) + ' y')
        setSlot(repNum, C().fmt(num(tree.rep)), 'rep')
        var d = E1().carbonDeficit(tree)
        dBar.set(d, '', Math.round(d * 100) + ' percent short of carbon')
        pips.set(num(tree.rep) / T().A1.REP_MAX, '',
          C().fmt(num(tree.rep)) + ' of ' + T().A1.REP_MAX)
        r.label(label + ', deficit ' + Math.round(d * 100) + ' percent, standing ' +
          C().fmt(num(tree.rep)))
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
      pv.setCount(s.a1.trees.length + ' · ' + C().fmt(num(s.a1.netRep)) + ' rep')
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
      PJ().purchase(entry.id)
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
      if (!A1().claimPatch(s.a1.patches + 1)) refuse(b)
    })
    acts.appendChild(claimBtn)
    r.line().appendChild(acts)
    pv.body.appendChild(r.el)

    p.__sync = function (s) {
      var A = T().A1
      var next = s.a1.patches + 1
      setText(have, interp(STR.places, { n: s.a1.patches, k: A.PATCH_MAX }))
      pv.setCount(s.a1.patches)
      if (next > A.PATCH_MAX) {
        setRaw(cost, STR.nothing, '')
        setText(gate, '')
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

  function definePanels (v) {
    def(v, 'floor', function (s, rev) { return rev.substrate }, buildFloor)
    def(v, 'tips', function (s, rev) { return rev.tips }, buildTips)
    def(v, 'market', function (s, rev) { return rev.market }, buildMarket)
    def(v, 'seasons', function (s, rev) { return rev.seasons }, buildSeasons)
    def(v, 'understory', function (s, rev) { return rev.trees }, buildUnderstory)
    def(v, 'adaptations', function (s, rev) { return rev.projects }, buildAdaptations)
    def(v, 'patches', needPatches, buildPatches)
    def(v, 'signal', function (s, rev) { return rev.signal }, buildSignal)
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

    // 4 · a five-row console, and it is the only live region
    ok(!!host.querySelector('.console'), 'D02: the console must exist')
    var inner = host.querySelector('.console-inner')
    ok(inner && inner.getAttribute('aria-live') === 'polite',
      'D02: the console is the aria-live region')
    ok(host.querySelectorAll('[aria-live]').length === 1,
      'D02: exactly one aria-live region exists')
    ok(inner && inner.childNodes.length <= 1, 'D02: the console holds at most one line at t=0')
    ok(U.CONSOLE_ROWS === 5, 'D02: the console is a five-row window')

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
      if (view && s) display(view, s, U.DISPLAY_MS / 1000, nowMs())
    },
    transition: transition,
    layout: layout,
    openSettings: openSettings,
    get mounted () { return !!view },
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
