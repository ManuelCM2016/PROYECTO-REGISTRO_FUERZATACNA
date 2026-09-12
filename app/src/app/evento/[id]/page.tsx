'use client';

import { useState, useEffect, use, FormEvent } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatFecha, formatHora, formatFechaHora } from '@/lib/formatters';
import type { Evento } from '@/types';

interface AsistenciaResult {
  id_asistencia?: string;
  id_evento?: string;
  titulo_evento?: string;
  dni: string;
  nombres: string;
  apellidos: string;
  base?: string;
  fecha_hora?: string;
  metodo?: string;
}

export default function EventoPuertaPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const eventoId = resolvedParams.id;

  const [evento, setEvento] = useState<Evento | null>(null);
  const [loadingEvento, setLoadingEvento] = useState(true);
  const [eventoError, setEventoError] = useState<string | null>(null);

  // Formulario DNI
  const [dni, setDni] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resultado
  const [resultState, setResultState] = useState<'idle' | 'success' | 'already' | 'not_found'>('idle');
  const [asistenciaData, setAsistenciaData] = useState<AsistenciaResult | null>(null);

  const fetchEvento = async () => {
    setLoadingEvento(true);
    setEventoError(null);
    try {
      const res = await fetch(`/api/eventos/${eventoId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setEvento(data.data);
      } else {
        setEventoError(data.error || 'El evento no fue encontrado o no está disponible');
      }
    } catch {
      setEventoError('Error de conexión al cargar la información del evento');
    } finally {
      setLoadingEvento(false);
    }
  };

  useEffect(() => {
    fetchEvento();
  }, [eventoId]);

  const handleMarcarAsistencia = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const cleanDni = dni.replace(/\D/g, '').trim();

    if (cleanDni.length !== 8) {
      setErrorMsg('Ingresa un número de DNI válido de 8 dígitos');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/eventos/${eventoId}/asistencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: cleanDni,
          metodo: 'qr_puerta',
        }),
      });

      const result = await res.json();

      if (result.success && result.data) {
        setAsistenciaData(result.data);
        setResultState('success');
      } else if (result.alreadyMarked) {
        setAsistenciaData(result.data || { dni: cleanDni, nombres: '', apellidos: '' });
        setErrorMsg(result.message || 'Ya registraste tu asistencia a este evento');
        setResultState('already');
      } else if (result.notFound) {
        setResultState('not_found');
      } else {
        setErrorMsg(result.error || 'No se pudo registrar la asistencia');
      }
    } catch {
      setErrorMsg('Error de conexión. Por favor verifica tu internet e intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setDni('');
    setResultState('idle');
    setAsistenciaData(null);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        {/* Cabecera Fuerza Tacna */}
        <div className="text-center">
          <img
            src="/logo/logo.jpg"
            alt="Logo Fuerza Tacna"
            className="w-16 h-16 rounded-2xl object-cover border-2 border-accent-400/60 shadow-xl shadow-accent-500/20 mx-auto mb-3"
          />
          <h1 className="text-xl font-black text-[#f8f9f9] tracking-wide">FUERZA TACNA</h1>
          <p className="text-xs text-accent-400 font-bold uppercase tracking-widest mt-0.5">
            Control Oficial de Asistencia
          </p>
        </div>

        {/* Carga del evento */}
        {loadingEvento ? (
          <div className="glass rounded-2xl p-8 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400">Verificando información del evento...</p>
          </div>
        ) : eventoError ? (
          <div className="glass rounded-2xl p-6 text-center space-y-4 border border-red-500/20">
            <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-2xl">
              ✕
            </div>
            <h2 className="text-lg font-bold text-white">Evento no disponible</h2>
            <p className="text-sm text-slate-400">{eventoError}</p>
            <Button onClick={fetchEvento} variant="secondary" className="w-full">
              Reintentar
            </Button>
          </div>
        ) : evento ? (
          <>
            {/* Tarjeta de Información del Evento */}
            <div className="glass rounded-2xl p-5 border border-white/10 space-y-3 glow-blue">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {evento.estado === 'activo' ? 'Evento En Curso' : 'Evento Finalizado'}
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: {evento.id_evento}</span>
              </div>

              <div>
                <h2 className="text-lg font-bold text-white leading-snug">{evento.titulo}</h2>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span>📅</span>
                  <span>{formatFecha(evento.fecha)}</span>
                </div>
                {evento.hora && (
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span>⏰</span>
                    <span>{formatHora(evento.hora)}</span>
                  </div>
                )}
                {evento.lugar && (
                  <div className="col-span-2 flex items-center gap-1.5 text-sky-400 mt-0.5">
                    <span>📍</span>
                    <span className="truncate">{evento.lugar}</span>
                  </div>
                )}
              </div>
            </div>

            {/* FORMULARIO ESTADO IDLE */}
            {resultState === 'idle' && (
              <div className="glass rounded-2xl p-6 border border-amber-500/20 glow-accent">
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                    🪪
                  </div>
                  <h3 className="text-base font-bold text-white">Ingresa tu DNI para Asistencia</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Solo debes ingresar tu número de DNI para confirmar tu presencia
                  </p>
                </div>

                <form onSubmit={handleMarcarAsistencia} className="space-y-4">
                  <div>
                    <Input
                      label="Número de DNI"
                      placeholder="Ingresa tus 8 dígitos"
                      value={dni}
                      onChange={(e) => {
                        setDni(e.target.value.replace(/\D/g, '').slice(0, 8));
                        setErrorMsg(null);
                      }}
                      error={errorMsg || undefined}
                      maxLength={8}
                      inputMode="numeric"
                      autoFocus
                      className="text-center text-lg font-mono tracking-widest font-bold"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="accent"
                    size="lg"
                    loading={submitting}
                    disabled={evento.estado === 'finalizado'}
                    className="w-full"
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    }
                  >
                    Confirmar Asistencia
                  </Button>
                </form>
              </div>
            )}

            {/* ESTADO ÉXITO */}
            {resultState === 'success' && asistenciaData && (
              <div className="glass rounded-2xl p-6 text-center border border-emerald-500/40 glow-accent space-y-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                  <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div>
                  <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold mb-2">
                    ¡PRESENTE REGISTRADO!
                  </div>
                  <h3 className="text-xl font-black text-white">
                    ¡Bienvenido(a), {asistenciaData.nombres}!
                  </h3>
                  <p className="text-sm text-slate-300 mt-1">
                    {asistenciaData.apellidos}
                  </p>
                </div>

                <div className="glass-light rounded-xl p-4 text-left text-xs space-y-2 border border-white/5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">DNI:</span>
                    <span className="text-white font-mono font-bold">{asistenciaData.dni}</span>
                  </div>
                  {asistenciaData.base && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Base:</span>
                      <span className="text-sky-400 font-semibold">{asistenciaData.base}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hora de Registro:</span>
                    <span className="text-emerald-400 font-mono font-semibold">
                      {formatFechaHora(asistenciaData.fecha_hora) || 'Recién registrado'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Modalidad:</span>
                    <span className="text-amber-300">Cartel QR en Puerta</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Link href={`/validar/${asistenciaData.dni}`}>
                    <Button variant="secondary" className="w-full text-xs">
                      Ver mi Credencial Digital
                    </Button>
                  </Link>

                  <Button onClick={handleReset} variant="ghost" className="w-full text-xs text-slate-400">
                    Registrar a otro militante
                  </Button>
                </div>
              </div>
            )}

            {/* ESTADO YA REGISTRADO */}
            {resultState === 'already' && asistenciaData && (
              <div className="glass rounded-2xl p-6 text-center border border-amber-500/40 glow-accent space-y-4">
                <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-2xl font-bold">
                  ⚠️
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">Asistencia Ya Registrada</h3>
                  <p className="text-xs text-amber-200/90 mt-1">{errorMsg}</p>
                </div>

                {asistenciaData.nombres && (
                  <div className="glass-light rounded-xl p-3 text-xs text-slate-300 space-y-1">
                    <p className="font-semibold text-white">{asistenciaData.nombres} {asistenciaData.apellidos}</p>
                    <p className="font-mono text-slate-400">DNI: {asistenciaData.dni}</p>
                  </div>
                )}

                <Button onClick={handleReset} variant="secondary" className="w-full">
                  Ingresar otro DNI
                </Button>
              </div>
            )}

            {/* ESTADO NO ENCONTRADO EN PADRÓN */}
            {resultState === 'not_found' && (
              <div className="glass rounded-2xl p-6 text-center border border-red-500/30 space-y-4">
                <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-2xl">
                  ✕
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">DNI no empadronado</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    El DNI <strong className="text-white font-mono">{dni}</strong> no figura en el padrón oficial de Fuerza Tacna.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-800/80 border border-white/5 text-xs text-slate-300 text-left space-y-2">
                  <p>💡 <strong>¿Qué debes hacer?</strong></p>
                  <p>
                    Para registrar tu asistencia primero debes inscribirte en el padrón oficial. Solo te tomará 1 minuto.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <Link href="/registro">
                    <Button variant="accent" className="w-full">
                      Inscribirme en el Padrón Ahora
                    </Button>
                  </Link>
                  <Button onClick={handleReset} variant="ghost" className="w-full text-slate-400 text-xs">
                    Intentar con otro DNI
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}

        <div className="text-center pt-2">
          <Link href="/registro" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← Ir al Portal de Registro Público
          </Link>
        </div>
      </div>
    </div>
  );
}
