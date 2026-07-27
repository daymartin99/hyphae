#!/usr/bin/env node
// Screenshot harness for review passes. Boots dist/index.html in headless
// Chromium at phone and desktop widths, fast-forwards the simulation into a
// set of named states, and writes PNGs a reviewer can look at side by side.
//
//   node game/shoot.mjs [outDir]
//
// States are driven through the debug hooks the game exposes on window.HY,
// never by poking at internals, so this stays honest about what the player
// would actually see.

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

// Each state is a minutes-into-a-playthrough marker; the game's own debug
// fast-forward advances the real simulation rather than faking a save.
const STATES = [
  ['01-first-touch', 0],
  ['02-early', 6],
  ['03-act1-late', 45],
  ['04-act2-open', 110],
  ['05-act2-deep', 240],
  ['06-act3', 420],
]

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-proxy-server'] })
const errors = []

for (const [viewName, viewport] of [['phone', PHONE], ['desk', DESK]]) {
  for (const [name, minutes] of STATES) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: viewName === 'phone' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`${name}/${viewName}: ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}/${viewName}: console ${m.text()}`) })
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
    await page.waitForTimeout(1200)
    if (minutes > 0) {
      await page.evaluate((m) => window.HY?.debug?.fastForward?.(m * 60), minutes)
      await page.waitForTimeout(1500)
    }
    await page.screenshot({ path: join(OUT, `hy-${name}-${viewName}.png`) })
    await ctx.close()
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
process.exit(errors.length ? 1 : 0)
