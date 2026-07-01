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
├── core/           Game loop, renderer, camera
├── physics/        Physics world wrapper
├── environment/    Sky, sun, day/night cycle
├── world/          7-district world generator
├── player/         Player character + controls
├── vehicles/       Vehicle base, Bike, Car (with variants)
├── traffic/        AI traffic cars
├── systems/        All gameplay systems (Phase 3-5)
├── ui/             HUD
└── main.js         Entry point

server/
└── multiplayer-server.js   WebSocket relay
```

## Performance

- InstancedMesh for roads, lane markings, runway dashes
- Distance culling (buildings hidden beyond 200-350m based on quality)
- Adaptive quality (auto-downgrades if FPS < 35)
- Kinematic physics bodies (no solver jitter)
- 60 FPS target on mid-range hardware
