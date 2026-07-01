/**
 * WorldProps — AAA street props scattered every 15-20m along roads.
 *
 * Props include: street lamps, traffic poles, trees, palm trees, bushes,
 * flowers, benches, garbage bins, fire hydrants, bike racks, mailboxes,
 * bus stops, electric poles, parking meters, ad boards, ATMs, phone booths,
 * construction barriers, road cones.
 *
 * Uses shared geometries/materials for performance. Props are tagged with
 * userData.nightLight for night-time emissive adjustments.
 */
import * as THREE from 'three';

export class WorldProps {
  constructor({ scene, world }) {
    this.scene = scene;
    this.world = world;
    this.root = new THREE.Group();
    this.root.name = 'WorldProps';
    scene.add(this.root);

    this.nightLights = []; // meshes with emissive night lights

    this._mats = this._createMaterials();
    this._buildAllProps();
  }

  _createMaterials() {
    return {
      metal: new THREE.MeshStandardMaterial({ color: 0x607080, metalness: 0.7, roughness: 0.4 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x2a2a35, metalness: 0.6, roughness: 0.5 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.85 }),
      concrete: new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.9 }),
      red: new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.6, metalness: 0.3 }),
      green: new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.8 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xfbc02d, roughness: 0.6 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.85 }),
      trunk: new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 }),
      black: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }),
      blue: new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.5, metalness: 0.4 }),
      white: new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.5 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x4fc3f7, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.5 }),
      orange: new THREE.MeshStandardMaterial({ color: 0xff6f00, roughness: 0.6, emissive: 0xff6f00, emissiveIntensity: 0.2 })
    };
  }

  _buildAllProps() {
    const segments = this.world.roadSegments;
    const step = Math.max(1, Math.floor(segments.length / 50));
    let decorated = 0;
    for (let i = 0; i < segments.length && decorated < 50; i += step) {
      this._decorateRoad(segments[i]);
      decorated++;
    }
  }

  _decorateRoad(seg) {
    const dir = new THREE.Vector3().subVectors(seg.b, seg.a).normalize();
    const length = seg.a.distanceTo(seg.b);
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const spacing = 18; // every 18 meters

    for (let d = 12; d < length; d += spacing) {
      const t = d / length;
      const pos = new THREE.Vector3().lerpVectors(seg.a, seg.b, t);
      const side = (Math.floor(d / spacing)) % 2 === 0 ? 1 : -1;
      const offset = perp.clone().multiplyScalar(side * 4.5);

      const propType = Math.floor(d / spacing) % 12;
      const propPos = pos.clone().add(offset);

      switch (propType) {
        case 0: this._addStreetLamp(propPos); break;
        case 1: this._addTree(propPos, false); break;
        case 2: this._addPalmTree(propPos); break;
        case 3: this._addBench(propPos, dir); break;
        case 4: this._addHydrant(propPos); break;
        case 5: this._addTrashBin(propPos); break;
        case 6: this._addBusStop(propPos, dir); break;
        case 7: this._addMailbox(propPos); break;
        case 8: this._addElecPole(propPos); break;
        case 9: this._addBillboard(propPos, dir); break;
        case 10: this._addParkingMeter(propPos); break;
        case 11: this._addBush(propPos); break;
      }
    }
  }

  _addStreetLamp(pos) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 8), this._mats.darkMetal);
    pole.position.y = 3.5; pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), this._mats.darkMetal);
    arm.position.set(0.9, 6.8, 0);
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), this._mats.darkMetal);
    fixture.position.set(1.7, 6.7, 0);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff4d6, emissive: 0xffd97a, emissiveIntensity: 1.5
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), bulbMat);
    bulb.position.set(1.7, 6.5, 0);
    g.add(pole, arm, fixture, bulb);
    g.position.copy(pos);
    this.root.add(g);
    this.nightLights.push({ mesh: bulb, mat: bulbMat, dayIntensity: 0.1, nightIntensity: 1.5 });
  }

  _addTree(pos, isPalm = false) {
    if (isPalm) return this._addPalmTree(pos);
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.5, 6), this._mats.trunk);
    trunk.position.y = 1.25; trunk.castShadow = true;
    const f1 = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), this._mats.leaf);
    f1.position.y = 3; f1.castShadow = true;
    f1.userData.wind = true; f1.userData.windAmp = 0.06;
    const f2 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), this._mats.leaf);
    f2.position.y = 4; f2.castShadow = true;
    f2.userData.wind = true; f2.userData.windAmp = 0.1;
    const f3 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), this._mats.leaf);
    f3.position.y = 4.8; f3.castShadow = true;
    f3.userData.wind = true; f3.userData.windAmp = 0.13;
    g.add(trunk, f1, f2, f3);
    g.position.copy(pos);
    g.scale.setScalar(0.8 + Math.random() * 0.4);
    this.root.add(g);
  }

  _addPalmTree(pos) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 7, 8), this._mats.trunk);
    trunk.position.y = 3.5; trunk.castShadow = true;
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.6, 4, 4), this._mats.leaf);
      const ang = (i / 7) * Math.PI * 2;
      leaf.position.set(Math.cos(ang) * 1.5, 7.5, Math.sin(ang) * 1.5);
      leaf.rotation.z = Math.cos(ang) * 0.6;
      leaf.rotation.x = Math.sin(ang) * 0.6;
      leaf.castShadow = true;
      leaf.userData.wind = true; leaf.userData.windAmp = 0.08;
      g.add(leaf);
    }
    g.add(trunk);
    g.position.copy(pos);
    g.scale.setScalar(0.9 + Math.random() * 0.3);
    this.root.add(g);
  }

  _addBush(pos) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), this._mats.leaf);
      b.position.set((Math.random() - 0.5) * 0.8, 0.3, (Math.random() - 0.5) * 0.8);
      b.scale.setScalar(0.8 + Math.random() * 0.4);
      b.castShadow = true;
      b.userData.wind = true; b.userData.windAmp = 0.04;
      g.add(b);
    }
    g.position.copy(pos);
    this.root.add(g);
  }

  _addBench(pos, facing) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.5), this._mats.wood);
    seat.position.y = 0.45; seat.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.08), this._mats.wood);
    back.position.set(0, 0.72, -0.2);
    for (const x of [-0.9, 0.9]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.45), this._mats.darkMetal);
      leg.position.set(x, 0.22, 0);
      g.add(leg);
    }
    g.add(seat, back);
    g.position.copy(pos);
    g.rotation.y = Math.atan2(facing.x, facing.z);
    this.root.add(g);
  }

  _addHydrant(pos) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.2, 8), this._mats.red);
    base.position.y = 0.1;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8), this._mats.red);
    body.position.y = 0.5; body.castShadow = true;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), this._mats.red);
    top.position.y = 0.9;
    g.add(base, body, top);
    g.position.copy(pos);
    this.root.add(g);
  }

  _addTrashBin(pos) {
    const g = new THREE.Group();
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1, 8), this._mats.darkMetal);
    bin.position.y = 0.5; bin.castShadow = true;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 8), this._mats.green);
    lid.position.y = 1.04;
    g.add(bin, lid);
    g.position.copy(pos);
    this.root.add(g);
  }

  _addBusStop(pos, facing) {
    const g = new THREE.Group();
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 2), this._mats.darkMetal);
    roof.position.y = 2.5; roof.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 0.1), this._mats.glass);
    back.position.set(0, 1.5, -0.95);
    for (const x of [-1.8, 1.8]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), this._mats.darkMetal);
      post.position.set(x, 1.25, -0.8);
      g.add(post);
    }
    // Sign
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x1976d2, emissive: 0x1976d2, emissiveIntensity: 0.5
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.05), signMat);
    sign.position.set(1.9, 2.8, 0);
    g.add(roof, back, sign);
    g.position.copy(pos);
    g.rotation.y = Math.atan2(facing.x, facing.z);
    this.root.add(g);
    this.nightLights.push({ mesh: sign, mat: signMat, dayIntensity: 0.3, nightIntensity: 0.8 });
  }

  _addMailbox(pos) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.3), this._mats.blue);
    box.position.y = 0.3; box.castShadow = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.25, 8, 1, false, 0, Math.PI), this._mats.blue);
    top.position.y = 0.7; top.rotation.z = Math.PI / 2;
    g.add(box, top);
    g.position.copy(pos);
    this.root.add(g);
  }

  _addElecPole(pos) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 10, 8), this._mats.trunk);
    pole.position.y = 5; pole.castShadow = true;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 0.08), this._mats.trunk);
    bar.position.y = 9;
    for (const x of [-1.2, 0, 1.2]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6), this._mats.concrete);
      ins.position.set(x, 9.15, 0);
      g.add(ins);
    }
    g.add(pole, bar);
    g.position.copy(pos);
    this.root.add(g);
  }

  _addBillboard(pos, facing) {
    const g = new THREE.Group();
    const poles = [];
    for (const x of [-1.5, 1.5]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), this._mats.darkMetal);
      pole.position.set(x, 2.5, 0); pole.castShadow = true;
      poles.push(pole);
      g.add(pole);
    }
    const adColors = [0xe53935, 0x1976d2, 0x7b1fa2, 0x00838f, 0xff6f00];
    const color = adColors[Math.floor(Math.random() * adColors.length)];
    const boardMat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.3, roughness: 0.5
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 0.15), boardMat);
    board.position.y = 5;
    g.add(...poles, board);
    g.position.copy(pos);
    g.rotation.y = Math.atan2(facing.x, facing.z);
    this.root.add(g);
    this.nightLights.push({ mesh: board, mat: boardMat, dayIntensity: 0.15, nightIntensity: 0.6 });
  }

  _addParkingMeter(pos) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.2, 6), this._mats.darkMetal);
    pole.position.y = 0.6;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.15),
      new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffd54f, emissiveIntensity: 0.2 }));
    head.position.y = 1.4;
    g.add(pole, head);
    g.position.copy(pos);
    this.root.add(g);
  }

  update(dt, nightFactor) {
    // Adjust night light emissive intensities
    for (const nl of this.nightLights) {
      nl.mat.emissiveIntensity = nl.dayIntensity * (1 - nightFactor) + nl.nightIntensity * nightFactor;
    }
  }
}
