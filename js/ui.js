/* Aides d'interface partagées : DOM, animations de vol, modales, écran de passage. */
const UI = (() => {
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* Fait voler `node` (une carte, un jeton…) du rectangle `from` au rectangle `to`.
     opts.flipTo : nœud à révéler à mi-parcours (retournement de carte). */
  function fly(node, from, to, opts = {}) {
    const { duration = 420, delay = 0, rotFrom = 0, rotTo = 0, easing = 'cubic-bezier(.2,.75,.25,1)', flipTo = null } = opts;
    const layer = document.getElementById('fx-layer');
    const wrap = el('div', 'flying');
    wrap.style.cssText = `left:${to.left}px;top:${to.top}px;width:${to.width}px;height:${to.height}px;`;
    wrap.style.setProperty('--cw', to.width + 'px');
    wrap.style.setProperty('--ch', to.height + 'px');
    const inner = el('div', 'flying-inner');
    inner.appendChild(node);
    wrap.appendChild(inner);
    layer.appendChild(wrap);
    const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
    const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
    const s0 = from.width / to.width;
    const anim = wrap.animate([
      { transform: `translate(${dx}px,${dy}px) rotate(${rotFrom}deg) scale(${s0})` },
      { transform: `translate(0,0) rotate(${rotTo}deg) scale(1)` },
    ], { duration, delay, easing, fill: 'both' });
    if (flipTo) {
      inner.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0.02)', offset: 0.5 }, { transform: 'scaleX(1)' }],
        { duration, delay, easing: 'linear', fill: 'both' });
      setTimeout(() => { inner.innerHTML = ''; inner.appendChild(flipTo); }, delay + duration / 2);
    }
    return anim.finished.catch(() => {}).then(() => { wrap.remove(); });
  }

  function rectOf(elm) { return elm.getBoundingClientRect(); }

  function toast(msg, ms = 2200) {
    const root = document.getElementById('toast-root');
    const t = el('div', 'toast', msg);
    root.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, ms);
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  /* buttons : [{label, primary, value}] — renvoie une promesse résolue avec `value`. */
  function modal({ title, body, buttons = [{ label: 'OK', primary: true, value: true }], wide = false, dismissable = false }) {
    return new Promise(resolve => {
      const root = document.getElementById('modal-root');
      root.innerHTML = '';
      const back = el('div', 'modal-back');
      const box = el('div', 'modal' + (wide ? ' wide' : ''));
      if (title) box.appendChild(el('h2', 'modal-title', title));
      const b = el('div', 'modal-body');
      if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
      box.appendChild(b);
      const row = el('div', 'modal-actions');
      buttons.forEach(bt => {
        const btn = el('button', 'btn' + (bt.primary ? ' primary' : ''), bt.label);
        btn.type = 'button';
        btn.addEventListener('click', () => {
          if (bt.validate && bt.validate() === false) return;
          Sfx.click(); closeModal(); resolve(bt.value);
        });
        row.appendChild(btn);
      });
      box.appendChild(row);
      back.appendChild(box);
      if (dismissable) back.addEventListener('click', e => { if (e.target === back) { closeModal(); resolve(null); } });
      root.appendChild(back);
    });
  }

  /* Écran « passe l'ordinateur » entre deux joueurs humains (mains cachées). */
  function handoff(name, sub = 'Les autres joueurs ne regardent pas l\'écran 👀') {
    return new Promise(resolve => {
      const root = document.getElementById('modal-root');
      root.innerHTML = '';
      const back = el('div', 'modal-back handoff');
      const box = el('div', 'modal');
      box.innerHTML = `<div class="handoff-kicker">Au tour de</div><h2 class="handoff-name">${esc(name)}</h2><p class="handoff-sub">${sub}</p>`;
      const btn = el('button', 'btn primary big', 'Révéler ma main');
      btn.type = 'button';
      btn.addEventListener('click', () => { Sfx.click(); closeModal(); resolve(); });
      box.appendChild(btn);
      back.appendChild(box);
      root.appendChild(back);
      btn.focus();
    });
  }

  function confetti(n = 90) {
    const layer = document.getElementById('fx-layer');
    const colors = ['#f5b400', '#e5484d', '#3e63dd', '#30a46c', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const c = el('div', 'confetti');
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      layer.appendChild(c);
      const dur = 1600 + Math.random() * 1600;
      c.animate([
        { transform: `translate(0,-20px) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${(Math.random() - 0.5) * 300}px, 105vh) rotate(${Math.random() * 1080}deg)`, opacity: 0.9 },
      ], { duration: dur, delay: Math.random() * 500, easing: 'cubic-bezier(.3,.2,.6,1)', fill: 'both' })
        .finished.catch(() => {}).then(() => c.remove());
    }
  }

  return { el, esc, sleep, fly, rectOf, toast, modal, closeModal, handoff, confetti };
})();
