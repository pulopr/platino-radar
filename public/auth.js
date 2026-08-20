// ============================================
//  auth.js — Sesión compartida de Platino Radar
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ⚠️ PEGA AQUÍ TU CLAVE PUBLISHABLE DE SUPABASE
const SUPABASE_URL = 'https://wxymjcuzccnbfskvibab.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sQIhdhE-LToPa69HIYljSQ_ImrwHw1u';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Devuelve el usuario actual junto con los datos de su perfil,
 * o null si no hay sesión iniciada.
 */
export async function usuarioActual(){
  const { data: { session } } = await supabase.auth.getSession();
  if(!session) return null;

  const { data: perfil, error } = await supabase
    .from('perfiles')
    .select('nombre_usuario, psn_id, psn_verificado')
    .eq('id', session.user.id)
    .maybeSingle();

  if(error) console.error('Error leyendo el perfil:', error.message);

  return {
    id: session.user.id,
    email: session.user.email,
    nombre_usuario: perfil?.nombre_usuario || null,
    psn_id: perfil?.psn_id || null,
    psn_verificado: perfil?.psn_verificado || false
  };
}

/** Cierra la sesión y vuelve al inicio. */
export async function cerrarSesion(){
  await supabase.auth.signOut();
  window.location.href = '/';
}

/**
 * Redirige a la página de acceso si no hay sesión.
 * Devuelve el usuario si la hay. Útil para páginas privadas.
 */
export async function exigirSesion(){
  const usuario = await usuarioActual();
  if(!usuario){
    window.location.href = '/cuenta.html';
    return null;
  }
  return usuario;
}

/**
 * Pinta la cabecera según haya sesión o no.
 * Espera encontrar dos contenedores: #logged-out y #logged-in.
 * Devuelve el usuario actual (o null).
 */
export async function pintarCabecera(){
  const fuera  = document.getElementById('logged-out');
  const dentro = document.getElementById('logged-in');
  if(!fuera || !dentro) return null;

  const usuario = await usuarioActual();

  if(usuario){
    const nombre = usuario.nombre_usuario || 'Mi perfil';

    fuera.classList.add('hidden');
    fuera.innerHTML = '';

    dentro.classList.remove('hidden');
    dentro.style.display = 'flex';
    dentro.innerHTML = `
      <a class="btn" href="/perfil.html">${nombre}</a>
      <button class="btn btn-salir" id="btn-salir" title="Cerrar sesión">Cerrar sesión</button>`;

    document.getElementById('btn-salir').onclick = cerrarSesion;

  } else {
    dentro.classList.add('hidden');
    dentro.innerHTML = '';

    fuera.classList.remove('hidden');
    fuera.innerHTML = `<a class="btn" href="/cuenta.html">Iniciar sesión</a>`;
  }

  return usuario;
}

/**
 * Devuelve los platinos registrados por el usuario indicado.
 * Si no se pasa id, usa el del usuario con sesión iniciada.
 */
export async function platinosDe(usuarioId){
  const { data, error } = await supabase
    .from('platinos')
    .select('juego_id, tedio_voto, conseguido_en, destacado')
    .eq('usuario_id', usuarioId)
    .order('conseguido_en', { ascending: false });

  if(error){
    console.error('Error leyendo platinos:', error.message);
    return [];
  }
  return data || [];
}

/** Registra (o actualiza) un platino del usuario con su voto de tedio. */
export async function guardarPlatino(usuarioId, juegoId, tedioVoto = null){
  const { error } = await supabase
    .from('platinos')
    .upsert(
      { usuario_id: usuarioId, juego_id: juegoId, tedio_voto: tedioVoto },
      { onConflict: 'usuario_id,juego_id' }
    );

  if(error){
    console.error('Error guardando platino:', error.message);
    return false;
  }
  // Si estaba en "próximos platinos", ya no tiene sentido que siga ahí
  await quitarDeseado(usuarioId, juegoId);
  return true;
}

/**
 * Devuelve la lista de "próximos platinos" (juegos por platinar) del
 * usuario indicado. Si no se pasa id, no hay usuario con sesión.
 */
export async function deseadosDe(usuarioId){
  const { data, error } = await supabase
    .from('deseados')
    .select('juego_id, creado_en')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false });

  if(error){
    console.error('Error leyendo deseados:', error.message);
    return [];
  }
  return data || [];
}

/** Añade un juego a la lista de "próximos platinos" del usuario. */
export async function añadirDeseado(usuarioId, juegoId){
  const { error } = await supabase
    .from('deseados')
    .upsert(
      { usuario_id: usuarioId, juego_id: juegoId },
      { onConflict: 'usuario_id,juego_id' }
    );

  if(error){
    console.error('Error añadiendo deseado:', error.message);
    return false;
  }
  return true;
}

/** Quita un juego de la lista de "próximos platinos" del usuario. */
export async function quitarDeseado(usuarioId, juegoId){
  const { error } = await supabase
    .from('deseados')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('juego_id', juegoId);

  if(error){
    console.error('Error quitando deseado:', error.message);
    return false;
  }
  return true;
}

/**
 * Actualiza el voto de tedio de un platino que el usuario YA tiene
 * (no lo crea si no existe). Se usa al votar desde la ficha del juego,
 * donde los platinos solo deben llegar por sincronización con PSN, nunca
 * por el hecho de votar. Devuelve false si no había ningún platino que
 * actualizar.
 */
export async function actualizarVoto(usuarioId, juegoId, tedioVoto){
  const { data, error } = await supabase
    .from('platinos')
    .update({ tedio_voto: tedioVoto })
    .eq('usuario_id', usuarioId)
    .eq('juego_id', juegoId)
    .select('juego_id');

  if(error){
    console.error('Error actualizando el voto:', error.message);
    return false;
  }
  return !!(data && data.length);
}

/**
 * Marca o desmarca un platino como destacado en el expositor.
 * Máximo 3 destacados por usuario.
 * Devuelve { ok, motivo }.
 */
export async function destacarPlatino(usuarioId, juegoId, destacar){
  if(destacar){
    // Comprobamos que no supere el máximo
    const { data, error: errCount } = await supabase
      .from('platinos')
      .select('juego_id')
      .eq('usuario_id', usuarioId)
      .eq('destacado', true);

    if(errCount){
      console.error('Error contando destacados:', errCount.message);
      return { ok: false, motivo: 'Error al comprobar los destacados' };
    }
    if(data && data.length >= 3){
      return { ok: false, motivo: 'Solo puedes destacar 3 platinos. Quita uno antes de añadir otro.' };
    }
  }

  const { error } = await supabase
    .from('platinos')
    .update({ destacado: destacar })
    .eq('usuario_id', usuarioId)
    .eq('juego_id', juegoId);

  if(error){
    console.error('Error al destacar platino:', error.message);
    return { ok: false, motivo: 'No se ha podido guardar el cambio' };
  }
  return { ok: true };
}

/** Elimina un platino del usuario. */
export async function borrarPlatino(usuarioId, juegoId){
  const { error } = await supabase
    .from('platinos')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('juego_id', juegoId);

  if(error){
    console.error('Error borrando platino:', error.message);
    return false;
  }
  return true;
}

/**
 * Media de tedio de la comunidad para un juego.
 * Devuelve { media, votos } — media es null si no hay votos.
 */
export async function tedioComunidad(juegoId){
  const { data, error } = await supabase
    .from('platinos')
    .select('tedio_voto')
    .eq('juego_id', juegoId)
    .not('tedio_voto', 'is', null);

  if(error || !data || !data.length) return { media: null, votos: 0 };

  const suma = data.reduce((acc, f) => acc + Number(f.tedio_voto), 0);
  return {
    media: Math.round((suma / data.length) * 10) / 10,
    votos: data.length
  };
}

/** Calcula el nivel del usuario según su número de platinos (1 nivel cada 10). */
export function nivelPorPlatinos(total){
  const nivel = Math.floor(total / 10) + 1;
  const nombres = ['Novato', 'Aprendiz', 'Veterano', 'Experto', 'Maestro', 'Leyenda'];
  return {
    nivel,
    nombre: nombres[Math.min(nivel - 1, nombres.length - 1)],
    siguiente: nivel * 10,
    progreso: (total % 10) * 10   // porcentaje hacia el siguiente nivel
  };
}
