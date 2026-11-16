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
    body.append(count, list);
    let phones = null;
    if (game.remote) {
      if (cfg.phones == null) cfg.phones = true;
      const row = el('label', 'setup-phones',
        '<input type="checkbox"><span><b>📱 Mains sur les téléphones</b><small>Chaque joueur humain scanne un QR code et voit ses cartes sur son téléphone.</small></span>');
      phones = row.querySelector('input');
      phones.checked = !!cfg.phones;
      phones.addEventListener('change', () => { cfg.phones = phones.checked; });
      body.append(row);
    }
    body.append(seedRow);

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
      if (game.remote && cfg.phones && cfg.players.some(p => !p.bot)) openLobby(game, cfg, typed);
      else startGame(game, cfg, typed, null);
    });
  }

  /* ---------- Salon : les téléphones rejoignent la partie ---------- */
  async function openLobby(game, cfg, seed) {
    const fallback = msg => { UI.closeModal(); UI.toast(msg, 4200); startGame(game, cfg, seed, null); };
    if (!Net.available()) return fallback('Pas de connexion internet : les mains restent sur cet écran.');
    UI.modal({ title: game.name, body: '<p>Ouverture du salon…</p>', buttons: [] });
    let room;
    try {
      room = await Promise.race([
        Net.host(cfg.players.map(p => ({ name: p.name, bot: p.bot })), game.name),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000)),
      ]);
    } catch (e) {
      return fallback('Impossible d\'ouvrir le salon : les mains restent sur cet écran.');
    }
    const v = await lobbyModal(room, true);
    if (v === 'start') startGame(game, cfg, seed, room);
    else room.close();
  }

  function lobbyModal(room, canStart) {
    const body = el('div', 'lobby');
    const qr = el('div', 'lobby-qr', Net.qrSvg(room.url) || '<p>QR code indisponible.</p>');
    const side = el('div', 'lobby-side');
    side.innerHTML = `<p>Chaque joueur scanne ce QR code avec l'appareil photo de son téléphone, puis choisit son nom.</p>
      <div class="lobby-list"></div><a class="lobby-url" href="${esc(room.url)}" target="_blank" rel="noopener">${esc(room.url)}</a>`;
    body.append(qr, side);
    const paint = () => {
      const listEl = side.querySelector('.lobby-list');
      if (!listEl.isConnected && listEl !== side.querySelector('.lobby-list')) return;
      listEl.innerHTML = room.humans().map(i =>
        `<div class="lobby-row${room.connected(i) ? ' ok' : ''}"><span>${esc(room.players[i].name)}</span><b>${room.connected(i) ? '✓ Connecté' : 'En attente…'}</b></div>`).join('');
      const go = document.querySelector('.modal .btn.primary');
      if (go && canStart) go.disabled = !room.allReady();
    };
    const prev = room.onChange;
    room.onChange = () => { paint(); if (prev) prev(); };
    const pr = UI.modal({
      title: canStart ? 'Rejoignez la partie' : 'QR code de la partie',
      body, wide: true, dismissable: !canStart,
      buttons: canStart
        ? [{ label: 'Annuler', value: 'cancel' }, { label: 'Commencer', primary: true, value: 'start', validate: () => room.allReady() }]
        : [{ label: 'Fermer', primary: true, value: 'close' }],
    });
    paint();
    return pr.then(v => { room.onChange = prev; return v; });
  }

  /* ---------- Partie ---------- */
  function startGame(game, cfg, fixedSeed, room) {
    stopSession(room);
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
      net: room || null,
    };
    session = { game, ctx, cfg, room: room || null };
    $('btn-qr').classList.toggle('hidden', !room);
    if (room) {
      room.handler = null;
      let was = room.humans().filter(room.connected);
      room.onChange = () => {
        const now = room.humans().filter(room.connected);
        was.filter(i => !now.includes(i)).forEach(i => UI.toast(`📱 ${esc(room.players[i].name)} est déconnecté — bouton « QR » pour se reconnecter.`, 4000));
        now.filter(i => !was.includes(i)).forEach(i => UI.toast(`📱 ${esc(room.players[i].name)} est connecté.`));
        was = now;
      };
    }
    $('menu').classList.add('hidden');
    $('game').classList.remove('hidden');
    $('hud-title').textContent = game.name;
    $('hud-seed').textContent = '🎲 ' + RNG.seedToString(seed);
    const table = $('table');
    table.innerHTML = '';
    table.className = 'table table-' + game.id + (room ? ' remote' : '');
    game.start(table, ctx);
  }

  function stopSession(keepRoom) {
    if (session) {
      session.ctx.alive = false;
      if (session.room && session.room !== keepRoom) {
        session.room.humans().forEach(i => session.room.send(i, { t: 'end' }));
        const r = session.room; setTimeout(() => r.close(), 400);
      }
    }
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
    startGame(game, cfg, null, session.room);
  });
  $('btn-qr').addEventListener('click', () => {
    if (!session || !session.room || document.getElementById('modal-root').children.length) return;
    Sfx.click();
    lobbyModal(session.room, false);
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
