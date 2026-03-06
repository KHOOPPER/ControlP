<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/briefcase.svg" alt="ControlP Logo" width="80" height="80" />
  <h1 align="center">ControlP - Sistema de Planillas</h1>
  <p align="center">
    <strong>Plataforma moderna y minimalista para la gestión integral de recursos humanos.</strong>
  </p>
</div>

<br />

![ControlP Dashboard Preview](https://via.placeholder.com/1200x600/f8fafc/0f172a?text=Panel+de+Control+-+ControlP)

## 📖 Descripción General

**ControlP** es una aplicación web diseñada para simplificar y automatizar los procesos de nómina y recursos humanos. Creada con un enfoque minimalista y corporativo, la plataforma permite gestionar empleados, generar boletas de pago (PDF), y llevar un control exhaustivo de asistencia y recargos.

Construida con React, Vite y Tailwind CSS en el Frontend, y apoyada por todo el poder de Supabase (PostgreSQL + Auth + Storage) en el Backend.

---

## ✨ Características Principales

- **👥 Gestión de Trabajadores:** Registro detallado con subida de documentos de identidad, antecedentes y fotografías.
- **📅 Control de Asistencia:** Generación de planillas de 14 y 15 días con marcaje móvil-first e importación masiva de excepciones.
- **📄 Boletas de Pago Digitales:** Cálculos automáticos de deducciones de ley (AFP, ISSS, Renta) y exportación a PDF.
- **⏳ Permisos e Incapacidades:** Registro centralizado con sincronización automática con los días reportados en planilla.
- **🎨 White Labeling dinámico:** Personalización 100% nativa (logo y nombre de la empresa) que se refleja en todo el ecosistema y documentos generados.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React 18, Vite, React Router DOM
- **Estilos e UI:** Tailwind CSS v4, Lucide React, Framer Motion
- **Funcionalidad PDF:** jsPDF, html2canvas (generación client-side)
- **Backend as a Service:** Supabase (Auth, RLS, Storage)
- **Despliegue Óptimo:** Splitting de rutas mediante `React.lazy` (Bundle ultraligero < 30KB)

---

## 🚀 Despliegue en Producción

El proyecto está preconfigurado para un despliegue sin fricciones en plataformas como Vercel o Netlify.

### 1. Variables de Entorno
Crea un archivo `.env.local` en tu entorno de desarrollo o configura estas llaves en el panel de tu servicio de hosting usando de base `.env.example`:

```env
VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
VITE_SUPABASE_ANON_KEY="tu-anon-key-publica"
```

> 🔐 **Importante:** Jamás expongas tu `service_role_key`. El cliente solo necesita la clave pública anon, la cual es 100% segura si se complementa con políticas RLS en base de datos.

### 2. Generación del Build (Producción)

```bash
npm install
npm run build
```
Vite generará los recursos estáticos optimizados y fragmentados (code-splitting) en el directorio `/dist`.

### 3. Configuraciones de Supabase
- Habilita las políticas **RLS (Row Level Security)** para todas las tablas.
- Establece la contraseña mínima en 8 caracteres o más en autenticación.
- Configura correctamente los Security Policies en los buckets de **Storage**.

---

## 🔒 Auditoría de Ciberseguridad

ControlP ha sido rigurosamente auditado para despliegues empresariales modernos:
- **Zero Secrets Leakage:** Sin configuraciones sensibles hardcodeadas en todo el proyecto.
- **Mitigación XSS:** Ausencia absoluta de vectores de ataque como `dangerouslySetInnerHTML`, `eval` u objetos no escapados en JSX.
- **Client-Side Auth State:** JWT Claims administrados seguro vía Supabase Auth Hooks.
- **Performance Grado Producción:** 96% de reducción en el tiempo de carga del bundle principal tras limpieza de redundancias en dependencias.

<br />
<div align="center">
  Construido con 🩵 para la gestión empresarial moderna.
</div>
