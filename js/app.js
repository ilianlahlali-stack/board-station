/* Coquille de l'application : menu, configuration des joueurs, lancement des parties. */
(() => {
  const { el, esc } = UI;
  const $ = id => document.getElementById(id);
  const ORDER = ['dice421', 'president', 'chroma'];
  let session = null;   // { game, ctx, config }

  function loadConfig(game) {
    try {
      const raw = JSON.parse(localStorage.getItem('bs-cfg-' + game.id));
      if (raw && Array.isArray(raw.players) && raw.players.length >= game.min && raw.players.length <= game.max) return raw;
    } catch (e) { /* ignore */ }
    const players = [];
    for (let i = 0; i < game.defaultPlayers; i++) players.push({ name: i < 2 ? `Joueur ${i + 1}` : `Robot ${i - 1}`, bot: i >= 2 });
    return { players };
  }
  function saveConfig(game, cfg) {
    try { localStorage.setItem('bs-cfg-' + game.id, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
  }

  /* ---------- Menu ---------- */
  function buildMenu() {
    const grid = $('game-grid');
    grid.innerHTML = '';
    ORDER.forEach(id => {
      const g = Games[id];
      const tile = el('button', 'game-tile tile-' + id);
      tile.type = 'button';
      const art = el('div', 'tile-art');
      art.appendChild(g.preview());
      tile.appendChild(art);
      tile.appendChild(el('div', 'tile-info',
        `<h3>${g.name}</h3><p>${g.tagline}</p><span class="tile-meta">${g.min}–${g.max} joueurs</span>`));
      tile.addEventListener('click', () => { Sfx.click(); openSetup(g); });
      grid.appendChild(tile);
    });
    const st = $('sound-toggle');
    const paint = () => { st.textContent = Sfx.enabled ? '🔊 Son activé' : '🔇 Son coupé'; };
    paint();
    st.onclick = () => { Sfx.toggle(); paint(); Sfx.click(); };
  }

  /* ---------- Configuration ---------- */
  function openSetup(game) {
    const cfg = loadConfig(game);
    const body = el('div', 'setup');
    const list = el('div', 'setup-players');
    const count = el('div', 'setup-count');
    const seedRow = el('label', 'setup-seed',
      '<span>Graine (optionnel)</span><input type="text" maxlength="24" placeholder="Aléatoire à chaque partie" spellcheck="false">');

    function paint() {
      count.innerHTML = '';
      const minus = el('button', 'step-btn', '−'), plus = el('button', 'step-btn', '+');
      minus.type = plus.type = 'button';
      minus.disabled = cfg.players.length <= game.min;
      plus.disabled = cfg.players.length >= game.max;
      minus.onclick = () => { cfg.players.pop(); paint(); };
      plus.onclick = () => {
        const n = cfg.players.length;
        cfg.players.push({ name: `Robot ${cfg.players.filter(p => p.bot).length + 1}`, bot: true });
        if (n === 0) cfg.players[0].bot = false;
        paint();
      };
      count.append(el('span', 'setup-label', 'Joueurs'), minus, el('span', 'step-val', String(cfg.players.length)), plus);

      list.innerHTML = '';
      cfg.players.forEach((p, i) => {
        const row = el('div', 'setup-row');
        const input = el('input');
        input.type = 'text'; input.maxLength = 14; input.value = p.name;
        input.addEventListener('input', () => { p.name = input.value; });
        const tog = el('button', 'kind-toggle' + (p.bot ? ' bot' : ''), p.bot ? '🤖 Robot' : '🙂 Humain');
        tog.type = 'button';
        tog.onclick = () => { p.bot = !p.bot; paint(); };
        row.append(el('span', 'setup-num', String(i + 1)), input, tog);
        list.appendChild(row);
      });
    }
    paint();
    body.append(count, list, seedRow);

    UI.modal({
      title: game.name,
      body,
      dismissable: true,
      buttons: [
        { label: 'Annuler', value: false },
        { label: 'Jouer', primary: true, value: true },
      ],
    }).then(ok => {
      if (!ok) return;
      cfg.players.forEach((p, i) => { p.name = (p.name || '').trim() || `Joueur ${i + 1}`; });
      saveConfig(game, cfg);
      const typed = RNG.parseSeed(seedRow.querySelector('input').value);
      startGame(game, cfg, typed);
    });
  }

  /* ---------- Partie ---------- */
  function startGame(game, cfg, fixedSeed) {
    stopSession();
    const seed = fixedSeed != null ? fixedSeed : RNG.newSeed();
    const ctx = {
      alive: true,
      seed,
      rng: RNG.create(seed),
      players: cfg.players.map(p => ({ name: p.name, bot: p.bot })),
      /* Attend une promesse ; ne rend jamais la main si la partie a été quittée. */
      w(promise) { return new Promise(res => promise.then(v => { if (ctx.alive) res(v); })); },
      sleep(ms) { return ctx.w(UI.sleep(ms)); },
      humans() { return ctx.players.filter(p => !p.bot).length; },
    };
    session = { game, ctx, cfg };
    $('menu').classList.add('hidden');
    $('game').classList.remove('hidden');
    $('hud-title').textContent = game.name;
    $('hud-seed').textContent = '🎲 ' + RNG.seedToString(seed);
    const table = $('table');
    table.innerHTML = '';
    table.className = 'table table-' + game.id;
    game.start(table, ctx);
  }

  function stopSession() {
    if (session) session.ctx.alive = false;
    session = null;
    UI.closeModal();
    $('fx-layer').innerHTML = '';
  }

  function backToMenu() {
    stopSession();
    $('table').innerHTML = '';
    $('game').classList.add('hidden');
    $('menu').classList.remove('hidden');
  }

  $('btn-back').addEventListener('click', () => { Sfx.click(); backToMenu(); });
  $('btn-restart').addEventListener('click', () => {
    if (!session) return;
    Sfx.click();
    const { game, cfg } = session;
    startGame(game, cfg, null);
  });
  $('btn-rules').addEventListener('click', () => {
    if (!session) return;
    Sfx.click();
    const root = document.getElementById('modal-root');
    if (root.children.length) return;   // une autre fenêtre attend déjà une réponse
    UI.modal({ title: 'Règles — ' + session.game.name, body: session.game.rules, wide: true, dismissable: true, buttons: [{ label: 'Compris', primary: true, value: true }] });
  });
  $('hud-seed').addEventListener('click', () => {
    if (!session) return;
    const s = RNG.seedToString(session.ctx.seed);
    if (navigator.clipboard) navigator.clipboard.writeText(s).then(() => UI.toast('Graine copiée : ' + s), () => {});
  });

  buildMenu();
})();
