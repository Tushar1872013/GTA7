/**
 * MissionMenu — shows mission categories + cards.
 */
export class MissionMenu {
  constructor({ gameData }) {
    this.gameData = gameData;
    this.el = document.createElement('div');
    this.el.className = 'submenu-overlay';
    this.el.innerHTML = `
      <div class="submenu-panel">
        <div class="submenu-header">
          <h2>MISSIONS</h2>
          <button class="submenu-close">✕</button>
        </div>
        <div class="mission-categories">
          ${this._renderCategories()}
        </div>
        <div class="mission-list" id="mission-list">
          ${this._renderMissions('story')}
        </div>
      </div>
    `;
    document.body.appendChild(this.el);
    requestAnimationFrame(() => this.el.classList.add('visible'));

    this.el.querySelector('.submenu-close').onclick = () => this.close();
    this.el.querySelectorAll('.mission-cat').forEach(btn => {
      btn.onclick = () => {
        this.el.querySelectorAll('.mission-cat').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        this.el.querySelector('#mission-list').innerHTML = this._renderMissions(cat);
      };
    });
  }

  _renderCategories() {
    const cats = [
      ['story', 'Story'], ['taxi', 'Taxi'], ['cargo', 'Cargo'], ['delivery', 'Delivery'],
      ['police', 'Police'], ['ambulance', 'Ambulance'], ['race', 'Race'], ['drift', 'Drift'],
      ['daily', 'Daily'], ['weekly', 'Weekly']
    ];
    return cats.map((c, i) => `
      <button class="mission-cat ${i === 0 ? 'active' : ''}" data-cat="${c[0]}">${c[1]}</button>
    `).join('');
  }

  _renderMissions(cat) {
    const missions = this._getMissions(cat);
    return missions.map(m => `
      <div class="mission-card">
        <div class="mission-card-img" style="background: linear-gradient(135deg, ${m.color}, ${m.color}88);">
          <span class="mission-card-icon">${m.icon}</span>
        </div>
        <div class="mission-card-body">
          <div class="mission-card-title">${m.title}</div>
          <div class="mission-card-desc">${m.desc}</div>
          <div class="mission-card-meta">
            <span class="mission-diff difficulty-${m.diff}">${'★'.repeat(m.diff)}</span>
            <span class="mission-reward">$${m.reward}</span>
            <span class="mission-dist">${m.dist}m</span>
          </div>
          <button class="mission-start">START</button>
        </div>
      </div>
    `).join('');
  }

  _getMissions(cat) {
    const all = {
      story: [
        { title: 'First Ride', desc: 'Get your first bike and explore the city', diff: 1, reward: 500, dist: 0, icon: '🏍', color: '#4fc3f7' },
        { title: 'Making Connections', desc: 'Meet the local fixer at the docks', diff: 2, reward: 1500, dist: 800, icon: '🤝', color: '#ff9800' },
        { title: 'The Big Score', desc: 'Rob the Dubai central bank', diff: 5, reward: 50000, dist: 2400, icon: '💰', color: '#ffd54f' }
      ],
      taxi: [
        { title: 'Airport Pickup', desc: 'Pick up passenger from airport', diff: 1, reward: 300, dist: 400, icon: '🚕', color: '#ffd54f' },
        { title: 'City Tour', desc: 'Show a tourist around downtown', diff: 2, reward: 600, dist: 1200, icon: '🚕', color: '#ffd54f' }
      ],
      race: [
        { title: 'Dubai Sprint', desc: 'Race through Dubai downtown', diff: 3, reward: 5000, dist: 1800, icon: '🏁', color: '#e53935' },
        { title: 'Mountain Rally', desc: 'Dangerous mountain roads await', diff: 4, reward: 8000, dist: 2200, icon: '🏁', color: '#e53935' },
        { title: 'Tokyo Night Race', desc: 'Neon-lit street racing', diff: 5, reward: 12000, dist: 1600, icon: '🏁', color: '#e53935' }
      ],
      police: [
        { title: 'Patrol Duty', desc: 'Patrol the highway district', diff: 2, reward: 800, dist: 600, icon: '🚓', color: '#1976d2' },
        { title: 'Hot Pursuit', desc: 'Chase down a fleeing suspect', diff: 4, reward: 3000, dist: 1400, icon: '🚓', color: '#1976d2' }
      ]
    };
    return all[cat] || [
      { title: 'Coming Soon', desc: `More ${cat} missions coming soon`, diff: 1, reward: 0, dist: 0, icon: '📋', color: '#666' }
    ];
  }

  close() {
    this.el.classList.remove('visible');
    setTimeout(() => this.el.remove(), 300);
  }
}
