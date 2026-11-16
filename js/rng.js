/* Générateur pseudo-aléatoire à graine (mulberry32). Chaque partie reçoit une graine neuve. */
const RNG = (() => {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function newSeed() {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  }

  function seedToString(n) {
    return (n >>> 0).toString(36).toUpperCase().padStart(7, '0');
  }

  /* Accepte une graine affichée (base 36) ou n'importe quel texte (haché). */
  function parseSeed(str) {
    const s = String(str).trim().toUpperCase();
    if (!s) return null;
    if (/^[0-9A-Z]{1,7}$/.test(s)) {
      const n = parseInt(s, 36);
      if (n <= 0xFFFFFFFF) return n >>> 0;
    }
    let h = 0x811C9DC5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  function create(seed) {
    const next = mulberry32(seed);
    return {
      seed,
      next,
      int(n) { return Math.floor(next() * n); },
      die() { return 1 + Math.floor(next() * 6); },
      pick(arr) { return arr[Math.floor(next() * arr.length)]; },
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      },
    };
  }

  return { newSeed, seedToString, parseSeed, create };
})();
