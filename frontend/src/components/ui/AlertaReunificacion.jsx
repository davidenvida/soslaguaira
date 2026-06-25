// Alerta proactiva de reunificación: se muestra DESTACADA tras crear un reporte
// si la cédula coincide con una lista de hospital guardada. Componente de display
// reutilizable y standalone — los formularios (POST /api/personas o
// /api/intel/personas) le pasan `data.alertas` y lo renderizan sobre el resultado.
//
// Soporta los dos shapes:
//   personas:      [{ confianza, motivo, mensaje, entrada:{nombre,cedula,estado,lugar}, lista:{fuente,tipo,fecha} }]
//   intel/personas:[{ nombre, cedula, coincidencias:[ ...mismas alertas... ] }]
// Solo llega por coincidencia de CÉDULA (confianza alta). Si no hay match, no renderiza.

// Aplana ambos shapes a una lista de alertas individuales.
const normalizar = (alertas) => {
  if (!Array.isArray(alertas)) return [];
  const out = [];
  for (const a of alertas) {
    if (Array.isArray(a?.coincidencias)) out.push(...a.coincidencias);
    else if (a) out.push(a);
  }
  return out;
};

const lugarLista = (a) => a?.lista?.fuente || a?.lista?.hospital || a?.lista?.tipo || 'una lista de hospital';

export default function AlertaReunificacion({ alertas, className = '' }) {
  const lista = normalizar(alertas);
  if (lista.length === 0) return null;

  return (
    <div
      className={`rounded-xl border-2 border-amber-300 bg-amber-50 p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M1 21h22L12 2zM12 16a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 12 16zm-1-7v5h2V9z" />
        </svg>
        <h3 className="text-sm font-bold text-amber-900">Posible coincidencia</h3>
      </div>

      <ul className="mt-2 space-y-2">
        {lista.map((a, i) => {
          // Caso sensible (fallecido): por política de privacidad mostramos SOLO
          // el mensaje neutral del backend. No inferimos ni mostramos estado/lugar.
          if (a?.sensible) {
            return (
              <li key={i} className="rounded-lg bg-white/70 p-3">
                <p className="text-sm text-amber-900">{a.mensaje}</p>
              </li>
            );
          }

          const nombre = a?.entrada?.nombre || a?.nombre || 'Tu familiar';
          const estado = a?.entrada?.estado || a?.estado || '';
          const lugar = lugarLista(a);
          return (
            <li key={i} className="rounded-lg bg-white/70 p-3">
              <p className="text-sm font-semibold text-amber-900">
                {nombre} aparece en {lugar}
                {estado ? (
                  <>
                    {' '}como <span className="underline">{estado}</span>
                  </>
                ) : null}
              </p>
              {a?.mensaje && <p className="mt-1 text-xs text-amber-800">{a.mensaje}</p>}
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-amber-700/80">
                {a?.entrada?.lugar && <span>{a.entrada.lugar}</span>}
                {a?.lista?.fecha && <span>{a.lista.fecha}</span>}
                {a?.entrada?.cedula && <span>C.I. {a.entrada.cedula}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
