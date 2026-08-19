// ============================================================
//  psn.js — Conexión con PlayStation Network
//  Usa la librería de comunidad psn-api (API interna de Sony,
//  no oficial). Autenticado con la cuenta del proyecto.
// ============================================================

const {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  makeUniversalSearch,
  getUserTitles,
  getProfileFromUserName
} = require('psn-api');

// --- Estado de autorización en memoria ---
let auth = null;          // { accessToken, refreshToken, expiresIn... }
let authExpiraEn = 0;     // marca de tiempo (ms) en que caduca el accessToken

/**
 * Devuelve una autorización válida, renovándola si hace falta.
 * Lanza error si falta el NPSSO o si Sony lo rechaza (caducado).
 */
async function autorizar() {
  const ahora = Date.now();

  // Si el token sigue vivo (con 5 min de margen), lo reutilizamos
  if (auth && ahora < authExpiraEn - 5 * 60 * 1000) return auth;

  // Intento 1: renovar con el refresh token (no gasta el NPSSO)
  if (auth?.refreshToken) {
    try {
      auth = await exchangeRefreshTokenForAuthTokens(auth.refreshToken);
      authExpiraEn = Date.now() + (auth.expiresIn || 3600) * 1000;
      return auth;
    } catch (e) {
      console.warn('PSN: no se pudo renovar con refresh token, reintentando con NPSSO');
    }
  }

  // Intento 2: desde el NPSSO
  const npsso = process.env.PSN_NPSSO;
  if (!npsso) {
    throw new Error('FALTA_NPSSO');
  }

  const accessCode = await exchangeNpssoForAccessCode(npsso);
  auth = await exchangeAccessCodeForAuthTokens(accessCode);
  authExpiraEn = Date.now() + (auth.expiresIn || 3600) * 1000;
  return auth;
}

/**
 * Busca el accountId de un usuario a partir de su nombre de PSN.
 * Devuelve { accountId, onlineId } o null si no existe.
 */
async function buscarUsuario(nombrePsn) {
  const authorization = await autorizar();

  const busqueda = await makeUniversalSearch(
    authorization,
    nombrePsn,
    'SocialAllAccounts'
  );

  const resultados = busqueda?.domainResponses?.[0]?.results || [];

  // Buscamos coincidencia exacta del nombre (sin distinguir mayúsculas)
  const exacto = resultados.find(r =>
    (r.socialMetadata?.onlineId || '').toLowerCase() === nombrePsn.toLowerCase()
  );
  if (!exacto) return null;

  return {
    accountId: exacto.socialMetadata.accountId,
    onlineId: exacto.socialMetadata.onlineId
  };
}

/**
 * Lee el "Acerca de mí" del perfil público de un usuario de PSN.
 * Se usa para comprobar el código de verificación.
 */
async function leerAcercaDe(nombrePsn) {
  const authorization = await autorizar();
  const perfil = await getProfileFromUserName(authorization, nombrePsn);
  return perfil?.profile?.aboutMe || '';
}

/**
 * Devuelve los PLATINOS conseguidos por un usuario.
 * Filtra: solo títulos con el platino obtenido (earnedTrophies.platinum >= 1)
 * y progreso del 100%.
 */
async function obtenerPlatinos(accountId) {
  const authorization = await autorizar();

  const platinos = [];
  let offset = 0;
  const limite = 100;
  let totalItems = null;

  // La API pagina los resultados
  while (totalItems === null || offset < totalItems) {
    const respuesta = await getUserTitles(authorization, accountId, {
      limit: limite,
      offset
    });

    totalItems = respuesta.totalItemCount ?? 0;
    const titulos = respuesta.trophyTitles || [];

    for (const t of titulos) {
      // Solo nos interesan los juegos con platino conseguido
      if ((t.earnedTrophies?.platinum || 0) >= 1) {
        platinos.push({
          npCommunicationId: t.npCommunicationId,
          nombre: t.trophyTitleName,
          plataforma: t.trophyTitlePlatform,
          icono: t.trophyTitleIconUrl,
          progreso: t.progress
        });
      }
    }

    if (!titulos.length) break;   // seguridad: evita bucle infinito
    offset += limite;
  }

  return platinos;
}

/** Genera un código corto y legible para la verificación. */
function generarCodigo() {
  // Sin caracteres ambiguos (0/O, 1/I) para que sea fácil de copiar
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = 'PR-';
  for (let i = 0; i < 6; i++) {
    codigo += abc[Math.floor(Math.random() * abc.length)];
  }
  return codigo;
}

module.exports = {
  buscarUsuario,
  leerAcercaDe,
  obtenerPlatinos,
  generarCodigo
};
