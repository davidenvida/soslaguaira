// Adaptador de API para los formularios de reporte.
// Usa las funciones reales de src/api.js (las deja Bruno). Mientras Enzo no haya
// levantado el backend, las llamadas reales fallan con error de red: en ese caso
// caemos a un mock local para no bloquear el desarrollo del frontend. Si el backend
// responde con un error real (4xx/5xx), ese error SÍ se propaga al formulario.
import * as api from '../../api'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Detecta "backend no disponible" (sin respuesta del servidor), no un error de negocio.
function isBackendDown(error) {
  if (!error) return false
  if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') return true
  // axios: hubo request pero ninguna response => servidor inalcanzable
  return Boolean(error.request) && !error.response
}

let mockSeq = 1000

async function mockCreate(tipo, payload) {
  await delay(700)
  // eslint-disable-next-line no-console
  console.info(`[mock] backend caido -> simulo POST /api/${tipo}`, payload)
  return { id: ++mockSeq, ...payload, created_at: new Date().toISOString() }
}

async function mockUpload(file) {
  await delay(500)
  // URL local temporal para previsualizar mientras no hay backend.
  return { url: URL.createObjectURL(file) }
}

async function withMockFallback(realCall, mockCall) {
  try {
    return await realCall()
  } catch (error) {
    if (isBackendDown(error)) return mockCall()
    throw error
  }
}

export async function uploadFoto(file) {
  return withMockFallback(
    () => api.uploadFoto(file),
    () => mockUpload(file),
  )
}

export async function createPersona(payload) {
  return withMockFallback(
    () => api.createPersona(payload),
    () => mockCreate('personas', payload),
  )
}

export async function createAtrapado(payload) {
  return withMockFallback(
    () => api.createAtrapado(payload),
    () => mockCreate('atrapados', payload),
  )
}

export async function createEdificio(payload) {
  return withMockFallback(
    () => api.createEdificio(payload),
    () => mockCreate('edificios', payload),
  )
}

// Sube la foto (si hay) y devuelve su URL, o null si no hay foto.
export async function resolveFotoUrl(file) {
  if (!file) return null
  const { url } = await uploadFoto(file)
  return url
}
