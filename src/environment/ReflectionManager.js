/**
 * ReflectionManager — environment reflections for vehicles, glass, water.
 *
 * Uses THREE.PMREMGenerator to create an environment map from the Sky shader,
 * then applies it to all PBR materials with metalness > 0.
 *
 * This gives vehicles, building glass, and chrome their realistic reflections
 * without needing actual reflection probes (which are expensive).
 *
 * Updates the env map when the time of day changes significantly.
 */
import * as THREE from 'three';

export class ReflectionManager {
  constructor({ renderer, scene, sky }) {
    this.renderer = renderer.renderer || renderer; // THREE.WebGLRenderer
    this.scene = scene;
    this.sky = sky;

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();

    this.envMap = null;
    this._lastUpdateTime = 0;
    this._updateInterval = 5; // refresh env map every 5 seconds

    // Initial generation
    this._updateEnvMap();
  }

  _updateEnvMap() {
    if (!this.sky) return;
    try {
      // Render the sky to an environment map
      const target = this.pmrem.fromScene(this._getSkyScene(), 0.04);
      if (this.envMap) this.envMap.dispose();
      this.envMap = target.texture;

      // Apply to all materials in the scene
      this.scene.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          // Apply env map to materials with metalness
          if (obj.material.metalness !== undefined && obj.material.metalness > 0) {
            obj.material.envMap = this.envMap;
            obj.material.envMapIntensity = 0.8;
            obj.material.needsUpdate = true;
          }
          // Also apply to glass (transparent materials)
          if (obj.material.transparent && obj.material.metalness !== undefined) {
            obj.material.envMap = this.envMap;
            obj.material.envMapIntensity = 0.5;
            obj.material.needsUpdate = true;
          }
        }
      });

      // Set scene environment
      this.scene.environment = this.envMap;
    } catch (e) {
      console.warn('[ReflectionManager] Failed to update env map:', e.message);
    }
  }

  _getSkyScene() {
    // Create a mini-scene with just the sky for env map rendering
    if (!this._skyScene) {
      this._skyScene = new THREE.Scene();
      this._skyScene.add(this.sky);
    }
    return this._skyScene;
  }

  update(dt) {
    this._lastUpdateTime += dt;
    if (this._lastUpdateTime >= this._updateInterval) {
      this._lastUpdateTime = 0;
      this._updateEnvMap();
    }
  }

  setUpdateInterval(seconds) {
    this._updateInterval = seconds;
  }
}
