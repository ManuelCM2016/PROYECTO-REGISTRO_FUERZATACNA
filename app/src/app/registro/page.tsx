'use client';

import { useState, FormEvent, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import CarnetDigital from '@/components/CarnetDigital';
import { useToast } from '@/components/ui/Toast';
import { PREFIJOS_TELEFONICOS, BASES_DISPONIBLES } from '@/lib/constants';

type Step = 'phone' | 'form' | 'success' | 'already_registered' | 'in_review';

interface MilitanteData {
  id_whatsapp: string;
  nombres: string;
  apellidos: string;
  dni: string;
  base: string;
  rowIndex?: number;
  estado_registro?: string;
}

export default function RegistroPage() {
  const { addToast } = useToast();

  // Estado general
  const [step, setStep] = useState<Step>('phone');
  const [loading, setLoading] = useState(false);
  const [isNewMilitante, setIsNewMilitante] = useState(false);

  // Paso 1: Teléfono
  const [prefix, setPrefix] = useState('+51');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Paso 2: Formulario
  const [formData, setFormData] = useState<MilitanteData>({
    id_whatsapp: '',
    nombres: '',
    apellidos: '',
    dni: '',
    base: '',
  });

  // Validación DNI duplicado
  const [dniChecking, setDniChecking] = useState(false);
  const [dniDuplicateError, setDniDuplicateError] = useState<string | null>(null);

  // Errores de validación
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Datos para confirmación / QR
  const [registeredData, setRegisteredData] = useState<MilitanteData | null>(null);

  const rawDigits = phoneNumber.replace(/\D/g, '');
  const countryDigits = prefix.replace(/\D/g, '');
  const cleanDigits = rawDigits.startsWith(countryDigits) && rawDigits.length > countryDigits.length
    ? rawDigits.slice(countryDigits.length)
    : rawDigits;

  const fullPhone = `${prefix} ${cleanDigits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}`;
  const cleanPhone = `${prefix}${cleanDigits}`;

  // ---- Paso 1: Verificar teléfono ----
  const handleVerifyPhone = async (e: FormEvent) => {
    e.preventDefault();

    if (cleanDigits.length < 8) {
      setErrors({ phone: 'Ingresa un número de teléfono válido (mínimo 8-9 dígitos)' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch(`/api/militantes/verificar?telefono=${encodeURIComponent(cleanPhone)}`);
      const data = await res.json();

      if (!data.success) {
        addToast('error', data.error || 'Error al verificar teléfono');
        return;
      }

      if (data.status === 'completado') {
        setRegisteredData(data.data);
        setStep('already_registered');
      } else if (data.status === 'en_revision') {
        setRegisteredData(data.data);
        setStep('in_review');
      } else if (data.status === 'rechazado') {
        addToast('error', 'Esta solicitud de registro no fue admitida por el administrador.');
      } else if (data.status === 'pendiente' || data.found) {
        // Teléfono existe y está pendiente
        setFormData({
          id_whatsapp: data.data?.id_whatsapp || cleanPhone,
          nombres: data.data?.nombres || '',
          apellidos: data.data?.apellidos || '',
          dni: data.data?.dni || '',
          base: data.data?.base || '',
          rowIndex: data.data?.rowIndex,
        });
        setIsNewMilitante(false);
        setStep('form');
      } else {
        // Teléfono no existe, registrar como solicitud nueva
        setFormData({
          id_whatsapp: fullPhone,
          nombres: '',
          apellidos: '',
          dni: '',
          base: '',
        });
        setIsNewMilitante(true);
        setStep('form');
      }
    } catch {
      addToast('error', 'Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Manejar cambio de DNI y verificar duplicados ----
  const handleDniChange = async (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 8);
    setFormData((prev) => ({ ...prev, dni: clean }));
    setErrors((prev) => ({ ...prev, dni: '' }));
    setDniDuplicateError(null);

    // Cuando completa 8 dígitos, verificar duplicado en tiempo real
    if (clean.length === 8) {
      setDniChecking(true);
      try {
        const res = await fetch(`/api/militantes/check-dni?dni=${clean}`);
        const data = await res.json();

        if (data.success && data.found) {
          setDniDuplicateError(
            `El DNI ${clean} ya se encuentra registrado en el padrón de Fuerza Tacna. Por motivos de seguridad no se permite alterar información registrada. Por favor, comunícate con el administrador.`
          );
        }
      } catch {
        // Fallback silencioso si la red falla
      } finally {
        setDniChecking(false);
      }
    }
  };

  // ---- Paso 2: Enviar formulario ----
  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault();

    if (dniDuplicateError) {
      addToast('warning', 'No puedes registrar un DNI que ya existe en el padrón');
      return;
    }

    // Validaciones
    const newErrors: Record<string, string> = {};
    if (!formData.dni || formData.dni.length !== 8 || !/^\d{8}$/.test(formData.dni)) {
      newErrors.dni = 'El DNI debe tener exactamente 8 dígitos';
    }
    if (!formData.nombres.trim()) {
      newErrors.nombres = 'Los nombres son requeridos';
    }
    if (!formData.apellidos.trim()) {
      newErrors.apellidos = 'Los apellidos son requeridos';
    }
    if (!formData.base) {
      newErrors.base = 'Selecciona una base';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      let res: Response;

      if (isNewMilitante) {
        // Solicitud de nuevo militante -> entra en revisión (amarillo en Sheet)
        res = await fetch('/api/militantes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telefono: fullPhone,
            nombres: formData.nombres.trim().toUpperCase(),
            apellidos: formData.apellidos.trim().toUpperCase(),
            dni: formData.dni.trim(),
            base: formData.base,
            estado_registro: 'en_revision',
            canal_registro: 'Solicitud Web',
          }),
        });
      } else {
        // Actualizar militante pre-cargado que estaba pendiente -> completado
        res = await fetch(`/api/militantes/${encodeURIComponent(cleanPhone)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rowIndex: formData.rowIndex,
            nombres: formData.nombres.trim().toUpperCase(),
            apellidos: formData.apellidos.trim().toUpperCase(),
            dni: formData.dni.trim(),
            base: formData.base,
            estado_registro: 'completado',
            canal_registro: 'Auto-registro',
          }),
        });
      }

      const data = await res.json();

      if (data.success) {
        setRegisteredData({
          ...formData,
          nombres: formData.nombres.trim().toUpperCase(),
          apellidos: formData.apellidos.trim().toUpperCase(),
          estado_registro: isNewMilitante ? 'en_revision' : 'completado',
        });

        if (isNewMilitante) {
          setStep('in_review');
          addToast('info', 'Solicitud enviada a revisión');
        } else {
          setStep('success');
          addToast('success', '¡Registro completado exitosamente!');
        }
      } else {
        addToast('error', data.error || 'Error al guardar los datos');
      }
    } catch {
      addToast('error', 'Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Reset ----
  const handleReset = () => {
    setStep('phone');
    setPhoneNumber('');
    setFormData({ id_whatsapp: '', nombres: '', apellidos: '', dni: '', base: '' });
    setErrors({});
    setDniDuplicateError(null);
    setRegisteredData(null);
    setIsNewMilitante(false);
  };

  // ---- QR Data (solo para aprobados) ----
  const qrData = registeredData
    ? JSON.stringify({
      dni: registeredData.dni,
      nombres: registeredData.nombres,
      apellidos: registeredData.apellidos,
      base: registeredData.base,
      telefono: registeredData.id_whatsapp,
    })
    : '';

  return (
    <div
      className={`w-full transition-all duration-300 mx-auto px-1 sm:px-0 mt-2 ${
        step === 'success' || step === 'already_registered'
          ? 'max-w-2xl'
          : 'max-w-md'
      }`}
    >
      {/* Indicador de pasos */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {['Teléfono', 'Datos', 'Confirmación'].map((label, i) => {
          const stepIndex = i;
          const currentIndex = step === 'phone' ? 0 : step === 'form' ? 1 : 2;
          const isActive = stepIndex === currentIndex;
          const isCompleted = stepIndex < currentIndex;

          return (
            <div key={label} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${isCompleted
                    ? 'step-completed text-white'
                    : isActive
                      ? 'step-active text-white'
                      : 'bg-surface-700 text-slate-500'
                    }`}
                >
                  {isCompleted ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] mt-1 ${isActive || isCompleted ? 'text-slate-300' : 'text-slate-600'}`}>
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div
                  className={`w-12 h-0.5 mb-4 rounded transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-surface-700'
                    }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ========== PASO 1: TELÉFONO ========== */}
      {step === 'phone' && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 glow-brand border border-primary-400/20">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 flex items-center justify-center mx-auto mb-4 border border-accent-400/30 shadow-xl shadow-primary-950/60">
              <svg className="w-8 h-8 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#f8f9f9] mb-1.5">Registro de Militante</h2>
            <p className="text-xs sm:text-sm text-primary-200/80 max-w-xs mx-auto">
              Ingresa tu número de WhatsApp registrado en el padrón o grupo oficial
            </p>
          </div>

          <form onSubmit={handleVerifyPhone} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-primary-200 mb-1.5">
                Número de teléfono
              </label>
              <div className="flex gap-2">
                <select
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-28 rounded-xl border border-primary-200/20 bg-surface-850/90 text-[#f8f9f9] px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50 appearance-none"
                >
                  {PREFIJOS_TELEFONICOS.map((p) => (
                    <option key={p.code} value={p.code} className="bg-surface-900 text-[#f8f9f9]">
                      {p.flag} {p.code}
                    </option>
                  ))}
                </select>
                <Input
                  type="tel"
                  placeholder="912 345 678"
                  value={phoneNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setPhoneNumber(val);
                    setErrors({});
                  }}
                  error={errors.phone}
                  className="flex-1"
                  maxLength={9}
                  inputMode="tel"
                />
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg" variant="accent">
              Verificar Número
            </Button>
          </form>
        </div>
      )}

      {/* ========== PASO 2: FORMULARIO ========== */}
      {step === 'form' && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 glow-brand border border-primary-400/20">
          <div className="text-center mb-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl border ${isNewMilitante
              ? 'bg-gradient-to-br from-accent-500 to-accent-600 border-accent-300 text-surface-950 shadow-accent-500/25'
              : 'bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 border-accent-400/40 text-accent-400 shadow-primary-950/60'
              }`}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#f8f9f9] mb-1">
              {isNewMilitante ? 'Solicitud de Incorporación' : 'Completa tu Registro'}
            </h2>
            <p className="text-xs sm:text-sm text-primary-200/80">
              Teléfono: <span className="text-accent-400 font-bold font-mono">{fullPhone}</span>
            </p>
          </div>

          {/* Aviso especial si es nuevo */}
          {isNewMilitante && (
            <div className="p-3.5 mb-5 rounded-xl bg-accent-500/10 border border-accent-500/30 flex items-start gap-3">
              <span className="text-accent-400 text-lg leading-none mt-0.5">ℹ️</span>
              <p className="text-xs text-accent-200 leading-relaxed">
                Tu número no figura en el padrón previo. Al completar tus datos, enviarás una <strong>solicitud de incorporación</strong> que será revisada por la administración de Fuerza Tacna.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div>
              <Input
                label="DNI (8 dígitos)"
                type="text"
                placeholder="12345678"
                value={formData.dni}
                onChange={(e) => handleDniChange(e.target.value)}
                error={errors.dni}
                maxLength={8}
                inputMode="numeric"
                icon={
                  dniChecking ? (
                    <div className="w-4 h-4 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                    </svg>
                  )
                }
              />

              {/* ALERTA DE DNI DUPLICADO (BLOQUEO) */}
              {dniDuplicateError && (
                <div className="p-3.5 mt-2 rounded-xl bg-red-500/15 border border-red-500/30 flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-xs text-red-200 leading-relaxed">
                    <p className="font-semibold text-red-300 mb-0.5">DNI ya registrado en el padrón</p>
                    <p>{dniDuplicateError}</p>
                  </div>
                </div>
              )}
            </div>

            <Input
              label="Nombres"
              type="text"
              placeholder="Ej: Juan Carlos"
              value={formData.nombres}
              onChange={(e) => {
                setFormData({ ...formData, nombres: e.target.value });
                setErrors({ ...errors, nombres: '' });
              }}
              error={errors.nombres}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />

            <Input
              label="Apellidos"
              type="text"
              placeholder="Ej: Pérez Gómez"
              value={formData.apellidos}
              onChange={(e) => {
                setFormData({ ...formData, apellidos: e.target.value });
                setErrors({ ...errors, apellidos: '' });
              }}
              error={errors.apellidos}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />

            <Select
              label="Base"
              value={formData.base}
              onChange={(e) => {
                setFormData({ ...formData, base: e.target.value });
                setErrors({ ...errors, base: '' });
              }}
              error={errors.base}
              placeholder="Selecciona tu base"
              options={BASES_DISPONIBLES.map((b) => ({ value: b, label: b }))}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="flex-1"
              >
                ← Volver
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={dniChecking || !!dniDuplicateError}
                className="flex-1"
                size="lg"
                variant={isNewMilitante ? 'accent' : 'primary'}
              >
                {isNewMilitante ? 'Enviar Solicitud' : 'Registrarme'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ========== PASO 3A: ÉXITO OFICIAL (COMPLETADO) ========== */}
      {step === 'success' && registeredData && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 text-center glow-accent">
            <div className="float-animation mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">¡Registro Completado con Éxito!</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Bienvenido(a) a Fuerza Tacna. A continuación tienes tu <strong>Credencial Oficial de Militante</strong> lista para descargar o compartir.
            </p>
          </div>

          {/* Credencial Digital Horizontal Descargable */}
          <CarnetDigital militante={registeredData} />

          <div className="text-center pt-2">
            <Button onClick={handleReset} variant="ghost" className="text-slate-400 hover:text-white">
              ← Realizar otro registro
            </Button>
          </div>
        </div>
      )}

      {/* ========== PASO 3B: EN REVISIÓN (AMARILLO / ÁMBAR) ========== */}
      {step === 'in_review' && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 text-center border-2 border-accent-500/40 glow-gold">
          <div className="mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-500 via-accent-400 to-accent-600 flex items-center justify-center mx-auto shadow-xl shadow-accent-500/30 text-surface-950">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-accent-500/20 text-accent-300 border border-accent-400/40 mb-3">
            <span className="w-2 h-2 rounded-full bg-accent-400 animate-ping" />
            Solicitud en Revisión
          </div>

          <h2 className="text-2xl font-black text-[#f8f9f9] mb-2">¡Solicitud Recibida!</h2>
          <p className="text-primary-200/90 text-sm mb-6 leading-relaxed max-w-md mx-auto">
            Tus datos han sido registrados en estado <strong>Pendiente de Revisión</strong>. Nuestro equipo directivo de Fuerza Tacna verificará tu solicitud para activar tu credencial oficial.
          </p>

          {registeredData && (
            <div className="glass-light rounded-2xl p-4 sm:p-5 mb-6 text-left space-y-2.5 border border-primary-400/20">
              <div className="flex justify-between text-sm">
                <span className="text-primary-300">DNI:</span>
                <span className="text-accent-300 font-bold font-mono">{registeredData.dni}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-primary-300">Postulante:</span>
                <span className="text-[#f8f9f9] font-semibold">{registeredData.nombres} {registeredData.apellidos}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-primary-300">Base:</span>
                <span className="text-primary-100 font-semibold">{registeredData.base}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-primary-300">Teléfono:</span>
                <span className="text-[#f8f9f9] font-mono">{registeredData.id_whatsapp}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-primary-400/20">
                <span className="text-primary-300">Estado:</span>
                <span className="text-accent-400 font-bold">En revisión administrativa</span>
              </div>
            </div>
          )}

          <div className="p-3.5 mb-6 rounded-xl bg-surface-850/90 border border-primary-200/10 text-xs text-primary-200/80 text-left">
            💡 <strong>¿Qué sucede ahora?</strong> Un administrador o asistente validará tu información en el padrón central. Una vez admitido, al consultar tu número en esta misma página podrás descargar tu credencial QR oficial.
          </div>

          <Button onClick={handleReset} variant="secondary" className="w-full">
            ← Volver al Inicio
          </Button>
        </div>
      )}

      {/* ========== YA REGISTRADO ========== */}
      {step === 'already_registered' && registeredData && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-white mb-1">Militante Oficial Registrado</h2>
            <p className="text-sm text-slate-400 mb-2">
              El número <span className="text-primary-400 font-medium">{fullPhone}</span> cuenta con registro oficial activo.
            </p>
          </div>

          {/* Credencial Digital Horizontal Descargable */}
          <CarnetDigital militante={registeredData} />

          <div className="text-center pt-2">
            <Button onClick={handleReset} variant="ghost" className="text-slate-400 hover:text-white">
              ← Consultar otro número
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
