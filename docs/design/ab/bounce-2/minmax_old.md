# HYPHAE: Morgan's playtest report

## 1. Stop point
**195 played minutes. I quit.** I was also about 250 tool calls in, close to the ~280 limit, but the limit isn't why I stopped. I hit a plateau. I'd bought every adaptation I wanted and claimed 6/6 patches (plus the Coppice and Oak Rise patch adaptations). I was holding 2.5 t of labile and 5.5k minerals with nothing left to spend them on, and sugar was rotting at 300+/s above its cap. All that was left to do was re-sign tree contracts every few minutes through a fiddly form. That's exactly the kind of wait where I have no decisions to make, and it's what drives me off.

## 2. How far I got
I went from 0 g to **3.42 t of biomass**, from tapping EXTEND to about +1.1 kg/s passive. The game changed shape three times:
- **~3 min:** it stopped being a tapper and became an economy. Sugar appeared, and so did a *market* for the floor (buy litter with sugar, with price impact and price-history bars).
- **~9 min, and properly at ~25 min:** "The Understory" opened. You sign contracts with trees: volume, term, collateral, an "exclusive" checkbox and a coverage bar. You pay sugar per second and get minerals (∴). From then on, ∴ was the currency that gated everything.
- **~53–160 min:** patches. New ground, new partners (aspen, douglas fir, hemlock, hollow beech, a dying elm), new food types (bark slough, fallen log, heartwood stump), and the hyphae drawing at the top of the screen grew from a twig into a dense fan. By about 160 min I'd reached 6/6 and the game stopped producing new systems. Autolysis turned out to be a labile liquidation, not a prestige layer, and the oak promised by "The Oak Rise" never appeared in my tree list.

## 3. Timeline
- **0 min:** Tapped EXTEND. "something under you is already dead / it comes apart in water." Nice opening. Taps are about 0.6 g each.
- **2 min:** First hyphal tip at 60 g, giving 3 g/s of litter eaten and about 1.5 g/s of biomass. Payback was about 40 s, so I bought tips greedily. ✦
- **4 min:** The litter market appeared. "you paid for something that was free an hour ago." I worked out that a kg of litter for about 100 sugar more than pays itself back in sugar. ✦
- **5 min:** Winter. The rate halved and moisture showed a ×0.41 multiplier. ◆ "winter. the water stops moving and so do you."
- **9 min:** Found cover / held water / variety. "tips are cheap. the ground they open is not." Lovely. The text was hinting at a real trade-off.
- **11 min:** Spring jumped me to +19 g/s. Bought Rhizomorph Cords. ✦
- **14–22 min:** The floor kept going bare every ~2 min, so I had to buy MAX every 90 s or the sugar rotted. ⚠ This was the opposite of "put the phone down."
- **17–25 min:** ❓ Signing the birch contract silently failed twice. Taps landed on the wrong slider because the page reflows under your finger, and once "the oak declines…" appeared in red with no clue whether that meant *my* contract. I only realised nothing was active when "MINERALS 0.00 ∴ no tree is paying" appeared.
- **27 min:** Bought Standing Order (auto-buy). Relief. ❓ But it's lazy and unpredictable. Several times I came back to "the floor is bare" with 1–17k sugar sitting there rotting.
- **38 min:** ❓⚠ Accepted a birch offer and got "the thread stops short. it needs more sugar behind it." It took me a while to infer that the "after food" number must cover the contract volume. The coverage bar exists, but what feeds it isn't explained.
- **53–59 min:** First patch claim, then aspen. 5 sug/s gives 0.46 ∴/s, ten times better than the birch. Real optimisation finally opened up. ✦
- **71–98 min:** Patch 3 and Hemlocks. Bought Dormancy Clause, Osmotic Priming, Laccase, Peroxidase. New wood types: "leaf, bark and branch together. each one opens the next." ✦
- **126 min:** ◆ "a forest floor is not a floor. it is the top of something." The style shifted (no bullet), which felt like a different speaker.
- **153 min:** A hollow beech contract at 27.8 sug/s for 4.99 ∴/s (10.8k over the term). Huge. ✦
- **160 min:** 6/6 patches. Bought tips MAX: 117 tips at 2.5 kg/s eaten. The map drawing is genuinely beautiful by now. ✦
- **168 min:** ◆ "the elm is finished. the collateral returns. nothing else does." That was the best line in the game. A partner died.
- **179 min:** ◆ The Hollow Beech: "It will pay almost anything. Read the term length twice." It was the first real sugar sink, and it came very late.
- **180–195 min:** Autolysis only shrank me into more labile I couldn't use. Nothing new unlocked, everything piled up, I quit. ⚠

## 4. Mystery vs clarity
**Mystery score: 4/5.** Learning the controls never spoiled the intrigue. The writing kept reframing the mechanics: cover vs. eating ("you ate the cover"), price impact ("the price went up while you were buying. you did that."), the beetles bidding against me, the elm dying, the beech's ominous terms, an oak that has "been declining offers for two hundred years." Even after I'd modelled the economy, the trees still felt like characters with agendas. I lose a point because the late game ran out of new mystery: the Oak Rise promised a partner that never showed up, and Autolysis turned out to be a plain conversion.

**Clarity score: 2/5.** I always knew roughly what existed. I often didn't know what my tap had *done*, or why a number was what it was. The worst friction:
- **The layout reflows constantly.** New log lines and header rows (rot, "to empty", "owed") change height, so content jumps between reading coordinates and tapping. I bought the wrong thing or missed purchases at least 6–8 times, and contract sliders moved the wrong value.
- **The sticky header eats half the screen** (biomass/labile/sugar/minerals/after-food/owed). The scroll area shrinks to about 350 px, and cards sit under the header while still being "tappable."
- **Contract signing fails silently or ambiguously.** "needs more sugar behind it" is flavourful, but I needed to know "after-food must be ≥ volume." I also never learned what "exclusive" does.
- **"After food" swings wildly** (−13 to +165 within a minute) because it includes standing-order buying. You can't plan contracts against it.
- **The Standing Order's behaviour is opaque.** It sometimes lets the floor stay bare with a full sugar tank.
- **Patches show up twice:** a free CLAIM in the Patches section *and* "Patch: …" adaptations with costs. I never worked out whether claiming deducted anything. The counter stayed at 6/6 after buying two more patch adaptations.
- **The minerals icon is ∴ in the header and ⛬ in prices.** That's a small thing, but I noticed.

**The difference.** Intended mystery: what the trees want, why cover matters, what Perennial Mycelium/Autolysis *mean*, the beech's "read the term length twice." Those felt deliberate and good. Broken or unclear interface: reflowing tap targets, silent contract failures, the lazy Standing Order letting sugar rot, duplicated patch paths, and an "after food" number I couldn't reason about. Those didn't feel like a fungus being mysterious. They felt like the UI fighting me.

## 5. The voice
Lines that stuck:
- "other things eat here. that is what a price is."
- "you paid for something that was free an hour ago"
- "tips are cheap. the ground they open is not."
- "the price went up while you were buying. you did that."
- "paid for. the beetles were bidding too."
- "the oak declines. it has been declining offers for two hundred years."
- "a mushroom is not the organism. it is the part that is leaving."
- "the elm is finished. the collateral returns. nothing else does."
- "It is enormous and it is empty and it will pay almost anything. Read the term length twice."
- "a tree ring is a year in which nothing happened fast enough to notice."

Mostly it **helped**. Many lines are tooltips in disguise (cover/moisture, price impact, autumn surplus: "more is falling than anything can eat. leaves are cheap" told me to buy tips *now*). It **misled** me once or twice. The red oak line appeared right as my birch signing failed, and I read it as the cause. The speaker felt like the forest itself, or the fungus's own slow awareness, in second person. The un-bulleted lines ("a forest floor is not a floor…") read like a separate, older narrator.

## 6. The single change that would make me play more hours
**Give the late game a sink and a next layer, and make contracts manageable.** Concretely: let contracts auto-renew at the same terms (or add a "renew all" button), and show a fixed "max safe volume" based on *income minus contracts*, not the noisy after-food number. Then give the 2+ t of idle labile and 5k+ minerals somewhere meaningful to go. A real prestige, or the oak as an endgame partner. Mid-game I was making a purchase decision every few minutes and loved it. After ~160 min I was only re-filling sliders while my resources rotted.

The cheapest high-impact fix: stop the layout from reflowing under the finger, because that cost me more than any wait.
