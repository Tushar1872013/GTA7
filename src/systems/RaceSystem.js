/**
 * RaceSystem — Phase 5
 *
 * Checkpoint races with timer + leaderboard. Race types:
 *   - Sprint: point A to B
 *   - Circuit: lap around checkpoints
 *
 * Flow:
 *   1. Player triggers race (via phone or near a race marker)
 *   2. Countdown 3-2-1-GO
 *   3. Drive through all checkpoints in order
 *   4. Timer stops, best time saved to localStorage
 *
 * Visual: floating ring checkpoints that light up when active.
 */
import * as THREE from 'three';

export class RaceSystem {
  constructor({ scene, world, hud }) {
    this.scene = scene;
    this.world = world;
    this.hud = hud;

    this.active = false;
    this.currentRace = null;     // { name, checkpoints: Vector3[], type, reward }
    this.currentCheckpoint = 0;
    this.startTime = 0;
    this.bestTimes = {};         // raceId → ms

    this._loadBestTimes();
    this._spawnRaceMarkers();
    this._buildCheckpoints();
  }

  _loadBestTimes() {
    try {
      const saved = localStorage.getItem('raceBestTimes');
      if (saved) this.bestTimes = JSON.parse(saved);
    } catch (e) { /* ignore */ }
  }

  _saveBestTimes() {
    try {
      localStorage.setItem('raceBestTimes', JSON.stringify(this.bestTimes));
    } catch (e) { /* ignore */ }
  }

  _spawnRaceMarkers() {
    // Race start markers at various locations
    this.races = [
      {
        id: 'sprint_dubai',
        name: 'Dubai Sprint',
        type: 'sprint',
        startPos: new THREE.Vector3(0, 0, -750),
        checkpoints: [
          new THREE.Vector3(50, 0, -780),
          new THREE.Vector3(80, 0, -820),
          new THREE.Vector3(100, 0, -860),
          new THREE.Vector3(120, 0, -900)
        ],
        reward: 5000
      },
      {
        id: 'circuit_highway',
        name: 'Highway Circuit',
        type: 'circuit',
        startPos: new THREE.Vector3(0, 0, 0),
        checkpoints: [
          new THREE.Vector3(100, 0, 0),
          new THREE.Vector3(100, 0, 100),
          new THREE.Vector3(0, 0, 100),
          new THREE.Vector3(-100, 0, 100),
          new THREE.Vector3(-100, 0, 0),
          new THREE.Vector3(-100, 0, -100),
          new THREE.Vector3(0, 0, -100),
          new THREE.Vector3(100, 0, -100),
          new THREE.Vector3(100, 0, 0) // finish
        ],
        reward: 8000
      },
      {
        id: 'mountain_rally',
        name: 'Mountain Rally',
        type: 'sprint',
        startPos: new THREE.Vector3(0, 0, 750),
        checkpoints: [
          new THREE.Vector3(30, 0, 800),
          new THREE.Vector3(50, 0, 850),
          new THREE.Vector3(-30, 0, 880),
          new THREE.Vector3(-50, 0, 920),
          new THREE.Vector3(0, 0, 950)
        ],
        reward: 6000
      }
    ];

    const markerMat = new THREE.MeshStandardMaterial({
      color: 0x00bcd4, emissive: 0x00bcd4, emissiveIntensity: 0.8,
      transparent: true, opacity: 0.5
    });

    for (const race of this.races) {
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(4, 4, 12, 16, 1, true),
        markerMat
      );
      marker.position.set(race.startPos.x, 6, race.startPos.z);
      marker.userData.raceId = race.id;
      this.scene.add(marker);
      race.marker = marker;
      this.world.poiMarkers.push({ pos: race.startPos, label: race.name, color: '#00bcd4' });
    }
  }

  _buildCheckpoints() {
    // Pre-create checkpoint meshes (hidden, shown during race)
    this.checkpointMeshes = [];
    const cpMat = new THREE.MeshStandardMaterial({
      color: 0xffd54f, emissive: 0xffd54f, emissiveIntensity: 1.5,
      transparent: true, opacity: 0.6
    });
    for (let i = 0; i < 20; i++) {
      const cp = new THREE.Mesh(
        new THREE.TorusGeometry(5, 0.5, 8, 24),
        cpMat.clone()
      );
      cp.visible = false;
      cp.rotation.x = Math.PI / 2;
      this.scene.add(cp);
      this.checkpointMeshes.push(cp);
    }
  }

  startRace(raceId) {
    const race = this.races.find(r => r.id === raceId);
    if (!race) return;
    this.currentRace = race;
    this.currentCheckpoint = 0;
    this.active = false; // will be true after countdown
    this._countdown = 3;
    this._countdownTimer = 0;

    // Show checkpoints
    for (let i = 0; i < race.checkpoints.length; i++) {
      const mesh = this.checkpointMeshes[i];
      if (mesh) {
        mesh.position.copy(race.checkpoints[i]);
        mesh.position.y = 5;
        mesh.visible = true;
        mesh.material.color.setHex(i === 0 ? 0x00ff00 : 0xffd54f);
        mesh.material.emissive.setHex(i === 0 ? 0x00ff00 : 0xffd54f);
      }
    }

    if (this.hud) this.hud.flash(`RACE: ${race.name} — Get ready!`, 2000);
  }

  update(dt, playerPos) {
    if (!this.currentRace) {
      // Check if player is near a race start marker
      for (const race of this.races) {
        if (race.startPos.distanceTo(playerPos) < 5) {
          if (!this._nearbyRace) {
            this._nearbyRace = race;
            if (this.hud) this.hud.flash(`${race.name} — press K to start`, 1500);
          }
          return;
        }
      }
      this._nearbyRace = null;
      return;
    }

    // Countdown
    if (!this.active) {
      this._countdownTimer += dt;
      if (this._countdownTimer >= 1) {
        this._countdownTimer = 0;
        this._countdown--;
        if (this._countdown > 0) {
          if (this.hud) this.hud.flash(`${this._countdown}...`, 800);
        } else if (this._countdown === 0) {
          if (this.hud) this.hud.flash('GO!', 1000);
        } else {
          this.active = true;
          this.startTime = performance.now();
        }
      }
      return;
    }

    // Check checkpoint
    const cp = this.currentRace.checkpoints[this.currentCheckpoint];
    if (cp.distanceTo(playerPos) < 6) {
      // Hide the checkpoint we just passed
      const mesh = this.checkpointMeshes[this.currentCheckpoint];
      if (mesh) mesh.visible = false;
      this.currentCheckpoint++;
      if (this.hud) this.hud.flash(`Checkpoint ${this.currentCheckpoint}/${this.currentRace.checkpoints.length}`, 1200);

      // Highlight next checkpoint
      if (this.currentCheckpoint < this.currentRace.checkpoints.length) {
        const nextMesh = this.checkpointMeshes[this.currentCheckpoint];
        if (nextMesh) {
          nextMesh.material.color.setHex(0x00ff00);
          nextMesh.material.emissive.setHex(0x00ff00);
        }
      } else {
        // Race complete!
        this._completeRace();
      }
    }

    // Update timer display
    if (this.active && this.hud) {
      const elapsed = performance.now() - this.startTime;
      this.hud._raceTime = elapsed;
    }
  }

  _completeRace() {
    const elapsed = performance.now() - this.startTime;
    const seconds = (elapsed / 1000).toFixed(2);
    const raceId = this.currentRace.id;
    const prev = this.bestTimes[raceId];
    let isRecord = false;
    if (!prev || elapsed < prev) {
      this.bestTimes[raceId] = elapsed;
      this._saveBestTimes();
      isRecord = true;
    }
    if (this.hud) {
      const best = this.bestTimes[raceId];
      this.hud.flash(`FINISH! Time: ${seconds}s ${isRecord ? '★ NEW RECORD!' : ''} · +$${this.currentRace.reward}`, 4000);
    }
    if (this.onComplete) this.onComplete(this.currentRace.reward);
    // Hide all checkpoints
    for (const m of this.checkpointMeshes) m.visible = false;
    this.currentRace = null;
    this.active = false;
  }

  cancelRace() {
    if (!this.currentRace) return;
    for (const m of this.checkpointMeshes) m.visible = false;
    this.currentRace = null;
    this.active = false;
    if (this.hud) this.hud.flash('Race cancelled', 1500);
  }

  getNearbyRacePrompt() {
    if (this.currentRace) return null;
    return this._nearbyRace ? this._nearbyRace.name : null;
  }
}
