import { fail } from '../utils/response.js';

// Gate admin: requiere header X-Admin-Token == env ADMIN_TOKEN.
// Si ADMIN_TOKEN no esta seteado, el endpoint queda deshabilitado (403).
export const adminGate = (req, res, next) => {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return fail(res, 'Endpoint admin deshabilitado (configurar ADMIN_TOKEN).', 403);
  if (req.get('x-admin-token') !== expected) return fail(res, 'No autorizado.', 401);
  return next();
};
