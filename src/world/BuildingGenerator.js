/**
 * BuildingGenerator — modular PBR buildings with random variation.
 *
 * Generates buildings with:
 *   - Glass windows (emissive at night, reflective day)
 *   - Window frames
 *   - Balconies (on residential)
 *   - AC units on sides
 *   - Roof equipment (water tanks, vents, satellite dishes)
 *   - Neon signs (Tokyo district)
 *   - Shop fronts (ground floor)
 *   - Random colors, heights, designs
 *
 * District styles:
 *   - Dubai: glass skyscrapers, luxury, gold accents
 *   - Tokyo: dense, neon, dark base
 *   - Downtown: corporate, varied
 *   - Village: small houses, warm colors
 */
import * as THREE from 'three';
import { getGlassTexture, getConcreteTexture } from './PBRTextures.js';

export class BuildingGenerator {
  constructor() {
    this._glassTex = getGlassTexture();
    this._concreteTex = getConcreteTexture();
    this._buildingParts = []; // track for night light updates
  }

  /**
   * Generate a building at position with district style.
   * Returns { group, colliders: [{pos, half}] }
   */
  generate(x, z, district = 'downtown', options = {}) {
    const w = options.width || (10 + Math.random() * 16);
    const d = options.depth || (10 + Math.random() * 16);
    const h = options.height || this._getHeight(district);
    const group = new THREE.Group();

    // Main body
    this._addMainBody(group, w, h, d, district);
    // Windows
    this._addWindows(group, w, h, d, district);
    // Roof details
    this._addRoof(group, w, h, d, district);
    // Ground floor shop
    if (h > 10 && Math.random() < 0.6) this._addShopFront(group, w, h, d, district);
    // AC units
    if (h > 15) this._addACUnits(group, w, h, d);
    // Balconies (residential)
    if (district === 'village' || (district === 'tokyo' && Math.random() < 0.4)) {
      this._addBalconies(group, w, h, d);
    }
    // Neon signs (Tokyo)
    if (district === 'tokyo' && Math.random() < 0.5) {
      this._addNeonSign(group, w, h, d);
    }

    group.position.set(x, 0, z);
    if (options.rotation) group.rotation.y = options.rotation;

    return {
      group,
      colliders: [{ pos: { x, y: h / 2, z }, half: { x: w / 2, y: h / 2, z: d / 2 } }]
    };
  }

  _getHeight(district) {
    switch (district) {
      case 'dubai':  return 40 + Math.random() * Math.random() * 120;
      case 'tokyo':  return 15 + Math.random() * 45;
      case 'downtown': return 12 + Math.random() * 50;
      case 'village': return 5 + Math.random() * 6;
      default: return 15 + Math.random() * 30;
    }
  }

  _addMainBody(group, w, h, d, district) {
    const colors = {
      dubai: [0xa8c5d8, 0xc8d8e8, 0xd8d0c0, 0xb8c8d0],
      tokyo: [0x2a2a35, 0x1a1a25, 0x352535, 0x252530],
      downtown: [0x8a8a90, 0x707075, 0x9095a0, 0xa0a0a5],
      village: [0xd8c8a8, 0xc8b898, 0xe8d8b8, 0xb8a888]
    };
    const palette = colors[district] || colors.downtown;
    const color = palette[Math.floor(Math.random() * palette.length)];

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: district === 'dubai' ? 0.25 : 0.75,
      metalness: district === 'dubai' ? 0.6 : 0.15,
      map: district === 'tokyo' || district === 'downtown' ? this._concreteTex.clone() : null
    });
    if (mat.map) {
      mat.map.repeat.set(w / 8, h / 8);
      mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
    }

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
  }

  _addWindows(group, w, h, d, district) {
    if (h < 8) return;
    const isGlassTower = district === 'dubai';
    const winRows = Math.floor(h / 4);
    const winColsW = Math.max(2, Math.floor(w / 3));
    const winColsD = Math.max(2, Math.floor(d / 3));

    // Window material — emissive for night, reflective for day
    const litColors = [0xffd97a, 0x7ec0ff, 0xff9d5c, 0xffeb3b];
    const winMat = new THREE.MeshStandardMaterial({
      color: isGlassTower ? 0x4a6080 : 0x1a1a25,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0xffd97a,
      emissiveIntensity: 0
    });

    const winGeo = new THREE.PlaneGeometry(1.5, 2);
    for (let row = 0; row < winRows; row++) {
      for (let col = 0; col < winColsW; col++) {
        if (Math.random() < 0.25) continue; // some windows off
        // Front face
        const win = new THREE.Mesh(winGeo, winMat.clone());
        win.position.set(
          -w/2 + (col + 0.5) * (w / winColsW),
          3 + row * 4,
          d/2 + 0.01
        );
        win.material.emissiveIntensity = Math.random() < 0.5 ? 0 : (0.4 + Math.random() * 0.6);
        win.material.emissive.setHex(litColors[Math.floor(Math.random() * litColors.length)]);
        group.add(win);
        this._buildingParts.push(win);

        // Back face
        const winB = win.clone();
        winB.material = win.material.clone();
        winB.position.z = -d/2 - 0.01;
        winB.rotation.y = Math.PI;
        group.add(winB);
        this._buildingParts.push(winB);
      }
      // Side faces
      for (let col = 0; col < winColsD; col++) {
        if (Math.random() < 0.25) continue;
        const winL = new THREE.Mesh(winGeo, winMat.clone());
        winL.position.set(-w/2 - 0.01, 3 + row * 4, -d/2 + (col + 0.5) * (d / winColsD));
        winL.rotation.y = -Math.PI / 2;
        winL.material.emissiveIntensity = Math.random() < 0.5 ? 0 : (0.4 + Math.random() * 0.6);
        group.add(winL);
        this._buildingParts.push(winL);

        const winR = winL.clone();
        winR.material = winL.material.clone();
        winR.position.x = w/2 + 0.01;
        winR.rotation.y = Math.PI / 2;
        group.add(winR);
        this._buildingParts.push(winR);
      }
    }
  }

  _addRoof(group, w, h, d, district) {
    if (h < 12) return;
    const detailMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.4 });

    // Water tank
    if (Math.random() < 0.5) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.5, 8), detailMat);
      tank.position.set((Math.random() - 0.5) * w * 0.5, h + 1.25, (Math.random() - 0.5) * d * 0.5);
      tank.castShadow = true;
      group.add(tank);
    }
    // AC unit
    if (Math.random() < 0.7) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.5), detailMat);
      ac.position.set((Math.random() - 0.5) * w * 0.6, h + 0.5, (Math.random() - 0.5) * d * 0.6);
      ac.castShadow = true;
      group.add(ac);
    }
    // Vent pipes
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5, 6), detailMat);
      pipe.position.set((Math.random() - 0.5) * w * 0.7, h + 0.75, (Math.random() - 0.5) * d * 0.7);
      group.add(pipe);
    }
    // Satellite dish
    if (Math.random() < 0.3) {
      const dish = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), detailMat);
      dish.position.set((Math.random() - 0.5) * w * 0.5, h + 1, (Math.random() - 0.5) * d * 0.5);
      dish.rotation.x = Math.PI / 3;
      group.add(dish);
    }
  }

  _addShopFront(group, w, h, d, district) {
    const shopColors = [0xe53935, 0x1976d2, 0x388e3c, 0xfbc02d, 0x7b1fa2, 0x00838f];
    const color = shopColors[Math.floor(Math.random() * shopColors.length)];
    const shopMat = new THREE.MeshStandardMaterial({
      color, roughness: 0.4, metalness: 0.3,
      emissive: color, emissiveIntensity: 0.15
    });
    const shop = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 3, 0.2), shopMat);
    shop.position.set(0, 1.5, d/2 + 0.05);
    group.add(shop);

    // Sign above shop
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, emissive: color, emissiveIntensity: 0.8
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1, 0.1), signMat);
    sign.position.set(0, 3.5, d/2 + 0.06);
    group.add(sign);
    this._buildingParts.push(sign);
  }

  _addACUnits(group, w, h, d) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.6, metalness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const ac = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), mat);
      ac.position.set(side * (w/2 + 0.4), 4 + i * 5 + Math.random() * 2, (Math.random() - 0.5) * d * 0.6);
      ac.castShadow = true;
      group.add(ac);
    }
  }

  _addBalconies(group, w, h, d) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8, metalness: 0.3 });
    for (let row = 1; row < Math.floor(h / 4); row++) {
      for (let side of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        if (Math.random() < 0.4) continue;
        const bal = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.8), mat);
        const offsetX = Math.sin(side) * (w / 2 + 0.4);
        const offsetZ = Math.cos(side) * (d / 2 + 0.4);
        bal.position.set(offsetX, row * 4, offsetZ);
        bal.rotation.y = side;
        bal.castShadow = true;
        group.add(bal);
      }
    }
  }

  _addNeonSign(group, w, h, d) {
    const neonColors = [0xff3b6b, 0x4fc3f7, 0x9b5fff, 0x00ffaa, 0xffd54f];
    const color = neonColors[Math.floor(Math.random() * neonColors.length)];
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a14, emissive: color, emissiveIntensity: 2.0, roughness: 0.5
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.4, h * 0.4, 2), signMat);
    sign.position.set(w/2 + 0.2, h * 0.55, 0);
    group.add(sign);
    this._buildingParts.push(sign);
  }

  /**
   * Update night light intensity (called by Game each frame).
   */
  updateNightLights(nightFactor) {
    for (const part of this._buildingParts) {
      if (part.material && part.material.emissive) {
        // Only adjust emissive parts (windows, signs)
        if (part.material.emissiveIntensity !== undefined && part.material.emissiveIntensity > 0) {
          // Store base intensity on first access
          if (part.userData._baseEmissive === undefined) {
            part.userData._baseEmissive = part.material.emissiveIntensity;
          }
          part.material.emissiveIntensity = part.userData._baseEmissive * nightFactor;
        }
      }
    }
  }
}
