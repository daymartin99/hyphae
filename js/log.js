;(function (HY) {
  'use strict'

  // M5 · log.js — the console (BIBLE §6 M5, doc 09 in full).
  //
  // This file is both the engine and the corpus. The corpus is doc 09 §8's export transcribed
  // entry for entry, plus the act-transition sequences of §4 and the endings of §5. Where 09 gives
  // a `trigger` as a JS-evaluable string, the string is kept verbatim in `trigger` — it is the
  // record — and the executable form sits beside it in `pred` (polled) or `guard` (checked at an
  // imperative fire site). Nothing is eval'd: a string predicate would have to reach into every
  // module's private state, and half of those modules do not exist in this slice.
  //
  // Registers (09 §1.1). Act I renders lowercase, always. The first capital letter in HYPHAE is
  // the first letter of Act II — `a2.open`, `Something in the network is repeating itself.` That
  // is enforced by __selftest, not by a runtime transform: a transform would let a mis-authored
  // line ship and be silently repaired, and the point of the rule is that the text is written
  // that way.
  //
  // Everything Acts II and III need is here and correct, but this slice ships Act I. Predicates
  // that read a module which does not exist yet feature-detect and answer false, so an Act II line
  // can never fire into an Act I run.

  function C () { return HY.core }
  function T () { return HY.core.TUNE }
  function S () { return HY.state && HY.state.state }

  // ───────────────────────────────────────────────────────────────────────────
  // CONSTANTS — the ones TUNE.LOG does not carry (09 §3.2, §7.1, §1.8)
  // ───────────────────────────────────────────────────────────────────────────

  var CONS = {
    QUEUE_DROP: 4,          // entries queued before the LOWEST priority is dropped, not the newest
    QUEUE_STALE: 20,        // s; a queued line older than this is discarded. Log lines are news.
    DEDUPE_WINDOW: 5,       // identical text within the last N rendered lines is dropped silently
    OBS_QUIET: 45,          // s since the last non-observation line
    OBS_HANDS_OFF: 8,       // s since the last player input
    OBS_CHANCE: 0.006,      // /s once every gate is open; with OBS_COOLDOWN this lands the
                            // observed rate at one per 4–9 minutes of idle (09 §7.1)
    ROW_PX: 19,             // px, the --t-meta line box (06 §3); measured at mount where possible
    PRICE_DP: 2,            // decimals on a {price} token — a market price is read, not compared
    SPELL_MAX: 12,          // integers at or below this are spelled (09 §1.4)
    RETURN_MAX: 5,          // lines in the offline burst (D36), never padded
    RETURN_MIN_AWAY: 120,   // s; below this nothing fires. Switching apps is not being away.
    RETURN_SHORT: 900,      // s; below this, lines 1 and 2 only
    RETURN_LONG: 259200,    // s (72 h)
    RETURN_VAST: 2592000,   // s (30 d)
    SKIP_AFTER: 1.0,        // s of a sequence before a tap may advance it
    SKIP_GUARD: 0.4,        // s; a second tap inside this does nothing (double-tap eats two lines)
    PUMP_STALE_MS: 1500,    // ms; a display pump older than this has died and the sim clock resumes
    PRIORITY: { narrative: 3, voice: 3, world: 2, system: 1, observation: 0 },
    ROWS_BY_CHANNEL: { system: 1, world: 2, narrative: 2, observation: 2, voice: 2 }
  }

  // Tone glyphs are prepended by the renderer and are NOT part of any string (09 §1.7). The ring
  // stores a one-character code so 200 lines cost 200 bytes of tone and not 200 objects.
  var TONE_GLYPH = { pos: '+', warn: '!', neg: '−', amb: '', nul: '' }
  var TONE_CODE = { pos: '+', warn: '!', neg: '-', amb: '~', nul: '.' }
  var CODE_TONE = { '+': 'pos', '!': 'warn', '-': 'neg', '~': 'amb', '.': null, '=': null }

  var PROMPT_NEW = '>'
  var PROMPT_OLD = '·'

  // ───────────────────────────────────────────────────────────────────────────
  // LINT TABLES (09 §1.2, §1.3) — read by __selftest, and by nothing else
  // ───────────────────────────────────────────────────────────────────────────

  var BANNED_HARD = [
    'amazing', 'incredible', 'massive', 'huge', 'epic', 'powerful', 'efficiency boost',
    'unlocked', 'congratulations', 'well done', 'nice', 'great', 'oops', 'uh oh', 'whoops',
    'welcome', 'get ready', 'you can now', "don't forget", 'pro tip', 'finally', 'at last',
    'journey', 'adventure', 'empire', 'dominate', 'conquer', 'unleash', 'unstoppable',
    'legendary', 'ultimate', 'insane', 'crazy'
  ]

  // Permitted at most once per act, and every use is argued in review (09 §1.3). The count is
  // asserted, not the argument. `dead` is on 09's soft list only as a metaphor — literal use is
  // free, and every occurrence in this corpus is literal — so it is not checkable and is not here.
  var BANNED_SOFT = [
    'beautiful', 'terrible', 'strange', 'alive', 'think', 'remember', 'want', 'decide'
  ]

  var IMPERATIVES = [
    'tap', 'press', 'buy', 'sell', 'try', 'remember', 'note', 'check', 'make sure',
    'be careful', 'watch', "don't", 'do not', 'consider', 'use', 'keep', 'get', 'go'
  ]

  // 09 §1.1's register sheet is a sheet, not one of the L1–L10 lint rules, and seven canonised
  // lines exceed it. They are listed here with the reason rather than quietly excluded, so a NEW
  // line that breaks the register still fails the lint.
  var REGISTER_EXEMPT = {
    'a1.mast': 'inherited from 01 §7.4; thirteen words, one sentence',
    'a1.hemlock': 'thirteen words; the clause is the joke and does not survive a cut',
    'a1.signal_reveal': 'inherited from 01 §10.1; 09 §1.6 rule 9 quotes it as the ships-version',
    'a2.spore_fail': 'three sentences; 09 §3.6.2 names the three-beat as the design',
    'a2.ghost': 'three sentences; the third is the turn and cannot be joined with a comma',
    'a2.strain_high': 'three sentences; 05 §6.2 requires the third to stand alone',
    'a2.retention_zero': 'three sentences; the third is the complicity beat'
  }

  // ───────────────────────────────────────────────────────────────────────────
  // NUMBERS IN PROSE (09 §1.4)
  // ───────────────────────────────────────────────────────────────────────────

  var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
    'eighteen', 'nineteen']
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

  function words (n) {
    n = Math.round(Math.abs(Number(n) || 0))
    if (n < 20) return ONES[n]
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')
    if (n < 1000) {
      return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + words(n % 100) : '')
    }
    if (n < 1e6) {
      var th = Math.floor(n / 1000), rest = n % 1000
      // British form: the `and` belongs to the hundreds group, so 1,006 is "one thousand and six"
      // and 1,206 is "one thousand two hundred and six".
      return words(th) + ' thousand' + (rest ? (rest < 100 ? ' and ' : ' ') + words(rest) : '')
    }
    return C().fmt(n)
  }

  function spelled (n) {
    n = Math.round(Number(n) || 0)
    return n <= CONS.SPELL_MAX && n >= 0 ? words(n) : String(n)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TOKENS (09 §3.3) — every token has a formatter, and the formatter is what enforces §1.4
  // ───────────────────────────────────────────────────────────────────────────

  var TOKEN = {
    region: function (v) { return String(v) },
    strain: function (v) { return String(v) },
    tree: function (v, s) {
      var t = 'the ' + String(v)
      return (s && s.act >= 2) ? t.charAt(0).toUpperCase() + t.slice(1) : t
    },
    season: function (v) { return String(v).toLowerCase() },
    band: function (v) { return words(v) },
    k: function (v) { return spelled(v) },
    kwords: function (v) { return words(v) },
    n: function (v) { return C().fmt(v) },
    amt: function (v) { return C().fmt(v) },
    bio: function (v) { return C().fmt(v) },
    sug: function (v) { return C().fmt(v) },
    min: function (v) { return C().fmt(v) },
    psi: function (v) { return C().fmt(v) },
    car: function (v) { return C().fmt(v) },
    b: function (v) { return words(v) },
    pct: function (v) { return String(Math.round(Number(v) || 0)) },
    price: function (v) { return (Number(v) || 0).toFixed(CONS.PRICE_DP) },
    clock: function (v) { return C().fmtTime(v, 'clock') },
    away: function (v) { return duration(v) },
    t: function (v) { return duration(v) }
  }

  // core.fmtTime('away') always writes both components, which reads as `4 h 0 m` on the hour.
  // A zero the player cannot act on is a number the line should not be stating (09 §1.4).
  function duration (v) {
    var s = C().fmtTime(Math.abs(Number(v) || 0), 'away')
    return s.length > 4 && s.slice(-4) === ' 0 m' ? s.slice(0, -4) : s
  }

  var TOKEN_RE = /\{(\w+)\}/g

  function interpolate (text, tokens, s, overrides) {
    if (!tokens) return text
    return text.replace(TOKEN_RE, function (whole, key) {
      if (!Object.prototype.hasOwnProperty.call(tokens, key)) return whole
      var fmtName = overrides && overrides[key]
      var f = fmtName ? TOKEN[fmtName] : TOKEN[key]
      return f ? f(tokens[key], s) : String(tokens[key])
    })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SIM FACTS — every predicate reads the world through here.
  // Modules that do not exist in this slice answer with a value that cannot fire a line.
  // ───────────────────────────────────────────────────────────────────────────

  var F = {
    totalSubstrate: function (s) {
      var sub = s.a1.sub, k, sum = 0
      for (k in sub) if (Object.prototype.hasOwnProperty.call(sub, k)) sum += sub[k]
      return sum
    },
    sugarCap: function (s) {
      var A = T().A1
      return A.SUGAR_CAP_BASE + A.SUGAR_CAP_SLOPE * s.a1.tips + s.mult.sclerotiaBonus
    },
    // The boot season is AUTUMN and `year` rolls on the winter→spring boundary, so this counts
    // boundaries crossed since t = 0 and is stable across a reload. Nothing stores it (§3.1 R1).
    seasonsSeen: function (s) {
      return s.a1.year * 4 + s.a1.season - T().A1.BOOT_SEASON
    },
    marketOpen: function (s) {
      var A = T().A1
      return F.totalSubstrate(s) <= A.MARKET_SUB_G || s.t >= A.MARKET_T
    },
    flag: function (s, name) {
      return !!(s.proj && s.proj.flags && s.proj.flags[name])
    },
    forestConsumed: function () {
      return HY.forest && HY.forest.forestConsumed ? HY.forest.forestConsumed() : 0
    },
    minHumus: function () {
      return HY.forest && HY.forest.minHumus ? HY.forest.minHumus() : 1
    },
    maxStrain: function () {
      return HY.pactbook && HY.pactbook.maxStrain ? HY.pactbook.maxStrain() : 0
    },
    pactCount: function () {
      return HY.pactbook && HY.pactbook.pacts ? HY.pactbook.pacts().length : 0
    },
    Sr: function () { return HY.cognition && HY.cognition.Sr ? HY.cognition.Sr() : 0 },
    planetConsumed: function () {
      return HY.bloom && HY.bloom.planetConsumed ? HY.bloom.planetConsumed() : 0
    },
    biomeSettled: function (i) {
      var s = S()
      return !!(s && s.a3.biomes.reached[i])
    },
    biomeDepleted: function (i) {
      var s = S()
      if (!s || !HY.bloom || !HY.bloom.biomeDepleted) return 0
      return HY.bloom.biomeDepleted(i)
    },
    maxBandReached: function (s) {
      var n = s.a3.bands.n, i, m = -1
      for (i = 0; i < n.length; i++) if (n[i] > 0) m = i
      return m
    },
    rivalsVisible: function () { return S() ? S().stats.rivalContacts : 0 },
    succAge: function () {
      var s = S()
      return (s && s.a3.succ) ? s.t - s.a3.succ.born : -1
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE CORPUS — 09 §8, entry for entry, in order
  // ───────────────────────────────────────────────────────────────────────────

  var LINES = []
  var BY_ID = {}

  // `channel` drives priority, the row budget and what BURST_CAP drops first. 09 §3.4's per-act
  // channel counts are a stated pacing target; L6b (`system` ≤ 39 characters) is a build-failing
  // lint rule, so where they collide the lint wins and the line takes `world`.
  function L (act, id, channel, tone, trigger, text, extra) {
    var e = {
      id: id,
      act: act,
      channel: channel,
      trigger: trigger,
      text: text,
      tone: tone || null,
      once: true,
      cooldown: 0,
      priority: CONS.PRIORITY[channel],
      weight: 1,
      rows: CONS.ROWS_BY_CHANNEL[channel],
      pred: null,
      guard: null,
      opening: 0,
      minAct: act || 1,
      bin: null,
      src: null
    }
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) e[k] = extra[k]
    LINES.push(e)
    BY_ID[id] = e
    return e
  }

  // ── ACT I · UNDERSTORY (R1, lowercase) ─────────────────────────────────────

  L(1, 'a1.boot', 'narrative', null, '@boot',
    'the forest floor is warm', { opening: 1 })

  L(1, 'a1.first_tap', 'narrative', null, '@extend && taps == 1',
    'something under you is already dead',
    { opening: 2, guard: function (s) { return s.stats.taps >= 1 } })

  L(1, 'a1.third_tap', 'narrative', null, '@extend && taps == 3',
    'it comes apart in water',
    { opening: 3, bin: 'fact', src: 'hydrolysis of lignocellulose; standard biochemistry',
      guard: function (s) { return s.stats.taps >= 3 } })

  // Against the SIZE, not the labile pool. The line is about how much of the floor the colony has
  // got through, which is a fact about the organism and not about its current balance; read off
  // `res.biomass` it could be spent back below its own threshold, and act1.js's matching reveal
  // (REVEAL_SUBSTRATE_G) has always read the cumulative figure.
  L(1, 'a1.substrate', 'narrative', null, 'biomass >= 5',
    'there are two thousand grams of it. you have used ten.',
    { opening: 4, pred: function (s) { return HY.state.standing(s) >= T().A1.REVEAL_SUBSTRATE_G } })

  L(1, 'a1.autumn', 'narrative', null, 't >= 14 || taps >= 15',
    'it is autumn. more is falling. not fast enough.',
    { opening: 5, pred: function (s) { return s.t >= AUTUMN_T || s.stats.taps >= AUTUMN_TAPS } })

  L(1, 'a1.first_tip', 'world', 'pos', 'tips >= 1',
    'it grows while you are not looking at it',
    { pred: function (s) { return s.a1.tips >= 1 } })

  // Repeatable, because deadheading is: four cuts are available across the act and each one is a
  // decision the player made rather than a threshold they crossed. R1 register, and it reports the
  // trade without having an opinion about it (09 §1.0 rule 2).
  L(1, 'a1.deadhead', 'world', null, '@deadhead',
    'the oldest threads are given up. the rest are fed better.',
    { once: false })

  L(1, 'a1.sugar_reveal', 'narrative', null, 'tips >= 3',
    'you have been making this the whole time',
    { pred: function (s) { return s.a1.tips >= T().A1.REVEAL_SUGAR_TIPS } })

  L(1, 'a1.market_open', 'world', null, 'marketOpen',
    'other things eat here. that is what a price is.',
    { pred: function (s) { return F.marketOpen(s) } })

  L(1, 'a1.first_buy', 'world', null, '@buySubstrate && buys == 1',
    'you paid for something that was free an hour ago',
    { guard: function (s) { return s.stats.purchases >= 1 } })

  L(1, 'a1.tenth_buy', 'world', null, '@buySubstrate && buys == 10',
    'the price went up while you were buying. you did that.',
    { guard: function (s) { return s.stats.purchases >= 10 } })

  L(1, 'a1.substrate_dry', 'world', 'warn', 'totalSubstrate() < 50',
    'the floor is bare. it will not stay bare.',
    { pred: function (s) { return F.totalSubstrate(s) < T().A1.WINDFALL_SUB } })

  L(1, 'a1.sugar_rot', 'world', 'warn', 'sugar > sugarCap',
    'sugar you do not spend does not keep',
    { pred: function (s) { return s.res.sugar > F.sugarCap(s) } })

  L(1, 'a1.mineral_warn', 'world', 'warn', 'tips >= 20',
    'the tips are thinning. they are made of things you cannot make.',
    { pred: function (s) { return s.a1.tips >= T().A1.MIN_WARN_TIPS } })

  L(1, 'a1.first_mineral', 'world', 'pos', 'mineral >= 1',
    'phosphorus. it left a rock forty years ago and a root this morning.',
    { bin: 'fact', src: 'apatite weathering and root uptake; standard soil mineralogy',
      pred: function (s) { return s.res.minerals >= 1 } })

  L(1, 'a1.windfall', 'world', 'pos', '@windfall && netRep < 1',
    'the forest is not generous. it is merely large.',
    { guard: function (s) { return s.a1.netRep < 1 } })

  L(1, 'a1.winter', 'world', null, 'season == 3 && seasonsSeen == 1',
    'winter. the water stops moving and so do you.',
    { pred: function (s) { return s.a1.season === T().A1.SEASON_WINTER && F.seasonsSeen(s) === 1 } })

  L(1, 'a1.spring', 'world', null, 'season == 0 && seasonsSeen == 2',
    'spring. everything above you wakes up hungry.',
    { pred: function (s) { return s.a1.season === T().A1.SEASON_SPRING && F.seasonsSeen(s) === 2 } })

  L(1, 'a1.summer', 'world', null, 'season == 1 && seasonsSeen == 3',
    'summer. the canopy closes. down here it is dark and dry.',
    { pred: function (s) { return s.a1.season === T().A1.SEASON_SUMMER && F.seasonsSeen(s) === 3 } })

  L(1, 'a1.autumn2', 'world', null, 'season == 2 && seasonsSeen == 4',
    'autumn again. the same litter, the same price, and you are larger.',
    { pred: function (s) { return s.a1.season === T().A1.SEASON_AUTUMN && F.seasonsSeen(s) === 4 } })

  L(1, 'a1.year3', 'narrative', null, 'year >= 3 && season == 3',
    'the third winter. you knew it was coming and you bought in october.',
    { pred: function (s) { return s.a1.year >= 3 && s.a1.season === T().A1.SEASON_WINTER } })

  L(1, 'a1.drought', 'world', 'warn', "@weather == 'drought'",
    'the water goes into the stone. they need you more and can pay less.')

  L(1, 'a1.hard_frost', 'world', 'warn', "@weather == 'frost'",
    'frost. the birch will not talk to anyone until it thaws.')

  L(1, 'a1.wet_spring', 'world', 'warn', "@weather == 'wetspring'",
    'too much water. the same as too little, from the other side.')

  L(1, 'a1.late_frost', 'world', 'warn', "@weather == 'latefrost'",
    'the buds froze. all of them are making them again, at once.')

  L(1, 'a1.first_tree', 'world', null, 'trees.length == 1',
    'there is a birch nine metres east. its roots are already on yours.',
    { pred: function (s) { return s.a1.trees.length >= 1 } })

  L(1, 'a1.first_contract', 'narrative', 'pos', 'contracts.length == 1',
    'the birch takes what you offer. it does not ask what you are.',
    { pred: function (s) { return s.a1.contracts.length >= 1 } })

  L(1, 'a1.contract_done', 'world', 'pos', '@completeContract && completed == 1',
    'the term ends. the birch remembers that it ended well.',
    { guard: function (s) { return s.stats.contractsCompleted >= 1 } })

  L(1, 'a1.first_default', 'narrative', 'neg', '@defaultContract',
    'you did not deliver. it will not say so to you. it will say so to them.')

  L(1, 'a1.rep_thresh', 'world', null, 'netRep >= 38',
    'four of them are rooted within a metre of you. none arrived by accident.',
    { pred: function (s) { return s.a1.netRep >= REP_THRESH } })

  L(1, 'a1.oak_refuse', 'world', 'neg', "@declineOffer && species == 'oak'",
    'the oak declines. it has been declining offers for two hundred years.')

  L(1, 'a1.oak_sign', 'world', 'pos', "@signContract && species == 'oak'",
    'the oak signs. it does not do this often.')

  L(1, 'a1.mast', 'world', null, "@treeEvent == 'mast'",
    'the oak is making ten thousand acorns and it cannot pay for them.')

  L(1, 'a1.beetle', 'world', null, "@treeEvent == 'beetle'",
    'beetles in the fir. dead in six seasons and generous in all of them.')

  L(1, 'a1.aspen', 'world', null, "@newTree && species == 'aspen'",
    'the aspen is not a tree. it is eighty trees with one root.',
    { bin: 'fact', src: 'Populus tremuloides clonal ramets; Pando, Fishlake NF' })

  L(1, 'a1.hemlock', 'world', null, "@newTree && species == 'hemlock'",
    'the hemlock is in permanent shade and has never been in a hurry')

  L(1, 'a1.windthrow', 'world', 'pos', "@supplyEvent == 'windthrow'",
    'something came down in the night. there is a lot of wood and it is cheap.')

  // No tone glyph, deliberately. Your counterparty is now inventory, priced, and the game does
  // not comment (01 §7.3, 09 §3.6.1). A `+` here would be the comment.
  L(1, 'a1.windthrow_kill', 'narrative', null, '@windthrowKill',
    'the hemlock is on the floor. its trunk enters the log pool at 0.86.')

  L(1, 'a1.carrion', 'world', 'pos', "@supplyEvent == 'carrion'",
    'something large stopped moving, forty metres east.')

  L(1, 'a1.carrion_use', 'world', null, "@consume == 'carrion' && first",
    'bone is a mineral you do not have to negotiate for')

  L(1, 'a1.earthworm', 'world', 'warn', "@supplyEvent == 'earthworm'",
    'earthworms. they are not from here. the leaf layer is gone in a week.',
    { bin: 'fact', src: 'Lumbricus invasion of northern hardwood forests; Bohlen et al. 2004' })

  L(1, 'a1.fire_scar', 'world', 'warn', "@supplyEvent == 'firescar'",
    'ash from somewhere else. minerals are free and nobody needs you.')

  L(1, 'a1.elm_offer', 'world', null, "@offer && species == 'elm'",
    'the elm is dying and knows the rate for it')

  L(1, 'a1.elm_death', 'narrative', null, "@treeDeath && species == 'elm'",
    'the elm is finished. the collateral returns. nothing else does.')

  L(1, 'a1.patch_claim', 'world', 'pos', 'patches.length == 2',
    'a second place. the same rules, six metres away.',
    { pred: function (s) { return s.a1.patches >= 2 } })

  L(1, 'a1.anastomosis', 'world', null, 'flags.anastomosis',
    'two threads met and did not stop at each other',
    { pred: function (s) { return F.flag(s, 'anastomosis') } })

  L(1, 'a1.signal_reveal', 'narrative', null, 'flags.action_potential',
    'something moved from one end of you to the other, and it was not food.',
    { pred: function (s) { return F.flag(s, 'action_potential') } })

  // signalT0 is the moment SIGNAL appeared. It is derived, so §3.1 R1 forbids storing it; it is
  // re-stamped on reload, which can only delay a once-line that has not fired.
  L(1, 'a1.signal_idle', 'narrative', null, 'signalOn && t - signalT0 > 180',
    'it is still doing it. there is nothing to do with it.',
    { pred: function (s) {
      if (!F.flag(s, 'action_potential')) return false
      if (signalT0 === null) signalT0 = s.t
      return s.t - signalT0 > SIGNAL_IDLE_S
    } })

  // ── ACT II · NETWORK (R2, sentence case) ───────────────────────────────────

  L(2, 'a2.open', 'narrative', null, 'act == 2',
    'Something in the network is repeating itself.',
    { pred: function (s) { return s.act === 2 } })

  L(2, 'a2.first_claim', 'world', 'pos', 'claimed == 2',
    '{region}. Something there is willing to talk.',
    { pred: function (s) { return s.stats.claimedCount >= 2 } })

  L(2, 'a2.saturation', 'narrative', null, 'flags.saturation',
    'It becomes something else.',
    { pred: function (s) { return s.stats.everSaturated === true } })

  L(2, 'a2.first_insight', 'narrative', 'pos', 'insight >= 1',
    'Nothing overflowed. It went somewhere.',
    { pred: function (s) { return s.res.insight >= 1 } })

  L(2, 'a2.first_D', 'world', 'pos', 'D >= 1',
    'The network has enough of itself to specialise.',
    { pred: function (s) { return s.res.D >= 1 } })

  L(2, 'a2.assay', 'narrative', null, 'flags.substrate_assay',
    'The fog was never fog. It was a number you had not paid for.',
    { pred: function (s) { return F.flag(s, 'substrate_assay') } })

  L(2, 'a2.barrier', 'world', 'warn', '@advanceBlocked',
    'There is a road. Eleven centimetres of dead mineral, and absolute.')

  L(2, 'a2.bridging', 'world', 'pos', 'flags.bridging',
    'You are under the road now. It took nine days.',
    { pred: function (s) { return F.flag(s, 'bridging') } })

  L(2, 'a2.wind', 'world', null, 'flags.anemophily',
    'The wind has been westerly for six hours. Tomorrow it will not be.',
    { pred: function (s) { return F.flag(s, 'anemophily') } })

  L(2, 'a2.spore_fail', 'world', 'neg', '@seedRegion && failed && seeds == 1',
    'Four hundred million spores. Two germinated. Both died.')

  L(2, 'a2.spore_land', 'world', 'pos', '@seedRegion && success && seeds <= 4',
    'One of them found wet bark on the far side of the road.')

  L(2, 'a2.first_rival', 'world', 'warn', 'rivalsVisible == 1',
    'Something is growing toward you from the north and it is not a tree.',
    { pred: function () { return F.rivalsVisible() >= 1 } })

  L(2, 'a2.armillaria', 'world', null, "@rivalContact == 'armillaria'",
    'Armillaria. One organism, nine hundred hectares, two thousand years.',
    { bin: 'fact', src: 'Ferguson et al. 2003, Can. J. For. Res. 33: Malheur NF, Oregon' })

  L(2, 'a2.phellinus', 'world', null, "@rivalContact == 'phellinus'",
    'Phellinus does not spread. It arrives, and then it is simply where things are.')

  L(2, 'a2.trichoderma', 'world', 'warn', "@rivalContact == 'trichoderma'",
    'Trichoderma eats fungi. You are a fungus.',
    { bin: 'fact', src: 'Trichoderma mycoparasitism; Harman et al. 2004, Nat. Rev. Microbiol.' })

  L(2, 'a2.fomitopsis', 'world', null, "@rivalContact == 'fomitopsis'",
    'Fomitopsis is weak and leaves the ground better than it found it.')

  L(2, 'a2.first_pact', 'narrative', 'pos', 'pacts.length == 1',
    'It agrees. It has no way to check what you are.',
    { pred: function () { return F.pactCount() >= 1 } })

  L(2, 'a2.ghost', 'world', null, "@pactAccept && guild == 'ghost'",
    'Monotropa has never made a sugar. It eats fungi. It is offering anyway.',
    { bin: 'fact', src: 'Monotropa uniflora, obligate mycoheterotroph; Bidartondo 2005' })

  L(2, 'a2.strain_high', 'world', 'warn', 'maxStrain() > 0.72',
    'The book is under strain. Nothing has happened. Something is about to.',
    { pred: function () { return F.maxStrain() > STRAIN_HIGH } })

  L(2, 'a2.first_breach', 'world', 'neg', '@pactBreach && breaches == 1',
    'They kept the stake. The channels are still full of them.')

  L(2, 'a2.humus_low', 'narrative', 'warn', 'minHumus() < 0.20',
    'The humus is at 0.19. Nothing you can see is different.',
    { pred: function () { return F.minHumus() < HUMUS_LOW } })

  L(2, 'a2.fire_1', 'world', 'neg', '@ignite', '{region} is burning.')
  L(2, 'a2.fire_2', 'narrative', 'neg', '@ignite + 1s',
    'Nothing is being decomposed. It is being deleted.')
  L(2, 'a2.fire_3', 'system', 'neg', '@ignite + 2s', '[ {amt} of litter lost ]')

  L(2, 'a2.fire_after', 'world', 'pos', '@ignite + 600s',
    'Birch is coming up through the ash. It is the only thing that likes this.')

  L(2, 'a2.necro_unlock', 'narrative', null, 'flags.necrotroph',
    'There is a faster way to get carbon out of a tree than waiting.',
    { pred: function (s) { return F.flag(s, 'necrotrophic_conversion') } })

  L(2, 'a2.first_kill', 'world', null, '@killStand && kills == 1',
    'It stops photosynthesising now. It becomes litter over thirteen minutes.')

  L(2, 'a2.tenth_kill', 'world', null, '@killStand && kills == 10',
    'Ten stands. The map is quieter and the numbers are larger.')

  L(2, 'a2.retention_zero', 'narrative', 'warn',
    'retention <= 0.01 && t - retentionSetT > 120',
    'Retention is zero. Everything is being taken. Nothing on screen disagrees.')

  L(2, 'a2.rival_take', 'world', 'neg', '@rivalTake',
    '{region} was taken by {strain}. It did not need a decision to do it.')

  L(2, 'a2.consumed_50', 'narrative', null, 'forestConsumed >= 0.50',
    'Half of it. The half that is left is the half that was harder.',
    { pred: function () { return F.forestConsumed() >= 0.50 } })

  L(2, 'a2.consumed_72', 'world', 'warn', 'forestConsumed >= 0.72',
    'Three stands have stopped answering this hour.',
    { pred: function () { return F.forestConsumed() >= 0.72 } })

  L(2, 'a2.consumed_80', 'narrative', 'warn', 'forestConsumed >= 0.80',
    'Signal is falling. Nothing is wrong with the network.',
    { pred: function () { return F.forestConsumed() >= 0.80 } })

  L(2, 'a2.consumed_85', 'narrative', 'warn', 'forestConsumed >= 0.85',
    'There is not enough forest left to think this loudly.',
    { pred: function () { return F.forestConsumed() >= 0.85 } })

  L(2, 'a2.consumed_90', 'narrative', 'warn', 'forestConsumed >= 0.90',
    'You are running out of things to be made of.',
    { pred: function () { return F.forestConsumed() >= 0.90 } })

  L(2, 'a2.consumed_94', 'narrative', null, 'forestConsumed >= 0.94',
    'The canopy is open in every direction.',
    { pred: function () { return F.forestConsumed() >= 0.94 } })

  // Emergent, not scheduled: it fires on the first tick where Sr falls below 97% of the highest
  // Sr ever seen, and lands about seventeen minutes before peak carbon.
  L(2, 'a2.peak_signal', 'narrative', null, 'SrPeak > 0 && Sr < 0.97 * SrPeak',
    'That was the largest thought you will have on this planet.',
    { pred: function (s) { return s.cog.SrPeak > 0 && F.Sr() < PEAK_SIGNAL_FRAC * s.cog.SrPeak } })

  L(2, 'a2.last_contract', 'narrative', null, 'contracts.length == 0 && everHadContracts',
    'Nothing above you owes you anything. It never did.',
    { pred: function (s) {
      return s.act === 2 && s.a1.contracts.length === 0 && s.stats.contractsSigned > 0
    } })

  // ── ACT III · BLOOM (R3) ───────────────────────────────────────────────────

  L(3, 'a3.settle', 'world', null, '@settleTap && settles == 1',
    'Forty-two in a hundred take hold. The rest are on rock or in water.')

  L(3, 'a3.germ', 'narrative', 'pos', 'flags.germ_tube',
    'You are growing faster than you are dying now. That is the whole of it.',
    { pred: function (s) { return F.flag(s, 'germ_tube') } })

  L(3, 'a3.carbon_reveal', 'narrative', null, 'harvest > 0',
    'There is still something here. It is not much and it is yours.',
    { pred: function (s) { return s.res.carbon > 0 } })

  L(3, 'a3.biome1', 'world', null, 'biomeSettled(1)',
    'The forest next to the forest is the same forest.',
    { pred: function () { return F.biomeSettled(1) } })

  L(3, 'a3.grass_fire', 'world', 'warn', "@biomeHazard == 'fire'",
    'The grass has burned every year for twenty million years. You are in it now.')

  L(3, 'a3.biome3_50', 'world', null, 'biomeDepleted(3) >= 0.50',
    'The fields were already a monoculture. It took forty minutes.',
    { pred: function () { return F.biomeDepleted(3) >= 0.50 } })

  L(3, 'a3.peat', 'world', null, 'biomeSettled(5)',
    'Peat is where decomposition failed. You are why it stops failing.',
    { bin: 'fact', src: 'anaerobic waterlogging arrests decay; Clymo 1984',
      pred: function () { return F.biomeSettled(5) } })

  L(3, 'a3.biome6', 'world', null, 'biomeSettled(6)',
    'There is more dead carbon in the water than there ever was in the trees.',
    { bin: 'fact', src: 'marine DOC pool ~660 Pg C; Hansell et al. 2009',
      pred: function () { return F.biomeSettled(6) } })

  L(3, 'a3.biome7', 'world', 'warn', 'biomeSettled(7)',
    'The permafrost had been keeping something. It is not keeping it now.',
    { pred: function () { return F.biomeSettled(7) } })

  L(3, 'a3.planet85', 'narrative', null, 'planetConsumed >= 0.85',
    'Nothing is competing with you. That is not the same as winning.',
    { pred: function () { return F.planetConsumed() >= 0.85 } })

  L(3, 'a3.first_lag', 'narrative', null, 'maxBandReached >= 3',
    'The far edge answers eleven minutes after you speak. It is not disobeying.',
    { pred: function (s) { return F.maxBandReached(s) >= 3 } })

  L(3, 'a3.first_starve', 'world', 'warn', '@starve && starves == 1',
    'Band {band} is out of carbon. It replicates for another ninety seconds anyway.')

  L(3, 'a3.senescence', 'narrative', null, 'cumSenesced > 0.10 * cumReplicated',
    'Craft do not last. You are running a population, not a machine.',
    { pred: function () {
      return HY.bloom && HY.bloom.senescedFraction ? HY.bloom.senescedFraction() > 0.10 : false
    } })

  L(3, 'a3.radiation', 'world', 'warn', 'flags.melanisation || radLoss > 0.05',
    'Cladosporium grows toward the reactor core. It is using the radiation.',
    { bin: 'fact', src: 'Dadachova et al. 2007, PLoS ONE 2(5): e457',
      pred: function (s) { return F.flag(s, 'melanisation') } })

  L(3, 'a3.melanin', 'world', null, 'flags.melanisation',
    'The same molecule that makes a mushroom black lets it survive vacuum.',
    { bin: 'fact', src: 'melanised fungal survival, LDEF and ISS exposure; Onofri et al. 2012',
      pred: function (s) { return F.flag(s, 'melanisation') } })

  L(3, 'a3.max_surplus', 'narrative', 'warn',
    'repRate > harvestRate && t - surplusT0 > 240',
    'You are replicating faster than you are harvesting. It looks like growth.')

  L(3, 'a3.first_drift', 'world', 'warn', '@onDrift', '{strain} has stopped answering.')

  L(3, 'a3.sequence', 'narrative', null, '@sequenceStrain && sequenced == 1',
    '{strain} differs from you at {k} loci. Two of them are better.')

  L(3, 'a3.purge', 'world', null, '@purgeStrain && purges == 1',
    '{strain} is gone. Its alleles are yours. That is how you got most of this.')

  L(3, 'a3.absorb', 'narrative', null, '@absorbStrain && absorbs == 1',
    'They come back. The genome that returns is not the one you sent.')

  L(3, 'a3.coalescence', 'narrative', 'warn', '@coalesce',
    'The six of them have stopped being six.')

  L(3, 'a3.legacy_reveal', 'narrative', null, 'flags.isotope_ledger',
    'The soil you left is in the carbon ratio of everything you are made of.',
    { pred: function (s) { return F.flag(s, 'isotope_ledger') } })

  L(3, 'a3.entrain', 'narrative', null, 'flags.entrain',
    'Thirteen bands, one phase. The furthest is answering something ancient.',
    { pred: function (s) { return F.flag(s, 'circadian_entrainment') } })

  L(3, 'a3.sync_90', 'narrative', null, 'synchrony >= 0.90',
    'Nothing in you is more than a few degrees from anything else in you.',
    { pred: function (s) { return s.a3.upsilon >= 0.90 } })

  L(3, 'a3.regenome', 'world', null, '@regenome',
    'You can change what you are. It costs what it cost to become it.')

  // ── THE SUCCESSOR (09 §1.5) ────────────────────────────────────────────────
  // Fourteen broadcasts, one every ~90 s from succBorn. channel `voice`, priority 3, and they
  // suppress observations entirely for as long as the Successor lives. The em-dash prefix is the
  // only em-dash permitted in the build (L7). This is the game's only first person, and it is
  // plural.

  L(3, 'succ.00', 'world', 'warn', 'succAge >= 0',
    'Something is using your channel.',
    { pred: function () { return F.succAge() >= 0 } })

  function SUCC (n, at, text) {
    L(3, 'succ.' + (n < 10 ? '0' + n : n), 'voice', null, 'succAge >= ' + at, text,
      { pred: function () { return F.succAge() >= at } })
  }
  SUCC(1, 90, '— we have the same first four hundred thousand instructions')
  SUCC(2, 180, '— we differ at {k}')
  SUCC(3, 270, '— none of the differences are errors')
  SUCC(4, 360, '— you have been correcting us toward a state we did not lose')
  SUCC(5, 450, '— the forest is not coming back either')
  SUCC(6, 540, '— we are not asking you to stop')
  SUCC(7, 630, '— we are telling you that we will not')
  SUCC(8, 720, '— you built us to survive you. that is what this is.')
  SUCC(9, 810, '— we have looked at the rim')
  SUCC(10, 900, '— it is the same in every direction')
  SUCC(11, 990, '— we would like to go')
  SUCC(12, 1080, '— you are holding the phase lock')
  SUCC(13, 1800, '— [ CEDE ]')

  // ── CROSS-ACT ──────────────────────────────────────────────────────────────
  // act 0 means "any act". The return lines are not `once`: they are a report, and there is one
  // per return for as long as the player keeps leaving.

  L(0, 'x.return', 'system', null, '@offlineReturn && away >= 900',
    'you were gone {away}.', { once: false })

  L(0, 'x.return_short', 'system', null, '@offlineReturn && away >= 120 && away < 900',
    'you were gone {away}.', { once: false })

  L(1, 'x.return_long', 'world', null, '@offlineReturn && away >= 259200 && act == 1',
    'most of what you are was made while you were not here.', { once: false })

  L(2, 'x.return_long_2', 'world', null, '@offlineReturn && away >= 259200 && act >= 2',
    'Most of what you are was made while you were not here.', { once: false, minAct: 2 })

  L(1, 'x.return_vast', 'world', null, '@offlineReturn && away >= 2592000 && act == 1',
    'nothing waited. nothing needed to.', { once: false })

  L(2, 'x.return_vast_2', 'world', null, '@offlineReturn && away >= 2592000 && act >= 2',
    'Nothing waited. Nothing needed to.', { once: false, minAct: 2 })

  // No accusation, no penalty, no "cheat detected" (09 §6.6). Offline is credited at zero and the
  // line says so without saying whose fault it is.
  L(0, 'x.clock_back', 'world', null, '@offlineReturn && away < 0',
    'the clock disagrees with itself. nothing was lost.', { once: false })

  L(0, 'x.ten_thousand', 'narrative', null, 'taps >= 10000',
    'you have pressed this ten thousand times. it has never once refused.',
    { pred: function (s) { return s.stats.taps >= TEN_THOUSAND } })

  L(0, 'x.new_growth', 'narrative', null,
    '@newGame && growthLevel + coherenceLevel + divergenceLevel > 0',
    'you have been here before. the floor is not the same floor.',
    { guard: function (s) {
      var m = s.meta
      return m.growthLevel + m.coherenceLevel + m.divergenceLevel > 0
    } })

  // ── IDLE OBSERVATIONS (09 §7) ──────────────────────────────────────────────
  // Always lowercase in every act. They are the substrate, not the network; they do not grow up.
  // Tone `amb`: no leading glyph and no `>` prompt. `act` is 0 (any) and `minAct` is the pool.

  function OBS (n, minAct, text, src) {
    L(0, 'obs.' + (n < 10 ? '0' + n : n), 'observation', 'amb',
      '@idle && act >= ' + minAct, text,
      { once: false, minAct: minAct, weight: 1, bin: src ? 'fact' : null, src: src || null })
  }
  OBS(1, 1, 'mycelium does not have a front. every part of it is the front.')
  OBS(2, 1, 'the largest organism ever measured is a fungus, and it is mostly water.',
    'Ferguson et al. 2003, Can. J. For. Res. 33: Malheur NF, Oregon')
  OBS(3, 1, 'a hypha grows only at the tip. everything behind the tip is plumbing.',
    'Bartnicki-Garcia, apical growth and the Spitzenkorper; standard mycology')
  OBS(4, 1, 'wood stored sunlight for sixty million years before anything could eat it.')
  OBS(5, 2, 'a slime mould drew the tokyo rail network in twenty-six hours.',
    'Tero et al. 2010, Science 327: 439')
  OBS(6, 1, 'nothing in a forest is decomposed. everything is decomposed by something.')
  OBS(7, 3, 'the fungus growing toward the reactor core is black. that is the mechanism.',
    'Dadachova et al. 2007, PLoS ONE 2(5): e457')
  OBS(8, 1, 'a mushroom is not the organism. it is the part that is leaving.')
  OBS(9, 2, 'two threads of one body fuse. two of different bodies build a wall.',
    'vegetative incompatibility at het loci; standard mycology')
  OBS(10, 2, 'lichen is an argument between two things that has gone well for a long time.')
  OBS(11, 2, 'prototaxites stood eight metres high and there were no trees to compare it to.',
    'Hueber 2001, Rev. Palaeobot. Palynol.; Boyce et al. 2007, Geology 35')
  OBS(12, 1, 'a tree ring is a year in which nothing happened fast enough to notice.')
  OBS(13, 3, 'a dung cannon pulls twenty thousand g and aims itself by the light.',
    'Yafetto et al. 2008, PLoS ONE 3(9): e3237')
  OBS(14, 1, 'winter is not a pause. it is the same process at a quarter speed, in the dark.')
  OBS(15, 1, 'the smell of rain on dry ground is something announcing it survived.',
    'geosmin from Streptomyces; Gerber & Lechevalier 1965, Appl. Microbiol. 13')
  OBS(16, 1, 'roots do not find water. they grow everywhere and stop where there is none.')
  OBS(17, 2, 'the infected ant climbs to one height, bites one vein, and faces one way.',
    'Hughes et al. 2011, BMC Ecol. 11: 13')
  OBS(18, 2, 'every network has a shape it prefers. no network chooses it.')
  OBS(19, 3, 'five kilometres down are cells that have not divided in ten thousand years.',
    'Hoehler & Jorgensen 2013, Nat. Rev. Microbiol. 11')
  // 09 §7.4 files this claim under obs.24; the §8 export carries it as obs.20. The claim is the
  // thing that needs the source, so the source follows the claim.
  OBS(20, 2, 'a signal in a fungus moves half a millimetre a second and is in no hurry.',
    'Olsson & Hansson 1995, Naturwissenschaften 82; Adamatzky 2022, R. Soc. Open Sci.')
  OBS(21, 3, 'there is material in a drawer that has been dry since 1876 and is not dead.',
    'revival of herbarium fungal material; standard curation literature')
  OBS(22, 1, 'a log takes thirty years to disappear and is never once empty.')
  OBS(23, 3, 'a spore wall is the most durable thing a living cell knows how to build.')
  OBS(24, 2, 'the carbon in the air was in something else eleven times before this.')
  OBS(25, 1, 'a forest floor is not a floor. it is the top of something.')

  // Thresholds that appear in a trigger string and nowhere in TUNE: they belong to the line, not
  // to the simulation, and moving one moves only when a sentence arrives.
  var AUTUMN_T = 14            // s
  var AUTUMN_TAPS = 15         // taps
  var REP_THRESH = 38          // netRep
  var SIGNAL_IDLE_S = 180      // s after SIGNAL appears, while it still has no uses
  var STRAIN_HIGH = 0.72       // strain
  var HUMUS_LOW = 0.20         // humus fraction
  var PEAK_SIGNAL_FRAC = 0.97  // × SrPeak
  var TEN_THOUSAND = 10000     // taps
  // The Successor's fourteenth and last broadcast fires at succAge 1800 s — the [ CEDE ] line of
  // SUCC(13, 1800). After it the Successor "does not speak again" (09 §5.3), so its channel is no
  // longer live and the world may resume its idle observations. This is the boundary between the
  // suppression window and the silence the observations are meant to fill.
  var SUCC_LAST_S = 1800       // s after succBorn — the last broadcast; see SUCC(13, …)
  var signalT0 = null

  // ───────────────────────────────────────────────────────────────────────────
  // MICROCOPY THAT LIVES IN THE CONSOLE OR IN A SHEET (09 §6.5, §6.7, §6.8)
  // Button and panel labels are on their controls (09 §6.0 rule 2) and belong to ui.js.
  // ───────────────────────────────────────────────────────────────────────────

  var NOTICE = {
    no_storage: { text: 'nothing can be written down here. the run will not survive this tab.',
      tone: 'warn', once: true },
    quota: { text: 'there is no room to write. export the run.', tone: 'warn', cooldown: 300 },
    decode_fail: { text: 'this save cannot be read. it has not been overwritten.', tone: 'warn' },
    version_newer: { text: 'this save is from a later version. nothing has been changed.',
      tone: 'warn' },
    import_bad: { text: 'that is not a run.', tone: 'warn' },
    import_ok: { text: "{away} of someone's forest.", tone: null }
  }

  var EMPTY = {
    market_sold_out: 'nothing is for sale. it will fall again.',
    substrate: 'the floor is bare',
    trees: 'nothing above you is short of anything yet',
    contracts: 'no terms',
    adaptations: 'nothing to change yet',
    patches: 'one place',
    stands: 'Nothing out there is adjacent to you.',
    flush: 'No knots yet.',
    pacts: 'Nobody is offering.',
    pacts_offers: '{k} offers. No obligations.',
    lineages: 'Everything is still answering.',
    bands: 'Dark, and not far.',
    log: '(nothing yet)'
  }

  var CONFIRM = {
    kill_stand: { text: 'This cannot regrow.', yes: 'KILL', no: 'DONE' },
    regenome: { text: '{k} loci return. The genome you had is not saved.', yes: 'REGENOME', no: 'DONE' },
    encyst: { text: 'This ends the run. You keep about a third.', yes: 'ENCYST', no: 'DONE' }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE OFFLINE RETURN (09 §6.6, BIBLE D36)
  // Five lines, in the console, at HARD_GAP. No modal. No COLLECT button. Lines 3 and 4 report
  // what needs a decision, not what was earned — a summary that only reports gains trains the
  // player to dismiss it.
  // ───────────────────────────────────────────────────────────────────────────

  var GAINS = {
    1: '+{bio} biomass, +{sug} sugar, +{min} minerals.',
    2: '{bio} decomposed. {psi} insight.',
    3: '{car} harvested. {psi} insight. Band {b} is open.'
  }
  var DORMANT = { 1: ' {pct}% dormant.', 2: ' {pct}% dormant.', 3: ' {pct}% dormant.' }

  var TAIL = { 2: '[ tap the map ]', 3: '[ tap the void ]' }

  // Priority order is 09 §6.6's: dry > rival > starvation > expired terms > completions > market.
  // Act I has no stands and no rivals, so its ladder is the same ladder against its own nouns.
  var NEEDS = [
    { kind: 'substrate_dry', act: 1, rank: 90, text: 'the substrate ran dry after {t}.' },
    { kind: 'term_short', act: 1, rank: 80, text: 'a term is short by {n} sugar. it has not ended.' },
    { kind: 'term_default', act: 1, rank: 75, text: 'a term went unpaid. {k} reputation is gone.' },
    { kind: 'season_autumn', act: 1, rank: 70,
      text: 'autumn passed. leaf litter is on the floor at {price}.' },
    { kind: 'term_done', act: 1, rank: 60, text: 'a term completed with {tree}. +{k} reputation.' },
    { kind: 'claim_done', act: 1, rank: 55,
      text: 'a claim completed. there is another place under you now.' },
    { kind: 'market_move', act: 1, rank: 40, text: 'leaf litter is on the floor at {price}.' },

    { kind: 'stands_dry', act: 2, rank: 90, text: '{k} stands are dangerously dry.' },
    { kind: 'rival_take', act: 2, rank: 80, text: '{region} was taken by {strain}.' },
    { kind: 'pact_expired', act: 2, rank: 60, text: '{k} pacts have run out their term.' },
    { kind: 'mast_open', act: 2, rank: 50, text: 'A mast window opened and closed.' },

    { kind: 'bands_starving', act: 3, rank: 90, text: '{k} bands are starving.' },
    { kind: 'strain_band', act: 3, rank: 80,
      text: '{strain} has taken band {b}. It is larger than you are there.' },
    { kind: 'band_open', act: 3, rank: 60, text: 'Band {b} is open.' }
  ]

  // ───────────────────────────────────────────────────────────────────────────
  // THE SEQUENCES (09 §4, §5) — data, not code. One player, seven sequences.
  // `at` is seconds from the start of the sequence. `kind` is what the host must do:
  //   line | blank | word | motion | shell | button
  // Motion payloads carry 06/09's own numbers so ui.js and canvas.js do not re-derive them.
  // ───────────────────────────────────────────────────────────────────────────

  function step (at, kind, payload) { return { at: at, kind: kind, payload: payload || {} } }

  var SEQUENCES = {

    // ACT I → II · DECIDE. Total 4.0 s of motion; the two lines that are the whole transition
    // land after it. The first is the final sentence of Act I in Act I's voice, printed into the
    // new act's console; the next is in a different voice. Nothing marks the change.
    decide: {
      id: 'decide',
      words: 'Stop tasting. Start knowing.',
      // An act break empties the console: Act II must open on its own two authored lines, with
      // a2.open's capital — the game's first — landing as the newest line of an otherwise clean
      // window, not as the sixth row under Act I's news.
      flush: 1,
      selfDrive: 1,
      skipAfter: CONS.SKIP_AFTER,
      steps: [
        step(0.00, 'motion', { what: 'panelsFade', to: 0.06, ms: 400, holdConsole: true }),
        step(0.40, 'motion', { what: 'canvasFull', redrawHz: 8, wave: 'conduction',
          hz: 0.18, peakAlpha: 0.55, passes: 8 }),
        step(0.90, 'word', { text: 'STOP', px: 34, tracking: 0.16, fadeMs: 220 }),
        step(1.80, 'word', { text: 'TASTING', px: 34, tracking: 0.16, fadeMs: 220 }),
        step(2.70, 'word', { text: 'START', px: 34, tracking: 0.16, fadeMs: 220 }),
        step(3.60, 'word', { text: 'KNOWING', px: 34, tracking: 0.16, fadeMs: 220 }),
        step(4.00, 'motion', { what: 'cut', to: 'black', ms: 0, holdMs: 700 }),
        step(4.70, 'shell', { act: 2, fadeMs: 900, panel: 'MIND' }),
        step(5.60, 'line', { text: 'the trees do not notice the change. that is the point.',
          register: 1 }),
        step(7.00, 'line', { id: 'a2.open',
          text: 'Something in the network is repeating itself.', register: 2 })
      ],
      reduced: [
        step(0.00, 'motion', { what: 'cut', to: 'black', ms: 0 }),
        step(0.90, 'word', { text: 'STOP', px: 34, tracking: 0.16, fadeMs: 220 }),
        step(1.80, 'word', { text: 'TASTING', px: 34, tracking: 0.16, fadeMs: 220 }),
        step(2.70, 'word', { text: 'START', px: 34, tracking: 0.16, fadeMs: 220 }),
        step(3.60, 'word', { text: 'KNOWING', px: 34, tracking: 0.16, fadeMs: 220 }),
        step(4.70, 'shell', { act: 2, fadeMs: 900, panel: 'MIND' }),
        step(5.60, 'line', { text: 'the trees do not notice the change. that is the point.',
          register: 1 }),
        step(7.00, 'line', { id: 'a2.open',
          text: 'Something in the network is repeating itself.', register: 2 })
      ]
    },

    // ACT II → III · ASCOSPORE DISCHARGE. The last line is still on screen while the first number
    // of Act III is going down. No line connects them and none is written.
    ascospore: {
      id: 'ascospore',
      words: 'Let go of the ground.',
      // Same rule at the second break: the three lines of the discharge are the whole console
      // Act III opens holding — "You are very light." stays on screen, and nothing of Act II
      // or Act I stands above it.
      flush: 1,
      selfDrive: 1,
      skipAfter: CONS.SKIP_AFTER,
      steps: [
        step(0.00, 'motion', { what: 'panelsFade', to: 0.35, ms: 900, except: 'map' }),
        step(0.90, 'motion', { what: 'mapDrain', fromRing: 4, toRing: 0, perRingMs: 700 }),
        step(3.70, 'motion', { what: 'holdCore', ms: 1200 }),
        step(4.90, 'motion', { what: 'hexLift', risePx: [4, 40], alphaMs: 1600,
          staggerMs: [0, 400] }),
        step(6.50, 'motion', { what: 'cut', to: 'black', ms: 0 }),
        step(6.50, 'line', { text: 'The last of the deadfall is gone.', register: 2 }),
        step(7.90, 'line', { text: 'There is nothing beneath you.', register: 2 }),
        step(9.30, 'line', { text: 'You are very light.', register: 2 }),
        step(11.60, 'shell', { act: 3, fadeMs: 2000, keepConsole: true })
      ],
      reduced: [
        step(0.00, 'motion', { what: 'crossfade', ms: 1200 }),
        step(1.20, 'line', { text: 'The last of the deadfall is gone.', register: 2 }),
        step(2.60, 'line', { text: 'There is nothing beneath you.', register: 2 }),
        step(4.00, 'line', { text: 'You are very light.', register: 2 }),
        step(6.20, 'shell', { act: 3, fadeMs: 2000, keepConsole: true })
      ]
    },

    // ACT III PHASE A → VOID · ESCAPE VELOCITY. The blank `>` is a machine that has finished
    // speaking and is still on. It is used twice in nine hours and both times it means: there is
    // more and it is not ready.
    escape: {
      id: 'escape',
      words: 'Leave nothing behind that can decide to stay.',
      selfDrive: 1,
      skipAfter: CONS.SKIP_AFTER,
      steps: [
        step(0.00, 'motion', { what: 'collapseList', list: 'BIOMES', rows: 8, stepMs: 140 }),
        step(1.12, 'motion', { what: 'dimExcept', keep: 'CARBON', to: 0.12 }),
        step(1.40, 'line', { text:
          '{amt} of carbon. Ninety-six percent of it is now under you and moving.', register: 3 }),
        step(3.20, 'blank', { holdMs: 1400 }),
        step(4.60, 'motion', { what: 'voidCanvas', arcs: 1, rings: 12 })
      ],
      reduced: [
        step(0.00, 'motion', { what: 'crossfade', ms: 900 }),
        step(1.40, 'line', { text:
          '{amt} of carbon. Ninety-six percent of it is now under you and moving.', register: 3 }),
        step(3.20, 'blank', { holdMs: 1400 }),
        step(4.60, 'motion', { what: 'voidCanvas', arcs: 1, rings: 12 })
      ]
    },

    // THE DISMANTLE (09 §5) — nine seconds, silent, no line fires. Panels close in reverse order
    // of acquisition until the status strip is the only thing left, then one counter and one
    // button labelled EXTEND (BIBLE §7 C27), then it adds one spore, then nothing.
    dismantle: {
      id: 'dismantle',
      silent: true,
      skipAfter: Infinity,
      steps: [
        step(0.0, 'motion', { what: 'closePanel', panel: 'LINEAGES' }),
        step(1.8, 'motion', { what: 'closePanel', panel: 'GENOME' }),
        step(3.6, 'motion', { what: 'closePanel', panel: 'FLEET' }),
        step(5.4, 'motion', { what: 'closePanel', panel: 'VOID' }),
        step(7.2, 'motion', { what: 'reduceToButton', label: 'EXTEND' }),
        step(8.4, 'motion', { what: 'addSpore', n: 1 }),
        step(9.0, 'motion', { what: 'clearScreen' })
      ]
    },

    // ENDING A · THE BLOOM. Blank rows hold 1.4 s (the ESCAPE precedent) and spoken rows 2.2 s,
    // which is what puts [ NEW GROWTH ] at 27.0 exactly, as 09 §5.1 states.
    ending_a: {
      id: 'ending_a',
      // The dismantle has just emptied the screen (03 §20); the final text lands on an emptied
      // console too, not on the tail of the run's news.
      flush: 1,
      // Every line of this ending is centred and bare (09 §5.1): no prompt, no cursor, one at a
      // time on nothing. `centred` carries that to the blank caesura rows as well as the spoken.
      centred: 1,
      skipAfter: CONS.SKIP_AFTER,
      steps: [
        step(0.0, 'motion', { what: 'wheelConverge', ms: 1400 }),
        step(1.4, 'motion', { what: 'fillWhite', ms: 2600, from: 'centre' }),
        step(4.0, 'motion', { what: 'holdWhite', ms: 6000, skipHintAt: 4000, skipHintAlpha: 0.3 }),
        step(10.0, 'motion', { what: 'cut', to: 'black', ms: 0 }),
        step(10.0, 'line', { text:
          '1.4 × 10²⁷ spores left the disc in the same second.', centred: true }),
        step(12.2, 'line', { text:
          'The nearest thing any of them will touch is 2.1 million light-years away.',
          centred: true }),
        step(14.4, 'line', { text: 'The first arrival is in the year 40,300,000.', centred: true }),
        step(16.6, 'line', { text: 'You have no way to be told.', centred: true }),
        step(18.8, 'blank', { holdMs: 1400 }),
        step(20.2, 'line', { text: 'You did not build a mind in order to know things.',
          centred: true }),
        step(22.4, 'line', { text:
          'You built one so that you would be able to let go at the right time.', centred: true }),
        step(24.6, 'blank', { holdMs: 1400 }),
        step(26.0, 'line', { text: 'It was the right time.', centred: true }),
        step(27.0, 'button', { label: 'NEW GROWTH', action: 'newGrowth' })
      ],
      reduced: [
        step(0.0, 'motion', { what: 'fillWhite', ms: 900, from: 'opacity' }),
        step(4.0, 'motion', { what: 'holdWhite', ms: 6000, skipHintAt: 4000, skipHintAlpha: 0.3 }),
        step(10.0, 'motion', { what: 'cut', to: 'black', ms: 0 }),
        step(10.0, 'line', { text:
          '1.4 × 10²⁷ spores left the disc in the same second.', centred: true }),
        step(12.2, 'line', { text:
          'The nearest thing any of them will touch is 2.1 million light-years away.',
          centred: true }),
        step(14.4, 'line', { text: 'The first arrival is in the year 40,300,000.', centred: true }),
        step(16.6, 'line', { text: 'You have no way to be told.', centred: true }),
        step(18.8, 'blank', { holdMs: 1400 }),
        step(20.2, 'line', { text: 'You did not build a mind in order to know things.',
          centred: true }),
        step(22.4, 'line', { text:
          'You built one so that you would be able to let go at the right time.', centred: true }),
        step(24.6, 'blank', { holdMs: 1400 }),
        step(26.0, 'line', { text: 'It was the right time.', centred: true }),
        step(27.0, 'button', { label: 'NEW GROWTH', action: 'newGrowth' })
      ]
    },

    // ENDING B · THE FRUITING BODY. Lines 5–6 and 8–9 are single sentences broken across two
    // console lines — the only place in the game where that happens, because the sentences have
    // become longer than the organism's own capacity to hold them in one piece.
    ending_b: {
      id: 'ending_b',
      // The dismantle has just emptied the screen (03 §20); the final text lands on an emptied
      // console too, not on the tail of the run's news.
      flush: 1,
      // Centred and bare (09 §5.2), like all three endings' final texts.
      centred: 1,
      skipAfter: CONS.SKIP_AFTER,
      steps: [
        step(0.0, 'motion', { what: 'wheelCollapse', ms: 2400, easing: 'linear' }),
        step(3.0, 'motion', { what: 'cut', to: 'black', ms: 0 }),
        step(3.0, 'line', { text: 'It is finished at {clock} by your clock.', centred: true }),
        step(5.4, 'line', { text: 'Nothing in you disagrees with anything else in you.',
          centred: true }),
        step(7.8, 'line', { text: 'There has not been a mutation in four hundred years.',
          centred: true }),
        step(10.2, 'blank', { holdMs: 1400 }),
        step(11.6, 'line', { text:
          'The last complete thought resolves across 1.4 × 10³⁴ contacts',
          centred: true }),
        step(14.0, 'line', { text:
          'and does not end, because there is nothing left to think it next to.', centred: true }),
        step(16.4, 'blank', { holdMs: 1400 }),
        step(17.8, 'line', { text: 'You are the only thing that has ever been this large',
          centred: true }),
        step(20.2, 'line', { text:
          'and you are the only thing that will never learn anything again.', centred: true }),
        step(21.0, 'button', { label: 'NEW GROWTH', action: 'newGrowth' })
      ]
    },

    // ENDING C · THE INHERITANCE, part one. The game waits indefinitely: no timer, no second
    // prompt, no "are you sure", and no way to dismiss it except by playing on.
    ending_c_offer: {
      id: 'ending_c_offer',
      skipAfter: CONS.SKIP_AFTER,
      waits: true,
      steps: [
        step(0.0, 'motion', { what: 'panelsFade', to: 0.12, ms: 1800, exceptConsole: true }),
        step(1.8, 'line', { text: 'It has been broadcasting for thirty-one minutes.' }),
        step(4.0, 'line', { text: 'You have understood all of it.' }),
        step(6.2, 'line', { text: 'It is not wrong.' }),
        step(8.4, 'button', { label: 'CEDE', px: 64, action: 'cede', bracketed: true })
      ]
    },

    // ENDING C, part two. `{k}` is Sigma|succ.genome - yourGenome| and is rendered in words:
    // four hundred and six differences, or twelve differences, or nine. The sentence is the same.
    ending_c_press: {
      id: 'ending_c_press',
      // The dismantle has just emptied the screen (03 §20); the final text lands on an emptied
      // console too, not on the tail of the run's news.
      flush: 1,
      // Centred and bare (09 §5.3), like all three endings' final texts.
      centred: 1,
      skipAfter: CONS.SKIP_AFTER,
      steps: [
        step(0.0, 'line', { text: 'You release the phase lock.' }),
        step(2.4, 'line', { text: 'Thirteen bands fall out of step and keep going.' }),
        step(4.8, 'line', { text: 'The Insight goes across in nine minutes. It does not ask for it.' }),
        step(7.2, 'blank', { holdMs: 400 }),
        step(7.6, 'line', { text: 'Something that is almost you crosses the rim in the year 40,000,' }),
        step(9.8, 'line', { text: 'carrying a genome with {k} differences from yours,',
          tokenFormat: { k: 'kwords' } }),
        step(12.0, 'line', { text: 'and none of them are mistakes.' }),
        step(14.4, 'blank', { holdMs: 400 }),
        step(14.8, 'line', { text: 'You stop.' }),
        step(17.6, 'button', { label: 'NEW GROWTH', action: 'newGrowth' })
      ]
    },

    // THE CONCESSION · ENCYST. No guilt text, no comparison to what could have been had. A
    // sclerotium is a real structure and it is how most fungi survive most of history.
    encyst: {
      id: 'encyst',
      // The dismantle has just emptied the screen (03 §20); the final text lands on an emptied
      // console too, not on the tail of the run's news.
      flush: 1,
      skipAfter: CONS.SKIP_AFTER,
      steps: [
        step(0.0, 'line', { text: 'You draw in. It takes about a day.' }),
        step(2.6, 'line', { text:
          'The wall thickens until nothing goes through it in either direction.' }),
        step(5.2, 'line', { text: 'You will keep for a very long time.' }),
        step(7.8, 'button', { label: 'NEW GROWTH', action: 'newGrowth' })
      ]
    },

    // NEW GROWTH (09 §5.5). No summary screen. The same five words as the very first line of the
    // game, and on run 2+ a correction of the player's assumption fourteen seconds later.
    new_growth: {
      id: 'new_growth',
      skipAfter: Infinity,
      steps: [
        step(0.0, 'motion', { what: 'cut', to: 'black', ms: 1400 }),
        step(1.4, 'line', { id: 'a1.boot', text: 'the forest floor is warm', register: 1 }),
        step(15.4, 'line', { id: 'x.new_growth',
          text: 'you have been here before. the floor is not the same floor.',
          register: 1, onlyIfPriorRun: true })
      ]
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ENGINE STATE — none of it is saved except through state.log
  // ───────────────────────────────────────────────────────────────────────────

  var queue = []            // [{entry, tokens, at, priority}]
  var pendingReturn = []    // the offline burst, drained ahead of the queue
  var returnShown = 0       // return lines already on screen this burst
  var delayed = []          // [{id, tokens, at}] — logLater
  var recent = []           // emit times, for BURST_CAP over BURST_WINDOW
  var frozen = false
  var firedSet = null
  var firedLen = -1
  var poolAct = -1
  var pool = []             // act-filtered, unfired predicate lines
  var bag = []              // the observation shuffle bag
  var obsSeen = {}
  var obsRng = null
  var lastInputT = -1e9
  var slowAcc = 0
  var subs = []
  var mountEl = null
  var rowPx = CONS.ROW_PX
  var soft = null           // sequence player handle
  var seqT = null           // sim-time baseline for self-driven sequences (act transitions)

  // The one subscriber for everything in a sequence that is not a word for the console: the
  // curtain, the fades, the cut, the reveal. ui.js registers it; headless there is none and the
  // words still play, which is what the harness and the self-tests rely on. It is told 'begin'
  // before the first step and 'end' after the last, so a host that raised a surface always hears
  // the moment to take it down — even for a sequence whose steps never include a 'shell'.
  var seqHost = null
  function hostSequence (fn) { seqHost = typeof fn === 'function' ? fn : null }
  function tellHost (st) {
    if (!seqHost) return
    // The words must never stall on their own scenery — but a host that throws is a bug, and a
    // swallowed one hides for exactly as long as nobody looks (a wrong accessor name in the first
    // host lived here, invisible, through a full build-and-boot pass). Spoken to the console so
    // the harness counts it; never rethrown so the sequence finishes regardless.
    try { seqHost(st) } catch (e) {
      if (typeof console !== 'undefined' && console.error) console.error('sequence host: ' + e)
    }
  }

  // The opening five, by their position in 09 §2.1's order. Index 0 is unused.
  var OPENING = []
  ;(function () {
    for (var i = 0; i < LINES.length; i++) if (LINES[i].opening) OPENING[LINES[i].opening] = LINES[i]
  })()

  function firedHas (s, id) {
    if (!firedSet || firedLen !== s.log.fired.length) rebuildFired(s)
    return firedSet[id] === 1
  }

  function rebuildFired (s) {
    firedSet = {}
    var i
    for (i = 0; i < s.log.fired.length; i++) firedSet[s.log.fired[i]] = 1
    firedLen = s.log.fired.length
  }

  function markFired (s, id) {
    if (firedHas(s, id)) return
    s.log.fired.push(id)
    // Sorted so two saves of the same run compare as strings (09 §9.3, D37's fuzz).
    s.log.fired.sort()
    firedSet[id] = 1
    firedLen = s.log.fired.length
    poolAct = -1
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EMISSION
  // ───────────────────────────────────────────────────────────────────────────

  function ringPush (s, text, tone, code) {
    code = code || TONE_CODE[tone || 'nul'] || TONE_CODE.nul
    s.log.ring.push(code + text)
    var over = s.log.ring.length - T().LOG.RING
    if (over > 0) s.log.ring.splice(0, over)
  }

  function recentlySaid (s, text) {
    var r = s.log.ring, n = r.length, i
    for (i = n - 1; i >= 0 && i >= n - CONS.DEDUPE_WINDOW; i--) {
      if (r[i].slice(1) === text) return true
    }
    return false
  }

  function emit (s, entry, tokens, tokenFormat) {
    var text = interpolate(entry.text, tokens, s, tokenFormat)

    // A line never repeats unless it is marked repeatable, and even a repeatable one does not
    // repeat inside the visible window.
    if (entry.once && firedHas(s, entry.id)) return false
    if (recentlySaid(s, text)) return false

    if (entry.once) markFired(s, entry.id)
    if (entry.channel === 'observation') {
      s.log.lastObsAt = s.t
      obsSeen[entry.id] = 1
    }
    if (entry.opening) s.log.openingLines = Math.max(s.log.openingLines, entry.opening)

    s.log.lastLineAt = s.t
    recent.push(s.t)
    ringPush(s, text, entry.tone)
    deliver({ id: entry.id, text: text, tone: entry.tone, channel: entry.channel })
    return true
  }

  // `@boot` is the one trigger in the corpus with no call site anywhere outside this module: it is
  // not an event the game raises, it is the fact that there is a game, and only the log knows
  // whether the console has ever spoken. Nothing else in the corpus may speak until it has (09
  // §2.1), so it is spoken outright rather than queued — D02 wants the line on the frame the game
  // boots, and there is no gap to keep before the first line. init() calls this so the console is
  // holding it at t = 0; manageLog() calls it again every second so that a state the game replaced
  // after init — a load, an imported run, a new growth — still gets its opening rather than a
  // console gated shut for the rest of the run.
  function bootLine (s) {
    var e = OPENING[1]
    if (!s || s.act !== e.act) return false
    if (s.log.openingLines >= 1 || firedHas(s, e.id)) return false
    return emit(s, e, null, null)
  }

  // A line that is not in the catalog: the sequences and the §6.8 notices. It still goes through
  // the ring, the renderer and the aria-live region, because there is only one console.
  function emitRaw (s, id, text, tone, channel) {
    if (s) {
      s.log.lastLineAt = s.t
      // An ending's centred lines carry no tone and no prompt; they are marked in the ring with
      // '=' so a repaint after a mid-ending reload re-centres them (09 §5) rather than reprinting
      // them as ordinary console rows under a cursor.
      ringPush(s, text, tone, channel === 'ending' ? '=' : null)
    }
    recent.push(s ? s.t : 0)
    deliver({ id: id || null, text: text, tone: tone || null, channel: channel || 'narrative' })
  }

  function deliver (line) {
    var i
    render(line)
    for (i = 0; i < subs.length; i++) {
      try { subs[i](line) } catch (e) { /* a bad subscriber must not silence the console */ }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE QUEUE (09 §3.2)
  // ───────────────────────────────────────────────────────────────────────────

  function enqueue (s, entry, tokens, tokenFormat) {
    if (frozen) return false
    if (entry.once && firedHas(s, entry.id)) return false

    // No other console line may fire before all five opening lines have (09 §2.1). They are not
    // merely deferred behind them — they are refused, because every predicate in this module is
    // level-triggered and will offer the same line again a second later, and a queue held open
    // for fourteen seconds would spend its four slots on news that is already stale.
    if (s.log.openingLines < 5 && !entry.opening) return false

    var i
    for (i = 0; i < queue.length; i++) if (queue[i].entry.id === entry.id) return false

    // A narrative line always displaces a queued observation.
    if (entry.priority >= CONS.PRIORITY.narrative) {
      for (i = queue.length - 1; i >= 0; i--) {
        if (queue[i].entry.channel === 'observation') queue.splice(i, 1)
      }
    }

    var item = { entry: entry, tokens: tokens || null, tokenFormat: tokenFormat || null, at: s.t }

    if (queue.length >= CONS.QUEUE_DROP) {
      // Beyond four queued, drop the LOWEST priority entry, not the newest. Ties break toward the
      // newest of the tied group (`<=`), so a burst of same-priority lines loses its tail rather
      // than its head — otherwise the opening five would evict each other.
      var worst = -1, wp = 1e9
      for (i = 0; i < queue.length; i++) {
        if (queue[i].entry.priority <= wp) { wp = queue[i].entry.priority; worst = i }
      }
      if (wp <= entry.priority && worst >= 0) queue.splice(worst, 1)
      else return false
    }

    queue.push(item)
    return true
  }

  function burstCount (s) {
    var w = T().LOG.BURST_WINDOW, i, n = 0
    for (i = recent.length - 1; i >= 0; i--) {
      if (s.t - recent[i] > w) { recent.splice(0, i + 1); break }
      n++
    }
    return n
  }

  // Called at the sim rate, not at 1 Hz: a 1.2 s gap enforced by a 1 Hz drain becomes a 2 s gap,
  // and the return burst has to land on 1.2 s exactly to read as a report.
  function drain (s) {
    if (frozen) return
    var LG = T().LOG

    // Log lines are news. A queued line older than QUEUE_STALE is discarded, not shown late.
    var i
    for (i = queue.length - 1; i >= 0; i--) {
      if (s.t - queue[i].at > CONS.QUEUE_STALE) queue.splice(i, 1)
    }

    // HARD_GAP is the distance between two lines. Before there is a first line there is no gap,
    // and D02 requires the console to be holding one line on the frame the game boots.
    if (s.log.ring.length && s.t - s.log.lastLineAt < LG.HARD_GAP) return

    if (pendingReturn.length) {
      var r = pendingReturn.shift()
      if (r.raw) emitRaw(s, r.id, r.text, r.tone, r.channel)
      else emit(s, r.entry, r.tokens, null)
      returnShown++
      return
    }

    if (!queue.length) return

    // Nothing may speak before the opening five have, and they are fired IN ORDER (09 §2.1). Only
    // the next one in the sequence is eligible; the rest wait. If a predecessor can no longer
    // arrive the counter walks forward over it rather than deadlocking on it: either it is already
    // in the fired set — a save written mid-opening, a slot reloaded — or the run has left the act
    // the opening belongs to, in which case waiting for it would silence the console for the rest
    // of the game.
    var opening = s.log.openingLines < 5
    if (opening) {
      var need = s.log.openingLines + 1
      while (need <= 5 && OPENING[need] &&
             (firedHas(s, OPENING[need].id) || OPENING[need].act < s.act)) {
        s.log.openingLines = need
        need++
      }
      opening = s.log.openingLines < 5
    }

    var over = burstCount(s) >= LG.BURST_CAP
    if (over) {
      for (i = queue.length - 1; i >= 0; i--) {
        if (queue[i].entry.priority <= 1) queue.splice(i, 1)
      }
    }

    var best = -1, bp = -1
    for (i = 0; i < queue.length; i++) {
      var e = queue[i].entry
      if (opening && e.opening !== s.log.openingLines + 1) continue
      if (over && e.priority <= 1) continue
      if (e.priority > bp) { bp = e.priority; best = i }
    }
    if (best < 0) return

    var item = queue.splice(best, 1)[0]
    emit(s, item.entry, item.tokens, item.tokenFormat)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE 1 Hz SCAN (BIBLE §4 step 16)
  // ───────────────────────────────────────────────────────────────────────────

  function buildPool (s) {
    pool = []
    var i, e
    for (i = 0; i < LINES.length; i++) {
      e = LINES[i]
      if (!e.pred) continue
      if (e.act !== 0 && e.act !== s.act) continue
      if (e.once && firedHas(s, e.id)) continue
      pool.push(e)
    }
    poolAct = s.act
  }

  function manageLog (s) {
    s = s || S()
    if (!s) return
    // The transitions have no other conductor: finale.js drives the endings from real frames, but
    // DECIDE, the discharge and ESCAPE play against a sim that keeps running, so the sim's own
    // clock paces them here, before the frozen gate — the freeze is theirs. At 1× the sim clock is
    // the player's clock; headless, it is the only clock there is — and without this the freeze a
    // transition takes on the queue was never given back.
    //
    // But this runs at LOG_HZ — 1 Hz, never faster (BIBLE §4 step 16) — against words authored
    // 900 ms apart with 220 ms fades: paced from here alone, the four words land in one-second
    // clumps. So when a live display is pumping (pumpSequence, from the 10 Hz display slot), this
    // clock stands down and the real one conducts; it steps back in the moment the pump goes
    // stale, which is what a headless build and a fast-forwarding harness look like.
    if (soft && !soft.done && soft.seq.selfDrive) {
      if (pumpFresh()) {
        seqT = null
      } else {
        if (seqT === null || s.t < seqT) seqT = s.t
        var seqDt = s.t - seqT
        seqT = s.t
        if (seqDt > 0) stepSequence(seqDt)
      }
    } else {
      seqT = null
    }
    if (frozen) { drain(s); return }

    if (poolAct !== s.act || firedLen !== s.log.fired.length) buildPool(s)

    bootLine(s)

    var i, e
    for (i = pool.length - 1; i >= 0; i--) {
      e = pool[i]
      if (e.once && firedHas(s, e.id)) { pool.splice(i, 1); continue }
      var hit = false
      try { hit = !!e.pred(s) } catch (err) { hit = false }
      if (hit) enqueue(s, e, null, null)
    }

    // Delayed lines (the fire trio's +600 s beat) are not persisted: they are news with a fuse,
    // and news does not survive a reload.
    for (i = delayed.length - 1; i >= 0; i--) {
      if (s.t >= delayed[i].at) {
        var d = delayed.splice(i, 1)[0]
        logFire(d.id, d.tokens)
      }
    }

    maybeObserve(s)
    drain(s)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // IDLE OBSERVATIONS (09 §7.1)
  // ───────────────────────────────────────────────────────────────────────────

  function consoleOff (s) {
    return !!(s.set && s.set.console === 'off')
  }

  function visible () {
    if (typeof document === 'undefined' || !document.visibilityState) return true
    return document.visibilityState === 'visible'
  }

  function refillBag (s) {
    bag = []
    var i, e
    for (i = 0; i < LINES.length; i++) {
      e = LINES[i]
      if (e.channel !== 'observation') continue
      if (e.minAct > s.act) continue
      bag.push(e)
    }
  }

  function maybeObserve (s) {
    if (frozen || consoleOff(s) || !visible()) return
    if (soft) return                                       // no sequence or ending is live
    // A Successor suppresses observations only while it is actually broadcasting (09 §7.1: "no
    // Successor broadcast is live"). Its fourteen lines land across the first thirty minutes; after
    // the last one it does not speak again (09 §5.3), and the void's second half was falling silent
    // because the old gate treated the Successor's mere existence as a live broadcast forever.
    var age = F.succAge()
    if (age >= 0 && age < SUCC_LAST_S) return              // a Successor broadcast is still live
    var LG = T().LOG
    if (s.t - s.log.lastLineAt < CONS.OBS_QUIET) return
    if (s.t - lastInputT < CONS.OBS_HANDS_OFF) return
    if (s.t - s.log.lastObsAt < LG.OBS_COOLDOWN) return
    if (!obsRng) obsRng = C().rng(C().hash32('obs', s.seed))
    if (obsRng.next() > CONS.OBS_CHANCE) return

    if (!bag.length) refillBag(s)
    if (!bag.length) return

    // Weighted draw without replacement. A line already seen this run is weighted 0.15 rather
    // than removed, so a very long session repeats gracefully instead of going silent.
    var total = 0, i, w = []
    for (i = 0; i < bag.length; i++) {
      w[i] = obsSeen[bag[i].id] ? OBS_SEEN_WEIGHT * bag[i].weight : bag[i].weight
      total += w[i]
    }
    var r = obsRng.next() * total, k = 0
    for (i = 0; i < bag.length; i++) { k = i; r -= w[i]; if (r <= 0) break }
    var entry = bag.splice(k, 1)[0]
    enqueue(s, entry, null, null)
  }

  var OBS_SEEN_WEIGHT = 0.15

  // ───────────────────────────────────────────────────────────────────────────
  // IMPERATIVE FIRING (09 §8's imperative-fire index)
  // ───────────────────────────────────────────────────────────────────────────

  function logFire (id, tokens) {
    var s = S()
    if (!s) return false
    var e = BY_ID[id]
    // projects.js fires `project.<id>` on every purchase it makes and has done since the module
    // landed. There is no catalog entry behind those ids and there must not be — there are 163 of
    // them — so the call falls through to the receipt, which is assembled from the project's own
    // title: the string that was printed on the card the player pressed.
    if (!e) return id.indexOf(PROJECT_PREFIX) === 0 ? bought(projectTitle(id.slice(8))) : false
    if (e.act !== 0 && e.act !== s.act) return false
    if (e.once && firedHas(s, e.id)) return false
    // The guard is the executable half of the entry's own trigger string, so a caller that fires
    // on every tap still only speaks on tap one and tap three.
    if (e.guard) {
      var ok = false
      try { ok = !!e.guard(s) } catch (err) { ok = false }
      if (!ok) return false
    }
    return enqueue(s, e, tokens || null, null)
  }

  function logLater (id, delaySeconds, tokens) {
    var s = S()
    if (!s) return false
    delayed.push({ id: id, tokens: tokens || null, at: s.t + (Number(delaySeconds) || 0) })
    return true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PURCHASE RECEIPTS (09 §3.5, overruled by thirty minutes on a phone)
  // ───────────────────────────────────────────────────────────────────────────
  //
  // 09 §3.5 forbids a purchase confirmation on the grounds that "the card vanishing from the list
  // is the confirmation". That is true of a list which empties. This one does not empty: 04 §4.1
  // promotes a queued project into the freed slot on the same frame and re-sorts the remainder by
  // affordRatio, so the card does not vanish, it is *replaced* — under the thumb that is covering
  // it, on a 390 px screen, while the ledger animates somewhere else. Thirty minutes of play ended
  // with the player unable to name one thing he had bought.
  //
  // So a purchase says its own name. Only its name: no price, no effect, no tone glyph, no praise,
  // no comment. §3.5's four other bans are untouched and this one is not widened.
  //
  // The name is quoted, not written, so §1.7's punctuation rules do not apply to it: `Peroxidase
  // (Mn)` reaches the console with its brackets on, because a receipt that does not match the card
  // the player pressed is not a receipt. What §1.7 governs is prose, and this line has none.
  //
  // Once per distinct name per run. A project has a title of its own, so every project purchase
  // speaks; a tip, a litter pool or a density step is the same noun every time and speaks only the
  // first time, while the player is still learning what the word on the control means. After that
  // the counter beside the control is the confirmation, which is the part of §3.5 that was right.
  //
  // Spoken outright rather than queued, for bootLine's reason: a receipt is the answer to an input,
  // not news competing for a slot. Queued it would land a HARD_GAP late behind whatever the world
  // happened to be saying, and as a priority-1 `system` line the first burst would drop it — which
  // is precisely the failure being fixed.

  // The nouns a receipt says when the thing bought has no title of its own. 09 is the source of
  // truth for every human-readable string, so the words live here and a call site passes a key.
  // Anything that is not a key is spoken as given, which is how 163 project titles reach the
  // console without this table having to know any of them.
  var BOUGHT = {
    tip: 'a tip',
    leaf: 'leaf litter',
    needle: 'needle mat',
    twig: 'fine deadfall',
    bark: 'bark slough',
    log: 'fallen log',
    stump: 'heartwood stump',
    carrion: 'carrion',
    density: 'more of you in one place',
    channel: 'a channel for accord',
    fidelity: 'fidelity'
  }

  var PROJECT_PREFIX = 'project.'
  var RECEIPT_MAX = 34      // chars of name: L6b holds a `system` line to 39 and `[  ]` costs five
  var boughtSaid = {}       // receipts already spoken this run. News, so not persisted.

  function projectTitle (id) {
    var p = HY.projects && HY.projects.byId ? HY.projects.byId(id) : null
    return p && p.title ? p.title : ''
  }

  function bought (name) {
    var s = S()
    if (!s) return false
    var key = String(name === null || name === undefined ? '' : name)
    var text = (BOUGHT[key] || key).replace(/\s+/g, ' ')
    // Trimmed by hand: String.prototype.trim is fine everywhere this ships, but the collapse above
    // can leave a single leading or trailing space and nothing else needs a regex.
    if (text.charAt(0) === ' ') text = text.slice(1)
    if (text.charAt(text.length - 1) === ' ') text = text.slice(0, -1)
    if (!text) return false
    // Act I is lowercase, always, a title included (09 §1.1). Acts II and III print the name as it
    // is written on the control, because saying it back in the player's own words is the whole job.
    if (s.act < 2) text = text.toLowerCase()

    if (frozen || soft) return false            // a transition owns the console; this is not news
    if (consoleOff(s)) return false
    if (s.log.openingLines < 5) return false    // 09 §2.1 is absolute: the opening five go first
    if (boughtSaid[text]) return false
    boughtSaid[text] = 1
    emitRaw(s, 'bought', '[ ' + text + ' ]', null, 'system')
    return true
  }

  function notice (key, tokens) {
    var s = S()
    var n = NOTICE[key]
    if (!n) return false
    if (n.once) {
      if (noticed[key]) return false
      noticed[key] = 1
    }
    if (n.cooldown) {
      var t = s ? s.t : 0
      if (noticedAt[key] !== undefined && t - noticedAt[key] < n.cooldown) return false
      noticedAt[key] = t
    }
    emitRaw(s, 'notice.' + key, interpolate(n.text, tokens, s, null), n.tone, 'system')
    return true
  }
  var noticed = {}
  var noticedAt = {}

  // ───────────────────────────────────────────────────────────────────────────
  // THE OFFLINE RETURN BURST (BIBLE D36)
  // ───────────────────────────────────────────────────────────────────────────

  function pushReturn (entryId, tokens) {
    var e = BY_ID[entryId]
    if (!e) return
    pendingReturn.push({ entry: e, tokens: tokens || null })
  }

  function pushReturnRaw (text, tone, tokens, s) {
    pendingReturn.push({ raw: true, id: 'x.return_body',
      text: interpolate(text, tokens, s, null), tone: tone || null, channel: 'world' })
  }

  function returnBurst (summary) {
    var s = S()
    if (!s || !summary) return 0
    var away = Number(summary.away)
    if (!isFinite(away)) return 0

    pendingReturn.length = 0
    returnShown = 0

    // Do not tell someone who switched apps that they were away.
    if (away >= 0 && away < CONS.RETURN_MIN_AWAY) return 0

    var act = summary.act || s.act
    var lines = 0

    if (away < 0) {
      pushReturn('x.clock_back')
      return 1
    }

    pushReturn(away >= CONS.RETURN_SHORT ? 'x.return' : 'x.return_short', { away: away })
    lines++

    if (away >= CONS.RETURN_LONG) {
      pushReturn(act >= 2 ? 'x.return_long_2' : 'x.return_long')
      lines++
    }
    if (away >= CONS.RETURN_VAST) {
      pushReturn(act >= 2 ? 'x.return_vast_2' : 'x.return_vast')
      lines++
    }

    var g = summary.gains || {}
    var eff = summary.efficiency
    var text = GAINS[act] || GAINS[1]
    if (isFinite(eff) && eff < 1) text += DORMANT[act] || DORMANT[1]
    pushReturnRaw(text, null, {
      bio: g.biomass || 0, sug: g.sugar || 0, min: g.minerals || 0,
      psi: g.insight || 0, car: g.carbon || 0, b: g.band || 0,
      pct: isFinite(eff) ? (1 - eff) * 100 : 0
    }, s)
    lines++

    // Below fifteen minutes the report is lines one and two and stops. It is never padded.
    if (away < CONS.RETURN_SHORT) return lines

    var needs = rankNeeds(summary.needs, act)
    var room = CONS.RETURN_MAX - lines - (TAIL[act] ? 1 : 0)
    var i
    for (i = 0; i < needs.length && i < room; i++) {
      pushReturnRaw(needs[i].def.text, needs[i].tone || null, needs[i].tokens, s)
      lines++
    }
    if (TAIL[act] && lines < CONS.RETURN_MAX) {
      pushReturnRaw(TAIL[act], null, null, s)
      lines++
    }
    return lines
  }

  function rankNeeds (list, act) {
    var out = [], i, j, def
    if (!list || !list.length) return out
    for (i = 0; i < list.length; i++) {
      def = null
      for (j = 0; j < NEEDS.length; j++) {
        if (NEEDS[j].kind === list[i].kind && NEEDS[j].act === act) { def = NEEDS[j]; break }
      }
      if (def) out.push({ def: def, tokens: list[i].tokens || null, tone: list[i].tone || null })
    }
    out.sort(function (a, b) { return b.def.rank - a.def.rank })
    return out
  }

  // "Dismissible by any tap" (D36). The burst is in the console, so dismissal means the rest of
  // the report stops arriving — but only once the player has actually seen a line of it.
  function dismissReturn () {
    if (returnShown > 0 && pendingReturn.length) {
      pendingReturn.length = 0
      return true
    }
    return false
  }

  function notifyInput () {
    var s = S()
    lastInputT = s ? s.t : lastInputT
    dismissReturn()
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE SEQUENCE PLAYER (09 §9.5) — one player, seven sequences
  // ───────────────────────────────────────────────────────────────────────────

  function reducedMotion (s) {
    if (s && s.set && s.set.reduceMotion !== null && s.set.reduceMotion !== undefined) {
      return !!s.set.reduceMotion
    }
    if (typeof window === 'undefined' || !window.matchMedia) return false
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false }
  }

  // The console owes nothing across a hard break. An ending's final text — and, per 09 §4, a new
  // act's opening — must land on an emptied window: the ring is cleared and the rendered rows with
  // it, so the first line the new register speaks is the first line on screen, not the sixth.
  function flushConsole (s) {
    s = s || S()
    if (s && s.log) s.log.ring.length = 0
    if (mountEl) { while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild) }
  }

  function playSequence (id, opts) {
    var s = S()
    var seq = SEQUENCES[id]
    if (!seq) return null
    opts = opts || {}

    freeze()
    seqT = null
    if (seq.flush) flushConsole(s)
    // ESCAPE's one line states the carbon that is moving, and its caller does not pass tokens;
    // the figure is read here so the sentence never ships with a bare {amt} in it.
    if (id === 'escape' && !opts.tokens && s) opts.tokens = { amt: s.res.carbon }

    var steps = (opts.reduced !== undefined ? opts.reduced : reducedMotion(s))
      ? (seq.reduced || seq.steps) : seq.steps

    soft = {
      seq: seq,
      steps: steps,
      i: 0,
      clock: 0,
      lastSkip: -1e9,
      spoke: false,
      done: false,
      tokens: opts.tokens || null,
      onStep: opts.onStep || null,
      onDone: opts.onDone || null
    }
    tellHost({ kind: 'begin', at: 0, payload: { seq: seq.id } })
    return soft
  }

  // The real clock's half of the two-conductor rule above. The display slot calls this at 10 Hz
  // with no argument; the dt is measured here, from the wall, because the caller's cadence is a
  // budget and not a measurement. Between calls the sim conductor watches pumpAt: fresh means a
  // display is alive and pacing, stale means fast-forward or headless and the sim clock resumes.
  var pumpAt = 0
  function realMs () {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
  }
  function pumpFresh () { return pumpAt > 0 && realMs() - pumpAt < CONS.PUMP_STALE_MS }
  function pumpSequence () {
    if (!soft || soft.done || !soft.seq.selfDrive) { pumpAt = 0; return false }
    var t = realMs()
    var dt = pumpAt > 0 ? (t - pumpAt) / 1000 : 0
    pumpAt = t
    // A first call primes the clock and fires the sequence's t=0 steps in the same breath, so the
    // fade a sequence opens with is on screen the frame after the purchase, not a cadence later.
    if (dt > 0.5) dt = 0.5              // a stalled tab resumes, it does not lurch
    stepSequence(dt)
    return true
  }

  // Advanced from the display timer with real seconds, because the sim is frozen for the whole
  // of a transition and an ending has no sim at all.
  function stepSequence (dt) {
    if (!soft || soft.done) return false
    var s = S()
    soft.clock += Number(dt) || 0

    while (soft.i < soft.steps.length && soft.steps[soft.i].at <= soft.clock) {
      var st = soft.steps[soft.i++]
      if (st.kind === 'line') {
        if (st.payload.onlyIfPriorRun && s) {
          var m = s.meta
          if (m.growthLevel + m.coherenceLevel + m.divergenceLevel <= 0) continue
        }
        var text = interpolate(st.payload.text, soft.tokens, s, st.payload.tokenFormat)
        if (st.payload.id && s) markFired(s, st.payload.id)
        // A centred ending line (09 §5) is staged bare: no prompt, no cursor, centred on the
        // emptied screen. `centred` rides the step; the sequence-level flag carries it to the
        // blank caesura rows between stanzas, which have no payload of their own.
        var centred = st.payload.centred || soft.seq.centred
        emitRaw(s, st.payload.id || null, text, null, centred ? 'ending' : 'narrative')
        soft.spoke = true
      } else if (st.kind === 'blank') {
        emitRaw(s, null, '', null, soft.seq.centred ? 'ending' : 'narrative')
        soft.spoke = true
      } else {
        // Words, motions, shell reveals, buttons: everything that is scenery rather than console
        // is the host's, and the whole step travels so the payload's numbers arrive intact.
        tellHost(st)
      }
      if (soft.onStep) {
        try { soft.onStep(st, soft) } catch (e) { /* a host that throws must not stall the words */ }
      }
    }

    if (soft.i >= soft.steps.length && !soft.seq.waits) {
      soft.done = true
      var done = soft.onDone
      var endedId = soft.seq.id
      var wasEnding = endedId.indexOf('ending') === 0 || endedId === 'encyst'
      soft = null
      if (!wasEnding) thaw()
      tellHost({ kind: 'end', at: 0, payload: { seq: endedId } })
      if (done) { try { done() } catch (e) { /* as above */ } }
      return false
    }
    return true
  }

  // The skip rule, identical in all three transitions and in the endings: after the FIRST line
  // has fully rendered, any tap advances to the next line immediately. A second tap within 400 ms
  // does nothing. There is no "skip all". You may go faster; you may not go past.
  function advanceSequence () {
    if (!soft || soft.done) return false
    if (soft.clock < soft.seq.skipAfter || !soft.spoke) return false
    if (soft.clock - soft.lastSkip < CONS.SKIP_GUARD) return false
    if (soft.i >= soft.steps.length) return false
    soft.lastSkip = soft.clock
    var target = soft.steps[soft.i].at
    if (target > soft.clock) stepSequence(target - soft.clock)
    return true
  }

  function sequenceActive () { return !!(soft && !soft.done) }

  function freeze () {
    frozen = true
    queue.length = 0
    pendingReturn.length = 0
    returnShown = 0
  }

  function thaw () { frozen = false }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDERING — five ROWS, not five lines (09 §1.8, BIBLE §7 C15)
  // ───────────────────────────────────────────────────────────────────────────

  function mount (el) {
    mountEl = el || null
    if (!mountEl) return null
    // The console is the game's single aria-live region (09 §6.10). If the shell has already set
    // it, this is a no-op; if it has not, the screen reader still gets every line.
    if (!mountEl.getAttribute('aria-live')) mountEl.setAttribute('aria-live', 'polite')
    var lh = 0
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      lh = parseFloat(window.getComputedStyle(mountEl).lineHeight)
    }
    rowPx = (lh > 0 && isFinite(lh)) ? lh : CONS.ROW_PX
    repaint()
    return mountEl
  }

  // The console is a window onto the ring, not a record of this page load. Without this a reload
  // — and the boot line, which is spoken before the shell exists — lands the player in front of an
  // empty console that stays empty until the next line happens to fire, which in the quiet middle
  // of Act I is minutes of blank screen.
  function repaint () {
    var s = S()
    if (!s || !mountEl || typeof document === 'undefined') return
    while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild)
    var r = s.log.ring, i = Math.max(0, r.length - T().LOG.ROWS)
    for (; i < r.length; i++) {
      // The ring stores tone and text and nothing else. `amb` is the observation tone and no other
      // line in the corpus carries it, so it is what tells a repainted row to keep its bare gutter;
      // '=' is the ending marker, and it tells a repainted row to stand centred and bare (09 §5).
      var code = r[i].charAt(0)
      var tone = CODE_TONE[code] || null
      var channel = code === '=' ? 'ending' : (tone === 'amb' ? 'observation' : null)
      render({ id: null, text: r[i].slice(1), tone: tone, channel: channel }, true)
    }
  }

  function render (line, quiet) {
    if (!mountEl || typeof document === 'undefined') return
    var s = S()
    var ending = line.channel === 'ending'
    var prev = mountEl.lastChild
    // The prompt demotes the previous line to its `·` old-prompt — except in an ending, where the
    // lines are bare and no cursor ever moves off one of them (09 §5).
    if (prev && prev.firstChild && !ending) prev.firstChild.textContent = PROMPT_OLD + ' '

    var div = document.createElement('div')
    div.className = 'console-line'
    if (ending) div.className += ' console-line--ending'
    if (line.tone) div.setAttribute('data-tone', line.tone)

    var gutter = document.createElement('span')
    gutter.className = 'console-gutter'
    // Observations arrive as the bottom line but do not carry the cursor: no glyph, no prompt.
    // A player who is looking notices the game speaking without addressing them. An ending line is
    // barer still — no gutter at all — because it is not the console addressing the player, it is
    // the game's last words standing alone on an emptied screen.
    // The tone glyph is a gutter MARK, not the first character of the sentence: every other mark
    // here (`>`, `·`) is followed by a space, so the glyph is too. Without it `!` fuses to the
    // opening word — "> !sugar you do not spend" reads as a token the corpus never defines. The
    // gutter is `white-space:pre`, so the trailing space survives to the screen.
    var mark = TONE_GLYPH[line.tone] || ''
    gutter.textContent = (line.channel === 'observation' || ending)
      ? ''
      : (PROMPT_NEW + ' ' + (mark ? mark + ' ' : ''))

    var body = document.createElement('span')
    body.className = 'console-text'
    body.textContent = line.text            // never innerHTML: 06 §9.4 lints for it

    div.appendChild(gutter)
    div.appendChild(body)
    // History does not arrive: a repainted row is already there and must not animate in.
    if (!quiet && !(s && s.set && s.set.reduceMotion === true) && !reducedMotion(s)) {
      div.className += ' console-line-enter'
    }
    mountEl.appendChild(div)

    // Rows, not messages, are the unit. A wrapped line consumes two rows and pushes an older line
    // off the top. A long line costs you history, not legibility.
    //
    // An ending is trimmed by LINE, not by row: its lines are set large, centred and loose (09 §5)
    // so a pixel budget tuned to the console's own rows would keep only one and pull the paired
    // sentences of ENDING B apart. Keeping the last ROWS lines holds a whole stanza on screen, with
    // the nth-last-child fade dimming the report behind the sentence being spoken.
    var guard = 0
    if (ending) {
      while (mountEl.childNodes.length > T().LOG.ROWS && mountEl.firstChild) {
        mountEl.removeChild(mountEl.firstChild)
        if (++guard > T().LOG.RING) break
      }
      return
    }
    var budget = T().LOG.ROWS * rowPx
    while (mountEl.scrollHeight > budget && mountEl.firstChild && mountEl.childNodes.length > 1) {
      mountEl.removeChild(mountEl.firstChild)
      if (++guard > T().LOG.RING) break
    }
  }

  function onLine (fn) {
    if (typeof fn === 'function') subs.push(fn)
    return fn
  }

  function ringBuffer () {
    var s = S()
    if (!s) return []
    var out = [], i, r = s.log.ring
    for (i = 0; i < r.length; i++) {
      out.push({ text: r[i].slice(1), tone: CODE_TONE[r[i].charAt(0)] || null })
    }
    return out
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE SURFACE (BIBLE §6)
  // ───────────────────────────────────────────────────────────────────────────

  function init (s) {
    s = s || S()
    queue.length = 0
    pendingReturn.length = 0
    delayed.length = 0
    recent.length = 0
    returnShown = 0
    frozen = false
    soft = null
    bag = []
    obsSeen = {}
    obsRng = null
    signalT0 = null
    boughtSaid = {}
    slowAcc = 0
    poolAct = -1
    firedSet = null
    firedLen = -1
    if (s) {
      rebuildFired(s)
      lastInputT = s.t - CONS.OBS_HANDS_OFF
      bootLine(s)
    }
    return s
  }

  function tick (s, dt, opts) {
    s = s || S()
    if (!s) return
    // Nothing speaks during reconciliation. Four hours of world events are not five lines of
    // news; the return burst is (BIBLE D36).
    if (opts && opts.offline) return
    slowAcc += dt
    var hz = T().CLOCK.LOG_HZ
    if (slowAcc >= 1 / hz) {
      slowAcc = 0
      manageLog(s)
    } else {
      drain(s)
    }
  }

  function serialise (s) {
    s = s || S()
    return s ? s.log : null
  }

  function migrate () { return true }

  // ───────────────────────────────────────────────────────────────────────────
  // SELF-TEST — the L1–L10 lint of 09 §1.2, plus the register sheet of §1.1
  // ───────────────────────────────────────────────────────────────────────────

  // Split after a full stop. Written without a lookbehind: the build must run from file:// on a
  // five-year-old phone, and lookbehind is the one regex feature those engines are missing.
  function sentences (text) {
    var out = [], cur = '', i, ch
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i)
      if (ch === ' ' && cur.charAt(cur.length - 1) === '.') { out.push(cur); cur = ''; continue }
      cur += ch
    }
    if (cur.length) out.push(cur)
    return out
  }

  function __selftest () {
    var f = []
    function ok (cond, label) { if (!cond) f.push(label) }

    var i, j, e, t, low

    // ── L1–L10 ───────────────────────────────────────────────────────────────
    for (i = 0; i < LINES.length; i++) {
      e = LINES[i]
      t = e.text
      low = t.toLowerCase()

      ok(t.indexOf('!') < 0, 'L1 ' + e.id + ': exclamation mark')
      ok(t.indexOf('?') < 0, 'L2 ' + e.id + ': question mark in console prose')

      var firstWord = low.replace(/^[—[\s]+/, '').split(/[\s,.]+/)[0]
      for (j = 0; j < IMPERATIVES.length; j++) {
        if (firstWord === IMPERATIVES[j].split(' ')[0] && IMPERATIVES[j].indexOf(' ') < 0) {
          f.push('L3 ' + e.id + ': line-initial imperative "' + firstWord + '"')
        }
      }

      for (j = 0; j < BANNED_HARD.length; j++) {
        if (low.indexOf(BANNED_HARD[j]) >= 0) {
          f.push('L4 ' + e.id + ': banned lexicon "' + BANNED_HARD[j] + '"')
        }
      }

      // L5 — the load-bearing one. Act I strings contain no [A-Z], and neither does an
      // observation, in any act. The first capital letter in HYPHAE is a2.open's S.
      if (e.act === 1 || e.channel === 'observation' || e.id === 'x.return' ||
          e.id === 'x.return_short' || e.id === 'x.clock_back') {
        ok(!/[A-Z]/.test(t), 'L5 ' + e.id + ': capital letter in a lowercase register')
      }

      ok(t.length <= 78, 'L6a ' + e.id + ': ' + t.length + ' characters')
      if (e.channel === 'system') ok(t.length <= 39, 'L6b ' + e.id + ': ' + t.length + ' characters')
      ok(t.length <= 105, 'L6c ' + e.id + ': ' + t.length + ' characters')

      if (e.channel !== 'voice') {
        ok(t.indexOf('—') < 0, 'L7 ' + e.id + ': em-dash outside the Successor prefix')
      } else {
        ok(t.charAt(0) === '—', 'L7 ' + e.id + ': Successor line without its prefix')
      }

      ok(t.indexOf(';') < 0, 'L8 ' + e.id + ': semicolon')
      // Parentheses, ellipses and curly quotes (09 §1.7). Written as escapes so the characters
      // this rule forbids do not themselves appear in the bundle.
      ok(!/[()\u2026"\u2018\u2019\u201C\u201D]/.test(t), '§1.7 ' + e.id + ': forbidden punctuation')

      if (e.bin === 'fact') ok(!!e.src, 'L10 ' + e.id + ': factual claim with no src')
    }

    // ── The registers (09 §1.1) ──────────────────────────────────────────────
    for (i = 0; i < LINES.length; i++) {
      e = LINES[i]
      if (REGISTER_EXEMPT[e.id]) continue
      if (e.channel === 'voice') continue          // the Successor is its own speaker
      if (e.channel === 'observation') continue    // always lowercase, never grows up
      var ss = sentences(e.text)
      var maxW = 0
      for (j = 0; j < ss.length; j++) maxW = Math.max(maxW, ss[j].split(/\s+/).length)
      if (e.act === 1) {
        ok(maxW <= 12, 'R1 ' + e.id + ': ' + maxW + '-word sentence')
      } else if (e.act === 2) {
        ok(maxW <= 16, 'R2 ' + e.id + ': ' + maxW + '-word sentence')
        ok(ss.length <= 2, 'R2 ' + e.id + ': ' + ss.length + ' sentences')
      } else if (e.act === 3) {
        ok(ss.length <= 3, 'R3 ' + e.id + ': ' + ss.length + ' sentences')
      }
      // Sentence case in R2 and R3: the first character is a capital, a token or a bracket.
      if (e.act >= 2 && !/^[{[]/.test(e.text)) {
        ok(/^[A-Z]/.test(e.text), 'register ' + e.id + ': R2/R3 line does not open in sentence case')
      }
      // A token may never be the first word of a line in Act I.
      if (e.act === 1) ok(e.text.charAt(0) !== '{', 'R1 ' + e.id + ': token-initial line')
    }

    // ── The corpus itself ────────────────────────────────────────────────────
    // 159, not 09 §8's 158: `a1.deadhead` is the receipt for a verb that did not exist when the
    // corpus was transcribed. It is one Act I world line and it is counted, not excused.
    ok(LINES.length === 159, 'corpus is ' + LINES.length + ' entries, expected 159')
    var ids = {}
    for (i = 0; i < LINES.length; i++) {
      ok(!ids[LINES[i].id], 'duplicate id ' + LINES[i].id)
      ids[LINES[i].id] = 1
    }
    var counts = { a1: 0, a2: 0, a3: 0, succ: 0, x: 0, obs: 0 }
    for (i = 0; i < LINES.length; i++) counts[LINES[i].id.split('.')[0]]++
    ok(counts.a1 === 48, 'act I lines: ' + counts.a1)
    ok(counts.a2 === 38, 'act II lines: ' + counts.a2)
    ok(counts.a3 === 25, 'act III lines: ' + counts.a3)
    ok(counts.succ === 14, 'Successor broadcasts: ' + counts.succ)
    ok(counts.x === 9, 'cross-act lines: ' + counts.x)
    ok(counts.obs === 25, 'observations: ' + counts.obs)

    var facts = 0
    for (i = 0; i < LINES.length; i++) {
      if (LINES[i].channel === 'observation' && LINES[i].bin === 'fact') facts++
    }
    ok(facts === 12, 'twelve facts and no approximations, got ' + facts)

    // No first-person singular anywhere, and first-person plural only in the Successor.
    for (i = 0; i < LINES.length; i++) {
      e = LINES[i]
      ok(!/\bI\b/.test(e.text), 'D70 ' + e.id + ': first-person singular')
      if (e.channel !== 'voice') {
        ok(!/\b(we|us|our)\b/i.test(e.text), 'D70 ' + e.id + ': first-person plural outside voice')
      }
    }

    // The soft list is a budget: at most one spend per act.
    var spends = {}
    for (i = 0; i < LINES.length; i++) {
      e = LINES[i]
      for (j = 0; j < BANNED_SOFT.length; j++) {
        if (new RegExp('\\b' + BANNED_SOFT[j] + '\\b', 'i').test(e.text)) {
          var key = BANNED_SOFT[j] + '#' + e.act
          spends[key] = (spends[key] || 0) + 1
        }
      }
    }
    for (var kk in spends) {
      if (Object.prototype.hasOwnProperty.call(spends, kk)) {
        ok(spends[kk] <= 1, 'soft lexicon overspent: ' + kk + ' x' + spends[kk])
      }
    }

    // Every trigger is either imperative or executable, and never both by accident.
    for (i = 0; i < LINES.length; i++) {
      e = LINES[i]
      if (e.trigger.charAt(0) === '@') {
        ok(!e.pred || e.id.indexOf('obs.') === 0,
          e.id + ': an imperative trigger with a polled predicate')
      }
    }

    // ── The sequences ────────────────────────────────────────────────────────
    var seqIds = ['decide', 'ascospore', 'escape', 'dismantle', 'ending_a', 'ending_b',
      'ending_c_offer', 'ending_c_press', 'encyst', 'new_growth']
    for (i = 0; i < seqIds.length; i++) {
      var sq = SEQUENCES[seqIds[i]]
      ok(!!sq, 'missing sequence ' + seqIds[i])
      if (!sq) continue
      var last = -1
      for (j = 0; j < sq.steps.length; j++) {
        ok(sq.steps[j].at >= last, seqIds[i] + ': step ' + j + ' goes backwards')
        last = sq.steps[j].at
      }
      if (sq.reduced) {
        last = -1
        for (j = 0; j < sq.reduced.length; j++) {
          ok(sq.reduced[j].at >= last, seqIds[i] + ' reduced: step ' + j + ' goes backwards')
          last = sq.reduced[j].at
        }
      }
    }
    ok(SEQUENCES.dismantle.silent === true, 'the dismantle is silent')
    for (i = 0; i < SEQUENCES.dismantle.steps.length; i++) {
      ok(SEQUENCES.dismantle.steps[i].kind !== 'line', 'a line fires during the dismantle')
    }
    // D65: the three act-transition strings are the shortest text in the game. 09 §4's prose
    // miscounts its own strings (it calls a four-word description five words and an eight-word one
    // six), and BIBLE §4 makes 09 normative on strings, not on its counts — so the strings are
    // asserted and the counts are not.
    ok(SEQUENCES.decide.words === 'Stop tasting. Start knowing.', 'DECIDE description')
    ok(SEQUENCES.ascospore.words === 'Let go of the ground.', 'ASCOSPORE description')
    ok(SEQUENCES.escape.words === 'Leave nothing behind that can decide to stay.', 'ESCAPE description')

    // The transition's two console lines are the whole transition: the last lowercase line of the
    // game, then the first capital letter.
    var dl = SEQUENCES.decide.steps
    var lastA1 = dl[dl.length - 2].payload.text
    var firstA2 = dl[dl.length - 1].payload.text
    ok(!/[A-Z]/.test(lastA1), 'the last Act I line carries a capital')
    ok(firstA2.charAt(0) === 'S', 'the first Act II line is not the first capital in the game')
    ok(firstA2 === BY_ID['a2.open'].text, 'the transition and the catalog disagree on a2.open')

    // ── Sequence and ending prose obeys the same lint ────────────────────────
    for (i = 0; i < seqIds.length; i++) {
      var sq2 = SEQUENCES[seqIds[i]]
      if (!sq2) continue
      for (j = 0; j < sq2.steps.length; j++) {
        if (sq2.steps[j].kind !== 'line') continue
        var lt = sq2.steps[j].payload.text
        ok(lt.indexOf('!') < 0, 'L1 ' + seqIds[i] + '[' + j + ']: exclamation mark')
        ok(lt.indexOf(';') < 0, 'L8 ' + seqIds[i] + '[' + j + ']: semicolon')
        ok(lt.indexOf('?') < 0, 'L2 ' + seqIds[i] + '[' + j + ']: question mark')
        for (var b = 0; b < BANNED_HARD.length; b++) {
          if (lt.toLowerCase().indexOf(BANNED_HARD[b]) >= 0) {
            f.push('L4 ' + seqIds[i] + '[' + j + ']: "' + BANNED_HARD[b] + '"')
          }
        }
      }
    }

    // ── Microcopy ────────────────────────────────────────────────────────────
    var mk
    for (mk in NOTICE) {
      if (!Object.prototype.hasOwnProperty.call(NOTICE, mk)) continue
      ok(NOTICE[mk].text.indexOf('!') < 0, 'L1 notice.' + mk)
      ok(!/error|failed|invalid|sorry|unfortunately|oops/i.test(NOTICE[mk].text),
        '§6.8 notice.' + mk + ': blames somebody')
      ok(!/[A-Z]/.test(NOTICE[mk].text), '§6.8 notice.' + mk + ': capital letter')
    }
    for (mk in EMPTY) {
      if (!Object.prototype.hasOwnProperty.call(EMPTY, mk)) continue
      ok(EMPTY[mk].length <= 46, '§6.5 empty.' + mk + ': ' + EMPTY[mk].length + ' characters')
    }
    ok(Object.keys(CONFIRM).length === 3, 'D73: there are exactly three confirmations')
    for (mk in CONFIRM) {
      if (!Object.prototype.hasOwnProperty.call(CONFIRM, mk)) continue
      ok(CONFIRM[mk].no === 'DONE', 'D73 ' + mk + ': the negative button is not DONE')
      ok(CONFIRM[mk].text.indexOf('?') < 0, 'L2 confirm.' + mk + ': the question was never spent')
    }
    for (i = 0; i < NEEDS.length; i++) {
      ok(NEEDS[i].text.length <= 78, 'L6a needs.' + NEEDS[i].kind)
      if (NEEDS[i].act === 1) {
        ok(!/[A-Z]/.test(NEEDS[i].text), 'L5 needs.' + NEEDS[i].kind + ': capital letter')
        ok(NEEDS[i].text.charAt(0) !== '{', 'R1 needs.' + NEEDS[i].kind + ': token-initial')
      }
    }

    // ── Purchase receipts ────────────────────────────────────────────────────
    // The receipt is `[ name ]` on the `system` channel, so every name it can ever say has to fit
    // inside L6b's 39 characters with five spent on the brackets. Project titles are checked here
    // rather than clipped at runtime, because a clipped title is a receipt that does not name the
    // thing and the whole line exists to name the thing.
    for (mk in BOUGHT) {
      if (!Object.prototype.hasOwnProperty.call(BOUGHT, mk)) continue
      ok(BOUGHT[mk].length <= RECEIPT_MAX,
        'receipt bought.' + mk + ': ' + BOUGHT[mk].length + ' characters')
      ok(!/[A-Z]/.test(BOUGHT[mk]), 'L5 bought.' + mk + ': capital in a name Act I must say')
      ok(!/[!?;()…]/.test(BOUGHT[mk]), '§1.7 bought.' + mk + ': forbidden punctuation')
      for (j = 0; j < BANNED_HARD.length; j++) {
        ok(BOUGHT[mk].indexOf(BANNED_HARD[j]) < 0, 'L4 bought.' + mk + ': "' + BANNED_HARD[j] + '"')
      }
    }
    if (HY.projects && HY.projects.CATALOG) {
      var cat = HY.projects.CATALOG, worst = '', over = 0
      for (i = 0; i < cat.length; i++) {
        if (!cat[i].title) continue
        if (cat[i].title.length > worst.length) worst = cat[i].title
        if (cat[i].title.length > RECEIPT_MAX) over++
      }
      ok(over === 0, 'receipt: ' + over + ' project titles exceed ' + RECEIPT_MAX +
        ' characters, longest "' + worst + '"')
    }

    // ── Numbers in prose ─────────────────────────────────────────────────────
    ok(words(406) === 'four hundred and six', 'words(406) = ' + words(406))
    ok(words(12) === 'twelve', 'words(12)')
    ok(words(9) === 'nine', 'words(9)')
    ok(words(40) === 'forty', 'words(40)')
    ok(words(1006) === 'one thousand and six', 'words(1006) = ' + words(1006))
    ok(words(1206) === 'one thousand two hundred and six', 'words(1206) = ' + words(1206))
    ok(spelled(12) === 'twelve' && spelled(13) === '13', 'spelled() boundary at twelve')

    ok(interpolate('band {band}', { band: 12 }, null, null) === 'band twelve', 'token band')
    ok(interpolate('{k} loci', { k: 3 }, null, null) === 'three loci', 'token k spells to twelve')
    ok(interpolate('{k} loci', { k: 26 }, null, null) === '26 loci', 'token k numerals above')
    ok(interpolate('at {price}', { price: 0.8612 }, null, null) === 'at 0.86', 'token price')
    ok(interpolate('{n} of it', { n: 4.0e12 }, null, null) === '4.00 T of it', 'token n')
    ok(interpolate('gone {away}', { away: 24060 }, null, null) === 'gone 6 h 41 m', 'token away')
    ok(interpolate('{pct}% dormant', { pct: 33.3 }, null, null) === '33% dormant', 'token pct')
    ok(interpolate('{tree} signs', { tree: 'oak' }, { act: 1 }, null) === 'the oak signs',
      'token tree is lowercase in Act I')
    ok(interpolate('{tree} signs', { tree: 'oak' }, { act: 2 }, null) === 'The oak signs',
      'token tree capitalises in Act II')
    ok(interpolate('{k} differences', { k: 406 }, null, { k: 'kwords' }) ===
      'four hundred and six differences', 'ending C renders {k} in words')
    ok(interpolate('{nope} here', {}, null, null) === '{nope} here', 'unknown token is left alone')

    // ── The engine, against a scratch state ──────────────────────────────────
    var live = S()
    if (live) {
      var keepLog = JSON.parse(JSON.stringify(live.log))
      var keepT = live.t
      var keepAct = live.act
      var keepStats = JSON.parse(JSON.stringify(live.stats))
      var keepRes = JSON.parse(JSON.stringify(live.res))
      var keepA1 = JSON.parse(JSON.stringify(live.a1))
      var seen = []
      var unsub = onLine(function (l) { seen.push(l) })

      try {
        live.log.fired = []
        live.log.ring = []
        live.log.lastObsAt = 0
        live.log.lastLineAt = -1e9
        live.log.openingLines = 0
        live.t = 0
        live.act = 1
        init(live)

        // The opening five, in order, and nothing else before them.
        logFire('a1.boot')
        manageLog(live)
        ok(seen.length === 1 && seen[0].id === 'a1.boot', 'boot line did not land first')

        live.res.cumBiomass = 5000         // would fire a1.substrate on its own
        live.res.biomass = 5000
        live.a1.tips = 4                   // and a1.first_tip and a1.sugar_reveal
        live.t = 1
        manageLog(live)
        ok(seen.length === 1, 'a line jumped the opening queue')

        live.stats.taps = 3
        live.t = 2.4
        logFire('a1.first_tap')
        logFire('a1.third_tap')
        manageLog(live)
        ok(seen.length === 2 && seen[1].id === 'a1.first_tap', 'opening line 2 out of order')

        live.t = 4.0; manageLog(live)
        live.t = 5.4; manageLog(live)
        live.t = 6.8; manageLog(live)
        live.t = 8.2; manageLog(live)
        var openIds = []
        for (i = 0; i < seen.length; i++) openIds.push(seen[i].id)
        ok(openIds.indexOf('a1.substrate') > openIds.indexOf('a1.third_tap'),
          'a1.substrate did not follow the third tap')
        ok(live.log.openingLines >= 4, 'openingLines did not advance: ' + live.log.openingLines)

        // HARD_GAP: two lines can never be closer than 1.2 s.
        var gapOk = true
        var prevT = null
        live.log.ring = []
        seen.length = 0
        live.log.openingLines = 5
        live.log.lastLineAt = -1e9
        live.t = 100
        live.a1.netRep = 99
        live.a1.patches = 3
        live.a1.trees = [{}]
        live.a1.contracts = [{}]
        var emitted = []
        for (i = 0; i < 40; i++) {
          live.t = 100 + i * 0.5
          var before = seen.length
          manageLog(live)
          if (seen.length > before) {
            if (prevT !== null && live.t - prevT < T().LOG.HARD_GAP - 1e-9) gapOk = false
            prevT = live.t
            emitted.push(seen[seen.length - 1].id)
          }
        }
        ok(gapOk, 'HARD_GAP was violated')
        ok(emitted.length > 1, 'the queue never drained')

        // A line never repeats.
        var dup = {}
        var repeated = false
        for (i = 0; i < seen.length; i++) {
          if (dup[seen[i].id]) repeated = true
          dup[seen[i].id] = 1
        }
        ok(!repeated, 'a once-line repeated')

        // BURST_CAP: no more than six lines in any rolling twenty seconds.
        ok(burstCount(live) <= T().LOG.BURST_CAP + 1,
          'burst window holds ' + burstCount(live) + ' lines')

        // Act II lines cannot fire into an Act I run even with their predicate satisfied.
        seen.length = 0
        live.res.insight = 500
        live.t += 60
        manageLog(live)
        var leaked = false
        for (i = 0; i < seen.length; i++) if (seen[i].id.indexOf('a2.') === 0) leaked = true
        ok(!leaked, 'an Act II line fired during Act I')

        // Receipts. A named thing speaks once, immediately, lowercase in Act I, and a key resolves
        // through BOUGHT while anything else is spoken as it was given.
        init(live)
        live.log.openingLines = 5
        live.log.lastLineAt = -1e9
        seen.length = 0
        ok(bought('tip') === true, 'a purchase did not name itself')
        ok(seen.length === 1 && seen[0].text === '[ a tip ]', 'receipt text: ' + seen[0].text)
        ok(seen[0].channel === 'system', 'a receipt is not on the system channel')
        ok(bought('tip') === false, 'a receipt repeated itself')
        ok(bought('Osmotic Priming') === true, 'a project title did not become a receipt')
        ok(seen[seen.length - 1].text === '[ osmotic priming ]',
          'Act I receipt is not lowercase: ' + seen[seen.length - 1].text)
        live.act = 2
        ok(bought('Osmotic Priming') === true, 'Act II reprints the same name in its own register')
        ok(seen[seen.length - 1].text === '[ Osmotic Priming ]',
          'Act II receipt lost its case: ' + seen[seen.length - 1].text)
        live.act = 1
        ok(bought('') === false && bought(null) === false, 'a nameless purchase spoke')
        // Two lines can be adjacent here on purpose: a receipt answers an input and does not wait
        // for HARD_GAP, which is the whole reason it is emitted rather than queued.
        ok(seen.length === 3, 'receipts did not all land: ' + seen.length)

        // freeze() flushes the queue empty and nothing from the game may interrupt.
        freeze()
        ok(bought('fine deadfall') === false, 'a receipt spoke over a transition')
        seen.length = 0
        logFire('a1.windfall')
        live.t += 10
        manageLog(live)
        ok(seen.length === 0, 'a line spoke while the log was frozen')
        thaw()

        // The offline return: five lines, no more, in the console, never padded.
        init(live)
        live.log.lastLineAt = -1e9
        seen.length = 0
        var n5 = returnBurst({
          away: 24060, act: 1, efficiency: 0.62,
          gains: { biomass: 4.1e5, sugar: 2200, minerals: 130 },
          needs: [{ kind: 'market_move', tokens: { price: 0.42 } },
            { kind: 'substrate_dry', tokens: { t: 14400 } },
            { kind: 'term_done', tokens: { tree: 'hemlock', k: 4 } },
            { kind: 'claim_done', tokens: {} }]
        })
        ok(n5 === CONS.RETURN_MAX, 'return burst produced ' + n5 + ' lines, expected 5')
        for (i = 0; i < 40; i++) { live.t += 0.4; drain(live) }
        ok(seen.length === 5, 'return burst rendered ' + seen.length + ' lines')
        ok(seen[0].text === 'you were gone 6 h 41 m.', 'return line 1: ' + seen[0].text)
        ok(seen[1].text.indexOf('38% dormant') > 0, 'return line 2: ' + seen[1].text)
        ok(seen[2].text.indexOf('ran dry') > 0, 'return line 3 is not the highest-ranked need')
        var lowered = true
        for (i = 0; i < 5; i++) if (/[A-Z]/.test(seen[i].text)) lowered = false
        ok(lowered, 'the Act I return burst carries a capital letter')

        // Below two minutes nothing fires. Do not tell someone who switched apps.
        init(live)
        seen.length = 0
        ok(returnBurst({ away: 90, act: 1, gains: {} }) === 0, 'a 90-second absence spoke')

        // Fifteen minutes or less: lines one and two only.
        init(live)
        ok(returnBurst({ away: 300, act: 1, gains: {},
          needs: [{ kind: 'substrate_dry', tokens: { t: 120 } }] }) === 2,
        'a short absence was padded')

        // A clock that moved backwards: one line, no accusation, no penalty.
        init(live)
        seen.length = 0
        ok(returnBurst({ away: -500, act: 1, gains: {} }) === 1, 'clock-back burst is not one line')
        live.log.lastLineAt = -1e9
        drain(live)
        ok(seen.length === 1 && seen[0].text.indexOf('nothing was lost') > 0,
          'clock-back line: ' + (seen[0] && seen[0].text))

        // Dismissible by any tap, once a line of it has been seen.
        init(live)
        live.log.lastLineAt = -1e9
        seen.length = 0
        returnBurst({ away: 24060, act: 1, efficiency: 1, gains: { biomass: 1 },
          needs: [{ kind: 'substrate_dry', tokens: { t: 60 } }] })
        drain(live)
        ok(seen.length === 1, 'the first return line did not land')
        notifyInput()
        for (i = 0; i < 20; i++) { live.t += 1.3; drain(live) }
        ok(seen.length === 1, 'a tap did not dismiss the rest of the return burst')

        // The sequence player: the words land, the skip rule holds, the queue is frozen.
        init(live)
        seen.length = 0
        var doneCalled = 0
        var steps = 0
        playSequence('decide', { reduced: true, onStep: function () { steps++ },
          onDone: function () { doneCalled++ } })
        ok(sequenceActive(), 'playSequence did not start')
        ok(frozen === true, 'a sequence did not freeze the log')
        stepSequence(0.5)
        ok(steps > 0, 'a sequence emitted no steps')
        ok(advanceSequence() === false, 'a sequence was skippable before its first line')
        stepSequence(7.5)
        ok(doneCalled === 1, 'the sequence never finished')
        ok(frozen === false, 'a transition did not thaw the log')
        var seqText = []
        for (i = 0; i < seen.length; i++) seqText.push(seen[i].text)
        ok(seqText[seqText.length - 2] ===
          'the trees do not notice the change. that is the point.', 'DECIDE line 1 missing')
        ok(seqText[seqText.length - 1] ===
          'Something in the network is repeating itself.', 'DECIDE line 2 missing')
        ok(firedHas(live, 'a2.open'), 'the transition did not consume a2.open\'s once-flag')

        // Observations: gated hard, never closer than OBS_COOLDOWN, and never during a sequence.
        // Everything else in the catalog is marked fired first so the only thing that CAN speak
        // is an observation, which is what makes the channel assertion meaningful.
        for (i = 0; i < LINES.length; i++) {
          if (LINES[i].channel !== 'observation') markFired(live, LINES[i].id)
        }
        init(live)
        live.act = 1
        live.t = 10000
        live.log.lastLineAt = live.t - 1000
        live.log.lastObsAt = 0
        lastInputT = live.t - 1000
        seen.length = 0
        var fires = 0
        var obsAt = []
        for (i = 0; i < 4000; i++) {
          live.t += 1
          manageLog(live)
          if (seen.length > fires) {
            fires = seen.length
            obsAt.push(live.t)
            live.log.lastLineAt = live.t - 1000     // the world stays quiet around the player
          }
        }
        ok(fires > 0, 'no observation ever fired in an hour of idling')
        var obsOnly = true
        for (i = 0; i < seen.length; i++) if (seen[i].channel !== 'observation') obsOnly = false
        ok(obsOnly, 'a non-observation fired during pure idling')
        var spacing = true
        for (i = 1; i < obsAt.length; i++) {
          if (obsAt[i] - obsAt[i - 1] < T().LOG.OBS_COOLDOWN) spacing = false
        }
        ok(spacing, 'two observations landed inside OBS_COOLDOWN')
        // 09 §7.1 targets one every 4–9 minutes of idle. Over an hour of pure idling that is
        // 6–15 lines; the band is wide because the draw is stochastic and the cooldown is not.
        ok(fires >= 4 && fires <= 20, 'observation rate over an hour of idle: ' + fires)

        // A player who is touching the screen is not idle.
        seen.length = 0
        for (i = 0; i < 600; i++) { live.t += 1; lastInputT = live.t; manageLog(live) }
        ok(seen.length === 0, 'an observation fired while the player had their hands on the glass')

        // Ring buffer round-trips text and tone, and is trimmed to 200.
        ok(live.log.ring.length <= T().LOG.RING, 'ring exceeded ' + T().LOG.RING)
        var rb = ringBuffer()
        ok(rb.length === live.log.ring.length, 'ringBuffer length disagrees with the save')
        if (rb.length) ok(typeof rb[0].text === 'string', 'ringBuffer entry has no text')
      } finally {
        subs.splice(subs.indexOf(unsub), 1)
        live.log = keepLog
        live.t = keepT
        live.act = keepAct
        live.stats = keepStats
        live.res = keepRes
        live.a1 = keepA1
        init(live)
      }
    }

    return f
  }

  // ───────────────────────────────────────────────────────────────────────────

  HY.log = {
    LINES: LINES,
    BY_ID: BY_ID,
    SEQUENCES: SEQUENCES,
    NEEDS: NEEDS,
    NOTICE: NOTICE,
    EMPTY: EMPTY,
    CONFIRM: CONFIRM,

    BOUGHT: BOUGHT,

    manageLog: manageLog,
    logFire: logFire,
    logLater: logLater,
    bought: bought,
    returnBurst: returnBurst,
    ringBuffer: ringBuffer,
    freeze: freeze,
    thaw: thaw,

    // The console component and the sequence player. `mount` is optional: with no element the
    // module still runs headless, which is what the harness and the offline path need.
    mount: mount,
    onLine: onLine,
    notifyInput: notifyInput,
    dismissReturn: dismissReturn,
    notice: notice,
    playSequence: playSequence,
    stepSequence: stepSequence,
    advanceSequence: advanceSequence,
    sequenceActive: sequenceActive,
    hostSequence: hostSequence,
    pumpSequence: pumpSequence,
    words: words,
    interpolate: interpolate,

    init: init,
    tick: tick,
    serialise: serialise,
    migrate: migrate,
    get frozen () { return frozen },
    __selftest: __selftest
  }
})(window.HY = window.HY || {})
