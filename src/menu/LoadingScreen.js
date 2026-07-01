/**
 * LoadingScreen — shown after clicking PLAY.
 *
 * Displays sequential loading messages with a progress bar,
 * then calls onComplete when loading reaches 100%.
 */
export class LoadingScreen {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.progress = 0;
    this.messages = [
      'Loading Assets...',
      'Loading Physics...',
      'Loading NPCs...',
      'Loading Traffic...',
      'Loading Audio...',
      'Loading Missions...',
      'Loading World...'
    ];
    this.currentMsg = 0;

    this.el = document.createElement('div');
    this.el.id = 'loading-screen';
    this.el.innerHTML = `
      <div class="loading-content">
        <div class="loading-logo">GTA<span>7</span></div>
        <div class="loading-bar-container">
          <div class="loading-bar-fill" id="loading-fill"></div>
        </div>
        <div class="loading-percent" id="loading-percent">0%</div>
        <div class="loading-msg" id="loading-msg">Loading...</div>
      </div>
    `;
    document.body.appendChild(this.el);
    this.fillEl = this.el.querySelector('#loading-fill');
    this.pctEl = this.el.querySelector('#loading-percent');
    this.msgEl = this.el.querySelector('#loading-msg');

    this._start();
  }

  _start() {
    const totalDuration = 4000; // 4 seconds
    const stepTime = 50;
    const steps = totalDuration / stepTime;
    const increment = 100 / steps;
    let step = 0;

    this._interval = setInterval(() => {
      step++;
      this.progress = Math.min(100, step * increment);
      this.fillEl.style.width = this.progress + '%';
      this.pctEl.textContent = Math.floor(this.progress) + '%';

      // Update message based on progress
      const msgIdx = Math.min(this.messages.length - 1, Math.floor((this.progress / 100) * this.messages.length));
      if (msgIdx !== this.currentMsg) {
        this.currentMsg = msgIdx;
        this.msgEl.style.opacity = '0';
        setTimeout(() => {
          this.msgEl.textContent = this.messages[msgIdx];
          this.msgEl.style.opacity = '1';
        }, 200);
      }

      if (this.progress >= 100) {
        clearInterval(this._interval);
        this.msgEl.textContent = 'Ready!';
        setTimeout(() => {
          this.el.classList.add('fade-out');
          setTimeout(() => {
            this.el.remove();
            if (this.onComplete) this.onComplete();
          }, 600);
        }, 400);
      }
    }, stepTime);
  }
}
