'use client';

import { useState, useEffect, useCallback, FormEvent, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { BASES_DISPONIBLES } from '@/lib/constants';
import CarnetDigital from '@/components/CarnetDigital';
import type { Militante, StatsData } from '@/types';

type FilterStatus = 'todos' | 'en_revision' | 'completado' | 'pendiente' | 'inactivo';

function MilitantesContent() {
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Data states
  const [militantes, setMilitantes] = useState<Militante[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // Filter state
  const statusParam = searchParams.get('estado');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>(
    statusParam === 'en_revision' ? 'en_revision' : statusParam === 'inactivo' ? 'inactivo' : 'todos'
  );

  // Sync filter with URL param
  useEffect(() => {
    if (statusParam === 'en_revision') {
      setStatusFilter('en_revision');
    } else if (statusParam === 'inactivo') {
      setStatusFilter('inactivo');
    }
  }, [statusParam]);

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingMilitante, setEditingMilitante] = useState<Militante | null>(null);

  // Review / QR modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedMilitante, setSelectedMilitante] = useState<Militante | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Delete / Inactivate confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [militanteToDelete, setMilitanteToDelete] = useState<Militante | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    telefono: '',
    prefix: '+51',
    phoneDigits: '',
    nombres: '',
    apellidos: '',
    dni: '',
    base: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Consulta DNI externa (RENIEC / Decolecta) en Modal
  const [dniLoadingExternal, setDniLoadingExternal] = useState(false);
  const [dniAutofilled, setDniAutofilled] = useState(false);
  const [dniNotice, setDniNotice] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch(searchQuery);
      } else {
        loadData();
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (forceFresh = false) => {
    // 1. Cargar instantáneamente de sessionStorage si existe copia previa
    if (!forceFresh && typeof window !== 'undefined') {
      try {
        const cachedStr = sessionStorage.getItem('ft_cache_militantes');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
            setMilitantes(cached.data);
            if (cached.stats) {
              setStats(cached.stats);
              sessionStorage.setItem('ft_in_review_count', String(cached.stats.en_revision || 0));
              window.dispatchEvent(new CustomEvent('ft_stats_updated', { detail: cached.stats }));
            }
            setLoading(false); // Carga instantánea (0ms) sin esqueletos
          }
        }
      } catch {}
    }

    if (forceFresh) {
      setRefreshing(true);
    }

    // 2. Consulta unificada (datos + estadísticas en un solo viaje HTTP)
    try {
      const url = forceFresh ? '/api/militantes?fresh=true' : '/api/militantes';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setMilitantes(data.data);
        if (data.stats) {
          setStats(data.stats);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('ft_in_review_count', String(data.stats.en_revision || 0));
            window.dispatchEvent(new CustomEvent('ft_stats_updated', { detail: data.stats }));
          }
        }
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            'ft_cache_militantes',
            JSON.stringify({
              data: data.data,
              stats: data.stats,
              updatedAt: Date.now(),
            })
          );
        }
      }
    } catch {
      if (!militantes.length) {
        addToast('error', 'Error al cargar militantes');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/militantes?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setMilitantes(data.data || []);
        setCurrentPage(1);
      }
    } catch {
      addToast('error', 'Error en la búsqueda');
    } finally {
      setSearching(false);
    }
  };

  const copyRegistroLink = useCallback(() => {
    const url = `${window.location.origin}/registro`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        addToast('success', 'Enlace público de registro copiado');
      })
      .catch(() => {
        addToast('info', `Enlace: ${url}`);
      });
  }, [addToast]);

  // ---- Acciones de Aprobación / Rechazo ----
  const handleApprove = async (m: Militante) => {
    setActionLoading(true);
    try {
      const cleanPhone = m.id_whatsapp.replace(/[^\d+]/g, '');
      const res = await fetch('/api/militantes/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: m.rowIndex,
          telefono: cleanPhone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast('success', `Militante ${m.nombres} aprobado exitosamente`);
        setDetailModalOpen(false);
        await loadData(true);
      } else {
        addToast('error', data.error || 'Error al aprobar militante');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (m: Militante) => {
    if (!confirm(`¿Estás seguro de rechazar la solicitud de ${m.nombres || m.id_whatsapp}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const cleanPhone = m.id_whatsapp.replace(/[^\d+]/g, '');
      const res = await fetch('/api/militantes/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: m.rowIndex,
          telefono: cleanPhone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast('info', `Solicitud de ${m.nombres || m.id_whatsapp} rechazada`);
        setDetailModalOpen(false);
        await loadData(true);
      } else {
        addToast('error', data.error || 'Error al rechazar solicitud');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Inactivar / Reactivar / Eliminar ----
  const openDeleteModal = (m: Militante) => {
    setMilitanteToDelete(m);
    setDeleteModalOpen(true);
  };

  const handleToggleInactivo = async (m: Militante, newStatus: 'inactivo' | 'completado') => {
    setActionLoading(true);
    try {
      const cleanPhone = m.id_whatsapp.replace(/[^\d+]/g, '');
      const res = await fetch(`/api/militantes/${encodeURIComponent(cleanPhone)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: m.rowIndex,
          estado_registro: newStatus,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast(
          'success',
          newStatus === 'inactivo'
            ? `Militante ${m.nombres || m.id_whatsapp} marcado como Inactivo`
            : `Militante ${m.nombres || m.id_whatsapp} reactivado correctamente`
        );
        if (detailModalOpen && selectedMilitante) {
          setSelectedMilitante({ ...selectedMilitante, estado_registro: newStatus });
        }
        if (deleteModalOpen) {
          setDeleteModalOpen(false);
        }
        await loadData(true);
      } else {
        addToast('error', data.error || 'Error al cambiar estado del militante');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDelete = async (m: Militante) => {
    setDeleteLoading(true);
    try {
      const cleanPhone = m.id_whatsapp.replace(/[^\d+]/g, '');
      const res = await fetch(
        `/api/militantes/${encodeURIComponent(cleanPhone)}${m.rowIndex ? `?rowIndex=${m.rowIndex}` : ''}`,
        {
          method: 'DELETE',
        }
      );

      const data = await res.json();
      if (data.success) {
        addToast('success', `Registro de ${m.nombres || m.id_whatsapp} eliminado definitivamente de Google Sheets`);
        setDeleteModalOpen(false);
        setDetailModalOpen(false);
        await loadData(true);
      } else {
        addToast('error', data.error || 'Error al eliminar registro');
      }
    } catch {
      addToast('error', 'Error de conexión al eliminar');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ---- Abrir modal detalle ----
  const openDetailModal = (militante: Militante) => {
    setSelectedMilitante(militante);
    setDetailModalOpen(true);
  };

  // ---- Modal Crear / Editar ----
  const openCreateModal = () => {
    setModalMode('create');
    setEditingMilitante(null);
    setFormData({ telefono: '', prefix: '+51', phoneDigits: '', nombres: '', apellidos: '', dni: '', base: '' });
    setFormErrors({});
    setDniLoadingExternal(false);
    setDniAutofilled(false);
    setDniNotice(null);
    setModalOpen(true);
  };

  const openEditModal = (militante: Militante) => {
    setModalMode('edit');
    setEditingMilitante(militante);
    setFormData({
      telefono: militante.id_whatsapp,
      prefix: '+51',
      phoneDigits: '',
      nombres: militante.nombres || '',
      apellidos: militante.apellidos || '',
      dni: militante.dni || '',
      base: militante.base || '',
    });
    setFormErrors({});
    setDniLoadingExternal(false);
    setDniAutofilled(false);
    setDniNotice(null);
    setModalOpen(true);
  };

  // Consulta externa a RENIEC (Decolecta) para autocompletar nombres y apellidos
  const consultarDniApiModal = async (dniToSearch: string) => {
    if (dniToSearch.length !== 8) return;
    setDniLoadingExternal(true);
    setDniNotice(null);

    try {
      const res = await fetch(`/api/consulta-dni?dni=${dniToSearch}`);
      const data = await res.json();

      if (data.success && data.data) {
        setFormData((prev) => ({
          ...prev,
          nombres: data.data.nombres || prev.nombres,
          apellidos: data.data.apellidos || prev.apellidos,
        }));
        setFormErrors((prev) => ({ ...prev, nombres: '', apellidos: '' }));
        setDniAutofilled(true);
        setDniNotice(null);
        addToast('success', `Datos de RENIEC obtenidos: ${data.data.nombres} ${data.data.apellidos}`);
      } else if (data.notFound) {
        setDniNotice('DNI no encontrado en RENIEC. Ingrésalo manualmente.');
      } else {
        setDniNotice(data.error || 'No se pudo consultar RENIEC. Puedes ingresar los datos manualmente.');
      }
    } catch {
      // Continuar sin bloquear
    } finally {
      setDniLoadingExternal(false);
    }
  };

  const handleDniChangeModal = async (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 8);
    setFormData((prev) => ({ ...prev, dni: clean }));
    setFormErrors((prev) => ({ ...prev, dni: '' }));
    setDniAutofilled(false);
    setDniNotice(null);

    if (clean.length === 8) {
      await consultarDniApiModal(clean);
    }
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (modalMode === 'create' && !formData.phoneDigits.trim()) {
      errors.telefono = 'El teléfono es requerido';
    }
    if (!formData.dni || !/^\d{8}$/.test(formData.dni)) {
      errors.dni = 'DNI debe tener 8 dígitos';
    }
    if (!formData.nombres.trim()) errors.nombres = 'Requerido';
    if (!formData.apellidos.trim()) errors.apellidos = 'Requerido';
    if (!formData.base) errors.base = 'Selecciona una base';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      if (modalMode === 'create') {
        const fullPhone = `${formData.prefix} ${formData.phoneDigits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}`;
        const res = await fetch('/api/militantes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telefono: fullPhone,
            nombres: formData.nombres.trim().toUpperCase(),
            apellidos: formData.apellidos.trim().toUpperCase(),
            dni: formData.dni.trim(),
            base: formData.base,
            estado_registro: 'completado',
            canal_registro: 'Registro manual',
          }),
        });
        const data = await res.json();
        if (data.success) {
          addToast('success', 'Militante registrado correctamente');
          setModalOpen(false);
          await loadData(true);
        } else {
          addToast('error', data.error || 'Error al registrar');
        }
      } else if (editingMilitante) {
        const cleanPhone = editingMilitante.id_whatsapp.replace(/[^\d+]/g, '');
        const res = await fetch(`/api/militantes/${encodeURIComponent(cleanPhone)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rowIndex: editingMilitante.rowIndex,
            nombres: formData.nombres.trim().toUpperCase(),
            apellidos: formData.apellidos.trim().toUpperCase(),
            dni: formData.dni.trim(),
            base: formData.base,
            estado_registro: 'completado',
            canal_registro: editingMilitante.canal_registro || 'Registro manual',
          }),
        });
        const data = await res.json();
        if (data.success) {
          addToast('success', 'Militante actualizado correctamente');
          setModalOpen(false);
          await loadData(true);
        } else {
          addToast('error', data.error || 'Error al actualizar');
        }
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Filtrado en cliente ----
  const filteredMilitantes = militantes.filter((m) => {
    if (statusFilter === 'todos') return true;
    if (statusFilter === 'en_revision') return m.estado_registro === 'en_revision';
    if (statusFilter === 'completado') return m.estado_registro === 'completado';
    if (statusFilter === 'pendiente') return m.estado_registro === 'pendiente';
    if (statusFilter === 'inactivo') return m.estado_registro === 'inactivo';
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredMilitantes.length / itemsPerPage);
  const paginatedMilitantes = filteredMilitantes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const selectFilter = (newFilter: FilterStatus) => {
    setStatusFilter(newFilter);
    setCurrentPage(1);
    if (newFilter === 'en_revision') {
      router.replace('/dashboard/militantes?estado=en_revision');
    } else if (newFilter === 'inactivo') {
      router.replace('/dashboard/militantes?estado=inactivo');
    } else {
      router.replace('/dashboard/militantes');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img
            src="/logo/logo.jpg"
            alt="Logo Fuerza Tacna"
            className="w-12 h-12 rounded-xl object-cover border-2 border-accent-400/50 shadow-lg shadow-accent-500/20"
          />
          <div>
            <h1 className="text-2xl font-black text-[#f8f9f9] tracking-wide">Padrón de Militantes</h1>
            <p className="text-xs text-primary-200/80 mt-0.5">
              Gestión central de militantes y revisión de incorporaciones
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => loadData(true)}
            size="sm"
            disabled={refreshing}
            icon={
              <svg className={`w-4 h-4 text-accent-400 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          >
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </Button>
          <Button
            variant="secondary"
            onClick={copyRegistroLink}
            size="sm"
            icon={
              <svg className="w-4 h-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            }
          >
            Copiar Enlace Público
          </Button>
          <Button
            onClick={openCreateModal}
            variant="accent"
            size="sm"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Nuevo Registro
          </Button>
        </div>
      </div>

      {/* Stats Cards - INTERACTIVAS (Clic para filtrar) */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card: Total */}
          <div
            onClick={() => selectFilter('todos')}
            className={`glass-card rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] border ${
              statusFilter === 'todos'
                ? 'ring-2 ring-primary-500 glow-brand border-primary-400/40 bg-primary-900/20'
                : 'border-primary-200/10 hover:border-accent-400/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-primary-300 uppercase tracking-wider font-semibold">Total Padrón</p>
                <p className="text-3xl font-black text-[#f8f9f9] mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-900/50 border border-primary-400/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-[11px] text-primary-300/70 mt-2">Clic para ver todos</p>
          </div>

          {/* Card: En Revisión (DESTACADA EN AMARILLO) */}
          <div
            onClick={() => selectFilter('en_revision')}
            className={`glass-card rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] border ${
              statusFilter === 'en_revision'
                ? 'border-accent-400/80 bg-accent-500/15 glow-gold ring-2 ring-accent-400'
                : stats.en_revision > 0
                ? 'border-accent-500/40 bg-accent-500/10 hover:border-accent-400/60'
                : 'border-primary-200/10 hover:border-accent-400/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-accent-400 font-bold uppercase tracking-wider">En Revisión</p>
                  {stats.en_revision > 0 && (
                    <span className="w-2 h-2 rounded-full bg-accent-400 animate-ping" />
                  )}
                </div>
                <p className="text-3xl font-black text-accent-300 mt-1">{stats.en_revision}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-accent-500/20 border border-accent-400/40 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-[11px] text-accent-300/80 mt-2">
              {stats.en_revision > 0 ? '⚠️ Solicitudes por revisar' : 'Sin solicitudes pendientes'}
            </p>
          </div>

          {/* Card: Completados */}
          <div
            onClick={() => selectFilter('completado')}
            className={`glass-card rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] border ${
              statusFilter === 'completado'
                ? 'ring-2 ring-emerald-500 glow-accent border-emerald-500/40'
                : 'border-primary-200/10 hover:border-emerald-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Completados</p>
                <p className="text-3xl font-black text-emerald-400 mt-1">{stats.completados}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            {stats.total > 0 && (
              <p className="text-[11px] text-emerald-300/70 mt-2">
                {((stats.completados / stats.total) * 100).toFixed(1)}% del padrón
              </p>
            )}
          </div>

          {/* Card: Pendientes */}
          <div
            onClick={() => selectFilter('pendiente')}
            className={`glass-card rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] border ${
              statusFilter === 'pendiente'
                ? 'ring-2 ring-primary-400 glow-brand border-primary-400/40'
                : 'border-primary-200/10 hover:border-primary-400/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-primary-300 font-bold uppercase tracking-wider">Pendientes</p>
                <p className="text-3xl font-black text-primary-200 mt-1">{stats.pendientes}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-900/40 border border-primary-400/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
            </div>
            <p className="text-[11px] text-primary-300/70 mt-2">Esperando auto-registro</p>
          </div>
        </div>
      ) : null}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Pills de Filtro Rápido */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-850/90 rounded-xl border border-primary-200/15 overflow-x-auto">
          <button
            onClick={() => selectFilter('todos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'todos'
                ? 'bg-primary-600 text-[#f8f9f9] shadow-sm'
                : 'text-primary-200/70 hover:text-white hover:bg-primary-900/30'
            }`}
          >
            Todos ({militantes.length})
          </button>
          <button
            onClick={() => selectFilter('en_revision')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'en_revision'
                ? 'bg-accent-500 text-surface-950 shadow-sm'
                : 'text-accent-400 hover:text-accent-300 hover:bg-accent-500/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-accent-400" />
            En Revisión ({stats?.en_revision || 0})
          </button>
          <button
            onClick={() => selectFilter('completado')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'completado'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            Completados ({stats?.completados || 0})
          </button>
          <button
            onClick={() => selectFilter('pendiente')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'pendiente'
                ? 'bg-primary-800 text-primary-200 shadow-sm'
                : 'text-primary-300 hover:text-primary-200 hover:bg-primary-900/30'
            }`}
          >
            Pendientes ({stats?.pendientes || 0})
          </button>
          <button
            onClick={() => selectFilter('inactivo')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'inactivo'
                ? 'bg-slate-700 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Inactivos ({stats?.inactivos || 0})
          </button>
        </div>

        {/* Input Buscador */}
        <div className="flex gap-2 flex-1 max-w-md">
          <div className="flex-1 relative">
            <Input
              placeholder="Buscar por teléfono, DNI, nombres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={
                searching ? (
                  <div className="w-4 h-4 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )
              }
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => loadData(true)}
            loading={refreshing}
            icon={
              <svg
                className={`w-4 h-4 ${refreshing ? 'animate-spin text-accent-400' : 'text-primary-300'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          >
            Actualizar
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={8} />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Teléfono</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">DNI</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Nombres</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Apellidos</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Base</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMilitantes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      {searchQuery
                        ? 'No se encontraron resultados con ese criterio'
                        : statusFilter === 'en_revision'
                        ? '¡Excelente! No hay solicitudes pendientes de revisión'
                        : 'No hay militantes en esta sección'}
                    </td>
                  </tr>
                ) : (
                  paginatedMilitantes.map((m, i) => {
                    const isInReview = m.estado_registro === 'en_revision';
                    const isCompleted = m.estado_registro === 'completado';
                    const isRejected = m.estado_registro === 'rechazado';
                    const isInactive = m.estado_registro === 'inactivo';

                    return (
                      <tr
                        key={`${m.id_whatsapp}-${i}`}
                        className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                          isInReview ? 'bg-amber-500/[0.03]' : isInactive ? 'bg-slate-900/40 opacity-75' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-slate-300 font-mono">
                          {m.id_whatsapp}
                          {isInReview && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300">
                              NUEVO
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300 font-medium">{m.dni || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300 hidden sm:table-cell">{m.nombres || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300 hidden md:table-cell">{m.apellidos || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300 hidden lg:table-cell">{m.base || '—'}</td>
                        <td className="px-4 py-3">
                          {isInReview ? (
                            <Badge variant="warning" dot>
                              En Revisión
                            </Badge>
                          ) : isCompleted ? (
                            <Badge variant="success" dot>
                              Completado
                            </Badge>
                          ) : isInactive ? (
                            <Badge variant="inactivo" dot>
                              Inactivo
                            </Badge>
                          ) : isRejected ? (
                            <Badge variant="danger" dot>
                              Rechazado
                            </Badge>
                          ) : (
                            <Badge variant="info" dot>
                              Pendiente
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Si está en revisión: Botones de Aprobar y Rechazar directamente */}
                            {isInReview ? (
                              <>
                                <button
                                  onClick={() => handleApprove(m)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 transition-all cursor-pointer"
                                  title="Aprobar e incorporar al padrón"
                                >
                                  ✓ Aprobar
                                </button>
                                <button
                                  onClick={() => handleReject(m)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:bg-red-500/15 border border-red-500/20 transition-all cursor-pointer"
                                  title="Rechazar solicitud"
                                >
                                  ✕
                                </button>
                                <button
                                  onClick={() => openDetailModal(m)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                                  title="Ver detalles"
                                >
                                  👁️
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => openDetailModal(m)}
                                  className="text-primary-400 hover:text-primary-300 text-xs font-semibold px-2 py-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                  {isCompleted ? 'Credencial' : 'Detalles'}
                                </button>
                                <button
                                  onClick={() => openEditModal(m)}
                                  className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                  Editar
                                </button>
                                {/* Botón Inactivar / Reactivar */}
                                {isInactive ? (
                                  <button
                                    onClick={() => handleToggleInactivo(m, 'completado')}
                                    className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 transition-all cursor-pointer"
                                    title="Reactivar militante"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleToggleInactivo(m, 'inactivo')}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 border border-white/5 transition-all cursor-pointer"
                                    title="Marcar como Inactivo"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </button>
                                )}
                                {/* Botón Eliminar */}
                                <button
                                  onClick={() => openDeleteModal(m)}
                                  className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-all cursor-pointer"
                                  title="Eliminar registro del padrón"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
              <p className="text-xs text-slate-400">
                Mostrando {(currentPage - 1) * itemsPerPage + 1}-
                {Math.min(currentPage * itemsPerPage, filteredMilitantes.length)} de {filteredMilitantes.length}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        currentPage === page
                          ? 'bg-primary-500 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all cursor-pointer"
                >
                  Sig →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalle / Aprobación / Credencial */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={
          selectedMilitante?.estado_registro === 'en_revision'
            ? 'Revisión de Solicitud de Militante'
            : selectedMilitante?.estado_registro === 'completado'
            ? 'Credencial Oficial de Militante'
            : 'Ficha del Militante'
        }
        size="lg"
      >
        {selectedMilitante && (
          <div className="space-y-5">
            {/* Banner superior si está en revisión */}
            {selectedMilitante.estado_registro === 'en_revision' && (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-3">
                <span className="text-amber-400 text-lg leading-none mt-0.5">⚠️</span>
                <div className="text-xs text-amber-200">
                  <p className="font-semibold text-amber-300">Solicitud pendiente de aprobación</p>
                  <p className="mt-0.5">
                    Revisa los datos y decide si apruebas su incorporación oficial al padrón de Fuerza Tacna.
                  </p>
                </div>
              </div>
            )}

            {/* Credencial Digital Horizontal Oficial si está completado */}
            {selectedMilitante.estado_registro === 'completado' && selectedMilitante.dni ? (
              <div className="space-y-4">
                <CarnetDigital
                  militante={{
                    dni: selectedMilitante.dni,
                    nombres: selectedMilitante.nombres || '',
                    apellidos: selectedMilitante.apellidos || '',
                    base: selectedMilitante.base || '',
                    id_whatsapp: selectedMilitante.id_whatsapp,
                  }}
                />
              </div>
            ) : (
              /* Datos detallados para registros pendientes o en revisión */
              <div className="glass-light rounded-xl p-4 space-y-2.5 border border-white/5">
                <div className="flex justify-between text-sm py-1 border-b border-white/5">
                  <span className="text-slate-400">Teléfono:</span>
                  <span className="text-white font-mono font-medium">{selectedMilitante.id_whatsapp}</span>
                </div>
                <div className="flex justify-between text-sm py-1 border-b border-white/5">
                  <span className="text-slate-400">DNI:</span>
                  <span className="text-white font-medium">{selectedMilitante.dni || 'No registrado'}</span>
                </div>
                <div className="flex justify-between text-sm py-1 border-b border-white/5">
                  <span className="text-slate-400">Nombres y Apellidos:</span>
                  <span className="text-white font-medium">
                    {selectedMilitante.nombres} {selectedMilitante.apellidos}
                  </span>
                </div>
                <div className="flex justify-between text-sm py-1 border-b border-white/5">
                  <span className="text-slate-400">Base Asignada:</span>
                  <span className="text-white font-medium">{selectedMilitante.base || 'Sin asignar'}</span>
                </div>
                <div className="flex justify-between text-sm py-1 border-b border-white/5">
                  <span className="text-slate-400">Canal de Registro:</span>
                  <span className="text-slate-300">{selectedMilitante.canal_registro || 'Web'}</span>
                </div>
                <div className="flex justify-between text-sm py-1">
                  <span className="text-slate-400">Estado Actual:</span>
                  <Badge
                    variant={
                      selectedMilitante.estado_registro === 'completado'
                        ? 'success'
                        : selectedMilitante.estado_registro === 'en_revision'
                        ? 'warning'
                        : 'info'
                    }
                    dot
                  >
                    {selectedMilitante.estado_registro === 'completado'
                      ? 'Completado'
                      : selectedMilitante.estado_registro === 'en_revision'
                      ? 'En Revisión'
                      : 'Pendiente'}
                  </Badge>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-2.5 pt-2">
              {selectedMilitante.estado_registro === 'en_revision' ? (
                <>
                  <Button
                    type="button"
                    variant="danger"
                    loading={actionLoading}
                    onClick={() => handleReject(selectedMilitante)}
                    className="flex-1"
                  >
                    Rechazar
                  </Button>
                  <Button
                    type="button"
                    variant="accent"
                    loading={actionLoading}
                    onClick={() => handleApprove(selectedMilitante)}
                    className="flex-1"
                  >
                    ✓ Aprobar Militante
                  </Button>
                </>
              ) : (
                <>
                  {selectedMilitante.estado_registro === 'inactivo' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      loading={actionLoading}
                      onClick={() => handleToggleInactivo(selectedMilitante, 'completado')}
                      className="flex-1 text-xs"
                    >
                      ⟲ Reactivar Militante
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      loading={actionLoading}
                      onClick={() => handleToggleInactivo(selectedMilitante, 'inactivo')}
                      className="flex-1 text-xs"
                    >
                      ⏸️ Marcar Inactivo
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => openDeleteModal(selectedMilitante)}
                    className="text-xs px-3"
                  >
                    🗑️ Eliminar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDetailModalOpen(false)}
                    className="text-xs px-4"
                  >
                    Cerrar
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Crear / Editar Militante */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'create' ? 'Nuevo Registro de Militante' : 'Editar Militante'}
        size="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {modalMode === 'create' ? (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Teléfono</label>
              <div className="flex gap-2">
                <select
                  value={formData.prefix}
                  onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                  className="w-28 rounded-xl border border-white/10 bg-surface-800/80 text-slate-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                >
                  <option value="+51">🇵🇪 +51</option>
                  <option value="+56">🇨🇱 +56</option>
                </select>
                <Input
                  type="tel"
                  placeholder="912 345 678"
                  value={formData.phoneDigits}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      phoneDigits: e.target.value.replace(/\D/g, '').slice(0, 9),
                    });
                    setFormErrors({ ...formErrors, telefono: '' });
                  }}
                  error={formErrors.telefono}
                  maxLength={9}
                  className="flex-1"
                />
              </div>
            </div>
          ) : (
            <Input
              label="Teléfono"
              value={formData.telefono}
              disabled
              className="opacity-70"
            />
          )}

          <div>
            <Input
              label="DNI (8 dígitos)"
              placeholder="12345678"
              value={formData.dni}
              onChange={(e) => handleDniChangeModal(e.target.value)}
              error={formErrors.dni}
              maxLength={8}
              inputMode="numeric"
              icon={
                dniLoadingExternal ? (
                  <div className="w-4 h-4 border-2 border-accent-400/30 border-t-accent-400 rounded-full animate-spin" />
                ) : dniAutofilled ? (
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                  </svg>
                )
              }
              rightElement={
                dniLoadingExternal ? (
                  <span className="flex items-center gap-1 text-[11px] text-accent-400 font-medium bg-accent-500/10 px-2 py-0.5 rounded-md border border-accent-500/20">
                    <div className="w-2.5 h-2.5 border-2 border-accent-400/30 border-t-accent-400 rounded-full animate-spin" />
                    RENIEC...
                  </span>
                ) : dniAutofilled ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    ✓ RENIEC
                  </span>
                ) : formData.dni.length === 8 ? (
                  <button
                    type="button"
                    onClick={() => consultarDniApiModal(formData.dni)}
                    className="text-[11px] text-accent-400 hover:text-accent-300 font-bold bg-accent-500/20 hover:bg-accent-500/30 px-2 py-0.5 rounded-md transition-colors border border-accent-400/30"
                  >
                    Consultar
                  </button>
                ) : null
              }
            />

            {/* Mensaje de confirmación de autocompletado */}
            {dniAutofilled && (
              <p className="mt-1.5 text-xs text-emerald-400 flex items-center gap-1">
                <span>✓ Nombres y apellidos autocompletados con RENIEC</span>
              </p>
            )}

            {/* Aviso en caso de no encontrar */}
            {dniNotice && (
              <p className="mt-1.5 text-xs text-amber-300 flex items-center gap-1">
                <span>ℹ️ {dniNotice}</span>
              </p>
            )}
          </div>

          <Input
            label="Nombres"
            placeholder="Ej: Juan Carlos"
            value={formData.nombres}
            onChange={(e) => {
              setFormData({ ...formData, nombres: e.target.value });
              setFormErrors({ ...formErrors, nombres: '' });
            }}
            error={formErrors.nombres}
          />

          <Input
            label="Apellidos"
            placeholder="Ej: Pérez Gómez"
            value={formData.apellidos}
            onChange={(e) => {
              setFormData({ ...formData, apellidos: e.target.value });
              setFormErrors({ ...formErrors, apellidos: '' });
            }}
            error={formErrors.apellidos}
          />

          <Select
            label="Base"
            value={formData.base}
            onChange={(e) => {
              setFormData({ ...formData, base: e.target.value });
              setFormErrors({ ...formErrors, base: '' });
            }}
            error={formErrors.base}
            placeholder="Selecciona una base"
            options={BASES_DISPONIBLES.map((b) => ({ value: b, label: b }))}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" loading={submitting} className="flex-1">
              {modalMode === 'create' ? 'Registrar' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Confirmación: Inactivar vs Eliminar Definitivamente de Google Sheets */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Gestión de Baja de Militante"
        size="md"
      >
        {militanteToDelete && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
              <span className="text-xl leading-none mt-0.5">⚠️</span>
              <div className="text-xs text-red-200">
                <p className="font-bold text-red-300">
                  ¿Qué acción deseas realizar con este registro?
                </p>
                <p className="mt-1 text-slate-300">
                  Militante:{' '}
                  <span className="font-semibold text-white">
                    {[militanteToDelete.nombres, militanteToDelete.apellidos].filter(Boolean).join(' ') ||
                      militanteToDelete.id_whatsapp}
                  </span>
                  {militanteToDelete.dni && ` • DNI: ${militanteToDelete.dni}`}
                  {militanteToDelete.base && ` • Base: ${militanteToDelete.base}`}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Opción 1: Inactivar (Recomendada) */}
              <div className="glass rounded-xl p-3.5 border border-white/10 hover:border-accent-400/40 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">⏸️</span>
                      <p className="text-xs font-bold text-white">Opción 1: Marcar como Inactivo (Recomendado)</p>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Mantiene los datos en Google Sheets y el registro de asistencias, pero lo suspende del padrón activo. Puedes reactivarlo con un solo clic.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={actionLoading}
                    onClick={() => handleToggleInactivo(militanteToDelete, 'inactivo')}
                    className="shrink-0 text-xs"
                  >
                    Inactivar
                  </Button>
                </div>
              </div>

              {/* Opción 2: Eliminar definitivamente de Google Sheets */}
              <div className="glass rounded-xl p-3.5 border border-red-500/30 bg-red-950/20 hover:border-red-500/50 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🗑️</span>
                      <p className="text-xs font-bold text-red-300">Opción 2: Eliminar definitivamente de Google Sheets</p>
                    </div>
                    <p className="text-[11px] text-red-200/70 mt-1">
                      Borra permanentemente la fila en la hoja de cálculo. Esta acción no se puede deshacer.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    loading={deleteLoading}
                    onClick={() => handlePermanentDelete(militanteToDelete)}
                    className="shrink-0 text-xs"
                  >
                    Eliminar Fila
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function MilitantesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonTable rows={8} />
        </div>
      }
    >
      <MilitantesContent />
    </Suspense>
  );
}
