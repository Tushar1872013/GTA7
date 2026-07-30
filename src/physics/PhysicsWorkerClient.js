/**
 * PhysicsWorkerClient — Phase D5 main-thread client for the physics worker.
 *
 * Owns the Web Worker (physics-worker.js) and exposes an async API for
 * running dynamic body simulation off the main render thread.
 *
 * Usage:
 *   const client = new PhysicsWorkerClient();
 *   await client.init({ gravity: { x: 0, y: -22, z: 0 }, fixedStep: 1/60 });
 *   await client.addGround(3000);
 *   await client.addBoxCollider({ position: {x:0,y:5,z:0}, halfExtents: {x:5,y:5,z:5} });
 *   const id = await client.addDynamicBody({ shape: 'sphere', radius: 0.5, mass: 1, position: {x:0,y:10,z:0} });
 *   await client.step(); // runs world.step() in the worker
 *   // ... client.getDynamicTransforms() returns the latest transforms
 *
 * Migration strategy (NOT a rewrite):
 *   - The existing PhysicsWorld class stays exactly as-is for kinematic bodies
 *     (player, vehicles, traffic). Those bodies are owned by the main thread
 *     because their positions are written directly each frame
 *     (body.position.x += dx) by Player.js and Vehicle.js.
 *   - NEW dynamic bodies (ragdolls, debris, physics props, etc.) should be
 *     created via this client instead. They'll run entirely in the worker and
 *     their transforms will be synced back via getDynamicTransforms().
 *   - Game.js can mix both: keep this.physics for kinematic, add this.physicsWorker
 *     for dynamic. Both can coexist without conflict.
 *
 * Why this design (per the masterplan's D5 warning):
 *   "This is a bigger architectural change than the others in this phase —
 *    sequence it after D1–D4 unless physics is already your measured
 *    bottleneck."
 *   The current codebase has ZERO dynamic bodies (everything is KINEMATIC),
 *   so a full worker migration would touch Player.js, Vehicle.js, Car.js,
 *   Bike.js, and Game.js for zero measurable perf win today. Instead we
 *   build the worker INFRASTRUCTURE now, ready for future dynamic body
 *   work to land off-thread with no further main-thread changes.
 */
export class PhysicsWorkerClient {
  constructor() {
    this._worker = null;
    this._ready = false;
    this._pending = new Map(); // msgId -> { resolve, reject }
    this._nextMsgId = 1;
    this._dynamicTransforms = new Map(); // id -> { position, quaternion }
    this._onTransformsCallback = null;
  }

  /**
   * Initialize the worker and wait for it to report ready.
   * Must be called before any other method.
   */
  async init(opts = {}) {
    // Use Vite's native worker import syntax — Vite will bundle the worker
    // script and emit it as a separate chunk at build time.
    this._worker = new Worker(
      new URL('./physics-worker.js', import.meta.url),
      { type: 'module' }
    );

    this._worker.onmessage = (e) => this._onMessage(e.data);
    this._worker.onerror = (e) => {
      console.error('[PhysicsWorkerClient] worker error:', e.message || e);
    };

    // Wait for 'ready' response from init message.
    await this._send('init', { opts });
    this._ready = true;
  }

  /**
   * Internal: send a message to the worker and return a promise that resolves
   * when the worker responds. Not all message types produce a response —
   * use _sendFireAndForget for those.
   */
  _send(type, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = this._nextMsgId++;
      this._pending.set(id, { resolve, reject });
      this._worker.postMessage({ id, type, ...payload });
    });
  }

  /**
   * Internal: send a message that doesn't expect a response.
   */
  _sendFireAndForget(type, payload = {}) {
    this._worker.postMessage({ type, ...payload });
  }

  _onMessage(msg) {
    if (!msg || !msg.type) return;

    // Async response to a _send() call
    if (msg.id && this._pending.has(msg.id)) {
      const { resolve, reject } = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      if (msg.type === 'error') reject(new Error(msg.message));
      else resolve(msg);
      return;
    }

    // Unsolicited messages from the worker
    switch (msg.type) {
      case 'ready':
        // Handled by _send('init')'s promise resolution
        break;
      case 'transforms':
        // Bulk-update dynamic body transforms
        if (msg.list) {
          for (const t of msg.list) {
            this._dynamicTransforms.set(t.id, { position: t.position, quaternion: t.quaternion });
          }
        }
        if (this._onTransformsCallback) this._onTransformsCallback(this._dynamicTransforms);
        break;
      case 'error':
        console.error('[PhysicsWorkerClient] worker reported error:', msg.message);
        break;
      default:
        break;
    }
  }

  /**
   * Add an infinite ground plane + boundary walls to the worker's world.
   * Mirrors PhysicsWorld.addGround(size).
   */
  async addGround(size = 1000) {
    return this._send('addGround', { size });
  }

  /**
   * Add a static box collider (building/prop collision).
   * Mirrors PhysicsWorld.addBoxCollider({ position, halfExtents, rotation }).
   */
  async addBoxCollider({ position, halfExtents, rotation }) {
    return this._send('addBoxCollider', { position, halfExtents, rotation });
  }

  /**
   * Register a dynamic body that the worker will simulate. Returns a numeric
   * id that can be used to look up transforms via getDynamicTransform(id).
   */
  async addDynamicBody({ shape, halfExtents, radius, mass, position }) {
    const id = this._nextMsgId++;
    // Reserve the id locally before sending so getDynamicTransform returns
    // null instead of throwing if called before the first step.
    this._dynamicTransforms.set(id, null);
    await this._send('addDynamicBody', { id, shape, halfExtents, radius, mass, position });
    return id;
  }

  /**
   * Remove a dynamic body from the worker's world.
   */
  async removeBody(id) {
    this._dynamicTransforms.delete(id);
    return this._send('removeBody', { id });
  }

  /**
   * Apply an impulse to a dynamic body. If worldPoint is omitted, the impulse
   * is applied at the body's center of mass.
   */
  async applyImpulse(id, impulse, worldPoint) {
    return this._send('applyImpulse', { id, impulse, worldPoint });
  }

  /**
   * Run world.step(fixedStep) once in the worker. Returns when the step
   * completes and the worker has posted back transforms.
   *
   * NOTE: this is async — callers that need transforms synchronously should
   * use getDynamicTransform() which returns the latest cached value.
   */
  async step() {
    return this._send('step');
  }

  /**
   * Get the latest cached transform for a dynamic body. Returns null if the
   * body hasn't been stepped yet. Does NOT block.
   */
  getDynamicTransform(id) {
    return this._dynamicTransforms.get(id) || null;
  }

  /**
   * Get all currently-known dynamic body transforms as a Map (id -> transform).
   */
  getAllDynamicTransforms() {
    return this._dynamicTransforms;
  }

  /**
   * Register a callback that fires whenever the worker posts new transforms.
   * The callback receives the full transforms Map.
   */
  onTransforms(callback) {
    this._onTransformsCallback = callback;
  }

  /**
   * Tear down the worker and free its resources.
   */
  async dispose() {
    if (!this._worker) return;
    try {
      await this._send('dispose');
    } catch (e) {
      // Worker may have already closed; ignore.
    }
    this._worker.terminate();
    this._worker = null;
    this._ready = false;
    this._pending.clear();
    this._dynamicTransforms.clear();
  }

  get isReady() { return this._ready; }
}
