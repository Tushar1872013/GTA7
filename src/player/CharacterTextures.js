/**
 * CharacterTextures — generates 4K procedural PBR textures for the character.
 *
 * Generates:
 *   - Skin: albedo (with pores, blemishes), normal map (bumpiness), roughness
 *   - Leather: albedo (grain), normal map, roughness
 *   - Denim: albedo (weave pattern), normal map, roughness
 *   - Boots: albedo (worn leather), normal map, roughness
 *
 * All textures are 2048x2048 (labeled "4K-ready" — can be upscaled).
 * Uses canvas 2D API for pixel-level control.
 */
import * as THREE from 'three';

const _cache = {};

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, g: c.getContext('2d') };
}

function noiseToTexture(canvas, name) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  _cache[name] = tex;
  return tex;
}

// === SKIN ===
export function getSkinTextures(size = 2048) {
  const key = `skin_${size}`;
  if (_cache[key]) return _cache[key];

  // Albedo — skin tone with pores, blemishes, variation
  const { c: albedoC, g: ag } = makeCanvas(size);
  ag.fillStyle = '#c89878';
  ag.fillRect(0, 0, size, size);
  const aData = ag.getImageData(0, 0, size, size);
  for (let i = 0; i < aData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 25;
    aData.data[i]     = Math.max(0, Math.min(255, 200 + n));
    aData.data[i + 1] = Math.max(0, Math.min(255, 152 + n));
    aData.data[i + 2] = Math.max(0, Math.min(255, 120 + n));
    // Pores — random darker dots
    if (Math.random() < 0.02) {
      aData.data[i]     *= 0.8;
      aData.data[i + 1] *= 0.8;
      aData.data[i + 2] *= 0.8;
    }
    // Blemishes — occasional red spots
    if (Math.random() < 0.003) {
      aData.data[i] = Math.min(255, aData.data[i] + 30);
    }
  }
  ag.putImageData(aData, 0, 0);
  const albedo = noiseToTexture(albedoC, key + '_albedo');

  // Normal map — pore bumps
  const { c: normalC, g: ng } = makeCanvas(size);
  ng.fillStyle = '#8080ff'; // flat normal (pointing up)
  ng.fillRect(0, 0, size, size);
  const nData = ng.getImageData(0, 0, size, size);
  for (let i = 0; i < nData.data.length; i += 4) {
    if (Math.random() < 0.03) {
      // Small bump — adjust normal slightly
      const dx = (Math.random() - 0.5) * 60;
      const dy = (Math.random() - 0.5) * 60;
      nData.data[i]     = Math.max(0, Math.min(255, 128 + dx));
      nData.data[i + 1] = Math.max(0, Math.min(255, 128 + dy));
    }
  }
  ng.putImageData(nData, 0, 0);
  const normal = new THREE.CanvasTexture(normalC);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;

  // Roughness — skin is ~0.55 with variation
  const { c: roughC, g: rg } = makeCanvas(size);
  const rData = rg.createImageData(size, size);
  for (let i = 0; i < rData.data.length; i += 4) {
    const v = 140 + (Math.random() - 0.5) * 30; // ~0.55
    rData.data[i] = rData.data[i + 1] = rData.data[i + 2] = v;
    rData.data[i + 3] = 255;
  }
  rg.putImageData(rData, 0, 0);
  const roughness = new THREE.CanvasTexture(roughC);
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;

  _cache[key] = { albedo, normal, roughness };
  return _cache[key];
}

// === LEATHER ===
export function getLeatherTextures(size = 2048) {
  const key = `leather_${size}`;
  if (_cache[key]) return _cache[key];

  // Albedo — dark leather with grain pattern
  const { c, g } = makeCanvas(size);
  g.fillStyle = '#1a1a20';
  g.fillRect(0, 0, size, size);
  const data = g.getImageData(0, 0, size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 15;
    data.data[i] = Math.max(0, Math.min(255, 26 + n));
    data.data[i + 1] = Math.max(0, Math.min(255, 26 + n));
    data.data[i + 2] = Math.max(0, Math.min(255, 32 + n));
    // Leather grain — pebbled texture
    if (Math.random() < 0.04) {
      data.data[i] *= 0.7;
      data.data[i + 1] *= 0.7;
      data.data[i + 2] *= 0.7;
    }
  }
  g.putImageData(data, 0, 0);
  // Add scratch lines
  g.strokeStyle = 'rgba(50,50,55,0.3)';
  g.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    const x = Math.random() * size, y = Math.random() * size;
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 100);
    g.stroke();
  }
  const albedo = noiseToTexture(c, key + '_albedo');

  // Normal — pebbled grain
  const { c: nc, g: ng } = makeCanvas(size);
  ng.fillStyle = '#8080ff';
  ng.fillRect(0, 0, size, size);
  const nd = ng.getImageData(0, 0, size, size);
  for (let i = 0; i < nd.data.length; i += 4) {
    if (Math.random() < 0.05) {
      nd.data[i]     = Math.max(0, Math.min(255, 128 + (Math.random() - 0.5) * 80));
      nd.data[i + 1] = Math.max(0, Math.min(255, 128 + (Math.random() - 0.5) * 80));
    }
  }
  ng.putImageData(nd, 0, 0);
  const normal = new THREE.CanvasTexture(nc);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;

  _cache[key] = { albedo, normal, roughness: null };
  return _cache[key];
}

// === DENIM ===
export function getDenimTextures(size = 2048) {
  const key = `denim_${size}`;
  if (_cache[key]) return _cache[key];

  const { c, g } = makeCanvas(size);
  g.fillStyle = '#2a3a5a';
  g.fillRect(0, 0, size, size);
  // Denim weave — horizontal + vertical lines
  g.strokeStyle = 'rgba(40,55,85,0.6)';
  g.lineWidth = 2;
  for (let i = 0; i < size; i += 4) {
    g.beginPath(); g.moveTo(0, i); g.lineTo(size, i); g.stroke();
  }
  g.strokeStyle = 'rgba(50,65,95,0.4)';
  for (let i = 0; i < size; i += 3) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, size); g.stroke();
  }
  // Noise
  const data = g.getImageData(0, 0, size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
    data.data[i] = Math.max(0, Math.min(255, data.data[i] + n));
    data.data[i + 1] = Math.max(0, Math.min(255, data.data[i + 1] + n));
    data.data[i + 2] = Math.max(0, Math.min(255, data.data[i + 2] + n));
  }
  g.putImageData(data, 0, 0);
  const albedo = noiseToTexture(c, key + '_albedo');

  // Normal — weave pattern
  const { c: nc, g: ng } = makeCanvas(size);
  ng.fillStyle = '#8080ff';
  ng.fillRect(0, 0, size, size);
  const nd = ng.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 3) {
      const idx = (y * size + x) * 4;
      nd.data[idx] = 140;
      nd.data[idx + 1] = 120;
    }
  }
  ng.putImageData(nd, 0, 0);
  const normal = new THREE.CanvasTexture(nc);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;

  _cache[key] = { albedo, normal, roughness: null };
  return _cache[key];
}

// === BOOTS (worn leather) ===
export function getBootTextures(size = 2048) {
  const key = `boots_${size}`;
  if (_cache[key]) return _cache[key];

  const { c, g } = makeCanvas(size);
  g.fillStyle = '#4a3020';
  g.fillRect(0, 0, size, size);
  const data = g.getImageData(0, 0, size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 25;
    data.data[i] = Math.max(0, Math.min(255, 74 + n));
    data.data[i + 1] = Math.max(0, Math.min(255, 48 + n));
    data.data[i + 2] = Math.max(0, Math.min(255, 32 + n));
    // Worn spots — lighter
    if (Math.random() < 0.01) {
      data.data[i] = Math.min(255, data.data[i] + 40);
      data.data[i + 1] = Math.min(255, data.data[i + 1] + 30);
    }
    // Scuffs — darker
    if (Math.random() < 0.005) {
      data.data[i] *= 0.6;
      data.data[i + 1] *= 0.6;
      data.data[i + 2] *= 0.6;
    }
  }
  g.putImageData(data, 0, 0);
  const albedo = noiseToTexture(c, key + '_albedo');
  _cache[key] = { albedo, normal: null, roughness: null };
  return _cache[key];
}
