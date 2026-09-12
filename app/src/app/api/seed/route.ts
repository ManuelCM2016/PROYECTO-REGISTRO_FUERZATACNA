import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { getUsuarios, addUsuario } from '@/lib/google-sheets';

/**
 * POST /api/seed
 * Crea el primer usuario admin solo si no existen usuarios en el sistema.
 * Este endpoint se auto-desactiva después del primer uso.
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar si ya existen usuarios
    const existingUsers = await getUsuarios();
    if (existingUsers.success && existingUsers.data && existingUsers.data.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Ya existen usuarios en el sistema. El seed está desactivado.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { usuario, password } = body;

    if (!usuario || !password) {
      return NextResponse.json(
        { success: false, error: 'Usuario y contraseña son requeridos' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);

    const result = await addUsuario({
      usuario,
      contrasena: hashedPassword,
      rol: 'admin',
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Usuario admin "${usuario}" creado exitosamente. Ya puedes iniciar sesión.`,
      });
    }

    return NextResponse.json(result, { status: 400 });
  } catch (error) {
    console.error('Seed error:', error);
    const msg = error instanceof Error ? error.message : 'Error al crear el usuario inicial';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
