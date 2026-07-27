#!/usr/bin/env node
// Bundles the game into a single self-contained HTML file with zero external
// requests, so it can be dropped anywhere: a static host, a file:// URL, or a
// published artifact behind a strict CSP.
//
// The source is deliberately plain <script> files sharing one global namespace
// rather than ES modules, which makes "bundling" an ordered concatenation. No
// dependencies, no transpiler, nothing to keep up to date.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

// Load order is the dependency order. Keep it explicit.
const ORDER = JSON.parse(read('order.json'))

const css = ORDER.css.map((f) => `/* ${f} */\n${read(f)}`).join('\n\n')
const js = ORDER.js.map((f) => `/* ${f} */\n${read(f)}`).join('\n;\n')

const shell = read('shell.html')
const sw = existsSync(join(ROOT, 'sw.js')) ? read('sw.js') : ''
const manifest = read('manifest.webmanifest')

// The service worker and manifest ride along as data: URLs so the single file
// still installs as a PWA when served from a host that only gives us one path.
const manifestUrl = 'data:application/manifest+json;base64,' + Buffer.from(manifest).toString('base64')

const out = shell
  .replace('<!--STYLES-->', `<style>\n${css}\n</style>`)
  .replace('<!--SCRIPTS-->', `<script>\n${js}\n</script>`)
  .replace('<!--MANIFEST-->', `<link rel="manifest" href="${manifestUrl}">`)
  .replace('<!--SW-->', sw ? `<script>window.__SW_SOURCE=${JSON.stringify(sw)}</script>` : '')

mkdirSync(join(ROOT, 'dist'), { recursive: true })
writeFileSync(join(ROOT, 'dist/index.html'), out)

const kb = (Buffer.byteLength(out) / 1024).toFixed(1)
console.log(`built game/dist/index.html — ${kb} KB (${ORDER.js.length} modules, ${ORDER.css.length} stylesheets)`)
if (Buffer.byteLength(out) > 900 * 1024) console.warn('WARNING: bundle over 900 KB, first paint will suffer')
