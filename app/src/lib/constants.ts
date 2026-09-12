// ============================================
// Constantes del sistema
// ============================================

export const PREFIJOS_TELEFONICOS = [
  { code: '+51', country: 'Perú', flag: '🇵🇪' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
];

export const BASES_DISPONIBLES = [
  'Gregorio Albarracín, ASOC. PROMUVI',
  'Taller Vivienda, ASOC. FUNDO PARA',
  'DANZA LLAMERADA',
];

export const ESTADOS_REGISTRO = {
  PENDIENTE: 'pendiente',
  COMPLETADO: 'completado',
} as const;

export const CANALES_REGISTRO = {
  AUTO_REGISTRO: 'Auto-registro',
  MANUAL: 'Registro manual',
} as const;

export const ROLES = {
  ADMIN: 'admin',
  ASISTENTE: 'asistente',
} as const;
