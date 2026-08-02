#!/usr/bin/env node
// Sweep every visible number in the ledger strip across all three acts and print
// mantissa | unit exactly as the DOM holds them.
import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

const ROOT = dirname(fileURLToPath(import.meta.url))
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', webmanifest: 'application/manifest+json', png: 'image/png' }
const server = createServer((req, res) => {
  const name = req.url.split('?')[0].replace(/^\/+/, '') || 'index.html'
  try {
    const body = readFileSync(join(ROOT, 'dist', name))
    res.writeHead(200, { 'content-type': MIME[name.split('.').pop()] || 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(404); res.end() }
}).listen(0)
const port = server.address().port

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-proxy-server'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
await page.waitForTimeout(1200)

const dump = () => page.evaluate(() => {
  const s = window.HY.state.state
  const rows = [...document.querySelectorAll('.ledger-row')].filter(r => !r.hidden).map(r => {
    const g = (sel) => { const n = r.querySelector(sel); return n ? { m: n.querySelector('.mant')?.textContent, u: n.querySelector('.unit')?.textContent, raw: n.innerText } : null }
    return { lab: r.querySelector('.ledger-lab')?.textContent, val: g('.ledger-val'), rate: g('.ledger-rate') }
  })
  const subs = [...document.querySelectorAll('.ledger-sub')].filter(n => !n.hidden).map(n => n.innerText)
  return { act: s.act, phase: s.phase, t: Math.round(s.t), rows, subs }
})

const out = []
out.push(await dump())
const steps = [
  ['act1-late', "s.act === 1 && s.res.cumBiomass > 1e5"],
  ['act2', 's.act === 2'],
  ['act2-deep', 's.act === 2 && HY.forest.forestConsumed(s) >= 0.5'],
  ['act3', 's.act === 3'],
  ['act3-void', "s.act === 3 && s.phase === 'void'"],
]
for (const [name, want] of steps) {
  const reached = await page.evaluate(({ want }) => {
    const HY = window.HY, S = () => HY.state.state
    const fn = new Function('s', 'HY', 'return (' + want + ')')
    for (let i = 0; i < 20 * 60 && !fn(S(), HY); i++) HY.debug.play(60, { tapsPerSec: 2 })
    return fn(S(), HY)
  }, { want })
  const d = await dump()
  d.name = name
  d.reached = reached
  out.push(d)
}

console.log(JSON.stringify(out, null, 1))
if (errs.length) { console.error('ERRORS'); errs.forEach(e => console.error('  ' + e)) }
await browser.close(); server.close()
