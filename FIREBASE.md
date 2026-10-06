# Configurar Firebase (modo online)

Sin esto el juego funciona igual en modo **Solo vs bots**. El modo online necesita un
proyecto de Firebase (plan gratuito Spark) con Auth anónima y Realtime Database.

## 1. Crear el proyecto
1. Entrá a <https://console.firebase.google.com> → **Agregar proyecto**.
2. Nombre: `tacticas-del-rock` (o el que quieras). Google Analytics: no hace falta, desactivalo.
3. **Crear proyecto**.

## 2. Activar la autenticación anónima
1. Menú **Compilación → Authentication → Comenzar**.
2. Pestaña **Método de acceso** → **Anónimo** → activar → **Guardar**.

## 3. Crear la base de datos
1. **Compilación → Realtime Database → Crear base de datos**.
2. Ubicación: **Estados Unidos (us-central1)**. No se puede cambiar después.
3. Reglas de seguridad: **Comenzar en modo bloqueado** → **Habilitar**.

## 4. Cargar las reglas
1. En **Realtime Database**, pestaña **Reglas**.
2. Borrá todo y pegá el contenido de [`database.rules.json`](database.rules.json).
3. **Publicar**.

Alternativa por línea de comandos (desde la carpeta del repo):
```
npx firebase login
npx firebase use --add          # elegí tu proyecto
npx firebase deploy --only database
```

## 5. Registrar la app web y copiar la configuración
1. Engranaje ⚙ → **Configuración del proyecto** → **General** → "Tus apps" → ícono **`</>`** (Web).
2. Apodo: `web`. **No** marques Firebase Hosting. **Registrar app**.
3. Copiá el objeto `firebaseConfig` y pegalo en [`firebase-config.js`](firebase-config.js),
   reemplazando `window.FIREBASE_CONFIG = null;` por:
   ```js
   window.FIREBASE_CONFIG = { apiKey: "…", authDomain: "…", databaseURL: "…", projectId: "…", appId: "…" };
   ```
4. Revisá que tenga **`databaseURL`**. Si no aparece, copiala de Realtime Database
   (la URL que está arriba de los datos, del tipo `https://tacticas-del-rock-default-rtdb.firebaseio.com`).

La configuración es pública por diseño: la seguridad la dan las reglas.

## 6. Autorizar tu dominio
1. **Authentication → Configuración → Dominios autorizados → Agregar dominio**.
2. Agregá `santiagososa.com.ar` (y `jsantiago00.github.io` si alguna vez lo abrís desde ahí).
   `localhost` ya viene autorizado.

## 7. HTTPS en GitHub Pages
En el repo: **Settings → Pages → Enforce HTTPS** (si está gris, esperá a que GitHub
termine de emitir el certificado del dominio y volvé a intentar).

## 8. Publicar
```
git add firebase-config.js
git commit -m "Config de Firebase"
git push
```
En 1-2 minutos, en la página: **Online con amigos → Crear partida** y pasales el link o el código.

---

## Cómo funciona (resumen)
- El **host** (quien crea la sala) es el único que escribe el estado. Los demás mandan
  intenciones a `rooms/{código}/actions` y el host las aplica en orden.
- Si el host se desconecta más de 10 s, lo reemplaza el humano conectado con menor uid.
- Si alguien recarga la página, vuelve a su lugar (la sesión anónima queda guardada en el navegador).
- Las salas sin actividad por más de 24 h se borran cuando alguien crea una nueva.

## Límites del plan gratuito
100 conexiones simultáneas, 1 GB guardado y 10 GB de descarga por mes. Una partida de
4 humanos usa unos 15 MB de descarga en total: alcanza para cientos de partidas por mes.

## Seguridad (pensada para jugar entre amigos)
- Solo usuarios autenticados (anónimos) pueden leer o escribir.
- Solo el host actual escribe el estado; cada jugador solo puede escribir sus propias
  acciones, su presencia y su "listo".
- No es anti-trampas: cualquiera con el código puede leer la sala (incluidas las tiendas
  de los demás), y un miembro podría forzar ser host.

## Probar en tu PC sin tocar el proyecto real (opcional)
Necesita Java 11+.
```
npx firebase emulators:start --only database,auth --project demo-tacticas
```
Serví la carpeta por http (por ejemplo `npx http-server -p 8080`) y abrí
`http://localhost:8080/?emu` en varias ventanas de incógnito o navegadores distintos.
