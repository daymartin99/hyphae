// The game's own lint config. It did not come across in the move out of the trading platform —
// that repo's config was React-flavoured and lived at its root, so the game arrived here with no
// linting at all. This is the game's half, and nothing else: two source shapes, no plugins, no
// dependencies beyond eslint itself.
import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'shots', 'scratch-*']),
  {
    // js/ is eighteen plain <script> files sharing one `window.HY` namespace — not modules, and
    // deliberately so (see build.mjs). Browser globals, script sourceType, ES2020.
    files: ['js/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: { ...globals.browser, HY: 'writable' },
    },
    rules: {
      // A capitalised or underscored binding is a constant table the module declares for the
      // reader's sake and may legitimately not consume in the same file.
      //
      // caughtErrors:'none' — ESLint 9 flipped this default to 'all', which is why 108 errors
      // appeared the moment the game got its own config despite the code never changing. This
      // build swallows a caught error deliberately and says why on the same line every time
      // ("private mode is a supported configuration", "a missing pulse is not a failed tap");
      // naming the binding `e` and not reading it IS the idiom, and the old config allowed it.
      // args:'none' — BIBLE §6 fixes one shape for every module surface (init/tick/serialise/
      // migrate) and one for every act's ledger painter. An act that does not need the last
      // argument still declares it, because the uniform signature is what lets the loop drive
      // eighteen modules without knowing which is which. The parameter is documentation.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', caughtErrors: 'none', args: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // The build and the headless harnesses: real ES modules run by Node — but every harness also
    // carries page.evaluate() callbacks whose source is serialised and run inside the browser, so
    // `window` and `document` are legitimately in scope for part of each file. Both sets.
    files: ['*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', caughtErrors: 'none', args: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
])
