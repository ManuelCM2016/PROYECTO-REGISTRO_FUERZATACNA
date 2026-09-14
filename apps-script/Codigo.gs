/**
 * =====================================================
 * BD_FUERZATACNA_REGISTRO - Google Apps Script (v3.0)
 * =====================================================
 * Este código debe copiarse en el editor de Apps Script
 * vinculado a la hoja de cálculo BD_BASE_FUERZA_TACNA.
 * 
 * Novedades v3.0:
 * - Sistema completo de Apoyada / Pollada:
 *   * Registro de apoyadas (CRUD con pestañas Polladas y Tickets_Pollada).
 *   * Registro de compras de tickets por coordinadores de base.
 *   * Verificación digital en puerta (reemplaza sello físico).
 *   * Registro de entrega en cocina con validación secuencial.
 *   * Prevención de fraude: doble verificación, doble entrega.
 *   * Estadísticas en tiempo real: vendidos, recaudado, entregados.
 * - Helpers de fecha/hora: cleanSheetDate, cleanSheetTime, cleanSheetDateTime.
 * - Pestañas auto-creadas: Polladas y Tickets_Pollada.
 * 
 * Novedades v2.3:
 * - Soporte integral para Gestión de Eventos y Reuniones (Pestaña 'Eventos').
 * - Control de Asistencia Multimodal (Pestaña 'Asistencia').
 * - Auto-creación automática de pestañas 'Eventos' y 'Asistencia' con cabeceras.
 * - Prevención estricta de duplicados de asistencia por evento y DNI.
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
const SHEET_POLLADAS = 'Polladas';
const SHEET_TICKETS_POLLADA = 'Tickets_Pollada';

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

// Columnas Polladas (0-indexed)
const COL_PO = {
  ID_POLLADA: 0,          // A
  TITULO: 1,              // B
  FECHA: 2,               // C
  HORA: 3,                // D
  LUGAR: 4,               // E
  PRECIO_TICKET: 5,       // F
  MIN_TICKETS: 6,         // G
  ESTADO: 7,              // H (activo|venta|recojo|finalizado)
  CREADO_EN: 8            // I
};

// Columnas Tickets_Pollada (0-indexed)
const COL_TK = {
  ID_COMPRA: 0,           // A
  ID_POLLADA: 1,          // B
  TITULO_POLLADA: 2,      // C
  DNI: 3,                 // D
  NOMBRES: 4,             // E
  APELLIDOS: 5,           // F
  BASE: 6,                // G
  CANTIDAD_TICKETS: 7,    // H
  NUM_TICKET_INICIO: 8,   // I
  NUM_TICKET_FIN: 9,      // J
  MONTO_PAGADO: 10,       // K
  ESTADO: 11,             // L (comprado|verificado|entregado|cancelado)
  REGISTRADO_POR: 12,     // M
  FECHA_COMPRA: 13,       // N
  FECHA_VERIFICACION: 14, // O
  FECHA_ENTREGA: 15       // P
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

  if (cleanTarget.includes('pollada') && !cleanTarget.includes('ticket')) {
    const newSheet = ss.insertSheet('Polladas');
    newSheet.appendRow(['ID_POLLADA', 'TITULO', 'FECHA', 'HORA', 'LUGAR', 'PRECIO_TICKET', 'MIN_TICKETS', 'ESTADO', 'CREADO_EN']);
    return newSheet;
  }

  if (cleanTarget.includes('ticket') && cleanTarget.includes('pollada')) {
    const newSheet = ss.insertSheet('Tickets_Pollada');
    newSheet.appendRow(['ID_COMPRA', 'ID_POLLADA', 'TITULO_POLLADA', 'DNI', 'NOMBRES', 'APELLIDOS', 'BASE', 'CANTIDAD_TICKETS', 'NUM_TICKET_INICIO', 'NUM_TICKET_FIN', 'MONTO_PAGADO', 'ESTADO', 'REGISTRADO_POR', 'FECHA_COMPRA', 'FECHA_VERIFICACION', 'FECHA_ENTREGA']);
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
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action;
    
    if (!action) {
      return jsonResponse({ 
        success: true, 
        message: 'API activa de Fuerza Tacna v2.3', 
        timestamp: new Date().toISOString() 
      });
    }
    
    switch(action) {
      case 'ping':
        return jsonResponse({ 
          success: true, 
          message: 'API activa de Fuerza Tacna v2.3', 
          timestamp: new Date().toISOString() 
        });
      
      // Militantes
      case 'getMilitantes':
        return handleGetMilitantes(params);
      case 'findByPhone':
        return handleFindByPhone(params.telefono);
      case 'checkDni':
        return handleCheckDni(params.dni);
      case 'searchMilitantes':
        return handleSearchMilitantes(params.q);
      case 'getStats':
        return handleGetStats();
      case 'repairErrors':
        return handleRepairAllErrors();
      
      // Usuarios
      case 'getUsuarios':
        return handleGetUsuarios();
      case 'findUsuario':
        return handleFindUsuario(params.username);
      
      // Eventos y Asistencia (v2.3)
      case 'getEventos':
        return handleGetEventos();
      case 'getEventoById':
        return handleGetEventoById(params.id_evento);
      case 'getAsistencia':
        return handleGetAsistencia(params.id_evento);
      case 'checkAsistencia':
        return handleCheckAsistencia(params.id_evento, params.dni);
      case 'marcarAsistencia':
        if (params.id_evento && params.dni) {
          return handleMarcarAsistencia({
            id_evento: params.id_evento,
            dni: params.dni,
            metodo: params.metodo || 'qr_puerta'
          });
        }
        return jsonResponse({ success: false, error: 'id_evento y dni requeridos para marcar asistencia' });
      
      // Apoyada / Pollada (v3.0)
      case 'getPolladas':
        return handleGetPolladas();
      case 'getPolladaById':
        return handleGetPolladaById(params.id_pollada);
      case 'getTicketsPollada':
        return handleGetTicketsPollada(params.id_pollada);
      case 'checkTicketPollada':
        return handleCheckTicketPollada(params.id_pollada, params.dni);
      
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
      case 'deleteEvento':
        return handleDeleteEvento(payload);
      case 'marcarAsistencia':
        return handleMarcarAsistencia(payload);
      
      // Apoyada / Pollada (v3.0)
      case 'addPollada':
        return handleAddPollada(payload);
      case 'updatePollada':
        return handleUpdatePollada(payload);
      case 'deletePollada':
        return handleDeletePollada(payload);
      case 'registrarCompra':
        return handleRegistrarCompra(payload);
      case 'verificarTicket':
        return handleVerificarTicket(payload);
      case 'registrarEntrega':
        return handleRegistrarEntrega(payload);
      case 'cancelarCompra':
        return handleCancelarCompra(payload);
      
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

// ============ HELPERS DE FECHA/HORA ============

/**
 * Limpia y normaliza una fecha proveniente de Google Sheets a formato "YYYY-MM-DD".
 */
function cleanSheetDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    var y = value.getFullYear();
    if (y < 1970) return '';
    return y + '-' + String(value.getMonth()+1).padStart(2,'0') + '-' + String(value.getDate()).padStart(2,'0');
  }
  var str = String(value).trim();
  var ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return ymd[1]+'-'+ymd[2]+'-'+ymd[3];
  var dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return dmy[3]+'-'+dmy[2].padStart(2,'0')+'-'+dmy[1].padStart(2,'0');
  try {
    var dt = new Date(str);
    if (!isNaN(dt.getTime()) && dt.getFullYear() > 1970) {
      return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
    }
  } catch(e) {}
  return str;
}

/**
 * Limpia y normaliza una hora proveniente de Google Sheets a "HH:mm".
 */
function cleanSheetTime(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return String(value.getHours()).padStart(2,'0')+':'+String(value.getMinutes()).padStart(2,'0');
  }
  var str = String(value).trim();
  var m = str.match(/(\d{1,2}):(\d{2})/);
  if (m) return m[1].padStart(2,'0')+':'+m[2];
  return '';
}

/**
 * Limpia y normaliza un datetime proveniente de Google Sheets a "YYYY-MM-DD HH:mm:ss".
 */
function cleanSheetDateTime(value) {
  if (!value) return '';
  var str = String(value).trim();
  if (str.charAt(0) === "'") str = str.slice(1);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(str)) return str;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    try {
      return Utilities.formatDate(value, Session.getScriptTimeZone() || 'America/Lima', 'yyyy-MM-dd HH:mm:ss');
    } catch(e) { return str; }
  }
  return str;
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
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const { id_evento, rowIndex, estado, titulo, fecha, hora, lugar } = payload;
    const sheet = getSheet(SHEET_EVENTOS);
    if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña Eventos' });
    
    let targetRow = rowIndex;
    let eventId = id_evento;

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
    
    // Si se actualizó el título, actualizar también el título en las filas de Asistencia asociadas
    if (titulo !== undefined && eventId) {
      const sheetAsist = getSheet(SHEET_ASISTENCIA);
      if (sheetAsist && sheetAsist.getLastRow() > 1) {
        const dataAsist = sheetAsist.getDataRange().getValues();
        for (let j = 1; j < dataAsist.length; j++) {
          if (String(dataAsist[j][COL_AS.ID_EVENTO] || '').trim() === String(eventId).trim()) {
            sheetAsist.getRange(j + 1, COL_AS.TITULO_EVENTO + 1).setValue(String(titulo).trim());
          }
        }
      }
    }

    return jsonResponse({ success: true, message: 'Evento actualizado correctamente' });
  } catch(err) {
    return jsonResponse({ success: false, error: 'Error al actualizar evento: ' + err.toString() });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

/**
 * Elimina un evento y todas sus asistencias asociadas de la base de datos.
 */
function handleDeleteEvento(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const { id_evento, rowIndex } = payload;
    const sheetEventos = getSheet(SHEET_EVENTOS);
    if (!sheetEventos) return jsonResponse({ success: false, error: 'No se encontró la pestaña Eventos' });
    
    let targetRow = rowIndex;
    let eventId = id_evento;

    const dataEv = sheetEventos.getDataRange().getValues();
    if (!targetRow && id_evento) {
      for (let i = 1; i < dataEv.length; i++) {
        if (String(dataEv[i][COL_EV.ID_EVENTO] || '').trim() === String(id_evento).trim()) {
          targetRow = i + 1;
          break;
        }
      }
    } else if (targetRow && !eventId) {
      if (targetRow <= dataEv.length) {
        eventId = String(dataEv[targetRow - 1][COL_EV.ID_EVENTO] || '').trim();
      }
    }

    if (!targetRow || targetRow > sheetEventos.getLastRow()) {
      return jsonResponse({ success: false, error: 'Evento no encontrado' });
    }

    // 1. Eliminar la fila del evento en la hoja Eventos
    sheetEventos.deleteRow(targetRow);

    // 2. Eliminar todas las asistencias asociadas a este evento en la hoja Asistencia
    let asistenciasEliminadas = 0;
    if (eventId) {
      const sheetAsist = getSheet(SHEET_ASISTENCIA);
      if (sheetAsist && sheetAsist.getLastRow() > 1) {
        const dataAsist = sheetAsist.getDataRange().getValues();
        // Recorrer de abajo hacia arriba para que los índices no se desfasen
        for (let j = dataAsist.length - 1; j >= 1; j--) {
          const rowEvId = String(dataAsist[j][COL_AS.ID_EVENTO] || '').trim();
          if (rowEvId === String(eventId).trim()) {
            sheetAsist.deleteRow(j + 1);
            asistenciasEliminadas++;
          }
        }
      }
    }

    return jsonResponse({
      success: true,
      message: 'Evento eliminado correctamente' + (asistenciasEliminadas > 0 ? ` junto a sus ${asistenciasEliminadas} registro(s) de asistencia.` : '.'),
      asistenciasEliminadas: asistenciasEliminadas
    });
  } catch(err) {
    return jsonResponse({ success: false, error: 'Error al eliminar evento: ' + err.toString() });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

/**
 * Obtiene la lista de asistentes a un evento (o de todos los eventos si no se pasa ID).
 */
function handleGetAsistencia(id_evento) {
  const sheetAsist = getSheet(SHEET_ASISTENCIA);
  if (!sheetAsist) return jsonResponse({ success: false, error: 'No se encontró la pestaña Asistencia' });
  
  // Mapa para cruzar el estado del militante desde Base_Militantes
  const sheetMilit = getSheet(SHEET_MILITANTES);
  const militMap = {};
  if (sheetMilit) {
    const dataM = sheetMilit.getDataRange().getValues();
    for (let m = 1; m < dataM.length; m++) {
      const d = String(dataM[m][COL_M.DNI] || '').replace(/\D/g, '').trim();
      if (d) {
        militMap[d] = {
          estado: String(dataM[m][COL_M.ESTADO_REGISTRO] || '').trim().toLowerCase(),
          base: String(dataM[m][COL_M.BASE] || '').trim()
        };
      }
    }
  }

  const data = sheetAsist.getDataRange().getValues();
  const searchEvId = id_evento ? String(id_evento).trim() : null;
  const asistentes = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const evId = String(row[COL_AS.ID_EVENTO] || '').trim();
    if (!evId) continue;
    
    if (!searchEvId || evId === searchEvId) {
      const rowDni = String(row[COL_AS.DNI] || '').replace(/\D/g, '').trim();
      const mInfo = militMap[rowDni] || null;
      const estadoMilit = mInfo && mInfo.estado ? mInfo.estado : 'en_revision';

      asistentes.push({
        rowIndex: i + 1,
        id_asistencia: String(row[COL_AS.ID_ASISTENCIA] || '').trim(),
        id_evento: evId,
        titulo_evento: String(row[COL_AS.TITULO_EVENTO] || '').trim(),
        dni: rowDni,
        nombres: String(row[COL_AS.NOMBRES] || '').trim(),
        apellidos: String(row[COL_AS.APELLIDOS] || '').trim(),
        base: String(row[COL_AS.BASE] || (mInfo ? mInfo.base : '')).trim(),
        telefono: String(row[COL_AS.TELEFONO] || '').trim(),
        fecha_hora: cleanSheetDateTime(row[COL_AS.FECHA_HORA]),
        metodo: String(row[COL_AS.METODO] || 'manual').trim(),
        estado_militante: estadoMilit
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
        metodo: safeMetodo,
        estado_militante: militante.estado_registro
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

// ============ APOYADA / POLLADA (v3.0) ============

/**
 * Lista todas las polladas/apoyadas registradas.
 */
function handleGetPolladas() {
  try {
    const sheet = getSheet(SHEET_POLLADAS);
    if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña Polladas' });

    const data = sheet.getDataRange().getValues();
    const polladas = [];

    // Obtener estadísticas de tickets para cada pollada
    const sheetTK = getSheet(SHEET_TICKETS_POLLADA);
    const tkData = sheetTK ? sheetTK.getDataRange().getValues() : [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const id = String(row[COL_PO.ID_POLLADA] || '').trim();
      if (!id) continue;

      // Calcular estadísticas
      let totalTickets = 0, totalRecaudado = 0, totalEntregados = 0;
      for (let j = 1; j < tkData.length; j++) {
        const tkRow = tkData[j];
        if (String(tkRow[COL_TK.ID_POLLADA] || '').trim() === id) {
          const estado = String(tkRow[COL_TK.ESTADO] || '').toLowerCase();
          if (estado !== 'cancelado') {
            const cant = parseInt(tkRow[COL_TK.CANTIDAD_TICKETS] || '0', 10);
            totalTickets += cant;
            totalRecaudado += parseFloat(tkRow[COL_TK.MONTO_PAGADO] || '0');
          }
          if (estado === 'entregado') {
            totalEntregados += parseInt(tkRow[COL_TK.CANTIDAD_TICKETS] || '0', 10);
          }
        }
      }

      polladas.push({
        rowIndex: i + 1,
        id_pollada: id,
        titulo: String(row[COL_PO.TITULO] || '').trim(),
        fecha: String(row[COL_PO.FECHA] || '').trim(),
        hora: String(row[COL_PO.HORA] || '').trim(),
        lugar: String(row[COL_PO.LUGAR] || '').trim(),
        precio_ticket: parseFloat(row[COL_PO.PRECIO_TICKET] || '16'),
        min_tickets: parseInt(row[COL_PO.MIN_TICKETS] || '2', 10),
        estado: String(row[COL_PO.ESTADO] || 'activo').trim().toLowerCase(),
        creado_en: cleanSheetDateTime(row[COL_PO.CREADO_EN]),
        total_tickets_vendidos: totalTickets,
        total_recaudado: totalRecaudado,
        total_entregados: totalEntregados
      });
    }

    polladas.reverse();
    return jsonResponse({ success: true, data: polladas, total: polladas.length });
  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Obtiene una pollada por ID.
 */
function handleGetPolladaById(id_pollada) {
  try {
    if (!id_pollada) return jsonResponse({ success: false, error: 'id_pollada requerido' });
    const sheet = getSheet(SHEET_POLLADAS);
    if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña Polladas' });

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[COL_PO.ID_POLLADA] || '').trim() === String(id_pollada).trim()) {
        return jsonResponse({
          success: true,
          data: {
            rowIndex: i + 1,
            id_pollada: String(row[COL_PO.ID_POLLADA] || '').trim(),
            titulo: String(row[COL_PO.TITULO] || '').trim(),
            fecha: String(row[COL_PO.FECHA] || '').trim(),
            hora: String(row[COL_PO.HORA] || '').trim(),
            lugar: String(row[COL_PO.LUGAR] || '').trim(),
            precio_ticket: parseFloat(row[COL_PO.PRECIO_TICKET] || '16'),
            min_tickets: parseInt(row[COL_PO.MIN_TICKETS] || '2', 10),
            estado: String(row[COL_PO.ESTADO] || 'activo').trim().toLowerCase(),
            creado_en: cleanSheetDateTime(row[COL_PO.CREADO_EN])
          }
        });
      }
    }
    return jsonResponse({ success: false, error: 'Pollada no encontrada' });
  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Crea una nueva pollada/apoyada.
 */
function handleAddPollada(payload) {
  try {
    const { titulo, fecha, hora, lugar, precio_ticket, min_tickets } = payload;
    if (!titulo || !fecha) return jsonResponse({ success: false, error: 'Título y fecha son requeridos' });

    const sheet = getSheet(SHEET_POLLADAS);
    if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña Polladas' });

    const idPollada = 'APO-' + new Date().getTime().toString(36).toUpperCase();
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Lima', 'yyyy-MM-dd HH:mm:ss');
    const precioFinal = parseFloat(precio_ticket || '16') || 16;
    const minFinal = parseInt(min_tickets || '2', 10) || 2;

    const newRow = [
      idPollada,
      String(titulo).trim().toUpperCase(),
      String(fecha).trim(),
      String(hora || '').trim(),
      String(lugar || '').trim(),
      precioFinal,
      minFinal,
      'activo',
      "'" + nowStr
    ];

    sheet.appendRow(newRow);
    const newRowIndex = sheet.getLastRow();
    sheet.getRange(newRowIndex, COL_PO.CREADO_EN + 1).setNumberFormat('@');

    return jsonResponse({
      success: true,
      message: 'Apoyada creada exitosamente',
      data: {
        id_pollada: idPollada,
        titulo: titulo.trim().toUpperCase(),
        fecha,
        hora: hora || '',
        lugar: lugar || '',
        precio_ticket: precioFinal,
        min_tickets: minFinal,
        estado: 'activo',
        creado_en: nowStr,
        rowIndex: newRowIndex
      }
    });
  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Actualiza una pollada existente.
 */
function handleUpdatePollada(payload) {
  try {
    const { id_pollada, rowIndex, titulo, fecha, hora, lugar, precio_ticket, min_tickets, estado } = payload;
    if (!id_pollada) return jsonResponse({ success: false, error: 'id_pollada requerido' });

    const sheet = getSheet(SHEET_POLLADAS);
    if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña Polladas' });

    let targetRow = rowIndex;
    if (!targetRow) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][COL_PO.ID_POLLADA] || '').trim() === String(id_pollada).trim()) {
          targetRow = i + 1;
          break;
        }
      }
    }
    if (!targetRow) return jsonResponse({ success: false, error: 'Pollada no encontrada para actualizar' });

    const row = sheet.getRange(targetRow, 1, 1, 9).getValues()[0];
    if (titulo !== undefined) row[COL_PO.TITULO] = String(titulo).trim().toUpperCase();
    if (fecha !== undefined) row[COL_PO.FECHA] = String(fecha).trim();
    if (hora !== undefined) row[COL_PO.HORA] = String(hora).trim();
    if (lugar !== undefined) row[COL_PO.LUGAR] = String(lugar).trim();
    if (precio_ticket !== undefined) row[COL_PO.PRECIO_TICKET] = parseFloat(precio_ticket) || 16;
    if (min_tickets !== undefined) row[COL_PO.MIN_TICKETS] = parseInt(min_tickets, 10) || 2;
    if (estado !== undefined) row[COL_PO.ESTADO] = String(estado).toLowerCase().trim();

    sheet.getRange(targetRow, 1, 1, 9).setValues([row]);
    return jsonResponse({ success: true, message: 'Apoyada actualizada correctamente' });
  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Elimina una pollada y sus tickets asociados.
 */
function handleDeletePollada(payload) {
  try {
    const { id_pollada, rowIndex } = payload;
    if (!id_pollada) return jsonResponse({ success: false, error: 'id_pollada requerido' });

    const sheet = getSheet(SHEET_POLLADAS);
    if (!sheet) return jsonResponse({ success: false, error: 'No se encontró la pestaña Polladas' });

    let targetRow = rowIndex;
    if (!targetRow) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][COL_PO.ID_POLLADA] || '').trim() === String(id_pollada).trim()) {
          targetRow = i + 1;
          break;
        }
      }
    }
    if (!targetRow) return jsonResponse({ success: false, error: 'Pollada no encontrada' });

    sheet.deleteRow(targetRow);
    return jsonResponse({ success: true, message: 'Apoyada eliminada correctamente' });
  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Lista todos los tickets de una pollada.
 */
function handleGetTicketsPollada(id_pollada) {
  try {
    const sheet = getSheet(SHEET_TICKETS_POLLADA);
    if (!sheet) return jsonResponse({ success: true, data: [], total: 0 });

    const data = sheet.getDataRange().getValues();
    const tickets = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowIdPollada = String(row[COL_TK.ID_POLLADA] || '').trim();
      if (id_pollada && rowIdPollada !== String(id_pollada).trim()) continue;

      const id = String(row[COL_TK.ID_COMPRA] || '').trim();
      if (!id) continue;

      tickets.push({
        rowIndex: i + 1,
        id_compra: id,
        id_pollada: rowIdPollada,
        titulo_pollada: String(row[COL_TK.TITULO_POLLADA] || '').trim(),
        dni: String(row[COL_TK.DNI] || '').replace(/\D/g, '').trim(),
        nombres: String(row[COL_TK.NOMBRES] || '').trim(),
        apellidos: String(row[COL_TK.APELLIDOS] || '').trim(),
        base: String(row[COL_TK.BASE] || '').trim(),
        cantidad_tickets: parseInt(row[COL_TK.CANTIDAD_TICKETS] || '0', 10),
        num_ticket_inicio: String(row[COL_TK.NUM_TICKET_INICIO] || '').trim(),
        num_ticket_fin: String(row[COL_TK.NUM_TICKET_FIN] || '').trim(),
        monto_pagado: parseFloat(row[COL_TK.MONTO_PAGADO] || '0'),
        estado: String(row[COL_TK.ESTADO] || 'comprado').trim().toLowerCase(),
        registrado_por: String(row[COL_TK.REGISTRADO_POR] || '').trim(),
        fecha_compra: cleanSheetDateTime(row[COL_TK.FECHA_COMPRA]),
        fecha_verificacion: cleanSheetDateTime(row[COL_TK.FECHA_VERIFICACION]),
        fecha_entrega: cleanSheetDateTime(row[COL_TK.FECHA_ENTREGA])
      });
    }

    return jsonResponse({ success: true, data: tickets, total: tickets.length });
  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Verifica si un militante tiene tickets registrados en una pollada.
 */
function handleCheckTicketPollada(id_pollada, dni) {
  try {
    if (!id_pollada || !dni) return jsonResponse({ success: false, error: 'id_pollada y dni requeridos' });

    const cleanDni = String(dni).replace(/\D/g, '').trim();
    const sheet = getSheet(SHEET_TICKETS_POLLADA);
    if (!sheet) return jsonResponse({ success: true, found: false });

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowDni = String(row[COL_TK.DNI] || '').replace(/\D/g, '').trim();
      const rowIdPollada = String(row[COL_TK.ID_POLLADA] || '').trim();
      if (rowDni === cleanDni && rowIdPollada === String(id_pollada).trim()) {
        return jsonResponse({
          success: true,
          found: true,
          data: {
            rowIndex: i + 1,
            id_compra: String(row[COL_TK.ID_COMPRA] || '').trim(),
            dni: rowDni,
            nombres: String(row[COL_TK.NOMBRES] || '').trim(),
            apellidos: String(row[COL_TK.APELLIDOS] || '').trim(),
            base: String(row[COL_TK.BASE] || '').trim(),
            cantidad_tickets: parseInt(row[COL_TK.CANTIDAD_TICKETS] || '0', 10),
            num_ticket_inicio: String(row[COL_TK.NUM_TICKET_INICIO] || '').trim(),
            num_ticket_fin: String(row[COL_TK.NUM_TICKET_FIN] || '').trim(),
            monto_pagado: parseFloat(row[COL_TK.MONTO_PAGADO] || '0'),
            estado: String(row[COL_TK.ESTADO] || 'comprado').trim().toLowerCase(),
            fecha_compra: cleanSheetDateTime(row[COL_TK.FECHA_COMPRA]),
            fecha_verificacion: cleanSheetDateTime(row[COL_TK.FECHA_VERIFICACION]),
            fecha_entrega: cleanSheetDateTime(row[COL_TK.FECHA_ENTREGA])
          }
        });
      }
    }
    return jsonResponse({ success: true, found: false });
  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Registra la compra de tickets de una pollada por un militante.
 * El coordinador de base escanea la credencial y registra la compra.
 */
function handleRegistrarCompra(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const { id_pollada, dni, cantidad_tickets, num_ticket_inicio, num_ticket_fin, monto_pagado, registrado_por } = payload;

    if (!id_pollada || !dni || !cantidad_tickets) {
      return jsonResponse({ success: false, error: 'id_pollada, dni y cantidad_tickets son requeridos' });
    }

    const cleanDni = String(dni).replace(/\D/g, '').trim();
    if (cleanDni.length < 8) return jsonResponse({ success: false, error: 'El DNI debe tener al menos 8 dígitos' });

    const cantidadNum = parseInt(cantidad_tickets, 10);
    if (isNaN(cantidadNum) || cantidadNum < 1) return jsonResponse({ success: false, error: 'La cantidad de tickets debe ser al menos 1' });

    // Verificar que la pollada exista y esté activa para venta
    const sheetPO = getSheet(SHEET_POLLADAS);
    if (!sheetPO) return jsonResponse({ success: false, error: 'No se encontró la pestaña Polladas' });

    const dataPO = sheetPO.getDataRange().getValues();
    let pollada = null;
    for (let i = 1; i < dataPO.length; i++) {
      if (String(dataPO[i][COL_PO.ID_POLLADA] || '').trim() === String(id_pollada).trim()) {
        pollada = {
          id_pollada: String(dataPO[i][COL_PO.ID_POLLADA] || '').trim(),
          titulo: String(dataPO[i][COL_PO.TITULO] || '').trim(),
          precio_ticket: parseFloat(dataPO[i][COL_PO.PRECIO_TICKET] || '16'),
          min_tickets: parseInt(dataPO[i][COL_PO.MIN_TICKETS] || '2', 10),
          estado: String(dataPO[i][COL_PO.ESTADO] || '').trim().toLowerCase()
        };
        break;
      }
    }
    if (!pollada) return jsonResponse({ success: false, error: 'La apoyada especificada no existe' });
    if (pollada.estado === 'finalizado') return jsonResponse({ success: false, error: 'Esta apoyada ya finalizó y no acepta más registros' });
    if (pollada.estado === 'recojo') return jsonResponse({ success: false, error: 'Esta apoyada ya está en fase de recojo. No se pueden registrar más compras.' });

    if (cantidadNum < pollada.min_tickets) {
      return jsonResponse({ success: false, error: `El mínimo de tickets por militante es ${pollada.min_tickets}` });
    }

    // Verificar que el militante exista en el padrón
    const sheetM = getSheet(SHEET_MILITANTES);
    if (!sheetM) return jsonResponse({ success: false, error: 'No se encontró la pestaña Base_Militantes' });

    const dataM = sheetM.getDataRange().getValues();
    let militante = null;
    for (let i = 1; i < dataM.length; i++) {
      const rowDni = String(dataM[i][COL_M.DNI] || '').replace(/\D/g, '').trim();
      if (rowDni === cleanDni) {
        militante = {
          dni: rowDni,
          nombres: String(dataM[i][COL_M.NOMBRES] || '').trim(),
          apellidos: String(dataM[i][COL_M.APELLIDOS] || '').trim(),
          base: String(dataM[i][COL_M.BASE] || '').trim()
        };
        break;
      }
    }
    if (!militante) {
      return jsonResponse({ success: false, notFound: true, error: `El DNI ${cleanDni} no figura en el padrón oficial de Fuerza Tacna` });
    }

    // Verificar si ya tiene compra registrada para esta pollada
    const sheetTK = getSheet(SHEET_TICKETS_POLLADA);
    if (!sheetTK) return jsonResponse({ success: false, error: 'No se encontró la pestaña Tickets_Pollada' });

    const dataTK = sheetTK.getDataRange().getValues();
    for (let i = 1; i < dataTK.length; i++) {
      const rowDni = String(dataTK[i][COL_TK.DNI] || '').replace(/\D/g, '').trim();
      const rowPollada = String(dataTK[i][COL_TK.ID_POLLADA] || '').trim();
      const rowEstado = String(dataTK[i][COL_TK.ESTADO] || '').toLowerCase();
      if (rowDni === cleanDni && rowPollada === String(id_pollada).trim() && rowEstado !== 'cancelado') {
        return jsonResponse({
          success: false,
          alreadyRegistered: true,
          error: `${militante.nombres} ya tiene ${dataTK[i][COL_TK.CANTIDAD_TICKETS]} ticket(s) comprado(s) para esta apoyada`
        });
      }
    }

    // Registrar la compra
    const idCompra = 'TKT-' + new Date().getTime().toString(36).toUpperCase();
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Lima', 'yyyy-MM-dd HH:mm:ss');
    const montoFinal = monto_pagado !== undefined ? parseFloat(monto_pagado) : (cantidadNum * pollada.precio_ticket);

    const newRow = [
      idCompra,
      pollada.id_pollada,
      pollada.titulo,
      "'" + cleanDni,
      militante.nombres,
      militante.apellidos,
      militante.base,
      cantidadNum,
      String(num_ticket_inicio || '').trim(),
      String(num_ticket_fin || '').trim(),
      montoFinal,
      'comprado',
      String(registrado_por || '').trim(),
      "'" + nowStr,
      '',
      ''
    ];

    sheetTK.appendRow(newRow);
    const newRowIndex = sheetTK.getLastRow();
    sheetTK.getRange(newRowIndex, COL_TK.DNI + 1).setNumberFormat('@');
    sheetTK.getRange(newRowIndex, COL_TK.FECHA_COMPRA + 1).setNumberFormat('@');

    return jsonResponse({
      success: true,
      message: `✅ Compra registrada: ${militante.nombres} — ${cantidadNum} ticket(s) — S/.${montoFinal}`,
      data: {
        id_compra: idCompra,
        id_pollada: pollada.id_pollada,
        titulo_pollada: pollada.titulo,
        dni: cleanDni,
        nombres: militante.nombres,
        apellidos: militante.apellidos,
        base: militante.base,
        cantidad_tickets: cantidadNum,
        num_ticket_inicio: String(num_ticket_inicio || '').trim(),
        num_ticket_fin: String(num_ticket_fin || '').trim(),
        monto_pagado: montoFinal,
        estado: 'comprado',
        fecha_compra: nowStr,
        rowIndex: newRowIndex
      }
    });
  } catch(err) {
    return jsonResponse({ success: false, error: 'Error al registrar compra: ' + err.toString() });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

/**
 * Verifica y sella digitalmente el ticket de un militante en la puerta.
 * Solo procede si el militante tiene estado 'comprado'.
 */
function handleVerificarTicket(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const { id_pollada, dni, verificado_por } = payload;
    if (!id_pollada || !dni) return jsonResponse({ success: false, error: 'id_pollada y dni requeridos' });

    const cleanDni = String(dni).replace(/\D/g, '').trim();
    const sheet = getSheet(SHEET_TICKETS_POLLADA);
    if (!sheet) return jsonResponse({ success: false, error: 'No se encontraron tickets registrados' });

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowDni = String(row[COL_TK.DNI] || '').replace(/\D/g, '').trim();
      const rowPollada = String(row[COL_TK.ID_POLLADA] || '').trim();
      if (rowDni !== cleanDni || rowPollada !== String(id_pollada).trim()) continue;

      const estado = String(row[COL_TK.ESTADO] || '').toLowerCase();

      if (estado === 'cancelado') {
        return jsonResponse({ success: false, error: 'Este ticket fue cancelado y no es válido' });
      }
      if (estado === 'entregado') {
        return jsonResponse({
          success: false,
          alreadyDelivered: true,
          error: `${row[COL_TK.NOMBRES]} ya recibió su pollada. No puede pasar nuevamente.`
        });
      }
      if (estado === 'verificado') {
        const horaVerif = cleanSheetDateTime(row[COL_TK.FECHA_VERIFICACION]);
        return jsonResponse({
          success: false,
          alreadyVerified: true,
          error: `${row[COL_TK.NOMBRES]} ya fue verificado a las ${horaVerif}. Puede pasar a cocina.`,
          data: {
            id_compra: String(row[COL_TK.ID_COMPRA] || '').trim(),
            dni: rowDni,
            nombres: String(row[COL_TK.NOMBRES] || '').trim(),
            apellidos: String(row[COL_TK.APELLIDOS] || '').trim(),
            cantidad_tickets: parseInt(row[COL_TK.CANTIDAD_TICKETS] || '0', 10),
            fecha_verificacion: horaVerif
          }
        });
      }

      // Marcar como verificado
      const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Lima', 'yyyy-MM-dd HH:mm:ss');
      const rowIdx = i + 1;
      sheet.getRange(rowIdx, COL_TK.ESTADO + 1).setValue('verificado');
      sheet.getRange(rowIdx, COL_TK.FECHA_VERIFICACION + 1).setNumberFormat('@').setValue("'" + nowStr);
      if (verificado_por) sheet.getRange(rowIdx, COL_TK.REGISTRADO_POR + 1).setValue(String(verificado_por));

      return jsonResponse({
        success: true,
        message: `✅ Verificado: ${row[COL_TK.NOMBRES]} ${row[COL_TK.APELLIDOS]} — ${row[COL_TK.CANTIDAD_TICKETS]} ticket(s). Puede pasar a cocina.`,
        data: {
          id_compra: String(row[COL_TK.ID_COMPRA] || '').trim(),
          dni: rowDni,
          nombres: String(row[COL_TK.NOMBRES] || '').trim(),
          apellidos: String(row[COL_TK.APELLIDOS] || '').trim(),
          base: String(row[COL_TK.BASE] || '').trim(),
          cantidad_tickets: parseInt(row[COL_TK.CANTIDAD_TICKETS] || '0', 10),
          num_ticket_inicio: String(row[COL_TK.NUM_TICKET_INICIO] || '').trim(),
          num_ticket_fin: String(row[COL_TK.NUM_TICKET_FIN] || '').trim(),
          estado: 'verificado',
          fecha_verificacion: nowStr
        }
      });
    }

    return jsonResponse({
      success: false,
      notFound: true,
      error: `El DNI ${cleanDni} no tiene tickets registrados para esta apoyada`
    });
  } catch(err) {
    return jsonResponse({ success: false, error: 'Error al verificar ticket: ' + err.toString() });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

/**
 * Registra la entrega de la pollada en cocina.
 * Solo procede si el militante fue previamente verificado en puerta (estado='verificado').
 */
function handleRegistrarEntrega(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const { id_pollada, dni, entregado_por } = payload;
    if (!id_pollada || !dni) return jsonResponse({ success: false, error: 'id_pollada y dni requeridos' });

    const cleanDni = String(dni).replace(/\D/g, '').trim();
    const sheet = getSheet(SHEET_TICKETS_POLLADA);
    if (!sheet) return jsonResponse({ success: false, error: 'No se encontraron tickets registrados' });

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowDni = String(row[COL_TK.DNI] || '').replace(/\D/g, '').trim();
      const rowPollada = String(row[COL_TK.ID_POLLADA] || '').trim();
      if (rowDni !== cleanDni || rowPollada !== String(id_pollada).trim()) continue;

      const estado = String(row[COL_TK.ESTADO] || '').toLowerCase();

      if (estado === 'cancelado') {
        return jsonResponse({ success: false, error: 'Este ticket fue cancelado y no es válido' });
      }
      if (estado === 'comprado') {
        return jsonResponse({
          success: false,
          notVerified: true,
          error: `${row[COL_TK.NOMBRES]} no ha pasado por el control de puerta. No puede recoger sin verificación previa.`
        });
      }
      if (estado === 'entregado') {
        const horaEntrega = cleanSheetDateTime(row[COL_TK.FECHA_ENTREGA]);
        return jsonResponse({
          success: false,
          alreadyDelivered: true,
          error: `${row[COL_TK.NOMBRES]} ya recibió su pollada a las ${horaEntrega}. No puede recoger nuevamente.`
        });
      }

      // Registrar entrega (estado='verificado' → 'entregado')
      const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Lima', 'yyyy-MM-dd HH:mm:ss');
      const rowIdx = i + 1;
      sheet.getRange(rowIdx, COL_TK.ESTADO + 1).setValue('entregado');
      sheet.getRange(rowIdx, COL_TK.FECHA_ENTREGA + 1).setNumberFormat('@').setValue("'" + nowStr);

      const cantidadTickets = parseInt(row[COL_TK.CANTIDAD_TICKETS] || '0', 10);
      return jsonResponse({
        success: true,
        message: `🍗 Entregado: ${row[COL_TK.NOMBRES]} ${row[COL_TK.APELLIDOS]} — ${cantidadTickets} porción(es)`,
        data: {
          id_compra: String(row[COL_TK.ID_COMPRA] || '').trim(),
          dni: rowDni,
          nombres: String(row[COL_TK.NOMBRES] || '').trim(),
          apellidos: String(row[COL_TK.APELLIDOS] || '').trim(),
          base: String(row[COL_TK.BASE] || '').trim(),
          cantidad_tickets: cantidadTickets,
          estado: 'entregado',
          fecha_entrega: nowStr
        }
      });
    }

    return jsonResponse({
      success: false,
      notFound: true,
      error: `El DNI ${cleanDni} no tiene tickets registrados para esta apoyada`
    });
  } catch(err) {
    return jsonResponse({ success: false, error: 'Error al registrar entrega: ' + err.toString() });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

/**
 * Cancela una compra de tickets.
 */
function handleCancelarCompra(payload) {
  try {
    const { id_compra, id_pollada, dni } = payload;
    if (!id_compra && !(id_pollada && dni)) {
      return jsonResponse({ success: false, error: 'id_compra o (id_pollada + dni) requeridos' });
    }

    const sheet = getSheet(SHEET_TICKETS_POLLADA);
    if (!sheet) return jsonResponse({ success: false, error: 'No se encontraron tickets' });

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowId = String(row[COL_TK.ID_COMPRA] || '').trim();
      const rowDni = String(row[COL_TK.DNI] || '').replace(/\D/g, '').trim();
      const rowPollada = String(row[COL_TK.ID_POLLADA] || '').trim();

      const matches = id_compra
        ? rowId === String(id_compra).trim()
        : (rowDni === String(dni).replace(/\D/g, '').trim() && rowPollada === String(id_pollada).trim());

      if (matches) {
        const estado = String(row[COL_TK.ESTADO] || '').toLowerCase();
        if (estado === 'entregado') {
          return jsonResponse({ success: false, error: 'No se puede cancelar una entrega ya realizada' });
        }
        sheet.getRange(i + 1, COL_TK.ESTADO + 1).setValue('cancelado');
        return jsonResponse({ success: true, message: 'Compra cancelada correctamente' });
      }
    }

    return jsonResponse({ success: false, error: 'Compra no encontrada' });
  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}
