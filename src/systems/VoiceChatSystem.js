/**
 * VoiceChatSystem — Phase 4
 *
 * Peer-to-peer voice chat using WebRTC. Connects to other players via
 * the multiplayer signaling channel (WebSocket relay).
 *
 * - Hold T to transmit (push-to-talk)
 * - Automatically connects to all remote players when they join
 * - Spatial audio: volume decreases with distance
 *
 * Falls back gracefully if microphone permission is denied.
 */
export class VoiceChatSystem {
  constructor({ multiplayer, hud }) {
    this.mp = multiplayer;
    this.hud = hud;
    this.enabled = false;
    this.transmitting = false;
    this.localStream = null;
    this.peers = new Map(); // playerId → { pc, audioEl }
    this._micReady = false;

    this._buildUI();
  }

  _buildUI() {
    const btn = document.createElement('div');
    btn.id = 'voice-btn';
    btn.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      width: 56px; height: 56px; border-radius: 50%;
      background: rgba(10,14,26,0.8); border: 2px solid rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 30; font-size: 22px; backdrop-filter: blur(8px);
      transition: all 0.2s; user-select: none;
    `;
    btn.textContent = '🎙';
    btn.title = 'Voice chat (hold T to talk)';
    document.body.appendChild(btn);
    this.btn = btn;

    // Status dot
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: absolute; top: -2px; right: -2px;
      width: 14px; height: 14px; border-radius: 50%;
      background: #666; border: 2px solid #0a0e1a;
    `;
    btn.appendChild(dot);
    this.dot = dot;

    // Click to enable mic
    btn.onclick = () => this.enableMic();

    // Push to talk
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 't' && !e.repeat) this.startTransmit();
    });
    window.addEventListener('keyup', (e) => {
      if (e.key.toLowerCase() === 't') this.stopTransmit();
    });
  }

  async enableMic() {
    if (this._micReady) return;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._micReady = true;
      this.dot.style.background = '#4caf50';
      this.btn.style.borderColor = '#4caf50';
      if (this.hud) this.hud.flash('Microphone enabled. Hold T to talk.', 2500);
      // Initiate connections to existing remote players
      for (const id of this.mp.remotePlayers.keys()) {
        this._initiateCall(id);
      }
    } catch (e) {
      this.dot.style.background = '#f44336';
      if (this.hud) this.hud.flash('Microphone access denied', 2000);
    }
  }

  startTransmit() {
    if (!this._micReady) {
      this.enableMic();
      return;
    }
    this.transmitting = true;
    this.btn.style.background = 'rgba(244,67,54,0.4)';
    this.btn.style.borderColor = '#f44336';
    this.btn.style.transform = 'translateX(-50%) scale(1.1)';
    // Enable mic track
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => t.enabled = true);
    }
  }

  stopTransmit() {
    this.transmitting = false;
    this.btn.style.background = 'rgba(10,14,26,0.8)';
    this.btn.style.borderColor = this._micReady ? '#4caf50' : 'rgba(255,255,255,0.2)';
    this.btn.style.transform = 'translateX(-50%) scale(1)';
    // Disable mic track to save bandwidth
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => t.enabled = false);
    }
  }

  /**
   * Initiate a WebRTC call to a remote player.
   * Uses the multiplayer WebSocket as signaling channel.
   */
  async _initiateCall(remoteId) {
    if (!this._micReady) return;
    if (this.peers.has(remoteId)) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Add local audio
    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream);
    }

    // Receive remote audio
    pc.ontrack = (e) => {
      const audio = new Audio();
      audio.srcObject = e.streams[0];
      audio.autoplay = true;
      this.peers.get(remoteId).audioEl = audio;
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.mp._send({
          type: 'voice-ice',
          from: this.mp.playerId,
          to: remoteId,
          candidate: e.candidate
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.mp._send({
      type: 'voice-offer',
      from: this.mp.playerId,
      to: remoteId,
      sdp: pc.localDescription
    });

    this.peers.set(remoteId, { pc, audioEl: null });
  }

  /**
   * Handle incoming voice signaling messages.
   */
  handleSignaling(msg) {
    if (msg.to !== this.mp.playerId) return;

    if (msg.type === 'voice-offer') {
      this._handleOffer(msg.from, msg.sdp);
    } else if (msg.type === 'voice-answer') {
      this._handleAnswer(msg.from, msg.sdp);
    } else if (msg.type === 'voice-ice') {
      this._handleIce(msg.from, msg.candidate);
    }
  }

  async _handleOffer(fromId, sdp) {
    if (!this._micReady) await this.enableMic();
    if (!this._micReady) return;

    let peer = this.peers.get(fromId);
    if (!peer) {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
      pc.ontrack = (e) => {
        const audio = new Audio();
        audio.srcObject = e.streams[0];
        audio.autoplay = true;
        peer.audioEl = audio;
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.mp._send({
            type: 'voice-ice',
            from: this.mp.playerId,
            to: fromId,
            candidate: e.candidate
          });
        }
      };
      peer = { pc, audioEl: null };
      this.peers.set(fromId, peer);
    }

    await peer.pc.setRemoteDescription(sdp);
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    this.mp._send({
      type: 'voice-answer',
      from: this.mp.playerId,
      to: fromId,
      sdp: peer.pc.localDescription
    });
  }

  async _handleAnswer(fromId, sdp) {
    const peer = this.peers.get(fromId);
    if (peer) await peer.pc.setRemoteDescription(sdp);
  }

  async _handleIce(fromId, candidate) {
    const peer = this.peers.get(fromId);
    if (peer) {
      try { await peer.pc.addIceCandidate(candidate); } catch (e) { /* ignore */ }
    }
  }

  /**
   * Update spatial audio volume based on distance to remote players.
   */
  update(dt, playerPos, remotePlayers) {
    for (const [id, peer] of this.peers) {
      const rp = remotePlayers.get(id);
      if (rp && peer.audioEl) {
        const d = rp.mesh.position.distanceTo(playerPos);
        // Volume falls off at 30 units, silent at 60
        const vol = Math.max(0, 1 - d / 60);
        peer.audioEl.volume = vol;
      }
    }
  }

  removePeer(id) {
    const peer = this.peers.get(id);
    if (peer) {
      peer.pc.close();
      if (peer.audioEl) peer.audioEl.srcObject = null;
      this.peers.delete(id);
    }
  }
}
