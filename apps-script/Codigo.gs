/**
 * =====================================================
 * BD_FUERZATACNA_REGISTRO - Google Apps Script (v2.3)
 * =====================================================
 * Este código debe copiarse en el editor de Apps Script
 * vinculado a la hoja de cálculo BD_BASE_FUERZA_TACNA.
 * 
 * Novedades v2.3:
 * - Soporte integral para Gestión de Eventos y Reuniones (Pestaña 'Eventos').
 * - Control de Asistencia Multimodal (Pestaña 'Asistencia'):
 *   * Modalidad 1: Escaneo de carnet de militante por administrador (scan_admin).
 *   * Modalidad 2: Registro manual por DNI/nombre en panel (manual).
 *   * Modalidad 3: Auto-registro en puerta con cartel QR y DNI (qr_puerta).
 * - Auto-creación automática de pestañas 'Eventos' y 'Asistencia' con cabeceras.
 * - Prevención estricta de duplicados de asistencia por evento y DNI.
 * - Protección contra #ERROR! forzando texto plano (@ y apóstrofe inicial).
 * 
 * IMPORTANTE PARA PUBLICAR:
 * 1. Clic en "Implementar" > "Administrar implementaciones"
 * 2. Clic en el icono del LÁPIZ (Editar)
 * 3. En "Versión" seleccionar: "Nueva versión"
 * 4. En "Ejecutar como": "Yo"
 * 5. En "Quién tiene acceso": "Cualquier persona"
 * 6. Clic en "Implementar"
 */

// ============ CONFIGURACIÓN ============
const SHEET_MILITANTES = 'Base_Militantes';
const SHEET_USUARIOS = 'Usuarios_Sistema';
const SHEET_EVENTOS = 'Eventos';
const SHEET_ASISTENCIA = 'Asistencia';

// Columnas Base_Militantes (0-indexed)
const COL_M = {
  ID_WHATSAPP: 0,     // A
  NOMBRES: 1,          // B
  APELLIDOS: 2,        // C
  DNI: 3,              // D
  BASE: 4,             // E
  ESTADO_REGISTRO: 5,  // F
  CANAL_REGISTRO: 6    // G
};

// Columnas Usuarios_Sistema (0-indexed)
const COL_U = {
  ID: 0,          // A
  USUARIO: 1,     // B
  CONTRASENA: 2,  // C
  ROL: 3,         // D
  NOMBRES: 4,     // E
  APELLIDOS: 5,   // F
  CARGO: 6        // G
};

// Columnas Eventos (0-indexed)
const COL_EV = {
  ID_EVENTO: 0,   // A
  TITULO: 1,      // B
  FECHA: 2,       // C
  HORA: 3,        // D
  LUGAR: 4,       // E
  ESTADO: 5,      // F (activo | finalizado)
  CREADO_EN: 6    // G
};

// Columnas Asistencia (0-indexed)
const COL_AS = {
  ID_ASISTENCIA: 0,   // A
  ID_EVENTO: 1,       // B
  TITULO_EVENTO: 2,   // C
  DNI: 3,             // D
  NOMBRES: 4,         // E
  APELLIDOS: 5,       // F
  BASE: 6,            // G
  TELEFONO: 7,        // H
  FECHA_HORA: 8,      // I
  METODO: 9           // J (qr_puerta | scan_admin | manual)
};

// ============ HELPERS ============

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Obtiene la pestaña de forma ultra-flexible y crea las requeridas si no existen.
 */
function getSheet(name) {
  const ss = getSpreadsheet();
  
  // 1. Nombre exacto
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  
  // 2. Reemplazar _ por espacio
  const withSpaces = name.replace(/_/g, ' ');
  sheet = ss.getSheetByName(withSpaces);
  if (sheet) return sheet;
  
  // 3. Reemplazar espacios por _
  const withUnderscores = name.replace(/\s+/g, '_');
  sheet = ss.getSheetByName(withUnderscores);
  if (sheet) return sheet;
  
  // 4. Búsqueda insensible a mayúsculas y caracteres especiales
  const allSheets = ss.getSheets();
  const cleanTarget = name.toLowerCase().replace(/[\s_-]/g, '');
  
  for (let i = 0; i < allSheets.length; i++) {
    const sName = allSheets[i].getName().toLowerCase().replace(/[\s_-]/g, '');
    if (sName === cleanTarget) {
      return allSheets[i];
    }
  }
  
  // 5. Creación automática si no existe
  if (cleanTarget.includes('usuario')) {
    const newSheet = ss.insertSheet('Usuarios_Sistema');
    newSheet.appendRow(['ID', 'USUARIO', 'CONTRASEÑA', 'ROL', 'NOMBRES', 'APELLIDOS', 'CARGO']);
    return newSheet;
  }
  
  if (cleanTarget.includes('militante') || cleanTarget.includes('base')) {
    const newSheet = ss.insertSheet('Base_Militantes');
    newSheet.appendRow(['ID_WhatsApp', 'NOMBRES', 'APELLIDOS', 'DNI', 'BASE', 'ESTADO_REGISTRO', 'CANAL_REGISTRO']);
    return newSheet;
  }

  if (cleanTarget.includes('evento')) {
    const newSheet = ss.insertSheet('Eventos');
    newSheet.appendRow(['ID_EVENTO', 'TITULO', 'FECHA', 'HORA', 'LUGAR', 'ESTADO', 'CREADO_EN']);
    return newSheet;
  }

  if (cleanTarget.includes('asistencia')) {
    const newSheet = ss.insertSheet('Asistencia');
    newSheet.appendRow(['ID_ASISTENCIA', 'ID_EVENTO', 'TITULO_EVENTO', 'DNI', 'NOMBRES', 'APELLIDOS', 'BASE', 'TELEFONO', 'FECHA_HORA', 'METODO']);
    return newSheet;
  }
  
  return null;
}

/**
 * Pinta visualmente la celda de ESTADO_REGISTRO en Google Sheets.
 */
function styleStatusCell(sheet, rowIndex, status) {
  try {
    if (!sheet || rowIndex <= 1) return;
    const cell = sheet.getRange(rowIndex, COL_M.ESTADO_REGISTRO + 1);
    const s = String(status || '').toLowerCase().trim();
    
    if (s === 'en_revision') {
      cell.setBackground('#FEF08A'); // Amarillo suave
      cell.setFontColor('#854D0E');  // Ámbar oscuro
      cell.setFontWeight('bold');
    } else if (s === 'completado') {
      cell.setBackground('#D1FAE5'); // Verde suave
      cell.setFontColor('#065F46');  // Verde oscuro
      cell.setFontWeight('bold');
    } else if (s === 'pendiente') {
      cell.setBackground('#DBEAFE'); // Azul suave
      cell.setFontColor('#1E40AF');  // Azul oscuro
      cell.setFontWeight('normal');
    } else if (s === 'rechazado') {
      cell.setBackground('#FEE2E2'); // Rojo suave
      cell.setFontColor('#991B1B');  // Rojo oscuro
      cell.setFontWeight('bold');
    } else if (s === 'inactivo') {
      cell.setBackground('#E2E8F0'); // Gris pizarra suave
      cell.setFontColor('#475569');  // Texto gris oscuro
      cell.setFontWeight('bold');
    }
  } catch(e) {
    // No bloquear ejecución
  }
}

/**
 * Auto-repara celdas que tengan #ERROR!
 */
function checkAndRepairPhoneCell(sheet, rowIndex, currentValue) {
  const valStr = String(currentValue || '').trim();
  if (valStr === '#ERROR!' || valStr.includes('#ERROR')) {
    try {
      const cell = sheet.getRange(rowIndex, COL_M.ID_WHATSAPP + 1);
      const formula = cell.getFormula();
      if (formula) {
        let recovered = formula.replace(/^=\s*\+?/, '+').trim();
        if (!recovered.startsWith('+')) recovered = '+' + recovered;
        cell.setNumberFormat('@').setValue("'" + recovered);
        return recovered;
      }
    } catch(e) {}
  }
  return valStr;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Normaliza y compara teléfonos.
 */
function isPhoneMatch(phone1, phone2) {
  if (!phone1 || !phone2) return false;
  
  const s1 = String(phone1).trim();
  const s2 = String(phone2).trim();
  if (s1 === s2) return true;
  
  const n1 = s1.replace(/[^\d+]/g, '');
  const n2 = s2.replace(/[^\d+]/g, '');
  if (n1 && n2 && n1 === n2) return true;
  
  const d1 = s1.replace(/\D/g, '');
  const d2 = s2.replace(/\D/g, '');
  if (!d1 || !d2) return false;
  if (d1 === d2) return true;
  
  if (d1.length >= 9 && d2.length >= 9) {
    if (d1.slice(-9) === d2.slice(-9)) return true;
  }
  
  return false;
}

/**
 * Normaliza y formatea una fecha de celda (Date o String) a texto limpio 'yyyy-MM-dd'.
 * Elimina cualquier zona horaria o texto crudo como GMT.
 */
function cleanSheetDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || 'America/Lima', 'yyyy-MM-dd');
  }
  const s = String(val).trim();
  if (s.includes('1899') || s.includes('1900')) return '';
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
    return Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Lima', 'yyyy-MM-dd');
  }
  return s.replace(/\s*GMT[+-]\d{4}.*$/, '').trim();
}

/**
 * Normaliza y formatea una hora de celda (Date o String) a texto limpio 'HH:mm'.
 */
function cleanSheetTime(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || 'America/Lima', 'HH:mm');
  }
  const s = String(val).trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    return m[1].padStart(2, '0') + ':' + m[2];
  }
  return s.replace(/\s*GMT[+-]\d{4}.*$/, '').trim();
}

/**
 * Normaliza y formatea una marca de tiempo completa a 'yyyy-MM-dd HH:mm:ss'.
 */
function cleanSheetDateTime(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || 'America/Lima', 'yyyy-MM-dd HH:mm:ss');
  }
  const s = String(val).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
    return Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Lima', 'yyyy-MM-dd HH:mm:ss');
  }
  return s.replace(/\s*GMT[+-]\d{4}.*$/, '').trim();
}

// ============ ENDPOINTS GET & POST ============

function doGet(e) {
  try {
    const action = e.parameter.action;
    
    switch(action) {
      case 'ping':
        return jsonResponse({ 
          success: true, 
          message: 'API activa de Fuerza Tacna v2.3', 
          timestamp: new Date().toISOString() 
        });
      
      // Militantes
      case 'getMilitantes':
        return handleGetMilitantes(e.parameter);
      case 'findByPhone':
        return handleFindByPhone(e.parameter.telefono);
      case 'checkDni':
        return handleCheckDni(e.parameter.dni);
      case 'searchMilitantes':
        return handleSearchMilitantes(e.parameter.q);
      case 'getStats':
        return handleGetStats();
      case 'repairErrors':
        return handleRepairAllErrors();
      
      // Usuarios
      case 'getUsuarios':
        return handleGetUsuarios();
      case 'findUsuario':
        return handleFindUsuario(e.parameter.username);
      
      // Eventos y Asistencia (v2.3)
      case 'getEventos':
        return handleGetEventos();
      case 'getEventoById':
        return handleGetEventoById(e.parameter.id_evento);
      case 'getAsistencia':
        return handleGetAsistencia(e.parameter.id_evento);
      case 'checkAsistencia':
        return handleCheckAsistencia(e.parameter.id_evento, e.parameter.dni);
      
      default:
        return jsonResponse({ success: false, error: 'Acción GET no válida: ' + action });
    }
  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    
    switch(action) {
      // Militantes
      case 'updateMilitante':
        return handleUpdateMilitante(payload);
      case 'approveMilitante':
        return handleApproveMilitante(payload);
      case 'rejectMilitante':
        return handleRejectMilitante(payload);
      case 'addMilitante':
        return handleAddMilitante(payload);
      case 'deleteMilitante':
        return handleDeleteMilitante(payload);
      
      // Usuarios
      case 'addUsuario':
        return handleAddUsuario(payload);
      case 'deleteUsuario':
        return handleDeleteUsuario(payload);
      
      // Eventos y Asistencia (v2.3)
      case 'addEvento':
        return handleAddEvento(payload);
      case 'updateEvento':
        return handleUpdateEvento(payload);
      case 'marcarAsistencia':
        return handleMarcarAsistencia(payload);
      
      default:
        return jsonResponse({ success: false, error: 'Acción POST no válida: ' + action });
    }
  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ============ MILITANTES ============

function handleRepairAllErrors() {
  const sheet = getSheet(SHEET_MILITANTES);
  if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña' });
  
  const lastRow = sheet.getLastRow();
  let count = 0;
  
  for (let i = 2; i <= lastRow; i++) {
    const cell = sheet.getRange(i, COL_M.ID_WHATSAPP + 1);
    const val = String(cell.getValue() || '');
    if (val === '#ERROR!' || val.includes('#ERROR')) {
      const formula = cell.getFormula();
      if (formula) {
        let recovered = formula.replace(/^=\s*\+?/, '+').trim();
        if (!recovered.startsWith('+')) recovered = '+' + recovered;
        cell.setNumberFormat('@').setValue("'" + recovered);
        count++;
      }
    }
  }
  
  return jsonResponse({ success: true, message: `Se repararon ${count} celdas con #ERROR!`, repaired: count });
}

function handleCheckDni(dni) {
  if (!dni) return jsonResponse({ success: false, error: 'DNI requerido' });
  
  const cleanDni = String(dni).replace(/\D/g, '').trim();
  if (cleanDni.length < 8) return jsonResponse({ success: true, found: false });
  
  const sheet = getSheet(SHEET_MILITANTES);
  if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña de Militantes' });
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowDni = String(row[COL_M.DNI] || '').replace(/\D/g, '').trim();
    if (rowDni && rowDni === cleanDni) {
      return jsonResponse({
        success: true,
        found: true,
        data: {
          dni: rowDni,
          nombres: String(row[COL_M.NOMBRES] || '').trim(),
          apellidos: String(row[COL_M.APELLIDOS] || '').trim(),
          base: String(row[COL_M.BASE] || '').trim(),
          id_whatsapp: String(row[COL_M.ID_WHATSAPP] || '').trim(),
          estado_registro: String(row[COL_M.ESTADO_REGISTRO] || '').trim().toLowerCase()
        }
      });
    }
  }
  
  return jsonResponse({ success: true, found: false });
}

function handleGetMilitantes(params) {
  const sheet = getSheet(SHEET_MILITANTES);
  if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña de Militantes' });
  
  const data = sheet.getDataRange().getValues();
  const militantes = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let phone = String(row[COL_M.ID_WHATSAPP] || '').trim();
    if (!phone) continue;
    
    if (phone === '#ERROR!' || phone.includes('#ERROR')) {
      phone = checkAndRepairPhoneCell(sheet, i + 1, phone);
    }
    
    militantes.push({
      rowIndex: i + 1,
      id_whatsapp: phone,
      nombres: String(row[COL_M.NOMBRES] || '').trim(),
      apellidos: String(row[COL_M.APELLIDOS] || '').trim(),
      dni: String(row[COL_M.DNI] || '').trim(),
      base: String(row[COL_M.BASE] || '').trim(),
      estado_registro: String(row[COL_M.ESTADO_REGISTRO] || 'pendiente').trim().toLowerCase(),
      canal_registro: String(row[COL_M.CANAL_REGISTRO] || '').trim()
    });
  }
  
  return jsonResponse({ success: true, data: militantes, total: militantes.length });
}

function handleFindByPhone(telefono) {
  if (!telefono) return jsonResponse({ success: false, error: 'Teléfono requerido' });
  
  const sheet = getSheet(SHEET_MILITANTES);
  if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña de Militantes' });
  
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let phoneInSheet = row[COL_M.ID_WHATSAPP];
    if (!phoneInSheet) continue;
    
    if (String(phoneInSheet).includes('#ERROR')) {
      phoneInSheet = checkAndRepairPhoneCell(sheet, i + 1, phoneInSheet);
    }
    
    if (isPhoneMatch(phoneInSheet, telefono)) {
      const militante = {
        rowIndex: i + 1,
        id_whatsapp: String(phoneInSheet).trim(),
        nombres: String(row[COL_M.NOMBRES] || '').trim(),
        apellidos: String(row[COL_M.APELLIDOS] || '').trim(),
        dni: String(row[COL_M.DNI] || '').trim(),
        base: String(row[COL_M.BASE] || '').trim(),
        estado_registro: String(row[COL_M.ESTADO_REGISTRO] || 'pendiente').trim().toLowerCase(),
        canal_registro: String(row[COL_M.CANAL_REGISTRO] || '').trim()
      };
      
      let status = militante.estado_registro;
      if (status === 'en_revision') status = 'en_revision';
      else if (status === 'rechazado') status = 'rechazado';
      else if (status === 'completado') status = 'completado';
      else if (militante.dni && militante.nombres && militante.apellidos) status = 'completado';
      else status = 'pendiente';
      
      return jsonResponse({ 
        success: true, 
        found: true, 
        status: status, 
        data: militante 
      });
    }
  }
  
  return jsonResponse({ success: true, found: false, status: 'no_existe' });
}

function handleSearchMilitantes(query) {
  if (!query) return handleGetMilitantes({});
  
  const normalizedQuery = query.toLowerCase().trim();
  const sheet = getSheet(SHEET_MILITANTES);
  if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña de Militantes' });
  
  const data = sheet.getDataRange().getValues();
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[COL_M.ID_WHATSAPP]) continue;
    
    let phone = String(row[COL_M.ID_WHATSAPP]);
    if (phone.includes('#ERROR')) {
      phone = checkAndRepairPhoneCell(sheet, i + 1, phone);
    }
    
    const nombres = String(row[COL_M.NOMBRES] || '').toLowerCase();
    const apellidos = String(row[COL_M.APELLIDOS] || '').toLowerCase();
    const dni = String(row[COL_M.DNI] || '').toLowerCase();
    const base = String(row[COL_M.BASE] || '').toLowerCase();
    const estado = String(row[COL_M.ESTADO_REGISTRO] || '').toLowerCase();
    
    if (isPhoneMatch(phone, query) || 
        nombres.includes(normalizedQuery) || 
        apellidos.includes(normalizedQuery) || 
        dni.includes(normalizedQuery) ||
        base.includes(normalizedQuery) ||
        estado.includes(normalizedQuery)) {
      results.push({
        rowIndex: i + 1,
        id_whatsapp: phone.trim(),
        nombres: String(row[COL_M.NOMBRES] || '').trim(),
        apellidos: String(row[COL_M.APELLIDOS] || '').trim(),
        dni: String(row[COL_M.DNI] || '').trim(),
        base: String(row[COL_M.BASE] || '').trim(),
        estado_registro: String(row[COL_M.ESTADO_REGISTRO] || 'pendiente').trim().toLowerCase(),
        canal_registro: String(row[COL_M.CANAL_REGISTRO] || '').trim()
      });
    }
  }
  
  return jsonResponse({ success: true, data: results, total: results.length });
}

function handleGetStats() {
  const sheet = getSheet(SHEET_MILITANTES);
  if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña de Militantes' });
  
  const data = sheet.getDataRange().getValues();
  let total = 0;
  let completados = 0;
  let pendientes = 0;
  let en_revision = 0;
  let rechazados = 0;
  let inactivos = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[COL_M.ID_WHATSAPP]) continue;
    total++;
    
    const estado = String(row[COL_M.ESTADO_REGISTRO] || '').trim().toLowerCase();
    if (estado === 'en_revision') en_revision++;
    else if (estado === 'completado') completados++;
    else if (estado === 'rechazado') rechazados++;
    else if (estado === 'inactivo') inactivos++;
    else pendientes++;
  }
  
  return jsonResponse({ 
    success: true, 
    data: { total, completados, pendientes, en_revision, rechazados, inactivos } 
  });
}

function handleUpdateMilitante(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const { rowIndex, telefono, nombres, apellidos, dni, base, estado_registro, canal_registro } = payload;
    const sheet = getSheet(SHEET_MILITANTES);
    if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña de Militantes' });
    
    let targetRow = rowIndex;
    
    if (!targetRow && telefono) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        let phoneInSheet = data[i][COL_M.ID_WHATSAPP];
        if (String(phoneInSheet).includes('#ERROR')) {
          phoneInSheet = checkAndRepairPhoneCell(sheet, i + 1, phoneInSheet);
        }
        if (isPhoneMatch(phoneInSheet, telefono)) {
          targetRow = i + 1;
          break;
        }
      }
    }
    
    if (!targetRow) return jsonResponse({ success: false, error: 'Militante no encontrado' });
    
    if (telefono !== undefined) {
      const cleanP = String(telefono).replace(/^'+/, '').trim();
      sheet.getRange(targetRow, COL_M.ID_WHATSAPP + 1).setNumberFormat('@').setValue("'" + cleanP);
    }
    if (nombres !== undefined) sheet.getRange(targetRow, COL_M.NOMBRES + 1).setValue(nombres);
    if (apellidos !== undefined) sheet.getRange(targetRow, COL_M.APELLIDOS + 1).setValue(apellidos);
    if (dni !== undefined) {
      const cleanD = String(dni).replace(/\D/g, '').trim();
      sheet.getRange(targetRow, COL_M.DNI + 1).setNumberFormat('@').setValue("'" + cleanD);
    }
    if (base !== undefined) sheet.getRange(targetRow, COL_M.BASE + 1).setValue(base);
    if (estado_registro !== undefined) {
      sheet.getRange(targetRow, COL_M.ESTADO_REGISTRO + 1).setValue(estado_registro);
      styleStatusCell(sheet, targetRow, estado_registro);
    }
    if (canal_registro !== undefined) sheet.getRange(targetRow, COL_M.CANAL_REGISTRO + 1).setValue(canal_registro);
    
    return jsonResponse({ success: true, message: 'Militante actualizado correctamente', rowIndex: targetRow });
  } catch(err) {
    return jsonResponse({ success: false, error: 'Error al actualizar militante: ' + err.toString() });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function handleApproveMilitante(payload) {
  return handleUpdateMilitante({
    ...payload,
    estado_registro: 'completado',
    canal_registro: payload.canal_registro || 'aprobado_admin'
  });
}

function handleRejectMilitante(payload) {
  return handleUpdateMilitante({
    ...payload,
    estado_registro: 'rechazado',
    canal_registro: payload.canal_registro || 'rechazado_admin'
  });
}

function handleAddMilitante(payload) {
  const lock = LockService.getScriptLock();
  try {
    // Bloqueo atómico: espera hasta 15 segundos para exclusión mutua
    lock.waitLock(15000);

    const { telefono, nombres, apellidos, dni, base, estado_registro, canal_registro } = payload;
    if (!telefono) return jsonResponse({ success: false, error: 'Teléfono requerido' });
    
    const sheet = getSheet(SHEET_MILITANTES);
    if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña de Militantes' });
    
    // Re-leer datos DENTRO del lock para tener el estado más reciente
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      let phoneInSheet = data[i][COL_M.ID_WHATSAPP];
      if (String(phoneInSheet).includes('#ERROR')) {
        phoneInSheet = checkAndRepairPhoneCell(sheet, i + 1, phoneInSheet);
      }
      if (isPhoneMatch(phoneInSheet, telefono)) {
        return jsonResponse({ success: false, error: 'El teléfono ya está registrado' });
      }
    }
    
    if (dni) {
      const cleanDni = String(dni).replace(/\D/g, '').trim();
      if (cleanDni.length >= 8) {
        for (let i = 1; i < data.length; i++) {
          const rowDni = String(data[i][COL_M.DNI] || '').replace(/\D/g, '').trim();
          if (rowDni && rowDni === cleanDni) {
            return jsonResponse({ 
              success: false, 
              error: 'El DNI ya se encuentra registrado en el padrón. No se permite duplicar registros.' 
            });
          }
        }
      }
    }
    
    const finalStatus = estado_registro || 'pendiente';
    const cleanPhone = String(telefono).replace(/^'+/, '').trim();
    const safePhone = cleanPhone.startsWith('+') ? "'" + cleanPhone : cleanPhone;
    const cleanDni = dni ? String(dni).replace(/\D/g, '').trim() : '';
    const safeDni = cleanDni ? "'" + cleanDni : '';
    
    const newRow = [
      safePhone,
      nombres || '',
      apellidos || '',
      safeDni,
      base || '',
      finalStatus,
      canal_registro || ''
    ];
    
    sheet.appendRow(newRow);
    const newRowIndex = sheet.getLastRow();
    
    sheet.getRange(newRowIndex, COL_M.ID_WHATSAPP + 1).setNumberFormat('@');
    if (dni) {
      sheet.getRange(newRowIndex, COL_M.DNI + 1).setNumberFormat('@');
    }
    
    styleStatusCell(sheet, newRowIndex, finalStatus);
    
    return jsonResponse({ 
      success: true, 
      message: 'Militante agregado correctamente',
      rowIndex: newRowIndex
    });
  } catch(err) {
    return jsonResponse({ success: false, error: 'Error al agregar militante: ' + err.toString() });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function handleDeleteMilitante(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const { rowIndex, telefono } = payload;
    const sheet = getSheet(SHEET_MILITANTES);
    if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña de Militantes' });
    
    let targetRow = rowIndex;
    
    // Si no hay rowIndex, o para verificar, buscar por teléfono
    if (!targetRow && telefono) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        let phoneInSheet = data[i][COL_M.ID_WHATSAPP];
        if (String(phoneInSheet).includes('#ERROR')) {
          phoneInSheet = checkAndRepairPhoneCell(sheet, i + 1, phoneInSheet);
        }
        if (isPhoneMatch(phoneInSheet, telefono)) {
          targetRow = i + 1;
          break;
        }
      }
    }
    
    if (!targetRow || targetRow <= 1) {
      return jsonResponse({ success: false, error: 'Militante no encontrado para eliminar' });
    }
    
    sheet.deleteRow(targetRow);
    return jsonResponse({ 
      success: true, 
      message: 'Militante eliminado correctamente de la base de datos' 
    });
  } catch(err) {
    return jsonResponse({ success: false, error: 'Error al eliminar militante: ' + err.toString() });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// ============ USUARIOS ============

function handleGetUsuarios() {
  const sheet = getSheet(SHEET_USUARIOS);
  if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña de Usuarios' });
  
  const data = sheet.getDataRange().getValues();
  const usuarios = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[COL_U.USUARIO]) continue;
    
    usuarios.push({
      rowIndex: i + 1,
      id: String(row[COL_U.ID] || i).trim(),
      usuario: String(row[COL_U.USUARIO] || '').trim(),
      rol: String(row[COL_U.ROL] || '').trim().toLowerCase(),
      nombres: String(row[COL_U.NOMBRES] || '').trim(),
      apellidos: String(row[COL_U.APELLIDOS] || '').trim(),
      cargo: String(row[COL_U.CARGO] || '').trim()
    });
  }
  
  return jsonResponse({ success: true, data: usuarios });
}

function handleFindUsuario(username) {
  if (!username) return jsonResponse({ success: false, error: 'Username requerido' });
  
  const sheet = getSheet(SHEET_USUARIOS);
  if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña de Usuarios' });
  
  const data = sheet.getDataRange().getValues();
  const search = String(username).trim().toLowerCase();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[COL_U.USUARIO]).trim().toLowerCase() === search) {
      return jsonResponse({
        success: true,
        found: true,
        data: {
          rowIndex: i + 1,
          id: String(row[COL_U.ID] || i).trim(),
          usuario: String(row[COL_U.USUARIO]).trim(),
          contrasena: String(row[COL_U.CONTRASENA]).trim(),
          rol: String(row[COL_U.ROL] || '').trim().toLowerCase(),
          nombres: String(row[COL_U.NOMBRES] || '').trim(),
          apellidos: String(row[COL_U.APELLIDOS] || '').trim(),
          cargo: String(row[COL_U.CARGO] || '').trim()
        }
      });
    }
  }
  
  return jsonResponse({ success: true, found: false });
}

function handleAddUsuario(payload) {
  const { usuario, contrasena, rol, nombres, apellidos, cargo } = payload;
  if (!usuario || !contrasena || !rol) return jsonResponse({ success: false, error: 'Usuario, contraseña y rol son requeridos' });
  
  const sheet = getSheet(SHEET_USUARIOS);
  if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña de Usuarios' });
  
  const data = sheet.getDataRange().getValues();
  const search = String(usuario).trim().toLowerCase();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL_U.USUARIO]).trim().toLowerCase() === search) {
      return jsonResponse({ success: false, error: 'El usuario ya existe' });
    }
  }
  
  const newId = data.length > 1 ? data.length : 1;
  const newRow = [
    newId,
    usuario,
    contrasena,
    rol,
    nombres || '',
    apellidos || '',
    cargo || ''
  ];
  sheet.appendRow(newRow);
  
  return jsonResponse({ success: true, message: 'Usuario creado correctamente' });
}

function handleDeleteUsuario(payload) {
  const { rowIndex } = payload;
  if (!rowIndex || rowIndex <= 1) return jsonResponse({ success: false, error: 'Índice de fila inválido' });
  
  const sheet = getSheet(SHEET_USUARIOS);
  if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña de Usuarios' });
  
  sheet.deleteRow(rowIndex);
  return jsonResponse({ success: true, message: 'Usuario eliminado correctamente' });
}

// ============ EVENTOS Y ASISTENCIA (v2.3) ============

/**
 * Obtiene todos los eventos con el conteo de asistentes acumulado.
 */
function handleGetEventos() {
  const sheetEventos = getSheet(SHEET_EVENTOS);
  if (!sheetEventos) return jsonResponse({ success: false, error: 'No se encontró la pestaña Eventos' });
  
  const dataEv = sheetEventos.getDataRange().getValues();
  const sheetAsist = getSheet(SHEET_ASISTENCIA);
  const dataAs = sheetAsist ? sheetAsist.getDataRange().getValues() : [];
  
  // Mapa de conteo de asistencia por id_evento
  const attendanceCounts = {};
  for (let j = 1; j < dataAs.length; j++) {
    const evId = String(dataAs[j][COL_AS.ID_EVENTO] || '').trim();
    if (evId) {
      attendanceCounts[evId] = (attendanceCounts[evId] || 0) + 1;
    }
  }
  
  const eventos = [];
  for (let i = 1; i < dataEv.length; i++) {
    const row = dataEv[i];
    const id = String(row[COL_EV.ID_EVENTO] || '').trim();
    if (!id) continue;
    
    eventos.push({
      rowIndex: i + 1,
      id_evento: id,
      titulo: String(row[COL_EV.TITULO] || '').trim(),
      fecha: cleanSheetDate(row[COL_EV.FECHA]),
      hora: cleanSheetTime(row[COL_EV.HORA]),
      lugar: String(row[COL_EV.LUGAR] || '').trim(),
      estado: String(row[COL_EV.ESTADO] || 'activo').trim().toLowerCase(),
      creado_en: cleanSheetDateTime(row[COL_EV.CREADO_EN]),
      total_asistentes: attendanceCounts[id] || 0
    });
  }
  
  // Invertir para mostrar los más recientes primero
  eventos.reverse();
  
  return jsonResponse({ success: true, data: eventos, total: eventos.length });
}

/**
 * Obtiene un evento individual por su ID.
 */
function handleGetEventoById(id_evento) {
  if (!id_evento) return jsonResponse({ success: false, error: 'ID de evento requerido' });
  
  const sheetEventos = getSheet(SHEET_EVENTOS);
  if (!sheetEventos) return jsonResponse({ success: false, error: 'No se encontró la pestaña Eventos' });
  
  const data = sheetEventos.getDataRange().getValues();
  const searchId = String(id_evento).trim();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[COL_EV.ID_EVENTO] || '').trim() === searchId) {
      // Contar asistentes para este evento
      const sheetAsist = getSheet(SHEET_ASISTENCIA);
      let totalAsistentes = 0;
      if (sheetAsist) {
        const dataAs = sheetAsist.getDataRange().getValues();
        for (let j = 1; j < dataAs.length; j++) {
          if (String(dataAs[j][COL_AS.ID_EVENTO] || '').trim() === searchId) {
            totalAsistentes++;
          }
        }
      }
      
      return jsonResponse({
        success: true,
        data: {
          rowIndex: i + 1,
          id_evento: searchId,
          titulo: String(row[COL_EV.TITULO] || '').trim(),
          fecha: cleanSheetDate(row[COL_EV.FECHA]),
          hora: cleanSheetTime(row[COL_EV.HORA]),
          lugar: String(row[COL_EV.LUGAR] || '').trim(),
          estado: String(row[COL_EV.ESTADO] || 'activo').trim().toLowerCase(),
          creado_en: cleanSheetDateTime(row[COL_EV.CREADO_EN]),
          total_asistentes: totalAsistentes
        }
      });
    }
  }
  
  return jsonResponse({ success: false, error: 'Evento no encontrado' });
}

/**
 * Crea un nuevo evento.
 */
function handleAddEvento(payload) {
  const { titulo, fecha, hora, lugar } = payload;
  if (!titulo || !fecha) {
    return jsonResponse({ success: false, error: 'Título y fecha son requeridos' });
  }
  
  const sheet = getSheet(SHEET_EVENTOS);
  if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña Eventos' });
  
  // Generar ID único amigable: EVT-[timestamp]
  const idEvento = 'EVT-' + new Date().getTime().toString(36).toUpperCase();
  const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Lima', 'yyyy-MM-dd HH:mm:ss');
  const cleanF = cleanSheetDate(fecha) || String(fecha).trim();
  const cleanH = cleanSheetTime(hora) || String(hora || '').trim();
  
  const newRow = [
    idEvento,
    String(titulo).trim(),
    "'" + cleanF,
    "'" + cleanH,
    String(lugar || '').trim(),
    'activo',
    "'" + nowStr
  ];
  
  sheet.appendRow(newRow);
  const newRowIndex = sheet.getLastRow();
  sheet.getRange(newRowIndex, COL_EV.FECHA + 1).setNumberFormat('@');
  sheet.getRange(newRowIndex, COL_EV.HORA + 1).setNumberFormat('@');
  sheet.getRange(newRowIndex, COL_EV.CREADO_EN + 1).setNumberFormat('@');
  
  return jsonResponse({
    success: true,
    message: 'Evento creado exitosamente',
    data: {
      rowIndex: newRowIndex,
      id_evento: idEvento,
      titulo: titulo,
      fecha: cleanF,
      hora: cleanH,
      lugar: lugar,
      estado: 'activo'
    }
  });
}

/**
 * Actualiza el estado o datos de un evento.
 */
function handleUpdateEvento(payload) {
  const { id_evento, rowIndex, estado, titulo, fecha, hora, lugar } = payload;
  const sheet = getSheet(SHEET_EVENTOS);
  if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña Eventos' });
  
  let targetRow = rowIndex;
  if (!targetRow && id_evento) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][COL_EV.ID_EVENTO] || '').trim() === String(id_evento).trim()) {
        targetRow = i + 1;
        break;
      }
    }
  }
  
  if (!targetRow) return jsonResponse({ success: false, error: 'Evento no encontrado' });
  
  if (estado !== undefined) sheet.getRange(targetRow, COL_EV.ESTADO + 1).setValue(String(estado).toLowerCase().trim());
  if (titulo !== undefined) sheet.getRange(targetRow, COL_EV.TITULO + 1).setValue(String(titulo).trim());
  if (fecha !== undefined) sheet.getRange(targetRow, COL_EV.FECHA + 1).setValue(String(fecha).trim());
  if (hora !== undefined) sheet.getRange(targetRow, COL_EV.HORA + 1).setValue(String(hora).trim());
  if (lugar !== undefined) sheet.getRange(targetRow, COL_EV.LUGAR + 1).setValue(String(lugar).trim());
  
  return jsonResponse({ success: true, message: 'Evento actualizado correctamente' });
}

/**
 * Obtiene la lista de asistentes a un evento (o de todos los eventos si no se pasa ID).
 */
function handleGetAsistencia(id_evento) {
  const sheetAsist = getSheet(SHEET_ASISTENCIA);
  if (!sheetAsist) return jsonResponse({ success: false, error: 'No se encontró la pestaña Asistencia' });
  
  const data = sheetAsist.getDataRange().getValues();
  const searchEvId = id_evento ? String(id_evento).trim() : null;
  const asistentes = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const evId = String(row[COL_AS.ID_EVENTO] || '').trim();
    if (!evId) continue;
    
    if (!searchEvId || evId === searchEvId) {
      asistentes.push({
        rowIndex: i + 1,
        id_asistencia: String(row[COL_AS.ID_ASISTENCIA] || '').trim(),
        id_evento: evId,
        titulo_evento: String(row[COL_AS.TITULO_EVENTO] || '').trim(),
        dni: String(row[COL_AS.DNI] || '').replace(/\D/g, '').trim(),
        nombres: String(row[COL_AS.NOMBRES] || '').trim(),
        apellidos: String(row[COL_AS.APELLIDOS] || '').trim(),
        base: String(row[COL_AS.BASE] || '').trim(),
        telefono: String(row[COL_AS.TELEFONO] || '').trim(),
        fecha_hora: cleanSheetDateTime(row[COL_AS.FECHA_HORA]),
        metodo: String(row[COL_AS.METODO] || 'manual').trim()
      });
    }
  }
  
  // Mostrar los más recientes primero
  asistentes.reverse();
  
  return jsonResponse({ success: true, data: asistentes, total: asistentes.length });
}

/**
 * Verifica si un DNI ya asistió a un evento.
 */
function handleCheckAsistencia(id_evento, dni) {
  if (!id_evento || !dni) {
    return jsonResponse({ success: false, error: 'id_evento y dni son requeridos' });
  }
  
  const cleanDni = String(dni).replace(/\D/g, '').trim();
  const sheetAsist = getSheet(SHEET_ASISTENCIA);
  if (!sheetAsist) return jsonResponse({ success: false, error: 'No se encontró la pestaña Asistencia' });
  
  const data = sheetAsist.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const evId = String(row[COL_AS.ID_EVENTO] || '').trim();
    const rowDni = String(row[COL_AS.DNI] || '').replace(/\D/g, '').trim();
    
    if (evId === String(id_evento).trim() && rowDni === cleanDni) {
      return jsonResponse({
        success: true,
        alreadyMarked: true,
        data: {
          id_asistencia: String(row[COL_AS.ID_ASISTENCIA] || '').trim(),
          dni: rowDni,
          nombres: String(row[COL_AS.NOMBRES] || '').trim(),
          apellidos: String(row[COL_AS.APELLIDOS] || '').trim(),
          fecha_hora: cleanSheetDateTime(row[COL_AS.FECHA_HORA]),
          metodo: String(row[COL_AS.METODO] || '').trim()
        }
      });
    }
  }
  
  return jsonResponse({ success: true, alreadyMarked: false });
}

/**
 * Registra la asistencia de un militante (Modalidades 1, 2 y 3).
 * Valida que el evento exista y esté activo, que el DNI figure en el padrón,
 * y que no se duplique la asistencia.
 */
function handleMarcarAsistencia(payload) {
  const lock = LockService.getScriptLock();
  try {
    // Bloqueo de concurrencia atómico: espera hasta 20 segundos para exclusión mutua
    lock.waitLock(20000);

    const { id_evento, dni, metodo } = payload;
    
    if (!id_evento || !dni) {
      return jsonResponse({ success: false, error: 'id_evento y DNI son requeridos' });
    }
    
    const cleanDni = String(dni).replace(/\D/g, '').trim();
    if (cleanDni.length < 8) {
      return jsonResponse({ success: false, error: 'El DNI debe tener al menos 8 dígitos' });
    }
    
    // 1. Verificar Evento
    const sheetEventos = getSheet(SHEET_EVENTOS);
    if (!sheetEventos) return jsonResponse({ success: false, error: 'No se encontró la pestaña Eventos' });
    
    const dataEv = sheetEventos.getDataRange().getValues();
    let eventoEncontrado = null;
    
    for (let i = 1; i < dataEv.length; i++) {
      const row = dataEv[i];
      if (String(row[COL_EV.ID_EVENTO] || '').trim() === String(id_evento).trim()) {
        eventoEncontrado = {
          id_evento: String(row[COL_EV.ID_EVENTO] || '').trim(),
          titulo: String(row[COL_EV.TITULO] || '').trim(),
          estado: String(row[COL_EV.ESTADO] || 'activo').trim().toLowerCase()
        };
        break;
      }
    }
    
    if (!eventoEncontrado) {
      return jsonResponse({ success: false, error: 'El evento especificado no existe' });
    }
    
    if (eventoEncontrado.estado === 'finalizado') {
      return jsonResponse({ success: false, error: 'Este evento ya ha finalizado. No se reciben más registros.' });
    }
    
    // 2. Buscar Militante en Padrón Oficial
    const sheetMilitantes = getSheet(SHEET_MILITANTES);
    if (!sheetMilitantes) return jsonResponse({ success: false, error: 'No se encontró la pestaña Base_Militantes' });
    
    const dataM = sheetMilitantes.getDataRange().getValues();
    let militante = null;
    
    for (let i = 1; i < dataM.length; i++) {
      const row = dataM[i];
      const rowDni = String(row[COL_M.DNI] || '').replace(/\D/g, '').trim();
      if (rowDni && rowDni === cleanDni) {
        let phone = String(row[COL_M.ID_WHATSAPP] || '');
        if (phone.includes('#ERROR')) {
          phone = checkAndRepairPhoneCell(sheetMilitantes, i + 1, phone);
        }
        
        militante = {
          dni: rowDni,
          nombres: String(row[COL_M.NOMBRES] || '').trim(),
          apellidos: String(row[COL_M.APELLIDOS] || '').trim(),
          base: String(row[COL_M.BASE] || '').trim(),
          id_whatsapp: phone.trim(),
          estado_registro: String(row[COL_M.ESTADO_REGISTRO] || '').trim().toLowerCase()
        };
        break;
      }
    }
    
    if (!militante) {
      return jsonResponse({
        success: false,
        notFound: true,
        error: 'El DNI ' + cleanDni + ' no figura registrado en el padrón oficial de Fuerza Tacna.'
      });
    }
    
    // 3. Verificar si ya marcó asistencia en este evento (atómico con Lock)
    const sheetAsist = getSheet(SHEET_ASISTENCIA);
    if (!sheetAsist) return jsonResponse({ success: false, error: 'No se encontró la pestaña Asistencia' });
    
    const dataAs = sheetAsist.getDataRange().getValues();
    for (let i = 1; i < dataAs.length; i++) {
      const row = dataAs[i];
      const evId = String(row[COL_AS.ID_EVENTO] || '').trim();
      const rowDni = String(row[COL_AS.DNI] || '').replace(/\D/g, '').trim();
      
      if (evId === String(id_evento).trim() && rowDni === cleanDni) {
        const horaPrevia = String(row[COL_AS.FECHA_HORA] || '').trim();
        return jsonResponse({
          success: false,
          alreadyMarked: true,
          message: `La asistencia de ${militante.nombres} ya fue registrada previamente a las ${horaPrevia}.`,
          data: {
            dni: cleanDni,
            nombres: militante.nombres,
            apellidos: militante.apellidos,
            fecha_hora: horaPrevia
          }
        });
      }
    }
    
    // 4. Registrar Asistencia
    const idAsistencia = 'ASIST-' + new Date().getTime().toString(36).toUpperCase();
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Lima', 'yyyy-MM-dd HH:mm:ss');
    const safeMetodo = metodo || 'manual';
    
    const safePhone = militante.id_whatsapp.startsWith('+') ? "'" + militante.id_whatsapp : militante.id_whatsapp;
    
    const newRow = [
      idAsistencia,
      eventoEncontrado.id_evento,
      eventoEncontrado.titulo,
      "'" + cleanDni,
      militante.nombres,
      militante.apellidos,
      militante.base,
      safePhone,
      "'" + nowStr,
      safeMetodo
    ];
    
    sheetAsist.appendRow(newRow);
    const newRowIndex = sheetAsist.getLastRow();
    
    // Formatear texto en DNI, teléfono y fecha_hora para evitar #ERROR! y fechas crudas
    sheetAsist.getRange(newRowIndex, COL_AS.DNI + 1).setNumberFormat('@');
    sheetAsist.getRange(newRowIndex, COL_AS.TELEFONO + 1).setNumberFormat('@');
    sheetAsist.getRange(newRowIndex, COL_AS.FECHA_HORA + 1).setNumberFormat('@');
    
    return jsonResponse({
      success: true,
      message: `¡Asistencia registrada con éxito! Bienvenido(a) ${militante.nombres}`,
      data: {
        id_asistencia: idAsistencia,
        id_evento: eventoEncontrado.id_evento,
        titulo_evento: eventoEncontrado.titulo,
        dni: cleanDni,
        nombres: militante.nombres,
        apellidos: militante.apellidos,
        base: militante.base,
        fecha_hora: nowStr,
        metodo: safeMetodo
      }
    });
  } catch(err) {
    return jsonResponse({ success: false, error: 'Error al registrar asistencia: ' + err.toString() });
  } finally {
    try {
      lock.releaseLock();
    } catch(e) {}
  }
}
