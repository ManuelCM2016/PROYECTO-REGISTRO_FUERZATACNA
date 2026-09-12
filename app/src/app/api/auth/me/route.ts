import { NextResponse } from 'next/server';
import { getSession, setSessionCookie } from '@/lib/auth';
import { findUsuarioByUsername } from '@/lib/google-sheets';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Si la sesión no tiene nombres o cargo cargados, los sincronizamos desde la base de datos
    if (!session.nombres || !session.cargo) {
      try {
        const uRes = await findUsuarioByUsername(session.username);
        if (uRes.success && uRes.found && uRes.data) {
          session.nombres = uRes.data.nombres || '';
          session.apellidos = uRes.data.apellidos || '';
          session.cargo = uRes.data.cargo || '';
          await setSessionCookie(session);
        }
      } catch (err) {
        console.error('Error sincronizando datos de usuario en sesión:', err);
      }
    }

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}
