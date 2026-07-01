/**
 * MainMenu — AAA-style main menu with glassmorphism buttons.
 *
 * Layout:
 *   - Full-screen background image (with CSS fallback)
 *   - Cinematic zoom + pan animation on background
 *   - GTA7 logo top-left
 *   - Left-side menu (PLAY, MISSIONS, GARAGE, CHARACTER, PROPERTIES, MULTIPLAYER, SETTINGS, EXIT)
 *   - Player panel bottom-left
 *   - Version/FPS/time top-right
 *   - "Press ENTER to Play" bottom-right (blinking)
 *   - Particle effects (floating dust, light particles)
 */
import { UIButton } from './UIButton.js';
import { MissionMenu } from './MissionMenu.js';
import { GarageMenu } from './GarageMenu.js';
import { SettingsMenu } from './SettingsMenu.js';

export class MainMenu {
  constructor({ onPlay, gameData }) {
    this.onPlay = onPlay;
    this.gameData = gameData || { name: 'Player', money: 5000, level: 1 };
    this.subMenu = null;

    this.el = document.createElement('div');
    this.el.id = 'main-menu';
    this.el.innerHTML = `
      <!-- Background layers -->
      <div class="menu-bg-layer">
        <div class="menu-bg-image" id="menu-bg-img"></div>
        <div class="menu-bg-overlay"></div>
        <div class="menu-bg-fog"></div>
        <canvas class="menu-particles" id="menu-particles"></canvas>
      </div>

      <!-- Logo -->
      <div class="menu-logo" id="menu-logo">
        GTA<span class="menu-logo-7">7</span>
      </div>

      <!-- Left menu -->
      <div class="menu-buttons" id="menu-buttons"></div>

      <!-- Player panel -->
      <div class="menu-player-panel">
        <div class="menu-avatar">P</div>
        <div class="menu-player-info">
          <div class="menu-player-name" id="menu-player-name">${this.gameData.name}</div>
          <div class="menu-player-stats">
            <span class="menu-money">$${this.gameData.money.toLocaleString()}</span>
            <span class="menu-level">LV ${this.gameData.level}</span>
          </div>
        </div>
      </div>

      <!-- Top right info -->
      <div class="menu-topright">
        <div class="menu-version">v1.0.0</div>
        <div class="menu-clock" id="menu-clock">00:00</div>
      </div>

      <!-- Bottom right prompt -->
      <div class="menu-enter-prompt" id="menu-enter-prompt">
        Press <span class="key">ENTER</span> to Play
      </div>
    `;
    document.body.appendChild(this.el);

    this._buildButtons();
    this._startClock();
    this._startParticles();
    this._bindKeys();

    // Animate in
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  _buildButtons() {
    const container = this.el.querySelector('#menu-buttons');
    const items = [
      { label: 'PLAY', icon: '▶', variant: 'primary', onClick: () => this._play() },
      { label: 'MISSIONS', icon: '📋', onClick: () => this._openMissionMenu() },
      { label: 'GARAGE', icon: '🏍', onClick: () => this._openGarageMenu() },
      { label: 'CHARACTER', icon: '👤', onClick: () => this._openCharacter() },
      { label: 'PROPERTIES', icon: '🏢', onClick: () => this._openProperties() },
      { label: 'MULTIPLAYER', icon: '🌐', onClick: () => this._comingSoon() },
      { label: 'SETTINGS', icon: '⚙', onClick: () => this._openSettings() },
      { label: 'EXIT', icon: '✕', onClick: () => this._exit() }
    ];
    this.buttons = items.map(d => new UIButton({ ...d, parent: container }));
  }

  _play() {
    // Disable all buttons
    this.buttons.forEach(b => b.setDisabled(true));
    // Fade to black
    this.el.classList.add('fade-out');
    setTimeout(() => {
      this.el.remove();
      if (this.onPlay) this.onPlay();
    }, 800);
  }

  _openMissionMenu() {
    if (this.subMenu) this.subMenu.close();
    this.subMenu = new MissionMenu({ gameData: this.gameData });
  }

  _openGarageMenu() {
    if (this.subMenu) this.subMenu.close();
    this.subMenu = new GarageMenu({ gameData: this.gameData });
  }

  _openCharacter() {
    if (this.subMenu) this.subMenu.close();
    // Reuse customizer if game is loaded
    if (window.__game?.customizer) {
      window.__game.customizer.toggle(true);
    } else {
      this._comingSoon('Character customization available in-game');
    }
  }

  _openProperties() {
    if (this.subMenu) this.subMenu.close();
    this._comingSoon('Properties menu coming soon');
  }

  _comingSoon(msg = 'Coming Soon') {
    const toast = document.createElement('div');
    toast.className = 'menu-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  _openSettings() {
    if (this.subMenu) this.subMenu.close();
    this.subMenu = new SettingsMenu();
  }

  _exit() {
    // Show exit confirmation
    const toast = document.createElement('div');
    toast.className = 'menu-toast';
    toast.innerHTML = 'Thanks for playing GTA7!<br><small>Close this tab to exit</small>';
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
  }

  _bindKeys() {
    this._keyHandler = (e) => {
      if (e.key === 'Enter' && this.el.parentNode) {
        this._play();
        window.removeEventListener('keydown', this._keyHandler);
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  _startClock() {
    const update = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      const clock = this.el.querySelector('#menu-clock');
      if (clock) clock.textContent = `${h}:${m}`;
    };
    update();
    this._clockInterval = setInterval(update, 1000);
  }

  _startParticles() {
    const canvas = this.el.querySelector('#menu-particles');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.5 - 0.1,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1
      });
    }

    const animate = () => {
      if (!this.el.parentNode) return; // menu closed
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < 0) { p.y = canvas.height; p.x = Math.random() * canvas.width; }
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        ctx.fillStyle = `rgba(255, 220, 100, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(animate);
    };
    animate();

    this._resizeHandler = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  destroy() {
    window.removeEventListener('keydown', this._keyHandler);
    window.removeEventListener('resize', this._resizeHandler);
    clearInterval(this._clockInterval);
    this.el.remove();
  }
}
