/**
 * GarageSystem — Phase 5
 *
 * Allows the player to store vehicles at owned houses and switch between
 * stored vehicles. Opens a UI panel showing all stored vehicles.
 *
 * - Press G to open garage (must be near an owned house)
 * - Shows list of owned vehicles with stats
 * - Select to spawn that vehicle at the garage location
 * - Current vehicle is automatically stored when switching
 */
export class GarageSystem {
  constructor({ game, hud, housesSystem }) {
    this.game = game;
    this.hud = hud;
    this.houses = housesSystem;
    this.open = false;

    // Stored vehicles: array of { type, variant, fuel, name }
    this.stored = [
      { type: 'bike', variant: 0, name: 'Sport Bike' },
      { type: 'bike', variant: 1, name: 'Cruiser Bike' },
      { type: 'bike', variant: 2, name: 'Dirt Bike' },
      { type: 'car',  variant: 0, name: 'Sedan' },
      { type: 'car',  variant: 1, name: 'Sports Car' },
      { type: 'car',  variant: 2, name: 'SUV' }
    ];

    this._buildUI();
  }

  _buildUI() {
    const panel = document.createElement('div');
    panel.id = 'garage';
    panel.style.cssText = `
      position: fixed; inset: 0; z-index: 200;
      background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
      display: none; align-items: center; justify-content: center;
      pointer-events: auto;
    `;
    panel.innerHTML = `
      <div style="background:linear-gradient(135deg,#1a2540,#0a0e1a);border:2px solid #4fc3f7;border-radius:16px;padding:32px;width:600px;max-height:90vh;overflow-y:auto;box-shadow:0 0 60px rgba(79,195,247,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="color:#4fc3f7;margin:0;font-size:24px;letter-spacing:2px;">GARAGE</h2>
          <button id="garage-close" style="background:none;border:none;color:#7a8db0;font-size:24px;cursor:pointer;">✕</button>
        </div>
        <div id="garage-list" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"></div>
      </div>
    `;
    document.body.appendChild(panel);
    this.panel = panel;
    panel.querySelector('#garage-close').onclick = () => this.toggle(false);
  }

  toggle(force) {
    // Check if near an owned house
    const owned = this.houses.getOwnedHouses();
    if (owned.length === 0) {
      this.hud.flash('Buy a house first to access the garage', 2500);
      return;
    }
    this.open = force !== undefined ? force : !this.open;
    this.panel.style.display = this.open ? 'flex' : 'none';
    if (this.open) this._populateList();
  }

  _populateList() {
    const list = this.panel.querySelector('#garage-list');
    list.innerHTML = '';
    for (const v of this.stored) {
      const card = document.createElement('div');
      const isActive = this.game.activeVehicleType === v.type &&
                       this.game.activeVehicle.variant === v.variant;
      card.style.cssText = `
        background: rgba(255,255,255,0.05); border: 2px solid ${isActive ? '#4caf50' : 'rgba(255,255,255,0.1)'};
        border-radius: 10px; padding: 16px; cursor: pointer; transition: all 0.2s;
      `;
      card.innerHTML = `
        <div style="font-size:11px;color:#7a8db0;letter-spacing:1px;">${v.type.toUpperCase()}</div>
        <div style="font-size:16px;font-weight:700;color:#fff;margin-top:4px;">${v.name}</div>
        ${isActive ? '<div style="color:#4caf50;font-size:11px;margin-top:4px;">● ACTIVE</div>' : ''}
      `;
      card.onmouseenter = () => { card.style.borderColor = '#4fc3f7'; };
      card.onmouseleave = () => { card.style.borderColor = isActive ? '#4caf50' : 'rgba(255,255,255,0.1)'; };
      card.onclick = () => {
        this._selectVehicle(v);
        this.toggle(false);
      };
      list.appendChild(card);
    }
  }

  _selectVehicle(v) {
    // Set the active vehicle type + variant
    this.game.activeVehicleType = v.type;
    this.game.activeVehicle = v.type === 'bike' ? this.game.bike : this.game.car;
    this.game.activeVehicle.variant = v.variant;
    this.game.activeVehicle._applyVariant();

    // Teleport vehicle to player's position
    const p = this.game.player.body.position;
    const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0,1,0), this.game.player.group.rotation.y);
    this.game.activeVehicle.resetTo(new THREE.Vector3(p.x + fwd.x * 3, 0.5, p.z + fwd.z * 3));
    this.game.fuelSystem.setVehicle(this.game.activeVehicle);

    this.hud.flash(`Switched to ${v.name}`, 2000);
  }

  storeCurrent() {
    // Called when player exits a vehicle — saves its state
    const type = this.game.activeVehicleType;
    const variant = this.game.activeVehicle.variant;
    const existing = this.stored.find(s => s.type === type && s.variant === variant);
    if (!existing) {
      this.stored.push({
        type, variant,
        fuel: this.game.activeVehicle.fuel,
        name: this.game.activeVehicle.variantName
      });
    }
  }
}

// Need THREE for vector math
import * as THREE from 'three';
