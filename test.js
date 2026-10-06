// Tests de la simulación. Correr con: node test.js
'use strict';
const { SIM, DATA } = require('./sim.js');

let failed = 0;
const check = (ok, msg) => { console.log((ok ? '✔ ' : '✘ ') + msg); if (!ok) failed++; };
const copies = star => (star === 1 ? 1 : star === 2 ? 3 : 9);

// El pool + todas las copias en juego (tableros, bancos, tiendas) tiene que dar siempre el total.
function poolOk(s) {
  const tot = { ...s.pool };
  for (const id of s.order) {
    const p = s.players[id];
    for (const u of [...p.board, ...p.bench]) if (u) tot[u.unitId] += copies(u.star);
    for (const x of p.shop) if (x) tot[x]++;
  }
  return Object.keys(tot).every(id => tot[id] === Math.max(1, Math.round(DATA.POOL_SIZE_8P[DATA.UNITS[id].cost] * s.poolPlayers / 8)));
}

// 1. Determinismo de combate: lote de peleas entre tableros generados, cada una corrida 2 veces.
const det = SIM.selfTest(40);
check(det.ok, `Combates: ${det.combats} corridos 2 veces, ${det.fails} distintos`);

// 2. Determinismo de partida completa de 8 bots (hash del estado después de cada ronda).
for (const seed of ['det-1', 'det-2', 'det-3']) {
  const g = SIM.checkGameDeterminism(seed);
  check(g.ok, `Partida de 8 bots "${seed}": ${g.rounds} rondas, idéntica 2 veces${g.ok ? '' : ` (difiere desde la ronda ${g.firstDiffAfterRound})`}`);
}

// 3. Invariantes en partidas de 8 bots: pool, re-simulación de cada pelea, emparejamientos, puestos.
for (const seed of ['inv-1', 'inv-2']) {
  let s = SIM.runAllBots(SIM.createGame({ seed, slots: SIM.makeSlots({ bots: 8 }) }));
  let pool = poolOk(s), replay = true, pairs = true, repeats = 0, pvpRounds = 0;
  while (s.phase !== 'ended') {
    if (s.pairings) {
      const alive = s.order.filter(id => s.players[id].alive);
      const real = s.pairings.filter(p => !p.ghost).flatMap(p => [p.a, p.b]);
      const ghosts = s.pairings.filter(p => p.ghost).map(p => p.a);
      // cada vivo pelea exactamente una vez como protagonista; fantasma solo si son impares
      if (new Set([...real, ...ghosts]).size !== alive.length || real.length + ghosts.length !== alive.length) pairs = false;
      if (ghosts.length !== alive.length % 2) pairs = false;
      if (alive.length > 2) { pvpRounds++; for (const p of s.pairings) if (s.players[p.a].lastOpp === p.b) repeats++; }
    }
    s = SIM.resolveRound(s);
    for (const c of s.combats) if (SIM.simulateCombat(c.snapA, c.snapB, c.seed).hash !== c.hash) replay = false;
    if (s.phase !== 'ended') s = SIM.runAllBots(s);
    pool = pool && poolOk(s);
  }
  const places = s.order.map(id => s.players[id].place).sort((a, b) => a - b);
  check(pool, `"${seed}": el pool siempre cuadra`);
  check(replay, `"${seed}": re-simular cada pelea guardada da el mismo hash`);
  check(pairs, `"${seed}": emparejamientos válidos (fantasma solo con impares)`);
  check(repeats <= 2, `"${seed}": casi sin rivales repetidos seguidos (${repeats} en ${pvpRounds} rondas)`);
  check(places.join() === '1,2,3,4,5,6,7,8', `"${seed}": puestos 1..8 (${s.roundsPlayed} rondas)`);
}

// 4. runBotTurn: la lista de acciones, aplicada con applyAction, reproduce el turno exacto.
{
  let s = SIM.createGame({ seed: 'bt', slots: SIM.makeSlots({ bots: 8 }) });
  for (let r = 0; r < 12; r++) { s = SIM.runAllBots(s); s = SIM.resolveRound(s); }
  const before = JSON.stringify(s);
  const actions = SIM.runBotTurn(s, 'b3');
  check(JSON.stringify(s) === before, 'runBotTurn no muta el estado');
  let t = s, allValid = true;
  for (const a of actions) { const n = SIM.applyAction(t, 'b3', a); if (n === t) allValid = false; t = n; }
  check(actions.length > 0 && allValid, `runBotTurn: ${actions.length} acciones, todas válidas`);
  const again = SIM.runBotTurn(s, 'b3');
  check(JSON.stringify(again) === JSON.stringify(actions), 'runBotTurn es determinista');
}

// 5. Fantasma y desempate de eliminación.
{
  let s = SIM.createGame({ seed: 'gh', slots: SIM.makeSlots({ bots: 4 }) });
  while (SIM.roundLabel(s.round) !== '2-1') s = SIM.resolveRound(SIM.runAllBots(s));
  // matar a uno a mano -> quedan 3 vivos -> tiene que haber un fantasma
  s = SIM.clone(s); s.players.b1.hp = 1; s.players.b1.board.fill(null); s.players.b1.bench.fill(null);
  s = SIM.resolveRound(s);
  const alive = s.order.filter(id => s.players[id].alive).length;
  check(alive !== 3 || s.pairings.filter(p => p.ghost).length === 1, `Con ${alive} vivos hay ${s.pairings ? s.pairings.filter(p => p.ghost).length : 0} fantasma(s)`);
  if (alive === 3) {
    const g = s.pairings.find(p => p.ghost);
    const hpGhostOwner = s.players[g.b].hp;
    const after = SIM.resolveRound(s);
    check(after.players[g.b].hp === hpGhostOwner || !after.players[g.b].alive || after.combats.some(c => !c.ghost && (c.a === g.b || c.b === g.b)),
      'Pelear contra un fantasma no le hace daño al dueño del tablero');
  }
}
{
  let s = SIM.createGame({ seed: 'tie', slots: SIM.makeSlots({ bots: 4 }) });
  while (SIM.roundLabel(s.round) !== '2-1') s = SIM.resolveRound(SIM.runAllBots(s));
  s = SIM.clone(s);
  // b1 y b2 mueren en la misma ronda: b2 tenía más vida antes -> queda mejor ubicado
  s.players.b1.hp = 1; s.players.b2.hp = 2;
  for (const id of ['b1', 'b2']) { s.players[id].board.fill(null); s.players[id].bench.fill(null); }
  for (const id of ['b3', 'b4']) s.players[id].hp = 100;
  s.pairings = [{ a: 'b1', b: 'b3', ghost: false }, { a: 'b2', b: 'b4', ghost: false }];
  s = SIM.resolveRound(s);
  const p1 = s.players.b1, p2 = s.players.b2;
  check(!p1.alive && !p2.alive && p2.place < p1.place, `Desempate por vida previa: b2 #${p2.place}, b1 #${p1.place}`);
}

// 6. Modo práctica (1 jugador) y acciones inválidas.
{
  const s0 = SIM.createGame({ seed: 'inv', players: [{ id: 'p0', name: 'T' }] });
  check(s0.poolPlayers === 8 && poolOk(s0), 'Partida de 1 jugador usa el pool de 8');
  check(SIM.applyAction(s0, 'p0', { type: 'BUY', slot: 99 }) === s0, 'Comprar en un slot inexistente no cambia el estado');
  let poor = s0;
  while (SIM.validateAction(poor, 'p0', { type: 'REROLL' }) === null) poor = SIM.applyAction(poor, 'p0', { type: 'REROLL' });
  check(SIM.applyAction(poor, 'p0', { type: 'BUY_XP' }) === poor, 'Comprar XP sin oro no cambia el estado');
  check(SIM.applyAction(s0, 'p0', { type: 'MOVE', from: { zone: 'bench', idx: 0 }, to: { zone: 'board', idx: 0 } }) === s0, 'Mover desde un lugar vacío no cambia el estado');
  const s4 = SIM.createGame({ seed: 'p4', slots: SIM.makeSlots({ humans: [{ id: 'p0', name: 'T' }], bots: 3 }) });
  check(s4.poolPlayers === 4 && poolOk(s4), 'Partida de 4 jugadores escala el pool (coste 1: 15 copias por campeón)');
}

// 6b. Mecánicas del plantel (únicas, dúos, orígenes con efectos). Combates armados a mano.
{
  const E = (unitId, r, c, star = 1, extra = {}) => ({ unitId, star, r, c, ...extra });
  const run = (cs, until, max = 900) => { for (let i = 0; i < max && !cs.done; i++) { SIM.stepCombat(cs); const r = until(cs); if (r) return r; } return null; };
  const unit = (cs, id, team = 0) => cs.units.find(u => u.unitId === id && u.team === team);
  const castBy = (cs, u) => cs.events.some(e => e.t === 'cast' && e.s === u.cid);

  // Silencio (Say No More): los silenciados no lanzan aunque tengan el maná lleno
  {
    const cs = SIM.createCombat([E('charly', 0, 3)], [E('dargelos', 0, 3), E('plant', 0, 4)], 1);
    const ch = unit(cs, 'charly'); ch.mana = ch.maxMana;
    run(cs, c => castBy(c, ch));
    const vic = cs.units.filter(u => u.team === 1 && u.silencedUntil > cs.tick);
    vic.forEach(v => (v.mana = v.maxMana));
    let castWhileSilenced = false;
    run(cs, c => { if (c.events.some(e => e.t === 'cast' && vic.some(v => v.cid === e.s && v.silencedUntil > c.tick))) castWhileSilenced = true; return vic.every(v => v.silencedUntil <= c.tick); }, 200);
    check(vic.length > 0 && !castWhileSilenced, `Silencio: Charly silencia a ${vic.length} y no lanzan mientras dura`);
  }
  // Revivir una vez (The Show Must Go On)
  {
    const cs = SIM.createCombat([E('freddie', 3, 3)], [E('slash', 3, 2, 3), E('mollo', 3, 3, 3), E('pappo', 3, 4, 3)], 2);
    const fr = unit(cs, 'freddie'); let revives = 0;
    run(cs, c => { revives += c.events.filter(e => e.t === 'revive' && e.d === fr.cid).length; return false; });
    check(revives === 1 && !fr.alive, `Revivir: Freddie vuelve exactamente 1 vez (${revives}) y después muere`);
  }
  // Efecto al morir (Gracias Totales): escudo y daño para los aliados
  {
    const cs = SIM.createCombat([E('cerati', 0, 3), E('fito', 3, 3)], [E('slash', 0, 3, 3), E('mollo', 0, 2, 3), E('pappo', 0, 4, 3)], 3);
    const ce = unit(cs, 'cerati'), fi = unit(cs, 'fito'), ad0 = fi.ad;
    const ev = run(cs, c => c.events.find(e => e.t === 'legacy' && e.s === ce.cid));
    check(!!ev && fi.ad > ad0 && fi.shieldUntil > cs.maxTicks, `Gracias Totales: al morir Cerati, Fito gana daño (${Math.round(ad0)} -> ${Math.round(fi.ad)}) y escudo`);
  }
  // Pogo con empuje y aura (Misa Ricotera)
  {
    const cs = SIM.createCombat([E('indio', 0, 3), E('slash', 3, 3)], [E('catriel', 0, 3), E('grohl', 0, 2), E('marciano', 0, 4)], 4);
    const ind = unit(cs, 'indio'), sl = unit(cs, 'slash'); ind.mana = ind.maxMana;
    run(cs, c => castBy(c, ind));
    const pushes = cs.events.filter(e => e.t === 'push').length;
    check(pushes > 0 && sl.asBuffs.some(b => b.pct === 40), `Misa Ricotera: empuja ${pushes} enemigos y acelera a los aliados (+40%)`);
  }
  // Doble clase (Hombre Orquesta)
  {
    const tr = SIM.computeTraits([E('aznar', 0, 3), E('fito', 3, 3)]);
    check(tr.base.count === 1 && tr.teclados.count === 2 && tr.teclados.level === 0, 'Hombre Orquesta: Aznar cuenta como Base Rítmica y Teclados (activa Teclados con Fito)');
  }
  // Control mental (OK Computer): el enemigo más fuerte pelea para nosotros y después vuelve
  {
    const cs = SIM.createCombat([E('thom', 3, 3), E('aznar', 0, 3)], [E('freddie', 0, 3), E('catriel', 0, 2), E('grohl', 0, 4)], 5);
    const th = unit(cs, 'thom'); th.mana = th.maxMana;
    const fr = unit(cs, 'freddie', 1);
    run(cs, c => castBy(c, th));
    const switched = fr.side === 0 && fr.team === 1;
    const back = run(cs, c => c.events.some(e => e.t === 'free' && e.d === fr.cid) || !fr.alive, 400);
    check(switched && !!back && (fr.side === 1 || !fr.alive), 'OK Computer: controla a Freddie (el más fuerte) y después lo suelta');
  }
  // Carga y estallido (Drop)
  {
    const cs = SIM.createCombat([E('skrillex', 3, 3), E('aznar', 0, 3)], [E('catriel', 0, 3), E('grohl', 0, 2)], 6);
    const sk = unit(cs, 'skrillex');
    let chargeBefore = 0;
    run(cs, c => { if (sk.mana >= sk.maxMana - 1) chargeBefore = sk.charge; return castBy(c, sk); });
    check(chargeBefore > 0 && sk.charge === 0, `Drop: acumula carga (${Math.round(chargeBefore)}) y la suelta al lanzar`);
  }
  // Confusión (Vértigo): los mareados atacan a cualquiera, incluso a sus aliados
  {
    const cs = SIM.createCombat([E('ng', 3, 3), E('aznar', 0, 3)], [E('catriel', 0, 3), E('grohl', 0, 2), E('marciano', 0, 4), E('mccartney', 1, 3)], 7);
    const ng = unit(cs, 'ng'); ng.mana = ng.maxMana;
    let confused = 0, friendly = 0;
    run(cs, c => {
      confused += c.events.filter(e => e.t === 'confuse').length;
      for (const e of c.events) if (e.t === 'atk' && cs.units[e.s].team === cs.units[e.d].team) friendly++;
      return false;
    }, 400);
    check(confused > 0 && friendly > 0, `Vértigo: ${confused} confundidos, ${friendly} ataques a su propio equipo`);
  }
  // Empuje en fila (Viento Patagónico)
  {
    const cs = SIM.createCombat([E('lisandro', 1, 3)], [E('catriel', 0, 2), E('grohl', 0, 3), E('marciano', 0, 4), E('fito', 3, 3)], 8);
    const li = unit(cs, 'lisandro'); li.mana = li.maxMana;
    run(cs, c => castBy(c, li));
    const hitIds = new Set(cs.events.filter(e => e.t === 'dmg' && e.s === li.cid).map(e => e.d));
    const pushes = cs.events.filter(e => e.t === 'push').length;
    check(hitIds.size === 3 && pushes >= 1, `Viento Patagónico: pega a toda la fila de adelante (${hitIds.size}) y la empuja (${pushes})`);
  }
  // Compartir maná (BFF) y contagio (Transmisión)
  {
    const cs = SIM.createCombat([E('thom', 3, 3), E('greenwood', 3, 2), E('aznar', 0, 3)], [E('catriel', 0, 3)], 9);
    const th = unit(cs, 'thom'), gw = unit(cs, 'greenwood'); th.mana = th.maxMana; gw.mana = 0;
    run(cs, c => castBy(c, th));
    check(gw.mana >= 35, `BFF + Transmisión: cuando Thom lanza, Greenwood gana maná (${Math.round(gw.mana)})`);
  }
  // Ralentizar (Frío)
  {
    const cs = SIM.createCombat([E('turner', 2, 3), E('chrismartin', 3, 3)], [E('catriel', 0, 3)], 10);
    const tu = unit(cs, 'turner'), ca = unit(cs, 'catriel', 1);
    run(cs, c => c.events.some(e => e.t === 'atk' && e.s === tu.cid));
    check(ca.asBuffs.some(b => b.slow && b.pct < 0), 'Frío: el golpe de Turner baja la velocidad de ataque del enemigo');
  }
  // Orígenes con efecto: esquive (Chiquitos), regeneración (Almacén), arranque (Motor), Familia al morir
  {
    const cs = SIM.createCombat([E('slash', 3, 3, 3)], [E('marciano', 0, 3), E('lennon', 2, 3), E('mccartney', 0, 2), E('ciromartinez', 0, 4)], 11);
    let miss = 0; run(cs, c => { miss += c.events.filter(e => e.t === 'miss').length; return false; }, 600);
    check(miss > 0, `Chiquitos (4): esquivan ataques (${miss} esquives)`);
    const cs2 = SIM.createCombat([E('vicentico', 0, 3), E('plant', 3, 3)], [E('catriel', 0, 3)], 12);
    check(unit(cs2, 'vicentico').asBuffs.some(b => b.pct === 40), 'Motor (2): arrancan con +40% de velocidad de ataque');
    const cs3 = SIM.createCombat([E('corgan', 0, 3), E('zeta', 0, 2), E('lebon', 3, 3)], [E('catriel', 0, 3)], 13);
    check(unit(cs3, 'zeta').regen === 1.5, 'Almacén (3): regeneran vida');
    const cs4 = SIM.createCombat([E('pityfernandez', 0, 3), E('calamaro', 3, 3)], [E('slash', 0, 3, 3), E('mollo', 0, 2, 3)], 14);
    const ca = unit(cs4, 'calamaro'); ca.hp = ca.maxHp / 2; let healed = false;
    run(cs4, c => { if (c.events.some(e => e.t === 'die' && e.d === unit(cs4, 'pityfernandez').cid) && c.events.some(e => e.t === 'heal' && e.d === ca.cid)) healed = true; return healed || !ca.alive; });
    check(healed, 'Familia (2): cuando muere uno, el otro se cura');
  }
  // Solistas: rinden más cuantos menos haya
  {
    const solo1 = SIM.createCombat([E('fito', 3, 3)], [E('catriel', 0, 3)], 1);
    const solo3 = SIM.createCombat([E('fito', 3, 3), E('gieco', 3, 2), E('drexler', 3, 4)], [E('catriel', 0, 3)], 1);
    const h1 = unit(solo1, 'fito').maxHp, h3 = unit(solo3, 'fito').maxHp, base = SIM.def('fito').hp;
    check(Math.round(h1) === Math.round(base * 1.5) && Math.round(h3) === Math.round(base * 1.15), `Solistas: Fito solo +50% vida (${Math.round(h1)}), con 3 Solistas +15% (${Math.round(h3)})`);
  }
  // El Flaco: elegir origen, se suma otro cada 3 peleas, y elección automática
  {
    let s = SIM.createGame({ seed: 'flaco', players: [{ id: 'p0', name: 'T' }] });
    s = SIM.clone(s); const p = s.players.p0;
    p.gold = 50; p.shop[0] = 'spinetta'; s.pool.spinetta--;
    s = SIM.applyAction(s, 'p0', { type: 'BUY', slot: 0 });
    const loc = { zone: 'bench', idx: s.players.p0.bench.findIndex(u => u && u.unitId === 'spinetta') };
    const u0 = s.players.p0.bench[loc.idx];
    check(!!u0.flaco && SIM.flacoPending(u0), 'El Flaco: al comprarlo queda pendiente elegir un origen');
    s = SIM.applyAction(s, 'p0', { type: 'FLACO', loc, origin: 'fauna' });
    const second = SIM.validateAction(s, 'p0', { type: 'FLACO', loc, origin: 'almacen' });
    s = SIM.applyAction(s, 'p0', { type: 'MOVE', from: loc, to: { zone: 'board', idx: 24 } });
    const tr = SIM.computeTraits(SIM.boardSnapshot(s.players.p0));
    check(!!second && tr.fauna && !tr.almacen && !tr.averiados, 'El Flaco: cuenta solo para el origen elegido y no puede sumar otro todavía');
    for (let i = 0; i < 3; i++) s = SIM.resolveRound(s);
    const u3 = s.players.p0.board[24];
    check(u3 && u3.flaco.fights === 3 && SIM.flacoSlots(u3) === 2 && SIM.flacoPending(u3), 'El Flaco: después de 3 peleas habilita un segundo origen');
    s = SIM.resolveRound(s); // no eligió: el host elige por él
    check(s.players.p0.board[24].flaco.chosen.length === 2, `El Flaco: si no elige a tiempo, se elige solo (${s.players.p0.board[24].flaco.chosen.join(', ')})`);
  }
  // Completar el escenario solo: los del backstage suben adelante, desde el centro
  {
    let s = SIM.clone(SIM.createGame({ seed: 'fill', players: [{ id: 'p0', name: 'T' }] }));
    const p = s.players.p0; p.level = 4;
    p.bench[0] = { uid: 91, unitId: 'luca', star: 1 }; p.bench[2] = { uid: 92, unitId: 'fito', star: 1 }; p.bench[5] = { uid: 93, unitId: 'zeta', star: 1 };
    p.board[3] = { uid: 94, unitId: 'slash', star: 1 };
    const n = SIM.resolveRound(s), q = n.players.p0;
    const where = id => q.board.findIndex(u => u && u.unitId === id);
    check(where('luca') === 2 && where('fito') === 4 && where('zeta') === 1 && q.bench.every(u => !u) && n.autoFilled.p0.join() === 'luca,fito,zeta',
      'Completar el escenario: suben solos a la fila de adelante desde el centro, y se avisa quiénes');
    let s2 = SIM.clone(SIM.createGame({ seed: 'fill2', players: [{ id: 'p0', name: 'T' }] }));
    s2.players.p0.level = 1; s2.players.p0.board[3] = { uid: 95, unitId: 'slash', star: 1 }; s2.players.p0.bench[0] = { uid: 96, unitId: 'luca', star: 1 };
    const n2 = SIM.resolveRound(s2);
    check(n2.players.p0.bench[0] && !n2.autoFilled.p0, 'Completar el escenario: no pasa del máximo de la convocatoria');
  }
  // Online: la versión de datos queda guardada en el estado
  check(SIM.createGame({ seed: 'v', players: [{ id: 'p0', name: 'T' }] }).v === DATA.VERSION, `Versión de datos en el estado: ${DATA.VERSION}`);
}

// 7. Multijugador con LocalTransport (host autoritativo + clientes, sin Firebase).
const { NET } = require('./net.js');
const quiet = { log() {}, error(...a) { console.error(...a); } };

// "Humano" scripteado: decide con la IA de bot sobre el estado que ve y manda las acciones a la cola.
function humanActions(state, uid) {
  const s = SIM.clone(state);
  s.players[uid].isBot = true; s.players[uid].bot = { personality: 'equilibrado', difficulty: 0 };
  return SIM.runBotTurn(s, uid);
}

// Juega una partida online: 3 humanos (u1 es host) + 5 bots.
//  crashAt: en esa ronda el host (u1) se desconecta para siempre y otro toma el control.
//  idleFrom: desde esa ronda u1 sigue conectado pero no hace nada (partida de comparación).
//  (La caída es DESPUÉS de que los humanos mandaron sus acciones de esa ronda: el host nuevo las procesa.)
//  dropU3: [desde, hasta) rondas en las que u3 está desconectado.
async function playOnline({ seed, crashAt = null, idleFrom = null, dropU3 = null, botTakeover = false }) {
  const srv = NET.createLocalServer({ time: 1e9 });
  const T = ['u1', 'u2', 'u3'].map(u => srv.connect(u));
  const code = await NET.createRoom(T[0], { name: 'Ana', code: 'TEST', seed, settings: { bots: 5, difficulty: 0.3, botTakeover, planningSeconds: 30 } });
  await NET.joinRoom(T[1], { code, name: 'Beto' });
  await NET.joinRoom(T[2], { code, name: 'Caro' });
  const ses = T.map(t => NET.createSession({ transport: t, code, autoTickMs: 0, log: quiet }));
  await srv.settle();
  await ses[0].startGame();
  await srv.settle();

  const log = { hashes: [], mismatches: 0, hosts: new Set(), takenOver: false, restored: false };
  const anyClient = () => ses.find((s, i) => T[i].connected).client;
  const tickAll = async () => { for (let i = 0; i < 3; i++) if (T[i].connected) { await ses[i].tick(); await srv.settle(); } };
  let lastKey = null;
  for (let guard = 0; guard < 600 && anyClient().meta.status !== 'ended'; guard++) {
    const meta = anyClient().meta, st = anyClient().serverState, round = st.roundsPlayed;
    if (meta.phase.key !== lastKey) { // nueva fase: todos los conectados tienen que ver lo mismo que el host
      lastKey = meta.phase.key;
      const hs = ses.filter((s, i) => T[i].connected).map(s => s.client.hash);
      if (new Set(hs).size !== 1) log.mismatches++;
      if (meta.phase.name === 'planning') log.hashes.push(hs[0]);
      log.hosts.add(meta.hostId);
      if (st.players.u3 && st.players.u3.takenOver) log.takenOver = true;
      if (log.takenOver && st.players.u3 && !st.players.u3.takenOver) log.restored = true;
      // eventos de red
      if (dropU3 && round === dropU3[0] && T[2].connected) { T[2].disconnect(); await srv.settle(); }
      if (dropU3 && round === dropU3[1] && !T[2].connected) { T[2].reconnect(); await srv.settle(); }
      if (meta.phase.name === 'planning') {
        for (let i = 0; i < 3; i++) {
          const uid = T[i].uid, p = st.players[uid];
          if (!T[i].connected || !p.alive || p.isBot) continue;
          if (i === 0 && idleFrom != null && round >= idleFrom) continue;
          for (const a of humanActions(st, uid)) await T[i].push(`rooms/${code}/actions`, { uid, action: a });
          await srv.settle();
        }
      }
      // el host se cae con acciones de los demás todavía en la cola (sin procesar)
      if (crashAt != null && round === crashAt && T[0].connected && meta.phase.name === 'planning') {
        const queued = Object.keys((await T[1].get(`rooms/${code}/actions`)) || {}).length;
        if (queued > 0) log.queuedAtCrash = queued;
        T[0].disconnect(); await srv.settle();
        srv.advance(NET.CFG.MIGRATE_AFTER_MS + 1000);
        await tickAll(); await tickAll();
      }
      for (let i = 0; i < 3; i++) {
        if (!T[i].connected) continue;
        if (i === 0 && idleFrom != null && round >= idleFrom) continue; // u1 "colgado": no toca Listo
        ses[i].client.ready();
      }
      await srv.settle();
    }
    const before = anyClient().meta.phase.key;
    await tickAll();
    if (anyClient().meta.phase.key === before) { srv.advance(31000); await tickAll(); } // vence el tiempo de la fase
  }
  const c = anyClient();
  return {
    log, final: c.hash, ended: c.meta.status === 'ended', rounds: c.serverState.roundsPlayed,
    desyncs: ses.reduce((n, s) => n + s.client.desyncs.length, 0),
    places: c.serverState.order.map(id => c.serverState.players[id].place),
  };
}

(async () => {
  const a = await playOnline({ seed: 'net-1' });
  check(a.ended && a.places.slice().sort((x, y) => x - y).join() === '1,2,3,4,5,6,7,8', `Online: 3 humanos + 5 bots terminan la partida (${a.rounds} rondas)`);
  check(a.log.mismatches === 0, `Online: host y 3 clientes ven el mismo hash en cada fase (${a.log.hashes.length} planificaciones)`);
  check(a.desyncs === 0, 'Online: ningún cliente detectó DESYNC al re-simular su pelea');

  // referencia: u1 juega la ronda 8 y desde la 9 queda colgado (en la caída, sus acciones de la 8 quedan en cola)
  const ref = await playOnline({ seed: 'net-2', idleFrom: 9 });
  const crash = await playOnline({ seed: 'net-2', crashAt: 8 });
  check(crash.log.hosts.size === 2 && crash.ended && crash.log.queuedAtCrash > 0, `Migración: el host se cae en la ronda 8 con ${crash.log.queuedAtCrash} acciones en cola y lo reemplaza otro (${[...crash.log.hosts].join(' -> ')})`);
  check(crash.final === ref.final && JSON.stringify(crash.log.hashes) === JSON.stringify(ref.log.hashes),
    `Migración: resultado idéntico al de la misma partida sin caída (${ref.log.hashes.length} rondas comparadas)`);
  check(crash.log.mismatches === 0 && crash.desyncs === 0, 'Migración: todos siguen sincronizados después');

  const drop = await playOnline({ seed: 'net-3', dropU3: [5, 7] });
  check(drop.ended && drop.log.mismatches === 0 && drop.desyncs === 0, 'Reconexión: u3 se va 2 rondas, vuelve y queda sincronizado');

  const tk = await playOnline({ seed: 'net-4', dropU3: [5, 9], botTakeover: true });
  // Versión de datos: no se puede entrar a una sala de otra versión
  {
    const srv = NET.createLocalServer({ time: 1e9 });
    const t1 = srv.connect('u1'), t2 = srv.connect('u2'), t3 = srv.connect('u3');
    const code = await NET.createRoom(t1, { name: 'Ana', code: 'VERS' });
    const ok = await NET.joinRoom(t2, { code, name: 'Beto' });
    await t1.set('rooms/VERS/meta/dataVersion', DATA.VERSION - 1);
    const old = await NET.joinRoom(t3, { code, name: 'Caro' });
    check(!ok.error && old.error && old.version, `Versión: se entra a una sala de la misma versión; a una vieja no ("${old.error}")`);
  }
  check(tk.log.takenOver && tk.log.restored, 'Toma por bot: u3 desconectado 2 rondas lo maneja un bot y al volver recupera su lugar');

  console.log(failed ? `\n${failed} test(s) fallaron` : '\nTodo OK');
  process.exit(failed ? 1 : 0);
})();
