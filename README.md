# 🏛️ Sistema de Registro y Control de Asistencia — Fuerza Tacna

Sistema web integral de registro, emisión de credenciales con código QR y control de asistencia en tiempo real desarrollado para el **Movimiento Regional Fuerza Tacna**.

---

## 🚀 Arquitectura del Proyecto

El proyecto está diseñado con una arquitectura desacoplada y sin costos de servidor:

```
PROYECTO REGISTRO_FUERZATACNA/
├── app/                  # Aplicación Frontend & BFF en Next.js
│   ├── src/
│   │   ├── app/          # App Router (Rutas de registro, dashboard, escáner QR, validación)
│   │   ├── components/   # Componentes UI reutilizables (Botones, inputs, modales, layout)
│   │   ├── lib/          # Clientes API, utilidades y verificación JWT
│   │   └── types/        # Definiciones de TypeScript
│   ├── public/           # Logos institucionales y recursos multimedia
│   ├── .env.local.example # Plantilla de variables de entorno
│   └── package.json      # Dependencias y scripts del frontend
└── apps-script/          # Backend Serverless en Google Apps Script
    └── Codigo.gs         # Lógica de negocio, base de datos Google Sheets, API REST y envío de emails
```

---

## ⚡ Características Principales

1. **Formulario de Registro Público**:
   - Registro intuitivo y validado con datos personales (DNI, Nombres, Apellidos, Teléfono, Correo, Distrito, etc.).
   - Emisión instantánea de credencial digital personalizada con código QR único.
   - Envío automático de credencial al correo electrónico registrado.

2. **Panel Administrativo (Dashboard)**:
   - Métricas en tiempo real: total de inscritos, asistencia por eventos, distribución geográfica.
   - Gestión de eventos y conferencias.
   - Búsqueda, filtrado y exportación de participantes.

3. **Escáner y Validación QR**:
   - Escaneo de códigos QR mediante la cámara de cualquier dispositivo móvil o tablet con `html5-qrcode`.
   - Marcación y verificación de asistencia en segundos, evitando duplicados.
   - Vista pública de verificación de autenticidad de credencial.

4. **Base de Datos en Google Sheets (Cero costo de infraestructura)**:
   - Backend ligero en Google Apps Script desplegado como Web App.
   - Almacenamiento directo y sincronizado en hojas de cálculo de Google.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: [Next.js 15+](https://nextjs.org/) (App Router, Server Actions y API Routes)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/)
- **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Manejo de QR**: `qrcode.react` (generación) y `html5-qrcode` (escaneo de cámara)
- **Seguridad**: `jose` (JWT) y `bcryptjs`
- **Backend / Database**: [Google Apps Script](https://developers.google.com/apps-script) + Google Sheets

---

## ⚙️ Instalación y Configuración Local

### 1. Clonar el Repositorio
```bash
git clone https://github.com/ManuelCM2016/PROYECTO-REGISTRO_FUERZATACNA.git
cd PROYECTO-REGISTRO_FUERZATACNA
```

### 2. Configurar la Aplicación Frontend (`app`)
```bash
cd app
npm install
```

Copia el archivo de ejemplo de variables de entorno y configúralo:
```bash
cp .env.local.example .env.local
```

Edita `.env.local` con tus credenciales:
```env
# URL del Web App de Google Apps Script (despliegue como Web App)
APPS_SCRIPT_URL=https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec

# Clave secreta para validación de tokens JWT
JWT_SECRET=tu-clave-secreta-para-tokens-jwt
```

Inicia el servidor de desarrollo:
```bash
npm run dev
```
La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

---

### 3. Configuración del Backend (`apps-script`)

1. Accede a [Google Drive](https://drive.google.com/) y crea una nueva **Hoja de cálculo de Google (Google Sheets)**.
2. Abre el menú **Extensiones** > **Apps Script**.
3. Copia y pega el contenido del archivo [`apps-script/Codigo.gs`](apps-script/Codigo.gs) en el editor de Apps Script.
4. Ejecuta la función `setupSheet()` una vez para crear las hojas e inicializar las cabeceras requeridas.
5. Haz clic en **Implementar (Deploy)** > **Nueva implementación (New deployment)**.
6. Selecciona el tipo **Aplicación web (Web app)**:
   - **Ejecutar como**: *Mi cuenta (Tu correo de Google)*
   - **Quién tiene acceso**: *Cualquier usuario (Anyone)*
7. Copia la URL de la aplicación web (`https://script.google.com/macros/s/.../exec`) y colócala en `APPS_SCRIPT_URL` dentro de `.env.local` en Next.js.

---

## 📦 Despliegue en Producción (Vercel)

1. Conecta este repositorio en [Vercel](https://vercel.com/).
2. En la configuración del proyecto, establece el **Root Directory** en `app`.
3. Configura las variables de entorno en el dashboard de Vercel:
   - `APPS_SCRIPT_URL`: URL del Web App de Apps Script.
   - `JWT_SECRET`: Llave secreta segura para producción.
4. Despliega la aplicación.

---

## 📄 Licencia

Este proyecto fue desarrollado para el **Movimiento Fuerza Tacna**. Todos los derechos reservados.
