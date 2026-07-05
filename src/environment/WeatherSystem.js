/**
 * WeatherSystem — dynamic weather with rain, fog, thunderstorm, wet roads.
 *
 * Weather types:
 *   - sunny    — clear sky, bright
 *   - cloudy   — dimmer, more clouds
 *   - rain     — rain particles, wet roads, puddles
 *   - storm    — heavy rain + lightning flashes
 *   - fog      — dense fog, reduced visibility
 *
 * Transitions smoothly between weather states.
 * Rain creates wet road reflections (via material roughness change).
 */
import * as THREE from 'three';

export class WeatherSystem {
  constructor({ scene, world, environment }) {
    this.scene = scene;
    this.world = world;
    this.env = environment;

    this.current = 'sunny';
    this.next = 'sunny';
    this.transitionProgress = 1.0; // 0=mid-transition, 1=complete
    this.transitionSpeed = 0.05; // per second

    this.rainIntensity = 0;
    this.fogDensity = 0;
    this.wetness = 0; // 0=dry, 1=fully wet (affects road reflections)
    this.lightningTimer = 0;
    this.lightningFlash = 0;

    this._buildRain();
    this._buildLightning();

    // Cycle weather every 90 seconds
    this._weatherTimer = 0;
    this._weatherCycleInterval = 90;
    this._weatherTypes = ['sunny', 'sunny', 'cloudy', 'cloudy', 'rain', 'fog', 'storm'];
  }

  _buildRain() {
    const count = 8000;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = Math.random() * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      velocities[i] = 40 + Math.random() * 30;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainVelocities = velocities;

    const mat = new THREE.PointsMaterial({
      color: 0xaaccff,
      size: 0.15,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.rain = new THREE.Points(geo, mat);
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  _buildLightning() {
    this.lightningLight = new THREE.PointLight(0xffffff, 0, 200, 2);
    this.lightningLight.position.set(0, 100, 0);
    this.scene.add(this.lightningLight);
  }

  setWeather(type) {
    if (type === this.current && this.transitionProgress >= 1) return;
    this.next = type;
    this.transitionProgress = 0;
  }

  update(dt, playerPos) {
    // Auto-cycle weather
    this._weatherTimer += dt;
    if (this._weatherTimer > this._weatherCycleInterval) {
      this._weatherTimer = 0;
      const next = this._weatherTypes[Math.floor(Math.random() * this._weatherTypes.length)];
      this.setWeather(next);
    }

    // Transition progress
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + this.transitionSpeed * dt * 10);
      if (this.transitionProgress >= 1) {
        this.current = this.next;
      }
    }

    // Target values based on current/next weather
    const target = this._getWeatherParams(this.next);
    const speed = 0.5 * dt;
    this.rainIntensity = THREE.MathUtils.lerp(this.rainIntensity, target.rain, speed);
    this.fogDensity = THREE.MathUtils.lerp(this.fogDensity, target.fog, speed);
    this.wetness = THREE.MathUtils.lerp(this.wetness, target.wet, speed);

    // Update rain particles
    if (this.rainIntensity > 0.01) {
      this.rain.visible = true;
      this.rain.material.opacity = this.rainIntensity * 0.6;
      // Move rain with player
      this.rain.position.x = playerPos.x;
      this.rain.position.z = playerPos.z;
      // Animate rain falling
      const positions = this.rain.geometry.attributes.position.array;
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 1] -= this.rainVelocities[i] * dt * this.rainIntensity;
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 80 + Math.random() * 20;
          positions[i * 3]     = (Math.random() - 0.5) * 200;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    } else {
      this.rain.visible = false;
    }

    // Lightning during storms
    if (this.next === 'storm') {
      this.lightningTimer += dt;
      if (this.lightningTimer > 3 + Math.random() * 5) {
        this.lightningTimer = 0;
        this.lightningFlash = 1.0;
      }
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash -= dt * 3;
      this.lightningLight.intensity = Math.max(0, this.lightningFlash) * 5;
      this.lightningLight.position.set(
        playerPos.x + (Math.random() - 0.5) * 100,
        80,
        playerPos.z + (Math.random() - 0.5) * 100
      );
    }

    // Fog density
    if (this.scene.fog) {
      if (this.fogDensity > 0.01) {
        // Switch to exponential fog for weather
        if (!(this.scene.fog instanceof THREE.FogExp2)) {
          const col = this.scene.fog.color.clone();
          this.scene.fog = new THREE.FogExp2(col, 0);
        }
        this.scene.fog.density = this.fogDensity * 0.015;
      } else if (this.scene.fog instanceof THREE.FogExp2) {
        // Switch back to linear fog
        const col = this.scene.fog.color.clone();
        this.scene.fog = new THREE.Fog(col, 60, 500);
      }
    } else if (this.fogDensity > 0.01) {
      // No fog exists yet, create exp2 fog
      this.scene.fog = new THREE.FogExp2(0x6a82a8, this.fogDensity * 0.015);
    }

    // Wet road effect — modify ground material roughness
    this._updateWetMaterials();
  }

  _getWeatherParams(type) {
    switch (type) {
      case 'cloudy':  return { rain: 0, fog: 0.005, wet: 0 };
      case 'rain':    return { rain: 0.7, fog: 0.01, wet: 0.8 };
      case 'storm':   return { rain: 1.0, fog: 0.02, wet: 1.0 };
      case 'fog':     return { rain: 0, fog: 0.04, wet: 0 };
      default:        return { rain: 0, fog: 0, wet: 0 };
    }
  }

  _updateWetMaterials() {
    // Lower roughness on ground/road materials when wet for reflections
    if (!this._groundMat) {
      // Find ground mesh
      this.world.root.traverse((obj) => {
        if (obj.isMesh && obj.geometry && obj.geometry.type === 'PlaneGeometry' && obj.material && obj.material.color) {
          if (obj.material.roughness !== undefined && !this._groundMat) {
            this._groundMat = obj.material;
            this._groundRoughness = obj.material.roughness;
          }
        }
      });
    }
    if (this._groundMat) {
      // Wet roads are shinier (lower roughness)
      this._groundMat.roughness = this._groundRoughness * (1 - this.wetness * 0.7);
    }
  }
}
