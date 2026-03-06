import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, UserPlus, Users, LogOut, CalendarIcon, Activity, Receipt, Menu, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import { supabase } from '../lib/supabase';

/**
 * @fileoverview Layout.jsx - Estructura Principal de la Aplicación.
 * Este componente define el marco visual (Sidebar, Header móvil, Área de contenido)
 * y gestiona la persistencia visual del branding dinámico.
 */

/**
 * Componente Layout
 * Actúa como el contenedor principal para todas las rutas protegidas,
 * proporcionando navegación consistente y gestión del estado del menú móvil.
 * 
 * @returns {JSX.Element} El esquema estructural de la aplicación.
 */
export default function Layout() {
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [settings, setSettings] = useState({ companyName: '', logoDataUrl: '' });

    const readSettings = () => {
        try {
            const s = JSON.parse(localStorage.getItem('controlp_settings')) || {};
            setSettings(s);
        } catch { }
    };

    useEffect(() => {
        readSettings();
        window.addEventListener('controlp-settings-updated', readSettings);
        return () => window.removeEventListener('controlp-settings-updated', readSettings);
    }, []);


    const brandName = settings.companyName || 'Planillero';
    const brandLogo = settings.logoDataUrl || null;

    const navItems = [
        { label: 'Dashboard', icon: Home, path: '/' },
        { label: 'Planillas', icon: CalendarIcon, path: '/payrolls' },
        { label: 'Boletas', icon: Receipt, path: '/boletas' },
        { label: 'Permisos', icon: Activity, path: '/leaves' },
        { label: 'Nuevo Trabajador', icon: UserPlus, path: '/new' },
        { label: 'Trabajadores', icon: Users, path: '/workers' },
        { label: 'Ajustes', icon: Settings, path: '/settings' },
    ];

    return (
        <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsMobileMenuOpen(false)}
                    role="button"
                    tabIndex={0}
                    aria-label="Cerrar menú"
                />
            )}

            {/* Sidebar */}
            <aside className={clsx(
                "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Desktop Sidebar Brand — logo only, centered */}
                <div className="h-16 flex items-center justify-center px-5 border-b border-gray-100">
                    {brandLogo ? (
                        <img
                            src={brandLogo}
                            alt={`Logo de ${brandName}`}
                            className="h-10 w-auto max-w-[10rem] object-contain shrink-0"
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center text-white font-black text-base shrink-0">
                            {brandName.charAt(0).toUpperCase() || 'P'}
                        </div>
                    )}
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={clsx(
                                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                                    isActive
                                        ? 'bg-primary-50 text-primary-600 font-medium'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                )}
                            >
                                <Icon className={clsx('w-5 h-5', isActive ? 'text-primary-600' : 'text-gray-400')} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={() => supabase.auth.signOut()}
                        className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Cerrar Sesión
                    </button>

                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                {/* Mobile Header — logo only */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:hidden shrink-0">
                    {brandLogo ? (
                        <img src={brandLogo} alt={`Logo de ${brandName}`} className="h-9 w-auto max-w-[8rem] object-contain shrink-0" />
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center text-white font-black text-base shrink-0">
                            {brandName.charAt(0).toUpperCase() || 'P'}
                        </div>
                    )}
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <LazyMotion features={domAnimation}>
                        <m.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Outlet />
                        </m.div>
                    </LazyMotion>
                </div>
            </main>
        </div>
    );
}
