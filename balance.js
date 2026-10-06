// Simulación masiva para balancear. Correr con: node balance.js [partidas] [dificultad] [personalidad]
//   personalidad: si se pasa (p. ej. "equilibrado"), todos los bots la usan.
// (En el navegador: runBalance(200) desde la consola.)
'use strict';
const { SIM } = require('./sim.js');

const M = +(process.argv[2] || 100), difficulty = +(process.argv[3] ?? 0.3), only = process.argv[4];
let slots = SIM.makeSlots({ bots: 8, difficulty });
if (only) slots = slots.map(s => ({ ...s, personality: only }));
const t0 = Date.now(), summaries = [];
for (let i = 0; i < M; i++) {
  summaries.push(SIM.simulateGame({ seed: `bal-${only || 'mix'}-${i}`, slots }).summary);
  if ((i + 1) % 50 === 0) process.stderr.write(`${i + 1}/${M}\n`);
}
const st = SIM.balanceStats(summaries);
console.log(`${M} partidas en ${((Date.now() - t0) / 1000).toFixed(1)}s · ${st.rondasProm} rondas en promedio · dificultad ${difficulty}${only ? ' · todos ' + only : ''}`);
if (!only) { console.log('\nPersonalidades'); console.table(st.personalidades); }
console.log('\nOrígenes (por umbral alcanzado al final)'); console.table(st.origenes);
console.log('\nClases'); console.table(st.clases);
console.log('\nÚnicas'); console.table(st.unicas);
console.log('\nCasi nunca activos (<3% de los jugadores)'); console.table(st.casiNunca);
console.log('\nUnidades en tableros ganadores'); console.table(st.unidadesGanadoras.slice(0, 10));
