/**
 * PhoneSystem — Phase 5
 *
 * In-game phone with apps:
 *   - Home: time, money, notifications
 *   - Map: district overview
 *   - Missions: list active missions
 *   - Properties: owned houses + businesses
 *   - Garage: quick vehicle switch
 *   - Settings: customize character, audio
 *   - Multiplayer: connect/disconnect
 *
 * Opens as an overlay (iPhone-style) at bottom-right. Press P to toggle.
 */
export class PhoneSystem {
  constructor({ game, hud, housesSystem, businessesSystem, economySystem, customizer, multiplayer }) {
    this.game = game;
    this.hud = hud;
    this.houses = housesSystem;
    this.businesses = businessesSystem;
    this.economy = economySystem;
    this.customizer = customizer;
    this.mp = multiplayer;

    this.open = false;
    this.currentApp = 'home';
    this._buildUI();
  }

  _buildUI() {
    const phone = document.createElement('div');
    phone.id = 'phone';
    phone.style.cssText = `
      position: fixed; bottom: -650px; right: 24px; z-index: 150;
      width: 360px; height: 640px; border-radius: 36px;
      background: linear-gradient(135deg, #1a1a2e, #0a0a14);
      border: 3px solid #2a2a3e; overflow: hidden;
      transition: bottom 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(79,195,247,0.2);
      pointer-events: auto;
    `;
    phone.innerHTML = `
      <!-- Notch -->
      <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:120px;height:24px;background:#0a0a14;border-radius:0 0 16px 16px;z-index:10;"></div>

      <!-- Status bar -->
      <div style="display:flex;justify-content:space-between;padding:8px 24px 4px;color:#4fc3f7;font-size:11px;font-family:monospace;">
        <span id="phone-time">12:00</span>
        <span>● ● ●</span>
        <span id="phone-balance">$0</span>
      </div>

      <!-- App container -->
      <div id="phone-app" style="padding:16px;height:calc(100% - 100px);overflow-y:auto;color:#fff;"></div>

      <!-- App dock -->
      <div id="phone-dock" style="position:absolute;bottom:0;left:0;right:0;height:80px;display:flex;justify-content:space-around;align-items:center;background:rgba(0,0,0,0.5);border-top:1px solid rgba(79,195,247,0.2);"></div>
    `;
    document.body.appendChild(phone);
    this.phone = phone;
    this.appEl = phone.querySelector('#phone-app');
    this.dockEl = phone.querySelector('#phone-dock');
    this.timeEl = phone.querySelector('#phone-time');
    this.balanceEl = phone.querySelector('#phone-balance');

    // Build dock icons
    const apps = [
      { id: 'home',        icon: '🏠', label: 'Home' },
      { id: 'map',         icon: '🗺', label: 'Map' },
      { id: 'missions',    icon: '📋', label: 'Jobs' },
      { id: 'properties',  icon: '🏢', label: 'Props' },
      { id: 'garage',      icon: '🚗', label: 'Garage' },
      { id: 'settings',    icon: '⚙', label: 'Setup' },
      { id: 'multiplayer', icon: '🌐', label: 'Online' }
    ];
    for (const a of apps) {
      const btn = document.createElement('div');
      btn.style.cssText = `
        display:flex;flex-direction:column;align-items:center;cursor:pointer;
        padding:8px 4px;border-radius:8px;transition:background 0.2s;width:42px;
      `;
      btn.innerHTML = `
        <div style="font-size:22px;">${a.icon}</div>
        <div style="font-size:9px;color:#7a8db0;margin-top:2px;">${a.label}</div>
      `;
      btn.onmouseenter = () => btn.style.background = 'rgba(79,195,247,0.15)';
      btn.onmouseleave = () => btn.style.background = 'transparent';
      btn.onclick = () => this._openApp(a.id);
      this.dockEl.appendChild(btn);
    }
  }

  toggle(force) {
    this.open = force !== undefined ? force : !this.open;
    this.phone.style.bottom = this.open ? '24px' : '-650px';
    if (this.open) this._openApp(this.currentApp);
  }

  _openApp(id) {
    this.currentApp = id;
    const render = this[`_app_${id}`];
    if (render) render.call(this);
  }

  _app_home() {
    const ownedHouses = this.houses.getOwnedHouses();
    const ownedBiz = this.businesses.getOwnedBusinesses();
    const income = this.houses.totalIncome + this.businesses.totalIncome;
    this.appEl.innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="color:#4fc3f7;font-size:11px;letter-spacing:2px;">WELCOME</div>
        <div style="color:#fff;font-size:18px;font-weight:700;margin-top:4px;">${this.mp.playerName}</div>
      </div>
      <div style="background:rgba(79,195,247,0.1);border-radius:12px;padding:16px;margin-bottom:12px;">
        <div style="color:#7a8db0;font-size:11px;">CASH</div>
        <div style="color:#4caf50;font-size:28px;font-weight:800;">$${this.economy.cash.toLocaleString()}</div>
        <div style="color:#7a8db0;font-size:11px;margin-top:8px;">BANK</div>
        <div style="color:#4fc3f7;font-size:18px;font-weight:700;">$${this.economy.bank.toLocaleString()}</div>
      </div>
      <div style="background:rgba(255,213,79,0.1);border-radius:12px;padding:16px;margin-bottom:12px;">
        <div style="color:#7a8db0;font-size:11px;">PASSIVE INCOME</div>
        <div style="color:#ffd54f;font-size:20px;font-weight:700;">$${income}/sec</div>
        <div style="color:#7a8db0;font-size:10px;margin-top:4px;">${ownedHouses.length} houses · ${ownedBiz.length} businesses</div>
      </div>
      <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;">
        <div style="color:#7a8db0;font-size:11px;">WANTED LEVEL</div>
        <div style="font-size:20px;margin-top:4px;">${'★'.repeat(Math.ceil(this.game.policeSystem.wanted))}${'☆'.repeat(5 - Math.ceil(this.game.policeSystem.wanted))}</div>
      </div>
    `;
  }

  _app_map() {
    let html = '<div style="color:#4fc3f7;font-size:14px;font-weight:700;margin-bottom:12px;">WORLD MAP</div>';
    for (const d of this.game.world.districts) {
      const poi = this.game.world.poiMarkers.find(p => Math.abs(p.pos.z - d.center.z) < 10);
      html += `
        <div style="background:rgba(255,255,255,0.05);border-left:3px solid ${poi?.color || '#666'};padding:10px 12px;margin-bottom:8px;border-radius:6px;">
          <div style="color:#fff;font-weight:600;">${d.name}</div>
        </div>
      `;
    }
    this.appEl.innerHTML = html;
  }

  _app_missions() {
    const m = this.game.missionSystem;
    let html = '<div style="color:#4fc3f7;font-size:14px;font-weight:700;margin-bottom:12px;">ACTIVE MISSION</div>';
    if (m.current) {
      html += `
        <div style="background:rgba(79,195,247,0.1);border-radius:12px;padding:14px;margin-bottom:12px;">
          <div style="color:${m.current.hasCargo ? '#4fc3f7' : '#ffd54f'};font-size:11px;">
            ${m.current.hasCargo ? 'DELIVER CARGO' : 'PICK UP CARGO'}
          </div>
          <div style="color:#fff;font-size:14px;margin-top:4px;">Reward: $${m.current.reward}</div>
        </div>
      `;
    }
    html += `<div style="color:#7a8db0;font-size:12px;">Completed: ${m.completedCount}</div>`;
    html += `<div style="color:#4caf50;font-size:14px;font-weight:700;margin-top:4px;">Total earned: $${m.money.toLocaleString()}</div>`;
    this.appEl.innerHTML = html;
  }

  _app_properties() {
    const houses = this.houses.getOwnedHouses();
    const biz = this.businesses.getOwnedBusinesses();
    let html = '<div style="color:#4fc3f7;font-size:14px;font-weight:700;margin-bottom:12px;">PROPERTIES</div>';

    html += '<div style="color:#ffd54f;font-size:11px;margin-bottom:8px;">HOUSES</div>';
    if (houses.length === 0) html += '<div style="color:#666;font-size:12px;padding:8px;">None owned</div>';
    for (const h of houses) {
      html += `
        <div style="background:rgba(76,175,80,0.1);border-radius:8px;padding:10px;margin-bottom:6px;">
          <div style="color:#fff;font-size:13px;">${h.name}</div>
          <div style="color:#4caf50;font-size:11px;">$${h.income}/sec income</div>
        </div>
      `;
    }

    html += '<div style="color:#ffd54f;font-size:11px;margin:12px 0 8px;">BUSINESSES</div>';
    if (biz.length === 0) html += '<div style="color:#666;font-size:12px;padding:8px;">None owned</div>';
    for (const b of biz) {
      html += `
        <div style="background:rgba(76,175,80,0.1);border-radius:8px;padding:10px;margin-bottom:6px;">
          <div style="color:#fff;font-size:13px;">${b.name}</div>
          <div style="color:#4caf50;font-size:11px;">$${b.income}/sec income</div>
        </div>
      `;
    }
    this.appEl.innerHTML = html;
  }

  _app_garage() {
    let html = '<div style="color:#4fc3f7;font-size:14px;font-weight:700;margin-bottom:12px;">GARAGE</div>';
    html += '<div style="color:#7a8db0;font-size:11px;margin-bottom:8px;">Quick switch vehicle:</div>';
    const vehicles = [
      { type: 'bike', variant: 0, name: 'Sport Bike' },
      { type: 'bike', variant: 1, name: 'Cruiser' },
      { type: 'bike', variant: 2, name: 'Dirt Bike' },
      { type: 'car', variant: 0, name: 'Sedan' },
      { type: 'car', variant: 1, name: 'Sports Car' },
      { type: 'car', variant: 2, name: 'SUV' }
    ];
    for (const v of vehicles) {
      const isActive = this.game.activeVehicleType === v.type && this.game.activeVehicle.variant === v.variant;
      html += `
        <div onclick="window.__game._switchToVehicle('${v.type}', ${v.variant})"
          style="background:${isActive ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.05)'};
          border:1px solid ${isActive ? '#4caf50' : 'rgba(255,255,255,0.1)'};
          border-radius:8px;padding:10px;margin-bottom:6px;cursor:pointer;">
          <div style="color:#fff;font-size:13px;">${v.name}</div>
          ${isActive ? '<div style="color:#4caf50;font-size:10px;">● Active</div>' : ''}
        </div>
      `;
    }
    this.appEl.innerHTML = html;
  }

  _app_settings() {
    this.appEl.innerHTML = `
      <div style="color:#4fc3f7;font-size:14px;font-weight:700;margin-bottom:12px;">SETTINGS</div>
      <button onclick="document.getElementById('customizer').style.display='flex'"
        style="width:100%;padding:14px;background:rgba(79,195,247,0.15);border:1px solid #4fc3f7;color:#4fc3f7;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;margin-bottom:8px;">
        CUSTOMIZE CHARACTER
      </button>
      <button onclick="window.__game.environment.paused = !window.__game.environment.paused; window.__game.hud.flash('Time ' + (window.__game.environment.paused ? 'paused' : 'resumed'), 1500)"
        style="width:100%;padding:14px;background:rgba(255,213,79,0.15);border:1px solid #ffd54f;color:#ffd54f;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;margin-bottom:8px;">
        TOGGLE TIME PAUSE
      </button>
      <div style="margin-top:16px;">
        <div style="color:#7a8db0;font-size:11px;">Quality: ${this.game.quality.toUpperCase()}</div>
        <div style="color:#7a8db0;font-size:11px;margin-top:4px;">FPS: ${this.hud._fpsValue}</div>
      </div>
    `;
  }

  _app_multiplayer() {
    const count = this.mp.onlineCount;
    const connected = this.mp.connected;
    this.appEl.innerHTML = `
      <div style="color:#4fc3f7;font-size:14px;font-weight:700;margin-bottom:12px;">MULTIPLAYER</div>
      <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;margin-bottom:12px;">
        <div style="color:#7a8db0;font-size:11px;">STATUS</div>
        <div style="color:${connected ? '#4caf50' : '#f44336'};font-size:16px;font-weight:700;">
          ${connected ? '● Connected' : '● Offline'}
        </div>
        <div style="color:#7a8db0;font-size:11px;margin-top:8px;">PLAYERS ONLINE</div>
        <div style="color:#fff;font-size:20px;font-weight:700;">${count}</div>
      </div>
      <button onclick="document.getElementById('mp-panel').style.display = document.getElementById('mp-panel').style.display === 'none' ? 'block' : 'none'"
        style="width:100%;padding:14px;background:rgba(79,195,247,0.15);border:1px solid #4fc3f7;color:#4fc3f7;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">
        OPEN MP PANEL
      </button>
    `;
  }

  update(dt) {
    // Update status bar
    const tod = this.game.environment.timeOfDay;
    const hours = Math.floor(tod * 24);
    const mins = Math.floor((tod * 24 - hours) * 60);
    this.timeEl.textContent = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}`;
    this.balanceEl.textContent = '$' + this.economy.cash.toLocaleString();
  }
}
