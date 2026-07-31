/**
 * DistrictLUTs — Phase C4c procedural per-district color-grade LUTs.
 *
 * Generates a 16x16x16 3D LUT (stored as a 2D tile sheet: width=16, height=256)
 * for each of the 7 districts. Each LUT applies a subtle color grade that
 * reinforces the district's mood, pairing with the per-district hemisphere
 * lighting from Phase B4 (Environment.js PALETTES).
 *
 * District moods:
 *   Desert         — warm sandy push, slightly desaturated, golden highlights
 *   Dubai Downtown — bright, cool luxury, slight contrast boost, teal shadows
 *   Airport        — neutral, slight cool, high contrast (industrial feel)
 *   Highway        — neutral baseline (closest to identity LUT)
 *   Tokyo District — cool/neon push, magenta-cyan split, slightly crushed blacks
 *   Mountain Roads — desaturated, cool, lifted blacks (misty/hazy)
 *   Village Area   — warm golden hour, slight green push, soft contrast
 *
 * Format note:
 *   Three.js LUTPass expects a 2D texture where:
 *     - width = lutSize (16) — one row of the 3D LUT
 *     - height = lutSize² (256) — all slices stacked vertically
 *     - lutSize uniform is set from texture.image.width by LUTPass.js
 *   Each pixel (x, y) maps to LUT entry [r=x, g=y%16, b=y/16].
 *   We generate this as a DataTexture with RGBA format.
 *
 * Design choices:
 *   - Procedural generation (no external .png files needed) — keeps the
 *     deliverable self-contained and avoids asset pipeline complexity.
 *   - Each LUT is a subtle deviation from identity. intensity=0.6 in the
 *     Renderer means the grade is 60% applied — strong enough to read
 *     the mood shift when crossing district boundaries, not so strong
 *     it looks like an Instagram filter.
 *   - Identity LUT (no change) is the baseline; district grades are
 *     composed as: identity + districtTint(rgb).
 */
import * as THREE from 'three';

const LUT_SIZE = 16;

/**
 * District color grade definitions. Each grade is a function that takes
 * [r, g, b] in [0, 1] and returns the graded [r, g, b].
 *
 * The functions are intentionally subtle — they shift hue/sat/value by
 * small amounts so the grade reads as "mood" not "filter".
 */
const DISTRICT_GRADES = {
  'Desert': (r, g, b) => {
    // Warm sandy push: shift toward orange/yellow, slightly desaturate blues
    const warmth = 0.08;
    const sat = 0.92; // slight desaturation
    const avg = (r + g + b) / 3;
    return [
      r + warmth + (r - avg) * (sat - 1),
      g + warmth * 0.6 + (g - avg) * (sat - 1),
      b - warmth * 0.4 + (b - avg) * (sat - 1) // blues pulled toward gray
    ];
  },
  'Dubai Downtown': (r, g, b) => {
    // Bright luxury: slight contrast boost, teal shadow push
    const contrast = 1.08;
    const shadowTeal = 0.03;
    return [
      (r - 0.5) * contrast + 0.5,
      (g - 0.5) * contrast + 0.5 + shadowTeal * (1 - r),
      (b - 0.5) * contrast + 0.5 + shadowTeal * 1.5 * (1 - r)
    ];
  },
  'Airport': (r, g, b) => {
    // Neutral industrial: high contrast, slight cool
    const contrast = 1.12;
    const cool = 0.02;
    return [
      (r - 0.5) * contrast + 0.5,
      (g - 0.5) * contrast + 0.5,
      (b - 0.5) * contrast + 0.5 + cool
    ];
  },
  'Highway': (r, g, b) => {
    // Near-identity — highway is the neutral connective tissue between districts
    return [r, g, b];
  },
  'Tokyo District': (r, g, b) => {
    // Neon mood: magenta-cyan split, slightly crushed blacks
    const crushedBlacks = r < 0.2 ? r * 0.85 : r;
    return [
      crushedBlacks + 0.04,  // slight red lift for neon signage bleed
      crushedBlacks + 0.02,  // cyan
      b + 0.06               // stronger blue push (Tokyo neon = cyan/magenta)
    ];
  },
  'Mountain Roads': (r, g, b) => {
    // Misty/desaturated: lifted blacks, cool, low saturation
    const liftedBlacks = 0.05;
    const sat = 0.78;
    const avg = (r + g + b) / 3;
    return [
      (r + liftedBlacks - avg * 0.05) * sat + avg * 0.05,
      (g + liftedBlacks - avg * 0.05) * sat + avg * 0.05,
      (b + liftedBlacks - avg * 0.05) * sat + avg * 0.05 + 0.03
    ];
  },
  'Village Area': (r, g, b) => {
    // Golden hour: warm overall, slight green push, soft contrast
    const golden = 0.06;
    const contrast = 0.96; // softer than default
    return [
      (r - 0.5) * contrast + 0.5 + golden,
      (g - 0.5) * contrast + 0.5 + golden * 0.7,
      (b - 0.5) * contrast + 0.5 - golden * 0.5
    ];
  }
};

/**
 * Generate a single LUT DataTexture for the given district grade function.
 * Format: width=LUT_SIZE (16), height=LUT_SIZE² (256), RGBA.
 *
 * Pixel (x, y) stores the graded color for input [r=x/15, g=(y%16)/15, b=(y/16)/15].
 * (The /15 is because a 16-entry LUT has indices 0..15, mapping to [0, 1].)
 */
function _generateLUT(gradeFn) {
  const width = LUT_SIZE;
  const height = LUT_SIZE * LUT_SIZE; // 256
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const bIdx = Math.floor(y / LUT_SIZE); // 0..15
    const gIdx = y % LUT_SIZE;             // 0..15
    for (let x = 0; x < width; x++) {
      const rIdx = x;                       // 0..15
      const r = rIdx / (LUT_SIZE - 1);
      const g = gIdx / (LUT_SIZE - 1);
      const b = bIdx / (LUT_SIZE - 1);

      let [rr, gg, bb] = gradeFn(r, g, b);
      // Clamp to [0, 1]
      rr = Math.max(0, Math.min(1, rr));
      gg = Math.max(0, Math.min(1, gg));
      bb = Math.max(0, Math.min(1, bb));

      const pixIdx = (y * width + x) * 4;
      data[pixIdx]     = Math.round(rr * 255);
      data[pixIdx + 1] = Math.round(gg * 255);
      data[pixIdx + 2] = Math.round(bb * 255);
      data[pixIdx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generate all 7 district LUTs. Returns a Map<districtName, DataTexture>.
 * Called once by the Renderer constructor; cached for the lifetime of the game.
 */
export function generateDistrictLUTs() {
  const map = new Map();
  for (const [name, gradeFn] of Object.entries(DISTRICT_GRADES)) {
    map.set(name, _generateLUT(gradeFn));
  }
  return map;
}

/**
 * The list of district names that have LUTs. Matches the names used by
 * World.js's _buildGround() district registration.
 */
export const DISTRICT_NAMES = Object.keys(DISTRICT_GRADES);
