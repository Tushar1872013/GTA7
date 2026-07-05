/**
 * menu-styles.js — injects all menu CSS into the document.
 * Kept separate so menu styling doesn't clutter index.html.
 */
const css = `
/* ==================== SPLASH SCREEN ==================== */
#splash-screen {
  position: fixed; inset: 0; z-index: 1000;
  background: #000;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.5s;
}
#splash-screen.visible { opacity: 1; }
#splash-screen.fade-out { opacity: 0; }
.splash-content { text-align: center; }
.splash-logo {
  font-size: 96px; font-weight: 900; letter-spacing: 4px;
  color: #fff; opacity: 0; transform: translateY(-30px);
  transition: opacity 1s, transform 1s;
  font-family: 'Arial Black', sans-serif;
  text-shadow: 0 0 40px rgba(255,213,79,0.5);
}
.splash-7 { color: #ffd54f; }
#splash-screen.visible .splash-logo { opacity: 1; transform: translateY(0); }
.splash-tagline {
  font-size: 14px; letter-spacing: 6px; color: #7a8db0;
  margin-top: 12px; opacity: 0;
  transition: opacity 1s 0.5s;
  font-family: sans-serif;
}
#splash-screen.visible .splash-tagline { opacity: 1; }
.splash-bar {
  width: 200px; height: 2px; background: #1a1a2e;
  margin: 30px auto 0; overflow: hidden; border-radius: 2px;
  opacity: 0; transition: opacity 0.5s 1s;
}
#splash-screen.visible .splash-bar { opacity: 1; }
.splash-bar-fill {
  height: 100%; width: 0;
  background: linear-gradient(90deg, #4fc3f7, #ffd54f);
  animation: splashBar 2s ease forwards 1s;
}
@keyframes splashBar { to { width: 100%; } }

/* ==================== LOADING SCREEN ==================== */
#loading-screen {
  position: fixed; inset: 0; z-index: 1000;
  background: linear-gradient(135deg, #0a0e1a, #1a2540);
  display: flex; align-items: center; justify-content: center;
}
#loading-screen.fade-out { opacity: 0; transition: opacity 0.6s; }
.loading-content { text-align: center; width: 400px; }
.loading-logo {
  font-size: 64px; font-weight: 900; color: #fff;
  margin-bottom: 40px; letter-spacing: 4px;
  font-family: 'Arial Black', sans-serif;
  text-shadow: 0 0 30px rgba(79,195,247,0.5);
}
.loading-logo span { color: #ffd54f; }
.loading-bar-container {
  width: 100%; height: 4px; background: #1a1f2e;
  border-radius: 2px; overflow: hidden;
}
.loading-bar-fill {
  height: 100%; width: 0;
  background: linear-gradient(90deg, #4fc3f7, #1976d2);
  transition: width 0.1s linear;
  box-shadow: 0 0 10px rgba(79,195,247,0.6);
}
.loading-percent {
  color: #4fc3f7; font-size: 24px; font-weight: 700;
  margin-top: 12px; font-family: monospace;
}
.loading-msg {
  color: #7a8db0; font-size: 13px; margin-top: 8px;
  transition: opacity 0.3s; letter-spacing: 1px;
}

/* ==================== MAIN MENU ==================== */
#main-menu {
  position: fixed; inset: 0; z-index: 900;
  overflow: hidden;
  opacity: 0; transition: opacity 0.8s;
}
#main-menu.visible { opacity: 1; }
#main-menu.fade-out { opacity: 0; transition: opacity 0.8s; }

/* Background layers */
.menu-bg-layer { position: absolute; inset: 0; z-index: 0; }
.menu-bg-image {
  position: absolute; inset: -5%;
  background-image:
    linear-gradient(135deg, #0a0e1a 0%, #1a2540 40%, #2a1a3a 70%, #0a0e1a 100%),
    radial-gradient(circle at 30% 40%, rgba(79,195,247,0.15) 0%, transparent 50%),
    radial-gradient(circle at 70% 60%, rgba(255,213,79,0.1) 0%, transparent 50%);
  background-size: 100% 100%, 100% 100%, 100% 100%;
  animation: bgZoomPan 20s ease-in-out infinite alternate;
}
/* Try to load user's background image — if it exists, it overrides the gradient */
.menu-bg-image::before {
  content: '';
  position: absolute; inset: 0;
  background-image: url('/menu-bg.jpg');
  background-size: cover;
  background-position: center;
  opacity: 1;
}
@keyframes bgZoomPan {
  0% { transform: scale(1) translateX(0); }
  100% { transform: scale(1.05) translateX(-2%); }
}
.menu-bg-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.5));
  backdrop-filter: blur(2px);
}
.menu-bg-fog {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at bottom, transparent 0%, rgba(0,0,0,0.4) 100%);
  animation: fogPulse 8s ease-in-out infinite;
}
@keyframes fogPulse { 0%,100% { opacity: 0.6; } 50% { opacity: 0.9; } }
.menu-particles {
  position: absolute; inset: 0;
  pointer-events: none;
}

/* ==================== LOGO ==================== */
.menu-logo {
  position: absolute; top: 40px; left: 50px; z-index: 10;
  font-size: 56px; font-weight: 900; color: #fff;
  letter-spacing: 4px;
  font-family: 'Arial Black', sans-serif;
  opacity: 0; transform: translateY(-20px);
  transition: opacity 1s, transform 1s, text-shadow 1s;
  text-shadow: 0 0 20px rgba(255,213,79,0.4);
}
#main-menu.visible .menu-logo {
  opacity: 1; transform: translateY(0);
  text-shadow: 0 0 30px rgba(255,213,79,0.6);
}
.menu-logo-7 { color: #ffd54f; }

/* ==================== BUTTONS ==================== */
.menu-buttons {
  position: absolute; left: 50px; top: 50%; transform: translateY(-50%);
  z-index: 10; display: flex; flex-direction: column; gap: 8px;
}
.menu-btn {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 28px; min-width: 220px;
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  color: #fff; font-size: 16px; font-weight: 600;
  letter-spacing: 2px; cursor: pointer;
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  position: relative; overflow: hidden;
  font-family: sans-serif;
}
.menu-btn-icon { font-size: 18px; opacity: 0.8; }
.menu-btn-label { flex: 1; text-align: left; }
.menu-btn.hover {
  background: rgba(255,213,79,0.15);
  border-color: rgba(255,213,79,0.5);
  box-shadow: 0 0 24px rgba(255,213,79,0.2);
  transform: translateX(8px);
}
.menu-btn-primary {
  background: linear-gradient(90deg, rgba(255,213,79,0.2), rgba(255,152,0,0.15));
  border-color: rgba(255,213,79,0.4);
}
.menu-btn-primary.hover {
  background: linear-gradient(90deg, rgba(255,213,79,0.35), rgba(255,152,0,0.25));
  box-shadow: 0 0 32px rgba(255,213,79,0.4);
}
.menu-btn.disabled {
  opacity: 0.4; pointer-events: none;
}
.menu-btn .ripple {
  position: absolute; border-radius: 50%;
  background: rgba(255,213,79,0.3);
  animation: rippleAnim 0.6s ease-out;
  pointer-events: none;
}
@keyframes rippleAnim {
  from { transform: scale(0); opacity: 1; }
  to { transform: scale(2.5); opacity: 0; }
}

/* ==================== PLAYER PANEL ==================== */
.menu-player-panel {
  position: absolute; bottom: 40px; left: 50px; z-index: 10;
  display: flex; align-items: center; gap: 14px;
  padding: 14px 20px;
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  opacity: 0; transform: translateY(20px);
  transition: opacity 0.8s 0.5s, transform 0.8s 0.5s;
}
#main-menu.visible .menu-player-panel { opacity: 1; transform: translateY(0); }
.menu-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, #4fc3f7, #1976d2);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 18px; color: #fff;
}
.menu-player-info { display: flex; flex-direction: column; gap: 4px; }
.menu-player-name { font-size: 14px; font-weight: 600; color: #fff; }
.menu-player-stats { display: flex; gap: 12px; font-size: 12px; }
.menu-money { color: #4caf50; font-weight: 600; }
.menu-level { color: #ffd54f; }

/* ==================== TOP RIGHT ==================== */
.menu-topright {
  position: absolute; top: 40px; right: 40px; z-index: 10;
  text-align: right; display: flex; flex-direction: column; gap: 4px;
  opacity: 0; transition: opacity 0.8s 0.7s;
}
#main-menu.visible .menu-topright { opacity: 1; }
.menu-version { font-size: 11px; color: #7a8db0; }
.menu-clock { font-size: 22px; color: #4fc3f7; font-family: monospace; font-weight: 700; }

/* ==================== ENTER PROMPT ==================== */
.menu-enter-prompt {
  position: absolute; bottom: 40px; right: 40px; z-index: 10;
  color: #fff; font-size: 14px; letter-spacing: 1px;
  opacity: 0; transition: opacity 0.8s 0.9s;
}
#main-menu.visible .menu-enter-prompt { opacity: 1; animation: blink 2s infinite 1.8s; }
.menu-enter-prompt .key {
  display: inline-block; padding: 2px 10px; margin: 0 4px;
  background: rgba(255,213,79,0.2); border: 1px solid rgba(255,213,79,0.5);
  border-radius: 4px; color: #ffd54f; font-weight: 700;
}
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

/* ==================== TOAST ==================== */
.menu-toast {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.9);
  z-index: 2000;
  padding: 20px 40px;
  background: rgba(10,14,26,0.9); backdrop-filter: blur(12px);
  border: 1px solid rgba(79,195,247,0.4);
  border-radius: 12px; color: #fff; font-size: 16px;
  text-align: center;
  opacity: 0; transition: opacity 0.3s, transform 0.3s;
  box-shadow: 0 0 40px rgba(79,195,247,0.2);
}
.menu-toast.visible { opacity: 1; transform: translate(-50%, -50%) scale(1); }

/* ==================== SUBMENUS ==================== */
.submenu-overlay {
  position: fixed; inset: 0; z-index: 1100;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.3s;
}
.submenu-overlay.visible { opacity: 1; }
.submenu-panel {
  background: linear-gradient(135deg, rgba(26,37,64,0.95), rgba(10,14,26,0.95));
  border: 1px solid rgba(79,195,247,0.3);
  border-radius: 16px; padding: 32px;
  width: 700px; max-height: 85vh; overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 60px rgba(79,195,247,0.15);
}
.submenu-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 24px; padding-bottom: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.submenu-header h2 {
  margin: 0; color: #4fc3f7; font-size: 24px;
  letter-spacing: 3px; font-weight: 700;
}
.submenu-close {
  background: none; border: none; color: #7a8db0;
  font-size: 24px; cursor: pointer; padding: 4px 8px;
  transition: color 0.2s;
}
.submenu-close:hover { color: #ff6b6b; }

/* ==================== MISSION MENU ==================== */
.mission-categories {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px;
}
.mission-cat {
  padding: 6px 14px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px; color: #b0bcd4;
  font-size: 12px; cursor: pointer; transition: all 0.2s;
}
.mission-cat:hover { background: rgba(79,195,247,0.15); color: #4fc3f7; }
.mission-cat.active {
  background: rgba(79,195,247,0.25);
  border-color: #4fc3f7; color: #fff;
}
.mission-list { display: flex; flex-direction: column; gap: 12px; }
.mission-card {
  display: flex; gap: 16px; padding: 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; transition: all 0.2s;
}
.mission-card:hover {
  background: rgba(79,195,247,0.08);
  border-color: rgba(79,195,247,0.3);
}
.mission-card-img {
  width: 80px; height: 80px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 32px; flex-shrink: 0;
}
.mission-card-body { flex: 1; }
.mission-card-title { font-size: 15px; font-weight: 700; color: #fff; }
.mission-card-desc { font-size: 12px; color: #b0bcd4; margin: 4px 0 8px; }
.mission-card-meta { display: flex; gap: 12px; font-size: 11px; margin-bottom: 8px; }
.mission-difficulty-1 { color: #4caf50; }
.mission-difficulty-2 { color: #ffd54f; }
.mission-difficulty-3 { color: #ff9800; }
.mission-difficulty-4 { color: #ff5722; }
.mission-difficulty-5 { color: #f44336; }
.mission-reward { color: #4caf50; font-weight: 600; }
.mission-dist { color: #7a8db0; }
.mission-start {
  padding: 6px 20px;
  background: linear-gradient(90deg, #4fc3f7, #1976d2);
  border: none; border-radius: 6px; color: #fff;
  font-weight: 700; font-size: 12px; cursor: pointer;
  letter-spacing: 1px; transition: all 0.2s;
}
.mission-start:hover { box-shadow: 0 0 16px rgba(79,195,247,0.4); }

/* ==================== GARAGE MENU ==================== */
.garage-panel { width: 800px; }
.garage-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
}
.garage-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; overflow: hidden; transition: all 0.2s;
}
.garage-card:hover { border-color: rgba(79,195,247,0.3); }
.garage-card-img {
  height: 100px; position: relative;
  display: flex; align-items: center; justify-content: center;
  font-size: 40px;
}
.garage-card-type {
  position: absolute; top: 8px; right: 8px;
  font-size: 9px; padding: 2px 8px; border-radius: 4px;
  background: rgba(0,0,0,0.5); color: #fff; letter-spacing: 1px;
}
.garage-card-body { padding: 14px; }
.garage-card-name { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 10px; }
.garage-stats { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.garage-stat { display: flex; align-items: center; gap: 8px; }
.garage-stat-label { font-size: 9px; color: #7a8db0; width: 28px; letter-spacing: 1px; }
.garage-stat-bar { flex: 1; height: 5px; background: #1a1f2e; border-radius: 3px; overflow: hidden; }
.garage-stat-fill { height: 100%; background: linear-gradient(90deg, #4fc3f7, #1976d2); }
.garage-stat-val { font-size: 10px; color: #4fc3f7; width: 28px; text-align: right; font-family: monospace; }
.garage-card-actions { display: flex; gap: 8px; }
.garage-btn-select, .garage-btn-upgrade {
  flex: 1; padding: 6px; font-size: 11px; font-weight: 700;
  border: none; border-radius: 6px; cursor: pointer; letter-spacing: 1px;
}
.garage-btn-select {
  background: linear-gradient(90deg, #4fc3f7, #1976d2); color: #fff;
}
.garage-btn-upgrade {
  background: rgba(255,213,79,0.15); border: 1px solid rgba(255,213,79,0.4); color: #ffd54f;
}
.garage-btn-select:hover { box-shadow: 0 0 12px rgba(79,195,247,0.4); }
.garage-btn-upgrade:hover { background: rgba(255,213,79,0.25); }

/* ==================== SETTINGS MENU ==================== */
.settings-tabs {
  display: flex; gap: 4px; margin-bottom: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.settings-tab {
  padding: 8px 16px; background: none; border: none;
  color: #7a8db0; font-size: 13px; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all 0.2s;
}
.settings-tab:hover { color: #fff; }
.settings-tab.active { color: #4fc3f7; border-bottom-color: #4fc3f7; }
.settings-body { display: flex; flex-direction: column; gap: 16px; }
.setting-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0;
}
.setting-row label { color: #cfd8e8; font-size: 14px; }
.setting-row select, .setting-row input[type="range"] {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);
  color: #fff; padding: 6px 12px; border-radius: 6px; font-size: 13px;
}
.setting-row input[type="range"] { width: 200px; }
.setting-row select option { background: #1a2540; }

/* ==================== RESPONSIVE ==================== */
@media (max-width: 768px) {
  .menu-logo { font-size: 36px; top: 20px; left: 20px; }
  .menu-buttons { left: 20px; gap: 6px; }
  .menu-btn { min-width: 180px; padding: 10px 20px; font-size: 14px; }
  .menu-player-panel { bottom: 20px; left: 20px; padding: 10px 14px; }
  .menu-topright { top: 20px; right: 20px; }
  .menu-clock { font-size: 16px; }
  .menu-enter-prompt { bottom: 20px; right: 20px; font-size: 12px; }
  .submenu-panel { width: 90vw; padding: 20px; }
  .garage-grid { grid-template-columns: 1fr; }
}
`;

// Inject the CSS
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

export { css };
