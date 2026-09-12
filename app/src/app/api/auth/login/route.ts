import { NextRequest, NextResponse } from 'next/server';
import { comparePassword, setSessionCookie } from '@/lib/auth';
import { findUsuarioByUsername } from '@/lib/google-sheets';
import type { Session } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Usuario y contraseña requeridos' },
        { status: 400 }
      );
    }

    // Buscar usuario en Google Sheets via Apps Script
    const result = await findUsuarioByUsername(username);

    if (!result.success || !result.found || !result.data) {
      return NextResponse.json(
        { success: false, error: 'Credenciales incorrectas' },
        { status: 401 }
      );
    }

    const usuario = result.data;
    if (!usuario.contrasena) {
      return NextResponse.json(
        { success: false, error: 'Credenciales incorrectas' },
        { status: 401 }
      );
    }

    // Verificar contraseña
    const isValid = await comparePassword(password, usuario.contrasena);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Credenciales incorrectas' },
        { status: 401 }
      );
    }

    // Crear sesión
    const session: Session = {
      userId: usuario.id,
      username: usuario.usuario,
      role: usuario.rol as 'admin' | 'asistente',
      nombres: usuario.nombres || '',
      apellidos: usuario.apellidos || '',
      cargo: usuario.cargo || '',
    };

    await setSessionCookie(session);

    return NextResponse.json({
      success: true,
      data: {
        username: session.username,
        role: session.role,
        nombres: session.nombres,
        apellidos: session.apellidos,
        cargo: session.cargo,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
