// Motor de reunificacion proactiva (FASE 3). Cruza un reporte (familia, consentido) contra el
// roster PRIVADO de listas por CEDULA. PRIVACIDAD:
//  - Solo cedula (misma persona); el match por nombre NO se usa (revelaria a terceros del roster).
//  - Coincidencia con roster de FALLECIDOS: NUNCA se muestra a la familia (devastador + requiere
//    verificacion). Se enruta PRIVADA a coincidencias_sensibles (admin/David) y al publico solo va
//    una alerta NEUTRAL ('tenemos informacion, te contactaremos'), sin afirmar el fallecimiento.
//  - ingresado/trasladado/herido: alerta informativa (hospital + estado) -> humano confirma.

const esFallecido = (e) => /fallec|muert|occis|obito|morgue|deces/i.test(`${e.estado || ''} ${e.tipo || ''}`);

const alertaInformativa = (e) => {
  const fecha = e.created_at ? new Date(e.created_at).toISOString().slice(0, 10) : '';
  const tipo = e.tipo || 'lista';
  const fuente = e.fuente || 'origen desconocido';
  return {
    confianza: 'alta',
    motivo: 'cedula',
    sensible: false,
    mensaje: `Esta persona aparece en: ${tipo} - ${fuente}${fecha ? ` (${fecha})` : ''}`,
    entrada: { nombre: e.nombre, estado: e.estado, lugar: e.lugar },
    lista: { fuente: e.fuente, tipo: e.tipo, fecha },
  };
};

// Alerta PUBLICA neutral para coincidencias sensibles (fallecidos): sin datos que revelen el deceso.
const alertaNeutral = () => ({
  confianza: 'alta',
  motivo: 'cedula',
  sensible: true,
  mensaje: 'Tenemos informacion sobre esta persona. El equipo de SOS La Guaira se pondra en contacto contigo.',
});

// Evalua un (nombre, cedula) contra el roster, registra las sensibles en privado y
// devuelve SOLO las alertas aptas para el flujo publico.
export async function evaluarAlertas(query, { nombre, cedula, origen = null }) {
  if (!cedula) return [];

  const r = await query(
    `SELECT e.nombre, e.cedula, e.estado, e.lugar, l.fuente, l.tipo, l.created_at
     FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id
     WHERE e.cedula = $1`,
    [cedula]
  );

  const publicas = [];
  for (const e of r.rows) {
    if (esFallecido(e)) {
      // Ruta PRIVADA: queda en la cola del admin, no se expone a la familia.
      await query(
        `INSERT INTO coincidencias_sensibles
           (reportado_nombre, reportado_cedula, reportado_origen, entrada_nombre, entrada_estado, lista_fuente, lista_tipo)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [nombre || null, cedula, origen, e.nombre, e.estado, e.fuente, e.tipo]
      );
      publicas.push(alertaNeutral());
    } else {
      publicas.push(alertaInformativa(e));
    }
  }
  return publicas;
}
