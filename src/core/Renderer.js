/**
 * Renderer — AAA-quality PBR rendering pipeline.
 *
 * Features:
 *   - Physically correct lights (WebGL2)
 *   - ACES Filmic tone mapping + exposure control
 *   - SRGB color space + linear workflow
 *   - PCF Soft shadows with distance-based quality
 *   - Post-processing: FXAA, Bloom (subtle), SSAO, Output
 *   - Phase C4 stylistic passes: per-district color-grade LUT, vignette, film grain
 *   - Quality presets: Low / Medium / High / Ultra
 *   - Adaptive pixel ratio for performance
 *
 * Bloom tuning (Part 1 fix):
 *   - Strength reduced to 0.15-0.25 (was 0.3-0.5)
 *   - Threshold raised to 0.95 (was 0.9) — only very bright objects bloom
 *   - Radius reduced to 0.3 for tighter glow
 *   - Prevents white bloom washing out the whole scene
 *
 * Phase C4 stylistic pass order (after OutputPass, in display space):
 *   OutputPass (tone map + sRGB) → LUTPass (per-district color grade) →
 *   Vignette (cinematic edge darkening) → FilmPass (subtle grain + scanlines)
 *
 *   These run AFTER tone mapping because they operate on display-space colors:
 *     - LUT remaps final RGB values per district mood
 *     - Vignette darkens edges in display space (looks wrong in HDR linear)
 *     - Film grain masks banding in gradients that only appear after quantization
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { LUTPass } from 'three/examples/jsm/postprocessing/LUTPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { generateDistrictLUTs } from '../environment/DistrictLUTs.js';

export class Renderer {
  constructor(container) {
    this.container = container;
    this.quality = 'high';

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // we use FXAA in post-processing
      powerPreference: 'high-performance',
      stencil: false,   // no stencil buffer effects in this game — saves memory bandwidth
      depth: true,      // Phase A5 — explicit (true is the default, but pinned for clarity)
    });

    // PBR + tone mapping
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9; // slightly under 1.0 for richer look

    // Shadows — soft, optimized
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Phase C4c — Generate procedural per-district LUT textures once.
    // Returns a map of districtName -> DataTexture (3D LUT via 2D tile sheet).
    this._districtLUTs = generateDistrictLUTs();
    this._currentLUTDistrict = null;

    // Post-processing composer (scene/camera added later via setSceneCamera)
    this._initPostProcessing();

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  _initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera(60, 1, 0.1, 1000));
    this.composer.addPass(this.renderPass);

    // SSAO — subtle ambient occlusion (inserted later when scene is ready)
    this.ssaoPass = null;

    // Bloom — VERY subtle, only very bright objects (neon, headlights, sun)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.2,  // strength (subtle — was 0.3)
      0.3,  // radius (tighter)
      0.95  // threshold (high — only very bright objects bloom)
    );
    this.composer.addPass(this.bloomPass);

    // FXAA — anti-aliasing pass
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.material.uniforms['resolution'].value.set(
      1 / window.innerWidth, 1 / window.innerHeight
    );
    this.composer.addPass(this.fxaaPass);

    // Output pass (handles tone mapping + color space).
    // Phase C4 stylistic passes run AFTER this, in display space.
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    // Phase C4c — Per-district color-grade LUT.
    // intensity starts at 0 until setDistrictLUT() is called by Game._update
    // with the player's current district. This way the LUT is purely additive
    // — if Game never wires it up, the pass is a no-op.
    this.lutPass = new LUTPass();
    this.lutPass.intensity = 0.0;
    this.lutPass.enabled = false; // enabled on first setDistrictLUT() call
    this.composer.addPass(this.lutPass);

    // Phase C4a — Vignette (cinematic edge darkening).
    // Subtle: offset 1.0 (radial falloff reach), darkness 0.95 (max edge dim).
    // These are eskil-style vignette params; values close to 1.0 = subtle.
    this.vignettePass = new ShaderPass(VignetteShader);
    this.vignettePass.material.uniforms['offset'].value = 1.0;
    this.vignettePass.material.uniforms['darkness'].value = 0.95;
    this.composer.addPass(this.vignettePass);

    // Phase C4b — Film grain (subtle). Masks banding in sky/bloom gradients
    // at negligible cost. intensity 0.25 = barely visible noise; grayscale=false
    // keeps color noise (more filmic than grayscale static).
    this.filmPass = new FilmPass(0.25, false);
    this.composer.addPass(this.filmPass);
  }

  get domElement() { return this.renderer.domElement; }

  setSceneCamera(scene, camera) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    // Create SSAO now that we have a real scene + camera
    if (!this.ssaoPass) {
      this.ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
      this.ssaoPass.kernelRadius = 8;
      this.ssaoPass.minDistance = 0.005;
      this.ssaoPass.maxDistance = 0.1;
      // Insert SSAO right after render pass (index 1)
      this.composer.insertPass(this.ssaoPass, 1);
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

  /**
   * Phase C4c — Switch the active color-grade LUT based on the player's
   * current district. Called by Game._update whenever the district changes.
   *
   * @param {string} districtName - one of: 'Desert', 'Dubai Downtown',
   *   'Airport', 'Highway', 'Tokyo District', 'Mountain Roads', 'Village Area'
   */
  setDistrictLUT(districtName) {
    if (!districtName || districtName === this._currentLUTDistrict) return;
    const lut = this._districtLUTs.get(districtName);
    if (!lut) return;
    this._currentLUTDistrict = districtName;
    this.lutPass.lut = lut;
    this.lutPass.lutSize = 16; // matches generateDistrictLUTs() resolution
    this.lutPass.intensity = 0.6; // 60% blend — strong enough to read, not so strong it looks filtered
    this.lutPass.enabled = true;
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
    if (this.ssaoPass) this.ssaoPass.setSize(w, h);
    this.fxaaPass.material.uniforms['resolution'].value.set(1 / w, 1 / h);
  }

  setQuality(level) {
    this.quality = level;
    const dpr = window.devicePixelRatio || 1;

    // SSAO is intentionally off for low/medium; only high/ultra enable the pass.
    // Phase C4 stylistic passes (LUT, vignette, film) follow the same gating:
    // off on low (full-screen passes are expensive on mobile), on for medium+.
    if (level === 'low') {
      this.renderer.setPixelRatio(Math.min(dpr, 0.75));
      this.renderer.shadowMap.enabled = false;
      this.bloomPass.enabled = false;
      this.fxaaPass.enabled = true;
      if (this.ssaoPass) this.ssaoPass.enabled = false;
      this.lutPass.enabled = false;
      this.vignettePass.enabled = false;
      this.filmPass.enabled = false;
    } else if (level === 'medium') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.0));
      this.renderer.shadowMap.enabled = true;
      this.bloomPass.enabled = true;
      this.bloomPass.strength = 0.15;
      this.fxaaPass.enabled = true;
      if (this.ssaoPass) this.ssaoPass.enabled = false;
      // Medium: keep LUT + vignette (cheap, big visual value), drop film grain (noisiest)
      if (this._currentLUTDistrict) this.lutPass.enabled = true;
      this.vignettePass.enabled = true;
      this.filmPass.enabled = false;
    } else if (level === 'high') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.bloomPass.enabled = true;
      this.bloomPass.strength = 0.2;
      this.fxaaPass.enabled = true;
      if (this.ssaoPass) {
        this.ssaoPass.enabled = true;
        this.ssaoPass.kernelRadius = 8;
      }
      if (this._currentLUTDistrict) this.lutPass.enabled = true;
      this.vignettePass.enabled = true;
      this.filmPass.enabled = true;
      this.filmPass.uniforms.intensity.value = 0.2;
    } else { // ultra
      this.renderer.setPixelRatio(Math.min(dpr, 2.0));
      this.renderer.shadowMap.enabled = true;
      this.bloomPass.enabled = true;
      this.bloomPass.strength = 0.25;
      this.fxaaPass.enabled = true;
      if (this.ssaoPass) {
        this.ssaoPass.enabled = true;
        this.ssaoPass.kernelRadius = 16;
      }
      if (this._currentLUTDistrict) this.lutPass.enabled = true;
      this.vignettePass.enabled = true;
      this.filmPass.enabled = true;
      this.filmPass.uniforms.intensity.value = 0.25;
    }
  }
}
