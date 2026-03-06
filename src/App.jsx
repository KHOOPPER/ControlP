import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { lazy, Suspense, useEffect } from 'react';

/**
 * Importaciones lazy — cada página se carga bajo demanda para reducir
 * el bundle inicial y acelerar el First Contentful Paint.
 */
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewWorker = lazy(() => import('./pages/NewWorker'));
const WorkersList = lazy(() => import('./pages/WorkersList'));
const WorkerDetails = lazy(() => import('./pages/WorkerDetails'));
const Login = lazy(() => import('./pages/Login'));
const Planillas = lazy(() => import('./pages/Planillas'));
const Boletas = lazy(() => import('./pages/Boletas'));
const Permisos = lazy(() => import('./pages/Permisos'));
const Settings = lazy(() => import('./pages/Settings'));

/**
 * @fileoverview App.jsx - Punto de Entrada y Ruteo de la Aplicación.
 * Define la estructura de navegación, proveedores de contexto globales
 * y la lógica de sincronización de branding (White Label) en el navegador.
 */

/** Spinner minimalista mientras se cargan las rutas lazy. */
const PageLoader = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

/**
 * Componente App
 * Raíz de la aplicación que orquesta el ruteo protegido y la identidad visual dinámica.
 * 
 * @returns {JSX.Element} El árbol de componentes principal.
 */
function App() {
  useEffect(() => {
    const updateBranding = () => {
      try {
        const settings = JSON.parse(localStorage.getItem('controlp_settings')) || {};
        const companyName = settings.companyName || 'Planillero';
        const logoDataUrl = settings.logoDataUrl;

        // Update Tab Title
        document.title = companyName;

        // Update Favicon
        let favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }

        if (logoDataUrl) {
          favicon.href = logoDataUrl;
        } else {
          // Fallback to default vite icon if no logo is set
          favicon.href = '/vite.svg';
        }
      } catch (e) {
        document.title = 'Planillero';
      }
    };

    updateBranding();
    window.addEventListener('controlp-settings-updated', updateBranding);
    return () => window.removeEventListener('controlp-settings-updated', updateBranding);
  }, []);

  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="new" element={<NewWorker />} />
              <Route path="workers" element={<WorkersList />} />
              <Route path="workers/:id" element={<WorkerDetails />} />
              <Route path="payrolls" element={<Planillas />} />
              <Route path="boletas" element={<Boletas />} />
              <Route path="leaves" element={<Permisos />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
