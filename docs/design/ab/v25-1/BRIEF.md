# Playtest: are you having fun, and why? (round v2.5-1)

You've just installed a free mobile game called HYPHAE. Play it the way your persona would and stop when your persona would genuinely stop, or at the cap. This test is about **fun**: what was enjoyable, what wasn't, and why.

## Rules that keep this honest
- **Screen only.** Do NOT read any source code, docs or files in /home/user/hyphae, and do not search the web. You know only what the screen shows.
- **View every screenshot** with your Read tool after each `look`. Base every decision on it.
- **Time moves only when you tap or wait.** Waiting = putting the phone down (`wait?s=600` means "check back in 10 minutes"). Play sessions the way your persona would.
- **Be honest.** Stop when you'd stop. Don't stop early to be efficient, and don't carry on to be helpful.
- **Track your fun as you go.** At the end of each session (each time you put the phone down for 10+ minutes), note a fun score from 1 to 5 and one line on why. You'll need these for the report.

## Controls
Use Bash with curl against `http://localhost:PORT`:
- `curl -s localhost:PORT/look` takes a screenshot and returns its path, how long you've played, and **what you can hear** (the game's music, described in words, since you can't hear audio). Then Read the png.
- `curl -s localhost:PORT/listen` tells you what you can hear right now.
- `curl -s localhost:PORT/buttons` lists the tappable things on screen, with x,y centres and labels.
- `curl -s "localhost:PORT/tap?x=195&y=802&n=10"` taps a point n times (1–50).
- `curl -s "localhost:PORT/hold?x=..&y=..&ms=1500"` presses and holds.
- `curl -s "localhost:PORT/swipe?x0=..&y0=..&x1=..&y1=.."` scrolls (vertical swipes) or drags.
- `curl -s "localhost:PORT/wait?s=600"` puts the phone down with the app still open (max 1800).
- `curl -s "localhost:PORT/away?s=3600"` closes the app and reopens it later (120 to 43200 s). This is how real breaks happen: lunch, a commute, overnight. Take real breaks the way your persona would, and at least three times over the test.
- `curl -s "localhost:PORT/quit?why=short+reason"` must be called once, when you stop.

## Limits
- Stop at 900 game minutes (15 hours, away time included; `look` shows it) or about 550 tool calls, whichever comes first. Say which stopped you.
- Use long waits (900–1800 s) freely when nothing needs you; each costs only one call.
- Write files only with Bash (`cat > file <<'EOF' ... EOF`). The Write tool may be blocked.

## The report: OUTDIR/report.md, first person, in your persona's voice
1. **Stop point:** played minutes, and why (quit, cap or tool limit).
2. **Fun curve:** a small table with one row per session: played minute, fun 1–5, one line why.
3. **What was fun:** the three moments or mechanics you enjoyed most. For each, say WHY it was fun for someone like you: discovery, mastery, story, mystery, anticipation, optimising, a sense of growth, a surprise.
4. **What wasn't fun:** the three worst moments. For each, say why: boredom, confusion, unfairness, waiting with nothing to decide, repetition, feeling lost, friction.
5. **The voice and the sound:** did they add to the fun? Quote lines that stuck. If music played, did it make the moment feel bigger, or change how you felt about waiting?
6. **How far I got:** describe the biggest change in the game you saw. Did it ever become something different? When?
7. **Coming back:** what it was like each time you reopened the app after a break. Did it feel worth coming back to?
8. **Would I keep playing tomorrow?** Yes, maybe or no, and the honest reason.
9. **The one change that would make it more fun for me.**

Then reply with only: stop point and why, average fun score, the single most fun thing, the single least fun thing, and "keep playing tomorrow: yes/maybe/no", in 5 lines.
