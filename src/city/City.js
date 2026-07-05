/**
 * City generator — procedurally lays out a small grid city.
 *
 * Layout (Phase 1):
 *   - 8x8 block grid centered at origin, each block ~40 units
 *   - Roads are 10-wide lanes between blocks
 *   - Buildings placed on each block with random heights & colors
 *   - Two palette zones: "Dubai" (warm sand + glass) and "Tokyo" (neon + dark)
 *     — Dubai is the +X half, Tokyo is the -X half, divided by a central highway
 *
 * Each building gets a physics box collider. Meshes are merged per material
 * where possible to reduce draw calls.
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class City {
  constructor({ scene, physics }) {
    this.scene = scene;
    this.physics = physics;

    this.size = 8;              // blocks per side
    this.blockSize = 40;
    this.roadWidth = 10;
    this.cellSize = this.blockSize + this.roadWidth;
    this.halfWorld = (this.size * this.cellSize) / 2;

    this.buildings = [];        // for camera collision + minimap
    this.colliders = [];        // physics bodies
    this.roadSegments = [];     // for traffic waypoints {a, b, dir}
    this.spawnPoints = [];      // player/bike spawn candidates
    this.root = new THREE.Group();
    this.root.name = 'City';
    scene.add(this.root);

    this._buildGround();
    this._buildRoads();
    this._buildBuildings();
    this._buildDecorations();
  }

  _buildGround() {
    const total = this.size * this.cellSize + 60;
    const geo = new THREE.PlaneGeometry(total, total, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.95 });
    const ground = new THREE.Mesh(geo, mat);
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.root.add(ground);
    this.groundMesh = ground;

    // Physics ground is added once at PhysicsWorld.addGround; here we extend
    // with road-level colliders implicitly via the ground plane.
  }

  _buildRoads() {
    // Road material — slightly reflective dark asphalt
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.85, metalness: 0.05 });
    const laneMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.6, emissive: 0x443300, emissiveIntensity: 0.3 });

    const total = this.size * this.cellSize;
    const half = total / 2;

    // One horizontal road strip per row gap (size+1 strips each direction)
    const stripGeoH = new THREE.PlaneGeometry(total, this.roadWidth);
    stripGeoH.rotateX(-Math.PI / 2);
    const stripGeoV = new THREE.PlaneGeometry(this.roadWidth, total);
    stripGeoV.rotateX(-Math.PI / 2);

    // Use InstancedMesh for performance
    const countH = this.size + 1;
    const countV = this.size + 1;
    const instH = new THREE.InstancedMesh(stripGeoH, asphaltMat, countH);
    const instV = new THREE.InstancedMesh(stripGeoV, asphaltMat, countV);
    instH.receiveShadow = true; instV.receiveShadow = true;

    const m = new THREE.Matrix4();
    for (let i = 0; i < countH; i++) {
      const z = -half + i * this.cellSize;
      m.makeTranslation(0, 0, z);
      instH.setMatrixAt(i, m);
      // Register road segment (east-west)
      this.roadSegments.push({ a: new THREE.Vector3(-half, 0, z), b: new THREE.Vector3(half, 0, z), dir: 'ew' });
    }
    for (let i = 0; i < countV; i++) {
      const x = -half + i * this.cellSize;
      m.makeTranslation(x, 0, 0);
      instV.setMatrixAt(i, m);
      // Register road segment (north-south)
      this.roadSegments.push({ a: new THREE.Vector3(x, 0, -half), b: new THREE.Vector3(x, 0, half), dir: 'ns' });
    }
    instH.instanceMatrix.needsUpdate = true;
    instV.instanceMatrix.needsUpdate = true;
    this.root.add(instH, instV);

    // Lane markings — thin yellow quads down the middle of each road (also instanced)
    const markGeoH = new THREE.PlaneGeometry(total, 0.25); markGeoH.rotateX(-Math.PI / 2);
    const markGeoV = new THREE.PlaneGeometry(0.25, total); markGeoV.rotateX(-Math.PI / 2);
    const instMH = new THREE.InstancedMesh(markGeoH, laneMat, countH);
    const instMV = new THREE.InstancedMesh(markGeoV, laneMat, countV);
    for (let i = 0; i < countH; i++) {
      const z = -half + i * this.cellSize;
      m.makeTranslation(0, 0.02, z);
      instMH.setMatrixAt(i, m);
    }
    for (let i = 0; i < countV; i++) {
      const x = -half + i * this.cellSize;
      m.makeTranslation(x, 0.02, 0);
      instMV.setMatrixAt(i, m);
    }
    instMH.instanceMatrix.needsUpdate = true;
    instMV.instanceMatrix.needsUpdate = true;
    this.root.add(instMH, instMV);
  }

  _buildBuildings() {
    // Reusable geometries by footprint class
    const total = this.size * this.cellSize;
    const half = total / 2;

    // Palette zones
    const dubaiPalette = [
      0xe6d3a3, 0xc9a978, 0xb08a5a, 0xd4b483,  // sand tones
      0x6db4d6, 0x4a90b8, 0x88c4dc,             // glass blues
      0xecebe6, 0xd8d6cf                         // white marble
    ];
    const tokyoPalette = [
      0x2a2a3a, 0x1a1a2e, 0x14142b, 0x3a1a3a,   // dark base
      0xff3b6b, 0xff6b9d, 0x4fc3f7, 0x9b5fff,   // neon accents (sparse)
      0x3a3a4a
    ];

    // Pre-create shared window texture (canvas)
    const windowTex = this._makeWindowTexture();

    for (let bx = 0; bx < this.size; bx++) {
      for (let bz = 0; bz < this.size; bz++) {
        const cx = -half + this.roadWidth / 2 + bx * this.cellSize + this.blockSize / 2;
        const cz = -half + this.roadWidth / 2 + bz * this.cellSize + this.blockSize / 2;

        // Skip the central cell area to leave an open plaza + spawn area
        if (Math.abs(cx) < 8 && Math.abs(cz) < 8) continue;

        // Decide zone: Dubai (+X half), Tokyo (-X half)
        const isDubai = cx > 0;
        const palette = isDubai ? dubaiPalette : tokyoPalette;

        // Place 1-4 buildings per block
        const subDiv = Math.random() < 0.5 ? 2 : 1;
        const sub = this.blockSize / subDiv;
        for (let sx = 0; sx < subDiv; sx++) {
          for (let sz = 0; sz < subDiv; sz++) {
            const px = cx - this.blockSize / 2 + sub / 2 + sx * sub + (Math.random() - 0.5) * 2;
            const pz = cz - this.blockSize / 2 + sub / 2 + sz * sub + (Math.random() - 0.5) * 2;
            const w = sub * (0.55 + Math.random() * 0.25);
            const d = sub * (0.55 + Math.random() * 0.25);
            const h = isDubai
              ? (12 + Math.random() * Math.random() * 90) // Dubai: tall skyscrapers, skewed
              : (8 + Math.random() * 30);                  // Tokyo: shorter dense
            this._makeBuilding(px, pz, w, h, d, palette, isDubai, windowTex);
          }
        }
      }
    }
  }

  _makeBuilding(x, z, w, h, d, palette, isDubai, windowTex) {
    const color = palette[Math.floor(Math.random() * palette.length)];
    // Decide if neon accent building (Tokyo only, ~12% chance)
    const isNeon = !isDubai && Math.random() < 0.14;
    const mat = new THREE.MeshStandardMaterial({
      color: isNeon ? 0x0a0a14 : color,
      roughness: isDubai ? 0.4 : 0.7,
      metalness: isDubai ? 0.5 : 0.2,
      emissive: isNeon ? color : 0x000000,
      emissiveIntensity: isNeon ? 0.9 : 0,
      map: (isDubai && Math.random() < 0.5) ? windowTex : null
    });

    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.buildings.push(mesh);

    // Roof detail for Dubai (small box on top)
    if (isDubai && Math.random() < 0.5) {
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.4, 4 + Math.random() * 6, d * 0.4),
        mat
      );
      cap.position.set(x, h + 2, z);
      cap.castShadow = true;
      this.root.add(cap);
    }

    // Tokyo neon sign (vertical box, emissive)
    if (isNeon) {
      const signMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a14, emissive: color, emissiveIntensity: 1.4, roughness: 0.5
      });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.3, h * 0.5, 1.5), signMat);
      sign.position.set(x + w / 2 + 0.2, h * 0.55, z);
      this.root.add(sign);
    }

    // Physics collider
    const body = this.physics.addBoxCollider({
      position: { x, y: h / 2, z },
      halfExtents: { x: w / 2, y: h / 2, z: d / 2 }
    });
    this.colliders.push(body);
  }

  _makeWindowTexture() {
    // Procedural canvas texture — grid of windows lit randomly (night)
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#1a2540';
    g.fillRect(0, 0, c.width, c.height);
    const cols = 4, rows = 10;
    const cw = c.width / cols, ch = c.height / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const lit = Math.random();
        if (lit < 0.5) g.fillStyle = '#0a1020';
        else if (lit < 0.85) g.fillStyle = '#ffd97a';
        else g.fillStyle = '#7ec0ff';
        g.fillRect(col * cw + 4, r * ch + 4, cw - 8, ch - 8);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 4);
    return tex;
  }

  _buildDecorations() {
    // Streetlights at intersections
    const total = this.size * this.cellSize;
    const half = total / 2;
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x222226, metalness: 0.7, roughness: 0.4 });
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffd97a, emissiveIntensity: 1.6 });
    const lampGeo = new THREE.CylinderGeometry(0.1, 0.12, 7, 8);
    const bulbGeo = new THREE.SphereGeometry(0.25, 12, 8);

    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        if (Math.random() < 0.35) continue;
        const x = -half + i * this.cellSize;
        const z = -half + j * this.cellSize;
        // Offset to corner
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(x + 4, 3.5, z + 4);
        lamp.castShadow = true;
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(x + 4, 7.2, z + 4);
        const light = new THREE.PointLight(0xffd97a, 0.6, 18, 2);
        light.position.set(x + 4, 7, z + 4);
        this.root.add(lamp, bulb, light);
      }
    }

    // Trees scattered on sidewalk corners
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e6b2e, roughness: 0.85 });
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 2.4, 6);
    const leafGeo = new THREE.SphereGeometry(1.2, 8, 6);
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() - 0.5) * total * 0.9;
      const z = (Math.random() - 0.5) * total * 0.9;
      // Avoid placing on plaza
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 1.2, z); trunk.castShadow = true;
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.set(x, 3, z); leaves.castShadow = true;
      leaves.scale.setScalar(0.8 + Math.random() * 0.6);
      this.root.add(trunk, leaves);
    }

    // Central plaza — circular pad
    const plazaGeo = new THREE.CircleGeometry(8, 32);
    plazaGeo.rotateX(-Math.PI / 2);
    const plazaMat = new THREE.MeshStandardMaterial({ color: 0x3a4055, roughness: 0.8 });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.set(0, 0.01, 0);
    plaza.receiveShadow = true;
    this.root.add(plaza);

    // Spawn point
    this.spawnPoints.push(new THREE.Vector3(0, 0.5, 12));
  }

  /**
   * Returns the nearest road segment center point (for traffic spawn).
   */
  randomRoadPoint() {
    const seg = this.roadSegments[Math.floor(Math.random() * this.roadSegments.length)];
    const t = Math.random();
    const p = new THREE.Vector3().lerpVectors(seg.a, seg.b, t);
    p.y = 0;
    return { point: p, dir: seg.dir };
  }

  /**
   * Compute camera collision list (building meshes only).
   */
  getCameraCollidables() { return this.buildings; }
}
