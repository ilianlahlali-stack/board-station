/* Président — jeu de défausse avec un jeu classique de 52 cartes. */
window.Games = window.Games || {};
Games.president = (() => {
  const { el, esc } = UI;

  function titleFor(pos, n) {
    if (pos === 0) return '👑 Président';
    if (pos === n - 1) return '💩 Trouduc';
    if (n >= 4 && pos === 1) return 'Vice-Président';
    if (n >= 4 && pos === n - 2) return 'Vice-Trouduc';
    return 'Neutre';
  }

  function preview() {
    const p = el('div', 'pv-cards');
    [{ rank: 13, suit: 'S' }, { rank: 12, suit: 'H' }, { rank: 14, suit: 'D' }, { rank: 15, suit: 'C' }].forEach((c, i) => {
      const n = Cards.classic({ id: 'pv' + i, ...c });
      n.style.setProperty('--i', i - 1.5);
      p.appendChild(n);
    });
    return p;
  }

  const rules = `
    <p><b>But :</b> être le premier à se débarrasser de toutes ses cartes pour devenir Président.</p>
    <p><b>Ordre des cartes :</b> 3 (la plus faible), 4, 5 … 10, Valet, Dame, Roi, As, puis <b>2</b> (la plus forte).</p>
    <p><b>Un pli :</b> le premier joueur pose 1, 2, 3 ou 4 cartes de même valeur. Les suivants doivent poser le <b>même nombre</b> de cartes, de valeur <b>égale ou supérieure</b>, ou passer. Un joueur qui passe ne rejoue plus avant le pli suivant.</p>
    <p>Le pli se termine quand tout le monde a passé, ou dès qu'un <b>2</b> est posé. Le dernier à avoir joué ouvre le pli suivant.</p>
    <p><b>Titres :</b> le premier à finir est Président, le dernier Trouduc. À la manche suivante, le Trouduc donne ses 2 meilleures cartes au Président, qui lui rend ses 2 plus faibles (1 carte entre les Vices à partir de 4 joueurs). Le Trouduc ouvre la manche.</p>
    <p>À la première manche, c'est le joueur qui possède la <b>Dame de cœur</b> qui commence.</p>`;

  function start(table, ctx) {
    const rng = ctx.rng;
    const P = ctx.players;
    const n = P.length;
    const points = P.map(() => 0);
    let titles = null;            // position de la manche précédente, par joueur
    let hands = [], finished = [], passed = new Set();
    let top = null;               // { rank, count }
    let current = -1, viewer = Math.max(0, P.findIndex(p => !p.bot));
    let handVisible = false;
    let bubbles = [];
    let selection = new Set();
    let onChoice = null;
    const multiHuman = ctx.humans() > 1;

    table.innerHTML = `
      <div class="cg-status"></div>
      <div class="seats-layer"></div>
      <div class="cg-center"><div class="cg-pile"></div><div class="cg-info"></div></div>
      <div class="cg-me">
        <div class="cg-me-plate"></div>
        <div class="cg-hand"></div>
        <div class="cg-actions">
          <button class="btn cg-pass" type="button">Passer</button>
          <button class="btn primary big cg-play" type="button">Jouer</button>
        </div>
      </div>`;
    const q = s => table.querySelector(s);
    const seatsLayer = q('.seats-layer'), pileEl = q('.cg-pile'), handEl = q('.cg-hand');
    const btnPlay = q('.cg-play'), btnPass = q('.cg-pass');
    let seatMap = {};

    const setStatus = h => { q('.cg-status').innerHTML = h; };
    const sortHand = h => h.sort((a, b) => (a.rank - b.rank) || a.suit.localeCompare(b.suit));
    const badge = i => (titles ? titleFor(titles[i], n) : '');

    function cardSize() {
      const w = Seats.cardWidth(pileEl);
      return { w, h: w * 1.42 };
    }
    function pileRect(k = 0, count = 1) {
      const r = pileEl.getBoundingClientRect(), { w, h } = cardSize();
      const off = (k - (count - 1) / 2) * w * 0.42;
      return { left: r.left + r.width / 2 - w / 2 + off, top: r.top + r.height / 2 - h / 2, width: w, height: h };
    }
    function originRect(i) {
      const { w, h } = cardSize();
      const src = i === viewer ? handEl : (seatMap[i] && seatMap[i].querySelector('.seat-fan'));
      const r = (src || pileEl).getBoundingClientRect();
      return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h };
    }

    function countOf(rank) { return hands[viewer].filter(c => c.rank === rank).length; }
    function playable(card) {
      if (current !== viewer || !onChoice) return false;
      if (!top) return true;
      return card.rank >= top.rank && countOf(card.rank) >= top.count;
    }
    function selectionValid() {
      const sel = hands[viewer].filter(c => selection.has(c.id));
      if (!sel.length || sel.some(c => c.rank !== sel[0].rank)) return false;
      if (!top) return true;
      return sel.length === top.count && sel[0].rank >= top.rank;
    }

    function render() {
      seatMap = Seats.render(seatsLayer, {
        players: P, viewer, current,
        counts: hands.map(h => h.length),
        badges: P.map((_, i) => badge(i)),
        bubbles, out: P.map((_, i) => finished.includes(i)),
      });
      const me = P[viewer];
      q('.cg-me-plate').innerHTML =
        `<span class="seat-name">${me.bot ? '🤖 ' : ''}${esc(me.name)}</span>` +
        (badge(viewer) ? `<span class="seat-badge">${badge(viewer)}</span>` : '') +
        (bubbles[viewer] ? `<span class="seat-bubble inline">${bubbles[viewer]}</span>` : '') +
        (finished.includes(viewer) ? '<span class="seat-badge done">A terminé</span>' : '');
      q('.cg-me').classList.toggle('active', current === viewer);
      const myTurn = current === viewer && !!onChoice;
      const nodes = (hands[viewer] || []).map(card => {
        const node = handVisible ? Cards.classic(card) : Cards.back('classic');
        node.classList.add('in-hand');
        if (handVisible) {
          if (selection.has(card.id)) node.classList.add('selected');
          if (myTurn) {
            if (playable(card)) { node.classList.add('playable'); node.addEventListener('click', () => clickCard(card)); }
            else node.classList.add('dim');
          }
        }
        return node;
      });
      Seats.fan(handEl, nodes);
      btnPlay.disabled = !myTurn || !selectionValid();
      btnPass.disabled = !myTurn || !top;
      q('.cg-actions').classList.toggle('hidden-actions', !myTurn);
      q('.cg-info').innerHTML = top
        ? `À battre : <b>${top.count > 1 ? top.count + ' × ' : ''}${Cards.label(top.rank)}</b>`
        : (current >= 0 ? 'Nouveau pli' : '');
    }

    function clickCard(card) {
      Sfx.click();
      if (selection.has(card.id)) {
        selection.delete(card.id);
      } else {
        const sel = hands[viewer].filter(c => selection.has(c.id));
        if (sel.length && sel[0].rank !== card.rank) selection.clear();
        if (top && selection.size >= top.count) selection.clear();
        selection.add(card.id);
        if (top && top.count > 1) {
          for (const c of hands[viewer]) {
            if (selection.size >= top.count) break;
            if (c.rank === card.rank) selection.add(c.id);
          }
        }
      }
      render();
    }

    btnPlay.addEventListener('click', () => {
      if (!onChoice || !selectionValid()) return;
      const cards = hands[viewer].filter(c => selection.has(c.id));
      const f = onChoice; onChoice = null; f({ type: 'play', cards });
    });
    btnPass.addEventListener('click', () => {
      if (!onChoice || !top) return;
      const f = onChoice; onChoice = null; f({ type: 'pass' });
    });

    function botChoice(i) {
      const groups = {};
      hands[i].forEach(c => { (groups[c.rank] = groups[c.rank] || []).push(c); });
      const ranks = Object.keys(groups).map(Number).sort((a, b) => a - b);
      if (!top) {
        const r = ranks.find(x => x !== 15) || ranks[0];
        return { type: 'play', cards: groups[r] };
      }
      const ok = ranks.filter(r => r >= top.rank && groups[r].length >= top.count);
      if (!ok.length) return { type: 'pass' };
      const r = ok.find(x => groups[x].length === top.count) || ok[0];
      // Garde ses 2 pour plus tard tant qu'il lui reste beaucoup de cartes.
      if (r === 15 && hands[i].length > 7 && top.rank < 12) return { type: 'pass' };
      return { type: 'play', cards: groups[r].slice(0, top.count) };
    }

    async function deal() {
      const deck = rng.shuffle(Cards.deck52());
      hands = P.map(() => []);
      deck.forEach((c, k) => hands[k % n].push(c));
      hands.forEach(sortHand);
      // Animation de distribution : les mains restent vides le temps du vol.
      const real = hands; hands = P.map(() => []);
      handVisible = false; render();
      setStatus('Distribution des cartes…');
      const from = pileRect();
      const jobs = [];
      for (let k = 0; k < 52; k++) {
        const i = k % n;
        Sfx.card(k * 0.028);
        jobs.push(UI.fly(Cards.back('classic'), from, originRect(i), { duration: 380, delay: k * 28, rotFrom: 0, rotTo: (Math.random() - 0.5) * 30 }));
      }
      const deckNode = Cards.back('classic'); deckNode.classList.add('deck-ghost');
      pileEl.appendChild(deckNode);
      await ctx.w(Promise.all(jobs));
      deckNode.remove();
      hands = real;
      handVisible = !multiHuman;
      render();
    }

    function exchange() {
      if (!titles) return;
      const byPos = []; titles.forEach((pos, i) => { byPos[pos] = i; });
      const swap = (hi, lo, k) => {
        const best = hands[lo].splice(hands[lo].length - k, k);
        const worst = hands[hi].splice(0, k);
        hands[hi].push(...best); hands[lo].push(...worst);
        sortHand(hands[hi]); sortHand(hands[lo]);
      };
      swap(byPos[0], byPos[n - 1], 2);
      if (n >= 4) swap(byPos[1], byPos[n - 2], 1);
      UI.toast('Échange : le Trouduc donne ses 2 meilleures cartes au Président' + (n >= 4 ? ', les Vices échangent 1 carte.' : '.'), 3600);
    }

    async function reveal(i) {
      if (P[i].bot) return;
      if (multiHuman && (viewer !== i || !handVisible)) {
        handVisible = false; viewer = i; render();
        await ctx.w(UI.handoff(P[i].name));
      }
      viewer = i; handVisible = true;
    }

    const alive = i => hands[i].length > 0;
    function nextIn(i) {
      for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (alive(j) && !passed.has(j)) return j; }
      return -1;
    }
    function nextAlive(i) {
      for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (alive(j)) return j; }
      return -1;
    }

    async function clearTrick(msg) {
      setStatus(msg);
      await ctx.sleep(750);
      pileEl.querySelectorAll('.card').forEach(c => c.classList.add('swept'));
      Sfx.card();
      await ctx.sleep(380);
      pileEl.innerHTML = '';
      top = null; passed = new Set(); bubbles = [];
    }

    async function playCards(i, cards) {
      const jobs = cards.map((c, k) => {
        let from = originRect(i);
        if (i === viewer && handVisible) {
          const node = handEl.querySelector(`[data-id="${c.id}"]`);
          if (node) { from = node.getBoundingClientRect(); node.style.visibility = 'hidden'; }
        }
        Sfx.card(k * 0.06);
        const face = Cards.classic(c);
        const hidden = !(i === viewer && handVisible);
        return UI.fly(hidden ? Cards.back('classic') : face, from, pileRect(k, cards.length),
          { duration: 430, delay: k * 60, rotFrom: (Math.random() - 0.5) * 20, flipTo: hidden ? face : null });
      });
      hands[i] = hands[i].filter(c => !cards.includes(c));
      await ctx.w(Promise.all(jobs));
      const group = el('div', 'pile-group');
      group.style.setProperty('--rot', ((Math.random() - 0.5) * 14) + 'deg');
      group.style.setProperty('--dx', ((Math.random() - 0.5) * 14) + 'px');
      group.style.setProperty('--dy', ((Math.random() - 0.5) * 10) + 'px');
      cards.forEach(c => group.appendChild(Cards.classic(c)));
      pileEl.querySelectorAll('.pile-group').forEach(g => g.classList.add('under'));
      pileEl.appendChild(group);
      top = { rank: cards[0].rank, count: cards.length };
    }

    async function playRound(roundNo) {
      finished = []; passed = new Set(); top = null; bubbles = []; selection.clear(); current = -1;
      pileEl.innerHTML = '';
      await deal();
      exchange();
      let leader;
      if (titles) leader = titles.indexOf(n - 1);
      else leader = hands.findIndex(h => h.some(c => c.rank === 12 && c.suit === 'H'));
      current = leader;

      while (hands.filter(h => h.length).length > 1) {
        const i = current, p = P[i];
        selection.clear();
        await reveal(i);
        render();
        let choice;
        if (p.bot) {
          setStatus(`<b>${esc(p.name)}</b> réfléchit…`);
          await ctx.sleep(750 + Math.random() * 400);
          choice = botChoice(i);
        } else {
          setStatus(top ? `<b>${esc(p.name)}</b> : joue ${top.count > 1 ? top.count + ' cartes' : 'une carte'} ≥ ${Cards.label(top.rank)}, ou passe.`
            : `<b>${esc(p.name)}</b> ouvre le pli : pose 1 à 4 cartes de même valeur.`);
          choice = await ctx.w(new Promise(res => { onChoice = res; render(); }));
        }
        selection.clear();

        if (choice.type === 'pass') {
          passed.add(i); bubbles[i] = 'Passe';
          Sfx.click();
          current = -1; render();
          await ctx.sleep(350);
          const active = P.map((_, j) => j).filter(j => alive(j) && !passed.has(j));
          if (active.length === 0) {
            // Le dernier à avoir joué a déjà fini : le joueur suivant ouvre.
            await clearTrick('Tout le monde passe.');
            current = nextAlive(lastBy);
          } else if (active.length === 1 && active[0] === lastBy) {
            await clearTrick(`<b>${esc(P[lastBy].name)}</b> remporte le pli.`);
            current = lastBy;
          } else {
            current = nextIn(i);
          }
          continue;
        }

        bubbles[i] = '';
        current = -1;
        await playCards(i, choice.cards);
        lastBy = i;
        if (!alive(i)) {
          finished.push(i);
          bubbles[i] = finished.length === 1 ? '👑 Fini !' : 'Fini !';
          if (finished.length === 1) Sfx.win();
        }
        render();
        if (hands.filter(h => h.length).length <= 1) break;
        const nx = nextIn(i);
        if (choice.cards[0].rank === 15 || nx === -1 || nx === i) {
          await clearTrick(choice.cards[0].rank === 15 ? `Un 2 ! <b>${esc(p.name)}</b> coupe le pli.` : `<b>${esc(p.name)}</b> remporte le pli.`);
          current = alive(i) ? i : nextAlive(i);
        } else {
          current = nx;
        }
      }

      const last = hands.findIndex(h => h.length);
      if (last >= 0) finished.push(last);
      current = -1; handVisible = !multiHuman; render();
      titles = []; finished.forEach((i, pos) => { titles[i] = pos; points[i] += n - 1 - pos; });
      Sfx.win(); UI.confetti(60);
      const rows = finished.map((i, pos) =>
        `<tr><td>${titleFor(pos, n)}</td><td>${esc(P[i].name)}</td><td>+${n - 1 - pos}</td><td><b>${points[i]}</b></td></tr>`).join('');
      const v = await ctx.w(UI.modal({
        title: `Fin de la manche ${roundNo}`,
        body: `<table class="rules-table"><tr><th>Titre</th><th>Joueur</th><th>Manche</th><th>Total</th></tr>${rows}</table>`,
        buttons: [{ label: 'Menu', value: 'menu' }, { label: 'Manche suivante', primary: true, value: 'next' }],
      }));
      if (v !== 'next') { document.getElementById('btn-back').click(); return false; }
      return true;
    }

    let lastBy = -1;
    (async () => {
      for (let r = 1; ; r++) { if (!(await playRound(r))) break; }
    })();
  }

  return { id: 'president', name: 'Président', tagline: 'Débarrasse-toi de tes cartes et prends le pouvoir. Jeu classique de 52 cartes.', min: 3, max: 6, defaultPlayers: 4, rules, preview, start };
})();
