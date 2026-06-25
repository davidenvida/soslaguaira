// Filtro SQL de tipos de lista PUBLICABLES (no sensibles): ingresados/trasladados/heridos.
// Excluye SIEMPRE fallecidos/morgue. Fuente unica para endpoints publicos de listas y hospitales.
// Usa la columna 'tipo' (de listas_manuscritas); en joins resuelve sin ambiguedad
// porque lista_entradas no tiene columna 'tipo'.
export const SQL_TIPO_PUBLICO =
  "(tipo ~* 'ingres|admit|hospital|atend|triage|trasl|refer|remit|herid|lesion|quemad') AND (tipo !~* 'fallec|muert|morgue|obito|deces')";
