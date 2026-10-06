/* Configuración web de Firebase. Es pública por diseño: la seguridad la dan las reglas
 * (database.rules.json). Pegá acá el objeto que te da la consola de Firebase en
 * Configuración del proyecto -> Tus apps -> App web -> "firebaseConfig".
 * Si es null, el juego funciona solo en modo local (contra bots). */
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyChEOpY6rx4Wj8mQxhs-OMGBGaRd9X286U',
  authDomain: 'tacticas-del-rock.firebaseapp.com',
  databaseURL: 'https://tacticas-del-rock-default-rtdb.firebaseio.com',
  projectId: 'tacticas-del-rock',
  appId: '1:59099150807:web:becd37346dff9c9da67392',
};

// Desarrollo: con ?emu en la URL se usa el emulador local (firebase emulators:start).
if (/[?&]emu\b/.test(location.search)) {
  window.FIREBASE_CONFIG = { apiKey: 'demo-key', projectId: 'demo-tacticas', databaseURL: 'http://127.0.0.1:9000/?ns=demo-tacticas-default-rtdb', emulator: true };
}
/* Ejemplo:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "tacticas-del-rock.firebaseapp.com",
  databaseURL: "https://tacticas-del-rock-default-rtdb.firebaseio.com",
  projectId: "tacticas-del-rock",
  appId: "1:123:web:abc",
};
*/
