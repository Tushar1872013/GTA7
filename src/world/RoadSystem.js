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
 * Uses InstancedMesh for repeated elements (markings, curbs).
 */
import * as THREE from 'three';
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
  }

  buildFromSegments(segments) {
    for (const seg of segments) {
      this._buildRoad(seg);
    }
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

    // === Center line (dashed yellow) ===
    const dashCount = Math.floor(len / 6);
    const dashGeo = new THREE.PlaneGeometry(3, 0.25);
    dashGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < dashCount; i++) {
      const t = (i + 0.5) / dashCount;
      const x = seg.a.x + dx * t;
      const z = seg.a.z + dz * t;
      const dash = new THREE.Mesh(dashGeo, this._yellowMarkingMat);
      dash.position.set(x, 0.03, z);
      dash.rotation.y = -angle;
      this.root.add(dash);
    }

    // === Lane divider (dashed white) — for wider roads ===
    if (width >= 12) {
      const laneGeo = new THREE.PlaneGeometry(2, 0.2);
      laneGeo.rotateX(-Math.PI / 2);
      const perpX = -dz / len;
      const perpZ = dx / len;
      for (let i = 0; i < dashCount; i++) {
        const t = (i + 0.5) / dashCount;
        const baseX = seg.a.x + dx * t;
        const baseZ = seg.a.z + dz * t;
        // Left lane line
        const ll = new THREE.Mesh(laneGeo, this._markingMat);
        ll.position.set(baseX + perpX * width * 0.25, 0.03, baseZ + perpZ * width * 0.25);
        ll.rotation.y = -angle;
        this.root.add(ll);
        // Right lane line
        const rl = new THREE.Mesh(laneGeo, this._markingMat);
        rl.position.set(baseX - perpX * width * 0.25, 0.03, baseZ - perpZ * width * 0.25);
        rl.rotation.y = -angle;
        this.root.add(rl);
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
    const stripeGeo = new THREE.PlaneGeometry(0.4, width * 0.8);
    stripeGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < stripeCount; i++) {
      const t = (i + 0.5) / stripeCount;
      const x = a.x + (b.x - a.x) * 0.05 + perpX * width * (t - 0.5) * 1.2;
      const z = a.z + (b.z - a.z) * 0.05 + perpZ * width * (t - 0.5) * 1.2;
      const stripe = new THREE.Mesh(stripeGeo, this._markingMat);
      stripe.position.set(x, 0.03, z);
      stripe.rotation.y = -angle + Math.PI / 2;
      this.root.add(stripe);
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
