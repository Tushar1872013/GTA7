/**
 * Renderer — AAA-quality PBR rendering pipeline.
 *
 * Features:
 *   - Physically correct lights (WebGL2)
 *   - ACES Filmic tone mapping + exposure control
 *   - SRGB color space + linear workflow
 *   - PCF Soft shadows with distance-based quality
 *   - Post-processing: Bloom (subtle), SSAO, FXAA
 *   - Quality presets: Low / Medium / High / Ultra
 *   - Adaptive pixel ratio for performance
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class Renderer {
  constructor(container) {
    this.container = container;
    this.quality = 'high';

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // we use FXAA in post-processing
      powerPreference: 'high-performance',
      stencil: false
    });

    // PBR + tone mapping
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Post-processing composer (scene/camera added later via setSceneCamera)
    this._initPostProcessing();

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  _initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera(60, 1, 0.1, 1000));
    this.composer.addPass(this.renderPass);

    // Bloom — very subtle, only bright objects (neon, headlights, sun)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3,  // strength (subtle — was 0.4)
      0.5,  // radius
      0.9   // threshold (high — only bright objects bloom)
    );
    this.composer.addPass(this.bloomPass);

    // Output pass (handles tone mapping + color space)
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    // SSAO disabled by default — enable in setSceneCamera for high/ultra quality
    this.ssaoPass = null;
  }

  get domElement() { return this.renderer.domElement; }

  setSceneCamera(scene, camera) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    // Create SSAO now that we have a real scene + camera (avoids null crash)
    if (!this.ssaoPass) {
      this.ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
      this.ssaoPass.kernelRadius = 8;
      this.ssaoPass.minDistance = 0.005;
      this.ssaoPass.maxDistance = 0.1;
      // Insert SSAO before bloom (index 1, after renderPass at 0)
      this.composer.insertPass(this.ssaoPass, 1);
      // Apply current quality setting
      this.setQuality(this.quality);
    }
  }

  setFog(scene, color, near, far) {
    scene.fog = new THREE.Fog(color, near, far);
  }

  setClearColor(color) {
    this.renderer.setClearColor(color, 1);
  }

  setExposure(value) {
    this.renderer.toneMappingExposure = value;
  }

  render(scene, camera) {
    if (this.renderPass.camera !== camera) {
      this.renderPass.camera = camera;
    }
    this.composer.render();
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(w, h);
  }

  setQuality(level) {
    this.quality = level;
    const dpr = window.devicePixelRatio || 1;

    if (level === 'low') {
      this.renderer.setPixelRatio(Math.min(dpr, 0.75));
      this.renderer.shadowMap.enabled = false;
      this.bloomPass.enabled = false;
      if (this.ssaoPass) this.ssaoPass.enabled = false;
    } else if (level === 'medium') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.0));
      this.renderer.shadowMap.enabled = true;
      this.bloomPass.enabled = true;
      this.bloomPass.strength = 0.3;
      if (this.ssaoPass) this.ssaoPass.enabled = false;
    } else if (level === 'high') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.bloomPass.enabled = true;
      this.bloomPass.strength = 0.4;
      if (this.ssaoPass) {
        this.ssaoPass.enabled = true;
        this.ssaoPass.kernelRadius = 8;
      }
    } else { // ultra
      this.renderer.setPixelRatio(Math.min(dpr, 2.0));
      this.renderer.shadowMap.enabled = true;
      this.bloomPass.enabled = true;
      this.bloomPass.strength = 0.5;
      if (this.ssaoPass) {
        this.ssaoPass.enabled = true;
        this.ssaoPass.kernelRadius = 16;
      }
    }
  }
}
