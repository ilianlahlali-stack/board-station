/* Liaison ordinateur ↔ téléphones (WebRTC via PeerJS). L'ordinateur est l'hôte et fait autorité :
   il envoie à chaque téléphone l'état de sa main, et reçoit ses actions. */
const Net = (() => {
  const available = () => typeof Peer !== 'undefined';

  function phoneBase() {
    const local = !/^https?:$/.test(location.protocol) || /^(localhost|127\.|\[::1\])/.test(location.hostname);
    if (local) return BS_CONFIG.publicUrl;
    return location.href.replace(/[^/]*([?#].*)?$/, '');
  }

  function randomId() {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return 'bstation-' + Array.from(a, b => (b % 36).toString(36)).join('');
  }

  /* Ouvre un salon. players : [{name, bot}] — seuls les humains ont un siège à réclamer. */
  function host(players, gameName) {
    return new Promise((resolve, reject) => {
      if (!available()) return reject(new Error('offline'));
      const id = randomId();
      const peer = new Peer(id);
      const conns = new Set();
      const room = {
        id, players, gameName,
        url: phoneBase() + 'phone.html?room=' + id,
        seats: {},          // idx → { conn, token }
        last: {},           // dernier état envoyé à chaque siège (renvoyé à la reconnexion)
        handler: null,      // (idx, action) → défini par le jeu en cours
        onChange: null,     // appelé quand un téléphone arrive ou part
        humans() { return players.map((p, i) => i).filter(i => !players[i].bot); },
        connected(i) { const s = room.seats[i]; return !!(s && s.conn && s.conn.open); },
        allReady() { return room.humans().every(room.connected); },
        send(i, msg) {
          room.last[i] = msg;
          if (room.connected(i)) room.seats[i].conn.send(msg);
        },
        close() { room.closed = true; try { peer.destroy(); } catch (e) { /* ignore */ } },
      };

      const seatsMsg = () => ({
        t: 'seats', game: room.gameName,
        seats: room.humans().map(i => ({ idx: i, name: players[i].name, taken: room.connected(i) })),
      });
      const broadcastSeats = () => conns.forEach(c => { if (c.open && c.seatIdx == null) c.send(seatsMsg()); });
      const changed = () => { broadcastSeats(); if (room.onChange) room.onChange(); };

      peer.on('open', () => resolve(room));
      peer.on('error', err => { if (!peer.open && !room.closed) reject(err); });
      peer.on('disconnected', () => { if (!room.closed) setTimeout(() => { try { peer.reconnect(); } catch (e) { /* ignore */ } }, 1500); });

      peer.on('connection', conn => {
        conns.add(conn);
        conn.on('open', () => conn.send(seatsMsg()));
        conn.on('data', msg => {
          if (!msg || typeof msg !== 'object') return;
          if (msg.t === 'claim') {
            const i = msg.idx;
            if (!room.humans().includes(i) || typeof msg.token !== 'string') return;
            const s = room.seats[i];
            if (room.connected(i) && s.token !== msg.token) { conn.send(seatsMsg()); return; }
            if (s && s.conn && s.conn !== conn) { s.conn.seatIdx = null; try { s.conn.close(); } catch (e) { /* ignore */ } }
            room.seats[i] = { conn, token: msg.token };
            conn.seatIdx = i;
            conn.send({ t: 'claimed', idx: i, name: players[i].name, game: room.gameName });
            if (room.last[i]) conn.send(room.last[i]);
            changed();
          } else if (msg.t === 'act' && conn.seatIdx != null && room.seats[conn.seatIdx] && room.seats[conn.seatIdx].conn === conn) {
            if (room.handler && msg.a && typeof msg.a === 'object') room.handler(conn.seatIdx, msg.a);
          }
        });
        const gone = () => { conns.delete(conn); changed(); };
        conn.on('close', gone);
        conn.on('error', gone);
      });
    });
  }

  function qrSvg(text) {
    if (typeof qrcode === 'undefined') return '';
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }

  return { available, host, qrSvg };
})();
