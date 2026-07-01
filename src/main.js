/**
 * Open City Bike 3D - GTA7
 * Entry point: Shows splash → main menu → loading → game.
 * The game no longer launches directly; player must click PLAY.
 */
import { SplashScreen } from './menu/SplashScreen.js';
import { MainMenu } from './menu/MainMenu.js';
import { LoadingScreen } from './menu/LoadingScreen.js';
import { Game } from './core/Game.js';

// Inject menu styles
import './menu/menu-styles.js';

// Load saved player data
function loadPlayerData() {
  try {
    const saved = localStorage.getItem('gta7_player');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { name: 'Player', money: 5000, level: 1 };
}

// Boot sequence: Splash → Menu → (PLAY) → Loading → Game
function boot() {
  const playerData = loadPlayerData();

  // Step 1: Splash screen (2.5s) → Step 2: Main menu
  new SplashScreen(() => {
    const menu = new MainMenu({
      gameData: playerData,
      onPlay: () => {
        // Step 3: Loading screen (4s) → Step 4: Game
        new LoadingScreen(() => {
          startGame();
        });
      }
    });
  });
}

function startGame() {
  // Ensure all menu elements are removed
  document.querySelectorAll('#splash-screen, #main-menu, #loading-screen').forEach(el => el.remove());

  const container = document.getElementById('app');
  // Clear any existing canvas
  container.innerHTML = '';
  const game = new Game(container);

  game.onStart = () => {
    // Game started successfully — show the HUD
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = 'block';
    console.log('[GTA7] Game started');
  };

  game.init().catch((err) => {
    console.error('[GTA7] Boot failed:', err);
    console.error('[GTA7] Full stack:', err.stack);
    const errorEl = document.createElement('div');
    errorEl.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0e1a;color:#ff6b6b;font-family:sans-serif;text-align:center;padding:40px;z-index:9999;';
    errorEl.innerHTML = `<div><h1>Boot Failed</h1><p style="color:#b0bcd4;margin-top:12px;font-size:14px;">${err.message || err}</p><pre style="color:#666;margin-top:12px;font-size:11px;text-align:left;max-width:600px;overflow:auto;">${err.stack || ''}</pre></div>`;
    document.body.appendChild(errorEl);
  });

  window.__game = game;
}

// Start the boot sequence
boot();
