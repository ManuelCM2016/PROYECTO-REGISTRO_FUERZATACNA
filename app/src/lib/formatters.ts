/**
 * =========================================================
 * Formateadores de fecha y hora para el sistema Fuerza Tacna
 * =========================================================
 * Limpia y normaliza cualquier fecha u hora proveniente de
 * Google Sheets o inputs, eliminando cadenas crudas como:
 * "GMT-0500 (hora estándar de Perú)" o fechas base como 1899.
 */

/**
 * Limpia una hora devolviendo formato estándar HH:mm (ej: "18:00" o "06:43")
 */
export function formatHora(value: unknown): string {
  if (!value) return '';
  const str = String(value).trim();

  // Si ya viene en formato simple "HH:mm" o "HH:mm:ss"
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    const parts = str.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1]}`;
  }

  // Si es una cadena Date larga de Google Sheets (ej: "Sat Dec 30 1899 18:00:00 GMT-0508...")
  const timeRegexMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeRegexMatch) {
    const hh = timeRegexMatch[1].padStart(2, '0');
    const mm = timeRegexMatch[2];
    return `${hh}:${mm}`;
  }

  // Intentar parsear como objeto Date
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // Si falla, quitar sufijo GMT
  return str.replace(/\s*GMT[+-]\d{4}.*$/, '').trim();
}

/**
 * Limpia una fecha devolviendo formato legible DD/MM/YYYY (ej: "12/09/2026")
 */
export function formatFecha(value: unknown): string {
  if (!value) return '';
  const str = String(value).trim();

  // Si es año base de hora (1899 o 1900), no es una fecha válida
  if (str.includes('1899') || str.includes('1900')) {
    return '';
  }

  // Formato YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
  }

  // Formato DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    return str;
  }

  // Intentar parsear como Date de JavaScript (ej: "Sat Sep 12 2026 00:00:00 GMT-0500...")
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    if (year > 1970) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
  }

  // Quitar sufijos de zona horaria GMT si no coincide
  return str.replace(/\s*GMT[+-]\d{4}.*$/, '').trim();
}

/**
 * Limpia una marca de tiempo completa devolviendo "DD/MM/YYYY HH:mm:ss"
 * (ej: "11/09/2026 18:43:00")
 */
export function formatFechaHora(value: unknown): string {
  if (!value) return '';
  const str = String(value).trim();

  // Caso: String Date de Google Sheets
  // ej: "Fri Sep 11 2026 18:43:00 GMT-0500 (hora estándar de Perú)"
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    if (year > 1970) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${hh}:${mm}:${ss}`;
    }
  }

  // Caso: "YYYY-MM-DD HH:mm:ss"
  const ymdTimeMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (ymdTimeMatch) {
    const [, y, m, day, hh, mm, ss] = ymdTimeMatch;
    return `${day}/${m}/${y} ${hh}:${mm}${ss ? `:${ss}` : ''}`;
  }

  // Quitar cualquier "GMT-0500 (hora estándar de Perú)"
  return str.replace(/\s*GMT[+-]\d{4}.*$/, '').trim();
}
