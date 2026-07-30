/**
 * Traffic system — simple AI cars that drive along road segments.
 *
 * Each car:
 *   - Picks a road segment, drives along it
 *   - At the end, picks an intersecting segment (turn) or reverses
 *   - Has headlights (night) + brake lights
 *   - Stops briefly if the player vehicle is very close in front
 *
 * Uses kinematic bodies (no full physics) — cars are not driven into by player
 * physics for Phase 1 (collisions are visual only). Phase 2+ can upgrade.
 *
 * Phase D2 — Shared geometries: previously each _makeCarMesh() call created
 * brand-new BoxGeometry/CylinderGeometry instances. With ~20 traffic cars ×
 * 10+ meshes per car, that's 200+ geometry objects and 200+ shader variants
 * for what is structurally the same shape. Now all cars share the same
 * geometry instances via TrafficSystem._SHARED_GEO. Each car still owns its
 * own material (so colors stay unique), but geometries are referenced, not
 * cloned. This cuts GPU memory and shader-compilation cost significantly.
 *
 * True InstancedMesh is still the eventual goal for the body mesh itself
 * (single draw call for all car bodies), but requires per-instance color
 * attribute work — sequenced as a follow-up after this geometry-sharing win.
 */
import * as THREE from 'three';

// Lazily-built shared geometry pool — created once, reused by every traffic car.
TrafficSystem._SHARED_GEO = null;
TrafficSystem._getSharedGeo = function () {
  if (TrafficSystem._SHARED_GEO) return TrafficSystem._SHARED_GEO;
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.25, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.26, 8);
  hubGeo.rotateZ(Math.PI / 2);
  TrafficSystem._SHARED_GEO = {
    body:     new THREE.BoxGeometry(2, 0.7, 4.2),
    upper:    new THREE.BoxGeometry(1.95, 0.25, 4.1),
    cabin:    new THREE.BoxGeometry(1.85, 0.55, 2.0),
    interior: new THREE.BoxGeometry(1.7, 0.3, 1.8),
    bumperF:  new THREE.BoxGeometry(2.05, 0.2, 0.15),
    bumperR:  new THREE.BoxGeometry(2.05, 0.2, 0.15),
    wheel:    wheelGeo,
    hub:      hubGeo,
    head:     new THREE.SphereGeometry(0.15, 8, 6),
    tail:     new THREE.BoxGeometry(0.35, 0.15, 0.05),
    ind:      new THREE.SphereGeometry(0.08, 6, 4)
  };
  return TrafficSystem._SHARED_GEO;
};

export class TrafficSystem {
  constructor({ scene, city, count = 12 }) {
    this.scene = scene;
    this.city = city; // can be City (legacy) or World
    this.cars = [];
    this.root = new THREE.Group();
    this.root.name = 'Traffic';
    scene.add(this.root);

    // Bound for wrapping — World uses 1500, City uses halfWorld
    this._bound = city.halfWorld || 1500;

    this._carColors = [0xd32f2f, 0x1976d2, 0x388e3c, 0xfbc02d, 0x7b1fa2, 0x212121, 0xfafafa, 0xff6f00];

    for (let i = 0; i < count; i++) this._spawnCar();
  }

  _spawnCar() {
    const { point, dir } = this.city.randomRoadPoint();
    const car = this._makeCarMesh();
    car.position.copy(point);
    car.position.y = 0.5;
    // Merge runtime state WITHOUT clobbering refs set by _makeCarMesh
    Object.assign(car.userData, {
      dir,                 // 'ew' | 'ns'
      speed: 8 + Math.random() * 8,
      maxSpeed: 8 + Math.random() * 8,
      heading: dir === 'ew' ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      brake: false
    });
    car.rotation.y = car.userData.heading;
    this.root.add(car);
    this.cars.push(car);
  }

  _makeCarMesh() {
    const colors = [0xd32f2f, 0x1976d2, 0x388e3c, 0xfbc02d, 0x7b1fa2, 0x212121, 0xfafafa, 0xff6f00];
    const color = this._carColors[Math.floor(Math.random() * this._carColors.length)];
    // Phase B1 — MeshPhysicalMaterial with clearcoat for the GTA-style layered paint look.
    // Phase D2 — Material is per-car (so colors stay unique) but geometries are shared.
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.7,
      roughness: 0.25,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.0
    });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111820, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.85 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.98, roughness: 0.1 });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff0000, emissiveIntensity: 0.5 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff4d6, emissiveIntensity: 1.5 });
    const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x442200, roughness: 0.5 });

    const G = TrafficSystem._getSharedGeo();
    const g = new THREE.Group();
    // Lower body
    const body = new THREE.Mesh(G.body, bodyMat);
    body.position.y = 0.45; body.castShadow = true;
    // Upper body (hood/trunk level)
    const upper = new THREE.Mesh(G.upper, bodyMat);
    upper.position.y = 0.9;
    // Cabin (glass)
    const cabin = new THREE.Mesh(G.cabin, glassMat);
    cabin.position.set(0, 1.2, -0.1);
    // Interior (dark dashboard + seats silhouette)
    const interior = new THREE.Mesh(G.interior, interiorMat);
    interior.position.set(0, 0.95, -0.1);
    // Chrome bumper
    const bumperF = new THREE.Mesh(G.bumperF, chromeMat);
    bumperF.position.set(0, 0.5, 2.1);
    const bumperR = new THREE.Mesh(G.bumperR, chromeMat);
    bumperR.position.set(0, 0.5, -2.1);
    // Wheels — shared geometry, but each wheel is its own Mesh (so they can spin independently)
    const positions = [[-1.05, 0.36, 1.4], [1.05, 0.36, 1.4], [-1.05, 0.36, -1.4], [1.05, 0.36, -1.4]];
    for (const p of positions) {
      const w = new THREE.Mesh(G.wheel, darkMat);
      w.position.set(...p); w.castShadow = true;
      g.add(w);
      // Chrome hub
      const hub = new THREE.Mesh(G.hub, chromeMat);
      hub.position.set(...p);
      g.add(hub);
    }
    // Headlights
    const headL = new THREE.Mesh(G.head, headMat);
    headL.position.set(-0.6, 0.6, 2.1);
    const headR = headL.clone(); headR.position.x = 0.6;
    // Taillights
    const tailL = new THREE.Mesh(G.tail, tailMat);
    tailL.position.set(-0.65, 0.7, -2.1);
    const tailR = tailL.clone(); tailR.position.x = 0.65;
    // Indicators
    const indL = new THREE.Mesh(G.ind, indicatorMat.clone()); indL.position.set(-0.9, 0.6, 2.1);
    const indR = new THREE.Mesh(G.ind, indicatorMat.clone()); indR.position.set(0.9, 0.6, 2.1);

    g.add(body, upper, cabin, interior, bumperF, bumperR, headL, headR, tailL, tailR, indL, indR);
    g.userData.taillightMat = tailMat;

    // Headlight (point light) — brightened at night
    const pl = new THREE.PointLight(0xfff4d6, 0.0, 14, 2);
    pl.position.set(0, 0.6, 2.2);
    g.add(pl);
    g.userData.headlight = pl;
    g.userData.indMats = [indL.material, indR.material];
    return g;
  }

  update(dt, playerPos, isNight) {
    const half = this._bound;
    for (const car of this.cars) {
      const ud = car.userData;

      // Player proximity check — slow down if player is right in front
      const toPlayer = new THREE.Vector3().subVectors(playerPos, car.position);
      const distPlayer = toPlayer.length();
      ud.brake = false;
      if (distPlayer < 6) {
        // Check if player is roughly ahead
        const fwd = new THREE.Vector3(Math.sin(ud.heading), 0, Math.cos(ud.heading));
        if (fwd.dot(toPlayer) > 0 && Math.abs(toPlayer.y) < 2) {
          ud.brake = true;
        }
      }

      const target = ud.brake ? 0 : ud.maxSpeed;
      ud.speed = THREE.MathUtils.lerp(ud.speed, target, 1 - Math.pow(0.01, dt));

      // Move forward along heading
      car.position.x += Math.sin(ud.heading) * ud.speed * dt;
      car.position.z += Math.cos(ud.heading) * ud.speed * dt;

      // Wrap around at world boundary
      if (car.position.x >  half) car.position.x = -half;
      if (car.position.x < -half) car.position.x =  half;
      if (car.position.z >  half) car.position.z = -half;
      if (car.position.z < -half) car.position.z =  half;

      // Occasionally turn at intersections (5% chance per second)
      if (Math.random() < dt * 0.3) {
        // Snap to nearest intersection? Simplified: 50/50 turn left/right
        const turn = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
        ud.heading += turn;
        // Update dir
        const h = ((ud.heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        ud.dir = (Math.abs(h) < 0.5 || Math.abs(h - Math.PI) < 0.5 || Math.abs(h - Math.PI * 2) < 0.5) ? 'ew' : 'ns';
        car.rotation.y = ud.heading;
      }

      // Lights
      ud.taillightMat.emissiveIntensity = ud.brake ? 2.0 : 0.5;
      ud.headlight.intensity = isNight ? 1.0 : 0.0;
    }
  }
}
