import { NextRequest, NextResponse } from 'next/server';
import { findMilitanteByPhone, warmupAppsScript } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warmup = searchParams.get('warmup') === 'true';

    // Petición silenciosa de pre-calentamiento al abrir /registro
    if (warmup) {
      await warmupAppsScript();
      return NextResponse.json({ success: true, warm: true });
    }

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
