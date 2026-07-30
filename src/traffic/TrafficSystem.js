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
 * Rendering strategy (Phase D2 → InstancedMesh upgrade):
 *   - All car BODIES and UPPER meshes are drawn via TWO shared InstancedMeshes
 *     (one for body, one for upper). Each InstancedMesh holds `count` instances,
 *     one per car. Per-instance color comes from setColorAt(), so each car
 *     keeps its unique paint color while the entire fleet renders in 2 draw
 *     calls instead of `2 * count` draw calls (e.g. 20 cars = 2 draw calls
 *     instead of 40).
 *   - Smaller parts (cabin glass, interior, chrome bumpers, wheels, hubs,
 *     headlights, taillights, indicators) stay as regular Meshes inside the
 *     per-car Group because they need independent materials (emissive lights,
 *     transparent glass, blink-animated indicators) and the headlight is a
 *     PointLight that must live in the scene graph.
 *   - Shared geometries (TrafficSystem._SHARED_GEO) are referenced, not cloned.
 *   - Per-frame, _syncInstancedMeshes() derives each instance's world matrix
 *     from the car Group's position + heading. Cars are children of this.root
 *     (identity transform), so car.matrix IS its world matrix.
 *
 * The clearcoat paint look (Phase B1) is preserved by using MeshPhysicalMaterial
 * on the shared InstancedMesh material — Three.js correctly multiplies the
 * per-instance color into MeshPhysicalMaterial's diffuse channel.
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

    // Pre-allocate InstancedMesh capacity to match the requested car count.
    // Capacity is fixed at construction time — traffic density does not change
    // dynamically in this game.
    this._capacity = count;

    for (let i = 0; i < count; i++) this._spawnCar();

    // Phase D2 — Now build the two InstancedMeshes (body + upper) that will
    // draw all car bodies/upper meshes in 2 draw calls total instead of 2*count.
    this._initBodyInstancedMesh();
  }

  /**
   * Phase D2 — Build the two InstancedMeshes for body and upper meshes.
   * Both share a single MeshPhysicalMaterial with white base color; per-instance
   * color is provided via setColorAt() so each car keeps its unique paint color.
   */
  _initBodyInstancedMesh() {
    if (this._capacity === 0) return;
    const G = TrafficSystem._getSharedGeo();

    // Shared paint material. White base color because per-instance color
    // multiplies into the diffuse channel — if the base was anything other
    // than white, the per-instance tint would be color-shifted.
    // Clearcoat preserved from Phase B1 for the GTA "wet paint" look.
    const sharedBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.7,
      roughness: 0.25,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.0
    });

    this._bodyInst = new THREE.InstancedMesh(G.body, sharedBodyMat, this._capacity);
    this._bodyInst.castShadow = true;
    this._bodyInst.frustumCulled = false; // instances span the whole world; default bounding sphere is wrong
    this._bodyInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this._bodyInst);

    this._upperInst = new THREE.InstancedMesh(G.upper, sharedBodyMat, this._capacity);
    this._upperInst.castShadow = true;
    this._upperInst.frustumCulled = false;
    this._upperInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this._upperInst);

    // Per-instance colors — set once at construction; traffic colors don't change.
    const tmpColor = new THREE.Color();
    for (let i = 0; i < this.cars.length; i++) {
      tmpColor.setHex(this.cars[i].userData.bodyColor);
      this._bodyInst.setColorAt(i, tmpColor);
      this._upperInst.setColorAt(i, tmpColor);
    }
    if (this._bodyInst.instanceColor) this._bodyInst.instanceColor.needsUpdate = true;
    if (this._upperInst.instanceColor) this._upperInst.instanceColor.needsUpdate = true;

    // Initial matrix sync so the InstancedMesh isn't empty on the first frame.
    this._syncInstancedMeshes();
  }

  /**
   * Phase D2 — Per-frame: derive each instance's world matrix from the car's
   * position + heading. Body local position is (0, 0.45, 0) and upper local
   * position is (0, 0.9, 0); car position.y is 0.5, so body world y = 0.95
   * and upper world y = 1.4. Cars are children of this.root (identity transform),
   * so car.position IS its world position.
   */
  _syncInstancedMeshes() {
    if (!this._bodyInst) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const heading = car.rotation.y;
      // Body: rotation.y = heading, position offset (0, 0.45, 0) from car origin
      m.makeRotationY(heading);
      m.setPosition(car.position.x, car.position.y + 0.45, car.position.z);
      this._bodyInst.setMatrixAt(i, m);
      // Upper: same rotation, position offset (0, 0.9, 0) from car origin
      m.setPosition(car.position.x, car.position.y + 0.9, car.position.z);
      this._upperInst.setMatrixAt(i, m);
    }
    this._bodyInst.instanceMatrix.needsUpdate = true;
    this._upperInst.instanceMatrix.needsUpdate = true;
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
    // Pick this car's paint color and stash it in userData for the InstancedMesh setup.
    const color = this._carColors[Math.floor(Math.random() * this._carColors.length)];

    // Per-car materials for the non-instanced parts (glass, lights, chrome, etc.).
    // The body + upper meshes are NO LONGER created here — they're drawn by the
    // shared InstancedMeshes (_bodyInst + _upperInst) built in _initBodyInstancedMesh().
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111820, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.85 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.98, roughness: 0.1 });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff0000, emissiveIntensity: 0.5 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff4d6, emissiveIntensity: 1.5 });
    const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x442200, roughness: 0.5 });

    const G = TrafficSystem._getSharedGeo();
    const g = new THREE.Group();
    // NOTE: body and upper are intentionally NOT created here — they are drawn by
    // the shared InstancedMeshes. This removes 2 draw calls per car.
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

    g.add(cabin, interior, bumperF, bumperR, headL, headR, tailL, tailR, indL, indR);
    g.userData.bodyColor = color;
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

    // Phase D2 — Sync the body/upper InstancedMeshes after all car positions
    // have been updated. This is the per-frame cost of instanced rendering:
    // one matrix compose per car per InstancedMesh, plus a single buffer upload.
    // For 20 cars × 2 InstancedMeshes = 40 matrix compositions per frame,
    // which is negligible vs. the 40 draw calls saved.
    this._syncInstancedMeshes();
  }
}
