import { NextRequest, NextResponse } from 'next/server';
import { getMilitantes, searchMilitantes, addMilitante, getStats } from '@/lib/google-sheets';
import type { Militante, StatsData } from '@/types';

export const dynamic = 'force-dynamic';

function calculateStats(militantes: Militante[]): StatsData {
  let completados = 0;
  let pendientes = 0;
  let en_revision = 0;
  let inactivos = 0;
  let rechazados = 0;

  militantes.forEach((m) => {
    const st = (m.estado_registro || '').toLowerCase();
    if (st === 'completado') completados++;
    else if (st === 'en_revision') en_revision++;
    else if (st === 'inactivo') inactivos++;
    else if (st === 'rechazado') rechazados++;
    else pendientes++;
  });

  return {
    total: militantes.length,
    completados,
    pendientes,
    en_revision,
    inactivos,
    rechazados,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const statsOnly = searchParams.get('stats');
    const forceFresh = searchParams.get('fresh') === 'true';

    // Búsqueda
    if (query) {
      const result = await searchMilitantes(query);
      return NextResponse.json(result);
    }

    // Obtener lista completa (aprovecha caché en memoria de 25s)
    const result = await getMilitantes(forceFresh);

    if (result.success && Array.isArray(result.data)) {
      const stats = calculateStats(result.data);

      if (statsOnly === 'true') {
        return NextResponse.json(
          { success: true, data: stats },
          { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' } }
        );
      }

      return NextResponse.json(
        {
          ...result,
          stats,
        },
        { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' } }
      );
    }

    // Fallback si no hubo lista
    if (statsOnly === 'true') {
      const statsResult = await getStats(forceFresh);
      return NextResponse.json(statsResult);
    }

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
