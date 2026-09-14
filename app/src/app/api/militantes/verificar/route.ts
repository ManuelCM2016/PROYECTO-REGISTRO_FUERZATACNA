import { NextRequest, NextResponse } from 'next/server';
import { findMilitanteByPhone, findMilitanteByDni, warmupAppsScript } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warmup = searchParams.get('warmup') === 'true';

    // Petición silenciosa de pre-calentamiento al abrir la página
    if (warmup) {
      await warmupAppsScript();
      return NextResponse.json({ success: true, warm: true });
    }

    const dni = searchParams.get('dni');
    const telefono = searchParams.get('telefono');

    // 1. Búsqueda por DNI (para Asistencia, Venta de Tickets y Control de Polladas)
    if (dni) {
      const cleanDni = dni.replace(/\D/g, '').trim();
      if (cleanDni.length < 8) {
        return NextResponse.json(
          { success: false, error: 'Ingresa un DNI de 8 dígitos' },
          { status: 400 }
        );
      }

      const result = await findMilitanteByDni(cleanDni);
      return NextResponse.json(result);
    }

    // 2. Búsqueda por Teléfono (para validación de WhatsApp y registro)
    if (telefono) {
      const result = await findMilitanteByPhone(telefono);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: 'Ingresa un DNI o número de teléfono para verificar' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error verifying militante:', error);
    const msg = error instanceof Error ? error.message : 'Error al verificar militante';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
