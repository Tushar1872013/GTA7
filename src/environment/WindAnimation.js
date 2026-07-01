/**
 * WindAnimation — animates vegetation (trees, bushes, grass) with wind.
 *
 * Traverses the scene for vegetation meshes and applies a gentle sway
 * using sine waves. Wind strength/direction changes over time for variety.
 *
 * Performance: Only processes meshes tagged with userData.wind = true.
 * Uses vertex displacement on simple geometries (not skeletal animation).
 */
import * as THREE from 'three';

export class WindAnimation {
  constructor({ scene }) {
    this.scene = scene;
    this.windStrength = 0.5;
    this.windDirection = 0;
    this._windTargets = []; // { mesh, baseY, phase, amp }
    this._time = 0;
    this._scanAccum = 0;

    // Scan scene for vegetation periodically (objects may be added later)
    this._scan();
  }

  _scan() {
    this._windTargets = [];
    this.scene.traverse((obj) => {
      if (obj.isMesh && obj.userData.wind) {
        this._windTargets.push({
          mesh: obj,
          baseRotation: obj.rotation.clone(),
          basePosition: obj.position.clone(),
          phase: Math.random() * Math.PI * 2,
          amp: obj.userData.windAmp || 0.05
        });
      }
    });
  }

  update(dt) {
    this._time += dt;
    // Wind direction slowly shifts
    this.windDirection += dt * 0.1;

    // Re-scan every 5 seconds to catch newly added vegetation
    this._scanAccum += dt;
    if (this._scanAccum > 5) {
      this._scanAccum = 0;
      this._scan();
    }

    const windSin = Math.sin(this._time * 1.5);
    const windCos = Math.cos(this._time * 0.8);

    for (const t of this._windTargets) {
      const m = t.mesh;
      if (!m.parent) continue;
      // Sway rotation based on wind + per-object phase
      const sway = Math.sin(this._time * 2 + t.phase) * t.amp * this.windStrength;
      const sway2 = Math.cos(this._time * 1.3 + t.phase * 1.7) * t.amp * 0.7 * this.windStrength;
      m.rotation.z = t.baseRotation.z + sway;
      m.rotation.x = t.baseRotation.x + sway2;
    }
  }

  setWindStrength(s) { this.windStrength = s; }
}
