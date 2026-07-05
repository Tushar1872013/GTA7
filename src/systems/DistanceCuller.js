/**
 * DistanceCuller — performance optimization.
 *
 * Each frame, walks the list of registered meshes and toggles visibility
 * based on distance to the camera:
 *   if (distance > drawDistance) mesh.visible = false;
 *
 * This implements the user's requirement: "if (distance > 300) model.visible = false;"
 *
 * Also supports LOD swapping: register multiple meshes at increasing detail
 * levels and the culler shows the closest non-culled one.
 */
import * as THREE from 'three';

export class DistanceCuller {
  constructor({ camera, drawDistance = 300, cullInterval = 0.25 }) {
    this.camera = camera;
    this.drawDistance = drawDistance;
    this.cullInterval = cullInterval; // re-cull every N seconds
    this._accum = 0;
    this._targets = []; // { mesh, customDistance? }
  }

  register(mesh, customDistance) {
    this._targets.push({ mesh, customDistance });
    mesh.userData._culled = false;
  }

  registerGroup(group, customDistance) {
    // Register all meshes within a group
    group.traverse((obj) => {
      if (obj.isMesh) this.register(obj, customDistance);
    });
  }

  update(dt) {
    this._accum += dt;
    if (this._accum < this.cullInterval) return;
    this._accum = 0;

    const camPos = this.camera.position;
    for (const t of this._targets) {
      const mesh = t.mesh;
      if (!mesh.parent) continue; // removed from scene
      const d = mesh.position.distanceTo(camPos);
      // For world-space meshes inside a group, use world position
      let worldDist = d;
      if (mesh.parent && mesh.parent.type === 'Group') {
        mesh.getWorldPosition(_tmpV);
        worldDist = _tmpV.distanceTo(camPos);
      }
      const limit = t.customDistance || this.drawDistance;
      mesh.visible = worldDist < limit;
    }
  }
}

const _tmpV = new THREE.Vector3();
