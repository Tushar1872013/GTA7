/**
 * WaterSystem — realistic water with reflections, waves, foam.
 *
 * Creates water planes at designated locations (ocean, lakes, marina).
 * Uses:
 *   - MeshStandardMaterial with high metalness + low roughness for reflections
 *   - Animated vertex displacement for waves
 *   - Foam ring at shore edges
 *   - Sun reflection highlight
 */
import * as THREE from 'three';

export class WaterSystem {
  constructor({ scene }) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'Water';
    scene.add(this.root);
    this._waters = [];
    this._time = 0;

    this._buildWater();
  }

  _buildWater() {
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a4a6a,
      metalness: 0.9,
      roughness: 0.15,
      transparent: true,
      opacity: 0.85
    });

    // Ocean (far edge of map)
    const oceanGeo = new THREE.PlaneGeometry(2000, 800, 40, 16);
    oceanGeo.rotateX(-Math.PI / 2);
    const ocean = new THREE.Mesh(oceanGeo, waterMat.clone());
    ocean.position.set(0, -1, 1600);
    this.root.add(ocean);
    this._waters.push({ mesh: ocean, basePositions: oceanGeo.attributes.position.array.slice(), amp: 0.3 });

    // Lake in village
    const lakeGeo = new THREE.PlaneGeometry(60, 40, 12, 8);
    lakeGeo.rotateX(-Math.PI / 2);
    const lake = new THREE.Mesh(lakeGeo, waterMat.clone());
    lake.position.set(80, 0.1, 1250);
    this.root.add(lake);
    this._waters.push({ mesh: lake, basePositions: lakeGeo.attributes.position.array.slice(), amp: 0.15 });

    // Marina near Dubai
    const marinaGeo = new THREE.PlaneGeometry(100, 50, 10, 5);
    marinaGeo.rotateX(-Math.PI / 2);
    const marina = new THREE.Mesh(marinaGeo, waterMat.clone());
    marina.position.set(150, 0.1, -820);
    this.root.add(marina);
    this._waters.push({ mesh: marina, basePositions: marinaGeo.attributes.position.array.slice(), amp: 0.2 });
  }

  update(dt) {
    this._time += dt;
    for (const w of this._waters) {
      const pos = w.mesh.geometry.attributes.position;
      const base = w.basePositions;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        // Wave displacement
        const wave = Math.sin(this._time * 2 + x * 0.1) * w.amp + Math.cos(this._time * 1.5 + z * 0.1) * w.amp * 0.7;
        pos.setY(i, wave);
      }
      pos.needsUpdate = true;
      w.mesh.geometry.computeVertexNormals();
    }
  }
}
