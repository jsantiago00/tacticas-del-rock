/* Tácticas del Rock — FirebaseTransport: la misma interfaz que LocalTransport (ver net.js),
 * sobre Firebase Realtime Database + Auth anónima. Carga el SDK modular desde el CDN de
 * Google con import() dinámico, así no hace falta build. Necesita http(s) (no file://).
 */
'use strict';
async function createFirebaseTransport(config) {
  const V = '12.19.0', base = `https://www.gstatic.com/firebasejs/${V}/`;
  const [appM, authM, dbM] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-database.js'),
  ]);
  const app = appM.getApps().length ? appM.getApp() : appM.initializeApp(config);
  const auth = authM.getAuth(app);
  const db = dbM.getDatabase(app);
  if (config.emulator) { // desarrollo local
    authM.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    dbM.connectDatabaseEmulator(db, '127.0.0.1', 9000);
  }
  // La sesión anónima persiste en el navegador: al recargar se vuelve con el mismo uid.
  // Primero se espera a que cargue la sesión guardada; solo si no hay, se crea una nueva.
  await auth.authStateReady();
  const user = auth.currentUser || (await authM.signInAnonymously(auth)).user;
  const r = p => dbM.ref(db, p);

  let offset = 0;
  dbM.onValue(r('.info/serverTimeOffset'), s => { offset = s.val() || 0; });
  let connected = false;
  dbM.onValue(r('.info/connected'), s => { connected = s.val() === true; });

  return {
    uid: user.uid, kind: 'firebase',
    TIMESTAMP: dbM.serverTimestamp(),
    now: () => Date.now() + offset,
    get connected() { return connected; },
    async get(p) { return (await dbM.get(r(p))).val(); },
    set: (p, v) => dbM.set(r(p), v),
    update: (p, patch) => dbM.update(r(p), patch),
    async push(p, v) { return dbM.push(r(p), v).key; },
    onValue(p, cb) { return dbM.onValue(r(p), s => cb(s.val())); },
    async transaction(p, fn) {
      const res = await dbM.runTransaction(r(p), fn);
      return { committed: res.committed, value: res.snapshot.val() };
    },
    // Presencia: online mientras haya conexión; al cortarse, el servidor marca offline solo.
    presence(p) {
      const ref = r(p);
      dbM.onValue(r('.info/connected'), s => {
        if (s.val() !== true) return;
        dbM.onDisconnect(ref).set({ online: false, lastSeen: dbM.serverTimestamp() })
          .then(() => dbM.set(ref, { online: true, lastSeen: dbM.serverTimestamp() }));
      });
    },
  };
}
