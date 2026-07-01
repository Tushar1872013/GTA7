/**
 * StrandHair — strand-based hair using instanced thin cylinders.
 *
 * Generates hundreds of individual hair strands as thin tapered cylinders,
 * arranged on the scalp. Each strand has a slight curve for natural look.
 *
 * Performance: Uses InstancedMesh for all strands — one draw call.
 * Wind animation: strands sway gently (tagged with userData.wind).
 */
import * as THREE from 'three';

export class StrandHair {
  constructor({ color = 0x2a1810, strandCount = 300 } = {}) {
    this.color = color;
    this.strandCount = strandCount;
    this.group = new THREE.Group();
    this._build();
  }

  _build() {
    // Single strand geometry — thin tapered cylinder
    const geo = new THREE.CylinderGeometry(0.003, 0.006, 0.12, 4, 1);
    // Taper the top
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) {
        pos.setX(i, pos.getX(i) * 0.3);
        pos.setZ(i, pos.getZ(i) * 0.3);
      }
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.65,
      metalness: 0.05
    });

    // Create instanced mesh for all strands
    this.mesh = new THREE.InstancedMesh(geo, mat, this.strandCount);
    this._matrices = [];
    this._rotations = [];

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();

    for (let i = 0; i < this.strandCount; i++) {
      // Distribute strands on scalp (upper hemisphere)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5; // upper half
      const r = 0.12;

      p.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) + 0.05, // offset up
        r * Math.sin(phi) * Math.sin(theta)
      );

      // Strand rotation — point outward + slightly down
      const outward = new THREE.Vector3(p.x, 0, p.z).normalize();
      const tilt = 0.3 + Math.random() * 0.3; // tilt down
      q.setFromEuler(new THREE.Euler(
        outward.x * tilt + (Math.random() - 0.5) * 0.2,
        Math.atan2(outward.x, outward.z),
        outward.z * tilt + (Math.random() - 0.5) * 0.2
      ));

      // Scale — random length
      const scale = 0.7 + Math.random() * 0.6;
      s.set(scale, scale, scale);

      m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
      this._matrices.push(m.clone());
      this._rotations.push({
        baseQuat: q.clone(),
        phase: Math.random() * Math.PI * 2,
        amp: 0.02 + Math.random() * 0.03
      });
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.castShadow = true;
    this.mesh.userData.wind = true;
    this.mesh.userData.windAmp = 0.05;
    this.group.add(this.mesh);
  }

  setColor(color) {
    this.mesh.material.color.setHex(color);
  }

  /**
   * Animate strands — subtle wind sway.
   */
  update(dt, time) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const swayQ = new THREE.Quaternion();

    for (let i = 0; i < this.strandCount; i++) {
      const r = this._rotations[i];
      const sway = Math.sin(time * 2 + r.phase) * r.amp;

      // Apply sway as small rotation
      swayQ.setFromEuler(new THREE.Euler(sway, 0, sway * 0.5));
      q.copy(r.baseQuat).multiply(swayQ);

      // Get base position from matrix
      this._matrices[i].decompose(p, new THREE.Quaternion(), s);

      m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
