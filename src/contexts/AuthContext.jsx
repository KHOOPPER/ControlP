import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * @fileoverview AuthContext.jsx - Gestión del Estado de Autenticación.
 * Proporciona un contexto global para el manejo del usuario autenticado
 * y el estado de carga inicial de la sesión.
 */

/** Contexto de autenticación. */
const AuthContext = createContext({});

/**
 * Proveedor de Autenticación (AuthProvider)
 * Envuelve la aplicación para proveer acceso al usuario actual de Supabase
 * y gestionar los cambios en el estado de la sesión (login/logout).
 * 
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Componentes hijos que consumirán el contexto.
 * @returns {JSX.Element} El proveedor de contexto de react.
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Verifica sesiones activas y establece el usuario
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Escucha cambios en el estado de autenticación (login, logout, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

/**
 * Hook personalizado useAuth
 * Facilita el acceso al contexto de autenticación desde cualquier componente funcional.
 * 
 * @returns {{user: Object|null, loading: boolean}} El objeto de usuario y estado de carga.
 */
export const useAuth = () => {
    return useContext(AuthContext);
};
