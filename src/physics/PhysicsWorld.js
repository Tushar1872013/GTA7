/**
 * Physics world — thin wrapper around cannon-es.
 * Provides a fixed-timestep simulation, ground collider, and helpers.
 */
import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -22, 0) // slightly stronger than 9.8 for snappier arcade feel
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.3;
    this.world.defaultContactMaterial.restitution = 0.05;

    // Materials
    this.materials = {
      ground: new CANNON.Material('ground'),
      wheel:  new CANNON.Material('wheel'),
      body:   new CANNON.Material('body')
    };

    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.materials.ground, this.materials.wheel, { friction: 0.6, restitution: 0.0 }
    ));
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.materials.ground, this.materials.body, { friction: 0.05, restitution: 0.1 }
    ));

    this._accum = 0;
    this.fixedStep = 1 / 60;
  }

  addGround(size = 1000) {
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: this.materials.ground
    });
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    body.position.set(0, 0, 0);
    this.world.addBody(body);
    this.groundBody = body;

    // Add invisible walls around the playable area to keep objects in
    const wallH = 20;
    const walls = [
      { x:  size / 2, z: 0, sx: 1, sz: size },
      { x: -size / 2, z: 0, sx: 1, sz: size },
      { x: 0, z:  size / 2, sx: size, sz: 1 },
      { x: 0, z: -size / 2, sx: size, sz: 1 }
    ];
    for (const w of walls) {
      const wall = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(1, wallH, w.sz / 2)),
        material: this.materials.ground
      });
      wall.position.set(w.x, wallH, w.z);
      this.world.addBody(wall);
    }
    return body;
  }

  addBoxCollider({ position, halfExtents, rotation }) {
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z)),
      material: this.materials.ground
    });
    body.position.set(position.x, position.y, position.z);
    if (rotation) body.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    this.world.addBody(body);
    return body;
  }

  step(dt) {
    this._accum += dt;
    let iters = 0;
    while (this._accum >= this.fixedStep && iters < 5) {
      this.world.step(this.fixedStep);
      this._accum -= this.fixedStep;
      iters++;
    }
  }

  syncMesh(body, mesh) {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  }

  static quatToThree(q) {
    return new THREE.Quaternion(q.x, q.y, q.z, q.w);
  }
}
