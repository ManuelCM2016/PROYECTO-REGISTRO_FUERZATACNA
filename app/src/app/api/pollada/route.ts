import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPolladas, addPollada } from '@/lib/google-sheets';

export async function GET() {
  try {
    const result = await getPolladas();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting polladas:', error);
    return NextResponse.json({ success: false, error: 'Error al consultar apoyadas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { titulo, fecha, hora, lugar, precio_ticket, min_tickets } = body;

    if (!titulo?.trim() || !fecha) {
      return NextResponse.json({ success: false, error: 'Título y fecha son requeridos' }, { status: 400 });
    }

    const result = await addPollada({ titulo, fecha, hora, lugar, precio_ticket, min_tickets });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error adding pollada:', error);
    return NextResponse.json({ success: false, error: 'Error al crear la apoyada' }, { status: 500 });
  }
}
