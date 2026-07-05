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
 */
export class LODManager {
  constructor({ camera, updateInterval = 0.5 }) {
    this.camera = camera;
    this.updateInterval = updateInterval;
    this._accum = 0;
    this._targets = []; // { mesh, detailParts: [], midDist, farDist, cullDist }
  }

  /**
   * Register an object with its detail parts (small meshes that can be hidden).
   */
  register(mainMesh, detailParts = [], { midDist = 50, farDist = 150, cullDist = 300 } = {}) {
    this._targets.push({ mainMesh, detailParts, midDist, farDist, cullDist });
  }

  update(dt) {
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
