import { NextRequest, NextResponse } from 'next/server';
import { findMilitanteByPhone } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const telefono = searchParams.get('telefono');

    if (!telefono) {
      return NextResponse.json(
        { success: false, error: 'Teléfono es requerido' },
        { status: 400 }
      );
    }

    const result = await findMilitanteByPhone(telefono);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error verifying phone:', error);
    const msg = error instanceof Error ? error.message : 'Error al verificar teléfono';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
