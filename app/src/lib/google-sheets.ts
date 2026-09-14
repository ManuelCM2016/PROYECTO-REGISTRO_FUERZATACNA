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
  Pollada,
  TicketPollada,
} from '@/types';

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Semáforo de concurrencia para proteger Google Apps Script
// Limita a 20 llamadas simultáneas para no saturar el límite de 30 de GAS
// ============================================
class ConcurrencySemaphore {
  private current = 0;
  private readonly max: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    this.max = max;
  }

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    // Esperar en cola hasta que un slot se libere
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve();
      });
    });
  }

  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }
}

const gasSemaphore = new ConcurrencySemaphore(20);

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
  options: { ttlSeconds?: number; forceFresh?: boolean; retries?: number } = {}
): Promise<T> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL no está configurada en .env.local');
  }

  const { ttlSeconds = 25, forceFresh = false, retries = 2 } = options;
  const cacheKey = `${action}:${JSON.stringify(params)}`;
  const now = Date.now();

  // 1. Revisar si tenemos respuesta fresca en memoria (sin consumir slot del semáforo)
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

  // Adquirir slot del semáforo antes de llamar a Google Apps Script
  await gasSemaphore.acquire();

  let lastError: unknown = null;
  const maxAttempts = 1 + retries;

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          redirect: 'follow',
          cache: 'no-store',
        });

        const text = await response.text();

        // Detectar respuesta HTML (Arranque en frío de Google Apps Script, redirección intermedia o sobrecarga)
        const isHtmlResponse =
          text.includes('accounts.google.com') ||
          text.includes('Sign in - Google Accounts') ||
          text.includes('<!doctype html>') ||
          text.includes('<html');

        if (isHtmlResponse) {
          if (attempt < maxAttempts) {
            // El primer intento despierta al contenedor de Google; reintentamos en breve
            await delay(600 * attempt);
            continue;
          } else {
            console.error(`[Google Apps Script Cold-Start / HTML error]: ${text.substring(0, 250)}`);
            throw new Error('El servidor tardó en responder. Por favor, pulsa el botón nuevamente.');
          }
        }

        const data = JSON.parse(text) as T;
        // Guardar en caché si la respuesta fue exitosa
        if (ttlSeconds > 0 && data && typeof data === 'object' && (data as any).success !== false) {
          memoryCache.set(cacheKey, {
            data,
            expiresAt: Date.now() + ttlSeconds * 1000,
          });
        }
        return data;
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          await delay(600 * attempt);
        }
      }
    }
  } finally {
    gasSemaphore.release();
  }

  const errorMsg = lastError instanceof Error ? lastError.message : 'Error de conexión con el padrón';
  throw new Error(errorMsg);
}

async function appsScriptPost<T>(payload: Record<string, unknown>, retries = 2): Promise<T> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL no está configurada en .env.local');
  }

  const action = String(payload.action || '');

  // Invalidación inteligente antes de la mutación
  if (action.includes('Militante')) {
    invalidateCache(['getMilitantes', 'getStats', 'searchMilitantes', 'findByPhone', 'checkDni']);
  } else if (action.includes('Evento')) {
    invalidateCache(['getEventos', 'getEventoById', 'getAsistencia']);
  } else if (action.includes('Asistencia')) {
    invalidateCache(['getAsistencia', 'checkAsistencia', 'getEventos', 'getEventoById']);
  } else if (action.includes('Usuario')) {
    invalidateCache(['getUsuarios', 'findUsuario']);
  }

  let lastError: unknown = null;
  const maxAttempts = 1 + retries;

  // Adquirir slot del semáforo antes de llamar a Google Apps Script
  await gasSemaphore.acquire();

  // Construir la URL con el action y parámetros clave en la query string.
  // Esto es VITAL porque si Google Apps Script o el proxy redirige internamente vía 302 a GET,
  // los query params se conservan y evitan que el servidor reciba un GET con action=undefined.
  const postUrl = new URL(APPS_SCRIPT_URL);
  if (action) {
    postUrl.searchParams.set('action', action);
  }
  if (payload.id_evento) postUrl.searchParams.set('id_evento', String(payload.id_evento));
  if (payload.dni) postUrl.searchParams.set('dni', String(payload.dni));
  if (payload.metodo) postUrl.searchParams.set('metodo', String(payload.metodo));

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(postUrl.toString(), {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'text/plain',
          },
          redirect: 'follow',
        });

        const text = await response.text();

        const isHtmlResponse =
          text.includes('accounts.google.com') ||
          text.includes('Sign in - Google Accounts') ||
          text.includes('<!doctype html>') ||
          text.includes('<html');

        if (isHtmlResponse) {
          if (attempt < maxAttempts) {
            await delay(600 * attempt);
            continue;
          } else {
            console.error(`[Google Apps Script POST HTML error]: ${text.substring(0, 250)}`);
            throw new Error('El servidor tardó en procesar la solicitud. Por favor, intenta de nuevo.');
          }
        }

        const result = JSON.parse(text) as any;

        // Si Google Apps Script respondió con un rebote erróneo de GET no válido
        if (result && result.success === false && typeof result.error === 'string' && result.error.includes('Acción GET')) {
          // Si era marcarAsistencia, verificar si ya se grabó exitosamente en la hoja
          if (action === 'marcarAsistencia' && payload.id_evento && payload.dni) {
            try {
              const check = await checkAsistencia(String(payload.id_evento), String(payload.dni));
              if (check.success && (check as any).data?.alreadyMarked) {
                const asistData = (check as any).data;
                return {
                  success: true,
                  message: `¡Asistencia registrada con éxito! Bienvenido(a) ${asistData.nombres || ''}`,
                  data: asistData,
                } as unknown as T;
              }
            } catch {
              // si falla la verificación, reintentamos
            }
          }

          if (attempt < maxAttempts) {
            await delay(600 * attempt);
            continue;
          }
        }

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
        return result as T;
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          await delay(600 * attempt);
        }
      }
    }
  } finally {
    gasSemaphore.release();
  }

  const errorMsg = lastError instanceof Error ? lastError.message : 'Error de conexión al procesar la acción';
  throw new Error(errorMsg);
}

export async function warmupAppsScript(): Promise<boolean> {
  try {
    const res = await appsScriptGet<{ success: boolean }>('ping', {}, { ttlSeconds: 60, retries: 1 });
    return Boolean(res && res.success);
  } catch {
    return false;
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

export async function deleteEvento(id_evento: string, rowIndex?: number): Promise<ApiResponse> {
  return appsScriptPost<ApiResponse>({
    action: 'deleteEvento',
    id_evento,
    rowIndex,
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
  return appsScriptPost<ApiResponse<Asistencia & { notFound?: boolean; alreadyMarked?: boolean }>>(
    {
      action: 'marcarAsistencia',
      ...data,
    }
  );
}

// ============ APOYADA / POLLADA ============

export async function getPolladas(forceFresh = false): Promise<ApiResponse<Pollada[]>> {
  return appsScriptGet<ApiResponse<Pollada[]>>('getPolladas', {}, { ttlSeconds: 20, forceFresh });
}

export async function getPolladaById(id_pollada: string): Promise<ApiResponse<Pollada>> {
  return appsScriptGet<ApiResponse<Pollada>>('getPolladaById', { id_pollada }, { ttlSeconds: 15 });
}

export async function addPollada(data: {
  titulo: string;
  fecha: string;
  hora?: string;
  lugar?: string;
  precio_ticket?: number;
  min_tickets?: number;
}): Promise<ApiResponse<Pollada>> {
  return appsScriptPost<ApiResponse<Pollada>>({
    action: 'addPollada',
    ...data,
  });
}

export async function updatePollada(data: {
  id_pollada: string;
  rowIndex?: number;
  titulo?: string;
  fecha?: string;
  hora?: string;
  lugar?: string;
  precio_ticket?: number;
  min_tickets?: number;
  estado?: 'activo' | 'venta' | 'recojo' | 'finalizado';
}): Promise<ApiResponse> {
  return appsScriptPost<ApiResponse>({
    action: 'updatePollada',
    ...data,
  });
}

export async function deletePollada(id_pollada: string, rowIndex?: number): Promise<ApiResponse> {
  return appsScriptPost<ApiResponse>({
    action: 'deletePollada',
    id_pollada,
    rowIndex,
  });
}

export async function getTicketsPollada(id_pollada: string, forceFresh = false): Promise<ApiResponse<TicketPollada[]>> {
  return appsScriptGet<ApiResponse<TicketPollada[]>>(
    'getTicketsPollada',
    { id_pollada },
    { ttlSeconds: 10, forceFresh }
  );
}

export async function checkTicketPollada(
  id_pollada: string,
  dni: string
): Promise<ApiResponse<TicketPollada & { found: boolean }>> {
  return appsScriptGet<ApiResponse<TicketPollada & { found: boolean }>>(
    'checkTicketPollada',
    { id_pollada, dni },
    { ttlSeconds: 5 }
  );
}

export async function registrarCompra(data: {
  id_pollada: string;
  dni: string;
  cantidad_tickets: number;
  num_ticket_inicio?: string;
  num_ticket_fin?: string;
  monto_pagado?: number;
  registrado_por?: string;
}): Promise<ApiResponse<TicketPollada & { alreadyRegistered?: boolean; notFound?: boolean }>> {
  return appsScriptPost<ApiResponse<TicketPollada & { alreadyRegistered?: boolean; notFound?: boolean }>>(
    {
      action: 'registrarCompra',
      ...data,
    }
  );
}

export async function verificarTicket(data: {
  id_pollada: string;
  dni: string;
  verificado_por?: string;
}): Promise<ApiResponse<TicketPollada & { alreadyVerified?: boolean; alreadyDelivered?: boolean; notFound?: boolean }>> {
  return appsScriptPost<ApiResponse<TicketPollada & { alreadyVerified?: boolean; alreadyDelivered?: boolean; notFound?: boolean }>>(
    {
      action: 'verificarTicket',
      ...data,
    }
  );
}

export async function registrarEntrega(data: {
  id_pollada: string;
  dni: string;
  entregado_por?: string;
}): Promise<ApiResponse<TicketPollada & { notVerified?: boolean; alreadyDelivered?: boolean; notFound?: boolean }>> {
  return appsScriptPost<ApiResponse<TicketPollada & { notVerified?: boolean; alreadyDelivered?: boolean; notFound?: boolean }>>(
    {
      action: 'registrarEntrega',
      ...data,
    }
  );
}

export async function cancelarCompra(data: {
  id_compra?: string;
  id_pollada?: string;
  dni?: string;
}): Promise<ApiResponse> {
  return appsScriptPost<ApiResponse>({ action: 'cancelarCompra', ...data });
}
