# Act II run 1 (Nov 2026): can blind players get into Act II?

Five blind agent players played the live build `hyphae-v54`. That build has the 60 m patches, the thread hints, the lo-fi pieces, the music line, and the no-repeat voice. Nobody was told Act II exists. The cap was 7 hours. The brief, reports and traces are in `act2-1/`.

| Player | Reached Act II | Avg fun | Peak | Tomorrow? |
|---|---|---|---|---|
| Sam, curious | **yes, minute 305** | 3.6 | 5 at DECIDE | **yes** |
| Robin, story | **yes, minute ~298** | 3.7 | 5 at DECIDE | maybe |
| Lee, skeptic | **yes, minute ~257** | 3.0 | 4.5 at DECIDE | maybe |
| Morgan, min-maxer | no (quit at 164) | 2.9 | 4.5 early | no |
| Jay, commuter | no (cap) | 2.6 | 3 | maybe-no |

Three of five got through. Before the 60 m change and the hints, that was one in seven (fun-1) and none in six (bounce-2).

## The door works
All three described the same moment unprompted: the black screen, STOP TASTING / START KNOWING, the first music, and a second, bigger game underneath. Robin: "Hours of build-up ('threads reaching for each other', 'it was not food') paid off." The hint lines were quoted as the build-up.

## What still stops people
- **The Act II ceiling.** Every card was above the signal cap, and D sat unspent with nowhere to go (Sam, Lee, Robin). *Fixed in v55, after this run loaded:* NEXT names the ceiling and points to the forest, and D is named only once it can be spent.
- **Deals.** They default with no cause shown, the tree refuses below its stated maximum, and coverage is unexplained (Morgan, Lee, Jay, Robin). *Fixed after this run:* the card says what you make, what the trees would take, and whether it defaults.
- **Act II minerals stalled** for Lee at 88, with no signpost to where they come from. *Open.*
- **MAX on tips quietly spends saved minerals** (Robin, Morgan). *Open.*
- **SIGN and EXTEND sometimes under the tab bar** (Robin). *Open.*
- **Act II story pacing.** Robin had ten minutes with no new line. Since the no-repeat change, silence is the cost of not repeating; Act II needs more new lines, not repeats. *Open, and it's writing.*
- **The commuter's idle loop.** The floor is bare at every return. Three economy fixes were tried and measured; all made progress worse (deadspot/commuter sims), so the economy stays and the fix is information. *Open.*
- **A raw `{region}` template in the voice** (Sam). *Fixed.*
