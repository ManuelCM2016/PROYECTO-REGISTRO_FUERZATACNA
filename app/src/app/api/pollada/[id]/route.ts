import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPolladaById, updatePollada, deletePollada, deleteEvento } from '@/lib/google-sheets';
import { deleteLocalPollada, saveLocalPollada } from '@/lib/pollada-storage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    return NextResponse.json({ success: false, error: 'Error al consultar la pollada' }, { status: 500 });
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
    saveLocalPollada({ id_pollada: id, ...body });
    const result = await updatePollada({ id_pollada: id, ...body });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating pollada:', error);
    return NextResponse.json({ success: false, error: 'Error al actualizar la pollada' }, { status: 500 });
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

    deleteLocalPollada(id);

    try {
      if (id.startsWith('EVT-')) {
        await deleteEvento(id);
      } else {
        await deletePollada(id, body.rowIndex);
      }
    } catch {
      // Si falla Google Sheets, ya se borró localmente
    }

    return NextResponse.json({ success: true, message: 'Pollada eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting pollada:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar la pollada' }, { status: 500 });
  }
}
