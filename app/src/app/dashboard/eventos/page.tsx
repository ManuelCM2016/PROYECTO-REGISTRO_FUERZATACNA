'use client';

import { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatFecha, formatHora, formatFechaHora } from '@/lib/formatters';
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [newEventData, setNewEventData] = useState({
    titulo: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: '18:00',
    lugar: '',
  });

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

  const loadEventos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/eventos');
      const data = await res.json();
      if (data.success && data.data) {
        setEventos(data.data);
      }
    } catch {
      addToast('error', 'Error al cargar la lista de eventos');
    } finally {
      setLoading(false);
    }
  };

  const loadAsistencia = async (idEvento: string) => {
    setLoadingAsistencia(true);
    try {
      const res = await fetch(`/api/eventos/${idEvento}/asistencia`);
      const data = await res.json();
      if (data.success && data.data) {
        setAsistentes(data.data);
      }
    } catch {
      addToast('error', 'Error al cargar la lista de asistencia');
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
        await loadEventos();
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
        await loadEventos();
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
        } catch {}
      }

      const qrScanner = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = qrScanner;

      await qrScanner.start(
        { facingMode: 'environment' }, // Cámara trasera preferida
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
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
      } catch {}
      html5QrCodeRef.current = null;
    }
  };

  // Procesa el texto detectado por el escáner QR
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

      // Verificación de duplicidad síncrona en memoria (Anti-rebote estricto de 6 segundos)
      const now = Date.now();
      const lastScan = lastScannedTimeRef.current[extractedDni] || 0;
      if (now - lastScan < 6000) {
        // Ignorar de inmediato: ya fue procesado o está en proceso
        return;
      }

      // BLOQUEO INMEDIATO SÍNCRONO (impide que frames subsiguientes de la cámara ejecuten otra llamada)
      isScanningLockedRef.current = true;
      lastScannedTimeRef.current[extractedDni] = now;
      setScanningLocked(true);

      // Pausar procesamiento de frames de la cámara mientras se registra
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.pause(true);
        } catch {}
      }

      try {
        const res = await fetch(`/api/eventos/${currentEvent.id_evento}/asistencia`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dni: extractedDni,
            metodo: 'scan_admin',
          }),
        });

        const result = await res.json();

        if (result.success && result.data) {
          playSuccessBeep();
          setLastScannedResult({
            status: 'success',
            message: `¡Asistencia registrada!`,
            militante: {
              nombres: result.data.nombres,
              apellidos: result.data.apellidos,
              dni: result.data.dni,
              base: result.data.base,
            },
          });
          // Actualizar lista en vivo
          loadAsistencia(currentEvent.id_evento);
        } else if (result.alreadyMarked) {
          setLastScannedResult({
            status: 'already',
            message: result.message || 'Esta persona ya había marcado asistencia en este evento.',
            militante: result.data,
          });
        } else if (result.notFound) {
          setLastScannedResult({
            status: 'not_found',
            message: `DNI ${extractedDni} no figura en el padrón oficial.`,
          });
        } else {
          setLastScannedResult({
            status: 'error',
            message: result.error || 'No se pudo registrar la asistencia.',
          });
        }
      } catch {
        setLastScannedResult({
          status: 'error',
          message: 'Error de conexión al registrar asistencia.',
        });
      } finally {
        setTimeout(() => {
          isScanningLockedRef.current = false;
          setScanningLocked(false);
          // Reanudar cámara
          if (html5QrCodeRef.current) {
            try {
              html5QrCodeRef.current.resume();
            } catch {}
          }
        }, 2500);
      }
    },
    []
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
        await loadAsistencia(selectedEvent.id_evento);
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
                        <span className="text-xs text-slate-400 font-mono">ID: {ev.id_evento}</span>
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
            </div>
          </div>

          {/* Navegación por Pestañas de Modalidad */}
          <div className="flex items-center gap-2 p-1.5 bg-surface-800/90 rounded-2xl border border-white/5 overflow-x-auto">
            <button
              onClick={() => {
                setActiveTab('scan');
                setScannerActive(true);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'scan'
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'manual'
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'list'
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
              <div className="lg:col-span-2 glass rounded-2xl p-6 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Escáner de Credenciales de Militantes</h3>
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

                {/* Contenedor de la Cámara de html5-qrcode */}
                <div className="relative rounded-2xl overflow-hidden bg-black/80 aspect-video flex flex-col items-center justify-center border border-white/10">
                  <div id="reader-cam" className="w-full h-full max-h-[360px]" />

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
                    className={`p-4 rounded-xl border transition-all ${
                      lastScannedResult.status === 'success'
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

              {/* DNI No Encontrado */}
              {manualNotFound && (
                <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-center space-y-2">
                  <p className="text-sm font-bold text-red-300">DNI no empadronado</p>
                  <p className="text-xs text-slate-300">
                    El DNI <strong className="font-mono">{manualDni}</strong> no figura en el padrón oficial de Fuerza Tacna.
                  </p>
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
                        <th className="px-4 py-3 hidden sm:table-cell">Base</th>
                        <th className="px-4 py-3 hidden md:table-cell">Teléfono</th>
                        <th className="px-4 py-3">Hora Registro</th>
                        <th className="px-4 py-3">Modalidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asistentes.map((a, i) => (
                        <tr
                          key={`${a.id_asistencia}-${i}`}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{i + 1}</td>
                          <td className="px-4 py-3 font-mono font-bold text-white">{a.dni}</td>
                          <td className="px-4 py-3 text-slate-200 font-medium">
                            {a.nombres} {a.apellidos}
                          </td>
                          <td className="px-4 py-3 text-sky-400 text-xs hidden sm:table-cell">
                            {a.base || '—'}
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
