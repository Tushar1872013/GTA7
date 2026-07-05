/**
 * Camera rig — three modes:
 *   - 'follow'  : third-person chase (default for bike & on foot)
 *   - 'far'     : further back chase cam
 *   - 'orbit'   : free orbit (debug)
 *
 * Smoothly follows a target object with latency, collision-aware position.
 */
import * as THREE from 'three';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'follow';
    this.target = null;

    // Tuning
    this.offset = new THREE.Vector3(0, 4.2, -8.5);
    this.farOffset = new THREE.Vector3(0, 7.5, -14);
    this.lookOffset = new THREE.Vector3(0, 1.5, 4);

    // Internal smoothed values
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._vel = new THREE.Vector3();
    this._initialized = false;

    // Orbit (debug)
    this._orbitTheta = 0;
    this._orbitPhi = Math.PI / 3;
    this._orbitRadius = 12;

    // Raycaster for camera collision
    this._ray = new THREE.Raycaster();
    this._collidables = null;
  }

  setCollidables(arr) { this._collidables = arr; }

  setTarget(obj) { this.target = obj; }

  cycleMode() {
    const order = ['follow', 'far', 'orbit'];
    const i = order.indexOf(this.mode);
    this.mode = order[(i + 1) % order.length];
    this._initialized = false;
    return this.mode;
  }

  orbitDrag(dx, dy) {
    this._orbitTheta -= dx * 0.005;
    this._orbitPhi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, this._orbitPhi - dy * 0.005));
  }

  update(dt) {
    if (!this.target) return;

    const tPos = this.target.position;
    const tQuat = this.target.quaternion;

    if (this.mode === 'orbit') {
      const r = this._orbitRadius;
      const x = tPos.x + r * Math.sin(this._orbitPhi) * Math.cos(this._orbitTheta);
      const y = tPos.y + r * Math.cos(this._orbitPhi);
      const z = tPos.z + r * Math.sin(this._orbitPhi) * Math.sin(this._orbitTheta);
      this.camera.position.lerp(new THREE.Vector3(x, y, z), 1 - Math.pow(0.001, dt));
      this.camera.lookAt(tPos.x, tPos.y + 1, tPos.z);
      return;
    }

    const off = this.mode === 'far' ? this.farOffset : this.offset;
    // rotate offset by target yaw
    const yaw = new THREE.Euler().setFromQuaternion(tQuat, 'YXZ').y;
    const desired = new THREE.Vector3()
      .copy(off)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
      .add(tPos);

    // Camera collision: shorten offset if blocked
    if (this._collidables && this._collidables.length) {
      const dir = new THREE.Vector3().subVectors(desired, tPos);
      const len = dir.length();
      dir.normalize();
      this._ray.set(tPos.clone().add(new THREE.Vector3(0, 1.5, 0)), dir);
      this._ray.far = len;
      const hits = this._ray.intersectObjects(this._collidables, true);
      if (hits.length) {
        const hit = hits[0];
        desired.lerpVectors(tPos.clone().add(new THREE.Vector3(0, 1.5, 0)), desired, hit.distance / len * 0.9);
      }
    }

    if (!this._initialized) {
      this._pos.copy(desired);
      this._look.copy(tPos);
      this._initialized = true;
    } else {
      // Smooth follow (frame-rate independent)
      const k = 1 - Math.pow(0.0005, dt);
      this._pos.lerp(desired, k);
      const lookTarget = tPos.clone().add(this.lookOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
      this._look.lerp(lookTarget, 1 - Math.pow(0.001, dt));
    }

    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }
}
