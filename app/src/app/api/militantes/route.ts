import { NextRequest, NextResponse } from 'next/server';
import { getMilitantes, searchMilitantes, addMilitante, getStats } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const statsOnly = searchParams.get('stats');

    // Retornar solo estadísticas
    if (statsOnly === 'true') {
      const result = await getStats();
      return NextResponse.json(result);
    }

    // Búsqueda o listar todos
    if (query) {
      const result = await searchMilitantes(query);
      return NextResponse.json(result);
    }

    const result = await getMilitantes();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting militantes:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener militantes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telefono, nombres, apellidos, dni, base, estado_registro, canal_registro } = body;

    if (!telefono) {
      return NextResponse.json(
        { success: false, error: 'Teléfono es requerido' },
        { status: 400 }
      );
    }

    const result = await addMilitante({
      telefono,
      nombres: nombres || '',
      apellidos: apellidos || '',
      dni: dni || '',
      base: base || '',
      estado_registro: estado_registro || 'completado',
      canal_registro: canal_registro || 'Auto-registro',
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error adding militante:', error);
    const msg = error instanceof Error ? error.message : 'Error al agregar militante';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
