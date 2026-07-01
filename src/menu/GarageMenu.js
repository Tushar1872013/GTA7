/**
 * GarageMenu — shows owned vehicles with upgrade UI.
 */
export class GarageMenu {
  constructor({ gameData }) {
    this.gameData = gameData;
    this.vehicles = [
      { type: 'bike', variant: 0, name: 'Sport Bike', topSpeed: 234, accel: 8.5, handling: 9.0, color: '#e53935', owned: true },
      { type: 'bike', variant: 1, name: 'Cruiser', topSpeed: 162, accel: 6.0, handling: 7.0, color: '#1a1a2e', owned: true },
      { type: 'bike', variant: 2, name: 'Dirt Bike', topSpeed: 180, accel: 7.5, handling: 8.5, color: '#2e7d32', owned: true },
      { type: 'car', variant: 0, name: 'Sedan', topSpeed: 180, accel: 7.0, handling: 6.5, color: '#1976d2', owned: true },
      { type: 'car', variant: 1, name: 'Sports Car', topSpeed: 270, accel: 9.5, handling: 8.0, color: '#d32f2f', owned: true },
      { type: 'car', variant: 2, name: 'SUV', topSpeed: 144, accel: 5.5, handling: 5.0, color: '#2e7d32', owned: true }
    ];

    this.el = document.createElement('div');
    this.el.className = 'submenu-overlay';
    this.el.innerHTML = `
      <div class="submenu-panel garage-panel">
        <div class="submenu-header">
          <h2>GARAGE</h2>
          <button class="submenu-close">✕</button>
        </div>
        <div class="garage-grid">
          ${this.vehicles.map((v, i) => this._renderCard(v, i)).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(this.el);
    requestAnimationFrame(() => this.el.classList.add('visible'));
    this.el.querySelector('.submenu-close').onclick = () => this.close();
  }

  _renderCard(v, i) {
    const stats = [
      ['SPD', v.topSpeed, 270],
      ['ACC', v.accel * 10, 100],
      ['HND', v.handing * 10, 100]
    ];
    return `
      <div class="garage-card">
        <div class="garage-card-img" style="background: linear-gradient(135deg, ${v.color}, ${v.color}66);">
          <span class="garage-card-icon">${v.type === 'bike' ? '🏍' : '🚗'}</span>
          <span class="garage-card-type">${v.type.toUpperCase()}</span>
        </div>
        <div class="garage-card-body">
          <div class="garage-card-name">${v.name}</div>
          <div class="garage-stats">
            ${stats.map(s => `
              <div class="garage-stat">
                <div class="garage-stat-label">${s[0]}</div>
                <div class="garage-stat-bar"><div class="garage-stat-fill" style="width:${(s[1]/s[2])*100}%"></div></div>
                <div class="garage-stat-val">${Math.round(s[1])}</div>
              </div>
            `).join('')}
          </div>
          <div class="garage-card-actions">
            <button class="garage-btn-select">SELECT</button>
            <button class="garage-btn-upgrade">UPGRADE</button>
          </div>
        </div>
      </div>
    `;
  }

  close() {
    this.el.classList.remove('visible');
    setTimeout(() => this.el.remove(), 300);
  }
}
