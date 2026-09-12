import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAsistencia, marcarAsistencia } from '@/lib/google-sheets';

export async function GET(
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
    const { searchParams } = new URL(request.url);
    const forceFresh = searchParams.get('fresh') === 'true';

    const result = await getAsistencia(id, forceFresh);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
      },
    });
  } catch (error) {
    console.error('Error getting asistencia:', error);
    return NextResponse.json(
      { success: false, error: 'Error al consultar asistencia' },
      { status: 500 }
    );
  }
}

// Cache en memoria para evitar registros concurrentes duplicados en ráfaga
const recentAsistenciaLocks = new Map<string, number>();

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

    // CANDADO DE CONCURRENCIA: Impide registros duplicados si llegan peticiones concurrentes del mismo DNI
    const lockKey = `${id}:${cleanDni}`;
    const now = Date.now();
    const lastAttempt = recentAsistenciaLocks.get(lockKey);

    if (lastAttempt && (now - lastAttempt) < 8000) {
      return NextResponse.json({
        success: false,
        alreadyMarked: true,
        message: `La asistencia para el DNI ${cleanDni} ya fue procesada hace unos instantes.`,
        data: { dni: cleanDni }
      });
    }

    recentAsistenciaLocks.set(lockKey, now);

    // Limpieza periódica de claves viejas
    if (recentAsistenciaLocks.size > 500) {
      for (const [k, t] of recentAsistenciaLocks.entries()) {
        if (now - t > 30000) recentAsistenciaLocks.delete(k);
      }
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
