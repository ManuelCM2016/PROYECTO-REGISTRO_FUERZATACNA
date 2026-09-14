import fs from 'fs';
import path from 'path';
import type { Pollada, TicketPollada } from '@/types';

interface PolladaDB {
  polladas: Pollada[];
  tickets: TicketPollada[];
}

const DB_PATH = path.join(process.cwd(), '.polladas_db.json');

function readDB(): PolladaDB {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initial: PolladaDB = { polladas: [], tickets: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading polladas DB:', error);
    return { polladas: [], tickets: [] };
  }
}

function writeDB(data: PolladaDB) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing polladas DB:', error);
  }
}

export function getLocalPolladas(): Pollada[] {
  const db = readDB();
  // Recalcular métricas en base a los tickets
  return db.polladas.map((pol) => {
    const polTickets = db.tickets.filter((t) => t.id_pollada === pol.id_pollada && t.estado !== 'cancelado');
    const totalVendidos = polTickets.reduce((acc, t) => acc + (Number(t.cantidad_tickets) || 0), 0);
    const totalRecaudado = polTickets.reduce((acc, t) => acc + (Number(t.monto_pagado) || 0), 0);
    const totalEntregados = polTickets
      .filter((t) => t.estado === 'entregado')
      .reduce((acc, t) => acc + (Number(t.cantidad_tickets) || 0), 0);

    return {
      ...pol,
      total_tickets_vendidos: totalVendidos,
      total_recaudado: totalRecaudado,
      total_entregados: totalEntregados,
    };
  });
}

export function saveLocalPollada(pollada: Pollada): Pollada {
  const db = readDB();
  const existingIdx = db.polladas.findIndex((p) => p.id_pollada === pollada.id_pollada);
  if (existingIdx >= 0) {
    db.polladas[existingIdx] = { ...db.polladas[existingIdx], ...pollada };
  } else {
    db.polladas.unshift(pollada);
  }
  writeDB(db);
  return pollada;
}

export function deleteLocalPollada(id_pollada: string): boolean {
  const db = readDB();
  db.polladas = db.polladas.filter((p) => p.id_pollada !== id_pollada);
  db.tickets = db.tickets.filter((t) => t.id_pollada !== id_pollada);
  writeDB(db);
  return true;
}

export function getLocalTickets(id_pollada: string): TicketPollada[] {
  const db = readDB();
  return db.tickets.filter((t) => t.id_pollada === id_pollada);
}

export function addLocalTicket(ticket: Partial<TicketPollada> & { id_pollada: string; dni: string; cantidad_tickets: number }): TicketPollada {
  const db = readDB();
  const id_compra = 'TK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

  const newTicket: TicketPollada = {
    id_compra,
    id_pollada: ticket.id_pollada,
    dni: ticket.dni,
    nombres: ticket.nombres || '',
    apellidos: ticket.apellidos || '',
    base: ticket.base || '',
    telefono: ticket.telefono || '',
    cantidad_tickets: ticket.cantidad_tickets,
    num_ticket_inicio: ticket.num_ticket_inicio || '',
    num_ticket_fin: ticket.num_ticket_fin || '',
    numeros_tickets: ticket.numeros_tickets || (ticket.num_ticket_inicio ? [ticket.num_ticket_inicio] : []),
    monto_pagado: ticket.monto_pagado || 0,
    estado: 'comprado',
    registrado_por: ticket.registrado_por || '',
    fecha_compra: nowStr,
    fecha_verificacion: '',
    fecha_entrega: '',
    entregado_por: '',
  };

  db.tickets.unshift(newTicket);
  writeDB(db);
  return newTicket;
}

export function markLocalTicketDelivered(id_pollada: string, dni: string, entregado_por?: string): TicketPollada | null {
  const db = readDB();
  const ticket = db.tickets.find((t) => t.id_pollada === id_pollada && t.dni === dni && t.estado !== 'cancelado');
  if (!ticket) return null;

  ticket.estado = 'entregado';
  ticket.fecha_entrega = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
  if (entregado_por) {
    ticket.entregado_por = entregado_por;
  }

  writeDB(db);
  return ticket;
}
