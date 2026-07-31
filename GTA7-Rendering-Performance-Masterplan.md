# GTA7 — Rendering & Performance Master Plan
### Indian Bike Driving 3D style, GTA V-inspired browser open-world game
**Stack:** Vite + Three.js + Cannon-es + WebSocket + WebRTC
**Target:** 60 FPS mid-range PC, playable on mid/low-end Android, stylized-realism visual bar (PS4-generation, not photoreal)

---

## 0. How to use this document

This is written as a **priority-ordered backlog**, not a wall of theory. Each phase has:
- **Why** — the actual problem it solves
- **What to change** — concrete, file-level actions
- **Where it likely lives in your repo** — based on your README's architecture (`src/core`, `src/environment`, `src/world`, `src/vehicles`, `src/traffic`, `src/systems`, `src/ui`)
- **Effort / Impact** rating so you can sequence work realistically

Work top to bottom. Don't jump to Phase E (WebGPU) before Phase A–D are solid — it will not fix problems that are actually caused by uncapped pixel ratio or untouched tone mapping.

When you're ready to implement any single phase, paste me the relevant file(s) and I'll turn that phase into an exact diff against your real code instead of generic snippets.

---

## Phase A — Renderer & Color Pipeline
**Effort: Low (~30–60 min) | Impact: Very High — biggest visual jump per hour spent**

This is the "why does GTA look like GTA and my game looks like a tech demo" phase. Almost none of this is expensive at runtime — it's config, not new systems.

### A1. Color space
```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
```
If this isn't set, your colors are being interpreted in linear space and everything looks washed out or oddly contrasted. This single line fixes a huge amount of "flat" look.

### A2. Tone mapping
```js
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0; // tune per-scene, try 0.8–1.3
```
ACES is what most modern games (including Rockstar titles) use as a base filmic curve — it prevents blown-out highlights (sun glare, headlights, neon signs) from clipping to flat white and gives you the "cinematic" contrast curve for free.

### A3. Shadow map quality
```js
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```
`PCFSoftShadowMap` gives soft shadow edges for near-zero extra cost vs the default `PCFShadowMap`. Avoid `THREE.BasicShadowMap` (hard, aliased edges) unless you're on your lowest quality tier.

### A4. Pixel ratio cap — critical for mobile/performance
```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```
**Why this matters more than people think:** many phones report `devicePixelRatio` of 3 or even 3.5. Uncapped, you're rendering at 3x the actual resolution needed, which is a 9x pixel-shading cost increase for zero visible quality gain on a phone screen. This is often the single biggest invisible FPS killer in browser 3D games targeting mobile. Cap at 2, and consider capping at 1.5 or even 1 on your "low" quality tier.

### A5. WebGL context hints
```js
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true, // consider disabling on low tier, rely on SMAA/FXAA post instead
  powerPreference: "high-performance",
  stencil: false, // disable if you don't use stencil buffer effects — saves memory bandwidth
  depth: true,
});
```
`powerPreference: "high-performance"` hints laptops to use the discrete GPU instead of integrated graphics where available.

### A6. Where this lives in your repo
Almost certainly `src/core/` — wherever `THREE.WebGLRenderer` is constructed (likely `renderer.js` or inside your main game loop init). This is a localized, low-risk change — good first PR.

---

## Phase B — Materials & Lighting
**Effort: Medium (few days) | Impact: High — this is what makes vehicles/world look "next-gen" vs "asset store"**

### B1. Material audit
If any of your vehicles, buildings, or road surfaces use `MeshLambertMaterial` or `MeshPhongMaterial`, migrate to `MeshStandardMaterial` (or `MeshPhysicalMaterial` for vehicle paint specifically, since it supports clearcoat).

```js
const bodyPaint = new THREE.MeshPhysicalMaterial({
  color: 0xd23c3c,
  metalness: 0.6,
  roughness: 0.35,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  envMapIntensity: 1.2,
});
```
Clearcoat is specifically what gives car paint that glossy "wet layer on top of the color" look — GTA vehicle paint uses exactly this kind of layered shading.

### B2. Environment map for reflections (cheap, high payoff)
```js
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader().load('assets/hdri/city_sky.hdr', (hdrTex) => {
  const envMap = pmrem.fromEquirectangular(hdrTex).texture;
  scene.environment = envMap; // lights all PBR materials automatically
  hdrTex.dispose();
  pmrem.dispose();
});
```
This single texture gives every `MeshStandardMaterial`/`MeshPhysicalMaterial` object realistic ambient reflections without any extra draw calls — huge value for effort.

Consider a distinct HDRI per district (desert vs Tokyo neon vs mountain) to reinforce the mood shift the README already describes.

### B3. Sun / directional light: fit the shadow frustum tightly
The most common shadow mistake: leaving the shadow camera's frustum way larger than the visible play area, which wastes shadow map resolution on empty space and makes shadows blurry/blocky near the player.

```js
const sun = new THREE.DirectionalLight(0xfff2e0, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); // 1024 on low tier
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.bias = -0.0005; // tune to kill peter-panning/acne
```
**Key technique for an open world:** re-center this frustum on the player every frame (or every few frames) instead of trying to cover the whole map — this is effectively a lightweight single-cascade shadow system and is what keeps shadow quality high near the camera without a huge shadow map.

### B4. Ambient / hemisphere light per district
```js
const hemi = new THREE.HemisphereLight(skyColor, groundColor, intensity);
```
Swap `skyColor`/`groundColor`/`intensity` per district as the player crosses zone boundaries (you already have district boundaries defined for world layout — reuse those same z-ranges here). Dubai = warm/bright, Tokyo = cool blues + neon-tinted ambient, Mountain = desaturated cool, Village = warm gold hour.

### B5. Where this lives in your repo
- Materials: `src/vehicles/`, `src/world/` (buildings/roads)
- Lighting + HDRI: `src/environment/` (this is where your day/night cycle and sky shader already live per the README)

---

## Phase C — Post-Processing Stack
**Effort: Medium (2–4 days) | Impact: High — this is the "AAA polish" layer**

### C1. Set up EffectComposer
```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.6,   // strength
  0.4,   // radius
  0.85   // threshold — only bright things bloom (headlights, neon, sun)
);
composer.addPass(bloom);

composer.addPass(new SMAAPass(window.innerWidth, window.innerHeight));
composer.addPass(new OutputPass()); // handles tone mapping + color space at the end of the chain
```
Then render via `composer.render()` instead of `renderer.render(scene, camera)` in your main loop.

### C2. Bloom is your highest-value pass
Bloom is what makes Tokyo's neon signs, vehicle headlights/taillights at night, and the sun itself feel like a real light source instead of a flat-shaded polygon. Threshold it high (0.8+) so only genuinely bright emissive things bloom — don't bloom the whole scene or it looks washed out and hazy.

For emissive objects (neon signs, taillights), make sure the material has `emissive` and `emissiveIntensity` set — bloom only picks up bright pixels, and unlit "bright-looking" colored materials won't trigger it.

### C3. Anti-aliasing choice
- `SMAAPass` — good quality, moderate cost, works well with your instancing-heavy scenes
- `FXAAPass` — cheaper, slightly blurrier, better for your low-end mobile tier
- Skip renderer-level `antialias: true` (MSAA) if you're using a post-AA pass — doing both is wasted cost

### C4. Optional stylistic passes
- Subtle vignette shader pass — cheap, adds cinematic framing
- Very light film grain — helps mask banding in gradients (sky, bloom) at negligible cost
- A subtle color-grade LUT pass (`THREE.LUTPass` via three/addons) per district for consistent mood — this pairs with the per-district hemisphere lighting from Phase B4

### C5. Gate cost behind your existing adaptive quality system
Your README says you already auto-downgrade quality if FPS < 35 — hook post-processing into that same signal:
```js
if (quality === 'low') {
  bloom.enabled = false;
  composer.removePass(smaaPass); // or swap to FXAA
}
```
Post-processing passes are full-screen — they cost more on high-resolution/high-DPI displays, so this is exactly the kind of cost your adaptive system should be scaling first.

### C6. Where this lives in your repo
New addition, likely belongs in `src/core/` alongside your renderer setup, since the composer replaces your direct `renderer.render()` call in the main loop.

---

## Phase D — Performance: Push What You Already Have Further
**Effort: Medium-High (1–2 weeks, incremental) | Impact: Very High — this is what keeps 60 FPS as the world grows**

You already have InstancedMesh, distance culling, and adaptive quality per your README — good foundation. This phase is about extending those same patterns further, not starting over.

### D1. LOD for buildings and vehicles
```js
const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0);
lod.addLevel(midDetailMesh, 60);
lod.addLevel(lowDetailMesh, 150);
scene.add(lod);
```
This reduces triangle count **before** objects hit your existing cull distance, rather than rendering full detail right up until the object disappears. Pairs directly with your existing distance-culling system in `src/world/`.

### D2. Instance traffic AI, not just static props
If `src/traffic/` isn't already using `InstancedMesh` for the AI car bodies (wheels can stay separate if they need independent rotation), this is likely your next biggest draw-call win given "GTA-style" traffic density is a stated goal.

### D3. Merge static geometry per district
Use `BufferGeometryUtils.mergeGeometries()` for static, non-interactive geometry (curbs, lane markings, static props) that share a material — cuts draw calls dramatically. Keep this separate from your InstancedMesh objects (instancing and merging solve slightly different problems: merging is for unique-but-static geometry, instancing is for many copies of the same geometry).

### D4. Compressed textures (KTX2/Basis)
```js
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
const ktx2Loader = new KTX2Loader()
  .setTranscoderPath('basis/')
  .detectSupport(renderer);
```
Convert your texture assets to `.ktx2` (via the `toktx` / `basisu` CLI tools in your build pipeline). This is disproportionately important for your stated Indian/mobile audience — uncompressed PNG/JPG textures are decompressed to full size in GPU memory regardless of file size, and mid-range Android devices have far less VRAM headroom than a gaming PC. This affects both load time (smaller download) and runtime VRAM (smaller GPU memory footprint), which directly prevents texture-thrashing stutter.

### D5. Physics off the main thread
Cannon-es supports running in a Web Worker. Given you're already running physics + rendering + traffic AI + multiplayer networking on one thread, moving the physics step off-thread protects your frame budget as world complexity grows:
```js
// worker.js — runs Cannon-es world.step(), posts back transforms
// main thread — applies transforms to Three.js meshes, does NOT touch Cannon directly
```
This is a bigger architectural change than the others in this phase — sequence it after D1–D4 unless physics is already your measured bottleneck.

### D6. Zone-based streaming using your existing 7 districts
Your world is already segmented into 7 districts along a single z-axis (Desert → Dubai → Airport → Highway → Tokyo → Mountain → Village). This is a natural fit for a simple streaming system:
- Keep current district + 1 adjacent district on each side **fully resident** (geometry, textures, traffic AI active)
- Districts beyond that: dispose geometry/textures, or keep only a lightweight placeholder
- Trigger on player z-position crossing known district boundaries (you already have these boundaries defined for world layout)

This bounds your worst-case scene complexity regardless of how large the world grows later.

### D7. Where this lives in your repo
`src/world/` (LOD, streaming, merged static geometry), `src/traffic/` (instancing), `src/physics/` (worker migration).

---

## Phase E — WebGPU: Groundwork, Not Migration
**Effort: Low now, High later | Impact: Low now, potentially High later**

**Do not do this yet.** Reasoning, so you don't feel like you're skipping something important:

- GTA V itself is a native D3D/Vulkan title — "what GTA uses" doesn't actually mean WebGPU. The techniques in Phases A–D are the actual translation of "GTA-quality rendering" into browser terms.
- WebGPU's real advantage is **compute shaders** — GPU-driven culling, mass particle sims, crowd simulation. Your current bottlenecks (per your own README goals) are draw calls, texture memory, and shadow/post-processing cost — all solvable in WebGL2.
- Browser support is still uneven (Safari is recent, many Android WebViews lag), and a chunk of your target audience will hit a WebGL fallback regardless — meaning you need a solid WebGL2 path either way.

**What's worth doing now, cheaply:** write new materials using Three.js's TSL (Three Shading Language, `three/tsl`) where practical. TSL node materials can target both `WebGLRenderer` and `WebGPURenderer` from the same code, so this is a zero-cost-now way to keep a future WebGPU path open without committing to it.

**Revisit this phase once Phases A–D are solid and measured.** At that point, the highest-value WebGPU use case for your specific game is likely: GPU-driven traffic/crowd simulation (compute shader updates thousands of NPCs without CPU-side loops) and weather/dust particle systems for the desert and highway districts.

---

### Implementation Note (added after Phases A–D + C4 were completed)

**TSL is NOT available on the project's current Three.js version (0.160.1).**
The `three/tsl` subpath export was introduced in Three.js r163 (March 2024).
On 0.160.1, `import('three/tsl')` resolves to nothing — the TSL node material
system simply does not exist in this version. Upgrading to r163+ would be a
major version bump that risks breaking the entire codebase (API changes in
post-processing, material defaults, and the examples/jsm module structure
between 0.160 and 0.163+).

**What was done instead (Phase C4 stylistic passes):**
The "where practical" TSL groundwork item was reinterpreted as implementing
the Phase C4 optional stylistic passes (vignette, film grain, per-district
color-grade LUT) using the proven classic post-processing API
(`ShaderPass` + `FilmPass` + `LUTPass`). These are NEW shaders/effects that
didn't exist in the codebase before, so they satisfy the "write new materials
where practical" intent without forcing a Three.js upgrade.

**Future TSL migration path (when upgrading to Three.js r163+):**
1. The three C4 stylistic passes (`VignetteShader`, `FilmPass`, `LUTPass`)
   are self-contained `ShaderPass` instances — they can be rewritten as TSL
   node materials one at a time without touching the rest of the renderer.
2. The per-district LUT textures (`src/environment/DistrictLUTs.js`) are
   already data-driven and format-agnostic — they'll work unchanged with a
   TSL-based LUT pass.
3. The `MeshPhysicalMaterial` vehicle paint (Phase B1) can stay as-is; TSL
   node materials are an alternative authoring path, not a requirement.
   Converting them would only be worth it if you also want WebGPU output.

**When to actually do Phase E:**
- Upgrade Three.js to r163+ first (separate PR, full regression test).
- Then port the C4 stylistic passes to TSL as a proof-of-concept.
- Then evaluate whether WebGPU output is worth the complexity for your
  target audience (mid-range PC + mid/low Android per the README).

---

## Suggested Sequencing Summary

| Phase | Effort | Impact | Do this... |
|---|---|---|---|
| A — Renderer/Color | Low | Very High | This week |
| B — Materials/Lighting | Medium | High | Next |
| C — Post-processing | Medium | High | After B |
| D — Performance depth | Med-High | Very High | Ongoing, incremental |
| E — WebGPU groundwork | Low | Low (now) | Opportunistic, no rush |

---

## Next Steps

1. Implement Phase A first — it's low-risk, fast, and the visual jump will make the rest of the work feel worthwhile immediately.
2. Paste your actual `src/core/` renderer file, vehicle material setup, and world/culling code — I'll convert the relevant phase into exact diffs against your real repo instead of generic snippets.
3. Measure before/after FPS at each phase using your existing FPS counter/adaptive quality signal, so you know which changes are actually paying off on your target hardware, not just on your dev machine.
