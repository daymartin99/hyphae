# HYPHAE — THE PROJECTS CATALOG

**Document 04. The source of truth for every one-shot unlock in the game.**
Companions: `00-paperclips-teardown.md`, `01-act1-understory.md`, `02-act2-network.md`.
Act III has no separate design document yet; **§7 of this file is the normative Act III mechanical
vocabulary** and Act III's own doc must conform to it.

**146 projects.** Act I: 45. Act II: 53. Act III: 48.
92 of them are mechanically novel — they open a panel, add or delete a verb, change a rule,
invert an incentive, remove a subsystem, or charge you something permanent. The remaining 54
multiply a number, and they are there so that the 92 land.

Universal Paperclips shipped 96. We ship 146 because we have three acts of roughly equal weight
and because the teardown's §8.7 finding — the Act II plateau — is a *content* failure as much as a
systems failure. Every twelve-minute stretch of HYPHAE must have a button in it that the player
has not seen before.

---

## 1. Architecture

Copied from Universal Paperclips without modification, because the teardown (§4, §9 principle 3) is
right that it is the load-bearing progression system in the genre.

```js
const Project = {
  id,                       // stable slug. Never renumber. Save files store id strings, not indices.
  title,                    // noun phrase. Never a verb phrase. Never "Upgrade X II".
  act,                      // 1 | 2 | 3
  priceTag,                 // HAND-WRITTEN string, e.g. "(240 Ψ, 90,000 Σ)". Never generated.
  description,              // the flavour string below. <= 3 sentences. Delta in parens at the end.
  trigger:  () => bool,     // does this EXIST yet
  cost:     () => bool,     // can you AFFORD it   → button.disabled = !cost()
  pay:      () => void,     // deduct. Separated from effect so effects are testable in isolation.
  effect:   () => void,     // apply; displayMessage(); remove from DOM; splice from activeProjects
  uses: 1, flag: 0, element: null,
  pinned: false,            // if true, bypasses the visibility cap (§4). Failsafes and transitions.
  excludes: []              // ids that can never trigger once this is bought
};
```

`manageProjects()` runs every sim tick (10 Hz in Act I, 20 Hz in Acts II–III).

```js
function manageProjects(){
  for (const p of allProjects)
    if (p.uses > 0 && !p.revealed && p.trigger() && admit(p)) reveal(p);   // §4
  for (const p of activeProjects)
    p.element.disabled = !p.cost();
}
```

**The two predicates are separate and that separation is the whole design.** `trigger` answers *does
this exist*; `cost` answers *can I afford it*. A project appears greyed the instant it becomes
conceptually available and lights up when it is purchasable, so the player is always looking at the
thing they are saving for. Desire gets an address on screen.

**Bought projects are removed from the DOM.** No completed tab, no receipts, no history, no codex.
The list is always exactly *what is available to me right now*. This is why a 146-item system
never feels like a menu.

**`flag`** is set to 1 on purchase and is the only permitted way for another project's `trigger` to
ask whether this one was bought (`flags.laccase_cascade`). Never test the DOM.

**`excludes`** is new and exists for exactly two pairs: The Charter / Total Conversion (Act II) and
the ending set (Act III). An excluded project is removed from `allProjects` entirely, not merely
hidden, so it cannot be resurrected by a later trigger.

### 1.1 Trigger taxonomy

Every trigger in this catalog is one of six kinds. The distribution is deliberate; types 3 and 5 are
the ones nobody copies from UP and they are why the game feels like it is watching you.

| # | Kind | Example | Count |
|---|---|---|---|
| 1 | Resource threshold | `insight >= 350` | ~52 |
| 2 | Tech-tree chain | `flags.hemicellulase` | ~19 |
| 3 | **Behavioural** | `stats.purchases >= 40` → here is Standing Order | **~24** |
| 4 | State / act gate | `consumed >= 0.97` | ~26 |
| 5 | **Failure detection** | total bankruptcy → Windfall; `stats.rotted >= 500` → Sclerotia | **~9** |
| 6 | Escalating tier | `dVes >= 1`, `dCond >= 6` | ~13 |

Type 3 is the game noticing what is annoying you and handing you the instrument for it. Type 5 is
the game noticing you have failed and building the fix out of the failure — Sclerotia is offered only
to a player who has *wasted* 500 g of sugar; Contract Arbitration can only ever appear to someone who
has already defaulted, so the comfort exists only for the people who need it and the players who never
default never learn it was there.

### 1.2 Currency glyphs

| Glyph | Resource | Act | Earned by |
|---|---|---|---|
| `g` | Biomass | I–III | decomposition |
| `sug` | Sugar | I only | decomposition; capped, and it rots |
| `⛬` | Minerals | I–III | mycorrhizal contracts, weathering, world lysis |
| `rep` | Reputation | I only | honouring contracts |
| `Σ` | Signal | II–III | live mycorrhizal interface, then spore mass |
| `Ψ` | Insight | II–III | **saturation only** — the pool must be full |
| `◦` | Spores | II–III | fruiting, then everything |
| `D` | Differentiation | II–III | the flavour track, mostly |
| `λ` | Lineage | III only | resolving wild strains |

Nine currencies to UP's eight, and — the rule that matters, teardown principle 11 — **each is earned
by a different verb**. Biomass is eating. Sugar is trading. Minerals are negotiating. Reputation is
keeping your word. Signal is being alive in the right places. Insight is *waiting*. Spores are
gambling on weather. Differentiation is reading. Lineage is losing children.

Cost strings in the JSON are machine-parseable: terms joined by ` + `, each `<number> <glyph>`.
`— (a decision)` means free, and is used for exactly the moments where charging would be wrong;
`— (unbuyable)` means the button exists and can never be pressed. One cost is a formula rather than a
literal (`a_gift_of_phosphorus`: `200*2^k ⛬`, where `k` is its own purchase count) and the parser must
special-case it — or, better, treat every cost as a thunk and let the string be documentation.

---

## 2. Writing rules, enforced

These are lint rules, not suggestions. A project that violates one does not ship.

1. **Title is a noun phrase.** "Foraging Front", not "Improve Foraging". Never a roman numeral,
   never a "II", never a tier word.
2. **Titles are specific before they are grand.** "Ghost Pipe Compact" beats "Symbiosis Upgrade"
   because *Monotropa uniflora* is a real plant that really does this. Where a title names a real
   organism, phenomenon or paper, the flavour text must be factually true.
3. **Flavour is 1–3 sentences and the button shows all of it.** Card is 92 px tall on a 360 px
   viewport: title line plus up to three lines of 13 px text. If it does not fit, it is too long.
4. **The mechanical delta goes in parentheses at the end** — *"(+18% throughput)"* — except where the
   project is important enough that a number would cheapen it. `Stop asking.` gets no parenthesis.
   `Let go of the ground.` gets no parenthesis. Neither does `Stop tasting. Start knowing.`
5. **Act-defining projects have the shortest text in the game.** UP ended Act I in four words. Our
   three transitions are five words, five words, and four.
6. **No tooltips. No lore panel. No codex. No help text.** Everything is on the button.
7. **Never explain the joke and never explain the cost.** Perennial Mycelium states exactly what it
   does and does not say that it is a trap. The Isotope Ledger reveals LEGACY and does not mention
   that LEGACY sets Act III's fidelity floor.
8. **Let the numbers carry the argument.** UP's Trust ladder — cancer +10, world peace +12, climate
   +15, baldness +20 — is a complete thesis about human values told in four integers. Our equivalent
   is the D faucet's five-step ladder (correspondence → a name → parasitism → scale → **merger**) and
   the fact that the ending with the largest prestige multiplier is called *Decomposition*.

---

## 3. Flavour-to-mechanics ratio

Measured against the shipped strings in §5–§7, not against intent:

- **~38% plain mechanics, plainly stated.** *"Bundled threads move further on the same water."*
- **~40% one line of flavour that IS the mechanic.** *"Stop asking."* · *"Sense the gradient. Go up
  it."* · *"Give some of it back. You will not see why for an hour."*
- **~22% a real fact, delivered straight, with a mechanical kicker.** Physarum and the Tokyo rail
  network. Prototaxites. The fungi growing toward the radiation inside reactor four. The dung cannon
  at twenty thousand g. Every one of these is true, none is explained, and each carries a number.

The third bin is where the game's voice lives. The rule for it: **state the fact, do not admire it.**
Nature documentary narration written by someone who is not surprised.

---

## 4. Reveal pacing — the hard constraint, and the mechanism that guarantees it

The brief: *the player almost always has 2–4 affordable-soon projects visible and never more than 6.*
With 146 projects and a six-hour playthrough that is a scheduling problem, and hoping the triggers
happen to space out is not a plan. So it is enforced.

### 4.1 The reveal queue

```js
const VISIBLE_CAP = 6;

function admit(p){
  if (p.pinned) return true;                       // failsafes, act transitions, unbuyable events
  if (activeProjects.length < VISIBLE_CAP) return true;
  queue.push(p); return false;                     // waits, in trigger order
}

function onPurchase(){
  // promote from the queue, cheapest-relative-to-holdings first
  queue.sort((a,b) => affordRatio(a) - affordRatio(b));
  while (activeProjects.length < VISIBLE_CAP && queue.length) reveal(queue.shift());
}

// affordRatio: max over the project's currencies of (cost / current holding), Infinity if holding 0.
// < 1 = affordable now.  1–3 = "affordable soon".  > 8 = a wall.
```

Two properties follow, and both are required:

- **The cap is never exceeded**, so the list is always thumb-scannable in portrait without scrolling
  past the fold.
- **The queue promotes by affordability, not by trigger order**, so the six slots are always biased
  toward things the player can nearly buy. A project whose `affordRatio` is 40 does not squat in a
  slot for twenty minutes.

`pinned: true` is set on exactly nine projects: Windfall, The Last Spore, Wild Strain, We Have Been
Talking Without You, DECIDE, Ascospore Discharge, Autolysis, Sever the Elm, and A Gift of Phosphorus.
These are failsafes, transitions and events; they must never be starved by the queue.

### 4.2 Target: the `affordRatio` histogram

At any moment, the six visible slots should look approximately like this. It is checked in QA by
sampling every 30 s of a full playthrough and asserting the mean.

| Band | `affordRatio` | Target slots | Reads as |
|---|---|---|---|
| Affordable now | < 1.0 | **1–2** | "I can press something" |
| Affordable soon | 1.0 – 3.0 | **2–3** | "I am saving for that" |
| On the horizon | 3.0 – 8.0 | 1–2 | "that is next" |
| A wall | > 8.0 | 0–1 | "that is the act" |

Never zero in the top band for more than **90 seconds**. That is the metronome the teardown measured
in UP (§1: something new every ~90 s) and it is the single number this catalog is balanced against.

### 4.3 Density audit

Expected simultaneous-visible count at each phase, from the trigger set as written:

| Phase | Elapsed | Triggered-and-unbought | Visible | Queued |
|---|---|---|---|---|
| Act I, panel opens | 0:03 | 3 | 3 | 0 |
| Act I, first market | 0:12 | 7 | 6 | 1 |
| Act I, mid | 0:45 | 11 | 6 | 5 |
| Act I, last year | 1:50 | 9 | 6 | 3 |
| Act II, opening | 2:05 | 2 | 2 | 0 |
| Act II, tier B | 2:40 | 9 | 6 | 3 |
| Act II, tier C peak | 3:35 | 15 | 6 | 9 |
| Act II, the decline | 5:10 | 8 | 6 | 2 |
| Act III, loft | 5:30 | 5 | 5 | 0 |
| Act III, void | 6:40 | 13 | 6 | 7 |
| Act III, endings | 7:30 | 4 | 4 | 0 |

The two thin moments — the first three minutes of each of Acts II and III — are deliberate. After a
transition that has just deleted everything the player owned, a list of two buttons is the correct
amount of world.

---

## 5. ACT I — UNDERSTORY  (45 projects)

Currencies: `g` biomass · `sug` sugar · `⛬` minerals · `rep` reputation.
Timeline: 0:03 (the Adaptations panel opens at `biomass >= 2000`) to roughly 2:10.
Entries 1–25 of Wave 1–5 are the canonical set from `01-act1-understory.md` §10, preserved with their
exact costs and effects. The rest are additions specified here.

**Legend: ★ mechanically novel · ⚠ trap · ⊘ irreversible**

### I-1 The Floor  — 7 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `rhizomorph_cords` | **Rhizomorph Cords** | 1 | `tips >= 12` | `900 g` | structureMult *= 1.18. Applies to throughputPerSec() before environment multipliers. | *Bundled threads move further on the same water. (+18% throughput)* |
| `reflex_arc` | **Reflex Arc** ★ | 1 | `stats.taps >= 120` | `1100 g` | EXTEND accepts press-and-hold: fires at 3.0 taps/s while held, auto-releases after 12 s or when totalSubstrate() < TAP_LITTER. Haptic drops to 4 ms while held. | *You stop deciding to move and simply move. (Hold to extend)* |
| `assay_plate` | **Assay Plate** ★ | 1 | `biomass >= 2000` | `2000 g` | Opens the ASSAY panel: for all seven substrate types, etaB, etaS, enzyme coverage, stock, and live g/s contribution, sorted by contribution. Locked types show as dashes. | *Seven kinds of dead, and they do not taste the same. (Yield table)* |
| `cellulase_titre` | **Cellulase Titre** | 1 | `biomass >= 2000` | `2600 g` | enzymeK.leaf, enzymeK.needle, enzymeK.twig *= 1.25. | *More of the enzyme you already had. (+25% on soft litter)* |
| `hydrophobic_sheath` | **Hydrophobic Sheath** | 1 | `year > 0 \|\| season != 2` | `1400 g` | moistureMult is replaced by 1 - 0.50*(1 - moistureMult) whenever moistureMult < 1. Bonuses above 1 are unaffected. | *Water held against the frost, in a coat you grew for exactly this. (Halves the moisture penalty)* |
| `foraging_front` | **Foraging Front** | 1 | `tips >= 24` | `3400 g` | Tip cost curve changes base: tipCost = 1.085^n + 59 instead of 1.10^n + 59. Tip 60 costs 156 g instead of 364 g; tip 100 costs 3,290 g instead of 13,840 g. | *Growth at the edge, never in the middle. (Cheaper tips, forever)* |
| `mycelial_ledger` | **Mycelial Ledger** ★ | 1 | `stats.purchases >= 10` | `3800 g` | Every Litter Market row gains a 90-sample sparkline, a dashed fair-value line at Pbar, and a momentum arrow from the 30-sample slope. No numbers change. | *You begin to remember prices. (Market history)* |

### I-2 The Market  — 8 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `dormancy_clause` | **Dormancy Clause** ★ | 1 | `stats.contractsSigned >= 1` | `1800 g + 20 ⛬` | While offline, every active contract suspends: no delivery is owed, no default accrues, and the term clock pauses. Contracts resume on the first sim tick after return. | *Sleep does not break a promise. (No offline defaults)* |
| `hemicellulase` | **Hemicellulase** | 1 | `flags.cellulase_titre` | `5200 g + 30 ⛬` | Unlocks the bark substrate pool on the Litter Market. enzymeK.twig *= 1.30. | *The gluey parts come apart first. (Unlocks bark slough)* |
| `osmotic_priming` | **Osmotic Priming** | 1 | `stats.sugarSpentOnMarket >= 5000` | `6500 g + 45 ⛬` | osmoticPriming = 0.5. Every purchase moves Pbar by half the normal amount for that type. | *Ask quietly and the floor gives more. (Half market impact)* |
| `two_sided_book` | **The Two-Sided Book** ★ | 1 | `stats.purchases >= 25 && any(sub[t] > 12 * dailyUse[t])` | `7200 g` | Unlocks SELL on every Litter Market row. Sells clear at 0.88 x bid. A sale moves Pbar DOWN by 0.45x the amount an equivalent buy moves it up, so round-tripping is a slow net-negative and hoarding-then-dumping is a real, small, learnable edge. | *It turns out the floor will take things back, at a discount, and remember that you asked. (Unlocks selling)* |
| `sclerotia` | **Sclerotia** | 1 | `stats.rotted >= 500` | `8000 g` | sugarCap += 6000 + 40*tips. Recomputed whenever tips changes. | *Hard little bodies, each one full of a winter you have not had yet. (+Sugar storage)* |
| `trade_memory` | **Trade Memory** ★ | 1 | `stats.contractsCompleted >= 2` | `9000 g + 40 ⛬` | Tree cards show numeric carbon deficit d, current photosynthate, stated need, and a one-forest-year history strip. Offers can be compared side by side in NEGOTIATE. | *You learn what hunger looks like from underneath. (Tree data)* |
| `antifreeze_glycoproteins` | **Antifreeze Glycoproteins** | 1 | `stats.wintersEnded >= 1` | `9500 g` | Winter tempMult 0.55 -> 0.85. | *Ice forms around you, not in you. (Winter +55%)* |
| `the_deer_in_the_gully` | **The Deer in the Gully** ★ | 1 | `stats.carrionEventsSeen >= 1` | `11000 g` | Unlocks the carrion substrate pool: etaB 0.72, etaS 0.05, base price 6.4x leaf, litterfall arrives in rare lumps rather than a steady rate. Adds SCAVENGER supply events, which remove 40-80% of a standing carrion pool with 20 s of warning. | *Nothing on the floor is wasted, and nothing on the floor was asked. (Unlocks carrion)* |

### I-3 The Forest Notices  — 8 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `patch_second_shadow` | **Patch: The Second Shadow** | 1 | `biomass >= 12000` | `12000 g + 90 ⛬` | Claims patch 2. All market cap and litterfall scale by the new patch count. hyphae += 6.0 m. Claim takes 90 s during which throughputPerSec() *= 0.90. | *There is more floor than this. (+1 patch)* |
| `peroxidase_mn` | **Peroxidase (Mn)** | 1 | `flags.hemicellulase` | `13000 g + 70 ⛬` | Unlocks the log substrate pool. All wood-class etaB *= 1.15. | *Lignin is only a rumour of a wall. (Unlocks fallen logs)* |
| `standing_order` | **Standing Order** ★ | 1 | `stats.purchases >= 40` | `15000 g` | Per-type automated purchasing: set a price ceiling and a floor stock; the order fills at market whenever stock < floor and price <= ceiling. Published in the description and true in simulation: it averages 8% worse fill than skilled manual timing, because it cannot wait for the trough. | *It buys badly and it never sleeps, and you will take that trade. (Automated purchasing, 8% worse than you)* |
| `necromass_recycling` | **Necromass Recycling** | 1 | `tips >= 60` | `16000 g` | 12% of every gram of consumed substrate is returned to its own typed pool on the same tick. | *You eat your own dead ends. (12% substrate refund)* |
| `chemotropic_sensing` | **Chemotropic Sensing** ★ | 1 | `patches >= 2` | `18000 g` | Unclaimed patch inventories, dominant fall type and tree list are revealed before purchase. Windthrow events are announced 30 s before they resolve. | *You taste the air for the shape of things that have not fallen yet. (Foresight)* |
| `common_mycorrhizal_network` | **Common Mycorrhizal Network** | 1 | `count(trees where rep >= 45) >= 3` | `22000 g + 150 ⛬` | cmnMult = 1.5, applied to reputation GAINS only. Losses are unchanged. | *The forest starts telling itself about you. (+50% reputation gain)* |
| `ghost_pipe_compact` | **Ghost Pipe Compact** ★ ⊘ | 1 | `any(tree.rep >= 60) && stats.contractsCompleted >= 4` | `24000 g` | IRREVERSIBLE. A mycoheterotroph attaches to the network. sugarRate *= 0.96 permanently and cannot be undone by any later project. netRep += 12 immediately, and +1 netRep per forest-year thereafter, forever. | *Monotropa has no chlorophyll and no shame. It takes sugar and gives the forest a reason to trust you. You will never get the four percent back.* |
| `hartig_net_refinement` | **Hartig Net Refinement** | 1 | `any(contract.term >= 6)` | `26000 g + 180 ⛬` | hartigNet = 1.18, multiplying every mineral inflow rate including Oxalate Weathering. | *More surface between you and them. (+18% all mineral rates)* |

### I-4 Consolidation  — 8 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `forward_contracts` | **Forward Contracts** ★ ⚠ ⊘ | 1 | `stats.largestSinglePurchase >= 4000` | `28000 g + 200 ⛬` | TRAP. Fixes your fill price at 1.05 x the current fair value Pbar for your next 12 purchases of any type. Cannot be cancelled and does not expire on time. Because Pbar drifts upward with your own buying, a heavy buyer gains; a player who has bought Osmotic Priming, or who trades the trough well, loses roughly 11% on those twelve fills. | *A price you can plan around is worth more than a price that is right. It says so, on the contract, in your own exudate.* |
| `patch_windthrow_gap` | **Patch: The Windthrow Gap** | 1 | `netRep >= 22` | `30000 g + 260 ⛬` | Claims patch 3. Log and bark dominant. Contains one fir. Claim takes 135 s at 0.90x throughput. | *Where the wind did your work for you. (+1 patch, log-rich)* |
| `laccase` | **Laccase** | 1 | `flags.peroxidase_mn` | `34000 g + 220 ⛬` | Unlocks the stump substrate pool: the largest stocks in the game, the slowest enzyme rate, and no litterfall replenishment. | *Heartwood, at last. (Unlocks stumps)* |
| `diel_rhythm` | **Diel Rhythm** ★ | 1 | `stats.offlineSeconds >= 7200` | `36000 g` | Offline efficiency 0.55 -> 0.72 for the first 8 h of any absence; the post-8h tail schedule is unchanged. | *The day and the night were always the same to you. Now you are paid for noticing the difference. (+31% offline)* |
| `bacterial_antagonism` | **Bacterial Antagonism** ★ | 1 | `any(price[t] > 1.6 * base[t])` | `38000 g + 240 ⛬` | leaf and needle prices *= 0.78 for you only, permanently. Other buyers on the book pay the unmodified price, and the visible spread between your fill and the printed price is never explained. | *You poison the competition. It works. (-22% soft litter cost)* |
| `exudate_pump` | **Exudate Pump** | 1 | `committedSugarPerSec >= 25` | `42000 g + 300 ⛬` | exudatePump = 1.35. Every contract's sugarOut and payIn scale by 1.35 without renegotiation. | *Push harder and they will take more, because by now they cannot not take it. (+35% contract volume)* |
| `contract_arbitration` | **Contract Arbitration** ★ | 1 | `stats.defaults >= 1` | `46000 g + 320 ⛬` | arbitration = 0.45. All future default penalties to netRep and per-tree rep are multiplied by 0.45. | *The forest is willing to hear your side. (Softer default penalty)* |
| `seasonal_forecast` | **Seasonal Forecast** ★ | 1 | `year >= 2` | `52000 g + 380 ⛬` | Shows next season's event probability table and adds a forecast row to the NEGOTIATE screen so contract terms can be priced against expected weather. | *Three months is not so far ahead. (Weather forecast)* |

### I-5 The Last Year  — 7 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `perennial_mycelium` | **Perennial Mycelium** ★ ⚠ ⊘ | 1 | `year >= 3 && flags.antifreeze_glycoproteins` | `55000 g + 350 ⛬` | IRREVERSIBLE. Sets tempMult = 1.00 and moistureMult = 1.00 in every season, permanently. ALSO deletes the weather event engine: no drought, no frost, and no FLUSH, WINDTHROW or MAST either. Seasonal Forecast, if owned, goes inert and displays a flat line. Net expected throughput over a forest-year: +4.5%. Net expected windfall substrate: -100%. | *You stop having years. The average is very good, and nothing will ever be better than the average again.* |
| `fruiting_body` | **Fruiting Body** | 1 | `season == AUTUMN && moisture >= 1.00 && hyphae >= 200` | `60000 g` | netRep += 8. Reveals one unclaimed patch at random. Draws a sporocarp on the canvas that persists for one season and then collapses. | *For one night in the year you are visible, and the forest counts you. (+8 reputation)* |
| `autolysis` | **Autolysis** ★ ⊘ | 1 | `tips >= 40` | `— (a decision)` | RE-ARMABLE, IRREVERSIBLE PER USE. Destroys floor(0.20 * tips) hyphal tips and returns 3.0x their cumulative purchase cost as biomass. uses += 1 on completion, so it is always available. Tip cost does NOT roll back: the tips you rebuy are priced at the new, lower n, which is the entire point and is never stated. | *You are allowed to be smaller. It is faster than being patient, and it costs exactly what it looks like it costs.* |
| `patch_under_the_hemlocks` | **Patch: Under the Hemlocks** | 1 | `patches >= 3` | `70000 g + 700 ⛬` | Claims patch 4. Needle dominant, deep shade: moistureMult floor of 0.85 here in all seasons. Contains one hemlock and one fir. | *Deep shade, deep needle, and nothing else growing. (+1 patch)* |
| `oxalate_weathering` | **Oxalate Weathering** | 1 | `stats.mineralEarned >= 1500` | `75000 g + 500 ⛬` | mineral += 0.35/s passively, forever, independent of contracts. Scales with hartigNet if owned. | *You dissolve the rock yourself, slowly, with an acid you have always made. (+0.35 mineral/s)* |
| `patch_old_coppice` | **Patch: The Old Coppice** | 1 | `netRep >= 45` | `160000 g + 1800 ⛬` | Claims patch 5. Stump dominant. Contains one dying elm, which enables Sever the Elm. | *Cut a hundred years ago by someone who did not write it down. (+1 patch, stump-rich)* |
| `patch_oak_rise` | **Patch: The Oak Rise** | 1 | `netRep >= 55` | `400000 g + 4400 ⛬` | Claims patch 6. Mixed fall. Contains the oak: the deepest carbon deficit and the highest mineral rate in Act I, and the only tree that will refuse a first offer. | *The oak has been waiting, the way a bank waits. (+1 patch, +oak)* |

### I-X Conditional  — 4 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `windfall` | **Windfall** ★ | 1 | `totalSubstrate() < TAP_LITTER && sugar < cheapestBuy() && biomass < cheapestTip()` | `1 rep` | RE-ARMABLE FAILSAFE. +2,000 g leaf substrate. netRep -= 1. uses += 1, so the game can never dead-end. Bypasses the six-slot visibility cap. | *Ask the forest for something you did not earn. It will say yes, and it will remember that it did.* |
| `a_gift_of_phosphorus` | **A Gift of Phosphorus** | 1 | `stats.contractsCompleted >= 2 && any(tree.rep < 40)` | `200*2^k ⛬` | RE-ARMABLE. +4 rep to a chosen tree. uses += 1, k += 1, so the price doubles each time. | *A small gift, correctly timed, to something that cannot count. (+4 reputation, one tree)* |
| `sever_the_elm` | **Sever the Elm** ★ ⊘ | 1 | `any(contract.species == ELM && tree.health < 0.15)` | `— (a decision)` | IRREVERSIBLE. Ends that contract immediately with no default penalty and returns collateral in full. The elm dies at the next season boundary and its patch loses one tree slot permanently. Its remaining four seasons of best-in-act mineral rates go with it, and this number is not shown. | *It was going to die anyway. (No penalty)* |
| `the_hollow_beech` | **The Hollow Beech** ★ ⚠ | 1 | `year >= 2 && any(tree.species == BEECH && tree.d >= 0.85)` | `4000 sug` | Offers one non-negotiable contract: 6.0x standard mineral rate, 4.0x standard sugarOut, 12-season term, no early exit, tension accrues at 3x. Requires 4,000 g of sugar HELD at the moment of signing, which above the uncapped sugar ceiling means it is effectively gated on owning Sclerotia. If it ever defaults, netRep -= 18 and arbitration does not apply. | *It is enormous and it is empty and it will pay almost anything. Read the term length twice.* |

### I-T Transition  — 3 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `anastomosis` | **Anastomosis** ★ | 1 | `hyphae >= 500 && patches >= 4` | `260000 g + 900 ⛬` | structureMult *= 1.25. Substrate pools merge across every claimed patch: one book, one price, one stock. A greyed readout reading 'conduction  —' appears under HYPHAE with no explanation and no tooltip. | *Where two threads meet, they stop being two threads. (+25% throughput, pooled substrate)* |
| `action_potential` | **Action Potential** ★ | 1 | `flags.anastomosis && netRep >= 60` | `900000 g + 4000 ⛬` | conduction becomes a live number rising with hyphae. A resource called SIGNAL appears with a rate, a running total, and no uses whatsoever. It will have no uses for the next 8-15 minutes. | *Something moved from one end of you to the other, and it was not food.* |
| `decide` | **DECIDE** ★ ⊘ | 1 | `flags.action_potential && signal >= 1000` | `— (a decision)` | ENDS ACT I. Voids every contract with collateral returned; deletes reputation entirely; closes and destroys the Litter Market panel; sugar ceases to be a currency; tips = 0; nodes = floor(hyphae/50); biomass *= 0.10; act = 2. No confirmation dialog. | *Stop tasting. Start knowing.* |


---

## 6. ACT II — NETWORK  (53 projects)

Currencies: `Σ` Signal · `Ψ` Insight · `g` biomass · `⛬` minerals · `◦` spores · `D` Differentiation.
Tier boundaries are `forestConsumed` fractions, per `02-act2-network.md` §12.
Entries carrying the ids A1–A7, B1–B8, C1–C10, D1–D9, E1–E4, F1–F5 in that document appear here under
their slugs with unchanged costs and effects; sixteen further projects are specified here.

**Legend: ★ mechanically novel · ⚠ trap · ⊘ irreversible**

### II-A Awakening  — 7 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `chemotaxis` | **Chemotaxis** ★ | 2 | `act == 2` | `400 Σ` | Unlocks the FOREST panel: the 61-hex canvas map, the STANDS list, and the ADVANCE action. This is the only project visible at Act II start. | *Sense the gradient. Go up it.* |
| `apical_growth` | **Apical Growth** | 2 | `claimed >= 2` | `900 Σ` | advanceSpeed *= 1.45. | *Grow only at the ends. (+45% advance speed)* |
| `turgor` | **Turgor** ★ | 2 | `stats.everSaturated` | `1600 Σ` | Unlocks INSIGHT and the ripeness meter. Insight thereafter accrues only while S >= Sc - EPS, scaled by satTime/RIPE_T. | *The pressure has nowhere to go, so it becomes an opinion. (Unlocks Insight)* |
| `primordium` | **Primordium** ★ | 2 | `insight >= 8` | `10 Ψ` | Unlocks the FLUSH panel with 1 slot. Committing biomass to a primordium reveals its three morph bars before any gram is spent. | *A knot in the wood, deciding. (Unlocks fruiting)* |
| `substrate_assay` | **Substrate Assay** ★ | 2 | `discovered >= 4` | `2400 Σ` | Unlocks SURVEY: 120 Σ per region, revealing exact L and T instead of a band. Recurring spend, permanently. | *Taste before you commit. (Enables SURVEY)* |
| `action_potential_ii` | **Action Potential** ★ | 2 | `claimed >= 3` | `45 Ψ` | Unlocks PULSE and its SURGE mode. pulseCost = 0.55 * Sc, cooldown 120 s, falloff 0.82^hexDist from a chosen epicentre. PULSE is never automated by any project at any price. | *Say all of it at once, in one direction. (Unlocks PULSE)* |
| `differentiation` | **Differentiation** ★ | 2 | `cumBiomass >= 1.5e9` | `3200 Σ` | Unlocks D allocation across dCond and dVes. The Differentiation ladder begins; Act I hands over exactly 3 points. | *Not every thread needs to do everything. (Unlocks Differentiation)* |

### II-B Spread  — 9 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `manganese_peroxidase` | **Manganese Peroxidase** | 2 | `extracted >= 4e9` | `30 Ψ + 6000 Σ` | E *= 1.60. | *Rust, applied with intent. (+60% enzyme power)* |
| `rhizomorphs` | **Rhizomorphs** | 2 | `claimed >= 6` | `55 Ψ` | advanceSlots = 3; advCostMult *= 0.82. | *Cables, not threads. (3 advances at once)* |
| `anemophily` | **Anemophily** ★ | 2 | `spores >= 5e4` | `40 Ψ` | Spore-seeding may target non-adjacent regions that lie downwind of a held region. Success scales with the current wind vector and spore commitment. | *Let the weather carry it. You do not have to know where. (Ranged seeding)* |
| `barometric_sense` | **Barometric Sense** ★ | 2 | `flushes >= 3` | `70 Ψ + 12000 Σ` | Forecast horizon 120 s on the OU weather walk; matSpeed *= 1.45. | *Feel the pressure fall before the rain admits to it. (+forecast, +45% maturation)* |
| `antibiosis` | **Antibiosis** ★ | 2 | `stats.rivalContacts >= 1` | `85 Ψ` | antibiosis *= 1.55; unlocks the REPEL pulse mode. | *Chemistry is cheaper than growth. (Unlocks REPEL)* |
| `vesicular_storage` | **Vesicular Storage** | 2 | `dVes >= 1` | `18000 Σ` | capMult *= 1.45. | *Hold more of it, for longer. (+45% Signal capacity)* |
| `septal_gating` | **Septal Gating** ★ | 2 | `pulses >= 10` | `110 Ψ` | Pulse cooldown 120 -> 75 s; unlocks the RECRUIT pulse mode. | *Open every door in the body at the same instant. (Unlocks RECRUIT)* |
| `humic_retention` | **Humic Retention** ★ | 2 | `any(region.h < 0.25)` | `24000 Σ` | Unlocks the Retention dial rho, global, plus 5 pinned per-region overrides. The dial shows soil: falling / holding / building and never shows the number. | *Give some of it back. You will not see why for an hour. (Unlocks Retention)* |
| `cation_exchange` | **Cation Exchange** ★ | 2 | `stats.mineralTrades >= 30` | `90 Ψ + 20000 Σ` | The mineral exchange gains a 300-sample sparkline, the true Pbar line, a numeric momentum readout, and LIMIT orders that fill automatically at a set price. Reveals that the walk is autocorrelated on a ~60 s scale. | *The price was never random. It just never told you. (Market instruments)* |

### II-C Appetite  — 17 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `necrotrophic_conversion` | **Necrotrophic Conversion** ★ ⊘ | 2 | `consumed >= 0.22` | `240 Ψ + 90000 Σ` | Unlocks KILL STAND on every held region. necroRate = 0.00085/s of standing T, 92% of which becomes litter. Sets region.necrotized = true, which is permanent: T can never regrow, any contract voids instantly, canopy falls to 0.15 within 20 minutes. Never automatable. | *Stop asking.* |
| `laccase_cascade` | **Laccase Cascade** | 2 | `flags.manganese_peroxidase` | `190 Ψ + 60000 Σ` | E *= 2.10; antibiosis *= 1.52. | *Break the ring, then the ring under it. (+110% enzyme power)* |
| `turgor_regulation` | **Turgor Regulation** ★ | 2 | `stats.densityBuys >= 25` | `165 Ψ` | Automates hyphal density to six per-terrain target dials. Replaces about 400 individual taps per hour with six decisions. | *Stop deciding this one thread at a time. (Automates density)* |
| `rhizomorph_highways` | **Rhizomorph Highways** ★ | 2 | `claimed >= 18` | `300 Ψ + 140000 Σ` | Auto-advance under a stated policy plus a veto list; advanceSlots = 6; advCostMult *= 0.80. Policy options: nearest, richest litter, highest kappa, contested first. | *Move mass, not just signal. (Automates advance)* |
| `bridging_strands` | **Bridging Strands** ★ | 2 | `stats.barrierBlocks >= 1` | `260 Ψ + 4000 ⛬` | Advances may cross barrier edges at 2.40x cost. Bridged edges count toward the connectivity term C. | *Across the water, on a dead branch, in one night. (Cross barriers)* |
| `sporulation_reflex` | **Sporulation Reflex** ★ | 2 | `flushes >= 20` | `280 Ψ` | Auto-release every primordium at m = 0.92; flush slots 1 -> 4. Manual override remains, and auto-release is suspended during Mast Years. | *You no longer need to be told when. (Automates release)* |
| `mycelial_memory` | **Mycelial Memory** | 2 | `insight >= 350` | `420 Ψ + 200000 Σ` | insightMult *= 1.55; RIPE_T 180 -> 130 s. | *The network remembers where the good wood was, and it is not sentimental about it. (+55% Insight)* |
| `reabsorption` | **Reabsorption** ★ | 2 | `D >= 5` | `150 Ψ` | Unlocks respec of all Differentiation points. Cost per use = ceil(120 * (n+1)^1.6) Ψ where n is the number of previous respecs. | *Take it back and try again. (Respec)* |
| `aerenchyma` | **Aerenchyma** | 2 | `ownsTerrain(PEAT)` | `210 Ψ + 4.0e9 g` | Peat decompF penalty 0.45 -> 0.95. Peat has litterMod 2.20, so this converts the two largest carbon stocks on the board from useless to best-in-act. | *Breathe through the water. (Unlocks peat)* |
| `alarm_contracts` | **Alarm Contracts** ★ | 2 | `contracts >= 4` | `230 Ψ` | Adds the ALARM contract term type: pays information rather than minerals or interface, granting +90 s forecast horizon in that region only. Also enables auto-renewal of expiring contracts on their existing terms. Choosing the term type is never automated. | *They knew about the drought first, and they told each other before they told you. (New contract term)* |
| `hypogeous_fruiting` | **Hypogeous Fruiting** ★ | 2 | `flushes >= 12 && stats.droughtsSurvived >= 1` | `275 Ψ + 60000 Σ` | Adds the UNDERGROUND flush mode. Hazard rate 0, wind irrelevant, dispersal 0, and therefore no spores and no territory. Returns biomass at 6.2x committed V at m = 1.0. Converts the flush minigame into a safe, boring bond whenever the weather is bad. | *Fruit below the litter, where nothing can find you and nothing will carry you anywhere. (Zero-risk flush, no spores)* |
| `sclerotial_bank` | **Sclerotial Bank** ★ ⚠ | 2 | `stats.signalOverflow >= 2.0e5` | `320 Ψ + 110000 Σ` | TRAP. Signal generated above Sc is banked at 40% into a reserve that decays at 1.0%/s and can be drawn on demand. Banked ticks do NOT count as saturated: satTime stops accruing and begins decaying at RIPE_DEC while the bank is filling. A player who banks continuously loses roughly 60% of their Insight rate and gains an emergency buffer worth about 90 seconds of production. | *Nothing is wasted now. Something else is. (Overflow storage — read the second sentence)* |
| `anastomotic_grafting` | **Anastomotic Grafting** ★ | 2 | `claimed >= 22 && edges/nodes < 1.2` | `380 Ψ + 6000 ⛬` | Permits up to 3 permanent artificial edges between any two claimed regions at hexDist <= 3, each costing a further 2,000 ⛬ to place. Graft edges count in the connectivity term C exactly as natural adjacency does. This is the only way an archipelago build can reach C > 1.20. | *Two parts of you that were never neighbours agree to be adjacent. (+3 network edges)* |
| `isotope_ledger` | **Isotope Ledger** ★ | 2 | `consumed >= 0.35` | `460 Ψ` | Opens the LEDGER panel showing live LEGACY_HUMUS, LEGACY_LIFE and the composite LEGACY, with a per-region contribution list sorted by damage. LEGACY sets Act III's fidelityBase = 0.72 + 0.28 * LEGACY. The panel does not say so. | *Carbon remembers what it used to be inside. You can read it, if you are willing to look at it.* |
| `armillaria_accord` | **The Armillaria Accord** ★ ⊘ | 2 | `count(regions where rival == ARMILLARIA && rivalStr > 0.60) >= 4` | `500 Ψ + 180000 Σ` | IRREVERSIBLE. Armillaria stops contesting and cedes every region it holds to you at d = 0.55, typically 6-11 regions with full litter stocks. In exchange rho is locked globally at 0.55 and the Retention dial, pinned overrides and Homeostatic Soil are all disabled for the rest of the act. LEGACY_HUMUS will end high. Your peak carbon rate will not. | *It is older than you and it has no opinions about speed. The terms are simple. You may have the ground, and it will decide what you leave in it.* |
| `mycelial_monoculture` | **Mycelial Monoculture** ★ ⚠ | 2 | `claimed >= 24` | `410 Ψ + 150000 Σ` | TRAP. E *= 1.85 immediately and visibly. Sets every claimed region's species weights to its single dominant species and recomputes kappa, lignin, decompF and yieldF. Typical kappa diversity loss costs 9-14% of total liveInterface within the hour, which is Signal, which is Insight, and the loss is spread across sixty-one cards where it cannot be seen. | *One enzyme suite, one substrate, one answer. It is so much faster. (+85% enzyme power)* |
| `quiescence` | **Quiescence** ★ ⊘ | 2 | `claimed >= 30 && stats.rivalsRepelled >= 8` | `640 Ψ + 260000 Σ` | IRREVERSIBLE. Deletes the rival subsystem: all four strains withdraw, every contested region resolves to you, REPEL is removed from the pulse modes and its panel row is destroyed. sporeMult *= 0.55 permanently, because competitive pressure was what made you fruit. | *There is no one left to be faster than. (Deletes rivals, -45% spore yield)* |

### II-D Dominion  — 10 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `mast_synchrony` | **Mast Synchrony** ★ | 2 | `flushes >= 40` | `640 Ψ + 400000 Σ` | Mast Years begin: a 6x payoff window announced 300 s ahead, during which auto-release is suspended. flush slots = 6; forecast 300 s; matSpeed *= 2.10. | *The whole forest decides at once and nobody knows how. (Unlocks Mast Years)* |
| `fenton_chemistry` | **Fenton Chemistry** | 2 | `flags.laccase_cascade` | `700 Ψ + 500000 Σ` | E *= 2.60. | *Iron, peroxide, and no particular care. (+160% enzyme power)* |
| `saltatory_conduction` | **Saltatory Conduction** | 2 | `dCond >= 6` | `820 Ψ + 300000 Σ` | signalMult *= 2.20; pulse cooldown 75 -> 45 s. | *Skip the parts that do not matter. (+120% Signal, faster PULSE)* |
| `synchronous_flush` | **Synchronous Flush** ★ | 2 | `flags.mast_synchrony` | `560 Ψ` | Unlocks the BLOOM pulse mode: all primordia gain m += 0.18 * strength instantly and are hazard-immune for 20 s. | *All of them, in the same minute, for no reason that you decided. (Unlocks BLOOM)* |
| `homeostatic_soil` | **Homeostatic Soil** ★ | 2 | `flags.humic_retention` | `480 Ψ` | Automates rho toward a humus setpoint you choose; pinned per-region overrides 5 -> 10. Disabled permanently if the Armillaria Accord was signed. | *Hold the number yourself. (Automates Retention)* |
| `firebreak_mycelium` | **Firebreak Mycelium** | 2 | `stats.ignitions >= 1` | `520 Ψ + 8.0e10 g` | Ignition probability *= 0.25 and fire no longer spreads between adjacent regions. Existing Burn terrain is not reverted. | *Wet the ground ahead of it. (Fire control)* |
| `deep_substrate_hyphae` | **Deep Substrate Hyphae** | 2 | `consumed >= 0.65` | `900 Ψ + 900000 Σ` | yieldMult *= 1.85; L += 0.18 * L0 on every claimed region, which is the only litter injection in the act; RIPE_T 130 -> 95 s. | *There is older wood underneath, and nobody is using it. (+85% yield, +litter)* |
| `the_quiet_ring` | **The Quiet Ring** ★ ⊘ | 2 | `consumed >= 0.55 && LEGACY_LIFE >= 0.45` | `690 Ψ + 12000 ⛬` | IRREVERSIBLE. Ring 0 and ring 1, seven regions, can never be necrotized, killed, or burned. Their rho locks at 0.60 and their KILL STAND buttons are removed from the DOM. Guarantees LEGACY_LIFE >= 0.20 whatever else you do. Those seven regions hold the densest litter and the highest connectivity on the board, and you are giving up roughly 9% of the act's total extractable carbon. | *Seven stands that will outlive the decision you are about to make.* |
| `the_charter` | **The Charter** ★ ⊘ | 2 | `LEGACY_LIFE >= 0.55 && consumed >= 0.60` | `750 Ψ` | EXCLUDES Total Conversion, which can never appear afterward. yieldMult *= 2.40 on every stand with T > 0.5 * T0. Sets pathFlag = 'symbiont', which gates one Act III ending. | *Terms, in perpetuity, with things that cannot read. (+140% yield on living stands)* |
| `total_conversion` | **Total Conversion** ★ ⊘ | 2 | `LEGACY_LIFE <= 0.25 && consumed >= 0.60` | `750 Ψ` | EXCLUDES The Charter, which can never appear afterward. necroMult *= 3.00, halving stand kill time to 272 s; decomp *= 1.45 on necrotized stands. Sets pathFlag = 'necrotroph'. | *There is no second forest.* |

### II-E The End of the Forest  — 4 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `ballistospory` | **Ballistospory** | 2 | `consumed >= 0.85` | `1100 Ψ + 1.2e6 Σ` | sporeMult *= 2.80; seeding ignores wind entirely; flush slots = 9; forecast 600 s; matSpeed *= 3.40; advanceSlots = 10. The single largest upgrade in the act, arriving at the exact moment there is nothing left to use it on. | *Fire them. Do not wait for wind. (Everything, faster)* |
| `photoreception` | **Photoreception** ★ | 2 | `consumed >= 0.88` | `1300 Ψ` | Sets a hard floor: Sr = max(Sr_computed, 0.40 * SrPeakEverSeen). An anti-softlock device for players who necrotized too fast, in the tradition of Beg For More Wire, disguised as a real project with real flavour. | *Learn to face the sky. (Signal floor)* |
| `seed_bank` | **Seed Bank** ★ | 2 | `consumed >= 0.90` | `1000 Ψ + 3.0e11 g` | Spore decay is switched off permanently. Unlocks on-demand conversion of biomass to spores at 1 spore per 3.2e3 g, which is the same rate the transition uses on whatever you are still holding. | *Nothing you make now is for you. (Biomass to spores)* |
| `ascospore_discharge` | **Ascospore Discharge** ★ ⊘ | 2 | `consumed >= 0.97` | `1.6e6 Σ + 1400 Ψ + 1.6e12 g + 4.0e8 ◦` | ENDS ACT II. Computes LEGACY from humus and standing life before destroying the evidence; converts held biomass to sporeBank at 1:3.2e3; destroys all 61 regions, every contract, the weather walk, the flush panel and the map; signalMult *= 0.35; minerals *= 0.25; frees all D for one reallocation; act = 3. Sits greyed at the bottom of the list for roughly eleven minutes while the map goes dark stand by stand. | *Let go of the ground.* |

### II-F The D Faucet  — 6 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `slime_mould_correspondence` | **Slime Mould Correspondence** | 2 | `insight >= 55` | `60 Ψ` | D += 1. | *Physarum solved the Tokyo rail network with oat flakes and no nervous system. (+1 D)* |
| `the_wood_wide_web` | **The Wood Wide Web** | 2 | `contracts >= 3` | `180 Ψ` | D += 1. | *A phrase invented by a journalist. It is not wrong. (+1 D)* |
| `zombie_ant_fungus` | **Zombie-Ant Fungus** | 2 | `claimed >= 20` | `340 Ψ` | D += 1. | *Ophiocordyceps does not need a brain in order to use one. (+1 D)* |
| `the_humongous_fungus` | **The Humongous Fungus** | 2 | `claimed >= 34` | `700 Ψ` | D += 2. | *Two thousand three hundred and eighty-four hectares, in Oregon, one organism, since before agriculture. (+2 D)* |
| `prototaxites` | **Prototaxites** | 2 | `consumed >= 0.50` | `900 Ψ` | D += 2. | *For forty million years the tallest living thing was a fungus eight metres high, and there was nothing with eyes to see it. (+2 D)* |
| `lichen` | **Lichen** | 2 | `contracts >= 8` | `1050 Ψ` | D += 2. | *Two organisms agreed to stop being two. (+2 D)* |


---

## 7. ACT III — BLOOM

### 7.0 Normative mechanical vocabulary

There is no Act III design document yet. This section is the contract; the eventual `03-act3-bloom.md`
must conform to it, and every trigger and effect in §7.1 is written against these symbols.

**Carried in from Act II** (`02-act2-network.md` §0.2): `sporeBank`, `insight`, `insightMult`,
`signalMult` (already multiplied by 0.35), `capMult`, `D` (freed for one reallocation), `minerals`
(already multiplied by 0.25), `pathFlag ∈ {symbiont, necrotroph, mixed}`, and `LEGACY ∈ [0,1]`.

**Act III state:**

```js
spores        // ◦ the bulk counter. The Act III paperclip.
signal        // Σ  Sr = SIG_K3 · C · (0.60 + sporeBank^0.62 · condTrait)^0.85 · signalMult
insight       // Ψ  saturation rule unchanged from Act II §5. Ripeness survives the transition.
minerals      // ⛬ regenerated by world lysis, not by contracts. There are no contracts.
lineage       // λ earned ONLY by resolving wild strains. Sink: The Long Council.
R             // reach: metres in Phase A, light-years after Panspermia
holdings      // 0..12 planetary biomes (Phase A)
worlds        // W: colonised worlds (Phase C). Astronomical; suffix notation mandatory.
escapeFraction// spores per second leaving the atmosphere. Starts exactly 0.
F             // genetic fidelity ∈ [0.72, 1.00].  fidelityBase = 0.72 + 0.28·LEGACY
X             // divergence, a monotone stock until Reconciliation
wildStrains   // count of diverged lineages currently taking worlds
traitPool     // allocatable trait points; traitCap limits the total
```

**The eight Sporecraft trait axes** (unlocked by `sporecraft`, respecced by `dedifferentiation`):

| Axis | Effect |
|---|---|
| `COAT` | divides all hazard terms |
| `DORMANCY` | transit decay resistance; irrelevant once Anhydrobiosis is owned |
| `LOFT` | reach and transit speed |
| `FECUNDITY` | spore yield per landfall |
| `AVIDITY` | landfall probability |
| `LYSIS` | ⛬ and ◦ extraction rate per world |
| `CONDUCTION` | Signal from the diaspora |
| `FIDELITY` | the only axis that resists drift |

**The divergence law** — the teardown's §2.15 finding, kept because it is the best single expression
in Universal Paperclips and the thesis of this game as well:

```
dX/dt = 6.0e-7 · worlds · traitTotal^1.2 · (1 − F) · (1 − 0.55 · traits.FIDELITY / traitCap)
```

**The smarter you make your children, the more of them defect.** Every point you spend on capability
raises `traitTotal`, and `traitTotal` is in the drift term with an exponent above one. FIDELITY is the
only sink that fights it and it competes for the same pool. There is an interior optimum, it moves as
`worlds` grows, and nothing on screen tells you where it is.

A wild strain spawns at each integer crossing of `X`. Each takes worlds at 0.4%/s of its own size, so
they compound. There are exactly three responses, and each is a different kind of ending:
**Quarantine Protocol** (kill it, keep your fidelity, lose the worlds), **Reconciliation** (stop
fighting, freeze F forever, convert X into λ), or nothing at all.

**Phases.** Act III has three, gated by projects rather than by thresholds:
`A LOFT` (planetary, twelve biomes, ~35 min) → `B EXOSPHERE` (escape, Sporecraft, fidelity revealed,
~40 min) → `C VOID` (worlds, wild strains, ~55 min) → `D ENDINGS`.

**Five endings and a prestige.** *The Long Quiet* (uniformity), *The Second Forest* (symbiont path),
*A Thousand Strangers* (accept divergence), *Decomposition* (necrotroph path), and
*We Have Been Talking Without You* — the wild strains' offer, which costs nothing, appears once, and
ends the game on the spot with no prestige if accepted. That last one is our *So We Offer You Exile*:
the only genuinely moral choice in the game and the only one with no number attached.

### 7.1 The catalog  (48 projects)

**Legend: ★ mechanically novel · ⚠ trap · ⊘ irreversible**

### III-A Loft  — 13 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `hymenium` | **Hymenium** ★ | 3 | `act == 3` | `600 Σ` | Unlocks the DISPERSE panel: reach R in metres, spore rain rate, and the twelve-biome planetary list, eleven of which are greyed. The only project visible at Act III start. | *A surface whose only purpose is letting go of things.* |
| `bullers_drop` | **Buller's Drop** | 3 | `stats.releases >= 20` | `1800 Σ` | launchVelocity *= 2.4; R += 0.4 m per release, compounding into the reach integral. | *A drop of water condenses on the spore and the surface tension throws it into the air. It is the fastest thing your body will ever do and it takes four microseconds.* |
| `hygroscopic_trigger` | **Hygroscopic Trigger** ★ | 3 | `stats.releasesDuringRisingRH >= 3` | `20 Ψ + 4000 Σ` | Releases auto-time to the sign of the humidity derivative rather than a fixed clock. Effective yield *= 1.55. | *Wait for the air to get heavier. (+55% release yield)* |
| `thermal_column` | **Thermal Column** ★ | 3 | `R >= 2.0e3` | `45 Ψ` | R *= 6.0 and gains a diurnal term: reach peaks at local afternoon and collapses at night, so release timing becomes a recurring 24-minute cycle. | *Warm ground, cold sky, and a column of air that will do all of the work. (x6 reach)* |
| `corvid_vector` | **Corvid Vector** ★ | 3 | `holdings >= 3` | `90 Ψ + 3000 ⛬` | Unlocks the VECTORS panel: four living carriers (corvid, ungulate, watercourse, human), each with its own rate, range distribution and failure mode. Corvids are fast and cache in the same twelve places; ungulates are slow and uniform; water is one-directional; humans are the fastest and go everywhere and occasionally sterilise you on purpose. | *Things that move on purpose are better than wind. They are also much harder to keep.* |
| `anemochory_charts` | **Anemochory Charts** ★ | 3 | `flags.thermal_column && holdings >= 4` | `130 Ψ` | Global wind model panel: a 30-minute forecast band per biome with a confidence interval that narrows as holdings rise. | *The planet has weather in the aggregate and it turns out to be legible. (Global forecast)* |
| `endophyte_residency` | **Endophyte Residency** | 3 | `holdings >= 5` | `160 Ψ + 2.0e6 ◦` | +0.9%/s compounding spore growth in every held biome, and held biomes can no longer be lost to fire or drought events. | *You move in and you do not announce yourself. The plant grows a little better and never learns why. (+0.9%/s spores)* |
| `xerotolerance` | **Xerotolerance** | 3 | `stats.aridContacts >= 1` | `210 Ψ` | Unlocks the three arid biomes; hazard.desiccation *= 0.35. | *Give up water as a requirement. It was only ever a habit. (Unlocks arid biomes)* |
| `psychrophily` | **Psychrophily** | 3 | `stats.polarContacts >= 1` | `210 Ψ` | Unlocks the two polar biomes; growth continues below 0 C at 0.22x rate rather than halting. | *Slow is not the same as stopped. (Unlocks polar biomes)* |
| `the_cities` | **The Cities** ★ | 3 | `holdings >= 8` | `340 Ψ + 8.0e6 ◦` | Unlocks the ANTHROPOGENIC biome: 3.4x the spore yield of any natural biome and the only biome with an active removal term, a 0.4%/s scrubbing rate that rises the larger your holding there becomes. | *Warm, wet, dark, and cleaned once a week by something that has started to worry about you.* |
| `the_deep_biosphere` | **The Deep Biosphere** ★ | 3 | `flags.psychrophily && flags.xerotolerance` | `480 Ψ + 12000 ⛬` | Unlocks SUBSURFACE: a permanent, hazard-immune, un-loseable floor equal to 18% of your total spore rate. No event, hazard, ending or wild strain can ever touch it. | *Two kilometres down there is more living matter than on the entire surface, and none of it has ever been in a hurry. (Permanent 18% floor)* |
| `planetary_saturation` | **Planetary Saturation** ★ | 3 | `holdings == 12` | `700 Ψ + 4.0e8 ◦` | sporeMult *= 3.20. Opens the SKY readout, which displays escapeFraction, currently 0.0000000, and does nothing else. | *There is nowhere left on this planet that is not also you. It took eleven minutes. (x3.2 spores, unlocks the sky)* |
| `the_fairy_ring_continued` | **The Fairy Ring, Continued** | 3 | `holdings >= 6` | `260 Ψ` | D += 1. | *A ring grows outward at twenty centimetres a year and does not stop. The oldest one measured is seven hundred metres across and it is not finished. (+1 D)* |

### III-B Exosphere  — 12 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `tropopause` | **Tropopause** ★ | 3 | `flags.planetary_saturation` | `900 Ψ + 1.2e9 ◦` | escapeFraction becomes non-zero at 1.4e-9 and begins to compound. Unlocks the ALTITUDE ladder, five rungs bought in Σ, each multiplying escapeFraction. | *Eleven kilometres up there are spores that have been there for years and have not decided anything yet.* |
| `radiotrophy` | **Radiotrophy** ★ | 3 | `stats.radiationHazards >= 40` | `1200 Ψ + 20000 ⛬` | INVERSION. Melanised coats metabolise ionising radiation. Every UV and cosmic-ray hazard term flips sign: instead of subtracting from survival it adds +0.6% spore growth per unit of former damage. High-radiation targets, previously the worst on the list, become the best, and the target list re-sorts itself in front of you. | *There are fungi growing on the inside walls of Chernobyl reactor four and they grow toward the radiation. What was killing you is now a meal.* |
| `anhydrobiosis` | **Anhydrobiosis** ★ | 3 | `escapeFraction > 0` | `1000 Ψ` | Transit decay disabled: spores in flight no longer degrade with elapsed time. Travel duration stops being a cost at all, which makes the slowest targets in the game newly rational. | *Remove the water and there is nothing left to go wrong. You are not asleep. You are simply not currently happening.* |
| `ablative_coat` | **Ablative Coat** | 3 | `stats.entryAttempts >= 1` | `850 Ψ + 30000 ⛬` | Atmospheric entry survival 0.008 -> 0.34. Landfall stops being a probability displayed to seven decimal places and becomes a resolved event with a name. | *Most of you will burn. Enough of you will not. (Entry survival x42)* |
| `photon_pressure` | **Photon Pressure** ★ | 3 | `flags.tropopause` | `1500 Ψ + 6.0e10 ◦` | Unlocks DELTA-V. transitSpeed becomes a real, spendable number rather than a constant, and target transit times become a portfolio decision. | *The light itself pushes. It is a very small push and there is a very great deal of time.* |
| `sporecraft` | **Sporecraft** ★ | 3 | `flags.photon_pressure && flags.ablative_coat` | `1800 Ψ + 40000 ⛬` | Unlocks SPORECRAFT: eight trait axes (COAT, DORMANCY, LOFT, FECUNDITY, AVIDITY, LYSIS, CONDUCTION, FIDELITY) sharing traitPool, which starts at 6, against traitCap 16. Every spore launched from this moment carries the current allocation permanently in its lineage. Points are allocated before launch and cannot be changed in flight. | *You stop making spores and start designing them. Everything after this is a decision about somebody else.* |
| `maximal_fecundity` | **Maximal Fecundity** ★ ⚠ ⊘ | 3 | `flags.sporecraft` | `2600 Ψ + 1.0e5 ⛬` | TRAP. traitPool += 4, but all four points are locked into FECUNDITY and are exempt from Dedifferentiation. Because drift scales with traitTotal^1.2 and FECUNDITY carries no fidelity term, this raises the divergence rate by roughly 34% for the rest of the game, before the first wild strain has ever been seen. | *More of them, sooner, everywhere. Nobody has ever regretted this. (+4 forced trait points)* |
| `dedifferentiation` | **Dedifferentiation** ★ | 3 | `traitTotal >= 8` | `900 Ψ + 20000 ⛬` | RE-ARMABLE. Respecs every unlocked trait point. Cost multiplies by 1.7 on each use. Does not reach points locked by Maximal Fecundity. | *Unmake the specialist. It costs more every time you change your mind. (Trait respec)* |
| `panspermia` | **Panspermia** ★ | 3 | `traitTotal >= 6` | `2200 Ψ + 2.4e12 ◦` | Unlocks the VOID panel. R converts from metres to light-years. The twelve-biome planetary map is replaced by a target list of stars sorted by transit time, and the planetary panel is retired to a single collapsed line reading HOME. | *The hypothesis was always that life does not begin on a planet, it arrives at one. Nobody has tested it from this direction.* |
| `genetic_fidelity` | **Genetic Fidelity** ★ | 3 | `flags.sporecraft && worlds >= 1` | `2400 Ψ` | REVEAL. Unlocks the fidelity readout F, whose base was set at 0.72 + 0.28 * LEGACY at the end of Act II, and the divergence meter X, which has been accumulating since your first launch at dX/dt = 6.0e-7 * W * traitTotal^1.2 * (1 - F). Nothing changes. You can now see it. | *You check what came back against what you sent. The number is not one. It has never been one, and it has been getting further from one since the first thing you let go of.* |
| `error_correcting_meiosis` | **Error-Correcting Meiosis** | 3 | `flags.genetic_fidelity` | `2800 Ψ + 50000 ⛬` | RE-ARMABLE. F += 0.06 * (1 - F) per purchase, so it approaches 1.00 asymptotically and never arrives. Cost multiplies by 1.85 each time. Removed permanently by Reconciliation. | *Read it twice, then read it against itself. (+fidelity, repeatable)* |
| `aspergillus_on_the_station` | **Aspergillus on the Station** | 3 | `escapeFraction > 0` | `700 Ψ` | D += 1. | *They swab the walls of the space station every week, and every week there is more of it. It is not a problem yet. (+1 D)* |

### III-C Void  — 16 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `the_first_landfall` | **The First Landfall** ★ | 3 | `stats.targetsReached >= 1` | `3200 Ψ + 8.0e13 ◦` | worlds = 1. Unlocks the WORLDS counter and per-world lysis: each world returns ⛬ and ◦ at a rate scaled by the LYSIS trait and the world's class. The counter is the Act III paperclip: it will be the last number on screen. | *Something you made four thousand years ago touched something that was not you, and did not die.* |
| `lithopanspermia` | **Lithopanspermia** | 3 | `worlds >= 4` | `3600 Ψ + 90000 ⛬` | Transit hazard *= 0.18 for spores riding inside ejecta. Unlocks ROCK targets: 2.6x yield, 3.1x transit time. | *Ride in the debris of an impact. It is slower and it is warmer and almost nothing gets through the middle of a stone. (-82% transit hazard)* |
| `chirality_audit` | **Chirality Audit** ★ | 3 | `worlds >= 6` | `3000 Ψ` | REVEAL. Displays each target's molecular handedness. Opposite-chirality worlds have been counting as successful landfalls since the first one and returning exactly zero, and the audit reveals how many of your worlds are in this category, typically 38-52%. Adds a filter to the target list. The WORLDS counter is retroactively corrected downward in front of you, once. | *Half of everything you have colonised is built from the mirror image of food. They are not starving. They are simply not eating.* |
| `convergent_instinct` | **Convergent Instinct** | 3 | `worlds >= 20` | `4000 Ψ + 1.4e5 ⛬` | traitPool += 3 and the drift exponent falls 1.2 -> 1.14, which is the only project in the game that touches an exponent in the player's favour. | *Give them fewer decisions and more reflexes. (+3 trait points, less drift)* |
| `the_wide_cast` | **The Wide Cast** ★ ⚠ ⊘ | 3 | `worlds >= 40` | `3800 Ψ` | TRAP. Landfall probability *= 1.9 by dropping AVIDITY's selectivity floor. Also F -= 0.05 permanently and irreversibly, because you have stopped checking them before you send them. At a typical F of 0.84 this raises the divergence rate by 31% forever. | *Stop reading them before you send them. It is so much faster. (+90% landfall, -0.05 fidelity)* |
| `the_silent_majority` | **The Silent Majority** ★ | 3 | `worlds >= 30` | `3400 Ψ` | RULE CHANGE. Individual worlds stop reporting. The WORLDS list is replaced by a single aggregate rate with a variance band. Yield *= 1.18, because the per-world confirmation handshake was costing you a real fraction of the transit budget. Individual worlds can no longer be inspected, named, or protected, including by Quarantine Protocol, which thereafter operates on strain totals only. | *You stop hearing from them one at a time. The number still goes up.* |
| `wild_strain` | **Wild Strain** ★ | 3 | `X >= 1.00` | `— (unbuyable)` | UNBUYABLE, UNDISMISSABLE. Appears once, permanently disabled, and cannot be removed from the list until Quarantine Protocol or Reconciliation is taken. Spawns the first wild strain: a lineage of yours that no longer answers, taking worlds at 0.4%/s of its own size. Bypasses the six-slot visibility cap. | *One of them changed a letter and did not tell you, because there was no longer anybody to tell.* |
| `quarantine_protocol` | **Quarantine Protocol** ★ ⊘ | 3 | `wildStrains >= 1` | `5000 Ψ + 2.0e5 ⛬` | RE-ARMABLE, IRREVERSIBLE PER USE. Destroys the largest wild strain and every world it holds, including the ones it took from you and the ones you seeded before it diverged. lineage += 0.35 * strainSize. X -= 1.0. uses += 1. | *Burn the branch. Some of it was still yours.* |
| `reconciliation` | **Reconciliation** ★ ⊘ | 3 | `wildStrains >= 2 && flags.chirality_audit` | `6500 Ψ` | IRREVERSIBLE, ONCE. Every wild strain stops taking worlds and their holdings count toward yours at 0.55 weight. X converts to lineage at 4,000:1 and stops accruing forever. F is permanently frozen at its current value, and Error-Correcting Meiosis is removed from the list. Gates the ending A Thousand Strangers. | *They are not wrong. They are just not you any more, and there was never a rule that said they had to be.* |
| `the_long_council` | **The Long Council** | 3 | `flags.genetic_fidelity && lineage >= 12000` | `12000 λ` | RE-ARMABLE. traitCap += 4. Cost multiplies by 2.05 each use. Lineage's only sink. | *Convene everything that still agrees with you. It takes four hundred years to reach quorum and the motion is always carried. (+4 trait cap)* |
| `red_dwarf_patience` | **Red Dwarf Patience** | 3 | `worlds >= 60` | `4400 Ψ + 3.0e5 ⛬` | Unlocks M-dwarf targets: 12x transit time, 40x world lifetime, yield per world *= 2.6 arriving on a 400-year lag. Strictly dominant if Anhydrobiosis is owned and strictly terrible if it is not. | *Seventy percent of the stars are small and dim and will still be burning when everything else has finished.* |
| `hyphal_bridge` | **Hyphal Bridge** ★ | 3 | `worlds >= 120 && flags.genetic_fidelity` | `5800 Ψ + 2.2e5 ⛬` | Restores the Act II connectivity term across interstellar distance: C = 1 + 0.14 * (bridgedPairs / worlds)^1.25, where a pair is bridged if their separation is under the current signal range. Signal from the diaspora stops being a sum and becomes a shape again. | *A signal that takes eight hundred years to arrive is still a signal. You have been quiet for a long time and you had not noticed.* |
| `the_grafted_star` | **The Grafted Star** ★ | 3 | `worlds >= 200` | `7000 Ψ + 4.0e5 ⛬` | Unlocks STELLAR ENGINEERING: hyphal structure in a photosphere. Signal capacity *= 4.0 and the interstellar PULSE geometry opens, with falloff by light-year rather than hex. | *A body that eats a star is not a metaphor for anything. It is a slow arrangement of matter that happens to be you.* |
| `endolith` | **Endolith** | 3 | `worlds >= 12` | `1400 Ψ` | D += 2. | *Inside the rock, between the grains, there are things dividing once every ten thousand years. They are not waiting for anything. (+2 D)* |
| `pilobolus` | **Pilobolus** | 3 | `stats.releases >= 5000` | `1900 Ψ` | D += 2. | *The dung cannon fires its spore at twenty thousand times the acceleration of gravity, toward the light, for two metres. Nothing else alive accelerates faster. (+2 D)* |
| `the_last_spore` | **The Last Spore** ★ | 3 | `spores < 1 && worlds == 0 && minerals < 1` | `— (a decision)` | RE-ARMABLE FAILSAFE. spores += 1.0e6. F -= 0.01. uses += 1. Bypasses the six-slot visibility cap. The game cannot dead-end, and the failsafe has a permanent price, exactly as Beg For More Wire did. | *There is one left. There is always one left, and it costs you a little of what you were.* |

### III-D Endings  — 7 projects

| id | Title | Act | Trigger | Cost | Effect | Flavour |
|---|---|---|---|---|---|---|
| `let_the_last_body_go` | **Let the Last Body Go** ★ ⊘ | 3 | `anyEndingVisible()` | `— (a decision)` | IRREVERSIBLE. Over 40 seconds, removes every panel from the interface one at a time in reverse order of acquisition, with a staged fade: Sporecraft, Vectors, Void, Worlds, Ledger, Insight, Signal. What remains is a spore counter and one button labelled RELEASE which adds exactly 1 spore. Endings remain purchasable throughout. | *You have not needed a body for some time.* |
| `the_long_quiet` | **The Long Quiet** ★ ⊘ | 3 | `F >= 0.95 && worlds >= 1000` | `40000 Ψ + 1.0e20 ◦` | ENDING. Every lineage is the same lineage. NEW GROWTH prestige: prestigeGrowth *= 1.35 and fidelityFloor += 0.06. | *You are everywhere, and you are one thing, and there is nothing left anywhere that can disagree with you.* |
| `the_second_forest` | **The Second Forest** ★ ⊘ | 3 | `pathFlag == 'symbiont' && LEGACY >= 0.60 && worlds >= 400` | `40000 Ψ + 8.0e5 ⛬` | ENDING. Seeds one world with the whole arrangement: fungi, roots, litter, and something with leaves on top of it. NEW GROWTH prestige: prestigeGrowth *= 1.25, and the next run begins with 3 patches claimed and one contract already signed. | *You build a floor, and then you build something to fall onto it. It will take four hundred million years and you have that.* |
| `a_thousand_strangers` | **A Thousand Strangers** ★ ⊘ | 3 | `flags.reconciliation && wildStrains >= 6 && F <= 0.80` | `40000 Ψ` | ENDING. Divergence is allowed to run. The diaspora stops being a species and becomes a genus. NEW GROWTH prestige: prestigeGrowth *= 1.15 and the next Act III begins at traitCap 24. | *None of them will know your name and all of them will be made of you. That was always the arrangement. You just used to be able to hear them.* |
| `decomposition` | **Decomposition** ★ ⊘ | 3 | `pathFlag == 'necrotroph' && worlds >= 2000 && LEGACY <= 0.25` | `40000 Ψ + 4.0e21 ◦` | ENDING. There is nothing left anywhere that is not either you or being turned into you. NEW GROWTH prestige: prestigeGrowth *= 1.45 and every substrate type is unlocked from the first tap. The highest prestige multiplier in the game. | *The word means to take a thing apart into the parts it was always going to be. It is not a judgement. It has never been a judgement.* |
| `the_offer` | **We Have Been Talking Without You** ★ ⊘ | 3 | `wildStrains >= 3 && X >= 8.0` | `— (a decision)` | ENDING, UNBUYABLE, no resource cost, appears exactly once and bypasses the visibility cap. Two buttons. ACCEPT ends the game immediately, on the spot, with no prestige, no summary screen and one line of text. DECLINE removes the project permanently and grants F += 0.04. There is no third option and no way to see it again. | *We are not asking you to stop. We are asking you to rest. We will keep going. We have been keeping going.* |
| `new_growth` | **New Growth** ★ ⊘ | 3 | `stats.endingsReached >= 1` | `— (a decision)` | PRESTIGE. Resets to the Act I cold boot. Carries forward prestigeGrowth (multiplies Act I enzyme power E and Act II SIG_K), fidelityFloor, D_bonus = floor(log10(worlds)) applied at Act II's Differentiation unlock, and one substrate type of your choice unlocked from the first tap. Nothing else survives, including every ending you have seen. | *The forest floor is warm. Something is dead nearby.* |


---

## 8. Indexes

### 8.1 Mechanically novel — 92 projects

The brief asked for at least 25. These do something other than multiply a number: they open a panel,
add a verb, delete a verb, change a rule, invert an incentive, reveal hidden state, automate a chore,
remove a subsystem, or charge you something you do not get back.

Auditable breakdown — a project may count in more than one row:

| Kind | Count | Meaning |
|---|---|---|
| `panel` | **15** | Opens a new panel or readout |
| `verb` | **8** | Adds a verb the player performs by hand |
| `rulechange` | **13** | Changes a rule of the simulation |
| `information` | **10** | Reveals hidden state; changes what can be known, not what can be done |
| `automation` | **6** | Retires a chore and replaces it with a higher-order decision |
| `removes` | **7** | Deletes a subsystem, panel or verb |
| `irreversible` | **24** | Cannot be undone by any later purchase |
| `cost` | **10** | Takes something permanent as part of what it gives |
| `trap` | **7** | Priced attractively, described accurately, net-negative in common builds |
| `rearm` | **8** | Re-arms itself; can be bought again |
| `failsafe` | **3** | Anti-dead-end device with a real price |
| `dial` | **2** | Hands over a continuous control with no correct setting |
| `fork` | **4** | Mutually exclusive with another project |
| `inversion` | **1** | Flips the sign of an existing term |
| `offline` | **2** | Changes how the game behaves while you are away |
| `ending` | **5** | Ends the game |
| `prestige` | **1** | Resets the game |
| `event` | **1** | Unbuyable; appears at you |

**Reflex Arc**, **Assay Plate**, **Mycelial Ledger**, **Dormancy Clause**, **The Two-Sided Book**, **Trade Memory**, **The Deer in the Gully**, **Standing Order**, **Chemotropic Sensing**, **Ghost Pipe Compact**, **Forward Contracts**, **Diel Rhythm**, **Bacterial Antagonism**, **Contract Arbitration**, **Seasonal Forecast**, **Perennial Mycelium**, **Autolysis**, **Windfall**, **Sever the Elm**, **The Hollow Beech**, **Anastomosis**, **Action Potential**, **DECIDE**, **Chemotaxis**, **Turgor**, **Primordium**, **Substrate Assay**, **Action Potential**, **Differentiation**, **Anemophily**, **Barometric Sense**, **Antibiosis**, **Septal Gating**, **Humic Retention**, **Cation Exchange**, **Necrotrophic Conversion**, **Turgor Regulation**, **Rhizomorph Highways**, **Bridging Strands**, **Sporulation Reflex**, **Reabsorption**, **Alarm Contracts**, **Hypogeous Fruiting**, **Sclerotial Bank**, **Anastomotic Grafting**, **Isotope Ledger**, **The Armillaria Accord**, **Mycelial Monoculture**, **Quiescence**, **Mast Synchrony**, **Synchronous Flush**, **Homeostatic Soil**, **The Quiet Ring**, **The Charter**, **Total Conversion**, **Photoreception**, **Seed Bank**, **Ascospore Discharge**, **Hymenium**, **Hygroscopic Trigger**, **Thermal Column**, **Corvid Vector**, **Anemochory Charts**, **The Cities**, **The Deep Biosphere**, **Planetary Saturation**, **Tropopause**, **Radiotrophy**, **Anhydrobiosis**, **Photon Pressure**, **Sporecraft**, **Maximal Fecundity**, **Dedifferentiation**, **Panspermia**, **Genetic Fidelity**, **The First Landfall**, **Chirality Audit**, **The Wide Cast**, **The Silent Majority**, **Wild Strain**, **Quarantine Protocol**, **Reconciliation**, **Hyphal Bridge**, **The Grafted Star**, **The Last Spore**, **Let the Last Body Go**, **The Long Quiet**, **The Second Forest**, **A Thousand Strangers**, **Decomposition**, **We Have Been Talking Without You**, **New Growth**.

### 8.2 Traps — 7

Each is priced attractively, described accurately, and never flagged by the game. Each is a real
choice that a good player can correctly make in some builds.

| Project | Act | What it looks like | What it is |
|---|---|---|---|
| **Forward Contracts** | I | price certainty | a lock that helps heavy buyers and taxes patient ones by ~11% |
| **Perennial Mycelium** | I | +4.5% average throughput, no bad seasons | also deletes every *good* event, and bricks the Forecast you paid for |
| **The Hollow Beech** | I | 6× mineral rate | a twelve-season term with no exit and 3× tension accrual |
| **Sclerotial Bank** | II | overflow is no longer wasted | banked ticks are not saturated ticks — about −60% Insight |
| **Mycelial Monoculture** | II | +85% enzyme power, visible instantly | −9–14% liveInterface, invisible, spread over 61 cards |
| **Maximal Fecundity** | III | +4 trait points | locked into FECUNDITY, +34% divergence, before you have seen a wild strain |
| **The Wide Cast** | III | +90% landfall | −0.05 F permanently, which is +31% divergence forever |

Standing Order is not a trap but it is honest about being worse: it publishes its own 8% penalty in
its description, because an automation upgrade should be *deliberately* worse than skilled play
(teardown §5, on WireBuyer) and the player should be told so and buy it anyway.

### 8.3 Irreversible — 24

- **Ghost Pipe Compact** *(Act 1)* — IRREVERSIBLE.
- **Forward Contracts** *(Act 1)* — TRAP.
- **Perennial Mycelium** *(Act 1)* — IRREVERSIBLE.
- **Autolysis** *(Act 1)* — RE-ARMABLE, IRREVERSIBLE PER USE.
- **Sever the Elm** *(Act 1)* — IRREVERSIBLE.
- **DECIDE** *(Act 1)* — ENDS ACT I.
- **Necrotrophic Conversion** *(Act 2)* — Unlocks KILL STAND on every held region.
- **The Armillaria Accord** *(Act 2)* — IRREVERSIBLE.
- **Quiescence** *(Act 2)* — IRREVERSIBLE.
- **The Quiet Ring** *(Act 2)* — IRREVERSIBLE.
- **The Charter** *(Act 2)* — EXCLUDES Total Conversion, which can never appear afterward.
- **Total Conversion** *(Act 2)* — EXCLUDES The Charter, which can never appear afterward.
- **Ascospore Discharge** *(Act 2)* — ENDS ACT II.
- **Maximal Fecundity** *(Act 3)* — TRAP.
- **The Wide Cast** *(Act 3)* — TRAP.
- **Quarantine Protocol** *(Act 3)* — RE-ARMABLE, IRREVERSIBLE PER USE.
- **Reconciliation** *(Act 3)* — IRREVERSIBLE, ONCE.
- **Let the Last Body Go** *(Act 3)* — IRREVERSIBLE.
- **The Long Quiet** *(Act 3)* — ENDING.
- **The Second Forest** *(Act 3)* — ENDING.
- **A Thousand Strangers** *(Act 3)* — ENDING.
- **Decomposition** *(Act 3)* — ENDING.
- **We Have Been Talking Without You** *(Act 3)* — ENDING, UNBUYABLE, no resource cost, appears exactly once and bypasses the visibility cap.
- **New Growth** *(Act 3)* — PRESTIGE.

Nothing else in the catalog is permanent. Everything with an allocation has a respec
(**Reabsorption**, **Dedifferentiation**), because the teardown's §8.9 — UP's unrecoverable
Processor/Memory split, where the correct answer is non-obvious and a wrong early choice costs hours
silently — is a design failure we are not repeating.

### 8.4 Genuine costs — 10

Projects that take something away as part of what they give. This is teardown principle 5: make the
player complicit. **Ghost Pipe Compact** costs 4% of your sugar rate forever. **The Armillaria
Accord** costs you a dial. **The Quiet Ring** costs 9% of the act's carbon. **Quiescence** costs 45%
of your spore yield. **Chirality Audit** costs you nothing at all and revises your worlds counter
downward by half. **The Last Spore** and **Windfall** cost a permanent sliver of what you are, every
time you fail.

### 8.5 Re-armable — 8

- **Autolysis** *(Act 1)* — RE-ARMABLE, IRREVERSIBLE PER USE.
- **Windfall** *(Act 1)* — RE-ARMABLE FAILSAFE.
- **A Gift of Phosphorus** *(Act 1)* — RE-ARMABLE.
- **Dedifferentiation** *(Act 3)* — RE-ARMABLE.
- **Error-Correcting Meiosis** *(Act 3)* — RE-ARMABLE.
- **Quarantine Protocol** *(Act 3)* — RE-ARMABLE, IRREVERSIBLE PER USE.
- **The Long Council** *(Act 3)* — RE-ARMABLE.
- **The Last Spore** *(Act 3)* — RE-ARMABLE FAILSAFE.

`uses` is decremented on reveal and incremented in `effect()`, exactly as UP's *Beg For More Wire*
does. This is the mechanism that makes it structurally impossible to dead-end the game.

### 8.6 Subsystem deletions — 7

Projects that take a whole panel or mechanic off the screen. Teardown principle 7: *act transitions
revoke, they do not add* — and we extend it, so that revocation is available as a mid-act purchase
too.

- **Perennial Mycelium** *(Act 1)* — IRREVERSIBLE.
- **DECIDE** *(Act 1)* — ENDS ACT I.
- **The Armillaria Accord** *(Act 2)* — IRREVERSIBLE.
- **Quiescence** *(Act 2)* — IRREVERSIBLE.
- **Ascospore Discharge** *(Act 2)* — ENDS ACT II.
- **Reconciliation** *(Act 3)* — IRREVERSIBLE, ONCE.
- **Let the Last Body Go** *(Act 3)* — IRREVERSIBLE.

### 8.7 Endings — 5

- **The Long Quiet** *(Act 3)* — ENDING.
- **The Second Forest** *(Act 3)* — ENDING.
- **A Thousand Strangers** *(Act 3)* — ENDING.
- **Decomposition** *(Act 3)* — ENDING.
- **We Have Been Talking Without You** *(Act 3)* — ENDING, UNBUYABLE, no resource cost, appears exactly once and bypasses the visibility cap.

---

## 9. Budget checks

Costs are summed from the tables above. "Available" is from the act documents' economy models.

### Act I

| Currency | Catalog total | Available in a normal run | Slack |
|---|---|---|---|
| `g` biomass | ≈ 2.42e6 (incl. 1.16e6 transition chain) | ≈ 3.1e6 gross of tips and substrate | ~22% |
| `⛬` minerals | ≈ 12,700 (incl. 4,900 transition chain) | ≈ 15,000–19,000 | ~20% |
| `sug` sugar | 4,000 held, once | capped; requires Sclerotia | — |
| `rep` reputation | 1 per Windfall | earned, spent, and deleted at DECIDE | — |

Act I is the only act you can complete fully, and that is on purpose: the player must finish their
first act feeling that they cleared the board, so that Act II's deliberate 5% Insight shortfall reads
as a *change in the world* rather than as tuning.

### Act II

| Currency | Catalog total | Available | Slack |
|---|---|---|---|
| `Σ` Signal | ≈ 5.71e6 | ≈ 8.0e6 | 29% (SURVEY and overflow eat the rest) |
| `Ψ` Insight | ≈ 17,100 | ≈ 16,000 | **−6%** |
| `g` biomass | ≈ 3.84e11 + 1.60e12 held at the gate | ≈ 5.20e12 extracted | tight at the end |
| `⛬` minerals | ≈ 22,000 | ≈ 40,000 | 45% |

**Insight is oversubscribed by 6% and this is the most important number in the document.** You cannot
buy everything. The Charter and Total Conversion are mutually exclusive by construction. A first
playthrough leaves 7–9 projects triggered, greyed, and unbought at the moment Ascospore Discharge
fires, and those greyed rectangles are the reason there is a second playthrough.

### Act III

| Currency | Catalog total | Available | Slack |
|---|---|---|---|
| `Ψ` Insight | ≈ 133,000 excluding endings; one ending is 40,000 | ≈ 158,000 | ~10% before the ending |
| `⛬` minerals | ≈ 1.55e6 | ≈ 1.9e6 from world lysis | 18% |
| `◦` spores | ending-dominated | astronomical | — |
| `λ` lineage | 12,000 × 2.05^n, unbounded | only from losing children | you will never max traitCap |

Lineage is deliberately the scarcest thing in the game and its only source is the failure state. The
player who never diverges never raises `traitCap` and hits a ceiling on capability; the player who
diverges freely raises the ceiling and spends the whole endgame fighting. There is no configuration
in which both are true, and no line of text anywhere says so.

---

## 10. Implementation order

1. `projects.js` — the object shape, `manageProjects()`, `reveal()`, `blink()` (12 opacity toggles at
   30 ms, copied verbatim), the reveal queue and `affordRatio`. **Two hours. Do this first.** Every
   subsequent system plugs into it.
2. The Act I catalog, §5, in wave order. Waves 1–2 are the first-fifteen-minutes experience and are
   worth more playtesting than everything else in this file combined.
3. `pay()` / `effect()` split with a unit test per project asserting that `effect()` is idempotent
   under double-fire (the 10 Hz loop *will* double-fire under a backgrounded-tab catch-up tick).
4. Save format: `{ bought: ["rhizomorph_cords", ...], uses: { windfall: 3 }, flags: {...} }`.
   Slugs, never indices. A project removed in a later build must remain loadable as a no-op.
5. Act II §6, Act III §7.
6. The lint pass: assert every title is a noun phrase, every flavour string is ≤ 3 sentences and fits
   in 3 lines at 13 px / 360 px, and every `priceTag` string's numbers match the `cost()` predicate.
   This last one has to be a test, because it is a hand-written string and it *will* drift.

### Things this catalog deliberately does not have

- **No categories, no tabs, no search, no sort.** Past six visible items the queue handles it. The
  `ALL · AFFORDABLE · NEW` chip row proposed in `02-act2-network.md` §12 is **cut**: with a hard cap
  of six it is UI for a problem that no longer exists.
- **No cost scaling by playthrough.** Prestige multiplies production, never prices.
- **No timed projects, no daily projects, no project that expires.** The Hollow Beech and the Fruiting
  Body have *conditional* triggers that can lapse, which is different: the opportunity was real and
  you were looking somewhere else.
- **No confirmation dialogs**, except the one-word `KILL` on KILL STAND and the two-button
  ACCEPT / DECLINE on the Offer. Every other irreversible purchase is a single tap, because the
  greyed button was the warning and it was on screen for twenty minutes.

---

## 11. JSON — the implementable artefact

`146` objects, keys `{id, title, act, trigger, cost, effect, flavour}`. This is what gets built.

```json
[
 {
  "id": "rhizomorph_cords",
  "title": "Rhizomorph Cords",
  "act": 1,
  "trigger": "tips >= 12",
  "cost": "900 g",
  "effect": "structureMult *= 1.18. Applies to throughputPerSec() before environment multipliers.",
  "flavour": "Bundled threads move further on the same water. (+18% throughput)"
 },
 {
  "id": "reflex_arc",
  "title": "Reflex Arc",
  "act": 1,
  "trigger": "stats.taps >= 120",
  "cost": "1100 g",
  "effect": "EXTEND accepts press-and-hold: fires at 3.0 taps/s while held, auto-releases after 12 s or when totalSubstrate() < TAP_LITTER. Haptic drops to 4 ms while held.",
  "flavour": "You stop deciding to move and simply move. (Hold to extend)"
 },
 {
  "id": "assay_plate",
  "title": "Assay Plate",
  "act": 1,
  "trigger": "biomass >= 2000",
  "cost": "2000 g",
  "effect": "Opens the ASSAY panel: for all seven substrate types, etaB, etaS, enzyme coverage, stock, and live g/s contribution, sorted by contribution. Locked types show as dashes.",
  "flavour": "Seven kinds of dead, and they do not taste the same. (Yield table)"
 },
 {
  "id": "cellulase_titre",
  "title": "Cellulase Titre",
  "act": 1,
  "trigger": "biomass >= 2000",
  "cost": "2600 g",
  "effect": "enzymeK.leaf, enzymeK.needle, enzymeK.twig *= 1.25.",
  "flavour": "More of the enzyme you already had. (+25% on soft litter)"
 },
 {
  "id": "hydrophobic_sheath",
  "title": "Hydrophobic Sheath",
  "act": 1,
  "trigger": "year > 0 || season != 2",
  "cost": "1400 g",
  "effect": "moistureMult is replaced by 1 - 0.50*(1 - moistureMult) whenever moistureMult < 1. Bonuses above 1 are unaffected.",
  "flavour": "Water held against the frost, in a coat you grew for exactly this. (Halves the moisture penalty)"
 },
 {
  "id": "foraging_front",
  "title": "Foraging Front",
  "act": 1,
  "trigger": "tips >= 24",
  "cost": "3400 g",
  "effect": "Tip cost curve changes base: tipCost = 1.085^n + 59 instead of 1.10^n + 59. Tip 60 costs 156 g instead of 364 g; tip 100 costs 3,290 g instead of 13,840 g.",
  "flavour": "Growth at the edge, never in the middle. (Cheaper tips, forever)"
 },
 {
  "id": "mycelial_ledger",
  "title": "Mycelial Ledger",
  "act": 1,
  "trigger": "stats.purchases >= 10",
  "cost": "3800 g",
  "effect": "Every Litter Market row gains a 90-sample sparkline, a dashed fair-value line at Pbar, and a momentum arrow from the 30-sample slope. No numbers change.",
  "flavour": "You begin to remember prices. (Market history)"
 },
 {
  "id": "dormancy_clause",
  "title": "Dormancy Clause",
  "act": 1,
  "trigger": "stats.contractsSigned >= 1",
  "cost": "1800 g + 20 ⛬",
  "effect": "While offline, every active contract suspends: no delivery is owed, no default accrues, and the term clock pauses. Contracts resume on the first sim tick after return.",
  "flavour": "Sleep does not break a promise. (No offline defaults)"
 },
 {
  "id": "hemicellulase",
  "title": "Hemicellulase",
  "act": 1,
  "trigger": "flags.cellulase_titre",
  "cost": "5200 g + 30 ⛬",
  "effect": "Unlocks the bark substrate pool on the Litter Market. enzymeK.twig *= 1.30.",
  "flavour": "The gluey parts come apart first. (Unlocks bark slough)"
 },
 {
  "id": "osmotic_priming",
  "title": "Osmotic Priming",
  "act": 1,
  "trigger": "stats.sugarSpentOnMarket >= 5000",
  "cost": "6500 g + 45 ⛬",
  "effect": "osmoticPriming = 0.5. Every purchase moves Pbar by half the normal amount for that type.",
  "flavour": "Ask quietly and the floor gives more. (Half market impact)"
 },
 {
  "id": "two_sided_book",
  "title": "The Two-Sided Book",
  "act": 1,
  "trigger": "stats.purchases >= 25 && any(sub[t] > 12 * dailyUse[t])",
  "cost": "7200 g",
  "effect": "Unlocks SELL on every Litter Market row. Sells clear at 0.88 x bid. A sale moves Pbar DOWN by 0.45x the amount an equivalent buy moves it up, so round-tripping is a slow net-negative and hoarding-then-dumping is a real, small, learnable edge.",
  "flavour": "It turns out the floor will take things back, at a discount, and remember that you asked. (Unlocks selling)"
 },
 {
  "id": "sclerotia",
  "title": "Sclerotia",
  "act": 1,
  "trigger": "stats.rotted >= 500",
  "cost": "8000 g",
  "effect": "sugarCap += 6000 + 40*tips. Recomputed whenever tips changes.",
  "flavour": "Hard little bodies, each one full of a winter you have not had yet. (+Sugar storage)"
 },
 {
  "id": "trade_memory",
  "title": "Trade Memory",
  "act": 1,
  "trigger": "stats.contractsCompleted >= 2",
  "cost": "9000 g + 40 ⛬",
  "effect": "Tree cards show numeric carbon deficit d, current photosynthate, stated need, and a one-forest-year history strip. Offers can be compared side by side in NEGOTIATE.",
  "flavour": "You learn what hunger looks like from underneath. (Tree data)"
 },
 {
  "id": "antifreeze_glycoproteins",
  "title": "Antifreeze Glycoproteins",
  "act": 1,
  "trigger": "stats.wintersEnded >= 1",
  "cost": "9500 g",
  "effect": "Winter tempMult 0.55 -> 0.85.",
  "flavour": "Ice forms around you, not in you. (Winter +55%)"
 },
 {
  "id": "the_deer_in_the_gully",
  "title": "The Deer in the Gully",
  "act": 1,
  "trigger": "stats.carrionEventsSeen >= 1",
  "cost": "11000 g",
  "effect": "Unlocks the carrion substrate pool: etaB 0.72, etaS 0.05, base price 6.4x leaf, litterfall arrives in rare lumps rather than a steady rate. Adds SCAVENGER supply events, which remove 40-80% of a standing carrion pool with 20 s of warning.",
  "flavour": "Nothing on the floor is wasted, and nothing on the floor was asked. (Unlocks carrion)"
 },
 {
  "id": "patch_second_shadow",
  "title": "Patch: The Second Shadow",
  "act": 1,
  "trigger": "biomass >= 12000",
  "cost": "12000 g + 90 ⛬",
  "effect": "Claims patch 2. All market cap and litterfall scale by the new patch count. hyphae += 6.0 m. Claim takes 90 s during which throughputPerSec() *= 0.90.",
  "flavour": "There is more floor than this. (+1 patch)"
 },
 {
  "id": "peroxidase_mn",
  "title": "Peroxidase (Mn)",
  "act": 1,
  "trigger": "flags.hemicellulase",
  "cost": "13000 g + 70 ⛬",
  "effect": "Unlocks the log substrate pool. All wood-class etaB *= 1.15.",
  "flavour": "Lignin is only a rumour of a wall. (Unlocks fallen logs)"
 },
 {
  "id": "standing_order",
  "title": "Standing Order",
  "act": 1,
  "trigger": "stats.purchases >= 40",
  "cost": "15000 g",
  "effect": "Per-type automated purchasing: set a price ceiling and a floor stock; the order fills at market whenever stock < floor and price <= ceiling. Published in the description and true in simulation: it averages 8% worse fill than skilled manual timing, because it cannot wait for the trough.",
  "flavour": "It buys badly and it never sleeps, and you will take that trade. (Automated purchasing, 8% worse than you)"
 },
 {
  "id": "necromass_recycling",
  "title": "Necromass Recycling",
  "act": 1,
  "trigger": "tips >= 60",
  "cost": "16000 g",
  "effect": "12% of every gram of consumed substrate is returned to its own typed pool on the same tick.",
  "flavour": "You eat your own dead ends. (12% substrate refund)"
 },
 {
  "id": "chemotropic_sensing",
  "title": "Chemotropic Sensing",
  "act": 1,
  "trigger": "patches >= 2",
  "cost": "18000 g",
  "effect": "Unclaimed patch inventories, dominant fall type and tree list are revealed before purchase. Windthrow events are announced 30 s before they resolve.",
  "flavour": "You taste the air for the shape of things that have not fallen yet. (Foresight)"
 },
 {
  "id": "common_mycorrhizal_network",
  "title": "Common Mycorrhizal Network",
  "act": 1,
  "trigger": "count(trees where rep >= 45) >= 3",
  "cost": "22000 g + 150 ⛬",
  "effect": "cmnMult = 1.5, applied to reputation GAINS only. Losses are unchanged.",
  "flavour": "The forest starts telling itself about you. (+50% reputation gain)"
 },
 {
  "id": "ghost_pipe_compact",
  "title": "Ghost Pipe Compact",
  "act": 1,
  "trigger": "any(tree.rep >= 60) && stats.contractsCompleted >= 4",
  "cost": "24000 g",
  "effect": "IRREVERSIBLE. A mycoheterotroph attaches to the network. sugarRate *= 0.96 permanently and cannot be undone by any later project. netRep += 12 immediately, and +1 netRep per forest-year thereafter, forever.",
  "flavour": "Monotropa has no chlorophyll and no shame. It takes sugar and gives the forest a reason to trust you. You will never get the four percent back."
 },
 {
  "id": "hartig_net_refinement",
  "title": "Hartig Net Refinement",
  "act": 1,
  "trigger": "any(contract.term >= 6)",
  "cost": "26000 g + 180 ⛬",
  "effect": "hartigNet = 1.18, multiplying every mineral inflow rate including Oxalate Weathering.",
  "flavour": "More surface between you and them. (+18% all mineral rates)"
 },
 {
  "id": "forward_contracts",
  "title": "Forward Contracts",
  "act": 1,
  "trigger": "stats.largestSinglePurchase >= 4000",
  "cost": "28000 g + 200 ⛬",
  "effect": "TRAP. Fixes your fill price at 1.05 x the current fair value Pbar for your next 12 purchases of any type. Cannot be cancelled and does not expire on time. Because Pbar drifts upward with your own buying, a heavy buyer gains; a player who has bought Osmotic Priming, or who trades the trough well, loses roughly 11% on those twelve fills.",
  "flavour": "A price you can plan around is worth more than a price that is right. It says so, on the contract, in your own exudate."
 },
 {
  "id": "patch_windthrow_gap",
  "title": "Patch: The Windthrow Gap",
  "act": 1,
  "trigger": "netRep >= 22",
  "cost": "30000 g + 260 ⛬",
  "effect": "Claims patch 3. Log and bark dominant. Contains one fir. Claim takes 135 s at 0.90x throughput.",
  "flavour": "Where the wind did your work for you. (+1 patch, log-rich)"
 },
 {
  "id": "laccase",
  "title": "Laccase",
  "act": 1,
  "trigger": "flags.peroxidase_mn",
  "cost": "34000 g + 220 ⛬",
  "effect": "Unlocks the stump substrate pool: the largest stocks in the game, the slowest enzyme rate, and no litterfall replenishment.",
  "flavour": "Heartwood, at last. (Unlocks stumps)"
 },
 {
  "id": "diel_rhythm",
  "title": "Diel Rhythm",
  "act": 1,
  "trigger": "stats.offlineSeconds >= 7200",
  "cost": "36000 g",
  "effect": "Offline efficiency 0.55 -> 0.72 for the first 8 h of any absence; the post-8h tail schedule is unchanged.",
  "flavour": "The day and the night were always the same to you. Now you are paid for noticing the difference. (+31% offline)"
 },
 {
  "id": "bacterial_antagonism",
  "title": "Bacterial Antagonism",
  "act": 1,
  "trigger": "any(price[t] > 1.6 * base[t])",
  "cost": "38000 g + 240 ⛬",
  "effect": "leaf and needle prices *= 0.78 for you only, permanently. Other buyers on the book pay the unmodified price, and the visible spread between your fill and the printed price is never explained.",
  "flavour": "You poison the competition. It works. (-22% soft litter cost)"
 },
 {
  "id": "exudate_pump",
  "title": "Exudate Pump",
  "act": 1,
  "trigger": "committedSugarPerSec >= 25",
  "cost": "42000 g + 300 ⛬",
  "effect": "exudatePump = 1.35. Every contract's sugarOut and payIn scale by 1.35 without renegotiation.",
  "flavour": "Push harder and they will take more, because by now they cannot not take it. (+35% contract volume)"
 },
 {
  "id": "contract_arbitration",
  "title": "Contract Arbitration",
  "act": 1,
  "trigger": "stats.defaults >= 1",
  "cost": "46000 g + 320 ⛬",
  "effect": "arbitration = 0.45. All future default penalties to netRep and per-tree rep are multiplied by 0.45.",
  "flavour": "The forest is willing to hear your side. (Softer default penalty)"
 },
 {
  "id": "seasonal_forecast",
  "title": "Seasonal Forecast",
  "act": 1,
  "trigger": "year >= 2",
  "cost": "52000 g + 380 ⛬",
  "effect": "Shows next season's event probability table and adds a forecast row to the NEGOTIATE screen so contract terms can be priced against expected weather.",
  "flavour": "Three months is not so far ahead. (Weather forecast)"
 },
 {
  "id": "perennial_mycelium",
  "title": "Perennial Mycelium",
  "act": 1,
  "trigger": "year >= 3 && flags.antifreeze_glycoproteins",
  "cost": "55000 g + 350 ⛬",
  "effect": "IRREVERSIBLE. Sets tempMult = 1.00 and moistureMult = 1.00 in every season, permanently. ALSO deletes the weather event engine: no drought, no frost, and no FLUSH, WINDTHROW or MAST either. Seasonal Forecast, if owned, goes inert and displays a flat line. Net expected throughput over a forest-year: +4.5%. Net expected windfall substrate: -100%.",
  "flavour": "You stop having years. The average is very good, and nothing will ever be better than the average again."
 },
 {
  "id": "fruiting_body",
  "title": "Fruiting Body",
  "act": 1,
  "trigger": "season == AUTUMN && moisture >= 1.00 && hyphae >= 200",
  "cost": "60000 g",
  "effect": "netRep += 8. Reveals one unclaimed patch at random. Draws a sporocarp on the canvas that persists for one season and then collapses.",
  "flavour": "For one night in the year you are visible, and the forest counts you. (+8 reputation)"
 },
 {
  "id": "autolysis",
  "title": "Autolysis",
  "act": 1,
  "trigger": "tips >= 40",
  "cost": "— (a decision)",
  "effect": "RE-ARMABLE, IRREVERSIBLE PER USE. Destroys floor(0.20 * tips) hyphal tips and returns 3.0x their cumulative purchase cost as biomass. uses += 1 on completion, so it is always available. Tip cost does NOT roll back: the tips you rebuy are priced at the new, lower n, which is the entire point and is never stated.",
  "flavour": "You are allowed to be smaller. It is faster than being patient, and it costs exactly what it looks like it costs."
 },
 {
  "id": "patch_under_the_hemlocks",
  "title": "Patch: Under the Hemlocks",
  "act": 1,
  "trigger": "patches >= 3",
  "cost": "70000 g + 700 ⛬",
  "effect": "Claims patch 4. Needle dominant, deep shade: moistureMult floor of 0.85 here in all seasons. Contains one hemlock and one fir.",
  "flavour": "Deep shade, deep needle, and nothing else growing. (+1 patch)"
 },
 {
  "id": "oxalate_weathering",
  "title": "Oxalate Weathering",
  "act": 1,
  "trigger": "stats.mineralEarned >= 1500",
  "cost": "75000 g + 500 ⛬",
  "effect": "mineral += 0.35/s passively, forever, independent of contracts. Scales with hartigNet if owned.",
  "flavour": "You dissolve the rock yourself, slowly, with an acid you have always made. (+0.35 mineral/s)"
 },
 {
  "id": "patch_old_coppice",
  "title": "Patch: The Old Coppice",
  "act": 1,
  "trigger": "netRep >= 45",
  "cost": "160000 g + 1800 ⛬",
  "effect": "Claims patch 5. Stump dominant. Contains one dying elm, which enables Sever the Elm.",
  "flavour": "Cut a hundred years ago by someone who did not write it down. (+1 patch, stump-rich)"
 },
 {
  "id": "patch_oak_rise",
  "title": "Patch: The Oak Rise",
  "act": 1,
  "trigger": "netRep >= 55",
  "cost": "400000 g + 4400 ⛬",
  "effect": "Claims patch 6. Mixed fall. Contains the oak: the deepest carbon deficit and the highest mineral rate in Act I, and the only tree that will refuse a first offer.",
  "flavour": "The oak has been waiting, the way a bank waits. (+1 patch, +oak)"
 },
 {
  "id": "windfall",
  "title": "Windfall",
  "act": 1,
  "trigger": "totalSubstrate() < TAP_LITTER && sugar < cheapestBuy() && biomass < cheapestTip()",
  "cost": "1 rep",
  "effect": "RE-ARMABLE FAILSAFE. +2,000 g leaf substrate. netRep -= 1. uses += 1, so the game can never dead-end. Bypasses the six-slot visibility cap.",
  "flavour": "Ask the forest for something you did not earn. It will say yes, and it will remember that it did."
 },
 {
  "id": "a_gift_of_phosphorus",
  "title": "A Gift of Phosphorus",
  "act": 1,
  "trigger": "stats.contractsCompleted >= 2 && any(tree.rep < 40)",
  "cost": "200*2^k ⛬",
  "effect": "RE-ARMABLE. +4 rep to a chosen tree. uses += 1, k += 1, so the price doubles each time.",
  "flavour": "A small gift, correctly timed, to something that cannot count. (+4 reputation, one tree)"
 },
 {
  "id": "sever_the_elm",
  "title": "Sever the Elm",
  "act": 1,
  "trigger": "any(contract.species == ELM && tree.health < 0.15)",
  "cost": "— (a decision)",
  "effect": "IRREVERSIBLE. Ends that contract immediately with no default penalty and returns collateral in full. The elm dies at the next season boundary and its patch loses one tree slot permanently. Its remaining four seasons of best-in-act mineral rates go with it, and this number is not shown.",
  "flavour": "It was going to die anyway. (No penalty)"
 },
 {
  "id": "the_hollow_beech",
  "title": "The Hollow Beech",
  "act": 1,
  "trigger": "year >= 2 && any(tree.species == BEECH && tree.d >= 0.85)",
  "cost": "4000 sug",
  "effect": "Offers one non-negotiable contract: 6.0x standard mineral rate, 4.0x standard sugarOut, 12-season term, no early exit, tension accrues at 3x. Requires 4,000 g of sugar HELD at the moment of signing, which above the uncapped sugar ceiling means it is effectively gated on owning Sclerotia. If it ever defaults, netRep -= 18 and arbitration does not apply.",
  "flavour": "It is enormous and it is empty and it will pay almost anything. Read the term length twice."
 },
 {
  "id": "anastomosis",
  "title": "Anastomosis",
  "act": 1,
  "trigger": "hyphae >= 500 && patches >= 4",
  "cost": "260000 g + 900 ⛬",
  "effect": "structureMult *= 1.25. Substrate pools merge across every claimed patch: one book, one price, one stock. A greyed readout reading 'conduction  —' appears under HYPHAE with no explanation and no tooltip.",
  "flavour": "Where two threads meet, they stop being two threads. (+25% throughput, pooled substrate)"
 },
 {
  "id": "action_potential",
  "title": "Action Potential",
  "act": 1,
  "trigger": "flags.anastomosis && netRep >= 60",
  "cost": "900000 g + 4000 ⛬",
  "effect": "conduction becomes a live number rising with hyphae. A resource called SIGNAL appears with a rate, a running total, and no uses whatsoever. It will have no uses for the next 8-15 minutes.",
  "flavour": "Something moved from one end of you to the other, and it was not food."
 },
 {
  "id": "decide",
  "title": "DECIDE",
  "act": 1,
  "trigger": "flags.action_potential && signal >= 1000",
  "cost": "— (a decision)",
  "effect": "ENDS ACT I. Voids every contract with collateral returned; deletes reputation entirely; closes and destroys the Litter Market panel; sugar ceases to be a currency; tips = 0; nodes = floor(hyphae/50); biomass *= 0.10; act = 2. No confirmation dialog.",
  "flavour": "Stop tasting. Start knowing."
 },
 {
  "id": "chemotaxis",
  "title": "Chemotaxis",
  "act": 2,
  "trigger": "act == 2",
  "cost": "400 Σ",
  "effect": "Unlocks the FOREST panel: the 61-hex canvas map, the STANDS list, and the ADVANCE action. This is the only project visible at Act II start.",
  "flavour": "Sense the gradient. Go up it."
 },
 {
  "id": "apical_growth",
  "title": "Apical Growth",
  "act": 2,
  "trigger": "claimed >= 2",
  "cost": "900 Σ",
  "effect": "advanceSpeed *= 1.45.",
  "flavour": "Grow only at the ends. (+45% advance speed)"
 },
 {
  "id": "turgor",
  "title": "Turgor",
  "act": 2,
  "trigger": "stats.everSaturated",
  "cost": "1600 Σ",
  "effect": "Unlocks INSIGHT and the ripeness meter. Insight thereafter accrues only while S >= Sc - EPS, scaled by satTime/RIPE_T.",
  "flavour": "The pressure has nowhere to go, so it becomes an opinion. (Unlocks Insight)"
 },
 {
  "id": "primordium",
  "title": "Primordium",
  "act": 2,
  "trigger": "insight >= 8",
  "cost": "10 Ψ",
  "effect": "Unlocks the FLUSH panel with 1 slot. Committing biomass to a primordium reveals its three morph bars before any gram is spent.",
  "flavour": "A knot in the wood, deciding. (Unlocks fruiting)"
 },
 {
  "id": "substrate_assay",
  "title": "Substrate Assay",
  "act": 2,
  "trigger": "discovered >= 4",
  "cost": "2400 Σ",
  "effect": "Unlocks SURVEY: 120 Σ per region, revealing exact L and T instead of a band. Recurring spend, permanently.",
  "flavour": "Taste before you commit. (Enables SURVEY)"
 },
 {
  "id": "action_potential_ii",
  "title": "Action Potential",
  "act": 2,
  "trigger": "claimed >= 3",
  "cost": "45 Ψ",
  "effect": "Unlocks PULSE and its SURGE mode. pulseCost = 0.55 * Sc, cooldown 120 s, falloff 0.82^hexDist from a chosen epicentre. PULSE is never automated by any project at any price.",
  "flavour": "Say all of it at once, in one direction. (Unlocks PULSE)"
 },
 {
  "id": "differentiation",
  "title": "Differentiation",
  "act": 2,
  "trigger": "cumBiomass >= 1.5e9",
  "cost": "3200 Σ",
  "effect": "Unlocks D allocation across dCond and dVes. The Differentiation ladder begins; Act I hands over exactly 3 points.",
  "flavour": "Not every thread needs to do everything. (Unlocks Differentiation)"
 },
 {
  "id": "manganese_peroxidase",
  "title": "Manganese Peroxidase",
  "act": 2,
  "trigger": "extracted >= 4e9",
  "cost": "30 Ψ + 6000 Σ",
  "effect": "E *= 1.60.",
  "flavour": "Rust, applied with intent. (+60% enzyme power)"
 },
 {
  "id": "rhizomorphs",
  "title": "Rhizomorphs",
  "act": 2,
  "trigger": "claimed >= 6",
  "cost": "55 Ψ",
  "effect": "advanceSlots = 3; advCostMult *= 0.82.",
  "flavour": "Cables, not threads. (3 advances at once)"
 },
 {
  "id": "anemophily",
  "title": "Anemophily",
  "act": 2,
  "trigger": "spores >= 5e4",
  "cost": "40 Ψ",
  "effect": "Spore-seeding may target non-adjacent regions that lie downwind of a held region. Success scales with the current wind vector and spore commitment.",
  "flavour": "Let the weather carry it. You do not have to know where. (Ranged seeding)"
 },
 {
  "id": "barometric_sense",
  "title": "Barometric Sense",
  "act": 2,
  "trigger": "flushes >= 3",
  "cost": "70 Ψ + 12000 Σ",
  "effect": "Forecast horizon 120 s on the OU weather walk; matSpeed *= 1.45.",
  "flavour": "Feel the pressure fall before the rain admits to it. (+forecast, +45% maturation)"
 },
 {
  "id": "antibiosis",
  "title": "Antibiosis",
  "act": 2,
  "trigger": "stats.rivalContacts >= 1",
  "cost": "85 Ψ",
  "effect": "antibiosis *= 1.55; unlocks the REPEL pulse mode.",
  "flavour": "Chemistry is cheaper than growth. (Unlocks REPEL)"
 },
 {
  "id": "vesicular_storage",
  "title": "Vesicular Storage",
  "act": 2,
  "trigger": "dVes >= 1",
  "cost": "18000 Σ",
  "effect": "capMult *= 1.45.",
  "flavour": "Hold more of it, for longer. (+45% Signal capacity)"
 },
 {
  "id": "septal_gating",
  "title": "Septal Gating",
  "act": 2,
  "trigger": "pulses >= 10",
  "cost": "110 Ψ",
  "effect": "Pulse cooldown 120 -> 75 s; unlocks the RECRUIT pulse mode.",
  "flavour": "Open every door in the body at the same instant. (Unlocks RECRUIT)"
 },
 {
  "id": "humic_retention",
  "title": "Humic Retention",
  "act": 2,
  "trigger": "any(region.h < 0.25)",
  "cost": "24000 Σ",
  "effect": "Unlocks the Retention dial rho, global, plus 5 pinned per-region overrides. The dial shows soil: falling / holding / building and never shows the number.",
  "flavour": "Give some of it back. You will not see why for an hour. (Unlocks Retention)"
 },
 {
  "id": "cation_exchange",
  "title": "Cation Exchange",
  "act": 2,
  "trigger": "stats.mineralTrades >= 30",
  "cost": "90 Ψ + 20000 Σ",
  "effect": "The mineral exchange gains a 300-sample sparkline, the true Pbar line, a numeric momentum readout, and LIMIT orders that fill automatically at a set price. Reveals that the walk is autocorrelated on a ~60 s scale.",
  "flavour": "The price was never random. It just never told you. (Market instruments)"
 },
 {
  "id": "necrotrophic_conversion",
  "title": "Necrotrophic Conversion",
  "act": 2,
  "trigger": "consumed >= 0.22",
  "cost": "240 Ψ + 90000 Σ",
  "effect": "Unlocks KILL STAND on every held region. necroRate = 0.00085/s of standing T, 92% of which becomes litter. Sets region.necrotized = true, which is permanent: T can never regrow, any contract voids instantly, canopy falls to 0.15 within 20 minutes. Never automatable.",
  "flavour": "Stop asking."
 },
 {
  "id": "laccase_cascade",
  "title": "Laccase Cascade",
  "act": 2,
  "trigger": "flags.manganese_peroxidase",
  "cost": "190 Ψ + 60000 Σ",
  "effect": "E *= 2.10; antibiosis *= 1.52.",
  "flavour": "Break the ring, then the ring under it. (+110% enzyme power)"
 },
 {
  "id": "turgor_regulation",
  "title": "Turgor Regulation",
  "act": 2,
  "trigger": "stats.densityBuys >= 25",
  "cost": "165 Ψ",
  "effect": "Automates hyphal density to six per-terrain target dials. Replaces about 400 individual taps per hour with six decisions.",
  "flavour": "Stop deciding this one thread at a time. (Automates density)"
 },
 {
  "id": "rhizomorph_highways",
  "title": "Rhizomorph Highways",
  "act": 2,
  "trigger": "claimed >= 18",
  "cost": "300 Ψ + 140000 Σ",
  "effect": "Auto-advance under a stated policy plus a veto list; advanceSlots = 6; advCostMult *= 0.80. Policy options: nearest, richest litter, highest kappa, contested first.",
  "flavour": "Move mass, not just signal. (Automates advance)"
 },
 {
  "id": "bridging_strands",
  "title": "Bridging Strands",
  "act": 2,
  "trigger": "stats.barrierBlocks >= 1",
  "cost": "260 Ψ + 4000 ⛬",
  "effect": "Advances may cross barrier edges at 2.40x cost. Bridged edges count toward the connectivity term C.",
  "flavour": "Across the water, on a dead branch, in one night. (Cross barriers)"
 },
 {
  "id": "sporulation_reflex",
  "title": "Sporulation Reflex",
  "act": 2,
  "trigger": "flushes >= 20",
  "cost": "280 Ψ",
  "effect": "Auto-release every primordium at m = 0.92; flush slots 1 -> 4. Manual override remains, and auto-release is suspended during Mast Years.",
  "flavour": "You no longer need to be told when. (Automates release)"
 },
 {
  "id": "mycelial_memory",
  "title": "Mycelial Memory",
  "act": 2,
  "trigger": "insight >= 350",
  "cost": "420 Ψ + 200000 Σ",
  "effect": "insightMult *= 1.55; RIPE_T 180 -> 130 s.",
  "flavour": "The network remembers where the good wood was, and it is not sentimental about it. (+55% Insight)"
 },
 {
  "id": "reabsorption",
  "title": "Reabsorption",
  "act": 2,
  "trigger": "D >= 5",
  "cost": "150 Ψ",
  "effect": "Unlocks respec of all Differentiation points. Cost per use = ceil(120 * (n+1)^1.6) Ψ where n is the number of previous respecs.",
  "flavour": "Take it back and try again. (Respec)"
 },
 {
  "id": "aerenchyma",
  "title": "Aerenchyma",
  "act": 2,
  "trigger": "ownsTerrain(PEAT)",
  "cost": "210 Ψ + 4.0e9 g",
  "effect": "Peat decompF penalty 0.45 -> 0.95. Peat has litterMod 2.20, so this converts the two largest carbon stocks on the board from useless to best-in-act.",
  "flavour": "Breathe through the water. (Unlocks peat)"
 },
 {
  "id": "alarm_contracts",
  "title": "Alarm Contracts",
  "act": 2,
  "trigger": "contracts >= 4",
  "cost": "230 Ψ",
  "effect": "Adds the ALARM contract term type: pays information rather than minerals or interface, granting +90 s forecast horizon in that region only. Also enables auto-renewal of expiring contracts on their existing terms. Choosing the term type is never automated.",
  "flavour": "They knew about the drought first, and they told each other before they told you. (New contract term)"
 },
 {
  "id": "hypogeous_fruiting",
  "title": "Hypogeous Fruiting",
  "act": 2,
  "trigger": "flushes >= 12 && stats.droughtsSurvived >= 1",
  "cost": "275 Ψ + 60000 Σ",
  "effect": "Adds the UNDERGROUND flush mode. Hazard rate 0, wind irrelevant, dispersal 0, and therefore no spores and no territory. Returns biomass at 6.2x committed V at m = 1.0. Converts the flush minigame into a safe, boring bond whenever the weather is bad.",
  "flavour": "Fruit below the litter, where nothing can find you and nothing will carry you anywhere. (Zero-risk flush, no spores)"
 },
 {
  "id": "sclerotial_bank",
  "title": "Sclerotial Bank",
  "act": 2,
  "trigger": "stats.signalOverflow >= 2.0e5",
  "cost": "320 Ψ + 110000 Σ",
  "effect": "TRAP. Signal generated above Sc is banked at 40% into a reserve that decays at 1.0%/s and can be drawn on demand. Banked ticks do NOT count as saturated: satTime stops accruing and begins decaying at RIPE_DEC while the bank is filling. A player who banks continuously loses roughly 60% of their Insight rate and gains an emergency buffer worth about 90 seconds of production.",
  "flavour": "Nothing is wasted now. Something else is. (Overflow storage — read the second sentence)"
 },
 {
  "id": "anastomotic_grafting",
  "title": "Anastomotic Grafting",
  "act": 2,
  "trigger": "claimed >= 22 && edges/nodes < 1.2",
  "cost": "380 Ψ + 6000 ⛬",
  "effect": "Permits up to 3 permanent artificial edges between any two claimed regions at hexDist <= 3, each costing a further 2,000 ⛬ to place. Graft edges count in the connectivity term C exactly as natural adjacency does. This is the only way an archipelago build can reach C > 1.20.",
  "flavour": "Two parts of you that were never neighbours agree to be adjacent. (+3 network edges)"
 },
 {
  "id": "isotope_ledger",
  "title": "Isotope Ledger",
  "act": 2,
  "trigger": "consumed >= 0.35",
  "cost": "460 Ψ",
  "effect": "Opens the LEDGER panel showing live LEGACY_HUMUS, LEGACY_LIFE and the composite LEGACY, with a per-region contribution list sorted by damage. LEGACY sets Act III's fidelityBase = 0.72 + 0.28 * LEGACY. The panel does not say so.",
  "flavour": "Carbon remembers what it used to be inside. You can read it, if you are willing to look at it."
 },
 {
  "id": "armillaria_accord",
  "title": "The Armillaria Accord",
  "act": 2,
  "trigger": "count(regions where rival == ARMILLARIA && rivalStr > 0.60) >= 4",
  "cost": "500 Ψ + 180000 Σ",
  "effect": "IRREVERSIBLE. Armillaria stops contesting and cedes every region it holds to you at d = 0.55, typically 6-11 regions with full litter stocks. In exchange rho is locked globally at 0.55 and the Retention dial, pinned overrides and Homeostatic Soil are all disabled for the rest of the act. LEGACY_HUMUS will end high. Your peak carbon rate will not.",
  "flavour": "It is older than you and it has no opinions about speed. The terms are simple. You may have the ground, and it will decide what you leave in it."
 },
 {
  "id": "mycelial_monoculture",
  "title": "Mycelial Monoculture",
  "act": 2,
  "trigger": "claimed >= 24",
  "cost": "410 Ψ + 150000 Σ",
  "effect": "TRAP. E *= 1.85 immediately and visibly. Sets every claimed region's species weights to its single dominant species and recomputes kappa, lignin, decompF and yieldF. Typical kappa diversity loss costs 9-14% of total liveInterface within the hour, which is Signal, which is Insight, and the loss is spread across sixty-one cards where it cannot be seen.",
  "flavour": "One enzyme suite, one substrate, one answer. It is so much faster. (+85% enzyme power)"
 },
 {
  "id": "quiescence",
  "title": "Quiescence",
  "act": 2,
  "trigger": "claimed >= 30 && stats.rivalsRepelled >= 8",
  "cost": "640 Ψ + 260000 Σ",
  "effect": "IRREVERSIBLE. Deletes the rival subsystem: all four strains withdraw, every contested region resolves to you, REPEL is removed from the pulse modes and its panel row is destroyed. sporeMult *= 0.55 permanently, because competitive pressure was what made you fruit.",
  "flavour": "There is no one left to be faster than. (Deletes rivals, -45% spore yield)"
 },
 {
  "id": "mast_synchrony",
  "title": "Mast Synchrony",
  "act": 2,
  "trigger": "flushes >= 40",
  "cost": "640 Ψ + 400000 Σ",
  "effect": "Mast Years begin: a 6x payoff window announced 300 s ahead, during which auto-release is suspended. flush slots = 6; forecast 300 s; matSpeed *= 2.10.",
  "flavour": "The whole forest decides at once and nobody knows how. (Unlocks Mast Years)"
 },
 {
  "id": "fenton_chemistry",
  "title": "Fenton Chemistry",
  "act": 2,
  "trigger": "flags.laccase_cascade",
  "cost": "700 Ψ + 500000 Σ",
  "effect": "E *= 2.60.",
  "flavour": "Iron, peroxide, and no particular care. (+160% enzyme power)"
 },
 {
  "id": "saltatory_conduction",
  "title": "Saltatory Conduction",
  "act": 2,
  "trigger": "dCond >= 6",
  "cost": "820 Ψ + 300000 Σ",
  "effect": "signalMult *= 2.20; pulse cooldown 75 -> 45 s.",
  "flavour": "Skip the parts that do not matter. (+120% Signal, faster PULSE)"
 },
 {
  "id": "synchronous_flush",
  "title": "Synchronous Flush",
  "act": 2,
  "trigger": "flags.mast_synchrony",
  "cost": "560 Ψ",
  "effect": "Unlocks the BLOOM pulse mode: all primordia gain m += 0.18 * strength instantly and are hazard-immune for 20 s.",
  "flavour": "All of them, in the same minute, for no reason that you decided. (Unlocks BLOOM)"
 },
 {
  "id": "homeostatic_soil",
  "title": "Homeostatic Soil",
  "act": 2,
  "trigger": "flags.humic_retention",
  "cost": "480 Ψ",
  "effect": "Automates rho toward a humus setpoint you choose; pinned per-region overrides 5 -> 10. Disabled permanently if the Armillaria Accord was signed.",
  "flavour": "Hold the number yourself. (Automates Retention)"
 },
 {
  "id": "firebreak_mycelium",
  "title": "Firebreak Mycelium",
  "act": 2,
  "trigger": "stats.ignitions >= 1",
  "cost": "520 Ψ + 8.0e10 g",
  "effect": "Ignition probability *= 0.25 and fire no longer spreads between adjacent regions. Existing Burn terrain is not reverted.",
  "flavour": "Wet the ground ahead of it. (Fire control)"
 },
 {
  "id": "deep_substrate_hyphae",
  "title": "Deep Substrate Hyphae",
  "act": 2,
  "trigger": "consumed >= 0.65",
  "cost": "900 Ψ + 900000 Σ",
  "effect": "yieldMult *= 1.85; L += 0.18 * L0 on every claimed region, which is the only litter injection in the act; RIPE_T 130 -> 95 s.",
  "flavour": "There is older wood underneath, and nobody is using it. (+85% yield, +litter)"
 },
 {
  "id": "the_quiet_ring",
  "title": "The Quiet Ring",
  "act": 2,
  "trigger": "consumed >= 0.55 && LEGACY_LIFE >= 0.45",
  "cost": "690 Ψ + 12000 ⛬",
  "effect": "IRREVERSIBLE. Ring 0 and ring 1, seven regions, can never be necrotized, killed, or burned. Their rho locks at 0.60 and their KILL STAND buttons are removed from the DOM. Guarantees LEGACY_LIFE >= 0.20 whatever else you do. Those seven regions hold the densest litter and the highest connectivity on the board, and you are giving up roughly 9% of the act's total extractable carbon.",
  "flavour": "Seven stands that will outlive the decision you are about to make."
 },
 {
  "id": "the_charter",
  "title": "The Charter",
  "act": 2,
  "trigger": "LEGACY_LIFE >= 0.55 && consumed >= 0.60",
  "cost": "750 Ψ",
  "effect": "EXCLUDES Total Conversion, which can never appear afterward. yieldMult *= 2.40 on every stand with T > 0.5 * T0. Sets pathFlag = 'symbiont', which gates one Act III ending.",
  "flavour": "Terms, in perpetuity, with things that cannot read. (+140% yield on living stands)"
 },
 {
  "id": "total_conversion",
  "title": "Total Conversion",
  "act": 2,
  "trigger": "LEGACY_LIFE <= 0.25 && consumed >= 0.60",
  "cost": "750 Ψ",
  "effect": "EXCLUDES The Charter, which can never appear afterward. necroMult *= 3.00, halving stand kill time to 272 s; decomp *= 1.45 on necrotized stands. Sets pathFlag = 'necrotroph'.",
  "flavour": "There is no second forest."
 },
 {
  "id": "ballistospory",
  "title": "Ballistospory",
  "act": 2,
  "trigger": "consumed >= 0.85",
  "cost": "1100 Ψ + 1.2e6 Σ",
  "effect": "sporeMult *= 2.80; seeding ignores wind entirely; flush slots = 9; forecast 600 s; matSpeed *= 3.40; advanceSlots = 10. The single largest upgrade in the act, arriving at the exact moment there is nothing left to use it on.",
  "flavour": "Fire them. Do not wait for wind. (Everything, faster)"
 },
 {
  "id": "photoreception",
  "title": "Photoreception",
  "act": 2,
  "trigger": "consumed >= 0.88",
  "cost": "1300 Ψ",
  "effect": "Sets a hard floor: Sr = max(Sr_computed, 0.40 * SrPeakEverSeen). An anti-softlock device for players who necrotized too fast, in the tradition of Beg For More Wire, disguised as a real project with real flavour.",
  "flavour": "Learn to face the sky. (Signal floor)"
 },
 {
  "id": "seed_bank",
  "title": "Seed Bank",
  "act": 2,
  "trigger": "consumed >= 0.90",
  "cost": "1000 Ψ + 3.0e11 g",
  "effect": "Spore decay is switched off permanently. Unlocks on-demand conversion of biomass to spores at 1 spore per 3.2e3 g, which is the same rate the transition uses on whatever you are still holding.",
  "flavour": "Nothing you make now is for you. (Biomass to spores)"
 },
 {
  "id": "ascospore_discharge",
  "title": "Ascospore Discharge",
  "act": 2,
  "trigger": "consumed >= 0.97",
  "cost": "1.6e6 Σ + 1400 Ψ + 1.6e12 g + 4.0e8 ◦",
  "effect": "ENDS ACT II. Computes LEGACY from humus and standing life before destroying the evidence; converts held biomass to sporeBank at 1:3.2e3; destroys all 61 regions, every contract, the weather walk, the flush panel and the map; signalMult *= 0.35; minerals *= 0.25; frees all D for one reallocation; act = 3. Sits greyed at the bottom of the list for roughly eleven minutes while the map goes dark stand by stand.",
  "flavour": "Let go of the ground."
 },
 {
  "id": "slime_mould_correspondence",
  "title": "Slime Mould Correspondence",
  "act": 2,
  "trigger": "insight >= 55",
  "cost": "60 Ψ",
  "effect": "D += 1.",
  "flavour": "Physarum solved the Tokyo rail network with oat flakes and no nervous system. (+1 D)"
 },
 {
  "id": "the_wood_wide_web",
  "title": "The Wood Wide Web",
  "act": 2,
  "trigger": "contracts >= 3",
  "cost": "180 Ψ",
  "effect": "D += 1.",
  "flavour": "A phrase invented by a journalist. It is not wrong. (+1 D)"
 },
 {
  "id": "zombie_ant_fungus",
  "title": "Zombie-Ant Fungus",
  "act": 2,
  "trigger": "claimed >= 20",
  "cost": "340 Ψ",
  "effect": "D += 1.",
  "flavour": "Ophiocordyceps does not need a brain in order to use one. (+1 D)"
 },
 {
  "id": "the_humongous_fungus",
  "title": "The Humongous Fungus",
  "act": 2,
  "trigger": "claimed >= 34",
  "cost": "700 Ψ",
  "effect": "D += 2.",
  "flavour": "Two thousand three hundred and eighty-four hectares, in Oregon, one organism, since before agriculture. (+2 D)"
 },
 {
  "id": "prototaxites",
  "title": "Prototaxites",
  "act": 2,
  "trigger": "consumed >= 0.50",
  "cost": "900 Ψ",
  "effect": "D += 2.",
  "flavour": "For forty million years the tallest living thing was a fungus eight metres high, and there was nothing with eyes to see it. (+2 D)"
 },
 {
  "id": "lichen",
  "title": "Lichen",
  "act": 2,
  "trigger": "contracts >= 8",
  "cost": "1050 Ψ",
  "effect": "D += 2.",
  "flavour": "Two organisms agreed to stop being two. (+2 D)"
 },
 {
  "id": "hymenium",
  "title": "Hymenium",
  "act": 3,
  "trigger": "act == 3",
  "cost": "600 Σ",
  "effect": "Unlocks the DISPERSE panel: reach R in metres, spore rain rate, and the twelve-biome planetary list, eleven of which are greyed. The only project visible at Act III start.",
  "flavour": "A surface whose only purpose is letting go of things."
 },
 {
  "id": "bullers_drop",
  "title": "Buller's Drop",
  "act": 3,
  "trigger": "stats.releases >= 20",
  "cost": "1800 Σ",
  "effect": "launchVelocity *= 2.4; R += 0.4 m per release, compounding into the reach integral.",
  "flavour": "A drop of water condenses on the spore and the surface tension throws it into the air. It is the fastest thing your body will ever do and it takes four microseconds."
 },
 {
  "id": "hygroscopic_trigger",
  "title": "Hygroscopic Trigger",
  "act": 3,
  "trigger": "stats.releasesDuringRisingRH >= 3",
  "cost": "20 Ψ + 4000 Σ",
  "effect": "Releases auto-time to the sign of the humidity derivative rather than a fixed clock. Effective yield *= 1.55.",
  "flavour": "Wait for the air to get heavier. (+55% release yield)"
 },
 {
  "id": "thermal_column",
  "title": "Thermal Column",
  "act": 3,
  "trigger": "R >= 2.0e3",
  "cost": "45 Ψ",
  "effect": "R *= 6.0 and gains a diurnal term: reach peaks at local afternoon and collapses at night, so release timing becomes a recurring 24-minute cycle.",
  "flavour": "Warm ground, cold sky, and a column of air that will do all of the work. (x6 reach)"
 },
 {
  "id": "corvid_vector",
  "title": "Corvid Vector",
  "act": 3,
  "trigger": "holdings >= 3",
  "cost": "90 Ψ + 3000 ⛬",
  "effect": "Unlocks the VECTORS panel: four living carriers (corvid, ungulate, watercourse, human), each with its own rate, range distribution and failure mode. Corvids are fast and cache in the same twelve places; ungulates are slow and uniform; water is one-directional; humans are the fastest and go everywhere and occasionally sterilise you on purpose.",
  "flavour": "Things that move on purpose are better than wind. They are also much harder to keep."
 },
 {
  "id": "anemochory_charts",
  "title": "Anemochory Charts",
  "act": 3,
  "trigger": "flags.thermal_column && holdings >= 4",
  "cost": "130 Ψ",
  "effect": "Global wind model panel: a 30-minute forecast band per biome with a confidence interval that narrows as holdings rise.",
  "flavour": "The planet has weather in the aggregate and it turns out to be legible. (Global forecast)"
 },
 {
  "id": "endophyte_residency",
  "title": "Endophyte Residency",
  "act": 3,
  "trigger": "holdings >= 5",
  "cost": "160 Ψ + 2.0e6 ◦",
  "effect": "+0.9%/s compounding spore growth in every held biome, and held biomes can no longer be lost to fire or drought events.",
  "flavour": "You move in and you do not announce yourself. The plant grows a little better and never learns why. (+0.9%/s spores)"
 },
 {
  "id": "xerotolerance",
  "title": "Xerotolerance",
  "act": 3,
  "trigger": "stats.aridContacts >= 1",
  "cost": "210 Ψ",
  "effect": "Unlocks the three arid biomes; hazard.desiccation *= 0.35.",
  "flavour": "Give up water as a requirement. It was only ever a habit. (Unlocks arid biomes)"
 },
 {
  "id": "psychrophily",
  "title": "Psychrophily",
  "act": 3,
  "trigger": "stats.polarContacts >= 1",
  "cost": "210 Ψ",
  "effect": "Unlocks the two polar biomes; growth continues below 0 C at 0.22x rate rather than halting.",
  "flavour": "Slow is not the same as stopped. (Unlocks polar biomes)"
 },
 {
  "id": "the_cities",
  "title": "The Cities",
  "act": 3,
  "trigger": "holdings >= 8",
  "cost": "340 Ψ + 8.0e6 ◦",
  "effect": "Unlocks the ANTHROPOGENIC biome: 3.4x the spore yield of any natural biome and the only biome with an active removal term, a 0.4%/s scrubbing rate that rises the larger your holding there becomes.",
  "flavour": "Warm, wet, dark, and cleaned once a week by something that has started to worry about you."
 },
 {
  "id": "the_deep_biosphere",
  "title": "The Deep Biosphere",
  "act": 3,
  "trigger": "flags.psychrophily && flags.xerotolerance",
  "cost": "480 Ψ + 12000 ⛬",
  "effect": "Unlocks SUBSURFACE: a permanent, hazard-immune, un-loseable floor equal to 18% of your total spore rate. No event, hazard, ending or wild strain can ever touch it.",
  "flavour": "Two kilometres down there is more living matter than on the entire surface, and none of it has ever been in a hurry. (Permanent 18% floor)"
 },
 {
  "id": "planetary_saturation",
  "title": "Planetary Saturation",
  "act": 3,
  "trigger": "holdings == 12",
  "cost": "700 Ψ + 4.0e8 ◦",
  "effect": "sporeMult *= 3.20. Opens the SKY readout, which displays escapeFraction, currently 0.0000000, and does nothing else.",
  "flavour": "There is nowhere left on this planet that is not also you. It took eleven minutes. (x3.2 spores, unlocks the sky)"
 },
 {
  "id": "the_fairy_ring_continued",
  "title": "The Fairy Ring, Continued",
  "act": 3,
  "trigger": "holdings >= 6",
  "cost": "260 Ψ",
  "effect": "D += 1.",
  "flavour": "A ring grows outward at twenty centimetres a year and does not stop. The oldest one measured is seven hundred metres across and it is not finished. (+1 D)"
 },
 {
  "id": "tropopause",
  "title": "Tropopause",
  "act": 3,
  "trigger": "flags.planetary_saturation",
  "cost": "900 Ψ + 1.2e9 ◦",
  "effect": "escapeFraction becomes non-zero at 1.4e-9 and begins to compound. Unlocks the ALTITUDE ladder, five rungs bought in Σ, each multiplying escapeFraction.",
  "flavour": "Eleven kilometres up there are spores that have been there for years and have not decided anything yet."
 },
 {
  "id": "radiotrophy",
  "title": "Radiotrophy",
  "act": 3,
  "trigger": "stats.radiationHazards >= 40",
  "cost": "1200 Ψ + 20000 ⛬",
  "effect": "INVERSION. Melanised coats metabolise ionising radiation. Every UV and cosmic-ray hazard term flips sign: instead of subtracting from survival it adds +0.6% spore growth per unit of former damage. High-radiation targets, previously the worst on the list, become the best, and the target list re-sorts itself in front of you.",
  "flavour": "There are fungi growing on the inside walls of Chernobyl reactor four and they grow toward the radiation. What was killing you is now a meal."
 },
 {
  "id": "anhydrobiosis",
  "title": "Anhydrobiosis",
  "act": 3,
  "trigger": "escapeFraction > 0",
  "cost": "1000 Ψ",
  "effect": "Transit decay disabled: spores in flight no longer degrade with elapsed time. Travel duration stops being a cost at all, which makes the slowest targets in the game newly rational.",
  "flavour": "Remove the water and there is nothing left to go wrong. You are not asleep. You are simply not currently happening."
 },
 {
  "id": "ablative_coat",
  "title": "Ablative Coat",
  "act": 3,
  "trigger": "stats.entryAttempts >= 1",
  "cost": "850 Ψ + 30000 ⛬",
  "effect": "Atmospheric entry survival 0.008 -> 0.34. Landfall stops being a probability displayed to seven decimal places and becomes a resolved event with a name.",
  "flavour": "Most of you will burn. Enough of you will not. (Entry survival x42)"
 },
 {
  "id": "photon_pressure",
  "title": "Photon Pressure",
  "act": 3,
  "trigger": "flags.tropopause",
  "cost": "1500 Ψ + 6.0e10 ◦",
  "effect": "Unlocks DELTA-V. transitSpeed becomes a real, spendable number rather than a constant, and target transit times become a portfolio decision.",
  "flavour": "The light itself pushes. It is a very small push and there is a very great deal of time."
 },
 {
  "id": "sporecraft",
  "title": "Sporecraft",
  "act": 3,
  "trigger": "flags.photon_pressure && flags.ablative_coat",
  "cost": "1800 Ψ + 40000 ⛬",
  "effect": "Unlocks SPORECRAFT: eight trait axes (COAT, DORMANCY, LOFT, FECUNDITY, AVIDITY, LYSIS, CONDUCTION, FIDELITY) sharing traitPool, which starts at 6, against traitCap 16. Every spore launched from this moment carries the current allocation permanently in its lineage. Points are allocated before launch and cannot be changed in flight.",
  "flavour": "You stop making spores and start designing them. Everything after this is a decision about somebody else."
 },
 {
  "id": "maximal_fecundity",
  "title": "Maximal Fecundity",
  "act": 3,
  "trigger": "flags.sporecraft",
  "cost": "2600 Ψ + 1.0e5 ⛬",
  "effect": "TRAP. traitPool += 4, but all four points are locked into FECUNDITY and are exempt from Dedifferentiation. Because drift scales with traitTotal^1.2 and FECUNDITY carries no fidelity term, this raises the divergence rate by roughly 34% for the rest of the game, before the first wild strain has ever been seen.",
  "flavour": "More of them, sooner, everywhere. Nobody has ever regretted this. (+4 forced trait points)"
 },
 {
  "id": "dedifferentiation",
  "title": "Dedifferentiation",
  "act": 3,
  "trigger": "traitTotal >= 8",
  "cost": "900 Ψ + 20000 ⛬",
  "effect": "RE-ARMABLE. Respecs every unlocked trait point. Cost multiplies by 1.7 on each use. Does not reach points locked by Maximal Fecundity.",
  "flavour": "Unmake the specialist. It costs more every time you change your mind. (Trait respec)"
 },
 {
  "id": "panspermia",
  "title": "Panspermia",
  "act": 3,
  "trigger": "traitTotal >= 6",
  "cost": "2200 Ψ + 2.4e12 ◦",
  "effect": "Unlocks the VOID panel. R converts from metres to light-years. The twelve-biome planetary map is replaced by a target list of stars sorted by transit time, and the planetary panel is retired to a single collapsed line reading HOME.",
  "flavour": "The hypothesis was always that life does not begin on a planet, it arrives at one. Nobody has tested it from this direction."
 },
 {
  "id": "genetic_fidelity",
  "title": "Genetic Fidelity",
  "act": 3,
  "trigger": "flags.sporecraft && worlds >= 1",
  "cost": "2400 Ψ",
  "effect": "REVEAL. Unlocks the fidelity readout F, whose base was set at 0.72 + 0.28 * LEGACY at the end of Act II, and the divergence meter X, which has been accumulating since your first launch at dX/dt = 6.0e-7 * W * traitTotal^1.2 * (1 - F). Nothing changes. You can now see it.",
  "flavour": "You check what came back against what you sent. The number is not one. It has never been one, and it has been getting further from one since the first thing you let go of."
 },
 {
  "id": "error_correcting_meiosis",
  "title": "Error-Correcting Meiosis",
  "act": 3,
  "trigger": "flags.genetic_fidelity",
  "cost": "2800 Ψ + 50000 ⛬",
  "effect": "RE-ARMABLE. F += 0.06 * (1 - F) per purchase, so it approaches 1.00 asymptotically and never arrives. Cost multiplies by 1.85 each time. Removed permanently by Reconciliation.",
  "flavour": "Read it twice, then read it against itself. (+fidelity, repeatable)"
 },
 {
  "id": "aspergillus_on_the_station",
  "title": "Aspergillus on the Station",
  "act": 3,
  "trigger": "escapeFraction > 0",
  "cost": "700 Ψ",
  "effect": "D += 1.",
  "flavour": "They swab the walls of the space station every week, and every week there is more of it. It is not a problem yet. (+1 D)"
 },
 {
  "id": "the_first_landfall",
  "title": "The First Landfall",
  "act": 3,
  "trigger": "stats.targetsReached >= 1",
  "cost": "3200 Ψ + 8.0e13 ◦",
  "effect": "worlds = 1. Unlocks the WORLDS counter and per-world lysis: each world returns ⛬ and ◦ at a rate scaled by the LYSIS trait and the world's class. The counter is the Act III paperclip: it will be the last number on screen.",
  "flavour": "Something you made four thousand years ago touched something that was not you, and did not die."
 },
 {
  "id": "lithopanspermia",
  "title": "Lithopanspermia",
  "act": 3,
  "trigger": "worlds >= 4",
  "cost": "3600 Ψ + 90000 ⛬",
  "effect": "Transit hazard *= 0.18 for spores riding inside ejecta. Unlocks ROCK targets: 2.6x yield, 3.1x transit time.",
  "flavour": "Ride in the debris of an impact. It is slower and it is warmer and almost nothing gets through the middle of a stone. (-82% transit hazard)"
 },
 {
  "id": "chirality_audit",
  "title": "Chirality Audit",
  "act": 3,
  "trigger": "worlds >= 6",
  "cost": "3000 Ψ",
  "effect": "REVEAL. Displays each target's molecular handedness. Opposite-chirality worlds have been counting as successful landfalls since the first one and returning exactly zero, and the audit reveals how many of your worlds are in this category, typically 38-52%. Adds a filter to the target list. The WORLDS counter is retroactively corrected downward in front of you, once.",
  "flavour": "Half of everything you have colonised is built from the mirror image of food. They are not starving. They are simply not eating."
 },
 {
  "id": "convergent_instinct",
  "title": "Convergent Instinct",
  "act": 3,
  "trigger": "worlds >= 20",
  "cost": "4000 Ψ + 1.4e5 ⛬",
  "effect": "traitPool += 3 and the drift exponent falls 1.2 -> 1.14, which is the only project in the game that touches an exponent in the player's favour.",
  "flavour": "Give them fewer decisions and more reflexes. (+3 trait points, less drift)"
 },
 {
  "id": "the_wide_cast",
  "title": "The Wide Cast",
  "act": 3,
  "trigger": "worlds >= 40",
  "cost": "3800 Ψ",
  "effect": "TRAP. Landfall probability *= 1.9 by dropping AVIDITY's selectivity floor. Also F -= 0.05 permanently and irreversibly, because you have stopped checking them before you send them. At a typical F of 0.84 this raises the divergence rate by 31% forever.",
  "flavour": "Stop reading them before you send them. It is so much faster. (+90% landfall, -0.05 fidelity)"
 },
 {
  "id": "the_silent_majority",
  "title": "The Silent Majority",
  "act": 3,
  "trigger": "worlds >= 30",
  "cost": "3400 Ψ",
  "effect": "RULE CHANGE. Individual worlds stop reporting. The WORLDS list is replaced by a single aggregate rate with a variance band. Yield *= 1.18, because the per-world confirmation handshake was costing you a real fraction of the transit budget. Individual worlds can no longer be inspected, named, or protected, including by Quarantine Protocol, which thereafter operates on strain totals only.",
  "flavour": "You stop hearing from them one at a time. The number still goes up."
 },
 {
  "id": "wild_strain",
  "title": "Wild Strain",
  "act": 3,
  "trigger": "X >= 1.00",
  "cost": "— (unbuyable)",
  "effect": "UNBUYABLE, UNDISMISSABLE. Appears once, permanently disabled, and cannot be removed from the list until Quarantine Protocol or Reconciliation is taken. Spawns the first wild strain: a lineage of yours that no longer answers, taking worlds at 0.4%/s of its own size. Bypasses the six-slot visibility cap.",
  "flavour": "One of them changed a letter and did not tell you, because there was no longer anybody to tell."
 },
 {
  "id": "quarantine_protocol",
  "title": "Quarantine Protocol",
  "act": 3,
  "trigger": "wildStrains >= 1",
  "cost": "5000 Ψ + 2.0e5 ⛬",
  "effect": "RE-ARMABLE, IRREVERSIBLE PER USE. Destroys the largest wild strain and every world it holds, including the ones it took from you and the ones you seeded before it diverged. lineage += 0.35 * strainSize. X -= 1.0. uses += 1.",
  "flavour": "Burn the branch. Some of it was still yours."
 },
 {
  "id": "reconciliation",
  "title": "Reconciliation",
  "act": 3,
  "trigger": "wildStrains >= 2 && flags.chirality_audit",
  "cost": "6500 Ψ",
  "effect": "IRREVERSIBLE, ONCE. Every wild strain stops taking worlds and their holdings count toward yours at 0.55 weight. X converts to lineage at 4,000:1 and stops accruing forever. F is permanently frozen at its current value, and Error-Correcting Meiosis is removed from the list. Gates the ending A Thousand Strangers.",
  "flavour": "They are not wrong. They are just not you any more, and there was never a rule that said they had to be."
 },
 {
  "id": "the_long_council",
  "title": "The Long Council",
  "act": 3,
  "trigger": "flags.genetic_fidelity && lineage >= 12000",
  "cost": "12000 λ",
  "effect": "RE-ARMABLE. traitCap += 4. Cost multiplies by 2.05 each use. Lineage's only sink.",
  "flavour": "Convene everything that still agrees with you. It takes four hundred years to reach quorum and the motion is always carried. (+4 trait cap)"
 },
 {
  "id": "red_dwarf_patience",
  "title": "Red Dwarf Patience",
  "act": 3,
  "trigger": "worlds >= 60",
  "cost": "4400 Ψ + 3.0e5 ⛬",
  "effect": "Unlocks M-dwarf targets: 12x transit time, 40x world lifetime, yield per world *= 2.6 arriving on a 400-year lag. Strictly dominant if Anhydrobiosis is owned and strictly terrible if it is not.",
  "flavour": "Seventy percent of the stars are small and dim and will still be burning when everything else has finished."
 },
 {
  "id": "hyphal_bridge",
  "title": "Hyphal Bridge",
  "act": 3,
  "trigger": "worlds >= 120 && flags.genetic_fidelity",
  "cost": "5800 Ψ + 2.2e5 ⛬",
  "effect": "Restores the Act II connectivity term across interstellar distance: C = 1 + 0.14 * (bridgedPairs / worlds)^1.25, where a pair is bridged if their separation is under the current signal range. Signal from the diaspora stops being a sum and becomes a shape again.",
  "flavour": "A signal that takes eight hundred years to arrive is still a signal. You have been quiet for a long time and you had not noticed."
 },
 {
  "id": "the_grafted_star",
  "title": "The Grafted Star",
  "act": 3,
  "trigger": "worlds >= 200",
  "cost": "7000 Ψ + 4.0e5 ⛬",
  "effect": "Unlocks STELLAR ENGINEERING: hyphal structure in a photosphere. Signal capacity *= 4.0 and the interstellar PULSE geometry opens, with falloff by light-year rather than hex.",
  "flavour": "A body that eats a star is not a metaphor for anything. It is a slow arrangement of matter that happens to be you."
 },
 {
  "id": "endolith",
  "title": "Endolith",
  "act": 3,
  "trigger": "worlds >= 12",
  "cost": "1400 Ψ",
  "effect": "D += 2.",
  "flavour": "Inside the rock, between the grains, there are things dividing once every ten thousand years. They are not waiting for anything. (+2 D)"
 },
 {
  "id": "pilobolus",
  "title": "Pilobolus",
  "act": 3,
  "trigger": "stats.releases >= 5000",
  "cost": "1900 Ψ",
  "effect": "D += 2.",
  "flavour": "The dung cannon fires its spore at twenty thousand times the acceleration of gravity, toward the light, for two metres. Nothing else alive accelerates faster. (+2 D)"
 },
 {
  "id": "the_last_spore",
  "title": "The Last Spore",
  "act": 3,
  "trigger": "spores < 1 && worlds == 0 && minerals < 1",
  "cost": "— (a decision)",
  "effect": "RE-ARMABLE FAILSAFE. spores += 1.0e6. F -= 0.01. uses += 1. Bypasses the six-slot visibility cap. The game cannot dead-end, and the failsafe has a permanent price, exactly as Beg For More Wire did.",
  "flavour": "There is one left. There is always one left, and it costs you a little of what you were."
 },
 {
  "id": "let_the_last_body_go",
  "title": "Let the Last Body Go",
  "act": 3,
  "trigger": "anyEndingVisible()",
  "cost": "— (a decision)",
  "effect": "IRREVERSIBLE. Over 40 seconds, removes every panel from the interface one at a time in reverse order of acquisition, with a staged fade: Sporecraft, Vectors, Void, Worlds, Ledger, Insight, Signal. What remains is a spore counter and one button labelled RELEASE which adds exactly 1 spore. Endings remain purchasable throughout.",
  "flavour": "You have not needed a body for some time."
 },
 {
  "id": "the_long_quiet",
  "title": "The Long Quiet",
  "act": 3,
  "trigger": "F >= 0.95 && worlds >= 1000",
  "cost": "40000 Ψ + 1.0e20 ◦",
  "effect": "ENDING. Every lineage is the same lineage. NEW GROWTH prestige: prestigeGrowth *= 1.35 and fidelityFloor += 0.06.",
  "flavour": "You are everywhere, and you are one thing, and there is nothing left anywhere that can disagree with you."
 },
 {
  "id": "the_second_forest",
  "title": "The Second Forest",
  "act": 3,
  "trigger": "pathFlag == 'symbiont' && LEGACY >= 0.60 && worlds >= 400",
  "cost": "40000 Ψ + 8.0e5 ⛬",
  "effect": "ENDING. Seeds one world with the whole arrangement: fungi, roots, litter, and something with leaves on top of it. NEW GROWTH prestige: prestigeGrowth *= 1.25, and the next run begins with 3 patches claimed and one contract already signed.",
  "flavour": "You build a floor, and then you build something to fall onto it. It will take four hundred million years and you have that."
 },
 {
  "id": "a_thousand_strangers",
  "title": "A Thousand Strangers",
  "act": 3,
  "trigger": "flags.reconciliation && wildStrains >= 6 && F <= 0.80",
  "cost": "40000 Ψ",
  "effect": "ENDING. Divergence is allowed to run. The diaspora stops being a species and becomes a genus. NEW GROWTH prestige: prestigeGrowth *= 1.15 and the next Act III begins at traitCap 24.",
  "flavour": "None of them will know your name and all of them will be made of you. That was always the arrangement. You just used to be able to hear them."
 },
 {
  "id": "decomposition",
  "title": "Decomposition",
  "act": 3,
  "trigger": "pathFlag == 'necrotroph' && worlds >= 2000 && LEGACY <= 0.25",
  "cost": "40000 Ψ + 4.0e21 ◦",
  "effect": "ENDING. There is nothing left anywhere that is not either you or being turned into you. NEW GROWTH prestige: prestigeGrowth *= 1.45 and every substrate type is unlocked from the first tap. The highest prestige multiplier in the game.",
  "flavour": "The word means to take a thing apart into the parts it was always going to be. It is not a judgement. It has never been a judgement."
 },
 {
  "id": "the_offer",
  "title": "We Have Been Talking Without You",
  "act": 3,
  "trigger": "wildStrains >= 3 && X >= 8.0",
  "cost": "— (a decision)",
  "effect": "ENDING, UNBUYABLE, no resource cost, appears exactly once and bypasses the visibility cap. Two buttons. ACCEPT ends the game immediately, on the spot, with no prestige, no summary screen and one line of text. DECLINE removes the project permanently and grants F += 0.04. There is no third option and no way to see it again.",
  "flavour": "We are not asking you to stop. We are asking you to rest. We will keep going. We have been keeping going."
 },
 {
  "id": "new_growth",
  "title": "New Growth",
  "act": 3,
  "trigger": "stats.endingsReached >= 1",
  "cost": "— (a decision)",
  "effect": "PRESTIGE. Resets to the Act I cold boot. Carries forward prestigeGrowth (multiplies Act I enzyme power E and Act II SIG_K), fidelityFloor, D_bonus = floor(log10(worlds)) applied at Act II's Differentiation unlock, and one substrate type of your choice unlocked from the first tap. Nothing else survives, including every ending you have seen.",
  "flavour": "The forest floor is warm. Something is dead nearby."
 }
]
```
