/**
 * PoliceSystem — wanted level + chasing police cars.
 *
 * Wanted level (0..5 stars):
 *   - Increases when player hits pedestrians, traffic cars, or police cars
 *   - Decreases over time when no crimes are committed for 15s
 *
 * Police cars (spawn based on wanted level):
 *   - 1 star  → 1 police car
 *   - 5 stars → 5 police cars
 *   - Each car uses simple seek behavior to chase the player's vehicle
 *   - They flash red/blue lights
 */
import * as THREE from 'three';

export class PoliceSystem {
  constructor({ scene, world }) {
    this.scene = scene;
    this.world = world;

    this.wanted = 0;          // 0..5
    this.maxWanted = 5;
    this.heatTimer = 0;       // seconds since last crime
    this.heatCooldown = 15;   // seconds without crime to start losing wanted

    this.cars = [];           // active police cars
    this.root = new THREE.Group();
    this.root.name = 'Police';
    scene.add(this.root);

    this._flashTimer = 0;
    this.onWantedChange = null;
  }

  /**
   * Called by Game when player commits a crime (hit ped, hit car, etc).
   */
  reportCrime(severity = 1) {
    this.wanted = Math.min(this.maxWanted, this.wanted + severity * 0.5);
    this.heatTimer = 0;
    this._updateCarCount();
    if (this.onWantedChange) this.onWantedChange(this.wanted);
  }

  _updateCarCount() {
    const targetCount = Math.ceil(this.wanted);
    while (this.cars.length < targetCount) this._spawnPolice();
    while (this.cars.length > targetCount) {
      const c = this.cars.pop();
      this.root.remove(c);
    }
  }

  _spawnPolice() {
    const car = this._makePoliceCar();
    const { point } = this.world.randomRoadPoint();
    car.position.copy(point);
    car.position.y = 0.5;
    this.root.add(car);
    this.cars.push(car);
  }

  _makePoliceCar() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, metalness: 0.6, roughness: 0.4 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, metalness: 0.3, roughness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x222a33, metalness: 0.7, roughness: 0.15 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.5 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x0000ff, emissiveIntensity: 1.5 });

    const g = new THREE.Group();
    // Body (dual-tone: black + white)
    const bodyLower = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.4), whiteMat);
    bodyLower.position.y = 0.7; bodyLower.castShadow = true;
    const bodyUpper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 4.4), bodyMat);
    bodyUpper.position.y = 1.2;
    // Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.7, 2.4), glassMat);
    cabin.position.set(0, 1.55, -0.1);
    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wp = [[-1.05, 0.42, 1.4], [1.05, 0.42, 1.4], [-1.05, 0.42, -1.4], [1.05, 0.42, -1.4]];
    for (const p of wp) {
      const w = new THREE.Mesh(wheelGeo, darkMat);
      w.position.set(...p); w.castShadow = true;
      g.add(w);
    }
    // Light bar (red + blue)
    const lightBar = new THREE.Group();
    const redLight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.4), redMat);
    redLight.position.set(-0.3, 0, 0);
    const blueLight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.4), blueMat);
    blueLight.position.set(0.3, 0, 0);
    lightBar.add(redLight, blueLight);
    lightBar.position.set(0, 2.05, -0.1);
    // Headlights
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff4d6, emissiveIntensity: 1.2 });
    const headL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), headMat);
    headL.position.set(-0.7, 0.7, 2.2);
    const headR = headL.clone(); headR.position.x = 0.7;
    // Siren lights (point)
    const sirenRed = new THREE.PointLight(0xff0000, 0, 12, 2);
    sirenRed.position.set(-0.3, 2.1, -0.1);
    const sirenBlue = new THREE.PointLight(0x0000ff, 0, 12, 2);
    sirenBlue.position.set(0.3, 2.1, -0.1);

    g.add(bodyLower, bodyUpper, cabin, lightBar, headL, headR, sirenRed, sirenBlue);
    g.userData = {
      speed: 0,
      maxSpeed: 22,
      heading: 0,
      lightBar,
      redLight, blueLight,
      sirenRed, sirenBlue,
      flashState: 0
    };
    return g;
  }

  update(dt, playerPos, playerSpeed, playerVehicle) {
    // Heat decay
    if (this.wanted > 0) {
      this.heatTimer += dt;
      if (this.heatTimer > this.heatCooldown) {
        this.wanted = Math.max(0, this.wanted - dt * 0.2);
        if (this.onWantedChange) this.onWantedChange(this.wanted);
        this._updateCarCount();
      }
    }

    // Flash lights
    this._flashTimer += dt;
    if (this._flashTimer > 0.25) {
      this._flashTimer = 0;
      for (const c of this.cars) {
        const ud = c.userData;
        ud.flashState = 1 - ud.flashState;
        ud.redLight.material.emissiveIntensity = ud.flashState ? 2.5 : 0.2;
        ud.blueLight.material.emissiveIntensity = ud.flashState ? 0.2 : 2.5;
        ud.sirenRed.intensity = ud.flashState ? 1.5 : 0;
        ud.sirenBlue.intensity = ud.flashState ? 0 : 1.5;
      }
    }

    // Chase behavior
    for (const c of this.cars) {
      const ud = c.userData;
      const toPlayer = new THREE.Vector3().subVectors(playerPos, c.position);
      const dist = toPlayer.length();

      // Steer toward player
      const desiredYaw = Math.atan2(toPlayer.x, toPlayer.z);
      let diff = desiredYaw - ud.heading;
      while (diff > Math.PI)  diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ud.heading += diff * Math.min(1, dt * 2.0);

      // Speed: full chase if far, slow if very close (avoid ramming)
      const targetSpeed = dist > 8 ? ud.maxSpeed : (dist > 4 ? ud.maxSpeed * 0.6 : 0);
      ud.speed = THREE.MathUtils.lerp(ud.speed, targetSpeed, 1 - Math.pow(0.01, dt));

      c.position.x += Math.sin(ud.heading) * ud.speed * dt;
      c.position.z += Math.cos(ud.heading) * ud.speed * dt;
      c.rotation.y = ud.heading;
    }
  }
}
