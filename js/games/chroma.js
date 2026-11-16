/* Chroma — jeu de défausse par couleurs et symboles, avec des cartes originales. */
window.Games = window.Games || {};
Games.chroma = (() => {
  const { el, esc } = UI;
  const COLORS = ['r', 'b', 'g', 'y'];
  const HAND = 7;

  function preview() {
    const p = el('div', 'pv-cards');
    [{ color: 'r', kind: 'num', value: 7 }, { color: 'b', kind: 'rev' }, { color: 'w', kind: 'wild' }, { color: 'g', kind: 'draw2' }, { color: 'y', kind: 'num', value: 3 }].forEach((c, i) => {
      const n = Cards.chroma({ id: 'pv' + i, ...c });
      n.style.setProperty('--i', i - 2);
      p.appendChild(n);
    });
    return p;
  }

  const rules = `
    <p><b>But :</b> être le premier à poser toutes ses cartes.</p>
    <p><b>À ton tour :</b> pose une carte de la <b>même couleur</b> ou du <b>même chiffre / symbole</b> que celle du dessus de la défausse. Si tu ne peux pas (ou ne veux pas), pioche une carte : si elle est jouable, tu peux la poser tout de suite.</p>
    <table class="rules-table">
      <tr><th>Carte</th><th>Effet</th></tr>
      <tr><td>⊘ Blocage</td><td>Le joueur suivant passe son tour.</td></tr>
      <tr><td>⇄ Inversion</td><td>Le sens du jeu change (à 2 joueurs : rejoue).</td></tr>
      <tr><td>+2</td><td>Le joueur suivant pioche 2 cartes et passe son tour.</td></tr>
      <tr><td>✦ Prisme</td><td>Se pose sur tout ; tu choisis la couleur.</td></tr>
      <tr><td>+4 Prisme</td><td>Tu choisis la couleur, le suivant pioche 4 cartes et passe.</td></tr>
    </table>
    <p><b>« Chroma ! »</b> Quand il te reste deux cartes et que tu vas en poser une, clique sur <b>Chroma !</b> avant de jouer. Si tu oublies, tu pioches 2 cartes de pénalité.</p>
    <p><b>Score :</b> le gagnant de la manche marque les points des cartes restées dans les mains adverses (chiffre = sa valeur, action = 20, Prisme = 50).</p>`;

  const cardPoints = c => (c.kind === 'num' ? c.value : (c.color === 'w' ? 50 : 20));
  const sortKey = c => COLORS.concat('w').indexOf(c.color) * 100 + (c.kind === 'num' ? c.value : 20 + ['skip', 'rev', 'draw2', 'wild', 'wild4'].indexOf(c.kind));

  function start(table, ctx) {
    const rng = ctx.rng;
    const P = ctx.players;
    const n = P.length;
    const scores = P.map(() => 0);
    let hands = [], draw = [], discard = [], color = 'r', dir = 1;
    let current = -1, viewer = Math.max(0, P.findIndex(p => !p.bot));
    let handVisible = false, bubbles = [], onChoice = null, drawnCard = null, called = false;
    const multiHuman = ctx.humans() > 1;

    table.innerHTML = `
      <div class="cg-status"></div>
      <div class="seats-layer"></div>
      <div class="cg-center">
        <div class="cg-ring"><div class="cg-dir">➤</div></div>
        <div class="cg-row">
          <div class="cg-deck" title="Piocher"></div>
          <div class="cg-pile"></div>
        </div>
        <div class="cg-info"></div>
      </div>
      <div class="cg-me">
        <div class="cg-me-plate"></div>
        <div class="cg-hand"></div>
        <div class="cg-actions">
          <button class="btn cg-draw" type="button">Piocher</button>
          <button class="btn cg-pass" type="button">Passer</button>
          <button class="btn warn cg-call" type="button">Chroma !</button>
        </div>
      </div>`;
    const q = s => table.querySelector(s);
    const seatsLayer = q('.seats-layer'), pileEl = q('.cg-pile'), deckEl = q('.cg-deck'), handEl = q('.cg-hand');
    const btnDraw = q('.cg-draw'), btnPass = q('.cg-pass'), btnCall = q('.cg-call');
    let seatMap = {};

    const setStatus = h => { q('.cg-status').innerHTML = h; };
    const topCard = () => discard[discard.length - 1];
    const canPlay = c => c.color === 'w' || c.color === color ||
      (c.kind === topCard().kind && (c.kind !== 'num' || c.value === topCard().value));

    function cardSize() {
      const w = Seats.cardWidth(pileEl);
      return { w, h: w * 1.42 };
    }
    function rectAt(elm) {
      const r = elm.getBoundingClientRect(), { w, h } = cardSize();
      return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h };
    }
    const originRect = i => rectAt(i === viewer ? handEl : ((seatMap[i] && seatMap[i].querySelector('.seat-fan')) || pileEl));

    function renderPile() {
      pileEl.innerHTML = '';
      discard.slice(-4).forEach((c, k, arr) => {
        const node = Cards.chroma(c);
        node.style.setProperty('--rot', (((c.id.charCodeAt(1) * 37 + c.id.length * 11) % 30) - 15) + 'deg');
        if (k < arr.length - 1) node.classList.add('under');
        pileEl.appendChild(node);
      });
      deckEl.innerHTML = '';
      const layers = Math.min(5, Math.ceil(draw.length / 12));
      for (let k = 0; k < Math.max(1, layers); k++) {
        const b = Cards.back('chroma'); b.style.setProperty('--k', k); deckEl.appendChild(b);
      }
      deckEl.classList.toggle('empty', draw.length === 0);
    }

    function render() {
      seatMap = Seats.render(seatsLayer, {
        players: P, viewer, current, counts: hands.map(h => h.length),
        badges: P.map((_, i) => (scores[i] ? scores[i] + ' pts' : '')),
        bubbles, backTheme: 'chroma',
      });
      const me = P[viewer];
      q('.cg-me-plate').innerHTML =
        `<span class="seat-name">${me.bot ? '🤖 ' : ''}${esc(me.name)}</span>` +
        (scores[viewer] ? `<span class="seat-badge">${scores[viewer]} pts</span>` : '') +
        (bubbles[viewer] ? `<span class="seat-bubble inline">${bubbles[viewer]}</span>` : '');
      q('.cg-me').classList.toggle('active', current === viewer);
      const myTurn = current === viewer && !!onChoice;
      const hand = hands[viewer] || [];
      const nodes = hand.map(card => {
        const node = handVisible ? Cards.chroma(card) : Cards.back('chroma');
        node.classList.add('in-hand');
        if (handVisible && myTurn) {
          const ok = canPlay(card) && (!drawnCard || drawnCard === card);
          if (ok) { node.classList.add('playable'); node.addEventListener('click', () => choose({ type: 'play', card })); }
          else node.classList.add('dim');
        }
        return node;
      });
      Seats.fan(handEl, nodes);
      renderPile();
      q('.cg-center').dataset.color = color;
      q('.cg-ring').classList.toggle('ccw', dir === -1);
      q('.cg-info').innerHTML = discard.length ? `Couleur : <b class="col-${color}">${Cards.CH_COLORS[color]}</b>` : '';
      btnDraw.disabled = !myTurn || !!drawnCard;
      btnPass.hidden = !(myTurn && drawnCard);
      btnDraw.hidden = !!(myTurn && drawnCard);
      btnCall.hidden = !(myTurn && hand.length === 2 && hand.some(c => canPlay(c) && (!drawnCard || drawnCard === c)));
      btnCall.classList.toggle('on', called);
      deckEl.classList.toggle('clickable', myTurn && !drawnCard);
      q('.cg-actions').classList.toggle('hidden-actions', !myTurn);
    }

    function choose(v) { if (!onChoice) return; const f = onChoice; onChoice = null; f(v); }
    btnDraw.addEventListener('click', () => choose({ type: 'draw' }));
    deckEl.addEventListener('click', () => { if (current === viewer && !drawnCard) choose({ type: 'draw' }); });
    btnPass.addEventListener('click', () => choose({ type: 'pass' }));
    btnCall.addEventListener('click', () => { called = true; Sfx.win(); bubbles[viewer] = 'Chroma !'; render(); });

    const nextIdx = (i, steps = 1) => (((i + dir * steps) % n) + n) % n;

    function refill() {
      if (draw.length || discard.length <= 1) return;
      const top = discard.pop();
      draw = rng.shuffle(discard);
      discard = [top];
      UI.toast('La défausse est mélangée pour refaire la pioche.');
    }

    async function drawCards(i, k) {
      const got = [];
      for (let j = 0; j < k; j++) {
        refill();
        if (!draw.length) break;
        const c = draw.pop();
        got.push(c);
        Sfx.card();
        const show = i === viewer && handVisible;
        await ctx.w(UI.fly(Cards.back('chroma'), rectAt(deckEl), originRect(i), { duration: 330, flipTo: show ? Cards.chroma(c) : null }));
        hands[i].push(c);
        if (i === viewer) hands[i].sort((a, b) => sortKey(a) - sortKey(b));
        render();
      }
      return got;
    }

    async function playCard(i, card) {
      const hidden = !(i === viewer && handVisible);
      let from = originRect(i);
      if (!hidden) {
        const node = handEl.querySelector(`[data-id="${card.id}"]`);
        if (node) { from = node.getBoundingClientRect(); node.style.visibility = 'hidden'; }
      }
      Sfx.card();
      const face = Cards.chroma(card);
      hands[i] = hands[i].filter(c => c !== card);
      await ctx.w(UI.fly(hidden ? Cards.back('chroma') : face, from, rectAt(pileEl),
        { duration: 430, rotFrom: (Math.random() - 0.5) * 30, flipTo: hidden ? face : null }));
      discard.push(card);
      if (card.color !== 'w') color = card.color;
    }

    function pickColor() {
      return new Promise(res => {
        const body = el('div', 'color-pick');
        COLORS.forEach(c => {
          const b = el('button', 'color-btn ch-' + c, Cards.CH_COLORS[c]);
          b.type = 'button';
          b.onclick = () => { Sfx.click(); UI.closeModal(); res(c); };
          body.appendChild(b);
        });
        UI.modal({ title: 'Choisis une couleur', body, buttons: [] });
      });
    }

    function botColor(i) {
      const cnt = { r: 0, b: 0, g: 0, y: 0 };
      hands[i].forEach(c => { if (c.color !== 'w') cnt[c.color]++; });
      return COLORS.slice().sort((a, b) => cnt[b] - cnt[a])[0];
    }

    function botChoice(i) {
      const ok = hands[i].filter(canPlay);
      if (!ok.length) return null;
      const plain = ok.filter(c => c.color !== 'w');
      if (!plain.length) return ok.find(c => c.kind === 'wild') || ok[0];
      const threat = hands[nextIdx(i)].length <= 3;
      const cnt = {}; hands[i].forEach(c => { cnt[c.color] = (cnt[c.color] || 0) + 1; });
      const score = c => (c.kind !== 'num' ? (threat ? 40 : 12) : c.value) + (cnt[c.color] || 0) * 3;
      return plain.sort((a, b) => score(b) - score(a))[0];
    }

    async function reveal(i) {
      if (P[i].bot) return;
      if (multiHuman && (viewer !== i || !handVisible)) {
        handVisible = false; viewer = i; render();
        await ctx.w(UI.handoff(P[i].name));
      }
      viewer = i; handVisible = true;
      hands[i].sort((a, b) => sortKey(a) - sortKey(b));
    }

    async function deal() {
      draw = rng.shuffle(Cards.chromaDeck());
      discard = []; dir = 1; bubbles = [];
      hands = P.map(() => []);
      handVisible = false; current = -1;
      render();
      setStatus('Distribution des cartes…');
      const real = P.map(() => []);
      const jobs = [];
      for (let k = 0; k < HAND * n; k++) {
        const i = k % n;
        real[i].push(draw.pop());
        Sfx.card(k * 0.04);
        jobs.push(UI.fly(Cards.back('chroma'), rectAt(deckEl), originRect(i), { duration: 380, delay: k * 40, rotTo: (Math.random() - 0.5) * 30 }));
      }
      await ctx.w(Promise.all(jobs));
      hands = real;
      handVisible = !multiHuman;
      hands[viewer].sort((x, y) => sortKey(x) - sortKey(y));
      // La première carte de la défausse doit être un chiffre.
      let first = draw.pop();
      while (first.kind !== 'num') { draw.unshift(first); first = draw.pop(); }
      render();
      Sfx.card();
      await ctx.w(UI.fly(Cards.back('chroma'), rectAt(deckEl), rectAt(pileEl), { duration: 420, flipTo: Cards.chroma(first) }));
      discard.push(first); color = first.color;
      render();
    }

    async function playRound(roundNo, starter) {
      await deal();
      current = starter;
      for (;;) {
        const i = current, p = P[i];
        drawnCard = null; called = false;
        await reveal(i);
        bubbles[i] = hands[i].length === 1 ? 'Chroma !' : '';
        render();

        let card = null;
        if (p.bot) {
          setStatus(`<b>${esc(p.name)}</b> réfléchit…`);
          await ctx.sleep(750 + Math.random() * 450);
          card = botChoice(i);
          if (!card) {
            setStatus(`<b>${esc(p.name)}</b> pioche.`);
            const got = await drawCards(i, 1);
            await ctx.sleep(350);
            if (got[0] && canPlay(got[0])) card = got[0];
          }
          if (card && hands[i].length === 2) called = true;
        } else {
          setStatus(`<b>${esc(p.name)}</b>, à toi : pose une carte ou pioche.`);
          let c = await ctx.w(new Promise(res => { onChoice = res; render(); }));
          if (c.type === 'draw') {
            render();
            const got = await drawCards(i, 1);
            if (got[0] && canPlay(got[0])) {
              drawnCard = got[0];
              setStatus(`<b>${esc(p.name)}</b> : la carte piochée est jouable — pose-la ou passe.`);
              c = await ctx.w(new Promise(res => { onChoice = res; render(); }));
            } else {
              setStatus(`<b>${esc(p.name)}</b> pioche et passe.`);
              render();
              await ctx.sleep(700);
              c = { type: 'pass' };
            }
          }
          if (c.type === 'play') card = c.card;
        }

        let skip = 0;
        if (card) {
          const wasCalled = called;
          current = -1;
          await playCard(i, card);
          if (card.color === 'w') {
            render();
            color = p.bot ? botColor(i) : await ctx.w(pickColor());
          }
          render();
          if (hands[i].length === 0) return i;
          if (hands[i].length === 1) {
            if (wasCalled) { bubbles[i] = 'Chroma !'; if (p.bot) Sfx.win(); }
            else {
              UI.toast(`${esc(p.name)} a oublié d'annoncer « Chroma ! » : 2 cartes de pénalité.`, 2800);
              Sfx.bad();
              await drawCards(i, 2);
            }
          }
          const target = nextIdx(i);
          if (card.kind === 'rev') {
            dir *= -1;
            if (n === 2) skip = 1;
            setStatus('Le sens du jeu s\'inverse !');
          } else if (card.kind === 'skip') {
            skip = 1; bubbles[target] = '⊘ Bloqué';
          } else if (card.kind === 'draw2' || card.kind === 'wild4') {
            const k = card.kind === 'draw2' ? 2 : 4;
            skip = 1; bubbles[target] = `+${k}`;
            render();
            setStatus(`<b>${esc(P[target].name)}</b> pioche ${k} cartes et passe son tour.`);
            await drawCards(target, k);
          }
          render();
          if (skip || card.kind === 'rev') await ctx.sleep(650);
        }
        drawnCard = null;
        current = nextIdx(i, 1 + skip);
      }
    }

    (async () => {
      let starter = 0;
      for (let r = 1; ; r++) {
        const w = await playRound(r, starter);
        current = -1;
        const gain = hands.reduce((s, h) => s + h.reduce((a, c) => a + cardPoints(c), 0), 0);
        scores[w] += gain;
        handVisible = !multiHuman; render();
        setStatus(`<b>${esc(P[w].name)}</b> gagne la manche !`);
        Sfx[P[w].bot ? 'lose' : 'win'](); UI.confetti(70);
        const rows = P.map((p, i) => ({ p, i })).sort((a, b) => scores[b.i] - scores[a.i]).map(({ p, i }) =>
          `<tr><td>${i === w ? '🏆 ' : ''}${esc(p.name)}</td><td>${hands[i].length} carte${hands[i].length > 1 ? 's' : ''}</td><td>${i === w ? '+' + gain : ''}</td><td><b>${scores[i]}</b></td></tr>`).join('');
        const v = await ctx.w(UI.modal({
          title: `${esc(P[w].name)} remporte la manche ${r}`,
          body: `<table class="rules-table"><tr><th>Joueur</th><th>Main</th><th>Manche</th><th>Total</th></tr>${rows}</table>`,
          buttons: [{ label: 'Menu', value: 'menu' }, { label: 'Manche suivante', primary: true, value: 'next' }],
        }));
        if (v !== 'next') { document.getElementById('btn-back').click(); break; }
        starter = w;
      }
    })();
  }

  return { id: 'chroma', name: 'Chroma', tagline: 'Couleurs, blocages, +2 et Prismes : le jeu de défausse coloré, avec des cartes originales.', min: 2, max: 6, defaultPlayers: 4, rules, preview, start };
})();
