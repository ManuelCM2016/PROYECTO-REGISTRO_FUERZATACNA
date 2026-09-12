'use client';

import { useState, useEffect, FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import type { Usuario } from '@/types';

export default function UsuariosPage() {
  const { addToast } = useToast();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    usuario: '',
    password: '',
    confirmPassword: '',
    rol: 'asistente',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/usuarios');
      const data = await res.json();
      if (data.success) {
        setUsuarios(data.data || []);
      } else if (data.error === 'Acceso denegado') {
        addToast('error', 'No tienes permisos para ver esta página');
      }
    } catch {
      addToast('error', 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.usuario.trim()) errors.usuario = 'Requerido';
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
          usuario: formData.usuario.trim().toLowerCase(),
          password: formData.password,
          rol: formData.rol,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast('success', 'Usuario creado correctamente');
        setShowForm(false);
        setFormData({ usuario: '', password: '', confirmPassword: '', rol: 'asistente' });
        setFormErrors({});
        loadUsuarios();
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
            <p className="text-xs text-primary-200/80 mt-0.5">Administra los accesos y roles del sistema</p>
          </div>
        </div>
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

      {/* Create Form */}
      {showForm && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 glow-brand border border-primary-400/20">
          <h3 className="text-lg font-bold text-[#f8f9f9] mb-4">Crear nuevo usuario administrativo</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre de usuario"
                placeholder="Ej: juan.perez"
                value={formData.usuario}
                onChange={(e) => {
                  setFormData({ ...formData, usuario: e.target.value });
                  setFormErrors({ ...formErrors, usuario: '' });
                }}
                error={formErrors.usuario}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              />

              <Select
                label="Rol"
                value={formData.rol}
                onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                options={[
                  { value: 'asistente', label: 'Asistente' },
                  { value: 'admin', label: 'Administrador' },
                ]}
              />
            </div>

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

            <div className="flex justify-end">
              <Button type="submit" loading={submitting}>
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
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Rol</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-12 text-slate-500">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      No hay usuarios registrados
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500 font-mono">{u.id}</td>
                      <td className="px-4 py-3 text-sm text-white font-medium">{u.usuario}</td>
                      <td className="px-4 py-3">
                        <Badge variant={u.rol === 'admin' ? 'info' : 'default'}>
                          {u.rol === 'admin' ? 'Administrador' : 'Asistente'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
