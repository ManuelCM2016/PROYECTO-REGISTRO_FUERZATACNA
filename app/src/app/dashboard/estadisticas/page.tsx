'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { BASES_DISPONIBLES } from '@/lib/constants';

interface ResumenData {
  totalMilitantes: number;
  completados: number;
  pendientes: number;
  enRevision: number;
  inactivos: number;
  rechazados: number;
  totalEventos: number;
  eventosActivos: number;
  eventosFinalizados: number;
  totalAsistencias: number;
  tasaPromedio: string;
}

interface MilitanteRanking {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  base: string;
  telefono: string;
  asistenciasCount: number;
  eventosCount: number;
  estado_registro: string;
  posicion: number;
  porcentaje: number;
  nivelCompromiso: string;
  medalla: 'oro' | 'plata' | 'bronce' | 'top10' | null;
}

interface BaseStat {
  nombre: string;
  militantesCount: number;
  asistenciasCount: number;
}

interface EventoStat {
  id_evento: string;
  titulo: string;
  fecha: string;
  hora: string;
  lugar: string;
  estado: string;
  total_asistentes: number;
}

interface MetodosStat {
  qr_puerta: number;
  scan_admin: number;
  manual: number;
}

export default function EstadisticasRankingPage() {
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'ranking' | 'graficos'>('ranking');

  // Datos de API
  const [resumen, setResumen] = useState<ResumenData | null>(null);
  const [ranking, setRanking] = useState<MilitanteRanking[]>([]);
  const [bases, setBases] = useState<BaseStat[]>([]);
  const [eventos, setEventos] = useState<EventoStat[]>([]);
  const [metodos, setMetodos] = useState<MetodosStat>({ qr_puerta: 0, scan_admin: 0, manual: 0 });

  // Filtros de Ranking
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBase, setSelectedBase] = useState('todas');
  const [selectedNivel, setSelectedNivel] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    fetchEstadisticas();
  }, []);

  const fetchEstadisticas = async (isManual = false) => {
    // 1. Cargar instantáneamente de sessionStorage si existe copia previa
    if (!isManual && typeof window !== 'undefined') {
      try {
        const cachedStr = sessionStorage.getItem('ft_cache_estadisticas');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (cached && cached.resumen) {
            setResumen(cached.resumen);
            setRanking(cached.ranking || []);
            setBases(cached.bases || []);
            setEventos(cached.eventos || []);
            setMetodos(cached.metodos || { qr_puerta: 0, scan_admin: 0, manual: 0 });
            setLoading(false); // Renderizado instantáneo (0ms) sin siluetas
          }
        }
      } catch {}
    }

    if (isManual) setRefreshing(true);
    else if (!resumen) setLoading(true);

    try {
      const url = isManual ? '/api/estadisticas?fresh=true' : '/api/estadisticas';
      const res = await fetch(url);
      const json = await res.json();

      if (json.success && json.data) {
        setResumen(json.data.resumen);
        setRanking(json.data.ranking || []);
        setBases(json.data.bases || []);
        setEventos(json.data.eventos || []);
        setMetodos(json.data.metodos || { qr_puerta: 0, scan_admin: 0, manual: 0 });

        if (typeof window !== 'undefined') {
          sessionStorage.setItem('ft_cache_estadisticas', JSON.stringify(json.data));
        }

        if (isManual) {
          addToast('success', 'Estadísticas y ranking actualizados en tiempo real');
        }
      } else {
        if (!resumen) addToast('error', json.error || 'Error al cargar estadísticas');
      }
    } catch {
      if (!resumen) addToast('error', 'Error de conexión al cargar estadísticas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Top 3 para el podio
  const top1 = ranking[0] || null;
  const top2 = ranking[1] || null;
  const top3 = ranking[2] || null;

  // Filtrado de la tabla de ranking
  const filteredRanking = useMemo(() => {
    return ranking.filter((m) => {
      // Búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = m.nombreCompleto.toLowerCase().includes(q);
        const matchDni = m.dni.toLowerCase().includes(q);
        const matchPhone = m.telefono.toLowerCase().includes(q);
        if (!matchName && !matchDni && !matchPhone) return false;
      }

      // Base
      if (selectedBase !== 'todas') {
        if (m.base.toLowerCase() !== selectedBase.toLowerCase()) return false;
      }

      // Nivel
      if (selectedNivel !== 'todos') {
        if (selectedNivel === 'con_asistencia' && m.asistenciasCount === 0) return false;
        if (selectedNivel === 'sin_asistencia' && m.asistenciasCount > 0) return false;
        if (selectedNivel === 'lider' && m.porcentaje < 80) return false;
      }

      return true;
    });
  }, [ranking, searchQuery, selectedBase, selectedNivel]);

  // Paginación
  const totalPages = Math.ceil(filteredRanking.length / itemsPerPage);
  const paginatedRanking = useMemo(() => {
    return filteredRanking.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredRanking, currentPage]);

  const maxAsistenciasBase = useMemo(() => {
    return Math.max(...bases.map((b) => b.asistenciasCount), 1);
  }, [bases]);

  const maxAsistentesEvento = useMemo(() => {
    return Math.max(...eventos.map((e) => e.total_asistentes), 1);
  }, [eventos]);

  return (
    <div className="space-y-7 pb-12">
      {/* Header Principal con branding Fuerza Tacna */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-400 via-primary-600 to-primary-950 p-0.5 shadow-lg shadow-accent-500/20">
            <div className="w-full h-full bg-surface-900 rounded-[14px] flex items-center justify-center text-2xl">
              📊
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-[#f8f9f9] tracking-wide">
                Estadísticas y Ranking de Militantes
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-accent-500/20 text-accent-300 border border-accent-400/40">
                Mérito Político
              </span>
            </div>
            <p className="text-xs text-primary-200/80 mt-0.5">
              Concurrencia a reuniones y fidelidad de los militantes de Fuerza Tacna para consideración en cargos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchEstadisticas(true)}
            loading={refreshing}
            icon={
              <svg
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : 'text-accent-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            }
          >
            Actualizar Métricas
          </Button>

          <Link href="/dashboard/militantes">
            <Button
              variant="outline"
              size="sm"
              icon={
                <svg className="w-4 h-4 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            >
              Ver Padrón
            </Button>
          </Link>
        </div>
      </div>

      {/* Tarjetas KPI Superiores */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : resumen ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Padrón Total */}
          <div className="glass-card rounded-2xl p-5 border border-primary-400/20 relative overflow-hidden group hover:border-accent-400/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl group-hover:bg-primary-500/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-primary-300 uppercase tracking-wider font-semibold">Total Padrón</p>
                <p className="text-3xl font-black text-[#f8f9f9] mt-1">{resumen.totalMilitantes}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-900/60 border border-primary-400/30 flex items-center justify-center text-primary-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 text-[11px] text-primary-200/70">
              <span className="text-emerald-400 font-semibold">{resumen.completados} activos</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold">{resumen.enRevision} revisión</span>
              {resumen.inactivos > 0 && (
                <>
                  <span>•</span>
                  <span className="text-slate-400 font-semibold">{resumen.inactivos} inactivos</span>
                </>
              )}
            </div>
          </div>

          {/* KPI 2: Eventos Realizados */}
          <div className="glass-card rounded-2xl p-5 border border-primary-400/20 relative overflow-hidden group hover:border-accent-400/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent-500/10 rounded-full blur-2xl group-hover:bg-accent-500/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-accent-300 uppercase tracking-wider font-semibold">Eventos y Reuniones</p>
                <p className="text-3xl font-black text-accent-300 mt-1">{resumen.totalEventos}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-accent-500/15 border border-accent-400/30 flex items-center justify-center text-accent-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 text-[11px] text-accent-200/70">
              <span className="text-emerald-400 font-semibold">{resumen.eventosActivos} en curso</span>
              <span>•</span>
              <span>{resumen.eventosFinalizados} finalizados</span>
            </div>
          </div>

          {/* KPI 3: Asistencias Totales */}
          <div className="glass-card rounded-2xl p-5 border border-primary-400/20 relative overflow-hidden group hover:border-accent-400/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400 uppercase tracking-wider font-semibold">Marcas de Asistencia</p>
                <p className="text-3xl font-black text-emerald-300 mt-1">{resumen.totalAsistencias}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-emerald-200/70">
              Registros validados en puerta y escaneo de carnet
            </p>
          </div>

          {/* KPI 4: Concurrencia Promedio */}
          <div className="glass-card rounded-2xl p-5 border border-primary-400/20 relative overflow-hidden group hover:border-accent-400/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary-400/10 rounded-full blur-2xl group-hover:bg-primary-400/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-primary-200 uppercase tracking-wider font-semibold">Promedio x Evento</p>
                <p className="text-3xl font-black text-primary-100 mt-1">{resumen.tasaPromedio}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-800/40 border border-primary-400/30 flex items-center justify-center text-primary-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-primary-300/80">
              Militantes concurrentes por convocatoria
            </p>
          </div>
        </div>
      ) : null}

      {/* PODIO DE HONOR: Los 3 Militantes más Concurridos */}
      {top1 && top1.asistenciasCount > 0 && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-accent-500/30 glow-gold relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-accent-500/5 via-transparent to-primary-950/40 pointer-events-none" />

          {/* Encabezado del Podio */}
          <div className="text-center max-w-xl mx-auto mb-8 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-accent-500/20 text-accent-300 border border-accent-400/40 uppercase tracking-widest shadow-sm">
              👑 Cuadro de Honor & Mérito
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#f8f9f9] mt-2 tracking-wide">
              Top Militantes con Mayor Asistencia
            </h2>
            <p className="text-xs text-primary-200/80 mt-1">
              Reconocimiento a la lealtad y compromiso partidario para evaluación de cargos y representaciones en Tacna
            </p>
          </div>

          {/* Estructura del Podio de 3 Lugares */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-4xl mx-auto relative z-10 pt-4">
            {/* 2do Lugar (Plata) */}
            {top2 && (
              <div className="order-2 md:order-1 flex flex-col items-center">
                <div className="relative mb-3 group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-400 p-0.5 shadow-lg shadow-slate-400/20">
                    <div className="w-full h-full rounded-[14px] bg-surface-900 flex items-center justify-center font-black text-xl text-slate-200">
                      {top2.nombres?.charAt(0) || '2'}
                      {top2.apellidos?.charAt(0) || ''}
                    </div>
                  </div>
                  <span className="absolute -top-3 -right-2 text-2xl filter drop-shadow">🥈</span>
                </div>
                <div className="text-center w-full glass rounded-2xl p-4 border border-slate-400/30 bg-surface-900/80">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-slate-500/20 px-2 py-0.5 rounded-full border border-slate-400/30">
                    2° Lugar
                  </span>
                  <h3 className="font-bold text-sm text-[#f8f9f9] mt-1.5 truncate" title={top2.nombreCompleto}>
                    {top2.nombreCompleto}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Base: {top2.base}</p>
                  <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center text-xs">
                    <span className="text-slate-400">Asistencias:</span>
                    <span className="font-extrabold text-slate-200">{top2.asistenciasCount}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className="bg-slate-300 h-1.5 rounded-full" style={{ width: `${top2.porcentaje}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 text-right mt-1">{top2.porcentaje}% de eventos</p>
                </div>
              </div>
            )}

            {/* 1er Lugar (Oro - ELEVADO EN EL CENTRO) */}
            <div className="order-1 md:order-2 flex flex-col items-center -translate-y-2">
              <div className="relative mb-3 group">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent-300 via-accent-500 to-amber-600 p-1 shadow-2xl shadow-accent-500/40 animate-pulse">
                  <div className="w-full h-full rounded-[14px] bg-surface-900 flex items-center justify-center font-black text-2xl text-accent-300">
                    {top1.nombres?.charAt(0) || '1'}
                    {top1.apellidos?.charAt(0) || ''}
                  </div>
                </div>
                <span className="absolute -top-5 inset-x-0 flex justify-center text-3xl filter drop-shadow">👑</span>
                <span className="absolute -bottom-2 -right-1 text-2xl filter drop-shadow">🥇</span>
              </div>
              <div className="text-center w-full glass rounded-2xl p-5 border-2 border-accent-400/60 bg-surface-900/90 shadow-xl shadow-accent-500/10">
                <span className="text-[11px] font-black text-accent-300 uppercase tracking-widest bg-accent-500/25 px-2.5 py-0.5 rounded-full border border-accent-400/50">
                  Líder de Asistencia
                </span>
                <h3 className="font-extrabold text-base text-accent-200 mt-2 truncate" title={top1.nombreCompleto}>
                  {top1.nombreCompleto}
                </h3>
                <p className="text-xs text-primary-200/80 mt-0.5">Base: {top1.base}</p>
                <div className="mt-4 pt-3 border-t border-accent-500/20 flex justify-between items-center text-xs">
                  <span className="text-primary-300 font-semibold">Total Asistencias:</span>
                  <span className="font-black text-lg text-accent-400">{top1.asistenciasCount}</span>
                </div>
                <div className="w-full bg-surface-950 rounded-full h-2 mt-2 overflow-hidden border border-accent-500/30">
                  <div
                    className="bg-gradient-to-r from-accent-500 to-amber-300 h-2 rounded-full"
                    style={{ width: `${top1.porcentaje}%` }}
                  />
                </div>
                <p className="text-[11px] text-accent-300 font-bold text-right mt-1">{top1.porcentaje}% asistencia perfecta</p>
              </div>
            </div>

            {/* 3er Lugar (Bronce) */}
            {top3 && (
              <div className="order-3 flex flex-col items-center">
                <div className="relative mb-3 group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-700 to-yellow-900 p-0.5 shadow-lg shadow-amber-900/20">
                    <div className="w-full h-full rounded-[14px] bg-surface-900 flex items-center justify-center font-black text-xl text-amber-500">
                      {top3.nombres?.charAt(0) || '3'}
                      {top3.apellidos?.charAt(0) || ''}
                    </div>
                  </div>
                  <span className="absolute -top-3 -right-2 text-2xl filter drop-shadow">🥉</span>
                </div>
                <div className="text-center w-full glass rounded-2xl p-4 border border-amber-600/30 bg-surface-900/80">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-amber-700/20 px-2 py-0.5 rounded-full border border-amber-600/30">
                    3° Lugar
                  </span>
                  <h3 className="font-bold text-sm text-[#f8f9f9] mt-1.5 truncate" title={top3.nombreCompleto}>
                    {top3.nombreCompleto}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Base: {top3.base}</p>
                  <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center text-xs">
                    <span className="text-slate-400">Asistencias:</span>
                    <span className="font-extrabold text-amber-300">{top3.asistenciasCount}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className="bg-amber-600 h-1.5 rounded-full" style={{ width: `${top3.porcentaje}%` }} />
                  </div>
                  <p className="text-[10px] text-amber-400 text-right mt-1">{top3.porcentaje}% de eventos</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs Selector: Ranking vs Gráficos */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('ranking')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'ranking'
                ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-surface-950 shadow-md shadow-accent-500/20'
                : 'glass text-primary-200 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>🏆</span>
            <span>Tabla de Ranking Completa ({ranking.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('graficos')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'graficos'
                ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-surface-950 shadow-md shadow-accent-500/20'
                : 'glass text-primary-200 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>📈</span>
            <span>Gráficos por Distrito y Eventos</span>
          </button>
        </div>
      </div>

      {/* VISTA 1: TABLA DE RANKING COMPLETA */}
      {activeTab === 'ranking' && (
        <div className="space-y-4">
          {/* Filtros de Ranking */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="w-full sm:w-80">
              <Input
                placeholder="Buscar por DNI, nombres, teléfono..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                icon={
                  <svg className="w-4 h-4 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedBase}
                onChange={(e) => {
                  setSelectedBase(e.target.value);
                  setCurrentPage(1);
                }}
                className="glass text-xs rounded-xl px-3 py-2.5 text-primary-100 bg-surface-900 border border-primary-400/20 focus:outline-none focus:border-accent-400 cursor-pointer"
              >
                <option value="todas">Todas las Bases / Distritos</option>
                {BASES_DISPONIBLES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <select
                value={selectedNivel}
                onChange={(e) => {
                  setSelectedNivel(e.target.value);
                  setCurrentPage(1);
                }}
                className="glass text-xs rounded-xl px-3 py-2.5 text-primary-100 bg-surface-900 border border-primary-400/20 focus:outline-none focus:border-accent-400 cursor-pointer"
              >
                <option value="todos">Todos los Militantes</option>
                <option value="con_asistencia">Solo con Asistencias</option>
                <option value="lider">Líderes de Asistencia (≥80%)</option>
                <option value="sin_asistencia">Sin Asistencias Aún</option>
              </select>
            </div>
          </div>

          {/* Tabla de Ranking */}
          <div className="glass rounded-2xl overflow-hidden border border-primary-400/20">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-surface-900/70">
                    <th className="px-4 py-3.5 text-left text-xs font-bold text-primary-200 uppercase tracking-wider w-16">
                      Puesto
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-bold text-primary-200 uppercase tracking-wider">
                      Militante
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-bold text-primary-200 uppercase tracking-wider">
                      DNI
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-bold text-primary-200 uppercase tracking-wider hidden sm:table-cell">
                      Base / Distrito
                    </th>
                    <th className="px-4 py-3.5 text-center text-xs font-bold text-primary-200 uppercase tracking-wider">
                      Asistencias
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-bold text-primary-200 uppercase tracking-wider hidden md:table-cell">
                      Concurrencia
                    </th>
                    <th className="px-4 py-3.5 text-center text-xs font-bold text-primary-200 uppercase tracking-wider">
                      Mérito Partidario
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRanking.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        No se encontraron militantes que coincidan con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    paginatedRanking.map((item) => {
                      const isGold = item.medalla === 'oro';
                      const isSilver = item.medalla === 'plata';
                      const isBronze = item.medalla === 'bronce';

                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${
                            isGold
                              ? 'bg-accent-500/10'
                              : isSilver
                              ? 'bg-slate-400/5'
                              : isBronze
                              ? 'bg-amber-900/10'
                              : ''
                          }`}
                        >
                          {/* Posición / Medalla */}
                          <td className="px-4 py-3.5 text-sm font-black">
                            <div className="flex items-center gap-1.5">
                              {isGold ? (
                                <span className="text-xl" title="1er Lugar">
                                  🥇
                                </span>
                              ) : isSilver ? (
                                <span className="text-xl" title="2do Lugar">
                                  🥈
                                </span>
                              ) : isBronze ? (
                                <span className="text-xl" title="3er Lugar">
                                  🥉
                                </span>
                              ) : (
                                <span className="w-7 h-7 rounded-lg bg-surface-900 border border-primary-400/20 text-xs font-bold text-slate-400 flex items-center justify-center">
                                  #{item.posicion}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Nombre y Avatar */}
                          <td className="px-4 py-3.5 text-sm">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                                  isGold
                                    ? 'bg-accent-500 text-surface-950 shadow-md shadow-accent-500/30'
                                    : isSilver
                                    ? 'bg-slate-300 text-slate-900'
                                    : isBronze
                                    ? 'bg-amber-700 text-white'
                                    : 'bg-primary-900/60 border border-primary-400/30 text-primary-200'
                                }`}
                              >
                                {item.nombres?.charAt(0) || ''}
                                {item.apellidos?.charAt(0) || ''}
                              </div>
                              <div>
                                <p className="font-bold text-[#f8f9f9] leading-tight">{item.nombreCompleto}</p>
                                <p className="text-[11px] text-slate-400 font-mono mt-0.5">{item.telefono}</p>
                              </div>
                            </div>
                          </td>

                          {/* DNI */}
                          <td className="px-4 py-3.5 text-sm font-mono text-primary-200">
                            {item.dni || '—'}
                          </td>

                          {/* Base */}
                          <td className="px-4 py-3.5 text-sm text-slate-300 hidden sm:table-cell">
                            {item.base || 'Sin asignar'}
                          </td>

                          {/* Asistencias */}
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-lg text-xs font-black ${
                                item.asistenciasCount > 0
                                  ? 'bg-accent-500/20 text-accent-300 border border-accent-400/30'
                                  : 'bg-surface-900 text-slate-500 border border-white/5'
                              }`}
                            >
                              {item.asistenciasCount}
                            </span>
                          </td>

                          {/* Barra de Concurrencia */}
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <div className="w-32">
                              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                <span>{item.porcentaje}%</span>
                                <span>{item.asistenciasCount} de {resumen?.totalEventos || 0}</span>
                              </div>
                              <div className="w-full bg-surface-950 rounded-full h-1.5 overflow-hidden border border-white/5">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-500 ${
                                    item.porcentaje >= 80
                                      ? 'bg-accent-400'
                                      : item.porcentaje >= 50
                                      ? 'bg-emerald-400'
                                      : item.porcentaje > 0
                                      ? 'bg-primary-400'
                                      : 'bg-transparent'
                                  }`}
                                  style={{ width: `${item.porcentaje}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Badge de Mérito */}
                          <td className="px-4 py-3.5 text-center">
                            {item.porcentaje >= 80 ? (
                              <Badge variant="gold">👑 {item.nivelCompromiso}</Badge>
                            ) : item.porcentaje >= 50 ? (
                              <Badge variant="success">⭐ {item.nivelCompromiso}</Badge>
                            ) : item.asistenciasCount > 0 ? (
                              <Badge variant="info">✓ {item.nivelCompromiso}</Badge>
                            ) : (
                              <Badge variant="default">Pendiente</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                <p className="text-xs text-slate-400">
                  Mostrando {(currentPage - 1) * itemsPerPage + 1}-
                  {Math.min(currentPage * itemsPerPage, filteredRanking.length)} de {filteredRanking.length} militantes
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all cursor-pointer"
                  >
                    ← Ant
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) page = i + 1;
                    else if (currentPage <= 3) page = i + 1;
                    else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                    else page = currentPage - 2 + i;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          currentPage === page
                            ? 'bg-accent-500 text-surface-950 shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all cursor-pointer"
                  >
                    Sig →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA 2: GRÁFICOS Y ANALÍTICA DE CONCURRENCIA */}
      {activeTab === 'graficos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico 1: Asistencia por Base / Distrito */}
          <div className="glass rounded-2xl p-6 border border-primary-400/20 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#f8f9f9]">Asistencia Acumulada por Distrito</h3>
              <p className="text-xs text-primary-200/70">Concurrencia total de militantes según su base territorial</p>
            </div>

            <div className="space-y-3.5 pt-2">
              {bases.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No hay registros de bases aún</p>
              ) : (
                bases.map((b) => {
                  const percent = Math.round((b.asistenciasCount / maxAsistenciasBase) * 100);
                  return (
                    <div key={b.nombre} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[#f8f9f9]">{b.nombre}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">({b.militantesCount} militantes)</span>
                          <span className="font-black text-accent-300">{b.asistenciasCount} asistencias</span>
                        </div>
                      </div>
                      <div className="w-full bg-surface-950 rounded-full h-2.5 overflow-hidden border border-white/5">
                        <div
                          className="bg-gradient-to-r from-primary-600 via-accent-500 to-accent-400 h-2.5 rounded-full transition-all duration-700"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Gráfico 2: Asistencia por Evento Convocado */}
          <div className="glass rounded-2xl p-6 border border-primary-400/20 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#f8f9f9]">Concurrencia por Evento</h3>
              <p className="text-xs text-primary-200/70">Cantidad de militantes que registraron su ingreso en cada evento</p>
            </div>

            <div className="space-y-3.5 pt-2">
              {eventos.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No hay eventos registrados</p>
              ) : (
                eventos.map((ev) => {
                  const percent = Math.round((ev.total_asistentes / maxAsistentesEvento) * 100);
                  const isActivo = ev.estado === 'activo';

                  return (
                    <div key={ev.id_evento} className="glass-light rounded-xl p-3 border border-white/5 space-y-2">
                      <div className="flex justify-between items-start text-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-[#f8f9f9]">{ev.titulo}</p>
                            {isActivo && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="En curso" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            📅 {ev.fecha} {ev.hora && `• ⏰ ${ev.hora}`} {ev.lugar && `• 📍 ${ev.lugar}`}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {ev.total_asistentes} presentes
                        </span>
                      </div>

                      <div className="w-full bg-surface-950 rounded-full h-2 overflow-hidden border border-white/5">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-700"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Gráfico 3: Métodos de Registro de Asistencia */}
          <div className="glass rounded-2xl p-6 border border-primary-400/20 space-y-4 lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#f8f9f9]">Métodos de Verificación de Asistencia</h3>
                <p className="text-xs text-primary-200/70">Desglose tecnológico de validación de militantes en puerta</p>
              </div>
              <span className="text-xs text-primary-300 font-semibold">
                Total: {resumen?.totalAsistencias || 0} registros
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {/* QR Puerta */}
              <div className="glass-light rounded-xl p-4 border border-accent-400/20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-500/20 text-accent-300 flex items-center justify-center text-xl">
                  📱
                </div>
                <div>
                  <p className="text-xs text-accent-300 font-semibold">Auto-escaneo QR Puerta</p>
                  <p className="text-2xl font-black text-[#f8f9f9] mt-0.5">{metodos.qr_puerta}</p>
                  <p className="text-[10px] text-slate-400">Cartel impreso con celular</p>
                </div>
              </div>

              {/* Scan Admin */}
              <div className="glass-light rounded-xl p-4 border border-emerald-400/20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xl">
                  📷
                </div>
                <div>
                  <p className="text-xs text-emerald-400 font-semibold">Escaneo de Credencial</p>
                  <p className="text-2xl font-black text-[#f8f9f9] mt-0.5">{metodos.scan_admin}</p>
                  <p className="text-[10px] text-slate-400">Pistola / Cámara de Admin</p>
                </div>
              </div>

              {/* Manual */}
              <div className="glass-light rounded-xl p-4 border border-primary-400/20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-800/40 text-primary-200 flex items-center justify-center text-xl">
                  ✍️
                </div>
                <div>
                  <p className="text-xs text-primary-200 font-semibold">Registro Manual</p>
                  <p className="text-2xl font-black text-[#f8f9f9] mt-0.5">{metodos.manual}</p>
                  <p className="text-[10px] text-slate-400">Búsqueda directa por DNI</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
