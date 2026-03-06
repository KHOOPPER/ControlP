import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * @fileoverview ProtectedRoute.jsx - Guardia de Navegación Protegida.
 * Este componente asegura que solo usuarios autenticados puedan acceder a las rutas
 * internas de la aplicación.
 */

/**
 * Componente ProtectedRoute
 * Verifica el estado de autenticación del usuario. Si no está autenticado,
 * redirige al usuario a la página de inicio de sesión (/login).
 * Mientras se verifica la sesión, muestra una pantalla de carga.
 * 
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Componentes o rutas a proteger.
 * @returns {JSX.Element} El contenido protegido, la redirección o el estado de carga.
 */
export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-primary-600">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p className="font-medium text-gray-600">Verificando sesión...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}
