'use client';

import { useState, useEffect, FormEvent, use } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatFecha, formatHora, formatFechaParaInput } from '@/lib/formatters';
import type { Pollada, TicketPollada } from '@/types';

type EstadoBadgeProps = { estado: string };
function EstadoBadge({ estado }: EstadoBadgeProps) {
  const map: Record<string, { label: string; cls: string }> = {
    activo:     { label: 'Activo',     cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
    venta:      { label: 'En Venta',   cls: 'bg-green-500/20 text-green-300 border-green-500/40' },
    recojo:     { label: 'En Recojo',  cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    finalizado: { label: 'Finalizado', cls: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
  };
  const info = map[estado] ?? { label: estado, cls: 'bg-slate-500/20 text-slate-400 border-slate-500/40' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${info.cls}`}>
      {info.label}
    </span>
  );
}

type TicketEstadoBadge = { estado: string };
function TicketEstadoBadge({ estado }: TicketEstadoBadge) {
  const map: Record<string, { label: string; cls: string; icon: string }> = {
    comprado:   { label: 'Comprado',   cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40',   icon: '🎟' },
    verificado: { label: 'Verificado', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: '✅' },
    entregado:  { label: 'Entregado',  cls: 'bg-green-500/20 text-green-300 border-green-500/40', icon: '🍗' },
    cancelado:  { label: 'Cancelado',  cls: 'bg-red-500/20 text-red-300 border-red-500/40',       icon: '❌' },
  };
  const info = map[estado] ?? { label: estado, cls: 'bg-slate-500/20 text-slate-400 border-slate-500/40', icon: '?' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${info.cls}`}>
      {info.icon} {info.label}
    </span>
  );
}

export default function PolladaDashboardPage() {
  const { addToast } = useToast();
  const [polladas, setPolladas] = useState<Pollada[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newData, setNewData] = useState({
    titulo: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: '10:00',
    lugar: '',
    precio_ticket: '16',
    min_tickets: '2',
  });

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Pollada & { rowIndex?: number }>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Pollada | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ticket list modal
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [selectedPollada, setSelectedPollada] = useState<Pollada | null>(null);
  const [tickets, setTickets] = useState<TicketPollada[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'todos' | 'comprado' | 'verificado' | 'entregado' | 'cancelado'>('todos');

  // Compra modal (registrar venta)
  const [compraModalOpen, setCompraModalOpen] = useState(false);
  const [compraPolladaId, setCompraPolladaId] = useState('');
  const [compraPollada, setCompraPollada] = useState<Pollada | null>(null);
  const [compraDni, setCompraDni] = useState('');
  const [compraData, setCompraData] = useState({ cantidad: '2', ticketInicio: '', ticketFin: '', monto: '' });
  const [compraMilitante, setCompraMilitante] = useState<any>(null);
  const [searchingMilitante, setSearchingMilitante] = useState(false);
  const [submitingCompra, setSubmitingCompra] = useState(false);
  const [compraResult, setCompraResult] = useState<any>(null);

  useEffect(() => { loadPolladas(); }, []);

  const loadPolladas = async (forceFresh = false) => {
    if (forceFresh) setRefreshing(true); else setLoading(true);
    try {
      const url = forceFresh ? '/api/pollada?fresh=true' : '/api/pollada';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.data) {
        setPolladas(data.data);
        if (forceFresh) addToast('success', 'Lista actualizada');
      } else {
        if (!forceFresh) addToast('error', data.error || 'Error al cargar apoyadas');
      }
    } catch {
      if (!forceFresh) addToast('error', 'Error de conexión');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTickets = async (polladaId: string, forceFresh = false) => {
    setLoadingTickets(true);
    try {
      const url = forceFresh ? `/api/pollada/${polladaId}/tickets?fresh=true` : `/api/pollada/${polladaId}/tickets`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setTickets(data.data || []);
    } catch {
      addToast('error', 'Error al cargar tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newData.titulo.trim() || !newData.fecha) {
      addToast('error', 'Título y fecha son requeridos');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/pollada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newData,
          precio_ticket: parseFloat(newData.precio_ticket) || 16,
          min_tickets: parseInt(newData.min_tickets) || 2,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', '✅ Apoyada creada exitosamente');
        setCreateModalOpen(false);
        setNewData({ titulo: '', fecha: new Date().toISOString().split('T')[0], hora: '10:00', lugar: '', precio_ticket: '16', min_tickets: '2' });
        await loadPolladas(true);
      } else {
        addToast('error', data.error || 'Error al crear');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editData.id_pollada) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/pollada/${editData.id_pollada}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', 'Apoyada actualizada');
        setEditModalOpen(false);
        await loadPolladas(true);
      } else {
        addToast('error', data.error || 'Error al actualizar');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pollada/${deletingItem.id_pollada}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: deletingItem.rowIndex }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', 'Apoyada eliminada');
        setDeleteModalOpen(false);
        setDeletingItem(null);
        await loadPolladas(true);
      } else {
        addToast('error', data.error || 'Error al eliminar');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setDeleting(false);
    }
  };

  const handleChangeEstado = async (pollada: Pollada, estado: Pollada['estado']) => {
    try {
      const res = await fetch(`/api/pollada/${pollada.id_pollada}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, rowIndex: pollada.rowIndex }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Estado actualizado: ${estado}`);
        await loadPolladas(true);
      } else {
        addToast('error', data.error || 'Error al actualizar estado');
      }
    } catch {
      addToast('error', 'Error de conexión');
    }
  };

  const handleBuscarMilitante = async () => {
    const clean = compraDni.replace(/\D/g, '').trim();
    if (clean.length < 8) { addToast('error', 'Ingresa un DNI de 8 dígitos'); return; }
    setSearchingMilitante(true);
    setCompraMilitante(null);
    try {
      const res = await fetch(`/api/militantes/verificar?dni=${clean}`);
      const data = await res.json();
      if (data.success && data.found) {
        setCompraMilitante(data.data);
        // Calcular monto automáticamente
        const precio = compraPollada?.precio_ticket || 16;
        const cant = parseInt(compraData.cantidad) || 2;
        setCompraData(d => ({ ...d, monto: String(cant * precio) }));
      } else {
        addToast('error', data.error || `DNI ${clean} no encontrado en el padrón`);
      }
    } catch {
      addToast('error', 'Error al buscar militante');
    } finally {
      setSearchingMilitante(false);
    }
  };

  const handleRegistrarCompra = async (e: FormEvent) => {
    e.preventDefault();
    if (!compraMilitante || !compraPolladaId) return;
    const cleanDni = compraDni.replace(/\D/g, '').trim();
    const cantidad = parseInt(compraData.cantidad) || 0;
    const minRequired = compraPollada?.min_tickets || 2;

    if (cantidad < minRequired) {
      addToast('error', `El mínimo de tickets es ${minRequired}`);
      return;
    }

    setSubmitingCompra(true);
    try {
      const res = await fetch(`/api/pollada/${compraPolladaId}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: cleanDni,
          cantidad_tickets: cantidad,
          num_ticket_inicio: compraData.ticketInicio,
          num_ticket_fin: compraData.ticketFin,
          monto_pagado: parseFloat(compraData.monto) || cantidad * (compraPollada?.precio_ticket || 16),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCompraResult(data);
        addToast('success', data.message || 'Compra registrada');
        await loadPolladas(true);
      } else {
        addToast('error', data.error || 'Error al registrar compra');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setSubmitingCompra(false);
    }
  };

  const openCompraModal = (pollada: Pollada) => {
    setCompraPollada(pollada);
    setCompraPolladaId(pollada.id_pollada);
    setCompraDni('');
    setCompraMilitante(null);
    setCompraData({ cantidad: String(pollada.min_tickets || 2), ticketInicio: '', ticketFin: '', monto: '' });
    setCompraResult(null);
    setCompraModalOpen(true);
  };

  const openTicketModal = async (pollada: Pollada) => {
    setSelectedPollada(pollada);
    setTicketSearch('');
    setTicketFilter('todos');
    setTicketModalOpen(true);
    await loadTickets(pollada.id_pollada);
  };

  const filteredTickets = tickets.filter(t => {
    const matchFilter = ticketFilter === 'todos' || t.estado === ticketFilter;
    const matchSearch = !ticketSearch.trim() ||
      (t.dni || '').includes(ticketSearch) ||
      (t.nombres || '').toLowerCase().includes(ticketSearch.toLowerCase()) ||
      (t.apellidos || '').toLowerCase().includes(ticketSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  const statsByEstado = (tickets: TicketPollada[]) => ({
    comprado: tickets.filter(t => t.estado === 'comprado').length,
    verificado: tickets.filter(t => t.estado === 'verificado').length,
    entregado: tickets.filter(t => t.estado === 'entregado').length,
    cancelado: tickets.filter(t => t.estado === 'cancelado').length,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#f8f9f9] tracking-tight">🍗 Apoyada / Pollada</h1>
          <p className="text-sm text-primary-200/60 mt-1">
            Gestiona las apoyadas: venta de tickets, verificación en puerta y entrega en cocina
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadPolladas(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Actualizando...
              </span>
            ) : '🔄 Actualizar'}
          </Button>
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            + Nueva Apoyada
          </Button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-surface-900/60 rounded-2xl border border-primary-900/40 p-5 animate-pulse">
              <div className="h-5 bg-primary-800/40 rounded w-3/4 mb-3" />
              <div className="h-3 bg-primary-800/20 rounded w-1/2 mb-5" />
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1,2,3].map(j => <div key={j} className="h-12 bg-primary-800/20 rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      ) : polladas.length === 0 ? (
        <div className="text-center py-20 text-primary-200/50">
          <div className="text-5xl mb-3">🍗</div>
          <p className="text-lg font-semibold">No hay apoyadas registradas</p>
          <p className="text-sm mt-1">Crea la primera con el botón "+ Nueva Apoyada"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {polladas.map(p => (
            <div key={p.id_pollada} className="bg-surface-900/60 border border-primary-900/40 rounded-2xl p-5 flex flex-col gap-4 shadow-lg hover:border-primary-700/60 transition-all">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <EstadoBadge estado={p.estado} />
                    <span className="text-[10px] text-primary-400/60 font-mono">{p.id_pollada}</span>
                  </div>
                  <h3 className="font-black text-[#f8f9f9] text-base leading-tight truncate">{p.titulo}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-primary-300/60">
                    <span>📅 {formatFecha(p.fecha)}</span>
                    {p.hora && <span>🕐 {formatHora(p.hora)}</span>}
                    {p.lugar && <span>📍 {p.lugar}</span>}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface-800/60 rounded-xl p-2.5 text-center">
                  <p className="text-xl font-black text-accent-400">{p.total_tickets_vendidos ?? 0}</p>
                  <p className="text-[10px] text-primary-300/60 mt-0.5">Tickets</p>
                </div>
                <div className="bg-surface-800/60 rounded-xl p-2.5 text-center">
                  <p className="text-xl font-black text-green-400">S/.{(p.total_recaudado ?? 0).toFixed(0)}</p>
                  <p className="text-[10px] text-primary-300/60 mt-0.5">Recaudado</p>
                </div>
                <div className="bg-surface-800/60 rounded-xl p-2.5 text-center">
                  <p className="text-xl font-black text-amber-400">{p.total_entregados ?? 0}</p>
                  <p className="text-[10px] text-primary-300/60 mt-0.5">Entregados</p>
                </div>
              </div>

              {/* Price info */}
              <div className="flex items-center gap-4 text-xs text-primary-200/60 bg-surface-800/40 rounded-lg px-3 py-2">
                <span>💰 S/.{p.precio_ticket} por ticket</span>
                <span>·</span>
                <span>🎟 Mínimo {p.min_tickets} tickets</span>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="primary" onClick={() => openCompraModal(p)} className="text-xs">
                  🎟 Registrar Compra
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openTicketModal(p)} className="text-xs">
                  👁 Ver Tickets
                </Button>
                <a
                  href={`/pollada/${p.id_pollada}/verificar`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all"
                >
                  🚪 Control Puerta
                </a>
                <a
                  href={`/pollada/${p.id_pollada}/entregar`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-green-500/15 text-green-300 border border-green-500/30 hover:bg-green-500/25 transition-all"
                >
                  🍗 Cocina
                </a>
              </div>

              {/* Estado controls */}
              <div className="border-t border-primary-900/40 pt-3 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-1.5 flex-wrap">
                  {(['activo', 'venta', 'recojo', 'finalizado'] as const).filter(e => e !== p.estado).map(e => (
                    <button
                      key={e}
                      onClick={() => handleChangeEstado(p, e)}
                      className="text-[10px] px-2 py-1 rounded-lg bg-primary-800/40 text-primary-300/70 hover:text-white hover:bg-primary-700/40 transition-all font-medium capitalize cursor-pointer"
                    >
                      → {e}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditData({ ...p, fecha: formatFechaParaInput(p.fecha) });
                      setEditModalOpen(true);
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-primary-800/40 text-primary-300 hover:text-white hover:bg-primary-700/40 transition-all cursor-pointer"
                  >
                    ✏ Editar
                  </button>
                  <button
                    onClick={() => { setDeletingItem(p); setDeleteModalOpen(true); }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                  >
                    🗑 Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Crear Apoyada ── */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Nueva Apoyada / Pollada">
        <form onSubmit={handleCreate} className="space-y-4 p-1">
          <Input
            label="Nombre de la Apoyada *"
            placeholder="Ej: Gran Pollada Fuerza Tacna 2026"
            value={newData.titulo}
            onChange={e => setNewData(d => ({ ...d, titulo: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha *" type="date" value={newData.fecha} onChange={e => setNewData(d => ({ ...d, fecha: e.target.value }))} />
            <Input label="Hora" type="time" value={newData.hora} onChange={e => setNewData(d => ({ ...d, hora: e.target.value }))} />
          </div>
          <Input
            label="Lugar / Dirección"
            placeholder="Ej: Asoc. Jaime Yoshiyama Mz-A Lt-11"
            value={newData.lugar}
            onChange={e => setNewData(d => ({ ...d, lugar: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-primary-200/80 mb-1.5">Precio por ticket (S/.)</label>
              <input
                type="number"
                min="1"
                step="0.50"
                value={newData.precio_ticket}
                onChange={e => setNewData(d => ({ ...d, precio_ticket: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-800/80 border border-primary-900/40 text-[#f8f9f9] text-sm focus:outline-none focus:border-accent-500/60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-primary-200/80 mb-1.5">Mínimo de tickets</label>
              <input
                type="number"
                min="1"
                value={newData.min_tickets}
                onChange={e => setNewData(d => ({ ...d, min_tickets: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-800/80 border border-primary-900/40 text-[#f8f9f9] text-sm focus:outline-none focus:border-accent-500/60"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={submitting}>Crear Apoyada</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Editar Apoyada ── */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Editar Apoyada">
        <form onSubmit={handleEdit} className="space-y-4 p-1">
          <Input
            label="Nombre de la Apoyada *"
            value={editData.titulo || ''}
            onChange={e => setEditData(d => ({ ...d, titulo: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" type="date" value={editData.fecha || ''} onChange={e => setEditData(d => ({ ...d, fecha: e.target.value }))} />
            <Input label="Hora" type="time" value={editData.hora || ''} onChange={e => setEditData(d => ({ ...d, hora: e.target.value }))} />
          </div>
          <Input
            label="Lugar"
            value={editData.lugar || ''}
            onChange={e => setEditData(d => ({ ...d, lugar: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-primary-200/80 mb-1.5">Precio por ticket (S/.)</label>
              <input
                type="number"
                min="1"
                step="0.50"
                value={editData.precio_ticket || 16}
                onChange={e => setEditData(d => ({ ...d, precio_ticket: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-800/80 border border-primary-900/40 text-[#f8f9f9] text-sm focus:outline-none focus:border-accent-500/60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-primary-200/80 mb-1.5">Mínimo de tickets</label>
              <input
                type="number"
                min="1"
                value={editData.min_tickets || 2}
                onChange={e => setEditData(d => ({ ...d, min_tickets: parseInt(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-800/80 border border-primary-900/40 text-[#f8f9f9] text-sm focus:outline-none focus:border-accent-500/60"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-primary-200/80 mb-1.5">Estado</label>
            <select
              value={editData.estado || 'activo'}
              onChange={e => setEditData(d => ({ ...d, estado: e.target.value as any }))}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-800/80 border border-primary-900/40 text-[#f8f9f9] text-sm focus:outline-none focus:border-accent-500/60"
            >
              <option value="activo">Activo</option>
              <option value="venta">En Venta</option>
              <option value="recojo">En Recojo</option>
              <option value="finalizado">Finalizado</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={savingEdit}>Guardar Cambios</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Eliminar ── */}
      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Eliminar Apoyada">
        <div className="p-1 space-y-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <p className="text-sm text-red-300 font-semibold">⚠️ Esta acción no se puede deshacer</p>
            <p className="text-xs text-red-300/70 mt-1">
              Se eliminará la apoyada <strong>{deletingItem?.titulo}</strong> permanentemente.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleDelete} loading={deleting} className="bg-red-600 hover:bg-red-700 border-red-500">
              Sí, Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Registrar Compra ── */}
      <Modal
        isOpen={compraModalOpen}
        onClose={() => { setCompraModalOpen(false); setCompraResult(null); setCompraMilitante(null); }}
        title={`Registrar Compra — ${compraPollada?.titulo || ''}`}
      >
        <div className="p-1 space-y-4">
          {compraResult ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-400/40 flex items-center justify-center text-3xl mx-auto">✅</div>
              <div>
                <p className="text-lg font-black text-green-300">Compra Registrada</p>
                <p className="text-sm text-primary-200/70 mt-1">{compraResult.message}</p>
              </div>
              <div className="bg-surface-800/60 rounded-xl p-4 text-left space-y-2">
                <InfoRow label="Militante" value={`${compraResult.data?.nombres} ${compraResult.data?.apellidos}`} />
                <InfoRow label="DNI" value={compraResult.data?.dni} />
                <InfoRow label="Tickets" value={`${compraResult.data?.cantidad_tickets} ticket(s)`} />
                {compraResult.data?.num_ticket_inicio && (
                  <InfoRow label="N° Ticket" value={`${compraResult.data.num_ticket_inicio} → ${compraResult.data.num_ticket_fin}`} />
                )}
                <InfoRow label="Monto" value={`S/.${compraResult.data?.monto_pagado}`} />
                <InfoRow label="ID Compra" value={compraResult.data?.id_compra} mono />
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="secondary" onClick={() => { setCompraResult(null); setCompraMilitante(null); setCompraDni(''); }}>
                  Registrar otro
                </Button>
                <Button onClick={() => { setCompraModalOpen(false); setCompraResult(null); }}>Cerrar</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegistrarCompra} className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300">
                💡 Escanea el QR de la credencial del militante o ingresa su DNI manualmente
              </div>

              {/* DNI search */}
              <div>
                <label className="block text-xs font-semibold text-primary-200/80 mb-1.5">DNI del Militante</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="Ej: 48664993"
                    value={compraDni}
                    onChange={e => { setCompraDni(e.target.value.replace(/\D/g, '')); setCompraMilitante(null); }}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-surface-800/80 border border-primary-900/40 text-[#f8f9f9] text-sm focus:outline-none focus:border-accent-500/60"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleBuscarMilitante}
                    loading={searchingMilitante}
                    disabled={compraDni.length < 8}
                  >
                    Buscar
                  </Button>
                </div>
              </div>

              {/* Militante found card */}
              {compraMilitante && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 space-y-1">
                  <p className="text-xs text-green-400 font-semibold">✅ Militante encontrado</p>
                  <p className="font-black text-[#f8f9f9]">{compraMilitante.nombres} {compraMilitante.apellidos}</p>
                  <p className="text-xs text-primary-300/60">Base: {compraMilitante.base}</p>
                </div>
              )}

              {compraMilitante && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-primary-200/80 mb-1.5">
                        Cant. Tickets (mín. {compraPollada?.min_tickets || 2})
                      </label>
                      <input
                        type="number"
                        min={compraPollada?.min_tickets || 2}
                        value={compraData.cantidad}
                        onChange={e => {
                          const cant = parseInt(e.target.value) || 0;
                          const precio = compraPollada?.precio_ticket || 16;
                          setCompraData(d => ({ ...d, cantidad: e.target.value, monto: String(cant * precio) }));
                        }}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface-800/80 border border-primary-900/40 text-[#f8f9f9] text-sm focus:outline-none focus:border-accent-500/60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-primary-200/80 mb-1.5">N° Ticket Inicio</label>
                      <input
                        type="text"
                        placeholder="Ej: 2730"
                        value={compraData.ticketInicio}
                        onChange={e => setCompraData(d => ({ ...d, ticketInicio: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface-800/80 border border-primary-900/40 text-[#f8f9f9] text-sm focus:outline-none focus:border-accent-500/60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-primary-200/80 mb-1.5">N° Ticket Fin</label>
                      <input
                        type="text"
                        placeholder="Ej: 2731"
                        value={compraData.ticketFin}
                        onChange={e => setCompraData(d => ({ ...d, ticketFin: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface-800/80 border border-primary-900/40 text-[#f8f9f9] text-sm focus:outline-none focus:border-accent-500/60"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-primary-200/80 mb-1.5">Monto Pagado (S/.)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      value={compraData.monto}
                      onChange={e => setCompraData(d => ({ ...d, monto: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-surface-800/80 border border-primary-900/40 text-[#f8f9f9] text-sm focus:outline-none focus:border-accent-500/60"
                    />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <Button type="button" variant="secondary" onClick={() => setCompraModalOpen(false)}>Cancelar</Button>
                    <Button type="submit" loading={submitingCompra}>✅ Confirmar Compra</Button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </Modal>

      {/* ── Modal: Ver Tickets ── */}
      <Modal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title={`Tickets — ${selectedPollada?.titulo || ''}`}
      >
        <div className="space-y-4">
          {/* Stats */}
          {!loadingTickets && tickets.length > 0 && (() => {
            const s = statsByEstado(tickets);
            return (
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2 text-center">
                  <p className="text-lg font-black text-blue-300">{s.comprado}</p>
                  <p className="text-[10px] text-primary-400/60">Comprado</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-center">
                  <p className="text-lg font-black text-amber-300">{s.verificado}</p>
                  <p className="text-[10px] text-primary-400/60">Verificado</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2 text-center">
                  <p className="text-lg font-black text-green-300">{s.entregado}</p>
                  <p className="text-[10px] text-primary-400/60">Entregado</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-center">
                  <p className="text-lg font-black text-red-300">{s.cancelado}</p>
                  <p className="text-[10px] text-primary-400/60">Cancelado</p>
                </div>
              </div>
            );
          })()}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Buscar por DNI o nombre..."
              value={ticketSearch}
              onChange={e => setTicketSearch(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-surface-800/80 border border-primary-900/40 text-[#f8f9f9] text-sm focus:outline-none focus:border-accent-500/60"
            />
            <select
              value={ticketFilter}
              onChange={e => setTicketFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-surface-800/80 border border-primary-900/40 text-[#f8f9f9] text-sm focus:outline-none focus:border-accent-500/60"
            >
              <option value="todos">Todos</option>
              <option value="comprado">Comprado</option>
              <option value="verificado">Verificado</option>
              <option value="entregado">Entregado</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <Button size="sm" variant="secondary" onClick={() => selectedPollada && loadTickets(selectedPollada.id_pollada, true)}>
              🔄
            </Button>
          </div>

          {/* Table */}
          {loadingTickets ? (
            <div className="text-center py-8 text-primary-400/60">
              <div className="w-8 h-8 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin mx-auto mb-2" />
              Cargando tickets...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-8 text-primary-400/60">
              No hay tickets {ticketFilter !== 'todos' ? `en estado "${ticketFilter}"` : ''}
            </div>
          ) : (
            <div className="overflow-auto max-h-80">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-primary-900/40">
                    <th className="text-left py-2 px-2 text-primary-300/60 font-semibold">Militante</th>
                    <th className="text-center py-2 px-2 text-primary-300/60 font-semibold">Tkts</th>
                    <th className="text-center py-2 px-2 text-primary-300/60 font-semibold">Monto</th>
                    <th className="text-center py-2 px-2 text-primary-300/60 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map(t => (
                    <tr key={t.id_compra} className="border-b border-primary-900/20 hover:bg-primary-900/20">
                      <td className="py-2 px-2">
                        <p className="font-semibold text-[#f8f9f9]">{t.nombres} {t.apellidos}</p>
                        <p className="text-primary-400/60 font-mono">{t.dni}</p>
                        {(t.num_ticket_inicio || t.num_ticket_fin) && (
                          <p className="text-primary-400/40">N°{t.num_ticket_inicio}{t.num_ticket_fin && t.num_ticket_fin !== t.num_ticket_inicio ? `→${t.num_ticket_fin}` : ''}</p>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center font-black text-accent-400">{t.cantidad_tickets}</td>
                      <td className="py-2 px-2 text-center text-green-300">S/.{t.monto_pagado}</td>
                      <td className="py-2 px-2 text-center">
                        <TicketEstadoBadge estado={t.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-xs text-primary-400/40 text-right">
            {filteredTickets.length} resultado(s)
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | number; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-primary-300/60">{label}</span>
      <span className={`text-[#f8f9f9] font-semibold ${mono ? 'font-mono text-xs' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}
