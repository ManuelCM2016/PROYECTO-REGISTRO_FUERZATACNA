import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proteger rutas del dashboard
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('ft_session')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const session = await verifyToken(token);
    if (!session) {
      // Token inválido o expirado
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('ft_session');
      return response;
    }

    // Verificar acceso a /dashboard/usuarios (solo admin)
    if (pathname.startsWith('/dashboard/usuarios') && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard/militantes', request.url));
    }

    return NextResponse.next();
  }

  // Redirigir / a /registro
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/registro', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
};
