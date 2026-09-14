import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTicketsPollada, registrarCompra, searchMilitantes } from '@/lib/google-sheets';
import { getLocalTickets, addLocalTicket } from '@/lib/pollada-storage';
import type { TicketPollada } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const forceFresh = searchParams.get('fresh') === 'true';

    const localTickets = getLocalTickets(id);
    const ticketMap = new Map<string, TicketPollada>();
    localTickets.forEach((t) => ticketMap.set(t.dni, t));

    try {
      const gsResult = await getTicketsPollada(id, forceFresh);
      if (gsResult.success && Array.isArray(gsResult.data)) {
        gsResult.data.forEach((t) => ticketMap.set(t.dni, t));
      }
    } catch {
      // Usar tickets locales
    }

    return NextResponse.json(
      { success: true, data: Array.from(ticketMap.values()) },
      {
        headers: {
          'Cache-Control': forceFresh
            ? 'no-store, no-cache, must-revalidate, proxy-revalidate'
            : 'public, s-maxage=10, stale-while-revalidate=20',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error('Error getting tickets pollada:', error);
    return NextResponse.json({ success: false, error: 'Error al consultar tickets' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { dni, cantidad_tickets, num_ticket_inicio, num_ticket_fin, numeros_tickets, monto_pagado } = body;

    if (!dni || !cantidad_tickets) {
      return NextResponse.json(
        { success: false, error: 'DNI y cantidad de tickets son requeridos' },
        { status: 400 }
      );
    }

    const cleanDni = String(dni).replace(/\D/g, '').trim();
    if (cleanDni.length < 8) {
      return NextResponse.json({ success: false, error: 'DNI inválido' }, { status: 400 });
    }

    const cant = Number(cantidad_tickets);

    // Normalizar lista de números de tickets físicos
    let ticketsList: string[] = [];
    if (Array.isArray(numeros_tickets) && numeros_tickets.length > 0) {
      ticketsList = numeros_tickets.map((t: any) => String(t).trim()).filter(Boolean);
    } else if (num_ticket_inicio) {
      const inicio = String(num_ticket_inicio).trim();
      if (inicio.includes(',')) {
        ticketsList = inicio.split(',').map((t) => t.trim()).filter(Boolean);
      } else {
        ticketsList = [inicio];
        if (num_ticket_fin && String(num_ticket_fin).trim() !== inicio) {
          ticketsList.push(String(num_ticket_fin).trim());
        }
      }
    }

    const ticketInicioFinal = ticketsList.length > 0 ? ticketsList.join(', ') : String(num_ticket_inicio || '').trim();
    const ticketFinFinal = ticketsList.length > 0 ? ticketsList[ticketsList.length - 1] : String(num_ticket_fin || '').trim();

    // Obtener datos del militante desde padrón
    let militanteInfo = { nombres: '', apellidos: '', base: '', telefono: '' };
    try {
      const searchRes = await searchMilitantes(cleanDni);
      if (searchRes.success && searchRes.data && searchRes.data.length > 0) {
        const m = searchRes.data.find((item) => item.dni === cleanDni) || searchRes.data[0];
        militanteInfo = {
          nombres: m.nombres || '',
          apellidos: m.apellidos || '',
          base: m.base || '',
          telefono: (m as any).telefono || m.id_whatsapp || '',
        };
      }
    } catch {
      // Ignorar
    }

    // Intentar registrar en Google Sheets
    let gsResult: any = null;
    try {
      gsResult = await registrarCompra({
        id_pollada: id,
        dni: cleanDni,
        cantidad_tickets: cant,
        num_ticket_inicio: ticketInicioFinal,
        num_ticket_fin: ticketFinFinal,
        numeros_tickets: ticketsList,
        monto_pagado: monto_pagado !== undefined ? Number(monto_pagado) : undefined,
        registrado_por: session.username,
      });
    } catch {
      // Fallback a almacenamiento local
    }

    if (gsResult && gsResult.success) {
      // También guardar en local para respuesta instantánea y offline
      addLocalTicket({
        id_pollada: id,
        dni: cleanDni,
        nombres: gsResult.data?.nombres || militanteInfo.nombres,
        apellidos: gsResult.data?.apellidos || militanteInfo.apellidos,
        base: gsResult.data?.base || militanteInfo.base,
        telefono: militanteInfo.telefono,
        cantidad_tickets: cant,
        num_ticket_inicio: ticketInicioFinal,
        num_ticket_fin: ticketFinFinal,
        numeros_tickets: ticketsList,
        monto_pagado: Number(monto_pagado) || 0,
        registrado_por: session.username,
      });

      return NextResponse.json(gsResult);
    }

    // Fallback: guardar localmente
    const localTicket = addLocalTicket({
      id_pollada: id,
      dni: cleanDni,
      nombres: militanteInfo.nombres,
      apellidos: militanteInfo.apellidos,
      base: militanteInfo.base,
      telefono: militanteInfo.telefono,
      cantidad_tickets: cant,
      num_ticket_inicio: ticketInicioFinal,
      num_ticket_fin: ticketFinFinal,
      numeros_tickets: ticketsList,
      monto_pagado: Number(monto_pagado) || 0,
      registrado_por: session.username,
    });

    return NextResponse.json({
      success: true,
      message: '✅ Compra registrada exitosamente',
      data: localTicket,
    });
  } catch (error) {
    console.error('Error registrando compra pollada:', error);
    return NextResponse.json({ success: false, error: 'Error al registrar la compra' }, { status: 500 });
  }
}
