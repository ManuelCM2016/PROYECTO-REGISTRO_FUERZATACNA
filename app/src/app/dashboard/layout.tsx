'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import type { Session } from '@/types';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { addToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inReviewCount, setInReviewCount] = useState<number>(0);
  const [currentStatusParam, setCurrentStatusParam] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        setCurrentStatusParam(params.get('estado'));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    fetchSession();
    fetchStats();

    // Actualizar contador en segundo plano cada 30 segundos
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.data) {
        setSession(data.data);

        // Bienvenida rápida al ingresar al panel
        if (typeof window !== 'undefined') {
          const welcomedKey = `ft_welcomed_${data.data.userId || data.data.username}`;
          if (!sessionStorage.getItem(welcomedKey)) {
            sessionStorage.setItem(welcomedKey, '1');
            const fullName = [data.data.nombres, data.data.apellidos].filter(Boolean).join(' ') || data.data.username;
            const cargoText = data.data.cargo ? ` (${data.data.cargo})` : '';
            addToast('info', `👋 ¡Bienvenido(a) a Fuerza Tacna, ${fullName}!${cargoText}`);
          }
        }
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/militantes?stats=true');
      const data = await res.json();
      if (data.success && data.data) {
        setInReviewCount(data.data.en_revision || 0);
      }
    } catch {
      // Ignorar errores de sondeo en segundo plano
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Cargando panel...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const isEnRevisionActive = pathname === '/dashboard/militantes' && currentStatusParam === 'en_revision';
  const isMilitantesActive = pathname === '/dashboard/militantes' && currentStatusParam !== 'en_revision';

  const navItems = [
    {
      label: '📊 Estadísticas y Ranking',
      href: '/dashboard/estadisticas',
      isActive: pathname === '/dashboard/estadisticas' || pathname === '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      roles: ['admin', 'asistente'],
      badge: null,
    },
    {
      label: 'Militantes',
      href: '/dashboard/militantes',
      isActive: isMilitantesActive,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      roles: ['admin', 'asistente'],
      badge: null,
    },
    {
      label: 'En Revisión',
      href: '/dashboard/militantes?estado=en_revision',
      isActive: isEnRevisionActive,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      roles: ['admin', 'asistente'],
      badge: inReviewCount > 0 ? inReviewCount : null,
    },
    {
      label: 'Eventos y Asistencia',
      href: '/dashboard/eventos',
      isActive: pathname.startsWith('/dashboard/eventos'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      roles: ['admin', 'asistente'],
      badge: null,
    },
    {
      label: 'Usuarios',
      href: '/dashboard/usuarios',
      isActive: pathname === '/dashboard/usuarios',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      roles: ['admin'],
      badge: null,
    },
  ];

  const filteredNav = navItems.filter((item) => item.roles.includes(session.role));

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-surface-900/90 backdrop-blur-2xl border-r border-primary-900/40
          transform transition-transform duration-300 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-primary-900/40">
          <div className="flex items-center gap-3">
            <img
              src="/logo/logo.jpg"
              alt="Logo Fuerza Tacna"
              className="w-10 h-10 rounded-xl object-cover border border-accent-400/50 shadow-md shadow-accent-500/20"
            />
            <div>
              <h1 className="text-sm font-black text-[#f8f9f9] tracking-wide leading-tight">FUERZA TACNA</h1>
              <p className="text-[10px] text-accent-400 font-bold uppercase tracking-widest">Panel Central</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1.5">
          {filteredNav.map((item) => {
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${
                    item.isActive
                      ? item.label === 'En Revisión'
                        ? 'bg-accent-500/20 text-accent-300 border border-accent-400/50 shadow-sm font-bold'
                        : 'bg-primary-600/30 text-[#f8f9f9] border border-primary-500/40 shadow-sm font-bold'
                      : 'text-primary-200/70 hover:text-[#f8f9f9] hover:bg-primary-900/30'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <span className={item.isActive ? 'text-accent-400' : 'text-primary-300'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>

                {item.badge !== null && item.badge > 0 && (
                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-black rounded-full bg-accent-500/25 text-accent-300 border border-accent-400/60 animate-pulse shadow-sm">
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* User info completo */}
        <div className="p-4 border-t border-primary-900/40 bg-surface-900/40">
          <div className="flex items-start gap-3 mb-3">
            {/* Avatar con iniciales */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 border border-accent-300/50 flex items-center justify-center text-surface-950 font-black text-sm shadow-md shadow-accent-500/20 shrink-0 mt-0.5">
              {(() => {
                const n = session.nombres?.trim() || '';
                const a = session.apellidos?.trim() || '';
                if (n && a) return `${n.charAt(0)}${a.charAt(0)}`.toUpperCase();
                if (n) return n.slice(0, 2).toUpperCase();
                return session.username.slice(0, 2).toUpperCase();
              })()}
            </div>

            <div className="flex-1 min-w-0">
              {/* Nombres y Apellidos */}
              <p
                className="text-sm font-black text-[#f8f9f9] leading-tight truncate"
                title={`${session.nombres || ''} ${session.apellidos || ''}`.trim() || session.username}
              >
                {(`${session.nombres || ''} ${session.apellidos || ''}`.trim()) || session.username}
              </p>

              {/* Cargo en Fuerza Tacna */}
              {session.cargo && (
                <div className="mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-accent-500/20 text-accent-300 border border-accent-400/40 shadow-sm leading-none">
                    🏛️ {session.cargo}
                  </span>
                </div>
              )}

              {/* DNI / Usuario y Rol */}
              <p className="text-[11px] text-primary-200/70 font-mono mt-1 flex items-center gap-1.5 truncate">
                <span>DNI: {session.username}</span>
                <span className="text-primary-400/40">•</span>
                <span className="text-accent-400 font-bold capitalize">
                  {session.role === 'admin' ? 'Administrador' : 'Asistente'}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-primary-200/80 hover:text-red-300 hover:bg-red-500/15 border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface-900/80 backdrop-blur-xl border-b border-primary-900/40">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-primary-300 hover:text-white hover:bg-primary-900/30 transition-all cursor-pointer"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/logo/logo.jpg"
              alt="Logo Fuerza Tacna"
              className="w-8 h-8 rounded-lg object-cover border border-accent-400/50"
            />
            <span className="text-sm font-black text-[#f8f9f9] tracking-wide">FUERZA TACNA</span>
          </div>
          <div className="w-10" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
