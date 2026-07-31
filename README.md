# Open City Bike 3D — GTA-Style Browser Game

A browser-based 3D open-world driving game built with **Vite + Three.js + Cannon-es + WebSocket + WebRTC**.

## Features

### Phase 1 — Prototype
- Bike driving with arcade physics (acceleration, steering, lean)
- Character walking with third-person camera
- Small city with roads, buildings, traffic AI
- Day/night cycle with dynamic sky

### Phase 2 — Vehicles & Systems
- 3 bike variants (Sport, Cruiser, Dirt)
- Drivable cars (Sedan, Sports, SUV)
- Fuel system with fuel stations
- Speedometer + gear indicator
- Mobile touch controls

### Phase 3 — Open World
- 7 districts: Desert → Dubai → Airport → Highway → Tokyo → Mountain → Village
- NPC pedestrians (wander + flee)
- Police system with 5-star wanted level + chasing police cars
- Stunt ramps + scoring
- Delivery missions
- Distance culling for performance

### Phase 4 — Online Features
- **Character customization** — skin tone, shirt, pants, hair style/color, helmet
- **Buyable houses** — 6 houses across districts, passive income, garage access
- **Buyable businesses** — 6 businesses (car wash, nightclub, diner, repair, etc.)
- **Multiplayer** — WebSocket relay server + client sync, remote player rendering
- **Voice chat** — WebRTC peer-to-peer with spatial audio + push-to-talk

### Phase 5 — Advanced
- **Garage system** — store and switch between all 6 vehicles
- **Race events** — 3 races (sprint + circuit) with checkpoints, timer, best times saved
- **Economy system** — cash + bank, transactions, passive income from properties
- **In-game phone** — 7 apps (Home, Map, Missions, Properties, Garage, Settings, Multiplayer)

## Run

### Development
```bash
npm install
npm run dev      # http://localhost:5173
```

### Multiplayer Server (optional)
```bash
npm run server   # ws://localhost:8787
```
Then open the multiplayer panel in-game (press `O`) and click CONNECT.

### Production Build
```bash
npm run build
npm run preview  # http://localhost:4173
```

## Controls

| Key | Action |
|-----|--------|
| WASD | Move / Drive |
| Space | Brake |
| Shift | Boost |
| F | Enter / Exit vehicle |
| V | Switch vehicle type (bike/car) |
| B | Switch vehicle variant |
| C | Change camera |
| N | Toggle time of day |
| R | Reset position |
| M | New mission |
| K | Start race (near race marker) |
| P | Open phone |
| G | Open garage (near owned house) |
| J | Character customizer |
| O | Multiplayer panel |
| H | Buy house (when nearby) |
| U | Buy business (when nearby) |
| T | Voice chat (hold to talk) |

## World Layout

```
[ Desert ]            z = -1200
   |
[ Dubai Downtown ]    z = -800   (Burj Khalifa, Palm Island, luxury cars)
   |
[ Airport ]           z = -400   (runway, terminal, airplane, hangars)
   |
[ Highway ]           z =    0   (central plaza, spawn point)
   |
[ Tokyo District ]    z =  400   (neon, anime shops, Tokyo Tower, train)
   |
[ Mountain Roads ]    z =  800   (peaks, winding roads, pine trees)
   |
[ Village Area ]      z = 1200   (houses, farms, windmill)
```

## Tech Stack

- **Vite** — fast dev server + bundler
- **Three.js** — 3D rendering (Sky shader, shadows, instanced meshes)
- **Cannon-es** — physics simulation (kinematic bodies for arcade control)
- **WebSocket (ws)** — multiplayer relay server
- **WebRTC** — peer-to-peer voice chat with spatial audio
- **localStorage** — race best times + save data

## Architecture

```
src/
├── core/           Game loop, Renderer (post-processing pipeline), Camera
├── physics/        PhysicsWorld (kinematic) + physics-worker.js + PhysicsWorkerClient (dynamic, off-thread)
├── environment/    Sky, sun, day/night, ReflectionManager (PMREM), DistrictLUTs (color grading)
├── world/          7-district world generator, RoadSystem (merged markings), PBRTextures (KTX2-ready)
├── player/         Player character + Controls + KTX2TextureLoader
├── vehicles/       Vehicle base, Bike, Car (MeshPhysicalMaterial clearcoat paint)
├── traffic/        AI traffic (InstancedMesh bodies, shared geometry pool)
├── systems/        DistanceCuller, LODManager, DistrictStreamer + all gameplay systems
├── ui/             HUD
└── main.js         Entry point

server/
└── multiplayer-server.js   WebSocket relay
```

## Performance

### 3-tier culling pipeline
1. **District streaming** (`src/systems/DistrictStreamer.js`) — coarse district-level cull. Keeps current district + 1 adjacent on each side resident (3 of 7 max), hides the rest. Re-evaluates at 1 Hz.
2. **Distance culler** (`src/systems/DistanceCuller.js`) — per-mesh cull beyond drawDistance (200–350m based on quality). Re-evaluates at 5 Hz.
3. **LOD manager** (`src/systems/LODManager.js`) — per-building level swap. Native `THREE.LOD` objects update every frame; legacy detail-part pattern updates at 2 Hz.

### Draw-call reductions
- **Traffic InstancedMesh** — all car bodies + upper meshes drawn via 2 shared `InstancedMesh`es (one per part) with per-instance color. 20 cars = 2 draw calls instead of 40.
- **Road markings merged** — yellow center dashes, white lane divider dashes, and crosswalk stripes are buffered during road build, then flushed as one merged mesh per material via `BufferGeometryUtils.mergeGeometries()`. ~1500 individual meshes collapsed to 3.
- **Shared geometry pool** — all traffic cars reference a single set of `BoxGeometry`/`CylinderGeometry`/`SphereGeometry` instances instead of allocating their own.

### Rendering pipeline (post-processing)
```
RenderPass → SSAO → Bloom → FXAA → OutputPass → LUTPass → Vignette → FilmPass
```
- **ACES Filmic tone mapping** + sRGB color space (Phase A)
- **PCF Soft shadows** with player-following sun frustum (±80 units, recentered every frame — lightweight single-cascade system)
- **Bloom** — subtle, high-threshold (only neon/headlights/sun bloom)
- **SSAO** — subtle ambient occlusion (high/ultra quality only)
- **Per-district color-grade LUT** (`src/environment/DistrictLUTs.js`) — 7 procedurally-generated 16³ LUTs, one per district mood (Desert=warm sandy, Dubai=luxury teal, Tokyo=neon magenta-cyan, Mountain=misty desaturated, Village=golden hour, etc.). Switches automatically when crossing district boundaries at 60% intensity.
- **Vignette** — subtle cinematic edge darkening (display space)
- **Film grain** — barely-visible noise masks banding in sky/bloom gradients

### Materials
- **MeshPhysicalMaterial with clearcoat** on all vehicle paint (Car, Bike, Traffic) for the GTA-style layered "wet paint" look
- **PMREM environment map** from the Sky shader, refreshed every 5 seconds, applied to all PBR materials with metalness > 0

### Texture compression (Phase D4)
- **KTX2 opportunistic upgrade** — `src/player/KTX2TextureLoader.js` attempts to load `.ktx2` compressed textures for asphalt/concrete/glass. Falls back to procedurally-generated CanvasTextures if KTX2 is unavailable or files are missing.
- Drop `.ktx2` files into `/textures/` (e.g. `asphalt_color.ktx2`, `concrete.ktx2`, `glass.ktx2`) to enable. Convert PNGs via `toktx --bcmp --genmipmap output.ktx2 input.png`.
- 70% smaller GPU memory than uncompressed — disproportionately important for mid-range Android VRAM headroom.

### Physics worker (Phase D5)
- **`src/physics/physics-worker.js`** — Web Worker owning its own `CANNON.World` for off-thread dynamic body simulation.
- **`src/physics/PhysicsWorkerClient.js`** — main-thread async client with promise-based API.
- Current codebase uses kinematic bodies (player, vehicles, traffic) which stay on the main thread. The worker is **infrastructure for future dynamic bodies** (ragdolls, debris, physics props) — they'll automatically run off-thread via `this.physicsWorker.addDynamicBody(...)`.
- All world static colliders are mirrored into the worker at init time so dynamic bodies will collide with buildings correctly.

### Quality presets
| Tier | Pixel ratio | Shadows | Bloom | SSAO | LUT | Vignette | Film |
|------|-------------|---------|-------|------|-----|----------|------|
| Low  | ≤0.75       | off     | off   | off  | off | off      | off  |
| Medium | ≤1.0      | on      | subtle| off  | on  | on       | off  |
| High | ≤1.5        | on      | on    | on   | on  | on       | subtle|
| Ultra| ≤2.0        | on      | stronger| on | on  | on       | on   |

- **Adaptive quality** — auto-downgrades if FPS < 35 for 3+ seconds.
- **60 FPS target** on mid-range hardware; playable on mid/low-end Android.
