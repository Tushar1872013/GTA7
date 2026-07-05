/**
 * PBRTextures — procedurally generates PBR textures (no external files needed).
 *
 * Generates:
 *   - Asphalt: color + roughness + normal map (with cracks)
 *   - Building glass: color + roughness (reflective)
 *   - Concrete: color + roughness
 *
 * Uses canvas to draw textures, then wraps in THREE.CanvasTexture.
 */
import * as THREE from 'three';

let _cache = {};

export function getAsphaltTexture(size = 512) {
  const key = `asphalt_${size}`;
  if (_cache[key]) return _cache[key];

  // Color map — dark gray with noise
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');

  // Base
  g.fillStyle = '#1a1a1e';
  g.fillRect(0, 0, size, size);

  // Noise texture
  const imgData = g.getImageData(0, 0, size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
    imgData.data[i]     = Math.max(0, Math.min(255, 26 + n));
    imgData.data[i + 1] = Math.max(0, Math.min(255, 26 + n));
    imgData.data[i + 2] = Math.max(0, Math.min(255, 30 + n));
  }
  g.putImageData(imgData, 0, 0);

  // Cracks
  g.strokeStyle = 'rgba(10,10,12,0.6)';
  g.lineWidth = 1;
  for (let i = 0; i < 15; i++) {
    g.beginPath();
    const x = Math.random() * size, y = Math.random() * size;
    g.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      g.lineTo(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80);
    }
    g.stroke();
  }

  // Oil stains
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = 10 + Math.random() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(5,5,8,0.4)');
    grad.addColorStop(1, 'rgba(5,5,8,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

  // Roughness map — same noise but grayscale (asphalt is rough ~0.9)
  const rc = document.createElement('canvas');
  rc.width = rc.height = size;
  const rg = rc.getContext('2d');
  const rData = rg.createImageData(size, size);
  for (let i = 0; i < rData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 30;
    const v = Math.max(0, Math.min(255, 220 + n)); // 0.86 roughness
    rData.data[i] = rData.data[i + 1] = rData.data[i + 2] = v;
    rData.data[i + 3] = 255;
  }
  rg.putImageData(rData, 0, 0);
  const roughTex = new THREE.CanvasTexture(rc);
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;

  _cache[key] = { map: tex, roughnessMap: roughTex };
  return _cache[key];
}

export function getConcreteTexture(size = 256) {
  const key = `concrete_${size}`;
  if (_cache[key]) return _cache[key];

  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#8a8a8a';
  g.fillRect(0, 0, size, size);

  // Noise
  const imgData = g.getImageData(0, 0, size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 15;
    imgData.data[i]     = Math.max(0, Math.min(255, 138 + n));
    imgData.data[i + 1] = Math.max(0, Math.min(255, 138 + n));
    imgData.data[i + 2] = Math.max(0, Math.min(255, 138 + n));
  }
  g.putImageData(imgData, 0, 0);

  // Concrete joints
  g.strokeStyle = 'rgba(60,60,60,0.5)';
  g.lineWidth = 1;
  for (let i = 0; i < size; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, size); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(size, i); g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  _cache[key] = tex;
  return tex;
}

export function getGlassTexture(size = 128) {
  const key = `glass_${size}`;
  if (_cache[key]) return _cache[key];

  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');

  // Dark glass with random lit windows
  g.fillStyle = '#0a0a14';
  g.fillRect(0, 0, size, size);

  const cols = 4, rows = 8;
  const cw = size / cols, ch = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = Math.random();
      if (lit < 0.5) g.fillStyle = '#080810';
      else if (lit < 0.85) g.fillStyle = '#ffd97a';
      else g.fillStyle = '#7ec0ff';
      g.fillRect(col * cw + 2, r * ch + 2, cw - 4, ch - 4);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  _cache[key] = tex;
  return tex;
}
