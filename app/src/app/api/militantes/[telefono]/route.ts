import { NextRequest, NextResponse } from 'next/server';
import { updateMilitante } from '@/lib/google-sheets';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ telefono: string }> }
) {
  try {
    const { telefono } = await params;
    const body = await request.json();

    if (!telefono) {
      return NextResponse.json(
        { success: false, error: 'Teléfono es requerido' },
        { status: 400 }
      );
    }

    const decodedPhone = decodeURIComponent(telefono);

    const result = await updateMilitante({
      telefono: decodedPhone,
      rowIndex: body.rowIndex,
      nombres: body.nombres,
      apellidos: body.apellidos,
      dni: body.dni,
      base: body.base,
      estado_registro: body.estado_registro,
      canal_registro: body.canal_registro,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating militante:', error);
    const msg = error instanceof Error ? error.message : 'Error al actualizar militante';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
