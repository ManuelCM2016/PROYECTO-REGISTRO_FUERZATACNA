import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAsistencia, marcarAsistencia } from '@/lib/google-sheets';

export async function GET(
  _request: NextRequest,
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
    const result = await getAsistencia(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting asistencia:', error);
    return NextResponse.json(
      { success: false, error: 'Error al consultar asistencia' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { dni, metodo } = body;

    if (!dni) {
      return NextResponse.json(
        { success: false, error: 'El DNI es obligatorio' },
        { status: 400 }
      );
    }

    const cleanDni = String(dni).replace(/\D/g, '').trim();
    if (cleanDni.length < 8) {
      return NextResponse.json(
        { success: false, error: 'El DNI debe contener al menos 8 dígitos' },
        { status: 400 }
      );
    }

    const validMetodos = ['qr_puerta', 'scan_admin', 'manual'];
    const safeMetodo = validMetodos.includes(metodo) ? metodo : 'manual';

    // Si el método no es qr_puerta (es decir, es scan_admin o manual), validamos sesión
    if (safeMetodo !== 'qr_puerta') {
      const session = await getSession();
      if (!session) {
        return NextResponse.json(
          { success: false, error: 'No autorizado para registro administrativo' },
          { status: 401 }
        );
      }
    }

    const result = await marcarAsistencia({
      id_evento: id,
      dni: cleanDni,
      metodo: safeMetodo,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error marcando asistencia:', error);
    return NextResponse.json(
      { success: false, error: 'Error al registrar la asistencia' },
      { status: 500 }
    );
  }
}
