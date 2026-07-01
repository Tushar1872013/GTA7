/**
 * CharacterCustomizer — Phase 4
 *
 * Allows the player to customize their character's appearance:
 *   - Skin tone (5 options)
 *   - Shirt color (8 options)
 *   - Pants color (5 options)
 *   - Hair style + color (4 styles × 6 colors)
 *   - Helmet (on/off + color)
 *
 * Rebuilds the player mesh parts dynamically. Opens a UI panel with
 * color swatches and option buttons.
 */
import * as THREE from 'three';

export class CharacterCustomizer {
  constructor({ player, hud }) {
    this.player = player;
    this.hud = hud;
    this.open = false;

    this.options = {
      skin: 0,
      shirt: 0,
      pants: 0,
      hairStyle: 0,
      hairColor: 0,
      helmet: 1, // 1 = on (default for rider)
      helmetColor: 0
    };

    this.palettes = {
      skin: [0xf0c090, 0xe6b88a, 0xc69569, 0x8d5524, 0xffdbac],
      shirt: [0x2a4d8f, 0xe53935, 0x2e7d32, 0xfbc02d, 0x7b1fa2, 0x00838f, 0x212121, 0xfafafa],
      pants: [0x1a1a2e, 0x4a2f1a, 0x2c3e50, 0x555555, 0x6b4423],
      hairColor: [0x2a1810, 0x000000, 0x8b4513, 0xd4a017, 0xb22222, 0x708090],
      helmetColor: [0xffd54f, 0xe53935, 0x1976d2, 0x2e7d32, 0x212121, 0xfafafa]
    };

    this.hairStyles = ['short', 'long', 'spiky', 'bald'];

    this._buildUI();
    this.apply();
  }

  _buildUI() {
    const panel = document.createElement('div');
    panel.id = 'customizer';
    panel.style.cssText = `
      position: fixed; inset: 0; z-index: 200;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
      display: none; align-items: center; justify-content: center;
      pointer-events: auto;
    `;
    panel.innerHTML = `
      <div style="background:linear-gradient(135deg,#1a2540,#0a0e1a);border:2px solid #4fc3f7;border-radius:16px;padding:32px;width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 0 60px rgba(79,195,247,0.3);">
        <h2 style="color:#4fc3f7;margin:0 0 8px;font-size:24px;letter-spacing:2px;">CHARACTER</h2>
        <p style="color:#7a8db0;margin:0 0 24px;font-size:13px;">Customize your appearance</p>

        <div id="cust-sections" style="display:flex;flex-direction:column;gap:20px;"></div>

        <div style="display:flex;gap:12px;margin-top:28px;">
          <button id="cust-random" style="flex:1;padding:12px;background:rgba(79,195,247,0.15);border:1px solid #4fc3f7;color:#4fc3f7;border-radius:8px;cursor:pointer;font-weight:600;letter-spacing:1px;">RANDOM</button>
          <button id="cust-save" style="flex:2;padding:12px;background:linear-gradient(90deg,#4fc3f7,#1976d2);border:none;color:#fff;border-radius:8px;cursor:pointer;font-weight:700;letter-spacing:1px;">SAVE & CLOSE</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    this.panel = panel;
    this.sectionsEl = panel.querySelector('#cust-sections');

    panel.querySelector('#cust-save').onclick = () => this.toggle(false);
    panel.querySelector('#cust-random').onclick = () => this._randomize();

    this._buildSections();
  }

  _buildSections() {
    const sections = [
      { key: 'skin', label: 'SKIN TONE', type: 'color', max: 5 },
      { key: 'shirt', label: 'SHIRT', type: 'color', max: 8 },
      { key: 'pants', label: 'PANTS', type: 'color', max: 5 },
      { key: 'hairStyle', label: 'HAIR STYLE', type: 'option', options: this.hairStyles },
      { key: 'hairColor', label: 'HAIR COLOR', type: 'color', max: 6 },
      { key: 'helmet', label: 'HELMET', type: 'toggle' },
      { key: 'helmetColor', label: 'HELMET COLOR', type: 'color', max: 6 }
    ];

    for (const s of sections) {
      const div = document.createElement('div');
      div.innerHTML = `<div style="color:#ffd54f;font-size:11px;letter-spacing:1px;margin-bottom:8px;">${s.label}</div>`;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

      if (s.type === 'color') {
        for (let i = 0; i < s.max; i++) {
          const sw = document.createElement('button');
          const color = this.palettes[s.key][i];
          sw.style.cssText = `width:32px;height:32px;border-radius:50%;border:2px solid ${i === this.options[s.key] ? '#fff' : 'transparent'};background:#${color.toString(16).padStart(6,'0')};cursor:pointer;`;
          sw.onclick = () => {
            this.options[s.key] = i;
            this.apply();
            this._buildSections();
          };
          row.appendChild(sw);
        }
      } else if (s.type === 'option') {
        for (let i = 0; i < s.options.length; i++) {
          const btn = document.createElement('button');
          btn.textContent = s.options[i].toUpperCase();
          btn.style.cssText = `padding:8px 16px;border-radius:6px;border:1px solid ${i === this.options[s.key] ? '#fff' : 'rgba(255,255,255,0.2)'};background:${i === this.options[s.key] ? 'rgba(79,195,247,0.3)' : 'rgba(255,255,255,0.05)'};color:#fff;cursor:pointer;font-size:11px;text-transform:uppercase;`;
          btn.onclick = () => {
            this.options[s.key] = i;
            this.apply();
            this._buildSections();
          };
          row.appendChild(btn);
        }
      } else if (s.type === 'toggle') {
        const btn = document.createElement('button');
        const on = this.options[s.key] === 1;
        btn.textContent = on ? 'ON' : 'OFF';
        btn.style.cssText = `padding:8px 32px;border-radius:6px;border:1px solid ${on ? '#4caf50' : '#666'};background:${on ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.05)'};color:${on ? '#4caf50' : '#999'};cursor:pointer;font-weight:700;font-size:14px;`;
        btn.onclick = () => {
          this.options[s.key] = on ? 0 : 1;
          this.apply();
          this._buildSections();
        };
        row.appendChild(btn);
      }

      div.appendChild(row);
      // Replace existing section if re-building
      const existing = this.sectionsEl.querySelector(`[data-key="${s.key}"]`);
      const wrapper = document.createElement('div');
      wrapper.dataset.key = s.key;
      wrapper.innerHTML = div.innerHTML;
      wrapper.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
      // Re-attach handlers (innerHTML loses them)
      wrapper.querySelectorAll('button').forEach((btn, i) => {
        btn.onclick = () => {
          if (s.type === 'color') {
            this.options[s.key] = i;
          } else if (s.type === 'option') {
            this.options[s.key] = i;
          } else if (s.type === 'toggle') {
            this.options[s.key] = this.options[s.key] === 1 ? 0 : 1;
          }
          this.apply();
          this._buildSections();
        };
      });
      if (existing) existing.replaceWith(wrapper);
      else this.sectionsEl.appendChild(wrapper);
    }
  }

  _randomize() {
    this.options.skin = Math.floor(Math.random() * 5);
    this.options.shirt = Math.floor(Math.random() * 8);
    this.options.pants = Math.floor(Math.random() * 5);
    this.options.hairStyle = Math.floor(Math.random() * 4);
    this.options.hairColor = Math.floor(Math.random() * 6);
    this.options.helmet = Math.random() < 0.7 ? 1 : 0;
    this.options.helmetColor = Math.floor(Math.random() * 6);
    this.apply();
    this._buildSections();
  }

  toggle(force) {
    this.open = force !== undefined ? force : !this.open;
    this.panel.style.display = this.open ? 'flex' : 'none';
    if (this.open) this._buildSections();
  }

  /**
   * Apply current options to the player mesh.
   * Replaces materials on the player's body parts.
   */
  apply() {
    const p = this.player;
    if (!p.parts) return;

    // Skin — apply to head, neck, ears, nose, hands
    const skinColor = this.palettes.skin[this.options.skin];
    const skinParts = ['head', 'neck', 'earL', 'earR', 'nose', 'handL', 'handR'];
    for (const key of skinParts) {
      if (p.parts[key]) p.parts[key].material.color.setHex(skinColor);
    }

    // Shirt (collar) color
    if (p.parts.collar) p.parts.collar.material.color.setHex(this.palettes.shirt[this.options.shirt]);

    // Jacket (torso + arms) — use shirt palette slot for jacket color
    const jacketColor = this.palettes.shirt[this.options.shirt];
    const jacketParts = ['torsoUpper', 'torsoLower', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR'];
    for (const key of jacketParts) {
      if (p.parts[key]) p.parts[key].material.color.setHex(jacketColor);
    }

    // Pants (jeans)
    const pantsColor = this.palettes.pants[this.options.pants];
    if (p.parts.legL) p.parts.legL.material.color.setHex(pantsColor);
    if (p.parts.legR) p.parts.legR.material.color.setHex(pantsColor);

    // Hair — use strand hair system
    if (this.player.strandHair) {
      this.player.strandHair.setColor(this.palettes.hairColor[this.options.hairColor]);
    }
    // Stubble color also changes with hair color
    if (p.parts.stubble) {
      p.parts.stubble.material.color.setHex(this.palettes.hairColor[this.options.hairColor]);
    }

    // Helmet
    if (p.parts.helmet) {
      p.parts.helmet.visible = this.options.helmet === 1;
      if (this.options.helmet === 1) {
        p.parts.helmet.material.color.setHex(this.palettes.helmetColor[this.options.helmetColor]);
      }
    }
  }

  _applyHair() {
    // Hair style changes not supported with strand hair (all styles use strands)
    // Hair color is applied in apply() via strandHair.setColor()
  }

  getSaveData() {
    return { ...this.options };
  }

  loadSaveData(data) {
    if (data) {
      Object.assign(this.options, data);
      this.apply();
    }
  }
}
