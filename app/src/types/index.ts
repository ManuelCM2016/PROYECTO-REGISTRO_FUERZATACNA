// ============================================
// Tipos centrales del sistema
// ============================================

export interface Militante {
  rowIndex?: number;
  id_whatsapp: string;
  nombres: string;
  apellidos: string;
  dni: string;
  base: string;
  estado_registro: 'pendiente' | 'completado' | 'en_revision' | 'rechazado' | 'inactivo';
  canal_registro: string;
}

export interface Usuario {
  rowIndex?: number;
  id: string;
  usuario: string;
  contrasena?: string; // Solo para autenticación, no se expone en listados
  rol: 'admin' | 'asistente';
  nombres?: string;
  apellidos?: string;
  cargo?: string;
}

export interface Session {
  userId: string;
  username: string;
  role: 'admin' | 'asistente';
  nombres?: string;
  apellidos?: string;
  cargo?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  total?: number;
  found?: boolean;
  status?: string;
}

export interface StatsData {
  total: number;
  completados: number;
  pendientes: number;
  en_revision: number;
  rechazados?: number;
  inactivos?: number;
}

export interface VerifyPhoneResult {
  success: boolean;
  found: boolean;
  status: 'no_existe' | 'pendiente' | 'completado' | 'en_revision' | 'rechazado' | 'inactivo';
  data?: Militante;
  error?: string;
}

export interface DniCheckResult {
  success: boolean;
  found: boolean;
  data?: {
    dni: string;
    nombres?: string;
    apellidos?: string;
    id_whatsapp?: string;
    estado_registro?: string;
  };
  error?: string;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface Evento {
  rowIndex?: number;
  id_evento: string;
  titulo: string;
  fecha: string;
  hora: string;
  lugar: string;
  estado: 'activo' | 'finalizado';
  creado_en?: string;
  total_asistentes?: number;
}

export interface Asistencia {
  rowIndex?: number;
  id_asistencia: string;
  id_evento: string;
  titulo_evento?: string;
  dni: string;
  nombres: string;
  apellidos: string;
  base: string;
  telefono: string;
  fecha_hora: string;
  metodo: 'qr_puerta' | 'scan_admin' | 'manual';
}

