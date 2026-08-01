#!/usr/bin/env node
// The console-placement A/B. Six shots: two variants x three moments, 390x844 dark.
//
//   node game/shoot-console.mjs [outDir]
//
// The run is played once and exported at each milestone, then imported into a fresh page per
// variant, so the two variants photograph the same game rather than two different ones. The
// variant is chosen on the way in with ?console=, so neither shot has a first paint in the other
// placement. shoot.mjs is the general contact sheet; this is the one question it cannot answer,
// because it photographs one build and this is two.

import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(process.argv[2] || join(ROOT, 'docs', 'design', 'console-ab'))
mkdirSync(OUT, { recursive: true })

const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', webmanifest: 'application/manifest+json', png: 'image/png' }
const server = createServer((q, r) => {
  const name = q.url.split('?')[0].replace(/^\/+/, '') || 'index.html'
  try {
    const body = readFileSync(join(ROOT, 'dist', name))
    r.writeHead(200, { 'content-type': MIME[name.split('.').pop()] || 'application/octet-stream' })
    r.end(body)
  } catch { r.writeHead(404); r.end() }
}).listen(0)
const port = server.address().port

const PHONE = { width: 390, height: 844 }
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const MOMENTS = [
  { name: '1-first-touch', sec: 0 },
  { name: '2-six-min', sec: 360 },
  { name: '3-forty-five-min', sec: 2700 },
]

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-proxy-server'] })
const errors = []

// ── one playthrough, one save per moment ────────────────────────────────────
const runCtx = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true })
const runPage = await runCtx.newPage()
runPage.on('pageerror', (e) => errors.push('play: ' + e.message))
runPage.on('console', (m) => { if (m.type() === 'error') errors.push('play: console ' + m.text()) })
await runPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
await runPage.waitForTimeout(1200)

const saves = await runPage.evaluate((moments) => {
  const HY = window.HY
  const out = []
  let played = 0
  for (const m of moments) {
    if (m.sec > played) { HY.debug.play(m.sec - played, { tapsPerSec: 2 }); played = m.sec }
    out.push({ name: m.name, sec: m.sec, t: HY.state.state.t, act: HY.state.state.act, b64: m.sec ? HY.state.exportB64() : null })
  }
  return out
}, MOMENTS)
await runCtx.close()
for (const s of saves) console.log(`ok  ${s.name} — act ${s.act} at ${(s.t / 60).toFixed(1)} min`)

// ── the shots ───────────────────────────────────────────────────────────────
const written = []
for (const variant of ['bottom', 'top']) {
  for (const shot of saves) {
    const ctx = await browser.newContext({
      viewport: PHONE, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'dark',
    })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`${variant}/${shot.name}: ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${variant}/${shot.name}: console ${m.text()}`) })
    await page.goto(`http://127.0.0.1:${port}/?console=${variant}`, { waitUntil: 'load' })
    await page.waitForTimeout(1200)
    const placed = await page.evaluate(() => window.HY.ui.consolePos())
    if (placed !== variant) errors.push(`${variant}/${shot.name}: placement is ${placed}`)
    if (shot.b64) {
      const loaded = await page.evaluate((b) => !!window.HY.state.importB64(b), shot.b64)
      if (!loaded) errors.push(`${variant}/${shot.name}: save did not import`)
      await page.waitForTimeout(1400)
    }
    const path = join(OUT, `console-${variant}-${shot.name}.png`)
    await page.screenshot({ path })
    written.push(path)
    await ctx.close()
  }
}

await browser.close()
server.close()
console.log('\n' + written.join('\n'))
if (errors.length) {
  console.error('\nRUNTIME ERRORS:')
  for (const e of errors) console.error('  ' + e)
}
process.exit(errors.length ? 1 : 0)
