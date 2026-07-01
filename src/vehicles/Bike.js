/**
 * Bike — motorcycle, extends Vehicle with bike-specific visuals + lean physics.
 * 3 variants: Sport (fast, twitchy), Cruiser (slower, stable), Dirt (off-road, jump-friendly)
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Vehicle } from './Vehicle.js';

export class Bike extends Vehicle {
  static variantSpecs = [
    { name: 'Sport',   maxSpeed: 65, maxBoostSpeed: 95, accel: 28, brakeDecel: 40, steerRate: 1.9, fuelRate: 0.7 },
    { name: 'Cruiser', maxSpeed: 45, maxBoostSpeed: 65, accel: 16, brakeDecel: 28, steerRate: 1.2, fuelRate: 0.4 },
    { name: 'Dirt',    maxSpeed: 50, maxBoostSpeed: 75, accel: 22, brakeDecel: 32, steerRate: 1.6, fuelRate: 0.5 }
  ];

  constructor(opts) { super(opts); }

  _buildMesh() {
    const v = this.variants[this.variant];
    const frameColor = v.name === 'Sport' ? 0xe53935 : v.name === 'Cruiser' ? 0x1a1a2e : 0x2e7d32;
    // PBR materials — realistic paint with clearcoat feel
    const matFrame = new THREE.MeshStandardMaterial({ color: frameColor, metalness: 0.8, roughness: 0.25 });
    const matDark  = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.7, roughness: 0.4 });
    const matChrome= new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.98, roughness: 0.08 });
    const matGlass = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, metalness: 0.9, roughness: 0.05, emissive: 0x1a3a5a, emissiveIntensity: 0.5 });
    const matRubber= new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 });
    const matRider = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.8 });
    const matRider2= new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.7 });
    const matHelmet= new THREE.MeshStandardMaterial({ color: 0xffd54f, metalness: 0.6, roughness: 0.2 });
    const matBrakeDisc = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.95, roughness: 0.15 });
    const matIndicatorOff = new THREE.MeshStandardMaterial({ color: 0x442200, roughness: 0.5 });
    const matDashboardGlass = new THREE.MeshStandardMaterial({ color: 0x001133, emissive: 0x00aaff, emissiveIntensity: 0.6, roughness: 0.1 });

    // Tank
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 1.1), matFrame);
    tank.position.set(0, 0.95, 0); tank.castShadow = true;
    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.7), matDark);
    seat.position.set(0, 0.95, -0.55); seat.castShadow = true;
    // Tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.5), matFrame);
    tail.position.set(0, 1.0, -1.0); tail.castShadow = true;
    // Tail light
    const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.04), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.2 }));
    tailLight.position.set(0, 1.02, -1.25);
    // Headlight
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), matGlass);
    head.position.set(0, 1.05, 1.0);
    const headLight = new THREE.PointLight(0xfff4d6, 1.2, 30, 2);
    headLight.position.set(0, 1.05, 1.2);
    // Fork
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8), matChrome);
    fork.position.set(0, 0.65, 0.95); fork.rotation.x = 0.18;
    // Handlebar
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), matChrome);
    bar.position.set(0, 1.15, 0.85); bar.rotation.z = Math.PI / 2;
    // Mirrors
    const mirrorGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8);
    const mirrorL = new THREE.Mesh(mirrorGeo, matChrome); mirrorL.position.set(-0.28, 1.25, 0.85);
    const mirrorR = new THREE.Mesh(mirrorGeo, matChrome); mirrorR.position.set(0.28, 1.25, 0.85);
    // Dashboard (digital speedometer)
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.05), matDashboardGlass);
    dash.position.set(0, 1.18, 0.7);
    // Exhaust
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 8), matChrome);
    exhaust.position.set(0.18, 0.55, -0.8); exhaust.rotation.x = -Math.PI / 2.2;

    // Wheels with brake discs
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.18, 24);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelFront = new THREE.Mesh(wheelGeo, matRubber);
    wheelFront.position.set(0, 0.42, 1.05); wheelFront.castShadow = true;
    const wheelRear = new THREE.Mesh(wheelGeo, matRubber);
    wheelRear.position.set(0, 0.42, -1.0); wheelRear.castShadow = true;
    // Brake discs
    const discGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16);
    discGeo.rotateZ(Math.PI / 2);
    const discFront = new THREE.Mesh(discGeo, matBrakeDisc); discFront.position.set(-0.12, 0.42, 1.05);
    const discRear = new THREE.Mesh(discGeo, matBrakeDisc); discRear.position.set(-0.12, 0.42, -1.0);
    // Hubs
    const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.2, 16);
    hubGeo.rotateZ(Math.PI / 2);
    const hubFront = new THREE.Mesh(hubGeo, matChrome); hubFront.position.copy(wheelFront.position);
    const hubRear = new THREE.Mesh(hubGeo, matChrome); hubRear.position.copy(wheelRear.position);

    // Indicators (turn signals)
    const indGeo = new THREE.SphereGeometry(0.06, 8, 6);
    const indFL = new THREE.Mesh(indGeo, matIndicatorOff.clone()); indFL.position.set(-0.22, 1.0, 1.1);
    const indFR = new THREE.Mesh(indGeo, matIndicatorOff.clone()); indFR.position.set(0.22, 1.0, 1.1);
    const indRL = new THREE.Mesh(indGeo, matIndicatorOff.clone()); indRL.position.set(-0.18, 0.9, -1.15);
    const indRR = new THREE.Mesh(indGeo, matIndicatorOff.clone()); indRR.position.set(0.18, 0.9, -1.15);

    // Rider
    const riderBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.4, 4, 8), matRider);
    riderBody.position.set(0, 1.3, -0.4); riderBody.rotation.x = -0.25; riderBody.castShadow = true;
    const riderHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), matRider2);
    riderHead.position.set(0, 1.65, -0.15); riderHead.castShadow = true;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.65), matHelmet);
    helmet.position.set(0, 1.68, -0.15);
    const armGeo = new THREE.CapsuleGeometry(0.07, 0.4, 4, 6);
    const armL = new THREE.Mesh(armGeo, matRider); armL.position.set(-0.22, 1.25, 0.35); armL.rotation.x = -1.1; armL.castShadow = true;
    const armR = new THREE.Mesh(armGeo, matRider); armR.position.set( 0.22, 1.25, 0.35); armR.rotation.x = -1.1; armR.castShadow = true;

    // Lean pivot
    this.leanPivot = new THREE.Group();
    this.leanPivot.add(tank, seat, tail, tailLight, head, fork, bar, mirrorL, mirrorR, dash, exhaust,
                       riderBody, riderHead, helmet, armL, armR,
                       indFL, indFR, indRL, indRR);
    this.frontWheel = wheelFront;
    this.rearWheel = wheelRear;
    this.frontHub = hubFront;
    this.rearHub = hubRear;

    this.group.add(this.leanPivot, wheelFront, wheelRear, hubFront, hubRear, discFront, discRear, headLight);

    this.parts = {
      wheelFront, wheelRear, hubFront, hubRear,
      leanPivot: this.leanPivot,
      headLight,
      tailLightMat: tailLight.material,
      discFront, discRear,
      indFL, indFR, indRL, indRR,
      dashboard: dash
    };
    // Store indicator materials for blink animation
    this._indMats = [indFL.material, indFR.material, indRL.material, indRR.material];
    this._indTimer = 0;
  }

  _updateVisuals(dt) {
    if (!this.parts.leanPivot) return;
    const targetLean = -this.steerInput * Math.min(1, this.speed / 25) * 0.45;
    this.parts.leanPivot.rotation.z = THREE.MathUtils.lerp(this.parts.leanPivot.rotation.z, targetLean, 1 - Math.pow(0.001, dt));
    const targetPitch = this.throttle * 0.05 - (this.brake ? 0.08 : 0);
    this.parts.leanPivot.rotation.x = THREE.MathUtils.lerp(this.parts.leanPivot.rotation.x, targetPitch, 1 - Math.pow(0.001, dt));

    // Indicator blink animation when steering
    if (this._indMats) {
      this._indTimer += dt;
      const blink = Math.sin(this._indTimer * 8) > 0;
      const steering = Math.abs(this.steerInput) > 0.3 && this.speed > 2;
      for (let i = 0; i < this._indMats.length; i++) {
        const isLeft = i < 2;
        const active = steering && ((isLeft && this.steerInput < 0) || (!isLeft && this.steerInput > 0));
        if (active && blink) {
          this._indMats[i].color.setHex(0xff8800);
          this._indMats[i].emissive.setHex(0xff8800);
          this._indMats[i].emissiveIntensity = 1.5;
        } else {
          this._indMats[i].color.setHex(0x442200);
          this._indMats[i].emissive.setHex(0x000000);
          this._indMats[i].emissiveIntensity = 0;
        }
      }
    }

    // Spin brake discs with wheels
    if (this.parts.discFront) {
      const omega = this.speed * dt / 0.42;
      this.parts.discFront.rotation.x -= omega;
      this.parts.discRear.rotation.x -= omega;
    }
  }
}
