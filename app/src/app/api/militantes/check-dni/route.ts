import { NextRequest, NextResponse } from 'next/server';
import { checkDni } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dni = searchParams.get('dni');

    if (!dni || dni.replace(/\D/g, '').length < 8) {
      return NextResponse.json(
        { success: false, error: 'DNI inválido o incompleto' },
        { status: 400 }
      );
    }

    const cleanDni = dni.replace(/\D/g, '');
    const result = await checkDni(cleanDni);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking DNI:', error);
    const msg = error instanceof Error ? error.message : 'Error al verificar DNI';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
