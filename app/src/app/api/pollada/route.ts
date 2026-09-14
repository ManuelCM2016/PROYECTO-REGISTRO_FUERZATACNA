import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPolladas, addPollada, addEvento, getEventos } from '@/lib/google-sheets';
import { getLocalPolladas, saveLocalPollada } from '@/lib/pollada-storage';
import type { Pollada } from '@/types';

export async function GET() {
  try {
    const polladasMap = new Map<string, Pollada>();

    // 1. Obtener polladas de almacenamiento local/fallback
    const localPolladas = getLocalPolladas();
    localPolladas.forEach((p) => polladasMap.set(p.id_pollada, p));

    // 2. Obtener en paralelo desde Google Apps Script para máxima velocidad
    const [gsResultSettled, eventosResSettled] = await Promise.allSettled([
      getPolladas(),
      getEventos(),
    ]);

    if (gsResultSettled.status === 'fulfilled') {
      const gsResult = gsResultSettled.value;
      if (gsResult.success && Array.isArray(gsResult.data)) {
        gsResult.data.forEach((p) => {
          const existing = polladasMap.get(p.id_pollada);
          polladasMap.set(p.id_pollada, {
            ...p,
            total_tickets_vendidos: p.total_tickets_vendidos || existing?.total_tickets_vendidos || 0,
            total_recaudado: p.total_recaudado || existing?.total_recaudado || 0,
            total_entregados: p.total_entregados || existing?.total_entregados || 0,
          });
        });
      }
    }

    if (eventosResSettled.status === 'fulfilled') {
      const eventosRes = eventosResSettled.value;
      if (eventosRes.success && Array.isArray(eventosRes.data)) {
        eventosRes.data.forEach((ev) => {
          const isPollada =
            ev.titulo.includes('[POLLADA') ||
            ev.titulo.includes('🍗') ||
            ev.id_evento.startsWith('POL-');

          if (isPollada) {
            let precio = 16;
            const matchPrecio = ev.titulo.match(/\[POLLADA\s+S\/(\d+)\]/i);
            if (matchPrecio && matchPrecio[1]) {
              precio = parseFloat(matchPrecio[1]) || 16;
            }

            let cleanTitulo = ev.titulo
              .replace(/🍗/g, '')
              .replace(/\[POLLADA[^\]]*\]/gi, '')
              .trim();
            if (!cleanTitulo) cleanTitulo = 'POLLADA PRO-FONDOS';

            const id = ev.id_evento;
            const existing = polladasMap.get(id);

            polladasMap.set(id, {
              id_pollada: id,
              titulo: cleanTitulo,
              fecha: ev.fecha,
              hora: ev.hora || '10:00',
              lugar: ev.lugar || '',
              precio_ticket: precio,
              min_tickets: 2,
              estado: ev.estado || 'activo',
              total_tickets_vendidos: existing?.total_tickets_vendidos || 0,
              total_recaudado: existing?.total_recaudado || 0,
              total_entregados: existing?.total_entregados || 0,
            });
          }
        });
      }
    }

    const allPolladas = Array.from(polladasMap.values());
    return NextResponse.json({ success: true, data: allPolladas });
  } catch (error) {
    console.error('Error getting polladas:', error);
    return NextResponse.json({ success: true, data: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { titulo, fecha, hora, lugar, precio_ticket, min_tickets, total_estimado, ticket_inicio_talonario, ticket_fin_talonario } = body;

    if (!titulo?.trim() || !fecha) {
      return NextResponse.json({ success: false, error: 'Título y fecha son requeridos' }, { status: 400 });
    }

    const numPrecio = parseFloat(precio_ticket) || 16;
    const numMin = parseInt(min_tickets) || 2;
    const numTotal = parseInt(total_estimado) || 1000;
    const tktInicio = ticket_inicio_talonario ? String(ticket_inicio_talonario).trim() : '5000';
    const tktFin = ticket_fin_talonario ? String(ticket_fin_talonario).trim() : '6000';
    const cleanTitulo = titulo.trim().toUpperCase();

    // Intentar primero con addPollada de Google Sheets
    const result = await addPollada({
      titulo: cleanTitulo,
      fecha,
      hora,
      lugar,
      precio_ticket: numPrecio,
      min_tickets: numMin,
      total_estimado: numTotal,
      ticket_inicio_talonario: tktInicio,
      ticket_fin_talonario: tktFin,
    });

    let savedPollada: Pollada;

    if (result.success && result.data) {
      savedPollada = {
        ...result.data,
        total_estimado: numTotal,
        ticket_inicio_talonario: tktInicio,
        ticket_fin_talonario: tktFin,
      };
      saveLocalPollada(savedPollada);
      return NextResponse.json({
        success: true,
        message: '🍗 Pollada creada exitosamente',
        data: savedPollada,
      });
    }

    // Si Apps Script aún no tiene addPollada desplegado, registrar como evento con tag [POLLADA S/X]
    const fallbackEvent = await addEvento({
      titulo: `🍗 [POLLADA S/${numPrecio}] ${cleanTitulo}`,
      fecha: String(fecha).trim(),
      hora: hora ? String(hora).trim() : '10:00',
      lugar: lugar ? String(lugar).trim() : '',
    });

    const newId = fallbackEvent.success && fallbackEvent.data?.id_evento
      ? fallbackEvent.data.id_evento
      : ('POL-' + Date.now().toString(36).toUpperCase());

    savedPollada = {
      id_pollada: newId,
      titulo: cleanTitulo,
      fecha: String(fecha).trim(),
      hora: hora ? String(hora).trim() : '10:00',
      lugar: lugar ? String(lugar).trim() : '',
      precio_ticket: numPrecio,
      min_tickets: numMin,
      total_estimado: numTotal,
      ticket_inicio_talonario: tktInicio,
      ticket_fin_talonario: tktFin,
      estado: 'activo',
      total_tickets_vendidos: 0,
      total_recaudado: 0,
      total_entregados: 0,
    };

    saveLocalPollada(savedPollada);

    return NextResponse.json({
      success: true,
      message: '🍗 Pollada creada exitosamente',
      data: savedPollada,
    });
  } catch (error) {
    console.error('Error adding pollada:', error);
    return NextResponse.json({ success: false, error: 'Error al crear la pollada' }, { status: 500 });
  }
}
