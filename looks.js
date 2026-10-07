/* Tácticas del Rock — LOOKS: cómo se ve cada músico (solo datos; lo dibuja stage3d.js).
 * inst: instrumento (si no está, sale de la clase: CLASS_INST).
 * hair: bald | short | buzz | medium | long | afro | afroSmall | rasta | messy | curlyLong | pompadour | mop | longBangs | sidecut | baldSides
 * hat: cap | fedora | tophat | crown | beanie | headband | headphones
 * glasses: true (oscuros) | 'round'.  beard, mustache (true | 'bicolor'), big (grandote).
 * Colores: skin, hairCol, shirt, pants, instCol. */
'use strict';
const LOOKS = (() => {
  const S = { claro: '#f0c9a5', medio: '#e2b48c', trigueño: '#c8946a', moreno: '#9a6a45' };
  const H = { negro: '#151515', castaño: '#4a3020', castañoClaro: '#7a5434', rubio: '#d8b56a', canoso: '#c9c9cc', rojizo: '#8a3a1c' };
  const CLASS_INST = { base: 'bass', agitador: 'mic', gyv: 'guitar', guitarhero: 'guitar', voz: 'mic', poeta: 'acoustic', teclados: 'keytar', productor: 'dj' };
  const L = {
    // ---- coste 1 ----
    calamaro:      { inst: 'keytar', hair: 'medium', hairCol: H.castaño, skin: S.medio, shirt: '#151515', pants: '#2d3a55', glasses: true, beard: true },
    corgan:        { hair: 'bald', skin: S.claro, shirt: '#0e0e10', pants: '#0e0e10', instCol: '#8a1a1a', tunic: true },
    catriel:       { inst: 'sticks', hair: 'short', hairCol: H.castaño, skin: S.medio, shirt: '#6a1a24', pants: '#18181c', beard: true },
    grohl:         { inst: 'sticks', hair: 'long', hairCol: H.negro, skin: S.claro, shirt: '#6b6f78', pants: '#2d3a55', beard: true },
    duki:          { hair: 'rasta', hairCol: H.rubio, skin: S.medio, shirt: '#f1f1f1', pants: '#151515' },
    fabiana:       { hair: 'long', hairCol: H.rubio, skin: S.claro, shirt: '#c0392b', pants: '#151515' },
    ruizdiaz:      { hair: 'short', hairCol: H.negro, skin: S.medio, shirt: '#151515', pants: '#151515', instCol: '#2a2a2e' },
    marciano:      { hair: 'medium', hairCol: H.castaño, skin: S.medio, shirt: '#1c1c22', pants: '#2d3a55', mustache: true, instCol: '#2b2b30' },
    mateo:         { hair: 'short', hairCol: H.castaño, skin: S.claro, shirt: '#8fc1e3', pants: '#c9b48a', beard: true },
    miguelabuelo:  { hair: 'curlyLong', hairCol: H.castaño, skin: S.claro, shirt: '#6b3a8f', pants: '#eeeeee', hat: 'headband', hatCol: '#e0a03c' },
    gimenez:       { hair: 'short', hairCol: H.castaño, skin: S.medio, shirt: '#f1f1f1', pants: '#151515', hat: 'crown', hatCol: '#f0b429', instCol: '#c0392b' },
    collins:       { hair: 'bald', skin: S.claro, shirt: '#f1f1f1', pants: '#6b6f78', beard: true, hairCol: H.castañoClaro },
    pityfernandez: { hair: 'short', hairCol: H.castaño, skin: S.medio, shirt: '#2f6f3e', pants: '#2d3a55', beard: true, hat: 'cap', hatCol: '#1c1c22' },
    vicentico:     { hair: 'short', hairCol: H.negro, skin: S.medio, shirt: '#222226', pants: '#222226', beard: true, hat: 'fedora', hatCol: '#1d1d1d' },
    // ---- coste 2 ----
    barilari:      { hair: 'long', hairCol: H.negro, skin: S.claro, shirt: '#151515', pants: '#0e0e10' },
    dargelos:      { hair: 'medium', hairCol: H.negro, skin: S.claro, shirt: '#5a2a6e', pants: '#1b1b20', glasses: true },
    turner:        { hair: 'pompadour', hairCol: H.negro, skin: S.claro, shirt: '#1a1a1d', pants: '#151515', instCol: '#7a1e12' },
    bahiano:       { hair: 'rasta', hairCol: '#3a2414', skin: S.trigueño, shirt: '#e3b505', pants: '#2d2d2d' },
    chrismartin:   { hair: 'short', hairCol: H.castaño, skin: S.claro, shirt: '#f1f1f1', pants: '#151515' },
    pertusi:       { hair: 'messy', hairCol: H.negro, skin: S.claro, shirt: '#c0392b', pants: '#151515' },
    dante:         { hair: 'rasta', hairCol: H.negro, skin: S.medio, shirt: '#f1f1f1', pants: '#3a3a44', hat: 'cap', hatCol: '#d13a3a', instCol: '#f0b429' },
    horvilleur:    { hair: 'afroSmall', hairCol: H.castaño, skin: S.medio, shirt: '#e07a2a', pants: '#eeeeee', glasses: true },
    cordera:       { hair: 'long', hairCol: H.castaño, skin: S.medio, shirt: '#f1f1f1', pants: '#2d3a55', beard: true },
    luca:          { hair: 'bald', skin: S.claro, shirt: '#e9e9e9', pants: '#2a2a2a' },
    pityalvarez:   { hair: 'medium', hairCol: H.castaño, skin: S.medio, shirt: '#c0392b', pants: '#2d3a55', beard: true, hat: 'cap', hatCol: '#151515', instCol: '#151515' },
    plant:         { hair: 'curlyLong', hairCol: H.rubio, skin: S.claro, shirt: '#8fc1e3', pants: '#2d3a55' },
    zeta:          { hair: 'medium', hairCol: H.negro, skin: S.claro, shirt: '#f1f1f1', pants: '#1d1d22', instCol: '#e9e9ec' },
    // ---- coste 3 ----
    ciromartinez:  { hair: 'short', hairCol: H.castaño, skin: S.medio, shirt: '#2f6f3e', pants: '#3a3a44', hat: 'cap', hatCol: '#c0392b' },
    brianmay:      { hair: 'afro', hairCol: '#2b2522', skin: S.claro, shirt: '#f2f2f2', pants: '#151515', instCol: '#7a1e12' },
    chizzo:        { hair: 'long', hairCol: H.negro, skin: S.medio, shirt: '#151515', pants: '#151515', instCol: '#c9ccd4' },
    albarn:        { hair: 'short', hairCol: H.castaño, skin: S.claro, shirt: '#2a5aa8', pants: '#151515' },
    gilmour:       { hair: 'short', hairCol: H.canoso, skin: S.claro, shirt: '#151515', pants: '#2d3a55', instCol: '#111114' },
    brancciari:    { hair: 'short', hairCol: H.castaño, skin: S.medio, shirt: '#2a5aa8', pants: '#2d3a55', beard: true },
    moura:         { hair: 'short', hairCol: H.castaño, skin: S.claro, shirt: '#8a8f98', pants: '#8a8f98' },
    lennon:        { hair: 'long', hairCol: H.castañoClaro, skin: S.claro, shirt: '#f4f4f4', pants: '#f4f4f4', glasses: 'round', instCol: '#c98b3a' },
    johansen:      { hair: 'short', hairCol: H.canoso, skin: S.claro, shirt: '#151515', pants: '#151515', glasses: true, beard: true },
    bertoldi:      { hair: 'messy', hairCol: H.castaño, skin: S.claro, shirt: '#151515', pants: '#151515', instCol: '#f1f1f1' },
    mccartney:     { hair: 'mop', hairCol: H.castaño, skin: S.claro, shirt: '#6b6f78', pants: '#6b6f78', instCol: '#8a5a2b' },
    barrionuevo:   { hair: 'medium', hairCol: H.negro, skin: S.medio, shirt: '#6b6f78', pants: '#2d3a55', instCol: '#2b2b30' },
    teysera:       { hair: 'short', hairCol: H.castaño, skin: S.medio, shirt: '#8fc1e3', pants: '#151515', beard: true, hat: 'cap', hatCol: '#2a5aa8' },
    slash:         { hair: 'curlyLong', hairCol: H.negro, skin: S.claro, shirt: '#1a1a1d', pants: '#151515', hat: 'tophat', hatCol: '#151515', glasses: true, instCol: '#a8551e' },
    // ---- coste 4 ----
    lebon:         { hair: 'long', hairCol: H.rubio, skin: S.claro, shirt: '#f1f1f1', pants: '#2d3a55', mustache: true, instCol: '#f0b429' },
    eminem:        { hair: 'buzz', hairCol: H.rubio, skin: S.claro, shirt: '#f4f4f4', pants: '#6b6f78', tank: true },
    fito:          { hair: 'afroSmall', hairCol: H.negro, skin: S.claro, shirt: '#151515', pants: '#151515', glasses: true },
    santaolalla:   { hair: 'afroSmall', hairCol: H.canoso, skin: S.medio, shirt: '#151515', pants: '#151515', beard: true },
    greenwood:     { hair: 'longBangs', hairCol: H.negro, skin: S.claro, shirt: '#151515', pants: '#151515' },
    drexler:       { hair: 'bald', skin: S.claro, shirt: '#8fc1e3', pants: '#c9b48a', beard: true, hairCol: H.castañoClaro },
    baglietto:     { hair: 'short', hairCol: H.canoso, skin: S.claro, shirt: '#2a5aa8', pants: '#151515', mustache: true },
    cobain:        { hair: 'medium', hairCol: H.rubio, skin: S.claro, shirt: '#3f6b3a', pants: '#2d3a55', instCol: '#2a5aa8' },
    gieco:         { hair: 'long', hairCol: H.canoso, skin: S.claro, shirt: '#f1f1f1', pants: '#2d3a55', mustache: true },
    pappo:         { hair: 'long', hairCol: '#2a1e16', skin: S.medio, shirt: '#3b3b3b', pants: '#24324d', beard: true, big: true, instCol: '#8b5a2b' },
    iorio:         { hair: 'long', hairCol: H.negro, skin: S.claro, shirt: '#151515', pants: '#151515', beard: true, big: true, instCol: '#151515' },
    mollo:         { hair: 'curlyLong', hairCol: H.castaño, skin: S.medio, shirt: '#151515', pants: '#151515', beard: true, instCol: '#c98b3a' },
    skay:          { hair: 'long', hairCol: H.canoso, skin: S.claro, shirt: '#1a1a1a', pants: '#1a1a1a', glasses: true, instCol: '#d9a520' },
    wos:           { hair: 'short', hairCol: H.negro, skin: S.medio, shirt: '#151515', pants: '#3a3a44', hat: 'cap', hatCol: '#151515' },
    // ---- coste 5 ----
    charly:        { inst: 'keytar', hair: 'messy', hairCol: '#d8c08a', skin: S.claro, shirt: '#2a2a2a', pants: '#b12a2a', mustache: 'bicolor' },
    freddie:       { hair: 'short', hairCol: H.negro, skin: S.medio, shirt: '#f2c21b', pants: '#f4f4f4', mustache: true },
    cerati:        { hair: 'medium', hairCol: '#1a1410', skin: S.claro, shirt: '#101014', pants: '#2a2a33', instCol: '#c9ccd4' },
    indio:         { hair: 'baldSides', hairCol: H.canoso, skin: S.claro, shirt: '#151515', pants: '#151515', glasses: true },
    ng:            { hair: 'short', hairCol: H.negro, skin: S.claro, shirt: '#f1f1f1', pants: '#151515', hat: 'headphones', hatCol: '#151515' },
    lisandro:      { hair: 'long', hairCol: H.negro, skin: S.medio, shirt: '#6b4a2b', pants: '#2d3a55', beard: true, hat: 'beanie', hatCol: '#6a1a24' },
    spinetta:      { hair: 'long', hairCol: H.castaño, skin: S.claro, shirt: '#f1f1f1', pants: '#2d3a55', instCol: '#a8551e' },
    aznar:         { inst: 'bass', hair: 'short', hairCol: H.canoso, skin: S.claro, shirt: '#151515', pants: '#151515', beard: true, instCol: '#c98b3a' },
    skrillex:      { hair: 'sidecut', hairCol: H.negro, skin: S.claro, shirt: '#151515', pants: '#151515', glasses: true },
    thom:          { hair: 'messy', hairCol: H.castañoClaro, skin: S.claro, shirt: '#6b6f78', pants: '#151515' },
    // ---- PvE ----
    sonidista:     { inst: 'dj', hair: 'short', hairCol: H.castaño, skin: S.medio, shirt: '#3a3a44', pants: '#2d2d2d', hat: 'headphones', hatCol: '#151515' },
    patovica:      { inst: 'none', hair: 'bald', skin: S.medio, shirt: '#0e0e10', pants: '#0e0e10', glasses: true, big: true },
  };
  // Temática por origen (como las sinergias de TFT: todos los de un origen comparten paleta, accesorio y
  // efecto). shirt/pants pisan la ropa propia; acc: accesorios; fx: efecto animado.
  const THEMES = {
    combate:      { shirt: '#1a1a1e', pants: '#2a0e10', accent: '#e02a2a', acc: ['bandana', 'spikes'] },
    realeza:      { shirt: '#5a2a86', pants: '#2a1640', accent: '#f5c542', acc: ['cape', 'crown', 'goldTrim'] },
    celestial:    { shirt: '#eaf6ff', pants: '#a8d8ff', accent: '#7fd0ff', acc: ['halo'], fx: 'float' },
    frio:         { shirt: '#bfefff', pants: '#3a6f9a', accent: '#e8fbff', acc: ['frostScarf'], fx: 'snow' },
    motor:        { shirt: '#2a1d16', pants: '#1b1b20', accent: '#c9ccd2', acc: ['leatherVest', 'goggles'] },
    averiados:    { shirt: '#ff8a3c', pants: '#4a3a30', accent: '#f4f1ea', acc: ['headBandage', 'bandaids'] },
    transmision:  { shirt: '#14323a', pants: '#0e1a22', accent: '#3cf0f0', acc: ['antenna', 'ledChest'], fx: 'blink' },
    arcoiris:     { shirt: '#f4f4f4', pants: '#2d3a55', accent: '#e04fa0', acc: ['rainbowSash'], fx: 'sparkle' },
    familia:      { shirt: '#9b6ad6', pants: '#3b2a55', accent: '#f0d9ff', acc: ['cardigan'] },
    fauna:        { shirt: '#8a5a2b', pants: '#4a3420', accent: '#c98b3a', acc: ['animalEars', 'tail'] },
    chiquitos:    { shirt: '#4fbf5a', pants: '#2f5a33', accent: '#d8d8dc', acc: ['mouseEars'] },
    matematica:   { shirt: '#2a5bd8', pants: '#1b2a55', accent: '#ffffff', acc: ['geoPrint', 'pencil'] },
    trabalenguas: { shirt: '#ff6fa8', pants: '#5a2a44', accent: '#ff3a6a', acc: ['tongue'] },
    freestyle:    { shirt: '#ffd23c', pants: '#1b1b20', accent: '#f0c040', acc: ['backCap', 'chain'] },
    almacen:      { shirt: '#c98a3a', pants: '#3a2f22', accent: '#f4ead2', acc: ['apron'] },
    fraselarga:   { shirt: '#8a8f99', pants: '#2b2f38', accent: '#e8e8e8', acc: ['longScarf'] },
    bff:          { shirt: '#ff9ad5', pants: '#3a2a44', accent: '#ff4fa0', acc: ['heartBadge', 'bracelet'] },
    solistas:     { accent: '#ffffff', acc: [], fx: 'spotlight' }, // los solistas puros: su propio cañón de luz
  };
  // Origen principal: el primero que no sea Solistas (los que solo son Solistas usan el de Solistas).
  const themeOf = def => (def && def.origins ? def.origins.find(o => o !== 'solistas') || (def.origins.includes('solistas') ? 'solistas' : null) : null);
  // Look completo de una unidad (con el instrumento de su clase si no tiene uno propio) + su temática.
  function of(unitId, def) {
    const l = L[unitId] || { hair: 'short', hairCol: H.castaño, skin: S.medio, shirt: '#444', pants: '#222' };
    const cls = def && def.classes && def.classes[0];
    const out = { instCol: '#2b2b30', hairCol: H.castaño, ...l, inst: l.inst || CLASS_INST[cls] || 'mic' };
    const tk = themeOf(def), th = tk && THEMES[tk];
    if (th) {
      out.theme = tk; out.ownShirt = out.shirt;
      if (th.shirt && !l.keepShirt) out.shirt = th.shirt;
      if (th.pants && !l.keepPants) out.pants = th.pants;
      if (def.origins.includes('solistas')) out.solo = true; // borde blanco / luz propia
    }
    return out;
  }
  return { of, CLASS_INST, ALL: L, THEMES, themeOf };
})();
if (typeof module !== 'undefined') module.exports = { LOOKS };
