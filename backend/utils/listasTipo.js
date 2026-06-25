// Filtro SQL de tipos de lista PUBLICABLES. Directiva de David: publicar TODO salvo FALLECIDOS.
// -> publica cualquier tipo explicito no sensible (ingresados/trasladados/heridos/refugiados/otro...),
//    EXCLUYE fallecidos/morgue y las listas sin tipo (huerfanas).
// Usa la columna 'tipo' (de listas_manuscritas); en joins resuelve sin ambiguedad
// porque lista_entradas no tiene columna 'tipo'.
export const SQL_TIPO_PUBLICO =
  "(tipo IS NOT NULL AND tipo <> '' AND tipo !~* 'fallec|muert|morgue|obito|deces')";
