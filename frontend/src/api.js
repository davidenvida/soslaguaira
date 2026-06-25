import axios from 'axios'

// Cliente centralizado. Todos los componentes del frontend hablan con el backend por aquí.
// Contrato de respuesta del backend: { success, data, message }.
// El proxy de Vite redirige /api y /uploads al backend (puerto 3000).
const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// Devuelve directamente `data` del sobre { success, data, message }.
function unwrap(res) {
  const body = res.data
  if (body && typeof body === 'object' && 'success' in body) {
    if (!body.success) throw new Error(body.message || 'Error en la solicitud')
    return body.data
  }
  return body
}

// ---- Personas (buscar / reportar / a salvo) ----
export const personas = {
  crear: (payload) => http.post('/personas', payload).then(unwrap),
  listar: (params = {}) => http.get('/personas', { params }).then(unwrap),
  obtener: (id) => http.get(`/personas/${id}`).then(unwrap),
  // El backend devuelve { base, matches }. Exponemos directamente el array de
  // coincidencias para que MatchView lo consuma como lista.
  match: (id) =>
    http
      .get(`/personas/${id}/match`)
      .then(unwrap)
      .then((d) => (Array.isArray(d) ? d : d?.matches || [])),
}

// ---- Atrapados (RESCATE URGENTE) ----
export const atrapados = {
  crear: (payload) => http.post('/atrapados', payload).then(unwrap),
  listar: (params = {}) => http.get('/atrapados', { params }).then(unwrap),
  actualizar: (id, payload) => http.patch(`/atrapados/${id}`, payload).then(unwrap),
}

// ---- Edificios / estructuras ----
export const edificios = {
  crear: (payload) => http.post('/edificios', payload).then(unwrap),
  listar: (params = {}) => http.get('/edificios', { params }).then(unwrap),
}

// ---- Confirmaciones de la comunidad ----
// tipo: 'persona' | 'atrapado' | 'edificio'  ·  voto: 'confirmo' | 'desmiento'
export const confirmar = (tipo, id, voto) =>
  http.post(`/${tipo}/${id}/confirmar`, { voto }).then(unwrap)

// ---- Subida de foto: devuelve { url } ----
export async function subirFoto(file) {
  const form = new FormData()
  form.append('foto', file)
  const res = await http.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return unwrap(res) // { url }
}

// ---- Aliases planos (named exports) — contrato estable para los formularios/vistas ----
export const createPersona = personas.crear
export const createAtrapado = atrapados.crear
export const createEdificio = edificios.crear
export const listPersonas = personas.listar
export const getPersona = personas.obtener
export const matchPersona = personas.match
export const listAtrapados = atrapados.listar
export const updateAtrapado = atrapados.actualizar
export const listEdificios = edificios.listar
export const uploadFoto = subirFoto

// ---- Intel (capa de ingesta OSINT: desaparecidos recopilados de X/web) ----
// params: q, estado, parroquia, page, limit. Devuelve el array de personas.
export const intelPersonas = (params = {}) =>
  http.get('/intel/personas', { params }).then(unwrap)

export default http
