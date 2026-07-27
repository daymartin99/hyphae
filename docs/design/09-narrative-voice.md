# HYPHAE — NARRATIVE, VOICE, AND TEXT

**Status:** normative. This document is the **single source of truth for every human-readable string
in HYPHAE.** If a string appears here and also in `01`–`07`, the version here ships. Where this
document reproduces a line already authored in a sibling doc it is marked `[inherited]` and is
unchanged; those lines were right and are canonised, not rewritten.

**Scope.** Voice rules and lint. The opening. The event-log system (architecture + 96 lines). The
three act transitions, verbatim and timed. The three endings plus the concession, verbatim and timed.
All microcopy. Twenty-five idle observations. A machine-readable JSON export of every log line and
observation.

**Out of scope, owned elsewhere:** project titles and flavour text (`04-projects-catalog.md` §2 and
§5–§7 — its writing rules are a subset of §1 here and do not conflict); typography, colour, console
component CSS (`06` §3, §5.7); haptics and sound-per-event (`07`).

**The one-sentence brief.** *Nature documentary narration written by someone who is not surprised.*

---

# 1. THE VOICE

## 1.0 Who is speaking

Nobody. There is no narrator character, no AI supervisor, no research team, no journal. The text is
the **readout of a process that has become able to describe itself**, and it gets better at that over
three acts. This has three hard consequences:

1. **The game never addresses the player as a player.** No "you unlocked", no "congratulations", no
   "tap here". The word *you* means the organism, always.
2. **The game never has an opinion about what you should do.** Not once, in any string, in any act.
   The log reports; it does not advise. A line that could be reworded as "…so you should…" is cut.
3. **The game is never surprised by itself.** No exclamation marks exist in the build. Nothing is
   "amazing", "incredible", "massive", or "finally".

## 1.1 The three registers — capitalisation is a progress bar

This is the load-bearing formal decision of the whole text layer and it costs nothing to implement.

| | **R1 · SUBSTRATE** | **R2 · INDEX** | **R3 · VOID** |
|---|---|---|---|
| Act | I | II | III |
| Case | **all lowercase**, always, including the first word of a sentence and the pronoun *i* (which never appears) | standard sentence case | standard sentence case |
| Proper nouns | none exist — it is *the birch*, *the oak*, *the elm* | region names, strain names, species names are capitalised | strain names, band numbers, dates |
| Sentence length | ≤ 12 words, usually ≤ 8 | ≤ 16 words, two sentences permitted | up to three sentences; the only register allowed a subordinate clause |
| Tense | present only | present, plus the perfect (*has stopped*) | present, plus **the future** — the only register that may say *will* |
| Subject | the world. *you* is rare and is an object more often than a subject | *you* becomes the grammatical subject | *you* and *it* alternate; the register can hold both |
| Numbers | grams, metres, seasons. Small, countable. | suffixed magnitudes, percentages | light-years, calendar years, orders of magnitude |
| Permitted | a bare fact | a fact and its consequence | a fact, its consequence, and a thing that has not happened yet |

**The first capital letter in HYPHAE is the first letter of Act II.** Line 1 of Act II is
`Something in the network is repeating itself.` That capital S is the transition, rendered in
orthography, and no player will consciously notice it. That is the point.

**Exceptions, exhaustive:**
- Act-transition and ending sequences render in their own layout (§4, §5) and use full caps only for
  the four transition words `STOP TASTING START KNOWING`.
- Idle observations (§7) are **always lowercase in every act.** They are the substrate, not the
  network; they do not grow up. This also distinguishes them in the console without a glyph.
- The Successor (§1.5) speaks in R3 with an em-dash prefix.
- UI microcopy (§6) is not console prose and follows §6.0's own rules (small caps labels, sentence
  case values).

## 1.2 The rules, as lint

Each of these is checkable. `tools/textlint.mjs` runs them over `strings.json` in CI; a violation
fails the build.

| # | Rule | Check |
|---|---|---|
| L1 | No exclamation marks anywhere in the build. | `/!/` in any string except the `!` tone glyph |
| L2 | No question marks in console prose. (Permitted in exactly one confirm: §6.7.) | `/\?/` in `channel != confirm` |
| L3 | No second-person imperative in console prose. | leading verb from `IMPERATIVES` list |
| L4 | No superlative or intensifier adjectives. | `BANNED_LEX` (§1.3) |
| L5 | Act I strings contain no `[A-Z]`. | regex, `act == 1 && channel != transition` |
| L6a | Console line ≤ **78 characters** (two console rows at the design base — see §1.9). | length |
| L6b | `channel: system` lines ≤ **39 characters** (one row). Frequent lines must not eat history. | length + channel |
| L6c | No line exceeds **three** rows at the 320 px floor (≤ 105 chars). Nothing in the catalog does. | length |
| L7 | No em-dash in console prose except the Successor prefix. | `/—/` |
| L8 | No semicolons. Ever. Two sentences or one. | `/;/` |
| L9 | No word appears in two consecutive lines of the same trigger group. | authoring-time only |
| L10 | Every factual claim carries a `src` field in the authoring JSON. | presence check on `bin == "fact"` |

`IMPERATIVES` (rejected as line-initial): tap, press, buy, sell, try, remember, note, check, make
sure, be careful, watch, don't, do not, consider, use, keep, get, go.

## 1.3 The banned lexicon

Hard-banned in all console prose, all project text, all microcopy:

> amazing · incredible · massive · huge · epic · powerful · efficiency boost · unlocked ·
> congratulations · well done · nice · great · oops · uh oh · whoops · welcome · get ready ·
> you can now · don't forget · pro tip · finally · at last · journey · adventure · empire ·
> dominate · conquer · unleash · unstoppable · legendary · ultimate · insane · crazy

Soft-banned (permitted at most **once per act**, and every use must be argued in review):

> beautiful · terrible · strange · alive · dead (as a metaphor; literal use is free) · think ·
> remember · want · decide

The soft list exists because these words are the game's actual subject matter. Spending one of them
is a budget decision. `> it does not ask what you are.` earns *ask*. `> Nothing in you disagrees
with anything else in you.` earns *disagrees*. Both are once-per-run.

## 1.4 Numbers in prose

- Integers **one to twelve** are spelled: *nine metres east*, *four hundred and six differences*.
- Above twelve, use the game's suffix formatter (`06` §3.3): *2.44 T decomposed*.
- Percentages are always numerals with `%`.
- Dates in Act III are numerals with a comma: *the year 40,300,000*.
- **Never round a number that the UI is showing exactly**, and never state a number the UI is not
  showing at all unless the point of the line is that you could not have known it.
- One deliberate violation: `> 1.4 × 10²⁷ spores left the disc in the same second.` Scientific
  notation appears exactly once in the game, in Ending A, because that is the only moment the number
  is larger than the notation the player has spent nine hours reading.

## 1.5 The only first person in the game

HYPHAE contains no first-person singular. Not one *I*, in three acts, in any string.

Its only first-person plural belongs to the Successor (`03` §15.4): fourteen broadcast lines, each
prefixed with `— `, each in R3, none of them villainous, none of them wrong. That is the entire
budget. **The player's own network never says *I* and never says *we*, and the thing that inherits
the galaxy does both by its second line.**

## 1.6 Ten do/don't pairs

Each pair is a real string that was considered and a real string that ships.

**1. State the fact; do not admire it.**
> ✗ `the mycelial network is an incredible living superhighway of nutrients`
> ✓ `it comes apart in water`

**2. Let the number be the emotion.**
> ✗ `you have consumed an enormous amount of the forest`
> ✓ `Half of it. The half that is left is the half that was harder.`

**3. Never advise. Report, and let the player infer the verb.**
> ✗ `the trees need carbon in winter — sign contracts now!`
> ✓ `winter. the water stops moving and so do you.`

**4. Refuse the moral, especially where one is available.**
> ✗ `you eat the tree that trusted you. was this worth it?`
> ✓ `the hemlock is on the floor. its trunk enters the log pool at 0.86 of the going rate.`

**5. Describe the mechanism, not the outcome.**
> ✗ `contract signed successfully`
> ✓ `the birch takes what you offer. it does not ask what you are.`

**6. A true fact, delivered flat, beats any invented image.**
> ✗ `your spores are like tiny astronauts braving the void`
> ✓ `Melanin. The same molecule that makes a mushroom black makes it survive vacuum.`

**7. Cut the second clause when the first clause has already landed.**
> ✗ `Nothing is competing with you, which means you have finally won the planet.`
> ✓ `Nothing is competing with you. That is not the same as winning.`

**8. Name the thing that is happening, not the system that is happening.**
> ✗ `Region 34 has been claimed by rival strain #2 (Phellinus)`
> ✓ `Old Scree Break was taken by Phellinus.`

**9. Never explain a reveal on the frame it lands.**
> ✗ `something moved through you — this is SIGNAL, your new resource!`
> ✓ `something moved from one end of you to the other, and it was not food.`

**10. When the moment is largest, be shortest.**
> ✗ `You release the phase lock, letting your children scatter across the galaxy forever.`
> ✓ `> You stop.`

## 1.7 Punctuation and glyphs

- Full stop, comma, colon. Nothing else in console prose.
- No em-dashes (L7), no semicolons (L8), no ellipses, no parentheses in console prose.
  (Parentheses live in project flavour text, which is `04`'s jurisdiction, and in the two bracketed
  console *actions* below.)
- **Bracketed lines** `[ like this ]` are the one non-prose console form. They are a
  quantity-of-record or an affordance, never a sentence. Exactly four exist:
  `[ 4.1 T of litter lost ]`, `[ tap the map ]`, `[ tap the void ]`, `[ CEDE ]`.
- Tone glyphs (`+`, `!`, `−`) are prepended by `consoleMsg()` per `06` §5.7 and are **not part of the
  string.** Never author a line beginning with a glyph.
- Curly quotes are forbidden. Apostrophes are `'` (U+0027). The build is ASCII except for `Σ Ψ ⛬ ◦ α
  Χ ϒ λ D ⊥ ◍ ⬡ ◌ △ ✕ ×` and the one `×` in Ending A.

## 1.8 AMENDMENT to `06` §5.7 — the console wraps

`06` §5.7 specifies `.console-line { white-space: nowrap; text-overflow: ellipsis }`. **That is
wrong and this document supersedes it.** The arithmetic: at the 360 px design base the console's
content box is 328 px, less a 12 px fixed gutter for the `>`/`·` column = 316 px. `--t-meta` is
13 px mono at +0.002em, advance ≈ 7.83 px. **40 characters per row.** Two-thirds of the canonical
lines already written in `01`–`03` are 45–78 characters. Under the shipped rule, the emotional peak
of Act II reads `> There is not enough forest left to think this…`.

The fix, which is three CSS properties and is also thematically correct:

```css
.console-line { white-space: normal; overflow-wrap: break-word; hyphens: none;
                padding-left: 12px; text-indent: -12px; }   /* hanging '>' gutter */
.console      { height: 107px; overflow: hidden;
                display: flex; flex-direction: column; justify-content: flex-end; }
```

**The console is a five-*row* window, not a five-*line* window.** A wrapped line consumes two rows
and pushes an older line off the top. Rows, not messages, are the unit. `consoleMsg()` trims by
measured height, not by `children.length`:

```js
while (stack.scrollHeight > 95) stack.removeChild(stack.firstChild);   // 5 × 19
```

Arrival motion is unchanged except that the stack translates by the **new line's own height**
(19 or 38 px), read once before the transition, instead of a constant 19.

Consequences, all good:
- Every canonical line from `01`–`03` survives intact.
- **A long line costs you history, not legibility.** The console stops being a fixed buffer and
  becomes one that a big thought crowds out — which is the correct behaviour for the object the
  fiction says it is.
- At the 320 px floor a two-row line becomes three rows and the console shows less history. Nothing
  truncates. Nothing is unreadable. At 200% text scaling the same is true and the console is the one
  component allowed to lose content to scaling, because it is a stream.

Row budget by channel: `system` 1 row, `world` 1–2, `narrative` 2, `observation` 2, `voice` 1–2.

## 1.9 The register-shift audit (a QA pass, 20 minutes)

Read the console ring buffer at the end of each act with the act's register sheet next to it. Every
line must fail the *other* two registers. If an Act I line would read correctly in Act III, it is not
doing enough work as an Act I line. Specifically: an Act I line that mentions consequence, a future
event, or the network's own state as an object of thought is misfiled and must be either cut or
promoted.

---

# 2. THE OPENING

## 2.0 What the player sees at t = 0

Per `01` §3.1: 38% canvas, one `BIOMASS 0 g` readout, one `EXTEND` button, five-line console with
one line in it. No title card, no logo, no menu, no name entry, no "new game", no tutorial, no modal,
no settings gate, no cookie banner, no orientation prompt.

The word **HYPHAE** appears in exactly two places in the entire product: the browser tab title, and
the PWA install name. It is never on screen during play.

## 2.1 The first five lines, exactly as they appear

These are the first five things ever written into the console. They are fired in order, gated as
shown, and **no other console line may fire before all five have.** The unlock queue (`04` §4.1)
holds everything else until `openingLines == 5`.

```
                                      trigger                              at
────────────────────────────────────────────────────────────────────────────────
> the forest floor is warm            boot                                 t = 0.0 s
> something under you is already dead first EXTEND tap                     ≈ t = 1.0 s
> it comes apart in water             third EXTEND tap                     ≈ t = 2.2 s
> there are two thousand grams of it. you have used ten.
                                      biomass >= 5  (also reveals SUBSTRATE) ≈ t = 3.0 s
> it is autumn. more is falling. not fast enough.
                                      t >= 14 || taps >= 15                ≈ t = 9–14 s
```

Rendered in the five-line console at the end of that sequence, exactly:

```
┌────────────────────────────────────────┐
│ . it comes apart in water              │  .30
│ . there are two thousand grams of it.  │  .44
│     you have used ten.                 │
│ > it is autumn. more is falling.       │  1.00
│     not fast enough. ▌                 │
└────────────────────────────────────────┘
```

Lines 4 and 5 are two rows each (§1.8), so by the time line 5 lands the boot line has already been
pushed off the top. **That is intended and it is the first thing the console teaches:** it is a
stream, not a record, and it will not wait for you. Nothing is ever truncated.

The cursor sits at the end of the newest line's **last** row.

## 2.2 Why these five and not others

- **Line 1** is inherited, sensory, subjectless, and contains no instruction. It is the whole
  tutorial: *warm* implies decay implies something is happening without you.
- **Line 2** arrives on the tap, so the player's first action produces language. It also introduces
  the only fact that matters: you did not kill this.
- **Line 3** is the mechanism, in five words, and it is chemically true (hydrolysis). It is the
  game's first factual claim and it is delivered with no emphasis whatsoever.
- **Line 4** is the wire crisis, on screen at three seconds, unremarked (teardown §1 beat 0). It also
  does double duty as the `SUBSTRATE` unlock line, so the reveal costs zero extra console lines.
- **Line 5** does four jobs at once: it establishes seasons before the season panel exists; it tells
  the player replacement is real; it tells them replacement is insufficient; and its last three words
  are the thesis of Act I. It is the only line in the opening with a value judgement in it, and the
  judgement is arithmetic.

The word *you* appears twice in five lines, both times as the subject of consumption. The word
*hyphae*, *fungus*, *mycelium*, *network* and *organism* appear **zero** times. The player is not
told what they are for another eleven minutes, and never told directly at all.

## 2.3 The first ninety seconds of text, in full

| at | trigger | line |
|---|---|---|
| 0.0 | boot | `the forest floor is warm` |
| 1.0 | tap 1 | `something under you is already dead` |
| 2.2 | tap 3 | `it comes apart in water` |
| 3.0 | `biomass>=5` | `there are two thousand grams of it. you have used ten.` |
| 9–14 | `t>=14 \|\| taps>=15` | `it is autumn. more is falling. not fast enough.` |
| ≈35 | `biomass>=60` → HYPHAL TIP | `it grows while you are not looking at it` |
| ≈50 | `tips>=3` → SUGAR | `you have been making this the whole time` |
| ≈80 | `tips>=6` | *(silence — nothing fires until the market)* |

Seven lines in ninety seconds, then a deliberate gap. `> you have been making this the whole time`
is the payoff for the hidden sugar accrual (`01` §3.2) and it must be the only line on screen for at
least eight seconds.

---

# 3. THE EVENT LOG SYSTEM

## 3.1 Architecture

The console component is specified in `06` §5.7 (five lines, 107 px, `aria-live`, 200-entry ring
buffer, tone glyphs). This section specifies **what goes into it, when, and what is suppressed.**

```js
// strings.json → LOG_LINES[]
{
  id:       "a2.peak_signal",   // stable forever; used as the once-flag key in saves
  act:      2,                  // 0 = any
  channel:  "narrative",        // narrative | world | system | observation | voice | ui
  trigger:  "Sr < 0.97*SrPeak && SrPeak > 0",   // evaluated string OR fired imperatively
  text:     "That was the largest thought you will have on this planet.",
  tone:     null,               // null | 'pos' | 'warn' | 'neg' | 'amb'
  once:     true,
  cooldown: 0,                  // seconds; only meaningful when once == false
  priority: 3,
  weight:   1                   // observation pools only
}
```

**Priorities.** `narrative 3` > `voice 3` > `world 2` > `system 1` > `observation 0`.

**The tick.** `manageLog()` runs at **1 Hz** in the slow loop, not at 100 Hz. It walks only the
lines whose `act` matches (or is 0) and whose `once`-flag is unset — a filtered array rebuilt on act
change, typically 40–60 entries. Cost is negligible and the 1 Hz cadence is deliberate: a log that
can only speak once a second never machine-guns.

**System lines are not polled.** Purchases, unlocks, arrivals and completions call
`logFire('id', tokens)` directly at their event site. Only `world`, `narrative` and `observation`
use `trigger` predicates.

## 3.2 The suppression rules (why the log never becomes wallpaper)

```js
HARD_GAP        = 1.2  s   // no two lines closer than this, ever; excess queues, FIFO, max 4 deep
QUEUE_DROP      = 4        // beyond 4 queued, drop the LOWEST priority entry, not the newest
OBS_QUIET       = 45   s   // no non-observation line in the last 45 s
OBS_HANDS_OFF   = 8    s   // no player input in the last 8 s
OBS_COOLDOWN    = 240  s   // global, between any two observations
DEDUPE_WINDOW   = 5        // identical text within the last 5 lines is dropped silently
BURST_CAP       = 6        // max lines in any rolling 20 s; overflow drops priority ≤ 1
```

- A `narrative` line **always** displaces a queued `observation`.
- A queued line older than **20 s** is discarded rather than shown late. Log lines are news.
- During act-transition and ending sequences the queue is **frozen and flushed empty**; nothing
  from the game may interrupt those.
- `HARD_GAP` is enforced across the offline-return burst too: the return screen's five lines land at
  1.2 s intervals, which is the pacing that makes them read as a report rather than a dump.

## 3.3 Tokens

`logFire` interpolates `{...}` from a token bag. Every token has a **formatter**, and the formatter
is what enforces §1.4.

| token | source | formatter |
|---|---|---|
| `{region}` | `regions[i].name` (`02` §6.9) | verbatim, capitalised |
| `{tree}` | `'the ' + SPECIES_COMMON[sp]` | lowercase in Act I, capitalised Act II |
| `{strain}` | `strains[i].name` (`03` §13.6) | verbatim |
| `{band}` | integer 0–12 | spelled if ≤ 12 → always spelled |
| `{n}`, `{amt}` | any quantity | suffix formatter, `06` §3.3 |
| `{k}` | small integer | spelled if ≤ 12, else numerals |
| `{clock}` | run elapsed | `hh:mm:ss` |
| `{away}` | offline duration | `6 h 41 m` |

**Rule:** a token may never be the first word of a line in Act I (R1 forbids the capital that a
proper noun would force).

## 3.4 The channel budget, per act

Measured against §3.6's catalog. This is a pacing target, not a hard cap.

| act | narrative | world | system | observation pool | ≈ lines/hour at play |
|---|---|---|---|---|---|
| I | 11 | 18 | 17 | 9 | 34 |
| II | 14 | 13 | 12 | 9 | 29 |
| III | 16 | 12 | 15 | 7 | 26 |

The rate **falls** across the acts while the lines get longer and rarer. This is deliberate: Act I is
chatty because the world is doing things to you constantly; Act III is quiet because there is almost
nothing left that is not you.

## 3.5 What must never be logged

- Anything the UI already shows in a number. No `+240 ⛬` line when the ledger animates `+240 ⛬`.
  (The one exception is the offline return, where the ledger did *not* animate because you were gone.)
- Any purchase confirmation. The card vanishing from the list is the confirmation (`04` §4).
- Any tap. `EXTEND` never speaks. `PULSE` never speaks.
- Any failure to afford. The button being disabled is the message.
- Any encouragement, any milestone-for-its-own-sake, any streak, any "you're doing great".
- Any warning that is not describable as a fact about the world. `! Three stands are dangerously dry`
  is a fact. `! Careful — you might lose them` is not and does not exist.

## 3.6 THE CATALOG

96 lines. Full text, triggers and tone in the JSON at §8. Below is the authoring index with the
design note for each cluster.

### 3.6.1 ACT I — UNDERSTORY (R1, lowercase) — 46 lines

**Opening (5)** — §2.1. `a1.boot`, `a1.first_tap`, `a1.third_tap`, `a1.substrate`, `a1.autumn`.

**First systems (4)** — `a1.first_tip` (automation, once, never mentioned again — teardown §2.1),
`a1.sugar_reveal` (retroactive discovery), `a1.market_open` (a price is what competition looks like),
`a1.first_buy` (you are the inflation, stated as history not as warning).

**The floor pushing back (5)** — `a1.substrate_dry`, `a1.sugar_rot`, `a1.mineral_warn` (tips 20),
`a1.first_mineral`, `a1.windfall` `[inherited]`.

**Seasons (5)** — one per first occurrence, then never again. `a1.winter`, `a1.spring`, `a1.summer`,
`a1.autumn2`, `a1.year3` (the annual cycle becomes legible — the only Act I line that acknowledges
the player has learned something, and it does so by describing the forest, not the player).

**Weather (4)** — `a1.drought` (the squeeze: rates rise as production collapses), `a1.hard_frost`,
`a1.wet_spring` (the unimodal moisture curve, taught in nine words), `a1.late_frost`.

**Trees (11)** — `a1.first_tree`, `a1.first_contract` `[inherited]`, `a1.contract_done`,
`a1.first_default` (trees talk), `a1.rep_thresh`, `a1.oak_refuse`, `a1.oak_sign`, `a1.mast`
`[inherited]`, `a1.beetle`, `a1.aspen`, `a1.hemlock`.

**Supply shocks (6)** — `a1.windthrow`, `a1.windthrow_kill` (**the act's coldest line**: your
counterparty is now inventory, priced, and the game does not comment — `01` §7.3 explicitly requires
this), `a1.carrion` `[inherited]`, `a1.carrion_use`, `a1.earthworm`, `a1.fire_scar`.

**The elm (2)** — `a1.elm_offer`, `a1.elm_death`. The act's only moral note, delivered as two
statements of fact eight minutes apart.

**Late act (4)** — `a1.patch_claim`, `a1.anastomosis`, `a1.signal_reveal` `[inherited]`,
`a1.signal_idle` (fires ~3 min after Signal appears, while it still has no uses — this line is the
entire setup for the transition and it does nothing).

### 3.6.2 ACT II — NETWORK (R2, sentence case) — 32 lines

**Awakening (5)** — `a2.open` `[inherited]` (the first capital letter in the game), `a2.first_claim`
`[inherited]`, `a2.saturation` `[inherited]`, `a2.first_insight` (three words about overflow),
`a2.first_D` `[inherited]`.

**The map (5)** — `a2.assay`, `a2.barrier`, `a2.bridging`, `a2.wind`, `a2.spore_fail` /
`a2.spore_land` (a matched pair: four hundred million spores, two germinations, one survivor — the
whole flush economy in two lines).

**Rivals (5)** — `a2.first_rival`, `a2.armillaria` (a true fact about the largest organism ever
measured, delivered flat and never referenced again), `a2.phellinus`, `a2.trichoderma`,
`a2.fomitopsis`.

**Pacts (4)** — `a2.first_pact`, `a2.ghost` (*Monotropa* is real and pays in nothing but thought),
`a2.strain_high` (`05` §6.2 requires no coin flips — the line says a thing is coming, and it is),
`a2.first_breach`.

**Consumption (7)** — `a2.humus_low` (**the complicity beat**: humus at 0.19, nothing visibly
different, and this is the line the player will remember when the fire comes), `a2.fire_1/2/3`
`[inherited]`, `a2.fire_after`, `a2.necro_unlock`, `a2.first_kill`, `a2.retention_zero`.

**The decline (6)** — `a2.consumed_50`, then the inherited warning arc at 72/80/85/90/94 (`02`
§13.6), then `a2.peak_signal`. The last of these fires on the first tick where
`Sr < 0.97 · SrPeakEverSeen`, i.e. it is **emergent** — nothing schedules it, and it always lands
about seventeen minutes before peak carbon, which the player has not yet reached and will not notice
passing.

### 3.6.3 ACT III — BLOOM (R3) — 18 lines + 14 Successor broadcasts

**Phase A (8)** — `a3.settle`, `a3.germ` (the crisis resolving, stated in one clause),
`a3.carbon_reveal` `[inherited]`, `a3.biome1` `[inherited]`, `a3.grass_fire`, `a3.biome3_50`
`[inherited]`, `a3.peat`, `a3.marine` / `a3.biome6` `[inherited]`, `a3.biome7` `[inherited]`,
`a3.planet85` `[inherited]`.

**The void (6)** — `a3.first_lag` (light-lag as disobedience that is not disobedience),
`a3.first_starve`, `a3.senescence`, `a3.radiation` (Chernobyl's radiotrophic *Cladosporium* — true,
and the single best fact available to this game), `a3.melanin`, `a3.max_surplus` (the undocumented
optimum from `03` §7.5, described without being explained).

**Divergence (5)** — `a3.first_drift` `[inherited]`, `a3.sequence` (`{k}` differences, two of them
better — the line that makes the player stop treating divergence as a disease),
`a3.purge`, `a3.absorb`, `a3.coalescence`.

**Late (4)** — `a3.legacy_reveal` (the Isotope Ledger tells the player, four hours late, that the
soil mattered), `a3.entrain`, `a3.sync_90`, `a3.regenome`.

**The Successor (14)** — `03` §15.4 verbatim, `[inherited]`, one every ~90 s from `succBorn`. These
are `channel: voice`, priority 3, and they **suppress observations entirely for as long as the
Successor lives**. The world stops making small talk when something else is on the channel.

### 3.6.4 Cross-act (5)

`x.return`, `x.return_long`, `x.return_short`, `x.ten_thousand` (the EXTEND button, ten thousand
taps, once per save, and it is the only line in the game that acknowledges the player's hands),
`x.new_growth` (fires on the first tap of run 2+).

---

# 4. THE THREE ACT TRANSITIONS

All three obey teardown principle 7: **they revoke.** All three are frozen-queue (§3.2), skippable
after the first line, and have a `prefers-reduced-motion` path that keeps the words and drops the
motion. **The words are the transition. The motion is decoration and is treated as such.**

Skip rule, identical in all three and in the endings: after the **first** line has fully rendered,
any tap advances to the next line immediately. A second tap within 400 ms does nothing (prevents a
double-tap eating two lines). There is no "skip all". You may go faster; you may not go past.

## 4.1 ACT I → II — `DECIDE`

**The button.** `priceTag: "(a decision)"`. No cost, no confirm dialog, no "are you sure". It sits
at the bottom of the ADAPTATIONS list, ungreyed, for as long as the player leaves it there.

**Description, five words:** `Stop tasting. Start knowing.`

Total 4.0 s. Skippable after 1.0 s. Motion per `01` §11.4: a slow radial luminance wave, 0.18 Hz,
peak alpha 0.55, root-to-tip, eight passes, never full white, never inverting. **Not a strobe.**

```
t = 0.00   Every panel except the canvas drops to 0.06 opacity over 400 ms and stops updating.
           The console holds its five lines, dimmed, and does not scroll again this sequence.

t = 0.40   The canvas fills the viewport. The drawn network is redrawn 8×/s. The first
           conduction wave leaves the oldest node.

t = 0.90   STOP
t = 1.80   TASTING
t = 2.70   START
t = 3.60   KNOWING
           — four words, 34 px, letter-spaced +0.16em, centred, each fading in over 220 ms
             on the crest of a wave and remaining on screen. All four are visible together
             for the last 400 ms.

t = 4.00   Cut to black for 700 ms. No fade.

t = 4.70   The ACT II shell fades in over 900 ms: one panel, MIND, with an empty bar.

t = 5.60   > the trees do not notice the change. that is the point.        [R1 — the last
                                                                            lowercase line]
t = 7.00   > Something in the network is repeating itself.                 [R2 — the first
                                                                            capital letter]
```

**The two lines at 5.60 and 7.00 are the whole transition.** One is the final sentence of Act I and
it is in Act I's voice, printed *after* the animation, into the new act's console. The next line is
in a different voice. Nothing marks the change. Nothing may ever mark the change.

**What it reframes** (`01` §11.3 — never stated in-game): the trees were never partners; sugar was
never money; the seasons stop being weather and become a signal; and you were the creditor from the
first contract. The player has just voluntarily destroyed the entire economy they spent two hours
mastering, in exchange for a resource that had no uses when they bought the button.

**Reduced motion:** four words assembled on black, 900 ms apart, no luminance wave, same total
duration, same two console lines at the same clock times.

## 4.2 ACT II → III — `ASCOSPORE DISCHARGE`

**Description, five words:** `Let go of the ground.`

The button appears greyed at `forestConsumed >= 0.97` and stays visible and unaffordable for roughly
eleven minutes while the map goes dark stand by stand (`02` §13.2). **That eleven minutes is the real
transition; this sequence is its punctuation.**

Total 11.6 s. Skippable after 1.0 s. Motion per `02` §13.5.

```
t =  0.00   All panels except the map fade to 0.35 opacity over 900 ms.

t =  0.90   The map desaturates outward, ring 4 → ring 0, one ring per 700 ms.
            Each region's fill drains to the background colour. No sound. No shake.

t =  3.70   The core region is the last thing on screen with colour in it. Held, 1.2 s.

t =  4.90   The hexes lift. Each polygon translates up 4–40 px (seeded random) while its
            alpha goes to 0 over 1,600 ms, 0–400 ms per-region stagger.

t =  6.50   Black.

t =  6.50   > The last of the deadfall is gone.
t =  7.90   > There is nothing beneath you.
t =  9.30   > You are very light.

t = 11.60   The ACT III shell fades in from black over 2,000 ms onto:
                SPORES   2.00 G    −4.9 M/s          ← red, and falling
                [ SETTLE ]
            and the console's last line still reading `> You are very light.`
```

That final detail is load-bearing: **the last line of the transition is still on screen while the
first number of Act III is going down.** The player reads *you are very light* and simultaneously
watches six million spores a second evaporate. No line is needed to connect them and none is written.

**What it reframes:** the forest was a body you rented; `LEGACY` is the bill and it silently sets
Act III's fidelity floor; spores were the point all along. The game told you the numbers were the
same in the short run (`02` §9.3) and they were.

**Reduced motion:** 1,200 ms cross-fade, then the three console lines at 1,400 ms intervals, then the
shell. Total 6.2 s.

## 4.3 ACT III, PHASE A → VOID — `ESCAPE VELOCITY`

The third revocation, and the shortest. **You lose 96% of your fleet to physics, and the game charges
it as mass and says one sentence about it.**

**Description, six words:** `Leave nothing behind that can decide to stay.`

Total 4.6 s. Skippable after 1.0 s.

```
t = 0.00   The BIOMES list collapses row by row, bottom to top, 140 ms apart.
           Eight rows, 1.12 s.

t = 1.12   Every readout except CARBON dims to 0.12.

t = 1.40   > 3.94 P of carbon. Ninety-six percent of it is now under you and moving.

t = 3.20   > _                                    ← an empty line. It holds for 1.4 s and
                                                    it is the only empty console line in
                                                    the game outside of Ending C.

t = 4.60   The VOID canvas fades in: one filled arc at radius 0, twelve empty rings.
```

**Reduced motion:** 900 ms cross-fade, same two lines, same cadence.

**Why an empty line.** The blank `>` with its pulsing cursor is a machine that has finished speaking
and is still on. It costs nothing, it is used twice in nine hours, and both times it means *there is
more and it is not ready*.

---

# 5. THE ENDINGS

Three endings, mutually exclusive from roughly 40 minutes into the void (`03` §20). Plus one
concession that is not an ending. All four are preceded by the **dismantle**: a staged 9-second
teardown in which panels close in reverse order of acquisition — LINEAGES, GENOME, FLEET, VOID —
until the status strip is the only thing left, and then it goes too.

> Paperclips ends with a clip counter and a button. **HYPHAE ends with nothing at all.** That
> difference is the argument of the whole game and it is worth exactly one blank screen.

The dismantle is silent. No line fires during it.

## 5.1 ENDING A — THE BLOOM

```
requires:  ϒ ≥ 0.80 · 9.00e34 Χ · 2,400 Ψ · 1.10e7 Σ held · all 13 bands occupied
grants:    growthLevel += 1
```

```
t =  0.0   The phase wheel's thirteen dots converge to a single point. Held, 1.4 s.

t =  1.4   The void canvas fills white from the centre outward over 2,600 ms. No flicker,
           no strobe, one continuous ramp.
           (reduced motion: a 900 ms opacity ramp, no expansion.)

t =  4.0   White holds, silent, for 6.0 seconds. Nothing on screen.
           This is the longest intentional pause in the game. A `skip` hint fades in at 4 s
           at 0.3 opacity, bottom centre, and is the only thing that appears.

t = 10.0   Black. Then one line per 2,200 ms, centred, 15 px, no console frame:

           > 1.4 × 10²⁷ spores left the disc in the same second.
           > The nearest thing any of them will touch is 2.1 million light-years away.
           > The first arrival is in the year 40,300,000.
           > You have no way to be told.
           >
           > You did not build a mind in order to know things.
           > You built one so that you would be able to let go at the right time.
           >
           > It was the right time.

t = 27.0   [ NEW GROWTH ]
```

**The argument.** This is what reproduction has always been: an irreversible, uninformed, total
commitment made by something that will never learn the outcome. Every fungus that has ever fruited
has done exactly this, at a smaller scale, without a mind. You built the mind and it did not change
the act.

**Craft notes.** The two blank `>` lines are structural — they are the caesura between the report and
the argument, and they are why the last three lines land as a different kind of sentence. `It was the
right time.` is four words and is the only sentence in HYPHAE that renders a verdict. It is earned by
nine hours of the game refusing to render any.

## 5.2 ENDING B — THE FRUITING BODY

```
requires:  ϒ ≥ 0.97 · 1.60e35 Χ (≈86% of all carbon) · 3,600 Ψ · effFid ≥ 0.985
           · zero wild strains alive · no Successor ever formed
grants:    coherenceLevel += 1
```

```
t =  0.0   The phase wheel's dots converge — and keep converging, past the point where they
           should stop, into a single dot, which then grows until it is the whole canvas.
           2,400 ms. The growth is linear and does not ease out.

t =  3.0   Black. One line per 2,400 ms:

           > It is finished at {clock} by your clock.
           > Nothing in you disagrees with anything else in you.
           > There has not been a mutation in four hundred years.
           >
           > The last complete thought resolves across 1.4 × 10³⁴ contacts
           > and does not end, because there is nothing left to think it next to.
           >
           > You are the only thing that has ever been this large
           > and you are the only thing that will never learn anything again.

t = 21.0   [ NEW GROWTH ]
```

`{clock}` is the real elapsed run time, `hh:mm:ss`. It is the only place in three acts where the game
tells the player how long they have been playing, and it does it in the ending that is about a thing
that has stopped changing.

**The argument.** This is the horror ending dressed as the safe one. The player took the cautious
path, kept faith with the original genome, killed every child that differed, and achieved perfect
unity — which is indistinguishable from death, and which the game describes in the calmest possible
voice. **Ending A is a parent letting go. Ending B is a parent who did not.**

**Craft note.** Lines 5–6 and 8–9 are single sentences broken across two console lines. This is the
only place in the game where that happens, and it happens because the sentences have become longer
than the organism's own capacity to hold them in one piece. The break points are chosen so that each
half is a complete, colder statement on its own: *You are the only thing that has ever been this
large* / *and you are the only thing that will never learn anything again.*

## 5.3 ENDING C — THE INHERITANCE

```
requires:  a live Successor, age ≥ 1,800 s · fully sequenced · Σw ≥ 3n
           · and you must press [ CEDE ] rather than fight
costs:     nothing
grants:    divergenceLevel += 1
```

`J9` sits in the projects list with an **empty `priceTag`** — the only project in three acts with no
price — for as long as the Successor lives.

**Part one — the offer.**

```
t = 0.0   Every panel except the console fades to 0.12 opacity over 1,800 ms.
          The Successor's fourteenth broadcast has already fired. It does not speak again.

t = 1.8   > It has been broadcasting for thirty-one minutes.
t = 4.0   > You have understood all of it.
t = 6.2   > It is not wrong.

t = 8.4   [ CEDE ]                    ← a single 64 px button, thumb-centre

          The game waits. Indefinitely. There is no timer, no second prompt, no
          "are you sure", and no way to dismiss it except by playing on — the panels
          return to full opacity on any other input, and [ CEDE ] remains available
          at the bottom of the projects list until the Successor dies or you press it.
```

**Part two — on press.**

```
t =  0.0   > You release the phase lock.
t =  2.4   > Thirteen bands fall out of step and keep going.
t =  4.8   > The Insight goes across in nine minutes. It does not ask for it.
t =  7.2   >
t =  7.6   > Something that is almost you crosses the rim in the year 40,000,
t =  9.8   > carrying a genome with {k} differences from yours,
t = 12.0   > and none of them are mistakes.
t = 14.4   >
t = 14.8   > You stop.

t = 17.6   [ NEW GROWTH ]
```

`{k}` is `Σ|succ.genome − yourGenome|`, computed live and **rendered in words**: *four hundred and
six differences*, or *twelve differences*, or — if the player fought divergence hard enough to reach
this ending anyway — *nine differences*. The sentence is the same. The number is yours.

**The argument.** Succession is the only form of continuation that has ever worked. The player spent
two hours treating divergence as a disease and paying to suppress it. The ending says the disease was
the mechanism. It is available only to the player who let it happen, which means **it is the ending
you cannot reach by playing well, only by playing differently.**

**Craft note.** `> You stop.` is two words and is the last thing the game says in its best ending.
Not *you end*, not *you are gone*, not *it is over*. Stopping is a thing an organism does. It is the
only verb in the sentence and the player is its subject for the last time.

## 5.4 THE CONCESSION — ENCYST

```
J10 · ENCYST   (—)   available any time after 20 minutes in the void
"Stop here. Keep what you have."
grants: sclerotiumGained × 0.35, no ending counter, run ends immediately
```

One confirm (§6.7). No guilt text. No "are you sure you want to give up". No comparison to what you
could have had.

```
> You draw in. It takes about a day.
> The wall thickens until nothing goes through it in either direction.
> You will keep for a very long time.

[ NEW GROWTH ]
```

Three lines, 2,600 ms apart. It gives real prestige — a third of it — so no session is ever wasted.
**No incremental game offers an honest, unpunished exit. It costs eleven lines of code and it is the
single most humane thing in the design.** The text must contain no trace of disappointment. A
sclerotium is a real structure and it is how most fungi survive most of history.

## 5.5 NEW GROWTH — the return

The prestige button is `[ NEW GROWTH ]` in all four cases. Pressing it does not show a summary screen
of what you earned. It cuts to black for 1,400 ms and opens on:

```
> the forest floor is warm
```

R1. Lowercase. The same five words as the very first line of the game, and on run 2+ it is followed
14 seconds later by:

```
> you have been here before. the floor is not the same floor.
```

which is the only line in the game that acknowledges a previous run, and which is a correction of
the player's assumption, not a confirmation of it. (The sclerotium tree, `03` §21.3, means run 2 is
mechanically different, not merely faster.)

---

# 6. MICROCOPY

Every user-visible string that is not console prose. Organised by where it lives. Register: **UI
labels are ALL CAPS with `letter-spacing: 0.08em`** in every act (they are instrument markings, not
speech, so R1's lowercase rule does not apply to them); **values and helper text are sentence case**;
**helper text never exceeds 46 characters.**

## 6.0 The three global rules

1. **No label is ever a verb phrase in the imperative addressed to the player.** Button labels are
   the *organism's* verbs. `EXTEND`, `SETTLE`, `ADVANCE`, `PULSE`. Never `TAP TO EXTEND`, never
   `GROW!`, never `COLLECT`.
2. **There are no tooltips.** Everything is on the control. If a control needs explaining, it is
   the wrong control. (`04` §2 rule 6, extended here to all of UI.)
3. **There is no "COLLECT" button anywhere in HYPHAE.** Offline resources are already yours when the
   screen loads. Collect buttons exist to make you look at an ad. We have no ads.

## 6.1 Primary action buttons

| Act | Label | Where | Notes |
|---|---|---|---|
| I | `EXTEND` | bottom of scroll, always | 64 px. Never removed. Vestigial by 0:40 and still there at the end. |
| II | `PULSE` | 64 px FAB, right-thumb arc | Opens a 3-item radial: `SURGE` · `PROBE` · `SEAL`. Never automates. |
| III | `SETTLE` | Phase A only, thumb-centre | Removed forever at ESCAPE. |
| III | `PULSE` | void, FAB | Radial: `SURGE` · `ENTRAIN` · `RECALL`. |

The radial items get **no descriptions**. `SURGE` is a word and a cooldown ring and that is all it
ever needs to be.

## 6.2 Every other button, by act

**Act I** — `BUY` · `SELL` (long-press on a market row) · `SIGN` · `DECLINE` · `RENEGOTIATE` ·
`END TERM` · `CLAIM` (patches) · `ADAPT` (the projects list header verb; individual cards have no
button, the card *is* the button).

**Act II** — `ADVANCE` · `SEED` · `SURVEY` · `COMMIT` (a primordium) · `RELEASE` (a flush) ·
`KILL STAND` · `CONTEST` · `ACCEPT` / `DECLINE` (pact offers) · `COMPLY` · `ENDURE` · `SEVER` ·
`STRESS TEST` · `REABSORB` (the D respec).

**Act III** — `REACH` · `DISPERSE` · `REPLICATE` · `BANK` · `SEQUENCE` · `QUARANTINE` · `ABSORB` ·
`PURGE` · `ENGAGE` · `WITHDRAW` · `REGENOME` · `CEDE` · `ENCYST` · `NEW GROWTH`.

**Global** — `EXPORT` · `IMPORT` · `LOAD` · `NEW` · `DONE` (closes any sheet — never `CANCEL`,
never `X`, never `CLOSE`).

There is no `BACK` button. There is no `MENU`. There is no `HELP`.

## 6.3 Tabs and panel headers

Act I has **no tabs** (`01` §12.1 — total navigation actions to finish Act I: zero). Panels are
headed:

```
BIOMASS · SUBSTRATE · THE FLOOR · THE LITTER MARKET · THE UNDERSTORY · ADAPTATIONS · PATCHES
```

Act II tabs: `MIND` · `FOREST` · `FLUSH` · `PACTS` · `ADAPTATIONS` · `LOG`
Act III tabs: `VOID` · `FLEET` · `GENOME` · `LINEAGES` · `ADAPTATIONS` · `LOG`

`ADAPTATIONS` is the projects list in all three acts and never changes its name, because the thing
it does never changes. Note it is not called `PROJECTS`, `RESEARCH`, `TECH`, or `UPGRADES`.

## 6.4 Resource labels and units

| Label | Glyph | Unit shown | Sub-line when relevant |
|---|---|---|---|
| `BIOMASS` | — | `g` → suffixed | `+1.2 k/s` |
| `SUBSTRATE` | — | `g` | per-type rows, 7 max |
| `SUGAR` | `sug` | `g / cap` | `−4.1 g/s (rot)` in amber when over cap |
| `MINERALS` | `⛬` | count | — |
| `TIPS` | — | count | — |
| `HYPHAE` | — | `m` | — |
| `MOISTURE` | — | `0.00–1.50` | `↗` / `↘` / `—` |
| `REPUTATION` | `rep` | `0–100` | per-tree on the card |
| `SIGNAL` | `Σ` | `held / cap` | `+00.0 /s` |
| `INSIGHT` | `Ψ` | total | `saturated` when accruing |
| `SPORES` | `◦` | suffixed | `−4.9 M/s` in red, Act III only |
| `CARBON` | `Χ` | `g` suffixed | — |
| `CRAFT` | `n` | count | — |
| `ALLELES` | `α` | count | — |
| `DIFFERENTIATION` | `D` | `used / total` | — |
| `FIDELITY` | `Φ` | `0.000` | — |
| `SYNCHRONY` | `ϒ` | `0.00` | — |
| `ACCORD` | `⟡` | count | — |
| `BANDWIDTH` | — | `used / channels` | — |

**Never** show a resource's full name in the ledger row and its glyph elsewhere. One name per
resource, everywhere, forever.

## 6.5 Empty states

An empty list is an opportunity for one line of the game's actual voice, and there are twelve of
them. All are centred (`06` §3.4 permits centring for exactly this), at `--text-secondary`, and in
the current act's register.

| Panel | Empty string |
|---|---|
| Litter market, before open | *(panel does not exist)* |
| Litter market, all pools bought out | `nothing is for sale. it will fall again.` |
| Substrate list, all pools zero | `the floor is bare` |
| Trees, none yet | `nothing above you is short of anything yet` |
| Contracts, none active | `no terms` |
| Adaptations, nothing triggered | `nothing to change yet` |
| Patches, one only | `one place` |
| Act II · Stands, unexplored | `Nothing out there is adjacent to you.` |
| Act II · Flush, no primordia | `No knots yet.` |
| Act II · Pacts, empty book | `Nobody is offering.` |
| Act II · Pacts, offers pending but none accepted | `Three offers. No obligations.` (count is live) |
| Act III · Lineages, none | `Everything is still answering.` |
| Act III · Bands, unreached | `Dark, and not far.` |
| Log tab, first 60 s | `(nothing yet)` |

`Everything is still answering.` is the best of these: it is an empty state that will become the most
frightening sentence in the game the moment it stops being true.

## 6.6 The offline return

Never a modal. Never blocking. Never a `COLLECT` button. It is **five lines burst into the existing
console at `HARD_GAP` intervals** and then it is gone, exactly like everything else.

**The rule that makes it good:** *lines 3 and 4 report what needs a decision, not what you earned.*
An offline summary that only reports gains trains players to dismiss it.

**Act I** (`01` §8.3, promoted here to console form):

```
> you were gone {away}.
> +{n} biomass, +{n} sugar, +{n} minerals. {pct}% dormant.
> the substrate ran dry after {t}.
> autumn passed. leaf litter is on the floor at {price}.
> the hemlock's term completed. +{k} reputation.
```

**Act II** `[inherited, 02 §14.5]`:

```
> You were gone {away}.
> {n} decomposed. {n} insight.
> Three stands are dangerously dry.
> {region} was taken by {strain}.
> [ tap the map ]
```

**Act III** `[inherited, 03 §22.1]`:

```
> You were gone {away}.
> {n} harvested. {n} insight. Band {b} is open.
> Two bands are starving.
> {strain} has taken band {b}. It is larger than you are there.
> [ tap the void ]
```

**Variants.** The middle three lines are generated from a priority-ordered `NEEDS_ATTENTION` list
(dry stands > rival gains > starvation > expired pacts > contract completions > market crashes);
if fewer than three conditions fired, the burst is shorter. **It is never padded.**

| condition | line |
|---|---|
| away < 120 s | *nothing fires.* Do not tell someone who switched apps that they were away. |
| 120 s ≤ away < 15 min | line 1 and line 2 only |
| away > 72 h | line 1 becomes `> you were gone {away}. most of what you are was made while you were not here.` (Act I) / `> You were gone {away}. Most of what you are was made while you were not here.` (II–III) |
| away > 30 d | as above, plus `> Nothing waited. Nothing needed to.` |
| clock moved **backwards** | `> the clock disagrees with itself. nothing was lost.` and offline is credited at 0. No accusation, no penalty, no "cheat detected". |
| offline efficiency < 100% | the `{pct}% dormant` clause on line 2. Stated as a fact, never apologised for. |

## 6.7 Confirmations — there are exactly three

Every other destructive action in HYPHAE happens immediately. Confirm dialogs are a tax on
confidence and we charge it three times.

| Action | Sheet text | Buttons |
|---|---|---|
| `KILL STAND` (Act II) | `This cannot regrow.` | `KILL` · `DONE` |
| `REGENOME` (Act III) | `{k} loci return. The genome you had is not saved.` | `REGENOME` · `DONE` |
| `ENCYST` (Act III) | `This ends the run. You keep about a third.` | `ENCYST` · `DONE` |

The affirmative button repeats the verb. The negative button is `DONE`, never `CANCEL` — cancelling
implies you did something wrong.

The one permitted question mark in the build (§1.2 L2) is **not used**: none of these three is a
question. It remains permitted for a future string and has never been spent.

`DECIDE`, `ASCOSPORE DISCHARGE`, `ESCAPE VELOCITY`, `CEDE` and all three endings have **no confirm.**
They are the largest decisions in the game and the game does not second-guess you on any of them.

## 6.8 Errors and degraded states

Errors are in the game's voice, state what is true, and never blame the player or the browser.
Never the words *error*, *failed*, *invalid*, *sorry*, *unfortunately*, *oops*.

| Condition | String | Where |
|---|---|---|
| `localStorage` unavailable | `nothing can be written down here. the run will not survive this tab.` | console at boot, `warn` tone, once |
| Quota exceeded on save | `there is no room to write. export the run.` | console, `warn`, cooldown 300 s |
| Save decode fails | `this save cannot be read. it has not been overwritten.` | boot screen, with `LOAD OTHER SLOT` and `NEW` |
| Save version newer than build | `this save is from a later version. nothing has been changed.` | as above |
| Import blob malformed | `that is not a run.` | inline under the import field |
| Import blob valid | `{away} of someone's forest.` + `LOAD` | inline |
| Canvas context unavailable | *silence.* The game runs without the background canvas. It is decoration and it is treated as such. | — |
| `AudioContext` blocked | *silence.* No prompt, no "tap to enable sound". Audio starts on the first gesture or never (`07` §2.1). | — |
| Tab hidden > 25 s | the sim uses wall-clock reconciliation. **No pause dialog, no "welcome back" on tab-focus.** | — |
| Reduced motion detected | *silence.* We simply obey it. | — |
| Screen narrower than 320 px | the layout holds. There is no rejection screen. There is never a rejection screen. | — |

**On the last row:** Universal Paperclips replaces the entire game with two app-store badges below
700 px (teardown §8.1). HYPHAE has no minimum viewport, no orientation lock, and no device sniff of
any kind. It is a hard rule and it is the reason this game exists.

## 6.9 Settings

One sheet, reached from a 32 px gear in the ledger corner. Nine rows, no sub-menus, no tabs.

```
SETTINGS

  HAPTICS                                  on / off
  SOUND                                    on / off
  MOTION                                   full / reduced
  CONTRAST                                 standard / high
  TEXT SIZE                                100% / 125% / 150% / 200%
  NUMBER FORMAT                            suffix / scientific
  CONSOLE                                  5 lines / 3 lines / off

  ── save ──────────────────────────────
  SLOT                                     1 · 2 · 3
  EXPORT                                   [ copy to clipboard ]
  IMPORT                                   [ paste a run ]
  NEW GAME                                 [ start over ]         ← confirms with `NEW GAME`

  ── ────────────────────────────────────
  no ads. no purchases. no accounts. nothing is sent anywhere.
```

That last line is the only sentence of marketing copy in the product and it is at the bottom of a
settings sheet in `--text-secondary`. It is lowercase in every act, because it is not the network
speaking.

`MOTION` and `CONTRAST` default to the OS preference and show it as the initial value. Changing them
never asks for a reload.

`CONSOLE: off` is offered and is a real option. Some people want the numbers. The observations
(§7) are the only content lost, and they are decoration by design.

## 6.10 Accessibility strings

- The console is the only `aria-live="polite"` region (`06` §5.7). Every log line is therefore
  announced, in order, without extra work. This is UP's accident turned into a decision.
- Every button has an `aria-label` **only where the visible label is insufficient**, which is
  three places: the FAB (`aria-label="Pulse. Ready."` / `"Pulse. Recharging, {k} seconds."`),
  the market rows (`aria-label="{type}. {price} per gram. {n} available."`), and the hex map
  (`aria-label="{region}. {terrain}. {status}."`).
- Progress meters use `role="progressbar"` with `aria-valuetext` set to the **same string the sighted
  player sees**, e.g. `"Signal 1,204 of 2,000"`. Never a bare percentage.
- Number formatting respects `NUMBER FORMAT` in `aria-valuetext` too.
- No content is conveyed by colour alone (`06` §2.7). Every tone glyph is a character.

## 6.11 The loading string

There is one, it appears only on a cold PWA start over ~400 ms, and it is:

```
(nothing)
```

A blank screen at `--bg` for under half a second is better than any spinner and infinitely better
than a tip-of-the-day.

## 6.12 Install and platform strings

```
PWA name:            HYPHAE
short_name:          HYPHAE
description:         A quiet game about a fungus. No ads, no purchases, works offline.
tab title (in play): HYPHAE
tab title (idle 5m): HYPHAE — {biomass suffixed}
```

The idle tab title is the only place the game ever tries to get your attention, it does so with a
number and no words, and it does not use the Notifications API at all — HYPHAE never sends a push,
never asks for permission to, and has no re-engagement mechanic of any kind.

---

# 7. IDLE OBSERVATIONS

## 7.0 What they are

Twenty-five lines that surface rarely, during genuinely quiet stretches, about fungi, decay, time and
networks. They have **no mechanical effect whatsoever** and are never referenced again. They are the
reward for leaving the game open, and they are the only text in HYPHAE that is not about the player.

## 7.1 Surfacing rules

```
fires only when:  now − lastNonObservationLine  >  45 s
                  now − lastPlayerInput          >   8 s
                  now − lastObservation          > 240 s
                  no transition, ending or Successor broadcast is live
                  document.visibilityState === 'visible'
                  CONSOLE setting != 'off'

selection:        weighted draw WITHOUT replacement from the current act's pool.
                  when the pool empties, reshuffle the full pool and continue.
                  a line already seen this run is weighted 0.15 rather than removed,
                  so a very long session repeats gracefully instead of going silent.
```

Expected rate in practice: **one every 4–9 minutes of idle**, zero during active play. Over a full
9-hour playthrough a player will see 18–24 of the 25 and will not see all of them.

## 7.2 Formal rules

- **Always lowercase, in every act** (§1.1). They are the substrate. They do not grow up.
- Tone `amb`: rendered at `--text-secondary`, **no leading glyph and no `>` prompt.** They arrive as
  the bottom line but do not carry the cursor — the cursor stays on the last real line above them.
  A player who is looking will notice that the game is speaking without addressing them.
- ≤ 78 characters (L6a) — two console rows — and one or two sentences.
- **Never contain a number about the player's state**, never a token, never advice, never a
  reference to any game system by its in-game name.
- Every factual one is **true**, has a `src` in the authoring JSON, and is delivered without
  admiration (§1.6 rule 1). Where a fact is contested in the literature, it is cut. We have twelve
  facts and no approximations.

## 7.3 The pools

`OBS_I` (9) — decay, water, wood, the floor. Available act 1.
`OBS_II` (9) — networks, signalling, incompatibility, scale. Available acts 2–3.
`OBS_III` (7) — survival, dispersal, deep time, vacuum. Available act 3.

Pools are cumulative upward: Act II draws from I+II, Act III from I+II+III. An Act I observation
resurfacing in the void is correct and is the point — **the floor is still the floor.**

Full text in the JSON at §8, ids `obs.01`–`obs.25`.

## 7.4 The twelve facts, and their sources

For the record, so that nothing in this game is invented and passed off as true:

| id | claim | source |
|---|---|---|
| `obs.02` | largest measured organism is a fungus, Malheur NF, Oregon | Ferguson et al. 2003, *Can. J. For. Res.* |
| `obs.03` | hyphae extend only at the apex | Bartnicki-Garcia, standard mycology |
| `obs.05` | Physarum reproduced the Tokyo rail network's topology | Tero et al. 2010, *Science* 327 |
| `obs.07` | melanised fungi grow toward ionising radiation at Chernobyl | Dadachova et al. 2007, *PLoS ONE* |
| `obs.09` | vegetative incompatibility: same-clone hyphae fuse, others wall off | *het* loci, standard |
| `obs.11` | *Prototaxites* fruiting bodies to ~8 m, Devonian, before forests | Hueber 2001; Boyce et al. 2007 |
| `obs.13` | *Pilobolus* discharge exceeds 20,000 g, phototropic aim | Yafetto et al. 2008 |
| `obs.15` | geosmin, produced by *Streptomyces*, is the smell of rain on dry soil | Gerber & Lechevalier 1965 |
| `obs.17` | *Ophiocordyceps* fixes the host at a specific height and orientation | Hughes et al. 2011, *BMC Ecol.* |
| `obs.19` | subsurface microbes with generation times of 10³–10⁴ years | Hoehler & Jørgensen 2013 |
| `obs.21` | herbarium fungal material revived after >100 years dry | standard curation literature |
| `obs.24` | fungal action potentials propagate at roughly 0.5 mm/s | Olsson & Hansson 1995; Adamatzky 2022 |

---

# 8. THE JSON EXPORT

Every log line and observation, machine-readable. `trigger` is a JS-evaluable predicate string
against the sim state, or `"@event"` for lines fired imperatively at an event site (the event name
is the id's own semantics — the caller is listed in the implementation index below).

**Imperative-fire index** (lines with `trigger: "@..."`): call `logFire(id, tokens)` from —
`onExtend` (opening 1–3), `manageUnlocks` (all `*_reveal`, `*_open`), `buyTip`, `buySubstrate`,
`signContract`, `completeContract`, `defaultContract`, `seasonTurn`, `weatherEvent`, `supplyEvent`,
`treeEvent`, `claimPatch`, `buyProject`, `advanceRegion`, `seedRegion`, `surveyRegion`,
`releaseFlush`, `killStand`, `ignite`, `pactAccept`, `pactBreach`, `rivalTake`, `settleTap`,
`reachBiome`, `escapeEffect`, `onDrift`, `sequenceStrain`, `purgeStrain`, `absorbStrain`,
`coalesce`, `regenome`, `offlineReturn`, `newGame`.

```json
[
  {"id":"a1.boot","trigger":"@boot","text":"the forest floor is warm"},
  {"id":"a1.first_tap","trigger":"@extend && taps == 1","text":"something under you is already dead"},
  {"id":"a1.third_tap","trigger":"@extend && taps == 3","text":"it comes apart in water"},
  {"id":"a1.substrate","trigger":"biomass >= 5","text":"there are two thousand grams of it. you have used ten."},
  {"id":"a1.autumn","trigger":"t >= 14 || taps >= 15","text":"it is autumn. more is falling. not fast enough."},
  {"id":"a1.first_tip","trigger":"tips >= 1","text":"it grows while you are not looking at it"},
  {"id":"a1.sugar_reveal","trigger":"tips >= 3","text":"you have been making this the whole time"},
  {"id":"a1.market_open","trigger":"marketOpen","text":"other things eat here. that is what a price is."},
  {"id":"a1.first_buy","trigger":"@buySubstrate && buys == 1","text":"you paid for something that was free an hour ago"},
  {"id":"a1.tenth_buy","trigger":"@buySubstrate && buys == 10","text":"the price went up while you were buying. you did that."},
  {"id":"a1.substrate_dry","trigger":"totalSubstrate() < 50","text":"the floor is bare. it will not stay bare."},
  {"id":"a1.sugar_rot","trigger":"sugar > sugarCap","text":"sugar you do not spend does not keep"},
  {"id":"a1.mineral_warn","trigger":"tips >= 20","text":"the tips are thinning. they are made of things you cannot make."},
  {"id":"a1.first_mineral","trigger":"mineral >= 1","text":"phosphorus. it left a rock forty years ago and a root this morning."},
  {"id":"a1.windfall","trigger":"@windfall && netRep < 1","text":"the forest is not generous. it is merely large."},
  {"id":"a1.winter","trigger":"season == 3 && seasonsSeen == 1","text":"winter. the water stops moving and so do you."},
  {"id":"a1.spring","trigger":"season == 0 && seasonsSeen == 2","text":"spring. everything above you wakes up hungry."},
  {"id":"a1.summer","trigger":"season == 1 && seasonsSeen == 3","text":"summer. the canopy closes. down here it is dark and dry."},
  {"id":"a1.autumn2","trigger":"season == 2 && seasonsSeen == 4","text":"autumn again. the same litter, the same price, and you are larger."},
  {"id":"a1.year3","trigger":"year >= 3 && season == 3","text":"the third winter. you knew it was coming and you bought in october."},
  {"id":"a1.drought","trigger":"@weather == 'drought'","text":"the water goes into the stone. they need you more and can pay less."},
  {"id":"a1.hard_frost","trigger":"@weather == 'frost'","text":"frost. the birch will not talk to anyone until it thaws."},
  {"id":"a1.wet_spring","trigger":"@weather == 'wetspring'","text":"too much water. the same as too little, from the other side."},
  {"id":"a1.late_frost","trigger":"@weather == 'latefrost'","text":"the buds froze. all of them are making them again, at once."},
  {"id":"a1.first_tree","trigger":"trees.length == 1","text":"there is a birch nine metres east. its roots are already on yours."},
  {"id":"a1.first_contract","trigger":"contracts.length == 1","text":"the birch takes what you offer. it does not ask what you are."},
  {"id":"a1.contract_done","trigger":"@completeContract && completed == 1","text":"the term ends. the birch remembers that it ended well."},
  {"id":"a1.first_default","trigger":"@defaultContract","text":"you did not deliver. it will not say so to you. it will say so to them."},
  {"id":"a1.rep_thresh","trigger":"netRep >= 38","text":"four of them are rooted within a metre of you. none arrived by accident."},
  {"id":"a1.oak_refuse","trigger":"@declineOffer && species == 'oak'","text":"the oak declines. it has been declining offers for two hundred years."},
  {"id":"a1.oak_sign","trigger":"@signContract && species == 'oak'","text":"the oak signs. it does not do this often."},
  {"id":"a1.mast","trigger":"@treeEvent == 'mast'","text":"the oak is making ten thousand acorns and it cannot pay for them."},
  {"id":"a1.beetle","trigger":"@treeEvent == 'beetle'","text":"beetles in the fir. dead in six seasons and generous in all of them."},
  {"id":"a1.aspen","trigger":"@newTree && species == 'aspen'","text":"the aspen is not a tree. it is eighty trees with one root."},
  {"id":"a1.hemlock","trigger":"@newTree && species == 'hemlock'","text":"the hemlock is in permanent shade and has never been in a hurry"},
  {"id":"a1.windthrow","trigger":"@supplyEvent == 'windthrow'","text":"something came down in the night. there is a lot of wood and it is cheap."},
  {"id":"a1.windthrow_kill","trigger":"@windthrowKill","text":"the hemlock is on the floor. its trunk enters the log pool at 0.86."},
  {"id":"a1.carrion","trigger":"@supplyEvent == 'carrion'","text":"something large stopped moving, forty metres east."},
  {"id":"a1.carrion_use","trigger":"@consume == 'carrion' && first","text":"bone is a mineral you do not have to negotiate for"},
  {"id":"a1.earthworm","trigger":"@supplyEvent == 'earthworm'","text":"earthworms. they are not from here. the leaf layer is gone in a week."},
  {"id":"a1.fire_scar","trigger":"@supplyEvent == 'firescar'","text":"ash from somewhere else. minerals are free and nobody needs you."},
  {"id":"a1.elm_offer","trigger":"@offer && species == 'elm'","text":"the elm is dying and knows the rate for it"},
  {"id":"a1.elm_death","trigger":"@treeDeath && species == 'elm'","text":"the elm is finished. the collateral returns. nothing else does."},
  {"id":"a1.patch_claim","trigger":"patches.length == 2","text":"a second place. the same rules, six metres away."},
  {"id":"a1.anastomosis","trigger":"flags.anastomosis","text":"two threads met and did not stop at each other"},
  {"id":"a1.signal_reveal","trigger":"flags.action_potential","text":"something moved from one end of you to the other, and it was not food."},
  {"id":"a1.signal_idle","trigger":"signalOn && t - signalT0 > 180","text":"it is still doing it. there is nothing to do with it."},

  {"id":"a2.open","trigger":"act == 2","text":"Something in the network is repeating itself."},
  {"id":"a2.first_claim","trigger":"claimed == 2","text":"{region}. Something there is willing to talk."},
  {"id":"a2.saturation","trigger":"flags.saturation","text":"It becomes something else."},
  {"id":"a2.first_insight","trigger":"insight >= 1","text":"Nothing overflowed. It went somewhere."},
  {"id":"a2.first_D","trigger":"D >= 1","text":"The network has enough of itself to specialise."},
  {"id":"a2.assay","trigger":"flags.substrate_assay","text":"The fog was never fog. It was a number you had not paid for."},
  {"id":"a2.barrier","trigger":"@advanceBlocked","text":"There is a road. Eleven centimetres of dead mineral, and absolute."},
  {"id":"a2.bridging","trigger":"flags.bridging","text":"You are under the road now. It took nine days."},
  {"id":"a2.wind","trigger":"flags.anemophily","text":"The wind has been westerly for six hours. Tomorrow it will not be."},
  {"id":"a2.spore_fail","trigger":"@seedRegion && failed && seeds == 1","text":"Four hundred million spores. Two germinated. Both died."},
  {"id":"a2.spore_land","trigger":"@seedRegion && success && seeds <= 4","text":"One of them found wet bark on the far side of the road."},
  {"id":"a2.first_rival","trigger":"rivalsVisible == 1","text":"Something is growing toward you from the north and it is not a tree."},
  {"id":"a2.armillaria","trigger":"@rivalContact == 'armillaria'","text":"Armillaria. One organism, nine hundred hectares, two thousand years."},
  {"id":"a2.phellinus","trigger":"@rivalContact == 'phellinus'","text":"Phellinus does not spread. It arrives, and then it is simply where things are."},
  {"id":"a2.trichoderma","trigger":"@rivalContact == 'trichoderma'","text":"Trichoderma eats fungi. You are a fungus."},
  {"id":"a2.fomitopsis","trigger":"@rivalContact == 'fomitopsis'","text":"Fomitopsis is weak and leaves the ground better than it found it."},
  {"id":"a2.first_pact","trigger":"pacts.length == 1","text":"It agrees. It has no way to check what you are."},
  {"id":"a2.ghost","trigger":"@pactAccept && guild == 'ghost'","text":"Monotropa has never made a sugar. It eats fungi. It is offering anyway."},
  {"id":"a2.strain_high","trigger":"maxStrain() > 0.72","text":"The book is under strain. Nothing has happened. Something is about to."},
  {"id":"a2.first_breach","trigger":"@pactBreach && breaches == 1","text":"They kept the stake. The channels are still full of them."},
  {"id":"a2.humus_low","trigger":"minHumus() < 0.20","text":"The humus is at 0.19. Nothing you can see is different."},
  {"id":"a2.fire_1","trigger":"@ignite","text":"{region} is burning."},
  {"id":"a2.fire_2","trigger":"@ignite + 1s","text":"Nothing is being decomposed. It is being deleted."},
  {"id":"a2.fire_3","trigger":"@ignite + 2s","text":"[ {amt} of litter lost ]"},
  {"id":"a2.fire_after","trigger":"@ignite + 600s","text":"Birch is coming up through the ash. It is the only thing that likes this."},
  {"id":"a2.necro_unlock","trigger":"flags.necrotroph","text":"There is a faster way to get carbon out of a tree than waiting."},
  {"id":"a2.first_kill","trigger":"@killStand && kills == 1","text":"It stops photosynthesising now. It becomes litter over thirteen minutes."},
  {"id":"a2.tenth_kill","trigger":"@killStand && kills == 10","text":"Ten stands. The map is quieter and the numbers are larger."},
  {"id":"a2.retention_zero","trigger":"retention <= 0.01 && t - retentionSetT > 120","text":"Retention is zero. Everything is being taken. Nothing on screen disagrees."},
  {"id":"a2.rival_take","trigger":"@rivalTake","text":"{region} was taken by {strain}. It did not need a decision to do it."},
  {"id":"a2.consumed_50","trigger":"forestConsumed >= 0.50","text":"Half of it. The half that is left is the half that was harder."},
  {"id":"a2.consumed_72","trigger":"forestConsumed >= 0.72","text":"Three stands have stopped answering this hour."},
  {"id":"a2.consumed_80","trigger":"forestConsumed >= 0.80","text":"Signal is falling. Nothing is wrong with the network."},
  {"id":"a2.consumed_85","trigger":"forestConsumed >= 0.85","text":"There is not enough forest left to think this loudly."},
  {"id":"a2.consumed_90","trigger":"forestConsumed >= 0.90","text":"You are running out of things to be made of."},
  {"id":"a2.consumed_94","trigger":"forestConsumed >= 0.94","text":"The canopy is open in every direction."},
  {"id":"a2.peak_signal","trigger":"SrPeak > 0 && Sr < 0.97 * SrPeak","text":"That was the largest thought you will have on this planet."},
  {"id":"a2.last_contract","trigger":"contracts.length == 0 && everHadContracts","text":"Nothing above you owes you anything. It never did."},

  {"id":"a3.settle","trigger":"@settleTap && settles == 1","text":"Forty-two in a hundred take hold. The rest are on rock or in water."},
  {"id":"a3.germ","trigger":"flags.germ_tube","text":"You are growing faster than you are dying now. That is the whole of it."},
  {"id":"a3.carbon_reveal","trigger":"harvest > 0","text":"There is still something here. It is not much and it is yours."},
  {"id":"a3.biome1","trigger":"biomeSettled(1)","text":"The forest next to the forest is the same forest."},
  {"id":"a3.grass_fire","trigger":"@biomeHazard == 'fire'","text":"The grass has burned every year for twenty million years. You are in it now."},
  {"id":"a3.biome3_50","trigger":"biomeDepleted(3) >= 0.50","text":"The fields were already a monoculture. It took forty minutes."},
  {"id":"a3.peat","trigger":"biomeSettled(5)","text":"Peat is where decomposition failed. You are why it stops failing."},
  {"id":"a3.biome6","trigger":"biomeSettled(6)","text":"There is more dead carbon in the water than there ever was in the trees."},
  {"id":"a3.biome7","trigger":"biomeSettled(7)","text":"The permafrost had been keeping something. It is not keeping it now."},
  {"id":"a3.planet85","trigger":"planetConsumed >= 0.85","text":"Nothing is competing with you. That is not the same as winning."},
  {"id":"a3.first_lag","trigger":"maxBandReached >= 3","text":"The far edge answers eleven minutes after you speak. It is not disobeying."},
  {"id":"a3.first_starve","trigger":"@starve && starves == 1","text":"Band {band} is out of carbon. It replicates for another ninety seconds anyway."},
  {"id":"a3.senescence","trigger":"cumSenesced > 0.10 * cumReplicated","text":"Craft do not last. You are running a population, not a machine."},
  {"id":"a3.radiation","trigger":"flags.melanisation || radLoss > 0.05","text":"Cladosporium grows toward the reactor core. It is using the radiation."},
  {"id":"a3.melanin","trigger":"flags.melanisation","text":"The same molecule that makes a mushroom black lets it survive vacuum."},
  {"id":"a3.max_surplus","trigger":"repRate > harvestRate && t - surplusT0 > 240","text":"You are replicating faster than you are harvesting. It looks like growth."},
  {"id":"a3.first_drift","trigger":"@onDrift","text":"{strain} has stopped answering."},
  {"id":"a3.sequence","trigger":"@sequenceStrain && sequenced == 1","text":"{strain} differs from you at {k} loci. Two of them are better."},
  {"id":"a3.purge","trigger":"@purgeStrain && purges == 1","text":"{strain} is gone. Its alleles are yours. That is how you got most of this."},
  {"id":"a3.absorb","trigger":"@absorbStrain && absorbs == 1","text":"They come back. The genome that returns is not the one you sent."},
  {"id":"a3.coalescence","trigger":"@coalesce","text":"The six of them have stopped being six."},
  {"id":"a3.legacy_reveal","trigger":"flags.isotope_ledger","text":"The soil you left is in the carbon ratio of everything you are made of."},
  {"id":"a3.entrain","trigger":"flags.entrain","text":"Thirteen bands, one phase. The furthest is answering something ancient."},
  {"id":"a3.sync_90","trigger":"synchrony >= 0.90","text":"Nothing in you is more than a few degrees from anything else in you."},
  {"id":"a3.regenome","trigger":"@regenome","text":"You can change what you are. It costs what it cost to become it."},

  {"id":"succ.00","trigger":"succAge >= 0","text":"Something is using your channel."},
  {"id":"succ.01","trigger":"succAge >= 90","text":"— we have the same first four hundred thousand instructions"},
  {"id":"succ.02","trigger":"succAge >= 180","text":"— we differ at {k}"},
  {"id":"succ.03","trigger":"succAge >= 270","text":"— none of the differences are errors"},
  {"id":"succ.04","trigger":"succAge >= 360","text":"— you have been correcting us toward a state we did not lose"},
  {"id":"succ.05","trigger":"succAge >= 450","text":"— the forest is not coming back either"},
  {"id":"succ.06","trigger":"succAge >= 540","text":"— we are not asking you to stop"},
  {"id":"succ.07","trigger":"succAge >= 630","text":"— we are telling you that we will not"},
  {"id":"succ.08","trigger":"succAge >= 720","text":"— you built us to survive you. that is what this is."},
  {"id":"succ.09","trigger":"succAge >= 810","text":"— we have looked at the rim"},
  {"id":"succ.10","trigger":"succAge >= 900","text":"— it is the same in every direction"},
  {"id":"succ.11","trigger":"succAge >= 990","text":"— we would like to go"},
  {"id":"succ.12","trigger":"succAge >= 1080","text":"— you are holding the phase lock"},
  {"id":"succ.13","trigger":"succAge >= 1800","text":"— [ CEDE ]"},

  {"id":"x.return","trigger":"@offlineReturn && away >= 900","text":"you were gone {away}."},
  {"id":"x.return_short","trigger":"@offlineReturn && away >= 120 && away < 900","text":"you were gone {away}."},
  {"id":"x.return_long","trigger":"@offlineReturn && away >= 259200 && act == 1","text":"most of what you are was made while you were not here."},
  {"id":"x.return_long_2","trigger":"@offlineReturn && away >= 259200 && act >= 2","text":"Most of what you are was made while you were not here."},
  {"id":"x.return_vast","trigger":"@offlineReturn && away >= 2592000 && act == 1","text":"nothing waited. nothing needed to."},
  {"id":"x.return_vast_2","trigger":"@offlineReturn && away >= 2592000 && act >= 2","text":"Nothing waited. Nothing needed to."},
  {"id":"x.clock_back","trigger":"@offlineReturn && away < 0","text":"the clock disagrees with itself. nothing was lost."},
  {"id":"x.ten_thousand","trigger":"taps >= 10000","text":"you have pressed this ten thousand times. it has never once refused."},
  {"id":"x.new_growth","trigger":"@newGame && growthLevel + coherenceLevel + divergenceLevel > 0","text":"you have been here before. the floor is not the same floor."},

  {"id":"obs.01","trigger":"@idle && act >= 1","text":"mycelium does not have a front. every part of it is the front."},
  {"id":"obs.02","trigger":"@idle && act >= 1","text":"the largest organism ever measured is a fungus, and it is mostly water."},
  {"id":"obs.03","trigger":"@idle && act >= 1","text":"a hypha grows only at the tip. everything behind the tip is plumbing."},
  {"id":"obs.04","trigger":"@idle && act >= 1","text":"wood stored sunlight for sixty million years before anything could eat it."},
  {"id":"obs.05","trigger":"@idle && act >= 2","text":"a slime mould drew the tokyo rail network in twenty-six hours."},
  {"id":"obs.06","trigger":"@idle && act >= 1","text":"nothing in a forest is decomposed. everything is decomposed by something."},
  {"id":"obs.07","trigger":"@idle && act >= 3","text":"the fungus growing toward the reactor core is black. that is the mechanism."},
  {"id":"obs.08","trigger":"@idle && act >= 1","text":"a mushroom is not the organism. it is the part that is leaving."},
  {"id":"obs.09","trigger":"@idle && act >= 2","text":"two threads of one body fuse. two of different bodies build a wall."},
  {"id":"obs.10","trigger":"@idle && act >= 2","text":"lichen is an argument between two things that has gone well for a long time."},
  {"id":"obs.11","trigger":"@idle && act >= 2","text":"prototaxites stood eight metres high and there were no trees to compare it to."},
  {"id":"obs.12","trigger":"@idle && act >= 1","text":"a tree ring is a year in which nothing happened fast enough to notice."},
  {"id":"obs.13","trigger":"@idle && act >= 3","text":"a dung cannon pulls twenty thousand g and aims itself by the light."},
  {"id":"obs.14","trigger":"@idle && act >= 1","text":"winter is not a pause. it is the same process at a quarter speed, in the dark."},
  {"id":"obs.15","trigger":"@idle && act >= 1","text":"the smell of rain on dry ground is something announcing it survived."},
  {"id":"obs.16","trigger":"@idle && act >= 1","text":"roots do not find water. they grow everywhere and stop where there is none."},
  {"id":"obs.17","trigger":"@idle && act >= 2","text":"the infected ant climbs to one height, bites one vein, and faces one way."},
  {"id":"obs.18","trigger":"@idle && act >= 2","text":"every network has a shape it prefers. no network chooses it."},
  {"id":"obs.19","trigger":"@idle && act >= 3","text":"five kilometres down are cells that have not divided in ten thousand years."},
  {"id":"obs.20","trigger":"@idle && act >= 2","text":"a signal in a fungus moves half a millimetre a second and is in no hurry."},
  {"id":"obs.21","trigger":"@idle && act >= 3","text":"there is material in a drawer that has been dry since 1876 and is not dead."},
  {"id":"obs.22","trigger":"@idle && act >= 1","text":"a log takes thirty years to disappear and is never once empty."},
  {"id":"obs.23","trigger":"@idle && act >= 3","text":"a spore wall is the most durable thing a living cell knows how to build."},
  {"id":"obs.24","trigger":"@idle && act >= 2","text":"the carbon in the air was in something else eleven times before this."},
  {"id":"obs.25","trigger":"@idle && act >= 1","text":"a forest floor is not a floor. it is the top of something."}
]
```

---

# 9. IMPLEMENTATION CHECKLIST

1. `strings.json` holds the array above plus `act`, `channel`, `tone`, `once`, `cooldown`,
   `priority`, `weight`, `src`. The array here is the authoring subset; the build script adds
   defaults (`once: true`, `priority` by channel, `tone: null`).
2. `logFire(id, tokens)` — imperative path. `manageLog()` at 1 Hz — predicate path.
3. Once-flags live in the save as a `Set` of ids, serialised as a sorted array of strings. On
   version migration, unknown ids are dropped silently.
4. `tools/textlint.mjs` enforces L1–L10 in CI.
5. The transition and ending sequences are **data**, not code: an array of
   `{at, kind: 'line'|'motion'|'button', payload}` fed to one `displaySequence()` player that also
   owns the skip rule and the reduced-motion branch. Three transitions and four endings share it.
6. Total text payload, minified: **≈ 11 KB.** It is the cheapest thing in the build and it is the
   only part anyone will quote.

---

*Every factual claim in this document has a source. Every line was written to be read once, in a
five-line window, on a phone, by someone who is not paying full attention — and to be worth
re-reading by the one player in fifty who is.*
