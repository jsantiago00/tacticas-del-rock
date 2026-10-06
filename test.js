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

console.log(failed ? `\n${failed} test(s) fallaron` : '\nTodo OK');
process.exit(failed ? 1 : 0);
