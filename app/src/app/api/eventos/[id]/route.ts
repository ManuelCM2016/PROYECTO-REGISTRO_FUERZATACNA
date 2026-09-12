import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEventoById, updateEvento } from '@/lib/google-sheets';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de evento requerido' },
        { status: 400 }
      );
    }

    const result = await getEventoById(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting evento by id:', error);
    return NextResponse.json(
      { success: false, error: 'Error al consultar evento' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { estado, titulo, fecha, hora, lugar } = body;

    const result = await updateEvento({
      id_evento: id,
      estado,
      titulo,
      fecha,
      hora,
      lugar,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating evento:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar evento' },
      { status: 500 }
    );
  }
}
