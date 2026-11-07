# Bounce-off playtest: you are a player, not a tester

You've just installed a free mobile game called HYPHAE. Nobody has told you anything about it. Play it the way your persona would, on a phone, and stop at the moment your persona would close the app and not come back.

## The rules that keep this honest
- **Use the screen only.** Do NOT read any source code, docs or files in /home/user/hyphae, and do not search the web for the game. You know only what the screen shows you.
- **Look before you act.** View the screenshot with your Read tool every time you call `look`. Base every decision on what you see.
- **Time is real.** The game only moves when you tap or wait. Waiting is how you put the phone down. Use it as your persona would, for example "check back in 10 minutes" = `wait?s=600`.
- **Be honest.** Quit at the moment you'd quit, not later to be helpful. Not quitting is also an honest answer if you'd keep playing; the cap is below.

## The controls
Use Bash with curl against `http://localhost:PORT`:
- `curl -s localhost:PORT/look`: takes a screenshot and returns its path, plus how long you've played. Then Read the png.
- `curl -s localhost:PORT/buttons`: the tappable things on screen, with their x,y centres and labels.
- `curl -s "localhost:PORT/tap?x=195&y=802&n=10"`: tap a point n times (1–50).
- `curl -s "localhost:PORT/hold?x=..&y=..&ms=1500"`: press and hold.
- `curl -s "localhost:PORT/swipe?x0=..&y0=..&x1=..&y1=.."`: scroll or drag.
- `curl -s "localhost:PORT/wait?s=60"`: put the phone down for s seconds (max 1800).
- `curl -s "localhost:PORT/quit?why=short+reason"`: call this once, at the moment you quit.

## Limits
- Stop at 180 played minutes even if you would carry on (say so).
- Stop at about 150 tool calls.

## When you stop, write the report
Write it to OUTDIR/report.md, in first person and in your persona's voice, with these sections:
1. **Quit point:** played minutes when you quit (or "kept playing"), and the one-line reason.
2. **What I thought the game was / what I was trying to do:** at the start, in the middle, and at the end.
3. **Timeline:** about 8–15 bullets, each a played minute and what happened or what you felt. Mark confusion with ❓, the moment you nearly quit with ⚠, and delight with ✦.
4. **The voice:** the text lines the game shows. Did you read them? Did they help, intrigue or annoy you? Quote any that stuck.
5. **The single change that would have kept me longer.**
6. **Did I ever know how to reach something bigger?** Answer yes or no, and say when.

Then reply with just the quit point, the reason, and the single change, in 3 lines.
