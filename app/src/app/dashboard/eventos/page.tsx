'use client';

import { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatFecha, formatHora, formatFechaHora, formatFechaParaInput } from '@/lib/formatters';
import type { Evento, Asistencia, Pollada, TicketPollada } from '@/types';

// Reproduce un agradable "bip" sintetizado de confirmación con Web Audio API
function playSuccessBeep() {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Nota A5
    osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.15); // Sube a E6
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch {
    // Si el navegador bloquea audio sin interacción previa, ignorar silenciosamente
  }
}

// Sonido de alerta para detección de duplicados
function playWarningBeep() {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.setValueAtTime(200, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch { }
}

export default function EventosPage() {
  const { addToast } = useToast();

  // Estados de Eventos
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [createType, setCreateType] = useState<'evento' | 'pollada'>('evento');
  const [newEventData, setNewEventData] = useState({
    titulo: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: '18:00',
    lugar: '',
  });
  const [polladaFields, setPolladaFields] = useState({
    precio_ticket: '16',
    min_tickets: '2',
    total_estimado: '1000',
    ticket_inicio_talonario: '5000',
    ticket_fin_talonario: '6000',
  });

  // Estados de Polladas
  const [polladas, setPolladas] = useState<Pollada[]>([]);
  const [loadingPolladas, setLoadingPolladas] = useState(false);
  const [eventFilter, setEventFilter] = useState<'todos' | 'eventos' | 'polladas'>('todos');

  // Pollada Seleccionada para Gestión Dedicada (Vista 3)
  const [selectedPollada, setSelectedPollada] = useState<Pollada | null>(null);
  const [polladaTab, setPolladaTab] = useState<'venta' | 'entrega' | 'padron'>('venta');
  const [polladaTickets, setPolladaTickets] = useState<TicketPollada[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Estados de Tab 1 (Venta de Tickets en Pollada)
  const [ventaDni, setVentaDni] = useState('');
  const [searchingVentaMilitante, setSearchingVentaMilitante] = useState(false);
  const [ventaMilitante, setVentaMilitante] = useState<any | null>(null);
  const [ventaTicketsExistentes, setVentaTicketsExistentes] = useState<TicketPollada | null>(null);
  const [ventaCantidad, setVentaCantidad] = useState('2');
  const [ventaTicketNumeros, setVentaTicketNumeros] = useState<string[]>(['', '']);
  const [submittingVenta, setSubmittingVenta] = useState(false);
  const [ventaSuccessResult, setVentaSuccessResult] = useState<any | null>(null);
  const [ventaScannerActive, setVentaScannerActive] = useState(false);
  const ventaScannerRef = useRef<any>(null);

  // Estados de Tab 2 (Control de Entrega y Recojo en Pollada)
  const [entregaDni, setEntregaDni] = useState('');
  const [searchingEntrega, setSearchingEntrega] = useState(false);
  const [entregaTicketResult, setEntregaTicketResult] = useState<TicketPollada | null>(null);
  const [submittingEntrega, setSubmittingEntrega] = useState(false);
  const [entregaSuccessMsg, setEntregaSuccessMsg] = useState<string | null>(null);
  const [entregaScannerActive, setEntregaScannerActive] = useState(false);
  const entregaScannerRef = useRef<any>(null);

  // Estados de Tab 3 (Padrón de Tickets)
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'todos' | 'comprado' | 'entregado'>('todos');

  // Modal de Edición de Pollada
  const [editPolladaModalOpen, setEditPolladaModalOpen] = useState(false);
  const [editingPollada, setEditingPollada] = useState<Pollada | null>(null);
  const [editPolladaData, setEditPolladaData] = useState({
    titulo: '',
    fecha: '',
    hora: '',
    lugar: '',
    precio_ticket: '16',
    min_tickets: '2',
    total_estimado: '1000',
    ticket_inicio_talonario: '5000',
    ticket_fin_talonario: '6000',
    estado: 'activo' as 'activo' | 'finalizado',
  });
  const [savingEditPollada, setSavingEditPollada] = useState(false);

  // Modal de Eliminación de Pollada
  const [deletePolladaModalOpen, setDeletePolladaModalOpen] = useState(false);
  const [polladaToDelete, setPolladaToDelete] = useState<Pollada | null>(null);
  const [deletingPollada, setDeletingPollada] = useState(false);

  // Estados para Edición de Evento General
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Evento | null>(null);
  const [editEventData, setEditEventData] = useState<{
    id_evento: string;
    titulo: string;
    fecha: string;
    hora: string;
    lugar: string;
    estado: 'activo' | 'finalizado';
  }>({
    id_evento: '',
    titulo: '',
    fecha: '',
    hora: '',
    lugar: '',
    estado: 'activo',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Estados para Eliminación de Evento General
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Evento | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);

  // Evento Seleccionado para Gestión de Asistencia de Reuniones (Vista 2)
  const [selectedEvent, setSelectedEvent] = useState<Evento | null>(null);
  const [activeTab, setActiveTab] = useState<'scan' | 'manual' | 'list'>('scan');
  const [asistentes, setAsistentes] = useState<Asistencia[]>([]);
  const [loadingAsistencia, setLoadingAsistencia] = useState(false);

  // Modal de Cartel Imprimible QR
  const [posterModalOpen, setPosterModalOpen] = useState(false);
  const [posterEvent, setPosterEvent] = useState<Evento | null>(null);

  // Modalidad 1: Escáner con Cámara (para Reuniones)
  const [scannerActive, setScannerActive] = useState(false);
  const [lastScannedResult, setLastScannedResult] = useState<{
    status: 'success' | 'already' | 'not_found' | 'error';
    message: string;
    militante?: { nombres: string; apellidos: string; dni: string; base?: string };
  } | null>(null);
  const [scanningLocked, setScanningLocked] = useState(false);
  const html5QrCodeRef = useRef<any>(null);
  const isScanningLockedRef = useRef(false);
  const lastScannedTimeRef = useRef<{ [dni: string]: number }>({});
  const selectedEventRef = useRef<Evento | null>(selectedEvent);

  useEffect(() => {
    selectedEventRef.current = selectedEvent;
  }, [selectedEvent]);

  // Modalidad 2: Búsqueda Manual de Asistencia (Reuniones)
  const [manualDni, setManualDni] = useState('');
  const [manualSearching, setManualSearching] = useState(false);
  const [manualMilitanteResult, setManualMilitanteResult] = useState<any | null>(null);
  const [manualNotFound, setManualNotFound] = useState(false);
  const [registeringManual, setRegisteringManual] = useState(false);

  // Formulario para registrar simpatizante no empadronado en puerta
  const [newDoorMilitante, setNewDoorMilitante] = useState({
    nombres: '',
    apellidos: '',
    telefono: '',
    base: '',
  });
  const [registeringDoorMilitante, setRegisteringDoorMilitante] = useState(false);

  // Cargar datos al iniciar
  useEffect(() => {
    loadEventos();
    loadPolladas();
  }, []);

  // Cargar asistentes cuando se selecciona un evento de reunión
  useEffect(() => {
    if (selectedEvent) {
      loadAsistencia(selectedEvent.id_evento);
    }
  }, [selectedEvent]);

  // Cargar tickets cuando se selecciona una pollada
  useEffect(() => {
    if (selectedPollada) {
      loadTickets(selectedPollada.id_pollada);
      // Ajustar cantidad inicial de venta al mínimo de la pollada
      const minCant = selectedPollada.min_tickets || 2;
      setVentaCantidad(String(minCant));
      const startNum = parseInt(selectedPollada.ticket_inicio_talonario || '5000') || 5000;
      const padLen = String(startNum).length;
      const initialTickets = Array.from({ length: minCant }, (_, i) => String(startNum + i).padStart(padLen, '0'));
      setVentaTicketNumeros(initialTickets);
      setVentaMilitante(null);
      setVentaDni('');
      setVentaSuccessResult(null);
      setEntregaTicketResult(null);
      setEntregaDni('');
      setEntregaSuccessMsg(null);
    }
  }, [selectedPollada]);

  // Manejo del Escáner de Cámara cuando se activa la pestaña 'scan' de reunión
  useEffect(() => {
    if (selectedEvent && activeTab === 'scan' && scannerActive) {
      startCameraScanner();
    } else {
      stopCameraScanner();
    }
    return () => {
      stopCameraScanner();
    };
  }, [selectedEvent, activeTab, scannerActive]);

  // Manejo del Escáner de Cámara para Entrega de Pollada
  useEffect(() => {
    if (selectedPollada && polladaTab === 'entrega' && entregaScannerActive) {
      startEntregaScanner();
    } else {
      stopEntregaScanner();
    }
    return () => {
      stopEntregaScanner();
    };
  }, [selectedPollada, polladaTab, entregaScannerActive]);

  // Manejo del Escáner de Cámara para Venta de Tickets en Pollada
  useEffect(() => {
    if (selectedPollada && polladaTab === 'venta' && ventaScannerActive) {
      startVentaScanner();
    } else {
      stopVentaScanner();
    }
    return () => {
      stopVentaScanner();
    };
  }, [selectedPollada, polladaTab, ventaScannerActive]);

  // ============================================
  // CARGAS DE DATOS
  // ============================================

  const loadEventos = async (forceFresh = false) => {
    if (!forceFresh && typeof window !== 'undefined') {
      try {
        const cachedStr = sessionStorage.getItem('ft_cache_eventos');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (Array.isArray(cached) && cached.length > 0) {
            setEventos(cached);
            setLoading(false);
          }
        }
      } catch { }
    }

    if (forceFresh) {
      setRefreshing(true);
    } else if (eventos.length === 0 && !sessionStorage.getItem('ft_cache_eventos')) {
      setLoading(true);
    }

    try {
      const url = forceFresh ? '/api/eventos?fresh=true' : '/api/eventos';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.data) {
        setEventos(data.data);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('ft_cache_eventos', JSON.stringify(data.data));
        }
      }
    } catch {
      if (eventos.length === 0) {
        addToast('error', 'Error al cargar la lista de eventos');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadPolladas = async (forceFresh = false) => {
    setLoadingPolladas(true);
    try {
      const url = forceFresh ? '/api/pollada?fresh=true' : '/api/pollada';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPolladas(data.data);
      }
    } catch {
      // Ignorar silenciosamente
    } finally {
      setLoadingPolladas(false);
    }
  };

  const loadTickets = async (polladaId: string, forceFresh = false) => {
    setLoadingTickets(true);
    try {
      const url = forceFresh ? `/api/pollada/${polladaId}/tickets?fresh=true` : `/api/pollada/${polladaId}/tickets`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPolladaTickets(data.data);
      }
    } catch {
      addToast('error', 'Error al cargar tickets de la pollada');
    } finally {
      setLoadingTickets(false);
    }
  };

  const loadAsistencia = async (idEvento: string, forceFresh = false) => {
    if (!forceFresh && typeof window !== 'undefined') {
      try {
        const cachedStr = sessionStorage.getItem(`ft_cache_asistencia_${idEvento}`);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (Array.isArray(cached)) {
            setAsistentes(cached);
            setLoadingAsistencia(false);
          }
        }
      } catch { }
    }

    if (!sessionStorage.getItem(`ft_cache_asistencia_${idEvento}`)) {
      setLoadingAsistencia(true);
    }

    try {
      const url = forceFresh ? `/api/eventos/${idEvento}/asistencia?fresh=true` : `/api/eventos/${idEvento}/asistencia`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.data) {
        setAsistentes(data.data);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(`ft_cache_asistencia_${idEvento}`, JSON.stringify(data.data));
        }
      }
    } catch {
      if (asistentes.length === 0) {
        addToast('error', 'Error al cargar la lista de asistencia');
      }
    } finally {
      setLoadingAsistencia(false);
    }
  };

  // ============================================
  // SEPARACIÓN DE EVENTOS Y POLLADAS
  // ============================================

  const isPollada = (item: { titulo: string; id_evento?: string; id_pollada?: string }) => {
    return (
      (item.titulo && (item.titulo.includes('[POLLADA') || item.titulo.includes('🍗'))) ||
      (item.id_evento && item.id_evento.startsWith('POL-')) ||
      (item.id_pollada && item.id_pollada.startsWith('POL-'))
    );
  };

  // Eventos puros (sin polladas)
  const regularEventos = eventos.filter((ev) => !isPollada(ev));

  // Consolidación de todas las polladas (de /api/pollada y de eventos con tag)
  const allPolladas: Pollada[] = (() => {
    const map = new Map<string, Pollada>();
    polladas.forEach((p) => map.set(p.id_pollada, p));

    eventos.forEach((ev) => {
      if (isPollada(ev)) {
        const id = ev.id_evento;
        if (!map.has(id)) {
          let precio = 16;
          const matchPrecio = ev.titulo.match(/\[POLLADA\s+S\/(\d+)\]/i);
          if (matchPrecio && matchPrecio[1]) {
            precio = parseFloat(matchPrecio[1]) || 16;
          }
          let cleanTitulo = ev.titulo
            .replace(/🍗/g, '')
            .replace(/\[POLLADA[^\]]*\]/gi, '')
            .trim();
          if (!cleanTitulo) cleanTitulo = 'POLLADA PRO-FONDOS';

          map.set(id, {
            id_pollada: id,
            titulo: cleanTitulo,
            fecha: ev.fecha,
            hora: ev.hora || '10:00',
            lugar: ev.lugar || '',
            precio_ticket: precio,
            min_tickets: 2,
            estado: ev.estado || 'activo',
            total_tickets_vendidos: 0,
            total_recaudado: 0,
            total_entregados: 0,
            total_estimado: 1000,
            ticket_inicio_talonario: '5000',
            ticket_fin_talonario: '6000',
          });
        }
      }
    });

    return Array.from(map.values());
  })();

  // ============================================
  // CREACIÓN DE EVENTO O POLLADA
  // ============================================

  const handleCreateEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!newEventData.titulo.trim() || !newEventData.fecha) {
      addToast('error', 'Título y fecha son requeridos');
      return;
    }

    setSubmittingEvent(true);
    try {
      if (createType === 'evento') {
        const res = await fetch('/api/eventos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEventData),
        });

        const data = await res.json();
        if (data.success) {
          addToast('success', 'Evento creado exitosamente');
          setCreateModalOpen(false);
          setNewEventData({
            titulo: '',
            fecha: new Date().toISOString().split('T')[0],
            hora: '18:00',
            lugar: '',
          });
          await loadEventos(true);
        } else {
          addToast('error', data.error || 'Error al crear evento');
        }
      } else {
        // createType === 'pollada'
        const res = await fetch('/api/pollada', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: newEventData.titulo,
            fecha: newEventData.fecha,
            hora: newEventData.hora,
            lugar: newEventData.lugar,
            precio_ticket: parseFloat(polladaFields.precio_ticket) || 16,
            min_tickets: parseInt(polladaFields.min_tickets) || 2,
            total_estimado: parseInt(polladaFields.total_estimado) || 1000,
            ticket_inicio_talonario: polladaFields.ticket_inicio_talonario || '5000',
            ticket_fin_talonario: polladaFields.ticket_fin_talonario || '6000',
          }),
        });

        const data = await res.json();
        if (data.success) {
          addToast('success', data.message || '🍗 Pollada creada exitosamente');
          setCreateModalOpen(false);
          setNewEventData({
            titulo: '',
            fecha: new Date().toISOString().split('T')[0],
            hora: '10:00',
            lugar: '',
          });
          setPolladaFields({
            precio_ticket: '16',
            min_tickets: '2',
            total_estimado: '1000',
            ticket_inicio_talonario: '5000',
            ticket_fin_talonario: '6000',
          });
          await Promise.all([loadEventos(true), loadPolladas(true)]);
        } else {
          addToast('error', data.error || 'Error al crear la pollada');
        }
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setSubmittingEvent(false);
    }
  };

  // ============================================
  // GESTIÓN DE POLLADA: TAB 1 (VENTA DE TICKETS)
  // ============================================

  const handleBuscarMilitanteVenta = async (dniDirecto?: string) => {
    const cleanDni = (dniDirecto || ventaDni).replace(/\D/g, '').trim();
    if (cleanDni.length < 8) {
      addToast('error', 'Ingresa un DNI de 8 dígitos');
      return;
    }

    setSearchingVentaMilitante(true);
    setVentaMilitante(null);
    setVentaTicketsExistentes(null);
    setVentaSuccessResult(null);

    try {
      const res = await fetch(`/api/militantes/verificar?dni=${cleanDni}`);
      const data = await res.json();
      if (data.success && data.found) {
        setVentaMilitante(data.data);
        playSuccessBeep();

        // Verificar si ya compró tickets en esta pollada
        const prev = polladaTickets.find((t) => t.dni === cleanDni && t.estado !== 'cancelado');
        if (prev) {
          setVentaTicketsExistentes(prev);
        }

        // Si las casillas de tickets están vacías, sugerir automáticamente los correlativos disponibles
        setVentaTicketNumeros((prevNums) => {
          const hasFilled = prevNums.some((n) => n.trim() !== '');
          if (!hasFilled) {
            return getNextSuggestedTicketNumbers(parseInt(ventaCantidad) || 2);
          }
          return prevNums;
        });
      } else {
        addToast('error', data.error || `DNI ${cleanDni} no encontrado en el padrón de militantes`);
      }
    } catch {
      addToast('error', 'Error al verificar militante');
    } finally {
      setSearchingVentaMilitante(false);
    }
  };

  // Helper para extraer la lista de números de tickets físicos de un registro
  const getTicketList = (ticket: TicketPollada): string[] => {
    if (ticket.numeros_tickets && Array.isArray(ticket.numeros_tickets) && ticket.numeros_tickets.length > 0) {
      return ticket.numeros_tickets.filter(Boolean);
    }
    const inicio = (ticket.num_ticket_inicio || '').trim();
    const fin = (ticket.num_ticket_fin || '').trim();
    if (inicio.includes(',')) {
      return inicio.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (inicio && fin && inicio !== fin) {
      const startNum = parseInt(inicio);
      const endNum = parseInt(fin);
      if (!isNaN(startNum) && !isNaN(endNum) && endNum >= startNum && endNum - startNum <= 25) {
        const list: string[] = [];
        for (let i = startNum; i <= endNum; i++) {
          list.push(String(i).padStart(inicio.length, '0'));
        }
        return list;
      }
      return [inicio, fin];
    }
    if (inicio) return [inicio];
    if (fin) return [fin];
    return [];
  };

  // Helper para sugerir los siguientes números correlativos disponibles del talonario
  const getNextSuggestedTicketNumbers = (count: number, currentTickets: TicketPollada[] = polladaTickets): string[] => {
    const allAssignedNums: number[] = [];
    currentTickets.forEach((t) => {
      if (t.estado === 'cancelado') return;
      const list = getTicketList(t);
      list.forEach((numStr) => {
        const n = parseInt(numStr.replace(/\D/g, ''));
        if (!isNaN(n)) allAssignedNums.push(n);
      });
    });

    const startTalonario = parseInt(selectedPollada?.ticket_inicio_talonario || '5000') || 5000;
    let nextNum = startTalonario;

    if (allAssignedNums.length > 0) {
      const maxAssigned = Math.max(...allAssignedNums);
      nextNum = Math.max(maxAssigned + 1, startTalonario);
    }

    const padLen = String(startTalonario).length;
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(String(nextNum + i).padStart(padLen, '0'));
    }
    return result;
  };

  // Helper para renderizar badges visuales de tickets
  const renderTicketBadges = (ticket: TicketPollada, maxVisible = 4) => {
    const list = getTicketList(ticket);
    if (list.length === 0) return <span className="text-slate-500">—</span>;
    return (
      <div className="flex flex-wrap items-center justify-center gap-1">
        {list.slice(0, maxVisible).map((num, i) => (
          <span
            key={i}
            className="px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono font-bold text-[11px]"
          >
            #{num}
          </span>
        ))}
        {list.length > maxVisible && (
          <span className="text-[10px] text-slate-400 font-mono font-bold px-1 py-0.5 rounded bg-surface-800 border border-white/5">
            +{list.length - maxVisible} más
          </span>
        )}
      </div>
    );
  };

  // Manejo sincronizado de cantidad de tickets
  const handleCantidadChange = (newCantStr: string) => {
    setVentaCantidad(newCantStr);
    const cant = Math.max(1, parseInt(newCantStr) || 1);
    setVentaTicketNumeros((prev) => {
      const next = [...prev];
      if (next.length < cant) {
        const lastVal = next[next.length - 1];
        const lastNum = parseInt(lastVal);
        const padLen = lastVal ? lastVal.length : 4;
        let counter = 1;
        while (next.length < cant) {
          if (!isNaN(lastNum)) {
            next.push(String(lastNum + counter).padStart(padLen, '0'));
            counter++;
          } else {
            // Si el anterior estaba vacío, sugerir usando el talonario
            const suggestions = getNextSuggestedTicketNumbers(cant);
            return suggestions;
          }
        }
      } else if (next.length > cant) {
        return next.slice(0, cant);
      }
      return next;
    });
  };

  // Edición individual de un número de ticket con sugerencia correlativa inteligente
  const handleTicketNumeroChange = (index: number, val: string) => {
    const cleanVal = val.trim();
    setVentaTicketNumeros((prev) => {
      const next = [...prev];
      const prevVal = next[index];
      next[index] = cleanVal;

      // Si se escribe en el Ticket #1 (index === 0) y los siguientes están vacíos o eran correlativos previos:
      if (index === 0 && cleanVal !== '') {
        const baseNum = parseInt(cleanVal);
        const prevBaseNum = parseInt(prevVal);
        if (!isNaN(baseNum)) {
          for (let i = 1; i < next.length; i++) {
            const expectedPrev = !isNaN(prevBaseNum) ? String(prevBaseNum + i).padStart(cleanVal.length, '0') : '';
            if (!next[i] || next[i] === expectedPrev) {
              next[i] = String(baseNum + i).padStart(cleanVal.length, '0');
            }
          }
        }
      }
      return next;
    });
  };

  // Rellenar correlativos automáticos a partir del Ticket #1 o sugerir el siguiente disponible del talonario
  const handleAutoFillCorrelativos = () => {
    if (ventaTicketNumeros.length === 0) return;
    const firstVal = (ventaTicketNumeros[0] || '').trim();
    const baseNum = parseInt(firstVal);
    if (isNaN(baseNum)) {
      const suggested = getNextSuggestedTicketNumbers(ventaTicketNumeros.length);
      setVentaTicketNumeros(suggested);
      addToast('success', `🎯 Correlativos sugeridos: #${suggested[0]} al #${suggested[suggested.length - 1]}`);
      return;
    }
    setVentaTicketNumeros(
      ventaTicketNumeros.map((_, i) => String(baseNum + i).padStart(firstVal.length, '0'))
    );
    addToast('success', '⚡ Correlativos completados a partir del Ticket #1');
  };

  // Limpiar casilleros de tickets
  const handleLimpiarTickets = () => {
    setVentaTicketNumeros(ventaTicketNumeros.map(() => ''));
  };

  const handleRegistrarVentaTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPollada || !ventaMilitante) return;

    const cleanDni = String(ventaMilitante.dni).replace(/\D/g, '').trim();
    const cant = parseInt(ventaCantidad) || 0;
    const minRequired = selectedPollada.min_tickets || 2;

    if (cant < minRequired) {
      addToast('error', `El mínimo de tickets requerido para esta pollada es ${minRequired}`);
      return;
    }

    // Validar que se haya ingresado el número físico de cada ticket
    const emptyIdx = ventaTicketNumeros.findIndex((n) => !n.trim());
    if (emptyIdx !== -1) {
      addToast('error', `Por favor completa el número del Ticket #${emptyIdx + 1}`);
      return;
    }

    // Validar duplicados entre los tickets de esta misma venta
    const cleanNumeros = ventaTicketNumeros.map((n) => n.trim());
    const dupIndex = cleanNumeros.findIndex((num, idx) => cleanNumeros.indexOf(num) !== idx);
    if (dupIndex !== -1) {
      addToast('error', `El número de ticket #${cleanNumeros[dupIndex]} está repetido en este registro`);
      return;
    }

    setSubmittingVenta(true);
    const montoCalculado = cant * (selectedPollada.precio_ticket || 16);

    try {
      const res = await fetch(`/api/pollada/${selectedPollada.id_pollada}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: cleanDni,
          cantidad_tickets: cant,
          numeros_tickets: cleanNumeros,
          num_ticket_inicio: cleanNumeros.join(', '),
          num_ticket_fin: cleanNumeros[cleanNumeros.length - 1],
          monto_pagado: montoCalculado,
        }),
      });

      const data = await res.json();
      if (data.success) {
        playSuccessBeep();
        addToast('success', '✅ Venta registrada exitosamente');
        setVentaSuccessResult({
          militante: ventaMilitante,
          cantidad: cant,
          tickets: cleanNumeros,
          ticketInicio: cleanNumeros.join(', '),
          ticketFin: cleanNumeros[cleanNumeros.length - 1],
          monto: montoCalculado,
        });

        // Recargar tickets y polladas para actualizar métricas en tiempo real
        await Promise.all([
          loadTickets(selectedPollada.id_pollada, true),
          loadPolladas(true),
        ]);
      } else {
        addToast('error', data.error || 'Error al registrar la venta');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setSubmittingVenta(false);
    }
  };

  const resetVentaForm = () => {
    setVentaDni('');
    setVentaMilitante(null);
    setVentaTicketsExistentes(null);
    setVentaSuccessResult(null);
    const minRequired = selectedPollada?.min_tickets || 2;
    setVentaCantidad(String(minRequired));
    setVentaTicketNumeros(getNextSuggestedTicketNumbers(minRequired));
  };

  // ============================================
  // GESTIÓN DE POLLADA: TAB 2 (CONTROL DE ENTREGA)
  // ============================================

  const handleBuscarEntrega = async (dniDirecto?: string) => {
    const cleanDni = (dniDirecto || entregaDni).replace(/\D/g, '').trim();
    if (cleanDni.length < 8) {
      addToast('error', 'Ingresa un DNI de 8 dígitos');
      return;
    }
    if (!selectedPollada) return;

    setSearchingEntrega(true);
    setEntregaTicketResult(null);
    setEntregaSuccessMsg(null);

    try {
      // Buscar primero en el listado local de tickets
      let ticket = polladaTickets.find((t) => t.dni === cleanDni && t.estado !== 'cancelado');

      if (!ticket) {
        // Si no está en memoria, consultar endpoint
        const res = await fetch(`/api/pollada/${selectedPollada.id_pollada}/tickets?fresh=true`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setPolladaTickets(data.data);
          ticket = data.data.find((t: TicketPollada) => String(t.dni).replace(/\D/g, '').trim() === cleanDni);
        }
      }

      if (ticket) {
        setEntregaTicketResult(ticket);
        if (ticket.estado === 'entregado') {
          playWarningBeep();
        } else {
          playSuccessBeep();
        }
      } else {
        addToast('warning', `El DNI ${cleanDni} no tiene compra de tickets registrada para esta pollada`);
      }
    } catch {
      addToast('error', 'Error de conexión al consultar tickets');
    } finally {
      setSearchingEntrega(false);
    }
  };

  const handleConfirmarEntregaPollada = async () => {
    if (!selectedPollada || !entregaTicketResult) return;
    setSubmittingEntrega(true);

    try {
      const res = await fetch(`/api/pollada/${selectedPollada.id_pollada}/entregar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: entregaTicketResult.dni }),
      });

      const data = await res.json();
      if (data.success) {
        playSuccessBeep();
        setEntregaSuccessMsg(`🍗 ¡Entrega confirmada para ${entregaTicketResult.nombres} ${entregaTicketResult.apellidos}! (${entregaTicketResult.cantidad_tickets} pollada(s) entregadas)`);
        setEntregaTicketResult({ ...entregaTicketResult, estado: 'entregado' });
        addToast('success', 'Entrega registrada en el sistema');

        // Actualizar listas en tiempo real
        await Promise.all([
          loadTickets(selectedPollada.id_pollada, true),
          loadPolladas(true),
        ]);
      } else {
        if (data.alreadyDelivered) {
          playWarningBeep();
        }
        addToast('error', data.error || 'Error al registrar entrega');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setSubmittingEntrega(false);
    }
  };

  // Escáner de Credencial para Entrega
  const startEntregaScanner = async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scannerId = 'entrega-cam-reader';
      const el = document.getElementById(scannerId);
      if (!el) return;

      if (entregaScannerRef.current) {
        try {
          await entregaScannerRef.current.stop();
        } catch { }
      }

      await new Promise((resolve) => setTimeout(resolve, 80));

      const scanner = new Html5Qrcode(scannerId);
      entregaScannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 240, height: 240 },
        },
        (decodedText) => {
          // Extraer DNI del código QR
          let extractedDni = '';
          const matchUrl = decodedText.match(/\/validar\/(\d{8})/);
          if (matchUrl) extractedDni = matchUrl[1];
          else if (/^\d{8}$/.test(decodedText.trim())) extractedDni = decodedText.trim();
          else {
            const matchAny = decodedText.match(/\b\d{8}\b/);
            if (matchAny) extractedDni = matchAny[0];
          }

          if (extractedDni) {
            setEntregaDni(extractedDni);
            handleBuscarEntrega(extractedDni);
          }
        },
        () => { }
      );
    } catch (err) {
      console.error('Error al activar cámara de entrega:', err);
      addToast('error', 'No se pudo activar la cámara');
      setEntregaScannerActive(false);
    }
  };

  const stopEntregaScanner = async () => {
    if (entregaScannerRef.current) {
      try {
        await entregaScannerRef.current.stop();
        entregaScannerRef.current.clear();
      } catch { }
      entregaScannerRef.current = null;
    }
  };

  // Escáner de Credencial para Venta de Tickets (Base)
  const startVentaScanner = async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scannerId = 'venta-cam-reader';
      const el = document.getElementById(scannerId);
      if (!el) return;

      if (ventaScannerRef.current) {
        try {
          await ventaScannerRef.current.stop();
        } catch { }
      }

      await new Promise((resolve) => setTimeout(resolve, 80));

      const scanner = new Html5Qrcode(scannerId);
      ventaScannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 240, height: 240 },
        },
        (decodedText) => {
          let extractedDni = '';
          const matchUrl = decodedText.match(/\/validar\/(\d{8})/);
          if (matchUrl) extractedDni = matchUrl[1];
          else if (/^\d{8}$/.test(decodedText.trim())) extractedDni = decodedText.trim();
          else {
            const matchAny = decodedText.match(/\b\d{8}\b/);
            if (matchAny) extractedDni = matchAny[0];
          }

          if (extractedDni) {
            setVentaDni(extractedDni);
            setVentaScannerActive(false);
            stopVentaScanner();
            handleBuscarMilitanteVenta(extractedDni);
          }
        },
        () => { }
      );
    } catch (err) {
      console.error('Error al activar cámara de venta:', err);
      addToast('error', 'No se pudo activar la cámara. Revisa los permisos de tu navegador.');
      setVentaScannerActive(false);
    }
  };

  const stopVentaScanner = async () => {
    if (ventaScannerRef.current) {
      try {
        await ventaScannerRef.current.stop();
        ventaScannerRef.current.clear();
      } catch { }
      ventaScannerRef.current = null;
    }
  };

  // ============================================
  // EDICIÓN Y ELIMINACIÓN DE POLLADAS
  // ============================================

  const openEditPolladaModal = (pol: Pollada) => {
    setEditingPollada(pol);
    setEditPolladaData({
      titulo: pol.titulo,
      fecha: formatFechaParaInput(pol.fecha) || new Date().toISOString().split('T')[0],
      hora: pol.hora || '10:00',
      lugar: pol.lugar || '',
      precio_ticket: String(pol.precio_ticket || 16),
      min_tickets: String(pol.min_tickets || 2),
      total_estimado: String(pol.total_estimado || 1000),
      ticket_inicio_talonario: pol.ticket_inicio_talonario || '5000',
      ticket_fin_talonario: pol.ticket_fin_talonario || '6000',
      estado: pol.estado === 'finalizado' ? 'finalizado' : 'activo',
    });
    setEditPolladaModalOpen(true);
  };

  const handleSaveEditPollada = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPollada) return;
    setSavingEditPollada(true);

    try {
      const res = await fetch(`/api/pollada/${editingPollada.id_pollada}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: editPolladaData.titulo.trim().toUpperCase(),
          fecha: editPolladaData.fecha,
          hora: editPolladaData.hora,
          lugar: editPolladaData.lugar.trim(),
          precio_ticket: parseFloat(editPolladaData.precio_ticket) || 16,
          min_tickets: parseInt(editPolladaData.min_tickets) || 2,
          total_estimado: parseInt(editPolladaData.total_estimado) || 1000,
          ticket_inicio_talonario: editPolladaData.ticket_inicio_talonario || '5000',
          ticket_fin_talonario: editPolladaData.ticket_fin_talonario || '6000',
          estado: editPolladaData.estado,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast('success', 'Pollada actualizada exitosamente');
        setEditPolladaModalOpen(false);

        if (selectedPollada?.id_pollada === editingPollada.id_pollada) {
          setSelectedPollada((prev) =>
            prev
              ? {
                ...prev,
                titulo: editPolladaData.titulo.trim().toUpperCase(),
                fecha: editPolladaData.fecha,
                hora: editPolladaData.hora,
                lugar: editPolladaData.lugar.trim(),
                precio_ticket: parseFloat(editPolladaData.precio_ticket) || 16,
                min_tickets: parseInt(editPolladaData.min_tickets) || 2,
                total_estimado: parseInt(editPolladaData.total_estimado) || 1000,
                ticket_inicio_talonario: editPolladaData.ticket_inicio_talonario || '5000',
                ticket_fin_talonario: editPolladaData.ticket_fin_talonario || '6000',
                estado: editPolladaData.estado,
              }
              : null
          );
        }

        await Promise.all([loadPolladas(true), loadEventos(true)]);
      } else {
        addToast('error', data.error || 'Error al actualizar la pollada');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setSavingEditPollada(false);
    }
  };

  const openDeletePolladaModal = (pol: Pollada) => {
    setPolladaToDelete(pol);
    setDeletePolladaModalOpen(true);
  };

  const handleDeletePollada = async () => {
    if (!polladaToDelete) return;
    setDeletingPollada(true);

    try {
      const res = await fetch(`/api/pollada/${polladaToDelete.id_pollada}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: polladaToDelete.rowIndex }),
      });

      const data = await res.json();
      if (data.success) {
        addToast('success', 'Pollada eliminada correctamente');
        setDeletePolladaModalOpen(false);

        if (selectedPollada?.id_pollada === polladaToDelete.id_pollada) {
          setSelectedPollada(null);
        }

        setPolladaToDelete(null);
        await Promise.all([loadPolladas(true), loadEventos(true)]);
      } else {
        addToast('error', data.error || 'Error al eliminar');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setDeletingPollada(false);
    }
  };

  // ============================================
  // EDICIÓN Y ELIMINACIÓN DE EVENTOS DE REUNIÓN
  // ============================================

  const handleToggleEventStatus = async (evento: Evento) => {
    const newStatus = evento.estado === 'activo' ? 'finalizado' : 'activo';
    try {
      const res = await fetch(`/api/eventos/${evento.id_evento}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        addToast('info', `Evento marcado como ${newStatus}`);
        if (selectedEvent?.id_evento === evento.id_evento) {
          setSelectedEvent({ ...selectedEvent, estado: newStatus });
        }
        await loadEventos(true);
      }
    } catch {
      addToast('error', 'Error al actualizar estado');
    }
  };

  const openPosterModal = (evento: Evento) => {
    setPosterEvent(evento);
    setPosterModalOpen(true);
  };

  const openEditModal = (evento: Evento) => {
    setEditingEvent(evento);
    setEditEventData({
      id_evento: evento.id_evento,
      titulo: evento.titulo,
      fecha: formatFechaParaInput(evento.fecha) || new Date().toISOString().split('T')[0],
      hora: formatHora(evento.hora) || '18:00',
      lugar: evento.lugar || '',
      estado: evento.estado || 'activo',
    });
    setEditModalOpen(true);
  };

  const handleSaveEditEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    setSavingEdit(true);

    try {
      const res = await fetch(`/api/eventos/${editingEvent.id_evento}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: editEventData.titulo.trim(),
          fecha: editEventData.fecha,
          hora: editEventData.hora,
          lugar: editEventData.lugar.trim(),
          estado: editEventData.estado,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast('success', 'Evento actualizado exitosamente');
        setEditModalOpen(false);

        setEventos((prev) =>
          prev.map((ev) =>
            ev.id_evento === editingEvent.id_evento
              ? {
                ...ev,
                titulo: editEventData.titulo.trim(),
                fecha: editEventData.fecha,
                hora: editEventData.hora,
                lugar: editEventData.lugar.trim(),
                estado: editEventData.estado,
              }
              : ev
          )
        );

        if (selectedEvent?.id_evento === editingEvent.id_evento) {
          setSelectedEvent((prev) =>
            prev
              ? {
                ...prev,
                titulo: editEventData.titulo.trim(),
                fecha: editEventData.fecha,
                hora: editEventData.hora,
                lugar: editEventData.lugar.trim(),
                estado: editEventData.estado,
              }
              : null
          );
        }
      } else {
        addToast('error', data.error || 'Error al actualizar evento');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteModal = (evento: Evento) => {
    setEventToDelete(evento);
    setDeleteModalOpen(true);
  };

  const handleConfirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    setDeletingEvent(true);
    try {
      const res = await fetch(`/api/eventos/${eventToDelete.id_evento}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', data.message || 'Evento eliminado correctamente');
        setDeleteModalOpen(false);
        setEventos((prev) => prev.filter((ev) => ev.id_evento !== eventToDelete.id_evento));
        if (selectedEvent?.id_evento === eventToDelete.id_evento) {
          stopCameraScanner();
          setSelectedEvent(null);
        }
        setEventToDelete(null);
      } else {
        addToast('error', data.error || 'Error al eliminar evento');
      }
    } catch {
      addToast('error', 'Error de conexión al eliminar evento');
    } finally {
      setDeletingEvent(false);
    }
  };

  // ============================================
  // ESCÁNER DE ASISTENCIA A REUNIONES (CÁMARA)
  // ============================================

  const startCameraScanner = async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scannerId = 'reader-cam';
      const el = document.getElementById(scannerId);
      if (!el) return;

      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch { }
      }

      await new Promise((resolve) => setTimeout(resolve, 80));

      const qrScanner = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = qrScanner;

      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const edgeSize = Math.min(Math.max(Math.floor(minEdge * 0.76), 200), 320);
        return { width: edgeSize, height: edgeSize };
      };

      await qrScanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: qrboxFunction,
        },
        (decodedText) => {
          handleQrDecoded(decodedText);
        },
        () => { }
      );
    } catch (err) {
      console.error('Error al iniciar cámara:', err);
      addToast('error', 'No se pudo acceder a la cámara. Revisa los permisos.');
      setScannerActive(false);
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch { }
      html5QrCodeRef.current = null;
    }
  };

  const processedDnisRef = useRef<Set<string>>(new Set());

  const handleQrDecoded = useCallback(
    async (decodedText: string) => {
      const currentEvent = selectedEventRef.current;
      if (isScanningLockedRef.current || !currentEvent) return;

      let extractedDni = '';
      const matchUrl = decodedText.match(/\/validar\/(\d{8})/);
      if (matchUrl) {
        extractedDni = matchUrl[1];
      } else if (/^\d{8}$/.test(decodedText.trim())) {
        extractedDni = decodedText.trim();
      } else {
        const fallbackMatch = decodedText.match(/\b\d{8}\b/);
        if (fallbackMatch) extractedDni = fallbackMatch[0];
      }

      if (!extractedDni) {
        setLastScannedResult({
          status: 'error',
          message: 'El código escaneado no contiene un DNI de militante válido.',
        });
        return;
      }

      if (processedDnisRef.current.has(extractedDni)) {
        const now = Date.now();
        const lastScan = lastScannedTimeRef.current[extractedDni] || 0;
        if (now - lastScan < 4000) return;

        lastScannedTimeRef.current[extractedDni] = now;
        setLastScannedResult({
          status: 'already',
          message: `DNI ${extractedDni} ya fue registrado como asistente.`,
          militante: { nombres: '', apellidos: '', dni: extractedDni },
        });
        return;
      }

      processedDnisRef.current.add(extractedDni);
      lastScannedTimeRef.current[extractedDni] = Date.now();
      playSuccessBeep();

      try {
        const res = await fetch(`/api/eventos/${currentEvent.id_evento}/asistencia`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dni: extractedDni, metodo: 'scan_admin' }),
        });
        const result = await res.json();
        if (result.success && result.data) {
          setLastScannedResult({
            status: 'success',
            message: `¡Asistencia registrada para ${result.data.nombres} ${result.data.apellidos}!`,
            militante: result.data,
          });
          loadAsistencia(currentEvent.id_evento, true);
        } else if (result.alreadyMarked) {
          setLastScannedResult({
            status: 'already',
            message: result.error || `DNI ${extractedDni} ya estaba registrado.`,
            militante: result.data,
          });
        } else {
          processedDnisRef.current.delete(extractedDni);
          setLastScannedResult({
            status: 'not_found',
            message: result.error || `DNI ${extractedDni} no figura en el padrón.`,
          });
        }
      } catch {
        processedDnisRef.current.delete(extractedDni);
        setLastScannedResult({
          status: 'error',
          message: 'Error de conexión al registrar asistencia.',
        });
      }
    },
    []
  );

  // Registro manual de asistencia a reuniones
  const handleManualSearch = async () => {
    const clean = manualDni.replace(/\D/g, '').trim();
    if (clean.length < 8) {
      addToast('error', 'Ingresa un DNI de 8 dígitos');
      return;
    }
    setManualSearching(true);
    setManualMilitanteResult(null);
    setManualNotFound(false);

    try {
      const res = await fetch(`/api/militantes/verificar?dni=${clean}`);
      const data = await res.json();
      if (data.success && data.found) {
        setManualMilitanteResult(data.data);
        playSuccessBeep();
      } else {
        setManualNotFound(true);
      }
    } catch {
      addToast('error', 'Error al buscar militante');
    } finally {
      setManualSearching(false);
    }
  };

  const handleRegisterManualAttendance = async () => {
    if (!selectedEvent || !manualMilitanteResult) return;
    setRegisteringManual(true);
    try {
      const res = await fetch(`/api/eventos/${selectedEvent.id_evento}/asistencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: manualMilitanteResult.dni, metodo: 'manual' }),
      });
      const data = await res.json();
      if (data.success) {
        playSuccessBeep();
        addToast('success', `Asistencia marcada para ${manualMilitanteResult.nombres} ${manualMilitanteResult.apellidos}`);
        setManualMilitanteResult(null);
        setManualDni('');
        await loadAsistencia(selectedEvent.id_evento, true);
      } else {
        addToast('error', data.error || 'Error al registrar asistencia');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setRegisteringManual(false);
    }
  };

  // ============================================
  // RENDER PRINCIPAL
  // ============================================

  return (
    <div className="space-y-6">
      {/* ==================================================== */}
      {/* VISTA 1: LISTADO GENERAL DE EVENTOS Y POLLADAS        */}
      {/* ==================================================== */}
      {!selectedEvent && !selectedPollada && (
        <div className="space-y-6">
          {/* Header Superior */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Eventos, Reuniones y Polladas
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Administra asambleas oficiales, reuniones de bases y actividades pro-fondos (polladas) con control en tiempo real.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  loadEventos(true);
                  loadPolladas(true);
                }}
                variant="secondary"
                size="sm"
                loading={refreshing}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                }
              >
                Actualizar
              </Button>

              <Button
                onClick={() => {
                  setCreateType('evento');
                  setCreateModalOpen(true);
                }}
                variant="accent"
                size="sm"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                + Nuevo Evento
              </Button>
            </div>
          </div>

          {/* Filtros de Pestañas: Todos, Eventos Generales, Polladas */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
            <button
              type="button"
              onClick={() => setEventFilter('todos')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                eventFilter === 'todos'
                  ? 'bg-amber-500 text-surface-950 font-black shadow-lg shadow-amber-500/20'
                  : 'bg-surface-800/80 text-slate-400 hover:text-white hover:bg-surface-700'
              }`}
            >
              Todos ({regularEventos.length + allPolladas.length})
            </button>
            <button
              type="button"
              onClick={() => setEventFilter('eventos')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                eventFilter === 'eventos'
                  ? 'bg-amber-500 text-surface-950 font-black shadow-lg shadow-amber-500/20'
                  : 'bg-surface-800/80 text-slate-400 hover:text-white hover:bg-surface-700'
              }`}
            >
              📅 Eventos y Reuniones ({regularEventos.length})
            </button>
            <button
              type="button"
              onClick={() => setEventFilter('polladas')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                eventFilter === 'polladas'
                  ? 'bg-amber-500 text-surface-950 font-black shadow-lg shadow-amber-500/20'
                  : 'bg-surface-800/80 text-slate-400 hover:text-white hover:bg-surface-700'
              }`}
            >
              🍗 Polladas ({allPolladas.length})
            </button>
          </div>

          {/* Grid de Eventos y Polladas */}
          {loading && eventos.length === 0 && polladas.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : regularEventos.length === 0 && allPolladas.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center border border-white/5 space-y-4">
              <div className="text-4xl">📅</div>
              <h3 className="text-lg font-bold text-white">No hay actividades creadas aún</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Crea tu primera reunión política o pollada pro-fondos desde el botón "+ Nuevo Evento".
              </p>
              <Button
                onClick={() => setCreateModalOpen(true)}
                variant="accent"
                size="sm"
              >
                Crear Primera Actividad
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Tarjetas de Polladas */}
              {(eventFilter === 'todos' || eventFilter === 'polladas') &&
                allPolladas.map((pol) => {
                  const isActive = pol.estado !== 'finalizado';
                  return (
                    <div
                      key={pol.id_pollada}
                      className="glass rounded-2xl p-5 border border-amber-500/40 hover:border-amber-400/80 transition-all duration-200 flex flex-col justify-between glow-accent bg-gradient-to-br from-amber-500/10 via-surface-900/60 to-surface-950 relative overflow-hidden group shadow-xl"
                    >
                      <div className="space-y-3">
                        {/* Badges superiores */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-300 border border-amber-500/50 shadow-sm">
                              🍗 Pollada Pro-Fondos
                            </span>
                            <Badge variant={isActive ? 'success' : 'default'} dot>
                              {isActive ? 'Activo' : 'Finalizado'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400 font-mono">ID: {pol.id_pollada}</span>
                            <button
                              type="button"
                              onClick={() => openEditPolladaModal(pol)}
                              className="p-1 rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-400 hover:text-amber-400 border border-white/5 transition-colors cursor-pointer"
                              title="Editar Pollada"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeletePolladaModal(pol)}
                              className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition-colors cursor-pointer"
                              title="Eliminar Pollada"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Título de la Pollada */}
                        <h3 className="text-lg font-bold text-white leading-tight">{pol.titulo}</h3>

                        {/* Fechas y Ubicación */}
                        <div className="space-y-1.5 text-xs text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400">📅</span>
                            <span>{formatFecha(pol.fecha)}</span>
                            {pol.hora && <span className="text-slate-400 font-mono">({formatHora(pol.hora)})</span>}
                          </div>
                          {pol.lugar && (
                            <div className="flex items-center gap-2 text-sky-400 truncate">
                              <span>📍</span>
                              <span className="truncate">{pol.lugar}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                            <span className="flex items-center gap-1.5">
                              <span>🎟</span> S/. {pol.precio_ticket || 16}.00 c/u (Mín. {pol.min_tickets || 2})
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 bg-surface-800/80 px-2 py-0.5 rounded border border-white/5">
                              #{pol.ticket_inicio_talonario || '5000'} - #{pol.ticket_fin_talonario || '6000'}
                            </span>
                          </div>
                        </div>

                        {/* Barra de Progreso hacia la Meta */}
                        {(() => {
                          const meta = pol.total_estimado || 1000;
                          const vendidos = pol.total_tickets_vendidos || 0;
                          const pct = Math.min(100, Math.round((vendidos / meta) * 100));
                          return (
                            <div className="p-2.5 rounded-xl bg-surface-950/60 border border-amber-500/20 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-bold">
                                <span className="text-slate-300 flex items-center gap-1">
                                  <span>🎯</span> Meta: <strong className="text-white font-mono">{meta.toLocaleString()} polladas</strong>
                                </span>
                                <span className="text-amber-400 font-mono">{vendidos} / {meta} ({pct}%)</span>
                              </div>
                              <div className="w-full h-2 bg-surface-900 rounded-full overflow-hidden border border-white/5">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.max(2, pct)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Métricas / KPIs Resumen */}
                        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-surface-950/80 border border-amber-500/20 text-center">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Vendidos</span>
                            <span className="text-base font-black text-amber-400 font-mono">
                              {pol.total_tickets_vendidos || 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Recaudado</span>
                            <span className="text-base font-black text-emerald-400 font-mono">
                              S/. {pol.total_recaudado || 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Entregados</span>
                            <span className="text-base font-black text-sky-400 font-mono">
                              {pol.total_entregados || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Botón de Acción Principal: GESTIONAR POLLADA */}
                      <div className="pt-4 mt-2 border-t border-white/10 space-y-2">
                        <Button
                          onClick={() => setSelectedPollada(pol)}
                          variant="accent"
                          className="w-full text-sm font-black py-2.5 shadow-lg shadow-amber-500/20 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-surface-950"
                          icon={
                            <span className="text-base">🍗</span>
                          }
                        >
                          Gestionar Pollada
                        </Button>
                      </div>
                    </div>
                  );
                })}

              {/* Tarjetas de Eventos Tradicionales */}
              {(eventFilter === 'todos' || eventFilter === 'eventos') &&
                regularEventos.map((ev) => {
                  const isActive = ev.estado === 'activo';
                  return (
                    <div
                      key={ev.id_evento}
                      className={`glass rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                        isActive
                          ? 'border-amber-500/30 hover:border-amber-400/60 glow-accent'
                          : 'border-white/5 opacity-80'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Badge estado y fecha */}
                        <div className="flex items-center justify-between">
                          <Badge variant={isActive ? 'success' : 'default'} dot>
                            {isActive ? 'Activo' : 'Finalizado'}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400 font-mono">ID: {ev.id_evento}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(ev);
                              }}
                              className="p-1 rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-400 hover:text-amber-400 border border-white/5 transition-colors cursor-pointer"
                              title="Editar Evento"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteModal(ev);
                              }}
                              className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition-colors cursor-pointer"
                              title="Eliminar Evento"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Título */}
                        <h3 className="text-lg font-bold text-white leading-tight">{ev.titulo}</h3>

                        {/* Datos del evento */}
                        <div className="space-y-1.5 text-xs text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400">📅</span>
                            <span>{formatFecha(ev.fecha)}</span>
                            {ev.hora && <span className="text-slate-400 font-mono">({formatHora(ev.hora)})</span>}
                          </div>
                          {ev.lugar && (
                            <div className="flex items-center gap-2 text-sky-400 truncate">
                              <span>📍</span>
                              <span className="truncate">{ev.lugar}</span>
                            </div>
                          )}
                        </div>

                        {/* Contador de Asistentes */}
                        <div className="p-3 rounded-xl bg-surface-800/80 border border-white/5 flex items-center justify-between">
                          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                            Asistentes Registrados
                          </span>
                          <span className="text-xl font-black text-amber-400 font-mono">
                            {ev.total_asistentes || 0}
                          </span>
                        </div>
                      </div>

                      {/* Botón de acción: TOMAR ASISTENCIA DE REUNIÓN */}
                      <div className="space-y-2 pt-4 mt-2 border-t border-white/5">
                        <Button
                          onClick={() => setSelectedEvent(ev)}
                          variant="accent"
                          className="w-full"
                          icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                          }
                        >
                          Tomar Asistencia
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={() => openPosterModal(ev)}
                            variant="secondary"
                            size="sm"
                            className="w-full text-xs"
                          >
                            Cartel QR
                          </Button>
                          <Button
                            onClick={() => handleToggleEventStatus(ev)}
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs text-slate-400 hover:text-white"
                          >
                            {isActive ? 'Finalizar' : 'Reactivar'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* VISTA 3: PANEL DE GESTIÓN DEDICADA DE POLLADA        */}
      {/* ==================================================== */}
      {selectedPollada && !selectedEvent && (
        <div className="space-y-6">
          {/* Header Superior del Panel de Pollada */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  stopEntregaScanner();
                  setSelectedPollada(null);
                  loadPolladas(true);
                }}
                className="p-2.5 rounded-xl bg-surface-800 text-slate-400 hover:text-white hover:bg-surface-700 transition-all cursor-pointer flex items-center gap-1 font-bold text-xs"
                title="Volver a la lista de eventos"
              >
                <span>←</span> Volver
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                    <span>🍗</span> {selectedPollada.titulo}
                  </h2>
                  <Badge variant={selectedPollada.estado !== 'finalizado' ? 'success' : 'default'} dot>
                    {selectedPollada.estado !== 'finalizado' ? 'Activo' : 'Finalizado'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  📅 {formatFecha(selectedPollada.fecha)} {selectedPollada.hora && `| ⏰ ${formatHora(selectedPollada.hora)}`}{' '}
                  {selectedPollada.lugar && `| 📍 ${selectedPollada.lugar}`} | S/. {selectedPollada.precio_ticket} c/u (Mín. {selectedPollada.min_tickets || 2}) | 🎯 Meta: <strong className="text-white">{(selectedPollada.total_estimado || 1000).toLocaleString()} polladas</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  loadTickets(selectedPollada.id_pollada, true);
                  loadPolladas(true);
                }}
                variant="secondary"
                size="sm"
                loading={loadingTickets}
              >
                Actualizar Datos
              </Button>
              <Button
                onClick={() => openEditPolladaModal(selectedPollada)}
                variant="ghost"
                size="sm"
                className="text-amber-300 hover:text-amber-200"
              >
                Editar
              </Button>
            </div>
          </div>

          {/* Banner de Meta de Ventas y Control de Talonario Físico */}
          {(() => {
            const meta = selectedPollada.total_estimado || 1000;
            const vendidos = polladaTickets.reduce((acc, t) => acc + (t.cantidad_tickets || 0), 0);
            const restantes = Math.max(0, meta - vendidos);
            const pct = Math.min(100, Math.round((vendidos / meta) * 100));
            const recaudado = polladaTickets.reduce((acc, t) => acc + (Number(t.monto_pagado) || 0), 0);
            const metaRecaudacion = meta * (selectedPollada.precio_ticket || 16);

            return (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-surface-900/90 to-surface-950 border border-amber-500/30 shadow-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black flex items-center gap-1.5">
                      <span>🎯</span> Meta Total: {meta.toLocaleString()} polladas
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-surface-800 text-slate-200 border border-white/10 text-xs font-mono font-bold flex items-center gap-1.5">
                      <span>🎟</span> Talonario Físico: #{selectedPollada.ticket_inicio_talonario || '5000'} al #{selectedPollada.ticket_fin_talonario || '6000'}
                    </span>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-300">
                    Progreso: <span className="text-amber-400 text-sm font-black">{vendidos}</span> / {meta} ({pct}%)
                  </div>
                </div>

                <div className="w-full h-3 bg-surface-950 rounded-full overflow-hidden border border-white/10 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-400 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1 border-t border-white/5">
                  <div>
                    <span className="text-slate-400 block">Restantes por Vender:</span>
                    <strong className="text-rose-300 font-mono text-xs">{restantes.toLocaleString()} polladas</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Rango Talonario:</span>
                    <strong className="text-sky-300 font-mono text-xs">#{selectedPollada.ticket_inicio_talonario || '5000'} — #{selectedPollada.ticket_fin_talonario || '6000'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Recaudado Actual:</span>
                    <strong className="text-emerald-400 font-mono text-xs">S/. {recaudado.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Meta Proyectada:</span>
                    <strong className="text-amber-300 font-mono text-xs">S/. {metaRecaudacion.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Tarjetas KPI Superiores en Tiempo Real */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <span className="text-[10px] text-amber-400 uppercase font-black tracking-wider block">
                🎟 Tickets Vendidos
              </span>
              <span className="text-2xl sm:text-3xl font-black text-white font-mono mt-1 block">
                {polladaTickets.reduce((acc, t) => acc + (t.cantidad_tickets || 0), 0)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {polladaTickets.length} compras registradas
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-[10px] text-emerald-400 uppercase font-black tracking-wider block">
                💰 Total Recaudado
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-1 block">
                S/. {polladaTickets.reduce((acc, t) => acc + (Number(t.monto_pagado) || 0), 0)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Ingresos confirmados
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30">
              <span className="text-[10px] text-sky-400 uppercase font-black tracking-wider block">
                🍗 Polladas Entregadas
              </span>
              <span className="text-2xl sm:text-3xl font-black text-sky-400 font-mono mt-1 block">
                {polladaTickets
                  .filter((t) => t.estado === 'entregado')
                  .reduce((acc, t) => acc + (t.cantidad_tickets || 0), 0)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Despachadas en cocina
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
              <span className="text-[10px] text-rose-400 uppercase font-black tracking-wider block">
                ⏳ Pendientes Recojo
              </span>
              <span className="text-2xl sm:text-3xl font-black text-rose-300 font-mono mt-1 block">
                {polladaTickets
                  .filter((t) => t.estado !== 'entregado' && t.estado !== 'cancelado')
                  .reduce((acc, t) => acc + (t.cantidad_tickets || 0), 0)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Por entregar hoy
              </span>
            </div>
          </div>

          {/* Navegación por Modalidades de Pollada */}
          <div className="flex border-b border-white/10 gap-2 overflow-x-auto">
            <button
              onClick={() => {
                setPolladaTab('venta');
                stopEntregaScanner();
              }}
              className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                polladaTab === 'venta'
                  ? 'border-amber-400 text-amber-400 font-black'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <span>🎟</span> Modalidad 1: Venta de Tickets (Base)
            </button>

            <button
              onClick={() => setPolladaTab('entrega')}
              className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                polladaTab === 'entrega'
                  ? 'border-amber-400 text-amber-400 font-black'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <span>🍗</span> Modalidad 2: Control de Entrega / Recojo (Cocina / Local)
            </button>

            <button
              onClick={() => {
                setPolladaTab('padron');
                stopEntregaScanner();
              }}
              className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                polladaTab === 'padron'
                  ? 'border-amber-400 text-amber-400 font-black'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <span>📋</span> Padrón de Tickets ({polladaTickets.length})
            </button>
          </div>

          {/* ==================================================== */}
          {/* TAB 1: VENTA Y ASIGNACIÓN DE TICKETS                 */}
          {/* ==================================================== */}
          {polladaTab === 'venta' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Columna Izquierda: Búsqueda del Militante */}
              <div className="lg:col-span-6 space-y-4">
                <div className="glass rounded-2xl p-5 border border-white/10 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>🔍</span> 1. Identificar Militante
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Escanea la credencial QR del militante con la cámara o ingresa su DNI para verificarlo en el padrón oficial.
                    </p>
                  </div>

                  {/* Opción 1: Botón para Escanear Credencial con Cámara */}
                  <div className="space-y-3">
                    <Button
                      type="button"
                      onClick={() => setVentaScannerActive(!ventaScannerActive)}
                      variant={ventaScannerActive ? 'danger' : 'accent'}
                      className="w-full text-xs font-bold py-2.5 flex items-center justify-center gap-2"
                    >
                      {ventaScannerActive ? (
                        <>
                          <span>⏹</span> Detener Escáner de Credencial
                        </>
                      ) : (
                        <>
                          <span>📷</span> Escanear Credencial QR con Cámara
                        </>
                      )}
                    </Button>

                    {/* Contenedor del Escáner de Cámara */}
                    {ventaScannerActive && (
                      <div className="rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-black p-2 space-y-2">
                        <div id="venta-cam-reader" className="w-full aspect-square max-w-xs mx-auto rounded-xl overflow-hidden" />
                        <p className="text-[11px] text-amber-300 text-center font-semibold">
                          Apunta la cámara al código QR de la credencial física o digital del militante
                        </p>
                      </div>
                    )}

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-white/10" />
                      <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                        O bien digita el DNI
                      </span>
                      <div className="flex-grow border-t border-white/10" />
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="DNI de 8 dígitos..."
                        value={ventaDni}
                        onChange={(e) => setVentaDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleBuscarMilitanteVenta();
                          }
                        }}
                        className="font-mono text-base flex-1"
                      />
                      <Button
                        onClick={() => handleBuscarMilitanteVenta()}
                        loading={searchingVentaMilitante}
                        variant="accent"
                      >
                        Buscar
                      </Button>
                    </div>
                  </div>

                  {/* Ficha del Militante Encontrado */}
                  {ventaMilitante && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-amber-400">
                          DNI: {ventaMilitante.dni}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Militante Empadronado
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-500 text-surface-950 font-black text-lg flex items-center justify-center">
                          {ventaMilitante.nombres?.charAt(0) || 'M'}
                        </div>
                        <div>
                          <h4 className="text-base font-black text-white">
                            {ventaMilitante.nombres} {ventaMilitante.apellidos}
                          </h4>
                          <p className="text-xs text-slate-400">
                            Base: <strong className="text-slate-200">{ventaMilitante.base || 'Tacna'}</strong>
                            {ventaMilitante.telefono && ` • Tel: ${ventaMilitante.telefono}`}
                          </p>
                        </div>
                      </div>

                      {/* Alerta si ya compró previamente */}
                      {ventaTicketsExistentes && (
                        <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-lg text-xs text-amber-200">
                          ℹ️ <strong>Atención:</strong> Este militante ya tiene <strong>{ventaTicketsExistentes.cantidad_tickets} tickets</strong> registrados previamente (N° {ventaTicketsExistentes.num_ticket_inicio || '—'} al {ventaTicketsExistentes.num_ticket_fin || '—'}). Puedes registrar una compra adicional abajo.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Formulario de Asignación y Cobro */}
              <div className="lg:col-span-6 space-y-4">
                <div className="glass rounded-2xl p-5 border border-white/10 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>💰</span> 2. Registro de Tickets y Cobro
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Asigna la cantidad de polladas y los números de los tickets físicos entregados.
                    </p>
                  </div>

                  {!ventaMilitante ? (
                    <div className="p-8 rounded-xl border border-dashed border-white/10 text-center text-slate-500 text-xs">
                      Primero busca y selecciona un militante en el panel izquierdo para habilitar el registro de venta.
                    </div>
                  ) : (
                    <form onSubmit={handleRegistrarVentaTicket} className="space-y-4">
                      {/* Cantidad de Tickets */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Cantidad de Tickets (Obligatorio mín. {selectedPollada.min_tickets || 2})
                        </label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              const curr = parseInt(ventaCantidad) || 2;
                              const minVal = selectedPollada.min_tickets || 2;
                              if (curr > minVal) handleCantidadChange(String(curr - 1));
                            }}
                            className="w-10 h-10 rounded-xl bg-surface-800 text-slate-200 font-black text-lg hover:bg-surface-700 transition-colors cursor-pointer flex items-center justify-center"
                          >
                            -
                          </button>
                          <Input
                            type="number"
                            min={selectedPollada.min_tickets || 2}
                            value={ventaCantidad}
                            onChange={(e) => handleCantidadChange(e.target.value)}
                            className="font-mono text-center text-lg font-black"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const curr = parseInt(ventaCantidad) || 2;
                              handleCantidadChange(String(curr + 1));
                            }}
                            className="w-10 h-10 rounded-xl bg-surface-800 text-slate-200 font-black text-lg hover:bg-surface-700 transition-colors cursor-pointer flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Asignación de Números de Tickets Físicos Individuales */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <span className="text-amber-400">🎟</span>
                            Identificación de Tickets Físicos Entregados ({ventaTicketNumeros.length})
                          </label>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                const suggested = getNextSuggestedTicketNumbers(ventaTicketNumeros.length);
                                setVentaTicketNumeros(suggested);
                                addToast('success', `🎯 Asignados correlativos #${suggested[0]} al #${suggested[suggested.length - 1]}`);
                              }}
                              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors cursor-pointer flex items-center gap-1"
                              title="Sugerir los siguientes correlativos disponibles del talonario"
                            >
                              🎯 Sugerir Siguiente
                            </button>
                            {ventaTicketNumeros.length > 1 && (
                              <button
                                type="button"
                                onClick={handleAutoFillCorrelativos}
                                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer flex items-center gap-1"
                                title="Autocompleta los números correlativos a partir del Ticket #1"
                              >
                                ⚡ Correlativos
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleLimpiarTickets}
                              className="text-[11px] font-bold text-slate-400 hover:text-rose-400 px-2 py-0.5 rounded bg-surface-800 hover:bg-surface-700 border border-white/5 transition-colors cursor-pointer"
                              title="Limpiar números"
                            >
                              🧹 Limpiar
                            </button>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400">
                          Talonario oficial <strong>#{selectedPollada.ticket_inicio_talonario || '5000'} al #{selectedPollada.ticket_fin_talonario || '6000'}</strong>. Los tickets se sugieren correlativos automáticamente. Si deseas cambiar alguno, puedes editarlo individualmente.
                        </p>

                        <div
                          className={`grid gap-2.5 max-h-64 overflow-y-auto p-1 pr-1.5 ${
                            ventaTicketNumeros.length === 1
                              ? 'grid-cols-1'
                              : ventaTicketNumeros.length === 2
                              ? 'grid-cols-1 sm:grid-cols-2'
                              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                          }`}
                        >
                          {ventaTicketNumeros.map((ticketNum, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-surface-900/90 border border-white/10 focus-within:border-amber-500/60 focus-within:ring-1 focus-within:ring-amber-500/30 transition-all space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                                  <span>🎟</span> Ticket #{idx + 1}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">Físico</span>
                              </div>
                              <Input
                                placeholder={idx === 0 ? `Ej: ${selectedPollada.ticket_inicio_talonario || '5000'}` : `Ej: ${parseInt(selectedPollada.ticket_inicio_talonario || '5000') + idx}`}
                                value={ticketNum}
                                onChange={(e) => handleTicketNumeroChange(idx, e.target.value)}
                                className="font-mono font-bold text-white text-sm py-1"
                                required
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Monto Total a Cobrar */}
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold block">
                            Total a Cobrar
                          </span>
                          <span className="text-xs text-slate-400">
                            {parseInt(ventaCantidad) || 0} tickets x S/. {selectedPollada.precio_ticket || 16}.00
                          </span>
                        </div>
                        <span className="text-2xl font-black text-emerald-400 font-mono">
                          S/. {((parseInt(ventaCantidad) || 0) * (selectedPollada.precio_ticket || 16)).toFixed(2)}
                        </span>
                      </div>

                      {/* Botón de Confirmación */}
                      <Button
                        type="submit"
                        loading={submittingVenta}
                        variant="accent"
                        className="w-full text-base font-black py-3.5 shadow-lg shadow-amber-500/20"
                      >
                        💾 Confirmar y Registrar Venta de Tickets
                      </Button>
                    </form>
                  )}

                  {/* Tarjeta de Éxito Inmediato */}
                  {ventaSuccessResult && (
                    <div className="p-4 bg-emerald-500/15 border-2 border-emerald-500/40 rounded-xl text-emerald-200 space-y-2 animate-in fade-in">
                      <div className="flex items-center gap-2 font-black text-emerald-300 text-sm">
                        <span>✅</span> ¡Venta Registrada Exitosamente!
                      </div>
                      <p className="text-xs">
                        Militante: <strong className="text-white">{ventaSuccessResult.militante.nombres} {ventaSuccessResult.militante.apellidos}</strong>
                      </p>
                      <div className="text-xs">
                        <span className="text-slate-300">Tickets asignados: </span>
                        <strong className="text-amber-300">{ventaSuccessResult.cantidad} pollada(s)</strong>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {ventaSuccessResult.tickets?.map((tkt: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold text-xs border border-amber-500/40"
                            >
                              🎟 #{tkt}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs">
                        Total cancelado: <strong className="text-emerald-300">S/. {ventaSuccessResult.monto}.00</strong>
                      </p>
                      <div className="pt-2">
                        <Button
                          type="button"
                          onClick={resetVentaForm}
                          variant="secondary"
                          size="sm"
                          className="w-full text-xs font-bold"
                        >
                          ➕ Registrar Siguiente Venta
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: CONTROL DE ENTREGA / RECOJO EN COCINA        */}
          {/* ==================================================== */}
          {polladaTab === 'entrega' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="glass rounded-2xl p-6 border border-white/10 space-y-5">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span>🍗</span> Despacho y Entrega de Polladas en Cocina
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Escanea la credencial QR del militante con la cámara o digita su DNI para comprobar su compra y confirmar la entrega.
                  </p>
                </div>

                {/* Alternador de Cámara */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setEntregaScannerActive(!entregaScannerActive)}
                    variant={entregaScannerActive ? 'accent' : 'secondary'}
                    className="flex-1 font-bold text-xs"
                  >
                    {entregaScannerActive ? '⏹ Detener Escáner Cámara' : '📷 Activar Escáner Cámara'}
                  </Button>
                </div>

                {/* Contenedor de la Cámara de Entrega */}
                {entregaScannerActive && (
                  <div className="rounded-2xl overflow-hidden border border-amber-500/40 bg-black p-2">
                    <div id="entrega-cam-reader" className="w-full aspect-square max-w-sm mx-auto rounded-xl overflow-hidden" />
                  </div>
                )}

                {/* Búsqueda Manual por DNI */}
                <div className="flex gap-2">
                  <Input
                    placeholder="DNI de 8 dígitos para verificar..."
                    value={entregaDni}
                    onChange={(e) => setEntregaDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleBuscarEntrega();
                      }
                    }}
                    className="font-mono text-base flex-1"
                  />
                  <Button
                    onClick={() => handleBuscarEntrega()}
                    loading={searchingEntrega}
                    variant="accent"
                  >
                    Verificar
                  </Button>
                </div>

                {/* Mensaje de Confirmación de Entrega */}
                {entregaSuccessMsg && (
                  <div className="p-4 bg-emerald-500/20 border-2 border-emerald-500/40 rounded-2xl text-emerald-300 font-black text-center text-sm">
                    {entregaSuccessMsg}
                  </div>
                )}

                {/* Resultado de la Verificación de Entrega */}
                {entregaTicketResult && (
                  <div
                    className={`p-6 rounded-2xl border-2 space-y-4 ${
                      entregaTicketResult.estado === 'entregado'
                        ? 'bg-rose-500/10 border-rose-500/50 text-rose-200'
                        : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200'
                    }`}
                  >
                    {/* Alerta si ya fue entregado */}
                    {entregaTicketResult.estado === 'entregado' ? (
                      <div className="space-y-2 text-center pb-2 border-b border-rose-500/30">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black bg-rose-500/30 text-rose-300 border border-rose-500/50 animate-pulse">
                          🚨 ¡ALERTA DE SEGURIDAD! POLLADA YA ENTREGADA
                        </div>
                        <h4 className="text-xl font-black text-white">
                          {entregaTicketResult.nombres} {entregaTicketResult.apellidos}
                        </h4>
                        <p className="text-xs text-rose-300">
                          Este militante <strong>YA RECOGIÓ</strong> sus {entregaTicketResult.cantidad_tickets} pollada(s).
                        </p>
                        <div className="flex justify-center my-1.5">
                          {renderTicketBadges(entregaTicketResult, 6)}
                        </div>
                        <p className="text-xs text-slate-400 font-mono">
                          Fecha de entrega previa: {entregaTicketResult.fecha_entrega || 'Registrado en sistema'}
                          {entregaTicketResult.entregado_por && ` • Entregado por: ${entregaTicketResult.entregado_por}`}
                        </p>
                        <p className="text-xs font-black text-rose-400 mt-2">
                          ❌ NO ENTREGAR OTRA VEZ (Posible duplicado)
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            DNI: {entregaTicketResult.dni}
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                            ✅ VENTA VÁLIDA — LISTO PARA ENTREGA
                          </span>
                        </div>

                        <div>
                          <h4 className="text-2xl font-black text-white">
                            {entregaTicketResult.nombres} {entregaTicketResult.apellidos}
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Base: <strong className="text-slate-200">{entregaTicketResult.base || 'Tacna'}</strong>
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-surface-950/80 border border-white/10 text-center">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">A Entregar</span>
                            <span className="text-2xl font-black text-amber-400 font-mono">
                              {entregaTicketResult.cantidad_tickets}
                            </span>
                            <span className="text-[10px] text-slate-400 block">Polladas</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tickets Físicos</span>
                            {renderTicketBadges(entregaTicketResult, 6)}
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pagado</span>
                            <span className="text-base font-black text-emerald-400 font-mono block mt-1">
                              S/. {entregaTicketResult.monto_pagado || 0}
                            </span>
                          </div>
                        </div>

                        <Button
                          onClick={handleConfirmarEntregaPollada}
                          loading={submittingEntrega}
                          variant="accent"
                          className="w-full py-4 text-base font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-surface-950 shadow-xl shadow-emerald-500/20"
                        >
                          🍗 Confirmar Entrega de {entregaTicketResult.cantidad_tickets} Pollada(s)
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: PADRÓN DE TICKETS VENDIDOS                   */}
          {/* ==================================================== */}
          {polladaTab === 'padron' && (
            <div className="glass rounded-2xl p-5 border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTicketStatusFilter('todos')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      ticketStatusFilter === 'todos'
                        ? 'bg-amber-500 text-surface-950 font-black'
                        : 'bg-surface-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos ({polladaTickets.length})
                  </button>
                  <button
                    onClick={() => setTicketStatusFilter('comprado')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      ticketStatusFilter === 'comprado'
                        ? 'bg-amber-500 text-surface-950 font-black'
                        : 'bg-surface-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🎟 Por Recoger ({polladaTickets.filter((t) => t.estado !== 'entregado' && t.estado !== 'cancelado').length})
                  </button>
                  <button
                    onClick={() => setTicketStatusFilter('entregado')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      ticketStatusFilter === 'entregado'
                        ? 'bg-amber-500 text-surface-950 font-black'
                        : 'bg-surface-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🍗 Entregados ({polladaTickets.filter((t) => t.estado === 'entregado').length})
                  </button>
                </div>

                <Input
                  placeholder="Buscar por DNI, Nombre o N° Ticket..."
                  value={ticketSearchQuery}
                  onChange={(e) => setTicketSearchQuery(e.target.value)}
                  className="max-w-xs text-xs"
                />
              </div>

              {/* Tabla de Padrón */}
              {loadingTickets ? (
                <SkeletonTable rows={6} />
              ) : polladaTickets.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  Aún no se han registrado compras de tickets para esta pollada.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-surface-900 border-b border-white/10 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="px-3 py-2.5">#</th>
                        <th className="px-3 py-2.5">DNI</th>
                        <th className="px-3 py-2.5">Militante</th>
                        <th className="px-3 py-2.5">Base</th>
                        <th className="px-3 py-2.5 text-center">Cant.</th>
                        <th className="px-3 py-2.5 text-center">N° Tickets</th>
                        <th className="px-3 py-2.5 text-right">Monto</th>
                        <th className="px-3 py-2.5 text-center">Estado</th>
                        <th className="px-3 py-2.5 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {polladaTickets
                        .filter((t) => {
                          if (ticketStatusFilter === 'comprado' && t.estado === 'entregado') return false;
                          if (ticketStatusFilter === 'entregado' && t.estado !== 'entregado') return false;
                          if (!ticketSearchQuery.trim()) return true;
                          const q = ticketSearchQuery.toLowerCase();
                          return (
                            t.dni?.toLowerCase().includes(q) ||
                            t.nombres?.toLowerCase().includes(q) ||
                            t.apellidos?.toLowerCase().includes(q) ||
                            t.num_ticket_inicio?.toLowerCase().includes(q) ||
                            t.num_ticket_fin?.toLowerCase().includes(q) ||
                            t.numeros_tickets?.some((n) => n.toLowerCase().includes(q))
                          );
                        })
                        .map((t, idx) => (
                          <tr key={t.id_compra || idx} className="hover:bg-white/[0.02]">
                            <td className="px-3 py-2.5 text-slate-500 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-mono font-bold text-white">{t.dni}</td>
                            <td className="px-3 py-2.5 font-medium text-slate-200">
                              {t.nombres} {t.apellidos}
                            </td>
                            <td className="px-3 py-2.5 text-slate-400">{t.base || 'Tacna'}</td>
                            <td className="px-3 py-2.5 text-center font-mono font-bold text-amber-400">
                              {t.cantidad_tickets}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-slate-300">
                              {renderTicketBadges(t, 5)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-400">
                              S/. {t.monto_pagado || 0}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  t.estado === 'entregado'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                {t.estado === 'entregado' ? '🍗 Entregado' : '🎟 Por Recoger'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {t.estado !== 'entregado' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEntregaDni(t.dni);
                                    setPolladaTab('entrega');
                                    handleBuscarEntrega(t.dni);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-[11px] font-bold transition-all cursor-pointer"
                                >
                                  🍗 Entregar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* VISTA 2: PANEL DE ASISTENCIA A REUNIONES (EVENTOS)    */}
      {/* ==================================================== */}
      {selectedEvent && !selectedPollada && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  stopCameraScanner();
                  setSelectedEvent(null);
                  loadEventos();
                }}
                className="p-2.5 rounded-xl bg-surface-800 text-slate-400 hover:text-white hover:bg-surface-700 transition-all cursor-pointer font-bold text-xs"
                title="Volver a la lista de eventos"
              >
                ← Volver
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{selectedEvent.titulo}</h2>
                  <Badge variant={selectedEvent.estado === 'activo' ? 'success' : 'default'} dot>
                    {selectedEvent.estado === 'activo' ? 'Activo' : 'Finalizado'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  📅 {formatFecha(selectedEvent.fecha)} {selectedEvent.hora && `| ⏰ ${formatHora(selectedEvent.hora)}`}{' '}
                  {selectedEvent.lugar && `| 📍 ${selectedEvent.lugar}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-center">
                <span className="text-[10px] text-amber-400 uppercase tracking-widest block font-bold">
                  Total Presentes
                </span>
                <span className="text-2xl font-black text-white font-mono">{asistentes.length}</span>
              </div>
              <Button
                onClick={() => loadAsistencia(selectedEvent.id_evento, true)}
                variant="secondary"
                size="sm"
                loading={loadingAsistencia}
              >
                Actualizar
              </Button>
              <Button
                onClick={() => openPosterModal(selectedEvent)}
                variant="secondary"
                size="sm"
              >
                Cartel Puerta
              </Button>
            </div>
          </div>

          {/* Navegación por pestañas de asistencia */}
          <div className="flex border-b border-white/10 gap-2">
            <button
              onClick={() => setActiveTab('scan')}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'scan'
                  ? 'border-amber-400 text-amber-400 font-black'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <span>🪪</span> Modalidad 1: Escáner Carnets
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'manual'
                  ? 'border-amber-400 text-amber-400 font-black'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <span>✍️</span> Modalidad 2: Registro Manual
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'list'
                  ? 'border-amber-400 text-amber-400 font-black'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <span>📋</span> Lista de Asistentes ({asistentes.length})
            </button>
          </div>

          {/* Modalidad 1: Escáner con Cámara */}
          {activeTab === 'scan' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                <div className="glass rounded-2xl p-5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">Escáner de Credenciales de Militantes</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Apunta la cámara al código QR de la credencial digital o física del militante
                      </p>
                    </div>
                    <Button
                      onClick={() => setScannerActive(!scannerActive)}
                      variant={scannerActive ? 'danger' : 'accent'}
                      size="sm"
                    >
                      {scannerActive ? 'Detener' : 'Iniciar Cámara'}
                    </Button>
                  </div>

                  <div className="rounded-2xl overflow-hidden border border-white/10 bg-black min-h-[300px] flex items-center justify-center relative">
                    <div id="reader-cam" className="w-full aspect-square max-w-sm rounded-xl overflow-hidden" />
                    {!scannerActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-950/90 text-slate-400 space-y-3">
                        <span className="text-3xl">📹</span>
                        <p className="text-xs">La cámara está desactivada</p>
                        <Button onClick={() => setScannerActive(true)} variant="accent" size="sm">
                          Activar Cámara
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4">
                {lastScannedResult && (
                  <div
                    className={`p-5 rounded-2xl border-2 space-y-3 ${
                      lastScannedResult.status === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                        : lastScannedResult.status === 'already'
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                          : 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                    }`}
                  >
                    <div className="font-bold text-sm">
                      {lastScannedResult.status === 'success' && '✅ ASISTENCIA REGISTRADA'}
                      {lastScannedResult.status === 'already' && '⚠️ ASISTENCIA PREVIA'}
                      {lastScannedResult.status === 'not_found' && '❌ NO REGISTRADO'}
                      {lastScannedResult.status === 'error' && '❌ ERROR'}
                    </div>
                    <p className="text-xs">{lastScannedResult.message}</p>
                    {lastScannedResult.militante && (
                      <div className="p-3 bg-black/30 rounded-xl text-xs space-y-1">
                        <p className="font-bold text-white">
                          {lastScannedResult.militante.nombres} {lastScannedResult.militante.apellidos}
                        </p>
                        <p className="font-mono text-slate-400">DNI: {lastScannedResult.militante.dni}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="glass rounded-2xl p-5 border border-white/10 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Últimos Asistentes</h4>
                  {asistentes.slice(0, 5).map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                      <span className="text-white font-medium">{a.nombres} {a.apellidos}</span>
                      <span className="text-slate-400 font-mono">{formatFechaHora(a.fecha_hora)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Modalidad 2: Registro Manual */}
          {activeTab === 'manual' && (
            <div className="max-w-xl mx-auto space-y-4">
              <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
                <h3 className="text-base font-bold text-white">Búsqueda y Registro Manual</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ingresa DNI de 8 dígitos..."
                    value={manualDni}
                    onChange={(e) => setManualDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleManualSearch();
                      }
                    }}
                    className="font-mono text-base flex-1"
                  />
                  <Button onClick={handleManualSearch} loading={manualSearching} variant="accent">
                    Buscar
                  </Button>
                </div>

                {manualMilitanteResult && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                    <p className="text-xs text-emerald-400 font-bold">Militante Encontrado:</p>
                    <h4 className="text-base font-black text-white">
                      {manualMilitanteResult.nombres} {manualMilitanteResult.apellidos}
                    </h4>
                    <p className="text-xs text-slate-400">DNI: {manualMilitanteResult.dni} • Base: {manualMilitanteResult.base || 'Tacna'}</p>
                    <Button onClick={handleRegisterManualAttendance} loading={registeringManual} variant="accent" className="w-full">
                      Confirmar Asistencia
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modalidad 3: Lista de Asistentes */}
          {activeTab === 'list' && (
            <div className="glass rounded-2xl p-5 border border-white/10 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-surface-900 border-b border-white/10 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-2.5">#</th>
                      <th className="px-3 py-2.5">DNI</th>
                      <th className="px-3 py-2.5">Militante</th>
                      <th className="px-3 py-2.5">Base</th>
                      <th className="px-3 py-2.5">Fecha y Hora</th>
                      <th className="px-3 py-2.5">Método</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {asistentes.map((a, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-slate-500 font-mono">{i + 1}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-white">{a.dni}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-200">{a.nombres} {a.apellidos}</td>
                        <td className="px-3 py-2.5 text-slate-400">{a.base || 'Tacna'}</td>
                        <td className="px-3 py-2.5 text-slate-400 font-mono">{formatFechaHora(a.fecha_hora)}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {a.metodo === 'scan_admin' ? 'Escáner' : a.metodo === 'qr_puerta' ? 'Puerta QR' : 'Manual'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CREAR EVENTO O POLLADA                        */}
      {/* ==================================================== */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={createType === 'evento' ? 'Crear Nuevo Evento o Reunión' : '🍗 Crear Nueva Pollada Pro-Fondos'}
        size="md"
      >
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-900 rounded-xl border border-white/10 mb-4">
          <button
            type="button"
            onClick={() => setCreateType('evento')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              createType === 'evento'
                ? 'bg-amber-500 text-surface-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>📅</span> Evento / Reunión
          </button>
          <button
            type="button"
            onClick={() => setCreateType('pollada')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              createType === 'pollada'
                ? 'bg-amber-500 text-surface-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🍗</span> Pollada Pro-Fondos
          </button>
        </div>

        <form onSubmit={handleCreateEvent} className="space-y-4">
          <Input
            label={createType === 'evento' ? 'Título de la Reunión o Evento' : 'Nombre de la Pollada'}
            placeholder={createType === 'evento' ? 'Ej: Asamblea General de Bases' : 'Ej: GRAN POLLADA PRO-FONDOS FUERZA TACNA'}
            value={newEventData.titulo}
            onChange={(e) => setNewEventData({ ...newEventData, titulo: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Fecha"
              type="date"
              value={newEventData.fecha}
              onChange={(e) => setNewEventData({ ...newEventData, fecha: e.target.value })}
              required
            />
            <Input
              label="Hora"
              type="time"
              value={newEventData.hora}
              onChange={(e) => setNewEventData({ ...newEventData, hora: e.target.value })}
            />
          </div>

          <Input
            label={createType === 'evento' ? 'Lugar o Dirección' : 'Lugar de Entrega y Recojo'}
            placeholder="Ej: Local Central, Av. Bolognesi 123"
            value={newEventData.lugar}
            onChange={(e) => setNewEventData({ ...newEventData, lugar: e.target.value })}
          />

          {createType === 'pollada' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Precio por ticket (S/.)"
                  type="number"
                  min="1"
                  step="0.5"
                  value={polladaFields.precio_ticket}
                  onChange={(e) => setPolladaFields({ ...polladaFields, precio_ticket: e.target.value })}
                  required
                />
                <Input
                  label="Mínimo tickets por militante"
                  type="number"
                  min="1"
                  value={polladaFields.min_tickets}
                  onChange={(e) => setPolladaFields({ ...polladaFields, min_tickets: e.target.value })}
                  required
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span>🎯</span> Meta y Talonario Físico Correlativo
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">1,000 correlativos</span>
                </div>
                
                <Input
                  label="Total de Polladas a Vender (Meta)"
                  type="number"
                  min="1"
                  value={polladaFields.total_estimado}
                  onChange={(e) => {
                    const newTotal = e.target.value;
                    const startNum = parseInt(polladaFields.ticket_inicio_talonario) || 5000;
                    const tot = parseInt(newTotal) || 0;
                    const newEnd = tot > 0 ? String(startNum + tot) : polladaFields.ticket_fin_talonario;
                    setPolladaFields({
                      ...polladaFields,
                      total_estimado: newTotal,
                      ticket_fin_talonario: newEnd,
                    });
                  }}
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="N° Ticket Inicial"
                    placeholder="5000"
                    value={polladaFields.ticket_inicio_talonario}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      const startNum = parseInt(newStart);
                      const tot = parseInt(polladaFields.total_estimado) || 1000;
                      const newEnd = !isNaN(startNum) && tot > 0 ? String(startNum + tot) : polladaFields.ticket_fin_talonario;
                      setPolladaFields({
                        ...polladaFields,
                        ticket_inicio_talonario: newStart,
                        ticket_fin_talonario: newEnd,
                      });
                    }}
                    required
                  />
                  <Input
                    label="N° Ticket Final"
                    placeholder="6000"
                    value={polladaFields.ticket_fin_talonario}
                    onChange={(e) => setPolladaFields({ ...polladaFields, ticket_fin_talonario: e.target.value })}
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  ℹ️ Permite que el sistema sugiera automáticamente los números correlativos físicos (Ej: del 5000 al 6000) al registrar cada venta.
                </p>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" loading={submittingEvent} variant="accent" className="flex-1">
              {createType === 'evento' ? 'Crear Evento' : '🍗 Crear Pollada'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL: EDITAR POLLADA                                */}
      {/* ==================================================== */}
      <Modal
        isOpen={editPolladaModalOpen}
        onClose={() => !savingEditPollada && setEditPolladaModalOpen(false)}
        title="Editar Pollada Pro-Fondos"
        size="md"
      >
        {editingPollada && (
          <form onSubmit={handleSaveEditPollada} className="space-y-4">
            <Input
              label="Nombre de la Pollada"
              value={editPolladaData.titulo}
              onChange={(e) => setEditPolladaData({ ...editPolladaData, titulo: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Fecha"
                type="date"
                value={editPolladaData.fecha}
                onChange={(e) => setEditPolladaData({ ...editPolladaData, fecha: e.target.value })}
                required
              />
              <Input
                label="Hora"
                type="time"
                value={editPolladaData.hora}
                onChange={(e) => setEditPolladaData({ ...editPolladaData, hora: e.target.value })}
              />
            </div>
            <Input
              label="Lugar de Entrega"
              value={editPolladaData.lugar}
              onChange={(e) => setEditPolladaData({ ...editPolladaData, lugar: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Precio por ticket (S/.)"
                type="number"
                value={editPolladaData.precio_ticket}
                onChange={(e) => setEditPolladaData({ ...editPolladaData, precio_ticket: e.target.value })}
                required
              />
              <Input
                label="Mínimo tickets"
                type="number"
                value={editPolladaData.min_tickets}
                onChange={(e) => setEditPolladaData({ ...editPolladaData, min_tickets: e.target.value })}
                required
              />
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span>🎯</span> Meta y Talonario Físico Correlativo
              </span>
              <Input
                label="Total de Polladas a Vender (Meta)"
                type="number"
                min="1"
                value={editPolladaData.total_estimado}
                onChange={(e) => setEditPolladaData({ ...editPolladaData, total_estimado: e.target.value })}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="N° Ticket Inicial"
                  value={editPolladaData.ticket_inicio_talonario}
                  onChange={(e) => setEditPolladaData({ ...editPolladaData, ticket_inicio_talonario: e.target.value })}
                  required
                />
                <Input
                  label="N° Ticket Final"
                  value={editPolladaData.ticket_fin_talonario}
                  onChange={(e) => setEditPolladaData({ ...editPolladaData, ticket_fin_talonario: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Estado</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditPolladaData({ ...editPolladaData, estado: 'activo' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    editPolladaData.estado === 'activo'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-surface-800 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  🟢 Activo
                </button>
                <button
                  type="button"
                  onClick={() => setEditPolladaData({ ...editPolladaData, estado: 'finalizado' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    editPolladaData.estado === 'finalizado'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-surface-800 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  ⏸️ Finalizado
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={savingEditPollada}
                onClick={() => setEditPolladaModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" loading={savingEditPollada} variant="accent" className="flex-1">
                Guardar Cambios
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ==================================================== */}
      {/* MODAL: ELIMINAR POLLADA                              */}
      {/* ==================================================== */}
      <Modal
        isOpen={deletePolladaModalOpen}
        onClose={() => !deletingPollada && setDeletePolladaModalOpen(false)}
        title="⚠️ Confirmar Eliminación de Pollada"
        size="md"
      >
        {polladaToDelete && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              ¿Estás seguro de que deseas eliminar la pollada <strong>{polladaToDelete.titulo}</strong>?
            </p>
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
              Esta acción eliminará la actividad y sus registros vinculados. No se puede deshacer.
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={deletingPollada}
                onClick={() => setDeletePolladaModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={deletingPollada}
                onClick={handleDeletePollada}
                className="flex-1"
              >
                Sí, Eliminar Pollada
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================================================== */}
      {/* MODAL: EDITAR EVENTO DE REUNIÓN                      */}
      {/* ==================================================== */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => !savingEdit && setEditModalOpen(false)}
        title="Editar Evento o Reunión"
        size="md"
      >
        {editingEvent && (
          <form onSubmit={handleSaveEditEvent} className="space-y-4">
            <Input
              label="Título del Evento"
              value={editEventData.titulo}
              onChange={(e) => setEditEventData({ ...editEventData, titulo: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Fecha"
                type="date"
                value={editEventData.fecha}
                onChange={(e) => setEditEventData({ ...editEventData, fecha: e.target.value })}
                required
              />
              <Input
                label="Hora"
                type="time"
                value={editEventData.hora}
                onChange={(e) => setEditEventData({ ...editEventData, hora: e.target.value })}
              />
            </div>
            <Input
              label="Lugar o Dirección"
              value={editEventData.lugar}
              onChange={(e) => setEditEventData({ ...editEventData, lugar: e.target.value })}
            />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" disabled={savingEdit} onClick={() => setEditModalOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" loading={savingEdit} variant="accent" className="flex-1">
                Guardar Cambios
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ==================================================== */}
      {/* MODAL: ELIMINAR EVENTO                               */}
      {/* ==================================================== */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deletingEvent && setDeleteModalOpen(false)}
        title="⚠️ Confirmar Eliminación de Evento"
        size="md"
      >
        {eventToDelete && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              ¿Estás seguro de que deseas eliminar el evento <strong>{eventToDelete.titulo}</strong>?
            </p>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" disabled={deletingEvent} onClick={() => setDeleteModalOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="button" onClick={handleConfirmDeleteEvent} loading={deletingEvent} variant="danger" className="flex-1">
                Sí, Eliminar Evento
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================================================== */}
      {/* MODAL: CARTEL IMPRIMIBLE QR                          */}
      {/* ==================================================== */}
      <Modal
        isOpen={posterModalOpen}
        onClose={() => setPosterModalOpen(false)}
        title="Cartel Oficial QR para Puerta"
        size="md"
      >
        {posterEvent && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-white rounded-2xl flex flex-col items-center gap-3">
              <h3 className="text-lg font-black text-slate-900">{posterEvent.titulo}</h3>
              <p className="text-xs text-slate-600">
                📅 {formatFecha(posterEvent.fecha)} {posterEvent.hora && `| ⏰ ${formatHora(posterEvent.hora)}`}
              </p>
              <div className="p-3 bg-slate-100 rounded-xl">
                <QRCodeSVG
                  value={typeof window !== 'undefined' ? `${window.location.origin}/evento/${posterEvent.id_evento}` : posterEvent.id_evento}
                  size={200}
                  level="H"
                />
              </div>
              <p className="text-[11px] text-slate-500 font-mono font-bold">
                Escanea con tu celular para registrar asistencia
              </p>
            </div>
            <Button onClick={() => window.print()} variant="accent" className="w-full">
              Imprimir Cartel
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
