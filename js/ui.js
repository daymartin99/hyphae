;(function (HY) {
  'use strict'

  // ═══════════════════════════════════════════════════════════════════════════
  // M16 · ui.js — the shell and every component.
  //
  // This module owns the DOM and nothing else. It reads `HY.state.state` freely and it changes
  // the world only by calling another module's exported command (BIBLE §6). The two exceptions
  // are documented at their call sites: `set` (settings) and `a1.consumptionOrder` (the player's
  // eating order) have no owning setter anywhere in the sim, and §3 gives them no other home.
  //
  // Everything is built programmatically because shell.html contains one empty div. Nothing here
  // writes innerHTML, at any time, for any reason (06 §9.4 lint 11).
  // ═══════════════════════════════════════════════════════════════════════════

  // Sibling modules are read lazily, inside functions, so load order cannot matter.
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
  // Every number this module uses that is not already in core.TUNE. Durations and curves that
  // appear here also appear in ui.css; where both exist the CSS is the renderer and this table is
  // the scheduler, and they are the same figure on purpose.
  // ───────────────────────────────────────────────────────────────────────────

  var U = {
    // shell (06 §4.3)
    PLATE_FRAC: [0.38, 0.22, 0.18],  // stage 0 / 1 / 2 as a fraction of shell height
    PLATE_MIN_PX: 40,
    CONSOLE_ROWS: 5,
    LEDGER_MAX_ROWS: 4,

    // motion (06 §6.2) — the scheduler's copies
    D_PRESS: 70, D_STATE: 120, D_FADE: 180, D_RELEASE: 220,
    D_MOVE: 240, D_REVEAL: 320, D_ACT: 2600,
    ACT1_CURTAIN_MS: 4000, ACT1_LINE_GAP_MS: 700, ACT1_HOLD_MS: 2400,

    // interaction (06 §5.5, §5.8, §5.11)
    LONGPRESS_MS: 420, LONGPRESS_SLOP_PX: 10,
    DESTRUCT_MS: 400,
    REPEAT_DELAY_MS: 500, REPEAT_MS_1: 167, REPEAT_MS_2: 83, REPEAT_ACCEL_MS: 1500,
    REPEAT_HAPTIC_EVERY: 3,
    COST_SETTLE_MS: 220,
    TOAST_MS: 2600,
    DOT_SEEN_MS: 1200, DOT_SEEN_FRAC: 0.5,

    // haptics (06 §6.8) — used only when feel.js is absent from the build
    HAP_PRESS: 8, HAP_REPEAT: 4, HAP_HOLD: 18, HAP_DESTRUCT: 22, HAP_REVEAL: 8, HAP_ERROR: 4,

    // display (06 §3.3, §8.4)
    DISPLAY_MS: 100,                 // the 10 Hz slot; every panel sync rides in it
    RATE_TAU_S: 1.6,                 // s, EMA time constant for a displayed rate
    RATE_ZERO: 1e-6,                 // below this a rate renders as `— /s`, not `+0.00 /s`
    ARIA_STRIP_MS: 3000, ARIA_CANVAS_MS: 5000, ARIA_STATUS_MS: 5000,
    FLASH_MS: 470,                   // discrete gain: 90 ramp + 60 hold + 320 return
    SCROLL_QUIET_MS: 120,

    // meters (06 §5.6)
    PIPS: 5,
    ASCII_N: 20, ASCII_FULL: '▓', ASCII_HEAD: '▒', ASCII_EMPTY: '░',
    SPARK: '▁▂▃▄▅▆▇█', SPARK_N: 10,

    // Act I panel data
    BURST_5_AT: 5, BURST_MAX_AT: 20, BURST_MAX_STEPS: 64,
    MARKET_BUY_G: [1000, 10000],     // 01 §5A.5's two fixed sizes
    MARKET_FRAC: 0.25,
    SUGAR_WARN_FRAC: 0.85,           // 06 §5.1: the cap hairline turns amber above this
    COVER_WARN: 0.75,                // 01 §6.8: the coverage bar reddens past this
    SLIDER_STEPS: 100,
    UP: -1, DOWN: 1
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STRINGS
  // One object, named slots, no fragment concatenation that assumes English word order
  // (06 §8.5). Act I text carries no capital letter (BIBLE D68); the capitals the design asks
  // for are applied by `text-transform` in the stylesheet, never baked into a string.
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
    ground: 'ground',
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
    seasonsLeft: '{n} left',
    perSec: '/s',

    claim: 'claim',
    claiming: 'claiming',
    places: '{n} of {k}',
    needsStanding: 'standing {n}',

    short: '{n} short',
    nothing: '—',

    theme: 'theme', haptics: 'haptics', motion: 'motion', slow: 'slow',
    verbose: 'spoken status', tier: 'detail', textSize: 'text size',
    save: 'save', reset: 'reset',
    auto: 'auto', dark: 'dark', light: 'light', on: 'on', off: 'off',
    high: 'high', med: 'med', low: 'low',
    textSizeNote: 'text follows the size your phone is set to.',
    copy: 'copy', paste: 'load', close: 'done',
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

  // 06 §4.4. Inline path data, 24 × 24 viewBox, stroke=currentColor. No emoji, no icon font.
  var TAB_SLOTS = [
    { key: 'forest', label: 'forest', d: ['M12 3.5 L18.5 13.5 H5.5 Z', 'M12 13.5 V20.5'] },
    { key: 'mind', label: 'mind',
      d: ['M12 4.2 a2 2 0 1 0 .01 0 Z', 'M5.4 15.4 a2 2 0 1 0 .01 0 Z',
        'M18.6 15.4 a2 2 0 1 0 .01 0 Z', 'M11.2 7.6 L6.6 13.6', 'M12.8 7.6 L17.4 13.6',
        'M7.4 16.6 H16.6'] },
    { key: 'flush', label: 'flush',
      d: ['M4.5 13.2 a7.5 5.4 0 0 1 15 0 Z', 'M10.2 13.2 V19 a1.8 1.8 0 0 0 3.6 0 V13.2'] },
    { key: 'pact', label: 'pact',
      d: ['M10 7.5 a4.5 4.5 0 0 0 0 9', 'M14 7.5 a4.5 4.5 0 0 1 0 9', 'M10 12 H14'] },
    { key: 'log', label: 'log', d: ['M4.5 7.5 H19.5', 'M4.5 12 H19.5', 'M4.5 16.5 H13'] }
  ]
  var GEAR_D = [
    'M12 9.4 a2.6 2.6 0 1 0 .01 0 Z',
    'M12 3.6 v2 M12 18.4 v2 M3.6 12 h2 M18.4 12 h2',
    'M6.1 6.1 l1.4 1.4 M16.5 16.5 l1.4 1.4 M17.9 6.1 l-1.4 1.4 M7.5 16.5 l-1.4 1.4'
  ]

  var SVG_NS = 'http://www.w3.org/2000/svg'

  // ───────────────────────────────────────────────────────────────────────────
  // DOM PRIMITIVES
  // ───────────────────────────────────────────────────────────────────────────

  function doc () { return typeof document === 'undefined' ? null : document }

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

  function glyph (paths, size) {
    var s = doc().createElementNS(SVG_NS, 'svg'), i, p
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
    if (node.__t !== s) { node.__t = s; node.textContent = s }
  }

  function setAttr (node, k, v) {
    if (node.getAttribute(k) !== v) node.setAttribute(k, v)
  }

  function setData (node, k, v) {
    if (node.dataset[k] !== v) node.dataset[k] = v
  }

  function show (node, yes) {
    if (node.hidden === !yes) return
    node.hidden = !yes
  }

  function clear (node) {
    while (node.firstChild) node.removeChild(node.firstChild)
  }

  function fill (frac) { return C().clamp(frac, 0, 1) }

  function num (v) { return typeof v === 'number' && isFinite(v) ? v : 0 }

  // ───────────────────────────────────────────────────────────────────────────
  // MOTION, THEME, HAPTICS
  // ───────────────────────────────────────────────────────────────────────────

  function osReducedMotion () {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false }
  }

  function reducedMotion () {
    var s = liveState()
    if (s && s.set && s.set.reduceMotion !== null && s.set.reduceMotion !== undefined) {
      return !!s.set.reduceMotion
    }
    return osReducedMotion()
  }

  // Every haptic in the build funnels through here. When feel.js is present it owns the
  // duty-cycle governor and the settings toggle; when it is not, this is the whole policy.
  function haptic (ms, event, params) {
    var f = FEEL()
    if (f && f.feel) { f.feel(event || 'ui.tap', params || null); return }
    var s = liveState()
    if (s && s.set && s.set.haptics === false) return
    if (reducedMotion()) return
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(ms) } catch (e) { /* a refused vibration is not an error */ }
    }
  }

  function liveState () {
    try { return STATE() ? S() : null } catch (e) { return null }
  }

  function setTheme (t) {
    var d = doc()
    if (!d) return t
    if (t !== 'auto' && t !== 'dark' && t !== 'light') t = 'auto'
    d.documentElement.dataset.theme = t
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

  function store (k, v) {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v) } catch (e) { /* private mode */ }
  }

  function recall (k) {
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null } catch (e) { return null }
  }

  // 06 §3.3 R1. Where `tnum` is unavailable the digits jitter as they interpolate, which is the
  // single ugliest thing an idle game can do; the fallback is the mono stack.
  function hasTabular (probe) {
    try {
      var cv = doc().createElement('canvas').getContext('2d')
      if (!cv) return true
      var f = getComputedStyle(probe).getPropertyValue('--font-ui')
      cv.font = '500 17px ' + (f || 'sans-serif')
      return Math.abs(cv.measureText('111111').width - cv.measureText('000000').width) < 0.5
    } catch (e) { return true }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRESS, LONG-PRESS, REPEAT
  // The press contract of 06 §6.3: the action fires on `pointerdown`, not on `click`, which
  // removes ~90 ms of perceived latency. It is safe because no press bound this way is
  // destructive or irreversible — the destructive path is the 400 ms hold below.
  // ───────────────────────────────────────────────────────────────────────────

  function bindPress (node, fn, opts) {
    opts = opts || {}
    var down = false
    on(node, 'pointerdown', function (e) {
      if (e.button) return
      down = true
      node.dataset.press = '1'
      if (!opts.silent) haptic(U.HAP_PRESS, opts.feel || 'ui.press')
      if (!opts.onUp && fn) fn(e)
    })
    var up = function (e) {
      if (!down) return
      down = false
      node.dataset.press = '0'
      if (opts.onUp && fn) fn(e)
    }
    on(node, 'pointerup', up)
    on(node, 'pointercancel', up)
    on(node, 'pointerleave', up)
    // Keyboard parity: Space/Enter must do exactly what the thumb does (06 §8.3).
    on(node, 'keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter') return
      if (e.repeat) return
      node.dataset.press = '1'
      if (fn) fn(e)
    }, false)
    on(node, 'keyup', function () { node.dataset.press = '0' })
    return node
  }

  function bindLongPress (node, fn) {
    var t = null, sx = 0, sy = 0
    on(node, 'pointerdown', function (e) {
      if (e.button) return
      sx = e.clientX; sy = e.clientY
      node.dataset.hold = '1'
      t = setTimeout(function () {
        node.dataset.hold = '0'
        haptic(U.HAP_HOLD, 'ui.longpress')
        fn()
      }, U.LONGPRESS_MS)
    })
    var cancel = function () { if (t) clearTimeout(t); t = null; node.dataset.hold = '0' }
    on(node, 'pointermove', function (e) {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > U.LONGPRESS_SLOP_PX) cancel()
    })
    on(node, 'pointerup', cancel)
    on(node, 'pointercancel', cancel)
    on(node, 'pointerleave', cancel)
    return node
  }

  // 06 §5.11. Auto-repeat exists because the player will press `+1` five times at minute one and
  // the row must not punish them for it. It stops the instant the purchase stops being possible.
  function bindRepeat (node, fn, stillOk) {
    var timer = null, t0 = 0, count = 0
    function stop () { if (timer) clearTimeout(timer); timer = null; count = 0 }
    function step () {
      if (!stillOk()) { stop(); return }
      fn()
      count += 1
      if (count % U.REPEAT_HAPTIC_EVERY === 0) haptic(U.HAP_REPEAT, 'ui.repeat')
      var fast = (nowMs() - t0) > (U.REPEAT_DELAY_MS + U.REPEAT_ACCEL_MS)
      timer = setTimeout(step, fast ? U.REPEAT_MS_2 : U.REPEAT_MS_1)
    }
    bindPress(node, function () {
      if (!stillOk()) { haptic(U.HAP_ERROR, 'ui.error'); shortfallLine(node); return }
      fn()
      t0 = nowMs()
      timer = setTimeout(step, U.REPEAT_DELAY_MS)
    }, { silent: false })
    on(node, 'pointerup', stop)
    on(node, 'pointercancel', stop)
    on(node, 'pointerleave', stop)
    on(node, 'keyup', stop)
    return node
  }

  function shortfallLine (node) {
    var msg = node.dataset.short
    if (msg) announce(msg)
  }

  function nowMs () {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
  }

  // ───────────────────────────────────────────────────────────────────────────
  // NUMBER SLOTS · 06 §3.3
  // A value is two spans: a mantissa and a suffix one step dimmer. The slot's width is reserved
  // in `ch` from the maximum expected string, never measured, so the layout cannot reflow when a
  // number grows a digit (R3).
  // ───────────────────────────────────────────────────────────────────────────

  function slot (cls) {
    var n = el('span', cls + ' num')
    var m = el('span', 'mant')
    var u = el('span', 'unit')
    n.appendChild(m)
    n.appendChild(u)
    n.__m = m
    n.__u = u
    n.__flash = 0
    return n
  }

  function splitNum (str) {
    var i = str.lastIndexOf(' ')
    if (i < 0) return [str, '']
    return [str.slice(0, i), str.slice(i + 1)]
  }

  // R4: a suffix crossing cross-fades the suffix span alone; the mantissa always snaps.
  function setSlot (n, str, unit, value) {
    var parts = splitNum(str)
    var mant = parts[0]
    var suf = unit === undefined ? parts[1] : (parts[1] ? parts[1] + ' ' + unit : unit)
    if (n.__m.__t !== mant) {
      var first = n.__m.__t === undefined
      n.__m.__t = mant
      n.__m.textContent = mant
      // R4 opt-in: only slots handed a magnitude flash, so labels and static
      // strings never do. The first paint is not a change and must stay quiet.
      if (typeof value === 'number' && !first && value !== n.__flash) {
        flash(n, value < n.__flash ? 'loss' : 'gain')
      }
      if (typeof value === 'number') n.__flash = value
    }
    if (n.__u.__t !== suf) {
      var had = n.__u.__t !== undefined && n.__u.__t !== ''
      n.__u.__t = suf
      n.__u.textContent = suf
      if (had && !reducedMotion()) {
        n.__u.dataset.fade = 'in'
        // Re-arm by removing the attribute on the next frame; the animation is 180 ms and this
        // is the only place in the build that touches it.
        setTimeout(function () { delete n.__u.dataset.fade }, U.D_FADE)
      }
    }
  }

  function setMass (n, g) { setSlot(n, C().fmtMass(g), undefined, g) }

  // R6: rates are always signed and always suffixed. A hard zero is information; a floating zero
  // is noise, so zero renders as an em dash.
  function setRate (n, v, unit) {
    var a = Math.abs(v)
    if (!(a > U.RATE_ZERO)) {
      setSlot(n, STR.nothing, unit || '/s')
      setData(n, 'sign', 'zero')
      return
    }
    var body = (v > 0 ? '+' : '−') + C().fmt(a)
    setSlot(n, body, unit || '/s', v)
    setData(n, 'sign', v > 0 ? 'pos' : 'neg')
  }

  // R4: a discrete gain ramps to --text-max and returns; a discrete loss ramps to --negative-text.
  // No transform, no digit animation, no counting down.
  function flash (n, kind) {
    if (reducedMotion()) return
    n.style.transition = 'color 90ms ' + 'cubic-bezier(.22,1,.36,1)'
    n.style.color = kind === 'loss' ? 'var(--negative-text)' : 'var(--text-max)'
    if (n.__flashT) clearTimeout(n.__flashT)
    n.__flashT = setTimeout(function () {
      n.style.transition = 'color 320ms linear'
      n.style.color = ''
    }, kind === 'loss' ? 90 : 150)
  }

  function ascii (frac) {
    var f = Math.round(fill(frac) * U.ASCII_N)
    if (f >= U.ASCII_N) return repeat(U.ASCII_FULL, U.ASCII_N)
    return repeat(U.ASCII_FULL, f) + U.ASCII_HEAD + repeat(U.ASCII_EMPTY, U.ASCII_N - f - 1)
  }

  function repeat (ch, n) {
    var out = ''
    for (var i = 0; i < n; i++) out += ch
    return out
  }

  function spark (series) {
    if (!series || !series.length) return ''
    var n = Math.min(U.SPARK_N, series.length)
    var start = series.length - n
    var lo = Infinity, hi = -Infinity, i, v
    for (i = start; i < series.length; i++) {
      v = series[i]
      if (!(v > 0)) continue
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    if (!isFinite(lo) || !isFinite(hi)) return ''
    var span = hi - lo
    var out = ''
    for (i = start; i < series.length; i++) {
      v = span > 0 ? (series[i] - lo) / span : 0.5
      out += U.SPARK.charAt(C().clamp(Math.round(v * (U.SPARK.length - 1)), 0, U.SPARK.length - 1))
    }
    return out
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COMPONENTS · 06 §5. Each returns its element with a small imperative surface attached.
  // ───────────────────────────────────────────────────────────────────────────

  // (a) fill bar · (b) pips · (c) ASCII. They are not interchangeable (06 §5.6).
  function meter (kind, value) {
    var n, f, i, p, pips
    if (kind === 'pips') {
      n = el('div', 'pips')
      n.setAttribute('role', 'progressbar')
      pips = []
      for (i = 0; i < U.PIPS; i++) { p = el('span', 'pip'); pips.push(p); n.appendChild(p) }
      n.set = function (v, tone, text) {
        var k = Math.round(fill(v) * U.PIPS)
        for (var j = 0; j < U.PIPS; j++) setData(pips[j], 'on', j < k ? '1' : '0')
        if (tone) setData(n, 'tone', tone)
        setAttr(n, 'aria-valuenow', String(k))
        setAttr(n, 'aria-valuemin', '0')
        setAttr(n, 'aria-valuemax', String(U.PIPS))
        if (text) setAttr(n, 'aria-valuetext', text)
      }
    } else if (kind === 'ascii') {
      n = el('span', 'ascii')
      n.setAttribute('role', 'progressbar')
      n.set = function (v, tone, text) {
        setText(n, ascii(v))
        setAttr(n, 'aria-valuenow', String(Math.round(fill(v) * 100)))
        setAttr(n, 'aria-valuemin', '0')
        setAttr(n, 'aria-valuemax', '100')
        if (text) setAttr(n, 'aria-valuetext', text)
      }
    } else {
      n = el('div', 'meter')
      n.setAttribute('role', 'progressbar')
      f = el('div', 'meter-fill')
      n.appendChild(f)
      n.set = function (v, tone, text, tick) {
        f.style.setProperty('--v', fill(v).toFixed(4))
        if (tone !== undefined) {
          if (tone) setData(n, 'tone', tone); else delete n.dataset.tone
        }
        setAttr(n, 'aria-valuenow', String(Math.round(fill(v) * 100)))
        setAttr(n, 'aria-valuemin', '0')
        setAttr(n, 'aria-valuemax', '100')
        if (text) setAttr(n, 'aria-valuetext', text)
        if (tick !== undefined && tick !== null) {
          if (!n.__tick) { n.__tick = el('div', 'meter-tick'); n.appendChild(n.__tick) }
          n.__tick.style.setProperty('--t', fill(tick).toFixed(4))
        }
      }
    }
    n.set(value === undefined ? 0 : value)
    return n
  }

  function panel (id, spec) {
    spec = spec || {}
    var n = el('section', 'panel')
    n.dataset.panel = id
    var head = el('header', 'panel-head')
    var title = el('h2', 'panel-title', spec.title || id)
    var count = el('span', 'panel-count num')
    head.appendChild(title)
    head.appendChild(count)
    var body = el('div', 'panel-body')
    n.appendChild(head)
    n.appendChild(body)
    n.setAttribute('aria-labelledby', 'p-' + id)
    title.id = 'p-' + id
    var view = {
      id: id, el: n, head: head, body: body,
      setTitle: function (s) { setText(title, s) },
      setCount: function (s) { setText(count, s === null || s === undefined ? '' : String(s)) },
      empty: function (text) {
        if (!view.__empty) { view.__empty = el('p', 'panel-empty'); body.appendChild(view.__empty) }
        setText(view.__empty, text)
        show(view.__empty, true)
      },
      unempty: function () { if (view.__empty) show(view.__empty, false) }
    }
    if (spec.count !== undefined) view.setCount(spec.count)
    return view
  }

  // The card IS the button (06 §5.4). A separate BUY inside a card doubles the tap targets and
  // halves the hit area.
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
    var desc = el('p', 'card-desc', spec.desc || '')
    n.appendChild(top)
    n.appendChild(desc)
    var dot = null
    var view = {
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
    if (spec.onPick) bindPress(n, spec.onPick)
    return view
  }

  // The workhorse. Three or four fixed-height lines, so a value growing a digit never changes the
  // row height (06 §5.5).
  function row (spec) {
    spec = spec || {}
    var interactive = !!(spec.onPick || spec.onHold || spec.expand)
    var n = interactive ? btn('row') : el('div', 'row')
    var lines = []
    var expand = null
    var view = {
      el: n,
      line: function (i) {
        while (lines.length <= i) {
          var l = el('div', 'row-line')
          lines.push(l)
          if (expand) n.insertBefore(l, expand); else n.appendChild(l)
        }
        return lines[i]
      },
      expander: function () {
        if (!expand) { expand = el('div', 'row-expand'); expand.hidden = true; n.appendChild(expand) }
        return expand
      },
      setExpanded: function (yes) {
        view.expander()
        show(expand, yes)
        setData(n, 'open', yes ? '1' : '0')
        setAttr(n, 'aria-expanded', yes ? 'true' : 'false')
      },
      isExpanded: function () { return !!expand && !expand.hidden }
    }
    if (spec.onPick) bindPress(n, spec.onPick)
    if (spec.onHold) bindLongPress(n, spec.onHold)
    return view
  }

  function line (parent, cls) {
    var l = el('div', 'row-line')
    parent.appendChild(l)
    if (cls) l.className = 'row-line ' + cls
    return l
  }

  function span (parent, cls, text) {
    var s = el('span', cls, text)
    parent.appendChild(s)
    return s
  }

  function seg (options, current, onPick) {
    var n = el('div', 'seg')
    n.setAttribute('role', 'group')
    var buttons = []
    options.forEach(function (o) {
      var b = btn('', o.label)
      b.dataset.value = o.value
      setAttr(b, 'aria-pressed', o.value === current ? 'true' : 'false')
      bindPress(b, function () { onPick(o.value); n.set(o.value) })
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

  // Every slider has a numeric readout and a step count; a slider with no number is a toy
  // (06 §5.10). `input[type=range]` carries arrows, Page, Home/End and the ARIA for free.
  function slider (spec) {
    var wrap = el('div', 'field')
    var top = el('div', 'field-top')
    var lab = el('span', 'field-lab', spec.label)
    var val = slot('field-val')
    top.appendChild(lab)
    top.appendChild(val)
    var input = el('input', 'slider')
    input.type = 'range'
    input.min = '0'
    input.max = String(spec.steps || U.SLIDER_STEPS)
    input.step = '1'
    input.value = '0'
    setAttr(input, 'aria-label', spec.label)
    var note = el('p', 'field-note')
    wrap.appendChild(top)
    wrap.appendChild(input)
    wrap.appendChild(note)
    function paint () {
      var p = Number(input.value) / Number(input.max)
      input.style.setProperty('--p', p.toFixed(4))
    }
    on(input, 'input', function () { paint(); if (spec.onInput) spec.onInput(Number(input.value)) }, false)
    wrap.input = input
    wrap.setValue = function (v) { input.value = String(v); paint() }
    wrap.setMax = function (m) {
      if (input.max !== String(m)) { input.max = String(m); paint() }
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
    var box = el('span', 'check-box')
    var lab = el('span', '', label)
    var n = el('span', 'check-note', note || '')
    b.appendChild(box)
    b.appendChild(lab)
    b.appendChild(n)
    setAttr(b, 'aria-pressed', 'false')
    bindPress(b, function () {
      var next = b.getAttribute('aria-pressed') !== 'true'
      setAttr(b, 'aria-pressed', next ? 'true' : 'false')
      onToggle(next)
    })
    b.value = function () { return b.getAttribute('aria-pressed') === 'true' }
    return b
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SHEET AND TOAST
  // There are no centred dialogs: a centred dialog on a phone puts its buttons in Zone C.
  // ───────────────────────────────────────────────────────────────────────────

  var openSheet = null

  function sheet (spec) {
    spec = spec || {}
    var host = view ? view.shell : doc().body
    var scrim = el('div', 'scrim')
    var n = el('div', 'sheet')
    n.setAttribute('role', 'dialog')
    n.setAttribute('aria-modal', 'true')
    var grab = el('div', 'sheet-grab')
    var title = el('h2', 'sheet-title', spec.title || '')
    title.tabIndex = -1
    title.id = 'sheet-title'
    n.setAttribute('aria-labelledby', title.id)
    var body = el('div', 'sheet-body')
    var foot = el('div', 'sheet-foot')
    n.appendChild(grab)
    n.appendChild(title)
    n.appendChild(body)
    n.appendChild(foot)

    var api = {
      el: n, body: body, foot: foot,
      open: function () { doOpen() },
      close: function () { doClose() }
    }

    ;(spec.buttons || []).forEach(function (b) {
      var button = btn('', b.label)
      if (b.destructive) {
        button.className = 'hold'
        var f = el('span', 'hold-fill')
        var lb = el('span', 'hold-lab', b.label)
        clear(button)
        button.appendChild(f)
        button.appendChild(lb)
        bindHold(button, function () { b.onPick(api) })
      } else {
        bindPress(button, function () { b.onPick(api) })
      }
      foot.appendChild(button)
    })

    var opener = null
    function doOpen () {
      if (openSheet && openSheet !== api) openSheet.close()
      opener = doc().activeElement
      host.appendChild(scrim)
      host.appendChild(n)
      // Force a frame so the transform transition has a start value to run from.
      void n.offsetHeight
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

    // A destructive sheet does not dismiss on a scrim tap; only Cancel, a swipe, or Escape.
    if (!spec.destructive) bindPress(scrim, doClose)
    on(n, 'keydown', function (e) {
      if (e.key === 'Escape') { doClose(); return }
      if (e.key !== 'Tab') return
      var f = focusables(n)
      if (!f.length) return
      var first = f[0], last = f[f.length - 1]
      if (e.shiftKey && doc().activeElement === first) { e.preventDefault(); last.focus() } else if (!e.shiftKey && doc().activeElement === last) { e.preventDefault(); first.focus() }
    }, false)

    var sy = 0, dragging = false
    on(n, 'pointerdown', function (e) { sy = e.clientY; dragging = true })
    on(n, 'pointerup', function (e) {
      if (dragging && e.clientY - sy > 96) doClose()
      dragging = false
    })

    if (spec.build) spec.build(body, api)
    return api
  }

  function focusables (root) {
    var list = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]')
    var out = [], i
    for (i = 0; i < list.length; i++) {
      if (list[i].disabled) continue
      if (list[i].tabIndex < 0) continue
      out.push(list[i])
    }
    return out
  }

  // The destructive commit: a 400 ms press-and-hold, never a double tap and never a typed word.
  function bindHold (node, fn) {
    var t = null
    function start (e) {
      if (e && e.button) return
      node.dataset.holding = '1'
      t = setTimeout(function () {
        node.dataset.holding = '0'
        haptic(U.HAP_DESTRUCT, 'ui.destruct')
        fn()
      }, U.DESTRUCT_MS)
    }
    function stop () { if (t) clearTimeout(t); t = null; node.dataset.holding = '0' }
    on(node, 'pointerdown', start)
    on(node, 'pointerup', stop)
    on(node, 'pointercancel', stop)
    on(node, 'pointerleave', stop)
    on(node, 'keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) start(null) } }, false)
    on(node, 'keyup', stop)
    return node
  }

  var toastEl = null, toastT = null
  function toast (msg, undo) {
    if (!view) return null
    if (!toastEl) {
      toastEl = el('div', 'toast')
      toastEl.setAttribute('role', 'status')
      toastEl.__label = el('span', '', '')
      toastEl.appendChild(toastEl.__label)
      view.shell.appendChild(toastEl)
    }
    setText(toastEl.__label, msg)
    if (toastEl.__undo) { toastEl.removeChild(toastEl.__undo); toastEl.__undo = null }
    if (undo) {
      var u = btn('toast-undo', 'undo')
      bindPress(u, function () { undo(); hide() })
      toastEl.appendChild(u)
      toastEl.__undo = u
    }
    setData(toastEl, 'open', '1')
    if (toastT) clearTimeout(toastT)
    toastT = setTimeout(hide, U.TOAST_MS)
    function hide () { if (toastEl) setData(toastEl, 'open', '0') }
    return toastEl
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE CONSOLE
  // log.js owns the strings and renders into the element this module hands it. `announce` is the
  // one path by which the interface itself may speak — a shortfall, a refusal — and it writes
  // into the same single aria-live region, so a screen reader hears exactly one thing per event.
  // ───────────────────────────────────────────────────────────────────────────

  function announce (str) {
    if (!view || !str) return
    var stack = view.consoleInner
    var prev = stack.lastChild
    if (prev && prev.firstChild) prev.firstChild.textContent = '. '
    var lineEl = el('div', 'console-line')
    var gut = el('span', 'console-gutter', '> ')
    var body = el('span', 'console-text', str)
    lineEl.appendChild(gut)
    lineEl.appendChild(body)
    if (!reducedMotion()) lineEl.className += ' console-line-enter'
    stack.appendChild(lineEl)
    trimConsole()
  }

  function trimConsole () {
    var stack = view.consoleInner
    var rowPx = view.consoleRowPx || 19
    var budget = U.CONSOLE_ROWS * rowPx
    var guard = 0
    while (stack.scrollHeight > budget && stack.firstChild && stack.childNodes.length > 1) {
      stack.removeChild(stack.firstChild)
      if (++guard > U.CONSOLE_ROWS * 8) break
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE SHELL
  // ───────────────────────────────────────────────────────────────────────────

  var view = null

  function buildShell (root) {
    var v = {
      root: root, panels: {}, order: [], rev: {}, rates: {}, cards: {},
      tabs: [], tab: null, stage: 0, plateH: 0, lastDisplay: 0, lastAria: 0,
      lastCanvasAria: 0, lastStatus: 0, scrolling: false, scrollT: 0, act: 1
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
    ledger.setAttribute('role', 'group')
    ledger.setAttribute('aria-label', STR.biomass)
    v.ledger = ledger
    v.ledgerRows = []
    var keys = ['biomass', 'sugar', 'minerals', 'net']
    for (var i = 0; i < U.LEDGER_MAX_ROWS; i++) v.ledgerRows.push(ledgerRow(ledger, keys[i]))
    v.ledgerRows[0].el.dataset.lead = 'solo'

    var gear = btn('gear')
    gear.appendChild(glyph(GEAR_D, 22))
    setAttr(gear, 'aria-label', STR.settings)
    gear.hidden = true
    bindPress(gear, openSettings)
    ledger.appendChild(gear)
    v.gear = gear
    scroll.appendChild(ledger)

    // ── the panel stack ──
    var stack = el('div', 'panels')
    v.stack = stack
    scroll.appendChild(stack)

    // ── the hero: always the last element in the scroll, forever ──
    var hero = btn('hero')
    var heroLab = el('span', 'hero-lab', STR.extend)
    hero.appendChild(heroLab)
    v.hero = hero
    v.heroLab = heroLab
    bindPress(hero, onHero)
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
      t.appendChild(glyph(spec.d, 24))
      t.appendChild(el('span', 'tab-lab', spec.label))
      t.appendChild(el('span', 'tab-ind'))
      bindPress(t, function () { setTab(spec.key) })
      bar.appendChild(t)
      v.tabs.push({ key: spec.key, el: t, index: idx, earned: false })
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
    cur.style.position = 'absolute'
    cur.style.insetInlineEnd = 'var(--gutter)'
    cur.style.bottom = 'calc(var(--con-pad) + env(safe-area-inset-bottom))'
    con.appendChild(cur)
    v.console = con
    v.consoleInner = inner
    v.consoleRowPx = 19
    shell.appendChild(con)

    // ── the coalesced spoken summary (06 §8.4), off by default ──
    var vh = el('div', 'vh')
    vh.setAttribute('role', 'status')
    v.statusVh = vh
    shell.appendChild(vh)

    root.appendChild(shell)
    return v
  }

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

  // ───────────────────────────────────────────────────────────────────────────
  // MOUNT
  // ───────────────────────────────────────────────────────────────────────────

  function mount (root) {
    var d = doc()
    if (!d) return null
    root = root || d.getElementById('app') || d.body
    clear(root)
    view = buildShell(root)

    setTheme(recall('hyphae.theme') || (liveState() ? liveState().set.theme : 'auto') || 'auto')
    applyMotionAttr()
    if (recall('hyphae.verbose') === '1') verbose = true

    if (!hasTabular(d.body)) d.documentElement.dataset.numfont = 'mono'

    var lh = 0
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      lh = parseFloat(window.getComputedStyle(view.consoleInner).lineHeight)
    }
    if (lh > 0 && isFinite(lh)) view.consoleRowPx = lh

    if (LOG() && LOG().mount) LOG().mount(view.consoleInner)

    on(view.scroll, 'scroll', function () {
      setData(view.ledger, 'scrolled', view.scroll.scrollTop > 0 ? '1' : '0')
      view.scrolling = true
      if (view.scrollT) clearTimeout(view.scrollT)
      view.scrollT = setTimeout(function () { view.scrolling = false }, U.SCROLL_QUIET_MS)
    })

    if (typeof window !== 'undefined') {
      on(window, 'resize', layout)
      on(window, 'orientationchange', layout)
    }
    layout()

    // loop.js owns the single rAF; when it is present we ride in it and add none of our own.
    if (HY.loop && HY.loop.onFrame) HY.loop.onFrame(function () { render(S()) })

    return view
  }

  function layout () {
    if (!view) return
    var h = view.shell.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 780)
    var px = Math.max(U.PLATE_MIN_PX, Math.round(h * U.PLATE_FRAC[view.stage]))
    if (px !== view.plateH) {
      view.plateH = px
      // Written directly, in one frame. Height is a layout property and is never transitioned;
      // the content beneath fades instead, and the resize lands under the fade (06 §4.3).
      view.shell.style.setProperty('--plate-px', px + 'px')
    }
    sizeCanvas(view.net)
    sizeCanvas(view.flux)
  }

  function sizeCanvas (cv) {
    var w = cv.clientWidth, h = cv.clientHeight
    if (!(w > 0 && h > 0)) return
    var dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2)
    var bw = Math.round(w * dpr), bh = Math.round(h * dpr)
    if (cv.width === bw && cv.height === bh) return
    cv.width = bw
    cv.height = bh
    var ctx = cv.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // The network is regenerable from (seed, n), so a resize is a legitimate re-seed and the
    // drawing module is told rather than guessed at.
    cv.dispatchEvent(new CustomEvent('hyphae:resize', { bubbles: true }))
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COMMANDS — every state change the interface can cause, in one place.
  // ───────────────────────────────────────────────────────────────────────────

  function onHero () {
    var s = liveState()
    if (!s) return
    if (LOG() && LOG().notifyInput) LOG().notifyInput()
    if (s.act === 1 && A1() && A1().onExtend) A1().onExtend()
  }

  function buyTips (n) {
    var a = A1()
    if (!a) return 0
    var done = 0
    for (var i = 0; i < n; i++) {
      if (!a.buyTip()) break
      done += 1
    }
    return done
  }

  function tipsAffordable () {
    var s = liveState(), a = A1()
    if (!s || !a) return 0
    var n = 0, sim = num(s.res.biomass), simM = num(s.res.minerals), t = s.a1.tips
    while (n < U.BURST_MAX_STEPS) {
      var cg = a.tipCost(t + n)
      var cm = a.tipMineralCost(t + n)
      if (sim < cg || simM < cm) break
      sim -= cg
      simM -= cm
      n += 1
    }
    return n
  }

  // `consumptionOrder` is player-ordered by §3 and no sim module exposes a setter for it. This is
  // the one legal home for the permutation, and it is kept minimal and total: a swap of two
  // adjacent entries, or nothing.
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
      if (sel && t.el.__badge) { t.el.removeChild(t.el.__badge); t.el.__badge = null }
    })
    return id
  }

  function revealTab (id) {
    if (!view) return false
    var t = null
    view.tabs.forEach(function (x) { if (x.key === id) t = x })
    if (!t || t.earned) return false
    t.earned = true
    setData(t.el, 'earned', '1')
    if (!view.tab) setTab(id)
    return true
  }

  function revealPanel (id) {
    if (!view) return null
    var p = view.panels[id]
    if (!p || p.shown) return p || null
    p.shown = true
    // Panels arrive at the bottom of the existing stack, never in the middle, so nothing the
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
    substrate: false, tips: false, sugar: false, market: false, seasons: false,
    trees: false, projects: false, mineralWarn: false, mineralGate: false,
    signal: false, decide: false
  }

  function revealFlags (s) {
    var a = A1()
    if (!a || !a.reveals || !s || s.act !== 1) return COLD
    try { return a.reveals() } catch (e) { return COLD }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER — called from the one rAF. Reads state, writes only what changed.
  // ───────────────────────────────────────────────────────────────────────────

  function render (s) {
    if (!view) return
    s = s || liveState()
    if (!s) return
    var t = nowMs()

    paintLedger(view, s)
    syncCards(view, s)

    if (t - view.lastDisplay >= U.DISPLAY_MS) {
      var dt = (t - view.lastDisplay) / 1000
      view.lastDisplay = t
      display(view, s, dt > 1 ? 1 : dt, t)
    }

    var cv = CANVAS()
    if (cv) {
      if (cv.growNetwork && A1() && A1().hyphae) cv.growNetwork(A1().hyphae())
      if (cv.drawNet) cv.drawNet()
      if (!view.scrolling && cv.drawFlux) cv.drawFlux(t)
      if (cv.setTier && tierPref !== 'auto' && view.__tier !== tierPref) {
        view.__tier = tierPref
        cv.setTier(tierPref.toUpperCase())
      }
    }
  }

  // The 10 Hz slot: rates, panel bodies, cooldown rings and every ARIA label.
  function display (v, s, dt, t) {
    var rev = revealFlags(s)
    updateRates(v, s, dt)
    stage(v, s, rev)
    v.order.forEach(function (id) {
      var p = v.panels[id]
      if (!p) return
      var need = p.need(s, rev)
      if (need && !p.shown) revealPanel(id)
      if (p.shown) p.sync(s, rev)
    })
    paintHero(v, s, rev)
    if (t - v.lastAria >= U.ARIA_STRIP_MS) { v.lastAria = t; paintAria(v, s) }
    if (t - v.lastCanvasAria >= U.ARIA_CANVAS_MS) { v.lastCanvasAria = t; paintCanvasAria(v, s) }
    if (verbose && t - v.lastStatus >= U.ARIA_STATUS_MS) { v.lastStatus = t; paintStatus(v, s) }
    seeDots(v, t)
  }

  // Rates are measured, never re-derived: there is exactly one copy of every production formula
  // and it lives in the sim. An EMA over the display slot is honest and costs four subtractions.
  function updateRates (v, s, dt) {
    rate(v, 'biomass', num(s.res.biomass), dt)
    rate(v, 'sugar', num(s.res.sugar), dt)
    rate(v, 'minerals', num(s.res.minerals), dt)
    rate(v, 'signal', num(s.res.signal), dt)
  }

  function rate (v, key, value, dt) {
    var r = v.rates[key]
    if (!r) { v.rates[key] = { last: value, v: 0 }; return }
    if (dt <= 0) return
    var inst = (value - r.last) / dt
    r.last = value
    var k = 1 - Math.exp(-dt / U.RATE_TAU_S)
    r.v += (inst - r.v) * k
  }

  function rateOf (v, key) { return v.rates[key] ? v.rates[key].v : 0 }

  function stage (v, s, rev) {
    var want = s.act >= 2 ? 2 : (rev.market ? 1 : 0)
    if (want === v.stage) return
    v.stage = want
    setData(v.shell, 'stage', String(want))
    layout()
  }

  // ── the ledger ──

  function paintLedger (v, s) {
    var rev = revealFlags(s)
    var shown = 0

    ledgerLine(v, 0, STR.biomass, function (r) {
      setMass(r.val, num(s.res.biomass))
      setRate(r.rate, rateOf(v, 'biomass') * yieldPerLitter(), ' g/s')
    })
    shown = 1

    if (rev.sugar) {
      shown += 1
      ledgerLine(v, 1, STR.sugar, function (r) {
        var cap = A1() && A1().sugarCap ? A1().sugarCap() : 0
        var held = num(s.res.sugar)
        setSlot(r.val, C().fmt(held) + ' / ' + C().fmt(cap), '')
        setRate(r.rate, rateOf(v, 'sugar'), ' g/s')
        show(r.cap, true)
        var f = cap > 0 ? held / cap : 0
        r.cap.style.setProperty('--v', fill(f).toFixed(4))
        setData(r.cap, 'tone', f > U.SUGAR_WARN_FRAC ? 'warn' : 'ok')
        var rot = held > cap ? (held - cap) * T().A1.ROT_RATE : 0
        rotLine(v, r, rot)
      })
    } else { show(v.ledgerRows[1].el, false) }

    if (rev.mineralWarn || num(s.res.minerals) > 0) {
      shown += 1
      ledgerLine(v, 2, STR.minerals, function (r) {
        setSlot(r.val, C().fmt(num(s.res.minerals)), '⬬')
        setRate(r.rate, rateOf(v, 'minerals'), ' /s')
      })
    } else { show(v.ledgerRows[2].el, false) }

    if (rev.trees) {
      shown += 1
      ledgerLine(v, 3, STR.netSugar, function (r) {
        var ns = E1() && E1().netSugar ? E1().netSugar() : 0
        setRate(r.val, ns, ' g/s')
        var book = E1() && E1().bookState ? E1().bookState() : null
        if (ns < 0 && book) {
          var reserve = num(s.res.sugar)
          setSlot(r.rate, C().fmtTime(reserve / Math.max(1e-9, -ns)), '')
          setData(r.rate, 'sign', 'neg')
        } else {
          setSlot(r.rate, STR.nothing, '')
          setData(r.rate, 'sign', 'zero')
        }
      })
    } else { show(v.ledgerRows[3].el, false) }

    // The one asymmetry in the strip: biomass is the display size while it is alone on screen.
    setData(v.ledgerRows[0].el, 'lead', shown === 1 ? 'solo' : '1')
    show(v.gear, shown > 1)
  }

  function ledgerLine (v, i, label, paint) {
    var r = v.ledgerRows[i]
    show(r.el, true)
    setText(r.lab, label)
    paint(r)
  }

  function rotLine (v, r, rot) {
    if (rot > 0) {
      if (!r.sub) {
        r.sub = el('div', 'ledger-sub')
        r.el.parentNode.insertBefore(r.sub, r.el.nextSibling)
      }
      show(r.sub, true)
      setText(r.sub, '− ' + C().fmt(rot) + ' g/s (' + STR.rot + ')')
    } else if (r.sub) { show(r.sub, false) }
  }

  // The ledger prints a mass, so a mass rate must be printed too; the measured derivative is
  // already in grams, so this is the identity and exists only to name that fact once.
  function yieldPerLitter () { return 1 }

  // ── the hero ──

  function paintHero (v, s, rev) {
    var lab = STR.extend
    var state = 'idle'
    if (s.act === 1) {
      var left = A1() && A1().totalSubstrate ? A1().totalSubstrate() : 1
      if (!(left > 0)) state = 'disabled'
    }
    setText(v.heroLab, lab)
    setData(v.hero, 'state', state)
    setAttr(v.hero, 'aria-label', lab)
  }

  // ── ARIA ──

  function paintAria (v, s) {
    var r0 = v.ledgerRows[0]
    setAttr(r0.el, 'aria-label',
      STR.biomass + ', ' + C().fmtMass(num(s.res.biomass)) + ', ' +
      (rateOf(v, 'biomass') > 0 ? 'rising' : 'steady'))
    if (!v.ledgerRows[1].el.hidden) {
      var cap = A1() && A1().sugarCap ? A1().sugarCap() : 0
      setAttr(v.ledgerRows[1].el, 'aria-label',
        STR.sugar + ', ' + C().fmt(num(s.res.sugar)) + ' of ' + C().fmt(cap))
    }
    if (!v.ledgerRows[2].el.hidden) {
      setAttr(v.ledgerRows[2].el, 'aria-label',
        STR.minerals + ', ' + C().fmt(num(s.res.minerals)))
    }
  }

  // No canvas ever carries information that is not also available as text on the same screen; the
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
  // more information than a blink, for less light (06 §6.4).
  function seeDots (v, t) {
    var k, c
    for (k in v.cards) {
      if (!Object.prototype.hasOwnProperty.call(v.cards, k)) continue
      c = v.cards[k]
      if (!c.isNew || !c.isNew()) continue
      var r = c.el.getBoundingClientRect
        ? c.el.getBoundingClientRect() : { top: 0, bottom: 0, height: 1 }
      var vh = (typeof window !== 'undefined' ? window.innerHeight : 780)
      var visible = Math.min(r.bottom, vh) - Math.max(r.top, 0)
      if (r.height > 0 && visible / r.height >= U.DOT_SEEN_FRAC) {
        if (!c.el.__dotAt) c.el.__dotAt = t
        else if (t - c.el.__dotAt >= U.DOT_SEEN_MS) c.seen()
      } else { c.el.__dotAt = 0 }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT I PANELS
  // Each entry is { need, build, sync }. `need` is the reveal predicate, evaluated every display
  // slot; the panel is constructed once, on its first true, and appended at the bottom.
  // ═══════════════════════════════════════════════════════════════════════════

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

  function def (v, id, need, build) {
    var p = { id: id, need: need, shown: false, view: null, sync: function () {} }
    v.panels[id] = p
    v.order.push(id)
    p.need = function (s, rev) {
      var yes = need(s, rev)
      if (yes && !p.view) {
        p.view = build(v, p)
        p.sync = p.__sync
      }
      return yes
    }
  }

  // Ground is a decision the moment the utilisation alarm can conceivably fire, or the moment the
  // second place is worth what you hold. Both figures are already in TUNE; neither is new.
  function needPatches (s, rev) {
    if (!rev.projects) return false
    if (s.a1.patches > 1 || s.a1.claimInFlight) return true
    if (num(s.res.cumBiomass) >= T().A1.PATCH[1].biomass) return true
    var u = A1() && A1().utilisation ? A1().utilisation() : 0
    return u >= T().A1.UTIL_ALARM
  }

  // ── THE FLOOR ──────────────────────────────────────────────────────────────

  function buildFloor (v, p) {
    var pv = panel('floor', { title: STR.p_floor })
    p.view = pv
    var rows = {}
    var util = row({})
    var utilLab = span(line(util.el), 'row-name', STR.utilisation)
    var utilNum = slot('row-num')
    utilLab.parentNode.appendChild(utilNum)
    var utilMeter = meter('fill', 0)
    var utilLine = line(util.el)
    utilLine.appendChild(utilMeter)
    utilMeter.style.flex = '1 1 auto'

    var cond = row({})
    var condLab = span(line(cond.el), 'row-name', STR.conduction)
    var condNum = span(condLab.parentNode, 'row-num', STR.nothing)
    cond.el.hidden = true

    p.__sync = function (s) {
      var types = s.a1.consumptionOrder
      var seen = {}
      var n = 0
      types.forEach(function (type) {
        if (s.a1.unlockedTypes.indexOf(type) < 0) return
        seen[type] = 1
        n += 1
        var r = rows[type]
        if (!r) { r = rows[type] = poolRow(type); pv.body.appendChild(r.el) }
        // Rows are re-ordered by re-appending: the DOM order IS the eating order, so the list a
        // screen reader walks and the list the simulation walks are one list.
        if (r.el.dataset.pos !== String(n)) {
          r.el.dataset.pos = String(n)
          pv.body.appendChild(r.el)
        }
        r.sync(s, n)
      })
      Object.keys(rows).forEach(function (k) { show(rows[k].el, !!seen[k]) })
      pv.setCount(n)

      pv.body.appendChild(util.el)
      var u = A1() && A1().utilisation ? A1().utilisation() : 0
      setSlot(utilNum, Math.round(fill(u) * 100) + '', '%')
      utilMeter.set(u, u >= T().A1.UTIL_ALARM ? 'warn' : '',
        Math.round(fill(u) * 100) + ' percent of what falls', T().A1.UTIL_ALARM)

      pv.body.appendChild(cond.el)
      show(cond.el, !!s.proj.flags.anastomosis)
      if (s.proj.flags.anastomosis) setText(condNum, STR.nothing)
    }
    return pv
  }

  function poolRow (type) {
    var r = row({ expand: true })
    var l0 = line(r.el)
    span(l0, 'row-name', TYPE_NAME[type] || type)
    var pos = span(l0, 'row-sub', '')
    var amount = slot('row-num')
    l0.appendChild(amount)
    var l1 = line(r.el)
    var bar = meter('ascii', 0)
    l1.appendChild(bar)
    var capTxt = span(l1, 'row-num', '')

    var ex = r.expander()
    var acts = el('div', 'row-actions')
    var up = btn('burst-btn', STR.sooner)
    var down = btn('burst-btn', STR.later)
    up.className = 'sheet-foot-like'
    ;[up, down].forEach(function (b) {
      b.className = ''
      b.style.minHeight = '44px'
      b.style.flex = '1'
      b.style.border = '1px solid var(--line-strong)'
      b.style.borderRadius = 'var(--r-md)'
      b.style.color = 'var(--text-primary)'
    })
    bindPress(up, function (e) { e.stopPropagation && e.stopPropagation(); reorderPool(type, U.UP) })
    bindPress(down, function (e) { e.stopPropagation && e.stopPropagation(); reorderPool(type, U.DOWN) })
    acts.appendChild(up)
    acts.appendChild(down)
    ex.appendChild(acts)

    bindPress(r.el, function () { r.setExpanded(!r.isExpanded()) })

    return {
      el: r.el,
      sync: function (s, order) {
        var held = num(s.a1.sub[type])
        var cap = E1() && E1().capOf ? E1().capOf(type) : 0
        setMass(amount, held)
        setText(pos, interp(STR.eaten, { n: String(order) }))
        bar.set(cap > 0 ? held / cap : 0, '', C().fmtMass(held) + ' of ' + C().fmtMass(cap))
        setText(capTxt, C().fmtMass(cap))
        setAttr(r.el, 'aria-label',
          (TYPE_NAME[type] || type) + ', ' + C().fmtMass(held) + ', eaten ' + order)
      }
    }
  }

  function interp (tpl, tok) {
    return tpl.replace(/\{(\w+)\}/g, function (m, k) {
      return tok[k] === undefined ? m : String(tok[k])
    })
  }

  // ── HYPHAL TIPS ────────────────────────────────────────────────────────────

  function buildTips (v, p) {
    var pv = panel('tips', { title: STR.p_tips })
    p.view = pv
    var r = row({})
    var l0 = line(r.el)
    var costTxt = span(l0, 'row-name', '')
    costTxt.className = 'row-name num'
    var minTxt = span(l0, 'row-sub num', '')
    var burst = el('div', 'burst')
    l0.appendChild(burst)

    var b1 = btn('', '+1')
    var b5 = btn('', '+5')
    var bMax = btn('', STR.max)
    b5.hidden = true
    bMax.hidden = true
    burst.appendChild(b1)
    burst.appendChild(b5)
    burst.appendChild(bMax)

    bindRepeat(b1, function () { buyTips(1) }, function () { return tipsAffordable() >= 1 })
    bindPress(b5, function () {
      if (tipsAffordable() < 1) { haptic(U.HAP_ERROR, 'ui.error'); shortfallLine(b5); return }
      buyTips(5)
    })
    bindPress(bMax, function () {
      var n = tipsAffordable()
      if (n < 1) { haptic(U.HAP_ERROR, 'ui.error'); shortfallLine(bMax); return }
      buyTips(n)
    })

    var l1 = line(r.el)
    span(l1, 'row-sub', STR.litterProcessed)
    var thru = slot('row-num')
    l1.appendChild(thru)
    pv.body.appendChild(r.el)

    // The cost updates after the press animation completes, not during, so the number the player
    // pressed is the number they saw (06 §5.11).
    var settle = 0
    p.__sync = function (s, rev) {
      pv.setCount(C().fmt(s.a1.tips))
      var t = nowMs()
      if (t >= settle) {
        var a = A1()
        var g = a ? a.tipCost(s.a1.tips) : 0
        var m = a ? a.tipMineralCost(s.a1.tips) : 0
        setText(costTxt, C().fmtMass(g))
        show(minTxt, rev.mineralWarn)
        if (rev.mineralWarn) {
          setText(minTxt, '· ' + C().fmt(m) + ' ⬬')
          minTxt.style.color = m > 0 ? 'var(--attention-dim)' : 'var(--text-locked)'
        }
        var afford = tipsAffordable()
        setData(b1, 's', afford >= 1 ? 'afford' : 'want')
        setData(b5, 's', afford >= 5 ? 'afford' : 'want')
        setData(bMax, 's', afford >= 1 ? 'afford' : 'want')
        b1.dataset.short = interp(STR.short, { n: C().fmtMass(Math.max(0, g - num(s.res.biomass))) })
        b5.dataset.short = b1.dataset.short
        bMax.dataset.short = b1.dataset.short
        setAttr(b1, 'aria-label', STR.growTip + ', ' + C().fmtMass(g) +
          (m > 0 ? ', ' + C().fmt(m) + ' minerals' : ''))
        show(b5, s.stats.purchases >= U.BURST_5_AT || s.a1.tips >= U.BURST_5_AT)
        show(bMax, s.a1.tips >= U.BURST_MAX_AT)
      }
      setRate(thru, A1() ? A1().throughputPerSec() : 0, ' g/s')
    }
    ;[b1, b5, bMax].forEach(function (b) {
      on(b, 'pointerdown', function () { settle = nowMs() + U.COST_SETTLE_MS })
    })
    return pv
  }

  // ── THE LITTER MARKET ──────────────────────────────────────────────────────

  function buildMarket (v, p) {
    var pv = panel('market', { title: STR.p_market })
    p.view = pv
    var rows = {}
    p.__sync = function (s) {
      var types = E1() ? E1().TYPES : []
      var n = 0
      types.forEach(function (type) {
        if (s.a1.unlockedTypes.indexOf(type) < 0) {
          if (rows[type]) show(rows[type].el, false)
          return
        }
        n += 1
        if (!rows[type]) { rows[type] = marketRow(type); pv.body.appendChild(rows[type].el) }
        show(rows[type].el, true)
        rows[type].sync(s)
      })
      pv.setCount(n)
      if (n === 0) pv.empty(LOG() ? LOG().EMPTY.market_sold_out : ''); else pv.unempty()
    }
    return pv
  }

  function marketRow (type) {
    var r = row({})
    var l0 = line(r.el)
    span(l0, 'row-name', TYPE_NAME[type] || type)
    var arrow = span(l0, 'row-sub', '')
    var sparkEl = span(l0, 'row-ascii', '')
    var price = slot('row-num')
    l0.appendChild(price)

    var l1 = line(r.el)
    var detail = span(l1, 'row-sub num', '')
    var stockTxt = span(l1, 'row-num', '')

    var l2 = line(r.el)
    var burst = el('div', 'burst')
    l2.appendChild(burst)
    var buys = []
    var mode = { sell: false }

    U.MARKET_BUY_G.forEach(function (g) {
      var b = btn('', C().fmt(g))
      bindPress(b, function () { trade(g) })
      burst.appendChild(b)
      buys.push({ el: b, kind: 'abs', g: g })
    })
    var bFrac = btn('', Math.round(U.MARKET_FRAC * 100) + '%')
    bindPress(bFrac, function () { trade(null, U.MARKET_FRAC) })
    burst.appendChild(bFrac)
    buys.push({ el: bFrac, kind: 'frac' })
    var bMax = btn('', STR.max)
    bindPress(bMax, function () { trade(null, 1) })
    burst.appendChild(bMax)
    buys.push({ el: bMax, kind: 'max' })

    // Long-press is the secondary action, everywhere and only (01 §12.1): here it is SELL.
    bindLongPress(r.el, function () {
      mode.sell = !mode.sell
      setData(r.el, 'mode', mode.sell ? 'sell' : 'buy')
      bMax.textContent = mode.sell ? STR.all : STR.max
    })

    function trade (grams, frac) {
      var s = liveState(), e = E1()
      if (!s || !e) return
      var g
      if (mode.sell) {
        var held = num(s.a1.sub[type])
        g = grams !== null && grams !== undefined ? Math.min(grams, held) : held * frac
        if (!(g > 0)) { haptic(U.HAP_ERROR, 'ui.error'); return }
        e.sell(type, g)
      } else {
        var unit = e.unitPrice(type)
        var affordable = unit > 0 ? num(s.res.sugar) / unit : 0
        var stock = s.a1.mkt[e.TYPES.indexOf(type)].stock
        var ceiling = Math.min(affordable, stock)
        g = grams !== null && grams !== undefined ? Math.min(grams, ceiling) : ceiling * frac
        if (!(g > 0)) {
          haptic(U.HAP_ERROR, 'ui.error')
          announce(interp(STR.short, {
            n: C().fmt(Math.max(0, (grams || 0) * unit - num(s.res.sugar))) + ' sug'
          }))
          return
        }
        e.buy(type, g)
      }
    }

    var lastPrice = 0
    return {
      el: r.el,
      sync: function (s) {
        var e = E1()
        if (!e) return
        var i = e.TYPES.indexOf(type)
        var mkt = s.a1.mkt[i]
        var unit = e.unitPrice(type)
        setSlot(price, C().fmt(unit), 'sug/g')
        setText(arrow, unit > lastPrice ? '▲' : unit < lastPrice ? '▼' : '·')
        arrow.style.color = unit > lastPrice ? 'var(--attention)' : 'var(--positive-text)'
        lastPrice = unit
        setText(sparkEl, spark(e.priceHistory(type)))
        var ledger = !!s.proj.flags.mycelial_ledger
        setText(detail, (ledger ? STR.fair + ' ' + C().fmt(e.fairValue(type)) + ' · ' : '') +
          C().fmtMass(num(s.a1.sub[type])) + ' ' + STR.onFloor)
        setText(stockTxt, C().fmtMass(mkt.stock) + ' ' + STR.forSale)
        var sellable = mode.sell
        buys.forEach(function (b) {
          var ok
          if (sellable) ok = num(s.a1.sub[type]) > 0
          else if (b.kind === 'abs') ok = num(s.res.sugar) >= b.g * unit && mkt.stock >= b.g
          else ok = num(s.res.sugar) > 0 && mkt.stock > 0
          setData(b.el, 's', ok ? 'afford' : 'want')
        })
        setAttr(r.el, 'aria-label', (TYPE_NAME[type] || type) + ', ' + C().fmt(unit) +
          ' sugar per gram, ' + C().fmtMass(mkt.stock) + ' for sale')
      }
    }
  }

  // ── THE YEAR ───────────────────────────────────────────────────────────────

  function buildSeasons (v, p) {
    var pv = panel('seasons', { title: STR.p_seasons })
    p.view = pv
    var r = row({})
    var l0 = line(r.el)
    var seasonTxt = span(l0, 'row-name', '')
    var yearTxt = span(l0, 'row-sub', '')
    var phaseNum = slot('row-num')
    l0.appendChild(phaseNum)
    var l1 = line(r.el)
    var phase = meter('fill', 0)
    phase.style.flex = '1 1 auto'
    l1.appendChild(phase)
    var l2 = line(r.el)
    span(l2, 'row-sub', STR.moisture)
    var moist = slot('row-num')
    l2.appendChild(moist)
    var l3 = line(r.el)
    span(l3, 'row-sub', STR.warmth)
    var warm = slot('row-num')
    l3.appendChild(warm)
    pv.body.appendChild(r.el)

    var evRow = row({})
    var evLine = line(evRow.el)
    var evTxt = span(evLine, 'row-sub', '')
    evRow.el.hidden = true
    pv.body.appendChild(evRow.el)

    p.__sync = function (s) {
      var a = A1()
      setText(seasonTxt, SEASON_LABEL[s.a1.season])
      setText(yearTxt, interp(STR.year, { n: String(s.a1.year + 1) }))
      var left = (1 - num(s.a1.seasonPhase)) * T().CLOCK.SEASON_S
      setSlot(phaseNum, C().fmtTime(left), '')
      phase.set(num(s.a1.seasonPhase), '',
        SEASON_LABEL[s.a1.season] + ', ' + C().fmtTime(left) + ' left')
      setSlot(moist, C().fmt(num(s.a1.moisture)), '× ' + C().fmt(a ? a.moistureMult() : 1))
      setSlot(warm, C().fmt(a ? a.tempMult() : 1), '×')
      var ev = s.a1.activeEvents
      show(evRow.el, ev.length > 0)
      if (ev.length) {
        setText(evTxt, ev.map(function (e) { return e.id }).join(' · '))
      }
      pv.setCount(SEASON_LABEL[s.a1.season])
    }
    return pv
  }

  // ── THE UNDERSTORY ─────────────────────────────────────────────────────────

  function buildUnderstory (v, p) {
    var pv = panel('understory', { title: STR.p_understory })
    p.view = pv
    var contractRows = {}
    var treeRows = {}
    var solRows = {}
    var openTree = null

    p.__sync = function (s) {
      var e = E1()
      if (!e) return
      var i, c, tr

      var liveC = {}
      for (i = 0; i < s.a1.contracts.length; i++) {
        c = s.a1.contracts[i]
        liveC[c.id] = 1
        if (!contractRows[c.id]) {
          contractRows[c.id] = contractRow(c.id)
          pv.body.appendChild(contractRows[c.id].el)
        }
        contractRows[c.id].sync(s, c)
      }
      Object.keys(contractRows).forEach(function (k) {
        if (liveC[k]) return
        if (contractRows[k].el.parentNode) contractRows[k].el.parentNode.removeChild(contractRows[k].el)
        delete contractRows[k]
      })

      var sols = e.solicitations ? e.solicitations() : []
      var liveS = {}
      sols.forEach(function (so) {
        liveS[so.id] = 1
        if (!solRows[so.id]) {
          solRows[so.id] = solicitRow(so.id)
          pv.body.appendChild(solRows[so.id].el)
        }
        solRows[so.id].sync(s, so)
      })
      Object.keys(solRows).forEach(function (k) {
        if (liveS[k]) return
        if (solRows[k].el.parentNode) solRows[k].el.parentNode.removeChild(solRows[k].el)
        delete solRows[k]
      })

      var liveT = {}
      for (i = 0; i < s.a1.trees.length; i++) {
        tr = s.a1.trees[i]
        liveT[tr.id] = 1
        if (!treeRows[tr.id]) {
          treeRows[tr.id] = treeRow(tr.id, function (id) {
            if (openTree && openTree !== id && treeRows[openTree]) treeRows[openTree].collapse()
            openTree = id
          })
          pv.body.appendChild(treeRows[tr.id].el)
        }
        treeRows[tr.id].sync(s, tr)
      }
      Object.keys(treeRows).forEach(function (k) {
        if (liveT[k]) return
        if (treeRows[k].el.parentNode) treeRows[k].el.parentNode.removeChild(treeRows[k].el)
        delete treeRows[k]
      })

      pv.setCount(s.a1.trees.length + ' · ' + C().fmt(num(s.a1.netRep)) + ' rep')
      if (!s.a1.trees.length && !s.a1.contracts.length) {
        pv.empty(LOG() ? LOG().EMPTY.trees : '')
      } else pv.unempty()
    }
    return pv
  }

  function contractRow (id) {
    var r = row({})
    var l0 = line(r.el)
    var name = span(l0, 'row-name', '')
    var state = span(l0, 'row-sub', '')
    var rateNum = slot('row-num')
    l0.appendChild(rateNum)
    var l1 = line(r.el)
    span(l1, 'row-sub', STR.delivered)
    var bar = meter('ascii', 0)
    l1.appendChild(bar)
    var left = span(l1, 'row-num', '')
    var l2 = line(r.el)
    var shortTxt = span(l2, 'row-sub', '')
    var shortNum = span(l2, 'row-num', '')

    var ex = r.expander()
    var acts = el('div', 'row-actions')
    var reneg = actionButton(STR.renegotiate, function () {
      if (E1()) E1().renegotiate(id)
    })
    var quit = actionButton(STR.exit, function () {
      if (E1()) E1().exitContract(id)
    })
    acts.appendChild(reneg)
    acts.appendChild(quit)
    ex.appendChild(acts)
    bindLongPress(r.el, function () { r.setExpanded(!r.isExpanded()) })

    return {
      el: r.el,
      sync: function (s, c) {
        var tree = E1().treeById(c.treeId)
        setText(name, tree ? (SPECIES_NAME[tree.species] || tree.species) : '')
        setText(state, c.suspended ? 'suspended' : c.state)
        setSlot(rateNum, C().fmt(num(c.mineralRate)), '⬬/s')
        var span1 = Math.max(1e-9, num(c.endT) - num(c.startT))
        var done = fill((num(s.t) - num(c.startT)) / span1)
        bar.set(done, '', Math.round(done * 100) + ' percent of the term')
        setText(left, C().fmtTime(Math.max(0, num(c.endT) - num(s.t))))
        var budget = num(c.sugarRate) * T().CLOCK.SEASON_S * T().A1.SHORTFALL_FRAC
        var sh = num(c.shortfall)
        show(shortTxt.parentNode, sh > 0)
        if (sh > 0) {
          setText(shortTxt, STR.shortfall)
          setText(shortNum, C().fmtTime(Math.max(0, (budget - sh) / Math.max(1e-9, c.sugarRate))))
          shortNum.dataset.tone = 'warn'
        }
        setAttr(r.el, 'aria-label',
          (tree ? SPECIES_NAME[tree.species] : '') + ', ' + C().fmt(num(c.sugarRate)) +
          ' sugar per second for ' + C().fmt(num(c.mineralRate)) + ' minerals per second')
      }
    }
  }

  function solicitRow (id) {
    var r = row({})
    var l0 = line(r.el)
    var name = span(l0, 'row-name', '')
    var detail = span(l0, 'row-sub', '')
    var acts = el('div', 'row-actions')
    var yes = actionButton(STR.accept, function () { if (E1()) E1().acceptSolicitation(id) })
    var no = actionButton(STR.decline, function () { if (E1()) E1().declineSolicitation(id) })
    acts.appendChild(yes)
    acts.appendChild(no)
    r.el.appendChild(acts)
    return {
      el: r.el,
      sync: function (s, so) {
        var c = E1().contractById(id)
        var tree = c ? E1().treeById(c.treeId) : null
        setText(name, tree ? (SPECIES_NAME[tree.species] || tree.species) : '')
        setText(detail, C().fmt(num(so.volume)) + ' g/s · ' +
          interp(STR.seasonsLeft, { n: String(so.termSeasons) }))
      }
    }
  }

  function actionButton (label, fn) {
    var b = btn('', label)
    b.style.minHeight = '44px'
    b.style.flex = '1'
    b.style.border = '1px solid var(--line-strong)'
    b.style.borderRadius = 'var(--r-md)'
    b.style.color = 'var(--text-primary)'
    bindPress(b, function (e) { if (e && e.stopPropagation) e.stopPropagation(); fn() })
    return b
  }

  // The negotiation is an inline expansion, not a sheet: 06 §5.8 caps the game at five sheets and
  // anything else that wants to be modal must expand in place.
  function treeRow (id, onOpen) {
    var r = row({})
    var l0 = line(r.el)
    var name = span(l0, 'row-name', '')
    var age = span(l0, 'row-sub', '')
    var repNum = slot('row-num')
    l0.appendChild(repNum)
    var l1 = line(r.el)
    span(l1, 'row-sub', STR.deficit)
    var dBar = meter('ascii', 0)
    l1.appendChild(dBar)
    var l2 = line(r.el)
    span(l2, 'row-sub', STR.standing)
    var pips = meter('pips', 0)
    l2.appendChild(pips)

    var ex = r.expander()
    var volume = slider({ label: STR.volume, steps: U.SLIDER_STEPS, onInput: refresh })
    var term = slider({ label: STR.term, steps: T().A1.TERM_MAX, onInput: refresh })
    var coll = slider({ label: STR.collateral, steps: U.SLIDER_STEPS, onInput: refresh })
    var excl = checkbox(STR.exclusive, '', refresh)
    var summary = el('div', 'field')
    var payLine = el('div', 'row-line')
    span(payLine, 'row-sub', STR.youPay)
    var payNum = slot('row-num')
    payLine.appendChild(payNum)
    var getLine = el('div', 'row-line')
    span(getLine, 'row-sub', STR.youGet)
    var getNum = slot('row-num')
    getLine.appendChild(getNum)
    var totLine = el('div', 'row-line')
    span(totLine, 'row-sub', STR.overTerm)
    var totNum = slot('row-num')
    totLine.appendChild(totNum)
    var covLine = el('div', 'row-line')
    span(covLine, 'row-sub', STR.coverage)
    var cov = meter('fill', 0)
    cov.style.flex = '1 1 auto'
    covLine.appendChild(cov)
    summary.appendChild(payLine)
    summary.appendChild(getLine)
    summary.appendChild(totLine)
    summary.appendChild(covLine)

    var signBtn = btn('hero hero--wide', STR.sign)
    bindPress(signBtn, function (e) {
      if (e && e.stopPropagation) e.stopPropagation()
      var s = liveState(), e1 = E1()
      var tree = e1.treeById(id)
      if (!tree) return
      var terms = readTerms(s, tree)
      if (!e1.accepts(tree, terms.volume, terms.term, terms.exclusive)) {
        haptic(U.HAP_ERROR, 'ui.error')
        var ct = e1.counter(tree, terms.volume, terms.term, terms.exclusive)
        if (ct) announce(C().fmt(ct.maxVolume) + ' g/s, ' + ct.maxTerm + ' at most')
        return
      }
      e1.signContract(id, terms.volume, terms.term, terms.collateral, terms.exclusive)
      r.setExpanded(false)
    })

    ex.appendChild(volume)
    ex.appendChild(term)
    ex.appendChild(coll)
    ex.appendChild(excl)
    ex.appendChild(summary)
    ex.appendChild(signBtn)

    bindPress(r.el, function () {
      var next = !r.isExpanded()
      r.setExpanded(next)
      if (next) { onOpen(id); refresh() }
    })

    function readTerms (s, tree) {
      var e1 = E1()
      var maxV = Math.max(0, e1.maxIntake(tree))
      var maxT = e1.maxTerm(tree)
      var maxC = num(s.res.biomass)
      return {
        volume: maxV * (volume.value() / U.SLIDER_STEPS),
        term: C().clamp(term.value(), T().A1.TERM_MIN, maxT),
        collateral: maxC * (coll.value() / U.SLIDER_STEPS),
        exclusive: excl.value()
      }
    }

    function refresh () {
      var s = liveState(), e1 = E1()
      if (!s || !e1) return
      var tree = e1.treeById(id)
      if (!tree) return
      var t = readTerms(s, tree)
      term.setMax(e1.maxTerm(tree))
      var rateV = e1.offer(tree, t.volume, t.term, t.collateral, t.exclusive)
      volume.setReadout(C().fmt(t.volume), ' g/s', C().fmt(t.volume) + ' grams per second')
      term.setReadout(String(t.term), '', t.term + ' seasons')
      coll.setReadout(C().fmtMass(t.collateral), '', C().fmtMass(t.collateral))
      volume.setNote(C().fmt(e1.maxIntake(tree)) + ' g/s ' + STR.max)
      term.setNote(STR.max + ' ' + e1.maxTerm(tree))
      setSlot(payNum, C().fmt(t.volume), ' g/s')
      setSlot(getNum, C().fmt(rateV), ' ⬬/s')
      setSlot(totNum, C().fmt(rateV * t.term * T().CLOCK.SEASON_S), ' ⬬')
      var book = e1.bookState()
      var income = e1.netSugar() + book.committed
      var coverage = income > 0 ? (book.committed + t.volume) / income : 1
      cov.set(coverage, coverage > U.COVER_WARN ? (coverage >= 1 ? 'bad' : 'warn') : '',
        Math.round(coverage * 100) + ' percent of what you make')
      setData(signBtn, 'state',
        e1.accepts(tree, t.volume, t.term, t.exclusive) ? 'idle' : 'locked')
    }

    return {
      el: r.el,
      collapse: function () { r.setExpanded(false) },
      sync: function (s, tree) {
        setText(name, SPECIES_NAME[tree.species] || tree.species)
        setText(age, C().fmt(num(tree.age)) + ' y')
        setSlot(repNum, C().fmt(num(tree.rep)), 'rep')
        var d = E1().carbonDeficit(tree)
        dBar.set(d, '', Math.round(d * 100) + ' percent short of carbon')
        pips.set(num(tree.rep) / T().A1.REP_MAX, '',
          C().fmt(num(tree.rep)) + ' of ' + T().A1.REP_MAX)
        setAttr(r.el, 'aria-label',
          (SPECIES_NAME[tree.species] || tree.species) + ', deficit ' + Math.round(d * 100) +
          ' percent, standing ' + C().fmt(num(tree.rep)))
        if (r.isExpanded()) refresh()
      }
    }
  }

  // ── ADAPTATIONS ────────────────────────────────────────────────────────────

  function buildAdaptations (v, p) {
    var pv = panel('adaptations', { title: STR.p_adaptations })
    p.view = pv
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
            id: entry.id, title: entry.title, cost: entry.priceTag,
            desc: entry.description, pinned: entry.pinned,
            onPick: function () { pick(entry) }
          })
          v.cards[entry.id] = c
          c.markNew()
          if (!reducedMotion()) c.el.classList.add('reveal')
        }
        pv.body.appendChild(c.el)
        var state = !entry.buyable ? 'unbuyable' : (entry.cost() ? 'afford' : 'want')
        c.setState(state)
        c.setCost(entry.priceTag)
        c.setLabel(entry.title + '. ' + entry.priceTag + '. ' +
          (state === 'afford' ? 'affordable' : 'not yet'))
      })
      // A bought project is removed from the DOM. There is no completed tab.
      Object.keys(v.cards).forEach(function (k) {
        if (live[k]) return
        var c = v.cards[k]
        if (c.el.parentNode) c.el.parentNode.removeChild(c.el)
        delete v.cards[k]
      })
      pv.setCount(list.length)
      if (!list.length) pv.empty(LOG() ? LOG().EMPTY.adaptations : ''); else pv.unempty()
    }

    function pick (entry) {
      var pj = PJ()
      if (!entry.buyable) return
      if (!entry.cost()) {
        haptic(U.HAP_ERROR, 'ui.error')
        announce(entry.priceTag)
        return
      }
      pj.purchase(entry.id)
    }
    return pv
  }

  // ── PATCHES ────────────────────────────────────────────────────────────────

  function buildPatches (v, p) {
    var pv = panel('patches', { title: STR.p_patches })
    p.view = pv
    var r = row({})
    var l0 = line(r.el)
    var have = span(l0, 'row-name', '')
    var gate = span(l0, 'row-sub', '')
    var cost = slot('row-num')
    l0.appendChild(cost)
    var l1 = line(r.el)
    var prog = meter('fill', 0)
    prog.style.flex = '1 1 auto'
    l1.appendChild(prog)
    var l2 = line(r.el)
    var claimBtn = actionButton(STR.claim, function () {
      var s = liveState()
      if (!s) return
      if (!A1().claimPatch(s.a1.patches + 1)) {
        haptic(U.HAP_ERROR, 'ui.error')
        shortfallLine(claimBtn)
      }
    })
    var acts = el('div', 'row-actions')
    acts.appendChild(claimBtn)
    l2.appendChild(acts)
    pv.body.appendChild(r.el)

    p.__sync = function (s) {
      var A = T().A1
      var next = s.a1.patches + 1
      var maxed = next > A.PATCH_MAX
      setText(have, interp(STR.places, { n: String(s.a1.patches), k: String(A.PATCH_MAX) }))
      pv.setCount(s.a1.patches)
      if (maxed) {
        setSlot(cost, STR.nothing, '')
        setText(gate, '')
        show(claimBtn, false)
        prog.set(1, '', 'all six')
        return
      }
      var spec = A.PATCH[next - 1]
      var needRep = A.PATCH_GATE_REP[next - 1]
      setSlot(cost, C().fmtMass(spec.biomass) + ' + ' + C().fmt(spec.minerals), '⬬')
      setText(gate, needRep > 0 ? interp(STR.needsStanding, { n: String(needRep) }) : '')
      var flight = s.a1.claimInFlight
      show(claimBtn, !flight)
      if (flight) {
        var pr = A1().claimProgress()
        prog.set(pr, 'signal', STR.claiming + ' ' + Math.round(pr * 100) + ' percent')
      } else {
        var canPay = num(s.res.biomass) >= spec.biomass && num(s.res.minerals) >= spec.minerals &&
          num(s.a1.netRep) >= needRep
        prog.set(Math.min(1, num(s.res.biomass) / spec.biomass), canPay ? '' : 'warn',
          C().fmtMass(num(s.res.biomass)) + ' of ' + C().fmtMass(spec.biomass))
        setData(claimBtn, 's', canPay ? 'afford' : 'want')
        claimBtn.dataset.short = interp(STR.short, {
          n: C().fmtMass(Math.max(0, spec.biomass - num(s.res.biomass)))
        })
      }
    }
    return pv
  }

  // ── SIGNAL ─────────────────────────────────────────────────────────────────

  function buildSignal (v, p) {
    var pv = panel('signal', { title: STR.p_signal })
    p.view = pv
    var r = row({})
    var l0 = line(r.el)
    span(l0, 'row-name', STR.p_signal)
    var val = slot('row-num')
    l0.appendChild(val)
    var l1 = line(r.el)
    var bar = meter('fill', 0)
    bar.style.flex = '1 1 auto'
    l1.appendChild(bar)
    bar.hidden = true
    pv.body.appendChild(r.el)

    p.__sync = function (s, rev) {
      setSlot(val, C().fmt(num(s.res.signal)), 'Σ')
      var target = T().A1.DECIDE_SIGNAL
      var near = num(s.res.signal) > 0 && (rev.decide || num(s.res.signal) >= target * 0.5)
      show(bar, near)
      if (near) {
        bar.set(num(s.res.signal) / target, 'signal',
          C().fmt(num(s.res.signal)) + ' of ' + C().fmt(target))
      }
      pv.setCount(C().fmt(num(s.res.signal)))
    }
    return pv
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS · 06 §8.6. Nine rows, one screen, no submenus.
  // ═══════════════════════════════════════════════════════════════════════════

  var tierPref = 'auto'

  function openSettings () {
    var s = liveState()
    var sh = sheet({
      title: STR.settings,
      buttons: [{ label: STR.close, onPick: function (api) { api.close() } }],
      build: function (body) {
        settingRow(body, STR.theme, seg([
          { value: 'auto', label: STR.auto },
          { value: 'dark', label: STR.dark },
          { value: 'light', label: STR.light }
        ], s ? s.set.theme : 'auto', function (v) { setTheme(v); persist() }))

        settingRow(body, STR.haptics, seg([
          { value: 'on', label: STR.on }, { value: 'off', label: STR.off }
        ], s && s.set.haptics ? 'on' : 'off', function (v) {
          if (s) s.set.haptics = v === 'on'
          persist()
        }))

        settingRow(body, STR.motion, seg([
          { value: 'auto', label: STR.auto },
          { value: 'on', label: STR.off },
          { value: 'off', label: STR.on }
        ], s && s.set.reduceMotion === null ? 'auto' : (s && s.set.reduceMotion ? 'on' : 'off'),
        function (v) {
          if (s) s.set.reduceMotion = v === 'auto' ? null : v === 'on'
          applyMotionAttr()
          persist()
        }))

        settingRow(body, STR.slow, seg([
          { value: 'off', label: STR.off }, { value: 'on', label: STR.on }
        ], s && s.set.slow ? 'on' : 'off', function (v) { if (s) s.set.slow = v === 'on'; persist() }))

        settingRow(body, STR.verbose, seg([
          { value: 'off', label: STR.off }, { value: 'on', label: STR.on }
        ], verbose ? 'on' : 'off', function (v) {
          verbose = v === 'on'
          store('hyphae.verbose', verbose ? '1' : '0')
        }))

        settingRow(body, STR.tier, seg([
          { value: 'auto', label: STR.auto }, { value: 'high', label: STR.high },
          { value: 'med', label: STR.med }, { value: 'low', label: STR.low }
        ], tierPref, function (v) {
          tierPref = v
          if (CANVAS() && CANVAS().setTier && v !== 'auto') CANVAS().setTier(v.toUpperCase())
        }))

        var note = el('p', 'sheet-note', STR.textSize + ' — ' + STR.textSizeNote)
        body.appendChild(note)

        var code = el('textarea', 'sheet-code')
        code.setAttribute('aria-label', STR.save)
        code.spellcheck = false
        body.appendChild(code)
        var saveRow = el('div', 'row-actions')
        saveRow.appendChild(actionButton(STR.copy, function () {
          if (!STATE()) return
          code.value = STATE().exportB64()
          code.select()
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(code.value).catch(function () {})
          }
          toast(STR.toastCopied)
        }))
        saveRow.appendChild(actionButton(STR.paste, function () {
          if (!STATE()) return
          if (!STATE().importB64(code.value.trim())) { toast(STR.toastImportBad); return }
          rebuild()
        }))
        body.appendChild(saveRow)

        var resetRow = el('div', 'row-actions')
        var reset = btn('hold hero--danger')
        reset.appendChild(el('span', 'hold-fill'))
        reset.appendChild(el('span', 'hold-lab', STR.reset))
        reset.style.minHeight = '48px'
        reset.style.flex = '1'
        reset.style.borderRadius = 'var(--r-md)'
        bindHold(reset, function () {
          if (!STATE()) return
          var cur = liveState()
          STATE().init(STATE().newGame(cur ? cur.seed : 0, cur ? cur.meta : null))
          reinitModules()
          rebuild()
          toast(STR.toastReset)
        })
        resetRow.appendChild(reset)
        body.appendChild(resetRow)
        body.appendChild(el('p', 'sheet-note', STR.resetNote))
      }
    })
    sh.open()
    return sh
  }

  function settingRow (body, label, control) {
    var r = el('div', 'sheet-row')
    r.appendChild(el('span', 'field-lab', label))
    r.appendChild(control)
    body.appendChild(r)
    return r
  }

  function persist () { if (STATE() && STATE().save) STATE().save() }

  function reinitModules () {
    var s = liveState()
    var names = ['log', 'projects', 'act1', 'economy1']
    names.forEach(function (n) {
      if (HY[n] && HY[n].init) { try { HY[n].init(s) } catch (e) { /* a cold module is not fatal */ } }
    })
  }

  function rebuild () {
    if (!view) return
    var root = view.root
    if (openSheet) openSheet.close()
    toastEl = null
    view = null
    mount(root)
    definePanels(view)
    render(liveState())
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARD SYNC — the per-frame half. One attribute write per changed card; CSS does the rest.
  // ═══════════════════════════════════════════════════════════════════════════

  function syncCards (v, s) {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT TRANSITION · 06 §6.6. Three luminance changes in four seconds.
  // ═══════════════════════════════════════════════════════════════════════════

  function transition (lines, onDone) {
    if (!view) { if (onDone) onDone(); return }
    var reduced = reducedMotion()
    setData(view.shell, 'transition', '1')
    haptic(12, 'act.begin')
    var curtain = el('div', 'curtain')
    view.main.appendChild(curtain)
    var i = 0
    var gap = reduced ? U.ACT1_LINE_GAP_MS : U.ACT1_LINE_GAP_MS
    var start = reduced ? 0 : U.ACT1_HOLD_MS
    function step () {
      if (i >= lines.length) {
        haptic(30, 'act.end')
        setData(view.shell, 'transition', '0')
        if (curtain.parentNode) curtain.parentNode.removeChild(curtain)
        if (onDone) onDone()
        return
      }
      curtain.appendChild(el('p', '', lines[i]))
      i += 1
      setTimeout(step, gap)
    }
    setTimeout(function () { haptic(12, 'act.mid'); step() }, start)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SELF-TEST — D02's cold-boot inventory, asserted element by element.
  // ═══════════════════════════════════════════════════════════════════════════

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }
    var d = doc()
    if (!d) { return f }

    // A detached shell, rendered against a fresh save. At cold boot every reveal is false, so
    // this is exactly the screen D02 describes and nothing has to be stubbed.
    var host = d.createElement('div')
    var keep = view
    view = buildShell(host)
    definePanels(view)
    var s = STATE().newGame(0, null)

    paintLedger(view, s)
    view.order.forEach(function (id) {
      var p = view.panels[id]
      ok(!p.need(s, COLD), 'D02: panel "' + id + '" is revealed at t=0')
    })
    paintHero(view, s, COLD)

    // 1 · one canvas plate, two surfaces, one of which is never cleared
    var plates = host.querySelectorAll('.plate')
    ok(plates.length === 1, 'D02: expected exactly one canvas plate')
    ok(host.querySelectorAll('.plate canvas').length === 2, 'D02: expected net + flux canvases')
    ok(host.querySelector('#net').getAttribute('aria-hidden') === 'true',
      'D02: the structural canvas must be aria-hidden')
    ok(host.querySelector('#flux').getAttribute('role') === 'img',
      'D02: the flux canvas must carry role=img')

    // 2 · BIOMASS 0 g, and nothing else in the ledger
    var visibleRows = []
    var rows = host.querySelectorAll('.ledger-row')
    for (var i = 0; i < rows.length; i++) if (!rows[i].hidden) visibleRows.push(rows[i])
    ok(visibleRows.length === 1, 'D02: expected exactly one ledger row, saw ' + visibleRows.length)
    if (visibleRows.length === 1) {
      var r = visibleRows[0]
      ok(r.querySelector('.ledger-lab').textContent === STR.biomass,
        'D02: the first ledger row must be biomass')
      var parts = splitNum(C().fmtMass(0))
      ok(r.querySelector('.ledger-val .mant').textContent === parts[0],
        'D02: biomass must read ' + parts[0])
      ok(r.querySelector('.ledger-val .unit').textContent === 'g',
        'D02: biomass must be in grams')
      ok(r.dataset.lead === 'solo', 'D02: alone on screen, biomass is the display size')
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
    ok(live.length === 1 && live[0].className === 'hero',
      'D02: the one button must be the hero')
    ok(live.length === 1 && live[0].textContent === STR.extend,
      'D02: the hero must read "' + STR.extend + '"')
    ok(host.querySelector('.gear').hidden, 'D02: no settings affordance at t=0')
    ok(host.querySelector('.tabbar').hidden, 'D02: no tab bar in Act I')

    // 4 · a five-row console, and it is the only live region
    var con = host.querySelector('.console')
    ok(!!con, 'D02: the console must exist')
    var inner = host.querySelector('.console-inner')
    ok(inner && inner.getAttribute('aria-live') === 'polite',
      'D02: the console is the aria-live region')
    ok(host.querySelectorAll('[aria-live]').length === 1,
      'D02: exactly one aria-live region exists')
    ok(inner && inner.childNodes.length <= 1,
      'D02: the console holds at most one line at t=0')
    ok(U.CONSOLE_ROWS === 5, 'D02: the console is a five-row window')

    // 5 · nothing else. No chrome of any kind.
    ok(host.querySelectorAll('.panel').length === 0, 'D02: no panel is mounted at t=0')
    ok(host.querySelectorAll('.sheet').length === 0, 'D02: no sheet exists at t=0')
    ok(host.querySelectorAll('.scrim').length === 0, 'D02: no scrim exists at t=0')
    ok(host.querySelectorAll('.toast').length === 0, 'D02: no toast exists at t=0')
    ok(host.querySelectorAll('img, picture, video, iframe, dialog, form, input, select')
      .length === 0, 'D02: no media, dialog or form element exists at t=0')
    ok(host.querySelectorAll('h1').length === 0, 'D02: there is no title card')

    var banned = ['title', 'logo', 'menu', 'tutorial', 'welcome', 'cookie', 'rotate',
      'orientation', 'continue', 'new game', 'start', 'play', 'ok', 'skip']
    var text = host.textContent.toLowerCase()
    for (i = 0; i < banned.length; i++) {
      ok(text.indexOf(banned[i]) < 0, 'D02: the word "' + banned[i] + '" is on the cold-boot screen')
    }

    // 6 · the hero is the last thing in the scroll, forever (06 §4.3)
    var scroll = host.querySelector('.scroll-main')
    var kids = scroll.children
    ok(kids[kids.length - 2] === host.querySelector('.hero'),
      'D02: the hero must be the last element in the scroll before the tail')

    // ── beyond D02: the invariants a component can quietly break ──
    ok(U.PLATE_FRAC[0] === 0.38, 'the cold-boot plate is 38% of the shell (06 §4.3)')
    ok(U.LEDGER_MAX_ROWS === 4, 'the ledger is four rows maximum, ever (06 §5.1)')
    ok(U.PIPS === 5, 'five pips, never more, never fewer (06 §5.6)')
    ok(T().UI.TAP_MIN_PX === 44 && U.LONGPRESS_MS === 420,
      'the tap floor and the long-press are 06 §5.5 and §8.3')
    ok(splitNum('4.12 T')[1] === 'T' && splitNum('812')[1] === '',
      'a value splits into a mantissa and a suffix, and a bare number has no suffix')
    ok(ascii(0).length === U.ASCII_N && ascii(1).length === U.ASCII_N,
      'the ASCII meter is a fixed 20 characters at every value')
    ok(ascii(1) === repeat(U.ASCII_FULL, U.ASCII_N), 'a full ASCII meter has no head glyph')
    ok(spark([]) === '', 'an empty price history draws nothing rather than a flat line')
    ok(interp(STR.short, { n: '240 g' }) === '240 g short',
      'string interpolation uses named slots')
    ok(TAB_SLOTS.length === T().UI.TAB_SLOTS,
      'five tab slots are allocated at boot (06 §4.4)')
    ok(Object.keys(TYPE_NAME).length === 7, 'seven typed pools have seven names')

    // Act I text carries no capital letter (BIBLE D68). The capitals the design asks for are
    // applied by text-transform, never baked into a string.
    var key
    for (key in STR) {
      if (!Object.prototype.hasOwnProperty.call(STR, key)) continue
      ok(!/[A-Z]/.test(STR[key]), 'D68: STR.' + key + ' contains a capital letter')
      ok(STR[key].indexOf('!') < 0, 'D67: STR.' + key + ' contains an exclamation mark')
    }
    for (key in TYPE_NAME) {
      if (!Object.prototype.hasOwnProperty.call(TYPE_NAME, key)) continue
      ok(!/[A-Z]/.test(TYPE_NAME[key]), 'D68: TYPE_NAME.' + key + ' contains a capital letter')
    }
    for (key in SPECIES_NAME) {
      if (!Object.prototype.hasOwnProperty.call(SPECIES_NAME, key)) continue
      ok(!/[A-Z]/.test(SPECIES_NAME[key]), 'D68: SPECIES_NAME.' + key + ' has a capital letter')
    }

    view = keep
    return f
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE SURFACE (BIBLE §6 M16)
  // ═══════════════════════════════════════════════════════════════════════════

  HY.ui = {
    mount: function (root) {
      var v = mount(root)
      if (v) { definePanels(v); render(liveState()) }
      return v
    },
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

    // The rest of this module's own surface: the display slot loop.js schedules at 10 Hz, the
    // act cinematic, and the layout hook a rotation fires.
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
