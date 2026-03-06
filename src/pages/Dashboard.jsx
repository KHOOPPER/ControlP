import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    UserPlus,
    Users,
    Activity,
    FileText,
    ChevronRight,
    Clock,
    Calendar,
    Search,
    TrendingUp
} from 'lucide-react';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

/**
 * @fileoverview Dashboard.jsx - Panel principal de la aplicación.
 * Este componente muestra un resumen de las estadísticas clave, tendencias de asistencia
 * y los registros más recientes de colaboradores.
 */

/**
 * Componente ChartLine
 * Renderiza un gráfico de líneas SVG personalizado para mostrar tendencias de asistencia.
 * 
 * @param {Object} props - Propiedades del componente.
 * @param {Array<{label: string, value: number}>} props.data - Lista de puntos de datos.
 * @param {boolean} props.loading - Indica si los datos están en proceso de carga.
 * @returns {JSX.Element} El gráfico de líneas animado.
 */
const ChartLine = ({ data, loading }) => {
    if (loading || !data || data.length === 0) return (
        <div className="h-48 flex items-center justify-center text-gray-300 italic text-sm">
            Cargando tendencias...
        </div>
    );

    const height = 200;
    const width = 500;
    const padding = 40;
    const maxVal = Math.max(...data.map(d => d.value), 1) * 1.2;

    const points = data.map((d, i) => ({
        x: padding + (i * (width - padding * 2) / (data.length - 1)),
        y: height - padding - (d.value / maxVal * (height - padding * 2)),
        value: d.value,
        label: d.label
    }));

    const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;

    return (
        <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-sm">
                <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f172a" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path
                    d={`${pathD} L ${points[points.length - 1].x},${height - padding} L ${points[0].x},${height - padding} Z`}
                    fill="url(#lineGradient)"
                />
                <m.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    d={pathD}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {points.map((p) => (
                    <g key={p.label}>
                        <m.circle
                            initial={{ r: 0 }}
                            animate={{ r: 4 }}
                            cx={p.x}
                            cy={p.y}
                            fill="white"
                            stroke="#1e293b"
                            strokeWidth="2"
                        />
                        <m.text
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            x={p.x}
                            y={p.y - 12}
                            textAnchor="middle"
                            className="text-[10px] font-bold fill-gray-700"
                        >
                            {p.value}%
                        </m.text>
                        <text x={p.x} y={height - padding + 20} textAnchor="middle" className="text-[9px] font-bold fill-gray-400 uppercase tracking-tighter">
                            {p.label}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
};

/**
 * Componente Dashboard
 * Panel de control principal que orquesta la carga de datos desde Supabase
 * y coordina la visualización de métricas clave y estados de la empresa.
 * 
 * @returns {JSX.Element} El panel de administración principal.
 */
export default function Dashboard() {
    /** Estadísticas generales calculadas. */
    const [stats, setStats] = useState({
        totalWorkers: 0,
        activePayrolls: 0,
        daysToNextClose: null
    });
    /** Datos para el gráfico de asistencia semanal. */
    const [attendanceTrend, setAttendanceTrend] = useState([]);
    /** Lista de los últimos trabajadores registrados. */
    const [recentWorkers, setRecentWorkers] = useState([]);
    /** Estado global de carga de la página. */
    const [loading, setLoading] = useState(true);
    /** Nombre de la empresa personalizado desde configuración. */
    const [brandName, setBrandName] = useState('Planillero');

    useEffect(() => {
        /** Carga las configuraciones locales de branding. */
        const fetchSettings = () => {
            try {
                const s = JSON.parse(localStorage.getItem('controlp_settings')) || {};
                setBrandName(s.companyName || 'Planillero');
            } catch { }
        };
        fetchSettings();
        fetchDashboardData();
    }, []);

    /**
     * Realiza múltiples consultas a Supabase para poblar el dashboard.
     * Calcula métricas de asistencia basándose en registros históricos.
     */
    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // Fetch independent data in parallel
            const [
                { count: workersCount },
                { data: recent },
                { data: payrolls },
                { data: entries }
            ] = await Promise.all([
                supabase.from('workers').select('*', { count: 'exact', head: true }),
                supabase.from('workers').select('id, first_name, last_name, profile_picture_url, created_at').order('created_at', { ascending: false }).limit(5),
                supabase.from('payrolls').select('id, start_date, total_days, created_at'),
                supabase.from('payroll_entries').select('days_attended, payrolls (start_date, created_at)')
            ]);

            /** Helper interno para calcular fechas absolutas dentro de una planilla. */
            const getDayDateString = (created_at, dayIndex, start_date) => {
                const base = (start_date || created_at).substring(0, 10);
                const [y, mo, d] = base.split('-').map(Number);
                const date = new Date(y, mo - 1, d + dayIndex);
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            };

            const today = new Date();
            const todayStr = today.toISOString().substring(0, 10);

            // 1. Stats logic
            const active = (payrolls || []).filter(p => {
                const start = new Date(p.start_date || p.created_at);
                const end = new Date(start);
                end.setDate(end.getDate() + (p.total_days || 15));
                return today >= start && today <= end;
            });

            setStats({
                totalWorkers: workersCount || 0,
                activePayrolls: active.length,
                daysToNextClose: active.length > 0 ? '7d' : 'N/A'
            });

            setRecentWorkers(recent || []);

            // 2. Trend Logic (Last 5 days)
            const trend = [];
            for (let i = 4; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toISOString().substring(0, 10);
                const label = d.toLocaleDateString('es-ES', { weekday: 'short' });

                let totalMarks = 0;
                let presentMarks = 0;

                (entries || []).forEach(entry => {
                    const p = entry.payrolls;
                    if (!p) return;
                    for (let j = 0; j < (p.total_days || 15); j++) {
                        if (getDayDateString(p.created_at, j, p.start_date) === dStr) {
                            totalMarks++;
                            if (entry.days_attended?.[j]) presentMarks++;
                        }
                    }
                });

                trend.push({
                    label,
                    value: totalMarks > 0 ? Math.round((presentMarks / totalMarks) * 100) : 0
                });
            }
            setAttendanceTrend(trend);

        } catch (error) {
            console.error('Error dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    /** Configuración visual de las tarjetas de métricas. */
    const statCards = [
        { label: 'Colaboradores', value: stats.totalWorkers, icon: Users, desc: 'Personal activo' },
        { label: 'Planillas', value: stats.activePayrolls, icon: Calendar, desc: 'En curso' },
        { label: 'Cierre', value: stats.daysToNextClose, icon: Clock, desc: 'Próxima fecha' }
    ];

    return (
        <LazyMotion features={domAnimation}>
            <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 pb-6">
                {/* Hero / Welcome */}
                <div className="relative overflow-hidden bg-white border border-gray-100 p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm">
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1 max-w-2xl">
                            <m.h1
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-2xl sm:text-4xl font-bold text-gray-800 leading-tight tracking-tight"
                            >
                                {brandName && brandName !== 'ControlP' ? (
                                    brandName
                                ) : (
                                    <>Control<span className="text-primary-600">P</span></>
                                )}
                            </m.h1>
                            <p className="text-gray-400 font-medium text-sm sm:text-base max-w-md">Gestión inteligente de personal y asistencia en tiempo real.</p>
                        </div>
                        <Link to="/new" className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-900 transition-all shadow-md group shrink-0">
                            <UserPlus className="w-4 h-4" strokeWidth={1.5} />
                            Nuevo Registro
                        </Link>
                    </div>
                    <div className="absolute right-0 top-0 w-32 h-full bg-primary-50/50 -skew-x-12 translate-x-16"></div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    {statCards.map((stat, i) => (
                        <m.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group"
                        >
                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                                <div className="p-1.5 sm:p-2 bg-gray-50 rounded-lg sm:rounded-xl text-gray-900 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors shrink-0">
                                    <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
                                </div>
                                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest text-right leading-tight">{stat.label}</p>
                            </div>
                            <div className="space-y-0">
                                <h3 className="text-lg sm:text-2xl font-bold text-gray-800">{loading ? '...' : stat.value}</h3>
                                <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium truncate">{stat.desc}</p>
                            </div>
                        </m.div>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
                    {/* Activity Chart */}
                    <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
                                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                                Tendencia de Asistencia
                            </h2>
                            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase text-gray-400 tracking-widest">
                                <Activity className="w-3 h-3" />
                                Últimos 5 días
                            </div>
                        </div>

                        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm">
                            <ChartLine data={attendanceTrend} loading={loading} />
                        </div>
                    </div>

                    {/* Recent Personnel */}
                    <div className="space-y-4 sm:space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">Recientes</h2>
                            <Link to="/workers" className="text-[10px] sm:text-xs font-bold uppercase text-primary-600 hover:text-primary-700 tracking-widest flex items-center gap-1 group">
                                Ver todos
                                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm divide-y divide-gray-50 overflow-hidden">
                            {loading ? (
                                <div className="p-10 text-center text-gray-300 italic text-sm">Cargando...</div>
                            ) : recentWorkers.length === 0 ? (
                                <div className="p-10 text-center text-gray-300 italic text-sm">No hay registros aún</div>
                            ) : (
                                recentWorkers.map((worker) => (
                                    <m.div
                                        key={worker.id}
                                        whileHover={{ x: 4 }}
                                        className="p-4 sm:p-5 flex items-center justify-between group cursor-pointer transition-colors hover:bg-gray-50/50"
                                    >
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 group-hover:border-primary-100 transition-colors">
                                                {worker.profile_picture_url ? (
                                                    <img src={worker.profile_picture_url} alt={`${worker.first_name} ${worker.last_name}`} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-gray-200" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors text-sm sm:text-base leading-tight">
                                                    {worker.first_name} {worker.last_name}
                                                </p>
                                                <p className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase tracking-wider mt-0.5" title={`${new Date(worker.created_at).toLocaleString()}`}>
                                                    Registrado hace {Math.floor((new Date() - new Date(worker.created_at)) / (1000 * 60 * 60 * 24))}d
                                                </p>
                                            </div>
                                        </div>
                                    </m.div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </LazyMotion>
    );
}
