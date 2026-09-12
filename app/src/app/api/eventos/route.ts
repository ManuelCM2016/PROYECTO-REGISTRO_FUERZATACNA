import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEventos, addEvento } from '@/lib/google-sheets';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const result = await getEventos();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching eventos:', error);
    return NextResponse.json(
      { success: false, error: 'Error al consultar eventos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { titulo, fecha, hora, lugar } = body;

    if (!titulo || !fecha) {
      return NextResponse.json(
        { success: false, error: 'El título y la fecha son obligatorios' },
        { status: 400 }
      );
    }

    const result = await addEvento({
      titulo: titulo.trim(),
      fecha: fecha.trim(),
      hora: hora ? hora.trim() : '',
      lugar: lugar ? lugar.trim() : '',
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating evento:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno al crear evento' },
      { status: 500 }
    );
  }
}
