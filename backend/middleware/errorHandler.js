import { fail } from '../utils/response.js';

// Captura errores no manejados (incluye errores de multer).
export const errorHandler = (err, req, res, next) => {
  console.error('[error]', err.message);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return fail(res, 'El archivo supera el limite de tamano permitido.', 413);
  }
  if (err.message === 'TIPO_ARCHIVO_INVALIDO') {
    return fail(res, 'Tipo de archivo no permitido. Solo imagenes (jpg, png, webp, gif).', 415);
  }
  if (err.code === '23505') { // violacion de indice unico (PostgreSQL)
    return fail(res, 'Conflicto: ya existe un registro con esos valores unicos.', 409);
  }

  return fail(res, 'Error interno del servidor.', 500);
};

export const notFound = (req, res) => fail(res, 'Recurso no encontrado.', 404);
