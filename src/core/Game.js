/**
 * Game — orchestrates everything (Phase 1-5).
 *
 * Owns: renderer, scene, camera, physics, environment, world, traffic,
 *       player, vehicles, all systems, controls, HUD. Runs the main loop.
 */
import * as THREE from 'three';
import { Renderer } from './Renderer.js';
import { CameraRig } from './Camera.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { Environment } from '../environment/Environment.js';
import { WeatherSystem } from '../environment/WeatherSystem.js';
import { WindAnimation } from '../environment/WindAnimation.js';
import { VegetationSystem } from '../environment/VegetationSystem.js';
import { WaterSystem } from '../environment/WaterSystem.js';
import { ParticleSystem } from '../environment/ParticleSystem.js';
import { World } from '../world/World.js';
import { RoadSystem } from '../world/RoadSystem.js';
import { BuildingGenerator } from '../world/BuildingGenerator.js';
import { TrafficSystem } from '../traffic/TrafficSystem.js';
import { Player } from '../player/Player.js';
import { Bike } from '../vehicles/Bike.js';
import { Car } from '../vehicles/Car.js';
import { Controls } from '../player/Controls.js';
import { HUD } from '../ui/HUD.js';
import { FuelSystem } from '../systems/FuelSystem.js';
import { PedestrianSystem } from '../systems/PedestrianSystem.js';
import { PoliceSystem } from '../systems/PoliceSystem.js';
import { StuntSystem } from '../systems/StuntSystem.js';
import { MissionSystem } from '../systems/MissionSystem.js';
import { DistanceCuller } from '../systems/DistanceCuller.js';
import { LODManager } from '../systems/LODManager.js';
import { CharacterCustomizer } from '../systems/CharacterCustomizer.js';
import { HousesSystem } from '../systems/HousesSystem.js';
import { BusinessesSystem } from '../systems/BusinessesSystem.js';
import { MultiplayerSystem } from '../systems/MultiplayerSystem.js';
import { VoiceChatSystem } from '../systems/VoiceChatSystem.js';
import { GarageSystem } from '../systems/GarageSystem.js';
import { RaceSystem } from '../systems/RaceSystem.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { PhoneSystem } from '../systems/PhoneSystem.js';
import { WorldProps } from '../world/WorldProps.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.onStart = null;
    this.lastTime = performance.now();
    this._running = false;
    this._started = false;
    this.quality = this._detectQuality();
    this.riding = false;
    this.activeVehicle = null;
  }

  _detectQuality() {
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    if (mem <= 2 || cores <= 2) return 'low';
    if (mem <= 4 || cores <= 4) return 'medium';
    return 'high';
  }

  async init() {
    // === Three core ===
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 8, -14);

    this.renderer = new Renderer(this.container);
    this.renderer.setQuality(this.quality);
    this.renderer.setClearColor(0x6a82a8, 1);
    this.renderer.setFog(this.scene, 0x6a82a8, 80, 450);

    // === Physics ===
    this.physics = new PhysicsWorld();
    this.physics.addGround(3000);

    // === Environment ===
    this.environment = new Environment({ scene: this.scene, renderer: this.renderer.renderer });
    this.weather = new WeatherSystem({ scene: this.scene, world: null, environment: this.environment });
    this.wind = new WindAnimation({ scene: this.scene });

    // === World ===
    this.world = new World({ scene: this.scene, physics: this.physics });
    this.weather.world = this.world;

    // === Road System (detailed PBR roads) ===
    this.roadSystem = new RoadSystem({ scene: this.scene, world: this.world });
    this.roadSystem.buildFromSegments(this.world.roadSegments.slice(0, 50));

    // === World Props (street lamps, trees, benches, etc.) ===
    this.worldProps = new WorldProps({ scene: this.scene, world: this.world });

    // === Building Generator (for future modular buildings) ===
    this.buildingGen = new BuildingGenerator();

    // === Vegetation (grass fields, flowers) ===
    this.vegetation = new VegetationSystem({ scene: this.scene, world: this.world });

    // === Water (ocean, lake, marina) ===
    this.water = new WaterSystem({ scene: this.scene });

    // === Particles (exhaust, nitro, rain splash) ===
    this.particles = new ParticleSystem({ scene: this.scene });

    // === Traffic ===
    this.traffic = new TrafficSystem({
      scene: this.scene, city: this.world,
      count: this.quality === 'low' ? 8 : (this.quality === 'medium' ? 14 : 20)
    });

    // === Player + Vehicles ===
    this.cameraRig = new CameraRig(this.camera);
    this.cameraRig.setCollidables(this.world.getCameraCollidables());

    this.player = new Player({ scene: this.scene, physics: this.physics, cameraRig: this.cameraRig });
    this.player.setColliders(this.world.colliders);

    this.bike = new Bike({ scene: this.scene, physics: this.physics, variant: 0 });
    this.bike.setColliders(this.world.colliders);
    this.bike.resetTo(new THREE.Vector3(-2, 0.5, 4));

    this.car = new Car({ scene: this.scene, physics: this.physics, variant: 0 });
    this.car.setColliders(this.world.colliders);
    this.car.resetTo(new THREE.Vector3(2, 0.5, 4));

    this.activeVehicle = this.bike;
    this.activeVehicleType = 'bike';

    this.player.resetTo(new THREE.Vector3(0, 0.5, 8));
    this.cameraRig.setTarget(this.player.group);
    this.riding = false;

    // === Controls + HUD ===
    this.controls = new Controls(this.renderer.domElement);
    this.hud = new HUD({ world: this.world, player: this.player, bike: this.bike });

    // === Phase 3 Systems ===
    this.fuelSystem = new FuelSystem({ world: this.world, hud: this.hud });
    this.fuelSystem.setVehicle(this.bike);

    this.pedestrianSystem = new PedestrianSystem({
      scene: this.scene, world: this.world,
      count: this.quality === 'low' ? 15 : (this.quality === 'medium' ? 25 : 40)
    });

    this.policeSystem = new PoliceSystem({ scene: this.scene, world: this.world });
    this.policeSystem.onWantedChange = (w) => {
      this.hud.flash(`WANTED LEVEL: ${Math.ceil(w)} ★`, 2000);
    };

    this.stuntSystem = new StuntSystem({ world: this.world, hud: this.hud });
    this.missionSystem = new MissionSystem({ world: this.world, hud: this.hud });

    this.distanceCuller = new DistanceCuller({
      camera: this.camera,
      drawDistance: this.quality === 'low' ? 200 : (this.quality === 'medium' ? 280 : 350),
      cullInterval: 0.2
    });
    for (const b of this.world.buildings) this.distanceCuller.register(b);

    // === LOD Manager (distance-based detail reduction) ===
    this.lodManager = new LODManager({ camera: this.camera, updateInterval: 0.5 });

    // === Phase 4 Systems ===
    this.economy = new EconomySystem({ hud: this.hud });
    this.customizer = new CharacterCustomizer({ player: this.player, hud: this.hud });
    this.houses = new HousesSystem({ scene: this.scene, world: this.world, hud: this.hud });
    this.houses.onIncome = (amt) => this.economy.add(amt, 'House income');
    this.businesses = new BusinessesSystem({ scene: this.scene, world: this.world, hud: this.hud });
    this.businesses.onIncome = (amt) => this.economy.add(amt, 'Business income');
    this.multiplayer = new MultiplayerSystem({ scene: this.scene, player: this.player, hud: this.hud });
    this.voiceChat = new VoiceChatSystem({ multiplayer: this.multiplayer, hud: this.hud });

    // === Phase 5 Systems ===
    this.garage = new GarageSystem({ game: this, hud: this.hud, housesSystem: this.houses });
    this.raceSystem = new RaceSystem({ scene: this.scene, world: this.world, hud: this.hud });
    this.raceSystem.onComplete = (reward) => this.economy.add(reward, 'Race reward');
    this.phone = new PhoneSystem({
      game: this, hud: this.hud,
      housesSystem: this.houses, businessesSystem: this.businesses,
      economySystem: this.economy, customizer: this.customizer,
      multiplayer: this.multiplayer
    });

    // Create particle emitters for vehicles
    this.particles.createExhaust(this.bike);
    this.particles.createExhaust(this.car);
    this.particles.createNitro(this.bike);
    this.particles.createNitro(this.car);

    // === Events ===
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);

    // === Post-processing: wire scene + camera to composer ===
    this.renderer.setSceneCamera(this.scene, this.camera);

    // === Loop ===
    this._running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this._loop.bind(this));
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  _switchVehicleType() {
    if (this.activeVehicleType === 'bike') {
      this.activeVehicleType = 'car';
      this.activeVehicle = this.car;
      this.hud.flash(`Switched to CAR (${this.car.variantName})`, 2000);
    } else {
      this.activeVehicleType = 'bike';
      this.activeVehicle = this.bike;
      this.hud.flash(`Switched to BIKE (${this.bike.variantName})`, 2000);
    }
    const p = this.player.body.position;
    const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0,1,0), this.player.group.rotation.y);
    this.activeVehicle.resetTo(new THREE.Vector3(p.x + fwd.x * 3, 0.5, p.z + fwd.z * 3));
    this.fuelSystem.setVehicle(this.activeVehicle);
  }

  _switchToVehicle(type, variant) {
    this.activeVehicleType = type;
    this.activeVehicle = type === 'bike' ? this.bike : this.car;
    this.activeVehicle.variant = variant;
    this.activeVehicle._applyVariant();
    const p = this.player.body.position;
    const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0,1,0), this.player.group.rotation.y);
    this.activeVehicle.resetTo(new THREE.Vector3(p.x + fwd.x * 3, 0.5, p.z + fwd.z * 3));
    this.fuelSystem.setVehicle(this.activeVehicle);
    this.hud.flash(`Switched to ${this.activeVehicle.variantName}`, 2000);
  }

  _switchVariant() {
    const name = this.activeVehicle.cycleVariant();
    this.hud.flash(`${this.activeVehicleType.toUpperCase()} variant: ${name}`, 1800);
  }

  _tryEnterBike() {
    if (this.riding) {
      this.riding = false;
      this.player.state = 'onFoot';
      this.player.setVisible(true);
      this.player.setPhysicsEnabled(true);
      const offset = new THREE.Vector3(-2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.activeVehicle.yaw);
      this.player.resetTo(this.activeVehicle.group.position.clone().add(offset));
      this.cameraRig.setTarget(this.player.group);
      this.hud.setActiveVehicle(null);
      this.hud.setInfo('Press <b>F</b> to enter vehicle · <b>P</b> phone · <b>G</b> garage');
      return;
    }
    const dist = this.player.body.position.distanceTo(this.activeVehicle.body.position);
    if (dist < 6) {
      this.riding = true;
      this.player.state = 'onBike';
      this.player.setVisible(false);
      this.player.setPhysicsEnabled(false);
      this.cameraRig.setTarget(this.activeVehicle.group);
      this.hud.setActiveVehicle(this.activeVehicle);
      this.hud.setInfo(`Riding · <b>WASD</b> drive · <b>Shift</b> boost · <b>F</b> exit · <b>T</b> voice`);
    } else {
      this.hud.flash(`Too far from ${this.activeVehicleType}`, 1500);
    }
  }

  _loop(now) {
    if (!this._running) return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this._update(dt);
    this.renderer.render(this.scene, this.camera);
    if (!this._started) {
      this._started = true;
      if (this.onStart) this.onStart();
    }
    requestAnimationFrame(this._loop.bind(this));
  }

  _checkCollisionsWithTraffic() {
    if (!this.riding || !this.activeVehicle) return;
    const vpos = this.activeVehicle.body.position;
    for (const car of this.traffic.cars) {
      const d = vpos.distanceTo(car.position);
      if (d < 2.5 && this.activeVehicle.speed > 8) {
        this.policeSystem.reportCrime(1);
        this.activeVehicle.speed *= 0.5;
        const pushDir = new THREE.Vector3().subVectors(car.position, vpos).setY(0).normalize();
        car.position.x += pushDir.x * 3;
        car.position.z += pushDir.z * 3;
        this.hud.flash('Hit a car! Wanted level up!', 1500);
        break;
      }
    }
    for (const ped of this.pedestrianSystem.peds) {
      const d = vpos.distanceTo(ped.position);
      if (d < 1.5 && this.activeVehicle.speed > 5) {
        this.policeSystem.reportCrime(2);
        const pushDir = new THREE.Vector3().subVectors(ped.position, vpos).setY(0).normalize();
        ped.position.x += pushDir.x * 5;
        ped.position.z += pushDir.z * 5;
        ped.position.y = 0.3;
        this.hud.flash('Hit a pedestrian! Wanted +1', 1500);
        break;
      }
    }
  }

  _update(dt) {
    this.controls.update();

    // Edge-triggered actions
    if (this.controls.consume('enter')) this._tryEnterBike();
    if (this.controls.consume('reset')) {
      if (this.riding) this.activeVehicle.resetTo(new THREE.Vector3(0, 0.5, 4));
      else this.player.resetTo(new THREE.Vector3(0, 0.5, 8));
    }
    if (this.controls.consume('camSwitch')) {
      this.hud.flash(`Camera: ${this.cameraRig.cycleMode().toUpperCase()}`, 1200);
    }
    if (this.controls.consume('timeToggle')) {
      this.environment.paused = !this.environment.paused;
      this.hud.flash(`Time: ${this.environment.paused ? 'PAUSED' : 'RUNNING'}`, 1200);
    }
    if (this.controls.consume('vehicleSwitch') && !this.riding) this._switchVehicleType();
    if (this.controls.consume('variantSwitch') && !this.riding) this._switchVariant();
    if (this.controls.consume('newMission')) {
      this.missionSystem._startNewMission();
      this.hud.flash('New mission assigned', 1500);
    }
    if (this.controls.consume('phone')) this.phone.toggle();
    if (this.controls.consume('garage')) this.garage.toggle();
    if (this.controls.consume('customize')) this.customizer.toggle();
    if (this.controls.consume('mpPanel')) this.multiplayer.togglePanel();
    if (this.controls.consume('buyHouse')) {
      const result = this.houses.tryBuy(this.economy.cash);
      if (result.success) {
        this.economy.spend(result.house.price, `House: ${result.house.name}`);
        this.hud.flash(` Bought ${result.house.name}! +$${result.house.income}/sec`, 3000);
      } else {
        this.hud.flash(result.reason, 2000);
      }
    }
    if (this.controls.consume('buyBusiness')) {
      const result = this.businesses.tryBuy(this.economy.cash);
      if (result.success) {
        this.economy.spend(result.business.price, `Business: ${result.business.name}`);
        this.hud.flash(`Bought ${result.business.name}! +$${result.business.income}/sec`, 3000);
      } else {
        this.hud.flash(result.reason, 2000);
      }
    }
    if (this.controls.consume('startRace')) {
      const nearby = this.raceSystem._nearbyRace;
      if (nearby) this.raceSystem.startRace(nearby.id);
      else if (this.raceSystem.currentRace) this.raceSystem.cancelRace();
      else this.hud.flash('No race nearby. Find a cyan marker.', 2000);
    }

    // Player / Vehicle update
    if (this.riding && this.activeVehicle) {
      this.activeVehicle.setThrottle(this.controls.state.forward);
      this.activeVehicle.setSteer(this.controls.state.left - this.controls.state.right);
      this.activeVehicle.setBrake(this.controls.state.brake || this.controls.state.back > 0);
      this.activeVehicle.setBoost(this.controls.state.boost);
      this.activeVehicle.update(dt, this.world);
      this.player.updateOnBike(dt, this.activeVehicle);
    } else {
      this.player.updateOnFoot(dt, this.controls, this.camera);
    }

    this.physics.step(dt);
    if (!this.riding) this.physics.syncMesh(this.player.body, this.player.group);

    // Systems update
    const targetPos = this.riding ? this.activeVehicle.group.position : this.player.group.position;
    const targetSpeed = this.riding ? this.activeVehicle.speed : this.player.speed;
    const playerYaw = this.riding ? this.activeVehicle.yaw : this.player.group.rotation.y;

    this.traffic.update(dt, targetPos, this.environment.isNight);
    this.pedestrianSystem.update(dt, targetPos, targetSpeed);
    this.policeSystem.update(dt, targetPos, targetSpeed, this.activeVehicle);
    this.fuelSystem.setVehicle(this.riding ? this.activeVehicle : null);
    this.fuelSystem.update(dt);
    if (this.riding) this.stuntSystem.update(dt, this.activeVehicle);
    this.missionSystem._lastVehiclePos = targetPos;
    this.missionSystem.update(dt, targetPos);

    // Phase 4 systems
    this.houses.update(dt, targetPos, this.economy.cash);
    this.businesses.update(dt, targetPos);
    this.multiplayer.update(dt, targetPos, playerYaw, this.riding);
    this.voiceChat.update(dt, targetPos, this.multiplayer.remotePlayers);

    // Phase 5 systems
    this.raceSystem.update(dt, targetPos);
    this.phone.update(dt);

    this._checkCollisionsWithTraffic();

    this.environment.update(dt);
    this.weather.update(dt, targetPos);
    this.wind.update(dt);
    this.water.update(dt);
    this.vegetation && null; // vegetation is static
    this.particles.update(dt, this.riding ? this.activeVehicle : null, this.weather.current === 'rain' || this.weather.current === 'storm');
    this.world.updateAnimated(dt, this.environment.timeOfDay);
    this.worldProps.update(dt, this.environment.isNight ? 1 : 0);
    this.roadSystem.update(dt, this.environment.isNight);
    // Update building night lights
    const nightFactor = this.environment.isNight ? 1 : Math.max(0, -Math.sin(this.environment.timeOfDay * Math.PI * 2));
    this.buildingGen.updateNightLights(nightFactor);
    this.cameraRig.update(dt);
    this.distanceCuller.update(dt);
    this.lodManager.update(dt);

    // HUD update
    this.hud.update(dt, this.riding, {
      wanted: this.policeSystem.wanted,
      money: this.economy.cash,
      mission: this.missionSystem.getObjectiveText(),
      stunt: this.stuntSystem.totalScore,
      missionPickup: this.missionSystem.current?.hasCargo ? null : this.missionSystem.current?.pickup,
      missionDropoff: this.missionSystem.current?.hasCargo ? this.missionSystem.current?.dropoff : null
    });

    this._adaptQuality(dt);
  }

  _adaptQuality(dt) {
    if (!this._adaptAccum) { this._adaptAccum = 0; this._adaptLowFrames = 0; }
    this._adaptAccum += dt;
    if (this._adaptAccum > 1) {
      const fps = this.hud._fpsValue;
      if (fps && fps < 35) this._adaptLowFrames++;
      else this._adaptLowFrames = Math.max(0, this._adaptLowFrames - 1);
      this._adaptAccum = 0;
      if (this._adaptLowFrames > 3 && this.quality !== 'low') {
        this.quality = this.quality === 'high' ? 'medium' : 'low';
        this.renderer.setQuality(this.quality);
        console.warn('[Game] Auto-downgraded quality to', this.quality);
        this._adaptLowFrames = 0;
      }
    }
  }
}
