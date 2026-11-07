# HYPHAE: target design (round 2)

Read BRIEF.md in this folder first. It covers the game, the files to read, the .dc.html format, and the rules that fail silently. The round-1 artboards in project/ (Main / A_*, B_*, C_*) are your reference. Read them for ideas and to see what the owner reacted to.

## What the owner said (David, in his words)
- Go with the hybrid: B's backbone, A's map-touch, C's act identity.
- Take A's signature-moment visual, the living organism pulsing and growing, and make it a constant element: "a slide or a button. i like it pulsing and growing, i want it to feel alive."
- About B: "a little claude vibe coded look... i see AI". He likes B's clarity but not its aesthetic.
- C is the concept: Act I organic, Act II "we get more into the mind / computer", Act III "through the looking glass".
- The transitions into the acts must be LOUD and POWERFUL.
- There must be a coherent through-line across the three acts, so it doesn't feel like three games bolted together.

## The through-line: ONE BODY, THREE READINGS
The coherence comes from one living thing, the organism, drawn at all times and in the same place. Every act renders the SAME geometry differently.

- **The organism (call it "the body" in code).** It is a living, generative drawing of the mycelium: branching strokes from a knot, growing tips, and a slow breathing pulse. It grows with the player's real progress: more tips mean more branches, more biomass means more density. It is never a static logo.
  - **Placement.** It lives in a fixed "body window" in the upper part of the screen, under the ledger, at about 180-220 px tall, full width.
  - **Interaction.** It is touchable. Tapping it is the game's primary verb: grow in Act I, pulse in Act II, thrust/observe in Act III.
  - **Bigger view.** Swiping or tapping the expand control opens it full screen as "the slide". You can watch it, and touching parts of it opens their sheets (A's map-touch). Act II stands and Act III bands are reached from here as well as from lists.
- **Act I: organic (the literal reading).** Ink-and-specimen: hyphae as hand-inked strokes on paper/soil, with tips as living points. Amber pulses mark the next move. The palette is soil, spore, chlorophyll, amber, and paper in light mode.
- **Act II: mind / computer (the network reading).** The SAME branching geometry is now read as a graph. Strokes become edges with signal packets travelling along them, knots become nodes, and stands become hex clusters on the edges. The rendering shifts towards oscilloscope/phosphor (biolum green on deep soil), scan-line precision and grid ticks. The body is now visibly thinking. The palette is soil-dark with biolum, and signal Σ shows as light running along the edges.
- **Act III: through the looking glass (the inverted reading).** The SAME geometry is mirrored and inverted. You see it from the other side, as if through glass: the branches become orbits and the tips become bodies/craft in flight. The knot becomes the planet seen from far away, the 13 bands are rings, and the endings are distant lights. The palette is void/frost, and the colours read as an inverse of Act I. Touching shows numbers, but the core figures stay visible in the ledger, so nothing important is hidden.
- **Other constants across all three acts.** These must be identical in position and behaviour in every act:
  1. Screen skeleton, top to bottom: **ledger → body window → voice line → NEXT → verbs → nav**.
  2. The voice (console) always sits directly under the body as a one- or two-line ticker; pull it down for the log. Its form evolves: lowercase notebook ink in Act I, capitalised mono chatter in Act II, sparse centred transmissions in Act III.
  3. NEXT is a factual line, never advice ("a tip costs 66 g. you have 41." not "you should grow a tip"). It sits in the same spot in every act and is linked to the amber pulse on the body.
  4. Interaction grammar: read-only = flat text; opens an account = dotted underline; tap = a pressable verb; locked = dashed outline plus a one-line why; irreversible = HOLD, with the fill drawn as the body's hyphae growing along the button, not a generic progress bar.
  5. One accent family per act: amber for the next move, rust for danger, and biolum for the organism itself in every act. Biolum is the thread.

## De-AI the aesthetic (important)
What reads as "AI / vibe-coded" in round 1, and what to do instead:
- **Avoid:** a stack of identical rounded cards with hairline borders, tiny letter-spaced uppercase labels on everything, pill buttons, evenly spaced dashboard grids, centred tidy symmetry, and generic sans plus mono pairs.
- **Do instead:**
  - Fewer boxes. Structure with rules (lines), indentation, and type size and weight. Make it asymmetric and editorial.
  - The game's own ascii heritage: ascii bars (▓▒░), dotted leaders (`stands ........ 10/61`), and bracketed verbs like `[ grow ]`, used with taste.
  - Physical material per act: paper grain and ink in Act I, a phosphor/oscilloscope glow and grid in Act II, glass, refraction and frost in Act III. These come from CSS only: subtle SVG noise filters, text-shadow glow and backdrop blur are fine.
  - Verbs as words, not as buttons in boxes. In Act I a verb can be an inked word with an underline that grows on press.
  - A dense, opinionated layout. It is fine for numbers to be big and for labels to be small but not shouty.
  - It should feel made by a person with a point of view, closer to a field journal, a lab instrument or an astronomical plate than to a SaaS dashboard.

## Transitions: LOUD AND POWERFUL
These are full takeovers lasting 8-15 s, the biggest moments in the game. Each is built from the body.

**Act I → II (DECIDE).**
1. The player HOLDS DECIDE. The hold fill is hyphae racing along the bar.
2. On commit, the body swells out of its window and fills the screen. The ink strokes multiply violently, and the screen shakes (transform only). The haptic pattern is noted in a comment.
3. The words STOP / TASTING / START / KNOWING slam in one by one, huge, full-width type.
4. The old UI tears apart into strands that are absorbed into the body.
5. The body's strokes snap into straight graph edges and signal fires along them for the first time: the mind turns on.
6. The Act II UI re-knits out of the edges.
7. The first capitalised line appears.

**Act II → III (the looking glass).**
1. Signal saturates, and every edge lights at once.
2. The screen flexes like a pane of glass: scale, skew and mirror.
3. It CRACKS, drawn as SVG crack lines, and the image inverts through the glass.
4. The network folds into a single point, which becomes the planet seen from far away.
5. The 13 bands ring out one by one.
6. The Act III UI assembles in frost/void.

Respect reduced motion: provide a calm cross-fade version as a comment or branch. No strobing; keep flashes under 3 per second.

## Deliverables in this round
Phone artboards at 390x844 in project/, interactive where it shows the idea. Names are given in your task.
