import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { registrarEntrega } from '@/lib/google-sheets';
import { markLocalTicketDelivered, getLocalTickets } from '@/lib/pollada-storage';

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
    const { dni } = body;

    if (!dni) {
      return NextResponse.json({ success: false, error: 'DNI es requerido' }, { status: 400 });
    }

    const cleanDni = String(dni).replace(/\D/g, '').trim();
    if (cleanDni.length < 8) {
      return NextResponse.json({ success: false, error: 'DNI inválido' }, { status: 400 });
    }

    // Verificar si en local ya está entregado
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

    // Intentar registrar en Google Sheets
    let gsResult: any = null;
    try {
      gsResult = await registrarEntrega({
        id_pollada: id,
        dni: cleanDni,
        entregado_por: session.username,
      });
    } catch {
      // Usar fallback local
    }

    if (gsResult && gsResult.success) {
      markLocalTicketDelivered(id, cleanDni, session.username);
      return NextResponse.json(gsResult);
    }

    if (gsResult && gsResult.alreadyDelivered) {
      return NextResponse.json(gsResult);
    }

    // Fallback local
    const updated = markLocalTicketDelivered(id, cleanDni, session.username);
    if (updated) {
      return NextResponse.json({
        success: true,
        message: `🍗 Entrega confirmada para ${updated.nombres} ${updated.apellidos} (${updated.cantidad_tickets} pollada(s))`,
        data: updated,
      });
    }

    return NextResponse.json({
      success: false,
      error: `El DNI ${cleanDni} no tiene tickets registrados para esta pollada`,
    });
  } catch (error) {
    console.error('Error registrando entrega:', error);
    return NextResponse.json({ success: false, error: 'Error al registrar la entrega' }, { status: 500 });
  }
}
