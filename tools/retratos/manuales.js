// Fotos propias (no salen de Wikimedia Commons): se suman como candidatas en elegir.html
// y procesar.js las lee de esta carpeta en vez de bajarlas. Ojo: no tienen licencia libre;
// sirven para el juego privado, pero para publicarlo haría falta permiso del autor.
var MANUALES = {
  gimenez: { archivo: 'manuales/gimenez.png', ancho: 520, alto: 445, autor: 'Foto aportada', credito: '', licencia: 'Sin licencia libre (foto aportada)', tipo: 'manual', licenciaUrl: '' },
};
if (typeof module !== 'undefined' && module.exports) module.exports = MANUALES;
