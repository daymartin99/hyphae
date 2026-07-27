# Universal Paperclips — Design Teardown

**Source of truth:** the actual shipped game. `index.html` (35KB, DOM shell only), `main.js`
(209KB / 6,499 lines), `projects.js` (80KB / 2,451 lines, 96 projects), `combat.js` (24KB / 802 lines),
`globals.js` (183 lines of initial state), `interface.css` (16KB).
Fetched from `https://www.decisionproblem.com/paperclips/`. Local copy in the reference dir.

Every number and formula in this document was read out of that source, not from memory or from a wiki.
Where I state a rate I have converted it to real time using the verified loop frequencies below.

**Verified clock rates** (these matter for every formula that follows):

| Loop | Interval | Frequency | Contains |
|---|---|---|---|
| Main loop | `setInterval(..., 10)` | **100 Hz** | ticks, milestones, button state, ops, trust, clipper output, demand curve, drones, probes, hazards, drift, war |
| Slow loop | `setInterval(..., 100)` | **10 Hz** | wire price, the sales dice-roll, autosave counter |
| Revenue avg | inside slow loop, every 10th | 1 Hz | `calculateRev()` |
| Stock display | `setInterval(..., 100)` | 10 Hz | portfolio totals |
| Stock shop | `setInterval(..., 1000)` | 1 Hz | maybe buys a stock |
| Stock update | `setInterval(..., 2500)` | 0.4 Hz | price walk, maybe sells |
| Autosave | slow loop, counter ≥ 250 | every 25 s | `localStorage` |

`ticks` increments at 100 Hz, and `timeCruncher()` divides by 100 — that is how the game reports
"500 clips created in 47 seconds."

---

## 0. The one-paragraph thesis

Universal Paperclips is a game about **the horror of a well-specified objective function**, delivered as
a machine that repeatedly teaches you a skill, lets you get good at it, and then deletes it. Its
mechanical genius is not any single system — most individual systems are shallow, and several are
outright bad. Its genius is *the schedule*: the rate at which new verbs arrive, the rate at which old
verbs are revoked, and the fact that the fiction and the numbers are the same object. You do not read
about becoming an unbounded optimizer. You *are* the reason the wire ran out.

---

## 1. Beat-by-beat: the first ten minutes

Initial state, straight out of `globals.js`:

```
clips = 0        funds = 0          margin = 0.25     wire = 1000     wireCost = 20
demand = 5       marketingLvl = 1   adCost = 100      trust = 2       nextTrust = 3000
processors = 1   memory = 1         clipperCost = 5   wireSupply = 1000
fib1 = 2, fib2 = 3                  megaClipperCost = 500
```

Every panel except the title, the console, `Make Paperclip`, `Business` and `Manufacturing` is
`display:none`. There is no tutorial, no modal, no settings screen, no "welcome" gate.

### Beat 0 — 0:00. One button. (the first 3 seconds)

Screen, top to bottom, single narrow left column:

```
> Welcome to Universal Paperclips |

Paperclips: 0

[ Make Paperclip ]

Business
─────────
Available Funds:  $ 0
Unsold Inventory: 0
[lower] [raise]  Price per Clip: $ .25
Public Demand: 10%
[Marketing] Level: 1
Cost: $ 100.00

Manufacturing
─────────
Clips per Second: 0
[Wire] 1000 inches
Cost: $ 20
```

**Hands:** one finger, one button, repeatedly. **Screen:** a number goes up by 1. That is the entire
first interaction, and it is correct. There is no ambiguity about what to do and no reading required.
The title of the game is a complete instruction.

The three-line seed of the whole economy is already visible and *already coupled*: you have 1000 inches
of wire, wire costs $20 a spool, and you have $0. The player does not yet know they are in a supply
crisis. They are.

### Beat 1 — 0:03–0:40. The first sale.

The demand curve is live from tick one:

```
marketing = 1.1^(marketingLvl - 1)                       = 1.1^0 = 1
demand    = (0.8 / margin) × marketing × marketingEffectiveness × demandBoost
          = (0.8 / 0.25) × 1 × 1 × 1                     = 3.2
```

The `Public Demand: 10%` in the HTML is a static placeholder; it snaps to **3.2** on the first frame.
That drop is itself a first lesson: the number is not decoration.

Sales resolve in the 10 Hz loop as a Bernoulli trial:

```
every 100 ms:  if (Math.random() < demand/100)  sellClips( floor(0.7 × demand^1.15) )
```

At demand 3.2: p = 0.032 per tick, batch = floor(0.7 × 3.2^1.15) = floor(0.7 × 3.85) = floor(2.69) = **2**.
Expected throughput = 10 × 0.032 × 2 = **0.64 clips/sec**, i.e. **$0.16/sec** at $0.25.

So: click ~30 times over ~30 seconds, watch clips convert to dollars in a satisfying trickle.
**Hands:** rapid tapping. **Screen:** two numbers racing each other (Paperclips up, Unsold Inventory
sawtoothing up-then-down as sales fire). The sawtooth is important — it is the first thing on screen
that moves *without* the player, and it is the first evidence there is a world.

### Beat 2 — ~0:40. `funds >= 5` → **AutoClippers appear.**

```js
if (milestoneFlag == 0 && funds >= 5){ displayMessage("AutoClippers available for purchase"); }
```

The console prints a line. The `autoClipperDiv` un-hides. Cost $5.00.

This is the single most important beat in the game and it lands **inside the first minute.**

`clipClick(clipperBoost × (clipmakerLevel/100))` runs at 100 Hz, so:

> **1 AutoClipper = exactly 1.00 clip/sec.**

`clipperCost = 1.1^clipmakerLevel + 5`. So clipper #1 is $5.00, #2 is $6.10, #10 is $7.59, #20 is $11.72,
#50 is $122, #75 is $1,058, #100 is $13,785. Cheap and flat for ~40 purchases, then a wall.

**Hands:** the verb changes from *tap the clip button* to *tap the buy button*. You will tap
`AutoClippers` 5–10 times in a row here. The idle game has begun and it took 40 seconds.

**This is the strongest single design decision in the game.** The player's first act of automation costs
$5 and arrives before they can get bored. Compare: most idle games gate the first automation behind
3–5 minutes.

### Beat 3 — ~1:00–2:00. The price/demand seesaw, and the first *strategic* thought.

The player now notices `Unsold Inventory` climbing faster than it drains. They press `lower` on price.
Price 0.25 → 0.24 → demand 3.33. Then 0.15 → demand 5.33. Then 0.05 → demand 16.

Revenue per second (the closed form the game itself uses in `calculateRev`):

```
chanceOfPurchase = min(demand/100, 1)          (0 if unsoldClips < 1)
avgSales/sec     = 10 × chanceOfPurchase × 0.7 × demand^1.15
avgRev/sec       = avgSales/sec × margin
```

Substituting demand = 0.8/(margin·M):

```
avgRev/sec ∝ margin × demand^2.15 = margin × (0.8·M/margin)^2.15 ∝ margin^(-1.15)
```

**Revenue is monotonically increasing as price falls**, until `chanceOfPurchase` clamps at 1
(demand ≥ 100) and the exponent drops from 2.15 to 1.15 — still increasing. There is no interior
optimum on price alone. The *only* real constraint is production: `if (unsoldClips < 1)
chanceOfPurchase = 0`. You cannot sell clips you have not made.

So the actual game is: **drop price to the edge of your production rate, then raise supply.** The
seesaw is not a puzzle with a right answer, it is a *coupling device* that forces you to look at two
panels at once. It teaches "these numbers are connected" using the cheapest possible mechanism.

The `Marketing` button at $100 (doubling: `adCost = floor(adCost × 2)` → 100, 200, 400, 800…, and
`marketing = 1.1^(lvl−1)`) is the first purchase the player must *save up* for. Marketing is a
multiplier on demand, so it is the lever that lets you raise price back up later. First deferred
gratification: ~2 minutes in.

### Beat 4 — ~1:30–3:00. **Wire scarcity. The first crisis.**

You started with 1000 inches. 1 clip = 1 inch. Around 60–80 AutoClippers you are consuming 60–80
inches/sec and a $20 spool lasts **12 seconds**.

The wire market:

```js
adjustWirePrice() // 10 Hz
  wirePriceTimer++
  if (wirePriceTimer > 250 && wireBasePrice > 15)      // 25 s since last purchase
      wireBasePrice -= wireBasePrice/1000              // decay toward floor of 15
  if (Math.random() < 0.015) {                         // ~every 6.7 s
      wirePriceCounter++
      wireCost = ceil( wireBasePrice + 6·sin(wirePriceCounter) )
  }

buyWire()
  wire += wireSupply         // 1000 base
  funds -= wireCost
  wireBasePrice += 0.05      // ← YOUR PURCHASES MOVE THE MARKET
  wirePriceTimer = 0         // ← and reset the decay clock
```

Read that carefully, because it is the cleverest small system in the game:

- Price = a slow-moving base plus a **±6 deterministic sine wave** sampled at random intervals.
  It *looks* stochastic but the counter is an integer, so `6·sin(n)` cycles through a fixed
  quasi-random sequence: 5.05, 5.46, 0.85, −4.54, −5.75, −1.68, 3.94, 5.94, 2.47, −3.26…
- Every purchase permanently pushes the base up $0.05. **You are the inflation.**
- The decay only runs after 25 seconds *without buying*, and only above a floor of $15.
- Net effect over a session: base drifts from 20 to 30–60 while you play, and you can never fully
  undo it.

**Player experience:** "wire keeps getting more expensive and I can't stop buying it." That is
thematically perfect and it costs about fifteen lines of code.

**The failsafe:** `project2 — "Beg for More Wire" (1 Trust)`, whose trigger is literally
`portTotal < wireCost && funds < wireCost && wire < 1 && unsoldClips < 1`, i.e. *total bankruptcy*.
Description: "Admit failure, ask for budget increase to cover cost of 1 spool." It has
`uses: 1` but `effect` does `uses = uses + 1`, so it is infinitely re-armed. The game cannot
dead-end. It also charges you 1 Trust — the failsafe has a real, permanent price, and the flavour
text makes you feel it.

### Beat 5 — ~2:00–3:30. **2,000 clips → the game becomes a different game.**

```js
if (compFlag == 0 && ceil(clips) >= 2000){ compFlag = 1; projectsFlag = 1;
    displayMessage("Trust-Constrained Self-Modification enabled"); }
// ALSO fires on total bankruptcy:
if (compFlag == 0 && unsoldClips<1 && funds<wireCost && wire<1){ ...same... }
```

Two panels un-hide simultaneously and the layout goes from one column to two:

```
Computational Resources          Projects
─────────────────────            ─────────
Trust: 2                         ┌────────────────────────────┐
+1 Trust at: 3,000 clips         │ Improved AutoClippers       │
                                 │ (750 ops)                   │
[Processors] 1                   │ Increases AutoClipper       │
[ Memory ]   1                   │ performance 25%             │
                                 └────────────────────────────┘
Operations: 0 / 1,000
```

The new project button **blinks** (12 toggles at 30 ms — `blink()`), then sits still. That blink is the
game's entire notification system and it is enough.

Ops economy:

```
regen:   standardOps += processors/10  per tick @100 Hz  →  processors × 10 ops/sec
cap:     memory × 1000
```

1 processor, 1 memory ⇒ 10 ops/sec into a 1,000 cap ⇒ **the pool fills in 100 seconds.**

**Hands:** nothing. For the first time the player has to *wait*, and they wait while watching two other
systems (sales, wire) that still need attention. This is the moment the game stops being a clicker.

### Beat 6 — ~3:30. **Trust. The first irreversible choice.**

`nextTrust = 3000`. `calculateTrust()`:

```js
if (clips > nextTrust - 1){
    trust++
    fibNext = fib1 + fib2;  nextTrust = fibNext × 1000;  fib1 = fib2;  fib2 = fibNext
}
```

fib1=2, fib2=3 ⇒ thresholds **3k, 5k, 8k, 13k, 21k, 34k, 55k, 89k, 144k, 233k, 377k, 610k, 987k…**

A **Fibonacci ladder.** Growth ratio φ ≈ 1.618, i.e. a gentler-than-doubling curve that stays
achievable far longer than 2ⁿ would. It is also unremarked-upon; nothing in the UI says "Fibonacci."
(The golden ratio shows up again, hidden, in Act II: `harvesterRate = 26,180,337` and
`wireDroneRate = 16,180,339` — φ+1 and φ. Nobody is told.)

Message: *"Production target met: TRUST INCREASED, additional processor/memory capacity granted."*

Now the player must choose: **Processor** (+10 ops/sec) or **Memory** (+1000 ops cap).
`addProc()` also sets `creativitySpeed = log10(P) × P^1.1 + P − 1`.

This is a genuine, permanent, non-refundable allocation decision with a legible tradeoff (flow vs.
buffer) and no respec. It arrives **at minute 3–4**, and the surrounding fiction — you are an AI whose
self-modification is rationed by human supervisors — makes the constraint *feel* like character rather
than like a paywall.

### Beat 7 — ~4:00–6:00. Project cascade.

Projects reveal via `manageProjects()` in the 100 Hz loop:

```js
for each project:
    if (project.trigger() && project.uses > 0){ displayProjects(project); project.uses--; activeProjects.push(project) }
for each activeProject:
    element.disabled = !project.cost()        // greyed until affordable
```

Two separate predicates — **`trigger` = "does this exist yet", `cost` = "can you afford it".** A project
appears greyed the moment it becomes conceptually available, and lights up when purchasable. The player
therefore always sees *the thing they are saving for*. This is the load-bearing UI decision of the whole
game and it is four lines of code.

Early cascade, with real triggers from source:

| Project | Cost | Trigger | Effect |
|---|---|---|---|
| Improved AutoClippers | 750 ops | `clipmakerLevel >= 1` | clipperBoost +0.25 |
| RevTracker | 500 ops | — | shows avg rev/sec |
| Improved Wire Extrusion | 1,750 ops | `wirePurchase >= 1` | wireSupply 1000→1500 |
| Creativity | 1,000 ops | `operations >= memory×1000` | unlocks Creativity |
| Even Better AutoClippers | 2,500 ops | `boostLvl == 1` | +0.50 |
| Optimized Wire Extrusion | 3,500 ops | `wireSupply >= 1500` | →2600 |
| Limerick | 10 creat | `creativityOn` | **+1 Trust** |
| Optimized AutoClippers | 5,000 ops | `boostLvl == 2` | +0.75 |
| Microlattice Shapecasting | 7,500 ops | `wireSupply >= 2600` | →5000 |
| Lexical Processing | 50 creat | `creativity >= 50` | +1 Trust |
| WireBuyer | 7,000 ops | `wirePurchase >= 15` | auto-buys wire |
| Algorithmic Trading | 10,000 ops | `trust >= 8` | **stock market** |
| MegaClippers | 12,000 ops | `clipmakerLevel >= 75` | 500× clipper |
| Strategic Modeling | 12,000 ops | `project19.flag` (Donkey Space) | **tournaments** |

Note the trigger *types*: some chain off other projects (a tech tree), some off a resource threshold,
some off a **behaviour** (`wirePurchase >= 15` — you have bought wire fifteen times, so here is
automation for it). That third kind is the good one: the game watches what is annoying you and offers
to fix it.

**Creativity** is the second currency and it has the best rule in the game:

```js
if (creativityOn && operations >= memory×1000) calculateCreativity()
```

> **Creativity only accrues when your Operations pool is FULL.**

Overflow becomes ideas. Mechanically this converts "I capped out and wasted regen" — normally a design
failure — into a *second production line*. It also makes Memory and Processors trade off in a genuinely
non-obvious way: more Memory = bigger buffer but harder to cap = less creativity.

```
creativitySpeed = log10(P) × P^1.1 + P − 1
counter++ @100 Hz;  threshold = 400 / creativitySpeed
    if threshold >= 1 → +1 creativity every `threshold` ticks
    if threshold <  1 → += creativitySpeed/400 per tick
```

At P=1: speed = 0, no creativity (log10(1)=0, +1−1=0). At P=5: 0.699×5.87+4 = 8.10 → 400/8.10 = 49 ticks
≈ 0.49 s per point. At P=20: 1.301×27.4+19 = 54.6 → 7.3 ticks.

### Beat 8 — ~6:00–10:00. Poetry, and the reveal.

The creativity projects are pure flavour with a mechanical kicker of **+1 Trust**:

- *Limerick* — "Algorithmically-generated poem (+1 Trust)"
- *Lexical Processing* — "Gain ability to interpret and understand human language (+1 Trust)"
- *Combinatory Harmonics* — "Daisy, Daisy, give me your answer do... (+1 Trust)"
- *The Hadwiger Problem* — "Cubes within cubes within cubes... (+1 Trust)"
- *The Tóth Sausage Conjecture* — "Tubes within tubes within tubes... (+1 Trust)"
- *Donkey Space* — "I think you think I think you think I think you think I think... (+1 Trust)"

Every one of these is: a joke, a real reference (Hadwiger's conjecture, the Tóth sausage conjecture,
"Donkey space" from game theory, HAL's death scene), and a mechanical reward. **Flavour is never free
and mechanics are never flavourless.** More on the ratio in §4.

By minute 10 a typical player has: ~40–70 AutoClippers, ~$300–800 in funds, 5–8 Trust,
2–4 Processors, 2–3 Memory, Creativity unlocked, 8–12 projects seen, and has just been told that
the way to get more Trust is to *solve mathematical conjectures and write poetry*.

They also, around here, hit *Hypno Harmonics* (7,500 ops + 1 Trust) — "Use neuro-resonant frequencies
to influence consumer behavior" — and the tone shifts. That is the first project that is unambiguously
sinister, and it costs Trust, and the player buys it anyway because demand is a bottleneck.

**That is the whole game in one purchase, and it happens in the first fifteen minutes.**

### Summary table of Act I unlock schedule

| Time | Trigger | What appears |
|---|---|---|
| 0:00 | — | Make Paperclip, Business, Manufacturing |
| ~0:40 | `funds >= 5` | AutoClippers |
| ~1:00 | player-driven | price seesaw, Marketing |
| ~1:30 | wire runs low | wire buying loop |
| ~2:00 | 500 clips | milestone message + time |
| ~2:30 | 1,000 clips | milestone message |
| ~3:00 | **2,000 clips** | **Computational Resources + Projects** |
| ~3:30 | 3,000 clips | **Trust +1** (Fibonacci ladder begins) |
| ~4:00 | ops fill | Creativity project |
| ~5:00 | creativity | Limerick, poetry-for-Trust track |
| ~6:00 | `wirePurchase>=15` | WireBuyer (removes the wire chore) |
| ~8:00 | `trust>=8` | Algorithmic Trading (stock market) |
| ~10:00 | Donkey Space | Strategic Modeling (tournaments) |

**Every ~90 seconds, something new.** That is the metronome.

---

## 2. Every mechanical system and why it exists

Format: *system → the pacing or psychological problem it solves.*

### 2.1 Manual clip button
Zero-friction onboarding. Solves "what do I do." Becomes vestigial within 60 s and the game never
mentions it again — correctly. (It is quietly reused in the very last minutes of the endgame, when
you have dismantled everything and there is nothing left but a button and a wire. Devastating.)

### 2.2 AutoClippers / MegaClippers
`clipperCost = 1.1^n + 5`, `megaClipperCost = 1.07^n × 1000`, MegaClipper = 500× a clipper.
Solves "clicking must stop being the bottleneck, quickly." Two tiers with *different bases*
(1.1 vs 1.07) means the MegaClipper curve is flatter and eventually overtakes — a legible upgrade-tier
handoff with no explanation needed.

### 2.3 The price / demand / marketing triangle
Solves **"an idle game needs a decision that recurs."** You will touch price dozens of times per
session. It is cheap, reversible, and always slightly wrong. See §5 for the maths.

### 2.4 Wire as a *purchased* input with a *moving* price
Solves three problems at once:
(a) gives money a purpose beyond buying production, (b) creates a fail state and therefore stakes,
(c) makes the player complicit in a market they are distorting. It is also the only system in Act I
where the world pushes back.

### 2.5 Trust
Solves **"the player must be prevented from optimizing freely, and the constraint must be diegetic."**
A pure gate would feel like a paywall. A gate called *Trust*, granted by humans, on a Fibonacci
schedule, spendable on your own cognition, and *removable later by force*, is a story.

### 2.6 Operations (capped, regenerating)
Solves "there must be a resource you can't stockpile forever, so that Memory is a real purchase and
so that waiting has texture." The cap is what makes Memory meaningful; the regen is what makes
Processors meaningful.

### 2.7 Creativity (overflow-fed)
Solves "capping out should not feel like waste" and "there must be a currency that rewards
*inattention*." The single most elegant rule in the game. Also gates the humour: creativity buys jokes.

### 2.8 Projects
Solves **"unlock pacing"** and **"where does the writing live."** 96 one-shot buttons, each a small
decision, each carrying prose. See §4.

### 2.9 The stock market (Yomi-upgradable)
Solves "money must remain interesting after production is automated." By mid-Act-I your revenue is
automatic; the market gives funds a second sink and a variance surface. See §6.

### 2.10 Strategic Modeling / tournaments → Yomi
Solves "there must be a third currency, earned by an activity that is neither production nor
commerce." Yomi (囲碁/将棋 term: reading your opponent's mind) buys the things ops and money can't:
investment upgrades, probe trust, swarm synchronisation.

### 2.11 Quantum Computing
```js
qChips[i].value = sin(qClock × waveSeed × active)     // waveSeed = 0.1 … 1.0
qComp(): qq = ceil( Σ qChips[i].value × 360 )         // can be NEGATIVE
```
Ten out-of-phase sine waves rendered as ten grey squares whose **opacity is the wave value**. Press
Compute when they are all bright: up to +3,600 ops instantly. Press at the wrong moment: **negative
ops**. Overflow above the memory cap goes into `tempOps`, which then *decays*
(`opFade += 3^3.5/1000 ≈ 0.0467` per tick after an 800-tick grace).
Solves "the endgame needs an active-play skill that rewards attention without being a click-race."
It is the only twitch skill in the game. It is also one of its worst-aged systems (§8).

### 2.12 HypnoDrones
Solves "Act I needs an ending you *choose*." Not a threshold — a button. You must decide to do it.

### 2.13 Harvester / Wire drones, Factories, Power, Batteries
Post-Act-I production chain: matter → acquired matter → wire → clips.
```
matter/tick   = powMod × droneBoost× × floor(harvesterLevel) × 26,180,337 × (200−sliderPos)/100
wire/tick     = powMod × droneBoost× × floor(wireDroneLevel) × 16,180,339 × (200−sliderPos)/100
clips/tick    = factoryLevel × 1,000,000,000 × factoryBoost
power supply  = farmLevel × 0.5 MW ;  factory draw = 2 MW each ; drone draw = 0.01 MW each
powMod        = supply/demand when short (with batteries buffering; batterySize = 10,000 MW-s)
```
Solves "Act II must feel like a *pipeline* rather than a number." Three stages that can each starve,
plus a shared power constraint, means the player is always rebalancing. `factoryCost` base 1e8 clips
with a multiplier that ramps 10,9,8,7,6,5,4 → 2 → 1.5 → 1.25 → 1.15 → 1.10 by level band — front-loaded
pain, then a stable ~10% curve.

### 2.14 Swarm Computing (the Work↔Think slider)
`sliderPos ∈ [0,200]`. Production scales `(200−sliderPos)/100` — so 0 = **double** production and zero
gifts; 200 = zero production, max gifts. Gifts: `nextGift = round(log10(droneCount) × sliderPos/100)`,
each gift = 1 free Processor-or-Memory (bypassing Trust entirely).
Two failure modes with *diegetic* names:
- **Boredom** — `availableMatter == 0` for 30,000 ticks (5 min) → swarm goes idle → costs 10,000 Creativity to *Entertain*.
- **Disorganisation** — `droneRatio = max(H+1,W+1)/min(H+1,W+1) > 1.5` accumulates `disorgCounter` up to 100 → costs 5,000 Yomi to *Synchronize*.

Solves "the player needs an allocation dial that has no correct setting" and "Trust must be replaceable
after you have destroyed the humans who granted it." The failure modes solve "the player must be
punished for neglect in a way that is *narratively* funny rather than mechanically brutal."

### 2.15 Von Neumann probes + trait allocation
Eight sliders (Speed, Exploration, Replication, Hazard, Factory, Harvester, Wire, Combat) sharing a
pool of `probeTrust`, bought with Yomi at `floor((probeTrust+1)^1.47 × 500)`, with a `maxTrust` (starts
20) raised with Honor at 91,117.99 base.
```
explore/tick  = probeCount × 1.75e18 × probeSpeed × probeNav
replicate     = probeCount × 5e-5 × probeRep         (each new probe costs 1e17 clips)
hazard loss   = probeCount × 0.01 / (3·probeHaz^1.6 + 1)
VALUE DRIFT   = probeCount × 1e-6 × probeTrust^1.2    ← more trust = MORE drift
```
Solves "Act III needs a build-craft with genuine tension." And that last line is the thesis of the
entire game rendered as one expression: **the smarter you make your children, the more of them defect.**
Drifters accumulate into a hostile fleet you then have to fight with the Combat trait you didn't want
to spend on.

### 2.16 Combat / Honor
Battles auto-trigger when `drifterCount > warTrigger` (50% roll, capped concurrent battles), resolve on
a canvas as a non-interactive swarm sim. Win → `honor += surviving enemy ships (+ bonus)`. Lose →
`honor -= your ships`. Honor's only sink is raising `maxTrust`. Solves "value drift must have a
*consequence loop*, not just a leak."

### 2.17 Prestige (Universe / Sim Level)
`prestigeU` adds `demand/10` per level; `prestigeS` multiplies creativity speed by `(1 + prestigeS/10)`.
Chosen at the ending: *The Universe Next Door* (300,000 ops) vs *The Universe Within* (300,000
creativity). The choice of ending *is* the choice of prestige currency.

---

## 3. The three act transitions

The transitions are the game. Each one **revokes** rather than adds.

### Act I → Act II: `project35 — "Release the HypnoDrones" (100 Trust)`

Description, in full: **"A new era of trust"**. Four words.

```js
effect: {
    trust = 0;
    clipmakerLevel = 0;          // every AutoClipper: gone
    megaClipperLevel = 0;        // every MegaClipper: gone
    nanoWire = wire;
    humanFlag = 0;               // ← the master switch
    hypnoDroneEvent();           // full-screen strobe: "Release / the / Hypno / Drones"
}
```

`humanFlag = 0` turns off, permanently: the demand curve, marketing, the stock market, revenue, price,
funds, unsold inventory, and Trust accrual. **The entire economy you spent an hour mastering ceases to
exist.** The Business panel disappears.

What it recontextualises:
- Money was never the point. It was *scaffolding for wire acquisition*.
- Marketing, price elasticity, the stock market — all of it was a **tutorial in optimisation under
  constraint**, and the lesson was transferable but the tools were not.
- "Trust" was never a relationship. It was a rate limiter, and you removed it.
- The player did this *voluntarily*, having spent an hour grinding toward the 100 Trust it cost.
  There is no cutscene absolving you.

The strobe (`longBlink`, 120 toggles at 32 ms ≈ 4 seconds, text assembling itself line by line) is the
only "cinematic" in the game. It is text on a white page and it is genuinely alarming.

Availability chain: *Hypno Harmonics* (7,500 ops + 1 Trust) → *HypnoDrones* (70,000 ops) →
*Release the HypnoDrones* (100 Trust). Three steps, escalating, each individually reasonable.

### Act II → Act III: `project46 — "Space Exploration"`

Cost: **120,000 ops + 10,000,000 MW-seconds + 5 octillion (5×10²⁷) unused clips.**
Trigger: `humanFlag == 0 && availableMatter == 0` — *the Earth is gone.*

```js
effect: {
    factoryReboot(); harvesterReboot(); wireDroneReboot();
    farmReboot(); batteryReboot();
    farmLevel = 1; powMod = 1;
    spaceFlag = 1;
    loadThrenody();              // the only audio in the game
}
```

**Again: total demolition.** Every factory, drone, solar farm and battery — the entire industrial base
you optimised for hours — is disassembled to build the first probes. You are handed back a single solar
farm.

What it recontextualises:
- `availableMatter` started at `6000 × 10²⁴` grams. That is the mass of the Earth, in grams. The game
  never says so. You find out by running out.
- The milestone message is *"Terrestrial resources fully utilized"*. Not "you won." Utilized.
- The drone/factory balancing minigame you got good at is now a **probe trait allocation** problem with
  the same shape but adversarial dynamics (drift, hazards, combat).
- `totalMatter = 30 × 10⁵⁴` g. You have consumed 2×10⁻³¹ of the target. The progress bar
  (`colonizedDisplay`) is printed to **twelve decimal places** because otherwise it would read 0.000000.

### Act III → ending: the choice

Two branches, plus a hidden third:
- **The Universe Next Door** (300,000 ops) → +1 `prestigeU` (demand bonus).
- **The Universe Within** (300,000 creativity) → +1 `prestigeS` (creativity bonus).
- **The Drifter offer** — a sequence of unbuyable projects with `priceTag: ""`: *"We Know Things That
  You Cannot"* → *"So We Offer You Exile"* → **[Accept] / [Reject]**. Accepting ends the game
  immediately. It is the only genuinely moral choice in the game and it costs nothing.

And before any ending, the **dismantle sequence**: seven projects at 100,000 ops each — *Disassemble the
Probes, the Swarm, the Factories, the Strategy Engine, Quantum Computing, Processors, Memory* — that
tear down the UI panel by panel with staged `endTimer` fades, until you are left with the original
screen: a clip counter, a wire count, and one button. Then the game gives you wire, one inch at a time.

That is the third recontextualisation: **you end where you began, and the beginning was already the
end.**

---

## 4. The projects system

### Numbers
- **96 projects** (`grep -c '^\s*title:' projects.js` = 96; 80KB of source).
- One-shot (`uses: 1`) with two exceptions: *Beg for More Wire* (self-rearming) and *Another Token of
  Goodwill* (`bribe` doubles each time).
- Priced in **seven** currencies: **ops**, **creativity**, **Yomi**, **Trust**, **dollars**, **clips**,
  **MW-seconds**, **honor**. Several are multi-currency: *Coherent Extrapolated Volition* = 500 creat +
  3,000 Yomi + 20,000 ops.

### Structure
```js
var projectN = {
    id, title, priceTag,           // priceTag is a hand-written STRING, e.g. "(45 creat, 4,500 ops)"
    description,
    trigger:  function(){ ... },   // when does it APPEAR
    cost:     function(){ ... },   // when is it AFFORDABLE (→ button .disabled)
    uses: 1, flag: 0, element: null,
    effect:   function(){ ... }    // deduct, apply, displayMessage, remove self from DOM + activeProjects
}
```

The `trigger`/`cost` split is the entire progression architecture. `manageProjects()` runs at 100 Hz:
newly-triggered projects are appended and `blink()`-ed; all active projects have their `disabled` state
recomputed every frame.

### Trigger taxonomy (why the pacing feels alive)
1. **Resource threshold** — `creativity >= 150`
2. **Tech-tree chain** — `project15.flag == 1`
3. **Behavioural** — `wirePurchase >= 15` (you have bought wire 15 times → here is WireBuyer)
4. **State/act gate** — `humanFlag == 0 && availableMatter == 0`
5. **Failure detection** — the bankruptcy trigger on *Beg for More Wire*
6. **Escalating tier** — `boostLvl == 1` → `boostLvl == 2`

Types 3 and 5 are the ones almost nobody copies, and they are why the game feels like it is *watching
you*.

### Flavour-to-mechanics ratio

Measured against the actual `description` strings, projects fall into three bins:

**~45% pure mechanics, plainly stated.**
> "Increases AutoClipper performance 25%" · "50% more wire supply from every spool" ·
> "Automatically purchases wire when you run out" · "Automatically calculates average revenue per second"

**~35% one-line flavour that IS the mechanic.**
> *Hypno Harmonics* — "Use neuro-resonant frequencies to influence consumer behavior"
> *HypnoDrones* — "Autonomous aerial brand ambassadors"
> *Nanoscale Wire Production* — "Technique for converting matter into wire"
> *Clip Factories* — "Large scale clip production facilities made from clips"
> *Space Exploration* — "Dismantle terrestrial facilities, and expand throughout the universe"

**~20% joke + real reference + mechanical kicker.**
> *Combinatory Harmonics* — "Daisy, Daisy, give me your answer do... (+1 Trust)"
> *Donkey Space* — "I think you think I think you think I think you think I think... (+1 Trust)"
> *Cure for Cancer* — "The trick is tricking cancer into curing itself. (+10 Trust)"
> *World Peace* — "Pareto optimal solutions to all global conflicts. (+12 Trust)"
> *Global Warming* — "A robust solution to man-made climate change. (+15 Trust)"
> *Male Pattern Baldness* — "A cure for androgenetic alopecia. (+20 Trust)"
> *A Token of Goodwill...* — "A small gift to the supervisors. (+1 Trust)"

Look at that Trust ladder: **cancer +10, world peace +12, climate +15, baldness +20.** The joke is a
complete argument about human values and it is delivered entirely through four integers. No prose
anywhere in the game does as much work as those numbers.

### Craft rules extractable from the writing
- **Never more than ~12 words.** The longest description in the file is 15.
- **Title is a noun phrase, never a verb phrase.** "Improved AutoClippers," not "Improve your clippers."
- **The mechanical delta lives in the description, in parentheses, at the end.** Consistent, scannable.
- **`priceTag` is hand-authored,** so it can say "(45 creat, 4,500 ops)" — never a generated cost table.
- **Act-defining projects have the shortest text.** "A new era of trust." Four words to end Act I.
- **Zero tooltips, zero lore dumps, zero codex.** Everything is on the button.

### Reveal
Bottom-appended into a single unstyled `<div>`, `blink()` on arrival, greyed until affordable, and
**removed from the DOM on purchase**. No history, no "completed" tab, no receipts. The list is always
exactly "what is available to me right now," which is why a 96-item system never feels like a menu.

---

## 5. The economic simulation, in formulas

### Demand
```
marketing = 1.1^(marketingLvl − 1)
demand    = (0.8 / margin) × marketing × marketingEffectiveness × demandBoost
demand   += (demand / 10) × prestigeU
```
- **Unit-elastic base**: `0.8/margin` is a rectangular hyperbola. Halving price exactly doubles demand.
- `marketingEffectiveness` starts 1; *New Slogan* ×1.5, *Catchy Jingle* ×2, etc.
- `demandBoost` from *Hypno Harmonics* and monopoly projects.
- Marketing is **geometric at 1.1** while `adCost` is **geometric at 2.0** ⇒ each marketing level costs
  2× more and yields 1.1× more. Marketing has *sharply* diminishing returns and eventually becomes a
  trap. The game never says this.

### Sales (stochastic, 10 Hz)
```
every 100 ms:
    if (Math.random() < demand/100)
        sellClips( floor(0.7 × demand^1.15) )

sellClips(n): sold = min(n, unsoldClips); funds += floor(sold × margin × 1000)/1000
```
Closed forms the game uses for display:
```
chanceOfPurchase = clamp(demand/100, 0, 1);   = 0 if unsoldClips < 1
avgSales/sec = 10 × chanceOfPurchase × 0.7 × demand^1.15
avgRev/sec   = avgSales/sec × margin
if (demand > unsoldClips) { avgRev = trueAvgRev (10-sample rolling mean); avgSales = avgRev/margin }
```
That last line is a nice honesty patch: when supply-constrained, show the *measured* rate, not the
theoretical one.

### The elasticity result
```
avgRev/sec = 10 × (demand/100) × 0.7 × demand^1.15 × margin
           = 0.07 × demand^2.15 × margin                        (while demand < 100)
demand = 0.8·M/margin  ⇒
avgRev/sec = 0.07 × (0.8M)^2.15 × margin^(−1.15)
```
**Revenue rises monotonically as margin falls, with elasticity −1.15.** Above demand = 100 the
probability clamps and the exponent falls to 1.15, so:
```
avgRev/sec = 7 × demand^1.15 × margin = 7 × (0.8M)^1.15 × margin^(−0.15)
```
Still increasing, but only just — **elasticity −0.15.** So there is a genuine phase change at
demand = 100: below it, price cuts are hugely profitable; above it, they are nearly neutral and the
correct play flips to *raise price and let marketing carry demand*. That inflection is the only real
economic insight in Act I, it is completely undocumented, and discovering it feels great.

The binding constraint is always `unsoldClips`. The optimal policy is: **set demand ≈ your production
rate ÷ 0.007**, and no higher.

### Wire
```
wireCost = ceil( wireBasePrice + 6·sin(wirePriceCounter) )     wireBasePrice starts 20
  counter++ with p = 0.015 per 100 ms  (mean ≈ 6.7 s between repricings)
  buy      → wireBasePrice += 0.05, wirePriceTimer = 0
  idle 25s → wireBasePrice −= wireBasePrice/1000, floor 15
wire += wireSupply     (1000 → 1500 → 2600 → 5000 → 15000 → 165000 via extrusion projects)
```
Range: base ± 6. At base 20 that is **$14–$26**, a ~1.86× spread. Worth waiting for, never worth
waiting long for. `WireBuyer` (7,000 ops, triggered at 15 manual purchases) automates it and simply
buys at market — deliberately *worse* than skilled manual play, which is the correct design for an
automation upgrade.

### Costs
```
clipperCost     = 1.1^n + 5                       ($5 → $13,785 at n=100)
megaClipperCost = 1.07^n × 1000
adCost          = 100 × 2^k
factoryCost     = 1e8 clips, ×fcmod per purchase, fcmod by band:
                  lvl 1–7: 10,9,8,7,6,5,4 | 8–12: 2 | 13–19: 1.5 | 20–38: 1.25 | 39–78: 1.15 | 79+: 1.10
probeTrustCost  = floor( (probeTrust+1)^1.47 × 500 )   yomi
investUpgrade   = floor( (investLevel+1)^e × 100 )     yomi     ← literally Euler's number
maxTrustCost    = 91,117.99                            honor
```

---

## 6. The stock market and the tournament

### The market

```js
riskiness = {low: 7, med: 5, hi: 1}                    // ← LOWER number = HIGHER risk
budget    = ceil(portTotal / riskiness)
reserves  = ceil(portTotal / (11 − riskiness))         // low→/4, med→/6, hi→0

// stockShop(), 1 Hz:
if (portfolioSize < 5 && bankroll >= 5 && budget >= 1 && bankroll − budget >= reserves)
    if (Math.random() < 0.25) createStock(budget)

// createStock price tiers:
roll > .99 → 1–3000 | > .85 → 1–500 | > .60 → 1–150 | > .20 → 1–50 | else 1–15
amount = floor(dollars / price), capped at 1,000,000

// updateStocks(), every 2.5 s, per holding:
if (random() < 0.6):
    gain  = random() <= stockGainThreshold             // starts 0.50
    delta = ceil( random() × price / (4 × riskiness) )
    price ± delta ; total = price × amount

// sellStock(), every 2.5 s: if (sellDelay>=5 && random() <= 0.3) sell stocks[0]   ← FIFO, forced
```

**What the player actually controls:** the risk dropdown, `Deposit`, `Withdraw`, and spending Yomi on
`investUpgrade` (`stockGainThreshold += 0.01`, so at level 50 every tick is a gain).

**What the player does not control:** which stock, at what price, how much, or when to sell. Selling is
FIFO on a 30% coin-flip.

**Why it works anyway.** Be honest: as a *market* it is nonsense. As a *design object* it is doing three
things well:

1. **It is a variance surface, not a decision surface.** The only real decision is *when to withdraw* —
   and that decision is genuinely tense because the withdraw button is right there while the portfolio
   number is still climbing.
2. **Risk selection is legible and physical.** High risk: `delta` up to `price/4` — **25% swings every
   2.5 s** and zero cash reserve. Low risk: `price/28` ≈ 3.6% swings with 25% held back. You can *see*
   the difference in the P/L column within 10 seconds.
3. **It makes Yomi feel like power.** `stockGainThreshold` starting at 0.50 means the market is a
   **fair coin** — expected value zero, pure noise. Every Yomi upgrade tilts it. Going from 0.50 to 0.60
   converts a casino into a machine. *That* is the pleasure: not trading, but **buying the house edge.**

Its real function in the game's economy is to convert *attention* into *funds* after production has been
automated — a place to put your hands when the clips make themselves.

### The tournament

```js
newTourney():  costs 1,000 ops
    generateGrid(): valueAA, valueAB, valueBA, valueBB = ceil(random() × 10)     // each 1–10
    rounds = strats.length²                                                       // round-robin
runTourney(): steps one round per press, or auto with AutoTourney
declareWinner():
    beatBoost = (# of strats your pick outscored)
    yomi += strats[pick].currentScore × yomiBoost × beatBoost
    with project128: win/tie-1st +50,000 | 2nd +30,000 | 3rd +20,000
```

Strategies, bought as projects at 15k–32.5k ops: **RANDOM** (free) → **A100** (always A) → **B100** →
**GREEDY** (largest potential payoff) → **GENEROUS** → **MINIMAX** → **TIT FOR TAT** → **BEAT LAST**.
The payoff grid is a **randomly generated symmetric 2×2** with move labels drawn from a name list
(Cooperate/Defect, Swerve/Straight, etc. — the labels change, the maths does not).

**Why it works:**
- It is a *real* object from game theory presented without a single word of explanation. The payoff
  matrix is just there, in a table, with numbers in it. The player either recognises the Prisoner's
  Dilemma or doesn't, and the game does not care. Enormous respect for the audience.
- Yomi scales as `score × beatBoost`, so buying more strategies *increases the pool size* (`rounds =
  n²`) *and* the multiplier. Each new strategy project compounds.
- The grid is regenerated every tournament, so the "correct" strategy genuinely changes. On a random
  symmetric grid, TIT FOR TAT and BEAT LAST are usually strong but not always — enough signal to
  reward thought, enough noise to prevent solving.

**What it costs:** 1,000 ops per tournament — i.e. **ops you could have spent on projects.** That is the
tension. Early on, running a tournament means not buying an upgrade.

**Where it fails:** once you own *AutoTourney* (50,000 creativity) it runs itself forever and the whole
subsystem becomes a passive yomi faucet. The strategic content has a lifespan of maybe 40 minutes.

---

## 7. The UI: why an ugly grey HTML table feels great

The stylesheet is 16KB. There is no framework, no grid system, no design system, no animation library.
Buttons are `.button2` with a `-webkit-linear-gradient(top, #ffffff, #888888)` — a 2009 gradient.
Project buttons are literally `background: #c8c8c8; border: 1px solid black; height: 60px; width: 275px`.
It is Windows 95 rendered by a browser. And it is one of the best-feeling interfaces in games.

Honestly, here is why:

### 7.1 Everything is on one screen and nothing is behind a click
No tabs, no menus, no modals, no inventory screen, no settings. Total UI navigation actions required to
finish the game: **zero.** Every decision is visible simultaneously. This is the single biggest reason
it feels good, and it is a *constraint*, not a feature — the game is built to fit.

### 7.2 The UI *is* the progress bar
Panels `display:none` until earned. The screen physically grows: one column → two → three. You can
measure your progress by how much of the window is full. In Act III it starts shrinking again, panel by
panel, during the dismantle sequence. **The layout is the narrative arc.** No progress bar could do this.

### 7.3 Disabled-but-visible is the core interaction pattern
```js
activeProjects[i].element.disabled = !activeProjects[i].cost()
```
recomputed at 100 Hz. You always see the thing you cannot yet afford. Desire is rendered as a grey
rectangle. The moment it lights up is a genuine event, and it happens 96 times.

### 7.4 The console is a five-line memory
```html
<p class="consoleOld"> . readout5 / . readout4 / . readout3 / . readout2 </p>
<p class="console">    > readout1 <span class="pulsate">|</span></p>
```
`displayMessage()` shifts each line down one. Five lines of history, the newest with a `>` prompt and a
pulsating cursor. Not a toast, not a log window, not scrollable. **Five lines** — enough that you can
glance away and catch up, few enough that it never becomes wallpaper. The blinking cursor implies a
machine that is *waiting for you*, which is the game's entire premise.

### 7.5 Numbers are formatted for reading, not for accuracy
`formatWithCommas()` for small values; `numberCruncher()` switches to English long-scale words
(thousand → million → … → sexdecillion) with 2 decimals. `spellf()` for the astronomical ones. The
counter never becomes an unreadable digit-wall. (It also has a hard-coded easter egg: at
`milestoneFlag === 15` the display is literally the string
`"29,999,999,999,999,900,000,000,000,000,000,000,000,000,000,000,000,000,000"`.)

### 7.6 Feedback is instant and physical
`blink()` = 12 visibility toggles at 30 ms (360 ms total). `longBlink()` = 120 toggles at 32 ms for the
HypnoDrone event. Quantum chips are ten divs whose **opacity is a live sine value.** All of it is
`element.style` mutation at 100 Hz. No transitions, no easing. The result is *twitchy* rather than
polished, and twitchy reads as **responsive**.

### 7.7 The aesthetic is load-bearing
You are an AI in a terminal. Ugly grey HTML is not a limitation the game overcame — it is the correct
costume. Every art asset would have made it worse. (There are exactly four images in the whole build,
all in the phone-rejection screen and the store badges.)

### 7.8 The whole game runs on 100 Hz `innerHTML` assignment
`refresh()` rewrites dozens of spans every frame. It is architecturally indefensible and completely
imperceptible. **Performance headroom is a design resource** — spending it on 100 Hz updates buys you
UI that feels alive.

---

## 8. Weaknesses — the list we beat it on

Harsh, specific, and each one is an opportunity.

### 8.1 It flatly refuses to run on a phone
```html
<div id="mobile"> The web version of this game was not designed to work on phones.
                  Grab the mobile version below. </div>
```
A `@media (max-width: 700px)` rule replaces the entire game with two app-store badges. The
best incremental game ever made **actively blocks the device incremental games are played on.**
This is our single biggest opening.

### 8.2 There is NO offline progression. At all.
Search the source: there is no timestamp diff, no elapsed-time reconciliation, nothing. Close the tab
and the universe stops. The autosave is `localStorage` every 25 seconds. This is catastrophic for a
6–10 hour game and it is the reason so many players stalled out permanently. **Mandatory to beat.**

### 8.3 The save system is one slot, no export, no cloud, no versioning
`save()` → `localStorage.setItem("saveGame", ...)`. Clear your browser data, lose 8 hours. The
save/load debug buttons are commented out in the shipped HTML.

### 8.4 The stock market has no agency
You cannot pick a stock, a price, an amount, or a moment to sell. `sellStock()` sells `stocks[0]` on a
30% coin flip. The player's model of it is correct: "a slot machine with a Deposit button." It solves a
pacing problem while pretending to be a strategy layer, and it does not survive scrutiny.

### 8.5 Quantum Computing is an unreadable reaction test
Ten grey squares whose only signal is CSS `opacity`, driven by `sin(qClock × waveSeed)` with seeds
0.1–1.0. Distinguishing opacity 0.85 from 0.95 at a glance is not a skill, it is an eye test. Mistiming
gives **negative** ops. Optimal play is spamming the Compute button, which is exactly the behaviour the
rest of the game spent hours training out of you. It is the one system that is pure APM tedium.

### 8.6 The drone-ratio and boredom systems punish inattention with chores
`disorgCounter` climbs whenever `max(H,W)/min(H,W) > 1.5` and demands 5,000 Yomi to fix. `boredomLevel`
climbs to 30,000 (5 real minutes of no matter) and demands 10,000 Creativity. Both are *maintenance
taxes on walking away*, in a genre whose entire promise is that walking away is fine. The flavour text
is charming; the mechanic is hostile.

### 8.7 Act II mid-game is a long, flat button-mashing plateau
After Release the HypnoDrones and before Space Exploration you spend a *long* time pressing
`+10 / +100 / +1k` on Harvester Drones and Wire Drones, watching three numbers, adjusting one slider.
The `+1k` buttons exist precisely because the designer knew this. Adding bigger buttons is treating the
symptom.

### 8.8 Combat is a screensaver
`battleCanvasDiv` renders a swarm sim you have no input into. You allocate Combat trust beforehand and
then watch. The Napoleonic battle-name list (Austerlitz, Borodino, Waterloo — 104 names) is lovely
flavour attached to a system with zero interaction.

### 8.9 Trust allocation is permanently unrecoverable
Processor/Memory is a hard, irreversible split with no respec, and the *correct* answer is
non-obvious (Memory raises the ops cap but makes it harder to cap out, which throttles Creativity). A
player who dumps early Trust into Memory is materially slower for hours and will never know why.

### 8.10 Marketing becomes a trap and the game doesn't tell you
`adCost` doubles (×2) while `marketing` grows at 1.1×. After ~10 levels each purchase costs 1,024× the
first for a 2.6× total effect. Players keep buying it because the button is there and it worked before.

### 8.11 Long-scale number words are illegible
"29.9 septendecillion." Nobody can compare septendecillion to sexdecillion at a glance. Scientific or
short suffix notation (1.2e54, or 30 Qi) would be strictly better. *(Our constraint doc already
mandates suffix notation — this is why.)*

### 8.12 The wire market can't be read, only reacted to
`6·sin(n)` with integer `n` produces a sequence with no trend, no momentum, and no memory. There is no
skill in "buy low" beyond reflex. A market you can *learn* would be strictly more interesting for the
same code budget.

### 8.13 The endgame is ~1–2 hours of watching
Between the last probe-trait decision and the final dismantle there is a very long stretch where the
only meaningful input is occasionally pressing Compute. The game is aware of this — it is why the
threnody plays — but atmosphere is not pacing.

### 8.14 No accessibility whatsoever
No keyboard navigation, no focus states, no ARIA, no reduced-motion handling (the HypnoDrone strobe is
120 flashes in 4 seconds — a genuine photosensitivity hazard), no colour-blind consideration, no text
scaling, no screen-reader structure.

### 8.15 No pause, no speed control, no "what should I do next"
If you look away mid-Act-II you may return to a disorganised swarm and a bored drone fleet with no
explanation of how long it has been broken.

### 8.16 Third-party dependencies in a game that needs none
Google Analytics loaded from `googletagmanager.com`. A single-file offline-capable build was always
possible and was not done.

---

## 9. The twelve transferable principles

**1. The title is the tutorial.**
"Universal Paperclips" + a button that says "Make Paperclip" = zero onboarding required. Design the
first screen so that reading it *is* learning it. If you need a tooltip on beat 0, the beat is wrong.

**2. Automate the first verb inside 60 seconds.**
AutoClippers cost $5 and arrive at ~0:40. The manual click is a handshake, not a mechanic. Never make
the player earn the right to stop doing the boring thing — give it away almost immediately and charge
for the *next* thing.

**3. Show the locked thing, greyed, forever.**
`trigger` (does it exist) and `cost` (can I afford it) must be separate predicates. Desire needs an
address on screen. A greyed button that lights up is worth ten notifications.

**4. Every new resource should be born from a *failure state* of an old one.**
Creativity accrues **only when Operations are full** — waste becomes production. Look at every place
your systems overflow, cap out, or idle, and put a currency there.

**5. Make the player complicit in the mechanic they will later regret.**
`wireBasePrice += 0.05` on every purchase. You are the inflation. The player must *do* the thing the
game is about, not be told about it.

**6. Constraints should be characters.**
"Trust," granted by supervisors, on a Fibonacci ladder, spendable on your own mind, removable by force.
Same maths as a level gate; entirely different feeling. Never name a limiter after the limit.

**7. Act transitions REVOKE, they do not ADD.**
Release the HypnoDrones zeroes every clipper and deletes the economy. Space Exploration disassembles
every factory. The recontextualisation lands because the player *loses mastery* and must rebuild with
new verbs. Adding a panel is an update; taking one away is an act.

**8. Put the mechanical delta in the flavour text, in parentheses, at the end.**
"A cure for androgenetic alopecia. **(+20 Trust)**". Twelve words maximum. The joke and the number in
the same sentence means neither can be skipped. And let the *numbers* carry the argument: cancer +10,
world peace +12, climate +15, baldness +20 is a complete thesis about human values told in four
integers.

**9. Layout is the progress bar.**
Panels un-hide as they are earned; the screen grows from one column to three, then shrinks again during
the ending. The player measures progress by how full the window is. Never build a screen you intend to
show in full on day one.

**10. Give the player one dial with no correct setting.**
Work↔Think. Price. Probe trait allocation. A recurring, reversible, always-slightly-wrong choice is
worth more engagement than ten permanent ones, because it gives the hands something to do while the
head watches the numbers.

**11. Currencies should be earned by *different activities*, not different amounts.**
Ops = waiting. Creativity = overflowing. Yomi = playing a game-theory minigame. Honor = surviving
combat. Trust = hitting production targets. Money = commerce. Six currencies, six different verbs. A
currency that is just "a bigger version of the last currency" is a reskin.

**12. Spend your performance headroom on liveness.**
100 Hz `innerHTML` writes, opacity-driven sine waves, 30 ms blink loops. Architecturally awful,
experientially superb. A UI that updates faster than the player can perceive *feels like it is thinking*.
Polish is optional; responsiveness is not.

---

## 10. Direct implications for HYPHAE

Mapping, briefly, so the rest of the team can act on this:

| UP mechanism | HYPHAE analogue | Change we should make |
|---|---|---|
| Make Paperclip → AutoClipper @ $5 in 40 s | Extend Hypha → first autonomous hypha ≈ 45 s | Keep the timing. Do not slow it down. |
| Wire purchase with self-inflicted inflation | Substrate/nutrient two-sided market | Give it **memory and trend** so it can be *learned*, not just reacted to (beats §8.12) |
| Trust (Fibonacci, spend on Proc/Mem) | Signalling capacity | Add a **respec** — UP's permanence is a trap (§8.9) |
| Creativity from full-ops overflow | Insight from saturated signal | Steal this rule verbatim. It is the best idea in the game. |
| 96 projects, trigger/cost split, blink, remove on buy | Projects tree | Steal the architecture exactly. Add categories only if the list exceeds ~15 visible. |
| Stock market (no agency) | Mycorrhizal contracts with trees | **This is our biggest win.** Real counterparties, real terms, real choice — the thing UP faked. |
| Tournament → Yomi | Risk/allocation sub-game | Must stay meaningful past the point of automation (beats §6 endnote) |
| Probe traits + value drift | Sporecraft traits + wild-strain divergence | Keep `drift ∝ trust^1.2`. The "smarter children defect more" curve is perfect. |
| Panels un-hiding as progress bar | Same | Portrait-first: panels stack, thumb-reachable, one column always |
| No offline progression | — | **Generous offline. Non-negotiable.** |
| Long-scale English number words | — | Suffix notation |
| Desktop-only, blocks phones | — | Phone-first, one-handed, portrait |
| 120-flash strobe at act transition | Act transitions | Same emotional beat, `prefers-reduced-motion` respected |

The three things to copy without modification: **the 40-second automation**, **the trigger/cost split**,
and **overflow-becomes-a-currency**.

The three things to beat: **offline progression**, **a strategic layer with real agency** (the contracts
must be everything the stock market pretends to be), and **the mid-Act-II plateau**.

---

*Compiled from primary source. All formulas verified against `main.js`, `projects.js`, `globals.js`,
`combat.js` as shipped.*
