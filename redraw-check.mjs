#!/usr/bin/env node
// Redraw budget check. Boots dist/index.html headless at 1280×900 and counts real repaints —
// clearRect on the canvas itself, not calls into canvas.js — of the three surfaces that are asked
// for every display frame: the Act II hex map, the Act III void, and the phase wheel.
//
//   node redraw-check.mjs            # HY_CHROME=<chromium> as for the other harnesses
//   REDRAW_FRESH=1 node redraw-check.mjs   # replay the saves instead of using the cache
//
// The self-tests prove the gates in canvas.js work; this proves ui.js still goes through them. For
// each surface, with and without reduced motion:
//
//   idle    the sim is frozen, so nothing on the surface can change: it must not repaint at all
//   churn   its data changes every frame: the plate must still repaint, at no more than CANVAS_HZ;
//           the wheel must keep the frame rate, because its dots moving is the reading
//   change  a data change and a theme flip must both reach the pixels
//
// The sim is frozen by stopping HY.loop and driving HY.ui.render from a rAF here — the same call
// the loop's own frame makes, minus the simulation. Reaching the wheel means playing a run for a
// few simulated hours, so the saves are cached in .redraw-saves.json (ignored by git) and replayed
// whenever the cache is missing or a save no longer imports.

import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const CACHE = join(ROOT, '.redraw-saves.json')
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', webmanifest: 'application/manifest+json', png: 'image/png' }
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
const URL = `http://127.0.0.1:${server.address().port}/`

const browser = await chromium.launch({
  executablePath: process.env.HY_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-proxy-server'],
})

// Budgets, per second. CANVAS_HZ is 4; the churn ceiling leaves room for a frame landing either
// side of the 3 s window, and the floor proves the change was drawn at all.
const PLATE_CHURN = [2, 5]
const WHEEL_CHURN_MIN = 20
const WINDOW_MS = 3000

const errors = []
const failures = []
const check = (cond, msg) => { if (!cond) failures.push(msg) }

// ── the saves ────────────────────────────────────────────────────────────────
async function playSaves () {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`play: ${e.message}`))
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForTimeout(1000)
  const out = await page.evaluate(() => {
    const HY = window.HY
    const S = () => HY.state.state
    const o = {}
    for (let g = 0; g < 20 * 60 && !o.wheel; g++) {
      const s = S()
      if (!o.map && s.act === 2 && HY.forest.forestConsumed(s) >= 0.25) o.map = HY.state.exportB64()
      if (!o.void && s.act === 3 && s.phase === 'void') o.void = HY.state.exportB64()
      const w = HY.finale.wheel(s)
      if (w && w.live) o.wheel = HY.state.exportB64()
      HY.debug.play(60, { tapsPerSec: 2 })
    }
    return o
  })
  await ctx.close()
  return out
}

let saves = null
if (!process.env.REDRAW_FRESH && existsSync(CACHE)) {
  try { saves = JSON.parse(readFileSync(CACHE, 'utf8')) } catch { saves = null }
}

// ── one surface, one motion preference ──────────────────────────────────────
async function measure (kind, b64, reduce) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: reduce ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  const tag = `${kind}/${reduce ? 'reduced' : 'motion'}`
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: console ${m.text()}`) })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForTimeout(800)
  if (!await page.evaluate((b) => !!window.HY.state.importB64(b), b64)) {
    await ctx.close()
    return null
  }
  await page.waitForTimeout(1000)
  if (kind === 'wheel') {
    // The wheel lives in one of Act III's tabs; open each until it is on screen.
    for (const t of await page.$$('[role=tab]')) {
      await t.click()
      await page.waitForTimeout(300)
      if (await page.evaluate(() => { const w = document.getElementById('wheel'); return !!(w && w.clientHeight > 0) })) break
    }
  }
  const r = await page.evaluate(async ({ kind, windowMs }) => {
    const HY = window.HY
    const wait = (ms) => new Promise((res) => setTimeout(res, ms))
    const el = document.getElementById(kind === 'wheel' ? 'wheel' : 'net')
    if (!el || !el.clientHeight) return { error: `#${el ? el.id : kind} is not on screen` }
    const s = HY.state.state

    // Freeze the sim; keep the frame.
    HY.loop.stop()
    let live = true
    let mutate = null
    const frame = () => {
      if (!live) return
      if (mutate) mutate()
      HY.ui.render(HY.state.state)
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)

    let paints = 0
    const cr = CanvasRenderingContext2D.prototype.clearRect
    CanvasRenderingContext2D.prototype.clearRect = function () {
      if (this.canvas === el) paints++
      return cr.apply(this, arguments)
    }
    const count = async (ms) => { paints = 0; await wait(ms); return paints * 1000 / ms }
    const snap = () => el.getContext('2d').getImageData(0, 0, el.width, el.height).data
    const diff = (a, b) => {
      let n = 0
      for (let i = 0; i < a.length; i += 4) {
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++
      }
      return n
    }

    // A reload regrows the Act I network under the plate in steps; that is a real change and is
    // drawn. Idle begins once a whole second goes by without a repaint.
    let settled = false
    for (let i = 0; i < 12 && !settled; i++) settled = (await count(1000)) === 0
    const idle = await count(windowMs)

    // Churn: one datum moved every frame, by more than the gates' quantum.
    let k = 0
    if (kind === 'map') {
      const R = s.a2.regions
      mutate = () => { k++; R.col[0] = (k % 64) / 64 }
    } else if (kind === 'void') {
      const B = s.a3.bands
      mutate = () => { k++; B.e[0] = (k % 64) / 64 }
    } else {
      const P = s.a3.bands.phase
      mutate = () => { k++; P[0] = (k % 64) / 64 }
    }
    const churn = await count(windowMs)
    mutate = null
    await wait(400)

    // Change: flip the data wholesale, then the theme; both must reach the pixels.
    let before = snap()
    if (kind === 'map') {
      const R = s.a2.regions
      for (let j = 0; j < R.flags.length; j++) R.flags[j] ^= 1
    } else if (kind === 'void') {
      const B = s.a3.bands
      for (let b = 0; b < B.e.length; b++) B.e[b] = B.e[b] > 0.5 ? 0.1 : 0.9
    } else {
      const P = s.a3.bands.phase
      for (let b = 0; b < P.length; b++) P[b] = (P[b] + 0.25) % 1
    }
    await wait(600)
    const dataPx = diff(before, snap())
    before = snap()
    const root = document.documentElement
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light'
    await wait(600)
    const themePx = diff(before, snap())

    live = false
    return { settled, idle, churn, dataPx, themePx, phase: s.phase }
  }, { kind, windowMs: WINDOW_MS })
  await ctx.close()
  return r
}

async function runAll () {
  const rows = []
  for (const kind of ['map', 'void', 'wheel']) {
    for (const reduce of [false, true]) {
      const r = await measure(kind, saves[kind], reduce)
      if (r === null) return null
      rows.push({ kind, reduce, r })
    }
  }
  return rows
}

let rows = saves && saves.map && saves.void && saves.wheel ? await runAll() : null
if (!rows) {
  console.log('playing a run for the saves (a few minutes)…')
  saves = await playSaves()
  for (const k of ['map', 'void', 'wheel']) {
    if (!saves[k]) {
      console.error(`FAIL the reference run never reached the ${k} state`)
      await browser.close(); server.close(); process.exit(1)
    }
  }
  writeFileSync(CACHE, JSON.stringify(saves))
  rows = await runAll()
  if (!rows) {
    console.error('FAIL a freshly played save did not import')
    await browser.close(); server.close(); process.exit(1)
  }
}

for (const { kind, reduce, r } of rows) {
  const tag = `${kind}/${reduce ? 'reduced' : 'motion'}`
  if (r.error) { failures.push(`${tag}: ${r.error}`); continue }
  console.log(`${tag.padEnd(14)} idle ${r.idle.toFixed(1)}/s  churn ${r.churn.toFixed(1)}/s  ` +
    `data ${r.dataPx} px  theme ${r.themePx} px`)
  check(r.settled, `${tag}: never went a whole second without a repaint on a frozen sim`)
  check(r.idle === 0, `${tag}: repainted ${r.idle.toFixed(1)}/s with nothing changing`)
  if (kind === 'wheel') {
    check(r.churn >= WHEEL_CHURN_MIN, `${tag}: a moving dot repainted only ${r.churn.toFixed(1)}/s — the wheel lost the frame rate`)
  } else {
    check(r.churn >= PLATE_CHURN[0], `${tag}: changing data repainted only ${r.churn.toFixed(1)}/s`)
    check(r.churn <= PLATE_CHURN[1], `${tag}: changing data repainted ${r.churn.toFixed(1)}/s, over CANVAS_HZ`)
  }
  check(r.dataPx > 0, `${tag}: a data change never reached the pixels`)
  check(r.themePx > 0, `${tag}: a theme flip never reached the pixels`)
}

await browser.close()
server.close()

if (errors.length) {
  console.error('RUNTIME ERRORS:')
  for (const e of errors) console.error('  ' + e)
}
if (failures.length) {
  console.error('FAILURES:')
  for (const f of failures) console.error('  ' + f)
} else {
  console.log('redraw budget holds')
}
process.exit(errors.length || failures.length ? 1 : 0)
