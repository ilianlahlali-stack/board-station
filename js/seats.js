/* Disposition des joueurs autour de la table (jeux de cartes) et main en éventail. */
const Seats = (() => {
  const { el, esc } = UI;

  /* Les adversaires sont placés sur un arc, dans l'ordre du tour, de gauche à droite. */
  function positions(n) {
    if (n === 1) return [[50, 13]];
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = (198 + (144 * k) / (n - 1)) * Math.PI / 180;
      out.push([50 + 42 * Math.cos(a), 55 + 43 * Math.sin(a)]);
    }
    return out;
  }

  /* opts : { players, viewer, current, counts[], badges[], bubbles[], backTheme, out[] } */
  function render(layer, opts) {
    const { players, viewer, current, counts, badges = [], bubbles = [], backTheme = 'classic', out = [] } = opts;
    layer.innerHTML = '';
    const n = players.length;
    /* viewer < 0 : personne n'a sa main à l'écran, tous les joueurs sont autour de la table. */
    const all = viewer < 0;
    const count = all ? n : n - 1;
    const pos = positions(count);
    const map = {};
    for (let k = 0; k < count; k++) {
      const idx = all ? k : (viewer + 1 + k) % n;
      const [x, y] = pos[k];
      const seat = el('div', 'seat' + (idx === current ? ' active' : '') + (out[idx] ? ' out' : ''));
      seat.style.left = x + '%'; seat.style.top = y + '%';
      seat.dataset.idx = idx;
      const fan = el('div', 'seat-fan');
      const shown = Math.min(counts[idx], 9);
      for (let i = 0; i < shown; i++) {
        const b = Cards.back(backTheme);
        b.style.setProperty('--i', i - (shown - 1) / 2);
        fan.appendChild(b);
      }
      seat.appendChild(fan);
      const plate = el('div', 'seat-plate',
        `<span class="seat-name">${players[idx].bot ? '🤖 ' : ''}${esc(players[idx].name)}</span>` +
        `<span class="seat-count">${counts[idx]}</span>` +
        (badges[idx] ? `<span class="seat-badge">${badges[idx]}</span>` : ''));
      seat.appendChild(plate);
      if (bubbles[idx]) seat.appendChild(el('div', 'seat-bubble', bubbles[idx]));
      layer.appendChild(seat);
      map[idx] = seat;
    }
    return map;
  }

  /* Largeur réelle (en px) d'une carte dans `elm` : --cw peut être un clamp(). */
  function cardWidth(elm) {
    const probe = el('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:var(--cw);height:0';
    elm.appendChild(probe);
    const w = probe.offsetWidth;
    probe.remove();
    return w || 84;
  }

  /* Dispose les cartes d'une main en éventail dans `handEl`. */
  function fan(handEl, nodes) {
    handEl.innerHTML = '';
    const c = nodes.length;
    if (!c) return;
    const cw = cardWidth(handEl);
    const W = handEl.clientWidth || 800;
    const step = c > 1 ? Math.min(cw * 0.66, (W - cw) / (c - 1)) : 0;
    const maxAngle = Math.min(16, c * 1.6);
    nodes.forEach((node, i) => {
      const t = c > 1 ? (i - (c - 1) / 2) / ((c - 1) / 2) : 0;   // -1..1
      const x = (i - (c - 1) / 2) * step;
      node.style.setProperty('--x', x + 'px');
      node.style.setProperty('--rot', (t * maxAngle) + 'deg');
      node.style.setProperty('--lift', (t * t * 18) + 'px');
      node.style.zIndex = i + 1;
      handEl.appendChild(node);
    });
  }

  return { render, fan, cardWidth };
})();
