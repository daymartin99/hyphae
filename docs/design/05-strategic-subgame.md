# HYPHAE — THE STRATEGIC SUB-GAME

**THE PACT BOOK** (Act II, mid-game, ~2h45m of returning play)
**THE ANTIPHONY** (Act III, late, a ~22-minute finite gauntlet)

**Complete mechanical specification. This document is the source of truth for both systems.**
Companion to `00-paperclips-teardown.md`, `01-act1-understory.md`, `02-act2-network.md`,
`04-projects-catalog.md`. Every constant is named, every formula closed-form, every unit stated.
Tuning knobs are marked `[K]` and collected in §14.

---

## 0. PRECEDENCE — what this document supersedes

This is a source-of-truth conflict resolution. Read it before implementing anything.

| Document | Section | Status after this doc |
|---|---|---|
| `01-act1-understory.md` | §6 Mycorrhizal Contracts | **Unchanged and authoritative for Act I.** Act I's bilateral tree-contract system is the *ancestor* of the Pact Book and remains exactly as specified. It is the tutorial. |
| `02-act2-network.md` | §10.1–10.3 Contracts carried forward | **SUPERSEDED IN FULL.** The one-contract-per-region / three-term-type / `tension` model described there is replaced by §1–§11 of this document. The three term types survive as the ROOT guild's payout channel (§4.1). `tension` is renamed and re-specified as `strain` (§6). |
| `02-act2-network.md` | §10.4 The mineral market | **Unchanged and authoritative.** The Pact Book consumes its price series (§4.1) and reads its `mineralPrice` for the biomass-equivalence readout. |
| `02-act2-network.md` | §7 THE FLUSH | **Unchanged and authoritative.** See §0.1 below for the division of labour. |
| `02-act2-network.md` | §0.2 State carried OUT | **EXTENDED.** Two additions: `accordLifetime` and the revised `LEGACY` formula (§10.4). |
| `04-projects-catalog.md` | — | **EXTENDED.** 14 new Act II projects (§12) and 4 new Act III projects (§13.9) must be merged into the catalog. Their ids are namespaced `pact_*` and `anti_*` to avoid collision. |

### 0.1 Division of labour with THE FLUSH

Act II now contains two systems that both touch risk. They are deliberately different objects on
different time horizons, and neither is redundant:

| | **THE FLUSH** (Act II §7) | **THE PACT BOOK** (this doc) |
|---|---|---|
| Horizon | 60–400 seconds | 15 minutes – 3 hours |
| Object | one bet, resolved | a portfolio, never resolved |
| Verb | *time it* | *allocate it* |
| Uncertainty | the future value of one variable (moisture) | which of five variables you are exposed to, and how much |
| Skill | reading a forecast band | reading a covariance structure |
| What you lose | one primordium | tenure, which is hours old |
| Attention | bursty, demands presence | ambient, rewards presence |
| UP analogue | the *good* half of the stock market (a variance surface you choose to enter) | the half UP never built |

They share exactly three interfaces, all one-directional (Flush → nothing; Pact → Flush):

1. CROWN pacts extend `forecastHorizon` globally (§4.5), which is the Flush's core purchase.
2. GHOST pacts raise the Insight ripeness floor (§4.4), which changes when you flush.
3. Weather factor `F1 MOISTURE` (§5.2) is read from the Flush's OU walk `W`. **The Pact Book does not
   own the weather.** It observes it. One process, two consumers.

**Design rule:** never make a Flush decision depend on a Pact decision made in the same 60 seconds.
Cross-system coupling on a phone must be *strategic* (I hold lichens, so my forecasts are long)
and never *tactical* (I must reallocate channels to release this primordium).

---

## 1. THESIS

Universal Paperclips' stock market has no agency (teardown §8.4). You cannot pick a stock, a price,
an amount, or a moment to sell. It works only because it is a *variance surface* and because Yomi
lets you buy the house edge — the pleasure is not trading, it is watching a coin flip become a
machine.

The Pact Book keeps the thing UP got right — **buying the house edge is deeply satisfying** — and
replaces everything it faked. Its one-sentence description:

> **You allocate a hard-capped number of channels across living partners who each pay back in a
> different currency, on a different curve, with a different exposure to five shared shocks —
> and the longer you hold a partner the more they pay you and the less you can afford to leave.**

Four properties do the work:

**1. A hard, integer, slowly-growing budget.** Channels are 3 at the start and at most 19 at the end.
Every decision is a knapsack. There is no "buy more of everything" escape.

**2. Payoff *shapes* differ, not just magnitudes.** Each guild has its own channel exponent α (§4).
GHOST is α=0.55 — one channel is 68% as good as four, so you spread. BROOD is α=1.35 — four channels
are 6.6× one, so you concentrate. That single column of the guild table means the optimal book is
never "a bit of everything," and it is discoverable from the numbers on the card.

**3. Compounding tenure that reallocation destroys.** `bondMult` runs 1.00 → 2.60 over an hour of
continuous holding, and *changing a pact's channel count partially resets its tenure* (§3.3). The
question the player asks forty times per run — "is this worth breaking a bond for?" — is the
question the layer exists to ask.

**4. A five-factor covariance structure, hidden then revealed then quantified.** Partners are not
independent. Two pacts that look unrelated may both be long moisture. A drought that halves your
income was *visible in your own exposure readout twenty minutes earlier*. This is the intellectual
content, it is genuinely learnable, and — crucially — **one of the five factors (CANOPY) declines
monotonically across Act II because you are eating the forest**, so a run has a long-horizon thesis
in it, and a player who understands that builds a different book than one who doesn't.

Everything else — betrayal, brokering, the endgame liquidation — is scaffolding on those four.

### 1.1 The optionality contract

The Pact Book is **optional and heavily rewarding**, which is the correct shape for a strategic layer
(teardown §2.9). Published margins, which QA must verify:

| Play | Act II duration | ACCORD earned | `LEGACY` contribution | Act III start |
|---|---|---|---|---|
| **Zero pacts** | ~4h20m | 0 | +0.00 | weakest, but completable |
| **Naive book** (sign everything, never reallocate) | ~3h15m | ~1,400 | +0.09 | fine |
| **Competent book** | ~2h45m | ~4,200 | +0.19 | good |
| **Expert book** | ~2h20m | ~7,600 | +0.25 (cap) | best |

The floor that guarantees no dead end (UP's *Beg For More Wire* principle, teardown §1 beat 4):

```
passiveMineral = 0.90 · claimedCount^0.60      ⛬/s, always on, never displayed as a pact
```
At 61 claimed that is 10.4 ⛬/s — enough to complete the act's mineral demand in about 53 minutes of
pure waiting. Slow, boring, guaranteed. **There is no dead end and there is no free lunch.**

---

## 2. THE RESOURCE: BANDWIDTH

### 2.1 What it is

Bandwidth is the network's translocation capacity — how many simultaneous chemical conversations the
mycelium can hold open. It is an **integer** count of **channels**. It is never a rate, never a
float, and never displayed as a percentage.

Integer is not an aesthetic choice. On a phone, a discrete budget of 3–19 with pip UI is
thumb-manipulable and glanceable; a float budget is neither.

### 2.2 Capacity

```
channelCap = 2
           + floor( 1.45 · ln(1 + claimedCount) )      // territory
           + accordChannels                            // bought with ⟡, §2.3
           + projectChannels                           // 4 total from projects, §12
```

| `claimedCount` | territory term | base cap |
|---|---|---|
| 1 | 1 | 3 |
| 2 | 1 | 3 |
| 3–5 | 2 | 4 |
| 6–11 | 2–3 | 4–5 |
| 12–23 | 3 | 5 |
| 24–46 | 4 | 6 |
| 47–61 | 5 | 7 |

So territory alone caps out at **7**. The other 12 are bought — 8 with ACCORD, 4 with projects —
which means **bandwidth is the ACCORD sink that makes ACCORD matter**, and a player who never
suffers never grows their book.

### 2.3 Buying channels with ACCORD

```
channelCost(n) = ceil( 40 · n^1.85 )     ⟡, for the n-th purchased channel
```

| n | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| cost ⟡ | 40 | 145 | 305 | 520 | 790 | 1,114 | 1,490 | 1,920 |
| cumulative | 40 | 185 | 490 | 1,010 | 1,800 | 2,914 | 4,404 | **6,324** |

An expert book earns ~7,600 ⟡ across the act, so buying all 8 channels leaves ~1,300 ⟡ for
brokering (§9) and severance (§7.3). **You cannot have everything.** The competent book (4,200 ⟡)
buys 5 channels and brokers once, or 6 channels and never brokers.

`accordChannels` is capped at **8**. Hard cap, stated in the UI as `8 / 8 grown`.

### 2.4 Pact slots — the second constraint

Channels are one budget. **Slots** — how many separate pacts may exist at once — are the other.
Slots come only from projects (§12), never from ACCORD, never from territory:

```
pactSlots: 2 (start) → 3 → 4 → 5 → 6 → 7 → 8 → 9
```

Two budgets that grow at different rates is the entire reason the knapsack stays interesting.
Early: many channels, few slots ⇒ **concentrate** (and BROOD's α=1.35 rewards you). Late: many
slots, channels lagging ⇒ **spread** (and GHOST's α=0.55 rewards you). The optimal book *shape*
inverts across the act without a single number being re-tuned.

Slots-to-channels ratio over the act:

| phase | slots | channels | ch/slot | book shape it implies |
|---|---|---|---|---|
| P1 | 2 | 3 | 1.5 | one real pact, one probe |
| P2 | 4 | 5–6 | 1.4 | still concentrated |
| P3 | 5 | 7–9 | 1.7 | **peak concentration** |
| P4 | 7 | 11–13 | 1.8 | wide with two anchors |
| P5 | 8 | 14–17 | 2.0 | anchors + satellites |
| P6 | 9 | 17–19 | 2.0 | liquidating |

### 2.5 Congestion — the convex cost of a big book

Every channel costs biomass per second, and the cost is convex in the *total*:

```
congestion  = 1 + 0.012 · totalChannels                                  [K: 0.012]
cost_p      = CH_COST_FRAC · grossBiomassRate · ch_p · congestion · costMod(guild_p)
CH_COST_FRAC = 0.019                                                     [K]
```

`grossBiomassRate` is the player's gross decomposition rate **before** pact effects, so the cost
scales with the player automatically and never needs re-tuning across four orders of magnitude.

Total book cost as a fraction of gross biomass income:

| totalChannels | congestion | cost fraction (all `costMod`=1.0) |
|---|---|---|
| 3 | 1.036 | 5.9% |
| 6 | 1.072 | 12.2% |
| 10 | 1.120 | 21.3% |
| 14 | 1.168 | 31.1% |
| 19 | 1.228 | **44.3%** |

A full book eats 44% of gross biomass. That is enormous, it is *supposed* to be enormous, and it is
displayed on the header as a live percentage. The question "is my book too big" is a real question
with a real answer that changes as the forest declines.

`costMod` by guild: ROOT 1.00 · NODULE 0.75 · BROOD 1.45 · GHOST 1.20 · CROWN 0.85 · RIVAL 1.60.

**Attribution:** total cost is computed globally from `totalChannels` and then attributed per-pact
pro-rata by `ch_p · costMod_p`, so each card can show its own honest cost line. Implement it once as
`recomputeCosts()`, called on any channel change and on any change to `grossBiomassRate` (throttled
to 2 Hz).

---

## 3. THE PACT OBJECT

### 3.1 Record

```js
Pact = {
  id:          7,
  partnerId:   "brood_dendroctonus_4",
  guild:       3,                 // enum GUILD.BROOD
  regionId:    22,                // null for guilds that are not region-bound
  ch:          3,                 // integer channels, 0 … chMaxForPact
  tenure:      1350.0,            // seconds of *effective* continuous holding
  strain:      0.19,              // 0 … 1
  stake:       1.2e8,             // biomass escrowed at signing
  termSeasons: 3,                 // 1 … 6, one season = 1800 s (Act II §7.2)
  signedAt:    2340.0,
  endsAt:      7740.0,
  beta:        [0.81,-0.44,0.35,0.10,0.22],   // exposure vector, hidden until §5.4
  traits:      ["prolific","hygrophile","watchful"],
  known:       0b011,             // bitmask: which traits are revealed
  noticeAt:    null,              // t when a NOTICE was issued, else null
  ledger:      Float32Array(120), // 120 samples of realised yield, 1 Hz ring buffer
  accordPaid:  318.4,             // lifetime ⟡ from this pact, for the detail sheet
  state:       "active"           // active | notice | breached | honoured | severed | lapsed
}
```

Memory: 9 pacts × ~600 bytes = 5.4 KB. Save it whole.

`chMaxForPact` = `min(channelCap, 5)`. **No single pact may exceed 5 channels.** This exists so that
BROOD's α=1.35 cannot degenerate into "all channels in one beetle." At ch=5, BROOD is 8.78× a single
channel; at an uncapped ch=19 it would be 55×, which would delete the layer.

### 3.2 Bond — the compounding term

```
bond      = 1 − exp( −tenure / TAU_BOND )        TAU_BOND = 900 s          [K]
bondMult  = 1 + BOND_K · bond^1.20               BOND_K   = 1.60           [K]
```

| tenure | bond | bondMult |
|---|---|---|
| 0 s | 0.000 | **1.000** |
| 120 s | 0.125 | 1.135 |
| 300 s | 0.283 | 1.341 |
| 600 s | 0.487 | 1.667 |
| 900 s (τ) | 0.632 | **1.900** |
| 1,800 s | 0.865 | 2.360 |
| 3,600 s | 0.982 | 2.570 |
| ∞ | 1.000 | 2.600 |

A pact held for the whole act is worth **2.6×** a pact signed this minute. That number is the price
of every reallocation, and it is printed on the card as `bond ████████░░ 1.87×`.

### 3.3 The tenure penalty — why reallocation costs something

```
on setting ch from ch_old to ch_new (ch_new ≠ ch_old):
    Δ = |ch_new − ch_old|
    tenure *= exp( −PLASTICITY · Δ / max(1, ch_old) )
    PLASTICITY = 0.55                                                      [K]
                 → 0.22 after project `pact_plasticity` (D-tier)
```

| ch_old | Δ=1 | Δ=2 | Δ=3 |
|---|---|---|---|
| 1 | ×0.577 | ×0.333 | ×0.192 |
| 2 | ×0.760 | ×0.577 | ×0.439 |
| 3 | ×0.832 | ×0.692 | ×0.577 |
| 4 | ×0.872 | ×0.760 | ×0.663 |
| 5 | ×0.895 | ×0.801 | ×0.717 |

Read the direction carefully, because it is counter-intuitive and it is the point:

> **Wide pacts are cheap to adjust. Narrow pacts are expensive to adjust.**

A 4-channel anchor can be tuned ±1 for a 13% tenure haircut. A 1-channel probe cannot be grown to 2
without losing 42% of everything it has learned about you. Consequences the player will feel:

1. **The first channel into a new pact is the commitment.** Deciding to enter at 1 vs 2 vs 3 is a
   real decision made *before* you know the partner's hidden traits, and it cannot be walked back
   cheaply.
2. **Your big positions are your flexible ones.** This inverts the usual incremental-game intuition
   and gives experienced players something to know.
3. **GHOST (α=0.55, wants exactly 1 channel) is structurally rigid.** You set a ghost and you carry
   it. That is exactly what carrying a parasite should feel like.

Setting `ch = 0` does **not** apply the penalty formula — it applies `neglect` instead (§6.1), which
drives strain to 1.0 in about 140 seconds. A parked pact dies. There is no free storage.

### 3.4 Term, expiry, renewal

`termSeasons ∈ 1..6`, one season = 1,800 s (Act II §7.2). Term is chosen at signing.

Term does **not** change per-second yield. It changes three things:

```
honourAccord   = 60 · ch^0.50 · termSeasons^0.70          ⟡ paid at full-term completion
severCost      = 18 · ch · (1 + bond) · sqrt(remainingSeconds / 60)     ⟡
stakeRequired  = 0.9 · grossBiomassRate · 60 · ch · (1 + 0.35·termSeasons)   g, escrowed
```

At expiry:
- **Renewed within 60 s** (a button on the card, which pulses): tenure preserved **100%**, new term
  chosen, `+honourAccord` paid.
- **Not renewed within 60 s**: pact lapses. `tenure ×= 0.35`, channels freed, `+honourAccord` still
  paid, partner returns to the offer pool with no grudge. You may re-sign — at 35% of your tenure.
- **Auto-renew** (project `pact_perennial`, C-tier): always renews, always on `termSeasons = 2`,
  preserves 100% tenure. Strictly worse than attentive play, by a **published margin**: 2 seasons
  gives `honourAccord` scaling `2^0.7 = 1.625` versus `6^0.7 = 3.509` for a hand-renewed 6-season
  term — **a 54% ACCORD haircut, forever.** (Act II §11.4 principle: automation is always worse than
  skilled play, and we tell you by how much.)

Expiry is the one thing the Pact Book asks you to be present for. Nine pacts on 1–6 season terms
produce roughly one expiry every 6–9 minutes in the mid-game — a metronome that is frequent enough
to bring you back and sparse enough never to feel like a chore.

---

## 4. THE SIX GUILDS

The universal yield equation, evaluated per pact each slow tick (0.5 Hz) and interpolated for
display:

```
yield_p = BASE(partner)
        · ch_p ^ ALPHA(guild)
        · bondMult_p
        · shockMult_p                       // §5
        · traitMult_p                       // §8
        · (1 − 0.85 · strain_p)             // §6
        · scale_p                           // guild-specific world anchor
```

Units of `yield_p` differ by guild. This is deliberate and is the whole reason six guilds exist
(teardown principle 11: currencies earned by different *activities*, not different amounts).

### 4.0 The guild table

| | **ROOT** ⊥ | **NODULE** ◍ | **BROOD** ⬡ | **GHOST** ◌ | **CROWN** △ | **RIVAL** ✕ |
|---|---|---|---|---|---|---|
| Partners are | tree stands | bacteria | insects | mycoheterotrophs | lichens | rival fungi |
| **Pays in** | minerals ⛬/s | biomass rate **fraction** | biomass **lumps** | Insight Ψ/s | Signal **fraction** + forecast | rival suppression + map |
| **Payoff shape** | steady | steady multiplier | Poisson lumps | steady trickle | steady multiplier | steady decay of a threat |
| **α** | **0.80** | **1.00** | **1.35** | **0.55** | **1.00** | **1.20** |
| `costMod` | 1.00 | 0.75 | 1.45 | 1.20 | 0.85 | 1.60 |
| `tolerance` (crowding) | 4 | 2 | 2 | 5 | 3 | 1 |
| Region-bound | yes | yes | yes | no | yes | no |
| Betrayal costs you | **cognition** | **throughput** | **carbon** | **bandwidth** | **information** | **territory** |
| Arrives (phase) | P1 | P1 | P2 | P2 | P3 | P4 |

Six guilds, six things you can lose. That table is the answer to "what is at stake," and it is
structural rather than numeric — no two breaches feel the same.

### 4.1 ROOT ⊥ — the anchor

Partners are stands of the five Act II species (§6.5 of the Act II doc), one pact per region.
Requirements: `claimed && d ≥ 0.30 && T ≥ 0.35·T0 && !necrotized`. Voided instantly and permanently
if any lapses — by fire, necrotrophy, or a rival retaking the stand.

```
BASE_ROOT = 26                      ⛬/s                                    [K]
scale_p   = kappa_i · (T_i / 1e11)^0.42 · mineralModTerrain_i
ALPHA     = 0.80
```

Sublinear α means ROOT wants **breadth**: four 1-channel roots (4×1 = 4.00) beat one 4-channel root
(4^0.8 = 3.03) by 32%. But four roots cost four slots, and slots are the scarcer budget until P4.
**ROOT is the guild that becomes correct late.**

ROOT is also the guild whose payout **decays as you eat the forest**: `T_i` falls, so `scale_p`
falls with exponent 0.42, and its typical `β2 (CANOPY)` is strongly positive. A ROOT-heavy book is a
bet that you will consume slowly. That is the Symbiont path (Act II §9.6) expressed as a portfolio.

Act II §10.2's three contract *types* survive here as a signing-time choice on every ROOT pact:

| ROOT type | payout | multiplier on `BASE_ROOT` |
|---|---|---|
| **MINERAL** | ⛬/s as above | ×1.00 |
| **INTERFACE** | sets `hasContract_i = true` → `liveInterface_i × 1.50` (Act II §4.1) | ×0.00 (pays no minerals) |
| **ALARM** | `forecastHorizon += 90 s` in region *i* only | ×0.35 |

The three cost identically. INTERFACE pays in Signal via the Act II interface formula and therefore
scales with the *whole network*, not with the region — so INTERFACE is right when your book is large
and your forest is intact, and MINERAL is right when you need density steps now.

### 4.2 NODULE ◍ — the multiplier

Three named partners, each appearing at most once per run, plus procedurally generated instances
from ring 3+ regions after P3.

```
BASE_NODULE = 0.085                 dimensionless fraction of biomass rate               [K]
scale_p     = (1 + 0.40·humus_i) · nitrogenMod
ALPHA       = 1.00

effect:  biomassRate *= (1 + Σ_{p ∈ NODULE} yield_p)
```

| Partner | `BASE` mult | `TAU_BOND` mult | character |
|---|---|---|---|
| **Frankia** *(the alder nodules)* | ×1.00 | ×1.60 (slow) | Bonds slowly, caps highest. The long hold. β4 (DECAY) strongly positive. |
| **Rhizobium** *(the vetch in the clearing)* | ×1.30 | ×0.55 (fast) | Bonds in six minutes, `BOND_K ×0.60` so it caps at 1.96×. β3 (SEASON) ±0.9 — it is a seasonal instrument. |
| **Streptomyces** *(the grey filaments)* | ×0.90 | ×1.00 | Steady. `tolerance` 1 instead of 2 — it will not share a book with another nodule for long. |

At ch=4, bond 2.50, trait 1.35: `0.085 × 4 × 2.50 × 1.35 = 1.147` ⇒ **+115% biomass rate** from one
pact. That is the single largest multiplier available anywhere in Act II, it takes an hour of
continuous holding to reach, and it is one breach away from zero.

### 4.3 BROOD ⬡ — the lumps

The variance guild. Pays nothing continuously; pays large discrete deliveries on a Poisson process.

```
BASE_BROOD = 9.5                    seconds-of-gross-production per delivery             [K]
ALPHA      = 1.35

deliverySize   S = BASE_BROOD · grossBiomassRate · ch^1.35 · bondMult · shockMult · traitMult
                                                 · (1 − 0.85·strain) · scale_p
meanInterval   I = 240 / ( ch^0.35 · (1 + 0.70·bond) · intervalMod_partner )   seconds    [K: 240]

each sim tick:  if ( rand() < dt / I )  deliver(S)
```

Expected rate = `S / I`, which is what the card shows (with the sparkline showing the actual lumps).

| ch | bond | S (× gross-seconds) | I (s) | expected rate (× gross) |
|---|---|---|---|---|
| 1 | 0.00 | 9.5 | 240 | 0.040 |
| 2 | 0.00 | 24.2 | 188 | 0.129 |
| 3 | 0.59 | 43.3 | 116 | 0.373 |
| 4 | 0.86 | 74.4 | 88 | 0.845 |
| 5 | 0.90 | 83.4 | 83 | **1.005** |

At full commitment BROOD **doubles your biomass income**, in lumps averaging 83 seconds apart, with
a coefficient of variation of 1.0 (Poisson). The card shows both `+1.00× gross` and
`last 5: 71s 118s 46s 92s 61s` — the mean and the lived experience, side by side, because the gap
between them is the whole feeling of the guild.

| Partner | `BASE` mult | `intervalMod` | special |
|---|---|---|---|
| **Atta** *(the leafcutters under the beech)* | ×1.15 | 1.00 | Largest lumps. `tolerance` 1. |
| **Reticulitermes** *(the termites in the standing dead)* | ×0.80 | 1.45 (frequent) | Lower variance. Converts `T_i → L_i` at 0.4% per minute in its region — **it makes its own substrate**, which raises your decomposition and lowers your Signal. |
| **Dendroctonus** *(the beetle brood)* | ×1.05 | 1.25 | **Kills trees:** `T_i` decay rate ×1.40 in its region and the two adjacent. A partner whose success destroys your cognition. |

Dendroctonus is the guild's thesis in one partner. It is the best carbon in the game and you can
watch, on the map, the stands going pale around it.

### 4.4 GHOST ◌ — the parasites who pay in thought

Mycoheterotrophs. They take carbon and give nothing back that a plant would recognise. What they
give you is **Insight**.

```
BASE_GHOST = 0.22                   Ψ/s                                                  [K]
scale_p    = 1 + 0.30 · (insightRipeness)          // reads Act II §5's ripeness term
ALPHA      = 0.55
```

α = 0.55 is the extreme: 1 ch → 1.00, 2 ch → 1.46, 4 ch → 2.14. **Four ghosts at one channel each
(4.00) beat one ghost at four channels (2.14) by 87%.** Ghosts are the reason `pactSlots` matters,
and their `tolerance` of 5 means they are the only guild that will happily fill your whole book.

Additional effect, all GHOST pacts:
```
ripenessFloor += 0.06 · ch^0.55        (capped at +0.30 total across the book)
```
(This raises the floor of Act II §4.6's `RIPENESS` multiplier, which means a ghost-heavy player
flushes on a different schedule. Flagged for the Act II author to reconcile the exact cap.)

| Partner | `BASE` mult | special |
|---|---|---|
| **Monotropa** *(the ghost pipe)* | ×1.00 | Pure Ψ. β vector near zero — **it does not care what the weather does.** The book's only true neutral asset, and therefore the correct thing to hold when your exposure is already extreme. |
| **Corallorhiza** *(the coralroot)* | ×0.85 | `ripenessFloor` coefficient 0.11 instead of 0.06. |
| **Voyria** *(the pale gentian)* | ×0.75 | **Reveals the β vector of every other pact in the book immediately**, ignoring the tenure schedule. The information partner. Costs 25% of its yield to be the thing that lets you see. |

Voyria is the intended P3 purchase and it is deliberately bad at its stated job.

### 4.5 CROWN △ — signal and weather

Canopy lichens. Region-bound to a claimed region with `canopy_i ≥ 0.70`.

```
BASE_CROWN = 0.10                   dimensionless fraction of Signal rate                [K]
scale_p    = canopy_i · (T_i / T0_i)^0.30
ALPHA      = 1.00

effect:  signalMult += Σ_{p ∈ CROWN} yield_p
         forecastHorizon += Σ_{p ∈ CROWN} ( FH_BASE_partner · ch^0.50 · bondMult )
```

| Partner | `BASE` mult | `FH_BASE` (s) | special |
|---|---|---|---|
| **Lobaria** *(the lungwort on the north faces)* | ×1.00 | 45 | The balanced one. |
| **Bryoria** *(the horsehair lichen)* | ×0.55 | 95 | Forecast-heavy. **β1 (MOISTURE) is always ≤ −0.75** — a dry-adapted partner and therefore the book's standard moisture hedge. |
| **Cyanolichen mat** *(the black crust)* | ×1.55 | 20 | Signal-heavy, and **β1 ≥ +0.90 always.** The highest-yield, highest-exposure asset in the game. |

Bryoria and the cyanolichen are the same guild, the same payout formula, and *opposite* factor
loadings. Holding both is a straddle. The game never uses that word.

### 4.6 RIVAL ✕ — pacts with competitors

The last guild, arriving at P4. Partners are the four rival strains from Act II §8.2. `tolerance` 1:
**you may hold at most one rival pact before crowding bites**, and rivals talk to each other.

```
BASE_RIVAL = 0.0022                 rivalStr reduction per second                        [K]
scale_p    = 1.0
ALPHA      = 1.20

effect (per second):
   for each region j adjacent to any region held by the allied strain:
       rivalStr_j -= yield_p / adjacentCount      (floored at 0)
   advCostMult   *= (1 − 0.05 · ch^1.20)          [clamped ≥ 0.55]
   barrier crossings into allied-adjacent regions cost ×1.00 instead of ×2.40
   the allied strain's holdings become `discovered` and `surveyed` for free
```

At ch=3: `3^1.2 = 3.737`, so 0.0082 rivalStr/s — a full 1.0 threat cleared in 122 s — plus
`advCostMult ×0.813` and free surveying of a quarter of the map. RIVAL is the strongest
*territorial* instrument in the act and it pays nothing you can spend.

| Partner | `BASE` mult | special |
|---|---|---|
| **Armillaria** *(the honey fungus)* | ×1.55 | Enormous and treacherous. Base `strain` accrual +0.0009/tick regardless of conditions — it is *always* drifting toward breach. Ties into Act II §8.4's Armillaria dilemma. |
| **Trichoderma** | ×0.90 | Cheap (`costMod` 1.20 instead of 1.60), fast-bonding (`TAU_BOND ×0.50`), and `BOND_K ×0.45` so it caps at 1.72×. The disposable ally. |
| **Hypholoma** | ×0.70 | Steady, low ceiling, `tolerance` 2 — the only rival that will tolerate a second rival pact. |

**Rival betrayal is the worst breach in the game** (§7.2) and Armillaria is designed to betray you.
That is not a trap; it is legible from its strain accrual line on the card from the first minute.

---

## 5. THE FACTOR MODEL — the intellectual content

### 5.1 Why

A portfolio of independent assets is arithmetic. A portfolio of *correlated* assets is a strategy.
UP's stock market had no correlation structure because it had no structure at all. This is the layer
that makes the Pact Book worth returning to for three hours.

Five factors. Each is a normalised, signed reading of a state variable **the player can already see
somewhere else in the game**. Nothing here is a private random walk; every factor is a lens on the
world the player is already managing.

### 5.2 The five factors

```
F1 MOISTURE = clamp( (W − Wbar) / 0.25 , −2, 2 )
              W, Wbar from the Flush's OU walk (Act II §7.2). Wbar = 0.52.

F2 CANOPY   = clamp( ( ΣT_i / ΣT0_i − 0.50 ) · 2 , −1, 1 )
              how much living forest remains. MONOTONICALLY DECLINING across Act II.

F3 SEASON   = sin( 2π · t / SEASON_S )          SEASON_S = 1800 s
              the same 30-minute cycle the Flush uses. Purely deterministic.

F4 DECAY    = clamp( (humusMean − 0.50) · 2 , −1, 1 )
              mean humus across claimed regions. Rises with Retention ρ, falls with extraction.

F5 PRESSURE = clamp( ( ΣrivalStr / claimedCount − 0.20 ) · 2.5 , −1, 1 )
              rival pressure. Rises when you neglect the map.
```

Their characters, which is what the player actually learns:

| | volatility | predictability | player control | horizon |
|---|---|---|---|---|
| **F1 MOISTURE** | **high** | forecastable (OU, §7.3 Act II) | none | minutes |
| **F2 CANOPY** | very low | **certain, and it only goes down** | total (Retention dial) | the whole act |
| **F3 SEASON** | medium | **perfect** | none | 30 min cycle |
| **F4 DECAY** | low | slow | high (Retention dial) | tens of minutes |
| **F5 PRESSURE** | medium | reactive | high (RIVAL pacts, Pulse) | minutes |

**F3 is deterministic and everyone can see it.** A player who loads up on β3-positive partners and
sells before the trough is doing something real and repeatable — that is the layer's *first*
learnable edge and it is available in P2, before the exposure view exists, purely by watching a
sparkline oscillate on a 30-minute period.

**F2 is the long thesis.** `ΣT/ΣT0` runs 1.00 → ~0.05 over Act II. F2 therefore runs **+1.00 → −0.90**
monotonically. Every β2-positive partner is a decaying asset and every β2-negative partner is a
compounding one, over hours. A player who notices this restructures their book around minute 90 and
gains roughly 18% of book yield across the back half. A player who doesn't watches their anchors
quietly rot and never learns why. **That is the deepest thing in the layer and nothing ever says it.**

### 5.3 Exposure vectors and the shock multiplier

Each partner instance carries `β = [β1..β5]`, each in `[−1.2, +1.2]`, rolled at generation from a
guild-biased distribution:

```
β_f = clamp( GUILD_BETA_MEAN[guild][f] + 0.42 · N(0,1) , −1.2, 1.2 )
```

`GUILD_BETA_MEAN` (the table a designer tunes; these are the shipping values):

| guild | β1 MOIST | β2 CANOPY | β3 SEASON | β4 DECAY | β5 PRESS |
|---|---|---|---|---|---|
| **ROOT** | +0.35 | **+0.80** | −0.15 | +0.20 | −0.10 |
| **NODULE** | +0.45 | +0.20 | +0.55 | **+0.70** | −0.05 |
| **BROOD** | +0.60 | **−0.40** | +0.35 | +0.10 | +0.25 |
| **GHOST** | 0.00 | +0.10 | 0.00 | +0.15 | 0.00 |
| **CROWN** | +0.20 | +0.55 | −0.30 | −0.10 | 0.00 |
| **RIVAL** | −0.10 | −0.25 | 0.00 | 0.00 | **−0.85** |

Read down the β2 column: **ROOT and CROWN die with the forest, BROOD and RIVAL thrive on its death.**
That is Act II's central tragedy expressed as a covariance matrix, and it means the necrotroph path
(Act II §9.6) and the symbiont path have *different correct books*, without a single scripted branch.

Read the GHOST row: **all zeros.** Ghosts are the only factor-neutral asset. They pay less than they
should, and they pay it in every weather. Every portfolio game needs a cash position; this is ours,
and it is a parasite.

```
shockMult_p = clamp( 1 + SHOCK_GAIN · Σ_f (β_{p,f} · F_f) , 0.15, 2.60 )
SHOCK_GAIN  = 0.42                                                        [K]

envStress_p = max( 0, −Σ_f (β_{p,f} · F_f) ) · 0.80        // feeds strain, §6
adverse_p   = max( 0, −Σ_f (β_{p,f} · F_f) )               // feeds ACCORD, §10
```

Note that `shockMult` clamps at 2.60 on the upside and 0.15 on the downside — an asymmetric range,
because a partner having a wonderful day is less interesting than a partner starving.

### 5.4 The information schedule — β is hidden, then banded, then exact

| State | How reached | What the card shows |
|---|---|---|
| **Opaque** | before project `pact_chemotaxis` (C-tier, 340 Ψ) | nothing; the exposure row is absent |
| **Guild prior** | after `pact_chemotaxis` | the `GUILD_BETA_MEAN` row, drawn faintly, labelled `typical` |
| **Banded** | tenure ≥ 240 s | true β ± 0.42, drawn as five signed bars with error whiskers |
| **Exact** | tenure ≥ 600 s | five signed bars, exact, with numerals |
| **Exact, instantly** | holding a **Voyria** ghost | all pacts jump straight to Exact |

**You learn a partner by keeping it.** A player who churns pacts every ten minutes is playing the
game blindfolded forever, and the game never tells them so. That is the single cruellest and best
rule in the layer: *the information is free, and the price is commitment.*

### 5.5 The book exposure readout

```
share_p   = ch_p / totalChannels
bookβ_f   = Σ_p ( share_p · β_{p,f} )
bookMult  = Σ_p ( share_p · shockMult_p )
```

Channel-weighted, not yield-weighted, because channels are what the player controls and yield-weight
would make the readout move when you weren't touching it. (Yield-weighted is available in the detail
sheet as a second row for players who want it; it is off by default.)

### 5.6 Stress tests — the killer feature

Three canned scenarios, each recomputing `bookMult` with one factor forced:

```
"if it dries out"     F1 := (W_p15 − Wbar)/0.25    where W_p15 = E[W(t+300)] − 1.04·SD(300)
"if the canopy goes"  F2 := −0.90                  (the act's terminal value)
"at the trough"       F3 := −1.00                  (15 minutes from now, always)
```

Rendered as three right-aligned lines under the exposure bars:

```
── if it dries out       ×0.68
── if the canopy goes    ×1.04
── at the trough         ×0.91
```

A risk report a phone can show in three lines. It is the first thing an expert reads and the last
thing a novice understands, and the gap between those two facts is where the hours live.

---

## 6. STRAIN — the betrayal driver

### 6.1 Accumulation

Evaluated on the slow tick (0.5 Hz, `dt_slow = 2.0 s`):

```
demandMet_p = clamp( paidThisWindow_p / owedThisWindow_p , 0, 1 )
crowd_p     = 0.30 · max( 0, guildCount(guild_p) − tolerance(guild_p) )
neglect_p   = (ch_p == 0) ? 1 : 0

dStrain = ( 0.90 · (1 − demandMet_p)
          + 1.15 · envStress_p
          + crowd_p
          + 1.20 · neglect_p
          − 0.22 · bond_p
          − 0.16 )                            // baseline forgiveness
        · STRAIN_RATE · dt_slow

STRAIN_RATE = 0.0020 / s                                                   [K]
strain_p = clamp( strain_p + dStrain, 0, 1 )
```

Plus per-partner constants (Armillaria's `+0.0009/s`, `PATIENT`/`FICKLE` traits — §8).

Calibration checks a QA pass must reproduce:

| situation | `dStrain`/s | 0 → 0.80 in |
|---|---|---|
| healthy, new pact (bond 0), no stress | −0.00032 | never (recovers) |
| healthy, mature pact (bond 0.96), no stress | −0.00074 | never |
| **sustained adverse shock, `envStress` 0.72, bond 0.96** | **+0.00362** | **221 s** |
| paying 50% of owed, no other stress | +0.00048 | 1,667 s |
| one guild over tolerance by 1, bond 0.5 | +0.00034 | 2,353 s |
| channels set to 0, bond 0.9 | +0.00568 | **141 s** |

**Four minutes of a real drought puts a mature pact into NOTICE.** That is the tempo the layer is
tuned to: long enough that you can respond, short enough that you must.

Note `− 0.22 · bond`: **old partners forgive you.** A four-hour partner tolerates roughly 20% more
adversity before it starts to strain than one signed this minute. Loyalty is a mechanic.

### 6.2 The three-stage ladder — no coin flips anywhere

```
strain ≥ 0.55                      → WARNING
strain ≥ 0.80                      → NOTICE   (a demand is issued, 90 s to comply)
strain == 1.00 held for 45 s       → BREACH
```

**WARNING.** The card's left border goes from hairline to 3 px. Console:
`> the beetles are not answering as quickly.` No other effect — the payout penalty
`(1 − 0.85·strain)` has already been eroding since strain left zero, and by 0.55 it is ×0.53, which
the player has been watching on the sparkline for two minutes.

**NOTICE.** The partner issues a **demand**, guild-specific, with a 90-second timer drawn as a
depleting bar across the card. Exactly one of:

| guild | demand | comply cost | on comply |
|---|---|---|---|
| ROOT | *more sugar* | `0.09 · biomass` immediately | `strain −= 0.45` |
| NODULE | *more channels* | `+1 ch` for 300 s (must come from somewhere) | `strain −= 0.50` |
| BROOD | *tribute* | `0.055 · biomass` immediately | `strain −= 0.45` |
| GHOST | *nothing* — it simply stops paying | — (cannot be complied with) | strain must be reduced by fixing exposure |
| CROWN | *a longer term* | extend `termSeasons` by 2, no renegotiation | `strain −= 0.40` |
| RIVAL | *land* | cede one claimed region adjacent to theirs (it reverts) | `strain −= 0.60` |

Complying is often correct and never automatic. GHOST's inability to be appeased is the guild's
whole character: **you cannot buy a parasite's goodwill, you can only change the weather it lives
in** — i.e. rebalance the book.

**BREACH.** §7.

### 6.3 Reading strain, not guessing it

The card's strain bar has three tick marks at 0.55 / 0.80 / 1.00 and a **derivative caret** — a
small `▲` or `▼` showing the sign of `dStrain` and its magnitude in three steps. The player can see
whether a pact is healing or dying without doing arithmetic. On the detail sheet, the full breakdown:

```
STRAIN  0.61  ▲▲
  unpaid        0.00
  exposure     +0.83   ← MOISTURE −1.24, you are long
  crowding      0.00
  bond relief  −0.21
  baseline     −0.16
  net          +0.46  per 100 s
```

Six lines. Every bad outcome in this layer is traceable to a term the player can read.

---

## 7. BREACH — six different disasters

### 7.1 The common effects

```
on BREACH of pact p:
    stake_p is FORFEIT                       (goes to the partner; it is gone)
    ch_p channels are freed but LOCKED for 120 s   ("the channels are still full of them")
    partner.grudge   = 1
    partner.refuseUntil = t + 900 s
    guildRep[guild_p] -= 12                  // 0…100, gates offer quality within the guild
    bookRep           -= 4                   // 0…100, gates offer quality everywhere
    accord            += 0                   // nothing. Suffering pays; failing does not.
    p.state = "breached"; remove from book after a 6 s red card animation
```

`guildRep` and `bookRep` both feed the offer generator (§11.2): low reputation means worse `BASE`
multipliers, shorter maximum terms, and worse partners in the pool. Four breaches in one guild and
that guild's best partner will not deal with you again this run.

### 7.2 The six guild-specific effects

| guild | on breach | what it feels like |
|---|---|---|
| **ROOT** ⊥ | `liveInterface_i ×= 0.55` for 300 s | Your Signal rate visibly drops. You got **stupider**. |
| **NODULE** ◍ | `enzymePower E ×= 0.92`, **permanent** until project `pact_refixation` (2 Ψ-tier, re-armable, `340 · 2^k` Ψ) | A permanent throughput scar with a visible, escalating price to remove. |
| **BROOD** ⬡ | **they raid**: `biomass -= 0.06 · biomass` instantly; every other BROOD pact `strain += 0.25` | A number you were watching drops by 6% in one frame, and the rest of the guild turns on you. |
| **GHOST** ◌ | **it does not leave.** Channels stay consumed, yield goes to 0, for 600 s | You lose *bandwidth* for ten minutes. The only breach that costs you the resource itself. |
| **CROWN** △ | `forecastHorizon := 0` for 400 s | You go blind, and the OU walk does not wait. |
| **RIVAL** ✕ | `rivalStr_j += 0.30` in **every** region you hold adjacent to theirs; the strain's spread rate ×1.6 for 600 s | A visible red bloom across a third of the map. |

Six breaches, six different currencies of pain, and each one is *the thing that guild was protecting
you from.* Nothing is a flat "you lose N resources."

### 7.3 Severance — leaving honourably

Always available, never free:

```
severCost = 18 · ch · (1 + bond) · sqrt( remainingSeconds / 60 )     ⟡
```

A 3-channel, bond-0.9, 40-minutes-remaining pact: `18 × 3 × 1.9 × sqrt(40) = 649 ⟡`. That is four
and a half channel-purchases' worth of ACCORD. **Leaving a mature pact costs more than growing your
whole book by a channel.**

On severance: stake returned in full, channels freed immediately (no lock), `guildRep −2`,
`bookRep 0`, partner returns to the pool at `refuseUntil = t + 300 s` with no grudge.

The three-way choice at every crisis — **comply / endure / sever** — has no dominant answer, and the
correct one depends on `remainingSeconds`, `bond`, your ⟡ balance, and your read on the weather.
That is the recurring decision the layer is built around.

---

## 8. HIDDEN TRAITS

Each partner instance rolls **3 distinct traits** from a pool of 16 at generation. They are hidden
and revealed by cumulative tenure:

```
revealAt = [180, 600, 1500] s of cumulative tenure
           × 0.55 with project `pact_attunement` (C-tier)
```

16 choose 3 = **560 trait combinations** per partner, and traits can be bad, so a fresh pact is a
genuine unknown and the first three minutes of any pact are a **probe**. This is why the tenure
penalty (§3.3) matters: entering at 1 channel is cheap to discover with and expensive to scale up
from; entering at 3 is the opposite bet.

| trait | effect | reads as |
|---|---|---|
| `PATIENT` | baseline forgiveness `−0.16 → −0.30` | survives droughts |
| `FICKLE` | every slow tick, `strain += 0.12·(rand()−0.45)` | jittery, unpredictable |
| `DEEP` | `TAU_BOND ×0.62` | bonds fast |
| `SHALLOW` | `BOND_K ×0.55` (caps at 1.88×) | never becomes an anchor |
| `GENEROUS` | `BASE ×1.35` | just pays more |
| `THIN` | `BASE ×0.72` | just pays less |
| `PROLIFIC` | `α += 0.15` | rewards concentration |
| `SATED` | `α −= 0.20` | rewards spreading |
| `HYGROPHILE` | `β1 ×1.90` | doubles down on moisture |
| `XEROPHILE` | `β1 := −|β1| × 1.30` | **inverts moisture exposure — a natural hedge** |
| `JEALOUS` | `tolerance −1` for its guild | will not share |
| `GREGARIOUS` | `tolerance +2` for its guild | will |
| `VENGEFUL` | breach penalties ×2.0 | do not fail this one |
| `OLD` | starts with `tenure = 600 s` | a gift |
| `WATCHFUL` | reveals β of all other pacts **in the same guild** | information |
| `KEYSTONE` | while `strain < 0.30`, **every other pact's yield ×1.08** | the synergy seed |

`KEYSTONE` is how P4 begins. A keystone partner turns the book from a list into a graph: it is worth
protecting *because of what else you own*, and its NOTICE demands are suddenly worth paying at almost
any price. There is exactly one keystone in the P2 pool, two in P3, and it appears at a 22% rate in
P4+.

Trait display: three small `◈` glyphs on the card, filled and labelled when known, hollow when not.
Tapping a known trait shows its one-line effect in a 2-second inline tooltip. No codex, no menu.

---

## 9. ESCALATION — six phases, six new kinds of decision

The layer must not become "the same decision with bigger numbers" (teardown §8.7, the Act II
plateau). Each phase adds a **new class of decision** and the previous ones remain live.

Phases gate on `forestConsumed` (Act II's master progress variable), never on time.

### P1 — THE FIRST PACT · `fc 0 → 0.06` · ~12 min
2 slots, 3 channels. ROOT and NODULE only. No trait reveals (tenure hasn't reached 180 s), no
exposure view.
**New decision:** *how many channels, and for how long.*
**What it teaches:** channels are scarce, bond compounds, term is a bet on your own patience.
The first pact is offered, not shopped for — a ghost card appears in an empty book, greyed, with a
single line of terms. (Trigger/cost split, teardown principle 3.)

### P2 — THE BOOK · `fc 0.06 → 0.18` · ~22 min
4 slots, 5–6 channels. BROOD and GHOST arrive. First trait reveals land. First scripted shock (§11.4).
**New decision:** *which payoff shape do I want.* BROOD's lumps vs ROOT's trickle vs GHOST's Ψ.
**What it teaches:** the α column. A player who spreads BROOD across two pacts and concentrates GHOST
into one has it exactly backwards, and the numbers on the cards say so within 90 seconds.

### P3 — EXPOSURE · `fc 0.18 → 0.38` · ~34 min
5 slots, 7–9 channels. CROWN arrives. `pact_chemotaxis` reveals β. The stress-test rows appear.
**New decision:** *what am I exposed to, and do I want to be.*
**What it teaches:** hedging. The first time `── if it dries out ×0.68` appears on screen is the
moment the layer stops being a shop and becomes a portfolio. This is the phase the whole system
exists to reach and it should land around minute 55 of Act II.

### P4 — THE WEB · `fc 0.38 → 0.62` · ~38 min
7 slots, 11–13 channels. RIVAL arrives. `KEYSTONE` becomes common. **Cross-pacts** unlock:

```
A CROSS-PACT is a pact whose yield depends on another pact's health.
Offered as a normal pact with one extra line in its terms:
     "bound to: the alder nodules"
     yield ×= ( 0.55 + 0.85 · (1 − strain_of_bound_pact) )
     if the bound pact breaches, this pact's strain jumps +0.40
```
Roughly 30% of P4+ offers are cross-pacts, and they always offer a `BASE ×1.30` premium for the
coupling.
**New decision:** *topology.* The book stops being a vector and becomes a directed graph.
**What it teaches:** correlated failure is not the same as correlated exposure. You can be perfectly
hedged against moisture and still lose four pacts because one keystone breached.

### P5 — THE COMPACT · `fc 0.62 → 0.85` · ~40 min
8 slots, 14–17 channels. Two new mechanics:

**Inter-partner demands.** Once per ~8 minutes, a partner with `bond ≥ 0.7` issues a demand *about
another pact*: `the leafcutters will not share a book with the beetles. one of us.` 180 s to comply
(sever the named pact) or the demanding partner takes `strain += 0.35`. These are generated from
`tolerance` conflicts and from a per-partner `dislikes[]` list rolled at generation.

**Brokering.** Spend ⟡ to change the graph:

```
RECONCILE two partners:   cost 260 · (1 + strain_a + strain_b) ⟡
                          → their mutual dislike is cleared permanently; tolerance conflicts
                            between them are ignored

TRIANGLE  three pacts p→q→r→p:
                          cost 420 · (3 + Σ strain_i) / (1 + mean bond) ⟡
                          → each member: shockMult ×1.18, strain recovery an extra −0.06/tick
                          → IF ANY MEMBER BREACHES: all three breach penalties are DOUBLED
                            and the triangle is destroyed
```

A triangle of three healthy mature pacts costs roughly **730 ⟡** and returns +18% on typically 60%
of the book — about +11% book-wide, permanently, against a doubled tail risk on three positions.
**New decision:** *do I want a stronger, more fragile machine.*
**What it teaches:** leverage. Not the word, the thing.

### P6 — THE LETTING GO · `fc 0.85 → 1.00` · ~28 min
9 slots. **No new channels.** The forest is dying: `F2 CANOPY` is at −0.6 and falling, `F4 DECAY` is
collapsing as extraction outpaces humus, and ROOT/CROWN pacts begin issuing NOTICEs you cannot
satisfy because `T_i ≥ 0.35·T0_i` is failing everywhere.

**The decision is the order in which you release them.** Three routes per pact:

| route | ⟡ | LEGACY | requires |
|---|---|---|---|
| **honour to term** | `honourAccord` ×**2.5** (the P6 multiplier) | +0.010 each | surviving until `endsAt` |
| **sever** | `−severCost` | +0.002 each | ⟡ on hand |
| **let it breach** | 0 | **−0.006 each** | nothing |

Nine pacts, each with a different `endsAt`, a different `severCost`, and a different rate of decay,
and a ⟡ balance that cannot cover all of them. This is a **liquidation puzzle** and it is the last
15 minutes of the Pact Book. The console gets one line per release, and they are the quietest lines
in the act:

```
> the lungwort finishes its term. it does not renew. it does not need to.
> the beetles are gone. they left before you did.
> you sever the alder. the nodules are still full of nitrogen you will never use.
```

**New decision:** *what do you carry out.*
**What it teaches:** nothing. It is the ending.

### 9.1 Phase summary — why hours, not minutes

| phase | new decision class | previous ones still live? |
|---|---|---|
| P1 | sizing | — |
| P2 | payoff shape | yes |
| P3 | exposure | yes |
| P4 | topology | yes |
| P5 | leverage | yes |
| P6 | liquidation | yes |

Six *kinds* of thought, cumulative, none retired. No phase is "the same but bigger." Compare UP's
tournament, which has exactly one decision class and dies at 40 minutes (teardown §6 endnote).

---

## 10. ACCORD ⟡ — the currency earned by enduring

### 10.1 The rule

```
each slow tick, per active pact:
    accord += ACC_K · ch_p^0.50 · bond_p · adverse_p · dt_slow
ACC_K = 0.85                                                               [K]
```

`adverse_p = max(0, −Σ β·F)` — how badly the world is currently treating this specific partner.

> **ACCORD accrues only while you are being hurt, in proportion to how much you have committed and
> how long you have been there.**

A player who holds only easy pacts in good weather earns almost none. A player who holds a
3-channel, hour-old pact through a 4-minute drought at `adverse = 0.89` earns
`0.85 × 1.732 × 0.958 × 0.89 × 240 = 301 ⟡` from that one storm.

This is the direct structural descendant of UP's best rule — Creativity accrues only when Operations
are *full*, i.e. a failure state becomes a faucet (teardown principle 4). Here the failure state is
adversity, and the faucet is the currency that buys your capacity to take on more.

### 10.2 Discrete grants

| event | ⟡ |
|---|---|
| a pact first reaches `bond ≥ 0.632` (tenure 900 s) | `+25`, once per pact |
| a NOTICE resolved without breaching | `+40 · (1 + bond)` |
| a pact honoured to full term | `honourAccord = 60 · ch^0.5 · termSeasons^0.7` |
| a pact honoured to full term during P6 | `× 2.5` |
| first exact-β reveal on a partner (tenure 600 s) | `+15` |

### 10.3 Sinks

| sink | cost |
|---|---|
| channel capacity (§2.3) | `ceil(40 · n^1.85)`, 8 max, 6,324 ⟡ total |
| severance (§7.3) | `18 · ch · (1+bond) · sqrt(rem/60)` |
| RECONCILE (§P5) | `260 · (1 + strain_a + strain_b)` |
| TRIANGLE (§P5) | `420 · (3 + Σstrain) / (1 + mean bond)` |
| 6 pact-tree projects (§12) | 180 – 1,600 ⟡ |

### 10.4 Carry-out to Act III — the `LEGACY` extension

This **extends** Act II §0.2:

```
LEGACY += 0.25 · clamp( accordLifetime / 9000 , 0, 1 )
LEGACY += 0.010 · pactsHonouredInP6
LEGACY -= 0.006 · pactsBreachedInP6
(then LEGACY is clamped to [0,1] as before, and Act III reads
 fidelityBase = 0.72 + 0.28·LEGACY)
```

An expert book (7,600 ⟡ lifetime, 7 honoured in P6) contributes `0.211 + 0.070 = 0.281`, capped by
the 0.25 term to **+0.32**. A player who ignores the layer contributes 0. That is a ~9% swing in Act
III's genetic fidelity base, which is meaningful and not decisive — correct for an optional layer.

---

## 11. THE OFFER SYSTEM — you do not shop

### 11.1 Principle

There is no partner catalogue, no browse screen, no "available partners" list. **Offers arrive.**
This is the trigger/cost split (teardown principle 3) applied to counterparties: the thing you want
appears as a greyed ghost card in your own book, with terms, and either you can afford the stake or
you cannot.

### 11.2 Generation

```
each slow tick:
  if (offers.length < 2 && t > lastOfferAt + OFFER_GAP && pacts.length < pactSlots):
      pool   = partnersEligibleFor(currentPhase, guildRep, bookRep, worldState)
      weight = w(partner) = qualityMult(partner) · guildDemandBias · rarityWeight
      offer  = generateOffer( weightedPick(pool) )
      lastOfferAt = t

OFFER_GAP = 210 s  ×  (1 + 0.25·offersDeclinedRecently)                    [K: 210]
```

An offer is a fully-specified pact with terms the player may adjust before signing:

```
adjustable at signing:  ch (1..min(cap-used, 5)),  termSeasons (1..maxTerm)
fixed at signing:       partner, guild, region, BASE, β, traits (hidden), costMod
maxTerm = clamp( floor(1 + guildRep/16 + bookRep/24), 1, 6 )
```

`qualityMult` scales `BASE` by reputation:
```
qualityMult = 0.72 + 0.0028 · guildRep + 0.0018 · bookRep      // 0.72 … 1.18
```

Offers expire after **600 s**, drawn as a thin depleting line across the ghost card's top edge. An
expired offer returns to the pool with `refuseUntil = t + 420 s`. Declining explicitly is free and
sets `refuseUntil = t + 240 s`. **Declining is a skill and it is free to acquire** — the same rule as
Act I's solicitations (Act I §6.6).

### 11.3 Offer quality is a signal, not noise

The generator biases toward what you *lack*, so the pool feels responsive:
```
guildDemandBias = 1.0
                  × (guildCount(g) == 0 ? 1.45 : 1.0)        // you have none of these
                  × (guildCount(g) >= tolerance(g) ? 0.35 : 1.0)   // you have too many
                  × (phaseUnlocked(g) ? 1.0 : 0.0)
```
Combined with UP's behavioural-trigger idea (teardown §4, trigger type 3), three offers are
generated by **what you have been doing** rather than by the pool:

| behavioural trigger | offer generated |
|---|---|
| 3 pacts breached in one guild | a `PATIENT`+`GENEROUS` partner in that guild, `BASE ×1.25`. A hand extended. |
| book β1 magnitude > 1.0 for 400 continuous seconds | a Bryoria (β1 ≤ −0.75). *Here is your hedge.* |
| ≥ 5 channels held for 900 s with zero reallocation | a cross-pact offering `BASE ×1.45` bound to your largest pact. *You like commitment. Here is more.* |

These are the offers players remember, and they cost about twenty lines of code.

### 11.4 Scripted shocks

Three shocks are scripted rather than emergent, one per act-third, because a designed first
experience of each failure mode is worth more than a random one:

| shock | fires at | what happens |
|---|---|---|
| **THE DRY WEEK** | first time `fc ≥ 0.10` and a pact has `bond ≥ 0.5` | `W` is forced along a 300-second path to 0.24. Every β1-positive pact strains. The player's first NOTICE. |
| **THE TURN** | first time `fc ≥ 0.34` | `F2` drops 0.18 in one minute (a mass mortality event elsewhere on the map). ROOT and CROWN visibly rot. The player's first experience of the long thesis. |
| **THE QUIET** | first time `fc ≥ 0.66` | 400 seconds during which **no offers are generated at all** and every partner's `adverse` floors at 0.15. Nothing bad happens. It is just very still, and the ⟡ keeps ticking. |

All three respect `prefers-reduced-motion` (no flashing; the card borders ramp opacity over 400 ms
instead of blinking).

---

## 12. PROJECTS — 14 new Act II entries

To be merged into `04-projects-catalog.md`. Format matches that document. Costs in Ψ (Insight),
⟡ (Accord), Σ (Signal). Descriptions ≤ 12 words with the mechanical delta in parentheses at the end
(teardown principle 8).

| id | title | priceTag | trigger | effect |
|---|---|---|---|---|
| `pact_first` | **Exudate Channels** | `(90 Ψ)` | `fc ≥ 0.004` | Opens the Pact Book. `pactSlots = 2`. |
| `pact_slot_b` | **Second Conversation** | `(240 Ψ)` | `pacts ≥ 1 && bond_max ≥ 0.4` | `pactSlots 2→3`. "You can hold two thoughts about two things." |
| `pact_bandwidth_1` | **Rhizomorph Cores** | `(420 Ψ)` | `totalChannels == channelCap` | `projectChannels +1` |
| `pact_slot_c` | **The Book** | `(150 ⟡)` | `pactSlots == 3` | `pactSlots 3→4`. |
| `pact_chemotaxis` | **Chemotaxis** | `(340 Ψ, 60 ⟡)` | `pacts ≥ 3 && tenure_max ≥ 600` | Reveals exposure vectors and the stress tests. **(the EXPOSURE view)** |
| `pact_slot_d` | **Standing Terms** | `(700 Ψ)` | `fc ≥ 0.20` | `pactSlots 4→5`. |
| `pact_attunement` | **Attunement** | `(180 ⟡)` | `traitsRevealed ≥ 4` | Trait reveal thresholds ×0.55. |
| `pact_perennial` | **Perennial Terms** | `(1,100 Ψ)` | `pactsHonoured ≥ 3` | Auto-renew at 2 seasons. **(−54% honour accord — see §3.4)** |
| `pact_bandwidth_2` | **Deep Translocation** | `(1,800 Ψ, 220 ⟡)` | `fc ≥ 0.34` | `projectChannels +1` |
| `pact_slot_e` | **The Web** | `(420 ⟡)` | `fc ≥ 0.38` | `pactSlots 5→7`. Unlocks RIVAL and cross-pacts. |
| `pact_plasticity` | **Plasticity** | `(2,600 Ψ, 380 ⟡)` | `reallocations ≥ 20` | `PLASTICITY 0.55 → 0.22`. Behavioural trigger. |
| `pact_slot_f` | **The Compact** | `(900 ⟡)` | `fc ≥ 0.62` | `pactSlots 7→8`. Unlocks brokering. |
| `pact_bandwidth_3` | **Aggregate Vessels** | `(9,000 Ψ)` | `fc ≥ 0.70` | `projectChannels +2` |
| `pact_slot_g` | **Nine Voices** | `(1,600 ⟡)` | `fc ≥ 0.82` | `pactSlots 8→9`. |

Plus one re-armable repair, per UP's *Beg For More Wire* / *Token of Goodwill* pattern:

| `pact_refixation` | **Refixation** | `(340 · 2^k Ψ)` | a NODULE breach scar exists | Removes one `E ×0.92` scar. Re-arms. |

Budget check: Ψ cost total ≈ **19,100 Ψ** across the act (Act II's Insight budget is 8,000–15,000 for
the main tree, so the Pact Book roughly doubles Insight demand — intentional, and the GHOST guild is
the reason it is affordable). ⟡ cost total ≈ **3,180 ⟡** on projects, plus 6,324 on channels =
9,504 ⟡ to buy everything, against an expert income of ~7,600. **You cannot buy everything, ever.**

---

## 13. THE PHONE UI

### 13.1 Frame

Portrait, 360 × 640 CSS px reference. The Pact Book is a tab in Act II's bottom nav (verify the tab
count against Act II §15.1 before implementing). Every interactive element sits in the bottom 62% of
the viewport — thumb-reachable one-handed on a 6.1" device held low.

```
 0px ┌───────────────────────────────────┐
     │  PACT BOOK                ⟡ 1,284 │  44px  header, sticky
     │  ●●●●●●●○○  7/9    ×1.08   21%    │  30px  channels · congestion · cost
 74  ├───────────────────────────────────┤
     │ ┌───────────────────────────────┐ │
     │ │⊥ the pines at Dovestone       │ │
     │ │  ●●●○○      ⛬ 80.1/s    ▁▂▃▃▄ │ │ 132px  CARD
     │ │  bond   ████████░░     1.85×  │ │
     │ │  strain ██░░░░░░░░ 0.19 ▼     │ │
     │ │  ◈patient ◈?  ◈?      3s left │ │
     │ └───────────────────────────────┘ │
     │ ┌───────────────────────────────┐ │
     │ │⬡ the beetle brood             │ │ 132px  CARD
     │ │  ●●●●○      +0.37× ▁ ▁▃▁ ▁▁▅  │ │
     │ │  bond   ██████░░░░     1.61×  │ │
     │ │  strain █████▌░░░░ 0.55 ▲▲    │ │  ← WARNING: 3px left border
     │ │  ◈prolific ◈hygro ◈?  2s left │ │
     │ └───────────────────────────────┘ │
     │ ┌───────────────────────────────┐ │
     │ │◌ the ghost pipe          ...  │ │
     ...  (scrolls)
 596 ├───────────────────────────────────┤
     │  [ ▤ EXPOSURE ]      [ + 1 offer ]│  44px  sticky footer
 640 └───────────────────────────────────┘
```

Three cards above the fold. Nine cards = 1,188 px of scroll, which is two and a half flicks. Past 12
rows, virtualise (Act II §2 render discipline).

### 13.2 The card, in detail

132 px tall, full-width minus 12 px gutters. Five rows:

1. **Identity** (20 px) — guild glyph (procedurally drawn, §13.6), partner name, and — right-aligned
   — a cross-pact binding indicator if present.
2. **The pip strip + rate + sparkline** (36 px) — *this is the only touch target on the card.*
3. **Bond bar** (18 px) — filled bar plus the multiplier as a numeral.
4. **Strain bar** (18 px) — filled bar, three tick marks at 0.55/0.80/1.00, derivative caret.
5. **Traits + term remaining** (18 px).

Plus 22 px of padding. Left border: 1 px normally, **3 px at WARNING**, 3 px + a depleting 90 s
timer bar across the whole card at NOTICE.

### 13.3 What the thumb does

**The pip strip is the hero interaction and it is a slider disguised as pips.**

```
The pip row is a full-width, 44 px-tall touch strip (visually 12 px of pips, 44 px of hit area).
  tap at x        →  ch := clamp( round( x / stripWidth · chMaxForPact ), 0, cap remaining )
  press and drag  →  scrub live; pips fill/empty under the thumb; the rate readout updates at 30 Hz
  release         →  commit, apply the §3.3 tenure penalty, show a 4 s UNDO toast
```

Why a scrub and not +/− buttons: on a phone, two 24 px buttons are a worse target than one 44 px
strip, and dragging lets the player *feel* the yield curve — the readout climbing sublinearly under
their thumb for a ROOT pact and superlinearly for a BROOD pact **is how the α table gets taught**,
without a single word.

The UNDO toast is essential because the action costs tenure. It restores the exact prior `tenure`
value, not a recomputed one.

Other gestures:

| gesture | result |
|---|---|
| **tap card body** (not the strip) | expand to the detail sheet (§13.4) |
| **swipe card left** | quick actions rail: `RENEW` · `SEVER` · `PIN` |
| **swipe card right** | dismiss a NOTICE badge / acknowledge a WARNING (visual only) |
| **long-press card** | drag to reorder. Order is the player's own priority list and is saved. |
| **tap a known trait glyph** | 2 s inline tooltip, one line |
| **tap the channel pips in the header** | jump to the channel purchase sheet |
| **tap `▤ EXPOSURE`** | the exposure sheet (§13.5) |
| **tap `+ N offer`** | the offer sheet — the ghost card with adjustable ch/term and a SIGN button |

No modals except the offer sheet and the confirm on SEVER. No nested navigation deeper than two.

### 13.4 The detail sheet

Full-screen, one back chevron, scrolls. Sections in this order (the order is the priority order):

```
┌───────────────────────────────────┐
│ ←  THE BEETLE BROOD          ⬡    │
│    Dendroctonus · Cold Shoulder   │
├───────────────────────────────────┤
│ ●●●●○                    4 / 5    │   the strip again, larger
│ +0.845× gross                     │
│ last 5:  71s  118s  46s  92s  61s │   ← BROOD only: the lived experience
│ ▁▁▃▁▁▁▅▁▁▂▁▁▁▇▁▁▁▂▁▁ (120 s)      │
├───────────────────────────────────┤
│ STRAIN  0.61  ▲▲                  │
│   unpaid          0.00            │
│   exposure       +0.83            │
│   crowding        0.00            │
│   bond relief    −0.21            │
│   baseline       −0.16            │
│   net            +0.46 / 100 s    │
├───────────────────────────────────┤
│ EXPOSURE                          │
│  MOISTURE   ──────██████  +0.81   │
│  CANOPY     ███◄──────    −0.44   │
│  SEASON     ─────███      +0.35   │
│  DECAY      ──█           +0.10   │
│  PRESSURE   ────██        +0.22   │
├───────────────────────────────────┤
│ ◈ prolific   α +0.15              │
│ ◈ hygrophile β MOISTURE ×1.9      │
│ ◈ ?          1,500 s tenure       │
├───────────────────────────────────┤
│ TERM  3 seasons · 41m left        │
│ STAKE 1.2e8 g escrowed            │
│ COST  4.4e7 g/s  (18% of book)    │
│ PAID  ⟡ 318 lifetime              │
├───────────────────────────────────┤
│   [ RENEW ]   [ SEVER  ⟡ 649 ]    │
└───────────────────────────────────┘
```

### 13.5 The exposure sheet — the expert's screen

```
┌───────────────────────────────────┐
│ ←  EXPOSURE                       │
│                                   │
│  MOISTURE   ──────█████▌  +0.70   │   book β, channel-weighted
│  CANOPY     ──█▌          +0.12   │
│  SEASON     ────██▌       +0.21   │
│  DECAY      ────██▌       +0.22   │
│  PRESSURE   ──▌           +0.08   │
│                                   │
│  now   M +0.36  C +0.64  S +0.56  │   current factor values
│        D +0.16  P −0.15           │
│                                   │
│  book multiplier          ×1.20   │
│  ── if it dries out       ×0.68   │   ← the three stress tests
│  ── if the canopy goes    ×1.04   │
│  ── at the trough         ×0.91   │
├───────────────────────────────────┤
│  PER PACT        M  C  S  D  P    │
│  ⊥ pines         ▌  █  ◄  ▌  ·    │
│  ⬡ beetles       █  ◄  ▌  ·  ▌    │
│  ◍ frankia       ▌  ▌  █  █  ·    │
│  ◌ ghost pipe    ·  ·  ·  ·  ·    │   ← visibly neutral
├───────────────────────────────────┤
│  MOISTURE  next 300 s             │
│  0.7 ┤▁▁▂▃▃▂▁                     │   forecast strip, reads the
│  0.5 ┤      ▔▔▓▓▓▒▒░░             │   Flush's OU band (Act II §7.3)
│  0.3 ┤          ░░░░░░            │
│      └──────────────────────      │
└───────────────────────────────────┘
```

Everything an expert needs, on one scroll, with the forecast at the bottom so the eye lands on
*exposure → stress → forecast* in that order. That is the reading order of the decision.

The per-pact matrix uses five characters per row (`·` `▌` `█` and `◄` for negative), which is
legible at 12 px and needs no colour — critical for colour-blind players and for the fact that we
have no colour budget on a two-tone palette.

### 13.6 Glyphs, procedurally

We have no font files and no images. The six guild glyphs must not rely on Unicode coverage. Each is
a 16×16 canvas path drawn once into an offscreen bitmap at DPR and blitted:

```js
const GUILD_GLYPH = {
  ROOT:   c => { c.moveTo(8,2);  c.lineTo(8,14); c.moveTo(3,14); c.lineTo(13,14); },      // ⊥
  NODULE: c => { c.arc(8,8,5,0,TAU); c.moveTo(11,8); c.arc(8,8,3,0,TAU); },               // ◍
  BROOD:  c => { hexPath(c,8,8,6); },                                                     // ⬡
  GHOST:  c => { c.arc(8,8,5.5,0,TAU); },                              // ◌  (stroke only, 1px)
  CROWN:  c => { c.moveTo(8,2); c.lineTo(14,13); c.lineTo(2,13); c.closePath(); },         // △
  RIVAL:  c => { c.moveTo(3,3); c.lineTo(13,13); c.moveTo(13,3); c.lineTo(3,13); },        // ✕
};
// ACCORD ⟡ : a 4-point star — moveTo(8,1) lineTo(10,8) lineTo(8,15) lineTo(6,8) close
```

Same for ⟡ (Accord) and Act III's CANON mark. **No Unicode glyph outside ASCII is load-bearing
anywhere in either system.** Text labels are always available as a fallback and are what a screen
reader announces.

### 13.7 Accessibility

- Every card is a `<button>` with `aria-label` reading:
  `"the pines at Dovestone, root guild, 3 of 5 channels, 80 minerals per second, bond 1.85 times, strain 0.19 falling, 3 seasons remaining"`.
- The pip strip is `role="slider"` with `aria-valuenow/min/max` and full keyboard support
  (arrows adjust, Enter commits, Escape reverts). Keyboard support costs nothing and UP had none
  (teardown §8.14).
- No information is conveyed by colour alone. Strain uses fill + tick marks + a caret; exposure uses
  `◄` for sign.
- `prefers-reduced-motion`: no blinking anywhere. Card arrival is a 400 ms opacity ramp; the NOTICE
  timer is a static bar that steps once per second instead of animating.
- Text scales with the root font size; cards grow to 156 px at 120% and the fold shows two.

### 13.8 Number formatting

Suffix notation throughout (`4.4e7 g` → `44.0 M g`; `⛬ 80.1/s`; `⟡ 1,284`). Multipliers always to
two decimals with an explicit `×`. Fractions of gross always as a signed percentage. **No long-scale
English number words anywhere** (teardown §8.11).

---

## 14. TUNING KNOBS

| symbol | value | governs | raise it to… |
|---|---|---|---|
| `TAU_BOND` | 900 s | how fast loyalty compounds | make switching cheaper |
| `BOND_K` | 1.60 | how much loyalty is worth | make switching more painful |
| `PLASTICITY` | 0.55 | reallocation cost | punish fiddling |
| `CH_COST_FRAC` | 0.019 | book cost | shrink optimal book size |
| congestion coeff | 0.012 | convexity of book cost | shrink it further, faster |
| `SHOCK_GAIN` | 0.42 | how violent the factor model is | make hedging matter more |
| `STRAIN_RATE` | 0.0020/s | betrayal tempo | shorten the response window |
| strain `envStress` coeff | 1.15 | how much weather threatens | " |
| strain bond relief | 0.22 | loyalty as insurance | make old pacts safer |
| `ACC_K` | 0.85 | ⟡ income | change the whole progression rate of the layer |
| `OFFER_GAP` | 210 s | offer tempo | slow the shop |
| `BASE_*` (6) | see §4 | per-guild yield | rebalance guilds |
| `ALPHA` (6) | see §4.0 | **book shape** | the highest-leverage table in the doc |
| `tolerance` (6) | see §4.0 | crowding | change how wide books can be |

### 14.1 Balance targets a QA pass must hit

1. First pact signed by **Act II minute 7**, first NOTICE by **minute 32**, first ⟡ purchase by
   **minute 48**, exposure view by **minute 58**.
2. A competent book contributes **28–36% of total Act II biomass** and **55–70% of total minerals**.
3. Median number of breaches per competent playthrough: **1.5**. Zero breaches must be achievable
   and must feel like an achievement. Six or more must be survivable.
4. `bookMult` must spend **≥ 12% of the act below 0.85** and **≥ 12% above 1.25** — i.e. the factor
   model must actually be felt in both directions.
5. Peak channels held: **17–19**. If players routinely run below 14, `CH_COST_FRAC` is too high.
6. Median time between player interactions with the Pact Book, mid-act: **4–7 minutes.** Below 3, it
   is a chore; above 10, it is wallpaper.
7. **Offline safety:** a 10-hour absence must never produce a breach (§14.2).

### 14.2 Offline behaviour — walking away is safe

Non-negotiable (teardown §8.2, §8.6). Under the Act II §14 offline reconciliation path:

```
offline:
  yields accrue at the standard offline efficiency schedule (Act II §14.1)
  BROOD deliveries are applied as EXPECTED VALUE (S/I × elapsed), never as sampled lumps
  bond/tenure accrue at FULL rate                      ← being away builds loyalty
  strain accrues at ×0.35 and is HARD-CAPPED at 0.95   ← a breach can never occur offline
  a NOTICE issued offline is QUEUED; its 90 s compliance window starts when you return
  terms expire offline; expiry is treated as RENEWED if `pact_perennial` is owned,
      otherwise as LAPSED with the standard tenure ×0.35 — and the return screen names each one
  offers do not generate offline; the pool is refreshed on return
  ACCORD accrues offline at ×0.60 (adversity you did not personally witness pays less)
```

The return screen gets a Pact Book block:

```
  WHILE YOU WERE AWAY   4h 12m
  the alder deepened.                    bond 1.62× → 2.31×
  the beetles strained through a dry
    spell and held.                      ⟡ +884
  the lungwort's term ended. it waited.  ⟡ +214   [ RENEW ]
  the black crust is at 0.94 and asking
    for a longer term.                   [ 90s ]  ← the queued NOTICE starts now
```

Four lines of prose and two buttons. **Nothing was lost, one thing needs a decision, and the
decision waited for you.** That is the promise, and it is the single largest thing this game has
over Universal Paperclips.

---

## 15. WORKED EXAMPLE — five turns, real numbers

All times are elapsed within Act II. `G` = gross biomass rate. Mineral price `P` is read from Act II
§10.4's series. `fc` = `forestConsumed`.

### TURN 1 — t = 6:20 · fc 0.018 · the first pact

**State.** `G = 4.0e3 g/s` (Act I handoff `decompRate0`). `claimed = 2` ⇒ `channelCap = 2 + floor(1.45·ln 3) = 2 + 1 = 3`. `pactSlots = 2`. `⟡ 0`.

**Offer.** ⊥ **the pines at Dovestone** — Beech Hollow region, `T = T0 = 9.66e10 g`, `κ = 0.977`,
Loam (`mineralMod 1.00`). MINERAL type. Traits hidden. β hidden.

**Decision.** ch = 1, 2, or 3? Sizing is the only decision that exists at P1.

```
scale  = κ · (T/1e11)^0.42 · mineralMod = 0.977 × (0.966)^0.42 × 1.00 = 0.977 × 0.9856 = 0.963
ch=1:  26 × 1^0.80  × 1.00 × 0.963 = 25.0 ⛬/s      cost = 0.019 × 4000 × 1 × 1.012 =  77 g/s
ch=2:  26 × 1.7411  × 1.00 × 0.963 = 43.6 ⛬/s      cost = 0.019 × 4000 × 2 × 1.024 = 156 g/s
ch=3:  26 × 2.4082  × 1.00 × 0.963 = 60.3 ⛬/s      cost = 0.019 × 4000 × 3 × 1.036 = 236 g/s
```

The naive read is "3, obviously — it's only 6% of income." The correct read is that **BROOD arrives
at P2 with α = 1.35 and a 3-channel entry**, and going 3 → 2 later will cost 30% of the pines'
tenure. The player does not know this yet. Both plays are defensible and the game does not hint.

**Play:** ch = 2, term 3 seasons, stake `0.9 × 4000 × 60 × 2 × (1 + 1.05) = 8.86e5 g`.

```
> the pines at Dovestone open their root tips. ⛬ 43.6/s
```

### TURN 2 — t = 19:40 · fc 0.071 · the α lesson

**State.** `G = 1.9e4 g/s`. `claimed = 5` ⇒ territory term 2; `pact_bandwidth_1` bought ⇒
`channelCap = 5`. `pactSlots = 3`. `P = 95 g/⛬`.
Pines: tenure 800 s ⇒ `bond = 1 − e^(−0.889) = 0.589` ⇒ `bondMult = 1 + 1.60 × 0.589^1.2 = 1.848`.
Pines now yield `26 × 1.7411 × 1.848 × 0.963 = 80.5 ⛬/s`.

**Offer.** ⬡ **the beetle brood** (*Dendroctonus*), Cold Shoulder. 3 channels free.

**Decision.** Three channels are free. Do you also grow the pines?

```
OPTION A — pines 2, beetles 3
  beetles S = 9.5 × 1.9e4 × 3^1.35 × 1.00 = 9.5 × 1.9e4 × 4.407 = 7.955e5 g per delivery
          I = 240 / (3^0.35 × 1.00) = 240 / 1.4696 = 163.3 s
     rate   = 7.955e5 / 163.3 = 4,871 g/s  = 25.6% of G
  pines      = 80.5 ⛬/s

OPTION B — pines 3, beetles 2
  moving pines 2→3 costs tenure ×exp(−0.55 × 1/2) = ×0.7596 : 800 s → 608 s
     new bond = 1 − e^(−0.6756) = 0.4912 ⇒ bondMult = 1.682
  pines      = 26 × 2.4082 × 1.682 × 0.963 = 101.4 ⛬/s        (+20.9 ⛬/s)
  beetles S = 9.5 × 1.9e4 × 2.549 = 4.601e5 ;  I = 240/1.2746 = 188.3 s
     rate   = 2,443 g/s                                        (−2,428 g/s)
```

**The comparison, in one currency.** `20.9 ⛬/s × 95 g/⛬ = 1,986 g/s` versus `2,428 g/s`.
**Option A wins by 442 g/s** — a 22% margin, narrow enough to be a real decision.

And the honest note the game never prints: **the answer flips when `P` crosses 114 g/⛬**, which the
mineral market does about twenty minutes later. The right answer at 19:40 is the wrong answer at
40:00, and the pines will by then have another 1,200 seconds of tenure making the switch even more
expensive. *This is what "a decision that recurs and is always slightly wrong" means.*

**Play:** Option A. Total channels 5, `congestion = 1.06`.
```
cost = 0.019 × 1.9e4 × (2×1.00 + 3×1.45) × 1.06 = 361 × 6.35 × 1.06 = 2,430 g/s = 12.8% of G
```
Book returns 25.6% of G in biomass plus 80.5 ⛬/s. Comfortably positive.

### TURN 3 — t = 42:10 · fc 0.19 · the hedge

**State.** `G = 1.1e5 g/s`. `claimed = 11` ⇒ territory 3; `+1` project, `+1` ACCORD channel already
bought (40 ⟡) ⇒ `channelCap = 7`, all 6 used. `pactSlots = 5`.
⟡: lifetime earned 331, spent 130 ⇒ **balance 201 ⟡**.

Book: ⊥ pines ch 2 (tenure 2,190 s, bond 0.912, mult **2.433**) · ⬡ beetles ch 3 (tenure 1,350 s,
bond 0.777, mult **2.182**) · ◍ Frankia ch 1 (signed 28:00, tenure 850 s, bond 0.612, mult **1.887**).

**`pact_chemotaxis` bought (340 Ψ, 60 ⟡).** The exposure view opens. Revealed β:

| | M | C | S | D | P |
|---|---|---|---|---|---|
| ⊥ pines | +0.62 | **+0.88** | −0.20 | +0.15 | −0.05 |
| ⬡ beetles | **+0.81** | −0.44 | +0.35 | +0.10 | +0.22 |
| ◍ frankia | +0.55 | +0.30 | +0.60 | **+0.70** | −0.10 |

Current factors: `W = 0.61` ⇒ **M +0.36**; `ΣT/ΣT0 = 0.82` ⇒ **C +0.64**;
`t = 2,530 s` ⇒ `sin(2π·2530/1800) = sin(2.548 rad)` ⇒ **S +0.557**; humus 0.58 ⇒ **D +0.16**;
rival 0.14 ⇒ **P −0.15**.

```
Σβ·F   pines   = 0.223 + 0.563 − 0.111 + 0.024 + 0.008 = +0.707  ⇒ ×0.42 ⇒ shockMult 1.297
Σβ·F   beetles = 0.292 − 0.282 + 0.195 + 0.016 − 0.033 = +0.188  ⇒            shockMult 1.079
Σβ·F   frankia = 0.198 + 0.192 + 0.334 + 0.112 + 0.015 = +0.851  ⇒            shockMult 1.357

shares (ch 2,3,1 of 6) = 0.333, 0.500, 0.167
bookβ_M = 0.333(0.62) + 0.500(0.81) + 0.167(0.55) = +0.703    ← the problem
bookMult = 0.333(1.297) + 0.500(1.079) + 0.167(1.357) = 1.198
```

**The forecast** (Act II §7.3, horizon 300 s with `mast_synchrony`):
```
μ(t)      = 0.52 + 0.16·sin(2π·2530/1800) = 0.52 + 0.089 = 0.609
μ(t+300)  = 0.52 + 0.16·sin(3.596 rad)    = 0.52 − 0.070 = 0.450
E[W+300]  = 0.450 + (0.610 − 0.609)·e^(−3) = 0.450
SD(300)   = 0.028 · sqrt((1 − e^(−6))/0.02) = 0.028 × 7.062 = 0.198
15th pct  = 0.450 − 1.04(0.198) = 0.244  ⇒  F1 := (0.244 − 0.52)/0.25 = −1.10
```

**Stress test, drawn on screen:**
```
Σβ·F dry   pines   = −0.682 + 0.528 + 0.087 + 0.024 + 0.008 = −0.036  ⇒ ×0.985
Σβ·F dry   beetles = −0.891 − 0.264 − 0.152 + 0.016 − 0.033 = −1.324  ⇒ ×0.444
Σβ·F dry   frankia = −0.605 + 0.180 − 0.261 + 0.112 + 0.015 = −0.559  ⇒ ×0.765
bookMult dry = 0.333(0.985) + 0.500(0.444) + 0.167(0.765) = 0.678

    ── if it dries out      ×0.68
```

**Decision.** An offer is standing: ⊥ **the hemlocks at Ninebark**, `β = [−0.70, +0.55, −0.10, +0.35, 0.00]`.
Two channels. The cap is full at 7. Buying ACCORD channel #2 costs **145 ⟡** of the 201 held.

```
after: shares (ch 2,3,1,2 of 8) = 0.250, 0.375, 0.125, 0.250
hemlocks now:  Σβ·F = −0.252 + 0.352 − 0.056 + 0.056 + 0 = +0.100 ⇒ ×1.042
hemlocks dry:  Σβ·F = +0.770 + 0.330 + 0.044 + 0.056 + 0 = +1.200 ⇒ ×1.504

bookβ_M   →  0.250(0.62) + 0.375(0.81) + 0.125(0.55) + 0.250(−0.70) = +0.353   (from +0.703)
bookMult  →  0.250(1.297)+0.375(1.079)+0.125(1.357)+0.250(1.042)    =  1.159   (from 1.198)
bookMult dry → 0.250(0.985)+0.375(0.444)+0.125(0.765)+0.250(1.504)  =  0.884   (from 0.678)
```

**The trade, stated plainly:** you give up **3.3% of today's yield** and **145 ⟡** to buy
**+30.4% in the dry scenario the forecast says is coming**. That is a textbook hedge and every one
of those numbers was on screen before the player committed.

**Play:** buy channel #2 (⟡ 201 → 56), sign the hemlocks at ch 2, term 4.

### TURN 4 — t = 1:11:00 · fc 0.41 · the drought, and where ACCORD comes from

**State.** `G = 2.4e8 g/s`. The drought overshot the median: `W = 0.21` ⇒ **M −1.24**.
Canopy 0.71 ⇒ **C +0.42**. `t = 4,260` ⇒ `sin(2.304 rad)` ⇒ **S +0.742**. humus 0.51 ⇒ **D +0.02**.
rival 0.26 ⇒ **P +0.15**.

```
beetles  Σβ·F = 0.81(−1.24) + (−0.44)(0.42) + 0.35(0.742) + 0.10(0.02) + 0.22(0.15)
              = −1.004 − 0.185 + 0.260 + 0.002 + 0.033 = −0.894
       shockMult = 1 + 0.42(−0.894) = 0.624
       envStress = 0.894 × 0.80 = 0.716
       adverse   = 0.894
```

Beetles' tenure since the turn-3 era: 2,854 s ⇒ bond 0.958 ⇒ bondMult 2.520.

```
dStrain = ( 1.15(0.716) − 0.22(0.958) − 0.16 ) × 0.0020
        = ( 0.823 − 0.211 − 0.160 ) × 0.0020 = +0.000904 / s
0 → 0.80 in 885 s?  No — strain was already 0.44 from the preceding four minutes.
0.44 → 0.80 in 398 s.  It arrives.
```

**NOTICE at t = 1:11:00.** ⬡ demands **tribute**: `0.055 × biomass`. Biomass held = 3.1e11 g ⇒
**1.705e10 g**, which is **71 seconds of gross production.**

**The arithmetic on screen:**
```
nominal beetles:  S = 9.5 × 2.4e8 × 3^1.35 × 2.520 = 9.5 × 2.4e8 × 4.407 × 2.520 = 2.532e10 g
                  I = 240 / (1.4696 × (1 + 0.7×0.958)) = 240 / 2.455 = 97.8 s
                  rate = 2.589e8 g/s = 1.08 × G

running now:      × shockMult 0.624 × (1 − 0.85×0.80 = 0.32) = ×0.200  ⇒ 5.18e7 g/s
after tribute:    strain 0.80 → 0.35 ⇒ ×(1 − 0.298) = 0.702 ; × 0.624 ⇒ ×0.438 ⇒ 1.134e8 g/s

gain = 6.16e7 g/s for the ~200 s of drought remaining = +1.23e10 g
cost = 1.705e10 g
```

**Marginally negative on carbon alone.** The tribute is only correct because of what it protects:
2,854 seconds of bond (worth `2.520 / 1.000 = 2.52×` forever) and the ⟡ that enduring pays.

**What enduring pays:**
```
continuous:  0.85 × 3^0.5 × 0.958 × 0.894 × 240 s = 0.85 × 1.732 × 0.958 × 0.894 × 240 = 302 ⟡
NOTICE resolved without breach:  40 × (1 + 0.958) = 78 ⟡
                                                    ─────
                                                    380 ⟡
```

**One drought pays for two and a half channel purchases.** This is the moment the player understands
what ACCORD is: it is not a reward for doing well, it is a reward for **not letting go**.

**Play:** pay the tribute. ⟡ 56 → 436.

### TURN 5 — t = 2:24:00 · fc 0.78 · the long thesis, and leverage

**State.** `G = 1.6e9 g/s`. 8 pacts, 15 channels, `pactSlots 8`. ⟡ 1,180. P5 active.

**The long thesis has resolved.** `ΣT/ΣT0 = 0.29` ⇒ **C −0.42**, down from +0.64 at turn 3.

```
pines  (β_C +0.88):  Δ shockMult = 0.88 × (0.64 − (−0.42)) × 0.42 = −0.392
                     1.297 → 0.905 from this factor alone, over 102 minutes.
beetles(β_C −0.44):  Δ shockMult = +0.196.
```

The pines have quietly lost 30% of their multiplier and nothing ever said a word about it. A player
who read the β2 column at turn 3 rotated out of ROOT around minute 90 and is now 18% ahead of one
who didn't. **This is the deepest thing in the layer.**

**Decision.** Broker a **TRIANGLE**: ◍ frankia (strain 0.10, bond 0.97) → △ lungwort (0.22, 0.91)
→ ⬡ beetles (0.05, 0.98) → frankia.

```
mean bond = 0.953
cost = 420 × (3 + 0.10 + 0.22 + 0.05) / (1 + 0.953) = 420 × 3.37 / 1.953 = 725 ⟡
effect: each member shockMult ×1.18, strain recovery −0.06/tick extra
        these three are 9 of 15 channels = 60% of the book
        book yield +18% × 0.60 = +10.8%, permanent
risk:   any one of the three breaches ⇒ all three breach penalties DOUBLE
        = a permanent E ×0.846 scar, a 12% biomass raid, and 800 s of blindness, at once
```

⟡ 1,180 − 725 = **455**, which is not enough for channel #6 (1,114) and leaves the P6 severance
budget thin. **You are trading endgame flexibility for mid-game throughput.** There is no right
answer; there is a position.

**Play:** broker the triangle. And note what the player is now doing: not optimising a number, but
holding a shape — three partners, four hours of accumulated loyalty between them, one shared fate,
and a forest that is running out from under all of it.

---

---

# PART TWO — THE ANTIPHONY

**Act III's tournament analogue. A finite, 22-minute gauntlet. Not a faucet.**

---

## 16. THESIS

UP's Strategic Modeling tournament is a real object from game theory presented without a word of
explanation, and it is excellent for about forty minutes. Then *AutoTourney* (50,000 creativity)
turns it into a passive Yomi faucet and it dies (teardown §6, closing note).

The Antiphony fixes that with three structural decisions:

1. **You do not buy strategies. You write them.** In UP you purchase RANDOM, A100, GREEDY, TIT FOR
   TAT as *items*. Here you compose a 3-rule policy from unlocked predicates and responses. The
   strategy is authored, not owned.
2. **The ladder is finite and there is no auto-run.** Nine strains, three attempts each, 27
   encounters maximum, seven rounds apiece. It ends. It cannot become wallpaper.
3. **Opponents persist and are inferable.** Every encounter's full transcript is archived. The
   opponent's policy is fixed for the run. **Reading a transcript and naming the rule is the skill.**

Fiction: your spores have been travelling a long time. Some lineages diverged. When two lineages of
the same organism meet on the same substrate they do not fight — they exchange chemical registers
until one of them recognises the other, or doesn't.

---

## 17. RULES

### 17.1 Placement and unlock

Late Act III. Two conditions, both required:
```
wildStrainFraction ≥ 0.18        // the divergence threat is real
project `anti_organ` purchased   // "The Antiphonal Organ" — (14,000 Ψ)
```

Expected arrival: roughly 70% of the way through Act III, leaving ~35 minutes of act after it, of
which the Antiphony occupies ~22.

### 17.2 The encounter

An encounter is **7 rounds** against one named wild strain.

Each round, both sides simultaneously commit one **register**:

```
CALL   — an unprompted signal
ECHO   — a repetition of what was heard
HOLD   — silence held open
CUT    — a chemical severance
```

Scores accumulate. After round 7, `Δ = yourTotal − theirTotal + handicap_k`, where
`handicap_k = −round(7 · divergence_k)` (i.e. divergent strains start ahead of you).

```
Δ ≥ +7          →  ABSORPTION
−7 < Δ < +7     →  MERGE
Δ ≤ −7          →  DIVERGENCE
```

### 17.3 The payoff matrix

Shared, symmetric, per-strain. The base (rows = your register, columns = theirs; entries are **your**
score, and theirs is the transpose):

```
                them
        CALL   ECHO   HOLD   CUT
CALL  [   2  ,   0  ,   1  ,  −1  ]
ECHO  [   4  ,   3  ,   0  ,  −3  ]
HOLD  [   1  ,   1  ,   2  ,   1  ]
CUT   [   5  ,   4  ,  −1  ,  −2  ]
```

Structure, which every strain preserves:

- **Best responses:** `BR(CALL) = CUT (5)` · `BR(ECHO) = CUT (4)` · `BR(HOLD) = HOLD (2)` ·
  `BR(CUT) = HOLD (1)`.
- **(HOLD, HOLD) is the unique pure Nash** at 2–2. Safe, defection-proof, mediocre.
- **(ECHO, ECHO) at 3–3 Pareto-dominates it** and is unstable: CUT deviates to 4.
- **CALL is a sucker's move**: never a best response, but it pays 2 if mirrored and −1 into a CUT.
- Row sums against a uniform opponent: CALL 2, ECHO 4, HOLD 5, **CUT 6**.

That last line is the difficulty curve. **CUT beats a random opponent**, so naive players spam it —
and then meet strain 4, whose policy is `ALWAYS → HOLD`, and lose 7 rounds of −1 while it collects
2s. Learning that CUT is not a strategy is the gate between the low and mid ladder.

**Per-strain perturbation**, seeded from `strainId`:
```
P_k[i][j] = base[i][j] + round( rng()*4 − 2 )         // ±2 on every cell
then repair, in this order:
  HOLD row  : clamp all entries to [0, 3]      (HOLD stays the safe floor)
  CUT column: force min entry ≤ −3             (CUT stays punishable)
  ECHO/ECHO : force ≥ 2                        (coordination stays a real option)
  CUT/ECHO  : force ≥ 3                        (ambush stays a real threat)
```

Every strain is a variation on one theme. Learnable in general, specific in detail — the exact
structure the teardown praises in UP's random symmetric grid (§6), with the arbitrariness removed.

**Information rule:** your payoff row-block is always visible. **Their** payoffs are hidden until you
have completed one encounter against that strain. You learn by fighting.

### 17.4 The policy — you author it

You do not pick moves. You write a **policy**: up to **3 conditional rules**, evaluated top-down each
round, plus a **default register** if none match.

```
POLICY = [ rule1?, rule2?, rule3?, DEFAULT ]
rule   = { condition, register }
```

**Conditions** (unlocked with CANON, §17.6):

| # | condition | cost | note |
|---|---|---|---|
| 1 | `ALWAYS` | free | |
| 2 | `THEY PLAYED <r> LAST` | free | the workhorse |
| 3 | `ROUND ≤ n` / `ROUND > n` | 120 | opening and endgame books |
| 4 | `I AM BEHIND` / `I AM AHEAD` | 220 | state-dependent play |
| 5 | `THEY REPEATED` | 360 | detects a locked opponent |
| 6 | `THEY HAVE PLAYED <r> ≥ k TIMES` | 540 | counting |
| 7 | `LAST ROUND SCORED ≤ 0` | 780 | pure feedback control |

**Registers**: the four base, plus two purchasable:

| register | cost | effect |
|---|---|---|
| `DRONE` | 620 | You score exactly **2** regardless of their register; **they score +1** on top of theirs. A guaranteed floor sold at a price. |
| `INVERT` | 900 | Plays the **best response to what they played last round**, computed against the true matrix. Round 1 falls through to the next rule. |

`INVERT` is UP's BEAT LAST as a *composable primitive* rather than a purchased whole strategy — you
can write `IF I AM BEHIND → INVERT, ELSE → HOLD`, which is strictly more expressive than anything in
UP's tournament, and it fits in one line.

### 17.5 The opponents

Nine strains, fixed for the run, regenerated on **New Growth** (Act III's prestige). Each has a
hidden policy of the same grammar (2–4 rules), **and it is a legal policy the player could have
written** — no cheating, no hidden state, no randomness beyond a declared mixing rule.

| # | strain | divergence | policy (hidden) | teaches |
|---|---|---|---|---|
| 1 | **the near strain** | 0.12 | `ALWAYS → CALL` | CUT punishes CALL |
| 2 | **the strain from the cold side** | 0.21 | `ALWAYS → ECHO` | ECHO is not free; CUT eats it |
| 3 | **the slow strain** | 0.31 | `THEY PLAYED CUT LAST → CUT` / `→ ECHO` | retaliation exists |
| 4 | **the closed strain** | 0.40 | `ALWAYS → HOLD` | **CUT is not a strategy** |
| 5 | **the mirror** | 0.50 | `THEY PLAYED r LAST → r` / R1 `→ CALL` | you are playing yourself |
| 6 | **the counting strain** | 0.60 | `THEY PLAYED CUT ≥ 2 TIMES → HOLD` / `THEY PLAYED ECHO LAST → CUT` / `→ ECHO` | memory beats reflex |
| 7 | **the strain that opens late** | 0.71 | `ROUND ≤ 3 → HOLD` / `I AM BEHIND → CUT` / `→ ECHO` | phase structure |
| 8 | **the strain that remembers you** | 0.83 | `[cross-encounter] YOU OPENED WITH r LAST TIME → BR(r)` / `THEY REPEATED → CUT` / `→ HOLD` | **vary your opening** |
| 9 | **the far strain** | 0.94 | 4 rules, adaptive, includes `LAST ROUND SCORED ≤ 0 → INVERT` | everything |

Strains 8 and 9 read your **cross-encounter history**. That is the moment the layer stops being a
puzzle and becomes an opponent.

Attempts: **3 per strain.** On each of your losses, `divergence_k += 0.06` (the strain grows) and
`wildStrainFraction += 0.03` (a real Act III penalty — it raises the divergence threat you are
otherwise spending the act suppressing). **Losing costs you something outside the minigame.**

### 17.6 CANON † — the currency

```
ABSORPTION  →  180 + 260 · divergence_k
MERGE       →   90 + 150 · divergence_k
DIVERGENCE  →   20
```

Σ divergence across the ladder = 4.62. A perfect all-absorb run pays **2,821 CANON**; a realistic run
with retries pays 3,200–4,500.

Sinks:

| sink | cost | note |
|---|---|---|
| genetic fidelity | 1 CANON → **+0.0004 fidelity**, contribution capped at **+0.30** | 750 CANON caps it. The main line. |
| conditions 3–7 | 120 / 220 / 360 / 540 / 780 | 2,020 total |
| `DRONE` register | 620 | |
| `INVERT` register | 900 | |
| **THE CHORUS** ending gate | 2,400 CANON **and** ≥ 7 MERGE outcomes | §17.8 |

Note the deliberate conflict: **ABSORPTION pays roughly 1.9× MERGE**, so the CANON-maximising line
is to win everything — and the Chorus ending requires you to *deliberately draw seven times*, which
means playing for a tie against opponents you could beat, three times each, to grind the balance up.
**The merciful ending is the expensive one.** That is the entire moral content of the system and it
is expressed in two numbers.

### 17.7 Why it does not become a faucet

| UP tournament failure | Antiphony |
|---|---|
| *AutoTourney* runs it forever | **no auto-run exists at any price** |
| unlimited tournaments | 27 encounters, hard cap |
| grid regenerated randomly each time | 9 fixed opponents, learnable |
| you buy strategies as items | you author policies |
| losing costs 1,000 ops | losing costs `wildStrainFraction +0.03`, which is act-level |
| ~40 min of content | ~22 min, and it is designed to be 22 |

### 17.8 Endings hook

The Antiphony gates one of Act III's endings and modifies a second:

- **THE CHORUS** (new): requires 2,400 CANON and ≥ 7 MERGE. You do not absorb the divergent
  lineages; you stay in conversation with them. The strongest `LEGACY` outcome and the only ending
  in which the wild strains persist.
- **Any ending**: `fidelity` contribution up to +0.30 from CANON.
- The `pathFlag == "necrotroph"` Act II carry-out **locks** the Chorus ending. If you ate the forest
  you do not get to be forgiven by what you seeded. Stated nowhere.

---

## 18. THE ANTIPHONY UI

### 18.1 Policy screen (portrait, the default view)

```
┌───────────────────────────────────┐
│ ANTIPHONY            † 1,840      │
│ the counting strain    ◈ 2 of 3   │  ← attempts remaining
│ divergence 0.60      handicap −4  │
├───────────────────────────────────┤
│ YOUR POLICY                       │
│                                   │
│ 1 [ THEY PLAYED  CUT  LAST ] ▾    │
│   [ → HOLD ] ▾                    │
│                                   │
│ 2 [ I AM BEHIND ] ▾               │
│   [ → CUT ] ▾                     │
│                                   │
│ 3 [ + add rule ]                  │
│                                   │
│ ELSE [ → ECHO ] ▾                 │
├───────────────────────────────────┤
│ [ ▤ TRANSCRIPTS ]  [ ▦ MATRIX ]   │
│                                   │
│      ┌───────────────────┐        │
│      │       SING        │        │
│      └───────────────────┘        │
└───────────────────────────────────┘
```

Every dropdown is a native `<select>` — a 44 px target that opens the OS picker, which is the single
best-tested control on any phone. No custom dropdowns. No drag-and-drop rule reordering (a
`⇅` button swaps a rule with the one above it).

**SING** is a 56 px button in the bottom third. It is the only commit.

### 18.2 Encounter screen

Rounds resolve at **one per 2.5 s**, filling downward. No skip, no speed control — 17.5 seconds of
watching is the correct length and it is the only place in HYPHAE where the player is asked to wait
and watch.

```
┌───────────────────────────────────┐
│ ←  the counting strain            │
│                                   │
│      YOU          THEM      Δ     │
│  1   ECHO   ·   CALL       +4     │
│  2   ECHO   ·   ECHO       +4     │
│  3   HOLD   ·   CUT        +4     │
│  4   CUT    ·   ECHO       +8     │
│  5   HOLD   ·   HOLD       +8     │
│  6   ·      ·   ·                 │  ← filling
│  7                                │
│                                   │
│  running        21  −  13         │
│  handicap                −4       │
│  ────────────────────────────     │
│  Δ                       +4       │
│                                   │
│                     MERGE ▸       │  ← projected band, live
└───────────────────────────────────┘
```

The projected outcome band updating live as rounds resolve is the tension. At round 5 it says MERGE;
at round 6 it can flip to ABSORPTION and back.

### 18.3 Transcript screen — where the skill lives

```
┌───────────────────────────────────┐
│ ←  TRANSCRIPTS · the counting     │
│                                   │
│  ENCOUNTER 1        DIVERGENCE    │
│   you  C E C C E C C              │
│   them E C H C C H C              │
│                                   │
│  ENCOUNTER 2        MERGE         │
│   you  H E H E E H E              │
│   them E C E H C H E              │
│                                   │
│  ▸ they played HOLD after your    │
│    second CUT, both times.        │  ← the ONE hint the game gives
│                                   │
├───────────────────────────────────┤
│  their payoffs (learned)          │
│        C    E    H    X           │
│   C [  3    1    2   −1 ]         │
│   E [  4    3    0   −3 ]         │
│   H [  1    2    2    1 ]         │
│   X [  5    4   −1   −2 ]         │
└───────────────────────────────────┘
```

Registers abbreviate to single letters (`C E H X`) so a 7-round transcript is one line and four
encounters fit above the fold. **The one-line observation is generated by a tiny pattern detector**
that looks for the most-supported `(condition → register)` pair in the archive and states it in
plain English. It is never wrong and it is never complete — it will find rule 1 of a 3-rule policy
and say nothing about the others.

That single line is the difference between a system players bounce off and one they get good at.

### 18.4 Accessibility and motion

- Round reveal is a 250 ms opacity fade, not a slide. Under `prefers-reduced-motion` rounds appear
  instantly and the 2.5 s cadence remains.
- `aria-live="polite"` on the running total; each round announces
  `"round four, you cut, they echo, plus four, running twenty-one to thirteen"`.
- The four registers are distinguished by **word**, never by colour or icon alone.
- The policy `<select>`s are keyboard-navigable by construction.

---

## 19. IMPLEMENTATION APPENDIX

### 19.1 Tick order (Pact Book, inside Act II's slow tick, 0.5 Hz)

Order matters. Get it wrong and strain oscillates.

```
1.  recomputeFactors()             // F1..F5 from world state (read-only)
2.  for each pact: shockMult, envStress, adverse           (§5.3)
3.  recomputeCosts()               // congestion, per-pact attribution   (§2.5)
4.  chargeCosts()                  // deduct biomass; record demandMet
5.  for each pact: yield_p                                  (§4)
6.  applyYields()                  // minerals, biomassRate mult, Ψ, signalMult, rivalStr, forecast
7.  rollBroodDeliveries()          // Poisson, AFTER yields so shockMult is current
8.  updateStrain()                 // uses demandMet from step 4        (§6.1)
9.  checkLadder()                  // WARNING / NOTICE / BREACH          (§6.2, §7)
10. accrueAccord()                 // uses adverse from step 2          (§10.1)
11. advanceTenure()                // += dt_slow for active pacts
12. checkExpiry()                  // renew window, lapse                (§3.4)
13. maybeGenerateOffer()                                                (§11.2)
14. writeLedgers()                 // ring buffer, 1 Hz decimation
```

Steps 1–11 are ~9 pacts × ~40 flops = nothing. Step 14 is the only allocation and it writes into
preallocated `Float32Array`s.

### 19.2 Save shape

```js
pactbook: {
  v: 1,
  accord, accordLifetime, accordChannels, projectChannels,
  guildRep: [6 ints], bookRep,
  pacts: [ {id,partnerId,guild,regionId,ch,tenure,strain,stake,termSeasons,
            signedAt,endsAt,beta:[5],traits:[3],known,noticeAt,accordPaid,state} ],
  offers: [ {partnerId,guild,regionId,beta,traits,expiresAt,maxTerm,qualityMult} ],
  partners: { [partnerId]: {grudge, refuseUntil, dislikes:[], everSigned} },
  triangles: [ [id,id,id] ], reconciled: [ [pid,pid] ],
  phase, reallocations, pactsHonoured, pactsBreached, traitsRevealed,
  shocksFired: 0b000
}
antiphony: {
  v: 1, canon, unlockedConditions: 0b1111111, unlockedRegisters: 0b11,
  policy: [ {c,arg,r}, {c,arg,r}, {c,arg,r}, defaultR ],
  strains: [ {id,divergence,attemptsLeft,matrix:[16 int8],policyKnown,outcomes:[]} ],
  transcripts: [ {strainId, mine:[7], theirs:[7], delta, outcome} ]
}
```
Ledgers are **not** saved — they refill in 120 s and saving 9 × 120 floats is wasteful.

Total: ~9 KB JSON, ~3 KB gzipped. Well inside a single-file localStorage budget alongside Act II's
61 regions.

### 19.3 Build order

1. Bandwidth + a single ROOT pact + the pip strip. **Ship this and play it.** If the pip scrub does
   not feel good, nothing downstream matters.
2. `bond`, the tenure penalty, the UNDO toast.
3. Cost, congestion, the header readout.
4. Guilds 2–4 with their α values. Verify the α lesson lands in playtest before building anything else.
5. Strain, the ladder, breach effects. Guild-specific breaches last — a generic breach is fine for
   two weeks.
6. The factor model + exposure sheet + stress tests. **This is the payload. Budget accordingly.**
7. ACCORD, channel purchases, offers, reputation.
8. Traits.
9. Cross-pacts, brokering, P5/P6.
10. The Antiphony, entirely separate, in Act III's sprint.

### 19.4 Things deliberately NOT in this design

- **No shopping.** Offers arrive. A catalogue would make partners into items.
- **No numeric "reputation score" per partner.** Act I has that; Act II has `strain`, which is a
  *state you caused*, not a score you accumulated.
- **No random betrayal.** Every breach is traceable to six visible terms.
- **No pact "levels" or "tiers."** Growth is tenure and channels. That's it.
- **No pact automation.** `pact_perennial` automates *renewal* and is 54% worse. Nothing else is
  automatable, ever, in either system.
- **No sorting or filtering UI.** Nine cards, hand-ordered by the player.
- **No tooltips longer than one line, no codex, no tutorial.** Everything is on the card.
```
