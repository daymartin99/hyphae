# HYPHAE

A quiet incremental about a network that learns what it is.

**Play: https://daymartin99.github.io/hyphae/** — on a phone, open the link and
add it to your home screen (iOS: Share → Add to Home Screen). After the first
visit it plays fully offline. Your run saves on your own device.

Three acts. It does not explain itself; that is deliberate. No ads, no
accounts, no analytics — one self-contained file.

## Source

Vanilla ES2020, zero dependencies, no transpiler. Eighteen plain-script
modules share one `window.HY` namespace; "bundling" is ordered concatenation
into a single self-contained HTML file.

- `js/` — the simulation, interface, canvas and narrative modules
- `css/ui.css` — the one stylesheet
- `docs/design/` — the design bible the game is built against; `BIBLE.md`
  holds the canonical state shape, tick order and definition-of-done
- `build.mjs` — dependency-free bundler and minifier; every build re-lexes
  its own output token-for-token and hands it to the engine's parser
- `boot-check.mjs`, `shoot.mjs`, `redraw-check.mjs` — headless Chromium
  harnesses (boot + self-tests, the screenshot contact sheet, and the redraw
  budget: the map, the void and the phase wheel repaint only when they change)

```
node build.mjs        # → dist/ (index.html + PWA sidecars)
node boot-check.mjs   # boots dist headless, runs every module's self-test
node redraw-check.mjs # repaints per second of the per-frame canvases
```

`gh-pages` is the deploy branch: the six built files GitHub Pages serves,
nothing else. `main` is the source.

Built with [Claude Code](https://claude.com/claude-code). The history is the
dev diary — read the commit messages.
