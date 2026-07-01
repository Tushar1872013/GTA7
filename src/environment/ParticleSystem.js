/**
 * ParticleSystem — dust, exhaust, rain splashes, nitro flames.
 *
 * Manages particle pools for performance. Particles are billboards
 * (Points or small Sprites) that emit from sources.
 *
 * Types:
 *   - Exhaust: smoke from vehicle tailpipes
 *   - Dust: kicked up by vehicles on dirt
 *   - Nitro: blue flame from bike boost
 *   - RainSplash: splashes when rain hits ground
 */
import * as THREE from 'three';

export class ParticleSystem {
  constructor({ scene }) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'Particles';
    scene.add(this.root);

    this._emitters = [];
    this._time = 0;
  }

  /**
   * Create an exhaust emitter attached to a vehicle.
   */
  createExhaust(vehicle) {
    const geo = new THREE.BufferGeometry();
    const maxParticles = 30;
    const positions = new Float32Array(maxParticles * 3);
    const ages = new Float32Array(maxParticles);
    for (let i = 0; i < maxParticles; i++) {
      positions[i * 3] = 0; positions[i * 3 + 1] = -100; positions[i * 3 + 2] = 0;
      ages[i] = 999;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x888888, size: 0.4, transparent: true, opacity: 0.4,
      depthWrite: false, sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    this.root.add(points);
    this._emitters.push({
      type: 'exhaust', vehicle, points, ages, maxParticles, next: 0
    });
  }

  /**
   * Create nitro flame emitter for a vehicle.
   */
  createNitro(vehicle) {
    const geo = new THREE.BufferGeometry();
    const maxParticles = 20;
    const positions = new Float32Array(maxParticles * 3);
    const ages = new Float32Array(maxParticles);
    for (let i = 0; i < maxParticles; i++) {
      positions[i * 3] = 0; positions[i * 3 + 1] = -100; positions[i * 3 + 2] = 0;
      ages[i] = 999;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x4fc3f7, size: 0.3, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geo, mat);
    this.root.add(points);
    this._emitters.push({
      type: 'nitro', vehicle, points, ages, maxParticles, next: 0
    });
  }

  /**
   * Create rain splash particles (when raining).
   */
  createRainSplash(pos) {
    if (Math.random() > 0.3) return;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(3);
    positions[0] = pos.x; positions[1] = 0.1; positions[2] = pos.z;
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xaaccff, size: 0.2, transparent: true, opacity: 0.6,
      depthWrite: false
    });
    const splash = new THREE.Points(geo, mat);
    splash.userData = { life: 0.3, maxLife: 0.3 };
    this.root.add(splash);
    this._splashes = this._splashes || [];
    this._splashes.push(splash);
  }

  update(dt, activeVehicle, isRaining) {
    this._time += dt;

    // Update emitters
    for (const em of this._emitters) {
      const v = em.vehicle;
      if (!v || !v.group.parent) continue;
      const positions = em.points.geometry.attributes.position.array;

      if (em.type === 'exhaust') {
        // Emit when moving
        if (v.speed > 1 && this._time % 0.05 < dt) {
          const idx = em.next * 3;
          // Position behind vehicle
          const back = new THREE.Vector3(0, 0.5, -1.2).applyAxisAngle(new THREE.Vector3(0,1,0), v.yaw);
          positions[idx] = v.group.position.x + back.x + (Math.random() - 0.5) * 0.2;
          positions[idx + 1] = v.group.position.y + 0.5;
          positions[idx + 2] = v.group.position.z + back.z + (Math.random() - 0.5) * 0.2;
          em.ages[em.next] = 0;
          em.next = (em.next + 1) % em.maxParticles;
        }
        // Age + rise particles
        for (let i = 0; i < em.maxParticles; i++) {
          if (em.ages[i] < 2) {
            em.ages[i] += dt;
            positions[i * 3 + 1] += dt * 0.5;
            const fade = 1 - em.ages[i] / 2;
            em.points.material.opacity = 0.4 * fade;
          } else {
            positions[i * 3 + 1] = -100;
          }
        }
        em.points.geometry.attributes.position.needsUpdate = true;
      }

      if (em.type === 'nitro') {
        // Emit only when boosting
        const active = v.boost && v.speed > 5;
        em.points.material.opacity = active ? 0.8 : 0;
        if (active && this._time % 0.02 < dt) {
          const idx = em.next * 3;
          const back = new THREE.Vector3(0, 0.3, -1.0).applyAxisAngle(new THREE.Vector3(0,1,0), v.yaw);
          positions[idx] = v.group.position.x + back.x;
          positions[idx + 1] = v.group.position.y + 0.3;
          positions[idx + 2] = v.group.position.z + back.z;
          em.ages[em.next] = 0;
          em.next = (em.next + 1) % em.maxParticles;
        }
        for (let i = 0; i < em.maxParticles; i++) {
          if (em.ages[i] < 0.3) {
            em.ages[i] += dt;
            positions[i * 3 + 1] += dt * 1;
          } else {
            positions[i * 3 + 1] = -100;
          }
        }
        em.points.geometry.attributes.position.needsUpdate = true;
      }
    }

    // Rain splashes
    if (isRaining && activeVehicle && Math.random() < 0.5) {
      const p = activeVehicle.body.position;
      this.createRainSplash(new THREE.Vector3(
        p.x + (Math.random() - 0.5) * 20,
        0,
        p.z + (Math.random() - 0.5) * 20
      ));
    }
    // Age splashes
    if (this._splashes) {
      for (let i = this._splashes.length - 1; i >= 0; i--) {
        const s = this._splashes[i];
        s.userData.life -= dt;
        s.material.opacity = (s.userData.life / s.userData.maxLife) * 0.6;
        s.material.size = 0.2 + (1 - s.userData.life / s.userData.maxLife) * 0.3;
        if (s.userData.life <= 0) {
          this.root.remove(s);
          s.geometry.dispose();
          s.material.dispose();
          this._splashes.splice(i, 1);
        }
      }
    }
  }
}
