import { useState, useEffect, useCallback, useRef } from 'react'
import MapBase from './components/MapBase'
import { MapDataProvider, MapLayers, LayersPanel, useMapData } from './components/map'
import { BuscoForm, ReportoForm, AtrapadoForm, EdificioForm } from './components/forms'
import PersonSearch from './components/search/PersonSearch'
import MatchView from './components/search/MatchView'
import RescueTriage from './components/rescue/RescueTriage'
import GaleriaDesaparecidos from './components/desaparecidos/GaleriaDesaparecidos'
import { listPersonas, matchPersona, listAtrapados, updateAtrapado } from './api'

// ============================================================================
// SHELL de la app (Bruno). Integra los módulos del equipo:
//   - Capas + provider de datos (Gio)  -> components/map
//   - Formularios (Gaby)               -> components/forms
//   - Buscador + match (Iris)          -> components/search
//   - Triaje de rescate (Iris)         -> components/rescue
//   - Responsive / a11y (Fiona)        -> index.css + clases en este shell
// Todo cae a datos mock si el backend (Enzo) aún no responde, así la app
// funciona de punta a punta desde ya y se "enciende" sola cuando el API esté.
// ============================================================================

const PANELS = {
  buscar: { titulo: 'Buscar a una persona', color: 'bg-amber-500' },
  reportar: { titulo: 'Reportar persona', color: 'bg-emerald-600' },
  atrapado: { titulo: '🆘 Reportar persona ATRAPADA — rescate urgente', color: 'bg-red-600' },
  edificio: { titulo: 'Reportar estado de un edificio', color: 'bg-violet-600' },
  rescate: { titulo: 'Panel de rescate (triaje)', color: 'bg-red-700' },
  desaparecidos: { titulo: 'Personas desaparecidas', color: 'bg-rose-700' },
}

export default function App() {
  return (
    <MapDataProvider>
      <AppInner />
    </MapDataProvider>
  )
}

function AppInner() {
  const [panel, setPanel] = useState(null)
  const [mapTarget, setMapTarget] = useState(null) // recentra el mapa al "Ver en mapa"
  const [persona, setPersona] = useState(null) // resultado elegido en buscador -> match
  const [reportarTab, setReportarTab] = useState('busco') // busco | salvo
  const { refresh } = useMapData()

  const cerrar = useCallback(() => {
    setPanel(null)
    setPersona(null)
  }, [])

  const dialogRef = useRef(null)

  // Accesibilidad: cerrar el panel con Escape (teclado).
  useEffect(() => {
    if (!panel) return
    const onKey = (e) => e.key === 'Escape' && cerrar()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, cerrar])

  // Accesibilidad: al abrir el modal, mueve el foco al diálogo (el lector de
  // pantalla anuncia el título y no se abre el teclado del móvil), atrapa el
  // foco con Tab/Shift+Tab dentro del diálogo, y al cerrar lo devuelve al
  // elemento que lo abrió.
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
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  }, [panel])

  // "Ver en mapa": recentra y cierra el panel.
  const verEnMapa = useCallback(
    (item) => {
      if (item?.lat != null && item?.lng != null) {
        setMapTarget({ lat: item.lat, lng: item.lng, zoom: 17 })
      }
      cerrar()
    },
    [cerrar],
  )

  // Tras crear un reporte: recarga las capas, recentra si hay punto, y cierra.
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
    <div className="relative h-full w-full overflow-hidden">
      {/* Encabezado */}
      <header className="pt-safe absolute inset-x-0 top-0 z-[500] bg-red-700 text-white shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
          <div>
            <h1 className="text-base font-bold leading-tight sm:text-lg">SOS La Guaira</h1>
            <p className="text-[11px] leading-tight text-red-100">
              Reunificación y rescate · Vargas, Venezuela
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPanel('desaparecidos')}
              className="min-h-[40px] rounded bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              Desaparecidos
            </button>
            <button
              onClick={() => setPanel('rescate')}
              className="min-h-[40px] rounded bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              Rescatistas
            </button>
          </div>
        </div>
      </header>

      {/* Mapa de fondo + capas (Gio) */}
      <div className="sos-map-shell absolute inset-0">
        <MapBase target={mapTarget}>
          <MapLayers />
        </MapBase>
      </div>

      {/* Panel de capas (overlay), offset bajo el header para no taparlo */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-14 z-[600]">
        <div className="pointer-events-auto">
          <LayersPanel />
        </div>
      </div>

      {/* Barra de acciones inferior (mobile-first) */}
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

      {/* Panel deslizable */}
      {panel && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-panel-titulo"
          tabIndex={-1}
          className="absolute inset-0 z-[1000] flex items-end outline-none sm:items-center sm:justify-center"
        >
          <div className="sos-overlay-enter absolute inset-0 bg-black/40" onClick={cerrar} />
          <div className={`sos-panel-enter pb-safe relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-white sm:max-h-[85vh] sm:rounded-2xl ${panel === 'desaparecidos' ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
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
              {/* RESCATE URGENTE */}
              {panel === 'atrapado' && <AtrapadoForm onSuccess={onSuccess} />}

              {/* EDIFICIO */}
              {panel === 'edificio' && <EdificioForm onSuccess={onSuccess} />}

              {/* REPORTAR PERSONA (busco / a salvo) */}
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

              {/* BUSCAR -> MATCH */}
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

              {/* TRIAJE DE RESCATE */}
              {panel === 'rescate' && (
                <RescueTriage
                  fetchAtrapados={listAtrapados}
                  updateEstado={updateAtrapado}
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
