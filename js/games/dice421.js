/* 421 — jeu de dés français : charge puis décharge de 21 jetons. */
window.Games = window.Games || {};
Games.dice421 = (() => {
  const { el, esc } = UI;
  const TOTAL = 21;
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  /* Rotation du cube amenant la face `v` vers le joueur : [rotateX, rotateY]. */
  const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 2: [90, 0] };

  /* Valeur d'une combinaison : score (classement), value (jetons), name. */
  function evaluate(dice) {
    const d = dice.slice().sort((a, b) => b - a);
    const key = d.join('');
    if (key === '421') return { score: 1000, value: 10, name: '421 !' };
    if (key === '111') return { score: 900, value: 7, name: 'Mac — trois As' };
    if (d[1] === 1 && d[2] === 1) return { score: 700 + d[0] * 2 + 1, value: d[0], name: `Deux As + ${d[0]}` };
    if (d[0] === d[1] && d[1] === d[2]) return { score: 700 + d[0] * 2, value: d[0], name: `Brelan de ${d[0]}` };
    if (d[0] - d[1] === 1 && d[1] - d[2] === 1) return { score: 600 + d[0], value: 2, name: `Suite ${key}` };
    if (key === '221') return { score: 0, value: 1, name: 'Nénette (2-2-1)' };
    return { score: 100 + Number(key) / 10, value: 1, name: key.split('').join('-') };
  }

  function makeDie() {
    const wrap = el('div', 'die-wrap');
    wrap.appendChild(el('div', 'die-shadow'));
    const cube = el('div', 'die');
    for (let v = 1; v <= 6; v++) {
      const f = el('div', 'die-face f' + v);
      for (let i = 0; i < 9; i++) f.appendChild(el('span', PIPS[v].includes(i) ? 'pip-dot' : ''));
      cube.appendChild(f);
    }
    wrap.appendChild(cube);
    return wrap;
  }

  function miniDice(dice) {
    return '<span class="mini-dice">' + dice.slice().sort((a, b) => b - a).map(v => `<i class="md md${v}">${'<b></b>'.repeat(v)}</i>`).join('') + '</span>';
  }

  function preview() {
    const p = el('div', 'pv-dice');
    [4, 2, 1].forEach((v, i) => {
      const d = makeDie();
      d.classList.add('pv-die', 'pv' + i);
      const [rx, ry] = FACE_ROT[v];
      d.querySelector('.die').style.transform = `rotateX(${rx - 22}deg) rotateY(${ry + 28}deg)`;
      p.appendChild(d);
    });
    return p;
  }

  const rules = `
    <p><b>But :</b> se débarrasser de ses jetons. Celui qui finit avec les 21 jetons perd.</p>
    <p><b>La charge :</b> chacun lance les trois dés une seule fois. La plus mauvaise combinaison prend dans le pot autant de jetons que vaut la meilleure. Quand le pot est vide, la décharge commence.</p>
    <p><b>La décharge :</b> seuls les joueurs qui ont des jetons jouent. Le premier joueur peut lancer jusqu'à 3 fois (en gardant les dés de son choix) ; les suivants ont droit au même nombre de lancers au maximum. Le gagnant de la manche donne ses jetons au perdant.</p>
    <table class="rules-table">
      <tr><th>Combinaison</th><th>Jetons</th></tr>
      <tr><td>4-2-1</td><td>10</td></tr>
      <tr><td>Mac : 1-1-1</td><td>7</td></tr>
      <tr><td>Deux As + X (1-1-6 … 1-1-2)</td><td>X</td></tr>
      <tr><td>Brelan de X (6-6-6 … 2-2-2)</td><td>X</td></tr>
      <tr><td>Suite (6-5-4, 5-4-3, 4-3-2, 3-2-1)</td><td>2</td></tr>
      <tr><td>Autre (classée par les dés les plus forts)</td><td>1</td></tr>
      <tr><td>Nénette 2-2-1 : la pire de toutes</td><td>1</td></tr>
    </table>
    <p>À rang égal, « Deux As + X » bat « Brelan de X ». En cas d'égalité parfaite, celui qui a utilisé le moins de lancers l'emporte, puis le premier à avoir joué.</p>
    <p><b>Astuce :</b> après un lancer, clique sur un dé pour le mettre de côté.</p>`;

  function start(table, ctx) {
    const rng = ctx.rng;
    const P = ctx.players.map(p => ({ ...p, tokens: 0, last: null, safe: false }));
    const S = { phase: 'charge', pot: TOTAL, current: -1, finish: [] };

    table.innerHTML = `
      <aside class="d-side">
        <div class="d-phase"></div>
        <div class="d-pot"><span class="d-pot-label">Pot</span><div class="chip-stack"></div><span class="d-pot-n"></span></div>
        <div class="d-players"></div>
      </aside>
      <div class="d-main">
        <div class="d-status"></div>
        <div class="piste"><div class="piste-felt"><div class="piste-mark">421</div></div></div>
        <div class="d-bottom">
          <div class="d-tray"><span class="d-tray-label">Dés gardés</span><div class="d-tray-slots"></div></div>
          <div class="d-controls">
            <div class="d-rolls"></div>
            <button class="btn primary big d-roll" type="button">Lancer les dés</button>
            <button class="btn d-stop" type="button">Je garde</button>
          </div>
        </div>
      </div>`;
    const q = s => table.querySelector(s);
    const felt = q('.piste-felt'), traySlots = q('.d-tray-slots');
    const btnRoll = q('.d-roll'), btnStop = q('.d-stop');
    const statusEl = q('.d-status');

    const chipsHtml = n => Array.from({ length: n }, (_, i) => `<i class="chip" style="--i:${i}"></i>`).join('');

    function renderSide() {
      q('.d-phase').innerHTML = S.phase === 'charge'
        ? '<b>La charge</b><span>Un lancer chacun</span>'
        : '<b>La décharge</b><span>Jusqu\'à 3 lancers</span>';
      q('.d-pot .chip-stack').innerHTML = chipsHtml(S.pot);
      q('.d-pot-n').textContent = S.pot;
      q('.d-pot').classList.toggle('empty', S.pot === 0);
      const box = q('.d-players');
      box.innerHTML = '';
      P.forEach((p, i) => {
        const row = el('div', 'd-player' + (i === S.current ? ' active' : '') + (p.safe ? ' safe' : ''));
        row.dataset.idx = i;
        row.innerHTML = `
          <div class="d-p-head"><span class="d-p-name">${p.bot ? '🤖 ' : ''}${esc(p.name)}</span><span class="d-p-n">${p.safe ? '✓ sauvé' : p.tokens + ' jeton' + (p.tokens > 1 ? 's' : '')}</span></div>
          <div class="chip-stack">${chipsHtml(p.tokens)}</div>
          <div class="d-p-last">${p.last ? miniDice(p.last.dice) + `<span>${p.last.ev.name}</span>` : '<span class="muted">—</span>'}</div>`;
        box.appendChild(row);
      });
    }

    const setStatus = html => { statusEl.innerHTML = html; };

    /* ----- Dés ----- */
    let dice = [];   // {node, value, held, x, y, z}
    function resetDice() {
      felt.querySelectorAll('.die-wrap').forEach(n => n.remove());
      traySlots.innerHTML = '';
      dice = [0, 1, 2].map(() => ({ node: makeDie(), value: 0, held: false, x: 50, y: 50, z: 0 }));
    }

    function pickSpots(n) {
      const spots = [];
      let guard = 0;
      while (spots.length < n && guard++ < 400) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 27;
        const x = 50 + r * Math.cos(a), y = 50 + r * Math.sin(a);
        if (spots.every(s => Math.hypot(s[0] - x, s[1] - y) > 21)) spots.push([x, y]);
      }
      while (spots.length < n) spots.push([30 + spots.length * 20, 50]);
      return spots;
    }

    function setCube(d, animate) {
      const [rx, ry] = FACE_ROT[d.value];
      const cube = d.node.querySelector('.die');
      const end = `rotateZ(${d.z}deg) rotateX(${rx}deg) rotateY(${ry}deg)`;
      cube.style.transform = end;
      return { cube, end, rx, ry };
    }

    async function roll() {
      const toRoll = dice.filter(d => !d.held);
      const spots = pickSpots(toRoll.length);
      Sfx.dice(toRoll.length);
      const feltSize = felt.clientWidth;
      toRoll.forEach((d, k) => {
        d.value = rng.die();
        [d.x, d.y] = spots[k];
        d.z = Math.round(Math.random() * 360);
        d.node.classList.remove('in-tray', 'can-hold');
        d.node.style.left = d.x + '%'; d.node.style.top = d.y + '%';
        felt.appendChild(d.node);
        const { cube, end, rx, ry } = setCube(d);
        const sx = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.floor(Math.random() * 2)) * 360;
        const sy = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.floor(Math.random() * 2)) * 360;
        const dur = 1050 + k * 140 + Math.random() * 200;
        cube.animate([
          { transform: `rotateZ(${d.z - 240}deg) rotateX(${rx + sx}deg) rotateY(${ry + sy}deg)` },
          { transform: end },
        ], { duration: dur, easing: 'cubic-bezier(.15,.6,.25,1)', fill: 'backwards' });
        const dx = (88 - d.x) / 100 * feltSize, dy = (92 - d.y) / 100 * feltSize;
        const T = (f, s) => `translate(calc(-50% + ${dx * f}px), calc(-50% + ${dy * f}px)) scale(${s})`;
        d.node.animate([
          { transform: T(1, 1.7), opacity: 0 },
          { transform: T(0.85, 1.6), opacity: 1, offset: 0.08 },
          { transform: T(0.38, 1), offset: 0.42, easing: 'ease-out' },
          { transform: T(0.22, 1.22), offset: 0.56, easing: 'ease-in' },
          { transform: T(0.1, 1), offset: 0.72, easing: 'ease-out' },
          { transform: T(0.05, 1.08), offset: 0.82, easing: 'ease-in' },
          { transform: T(0, 1) },
        ], { duration: dur, easing: 'linear', fill: 'backwards' });
      });
      await ctx.sleep(1050 + toRoll.length * 140 + 260);
    }

    function flip(node, mutate) {
      const a = node.getBoundingClientRect();
      mutate();
      const b = node.getBoundingClientRect();
      const base = node.classList.contains('in-tray') ? '' : 'translate(-50%,-50%) ';
      node.animate([
        { transform: `${base}translate(${a.left - b.left}px, ${a.top - b.top}px)` },
        { transform: `${base}translate(0,0)` },
      ], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }

    function setHeld(d, held) {
      if (d.held === held) return;
      d.held = held;
      Sfx.chip();
      flip(d.node, () => {
        if (held) {
          d.node.classList.add('in-tray');
          d.node.style.left = ''; d.node.style.top = '';
          d.z = 0; setCube(d);
          traySlots.appendChild(d.node);
        } else {
          d.node.classList.remove('in-tray');
          d.node.style.left = d.x + '%'; d.node.style.top = d.y + '%';
          felt.appendChild(d.node);
        }
      });
    }

    function renderRolls(used, max) {
      q('.d-rolls').innerHTML = Array.from({ length: max }, (_, i) => `<i class="roll-dot${i < used ? ' used' : ''}"></i>`).join('') +
        `<span>${used}/${max} lancer${max > 1 ? 's' : ''}</span>`;
    }

    /* Choix du robot : renvoie null pour s'arrêter, sinon les dés à garder. */
    function botDecide(best) {
      const vals = dice.map(d => d.value);
      const ev = evaluate(vals);
      if (ev.score >= 700) return null;
      if (ev.score >= 600 && (!best || ev.score > best.score)) return null;
      const keep = [false, false, false];
      for (const want of [4, 2, 1]) {
        const i = vals.findIndex((v, k) => v === want && !keep[k]);
        if (i >= 0) keep[i] = true;
      }
      return keep;
    }

    /* Tour d'un joueur : renvoie { dice, rolls, ev }. */
    async function turn(i, maxRolls, best) {
      const p = P[i];
      S.current = i;
      p.last = null;
      renderSide();
      resetDice();
      let used = 0;
      renderRolls(0, maxRolls);
      btnStop.hidden = true;
      btnRoll.textContent = 'Lancer les dés';

      const waitChoice = () => new Promise(res => {
        btnRoll.disabled = dice.every(d => d.held);
        btnRoll.onclick = () => { finish('roll'); };
        btnStop.onclick = () => { finish('stop'); };
        const handlers = dice.map(d => {
          const h = () => { setHeld(d, !d.held); btnRoll.disabled = dice.every(x => x.held); };
          if (used > 0) { d.node.classList.add('can-hold'); d.node.addEventListener('click', h); }
          return h;
        });
        function finish(v) {
          btnRoll.onclick = btnStop.onclick = null;
          dice.forEach((d, k) => { d.node.classList.remove('can-hold'); d.node.removeEventListener('click', handlers[k]); });
          btnRoll.disabled = true; btnStop.hidden = true;
          res(v);
        }
      });

      while (used < maxRolls) {
        if (p.bot) {
          btnRoll.disabled = true; btnStop.hidden = true;
          setStatus(`<b>${esc(p.name)}</b> ${used === 0 ? 'secoue les dés…' : 'réfléchit…'}`);
          await ctx.sleep(used === 0 ? 700 : 900);
          if (used > 0) {
            const keep = botDecide(best);
            if (!keep) break;
            for (let k = 0; k < 3; k++) if (keep[k] !== dice[k].held) { setHeld(dice[k], keep[k]); await ctx.sleep(280); }
            await ctx.sleep(350);
          }
        } else {
          if (used === 0) setStatus(`<b>${esc(p.name)}</b>, à toi de lancer !`);
          else setStatus(`<b>${esc(p.name)}</b> : clique sur les dés à garder, puis relance — ou arrête-toi là.`);
          btnStop.hidden = used === 0;
          btnRoll.textContent = used === 0 ? 'Lancer les dés' : 'Relancer';
          const c = await ctx.w(waitChoice());
          if (c === 'stop') break;
        }
        setStatus(`<b>${esc(p.name)}</b> lance…`);
        await roll();
        used++;
        renderRolls(used, maxRolls);
        const evNow = evaluate(dice.map(d => d.value));
        setStatus(`<b>${esc(p.name)}</b> : ${evNow.name}`);
        if (evNow.score === 1000) { Sfx.win(); break; }
      }
      btnRoll.disabled = true; btnStop.hidden = true;
      const vals = dice.map(d => d.value);
      const ev = evaluate(vals);
      p.last = { dice: vals, ev, rolls: used };
      renderSide();
      setStatus(`<b>${esc(p.name)}</b> fait <b>${ev.name}</b> — ${ev.value} jeton${ev.value > 1 ? 's' : ''}`);
      await ctx.sleep(1100);
      return { i, dice: vals, rolls: used, ev };
    }

    async function moveChips(fromEl, toEl, n) {
      const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
      const size = 22;
      const jobs = [];
      for (let k = 0; k < n; k++) {
        const from = { left: a.left + a.width / 2 - size / 2, top: a.top + a.height / 2 - size / 2, width: size, height: size };
        const to = { left: b.left + 20 + Math.random() * 30, top: b.top + b.height / 2 - size / 2, width: size, height: size };
        Sfx.chip(k * 0.07);
        jobs.push(UI.fly(el('i', 'chip solo'), from, to, { duration: 480, delay: k * 70 }));
      }
      await ctx.w(Promise.all(jobs));
    }

    async function banner(html, needClick) {
      const b = el('div', 'd-banner', `<div>${html}</div>`);
      table.appendChild(b);
      if (needClick) {
        const btn = el('button', 'btn primary', 'Continuer');
        btn.type = 'button';
        b.appendChild(btn);
        await ctx.w(new Promise(res => { btn.onclick = () => { Sfx.click(); res(); }; }));
      } else {
        await ctx.sleep(2600);
      }
      b.remove();
    }

    const rowOf = i => table.querySelector(`.d-player[data-idx="${i}"]`);

    async function round(starter) {
      const inPlay = P.map((p, i) => i).filter(i => S.phase === 'charge' || P[i].tokens > 0);
      P.forEach(p => { p.last = null; });
      let s = starter;
      while (!inPlay.includes(s)) s = (s + 1) % P.length;
      const order = [];
      for (let k = 0; k < P.length; k++) { const i = (s + k) % P.length; if (inPlay.includes(i)) order.push(i); }

      let maxRolls = S.phase === 'charge' ? 1 : 3;
      const results = [];
      for (let k = 0; k < order.length; k++) {
        const best = results.length ? results.map(r => r.ev).sort((a, b) => b.score - a.score)[0] : null;
        const r = await turn(order[k], maxRolls, best);
        r.pos = k;
        results.push(r);
        if (S.phase === 'decharge' && k === 0) maxRolls = Math.max(1, r.rolls);
      }
      results.sort((a, b) => (b.ev.score - a.ev.score) || (a.rolls - b.rolls) || (a.pos - b.pos));
      const win = results[0], lose = results[results.length - 1];
      S.current = -1;
      const W = P[win.i], L = P[lose.i];
      let n, msg;
      if (S.phase === 'charge') {
        n = Math.min(win.ev.value, S.pot);
        msg = `<b>${esc(W.name)}</b> a la meilleure main (${win.ev.name}).<br><b>${esc(L.name)}</b> prend <b>${n}</b> jeton${n > 1 ? 's' : ''} dans le pot.`;
        renderSide();
        await moveChips(q('.d-pot'), rowOf(lose.i), n);
        S.pot -= n; L.tokens += n;
      } else {
        n = Math.min(win.ev.value, W.tokens);
        msg = `<b>${esc(W.name)}</b> gagne la manche (${win.ev.name})<br>et donne <b>${n}</b> jeton${n > 1 ? 's' : ''} à <b>${esc(L.name)}</b>.`;
        renderSide();
        await moveChips(rowOf(win.i), rowOf(lose.i), n);
        W.tokens -= n; L.tokens += n;
        if (W.tokens === 0) { W.safe = true; S.finish.push(win.i); }
      }
      renderSide();
      setStatus('');
      await banner(msg, ctx.humans() > 0);
      return lose.i;
    }

    async function endGame(loser) {
      S.current = -1;
      renderSide();
      const winner = S.finish.length ? P[S.finish[0]] : null;
      Sfx[P[loser].bot ? 'win' : 'lose']();
      UI.confetti();
      const lines = S.finish.map((i, k) => `<li>${k === 0 ? '🏆' : '✓'} ${esc(P[i].name)}</li>`).join('') + `<li>💀 ${esc(P[loser].name)} — garde les ${TOTAL} jetons</li>`;
      const v = await ctx.w(UI.modal({
        title: winner ? `${esc(winner.name)} gagne la partie !` : 'Partie terminée',
        body: `<p><b>${esc(P[loser].name)}</b> perd la partie.</p><ol class="final-list">${lines}</ol>`,
        buttons: [{ label: 'Menu', value: 'menu' }, { label: 'Rejouer', primary: true, value: 'again' }],
      }));
      document.getElementById(v === 'again' ? 'btn-restart' : 'btn-back').click();
    }

    async function play() {
      renderSide();
      resetDice();
      renderRolls(0, 1);
      btnStop.hidden = true; btnRoll.disabled = true;
      let starter = 0;
      for (;;) {
        starter = await round(starter);
        if (S.phase === 'charge' && S.pot === 0) {
          P.forEach((p, i) => { if (p.tokens === 0) { p.safe = true; S.finish.push(i); } });
          const holders = P.filter(p => p.tokens > 0);
          if (holders.length === 1) return endGame(P.indexOf(holders[0]));
          S.phase = 'decharge';
          P.forEach(p => { p.last = null; });
          renderSide();
          await banner('Le pot est vide.<br><b>Place à la décharge !</b>', ctx.humans() > 0);
        } else if (S.phase === 'decharge') {
          const holders = P.filter(p => p.tokens > 0);
          if (holders.length === 1) return endGame(P.indexOf(holders[0]));
        }
      }
    }
    play();
  }

  return { id: 'dice421', name: '421', tagline: 'Le jeu de dés des bistrots : charge, décharge et coups de chance.', min: 2, max: 6, defaultPlayers: 3, rules, preview, start };
})();
