/* Rendu des cartes : jeu classique de 52 cartes (indices français) et cartes « Chroma » originales. */
const Cards = (() => {
  const { el } = UI;
  const SUITS = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const SUIT_NAMES = { S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' };
  /* Rang interne : 3..10, 11 Valet, 12 Dame, 13 Roi, 14 As, 15 Deux (ordre du Président). */
  const LABEL = { 11: 'V', 12: 'D', 13: 'R', 14: 'A', 15: '2' };
  const label = r => LABEL[r] || String(r);
  const pipCount = r => (r === 15 ? 2 : r);

  const PIPS = {
    2: [[50, 20], [50, 80]],
    3: [[50, 20], [50, 50], [50, 80]],
    4: [[30, 20], [70, 20], [30, 80], [70, 80]],
    5: [[30, 20], [70, 20], [50, 50], [30, 80], [70, 80]],
    6: [[30, 20], [70, 20], [30, 50], [70, 50], [30, 80], [70, 80]],
    7: [[30, 20], [70, 20], [50, 35], [30, 50], [70, 50], [30, 80], [70, 80]],
    8: [[30, 20], [70, 20], [50, 35], [30, 50], [70, 50], [50, 65], [30, 80], [70, 80]],
    9: [[30, 20], [70, 20], [30, 40], [70, 40], [50, 50], [30, 60], [70, 60], [30, 80], [70, 80]],
    10: [[30, 20], [70, 20], [50, 30], [30, 40], [70, 40], [30, 60], [70, 60], [50, 70], [30, 80], [70, 80]],
  };

  function deck52() {
    const d = [];
    for (const s of ['S', 'H', 'D', 'C']) for (let r = 3; r <= 15; r++) d.push({ id: s + r, rank: r, suit: s });
    return d;
  }

  function classic(card) {
    const red = card.suit === 'H' || card.suit === 'D';
    const c = el('div', 'card classic ' + (red ? 'red' : 'black'));
    c.dataset.id = card.id;
    const sym = SUITS[card.suit], lab = label(card.rank);
    const corner = `<span class="r">${lab}</span><span class="s">${sym}</span>`;
    let face = '';
    if (card.rank >= 11 && card.rank <= 13) {
      const crown = { 11: '⚔', 12: '✿', 13: '♛' }[card.rank];
      face = `<div class="court"><div class="court-half"><span class="court-crown">${crown}</span><span class="court-letter">${lab}</span><span class="court-suit">${sym}</span></div>` +
        `<div class="court-half flip"><span class="court-crown">${crown}</span><span class="court-letter">${lab}</span><span class="court-suit">${sym}</span></div></div>`;
    } else if (card.rank === 14) {
      face = `<div class="ace">${sym}</div>`;
    } else {
      face = PIPS[pipCount(card.rank)].map(([x, y]) =>
        `<span class="pip${y > 50 ? ' down' : ''}" style="left:${x}%;top:${y}%">${sym}</span>`).join('');
    }
    c.innerHTML = `<div class="corner tl">${corner}</div><div class="pips">${face}</div><div class="corner br">${corner}</div>`;
    c.title = `${lab} de ${SUIT_NAMES[card.suit]}`;
    return c;
  }

  function back(theme = 'classic') {
    const c = el('div', 'card back back-' + theme);
    c.innerHTML = theme === 'chroma'
      ? '<div class="back-inner"><span class="back-word">CHROMA</span></div>'
      : '<div class="back-inner"><span class="back-emblem">✦</span></div>';
    return c;
  }

  /* ----- Chroma : jeu de couleurs original (4 couleurs, actions, jokers) ----- */
  const CH_COLORS = { r: 'Corail', b: 'Océan', g: 'Menthe', y: 'Soleil' };
  const CH_SYMBOL = { skip: '⊘', rev: '⇄', draw2: '+2', wild: '✦', wild4: '+4' };

  function chromaDeck() {
    const d = []; let n = 0;
    for (const col of ['r', 'b', 'g', 'y']) {
      d.push({ id: 'c' + n++, color: col, kind: 'num', value: 0 });
      for (let v = 1; v <= 9; v++) for (let k = 0; k < 2; k++) d.push({ id: 'c' + n++, color: col, kind: 'num', value: v });
      for (const kind of ['skip', 'rev', 'draw2']) for (let k = 0; k < 2; k++) d.push({ id: 'c' + n++, color: col, kind });
    }
    for (let k = 0; k < 4; k++) { d.push({ id: 'c' + n++, color: 'w', kind: 'wild' }); d.push({ id: 'c' + n++, color: 'w', kind: 'wild4' }); }
    return d;
  }

  function chromaSymbol(card) { return card.kind === 'num' ? String(card.value) : CH_SYMBOL[card.kind]; }

  function chroma(card) {
    const c = el('div', `card chroma ch-${card.color} k-${card.kind}`);
    c.dataset.id = card.id;
    const s = chromaSymbol(card);
    c.innerHTML = `<span class="ch-corner tl">${s}</span><div class="ch-gem"><span>${s}</span></div><span class="ch-corner br">${s}</span>`;
    return c;
  }

  return { SUITS, label, deck52, classic, back, chromaDeck, chroma, chromaSymbol, CH_COLORS };
})();
