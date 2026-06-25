// Respuesta API uniforme: { success, data, message }
export const ok = (res, data = null, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, data, message });

export const fail = (res, message = 'Error', status = 400, data = null) =>
  res.status(status).json({ success: false, data, message });
