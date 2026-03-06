import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, X, Calendar, Search, Trash2, Filter, Activity, FileText, CheckCircle2, AlertCircle, Save, Loader2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { LazyMotion, domAnimation, m } from 'framer-motion';

/**
 * @fileoverview Permisos.jsx - Registro de Ausencias y Permisos.
 * Este componente permite registrar incapacidades, permisos con o sin goce de sueldo
 * y sincronizarlos automáticamente con las planillas abiertas del trabajador seleccionado.
 */

/**
 * Componente Permisos
 * Gestiona el ciclo de vida de las ausencias, desde el registro inicial hasta la
 * actualización proactiva de las entradas de planilla correspondientes.
 * 
 * @returns {JSX.Element} La interfaz de gestión de permisos y ausencias.
 */
export default function Permisos() {
    /** Registros de ausencias existentes. */
    const [leaves, setLeaves] = useState([]);
    /** Trabajadores activos disponibles para asignar. */
    const [workers, setWorkers] = useState([]);
    /** Planillas abiertas disponibles para vincular. */
    const [payrolls, setPayrolls] = useState([]);
    /** Estado global de carga de datos. */
    const [loading, setLoading] = useState(true);
    /** Controla la visibilidad del modal de nueva ausencia. */
    const [isModalOpen, setIsModalOpen] = useState(false);
    /** Controla la apertura del dropdown de trabajadores en el formulario. */
    const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState(false);
    /** Controla la apertura del dropdown de tipo de ausencia. */
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    /** Controla la apertura del dropdown de planillas en el formulario. */
    const [isPayrollDropdownOpen, setIsPayrollDropdownOpen] = useState(false);
    /** Término de búsqueda para filtrar trabajadores en la tabla. */
    const [searchTerm, setSearchTerm] = useState('');
    /** Filtro de tipo activo: 'todos', 'Permiso', 'Incapacidad', 'Vacación'. */
    const [filterType, setFilterType] = useState('todos');
    /** Estado de envío del formulario de nueva ausencia. */
    const [isSubmitting, setIsSubmitting] = useState(false);
    /** Registro de ausencia pendiente de eliminación. */
    const [leaveToDelete, setLeaveToDelete] = useState(null);
    /** Estado de carga durante la eliminación de un registro. */
    const [isDeleting, setIsDeleting] = useState(false);

    /** Estado del formulario de nueva ausencia. */
    const [newLeave, setNewLeave] = useState({
        worker_id: '',
        payroll_id: '',
        type: 'Permiso',
        start_date: new Date().toISOString().substring(0, 10),
        end_date: new Date().toISOString().substring(0, 10),
        reason: '',
        is_paid: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    /** Reinicia la planilla vinculada y abre el modal de nueva ausencia. */
    const handleOpenModal = () => {
        setNewLeave(prev => ({ ...prev, payroll_id: '' }));
        setIsModalOpen(true);
    };

    /** Obtiene trabajadores activos, planillas abiertas y registros de ausencias. */
    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: workersData } = await supabase.from('workers').select('id, first_name, last_name').eq('status', 'Activo');
            setWorkers(workersData || []);

            const { data: payrollsData } = await supabase
                .from('payrolls')
                .select('id, name')
                .in('status', ['abierta', 'borrador'])
                .order('created_at', { ascending: false });
            setPayrolls(payrollsData || []);

            const { data: leavesData, error } = await supabase
                .from('leaves')
                .select('*, workers(first_name, last_name, profile_picture_url), payrolls(name, status)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLeaves(leavesData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Registra una nueva ausencia y sincroniza automáticamente las planillas abiertas.
     * Actualiza days_attended en payroll_entries para los días cubiertos por la ausencia.
     */
    const handleCreateLeave = async (e) => {
        e.preventDefault();
        if (!newLeave.worker_id) {
            toast.error('Selecciona un trabajador');
            return;
        }

        setIsSubmitting(true);
        const loadingToast = toast.loading('Registrando ausencia...');
        try {
            const { error: leaveError } = await supabase.from('leaves').insert([newLeave]);
            if (leaveError) throw leaveError;

            const daysCovered = eachDayOfInterval({
                start: parseISO(newLeave.start_date),
                end: parseISO(newLeave.end_date)
            }).map(d => format(d, 'yyyy-MM-dd'));

            const { data: entries, error: entriesError } = await supabase
                .from('payroll_entries')
                .select('*, payrolls!inner(*)')
                .eq('worker_id', newLeave.worker_id)
                .neq('payrolls.status', 'cerrada');

            if (entriesError) throw entriesError;

            if (entries && entries.length > 0) {
                for (const entry of entries) {
                    const payroll = entry.payrolls;
                    let currentDays = Array.isArray(entry.days_attended) ? [...entry.days_attended] : [];
                    let hasChanges = false;

                    const getDayDateString = (targetDate, dayIndex, startDate) => {
                        const baseDate = startDate ? parseISO(startDate) : parseISO(targetDate);
                        const resultDate = new Date(baseDate);
                        resultDate.setDate(resultDate.getDate() + dayIndex);
                        return format(resultDate, 'yyyy-MM-dd');
                    };

                    for (let i = 0; i < (payroll.total_days || 15); i++) {
                        const dayStr = getDayDateString(payroll.created_at, i, payroll.start_date);
                        if (daysCovered.includes(dayStr)) {
                            if (currentDays.length <= i) {
                                currentDays = [...currentDays, ...Array(i + 1 - currentDays.length).fill(false)];
                            }
                            currentDays[i] = newLeave.is_paid;
                            hasChanges = true;
                        }
                    }

                    if (hasChanges) {
                        await supabase
                            .from('payroll_entries')
                            .update({ days_attended: currentDays })
                            .eq('id', entry.id);
                    }
                }
            }

            toast.success('Permiso registrado y asistencia sincronizada', { id: loadingToast });
            setIsModalOpen(false);
            setNewLeave({
                worker_id: '',
                payroll_id: '',
                type: 'Permiso',
                start_date: new Date().toISOString().substring(0, 10),
                end_date: new Date().toISOString().substring(0, 10),
                reason: '',
                is_paid: true
            });
            fetchData();
        } catch (error) {
            console.error('Error in flow:', error);
            toast.error('Error al procesar el registro', { id: loadingToast });
        } finally {
            setIsSubmitting(false);
        }
    };

    /** Elimina un registro de ausencia de la base de datos. */
    const handleDeleteLeave = async () => {
        if (!leaveToDelete) return;

        setIsDeleting(true);
        const loadingToast = toast.loading('Eliminando registro...');
        const id = leaveToDelete.id;
        try {
            const { error: deleteError } = await supabase.from('leaves').delete().eq('id', id);
            if (deleteError) throw deleteError;

            toast.success('Registro eliminado', { id: loadingToast });
            setLeaveToDelete(null);
            fetchData();
        } catch (error) {
            console.error('Error deleting leave:', error);
            toast.error('Error al eliminar', { id: loadingToast });
        } finally {
            setIsDeleting(false);
        }
    };

    /** Filtra los registros por nombre del trabajador y tipo de ausencia. */
    const filteredLeaves = leaves.filter(l => {
        const matchesSearch = `${l.workers?.first_name} ${l.workers?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'todos' || l.type === filterType;
        return matchesSearch && matchesType;
    });

    /**
     * Devuelve las clases de color para un tipo de ausencia.
     * @param {string} type - Tipo de ausencia.
     * @returns {string} Clases CSS de color.
     */
    const getTypeColor = (type) => {
        switch (type) {
            case 'Incapacidad': return 'text-red-600 bg-red-50 border-red-100';
            case 'Vacación': return 'text-blue-600 bg-blue-50 border-blue-100';
            case 'Permiso': return 'text-amber-600 bg-amber-50 border-amber-100';
            default: return 'text-gray-600 bg-gray-50 border-gray-100';
        }
    };

    return (
        <LazyMotion features={domAnimation}>
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                            <Activity className="w-8 h-8 text-primary-600" strokeWidth={2.5} />
                            Gestión de Ausencias
                        </h1>
                        <p className="text-gray-500 mt-1 font-medium">Control de permisos, incapacidades y vacaciones del personal.</p>
                    </div>
                    <button
                        onClick={handleOpenModal}
                        className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl hover:bg-black transition shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                        <Plus className="w-5 h-5" strokeWidth={1.5} />
                        Nueva Ausencia
                    </button>
                </div>

                {/* Stats & Filters */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-2 flex flex-wrap gap-2">
                        {['todos', 'Permiso', 'Incapacidad', 'Vacación'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterType === type ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                {type === 'todos' ? 'Todos los registros' : type}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar personal..."
                            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary-500 outline-none transition shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
                            <p className="text-gray-400 font-bold animate-pulse">Cargando registros...</p>
                        </div>
                    ) : filteredLeaves.length === 0 ? (
                        <div className="text-center py-20 px-6">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <FileText className="w-10 h-10 text-gray-200" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No se encontraron registros</h3>
                            <p className="text-gray-500 max-w-sm mx-auto">Prueba ajustando los filtros o registra una nueva ausencia para comenzar.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                        <th className="px-6 py-5 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Personal</th>
                                        <th className="px-6 py-5 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Tipo / Estado</th>
                                        <th className="px-6 py-5 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Periodo</th>
                                        <th className="px-6 py-5 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Remuneración</th>
                                        <th className="px-6 py-5 text-right text-xs font-black text-gray-400 uppercase tracking-widest"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredLeaves.map((leave) => (
                                        <tr key={leave.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-white shadow-sm">
                                                        {leave.workers?.profile_picture_url ? (
                                                            <img
                                                                src={leave.workers.profile_picture_url}
                                                                alt={`${leave.workers.first_name} ${leave.workers.last_name}`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-sm font-black text-gray-400">
                                                                {leave.workers?.first_name[0]}{leave.workers?.last_name[0]}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900">{leave.workers?.first_name} {leave.workers?.last_name}</p>
                                                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                                            <AlertCircle className="w-3 h-3" />
                                                            {leave.payrolls ? leave.payrolls.name : 'Sin planilla vinculada'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getTypeColor(leave.type)}`}>
                                                        {leave.type}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <div className="text-gray-900 font-bold">{format(parseISO(leave.start_date), 'dd MMM')}</div>
                                                    <div className="text-gray-300">→</div>
                                                    <div className="text-gray-900 font-bold">{format(parseISO(leave.end_date), 'dd MMM')}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {leave.is_paid ? (
                                                    <span className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-900" />
                                                        Con goce
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                                                        Sin goce
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setLeaveToDelete(leave)}
                                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                                                    title="Eliminar falta"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Modal de Registro */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                        <m.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white shadow-lg shadow-gray-200">
                                        <FileText className="w-5 h-5" strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-xl font-black text-gray-900">Nueva Ausencia</h3>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 transition bg-white rounded-full shadow-sm">
                                    <X className="w-5 h-5" strokeWidth={1.5} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateLeave} className="p-8 space-y-6">
                                <div className="space-y-2 relative">
                                    <label htmlFor="worker_id" className="text-sm font-bold text-gray-700 ml-1">Trabajador</label>
                                    <div
                                        id="worker_id"
                                        onClick={() => setIsWorkerDropdownOpen(!isWorkerDropdownOpen)}
                                        onKeyDown={(e) => e.key === 'Enter' && setIsWorkerDropdownOpen(!isWorkerDropdownOpen)}
                                        role="button"
                                        tabIndex={0}
                                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition font-medium cursor-pointer flex justify-between items-center shadow-sm"
                                    >
                                        <span className={newLeave.worker_id ? 'text-gray-900' : 'text-gray-400'}>
                                            {newLeave.worker_id
                                                ? workers.find(w => w.id === newLeave.worker_id)?.first_name + ' ' + workers.find(w => w.id === newLeave.worker_id)?.last_name
                                                : 'Selecciona personal...'}
                                        </span>
                                        <Activity className={`w-4 h-4 text-gray-400 transition-transform ${isWorkerDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>

                                    {isWorkerDropdownOpen && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                            <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                                                <input
                                                    id="workerSearch"
                                                    type="text"
                                                    placeholder="Filtrar por nombre..."
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {workers.filter(w => `${w.first_name} ${w.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())).map(w => (
                                                    <div
                                                        key={w.id}
                                                        onClick={() => {
                                                            setNewLeave({ ...newLeave, worker_id: w.id });
                                                            setIsWorkerDropdownOpen(false);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                setNewLeave({ ...newLeave, worker_id: w.id });
                                                                setIsWorkerDropdownOpen(false);
                                                            }
                                                        }}
                                                        role="button"
                                                        tabIndex={0}
                                                        className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors flex items-center justify-between"
                                                    >
                                                        {w.first_name} {w.last_name}
                                                        {newLeave.worker_id === w.id && <CheckCircle2 className="w-4 h-4 text-primary-600" />}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 relative">
                                    <label htmlFor="payroll_id" className="text-sm font-bold text-gray-700 ml-1">Asociar a Planilla</label>
                                    <div
                                        id="payroll_id"
                                        onClick={() => setIsPayrollDropdownOpen(!isPayrollDropdownOpen)}
                                        onKeyDown={(e) => e.key === 'Enter' && setIsPayrollDropdownOpen(!isPayrollDropdownOpen)}
                                        role="button"
                                        tabIndex={0}
                                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition font-medium cursor-pointer flex justify-between items-center shadow-sm"
                                    >
                                        <span className={newLeave.payroll_id ? 'text-gray-900' : 'text-gray-400'}>
                                            {newLeave.payroll_id
                                                ? payrolls.find(p => p.id === newLeave.payroll_id)?.name
                                                : 'Opcional: vincular a planilla...'}
                                        </span>
                                        <Activity className={`w-4 h-4 text-gray-400 transition-transform ${isPayrollDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>

                                    {isPayrollDropdownOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-[9]"
                                                onClick={() => setIsPayrollDropdownOpen(false)}
                                                onKeyDown={(e) => e.key === 'Enter' && setIsPayrollDropdownOpen(false)}
                                                role="button"
                                                tabIndex={0}
                                                aria-label="Cerrar selector de planilla"
                                            />
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                                <div className="max-h-48 overflow-y-auto">
                                                    <div
                                                        onClick={() => {
                                                            setNewLeave({ ...newLeave, payroll_id: '' });
                                                            setIsPayrollDropdownOpen(false);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                setNewLeave({ ...newLeave, payroll_id: '' });
                                                                setIsPayrollDropdownOpen(false);
                                                            }
                                                        }}
                                                        role="button"
                                                        tabIndex={0}
                                                        className="px-4 py-2.5 text-sm text-gray-400 italic hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-between"
                                                    >
                                                        — Sin vincular —
                                                        {!newLeave.payroll_id && <CheckCircle2 className="w-4 h-4 text-primary-600" />}
                                                    </div>
                                                    {payrolls.map(p => (
                                                        <div
                                                            key={p.id}
                                                            onClick={() => {
                                                                setNewLeave({ ...newLeave, payroll_id: p.id });
                                                                setIsPayrollDropdownOpen(false);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    setNewLeave({ ...newLeave, payroll_id: p.id });
                                                                    setIsPayrollDropdownOpen(false);
                                                                }
                                                            }}
                                                            role="button"
                                                            tabIndex={0}
                                                            className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors flex items-center justify-between"
                                                        >
                                                            {p.name}
                                                            {newLeave.payroll_id === p.id && <CheckCircle2 className="w-4 h-4 text-primary-600" />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 relative">
                                        <label htmlFor="leave_type" className="text-sm font-bold text-gray-700 ml-1">Tipo</label>
                                        <div
                                            id="leave_type"
                                            onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                            onKeyDown={(e) => e.key === 'Enter' && setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                            role="button"
                                            tabIndex={0}
                                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition font-medium cursor-pointer flex justify-between items-center shadow-sm"
                                        >
                                            <span className="text-gray-900">{newLeave.type}</span>
                                            <Activity className={`w-4 h-4 text-gray-400 transition-transform ${isTypeDropdownOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                                        </div>

                                        {isTypeDropdownOpen && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                                {['Permiso', 'Incapacidad', 'Vacación'].map(type => (
                                                    <div
                                                        key={type}
                                                        onClick={() => {
                                                            setNewLeave({ ...newLeave, type });
                                                            setIsTypeDropdownOpen(false);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                setNewLeave({ ...newLeave, type });
                                                                setIsTypeDropdownOpen(false);
                                                            }
                                                        }}
                                                        role="button"
                                                        tabIndex={0}
                                                        className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors flex items-center justify-between"
                                                    >
                                                        {type}
                                                        {newLeave.type === type && <CheckCircle2 className="w-4 h-4 text-primary-600" strokeWidth={1.5} />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="is_paid" className="text-sm font-bold text-gray-700 ml-1">Remunerado</label>
                                        <div
                                            id="is_paid"
                                            onClick={() => setNewLeave({ ...newLeave, is_paid: !newLeave.is_paid })}
                                            onKeyDown={(e) => e.key === 'Enter' && setNewLeave({ ...newLeave, is_paid: !newLeave.is_paid })}
                                            role="button"
                                            tabIndex={0}
                                            className={`w-full h-[3.25rem] rounded-xl border flex items-center px-4 cursor-pointer transition-all shadow-sm ${newLeave.is_paid ? 'bg-gray-50 border-gray-500' : 'bg-white border-gray-300 hover:border-gray-400'}`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all mr-3 ${newLeave.is_paid ? 'bg-gray-50 border-gray-500' : 'bg-white border-gray-200'}`}>
                                                <svg className={`w-3 h-3 text-gray-700 transition-all ${newLeave.is_paid ? 'opacity-100' : 'opacity-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <span className={`font-bold text-sm ${newLeave.is_paid ? 'text-gray-900' : 'text-gray-500'}`}>{newLeave.is_paid ? 'Sí, con goce' : 'No remunerado'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="start_date" className="text-sm font-bold text-gray-700 ml-1">Desde</label>
                                        <input
                                            id="start_date"
                                            type="date"
                                            required
                                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition font-medium shadow-sm"
                                            value={newLeave.start_date}
                                            onChange={(e) => setNewLeave({ ...newLeave, start_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="end_date" className="text-sm font-bold text-gray-700 ml-1">Hasta</label>
                                        <input
                                            id="end_date"
                                            type="date"
                                            required
                                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition font-medium shadow-sm"
                                            value={newLeave.end_date}
                                            onChange={(e) => setNewLeave({ ...newLeave, end_date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="reason" className="text-sm font-bold text-gray-700 ml-1">Motivo / Observaciones</label>
                                    <textarea
                                        id="reason"
                                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition font-medium resize-none shadow-sm"
                                        rows="3"
                                        placeholder="Escribe el motivo detallado..."
                                        value={newLeave.reason}
                                        onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                                    ></textarea>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-70"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <Save className="w-6 h-6" strokeWidth={1.5} />
                                    )}
                                    <span>{isSubmitting ? 'Procesando...' : 'Registrar Ausencia'}</span>
                                </button>
                            </form>
                        </m.div>
                    </div>
                )}

                {/* ── Deletion Confirmation Modal ── */}
                {leaveToDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                        <m.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-8 text-center">
                                <div className="mx-auto w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                                    <AlertCircle className="w-7 h-7 text-red-500" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2">¿Eliminar registro?</h3>
                                <p className="text-sm text-gray-500 font-medium mb-8">
                                    Estás por eliminar el registro de <strong>{leaveToDelete.workers?.first_name} {leaveToDelete.workers?.last_name}</strong>. Esta acción no se puede deshacer.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setLeaveToDelete(null)}
                                        className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition active:scale-[0.98]"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleDeleteLeave}
                                        disabled={isDeleting}
                                        className="flex-1 py-3 px-4 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-red-200"
                                    >
                                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        </m.div>
                    </div>
                )}
            </div>
        </LazyMotion>
    );
}
