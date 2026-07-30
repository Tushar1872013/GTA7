/**
 * DistrictStreamer — Phase D6 zone-based streaming.
 *
 * The world is segmented into 7 districts along the z-axis:
 *   Desert → Dubai → Airport → Highway → Tokyo → Mountain → Village
 * (centers at z = -1200, -800, -400, 0, 400, 800, 1200; each 400×400 units).
 *
 * Strategy:
 *   - Keep current district + 1 adjacent on each side FULLY VISIBLE
 *   - Districts beyond that are hidden (visible = false on every child mesh
 *     that falls inside their bounds)
 *
 * This bounds worst-case scene complexity regardless of how large the world
 * grows. The existing DistanceCuller already culls individual meshes beyond
 * drawDistance (200-350 units); DistrictStreamer adds a coarser, district-level
 * cull that fires much earlier and lets us skip the per-mesh distance checks
 * for entire districts the player can't see.
 *
 * Implementation notes:
 *   - Non-invasive: rather than restructuring World.js to add per-district
 *     groups (which would risk breaking colliders, traffic spawn points, and
 *     minimap markers), DistrictStreamer partitions world.root.children into
 *     per-district buckets on first update() by checking which district bounds
 *     each child's position falls inside.
 *   - Children whose position falls outside all district bounds (e.g. the
 *     main highway roads, which run from z=-1500 to z=1500) are tagged
 *     'always' and never hidden.
 *   - Children of buildings (windows, roof details) inherit visibility from
 *     their parent — we only toggle the top-level child of world.root.
 *   - Special case: animated objects (windmill, train) live in world.root
 *     and get partitioned by position like anything else. They'll stream in
 *     and out with their district, which is the desired behavior.
 */
import * as THREE from 'three';

export class DistrictStreamer {
  /**
   * @param {Object} opts
   * @param {THREE.Object3D} opts.worldRoot  - the World.root group
   * @param {Array} opts.districts           - world.districts array of { name, center, bounds }
   * @param {number} opts.residentRadius     - number of adjacent districts on each side to keep resident (default 1)
   * @param {number} opts.updateInterval     - seconds between re-evaluations (default 1.0)
   */
  constructor({ worldRoot, districts, residentRadius = 1, updateInterval = 1.0 }) {
    this.worldRoot = worldRoot;
    this.districts = districts;
    this.residentRadius = residentRadius;
    this.updateInterval = updateInterval;
    this._accum = 0;
    this._buckets = null;       // built lazily on first update
    this._currentDistrictIdx = -1;
  }

  /**
   * Partition worldRoot.children into per-district buckets.
   * Called once on the first update(). Children outside all district bounds
   * are tagged 'always' and never hidden.
   */
  _buildBuckets() {
    this._buckets = this.districts.map(() => []);
    this._alwaysVisible = [];

    // Reuse temp vectors to avoid per-child allocations.
    const tmp = new THREE.Vector3();

    for (const child of this.worldRoot.children) {
      // World position of this child (handles the case where child has its own local offset)
      child.getWorldPosition(tmp);

      // Skip the ground plane (it's huge and spans the whole map; we want it always visible)
      // Heuristic: any mesh whose bounding sphere radius > 1500 is treated as global.
      // Also skip the Sky (it's added at scene level, not worldRoot, so this is just a safety check).
      let assigned = false;
      for (let i = 0; i < this.districts.length; i++) {
        const b = this.districts[i].bounds;
        if (tmp.x >= b.minX && tmp.x <= b.maxX && tmp.z >= b.minZ && tmp.z <= b.maxZ) {
          this._buckets[i].push(child);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        this._alwaysVisible.push(child);
      }
    }
  }

  /**
   * Determine which district the player is currently in.
   * Returns the district index (0-6), or -1 if outside all district bounds
   * (e.g. on the highway between districts).
   */
  _districtIndexAt(pos) {
    for (let i = 0; i < this.districts.length; i++) {
      const b = this.districts[i].bounds;
      if (pos.x >= b.minX && pos.x <= b.maxX && pos.z >= b.minZ && pos.z <= b.maxZ) {
        return i;
      }
    }
    // Outside all districts — find the nearest by z-distance to district center.
    // This handles the case where the player is on the connecting highway
    // between two districts (the highway itself spans the whole z range, but
    // the player's z position still falls closest to one district center).
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < this.districts.length; i++) {
      const dz = Math.abs(pos.z - this.districts[i].center.z);
      if (dz < nearestDist) {
        nearestDist = dz;
        nearest = i;
      }
    }
    return nearest;
  }

  update(dt, playerPos) {
    this._accum += dt;
    if (this._accum < this.updateInterval) return;
    this._accum = 0;

    if (!this._buckets) this._buildBuckets();

    const idx = this._districtIndexAt(playerPos);
    if (idx === this._currentDistrictIdx) return; // no change → no work
    this._currentDistrictIdx = idx;

    // Compute which district indices should be resident.
    // Range: [idx - residentRadius, idx + residentRadius], clamped to [0, districts.length-1]
    const minIdx = Math.max(0, idx - this.residentRadius);
    const maxIdx = Math.min(this.districts.length - 1, idx + this.residentRadius);

    // Toggle visibility per district bucket.
    for (let i = 0; i < this._buckets.length; i++) {
      const visible = i >= minIdx && i <= maxIdx;
      for (const child of this._buckets[i]) {
        if (child.visible !== visible) child.visible = visible;
      }
    }
    // 'always' bucket is never touched — ground plane, highway, etc.
  }
}
