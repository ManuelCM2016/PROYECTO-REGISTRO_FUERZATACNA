import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { registrarEntrega } from '@/lib/google-sheets';

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

    const result = await registrarEntrega({
      id_pollada: id,
      dni: cleanDni,
      entregado_por: session.username,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error registrando entrega:', error);
    return NextResponse.json({ success: false, error: 'Error al registrar la entrega' }, { status: 500 });
  }
}
