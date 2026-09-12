'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface MilitanteVerification {
  dni: string;
  nombres: string;
  apellidos: string;
  id_whatsapp: string;
  base?: string;
  estado_registro: string;
}

export default function ValidarDniPage({ params }: { params: Promise<{ dni: string }> }) {
  const resolvedParams = use(params);
  const rawDni = resolvedParams.dni;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MilitanteVerification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVerification = async () => {
    setLoading(true);
    setError(null);
    try {
      const cleanDni = rawDni.replace(/\D/g, '');
      const res = await fetch(`/api/militantes/check-dni?dni=${cleanDni}`);
      const result = await res.json();

      if (result.success && result.found && result.data) {
        setData(result.data);
      } else {
        setData(null);
      }
    } catch {
      setError('Error al consultar el servicio de validación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerification();
  }, [rawDni]);

  const isApproved = data?.estado_registro === 'completado';
  const isInReview = data?.estado_registro === 'en_revision';

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center p-4">
      {/* Tarjeta Central */}
      <div className="w-full max-w-md">
        {/* Cabecera con Logo */}
        <div className="text-center mb-6">
          <img
            src="/logo/logo.jpg"
            alt="Logo Fuerza Tacna"
            className="w-16 h-16 rounded-2xl object-cover border-2 border-accent-400/60 shadow-xl shadow-accent-500/20 mx-auto mb-3"
          />
          <h1 className="text-xl font-black text-[#f8f9f9] tracking-wide">FUERZA TACNA</h1>
          <p className="text-xs text-accent-400 font-bold uppercase tracking-widest mt-0.5">
            Portal Oficial de Verificación
          </p>
        </div>

        {loading ? (
          <div className="glass rounded-2xl p-8 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400">Verificando credencial en el padrón oficial...</p>
          </div>
        ) : error ? (
          <div className="glass rounded-2xl p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-2xl">
              ✕
            </div>
            <h2 className="text-lg font-bold text-white">Error de Verificación</h2>
            <p className="text-sm text-slate-400">{error}</p>
            <Button onClick={fetchVerification} variant="secondary" className="w-full">
              Reintentar
            </Button>
          </div>
        ) : data ? (
          <div className={`glass rounded-2xl p-6 border transition-all ${
            isApproved 
              ? 'border-emerald-500/30 glow-accent' 
              : isInReview
              ? 'border-amber-500/30 glow-accent'
              : 'border-white/10'
          }`}>
            {/* Ícono de Estado */}
            <div className="text-center mb-5">
              {isApproved ? (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : isInReview ? (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3 text-2xl">
                  ℹ️
                </div>
              )}

              <h2 className="text-xl font-bold text-white">
                {isApproved
                  ? 'Militante Oficial Verificado'
                  : isInReview
                  ? 'Solicitud en Revisión'
                  : 'Registro Pendiente'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {isApproved
                  ? 'Credencial válida y activa en el padrón de Fuerza Tacna'
                  : isInReview
                  ? 'Esta persona tiene una solicitud pendiente de aprobación'
                  : 'Registro pendiente de confirmación'}
              </p>
            </div>

            {/* Datos del Militante */}
            <div className="glass-light rounded-xl p-4 space-y-3 border border-white/5 mb-5 text-sm">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Nombres:</span>
                <span className="text-white font-bold text-right">
                  {data.nombres} {data.apellidos}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Documento:</span>
                <span className="text-white font-mono font-bold">DNI {data.dni}</span>
              </div>
              {data.base && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Base:</span>
                  <span className="text-sky-400 font-semibold">{data.base}</span>
                </div>
              )}
              <div className="flex justify-between py-1 items-center">
                <span className="text-slate-400">Condición:</span>
                <Badge
                  variant={isApproved ? 'success' : isInReview ? 'warning' : 'info'}
                  dot
                >
                  {isApproved
                    ? 'Padrón Oficial Activo'
                    : isInReview
                    ? 'En Revisión'
                    : 'Pendiente'}
                </Badge>
              </div>
            </div>

            {/* Sello de Autenticidad */}
            <div className="p-3 rounded-xl bg-surface-800/60 border border-white/5 text-center text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">🏛️ Certificación Digital Oficial</p>
              <p className="text-[11px] text-slate-500">
                Verificado directamente en la base de datos central de Fuerza Tacna.
              </p>
            </div>
          </div>
        ) : (
          /* NO ENCONTRADO */
          <div className="glass rounded-2xl p-6 text-center space-y-4 border border-red-500/20">
            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">DNI No Empadronado</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              El DNI <strong className="text-white font-mono">{rawDni}</strong> no figura registrado en el padrón oficial de Fuerza Tacna.
            </p>
            <div className="pt-2">
              <Link href="/registro">
                <Button variant="accent" className="w-full">
                  Registrarme en Fuerza Tacna
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="text-center mt-6">
          <Link href="/registro" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← Ir al Portal de Registro Público
          </Link>
        </div>
      </div>
    </div>
  );
}
