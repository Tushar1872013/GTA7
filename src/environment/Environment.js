/**
 * Environment — AAA dynamic time-of-day with cinematic lighting.
 *
 * Fixes overexposure by:
 *   - Lowering exposure to 0.8-1.0 (was 1.0-1.3)
 *   - Reducing ambient/hemisphere intensity (was 0.6-0.8, now 0.15-0.4)
 *   - Toning down sun intensity (was 2-3.5, now 1.5-2.5)
 *   - Adding strong directional shadows with high resolution
 *
 * 6 phases with distinct color palettes:
 *   Morning  — warm orange sun, cool blue ambient, long soft shadows
 *   Day      — neutral white sun, balanced exposure, crisp shadows
 *   Sunset   — golden orange, long dramatic shadows, warm reflections
 *   Blue Hour — deep blue/purple, city lights starting
 *   Night    — dark blue, moon, stars, neon + street lights
 *   Pre-Dawn — deep blue with hint of orange on horizon
 */
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

// Color palettes — tuned for cinematic contrast, NOT overexposed
const PALETTES = {
  morning: {
    sunIntensity: 1.8,
    sunColor: 0xffb066,
    ambientColor: 0x3a5070,
    ambientIntensity: 0.25,
    hemiSky: 0x88aacc,
    hemiGround: 0x3a2a1a,
    hemiIntensity: 0.3,
    fogColor: 0xc8b898,
    fogNear: 80,
    fogFar: 600,
    exposure: 0.85,
    sky: { turbidity: 6, rayleigh: 2.0, mie: 0.005, mieG: 0.8 }
  },
  day: {
    sunIntensity: 2.2,
    sunColor: 0xfff4e8,
    ambientColor: 0x405060,
    ambientIntensity: 0.3,
    hemiSky: 0x88bbdd,
    hemiGround: 0x3a3020,
    hemiIntensity: 0.35,
    fogColor: 0xb0c4d8,
    fogNear: 100,
    fogFar: 700,
    exposure: 0.75,
    sky: { turbidity: 4, rayleigh: 1.0, mie: 0.003, mieG: 0.78 }
  },
  sunset: {
    // Golden hour — strong orange, dramatic long shadows
    sunIntensity: 1.8,
    sunColor: 0xff8030,
    ambientColor: 0x6a4030,
    ambientIntensity: 0.3,
    hemiSky: 0xffa050,
    hemiGround: 0x3a2a1a,
    hemiIntensity: 0.35,
    fogColor: 0xc07040,
    fogNear: 80,
    fogFar: 500,
    exposure: 1.0,
    sky: { turbidity: 10, rayleigh: 3.0, mie: 0.008, mieG: 0.88 }
  },
  blueHour: {
    // Deep blue/purple — city lights starting to glow
    sunIntensity: 0.3,
    sunColor: 0x3050a0,
    ambientColor: 0x1a2050,
    ambientIntensity: 0.25,
    hemiSky: 0x3040a0,
    hemiGround: 0x1a1020,
    hemiIntensity: 0.3,
    fogColor: 0x1a2040,
    fogNear: 60,
    fogFar: 400,
    exposure: 1.05,
    sky: { turbidity: 6, rayleigh: 2.5, mie: 0.005, mieG: 0.82 }
  },
  night: {
    // Dark — moon + city lights carry the scene
    sunIntensity: 0.0,
    sunColor: 0x1a2030,
    ambientColor: 0x0a0e18,
    ambientIntensity: 0.12,
    hemiSky: 0x101420,
    hemiGround: 0x05060a,
    hemiIntensity: 0.15,
    fogColor: 0x06080e,
    fogNear: 40,
    fogFar: 350,
    exposure: 1.15,
    sky: { turbidity: 2, rayleigh: 0.3, mie: 0.002, mieG: 0.7 }
  },
  preDawn: {
    // Deep blue with orange hint on horizon
    sunIntensity: 0.2,
    sunColor: 0x4030a0,
    ambientColor: 0x101830,
    ambientIntensity: 0.15,
    hemiSky: 0x202840,
    hemiGround: 0x0a0a14,
    hemiIntensity: 0.2,
    fogColor: 0x0c1020,
    fogNear: 50,
    fogFar: 380,
    exposure: 1.1,
    sky: { turbidity: 4, rayleigh: 1.5, mie: 0.004, mieG: 0.75 }
  }
};

export class Environment {
  constructor({ scene, renderer }) {
    this.scene = scene;
    this.renderer = renderer; // THREE.WebGLRenderer

    this.dayLength = 300;
    this.timeOfDay = 0.35; // start at morning
    this.paused = false;

    // === Sky ===
    this.sky = new Sky();
    this.sky.scale.setScalar(2000);
    this.scene.add(this.sky);

    // === Sun ===
    this.sun = new THREE.DirectionalLight(0xffffff, 2.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 350;
    const s = 140;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 6; // soft edges
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // === Ambient (cool fill) ===
    this.ambient = new THREE.AmbientLight(0x3a5070, 0.35);
    this.scene.add(this.ambient);

    // === Hemisphere (sky/ground bounce) ===
    this.hemi = new THREE.HemisphereLight(0x88aacc, 0x4a3a2a, 0.4);
    this.scene.add(this.hemi);

    // === Moon ===
    this.moon = new THREE.DirectionalLight(0x9fb4ff, 0.0);
    this.scene.add(this.moon);

    // === Stars ===
    this._buildStars();

    // === Clouds ===
    this._buildClouds();

    this._sunPos = new THREE.Vector3();
  }

  _buildStars() {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random(), v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const r = 900;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.9 + 80;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.2, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false
    });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  _buildClouds() {
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      depthWrite: false, fog: false
    });
    this.clouds = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const w = 250 + Math.random() * 350;
      const geo = new THREE.PlaneGeometry(w, w * 0.35);
      const cloud = new THREE.Mesh(geo, cloudMat.clone());
      cloud.position.set(
        (Math.random() - 0.5) * 1800,
        200 + Math.random() * 100,
        (Math.random() - 0.5) * 1800
      );
      cloud.rotation.x = -Math.PI / 2;
      cloud.rotation.z = Math.random() * Math.PI * 2;
      cloud.userData.driftSpeed = 0.4 + Math.random() * 0.8;
      this.clouds.add(cloud);
    }
    this.scene.add(this.clouds);
  }

  togglePause() { this.paused = !this.paused; return this.paused; }
  setTimeOfDay(t) { this.timeOfDay = ((t % 1) + 1) % 1; }
  get isNight() { return this.timeOfDay < 0.22 || this.timeOfDay > 0.80; }

  _getPhase() {
    const t = this.timeOfDay;
    if (t < 0.18) return 'preDawn';
    if (t < 0.28) return 'morning';
    if (t < 0.42) return 'morning';
    if (t < 0.58) return 'day';
    if (t < 0.72) return 'day';
    if (t < 0.78) return 'sunset';
    if (t < 0.85) return 'blueHour';
    return 'night';
  }

  _lerpColor(a, b, t) {
    return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
  }

  update(dt) {
    if (!this.paused) {
      this.timeOfDay = (this.timeOfDay + dt / this.dayLength) % 1;
    }

    // Sun arc
    const angle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
    const sunH = Math.sin(angle);
    const sunAz = Math.cos(angle);
    const dist = 400;
    this._sunPos.set(sunAz * dist, sunH * dist, 0.3 * dist);
    this.sky.material.uniforms['sunPosition'].value.copy(this._sunPos);
    this.sun.position.copy(this._sunPos);
    this.sun.target.position.set(0, 0, 0);
    this.moon.position.set(-this._sunPos.x, -this._sunPos.y, -this._sunPos.z);

    // Apply palette
    const phase = this._getPhase();
    const p = PALETTES[phase] || PALETTES.day;

    this.sun.intensity = p.sunIntensity;
    this.sun.color.setHex(p.sunColor);
    this.ambient.color.setHex(p.ambientColor);
    this.ambient.intensity = p.ambientIntensity;
    this.hemi.color.setHex(p.hemiSky);
    this.hemi.groundColor.setHex(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    this.moon.intensity = Math.max(0, -sunH) * 0.35;

    // Sky
    this.sky.material.uniforms['turbidity'].value = p.sky.turbidity;
    this.sky.material.uniforms['rayleigh'].value = p.sky.rayleigh;
    this.sky.material.uniforms['mieCoefficient'].value = p.sky.mie;
    this.sky.material.uniforms['mieDirectionalG'].value = p.sky.mieG;

    // Fog
    if (this.scene.fog) {
      this.scene.fog.color.setHex(p.fogColor);
      if (this.scene.fog instanceof THREE.Fog) {
        this.scene.fog.near = p.fogNear;
        this.scene.fog.far = p.fogFar;
      }
    }
    this.renderer.setClearColor(p.fogColor, 1);

    // Exposure — the key fix for overexposure
    this.renderer.toneMappingExposure = p.exposure;

    // Stars
    const nightFactor = Math.max(0, -sunH);
    this.stars.material.opacity = nightFactor * 0.85;

    // Clouds
    const dayFactor = Math.max(0, sunH);
    for (const cloud of this.clouds.children) {
      cloud.position.x += cloud.userData.driftSpeed * dt;
      if (cloud.position.x > 1000) cloud.position.x = -1000;
      cloud.material.opacity = 0.25 + dayFactor * 0.45;
      if (phase === 'sunset' || phase === 'morning') {
        cloud.material.color.setHex(0xffb070);
      } else if (phase === 'night' || phase === 'blueHour' || phase === 'preDawn') {
        cloud.material.color.setHex(0x3a4868);
      } else {
        cloud.material.color.setHex(0xffffff);
      }
    }
  }
}
