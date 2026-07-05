/**
 * SplashScreen — initial 2-second splash with GTA7 logo animation.
 *
 * Shows a black screen with the GTA7 logo fading + sliding in,
 * then calls onComplete after 2.5 seconds.
 */
export class SplashScreen {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.el = document.createElement('div');
    this.el.id = 'splash-screen';
    this.el.innerHTML = `
      <div class="splash-content">
        <div class="splash-logo">GTA<span class="splash-7">7</span></div>
        <div class="splash-tagline">OPEN WORLD</div>
        <div class="splash-bar"><div class="splash-bar-fill"></div></div>
      </div>
    `;
    document.body.appendChild(this.el);

    // Trigger animation
    requestAnimationFrame(() => {
      this.el.classList.add('visible');
    });

    // Complete after 2.5s
    setTimeout(() => {
      this.el.classList.add('fade-out');
      setTimeout(() => {
        this.el.remove();
        if (this.onComplete) this.onComplete();
      }, 500);
    }, 2500);
  }
}
