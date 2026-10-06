// Tests de la simulación. Correr con: node test.js
'use strict';
const { SIM, DATA } = require('./sim.js');

let failed = 0;
const check = (ok, msg) => { console.log((ok ? '✔ ' : '✘ ') + msg); if (!ok) failed++; };

// 1. Determinismo de combate: lote de peleas entre tableros generados, cada una corrida 2 veces.
const det = SIM.selfTest(40);
check(det.ok, `Determinismo: ${det.combats} combates, ${det.fails} distintos`);

// 2. Partidas completas con un jugador scripteado que solo usa applyAction.
function play(s) {
  const A = a => { const n = SIM.applyAction(s, 'p0', a); const ok = n !== s; s = n; return ok; };
  const P = () => s.players.p0;
  const stage = s.round.stage, reserve = stage > 2 ? 20 : 0;
  const target = [0, 2, 4, 5, 7, 8, 9, 10][Math.min(7, stage)];
  for (let g = 0; g < 20 && P().level < target && P().gold >= 4 + reserve; g++) if (!A({ type: 'BUY_XP' })) break;
  const buy = () => {
    for (let i = 0; i < 5; i++) {
      const p = P(), id = p.shop[i];
      if (!id) continue;
      const total = p.board.filter(Boolean).length + p.bench.filter(Boolean).length;
      if (SIM.countCopies(p, id) > 0 || (total < p.level + 3 && p.gold - DATA.UNITS[id].cost >= reserve)) A({ type: 'BUY', slot: i });
    }
  };
  buy();
  for (let g = 0; g < 6 && P().gold >= 30; g++) { A({ type: 'REROLL' }); buy(); }
  const power = u => SIM.def(u.unitId).cost * (u.star === 1 ? 1 : u.star === 2 ? 3 : 9);
  for (let g = 0; g < 20; g++) {
    const p = P(), all = [];
    p.board.forEach((u, i) => u && all.push({ u, loc: { zone: 'board', idx: i } }));
    p.bench.forEach((u, i) => u && all.push({ u, loc: { zone: 'bench', idx: i } }));
    all.sort((a, b) => power(b.u) - power(a.u) || a.u.uid - b.u.uid);
    const chosen = new Set(all.slice(0, p.level).map(x => x.u.uid));
    const promote = all.find(x => x.loc.zone === 'bench' && chosen.has(x.u.uid));
    if (!promote) break;
    let to = null;
    if (SIM.boardCount(p) < p.level) {
      const order = SIM.def(promote.u.unitId).range <= 1 ? [3, 2, 4, 1, 5, 0, 6, 10, 9, 11, 8, 12, 7, 13] : [24, 23, 25, 22, 26, 21, 27, 17, 16, 18, 15, 19, 14, 20];
      const i = order.find(i => !p.board[i]);
      if (i != null) to = { zone: 'board', idx: i };
    } else {
      const loser = all.filter(x => x.loc.zone === 'board' && !chosen.has(x.u.uid)).pop();
      if (loser) to = loser.loc;
    }
    if (!to || !A({ type: 'MOVE', from: promote.loc, to })) break;
  }
  if (SIM.benchFree(P()) === 0) {
    const i = P().bench.findIndex(u => u && u.star === 1);
    if (i >= 0) A({ type: 'SELL', loc: { zone: 'bench', idx: i } });
  }
  return s;
}

function runGame(seed) {
  let s = SIM.createGame({ seed, players: [{ id: 'p0', name: 'Test' }] });
  let rounds = 0, poolOk = true, replayOk = true;
  while (s.phase !== 'ended' && rounds < 200) {
    s = SIM.resolveRound(play(s));
    rounds++;
    // el pool + todas las copias en juego tiene que dar siempre el total
    const p = s.players.p0;
    if (p.alive) {
      const tot = { ...s.pool };
      for (const u of [...p.board, ...p.bench]) if (u) tot[u.unitId] += u.star === 1 ? 1 : u.star === 2 ? 3 : 9;
      for (const id of p.shop) if (id) tot[id]++;
      for (const id in tot) if (tot[id] !== DATA.POOL_SIZE_8P[DATA.UNITS[id].cost]) poolOk = false;
    }
    // re-simular la pelea guardada (lo que hace un cliente) da el mismo hash
    for (const c of s.combats) if (SIM.simulateCombat(c.snapA, c.snapB, c.seed).hash !== c.hash) replayOk = false;
  }
  return { s, rounds, poolOk, replayOk };
}

for (const seed of ['abc', 'xyz', 'rock']) {
  const a = runGame(seed), b = runGame(seed);
  const last = a.s.players.p0.history[0];
  check(a.s.phase === 'ended', `Partida "${seed}" termina (${a.rounds} rondas, última ${last && last.round})`);
  check(JSON.stringify(a.s) === JSON.stringify(b.s), `Partida "${seed}" idéntica con la misma semilla`);
  check(a.poolOk, `Partida "${seed}": el pool siempre cuadra`);
  check(a.replayOk, `Partida "${seed}": re-simular cada pelea da el mismo hash`);
}

// 3. Acciones inválidas devuelven el mismo estado.
const s0 = SIM.createGame({ seed: 'inv', players: [{ id: 'p0', name: 'T' }] });
check(SIM.applyAction(s0, 'p0', { type: 'BUY', slot: 99 }) === s0, 'Comprar en un slot inexistente no cambia el estado');
let poor = s0;
while (SIM.validateAction(poor, 'p0', { type: 'REROLL' }) === null) poor = SIM.applyAction(poor, 'p0', { type: 'REROLL' });
check(SIM.applyAction(poor, 'p0', { type: 'BUY_XP' }) === poor, 'Comprar XP sin oro no cambia el estado');
check(SIM.applyAction(s0, 'p0', { type: 'MOVE', from: { zone: 'bench', idx: 0 }, to: { zone: 'board', idx: 0 } }) === s0, 'Mover desde un lugar vacío no cambia el estado');

console.log(failed ? `\n${failed} test(s) fallaron` : '\nTodo OK');
process.exit(failed ? 1 : 0);
