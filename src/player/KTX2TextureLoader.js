/**
 * KTX2TextureLoader — KTX2 texture compression pipeline with fallback.
 *
 * Attempts to load KTX2 compressed textures for maximum GPU efficiency.
 * Falls back to CanvasTexture (procedurally generated) if:
 *   - KTX2 file doesn't exist
 *   - KTX2Loader is unavailable
 *   - Browser doesn't support Basis Universal
 *
 * KTX2 benefits:
 *   - 70% smaller GPU memory than uncompressed
 *   - Hardware-decoded on most GPUs
 *   - Supports block compression (ETC1S, UASTC)
 *
 * Usage:
 *   const loader = new KTX2TextureLoader();
 *   const tex = await loader.load('skin_albedo.ktx2', fallbackCanvasTexture);
 */
import * as THREE from 'three';

let _ktx2Loader = null;

export class KTX2TextureLoader {
  constructor() {
    this._cache = new Map();
    this._supported = false;

    // Try to initialize KTX2Loader (available in three.js examples)
    try {
      const { KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js');
      _ktx2Loader = new KTX2Loader();
      _ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/');
      _ktx2Loader.detectSupport(window.__game?.renderer?.renderer || null);
      this._supported = true;
      console.log('[KTX2] Loader initialized, compressed textures supported');
    } catch (e) {
      console.warn('[KTX2] Loader unavailable, using canvas texture fallback:', e.message);
      this._supported = false;
    }
  }

  /**
   * Load a texture — tries KTX2 first, falls back to canvas/procedural.
   * @param {string} ktx2Path - path to .ktx2 file (e.g., '/textures/skin_albedo.ktx2')
   * @param {THREE.Texture} fallback - fallback texture if KTX2 unavailable
   */
  async load(ktx2Path, fallback) {
    // Check cache
    if (this._cache.has(ktx2Path)) return this._cache.get(ktx2Path);

    // If KTX2 not supported, use fallback immediately
    if (!this._supported || !_ktx2Loader) {
      this._cache.set(ktx2Path, fallback);
      return fallback;
    }

    try {
      // Attempt to load KTX2
      const texture = await new Promise((resolve, reject) => {
        _ktx2Loader.load(ktx2Path, resolve, undefined, reject);
      });
      console.log(`[KTX2] Loaded compressed texture: ${ktx2Path}`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      this._cache.set(ktx2Path, texture);
      return texture;
    } catch (e) {
      // KTX2 load failed — use fallback
      console.warn(`[KTX2] Failed to load ${ktx2Path}, using fallback:`, e.message?.substring(0, 80));
      this._cache.set(ktx2Path, fallback);
      return fallback;
    }
  }

  get isSupported() { return this._supported; }
}

// Singleton
let _instance = null;
export async function getKTX2Loader() {
  if (!_instance) _instance = new KTX2TextureLoader();
  return _instance;
}
