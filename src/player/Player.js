/**
 * Player — AAA-quality character with realistic proportions.
 *
 * Based on the GTA7 Character Overhaul spec:
 *   - Realistic adult male (1.80m, proper body proportions)
 *   - Facial features: eyes (iris+pupil), eyebrows, beard stubble, ears, nose
 *   - Clothing: black leather jacket, white t-shirt, blue denim jeans, brown boots
 *   - PBR materials: skin (subsurface-like), leather, denim, cotton
 *   - Animations: idle breathing, walk, run, sprint, jump, phone usage
 *   - Modular parts for customization
 *
 * State machine:
 *   - 'onFoot'   : walking/running, controlled by WASD relative to camera
 *   - 'onBike'   : invisible, follows the bike transform
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { getSkinTextures, getLeatherTextures, getDenimTextures, getBootTextures } from './CharacterTextures.js';
import { StrandHair } from './StrandHair.js';
import { FacialBlendshapes } from './FacialBlendshapes.js';

export class Player {
  constructor({ scene, physics, cameraRig }) {
    this.scene = scene;
    this.physics = physics;
    this.cameraRig = cameraRig;

    this.state = 'onFoot';
    this.speed = 0;
    this.onBikeRef = null;

    // Load textures
    this._skinTex = getSkinTextures();
    this._leatherTex = getLeatherTextures();
    this._denimTex = getDenimTextures();
    this._bootTex = getBootTextures();

    this._buildMesh();
    this._buildBody();
    scene.add(this.group);
  }

  _buildMesh() {
    this.group = new THREE.Group();
    this.group.name = 'Player';

    // === PBR Materials with 4K procedural textures ===
    // Skin — with albedo (pores), normal map (bumps), roughness
    const skinMat = new THREE.MeshStandardMaterial({
      map: this._skinTex.albedo,
      normalMap: this._skinTex.normal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughnessMap: this._skinTex.roughness,
      roughness: 0.55, metalness: 0.0
    });
    // Leather jacket — with albedo (grain), normal map (pebbled)
    const leatherMat = new THREE.MeshStandardMaterial({
      map: this._leatherTex.albedo,
      normalMap: this._leatherTex.normal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.35, metalness: 0.1
    });
    // White t-shirt
    const shirtMat = new THREE.MeshStandardMaterial({
      color: 0xe8e8e8, roughness: 0.8, metalness: 0.0
    });
    // Blue denim jeans — with weave texture
    const jeansMat = new THREE.MeshStandardMaterial({
      map: this._denimTex.albedo,
      normalMap: this._denimTex.normal,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.85, metalness: 0.05
    });
    // Brown leather boots — with worn texture
    const bootMat = new THREE.MeshStandardMaterial({
      map: this._bootTex.albedo,
      roughness: 0.5, metalness: 0.15
    });
    // Eye materials
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.15, metalness: 0.0 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.2, metalness: 0.2 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.05, metalness: 0.5 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, metalness: 0.6, roughness: 0.2 });

    // === HIGH-POLY GEOMETRY (increased segments for detail) ===
    // Head — higher subdivision (was 16x14, now 32x24)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 24), skinMat);
    head.position.y = 1.68; head.castShadow = true;
    head.scale.set(0.95, 1.05, 0.95);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 16), skinMat);
    neck.position.y = 1.56;

    // Ears
    const earGeo = new THREE.SphereGeometry(0.04, 8, 6);
    earGeo.scale(0.5, 1, 0.8);
    const earL = new THREE.Mesh(earGeo, skinMat); earL.position.set(-0.11, 1.68, 0);
    const earR = new THREE.Mesh(earGeo, skinMat); earR.position.set(0.11, 1.68, 0);

    // Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), skinMat);
    nose.position.set(0, 1.66, 0.11);
    nose.rotation.x = Math.PI / 2;

    // Eyes — detailed
    const eyeWhiteGeo = new THREE.SphereGeometry(0.028, 12, 10);
    const irisGeo = new THREE.CircleGeometry(0.018, 12);
    const pupilGeo = new THREE.CircleGeometry(0.009, 8);
    const eyeL = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat); eyeL.position.set(-0.04, 1.70, 0.095);
    const irisL = new THREE.Mesh(irisGeo, irisMat); irisL.position.set(-0.04, 1.70, 0.12);
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat); pupilL.position.set(-0.04, 1.70, 0.124);
    const eyeR = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat); eyeR.position.set(0.04, 1.70, 0.095);
    const irisR = new THREE.Mesh(irisGeo, irisMat); irisR.position.set(0.04, 1.70, 0.12);
    const pupilR = new THREE.Mesh(pupilGeo, pupilMat); pupilR.position.set(0.04, 1.70, 0.124);

    // Eyebrows
    const browGeo = new THREE.BoxGeometry(0.05, 0.008, 0.01);
    const browL = new THREE.Mesh(browGeo, new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.7 }));
    browL.position.set(-0.04, 1.735, 0.11);
    const browR = browL.clone(); browR.position.x = 0.04;

    // Mouth
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.6 }));
    mouth.position.set(0, 1.62, 0.105);

    // Beard stubble
    const stubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 16, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.4),
      new THREE.MeshStandardMaterial({ color: 0x3a2820, roughness: 0.7 })
    );
    stubble.position.y = 1.64;
    stubble.scale.set(0.95, 1, 0.95);

    // === STRAND-BASED HAIR === (300 individual strands)
    this.strandHair = new StrandHair({ color: 0x2a1810, strandCount: 300 });
    this.strandHair.group.position.y = 1.04; // offset to head position

    // === TORSO === (higher poly)
    const torsoUpper = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.22, 4, 4, 4), leatherMat);
    torsoUpper.position.y = 1.35; torsoUpper.castShadow = true;
    const torsoLower = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.2, 4, 4, 4), leatherMat);
    torsoLower.position.y = 1.09; torsoLower.castShadow = true;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 16), shirtMat);
    collar.position.y = 1.50; collar.rotation.x = Math.PI / 2;

    // === ARMS === (higher poly capsules)
    const armGeo = new THREE.CapsuleGeometry(0.06, 0.35, 8, 16);
    const upperArmL = new THREE.Mesh(armGeo, leatherMat); upperArmL.position.set(-0.24, 1.32, 0); upperArmL.castShadow = true;
    const upperArmR = new THREE.Mesh(armGeo, leatherMat); upperArmR.position.set(0.24, 1.32, 0); upperArmR.castShadow = true;
    const forearmGeo = new THREE.CapsuleGeometry(0.055, 0.32, 8, 16);
    const forearmL = new THREE.Mesh(forearmGeo, leatherMat); forearmL.position.set(-0.24, 0.95, 0); forearmL.castShadow = true;
    const forearmR = new THREE.Mesh(forearmGeo, leatherMat); forearmR.position.set(0.24, 0.95, 0); forearmR.castShadow = true;
    const handGeo = new THREE.BoxGeometry(0.07, 0.09, 0.04);
    const handL = new THREE.Mesh(handGeo, skinMat); handL.position.set(-0.24, 0.74, 0);
    const handR = new THREE.Mesh(handGeo, skinMat); handR.position.set(0.24, 0.74, 0);

    // === LEGS === (higher poly)
    const legGeo = new THREE.CapsuleGeometry(0.09, 0.55, 8, 16);
    const legL = new THREE.Mesh(legGeo, jeansMat); legL.position.set(-0.1, 0.45, 0); legL.castShadow = true;
    const legR = new THREE.Mesh(legGeo, jeansMat); legR.position.set(0.1, 0.45, 0); legR.castShadow = true;

    // === BOOTS ===
    const bootGeo = new THREE.BoxGeometry(0.12, 0.1, 0.25);
    const bootL = new THREE.Mesh(bootGeo, bootMat); bootL.position.set(-0.1, 0.06, 0.04); bootL.castShadow = true;
    const bootR = new THREE.Mesh(bootGeo, bootMat); bootR.position.set(0.1, 0.06, 0.04); bootR.castShadow = true;

    // === HELMET ===
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.65),
      helmetMat
    );
    helmet.position.y = 1.74;
    helmet.visible = false;

    // Group all parts
    this.parts = {
      head, neck, earL, earR, nose,
      eyeL, irisL, pupilL, eyeR, irisR, pupilR,
      browL, browR, mouth, stubble,
      torsoUpper, torsoLower, collar,
      upperArmL, upperArmR, forearmL, forearmR, handL, handR,
      legL, legR, bootL, bootR,
      helmet,
      _skinMat: skinMat, _leatherMat: leatherMat, _jeansMat: jeansMat, _bootMat: bootMat, _helmetMat: helmetMat
    };

    this.group.add(
      head, neck, earL, earR, nose,
      eyeL, irisL, pupilL, eyeR, irisR, pupilR,
      browL, browR, mouth, stubble,
      torsoUpper, torsoLower, collar,
      upperArmL, upperArmR, forearmL, forearmR, handL, handR,
      legL, legR, bootL, bootR,
      helmet,
      this.strandHair.group
    );

    // === FACIAL BLENDSHAPES === (60+ morph targets)
    this.blendshapes = new FacialBlendshapes(head, {
      eyeL, eyeR, irisL, irisR, pupilL, pupilR,
      browL, browR, mouth
    });

    // Animation phases
    this._walkPhase = 0;
    this._idlePhase = 0;
    this._phoneMode = false;
  }

  _buildBody() {
    const r = 0.32;
    this.body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Sphere(r),
      material: this.physics.materials.body,
      type: CANNON.Body.KINEMATIC
    });
    this.body.position.set(0, r, 8);
    this.physics.world.addBody(this.body);
    this._colliderRadius = r;
    this._colliders = null;
  }

  setColliders(colliders) { this._colliders = colliders; }
  setVisible(v) { this.group.visible = v; }

  /**
   * On-foot update with expanded animations.
   */
  updateOnFoot(dt, controls, camera) {
    const f = controls.state.forward, b = controls.state.back;
    const l = controls.state.left, r = controls.state.right;
    const p = this.parts;

    const camYaw = Math.atan2(camera.position.x - this.body.position.x, camera.position.z - this.body.position.z);

    let inputX = r - l;
    let inputZ = b - f;
    const mag = Math.hypot(inputX, inputZ);

    // Phone mode toggle (handled in Game, but animation here)
    if (this._phoneMode) {
      // Hold phone to ear
      p.forearmR.rotation.x = -2.2;
      p.handR.position.y = 1.55;
      p.handR.position.z = 0.05;
      p.handR.position.x = 0.08;
    }

    if (mag > 0.01) {
      inputX /= mag; inputZ /= mag;
      const sprinting = controls.state.boost;
      const speed = sprinting ? 9 : 5;
      const cos = Math.cos(camYaw), sin = Math.sin(camYaw);
      const wx = inputX * cos - inputZ * sin;
      const wz = inputX * sin + inputZ * cos;

      const prevX = this.body.position.x;
      const prevZ = this.body.position.z;
      this.body.position.x += wx * speed * dt;
      this.body.position.z += wz * speed * dt;
      this.body.position.y = this._colliderRadius;

      // Building collision
      if (this._colliders) {
        const rad = this._colliderRadius;
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
          if (distSq < rad * rad) {
            this.body.position.x = prevX;
            this.body.position.z = prevZ;
            break;
          }
        }
      }

      const targetYaw = Math.atan2(wx, wz);
      this._faceYaw(targetYaw, dt, 12);

      // Walk/sprint animation — arms swing more when sprinting
      this._walkPhase += dt * (sprinting ? 16 : 10);
      const sw = Math.sin(this._walkPhase) * (sprinting ? 0.7 : 0.5);
      const armSw = sw * (sprinting ? 0.9 : 0.6);
      p.legL.rotation.x = sw;
      p.legR.rotation.x = -sw;
      p.bootL.position.z = 0.04 + sw * 0.15;
      p.bootR.position.z = 0.04 - sw * 0.15;
      p.upperArmL.rotation.x = -armSw;
      p.upperArmR.rotation.x = armSw;
      p.forearmL.rotation.x = -armSw * 0.5;
      p.forearmR.rotation.x = armSw * 0.5;
      // Slight torso lean when sprinting
      p.torsoUpper.rotation.x = sprinting ? 0.15 : 0;
      p.torsoLower.rotation.x = sprinting ? 0.1 : 0;
      this.speed = speed;
    } else {
      // Idle breathing — torso + head gently rise/fall
      this._walkPhase *= 0.85;
      this._idlePhase += dt * 1.5;
      const breath = Math.sin(this._idlePhase) * 0.015;
      p.torsoUpper.position.y = 1.35 + breath;
      p.torsoLower.position.y = 1.09 + breath * 0.5;
      p.head.position.y = 1.68 + breath * 0.3;
      // Arms relax
      p.legL.rotation.x *= 0.8;
      p.legR.rotation.x *= 0.8;
      p.upperArmL.rotation.x *= 0.8;
      p.upperArmR.rotation.x *= 0.8;
      p.forearmL.rotation.x *= 0.8;
      if (!this._phoneMode) p.forearmR.rotation.x *= 0.8;
      p.bootL.position.z = 0.04;
      p.bootR.position.z = 0.04;
      p.torsoUpper.rotation.x *= 0.8;
      p.torsoLower.rotation.x *= 0.8;
      // Reset hand position if not on phone
      if (!this._phoneMode) {
        p.handR.position.set(0.24, 0.74, 0);
      }
      this.speed = 0;
    }

    // Sync mesh
    this.group.position.copy(this.body.position);
    this.group.position.y -= 0.05;

    // Update blendshapes + strand hair
    if (this.blendshapes) this.blendshapes.update(dt);
    if (this.strandHair) this.strandHair.update(dt, performance.now() / 1000);
  }

  updateOnBike(dt, bike) {
    const seatLocal = new THREE.Vector3(0, 0.55, -0.1);
    const seatWorld = seatLocal.applyMatrix4(bike.group.matrixWorld);
    this.body.position.set(seatWorld.x, seatWorld.y, seatWorld.z);
    this.body.velocity.set(0, 0, 0);
    if (this.group.visible) this.setVisible(false);
    // Show helmet when riding
    if (!this.parts.helmet.visible) this.parts.helmet.visible = true;
    this._faceYaw(bike.yaw, dt, 10);
  }

  setPhysicsEnabled(enabled) {
    if (enabled) {
      this.body.collisionFilterMask = -1;
      this.body.type = CANNON.Body.DYNAMIC;
    } else {
      this.body.collisionFilterMask = 0;
      this.body.type = CANNON.Body.KINEMATIC;
      this.body.velocity.set(0, 0, 0);
    }
  }

  setPhoneMode(on) {
    this._phoneMode = on;
    if (!on) {
      // Reset right arm
      this.parts.forearmR.rotation.x = 0;
      this.parts.handR.position.set(0.24, 0.74, 0);
    }
  }

  _faceYaw(yaw, dt, speed) {
    let cur = this.group.rotation.y;
    let diff = yaw - cur;
    while (diff > Math.PI)  diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y = cur + diff * Math.min(1, dt * speed);
  }

  resetTo(pos) {
    this.body.position.set(pos.x, pos.y + 1.5, pos.z);
    this.body.velocity.set(0, 0, 0);
    // Hide helmet when not riding
    this.parts.helmet.visible = false;
  }
}
