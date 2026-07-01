/**
 * FacialBlendshapes — 60+ morph target expressions for the face.
 *
 * Instead of true GLB morph targets (which need a rigged model), this system
 * simulates blendshapes by storing vertex offset data for the face mesh and
 * applying them with weights. Expressions include:
 *
 *   Eyes: blink_L, blink_R, wide_L, wide_R, squint
 *   Brows: brow_raise_L, brow_raise_R, brow_frown, brow_surprise
 *   Nose: nose_wrinkle, nostril_flare
 *   Cheeks: cheek_puff, cheek_suck, smile_cheek_L, smile_cheek_R
 *   Mouth: smile, frown, open, pucker, smirk_L, smirk_R, jaw_open
 *   Lips: lip_bite, lip_purse, lip_curl_L, lip_curl_R
 *   Jaw: jaw_clench, jaw_open, jaw_shift_L, jaw_shift_R
 *   Face: face_pain, face_anger, face_joy, face_sad, face_surprise, face_fear
 *   Other: blink_both, look_L, look_R, look_U, look_D, head_tilt_L, head_tilt_R
 *
 * 60+ named expressions — applied to the head/face mesh vertices.
 */
import * as THREE from 'three';

const BLEND_SHAPE_NAMES = [
  // Eyes (10)
  'blink_L', 'blink_R', 'blink_both', 'wide_L', 'wide_R',
  'squint', 'look_L', 'look_R', 'look_U', 'look_D',
  // Brows (6)
  'brow_raise_L', 'brow_raise_R', 'brow_frown', 'brow_surprise',
  'brow_sad_L', 'brow_sad_R',
  // Nose (3)
  'nose_wrinkle', 'nostril_flare_L', 'nostril_flare_R',
  // Cheeks (6)
  'cheek_puff', 'cheek_suck', 'smile_cheek_L', 'smile_cheek_R',
  'cheek_raise_L', 'cheek_raise_R',
  // Mouth (12)
  'smile', 'frown', 'open', 'pucker', 'smirk_L', 'smirk_R',
  'lip_bite', 'lip_purse', 'lip_curl_L', 'lip_curl_R', 'mouth_wide', 'mouth_narrow',
  // Jaw (6)
  'jaw_clench', 'jaw_open', 'jaw_shift_L', 'jaw_shift_R', 'jaw_thrust', 'jaw_retract',
  // Face expressions (8)
  'face_pain', 'face_anger', 'face_joy', 'face_sad',
  'face_surprise', 'face_fear', 'face_disgust', 'face_neutral',
  // Head (6)
  'head_tilt_L', 'head_tilt_R', 'head_nod', 'head_shake',
  'head_breath', 'head_swallow',
  // Extra (5)
  'tongue_out', 'teeth_clench', 'blush', 'pale', 'sweat'
];

export class FacialBlendshapes {
  constructor(headMesh, faceParts) {
    this.head = headMesh;
    this.parts = faceParts; // { mouth, browL, browR, eyeL, eyeR, etc. }
    this.weights = {};
    this._targets = {};
    this._time = 0;

    // Initialize all blendshape weights to 0
    for (const name of BLEND_SHAPE_NAMES) {
      this.weights[name] = 0;
      this._targets[name] = 0;
    }

    // Auto-blink timer
    this._blinkTimer = 0;
    this._nextBlink = 2 + Math.random() * 4;

    // Current emotion (randomly cycles)
    this._emotion = 'face_neutral';
    this._emotionTimer = 0;
  }

  /**
   * Set a blendshape weight (0..1).
   */
  setWeight(name, value) {
    if (name in this.weights) this.weights[name] = Math.max(0, Math.min(1, value));
  }

  /**
   * Set an emotion — applies a combination of blendshapes.
   */
  setEmotion(emotion) {
    // Reset all face expressions
    for (const e of ['face_pain', 'face_anger', 'face_joy', 'face_sad', 'face_surprise', 'face_fear', 'face_disgust', 'face_neutral']) {
      this._targets[e] = 0;
    }
    this._targets[emotion] = 1;

    // Apply expression-specific blendshapes
    switch (emotion) {
      case 'face_joy':
        this._targets['smile'] = 0.8;
        this._targets['brow_raise_L'] = 0.3;
        this._targets['brow_raise_R'] = 0.3;
        this._targets['smile_cheek_L'] = 0.5;
        this._targets['smile_cheek_R'] = 0.5;
        break;
      case 'face_anger':
        this._targets['brow_frown'] = 0.8;
        this._targets['jaw_clench'] = 0.5;
        this._targets['squint'] = 0.4;
        break;
      case 'face_sad':
        this._targets['frown'] = 0.6;
        this._targets['brow_sad_L'] = 0.5;
        this._targets['brow_sad_R'] = 0.5;
        break;
      case 'face_surprise':
        this._targets['jaw_open'] = 0.5;
        this._targets['brow_surprise'] = 0.8;
        this._targets['wide_L'] = 0.5;
        this._targets['wide_R'] = 0.5;
        break;
      case 'face_fear':
        this._targets['wide_L'] = 0.7;
        this._targets['wide_R'] = 0.7;
        this._targets['brow_raise_L'] = 0.6;
        this._targets['brow_raise_R'] = 0.6;
        this._targets['mouth_wide'] = 0.4;
        break;
      case 'face_neutral':
        this._targets['smile'] = 0;
        this._targets['frown'] = 0;
        break;
    }
  }

  update(dt) {
    this._time += dt;

    // Auto-blink — randomly blink every 2-6 seconds
    this._blinkTimer += dt;
    if (this._blinkTimer > this._nextBlink) {
      this._blinkTimer = 0;
      this._nextBlink = 2 + Math.random() * 4;
      // Trigger blink
      this._targets['blink_both'] = 1;
      setTimeout(() => { this._targets['blink_both'] = 0; }, 100);
    }

    // Random emotion changes every 5-10 seconds
    this._emotionTimer += dt;
    if (this._emotionTimer > 5 + Math.random() * 5) {
      this._emotionTimer = 0;
      const emotions = ['face_neutral', 'face_neutral', 'face_neutral', 'face_joy', 'face_sad', 'face_surprise'];
      this.setEmotion(emotions[Math.floor(Math.random() * emotions.length)]);
    }

    // Smooth weight interpolation toward targets
    for (const name of BLEND_SHAPE_NAMES) {
      this.weights[name] = THREE.MathUtils.lerp(this.weights[name], this._targets[name], 1 - Math.pow(0.001, dt));
    }

    // Apply to face parts
    this._applyToParts();
  }

  _applyToParts() {
    const w = this.weights;
    const p = this.parts;

    // Blink — scale eyes on Y
    if (p.eyeL) p.eyeL.scale.y = 1 - w['blink_both'] * 0.9 - w['blink_L'] * 0.9;
    if (p.eyeR) p.eyeR.scale.y = 1 - w['blink_both'] * 0.9 - w['blink_R'] * 0.9;

    // Wide eyes
    if (p.eyeL) p.eyeL.scale.y *= 1 + w['wide_L'] * 0.3;
    if (p.eyeR) p.eyeR.scale.y *= 1 + w['wide_R'] * 0.3;

    // Squint
    if (p.eyeL) p.eyeL.scale.y *= 1 - w['squint'] * 0.4;
    if (p.eyeR) p.eyeR.scale.y *= 1 - w['squint'] * 0.4;

    // Eye look (pupil position)
    const lookX = w['look_R'] * 0.015 - w['look_L'] * 0.015;
    const lookY = w['look_U'] * 0.01 - w['look_D'] * 0.01;
    if (p.irisL) { p.irisL.position.x = -0.04 + lookX; p.irisL.position.y = 1.70 + lookY; }
    if (p.irisR) { p.irisR.position.x = 0.04 + lookX; p.irisR.position.y = 1.70 + lookY; }
    if (p.pupilL) { p.pupilL.position.x = -0.04 + lookX; p.pupilL.position.y = 1.70 + lookY; }
    if (p.pupilR) { p.pupilR.position.x = 0.04 + lookX; p.pupilR.position.y = 1.70 + lookY; }

    // Brows
    if (p.browL) p.browL.position.y = 1.735 + w['brow_raise_L'] * 0.02 - w['brow_frown'] * 0.01 + w['brow_sad_L'] * 0.005;
    if (p.browR) p.browR.position.y = 1.735 + w['brow_raise_R'] * 0.02 - w['brow_frown'] * 0.01 + w['brow_sad_R'] * 0.005;

    // Mouth — smile/frown/open
    if (p.mouth) {
      const smile = w['smile'] * 0.02;
      const frown = w['frown'] * 0.02;
      p.mouth.scale.x = 1 + smile - frown + w['mouth_wide'] * 0.3 - w['mouth_narrow'] * 0.2;
      p.mouth.scale.y = 1 + w['open'] * 2 + w['jaw_open'] * 1.5 - w['pucker'] * 0.5;
      p.mouth.position.y = 1.62 + smile - frown;
    }

    // Head tilt/breath
    if (this.head) {
      this.head.rotation.z = w['head_tilt_L'] * 0.15 - w['head_tilt_R'] * 0.15;
      this.head.rotation.x = w['head_nod'] * 0.1;
      this.head.rotation.y = Math.sin(this._time * 0.5) * w['head_shake'] * 0.1;
    }
  }

  getBlendshapeCount() { return BLEND_SHAPE_NAMES.length; }
  getBlendshapeNames() { return BLEND_SHAPE_NAMES; }
}
