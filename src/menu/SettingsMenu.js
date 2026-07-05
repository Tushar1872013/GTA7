/**
 * SettingsMenu — graphics, audio, controls settings with LocalStorage.
 */
export class SettingsMenu {
  constructor() {
    this.settings = this._load();

    this.el = document.createElement('div');
    this.el.className = 'submenu-overlay';
    this.el.innerHTML = `
      <div class="submenu-panel">
        <div class="submenu-header">
          <h2>SETTINGS</h2>
          <button class="submenu-close">✕</button>
        </div>
        <div class="settings-tabs">
          <button class="settings-tab active" data-tab="graphics">Graphics</button>
          <button class="settings-tab" data-tab="audio">Audio</button>
          <button class="settings-tab" data-tab="controls">Controls</button>
          <button class="settings-tab" data-tab="language">Language</button>
        </div>
        <div class="settings-body" id="settings-body">
          ${this._renderGraphics()}
        </div>
      </div>
    `;
    document.body.appendChild(this.el);
    requestAnimationFrame(() => this.el.classList.add('visible'));

    this.el.querySelector('.submenu-close').onclick = () => this.close();
    this.el.querySelectorAll('.settings-tab').forEach(t => {
      t.onclick = () => {
        this.el.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
        t.classList.add('active');
        this.el.querySelector('#settings-body').innerHTML = this._renderTab(t.dataset.tab);
        this._bindControls();
      };
    });
    this._bindControls();
  }

  _renderTab(tab) {
    if (tab === 'graphics') return this._renderGraphics();
    if (tab === 'audio') return this._renderAudio();
    if (tab === 'controls') return this._renderControls();
    if (tab === 'language') return this._renderLanguage();
    return '';
  }

  _renderGraphics() {
    const s = this.settings.graphics;
    return `
      <div class="setting-row">
        <label>Quality Preset</label>
        <select data-key="graphics.quality">
          <option value="low" ${s.quality==='low'?'selected':''}>Low (FXAA only)</option>
          <option value="medium" ${s.quality==='medium'?'selected':''}>Medium (FXAA + Bloom)</option>
          <option value="high" ${s.quality==='high'?'selected':''}>High (FXAA + Bloom + SSAO)</option>
          <option value="ultra" ${s.quality==='ultra'?'selected':''}>Ultra (Everything)</option>
        </select>
      </div>
      <div class="setting-row">
        <label>Resolution Scale: <span id="rs-val">${Math.round(s.resolutionScale*100)}%</span></label>
        <input type="range" min="0.5" max="1.5" step="0.05" value="${s.resolutionScale}" data-key="graphics.resolutionScale">
      </div>
      <div class="setting-row">
        <label>Shadows</label>
        <input type="checkbox" data-key="graphics.shadows" ${s.shadows?'checked':''}>
      </div>
      <div class="setting-row">
        <label>Shadow Quality</label>
        <select data-key="graphics.shadowQuality">
          <option value="low" ${s.shadowQuality==='low'?'selected':''}>Low (1024)</option>
          <option value="medium" ${s.shadowQuality==='medium'?'selected':''}>Medium (2048)</option>
          <option value="high" ${s.shadowQuality==='high'?'selected':''}>High (4096)</option>
        </select>
      </div>
      <div class="setting-row">
        <label>Bloom</label>
        <input type="checkbox" data-key="graphics.bloom" ${s.bloom?'checked':''}>
      </div>
      <div class="setting-row">
        <label>Bloom Strength: <span id="bs-val">${s.bloomStrength.toFixed(1)}</span></label>
        <input type="range" min="0" max="1.5" step="0.1" value="${s.bloomStrength}" data-key="graphics.bloomStrength">
      </div>
      <div class="setting-row">
        <label>SSAO (Ambient Occlusion)</label>
        <input type="checkbox" data-key="graphics.ssao" ${s.ssao?'checked':''}>
      </div>
      <div class="setting-row">
        <label>Fog</label>
        <input type="checkbox" data-key="graphics.fog" ${s.fog?'checked':''}>
      </div>
      <div class="setting-row">
        <label>Particles (Rain/Dust)</label>
        <input type="checkbox" data-key="graphics.particles" ${s.particles?'checked':''}>
      </div>
      <div class="setting-row">
        <label>Draw Distance: <span id="dd-val">${s.drawDistance}m</span></label>
        <input type="range" min="100" max="800" value="${s.drawDistance}" data-key="graphics.drawDistance">
      </div>
      <div class="setting-row">
        <label>FOV: <span id="fov-val">${s.fov}°</span></label>
        <input type="range" min="60" max="100" value="${s.fov}" data-key="graphics.fov">
      </div>
      <div class="setting-row">
        <label>FPS Limit</label>
        <select data-key="graphics.fpsLimit">
          <option value="30" ${s.fpsLimit===30?'selected':''}>30 FPS</option>
          <option value="60" ${s.fpsLimit===60?'selected':''}>60 FPS</option>
          <option value="120" ${s.fpsLimit===120?'selected':''}>120 FPS</option>
          <option value="0" ${s.fpsLimit===0?'selected':''}>Unlimited</option>
        </select>
      </div>
      <div class="setting-row">
        <label>VSync</label>
        <input type="checkbox" data-key="graphics.vsync" ${s.vsync?'checked':''}>
      </div>
      <div class="setting-row">
        <label>Anti-Aliasing</label>
        <select data-key="graphics.aa">
          <option value="off" ${s.aa==='off'?'selected':''}>Off</option>
          <option value="fxaa" ${s.aa==='fxaa'?'selected':''}>FXAA</option>
          <option value="msaa" ${s.aa==='msaa'?'selected':''}>MSAA 4x</option>
        </select>
      </div>
    `;
  }

  _renderAudio() {
    const s = this.settings.audio;
    return `
      <div class="setting-row">
        <label>Master Volume: <span id="mv-val">${s.master}%</span></label>
        <input type="range" min="0" max="100" value="${s.master}" data-key="audio.master">
      </div>
      <div class="setting-row">
        <label>Engine Volume: <span id="ev-val">${s.engine}%</span></label>
        <input type="range" min="0" max="100" value="${s.engine}" data-key="audio.engine">
      </div>
      <div class="setting-row">
        <label>Music Volume: <span id="mu-val">${s.music}%</span></label>
        <input type="range" min="0" max="100" value="${s.music}" data-key="audio.music">
      </div>
      <div class="setting-row">
        <label>SFX Volume: <span id="sf-val">${s.sfx}%</span></label>
        <input type="range" min="0" max="100" value="${s.sfx}" data-key="audio.sfx">
      </div>
    `;
  }

  _renderControls() {
    const s = this.settings.controls;
    return `
      <div class="setting-row">
        <label>Mouse Sensitivity: <span id="ms-val">${s.sensitivity}</span></label>
        <input type="range" min="0.1" max="3" step="0.1" value="${s.sensitivity}" data-key="controls.sensitivity">
      </div>
      <div class="setting-row">
        <label>Invert Y</label>
        <input type="checkbox" data-key="controls.invertY" ${s.invertY?'checked':''}>
      </div>
      <div class="setting-row">
        <label>Auto-center Camera</label>
        <input type="checkbox" data-key="controls.autoCenter" ${s.autoCenter?'checked':''}>
      </div>
    `;
  }

  _renderLanguage() {
    const s = this.settings.language;
    return `
      <div class="setting-row">
        <label>Language</label>
        <select data-key="language.code">
          <option value="en" ${s.code==='en'?'selected':''}>English</option>
          <option value="hi" ${s.code==='hi'?'selected':''}>हिन्दी (Hindi)</option>
          <option value="ja" ${s.code==='ja'?'selected':''}>日本語 (Japanese)</option>
          <option value="ar" ${s.code==='ar'?'selected':''}>العربية (Arabic)</option>
        </select>
      </div>
    `;
  }

  _bindControls() {
    this.el.querySelectorAll('[data-key]').forEach(input => {
      const key = input.dataset.key;
      input.onchange = input.oninput = () => {
        let val;
        if (input.type === 'checkbox') val = input.checked;
        else if (input.type === 'range') val = parseFloat(input.value);
        else if (input.type === 'number') val = parseInt(input.value);
        else val = input.value;
        this._set(key, val);
        // Update display labels
        const valEl = this.el.querySelector('#' + key.split('.').pop().replace(/([A-Z])/g, '-$1').toLowerCase() + '-val');
        if (key === 'graphics.resolutionScale') this.el.querySelector('#rs-val').textContent = Math.round(val*100) + '%';
        if (key === 'graphics.drawDistance') this.el.querySelector('#dd-val').textContent = val + 'm';
        if (key === 'graphics.fov') this.el.querySelector('#fov-val').textContent = val + '°';
        if (key === 'graphics.bloomStrength') this.el.querySelector('#bs-val').textContent = val.toFixed(1);
        if (key === 'audio.master') this.el.querySelector('#mv-val').textContent = val + '%';
        if (key === 'audio.engine') this.el.querySelector('#ev-val').textContent = val + '%';
        if (key === 'audio.music') this.el.querySelector('#mu-val').textContent = val + '%';
        if (key === 'audio.sfx') this.el.querySelector('#sf-val').textContent = val + '%';
        if (key === 'controls.sensitivity') this.el.querySelector('#ms-val').textContent = val;
        // Apply to live game if it exists
        this._applyToGame(key, val);
        this._save();
      };
    });
  }

  _applyToGame(key, val) {
    const g = window.__game;
    if (!g) return;
    if (key === 'graphics.quality') g.renderer.setQuality(val);
    if (key === 'graphics.shadows') g.renderer.renderer.shadowMap.enabled = val;
    if (key === 'graphics.bloom') g.renderer.bloomPass.enabled = val;
    if (key === 'graphics.bloomStrength') g.renderer.bloomPass.strength = val;
    if (key === 'graphics.ssao' && g.renderer.ssaoPass) g.renderer.ssaoPass.enabled = val;
    if (key === 'graphics.fog') g.scene.fog = val ? g.scene.fog || new THREE.Fog(0x6a82a8, 80, 450) : null;
    if (key === 'graphics.fov') { g.camera.fov = val; g.camera.updateProjectionMatrix(); }
    if (key === 'graphics.drawDistance' && g.distanceCuller) g.distanceCuller.drawDistance = val;
    if (key === 'graphics.resolutionScale') {
      const dpr = window.devicePixelRatio || 1;
      g.renderer.renderer.setPixelRatio(Math.min(dpr, 2.0) * val);
    }
  }

  _get(key) {
    return key.split('.').reduce((o, k) => o[k], this.settings);
  }

  _set(key, val) {
    const parts = key.split('.');
    const last = parts.pop();
    const obj = parts.reduce((o, k) => o[k], this.settings);
    obj[last] = val;
  }

  _load() {
    try {
      const saved = localStorage.getItem('gta7_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      graphics: {
        quality: 'high', shadows: true, shadowQuality: 'medium',
        bloom: true, bloomStrength: 0.4, ssao: true, fog: true, particles: true,
        drawDistance: 350, fov: 75, resolutionScale: 1.0,
        fpsLimit: 60, vsync: true, aa: 'fxaa'
      },
      audio: { master: 80, engine: 70, music: 50, sfx: 75 },
      controls: { sensitivity: 1.0, invertY: false, autoCenter: true },
      language: { code: 'en' }
    };
  }

  _save() {
    try { localStorage.setItem('gta7_settings', JSON.stringify(this.settings)); } catch (e) {}
  }

  close() {
    this.el.classList.remove('visible');
    setTimeout(() => this.el.remove(), 300);
  }
}
