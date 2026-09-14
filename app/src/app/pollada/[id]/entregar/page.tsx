'use client';

import { useState, useEffect, FormEvent, use, useRef } from 'react';
import type { Pollada } from '@/types';

function playBeep(ok: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(ok ? 1046 : 330, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(ok ? 1568 : 220, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch { /* ignore */ }
}

type ResultState = {
  type: 'success' | 'not_verified' | 'already_delivered' | 'not_found' | 'error';
  message: string;
  data?: any;
};

export default function EntregarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pollada, setPollada] = useState<Pollada | null>(null);
  const [loadingPollada, setLoadingPollada] = useState(true);
  const [dni, setDni] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [recentList, setRecentList] = useState<Array<ResultState & { time: string; dni: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadPollada();
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [id]);

  const loadPollada = async () => {
    try {
      const res = await fetch(`/api/pollada/${id}`);
      const data = await res.json();
      if (data.success) setPollada(data.data);
    } catch { /* ignore */ }
    finally { setLoadingPollada(false); }
  };

  const handleEntregar = async (e?: FormEvent) => {
    e?.preventDefault();
    const cleanDni = dni.replace(/\D/g, '').trim();
    if (cleanDni.length < 8) return;

    setProcessing(true);
    setResult(null);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);

    try {
      const res = await fetch(`/api/pollada/${id}/entregar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: cleanDni }),
      });
      const data = await res.json();

      let r: ResultState;
      if (data.success) {
        r = { type: 'success', message: data.message, data: data.data };
        playBeep(true);
      } else if (data.notVerified) {
        r = { type: 'not_verified', message: data.error };
        playBeep(false);
      } else if (data.alreadyDelivered) {
        r = { type: 'already_delivered', message: data.error };
        playBeep(false);
      } else if (data.notFound) {
        r = { type: 'not_found', message: data.error };
        playBeep(false);
      } else {
        r = { type: 'error', message: data.error || 'Error desconocido' };
        playBeep(false);
      }

      setResult(r);
      const now = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setRecentList(prev => [{ ...r, time: now, dni: cleanDni }, ...prev].slice(0, 10));

      clearTimerRef.current = setTimeout(() => {
        setResult(null);
        setDni('');
        inputRef.current?.focus();
      }, 5000);
    } catch {
      const r: ResultState = { type: 'error', message: 'Error de conexión. Intenta de nuevo.' };
      setResult(r);
      playBeep(false);
    } finally {
      setProcessing(false);
    }
  };

  const resultConfig: Record<ResultState['type'], { bg: string; border: string; icon: string; title: string }> = {
    success:          { bg: 'bg-green-500/20', border: 'border-green-500/50', icon: '🍗', title: '¡ENTREGADO!' },
    not_verified:     { bg: 'bg-red-500/20',   border: 'border-red-500/50',   icon: '🚫', title: 'No verificado en puerta' },
    already_delivered:{ bg: 'bg-slate-500/20', border: 'border-slate-500/50', icon: '⚠️', title: 'Ya recibió su pollada' },
    not_found:        { bg: 'bg-red-500/20',   border: 'border-red-500/50',   icon: '❌', title: 'No registrado' },
    error:            { bg: 'bg-red-500/20',   border: 'border-red-500/50',   icon: '🚫', title: 'Error' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-green-950/20 to-slate-950 p-4 flex flex-col">
      {/* Header */}
      <div className="text-center mb-6 pt-4">
        <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/40 rounded-full px-4 py-1.5 mb-3">
          <span className="text-green-400 text-sm font-bold">🍗 CONTROL DE COCINA</span>
        </div>
        {loadingPollada ? (
          <div className="h-7 bg-primary-800/40 rounded w-64 mx-auto animate-pulse" />
        ) : (
          <>
            <h1 className="text-xl font-black text-[#f8f9f9]">{pollada?.titulo || 'Apoyada'}</h1>
            {pollada?.fecha && (
              <p className="text-sm text-primary-300/60 mt-1">
                📅 {pollada.fecha} {pollada.hora && `• 🕐 ${pollada.hora}`}
                {pollada.lugar && ` • 📍 ${pollada.lugar}`}
              </p>
            )}
          </>
        )}
        <p className="text-xs text-green-400/70 mt-2">
          ⚠️ Solo militantes verificados en puerta pueden recoger
        </p>
      </div>

      {/* Main area */}
      <div className="max-w-md w-full mx-auto space-y-4 flex-1">
        {/* DNI Input */}
        <form onSubmit={handleEntregar} className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <span className="text-xl">🍗</span>
            </div>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={8}
              placeholder="Escanea QR o ingresa DNI..."
              value={dni}
              onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-surface-900/90 border-2 border-primary-800/60 text-[#f8f9f9] text-xl font-mono tracking-widest focus:outline-none focus:border-green-500/80 placeholder:text-primary-600/50 placeholder:font-sans placeholder:text-base placeholder:tracking-normal"
            />
          </div>
          <button
            type="submit"
            disabled={dni.length < 8 || processing}
            className="w-full py-4 rounded-2xl text-base font-black tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-400 hover:to-green-500 shadow-lg shadow-green-500/25 cursor-pointer"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </span>
            ) : '🍗 Registrar Entrega'}
          </button>
        </form>

        {/* Result card */}
        {result && (() => {
          const cfg = resultConfig[result.type];
          return (
            <div className={`rounded-2xl border-2 p-5 ${cfg.bg} ${cfg.border} animate-in slide-in-from-bottom-4 duration-300`}>
              <div className="flex items-start gap-3">
                <span className="text-3xl">{cfg.icon}</span>
                <div className="flex-1">
                  <p className="font-black text-[#f8f9f9] text-lg leading-tight">{cfg.title}</p>
                  <p className="text-sm text-primary-200/80 mt-1">{result.message}</p>
                  {result.data && (
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="font-bold text-[#f8f9f9]">
                        {result.data.nombres} {result.data.apellidos}
                      </p>
                      <p className="text-primary-300/70">DNI: {result.data.dni}</p>
                      {result.data.cantidad_tickets && (
                        <div className="mt-2 bg-green-500/20 border border-green-500/40 rounded-xl px-4 py-3 text-center">
                          <p className="text-3xl font-black text-green-300">{result.data.cantidad_tickets}</p>
                          <p className="text-green-400/80 text-sm font-bold">
                            porción{result.data.cantidad_tickets !== 1 ? 'es' : ''} a entregar
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Warning box */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <p className="text-xs font-bold text-amber-400 mb-1">IMPORTANTE</p>
          <p className="text-xs text-amber-300/70">
            Si sale <strong>"No verificado en puerta"</strong>, el militante debe primero pasar por el control de entrada antes de poder recoger.
          </p>
        </div>

        {/* Recent activity */}
        {recentList.length > 0 && (
          <div className="bg-surface-900/60 border border-primary-900/40 rounded-2xl p-4">
            <p className="text-xs font-bold text-primary-300/60 mb-3">ÚLTIMAS ENTREGAS</p>
            <div className="space-y-2 max-h-56 overflow-auto">
              {recentList.map((r, i) => {
                const cfg = resultConfig[r.type];
                return (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${cfg.bg} border ${cfg.border}`}>
                    <span className="text-base">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#f8f9f9] truncate">
                        {r.data?.nombres ? `${r.data.nombres} ${r.data.apellidos}` : `DNI: ${r.dni}`}
                        {r.data?.cantidad_tickets ? ` (${r.data.cantidad_tickets} pcs)` : ''}
                      </p>
                      <p className="text-[10px] text-primary-400/50 truncate">{r.message}</p>
                    </div>
                    <span className="text-[10px] text-primary-400/40 font-mono whitespace-nowrap">{r.time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-primary-600/40 mt-4 pb-2">
        Fuerza Tacna — Sistema de Control de Apoyada
      </p>
    </div>
  );
}
