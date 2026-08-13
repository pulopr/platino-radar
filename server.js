const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');
const fs = require('fs');

app.use(express.static(path.join(__dirname, 'public')));

// --- Umbrales del veredicto (los que definimos) ---
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

  const veredicto = calcularEstado(jugadores);
  res.json({ appid: Number(appid), jugadores, ...veredicto });
});

// --- Endpoint: datos completos de un juego (ficha) ---
app.get('/api/juego/:appid', async (req, res) => {
  const { appid } = req.params;
  if (!/^\d+$/.test(appid)) {
    return res.status(400).json({ error: 'appid no válido' });
  }

  // Leer los datos del juego desde juegos.json
  let juegos;
  try {
    juegos = JSON.parse(fs.readFileSync(path.join(__dirname, 'juegos.json'), 'utf8'));
  } catch (e) {
    console.error('Error leyendo juegos.json:', e.message);
    return res.status(500).json({ error: 'No se pudieron leer los datos de juegos' });
  }

  const juego = juegos[appid];
  if (!juego) {
    return res.status(404).json({ error: 'Juego no encontrado en la base de datos' });
  }

  // Consultar jugadores en vivo
  const jugadores = await consultarJugadores(appid);

  // Calcular el estado según el tipo de online del platino
  let veredicto;
  if (juego.estado_forzado) {
    const etiquetas = { vivo: 'Vivo', moribundo: 'Moribundo', muerto: 'Muerto' };
    veredicto = { estado: juego.estado_forzado, etiqueta: etiquetas[juego.estado_forzado] };
  } else if (juego.tipo_online === 'offline' || juego.tipo_online === 'con_amigos') {
    // No depende de que haya multitud conectada → siempre Vivo
    veredicto = { estado: 'vivo', etiqueta: 'Vivo' };
  } else {
    // requiere_multitud → manda el número de jugadores
    veredicto = calcularEstado(jugadores ?? 0);
  }

  res.json({ appid: Number(appid), jugadores, ...veredicto, ...juego });
});

// --- Proxy de carátulas de Steam (esquiva bloqueos tipo Brave) ---
app.get('/api/caratula/:appid', async (req, res) => {
  const { appid } = req.params;
  if (!/^\d+$/.test(appid)) return res.status(400).send('appid no válido');

  const fuentes = [
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_600x900_2x.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`,
  ];

  for (const url of fuentes) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400'); // cachea 1 día
        const buffer = Buffer.from(await r.arrayBuffer());
        return res.send(buffer);
      }
    } catch (e) { /* prueba la siguiente */ }
  }
  res.status(404).send('Carátula no encontrada');
});

app.listen(PORT, () => {
  console.log(`Servidor Platino Radar en http://localhost:${PORT}`);
});