import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPolladaById, updatePollada, deletePollada } from '@/lib/google-sheets';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getPolladaById(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting pollada:', error);
    return NextResponse.json({ success: false, error: 'Error al consultar la apoyada' }, { status: 500 });
  }
}

export async function PATCH(
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
    const result = await updatePollada({ id_pollada: id, ...body });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating pollada:', error);
    return NextResponse.json({ success: false, error: 'Error al actualizar la apoyada' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await deletePollada(id, body.rowIndex);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting pollada:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar la apoyada' }, { status: 500 });
  }
}
