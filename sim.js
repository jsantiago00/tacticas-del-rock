/* Tácticas del Rock — DATA + SIM.
 * Lo carga index.html con <script src="sim.js"> y Node con require("./sim.js").
 * Script clásico (no módulo ES) para que también funcione abriendo el archivo directo. */
'use strict';
/* =====================================================================
 * 1. DATA — todo lo editable del juego. Objetos planos, sin lógica.
 * ===================================================================== */
const DATA = {
  // Versión de datos: si cambia la forma del estado o el plantel, se sube. Un cliente con
  // otra versión no puede entrar a una sala (tiene que recargar la página).
  VERSION: 5,

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
    UNIT_DAMAGE_BY_STAR: [1, 1, 2],   // [★1, ★2, ★3]
    PLANNING_SECONDS: 30,              // timer opcional de la fase de planificación
    FLACO_FIGHTS_PER_ORIGIN: 3,        // El Flaco suma un origen cada tantas peleas
    // combate
    TICK_RATE: 30, COMBAT_SECONDS: 30,
    MOVE_TICKS: 14,          // ticks para moverse 1 hex
    CAST_TICKS: 10,          // ticks "ocupado" al castear
    MANA_LOCK_TICKS: 30,     // ticks sin ganar maná tras castear
    MANA_PER_ATTACK: 10, MANA_ON_HIT_CAP: 15,
    CRIT_CHANCE: 0.25, CRIT_MULT: 1.4,
    STAR_MULT: [1, 1.8, 3.2], // multiplicador de vida y daño por estrellas
    MOTOR_SECONDS: 5,        // duración del arranque de Motor
    CONFUSE_ON_HIT_SECONDS: 1.5, SLOW_SECONDS: 2, // Trabalenguas y Frío
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

  // ---------- Stats: plantilla por clase (coste 1) × escala por coste ----------
  // Una unidad usa la plantilla de su primera clase. `stats` en la unidad pisa valores puntuales.
  CLASS_STATS: {
    base:       { hp: 680, ad: 45, as: 0.60, range: 1, armor: 40, mr: 30, startMana: 40, maxMana: 90 },
    agitador:   { hp: 620, ad: 55, as: 0.70, range: 1, armor: 30, mr: 25, startMana: 20, maxMana: 70 },
    gyv:        { hp: 560, ad: 52, as: 0.75, range: 2, armor: 25, mr: 25, startMana: 10, maxMana: 70 },
    guitarhero: { hp: 500, ad: 56, as: 0.75, range: 3, armor: 20, mr: 20, startMana: 0, maxMana: 80 },
    voz:        { hp: 480, ad: 40, as: 0.65, range: 4, armor: 15, mr: 25, startMana: 20, maxMana: 70 },
    poeta:      { hp: 500, ad: 40, as: 0.65, range: 3, armor: 20, mr: 25, startMana: 30, maxMana: 80 },
    teclados:   { hp: 500, ad: 40, as: 0.65, range: 3, armor: 20, mr: 25, startMana: 30, maxMana: 80 },
    productor:  { hp: 470, ad: 40, as: 0.65, range: 4, armor: 15, mr: 25, startMana: 20, maxMana: 90 },
  },
  COST_SCALE: { 1: 1, 2: 1.15, 3: 1.32, 4: 1.5, 5: 1.72 }, // vida y daño de ataque
  DEF_PER_COST: 5,                                           // armadura y RM extra por coste sobre 1
  // Habilidades con `pow`: valor = base[coste] × pow × STAR[estrellas-1]
  //   DMG para daño (dmg); SUPPORT para curas y escudos (amount).
  ABILITY: { DMG: { 1: 180, 2: 240, 3: 320, 4: 420, 5: 540 }, SUPPORT: { 1: 150, 2: 200, 3: 270, 4: 350, 5: 450 }, STAR: [1, 1.5, 2.3] },

  // ---------- Rasgos ----------
  // kind: 'origen' | 'clase' | 'unica'. scope 'trait' = solo las unidades con el rasgo; 'team' = todo el equipo.
  // levels[i] = bonus del umbral i. Stats: hp, hpPct, adPct, asPct, armor, mr, ap, lifesteal, manaRegen,
  //   shield, startMana, critChance, critDmg, dodge (% esquive), regen (% vida/s), nthMult (cada 3er ataque),
  //   shred (armadura que quita por golpe), confuseChance, slowOnHit, castStackAS, berserk, startAS,
  //   revive (% vida al revivir), chargePerAttack, chargeTakenPct.
  // fx (efectos con evento): castShare {trait, mana} (al lanzar, los aliados con ese rasgo ganan maná),
  //   deathHealTrait {trait, pct} (al morir, cura a los aliados con ese rasgo), deathTeam {shield, adPct}.
  // duo: dúo de 2. solo: Solistas (bonus por cantidad, ver abajo).
  TRAITS: {
    // --- orígenes ---
    chiquitos:   { name: 'Chiquitos', kind: 'origen', icon: '🐭', color: '#7ad66a', scope: 'trait', breakpoints: [2, 4, 6],
                   desc: 'Diminutivos y bichitos. Los Chiquitos esquivan ataques básicos.',
                   levels: [{ dodge: 15 }, { dodge: 30 }, { dodge: 50 }] },
    fauna:       { name: 'Fauna', kind: 'origen', icon: '🐾', color: '#c98b3a', scope: 'trait', breakpoints: [3, 5, 7],
                   desc: 'Animales de todo tipo. La manada gana daño y velocidad de ataque.',
                   levels: [{ adPct: 15, asPct: 10 }, { adPct: 30, asPct: 20 }, { adPct: 55, asPct: 35 }] },
    almacen:     { name: 'Almacén', kind: 'origen', icon: '🛒', color: '#e0a03c', scope: 'trait', breakpoints: [3, 5, 7],
                   desc: 'Algo para comer o tomar. Los del Almacén regeneran vida por segundo.',
                   levels: [{ regen: 1.5 }, { regen: 3 }, { regen: 5 }] },
    arcoiris:    { name: 'Arco iris', kind: 'origen', icon: '🌈', color: '#e04fa0', scope: 'team', breakpoints: [2, 4],
                   desc: 'Color en el nombre. TODO tu equipo gana resistencia mágica.',
                   levels: [{ mr: 20 }, { mr: 50 }] },
    realeza:     { name: 'Realeza', kind: 'origen', icon: '👑', color: '#f5c542', scope: 'trait', breakpoints: [2, 4],
                   desc: 'Reyes, reinas, zares y caballeros. Ganan armadura y resistencia mágica.',
                   levels: [{ armor: 25, mr: 25 }, { armor: 60, mr: 60 }] },
    familia:     { name: 'Familia', kind: 'origen', icon: '👵', color: '#d48cff', scope: 'trait', breakpoints: [2, 4],
                   desc: 'La familia se cuida: cuando muere uno, el resto de la Familia se cura.',
                   levels: [{ fx: [{ type: 'deathHealTrait', trait: 'familia', pct: 25 }] }, { fx: [{ type: 'deathHealTrait', trait: 'familia', pct: 50 }] }] },
    averiados:   { name: 'Averiados', kind: 'origen', icon: '🤕', color: '#ff7a3c', scope: 'trait', breakpoints: [2, 4],
                   desc: 'Locas, rabiosos, paranoicos y rengos. Más daño cuanta menos vida les queda.',
                   levels: [{ berserk: 50 }, { berserk: 110 }] },
    motor:       { name: 'Motor', kind: 'origen', icon: '🏍️', color: '#9aa0a6', scope: 'trait', breakpoints: [2, 4],
                   desc: 'Fierros y máquinas. Arrancan acelerados: mucha velocidad de ataque los primeros segundos.',
                   levels: [{ startAS: 40 }, { startAS: 90 }] },
    matematica:  { name: 'Matemática', kind: 'origen', icon: '➗', color: '#4a7cff', scope: 'trait', breakpoints: [2, 4, 6],
                   desc: 'Suman, dividen y cuentan. Cada tercer ataque pega multiplicado.',
                   levels: [{ nthMult: 1.6 }, { nthMult: 2.2 }, { nthMult: 3 }] },
    combate:     { name: 'Combate', kind: 'origen', icon: '⚔️', color: '#ff4d4d', scope: 'trait', breakpoints: [2, 4],
                   desc: 'Armas y peleadores. Cada golpe le saca armadura al objetivo.',
                   levels: [{ shred: 4 }, { shred: 9 }] },
    celestial:   { name: 'Celestial', kind: 'origen', icon: '☁️', color: '#a8d8ff', scope: 'team', breakpoints: [2, 4],
                   desc: 'Paraísos y cielos. TODO tu equipo gana robo de vida.',
                   levels: [{ lifesteal: 8 }, { lifesteal: 18 }] },
    frio:        { name: 'Frío', kind: 'origen', icon: '❄️', color: '#7fe0ff', scope: 'trait', breakpoints: [2], duo: true,
                   desc: 'Dúo (Coldplay + Arctic Monkeys). Sus ataques congelan: bajan la velocidad de ataque del enemigo.',
                   levels: [{ slowOnHit: 30 }] },
    fraselarga:  { name: 'Frase larga', kind: 'origen', icon: '💬', color: '#c0c0c0', scope: 'trait', breakpoints: [2, 4],
                   desc: 'La banda se llama como una oración entera. Arrancan con maná extra.',
                   levels: [{ startMana: 25 }, { startMana: 50 }] },
    transmision: { name: 'Transmisión', kind: 'origen', icon: '📡', color: '#3cd6d6', scope: 'trait', breakpoints: [2, 4, 6],
                   desc: 'Radio, estéreo y contagio. Cuando uno lanza su habilidad, los demás Transmisión ganan maná.',
                   levels: [{ fx: [{ type: 'castShare', trait: 'transmision', mana: 10 }] }, { fx: [{ type: 'castShare', trait: 'transmision', mana: 20 }] }, { fx: [{ type: 'castShare', trait: 'transmision', mana: 32 }] }] },
    bff:         { name: 'BFF', kind: 'origen', icon: '🤝', color: '#ff9ad5', scope: 'trait', breakpoints: [2], duo: true,
                   desc: 'Dúo (Radiohead + The Smile). Cuando uno lanza su habilidad, el otro gana maná.',
                   levels: [{ fx: [{ type: 'castShare', trait: 'bff', mana: 35 }] }] },
    trabalenguas:{ name: 'Trabalenguas', kind: 'origen', icon: '👅', color: '#ff6fa8', scope: 'trait', breakpoints: [2, 4],
                   desc: 'Nombres difíciles de decir. Sus golpes pueden confundir: el objetivo ataca a cualquiera.',
                   levels: [{ confuseChance: 10 }, { confuseChance: 22 }] },
    freestyle:   { name: 'Freestyle', kind: 'origen', icon: '🎙️', color: '#ffd23c', scope: 'trait', breakpoints: [2, 3],
                   desc: 'Los que rapean. Cada habilidad que lanzan les suma velocidad de ataque (se acumula).',
                   levels: [{ castStackAS: 15 }, { castStackAS: 30 }] },
    solistas:    { name: 'Solistas', kind: 'origen', icon: '🧍', color: '#ffffff', scope: 'trait', breakpoints: [1],
                   desc: 'Rinden más cuanto menos Solistas haya: cada Solista gana vida, daño y poder según cuántos Solistas distintos tengas en el tablero.',
                   solo: [50, 30, 15, 5], // % de bonus con 1, 2, 3, 4 Solistas (5 o más: nada)
                   levels: [{}] },
    // --- clases ---
    base:        { name: 'Base Rítmica', kind: 'clase', icon: '🥁', color: '#a0a0a0', scope: 'trait', breakpoints: [2, 4, 6],
                   desc: 'Bajo y batería. Tanques de primera fila: ganan vida y armadura.',
                   levels: [{ hp: 250 }, { hp: 600, armor: 20 }, { hp: 1000, armor: 40 }] },
    agitador:    { name: 'Agitador', kind: 'clase', icon: '📣', color: '#ff7a3c', scope: 'trait', breakpoints: [2, 4, 6],
                   desc: 'Frontman que pone el cuerpo. Luchadores de primera fila: ganan daño y vida.',
                   levels: [{ adPct: 15, hp: 150 }, { adPct: 35, hp: 350 }, { adPct: 60, hp: 600 }] },
    gyv:         { name: 'Guitarra y Voz', kind: 'clase', icon: '🎸', color: '#ffb03c', scope: 'trait', breakpoints: [2, 4, 6],
                   desc: 'Cantan y tocan. Segunda fila: ganan velocidad de ataque.',
                   levels: [{ asPct: 15 }, { asPct: 35 }, { asPct: 60 }] },
    guitarhero:  { name: 'Guitar Hero', kind: 'clase', icon: '🤘', color: '#ff4d2e', scope: 'trait', breakpoints: [2, 4, 6],
                   desc: 'Guitarra líder. Tiradores de fondo: ganan probabilidad y daño de crítico.',
                   levels: [{ critChance: 15, critDmg: 20 }, { critChance: 30, critDmg: 40 }, { critChance: 50, critDmg: 70 }] },
    voz:         { name: 'Voz', kind: 'clase', icon: '🎤', color: '#ffd23c', scope: 'trait', breakpoints: [2, 4, 6],
                   desc: 'Lanzadores de fondo: ganan poder de habilidad.',
                   levels: [{ ap: 20 }, { ap: 45 }, { ap: 80 }] },
    poeta:       { name: 'Poeta', kind: 'clase', icon: '📜', color: '#c9a0ff', scope: 'trait', breakpoints: [2, 4, 6],
                   desc: 'Cantautores. Soporte de fondo: regeneran maná por segundo.',
                   levels: [{ manaRegen: 2 }, { manaRegen: 4 }, { manaRegen: 7 }] },
    teclados:    { name: 'Teclados', kind: 'clase', icon: '🎹', color: '#3cd6d6', scope: 'team', breakpoints: [2, 4],
                   desc: 'TODO tu equipo arranca el combate con un escudo.',
                   levels: [{ shield: 150 }, { shield: 350 }] },
    productor:   { name: 'Productor', kind: 'clase', icon: '🎛️', color: '#b05ae0', scope: 'team', breakpoints: [2, 4, 6],
                   desc: 'DJs y estudio. TODO tu equipo gana poder de habilidad.',
                   levels: [{ ap: 10 }, { ap: 20 }, { ap: 35 }] },
    // --- únicas (un solo músico; siempre activas si está en el tablero) ---
    saynomore:   { name: 'Say No More', kind: 'unica', icon: '🕶️', color: '#f5c542', scope: 'trait', breakpoints: [1],
                   desc: 'Charly García: su habilidad silencia a los enemigos cercanos (no pueden lanzar la suya).', levels: [{}] },
    showmustgoon:{ name: 'The Show Must Go On', kind: 'unica', icon: '🎭', color: '#f5c542', scope: 'trait', breakpoints: [1],
                   desc: 'Freddie Mercury: la primera vez que muere, vuelve con la mitad de la vida.', levels: [{ revive: 50 }] },
    graciastotales:{ name: 'Gracias Totales', kind: 'unica', icon: '🙏', color: '#f5c542', scope: 'trait', breakpoints: [1],
                   desc: 'Gustavo Cerati: al morir, les deja un escudo y más daño a todos sus aliados.',
                   levels: [{ fx: [{ type: 'deathTeam', shield: 350, adPct: 20 }] }] },
    misaricotera:{ name: 'Misa Ricotera', kind: 'unica', icon: '🌀', color: '#f5c542', scope: 'trait', breakpoints: [1],
                   desc: 'Indio Solari: arma un pogo que empuja a los enemigos cercanos y le da velocidad de ataque a sus aliados mientras dura.', levels: [{}] },
    elflaco:     { name: 'El Flaco', kind: 'unica', icon: '🍃', color: '#f5c542', scope: 'trait', breakpoints: [1],
                   desc: 'Luis Alberto Spinetta: al comprarlo elegís uno de sus 3 orígenes; cada 3 peleas suma otro.', levels: [{}] },
    hombreorquesta:{ name: 'Hombre Orquesta', kind: 'unica', icon: '🎼', color: '#f5c542', scope: 'trait', breakpoints: [1],
                   desc: 'Pedro Aznar: cuenta como dos clases a la vez (Base Rítmica y Teclados).', levels: [{}] },
    okcomputer:  { name: 'OK Computer', kind: 'unica', icon: '💻', color: '#f5c542', scope: 'trait', breakpoints: [1],
                   desc: 'Thom Yorke: hackea al enemigo más fuerte y lo pone a pelear para su equipo un rato.', levels: [{}] },
    drop:        { name: 'Drop', kind: 'unica', icon: '🔊', color: '#f5c542', scope: 'trait', breakpoints: [1],
                   desc: 'Skrillex: acumula carga con cada ataque y cada golpe recibido, y la suelta toda junta en su habilidad.',
                   levels: [{ chargePerAttack: 12, chargeTakenPct: 15 }] },
    vertigo:     { name: 'Vértigo', kind: 'unica', icon: '💫', color: '#f5c542', scope: 'trait', breakpoints: [1],
                   desc: 'Jonathon NG (EDEN): su habilidad marea a los enemigos y los hace atacar a cualquiera.', levels: [{}] },
    vientopatagonico:{ name: 'Viento Patagónico', kind: 'unica', icon: '🌬️', color: '#f5c542', scope: 'trait', breakpoints: [1],
                   desc: 'Lisandro Aristimuño: ráfagas que empujan a la fila de adelante enemiga hacia atrás.', levels: [{}] },
  },

  // ---------- Plantel (65) ----------
  // Tipos de habilidad: nuke, aoe (center self|target, radius), multi (count), all, push (distance),
  //   shield, teamShield, heal (count), healAll, buffAS (pct), teamBuffAS (pct),
  //   pogo (radius, pct), frontRow, mindControl (duration), drop (radius).
  // Efectos extra al pegar con la habilidad: stun, silence, confuse (segundos), push (hexes).
  // Valores en arrays = [★1, ★2, ★3]; `pow` usa DATA.ABILITY. `img` (opcional) = URL de retrato.
  UNITS: {
    // ---- coste 1 ----
    calamaro:      { name: 'Andrés Calamaro', short: 'Calamaro', cost: 1, origins: ['familia'], classes: ['teclados'], bands: ['Los Abuelos de la Nada'],
                     ability: { name: 'Alta Suciedad', type: 'teamShield', pow: 0.6, duration: 4 } },
    corgan:        { name: 'Billy Corgan', short: 'Corgan', cost: 1, origins: ['almacen'], classes: ['gyv'], bands: ['The Smashing Pumpkins'],
                     ability: { name: 'Siamese Dream', type: 'multi', count: 2, pow: 0.8 } },
    catriel:       { name: 'Catriel Ciavarella', short: 'Catriel', cost: 1, origins: ['matematica'], classes: ['base'], bands: ['Divididos'],
                     ability: { name: 'Redoble', type: 'nuke', pow: 0.6, stun: [1.25, 1.5, 2] } },
    grohl:         { name: 'Dave Grohl', short: 'Grohl', cost: 1, origins: ['combate', 'celestial'], classes: ['base'], bands: ['Nirvana', 'Foo Fighters'],
                     ability: { name: 'The Colour and the Shape', type: 'shield', pow: 1.2, duration: 4 } },
    duki:          { name: 'Duki', short: 'Duki', cost: 1, origins: ['freestyle', 'solistas'], classes: ['agitador'], bands: ['Solistas de los 2000'],
                     ability: { name: 'Súper Sangre Joven', type: 'buffAS', pct: [50, 70, 100], duration: 4 } },
    fabiana:       { name: 'Fabiana Cantilo', short: 'Fabiana', cost: 1, origins: ['familia', 'fraselarga'], classes: ['voz'], bands: ['Los Twist', 'Viuda e Hijas de Roque Enroll'],
                     ability: { name: 'La Fabi', type: 'nuke', pow: 1.1 } },
    ruizdiaz:      { name: 'Fernando Ruiz Díaz', short: 'Ruiz Díaz', cost: 1, origins: ['trabalenguas'], classes: ['gyv'], bands: ['Catupecu Machu'],
                     ability: { name: 'Cuentos Decapitados', type: 'aoe', center: 'target', radius: 1, pow: 0.7 } },
    marciano:      { name: 'Marciano Cantero', short: 'Marciano', cost: 1, origins: ['chiquitos', 'arcoiris'], classes: ['base'], bands: ['Enanitos Verdes'],
                     ability: { name: 'Contrarreloj', type: 'aoe', center: 'self', radius: 1, pow: 0.6 } },
    mateo:         { name: 'Mateo Sujatovich', short: 'Mateo', cost: 1, origins: ['fraselarga'], classes: ['poeta'], bands: ['Conociendo Rusia'],
                     ability: { name: 'Conociendo Rusia', type: 'heal', count: 1, pow: 0.9 } },
    miguelabuelo:  { name: 'Miguel Abuelo', short: 'M. Abuelo', cost: 1, origins: ['familia'], classes: ['voz'], bands: ['Los Abuelos de la Nada'],
                     ability: { name: 'Vasos y Besos', type: 'aoe', center: 'target', radius: 1, pow: 0.8 } },
    gimenez:       { name: 'Pablo Gimenez', short: 'Gimenez', cost: 1, origins: ['realeza'], classes: ['guitarhero'], bands: ['El Zar'],
                     ability: { name: 'Riff del Zar', type: 'multi', count: 2, pow: 0.7 } },
    collins:       { name: 'Phil Collins', short: 'Collins', cost: 1, origins: ['celestial', 'solistas'], classes: ['productor'], bands: ['Genesis', 'Solistas de afuera'],
                     ability: { name: 'No Jacket Required', type: 'aoe', center: 'target', radius: 1, pow: 0.8 } },
    pityfernandez: { name: 'Pity Fernández', short: 'P. Fernández', cost: 1, origins: ['familia'], classes: ['poeta'], bands: ['Las Pastillas del Abuelo'],
                     ability: { name: 'Crisis', type: 'heal', count: 2, pow: 0.6 } },
    vicentico:     { name: 'Vicentico', short: 'Vicentico', cost: 1, origins: ['motor'], classes: ['agitador'], bands: ['Los Fabulosos Cadillacs'],
                     ability: { name: 'Vasos Vacíos', type: 'aoe', center: 'self', radius: 1, pow: 0.6, stun: 0.5 } },
    // ---- coste 2 ----
    barilari:      { name: 'Adrián Barilari', short: 'Barilari', cost: 2, origins: ['fauna', 'arcoiris'], classes: ['voz'], bands: ['Rata Blanca'],
                     ability: { name: 'Magos, Espadas y Rosas', type: 'aoe', center: 'target', radius: 1, pow: 0.9 } },
    dargelos:      { name: 'Adrián Dárgelos', short: 'Dárgelos', cost: 2, origins: ['transmision'], classes: ['voz'], bands: ['Babasónicos'],
                     ability: { name: 'Jessico', type: 'nuke', pow: 1.3 } },
    turner:        { name: 'Alex Turner', short: 'Turner', cost: 2, origins: ['fauna', 'frio'], classes: ['gyv'], bands: ['Arctic Monkeys'],
                     ability: { name: 'AM', type: 'multi', count: 3, pow: 0.7 } },
    bahiano:       { name: 'Bahiano', short: 'Bahiano', cost: 2, origins: ['fauna'], classes: ['poeta'], bands: ['Los Pericos'],
                     ability: { name: 'Big Yuyo', type: 'healAll', pow: 0.45 } },
    chrismartin:   { name: 'Chris Martin', short: 'C. Martin', cost: 2, origins: ['frio', 'solistas'], classes: ['teclados'], bands: ['Coldplay', 'Solistas de afuera'],
                     ability: { name: 'Parachutes', type: 'teamShield', pow: 0.6, duration: 4 } },
    pertusi:       { name: 'Ciro Pertusi', short: 'Pertusi', cost: 2, origins: ['matematica', 'combate'], classes: ['agitador'], bands: ['Attaque 77'],
                     ability: { name: 'Dulce Navidad', type: 'push', pow: 0.8, distance: 2, stun: 0.5 } },
    dante:         { name: 'Dante Spinetta', short: 'Dante', cost: 2, origins: ['trabalenguas'], classes: ['guitarhero'], bands: ['Illya Kuryaki and the Valderramas'],
                     ability: { name: 'Chaco', type: 'multi', count: 3, pow: 0.6 } },
    horvilleur:    { name: 'Emmanuel Horvilleur', short: 'Horvilleur', cost: 2, origins: ['trabalenguas'], classes: ['productor'], bands: ['Illya Kuryaki and the Valderramas'],
                     ability: { name: 'Leche', type: 'aoe', center: 'target', radius: 2, pow: 0.55 } },
    cordera:       { name: 'Gustavo Cordera', short: 'Cordera', cost: 2, origins: ['trabalenguas'], classes: ['agitador'], bands: ['Bersuit Vergarabat'],
                     ability: { name: 'Libertinaje', type: 'aoe', center: 'self', radius: 1, pow: 0.8 } },
    luca:          { name: 'Luca Prodan', short: 'Luca', cost: 2, origins: ['matematica'], classes: ['agitador'], bands: ['Sumo'],
                     ability: { name: 'Llegando los Monos', type: 'push', pow: 0.7, distance: 1, stun: 1 } },
    pityalvarez:   { name: 'Pity Álvarez', short: 'Pity', cost: 2, origins: ['familia', 'averiados'], classes: ['gyv'], bands: ['Viejas Locas'],
                     ability: { name: 'Especial', type: 'buffAS', pct: [50, 70, 110], duration: 4 } },
    plant:         { name: 'Robert Plant', short: 'Plant', cost: 2, origins: ['motor'], classes: ['voz'], bands: ['Led Zeppelin'],
                     ability: { name: 'Golden God', type: 'aoe', center: 'target', radius: 1, pow: 0.9 } },
    zeta:          { name: 'Zeta Bosio', short: 'Zeta', cost: 2, origins: ['almacen', 'transmision'], classes: ['base'], bands: ['Soda Stereo'],
                     ability: { name: 'Signos', type: 'shield', pow: 1.3, duration: 4 } },
    // ---- coste 3 ----
    ciromartinez:  { name: 'Andrés Ciro Martínez', short: 'Ciro', cost: 3, origins: ['chiquitos'], classes: ['agitador'], bands: ['Los Piojos'],
                     ability: { name: 'Ritual', type: 'aoe', center: 'self', radius: 1, pow: 0.8, stun: 0.75 } },
    brianmay:      { name: 'Brian May', short: 'B. May', cost: 3, origins: ['realeza'], classes: ['guitarhero'], bands: ['Queen'],
                     ability: { name: 'Red Special', type: 'multi', count: 3, pow: 0.8 } },
    chizzo:        { name: 'Chizzo Nápoli', short: 'Chizzo', cost: 3, origins: ['averiados'], classes: ['gyv'], bands: ['La Renga'],
                     ability: { name: 'Detonador de Sueños', type: 'buffAS', pct: [60, 80, 120], duration: 5 } },
    albarn:        { name: 'Damon Albarn', short: 'Albarn', cost: 3, origins: ['fauna'], classes: ['productor'], bands: ['Blur', 'Gorillaz'],
                     ability: { name: 'Demon Days', type: 'aoe', center: 'target', radius: 2, pow: 0.65 } },
    gilmour:       { name: 'David Gilmour', short: 'Gilmour', cost: 3, origins: ['arcoiris'], classes: ['guitarhero'], bands: ['Pink Floyd'],
                     ability: { name: 'The Wall', type: 'aoe', center: 'target', radius: 1, pow: 1.0 } },
    brancciari:    { name: 'Emiliano Brancciari', short: 'Brancciari', cost: 3, origins: ['fraselarga'], classes: ['poeta'], bands: ['No Te Va Gustar'],
                     ability: { name: 'Por lo Menos Hoy', type: 'teamShield', pow: 0.7, duration: 4 } },
    moura:         { name: 'Federico Moura', short: 'Moura', cost: 3, origins: ['transmision'], classes: ['voz'], bands: ['Virus'],
                     ability: { name: 'Locura', type: 'nuke', pow: 1.5 } },
    lennon:        { name: 'John Lennon', short: 'Lennon', cost: 3, origins: ['chiquitos'], classes: ['gyv'], bands: ['The Beatles'],
                     ability: { name: 'Imagine', type: 'multi', count: 3, pow: 0.7 } },
    johansen:      { name: 'Kevin Johansen', short: 'Johansen', cost: 3, origins: ['solistas'], classes: ['poeta'], bands: ['Solistas de los 90'],
                     ability: { name: 'Sur o No Sur', type: 'heal', count: 2, pow: 0.8 } },
    bertoldi:      { name: 'Marilina Bertoldi', short: 'Bertoldi', cost: 3, origins: ['solistas'], classes: ['gyv'], bands: ['Solistas de los 2000'],
                     ability: { name: 'Prender un Fuego', type: 'nuke', pow: 1.2 } },
    mccartney:     { name: 'Paul McCartney', short: 'McCartney', cost: 3, origins: ['chiquitos'], classes: ['base'], bands: ['The Beatles'],
                     ability: { name: 'Band on the Run', type: 'push', pow: 0.7, distance: 1, stun: 1 } },
    barrionuevo:   { name: 'Santiago Barrionuevo', short: 'Barrionuevo', cost: 3, origins: ['motor', 'combate', 'fraselarga'], classes: ['base'], bands: ['Él Mató a un Policía Motorizado', 'Santiago Motorizado'],
                     ability: { name: 'La Dinastía Scorpio', type: 'shield', pow: 1.4, duration: 5 } },
    teysera:       { name: 'Sebastián Teysera', short: 'Teysera', cost: 3, origins: ['fauna'], classes: ['agitador'], bands: ['La Vela Puerca'],
                     ability: { name: 'De Bichos y Flores', type: 'aoe', center: 'self', radius: 1, pow: 0.9 } },
    slash:         { name: 'Slash', short: 'Slash', cost: 3, origins: ['combate'], classes: ['guitarhero'], bands: ["Guns N' Roses"],
                     ability: { name: 'Appetite for Destruction', type: 'nuke', pow: 1.4 } },
    // ---- coste 4 ----
    lebon:         { name: 'David Lebón', short: 'Lebón', cost: 4, origins: ['fauna', 'almacen', 'averiados'], classes: ['guitarhero'], bands: ['Serú Girán', 'Pescado Rabioso'],
                     ability: { name: 'El Ruso', type: 'aoe', center: 'target', radius: 1, pow: 1.0 } },
    eminem:        { name: 'Eminem', short: 'Eminem', cost: 4, origins: ['almacen', 'freestyle', 'solistas'], classes: ['agitador'], bands: ['Raperos 2000', 'Solistas de afuera'],
                     ability: { name: 'Slim Shady', type: 'buffAS', pct: [70, 90, 140], duration: 5 } },
    fito:          { name: 'Fito Páez', short: 'Fito', cost: 4, origins: ['solistas'], classes: ['teclados'], bands: ['Solistas de los 80'],
                     ability: { name: 'El Amor Después del Amor', type: 'heal', count: 2, pow: 0.9 } },
    santaolalla:   { name: 'Gustavo Santaolalla', short: 'Santaolalla', cost: 4, origins: ['arcoiris', 'celestial'], classes: ['productor'], bands: ['Arco Iris'],
                     ability: { name: 'Ronroco', type: 'aoe', center: 'target', radius: 2, pow: 0.75 } },
    greenwood:     { name: 'Jonny Greenwood', short: 'Greenwood', cost: 4, origins: ['transmision', 'bff'], classes: ['productor'], bands: ['Radiohead', 'The Smile'],
                     ability: { name: 'There Will Be Blood', type: 'multi', count: 4, pow: 0.6 } },
    drexler:       { name: 'Jorge Drexler', short: 'Drexler', cost: 4, origins: ['solistas'], classes: ['poeta'], bands: ['Solistas de afuera'],
                     ability: { name: 'Eco', type: 'healAll', pow: 0.55 } },
    baglietto:     { name: 'Juan Carlos Baglietto', short: 'Baglietto', cost: 4, origins: ['solistas'], classes: ['voz'], bands: ['Solistas de los 80'],
                     ability: { name: 'Tiempos Difíciles', type: 'aoe', center: 'target', radius: 1, pow: 1.0 } },
    cobain:        { name: 'Kurt Cobain', short: 'Cobain', cost: 4, origins: ['celestial'], classes: ['gyv'], bands: ['Nirvana'],
                     ability: { name: 'Nevermind', type: 'aoe', center: 'target', radius: 1, pow: 0.9 } },
    gieco:         { name: 'León Gieco', short: 'Gieco', cost: 4, origins: ['solistas'], classes: ['poeta'], bands: ['Solistas de los 60 y 70'],
                     ability: { name: 'De Ushuaia a La Quiaca', type: 'healAll', pow: 0.65 } },
    pappo:         { name: 'Pappo', short: 'Pappo', cost: 4, origins: ['fauna'], classes: ['guitarhero'], bands: ['Los Gatos', "Pappo's Blues", 'Riff'],
                     ability: { name: 'El Carpo', type: 'aoe', center: 'target', radius: 1, pow: 1.1 } },
    iorio:         { name: 'Ricardo Iorio', short: 'Iorio', cost: 4, origins: ['motor', 'matematica'], classes: ['base'], bands: ['V8', 'Hermética', 'Almafuerte'],
                     ability: { name: 'Ácido Argentino', type: 'aoe', center: 'self', radius: 1, pow: 0.8, stun: 1 } },
    mollo:         { name: 'Ricardo Mollo', short: 'Mollo', cost: 4, origins: ['matematica'], classes: ['guitarhero'], bands: ['Sumo', 'Divididos'],
                     ability: { name: 'La Era de la Boludez', type: 'multi', count: 4, pow: 0.8 } },
    skay:          { name: 'Skay Beilinson', short: 'Skay', cost: 4, origins: ['chiquitos', 'almacen', 'realeza'], classes: ['guitarhero'], bands: ['Patricio Rey y sus Redonditos de Ricota'],
                     ability: { name: 'La Marca de Caín', type: 'aoe', center: 'target', radius: 2, pow: 0.7 } },
    wos:           { name: 'Wos', short: 'Wos', cost: 4, origins: ['freestyle', 'solistas'], classes: ['poeta'], bands: ['Solistas de los 2000'],
                     ability: { name: 'Caravana', type: 'heal', count: 3, pow: 0.6 } },
    // ---- coste 5 ----
    charly:        { name: 'Charly García', short: 'Charly', cost: 5, origins: ['motor', 'fraselarga'], classes: ['teclados'], unique: 'saynomore', bands: ['Sui Generis', 'La Máquina de Hacer Pájaros', 'Serú Girán'],
                     ability: { name: 'Say No More', type: 'aoe', center: 'self', radius: 2, pow: 0.8, silence: [2, 2.5, 4] } },
    freddie:       { name: 'Freddie Mercury', short: 'Freddie', cost: 5, origins: ['realeza'], classes: ['voz'], unique: 'showmustgoon', bands: ['Queen'],
                     ability: { name: 'A Night at the Opera', type: 'all', pow: 0.7 } },
    cerati:        { name: 'Gustavo Cerati', short: 'Cerati', cost: 5, origins: ['almacen', 'transmision'], classes: ['gyv'], unique: 'graciastotales', bands: ['Soda Stereo'],
                     ability: { name: 'Bocanada', type: 'multi', count: 5, pow: 0.85 } },
    indio:         { name: 'Indio Solari', short: 'Indio', cost: 5, origins: ['chiquitos', 'almacen', 'realeza'], classes: ['agitador'], unique: 'misaricotera', bands: ['Patricio Rey y sus Redonditos de Ricota'],
                     ability: { name: 'Misa Ricotera', type: 'pogo', radius: 2, pow: 0.6, pct: [40, 60, 150], duration: 5 } },
    ng:            { name: 'Jonathon NG', short: 'EDEN', cost: 5, origins: ['celestial', 'solistas'], classes: ['productor'], unique: 'vertigo', bands: ['EDEN', 'Solistas de afuera'],
                     ability: { name: 'Vertigo', type: 'aoe', center: 'target', radius: 2, pow: 0.6, confuse: [2, 2.5, 4] } },
    lisandro:      { name: 'Lisandro Aristimuño', short: 'Lisandro', cost: 5, origins: ['solistas'], classes: ['poeta'], unique: 'vientopatagonico', bands: ['Solistas de los 2000'],
                     ability: { name: 'Viento Patagónico', type: 'frontRow', pow: 0.7, push: 2, stun: 0.5 } },
    spinetta:      { name: 'Luis Alberto Spinetta', short: 'Spinetta', cost: 5, origins: ['fauna', 'almacen', 'averiados'], classes: ['guitarhero'], unique: 'elflaco', bands: ['Almendra', 'Pescado Rabioso', 'Invisible', 'Spinetta Jade'],
                     ability: { name: 'Artaud', type: 'aoe', center: 'target', radius: 2, pow: 1.0 } },
    aznar:         { name: 'Pedro Aznar', short: 'Aznar', cost: 5, origins: ['matematica', 'solistas'], classes: ['base', 'teclados'], unique: 'hombreorquesta', bands: ['Serú Girán', 'Tango 4', 'Solista'],
                     ability: { name: 'Fotos de Tokyo', type: 'teamShield', pow: 0.9, duration: 5 } },
    skrillex:      { name: 'Skrillex', short: 'Skrillex', cost: 5, origins: ['solistas'], classes: ['productor'], unique: 'drop', bands: ['Solistas de afuera'],
                     ability: { name: 'Drop', type: 'drop', radius: 2, pow: 0.6 } },
    thom:          { name: 'Thom Yorke', short: 'Thom', cost: 5, origins: ['transmision', 'bff'], classes: ['voz'], unique: 'okcomputer', bands: ['Radiohead', 'The Smile'],
                     ability: { name: 'OK Computer', type: 'mindControl', pow: 0.5, duration: [3, 4, 8] } },
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
    sonidista: { name: 'Sonidista', short: 'Sonidista', cost: 0, origins: [], classes: [], icon: '🎚️',
                 hp: 350, ad: 25, as: 0.6, range: 3, armor: 10, mr: 10, startMana: 0, maxMana: 0 },
    patovica:  { name: 'Patovica', short: 'Patovica', cost: 0, origins: [], classes: [], icon: '🕶️',
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
 *  Unit   = { uid, unitId, star, flaco?:{chosen:[origen], fights} }
 *
 *  ALEATORIEDAD
 *  - s.rng: cosas de la ronda (emparejamientos, orden de los bots, semillas de combate,
 *    rival generado). Solo lo consumen createGame / resolveRound / runAllBots, que corre el host.
 *  - p.rng: la tienda de cada jugador (rerolls). Así el reroll de uno no le cambia
 *    la tienda a otro.
 *  - cs.rng: todo lo aleatorio de un combate (críticos, esquives, confusión, objetivos).
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
  const TRAIT_IDS = Object.keys(DATA.TRAITS);
  const ORIGINS = TRAIT_IDS.filter(t => DATA.TRAITS[t].kind === 'origen').sort();

  // Completa cada unidad: lista de rasgos y stats (plantilla de clase × escala por coste).
  for (const id of UNIT_IDS) {
    const d = DATA.UNITS[id];
    d.traits = [...d.origins, ...d.classes, ...(d.unique ? [d.unique] : [])];
    const t = DATA.CLASS_STATS[d.classes[0]], m = DATA.COST_SCALE[d.cost], extra = (d.cost - 1) * DATA.DEF_PER_COST;
    Object.assign(d, {
      hp: Math.round(t.hp * m), ad: Math.round(t.ad * m), as: t.as, range: t.range,
      armor: t.armor + extra, mr: t.mr + extra, startMana: t.startMana, maxMana: t.maxMana,
    }, d.stats || {});
  }
  for (const id of Object.keys(DATA.CREEPS)) DATA.CREEPS[id].traits = [];

  const def = id => DATA.UNITS[id] || DATA.CREEPS[id];
  const clone = o => JSON.parse(JSON.stringify(o));
  const copiesOf = star => (star === 1 ? 1 : star === 2 ? 3 : 9);
  const byStage = (table, stage) => { // valor de la etapa, o el de la última etapa definida
    const keys = Object.keys(table).filter(k => k !== 'default').map(Number).sort((a, b) => a - b);
    let k = keys[0];
    for (const x of keys) if (x <= stage) k = x;
    return table[k];
  };
  // Valor de una habilidad para una unidad (arrays por estrella, número fijo o `pow` × base por coste).
  function abilityValue(unitId, key, star) {
    const d = def(unitId), ab = d.ability, v = ab && ab[key];
    if (Array.isArray(v)) return v[star - 1];
    if (typeof v === 'number') return v;
    if (!ab || ab.pow == null) return 0;
    const base = key === 'dmg' ? DATA.ABILITY.DMG : DATA.ABILITY.SUPPORT;
    return Math.round(base[d.cost] * ab.pow * DATA.ABILITY.STAR[star - 1]);
  }

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

  // ---------- El Flaco (Spinetta): orígenes elegidos ----------
  // Al comprarlo se elige 1 de sus orígenes; cada FLACO_FIGHTS_PER_ORIGIN peleas en el tablero se habilita otro.
  const isFlaco = unitId => !!DATA.UNITS[unitId] && DATA.UNITS[unitId].unique === 'elflaco';
  const flacoSlots = u => Math.min(def(u.unitId).origins.length, 1 + Math.floor(u.flaco.fights / C.FLACO_FIGHTS_PER_ORIGIN));
  const flacoPending = u => !!(u && u.flaco && u.flaco.chosen.length < flacoSlots(u));
  // Elección automática (si no eligió a tiempo, y la que usan los bots): el origen que más suma en su tablero.
  function pickFlacoOrigin(p, u) {
    const d = def(u.unitId), options = d.origins.filter(o => !u.flaco.chosen.includes(o));
    let best = options[0], bestScore = -1;
    for (const o of options) {
      const seen = {};
      let n = 0;
      for (const x of p.board) if (x && x !== u && x.unitId !== u.unitId && !seen[x.unitId] && unitOrigins(x).includes(o)) { seen[x.unitId] = 1; n++; }
      if (n > bestScore) { bestScore = n; best = o; }
    }
    return best;
  }
  const unitOrigins = u => (u.flaco ? u.flaco.chosen : def(u.unitId).origins);

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
          if (keep.u.flaco) { // conserva el progreso de El Flaco más avanzado
            const best = [keep.u, a.u, b.u].sort((x, y) => y.flaco.chosen.length - x.flaco.chosen.length || y.flaco.fights - x.flaco.fights)[0];
            keep.u.flaco = clone(best.flaco);
          }
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
  // {type:'FLACO',loc,origin}  (elegir un origen para El Flaco)
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
      case 'FLACO': {
        if (!validLoc(a.loc)) return 'Ubicación inválida';
        const u = getAt(p, a.loc);
        if (!u || !u.flaco) return 'Esa unidad no es El Flaco';
        if (!flacoPending(u)) return 'Todavía no puede sumar otro origen';
        if (!def(u.unitId).origins.includes(a.origin) || u.flaco.chosen.includes(a.origin)) return 'Origen inválido';
        return null;
      }
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
        if (isFlaco(id)) u.flaco = { chosen: [], fights: 0 };
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
      case 'FLACO': getAt(p, a.loc).flaco.chosen.push(a.origin); break;
    }
  }
  function applyAction(state, pid, a) {
    if (validateAction(state, pid, a)) return state; // inválida: mismo objeto, sin cambios
    const s = clone(state);
    applyInPlace(s, pid, a);
    return s;
  }

  // ---------- Rasgos ----------
  // Rasgos de una entrada de tablero (El Flaco usa solo los orígenes elegidos).
  function traitsOfEntry(e) {
    const d = def(e.unitId);
    const origins = Array.isArray(e.origins) ? e.origins : (d.origins || []);
    return [...origins, ...(d.classes || []), ...(d.unique ? [d.unique] : [])];
  }
  function soloBonus(n) { return n >= 1 ? (DATA.TRAITS.solistas.solo[n - 1] || 0) : 0; }
  function computeTraits(snap) { // cuenta músicos DISTINTOS
    const seen = {}, counts = {};
    for (const e of snap) {
      if (seen[e.unitId]) continue;
      seen[e.unitId] = true;
      for (const t of traitsOfEntry(e)) counts[t] = (counts[t] || 0) + 1;
    }
    const res = {};
    for (const t of Object.keys(counts).sort()) {
      const T = DATA.TRAITS[t], bp = T.breakpoints;
      if (T.solo) { const b = soloBonus(counts[t]); res[t] = { count: counts[t], level: b > 0 ? 0 : -1, next: null, missing: 0, bonus: b }; continue; }
      let level = -1;
      bp.forEach((b, i) => { if (counts[t] >= b) level = i; });
      const next = bp[level + 1] ?? null;
      res[t] = { count: counts[t], level, next, missing: next ? next - counts[t] : 0 };
    }
    return res;
  }
  function boardSnapshot(p) {
    const out = [];
    p.board.forEach((u, i) => {
      if (!u) return;
      const e = { unitId: u.unitId, star: u.star, r: Math.floor(i / COLS), c: i % COLS };
      if (u.flaco) e.origins = u.flaco.chosen.slice();
      out.push(e);
    });
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
        const e = { unitId, star, r, c };
        if (isFlaco(unitId)) e.origins = [def(unitId).origins[rngInt(rngObj, def(unitId).origins.length)]];
        units.push(e);
        break;
      }
    }
    return { name: O.NAMES[rngInt(rngObj, O.NAMES.length)], units };
  }

  // ---------- Combate (ticks fijos, determinista) ----------
  // El lado A ocupa filas 4..7 (su fila 0 = fila 4), el lado B filas 0..3 rotado 180°.
  // `team` es el equipo original (define quién gana); `side` es para quién pelea ahora
  // (cambia con el control mental de OK Computer).
  function makeCombatUnit(cid, side, e, maxTicks) {
    const d = def(e.unitId), m = C.STAR_MULT[e.star - 1];
    const R = side === 0 ? ROWS + e.r : ROWS - 1 - e.r;
    const Cc = side === 0 ? e.c : COLS - 1 - e.c;
    return {
      cid, team: side, side, unitId: e.unitId, star: e.star, traits: traitsOfEntry(e),
      r: R, c: Cc, fromR: R, fromC: Cc, moveStart: 0, moveEnd: 0,
      maxHp: d.hp * m, hp: 0, ad: d.ad * m, as: d.as, range: d.range, armor: d.armor, mr: d.mr,
      mana: d.startMana || 0, maxMana: d.ability ? d.maxMana : 0, ap: 0,
      shield: 0, shieldUntil: 0, lifesteal: 0, manaRegen: 0,
      critChance: C.CRIT_CHANCE, critMult: C.CRIT_MULT, asBuffs: [],
      dodge: 0, regen: 0, nthMult: 1, attackCount: 0, shred: 0, confuseChance: 0, slowOnHit: 0, castStackAS: 0,
      berserk: 0, startAS: 0, revive: 0, revived: false, chargePerAttack: 0, chargeTakenPct: 0, charge: 0, fx: [],
      stunUntil: 0, busyUntil: 0, manaLockUntil: 0, silencedUntil: 0, confusedUntil: 0, controlledUntil: 0,
      nextAttack: 0, target: -1, alive: true, dmgDealt: 0,
      _maxTicks: maxTicks,
    };
  }
  function applyMods(u, mods) {
    for (const k of Object.keys(mods).sort()) {
      const v = mods[k];
      if (k === 'hp') u.maxHp += v;
      else if (k === 'hpPct') u.maxHp *= 1 + v / 100;
      else if (k === 'adPct') u.ad *= 1 + v / 100;
      else if (k === 'asPct') u.as *= 1 + v / 100;
      else if (k === 'critChance') u.critChance += v / 100;
      else if (k === 'critDmg') u.critMult += v / 100;
      else if (k === 'nthMult') u.nthMult = Math.max(u.nthMult, v);
      else if (k === 'startMana') u.mana += v;
      else if (k === 'shield') { u.shield += v; u.shieldUntil = u._maxTicks + 1; }
      else if (k === 'fx') u.fx.push(...v);
      else u[k] += v; // armor, mr, ap, lifesteal, manaRegen, dodge, regen, shred, confuseChance, slowOnHit, ...
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
      const tr = traits[t], T = DATA.TRAITS[t];
      if (tr.level < 0) continue;
      const targets = T.scope === 'team' ? mine : mine.filter(u => u.traits.includes(t));
      const mods = T.solo ? { hpPct: tr.bonus, adPct: tr.bonus, ap: tr.bonus } : T.levels[tr.level];
      for (const u of targets) applyMods(u, mods);
    }
    for (const u of mine) {
      u.hp = u.maxHp;
      u.mana = Math.min(u.mana, u.maxMana);
      if (u.startAS) u.asBuffs.push({ pct: u.startAS, until: Math.round(C.MOTOR_SECONDS * TR) });
      u.nextAttack = Math.round(TR / u.as / 2);
    }
  }
  function createCombat(snapA, snapB, seed) {
    const cs = { tick: 0, rng: seed >>> 0, hash: 2166136261, maxTicks: C.COMBAT_SECONDS * TR, units: [], events: [], done: false, winner: null };
    addSide(cs, snapA, 0);
    addSide(cs, snapB, 1);
    return cs;
  }
  const attackSpeed = u => Math.max(0.2, Math.min(5, u.as * (1 + u.asBuffs.reduce((n, b) => n + b.pct, 0) / 100)));
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
  const alliesOf = (cs, u) => cs.units.filter(x => x.alive && x.side === u.side);
  function dealDamage(cs, src, tgt, raw, kind, T, crit) {
    if (!tgt.alive) return 0;
    const res = Math.max(0, kind === 'phys' ? tgt.armor : tgt.mr);
    let dmg = raw * 100 / (100 + res);
    const total = dmg;
    if (tgt.shield > 0) { const ab = Math.min(tgt.shield, dmg); tgt.shield -= ab; dmg -= ab; }
    tgt.hp -= dmg;
    gainMana(tgt, Math.min(C.MANA_ON_HIT_CAP, raw * 0.01 + total * 0.03), T);
    if (tgt.chargeTakenPct) tgt.charge += total * tgt.chargeTakenPct / 100;
    src.dmgDealt += total;
    cs.events.push({ t: 'dmg', s: src.cid, d: tgt.cid, a: Math.round(total), k: kind, c: crit ? 1 : 0 });
    if (tgt.hp <= 0) unitDies(cs, tgt, T);
    return total;
  }
  // Muerte: revivir una vez (Freddie) y efectos al morir (Familia, Gracias Totales).
  function unitDies(cs, u, T) {
    if (u.revive > 0 && !u.revived) {
      u.revived = true;
      u.hp = u.maxHp * u.revive / 100;
      u.stunUntil = 0; u.silencedUntil = 0; u.confusedUntil = 0;
      cs.events.push({ t: 'revive', d: u.cid });
      return;
    }
    u.hp = 0; u.alive = false;
    cs.events.push({ t: 'die', d: u.cid });
    for (const f of u.fx) {
      if (f.type === 'deathHealTrait') {
        for (const a of alliesOf(cs, u)) if (a.traits.includes(f.trait)) healUnit(cs, a, a.maxHp * f.pct / 100);
      } else if (f.type === 'deathTeam') {
        for (const a of alliesOf(cs, u)) { addShield(a, f.shield, cs.maxTicks + 1); a.ad *= 1 + f.adPct / 100; }
        cs.events.push({ t: 'legacy', s: u.cid });
      }
    }
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
  function silenceUnit(cs, u, sec, T) {
    if (!u.alive) return;
    u.silencedUntil = Math.max(u.silencedUntil, T + Math.round(sec * TR));
    cs.events.push({ t: 'silence', d: u.cid });
  }
  function confuseUnit(cs, u, sec, T) {
    if (!u.alive) return;
    u.confusedUntil = Math.max(u.confusedUntil, T + Math.round(sec * TR));
    u.target = -1;
    cs.events.push({ t: 'confuse', d: u.cid });
  }
  function slowUnit(cs, u, pct, sec, T) {
    if (!u.alive) return;
    const had = u.asBuffs.some(b => b.slow);
    u.asBuffs = u.asBuffs.filter(b => !b.slow);
    u.asBuffs.push({ pct: -pct, until: T + Math.round(sec * TR), slow: 1 });
    if (!had) cs.events.push({ t: 'slow', d: u.cid });
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
    cs.events.push({ t: 'atk', s: u.cid, d: tgt.cid });
    gainMana(u, C.MANA_PER_ATTACK, T);
    if (u.chargePerAttack) u.charge += u.chargePerAttack;
    if (tgt.dodge > 0 && rngNext(cs) < tgt.dodge / 100) { cs.events.push({ t: 'miss', d: tgt.cid }); return; }
    let dmg = u.ad, crit = false;
    if (u.berserk) dmg *= 1 + u.berserk / 100 * (1 - u.hp / u.maxHp);
    u.attackCount++;
    if (u.nthMult > 1 && u.attackCount % 3 === 0) dmg *= u.nthMult;
    if (rngNext(cs) < u.critChance) { dmg *= u.critMult; crit = true; }
    const dealt = dealDamage(cs, u, tgt, dmg, 'phys', T, crit);
    if (u.lifesteal > 0) healUnit(cs, u, dealt * u.lifesteal / 100);
    if (u.shred && tgt.alive) tgt.armor = Math.max(-30, tgt.armor - u.shred);
    if (u.confuseChance && tgt.alive && rngNext(cs) < u.confuseChance / 100) confuseUnit(cs, tgt, C.CONFUSE_ON_HIT_SECONDS, T);
    if (u.slowOnHit && tgt.alive) slowUnit(cs, tgt, u.slowOnHit, C.SLOW_SECONDS, T);
  }
  // El "más fuerte" para OK Computer: más costoso × copias, después más vida máxima.
  function strongest(list) {
    return list.slice().sort((a, b) => def(b.unitId).cost * copiesOf(b.star) - def(a.unitId).cost * copiesOf(a.star) || b.maxHp - a.maxHp || a.cid - b.cid)[0];
  }
  function castAbility(cs, u, tgt, T) {
    const ab = def(u.unitId).ability;
    const si = u.star - 1, val = v => (Array.isArray(v) ? v[si] : v), amp = 1 + u.ap / 100;
    const dmgV = abilityValue(u.unitId, 'dmg', u.star), amtV = abilityValue(u.unitId, 'amount', u.star);
    const dur = sec => T + Math.round(val(sec) * TR);
    u.mana = 0; u.manaLockUntil = T + C.MANA_LOCK_TICKS; u.busyUntil = T + C.CAST_TICKS;
    cs.events.push({ t: 'cast', s: u.cid, n: ab.name });
    const enemies = cs.units.filter(x => x.alive && x.side !== u.side);
    const allies = alliesOf(cs, u);
    const hit = (e, extra = 0) => {
      if (!e.alive) return;
      dealDamage(cs, u, e, dmgV * amp + extra, 'magic', T, false);
      if (ab.stun) stunUnit(cs, e, val(ab.stun), T);
      if (ab.silence) silenceUnit(cs, e, val(ab.silence), T);
      if (ab.confuse) confuseUnit(cs, e, val(ab.confuse), T);
      if (ab.push) pushUnit(cs, u, e, val(ab.push), T);
    };
    switch (ab.type) {
      case 'nuke': hit(tgt); break;
      case 'aoe': { const center = ab.center === 'self' ? u : tgt; enemies.filter(e => udist(center, e) <= (ab.radius || 1)).forEach(e => hit(e)); break; }
      case 'multi': { const pool = enemies.slice(); for (let k = 0; k < ab.count && pool.length; k++) hit(pool.splice(rngInt(cs, pool.length), 1)[0]); break; }
      case 'all': enemies.forEach(e => hit(e)); break;
      case 'push': hit(tgt); pushUnit(cs, u, tgt, ab.distance || 1, T); break;
      case 'shield': addShield(u, amtV * amp, dur(ab.duration)); break;
      case 'teamShield': allies.forEach(a => addShield(a, amtV * amp, dur(ab.duration))); break;
      case 'heal': allies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.cid - b.cid)
        .slice(0, ab.count || 1).forEach(a => healUnit(cs, a, amtV * amp)); break;
      case 'healAll': allies.forEach(a => healUnit(cs, a, amtV * amp)); break;
      case 'buffAS': u.asBuffs.push({ pct: val(ab.pct), until: dur(ab.duration) }); break;
      case 'teamBuffAS': allies.forEach(a => a.asBuffs.push({ pct: val(ab.pct), until: dur(ab.duration) })); break;
      case 'pogo': // Misa Ricotera: empuja a los cercanos y acelera a los aliados mientras dura
        for (const e of enemies.filter(e => udist(u, e) <= (ab.radius || 2))) { hit(e); pushUnit(cs, u, e, 1, T); }
        allies.forEach(a => a.asBuffs.push({ pct: val(ab.pct), until: dur(ab.duration) }));
        break;
      case 'frontRow': { // Viento Patagónico: toda la fila enemiga más cercana
        if (!enemies.length) break;
        let near = enemies[0];
        for (const e of enemies) if (udist(u, e) < udist(u, near)) near = e;
        enemies.filter(e => e.r === near.r).forEach(e => hit(e));
        break;
      }
      case 'mindControl': { // OK Computer: el enemigo más fuerte pelea para nosotros un rato
        if (!enemies.length) break;
        const e = strongest(enemies);
        hit(e);
        if (e.alive) {
          e.side = u.side; e.controlledUntil = dur(ab.duration); e.target = -1;
          cs.events.push({ t: 'control', d: e.cid });
        }
        break;
      }
      case 'drop': { // Drop: suelta toda la carga acumulada en área
        const extra = u.charge;
        u.charge = 0;
        enemies.filter(e => udist(tgt, e) <= (ab.radius || 2)).forEach(e => hit(e, extra));
        break;
      }
    }
    // efectos al lanzar
    for (const f of u.fx) if (f.type === 'castShare') for (const a of alliesOf(cs, u)) if (a !== u && a.traits.includes(f.trait)) gainMana(a, f.mana, T);
    if (u.castStackAS) u.asBuffs.push({ pct: u.castStackAS, until: cs.maxTicks + 1 });
  }
  function stepCombat(cs) {
    if (cs.done) return cs;
    cs.events = [];
    const T = ++cs.tick;
    for (const u of cs.units) {
      if (!u.alive) continue;
      if (u.controlledUntil && T >= u.controlledUntil) { u.side = u.team; u.controlledUntil = 0; u.target = -1; cs.events.push({ t: 'free', d: u.cid }); }
      if (u.shield > 0 && T >= u.shieldUntil) u.shield = 0;
      if (u.asBuffs.length) u.asBuffs = u.asBuffs.filter(b => b.until > T);
      if (u.manaRegen > 0) gainMana(u, u.manaRegen / TR, T);
      if (u.regen > 0 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * u.regen / 100 / TR);
      if (u.stunUntil > T || u.busyUntil > T) continue;
      const confused = u.confusedUntil > T;
      let tgt = u.target >= 0 ? cs.units[u.target] : null;
      if (confused) { // ataca a cualquiera (también a sus aliados)
        if (!tgt || !tgt.alive || tgt === u) {
          const others = cs.units.filter(x => x.alive && x !== u);
          tgt = others.length ? others[rngInt(cs, others.length)] : null;
        }
      } else if (!tgt || !tgt.alive || tgt.side === u.side || udist(u, tgt) > u.range) tgt = closestEnemy(cs, u) || null;
      if (!tgt) continue;
      u.target = tgt.cid;
      if (udist(u, tgt) <= u.range) {
        if (!confused && T >= u.silencedUntil && u.maxMana > 0 && u.mana >= u.maxMana) { castAbility(cs, u, tgt, T); continue; }
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
    for (const u of cs.units) if (u.alive) { if (u.team === 0) a++; else b++; }
    if (a === 0 || b === 0) { cs.done = true; cs.winner = a > 0 ? 'A' : b > 0 ? 'B' : 'draw'; }
    else if (T >= cs.maxTicks) { cs.done = true; cs.winner = 'draw'; }
    if (cs.done) cs.hash = fnv(cs.hash, cs.winner + JSON.stringify(cs.units.map(u => [u.hp, u.r, u.c, u.mana])));
    return cs;
  }
  function survivors(cs, team) {
    return cs.units.filter(u => u.alive && u.team === team).map(u => ({ unitId: u.unitId, star: u.star }));
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
  // Orígenes a los que se puede ser "fiel": los de 4 o más músicos (no dúos ni Solistas).
  const LOYAL_ORIGINS = ORIGINS.filter(t => !DATA.TRAITS[t].duo && !DATA.TRAITS[t].solo && UNIT_IDS.filter(id => DATA.UNITS[id].origins.includes(t)).length >= 4);
  const favoriteOrigin = (s, id) => LOYAL_ORIGINS[fnv(s.seed, '|fav|' + id) % LOYAL_ORIGINS.length];
  const BUILD_TRAITS = t => { const T = DATA.TRAITS[t]; return T.kind !== 'unica' && !T.solo; }; // rasgos que vale la pena "armar"
  const ownedWithTrait = (p, t, exceptId) => {
    const seen = {};
    for (const o of owned(p)) if (o.u.unitId !== exceptId && !seen[o.u.unitId] && traitsOfEntry({ unitId: o.u.unitId, origins: o.u.flaco ? o.u.flaco.chosen : undefined }).includes(t)) seen[o.u.unitId] = 1;
    return Object.keys(seen).length;
  };

  function botTargets(p, P, fav) {
    if (fav) return [fav];
    const score = {}, seen = {};
    for (const o of owned(p)) {
      if (seen[o.u.unitId]) continue;
      seen[o.u.unitId] = true;
      for (const t of def(o.u.unitId).traits) if (BUILD_TRAITS(t)) score[t] = (score[t] || 0) + 2 + (o.u.star - 1);
    }
    for (const id of p.shop) if (id) for (const t of DATA.UNITS[id].traits) if (BUILD_TRAITS(t)) score[t] = (score[t] || 0) + 0.5;
    const active = computeTraits(boardSnapshot(p)); // lealtad: lo que ya está activo pesa más
    for (const t of Object.keys(active)) if (active[t].level >= 0 && score[t] != null) score[t] += 2 * P.loyalty;
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
    for (const t of d.traits) if (DATA.TRAITS[t].duo && ownedWithTrait(p, t, unitId) > 0) sc += 8; // completar el dúo
    if (d.unique && d.cost >= 5) sc += p.level >= 8 ? 6 : 3;                                       // únicas de coste 5
    if (d.traits.includes('solistas')) { const n = ownedWithTrait(p, 'solistas', unitId); if (n >= 2) sc -= 3 * (n - 1); } // no apilar Solistas
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
    // 4) tablero: las `level` unidades más valiosas (sin pasar de 2 Solistas si hay alternativas);
    //    cuerpo a cuerpo adelante, rango atrás, la más valiosa de rango en la esquina de atrás.
    const pl = p(), focus = focusOf();
    const all = owned(pl).map(o => {
      const tr = def(o.u.unitId).traits;
      return { ...o, pow: POWER(o.u) + tr.filter(t => targets.includes(t)).length * 1.5 + (focus && tr.includes(focus.trait) ? 2 : 0) };
    });
    all.sort((a, b) => b.pow - a.pow || a.u.uid - b.u.uid);
    const chosen = [], deferred = [], soloIds = {};
    for (const o of all) {
      if (chosen.length >= pl.level) break;
      const isSolo = def(o.u.unitId).traits.includes('solistas');
      if (isSolo && !soloIds[o.u.unitId] && Object.keys(soloIds).length >= 2) { deferred.push(o); continue; }
      if (isSolo) soloIds[o.u.unitId] = 1;
      chosen.push(o);
    }
    for (const o of deferred) if (chosen.length < pl.level) chosen.push(o);
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
    // 5) El Flaco: elegir los orígenes que tenga habilitados
    for (const o of owned(p())) while (flacoPending(o.u)) if (!act({ type: 'FLACO', loc: where(o.u.uid), origin: pickFlacoOrigin(p(), o.u) })) break;
    // 6) no acumular: vender del banco lo que no forma pares ni encaja (deja hasta 4)
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
      v: DATA.VERSION, seed: seedFrom(seed), rng: seedFrom(seed), nextUid: 1,
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
    p.history.length = Math.min(p.history.length, 15);
  }
  const resultOf = (winner, side) => (winner === 'draw' ? 'draw' : winner === side ? 'win' : 'loss');
  // El Flaco sin origen elegido al empezar la pelea: el host elige el que más le suma.
  function autoFlaco(s) {
    for (const id of alivePlayers(s)) {
      const p = s.players[id];
      for (const u of p.board) while (u && flacoPending(u)) u.flaco.chosen.push(pickFlacoOrigin(p, u));
    }
  }
  // Resuelve TODAS las peleas de la ronda (sin render), aplica daño, elimina, asigna puestos
  // y arranca la siguiente planificación (con sus emparejamientos ya decididos).
  function resolveRound(state) {
    if (state.phase !== 'planning') return state;
    const s = clone(state);
    const label = roundLabel(s.round), stage = s.round.stage;
    const alive = alivePlayers(s);
    const hpBefore = {};
    for (const id of alive) hpBefore[id] = s.players[id].hp;
    autoFlaco(s);
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
        s.combats.push({ round: label, kind: pve ? 'pve' : 'gen', a: id, b: null, ghost: false, name: opp.name, snapA, snapB: opp.units, seed, winner: res.winner, hash: res.hash, ticks: res.ticks, dmgA: dmg, dmgB: 0 });
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
        s.combats.push({ round: label, kind: 'pvp', a, b, ghost, name: pb.name, snapA, snapB, seed, winner: res.winner, hash: res.hash, ticks: res.ticks, dmgA, dmgB });
      }
    }
    // El Flaco: cada pelea que jugó en el tablero cuenta para habilitar otro origen
    for (const id of alive) for (const u of s.players[id].board) if (u && u.flaco) u.flaco.fights++;
    s.roundsPlayed++;
    eliminate(s, hpBefore);
    if (s.phase !== 'ended') {
      s.round.num++;
      if (s.round.num > roundsInStage(s.round.stage)) { s.round.stage++; s.round.num = 1; }
      startPlanning(s, false);
    }
    return s;
  }

  // Un bot toma (on=true) o devuelve (on=false) el lugar de un humano desconectado.
  // Decisión del host; el jugador conserva todo lo suyo.
  function setBotControl(state, pid, on) {
    const p = state.players[pid];
    if (!p || (on ? p.isBot : !p.takenOver)) return state; // nada que cambiar (y un bot real nunca pasa a humano)
    const s = clone(state), q = s.players[pid];
    q.isBot = !!on; q.takenOver = !!on;
    q.bot = on ? { personality: 'equilibrado', difficulty: 0.3 } : null;
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
          // [rasgo, umbral alcanzado] de lo que terminó activo
          traits: Object.keys(tr).filter(t => tr[t].level >= 0).map(t => [t, DATA.TRAITS[t].solo ? tr[t].count : DATA.TRAITS[t].breakpoints[tr[t].level]]),
          units: [...new Set(snap.map(e => e.unitId))],
        };
      }),
    };
  }
  // Junta resúmenes de muchas partidas en tablas listas para console.table.
  function balanceStats(summaries) {
    const r2 = x => Math.round(x * 100) / 100, pct = x => Math.round(x * 1000) / 10 + '%';
    const acc = (map, key, place) => {
      const e = (map[key] ||= { n: 0, sum: 0, top4: 0, wins: 0 });
      e.n++; e.sum += place; if (place <= 4) e.top4++; if (place === 1) e.wins++;
    };
    const pers = {}, byTier = {}, byTrait = {}, winUnits = {}, playersN = summaries.reduce((n, g) => n + g.players.length, 0);
    let rounds = 0;
    for (const g of summaries) {
      rounds += g.rounds;
      for (const p of g.players) {
        acc(pers, p.personality, p.place);
        for (const [t, bp] of p.traits) { acc(byTrait, t, p.place); acc(byTier, `${t}|${bp}`, p.place); }
        if (p.place === 1) for (const u of p.units) winUnits[u] = (winUnits[u] || 0) + 1;
      }
    }
    const row = (label, e) => ({ ...label, activoEn: pct(e.n / playersN), puestoProm: r2(e.sum / e.n), top4: pct(e.top4 / e.n), ganadas: pct(e.wins / e.n) });
    const kindTable = kind => {
      const rows = [];
      for (const t of TRAIT_IDS.filter(t => DATA.TRAITS[t].kind === kind)) {
        const T = DATA.TRAITS[t];
        const tiers = T.solo ? [1, 2, 3, 4] : T.breakpoints;
        const total = byTrait[t];
        if (!total) { rows.push({ rasgo: T.name, umbral: '—', activoEn: '0%', puestoProm: '-', top4: '-', ganadas: '-' }); continue; }
        for (const bp of tiers) { const e = byTier[`${t}|${bp}`]; if (e) rows.push(row({ rasgo: T.name, umbral: T.solo ? `${bp} solista${bp > 1 ? 's' : ''}` : bp }, e)); }
      }
      return rows;
    };
    const games = summaries.length;
    return {
      partidas: games,
      rondasProm: r2(rounds / games),
      personalidades: Object.entries(pers).map(([k, e]) => row({ personalidad: (DATA.BOTS.PERSONALITIES[k] || { name: k }).name }, e)).sort((a, b) => a.puestoProm - b.puestoProm),
      origenes: kindTable('origen'), clases: kindTable('clase'), unicas: kindTable('unica'),
      // rasgos que casi nunca terminan activos (menos del 3% de los jugadores)
      casiNunca: TRAIT_IDS.filter(t => !byTrait[t] || byTrait[t].n / playersN < 0.03).map(t => ({ rasgo: DATA.TRAITS[t].name, tipo: DATA.TRAITS[t].kind, activoEn: pct((byTrait[t] ? byTrait[t].n : 0) / playersN) })),
      unidadesGanadoras: Object.entries(winUnits).sort((a, b) => b[1] - a[1])
        .map(([u, n]) => ({ unidad: DATA.UNITS[u].name, coste: DATA.UNITS[u].cost, enTablerosGanadores: pct(n / games) })),
    };
  }

  return {
    // partida (host)
    createGame, makeSlots, resolveRound, runAllBots, setBotControl,
    // acciones (humanos y bots)
    applyAction, validateAction, runBotTurn,
    // combate
    createCombat, stepCombat, simulateCombat, checkDeterminism, selfTest, generateOpponentBoard,
    // sin UI
    simulateGame, checkGameDeterminism, gameSummary, balanceStats, stateHash,
    // helpers de lectura (sin efectos)
    computeTraits, traitsOfEntry, boardSnapshot, incomePreview, sellValue, countCopies, boardCount, benchFree,
    roundLabel, roundsInStage, xpNeeded, hexDist, def, clone, seedFrom, abilityValue,
    flacoPending, flacoSlots, pickFlacoOrigin,
  };
})();

if (typeof module !== 'undefined') module.exports = { DATA, SIM };
