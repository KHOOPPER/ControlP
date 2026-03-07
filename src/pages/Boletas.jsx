import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import { Search, Receipt, Calendar as CalendarIcon, X, Download, Trash2, AlertCircle, Loader2, ChevronLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { clsx } from 'clsx';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import BoletaItem from '../components/BoletaItem';
import BoletaModal from '../components/BoletaModal';

/**
 * @fileoverview Boletas.jsx - Gestión de Pagos y Boletas.
 * Este componente permite visualizar las planillas cerradas, gestionar los pagos
 * individuales de los trabajadores y generar boletas de pago en formato de imagen (recibos).
 */

/**
 * Componente Boletas
 * Interfaz principal para la administración de recibos de pago.
 * Filtra planillas cerradas y permite la edición de montos netos finales.
 * 
 * @returns {JSX.Element} La vista de gestión de boletas.
 */
export default function Boletas() {
    /** Listado de planillas con estatus cerrado. */
    const [payrolls, setPayrolls] = useState([]);
    /** Estado de carga de la lista de planillas. */
    const [loading, setLoading] = useState(true);
    /** Término de búsqueda para filtrar planillas. */
    const [searchTerm, setSearchTerm] = useState('');
    /** Vista actual: 'list' (planillas) o 'detail' (trabajadores de una planilla). */
    const [view, setView] = useState('list');
    /** Planilla seleccionada para ver sus boletas. */
    const [selectedPayroll, setSelectedPayroll] = useState(null);
    /** Entradas de trabajadores asociadas a la planilla seleccionada. */
    const [payrollEntries, setPayrollEntries] = useState([]);
    /** Permisos/Ausencias registradas para los trabajadores de la planilla. */
    const [payrollLeaves, setPayrollLeaves] = useState([]);
    /** Estado de carga de las entradas de la planilla. */
    const [loadingEntries, setLoadingEntries] = useState(false);
    /** Valores temporales de los inputs de pago. */
    const [paymentInputs, setPaymentInputs] = useState({});
    /** Control de cuáles filas están en modo edición de monto. */
    const [editingPayments, setEditingPayments] = useState({});
    /** Estado del modal de previsualización de boleta. */
    const [isBoletaModalOpen, setIsBoletaModalOpen] = useState(false);
    /** ID de la entrada seleccionada para mostrar en el modal. */
    const [selectedBoletaEntryId, setSelectedBoletaEntryId] = useState(null);
    /** Entrada pendiente de eliminación de la planilla. */
    const [entryToDelete, setEntryToDelete] = useState(null);
    /** Estado de carga durante la eliminación de una entrada. */
    const [isDeletingEntry, setIsDeletingEntry] = useState(false);
    /** Modo de pago actual: 'personal' (individual) o 'general' (masivo). */
    const [paymentMode, setPaymentMode] = useState('personal');
    /** Estado de carga del guardado masivo. */
    const [isSavingAll, setIsSavingAll] = useState(false);

    useEffect(() => {
        fetchClosedPayrolls();
    }, []);

    /**
     * Obtiene de Supabase las planillas que han finalizado su periodo.
     */
    const fetchClosedPayrolls = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('payrolls')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const processedPayrolls = data.map(p => {
                const endStr = getDayDateString(p.created_at, (p.total_days || 14) - 1, p.start_date);
                const d = new Date();
                const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const isExpired = today > endStr;
                const isClosed = p.status === 'cerrada' || isExpired;
                return { ...p, computed_is_closed: isClosed, endStr };
            });

            setPayrolls(processedPayrolls.filter(p => p.computed_is_closed));
        } catch (error) {
            console.error('Error fetching payrolls:', error);
            toast.error('Error al cargar planillas cerradas');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Calcula una fecha absoluta basada en el inicio de la planilla y un índice de día.
     * 
     * @param {string} created_at - Timestamp de creación.
     * @param {number} dayIndex - Índice del día (0-14 generalmente).
     * @param {string} start_date - Fecha de inicio manual.
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

    /**
     * Carga trabajadores y sus ausencias para una planilla específica.
     * 
     * @param {Object} payroll - El objeto de la planilla seleccionada.
     */
    const fetchPayrollDetails = async (payroll) => {
        setLoadingEntries(true);
        try {
            const { data, error } = await supabase
                .from('payroll_entries')
                .select('*, workers(id, first_name, last_name, dui_number, profile_picture_url)')
                .eq('payroll_id', payroll.id);

            if (error) throw error;

            const { data: leavesData } = await supabase
                .from('leaves')
                .select('*')
                .in('worker_id', (data || []).map(e => e.worker_id));

            setPayrollLeaves(leavesData || []);

            const normalized = (data || []).map(e => ({
                ...e,
                days_attended: Array.isArray(e.days_attended) ? e.days_attended : []
            }));
            setPayrollEntries(normalized);
        } catch (error) {
            console.error('Error fetching payroll entries:', error);
            toast.error('Error al cargar el detalle de la planilla');
        } finally {
            setLoadingEntries(false);
        }
    };

    /**
     * Cambia la vista al detalle de una planilla.
     */
    const handleSelectPayroll = (payroll) => {
        setSelectedPayroll(payroll);
        setView('detail');
        setPaymentMode('personal');
        setPaymentInputs({});
        setEditingPayments({});
        fetchPayrollDetails(payroll);
    };

    /** Maneja cambios en los inputs de pago neto. */
    const handlePaymentInputChange = (entryId, value) => {
        setPaymentInputs(prev => ({ ...prev, [entryId]: value }));
    };

    /**
     * Persiste el monto pagado a un trabajador en la base de datos.
     * 
     * @param {string} entryId - ID de la entrada en payroll_entries.
     * @param {string|number} amount - Monto neto a guardar.
     */
    const savePayment = async (entryId, amount) => {
        if (!amount || isNaN(amount) || amount <= 0) {
            toast.error('Ingrese un monto válido mayor a 0');
            return;
        }

        try {
            const numAmount = parseFloat(amount);
            const { error } = await supabase
                .from('payroll_entries')
                .update({ total_net: numAmount })
                .eq('id', entryId);

            if (error) throw error;

            toast.success('Pago registrado exitosamente', { icon: '💰' });

            setPayrollEntries(prev => prev.map(entry =>
                entry.id === entryId ? { ...entry, total_net: numAmount } : entry
            ));

            setPaymentInputs(prev => {
                const updated = { ...prev };
                delete updated[entryId];
                return updated;
            });
            setEditingPayments(prev => {
                const updated = { ...prev };
                delete updated[entryId];
                return updated;
            });
        } catch (error) {
            console.error('Error saving payment:', error);
            toast.error('Error al registrar el pago');
        }
    };

    /**
     * Guarda masivamente todos los pagos introducidos en la vista General.
     */
    const saveAllPayments = async () => {
        setIsSavingAll(true);
        const loadingToast = toast.loading('Guardando pagos masivamente...');
        try {
            const updates = [];
            const validEntries = [];

            // Recopilar todas las entradas que tienen un monto válido
            for (const [entryId, amount] of Object.entries(paymentInputs)) {
                if (amount && !isNaN(amount) && amount > 0) {
                    updates.push({ id: entryId, total_net: parseFloat(amount) });
                    validEntries.push(entryId);
                }
            }

            if (updates.length === 0) {
                toast.dismiss(loadingToast);
                toast.error('No hay montos válidos para guardar');
                setIsSavingAll(false);
                return;
            }

            // Realizar las actualizaciones individuales concurrentemente (Supabase no soporta upsert parcial directo fácilmente sin el row entero)
            const updatePromises = updates.map(update =>
                supabase.from('payroll_entries').update({ total_net: update.total_net }).eq('id', update.id)
            );

            await Promise.all(updatePromises);

            toast.success(`${updates.length} pagos registrados exitosamente`, { id: loadingToast, icon: '💰' });

            // Actualizar estado local
            setPayrollEntries(prev => prev.map(entry => {
                const update = updates.find(u => u.id === entry.id);
                return update ? { ...entry, total_net: update.total_net } : entry;
            }));

            // Limpiar inputs exitosos
            setPaymentInputs(prev => {
                const updated = { ...prev };
                validEntries.forEach(id => delete updated[id]);
                return updated;
            });

        } catch (error) {
            console.error('Error saving all payments:', error);
            toast.error('Error al registrar los pagos masivos', { id: loadingToast });
        } finally {
            setIsSavingAll(false);
        }
    };

    /**
     * Genera un reporte PDF en blanco y negro con la lista de pagos de la planilla actual.
     */
    const generatePDFReport = () => {
        if (!selectedPayroll) return;

        try {
            const doc = new jsPDF();

            // Cargar configuración de la empresa
            let companySettings = { companyName: 'PLANILLA GENERAL DE PAGOS', logoDataUrl: null };
            try {
                const s = JSON.parse(localStorage.getItem('controlp_settings'));
                if (s) {
                    if (s.companyName) companySettings.companyName = s.companyName;
                    if (s.logoDataUrl) companySettings.logoDataUrl = s.logoDataUrl;
                }
            } catch (e) {
                console.warn('Error cargando configuración de la empresa para el PDF', e);
            }

            // --- HEADER ESTILO CORPORATIVO ---

            let startY = 15;

            if (companySettings.logoDataUrl) {
                // Si hay logo asume que es la imagen cargada por el usuario
                try {
                    // Obtener propiedades de la imagen para respetar el aspect ratio
                    const imgProps = doc.getImageProperties(companySettings.logoDataUrl);
                    const targetHeight = 16;
                    const calculatedWidth = (imgProps.width * targetHeight) / imgProps.height;
                    const finalWidth = Math.min(calculatedWidth, 50); // ancho máximo de 50 para no encimar texto

                    doc.addImage(companySettings.logoDataUrl, 'JPEG', 14, startY, finalWidth, targetHeight, '', 'FAST');

                    const textXPos = 14 + finalWidth + 4;
                    doc.setFontSize(16);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text(companySettings.companyName.toUpperCase(), textXPos, startY + 10);
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'normal');
                    doc.text('Planilla General de Pagos', textXPos, startY + 16);
                } catch (e) {
                    // Fallback si la imagen es inválida
                    doc.setFontSize(18);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text(companySettings.companyName.toUpperCase(), 14, startY + 8);
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'normal');
                    doc.text('Planilla General de Pagos', 14, startY + 14);
                }
            } else {
                // "Logo" - Caja negra con texto blanco (Fallback original)
                doc.setFillColor(0, 0, 0);
                doc.rect(14, startY, 40, 12, 'F');
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);

                // Mostrar un fragmento del nombre si es muy largo, o "ControlP"
                const dispName = companySettings.companyName !== 'PLANILLA GENERAL DE PAGOS' ? companySettings.companyName : 'ControlP';
                doc.text(dispName.substring(0, 15), 16, startY + 8);

                // Título Documento
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(16);
                doc.text('PLANILLA GENERAL DE PAGOS', 60, startY + 8);
            }

            // Línea separadora superior
            doc.setLineWidth(0.5);
            doc.line(14, 42, 196, 42);

            // --- INFORMACIÓN DE LA PLANILLA ---

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            // Columna Izquierda: Datos de la Planilla
            doc.setFont('helvetica', 'bold');
            doc.text('Nombre de Planilla:', 14, 50);
            doc.text('Proyecto:', 14, 56);

            doc.setFont('helvetica', 'normal');
            doc.text(`${selectedPayroll.name}`, 50, 50);
            doc.text(`${selectedPayroll.project_name || 'Sin proyecto asignado'}`, 50, 56);

            // Columna Derecha: Fecha
            doc.setFont('helvetica', 'bold');
            doc.text('Periodo:', 130, 50);

            doc.setFont('helvetica', 'normal');
            const baseStart = selectedPayroll.start_date || selectedPayroll.created_at;
            const startDateTxt = baseStart ? format(parseISO(baseStart.substring(0, 10)), 'dd MMM yyyy', { locale: es }) : '-';

            const baseEnd = selectedPayroll.end_date || selectedPayroll.endStr;
            const endDateTxt = baseEnd ? format(parseISO(baseEnd.substring(0, 10)), 'dd MMM yyyy', { locale: es }) : '-';

            doc.text(`Del ${startDateTxt} al ${endDateTxt}`, 148, 50);

            // Línea separadora inferior
            doc.setLineWidth(0.2);
            doc.line(14, 62, 196, 62);

            // --- TABLA DE PAGOS ---

            let totalAmount = 0;
            const tableData = payrollEntries.map((entry, index) => {
                const workerName = `${entry.workers?.first_name} ${entry.workers?.last_name}`;
                const dui = entry.workers?.dui_number || 'N/A';
                const amount = entry.total_net || 0;
                totalAmount += amount;

                // Buscar incapacidades / permisos
                const workerLeaves = payrollLeaves.filter(l => l.worker_id === entry.worker_id);
                const leavesText = workerLeaves.length > 0 ? `${workerLeaves.length} rep.` : '-';

                return [
                    index + 1,
                    workerName,
                    dui,
                    leavesText,
                    amount > 0 ? `$${amount.toFixed(2)}` : '-'
                ];
            });

            // Añadir fila de totales
            tableData.push([
                { content: 'TOTAL:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `$${totalAmount.toFixed(2)}`, styles: { fontStyle: 'bold' } }
            ]);

            autoTable(doc, {
                startY: 70, // Espacio ampliado (antes era 63 o 67)
                head: [['Nº', 'Trabajador', 'DUI', 'Observaciones', 'Monto Pagado']],
                body: tableData,
                theme: 'grid', // Tema con bordes completos
                styles: {
                    font: 'helvetica',
                    fontSize: 9,
                    textColor: [0, 0, 0], // Negro puro
                    lineColor: [0, 0, 0], // Bordes negros
                    lineWidth: 0.1,
                },
                headStyles: {
                    fillColor: [240, 240, 240], // Fondo gris muy claro para el encabezado
                    textColor: [0, 0, 0], // Texto negro
                    fontStyle: 'bold',
                    lineWidth: 0.2, // Bordes sutilmente más gruesos
                    halign: 'center'
                },
                alternateRowStyles: {
                    fillColor: [255, 255, 255] // Fondo blanco para filas alternas, sin sombreado
                },
                columnStyles: {
                    0: { cellWidth: 12, halign: 'center' }, // Nº
                    1: { cellWidth: 70 }, // Trabajador
                    2: { cellWidth: 35, halign: 'center' }, // DUI
                    3: { cellWidth: 35, halign: 'center' }, // Observaciones (Incapacidades)
                    4: { cellWidth: 30, halign: 'right' } // Monto
                }
            });

            // Descargar el PDF con el nombre de la planilla
            const safeName = selectedPayroll.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            doc.save(`Planilla_${safeName}.pdf`);
            toast.success('Reporte PDF generado exitosamente');

        } catch (error) {
            console.error('Error generando PDF:', error);
            toast.error('Error al generar el reporte PDF');
        }
    };

    /** Abre el modal de la boleta visual. */
    const openBoleta = (entryId) => {
        setSelectedBoletaEntryId(entryId);
        setIsBoletaModalOpen(true);
    };

    /** Activa el modo edición para un pago ya registrado. */
    const handleEditPayment = (entryId, currentAmount) => {
        setEditingPayments(prev => ({ ...prev, [entryId]: true }));
        setPaymentInputs(prev => ({ ...prev, [entryId]: currentAmount }));
    };

    /**
     * Elimina a un trabajador de la lista de pagos de esta planilla.
     */
    const handleDeleteEntry = async () => {
        if (!entryToDelete) return;
        setIsDeletingEntry(true);
        const loadingToast = toast.loading('Eliminando trabajador de la boleta...');
        try {
            const { error } = await supabase
                .from('payroll_entries')
                .delete()
                .eq('id', entryToDelete.id);

            if (error) throw error;
            toast.success('Trabajador eliminado de la boleta', { id: loadingToast });
            setPayrollEntries(prev => prev.filter(e => e.id !== entryToDelete.id));
            setEntryToDelete(null);
        } catch (error) {
            console.error('Error deleting entry:', error);
            toast.error('Error al eliminar el trabajador', { id: loadingToast });
        } finally {
            setIsDeletingEntry(false);
        }
    };

    /**
     * Captura el DOM de la boleta y lo descarga como imagen PNG.
     */
    const downloadBoletaImage = async () => {
        const boletaElement = document.getElementById('boleta-receipt');
        if (!boletaElement) return;

        try {
            const dataUrl = await htmlToImage.toPng(boletaElement, {
                quality: 1.0, pixelRatio: 2, backgroundColor: '#ffffff'
            });

            const link = document.createElement('a');
            const entry = payrollEntries.find(e => e.id === selectedBoletaEntryId);
            const workerName = entry?.workers ? `${entry.workers.first_name}_${entry.workers.last_name}` : 'trabajador';
            const payrollName = selectedPayroll?.name ? selectedPayroll.name.replace(/\s+/g, '_') : 'planilla';

            link.download = `boleta_${workerName}_${payrollName}.png`;
            link.href = dataUrl;
            link.click();
            toast.success('Boleta guardada como imagen');
        } catch (error) {
            console.error('Error al generar la imagen:', error);
            toast.error('Error al generar la imagen de la boleta');
        }
    };

    /** Filtro de búsqueda local para planillas cerradas. */
    const filteredPayrolls = payrolls.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.project_name && p.project_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        {view === 'detail' && (
                            <button
                                onClick={() => { setView('list'); setSelectedPayroll(null); }}
                                className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-500 hover:text-gray-900"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                            {view === 'list' ? 'Boletas de Pagos' : `Boletas de ${selectedPayroll?.name}`}
                        </h1>
                    </div>
                    <p className={clsx('text-gray-500 transition-all duration-300', view === 'detail' ? 'ml-11' : 'ml-0')}>
                        {view === 'list'
                            ? 'Genera recibos de pago para planillas cerradas'
                            : 'Registra pagos y genera comprobantes por trabajador'}
                    </p>
                </div>

                {view === 'detail' && payrollEntries.length > 0 && (
                    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner self-end sm:self-auto">
                        <button
                            onClick={() => setPaymentMode('personal')}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                paymentMode === 'personal' ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            Personal
                        </button>
                        <button
                            onClick={() => setPaymentMode('general')}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                paymentMode === 'general' ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            General
                        </button>
                    </div>
                )}
            </div>

            {view === 'list' ? (
                <>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <label htmlFor="payroll-search" className="sr-only">Buscar planilla</label>
                        <input
                            id="payroll-search"
                            type="text"
                            placeholder="Buscar planilla por nombre o proyecto..."
                            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(n => (
                                <div key={n} className="h-32 bg-gray-100 animate-pulse rounded-2xl"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPayrolls.map(payroll => (
                                <div
                                    key={payroll.id}
                                    onClick={() => handleSelectPayroll(payroll)}
                                    className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition cursor-pointer group"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-900 border border-gray-100 group-hover:scale-105 transition">
                                            <Receipt className="w-5 h-5" />
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 border border-transparent">
                                            Cerrada
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-lg mb-1">{payroll.name}</h3>
                                    <p className="text-sm font-medium text-gray-500 truncate mb-4">
                                        {payroll.project_name || 'Sin proyecto'}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                                        <CalendarIcon className="w-4 h-4" />
                                        <span>Vigencia hasta el {format(parseISO(payroll.endStr), 'dd MMM yyyy', { locale: es })}</span>
                                    </div>
                                </div>
                            ))}
                            {filteredPayrolls.length === 0 && (
                                <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                                    <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">No hay planillas cerradas disponibles.</p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6">
                    {loadingEntries ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent"></div>
                        </div>
                    ) : (
                        paymentMode === 'personal' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {payrollEntries.map(entry => (
                                    <BoletaItem
                                        key={entry.id}
                                        entry={entry}
                                        onDelete={setEntryToDelete}
                                        onSavePayment={savePayment}
                                        onEditPayment={handleEditPayment}
                                        onOpenBoleta={openBoleta}
                                        paymentInput={paymentInputs[entry.id]}
                                        onInputChange={handlePaymentInputChange}
                                        isEditing={editingPayments[entry.id]}
                                    />
                                ))}

                                {payrollEntries.length === 0 && (
                                    <div className="col-span-full text-center py-10 opacity-50">
                                        <p>No hay trabajadores en esta planilla.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="w-full">
                                    {/* Cabecera (solo visible en escritorio) */}
                                    <div className="hidden border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider md:grid md:grid-cols-[2fr_1fr_1fr_1.5fr] gap-4 px-4 py-3 bg-gray-50 rounded-t-xl">
                                        <div>Trabajador</div>
                                        <div>DUI</div>
                                        <div className="text-right">Monto Actual</div>
                                        <div className="">Nuevo Monto ($)</div>
                                    </div>

                                    {/* Lista de trabajadores */}
                                    <div className="divide-y divide-gray-100 border border-gray-100 rounded-b-xl md:border-t-0 md:rounded-tl-none md:rounded-tr-none bg-white">
                                        {payrollEntries.map(entry => (
                                            <div key={entry.id} className="p-4 md:p-0 hover:bg-gray-50/50 transition-colors md:grid md:grid-cols-[2fr_1fr_1fr_1.5fr] gap-4 md:items-center">

                                                {/* Trabajador */}
                                                <div className="flex items-center gap-3 md:px-4 md:py-3 mb-3 md:mb-0">
                                                    <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                                                        {entry.workers?.profile_picture_url ? (
                                                            <img src={entry.workers.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-400 mt-1" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-gray-900 text-sm block">
                                                            {entry.workers?.first_name} {entry.workers?.last_name}
                                                        </span>
                                                        <span className="text-xs text-gray-500 font-mono md:hidden block mt-0.5">
                                                            {entry.workers?.dui_number}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* DUI (Escritorio) */}
                                                <div className="hidden md:block px-4 py-3 text-sm text-gray-500 font-mono">
                                                    {entry.workers?.dui_number}
                                                </div>

                                                {/* Monto Actual */}
                                                <div className="flex justify-between md:justify-end items-center md:px-4 md:py-3 mb-3 md:mb-0">
                                                    <span className="text-xs font-bold text-gray-500 uppercase md:hidden">Monto Actual:</span>
                                                    {entry.total_net ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 font-semibold text-sm border border-green-200">
                                                            ${entry.total_net.toFixed(2)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">Sin pago</span>
                                                    )}
                                                </div>

                                                {/* Input Nuevo Monto */}
                                                <div className="md:px-4 md:py-3 relative">
                                                    <span className="absolute left-3 md:left-7 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={paymentInputs[entry.id] || ''}
                                                        onChange={(e) => handlePaymentInputChange(entry.id, e.target.value)}
                                                        placeholder={entry.total_net ? entry.total_net.toFixed(2) : '0.00'}
                                                        className="w-full pl-7 pr-3 py-2 md:py-1.5 border border-gray-300 rounded-lg md:rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-gray-50"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        {payrollEntries.length === 0 && (
                                            <div className="text-center py-10 opacity-50">
                                                No hay trabajadores en esta planilla.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {payrollEntries.length > 0 && (
                                    <div className="mt-6 flex flex-col sm:flex-row justify-end items-center gap-3 pt-4 border-t border-gray-100">
                                        <button
                                            onClick={generatePDFReport}
                                            className="w-full sm:w-auto px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition shadow-sm"
                                        >
                                            <Download className="w-5 h-5" />
                                            Imprimir
                                        </button>
                                        <button
                                            onClick={saveAllPayments}
                                            disabled={isSavingAll || Object.keys(paymentInputs).length === 0}
                                            className="w-full sm:w-auto px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                                        >
                                            {isSavingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                            Guardar
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </div>
            )}

            <BoletaModal
                isOpen={isBoletaModalOpen}
                onClose={() => setIsBoletaModalOpen(false)}
                entry={payrollEntries.find(e => e.id === selectedBoletaEntryId)}
                selectedPayroll={selectedPayroll}
                payrollLeaves={payrollLeaves}
                onDownload={downloadBoletaImage}
            />

            {entryToDelete && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <LazyMotion features={domAnimation}>
                        <m.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-8 text-center">
                                <div className="mx-auto w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                                    <AlertCircle className="w-7 h-7 text-red-500" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2">¿Quitar trabajador?</h3>
                                <p className="text-sm text-gray-500 font-medium mb-8">
                                    Quitarás a <strong>{entryToDelete.workers?.first_name} {entryToDelete.workers?.last_name}</strong> de esta boleta de pago.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setEntryToDelete(null)}
                                        className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition active:scale-[0.98]"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleDeleteEntry}
                                        disabled={isDeletingEntry}
                                        className="flex-1 py-3 px-4 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-red-200"
                                    >
                                        {isDeletingEntry ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        </m.div>
                    </LazyMotion>
                </div>
            )}
        </div>
    );
}
