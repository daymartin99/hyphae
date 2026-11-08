# Bounce-off test 1 (Nov 2026)

Six blind agent players played from a fresh start, using screenshots only, with no code and no docs. Each quit at the moment its persona would. There were three temperaments, each played on both interfaces. The brief, driver, reports and traces are in `bounce-1/`. Waiting was played with the game still running (not offline), so long gaps were slightly generous.

| Player | Old interface | New interface (`?ui=d`) |
|---|---|---|
| Jay, commuter: 5–10 min bursts, skims | quit at 157 min (about 10 in hand) | quit on the third session (about 185 min) |
| Sam, curious: Paperclips fan, reads everything | **kept playing**, stopped by the cap at 147 min | quit at 56 min |
| Lee, skeptic: taps everything, 10 min to hook | quit at 77 min | **quit at 9 min** |

**The redesign lost 3–0 on retention.** The cause was mine, not the direction:
1. **A squeezed panel.** Once sugar arrives, the ledger is four rows deep and the panel list was left 162 px for 889 px of birch card. The deal's controls sat under EXTEND, and two of the three players quit there. *Fixed: the list keeps 300 px and the body window yields, down to a 112 px strip.*
2. **A bare floor nobody could act on.** Every player ran the floor dry, between 4 and 17 minutes. On the old interface, the litter for sale is on the same scroll. On the new one it is under **grow**, while NEXT kept offering "a tip". *Fixed: a bare floor owns NEXT ("the floor is bare. more is for sale, under grow."), and tapping NEXT goes there.*
3. **Prices paid from labile.** Three of six could not buy a 1.10 kg card while holding 1.4 kg of biomass. *Fixed: Act I gram prices read "1.10 kg labile".*

## Shared by both interfaces (not yet fixed)
- **∴ is never named** (2 players). They learnt what minerals are by accident.
- **Defaults while away** (2). Sam's one near-quit was a fully delivered birch contract that defaulted during a 10-minute break and cost 22 rep. Jay came back twice to a dead state with no account of it. This runs against "respect the player's time off". Dormancy Clause fixes it, but only once bought.
- **The goal arrives late.** PATCHES 1/6 was found at 32–48 min by the two who reached it. Both called that the moment the game made sense.
- **Which reputation counts** (1). The patch reads the network's standing, while each tree card shows its own.
- **The layout jumps under the thumb** (2, old interface). Taps land on the wrong thing.
- **The contract card** reads as a loan form (2): "signing a car loan with a tree". Sam loved exactly that.

## The voice
Every player read it, and all six quoted lines unprompted. Recurring favourites: "you have been making this the whole time", "there is a birch nine metres east. its roots are already on yours.", "a mushroom is not the organism. it is the part that is leaving.", "the one you failed will speak to you again. it has not forgotten." The criticism was consistent: it describes a problem without pointing at the lever ("the floor is bare. it will not stay bare." — "so what do I do?"), and repeated lines read as "nothing new will happen".
