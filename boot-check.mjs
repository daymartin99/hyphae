#!/usr/bin/env node
// Boots the built game headlessly and reports what a player would actually get:
// runtime errors, the cold-boot screen inventory (BIBLE D02), the measured time
// to first automation (D05), and the combined module self-tests.

import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
// Serve the whole dist directory, not just the document: the page registers
// dist/sw.js and links dist/manifest.webmanifest, and a server that answered
// every path with HTML would hide any breakage in that wiring from this check.
const MIME = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript',
  webmanifest: 'application/manifest+json',
  png: 'image/png',
}
const server = createServer((q, r) => {
  const name = q.url.split('?')[0].replace(/^\/+/, '') || 'index.html'
  try {
    const body = readFileSync(join(ROOT, 'dist', name))
    r.writeHead(200, { 'content-type': MIME[name.split('.').pop()] || 'application/octet-stream' })
    r.end(body)
  } catch {
    r.writeHead(404)
    r.end()
  }
}).listen(0)
const port = server.address().port

const browser = await chromium.launch({
  executablePath: process.env.HY_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-proxy-server'],
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
await page.waitForTimeout(2000)

const booted = await page.evaluate(() => ({
  hasHY: !!window.HY,
  modules: Object.keys(window.HY || {}),
  running: !!(window.HY && window.HY.loop && window.HY.loop.running),
  ticks: window.HY?.loop?.ticks ?? -1,
  act: window.HY?.state?.state?.act,
  appChildren: document.getElementById('app')?.children.length ?? -1,
  bodyText: (document.body.innerText || '').slice(0, 500),
}))

// The shipped page carries no self-tests (build.mjs stripTests), so they run on the test build:
// the same minified program with the tests left in, booted in a context of its own. Its own,
// and with workers blocked: the shipped page's service worker answers every navigation in its
// scope from the cached document, so a page beside it asking for index.test.html gets index.html.
const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' })
const tpage = await tctx.newPage()
tpage.on('pageerror', (e) => errors.push('test build pageerror: ' + e.message))
tpage.on('console', (m) => { if (m.type() === 'error') errors.push('test build console: ' + m.text()) })
await tpage.goto(`http://127.0.0.1:${port}/index.test.html`, { waitUntil: 'load' })
await tpage.waitForTimeout(2000)
const selftest = await tpage.evaluate(() => {
  try { return window.HY.debug.selftest() } catch (e) { return ['selftest THREW: ' + e.message] }
})
await tctx.close()

// The redesign's skeleton (docs/design/10), booted behind its switch: every slot present, in order
// top to bottom, none overlapping, the body window at its fixed share, and the primary verb inside
// the bottom 200 px (06 §0.1 rule 2, 10 D4). Its own context, so the switch is not remembered.
const dctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' })
const dpage = await dctx.newPage()
dpage.on('pageerror', (e) => errors.push('ui=d pageerror: ' + e.message))
await dpage.goto(`http://127.0.0.1:${port}/?ui=d`, { waitUntil: 'load' })
await dpage.waitForTimeout(1500)
const skeleton = await dpage.evaluate(() => {
  const f = []
  const q = (c) => document.querySelector('.shell ' + c)
  const slots = ['.ledger', '.plate', '.console', '.next', '.panels', '.hero']
  const r = slots.map((c) => { const n = q(c); return n ? n.getBoundingClientRect() : null })
  slots.forEach((c, i) => { if (!r[i] || r[i].height <= 0) f.push(c + ' is missing or empty') })
  if (f.length) return f
  for (let i = 1; i < r.length; i++) {
    if (r[i].top < r[i - 1].bottom - 0.5) f.push(slots[i] + ' overlaps or precedes ' + slots[i - 1])
  }
  const h = document.querySelector('.shell').clientHeight
  const want = Math.round(h * 212 / 844)
  if (Math.abs(r[1].height - want) > 2) f.push('body window is ' + r[1].height + ' px, want ' + want)
  if (h - r[5].bottom > 200) f.push('the primary verb is ' + Math.round(h - r[5].bottom) + ' px off the foot')
  if (document.documentElement.dataset.ui !== 'd') f.push('?ui=d did not switch the interface on')
  return f
})
await dctx.close()

// D05: cold boot, tap as a player would, find when the first automation is affordable.
const d05 = await page.evaluate(() => {
  try {
    const HY = window.HY
    const s = HY.state.state
    const dt = HY.core.TUNE.CLOCK.DT_A1
    const steps = Math.round(1 / dt)
    for (let sec = 0; sec <= 180; sec++) {
      // A real cold start is thumb work: roughly three taps a second.
      for (let k = 0; k < 3; k++) HY.act1.onExtend?.()
      for (let k = 0; k < steps; k++) HY.loop.simTick(dt, { stochastic: true, offline: false })
      if (HY.act1.tipCost && s.res.biomass >= HY.act1.tipCost()) {
        return { sec, cost: HY.act1.tipCost(), biomass: s.res.biomass }
      }
    }
    return { sec: -1 }
  } catch (e) { return { error: e.message } }
})

console.log('=== BOOT ===')
console.log(JSON.stringify(booted, null, 1))
console.log('\n=== D05 first automation ===')
console.log(JSON.stringify(d05))
console.log('\n=== D SKELETON ===', skeleton.length ? skeleton.length + ' faults' : 'holds')
skeleton.forEach((x) => console.log('  - ' + x))
console.log('\n=== SELFTEST ===', selftest.length, 'failures')
selftest.slice(0, 30).forEach((s) => console.log('  - ' + s))
console.log('\n=== RUNTIME ERRORS ===', errors.length)
errors.slice(0, 20).forEach((e) => console.log('  - ' + e))

await browser.close()
server.close()
