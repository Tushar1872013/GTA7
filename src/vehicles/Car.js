/**
 * Car — 4-wheel drivable car, extends Vehicle.
 * 3 variants: Sedan (balanced), Sports (fast, low), SUV (tanky, off-road)
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Vehicle } from './Vehicle.js';

export class Car extends Vehicle {
  static variantSpecs = [
    { name: 'Sedan',  maxSpeed: 50, maxBoostSpeed: 70, accel: 18, brakeDecel: 30, steerRate: 1.2, fuelRate: 0.8 },
    { name: 'Sports', maxSpeed: 75, maxBoostSpeed: 110, accel: 30, brakeDecel: 45, steerRate: 1.5, fuelRate: 1.2 },
    { name: 'SUV',    maxSpeed: 40, maxBoostSpeed: 60, accel: 14, brakeDecel: 25, steerRate: 1.0, fuelRate: 1.0 }
  ];

  constructor(opts) { super(opts); }

  _buildBody() {
    const r = 0.7;
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

  _buildMesh() {
    const v = this.variants[this.variant];
    const isSports = v.name === 'Sports';
    const isSUV = v.name === 'SUV';
    const color = isSports ? 0xd32f2f : isSUV ? 0x2e7d32 : 0x1976d2;
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x222a33, metalness: 0.7, roughness: 0.15 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.95, roughness: 0.15 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff0000, emissiveIntensity: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff4d6, emissiveIntensity: 1.2 });

    // Dimensions depend on variant
    const w = isSUV ? 2.4 : isSports ? 2.0 : 2.1;
    const h = isSUV ? 1.6 : isSports ? 0.7 : 1.0;
    const len = isSUV ? 4.6 : isSports ? 4.2 : 4.4;
    const wheelR = isSUV ? 0.5 : isSports ? 0.4 : 0.42;

    const g = new THREE.Group();
    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), bodyMat);
    body.position.y = 0.9 + h / 2; body.castShadow = true;
    // Cabin
    const cabinH = isSUV ? 1.1 : isSports ? 0.55 : 0.7;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, cabinH, len * 0.55), glassMat);
    cabin.position.set(0, 0.9 + h + cabinH / 2 - 0.1, -0.1);
    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.28, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelPositions = [
      [-w / 2 - 0.05, wheelR,  len / 2 - 0.8],
      [ w / 2 + 0.05, wheelR,  len / 2 - 0.8],
      [-w / 2 - 0.05, wheelR, -len / 2 + 0.8],
      [ w / 2 + 0.05, wheelR, -len / 2 + 0.8]
    ];
    const wheels = [];
    for (const p of wheelPositions) {
      const w = new THREE.Mesh(wheelGeo, darkMat);
      w.position.set(...p); w.castShadow = true;
      g.add(w); wheels.push(w);
    }
    // Headlights
    const headL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), headMat);
    headL.position.set(-w / 2 + 0.4, 0.9 + h * 0.6, len / 2);
    const headR = headL.clone(); headR.position.x = w / 2 - 0.4;
    // Taillights
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.06), tailMat);
    tailL.position.set(-w / 2 + 0.4, 0.9 + h * 0.6, -len / 2);
    const tailR = tailL.clone(); tailR.position.x = w / 2 - 0.4;
    // Headlight point light
    const headLight = new THREE.PointLight(0xfff4d6, 1.5, 35, 2);
    headLight.position.set(0, 0.9 + h, len / 2 + 0.5);

    // Front bumper detail
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.3), chromeMat);
    bumper.position.set(0, 0.7, len / 2);

    g.add(body, cabin, headL, headR, tailL, tailR, bumper, headLight);

    this.parts = {
      wheelFront: wheels[0], wheelRear: wheels[2],
      hubFront: wheels[1], hubRear: wheels[3],
      wheels,
      headLight,
      tailLightMat: tailMat
    };
    this.group.add(g);
  }
}
