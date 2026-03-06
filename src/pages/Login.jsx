import { useState, useEffect, useReducer } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2 } from 'lucide-react';

/**
 * @fileoverview Login.jsx - Pantalla de Autenticación.
 * Este componente gestiona el acceso de los administradores al sistema,
 * integrando la seguridad de Supabase Auth y branding dinámico personalizado.
 */

const loginReducer = (state, action) => {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.field]: action.value };
        case 'SET_LOADING':
            return { ...state, loading: action.value, error: null };
        case 'SET_ERROR':
            return { ...state, error: action.value, loading: false };
        default:
            return state;
    }
};

/**
 * Componente Login
 * Proporciona el formulario de inicio de sesión y gestiona la redirección
 * post-autenticación y los estados de error de red o credenciales.
 * 
 * @returns {JSX.Element} La interfaz de inicio de sesión.
 */
export default function Login() {
    const [state, dispatch] = useReducer(loginReducer, {
        email: '',
        password: '',
        loading: false,
        error: null
    });
    const { email, password, loading, error } = state;

    const navigate = useNavigate();
    const [settings, setSettings] = useState({ companyName: '', logoDataUrl: '' });

    useEffect(() => {
        try {
            const s = JSON.parse(localStorage.getItem('controlp_settings')) || {};
            setSettings(s);
        } catch { }
    }, []);

    const brandName = settings.companyName || 'Planillero';
    const brandLogo = settings.logoDataUrl || null;

    const handleLogin = async (e) => {
        e.preventDefault();
        dispatch({ type: 'SET_LOADING', value: true });

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            dispatch({ type: 'SET_ERROR', value: error.message });
        } else {
            navigate('/');
        }
        dispatch({ type: 'SET_LOADING', value: false });
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    {brandLogo ? (
                        <img src={brandLogo} alt={`Logo de ${brandName}`} className="h-16 w-auto max-w-[12rem] object-contain rounded-2xl shadow-sm" />
                    ) : (
                        <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                            {brandName.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    {brandName}
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Sistema de Registro de Trabajadores
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-sm border border-gray-100 sm:rounded-2xl sm:px-10">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Correo Electrónico
                            </label>
                            <div className="mt-1 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'email', value: e.target.value })}
                                    className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-shadow"
                                    placeholder="admin@controlp.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Contraseña
                            </label>
                            <div className="mt-1 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'password', value: e.target.value })}
                                    className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-shadow"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm font-medium bg-red-50 p-3 rounded-xl border border-red-100">
                                {error}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors disabled:opacity-70 gap-2 items-center"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Iniciar Sesión'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
