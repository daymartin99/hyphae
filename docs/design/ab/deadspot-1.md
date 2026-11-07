# Dead-spot pass 1: Act I, `?ui=d` (Nov 2026)

This is the cheap first pass before the agent bounce-off test (10, Phase 6, Still to do). The pacing bot plays from a fresh start and is sampled every game minute. At each sample we record the NEXT line, what is visible, and how far it has got towards DECIDE. The harness is `deadspot.mjs` in this folder.

The design rule, from David, is that the road stays hidden but the player still walks it: "good game design makes the player follow a path they think is opaque while it's not". Respect the player.

## Before
For the human bot, NEXT read "autolysis is within reach" from minute 39 to minute 114. That is 75 minutes on the only signpost, pointing at a trap. Action Potential was on screen for 18 minutes and never named. During the Signal wait, NEXT pointed at an unrelated trade.

## Changes
- **The road wins.** Act I's road is the patches, then Anastomosis, then Action Potential. Whenever a step of the road is on screen, NEXT names it ahead of anything nearer.
- **Temptations still speak.** Autolysis still holds the line until the road appears; the voice has already warned that it is not free ("don't trust what you are told"). It now holds the line for about 8 minutes, not 75.
- **The Signal wait.** NEXT reads only "something is gathering." It does not say what for.

## After (time to DECIDE)
| Bot | Looks every | Taps | Slips | Act I | Note |
|---|---|---|---|---|---|
| human | 20 s | 35 % | 15 % | 1 h 55 m | NEXT is on the road from minute 47 |
| slower | 45 s | 20 % | 30 % | 2 h 24 m | patch 2→3 took 44 min, short of minerals |
| casual | 90 s | 10 % | 40 % | **not in 4 h** | the bounce profile |

## Where a casual player bounces (from the data)
1. **Minutes 0–8: no tip.** Nothing happens unless you tap.
2. **Minutes 60–140: a plateau.** Tips go from 24 to 39, and reputation repeatedly falls to 0 as terms go unmet. NEXT keeps saying "a tip is within reach", so nothing on screen explains the stall.
3. **Minerals gate every patch.** The casual bot spends 15–40 minutes short of minerals on each one.

These are the questions for the agent bounce-off test. The data shows where players stall. The agents have to say why they quit.
