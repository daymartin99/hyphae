#!/usr/bin/env node
// Bundles the game into one self-contained HTML file with zero external
// requests, so it can be dropped anywhere: a static host, a file:// URL, or a
// published artifact behind a strict CSP. Next to it the build writes the PWA
// sidecar files — sw.js, manifest.webmanifest and two icon PNGs rendered from
// the mark at build time — because Chrome rejects blob: service workers and
// cannot resolve start_url or scope from a data: manifest, so offline support
// and installability require real sibling files. The page only points at them
// over http(s); a lone index.html copied to a file:// URL still plays.
//
// The source is deliberately plain <script> files sharing one global namespace
// rather than ES modules, which makes "bundling" an ordered concatenation. No
// dependencies, no transpiler, nothing to keep up to date.
//
// The shipped file is minified by the lexer below rather than by a third-party
// tool, because a dependency-free build is worth more here than the last few
// percent a real compressor would find. What it does is deliberately narrow:
//
//   · comments and redundant whitespace go
//   · numeric literals take their shortest spelling of the same value
//   · true/false become !0/!1 where that is unambiguously an expression
//   · a name that a module declares, never uses as a property, and never spells
//     out in a string gets a short one instead (see LOCAL RENAMING for why that
//     needs no scope analysis to be safe)
//
// It never touches a property name, never reorders anything, never removes a
// statement. Two checks run on every build and the build fails if either does:
// the emitted text is re-lexed and compared token for token against what the
// emitter was handed, and the whole script is handed to the engine's parser, so
// a missing separator is a build error and not a black screen. The third check
// cannot live in a build script and has to be run by hand: the readable build
// and the shipped build must reach a byte-identical HY.state after the same
// HY.debug.play(), which is what actually proves the two are the same program.
//
//   node game/build.mjs              → dist/{index.html, index.dev.html, sw.js,
//                                       manifest.webmanifest, icon-512.png,
//                                       apple-touch-icon.png}
//   HY_MINIFY=0 node game/build.mjs  → dist/index.html unminified, for bisecting
//
// dist/index.dev.html is always written unminified, so any harness that wants
// readable source and honest line numbers can point at it instead.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const ROOT = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

// BIBLE D01 wants first paint under 400 ms from local storage on a mid-range
// phone. Bytes are the only lever the build owns; everything else is the game's.
//
// TWO BUDGETS, AND THE HISTORY OF BOTH. 06 §perf's stated number is < 180 KB *gzipped transfer*,
// written when the game was one act; this file's raw 900 KB stood in for it because the build
// never measured compression. Both were already breached before anyone looked — the shipped
// three-act game gzips to ~288 KB — so the raw guardrail was passing on a number that stopped
// meaning anything. Measured and re-baselined at the first playtest round: the gzip figure is
// the budget (what a phone actually downloads — parse cost tracks it too), set from the measured
// size plus one act's worth of headroom, and raw is kept only as a drift alarm.
const BUDGET_GZ_KB = 320
const BUDGET_KB = 960

// ─────────────────────────────────────────────────────────────────────────────
// JS LEXER
//
// Enough of ES2020 to know where a comment is and where one token stops and the
// next begins. It is not a parser: it builds no tree. Templates are taken whole
// (their raw text is program output), everything else becomes one token carrying
// a flag for whether a newline preceded it, because a newline is the only piece
// of whitespace in JS that can change what a program means.
// ─────────────────────────────────────────────────────────────────────────────

// Longest first: the scanner takes the first that matches.
const PUNCT = [
  '>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>',
  '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/', '%',
  '&', '|', '^', '!', '~', '?', ':', '=', '.', '#',
]

// A '/' after any of these is division; after anything else it opens a regex.
// ')' and '}' count as division-enders, which is the usual heuristic and is only
// wrong for `if (x) /re/…` and `{}/re/` — neither of which appears here, and the
// parser check at the end of the build would refuse a bundle where it did.
const CLOSERS = new Set([')', ']', '}', '++', '--'])
const REGEX_AFTER_WORD = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await',
])

const idStart = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$' || c.charCodeAt(0) > 127
const idPart = (c) => idStart(c) || (c >= '0' && c <= '9')
const numPart = (c) => (c >= '0' && c <= '9') || c === '.' || c === '_' ||
  (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') || c === 'x' || c === 'X' || c === 'o' || c === 'O' ||
  c === 'b' || c === 'B' || c === 'n'

function scanString(s, i) {
  const q = s[i]
  let j = i + 1
  while (j < s.length) {
    if (s[j] === '\\') { j += 2; continue }
    if (s[j] === q) return j + 1
    j++
  }
  throw new Error('unterminated string at offset ' + i)
}

// A template is opaque: its raw text is part of the program's output, so the only
// job here is to find where it ends, stepping over nested ${…} which may contain
// strings and further templates of their own.
function scanTemplate(s, i) {
  let j = i + 1
  while (j < s.length) {
    const c = s[j]
    if (c === '\\') { j += 2; continue }
    if (c === '`') return j + 1
    if (c === '$' && s[j + 1] === '{') { j = scanBraced(s, j + 2); continue }
    j++
  }
  throw new Error('unterminated template at offset ' + i)
}

function scanBraced(s, i) {
  let depth = 1
  let j = i
  while (j < s.length) {
    const c = s[j]
    if (c === '\\') { j += 2; continue }
    if (c === '"' || c === "'") { j = scanString(s, j); continue }
    if (c === '`') { j = scanTemplate(s, j); continue }
    if (c === '/' && s[j + 1] === '/') { while (j < s.length && s[j] !== '\n') j++; continue }
    if (c === '/' && s[j + 1] === '*') { const e = s.indexOf('*/', j + 2); if (e < 0) throw new Error('unterminated comment'); j = e + 2; continue }
    if (c === '{') { depth++; j++; continue }
    if (c === '}') { depth--; j++; if (depth === 0) return j; continue }
    j++
  }
  throw new Error('unterminated interpolation at offset ' + i)
}

function lexJS(src, where) {
  const toks = []
  let i = 0
  let nl = false
  const n = src.length
  const fail = (msg) => {
    const line = src.slice(0, i).split('\n').length
    return new Error(`${where}:${line} ${msg}`)
  }
  while (i < n) {
    const c = src[i]
    if (c === '\n' || c === '\u2028' || c === '\u2029') { nl = true; i++; continue }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v' || c === '\u00a0' || c === '\ufeff') { i++; continue }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      if (end < 0) throw fail('unterminated block comment')
      // A block comment spanning lines carries its newline to the next token:
      // deleting it must not delete the line break it stood in front of.
      if (src.lastIndexOf('\n', end) >= i) nl = true
      i = end + 2
      continue
    }
    let t, j
    if (c === '"' || c === "'") { t = 'str'; j = scanString(src, i) }
    else if (c === '`') { t = 'tmpl'; j = scanTemplate(src, i) }
    else if (idStart(c)) { t = 'name'; j = i + 1; while (j < n && idPart(src[j])) j++ }
    else if ((c >= '0' && c <= '9') || (c === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      t = 'num'; j = i + 1
      while (j < n && (numPart(src[j]) || ((src[j] === '+' || src[j] === '-') && (src[j - 1] === 'e' || src[j - 1] === 'E')))) j++
    } else if (c === '/' && regexAllowed(toks[toks.length - 1])) {
      t = 'regex'; j = i + 1
      let inClass = false
      for (;;) {
        if (j >= n) throw fail('unterminated regex')
        const d = src[j]
        if (d === '\\') { j += 2; continue }
        if (d === '\n') throw fail('newline in regex')
        if (d === '[') inClass = true
        else if (d === ']') inClass = false
        else if (d === '/' && !inClass) { j++; break }
        j++
      }
      while (j < n && idPart(src[j])) j++
    } else {
      const p = PUNCT.find((q) => src.startsWith(q, i))
      if (!p) throw fail('unexpected character ' + JSON.stringify(c))
      // `a ? .5 : b` must not lex as the optional-chaining punctuator.
      const v = (p === '?.' && src[i + 2] >= '0' && src[i + 2] <= '9') ? '?' : p
      toks.push({ t: 'punct', v, nl })
      nl = false
      i += v.length
      continue
    }
    toks.push({ t, v: src.slice(i, j), nl })
    nl = false
    i = j
  }
  return toks
}

function regexAllowed(prev) {
  if (!prev) return true
  if (prev.t === 'punct') return !CLOSERS.has(prev.v)
  if (prev.t === 'name') return REGEX_AFTER_WORD.has(prev.v)
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// LITERAL REWRITES
//
// The only two places where the output holds different characters than the input
// did. Both are value-preserving by construction and both refuse to fire in any
// position where they would not be.
// ─────────────────────────────────────────────────────────────────────────────

// 0.100 → .1, 1.00 → 1, 100000 → 1e5. Radix literals and BigInt are left alone;
// so is anything that does not survive a round trip through Number.
function shortestNumber(v) {
  if (/[xXoObBn]/.test(v)) return v
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  let best = v
  const consider = (c) => { if (c.length < best.length && Object.is(Number(c), n)) best = c }
  const plain = String(n)
  consider(plain)
  if (plain.startsWith('0.')) consider(plain.slice(1))
  consider(n.toExponential().replace('e+', 'e'))
  return best
}

// !0 and !1 are unary expressions, so they are legal everywhere a boolean literal
// is except the three places checked here: as a property name, as the left operand
// of **, and in front of a dot. `true` and `false` are reserved words and can never
// be a binding, so nothing else can go wrong.
function booleanRewrite(prev, next) {
  if (prev && (prev.v === '.' || prev.v === '?.')) return false
  if (next && (next.v === '.' || next.v === '**')) return false
  if (prev && (prev.v === '{' || prev.v === ',') && next && next.v === ':') return false
  return true
}

function rewriteLiterals(toks) {
  const out = []
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]
    if (t.t === 'num') {
      const v = shortestNumber(t.v)
      out.push(v === t.v ? t : { t: 'num', v, nl: t.nl })
      continue
    }
    if (t.t === 'name' && (t.v === 'true' || t.v === 'false') && booleanRewrite(toks[k - 1], toks[k + 1])) {
      out.push({ t: 'punct', v: '!', nl: t.nl }, { t: 'num', v: t.v === 'true' ? '0' : '1', nl: false })
      continue
    }
    out.push(t)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// JS EMITTER
//
// Walks the tokens keeping just enough bracket context to answer one question:
// could a fresh statement begin at this point with no separator at all? That is
// the difference between `if(x){y()}z()`, which is fine, and `var a={}z()`,
// which is not — and it is not answerable from the two tokens either side.
// ─────────────────────────────────────────────────────────────────────────────

// Two-character sequences that would fuse into one token if written with nothing
// between them. Derived from PUNCT so the two can never drift apart.
const FUSE = new Set(['//', '/*'])
for (const p of PUNCT) if (p.length >= 2) FUSE.add(p.slice(0, 2))

// After these the grammar's restricted productions make the line break itself
// the terminator: `return \n x` returns undefined and must keep doing so.
const NL_KEEP_AFTER = new Set(['return', 'throw', 'break', 'continue', 'yield'])
// These can only ever start a new statement, never continue the one before.
const STARTS_ONLY = new Set(['{', '!', '~', '++', '--'])
// Words that continue an expression rather than starting a statement. Joining a
// line break in front of one is the single case that would change meaning
// silently instead of loudly, so it is never done.
const CONTINUES = new Set(['in', 'instanceof', 'of'])
const HEADER_KW = new Set(['if', 'for', 'while', 'switch', 'catch', 'with'])
const BLOCK_KW = new Set(['else', 'do', 'try', 'finally'])

function needsSpace(prev, next) {
  const a = prev.v[prev.v.length - 1]
  const b = next.v[0]
  if (idPart(a) && idPart(b)) return true
  // `1 .toFixed(2)`: the dot would be swallowed by the numeric literal.
  if (prev.t === 'num' && b === '.') return true
  // `/re/ in x`: the flags would swallow the keyword.
  if (prev.t === 'regex' && idPart(b)) return true
  return FUSE.has(a + b)
}

// `x.catch(…)` and `x.for` are member accesses, not the keywords they spell.
function isKeyword(toks, k) {
  const before = toks[k - 1]
  return !before || (before.v !== '.' && before.v !== '?.')
}

// One walk over the token stream carrying the bracket stack, answering for every
// position: could a statement begin here, and which bracket are we inside? Both
// the emitter and the renamer need it, and they must agree, so there is one walk.
function contextOf(toks) {
  const info = new Array(toks.length)
  const stack = []
  let popped = null           // the frame the previous token closed, if any
  let fnAtStatement = false   // the last `function` seen stood where a statement could

  const boundary = (k) => {
    const prev = k > 0 ? toks[k - 1] : null
    if (!prev) return true
    if (prev.t === 'name') return BLOCK_KW.has(prev.v) && isKeyword(toks, k - 1)
    if (prev.v === ';') return true
    if (prev.v === '{') return stack.length > 0 && stack[stack.length - 1].kind === 'block'
    if (prev.v === '}') return popped !== null && popped.kind === 'block'
    // `if (…)`, `for (…)` and friends are followed by the statement they govern;
    // a function declaration's parameter list is followed by its body.
    if (prev.v === ')') return popped !== null && (popped.kind === 'header' || popped.kind === 'declParams')
    return false
  }

  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]
    const prev = k > 0 ? toks[k - 1] : null
    const atBoundary = boundary(k)
    info[k] = { atBoundary, encl: stack.length ? stack[stack.length - 1] : null }

    if (t.v === '(') {
      let kind = 'other'
      const pp = k > 1 ? toks[k - 2] : null
      if (prev && prev.t === 'name' && HEADER_KW.has(prev.v) && isKeyword(toks, k - 1)) kind = 'header'
      else if (prev && prev.t === 'name' && prev.v === 'function' && isKeyword(toks, k - 1)) kind = fnAtStatement ? 'declParams' : 'exprParams'
      else if (prev && prev.t === 'name' && pp && pp.t === 'name' && pp.v === 'function' && isKeyword(toks, k - 2)) kind = fnAtStatement ? 'declParams' : 'exprParams'
      stack.push({ ch: '(', kind })
      popped = null
    } else if (t.v === '[') {
      stack.push({ ch: '[', kind: 'expr' })
      popped = null
    } else if (t.v === '{') {
      // A brace where a statement could begin is a block; anywhere else it is an
      // object literal or a function body, and its close ends an expression.
      stack.push({ ch: '{', kind: atBoundary ? 'block' : 'expr' })
      popped = null
    } else if (t.v === ')' || t.v === ']' || t.v === '}') {
      popped = stack.pop() || null
    } else {
      if (t.t === 'name' && t.v === 'function' && isKeyword(toks, k)) fnAtStatement = atBoundary
      popped = null
    }
  }
  return info
}

// Deleting a line break is safe exactly when automatic semicolon insertion did
// not fire at it. ASI fires only where the next token cannot continue what came
// before — so punctuators, regexes and templates are always safe to pull up, and
// a bare name, number or string is safe only where the production before it was
// obviously unfinished, or where a statement could start with no separator.
function canJoin(prev, next, atBoundary) {
  if (prev.t === 'name' && NL_KEEP_AFTER.has(prev.v)) return false
  if (prev.t === 'punct' && !CLOSERS.has(prev.v)) return true
  if (next.t === 'punct') return STARTS_ONLY.has(next.v) ? atBoundary : true
  if (next.t === 'name' && CONTINUES.has(next.v)) return false
  if (next.t === 'name' || next.t === 'num' || next.t === 'str') return atBoundary
  return true
}

function emitJS(toks) {
  const info = contextOf(toks)
  let out = ''
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]
    if (k > 0) {
      const prev = toks[k - 1]
      if (t.nl && !canJoin(prev, t, info[k].atBoundary)) out += '\n'
      else if (needsSpace(prev, t)) out += ' '
    }
    out += t.v
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL RENAMING
//
// Every module is one closed IIFE that talks to the rest of the build only
// through properties of window.HY, so a name that is declared inside a module and
// never appears as a property of anything is private to that module's file. Such
// a name can be shortened, and this is the argument that it is safe to do so with
// no scope analysis at all:
//
//   · The rename is uniform. Every occurrence of the string in the file becomes
//     the new string, so the scope tree is untouched and each reference still
//     resolves to the declaration it resolved to before, even where the same name
//     names different variables in different functions.
//   · The new name occurs nowhere in the file — not as a variable, not as a
//     property, not as a keyword. So nothing can be captured by it and it cannot
//     shadow anything the file relies on.
//   · A name is only a candidate if the file declares it (var/let/const/function/
//     parameter/catch) and if no occurrence anywhere in the file sits in a
//     position where the string means a property rather than a variable.
//
// Anything the scan cannot classify with certainty keeps its name. Renaming is
// skipped wholesale for a file containing eval or with, where a string could name
// a binding at runtime.
// ─────────────────────────────────────────────────────────────────────────────

// Words that are not variables, or that could be a global this file reads without
// declaring. Never a rename candidate, never a generated name.
const NEVER_RENAME = new Set((
  'break case catch class const continue debugger default delete do else enum export extends ' +
  'false finally for function if implements import in instanceof interface let new null package ' +
  'private protected public return static super switch this throw true try typeof var void while ' +
  'with yield async await get set of arguments eval undefined NaN Infinity globalThis ' +
  'window document navigator location history screen performance console self top parent frames ' +
  'name status length event closed origin ' +
  'Math JSON Date Object Array String Number Boolean Symbol RegExp Function Error TypeError ' +
  'RangeError Promise Set Map WeakMap WeakSet Proxy Reflect BigInt ' +
  'parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent escape unescape ' +
  'setTimeout clearTimeout setInterval clearInterval queueMicrotask ' +
  'requestAnimationFrame cancelAnimationFrame requestIdleCallback matchMedia getComputedStyle ' +
  'localStorage sessionStorage indexedDB caches crypto fetch atob btoa alert confirm prompt ' +
  'URL Blob File FileReader Image Audio AudioContext webkitAudioContext OffscreenCanvas ' +
  'IntersectionObserver ResizeObserver MutationObserver CustomEvent Event Node Element HTMLElement ' +
  'CSS DOMParser TextEncoder TextDecoder Intl HY'
).split(' '))

// Generated names, shortest first. Two-letter names alone are more than this
// build needs, but the sequence continues for as long as anyone asks.
function* nameSupply() {
  const A = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const a of A) yield a
  for (const a of A) for (const b of A) yield a + b
  for (const a of A) for (const b of A) for (const c of A) yield a + b + c
}

function renameLocals(toks, where) {
  const info = contextOf(toks)
  const used = new Set()          // every name-shaped string the file mentions
  const declared = new Set()      // names this file binds
  const property = new Set()      // names that stand for a property somewhere
  const uses = new Map()          // occurrence counts, for ordering
  const literals = []             // every string the file spells out
  let opaque = false              // eval/with: a string could name a binding

  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]
    if (t.t === 'str' || t.t === 'tmpl') { literals.push(t.v) ; continue }
    if (t.t !== 'name') continue
    used.add(t.v)
    uses.set(t.v, (uses.get(t.v) || 0) + 1)
    if (t.v === 'eval' || (t.v === 'with' && isKeyword(toks, k))) opaque = true

    const prev = toks[k - 1]
    const next = toks[k + 1]
    const inObject = info[k].encl && info[k].encl.ch === '{' && info[k].encl.kind === 'expr'
    // `a.foo` — a member name.
    if (prev && (prev.v === '.' || prev.v === '?.')) { property.add(t.v); continue }
    // `{ foo: 1 }`, `case foo:`, `foo ? a : b`, `foo:` as a label. Only the first
    // is really a property, but the others are positions this scan will not try
    // to tell apart, so the whole string is left alone.
    if (next && next.v === ':') { property.add(t.v); continue }
    // `{ foo }` and `var { foo } = x` — shorthand, where the string is both a
    // property name and a binding.
    if (inObject && prev && (prev.v === '{' || prev.v === ',') && next && (next.v === ',' || next.v === '}')) {
      property.add(t.v)
      continue
    }
    // `{ foo() {} }` — a shorthand method name.
    if (inObject && prev && (prev.v === '{' || prev.v === ',') && next && next.v === '(') {
      property.add(t.v)
      continue
    }
    // `{ get foo () {} }` — an accessor's name is a property even though the
    // token before it is `get`/`set` rather than `{` or `,`. Renaming one made
    // HY.loop.running vanish from the shipped build. Guarding on the two words
    // alone can only over-protect (skip a legal rename), never miss one.
    if (prev && prev.t === 'name' && (prev.v === 'get' || prev.v === 'set') && next && next.v === '(') {
      property.add(t.v)
      continue
    }
    // Declarations.
    if (prev && prev.t === 'name' && isKeyword(toks, k - 1) &&
      (prev.v === 'var' || prev.v === 'let' || prev.v === 'const' || prev.v === 'function')) declared.add(t.v)
  }

  // Parameter lists and catch bindings are declarations too, and they are the
  // only ones that need to be read as a run rather than a pair.
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]
    if (t.t !== 'name' || !isKeyword(toks, k)) continue
    if (t.v === 'function') {
      let j = k + 1
      if (toks[j] && toks[j].t === 'name') j++
      if (!toks[j] || toks[j].v !== '(') continue
      for (j++; toks[j] && toks[j].v !== ')'; j++) if (toks[j].t === 'name') declared.add(toks[j].v)
    } else if (t.v === 'catch' && toks[k + 1] && toks[k + 1].v === '(' && toks[k + 2] && toks[k + 2].t === 'name') {
      declared.add(toks[k + 2].v)
    }
  }

  if (opaque) return { toks, renamed: 0, saved: 0 }

  // A name this file also spells out as text is off limits. Two of the module
  // self-tests read their own functions back with Function.prototype.toString and
  // assert on the identifiers they find there, so an identifier that appears
  // inside any string in the file is load-bearing text, not just a binding. The
  // test is substring-wide because those assertions look for fragments.
  const spelled = literals.join(' ')

  const candidates = [...declared]
    .filter((n) => !property.has(n) && !NEVER_RENAME.has(n) && n.length > 2 && !spelled.includes(n))
    .sort((a, b) => (b.length - 2) * uses.get(b) - (a.length - 2) * uses.get(a))

  const supply = nameSupply()
  const map = new Map()
  let saved = 0
  for (const from of candidates) {
    let to = supply.next().value
    while (used.has(to) || NEVER_RENAME.has(to)) to = supply.next().value
    if (to.length >= from.length) continue
    used.add(to)
    map.set(from, to)
    saved += (from.length - to.length) * uses.get(from)
  }
  if (!map.size) return { toks, renamed: 0, saved: 0 }

  const out = toks.map((t) => (t.t === 'name' && map.has(t.v) ? { t: 'name', v: map.get(t.v), nl: t.nl } : t))
  if (out.length !== toks.length) throw new Error(where + ': rename changed the token count')
  return { toks: out, renamed: map.size, saved }
}

function minifyJS(src, where) {
  const toks = rewriteLiterals(renameLocals(lexJS(src, where), where).toks)
  const out = emitJS(toks)
  // Prove the emitter gave back exactly the tokens it was handed. Anything else
  // means the lexer misread the source, and shipping it would be a coin flip.
  const back = lexJS(out, where + ' (minified)')
  if (back.length !== toks.length) {
    throw new Error(`${where}: minifier changed the token count (${toks.length} → ${back.length})`)
  }
  for (let k = 0; k < toks.length; k++) {
    if (back[k].v !== toks[k].v) {
      throw new Error(`${where}: token ${k} changed: ${JSON.stringify(toks[k].v)} → ${JSON.stringify(back[k].v)}`)
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS MINIFIER
//
// Same principle, much smaller grammar: strings are opaque, comments go,
// whitespace runs collapse to at most one space and are dropped entirely beside
// punctuation that already separates. Nothing is removed around +, -, > or ~, so
// calc() and the sibling combinators survive untouched.
// ─────────────────────────────────────────────────────────────────────────────

// Whitespace beside one of these is never load-bearing.
const CSS_TIGHT = new Set(['{', '}', ';', ','])

// ')' is tight inside a declaration and GRAMMAR outside one. In a selector the space after a
// closing paren is a descendant combinator, and dropping it welds two selectors into one:
// `:root:not([data-motion="full"]) .hero` became `:root:not(…).hero`, which asks for a <html> with
// class `hero` and matches nothing. Every reduced-motion override in the stylesheet is written that
// way — the console stack, the meter fill, the ledger cap — so the whole of 06 §8.6 was being
// minified out of the build while the source read correctly. Selector context is not "depth 0":
// the rules inside an @media block are selectors at depth 1, which is exactly where those overrides
// live, so the block stack below records what each brace opened rather than counting them.
const CSS_TIGHT_IN_DECL = new Set([')'])

// ...except beside these, where it is grammar. Inside calc() the + and -
// operators MUST carry whitespace on both sides; `calc(a+ b)` is invalid and
// the browser drops the whole declaration without a word. That is how a 60px
// padding silently became 0 and clipped the trailing character off every rate
// readout on a 390px phone. > and ~ are here for the sibling combinators.
const CSS_KEEP_SPACE = new Set(['+', '-', '>', '~'])

function minifyCSS(src) {
  let out = ''
  let i = 0
  let space = false // a whitespace run is pending; emit it only if it separates
  const n = src.length
  // One entry per open brace: true if the prelude was an at-rule. The innermost tells us whether
  // what we are reading now is a declaration or a selector.
  const blocks = []
  let atRule = false
  const inDecl = () => blocks.length > 0 && blocks[blocks.length - 1] === false
  const tight = (ch) => CSS_TIGHT.has(ch) || (inDecl() && CSS_TIGHT_IN_DECL.has(ch))
  const put = (s) => {
    if (space) {
      const a = out[out.length - 1]
      const grammatical = CSS_KEEP_SPACE.has(s[0]) || CSS_KEEP_SPACE.has(a)
      const separating = !tight(a) && a !== ':' && a !== '(' && !tight(s[0])
      if (out.length && (grammatical || separating)) out += ' '
      space = false
    }
    out += s
  }
  while (i < n) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      if (end < 0) throw new Error('unterminated CSS comment')
      i = end + 2
      space = true // a comment stood between two things; let the collapser decide
      continue
    }
    if (c === '"' || c === "'") { const j = scanString(src, i); put(src.slice(i, j)); i = j; continue }
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f') { space = true; i++; continue }
    if (c === '@') { atRule = true; put(c); i++; continue }
    if (c === '{') {
      put(c)
      blocks.push(atRule)
      atRule = false
      i++
      continue
    }
    if (c === '}') {
      blocks.pop()
      atRule = false
      space = false
      // The last declaration's semicolon is noise in front of the closing brace.
      if (out[out.length - 1] === ';') out = out.slice(0, -1)
      put(c)
      i++
      continue
    }
    if (c === ';' || c === ',') { if (c === ';') atRule = false; space = false; put(c); i++; continue }
    if (c === ':' && inDecl()) {
      // Inside a block a colon is always a declaration colon. In a selector it
      // introduces a pseudo-class, where the space in `li :first-child` matters.
      space = false
      put(c)
      i++
      continue
    }
    // Leading zero on a fraction is decoration: .5 and 0.5 are the same number.
    if (c === '0' && src[i + 1] === '.' && src[i + 2] >= '0' && src[i + 2] <= '9') {
      const before = space ? ' ' : out[out.length - 1]
      if (!before || !(idPart(before) || before === '.' || before === '#' || before === '%')) {
        put('.')
        i += 2
        continue
      }
    }
    put(c)
    i++
  }
  out = out.trim()

  // This minifier can only ever DROP a space, so the one way it can change
  // meaning is by dropping one that was carrying grammar. The JS side proves
  // itself by re-lexing and re-parsing; CSS has no parser to hand, so check the
  // single failure mode that is actually reachable. '(', '*' and '/' are
  // excluded before the operator because a unary sign is legal after them.
  // Only a BINARY +/- needs its spaces, and it is binary only when a value precedes it. After an
  // operator or an opening paren the sign is unary and legal tight — calc(var(--x)* -1) is fine,
  // and an earlier version of this check called it broken. So both halves require a value char
  // on the left: dropped-space-after (`A+ B`) and dropped-space-before (`A -B`).
  const badCalc = out.match(/calc\([^{};]*?(?:[\w%)\]][+-]\s|[\w%)\]]\s[+-][^\s])[^{};]*?\)/)
  if (badCalc) throw new Error('CSS minifier broke a calc(): ' + badCalc[0])
  // The other reachable failure, and the one that shipped: a descendant combinator eaten after a
  // closing paren, welding `:not(…) .thing` into `:not(…).thing`. A class, id or attribute glued
  // to a `)` cannot occur in a declaration value, so finding one means a selector lost a space.
  // `*` is excluded because `calc(var(--a)* 2)` is legal and everywhere in this stylesheet.
  const welded = out.match(/[^{};]{0,40}\)[.#[][^{};]{0,40}/)
  if (welded && /\)[.#[][\w-]/.test(welded[0])) {
    throw new Error('CSS minifier welded a descendant combinator: ' + welded[0])
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// ICON RENDERER
//
// iOS ignores manifest icons entirely and looks for a PNG named by an
// apple-touch-icon link; Chrome will not call the page installable without a
// manifest icon of at least 144 px it can decode. Both PNGs are rendered here
// from the mark's geometry — the same nine strokes and three node dots the SVG
// mark draws — so there is no binary asset checked in that could drift from the
// vector. The renderer is a signed-distance rasterizer (round caps come free
// from measuring distance to a segment) and the encoder writes the minimal PNG:
// 8-bit RGB, filter 0, one zlib stream. No image library, per the build's rule.
// ─────────────────────────────────────────────────────────────────────────────

const MARK = {
  view: 512,                 // the coordinate space the geometry is authored in
  bg: [0x0B, 0x0D, 0x0C],    // soil-950, the manifest's background_color
  fg: [0xE8, 0xE1, 0xD3],    // spore, the mark's line colour
  stroke: 7,                 // the SVG mark's stroke-width
  segs: [                    // trunk, laterals, branches, tips — root down
    [256, 440, 256, 260], [256, 300, 150, 194], [256, 300, 362, 194],
    [256, 370, 184, 300], [256, 370, 328, 300], [150, 194, 102, 126],
    [150, 194, 110, 220], [362, 194, 410, 126], [362, 194, 402, 220],
  ],
  dots: [[102, 126, 11], [410, 126, 11], [256, 260, 10]],
}

const ICON_PX = 512          // manifest icon, also the splash-screen source
const APPLE_PX = 180         // what iOS actually samples for the home screen
// At 180 px the faithful 7-unit stroke is a 2.5 px hairline that disappears on
// a home screen, so the small render thickens strokes and dots rather than
// shipping an illegible faithful one.
const APPLE_STROKE = 12
const APPLE_DOT_SCALE = 1.4

function segDistance(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function rasterizeMark(size, stroke, dotScale) {
  const unitsPerPx = MARK.view / size
  const rgb = Buffer.alloc(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const vx = (x + 0.5) * unitsPerPx
      const vy = (y + 0.5) * unitsPerPx
      // Signed distance to the nearest ink edge, in mark units.
      let d = Infinity
      for (const s of MARK.segs) d = Math.min(d, segDistance(vx, vy, s) - stroke / 2)
      for (const [cx, cy, r] of MARK.dots) d = Math.min(d, Math.hypot(vx - cx, vy - cy) - r * dotScale)
      // One-pixel anti-aliased edge: full ink half a pixel inside, none half
      // a pixel outside.
      const a = Math.max(0, Math.min(1, 0.5 - d / unitsPerPx))
      const o = (y * size + x) * 3
      for (let k = 0; k < 3; k++) rgb[o + k] = Math.round(MARK.bg[k] + (MARK.fg[k] - MARK.bg[k]) * a)
    }
  }
  return rgb
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function encodePNG(size, rgb) {
  // Each scanline carries a leading filter byte; 0 = unfiltered, and the
  // deflate stream is left to find the redundancy.
  const stride = size * 3
  const raw = Buffer.alloc(size * (stride + 1))
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // colour type: truecolour, no alpha — home-screen icons are opaque
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const renderIcon = (size, stroke, dotScale) => encodePNG(size, rasterizeMark(size, stroke, dotScale))

// ─────────────────────────────────────────────────────────────────────────────
// BUILD
// ─────────────────────────────────────────────────────────────────────────────

// Load order is the dependency order. Keep it explicit.
const ORDER = JSON.parse(read('order.json'))

const MINIFY = process.env.HY_MINIFY !== '0'

const shellSrc = read('shell.html')
const swSrc = read('sw.js')
const manifest = read('manifest.webmanifest')

// The shell carries its own boot script; minify that too, and drop the blank
// lines and indentation between its tags.
function minifyShell(html) {
  return html
    .replace(/<script>([\s\S]*?)<\/script>/g, (_m, body) => `<script>${minifyJS(body, 'shell.html')}</script>`)
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
}

function assemble(minify) {
  const css = ORDER.css.map((f) => (minify ? minifyCSS(read(f)) : `/* ${f} */\n${read(f)}`)).join(minify ? '' : '\n\n')
  // The file marker survives minification: it costs nothing next to a megabyte
  // and it is the only landmark left in a stack trace from the shipped build.
  const js = ORDER.js.map((f) => (minify ? `//${f}\n${minifyJS(read(f), f)}` : `/* ${f} */\n${read(f)}`)).join('\n;\n')
  const shell = minify ? minifyShell(shellSrc) : shellSrc
  if (minify) {
    // Hand the whole script to the engine's parser before anyone ships it. This
    // compiles, it does not run: a separator the emitter wrongly dropped becomes
    // a failed build here instead of a blank screen on a phone.
    try {
      new Function(js)
    } catch (e) {
      throw new Error('minified bundle does not parse: ' + e.message)
    }
  }
  return shell
    .replace('<!--STYLES-->', `<style>\n${css}\n</style>`)
    .replace('<!--SCRIPTS-->', `<script>\n${js}\n</script>`)
}

mkdirSync(join(ROOT, 'dist'), { recursive: true })

const out = assemble(MINIFY)
writeFileSync(join(ROOT, 'dist/index.html'), out)

// Always leave a readable build next to the shipped one. Harnesses that want
// real line numbers, and anyone bisecting a suspicion about the minifier, load
// this one instead; it is the same program with the comments still in it.
const dev = MINIFY ? assemble(false) : out
writeFileSync(join(ROOT, 'dist/index.dev.html'), dev)

// The PWA sidecars the page points at over http(s). The service worker gets
// the same parse gate the bundle does — a worker that fails to compile is a
// worker Chrome silently never installs.
const swOut = MINIFY ? minifyJS(swSrc, 'sw.js') : swSrc
try {
  new Function(swOut)
} catch (e) {
  throw new Error('minified sw.js does not parse: ' + e.message)
}
writeFileSync(join(ROOT, 'dist/sw.js'), swOut)
writeFileSync(join(ROOT, 'dist/manifest.webmanifest'), MINIFY ? JSON.stringify(JSON.parse(manifest)) : manifest)
writeFileSync(join(ROOT, 'dist/icon-512.png'), renderIcon(ICON_PX, MARK.stroke, 1))
writeFileSync(join(ROOT, 'dist/apple-touch-icon.png'), renderIcon(APPLE_PX, APPLE_STROKE, APPLE_DOT_SCALE))

const bytes = Buffer.byteLength(out)
const kb = (bytes / 1024).toFixed(1)
const devKb = (Buffer.byteLength(dev) / 1024).toFixed(1)
// Level 9, matching what GitHub Pages actually serves (measured within 3% of it).
const gzBytes = deflateSync(Buffer.from(out), { level: 9 }).length
const gzKb = (gzBytes / 1024).toFixed(1)
console.log(
  `built game/dist/index.html + PWA sidecars — ${kb} KB raw, ${gzKb} KB gzipped ` +
  `(${ORDER.js.length} modules, ${ORDER.css.length} stylesheets)` +
  (MINIFY ? `, minified from ${devKb} KB, ${(BUDGET_GZ_KB - gzBytes / 1024).toFixed(1)} KB under the transfer budget` : ', NOT minified (HY_MINIFY=0)')
)
if (gzBytes > BUDGET_GZ_KB * 1024) {
  console.error(`FAIL: ${gzKb} KB gzipped is over the ${BUDGET_GZ_KB} KB transfer budget`)
  process.exit(1)
}
if (bytes > BUDGET_KB * 1024) console.warn(`WARNING: raw bundle over ${BUDGET_KB} KB — re-baseline deliberately or diet`)
