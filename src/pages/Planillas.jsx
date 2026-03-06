import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { Plus, X, Calendar, Trash2, StopCircle, AlertTriangle, UserPlus, Search, XCircle, Activity, CheckCircle2 } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format, parse, differenceInDays, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

/**
 * @fileoverview Planillas.jsx - Gestión de Ciclos de Planilla.
 * Este componente permite crear periodos de pago, configurar días festivos y no laborables,
 * importar trabajadores y gestionar su asistencia diaria de forma masiva o individual.
 */

/**
 * Componente Planillas
 * Administra la lógica de creación de periodos de planilla, importación automática
 * de la base de colaboradores y el control detallado de la asistencia diaria.
 * 
 * @returns {JSX.Element} La interfaz de gestión de planillas.
 */
export default function Planillas() {
    /** Listado completo de planillas del sistema. */
    const [payrolls, setPayrolls] = useState([]);
    /** Estado global de carga al solicitar datos iniciales. */
    const [loading, setLoading] = useState(true);
    /** Controla la visibilidad del modal de creación de planilla. */
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    /** Planilla actualmente seleccionada para ver su detalle. */
    const [selectedPayroll, setSelectedPayroll] = useState(null);
    /** Entradas de asistencia de los trabajadores en la planilla seleccionada. */
    const [payrollEntries, setPayrollEntries] = useState([]);
    /** Permisos/ausencias registradas que afectan a la planilla seleccionada. */
    const [payrollLeaves, setPayrollLeaves] = useState([]);
    /** Estado de carga al obtener el detalle de una planilla. */
    const [loadingEntries, setLoadingEntries] = useState(false);
    /** Controla la visibilidad del diálogo de confirmación de eliminación. */
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    /** ID de la planilla pendiente de eliminación. */
    const [payrollToDelete, setPayrollToDelete] = useState(null);
    /** Controla la visibilidad del modal para agregar trabajadores. */
    const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);
    /** Término de búsqueda para filtrar trabajadores. */
    const [searchTerm, setSearchTerm] = useState('');
    /** Controla el modal de excepciones globales de asistencia. */
    const [isGlobalExceptionModalOpen, setIsGlobalExceptionModalOpen] = useState(false);
    /** IDs de trabajadores marcados como ausentes en el flujo de "Todos excepto...". */
    const [absentWorkers, setAbsentWorkers] = useState([]);
    /** Índice del día activo en la vista móvil de asistencia. */
    const [activeMobileDay, setActiveMobileDay] = useState(0);

    /** Estado del formulario de nueva planilla (nombre, fechas, asuetos, etc.). */
    const [newPayroll, setNewPayroll] = useState({
        name: '',
        project_name: '',
        start_date: new Date().toISOString().substring(0, 10), // yyyy-MM-dd
        total_days: 15,
        has_holiday: false,
        holidays: [],
        holidayInput: '',
        non_working_config: {
            type: 'todos',
            dates: []
        },
        nonWorkingInput: '',
        worker_import_type: 'todos',
        excluded_workers: []
    });

    /** Sub-modal activo dentro de la creación: 'holidays', 'non_working', o 'workers'. */
    const [activeSubModal, setActiveSubModal] = useState(null);
    /** Trabajadores activos disponibles para excluir en la importación. */
    const [availableWorkers, setAvailableWorkers] = useState([]);

    useEffect(() => {
        fetchPayrolls();
    }, []);

    /** Obtiene todas las planillas y pre-carga los trabajadores activos. */
    const fetchPayrolls = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('payrolls')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPayrolls(data || []);

            // Pre-cargar trabajadores para el modal de exclusión
            const { data: workersData } = await supabase.from('workers').select('*').eq('status', 'Activo');
            setAvailableWorkers(workersData || []);
        } catch (error) {
            console.error('Error fetching payrolls:', error);
            toast.error('Error al cargar las planillas');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Crea una nueva planilla e importa automáticamente a los trabajadores.
     * Excluye trabajadores si el usuario seleccionó la opción "excepto".
     */
    const handleCreatePayroll = async (e) => {
        e.preventDefault();
        try {
            // 1. Crear la planilla
            const { data: createdPayroll, error: createError } = await supabase
                .from('payrolls')
                .insert([{
                    name: newPayroll.name,
                    project_name: newPayroll.project_name,
                    start_date: newPayroll.start_date,
                    total_days: newPayroll.total_days,
                    holidays: newPayroll.has_holiday ? newPayroll.holidays : [],
                    non_working_days_config: newPayroll.non_working_config
                }])
                .select()
                .single();

            if (createError) throw createError;

            // 2. Importar trabajadores activos (Crear entradas en payroll_entries)
            const { data: workers, error: workersError } = await supabase
                .from('workers')
                .select('id');

            if (workersError) throw workersError;

            if (workers && workers.length > 0) {
                // Filtrar los trabajadores excluidos
                const workersToImport = newPayroll.worker_import_type === 'excepto'
                    ? workers.filter(w => !newPayroll.excluded_workers.includes(w.id))
                    : workers;

                if (workersToImport.length > 0) {
                    const entriesToInsert = workersToImport.map(worker => ({
                        payroll_id: createdPayroll.id,
                        worker_id: worker.id,
                        days_attended: [] // Inician con array vacío
                    }));

                    const { error: entriesError } = await supabase
                        .from('payroll_entries')
                        .insert(entriesToInsert);

                    if (entriesError) throw entriesError;
                }
            }

            toast.success('Planilla creada e importación de trabajadores exitosa');
            setIsCreateModalOpen(false);
            setNewPayroll({
                name: '',
                project_name: '',
                start_date: new Date().toISOString().substring(0, 10),
                total_days: 15,
                has_holiday: false,
                holidays: [],
                holidayInput: '',
                non_working_config: { type: 'todos', dates: [] },
                nonWorkingInput: '',
                worker_import_type: 'todos',
                excluded_workers: []
            });
            fetchPayrolls();

        } catch (error) {
            console.error('Error creating payroll:', error);
            toast.error('Ocurrió un error al crear la planilla');
        }
    };
    /** Letras abreviadas para los meses en la tabla de asistencia. */
    const monthLetters = ['e', 'f', 'm', 'a', 'm', 'j', 'j', 'a', 's', 'o', 'n', 'd'];

    /**
     * Calcula la fecha absoluta de un día dentro de una planilla.
     * @param {string} created_at - Fecha de creación (fallback).
     * @param {number} dayIndex - Índice del día (0-based).
     * @param {string} start_date - Fecha de inicio (preferida).
     * @returns {string|null} Fecha en formato YYYY-MM-DD.
     */
    const getDayDateString = (created_at, dayIndex, start_date) => {
        if (!created_at && !start_date) return null;
        const base = (start_date || created_at).substring(0, 10);
        const [y, mo, d] = base.split('-').map(Number);
        const date = new Date(y, mo - 1, d + dayIndex);
        const yr = date.getFullYear();
        const mn = String(date.getMonth() + 1).padStart(2, '0');
        const dy = String(date.getDate()).padStart(2, '0');
        return `${yr}-${mn}-${dy}`;
    };

    /** @returns {string} Fecha de hoy en formato YYYY-MM-DD sin dependencias externas. */
    const getTodayString = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    /**
     * Determina el índice del día actual dentro de una planilla.
     * @param {Object} payroll - La planilla a evaluar.
     * @returns {number} Índice 0-based del día actual, o -1 si fuera de rango.
     */
    const getTodayIndex = (payroll) => {
        if (!payroll) return -1;
        const todayStr = getTodayString();
        for (let i = 0; i < (payroll.total_days || 15); i++) {
            if (getDayDateString(payroll.created_at, i, payroll.start_date) === todayStr) {
                return i;
            }
        }
        return -1;
    };

    /**
     * Verifica si una planilla debería estar cerrada y la cierra automáticamente.
     * También realiza carry-over de ausencias que se extienden más allá del periodo.
     */
    const checkAndAutoClosePayroll = async (payroll) => {
        // Calcular la fecha de cierre real (el día después del último día)
        const endStr = getDayDateString(payroll.created_at, (payroll.total_days || 14) - 1, payroll.start_date);
        if (!endStr) return payroll;

        const today = getTodayString();
        const shouldBeClosed = today > endStr;

        if (shouldBeClosed && payroll.status !== 'cerrada') {
            try {
                // 1. Marcar planilla como cerrada
                const { error } = await supabase.from('payrolls').update({ status: 'cerrada' }).eq('id', payroll.id);
                if (error) throw error;

                // 2. Procesar Carry-Over de Ausencias
                const { data: overlappingLeaves } = await supabase
                    .from('leaves')
                    .select('*')
                    .eq('payroll_id', payroll.id)
                    .gt('end_date', endStr);

                if (overlappingLeaves && overlappingLeaves.length > 0) {
                    for (const leave of overlappingLeaves) {
                        const originalEndDate = leave.end_date;
                        const nextStartDate = format(addDays(parseISO(endStr), 1), 'yyyy-MM-dd');

                        await supabase.from('leaves').update({ end_date: endStr }).eq('id', leave.id);
                        await supabase.from('leaves').insert([{
                            worker_id: leave.worker_id,
                            type: leave.type,
                            start_date: nextStartDate,
                            end_date: originalEndDate,
                            reason: `Continuación de: ${leave.reason || leave.type}`,
                            is_paid: leave.is_paid
                        }]);
                    }
                }

                toast('Planilla finalizada y ausencias sincronizadas.', { icon: '🔒' });
                const updated = { ...payroll, status: 'cerrada' };
                setPayrolls(prev => prev.map(p => p.id === payroll.id ? updated : p));
                return updated;
            } catch (e) {
                console.error('Error auto-closing', e);
            }
        }
        return payroll;
    };

    /** Carga las entradas de asistencia y los permisos asociados a una planilla. */
    const fetchPayrollDetails = async (payroll) => {
        setLoadingEntries(true);
        try {
            // 1. Verificar auto-cierre/apertura sin disparar setPayrolls si no ha cambiado
            const checkedPayroll = await checkAndAutoClosePayroll(payroll);
            setSelectedPayroll(checkedPayroll);

            // 2. Cargar entradas
            const { data, error } = await supabase
                .from('payroll_entries')
                .select('*, workers(first_name, last_name, dui_number, profile_picture_url)')
                .eq('payroll_id', payroll.id);

            if (error) throw error;

            // Cargar permisos que podrían afectar a esta planilla
            const { data: leavesData } = await supabase
                .from('leaves')
                .select('*')
                .in('worker_id', (data || []).map(e => e.worker_id));
            setPayrollLeaves(leavesData || []);

            setPayrollEntries(data || []);

            // Set active day for mobile
            let idx = getTodayIndex(checkedPayroll);
            if (idx < 0) idx = 0;
            setActiveMobileDay(idx);
        } catch (error) {
            console.error('Error fetching payroll entries:', error);
            toast.error('Error al cargar el detalle de la planilla');
        } finally {
            setLoadingEntries(false);
        }
    };

    /** Alterna la asistencia de un trabajador en un día específico. */
    const toggleWorkerDay = async (entryId, dayIndex) => {
        if (!selectedPayroll || selectedPayroll.status === 'cerrada') return;

        const entry = payrollEntries.find((e) => e.id === entryId);
        if (!entry) return;

        // Si el día es no laboral o asueto, o de vacación/permiso, no hacer nada (opcional)
        // ...

        setPayrollEntries((prev) =>
            prev.map((e) => {
                if (e.id === entryId) {
                    const days = Array.isArray(e.days_attended) ? [...e.days_attended] : [];
                    days[dayIndex] = !days[dayIndex];
                    return { ...e, days_attended: days };
                }
                return e;
            })
        );
    };

    /** Marca la asistencia de todos los trabajadores para un día en la vista móvil. */
    const handleGlobalMobileMarkAll = async (dayIndex) => {
        if (!selectedPayroll || selectedPayroll.status === 'cerrada') return;

        const newEntries = payrollEntries.map((e) => {
            const dateStr = getDayDateString(selectedPayroll.created_at, dayIndex, selectedPayroll.start_date);
            const isHoliday = selectedPayroll.holidays?.includes(dateStr);
            const isNonWorking = selectedPayroll.non_working_days_config?.dates?.includes(dateStr);
            const isLeaveDay = payrollLeaves.some(l => l.worker_id === e.worker_id && dateStr >= l.start_date && dateStr <= l.end_date);

            const days = Array.isArray(e.days_attended) ? [...e.days_attended] : [];
            if (days.length <= dayIndex) {
                for (let i = days.length; i <= dayIndex; i++) days[i] = false;
            }
            days[dayIndex] = !(isHoliday || isNonWorking || isLeaveDay);
            return { ...e, days_attended: days };
        });

        setPayrollEntries(newEntries);
        toast.success("Asistencia de hoy completada");

        try {
            const updates = newEntries.map(entry =>
                supabase.from('payroll_entries').update({ days_attended: entry.days_attended }).eq('id', entry.id)
            );
            await Promise.all(updates);
        } catch (error) {
            console.error('Error batch update:', error);
            toast.error('Error guardando registros');
            fetchPayrollDetails(selectedPayroll);
        }
    };

    /** Marca o desmarca globalmente un día para todos los trabajadores. */
    const toggleAllDay = async (dayIndex, value) => {
        if (selectedPayroll?.status === 'cerrada') return;

        const newEntries = payrollEntries.map(entry => {
            let newArray = Array.isArray(entry.days_attended) ? [...entry.days_attended] : [];
            if (newArray.length <= dayIndex) {
                newArray = [...newArray, ...Array(dayIndex + 1 - newArray.length).fill(false)];
            }
            newArray[dayIndex] = value;
            return { ...entry, days_attended: newArray };
        });

        setPayrollEntries(newEntries);

        try {
            const updates = newEntries.map(entry =>
                supabase.from('payroll_entries').update({ days_attended: entry.days_attended }).eq('id', entry.id)
            );
            await Promise.all(updates);
            toast.success('Día actualizado globalmente', { id: `toast-day-${dayIndex}` });
        } catch (error) {
            console.error('Error batch update:', error);
            toast.error('Error guardando registros');
            fetchPayrollDetails(selectedPayroll);
        }
    };


    /** Añade un trabajador a la planilla seleccionada. */
    const addWorkerToPayroll = async (workerId) => {
        if (!selectedPayroll) return;

        try {
            const { error } = await supabase
                .from('payroll_entries')
                .insert([{
                    payroll_id: selectedPayroll.id,
                    worker_id: workerId,
                    days_attended: []
                }]);

            if (error) throw error;

            toast.success('Trabajador añadido a la planilla');
            fetchPayrollDetails(selectedPayroll); // Refrescar lista
        } catch (error) {
            console.error('Error adding worker:', error);
            toast.error('Error al añadir el trabajador');
        }
    };

    /** Cierra manualmente una planilla activa. */
    const closePayroll = async (payrollId) => {
        try {
            const { error } = await supabase
                .from('payrolls')
                .update({ status: 'cerrada' })
                .eq('id', payrollId);

            if (error) throw error;
            toast.success('Planilla cerrada correctamente');
            setSelectedPayroll(null);
            fetchPayrolls();
        } catch (error) {
            console.error('Error closing payroll:', error);
            toast.error('Error al intentar cerrar la planilla');
        }
    };

    /** Abre el diálogo de confirmación para eliminar una planilla. */
    const confirmDelete = (payrollId) => {
        setPayrollToDelete(payrollId);
        setIsDeleteDialogOpen(true);
    };

    /** Elimina permanentemente la planilla y todos sus registros asociados. */
    const deletePayroll = async () => {
        if (!payrollToDelete) return;

        try {
            const { error } = await supabase
                .from('payrolls')
                .delete()
                .eq('id', payrollToDelete);

            if (error) throw error;
            toast.success('Planilla eliminada');
            setSelectedPayroll(null);
            fetchPayrolls();
            setIsDeleteDialogOpen(false);
            setPayrollToDelete(null);
        } catch (error) {
            console.error('Error deleting payroll', error);
            toast.error('No se pudo eliminar la planilla');
        }
    }




    /** Alterna la exclusión de un trabajador en la importación de la nueva planilla. */
    const toggleExcludeWorker = (workerId) => {
        setNewPayroll(prev => {
            const isExcluded = prev.excluded_workers.includes(workerId);
            return {
                ...prev,
                excluded_workers: isExcluded
                    ? prev.excluded_workers.filter(id => id !== workerId)
                    : [...prev.excluded_workers, workerId]
            };
        });
    };

    return (
        <LazyMotion features={domAnimation}>
            <div className="space-y-6">
                <div className="flex justify-between items-start sm:items-center gap-3">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 leading-tight">Planillas de Asistencia</h1>
                        <p className="text-gray-500 text-sm mt-0.5 hidden sm:block">Gestiona las jornadas laboradas y genera reportes</p>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 bg-gray-900 text-white px-3 sm:px-5 py-2.5 rounded-xl hover:bg-black transition shadow-sm hover:shadow-md active:scale-[0.98] shrink-0"
                    >
                        <Plus className="w-5 h-5" strokeWidth={1.5} />
                        <span className="hidden sm:inline">Crear Planilla</span>
                    </button>
                </div>

                {/* Listado de planillas */}
                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {payrolls.map((payroll) => (
                                <div
                                    key={payroll.id}
                                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition flex flex-col h-full group"
                                    onClick={() => fetchPayrollDetails(payroll)}
                                >
                                    {(() => {
                                        const endStr = getDayDateString(payroll.created_at, (payroll.total_days || 14) - 1, payroll.start_date);
                                        const today = getTodayString();
                                        const isExpired = today > endStr;
                                        const displayActive = (payroll.status === 'abierta' || payroll.status === 'borrador') && !isExpired;
                                        return (
                                            <>
                                                <div className={`h-2 w-full shrink-0 ${displayActive ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                                                <div className="p-5 flex flex-col flex-1">
                                                    <div className="flex justify-between items-start mb-4 gap-4">
                                                        <div className="shrink-0 w-11 h-11 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 group-hover:text-gray-900 group-hover:bg-gray-100 transition-colors">
                                                            <Calendar className="w-5 h-5" strokeWidth={1.5} />
                                                        </div>
                                                        <h3 className="font-bold text-lg text-gray-900 text-right break-words leading-tight" title={payroll.name}>
                                                            {payroll.name}
                                                        </h3>
                                                    </div>
                                                    <div className="mb-2">
                                                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${displayActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                            {displayActive ? 'Activa' : 'Cerrada'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-auto pt-4 border-t border-gray-100 space-y-2.5 text-sm text-gray-600">
                                                        <div className="flex items-center gap-2.5">
                                                            <Calendar className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                                                            <span>Duración: <strong className="font-medium text-gray-900">{payroll.total_days} días</strong></span>
                                                        </div>
                                                        <div className="flex items-center gap-2.5">
                                                            <StopCircle className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                                                            <span>Asuetos: <strong className="font-medium text-gray-900">{payroll.holidays?.length || 0}</strong></span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            ))}
                        </div>
                        {
                            payrolls.length === 0 && (
                                <div className="col-span-full bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
                                    No hay planillas creadas aún.
                                </div>
                            )
                        }
                    </>
                )}
                {/* Modal de Creación */}
                {
                    isCreateModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                            <m.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                            >
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                    <h2 className="text-xl font-semibold text-gray-900">Nueva Planilla</h2>
                                    <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                        <X className="w-5 h-5" strokeWidth={1.5} />
                                    </button>
                                </div>
                                <form onSubmit={handleCreatePayroll} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto w-full">
                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <label htmlFor="project_name" className="block text-sm font-medium text-gray-700 mb-1">Nombre del Proyecto</label>
                                            <input
                                                id="project_name"
                                                type="text"
                                                value={newPayroll.project_name}
                                                onChange={e => setNewPayroll({ ...newPayroll, project_name: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                placeholder="Ej: Proyecto Alpha"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="payroll_name" className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Planilla (ej: Quincena 1 Enero)</label>
                                            <input
                                                id="payroll_name"
                                                type="text"
                                                required
                                                value={newPayroll.name}
                                                onChange={e => setNewPayroll({ ...newPayroll, name: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                placeholder="Nombre de la planilla"
                                            />
                                        </div>
                                        {/* Fecha inicio + total dias lado a lado */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio</label>
                                                <input
                                                    id="start_date"
                                                    type="date"
                                                    required
                                                    value={newPayroll.start_date}
                                                    onChange={e => setNewPayroll({ ...newPayroll, start_date: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="total_days" className="block text-sm font-medium text-gray-700 mb-1">Total de días</label>
                                                <input
                                                    id="total_days"
                                                    type="number"
                                                    min="1"
                                                    required
                                                    value={newPayroll.total_days}
                                                    onChange={e => setNewPayroll({ ...newPayroll, total_days: parseInt(e.target.value) || 1 })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Días de Asueto */}
                                    <div className="space-y-3 p-4 bg-gray-50 border border-gray-100 rounded-xl">
                                        <fieldset>
                                            <legend className="text-sm font-medium text-gray-700 mb-2">¿Hubo días de asueto (pagados) en este período?</legend>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        checked={!newPayroll.has_holiday}
                                                        onChange={() => setNewPayroll({ ...newPayroll, has_holiday: false })}
                                                        className="text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-sm text-gray-700">No</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        checked={newPayroll.has_holiday}
                                                        onChange={() => {
                                                            setNewPayroll({ ...newPayroll, has_holiday: true });
                                                            setActiveSubModal('holidays');
                                                        }}
                                                        className="text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Sí</span>
                                                </label>
                                            </div>
                                            {newPayroll.has_holiday && (
                                                <div className="mt-3 text-sm text-gray-500 flex justify-between items-center">
                                                    <span>{newPayroll.holidays.length} fechas seleccionadas</span>
                                                    <button type="button" onClick={() => setActiveSubModal('holidays')} className="text-gray-900 font-bold hover:underline text-xs uppercase tracking-wider">
                                                        Editar asuetos
                                                    </button>
                                                </div>
                                            )}
                                        </fieldset>
                                    </div>

                                    {/* Días No Laborales */}
                                    <div className="space-y-3 p-4 bg-gray-50 border border-gray-100 rounded-xl">
                                        <fieldset>
                                            <legend className="text-sm font-medium text-gray-700 mb-2">Días Laborales del Período</legend>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        checked={newPayroll.non_working_config.type === 'todos'}
                                                        onChange={() => setNewPayroll(p => ({ ...p, non_working_config: { type: 'todos', dates: [] } }))}
                                                        className="text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Todos</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        checked={newPayroll.non_working_config.type === 'excepto'}
                                                        onChange={() => {
                                                            setNewPayroll(p => ({ ...p, non_working_config: { ...p.non_working_config, type: 'excepto' } }));
                                                            setActiveSubModal('non_working');
                                                        }}
                                                        className="text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Excepto...</span>
                                                </label>
                                            </div>
                                            {newPayroll.non_working_config.type === 'excepto' && (
                                                <div className="mt-3 text-sm text-gray-500 flex justify-between items-center">
                                                    <span>{newPayroll.non_working_config.dates.length} días de paro</span>
                                                    <button type="button" onClick={() => setActiveSubModal('non_working')} className="text-primary-600 font-medium hover:underline text-xs">
                                                        Editar fechas
                                                    </button>
                                                </div>
                                            )}
                                        </fieldset>
                                    </div>

                                    {/* Selección de Trabajadores */}
                                    <div className="space-y-3 p-4 bg-gray-50 border border-gray-100 rounded-xl">
                                        <fieldset>
                                            <legend className="text-sm font-medium text-gray-700 mb-2">Trabajadores a Importar</legend>
                                            <div className="flex gap-4">
                                                <label htmlFor="import_all" className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        id="import_all"
                                                        type="radio"
                                                        checked={newPayroll.worker_import_type === 'todos'}
                                                        onChange={() => setNewPayroll(p => ({ ...p, worker_import_type: 'todos', excluded_workers: [] }))}
                                                        className="text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-sm text-gray-700 flex flex-col">
                                                        <span>Todos los activos</span>
                                                        <span className="text-xs text-gray-500">Se importan automáticamente</span>
                                                    </span>
                                                </label>
                                                <label htmlFor="import_except" className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        id="import_except"
                                                        type="radio"
                                                        checked={newPayroll.worker_import_type === 'excepto'}
                                                        onChange={() => {
                                                            setNewPayroll(p => ({ ...p, worker_import_type: 'excepto' }));
                                                            setActiveSubModal('workers');
                                                        }}
                                                        className="text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-sm text-gray-700 flex flex-col">
                                                        <span>Excepto...</span>
                                                        <span className="text-xs text-gray-500">Excluir algunos</span>
                                                    </span>
                                                </label>
                                            </div>
                                            {newPayroll.worker_import_type === 'excepto' && (
                                                <div className="mt-3 text-sm text-gray-500 flex justify-between items-center">
                                                    <span className="text-gray-900 font-bold">{newPayroll.excluded_workers.length} trabajador(es) excluidos</span>
                                                    <button type="button" onClick={() => setActiveSubModal('workers')} className="text-primary-600 font-medium hover:underline text-xs">
                                                        Editar exclusiones
                                                    </button>
                                                </div>
                                            )}
                                        </fieldset>
                                    </div>

                                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                                        <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition">
                                            Cancelar
                                        </button>
                                        <button type="submit" className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition shadow-sm">
                                            Crear Planilla
                                        </button>
                                    </div>
                                </form>
                            </m.div>
                        </div>
                    )
                }

                {/* Sub-modales de Configuración */}
                {
                    activeSubModal && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                            <m.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                            >
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                    <h3 className="font-semibold text-gray-900">
                                        {activeSubModal === 'holidays' && 'Seleccionar Asuetos'}
                                        {activeSubModal === 'non_working' && 'Días No Laborados'}
                                        {activeSubModal === 'workers' && 'Excluir Trabajadores'}
                                    </h3>
                                    <button onClick={() => setActiveSubModal(null)} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="p-6 max-h-[60vh] overflow-y-auto">
                                    {/* Modal de Asuetos */}
                                    {activeSubModal === 'holidays' && (
                                        <div className="space-y-4 flex flex-col items-center">
                                            <DayPicker
                                                mode="multiple"
                                                locale={es}
                                                selected={newPayroll.holidays.map(d => parse(d, 'yyyy-MM-dd', new Date()))}
                                                onSelect={(dates) => {
                                                    if (!dates) return;
                                                    setNewPayroll({
                                                        ...newPayroll,
                                                        holidays: dates.map(d => format(d, 'yyyy-MM-dd'))
                                                    });
                                                }}
                                                className="bg-white rounded-xl border border-gray-100 p-2 shadow-sm"
                                            />
                                            {newPayroll.holidays.length === 0 && <p className="text-sm text-gray-500">Haz clic en los días para seleccionar</p>}
                                            {newPayroll.holidays.length > 0 && <p className="text-sm font-medium text-primary-600">{newPayroll.holidays.length} días seleccionados</p>}
                                        </div>
                                    )}

                                    {/* Modal Días No Laborados */}
                                    {activeSubModal === 'non_working' && (
                                        <div className="space-y-4 flex flex-col items-center">
                                            <DayPicker
                                                mode="multiple"
                                                locale={es}
                                                selected={newPayroll.non_working_config.dates.map(d => parse(d, 'yyyy-MM-dd', new Date()))}
                                                onSelect={(dates) => {
                                                    if (!dates) return;
                                                    setNewPayroll({
                                                        ...newPayroll,
                                                        non_working_config: {
                                                            ...newPayroll.non_working_config,
                                                            dates: dates.map(d => format(d, 'yyyy-MM-dd'))
                                                        }
                                                    });
                                                }}
                                                className="bg-white rounded-xl border border-gray-100 p-2 shadow-sm"
                                            />
                                            {newPayroll.non_working_config.dates.length === 0 && <p className="text-sm text-gray-500">Haz clic en los días para seleccionar</p>}
                                            {newPayroll.non_working_config.dates.length > 0 && <p className="text-sm font-bold text-gray-900">{newPayroll.non_working_config.dates.length} días excluidos</p>}
                                        </div>
                                    )}

                                    {/* Modal Exclusión de Trabajadores */}
                                    {activeSubModal === 'workers' && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-gray-500 mb-4 px-1">
                                                Selecciona los trabajadores que <strong>NO</strong> deseas importar en esta planilla:
                                            </p>
                                            {availableWorkers.length === 0 && <p className="text-sm text-gray-400 text-center">No hay trabajadores activos.</p>}
                                            {availableWorkers.map(worker => {
                                                const isExcluded = newPayroll.excluded_workers.includes(worker.id);
                                                return (
                                                    <label
                                                        key={worker.id}
                                                        htmlFor={`exclude-${worker.id}`}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${isExcluded ? 'bg-gray-100 border-gray-200 shadow-sm' : 'hover:bg-gray-50 border-transparent hover:border-gray-200'}`}
                                                    >
                                                        <input
                                                            id={`exclude-${worker.id}`}
                                                            type="checkbox"
                                                            checked={isExcluded}
                                                            onChange={() => toggleExcludeWorker(worker.id)}
                                                            className="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className={`text-sm font-bold ${isExcluded ? 'text-gray-900' : 'text-gray-900'}`}>{worker.first_name} {worker.last_name}</span>
                                                            <span className={`text-xs font-medium ${isExcluded ? 'text-gray-500' : 'text-gray-400'}`}>{worker.employee_type}</span>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
                                    <button onClick={() => setActiveSubModal(null)} className="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition">
                                        Listo
                                    </button>
                                </div>
                            </m.div>
                        </div>
                    )
                }

                {/* Vista Modal de Detalle / Edición */}
                {
                    selectedPayroll && (
                        <div className="fixed inset-0 z-40 flex flex-col h-full w-full bg-gray-50 lg:pl-64">

                            {/* Header — mismo estilo que el resto del app */}
                            <header className="shrink-0 bg-white border-b border-gray-100 shadow-sm z-10">
                                <div className="max-w-7xl mx-auto px-5 sm:px-8">

                                    {/* Top row: back + actions */}
                                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                        <button
                                            onClick={() => setSelectedPayroll(null)}
                                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-100 hover:border-gray-200 bg-white rounded-xl transition shadow-sm"
                                        >
                                            <X className="w-4 h-4" strokeWidth={1.5} />
                                            Volver
                                        </button>
                                        <div className="flex items-center gap-2">
                                            {selectedPayroll.status !== 'cerrada' && (
                                                <button
                                                    onClick={() => setIsAddWorkerModalOpen(true)}
                                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-100 hover:bg-gray-50 rounded-xl transition shadow-sm"
                                                >
                                                    <UserPlus className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />
                                                    <span className="hidden sm:inline">Agregar trabajador</span>
                                                </button>
                                            )}

                                            {/* Botón de Cierre Manual */}
                                            {selectedPayroll.status !== 'cerrada' && (
                                                <button
                                                    onClick={() => closePayroll(selectedPayroll.id)}
                                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100 rounded-xl transition shadow-sm"
                                                >
                                                    <StopCircle className="w-4 h-4" strokeWidth={1.5} />
                                                    <span className="hidden sm:inline">Cerrar planilla</span>
                                                </button>
                                            )}

                                            <button
                                                onClick={() => confirmDelete(selectedPayroll.id)}
                                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-black rounded-xl transition shadow-sm"
                                            >
                                                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                                <span className="hidden sm:inline">Eliminar</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Title + meta */}
                                    <div className="py-6">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                            {/* Left */}
                                            <div>
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <h1 className="text-3xl font-bold text-gray-900">
                                                        {selectedPayroll.name}
                                                    </h1>
                                                    {(() => {
                                                        const endStr = getDayDateString(selectedPayroll.created_at, (selectedPayroll.total_days || 14) - 1, selectedPayroll.start_date);
                                                        const today = getTodayString();
                                                        const isExpired = today > endStr;
                                                        const displayActive = (selectedPayroll.status === 'abierta' || selectedPayroll.status === 'borrador') && !isExpired;

                                                        return displayActive ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                Activa
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 text-gray-500 text-xs font-bold border border-gray-100">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                                                Cerrada
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <p className="text-gray-600 mt-2 text-sm flex flex-wrap gap-x-3 gap-y-1">
                                                    {selectedPayroll.project_name && (
                                                        <span>Proyecto: <strong className="text-gray-700">{selectedPayroll.project_name}</strong></span>
                                                    )}
                                                    {selectedPayroll.created_at && (() => {
                                                        const startStr = getDayDateString(selectedPayroll.created_at, 0, selectedPayroll.start_date);
                                                        const endStr = getDayDateString(selectedPayroll.created_at, (selectedPayroll.total_days || 14) - 1, selectedPayroll.start_date);
                                                        const fmtDate = (s) => {
                                                            const [y, m, d] = s.split('-');
                                                            return `${d}/${m}/${y}`;
                                                        };
                                                        return (
                                                            <span>
                                                                <strong className="text-gray-700">{fmtDate(startStr)}</strong>
                                                                <span className="text-gray-400 mx-1">→</span>
                                                                <strong className="text-gray-700">{fmtDate(endStr)}</strong>
                                                                <span className="text-gray-400 ml-1">({selectedPayroll.total_days} días)</span>
                                                            </span>
                                                        );
                                                    })()}
                                                </p>
                                            </div>

                                            {/* Right: stat cards — same style as dashboard cards */}
                                            <div className="flex gap-3 flex-wrap sm:shrink-0">
                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                                        <Calendar className="w-5 h-5 text-gray-500" />
                                                    </div>
                                                    <div>
                                                        <p className="text-2xl font-bold text-gray-900 leading-none">{selectedPayroll.total_days}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">Días</p>
                                                    </div>
                                                </div>
                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-2xl font-bold text-gray-900 leading-none">{payrollEntries.length}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">Trabajadores</p>
                                                    </div>
                                                </div>
                                                {selectedPayroll.holidays?.length > 0 && (
                                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                                            <Calendar className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
                                                        </div>
                                                        <div>
                                                            <p className="text-2xl font-bold text-gray-900 leading-none">{selectedPayroll.holidays.length}</p>
                                                            <p className="text-xs text-gray-500 mt-0.5">Asuetos</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedPayroll.non_working_days_config?.dates?.length > 0 && (
                                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                                            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                                        </div>
                                                        <div>
                                                            <p className="text-2xl font-bold text-gray-900 leading-none">{selectedPayroll.non_working_days_config.dates.length}</p>
                                                            <p className="text-xs text-gray-500 mt-0.5">No laborales</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </header>

                            {/* ── Attendance Table ── */}
                            <div className="flex-1 overflow-auto p-4 sm:p-6">
                                {loadingEntries ? (
                                    <div className="flex flex-col items-center justify-center py-28 gap-4">
                                        <div className="w-10 h-10 rounded-full border-4 border-b-transparent border-primary-500 animate-spin"></div>
                                        <p className="text-gray-500 font-medium text-sm">Cargando asistencias...</p>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">


                                        {/* Global Action Buttons for Mobile (Any Day) */}
                                        {(() => {
                                            const endStr = getDayDateString(selectedPayroll.created_at, (selectedPayroll.total_days || 14) - 1, selectedPayroll.start_date);
                                            const isExpired = getTodayString() > endStr;

                                            if (selectedPayroll.status === 'cerrada' || isExpired) return null;

                                            return (
                                                <div className="block md:hidden p-4 bg-white border-b border-gray-100 shadow-sm relative z-20">
                                                    <div className="mb-4 flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                                                                <Calendar className="w-4 h-4" />
                                                            </div>
                                                            <h4 className="text-sm font-bold text-gray-900 leading-tight">Asistencia Rápida</h4>
                                                        </div>

                                                        <select
                                                            value={activeMobileDay}
                                                            onChange={(e) => setActiveMobileDay(Number(e.target.value))}
                                                            className="bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg focus:ring-sky-500 focus:border-sky-500 block p-2 font-semibold"
                                                        >
                                                            {Array.from({ length: selectedPayroll.total_days || 15 }).map((_, i) => {
                                                                const dateStr = getDayDateString(selectedPayroll.created_at, i, selectedPayroll.start_date);
                                                                const dateObj = parseISO(dateStr);
                                                                return (
                                                                    <option key={i} value={i}>
                                                                        Día {i + 1} - {format(dateObj, "dd MMM", { locale: es })}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleGlobalMobileMarkAll(activeMobileDay)}
                                                            className="flex-1 bg-gray-900 hover:bg-black active:bg-gray-800 text-white rounded-xl py-3.5 text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <CheckCircle2 className="w-5 h-5" />
                                                            Todos
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setAbsentWorkers([]);
                                                                setIsGlobalExceptionModalOpen(true);
                                                            }}
                                                            className="flex-1 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl py-3.5 text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            Todos excepto...
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <div className="overflow-x-auto no-scrollbar w-full relative z-10 rounded-2xl">
                                            <table className="w-full text-left border-collapse min-w-max">
                                                <thead>
                                                    <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                                                        <th className="px-5 py-4 sticky left-0 bg-gray-50 z-20 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.1)] min-w-[200px] sm:min-w-[240px]">
                                                            Trabajador
                                                        </th>
                                                        {Array.from({ length: selectedPayroll.total_days || 15 }).map((_, i) => {
                                                            const dateStr = getDayDateString(selectedPayroll.created_at, i, selectedPayroll.start_date);
                                                            const isHoliday = selectedPayroll.holidays?.includes(dateStr);
                                                            const isNonWorking = selectedPayroll.non_working_days_config?.dates?.includes(dateStr);
                                                            const isDisabled = isHoliday || isNonWorking;

                                                            // Global 3-day visibility logic: only show i-1, i, i+1 around activeMobileDay (used as anchor for all screens now)
                                                            const isVisibleInTable = i >= activeMobileDay - 1 && i <= activeMobileDay + 1;

                                                            let allChecked = false;
                                                            if (payrollEntries.length > 0 && !isDisabled) {
                                                                allChecked = payrollEntries.every(e => {
                                                                    const arr = Array.isArray(e.days_attended) ? e.days_attended : [];
                                                                    return arr[i] === true;
                                                                });
                                                            }
                                                            return (
                                                                <th key={i} className={`px-1 py-3 text-center min-w-[52px] border-l border-gray-100 ${isDisabled ? 'bg-gray-100/60' : 'bg-gray-50'} ${isVisibleInTable ? 'table-cell' : 'hidden'} md:table-cell`}>
                                                                    <div className="flex flex-col items-center gap-1.5">
                                                                        <span className={`text-[10px] font-bold uppercase ${isDisabled ? 'text-gray-300' : 'text-gray-400'}`}>
                                                                            {(() => {
                                                                                const [, m, d] = dateStr.split('-');
                                                                                return `${monthLetters[parseInt(m) - 1]}${parseInt(d)}`;
                                                                            })()}
                                                                        </span>
                                                                        {isDisabled ? (
                                                                            <div
                                                                                className={`w-5 h-5 rounded flex items-center justify-center cursor-not-allowed pointer-events-none border
                                                                                 ${isHoliday
                                                                                        ? 'bg-gray-100 border-gray-200'
                                                                                        : 'bg-gray-50 border-gray-200 shadow-sm'
                                                                                    }`}
                                                                                title={isHoliday ? 'Día de asueto' : 'Día no laboral'}
                                                                            >
                                                                                <span className={`text-[9px] font-bold leading-none ${isHoliday ? 'text-gray-900' : 'text-gray-400'}`}>
                                                                                    {isHoliday ? 'A' : 'NL'}
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <label
                                                                                htmlFor={`day-toggle-${i}`}
                                                                                className={`flex items-center justify-center ${selectedPayroll.status === 'cerrada' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                                                title={selectedPayroll.status === 'cerrada' ? 'Planilla cerrada' : 'Marcar todos en este día'}
                                                                                role="button"
                                                                                tabIndex={selectedPayroll.status === 'cerrada' ? -1 : 0}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter' && selectedPayroll.status !== 'cerrada') {
                                                                                        toggleAllDay(i, !allChecked);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <input id={`day-toggle-${i}`} type="checkbox" className="peer sr-only"
                                                                                    disabled={selectedPayroll.status === 'cerrada'}
                                                                                    checked={allChecked}
                                                                                    onChange={(e) => toggleAllDay(i, e.target.checked)}
                                                                                />
                                                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all relative
                                                                                ${allChecked ? 'bg-gray-50 border-gray-500' : 'bg-white border-gray-300'}
                                                                                peer-disabled:opacity-40 peer-disabled:cursor-not-allowed
                                                                            `}>
                                                                                    <svg className={`w-3 h-3 text-gray-700 transition-all absolute ${allChecked ? 'opacity-100' : 'opacity-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                                                </div>
                                                                            </label>
                                                                        )}
                                                                    </div>
                                                                </th>
                                                            );
                                                        })}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {payrollEntries.map((entry, rowIdx) => {
                                                        const totalWorked = (Array.isArray(entry.days_attended) ? entry.days_attended : []).filter(Boolean).length;
                                                        return (
                                                            <tr key={entry.id} className="group hover:bg-gray-50 transition-colors bg-white">
                                                                <td className="py-3.5 px-5 sticky left-0 bg-white group-hover:bg-gray-50 transition-colors z-[5] shadow-[2px_0_8px_-4px_rgba(0,0,0,0.08)] border-b border-gray-100">
                                                                    <div className="flex items-center justify-between min-w-[200px]">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-9 h-9 rounded-full shrink-0 border-2 border-white shadow overflow-hidden">
                                                                                {entry.workers?.profile_picture_url ? (
                                                                                    <img
                                                                                        src={entry.workers.profile_picture_url}
                                                                                        alt={entry.workers.first_name}
                                                                                        className="w-full h-full object-cover"
                                                                                    />
                                                                                ) : (
                                                                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                                                        <svg className="w-6 h-6 mt-1 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                                                                            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                                                                                        </svg>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <p className="font-medium text-gray-900 text-sm truncate">{entry.workers?.first_name} {entry.workers?.last_name}</p>
                                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                                    <span className="text-[11px] text-gray-400">{entry.workers?.dui_number}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[28px] text-center ml-2 ${totalWorked > 0 ? 'bg-sky-50 text-sky-700 border border-sky-100' : 'bg-gray-100 text-gray-400 border border-transparent'}`}>{totalWorked}</span>
                                                                    </div>
                                                                </td>

                                                                {Array.from({ length: selectedPayroll.total_days || 15 }).map((_, i) => {
                                                                    const arr = Array.isArray(entry.days_attended) ? entry.days_attended : [];
                                                                    const isChecked = arr[i] === true;
                                                                    const dateStr = getDayDateString(selectedPayroll.created_at, i, selectedPayroll.start_date);
                                                                    const isHoliday = selectedPayroll.holidays?.includes(dateStr);
                                                                    const isNonWorking = selectedPayroll.non_working_days_config?.dates?.includes(dateStr);
                                                                    const isLeaveDay = payrollLeaves.some(l => l.worker_id === entry.worker_id && dateStr >= l.start_date && dateStr <= l.end_date);
                                                                    const leave = isLeaveDay ? payrollLeaves.find(l => l.worker_id === entry.worker_id && dateStr >= l.start_date && dateStr <= l.end_date) : null;
                                                                    const isDisabled = isHoliday || isNonWorking;

                                                                    const isVisibleInTable = i >= activeMobileDay - 1 && i <= activeMobileDay + 1;

                                                                    return (
                                                                        <td key={i} className={`px-1 py-2 text-center border-l border-b border-gray-100 ${isDisabled || isLeaveDay ? 'bg-gray-50/50' : ''} ${isVisibleInTable ? 'table-cell' : 'hidden'} md:table-cell`}>
                                                                            {isDisabled ? (
                                                                                <div className={`w-4 h-4 rounded border ${isHoliday ? 'border-gray-300 bg-gray-100' : 'border-dashed border-gray-300'} mx-auto flex items-center justify-center opacity-40`}></div>
                                                                            ) : isLeaveDay ? (
                                                                                <div className={`w-4 h-4 rounded border ${leave.is_paid ? 'bg-sky-50 border-sky-200 text-sky-600' : 'bg-gray-100 border-gray-300 text-gray-400'} mx-auto flex items-center justify-center font-bold text-[9px]`} title={`Permiso/Incapacidad ${leave.is_paid ? 'con' : 'sin'} goce de sueldo`}>
                                                                                    P
                                                                                </div>
                                                                            ) : (
                                                                                <label className={`w-4 h-4 rounded mx-auto flex items-center justify-center border shadow-sm transition-all relative ${selectedPayroll.status === 'cerrada' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${isChecked ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300'} active:scale-95`}>
                                                                                    <input type="checkbox" className="sr-only" checked={isChecked} onChange={() => toggleWorkerDay(entry.id, i)} disabled={selectedPayroll.status === 'cerrada'} />
                                                                                    {isChecked && <svg className="w-3 h-3 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                                                </label>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        );
                                                    })}
                                                    {payrollEntries.length === 0 && (
                                                        <tr>
                                                            <td colSpan={(selectedPayroll.total_days || 15) + 1} className="py-20 text-center">
                                                                <div className="flex flex-col items-center gap-3">
                                                                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                                                                        <Calendar className="w-6 h-6 text-gray-400" />
                                                                    </div>
                                                                    <p className="text-gray-500 text-sm font-medium">No hay trabajadores en esta planilla.</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Leaves & Summary Section — visible on all screens */}
                                        {payrollLeaves.length > 0 && (
                                            <div className="mt-4 px-4 pb-6">
                                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                                    {/* Section header */}
                                                    <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gray-50 border-b border-gray-100">
                                                        <Activity className="w-4 h-4 text-sky-500 shrink-0" strokeWidth={2} />
                                                        <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.12em]">Permisos e Incapacidades en esta Planilla</h4>
                                                        <span className="ml-auto text-[10px] font-bold bg-sky-50 text-sky-600 border border-sky-100 px-2 py-0.5 rounded-full">{payrollLeaves.length} {payrollLeaves.length === 1 ? 'registro' : 'registros'}</span>
                                                    </div>

                                                    {/* Leave rows */}
                                                    <div className="divide-y divide-gray-50">
                                                        {payrollLeaves.map((leave) => {
                                                            const worker = payrollEntries.find(e => e.worker_id === leave.worker_id);
                                                            const fmtDate = (s) => {
                                                                if (!s) return '—';
                                                                const [y, m, d] = s.split('-');
                                                                return `${d}/${m}/${y}`;
                                                            };
                                                            const typeLabel = {
                                                                'permiso': 'Permiso',
                                                                'incapacidad': 'Incapacidad',
                                                                'vacaciones': 'Vacaciones',
                                                            }[leave.type] || leave.type || 'Permiso';

                                                            return (
                                                                <div key={leave.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                                                                    {/* Avatar */}
                                                                    <div className="w-9 h-9 rounded-full shrink-0 border-2 border-white shadow overflow-hidden bg-gray-100 flex items-center justify-center">
                                                                        {worker?.workers?.profile_picture_url ? (
                                                                            <img src={worker.workers.profile_picture_url} alt="" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <svg className="w-5 h-5 mt-0.5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                                                        )}
                                                                    </div>

                                                                    {/* Name + dates */}
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-semibold text-gray-900 text-sm truncate">
                                                                            {worker?.workers?.first_name} {worker?.workers?.last_name}
                                                                        </p>
                                                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                                                            {fmtDate(leave.start_date)}
                                                                            {leave.end_date && leave.end_date !== leave.start_date && (
                                                                                <> <span className="text-gray-300">→</span> {fmtDate(leave.end_date)}</>
                                                                            )}
                                                                            {leave.reason && <span className="ml-2 text-gray-400">· {leave.reason}</span>}
                                                                        </p>
                                                                    </div>

                                                                    {/* Type badge */}
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${leave.type === 'incapacidad'
                                                                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                                            : leave.type === 'vacaciones'
                                                                                ? 'bg-sky-50 text-sky-700 border-sky-100'
                                                                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                                                            } uppercase tracking-wide`}>
                                                                            {typeLabel}
                                                                        </span>
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${leave.is_paid ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                                            {leave.is_paid ? 'Con goce' : 'Sin goce'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* Modal Confirmación Eliminación */}
                {
                    isDeleteDialogOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                            <m.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
                            >
                                <div className="p-6">
                                    <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-900 border border-gray-200 shadow-sm">
                                        <AlertTriangle className="w-6 h-6" strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-lg font-bold text-center text-gray-900 mb-2">¿Eliminar Planilla?</h3>
                                    <p className="text-sm text-center text-gray-500 mb-6">
                                        Esta acción no se puede deshacer. Todos los registros y cálculos de asistencia serán eliminados permanentemente.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setIsDeleteDialogOpen(false);
                                                setPayrollToDelete(null);
                                            }}
                                            className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={deletePayroll}
                                            className="flex-1 py-2 rounded-xl bg-gray-900 text-white font-medium hover:bg-black transition shadow-sm flex items-center justify-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                            <span>Eliminar</span>
                                        </button>
                                    </div>
                                </div>
                            </m.div>
                        </div>
                    )
                }

                {/* Modal Agregar Trabajador a Planilla Existente */}
                {/* Modal Agregar Trabajador a Planilla Existente */}
                {
                    isAddWorkerModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                            <m.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                            >
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                        <UserPlus className="w-5 h-5 text-emerald-600" strokeWidth={1.5} />
                                        Añadir a planilla
                                    </h3>
                                    <button onClick={() => setIsAddWorkerModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm">
                                        <X className="w-4 h-4" strokeWidth={1.5} />
                                    </button>
                                </div>

                                <div className="p-6">
                                    <div className="relative mb-6">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                                        <input
                                            type="text"
                                            placeholder="Buscar por nombre..."
                                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none transition"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                                        {(() => {
                                            const currentWorkerIds = payrollEntries.map(e => e.worker_id);
                                            const available = availableWorkers.filter(w =>
                                                !currentWorkerIds.includes(w.id) &&
                                                `${w.first_name} ${w.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
                                            );

                                            if (available.length === 0) {
                                                return <p className="text-center py-8 text-gray-400 text-sm italic">No hay más trabajadores para añadir.</p>;
                                            }

                                            return available.map(worker => (
                                                <div
                                                    key={worker.id}
                                                    className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 shrink-0">
                                                            {worker.profile_picture_url ? (
                                                                <img
                                                                    src={worker.profile_picture_url}
                                                                    alt={`${worker.first_name} ${worker.last_name}`}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <span className="text-xs font-bold text-gray-400">{worker.first_name[0]}{worker.last_name[0]}</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900">{worker.first_name} {worker.last_name}</p>
                                                            <p className="text-[10px] text-gray-400 font-medium uppercase">{worker.employee_type}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => addWorkerToPayroll(worker.id)}
                                                        className="p-2 bg-white text-gray-900 rounded-lg shadow-sm border border-gray-100 hover:bg-gray-900 hover:text-white transition-all active:scale-95"
                                                        title="Añadir a esta planilla"
                                                    >
                                                        <Plus className="w-4 h-4" strokeWidth={1.5} />
                                                    </button>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>

                                <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
                                    <button
                                        onClick={() => setIsAddWorkerModalOpen(false)}
                                        className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition shadow-lg active:scale-95"
                                    >
                                        Finalizar
                                    </button>
                                </div>
                            </m.div>
                        </div>
                    )
                }
                {/* Global Exception Modal */}
                {isGlobalExceptionModalOpen && (() => {
                    const dateStr = getDayDateString(selectedPayroll.created_at, activeMobileDay, selectedPayroll.start_date);
                    const isHoliday = selectedPayroll.holidays?.includes(dateStr);
                    const isNonWorking = selectedPayroll.non_working_days_config?.dates?.includes(dateStr);
                    const todayDateObj = parseISO(dateStr);

                    return (
                        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                            <m.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                                onClick={() => setIsGlobalExceptionModalOpen(false)}
                            />
                            <m.div
                                initial={{ opacity: 0, y: "100%" }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md relative z-10 flex flex-col max-h-[85vh]"
                            >
                                {/* Drawer handle for mobile */}
                                <div className="w-full flex justify-center pt-3 pb-2 sm:hidden">
                                    <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
                                </div>

                                <div className="p-6 pb-4 border-b border-gray-100 flex justify-between items-start shrink-0">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">Ausencias</h3>
                                        <p className="text-sm text-gray-500 mt-1">{format(todayDateObj, "EEEE dd 'de' MMMM", { locale: es })}</p>
                                    </div>
                                    <button
                                        onClick={() => setIsGlobalExceptionModalOpen(false)}
                                        className="p-2 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                                    <p className="text-xs text-gray-500 mb-4 px-2 text-center uppercase tracking-wider font-semibold">Selecciona a quienes FALTARON</p>

                                    {isHoliday || isNonWorking ? (
                                        <div className="p-8 text-center bg-gray-100 rounded-2xl border border-gray-200 border-dashed">
                                            <div className="w-12 h-12 bg-white rounded-full mx-auto flex items-center justify-center shadow-sm mb-3">
                                                <Calendar className="w-6 h-6 text-gray-400" />
                                            </div>
                                            <p className="font-bold text-gray-900">Día inhábil</p>
                                            <p className="text-sm text-gray-500">No se puede depositar faltas este día.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {payrollEntries.map((entry) => {
                                                const isLeaveDay = payrollLeaves.some(l => l.worker_id === entry.worker_id && dateStr >= l.start_date && dateStr <= l.end_date);
                                                const isAbsent = absentWorkers.includes(entry.id);

                                                return (
                                                    <div key={entry.id} className={`flex items-center justify-between p-4 rounded-2xl border ${isLeaveDay ? 'bg-gray-100/50 border-gray-100' : 'bg-white border-gray-200 shadow-sm'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 shrink-0">
                                                                {entry.workers?.profile_picture_url ? (
                                                                    <img
                                                                        src={entry.workers.profile_picture_url}
                                                                        alt={`${entry.workers.first_name} ${entry.workers.last_name}`}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center font-bold text-gray-400 text-xs">
                                                                        {entry.workers?.first_name?.[0]}{entry.workers?.last_name?.[0]}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className={`font-bold ${isLeaveDay ? 'text-gray-400' : 'text-gray-900'}`}>{entry.workers?.first_name} {entry.workers?.last_name}</p>
                                                                {isLeaveDay && (
                                                                    <p className="text-xs text-gray-500 font-medium">Permiso/Incapacidad</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {!isLeaveDay && (
                                                            <label className={`flex items-center justify-center p-2 rounded-xl transition-all ${selectedPayroll.status === 'cerrada' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
                                                                <input type="checkbox" className="peer sr-only"
                                                                    checked={isAbsent}
                                                                    onChange={() => {
                                                                        setAbsentWorkers(prev =>
                                                                            prev.includes(entry.id) ? prev.filter(id => id !== entry.id) : [...prev, entry.id]
                                                                        );
                                                                    }}
                                                                    disabled={selectedPayroll.status === 'cerrada'}
                                                                />
                                                                <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all relative
                                                                ${isAbsent ? 'bg-red-500 border-red-500' : 'bg-white border-gray-300'}
                                                            `}>
                                                                    {isAbsent && <X className="w-5 h-5 text-white transition-all absolute" strokeWidth={3} />}
                                                                </div>
                                                            </label>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                                    <button
                                        onClick={() => {
                                            setIsGlobalExceptionModalOpen(false);

                                            // Save optimistic updates to database
                                            // EVERYONE not in absentWorkers gets True for today. Absent ones get False.
                                            const newEntries = payrollEntries.map(entry => {
                                                const isLeaveDay = payrollLeaves.some(l => l.worker_id === entry.worker_id && dateStr >= l.start_date && dateStr <= l.end_date);
                                                const days = Array.isArray(entry.days_attended) ? [...entry.days_attended] : [];
                                                if (days.length <= activeMobileDay) {
                                                    for (let i = days.length; i <= activeMobileDay; i++) days[i] = false;
                                                }

                                                if (isLeaveDay || isHoliday || isNonWorking) {
                                                    days[activeMobileDay] = false; // logic fallback for inactive days
                                                } else {
                                                    days[activeMobileDay] = !absentWorkers.includes(entry.id);
                                                }
                                                return { ...entry, days_attended: days };
                                            });

                                            setPayrollEntries(newEntries);
                                            toast.success("Asistencia registrada con éxito");

                                            const ops = newEntries.map(entry =>
                                                supabase.from('payroll_entries').update({ days_attended: entry.days_attended }).eq('id', entry.id)
                                            );
                                            Promise.all(ops).catch(e => {
                                                console.error("error saving", e);
                                                toast.error("Hubo un error al guardar la asistencia");
                                                fetchPayrollDetails(selectedPayroll);
                                            });
                                        }}
                                        className="w-full bg-gray-900 hover:bg-black text-white rounded-xl py-3.5 font-bold shadow-md transition-all active:scale-[0.98]"
                                    >
                                        ¡Guardar y Registrar!
                                    </button>
                                </div>
                            </m.div>
                        </div>
                    );
                })()}

            </div>
        </LazyMotion>
    );
}
