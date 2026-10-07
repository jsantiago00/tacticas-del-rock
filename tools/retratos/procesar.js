/* Paso 3 de los retratos: descargar, recortar, filtrar y exportar.
 *
 *   npm install            (una vez, en esta carpeta: instala sharp)
 *   node procesar.js       usa elegidas.json (de elegir.html) y planb.png (de planb.html)
 *
 * Para cada músico del plantel:
 *   - foto elegida: baja la original (Special:FilePath a 2000 px como máximo; queda en originales/),
 *     recorta el cuadrado marcado, aplica el duotono (duotono.js) y exporta.
 *   - "ninguna sirve", sin candidatas o todavía pendiente: la cabeza del muñeco desde planb.png,
 *     con el mismo filtro.
 * Salida en assets/retratos/: <id>.webp (512 px), <id>-128.webp (pases), creditos.json y creditos.js
 * (el juego lee el .js porque también corre abierto como archivo, sin servidor).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const DUOTONO = require('./duotono.js');
const { DATA } = require('../../sim.js');

const UA = 'TacticasDelRock-Retratos/1.0 (https://github.com/jsantiago00/tacticas-del-rock; herramienta personal, un pedido por vez)';
const DIR = __dirname, ORIG = path.join(DIR, 'originales'), OUT = path.join(DIR, '..', '..', 'assets', 'retratos');
const CELDA = 512, COLS = 9, PAUSA_MS = 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function recorte(W, H, e) { // misma cuenta que elegir.html
  const s = Math.round(Math.min(W, H) * e.lado), h = s / 2;
  const cx = Math.max(h, Math.min(W - h, e.cx * W)), cy = Math.max(h, Math.min(H - h, e.cy * H));
  return { left: Math.max(0, Math.round(cx - h)), top: Math.max(0, Math.round(cy - h)), width: Math.min(s, W), height: Math.min(s, H) };
}
let ultimo = 0;
async function bajar(id, e) {
  if (e.fuente === 'manual' || !/^https?:/.test(e.url)) return fs.readFileSync(path.join(DIR, e.url)); // foto propia (manuales.js)
  fs.mkdirSync(ORIG, { recursive: true });
  const nombre = e.archivo.replace(/^(File|Archivo):/, '');
  const dest = path.join(ORIG, `${id}--${nombre.replace(/[^\w.-]+/g, '_')}`);
  if (fs.existsSync(dest)) return fs.readFileSync(dest);
  const espera = ultimo + PAUSA_MS - Date.now(); if (espera > 0) await sleep(espera);
  ultimo = Date.now();
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(nombre)}?width=2000`;
  for (let intento = 1; ; intento++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(dest, b); return b; }
    if (intento >= 4) throw new Error(`HTTP ${r.status} bajando ${nombre}`);
    await sleep(4000 * intento);
  }
}
async function exportar(id, imgSharp) {
  const { data, info } = await imgSharp.resize(512, 512, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  DUOTONO.aplicar(data, info.width, info.height, info.channels, DUOTONO.semillaDe(id));
  const final = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  await final.clone().webp({ quality: 82 }).toFile(path.join(OUT, `${id}.webp`));
  await final.clone().resize(128, 128).webp({ quality: 80 }).toFile(path.join(OUT, `${id}-128.webp`));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const fElegidas = path.join(DIR, 'elegidas.json');
  const elegidas = fs.existsSync(fElegidas) ? JSON.parse(fs.readFileSync(fElegidas, 'utf8')).elegidas || {} : {};
  const fPlanb = path.join(DIR, 'planb.png'), hayPlanb = fs.existsSync(fPlanb);
  const cand = fs.existsSync(path.join(DIR, 'candidatas.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'candidatas.json'), 'utf8')).musicos : {};
  const ids = Object.keys(DATA.UNITS);
  if (hayPlanb) {
    const m = await sharp(fPlanb).metadata();
    if (m.width !== CELDA * COLS || m.height !== CELDA * Math.ceil(ids.length / COLS)) throw new Error('planb.png no coincide con el plantel actual: volvé a generarla con planb.html');
  }
  const creditos = {}, estado = {};
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i], u = DATA.UNITS[id], e = elegidas[id];
    try {
      if (e && e.estado === 'foto') {
        const buf = await bajar(id, e);
        const rot = await sharp(buf).rotate().toBuffer(); // respeta la orientación EXIF
        const meta = await sharp(rot).metadata();
        await exportar(id, sharp(rot).extract(recorte(meta.width, meta.height, e)));
        creditos[id] = { nombre: u.name, tipo: 'foto', archivo: e.archivo, original: e.pagina, autor: e.autor, credito: e.credito || '',
          licencia: e.licencia, licenciaUrl: e.licenciaUrl, compartirIgual: e.tipo === 'by-sa', propia: e.tipo === 'manual', cambios: 'Recortada y con filtro duotono' };
        estado[id] = 'foto elegida';
      } else if (hayPlanb) {
        const x = (i % COLS) * CELDA, y = Math.floor(i / COLS) * CELDA;
        await exportar(id, sharp(fPlanb).extract({ left: x, top: y, width: CELDA, height: CELDA }));
        creditos[id] = { nombre: u.name, tipo: 'planb' };
        const sinCand = cand[id] && !cand[id].candidatas.length;
        estado[id] = e && e.estado === 'planb' ? 'plan B (ninguna servía)' : sinCand ? 'plan B (sin foto libre)' : 'PENDIENTE (plan B provisorio)';
      } else estado[id] = 'PENDIENTE (falta planb.png)';
    } catch (err) { estado[id] = 'ERROR: ' + err.message; }
    console.log(`${String(i + 1).padStart(2)} ${u.name.padEnd(26)} ${estado[id]}`);
  }
  const out = { generado: new Date().toISOString(),
    nota: 'Fotos de Wikimedia Commons, recortadas y con filtro duotono. Los retratos hechos a partir de fotos CC BY-SA se distribuyen bajo la misma licencia CC BY-SA.',
    retratos: creditos };
  fs.writeFileSync(path.join(OUT, 'creditos.json'), JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(OUT, 'creditos.js'), '// generado por tools/retratos/procesar.js\nwindow.RETRATOS = ' + JSON.stringify(out) + ';\n');
  // caras de 128 px embebidas: el escenario 3D las usa como textura (?caras), también abriendo el juego como archivo
  const caras = {};
  for (const id of ids) { const f = path.join(OUT, id + '-128.webp'); if (fs.existsSync(f)) caras[id] = 'data:image/webp;base64,' + fs.readFileSync(f).toString('base64'); }
  fs.writeFileSync(path.join(OUT, 'caras.js'), '// generado por tools/retratos/procesar.js\nwindow.CARAS = ' + JSON.stringify(caras) + ';\n');
  const cuenta = k => Object.values(estado).filter(s => s.startsWith(k)).length;
  console.log(`\n${cuenta('foto')} con foto · ${cuenta('plan B')} plan B · ${cuenta('PENDIENTE')} pendientes · ${cuenta('ERROR')} con error`);
})();
