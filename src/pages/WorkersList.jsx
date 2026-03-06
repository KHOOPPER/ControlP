import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Users, Search, ChevronRight, Pencil, Trash2, AlertTriangle, X, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import toast from 'react-hot-toast';

/**
 * @fileoverview WorkersList.jsx - Directorio de Colaboradores.
 * Este componente muestra una lista filtrable de todos los trabajadores registrados,
 * permitiendo la edición rápida de sus datos y la eliminación de registros.
 */

/** Constante para limpiar el formulario de edición. */
const EMPTY_EDIT = {
    first_name: '', last_name: '', dui_number: '', phone_number: '',
    current_address: '', emergency_contact_name: '', emergency_contact_phone: '',
    allergies_comments: '',
};

/**
 * Componente WorkersList
 * Proporciona una interfaz de búsqueda, visualización y gestión (edición/eliminación)
 * para la base de datos central de colaboradores.
 * 
 * @returns {JSX.Element} El listado interactivo de trabajadores.
 */
export default function WorkersList() {
    /** Lista completa de trabajadores obtenida de la DB. */
    const [workers, setWorkers] = useState([]);
    /** Estado de carga inicial. */
    const [isLoading, setIsLoading] = useState(true);
    /** Término de búsqueda para filtrar la lista. */
    const [searchTerm, setSearchTerm] = useState('');
    /** Trabajador seleccionado para eliminación. */
    const [workerToDelete, setWorkerToDelete] = useState(null);
    /** Estado de carga durante la eliminación. */
    const [isDeleting, setIsDeleting] = useState(false);
    /** Trabajador que se está editando actualmente. */
    const [editWorker, setEditWorker] = useState(null);   // worker being edited
    /** Datos del formulario de edición. */
    const [editForm, setEditForm] = useState(EMPTY_EDIT);
    /** Estado de carga durante el guardado de la edición. */
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => { fetchWorkers(); }, []);

    /**
     * Obtiene la lista de todos los trabajadores desde Supabase.
     */
    const fetchWorkers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('workers').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setWorkers(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Prepara y abre el modal de edición para un trabajador específico.
     * 
     * @param {Object} worker - El objeto del trabajador a editar.
     */
    const openEdit = (worker) => {
        setEditWorker(worker);
        setEditForm({
            first_name: worker.first_name || '',
            last_name: worker.last_name || '',
            dui_number: worker.dui_number || '',
            phone_number: worker.phone_number || '',
            current_address: worker.current_address || '',
            emergency_contact_name: worker.emergency_contact_name || '',
            emergency_contact_phone: worker.emergency_contact_phone || '',
            allergies_comments: worker.allergies_comments || '',
        });
    };

    /**
     * Persiste los cambios realizados en el formulario de edición.
     */
    const saveEdit = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase.from('workers').update(editForm).eq('id', editWorker.id);
            if (error) throw error;
            setWorkers(prev => prev.map(w => w.id === editWorker.id ? { ...w, ...editForm } : w));
            toast.success('Trabajador actualizado');
            setEditWorker(null);
        } catch (e) {
            toast.error('Error al guardar cambios');
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Elimina permanentemente el registro de un trabajador de la base de datos.
     */
    const deleteWorker = async () => {
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('workers').delete().eq('id', workerToDelete.id);
            if (error) throw error;
            setWorkers(prev => prev.filter(w => w.id !== workerToDelete.id));
            toast.success('Trabajador eliminado');
            setWorkerToDelete(null);
        } catch (e) {
            toast.error('Error al eliminar');
        } finally {
            setIsDeleting(false);
        }
    };

    /** Helper para generar props de inputs controlados. */
    const field = (key) => ({ value: editForm[key], onChange: (e) => setEditForm(p => ({ ...p, [key]: e.target.value })) });
    const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white shadow-sm transition";

    /** Filtra la lista local de trabajadores basada en el término de búsqueda. */
    const filteredWorkers = workers.filter(w => {
        const name = `${w.first_name} ${w.last_name}`.toLowerCase();
        return name.includes(searchTerm.toLowerCase()) || (w.dui_number && w.dui_number.includes(searchTerm));
    });

    return (
        <LazyMotion features={domAnimation}>
            <div className="max-w-7xl mx-auto pb-12">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                            <Users className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600" />
                            Trabajadores
                        </h1>
                        <p className="text-gray-500 mt-1 text-sm sm:text-base">Gestiona el directorio de empleados registrados.</p>
                    </div>
                    <div className="relative w-full sm:w-80">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <label htmlFor="worker-search" className="sr-only">Buscar trabajador</label>
                        <input
                            id="worker-search"
                            type="text" placeholder="Buscar por nombre o DUI..."
                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white shadow-sm"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary-500" />
                            <p>Cargando directorio...</p>
                        </div>
                    ) : filteredWorkers.length > 0 ? (<>

                        {/* ── Mobile list ── */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {filteredWorkers.map((worker) => (
                                <div key={worker.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                                        {worker.profile_picture_url
                                            ? <img src={worker.profile_picture_url} alt={`${worker.first_name} ${worker.last_name}`} className="w-full h-full object-cover" />
                                            : <svg className="w-5 h-5 text-gray-300 mt-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900 text-sm truncate">{worker.first_name} {worker.last_name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{worker.dui_number} · +503 {worker.phone_number}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Link to={`/workers/${worker.id}`} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                                            <ChevronRight className="w-4 h-4" />
                                        </Link>
                                        <button onClick={() => openEdit(worker)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => setWorkerToDelete(worker)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Desktop table ── */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        <th className="px-6 py-4">Nombre Completo</th>
                                        <th className="px-6 py-4">DUI</th>
                                        <th className="px-6 py-4">Teléfono</th>
                                        <th className="px-6 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredWorkers.map((worker) => (
                                        <tr key={worker.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-6 py-4 font-medium text-gray-900">{worker.first_name} {worker.last_name}</td>
                                            <td className="px-6 py-4 text-gray-500 text-sm">{worker.dui_number}</td>
                                            <td className="px-6 py-4 text-gray-500 text-sm">+503 {worker.phone_number}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link to={`/workers/${worker.id}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">
                                                        Perfil
                                                    </Link>
                                                    <button onClick={() => openEdit(worker)} className="p-1.5 rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors" title="Editar">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => setWorkerToDelete(worker)} className="p-1.5 rounded-lg text-gray-500 bg-gray-100 hover:bg-red-100 hover:text-red-600 transition-colors" title="Eliminar">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>) : (
                        <div className="text-center py-20 text-gray-500">
                            <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                            <p className="text-lg font-medium text-gray-900 mb-1">No hay trabajadores encontrados</p>
                            <p className="text-sm">No hay registros que coincidan con tu búsqueda.</p>
                        </div>
                    )}
                </div>

                {/* ── Edit Modal ── */}
                {editWorker && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-sm">
                        <m.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
                        >
                            {/* Modal header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                                <h2 className="text-base font-bold text-gray-900">Editar trabajador</h2>
                                <button onClick={() => setEditWorker(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal body */}
                            <div className="overflow-y-auto p-6 space-y-4 flex-1">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="first_name" className="text-xs font-semibold text-gray-500 mb-1 block">Nombre</label>
                                        <input id="first_name" {...field('first_name')} className={inputCls} placeholder="Nombre" />
                                    </div>
                                    <div>
                                        <label htmlFor="last_name" className="text-xs font-semibold text-gray-500 mb-1 block">Apellido</label>
                                        <input id="last_name" {...field('last_name')} className={inputCls} placeholder="Apellido" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="dui" className="text-xs font-semibold text-gray-500 mb-1 block">DUI</label>
                                        <input id="dui" {...field('dui_number')} className={inputCls} placeholder="00000000-0" />
                                    </div>
                                    <div>
                                        <label htmlFor="phone" className="text-xs font-semibold text-gray-500 mb-1 block">Teléfono</label>
                                        <input id="phone" {...field('phone_number')} className={inputCls} placeholder="7000-0000" />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="address" className="text-xs font-semibold text-gray-500 mb-1 block">Dirección</label>
                                    <input id="address" {...field('current_address')} className={inputCls} placeholder="Dirección actual" />
                                </div>
                                <div className="pt-1 border-t border-gray-100">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contacto de emergencia</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label htmlFor="emergency_name" className="text-xs font-semibold text-gray-500 mb-1 block">Nombre</label>
                                            <input id="emergency_name" {...field('emergency_contact_name')} className={inputCls} placeholder="Nombre" />
                                        </div>
                                        <div>
                                            <label htmlFor="emergency_phone" className="text-xs font-semibold text-gray-500 mb-1 block">Teléfono</label>
                                            <input id="emergency_phone" {...field('emergency_contact_phone')} className={inputCls} placeholder="7000-0000" />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="allergies" className="text-xs font-semibold text-gray-500 mb-1 block">Alergias / Comentarios médicos</label>
                                    <textarea id="allergies" {...field('allergies_comments')} rows={2} className={`${inputCls} resize-none`} placeholder="Ninguna" />
                                </div>
                            </div>

                            {/* Modal footer */}
                            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
                                <button onClick={() => setEditWorker(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition">
                                    Cancelar
                                </button>
                                <button onClick={saveEdit} disabled={isSaving} className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-black transition disabled:opacity-60 flex items-center justify-center gap-2">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Guardar
                                </button>
                            </div>
                        </m.div>
                    </div>
                )}

                {/* ── Delete Confirmation Modal ── */}
                {workerToDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                        <m.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-6 text-center">
                                <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
                                    <AlertTriangle className="w-6 h-6 text-red-500" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">¿Eliminar trabajador?</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    Vas a eliminar a <strong>{workerToDelete.first_name} {workerToDelete.last_name}</strong>. Esta acción no se puede deshacer.
                                </p>
                                <div className="flex gap-3">
                                    <button onClick={() => setWorkerToDelete(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition">
                                        Cancelar
                                    </button>
                                    <button onClick={deleteWorker} disabled={isDeleting} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
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
