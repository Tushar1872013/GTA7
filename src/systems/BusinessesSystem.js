/**
 * BusinessesSystem — Phase 4
 *
 * Buyable businesses that generate income. Types:
 *   - Car Wash
 *   - Restaurant
 *   - Auto Repair Shop
 *   - Nightclub
 *
 * Each business:
 *   - Has a position, price, income/sec, name
 *   - Can be purchased (press B when near — but B is taken, use the phone)
 *   - Generates passive income when owned
 *   - Visual: building with a sign
 */
import * as THREE from 'three';

export class BusinessesSystem {
  constructor({ scene, world, hud }) {
    this.scene = scene;
    this.world = world;
    this.hud = hud;

    this.businesses = [];
    this.owned = new Set();
    this.totalIncome = 0;
    this._incomeAccum = 0;

    this._spawnBusinesses();
  }

  _spawnBusinesses() {
    const defs = [
      { id: 'b1', name: 'Dubai Car Wash',      pos: [50, 0, -820],  price: 30000, income: 150, type: 'carwash' },
      { id: 'b2', name: 'Tokyo Nightclub',     pos: [40, 0, 440],   price: 50000, income: 250, type: 'nightclub' },
      { id: 'b3', name: 'Highway Diner',       pos: [-50, 0, 20],   price: 18000, income: 80,  type: 'restaurant' },
      { id: 'b4', name: 'Airport Auto Repair', pos: [60, 0, -380],  price: 22000, income: 100, type: 'repair' },
      { id: 'b5', name: 'Village Farm Market', pos: [-40, 0, 1180], price: 10000, income: 40,  type: 'restaurant' },
      { id: 'b6', name: 'Mountain Ski Resort', pos: [40, 0, 820],   price: 40000, income: 200, type: 'nightclub' }
    ];

    const colors = {
      carwash: 0x42a5f5,
      restaurant: 0xff9800,
      repair: 0x607d8b,
      nightclub: 0x9c27b0
    };
    const signText = {
      carwash: 'CAR WASH',
      restaurant: 'DINER',
      repair: 'AUTO REPAIR',
      nightclub: 'CLUB'
    };

    for (const d of defs) {
      const g = new THREE.Group();
      const color = colors[d.type];
      const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 });
      const signMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, emissive: color, emissiveIntensity: 1.2 });

      // Building
      const body = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 12), bodyMat);
      body.position.y = 4; body.castShadow = true;
      // Sign (vertical)
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 4), signMat);
      sign.position.set(8.5, 6, 0); sign.castShadow = true;
      // Door
      const door = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
      door.position.set(0, 2.5, 6.1);
      // Owned marker (hidden until bought)
      const ownedMarker = new THREE.Mesh(
        new THREE.TorusGeometry(9, 0.4, 8, 32),
        new THREE.MeshStandardMaterial({ color: 0x4caf50, emissive: 0x4caf50, emissiveIntensity: 0.8, transparent: true, opacity: 0 })
      );
      ownedMarker.rotation.x = Math.PI / 2;
      ownedMarker.position.y = 0.1;

      g.add(body, sign, door, ownedMarker);
      g.position.set(...d.pos);
      this.scene.add(g);

      // Canvas sign text
      const tex = this._makeSignTexture(signText[d.type], color);
      const signTextMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.5, 5.5),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      );
      signTextMesh.position.set(8.7, 6, 0);
      signTextMesh.rotation.y = Math.PI / 2;
      g.add(signTextMesh);

      this.businesses.push({
        ...d,
        position: new THREE.Vector3(...d.pos),
        owned: false,
        mesh: g,
        ownedMarker
      });
      this.world.poiMarkers.push({ pos: new THREE.Vector3(...d.pos), label: d.name, color: '#' + color.toString(16).padStart(6, '0') });
    }
  }

  _makeSignTexture(text, color) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#1a1a2e';
    g.fillRect(0, 0, c.width, c.height);
    const hex = '#' + color.toString(16).padStart(6, '0');
    g.fillStyle = hex;
    g.shadowColor = hex;
    g.shadowBlur = 20;
    g.font = 'bold 28px sans-serif';
    g.textAlign = 'center';
    // Wrap text
    const words = text.split(' ');
    let y = 110;
    for (const w of words) {
      g.fillText(w, 64, y);
      y += 40;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  update(dt, playerPos) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const b of this.businesses) {
      const d = b.position.distanceTo(playerPos);
      if (d < 12 && d < nearestDist) {
        nearest = b;
        nearestDist = d;
      }
    }
    this._nearestBusiness = nearest;

    if (this.totalIncome > 0) {
      this._incomeAccum += dt * this.totalIncome;
      if (this._incomeAccum >= 1) {
        const earned = Math.floor(this._incomeAccum);
        this._incomeAccum -= earned;
        if (this.onIncome) this.onIncome(earned);
      }
    }

    // Animate owned markers
    for (const b of this.businesses) {
      if (b.owned) {
        b.ownedMarker.rotation.z += dt * 0.5;
        const pulse = 1 + Math.sin(performance.now() / 600) * 0.1;
        b.ownedMarker.scale.set(pulse, pulse, 1);
      }
    }
  }

  tryBuy(money) {
    if (!this._nearestBusiness) return { success: false, reason: 'No business nearby' };
    const b = this._nearestBusiness;
    if (b.owned) return { success: false, reason: 'Already owned' };
    if (money < b.price) return { success: false, reason: `Need $${b.price}` };
    b.owned = true;
    b.ownedMarker.material.opacity = 0.6;
    this.owned.add(b.id);
    this.totalIncome += b.income;
    return { success: true, business: b };
  }

  getNearbyBusinessInfo() {
    if (!this._nearestBusiness) return null;
    return {
      name: this._nearestBusiness.name,
      price: this._nearestBusiness.price,
      owned: this._nearestBusiness.owned,
      income: this._nearestBusiness.income
    };
  }

  getOwnedBusinesses() {
    return this.businesses.filter(b => b.owned);
  }
}
