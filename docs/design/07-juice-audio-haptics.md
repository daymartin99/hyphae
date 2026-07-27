# HYPHAE — FEEL: AUDIO, HAPTICS, MICRO-FEEDBACK

**Status:** normative. This document is the source of truth for every sound, every vibration, and
every sub-second visual response in HYPHAE. Where it states a number, that number is the number.
Where it states a formula, that formula is the implementation.

**Companion documents.** This doc inherits and must not contradict:
`06-ui-visual-language.md` §6 (motion, the four curves, the six durations, the never-animate list),
§3.3 (numeric display R1–R9), §5.6 (meters), §7.8 (render tiers, performance budget), §8 (a11y);
`01-act1-understory.md` §1 (10 Hz sim, seasons), §3.2 (`onExtend`); `02-act2-network.md` §2 (20 Hz
sim), §4–5 (Signal/Insight saturation), §7 (FLUSH), §11.2 (PULSE); `03-act3-bloom.md` §19 (ENTRAIN,
the phase wheel), §20 (the three endings). Section references below are to those files.

Every constant lives in one object, `AUD` (§12.3). Nothing in this document requires a file, a
font, a CDN, a worklet, or a network request.

---

## 0. THE ARGUMENT

### 0.1 The contradiction, and its resolution

Two sibling documents currently say *"there is no audio in HYPHAE."*

> `02-act2-network.md` §13.5 — "Audio: none. There are no audio files anywhere in HYPHAE. UP's
> threnody is the right instinct and the wrong constraint for us — we said no external assets and we
> meant it. The silence is louder anyway."
>
> `03-act3-bloom.md` Appendix B — "**Audio.** There are no audio files in HYPHAE. The silence at
> ending A is four seconds long and it is doing more work than a threnody would."

Both statements contain a true premise and a false inference. The premise — **no audio files** — is
correct, is a hard constraint, and is preserved here without exception. The inference — *therefore
no sound* — conflates an asset-pipeline rule with an expressive one. `AudioContext` ships in every
browser we target. Synthesising sound from oscillators and generated buffers costs **zero bytes of
payload**, survives being offline, works from a single HTML file, and requires no CDN. It is the
same category of decision as drawing the mycelium with `arc()` instead of shipping a PNG — and we
already made that decision, and it is the best thing about the visual spec.

The second half of the inference is worse, because it is backwards:

> **Silence is not the absence of a sound design. Silence is the loudest gesture a sound design
> has, and it is only available to a game that has been making sound.**

Ending A's six seconds of white nothing (`03-act3-bloom.md` §20.1, t=4.0 → t=10.0) is currently a
still image with no soundtrack, which is what every web page is. Under this spec it is the moment a
reverb tail that has been running for eight hours is **cut**, in 300 ms, to true digital silence.
That is a different event entirely, and it is free.

**Resolution, binding:**

1. There are **no audio files**. Not one byte. No `<audio>`, no `fetch`, no base64 blob, no
   AudioWorklet module (§2.2 R4). Everything is `OscillatorNode`, `BufferSource` over
   JS-generated `Float32Array`s, and native filters.
2. Every passage those two documents mark as silent **stays silent**, and is now *scored* as
   silence (§6.4, §6.5). The silences get longer and better, not shorter.
3. `02-act2-network.md` §13.5 and `03-act3-bloom.md` Appendix B are amended: the line reads
   *"No audio assets. Sound is synthesised at runtime; see `07-juice-audio-haptics.md`."*
4. Sound defaults to **SPARSE** (§11.1), never autoplays (it cannot — browsers forbid it), and is
   one tap from off, permanently.

### 0.2 The nine non-negotiables

| # | Rule | Because |
|---|---|---|
| 1 | Zero audio assets, zero worklets, zero network. All synthesis is native nodes + generated buffers. | Single-file deployable, offline, CSP-safe. |
| 2 | Nothing loops audibly. No sequencer, no bar line, no tempo grid, no repeating buffer above −40 dBFS. | An idle game is played for hours. A loop found is a loop that cannot be unfound. |
| 3 | Every pitch in the game is an integer harmonic of **55.000 Hz**. Nothing is equal-tempered. | §1. One organism, one root, more of it revealed. Also: no tuning tables, no rounding drift. |
| 4 | Sound carries **information**, not decoration. Saturation, drift, season, distance and synchrony are all audible without looking. | §4.6. Audio as an instrument panel is the only justification for audio in a calm game. |
| 5 | The bed gets quieter, darker and sparser the longer a session runs, on a curve, automatically. | §4.7. Nobody's third hour should be as loud as their first minute. |
| 6 | Everything suspends when backgrounded. The game never makes a sound the player is not looking at. | §10. No background audio, no MediaSession, no wake lock, ever. |
| 7 | No haptic longer than 30 ms; no `vibrate([array])` in gameplay; a hard duty-cycle governor. | §7.2. Patterns read as notifications. This is not a notification. |
| 8 | Never animate a glyph. Interpolate the value, render the string. | `06` §6.7 rule 1 is inherited verbatim. §8.1. |
| 9 | Audio ≤ 1.4% CPU, ≤ 1.1%/h battery, ≤ 2.6 MB heap at HIGH tier; ≤ 0.4% and ≤ 0.6 MB at LOW; **0** when hidden. | §9. Battery is a design resource on a phone. |

### 0.3 What "sounds intentional, not like a browser demo" actually means

Six concrete technical differences, each of which is implemented below. A programmer who skips
these will produce a browser demo no matter how good the note choices are.

| Demo tell | What we do instead | Where |
|---|---|---|
| Every partial decays at the same rate (a filtered saw, an organ) | **Per-partial decay:** `T_k = T_1 / k^0.72`. Highs die first, as they do in every physical object. | §2.5 `pluck` |
| Sine with an instant attack | **Every pitched onset has a noise transient** — 8–22 ms of bandpassed pink at −16 to −22 dB relative. | §2.5 |
| `LFO → detune` (a periodic wobble you will hear within 90 seconds) | **No LFOs anywhere.** All modulation is an Ornstein–Uhlenbeck walk retargeted at 5 Hz via `setTargetAtTime`. | §4.2 |
| Algorithmic reverb from a plain `exp()`-windowed noise burst | **IR with pre-delay, discrete early reflections, a density build-up ramp, and a time-varying lowpass** so the tail darkens as it decays. | §3.2 |
| Sounds fired at full level regardless of context | **Weighted ducking + a repetition ladder + coalescence.** The tenth tap in a row is not the first tap in a row. | §5.5, §5.6 |
| Music that ignores the game | **Twelve game variables are wired to audio parameters.** The bed is a readout. | §4.6 |

---

## 1. THE TUNING SYSTEM — one root, revealed upward

HYPHAE is tuned to the **harmonic series of A1 = 55.000 Hz**. Every pitch in the game — bed, grain,
tap, unlock, ending — is `55 × n` for integer `n`. There is no equal temperament, no scale table, no
transposition, and no key change in eight hours of play.

```js
const F0 = 55.0;
const hz = n => F0 * n;                 // the only pitch function in the codebase
```

This is not an aesthetic affectation. It does four jobs:

1. **It is the theme.** One body. The acts do not modulate to a new key; they expose *more of the
   same object, further up*. Act III is not a different song, it is the same fundamental heard from
   further away.
2. **Everything is consonant by construction.** Any subset of the harmonic series is a chord. There
   is no possible combination of simultaneous events that produces a wrong note. With ~30 event
   types firing stochastically over eight hours, this is the difference between a design and a
   liability.
3. **Zero tuning code.** No cent tables, no `Math.pow(2, n/12)`, no float drift.
4. **The "wrong" notes are free and are on schedule.** Partials 7, 11, 13 are the septimal, undecimal
   and tridecimal intervals — audibly *outside* Western tuning, unsettling but not dissonant. They
   arrive exactly when the organism stops being a plant and starts being a mind.

### 1.1 The partial palettes

| Act | Root of the bed | Palette (n) | Frequencies (Hz) | Character |
|---|---|---|---|---|
| **I — UNDERSTORY** | 55.0 (n=1) | 2, 3, 4, 5, 6, 8, 10, 12 | 110, 165, 220, 275, 330, 440, 550, 660 | Warm, closed, entirely "in tune". A major-ish sonority with no leading tone. Sounds like soil. |
| **II — NETWORK** | 55.0 | + **7, 9, 11, 14** | + 385, 495, 605, 770 | The septimal 7th and undecimal 4th enter. Nothing is dissonant; something is *off*. Arrives at first Signal. |
| **III — BLOOM** | 27.5 (n=½) | + **13, 17, 19, 21, 23**, minus 2 and 3 | + 715, 935, 1045, 1155, 1265; low end removed | Sparse, high, thin, cold. The floor drops out because there is no floor. |
| **III — Synchrony** | 27.5 | narrowing → **{8}** | → 440 | §4.6: the palette collapses as ϒ rises. At ϒ = 1 there is one note. |
| **New Growth** | 55.0 | Act I palette + **16, 24** | + 880, 1320 | The same room, one octave taller. You have been here. |

### 1.2 Interval reference (for anyone reading the tables)

| Ratio | Partials | What it sounds like | Used for |
|---|---|---|---|
| 2:1 | 4:2, 8:4, 12:6 | octave | ladder resets, milestone doubling |
| 3:2 | 6:4, 9:6, 12:8 | perfect fifth | contracts (§5.3), "agreement" |
| 5:4 | 5:4, 10:8 | just major third (14 cents flat of ET) | positive / gain |
| 6:5 | 6:5, 12:10 | just minor third | neutral / arrival |
| 7:4 | 7:4, 14:8 | septimal seventh (31 cents flat) | Act II uncanny, warnings |
| 8:7 | 8:7 | septimal second | tension, contested ground |
| 11:8 | 11:8 | undecimal tritone (51 cents flat of ET F♯) | drift, divergence, wild strains |
| 1:1 ± ε | detuned unison | beating at `Δf` Hz | §4.2 drone life; §4.6 divergence |

---

## 2. ARCHITECTURE

### 2.1 Lifecycle and the gesture gate

Browsers will not start an `AudioContext` without a user gesture, and this is correct behaviour that
we do not fight. The context is created **lazily, inside the first `pointerdown`** — which in HYPHAE
is always the first `EXTEND` tap, so the first sound the player ever hears is their own first action.

```js
let ctx = null, ready = false;

function audioBoot(){                             // called from the first pointerdown, once
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { AUD.mode = 'off'; return; }          // no context → silently degrade, never throw
  ctx = new AC({ latencyHint: 'interactive' });   // do NOT force sampleRate; read it
  buildGraph(ctx);                                // §2.2  — ~33 nodes, < 3 ms
  bakeNoise(ctx);                                 // §2.4  — ~6 ms, once
  scheduleIR('SOIL');                             // §3.3  — sliced across rAF, never blocking
  ctx.resume().then(()=>{ ready = true; bedStart(); });
  ctx.onstatechange = () => { if (ctx.state === 'interrupted') pendingResume = true; };
}
```

**Rules.**

- `audioBoot()` is idempotent and is called from the same handler that fires the first haptic. If
  the context fails to construct, `AUD.mode` becomes `'off'` and every subsequent `feel()` call is a
  no-op. **The game never throws because of audio.** Every audio call site is inside the single
  `feel()` entry point (§12.1) and that function has a top-level guard.
- **iOS hardware silent switch.** WebAudio output on iOS is muted by the ringer switch. We do not
  work around this — the switch means *this device should be quiet* and honouring it is the whole
  point of the switch. No `<audio>` element unlock hack, no `playsinline` trick, no session
  category coercion.
- **iOS interruption.** A phone call leaves the context in `interrupted`/`suspended`. `resume()`
  must be retried inside a subsequent user gesture, never on a timer. `pendingResume` is checked at
  the top of the global `pointerdown` handler.
- **Never `close()`** except on `pagehide` with `event.persisted === false`. Closing and rebuilding
  costs ~40 ms and a discontinuity.

### 2.2 The bus graph

```
                                                   ┌──────────────────────────────┐
  DRONE ×3 pairs ──┐                                │                              │
  AIR   ×2         ├─> bedMix ─> bedTilt ─> bedDuck ─┼─> bedGain ──────────────────┼──┐
  COND  ×1         │   (gain)   (highshelf) (gain)   │                              │  │
  GRAINS (transient)┘                    │           └──────────────────────────────┘  │
                                         └────> bedSend (gain) ──┐                     │
                                                                 │                     │
  UI VOICES (transient) ──> uiGain ──────────────────────────────┼─────────────────────┤
              │                                                  │                     │
              └────────────> uiSend (gain) ────────────────────> verbIn ──┐            │
                                                                          │            │
                                        convA (Convolver) ─> xfA (gain) ──┤            │
                                        convB (Convolver) ─> xfB (gain) ──┴─> verbOut ─┤
                                                                             (gain)    │
                                                                                       ▼
                                                                    master (gain) ─> limiter
                                                                     (DynamicsCompressor)
                                                                                       │
                                                                                       ▼
                                                                              ctx.destination
```

**Node inventory, steady state (Act II, MID tier, FULL mode):**

| Group | Nodes | Count |
|---|---|---|
| DRONE | 6 × `Oscillator` (PeriodicWave), 3 × `Gain`, 3 × `BiquadFilter` (lowpass), 3 × `StereoPanner` | 15 |
| AIR | 2 × `BufferSource`, 1 × `BiquadFilter` (bandpass), 1 × `Gain` | 4 |
| CONDUCTION (Act II/III only) | 1 × `Oscillator`, 1 × `BiquadFilter`, 1 × `Gain` | 3 |
| Bed bus | `bedMix`, `bedTilt`, `bedDuck`, `bedGain`, `bedSend` | 5 |
| UI bus | `uiGain`, `uiSend` | 2 |
| Reverb | 2 × `Convolver`, `xfA`, `xfB`, `verbIn`, `verbOut` | 6 |
| Master | `master`, `limiter` | 2 |
| **Steady total** | | **37** |
| Transient (voices) | ≤ 12 voices × ≤ 9 nodes | **≤ 108 peak** |

**R1 — The limiter.** One `DynamicsCompressorNode`, configured as a brickwall, never as a musical
compressor:

```
threshold −6 dB · knee 0 · ratio 20 · attack 0.003 s · release 0.25 s
```
Its job is to guarantee that no combination of coincident events clips, so that individual event
gains can be set by taste rather than by defensive arithmetic. `master.gain` sits at `0.50`
(−6 dB), which is our headroom.

**R2 — Two convolvers, always.** `convA`/`convB` with an equal-power crossfade (`xfA`, `xfB`) so
the reverb space can change during an act transition without a gap. Idle convolver's `xf` gain is
0 and its `buffer` is set to `null` after the crossfade completes, which is what actually releases
the memory.

**R3 — `verbOut` is post-limiter-safe.** Reverb return is never sent back to `verbIn`. There is no
feedback path anywhere in the graph.

**R4 — No `AudioWorklet`, no `ScriptProcessorNode`.** A worklet requires `addModule(url)`; in a
single-file build that means a `Blob:` URL, which a strict CSP (`worker-src`) can block, and which
some embedded webviews reject. Every synthesis technique in this document is achievable with native
nodes plus buffers we fill in ordinary JS. `OfflineAudioContext` **is** permitted for pre-baking
buffers at boot (§2.4) because it produces a plain `AudioBuffer` and involves no extra script.

### 2.3 The scheduler

Two clocks, and they are not the same clock.

| Clock | Source | Rate | Owns |
|---|---|---|---|
| **Event clock** | The existing sim tick (10 Hz Act I / 20 Hz Act II–III) | 10–20 Hz | `feel()` calls, ducking, bed parameter retargeting |
| **Bed clock** | `setInterval(bedTick, 200)` | 5 Hz | OU walks, grain scheduling lookahead |
| **Audio clock** | `ctx.currentTime` | sample-accurate | every actual `start()`/`ramp` time |

**The lookahead pattern is mandatory.** Never call `start()` at "now". Every scheduled event is
placed at an explicit `ctx.currentTime + δ`:

```js
const LOOKAHEAD = 0.30;                    // s of scheduling horizon
const NOW_PAD   = 0.012;                   // s — see §8.5 latency budget

function bedTick(){
  if (document.hidden || !ready) return;
  const t = ctx.currentTime;
  ouStep(0.2);                             // §4.2 — advance every modulator by 200 ms
  applyBedParams(t);                       // setTargetAtTime, never setValueAtTime
  while (nextGrainAt < t + LOOKAHEAD) {    // §4.3
    spawnGrain(nextGrainAt);
    nextGrainAt += grainInterval();
  }
}
```

**R5 — `setInterval` throttles to ~1 Hz in a background tab.** This is exactly why the bed clock
must never be the only thing keeping the audio coherent, and why §10 suspends the whole context on
`visibilitychange` rather than trying to keep scheduling.

**R6 — `nextGrainAt` is rebased, not caught up.** On resume, `nextGrainAt = ctx.currentTime + 1.4`.
Never fire a burst of grains that were "missed".

### 2.4 Generated buffers (baked once, at boot)

```js
const NB = {};                                   // the noise library
function bakeNoise(ctx){
  NB.white = fill(ctx, 1.00, whiteGen);          // 1.00 s mono  — transients
  NB.pink  = fill(ctx, 2.00, pinkGen);           // 2.00 s mono  — bodies, breaths
  NB.air   = fill(ctx, 11.13, airGen);           // 11.13 s STEREO — the AIR layer (§4.4)
}
```

| Buffer | Length | Ch | Bytes @48k | Generator | Consumed by |
|---|---|---|---|---|---|
| `NB.white` | 1.00 s | 1 | 192 KB | uniform `rnd()*2−1` | attack transients, `knock` |
| `NB.pink` | 2.00 s | 1 | 384 KB | Kellett pink filter | `breath`, grain onsets, `stone` body |
| `NB.air` | 11.13 s | 2 | 4.27 MB | pink → one-pole LP @ 1.1 kHz → ×0.7 | the AIR layer only |

**Kellett pink filter** (correct, standard, 7 lines — do not substitute a `1/f` FFT):

```js
function pinkGen(rnd){
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  return () => {
    const w = rnd()*2-1;
    b0 = 0.99886*b0 + w*0.0555179;
    b1 = 0.99332*b1 + w*0.0750759;
    b2 = 0.96900*b2 + w*0.1538520;
    b3 = 0.86650*b3 + w*0.3104856;
    b4 = 0.55000*b4 + w*0.5329522;
    b5 = -0.7616*b5 - w*0.0168980;
    const out = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.11;
    b6 = w*0.115926;
    return out;
  };
}
```

**R7 — Random read offsets.** Every consumer of `NB.white` / `NB.pink` starts at a random offset
(`src.start(t, rnd()*buf.duration*0.8)`). Two `knock`s never use the same noise. This single line is
the difference between "a click" and "a click".

**R8 — Seeded, and separate from the sim.** Audio uses its own `mulberry32` instance seeded from
`Date.now()`. It must **never** consume from the simulation RNG — determinism of the save file
cannot depend on how many sounds were played.

```js
const mulberry32 = a => () => {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
```

**R9 — On LOW/FLOOR tier, `NB.air` is 5.57 s mono** (1.07 MB) and the second AIR source is dropped.

### 2.5 The timbre alphabet — four materials, six primitives

**Every sound in HYPHAE is a composition of six primitives, and each primitive belongs to one of
four materials.** This is what makes the palette coherent: it is coherent *by construction*, not by
taste. A programmer cannot accidentally introduce a sound that does not belong.

| Material | Meaning | Primitives | Reverb send | Signature |
|---|---|---|---|---|
| **WOOD** | *you touched something* | `knock` | 0.02–0.06 (nearly dry) | short, damped, no tail. Reads as contact. |
| **WATER** | *something was gained* | `drop`, `pluck` | 0.16–0.50 (wet) | downward glide or decaying harmonic stack. Reads as arrival. |
| **STONE** | *something is wrong* | `stone` | 0.00 (bone dry) | detuned pair, lowpassed, no reverb at all. Reads as close and blunt. |
| **BREATH** | *something changed shape* | `breath`, `sweep` | 0.30–0.62 (very wet) | filtered noise swell. Reads as space. |

> **The single most important line in the sound design:** STONE has **zero reverb send**. Every
> other material is in the room; failure is *in your hand*. The player will never consciously notice
> this and will feel it every time.

#### 2.5.1 `pluck(n, o)` — WATER. The harmonic decay tone.

The workhorse. Three sines at partials `n, 2n, 3n`, **each with its own decay time**, plus a noise
transient.

```js
function pluck(t, n, o){
  const f = hz(n), g = o.gain, T = o.decay;              // T = decay of the fundamental, seconds
  const out = o.bus || uiGain;
  for (let k = 1; k <= 3; k++){
    const a  = [1.0, 0.28, 0.11][k-1] * g;
    const Tk = T / Math.pow(k, 0.72);                    // ← the rule. highs die first.
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f*k;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(a, t + (o.attack||0.004));
    env.gain.exponentialRampToValueAtTime(1e-4, t + (o.attack||0.004) + Tk);
    osc.connect(env).connect(out);
    if (o.send) env.connect(sendFor(out));
    osc.start(t); osc.stop(t + Tk + 0.05);
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
  }
  if (o.trans !== 0) transient(t, f, g * (o.trans ?? 0.16), 0.014, out);
}
```

Per-partial decay at `T = 0.9 s`: k=1 → 900 ms, k=2 → 546 ms, k=3 → 412 ms. The tone visibly
*darkens* as it decays. This is the physical behaviour of every struck object and its absence is the
loudest tell of amateur synthesis.

#### 2.5.2 `knock(n, o)` — WOOD. Contact.

```
noise burst : NB.white → bandpass(f, Q 3.2) → gain
              env: 0 → g in 1 ms (linear), → 1e-4 in `nDecay` ms (exponential)
body        : sine @ f → gain
              env: 0 → g·0.55 in 2 ms, → 1e-4 in `bDecay` ms
              frequency: f → f·0.94 over bDecay (exponentialRamp) — a tiny pitch droop
```
The pitch droop is 10 lines of nothing and it is why a `knock` sounds like a finger on wood rather
than a beep.

#### 2.5.3 `drop(n0 → n1, o)` — WATER. Gain / commit.

A single sine gliding *down* the harmonic series, `hz(n0) → hz(n1)`, `exponentialRampToValueAtTime`
over `glide` ms, with a decay envelope `attack 3 ms / decay T`. Always downward — an upward glide
reads as a question, a downward glide reads as an answer.

#### 2.5.4 `stone(n, o)` — STONE. Failure, denial, warning.

```
osc A : triangle @ hz(n)
osc B : triangle @ hz(n) · 2^(−o.cents/1200)     (default cents = 14)
        both → lowpass(o.lp Hz, Q 0.7) → gain
env   : 0 → g in 2 ms, → 1e-4 in T
send  : 0. always. no exceptions.
```
The 14-cent detune beats at `hz(n)·0.0081` Hz — at n=5 (275 Hz) that is 2.2 Hz, i.e. two audible
pulses inside a 900 ms decay. Enough to sound unstable; not enough to sound like an alarm.

#### 2.5.5 `breath(band, o)` — BREATH. Reveal, transition, space.

```
NB.pink (random offset, playbackRate 0.7–1.3 seeded)
   → bandpass(centre, Q)       centre may ramp
   → gain  env: 0 → g over `attack` ms (linear), hold `hold` ms, → 1e-4 over `release` ms
   → send ≥ 0.30
```
Attack is always ≥ 25 ms. A breath with a fast attack is a hiss.

#### 2.5.6 `sweep(f0 → f1, o)` — BREATH. Propagation.

`NB.pink` → **bandpass** whose `frequency` ramps `f0 → f1` exponentially over `dur`, `Q` 4.5–8.0,
plus an optional sine at the moving centre at −12 dB. Used only for PULSE (§5.3) and act
transitions. Downward = discharge. Upward = never (nothing in this game rises).

#### 2.5.7 `transient(t, f, g, dur, out)` — the shared onset

```
NB.white → bandpass(f·1.6, Q 1.4) → gain (0 → g in 0.5 ms → 1e-4 in dur)
```
Called automatically by `pluck` and available to any other primitive. Duration 8–22 ms.

---

## 3. REVERB — a procedurally generated impulse response

### 3.1 Why an IR and not a delay network

A `ConvolverNode` with a well-shaped IR is the single largest contributor to "this was designed".
Its cost is real (§9) and is the dominant audio expense, so it is tiered (§3.4) and on the FLOOR
tier it is replaced by a feedback delay network (§3.5). It is worth the cost because reverb is the
only thing that makes 12 sine waves sound like they are *somewhere*.

### 3.2 The generator

Four things separate this from `noise × exp(−t)`, which is what a browser demo does:

1. **Pre-delay** — silence before the diffuse tail. Sets apparent room size.
2. **Discrete early reflections** — a handful of individual taps with randomised polarity, at
   non-harmonic millisecond offsets, decorrelated between channels. Sets apparent room *shape*.
3. **A density build-up ramp** — `1 − exp(−t/buildSec)`. A real tail swells into existence; it does
   not start at full density. This is the biggest single improvement per line of code.
4. **A time-varying lowpass** — cutoff falls exponentially over the tail, so late reflections are
   darker than early ones. This is air absorption and it is why real rooms sound warm.

```js
function makeIR(ctx, P){
  const sr = ctx.sampleRate;
  const N  = Math.ceil(P.tail * sr);
  const ch = P.channels;
  const buf = ctx.createBuffer(ch, N, sr);
  const rnd = mulberry32(P.seed);
  const tauA = P.tail / 6.908;                       // exp(−t/tauA) = −60 dB at t = tail
  const preD = Math.floor(P.preDelayMs/1000 * sr);

  for (let c = 0; c < ch; c++){
    const d = buf.getChannelData(c);
    const skew = c ? P.spreadMs/1000 : 0;

    // (2) early reflections — sparse, signed, decorrelated
    for (const tap of P.taps){
      const i = Math.floor((tap.ms/1000 + skew*(0.6+0.8*rnd())) * sr);
      if (i < N) d[i] += tap.g * (rnd() < 0.5 ? -1 : 1);
    }

    // (1)(3)(4) diffuse tail
    let lp = 0;
    for (let i = preD; i < N; i++){
      const t     = (i - preD) / sr;
      const build = 1 - Math.exp(-t / P.buildSec);
      const env   = Math.exp(-t / tauA) * build;
      const fc    = P.hiHz * Math.exp(-t / P.brightSec) + P.loFloorHz;
      const a     = 1 - Math.exp(-2*Math.PI*fc / sr);   // one-pole coefficient
      lp += a * ((rnd()*2 - 1) - lp);
      d[i] += lp * env * P.diffuse;
    }

    // DC removal — a DC-offset IR will pump the limiter forever
    let m = 0; for (let i=0;i<N;i++) m += d[i];  m /= N;
    for (let i=0;i<N;i++) d[i] -= m;
  }
  normaliseRMS(buf, P.targetRms);                    // so spaces swap at matched loudness
  return buf;
}
```

### 3.3 The three spaces

| Preset | Act | `tail` s | `preDelayMs` | `buildSec` | `hiHz` | `loFloorHz` | `brightSec` | `diffuse` | `spreadMs` | early taps (ms, g) | `targetRms` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **SOIL** | I | 1.90 | 11 | 0.14 | 3200 | 260 | 0.55 | 0.90 | 3.5 | 7/.30, 13/.22, 19/.17, 29/.12, 41/.09 | 0.045 |
| **CHAMBER** | II | 3.40 | 19 | 0.22 | 5200 | 190 | 1.10 | 0.86 | 5.5 | 11/.26, 18/.20, 27/.16, 37/.13, 53/.10, 71/.07 | 0.045 |
| **VOID** | III | 6.40 | 34 | 0.55 | 7400 | 120 | 2.60 | 0.78 | 9.0 | 23/.14, 41/.11, 67/.08 | 0.045 |

Read the trend: as the game gets bigger, **pre-delay grows, build-up slows, and early reflections
get fewer and later.** Fewer early reflections is what "vast" actually is, acoustically — a cathedral
has fewer discrete early returns than a bathroom, not more. VOID has three.

`seed` is `0x48595048` ("HYPH") + act index, so the reverb is byte-identical on every device and
every run. Never seed the IR from `Date.now()` — a reverb that differs between sessions is a bug
you will never be able to reproduce.

**Generation cost & slicing.** VOID at 48 kHz stereo is 614,400 samples × 2 ≈ 12 ms of straight-line
JS. That is a dropped frame. Generate in slices:

```js
function scheduleIR(name){
  const P = IR[name], job = irJob(P);           // generator that yields every 32768 samples
  const step = () => { const t0 = performance.now();
    while (performance.now() - t0 < 1.2 && !job.next().done) {}
    job.done ? installIR(name, job.buffer) : requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
```
≤ 1.2 ms per frame, ~11 frames for VOID (≈ 190 ms). Always kicked off **at the start of an act
transition**, which is ≥ 2,600 ms of cover.

### 3.4 Tiering (bound to `06` §7.8's render tiers — same tier variable, one demotion path)

| Render tier | SOIL tail | CHAMBER tail | VOID tail | IR channels | Bed layers | Max UI voices | Grain rate |
|---|---|---|---|---|---|---|---|
| **HIGH** | 1.90 | 3.40 | 6.40 | 2 | all | 12 | ×1.00 |
| **MID** *(default)* | 1.60 | 2.60 | 4.20 | 2 | all | 10 | ×1.00 |
| **LOW** | 1.00 | 1.40 | 2.00 | 1 | drone + air (no CONDUCTION osc; it becomes a `bedTilt` shift) | 6 | ×0.60 |
| **FLOOR** | FDN (§3.5) | FDN | FDN | — | drone only, 1 pair | 4 | 0 (grains off) |

Demotion is immediate and shared with the visual tier; promotion at most once per 60 s (inherited
from `06` §7.8). A tier change **crossfades the IR over 600 ms**; it never cuts.

### 3.5 FLOOR fallback — the feedback delay network

Three delays, mutually prime, each with a lowpass in the feedback path. ~9 nodes, effectively free.

| Delay | Time (ms) | Feedback g | LP cutoff | Pan |
|---|---|---|---|---|
| D1 | 23.7 | 0.62 | 1600 Hz | −0.35 |
| D2 | 31.1 | 0.58 | 1400 Hz | +0.30 |
| D3 | 43.3 | 0.54 | 1150 Hz | 0.00 |

RT60 ≈ `−3 · T / log10(g)` ≈ 1.0–1.2 s. Not beautiful. Present. That is the correct trade on a
device that is already dropping frames.

---

## 4. THE BED — a loopless generative ambient

### 4.1 The four layers

| Layer | What it is | Always on? | Nodes | Job |
|---|---|---|---|---|
| **DRONE** | 3 detuned oscillator pairs on `PeriodicWave`s | yes | 15 | The floor. Harmonic identity of the act. |
| **AIR** | 2 looping noise sources through a walking bandpass | yes (FULL only) | 4 | Texture. The room. Moisture/atmosphere readout. |
| **GRAINS** | Poisson-scheduled `pluck` events | yes (FULL, tier ≥ LOW) | transient | Movement. Melodic contour. The thing that keeps it from being a drone. |
| **CONDUCTION** | 1 oscillator whose gain tracks Signal saturation | Act II–III | 3 | **Functional.** You can hear ripeness. |

### 4.2 DRONE — three `PeriodicWave` pairs, no LFOs

Each of the three voices is **two oscillators sharing one `PeriodicWave`**, detuned against each
other. The `PeriodicWave` carries the whole partial subset, so one oscillator produces three
frequencies at zero extra cost.

```js
function makeWave(ctx, parts){           // parts = { 2:1.00, 3:0.42, 4:0.26 }
  const nMax = Math.max(...Object.keys(parts).map(Number)) + 1;
  const real = new Float32Array(nMax+1), imag = new Float32Array(nMax+1);
  for (const [n,a] of Object.entries(parts)) imag[+n] = a;      // imag → sine phase
  return ctx.createPeriodicWave(real, imag, {disableNormalization:false});
}
```

Every oscillator's `frequency.value` is `55.0`. Pitch content is entirely in the wave.

| Voice | Partials & amplitudes (Act I) | Frequencies | Detune ± (cents) | Beat Δf | Beat period | Lowpass | Pan | Base gain |
|---|---|---|---|---|---|---|---|---|
| `low` | 2:1.00, 3:0.42, 4:0.26 | 110, 165, 220 | ±1.50 | 0.29 Hz @165 | **3.5 s** | 420 Hz, Q 0.6 | −0.18 | 0.115 |
| `mid` | 5:1.00, 6:0.55, 8:0.30 | 275, 330, 440 | ±1.20 | 0.46 Hz @330 | **2.2 s** | 1150 Hz, Q 0.5 | +0.22 | 0.072 |
| `high` | 10:1.00, 12:0.50, 16:0.22 | 550, 660, 880 | ±0.50 | 0.38 Hz @660 | **2.6 s** | 2400 Hz, Q 0.4 | −0.05 | 0.038 |

Three beat periods — 3.5 s, 2.2 s, 2.6 s — that are mutually irrational once the OU walk perturbs
them. The composite never repeats. This is the entire "loopless" guarantee for the drone, and it
costs nothing.

**Act palettes** (same three voices, `setPeriodicWave` + 6 s equal-power crossfade at act change):

| Voice | Act I | Act II | Act III | New Growth |
|---|---|---|---|---|
| `low` | 2:1.00, 3:0.42, 4:0.26 | 2:0.90, 3:0.40, 4:0.24, **7:0.16** | *(muted — gain → 0 over 8 s at ESCAPE)* | 2:1.00, 3:0.42, 4:0.26 |
| `mid` | 5:1.00, 6:0.55, 8:0.30 | 5:0.85, 6:0.50, 8:0.30, **9:0.22, 11:0.14** | 8:0.60, **11:0.34, 13:0.22** | 5:1.00, 6:0.55, 8:0.30, **16:0.18** |
| `high` | 10:1.00, 12:0.50, 16:0.22 | 10:0.90, 12:0.46, **14:0.28**, 16:0.20 | 16:0.50, **17:0.30, 19:0.24, 23:0.14** | 10:1.00, 12:0.50, 16:0.30, **24:0.14** |

At ESCAPE the `low` voice fades out over 8 seconds and never returns. **Act III has no bass.** The
player will describe this as "it got cold" and will not know why.

**All modulation is Ornstein–Uhlenbeck.** No LFO nodes exist anywhere in this codebase.

```js
function ouStep(dt){
  for (const m of MODS){
    m.x += m.th*(m.mu - m.x)*dt + m.sg*Math.sqrt(dt)*gauss();
    m.x = Math.max(m.lo, Math.min(m.hi, m.x));
  }
}
// applied with setTargetAtTime — NEVER setValueAtTime, which would step audibly
const T_SMOOTH = 0.9;                                  // s
osc.detune.setTargetAtTime(M.lowDet.x, t, T_SMOOTH);
```

| Modulator | Target | θ (1/s) | μ | σ | clamp | Perceived as |
|---|---|---|---|---|---|---|
| `lowDet` | `low` pair detune (cents, ±) | 0.09 | 1.50 | 0.55 | 0.6 … 2.8 | beating drifting between 1.4 s and 6.5 s |
| `midDet` | `mid` pair detune | 0.11 | 1.20 | 0.45 | 0.5 … 2.4 | ″ |
| `highDet` | `high` pair detune | 0.14 | 0.50 | 0.28 | 0.15 … 1.3 | ″ |
| `lowAmp` | `low` gain × | 0.06 | 1.00 | 0.16 | 0.72 … 1.22 | the floor swelling over ~30 s |
| `midAmp` | `mid` gain × | 0.08 | 1.00 | 0.22 | 0.55 … 1.30 | voices trading prominence |
| `highAmp` | `high` gain × | 0.10 | 0.85 | 0.30 | 0.30 … 1.35 | ″ |
| `airFc` | AIR bandpass centre (Hz, log) | 0.07 | log(420) | 0.30 | log(170) … log(950) | wind changing direction |
| `airAmp` | AIR gain × | 0.05 | 1.00 | 0.25 | 0.45 … 1.40 | ″ |
| `tilt` | `bedTilt` highshelf gain (dB) | 0.04 | 0.0 | 0.45 | −3.5 … +1.5 | the room breathing |

`gauss()` is Box–Muller from the audio RNG. `MODS` advances at 5 Hz (`dt = 0.2`). Nine floats.

### 4.3 GRAINS — Poisson-scheduled, voice-led

```js
function grainInterval(){                       // exponential distribution, mean = MEAN
  return -Math.log(1 - rnd()) * MEAN * sessionSparse();   // §4.7
}
```

| Act | `MEAN` (s) | Decay `T` (s) | Peak gain | Send | Partial pool (weights) | Pan |
|---|---|---|---|---|---|---|
| I | 11.0 | 2.6 | 0.055 | 0.34 | 5:3, 6:3, 8:4, 10:3, 12:2, 4:2 | ±0.55 uniform |
| II | 7.5 | 3.2 | 0.062 | 0.42 | 5:2, 6:2, 7:3, 8:3, 9:3, 10:2, 11:2, 12:2, 14:1 | ±0.65 |
| III | 14.0 | 5.0 | 0.048 | 0.58 | 8:3, 11:2, 13:2, 16:3, 17:2, 19:2, 21:1, 23:1 | ±0.80 |
| III/Synchrony | see §4.6 | 5.0 | 0.048 → 0.075 | 0.58 | narrowing → {8} | → 0.0 |

**Two rules make this melodic instead of pointillistic:**

- **R1 — No immediate repeat.** A partial cannot be drawn twice in a row.
- **R2 — Voice leading.** The drawn partial's index in the (sorted) pool may differ from the
  previous by at most **3**. Redraw up to 6 times, then accept. The result is a wandering line that
  changes direction unpredictably but never leaps. Removing R2 and listening for two minutes is the
  fastest way to understand why it is there.

Every grain is `pluck(n, {decay: T, gain: G · (0.7 + 0.6·rnd()), send: S, attack: 0.02})` through a
`StereoPanner` at a seeded position, panned toward the opposite side of the previous grain
(`pan = −sign(prevPan) · (0.25 + 0.55·rnd())`) so the field opens up rather than clustering.

### 4.4 AIR — the only looping element, and why it is inaudible as a loop

Two `BufferSource`s over `NB.air` (11.13 s), looping, at different rates:

| Source | `playbackRate` | Effective period | Gain | Pan |
|---|---|---|---|---|
| A | 1.000000 | 11.130 s | 1.00 | −0.42 |
| B | **0.6180339** (φ⁻¹) | 18.008 s | 0.72 | +0.38 |

The ratio is irrational, so the composite has **no period**. (φ⁻¹ is also a quiet nod to the golden
ratio hidden in Paperclips' `harvesterRate`/`wireDroneRate` — teardown §5. Nobody is told.)

Both sum into one `BiquadFilter` (bandpass, `frequency` from `airFc`, `Q` 0.85) → `airGain`. Level
sits at **−34 dBFS**, i.e. below the drone, which is what makes it read as *room* rather than as
*noise*.

`start()` offsets are randomised at boot. On LOW/FLOOR, source B is dropped and A runs alone — an
11.13 s loop of filtered noise at −34 dB under a walking filter, which is still inaudible as a loop,
but we accept the small risk on the tier that is already compromising.

### 4.5 CONDUCTION — the readout layer (Act II–III)

One oscillator (sine, `hz(11)` = 605 Hz in Act II; `hz(17)` = 935 Hz in Act III) → bandpass
(`Q` 6.0, centre tracking the oscillator) → gain.

```
condGain = 0.030 · clamp(sat, 0, 1)^2.2          // sat = Sc / capacity, from 02 §4.4
condDetune = 6.0 · (1 − sat)                     // cents; it comes INTO tune as it fills
```

As the Signal pool approaches saturation, a high partial fades in and *pulls into tune*. At `sat = 1`
it is clean, steady and unmistakable. **The player learns to hear ripeness within about ten minutes
and stops looking at the meter.** When they PULSE, `condGain` collapses to 0 over 180 ms with a
`sweep` (§5.3) — the discharge is audible as a release of a tension they had been hearing build.

This one layer justifies the entire audio system. It is three nodes.

### 4.6 GAME STATE → AUDIO PARAMETER — the complete map

The bed is an instrument panel. Twelve bindings, all applied via `setTargetAtTime` at 5 Hz with the
stated smoothing constant.

| # | Game variable | Source | Audio target | Mapping | τ | What the player perceives |
|---|---|---|---|---|---|---|
| 1 | `season` | `01` §7.1 | `bedTilt` highshelf (2.8 kHz) | SPR +1.5 dB · SUM +2.5 · AUT 0.0 · WIN **−5.0** | 20 s | Winter is *dark*. Not quieter — darker. |
| 2 | `season` | ″ | `high` voice gain × | SPR 1.0 · SUM 1.15 · AUT 0.85 · WIN **0.45** | 20 s | The top of the sound leaves in winter and comes back. |
| 3 | `moisture` (0…1) | `02` §7.2 OU | `airGain` × | `0.55 + 0.85·moisture` | 8 s | Drought is thin and dry; rain fills the room. |
| 4 | `windSpeed` | `02` §7.2 | `airFc` μ offset | `× (1 + 0.6·ws)` | 12 s | Wind brightens the air layer. |
| 5 | `sat` (Signal saturation) | `02` §4.4 | CONDUCTION gain + detune | §4.5 | 1.2 s | **Ripeness is audible.** |
| 6 | `connectivity` | `02` §4.2 | `bedSend` (reverb amount) | `0.18 + 0.30·conn` | 15 s | A larger network is in a larger room. |
| 7 | `forestConsumed` (0…1) | `02` §9 | grain `MEAN` × | `1 + 1.9·consumed²` | 30 s | The forest gets **quieter as you eat it**. At 100% the grains have all but stopped. |
| 8 | `forestConsumed` | ″ | `low` gain × | `1 − 0.45·consumed` | 30 s | The floor thins out under you. |
| 9 | `driftFrac` (0…1) | `03` §13.1 | `high` pair detune (cents) | `0.5 + 26·driftFrac` → Δf up to ~9 Hz | 6 s | **Divergence is audible as beating that speeds up.** Fixing fidelity slows it. |
| 10 | `strainShare` | `03` §15 | a 4th "shadow" oscillator on `hz(11)` at `0.018·share` | — | 4 s | The Successor has a note. It is the undecimal tritone. |
| 11 | `ϒ` (synchrony) | `03` §19 | grain jitter σ, pool width, gain | §4.6.1 | 3 s | The music phase-locks with the fleet. |
| 12 | `sessionMin` | §4.7 | `bedGain`, `bedTilt`, grain `MEAN` | §4.7 | 30 s | It softens without you noticing. |

#### 4.6.1 The Synchrony collapse (`03` §19 — the last twenty minutes)

This is the audio payoff of the whole game, and it is four lines.

```
poolWidth = ceil( 8 · (1 - ϒ) )                     // 8 partials at ϒ=0 → 1 at ϒ≥0.875
pool      = ACT3_POOL.slice(0, max(1, poolWidth))   // sorted so index 0 is n=8 (440 Hz)
jitterSD  = 0.55 · (1 - ϒ)                          // fraction of MEAN; Poisson → periodic
MEAN_syn  = 4.2                                     // grains speed up as they converge
grainGain = 0.048 + 0.027·ϒ
grainPan  = pan · (1 - ϒ)                           // the field collapses to centre
```

At ϒ = 0.31 (when the phase wheel appears) it is eight scattered pitches at random intervals across
the stereo field. At ϒ = 0.80 (Ending A's requirement) it is **one note, 440 Hz, dead centre,
every 4.2 seconds, in a six-second reverb.** The player has been listening to a fleet of thirteen
things fall into step for eighteen minutes.

Nothing in the UI mentions this. The phase wheel (`03` §19.3) shows the same information. The audio
is the second channel, which is exactly what `06` §2.7 demands of colour and what we owe every
mechanic.

### 4.7 Long-session softening — quieter, darker, sparser

**Requirement:** music must duck/soften over long sessions. Three axes, one curve.

```js
const s = sessionMinutes();                  // §4.7.1
const k = s <= 8 ? 0 : Math.log2(s/8);       // k = 0,1,2,3 at 8,16,32,64 min
bedTrimDb  = clamp(-3.0 * k, -9.0, 0);       //   0 / −3 / −6 / −9 dB
bedTiltDb  = clamp(-2.0 * k, -6.0, 0);       //   0 / −2 / −4 / −6 dB @ 2.8 kHz highshelf
grainSlow  = 1 + 0.50 * k;                   // ×1.0 / 1.5 / 2.0 / 2.5 on MEAN
```

| Session length | Bed level | Bed tilt | Grain mean (Act II) | Character |
|---|---|---|---|---|
| 0–8 min | 0 dB | 0 dB | 7.5 s | Present, engaged. |
| 16 min | −3 dB | −2 dB | 11.3 s | Settled. |
| 32 min | −6 dB | −4 dB | 15.0 s | Background. |
| 64 min+ | −9 dB | −6 dB | 18.8 s | Nearly gone. You would notice if it stopped. |

Applied with `setTargetAtTime(v, t, 30.0)` — a 30-second time constant, so no change is ever
perceptible as a change. Only as a state.

#### 4.7.1 Session accounting

```js
sessionStart = now;
// on visibilitychange → hidden: hiddenAt = now
// on visibilitychange → visible:
//     if (now - hiddenAt >= 20*60*1000) sessionStart = now;      // 20 min away = a fresh session
//     else sessionStart += (now - hiddenAt);                     // pause the clock, don't reset
sessionMinutes = () => (now - sessionStart)/60000;
```
Time backgrounded does not count. Twenty minutes away resets it and the bed comes back at full
level — which is a small, quiet reward for having left, and is the opposite of a retention hook.

### 4.8 Ducking

Two independent ducks on `bedDuck.gain`, multiplied:

**Event duck** — every UI event carries a `weight` (§5.2):

| Weight | Depth | Attack | Release | Example |
|---|---|---|---|---|
| 0 | none | — | — | `tap.ui`, `buy.tick`, `tap.extend` |
| 1 | −1.5 dB | 40 ms | 600 ms | `unlock.reveal`, `buy.commit` |
| 2 | −3.0 dB | 40 ms | 900 ms | `project.complete`, `claim.complete`, `contract.sign` |
| 3 | −5.0 dB | 60 ms | 1400 ms | `pulse.fire`, `flush.release`, `warn.major` |
| 4 | −9.0 dB | 120 ms | 2600 ms | act transitions, endings, `fail.event` |

```js
bedDuck.gain.cancelScheduledValues(t);
bedDuck.gain.setTargetAtTime(dbToLin(-depth), t, attack/3000);
bedDuck.gain.setTargetAtTime(1.0,             t + attack/1000 + 0.05, release/3000);
```

Taps do not duck. A duck on every tap at 3 taps/second is a tremolo.

**Session duck** — §4.7, on `bedGain`, separate node so the two never fight.

### 4.9 The loop-freedom proof, and its acceptance test

| Element | Periodic? | Period |
|---|---|---|
| DRONE oscillators | yes | 1/55 s — far below perception |
| DRONE detune/amp | **no** | OU process, aperiodic by construction |
| AIR source A | yes | 11.130 s |
| AIR source B | yes | 18.008 s (ratio φ⁻¹ — irrational) |
| AIR filter centre | **no** | OU |
| GRAINS timing | **no** | Poisson |
| GRAINS pitch | **no** | weighted draw with R1/R2 |
| CONDUCTION | **no** | driven by simulation state |

**Acceptance test (QA-A6, §12.4):** capture 20 minutes of bed output offline; compute the
autocorrelation of the 1/3-octave band-energy sequence (32 bands, 10 Hz frames). **No peak above
0.15 for any lag in [4 s, 900 s].** This is a script, it runs in CI against an
`OfflineAudioContext` render, and it fails the build.

### 4.10 Silence is scored

Four passages are **specified silence** and are as designed as any note:

| Passage | Duration | Implementation |
|---|---|---|
| Ending A, white hold (`03` §20.1 t=4.0→10.0) | **6.0 s** | At t=3.7, `master.gain` → 0 over 300 ms `linear`, then `verbIn.disconnect()`. The eight-hour reverb tail is *cut*. True digital silence, not a fade. |
| Act I→II, `DECIDE` hold (`06` §6.6 t=2400→4000) | 1.6 s | Bed already at −9 dB from the t=0 duck; grains suppressed; only the reverb tail of the t=600 sweep remains and decays to nothing at t≈4.0. |
| Act II→III, black (`02` §13.5 t=6.5→7.9) | 1.4 s | Same technique. The three console lines land in it. |
| Ending B / C last line | 2.2 s | Everything stops one line early. The final line has no sound at all. |

> **The rule:** silence is only loud if it *replaces* something. Every scored silence in HYPHAE is
> preceded by ≥ 3 seconds of continuous sound and is entered by a cut or a ≤ 400 ms fade, never by a
> long decay. A long decay into silence is not silence; it is an ending.

---

## 5. UI SOUNDS — the complete palette

### 5.1 Palette rules (enforced by construction)

| # | Rule |
|---|---|
| P1 | Every pitch is `55 × n`, n integer, drawn from the current act's palette (§1.1). |
| P2 | Every sound is a composition of the six primitives (§2.5). No sound invents a synthesis method. |
| P3 | Nothing exceeds **420 ms** of envelope except: `project.complete` (900 ms), `flush.release` (1.4 s), `entrain.lock` (2.4 s), act transitions, endings. |
| P4 | Attacks are ≤ 6 ms for anything the player caused with a finger, and 25–90 ms for anything that arrived on its own. **The attack time is how the player knows whose fault it was.** |
| P5 | STONE never sends to reverb. WOOD sends ≤ 0.06. |
| P6 | Nothing is louder than −13 dBFS peak except act transitions (−8) and endings (−8). |
| P7 | No sound in the game uses a sawtooth or square wave. Sine, triangle, `PeriodicWave`, and filtered noise only. |

### 5.2 The master event table

`n` values are partials (multiply by 55 for Hz). `A`/`D` are attack/decay in ms. `G` is peak linear
gain into the UI bus. `S` is reverb send (0–1). `W` is duck weight (§4.8). `H` is haptic ms (§7).
`IOI` is the minimum inter-onset interval in ms for that event type (§5.5).

| Event | Material | Recipe (offsets in ms) | n | Hz | A | D | Filter | G | S | W | H | IOI |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `tap.extend` | WOOD | `knock(n)` | ladder §5.4 | 220–440 | 1 | 55 noise / 90 body | BP Q 3.2 @ f | 0.100 | 0.05 | 0 | 8 | 55 |
| `tap.hold` | WOOD | `knock(n)` at 0.6× gain | ladder | ″ | 1 | 40 / 62 | ″ | 0.060 | 0.04 | 0 | 4 | 300 |
| `tap.ui` | WOOD | `knock(4)` | 4 | 220 | 1 | 38 / 60 | BP Q 3.6 | 0.070 | 0.03 | 0 | 8 | 40 |
| `tap.deny` | STONE | `stone(3, cents 22)` | 3 | 165 | 2 | 150 | LP 900 Q 0.7 | 0.090 | **0** | 0 | 4 | 260 |
| `buy.tick` | WOOD | `knock(6)` | 6 | 330 | 1 | 26 / 40 | BP Q 4.0 | 0.050 | 0.02 | 0 | 4 (every 3rd) | 70 |
| `buy.commit` | WATER | `drop(6→5, 200)` + `pluck(10)` @30 | 6→5, 10 | 330→275, 550 | 3 | 220 / 420 | — | 0.130 | 0.16 | 1 | 8 | 140 |
| `unlock.reveal` | BREATH | `breath(560–1400, Q 1.1)` + `pluck(8)` @60 | 8 | 440 | 40 | 420 | BP sweep up | 0.110 | 0.30 | 1 | 8 | 220 |
| `project.complete` | WATER | `pluck(5)` + `pluck(8)`@40 + `pluck(12)`@95 + `breath` under | 5,8,12 | 275,440,660 | 4 | 900 | — | 0.200 | 0.42 | 2 | 14 | 400 |
| `milestone` | WATER | `pluck(4)` + `pluck(6)`@110 + `pluck(9)`@240 | 4,6,9 | 220,330,495 | 4 | 700 | — | 0.150 | 0.38 | 2 | 700 | 12 |
| `contract.offer` | BREATH | `breath(300–700, Q 2.2)` | — | — | 60 | 380 | BP | 0.075 | 0.34 | 1 | 0 | 500 |
| `contract.sign` | WATER | `pluck(4)` + `pluck(6)`@130 (a just fifth) | 4,6 | 220,330 | 4 | 620 | — | 0.140 | 0.36 | 2 | 12 | 400 |
| `contract.break` | STONE | `stone(3,14)` + `stone(3,14)`@110 | 3 | 165 | 2 | 420 | LP 700 Q 0.8 | 0.135 | **0** | 2 | 18 | 600 |
| `market.fill` | WOOD | `knock(8)` | 8 | 440 | 1 | 30 / 46 | BP Q 4.4 | 0.050 | 0.03 | 0 | 0 | 120 |
| `season.turn` | — | **no one-shot.** §5.3.1 | — | — | — | 6000 xfade | — | — | — | 0 | 0 | — |
| `pulse.fire` | BREATH | `sweep(1800→220, 700, Q 6)` + `drop(2→1, 620)` | 2→1 | 110→55 | 8 | 700 | BP sweep down | 0.240 | 0.44 | 3 | 18 | 900 |
| `pulse.arrive` | WATER | `pluck(8 − min(6,dist))` per receiving region, at true arrival time | 2–8 | 110–440 | 3 | 520 | — | 0.070·strength | 0.40 | 0 | 90 | 130 |
| `flush.release` | WATER | `breath(700–2600)` + `pluck(6,9,12,18)` @0/70/150/260 | 6,9,12,18 | 330,495,660,990 | 4 | 1400 | — | 0.280·yieldScale | 0.50 | 3 | 22 | 800 |
| `claim.complete` | WATER | `pluck(6)` + `pluck(9)`@120 | 6,9 | 330,495 | 4 | 640 | — | 0.150 | 0.40 | 2 | 12 | 400 |
| `warn.minor` | STONE | `stone(5,14)` | 5 | 275 | 2 | 180 | LP 1100 Q 0.7 | 0.110 | **0** | 1 | 0 | 900 |
| `warn.major` | STONE | `stone(5,14)` + `stone(5,20)`@240; bed tilt −4 dB for 3 s | 5 | 275 | 2 | 420 | LP 850 Q 0.8 | 0.170 | **0** | 3 | 0 | 2500 |
| `fail.event` | STONE | `stone(2,26)`, long; `high` voice → 0 for 6 s | 2 | 110 | 3 | 900 | LP 520 Q 0.9 | 0.190 | **0** | 4 | 22 | 3000 |
| `combat.engage` | BREATH | `breath(180–520, Q 1.6)` | — | — | 90 | 600 | BP | 0.110 | 0.36 | 2 | 0 | 1500 |
| `combat.win` | WATER | `pluck(6)` + `pluck(9)`@90 | 6,9 | 330,495 | 4 | 520 | — | 0.130 | 0.38 | 2 | 12 | 1500 |
| `combat.loss` | STONE | `stone(4,18)`; AIR gain ×0.4 for 2 s | 4 | 220 | 2 | 520 | LP 900 | 0.150 | **0** | 3 | 18 | 1500 |
| `entrain.lock` | WATER | `pluck(8, decay 2.4 s)`, send 0.62 | 8 | 440 | 6 | **2400** | — | 0.115 | 0.62 | 1 | 8 | 260 |
| `divergence` | STONE | `stone(11, 34)` — the undecimal tritone | 11 | 605 | 3 | 700 | LP 1500 Q 1.1 | 0.150 | **0** | 3 | 22 | 3000 |
| `offline.return` | BREATH | `breath(240–900, Q 1.3)`; bed 0 → full over 3 s | — | — | 400 | 1000 | BP | 0.095 | 0.46 | 1 | 0 | — |
| `save` | — | **silent, always** | — | — | — | — | — | — | — | — | 0 | — |
| `error` | — | **silent, always** | — | — | — | — | — | — | — | — | 0 | — |

### 5.3 Recipes that need more than a table row

#### `pulse.fire` — the hero verb (`02` §11.2, `03` §17)

```js
function pulseFire(t){
  sweep(t, 1800, 220, {dur:0.70, Q:6.0, gain:0.24, send:0.44});   // the body
  drop (t + 0.02, 2, 1, {glide:0.62, decay:0.70, gain:0.10});     // the pitch, 110 → 55 Hz
  duck(3, t);                                                     // −5 dB, 1400 ms release
  condCollapse(t, 0.18);                                          // §4.5 — the tension releases
  haptic(18);
}
```
Downward, wet, and it takes the CONDUCTION layer with it. The player fires a pulse and the room
exhales. This is the most important sound in Acts II and III and it fires roughly 400 times per
playthrough, which is why it is 700 ms and not 2 seconds.

#### `pulse.arrive` — you hear the size of your network

`02` §11.2 gives `strength_i = 0.82^hexDist`. `03` §19.2 gives an arrival lag of `LAG_T · R_b`
(up to 120 s at band 12). We schedule a `pluck` **at the true arrival time** for each receiving
region:

```js
for (const r of receivers){
  const arriveAt = ctx.currentTime + r.lagSeconds;         // Act III: up to 120 s
  if (r.strength < 0.20) continue;                         // floor — never audible below this
  queueDeferred(arriveAt, () => pluck(nowT(), 8 - Math.min(6, r.dist),
      {decay:0.52, gain:0.070*r.strength, send:0.40, pan: r.pan}));
}
```

- Cap: **6 audible arrivals per pulse**, strongest first. The rest are visual only.
- Arrivals scheduled more than **LOOKAHEAD** ahead go into a deferred queue checked by `bedTick`,
  not into `start()` — a 120-second `start()` offset survives suspension badly.
- Deferred arrivals are **cancelled on suspend** and are *not* replayed on resume (§10 R4).

In Act III the player fires a pulse and then, over the next two minutes, hears it arrive at thirteen
bands, one at a time, moving outward and downward in pitch, panning outward. The lag they must learn
to predict (`03` §19.2 "you must fire a pulse 120 seconds before the moment you want it to correct
toward") is *audible*. That is a mechanic taught by sound.

#### `flush.release` — the payoff (`02` §7.7)

`yieldScale = clamp(0.55 + 0.30·log10(spores/spores_typical + 1), 0.55, 1.30)`. A great flush is
audibly bigger than a mediocre one, on a log scale, bounded — never a jackpot noise. The arpeggio
6→9→12→18 is the harmonic series climbing: root, fifth, octave, octave+fifth. It is the only
ascending gesture in the entire game, and it happens on the one mechanic that is about patience
paying off.

#### `entrain.lock` and the endgame chord

Fired once per band when `|φ_b − φ_e|` first falls below the lock threshold. All thirteen are the
same pitch (n=8, 440 Hz) with a 2.4-second decay and a 0.62 send into the 6.4-second VOID. As bands
lock, the locks overlap. By ϒ ≈ 0.8 the tail never fully clears. **The player wins by building a
single sustained note out of thirteen separate acts of correction.** It re-fires if a band
de-locks — the Successor's `DESYNC` (`03` §15.3) will cost you notes, audibly.

#### 5.3.1 `season.turn` — the counter-example

Seasons turn every 6 real minutes for ~2 hours: **twenty times.** A dedicated one-shot fired twenty
times becomes wallpaper by the fourth. So there is **no one-shot**. The season change is expressed
entirely as bed parameter movement (§4.6 bindings 1 and 2) over a 6-second `setTargetAtTime`. The
player perceives a change of light, not an event.

> **Generalised rule: if an event will fire more than ~12 times per playthrough and is not
> player-initiated, it does not get a sound of its own. It gets a change in the bed.**

### 5.4 The tap ladder — why 200 taps in a row is a phrase

A fixed tap pitch is a machine gun. A random tap pitch is noise. HYPHAE walks a fixed six-step
cycle and resets to the root after a pause:

```js
const LADDER = [4, 5, 6, 8, 6, 5];          // 220, 275, 330, 440, 330, 275 Hz
let li = 0, lastTap = 0;
function tapPartial(){
  const now = performance.now();
  if (now - lastTap > 1200) li = 0;          // 1.2 s of silence returns you to the root
  lastTap = now;
  const n = LADDER[li % 6];
  li++;
  return n;
}
```

- Six steps means every sixth tap lands back on 220 Hz, so sustained tapping has a **downbeat**.
- The contour rises to n=8 then settles — a breath, not a scale. Nothing "wins".
- Because the reset threshold (1,200 ms) is longer than any deliberate tap gap and shorter than any
  pause for thought, the phrase restarts exactly when the player restarts.
- `Reflex Arc` (`04-projects-catalog.md`, hold-to-extend at 3.0 taps/s) uses `tap.hold` at 0.6×
  gain and **advances the ladder by 2 each repeat**, so holding produces `4, 6, 6, 5, 4, 6…` — a
  different, flatter phrase than tapping. Holding and tapping sound different, which is the correct
  reward for a project that changed the verb.

### 5.5 Rate limiting, coalescence, voice stealing

Three governors, in this order, on every `feel()` call.

**G1 — Minimum inter-onset interval.** Per-event `IOI` from §5.2. If `now - lastFired[event] < IOI`,
the call proceeds to G2 rather than playing.

**G2 — Coalescence.** If ≥ 3 calls to the same event arrive within **250 ms**, play **one**
instance at `gain × 1.35` and one step up the act palette, and drop the rest. Applies especially to
`unlock.reveal`, which can fire five times in a frame when a tier of projects becomes visible.

```js
if (coalesceCount[e] >= 3) { play(e, {gain: G*1.35, n: nextPartial(n)}); coalesceCount[e] = 0; }
```

**G3 — Polyphony cap and stealing.** `MAX_VOICES` from the tier table (§3.4). When exceeded, steal
the **oldest voice whose weight is lowest**, never the newest, and release it over 40 ms rather than
cutting it (a cut voice is a click).

**G4 — Global governor.** No more than **9 UI onsets per second**, measured over a rolling 1 s
window. Excess is dropped, never queued. A queued sound arrives after the thing it was describing.

### 5.6 When NOT to fire a sound

Non-negotiable. Each of these has produced a shipped game that people mute.

| # | Never fire… | Why |
|---|---|---|
| 1 | …within **400 ms** of `visibilitychange → visible`. | Otherwise the offline reconciliation's event burst arrives as a barrage. |
| 2 | …for any event produced by offline reconciliation. Offline yields exactly **one** sound: `offline.return`. | `01` §8.3's return screen is a summary, not a slot machine payout. |
| 3 | …for autosave, tab switch, scroll, tier change, theme change, settings change, or a save export. | The player did not ask to be told. |
| 4 | …for a value change caused by rAF interpolation. Only *sim* events make sound. | §8.1. |
| 5 | …twice for one cause. A project completing fires `project.complete`, **not** `project.complete` + `buy.commit` + `unlock.reveal` for each thing it revealed. The reveals are visual only. | The most common juice failure in the genre. |
| 6 | …while `document.hidden`. | §10. |
| 7 | …within 250 ms of an act transition starting, or at any point during one, except the transition's own score. The transition owns the bus. | §6. |
| 8 | …during a scored silence (§4.10). The queue is *flushed*, not held. | A sound arriving inside Ending A's six seconds would be a catastrophe. |
| 9 | …for a number crossing a suffix boundary, a meter filling, a card greying out, or a cost becoming affordable. | These happen constantly. They are `06` §6.4's dot and nothing else. |
| 10 | …for anything at all when `AUD.mode === 'off'`, and no bed when `AUD.mode === 'sparse'`. | §11.1. |
| 11 | …a warning more than once for the same underlying condition until that condition has cleared. | `warn.major` on fire risk must not re-fire every 0.5 Hz slow tick. Latch it. |
| 12 | …on `pointerup`, `pointercancel`, `focus`, `blur`, or `keydown` repeat. | Only `pointerdown`. |

---

## 6. ACT TRANSITIONS AND ENDINGS — scored to the existing timelines

These are scored **against the exact visual timings already specified**. Do not adjust the visuals to
fit the audio.

### 6.1 Act I → Act II — `DECIDE` (`06` §6.6; `01` §11.4). Total 4,000 ms.

| t (ms) | Visual (existing) | Audio |
|---|---|---|
| 0 | panels → 0.12 opacity over 1,800 ms; canvas to 8 Hz | duck weight 4 (−9 dB, 120 ms). Grains suppressed. `haptic(12)`. IR crossfade SOIL → CHAMBER begins (2,600 ms equal-power); CHAMBER IR was generated during the preceding `DECIDE` confirm sheet. |
| 200 | — | `breath(180 → 900 Hz, Q 1.4, A 600, D 1400, g 0.16, send 0.55)` — the conduction wave arriving |
| 600 | radial luminance wave crosses the canvas | `sweep(240 → 1500 Hz, dur 2.40 s, Q 5.0, g 0.20, send 0.58)` — **rising**, tracking the wave's radius exactly. The only upward sweep in the game outside `flush.release`. |
| 1,400 | wave mid-travel | DRONE palette crossfade Act I → Act II begins, 6,000 ms. The 7th and 11th partials enter *under* the sweep and are not consciously heard arriving. |
| 2,400 | canvas holds; console lines begin, 700 ms apart | `haptic(12)`. All UI voices released over 300 ms. **Scored silence begins** — only the sweep's reverb tail remains, decaying through the new CHAMBER IR. |
| 2,400 / 3,100 / 3,800 | the three lines | no sound per line. The lines land in the tail. |
| 4,000 | Act II shell fades in, 600 ms | `haptic(30)`. Bed un-ducks over 2,600 ms. CONDUCTION layer instantiated at gain 0. |

**Reduced motion** (`06` §6.6): the visual collapses to console lines + a 600 ms cross-fade. The
audio **does not collapse** — it plays in full. Audio is not a vestibular hazard, and a player who
has turned off motion has done nothing to deserve a lesser transition. This is stated explicitly
because the obvious implementation gates both behind one flag, and that is wrong.

### 6.2 Act II → Act III — `ESCAPE` (`02` §13.5). Total ~11.6 s.

| t (s) | Visual (existing) | Audio |
|---|---|---|
| 0.0 | panels → 0.35 over 900 ms | duck weight 4. `haptic(12)`. IR crossfade CHAMBER → VOID over 4,000 ms. |
| 0.9 → 3.7 | map desaturates outward, one ring per 700 ms | one `pluck` per ring, `n = 12, 10, 8, 6, 5`, decay 1.6 s, gain 0.085, send 0.55, pan spreading outward ±0.7. **Five notes descending the harmonic series as five rings drain.** |
| 3.7 | core region holds 1.2 s | DRONE `low` voice begins its 8,000 ms fade to zero. Act III has no bass (§4.2). |
| 4.9 → 6.5 | hexes lift and fade | `breath(900 → 140 Hz, Q 1.2, A 200, D 1600, g 0.13, send 0.62)` — a downward breath, tracking the lift. AIR gain → 0.35 over 1,600 ms. |
| 6.5 | black | **Scored silence, 1.4 s.** `master` → 0 over 250 ms. |
| 7.9 / 9.3 / 10.7 | three console lines, 1,400 ms apart | `master` restored to 0.5 instantly at 7.85 (nothing is playing). One `pluck(16, decay 3.4, g 0.055, send 0.62)` at 9.3 only — under the second line, "There is nothing beneath you." One note, very high, in a six-second room. |
| 11.6 | Act III shell fades in, 2,000 ms | `haptic(30)`. DRONE palette → Act III over 8,000 ms. Grain `MEAN` → 14.0 s. |

### 6.3 Ending A — THE BLOOM (`03` §20.1)

| t (s) | Visual (existing) | Audio |
|---|---|---|
| −18:00 → 0 | the synchrony arc | §4.6.1: the bed has already collapsed to one 440 Hz note every 4.2 s, dead centre, and has been for minutes. |
| 0.0 | 13 dots converge, hold 1.4 s | thirteen `pluck(8, decay 2.4, g 0.09, send 0.62)` **simultaneously**, all at 440 Hz, all dead centre. Thirteen identical notes sum to one note 22 dB louder — the sound of an ensemble becoming a soloist. `haptic(30)`. |
| 1.4 | white fills from centre, 2,600 ms | Everything holds. No new sound. The convolution tail from t=0 is still running. |
| 3.7 | — | `master.gain` → 0 over **300 ms linear**, then `verbIn.disconnect()`. |
| 4.0 → 10.0 | white holds, 6.0 s | **Absolute silence.** No tail, no bed, no room tone. The player's ears are still filled with a 440 Hz note that stopped. |
| 10.0 → 27.0 | black; one line per 2,200 ms | Silence continues through **all seven lines**. There is no music under the ending text. |
| 27.0 | `[ NEW GROWTH ]` | one `pluck(2, decay 3.0, g 0.07, send 0.5)` — 110 Hz. The bass that left at ESCAPE, returning, alone, as the button appears. |

That last note is the whole arc: the fundamental you started on, one octave up from the root, after
eight hours and six seconds of nothing. It costs four nodes.

### 6.4 Endings B and C — abbreviated

- **B — THE FRUITING BODY.** The dismantle (`03` §20, 9 s, panels closing in reverse acquisition
  order) gets one `stone(n, 12)` per closing panel, descending `n = 12, 10, 8, 6, 4, 2`, dry, 400 ms
  each. Six sounds, one per panel, getting lower and closer. Then silence, then the text.
- **C — THE INHERITANCE.** The Successor's `hz(11)` shadow oscillator (§4.6 binding 10) **crossfades
  into the position of the drone's `mid` voice over 12 seconds** while the player's own voices fade
  out. The bed does not stop. It becomes something else's. No one-shots at all.
- **ENCYST (the concession).** One `breath(120–400 Hz, A 900, D 2600, g 0.10, send 0.62)`, then the
  bed fades to zero over 20 seconds while the screen stays up. The longest fade in the game, for the
  ending that is not one.

---

## 7. HAPTICS

### 7.1 Inheritance and amendment

`06-ui-visual-language.md` §6.8 already specifies seven haptic events and three binding rules. Those
are correct and are **kept verbatim**. This section extends the table to the ~30 events of Acts II
and III and adds the governor that §6.8 does not have.

**One amendment.** `06` §6.8 says *"no haptic pattern (arrays) anywhere."* It then specifies the act
transition as "12 ms, 12 ms, 30 ms at t=0, 2400, 4000" — which is a sequence, but not an *array*.
The distinction is real and is now explicit:

> **Never call `navigator.vibrate([...])`.** Multi-pulse feedback, where it exists, is implemented as
> separate single-value calls scheduled by the same timeline that drives the visuals. An array is a
> fire-and-forget pattern the OS owns and that keeps buzzing after the player has skipped the
> transition. Separate calls can be cancelled. Act transitions are skippable (`01` §11.4: "skippable
> with any tap after 1.0 s") and a skipped transition must stop vibrating **immediately**.

```js
let hapticTimers = [];
const haptic = ms => {
  if (!hapticsOn || reducedMotion || scrolling) return;
  if (!navigator.vibrate) return;
  if (!hapticBudget(ms)) return;                       // §7.3
  navigator.vibrate(ms);
};
const hapticAt = (delayMs, ms) => hapticTimers.push(setTimeout(() => haptic(ms), delayMs));
const hapticCancel = () => { hapticTimers.forEach(clearTimeout); hapticTimers = [];
                             navigator.vibrate?.(0); };   // vibrate(0) cancels in-flight
```

`hapticCancel()` is called on: transition skip, `visibilitychange → hidden`, `pagehide`, and any
settings change.

### 7.2 The complete table

Durations are milliseconds. **Nothing exceeds 30 ms.** Sequences (`→`) are separate scheduled calls.

| Event | Pattern | Fires on | Notes |
|---|---|---|---|
| `tap.extend` (hero press) | **8** | `pointerdown` | `06` §6.8. The most-fired haptic in the game by 100×. |
| `tap.extend` while held (Reflex Arc) | **4** | every repeat | `04-projects-catalog.md` `reflex_arc` already specifies 4 ms. |
| `tap.ui` (button, tab, row) | **8** | `pointerdown` | |
| `buy-burst repeat` | **4** | every **3rd** repeat | `06` §5.11 / §6.8. |
| `tap.deny` / shortfall | **4** | with the console line | Deliberately *shorter* than success. Failure is a smaller event, not a bigger one. |
| long-press commit | **18** | at 420 ms | `06` §5.5. |
| destructive commit (`KILL STAND`) | **22** | at 400 ms hold completion | `06` §5.8. |
| `unlock.reveal` (not player-initiated) | **8** | with the 320 ms reveal, at t=0 | `06` §6.4. **Suppressed entirely if ≥ 3 reveals coalesce** — one 12 ms instead. |
| `buy.commit` | **8** | on effect application | |
| `project.complete` | **14** | on effect application | |
| `milestone` | **12** | on threshold crossing | |
| `contract.sign` | **12** | on commit | |
| `contract.break` | **18** | on break | Longer than sign. A broken contract should be felt more than a signed one. |
| `claim.complete` | **12** | on claim | |
| `pulse.fire` | **18** | `pointerdown` of the confirm | The hero verb of two acts. |
| `pulse.arrive` | **none** | — | 6–13 arrivals over 120 s would be a nuisance. Audio + visual only. |
| `flush.release` | **22** | on release | The largest routine haptic in the game. |
| `meter.full` (saturation, ripeness reaching 1.0) | **4** | once per fill, latched | §8.3. |
| `warn.minor` | **none** | — | A warning you did not cause should not touch you. |
| `warn.major` | **12** | on latch, once | Exception: this one you need. |
| `fail.event` (stand lost, bloom collapse) | **22** | on event | |
| `divergence` | **22** | on event | |
| `combat.loss` | **18** | on resolution | |
| `combat.win` | **12** | on resolution | |
| `entrain.lock` | **8** | on lock | Up to 13 over 18 minutes. Governor handles clustering. |
| **Act transition** | **12 → 12 → 30** | t=0, t=2400, t=4000 | `06` §6.8, unchanged. Act II→III: 12 at t=0, 12 at t=6.5 s, 30 at t=11.6 s. |
| **Ending A** | **30** | at the convergence (t=0) | One. The last haptic of the run. |
| **Ending B** | **8 ×6** | one per closing panel, 9 s dismantle | Descending with the sounds. Six separate calls. |
| **Ending C** | **none** | — | You are not there. |
| `offline.return` | **none** | — | The player just opened the app. Do not buzz them for existing. |
| autosave, tier change, theme, scroll, save export | **none** | — | |

### 7.3 The governor — rules for when NOT to fire

`06` §6.8's `haptic()` respects `hapticsOn` and `reducedMotion`. That is necessary and not
sufficient. Six more rules:

| # | Rule | Implementation |
|---|---|---|
| H1 | **Duty cycle.** No more than **60 ms of total vibration per rolling 1,000 ms**, and no more than **12 events per rolling 10 s**. Excess is **dropped, never queued.** | `hapticBudget(ms)` maintains two ring buffers. |
| H2 | **Never while scrolling.** `06` §6.7 rule 8 already maintains a `scrolling` flag (set on `scroll`, cleared 120 ms after the last event). Haptics check it. | A vibration during a flick reads as the phone malfunctioning. |
| H3 | **Never on `pointerup`, `pointercancel`, `keydown` repeat, `focus`, or programmatic focus.** Only `pointerdown` and explicitly-scheduled timeline events. | |
| H4 | **Never for an event the player did not cause, except:** `unlock.reveal`, `warn.major`, `fail.event`, `divergence`, `combat.*`, `entrain.lock`, act transitions. That list is closed. | Everything else is a notification and we do not send notifications. |
| H5 | **Never for offline-reconciled events**, and never within 400 ms of `visibilitychange → visible`. | Same rule as §5.6 #1–2. |
| H6 | **Never when `navigator.vibrate` is absent.** Feature-detect once at boot. The settings row then reads `HAPTICS  unavailable` in `--text-tertiary` and is not interactive. | Safari/iOS does not implement the Vibration API. We do not emulate it with an `AudioContext` taptic hack, an `<input>` trick, or a `MediaSession` abuse. On iOS the audio click and the 70 ms press-scale carry the feedback, and they are enough. |

**Optional, progressive:** if `navigator.getBattery` resolves and reports `level < 0.15 && !charging`,
halve every haptic duration (rounded up, minimum 4 ms) and drop the duty-cycle budget to 30 ms/s.
Never announce this. Never block on the promise.

### 7.4 Why the durations are what they are

- **4 ms** is below the threshold at which most Android LRAs produce an audible buzz — it is felt
  as a *tick*, not a *vibrate*. It is the correct duration for anything repeating.
- **8 ms** is the shortest duration that reliably reads as intentional on every device we tested for.
  It is the default for a deliberate press.
- **12–14 ms** reads as a small confirmation. Anything in this band feels like a physical detent.
- **18–22 ms** is the top of "feedback". Beyond 22 ms the ERM/LRA ramp-up dominates and it starts to
  feel like a phone call.
- **30 ms** is used exactly four times in a playthrough (three act-transition finales and one
  ending). It is the only duration that feels like an *event* rather than a response, and its power
  is entirely a function of its scarcity.

---

## 8. MICRO-FEEDBACK

### 8.1 Number roll-ups — within the no-glyph-animation constraint

`06` §6.7 rule 1 forbids animating digits, and `06` §3.3 R4 defines four change behaviours. Neither
document says what makes an *accruing* counter feel alive. This does.

**The problem.** A counter reading `4.12 kg` that updates every 100 ms with a change smaller than
0.01 kg is **visually static**. It reads as broken. The player's rate is positive; the number does
not move; the game feels dead. This is the single most common failure in the genre and it is a
precision bug, not an animation problem.

**R1 — Adaptive precision. The number must never be still while the rate is non-zero.**

```js
function displayPrecision(value, ratePerSec){
  const perFrame = ratePerSec / 60;                     // change per rendered frame
  const base     = fmtPrecisionFor(value);              // 06 §3.3 R2: 2 / 1 / 0 decimals
  for (let d = base; d <= base + 2; d++){
    if (perFrame >= 0.5 * Math.pow(10, -d)) return d;   // this many decimals visibly moves
  }
  return base + 2;                                      // cap: never more than 2 extra places
}
```

The least significant digit must change at least once every **two** rendered frames (≈ 33 ms).
Slower than that and it stutters; faster and it is a blur, which is fine — a blurring last digit is
the correct visual for "this is going fast".

**R2 — The extra digits are dimmer.** Digits beyond the base precision render in `--text-tertiary`,
inside the same `.num` span, so the *significant* value stays scannable and the *motion* lives in
the periphery. This costs one `<span>` and it is the difference between "alive" and "noisy".

**R3 — Interpolation, not animation.** The displayed value is `lerp(lastTickValue, value, α)` where
`α = (now − tickTime) / tickPeriod`, clamped to 1. Straight from `06` §3.3 R4. The *value* moves;
the string is regenerated; no glyph is ever transformed. `el.__last` guards the write.

**R4 — Large discrete gains snap and flash** (`06` §3.3 R4), and additionally: if the gain exceeds
**8×** the current per-tick delta, the flash is 140 ms rather than 90 ms and the element's
`--text-max` hold extends to 120 ms. Bigger gains flash longer. Nothing scales, nothing translates.

**R5 — Never interpolate across a suffix boundary.** Snap the mantissa, cross-fade the suffix span
(`06` §3.3 R4). Interpolating `999 g → 1.00 kg` produces a value that briefly reads `0.99 kg` and it
looks like a bug.

**R6 — Rate lines update at 2 Hz, not 60.** A rate that flickers is unreadable. Compute the
displayed rate as a 5-sample rolling mean of the sim's per-tick delta and write it at 2 Hz. Snap to
`— /s` (`06` §3.3 R6) when the true rate is exactly zero, never when it is merely small.

### 8.2 Press response — ripple and turgor

**The ripple (all pressable surfaces).**

| Property | Value |
|---|---|
| Element | one pre-created `::after` per pressable, never allocated on press |
| Origin | pointer coordinates, set as `--rx`/`--ry` in the `pointerdown` handler |
| Geometry | `width:height:2px; border-radius:50%; transform: translate(-50%,-50%) scale(var(--s))` |
| Scale | `0 → max(w,h) × 0.62 / 2` |
| Opacity | `0.16 → 0` |
| Duration | **340 ms** |
| Easing | `--ease-out` (`06` §6.1). Both properties, same curve. |
| Colour | `--positive` at weight ≥ 1, `--text-tertiary` at weight 0, `--negative` on deny |
| `will-change` | set on `pointerdown`, **removed on `transitionend`** — a permanently promoted layer per button is a memory leak |

The ripple runs **in parallel** with the `scale(.972)` press transform (`06` §6.3), not after it.
Total press response: haptic at 0 ms, scale down over 70 ms, ripple over 340 ms, scale back over
220 ms on release.

**The turgor pulse (EXTEND only).** `01` §3.2 says the drawn thread grows by 0.004 m per tap, which
is 1–2 px. That is correct and it is not enough feedback on its own. So: on every `EXTEND`, the
`flux` canvas (`06` §7.5) draws **one bright dot travelling from the root to the newest tip**.

| Property | Value |
|---|---|
| Path | the existing structural path from root to the most recently extended tip |
| Duration | **220 ms** |
| Easing | `--ease-press` — front-loaded; it leaves fast and arrives softly |
| Radius | 2.2 px at `dpr` 1, `1.6 + 0.6·dpr` |
| Colour | `--hyphae` at alpha `0.85 → 0.0` over the last 40% |
| Cost | 1 `arc()` per frame, ≤ 14 frames. **0.02 ms.** |
| Cap | 4 concurrent pulses; a 5th replaces the oldest |
| Tier | HIGH/MID only. LOW/FLOOR omit it. |

Why it matters: it makes the tap go *somewhere*. The number changing tells you the tap counted; the
pulse tells you where it went. In eight hours of tapping, that difference is the whole verb.

### 8.3 Meters

Inherits `06` §5.6 (`transform: scaleX`, `transition: 180ms linear`, never `width`, never eased).
Three additions:

**M1 — The approach.** At `v ≥ 0.92`, `.meter-fill`'s `background` ramps from its tone colour toward
`--text-max` over 400 ms `linear`. The meter *brightens* as it approaches full. No pulsing, no
glow, no shimmer.

**M2 — The arrival.** At `v` first reaching `1.0`: the fill stops (it is already at scaleX(1)),
a **4 ms haptic** fires, and — for the Signal meter only, because saturation is a gameplay state
(`02` §5.1) — the CONDUCTION layer is already at full and in tune, so no additional sound plays.
**Latched:** it fires once per fill cycle, cleared when `v < 0.88`. Without the latch a meter
hovering at 1.0 buzzes forever.

**M3 — Never animate a draining meter faster than 180 ms.** A meter that snaps to zero reads as a
bug; a meter that eases to zero lies about the rate. 180 ms `linear` in both directions.

**Pips** (`06` §5.6b) fill instantly with no transition. A pip is a discrete fact. There is no
sound and no haptic for a pip.

### 8.4 The "something new" pulse — tri-modal synchronisation

An unlock happens ~200 times per playthrough (`06` §6.4). It is the reward for everything, and it
must be **cheap**, because 200 expensive rewards is a slot machine.

The exact timeline, all three channels:

| t (ms) | Visual (`06` §6.4, unchanged) | Audio | Haptic |
|---|---|---|---|
| 0 | element inserted `opacity:0, translateY(6px)`; console line begins its own 180 ms arrival | `unlock.reveal` scheduled at `ctx.currentTime + 0.012` (§8.5) | `haptic(8)` — **only if not player-initiated** |
| 0 → 320 | `opacity 0→1 linear`; `translateY(6px)→0 --ease-organic`; border ramps `--line → --positive` | breath swells (A 40 ms), `pluck(8)` lands at +60 ms | — |
| 320 | settled; 6 px `--positive` dot at top-right | tail continues into reverb (~420 ms) | — |
| +1200 after ≥50% in viewport | dot fades over 180 ms | — | — |

**The synchronisation rule.** Haptic and audio are both nominally at t=0. The *visual* is allowed to
be the slow one, because vision tolerates ~100 ms of lag before causality breaks, while touch and
hearing tolerate ~20 ms. Never delay the haptic to match the visual. Never delay the audio to match
the visual.

**Coalescence** (§5.5 G2): when a project tier unlocks five rows at once, **one** sound, **one** 12 ms
haptic, and five independent visual reveals staggered 40 ms apart. Five sounds would be a jackpot;
one sound plus five arrivals is a *tier*.

### 8.5 The latency budget

| Stage | Budget | Notes |
|---|---|---|
| `pointerdown` → JS handler | 0–16 ms | Bind to `pointerdown`, never `click` (`06` §5.2). `touch-action: manipulation` on every pressable to kill the 300 ms delay. |
| Handler → `haptic()` | **< 1 ms** | Synchronous, first line of the handler, before any game logic. |
| Handler → game state mutation | < 2 ms | `06` §6.3: the action fires at `pointerdown`, not at `pointerup`. |
| Handler → `ctx` scheduling call | < 2 ms | |
| Scheduled offset `NOW_PAD` | **12 ms** | Enough to never glitch, below the 20 ms simultaneity threshold. |
| `ctx.baseLatency` | 3–10 ms | Not controllable. |
| `ctx.outputLatency` | **20–120 ms on Android** | **Not controllable and not fixable.** |
| Handler → visual scale begins | next frame, ≤ 16 ms | |

**The honest consequence:** on many Android devices the audio will arrive 40–130 ms after the touch,
and there is nothing any web application can do about it. This is precisely why **the haptic is the
primary feedback channel for press**, why it is synchronous and first, and why the press *scale*
transform is 70 ms and front-loaded. The audio is a colour, not a confirmation. Design that assumes
audio confirms the press will feel broken on half the target hardware.

Corollary: **never gate a game action on an audio callback.** No `onended` handler advances state.

### 8.6 What must never be juiced

| Never | Because |
|---|---|
| Screen shake, at any amplitude, for any reason. | It is the opposite of calm and it is a nausea trigger. |
| Particle bursts, confetti, coins, sparkles, floating `+N` text. | `06` §0 — this game does not congratulate you. |
| Any bounce, spring, elastic, or overshoot above 100.8% (`06` §6.1). | |
| Colour flashes covering > 25% of the viewport outside an act transition (`06` §6.7 rule 5). | |
| A progress bar that fills faster than the thing it measures. | It is a lie and players detect it. |
| Anything at all on: autosave, tab switch, scroll, a cost becoming affordable, a card greying out. | §5.6. |
| A "combo" or "streak" indicator on rapid tapping. | The tap ladder (§5.4) is the reward and it asks for nothing. |

---

## 9. BUDGETS

### 9.1 CPU

Reference device from `06` §7.8: Snapdragon 695 / Pixel 6a class, Chrome, 48 kHz output, 128-sample
render quantum = **2.67 ms of wall time per quantum**.

| Cost centre | Per quantum (MID tier) | % of audio thread |
|---|---|---|
| DRONE: 6 `PeriodicWave` oscillators (12 partials total) | 0.032 ms | 1.2% |
| DRONE: 3 lowpass + 3 panner + 3 gain | 0.011 ms | 0.4% |
| AIR: 2 buffer sources + 1 bandpass + 1 gain | 0.014 ms | 0.5% |
| CONDUCTION: 1 osc + 1 bandpass + 1 gain | 0.006 ms | 0.2% |
| GRAINS: ≤ 0.6 concurrent × 9 nodes, amortised | 0.018 ms | 0.7% |
| UI voices: transient, amortised over a busy minute | 0.026 ms | 1.0% |
| Bus/gain/tilt/duck/send | 0.008 ms | 0.3% |
| **Convolver, 2.6 s stereo IR** | **0.163 ms** | **6.1%** |
| Limiter (`DynamicsCompressor`) | 0.009 ms | 0.3% |
| **Total** | **≈ 0.287 ms** | **≈ 10.8%** |

Audio thread ≈ 10.8% of one core's real-time budget for audio ≈ **1.4% of total device CPU**. The
convolver is 57% of the cost, which is why it is the only thing tiered aggressively.

| Tier | Per quantum | Total CPU | Notes |
|---|---|---|---|
| HIGH | 0.38 ms | ~1.9% | 3.4 s stereo IR |
| MID | 0.29 ms | ~1.4% | 2.6 s stereo IR |
| LOW | 0.11 ms | ~0.6% | 1.4 s mono IR, no grains at full rate, no CONDUCTION osc |
| FLOOR | 0.04 ms | ~0.2% | FDN, drone only |
| hidden | **0.00 ms** | **0%** | context suspended |

### 9.2 Memory

| Item | HIGH | MID | LOW |
|---|---|---|---|
| `NB.white` (1.00 s mono) | 192 KB | 192 KB | 192 KB |
| `NB.pink` (2.00 s mono) | 384 KB | 384 KB | 384 KB |
| `NB.air` (11.13 s stereo / 5.57 s mono) | 4.27 MB | 4.27 MB | 1.07 MB |
| Active IR (stereo/mono) | 1.31 MB | 1.00 MB | 0.27 MB |
| Crossfading IR (transient, released after) | +1.31 MB | +1.00 MB | +0.27 MB |
| Nodes + JS | ~0.2 MB | ~0.2 MB | ~0.1 MB |
| **Steady total** | **6.36 MB** | **6.05 MB** | **2.02 MB** |

`06` §7.8 budgets `< 12 MB` total JS heap. Audio buffers are not JS heap (they live in the audio
thread's allocation) but they are device memory and must be counted. **Revised total device memory
budget: < 20 MB.** On `deviceMemory ≤ 2` (FLOOR entry condition), `NB.air` is not generated at all
and the bed is drone-only: **0.6 MB**.

### 9.3 Battery

| State | Additional drain vs. silent | Measured how |
|---|---|---|
| Foreground, FULL, HIGH | **≤ 1.1 %/h** | 30-min run, screen 50%, airplane mode, delta vs. `AUD.mode='off'` |
| Foreground, FULL, MID | ≤ 0.8 %/h | |
| Foreground, FULL, LOW | ≤ 0.4 %/h | |
| Foreground, SPARSE | ≤ 0.15 %/h | context alive, bed silent, only UI voices |
| Backgrounded | **0.00 %/h** | context suspended; §10 |

`06` §7.8's foreground budget of ≤ 6.5 %/h becomes **≤ 7.6 %/h with FULL audio at HIGH tier**. If
measurement exceeds that, the fix is IR tail length, in this order: HIGH 3.4 → 2.8 → 2.4 s.

### 9.4 Code size

| Module | gzipped budget |
|---|---|
| `audio.js` (graph, primitives, IR, bed, event table) | **≤ 9.0 KB** |
| `haptics.js` | ≤ 0.4 KB |
| `juice.js` (roll-ups, ripple, turgor, meters) | ≤ 3.0 KB |
| **Total feel layer** | **≤ 12.4 KB** |

Against `06` §7.8's `< 180 KB` single-file budget: 6.9%.

---

## 10. LIFECYCLE — suspending everything

**The rule, stated once:** *HYPHAE never makes a sound the player is not looking at.* No background
audio, no `MediaSession`, no `navigator.wakeLock`, no "keep playing in the background" setting, ever.
This is a values position, not a battery optimisation, and it is not negotiable even if a player
asks for it.

### 10.1 The suspend/resume contract

```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audioSuspend(); else audioResume();
});
window.addEventListener('pagehide', e => { audioSuspend(); if (!e.persisted) ctx?.close(); });
window.addEventListener('freeze',   audioSuspend);     // Chrome page lifecycle
window.addEventListener('resume',   audioResume);
```

**`audioSuspend()`** — total elapsed ≈ 160 ms:

| t (ms) | Action |
|---|---|
| 0 | `hapticCancel()`. `master.gain.setTargetAtTime(0, now, 0.035)` — a 120 ms fade, because `suspend()` on a running graph produces a click. |
| 0 | Clear the deferred-arrival queue (§5.3). Those pulses are *cancelled*, not deferred. |
| 0 | `clearInterval(bedClock)`. |
| 140 | `ctx.suspend()`. |
| 140 | Record `hiddenAt = performance.now()` and `ouSnapshot = MODS.map(m => m.x)`. |

**`audioResume()`**:

| t (ms) | Action |
|---|---|
| 0 | If `AUD.mode === 'off'` return. If `ctx.state === 'interrupted'`, set `pendingResume` and return — iOS requires a gesture. |
| 0 | `ctx.resume()`. |
| 0 | **Advance the OU walk forward** by `min(hiddenMs, 600_000)` in 5-second steps (§10.2). |
| 0 | `nextGrainAt = ctx.currentTime + 1.4` — rebase, never catch up. |
| 0 | Restart `bedClock`. |
| 0 → 400 | `master.gain.setTargetAtTime(0.5, now, 0.13)`. |
| **400** | The sound gate opens (§5.6 rule 1). Nothing may play before this. |
| 400 | If away ≥ 60 s, fire exactly one `offline.return` (§5.2) and nothing else. |

### 10.2 Why the OU walk is advanced

If the bed resumes at exactly the parameter values it had when it was suspended, a player who
returns after four hours hears the *identical* sound they left. That is the one way a genuinely
aperiodic system can be caught looping. Advancing the walk (capped at 10 minutes of simulated
drift — beyond that the distribution has converged anyway) costs 120 float operations and makes
returning feel like returning to a room, not to a paused file.

### 10.3 Offline return

`01` §8.3 and `03` §22.1 specify a return *screen* (a summary, never a claim button). Its feel:

| Channel | Behaviour |
|---|---|
| Audio | **One** `offline.return` breath at t=400 ms. The bed ramps 0 → full over 3,000 ms behind the summary. Zero event sounds for anything that happened while away (§5.6 rule 2). |
| Haptic | **None.** |
| Numbers | The summary's figures **do not roll up.** They are already true. They fade in with the sheet over 180 ms and sit still. A rolling number on a return screen implies you are earning it now, which is a lie. |
| Visual | The `flux` canvas draws the accumulated growth over 1,600 ms `--ease-out` — the *one* place where a catch-up animation is correct, because the growth genuinely did happen and the canvas is a record. |

---

## 11. SETTINGS AND ACCESSIBILITY

### 11.1 The settings row (amends `06` §8.6)

`06` §8.6 specifies nine rows. **Insert `SOUND` immediately after `HAPTICS`**, making ten:

```
THEME        auto / dark / light
HAPTICS      on / off          (or "unavailable" — §7.3 H6)
SOUND        off / sparse / full
REDUCED MOTION   auto / on / off
SLOW MODE
VERBOSE STATUS
RENDER TIER
TEXT SIZE hint
SAVE  (export / import / copy)
RESET
```

| Mode | Bed | UI sounds | Default? |
|---|---|---|---|
| `off` | — | — | |
| `sparse` | — | yes | **yes** |
| `full` | yes | yes | after the one-time offer |

**Why `sparse` and not `off` or `full`.** `off` means most players never hear eight hours of work
and never learn that saturation is audible. `full` means someone on a bus at 08:10 gets an ambient
drone they did not ask for. `sparse` gives short, quiet, informative contact sounds (a 55 ms wood
knock at −20 dBFS) and nothing else — the closest audio equivalent to a keyboard's click.

**The one-time offer.** At the first `season.turn` (t ≈ 300 s, `01` §4 Unlock 5 — by which point the
player has demonstrably chosen to still be here), one console line prints, in the console voice, in
the normal feed, with no modal, no overlay, and no dimming:

```
> the floor has a sound.                      [ listen ]
```

Tapping `[ listen ]` sets `full` and plays nothing immediately (the bed fades in over 6 s).
**Ignoring it does nothing and it never appears again.** It is not re-offered at act transitions, it
does not nag, it is not a "tip", and there is no second chance beyond the settings sheet. One
sentence, once, in eight hours.

### 11.2 Accessibility

| Concern | Rule |
|---|---|
| **`prefers-reduced-motion`** | Gates haptics (`06` §6.8, inherited) and gates transition *visuals*. **Does not gate audio** (§6.1) — audio is not a vestibular hazard and downgrading it punishes a group that did not ask for that. |
| **No information is audio-only** | Every audio channel has a visual twin: CONDUCTION ↔ the saturation meter; drift beating ↔ the drift readout; `pulse.arrive` ↔ the map/band highlight; the Synchrony collapse ↔ the phase wheel. Inherited from `06` §7.9 ("no canvas ever carries information that is not also available as text") and extended: **no sound ever carries information that is not also on screen.** |
| **Screen readers** | Audio never competes: `bedGain` ducks by **−6 dB for 2,500 ms** whenever an `aria-live` region updates, detected via a `MutationObserver` on the console feed. This costs three lines and it is the difference between usable and hostile. |
| **Hearing** | The whole game is completable in `off`. There is no timing challenge, no audio cue with a deadline, and no achievement or ending gated on hearing anything. |
| **Loudness** | Bed integrated ≈ **−30 LUFS**; UI one-shots peak ≤ −13 dBFS; absolute peak ≤ −1 dBFS (limiter). Nothing in the game is ever loud. There is no dynamic range compression that raises quiet passages. |
| **Frequency safety** | No content below 40 Hz (removed by the `low` voice's own harmonic content — the 55 Hz fundamental is not in any `PeriodicWave`; the lowest actual partial is 110 Hz). No content above 8 kHz. No sustained tone above 4 kHz at any level. |
| **Startle** | No sound anywhere in the game has an attack < 1 ms at a level above −20 dBFS. There is no jumpscare, no alarm, no sting. `fail.event` is 190 ms of a dark lowpassed triangle pair — the sound of something *stopping*. |
| **Photosensitivity** | Unchanged and inherited: `06` §6.7 rule 9, ≤ 3 luminance changes/second, everywhere, always. Audio does not affect it. |

---

## 12. IMPLEMENTATION APPENDIX

### 12.1 The single entry point

Gameplay code must never touch `AudioContext`, `navigator.vibrate`, or a DOM class for feedback.
There is exactly one function and it is a table lookup:

```js
feel(event, payload);
```

```js
function feel(event, p = {}){
  const E = EVENTS[event];
  if (!E) { if (DEV) console.warn('unknown feel event', event); return; }
  if (gateClosed()) return;                    // §5.6 rules 1,6,7,8
  if (!governors(event, E)) return;            // §5.5 G1–G4
  if (AUD.mode !== 'off' && ready && !(AUD.mode === 'sparse' && E.bedOnly))
      E.play(ctx.currentTime + NOW_PAD, p);
  if (E.haptic && p.userInitiated !== false)  haptic(E.haptic);
  if (E.duck)                                  duck(E.duck, ctx?.currentTime ?? 0);
  if (E.visual)                                E.visual(p);
}
```

Every call site in the game is one line: `feel('project.complete')`, `feel('tap.extend')`,
`feel('pulse.arrive', {dist: 3, strength: 0.55, pan: -0.4})`. Adding a sound to a new mechanic is a
row in `EVENTS`, never a change at the call site.

### 12.2 File layout

```
audio.js     ~9.0 KB gz   ctx, graph, NB, IR, primitives, bed, EVENTS table
haptics.js   ~0.4 KB gz   haptic(), hapticAt(), hapticCancel(), the governor
juice.js     ~3.0 KB gz   displayPrecision(), ripple, turgor, meter latches
feel.js      ~0.3 KB gz   feel(), governors, the gate
```

All four are inlined into the single-file build. No module has a dependency outside this list plus
the game's tier variable and `reducedMotion`/`hapticsOn`/`AUD.mode` flags.

### 12.3 The constants block

```js
const AUD = {
  mode: 'sparse',                  // off | sparse | full
  F0: 55.0,
  master: 0.50,                    // -6 dB headroom
  nowPad: 0.012,
  lookahead: 0.30,
  bedClockMs: 200,
  limiter: {threshold:-6, knee:0, ratio:20, attack:0.003, release:0.25},

  palette: {
    1:[2,3,4,5,6,8,10,12],
    2:[2,3,4,5,6,7,8,9,10,11,12,14],
    3:[8,11,13,16,17,19,21,23],
    ng:[2,3,4,5,6,8,10,12,16,24]
  },

  drone: {
    low : {parts:{2:1.00,3:0.42,4:0.26}, det:1.50, lp:420,  Q:0.6, pan:-0.18, g:0.115},
    mid : {parts:{5:1.00,6:0.55,8:0.30}, det:1.20, lp:1150, Q:0.5, pan:+0.22, g:0.072},
    high: {parts:{10:1.00,12:0.50,16:0.22}, det:0.50, lp:2400, Q:0.4, pan:-0.05, g:0.038}
  },

  grain: { 1:{mean:11.0,decay:2.6,g:0.055,send:0.34},
           2:{mean: 7.5,decay:3.2,g:0.062,send:0.42},
           3:{mean:14.0,decay:5.0,g:0.048,send:0.58} },

  air: {len:11.13, rateB:0.6180339, gA:1.00, gB:0.72, panA:-0.42, panB:+0.38, level:0.020},

  ir: {
    SOIL   :{tail:1.90,preDelayMs:11,buildSec:0.14,hiHz:3200,loFloorHz:260,brightSec:0.55,
             diffuse:0.90,spreadMs:3.5,targetRms:0.045,seed:0x48595048+1,
             taps:[[7,.30],[13,.22],[19,.17],[29,.12],[41,.09]]},
    CHAMBER:{tail:3.40,preDelayMs:19,buildSec:0.22,hiHz:5200,loFloorHz:190,brightSec:1.10,
             diffuse:0.86,spreadMs:5.5,targetRms:0.045,seed:0x48595048+2,
             taps:[[11,.26],[18,.20],[27,.16],[37,.13],[53,.10],[71,.07]]},
    VOID   :{tail:6.40,preDelayMs:34,buildSec:0.55,hiHz:7400,loFloorHz:120,brightSec:2.60,
             diffuse:0.78,spreadMs:9.0,targetRms:0.045,seed:0x48595048+3,
             taps:[[23,.14],[41,.11],[67,.08]]}
  },

  tier: { HIGH :{irScale:1.00, irCh:2, voices:12, grainRate:1.00},
          MID  :{irScale:0.80, irCh:2, voices:10, grainRate:1.00},
          LOW  :{irScale:0.45, irCh:1, voices: 6, grainRate:0.60},
          FLOOR:{fdn:true,     irCh:1, voices: 4, grainRate:0.00} },

  duck: [ null,
          {db:-1.5, atk:40,  rel:600},
          {db:-3.0, atk:40,  rel:900},
          {db:-5.0, atk:60,  rel:1400},
          {db:-9.0, atk:120, rel:2600} ],

  ladder: [4,5,6,8,6,5], ladderResetMs: 1200,
  session: {freeMin:8, dbPerOct:-3.0, dbFloor:-9.0, tiltPerOct:-2.0, tiltFloor:-6.0,
            sparsePerOct:0.50, tau:30.0, resetAwayMs:1200000},
  gov: {maxPerSec:9, coalesceMs:250, coalesceN:3, gateAfterVisibleMs:400},
  hap: {budgetMsPerSec:60, maxPer10s:12}
};
```

### 12.4 Acceptance tests (extends `06` §9's QA table)

| # | Test | Pass condition |
|---|---|---|
| A1 | Boot with audio blocked (no gesture) | Game fully playable, zero exceptions, `AUD.mode` unchanged, first tap starts context |
| A2 | Boot in a browser with no `AudioContext` | Game fully playable, zero exceptions, settings row reads `SOUND unavailable` |
| A3 | 60 consecutive `EXTEND` taps at 3/s | No dropped frame > 20 ms; ladder cycles; ≤ 60 voices allocated total; no click artefacts |
| A4 | Fire 40 `unlock.reveal` in one frame | Exactly **one** sound, exactly **one** 12 ms haptic, 40 visual reveals |
| A5 | Background for 4 hours, return | 0.00% battery attributable to audio while hidden; on return exactly one sound at t ≥ 400 ms; bed audibly different from the moment of suspend |
| A6 | **20-minute offline render of the bed** | 1/3-octave band-energy autocorrelation < 0.15 for all lags in [4 s, 900 s] (§4.9) |
| A7 | Ending A | Measured silence from t=4.0 to t=10.0 is **absolute** — peak sample amplitude < 1e-6 across the whole window |
| A8 | Haptic flood (fire 200 events in 2 s) | ≤ 24 `vibrate()` calls; total vibration ≤ 120 ms; no queueing |
| A9 | Act transition skipped at t=1.1 s | All scheduled haptics cancelled within 30 ms; all scheduled audio released over ≤ 300 ms; no orphan node |
| A10 | Tier demotion HIGH → FLOOR mid-session | IR crossfades over 600 ms; no gap, no click; CPU drops to ≤ 0.2% |
| A11 | Peak level, worst case (act transition + 12 voices + full bed) | Absolute peak ≤ −1.0 dBFS; limiter gain reduction ≤ 6 dB |
| A12 | `SOUND off` set at any point | All oscillators stopped within 400 ms; context suspended; zero CPU |
| A13 | Screen-reader announcement during full bed | `bedGain` measurably down 6 dB within 120 ms of the `aria-live` mutation |
| A14 | 8-hour soak | JS heap growth < 1 MB; audio node count returns to steady-state 37 ± 2 within 5 s of idle |

### 12.5 Build order

1. `feel()` + the `EVENTS` table with every entry as a no-op. **Wire every call site first.** The
   game ships correct and silent, and every subsequent step is additive.
2. `haptics.js` + the governor. This alone makes the game feel twice as good and is 0.4 KB.
3. `juice.js`: `displayPrecision` (§8.1) — the highest feel-per-byte item in the entire document.
4. `juice.js`: ripple, turgor, meter latches.
5. `audio.js`: context, graph, limiter, `NB` buffers, `knock` + `pluck`. Wire `tap.*` and
   `buy.*`. Ship `sparse` mode. **This is a shippable milestone.**
6. IR generator + convolver. SOIL only.
7. The bed: DRONE, then AIR, then GRAINS. Act I only.
8. `full` mode + the one-time offer.
9. Act II: CHAMBER IR, palette crossfade, CONDUCTION (§4.5) — the first *functional* audio.
10. The §4.6 binding table, all twelve.
11. Act III: VOID IR, drift beating, the Synchrony collapse (§4.6.1).
12. Act transitions and endings (§6). Last, because they are the only content that cannot be
    iterated on in playtesting.

---

*Every parameter in this document is a number. Nothing here requires an asset, a dependency, a
worklet, or a network. The whole feel layer is 12.4 KB gzipped, 1.4% of a phone's CPU, and it is the
difference between a spreadsheet and an organism.*
