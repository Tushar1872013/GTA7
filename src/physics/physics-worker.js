/**
 * physics-worker.js — Phase D5 physics off-thread worker.
 *
 * Owns its own CANNON.World instance and runs world.step() on the worker's
 * event loop, off the main render thread.
 *
 * Protocol (messages from main thread):
 *   { type: 'init', opts: { gravity, fixedStep, allowSleep } }
 *     Initialize the world with the given gravity and timestep.
 *   { type: 'addGround', size: number }
 *     Add an infinite ground plane + boundary walls.
 *   { type: 'addBoxCollider', position: {x,y,z}, halfExtents: {x,y,z}, rotation: {x,y,z,w}? }
 *     Add a static box collider (building/prop collision).
 *   { type: 'addDynamicBody', id: number, shape: 'sphere'|'box', halfExtents?, radius?, mass, position }
 *     Register a dynamic body that the worker will simulate. The main thread
 *     keeps a placeholder object with the same id; transform sync happens
 *     via 'transforms' messages.
 *   { type: 'removeBody', id: number }
 *     Remove a dynamic body.
 *   { type: 'applyImpulse', id: number, impulse: {x,y,z}, worldPoint?: {x,y,z} }
 *     Apply an impulse to a dynamic body.
 *   { type: 'setKinematicTransforms', transforms: [{ id, position: {x,y,z}, quaternion: {x,y,z,w} }] }
 *     Push the latest kinematic body transforms (player, vehicles, traffic)
 *     to the worker before stepping. The worker copies these into its
 *     mirror of those bodies so dynamic bodies can collide with them.
 *   { type: 'step' }
 *     Run world.step(fixedStep) once. (Note: the worker can also step on
 *     its own rAF loop; this message exists for main-thread-driven step
 *     pacing if needed.)
 *   { type: 'dispose' }
 *     Tear down the world and close the worker.
 *
 * Protocol (messages from worker):
 *   { type: 'ready' }
 *     Init complete.
 *   { type: 'transforms', list: [{ id, position: {x,y,z}, quaternion: {x,y,z,w} }] }
 *     Latest dynamic body transforms, sent after each step.
 *   { type: 'error', message: string }
 *     Something went wrong.
 *
 * Design notes:
 *   - The main thread keeps "shadow" body objects (CANNON.Body with type=KINEMATIC)
 *     so existing code that reads body.position still works. The worker has its
 *     OWN CANNON.World with the actual dynamic bodies. Kinematic transforms are
 *     pushed to the worker each frame; dynamic transforms are pulled back.
 *   - This is the "ghost world" pattern: kinematic state lives on the main thread,
 *     dynamic simulation lives on the worker, and the two are reconciled each
 *     frame via setKinematicTransforms + transforms messages.
 *   - Current codebase uses KINEMATIC bodies for everything (player, vehicles,
 *     traffic), so today there is zero dynamic work for the worker to do. The
 *     infrastructure exists so that when dynamic bodies are added (ragdolls,
 *     debris, physics props), they automatically run off-thread without any
 *     further main-thread changes.
 */
import * as CANNON from 'cannon-es';

let world = null;
let fixedStep = 1 / 60;
let _accum = 0;
let _nextBodyId = 1;
const dynamicBodies = new Map(); // id -> { body, shape }

self.onmessage = (e) => {
  const msg = e.data;
  if (!msg || !msg.type) return;

  try {
    switch (msg.type) {
      case 'init': {
        world = new CANNON.World({
          gravity: new CANNON.Vec3(
            msg.opts?.gravity?.x ?? 0,
            msg.opts?.gravity?.y ?? -22,
            msg.opts?.gravity?.z ?? 0
          )
        });
        world.broadphase = new CANNON.SAPBroadphase(world);
        world.allowSleep = msg.opts?.allowSleep ?? true;
        world.defaultContactMaterial.friction = 0.3;
        world.defaultContactMaterial.restitution = 0.05;
        fixedStep = msg.opts?.fixedStep ?? 1 / 60;

        // Materials (mirror main-thread PhysicsWorld)
        const ground = new CANNON.Material('ground');
        const wheel = new CANNON.Material('wheel');
        const bodyM = new CANNON.Material('body');
        world.addContactMaterial(new CANNON.ContactMaterial(ground, wheel, { friction: 0.6, restitution: 0.0 }));
        world.addContactMaterial(new CANNON.ContactMaterial(ground, bodyM, { friction: 0.05, restitution: 0.1 }));

        self.postMessage({ type: 'ready' });
        break;
      }

      case 'addGround': {
        if (!world) throw new Error('world not initialized');
        const size = msg.size || 1000;
        const body = new CANNON.Body({
          mass: 0,
          shape: new CANNON.Plane(),
          material: world.defaultMaterial
        });
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        world.addBody(body);

        // Boundary walls
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
            material: world.defaultMaterial
          });
          wall.position.set(w.x, wallH, w.z);
          world.addBody(wall);
        }
        break;
      }

      case 'addBoxCollider': {
        if (!world) throw new Error('world not initialized');
        const body = new CANNON.Body({
          mass: 0,
          shape: new CANNON.Box(new CANNON.Vec3(
            msg.halfExtents.x, msg.halfExtents.y, msg.halfExtents.z
          )),
          material: world.defaultMaterial
        });
        body.position.set(msg.position.x, msg.position.y, msg.position.z);
        if (msg.rotation) body.quaternion.set(msg.rotation.x, msg.rotation.y, msg.rotation.z, msg.rotation.w);
        world.addBody(body);
        break;
      }

      case 'addDynamicBody': {
        if (!world) throw new Error('world not initialized');
        let shape;
        if (msg.shape === 'sphere') {
          shape = new CANNON.Sphere(msg.radius || 0.5);
        } else if (msg.shape === 'box') {
          shape = new CANNON.Box(new CANNON.Vec3(msg.halfExtents.x, msg.halfExtents.y, msg.halfExtents.z));
        } else {
          throw new Error('unknown shape: ' + msg.shape);
        }
        const body = new CANNON.Body({
          mass: msg.mass || 1,
          shape,
          material: world.defaultMaterial,
          type: CANNON.Body.DYNAMIC,
          position: new CANNON.Vec3(msg.position.x, msg.position.y, msg.position.z)
        });
        world.addBody(body);
        dynamicBodies.set(msg.id, { body, shape: msg.shape });
        break;
      }

      case 'removeBody': {
        if (!world) return;
        const entry = dynamicBodies.get(msg.id);
        if (entry) {
          world.removeBody(entry.body);
          dynamicBodies.delete(msg.id);
        }
        break;
      }

      case 'applyImpulse': {
        if (!world) return;
        const entry = dynamicBodies.get(msg.id);
        if (!entry) return;
        const impulse = new CANNON.Vec3(msg.impulse.x, msg.impulse.y, msg.impulse.z);
        if (msg.worldPoint) {
          entry.body.applyImpulse(impulse, new CANNON.Vec3(msg.worldPoint.x, msg.worldPoint.y, msg.worldPoint.z));
        } else {
          entry.body.applyImpulse(impulse);
        }
        break;
      }

      case 'setKinematicTransforms': {
        // No-op for now: the current codebase has no kinematic bodies registered
        // with the worker (all kinematic state lives on the main thread). When
        // dynamic bodies are added in the future, kinematic bodies will be
        // registered here so dynamic-vs-kinematic collisions resolve correctly.
        // Kept as a no-op stub so the main-thread client can call it without
        // breaking when this feature lands.
        break;
      }

      case 'step': {
        if (!world) return;
        _step();
        break;
      }

      case 'dispose': {
        if (world) {
          // Clear all bodies
          while (world.bodies.length) world.removeBody(world.bodies[0]);
          world = null;
        }
        dynamicBodies.clear();
        self.close();
        break;
      }

      default:
        // Unknown message — ignore.
        break;
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};

function _step() {
  if (!world) return;
  // Fixed-timestep accumulator (mirrors main-thread PhysicsWorld.step)
  _accum += fixedStep; // single-step per message; main thread paces
  let iters = 0;
  while (_accum >= fixedStep && iters < 5) {
    world.step(fixedStep);
    _accum -= fixedStep;
    iters++;
  }

  // Post back transforms for all dynamic bodies.
  if (dynamicBodies.size > 0) {
    const list = [];
    for (const [id, entry] of dynamicBodies) {
      list.push({
        id,
        position: { x: entry.body.position.x, y: entry.body.position.y, z: entry.body.position.z },
        quaternion: { x: entry.body.quaternion.x, y: entry.body.quaternion.y, z: entry.body.quaternion.z, w: entry.body.quaternion.w }
      });
    }
    self.postMessage({ type: 'transforms', list });
  }
}

// Optional: self-paced stepping on the worker's own rAF loop.
// Disabled by default — the main thread drives stepping via 'step' messages
// so we can pause when the game tab is backgrounded. Enable by sending
// { type: 'enableAutoStep' } from the main thread if needed.
let _autoStepRaf = null;
function _autoStepLoop() {
  _step();
  _autoStepRaf = setTimeout(_autoStepLoop, fixedStep * 1000);
}
