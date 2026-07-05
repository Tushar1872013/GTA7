/**
 * World — full open-world generator with 7 districts laid out along a north-south axis.
 *
 * Layout (each district is ~400×400 units):
 *
 *   [ Desert ]            z = -1200
 *      |
 *   [ Dubai Downtown ]    z = -800
 *      |
 *   [ Airport ]           z = -400
 *      |
 *   [ Highway ]           z =    0  (central, contains plaza + spawn)
 *      |
 *   [ Tokyo District ]    z =  400
 *      |
 *   [ Mountain Roads ]    z =  800
 *      |
 *   [ Village Area ]      z = 1200
 *
 * Each district has its own visual identity + collision colliders.
 * Districts are connected by a main highway (north-south road) and cross streets.
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { getAsphaltTexture, getConcreteTexture, getGlassTexture } from './PBRTextures.js';

export class World {
  constructor({ scene, physics }) {
    this.scene = scene;
    this.physics = physics;

    this.districtSize = 400;       // each district is 400x400
    this.districtSpacing = 400;    // centers spaced 400 apart (touching)

    this.districts = [];           // { name, center, bounds }
    this.colliders = [];           // physics bodies for collision
    this.buildings = [];           // meshes for camera collision + minimap
    this.roadSegments = [];        // {a, b, dir} for traffic + minimap
    this.fuelStations = [];        // { position, radius }
    this.stuntRamps = [];          // { mesh, body, position, forward }
    this.missionPoints = [];       // { position, name }
    this.poiMarkers = [];          // points of interest (for minimap)
    this.root = new THREE.Group();
    this.root.name = 'World';
    scene.add(this.root);

    this._buildGround();
    this._buildHighway();
    this._buildDesert();
    this._buildDubai();
    this._buildAirport();
    this._buildHighwayDistrict();
    this._buildTokyo();
    this._buildMountain();
    this._buildVillage();
  }

  // === Helpers ===
  _addBoxCollider(x, y, z, hx, hy, hz, rotation) {
    const body = this.physics.addBoxCollider({
      position: { x, y, z },
      halfExtents: { x: hx, y: hy, z: hz },
      rotation
    });
    this.colliders.push(body);
    return body;
  }

  _addBuilding(x, z, w, h, d, mat, options = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (options.rotation) mesh.rotation.y = options.rotation;
    this.root.add(mesh);
    this.buildings.push(mesh);
    this._addBoxCollider(x, h / 2, z, w / 2, h / 2, d / 2,
      options.rotation ? { x: 0, y: Math.sin(options.rotation / 2), z: 0, w: Math.cos(options.rotation / 2) } : null);

    // Add window interior lights (emissive) for night time
    if (options.windows !== false && h > 10) {
      this._addBuildingWindows(x, z, w, h, d, options.rotation);
    }

    // Add roof equipment (AC units, vents)
    if (h > 15 && Math.random() < 0.7) {
      this._addRoofDetails(x, z, w, h, d);
    }

    return mesh;
  }

  _addBuildingWindows(x, z, w, h, d, rotation) {
    // Small emissive panels on building faces (visible at night)
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      emissive: 0xffd97a,
      emissiveIntensity: 0,
      roughness: 0.2,
      metalness: 0.8
    });
    const winCount = Math.min(12, Math.floor(h / 8));
    for (let i = 0; i < winCount; i++) {
      const wy = (i + 0.5) * (h / winCount);
      const sides = [
        { ox: w/2 + 0.01, oz: 0, rot: Math.PI/2, sw: d * 0.7, sh: h / winCount * 0.6 },
        { ox: -w/2 - 0.01, oz: 0, rot: -Math.PI/2, sw: d * 0.7, sh: h / winCount * 0.6 },
        { ox: 0, oz: d/2 + 0.01, rot: 0, sw: w * 0.7, sh: h / winCount * 0.6 },
        { ox: 0, oz: -d/2 - 0.01, rot: Math.PI, sw: w * 0.7, sh: h / winCount * 0.6 }
      ];
      for (const s of sides) {
        if (Math.random() < 0.4) { // 40% chance window is lit
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(s.sw, s.sh),
            winMat.clone()
          );
          win.material.emissiveIntensity = 0.6 + Math.random() * 0.8;
          win.position.set(x + s.ox, wy, z + s.oz);
          win.rotation.y = s.rot + (rotation || 0);
          this.root.add(win);
          this.buildings.push(win); // for night visibility
        }
      }
    }
  }

  _addRoofDetails(x, z, w, h, d) {
    const detailMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.5 });
    // AC unit
    const ac = new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, 1, d * 0.2), detailMat);
    ac.position.set(x + (Math.random() - 0.5) * w * 0.5, h + 0.5, z + (Math.random() - 0.5) * d * 0.5);
    ac.castShadow = true;
    this.root.add(ac);
    // Vent pipe
    if (Math.random() < 0.5) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 8), detailMat);
      pipe.position.set(x + (Math.random() - 0.5) * w * 0.3, h + 1, z + (Math.random() - 0.5) * d * 0.3);
      this.root.add(pipe);
    }
  }

  _addRoadStrip(x1, z1, x2, z2, width = 10) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.1) return;
    const geo = new THREE.PlaneGeometry(len, width);
    geo.rotateX(-Math.PI / 2);
    // PBR asphalt material with procedural texture
    const asphalt = getAsphaltTexture();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2e,
      roughness: 0.9,
      metalness: 0.0,
      map: asphalt.map,
      roughnessMap: asphalt.roughnessMap
    });
    // Set texture repeat based on road length
    asphalt.map.repeat.set(len / 10, width / 10);
    asphalt.roughnessMap.repeat.set(len / 10, width / 10);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.roadSegments.push({
      a: new THREE.Vector3(x1, 0, z1),
      b: new THREE.Vector3(x2, 0, z2),
      dir: Math.abs(dx) > Math.abs(dz) ? 'ew' : 'ns'
    });
  }

  _buildGround() {
    // Massive ground plane covering all districts
    const total = this.districtSize * 8;
    const geo = new THREE.PlaneGeometry(total, total);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.95 });
    const ground = new THREE.Mesh(geo, mat);
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.root.add(ground);

    // Register districts
    const names = ['Desert', 'Dubai Downtown', 'Airport', 'Highway', 'Tokyo District', 'Mountain Roads', 'Village Area'];
    for (let i = 0; i < 7; i++) {
      const z = (i - 3) * this.districtSpacing;
      this.districts.push({
        name: names[i],
        center: new THREE.Vector3(0, 0, z),
        bounds: { minX: -this.districtSize / 2, maxX: this.districtSize / 2, minZ: z - this.districtSize / 2, maxZ: z + this.districtSize / 2 }
      });
    }
  }

  _buildHighway() {
    // Main north-south highway connecting all districts
    const start = -1500, end = 1500;
    const segments = 30;
    const segLen = (end - start) / segments;
    for (let i = 0; i < segments; i++) {
      this._addRoadStrip(0, start + i * segLen, 0, start + (i + 1) * segLen, 16);
    }
    // Lane markings (yellow dashes)
    const dashGeo = new THREE.PlaneGeometry(0.5, 3);
    dashGeo.rotateX(-Math.PI / 2);
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0x443300, emissiveIntensity: 0.3 });
    const dashCount = 100;
    const dashInst = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
    const m = new THREE.Matrix4();
    for (let i = 0; i < dashCount; i++) {
      const z = start + (i / dashCount) * (end - start);
      m.makeTranslation(0, 0.02, z);
      dashInst.setMatrixAt(i, m);
    }
    dashInst.instanceMatrix.needsUpdate = true;
    this.root.add(dashInst);

    // Side rails (low walls to prevent flying off)
    const railMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.4 });
    const railGeo = new THREE.BoxGeometry(0.5, 0.8, end - start);
    const railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(-8.5, 0.4, 0);
    const railR = new THREE.Mesh(railGeo, railMat);
    railR.position.set(8.5, 0.4, 0);
    this.root.add(railL, railR);
  }

  // === DISTRICT 1: DESERT (z = -1200) ===
  _buildDesert() {
    const cz = -1200;
    // Sand-colored ground patch
    const sandGeo = new THREE.PlaneGeometry(this.districtSize, this.districtSize);
    sandGeo.rotateX(-Math.PI / 2);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xd4a661, roughness: 1.0 });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.position.set(0, 0.005, cz);
    sand.receiveShadow = true;
    this.root.add(sand);

    // Dunes (low-poly hills)
    const duneMat = new THREE.MeshStandardMaterial({ color: 0xc9954a, roughness: 1.0 });
    for (let i = 0; i < 15; i++) {
      const x = (Math.random() - 0.5) * 360;
      const z = cz + (Math.random() - 0.5) * 360;
      if (Math.abs(x) < 30) continue; // keep highway clear
      const r = 15 + Math.random() * 25;
      const h = 4 + Math.random() * 8;
      const dune = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), duneMat);
      dune.position.set(x, 0, z);
      dune.scale.y = h / r;
      dune.receiveShadow = true;
      dune.castShadow = true;
      this.root.add(dune);
    }

    // Cacti / palm trees scattered
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3a, roughness: 0.85 });
    for (let i = 0; i < 25; i++) {
      const x = (Math.random() - 0.5) * 360;
      const z = cz + (Math.random() - 0.5) * 360;
      if (Math.abs(x) < 30) continue;
      const palm = this._makePalmTree(trunkMat, leafMat);
      palm.position.set(x, 0, z);
      this.root.add(palm);
    }

    // Pyramids (desert landmark)
    const pyrMat = new THREE.MeshStandardMaterial({ color: 0xb89766, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const pyr = new THREE.Mesh(new THREE.ConeGeometry(20, 28, 4), pyrMat);
      pyr.position.set(-90 + i * 35, 14, cz - 80);
      pyr.rotation.y = Math.PI / 4;
      pyr.castShadow = true;
      this.root.add(pyr);
      this._addBoxCollider(-90 + i * 35, 14, cz - 80, 14, 14, 14, { x: 0, y: Math.sin(Math.PI / 8), z: 0, w: Math.cos(Math.PI / 8) });
    }

    this.poiMarkers.push({ pos: new THREE.Vector3(0, 0, cz), label: 'Desert', color: '#d4a661' });
  }

  _makePalmTree(trunkMat, leafMat) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 6, 8), trunkMat);
    trunk.position.y = 3; trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4, 4), leafMat);
      const ang = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(ang) * 1.2, 6.5, Math.sin(ang) * 1.2);
      leaf.rotation.z = Math.cos(ang) * 0.5;
      leaf.rotation.x = Math.sin(ang) * 0.5;
      leaf.castShadow = true;
      g.add(leaf);
    }
    return g;
  }

  // === DISTRICT 2: DUBAI DOWNTOWN (z = -800) ===
  _buildDubai() {
    const cz = -800;
    const palette = [0xe6d3a3, 0xc9a978, 0x6db4d6, 0x4a90b8, 0x88c4dc, 0xecebe6, 0xd8d6cf];
    const windowTex = this._makeWindowTexture();

    // Burj Khalifa-style mega tower at center
    const burjMat = new THREE.MeshStandardMaterial({ color: 0xa8c5d8, metalness: 0.7, roughness: 0.2, map: windowTex });
    const burj = new THREE.Mesh(new THREE.CylinderGeometry(12, 22, 180, 8), burjMat);
    burj.position.set(0, 90, cz);
    burj.castShadow = true; burj.receiveShadow = true;
    this.root.add(burj);
    this._addBoxCollider(0, 90, cz, 18, 90, 18);
    // Spire
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2, 30, 8), burjMat);
    spire.position.set(0, 195, cz);
    this.root.add(spire);

    // Surrounding skyscrapers in a grid
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const r = 60 + Math.random() * 80;
      const x = Math.cos(ang) * r;
      const z = cz + Math.sin(ang) * r * 0.6;
      if (Math.abs(x) < 25 && Math.abs(z - cz) < 25) continue;
      const w = 12 + Math.random() * 14;
      const d = 12 + Math.random() * 14;
      const h = 40 + Math.random() * 100;
      const color = palette[Math.floor(Math.random() * palette.length)];
      const mat = new THREE.MeshStandardMaterial({
        color, metalness: 0.5, roughness: 0.3,
        map: Math.random() < 0.7 ? windowTex : null
      });
      this._addBuilding(x, z, w, h, d, mat);
    }

    // Palm Island (to the east, off the coast)
    this._buildPalmIsland(150, cz);

    // Luxury car dealership (just a fancy building)
    const dealerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.4, roughness: 0.2 });
    const dealer = new THREE.Mesh(new THREE.BoxGeometry(30, 8, 20), dealerMat);
    dealer.position.set(-40, 4, cz + 60);
    dealer.castShadow = true;
    this.root.add(dealer);
    this._addBoxCollider(-40, 4, cz + 60, 15, 4, 10);

    // Fuel station
    this._addFuelStation(40, cz - 60);

    // Stunt ramp (desert jump)
    this._addStuntRamp(0, cz + 150, 0);

    this.poiMarkers.push({ pos: new THREE.Vector3(0, 0, cz), label: 'Dubai', color: '#6db4d6' });
  }

  _buildPalmIsland(centerX, centerZ) {
    // Palm-shaped island using boxes for fronds + central trunk
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xe8d8a8, roughness: 1.0 });
    // Central trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(15, 18, 2, 16), sandMat);
    trunk.position.set(centerX, 0.05, centerZ);
    trunk.receiveShadow = true;
    this.root.add(trunk);
    // Fronds (8 spokes)
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.BoxGeometry(35, 1, 8), sandMat);
      frond.position.set(centerX + Math.cos(ang) * 22, 0.05, centerZ + Math.sin(ang) * 22);
      frond.rotation.y = -ang;
      frond.receiveShadow = true;
      this.root.add(frond);
    }
    // Luxury villas on fronds
    const villaMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.7 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const villa = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 8), villaMat);
      villa.position.set(centerX + Math.cos(ang) * 30, 3, centerZ + Math.sin(ang) * 30);
      villa.castShadow = true;
      this.root.add(villa);
      this._addBoxCollider(centerX + Math.cos(ang) * 30, 3, centerZ + Math.sin(ang) * 30, 4, 3, 4);
    }
  }

  // === DISTRICT 3: AIRPORT (z = -400) ===
  _buildAirport() {
    const cz = -400;
    // Concrete ground
    const concGeo = new THREE.PlaneGeometry(this.districtSize, this.districtSize);
    concGeo.rotateX(-Math.PI / 2);
    const concMat = new THREE.MeshStandardMaterial({ color: 0x555560, roughness: 0.95 });
    const conc = new THREE.Mesh(concGeo, concMat);
    conc.position.set(0, 0.005, cz);
    conc.receiveShadow = true;
    this.root.add(conc);

    // Runway (long dark strip with white markings)
    const runwayMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(40, 350), runwayMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0.02, cz);
    runway.receiveShadow = true;
    this.root.add(runway);
    // Runway markings (white dashes)
    const markMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444444, emissiveIntensity: 0.2 });
    const markGeo = new THREE.PlaneGeometry(1, 8);
    markGeo.rotateX(-Math.PI / 2);
    const markInst = new THREE.InstancedMesh(markGeo, markMat, 20);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 20; i++) {
      m.makeTranslation(0, 0.03, cz - 160 + i * 17);
      markInst.setMatrixAt(i, m);
    }
    markInst.instanceMatrix.needsUpdate = true;
    this.root.add(markInst);

    // Terminal building
    const termMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.3, roughness: 0.5 });
    const term = new THREE.Mesh(new THREE.BoxGeometry(120, 18, 30), termMat);
    term.position.set(-80, 9, cz);
    term.castShadow = true; term.receiveShadow = true;
    this.root.add(term);
    this._addBoxCollider(-80, 9, cz, 60, 9, 15);
    // Control tower
    const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 30, 8), termMat);
    towerBase.position.set(-130, 15, cz);
    towerBase.castShadow = true;
    this.root.add(towerBase);
    this._addBoxCollider(-130, 15, cz, 4, 15, 4);
    const towerTop = new THREE.Mesh(new THREE.CylinderGeometry(7, 5, 6, 8),
      new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.8, roughness: 0.2 }));
    towerTop.position.set(-130, 33, cz);
    this.root.add(towerTop);

    // Static airplane
    const plane = this._makeAirplane();
    plane.position.set(0, 0, cz - 80);
    plane.rotation.y = Math.PI / 2;
    this.root.add(plane);

    // Hangars
    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const hangar = new THREE.Mesh(new THREE.BoxGeometry(50, 18, 30), hangarMat);
      hangar.position.set(80, 9, cz - 60 + i * 40);
      hangar.castShadow = true;
      this.root.add(hangar);
      this._addBoxCollider(80, 9, cz - 60 + i * 40, 25, 9, 15);
    }

    this.poiMarkers.push({ pos: new THREE.Vector3(0, 0, cz), label: 'Airport', color: '#aaaaaa' });
  }

  _makeAirplane() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, metalness: 0.5, roughness: 0.3 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x1976d2, metalness: 0.5, roughness: 0.4 });
    // Fuselage
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 50, 16), bodyMat);
    fuse.rotation.z = Math.PI / 2;
    fuse.position.y = 6; fuse.castShadow = true;
    // Nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(4, 8, 16), accentMat);
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(29, 6, 0);
    // Wings
    const wingGeo = new THREE.BoxGeometry(14, 1, 50);
    const wing = new THREE.Mesh(wingGeo, bodyMat);
    wing.position.set(0, 5, 0); wing.castShadow = true;
    // Tail fin
    const tail = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 1), bodyMat);
    tail.position.set(-22, 11, 0);
    // Engines
    const engGeo = new THREE.CylinderGeometry(1.5, 1.5, 6, 12);
    engGeo.rotateZ(Math.PI / 2);
    const engL = new THREE.Mesh(engGeo, accentMat); engL.position.set(4, 4, -10);
    const engR = new THREE.Mesh(engGeo, accentMat); engR.position.set(4, 4, 10);
    g.add(fuse, nose, wing, tail, engL, engR);
    return g;
  }

  // === DISTRICT 4: HIGHWAY (z = 0, central) ===
  _buildHighwayDistrict() {
    const cz = 0;
    // Central plaza (spawn area)
    const plazaGeo = new THREE.CircleGeometry(12, 32);
    plazaGeo.rotateX(-Math.PI / 2);
    const plazaMat = new THREE.MeshStandardMaterial({ color: 0x3a4055, roughness: 0.8 });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.set(0, 0.01, cz);
    plaza.receiveShadow = true;
    this.root.add(plaza);

    // Cross-streets at this district
    this._addRoadStrip(-200, cz, 200, cz, 12);
    // Side buildings (shops, motels)
    const shopColors = [0xd32f2f, 0x388e3c, 0xfbc02d, 0x7b1fa2, 0x0288d1];
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (40 + Math.random() * 100);
      const z = cz + (Math.random() - 0.5) * 300;
      const w = 12 + Math.random() * 8;
      const d = 12 + Math.random() * 8;
      const h = 8 + Math.random() * 12;
      const mat = new THREE.MeshStandardMaterial({
        color: shopColors[Math.floor(Math.random() * shopColors.length)],
        roughness: 0.7, metalness: 0.2
      });
      this._addBuilding(x, z, w, h, d, mat);
    }

    // Fuel station
    this._addFuelStation(-30, cz + 40);

    // Stunt ramp at plaza
    this._addStuntRamp(20, cz + 20, Math.PI / 4);

    this.poiMarkers.push({ pos: new THREE.Vector3(0, 0, cz), label: 'Highway', color: '#4fc3f7' });
  }

  // === DISTRICT 5: TOKYO DISTRICT (z = 400) ===
  _buildTokyo() {
    const cz = 400;
    const palette = [0x2a2a3a, 0x1a1a2e, 0x14142b, 0x3a1a3a];
    const neonColors = [0xff3b6b, 0xff6b9d, 0x4fc3f7, 0x9b5fff, 0x00ffaa, 0xffd54f];
    const windowTex = this._makeWindowTexture(true);

    // Dense narrow-street grid — smaller blocks, tighter buildings
    for (let bx = -4; bx <= 4; bx++) {
      for (let bz = -4; bz <= 4; bz++) {
        const x = bx * 40;
        const z = cz + bz * 40;
        if (Math.abs(x) < 20 && Math.abs(z - cz) < 20) continue;
        // Narrow streets between blocks
        if (bx % 2 === 0) this._addRoadStrip(x, cz - 200, x, cz + 200, 6);
        if (bz % 2 === 0) this._addRoadStrip(-200, z, 200, z, 6);

        // Building cluster (narrow, tall, dense)
        for (let s = 0; s < 3; s++) {
          const ox = x + (Math.random() - 0.5) * 25;
          const oz = z + (Math.random() - 0.5) * 25;
          const w = 8 + Math.random() * 6;
          const d = 8 + Math.random() * 6;
          const h = 20 + Math.random() * 50;
          const color = palette[Math.floor(Math.random() * palette.length)];
          const mat = new THREE.MeshStandardMaterial({
            color, roughness: 0.7, metalness: 0.2,
            map: windowTex
          });
          const mesh = this._addBuilding(ox, oz, w, h, d, mat);
          // Neon sign on building
          if (Math.random() < 0.5) {
            const neonColor = neonColors[Math.floor(Math.random() * neonColors.length)];
            const signMat = new THREE.MeshStandardMaterial({
              color: 0x0a0a14, emissive: neonColor, emissiveIntensity: 1.8, roughness: 0.5
            });
            const sign = new THREE.Mesh(new THREE.BoxGeometry(0.3, h * 0.4, 1.2), signMat);
            sign.position.set(ox + w / 2 + 0.2, h * 0.55, oz);
            this.root.add(sign);
          }
        }
      }
    }

    // Anime shops — brightly colored storefronts
    const animeColors = [0xff69b4, 0xff1493, 0xdda0dd, 0xffb6c1];
    for (let i = 0; i < 8; i++) {
      const x = (Math.random() - 0.5) * 300;
      const z = cz + (Math.random() - 0.5) * 300;
      const mat = new THREE.MeshStandardMaterial({
        color: animeColors[Math.floor(Math.random() * animeColors.length)],
        emissive: animeColors[Math.floor(Math.random() * animeColors.length)],
        emissiveIntensity: 0.4, roughness: 0.5
      });
      const shop = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), mat);
      shop.position.set(x, 3, z);
      shop.castShadow = true;
      this.root.add(shop);
      this._addBoxCollider(x, 3, z, 5, 3, 4);
    }

    // Tokyo Tower (red steel tower)
    this._buildTokyoTower(150, cz - 100);

    // Train system — elevated track + moving train
    this._buildTrainSystem(cz);

    // Fuel station
    this._addFuelStation(-60, cz + 80);

    this.poiMarkers.push({ pos: new THREE.Vector3(0, 0, cz), label: 'Tokyo', color: '#ff3b6b' });
  }

  _buildTokyoTower(x, z) {
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xff4500, metalness: 0.6, roughness: 0.4 });
    const g = new THREE.Group();
    // Four legs
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(1, 2, 40, 6), towerMat);
      leg.position.set(Math.cos(ang) * 10, 20, Math.sin(ang) * 10);
      leg.rotation.x = Math.sin(ang) * 0.3;
      leg.rotation.z = -Math.cos(ang) * 0.3;
      leg.castShadow = true;
      g.add(leg);
    }
    // Upper section
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 5, 50, 8), towerMat);
    upper.position.y = 65; upper.castShadow = true;
    g.add(upper);
    // Top antenna
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 20, 6), towerMat);
    ant.position.y = 100;
    g.add(ant);
    // Observation deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 14),
      new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffd54f, emissiveIntensity: 0.4 }));
    deck.position.y = 60;
    g.add(deck);
    g.position.set(x, 0, z);
    this.root.add(g);
    this._addBoxCollider(x, 40, z, 12, 40, 12);
  }

  _buildTrainSystem(cz) {
    // Elevated track running east-west
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x555560, metalness: 0.4, roughness: 0.6 });
    const track = new THREE.Mesh(new THREE.BoxGeometry(400, 2, 6), trackMat);
    track.position.set(0, 8, cz + 150);
    track.castShadow = true;
    this.root.add(track);
    // Support pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x444450, roughness: 0.8 });
    for (let i = -10; i <= 10; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 8, 8), pillarMat);
      p.position.set(i * 20, 4, cz + 150);
      this.root.add(p);
    }
    // Train (will be animated by TrainSystem — store ref)
    const trainGroup = new THREE.Group();
    trainGroup.name = 'Train';
    const carMat = new THREE.MeshStandardMaterial({ color: 0x00bcd4, metalness: 0.7, roughness: 0.3 });
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff4d6, emissiveIntensity: 0.5 });
    for (let c = 0; c < 3; c++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(28, 4, 3.5), carMat);
      car.position.x = c * 30;
      car.castShadow = true;
      trainGroup.add(car);
      // Windows
      for (let w = 0; w < 6; w++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 0.1), windowMat);
        win.position.set(car.position.x - 10 + w * 4, 1, 1.8);
        trainGroup.add(win);
      }
    }
    trainGroup.position.set(-200, 11, cz + 150);
    this.root.add(trainGroup);
    this.train = trainGroup;
  }

  // === DISTRICT 6: MOUNTAIN ROADS (z = 800) ===
  _buildMountain() {
    const cz = 800;
    // Rocky ground
    const rockGeo = new THREE.PlaneGeometry(this.districtSize, this.districtSize);
    rockGeo.rotateX(-Math.PI / 2);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4a45, roughness: 1.0 });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(0, 0.005, cz);
    rock.receiveShadow = true;
    this.root.add(rock);

    // Mountain peaks (cones)
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x5a5a55, roughness: 0.95 });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const x = (Math.random() - 0.5) * 360;
      const z = cz + (Math.random() - 0.5) * 360;
      if (Math.abs(x) < 30) continue;
      const r = 40 + Math.random() * 30;
      const h = 50 + Math.random() * 60;
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mountainMat);
      mountain.position.set(x, h / 2, z);
      mountain.castShadow = true; mountain.receiveShadow = true;
      this.root.add(mountain);
      // Snow cap
      if (h > 70) {
        const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, h * 0.2, 8), snowMat);
        snow.position.set(x, h * 0.9, z);
        this.root.add(snow);
      }
      this._addBoxCollider(x, h / 2, z, r * 0.7, h / 2, r * 0.7);
    }

    // Winding mountain road (zigzag)
    let prevX = 0, prevZ = cz - 180;
    for (let i = 0; i < 8; i++) {
      const newX = (i % 2 === 0 ? 1 : -1) * (40 + i * 5);
      const newZ = cz - 180 + (i + 1) * 45;
      this._addRoadStrip(prevX, prevZ, newX, newZ, 8);
      prevX = newX; prevZ = newZ;
    }

    // Stunt ramp at mountain base (big jump)
    this._addStuntRamp(0, cz - 100, 0, 2.0);

    // Pine trees
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2515, roughness: 0.9 });
    const needleMat = new THREE.MeshStandardMaterial({ color: 0x1a4a1a, roughness: 0.85 });
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 360;
      const z = cz + (Math.random() - 0.5) * 360;
      if (Math.abs(x) < 25) continue;
      const pine = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 6), trunkMat);
      trunk.position.y = 1.5; trunk.castShadow = true;
      pine.add(trunk);
      for (let layer = 0; layer < 3; layer++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(2 - layer * 0.5, 2.5, 8), needleMat);
        cone.position.y = 3 + layer * 1.5; cone.castShadow = true;
        pine.add(cone);
      }
      pine.position.set(x, 0, z);
      this.root.add(pine);
    }

    this.poiMarkers.push({ pos: new THREE.Vector3(0, 0, cz), label: 'Mountain', color: '#5a5a55' });
  }

  // === DISTRICT 7: VILLAGE (z = 1200) ===
  _buildVillage() {
    const cz = 1200;
    // Grass
    const grassGeo = new THREE.PlaneGeometry(this.districtSize, this.districtSize);
    grassGeo.rotateX(-Math.PI / 2);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 1.0 });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.position.set(0, 0.005, cz);
    grass.receiveShadow = true;
    this.root.add(grass);

    // Small village houses
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b3a2a, roughness: 0.85 });
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * 300;
      const z = cz + (Math.random() - 0.5) * 300;
      if (Math.abs(x) < 25 && Math.abs(z - cz) < 100) continue;
      const house = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), wallMat);
      walls.position.y = 3; walls.castShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 4, 4), roofMat);
      roof.position.y = 8; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
      house.add(walls, roof);
      house.position.set(x, 0, z);
      this.root.add(house);
      this._addBoxCollider(x, 3, z, 5, 3, 4);
    }

    // Village roads (dirt)
    for (let i = -3; i <= 3; i++) {
      this._addRoadStrip(-150, cz + i * 40, 150, cz + i * 40, 6);
    }

    // Farm field (alternating rows of green/yellow)
    const fieldMat1 = new THREE.MeshStandardMaterial({ color: 0x6b8e3a, roughness: 1.0 });
    const fieldMat2 = new THREE.MeshStandardMaterial({ color: 0xc4a942, roughness: 1.0 });
    for (let i = 0; i < 5; i++) {
      const field = new THREE.Mesh(new THREE.BoxGeometry(40, 0.1, 8), i % 2 === 0 ? fieldMat1 : fieldMat2);
      field.position.set(-100 + i * 12, 0.1, cz - 100);
      this.root.add(field);
    }

    // Windmill
    const windmillBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 15, 8), wallMat);
    windmillBase.position.set(80, 7.5, cz - 60);
    windmillBase.castShadow = true;
    this.root.add(windmillBase);
    this._addBoxCollider(80, 7.5, cz - 60, 3.5, 7.5, 3.5);
    const windmillRoof = new THREE.Mesh(new THREE.ConeGeometry(4, 4, 8), roofMat);
    windmillRoof.position.set(80, 19, cz - 60);
    this.root.add(windmillRoof);
    // Windmill blades (rotating group)
    const bladeGroup = new THREE.Group();
    bladeGroup.name = 'WindmillBlades';
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.3), bladeMat);
      blade.position.y = 4;
      const wrapper = new THREE.Group();
      wrapper.add(blade);
      wrapper.rotation.z = (i / 4) * Math.PI * 2;
      bladeGroup.add(wrapper);
    }
    bladeGroup.position.set(80, 18, cz - 56);
    this.root.add(bladeGroup);
    this.windmillBlades = bladeGroup;

    this.poiMarkers.push({ pos: new THREE.Vector3(0, 0, cz), label: 'Village', color: '#4a6a3a' });
  }

  // === Shared utility: window texture ===
  _makeWindowTexture(night = false) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = night ? '#0a0a18' : '#1a2540';
    g.fillRect(0, 0, c.width, c.height);
    const cols = 4, rows = 10;
    const cw = c.width / cols, ch = c.height / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const lit = Math.random();
        let color;
        if (night) {
          if (lit < 0.4) color = '#0a0a18';
          else if (lit < 0.7) color = '#ff6b9d';
          else if (lit < 0.85) color = '#4fc3f7';
          else color = '#ffd54f';
        } else {
          if (lit < 0.5) color = '#0a1020';
          else if (lit < 0.85) color = '#ffd97a';
          else color = '#7ec0ff';
        }
        g.fillStyle = color;
        g.fillRect(col * cw + 4, r * ch + 4, cw - 8, ch - 8);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 4);
    return tex;
  }

  // === Fuel station ===
  _addFuelStation(x, z) {
    const g = new THREE.Group();
    // Canopy
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, metalness: 0.3, roughness: 0.4 });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(20, 1, 12), canopyMat);
    canopy.position.y = 6; canopy.castShadow = true;
    g.add(canopy);
    // Pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7 });
    for (const px of [-9, 9]) {
      for (const pz of [-5, 5]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), pillarMat);
        p.position.set(px, 3, pz);
        g.add(p);
      }
    }
    // Pumps
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0x1976d2, metalness: 0.6, roughness: 0.4 });
    for (const px of [-3, 3]) {
      const pump = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 2), pumpMat);
      pump.position.set(px, 0.75, 0);
      g.add(pump);
    }
    g.position.set(x, 0, z);
    this.root.add(g);
    this.fuelStations.push({ position: new THREE.Vector3(x, 0, z), radius: 12 });
    this.poiMarkers.push({ pos: new THREE.Vector3(x, 0, z), label: 'Fuel', color: '#1976d2' });
  }

  // === Stunt ramp ===
  _addStuntRamp(x, z, yaw = 0, scale = 1.0) {
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xff6f00, roughness: 0.6, metalness: 0.3 });
    // Wedge shape using a custom geometry (BoxGeometry tilted won't work, use simple approach)
    const geo = new THREE.BoxGeometry(8, 0.3, 12);
    const ramp = new THREE.Mesh(geo, rampMat);
    ramp.position.set(x, 0.15, z);
    ramp.rotation.y = yaw;
    ramp.rotation.x = -0.4 * scale; // tilt up
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    this.root.add(ramp);
    this.stuntRamps.push({
      mesh: ramp,
      position: new THREE.Vector3(x, 0, z),
      forward: yaw,
      scale
    });
    this.poiMarkers.push({ pos: new THREE.Vector3(x, 0, z), label: 'Ramp', color: '#ff6f00' });
  }

  // === Public API ===
  getCameraCollidables() { return this.buildings; }

  randomRoadPoint() {
    if (!this.roadSegments.length) return { point: new THREE.Vector3(0, 0, 0), dir: 'ew' };
    const seg = this.roadSegments[Math.floor(Math.random() * this.roadSegments.length)];
    const t = Math.random();
    const p = new THREE.Vector3().lerpVectors(seg.a, seg.b, t);
    p.y = 0;
    return { point: p, dir: seg.dir };
  }

  getDistrictAt(pos) {
    for (const d of this.districts) {
      if (pos.x >= d.bounds.minX && pos.x <= d.bounds.maxX &&
          pos.z >= d.bounds.minZ && pos.z <= d.bounds.maxZ) {
        return d;
      }
    }
    return null;
  }

  // Animate non-static elements (windmill, train)
  updateAnimated(dt, timeOfDay) {
    if (this.windmillBlades) this.windmillBlades.rotation.z += dt * 0.5;
    if (this.train) {
      // Train moves east-west, wraps around
      const t = (performance.now() / 8000) % 2;
      const x = -200 + t * 400;
      this.train.position.x = x;
      // Dim windows at day
      const dayFactor = Math.max(0, Math.sin(timeOfDay * Math.PI * 2 - Math.PI / 2));
      this.train.children.forEach((c) => {
        if (c.material && c.material.emissive && c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y > 0.5) {
          c.material.emissiveIntensity = 0.2 + (1 - dayFactor) * 0.6;
        }
      });
    }
  }
}
