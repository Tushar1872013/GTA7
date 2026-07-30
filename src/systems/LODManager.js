/**
 * LODManager — distance-based Level of Detail management.
 *
 * For each registered object, creates simplified versions at different distances:
 *   - Near (<50m): full detail
 *   - Mid (50-150m): remove small details (windows, props)
 *   - Far (150-300m): hide secondary objects, keep silhouette only
 *   - Very Far (>300m): hidden entirely
 *
 * Integrates with the existing DistanceCuller — this adds LOD transitions
 * before full culling.
 *
 * Phase D1 — Also handles native THREE.LOD objects (e.g. buildings wrapped in
 * THREE.LOD by World._addBuilding). THREE.LOD requires lod.update(camera) to
 * be called every frame to perform the level switch; we collect registered
 * THREE.LOD objects and update them on each tick.
 */
export class LODManager {
  constructor({ camera, updateInterval = 0.5 }) {
    this.camera = camera;
    this.updateInterval = updateInterval;
    this._accum = 0;
    this._targets = []; // { mesh, detailParts: [], midDist, farDist, cullDist }
    this._nativeLODs = []; // THREE.LOD objects that need .update(camera) every frame
  }

  /**
   * Register an object with its detail parts (small meshes that can be hidden).
   */
  register(mainMesh, detailParts = [], { midDist = 50, farDist = 150, cullDist = 300 } = {}) {
    this._targets.push({ mainMesh, detailParts, midDist, farDist, cullDist });
  }

  /**
   * Phase D1 — Register a native THREE.LOD object so its level switching is
   * driven by this manager. The LOD's own level distances are set at construction
   * time (World._addBuilding uses 0 and 80); here we just ensure lod.update(camera)
   * is called every frame.
   */
  registerNativeLOD(lod) {
    this._nativeLODs.push(lod);
  }

  update(dt) {
    // Native THREE.LOD objects must update every frame for smooth level switching.
    // (THREE.LOD.update is cheap — just a distance check + child visibility toggle.)
    if (this._nativeLODs.length) {
      const camPos = this.camera.position;
      for (const lod of this._nativeLODs) {
        if (lod.parent) lod.update(camPos);
      }
    }

    this._accum += dt;
    if (this._accum < this.updateInterval) return;
    this._accum = 0;

    const camPos = this.camera.position;
    for (const t of this._targets) {
      if (!t.mainMesh.parent) continue;
      const d = t.mainMesh.position.distanceTo(camPos);

      // Cull entirely
      if (d > t.cullDist) {
        t.mainMesh.visible = false;
        continue;
      }
      t.mainMesh.visible = true;

      // Toggle detail parts based on distance
      const showDetails = d < t.midDist;
      for (const part of t.detailParts) {
        if (part.visible !== showDetails) part.visible = showDetails;
      }

      // At far distance, reduce shadow casting
      if (d > t.farDist) {
        t.mainMesh.castShadow = false;
      } else {
        t.mainMesh.castShadow = true;
      }
    }
  }
}
