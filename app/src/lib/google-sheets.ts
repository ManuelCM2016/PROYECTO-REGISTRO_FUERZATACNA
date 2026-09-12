// ============================================
// Cliente para Google Apps Script Web App
// ============================================
import type {
  Militante,
  Usuario,
  ApiResponse,
  StatsData,
  VerifyPhoneResult,
  DniCheckResult,
  Evento,
  Asistencia,
} from '@/types';

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

function checkResponseText(text: string): void {
  if (
    text.includes('accounts.google.com') ||
    text.includes('Sign in - Google Accounts') ||
    text.includes('<!doctype html>') ||
    text.includes('<html')
  ) {
    throw new Error(
      'Google Apps Script requiere acceso público. En Apps Script, ve a: Implementar > Administrar implementaciones > icono Lápiz (Editar) > Versión: "Nueva versión" > en "Quién tiene acceso" selecciona "Cualquier persona" (no "Solo yo").'
    );
  }
}

// ============================================
// Cache en Memoria para consultas de alta velocidad
// ============================================
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

export function invalidateCache(actionKeys?: string[]): void {
  if (!actionKeys || actionKeys.length === 0) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (actionKeys.some((action) => key.includes(action))) {
      memoryCache.delete(key);
    }
  }
}

async function appsScriptGet<T>(
  action: string,
  params: Record<string, string> = {},
  options: { ttlSeconds?: number; forceFresh?: boolean } = {}
): Promise<T> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL no está configurada en .env.local');
  }

  const { ttlSeconds = 25, forceFresh = false } = options;
  const cacheKey = `${action}:${JSON.stringify(params)}`;
  const now = Date.now();

  // 1. Revisar si tenemos respuesta fresca en memoria
  if (!forceFresh && ttlSeconds > 0) {
    const cached = memoryCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }
  }

  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-store',
  });

  const text = await response.text();
  checkResponseText(text);

  try {
    const data = JSON.parse(text) as T;
    // Guardar en caché si la respuesta fue exitosa
    if (ttlSeconds > 0 && data && typeof data === 'object' && (data as any).success !== false) {
      memoryCache.set(cacheKey, {
        data,
        expiresAt: now + ttlSeconds * 1000,
      });
    }
    return data;
  } catch {
    throw new Error(`Error al procesar respuesta de Google Apps Script: ${text.substring(0, 200)}`);
  }
}

async function appsScriptPost<T>(payload: Record<string, unknown>): Promise<T> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL no está configurada en .env.local');
  }

  const action = String(payload.action || '');

  // Invalidación inteligente antes/después de la mutación
  if (action.includes('Militante')) {
    invalidateCache(['getMilitantes', 'getStats', 'searchMilitantes', 'findByPhone', 'checkDni']);
  } else if (action.includes('Evento')) {
    invalidateCache(['getEventos', 'getEventoById', 'getAsistencia']);
  } else if (action.includes('Asistencia')) {
    invalidateCache(['getAsistencia', 'checkAsistencia', 'getEventos', 'getEventoById']);
  } else if (action.includes('Usuario')) {
    invalidateCache(['getUsuarios', 'findUsuario']);
  }

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'text/plain',
    },
    redirect: 'follow',
  });

  const text = await response.text();
  checkResponseText(text);

  try {
    const result = JSON.parse(text) as T;
    // Invalidación confirmada
    if (action.includes('Militante')) {
      invalidateCache(['getMilitantes', 'getStats', 'searchMilitantes', 'findByPhone', 'checkDni']);
    } else if (action.includes('Evento')) {
      invalidateCache(['getEventos', 'getEventoById', 'getAsistencia']);
    } else if (action.includes('Asistencia')) {
      invalidateCache(['getAsistencia', 'checkAsistencia', 'getEventos', 'getEventoById']);
    } else if (action.includes('Usuario')) {
      invalidateCache(['getUsuarios', 'findUsuario']);
    }
    return result;
  } catch {
    throw new Error(`Error al procesar respuesta de Google Apps Script: ${text.substring(0, 200)}`);
  }
}

// ============ MILITANTES ============

export async function getMilitantes(forceFresh = false): Promise<ApiResponse<Militante[]>> {
  return appsScriptGet<ApiResponse<Militante[]>>('getMilitantes', {}, { ttlSeconds: 25, forceFresh });
}

export async function findMilitanteByPhone(telefono: string): Promise<VerifyPhoneResult> {
  return appsScriptGet<VerifyPhoneResult>('findByPhone', { telefono }, { ttlSeconds: 15 });
}

export async function checkDni(dni: string): Promise<DniCheckResult> {
  return appsScriptGet<DniCheckResult>('checkDni', { dni }, { ttlSeconds: 15 });
}

export async function searchMilitantes(query: string): Promise<ApiResponse<Militante[]>> {
  return appsScriptGet<ApiResponse<Militante[]>>('searchMilitantes', { q: query }, { ttlSeconds: 15 });
}

export async function getStats(forceFresh = false): Promise<ApiResponse<StatsData>> {
  return appsScriptGet<ApiResponse<StatsData>>('getStats', {}, { ttlSeconds: 25, forceFresh });
}

export async function approveMilitante(data: {
  rowIndex?: number;
  telefono?: string;
}): Promise<ApiResponse> {
  return appsScriptPost<ApiResponse>({
    action: 'approveMilitante',
    ...data,
  });
}

export async function rejectMilitante(data: {
  rowIndex?: number;
  telefono?: string;
}): Promise<ApiResponse> {
  return appsScriptPost<ApiResponse>({
    action: 'rejectMilitante',
    ...data,
  });
}

export async function updateMilitante(data: {
  telefono?: string;
  rowIndex?: number;
  nombres?: string;
  apellidos?: string;
  dni?: string;
  base?: string;
  estado_registro?: string;
  canal_registro?: string;
}): Promise<ApiResponse> {
  return appsScriptPost<ApiResponse>({
    action: 'updateMilitante',
    ...data,
  });
}

export async function addMilitante(data: {
  telefono: string;
  nombres?: string;
  apellidos?: string;
  dni?: string;
  base?: string;
  estado_registro?: string;
  canal_registro?: string;
}): Promise<ApiResponse> {
  return appsScriptPost<ApiResponse>({
    action: 'addMilitante',
    ...data,
  });
}

export async function deleteMilitante(data: {
  rowIndex?: number;
  telefono?: string;
}): Promise<ApiResponse> {
  return appsScriptPost<ApiResponse>({
    action: 'deleteMilitante',
    ...data,
  });
}

// ============ USUARIOS ============

export async function getUsuarios(forceFresh = false): Promise<ApiResponse<Usuario[]>> {
  return appsScriptGet<ApiResponse<Usuario[]>>('getUsuarios', {}, { ttlSeconds: 30, forceFresh });
}

export async function findUsuarioByUsername(username: string): Promise<ApiResponse<Usuario & { found: boolean }>> {
  return appsScriptGet<ApiResponse<Usuario & { found: boolean }>>('findUsuario', { username }, { ttlSeconds: 15 });
}

export async function addUsuario(data: {
  usuario: string;
  contrasena: string;
  rol: string;
  nombres?: string;
  apellidos?: string;
  cargo?: string;
}): Promise<ApiResponse> {
  return appsScriptPost<ApiResponse>({
    action: 'addUsuario',
    ...data,
  });
}

// ============ EVENTOS Y ASISTENCIA (v2.3) ============

export async function getEventos(forceFresh = false): Promise<ApiResponse<Evento[]>> {
  return appsScriptGet<ApiResponse<Evento[]>>('getEventos', {}, { ttlSeconds: 20, forceFresh });
}

export async function getEventoById(id_evento: string): Promise<ApiResponse<Evento>> {
  return appsScriptGet<ApiResponse<Evento>>('getEventoById', { id_evento }, { ttlSeconds: 15 });
}

export async function addEvento(data: {
  titulo: string;
  fecha: string;
  hora?: string;
  lugar?: string;
}): Promise<ApiResponse<Evento>> {
  return appsScriptPost<ApiResponse<Evento>>({
    action: 'addEvento',
    ...data,
  });
}

export async function updateEvento(data: {
  id_evento: string;
  rowIndex?: number;
  estado?: 'activo' | 'finalizado';
  titulo?: string;
  fecha?: string;
  hora?: string;
  lugar?: string;
}): Promise<ApiResponse> {
  return appsScriptPost<ApiResponse>({
    action: 'updateEvento',
    ...data,
  });
}

export async function getAsistencia(id_evento?: string, forceFresh = false): Promise<ApiResponse<Asistencia[]>> {
  const params: Record<string, string> = {};
  if (id_evento) params.id_evento = id_evento;
  return appsScriptGet<ApiResponse<Asistencia[]>>('getAsistencia', params, { ttlSeconds: 15, forceFresh });
}

export async function checkAsistencia(
  id_evento: string,
  dni: string
): Promise<ApiResponse<Asistencia & { alreadyMarked: boolean }>> {
  return appsScriptGet<ApiResponse<Asistencia & { alreadyMarked: boolean }>>('checkAsistencia', {
    id_evento,
    dni,
  });
}

export async function marcarAsistencia(data: {
  id_evento: string;
  dni: string;
  metodo: 'qr_puerta' | 'scan_admin' | 'manual';
}): Promise<ApiResponse<Asistencia & { notFound?: boolean; alreadyMarked?: boolean }>> {
  return appsScriptPost<ApiResponse<Asistencia & { notFound?: boolean; alreadyMarked?: boolean }>>({
    action: 'marcarAsistencia',
    ...data,
  });
}

