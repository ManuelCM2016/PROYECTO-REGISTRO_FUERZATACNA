'use client';

import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface CarnetDigitalProps {
  militante: {
    dni: string;
    nombres: string;
    apellidos: string;
    base: string;
    id_whatsapp: string;
  };
}

export default function CarnetDigital({ militante }: CarnetDigitalProps) {
  const { addToast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // URL pública de validación que codifica el QR
  const validationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/validar/${militante.dni}`
    : `/validar/${militante.dni}`;

  // Función para descargar el carnet en PNG de alta resolución (1200 x 720 px)
  const downloadCarnet = async () => {
    setDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar canvas');

      const width = 1200;
      const height = 720;
      canvas.width = width;
      canvas.height = height;

      // 1. Fondo con degradado institucional Fuerza Tacna (#0e0401 -> #1f0c15 -> #0e0401)
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0e0401');
      bgGrad.addColorStop(0.5, '#1f0c15');
      bgGrad.addColorStop(1, '#0e0401');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Halos y formas decorativas en vino (#842f50) y dorado (#f1b527)
      ctx.fillStyle = 'rgba(241, 181, 39, 0.05)';
      ctx.beginPath();
      ctx.arc(1100, 100, 320, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(132, 47, 80, 0.12)';
      ctx.beginPath();
      ctx.arc(120, 650, 360, 0, Math.PI * 2);
      ctx.fill();

      // Marco dorado exterior oficial (#f1b527)
      ctx.strokeStyle = '#f1b527';
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, width - 40, height - 40);

      // Marco interior fino en lila suave (#e4d2dc)
      ctx.strokeStyle = 'rgba(228, 210, 220, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(32, 32, width - 64, height - 64);

      // 3. Franja superior institucional en vino Fuerza Tacna (#842f50)
      const headerGrad = ctx.createLinearGradient(32, 32, width - 32, 142);
      headerGrad.addColorStop(0, '#842f50');
      headerGrad.addColorStop(1, '#421125');
      ctx.fillStyle = headerGrad;
      ctx.fillRect(32, 32, width - 64, 110);

      // Línea divisoria dorada (#f1b527)
      ctx.fillStyle = '#f1b527';
      ctx.fillRect(32, 142, width - 64, 4);

      // 4. Logo Oficial de Fuerza Tacna en Header
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = '/logo/logo.jpg';
        await new Promise((resolve) => {
          logoImg.onload = resolve;
          logoImg.onerror = resolve;
        });

        if (logoImg.complete && logoImg.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(95, 87, 38, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(logoImg, 57, 49, 76, 76);
          ctx.restore();
        } else {
          // Fallback circular
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(95, 87, 38, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#842f50';
          ctx.font = '900 32px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('FT', 95, 99);
        }
      } catch (e) {
        console.warn('Fallback logo', e);
      }

      // Anillo dorado exterior al logo
      ctx.strokeStyle = '#f1b527';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(95, 87, 38, 0, Math.PI * 2);
      ctx.stroke();

      // Texto de cabecera
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f8f9f9';
      ctx.font = '900 38px sans-serif';
      ctx.fillText('FUERZA TACNA', 155, 80);

      ctx.fillStyle = '#f1b527';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('CREDENCIAL OFICIAL DE MILITANTE', 158, 112);

      // Badge de año en la esquina superior derecha
      ctx.fillStyle = '#f1b527';
      ctx.beginPath();
      ctx.roundRect(width - 195, 62, 135, 44, 8);
      ctx.fill();

      ctx.fillStyle = '#0e0401';
      ctx.font = '900 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PADRÓN 2026', width - 127, 90);

      // 5. Contenido Principal: Datos del Militante (Lado Izquierdo)
      ctx.textAlign = 'left';

      // Etiqueta Nombre
      ctx.fillStyle = '#a87a8e';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('NOMBRES Y APELLIDOS', 65, 205);

      // Nombre del Militante
      ctx.fillStyle = '#f8f9f9';
      ctx.font = '900 36px sans-serif';
      const fullName = `${militante.nombres} ${militante.apellidos}`.toUpperCase();
      ctx.fillText(fullName.length > 28 ? fullName.substring(0, 28) + '...' : fullName, 65, 250);

      // Caja de DNI (Destacada en tonalidad vino institucional y borde dorado)
      ctx.fillStyle = 'rgba(132, 47, 80, 0.25)';
      ctx.beginPath();
      ctx.roundRect(65, 280, 285, 95, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(241, 181, 39, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#f1b527';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('DOCUMENTO DE IDENTIDAD', 85, 310);

      ctx.fillStyle = '#f8f9f9';
      ctx.font = '900 42px monospace';
      ctx.fillText(`DNI ${militante.dni}`, 85, 355);

      // Base asignada
      ctx.fillStyle = '#a87a8e';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('BASE ASIGNADA', 385, 310);

      ctx.fillStyle = '#e4d2dc';
      ctx.font = 'bold 24px sans-serif';
      const baseText = militante.base.length > 26 ? militante.base.substring(0, 26) + '...' : militante.base;
      ctx.fillText(baseText, 385, 345);

      // Teléfono WhatsApp
      ctx.fillStyle = '#a87a8e';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('TELÉFONO REGISTRADO', 65, 430);

      ctx.fillStyle = '#f8f9f9';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(militante.id_whatsapp, 65, 465);

      // Badge de Estado Activo
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.beginPath();
      ctx.roundRect(385, 425, 280, 50, 10);
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(410, 450, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#6ee7b7';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('MILITANTE ACTIVO', 430, 456);

      // 6. Lado Derecho: Contenedor y Código QR
      const qrBoxX = width - 420;
      const qrBoxY = 175;
      const qrBoxW = 360;
      const qrBoxH = 460;

      // Caja blanca para QR
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 16);
      ctx.fill();
      ctx.strokeStyle = '#f1b527';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Renderizar el SVG del QR a imagen sobre el canvas
      if (qrRef.current) {
        const svgEl = qrRef.current.querySelector('svg');
        if (svgEl) {
          const svgData = new XMLSerializer().serializeToString(svgEl);
          const img = new Image();
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);

          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              // Dibujar QR centrado en la caja blanca
              ctx.drawImage(img, qrBoxX + 45, qrBoxY + 35, 270, 270);
              URL.revokeObjectURL(url);
              resolve();
            };
            img.onerror = reject;
            img.src = url;
          });
        }
      }

      // Texto bajo el QR
      ctx.fillStyle = '#842f50';
      ctx.font = '900 17px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CÓDIGO DE ASISTENCIA Y CONTROL', qrBoxX + qrBoxW / 2, qrBoxY + 340);

      ctx.fillStyle = '#745725';
      ctx.font = '14px sans-serif';
      ctx.fillText('Escanea para validar autenticidad', qrBoxX + qrBoxW / 2, qrBoxY + 368);
      ctx.fillText('o registrar asistencia en eventos', qrBoxX + qrBoxW / 2, qrBoxY + 390);

      // Franja de validación bajo el QR (en vino institucional)
      ctx.fillStyle = '#842f50';
      ctx.beginPath();
      ctx.roundRect(qrBoxX + 25, qrBoxY + 408, qrBoxW - 50, 36, 6);
      ctx.fill();

      ctx.fillStyle = '#f8f9f9';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`ID: FT-${militante.dni}`, qrBoxX + qrBoxW / 2, qrBoxY + 431);

      // 7. Pie de Página del Carnet
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(132, 47, 80, 0.25)';
      ctx.fillRect(32, height - 70, width - 64, 38);

      ctx.fillStyle = '#f1b527';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('🏛️ FUERZA TACNA', 55, height - 46);

      ctx.fillStyle = '#e4d2dc';
      ctx.font = '14px sans-serif';
      ctx.fillText('•   Unidos por el Desarrollo y la Dignidad de Nuestra Región', 220, height - 46);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#f1b527';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('DOCUMENTO OFICIAL DIGITAL', width - 60, height - 46);

      // 8. Convertir Canvas a Imagen y Descargar
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `Credencial_FuerzaTacna_${militante.dni}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast('success', '¡Credencial descargada con éxito!');
    } catch (err) {
      console.error('Error al generar carnet:', err);
      addToast('error', 'No se pudo generar la imagen del carnet');
    } finally {
      setDownloading(false);
    }
  };

  // Función para compartir por WhatsApp
  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(
      `¡Hola! Ya completé mi registro oficial en Fuerza Tacna 🏛️.\nMi DNI es ${militante.dni} y mi credencial digital ya está activa.\n\nSi aún no te has empadronado, ingresa aquí:\n${window.location.origin}/registro`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Contenedor Oculto para renderizar el QR en SVG para el Canvas */}
      <div ref={qrRef} className="hidden">
        <QRCodeSVG
          value={validationUrl}
          size={270}
          level="H"
          marginSize={2}
          bgColor="#ffffff"
          fgColor="#0e0401"
        />
      </div>

      {/* Tarjeta Visual en Pantalla (Formato Horizontal) */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-accent-500/50 shadow-2xl bg-gradient-to-br from-surface-900 via-surface-800 to-surface-900 p-0.5 glow-brand transition-all duration-300">
        <div className="relative rounded-[14px] overflow-hidden bg-surface-900/95 p-4 sm:p-6">
          {/* Cabecera del carnet */}
          <div className="flex items-center justify-between pb-4 border-b border-primary-500/30">
            <div className="flex items-center gap-3">
              <img
                src="/logo/logo.jpg"
                alt="Logo Fuerza Tacna"
                className="w-12 h-12 rounded-xl object-cover border-2 border-accent-400 shadow-md shadow-accent-500/30 shrink-0"
              />
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#f8f9f9] tracking-wide leading-none">
                  FUERZA TACNA
                </h3>
                <p className="text-[10px] sm:text-[11px] text-accent-400 font-bold uppercase tracking-wider mt-1">
                  Credencial Oficial de Militante
                </p>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full bg-accent-500/20 border border-accent-400/50 text-accent-300 text-[11px] sm:text-xs font-black shrink-0 tracking-wider">
              PADRÓN 2026
            </div>
          </div>

          {/* Cuerpo del carnet (Horizontal: Datos a la izquierda, QR a la derecha) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 py-5 items-center">
            {/* Lado izquierdo: Datos del Militante */}
            <div className="sm:col-span-7 md:col-span-8 space-y-3.5">
              <div>
                <p className="text-[10px] text-primary-300 uppercase tracking-widest font-bold">Nombres y Apellidos</p>
                <p className="text-base sm:text-lg font-black text-[#f8f9f9] leading-tight mt-0.5">
                  {militante.nombres} {militante.apellidos}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="p-2.5 rounded-xl bg-primary-900/30 border border-accent-500/30 shadow-inner">
                  <p className="text-[10px] text-accent-400 uppercase tracking-wider font-bold">DNI</p>
                  <p className="text-sm sm:text-base font-black text-accent-300 font-mono mt-0.5">{militante.dni}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-800/90 border border-primary-200/10">
                  <p className="text-[10px] text-primary-300 uppercase tracking-wider font-semibold">Teléfono</p>
                  <p className="text-xs font-medium text-[#f8f9f9] font-mono mt-0.5 truncate">{militante.id_whatsapp}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-primary-300 uppercase tracking-widest font-semibold">Base Territorial</p>
                <p className="text-xs sm:text-sm font-semibold text-primary-200 mt-0.5 leading-snug">{militante.base}</p>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Militante Oficial Empadronado
              </div>
            </div>

            {/* Lado derecho: Código QR Seguro */}
            <div className="sm:col-span-5 md:col-span-4 flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl bg-white shadow-2xl text-center border-2 border-accent-400/60 overflow-hidden">
              <div className="w-full flex items-center justify-center p-0.5">
                <QRCodeSVG
                  value={validationUrl}
                  size={140}
                  level="M"
                  marginSize={2}
                  bgColor="#ffffff"
                  fgColor="#0e0401"
                  className="w-full max-w-[130px] sm:max-w-[140px] h-auto aspect-square"
                />
              </div>
              <p className="text-[9px] sm:text-[10px] text-primary-700 font-black uppercase tracking-wider mt-1.5 leading-tight">
                Escanear para Asistencia
              </p>
              <span className="text-[8px] sm:text-[9px] text-surface-600 font-mono font-bold">ID: FT-{militante.dni}</span>
            </div>
          </div>

          {/* Pie de página del carnet */}
          <div className="pt-3 border-t border-primary-200/15 flex items-center justify-between text-[10px] sm:text-[11px] text-primary-300">
            <span>🏛️ Tacna - Unidos por el Desarrollo</span>
            <span className="font-mono text-accent-400 font-bold">Credencial Digital</span>
          </div>
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          onClick={downloadCarnet}
          loading={downloading}
          variant="accent"
          size="lg"
          className="flex-1"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          }
        >
          Descargar Credencial (PNG)
        </Button>

        <Button
          onClick={shareOnWhatsApp}
          variant="secondary"
          size="lg"
          className="flex-1"
          icon={
            <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z" />
            </svg>
          }
        >
          Compartir en WhatsApp
        </Button>
      </div>
    </div>
  );
}
