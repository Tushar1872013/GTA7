/**
 * MultiplayerSystem — Phase 4
 *
 * Client-side multiplayer sync over WebSocket. Connects to a relay server
 * and broadcasts player position + receives other players' positions.
 *
 * The server is a simple broadcast relay (see server/multiplayer-server.js).
 * If the server is unreachable, the system degrades gracefully (single-player).
 *
 * Each remote player is rendered as a simple capsule with a name tag.
 */
import * as THREE from 'three';

export class MultiplayerSystem {
  constructor({ scene, player, hud }) {
    this.scene = scene;
    this.player = player;
    this.hud = hud;

    this.serverUrl = 'ws://localhost:8787';
    this.ws = null;
    this.connected = false;
    this.playerId = 'p_' + Math.random().toString(36).slice(2, 8);
    this.playerName = 'Player' + Math.floor(Math.random() * 1000);

    this.remotePlayers = new Map(); // id → { mesh, nameTag, lastSeen }
    this._sendAccum = 0;
    this.sendInterval = 0.1; // 10 updates/sec
    this._timeoutMs = 5000;  // drop player after 5s silence

    this.root = new THREE.Group();
    this.root.name = 'RemotePlayers';
    scene.add(this.root);

    this._buildUI();
  }

  _buildUI() {
    const panel = document.createElement('div');
    panel.id = 'mp-panel';
    panel.style.cssText = `
      position: fixed; top: 60px; right: 24px; z-index: 30;
      background: rgba(10,14,26,0.8); border: 1px solid rgba(79,195,247,0.4);
      border-radius: 10px; padding: 10px 14px; backdrop-filter: blur(8px);
      font-size: 12px; min-width: 160px; display: none;
    `;
    panel.innerHTML = `
      <div style="color:#4fc3f7;font-size:10px;letter-spacing:1px;margin-bottom:4px;">MULTIPLAYER</div>
      <div id="mp-status" style="color:#7a8db0;">Disconnected</div>
      <div id="mp-count" style="color:#4caf50;font-weight:700;margin-top:4px;">0 players online</div>
      <input id="mp-name" placeholder="Your name" value="${this.playerName}"
        style="margin-top:6px;width:100%;padding:4px 8px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;font-size:11px;" />
      <button id="mp-connect" style="margin-top:6px;width:100%;padding:6px;background:rgba(79,195,247,0.2);border:1px solid #4fc3f7;color:#4fc3f7;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;">CONNECT</button>
    `;
    document.body.appendChild(panel);
    this.panel = panel;
    panel.querySelector('#mp-connect').onclick = () => {
      if (this.connected) this.disconnect();
      else {
        this.playerName = panel.querySelector('#mp-name').value || this.playerName;
        this.connect();
      }
    };
    this.statusEl = panel.querySelector('#mp-status');
    this.countEl = panel.querySelector('#mp-count');
  }

  togglePanel() {
    this.panel.style.display = this.panel.style.display === 'none' ? 'block' : 'none';
  }

  connect() {
    try {
      this.ws = new WebSocket(this.serverUrl);
    } catch (e) {
      this._setStatus('Server unreachable', '#f44336');
      return;
    }

    this._setStatus('Connecting...', '#ffd54f');
    this.panel.querySelector('#mp-connect').textContent = 'DISCONNECT';

    this.ws.onopen = () => {
      this.connected = true;
      this._setStatus('Connected', '#4caf50');
      this._send({ type: 'join', id: this.playerId, name: this.playerName });
      if (this.hud) this.hud.flash('Multiplayer connected!', 2000);
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        this._handleMessage(msg);
      } catch (e) { /* ignore malformed */ }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this._setStatus('Disconnected', '#f44336');
      this.panel.querySelector('#mp-connect').textContent = 'CONNECT';
      // Clear remote players
      for (const [id, rp] of this.remotePlayers) {
        this.root.remove(rp.mesh);
      }
      this.remotePlayers.clear();
    };

    this.ws.onerror = () => {
      this._setStatus('Connection error', '#f44336');
    };
  }

  disconnect() {
    if (this.ws) {
      this._send({ type: 'leave', id: this.playerId });
      this.ws.close();
      this.ws = null;
    }
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _handleMessage(msg) {
    if (msg.type === 'state' && msg.id !== this.playerId) {
      // Update or create remote player
      let rp = this.remotePlayers.get(msg.id);
      if (!rp) {
        rp = this._createRemotePlayer(msg.name || 'Player');
        this.remotePlayers.set(msg.id, rp);
        this.root.add(rp.mesh);
      }
      rp.mesh.position.set(msg.x, msg.y, msg.z);
      rp.mesh.rotation.y = msg.yaw || 0;
      rp.lastSeen = performance.now();
      if (msg.riding !== undefined) {
        rp.mesh.visible = !msg.riding; // hide if remote player is in vehicle
      }
      if (msg.name && rp.name !== msg.name) {
        rp.name = msg.name;
        rp.nameTag.texture = this._makeNameTexture(msg.name);
      }
    } else if (msg.type === 'leave') {
      const rp = this.remotePlayers.get(msg.id);
      if (rp) {
        this.root.remove(rp.mesh);
        this.remotePlayers.delete(msg.id);
      }
    } else if (msg.type === 'count') {
      this.countEl.textContent = `${msg.count} player${msg.count !== 1 ? 's' : ''} online`;
    }
  }

  _createRemotePlayer(name) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xf0c090, roughness: 0.7 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x1976d2, roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9 });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), skin);
    head.position.y = 1.72; head.castShadow = true;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 8), cloth);
    torso.position.y = 1.2;
    const legGeo = new THREE.CapsuleGeometry(0.1, 0.55, 4, 6);
    const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.12, 0.45, 0);
    const legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.12, 0.45, 0);

    // Name tag (sprite above head)
    const nameTex = this._makeNameTexture(name);
    const nameMat = new THREE.SpriteMaterial({ map: nameTex, transparent: true });
    const nameTag = new THREE.Sprite(nameMat);
    nameTag.position.y = 2.3;
    nameTag.scale.set(2, 0.5, 1);

    g.add(head, torso, legL, legR, nameTag);
    return { mesh: g, name, nameTag: { texture: nameTex, sprite: nameTag }, lastSeen: performance.now() };
  }

  _makeNameTexture(name) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#4fc3f7';
    g.font = 'bold 24px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, 128, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _setStatus(text, color) {
    this.statusEl.textContent = text;
    this.statusEl.style.color = color;
  }

  update(dt, playerPos, playerYaw, riding) {
    if (!this.connected) return;

    // Send our state
    this._sendAccum += dt;
    if (this._sendAccum >= this.sendInterval) {
      this._sendAccum = 0;
      this._send({
        type: 'state',
        id: this.playerId,
        name: this.playerName,
        x: playerPos.x, y: playerPos.y, z: playerPos.z,
        yaw: playerYaw,
        riding
      });
    }

    // Prune stale players
    const now = performance.now();
    for (const [id, rp] of this.remotePlayers) {
      if (now - rp.lastSeen > this._timeoutMs) {
        this.root.remove(rp.mesh);
        this.remotePlayers.delete(id);
      }
    }
  }

  get onlineCount() {
    return this.remotePlayers.size + (this.connected ? 1 : 0);
  }
}
