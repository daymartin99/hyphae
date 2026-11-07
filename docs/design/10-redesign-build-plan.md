# 10 — Redesign build plan: one body, three readings

Status: approved direction (D + T), November 2026. This doc says how we get from the shipped UI to it.
The target itself is `redesign/SPEC.md`; the clickable mocks are in `redesign/mocks/` (D_0–D_3, T_1–T_2,
also on the design canvas). Where this doc and the mocks disagree, this doc wins: the mocks were drawn
without running, and a few of their choices break the non-negotiables (06 §0.1). Those calls are made below.

## The idea in one paragraph

One living organism, the body, is drawn at all times in the same place. It grows with real progress.
Act I reads it as ink on soil (organic). Act II reads the same geometry as a graph with signal running
along it (the mind). Act III mirrors it through glass into orbits, rings and distant lights (the looking
glass). Around it, the screen skeleton, the interaction grammar, the voice and NEXT never move between
acts. The transitions are loud takeovers built out of the body itself. That is the through-line: you never
leave the organism, you just learn to read it differently.

## Decisions taken (and why)

| # | Decision | Why |
|---|---|---|
| D1 | **The body is drawn on canvas**, not SVG. It is canvas.js's own network, which already grows from the run and already outlives Act I under the map and the void. Phase 1 found that, so there is no new `body.js`: the redesign carries the existing organism and gives it the voice, the breath, the touch and the slide. | Pillar 3 (no SVG files) and pillar 5 (transform/opacity only). Canvas also morphs ink→graph→orbit on every browser; the mocks' CSS `d:` morph snaps on Safari, i.e. on most of our players. |
| D2 | **Its geometry comes from the real game**, not a fixed seed. It is seeded from the save, its length is your hyphae, and its *form* is your choices (canvas.js FORM): enzymes turn it ochre, structure thickens it into cord, feeding makes it fork and wander, the tips you own glow at its front, and in Act III melanin darkens it. | David's question is *"who or what are we growing?"* The game never answers it in words. The body answers it in shape: what is growing is the record of how you played. Because the voice's "you" is ambiguous, that record is the organism's and yours. |
| D3 | **No webfont.** The mocks' Newsreader becomes `ui-serif, "New York", Georgia, serif`. | Pillar 3 and the bundle budget. iOS `ui-serif` is New York, which is the look anyway. |
| D4 | **The primary verb stays in the bottom 200 px** (pillar 2). Tapping the body is a second route to the same verb, never the only one. | The mocks put the body at the top, which is right for seeing it and wrong for the thumb. Both, then. |
| D5 | **NEXT states facts, never advice.** "a tip costs 66 g. you have 41." Amended in 09 §1.0. | The voice must not start telling the player what to do. Facts are the "explain a bit more" David asked for. |
| D6 | **The new UI ships behind a flag** (`?ui=d`, plus a settings toggle) until each act reaches parity, then replaces the old one. | The game stays playable and shippable at every step. No big-bang merge. |
| D7 | **Saves don't change.** The redesign is presentation only. Any new state (e.g. which lens is open) is view state and isn't saved. | No migration risk, and old saves just work. |
| D9 | **The voice is the driver, the heart of the game** (David, Nov 2026). It is never squeezed below three lines; the newest line is the brightest thing on the screen after the body; a story line holds its place until it has been read (log.js STORY_HOLD) and is never pushed off by a flood. When a line lands, the body answers it with a pulse, so the voice and the organism read as one creature talking. NEXT is set smaller and plainer so it never competes with the voice. When space is short, the verbs give way first, then NEXT, and the voice never does. Its fourth-wall breaks are protected, because David finds them the most immersive thing in the game. These are the lines where the voice turns and speaks to the player rather than the organism. The redesign gives them the most room: the interface quietens around them, the body stills, and nothing else animates while one is on screen. The transitions use the same device.

**Who the voice is, as a player meets it** (David's words): *"it pulls you through the complexity... it watches and it knows. A narrator, watcher and judger. Knowing and ominous."* That character is produced by 09 §1.0's rules, not in spite of them. Nobody is speaking, it never advises, it is never surprised, and "you" is the organism, which is exactly why "you" also lands on the player and why the fourth-wall moments work. So the redesign must never explain the voice: no avatar, no name, no face, no helper tone. The explaining it does stays reportage ("nothing pays you this yet"). NEXT is kept outside the voice, plainer and smaller, precisely so the voice never becomes the game's assistant. The helpful line is NEXT's job, and the knowing one is the voice's. | The game is told, not operated. The body is what you see; the voice is why you keep going. |
| D8 | **Transitions get a calm mode**, picked automatically from `prefers-reduced-motion` and switchable in settings. They stay under 3 flashes a second (pillar 6). | Loud, but nobody gets hurt. |

## The skeleton (every act, fixed positions at 390 × 844; scales by rem)

```
ledger        0–76     four figures max, tap a figure → its account (sources − sinks, one-line why)
body window   76–288   the organism; tap = primary verb; expand → the slide (full screen, touch parts)
voice         288–352  THE DRIVER (D9): 3 lines min, newest brightest; pull down → the full log
NEXT          340–404  one factual line; its amber also marks the body
verbs         404–776  grouped by verb, per-act tabs; sheets open over 340–844, body stays visible
nav / action  776–844  tabs (with readings, e.g. "1 ripe"), primary verb, endbar holds
```

**Grammar, one set across all acts:**
- *read* is flat text;
- *account* is a dotted underline;
- *tap* is a word whose underline draws on press;
- *locked* is a dashed outline with a one-line ↳ why;
- *hold* is a bar filled by hyphae growing along it.

Tokens (`--ground --sunk --raised --ink --ink-2 --ink-3 --rule --rule-2 --body --body-old --thread
--thread-glow --next --next-ink --danger --locked`) get new values per act and nothing else changes;
the values are in the mocks.

## Phases

Each phase is one PR. It's playable behind the flag, passes boot-check and redraw-check, and gets your
go before merge. Effort: S ≈ a session, M ≈ 2–3, L ≈ 4+.

### Phase 0 — Foundations (M)
- **Bundle diet first.** We're 980 KB raw and 0.9 KB under the gzip budget, and the redesign adds code.
  Strip dead panels and strings, dedupe ui.js helpers, and re-baseline the budget deliberately with the
  headroom written down.
- **Flag plumbing (D6)**, plus the `data-ui="d"` root and per-act token sets in `css/ui.css`.
- **Grammar primitives** in ui.js: `read`, `account`, `verb`, `locked(why)`, `hold` (built on the
  existing `bindHold`). The hold fill becomes a hyphae stroke on a tiny canvas.
- **Skeleton shell** with fixed slots (pillar 8: no reflow), with the old panels mounted inside the verbs
  slot so everything still works.
- **Harness:** shoot.mjs learns `?ui=d`; the self-tests assert the slot geometry.

### Phase 1 — The body (M–L)
- `js/body.js` covers the geometry from state (D2), a pulse whenever the voice speaks (D9), the three readings as one renderer with a reading
  parameter (0 = ink, 1 = mind, 2 = glass) so a morph is just interpolation, plus breathe, pulse and grow
  (new branches draw in when a tip is bought), hit-testing, and the slide view.
- **Perf budget:** 30 fps cap, paused when hidden, frozen under reduced motion (breathing only), and a
  hard ms-per-frame budget in redraw-check. It must not cost battery on a cheap Android.
- `canvas.js` already models the network and stands; the body reuses that rather than duplicating it.
  Act II stands become hit regions on the body (A's map-touch, via `regionAt`).

### Phase 2 — Act I in D (M)
- Ledger accounts: per-source rate bookkeeping for sugar, minerals and biomass in economy1.
- Voice ticker (the full log stays in its sheet), the NEXT engine (rules per act; Act I first), verbs
  grouped grow / learn / bargain, locked items with why lines (we already have most of the strings), and
  DECIDE as the endbar hold.
- Paper and ink material, light by default and soil in dark.

**Phase 2 as built (Nov 2026):**
- **Accounts.** These are core `flowAs`/`flowed`: every write to sugar, minerals or biomass is filed under the loop step or player verb that made it, so the account and the stock are the same write. Tapping a ledger figure opens its account, live: comes from, goes to, net, and one factual why line.
- **NEXT.** It covers DECIDE, then the nearest affordable item, then the nearest shortfall with its real blocker, the tip included and priced in full. It gives an ETA at the stock's net rate. Touching it jumps to its tab.
- **The voice in full.** Touching the voice opens its whole record in every act.
- **Grow / learn / bargain.** These are Act I's tabs, in the same bottom slot as Act II's bar. A tab arrives with its first panel.
- **Carried forward to the act shells:** rebuilding each card on the five-part grammar (locked + why), and Act I's paper and ink material. Both are a restyle of builders that Phase 3 will also touch, so they are done once, act by act.

### Phase 3 — Act II in D (L)
- The mind reading: packets run along the edges and Σ is light on the body.
- Stands open as sheets by touching the body or from the compact list. Pacts are partner nodes on the rim.
- The flush takes over as an event when something is ripe (the RELEASE we shipped in Phase A).
- Tabs with readings: forest / mind / flush / pact. The LOG tab goes because the ticker replaces it.
- Phosphor material: grid and scan lines in CSS, glow on canvas.

**Phase 3 as built (Nov 2026):**
- **The mind reading.** It is canvas `setReading('mind', fill)`: the Act I network under the map is stroked in the signal colour and grows brighter as the Σ pool fills. It is keyed into the map's redraw by twelfths, so it repaints only when the pool moves. A static instrument grid sits behind it in CSS.
- **Accounts for every act's strip.** The rows are positional, so each act's painter names its rows' accounts. Every Act II and III loop step and the pulse are filed.
- **NEXT for Act II.** It works through these in order:
  1. a ripe primordium;
  2. offers waiting;
  3. D unspent;
  4. the nearest mind-tab item.

  Touching it opens that tab.
- **Tab readings.** forest consumed %, mind fill % or D free, flush ripe, pact offers.
- **LOG gives up its tab.** The voice holds the record.
- **A ripe flush takes the pinned hold** (RELEASE · name · hold to take) on every tab, the way DECIDE does in Act I.
- **Carried forward:**
  - pacts drawn as partner nodes on the map's rim (new canvas geometry);
  - the five-part grammar on the Act II cards.

  The first belongs with Phase 4's canvas work, the second with the grammar pass.

### Phase 4 — Act III in D (L)
- The glass reading: bands as rings, craft as bodies in flight, endings as lights that brighten with
  their conditions, the genome as a constellation.
- The core numbers stay in the ledger, so nothing important hides behind touch.
- Fix the mocks' leftovers: the genome is one column, not a two-column grid; bands too thin to touch in
  the window are touched in the slide or the list.
- Frost/void material.

**Phase 4 as built (Nov 2026):**
- **The glass reading.** It is canvas `setReading('glass')`. The Act I network is mirrored top to bottom in the void's ink. The bands tilt into orbits (y × 0.42). The endings are four distant lights: each one's brightness and size is the mean of its conditions, with carbon and other many-decade stocks read in decades. An open ending gets an amber core and a ring, so brightness is never the only signal. Craft are bodies in flight along the occupied bands, two per decade, the inner bands faster. The lights are keyed into the void's redraw by sixteenths.
- **NEXT in Act III.** In order: an open ending ("… is open. it does not undo."), then D unspent, then the nearest ending's furthest condition ("the bloom: synchrony 0.31 of 0.80."). Touching it opens the tab.
- **Tab readings.** The void tab shows occupied bands, counted the panel's way. The genome tab shows D free.
- **The instrument grid** is Act II's material only.
- **Found on the way:** the real genome is already a single column of steppers. The two-column grid the critic flagged was in the mock, not the game.
- **Still carried:**
  - pacts as partner nodes on the Act II map's rim;
  - the five-part grammar on the cards.

### Phase 5 — Transitions (M)
- **T_1 DECIDE** (about 13.6 s): a 1.4 s hold, freeze, the body bursts out and the page tears, then
  STOP / TASTING / START / KNOWING, silence, the ink snaps to graph, the mind turns on and Act II knits
  in.
- **T_2 the glass** (about 14.6 s): saturate, still, the glass flexes, cracks from the knot, flips and
  inverts, the network folds to a point and becomes the planet, and the 13 bands ring out.
- Both are built on body.js (one canvas, a reading tween), plus haptics via `navigator.vibrate` and the
  feel.js audio hooks, tap-to-hurry, and calm mode (D8).
- Retire the old cut-to-black sequences in finale.js and divergence.js. The words and lines stay;
  09 §4 timings get updated.

**Phase 5 as built (Nov 2026):**
- **Loud variants are data.** Each act sequence gains a `loud` variant beside `steps` and `reduced`, chosen while `?ui=d` is on and motion is not reduced. A self-test holds the line: a loud variant speaks the same lines in the same order and ends on the same act. Hurry is the shipped skip.
- **DECIDE (13.6 s).** The act has already flipped in the state, so Act II's interface goes at once and the body is held as ink (canvas `bodyOnly`, no hexes, no grid).
  1. At 0.9 s the body bursts to the whole screen and swells about its root (×2.2, compositor), with a heavy shake.
  2. STOP / TASTING / START / KNOWING slam in at 104/66/92/66 px, each with a jolt.
  3. Black at 6.3 s.
  4. At 7.1 s the black lifts onto the same strokes read as the mind, with signal running down them.
  5. Act II knits in at 9.3 s.
  6. The two lines land at 11.0 and 12.6 s.
- **The glass (13.1 s).**
  1. The shipped drain and held core.
  2. The screen bows like a pane (4.9 s), then cracks from the knot to the edges on a canvas made for the beat (6.3 s), with a heavy shake.
  3. It turns edge-on (7.3 s).
  4. Clean black (8.2 s): the cut takes the cracks and the turn with it.
  5. The three lines come out of the dark, voice only.
  6. Act III frosts in at 13.1 s.
- **A shipped bug, fixed in both interfaces.** The cut-to-black rule hid the console's contents, so the discharge's three lines were never visible during its black. The console now shows them white on black; a sequence empties it first, so it can hold nothing else.
- **Still to do:** a haptic pattern per beat beyond feel.js's three act events, and audio cues. feel.js owns both, and they ride with Phase 6's feel pass.

### Phase 6 — Pacing to ~7 hours (M)
- A human-paced bot that hesitates, reads, makes the odd bad choice and goes away overnight.
  Measure each act's real hours.
- Re-tune only then: reputation by volume, the renew toggle, an earlier Standing Order, and a use for
  spare biomass (the old Phase C list). The target is roughly 2 h / 3 h / 2 h.

### Phase 7 — Cutover (S)
- Flip the flag on by default, delete the old panel scroll, bump sw, update 06 and 09, then deploy
  gh-pages.

**Order:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7. Phase 5 can start any time after Phase 1, so if you want the
loud bit sooner we pull it forward.

## Risks

- **Battery and performance of an always-alive body.** Mitigated by the frame budget in Phase 1. If a
  cheap phone can't hold it, the body drops to breathing only, and only while you're watching.
- **Discoverability.** Nobody has to find the map; every touch on the body also exists as a verb.
- **NEXT picks a bad move** and loses trust. It's facts only, and rules per act with tests on the saved
  stuck games.
- **Scope creep.** Each phase is a PR with a fixed list; anything new goes to the next phase.
- **Bundle.** Phase 0 is first for a reason.

## What we keep

The console corpus and its voice, the acts and their mechanics, the palette families, saves, offline
single-file deploy, and the 06 non-negotiables (including D4 on the thumb zone).
