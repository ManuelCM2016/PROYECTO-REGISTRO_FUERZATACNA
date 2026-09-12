import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rejectMilitante } from '@/lib/google-sheets';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { rowIndex, telefono } = body;

    if (!rowIndex && !telefono) {
      return NextResponse.json(
        { success: false, error: 'rowIndex o teléfono requerido' },
        { status: 400 }
      );
    }

    const result = await rejectMilitante({ rowIndex, telefono });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error rejecting militante:', error);
    const msg = error instanceof Error ? error.message : 'Error al rechazar militante';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
