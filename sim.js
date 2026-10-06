/* Tácticas del Rock — DATA + SIM.
 * Lo carga index.html con <script src="sim.js"> y Node con require("./sim.js").
 * Script clásico (no módulo ES) para que también funcione abriendo el archivo directo. */
'use strict';
/* =====================================================================
 * 1. DATA — todo lo editable del juego. Objetos planos, sin lógica.
 * ===================================================================== */
const DATA = {
  CONFIG: {
    BOARD_ROWS: 4, BOARD_COLS: 7,      // mitad de tablero por jugador (en combate: 8x7)
    BENCH_SIZE: 9, SHOP_SIZE: 5,
    START_HP: 100, START_GOLD: 0, START_LEVEL: 1, MAX_LEVEL: 10,
    REROLL_COST: 2, XP_COST: 4, XP_AMOUNT: 4, PASSIVE_XP: 2,
    BASE_INCOME: 5, INTEREST_PER: 10, INTEREST_MAX: 5,
    STREAK_BONUS: [[5, 3], [4, 2], [2, 1]],   // [racha mínima, oro extra] (victorias o derrotas)
    PVE_WIN_GOLD: 2,
    ROUNDS_PER_STAGE: { 1: 3, default: 6 },
    // daño al perder = STAGE_DAMAGE[etapa] + suma de UNIT_DAMAGE_BY_STAR por cada unidad rival viva
    STAGE_DAMAGE: { 1: 0, 2: 1, 3: 2, 4: 4, 5: 6, 6: 8, 7: 12 },
    UNIT_DAMAGE_BY_STAR: [1, 1, 2],   // [★1, ★2, ★3]  (con esto las partidas de 8 duran ~30 rondas)
    PLANNING_SECONDS: 30,              // timer opcional de la fase de planificación
    // combate
    TICK_RATE: 30, COMBAT_SECONDS: 30,
    MOVE_TICKS: 14,          // ticks para moverse 1 hex
    CAST_TICKS: 10,          // ticks "ocupado" al castear
    MANA_LOCK_TICKS: 30,     // ticks sin ganar maná tras castear
    MANA_PER_ATTACK: 10, MANA_ON_HIT_CAP: 15,
    CRIT_CHANCE: 0.25, CRIT_MULT: 1.4,
    STAR_MULT: [1, 1.8, 3.2], // multiplicador de vida y daño por estrellas
  },

  // % de probabilidad de cada coste (1..5) según nivel del jugador
  SHOP_ODDS: {
    1: [100, 0, 0, 0, 0], 2: [100, 0, 0, 0, 0], 3: [75, 25, 0, 0, 0],
    4: [55, 30, 15, 0, 0], 5: [45, 33, 20, 2, 0], 6: [30, 40, 25, 5, 0],
    7: [19, 30, 40, 10, 1], 8: [15, 20, 32, 30, 3], 9: [10, 17, 25, 33, 15],
    10: [5, 10, 20, 40, 25],
  },
  // XP necesaria para pasar del nivel N al N+1 (tipo TFT)
  XP_TO_LEVEL: { 1: 2, 2: 2, 3: 6, 4: 10, 5: 20, 6: 36, 7: 48, 8: 76, 9: 84 },
  // copias de CADA campeón con 8 jugadores. Se escala: round(valor * jugadores / 8)
  POOL_SIZE_8P: { 1: 30, 2: 25, 3: 18, 4: 10, 5: 9 },

  // Rival generado (solo modo práctica: partida de 1 jugador). Por etapa: nivel (= cantidad de unidades) en cada ronda,
  // y probabilidad de que cada unidad salga ★2 / ★3. Etapas mayores usan la última definida.
  OPPONENT: {
    LEVEL: { 2: [2, 3, 3, 4, 4, 4], 3: [5, 5, 5, 6, 6, 6], 4: [6, 7, 7, 7, 7, 8], 5: [8, 8, 8, 8, 9, 9], 6: [9, 9, 9, 9, 10, 10], 7: [10, 10, 10, 10, 10, 10] },
    STAR2: { 2: 0.10, 3: 0.25, 4: 0.45, 5: 0.60, 6: 0.70, 7: 0.80 },
    STAR3: { 2: 0, 3: 0, 4: 0.02, 5: 0.06, 6: 0.12, 7: 0.20 },
    NAMES: ['Los Cover de Barrio', 'Banda Tributo', 'Los del Sótano', 'Garage Sónico', 'Los Teloneros',
            'La Banda del Pasillo', 'Ruido Blanco', 'Los Desafinados', 'Sala de Ensayo', 'Los Sin Pase'],
  },

  // scope 'trait' = solo las unidades con el rasgo; 'team' = todo el equipo.
  // Stats posibles: hp, armor, mr, ap, adPct, asPct, lifesteal, manaRegen, shield
  TRAITS: {
    // --- orígenes (época / escena) ---
    pionero:    { name: 'Pionero',    kind: 'origen', icon: '📻', color: '#c98b3a', scope: 'team', breakpoints: [2, 4, 6],
                  desc: 'Los que abrieron el camino. TODO tu equipo gana Vida máxima.',
                  levels: [{ hp: 100 }, { hp: 250 }, { hp: 450 }] },
    ochentoso:  { name: 'Ochentoso',  kind: 'origen', icon: '📼', color: '#e04fa0', scope: 'trait', breakpoints: [2, 4, 6],
                  desc: 'Sintetizadores y hombreras. Los Ochentosos ganan Poder de habilidad.',
                  levels: [{ ap: 20 }, { ap: 45 }, { ap: 80 }] },
    ricotero:   { name: 'Ricotero',   kind: 'origen', icon: '🌀', color: '#4a7cff', scope: 'team', breakpoints: [2, 4],
                  desc: 'Misa ricotera: TODO tu equipo gana Velocidad de ataque.',
                  levels: [{ asPct: 10 }, { asPct: 25 }] },
    barrial:    { name: 'Barrial',    kind: 'origen', icon: '🔥', color: '#3fbf6a', scope: 'trait', breakpoints: [2, 4, 6],
                  desc: 'Aguante: los Barriales ganan Daño de ataque y Robo de vida.',
                  levels: [{ adPct: 15, lifesteal: 10 }, { adPct: 35, lifesteal: 20 }, { adPct: 60, lifesteal: 35 }] },
    // --- clases (instrumento / rol) ---
    guitarrista:{ name: 'Guitarrista',kind: 'clase', icon: '🎸', color: '#ff7a3c', scope: 'trait', breakpoints: [2, 4, 6],
                  desc: 'Los Guitarristas ganan Velocidad de ataque.',
                  levels: [{ asPct: 15 }, { asPct: 35 }, { asPct: 60 }] },
    voz:        { name: 'Voz',        kind: 'clase', icon: '🎤', color: '#ffd23c', scope: 'trait', breakpoints: [2, 4, 6],
                  desc: 'Las Voces regeneran maná por segundo.',
                  levels: [{ manaRegen: 2 }, { manaRegen: 4 }, { manaRegen: 8 }] },
    bajista:    { name: 'Bajista',    kind: 'clase', icon: '🪕', color: '#a0a0a0', scope: 'trait', breakpoints: [2, 4],
                  desc: 'Los Bajistas sostienen todo: ganan Vida máxima.',
                  levels: [{ hp: 300 }, { hp: 700 }] },
    baterista:  { name: 'Baterista',  kind: 'clase', icon: '🥁', color: '#c0c0c0', scope: 'trait', breakpoints: [2, 4],
                  desc: 'Los Bateristas ganan Armadura y Resistencia mágica.',
                  levels: [{ armor: 30, mr: 30 }, { armor: 70, mr: 70 }] },
    tecladista: { name: 'Tecladista', kind: 'clase', icon: '🎹', color: '#3cd6d6', scope: 'team', breakpoints: [2, 4],
                  desc: 'TODO tu equipo arranca el combate con un escudo.',
                  levels: [{ shield: 150 }, { shield: 350 }] },
  },

  // Tipos de habilidad: nuke, aoe, multi, all, push, shield, teamShield, heal, healAll, buffAS, teamBuffAS
  // Valores en arrays = [★1, ★2, ★3]. Duraciones/stun en segundos. `img` (opcional) = URL de retrato.
  UNITS: {
    // ---- coste 1 ----
    pity:    { name: 'Pity Álvarez', short: 'Pity', cost: 1, traits: ['barrial', 'voz'], img: null,
               hp: 500, ad: 40, as: 0.65, range: 3, armor: 15, mr: 15, startMana: 20, maxMana: 70,
               ability: { name: '¡Ehh, coso!', type: 'nuke', dmg: [200, 300, 450] } },
    juanse:  { name: 'Juanse', short: 'Juanse', cost: 1, traits: ['barrial', 'guitarrista'], img: null,
               hp: 550, ad: 50, as: 0.7, range: 1, armor: 25, mr: 20, startMana: 0, maxMana: 60,
               ability: { name: 'Rock del gato', type: 'buffAS', pct: [50, 70, 100], duration: 4 } },
    semilla: { name: 'Semilla Bucciarelli', short: 'Semilla', cost: 1, traits: ['ricotero', 'bajista'], img: null,
               hp: 650, ad: 45, as: 0.55, range: 1, armor: 40, mr: 30, startMana: 30, maxMana: 80,
               ability: { name: 'Bajo continuo', type: 'shield', amount: [250, 350, 500], duration: 4 } },
    sidotti: { name: 'Walter Sidotti', short: 'Sidotti', cost: 1, traits: ['ricotero', 'baterista'], img: null,
               hp: 650, ad: 45, as: 0.6, range: 1, armor: 35, mr: 35, startMana: 20, maxMana: 70,
               ability: { name: 'Redoble', type: 'nuke', dmg: [100, 150, 225], stun: [1.25, 1.5, 2] } },
    moro:    { name: 'Oscar Moro', short: 'Moro', cost: 1, traits: ['pionero', 'baterista'], img: null,
               hp: 650, ad: 45, as: 0.6, range: 1, armor: 40, mr: 30, startMana: 40, maxMana: 90,
               ability: { name: 'Platillazo', type: 'aoe', center: 'self', radius: 1, dmg: [120, 180, 270] } },
    abuelo:  { name: 'Miguel Abuelo', short: 'M. Abuelo', cost: 1, traits: ['ochentoso', 'voz'], img: null,
               hp: 500, ad: 40, as: 0.65, range: 3, armor: 15, mr: 15, startMana: 0, maxMana: 60,
               ability: { name: 'Mil horas', type: 'heal', count: 1, amount: [150, 200, 300] } },
    // ---- coste 2 ----
    ciro:    { name: 'Ciro Martínez', short: 'Ciro', cost: 2, traits: ['barrial', 'voz'], img: null,
               hp: 600, ad: 45, as: 0.7, range: 3, armor: 20, mr: 20, startMana: 10, maxMana: 60,
               ability: { name: 'Armonicazo', type: 'multi', count: 3, dmg: [150, 225, 340] } },
    zeta:    { name: 'Zeta Bosio', short: 'Zeta', cost: 2, traits: ['ochentoso', 'bajista'], img: null,
               hp: 750, ad: 50, as: 0.6, range: 1, armor: 40, mr: 40, startMana: 30, maxMana: 80,
               ability: { name: 'Línea de bajo', type: 'shield', amount: [350, 450, 600], duration: 4 } },
    alberti: { name: 'Charly Alberti', short: 'Alberti', cost: 2, traits: ['ochentoso', 'baterista'], img: null,
               hp: 700, ad: 55, as: 0.65, range: 1, armor: 35, mr: 35, startMana: 20, maxMana: 70,
               ability: { name: 'Doble bombo', type: 'aoe', center: 'self', radius: 1, dmg: [150, 225, 340], stun: [0.75, 0.75, 1] } },
    lebon:   { name: 'David Lebón', short: 'Lebón', cost: 2, traits: ['pionero', 'guitarrista'], img: null,
               hp: 600, ad: 55, as: 0.7, range: 2, armor: 25, mr: 20, startMana: 0, maxMana: 60,
               ability: { name: 'Solo de guitarra', type: 'aoe', center: 'target', radius: 1, dmg: [170, 250, 380] } },
    tete:    { name: 'Tete Iglesias', short: 'Tete', cost: 2, traits: ['barrial', 'bajista'], img: null,
               hp: 750, ad: 50, as: 0.6, range: 1, armor: 35, mr: 35, startMana: 30, maxMana: 80,
               ability: { name: 'Línea grave', type: 'shield', amount: [300, 400, 550], duration: 4 } },
    tanque:  { name: 'Tanque Iglesias', short: 'Tanque', cost: 2, traits: ['barrial', 'baterista'], img: null,
               hp: 700, ad: 55, as: 0.65, range: 1, armor: 35, mr: 30, startMana: 20, maxMana: 70,
               ability: { name: 'Pogo', type: 'push', dmg: [140, 210, 320], distance: 2, stun: [0.75, 0.75, 1] } },
    // ---- coste 3 ----
    fito:    { name: 'Fito Páez', short: 'Fito', cost: 3, traits: ['ochentoso', 'tecladista'], img: null,
               hp: 700, ad: 45, as: 0.7, range: 4, armor: 25, mr: 30, startMana: 30, maxMana: 80,
               ability: { name: 'Mariposa Tecknicolor', type: 'heal', count: 2, amount: [250, 350, 550] } },
    skay:    { name: 'Skay Beilinson', short: 'Skay', cost: 3, traits: ['ricotero', 'guitarrista'], img: null,
               hp: 750, ad: 65, as: 0.75, range: 2, armor: 30, mr: 30, startMana: 10, maxMana: 60,
               ability: { name: 'Riff pirata', type: 'multi', count: 4, dmg: [180, 270, 400] } },
    pappo:   { name: 'Pappo', short: 'Pappo', cost: 3, traits: ['pionero', 'guitarrista'], img: null,
               hp: 850, ad: 70, as: 0.7, range: 1, armor: 40, mr: 30, startMana: 0, maxMana: 70,
               ability: { name: 'Sucio y desprolijo', type: 'aoe', center: 'target', radius: 1, dmg: [250, 375, 560] } },
    luca:    { name: 'Luca Prodan', short: 'Luca', cost: 3, traits: ['ochentoso', 'voz'], img: null,
               hp: 700, ad: 50, as: 0.7, range: 3, armor: 20, mr: 25, startMana: 20, maxMana: 75,
               ability: { name: 'Mañana en el Abasto', type: 'nuke', dmg: [350, 525, 800] } },
    chizzo:  { name: 'Chizzo Nápoli', short: 'Chizzo', cost: 3, traits: ['barrial', 'guitarrista'], img: null,
               hp: 800, ad: 65, as: 0.75, range: 1, armor: 35, mr: 30, startMana: 0, maxMana: 60,
               ability: { name: 'Hielasangre', type: 'buffAS', pct: [60, 80, 120], duration: 5 } },
    lito:    { name: 'Lito Vitale', short: 'Lito', cost: 3, traits: ['pionero', 'tecladista'], img: null,
               hp: 700, ad: 45, as: 0.7, range: 3, armor: 25, mr: 30, startMana: 20, maxMana: 70,
               ability: { name: 'Ese amigo del alma', type: 'teamShield', amount: [150, 225, 350], duration: 4 } },
    // ---- coste 4 ----
    cerati:  { name: 'Gustavo Cerati', short: 'Cerati', cost: 4, traits: ['ochentoso', 'voz', 'guitarrista'], img: null,
               hp: 850, ad: 70, as: 0.8, range: 3, armor: 30, mr: 30, startMana: 20, maxMana: 80,
               ability: { name: 'De música ligera', type: 'multi', count: 5, dmg: [250, 375, 1200] } },
    mollo:   { name: 'Ricardo Mollo', short: 'Mollo', cost: 4, traits: ['barrial', 'guitarrista'], img: null,
               hp: 950, ad: 75, as: 0.8, range: 1, armor: 45, mr: 40, startMana: 10, maxMana: 70,
               ability: { name: 'Paisano de Hurlingham', type: 'aoe', center: 'target', radius: 1, dmg: [300, 450, 1200], stun: [1, 1, 2] } },
    gieco:   { name: 'León Gieco', short: 'Gieco', cost: 4, traits: ['pionero', 'voz'], img: null,
               hp: 850, ad: 55, as: 0.7, range: 3, armor: 30, mr: 35, startMana: 30, maxMana: 90,
               ability: { name: 'Sólo le pido a Dios', type: 'healAll', amount: [200, 300, 900] } },
    calamaro:{ name: 'Andrés Calamaro', short: 'Calamaro', cost: 4, traits: ['ochentoso', 'tecladista'], img: null,
               hp: 850, ad: 60, as: 0.75, range: 3, armor: 30, mr: 30, startMana: 20, maxMana: 80,
               ability: { name: 'Flaca', type: 'teamShield', amount: [200, 300, 800], duration: 5 } },
    aznar:   { name: 'Pedro Aznar', short: 'Aznar', cost: 4, traits: ['pionero', 'bajista'], img: null,
               hp: 1000, ad: 60, as: 0.65, range: 1, armor: 45, mr: 45, startMana: 40, maxMana: 90,
               ability: { name: 'Seminare', type: 'shield', amount: [600, 800, 1600], duration: 5 } },
    // ---- coste 5 ----
    charly:  { name: 'Charly García', short: 'Charly', cost: 5, traits: ['pionero', 'ochentoso', 'tecladista'], img: null,
               hp: 1000, ad: 70, as: 0.8, range: 3, armor: 35, mr: 35, startMana: 30, maxMana: 100,
               ability: { name: 'Say No More', type: 'all', dmg: [300, 450, 2000], stun: [1.5, 1.5, 3] } },
    spinetta:{ name: 'Luis Alberto Spinetta', short: 'Spinetta', cost: 5, traits: ['pionero', 'guitarrista', 'voz'], img: null,
               hp: 1000, ad: 80, as: 0.85, range: 3, armor: 35, mr: 35, startMana: 20, maxMana: 80,
               ability: { name: 'Muchacha ojos de papel', type: 'aoe', center: 'target', radius: 2, dmg: [450, 700, 2500] } },
    indio:   { name: 'Indio Solari', short: 'Indio', cost: 5, traits: ['ricotero', 'voz'], img: null,
               hp: 1100, ad: 65, as: 0.8, range: 3, armor: 40, mr: 40, startMana: 30, maxMana: 90,
               ability: { name: 'El pogo más grande del mundo', type: 'teamBuffAS', pct: [40, 60, 200], duration: 5 } },
  },

  // Bots. La IA vive en SIM (runBotTurn); acá solo parámetros.
  BOTS: {
    NAMES: ['La Tana', 'El Rulo', 'Bocha', 'Pochi', 'El Tano', 'Cachi', 'La Colo', 'El Ruso', 'Chiche', 'Tucu'],
    // personalidad y dificultad de cada bot, en orden de lugar (se usan los primeros N)
    LINEUP: [
      { personality: 'equilibrado', difficulty: 0.3 }, { personality: 'ahorrador', difficulty: 0.3 },
      { personality: 'reroll', difficulty: 0.3 }, { personality: 'fiel', difficulty: 0.3 },
      { personality: 'equilibrado', difficulty: 0.3 }, { personality: 'ahorrador', difficulty: 0.3 },
      { personality: 'reroll', difficulty: 0.3 }, { personality: 'fiel', difficulty: 0.3 },
    ],
    // difficulty (0..1) = probabilidad de errores: olvidarse de subir, compras al azar, mal posicionamiento.
    // levels: nivel objetivo por etapa. econ: oro que intenta guardar (interés). levelReserve: oro que
    //   no toca para subir de nivel. rollAbove: rerollea el oro por encima de esto (desde rollFromStage).
    // aggroHp: con esta vida o menos se pone agresivo (gasta todo). focus: cuántos rasgos persigue.
    // loyalty: cuánto pesan sus rasgos al comprar. cheapMax: prefiere unidades de hasta este coste.
    // originOnly: apuesta a un único origen fijo durante toda la partida.
    // commitBonus/commitStage: desde esa etapa, bonus al comprar unidades de su rasgo principal (el que más arma).
    PERSONALITIES: {
      equilibrado: { name: 'Equilibrado', levels: { 1: 1, 2: 4, 3: 5, 4: 7, 5: 8, 6: 9, 7: 10 }, econ: 30, levelReserve: 10,
                     rollAbove: 50, rollFromStage: 2, maxRolls: 10, aggroHp: 40, focus: 2, loyalty: 0.8, buyThreshold: 6,
                     commitBonus: 5, commitStage: 2 },
      ahorrador:   { name: 'Ahorrador', levels: { 1: 1, 2: 5, 3: 6, 4: 8, 5: 9, 6: 10 }, econ: 50, levelReserve: 50,
                     rollAbove: 60, rollFromStage: 3, maxRolls: 6, aggroHp: 30, focus: 2, loyalty: 0.5, buyThreshold: 7 },
      reroll:      { name: 'Reroll', levels: { 1: 1, 2: 4, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9 }, econ: 20, levelReserve: 20,
                     rollAbove: 20, rollFromStage: 3, maxRolls: 15, aggroHp: 40, focus: 2, loyalty: 0.6, buyThreshold: 6, cheapMax: 2 },
      fiel:        { name: 'Fiel a la banda', levels: { 1: 1, 2: 4, 3: 5, 4: 7, 5: 8, 6: 9, 7: 10 }, econ: 30, levelReserve: 10,
                     rollAbove: 50, rollFromStage: 2, maxRolls: 10, aggroHp: 40, focus: 1, loyalty: 1, buyThreshold: 6, originOnly: true },
    },
  },

  // Enemigos de las rondas PvE de la etapa 1 (no están en el pool)
  CREEPS: {
    sonidista: { name: 'Sonidista', short: 'Sonidista', cost: 0, traits: [], icon: '🎚️',
                 hp: 350, ad: 25, as: 0.6, range: 3, armor: 10, mr: 10, startMana: 0, maxMana: 0 },
    patovica:  { name: 'Patovica', short: 'Patovica', cost: 0, traits: [], icon: '🕶️',
                 hp: 550, ad: 35, as: 0.55, range: 1, armor: 25, mr: 20, startMana: 0, maxMana: 0 },
  },
  // Posiciones en coordenadas locales del "dueño" (r=0 es la fila del frente)
  PVE: {
    '1-1': { name: 'Prueba de sonido', units: [{ unitId: 'sonidista', star: 1, r: 1, c: 3 }] },
    '1-2': { name: 'Los sonidistas', units: [{ unitId: 'sonidista', star: 1, r: 1, c: 2 }, { unitId: 'sonidista', star: 1, r: 1, c: 4 }] },
    '1-3': { name: 'Patovicas del boliche', units: [{ unitId: 'patovica', star: 1, r: 0, c: 3 },
             { unitId: 'sonidista', star: 1, r: 1, c: 2 }, { unitId: 'sonidista', star: 1, r: 1, c: 4 }] },
  },
};

/* =====================================================================
 * 2. SIM — lógica pura. Sin DOM, sin Math.random(), sin trigonometría
 *    (solo + - * / round floor min max abs, que son idénticos en todo motor JS).
 *    Todo el estado es JSON plano. Las funciones públicas que reciben un
 *    `state` de partida NO lo mutan: devuelven uno nuevo.
 *    (Internamente se usan versiones "InPlace" sobre una copia propia, por
 *     rendimiento. El estado de combate `cs` también se muta en stepCombat.)
 *
 *  ESTADO DE PARTIDA
 *  { v, seed, rng, nextUid, poolPlayers, round:{stage,num}, roundsPlayed,
 *    phase:'planning'|'ended', pool:{unitId:copias}, order:[pid],
 *    players:{pid: Player}, pairings:[{a,b,ghost}]|null, combats:[CombatRecord] }
 *  Player = { id,name,isBot,bot:{personality,difficulty}|null, rng, alive,place,hp,gold,
 *             level,xp,streak,lastOpp, shop:[unitId|null], shopLocked,
 *             bench:[Unit|null], board:[Unit|null] (idx=r*7+c), history:[...], finalBoard }
 *  Unit   = { uid, unitId, star }
 *
 *  ALEATORIEDAD
 *  - s.rng: cosas de la ronda (emparejamientos, orden de los bots, semillas de combate,
 *    rival generado). Solo lo consumen createGame / resolveRound / runAllBots, que corre el host.
 *  - p.rng: la tienda de cada jugador (rerolls). Así el reroll de uno no le cambia
 *    la tienda a otro.
 *  - IMPORTANTE (Etapa 3): el resultado de un reroll igual depende del estado del POOL
 *    compartido, y por lo tanto del ORDEN en que se aplican las acciones de todos los
 *    jugadores. Ese orden lo define el host: aplica las acciones en el orden en que las
 *    recibe y sincroniza el estado. Los clientes leen su tienda del estado sincronizado;
 *    NUNCA la recalculan localmente.
 *  - Determinismo = misma semilla + misma secuencia ordenada de acciones -> mismo estado.
 * ===================================================================== */
const SIM = (() => {
  const C = DATA.CONFIG;
  const TR = C.TICK_RATE;
  const COLS = C.BOARD_COLS, ROWS = C.BOARD_ROWS, TROWS = ROWS * 2;
  const UNIT_IDS = Object.keys(DATA.UNITS).sort();
  const IDS_BY_COST = {};
  for (const id of UNIT_IDS) (IDS_BY_COST[DATA.UNITS[id].cost] ||= []).push(id);
  const ORIGINS = Object.keys(DATA.TRAITS).filter(t => DATA.TRAITS[t].kind === 'origen').sort();

  const def = id => DATA.UNITS[id] || DATA.CREEPS[id];
  const clone = o => JSON.parse(JSON.stringify(o));
  const copiesOf = star => (star === 1 ? 1 : star === 2 ? 3 : 9);
  const byStage = (table, stage) => { // valor de la etapa, o el de la última etapa definida
    const keys = Object.keys(table).filter(k => k !== 'default').map(Number).sort((a, b) => a - b);
    let k = keys[0];
    for (const x of keys) if (x <= stage) k = x;
    return table[k];
  };

  // ---------- RNG (mulberry32). El estado vive en obj.rng (uint32) ----------
  function rngNext(obj) {
    let t = (obj.rng = (obj.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rngInt = (obj, n) => Math.floor(rngNext(obj) * n);
  const rngSeed = obj => (rngNext(obj) * 4294967296) >>> 0;
  function fnv(h, str) { // hash FNV-1a incremental
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  const seedFrom = x => fnv(2166136261, String(x));
  const stateHash = s => fnv(2166136261, JSON.stringify(s));
  function shuffle(arr, obj) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rngInt(obj, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ---------- Hex (filas "odd-r", hexágonos con punta arriba) ----------
  const N_EVEN = [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];
  const N_ODD = [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  function neighbors(r, c, rows, cols) {
    const out = [];
    for (const [dr, dc] of (r & 1 ? N_ODD : N_EVEN)) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc]);
    }
    return out;
  }
  function hexDist(r1, c1, r2, c2) {
    const x1 = c1 - (r1 - (r1 & 1)) / 2, x2 = c2 - (r2 - (r2 & 1)) / 2;
    const dx = x1 - x2, dz = r1 - r2, dy = -dx - dz;
    return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
  }
  const udist = (a, b) => hexDist(a.r, a.c, b.r, b.c);

  // ---------- Jugadores, banco y tablero ----------
  function makePlayer(s, slot) {
    return {
      id: slot.id, name: slot.name, isBot: !!slot.isBot,
      bot: slot.isBot ? { personality: slot.personality || 'equilibrado', difficulty: slot.difficulty ?? 0.3 } : null,
      rng: seedFrom(s.seed + '|shop|' + slot.id),
      alive: true, place: null,
      hp: C.START_HP, gold: C.START_GOLD, level: C.START_LEVEL, xp: 0, streak: 0, lastOpp: null,
      shop: Array(C.SHOP_SIZE).fill(null), shopLocked: false,
      bench: Array(C.BENCH_SIZE).fill(null),
      board: Array(ROWS * COLS).fill(null),   // índice = r*COLS + c, r=0 fila del frente
      lastIncome: null, history: [], finalBoard: null,
    };
  }
  const validIdx = (i, n) => Number.isInteger(i) && i >= 0 && i < n;
  const validLoc = l => !!l && ((l.zone === 'bench' && validIdx(l.idx, C.BENCH_SIZE)) || (l.zone === 'board' && validIdx(l.idx, ROWS * COLS)));
  const getAt = (p, l) => (l.zone === 'bench' ? p.bench : p.board)[l.idx];
  const setAt = (p, l, u) => { (l.zone === 'bench' ? p.bench : p.board)[l.idx] = u; };
  const boardCount = p => p.board.reduce((n, u) => n + (u ? 1 : 0), 0);
  const benchFree = p => p.bench.reduce((n, u) => n + (u ? 0 : 1), 0);
  function owned(p) { // tablero primero, después banco (orden determinista)
    const out = [];
    p.board.forEach((u, i) => u && out.push({ u, loc: { zone: 'board', idx: i } }));
    p.bench.forEach((u, i) => u && out.push({ u, loc: { zone: 'bench', idx: i } }));
    return out;
  }
  function countCopies(p, unitId, star) {
    let n = 0;
    for (const u of p.board) if (u && u.unitId === unitId && (star == null || u.star === star)) n++;
    for (const u of p.bench) if (u && u.unitId === unitId && (star == null || u.star === star)) n++;
    return n;
  }
  const xpNeeded = p => DATA.XP_TO_LEVEL[p.level] || 0;
  function addXp(p, n) {
    if (p.level >= C.MAX_LEVEL) return;
    p.xp += n;
    while (p.level < C.MAX_LEVEL && p.xp >= xpNeeded(p)) { p.xp -= xpNeeded(p); p.level++; }
    if (p.level >= C.MAX_LEVEL) p.xp = 0;
  }
  // 3 iguales -> 1 de estrella superior. Se queda la primera (prioridad tablero).
  function combineUnits(p) {
    for (let changed = true; changed;) {
      changed = false;
      const groups = {};
      for (const o of owned(p)) {
        if (o.u.star >= 3) continue;
        const k = o.u.unitId + '|' + o.u.star;
        (groups[k] ||= []).push(o);
        if (groups[k].length === 3) {
          const [keep, a, b] = groups[k];
          setAt(p, a.loc, null); setAt(p, b.loc, null);
          keep.u.star++;
          changed = true;
          break;
        }
      }
    }
  }

  // ---------- Pool y tienda ----------
  const poolSize = (cost, players) => Math.max(1, Math.round(DATA.POOL_SIZE_8P[cost] * players / 8));
  function rollCost(rngObj, level) {
    const odds = DATA.SHOP_ODDS[level];
    const roll = rngNext(rngObj) * 100;
    let cost = 1, acc = 0;
    for (let k = 0; k < 5; k++) { acc += odds[k]; if (odds[k] > 0) cost = k + 1; if (roll < acc) break; }
    return cost;
  }
  function pickFromPool(s, rngObj, cost) {
    const ids = IDS_BY_COST[cost] || [];
    const total = ids.reduce((n, id) => n + s.pool[id], 0);
    if (total <= 0) return null;
    let r = rngInt(rngObj, total);
    for (const id of ids) { r -= s.pool[id]; if (r < 0) return id; }
    return null;
  }
  // Las unidades en tienda salen del pool; al rerollear las no compradas vuelven.
  // El RNG es el del jugador (p.rng), pero QUÉ sale depende del pool en ese momento:
  // ver la nota de ALEATORIEDAD arriba.
  function rollShop(s, p) {
    for (let i = 0; i < p.shop.length; i++) if (p.shop[i]) { s.pool[p.shop[i]]++; p.shop[i] = null; }
    for (let i = 0; i < C.SHOP_SIZE; i++) {
      const cost = rollCost(p, p.level);
      let id = pickFromPool(s, p, cost);
      for (let c2 = cost - 1; !id && c2 >= 1; c2--) id = pickFromPool(s, p, c2);
      for (let c2 = cost + 1; !id && c2 <= 5; c2++) id = pickFromPool(s, p, c2);
      p.shop[i] = id;
      if (id) s.pool[id]--;
    }
  }
  function returnUnitsToPool(s, p) {
    for (const o of owned(p)) if (DATA.UNITS[o.u.unitId]) s.pool[o.u.unitId] += copiesOf(o.u.star);
    for (const id of p.shop) if (id) s.pool[id]++;
    p.board.fill(null); p.bench.fill(null); p.shop.fill(null);
  }
  const sellValue = u => def(u.unitId).cost * copiesOf(u.star);

  // ---------- Acciones del jugador: applyAction(state, pid, action) -> state ----------
  // {type:'BUY',slot} {type:'SELL',loc} {type:'MOVE',from,to} {type:'REROLL'} {type:'BUY_XP'} {type:'LOCK',value?}
  // loc = {zone:'bench'|'board', idx}. Humanos y bots usan exactamente estas acciones.
  function validateAction(s, pid, a) {
    const p = s.players[pid];
    if (!p) return 'Jugador inexistente';
    if (!p.alive) return 'Estás eliminado';
    if (s.phase !== 'planning') return 'No es fase de planificación';
    if (!a || typeof a.type !== 'string') return 'Acción inválida';
    switch (a.type) {
      case 'BUY': {
        if (!validIdx(a.slot, C.SHOP_SIZE)) return 'Slot inválido';
        const id = p.shop[a.slot];
        if (!id) return 'Ese lugar está vacío';
        if (p.gold < DATA.UNITS[id].cost) return 'No te alcanza el oro';
        if (benchFree(p) === 0 && countCopies(p, id, 1) < 2) return 'Banco lleno';
        return null;
      }
      case 'SELL':
        if (!validLoc(a.loc)) return 'Ubicación inválida';
        if (!getAt(p, a.loc)) return 'No hay unidad ahí';
        return null;
      case 'MOVE': {
        if (!validLoc(a.from) || !validLoc(a.to)) return 'Ubicación inválida';
        if (!getAt(p, a.from)) return 'No hay unidad ahí';
        if (a.from.zone === a.to.zone && a.from.idx === a.to.idx) return 'Mismo lugar';
        if (a.from.zone === 'bench' && a.to.zone === 'board' && !getAt(p, a.to) && boardCount(p) >= p.level)
          return `Nivel ${p.level}: máximo ${p.level} unidades en el tablero`;
        return null;
      }
      case 'REROLL': return p.gold >= C.REROLL_COST ? null : 'No te alcanza el oro';
      case 'BUY_XP':
        if (p.level >= C.MAX_LEVEL) return 'Ya estás en nivel máximo';
        return p.gold >= C.XP_COST ? null : 'No te alcanza el oro';
      case 'LOCK': return null;
      default: return 'Acción desconocida';
    }
  }
  // Aplica una acción YA VALIDADA mutando `s`. Solo para uso interno.
  function applyInPlace(s, pid, a) {
    const p = s.players[pid];
    switch (a.type) {
      case 'BUY': {
        const id = p.shop[a.slot];
        p.gold -= DATA.UNITS[id].cost;
        p.shop[a.slot] = null;
        const u = { uid: s.nextUid++, unitId: id, star: 1 };
        const free = p.bench.indexOf(null);
        if (free >= 0) p.bench[free] = u; else p.bench.push(u); // slot temporal; se combina al toque
        combineUnits(p);
        p.bench.length = C.BENCH_SIZE;
        break;
      }
      case 'SELL': {
        const u = getAt(p, a.loc);
        p.gold += sellValue(u);
        if (DATA.UNITS[u.unitId]) s.pool[u.unitId] += copiesOf(u.star);
        setAt(p, a.loc, null);
        break;
      }
      case 'MOVE': {
        const u = getAt(p, a.from), v = getAt(p, a.to) || null;
        setAt(p, a.to, u); setAt(p, a.from, v);
        break;
      }
      case 'REROLL': p.gold -= C.REROLL_COST; rollShop(s, p); break;
      case 'BUY_XP': p.gold -= C.XP_COST; addXp(p, C.XP_AMOUNT); break;
      case 'LOCK': p.shopLocked = typeof a.value === 'boolean' ? a.value : !p.shopLocked; break;
    }
  }
  function applyAction(state, pid, a) {
    if (validateAction(state, pid, a)) return state; // inválida: mismo objeto, sin cambios
    const s = clone(state);
    applyInPlace(s, pid, a);
    return s;
  }

  // ---------- Rasgos ----------
  function computeTraits(snap) { // cuenta campeones DISTINTOS
    const seen = {}, counts = {};
    for (const e of snap) {
      if (seen[e.unitId]) continue;
      seen[e.unitId] = true;
      for (const t of def(e.unitId).traits) counts[t] = (counts[t] || 0) + 1;
    }
    const res = {};
    for (const t of Object.keys(counts).sort()) {
      const bp = DATA.TRAITS[t].breakpoints;
      let level = -1;
      bp.forEach((b, i) => { if (counts[t] >= b) level = i; });
      const next = bp[level + 1] ?? null;
      res[t] = { count: counts[t], level, next, missing: next ? next - counts[t] : 0 };
    }
    return res;
  }
  function boardSnapshot(p) {
    const out = [];
    p.board.forEach((u, i) => u && out.push({ unitId: u.unitId, star: u.star, r: Math.floor(i / COLS), c: i % COLS }));
    return out;
  }

  // ---------- Rival generado (modo práctica de 1 jugador) ----------
  // Usa el RNG de `rngObj` (normalmente el state). No toca el pool.
  function generateOpponentBoard(rngObj, round) {
    const O = DATA.OPPONENT;
    const levels = byStage(O.LEVEL, round.stage);
    const level = Math.min(C.MAX_LEVEL, levels[Math.min(round.num, levels.length) - 1]);
    const p2 = byStage(O.STAR2, round.stage), p3 = byStage(O.STAR3, round.stage);
    const taken = {}, units = [];
    for (let i = 0; i < level; i++) {
      const ids = IDS_BY_COST[rollCost(rngObj, level)];
      const unitId = ids[rngInt(rngObj, ids.length)];
      const roll = rngNext(rngObj);
      const star = roll < p3 ? 3 : roll < p3 + p2 ? 2 : 1;
      const rows = def(unitId).range <= 1 ? [0, 1, 2, 3] : [3, 2, 1, 0];
      for (const r of rows) {
        const free = [];
        for (let c = 0; c < COLS; c++) if (!taken[r * COLS + c]) free.push(c);
        if (!free.length) continue;
        const c = free[rngInt(rngObj, free.length)];
        taken[r * COLS + c] = true;
        units.push({ unitId, star, r, c });
        break;
      }
    }
    return { name: O.NAMES[rngInt(rngObj, O.NAMES.length)], units };
  }

  // ---------- Combate (ticks fijos, determinista) ----------
  // El lado A ocupa filas 4..7 (su fila 0 = fila 4), el lado B filas 0..3 rotado 180°.
  function makeCombatUnit(cid, side, e, maxTicks) {
    const d = def(e.unitId), m = C.STAR_MULT[e.star - 1];
    const R = side === 0 ? ROWS + e.r : ROWS - 1 - e.r;
    const Cc = side === 0 ? e.c : COLS - 1 - e.c;
    return {
      cid, side, unitId: e.unitId, star: e.star,
      r: R, c: Cc, fromR: R, fromC: Cc, moveStart: 0, moveEnd: 0,
      maxHp: d.hp * m, hp: 0, ad: d.ad * m, as: d.as, range: d.range, armor: d.armor, mr: d.mr,
      mana: d.startMana || 0, maxMana: d.ability ? d.maxMana : 0, ap: 0,
      shield: 0, shieldUntil: 0, lifesteal: 0, manaRegen: 0,
      critChance: C.CRIT_CHANCE, critMult: C.CRIT_MULT, asBuffs: [],
      stunUntil: 0, busyUntil: 0, manaLockUntil: 0, nextAttack: 0, target: -1, alive: true, dmgDealt: 0,
      _maxTicks: maxTicks,
    };
  }
  function applyMods(u, mods) {
    for (const k of Object.keys(mods).sort()) {
      const v = mods[k];
      if (k === 'hp') u.maxHp += v;
      else if (k === 'adPct') u.ad *= 1 + v / 100;
      else if (k === 'asPct') u.as *= 1 + v / 100;
      else if (k === 'shield') { u.shield += v; u.shieldUntil = u._maxTicks + 1; }
      else u[k] += v; // armor, mr, ap, lifesteal, manaRegen
    }
  }
  function addSide(cs, snap, side) {
    const ordered = snap.slice().sort((a, b) => a.r - b.r || a.c - b.c);
    const mine = ordered.map(e => {
      const u = makeCombatUnit(cs.units.length, side, e, cs.maxTicks);
      cs.units.push(u);
      return u;
    });
    const traits = computeTraits(snap);
    for (const t of Object.keys(traits)) {
      const { level } = traits[t];
      if (level < 0) continue;
      const T = DATA.TRAITS[t];
      const targets = T.scope === 'team' ? mine : mine.filter(u => def(u.unitId).traits.includes(t));
      for (const u of targets) applyMods(u, T.levels[level]);
    }
    for (const u of mine) { u.hp = u.maxHp; u.nextAttack = Math.round(TR / u.as / 2); }
  }
  function createCombat(snapA, snapB, seed) {
    const cs = { tick: 0, rng: seed >>> 0, hash: 2166136261, maxTicks: C.COMBAT_SECONDS * TR, units: [], events: [], done: false, winner: null };
    addSide(cs, snapA, 0);
    addSide(cs, snapB, 1);
    return cs;
  }
  const attackSpeed = u => Math.min(5, u.as * (1 + u.asBuffs.reduce((n, b) => n + b.pct, 0) / 100));
  function gainMana(u, amt, T) {
    if (u.maxMana <= 0 || T < u.manaLockUntil) return;
    u.mana = Math.min(u.maxMana, u.mana + amt);
  }
  function closestEnemy(cs, u) {
    let best = null, bd = 1e9;
    for (const e of cs.units) {
      if (!e.alive || e.side === u.side) continue;
      const d = udist(u, e);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function occupancy(cs) {
    const occ = new Uint8Array(TROWS * COLS);
    for (const x of cs.units) if (x.alive) occ[x.r * COLS + x.c] = 1;
    return occ;
  }
  function nextStep(cs, u, tgt) { // BFS hasta una celda libre a rango del objetivo
    const occ = occupancy(cs);
    const prev = new Int16Array(TROWS * COLS).fill(-1);
    const start = u.r * COLS + u.c;
    prev[start] = start;
    const q = [start];
    for (let head = 0; head < q.length; head++) {
      const cur = q[head], r = (cur / COLS) | 0, c = cur % COLS;
      if (cur !== start && hexDist(r, c, tgt.r, tgt.c) <= u.range) {
        let k = cur;
        while (prev[k] !== start) k = prev[k];
        return [(k / COLS) | 0, k % COLS];
      }
      for (const [nr, nc] of neighbors(r, c, TROWS, COLS)) {
        const ni = nr * COLS + nc;
        if (prev[ni] !== -1 || occ[ni]) continue;
        prev[ni] = cur;
        q.push(ni);
      }
    }
    return null;
  }
  function dealDamage(cs, src, tgt, raw, kind, T, crit) {
    if (!tgt.alive) return 0;
    const res = Math.max(0, kind === 'phys' ? tgt.armor : tgt.mr);
    let dmg = raw * 100 / (100 + res);
    const total = dmg;
    if (tgt.shield > 0) { const ab = Math.min(tgt.shield, dmg); tgt.shield -= ab; dmg -= ab; }
    tgt.hp -= dmg;
    gainMana(tgt, Math.min(C.MANA_ON_HIT_CAP, raw * 0.01 + total * 0.03), T);
    src.dmgDealt += total;
    cs.events.push({ t: 'dmg', s: src.cid, d: tgt.cid, a: Math.round(total), k: kind, c: crit ? 1 : 0 });
    if (tgt.hp <= 0) { tgt.hp = 0; tgt.alive = false; cs.events.push({ t: 'die', d: tgt.cid }); }
    return total;
  }
  function healUnit(cs, u, amt) {
    if (!u.alive || amt <= 0) return;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amt);
    if (u.hp - before >= 1) cs.events.push({ t: 'heal', d: u.cid, a: Math.round(u.hp - before) });
  }
  function addShield(u, amt, until) { u.shield += amt; u.shieldUntil = Math.max(u.shieldUntil, until); }
  function stunUnit(cs, u, sec, T) {
    if (!u.alive) return;
    u.stunUntil = Math.max(u.stunUntil, T + Math.round(sec * TR));
    cs.events.push({ t: 'stun', d: u.cid });
  }
  // Empuja a `e` hasta `n` hexes alejándolo de `src` (solo a celdas libres)
  function pushUnit(cs, src, e, n, T) {
    if (!e.alive) return;
    const fromR = e.r, fromC = e.c;
    for (let k = 0; k < n; k++) {
      const occ = occupancy(cs);
      let best = null, bd = udist(src, e);
      for (const [nr, nc] of neighbors(e.r, e.c, TROWS, COLS)) {
        if (occ[nr * COLS + nc]) continue;
        const d = hexDist(src.r, src.c, nr, nc);
        if (d > bd) { bd = d; best = [nr, nc]; }
      }
      if (!best) break;
      e.r = best[0]; e.c = best[1];
    }
    if (e.r !== fromR || e.c !== fromC) {
      e.fromR = fromR; e.fromC = fromC; e.moveStart = T; e.moveEnd = T + 6;
      e.busyUntil = Math.max(e.busyUntil, e.moveEnd);
      cs.events.push({ t: 'push', d: e.cid });
    }
  }
  function basicAttack(cs, u, tgt, T) {
    let dmg = u.ad, crit = false;
    if (rngNext(cs) < u.critChance) { dmg *= u.critMult; crit = true; }
    cs.events.push({ t: 'atk', s: u.cid, d: tgt.cid });
    const dealt = dealDamage(cs, u, tgt, dmg, 'phys', T, crit);
    if (u.lifesteal > 0) healUnit(cs, u, dealt * u.lifesteal / 100);
    gainMana(u, C.MANA_PER_ATTACK, T);
  }
  function castAbility(cs, u, tgt, T) {
    const ab = def(u.unitId).ability;
    const si = u.star - 1, val = v => (Array.isArray(v) ? v[si] : v), amp = 1 + u.ap / 100;
    const dur = sec => T + Math.round(val(sec) * TR);
    u.mana = 0; u.manaLockUntil = T + C.MANA_LOCK_TICKS; u.busyUntil = T + C.CAST_TICKS;
    cs.events.push({ t: 'cast', s: u.cid, n: ab.name });
    const enemies = cs.units.filter(x => x.alive && x.side !== u.side);
    const allies = cs.units.filter(x => x.alive && x.side === u.side);
    const hit = e => {
      if (!e.alive) return;
      dealDamage(cs, u, e, val(ab.dmg) * amp, 'magic', T, false);
      if (ab.stun) stunUnit(cs, e, val(ab.stun), T);
    };
    switch (ab.type) {
      case 'nuke': hit(tgt); break;
      case 'aoe': { const center = ab.center === 'self' ? u : tgt; enemies.filter(e => udist(center, e) <= (ab.radius || 1)).forEach(hit); break; }
      case 'multi': { const pool = enemies.slice(); for (let k = 0; k < ab.count && pool.length; k++) hit(pool.splice(rngInt(cs, pool.length), 1)[0]); break; }
      case 'all': enemies.forEach(hit); break;
      case 'push': hit(tgt); pushUnit(cs, u, tgt, ab.distance || 1, T); break;
      case 'shield': addShield(u, val(ab.amount) * amp, dur(ab.duration)); break;
      case 'teamShield': allies.forEach(a => addShield(a, val(ab.amount) * amp, dur(ab.duration))); break;
      case 'heal': allies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.cid - b.cid)
        .slice(0, ab.count || 1).forEach(a => healUnit(cs, a, val(ab.amount) * amp)); break;
      case 'healAll': allies.forEach(a => healUnit(cs, a, val(ab.amount) * amp)); break;
      case 'buffAS': u.asBuffs.push({ pct: val(ab.pct), until: dur(ab.duration) }); break;
      case 'teamBuffAS': allies.forEach(a => a.asBuffs.push({ pct: val(ab.pct), until: dur(ab.duration) })); break;
    }
  }
  function stepCombat(cs) {
    if (cs.done) return cs;
    cs.events = [];
    const T = ++cs.tick;
    for (const u of cs.units) {
      if (!u.alive) continue;
      if (u.shield > 0 && T >= u.shieldUntil) u.shield = 0;
      if (u.asBuffs.length) u.asBuffs = u.asBuffs.filter(b => b.until > T);
      if (u.manaRegen > 0) gainMana(u, u.manaRegen / TR, T);
      if (u.stunUntil > T || u.busyUntil > T) continue;
      let tgt = u.target >= 0 ? cs.units[u.target] : null;
      if (!tgt || !tgt.alive || udist(u, tgt) > u.range) tgt = closestEnemy(cs, u) || null;
      if (!tgt) continue;
      u.target = tgt.cid;
      if (udist(u, tgt) <= u.range) {
        if (u.maxMana > 0 && u.mana >= u.maxMana) { castAbility(cs, u, tgt, T); continue; }
        if (T >= u.nextAttack) {
          basicAttack(cs, u, tgt, T);
          u.nextAttack = T + Math.max(1, Math.round(TR / attackSpeed(u)));
        }
      } else {
        const step = nextStep(cs, u, tgt);
        if (step) {
          u.fromR = u.r; u.fromC = u.c; u.r = step[0]; u.c = step[1];
          u.moveStart = T; u.moveEnd = T + C.MOVE_TICKS; u.busyUntil = u.moveEnd;
          cs.events.push({ t: 'move', s: u.cid, r: u.r, c: u.c });
        }
      }
    }
    if (cs.events.length) cs.hash = fnv(cs.hash, T + JSON.stringify(cs.events));
    let a = 0, b = 0;
    for (const u of cs.units) if (u.alive) { if (u.side === 0) a++; else b++; }
    if (a === 0 || b === 0) { cs.done = true; cs.winner = a > 0 ? 'A' : b > 0 ? 'B' : 'draw'; }
    else if (T >= cs.maxTicks) { cs.done = true; cs.winner = 'draw'; }
    if (cs.done) cs.hash = fnv(cs.hash, cs.winner + JSON.stringify(cs.units.map(u => [u.hp, u.r, u.c, u.mana])));
    return cs;
  }
  function survivors(cs, side) {
    return cs.units.filter(u => u.alive && u.side === side).map(u => ({ unitId: u.unitId, star: u.star }));
  }
  function simulateCombat(snapA, snapB, seed) {
    const cs = createCombat(snapA, snapB, seed);
    while (!cs.done) stepCombat(cs);
    return { winner: cs.winner, ticks: cs.tick, hash: cs.hash, survivorsA: survivors(cs, 0), survivorsB: survivors(cs, 1) };
  }
  // Chequeo de determinismo: mismo combate 2 veces (con copias independientes) -> mismo hash.
  function checkDeterminism(snapA, snapB, seed) {
    const r1 = simulateCombat(clone(snapA), clone(snapB), seed);
    const r2 = simulateCombat(clone(snapA), clone(snapB), seed);
    return { ok: r1.hash === r2.hash && JSON.stringify(r1) === JSON.stringify(r2), r1, r2 };
  }
  // Lote: N combates entre tableros generados al azar (con semilla) de etapas 2..7.
  function selfTest(n = 20, seed = 'selftest') {
    const g = { rng: seedFrom(seed) };
    let fails = 0;
    for (let i = 0; i < n; i++) {
      const round = { stage: 2 + (i % 6), num: 1 + (i % 6) };
      const a = generateOpponentBoard(g, round).units, b = generateOpponentBoard(g, round).units;
      if (!checkDeterminism(a, b, rngSeed(g)).ok) fails++;
    }
    return { ok: fails === 0, combats: n, fails };
  }

  // ---------- Bots ----------
  // Los bots ven lo mismo que un jugador (su tienda, oro, banco y tablero) y actúan
  // SOLO con las acciones de validateAction/applyAction. Su aleatoriedad propia
  // (errores por dificultad) sale de un RNG derivado de semilla+ronda+id, que no
  // toca s.rng ni p.rng: un bot "pensando" no le cambia nada a nadie.
  const POWER = u => def(u.unitId).cost * copiesOf(u.star);
  const FRONT_CELLS = [3, 2, 4, 1, 5, 0, 6, 10, 9, 11, 8, 12, 7, 13, 17, 16, 18, 15, 19, 14, 20, 24, 23, 25, 22, 26, 21, 27];
  const BACK_CELLS = [24, 23, 25, 22, 26, 21, 17, 16, 18, 15, 19, 14, 20, 10, 9, 11, 8, 12, 7, 13, 3, 2, 4, 1, 5, 0, 6];
  const CARRY_CELL = 27; // esquina de atrás
  const favoriteOrigin = (s, id) => ORIGINS[fnv(s.seed, '|fav|' + id) % ORIGINS.length];

  function botTargets(p, P, fav) {
    if (fav) return [fav];
    const score = {}, seen = {};
    for (const o of owned(p)) {
      if (seen[o.u.unitId]) continue;
      seen[o.u.unitId] = true;
      for (const t of def(o.u.unitId).traits) score[t] = (score[t] || 0) + 2 + (o.u.star - 1);
    }
    for (const id of p.shop) if (id) for (const t of DATA.UNITS[id].traits) score[t] = (score[t] || 0) + 0.5;
    const active = computeTraits(boardSnapshot(p)); // lealtad: lo que ya está activo pesa más
    for (const t of Object.keys(active)) if (active[t].level >= 0) score[t] += 2 * P.loyalty;
    return Object.keys(score).sort((a, b) => score[b] - score[a] || (a < b ? -1 : 1)).slice(0, P.focus);
  }
  function unitScore(p, unitId, star, targets, P, focus) {
    const d = DATA.UNITS[unitId];
    let sc = 0;
    const pair = countCopies(p, unitId, star);
    if (star < 3) sc += pair >= 2 ? 10 : pair === 1 ? 5 : 0;
    sc += d.traits.filter(t => targets.includes(t)).length * 3 * (0.5 + P.loyalty);
    if (focus && d.traits.includes(focus.trait)) sc += focus.bonus; // rasgo al que se comprometió
    sc += d.cost * (p.level >= d.cost + 3 ? 1 : 0.4);
    if (P.cheapMax && d.cost <= P.cheapMax) sc += 3;
    return sc;
  }

  // Decide y aplica el turno de un bot sobre `s` (lo muta). Devuelve las acciones usadas.
  function botTurnInPlace(s, id) {
    const actions = [];
    const p = () => s.players[id];
    if (!p() || !p().alive || !p().isBot || s.phase !== 'planning') return actions;
    const act = a => { if (validateAction(s, id, a)) return false; applyInPlace(s, id, a); actions.push(a); return true; };
    const P = DATA.BOTS.PERSONALITIES[p().bot.personality] || DATA.BOTS.PERSONALITIES.equilibrado;
    const diff = p().bot.difficulty || 0;
    const stage = s.round.stage;
    const brng = { rng: seedFrom(s.seed + '|bot|' + roundLabel(s.round) + '|' + id) };
    const oops = k => rngNext(brng) < diff * k;
    const aggressive = p().hp <= P.aggroHp;
    const fav = P.originOnly ? favoriteOrigin(s, id) : null;
    const reserve = () => (aggressive || stage <= 1 ? 0 : Math.round(P.econ * Math.min(1, (stage - 1) / 2)));
    let targets = botTargets(p(), P, fav);
    // Compromiso: Fiel apuesta a su origen fijo; otros (commitBonus) a su rasgo principal desde commitStage.
    const focusOf = () => (fav ? { trait: fav, bonus: 6 }
      : P.commitBonus && stage >= (P.commitStage || 2) && targets[0] ? { trait: targets[0], bonus: P.commitBonus } : null);
    const score = u => unitScore(p(), u.unitId, u.star, targets, P, focusOf()) + (u.star - 1) * 6;

    // Vende lo que menos sirve del banco (sin romper pares) si su puntaje es menor a `than`.
    const sellJunk = than => {
      let worst = -1, ws = Infinity;
      p().bench.forEach((u, i) => {
        if (!u || countCopies(p(), u.unitId, u.star) > 1) return;
        const sc = score(u);
        if (sc < ws) { ws = sc; worst = i; }
      });
      return worst >= 0 && ws < than && act({ type: 'SELL', loc: { zone: 'bench', idx: worst } });
    };

    // 1) nivel
    const wantLevel = byStage(P.levels, stage);
    if (!oops(0.5)) {
      const keep = aggressive ? 0 : Math.min(reserve(), P.levelReserve);
      for (let g = 0; g < 30 && p().level < wantLevel && p().gold - C.XP_COST >= keep; g++) if (!act({ type: 'BUY_XP' })) break;
    }
    // 2) compras
    const buyPass = () => {
      targets = botTargets(p(), P, fav);
      for (let i = 0; i < C.SHOP_SIZE; i++) {
        const unitId = p().shop[i];
        if (!unitId) continue;
        const cost = DATA.UNITS[unitId].cost;
        if (p().gold < cost) continue;
        const sc = unitScore(p(), unitId, 1, targets, P, focusOf());
        const units = owned(p()).length;
        const needBodies = units < p().level;
        const random = oops(0.25);
        const pairish = countCopies(p(), unitId, 1) >= 1;
        if (!(random || needBodies || sc >= P.buyThreshold)) continue;
        if (!random && !needBodies && !pairish && p().gold - cost < reserve()) continue;
        if (benchFree(p()) === 0 && countCopies(p(), unitId, 1) < 2 && !sellJunk(sc)) continue;
        act({ type: 'BUY', slot: i });
      }
    };
    buyPass();
    // 3) rerolls
    const rollFloor = aggressive ? 0 : stage >= P.rollFromStage ? P.rollAbove : Infinity;
    for (let g = 0; g < (aggressive ? 25 : P.maxRolls) && p().gold >= C.REROLL_COST && p().gold - C.REROLL_COST >= rollFloor; g++) {
      if (!act({ type: 'REROLL' })) break;
      buyPass();
    }
    // 4) tablero: las `level` unidades más valiosas; cuerpo a cuerpo adelante, rango atrás,
    //    la más valiosa de rango en la esquina de atrás.
    const pl = p();
    const focus = focusOf();
    const all = owned(pl).map(o => {
      const tr = def(o.u.unitId).traits;
      return { ...o, pow: POWER(o.u) + tr.filter(t => targets.includes(t)).length * 1.5 + (focus && tr.includes(focus.trait) ? 2 : 0) };
    });
    all.sort((a, b) => b.pow - a.pow || a.u.uid - b.u.uid);
    const chosen = all.slice(0, pl.level);
    const chosenIds = new Set(chosen.map(o => o.u.uid));
    const melee = chosen.filter(o => def(o.u.unitId).range <= 1), ranged = chosen.filter(o => def(o.u.unitId).range > 1);
    const target = {}, used = new Set();
    const take = (uid, cells) => { const c = cells.find(x => !used.has(x)); used.add(c); target[uid] = c; };
    if (ranged.length) take(ranged[0].u.uid, [CARRY_CELL]);
    for (const o of ranged.slice(1)) take(o.u.uid, BACK_CELLS);
    for (const o of melee) take(o.u.uid, FRONT_CELLS);
    if (oops(0.7)) { // mal posicionamiento
      const cells = shuffle(Object.values(target), brng), uids = Object.keys(target);
      uids.forEach((u, i) => (target[u] = cells[i]));
    }
    const where = uid => {
      const b = p().board.findIndex(u => u && u.uid === uid);
      return b >= 0 ? { zone: 'board', idx: b } : { zone: 'bench', idx: p().bench.findIndex(u => u && u.uid === uid) };
    };
    p().board.forEach((u, i) => { // sacar del tablero lo que no se eligió
      if (!u || chosenIds.has(u.uid)) return;
      const free = p().bench.indexOf(null);
      if (free >= 0) act({ type: 'MOVE', from: { zone: 'board', idx: i }, to: { zone: 'bench', idx: free } });
    });
    for (const o of chosen) {
      const from = where(o.u.uid), t = target[o.u.uid];
      if (from.zone === 'board' && from.idx === t) continue;
      if (!act({ type: 'MOVE', from, to: { zone: 'board', idx: t } })) {
        const extra = p().board.findIndex(u => u && !chosenIds.has(u.uid));
        if (extra >= 0) act({ type: 'MOVE', from, to: { zone: 'board', idx: extra } });
      }
    }
    // 5) no acumular: vender del banco lo que no forma pares ni encaja (deja hasta 4)
    for (let g = 0; g < C.BENCH_SIZE && C.BENCH_SIZE - benchFree(p()) > 4; g++) if (!sellJunk(P.buyThreshold + 4)) break;
    if (benchFree(p()) === 0) sellJunk(Infinity);
    return actions;
  }
  // API pública: qué haría el bot con este estado. No muta `state`.
  // Aplicar la lista en orden con applyAction reproduce exactamente su turno.
  function runBotTurn(state, botId) {
    return botTurnInPlace(clone(state), botId);
  }
  // Hace jugar a todos los bots vivos, en un orden barajado con s.rng cada ronda.
  // Cada bot decide y APLICA sus acciones antes de que decida el siguiente, así ve el pool real.
  // El host lo llama al inicio de cada planificación, antes de procesar acciones humanas.
  function runAllBots(state, log) {
    if (state.phase !== 'planning') return state;
    const s = clone(state);
    const bots = shuffle(alivePlayers(s).filter(id => s.players[id].isBot), s);
    for (const id of bots) {
      const actions = botTurnInPlace(s, id);
      if (log) log.push({ id, actions });
    }
    return s;
  }

  // ---------- Flujo de partida (lo corre el host) ----------
  const roundsInStage = st => C.ROUNDS_PER_STAGE[st] || C.ROUNDS_PER_STAGE.default;
  const roundLabel = r => `${r.stage}-${r.num}`;
  const alivePlayers = s => s.order.filter(id => s.players[id].alive);
  function streakBonus(n) { for (const [min, g] of C.STREAK_BONUS) if (n >= min) return g; return 0; }
  function incomePreview(p) {
    const interest = Math.min(C.INTEREST_MAX, Math.floor(p.gold / C.INTEREST_PER));
    const streak = streakBonus(Math.abs(p.streak));
    return { base: C.BASE_INCOME, interest, streak, total: C.BASE_INCOME + interest + streak };
  }
  function playerDamage(stage, surv) {
    if (!surv.length) return 0;
    return byStage(C.STAGE_DAMAGE, stage) + surv.reduce((n, u) => n + C.UNIT_DAMAGE_BY_STAR[u.star - 1], 0);
  }

  // Lugares de una partida: humanos + bots con nombres/personalidades de DATA.BOTS.
  function makeSlots({ humans = [], bots = 7, difficulty = null } = {}) {
    const slots = humans.map(h => ({ id: h.id, name: h.name, isBot: false }));
    const B = DATA.BOTS;
    for (let i = 0; i < bots; i++) {
      const lu = B.LINEUP[i % B.LINEUP.length];
      slots.push({ id: 'b' + (i + 1), name: B.NAMES[i % B.NAMES.length], isBot: true,
                   personality: lu.personality, difficulty: difficulty ?? lu.difficulty });
    }
    return slots;
  }
  // slots: [{id, name, isBot, personality?, difficulty?}]. poolPlayers: por defecto la cantidad
  // de lugares (1 jugador = modo práctica, pool de 8).
  function createGame({ seed, slots, players, poolPlayers }) {
    slots = slots || players;
    const s = {
      v: 3, seed: seedFrom(seed), rng: seedFrom(seed), nextUid: 1,
      poolPlayers: poolPlayers || (slots.length === 1 ? 8 : slots.length),
      round: { stage: 1, num: 1 }, roundsPlayed: 0, phase: 'planning',
      pool: {}, players: {}, order: [], pairings: null, combats: [],
    };
    for (const id of UNIT_IDS) s.pool[id] = poolSize(DATA.UNITS[id].cost, s.poolPlayers);
    for (const sl of slots) { s.players[sl.id] = makePlayer(s, sl); s.order.push(sl.id); }
    startPlanning(s, true);
    return s;
  }
  // Empareja a los vivos evitando repetir el rival de la ronda anterior cuando se puede.
  // Si son impares, el que sobra pelea contra el fantasma (copia del tablero) de otro.
  function makePairings(s) {
    const alive = alivePlayers(s);
    if (alive.length < 2) return [];
    const repeat = (a, b) => s.players[a].lastOpp === b || s.players[b].lastOpp === a;
    let best = null, bestRepeats = Infinity;
    for (let attempt = 0; attempt < 12 && bestRepeats > 0; attempt++) { // varios barajados, el de menos repeticiones
      const list = shuffle(alive, s), pairs = [];
      let repeats = 0;
      while (list.length >= 2) {
        const a = list.shift();
        let j = list.findIndex(b => !repeat(a, b));
        if (j < 0) { j = 0; repeats++; }
        pairs.push({ a, b: list.splice(j, 1)[0], ghost: false });
      }
      if (list.length === 1) {
        const a = list[0], others = alive.filter(x => x !== a);
        const pref = others.filter(x => x !== s.players[a].lastOpp);
        if (!pref.length) repeats++;
        const pool = pref.length ? pref : others;
        pairs.push({ a, b: pool[rngInt(s, pool.length)], ghost: true });
      }
      if (repeats < bestRepeats) { best = pairs; bestRepeats = repeats; }
    }
    return best;
  }
  function startPlanning(s, first) {
    for (const id of alivePlayers(s)) {
      const p = s.players[id];
      const inc = first ? { base: C.BASE_INCOME, interest: 0, streak: 0, total: C.BASE_INCOME } : incomePreview(p);
      p.gold += inc.total;
      p.lastIncome = inc;
      if (!first) addXp(p, C.PASSIVE_XP);
      if (first || !p.shopLocked) rollShop(s, p);
    }
    const pvp = !DATA.PVE[roundLabel(s.round)] && s.order.length > 1;
    s.pairings = pvp ? makePairings(s) : null;
    s.phase = 'planning';
  }
  // Puestos: los que mueren en la misma ronda se ordenan por la vida que tenían ANTES de la ronda.
  function eliminate(s, hpBefore) {
    const alive = alivePlayers(s);
    const dead = alive.filter(id => s.players[id].hp <= 0)
      .sort((a, b) => hpBefore[a] - hpBefore[b] || s.players[a].hp - s.players[b].hp || (a < b ? -1 : 1));
    const remaining = alive.length - dead.length;
    dead.forEach((id, k) => {
      const p = s.players[id];
      p.alive = false; p.place = remaining + dead.length - k;
      p.finalBoard = boardSnapshot(p);
      returnUnitsToPool(s, p);
    });
    if (remaining === 0 || (s.order.length > 1 && remaining <= 1)) {
      for (const id of alivePlayers(s)) { const p = s.players[id]; p.place = 1; p.finalBoard = boardSnapshot(p); }
      s.phase = 'ended';
    }
  }
  function addHistory(p, round, vs, result, dmg) {
    p.history.unshift({ round, vs, result, dmg });
    p.history.length = Math.min(p.history.length, 40);
  }
  const resultOf = (winner, side) => (winner === 'draw' ? 'draw' : winner === side ? 'win' : 'loss');
  // Resuelve TODAS las peleas de la ronda (sin render), aplica daño, elimina, asigna puestos
  // y arranca la siguiente planificación (con sus emparejamientos ya decididos).
  function resolveRound(state) {
    if (state.phase !== 'planning') return state;
    const s = clone(state);
    const label = roundLabel(s.round), stage = s.round.stage;
    const alive = alivePlayers(s);
    const hpBefore = {};
    for (const id of alive) hpBefore[id] = s.players[id].hp;
    const pve = DATA.PVE[label];
    s.combats = [];
    const streak = (p, won) => { p.streak = won ? (p.streak > 0 ? p.streak + 1 : 1) : (p.streak < 0 ? p.streak - 1 : -1); };

    if (pve || s.order.length === 1) { // creeps (etapa 1) o rival generado (modo práctica)
      for (const id of alive) {
        const p = s.players[id], seed = rngSeed(s);
        const opp = pve ? { name: pve.name, units: clone(pve.units) } : generateOpponentBoard(s, s.round);
        const snapA = boardSnapshot(p), res = simulateCombat(snapA, opp.units, seed);
        const won = res.winner === 'A';
        let dmg = 0;
        if (pve) { if (won) p.gold += C.PVE_WIN_GOLD; else dmg = res.survivorsB.reduce((n, u) => n + C.UNIT_DAMAGE_BY_STAR[u.star - 1], 0); }
        else { if (!won) dmg = playerDamage(stage, res.survivorsB); streak(p, won); }
        p.hp -= dmg;
        addHistory(p, label, opp.name, resultOf(res.winner, 'A'), dmg);
        s.combats.push({ round: label, kind: pve ? 'pve' : 'gen', a: id, b: null, ghost: false, name: opp.name, snapA, snapB: opp.units, seed, winner: res.winner, hash: res.hash, dmgA: dmg, dmgB: 0 });
      }
    } else {
      for (const { a, b, ghost } of s.pairings) {
        const pa = s.players[a], pb = s.players[b], seed = rngSeed(s);
        const snapA = boardSnapshot(pa), snapB = boardSnapshot(pb);
        const res = simulateCombat(snapA, snapB, seed);
        const dmgA = res.winner === 'A' ? 0 : playerDamage(stage, res.survivorsB);
        const dmgB = ghost || res.winner === 'B' ? 0 : playerDamage(stage, res.survivorsA);
        pa.hp -= dmgA; streak(pa, res.winner === 'A'); pa.lastOpp = b;
        addHistory(pa, label, pb.name + (ghost ? ' (fantasma)' : ''), resultOf(res.winner, 'A'), dmgA);
        if (!ghost) {
          pb.hp -= dmgB; streak(pb, res.winner === 'B'); pb.lastOpp = a;
          addHistory(pb, label, pa.name, resultOf(res.winner, 'B'), dmgB);
        }
        s.combats.push({ round: label, kind: 'pvp', a, b, ghost, name: pb.name, snapA, snapB, seed, winner: res.winner, hash: res.hash, dmgA, dmgB });
      }
    }
    s.roundsPlayed++;
    eliminate(s, hpBefore);
    if (s.phase !== 'ended') {
      s.round.num++;
      if (s.round.num > roundsInStage(s.round.stage)) { s.round.stage++; s.round.num = 1; }
      startPlanning(s, false);
    }
    return s;
  }

  // ---------- Partidas completas sin UI (balance y chequeo de determinismo) ----------
  // Todos los lugares son bots. Devuelve el estado final y, si se pide, el hash del
  // estado después de cada ronda.
  function simulateGame({ seed, slots = makeSlots({ bots: 8 }), maxRounds = 200, trackHashes = false } = {}) {
    let s = runAllBots(createGame({ seed, slots }));
    const hashes = trackHashes ? [stateHash(s)] : null;
    for (let n = 0; s.phase !== 'ended' && n < maxRounds; n++) {
      s = resolveRound(s);
      if (s.phase !== 'ended') s = runAllBots(s);
      if (hashes) hashes.push(stateHash(s));
    }
    return { state: s, hashes, summary: gameSummary(s) };
  }
  function checkGameDeterminism(seed = 'det', slots) {
    const a = simulateGame({ seed, slots, trackHashes: true }), b = simulateGame({ seed, slots, trackHashes: true });
    const n = Math.max(a.hashes.length, b.hashes.length);
    let firstDiff = -1;
    for (let i = 0; i < n && firstDiff < 0; i++) if (a.hashes[i] !== b.hashes[i]) firstDiff = i;
    return { ok: firstDiff < 0, rounds: a.state.roundsPlayed, firstDiffAfterRound: firstDiff, finalHash: a.hashes[a.hashes.length - 1] };
  }
  function gameSummary(s) {
    return {
      rounds: s.roundsPlayed,
      players: s.order.map(id => {
        const p = s.players[id], snap = p.finalBoard || boardSnapshot(p), tr = computeTraits(snap);
        return {
          id, place: p.place, personality: p.bot ? p.bot.personality : 'humano', difficulty: p.bot ? p.bot.difficulty : null,
          traits: Object.keys(tr).filter(t => tr[t].level >= 0).map(t => `${DATA.TRAITS[t].name} ${DATA.TRAITS[t].breakpoints[tr[t].level]}`),
          units: [...new Set(snap.map(e => e.unitId))],
        };
      }),
    };
  }
  // Junta resúmenes de muchas partidas en tablas listas para console.table.
  function balanceStats(summaries) {
    const r2 = x => Math.round(x * 100) / 100, pct = x => Math.round(x * 1000) / 10;
    const acc = (map, key, place) => {
      const e = (map[key] ||= { n: 0, sum: 0, top4: 0, wins: 0 });
      e.n++; e.sum += place; if (place <= 4) e.top4++; if (place === 1) e.wins++;
    };
    const pers = {}, traits = {}, winUnits = {};
    let rounds = 0;
    for (const g of summaries) {
      rounds += g.rounds;
      for (const p of g.players) {
        acc(pers, p.personality, p.place);
        for (const t of p.traits) acc(traits, t, p.place);
        if (p.place === 1) for (const u of p.units) winUnits[u] = (winUnits[u] || 0) + 1;
      }
    }
    const table = (map, label) => Object.entries(map)
      .map(([k, e]) => ({ [label]: k, apariciones: e.n, puestoProm: r2(e.sum / e.n), top4: pct(e.top4 / e.n) + '%', ganadas: pct(e.wins / e.n) + '%' }))
      .sort((a, b) => a.puestoProm - b.puestoProm);
    const games = summaries.length;
    return {
      partidas: games,
      rondasProm: r2(rounds / games),
      personalidades: table(pers, 'personalidad').map(r => ({ ...r, personalidad: (DATA.BOTS.PERSONALITIES[r.personalidad] || { name: r.personalidad }).name })),
      rasgos: table(traits, 'rasgo'),
      unidadesGanadoras: Object.entries(winUnits).sort((a, b) => b[1] - a[1])
        .map(([u, n]) => ({ unidad: DATA.UNITS[u].name, coste: DATA.UNITS[u].cost, enTablerosGanadores: pct(n / games) + '%' })),
    };
  }

  return {
    // partida (host)
    createGame, makeSlots, resolveRound, runAllBots,
    // acciones (humanos y bots)
    applyAction, validateAction, runBotTurn,
    // combate
    createCombat, stepCombat, simulateCombat, checkDeterminism, selfTest, generateOpponentBoard,
    // sin UI
    simulateGame, checkGameDeterminism, gameSummary, balanceStats, stateHash,
    // helpers de lectura (sin efectos)
    computeTraits, boardSnapshot, incomePreview, sellValue, countCopies, boardCount, benchFree,
    roundLabel, roundsInStage, xpNeeded, hexDist, def, clone, seedFrom,
  };
})();


if (typeof module !== 'undefined') module.exports = { DATA, SIM };
