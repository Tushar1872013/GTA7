/**
 * DistrictDecorations — adds district-specific visual identity + world density.
 *
 * Tokyo District:
 *   - LED billboards (animated emissive panels)
 *   - Vending machines (illuminated boxes)
 *   - Japanese lanterns (hanging red spheres)
 *   - Animated neon signs (flickering)
 *   - Dense building clustering
 *
 * Dubai District:
 *   - Large fountains (water + particle spray)
 *   - Luxury plazas (paved open areas)
 *   - Golden accent lighting
 *   - Palm tree lined boulevards
 *   - Modern bridge structures
 *
 * General World Density (all districts):
 *   - Gas stations (canopy + pumps + sign)
 *   - Coffee shops (storefront + awning)
 *   - Parking lots (marked spaces + barriers)
 *   - Construction sites (barriers + scaffolding)
 *   - Billboards (tall ad structures)
 */
import * as THREE from 'three';

export class DistrictDecorations {
  constructor({ scene, world }) {
    this.scene = scene;
    this.world = world;
    this.root = new THREE.Group();
    this.root.name = 'DistrictDecorations';
    scene.add(this.root);

    this._animatedParts = []; // { mesh, type, phase, baseEmissive }
    this._time = 0;

    this._buildTokyoDecorations();
    this._buildDubaiDecorations();
    this._buildGeneralDensity();
  }

  // === TOKYO ===
  _buildTokyoDecorations() {
    const cz = 400; // Tokyo district center

    // LED billboards — large animated screens on buildings
    const billboardColors = [0xff3b6b, 0x4fc3f7, 0x9b5fff, 0x00ffaa, 0xffd54f];
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() - 0.5) * 300;
      const z = cz + (Math.random() - 0.5) * 300;
      const color = billboardColors[i % billboardColors.length];
      this._addLEDBillboard(x, z, color);
    }

    // Vending machines
    for (let i = 0; i < 15; i++) {
      const x = (Math.random() - 0.5) * 280;
      const z = cz + (Math.random() - 0.5) * 280;
      this._addVendingMachine(x, z);
    }

    // Hanging lanterns
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * 250;
      const z = cz + (Math.random() - 0.5) * 250;
      this._addLantern(x, z);
    }
  }

  _addLEDBillboard(x, z, color) {
    const g = new THREE.Group();
    // Support poles
    for (const px of [-2, 2]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.6, roughness: 0.4 })
      );
      pole.position.set(px, 4, 0); pole.castShadow = true;
      g.add(pole);
    }
    // Screen (animated emissive)
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a14, emissive: color, emissiveIntensity: 1.5,
      roughness: 0.3, metalness: 0.2
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), screenMat);
    screen.position.y = 7;
    g.add(screen);
    // Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.4, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.5, roughness: 0.5 }));
    frame.position.y = 7; frame.position.z = -0.05;
    g.add(frame);

    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    this.root.add(g);
    this._animatedParts.push({ mesh: screen, type: 'flicker', phase: Math.random() * 10, baseEmissive: 1.5, color });
  }

  _addVendingMachine(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x1a237e, roughness: 0.4, metalness: 0.3 })
    );
    body.position.y = 1; body.castShadow = true;
    // Glowing display
    const colors = [0x4fc3f7, 0xff6b9d, 0xffd54f];
    const c = colors[Math.floor(Math.random() * colors.length)];
    const display = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x0a0a14, emissive: c, emissiveIntensity: 1.2 })
    );
    display.position.set(0, 1.2, 0.41);
    g.add(body, display);
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    this.root.add(g);
    this._animatedParts.push({ mesh: display, type: 'flicker', phase: Math.random() * 10, baseEmissive: 1.2, color: c });
  }

  _addLantern(x, z) {
    const g = new THREE.Group();
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 1, 4),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    cord.position.y = 3.5;
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xff3333, emissive: 0xff3333, emissiveIntensity: 1.0, roughness: 0.6
    });
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), lanternMat);
    lantern.position.y = 3; lantern.scale.y = 1.3;
    g.add(cord, lantern);
    g.position.set(x, 0, z);
    this.root.add(g);
    this._animatedParts.push({ mesh: lantern, type: 'sway', phase: Math.random() * 10, baseEmissive: 1.0 });
  }

  // === DUBAI ===
  _buildDubaiDecorations() {
    const cz = -800;

    // Large fountain
    this._addFountain(0, cz + 40);

    // Luxury plaza (paved area)
    const plazaGeo = new THREE.PlaneGeometry(80, 80);
    plazaGeo.rotateX(-Math.PI / 2);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0xd8c8a0, roughness: 0.4, metalness: 0.2
    });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.set(0, 0.05, cz);
    plaza.receiveShadow = true;
    this.root.add(plaza);

    // Palm tree lined boulevard
    for (let i = -3; i <= 3; i++) {
      this._addPalmTree(-30, cz + i * 15);
      this._addPalmTree(30, cz + i * 15);
    }

    // Golden accent lights
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const r = 35;
      this._addGoldenLight(Math.cos(ang) * r, cz + Math.sin(ang) * r);
    }
  }

  _addFountain(x, z) {
    const g = new THREE.Group();
    // Base pool
    const pool = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 0.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x4a4a5a, roughness: 0.3, metalness: 0.5 })
    );
    pool.position.y = 0.25; pool.castShadow = true; pool.receiveShadow = true;
    // Water
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(5.5, 5.5, 0.4, 24),
      new THREE.MeshStandardMaterial({ color: 0x2a5a8a, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.8 })
    );
    water.position.y = 0.45;
    // Center pillar
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.8, 3, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.3, metalness: 0.4 })
    );
    pillar.position.y = 1.5; pillar.castShadow = true;
    // Water spray particles
    const sprayGeo = new THREE.BufferGeometry();
    const sprayCount = 50;
    const sprayPos = new Float32Array(sprayCount * 3);
    for (let i = 0; i < sprayCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 2;
      sprayPos[i * 3] = Math.cos(ang) * r;
      sprayPos[i * 3 + 1] = Math.random() * 4 + 1;
      sprayPos[i * 3 + 2] = Math.sin(ang) * r;
    }
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
    const spray = new THREE.Points(sprayGeo, new THREE.PointsMaterial({
      color: 0xaaccff, size: 0.2, transparent: true, opacity: 0.6, depthWrite: false
    }));
    g.add(pool, water, pillar, spray);
    g.position.set(x, 0, z);
    this.root.add(g);
    this._animatedParts.push({ mesh: spray, type: 'fountain', phase: 0 });
  }

  _addPalmTree(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 7, 8),
      new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 })
    );
    trunk.position.y = 3.5; trunk.castShadow = true;
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.7, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.85 })
      );
      const ang = (i / 7) * Math.PI * 2;
      leaf.position.set(Math.cos(ang) * 1.5, 7.5, Math.sin(ang) * 1.5);
      leaf.rotation.z = Math.cos(ang) * 0.6;
      leaf.rotation.x = Math.sin(ang) * 0.6;
      leaf.castShadow = true;
      leaf.userData.wind = true;
      leaf.userData.windAmp = 0.08;
      g.add(leaf);
    }
    g.add(trunk);
    g.position.set(x, 0, z);
    this.root.add(g);
  }

  _addGoldenLight(x, z) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.6, roughness: 0.4 })
    );
    pole.position.set(x, 2, z); pole.castShadow = true;
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffd54f, emissiveIntensity: 1.5 })
    );
    light.position.set(x, 4, z);
    this.root.add(pole, light);
    this._animatedParts.push({ mesh: light, type: 'steady', phase: 0, baseEmissive: 1.5 });
  }

  // === GENERAL DENSITY ===
  _buildGeneralDensity() {
    // Gas stations (2-3 across the map)
    this._addGasStation(-30, 40);
    this._addGasStation(40, cz_t = -820);

    // Coffee shops
    for (let i = 0; i < 4; i++) {
      const x = (Math.random() - 0.5) * 600;
      const z = (Math.random() - 0.5) * 600;
      this._addCoffeeShop(x, z);
    }

    // Parking lots
    for (let i = 0; i < 3; i++) {
      const x = (Math.random() - 0.5) * 500;
      const z = (Math.random() - 0.5) * 500;
      this._addParkingLot(x, z);
    }

    // Construction sites
    for (let i = 0; i < 2; i++) {
      const x = (Math.random() - 0.5) * 500;
      const z = (Math.random() - 0.5) * 500;
      this._addConstructionSite(x, z);
    }

    // Tall billboards
    for (let i = 0; i < 6; i++) {
      const x = (Math.random() - 0.5) * 800;
      const z = (Math.random() - 0.5) * 800;
      this._addTallBillboard(x, z);
    }
  }

  _addGasStation(x, z) {
    const g = new THREE.Group();
    // Canopy
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.4, metalness: 0.3 })
    );
    canopy.position.y = 5; canopy.castShadow = true;
    // Pillars
    for (const px of [-7, 7]) {
      for (const pz of [-3, 3]) {
        const p = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 5, 0.4),
          new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6 })
        );
        p.position.set(px, 2.5, pz);
        g.add(p);
      }
    }
    // Pumps
    for (const px of [-2, 2]) {
      const pump = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1.2, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x1976d2, roughness: 0.4, metalness: 0.5 })
      );
      pump.position.set(px, 0.6, 0); pump.castShadow = true;
      g.add(pump);
    }
    // Sign pole
    const signPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6, roughness: 0.4 })
    );
    signPole.position.set(8, 4, 0);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.5, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xff6f00, emissive: 0xff6f00, emissiveIntensity: 0.8 })
    );
    sign.position.set(8, 8, 0);
    g.add(canopy, signPole, sign);
    g.position.set(x, 0, z);
    this.root.add(g);
    this._animatedParts.push({ mesh: sign, type: 'steady', phase: 0, baseEmissive: 0.8 });
  }

  _addCoffeeShop(x, z) {
    const g = new THREE.Group();
    // Storefront
    const shop = new THREE.Mesh(
      new THREE.BoxGeometry(6, 4, 5),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.7 })
    );
    shop.position.y = 2; shop.castShadow = true;
    // Awning
    const awningColors = [0xe53935, 0x388e3c, 0x1976d2, 0xff6f00];
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 0.3, 2),
      new THREE.MeshStandardMaterial({ color: awningColors[Math.floor(Math.random() * awningColors.length)], roughness: 0.5 })
    );
    awning.position.set(0, 3, 2.5);
    // Window (glass)
    const window1 = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.5 })
    );
    window1.position.set(0, 1.5, 2.51);
    g.add(shop, awning, window1);
    g.position.set(x, 0, z);
    this.root.add(g);
  }

  _addParkingLot(x, z) {
    const g = new THREE.Group();
    // Paved surface
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 12),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.85 })
    );
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.05;
    surface.receiveShadow = true;
    // Parking space markings
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6 });
    for (let i = -8; i <= 8; i += 4) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 10), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(i, 0.06, 0);
      g.add(line);
    }
    // Barriers
    for (const px of [-10, 10]) {
      const barrier = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.6, 12),
        new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.5 })
      );
      barrier.position.set(px, 0.3, 0);
      g.add(barrier);
    }
    g.add(surface);
    g.position.set(x, 0, z);
    this.root.add(g);
  }

  _addConstructionSite(x, z) {
    const g = new THREE.Group();
    // Barriers
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.6 });
    for (let i = -5; i <= 5; i += 2) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1, 0.3), barrierMat);
      b.position.set(i, 0.5, 5);
      g.add(b);
    }
    // Scaffolding
    const scaffoldMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.5 });
    for (let h = 0; h < 3; h++) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 4), scaffoldMat);
      frame.position.set(0, 2 + h * 2, 0);
      g.add(frame);
      // Vertical poles
      for (const px of [-2, 2]) {
        for (const pz of [-2, 2]) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2, 6), scaffoldMat);
          pole.position.set(px, 1 + h * 2, pz);
          g.add(pole);
        }
      }
    }
    g.position.set(x, 0, z);
    this.root.add(g);
  }

  _addTallBillboard(x, z) {
    const g = new THREE.Group();
    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6, roughness: 0.4 })
    );
    pole.position.y = 6; pole.castShadow = true;
    // Board
    const adColors = [0xe53935, 0x1976d2, 0x7b1fa2, 0x00838f, 0xff6f00, 0x388e3c];
    const color = adColors[Math.floor(Math.random() * adColors.length)];
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(6, 3, 0.3),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.5 })
    );
    board.position.y = 11;
    g.add(pole, board);
    g.position.set(x, 0, z);
    this.root.add(g);
    this._animatedParts.push({ mesh: board, type: 'steady', phase: 0, baseEmissive: 0.3 });
  }

  update(dt, nightFactor) {
    this._time += dt;

    for (const part of this._animatedParts) {
      if (!part.mesh.parent) continue;

      if (part.type === 'flicker') {
        // Neon flicker — random brightness changes
        const flicker = 0.7 + Math.sin(this._time * 15 + part.phase) * 0.15 + Math.random() * 0.15;
        if (part.mesh.material) {
          part.mesh.material.emissiveIntensity = part.baseEmissive * flicker * (0.5 + nightFactor * 0.5);
        }
      } else if (part.type === 'sway') {
        // Lantern sway
        part.mesh.parent.rotation.z = Math.sin(this._time * 1.5 + part.phase) * 0.1;
        if (part.mesh.material) {
          part.mesh.material.emissiveIntensity = part.baseEmissive * (0.5 + nightFactor * 0.5);
        }
      } else if (part.type === 'fountain') {
        // Animate fountain spray particles
        const pos = part.mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          pos.setY(i, y - dt * 3);
          if (y < 0.5) {
            const ang = Math.random() * Math.PI * 2;
            const r = Math.random() * 2;
            pos.setX(i, Math.cos(ang) * r);
            pos.setZ(i, Math.sin(ang) * r);
            pos.setY(i, 4 + Math.random() * 2);
          }
        }
        pos.needsUpdate = true;
      } else if (part.type === 'steady') {
        // Steady glow — brighten at night
        if (part.mesh.material) {
          part.mesh.material.emissiveIntensity = part.baseEmissive * (0.4 + nightFactor * 0.6);
        }
      }
    }
  }
}

let cz_t = 0; // temp variable for gas station z
