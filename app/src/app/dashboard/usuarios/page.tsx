'use client';

import { useState, useEffect, FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import type { Usuario } from '@/types';

const CARGOS_PREDEFINIDOS = [
  { value: 'Presidente', label: 'Presidente' },
  { value: 'Vicepresidente', label: 'Vicepresidente' },
  { value: 'Secretario General', label: 'Secretario General' },
  { value: 'Organizador', label: 'Organizador' },
  { value: 'Coordinador', label: 'Coordinador' },
  { value: 'Otro', label: 'Otro (Especificar...)' },
];

export default function UsuariosPage() {
  const { addToast } = useToast();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    cargoSelector: 'Presidente',
    cargoCustom: '',
    usuario: '',
    password: '',
    confirmPassword: '',
    rol: 'asistente' as 'admin' | 'asistente',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // 1. Cargar instantáneamente de sessionStorage si existe
    if (typeof window !== 'undefined') {
      try {
        const cachedStr = sessionStorage.getItem('ft_cache_usuarios');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (Array.isArray(cached) && cached.length > 0) {
            setUsuarios(cached);
            setLoading(false);
          }
        }
      } catch {}
    }
    loadUsuarios(false);
  }, []);

  const loadUsuarios = async (forceFresh = false) => {
    if (forceFresh) {
      setRefreshing(true);
    } else if (usuarios.length === 0 && !sessionStorage.getItem('ft_cache_usuarios')) {
      setLoading(true);
    }

    try {
      const url = forceFresh ? '/api/usuarios?fresh=true' : '/api/usuarios';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setUsuarios(data.data || []);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('ft_cache_usuarios', JSON.stringify(data.data || []));
        }
        if (forceFresh) {
          addToast('success', 'Lista de usuarios actualizada');
        }
      } else if (data.error === 'Acceso denegado') {
        addToast('error', 'No tienes permisos para ver esta página');
      }
    } catch {
      if (usuarios.length === 0) {
        addToast('error', 'Error al cargar usuarios');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.nombres.trim()) errors.nombres = 'Nombres requeridos';
    if (!formData.apellidos.trim()) errors.apellidos = 'Apellidos requeridos';

    const finalCargo = formData.cargoSelector === 'Otro' ? formData.cargoCustom.trim() : formData.cargoSelector;
    if (formData.cargoSelector === 'Otro' && !formData.cargoCustom.trim()) {
      errors.cargoCustom = 'Especifica el cargo del usuario';
    }

    if (!formData.usuario.trim()) errors.usuario = 'Usuario requerido';
    if (formData.usuario.trim().length < 3) errors.usuario = 'Mínimo 3 caracteres';
    if (!formData.password) errors.password = 'Requerido';
    if (formData.password.length < 6) errors.password = 'Mínimo 6 caracteres';
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Las contraseñas no coinciden';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombres: formData.nombres.trim().toUpperCase(),
          apellidos: formData.apellidos.trim().toUpperCase(),
          cargo: finalCargo,
          usuario: formData.usuario.trim().toLowerCase(),
          password: formData.password,
          rol: formData.rol,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast('success', `Usuario ${formData.nombres} creado correctamente`);
        setShowForm(false);
        setFormData({
          nombres: '',
          apellidos: '',
          cargoSelector: 'Presidente',
          cargoCustom: '',
          usuario: '',
          password: '',
          confirmPassword: '',
          rol: 'asistente',
        });
        setFormErrors({});
        await loadUsuarios(true);
      } else {
        addToast('error', data.error || 'Error al crear usuario');
      }
    } catch {
      addToast('error', 'Error de conexión');
    } finally {
      setSubmitting(false);
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
            <h1 className="text-2xl font-black text-[#f8f9f9] tracking-wide">Gestión de Usuarios</h1>
            <p className="text-xs text-primary-200/80 mt-0.5">
              Administra las personas, sus cargos orgánicos y sus privilegios en el sistema
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => loadUsuarios(true)}
            variant="secondary"
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
            onClick={() => setShowForm(!showForm)}
            variant="accent"
            size="sm"
            icon={
              showForm ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )
            }
          >
            {showForm ? 'Cancelar' : 'Nuevo Usuario'}
          </Button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 glow-brand border border-primary-400/20 animate-fadeIn">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-8 h-8 rounded-lg bg-accent-500/20 text-accent-400 flex items-center justify-center font-bold">
              👤
            </span>
            <div>
              <h3 className="text-lg font-bold text-[#f8f9f9]">Nuevo Usuario Administrativo</h3>
              <p className="text-xs text-primary-200/70">
                Completa los datos de la persona, su cargo institucional y sus credenciales
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sección 1: Datos Personales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombres"
                placeholder="Ej: Juan Carlos"
                value={formData.nombres}
                onChange={(e) => {
                  setFormData({ ...formData, nombres: e.target.value });
                  setFormErrors({ ...formErrors, nombres: '' });
                }}
                error={formErrors.nombres}
                icon={
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
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
                icon={
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              />
            </div>

            {/* Sección 2: Cargo Institucional en Fuerza Tacna */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Cargo en Fuerza Tacna"
                value={formData.cargoSelector}
                onChange={(e) => {
                  setFormData({ ...formData, cargoSelector: e.target.value });
                  setFormErrors({ ...formErrors, cargoCustom: '' });
                }}
                options={CARGOS_PREDEFINIDOS}
              />

              {formData.cargoSelector === 'Otro' ? (
                <Input
                  label="Especificar Cargo"
                  placeholder="Ej: Tesorero, Asesor, Vocero..."
                  value={formData.cargoCustom}
                  onChange={(e) => {
                    setFormData({ ...formData, cargoCustom: e.target.value });
                    setFormErrors({ ...formErrors, cargoCustom: '' });
                  }}
                  error={formErrors.cargoCustom}
                />
              ) : (
                <div className="flex items-center text-xs text-primary-200/70 p-3 bg-surface-900/60 rounded-xl border border-white/5 h-[48px] mt-6">
                  <span>🏛️ Puesto político: <strong>{formData.cargoSelector}</strong></span>
                </div>
              )}
            </div>

            {/* Sección 3: Credenciales y Privilegios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/5">
              <Input
                label="Nombre de Usuario / DNI"
                placeholder="Ej: 76172168 o jperez"
                value={formData.usuario}
                onChange={(e) => {
                  setFormData({ ...formData, usuario: e.target.value });
                  setFormErrors({ ...formErrors, usuario: '' });
                }}
                error={formErrors.usuario}
                icon={
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                  </svg>
                }
              />

              <div>
                <Select
                  label="Rol / Privilegio en el Software"
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value as 'admin' | 'asistente' })}
                  options={[
                    { value: 'asistente', label: 'Asistente (Solo registro y escáner)' },
                    { value: 'admin', label: 'Administrador (Control total del sistema)' },
                  ]}
                />
                <p className="text-[11px] text-primary-200/60 mt-1">
                  {formData.rol === 'admin'
                    ? '🛡️ Control total: gestión de eventos, usuarios, reportes y aprobaciones.'
                    : '📋 Acceso operativo: consulta y registro de militantes y control de asistencia.'}
                </p>
              </div>
            </div>

            {/* Sección 4: Contraseñas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Contraseña"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  setFormErrors({ ...formErrors, password: '' });
                }}
                error={formErrors.password}
              />
              <Input
                label="Confirmar contraseña"
                type="password"
                placeholder="Repite la contraseña"
                value={formData.confirmPassword}
                onChange={(e) => {
                  setFormData({ ...formData, confirmPassword: e.target.value });
                  setFormErrors({ ...formErrors, confirmPassword: '' });
                }}
                error={formErrors.confirmPassword}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="accent" loading={submitting}>
                Crear Usuario
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <SkeletonTable rows={3} />
      ) : (
        <div className="glass rounded-2xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-surface-900/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombres y Apellidos</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cargo en Fuerza Tacna</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Rol de Sistema</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-500">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      No hay usuarios registrados
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u) => {
                    const fullName = `${u.nombres || ''} ${u.apellidos || ''}`.trim();
                    return (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-500 font-mono">{u.id}</td>
                        <td className="px-4 py-3 text-sm text-white font-medium">
                          {fullName ? (
                            <span className="font-semibold text-[#f8f9f9]">{fullName}</span>
                          ) : (
                            <span className="text-slate-500 italic text-xs">No registrado</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-accent-400 font-bold">{u.usuario}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-accent-500/15 text-accent-300 border border-accent-400/30">
                            🏛️ {u.cargo || 'Militante'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={u.rol === 'admin' ? 'info' : 'default'} dot>
                            {u.rol === 'admin' ? 'Administrador' : 'Asistente'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
