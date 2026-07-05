/**
 * HUD — full dashboard for all systems.
 *
 * Elements:
 *   - Speedometer (km/h + gear)
 *   - Fuel gauge (radial)
 *   - Wanted stars (5 ★)
 *   - Money + mission objective
 *   - Stunt score
 *   - FPS counter
 *   - Minimap (with POI markers + mission markers)
 *   - Vehicle variant indicator
 *   - Flash messages (transient toasts)
 */
export class HUD {
  constructor({ world, player, bike }) {
    this.world = world;
    this.player = player;
    this.bike = bike;
    this.activeVehicle = bike;

    this.speedEl = document.getElementById('speed-val');
    this.gearEl  = document.getElementById('gear-val');
    this.fpsEl   = document.getElementById('fps');
    this.infoEl  = document.getElementById('info');
    this.miniCanvas = document.getElementById('minimap-canvas');
    this.miniCtx = this.miniCanvas.getContext('2d');

    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this._fpsValue = 0;

    this._buildExtraHUD();
  }

  _buildExtraHUD() {
    // Fuel gauge (left of speedometer)
    const fuelGauge = document.createElement('div');
    fuelGauge.id = 'fuel-gauge';
    fuelGauge.style.cssText = `
      position:absolute; right:200px; bottom:36px; width:120px; padding:8px 12px;
      background: rgba(10,14,26,0.75); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px; backdrop-filter: blur(8px); font-family: monospace;
    `;
    fuelGauge.innerHTML = `
      <div style="font-size:10px;color:#7a8db0;letter-spacing:1px;margin-bottom:4px;">FUEL</div>
      <div style="height:10px;background:#1a1f2e;border-radius:5px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
        <div id="fuel-bar" style="height:100%;width:100%;background:linear-gradient(90deg,#4caf50,#ffd54f);transition:width 0.2s,background 0.3s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;">
        <span id="fuel-pct" style="color:#4caf50;">100%</span>
        <span id="vehicle-name" style="color:#ffd54f;">SPORT</span>
      </div>
    `;
    document.getElementById('hud').appendChild(fuelGauge);

    // Wanted stars (top-center)
    const wanted = document.createElement('div');
    wanted.id = 'wanted';
    wanted.style.cssText = `
      position:absolute; left:50%; top:60px; transform:translateX(-50%);
      display:flex; gap:6px; padding:6px 14px;
      background: rgba(10,14,26,0.75); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 20px; backdrop-filter: blur(8px);
    `;
    wanted.innerHTML = '<span style="font-size:10px;color:#7a8db0;letter-spacing:1px;align-self:center;">WANTED</span>' +
      Array.from({length:5}, () => '<span class="star" style="font-size:18px;color:#333;transition:color 0.2s,text-shadow 0.2s;">★</span>').join('');
    document.getElementById('hud').appendChild(wanted);
    this.stars = wanted.querySelectorAll('.star');

    // Money + mission (top-left under minimap)
    const stats = document.createElement('div');
    stats.id = 'stats';
    stats.style.cssText = `
      position:absolute; left:24px; top:200px; min-width:200px;
      padding:10px 14px; background: rgba(10,14,26,0.75);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 10px;
      backdrop-filter: blur(8px); font-size: 13px;
    `;
    stats.innerHTML = `
      <div style="color:#4fc3f7;font-size:11px;letter-spacing:1px;margin-bottom:4px;">MONEY</div>
      <div id="money" style="color:#4caf50;font-weight:700;font-size:18px;margin-bottom:8px;">$0</div>
      <div style="color:#ffd54f;font-size:11px;letter-spacing:1px;margin-bottom:4px;">MISSION</div>
      <div id="mission" style="color:#cfd8e8;font-size:12px;line-height:1.4;">No active mission</div>
      <div style="margin-top:10px;color:#ff6f00;font-size:11px;letter-spacing:1px;">STUNT SCORE</div>
      <div id="stunt" style="color:#ff6f00;font-weight:700;font-size:15px;">0</div>
    `;
    document.getElementById('hud').appendChild(stats);

    // Toast/flash container
    const toasts = document.createElement('div');
    toasts.id = 'toasts';
    toasts.style.cssText = `
      position:absolute; left:50%; top:140px; transform:translateX(-50%);
      display:flex; flex-direction:column; gap:8px; align-items:center;
      pointer-events: none; z-index: 20;
    `;
    document.getElementById('hud').appendChild(toasts);
    this.toasts = toasts;
  }

  setActiveVehicle(v) { this.activeVehicle = v; }

  setInfo(html) {
    if (this.infoEl) this.infoEl.innerHTML = html;
  }

  flash(message, duration = 2500) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      background: rgba(10,14,26,0.92); color: #fff;
      border: 1px solid rgba(79,195,247,0.5);
      padding: 10px 22px; border-radius: 24px;
      font-size: 14px; font-weight: 600;
      box-shadow: 0 0 24px rgba(79,195,247,0.3);
      animation: toastIn 0.3s ease;
      backdrop-filter: blur(8px);
    `;
    this.toasts.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s, transform 0.4s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  update(dt, riding, gameState = {}) {
    // FPS
    this._fpsAccum += dt;
    this._fpsFrames++;
    if (this._fpsAccum >= 0.5) {
      this._fpsValue = Math.round(this._fpsFrames / this._fpsAccum);
      this._fpsAccum = 0;
      this._fpsFrames = 0;
      if (this.fpsEl) this.fpsEl.textContent = `FPS: ${this._fpsValue}`;
    }

    // Speed + gear
    let speedKmh = 0, gear = 'NEUTRAL';
    if (riding && this.activeVehicle) {
      speedKmh = Math.round(this.activeVehicle.speedKmh);
      if (this.activeVehicle.speed < 0.5) gear = 'NEUTRAL';
      else if (speedKmh < 30)   gear = 'GEAR 1';
      else if (speedKmh < 60)   gear = 'GEAR 2';
      else if (speedKmh < 100)  gear = 'GEAR 3';
      else if (speedKmh < 180)  gear = 'GEAR 4';
      else                      gear = 'GEAR 5';
    } else {
      const sp = this.player.speed || 0;
      speedKmh = Math.round(sp * 3.6);
      gear = sp > 0.1 ? 'WALK' : 'IDLE';
    }
    if (this.speedEl) this.speedEl.textContent = speedKmh;
    if (this.gearEl)  this.gearEl.textContent = gear;

    // Fuel
    if (this.activeVehicle) {
      const fuelPct = Math.round(this.activeVehicle.fuel);
      const bar = document.getElementById('fuel-bar');
      const pct = document.getElementById('fuel-pct');
      const vname = document.getElementById('vehicle-name');
      if (bar) {
        bar.style.width = fuelPct + '%';
        if (fuelPct < 25) bar.style.background = '#f44336';
        else if (fuelPct < 50) bar.style.background = 'linear-gradient(90deg,#ff9800,#ffd54f)';
        else bar.style.background = 'linear-gradient(90deg,#4caf50,#ffd54f)';
      }
      if (pct) {
        pct.textContent = fuelPct + '%';
        pct.style.color = fuelPct < 25 ? '#f44336' : '#4caf50';
      }
      if (vname) vname.textContent = (this.activeVehicle.variantName || 'STD').toUpperCase();
    }

    // Wanted stars
    const wanted = gameState.wanted || 0;
    for (let i = 0; i < 5; i++) {
      if (i < Math.ceil(wanted)) {
        this.stars[i].style.color = '#ffd54f';
        this.stars[i].style.textShadow = '0 0 8px #ff6f00';
      } else {
        this.stars[i].style.color = '#333';
        this.stars[i].style.textShadow = 'none';
      }
    }

    // Money + mission + stunt
    if (gameState.money !== undefined) {
      const m = document.getElementById('money');
      if (m) m.textContent = '$' + gameState.money.toLocaleString();
    }
    if (gameState.mission) {
      const mi = document.getElementById('mission');
      if (mi) mi.textContent = gameState.mission;
    }
    if (gameState.stunt !== undefined) {
      const s = document.getElementById('stunt');
      if (s) s.textContent = gameState.stunt.toLocaleString();
    }

    this._drawMinimap(riding, gameState);
  }

  _drawMinimap(riding, gameState) {
    const ctx = this.miniCtx;
    const W = 160, H = 160;
    ctx.clearRect(0, 0, W, H);

    // World scale — show ~1200 units across minimap
    const view = 1200;
    const scale = W / view;
    const cx = W / 2, cy = H / 2;

    const tgt = riding && this.activeVehicle ? this.activeVehicle.group : this.player.group;
    const camX = tgt.position.x;
    const camZ = tgt.position.z;

    // Background
    ctx.fillStyle = 'rgba(20,24,38,0.9)';
    ctx.fillRect(0, 0, W, H);

    // Districts (colored blocks)
    if (this.world.districts) {
      for (const d of this.world.districts) {
        const px = cx + (d.center.x - camX) * scale;
        const py = cy + (d.center.z - camZ) * scale;
        const sz = 100 * scale * 0.5;
        // Use POI color if available
        const poi = this.world.poiMarkers.find(p => Math.abs(p.pos.z - d.center.z) < 10);
        ctx.fillStyle = poi ? this._hexToRgba(poi.color, 0.2) : 'rgba(60,70,90,0.3)';
        ctx.fillRect(px - sz, py - sz, sz * 2, sz * 2);
      }
    }

    // Roads (only main highway + a sample of road segments for perf)
    ctx.strokeStyle = 'rgba(80,100,140,0.6)';
    ctx.lineWidth = 1;
    if (this.world.roadSegments) {
      const step = Math.max(1, Math.floor(this.world.roadSegments.length / 60));
      for (let i = 0; i < this.world.roadSegments.length; i += step) {
        const seg = this.world.roadSegments[i];
        ctx.beginPath();
        ctx.moveTo(cx + (seg.a.x - camX) * scale, cy + (seg.a.z - camZ) * scale);
        ctx.lineTo(cx + (seg.b.x - camX) * scale, cy + (seg.b.z - camZ) * scale);
        ctx.stroke();
      }
    }

    // POI markers (district centers, fuel, ramps)
    if (this.world.poiMarkers) {
      for (const p of this.world.poiMarkers) {
        const px = cx + (p.pos.x - camX) * scale;
        const py = cy + (p.pos.z - camZ) * scale;
        if (px < 0 || px > W || py < 0 || py > H) continue;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Mission markers
    if (gameState.missionPickup) {
      const px = cx + (gameState.missionPickup.x - camX) * scale;
      const py = cy + (gameState.missionPickup.z - camZ) * scale;
      if (px >= 0 && px <= W && py >= 0 && py <= H) {
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
    }
    if (gameState.missionDropoff) {
      const px = cx + (gameState.missionDropoff.x - camX) * scale;
      const py = cy + (gameState.missionDropoff.z - camZ) * scale;
      if (px >= 0 && px <= W && py >= 0 && py <= H) {
        ctx.fillStyle = '#4fc3f7';
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
    }

    // Traffic (yellow dots)
    ctx.fillStyle = 'rgba(255,213,79,0.7)';
    const traffic = this.scene_root_parent_getTraffic();
    if (traffic) {
      for (const c of traffic.children) {
        const px = cx + (c.position.x - camX) * scale;
        const py = cy + (c.position.z - camZ) * scale;
        if (px >= 0 && px <= W && py >= 0 && py <= H) ctx.fillRect(px - 1, py - 1, 2, 2);
      }
    }

    // Police (red dots)
    const police = this.scene_root_parent_getPolice();
    if (police) {
      ctx.fillStyle = '#ff3b3b';
      for (const c of police.children) {
        const px = cx + (c.position.x - camX) * scale;
        const py = cy + (c.position.z - camZ) * scale;
        if (px >= 0 && px <= W && py >= 0 && py <= H) {
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Player arrow
    const yaw = riding ? this.activeVehicle.yaw : tgt.rotation.y;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-yaw);
    ctx.fillStyle = riding ? '#4fc3f7' : '#7ec0ff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Border
    ctx.strokeStyle = 'rgba(79,195,247,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  scene_root_parent_getTraffic() {
    if (!this.world.root || !this.world.root.parent) return null;
    return this.world.root.parent.getObjectByName('Traffic');
  }
  scene_root_parent_getPolice() {
    if (!this.world.root || !this.world.root.parent) return null;
    return this.world.root.parent.getObjectByName('Police');
  }

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
}
