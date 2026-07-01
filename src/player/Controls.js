/**
 * Input controller — keyboard + touch (joystick + buttons).
 * Exposes a normalized state object that other systems read each frame.
 *   state = {
 *     forward, back, left, right,  // 0..1
 *     brake, boost,                // bool
 *     enter, reset, camSwitch, timeToggle // edge-triggered
 *   }
 */
export class Controls {
  constructor(domElement) {
    this.dom = domElement;
    this.state = {
      forward: 0, back: 0, left: 0, right: 0,
      brake: false, boost: false,
      enter: false, reset: false, camSwitch: false, timeToggle: false,
      vehicleSwitch: false, variantSwitch: false, newMission: false,
      phone: false, garage: false, customize: false, buyHouse: false,
      buyBusiness: false, startRace: false, mpPanel: false
    };
    this._edges = new Set([
      'enter', 'reset', 'camSwitch', 'timeToggle', 'vehicleSwitch',
      'variantSwitch', 'newMission', 'phone', 'garage', 'customize',
      'buyHouse', 'buyBusiness', 'startRace', 'mpPanel'
    ]);
    this._keys = new Set();
    this._joyVec = { x: 0, y: 0 }; // -1..1
    this._touchGas = false;
    this._touchBrake = false;

    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));

    // Touch joystick
    const joy = document.getElementById('joystick');
    const stick = document.getElementById('stick');
    if (joy && stick) {
      let active = false;
      let cx = 0, cy = 0;
      const maxR = 42;
      const start = (e) => {
        active = true;
        const r = joy.getBoundingClientRect();
        cx = r.left + r.width / 2; cy = r.top + r.height / 2;
        e.preventDefault();
      };
      const move = (e) => {
        if (!active) return;
        const t = e.touches ? e.touches[0] : e;
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > maxR) { dx = dx / len * maxR; dy = dy / len * maxR; }
        stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this._joyVec.x = dx / maxR;
        this._joyVec.y = dy / maxR;
        e.preventDefault();
      };
      const end = (e) => {
        active = false;
        stick.style.transform = 'translate(-50%, -50%)';
        this._joyVec.x = 0; this._joyVec.y = 0;
        e.preventDefault();
      };
      joy.addEventListener('touchstart', start, { passive: false });
      joy.addEventListener('touchmove', move, { passive: false });
      joy.addEventListener('touchend', end, { passive: false });
      joy.addEventListener('mousedown', start);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
    }

    // Touch buttons
    const bindBtn = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;
      const d = (e) => { onDown(); el.classList.add('active'); e.preventDefault(); };
      const u = (e) => { onUp(); el.classList.remove('active'); e.preventDefault(); };
      el.addEventListener('touchstart', d, { passive: false });
      el.addEventListener('touchend', u, { passive: false });
      el.addEventListener('mousedown', d);
      el.addEventListener('mouseup', u);
    };
    bindBtn('btn-gas',   () => this._touchGas = true,   () => this._touchGas = false);
    bindBtn('btn-brake', () => this._touchBrake = true, () => this._touchBrake = false);
    bindBtn('btn-enter', () => this.state.enter = true, () => {});
  }

  _onKey(e, down) {
    const k = e.key.toLowerCase();
    const block = ['w','a','s','d',' ','arrowup','arrowdown','arrowleft','arrowright'];
    if (block.includes(k)) e.preventDefault();

    if (down) this._keys.add(k); else this._keys.delete(k);

    // Edge-triggered (only on press)
    if (down) {
      if (k === 'f') this.state.enter = true;
      if (k === 'r') this.state.reset = true;
      if (k === 'c') this.state.camSwitch = true;
      if (k === 'n') this.state.timeToggle = true;
      if (k === 'v') this.state.vehicleSwitch = true;
      if (k === 'b') this.state.variantSwitch = true;
      if (k === 'm') this.state.newMission = true;
      if (k === 'p') this.state.phone = true;
      if (k === 'g') this.state.garage = true;
      if (k === 'j') this.state.customize = true;
      if (k === 'h') this.state.buyHouse = true;
      if (k === 'u') this.state.buyBusiness = true;
      if (k === 'k') this.state.startRace = true;
      if (k === 'o') this.state.mpPanel = true;
    }
  }

  /**
   * Called by Game.update() each frame BEFORE systems read state.
   * Recomputes continuous axes from keys + touch.
   */
  update() {
    const k = this._keys;
    let f = 0, b = 0, l = 0, r = 0;
    if (k.has('w') || k.has('arrowup'))    f = 1;
    if (k.has('s') || k.has('arrowdown'))  b = 1;
    if (k.has('a') || k.has('arrowleft'))  l = 1;
    if (k.has('d') || k.has('arrowright')) r = 1;

    // Merge joystick (y up = forward)
    f = Math.max(f, this._joyVec.y < 0 ? -this._joyVec.y : 0);
    b = Math.max(b, this._joyVec.y > 0 ?  this._joyVec.y : 0);
    l = Math.max(l, this._joyVec.x < 0 ? -this._joyVec.x : 0);
    r = Math.max(r, this._joyVec.x > 0 ?  this._joyVec.x : 0);

    if (this._touchGas)   f = 1;
    if (this._touchBrake) b = 1;

    this.state.forward = f;
    this.state.back = b;
    this.state.left = l;
    this.state.right = r;
    this.state.brake = k.has(' ') || this._touchBrake;
    this.state.boost = k.has('shift');
  }

  /**
   * Consume an edge-triggered flag (call after handling).
   */
  consume(name) {
    const v = this.state[name];
    this.state[name] = false;
    return v;
  }
}
