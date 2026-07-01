/**
 * StuntSystem — tracks jumps, air time, flips, and awards score.
 *
 * Detects when the player vehicle drives over a stunt ramp and goes airborne
 * (visual Y rises above ground). On landing, computes score from air time +
 * distance traveled and triggers a UI flash.
 *
 * Also handles ramps as boost pads (small speed bump on hit).
 */
import * as THREE from 'three';

export class StuntSystem {
  constructor({ world, hud }) {
    this.world = world;
    this.hud = hud;
    this.totalScore = 0;
    this.lastScore = 0;
    this._airborne = false;
    this._airTime = 0;
    this._airStartPos = new THREE.Vector3();
    this._airStartSpeed = 0;
  }

  update(dt, vehicle) {
    // Check ramp proximity (apply slight upward pop if very close + moving)
    for (const ramp of this.world.stuntRamps) {
      const d = ramp.position.distanceTo(vehicle.body.position);
      if (d < 4 && vehicle.speed > 10) {
        // Pop!
        vehicle.body.position.y += 0.4 * ramp.scale;
        vehicle.speed *= 1.05;
      }
    }

    // Track airborne state: simulate jump arc
    // (Our arcade bike doesn't actually go airborne via physics, so we
    // simulate a parabolic arc when the vehicle Y is elevated)
    const elevated = vehicle.body.position.y > vehicle._bodyRadius + 0.3;

    if (elevated && !this._airborne) {
      this._airborne = true;
      this._airTime = 0;
      this._airStartPos.copy(vehicle.body.position);
      this._airStartSpeed = vehicle.speed;
    } else if (this._airborne) {
      this._airTime += dt;
      // Apply gravity to Y while airborne
      vehicle.body.position.y -= 9.8 * dt * dt * 1.5;
      if (vehicle.body.position.y <= vehicle._bodyRadius) {
        // Landed
        vehicle.body.position.y = vehicle._bodyRadius;
        this._land(vehicle);
      }
    }
  }

  _land(vehicle) {
    if (this._airTime < 0.3) {
      // Too short, no score
      this._airborne = false;
      this._airTime = 0;
      return;
    }
    const dist = this._airStartPos.distanceTo(vehicle.body.position);
    const score = Math.round(this._airTime * 50 + dist * 5);
    this.lastScore = score;
    this.totalScore += score;
    if (this.hud) {
      this.hud.flash(`STUNT! +${score}  (Air: ${this._airTime.toFixed(1)}s, Dist: ${dist.toFixed(1)}m)`, 2500);
    }
    this._airborne = false;
    this._airTime = 0;
  }

  get airborne() { return this._airborne; }
}
