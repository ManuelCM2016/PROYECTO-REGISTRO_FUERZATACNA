import { NextResponse } from 'next/server';
import { getMilitantes, getEventos, getAsistencia } from '@/lib/google-sheets';
import type { Militante, Evento, Asistencia } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [resMilitantes, resEventos, resAsistencias] = await Promise.all([
      getMilitantes().catch(() => ({ success: false, data: [] as Militante[] })),
      getEventos().catch(() => ({ success: false, data: [] as Evento[] })),
      getAsistencia().catch(() => ({ success: false, data: [] as Asistencia[] })),
    ]);

    const militantes: Militante[] = resMilitantes.success && Array.isArray(resMilitantes.data) ? resMilitantes.data : [];
    const eventos: Evento[] = resEventos.success && Array.isArray(resEventos.data) ? resEventos.data : [];
    const asistencias: Asistencia[] = resAsistencias.success && Array.isArray(resAsistencias.data) ? resAsistencias.data : [];

    // 1. Métricas de Militantes
    const militantesTotales = militantes.length;
    let completados = 0;
    let pendientes = 0;
    let enRevision = 0;
    let inactivos = 0;
    let rechazados = 0;

    militantes.forEach((m) => {
      const st = (m.estado_registro || '').toLowerCase();
      if (st === 'completado') completados++;
      else if (st === 'en_revision') enRevision++;
      else if (st === 'inactivo') inactivos++;
      else if (st === 'rechazado') rechazados++;
      else pendientes++;
    });

    // 2. Métricas de Eventos
    const totalEventos = eventos.length;
    const eventosActivos = eventos.filter((e) => e.estado === 'activo').length;
    const eventosFinalizados = eventos.filter((e) => e.estado === 'finalizado').length;

    // 3. Métricas de Asistencia
    const totalAsistencias = asistencias.length;

    // Métodos de registro
    let countQrPuerta = 0;
    let countScanAdmin = 0;
    let countManual = 0;

    // Asistencias agrupadas por DNI
    const asistenciasPorDni: Record<
      string,
      {
        count: number;
        dni: string;
        nombres: string;
        apellidos: string;
        base: string;
        telefono: string;
        eventosIds: Set<string>;
      }
    > = {};

    asistencias.forEach((asist) => {
      if (asist.metodo === 'qr_puerta') countQrPuerta++;
      else if (asist.metodo === 'scan_admin') countScanAdmin++;
      else countManual++;

      const dniClean = (asist.dni || '').replace(/\D/g, '').trim();
      const key = dniClean || (asist.telefono || '').trim() || (asist.nombres + ' ' + asist.apellidos).trim();

      if (!key) return;

      if (!asistenciasPorDni[key]) {
        asistenciasPorDni[key] = {
          count: 0,
          dni: dniClean,
          nombres: asist.nombres || '',
          apellidos: asist.apellidos || '',
          base: asist.base || '',
          telefono: asist.telefono || '',
          eventosIds: new Set<string>(),
        };
      }

      asistenciasPorDni[key].count += 1;
      if (asist.id_evento) {
        asistenciasPorDni[key].eventosIds.add(asist.id_evento);
      }
    });

    // Mapear padrón de militantes con las asistencias registradas
    const militantesMapDni = new Map<string, Militante>();
    militantes.forEach((m) => {
      const d = (m.dni || '').replace(/\D/g, '').trim();
      if (d) militantesMapDni.set(d, m);
    });

    // Construir ranking consolidado
    // Empezar con los que asistieron a eventos
    const rankingMap = new Map<
      string,
      {
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
      }
    >();

    Object.entries(asistenciasPorDni).forEach(([key, record]) => {
      const dni = record.dni;
      const matchedMilitante = dni ? militantesMapDni.get(dni) : undefined;

      const nombres = matchedMilitante?.nombres || record.nombres || '';
      const apellidos = matchedMilitante?.apellidos || record.apellidos || '';
      const base = matchedMilitante?.base || record.base || 'Tacna';
      const telefono = matchedMilitante?.id_whatsapp || record.telefono || '';
      const estado_registro = matchedMilitante?.estado_registro || 'completado';

      rankingMap.set(key, {
        id: key,
        dni,
        nombres,
        apellidos,
        nombreCompleto: [nombres, apellidos].filter(Boolean).join(' ') || 'Militante ' + key,
        base,
        telefono,
        asistenciasCount: record.count,
        eventosCount: record.eventosIds.size,
        estado_registro,
      });
    });

    // Agregar militantes del padrón activo que quizás tengan 0 asistencias
    militantes.forEach((m) => {
      const dniClean = (m.dni || '').replace(/\D/g, '').trim();
      const key = dniClean || (m.id_whatsapp || '').trim();
      if (!key) return;

      if (!rankingMap.has(key)) {
        const nombres = m.nombres || '';
        const apellidos = m.apellidos || '';
        rankingMap.set(key, {
          id: key,
          dni: dniClean,
          nombres,
          apellidos,
          nombreCompleto: [nombres, apellidos].filter(Boolean).join(' ') || m.id_whatsapp,
          base: m.base || 'Sin asignar',
          telefono: m.id_whatsapp || '',
          asistenciasCount: 0,
          eventosCount: 0,
          estado_registro: m.estado_registro || 'pendiente',
        });
      }
    });

    // Ordenar ranking: mayor asistenciasCount primero, luego alfabético
    const sortedRanking = Array.from(rankingMap.values()).sort((a, b) => {
      if (b.asistenciasCount !== a.asistenciasCount) {
        return b.asistenciasCount - a.asistenciasCount;
      }
      return a.nombreCompleto.localeCompare(b.nombreCompleto);
    });

    const divisorEventos = Math.max(totalEventos, 1);

    const rankingFinal = sortedRanking.map((item, index) => {
      const posicion = index + 1;
      const porcentaje = Math.min(100, Math.round((item.asistenciasCount / divisorEventos) * 100));

      let nivelCompromiso = 'Sin Asistencias';
      if (porcentaje >= 90) nivelCompromiso = 'Líder Ejemplar';
      else if (porcentaje >= 60) nivelCompromiso = 'Alta Fidelidad';
      else if (porcentaje >= 30) nivelCompromiso = 'Militante Activo';
      else if (item.asistenciasCount > 0) nivelCompromiso = 'Participante';

      let medalla: 'oro' | 'plata' | 'bronce' | 'top10' | null = null;
      if (item.asistenciasCount > 0) {
        if (posicion === 1) medalla = 'oro';
        else if (posicion === 2) medalla = 'plata';
        else if (posicion === 3) medalla = 'bronce';
        else if (posicion <= 10) medalla = 'top10';
      }

      return {
        ...item,
        posicion,
        porcentaje,
        nivelCompromiso,
        medalla,
      };
    });

    // 4. Estadísticas por Base / Distrito
    const basesStatsMap: Record<
      string,
      {
        nombre: string;
        militantesCount: number;
        asistenciasCount: number;
      }
    > = {};

    militantes.forEach((m) => {
      const b = (m.base || 'Sin Base').trim();
      if (!basesStatsMap[b]) {
        basesStatsMap[b] = { nombre: b, militantesCount: 0, asistenciasCount: 0 };
      }
      basesStatsMap[b].militantesCount += 1;
    });

    asistencias.forEach((asist) => {
      const b = (asist.base || 'Sin Base').trim();
      if (!basesStatsMap[b]) {
        basesStatsMap[b] = { nombre: b, militantesCount: 0, asistenciasCount: 0 };
      }
      basesStatsMap[b].asistenciasCount += 1;
    });

    const basesStats = Object.values(basesStatsMap).sort((a, b) => b.asistenciasCount - a.asistenciasCount);

    // 5. Asistencia acumulada por evento
    const eventosStats = eventos.map((ev) => {
      const count = asistencias.filter((a) => a.id_evento === ev.id_evento).length;
      return {
        id_evento: ev.id_evento,
        titulo: ev.titulo,
        fecha: ev.fecha,
        hora: ev.hora,
        lugar: ev.lugar,
        estado: ev.estado,
        total_asistentes: count || ev.total_asistentes || 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        resumen: {
          totalMilitantes: militantesTotales,
          completados,
          pendientes,
          enRevision,
          inactivos,
          rechazados,
          totalEventos,
          eventosActivos,
          eventosFinalizados,
          totalAsistencias,
          tasaPromedio: totalEventos > 0 ? (totalAsistencias / totalEventos).toFixed(1) : '0',
        },
        ranking: rankingFinal,
        bases: basesStats,
        eventos: eventosStats,
        metodos: {
          qr_puerta: countQrPuerta,
          scan_admin: countScanAdmin,
          manual: countManual,
        },
      },
    });
  } catch (error) {
    console.error('Error generating statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Error al generar estadísticas del sistema' },
      { status: 500 }
    );
  }
}
