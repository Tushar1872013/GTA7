/**
 * UIButton — reusable glassmorphism button for menus.
 *
 * Features:
 *   - Glassmorphism background with blur
 *   - Yellow hover glow
 *   - Ripple click effect
 *   - Smooth animations
 */
export class UIButton {
  constructor({ label, icon, onClick, parent, variant = 'default' }) {
    this.label = label;
    this.icon = icon || '';
    this.onClick = onClick;
    this.disabled = false;

    this.el = document.createElement('button');
    this.el.className = `menu-btn menu-btn-${variant}`;
    this.el.innerHTML = `
      ${this.icon ? `<span class="menu-btn-icon">${this.icon}</span>` : ''}
      <span class="menu-btn-label">${label}</span>
    `;

    // Hover glow
    this.el.addEventListener('mouseenter', () => {
      if (!this.disabled) this.el.classList.add('hover');
    });
    this.el.addEventListener('mouseleave', () => {
      this.el.classList.remove('hover');
    });

    // Ripple
    this.el.addEventListener('click', (e) => {
      if (this.disabled) return;
      this._ripple(e);
      if (this.onClick) this.onClick();
    });

    if (parent) parent.appendChild(this.el);
  }

  _ripple(e) {
    const rect = this.el.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    this.el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  setDisabled(d) {
    this.disabled = d;
    this.el.classList.toggle('disabled', d);
  }

  setLabel(l) {
    this.label = l;
    this.el.querySelector('.menu-btn-label').textContent = l;
  }
}
