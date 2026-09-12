'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export default function LoginPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      addToast('warning', 'Ingresa usuario y contraseña');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (data.success) {
        const fullName = [data.data.nombres, data.data.apellidos].filter(Boolean).join(' ') || data.data.username;
        const cargoText = data.data.cargo ? ` (${data.data.cargo})` : '';
        addToast('success', `¡Bienvenido(a) a Fuerza Tacna, ${fullName}!${cargoText}`);
        sessionStorage.setItem('just_logged_in', JSON.stringify({
          name: fullName,
          cargo: data.data.cargo || '',
        }));
        router.push('/dashboard/militantes');
      } else {
        addToast('error', data.error || 'Credenciales incorrectas');
      }
    } catch {
      addToast('error', 'Error de conexión al servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <img
              src="/logo/logo.jpg"
              alt="Logo Fuerza Tacna"
              className="w-20 h-20 rounded-2xl object-cover border-2 border-accent-400/60 shadow-2xl shadow-accent-500/20 mx-auto"
            />
            <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md bg-accent-500 text-surface-950 text-[10px] font-black tracking-wider uppercase shadow-md">
              ADMIN
            </div>
          </div>
          <h1 className="text-2xl font-black text-[#f8f9f9] tracking-wide">FUERZA TACNA</h1>
          <p className="text-xs text-accent-400 font-bold uppercase tracking-widest mt-0.5">Sistema Central de Control</p>
        </div>

        {/* Form */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 glow-brand border border-primary-400/20">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Usuario"
              type="text"
              placeholder="Tu nombre de usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              icon={
                <svg className="w-4 h-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />

            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              icon={
                <svg className="w-4 h-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-primary-300 hover:text-accent-400 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              }
            />

            <Button type="submit" loading={loading} className="w-full" size="lg" variant="primary">
              Iniciar Sesión
            </Button>
          </form>
        </div>

        {/* Link al registro público */}
        <div className="text-center mt-6">
          <a
            href="/registro"
            className="text-xs sm:text-sm text-primary-300/80 hover:text-accent-400 font-medium transition-colors"
          >
            ¿Eres militante? Ir al auto-registro oficial →
          </a>
        </div>
      </div>
    </div>
  );
}
