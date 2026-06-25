// Acceso tolerante a campos: Enzo puede devolver JSON en camelCase (segun el
// contrato) o snake_case (como las columnas SQL del modelo). Estas capas leen
// ambos para no bloquearse en la integracion. Si Enzo confirma camelCase, esto
// igual funciona y no estorba.

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

// Resuelve la URL de la foto: si es un path relativo (/uploads/..), lo deja tal
// cual (Vite proxya al backend); si es absoluta, la respeta.
export const resolveFoto = (o) => {
  const url = fotoUrl(o);
  if (!url) return undefined;
  return url;
};

// Coordenadas validas (Number). Descarta registros sin ubicacion.
export const hasLatLng = (o) =>
  typeof o?.lat === 'number' && typeof o?.lng === 'number' && !Number.isNaN(o.lat) && !Number.isNaN(o.lng);
