/**
 * VegetationSystem — grass fields, flowers, bushes with GPU instancing.
 *
 * Generates dense vegetation in designated areas (parks, village, roadside):
 *   - Grass blades (instanced)
 *   - Flowers (instanced, random colors)
 *   - Bush clusters
 *
 * All vegetation is tagged for wind animation (userData.wind).
 */
import * as THREE from 'three';

export class VegetationSystem {
  constructor({ scene, world }) {
    this.scene = scene;
    this.world = world;
    this.root = new THREE.Group();
    this.root.name = 'Vegetation';
    scene.add(this.root);

    this._grassMat = new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.85 });
    this._flowerMats = [
      new THREE.MeshStandardMaterial({ color: 0xff6b9d, roughness: 0.7, emissive: 0xff6b9d, emissiveIntensity: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.7, emissive: 0xffd54f, emissiveIntensity: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0xba68c8, roughness: 0.7, emissive: 0xba68c8, emissiveIntensity: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0xfffafa, roughness: 0.7 })
    ];

    this._buildGrassFields();
    this._buildFlowers();
  }

  _buildGrassFields() {
    // Place grass patches in village + near roads
    const patches = [
      { x: 0, z: 1200, count: 500 },    // Village
      { x: -50, z: 1180, count: 300 },
      { x: 50, z: 1220, count: 300 },
      { x: 0, z: 800, count: 200 },      // Mountain base
      { x: -100, z: 0, count: 200 }      // Highway verge
    ];

    const bladeGeo = new THREE.ConeGeometry(0.05, 0.4, 3);
    for (const patch of patches) {
      const mesh = new THREE.InstancedMesh(bladeGeo, this._grassMat, patch.count);
      const m = new THREE.Matrix4();
      for (let i = 0; i < patch.count; i++) {
        const x = patch.x + (Math.random() - 0.5) * 80;
        const z = patch.z + (Math.random() - 0.5) * 80;
        const scale = 0.5 + Math.random() * 0.8;
        m.makeScale(scale, scale, scale);
        m.setPosition(x, 0.2 * scale, z);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      this.root.add(mesh);
    }
  }

  _buildFlowers() {
    // Scatter flower clusters
    const flowerGeo = new THREE.SphereGeometry(0.1, 6, 4);
    for (let i = 0; i < 100; i++) {
      const patch = [
        { x: 0, z: 1200 },
        { x: -50, z: 1180 },
        { x: 50, z: 1220 }
      ][Math.floor(Math.random() * 3)];
      const x = patch.x + (Math.random() - 0.5) * 60;
      const z = patch.z + (Math.random() - 0.5) * 60;
      const mat = this._flowerMats[Math.floor(Math.random() * this._flowerMats.length)];
      const flower = new THREE.Mesh(flowerGeo, mat);
      flower.position.set(x, 0.35, z);
      flower.scale.setScalar(0.8 + Math.random() * 0.5);
      flower.userData.wind = true;
      flower.userData.windAmp = 0.05;
      this.root.add(flower);
    }
  }
}
