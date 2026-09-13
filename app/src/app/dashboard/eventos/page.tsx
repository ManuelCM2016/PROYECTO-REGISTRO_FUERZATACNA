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
import type { Evento, Asistencia } from '@/types';

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

export default function EventosPage() {
  const { addToast } = useToast();

  // Estados de Eventos
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [newEventData, setNewEventData] = useState({
    titulo: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: '18:00',
    lugar: '',
  });

  // Estados para Edición de Evento
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

  // Estados para Eliminación de Evento (con advertencia obligatoria)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Evento | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);

  // Evento Seleccionado para Gestión de Asistencia
  const [selectedEvent, setSelectedEvent] = useState<Evento | null>(null);
  const [activeTab, setActiveTab] = useState<'scan' | 'manual' | 'list'>('scan');
  const [asistentes, setAsistentes] = useState<Asistencia[]>([]);
  const [loadingAsistencia, setLoadingAsistencia] = useState(false);

  // Modal de Cartel Imprimible QR
  const [posterModalOpen, setPosterModalOpen] = useState(false);
  const [posterEvent, setPosterEvent] = useState<Evento | null>(null);

  // Modalidad 1: Escáner con Cámara
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

  // Modalidad 2: Búsqueda Manual
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

  // Cargar lista de eventos al iniciar
  useEffect(() => {
    loadEventos();
  }, []);

  // Cargar asistentes cuando se selecciona un evento
  useEffect(() => {
    if (selectedEvent) {
      loadAsistencia(selectedEvent.id_evento);
    }
  }, [selectedEvent]);

  // Manejo del Escáner de Cámara cuando se activa la pestaña 'scan'
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

  const loadEventos = async (forceFresh = false) => {
    // 1. Carga instantánea desde sessionStorage si existe copia previa
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
        if (forceFresh) {
          addToast('success', 'Lista de eventos actualizada');
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

  const loadAsistencia = async (idEvento: string, forceFresh = false) => {
    // 1. Cargar instantáneamente de sessionStorage si existe
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

  // Crear Evento
  const handleCreateEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!newEventData.titulo.trim() || !newEventData.fecha) {
      addToast('error', 'Título y fecha son requeridos');
      return;
    }

    setSubmittingEvent(true);
    try {
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
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setSubmittingEvent(false);
    }
  };

  // Cambiar estado de evento (activo/finalizado)
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

  // Abrir Modal de Cartel Imprimible QR
  const openPosterModal = (evento: Evento) => {
    setPosterEvent(evento);
    setPosterModalOpen(true);
  };

  // Imprimir cartel
  const handlePrintPoster = () => {
    window.print();
  };

  // Abrir Modal de Edición
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

  // Guardar Cambios de Edición
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

        // Actualizar en estado local
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

        // Si es el evento seleccionado en el panel, actualizarlo
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

        // Actualizar en sessionStorage
        if (typeof window !== 'undefined') {
          try {
            const cachedStr = sessionStorage.getItem('ft_cache_eventos');
            if (cachedStr) {
              const cached: Evento[] = JSON.parse(cachedStr);
              const updated = cached.map((ev) =>
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
              );
              sessionStorage.setItem('ft_cache_eventos', JSON.stringify(updated));
            }
          } catch { }
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

  // Abrir Modal de Confirmación de Eliminación (con advertencia obligatoria)
  const openDeleteModal = (evento: Evento) => {
    setEventToDelete(evento);
    setDeleteModalOpen(true);
  };

  // Confirmar Eliminación de Evento
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

        // Remover de la lista en memoria
        setEventos((prev) => prev.filter((ev) => ev.id_evento !== eventToDelete.id_evento));

        // Si estaba abierto el evento eliminado, regresar a la vista de lista
        if (selectedEvent?.id_evento === eventToDelete.id_evento) {
          stopCameraScanner();
          setSelectedEvent(null);
        }

        // Remover de caché de sesión
        if (typeof window !== 'undefined') {
          try {
            const cachedStr = sessionStorage.getItem('ft_cache_eventos');
            if (cachedStr) {
              const cached: Evento[] = JSON.parse(cachedStr);
              const updated = cached.filter((ev) => ev.id_evento !== eventToDelete.id_evento);
              sessionStorage.setItem('ft_cache_eventos', JSON.stringify(updated));
            }
            sessionStorage.removeItem(`ft_cache_asistencia_${eventToDelete.id_evento}`);
          } catch { }
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

  // ---- CONTROLADOR DE ASISTENCIA: CÁMARA (MODALIDAD 1) ----
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

      // Breve pausa para asegurar que el contenedor DOM tenga sus dimensiones renderizadas
      await new Promise((resolve) => setTimeout(resolve, 80));

      const qrScanner = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = qrScanner;

      // Cálculo dinámico para que el recuadro de escaneo sea amplio y cómodo en cualquier celular
      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        // Ocupa el 76% del área visible (mínimo 200px, máximo 320px) para enfocar rápido sin ser estrecho
        const edgeSize = Math.min(Math.max(Math.floor(minEdge * 0.76), 200), 320);
        return { width: edgeSize, height: edgeSize };
      };

      await qrScanner.start(
        { facingMode: 'environment' }, // Cámara trasera preferida
        {
          fps: 15,
          qrbox: qrboxFunction,
        },
        (decodedText) => {
          handleQrDecoded(decodedText);
        },
        () => {
          // Frame sin QR: ignorar
        }
      );
    } catch (err) {
      console.error('Error al iniciar cámara:', err);
      addToast('error', 'No se pudo acceder a la cámara. Revisa los permisos de tu navegador.');
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

  // Cola de procesamiento en segundo plano y caché local de DNIs ya procesados
  const processedDnisRef = useRef<Set<string>>(new Set());
  const [pendingQueue, setPendingQueue] = useState<number>(0);
  const [processedCount, setProcessedCount] = useState<number>(0);

  // Procesa la llamada al servidor en segundo plano (fire-and-forget)
  const processAttendanceInBackground = useCallback(
    (dni: string, eventoId: string) => {
      setPendingQueue((prev) => prev + 1);

      fetch(`/api/eventos/${eventoId}/asistencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, metodo: 'scan_admin' }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.data) {
            // Actualizar lista y contadores
            loadAsistencia(eventoId, true);
            setSelectedEvent((prev) =>
              prev ? { ...prev, total_asistentes: (prev.total_asistentes || 0) + 1 } : null
            );
            setEventos((prev) =>
              prev.map((ev) =>
                ev.id_evento === eventoId
                  ? { ...ev, total_asistentes: (ev.total_asistentes || 0) + 1 }
                  : ev
              )
            );
          } else if (result.alreadyMarked) {
            // Ya estaba marcado en servidor — no es error, solo info
          } else if (result.notFound) {
            // DNI no figura: remover de la cache local para que pueda reintentar
            processedDnisRef.current.delete(dni);
            addToast('warning', `DNI ${dni} no figura en el padrón oficial.`);
          } else {
            processedDnisRef.current.delete(dni);
            addToast('error', result.error || `Error al registrar DNI ${dni}`);
          }
        })
        .catch(() => {
          processedDnisRef.current.delete(dni);
          addToast('error', `Error de conexión al registrar DNI ${dni}. Se reintentará.`);
        })
        .finally(() => {
          setPendingQueue((prev) => Math.max(0, prev - 1));
          setProcessedCount((prev) => prev + 1);
        });
    },
    [addToast]
  );

  // Procesa el texto detectado por el escáner QR — OPTIMISTA Y ULTRA-RÁPIDO
  const handleQrDecoded = useCallback(
    async (decodedText: string) => {
      const currentEvent = selectedEventRef.current;
      if (isScanningLockedRef.current || !currentEvent) return;

      // Extraer DNI de varios formatos posibles:
      // Formato 1: URL /validar/12345678
      // Formato 2: 12345678 (8 dígitos puros)
      // Formato 3: JSON {"dni":"12345678"}
      let extractedDni = '';

      const matchUrl = decodedText.match(/\/validar\/(\d{8})/);
      if (matchUrl) {
        extractedDni = matchUrl[1];
      } else if (/^\d{8}$/.test(decodedText.trim())) {
        extractedDni = decodedText.trim();
      } else {
        try {
          const parsed = JSON.parse(decodedText);
          if (parsed.dni && /^\d{8}$/.test(String(parsed.dni))) {
            extractedDni = String(parsed.dni);
          }
        } catch {
          // No es JSON, intentar buscar 8 dígitos consecutivos
          const fallbackMatch = decodedText.match(/\b\d{8}\b/);
          if (fallbackMatch) extractedDni = fallbackMatch[0];
        }
      }

      if (!extractedDni) {
        setLastScannedResult({
          status: 'error',
          message: 'El código escaneado no contiene un DNI de militante válido.',
        });
        return;
      }

      // Anti-rebote: si ya fue escaneado en esta sesión, rechazar inmediatamente
      if (processedDnisRef.current.has(extractedDni)) {
        // Verificar anti-rebote temporal de 4 segundos
        const now = Date.now();
        const lastScan = lastScannedTimeRef.current[extractedDni] || 0;
        if (now - lastScan < 4000) return;

        lastScannedTimeRef.current[extractedDni] = now;
        setLastScannedResult({
          status: 'already',
          message: `DNI ${extractedDni} ya fue escaneado en esta sesión.`,
          militante: { nombres: '', apellidos: '', dni: extractedDni },
        });

        // Pausa brevísima para mostrar feedback
        isScanningLockedRef.current = true;
        setScanningLocked(true);
        if (html5QrCodeRef.current) {
          try { html5QrCodeRef.current.pause(true); } catch { }
        }
        setTimeout(() => {
          isScanningLockedRef.current = false;
          setScanningLocked(false);
          if (html5QrCodeRef.current) {
            try { html5QrCodeRef.current.resume(); } catch { }
          }
        }, 800);
        return;
      }

      // BLOQUEO BREVE para evitar lecturas duplicadas del mismo frame
      isScanningLockedRef.current = true;
      setScanningLocked(true);
      lastScannedTimeRef.current[extractedDni] = Date.now();

      // Pausar cámara brevemente para feedback visual
      if (html5QrCodeRef.current) {
        try { html5QrCodeRef.current.pause(true); } catch { }
      }

      // ★ RESPUESTA OPTIMISTA INSTANTÁNEA — No esperar al servidor
      playSuccessBeep();
      processedDnisRef.current.add(extractedDni);
      setLastScannedResult({
        status: 'success',
        message: '¡Lectura Exitosa!',
        militante: {
          nombres: '',
          apellidos: '',
          dni: extractedDni,
        },
      });

      // Incremento optimista del contador
      setSelectedEvent((prev) =>
        prev ? { ...prev, total_asistentes: (prev.total_asistentes || 0) + 1 } : null
      );

      // ★ ENVIAR AL SERVIDOR EN SEGUNDO PLANO (fire-and-forget)
      processAttendanceInBackground(extractedDni, currentEvent.id_evento);

      // ★ REANUDAR CÁMARA EN 800ms (antes eran 2500ms + tiempo de servidor)
      setTimeout(() => {
        isScanningLockedRef.current = false;
        setScanningLocked(false);
        if (html5QrCodeRef.current) {
          try { html5QrCodeRef.current.resume(); } catch { }
        }
      }, 800);
    },
    [processAttendanceInBackground]
  );

  // ---- CONTROLADOR DE ASISTENCIA: BÚSQUEDA MANUAL (MODALIDAD 2) ----
  const handleSearchManualDni = async (e: FormEvent) => {
    e.preventDefault();
    const cleanDni = manualDni.replace(/\D/g, '').trim();
    if (cleanDni.length !== 8) {
      addToast('error', 'Ingresa un DNI de 8 dígitos');
      return;
    }

    setManualSearching(true);
    setManualNotFound(false);
    setManualMilitanteResult(null);

    try {
      const res = await fetch(`/api/militantes/check-dni?dni=${cleanDni}`);
      const data = await res.json();
      if (data.success && data.found && data.data) {
        setManualMilitanteResult(data.data);
      } else {
        setManualNotFound(true);
      }
    } catch {
      addToast('error', 'Error al buscar DNI');
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
        body: JSON.stringify({
          dni: manualMilitanteResult.dni,
          metodo: 'manual',
        }),
      });

      const result = await res.json();
      if (result.success) {
        playSuccessBeep();
        addToast('success', `¡Asistencia de ${manualMilitanteResult.nombres} registrada!`);
        setManualDni('');
        setManualMilitanteResult(null);
        await loadAsistencia(selectedEvent.id_evento, true);
        setSelectedEvent((prev) => (prev ? { ...prev, total_asistentes: (prev.total_asistentes || 0) + 1 } : null));
        setEventos((prev) =>
          prev.map((ev) =>
            ev.id_evento === selectedEvent.id_evento
              ? { ...ev, total_asistentes: (ev.total_asistentes || 0) + 1 }
              : ev
          )
        );
      } else if (result.alreadyMarked) {
        addToast('warning', result.message || 'Ya había registrado asistencia');
      } else {
        addToast('error', result.error || 'Error al registrar');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setRegisteringManual(false);
    }
  };

  // ---- REGISTRO EN PUERTA DE SIMPATIZANTE NO EMPADRONADO (EN REVISIÓN) ----
  const handleRegisterNewMilitanteInDoor = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    const cleanDni = manualDni.replace(/\D/g, '').trim();
    if (cleanDni.length !== 8) {
      addToast('error', 'El DNI debe tener 8 dígitos');
      return;
    }

    if (!newDoorMilitante.nombres.trim()) {
      addToast('error', 'Ingresa los nombres');
      return;
    }

    if (!newDoorMilitante.apellidos.trim()) {
      addToast('error', 'Ingresa los apellidos');
      return;
    }

    if (!newDoorMilitante.base.trim()) {
      addToast('error', 'Ingresa el distrito o base');
      return;
    }

    setRegisteringDoorMilitante(true);
    try {
      const cleanPhone = newDoorMilitante.telefono.replace(/\D/g, '').trim();
      const safePhone = cleanPhone ? `+51 ${cleanPhone}` : '+51 900000000';

      const res = await fetch(`/api/eventos/${selectedEvent.id_evento}/asistencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: cleanDni,
          metodo: 'manual',
          nuevoMilitante: {
            nombres: newDoorMilitante.nombres.trim().toUpperCase(),
            apellidos: newDoorMilitante.apellidos.trim().toUpperCase(),
            telefono: safePhone,
            base: newDoorMilitante.base.trim(),
            canal_registro: `Evento: ${selectedEvent.titulo}`,
          },
        }),
      });

      const result = await res.json();
      if (result.success) {
        playSuccessBeep();
        addToast(
          'success',
          `¡Asistencia confirmada! ${newDoorMilitante.nombres.trim()} registrado(a) en "En Revisión" para aprobación posterior.`
        );

        setManualDni('');
        setManualNotFound(false);
        setNewDoorMilitante({ nombres: '', apellidos: '', telefono: '', base: '' });

        // Invalidar caché local para refrescar contador y lista de "En Revisión"
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('ft_cache_militantes');
          const currentInReview = parseInt(sessionStorage.getItem('ft_in_review_count') || '0', 10);
          sessionStorage.setItem('ft_in_review_count', String(currentInReview + 1));
          window.dispatchEvent(
            new CustomEvent('ft_stats_updated', {
              detail: { en_revision: currentInReview + 1 },
            })
          );
        }

        await loadAsistencia(selectedEvent.id_evento, true);
        setSelectedEvent((prev) =>
          prev ? { ...prev, total_asistentes: (prev.total_asistentes || 0) + 1 } : null
        );
        setEventos((prev) =>
          prev.map((ev) =>
            ev.id_evento === selectedEvent.id_evento
              ? { ...ev, total_asistentes: (ev.total_asistentes || 0) + 1 }
              : ev
          )
        );
      } else if (result.alreadyMarked) {
        addToast('warning', result.message || 'Esta persona ya había registrado asistencia');
      } else {
        addToast('error', result.error || 'Error al registrar');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setRegisteringDoorMilitante(false);
    }
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-6">
      {/* ==================================================== */}
      {/* VISTA 1: LISTADO GENERAL DE EVENTOS                  */}
      {/* ==================================================== */}
      {!selectedEvent ? (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Eventos y Reuniones</h1>
              <p className="text-sm text-slate-400 mt-1">
                Administra eventos oficiales y controla la asistencia en tiempo real
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => loadEventos(true)}
                variant="secondary"
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
                onClick={() => setCreateModalOpen(true)}
                variant="primary"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                Nuevo Evento
              </Button>
            </div>
          </div>

          {/* Tarjetas de Eventos */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : eventos.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center text-slate-500 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto text-3xl">
                🏛️
              </div>
              <h3 className="text-lg font-bold text-white">No hay eventos registrados aún</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Crea tu primera reunión o asamblea política para comenzar a registrar asistencias mediante carnets QR, búsqueda manual o cartel en puerta.
              </p>
              <div className="pt-2">
                <Button onClick={() => setCreateModalOpen(true)} variant="accent">
                  Crear Primer Evento
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {eventos.map((ev) => {
                const isActive = ev.estado === 'activo';
                return (
                  <div
                    key={ev.id_evento}
                    className={`glass rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${isActive
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

                    {/* Botones de acción */}
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
                          icon={
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                          }
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

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                        <Button
                          onClick={() => openEditModal(ev)}
                          variant="secondary"
                          size="sm"
                          className="w-full text-xs text-amber-300 hover:text-amber-200 border-amber-500/20 hover:border-amber-500/40"
                          icon={
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          }
                        >
                          Editar
                        </Button>

                        <Button
                          onClick={() => openDeleteModal(ev)}
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40"
                          icon={
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          }
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ==================================================== */
        /* VISTA 2: PANEL DE CONTROL DE ASISTENCIA DEL EVENTO   */
        /* ==================================================== */
        <div className="space-y-6">
          {/* Header del Evento Activo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  stopCameraScanner();
                  setSelectedEvent(null);
                  loadEventos();
                }}
                className="p-2 rounded-xl bg-surface-800 text-slate-400 hover:text-white hover:bg-surface-700 transition-all cursor-pointer"
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
              {/* Contador en vivo */}
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
                disabled={loadingAsistencia}
                icon={
                  <svg className={`w-4 h-4 text-amber-400 ${loadingAsistencia ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                }
              >
                Actualizar
              </Button>

              <Button
                onClick={() => openPosterModal(selectedEvent)}
                variant="secondary"
                size="sm"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                }
              >
                Cartel Puerta
              </Button>

              <Button
                onClick={() => openEditModal(selectedEvent)}
                variant="secondary"
                size="sm"
                className="text-amber-300 hover:text-amber-200 border-amber-500/20"
                icon={
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                }
              >
                Editar
              </Button>

              <Button
                onClick={() => openDeleteModal(selectedEvent)}
                variant="ghost"
                size="sm"
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                }
              >
                Eliminar
              </Button>
            </div>
          </div>

          {/* Navegación por Pestañas de Modalidad */}
          <div className="flex items-center gap-2 p-1.5 bg-surface-800/90 rounded-2xl border border-white/5 overflow-x-auto">
            <button
              onClick={() => {
                setActiveTab('scan');
                setScannerActive(true);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'scan'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <span>📷</span>
              <span>Modalidad 1: Escáner Carnets</span>
            </button>

            <button
              onClick={() => {
                stopCameraScanner();
                setScannerActive(false);
                setActiveTab('manual');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'manual'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <span>✍️</span>
              <span>Modalidad 2: Registro Manual</span>
            </button>

            <button
              onClick={() => {
                stopCameraScanner();
                setScannerActive(false);
                setActiveTab('list');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'list'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <span>📋</span>
              <span>Lista de Asistentes ({asistentes.length})</span>
            </button>
          </div>

          {/* ==================================================== */}
          {/* TAB 1: ESCÁNER CON CÁMARA (MODALIDAD 1)               */}
          {/* ==================================================== */}
          {activeTab === 'scan' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Área del Escáner */}
              <div className="lg:col-span-2 glass rounded-2xl p-3 sm:p-6 border border-white/10 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white">Escáner de Credenciales de Militantes</h3>
                    <p className="text-xs text-slate-400">
                      Apunta la cámara al código QR de la credencial digital o física del militante
                    </p>
                  </div>

                  <Button
                    onClick={() => {
                      if (scannerActive) {
                        stopCameraScanner();
                        setScannerActive(false);
                      } else {
                        setScannerActive(true);
                      }
                    }}
                    variant={scannerActive ? 'danger' : 'accent'}
                    size="sm"
                  >
                    {scannerActive ? 'Detener Cámara' : 'Iniciar Cámara'}
                  </Button>
                </div>

                {/* Contenedor de la Cámara de html5-qrcode adaptado a cualquier celular */}
                <div className="relative rounded-2xl overflow-hidden bg-black/95 w-full h-[380px] sm:h-[440px] max-w-lg mx-auto flex flex-col items-center justify-center border border-white/10 shadow-2xl">
                  <div id="reader-cam" className="w-full h-full flex items-center justify-center" />

                  {!scannerActive && (
                    <div className="text-center p-6 space-y-3">
                      <div className="w-16 h-16 rounded-2xl bg-surface-800 text-amber-400 flex items-center justify-center mx-auto text-3xl">
                        📹
                      </div>
                      <p className="text-sm text-slate-300 font-medium">La cámara está desactivada</p>
                      <Button onClick={() => setScannerActive(true)} variant="accent" size="sm">
                        Activar Cámara
                      </Button>
                    </div>
                  )}

                  {scannerActive && !scanningLocked && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      {/* Línea láser de escaneo animada para feedback visual instantáneo */}
                      <div className="w-[76%] max-w-[280px] aspect-square relative flex items-center justify-center">
                        <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] animate-scanner-line" />
                      </div>
                    </div>
                  )}

                  {scannerActive && scanningLocked && (
                    <div className="absolute inset-0 bg-emerald-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 z-20 animate-fade-in">
                      <div className="w-16 h-16 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-3xl font-black mb-2 shadow-lg shadow-emerald-500/50">
                        ✓
                      </div>
                      <p className="text-lg font-bold text-white">¡Lectura Exitosa!</p>
                      <p className="text-xs text-emerald-200">Procesando siguiente credencial...</p>
                    </div>
                  )}
                </div>

                {/* Feedback del último escaneo */}
                {lastScannedResult && (
                  <div
                    className={`p-4 rounded-xl border transition-all ${lastScannedResult.status === 'success'
                        ? 'bg-emerald-500/15 border-emerald-500/30'
                        : lastScannedResult.status === 'already'
                          ? 'bg-amber-500/15 border-amber-500/30'
                          : 'bg-red-500/15 border-red-500/30'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl leading-none mt-0.5">
                        {lastScannedResult.status === 'success'
                          ? '🎉'
                          : lastScannedResult.status === 'already'
                            ? '⚠️'
                            : '✕'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white leading-tight">
                          {lastScannedResult.message}
                        </p>
                        {lastScannedResult.militante && (
                          <p className="text-xs text-slate-300 mt-1">
                            <strong>
                              {lastScannedResult.militante.nombres} {lastScannedResult.militante.apellidos}
                            </strong>{' '}
                            • DNI: {lastScannedResult.militante.dni}{' '}
                            {lastScannedResult.militante.base && `• Base: ${lastScannedResult.militante.base}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Indicador de cola de procesamiento en segundo plano */}
                {(pendingQueue > 0 || processedCount > 0) && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-800/80 border border-white/5 text-xs">
                    <div className="flex items-center gap-2">
                      {pendingQueue > 0 && (
                        <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                          <div className="w-2 h-2 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                          {pendingQueue} procesando...
                        </span>
                      )}
                      {pendingQueue === 0 && processedCount > 0 && (
                        <span className="text-emerald-400 font-semibold">✓ Todo sincronizado</span>
                      )}
                    </div>
                    <span className="text-slate-400 font-mono">
                      {processedCount} enviados al servidor
                    </span>
                  </div>
                )}
              </div>

              {/* Lista Rápida de Últimos Asistentes en la sesión */}
              <div className="glass rounded-2xl p-5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Últimos Registros</h3>
                  <button
                    onClick={() => loadAsistencia(selectedEvent.id_evento)}
                    className="text-xs text-amber-400 hover:underline cursor-pointer"
                  >
                    Actualizar
                  </button>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {asistentes.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      Aún no hay asistencias marcadas en este evento
                    </p>
                  ) : (
                    asistentes.slice(0, 10).map((a, idx) => (
                      <div
                        key={`${a.id_asistencia}-${idx}`}
                        className="p-3 rounded-xl bg-surface-800/70 border border-white/5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white truncate">
                            {a.nombres} {a.apellidos}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {formatHora(a.fecha_hora) || 'Reciente'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                          <span>DNI: {a.dni}</span>
                          <span className="capitalize text-slate-400">
                            {a.metodo === 'qr_puerta'
                              ? '🚪 Puerta'
                              : a.metodo === 'scan_admin'
                                ? '📷 Escáner'
                                : '✍️ Manual'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: REGISTRO MANUAL POR DNI (MODALIDAD 2)          */}
          {/* ==================================================== */}
          {activeTab === 'manual' && (
            <div className="max-w-xl mx-auto glass rounded-2xl p-6 border border-white/10 space-y-6">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto text-xl font-bold">
                  ✍️
                </div>
                <h3 className="text-lg font-bold text-white">Registro Manual de Asistencia</h3>
                <p className="text-xs text-slate-400">
                  Busca al militante por su número de DNI para confirmar su asistencia
                </p>
              </div>

              <form onSubmit={handleSearchManualDni} className="flex gap-2">
                <Input
                  placeholder="Ingresa 8 dígitos del DNI"
                  value={manualDni}
                  onChange={(e) => {
                    setManualDni(e.target.value.replace(/\D/g, '').slice(0, 8));
                    setManualNotFound(false);
                    setManualMilitanteResult(null);
                  }}
                  maxLength={8}
                  inputMode="numeric"
                  autoFocus
                  className="flex-1 font-mono font-bold tracking-widest text-center"
                />
                <Button type="submit" loading={manualSearching} variant="accent">
                  Buscar
                </Button>
              </form>

              {/* Resultado de Búsqueda: Militante Encontrado */}
              {manualMilitanteResult && (
                <div className="p-5 rounded-2xl bg-surface-800 border border-emerald-500/30 space-y-4 glow-accent">
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                        Militante Identificado
                      </p>
                      <h4 className="text-lg font-bold text-white mt-0.5">
                        {manualMilitanteResult.nombres} {manualMilitanteResult.apellidos}
                      </h4>
                    </div>
                    <Badge variant="success" dot>
                      Empadronado
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-400 block">DNI:</span>
                      <span className="font-mono font-bold text-white">{manualMilitanteResult.dni}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Base:</span>
                      <span className="text-sky-400 font-semibold">{manualMilitanteResult.base || 'Sin asignar'}</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleRegisterManualAttendance}
                    loading={registeringManual}
                    variant="accent"
                    size="lg"
                    className="w-full"
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    }
                  >
                    Marcar Asistencia (Presente)
                  </Button>
                </div>
              )}

              {/* Botón rápido para inscribir directamente sin buscar primero */}
              {!manualNotFound && !manualMilitanteResult && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setManualNotFound(true);
                      setManualMilitanteResult(null);
                    }}
                    className="text-xs text-amber-400/90 hover:text-amber-300 underline decoration-amber-400/40 hover:decoration-amber-300 cursor-pointer font-semibold transition-colors"
                  >
                    + ¿La persona es nueva y no está empadronada? Inscribir directamente aquí
                  </button>
                </div>
              )}

              {/* DNI No Encontrado -> Formulario de Registro Express en Revisión */}
              {manualNotFound && (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-4 animate-fade-in shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📝</span>
                      <div>
                        <h4 className="text-sm font-bold text-amber-300">
                          {manualDni ? `DNI no empadronado (${manualDni})` : 'Inscripción Express en Puerta'}
                        </h4>
                        <p className="text-xs text-slate-400">
                          Ingresa sus datos para registrarlo en <strong>Revisión</strong> y confirmar su asistencia al evento.
                        </p>
                      </div>
                    </div>
                    <Badge variant="warning">En Revisión</Badge>
                  </div>

                  <form onSubmit={handleRegisterNewMilitanteInDoor} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Input
                          label="DNI *"
                          placeholder="Ingresa 8 dígitos"
                          value={manualDni}
                          onChange={(e) => setManualDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          maxLength={8}
                          required
                          className="font-mono font-bold tracking-wider"
                        />
                      </div>
                      <div>
                        <Input
                          label="Teléfono / WhatsApp"
                          placeholder="Ej: 952123456"
                          type="tel"
                          maxLength={9}
                          value={newDoorMilitante.telefono}
                          onChange={(e) =>
                            setNewDoorMilitante({
                              ...newDoorMilitante,
                              telefono: e.target.value.replace(/\D/g, '').slice(0, 9),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Nombres *"
                        placeholder="Ej: Juan Carlos"
                        value={newDoorMilitante.nombres}
                        onChange={(e) =>
                          setNewDoorMilitante({
                            ...newDoorMilitante,
                            nombres: e.target.value.toUpperCase(),
                          })
                        }
                        required
                      />
                      <Input
                        label="Apellidos *"
                        placeholder="Ej: Pérez Quispe"
                        value={newDoorMilitante.apellidos}
                        onChange={(e) =>
                          setNewDoorMilitante({
                            ...newDoorMilitante,
                            apellidos: e.target.value.toUpperCase(),
                          })
                        }
                        required
                      />
                    </div>

                    <div>
                      <Input
                        label="Distrito / Base *"
                        placeholder="Ej: Gregorio Albarracín, Tacna Centro, Pocollay, etc."
                        value={newDoorMilitante.base}
                        onChange={(e) =>
                          setNewDoorMilitante({
                            ...newDoorMilitante,
                            base: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="p-2.5 rounded-xl bg-surface-900/80 border border-white/5 text-[11px] text-slate-400 space-y-1">
                      <p>
                        💡 <strong>Control y Seguridad:</strong> Esta persona quedará guardada en la sección <strong>"🕒 En Revisión"</strong> (no en militantes activos) para que la dirigencia la valide después del evento.
                      </p>
                      <p className="text-emerald-400 font-medium">
                        ✓ Su asistencia a este evento quedará confirmada al instante.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={registeringDoorMilitante}
                        onClick={() => {
                          setManualNotFound(false);
                          setManualDni('');
                          setNewDoorMilitante({ nombres: '', apellidos: '', telefono: '', base: '' });
                        }}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        loading={registeringDoorMilitante}
                        variant="accent"
                        size="sm"
                        className="flex-[2] font-bold"
                        icon={
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        }
                      >
                        {registeringDoorMilitante ? 'Registrando...' : 'Registrar en Revisión y Dar Asistencia'}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: LISTA COMPLETA DE ASISTENTES                  */}
          {/* ==================================================== */}
          {activeTab === 'list' && (
            <div className="glass rounded-2xl overflow-hidden space-y-4">
              <div className="p-4 flex items-center justify-between border-b border-white/5">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Padrón de Asistentes al Evento ({asistentes.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Actualizado en vivo desde Google Sheets
                  </p>
                </div>
                <Button
                  onClick={() => loadAsistencia(selectedEvent.id_evento)}
                  variant="secondary"
                  size="sm"
                  loading={loadingAsistencia}
                >
                  Actualizar Lista
                </Button>
              </div>

              {loadingAsistencia ? (
                <SkeletonTable rows={6} />
              ) : asistentes.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <p>Aún no hay militantes registrados en este evento</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">DNI</th>
                        <th className="px-4 py-3">Nombres y Apellidos</th>
                        <th className="px-4 py-3">Condición</th>
                        <th className="px-4 py-3 hidden sm:table-cell">Base</th>
                        <th className="px-4 py-3 hidden md:table-cell">Teléfono</th>
                        <th className="px-4 py-3">Hora Registro</th>
                        <th className="px-4 py-3">Modalidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asistentes.map((a, i) => {
                        const isInReview = a.estado_militante === 'en_revision';
                        return (
                          <tr
                            key={`${a.id_asistencia}-${i}`}
                            className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                              isInReview ? 'bg-amber-500/[0.04]' : ''
                            }`}
                          >
                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{i + 1}</td>
                            <td className="px-4 py-3 font-mono font-bold text-white">{a.dni}</td>
                            <td className="px-4 py-3 text-slate-200 font-medium">
                              {a.nombres} {a.apellidos}
                            </td>
                            <td className="px-4 py-3">
                              {isInReview ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                  En Revisión
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  Confirmado
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs hidden sm:table-cell">
                              {isInReview ? (
                                <span>
                                  <span className="text-amber-300 font-semibold">{a.base || 'Tacna'}</span>
                                  <span className="text-[10px] text-slate-500 block sm:inline sm:ml-1">(Por validar)</span>
                                </span>
                              ) : (
                                <span className="text-sky-400 font-medium">{a.base || '—'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-400 font-mono text-xs hidden md:table-cell">
                              {a.telefono || '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                              {formatFechaHora(a.fecha_hora)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  a.metodo === 'qr_puerta'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : a.metodo === 'scan_admin'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}
                              >
                                {a.metodo === 'qr_puerta'
                                  ? 'Puerta QR'
                                  : a.metodo === 'scan_admin'
                                    ? 'Escáner Admin'
                                    : 'Manual'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CREAR EVENTO                                  */}
      {/* ==================================================== */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Crear Nuevo Evento o Reunión"
        size="md"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <Input
            label="Título de la Reunión o Evento"
            placeholder="Ej: Asamblea Extraordinaria de Bases - Tacna"
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
              label="Hora (Opcional)"
              type="time"
              value={newEventData.hora}
              onChange={(e) => setNewEventData({ ...newEventData, hora: e.target.value })}
            />
          </div>

          <Input
            label="Lugar o Dirección"
            placeholder="Ej: Local Central Fuerza Tacna, Av. Bolognesi 123"
            value={newEventData.lugar}
            onChange={(e) => setNewEventData({ ...newEventData, lugar: e.target.value })}
          />

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
              Crear Evento
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL: EDITAR EVENTO                                  */}
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
              label="Título de la Reunión o Evento"
              placeholder="Ej: Gran Caravana Principal - Fuerza Tacna"
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
                label="Hora (Opcional)"
                type="time"
                value={editEventData.hora}
                onChange={(e) => setEditEventData({ ...editEventData, hora: e.target.value })}
              />
            </div>

            <Input
              label="Lugar o Dirección"
              placeholder="Ej: Mercado Cenepa, Tacna"
              value={editEventData.lugar}
              onChange={(e) => setEditEventData({ ...editEventData, lugar: e.target.value })}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Estado del Evento
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditEventData({ ...editEventData, estado: 'activo' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${editEventData.estado === 'activo'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-surface-800 border-white/10 text-slate-400 hover:text-white'
                    }`}
                >
                  🟢 Activo (Abierto)
                </button>
                <button
                  type="button"
                  onClick={() => setEditEventData({ ...editEventData, estado: 'finalizado' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${editEventData.estado === 'finalizado'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-surface-800 border-white/10 text-slate-400 hover:text-white'
                    }`}
                >
                  ⏸️ Finalizado (Cerrado)
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={savingEdit}
                onClick={() => setEditModalOpen(false)}
                className="flex-1"
              >
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
      {/* MODAL: ADVERTENCIA Y CONFIRMACIÓN DE ELIMINACIÓN      */}
      {/* ==================================================== */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deletingEvent && setDeleteModalOpen(false)}
        title="⚠️ Confirmar Eliminación de Evento"
        size="md"
      >
        {eventToDelete && (
          <div className="space-y-4">
            {/* Tarjeta resumen del evento a eliminar */}
            <div className="p-4 rounded-xl bg-surface-800/80 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">ID: {eventToDelete.id_evento}</span>
                <Badge variant={eventToDelete.estado === 'activo' ? 'success' : 'default'} dot>
                  {eventToDelete.estado === 'activo' ? 'Activo' : 'Finalizado'}
                </Badge>
              </div>
              <h4 className="text-base font-bold text-white">{eventToDelete.titulo}</h4>
              <div className="text-xs text-slate-300 space-y-1">
                <p>📅 {formatFecha(eventToDelete.fecha)} {eventToDelete.hora && `| ⏰ ${formatHora(eventToDelete.hora)}`}</p>
                {eventToDelete.lugar && <p>📍 {eventToDelete.lugar}</p>}
              </div>
            </div>

            {/* Advertencia adaptativa según la cantidad de asistentes */}
            {(eventToDelete.total_asistentes || 0) > 0 ? (
              <div className="p-4 rounded-xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-200 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                  <span className="text-lg">🚨</span>
                  <span>¡ADVERTENCIA CRÍTICA DE ASISTENCIA!</span>
                </div>
                <p className="text-xs leading-relaxed">
                  Este evento cuenta con <strong className="text-white underline font-bold">{eventToDelete.total_asistentes} asistente(s) registrado(s)</strong>.
                </p>
                <p className="text-xs leading-relaxed text-rose-300">
                  Si eliminas este evento, <strong>se borrarán permanentemente tanto el evento como todos los registros de asistencia vinculados</strong> de la base de datos oficial. Esta acción no se puede deshacer.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <span className="text-lg">⚠️</span>
                  <span>ADVERTENCIA DE ELIMINACIÓN</span>
                </div>
                <p className="text-xs leading-relaxed">
                  Este evento cuenta actualmente con <strong>0 asistentes registrados</strong>.
                </p>
                <p className="text-xs leading-relaxed text-amber-300">
                  ¿Estás completamente seguro de que deseas eliminar este evento? La información será borrada definitivamente de la base de datos.
                </p>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={deletingEvent}
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDeleteEvent}
                loading={deletingEvent}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold border border-rose-400/40 shadow-lg shadow-rose-950/50 cursor-pointer"
              >
                {deletingEvent ? 'Eliminando...' : 'Sí, Eliminar Evento'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================================================== */}
      {/* MODAL: CARTEL IMPRIMIBLE QR PARA LA PUERTA (MODALIDAD 3) */}
      {/* ==================================================== */}
      <Modal
        isOpen={posterModalOpen}
        onClose={() => setPosterModalOpen(false)}
        title="Cartel Oficial de Auto-Registro en Puerta"
        size="lg"
      >
        {posterEvent && (
          <div className="space-y-6">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200">
              💡 <strong>Instrucciones:</strong> Imprime este cartel en formato A4 o proyéctalo en una pantalla en la entrada del local. Los militantes escanearán el QR con su cámara común, ingresarán su DNI y el sistema registrará su asistencia automáticamente.
            </div>

            {/* Diseño Imprimible del Cartel */}
            <div
              id="printable-poster"
              className="bg-white text-slate-900 rounded-3xl p-8 border-4 border-[#842f50] text-center space-y-5 shadow-2xl relative overflow-hidden"
            >
              {/* Encabezado Institucional con Logo Oficial */}
              <div className="border-b-2 border-slate-200 pb-4">
                <img
                  src="/logo/logo.jpg"
                  alt="Logo Fuerza Tacna"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-[#f1b527] mx-auto mb-2 shadow-md"
                />
                <h2 className="text-3xl font-black text-[#842f50] tracking-wider">FUERZA TACNA</h2>
                <p className="text-xs font-black text-[#745725] uppercase tracking-widest mt-0.5">
                  Movimiento Regional • Padrón Oficial
                </p>
              </div>

              {/* Título del Evento */}
              <div className="space-y-1.5">
                <span className="inline-block px-3.5 py-1 rounded-full bg-[#fdf6f8] border border-[#e4d2dc] text-[#842f50] text-xs font-black uppercase tracking-wider">
                  Registro Oficial de Asistencia
                </span>
                <h3 className="text-2xl font-black text-slate-900 leading-snug">{posterEvent.titulo}</h3>
                <p className="text-sm font-semibold text-slate-600">
                  📅 {formatFecha(posterEvent.fecha)} {posterEvent.hora && `| ⏰ ${formatHora(posterEvent.hora)}`}{' '}
                  {posterEvent.lugar && `| 📍 ${posterEvent.lugar}`}
                </p>
              </div>

              {/* Código QR Gigante */}
              <div className="flex flex-col items-center justify-center p-5 bg-slate-50 border-2 border-[#f1b527] rounded-3xl max-w-[280px] mx-auto shadow-inner">
                <QRCodeSVG
                  value={`${originUrl}/evento/${posterEvent.id_evento}`}
                  size={220}
                  level="H"
                  bgColor="#f8fafc"
                  fgColor="#0e0401"
                />
                <span className="text-[10px] text-slate-500 font-mono font-bold mt-2">
                  ID REUNIÓN: {posterEvent.id_evento}
                </span>
              </div>

              {/* Pasos para el Militante */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-left">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-[#842f50] text-[#f8f9f9] font-black text-xs flex items-center justify-center mb-1 shadow-sm">
                    1
                  </span>
                  <p className="text-[11px] font-black text-slate-900">Apunta la Cámara</p>
                  <p className="text-[10px] text-slate-600">Escanea el código con tu celular</p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-[#f1b527] text-slate-950 font-black text-xs flex items-center justify-center mb-1 shadow-sm">
                    2
                  </span>
                  <p className="text-[11px] font-black text-slate-900">Ingresa tu DNI</p>
                  <p className="text-[10px] text-slate-600">Escribe tus 8 dígitos en la pantalla</p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center mb-1 shadow-sm">
                    3
                  </span>
                  <p className="text-[11px] font-black text-slate-900">¡Confirmado!</p>
                  <p className="text-[10px] text-slate-600">Tu asistencia queda registrada</p>
                </div>
              </div>
            </div>

            {/* Acciones del Modal */}
            <div className="flex gap-3">
              <Button onClick={handlePrintPoster} variant="accent" size="lg" className="flex-1">
                🖨️ Imprimir Cartel para la Puerta
              </Button>
              <Button onClick={() => setPosterModalOpen(false)} variant="secondary" className="flex-1">
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
