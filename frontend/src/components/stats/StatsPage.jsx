// Página de estadísticas de visitas (Bruno la cablea en /stats). Lee
// api.visitasResumen() y la muestra linda: Total y Hoy en grande, un gráfico de
// barras de por_dia (últimos 14) y dos tops (por_pais, por_path).
// Standalone, mobile-first, mismo estilo del sitio.
import { useEffect, useState } from 'react';
import * as api from '../../api';

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('es-VE') : '0');

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
      className="flex h-40 items-end gap-1.5"
      role="img"
      aria-label={`Gráfico de visitas por día, últimos ${dias.length} días`}
    >
      {dias.map((d, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end" title={`${d.label}: ${d.value}`}>
            <div
              className="w-full rounded-t bg-rose-400"
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
function HoraBarras({ horas }) {
  const max = Math.max(1, ...horas.map((h) => h.value));
  return (
    <div className="flex h-32 items-end gap-0.5" role="img" aria-label="Visitas por hora del día">
      {horas.map((h, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end" title={`${h.label}h: ${h.value}`}>
            <div
              className="w-full rounded-t bg-violet-400"
              style={{ height: `${Math.max(2, (h.value / max) * 100)}%` }}
            />
          </div>
          <span className="h-3 w-full whitespace-nowrap text-center text-[9px] leading-3 text-slate-400">
            {i % 3 === 0 ? h.label : ''}
          </span>
        </div>
      ))}
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
