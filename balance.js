// Simulación masiva para balancear. Correr con: node balance.js [partidas] [dificultad]
// (En el navegador: runBalance(200) desde la consola.)
'use strict';
const { SIM } = require('./sim.js');

const M = +(process.argv[2] || 100), difficulty = +(process.argv[3] ?? 0.3);
const slots = SIM.makeSlots({ bots: 8, difficulty });
const t0 = Date.now(), summaries = [];
for (let i = 0; i < M; i++) {
  summaries.push(SIM.simulateGame({ seed: `bal-${i}`, slots }).summary);
  if ((i + 1) % 25 === 0) process.stderr.write(`${i + 1}/${M}\n`);
}
const st = SIM.balanceStats(summaries);
console.log(`${M} partidas en ${((Date.now() - t0) / 1000).toFixed(1)}s · ${st.rondasProm} rondas en promedio · dificultad ${difficulty}`);
console.log('\nPersonalidades'); console.table(st.personalidades);
console.log('\nRasgos activos al final'); console.table(st.rasgos);
console.log('\nUnidades en tableros ganadores'); console.table(st.unidadesGanadoras.slice(0, 15));
