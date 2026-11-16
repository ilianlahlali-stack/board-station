/* Page téléphone : affiche la main du joueur et envoie ses actions à l'ordinateur hôte. */
(() => {
  const { el, esc } = UI;
  const root = document.getElementById('phone');
  const room = new URLSearchParams(location.search).get('room');
  const KEY = 'bs-seat-' + room;
  const COLOR_NAMES = Cards.CH_COLORS;

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* ignore */ }
  let peer = null, conn = null, online = false;
  let view = 'connecting', seats = null, st = null, gameName = '';
  let sel = new Set(), wasTurn = false, retryTimer = null;

  const send = msg => { if (conn && conn.open) conn.send(msg); };
  const act = a => send({ t: 'act', a });

  function message(title, text, btn) {
    root.innerHTML = `<div class="ph-center"><div class="ph-logo">⚄ Board Station</div><h1>${title}</h1><p>${text}</p></div>`;
    if (btn) {
      const b = el('button', 'btn primary big', btn.label);
      b.type = 'button'; b.onclick = btn.onClick;
      root.firstChild.appendChild(b);
    }
  }

  /* ---------- Connexion ---------- */
  function retry(ms) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, ms);
  }

  function connect() {
    if (!room) return message('Lien incomplet', 'Scanne le QR code affiché sur l\'ordinateur.');
    if (typeof Peer === 'undefined') return message('Hors ligne', 'Une connexion internet est nécessaire.', { label: 'Réessayer', onClick: () => location.reload() });
    if (conn && conn.open) return;
    if (!peer || peer.destroyed) {
      peer = new Peer();
      peer.on('open', openConn);
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
      peer.on('error', err => {
        online = false;
        if (err && err.type === 'peer-unavailable') {
          if (view !== 'state') message('Partie introuvable', 'La partie n\'est pas encore ouverte, ou elle est terminée. Nouvel essai automatique…');
          else paint();
          retry(3000);
        } else {
          try { peer.destroy(); } catch (e) { /* ignore */ }
          paint(); retry(2500);
        }
      });
    } else if (peer.open) {
      openConn();
    } else if (peer.disconnected) {
      try { peer.reconnect(); } catch (e) { /* ignore */ }
      retry(2500);
    }
  }

  function openConn() {
    const c = peer.connect(room, { reliable: true, serialization: 'json' });
    conn = c;
    c.on('open', () => {
      online = true;
      if (saved) c.send({ t: 'claim', idx: saved.idx, token: saved.token });
      paint();
    });
    c.on('data', onMsg);
    const lost = () => { if (conn !== c) return; online = false; paint(); retry(1200); };
    c.on('close', lost);
    c.on('error', lost);
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && !(conn && conn.open)) retry(100); });

  function onMsg(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'seats') {
      seats = msg.seats; gameName = msg.game;
      if (!st || !saved) view = 'seats';
    } else if (msg.t === 'claimed') {
      gameName = msg.game;
      view = 'state';
      if (!st) st = { mode: 'wait', name: msg.name, game: msg.game };
    } else if (msg.t === 'state') {
      const turnNow = !!msg.turn;
      if (turnNow && !wasTurn && navigator.vibrate) { try { navigator.vibrate([90, 60, 90]); } catch (e) { /* ignore */ } }
      if (!turnNow || !st || JSON.stringify(st.top) !== JSON.stringify(msg.top)) sel.clear();
      wasTurn = turnNow;
      st = msg; view = 'state';
    } else if (msg.t === 'end') {
      view = 'end';
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    }
    paint();
  }

  function claim(idx) {
    const token = (saved && saved.idx === idx && saved.token) || Math.random().toString(36).slice(2) + Date.now().toString(36);
    saved = { idx, token };
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* ignore */ }
    send({ t: 'claim', idx, token });
    if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
  }

  /* ---------- Affichage ---------- */
  function paint() {
    if (view === 'end') return message('Partie terminée', 'Merci d\'avoir joué ! Scanne un nouveau QR code pour rejoindre une autre partie.');
    if (view === 'connecting') return message('Connexion…', 'Recherche de la partie sur l\'ordinateur.');
    if (view === 'seats') return paintSeats();
    paintState();
  }

  function paintSeats() {
    root.innerHTML = `<div class="ph-center"><div class="ph-logo">⚄ Board Station</div><h1>${esc(gameName)}</h1><p>Qui es-tu ?</p><div class="ph-seats"></div></div>`;
    const box = root.querySelector('.ph-seats');
    (seats || []).forEach(s => {
      const mine = saved && saved.idx === s.idx;
      const b = el('button', 'btn big ph-seat' + (s.taken && !mine ? ' taken' : ''), esc(s.name) + (s.taken && !mine ? ' <small>déjà connecté</small>' : ''));
      b.type = 'button';
      b.disabled = s.taken && !mine;
      b.onclick = () => claim(s.idx);
      box.appendChild(b);
    });
  }

  function button(label, cls, enabled, onClick) {
    const b = el('button', 'btn big ' + cls, label);
    b.type = 'button'; b.disabled = !enabled;
    b.onclick = onClick;
    return b;
  }

  function paintState() {
    const s = st;
    root.innerHTML = '';
    const head = el('header', 'ph-head',
      `<span class="ph-name">${esc(s.name || '')}</span>` + (s.badge ? `<span class="seat-badge">${esc(s.badge)}</span>` : '') +
      `<span class="ph-game">${esc(s.game || gameName)}</span><i class="ph-dot${online ? ' on' : ''}" title="${online ? 'Connecté' : 'Reconnexion…'}"></i>`);
    root.appendChild(head);
    if (!online) root.appendChild(el('div', 'ph-offline', 'Reconnexion à l\'ordinateur…'));

    if (s.mode === 'wait') {
      root.appendChild(el('div', 'ph-center', '<h1>C\'est bon ✓</h1><p>Tu es connecté. La partie va commencer sur l\'ordinateur.</p>'));
      return;
    }

    const strip = el('div', 'ph-players');
    (s.players || []).forEach(p => {
      strip.appendChild(el('span', 'ph-chip' + (p.current ? ' current' : ''), `${esc(p.name)} <b>${p.count}</b>${p.note ? ` <em>${esc(p.note)}</em>` : ''}`));
    });
    root.appendChild(strip);

    const turn = el('div', 'ph-turn' + (s.turn ? ' on' : ''), s.turn ? 'À toi de jouer !' : esc(s.status || 'En attente…'));
    root.appendChild(turn);

    const info = el('div', 'ph-info');
    const hand = el('div', 'ph-hand');
    const actions = el('footer', 'ph-actions');

    if (s.mode === 'president') {
      const top = s.top;
      info.innerHTML = s.done ? 'Tu as terminé cette manche 🎉'
        : top ? `À battre : <b>${top.count > 1 ? top.count + ' × ' : ''}${Cards.label(top.rank)}</b> — pose ${top.count > 1 ? top.count + ' cartes' : 'une carte'} de valeur égale ou supérieure`
          : (s.turn ? 'Tu ouvres le pli : pose 1 à 4 cartes de même valeur' : 'Nouveau pli');
      const countOf = r => s.hand.filter(c => c.rank === r).length;
      const playable = c => s.turn && (!top || (c.rank >= top.rank && countOf(c.rank) >= top.count));
      const chosen = () => s.hand.filter(c => sel.has(c.id));
      const valid = () => {
        const x = chosen();
        if (!x.length || x.some(c => c.rank !== x[0].rank)) return false;
        return !top || (x.length === top.count && x[0].rank >= top.rank);
      };
      s.hand.forEach(card => {
        const node = Cards.classic(card);
        if (sel.has(card.id)) node.classList.add('selected');
        if (s.turn) {
          if (playable(card)) {
            node.classList.add('playable');
            node.onclick = () => {
              if (sel.has(card.id)) sel.delete(card.id);
              else {
                const x = chosen();
                if (x.length && x[0].rank !== card.rank) sel.clear();
                if (top && sel.size >= top.count) sel.clear();
                sel.add(card.id);
                if (top && top.count > 1) for (const c of s.hand) { if (sel.size >= top.count) break; if (c.rank === card.rank) sel.add(c.id); }
              }
              paint();
            };
          } else node.classList.add('dim');
        }
        hand.appendChild(node);
      });
      actions.append(
        button('Passer', '', s.turn && !!top, () => act({ type: 'pass' })),
        button('Jouer', 'primary', s.turn && valid(), () => { act({ type: 'play', ids: [...sel] }); sel.clear(); }),
      );
    } else if (s.mode === 'chroma') {
      if (s.top) {
        const mini = Cards.chroma(s.top);
        mini.classList.add('ph-topcard');
        info.append(mini, el('span', '', `Couleur demandée : <b class="col-${s.color}">${COLOR_NAMES[s.color]}</b>`));
      }
      s.hand.forEach(card => {
        const node = Cards.chroma(card);
        if (s.turn) {
          if (s.playable.includes(card.id)) { node.classList.add('playable'); node.onclick = () => act({ type: 'play', id: card.id }); }
          else node.classList.add('dim');
        }
        hand.appendChild(node);
      });
      if (s.canPass) actions.append(button('Passer', '', true, () => act({ type: 'pass' })));
      else actions.append(button('Piocher', '', s.canDraw, () => act({ type: 'draw' })));
      if (s.canCall) actions.append(button('Chroma !', 'warn' + (s.called ? ' on' : ''), true, () => act({ type: 'call' })));
      if (s.prompt === 'color') {
        const pick = el('div', 'ph-prompt', '<h2>Choisis une couleur</h2><div class="color-pick"></div>');
        ['r', 'b', 'g', 'y'].forEach(c => {
          const b = el('button', 'color-btn ch-' + c, COLOR_NAMES[c]);
          b.type = 'button'; b.onclick = () => act({ type: 'color', color: c });
          pick.querySelector('.color-pick').appendChild(b);
        });
        root.appendChild(pick);
      }
    }
    root.append(info, hand, actions);
  }

  paint();
  connect();
})();
