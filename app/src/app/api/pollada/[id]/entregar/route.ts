import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { registrarEntrega } from '@/lib/google-sheets';
import { markLocalTicketDelivered, getLocalTickets } from '@/lib/pollada-storage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const { dni, id_compra } = body;

    if (!dni && !id_compra) {
      return NextResponse.json({ success: false, error: 'DNI o ID de compra es requerido' }, { status: 400 });
    }

    const cleanDni = dni ? String(dni).replace(/\D/g, '').trim() : '';

    // Verificar si en local ya está entregado
    if (cleanDni) {
      const localTickets = getLocalTickets(id);
      const existing = localTickets.find((t) => t.dni === cleanDni && t.estado !== 'cancelado');

      if (existing && existing.estado === 'entregado') {
        return NextResponse.json({
          success: false,
          alreadyDelivered: true,
          error: `🚨 ALERTA: ${existing.nombres} ${existing.apellidos} YA RECOGIÓ sus ${existing.cantidad_tickets} pollada(s) el ${existing.fecha_entrega || 'previamente'}.`,
          data: existing,
        });
      }
    }

    // Intentar registrar en Google Sheets
    let gsResult: any = null;
    try {
      gsResult = await registrarEntrega({
        id_pollada: id,
        dni: cleanDni,
        id_compra,
        entregado_por: session.username,
      });
    } catch (err: any) {
      console.error('Error llamando a Google Sheets registrarEntrega:', err);
    }

    if (gsResult) {
      if (gsResult.success) {
        if (cleanDni) markLocalTicketDelivered(id, cleanDni, session.username);
        return NextResponse.json(gsResult);
      }

      if (gsResult.alreadyDelivered) {
        return NextResponse.json(gsResult);
      }

      if (gsResult.error) {
        return NextResponse.json({ success: false, error: gsResult.error }, { status: 400 });
      }
    }

    // Fallback local solo si Google Sheets falló la conexión
    if (cleanDni) {
      const updated = markLocalTicketDelivered(id, cleanDni, session.username);
      if (updated) {
        return NextResponse.json({
          success: true,
          message: `🍗 Entrega confirmada para ${updated.nombres} ${updated.apellidos} (${updated.cantidad_tickets} pollada(s))`,
          data: updated,
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: `El DNI ${cleanDni} no tiene tickets registrados para esta pollada`,
    }, { status: 404 });
  } catch (error) {
    console.error('Error registrando entrega:', error);
    return NextResponse.json({ success: false, error: 'Error al registrar la entrega' }, { status: 500 });
  }
}
