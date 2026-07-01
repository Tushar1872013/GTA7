/**
 * Vehicle — base class for all drivable vehicles (bikes + cars).
 * Provides the common arcade physics + visual sync logic.
 *
 * Subclasses must implement:
 *   - _buildMesh() → returns a Group containing all visual parts + sets
 *     this.parts = { wheelFront, wheelRear, leanPivot (optional), headLight, tailLightMat }
 *   - static variantSpecs → array of named variants with different stats
 *
 * Variant system: each Vehicle instance has a `variant` property that
 * selects tuning (top speed, accel, handling, etc).
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Vehicle {
  constructor({ scene, physics, variant = 0 }) {
    this.scene = scene;
    this.physics = physics;
    this.variant = variant;

    // Common dynamic state
    this.yaw = 0;
    this.speed = 0;
    this.steerInput = 0;
    this.throttle = 0;
    this.brake = false;
    this.boost = false;
    this._airTime = 0;
    this._isAirborne = false;
    this.fuel = 100;       // 0..100
    this.fuelRate = 0.6;   // fuel per second at full throttle
    this.outOfFuel = false;

    // Variant tuning — subclasses call this._applyVariant()
    this.variants = this.constructor.variantSpecs || [{}];
    this._applyVariant();

    this.group = new THREE.Group();
    this.group.name = this.constructor.name;
    this._buildMesh();
    this._buildBody();
    scene.add(this.group);
  }

  _applyVariant() {
    const v = this.variants[this.variant] || this.variants[0];
    this.maxSpeed = v.maxSpeed ?? 55;
    this.maxBoostSpeed = v.maxBoostSpeed ?? 80;
    this.accel = v.accel ?? 22;
    this.brakeDecel = v.brakeDecel ?? 35;
    this.steerRate = v.steerRate ?? 1.6;
    this.fuelRate = v.fuelRate ?? 0.6;
    this.variantName = v.name || 'Standard';
  }

  _buildBody() {
    // Default: sphere kinematic body. Subclass can override.
    const r = 0.55;
    this.body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Sphere(r),
      material: this.physics.materials.body,
      type: CANNON.Body.KINEMATIC
    });
    this.body.position.set(0, r, -4);
    this.physics.world.addBody(this.body);
    this._bodyRadius = r;
  }

  setColliders(colliders) { this._colliders = colliders; }
  setThrottle(v) { this.throttle = Math.max(0, Math.min(1, v)); }
  setSteer(v)    { this.steerInput = Math.max(-1, Math.min(1, v)); }
  setBrake(b)    { this.brake = b; }
  setBoost(b)    { this.boost = b; }
  refuel(amount) { this.fuel = Math.min(100, this.fuel + amount); this.outOfFuel = this.fuel <= 0; }

  cycleVariant() {
    this.variant = (this.variant + 1) % this.variants.length;
    this._applyVariant();
    return this.variantName;
  }

  update(dt, world) {
    // === Fuel check ===
    if (this.fuel <= 0) {
      this.outOfFuel = true;
      this.throttle = 0;
      this.boost = false;
    }
    if (this.throttle > 0 || this.boost) {
      const drain = this.fuelRate * this.throttle * dt * (this.boost ? 2.0 : 1.0);
      this.fuel = Math.max(0, this.fuel - drain);
    }

    // === Longitudinal dynamics ===
    const maxV = this.boost && !this.outOfFuel ? this.maxBoostSpeed : this.maxSpeed;
    if (this.throttle > 0 && !this.outOfFuel) {
      this.speed += this.accel * this.throttle * (this.boost ? 1.7 : 1) * dt;
    }
    if (this.brake) {
      this.speed -= this.brakeDecel * dt;
      if (this.speed < 0) this.speed = 0;
    }
    if (!this.throttle && !this.brake) {
      this.speed -= 4 * dt;
    }
    this.speed -= this.speed * this.speed * 0.0008 * dt * 60;
    this.speed = Math.max(0, Math.min(this.speed, maxV));

    // === Steering ===
    const speedFactor = THREE.MathUtils.clamp(this.speed / 8, 0, 1);
    const steerEffective = this.steerInput * this.steerRate * (1 - Math.min(0.55, this.speed / maxV * 0.6));
    this.yaw += steerEffective * dt * speedFactor * (this.speed > 0.5 ? 1 : 0.3);

    // === Movement (direct position, arcade) ===
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    const dx = sinY * this.speed * dt;
    const dz = cosY * this.speed * dt;

    const prevX = this.body.position.x;
    const prevZ = this.body.position.z;
    this.body.position.x += dx;
    this.body.position.z += dz;
    this.body.position.y = this._bodyRadius;
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), this.yaw);

    // === Building collision (revert) ===
    if (this._colliders) {
      const r = this._bodyRadius;
      for (const c of this._colliders) {
        const half = c.shapes[0].halfExtents;
        const cx = c.position.x, cy = c.position.y, cz = c.position.z;
        const closestX = Math.max(cx - half.x, Math.min(this.body.position.x, cx + half.x));
        const closestY = Math.max(cy - half.y, Math.min(this.body.position.y, cy + half.y));
        const closestZ = Math.max(cz - half.z, Math.min(this.body.position.z, cz + half.z));
        const ddx = this.body.position.x - closestX;
        const ddy = this.body.position.y - closestY;
        const ddz = this.body.position.z - closestZ;
        const distSq = ddx*ddx + ddy*ddy + ddz*ddz;
        if (distSq < r * r) {
          this.body.position.x = prevX;
          this.body.position.z = prevZ;
          this.speed *= 0.3;
          break;
        }
      }
    }

    // === Visual sync ===
    this.group.position.copy(this.body.position);
    this.group.position.y -= 0.15;
    this.group.rotation.y = this.yaw;

    // Wheel spin + steer
    if (this.parts.wheelFront) {
      const wheelOmega = this.speed * dt / 0.42;
      this.parts.wheelFront.rotation.x -= wheelOmega;
      this.parts.wheelRear.rotation.x -= wheelOmega;
      this.parts.wheelFront.rotation.y = this.steerInput * 0.35;
      if (this.parts.hubFront) this.parts.hubFront.rotation.y = this.steerInput * 0.35;
    }
    // Brake light
    if (this.parts.tailLightMat) {
      this.parts.tailLightMat.emissiveIntensity = this.brake ? 2.0 : 0.4;
    }

    // Subclass-specific update (lean, pitch, etc.)
    if (this._updateVisuals) this._updateVisuals(dt);

    // Air time tracking (for stunt system)
    if (this._isAirborne) this._airTime += dt;
  }

  resetTo(pos) {
    this.body.position.set(pos.x, this._bodyRadius, pos.z);
    this.body.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.speed = 0;
  }

  get worldPosition() { return this.body.position; }
  get speedKmh() { return this.speed * 3.6; }
}
