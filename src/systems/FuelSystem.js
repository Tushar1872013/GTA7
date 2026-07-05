/**
 * FuelSystem — manages fuel depletion for the player's active vehicle and
 * auto-refuel when stopped at a fuel station.
 *
 * Triggers UI events via the `onLowFuel` / `onRefuel` callbacks.
 */
export class FuelSystem {
  constructor({ world, hud }) {
    this.world = world;
    this.hud = hud;
    this.vehicle = null;       // currently active vehicle
    this.lowFuelWarned = false;
    this.refuelRate = 25;      // fuel per second when at a station
    this.onRefuelStart = null;
    this.onRefuelStop = null;
  }

  setVehicle(v) { this.vehicle = v; }

  update(dt) {
    if (!this.vehicle) return;

    // Check if at a fuel station
    let atStation = false;
    for (const st of this.world.fuelStations) {
      const d = st.position.distanceTo(this.vehicle.body.position);
      if (d < st.radius && this.vehicle.speed < 1) {
        atStation = true;
        break;
      }
    }

    if (atStation) {
      const before = this.vehicle.fuel;
      this.vehicle.refuel(this.refuelRate * dt);
      if (this.onRefuelStart) this.onRefuelStart(this.vehicle.fuel);
      this.lowFuelWarned = false;
    } else {
      if (this.onRefuelStop) this.onRefuelStop();
    }

    // Low fuel warning
    if (this.vehicle.fuel < 25 && !this.lowFuelWarned) {
      this.lowFuelWarned = true;
      if (this.hud) this.hud.flash('⚠ LOW FUEL — find a fuel station', 3000);
    }
  }
}
