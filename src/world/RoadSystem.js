/**
 * RoadSystem — detailed PBR roads with markings, curbs, crosswalks.
 *
 * Generates road networks with:
 *   - PBR asphalt (color + roughness map with cracks)
 *   - Lane markings (dashed white, solid yellow)
 *   - Crosswalks at intersections
 *   - Curbs (concrete edges)
 *   - Sidewalks (raised concrete)
 *   - Parking spaces (where applicable)
 *   - Road patches (darker repair patches)
 *   - Drain covers
 *   - Speed breakers (in residential)
 *   - Traffic signal poles
 *
 * Phase D3 — Static geometry merging:
 *   - Road networks can have 50+ segments, each spawning ~10 dashed yellow
 *     center marks + up to 20 dashed white lane lines. That's hundreds of
 *     individual Mesh objects, each its own draw call, all sharing the same
 *     material.
 *   - Now: dashes are buffered during buildFromSegments() into per-type
 *     geometry arrays, then flushed ONCE at the end via
 *     BufferGeometryUtils.mergeGeometries(). One draw call per material
 *     instead of hundreds.
 *   - Asphalt roads and curbs already share materials per road-width, so
 *     they're not the bottleneck — the markings are.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getAsphaltTexture } from './PBRTextures.js';

export class RoadSystem {
  constructor({ scene, world }) {
    this.scene = scene;
    this.world = world;
    this.root = new THREE.Group();
    this.root.name = 'Roads';
    scene.add(this.root);

    this._asphalt = getAsphaltTexture();
    this._roadMats = new Map(); // cache by width
    this._markingMat = new THREE.MeshStandardMaterial({
      color: 0xfafafa, roughness: 0.6, metalness: 0.1,
      emissive: 0x444444, emissiveIntensity: 0.1
    });
    this._yellowMarkingMat = new THREE.MeshStandardMaterial({
      color: 0xffd54f, roughness: 0.5, emissive: 0x886600, emissiveIntensity: 0.3
    });
    this._curbMat = new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.8 });
    this._sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.85 });

    this.trafficSignals = []; // for animation

    // Phase D3 — Buffers for static markings that will be merged at the end.
    // Each entry is an array of BufferGeometry instances (already transformed
    // to its world position via .applyMatrix4) that share the same material.
    this._dashGeos = [];        // yellow center dashes
    this._laneLineGeos = [];    // white lane divider dashes
    this._crosswalkGeos = [];   // white crosswalk stripes
    // Shared base geometries — cloned per use so transforms don't pollute the shared copy.
    this._dashBaseGeo = new THREE.PlaneGeometry(3, 0.25);
    this._dashBaseGeo.rotateX(-Math.PI / 2);
    this._laneLineBaseGeo = new THREE.PlaneGeometry(2, 0.2);
    this._laneLineBaseGeo.rotateX(-Math.PI / 2);
    this._crosswalkBaseGeo = new THREE.PlaneGeometry(0.4, 0.8);
    this._crosswalkBaseGeo.rotateX(-Math.PI / 2);
  }

  buildFromSegments(segments) {
    for (const seg of segments) {
      this._buildRoad(seg);
    }
    // Phase D3 — Flush all buffered static markings as one merged mesh per type.
    this._flushMergedMarkings();
  }

  /**
   * Phase D3 — Convert all buffered geometries into a single merged Mesh per
   * material. One draw call per material instead of one per dash.
   */
  _flushMergedMarkings() {
    if (this._dashGeos.length) {
      const merged = mergeGeometries(this._dashGeos, false);
      const mesh = new THREE.Mesh(merged, this._yellowMarkingMat);
      mesh.renderOrder = 1;
      this.root.add(mesh);
      // Dispose the per-dash clones — only the merged geometry is needed now.
      for (const g of this._dashGeos) g.dispose();
      this._dashGeos = [];
    }
    if (this._laneLineGeos.length) {
      const merged = mergeGeometries(this._laneLineGeos, false);
      const mesh = new THREE.Mesh(merged, this._markingMat);
      mesh.renderOrder = 1;
      this.root.add(mesh);
      for (const g of this._laneLineGeos) g.dispose();
      this._laneLineGeos = [];
    }
    if (this._crosswalkGeos.length) {
      const merged = mergeGeometries(this._crosswalkGeos, false);
      const mesh = new THREE.Mesh(merged, this._markingMat);
      mesh.renderOrder = 1;
      this.root.add(mesh);
      for (const g of this._crosswalkGeos) g.dispose();
      this._crosswalkGeos = [];
    }
  }

  /**
   * Phase D3 — Helper: clone a base geometry, apply a world transform (position
   * + Y rotation), and push it into a buffer for later merging.
   * Using applyMatrix4 with a composed Matrix4 avoids needing to use the
   * mesh.translate/rotate API (which doesn't exist on BufferGeometry).
   */
  _bufferMarking(buffer, baseGeo, x, y, z, rotY) {
    const g = baseGeo.clone();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    buffer.push(g);
  }

  _buildRoad(seg) {
    const dx = seg.b.x - seg.a.x;
    const dz = seg.b.z - seg.a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1) return;
    const width = seg.width || 10;
    const angle = Math.atan2(dz, dx);
    const midX = (seg.a.x + seg.b.x) / 2;
    const midZ = (seg.a.z + seg.b.z) / 2;

    // === Asphalt ===
    const geo = new THREE.PlaneGeometry(len, width);
    geo.rotateX(-Math.PI / 2);
    const mat = this._getRoadMat(width);
    const road = new THREE.Mesh(geo, mat);
    road.position.set(midX, 0.02, midZ);
    road.rotation.y = -angle;
    road.receiveShadow = true;
    this.root.add(road);

    // === Center line (dashed yellow) — buffered for merge ===
    const dashCount = Math.floor(len / 6);
    for (let i = 0; i < dashCount; i++) {
      const t = (i + 0.5) / dashCount;
      const x = seg.a.x + dx * t;
      const z = seg.a.z + dz * t;
      // rotY is -angle (matches the original road.rotation.y = -angle)
      this._bufferMarking(this._dashGeos, this._dashBaseGeo, x, 0.03, z, -angle);
    }

    // === Lane divider (dashed white) — for wider roads, buffered for merge ===
    if (width >= 12) {
      const perpX = -dz / len;
      const perpZ = dx / len;
      for (let i = 0; i < dashCount; i++) {
        const t = (i + 0.5) / dashCount;
        const baseX = seg.a.x + dx * t;
        const baseZ = seg.a.z + dz * t;
        // Left lane line
        this._bufferMarking(this._laneLineGeos, this._laneLineBaseGeo,
          baseX + perpX * width * 0.25, 0.03, baseZ + perpZ * width * 0.25, -angle);
        // Right lane line
        this._bufferMarking(this._laneLineGeos, this._laneLineBaseGeo,
          baseX - perpX * width * 0.25, 0.03, baseZ - perpZ * width * 0.25, -angle);
      }
    }

    // === Curbs (both sides) ===
    this._addCurbs(seg.a, seg.b, width, angle);

    // === Sidewalks (both sides) ===
    this._addSidewalks(seg.a, seg.b, width, angle, len);

    // === Random drain covers ===
    if (Math.random() < 0.3) {
      this._addDrainCover(midX + (Math.random() - 0.5) * len * 0.5, midZ, angle);
    }

    // === Road patch (darker repair) ===
    if (Math.random() < 0.2) {
      this._addRoadPatch(seg.a, seg.b, width, angle, len);
    }
  }

  _getRoadMat(width) {
    const key = Math.round(width);
    if (!this._roadMats.has(key)) {
      const tex = this._asphalt.map.clone();
      const rTex = this._asphalt.roughnessMap.clone();
      tex.repeat.set(width / 4, 1);
      rTex.repeat.set(width / 4, 1);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      rTex.wrapS = rTex.wrapT = THREE.RepeatWrapping;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x2a2a2e,
        roughness: 0.92,
        metalness: 0.0,
        map: tex,
        roughnessMap: rTex
      });
      this._roadMats.set(key, mat);
    }
    return this._roadMats.get(key);
  }

  _addCurbs(a, b, width, angle) {
    const len = a.distanceTo(b);
    const perpX = -(b.z - a.z) / len;
    const perpZ = (b.x - a.x) / len;
    for (const side of [1, -1]) {
      const curbGeo = new THREE.BoxGeometry(len, 0.25, 0.3);
      const curb = new THREE.Mesh(curbGeo, this._curbMat);
      const offset = side * (width / 2 + 0.15);
      curb.position.set(
        (a.x + b.x) / 2 + perpX * offset,
        0.12,
        (a.z + b.z) / 2 + perpZ * offset
      );
      curb.rotation.y = -angle;
      curb.receiveShadow = true;
      this.root.add(curb);
    }
  }

  _addSidewalks(a, b, width, angle, len) {
    const perpX = -(b.z - a.z) / len;
    const perpZ = (b.x - a.x) / len;
    for (const side of [1, -1]) {
      const swGeo = new THREE.PlaneGeometry(len, 2.5);
      swGeo.rotateX(-Math.PI / 2);
      const sw = new THREE.Mesh(swGeo, this._sidewalkMat);
      const offset = side * (width / 2 + 1.7);
      sw.position.set(
        (a.x + b.x) / 2 + perpX * offset,
        0.15,
        (a.z + b.z) / 2 + perpZ * offset
      );
      sw.rotation.y = -angle;
      sw.receiveShadow = true;
      this.root.add(sw);
    }
  }

  _addDrainCover(x, z, angle) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7, metalness: 0.6 });
    const drain = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.5), mat);
    drain.position.set(x, 0.04, z);
    drain.rotation.y = -angle;
    this.root.add(drain);
  }

  _addRoadPatch(a, b, width, angle, len) {
    const t = 0.3 + Math.random() * 0.4;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    const patchMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.95 });
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.6, 3 + Math.random() * 3),
      patchMat
    );
    patch.geometry.rotateX(-Math.PI / 2);
    patch.position.set(x, 0.025, z);
    patch.rotation.y = -angle;
    this.root.add(patch);
  }

  addCrosswalk(a, b, width) {
    const angle = Math.atan2(b.z - a.z, b.x - a.x);
    const perpX = -(b.z - a.z) / a.distanceTo(b);
    const perpZ = (b.x - a.x) / a.distanceTo(b);
    const stripeCount = 8;
    // Phase D3 — Crosswalk stripes are added OUTSIDE buildFromSegments() (called
    // by external code), so we cannot rely on the build-time buffer+flush flow.
    // Instead: build per-stripe geometries into a temp array, merge immediately,
    // and add ONE merged mesh to the root. Still saves stripeCount-1 draw calls
    // per crosswalk vs the old one-Mesh-per-stripe approach.
    const stripeGeos = [];
    for (let i = 0; i < stripeCount; i++) {
      const t = (i + 0.5) / stripeCount;
      const x = a.x + (b.x - a.x) * 0.05 + perpX * width * (t - 0.5) * 1.2;
      const z = a.z + (b.z - a.z) * 0.05 + perpZ * width * (t - 0.5) * 1.2;
      // Stripe geometry uses width*0.8 in Z direction (matches original)
      const geo = new THREE.PlaneGeometry(0.4, width * 0.8);
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle + Math.PI / 2);
      m.compose(new THREE.Vector3(x, 0.03, z), q, new THREE.Vector3(1, 1, 1));
      geo.applyMatrix4(m);
      stripeGeos.push(geo);
    }
    if (stripeGeos.length) {
      const merged = mergeGeometries(stripeGeos, false);
      const mesh = new THREE.Mesh(merged, this._markingMat);
      mesh.renderOrder = 1;
      this.root.add(mesh);
      for (const g of stripeGeos) g.dispose();
    }
  }

  addTrafficSignal(pos, facing = 0) {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.6, roughness: 0.4 });
    // Pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 8), poleMat);
    pole.position.y = 2.5; pole.castShadow = true;
    // Arm
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 0.1), poleMat);
    arm.position.set(1.2, 4.5, 0);
    // Housing
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }));
    housing.position.set(2.4, 4, 0);
    // Lights
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.0 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.2 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.2 });
    const lightGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const red = new THREE.Mesh(lightGeo, redMat); red.position.set(2.58, 4.3, 0);
    const yellow = new THREE.Mesh(lightGeo, yellowMat); yellow.position.set(2.58, 4, 0);
    const green = new THREE.Mesh(lightGeo, greenMat); green.position.set(2.58, 3.7, 0);
    g.add(pole, arm, housing, red, yellow, green);
    g.position.copy(pos);
    g.rotation.y = facing;
    g.userData = { red, yellow, green, state: 'red', timer: Math.random() * 10 };
    this.root.add(g);
    this.trafficSignals.push(g);
  }

  update(dt, isNight) {
    // Animate traffic signals
    for (const sig of this.trafficSignals) {
      sig.userData.timer += dt;
      const cycle = sig.userData.timer % 12;
      const ud = sig.userData;
      if (cycle < 5) {
        ud.red.material.emissiveIntensity = 1.0;
        ud.yellow.material.emissiveIntensity = 0.2;
        ud.green.material.emissiveIntensity = 0.2;
      } else if (cycle < 10) {
        ud.red.material.emissiveIntensity = 0.2;
        ud.yellow.material.emissiveIntensity = 0.2;
        ud.green.material.emissiveIntensity = 1.0;
      } else {
        ud.red.material.emissiveIntensity = 0.2;
        ud.yellow.material.emissiveIntensity = 1.0;
        ud.green.material.emissiveIntensity = 0.2;
      }
    }
  }
}
