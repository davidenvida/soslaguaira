// Página de estadísticas de visitas (Bruno la cablea en /stats). Lee
// api.visitasResumen() y la muestra linda: Total y Hoy en grande, un gráfico de
// barras de por_dia (últimos 14) y dos tops (por_pais, por_path).
// Standalone, mobile-first, mismo estilo del sitio.
import { useEffect, useState } from 'react';
import http, * as api from '../../api';

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('es-VE') : '0');

// Token admin de la URL (?token=) para ver la lista de errores reportados.
const tokenDeUrl = () => {
  try {
    return new URLSearchParams(window.location.search).get('token') || '';
  } catch {
    return '';
  }
};

const fmtFechaHora = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// Lee la primera clave presente de una lista de candidatas.
const campo = (obj, ...keys) => {
  for (const k of keys) if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k];
  return undefined;
};

const normalizar = (lista, etiquetaKeys) =>
  (Array.isArray(lista) ? lista : []).map((d) => ({
    label: String(campo(d, ...etiquetaKeys) ?? '—'),
    value: Number(campo(d, 'n', 'total', 'count', 'visitas', 'value')) || 0,
  }));

// 'AAAA-MM-DD' -> 'DD/MM'. Si no parsea, devuelve el original.
const diaCorto = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}` : iso;
};

const pais = (p) => (p === '??' || !p ? 'Desconocido' : p);

function Barras({ dias }) {
  const max = Math.max(1, ...dias.map((d) => d.value));
  // En 360 no caben 14 etiquetas: mostramos ~7 (una de cada N), anclando la
  // última (hoy) que es la importante. Las barras siguen siendo las 14.
  const step = Math.max(1, Math.ceil(dias.length / 7));
  const mostrarLabel = (i) => (dias.length - 1 - i) % step === 0;
  return (
    <div
      className="flex h-40 items-stretch gap-1.5"
      role="img"
      aria-label={`Gráfico de visitas por día, últimos ${dias.length} días`}
    >
      {dias.map((d, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="relative w-full flex-1" title={`${d.label}: ${d.value}`}>
            <div
              className="absolute bottom-0 w-full rounded-t bg-rose-400"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
          <span className="h-3 w-full whitespace-nowrap text-center text-[10px] leading-3 text-slate-400">
            {mostrarLabel(i) ? diaCorto(d.label) : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// Barras verticales de las 24 horas del día (0-23). Etiqueta cada 3 h.
// El número de visitas se muestra sobre cada barra con datos (montado en la
// punta de la barra, así horas consecutivas con distinta altura no chocan).
function HoraBarras({ horas }) {
  const max = Math.max(1, ...horas.map((h) => h.value));
  return (
    <div className="flex h-36 items-stretch gap-0.5" role="img" aria-label="Visitas por hora del día">
      {horas.map((h, i) => {
        const pct = Math.max(2, (h.value / max) * 100);
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="relative w-full flex-1" title={`${h.label}h: ${h.value} visitas`}>
              {h.value > 0 && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold leading-none text-violet-700"
                  style={{ bottom: `calc(${pct}% + 2px)` }}
                >
                  {h.value}
                </span>
              )}
              <div className="absolute bottom-0 w-full rounded-t bg-violet-400" style={{ height: `${pct}%` }} />
            </div>
            <span className="h-3 w-full whitespace-nowrap text-center text-[9px] leading-3 text-slate-400">
              {i % 3 === 0 ? h.label : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TopLista({ titulo, filas, transformar }) {
  const max = Math.max(1, ...filas.map((f) => f.value));
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <h3 className="mb-3 text-sm font-bold text-slate-800">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="text-xs text-slate-400">Sin datos aún.</p>
      ) : (
        <ul className="space-y-2">
          {filas.map((f, i) => (
            <li key={i} className="text-xs">
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-slate-700">{transformar ? transformar(f.label) : f.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-500">{fmt(f.value)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-400" style={{ width: `${(f.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function StatsPage() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [porOrigen, setPorOrigen] = useState(null); // { osint, app } — reportes por origen
  const [errores, setErrores] = useState(null); // lista de errores reportados (solo con ?token=)
  const [fallecidos, setFallecidos] = useState(null); // lista de fallecidos (admin, solo con ?token=)
  const adminToken = tokenDeUrl();

  // Errores reportados (admin): solo si la URL trae ?token=.
  useEffect(() => {
    if (!adminToken) return undefined;
    let vivo = true;
    http
      .get('/errores', { headers: { 'X-Admin-Token': adminToken } })
      .then((r) => {
        if (!vivo) return;
        const body = r.data;
        setErrores(Array.isArray(body) ? body : body?.data?.items || body?.data || []);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [adminToken]);

  // Fallecidos (admin): privado, solo con ?token=. Provienen de las listas de
  // hospital (lista_entradas estado=fallecido), no del directorio público.
  useEffect(() => {
    if (!adminToken) return undefined;
    let vivo = true;
    http
      .get('/hospitales/fallecidos', { headers: { 'X-Admin-Token': adminToken } })
      .then((r) => {
        if (!vivo) return;
        const body = r.data;
        const items =
          body?.data?.items || body?.items || (Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []);
        setFallecidos(items);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [adminToken]);

  // Reportes por origen (osint = equipo, app = externos). Llamada extra a intelStats.
  useEffect(() => {
    if (typeof api.intelStats !== 'function') return undefined;
    let vivo = true;
    api
      .intelStats()
      .then((r) => {
        if (vivo && r?.por_origen) setPorOrigen(r.por_origen);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    if (typeof api.visitasResumen !== 'function') {
      setStatus('error');
      return undefined;
    }
    api
      .visitasResumen()
      .then((r) => {
        if (!vivo) return;
        setData(r);
        setStatus('ready');
      })
      .catch(() => {
        if (vivo) setStatus('error');
      });
    return () => {
      vivo = false;
    };
  }, []);

  const total = data?.total ?? 0;
  const hoy = data?.hoy ?? 0;
  const dias = normalizar(data?.por_dia, ['dia', 'fecha', 'label']).slice(-14);

  // Por hora: rellena las 24 horas (0-23) para un eje completo aunque falten.
  const horasRaw = normalizar(data?.por_hora, ['hora', 'h', 'label']);
  const horaMap = {};
  horasRaw.forEach((d) => {
    const k = parseInt(d.label, 10);
    if (!Number.isNaN(k)) horaMap[k] = d.value;
  });
  const horas = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, '0'), value: horaMap[h] || 0 }));
  const hayHoras = horasRaw.length > 0;

  const ordenarTop = (arr) => arr.sort((a, b) => b.value - a.value).slice(0, 8);
  const paises = ordenarTop(normalizar(data?.por_pais, ['pais', 'country', 'label']));
  const ciudades = ordenarTop(normalizar(data?.por_ciudad, ['ciudad', 'city', 'label']));
  const dispositivos = ordenarTop(normalizar(data?.por_dispositivo, ['dispositivo', 'device', 'tipo', 'label']));
  const operadoras = ordenarTop(normalizar(data?.por_operadora, ['operadora', 'isp', 'org', 'label']));
  const paths = ordenarTop(normalizar(data?.por_path, ['path', 'ruta', 'label']));

  // Solo se muestran los tops que tienen datos (graceful antes de que el backend los publique).
  const tops = [
    { titulo: 'Por país', filas: paises, transformar: pais },
    { titulo: 'Por ciudad', filas: ciudades },
    { titulo: 'Dispositivos', filas: dispositivos },
    { titulo: 'Operadora', filas: operadoras },
    { titulo: 'Por sección', filas: paths },
  ].filter((t) => t.filas.length > 0);

  const sinDatos = status === 'ready' && total === 0;

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-bold text-slate-900">Estadísticas de visitas</h1>
      <p className="mb-5 text-xs text-slate-500">SOS La Guaira · directorio de desaparecidos</p>

      {/* Reportes por origen (independiente de las visitas). */}
      {porOrigen && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-bold text-slate-800">Reportes por origen</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-xl bg-indigo-50 p-4 ring-1 ring-indigo-200 sm:p-5">
              <div className="text-3xl font-extrabold tabular-nums text-indigo-700 sm:text-4xl">{fmt(porOrigen.osint ?? 0)}</div>
              <div className="mt-1 text-xs font-medium text-indigo-700/80">Reportes del equipo (recopilados)</div>
            </div>
            <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 sm:p-5">
              <div className="text-3xl font-extrabold tabular-nums text-amber-700 sm:text-4xl">{fmt(porOrigen.app ?? 0)}</div>
              <div className="mt-1 text-xs font-medium text-amber-700/80">Reportes de usuarios externos</div>
            </div>
          </div>
        </div>
      )}

      {/* Fallecidos (admin, solo con ?token=). Privado: no está en el directorio público. */}
      {adminToken && fallecidos && (
        <div className="mb-6">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-800">Fallecidos</h2>
            <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700">{fallecidos.length}</span>
          </div>
          <p className="mb-2 text-[11px] text-slate-400">Vista privada · provienen de las listas de hospital, no del directorio público.</p>
          {fallecidos.length === 0 ? (
            <p className="text-xs text-slate-400">No hay registros.</p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-xl bg-white ring-1 ring-slate-200">
              {fallecidos.map((p, i) => (
                <li key={p.lista_id ? `${p.lista_id}-${i}` : i} className="px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">{p.nombre || p.nombre_completo || 'Sin nombre'}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {p.cedula && <span>C.I. {p.cedula}</span>}
                    {p.fuente && <span>{p.fuente}</span>}
                    {p.fecha && <span>{new Date(p.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Errores reportados (admin, solo con ?token=). */}
      {adminToken && errores && (
        <div className="mb-6">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-800">Errores reportados</h2>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{errores.length}</span>
          </div>
          {errores.length === 0 ? (
            <p className="text-xs text-slate-400">No hay errores reportados.</p>
          ) : (
            <ul className="space-y-2">
              {errores.map((e, i) => (
                <li key={e.id ?? i} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <p className="whitespace-pre-wrap text-sm text-slate-800" style={{ overflowWrap: 'anywhere' }}>{e.texto || ''}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                    {e.contacto && <span className="text-slate-500">Contacto: {e.contacto}</span>}
                    <span>{fmtFechaHora(e.created_at || e.fecha)}</span>
                    {(e.pais || e.country) && <span>{e.pais || e.country}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {status === 'loading' && (
        <p className="py-12 text-center text-sm text-slate-500" aria-live="polite">Cargando estadísticas…</p>
      )}
      {status === 'error' && (
        <p className="py-12 text-center text-sm text-red-600" aria-live="polite">
          No se pudieron cargar las estadísticas.
        </p>
      )}
      {sinDatos && (
        <p className="py-12 text-center text-sm text-slate-500">Sin datos de visitas aún.</p>
      )}

      {status === 'ready' && !sinDatos && (
        <div className="space-y-4">
          {/* Total y Hoy en grande */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-xl bg-rose-50 p-4 ring-1 ring-rose-200 sm:p-5">
              <div className="text-3xl font-extrabold tabular-nums text-rose-700 sm:text-4xl">{fmt(total)}</div>
              <div className="mt-1 text-xs font-medium text-rose-700/80">Visitas totales</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200 sm:p-5">
              <div className="text-3xl font-extrabold tabular-nums text-emerald-700 sm:text-4xl">{fmt(hoy)}</div>
              <div className="mt-1 text-xs font-medium text-emerald-700/80">Hoy</div>
            </div>
          </div>

          {/* Barras por día */}
          <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <h2 className="mb-3 text-sm font-bold text-slate-800">Últimos días</h2>
            {dias.length === 0 ? (
              <p className="text-xs text-slate-400">Sin datos aún.</p>
            ) : (
              <Barras dias={dias} />
            )}
          </div>

          {/* Por hora del día */}
          {hayHoras && (
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <h2 className="mb-3 text-sm font-bold text-slate-800">Por hora del día</h2>
              <HoraBarras horas={horas} />
            </div>
          )}

          {/* Tops: país, ciudad, dispositivos, operadora, sección (solo con datos) */}
          {tops.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tops.map((t) => (
                <TopLista key={t.titulo} titulo={t.titulo} filas={t.filas} transformar={t.transformar} />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
