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

async function appsScriptGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL no está configurada en .env.local');
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
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Error al procesar respuesta de Google Apps Script: ${text.substring(0, 200)}`);
  }
}

async function appsScriptPost<T>(payload: Record<string, unknown>): Promise<T> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL no está configurada en .env.local');
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
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Error al procesar respuesta de Google Apps Script: ${text.substring(0, 200)}`);
  }
}

// ============ MILITANTES ============

export async function getMilitantes(): Promise<ApiResponse<Militante[]>> {
  return appsScriptGet<ApiResponse<Militante[]>>('getMilitantes');
}

export async function findMilitanteByPhone(telefono: string): Promise<VerifyPhoneResult> {
  return appsScriptGet<VerifyPhoneResult>('findByPhone', { telefono });
}

export async function checkDni(dni: string): Promise<DniCheckResult> {
  return appsScriptGet<DniCheckResult>('checkDni', { dni });
}

export async function searchMilitantes(query: string): Promise<ApiResponse<Militante[]>> {
  return appsScriptGet<ApiResponse<Militante[]>>('searchMilitantes', { q: query });
}

export async function getStats(): Promise<ApiResponse<StatsData>> {
  return appsScriptGet<ApiResponse<StatsData>>('getStats');
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

// ============ USUARIOS ============

export async function getUsuarios(): Promise<ApiResponse<Usuario[]>> {
  return appsScriptGet<ApiResponse<Usuario[]>>('getUsuarios');
}

export async function findUsuarioByUsername(username: string): Promise<ApiResponse<Usuario & { found: boolean }>> {
  return appsScriptGet<ApiResponse<Usuario & { found: boolean }>>('findUsuario', { username });
}

export async function addUsuario(data: {
  usuario: string;
  contrasena: string;
  rol: string;
}): Promise<ApiResponse> {
  return appsScriptPost<ApiResponse>({
    action: 'addUsuario',
    ...data,
  });
}

// ============ EVENTOS Y ASISTENCIA (v2.3) ============

export async function getEventos(): Promise<ApiResponse<Evento[]>> {
  return appsScriptGet<ApiResponse<Evento[]>>('getEventos');
}

export async function getEventoById(id_evento: string): Promise<ApiResponse<Evento>> {
  return appsScriptGet<ApiResponse<Evento>>('getEventoById', { id_evento });
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

export async function getAsistencia(id_evento?: string): Promise<ApiResponse<Asistencia[]>> {
  const params: Record<string, string> = {};
  if (id_evento) params.id_evento = id_evento;
  return appsScriptGet<ApiResponse<Asistencia[]>>('getAsistencia', params);
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

