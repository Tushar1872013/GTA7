/**
 * HousesSystem — Phase 4
 *
 * Buyable houses scattered across the world. Each house:
 *   - Has a position, price, name, and capacity (garage slots)
 *   - Can be purchased by the player (press H when near)
 *   - Owned houses generate passive income over time
 *   - Owned houses act as save points + garage access
 *
 * Visual markers: green glow when owned, yellow when available.
 */
import * as THREE from 'three';

export class HousesSystem {
  constructor({ scene, world, hud }) {
    this.scene = scene;
    this.world = world;
    this.hud = hud;

    this.houses = [];     // { id, name, position, price, owned, income, garageSlots, mesh, marker }
    this.owned = new Set();
    this.totalIncome = 0; // per second
    this._incomeAccum = 0;

    this._spawnHouses();
    this._buildUI();
  }

  _spawnHouses() {
    // Define house locations across districts
    const defs = [
      { id: 'h1', name: 'Dubai Penthouse',    pos: [0, 0, -780], price: 50000, income: 200, garage: 3 },
      { id: 'h2', name: 'Desert Villa',        pos: [-80, 0, -1180], price: 15000, income: 50, garage: 2 },
      { id: 'h3', name: 'Tokyo Apartment',     pos: [-60, 0, 420], price: 25000, income: 100, garage: 2 },
      { id: 'h4', name: 'Village Cottage',     pos: [60, 0, 1200], price: 8000, income: 30, garage: 1 },
      { id: 'h5', name: 'Mountain Lodge',      pos: [-50, 0, 820], price: 20000, income: 80, garage: 2 },
      { id: 'h6', name: 'Airport Hangar Home', pos: [100, 0, -400], price: 35000, income: 120, garage: 4 }
    ];

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b3a2a, roughness: 0.85 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.7 });
    const availMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffd54f, emissiveIntensity: 0.5, transparent: true, opacity: 0.5 });
    const ownedMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, emissive: 0x4caf50, emissiveIntensity: 0.5, transparent: true, opacity: 0.5 });

    for (const d of defs) {
      const g = new THREE.Group();
      // House body
      const walls = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 10), wallMat);
      walls.position.y = 4; walls.castShadow = true;
      // Roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 5, 4), roofMat);
      roof.position.y = 10.5; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
      // Door
      const door = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 0.3), doorMat);
      door.position.set(0, 2, 5.1);
      // Window
      const winMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff4d6, emissiveIntensity: 0.3 });
      const win1 = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2), winMat);
      win1.position.set(-3, 4, 5.1);
      const win2 = win1.clone(); win2.position.x = 3;
      // Marker ring (ground glow)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 0.3, 8, 32), availMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.1;

      g.add(walls, roof, door, win1, win2, ring);
      g.position.set(...d.pos);
      this.scene.add(g);

      const house = {
        ...d,
        position: new THREE.Vector3(...d.pos),
        owned: false,
        mesh: g,
        marker: ring,
        markerMat: availMat,
        ownedMat
      };
      this.houses.push(house);
      this.world.poiMarkers.push({ pos: house.position, label: house.name, color: '#ffd54f' });
    }
  }

  _buildUI() {
    // Buy prompt + houses list will be triggered via HUD flash
  }

  update(dt, playerPos, money) {
    // Check proximity for buy prompt
    let nearest = null;
    let nearestDist = Infinity;
    for (const h of this.houses) {
      const d = h.position.distanceTo(playerPos);
      if (d < 10 && d < nearestDist) {
        nearest = h;
        nearestDist = d;
      }
    }
    this._nearestHouse = nearest;

    // Income generation
    if (this.totalIncome > 0) {
      this._incomeAccum += dt * this.totalIncome;
      if (this._incomeAccum >= 1) {
        const earned = Math.floor(this._incomeAccum);
        this._incomeAccum -= earned;
        if (this.hud && this.onIncome) this.onIncome(earned);
      }
    }

    // Animate markers
    for (const h of this.houses) {
      h.marker.rotation.z += dt * 0.5;
      const pulse = 1 + Math.sin(performance.now() / 500) * 0.1;
      h.marker.scale.set(pulse, pulse, 1);
    }
  }

  tryBuy(money) {
    if (!this._nearestHouse) return { success: false, reason: 'No house nearby' };
    const h = this._nearestHouse;
    if (h.owned) return { success: false, reason: 'You already own this house' };
    if (money < h.price) return { success: false, reason: `Need $${h.price}` };
    h.owned = true;
    h.marker.material = h.ownedMat;
    this.owned.add(h.id);
    this.totalIncome += h.income;
    return { success: true, house: h };
  }

  getNearbyHouseInfo() {
    if (!this._nearestHouse) return null;
    return {
      name: this._nearestHouse.name,
      price: this._nearestHouse.price,
      owned: this._nearestHouse.owned,
      income: this._nearestHouse.income
    };
  }

  getOwnedHouses() {
    return this.houses.filter(h => h.owned);
  }
}
