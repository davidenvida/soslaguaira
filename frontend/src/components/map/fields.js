// Acceso tolerante a campos: el backend devuelve snake_case (foto_url, etc.);
// igual leemos camelCase como respaldo para no bloquearnos en la integracion.
import { fotoUrl as toBackendUrl } from '../../api';

export const pick = (obj, ...keys) => {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
};

export const fotoUrl = (o) => pick(o, 'fotoUrl', 'foto_url');
export const contactoNombre = (o) => pick(o, 'contactoNombre', 'contacto_nombre', 'contacto');
export const contactoTelefono = (o) => pick(o, 'contactoTelefono', 'contacto_telefono');
export const cantidadPersonas = (o) => pick(o, 'cantidadPersonas', 'cantidad_personas');
export const atrapadosEstimados = (o) => pick(o, 'atrapadosEstimados', 'atrapados_estimados');

// Resuelve la URL de la foto lista para <img src>: toma foto_url del registro y
// la pasa por el helper de api.js (absoluta -> tal cual; /uploads/... -> antepone
// el dominio del backend en produccion, proxy de Vite en dev).
export const resolveFoto = (o) => {
  const url = fotoUrl(o);
  if (!url) return undefined;
  return toBackendUrl(url);
};

// Coordenadas validas (Number). Descarta registros sin ubicacion.
export const hasLatLng = (o) =>
  typeof o?.lat === 'number' && typeof o?.lng === 'number' && !Number.isNaN(o.lat) && !Number.isNaN(o.lng);
