#!/usr/bin/env node
// Screenshot harness for review passes. Boots dist/index.html in headless Chromium at phone and
// desktop widths, plays the simulation into a set of named states, and writes PNGs a reviewer can
// look at side by side.
//
//   node game/shoot.mjs [outDir]
//
// States are driven through the debug hooks the game exposes on window.HY, never by poking at
// internals, so this stays honest about what the player would actually see.
//
// Two things this used to get wrong, both of which made the contact sheet a lie:
//
//   1. A state was a wall-clock marker — "06-act3, 420 minutes" — and 420 minutes of the reference
//      player is not Act III, it is late Act II. Every act-labelled shot photographed the previous
//      act. A state is now a *predicate on the game's own state*, played until it holds, and a
//      state that never holds is reported as a failure rather than shot anyway.
//   2. It replayed from cold boot for every state × viewport × theme: twenty-four runs, the
//      longest of them seven simulated hours. The run is now played once, exporting a save at each
//      milestone, and the twenty-four shots are imports of those saves. Same pictures, one run.

import { chromium } from '@playwright/test'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(process.argv[2] || join(ROOT, 'shots'))
mkdirSync(OUT, { recursive: true })

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const html = readFileSync(join(ROOT, 'dist/index.html'))

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(html)
}).listen(0)
const port = server.address().port

const PHONE = { width: 390, height: 844 }
const DESK = { width: 1280, height: 900 }

// `want` is evaluated in the page against the live state and is the definition of the state; `soft`
// marks a state the reference player is not guaranteed to reach, which is photographed if it
// arrives and reported as missing if it does not, rather than failing the run.
// `minSec` holds the run at least that long first, for states that are about elapsed time rather
// than about progress — the opening two are the only ones like that.
const STATES = [
  { name: '01-first-touch', minSec: 0, want: 's.act === 1' },
  { name: '02-early', minSec: 360, want: 's.act === 1' },
  { name: '03-act1-late', minSec: 2700, want: 's.act === 1 && s.res.biomass > 1e5' },
  { name: '04-act2-open', minSec: 0, want: 's.act === 2' },
  { name: '05-act2-deep', minSec: 0, want: 's.act === 2 && HY.forest.forestConsumed(s) >= 0.5' },
  { name: '06-act3', minSec: 0, want: 's.act === 3' },
  { name: '07-act3-void', minSec: 0, want: "s.act === 3 && s.phase === 'void'", soft: true },
]

// A single simulated minute per step, so a state is caught within a minute of becoming true rather
// than being overshot by an hour.
const STEP_S = 60
const MAX_SIM_S = 20 * 3600

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-proxy-server'] })
const errors = []

// ── one playthrough, one save per state ──────────────────────────────────────
const runCtx = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true })
const runPage = await runCtx.newPage()
runPage.on('pageerror', (e) => errors.push(`play: ${e.message}`))
runPage.on('console', (m) => { if (m.type() === 'error') errors.push(`play: console ${m.text()}`) })
await runPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
await runPage.waitForTimeout(1200)

const saves = await runPage.evaluate(({ states, stepS, maxS }) => {
  const HY = window.HY
  const S = () => HY.state.state
  const tests = states.map((st) => ({
    ...st,
    fn: new Function('s', 'HY', 'return (' + st.want + ')'),
  }))
  const out = []
  let i = 0
  const t0 = S().t
  for (let guard = 0; guard * stepS < maxS && i < tests.length; guard++) {
    const st = tests[i]
    if (S().t - t0 >= st.minSec && st.fn(S(), HY)) {
      out.push({ name: st.name, t: S().t, act: S().act, phase: S().phase, b64: HY.state.exportB64() })
      i++
      continue
    }
    // Play it, do not merely age it: Act I produces nothing until something is extended, so
    // fast-forwarding alone photographs an empty game.
    HY.debug.play(stepS, { tapsPerSec: 2 })
  }
  for (; i < tests.length; i++) out.push({ name: tests[i].name, missing: true, soft: !!tests[i].soft })
  return out
}, { states: STATES.map(({ name, minSec, want, soft }) => ({ name, minSec, want, soft: !!soft })), stepS: STEP_S, maxS: MAX_SIM_S })
await runCtx.close()

const missing = saves.filter((s) => s.missing)
const hardMissing = missing.filter((s) => !s.soft)
for (const s of saves) {
  if (s.missing) console.log(`${s.missing && s.soft ? 'skip' : 'MISS'} ${s.name} — never reached`)
  else console.log(`ok   ${s.name} — act ${s.act}/${s.phase} at ${(s.t / 60).toFixed(1)} min`)
}

// ── the shots, from the saves ────────────────────────────────────────────────
for (const theme of ['dark', 'light']) {
  for (const [viewName, viewport] of [['phone', PHONE], ['desk', DESK]]) {
    for (const shot of saves) {
      if (shot.missing) continue
      const ctx = await browser.newContext({
        viewport, deviceScaleFactor: 2, hasTouch: true,
        isMobile: viewName === 'phone', colorScheme: theme,
      })
      const page = await ctx.newPage()
      page.on('pageerror', (e) => errors.push(`${shot.name}/${viewName}/${theme}: ${e.message}`))
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${shot.name}/${viewName}/${theme}: console ${m.text()}`) })
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
      await page.waitForTimeout(1000)
      const loaded = await page.evaluate((b) => !!window.HY.state.importB64(b), shot.b64)
      if (!loaded) errors.push(`${shot.name}/${viewName}/${theme}: save did not import`)
      // A frame or two so the canvas and the readouts redraw against the imported state.
      await page.waitForTimeout(1200)
      await page.screenshot({ path: join(OUT, `hy-${shot.name}-${viewName}-${theme}.png`) })
      await ctx.close()
    }
  }
}

await browser.close()
server.close()

if (errors.length) {
  console.error('RUNTIME ERRORS:')
  for (const e of errors) console.error('  ' + e)
} else {
  console.log('no runtime errors')
}
console.log('shots written to ' + OUT)
process.exit(errors.length || hardMissing.length ? 1 : 0)
