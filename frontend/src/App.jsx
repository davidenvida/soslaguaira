import { useState, useEffect, useCallback, useRef } from 'react'
import MapBase from './components/MapBase'
import { MapDataProvider, MapLayers, LayersPanel, useMapData } from './components/map'
import { BuscoForm, ReportoForm, AtrapadoForm, EdificioForm } from './components/forms'
import PersonSearch from './components/search/PersonSearch'
import MatchView from './components/search/MatchView'
import RescueTriage from './components/rescue/RescueTriage'
import GaleriaDesaparecidos from './components/desaparecidos/GaleriaDesaparecidos'
import BuzonSugerencias from './components/ui/BuzonSugerencias'
import StatsPage from './components/stats/StatsPage'
import SugerenciasPage from './components/admin/SugerenciasPage'
import SubirListaManuscrita from './components/listas/SubirListaManuscrita'
import { listPersonas, matchPersona, listAtrapados, updateAtrapado, updateIntelPersona, registrarVisita } from './api'

// ============================================================================
// SHELL de la app (Bruno). ENFOQUE: Directorio de Desaparecidos.
// Dos vistas de la MISMA data, conmutables con el toggle Directorio | Mapa:
//   - Directorio: galería a pantalla completa (vista principal).
//   - Mapa: los desaparecidos geolocalizados + capas (Gio).
// Los paneles (reportar/buscar/atrapado/edificio/rescate) son overlays
// accesibles desde ambas vistas. a11y/responsive: Fiona.
// ============================================================================

const PANELS = {
  buscar: { titulo: 'Buscar a una persona', color: 'bg-amber-500' },
  reportar: { titulo: 'Reportar persona', color: 'bg-emerald-600' },
  atrapado: { titulo: '🆘 Reportar persona ATRAPADA — rescate urgente', color: 'bg-red-600' },
  edificio: { titulo: 'Reportar estado de un edificio', color: 'bg-violet-600' },
  rescate: { titulo: 'Panel de rescate (triaje)', color: 'bg-red-700' },
}

export default function App() {
  // Persona a destacar en el mapa al usar "Ver en el mapa" desde el directorio.
  const [destacarId, setDestacarId] = useState(null)

  // Páginas ocultas (soslaguaira.lat/stats y /sugerencias).
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/stats')) {
    return <StatsPage />
  }
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/sugerencias')) {
    return <SugerenciasPage />
  }

  return (
    <MapDataProvider destacarId={destacarId}>
      <AppInner setDestacarId={setDestacarId} />
    </MapDataProvider>
  )
}

function AppInner({ setDestacarId }) {
  const [vista, setVista] = useState('directorio') // directorio | mapa
  const [panel, setPanel] = useState(null)
  const [mapTarget, setMapTarget] = useState(null) // recentra el mapa al "Ver en mapa"
  const [persona, setPersona] = useState(null) // resultado elegido en buscador -> match
  const [reportarTab, setReportarTab] = useState('busco') // busco | salvo
  const { refresh } = useMapData()
  const dialogRef = useRef(null)

  const cerrar = useCallback(() => {
    setPanel(null)
    setPersona(null)
  }, [])

  // Analítica de visitas: un beacon por carga de página (fire-and-forget, sin cookies).
  useEffect(() => {
    registrarVisita({ path: window.location.pathname, referer: document.referrer })
  }, [])

  // Accesibilidad: cerrar el panel con Escape.
  useEffect(() => {
    if (!panel) return
    const onKey = (e) => e.key === 'Escape' && cerrar()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, cerrar])

  // Accesibilidad: foco al diálogo + focus-trap + devolver foco al cerrar.
  useEffect(() => {
    if (!panel) return
    const node = dialogRef.current
    if (!node) return
    const previouslyFocused = document.activeElement
    node.focus()
    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return
      const items = node.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus()
    }
  }, [panel])

  // "Ver en mapa": recentra, cambia a la vista Mapa y cierra el panel.
  const verEnMapa = useCallback(
    (item) => {
      if (item?.lat != null && item?.lng != null) {
        setMapTarget({ lat: item.lat, lng: item.lng, zoom: 17 })
      }
      if (item?.id != null) setDestacarId(item.id)
      setVista('mapa')
      cerrar()
    },
    [cerrar, setDestacarId],
  )

  // Actualizar estado en el triaje de rescate, enrutando segun el origen:
  // los atrapados que vienen del directorio llevan id 'intel-<id>' y se
  // actualizan por el endpoint de intel. El enum de intel no tiene
  // 'en_rescate'/'rescatado', así que mapeamos "rescatado" -> "a_salvo"
  // (rescatado = ya no atrapado = a salvo) y el estado intermedio no se persiste.
  const updateEstadoRescate = useCallback((id, payload) => {
    const sid = String(id)
    if (sid.startsWith('intel-')) {
      const realId = sid.slice('intel-'.length)
      const estado = payload?.estado === 'rescatado' ? 'a_salvo' : payload?.estado
      if (estado === 'en_rescate') return Promise.resolve({ id: realId })
      return updateIntelPersona(realId, { ...payload, estado })
    }
    return updateAtrapado(id, payload)
  }, [])

  // Tras crear un reporte: recarga, recentra (mapa) si hay punto, y cierra.
  const onSuccess = useCallback(
    (data) => {
      refresh?.()
      if (data?.lat != null && data?.lng != null) {
        setMapTarget({ lat: data.lat, lng: data.lng, zoom: 17 })
      }
      cerrar()
    },
    [refresh, cerrar],
  )

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Encabezado */}
      <header className="pt-safe z-[500] bg-red-700 text-white shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-tight sm:text-lg">SOS La Guaira</h1>
            <p className="hidden text-[11px] leading-tight text-red-100 sm:block">
              Directorio de desaparecidos · Vargas, Venezuela
            </p>
          </div>
          <button
            onClick={() => setPanel('rescate')}
            className="min-h-[40px] shrink-0 rounded bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            Rescatistas
          </button>
        </div>
      </header>

      {/* Toggle de vista: Directorio | Mapa (control propio, separado del header) */}
      <div role="group" aria-label="Vista" className="z-[500] flex select-none gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <SegBtn activo={vista === 'directorio'} onClick={() => setVista('directorio')}>
          Directorio
        </SegBtn>
        <SegBtn activo={vista === 'mapa'} onClick={() => setVista('mapa')}>
          Mapa
        </SegBtn>
      </div>

      {/* Subir lista manuscrita: acción destacada — cruza listas de hospitales con la base */}
      <div className="z-[500] border-b border-slate-200 bg-slate-50 px-3 py-2">
        <SubirListaManuscrita />
      </div>

      {/* Contenido */}
      <main className="relative flex-1 overflow-hidden">
        {vista === 'mapa' ? (
          <>
            {/* Mapa + capas (Gio) */}
            <div className="sos-map-shell absolute inset-0">
              <MapBase target={mapTarget}>
                <MapLayers />
              </MapBase>
            </div>

            {/* Panel de capas (overlay) */}
            <div className="pointer-events-none absolute inset-0 z-[600]">
              <div className="pointer-events-auto">
                <LayersPanel />
              </div>
            </div>

            {/* Barra de acciones inferior */}
            <nav
              aria-label="Acciones principales"
              className="pb-safe absolute inset-x-0 bottom-0 z-[500] bg-white/95 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] backdrop-blur"
            >
              <div className="mx-auto grid max-w-5xl grid-cols-4 gap-1 p-2">
                <Boton onClick={() => setPanel('atrapado')} clase="bg-red-600 text-white" icono="🆘" texto="Atrapado" />
                <Boton onClick={() => setPanel('reportar')} clase="bg-emerald-600 text-white" icono="🧑" texto="Reportar" />
                <Boton onClick={() => setPanel('buscar')} clase="bg-amber-500 text-white" icono="🔎" texto="Buscar" />
                <Boton onClick={() => setPanel('edificio')} clase="bg-violet-600 text-white" icono="🏚️" texto="Edificio" />
              </div>
            </nav>
          </>
        ) : (
          /* Vista DIRECTORIO (principal): galería a pantalla completa con scroll propio */
          <div className="absolute inset-0 overflow-y-auto">
            <GaleriaDesaparecidos onVerEnMapa={verEnMapa} />
            <BuzonSugerencias className="mx-auto mt-2 w-full max-w-xl px-4 pb-4" />
            <footer className="px-4 pb-6 text-center text-[11px] leading-relaxed text-slate-400">
              <p>
                Desarrollado por <span className="font-semibold text-slate-500">David Rosales</span>
                {' · '}
                <a href="tel:+51974736738" className="hover:underline">+51 974 736 738</a>
                {' · '}
                <a href="mailto:davidr@veritydev.com" className="hover:underline">davidr@veritydev.com</a>
              </p>
              <p className="mt-1">
                Los datos provienen de fuentes y publicaciones de dominio público y se utilizan
                exclusivamente para labores de rescate y reunificación familiar.
              </p>
            </footer>
            {/* Espacio para que la última fila / "cargar más" no queden bajo el
                botón flotante de Reportar ni el home indicator. */}
            <div aria-hidden="true" className="pb-safe h-24" />
          </div>
        )}
      </main>

      {/* Botón flotante: reportar desaparecido (visible en el directorio) */}
      {vista === 'directorio' && (
        <button
          onClick={() => {
            setReportarTab('busco')
            setPanel('reportar')
          }}
          className="pb-safe fixed bottom-4 right-4 z-[700] flex min-h-[52px] items-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-bold text-white shadow-lg active:scale-95"
        >
          <span aria-hidden="true" className="text-lg">＋</span>
          Reportar
        </button>
      )}

      {/* Panel deslizable (overlay) */}
      {panel && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-panel-titulo"
          tabIndex={-1}
          className="fixed inset-0 z-[1000] flex items-end outline-none sm:items-center sm:justify-center"
        >
          <div className="sos-overlay-enter absolute inset-0 bg-black/40" onClick={cerrar} />
          <div className="sos-panel-enter pb-safe relative max-h-[85dvh] w-full overflow-y-auto overflow-x-hidden rounded-t-2xl bg-white sm:max-h-[85vh] sm:rounded-2xl sm:w-[calc(100%-2rem)] sm:max-w-lg">
            <div className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 text-white ${PANELS[panel].color}`}>
              <h2 id="sos-panel-titulo" className="text-sm font-semibold">{PANELS[panel].titulo}</h2>
              <button
                onClick={cerrar}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div>
              {panel === 'atrapado' && <AtrapadoForm onSuccess={onSuccess} />}
              {panel === 'edificio' && <EdificioForm onSuccess={onSuccess} />}

              {panel === 'reportar' && (
                <div>
                  <div className="flex gap-2 border-b border-slate-100 p-3">
                    <TabBtn activo={reportarTab === 'busco'} onClick={() => setReportarTab('busco')}>
                      Busco a alguien
                    </TabBtn>
                    <TabBtn activo={reportarTab === 'salvo'} onClick={() => setReportarTab('salvo')}>
                      Está a salvo
                    </TabBtn>
                  </div>
                  {reportarTab === 'busco' ? (
                    <BuscoForm onSuccess={onSuccess} />
                  ) : (
                    <ReportoForm onSuccess={onSuccess} />
                  )}
                </div>
              )}

              {panel === 'buscar' &&
                (persona ? (
                  <div>
                    <button
                      onClick={() => setPersona(null)}
                      className="m-3 mb-0 text-sm font-medium text-sky-700 hover:underline"
                    >
                      ← Volver a la búsqueda
                    </button>
                    <MatchView persona={persona} fetchMatch={matchPersona} onVerEnMapa={verEnMapa} />
                  </div>
                ) : (
                  <PersonSearch searchFn={listPersonas} onSelect={setPersona} />
                ))}

              {panel === 'rescate' && (
                <RescueTriage
                  fetchAtrapados={listAtrapados}
                  updateEstado={updateEstadoRescate}
                  onVerEnMapa={verEnMapa}
                  pollMs={15000}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SegBtn({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`flex-1 min-h-[44px] rounded-full px-4 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
        activo
          ? 'bg-slate-900 text-white shadow'
          : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

function Boton({ onClick, clase, icono, texto }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[56px] flex-col items-center justify-center rounded-lg px-1 py-2 text-[11px] font-semibold leading-tight transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${clase}`}
    >
      <span className="text-lg" aria-hidden="true">{icono}</span>
      {texto}
    </button>
  )
}

function TabBtn({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
        activo ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {children}
    </button>
  )
}
