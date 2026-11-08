# Invested-player test (bounce 2, Nov 2026)

Six blind agent players committed to "an evening or two", with a 6-hour cap. There were three temperaments, each on both interfaces. The question was David's: does V1's mystique hold invested players better than V2's clarity? The brief, reports and traces are in `bounce-2/`.

The old interface here is **V1 + the fixes of 7–8 Nov**: voice lines, labile prices and the swipe guard. V1 has since been frozen as a control (`v1-frozen`, built locally).

| Player | Old interface | New interface (`?ui=d`) |
|---|---|---|
| Sam: curious, Paperclips (David) | quit 333 min · mystery 4 · clarity 2 | quit 305 min · mystery 4 · clarity 2 |
| Robin: story, Outer Wilds (David) | quit 268 min · mystery 3 · clarity 2 | quit 271 min · mystery 4 · clarity 2 |
| Morgan: min-maxer, Antimatter Dimensions | quit 195 min · mystery 4 · clarity 2 | tool limit at 61 min (not a quit) · mystery 4 · clarity 2 |

## Findings
1. **Clarity did not cost mystery.** Mystery averaged 3.7 on the old interface and 4.0 on the new. Every player separated the two in their own words: the mystery lives in the voice, and the confusion was in the interface. Robin: "the controls are dry economic machinery and the mystery lived in the prose beside them."
2. **The interface did not decide retention.** All five who quit stopped at the same place, after 3.3–5.5 hours: all 6 patches claimed, every adaptation bought, and nothing visible next. **No one reached Act II.** Anastomosis waits on 500 m of thread (mostly tips, about 200 with 6 patches). No player knew thread length mattered, and all of them stopped buying tips at 117–121. This is the Act I wall David and his friends hit.
3. **What they asked for already exists.** "Give it a new act." "Make the mushroom really leave." "A visible next horizon." That is Act II, behind an unmarked door.

## Bugs found and fixed (V2 only)
- **Redesign list frozen at the top.** On `?ui=d` the panel list could not scroll: re-asserting the tab every frame reset `scrollTop`. (#26)
- **Swipe-back left the game.** A sideways drag a control did not take was read as swipe-back and loaded a blank page. The guard now sits on `html`. (#26)
- **SIGN showed success for a deal that never started.** The button tested the slider's collateral, but the game held collateral to the labile pool. Also, the oak's refusal line played for every tree.
- **The oak never came.** The tree cap was 7 while the game's own ladders hand out 8, so the beech took the oak's seat.
- **The hidden gate.** Two new lines from the watcher, from half the gate onwards once four places are held: "at the edges, your threads are reaching for each other. they have not met." / "they are close now. the gap between them is the length of a few more tips."

## Still open
- **The header grows and shrinks.** Rows like rot and "to empty" come and go, so buttons move between look and tap. Every new-interface player raised it, and some old-interface players did too.
- **Repetition late in Act I.** The voice recycles opening lines. Robin: "silence would be better than repetition."
- **Coverage bar, "after food" vs the sugar rate, and the patch label lag** are all unexplained.
- **Plain receipts for refusals** (Sam): "the birch won't take more than 2.5 sug/s right now".
