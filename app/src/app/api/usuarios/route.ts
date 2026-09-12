import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { getUsuarios, addUsuario } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const forceFresh = searchParams.get('fresh') === 'true';

    const result = await getUsuarios(forceFresh);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error getting usuarios:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { usuario, password, rol, nombres, apellidos, cargo } = body;

    if (!usuario || !password || !rol) {
      return NextResponse.json(
        { success: false, error: 'Usuario, contraseña y rol son requeridos' },
        { status: 400 }
      );
    }

    if (!['admin', 'asistente'].includes(rol)) {
      return NextResponse.json(
        { success: false, error: 'Rol inválido' },
        { status: 400 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = await hashPassword(password);

    const result = await addUsuario({
      usuario,
      contrasena: hashedPassword,
      rol,
      nombres: nombres?.trim() || '',
      apellidos: apellidos?.trim() || '',
      cargo: cargo?.trim() || 'Militante',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating usuario:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear usuario' },
      { status: 500 }
    );
  }
}
