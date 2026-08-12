const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

// --- Umbrales del veredicto (los que definimos) ---
function calcularEstado(jugadores) {
  if (jugadores >= 1000) return { estado: 'vivo', etiqueta: 'Vivo' };
  if (jugadores >= 100)  return { estado: 'moribundo', etiqueta: 'Moribundo' };
  return { estado: 'muerto', etiqueta: 'Muerto' };
}

// --- Endpoint: número de jugadores en vivo de un juego de Steam ---
app.get('/api/jugadores/:appid', async (req, res) => {
  const { appid } = req.params;

  // Validación básica: appid debe ser numérico
  if (!/^\d+$/.test(appid)) {
    return res.status(400).json({ error: 'appid no válido' });
  }

  const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`;

  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      return res.status(502).json({ error: 'Steam no respondió correctamente' });
    }
    const datos = await respuesta.json();
    const jugadores = datos?.response?.player_count;

    if (typeof jugadores !== 'number') {
      return res.status(404).json({ error: 'No hay datos de jugadores para ese juego' });
    }

    const veredicto = calcularEstado(jugadores);
    res.json({ appid: Number(appid), jugadores, ...veredicto });

  } catch (err) {
    console.error('Error consultando Steam:', err.message);
    res.status(500).json({ error: 'Error interno al consultar Steam' });
  }
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

// --- Servir archivos estáticos (tus HTML) desde la carpeta "public" ---


app.listen(PORT, () => {
  console.log(`Servidor Platino Radar en http://localhost:${PORT}`);
});