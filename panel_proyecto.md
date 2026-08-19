# 🎮 ¿Sigue vivo? — Panel del proyecto

*Estado general · documento vivo, se va actualizando*
*Última actualización: sesión 3 — revisado contra el código real y la web en producción (platinoradar.com)*

---

## 🧭 La idea en una frase
Web/app cuidada, en español, para cazadores de platinos: ayuda a decidir **si un platino merece la pena antes de empezarlo**, con dos cosas que el líder (PSNProfiles) no da bien: si el juego sigue **vivo** para lo online, y cómo de **tedioso** es (no solo difícil).

**Naturaleza:** proyecto de pasión, sin presión de rentabilidad. Prioridad: construible en tardes, disfrutable de mantener, útil.

---

## 📊 Estado de un vistazo

| Parte | Estado |
|---|---|
| Concepto y validación de mercado | ✅ Hecho |
| Estructura de datos de un juego | ✅ Definida |
| Identidad visual (paleta azul PS vivo) | ✅ Definida y aplicada a las 4 pantallas |
| Maqueta buscador (3 veredictos) | ✅ Hecha (datos de ejemplo) |
| Maqueta ficha de juego (Dark Souls) | ✅ Hecha (datos de ejemplo + carátula real) |
| Umbrales del veredicto | ✅ Definidos (1.000 / 100 + excepciones) |
| Servidor (datos reales) | ✅ Funcionando |
| **Web publicada en internet** | ✅ **https://platinoradar.com** (dominio propio + HTTPS) — comprobado en vivo: portada, ficha (`/juego/570940`), página 404 y `legal.html` responden correctamente; `www.` redirige bien |
| Correo de contacto | ✅ contacto@platinoradar.com |
| Textos legales y consentimiento | ✅ Hechos (sin banner de cookies: solo técnicas) |
| Buscador funcional | ✅ Hecho (confirmado en producción: autocompletado, redirección inteligente y página de resultados) |
| Página de inicio | ✅ Maqueta hecha |
| Página de perfil de usuario | ✅ Maqueta hecha (función necesita servidor) |
| Verificación anti-fraude de platinos | ⏳ Definida (método PSNProfiles); pendiente servidor |
| Base de datos | ✅ Supabase (Postgres + RLS) |
| Cuentas de usuario | ✅ Registro y login funcionando |
| Perfiles públicos + niveles | ✅ Hechos |
| Votos de tedio de la comunidad | ✅ Funcionando |
| Entorno de desarrollo | Linux (CachyOS) · Node 26 |

Leyenda: ✅ hecho · 🟡 a medias · ⏳ siguiente · ❌ no empezado

---

## 🏗️ Las tres fases del proyecto

**Fase 1 — Maquetas (AHORA)**
Diseñar cómo se ve y se siente todo, con datos de ejemplo. Barato de cambiar, sin fontanería.

**Fase 2 — Que funcione de verdad**
Montar el servidor → número de jugadores real + buscador de cualquier juego. El salto de "bonito" a "útil".

**Fase 3 — Base de datos y usuarios**
Panel para añadir juegos cómodamente, cuentas de usuario, perfiles, votación de tedio de la comunidad.

---

## ✅ Hecho hasta ahora
- Estudio de mercado completo (11 ideas descartadas con su razón).
- Documento de proyecto limpio.
- Concepto afinado: el valor está en "estado vivo/muerto" + "tedio", en español, para un nicho fiel.
- **Estructura de datos por juego** definida (campos consistentes).
- **Lógica del estado** definida: el nº de jugadores solo manda si el platino `requiere_multitud`.
- Maqueta del **buscador** con los 3 veredictos (Vivo/Moribundo/Muerto).
- Maqueta de la **ficha de juego** con Dark Souls (estado + tedio doble + planificación + carátula real de Steam).

---

## 📐 Estructura de datos por juego (definida)
`nombre` · `plataforma` · `steam_appid` · `tipo_online_platino` (offline / con_amigos / requiere_multitud) · `tedio_autor` (1-5) · `tedio_comunidad` (media votos) · `perdibles` (sí/no + aviso) · `dato_duro_opcional` (dificultad, horas)

**Lógica del estado:**
- offline → Vivo siempre.
- con_amigos → Vivo aunque haya pocos jugadores (nº = contexto).
- requiere_multitud → nº de jugadores decide Vivo/Moribundo/Muerto.

---

## ⏳ Tareas pendientes (por orden sugerido)

### Diseño (se puede hacer ya, sin servidor)
- [x] Afinar identidad visual. ✅ **Azul PlayStation vivo (#0070D1)** como protagonista sobre base azul calmada, con acabado metálico (reflejos, brillos). Aplicada a las 4 pantallas. Colores de estado: verde #3fd98f / ámbar / rojo.
- [x] Afinar **umbrales** del veredicto para `requiere_multitud`. ✅ Criterio: **Vivo +1.000 · Moribundo 100–1.000 · Muerto <100** jugadores concurrentes. Calibrado con datos reales (superventas online rondan 100.000, son el techo; el suelo útil está mucho más abajo). Explicados en un tooltip (icono "i") en la ficha.
- [x] Añadir a la estructura de datos un campo **`estado_forzado` opcional**. ✅ Confirmado en `juegos.json` (presente en los 7 juegos, usado como `"vivo"` en uno) y en `server.js` (`calcularVeredicto` lo respeta antes que el cálculo automático).
- [x] Diseñar **página de inicio** (portada + buscador + destacados). ✅
- [x] Diseñar **maqueta de perfil de usuario** (con datos de ejemplo). ✅
- [x] Decidir: ¿la primera versión necesita perfil de usuario, o puede esperar? ✅ Resuelto de facto: el perfil ya está construido, desplegado y funcionando en producción (`/perfil/usuario`).

### Técnico (fase 2 en adelante)
- [x] Montar **servidor** para el nº de jugadores real (Steam API). ✅ **Node.js 24 LTS + Express**, en `C:\Proyectos\platino-radar`. Endpoint `/api/jugadores/:appid` devuelve nº real + veredicto calculado. Arranca con `node server.js` en `http://localhost:3000`. La API de jugadores de Steam **no requiere clave**.
- [x] Servir imágenes/carátulas desde el propio dominio. ✅ Endpoint `/api/caratula/:appid` proxea desde Steam con caché de 1 día → **resuelto el bloqueo de Brave/iOS**.
- [x] Ficha conectada al servidor: pinta el nº real y actualiza el badge de estado automáticamente. ✅
- [x] Layout de escritorio (ancho 1120px, tedio y planificación en paralelo, textos mayores). ✅
- [x] **Desplegar en internet.** ✅ **Render** (plan Free, región Frankfurt), desplegado desde GitHub (`github.com/pulopr/platino-radar`). URL: **https://platino-radar.onrender.com** — HTTPS/TLS automático incluido. Auto-deploy: cada `git push` redespliega solo (si no lo detecta, botón *Manual Deploy → Deploy latest commit*).
  - Aprendizajes: el puerto debe ser `process.env.PORT || 3000`; hace falta `"start": "node server.js"` en package.json; y `express.static(path.join(__dirname,'public'))` debe ir **al principio**, antes de las rutas de API.
  - Limitación del plan Free: la instancia se duerme tras inactividad y la primera carga puede tardar ~50 s.
- [x] **Ficha dinámica.** ✅ Una sola plantilla (`public/juego.html?id=APPID`) sirve para cualquier juego. Datos en `juegos.json` (raíz, fuera de `public`), servidos por el endpoint `/api/juego/:appid`, que combina los datos del archivo + jugadores en vivo + cálculo del estado (respetando `tipo_online` y `estado_forzado`). **Añadir un juego = añadir un bloque al JSON.**
- [x] **Página de inicio conectada.** ✅ `public/index.html` es ahora la portada real: buscador + recomendaciones generadas automáticamente desde `juegos.json` (campo `"destacado": true`) vía el endpoint `/api/destacados`. Cada tarjeta muestra carátula (por proxy), etiqueta de estado y jugadores en vivo, y enlaza a su ficha. Ancho igualado al de la ficha (1120px). **Límite fijado en 6** (antes 12, sin tope real): el servidor (`server.js`) ahora corta en `.slice(0, 6)`. El autor decide a mano cuáles son esos 6 con el campo `destacado` de cada juego; con 7 juegos en el catálogo, se quitó `destacado` a **Lords of the Fallen**, quedando: Dark Souls II, Dark Souls III, Dark Souls Remastered, Sekiro, Elden Ring y Bloodborne.
- [x] **Buscador completo** ✅ El desplegable sugiere mientras escribes; al enviar, el servidor (`/buscar?q=`) decide: **coincidencia exacta o un solo resultado → ficha**; **varios o ninguno → `public/resultados.html`**. La búsqueda ignora acentos y mayúsculas. Funciona como formulario real (sirve sin JavaScript y la búsqueda queda en la URL, compartible). Texto escapado para evitar inyección desde la URL.
- [x] `pagina_inicio.html` y `pagina_perfil.html` — resuelto. ✅ Confirmado que eran maquetas estáticas obsoletas (título antiguo "¿Sigue vivo?", sin `fetch` ni conexión a Supabase, no referenciadas en ningún otro archivo) ya sustituidas por `public/index.html` y `public/perfil.html`. **Borradas** (`git rm`, quedan en el historial de git). Pendiente: hacer `git push` para subir el borrado.
- [ ] Empezar a **rellenar fichas** de los juegos favoritos del autor. 🟡 En marcha: **8 juegos** en el catálogo (`juegos.json`) tras añadir **Astro's Playroom** (`astros-playroom`, sin Steam, offline, tedio 3/5, dificultad 2,5/10 — media entre el 2/10 de consenso comunitario y la percepción del autor —, duración ~4-6 h según fuentes). Sin destacar en portada. **Pendiente: falta la carátula**, el autor la subirá más adelante.
- [x] Reservar dominio **Platino Radar** y apuntarlo a Render. ✅ Ya hecho (ver más abajo, sección "Dominio y correo"): `platinoradar.com` registrado y funcionando con HTTPS. Esta casilla estaba desactualizada.

### Fase 3 — COMPLETADA ✅
- [x] **Base de datos:** Supabase (plan Free, Frankfurt). Tablas `perfiles` y `platinos` con **RLS activado** y políticas por dueño.
- [x] **Cuentas de usuario:** registro (usuario + correo + contraseña), login con **correo o nombre de usuario**. Autenticación gestionada por Supabase (contraseñas hasheadas por ellos).
- [x] **Perfiles públicos:** `/perfil.html` (el mío) y `/perfil.html?u=nombre` (de otros). Avatar, recuento, **nivel cada 10 platinos** con barra de progreso.
- [x] **Registro de platinos** desde el perfil (buscador) o **automáticamente al votar** en la ficha.
- [x] **Votación de tedio:** cuadritos pulsables en la ficha; el voto se guarda, añade el platino al perfil y actualiza la **media de la comunidad** al instante.
- [x] Archivos: `public/auth.js` (módulo compartido), `public/cuenta.html`, `public/perfil.html`. Endpoints `/api/resolver-usuario` y `/api/usuario-libre`.

### Dominio y correo ✅
- **Dominio propio:** `platinoradar.com` (Cloudflare Registrar, ~10 $/año sin subida en renovación).
- **DNS:** dos CNAME (`www` y `@`) → `platino-radar.onrender.com`, en modo **DNS only** (nube gris; con proxy naranja Render no valida el certificado).
- **Correo:** `contacto@platinoradar.com` vía Cloudflare Email Routing (reenvío gratuito al Gmail personal). Solo recibe; para responder desde esa dirección haría falta configurar SMTP en Gmail.

### Cumplimiento legal ✅
- **`public/legal.html`**: aviso legal (LSSI), política de privacidad (RGPD/LOPDGDD), política de cookies y condiciones de uso.
- **Checkbox de consentimiento obligatorio** en el registro (bloquea el alta si no se marca).
- Enlaces legales en el pie de portada, ficha y perfil.
- **Sin banner de cookies:** solo se usa almacenamiento técnico de sesión, exento de consentimiento (art. 22.2 LSSI). ⚠️ Si algún día se añade analítica, publicidad o afiliación, **el banner pasa a ser obligatorio** y hay que actualizar la política.
- Ventaja: Supabase y Render en Fráncfort → **sin transferencias internacionales** de datos.
- ⚠️ Base sólida, pero no revisada por abogado. Conviene revisión profesional si el proyecto crece o se monetiza.
- ⚠️ Si se monetiza: obligaciones fiscales (alta de autónomo, facturación) — consultar con gestoría.

### Pendiente de la fase 3
- [x] **Variables de entorno en Render** (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`). ✅ Sin ellas el servidor no arrancaba (`createClient` falla al inicio y tumba todo).
- [x] **"He olvidado mi contraseña"** ✅ Enlace en el login (acepta correo o nombre de usuario) → correo de Supabase → `public/nueva-clave.html` para fijar la nueva. Mensaje idéntico exista o no la cuenta (evita enumerar correos). Requiere **Redirect URLs** configuradas en Supabase (`https://platinoradar.com/**` y `http://localhost:3000/**`).
- [x] **Botón de ver/ocultar contraseña** en login, registro y nueva contraseña. ✅
- [x] **Cliente de Supabase centralizado en `auth.js`** ✅ `cuenta.html` ya no duplica la clave (la duplicación causó dos días de fallos de login "fantasma").
- [ ] **Reactivar la verificación por correo** antes de abrir la web al público. ⚠️ No se puede confirmar por código: es un interruptor en el panel de Supabase ("Confirm email"). No hay rastro en `cuenta.html` de un flujo de "revisa tu correo", lo que cuadra con que sigue desactivada. Confírmalo tú mismo en el panel de Supabase para estar seguro.
- [ ] ⚠️ El correo lo envía Supabase con **límite bajo** (solo válido para pruebas). Para uso real, conectar un proveedor propio (Resend, Brevo…). Confirmado pendiente: no hay ninguna dependencia de Resend/Brevo en `package.json`.
- [ ] Lista de **"próximos platinos"** (deseados) en el perfil — requiere tabla nueva. Confirmado pendiente: no existe ese campo/tabla ni en el código ni en `auth.js`.
- [x] **URLs bonitas** ✅ `/juego/570940` y `/perfil/pulopr`. Rutas en Express que sirven los mismos HTML; el archivo lee el id de la ruta (o del `?id=` antiguo, que sigue funcionando por compatibilidad).
- [x] **Página 404 propia** ✅ `public/404.html` con la estética del proyecto. Las peticiones a `/api/` devuelven JSON en vez de HTML.
- [x] **Servidor tolerante a fallos de configuración** ✅ Si faltan variables de entorno ya no se cae: arranca, avisa en los registros de cuál falta, y solo los endpoints de cuentas devuelven un 503 controlado.
- [ ] **Lista de "próximos platinos" en el perfil:** juegos que el usuario quiere platinar en el futuro (lista de deseos). Muestra el estado (vivo/moribundo/muerto) y el tedio de cada uno para ayudar a **priorizar** cuál atacar antes (ej. "hazlo antes de que el online muera"). Refuerza el valor diferencial de la herramienta y da motivo para volver. *(Duplicado de la tarea de arriba — misma tarea, sigue pendiente.)*
- [x] **Verificación anti-fraude de platinos (método PSNProfiles).** ✅ **YA IMPLEMENTADO**, esta línea estaba desactualizada — ver más abajo la sección "C) Verificación con PSN e importación de platinos ✅ HECHO", que sí refleja el estado real. `psn.js` y los endpoints `/api/psn/iniciar`, `/verificar`, `/sincronizar`, `/desvincular` funcionan.
- [x] Votación de tedio de la comunidad (alimentada por los votos del perfil). ✅ **YA IMPLEMENTADO** (coincide con la tabla de estado general, que ya lo marcaba hecho). Confirmado en `auth.js` (`tedioComunidad`) y en producción (`juego.html` pinta la media real de la comunidad).
- [ ] Salto a **PlayStation** (dato estimado, etiquetado). Confirmado pendiente: no hay ningún dato de trofeos/porcentajes de PS en el código todavía.
- [ ] Planificador de platinos + checklist de coleccionables. 🟡 A medias: cada juego ya tiene un bloque de **avisos de planificación** (texto fijo, campo `planificacion` en `juegos.json`, pintado en `juego.html`), pero no hay un **checklist interactivo y marcable** de coleccionables — esa parte sigue sin empezar.

---

## 💡 Ideas apuntadas (para no perderlas)
- **Tedio con frase de contexto** del autor, no solo el número ("4/5, pesado por el farmeo pero satisfactorio").
- **Doble nota de tedio** (autor + comunidad), estilo crítica/público.
- **El perfil alimenta la comunidad:** cada usuario registra sus platinos y vota su tedio → esos votos llenan la nota de tedio de la comunidad en las fichas. Resuelve el huevo-y-la-gallina de forma natural.
- **Niveles de platino** en el perfil (idea: cada 10 platinos un nivel; nombres/números por afinar). Con barra de progreso al siguiente nivel.
- Carátula y datos salen del **mismo App ID** → cada juego añadido trae su portada automática.
- Categoría "online opcional recomendado" → decidido meterla dentro de `con_amigos`.
- (Pendiente de desarrollar) Ideas del autor para la **página de perfil**.

---

## 🧭 Orientación del proyecto (decisión clave)

**El público objetivo son los cazadores de platinos de PlayStation**, que es donde está la comunidad. El término "platino" es de PlayStation; en Steam son "logros". El propio nombre de la web lo refleja.

**Reparto de fuentes de datos:**

| Dato | Fuente | Motivo |
|---|---|---|
| **Porcentajes de consecución de trofeos** | **PlayStation** (nativo, sin extrapolar) | Es el dato auténtico para el público objetivo. Extrapolar desde Steam sería engañoso: las comunidades no se comportan igual (en PC hay muchas compras en rebajas sin jugar, lo que distorsiona los porcentajes). |
| **Iconos de trofeos** | PlayStation | Solo existen ahí. |
| **Nº de jugadores en vivo** ("¿sigue vivo?") | Steam (segundo plano) | Sony **no publica** esta cifra. Steam sirve como **termómetro** de si la comunidad del juego sigue activa. Se debe explicar con honestidad al usuario. |
| **Carátulas** | Steam (+ archivos propios para exclusivos) | Práctico y ya funcionando. |

⚠️ **Riesgo asumido conscientemente:** los datos de PlayStation salen de una API **no oficial** (`psn-api`, ingeniería inversa de la API interna de Sony) o de una API de pago (`PSN Leaderboard`). Menos estable que Steam; habrá que estar pendiente de que siga funcionando.

---

## 🔜 Próximas funcionalidades (decididas, pendientes de hacer)

### A) Expositor de platinos en el perfil ✅ HECHO
El usuario destaca hasta **3 platinos** en una vitrina en la parte alta del perfil.
- Sin orden y sin texto asociado (decisión tomada: mantenerlo simple).
- Implementado: columna `destacado` (boolean) en la tabla `platinos` + función `destacarPlatino()` en `auth.js` (valida el máximo de 3) + sección "Mi vitrina" en `perfil.html`, con estrella ★ en cada platino de la lista para subirlo o quitarlo.
- Visible también en perfiles ajenos, en modo lectura.

### A2) Textos reorientados a PlayStation ✅ HECHO
- La ficha ya no dice "EN VIVO · STEAM" sino **"COMUNIDAD ACTIVA"**, con un interrogante que explica que la cifra viene de PC porque PlayStation no publica ese dato.
- El bocadillo de estados ya no menciona umbrales de Steam; habla de "comunidad amplia" o "de capa caída", con nota al pie sobre la fuente.
- Portada: *"Antes de lanzarte a por un platino, comprueba si el juego sigue vivo para sus trofeos online…"*

### B) Los 3 trofeos más difíciles en la ficha del juego
Mostrar los tres trofeos con **menor porcentaje de consecución**, con su icono.
- **Fuente decidida: PlayStation**, sin extrapolar desde Steam.
- Acceso vía `psn-api` (API interna no oficial) o `PSN Leaderboard` (de pago, datos preprocesados y con español).
- Requiere guardar/consultar por juego: nombre del trofeo, icono, porcentaje y tipo (bronce/plata/oro/platino).
- ⚠️ Los **iconos de trofeos son imágenes con derechos** de cada desarrolladora. Enlazarlas desde su origen en contexto informativo es la práctica habitual del sector (PSNProfiles), pero conviene tenerlo presente.
- Pendiente: decidir si los datos se cachean (recomendable, para no depender de la API en cada visita ni saturarla).

---

### C) Verificación con PSN e importación de platinos ✅ HECHO

**Archivos y endpoints:** `psn.js` (en la raíz, NO en public) gestiona la conexión y la autorización (reutiliza el token, lo renueva con el *refresh token* y solo recurre al NPSSO si falla). Endpoints: `/api/psn/iniciar`, `/api/psn/verificar`, `/api/psn/sincronizar`, `/api/psn/desvincular`. Panel de vinculación dentro del perfil.

**⚠️ Aprendizajes clave del desarrollo:**
1. **La cuenta que autentica NO puede buscarse a sí misma** en la API de Sony. Por eso se usa una **cuenta secundaria de PSN** solo para el proyecto; así el autor también puede verificarse como un usuario más.
2. **Los nombres de PSN no coinciden con los del catálogo.** PSN escribe `DARK SOULS™ Ⅱ: Scholar of the First Sin` donde el JSON dice `Dark Souls II: Scholar...`. La normalización quita ™®©, acentos, apóstrofos y puntuación, y convierte los **numerales romanos Unicode** (`Ⅱ` no son dos letras I) a letras normales.
3. Solo se importan los platinos **con ficha en el catálogo**. Los que no la tienen son, de hecho, una **lista de trabajo priorizada por demanda real**.

**Pendiente de esta parte:**
- [x] Añadir `PSN_NPSSO` a las variables de entorno de **Render**. ✅ Confirmado por el autor directamente en el panel de Render: la variable está puesta.
- [ ] ⏰ **Renovar el NPSSO cada ~2 meses** desde playstation.com con la cuenta del proyecto. (Tarea recurrente de mantenimiento, no un "pendiente" que se cierre una vez.)
- [x] Impedir votar a los no verificados. ✅ **Hecho por completo, en dos capas.** Interfaz: `public/juego.html` (`pintarZonaVoto`) comprueba `yo.psn_verificado` y, si es falso, muestra un aviso invitando a vincular PSN en vez de los cuadritos de voto. Base de datos: *trigger* `trg_impedir_voto_no_verificado` en la tabla `platinos` (ejecutado por el autor en el SQL Editor de Supabase), que rechaza cualquier `tedio_voto` si el perfil no tiene `psn_verificado = true` — cierra el hueco de saltarse la interfaz desde la consola del navegador.
- [x] Quitar el añadido automático de platino al votar. ✅ `public/juego.html` ya no usa `guardarPlatino()` (que hacía *upsert*, creaba el platino si no existía). Ahora usa una nueva función `actualizarVoto()` (en `auth.js`) que **solo actualiza** un platino que ya existe — si el juego no está entre los platinos importados de PSN del usuario, se le avisa y no se crea nada. `guardarPlatino()` se conserva tal cual para su otro uso legítimo: el alta manual de platinos desde el perfil (usuarios no verificados).
- [ ] Valorar guardar el `npCommunicationId` en `juegos.json` para emparejar de forma exacta. Confirmado pendiente: ese campo no existe todavía en ningún juego del catálogo.

### Diseño original (referencia)

**Cómo funciona el sistema completo:**

| | Usuario **verificado** (PSN vinculada) | Usuario **no verificado** |
|---|---|---|
| Platinos | **Se importan automáticamente** desde su perfil de PSN | Los añade a mano |
| Sello en el perfil | ✅ Verificado | ○ No verificado |
| Votar el tedio | **Sí**, pero solo de juegos que tenga platinados | **No puede votar** |

**Razonamiento:** quien quiere credibilidad y voz en las valoraciones se verifica; quien solo quiere llevar su lista personal puede hacerlo sin verificar. Así **nadie desvirtúa la media de tedio**, y un perfil falseado es posible pero carece de credibilidad al no tener el sello.

**Reglas concretas:**
- Al vincular PSN, los platinos se importan solos → **desaparece la redundancia** de añadirlos a mano.
- **Al verificarse, se sincroniza y se eliminan los platinos que no consten en PSN.** Si alguien había inflado su perfil sin verificar, al verificarse se queda solo con los reales.
- **Se elimina el comportamiento actual** de añadir el platino automáticamente al votar en la ficha (incompatible con este modelo).
- Si un usuario no verificado intenta votar → invitarle a vincular su cuenta de PSN.
- ⚠️ Al importar de PSN hay que **filtrar solo los platinos** (hay trofeos de plataformas antiguas y juegos sin platino).

**Método de verificación (ya investigado):** el de PSNProfiles. El perfil de PSN es público → se leen sus trofeos reales. Para probar que la cuenta es suya: se le da una clave, la pone temporalmente en su "Acerca de mí" de PSN, el sistema comprueba que aparece, y luego la quita. Se hace una sola vez.

**Decisiones tomadas:**

1. **Votos existentes:** se **borran todos** al implantar el sistema (se hará antes de abrir la web al público, así que solo hay votos de prueba).

2. **Si un usuario se desvincula de PSN:** pasa a estado **no verificado**, pero **los platinos que ya se verificaron se mantienen como verificados**. Los que añada a partir de ese momento no lo son.
   - ⚠️ **Implicación de diseño:** la verificación deja de ser una propiedad del *usuario* y pasa a serlo de **cada platino**. La tabla `platinos` necesita su propio campo `verificado` (booleano), además del sello en el perfil.
   - Pendiente de decidir: qué sello muestra un perfil mixto (ej. "20 de 25 verificados", o marcar los no verificados en la lista).

3. **Frecuencia de sincronización:** cada vez que el usuario entra en su perfil.
   - ⚠️ **Matiz técnico:** sincronizar en *cada* visita satura la API no oficial de Sony y arriesga bloqueos. Implementar con **intervalo mínimo** (p. ej., si se sincronizó hace menos de 1 h, no repetir). El usuario lo percibe actualizado y no se abusa de la API.

---

## ⚠️ Notas y riesgos conocidos
- **`git push` al final de CADA sesión.** Se perdieron `auth.js`, `cuenta.html` y `perfil.html` al formatear para instalar Linux, porque no estaban subidos. Lo que no está en GitHub, no existe.
- **No duplicar claves en varios archivos.** Tener la clave de Supabase en `auth.js` y en `cuenta.html` provocó dos días de "contraseñas incorrectas" que en realidad eran un marcador `PEGA_AQUI` sin sustituir. Ahora el cliente vive solo en `auth.js`.
- **El `.env` no se sube a GitHub** (correcto), así que hay que guardarlo aparte antes de formatear o cambiar de equipo.
- Steam da nº de jugadores real; PlayStation solo estimación (Sony no tiene API pública de player count).
- Llamar a Steam desde el navegador está bloqueado (CORS) → hace falta servidor propio.
- El **perfil de usuario** es la parte más compleja del proyecto (cuentas, login, seguridad). Valorar si es necesario para la v1 o puede esperar.
- Datos de trofeos PS (a futuro): librería de comunidad `psn-api` (no oficial) o API de pago `PSN Leaderboard`.

---

## 📂 Archivos del proyecto

**Documentación**
- `estudio_mercado.md` — recorrido completo de las 11 ideas descartadas.
- `proyecto_platinos.md` — documento de proyecto detallado.
- `panel_proyecto.md` — este panel (estado general).

**Código** (en `~/proyectos/platino-radar`)
- `server.js` — servidor Express con todos los endpoints.
- `juegos.json` — datos de los juegos (raíz, fuera de `public`).
- `.env` — claves de Supabase (NO se sube a GitHub).
- `public/index.html` — portada (buscador + destacados).
- `public/juego.html` — ficha de juego (`/juego/APPID`).
- `public/perfil.html` — perfil de usuario (`/perfil/USUARIO`).
- `public/resultados.html` — resultados de búsqueda.
- `public/cuenta.html` — registro e inicio de sesión.
- `public/nueva-clave.html` — restablecer contraseña.
- `public/legal.html` — aviso legal, privacidad, cookies y condiciones.
- `public/404.html` — página no encontrada.
- `public/auth.js` — módulo compartido de sesión y funciones de Supabase.
- `public/logo.png` · `public/img/` — logo y carátulas propias.
