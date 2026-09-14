import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPolladas, addPollada, addEvento, getEventos } from '@/lib/google-sheets';
import { getLocalPolladas, saveLocalPollada } from '@/lib/pollada-storage';
import type { Pollada } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Mutex en memoria para deduplicar peticiones concurrentes de creación
const inFlightCreations = new Map<string, Promise<any>>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceFresh = searchParams.get('fresh') === 'true';

    const polladasMap = new Map<string, Pollada>();

    // 1. Obtener polladas de almacenamiento local/fallback
    const localPolladas = getLocalPolladas();
    localPolladas.forEach((p) => polladasMap.set(p.id_pollada, p));

    // 2. Obtener polladas desde Google Apps Script (pasando forceFresh para omitir memoria caché)
    let hasGsData = false;
    try {
      const gsResult = await getPolladas(forceFresh);
      if (gsResult && gsResult.success && Array.isArray(gsResult.data)) {
        gsResult.data.forEach((p) => {
          const existing = polladasMap.get(p.id_pollada);
          polladasMap.set(p.id_pollada, {
            ...p,
            total_tickets_vendidos: p.total_tickets_vendidos || existing?.total_tickets_vendidos || 0,
            total_recaudado: p.total_recaudado || existing?.total_recaudado || 0,
            total_entregados: p.total_entregados || existing?.total_entregados || 0,
          });
        });
        if (gsResult.data.length > 0) {
          hasGsData = true;
        }
      }
    } catch (err) {
      console.warn('Advertencia al consultar getPolladas:', err);
    }

    // 3. Solo si no se obtuvieron polladas de la hoja principal, consultar eventos como fallback
    if (!hasGsData) {
      try {
        const eventosRes = await getEventos(forceFresh);
        if (eventosRes && eventosRes.success && Array.isArray(eventosRes.data)) {
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
      } catch (err) {
        console.warn('Advertencia al consultar fallback de eventos:', err);
      }
    }

    // Deduplicar polladas por título normalizado y fecha para evitar dobles tarjetas
    const dedupedPolladasMap = new Map<string, Pollada>();
    for (const p of polladasMap.values()) {
      const normKey = `${(p.titulo || '').trim().toUpperCase()}::${(p.fecha || '').trim()}`;
      if (!dedupedPolladasMap.has(normKey)) {
        dedupedPolladasMap.set(normKey, p);
      } else {
        // Mantener la que tenga más información o ID más reciente
        const prev = dedupedPolladasMap.get(normKey)!;
        if ((p.total_tickets_vendidos || 0) > (prev.total_tickets_vendidos || 0)) {
          dedupedPolladasMap.set(normKey, p);
        }
      }
    }

    const allPolladas = Array.from(dedupedPolladasMap.values());
    return NextResponse.json(
      { success: true, data: allPolladas },
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
    const dedupKey = `${cleanTitulo}::${String(fecha).trim()}`;

    // Si hay una creación idéntica en proceso en el servidor, reutilizar su promesa para evitar doble inserción
    if (inFlightCreations.has(dedupKey)) {
      const existingRes = await inFlightCreations.get(dedupKey);
      return NextResponse.json(existingRes);
    }

    const creationPromise = (async () => {
      // 1. Intentar registrar con addPollada de Google Sheets
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
        return {
          success: true,
          message: '🍗 Pollada creada exitosamente',
          data: savedPollada,
        };
      }

      // 2. Si Apps Script aún no tiene addPollada desplegado, registrar como evento con tag [POLLADA S/X]
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

      return {
        success: true,
        message: '🍗 Pollada creada exitosamente',
        data: savedPollada,
      };
    })();

    inFlightCreations.set(dedupKey, creationPromise);

    try {
      const responseData = await creationPromise;
      return NextResponse.json(responseData);
    } finally {
      // Limpiar el cerrojo tras 5 segundos para permitir futuras ediciones si fuera necesario
      setTimeout(() => {
        inFlightCreations.delete(dedupKey);
      }, 5000);
    }
  } catch (error) {
    console.error('Error adding pollada:', error);
    return NextResponse.json({ success: false, error: 'Error al crear la pollada' }, { status: 500 });
  }
}
