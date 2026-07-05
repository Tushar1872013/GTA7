/**
 * PedestrianSystem — NPCs that walk on sidewalks / open areas.
 *
 * Simple wander behavior: each pedestrian has a target waypoint, walks
 * toward it at a slow pace, picks a new nearby waypoint on arrival.
 * They flee from the player's vehicle if it gets too close + fast.
 *
 * Purely visual (no physics) — they're decorative for Phase 3.
 */
import * as THREE from 'three';

export class PedestrianSystem {
  constructor({ scene, world, count = 30 }) {
    this.scene = scene;
    this.world = world;
    this.peds = [];
    this.root = new THREE.Group();
    this.root.name = 'Pedestrians';
    scene.add(this.root);

    for (let i = 0; i < count; i++) this._spawnPed();
  }

  _spawnPed() {
    // NPC types with different clothing + body types
    const npcTypes = [
      { name: 'business', shirt: 0x1a1a2e, pants: 0x2a2a35, skin: 0xf0c090, scale: 1.0 },
      { name: 'tourist', shirt: 0xfbc02d, pants: 0x1976d2, skin: 0xe6b88a, scale: 1.0 },
      { name: 'police', shirt: 0x1a237e, pants: 0x0a0a14, skin: 0xf0c090, scale: 1.05 },
      { name: 'worker', shirt: 0xff6f00, pants: 0x424242, skin: 0xc69569, scale: 1.1 },
      { name: 'vendor', shirt: 0xd32f2f, pants: 0x4a2f1a, skin: 0x8d5524, scale: 0.95 },
      { name: 'rider', shirt: 0x2e7d32, pants: 0x1a1a1a, skin: 0xf0c090, scale: 1.0 },
      { name: 'casual', shirt: 0x7b1fa2, pants: 0x424242, skin: 0xffdbac, scale: 0.95 },
      { name: 'elderly', shirt: 0x558b2f, pants: 0x6d4c41, skin: 0xd4a574, scale: 0.9 }
    ];
    const type = npcTypes[Math.floor(Math.random() * npcTypes.length)];

    const skinMat = new THREE.MeshStandardMaterial({ color: type.skin, roughness: 0.6 });
    const clothMat = new THREE.MeshStandardMaterial({ color: type.shirt, roughness: 0.75 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: type.pants, roughness: 0.85 });

    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), skinMat);
    head.position.y = 1.72; head.castShadow = true;
    // Hair
    const hairColors = [0x2a1810, 0x000000, 0x8b4513, 0xd4a017];
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: hairColors[Math.floor(Math.random()*hairColors.length)], roughness: 0.8 }));
    hair.position.y = 1.78;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 8), clothMat);
    torso.position.y = 1.2; torso.castShadow = true;
    const armGeo = new THREE.CapsuleGeometry(0.06, 0.45, 4, 6);
    const armL = new THREE.Mesh(armGeo, clothMat); armL.position.set(-0.27, 1.25, 0);
    const armR = new THREE.Mesh(armGeo, clothMat); armR.position.set( 0.27, 1.25, 0);
    const legGeo = new THREE.CapsuleGeometry(0.09, 0.5, 4, 6);
    const legL = new THREE.Mesh(legGeo, pantsMat); legL.position.set(-0.1, 0.45, 0);
    const legR = new THREE.Mesh(legGeo, pantsMat); legR.position.set( 0.1, 0.45, 0);
    g.add(head, hair, torso, armL, armR, legL, legR);
    g.scale.setScalar(type.scale * (0.9 + Math.random() * 0.2));

    // Spawn at a random road point
    const { point } = this.world.randomRoadPoint();
    g.position.copy(point);
    g.position.y = 0;
    g.position.x += (Math.random() - 0.5) * 8;
    g.position.z += (Math.random() - 0.5) * 8;

    g.userData = {
      speed: type.name === 'elderly' ? 0.7 : (1.0 + Math.random() * 0.8),
      target: this._pickTarget(g.position),
      walkPhase: Math.random() * Math.PI * 2,
      parts: { head, torso, armL, armR, legL, legR },
      fleeing: false,
      type: type.name
    };
    this.root.add(g);
    this.peds.push(g);
  }

  _pickTarget(from) {
    // Pick a point 10-30 units away
    const ang = Math.random() * Math.PI * 2;
    const r = 10 + Math.random() * 20;
    return new THREE.Vector3(from.x + Math.cos(ang) * r, 0, from.z + Math.sin(ang) * r);
  }

  update(dt, playerPos, playerSpeed) {
    for (const ped of this.peds) {
      const ud = ped.userData;
      const toPlayer = new THREE.Vector3().subVectors(playerPos, ped.position);
      const dist = toPlayer.length();

      // Flee if player is close + fast
      ud.fleeing = (dist < 8 && playerSpeed > 8);
      let speed = ud.speed;
      if (ud.fleeing) {
        speed = 4.5; // run away
        ud.target.copy(ped.position).sub(toPlayer.setLength(20));
      } else {
        const toTarget = new THREE.Vector3().subVectors(ud.target, ped.position);
        if (toTarget.length() < 1.5) {
          ud.target = this._pickTarget(ped.position);
        }
      }

      // Move toward target
      const dir = new THREE.Vector3().subVectors(ud.target, ped.position).setY(0).normalize();
      ped.position.x += dir.x * speed * dt;
      ped.position.z += dir.z * speed * dt;

      // Face direction
      const targetYaw = Math.atan2(dir.x, dir.z);
      let diff = targetYaw - ped.rotation.y;
      while (diff > Math.PI)  diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.rotation.y += diff * Math.min(1, dt * 6);

      // Walk animation
      ud.walkPhase += dt * (ud.fleeing ? 14 : 8);
      const sw = Math.sin(ud.walkPhase) * 0.5;
      ud.parts.legL.rotation.x = sw;
      ud.parts.legR.rotation.x = -sw;
      ud.parts.armL.rotation.x = -sw * 0.6;
      ud.parts.armR.rotation.x = sw * 0.6;
    }
  }
}
