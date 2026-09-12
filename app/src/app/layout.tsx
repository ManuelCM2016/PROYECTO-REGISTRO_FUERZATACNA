import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Fuerza Tacna — Sistema Oficial de Registro y Padrón',
  description:
    'Plataforma oficial de registro, gestión y control de militantes de Fuerza Tacna. Unidos por el desarrollo y la dignidad de nuestra región.',
  keywords: ['Fuerza Tacna', 'registro', 'empadronamiento', 'militantes', 'Tacna'],
  icons: {
    icon: '/logo/logo.jpg',
    apple: '/logo/logo.jpg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
