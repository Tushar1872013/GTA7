/**
 * MissionSystem — simple delivery missions.
 *
 * Mission flow:
 *   1. Player picks up cargo at point A (within radius)
 *   2. Player drives to point B (within radius)
 *   3. Reward money + score; new mission generated
 *
 * HUD shows current objective + distance to target.
 */
import * as THREE from 'three';

export class MissionSystem {
  constructor({ world, hud }) {
    this.world = world;
    this.hud = hud;
    this.money = 0;
    this.completedCount = 0;
    this.current = null;        // { pickup: Vector3, dropoff: Vector3, reward, hasCargo }
    this._markerMeshes = [];    // visual markers

    this._buildMarkerGeometry();
    this._startNewMission();
  }

  _buildMarkerGeometry() {
    // Reusable materials
    this._pickupMat = new THREE.MeshStandardMaterial({
      color: 0xffd54f, emissive: 0xffd54f, emissiveIntensity: 1.0,
      transparent: true, opacity: 0.7
    });
    this._dropoffMat = new THREE.MeshStandardMaterial({
      color: 0x4fc3f7, emissive: 0x4fc3f7, emissiveIntensity: 1.0,
      transparent: true, opacity: 0.7
    });
  }

  _startNewMission() {
    // Clear old markers
    for (const m of this._markerMeshes) this.world.root.remove(m);
    this._markerMeshes = [];

    const p1 = this.world.randomRoadPoint().point;
    let p2;
    do {
      p2 = this.world.randomRoadPoint().point;
    } while (p1.distanceTo(p2) < 80);

    this.current = {
      pickup: p1,
      dropoff: p2,
      reward: 200 + Math.floor(Math.random() * 300),
      hasCargo: false
    };

    // Spawn visual markers (tall cylinders)
    const pickupMarker = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 30, 16, 1, true),
      this._pickupMat
    );
    pickupMarker.position.set(p1.x, 15, p1.z);
    this.world.root.add(pickupMarker);
    this._markerMeshes.push(pickupMarker);

    const dropoffMarker = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 30, 16, 1, true),
      this._dropoffMat
    );
    dropoffMarker.position.set(p2.x, 15, p2.z);
    this.world.root.add(dropoffMarker);
    this._markerMeshes.push(dropoffMarker);

    if (this.hud) this.hud.flash('NEW MISSION: Drive to the yellow marker to pick up cargo', 3000);
  }

  update(dt, vehiclePos) {
    if (!this.current) return;

    // Animate markers (pulse)
    for (const m of this._markerMeshes) {
      m.rotation.y += dt * 1.5;
      m.scale.x = m.scale.z = 1 + Math.sin(performance.now() / 400) * 0.1;
    }

    const distPickup = this.current.pickup.distanceTo(vehiclePos);
    const distDropoff = this.current.dropoff.distanceTo(vehiclePos);

    if (!this.current.hasCargo) {
      if (distPickup < 6) {
        this.current.hasCargo = true;
        // Remove pickup marker
        if (this._markerMeshes[0]) {
          this.world.root.remove(this._markerMeshes[0]);
          this._markerMeshes[0] = null;
        }
        if (this.hud) this.hud.flash('Cargo picked up! Drive to the blue marker to deliver', 3000);
      }
    } else {
      if (distDropoff < 6) {
        // Mission complete!
        this.money += this.current.reward;
        this.completedCount++;
        if (this.hud) this.hud.flash(`MISSION COMPLETE! +$${this.current.reward}`, 3500);
        this._startNewMission();
      }
    }
  }

  getObjectiveText() {
    if (!this.current) return 'No active mission';
    if (!this.current.hasCargo) {
      const d = Math.round(this.current.pickup.distanceTo(this._lastVehiclePos || new THREE.Vector3()));
      return `Pick up cargo — ${d}m`;
    } else {
      const d = Math.round(this.current.dropoff.distanceTo(this._lastVehiclePos || new THREE.Vector3()));
      return `Deliver cargo — ${d}m · Reward $${this.current.reward}`;
    }
  }
}
