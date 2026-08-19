const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');
const fs = require('fs');
require('dotenv').config({ quiet: true });
const { createClient } = require('@supabase/supabase-js');
const psn = require('./psn');

// --- Cliente de Supabase (clave secreta: SOLO en el servidor) ---
// Si faltan las variables, el servidor arranca igualmente: la web funciona
// y solo fallan los endpoints que necesitan Supabase, con un error claro.
let supabaseAdmin = null;
const faltan = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'].filter(v => !process.env[v]);

if (faltan.length) {
  console.warn('⚠️  Faltan variables de entorno: ' + faltan.join(', '));
  console.warn('   El sitio funcionará, pero el login por nombre de usuario y el');
  console.warn('   registro no estarán disponibles. Revisa el .env (local) o las');
  console.warn('   variables de entorno del alojamiento (producción).');
} else {
  supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
}

// Middleware para los endpoints que sí necesitan Supabase
function exigeSupabase(req, res, next) {
  if (!supabaseAdmin) {
    return res.status(503).json({
      error: 'Servicio de cuentas no disponible temporalmente. Inténtalo más tarde.'
    });
  }
  next();
}

// Para leer JSON en las peticiones POST
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

// --- Umbrales del veredicto ---
function calcularEstado(jugadores) {
  if (jugadores >= 1000) return { estado: 'vivo', etiqueta: 'Vivo' };
  if (jugadores >= 100)  return { estado: 'moribundo', etiqueta: 'Moribundo' };
  return { estado: 'muerto', etiqueta: 'Muerto' };
}

// --- Consulta el número de jugadores en vivo en Steam ---
async function consultarJugadores(appid) {
  try {
    const r = await fetch(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`);
    if (!r.ok) return null;
    const datos = await r.json();
    return typeof datos?.response?.player_count === 'number' ? datos.response.player_count : null;
  } catch (err) {
    console.error('Error consultando Steam:', err.message);
    return null;
  }
}

// --- Lee el archivo de juegos ---
function leerJuegos() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'juegos.json'), 'utf8'));
}

// --- Calcula el veredicto de un juego según su tipo de online ---
function calcularVeredicto(juego, jugadores) {
  if (juego.estado_forzado) {
    const etiquetas = { vivo: 'Vivo', moribundo: 'Moribundo', muerto: 'Muerto' };
    return { estado: juego.estado_forzado, etiqueta: etiquetas[juego.estado_forzado] };
  }
  // Offline o "con amigos": no depende de que haya multitud conectada
  if (juego.tipo_online === 'offline' || juego.tipo_online === 'con_amigos') {
    return { estado: 'vivo', etiqueta: 'Vivo' };
  }
  // requiere_multitud: manda el número de jugadores
  return calcularEstado(jugadores ?? 0);
}

// --- Endpoint: número de jugadores en vivo de un juego de Steam ---
app.get('/api/jugadores/:appid', async (req, res) => {
  const { appid } = req.params;
  if (!/^\d+$/.test(appid)) {
    return res.status(400).json({ error: 'appid no válido' });
  }

  const jugadores = await consultarJugadores(appid);
  if (jugadores === null) {
    return res.status(404).json({ error: 'No hay datos de jugadores para ese juego' });
  }

  res.json({ appid: Number(appid), jugadores, ...calcularEstado(jugadores) });
});

// --- Endpoint: datos completos de un juego (ficha) ---
app.get('/api/juego/:appid', async (req, res) => {
  const { appid } = req.params;
  // Permite ids numéricos (Steam) o alfanuméricos (juegos sin Steam)
  if (!/^[a-z0-9_-]+$/i.test(appid)) {
    return res.status(400).json({ error: 'id no válido' });
  }

  let juegos;
  try {
    juegos = leerJuegos();
  } catch (e) {
    console.error('Error leyendo juegos.json:', e.message);
    return res.status(500).json({ error: 'No se pudieron leer los datos de juegos' });
  }

  const juego = juegos[appid];
  if (!juego) {
    return res.status(404).json({ error: 'Juego no encontrado en la base de datos' });
  }

  // Solo consultamos Steam si el juego está en Steam
  const jugadores = juego.sin_steam ? null : await consultarJugadores(appid);

  res.json({ appid, jugadores, ...calcularVeredicto(juego, jugadores), ...juego });
});

// --- Endpoint: juegos destacados para la portada ---
app.get('/api/destacados', async (req, res) => {
  let juegos;
  try {
    juegos = leerJuegos();
  } catch (e) {
    console.error('Error leyendo juegos.json:', e.message);
    return res.status(500).json({ error: 'No se pudieron leer los datos de juegos' });
  }

  const destacados = Object.entries(juegos)
    .filter(([, j]) => j.destacado)
    .slice(0, 12);

  // Consultamos todos en paralelo para que sea rápido
  const resultado = await Promise.all(destacados.map(async ([appid, j]) => {
    const jugadores = j.sin_steam ? null : await consultarJugadores(appid);
    return {
      appid,
      nombre: j.nombre,
      plataforma: (j.plataformas && j.plataformas[0]) || '',
      sin_steam: !!j.sin_steam,
      jugadores,
      ...calcularVeredicto(j, jugadores)
    };
  }));

  res.json(resultado);
});

// --- Normaliza texto para comparar nombres de juegos ---
// Quita acentos, símbolos de marca, numerales romanos Unicode, signos de
// puntuación y espacios sobrantes. PSN escribe "DARK SOULS™ Ⅱ: Scholar..."
// donde nuestro catálogo dice "Dark Souls II: Scholar...".
const ROMANOS = {
  'Ⅰ':'I','Ⅱ':'II','Ⅲ':'III','Ⅳ':'IV','Ⅴ':'V','Ⅵ':'VI','Ⅶ':'VII','Ⅷ':'VIII','Ⅸ':'IX','Ⅹ':'X',
  'ⅰ':'i','ⅱ':'ii','ⅲ':'iii','ⅳ':'iv','ⅴ':'v','ⅵ':'vi','ⅶ':'vii','ⅷ':'viii','ⅸ':'ix','ⅹ':'x'
};

function normalizar(texto) {
  let t = (texto || '');

  // Numerales romanos Unicode → letras normales
  t = t.replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹ]/g, c => ROMANOS[c] || c);

  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')      // acentos
    .replace(/[™®©]/g, '')                  // símbolos de marca
    .replace(/['’‘`´]/g, '')                // apóstrofos de todo tipo
    .replace(/[^a-z0-9]+/g, ' ')            // puntuación → espacio
    .replace(/\s+/g, ' ')                   // espacios múltiples
    .trim();
}

// --- Busca juegos por nombre. Devuelve la lista y si hay coincidencia exacta ---
function buscarJuegos(consulta) {
  const q = normalizar(consulta);
  if (!q) return { resultados: [], exacto: null };

  const juegos = leerJuegos();
  const todos = Object.entries(juegos).map(([appid, j]) => ({
    appid,
    nombre: j.nombre,
    plataforma: (j.plataformas && j.plataformas[0]) || '',
    sin_steam: !!j.sin_steam
  }));

  const resultados = todos.filter(j => normalizar(j.nombre).includes(q));
  // Coincidencia exacta con el nombre completo del juego
  const exacto = todos.find(j => normalizar(j.nombre) === q) || null;

  return { resultados: resultados.slice(0, 20), exacto };
}

// --- Endpoint: búsqueda de juegos por nombre (para el desplegable) ---
app.get('/api/buscar', (req, res) => {
  try {
    const { resultados } = buscarJuegos(req.query.q);
    res.json(resultados.slice(0, 8));
  } catch (e) {
    console.error('Error buscando:', e.message);
    res.status(500).json({ error: 'No se pudieron leer los datos de juegos' });
  }
});

// --- Endpoint: resultados completos de una búsqueda ---
app.get('/api/resultados', async (req, res) => {
  try {
    const { resultados } = buscarJuegos(req.query.q);

    // Añadimos jugadores y estado, en paralelo
    const conEstado = await Promise.all(resultados.map(async (j) => {
      const juego = leerJuegos()[j.appid];
      const jugadores = juego.sin_steam ? null : await consultarJugadores(j.appid);
      return { ...j, jugadores, ...calcularVeredicto(juego, jugadores) };
    }));

    res.json(conEstado);
  } catch (e) {
    console.error('Error en resultados:', e.message);
    res.status(500).json({ error: 'Error al buscar' });
  }
});

// --- Ruta: decide a dónde llevar al buscar ---
// Exacto o un solo resultado → ficha del juego. Varios o ninguno → página de resultados.
app.get('/buscar', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.redirect('/');

  try {
    const { resultados, exacto } = buscarJuegos(q);

    if (exacto) return res.redirect(`/juego/${exacto.appid}`);
    if (resultados.length === 1) return res.redirect(`/juego/${resultados[0].appid}`);

    // Varios resultados o ninguno: página de resultados
    res.sendFile(path.join(__dirname, 'public', 'resultados.html'));
  } catch (e) {
    console.error('Error en /buscar:', e.message);
    res.redirect('/');
  }
});

// --- Proxy de carátulas (Steam, URL externa o archivo local del JSON) ---
app.get('/api/caratula/:appid', async (req, res) => {
  const { appid } = req.params;
  if (!/^[a-z0-9_-]+$/i.test(appid)) return res.status(400).send('id no válido');

  const fuentes = [];

  // Si el juego tiene carátula propia definida en juegos.json, esa manda
  try {
    const juego = leerJuegos()[appid];
    if (juego?.caratula) fuentes.push(juego.caratula);
  } catch (e) { /* si falla, seguimos con Steam */ }

  // Si es un appid numérico, añadimos Steam como respaldo
  if (/^\d+$/.test(appid)) {
    fuentes.push(
      `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_600x900_2x.jpg`,
      `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`
    );
  }

  for (const url of fuentes) {
    // Ruta local: la servimos directamente desde public
    if (url.startsWith('/')) {
      const base = path.join(__dirname, 'public');
      const ruta = path.join(base, url);
      // Evita salir de /public (path traversal)
      if (ruta.startsWith(base) && fs.existsSync(ruta)) {
        res.set('Cache-Control', 'public, max-age=86400');
        return res.sendFile(ruta);
      }
      continue;
    }
    // URL externa: la descargamos y la reenviamos
    try {
      const r = await fetch(url);
      if (r.ok) {
        res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        const buffer = Buffer.from(await r.arrayBuffer());
        return res.send(buffer);
      }
    } catch (e) { /* prueba la siguiente */ }
  }
  res.status(404).send('Carátula no encontrada');
});

// --- Traduce nombre de usuario → correo, para poder hacer login con usuario ---
app.post('/api/resolver-usuario', exigeSupabase, async (req, res) => {
  const { usuario } = req.body || {};
  if (!usuario || typeof usuario !== 'string') {
    return res.status(400).json({ error: 'Falta el usuario' });
  }

  // Si ya es un correo, lo devolvemos tal cual
  if (usuario.includes('@')) {
    return res.json({ email: usuario });
  }

  try {
    // Buscamos el perfil por nombre de usuario
    const { data: perfil, error } = await supabaseAdmin
      .from('perfiles')
      .select('id')
      .ilike('nombre_usuario', usuario)
      .maybeSingle();

    if (error) throw error;
    if (!perfil) {
      // No revelamos si el usuario existe o no: mismo error genérico
      return res.status(404).json({ error: 'Credenciales incorrectas' });
    }

    // Obtenemos el correo desde el sistema de autenticación
    const { data: userData, error: errUser } =
      await supabaseAdmin.auth.admin.getUserById(perfil.id);

    if (errUser || !userData?.user?.email) {
      return res.status(404).json({ error: 'Credenciales incorrectas' });
    }

    res.json({ email: userData.user.email });
  } catch (e) {
    console.error('Error resolviendo usuario:', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

// --- Comprueba si un nombre de usuario está libre ---
app.get('/api/usuario-libre', exigeSupabase, async (req, res) => {
  const nombre = (req.query.nombre || '').trim();
  if (nombre.length < 3) {
    return res.json({ libre: false, motivo: 'Mínimo 3 caracteres' });
  }
  if (!/^[a-z0-9_-]+$/i.test(nombre)) {
    return res.json({ libre: false, motivo: 'Solo letras, números, guion y guion bajo' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('perfiles')
      .select('id')
      .ilike('nombre_usuario', nombre)
      .maybeSingle();

    if (error) throw error;
    res.json({ libre: !data });
  } catch (e) {
    console.error('Error comprobando usuario:', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ============================================================
//  VINCULACIÓN Y SINCRONIZACIÓN CON PLAYSTATION NETWORK
// ============================================================

// Intervalo mínimo entre sincronizaciones del mismo usuario (evita gastar
// peticiones: la API de Sony limita a ~300 cada 15 minutos)
const MINUTOS_ENTRE_SINCRONIZACIONES = 60;

/** Comprueba el token de sesión de Supabase y devuelve el id del usuario. */
async function usuarioDeLaPeticion(req) {
  const cabecera = req.headers.authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
  if (!token || !supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

/** Traduce un error de PSN a un mensaje comprensible. */
function errorPsn(e) {
  if (e.message === 'FALTA_NPSSO') {
    return { codigo: 503, mensaje: 'La conexión con PlayStation no está configurada. Inténtalo más tarde.' };
  }
  const texto = String(e.message || '');
  if (texto.includes('429')) {
    return { codigo: 429, mensaje: 'Demasiadas consultas a PlayStation ahora mismo. Prueba en unos minutos.' };
  }
  console.error('Error PSN:', texto);
  return { codigo: 502, mensaje: 'No se ha podido consultar PlayStation. Inténtalo más tarde.' };
}

// --- PASO 1: el usuario dice su nombre de PSN y recibe un código ---
app.post('/api/psn/iniciar', exigeSupabase, async (req, res) => {
  const usuarioId = await usuarioDeLaPeticion(req);
  if (!usuarioId) return res.status(401).json({ error: 'Debes iniciar sesión' });

  const nombrePsn = (req.body?.psn_id || '').trim();
  if (!nombrePsn || nombrePsn.length > 20) {
    return res.status(400).json({ error: 'Nombre de PSN no válido' });
  }

  try {
    const encontrado = await psn.buscarUsuario(nombrePsn);
    if (!encontrado) {
      return res.status(404).json({
        error: 'No se ha encontrado ese usuario en PlayStation Network. Revisa que esté bien escrito.'
      });
    }

    // Comprobamos que esa cuenta de PSN no esté ya vinculada a otro usuario
    const { data: yaVinculada } = await supabaseAdmin
      .from('perfiles')
      .select('id')
      .eq('psn_account_id', encontrado.accountId)
      .neq('id', usuarioId)
      .maybeSingle();

    if (yaVinculada) {
      return res.status(409).json({
        error: 'Esa cuenta de PlayStation ya está vinculada a otro perfil.'
      });
    }

    const codigo = psn.generarCodigo();

    const { error } = await supabaseAdmin
      .from('perfiles')
      .update({
        psn_id: encontrado.onlineId,
        psn_codigo_verificacion: codigo,
        psn_verificado: false
      })
      .eq('id', usuarioId);

    if (error) throw error;

    res.json({ psn_id: encontrado.onlineId, codigo });

  } catch (e) {
    const { codigo, mensaje } = errorPsn(e);
    res.status(codigo).json({ error: mensaje });
  }
});

// --- PASO 2: comprobamos que el código está en su "Acerca de mí" ---
app.post('/api/psn/verificar', exigeSupabase, async (req, res) => {
  const usuarioId = await usuarioDeLaPeticion(req);
  if (!usuarioId) return res.status(401).json({ error: 'Debes iniciar sesión' });

  try {
    const { data: perfil } = await supabaseAdmin
      .from('perfiles')
      .select('psn_id, psn_codigo_verificacion')
      .eq('id', usuarioId)
      .maybeSingle();

    if (!perfil?.psn_id || !perfil?.psn_codigo_verificacion) {
      return res.status(400).json({ error: 'Primero indica tu nombre de PlayStation.' });
    }

    const acercaDe = await psn.leerAcercaDe(perfil.psn_id);

    if (!acercaDe.includes(perfil.psn_codigo_verificacion)) {
      return res.status(400).json({
        error: 'No encontramos el código en tu perfil de PlayStation. Comprueba que lo has guardado y vuelve a intentarlo.',
        acercaDe: acercaDe.slice(0, 100)
      });
    }

    // ¡Verificado! Guardamos el accountId y sincronizamos
    const encontrado = await psn.buscarUsuario(perfil.psn_id);

    await supabaseAdmin
      .from('perfiles')
      .update({
        psn_account_id: encontrado.accountId,
        psn_verificado: true,
        psn_codigo_verificacion: null
      })
      .eq('id', usuarioId);

    const resumen = await sincronizarPlatinos(usuarioId, encontrado.accountId);

    res.json({ verificado: true, ...resumen });

  } catch (e) {
    const { codigo, mensaje } = errorPsn(e);
    res.status(codigo).json({ error: mensaje });
  }
});

// --- Sincroniza los platinos de PSN con la base de datos ---
async function sincronizarPlatinos(usuarioId, accountId) {
  const platinosPsn = await psn.obtenerPlatinos(accountId);

  // Nombres normalizados de los platinos que tiene en PSN
  const nombresPsn = new Set(platinosPsn.map(p => normalizar(p.nombre)));

  // Juegos de nuestro catálogo, para emparejarlos por nombre
  const catalogo = leerJuegos();
  const idsCatalogo = [];
  for (const [id, j] of Object.entries(catalogo)) {
    if (nombresPsn.has(normalizar(j.nombre))) idsCatalogo.push(id);
  }

  // Lo que tiene ahora en su perfil
  const { data: actuales } = await supabaseAdmin
    .from('platinos')
    .select('juego_id, verificado')
    .eq('usuario_id', usuarioId);

  const tieneAhora = new Set((actuales || []).map(p => p.juego_id));
  const yaVerificados = new Set((actuales || []).filter(p => p.verificado).map(p => p.juego_id));

  // 1. Añadir/marcar como verificados los que constan en PSN
  const aInsertar = idsCatalogo.map(id => ({
    usuario_id: usuarioId,
    juego_id: id,
    verificado: true
  }));

  if (aInsertar.length) {
    await supabaseAdmin
      .from('platinos')
      .upsert(aInsertar, { onConflict: 'usuario_id,juego_id', ignoreDuplicates: false });

    // El upsert no debe borrar el voto existente: lo actualizamos aparte
    await supabaseAdmin
      .from('platinos')
      .update({ verificado: true })
      .eq('usuario_id', usuarioId)
      .in('juego_id', idsCatalogo);
  }

  // 2. Eliminar los que NO constan en PSN y NO estaban ya verificados
  //    (los verificados en el pasado se conservan: decisión tomada)
  const aBorrar = [...tieneAhora].filter(id =>
    !idsCatalogo.includes(id) && !yaVerificados.has(id)
  );

  if (aBorrar.length) {
    await supabaseAdmin
      .from('platinos')
      .delete()
      .eq('usuario_id', usuarioId)
      .in('juego_id', aBorrar);
  }

  await supabaseAdmin
    .from('perfiles')
    .update({ psn_sincronizado_en: new Date().toISOString() })
    .eq('id', usuarioId);

  return {
    total_psn: platinosPsn.length,
    en_catalogo: idsCatalogo.length,
    añadidos: idsCatalogo.filter(id => !tieneAhora.has(id)).length,
    eliminados: aBorrar.length
  };
}

// --- Sincronización manual o al entrar al perfil (con intervalo mínimo) ---
app.post('/api/psn/sincronizar', exigeSupabase, async (req, res) => {
  const usuarioId = await usuarioDeLaPeticion(req);
  if (!usuarioId) return res.status(401).json({ error: 'Debes iniciar sesión' });

  try {
    const { data: perfil } = await supabaseAdmin
      .from('perfiles')
      .select('psn_account_id, psn_verificado, psn_sincronizado_en')
      .eq('id', usuarioId)
      .maybeSingle();

    if (!perfil?.psn_verificado || !perfil?.psn_account_id) {
      return res.status(400).json({ error: 'Tu cuenta de PlayStation no está vinculada.' });
    }

    // Intervalo mínimo, salvo que se fuerce explícitamente
    if (!req.body?.forzar && perfil.psn_sincronizado_en) {
      const minutos = (Date.now() - new Date(perfil.psn_sincronizado_en)) / 60000;
      if (minutos < MINUTOS_ENTRE_SINCRONIZACIONES) {
        return res.json({
          omitido: true,
          proxima_en_minutos: Math.ceil(MINUTOS_ENTRE_SINCRONIZACIONES - minutos)
        });
      }
    }

    const resumen = await sincronizarPlatinos(usuarioId, perfil.psn_account_id);
    res.json(resumen);

  } catch (e) {
    const { codigo, mensaje } = errorPsn(e);
    res.status(codigo).json({ error: mensaje });
  }
});

// --- Desvincular la cuenta de PSN ---
// Los platinos ya verificados se conservan como verificados (decisión tomada)
app.post('/api/psn/desvincular', exigeSupabase, async (req, res) => {
  const usuarioId = await usuarioDeLaPeticion(req);
  if (!usuarioId) return res.status(401).json({ error: 'Debes iniciar sesión' });

  const { error } = await supabaseAdmin
    .from('perfiles')
    .update({
      psn_verificado: false,
      psn_account_id: null,
      psn_codigo_verificacion: null
    })
    .eq('id', usuarioId);

  if (error) return res.status(500).json({ error: 'No se ha podido desvincular' });
  res.json({ ok: true });
});

// --- URLs bonitas: /juego/570940 y /perfil/pulopr ---
// Sirven los mismos HTML; el propio archivo lee el id de la ruta.
app.get('/juego/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'juego.html'));
});

app.get('/perfil/:usuario', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'perfil.html'));
});

// --- Página no encontrada ---
app.use((req, res) => {
  // Si pedían un endpoint de API, respondemos en JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'), (err) => {
    if (err) res.status(404).send('Página no encontrada');
  });
});

app.listen(PORT, () => {
  console.log(`Servidor Platino Radar en http://localhost:${PORT}`);
});
