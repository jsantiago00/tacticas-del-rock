/* Paso 1 de los retratos: buscar fotos candidatas en Wikidata / Wikimedia Commons.
 *
 *   node buscar.js              busca a los que todavía no están en candidatas.json (retoma si se cortó)
 *   node buscar.js duki fito    rehace solo esos
 *   node buscar.js --todos      rehace todos
 *
 * Para cada músico del plantel (sim.js):
 *   1. Wikidata (wbsearchentities, en español y en inglés) → el primer resultado que sea una persona
 *      ligada a la música (ocupación, género, instrumento, sello o descripción). Si trae a un homónimo,
 *      se corrige en forzar.json:  { "duki": "Q123456" }  o  { "duki": { "busqueda": "Duki rapero" } }
 *   2. Su imagen principal (P18).
 *   3. Hasta 5 candidatas más en Commons: primero las que lo tienen etiquetado como "representa"
 *      (P180), después por nombre.
 *   4. imageinfo + extmetadata de todas juntas (URL, tamaño, autor, licencia, link a la licencia).
 *   5. Solo licencias libres claras (CC0, dominio público, CC BY, CC BY-SA) y de 400 px o más.
 * Un pedido por vez, con pausa, y User-Agent que identifica la herramienta (política de Wikimedia).
 * Salida: candidatas.json (+ candidatas.js para abrir elegir.html con doble clic).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { DATA } = require('../../sim.js');

const UA = 'TacticasDelRock-Retratos/1.0 (https://github.com/jsantiago00/tacticas-del-rock; herramienta personal, un pedido por vez)';
const PAUSA_MS = 1000, MIN_LADO = 400, EXTRA = 5, ANCHO_VISTA = 800;
const DIR = __dirname, SALIDA = path.join(DIR, 'candidatas.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- pedidos: de a uno, con pausa y reintentos ----------
let ultimo = 0;
async function api(base, params) {
  const url = base + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  for (let intento = 1; ; intento++) {
    const espera = ultimo + PAUSA_MS - Date.now();
    if (espera > 0) await sleep(espera);
    ultimo = Date.now();
    let r;
    try { r = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } }); }
    catch (e) { if (intento >= 5) throw e; await sleep(3000 * intento); continue; }
    if (r.status === 429 || r.status >= 500) {
      if (intento >= 5) throw new Error(`HTTP ${r.status} en ${url}`);
      const ra = +r.headers.get('retry-after') || 5 * intento;
      console.log(`  (el servidor pide esperar ${ra}s)`); await sleep(ra * 1000); continue;
    }
    const j = await r.json();
    if (j.error && j.error.code === 'maxlag' && intento < 5) { await sleep(5000); continue; }
    if (j.error) throw new Error(`${j.error.code}: ${j.error.info}`);
    return j;
  }
}
const WD = 'https://www.wikidata.org/w/api.php', COMMONS = 'https://commons.wikimedia.org/w/api.php';

// ---------- ¿es músico? ----------
const OCUP_MUSICA = new Set(['Q639669', 'Q177220', 'Q36834', 'Q855091', 'Q386854', 'Q584301', 'Q753110', 'Q488205', 'Q183945',
  'Q2252262', 'Q130857', 'Q806349', 'Q1259917', 'Q486748', 'Q158852', 'Q1075651', 'Q2865819', 'Q1198887', 'Q12800682', 'Q2490358', 'Q9648008', 'Q3922505']);
const DESC_MUSICA = /m[úu]sic|cantante|cantautor|singer|songwriter|rapper|rapero|guitar|bater[ií]st|drummer|bajista|bassist|compos|productor|producer|\bdj\b|teclad|keyboard|pianist|banda|band\b|rock|trap/i;
const ids = (claims, p) => ((claims && claims[p]) || []).map(c => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value).filter(Boolean);
function esMusico(ent) {
  const c = ent.claims || {};
  if (!ids(c, 'P31').some(v => v.id === 'Q5')) return false; // tiene que ser una persona
  if (ids(c, 'P106').some(v => OCUP_MUSICA.has(v.id))) return true;
  if (['P136', 'P1303', 'P264'].some(p => ids(c, p).length)) return true;
  const desc = Object.values(ent.descriptions || {}).map(d => d.value || d).join(' ');
  return DESC_MUSICA.test(desc);
}
const etiqueta = ent => (ent.labels && (ent.labels.es || ent.labels.en || Object.values(ent.labels)[0]) || {}).value || '';
const descripcion = ent => (ent.descriptions && (ent.descriptions.es || ent.descriptions.en) || {}).value || '';

async function entidades(qids) {
  const j = await api(WD, { action: 'wbgetentities', ids: qids.join('|'), props: 'claims|labels|descriptions', languages: 'es|en' });
  return qids.map(q => j.entities[q]).filter(e => e && !e.missing);
}
async function buscarEnWikidata(texto) {
  const vistos = [];
  for (const lang of ['es', 'en']) {
    const j = await api(WD, { action: 'wbsearchentities', search: texto, language: lang, uselang: lang, type: 'item', limit: '7' });
    for (const s of j.search || []) if (!vistos.includes(s.id)) vistos.push(s.id);
    if (vistos.length >= 7) break;
  }
  if (!vistos.length) return null;
  const ents = await entidades(vistos.slice(0, 12));
  return ents.find(esMusico) || null;
}

// ---------- licencias ----------
function licencia(m) {
  const corto = ((m.LicenseShortName && m.LicenseShortName.value) || '').trim();
  const codigo = ((m.License && m.License.value) || '').toLowerCase();
  const s = (corto + ' ' + codigo).toLowerCase();
  if (/\bnc\b|non-?commercial|\bnd\b|no-?deriv|fair use|uso leg[ií]timo|copyrighted|all rights reserved/.test(s)) return null;
  if (/cc0|public domain|dominio p[úu]blico|(^|\s)pd($|[\s-])/.test(s)) return { nombre: corto || 'Dominio público', tipo: 'pd' };
  if (/cc[- ]by[- ]sa/.test(s)) return { nombre: corto, tipo: 'by-sa' };
  if (/cc[- ]by(?![- ]?(nc|nd))/.test(s)) return { nombre: corto, tipo: 'by' };
  return null;
}
const sinHtml = t => String(t || '').replace(/<(\w+)[^>]*display:\s*none[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const NO_FOTO = /logo|signature|firma|autograph|autógrafo|album|cover|tapa|poster|afiche|flyer|ticket|entrada|mural|grafiti|graffiti|placa|plaque|stamp|sello postal|\.(svg|pdf|ogg|oga|webm|ogv|mp3|wav|gif|tif|tiff|djvu)$/i;

async function buscarEnCommons(qid, nombre, ya) {
  const titulos = [];
  const sumar = lista => { for (const t of lista) if (titulos.length < EXTRA && !ya.includes(t) && !titulos.includes(t) && !NO_FOTO.test(t)) titulos.push(t); };
  if (qid) {
    const j = await api(COMMONS, { action: 'query', list: 'search', srsearch: `haswbstatement:P180=${qid}`, srnamespace: '6', srlimit: '15' });
    sumar((j.query.search || []).map(s => s.title));
  }
  if (titulos.length < EXTRA) {
    const j = await api(COMMONS, { action: 'query', list: 'search', srsearch: `"${nombre}" filetype:bitmap`, srnamespace: '6', srlimit: '15' });
    sumar((j.query.search || []).map(s => s.title));
  }
  return titulos;
}
async function infoDeArchivos(titulos) {
  if (!titulos.length) return [];
  const j = await api(COMMONS, { action: 'query', titles: titulos.join('|'), prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(ANCHO_VISTA),
    iiextmetadatafilter: 'LicenseShortName|License|LicenseUrl|Artist|Credit|AttributionRequired|DateTimeOriginal|ImageDescription' });
  const porTitulo = {};
  for (const p of j.query.pages || []) porTitulo[p.title] = p;
  // la API normaliza títulos ("File:" en vez de "Archivo:", espacios, etc.)
  for (const n of j.query.normalized || []) if (porTitulo[n.to]) porTitulo[n.from] = porTitulo[n.to];
  return titulos.map(t => porTitulo[t]).filter(Boolean);
}

// ---------- un músico ----------
async function buscarMusico(id, forzar) {
  const u = DATA.UNITS[id], f = typeof forzar === 'string' ? { qid: forzar } : forzar || {};
  const res = { unitId: id, nombre: u.name, corto: u.short, qid: null, wikidata: '', descripcion: '', candidatas: [], descartadas: 0, nota: '' };
  let ent = null;
  if (f.qid) ent = (await entidades([f.qid]))[0] || null;
  else ent = await buscarEnWikidata(f.busqueda || u.name);
  if (ent) { res.qid = ent.id; res.wikidata = etiqueta(ent); res.descripcion = descripcion(ent); }
  else res.nota = 'No encontrado en Wikidata como músico (se buscó solo en Commons por nombre)';
  const p18 = ent ? ids(ent.claims, 'P18') : [];
  const principales = p18.map(v => 'File:' + v);
  const extra = await buscarEnCommons(res.qid, f.busqueda || u.name, principales);
  const infos = await infoDeArchivos([...principales, ...extra]);
  for (const p of infos) {
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii) continue;
    const m = ii.extmetadata || {}, lic = licencia(m);
    if (!lic || Math.min(ii.width, ii.height) < MIN_LADO || !/^image\/(jpeg|png|webp)$/.test(ii.mime || '')) { res.descartadas++; continue; }
    res.candidatas.push({
      archivo: p.title, fuente: principales.includes(p.title) ? 'P18' : 'commons',
      url: ii.url, vista: ii.thumburl || ii.url, pagina: ii.descriptionurl, ancho: ii.width, alto: ii.height,
      autor: (sinHtml(m.Artist && m.Artist.value) || 'Autor desconocido').replace(/^unknown author$/i, 'Autor desconocido'),
      credito: sinHtml(m.Credit && m.Credit.value), // fuente según la página del archivo (a veces es el único dato de origen)
      licencia: lic.nombre, tipo: lic.tipo, licenciaUrl: (m.LicenseUrl && m.LicenseUrl.value) || '',
      fecha: sinHtml(m.DateTimeOriginal && m.DateTimeOriginal.value).slice(0, 10),
    });
  }
  return res;
}

// ---------- principal ----------
(async () => {
  const args = process.argv.slice(2), todos = args.includes('--todos'), solo = args.filter(a => !a.startsWith('--'));
  for (const s of solo) if (!DATA.UNITS[s]) { console.error(`No existe el músico "${s}". Ids: ${Object.keys(DATA.UNITS).join(', ')}`); process.exit(1); }
  const forzar = fs.existsSync(path.join(DIR, 'forzar.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'forzar.json'), 'utf8')) : {};
  const prev = fs.existsSync(SALIDA) ? JSON.parse(fs.readFileSync(SALIDA, 'utf8')) : { musicos: {} };
  const out = { generado: '', musicos: prev.musicos || {} };
  const guardar = () => {
    out.generado = new Date().toISOString();
    fs.writeFileSync(SALIDA, JSON.stringify(out, null, 1));
    fs.writeFileSync(path.join(DIR, 'candidatas.js'), '// generado por buscar.js: lo lee elegir.html\nwindow.CANDIDATAS = ' + JSON.stringify(out) + ';\n');
  };
  const lista = Object.keys(DATA.UNITS).filter(id => solo.length ? solo.includes(id) : (todos || !out.musicos[id]));
  console.log(`Buscando ${lista.length} músico(s)…`);
  let i = 0;
  for (const id of lista) {
    i++;
    try {
      const r = await buscarMusico(id, forzar[id]);
      out.musicos[id] = r;
      console.log(`${String(i).padStart(2)}/${lista.length} ${r.nombre.padEnd(26)} ${r.qid || '—'.padEnd(10)} ${r.candidatas.length} candidata(s)${r.descartadas ? `, ${r.descartadas} descartada(s)` : ''}${r.wikidata && r.wikidata !== r.nombre ? `  [${r.wikidata}]` : ''}`);
    } catch (e) {
      console.log(`${String(i).padStart(2)}/${lista.length} ${DATA.UNITS[id].name}: ERROR ${e.message} (se reintenta en la próxima corrida)`);
    }
    guardar();
  }
  const sin = Object.keys(DATA.UNITS).filter(id => out.musicos[id] && !out.musicos[id].candidatas.length);
  const sinWd = Object.keys(DATA.UNITS).filter(id => out.musicos[id] && !out.musicos[id].qid);
  const falta = Object.keys(DATA.UNITS).filter(id => !out.musicos[id]);
  console.log(`\nListo: candidatas.json (${Object.keys(out.musicos).length}/${Object.keys(DATA.UNITS).length} músicos).`);
  if (sinWd.length) console.log(`Sin match en Wikidata (revisar o usar forzar.json): ${sinWd.map(id => DATA.UNITS[id].name).join(', ')}`);
  console.log(sin.length ? `Sin ninguna candidata libre (plan B): ${sin.map(id => DATA.UNITS[id].name).join(', ')}` : 'Todos tienen al menos una candidata.');
  if (falta.length) console.log(`Quedaron sin buscar (error): ${falta.join(', ')}. Volvé a correr el script.`);
})();
