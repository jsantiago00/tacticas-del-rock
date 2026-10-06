/* Filtro de los retratos: mapa de degradé del azul del escenario al dorado, con niveles automáticos
 * y grano sutil. Lo usan elegir.html (vista previa en el navegador) y procesar.js (salida final),
 * así lo que se ve al elegir es lo que sale.
 *   DUOTONO.aplicar(pixeles, ancho, alto, canales, semilla)  // modifica `pixeles` (RGB o RGBA)
 */
(function (root) {
  'use strict';
  // paradas del degradé (0 = sombra, 1 = luz): azul noche → azul escenario → dorado → crema
  const PARADAS = [
    [0.00, [11, 18, 40]],
    [0.40, [44, 62, 128]],
    [0.78, [242, 165, 65]],
    [1.00, [255, 236, 196]],
  ];
  const GRANO = 0.06;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function color(t) {
    for (let i = 1; i < PARADAS.length; i++) {
      const [t1, c1] = PARADAS[i];
      if (t <= t1) {
        const [t0, c0] = PARADAS[i - 1], k = (t - t0) / (t1 - t0);
        return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
      }
    }
    return PARADAS[PARADAS.length - 1][1];
  }
  // tabla de 256 colores, una sola vez
  const LUT = Array.from({ length: 256 }, (_, i) => color(i / 255));

  function aplicar(px, w, h, canales, semilla = 1) {
    const n = w * h, lum = new Float32Array(n), hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) {
      const o = i * canales;
      const l = 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2];
      lum[i] = l; hist[Math.min(255, l | 0)]++;
    }
    // niveles automáticos: del 2 % más oscuro al 2 % más claro
    const pct = q => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * q) return v; } return 255; };
    const lo = pct(0.02), hi = Math.max(lo + 1, pct(0.98));
    const rnd = mulberry32(semilla);
    for (let i = 0; i < n; i++) {
      let t = Math.max(0, Math.min(1, (lum[i] - lo) / (hi - lo)));
      t = 0.5 * t + 0.5 * t * t * (3 - 2 * t); // un poco más de contraste en los medios
      t = Math.max(0, Math.min(1, t + (rnd() - 0.5) * GRANO));
      const c = LUT[Math.round(t * 255)], o = i * canales;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
    }
    return px;
  }
  // semilla estable por músico (para que el grano no cambie entre corridas)
  function semillaDe(texto) { let h = 2166136261; for (const ch of String(texto)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  const api = { aplicar, semillaDe, PARADAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DUOTONO = api;
})(typeof window !== 'undefined' ? window : globalThis);
