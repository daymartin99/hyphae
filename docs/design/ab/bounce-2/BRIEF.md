# Invested-player playtest: you are a player, not a tester

You've just installed a free mobile game called HYPHAE on a friend's recommendation: "a strange, literary idle game about a fungus. Stick with it." You intend to give it a real go over an evening or two. Play it the way your persona would and stop when your persona would genuinely stop, or at the cap.

## The rules that keep this honest
- **Use the screen only.** Do NOT read any source code, docs or files in /home/user/hyphae, and do not search the web. You know only what the screen shows you.
- **View every screenshot** with your Read tool each time you call `look`. Base every decision on it.
- **Time only moves when you tap or wait.** Waiting is putting the phone down: `wait?s=600` means "check back in 10 minutes". Play sessions the way your persona would.
- **Be honest.** Stop when you'd stop. Don't stop early to be efficient, and don't carry on to be helpful.

## The controls
Use Bash with curl against `http://localhost:PORT`:
- `curl -s localhost:PORT/look`: takes a screenshot, returns its path and how long you've played. Then Read the png.
- `curl -s localhost:PORT/buttons`: the tappable things on screen, with x,y centres and labels.
- `curl -s "localhost:PORT/tap?x=195&y=802&n=10"`: taps a point n times (1–50).
- `curl -s "localhost:PORT/hold?x=..&y=..&ms=1500"`: press and hold.
- `curl -s "localhost:PORT/swipe?x0=..&y0=..&x1=..&y1=.."`: scroll or drag.
- `curl -s "localhost:PORT/wait?s=600"`: put the phone down (max 1800).
- `curl -s "localhost:PORT/quit?why=short+reason"`: call this once, when you stop.

## Limits
- **Cap:** stop at 360 played minutes (6 hours), or after about 280 tool calls, whichever comes first. Say which stopped you.
- **Writing:** write files only with Bash (for example `cat > file <<'EOF' ... EOF`). The Write tool may be blocked.

## When you stop, write the report to OUTDIR/report.md
Write it in first person, in your persona's voice:
1. **Stop point:** played minutes, and why (quit, cap, or tool limit).
2. **How far I got:** describe the biggest change of scale or interface you saw, if any. Did the game ever become something different? When?
3. **Timeline:** 10–20 bullets of played minute plus what happened or what you felt. Mark ❓ confusion, ⚠ nearly stopped, ✦ delight, ◆ a moment of mystery or intrigue.
4. **Mystery vs clarity:**
   - **Mystery score, 1–5.** Did the game stay mysterious once you understood how to play it? Did understanding the controls ever spoil the intrigue? Give examples.
   - **Clarity score, 1–5.** Did you always know what you *could* do and what each control did? Give examples of the worst friction.
   - **The difference.** Which confusions felt like intended mystery, and which felt like a broken or unclear interface?
5. **The voice:** quote the lines that stuck. Did it help, mislead or annoy you? Who or what did you think was speaking?
6. **The single change that would make me play more hours.**

Then reply with just: the stop point and why, the mystery score, the clarity score, and the single change, in 4 lines.
