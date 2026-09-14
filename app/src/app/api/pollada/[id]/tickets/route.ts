import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTicketsPollada, registrarCompra } from '@/lib/google-sheets';

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

    const result = await getTicketsPollada(id, forceFresh);
    return NextResponse.json(result);
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
    const { dni, cantidad_tickets, num_ticket_inicio, num_ticket_fin, monto_pagado } = body;

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

    const result = await registrarCompra({
      id_pollada: id,
      dni: cleanDni,
      cantidad_tickets: Number(cantidad_tickets),
      num_ticket_inicio: String(num_ticket_inicio || ''),
      num_ticket_fin: String(num_ticket_fin || ''),
      monto_pagado: monto_pagado !== undefined ? Number(monto_pagado) : undefined,
      registrado_por: session.username,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error registrando compra pollada:', error);
    return NextResponse.json({ success: false, error: 'Error al registrar la compra' }, { status: 500 });
  }
}
