/* Tácticas del Rock — NET: host autoritativo, cliente, lobby y LocalTransport.
 * Se carga después de sim.js (<script src="net.js">) y en Node con require("./net.js").
 *
 * TRANSPORTE: una mini base de datos por rutas. La lógica de host y cliente solo usa
 * esta interfaz, así que no sabe si abajo hay memoria (LocalTransport) o Firebase:
 *   uid                       identidad del jugador
 *   now()                     hora del servidor (ms)
 *   TIMESTAMP                 marcador "hora del servidor" para escribir
 *   get(path)                 -> Promise<valor|null>
 *   set(path, valor)          -> Promise
 *   update(path, {rel: val})  -> Promise   (atómico, varias rutas; null borra)
 *   push(path, valor)         -> Promise<clave>  (claves ordenables)
 *   onValue(path, cb)         -> desuscribir   (cb con el valor actual y en cada cambio)
 *   transaction(path, fn)     -> Promise<{committed, value}>  (fn devuelve undefined = abortar)
 *   presence(path)            marca {online:true} ahora y {online:false} al desconectarse
 *
 * SALA rooms/{code}:
 *   meta      {hostId, status:'lobby'|'playing'|'ended', createdAt, lastActivity, seed,
 *              settings:{bots, difficulty, botTakeover, planningSeconds},
 *              phase:{name:'planning'|'combat'|'ended', endsAt, key}, away:{uid: rondas}}
 *   members/{uid}  {name, joinedAt}        presence/{uid} {online, lastSeen}
 *   ready/{uid}    clave de la fase en la que tocó "Listo"
 *   actions/{key}  {uid, action}           (intenciones; el host las consume)
 *   state/{meta, pool, combats, players/{pid}}   strings JSON (ver splitState)
 *
 * El estado se guarda en strings JSON por subárbol porque Realtime Database convierte
 * los arrays con null (el banco, el tablero) en objetos y borra los arrays vacíos:
 * así lo que lee un cliente es exactamente lo que escribió el host, byte a byte.
 * ===================================================================== */
'use strict';
const NET = (() => {
  const S = typeof SIM !== 'undefined' ? SIM : require('./sim.js').SIM;
  const D = typeof DATA !== 'undefined' ? DATA : require('./sim.js').DATA;

  const CFG = {
    COMBAT_EXTRA_MS: 2500,        // margen después de la pelea más larga (cartel de resultado)
    MIGRATE_AFTER_MS: 10000,      // host desconectado más de esto -> se migra
    TAKEOVER_AFTER_ROUNDS: 2,     // rondas desconectado antes de que lo tome un bot (si está activado)
    ROOM_TTL_MS: 24 * 3600 * 1000,
    CODE_CHARS: 'ABCDEFGHJKMNPQRSTUVWXYZ', CODE_LEN: 4,
  };

  // ---------- estado <-> partes (strings JSON) ----------
  function splitState(s) {
    const { pool, players, combats, ...meta } = s;
    const pl = {};
    for (const id of s.order) pl[id] = JSON.stringify(players[id]);
    return { meta: JSON.stringify(meta), pool: JSON.stringify(pool), combats: JSON.stringify(combats || []), players: pl };
  }
  function joinState(parts) {
    if (!parts || !parts.meta) return null;
    const meta = JSON.parse(parts.meta);
    const s = { ...meta, pool: JSON.parse(parts.pool), players: {}, combats: JSON.parse(parts.combats || '[]') };
    for (const id of meta.order) s.players[id] = JSON.parse(parts.players[id]);
    return s;
  }
  // Hash canónico (no depende del orden de claves al rearmar el objeto).
  function partsHash(parts) {
    if (!parts || !parts.meta) return null;
    let str = parts.meta + '|' + parts.pool + '|' + parts.combats;
    for (const id of JSON.parse(parts.meta).order) str += '|' + parts.players[id];
    return S.seedFrom(str);
  }
  const stateHashCanon = s => partsHash(splitState(s));
  const phaseKey = (s, name) => `${s.roundsPlayed}|${name}`;
  const sortedKeys = o => Object.keys(o || {}).sort();

  // ---------- host autoritativo ----------
  // Es el único que escribe state/ y meta/. Procesa la cola de acciones en orden de clave,
  // corre los bots, resuelve las rondas y maneja las fases. Todo lo que necesita para
  // seguir (incluidos los RNG) está en la sala: otro host puede retomar desde ahí.
  function createHost({ transport: T, code, getRoom }) {
    const base = `rooms/${code}`;
    let state = null, parts = { players: {} }, meta = null, active = true, chain = Promise.resolve();
    const consumed = new Set();

    function diffPatch(next) {
      const np = splitState(next), patch = {};
      for (const k of ['meta', 'pool', 'combats']) if (np[k] !== parts[k]) patch['state/' + k] = np[k];
      for (const id of Object.keys(np.players)) if (np.players[id] !== parts.players[id]) patch['state/players/' + id] = np.players[id];
      return { patch, np };
    }
    async function commit(next, extra = {}) {
      if (!active) return false;
      const room = getRoom();
      if (room && room.meta && room.meta.hostId !== T.uid) { active = false; return false; } // ya no soy host
      const { patch, np } = next ? diffPatch(next) : { patch: {}, np: null };
      Object.assign(patch, extra, { 'meta/lastActivity': T.TIMESTAMP });
      for (const k of Object.keys(extra)) if (k.startsWith('meta/') && !k.startsWith('meta/lastActivity')) setDeep(meta, k.slice(5), extra[k]);
      await T.update(base, patch);
      if (next) { state = next; parts = np; }
      if (extra['meta/phase']) await T.update('roomIndex/' + code, { lastActivity: T.TIMESTAMP }).catch(() => {}); // para la limpieza de salas viejas
      return true;
    }
    function setDeep(obj, rel, val) {
      const ks = rel.split('/'); let o = obj;
      for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] ||= {};
      if (val === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = val;
    }

    // Retoma desde lo guardado (arranque normal o migración).
    async function resume() {
      const room = await T.get(base);
      meta = room.meta;
      parts = room.state ? { ...room.state, players: { ...(room.state.players || {}) } } : { players: {} };
      state = joinState(parts);
      consumed.clear();
    }
    async function startGame() {
      const room = await T.get(base);
      meta = room.meta;
      const st = meta.settings || {};
      const humans = sortedKeys(room.members).map(uid => ({ uid, ...room.members[uid] }))
        .sort((a, b) => a.joinedAt - b.joinedAt || (a.uid < b.uid ? -1 : 1))
        .map(m => ({ id: m.uid, name: m.name }));
      const bots = Math.max(0, Math.min(st.bots ?? 0, 8 - humans.length));
      const slots = S.makeSlots({ humans, bots, difficulty: st.difficulty ?? 0.3 });
      let s = S.createGame({ seed: meta.seed || code, slots });
      s = S.runAllBots(s);
      const key = phaseKey(s, 'planning');
      await commit(s, {
        'meta/status': 'playing',
        'meta/phase': { name: 'planning', endsAt: planningEnd(), key },
        'meta/away': null,
      });
    }
    function planningEnd() {
      const secs = (meta.settings || {}).planningSeconds;
      return secs > 0 ? T.now() + secs * 1000 : 0; // 0 = sin límite (modo offline sin timer)
    }

    // Humanos que cuentan para "todos listos": conectados y (en planificación) vivos.
    function humansFor(room, phaseName) {
      return sortedKeys(room.members).filter(uid => {
        const p = state.players[uid];
        if (!p || p.isBot) return false;
        if (phaseName === 'planning' && !p.alive) return false;
        return room.presence && room.presence[uid] && room.presence[uid].online;
      });
    }
    function allReady(room) {
      const ph = meta.phase, humans = humansFor(room, ph.name);
      if (!humans.length) return !ph.endsAt; // nadie conectado: solo avanza solo si no hay límite de tiempo
      return humans.every(uid => room.ready && room.ready[uid] === ph.key);
    }

    async function processQueue(room) {
      const keys = sortedKeys(room.actions).filter(k => !consumed.has(k));
      if (!keys.length) return;
      let s = state;
      const extra = {};
      for (const k of keys) {
        const { uid, action } = room.actions[k] || {};
        // Solo se aplican en planificación; fuera de fase se descartan.
        if (meta.phase.name === 'planning' && uid && action) s = S.applyAction(s, uid, action);
        extra['actions/' + k] = null;
        consumed.add(k);
      }
      await commit(s === state ? null : s, extra);
    }

    async function endPlanning(room) {
      await processQueue(room); // lo que llegó antes del cierre
      const next = S.resolveRound(state);
      if (next.phase === 'ended') {
        await commit(next, { 'meta/status': 'ended', 'meta/phase': { name: 'ended', endsAt: 0, key: phaseKey(next, 'ended') } });
        return;
      }
      const maxTicks = Math.max(0, ...next.combats.map(c => c.ticks || 0));
      const endsAt = T.now() + Math.round(maxTicks / D.CONFIG.TICK_RATE * 1000) + CFG.COMBAT_EXTRA_MS;
      await commit(next, { 'meta/phase': { name: 'combat', endsAt, key: phaseKey(next, 'combat') } });
    }

    async function startPlanning(room) {
      let s = state;
      const away = { ...(meta.away || {}) }, takeover = (meta.settings || {}).botTakeover;
      for (const uid of sortedKeys(room.members)) {
        const p = s.players[uid];
        if (!p || !p.alive) continue;
        const online = room.presence && room.presence[uid] && room.presence[uid].online;
        away[uid] = online ? 0 : (away[uid] || 0) + 1;
        if (takeover && away[uid] >= CFG.TAKEOVER_AFTER_ROUNDS) s = S.setBotControl(s, uid, true);
        if (online) s = S.setBotControl(s, uid, false);
      }
      s = S.runAllBots(s); // los bots compran al inicio de la planificación
      await commit(s, { 'meta/phase': { name: 'planning', endsAt: planningEnd(), key: phaseKey(s, 'planning') }, 'meta/away': away });
    }

    // Un paso: consumir la cola y avanzar de fase si corresponde. Idempotente.
    async function step() {
      if (!active || !state || !meta || meta.status !== 'playing') return;
      const room = getRoom();
      if (!room || !room.meta) return;
      if (room.meta.hostId !== T.uid) { active = false; return; }
      meta.settings = room.meta.settings || meta.settings;
      const ph = meta.phase;
      if (ph.name === 'planning') {
        // Si volvió alguien que estaba manejado por un bot, se le devuelve el lugar ya.
        for (const uid of sortedKeys(room.members)) {
          const p = state.players[uid];
          if (p && p.takenOver && room.presence && room.presence[uid] && room.presence[uid].online) await commit(S.setBotControl(state, uid, false));
        }
        await processQueue(room);
        if ((ph.endsAt && T.now() >= ph.endsAt) || allReady(getRoom() || room)) await endPlanning(getRoom() || room);
      } else if (ph.name === 'combat') {
        await processQueue(room); // descarta lo que llegue fuera de fase
        if (T.now() >= ph.endsAt || allReady(room)) await startPlanning(room);
      }
    }
    // Serializa los pasos (nunca dos a la vez).
    const tick = () => (chain = chain.then(step).catch(e => { console.error('host', e); }));

    return {
      resume, startGame, tick,
      stop() { active = false; },
      get active() { return active; },
      get state() { return state; },
      get hash() { return partsHash(parts); },
    };
  }

  // ---------- cliente ----------
  // Lee la sala, arma la vista (estado del host + sus propias acciones pendientes) y manda
  // intenciones. Nunca calcula una tienda: si hay un REROLL pendiente, deja de predecir.
  function createClient({ transport: T, code, onChange, log = console }) {
    const base = `rooms/${code}`, me = T.uid;
    let room = null, server = null, view = null, viewHash = null, lastCombatCheck = null;
    const desyncs = [];

    function rebuild() {
      // Si una parte no se puede leer (p. ej. una escritura local que el servidor va a
      // rechazar por las reglas), se conserva el último estado bueno.
      try { server = room && room.state ? joinState(room.state) : null; }
      catch (e) { log.error('Estado ilegible, se ignora:', e.message); return; }
      view = server;
      if (server && room.actions) { // predicción optimista de mis acciones aún no procesadas
        for (const k of sortedKeys(room.actions)) {
          const a = room.actions[k];
          if (!a || a.uid !== me) continue;
          if (a.action.type === 'REROLL') break;
          view = S.applyAction(view, me, a.action);
        }
      }
      viewHash = room && room.state ? partsHash(room.state) : null;
      verifyCombat();
    }
    // Re-simula mi pelea de la última ronda y compara con el hash del host.
    function verifyCombat() {
      if (!server || !server.combats || !server.combats.length) return;
      const tag = server.roundsPlayed;
      if (tag === lastCombatCheck) return;
      lastCombatCheck = tag;
      for (const c of server.combats) {
        if (c.a !== me && !(c.b === me && !c.ghost)) continue;
        const res = S.simulateCombat(c.snapA, c.snapB, c.seed);
        if (res.hash !== c.hash) {
          desyncs.push({ round: c.round, host: c.hash, local: res.hash });
          log.error(`DESYNC ronda ${c.round}: host ${c.hash}, local ${res.hash}`);
        }
      }
    }
    const unsub = T.onValue(base, v => { room = v; rebuild(); if (onChange) onChange(api); });

    const api = {
      code, me,
      get room() { return room; },
      get meta() { return room && room.meta; },
      get state() { return view; },          // vista con predicción
      get serverState() { return server; },  // tal cual lo escribió el host
      get hash() { return viewHash; },
      get desyncs() { return desyncs; },
      get phase() { return room && room.meta && room.meta.phase; },
      // Devuelve un error (string) o null si la acción salió a la cola.
      send(action) {
        if (!view || !room || !room.meta) return 'Sin conexión con la sala';
        if (room.meta.phase.name !== 'planning') return 'Esperá a la fase de planificación';
        const err = S.validateAction(view, me, action);
        if (err) return err;
        if (action.type === 'REROLL' && room.actions && sortedKeys(room.actions).some(k => room.actions[k].uid === me && room.actions[k].action.type === 'REROLL'))
          return 'Esperando la tienda nueva…';
        T.push(base + '/actions', { uid: me, action });
        return null;
      },
      ready() { if (room && room.meta && room.meta.phase) T.set(`${base}/ready/${me}`, room.meta.phase.key); },
      isReady() { return !!(room && room.ready && room.meta && room.ready[me] === room.meta.phase.key); },
      // Migración: si el host está desconectado hace rato, el humano conectado con menor uid lo reemplaza.
      async checkHost() {
        const m = room && room.meta;
        if (!m || m.status !== 'playing' || m.hostId === me) return false;
        const pr = (room.presence || {})[m.hostId];
        if (pr && pr.online) return false;
        if (T.now() - ((pr && pr.lastSeen) || 0) < CFG.MIGRATE_AFTER_MS) return false;
        const candidates = sortedKeys(room.members).filter(u => room.presence && room.presence[u] && room.presence[u].online);
        if (candidates[0] !== me) return false;
        const old = m.hostId;
        const r = await T.transaction(base + '/meta/hostId', cur => (cur === old ? me : undefined));
        if (r.committed) log.log(`Soy el nuevo host de ${code} (antes: ${old})`);
        return r.committed;
      },
      destroy() { unsub(); },
    };
    return api;
  }

  // ---------- sesión: cliente + (si me toca) host + migración ----------
  function createSession({ transport: T, code, onChange, autoTickMs = 250, log = console }) {
    let host = null, timer = null;
    const client = createClient({ transport: T, code, onChange, log });
    T.presence(`rooms/${code}/presence/${T.uid}`);
    async function tick() {
      const m = client.meta;
      if (!m) return;
      if (m.hostId === T.uid && m.status === 'playing') {
        if (!host || !host.active) { host = createHost({ transport: T, code, getRoom: () => client.room }); await host.resume(); }
        await host.tick();
      } else {
        if (host) { host.stop(); host = null; }
        await client.checkHost();
      }
    }
    if (autoTickMs) timer = setInterval(tick, autoTickMs);
    return {
      client, tick,
      get host() { return host; },
      get isHost() { return !!(client.meta && client.meta.hostId === T.uid); },
      async startGame() {
        const meta = await T.get(`rooms/${code}/meta`); // no depender de que el cliente ya haya recibido la sala
        if (!meta || meta.hostId !== T.uid) return 'Solo el host puede empezar';
        if (meta.status !== 'lobby') return 'La partida ya empezó';
        host = createHost({ transport: T, code, getRoom: () => client.room });
        await host.startGame();
        return null;
      },
      destroy() { if (timer) clearInterval(timer); if (host) host.stop(); client.destroy(); },
    };
  }

  // ---------- lobby ----------
  function randomCode(rnd) {
    let c = '';
    for (let i = 0; i < CFG.CODE_LEN; i++) c += CFG.CODE_CHARS[Math.floor(rnd() * CFG.CODE_CHARS.length)];
    return c;
  }
  // Borra salas sin actividad hace más de 24 h (lo hace cualquiera al crear una sala).
  async function cleanupOldRooms(T) {
    const idx = (await T.get('roomIndex')) || {};
    const limit = T.now() - CFG.ROOM_TTL_MS;
    for (const code of Object.keys(idx)) {
      if ((idx[code].lastActivity || 0) < limit) {
        await T.set('rooms/' + code, null).catch(() => {});
        await T.set('roomIndex/' + code, null).catch(() => {});
      }
    }
  }
  // rnd: función aleatoria de la UI (Math.random) — esto no es SIM.
  async function createRoom(T, { name, settings, seed, rnd = Math.random, code: fixed }) {
    await cleanupOldRooms(T).catch(() => {});
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = fixed || randomCode(rnd);
      const now = T.now();
      const r = await T.transaction(`rooms/${code}/meta`, cur => (cur ? undefined : {
        hostId: T.uid, status: 'lobby', createdAt: now, lastActivity: now, seed: seed || code + '-' + now,
        settings: { bots: 7, difficulty: 0.3, botTakeover: true, planningSeconds: D.CONFIG.PLANNING_SECONDS, ...(settings || {}) },
        phase: { name: 'lobby', endsAt: 0, key: 'lobby' },
      }));
      if (!r.committed) { if (fixed) throw new Error('La sala ya existe'); continue; }
      await T.set(`rooms/${code}/members/${T.uid}`, { name, joinedAt: T.TIMESTAMP });
      await T.set(`roomIndex/${code}`, { lastActivity: T.TIMESTAMP });
      return code;
    }
    throw new Error('No se pudo generar un código libre');
  }
  // Entra a una sala. Si la partida ya empezó, solo pueden volver los que estaban.
  async function joinRoom(T, { code, name }) {
    code = String(code || '').toUpperCase().trim();
    const meta = await T.get(`rooms/${code}/meta`);
    if (!meta) return { error: 'No existe esa sala' };
    const member = await T.get(`rooms/${code}/members/${T.uid}`);
    if (meta.status !== 'lobby' && !member) return { error: 'La partida ya empezó' };
    if (!member) {
      const members = (await T.get(`rooms/${code}/members`)) || {};
      if (Object.keys(members).length >= 8) return { error: 'La sala está llena' };
      await T.set(`rooms/${code}/members/${T.uid}`, { name, joinedAt: T.TIMESTAMP });
    }
    return { code, rejoin: !!member && meta.status !== 'lobby' };
  }
  const leaveRoom = (T, code) => T.set(`rooms/${code}/members/${T.uid}`, null);
  const updateSettings = (T, code, settings) => T.update(`rooms/${code}/meta/settings`, settings);

  // ---------- LocalTransport (memoria) ----------
  // Un "servidor" en memoria con varias conexiones. Sirve para tests (reloj manual,
  // desconexiones simuladas) y para jugar offline (host y cliente en la misma pestaña).
  function createLocalServer({ tree = {}, time = null } = {}) {
    let manualTime = time;
    const srv = { tree: JSON.parse(JSON.stringify(tree)), listeners: [], keySeq: 0, pending: 0, conns: [] };
    srv.now = () => (manualTime == null ? Date.now() : manualTime);
    srv.advance = ms => { manualTime = (manualTime == null ? Date.now() : manualTime) + ms; };
    const split = p => String(p).split('/').filter(Boolean);
    const cl = v => (v == null ? null : JSON.parse(JSON.stringify(v)));
    function read(path) { let o = srv.tree; for (const k of split(path)) { if (o == null || typeof o !== 'object') return null; o = o[k]; } return o == null ? null : o; }
    function stamp(v) {
      if (v && typeof v === 'object') {
        if (v['.sv'] === 'timestamp') return srv.now();
        const out = {}; for (const k of Object.keys(v)) out[k] = stamp(v[k]); return out;
      }
      return v;
    }
    function prune(o) { // como Firebase: sin nulls ni objetos vacíos
      if (!o || typeof o !== 'object') return o;
      for (const k of Object.keys(o)) { o[k] = prune(o[k]); if (o[k] == null || (typeof o[k] === 'object' && !Object.keys(o[k]).length)) delete o[k]; }
      return o;
    }
    function write(path, val) {
      const ks = split(path);
      val = prune(cl(stamp(val)));
      if (!ks.length) { srv.tree = val || {}; return; }
      let o = srv.tree;
      for (let i = 0; i < ks.length - 1; i++) { if (!o[ks[i]] || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
      if (val == null || (typeof val === 'object' && !Object.keys(val).length)) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = val;
      prune(srv.tree);
    }
    function notify(paths) {
      srv.pending++;
      queueMicrotask(() => {
        srv.pending--;
        for (const l of srv.listeners.slice()) {
          if (!l.conn.connected) continue;
          if (paths.some(p => p === l.path || p.startsWith(l.path + '/') || l.path.startsWith(p + '/') || p === '')) l.cb(cl(read(l.path)));
        }
        if (srv.onChange) srv.onChange();
      });
    }
    const norm = p => split(p).join('/');
    srv.connect = uid => {
      const conn = { connected: true, uid, presencePaths: [] };
      const ok = v => Promise.resolve(v);
      const T = {
        uid, kind: 'local', TIMESTAMP: { '.sv': 'timestamp' },
        now: srv.now,
        async init() { return uid; },
        get: p => ok(cl(read(p))),
        set(p, v) { if (!conn.connected) return ok(); write(p, v); notify([norm(p)]); return ok(); },
        update(p, patch) {
          if (!conn.connected) return ok();
          const paths = [];
          for (const rel of Object.keys(patch)) { const full = norm(p + '/' + rel); write(full, patch[rel]); paths.push(full); }
          notify(paths); return ok();
        },
        push(p, v) {
          const key = 'k' + String(++srv.keySeq).padStart(9, '0');
          if (conn.connected) { write(p + '/' + key, v); notify([norm(p + '/' + key)]); }
          return ok(key);
        },
        onValue(p, cb) {
          const l = { path: norm(p), cb, conn };
          srv.listeners.push(l);
          queueMicrotask(() => { if (conn.connected) cb(cl(read(l.path))); });
          return () => { srv.listeners = srv.listeners.filter(x => x !== l); };
        },
        transaction(p, fn) {
          if (!conn.connected) return ok({ committed: false, value: cl(read(p)) });
          const cur = cl(read(p)), next = fn(cur);
          if (next === undefined) return ok({ committed: false, value: cur });
          write(p, next); notify([norm(p)]);
          return ok({ committed: true, value: cl(read(p)) });
        },
        presence(p) {
          conn.presencePaths.push(p);
          if (conn.connected) { write(p, { online: true, lastSeen: srv.now() }); notify([norm(p)]); }
        },
        // simulación de red (solo LocalTransport)
        disconnect() {
          conn.connected = false;
          for (const p of conn.presencePaths) { write(p, { online: false, lastSeen: srv.now() }); notify([norm(p)]); }
        },
        reconnect() {
          conn.connected = true;
          for (const p of conn.presencePaths) { write(p, { online: true, lastSeen: srv.now() }); notify([norm(p)]); }
          for (const l of srv.listeners) if (l.conn === conn) queueMicrotask(() => l.cb(cl(read(l.path))));
        },
        get connected() { return conn.connected; },
      };
      srv.conns.push(T);
      return T;
    };
    // Espera a que se entreguen todas las notificaciones (para tests).
    srv.settle = async () => {
      for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 0));
        if (!srv.pending) { await new Promise(r => setTimeout(r, 0)); if (!srv.pending) return; }
      }
    };
    return srv;
  }

  return {
    CFG, splitState, joinState, partsHash, stateHashCanon,
    createHost, createClient, createSession,
    createRoom, joinRoom, leaveRoom, updateSettings, cleanupOldRooms,
    createLocalServer,
  };
})();

if (typeof module !== 'undefined') module.exports = { NET };
