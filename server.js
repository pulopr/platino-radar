const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Cliente con clave secreta: SOLO se usa en el servidor, nunca en el navegador
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

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

// --- Endpoint: búsqueda de juegos por nombre ---
app.get('/api/buscar', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json([]);

  let juegos;
  try {
    juegos = leerJuegos();
  } catch (e) {
    return res.status(500).json({ error: 'No se pudieron leer los datos de juegos' });
  }

  const resultados = Object.entries(juegos)
    .filter(([, j]) => j.nombre.toLowerCase().includes(q))
    .slice(0, 10)
    .map(([appid, j]) => ({
      appid,
      nombre: j.nombre,
      plataforma: (j.plataformas && j.plataformas[0]) || ''
    }));

  res.json(resultados);
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
app.post('/api/resolver-usuario', async (req, res) => {
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
app.get('/api/usuario-libre', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Servidor Platino Radar en http://localhost:${PORT}`);
});
