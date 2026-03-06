import { m, LazyMotion, domAnimation } from 'framer-motion';
import { Receipt, X, CheckCircle2, XCircle, Download } from 'lucide-react';
import { parseISO } from 'date-fns';

/**
 * @fileoverview BoletaModal.jsx - Previsualización de Boleta de Pago.
 * Este componente muestra un desglose detallado del pago de un colaborador,
 * incluyendo asistencia y ausencias, permitiendo su descarga como imagen.
 */

/**
 * Componente BoletaModal
 * Renderiza un modal con el recibo de pago generado para un trabajador.
 * Calcula las ausencias dentro del periodo de planilla para mostrarlas en el desglose.
 * 
 * @param {Object} props - Propiedades del componente.
 * @param {boolean} props.isOpen - Define si el modal es visible.
 * @param {Function} props.onClose - Función para cerrar el modal.
 * @param {Object} props.entry - Registro de planilla del trabajador.
 * @param {Object} props.selectedPayroll - Datos de la planilla actual (fechas, nombre).
 * @param {Array} props.payrollLeaves - Lista de permisos/ausencias registradas.
 * @param {Function} props.onDownload - Función para disparar la descarga de la boleta.
 * @returns {JSX.Element|null} El modal de la boleta o null si no está abierto.
 */
export default function BoletaModal({
    isOpen,
    onClose,
    entry,
    selectedPayroll,
    payrollLeaves,
    onDownload
}) {
    if (!isOpen || !entry) return null;

    const worker = entry.workers;
    const totalWorked = (Array.isArray(entry.days_attended) ? entry.days_attended : []).filter(Boolean).length;

    const payrollStart = parseISO(selectedPayroll.start_date);
    const payrollEnd = parseISO(selectedPayroll.endStr);

    // Filtra permisos que caen dentro del rango de fechas de esta planilla
    const validLeaves = payrollLeaves.filter(l => {
        if (l.worker_id !== worker.id) return false;
        const leaveStart = parseISO(l.start_date);
        const leaveEnd = parseISO(l.end_date);
        return leaveStart <= payrollEnd && leaveEnd >= payrollStart;
    });

    /**
     * Calcula los días solapados entre un permiso y el periodo de planilla.
     */
    const getOverlappingDays = (lStart, lEnd, pStart, pEnd) => {
        const start = lStart > pStart ? lStart : pStart;
        const end = lEnd < pEnd ? lEnd : pEnd;
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return end >= start ? diffDays : 0;
    };

    const processedPaidLeaves = validLeaves.filter(l => l.is_paid).map(l => {
        const overlapping = getOverlappingDays(parseISO(l.start_date), parseISO(l.end_date), payrollStart, payrollEnd);
        return { ...l, computedDays: overlapping };
    }).filter(l => l.computedDays > 0);

    const processedUnpaidLeaves = validLeaves.filter(l => !l.is_paid).map(l => {
        const overlapping = getOverlappingDays(parseISO(l.start_date), parseISO(l.end_date), payrollStart, payrollEnd);
        return { ...l, computedDays: overlapping };
    }).filter(l => l.computedDays > 0);

    const totalPaidLeaveDays = processedPaidLeaves.reduce((sum, l) => sum + l.computedDays, 0);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <LazyMotion features={domAnimation}>
                <m.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
                >
                    <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
                            Boleta de Pago
                        </h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm border border-gray-200">
                            <X className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                    </div>

                    <div className="p-6">
                        <div id="boleta-receipt" className="bg-white p-2">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900 tracking-tight leading-none mb-1">{worker?.first_name} {worker?.last_name}</h2>
                                <p className="text-sm text-gray-500 font-medium">{selectedPayroll?.project_name || 'Sin Proyecto Asignado'}</p>
                            </div>

                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-center">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Entregado</p>
                                <div className="text-3xl font-black text-gray-900 tracking-tighter">
                                    <span className="text-xl text-gray-400 mr-1">$</span>
                                    {parseFloat(entry.total_net).toFixed(2)}
                                </div>
                            </div>

                            <div className="space-y-0">
                                <div className="border border-gray-100 bg-white rounded-xl p-4 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium">Planilla</span>
                                        <span className="font-bold text-gray-900 text-right truncate pl-4 max-w-[200px]" title={selectedPayroll?.name}>{selectedPayroll?.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium">DUI</span>
                                        <span className="font-bold text-gray-900">{worker?.dui_number}</span>
                                    </div>
                                    <div className="h-px w-full border-t border-dashed border-gray-200"></div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium">Días Asistidos</span>
                                        <span className="font-bold text-gray-700 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">{totalWorked} días</span>
                                    </div>
                                    {(processedPaidLeaves.length > 0 || processedUnpaidLeaves.length > 0) && (
                                        <>
                                            <div className="h-px w-full border-t border-dashed border-gray-200"></div>
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Historial de Ausencias</p>

                                                {processedPaidLeaves.map(leave => (
                                                    <div key={leave.id} className="flex justify-between items-start text-sm">
                                                        <div className="flex items-start gap-1.5 flex-1 pr-2">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                                            <div className="flex flex-col">
                                                                <span className="text-gray-900 font-medium">Con goce de sueldo</span>
                                                                {leave.reason && <span className="text-xs text-gray-500">{leave.reason}</span>}
                                                            </div>
                                                        </div>
                                                        <span className="font-bold text-gray-700 font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100 shrink-0">
                                                            {leave.computedDays} d
                                                        </span>
                                                    </div>
                                                ))}

                                                {processedUnpaidLeaves.map(leave => (
                                                    <div key={leave.id} className="flex justify-between items-start text-sm">
                                                        <div className="flex items-start gap-1.5 flex-1 pr-2">
                                                            <XCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                                                            <div className="flex flex-col">
                                                                <span className="text-gray-900 font-medium">Sin goce de sueldo</span>
                                                                {leave.reason && <span className="text-xs text-gray-500">{leave.reason}</span>}
                                                            </div>
                                                        </div>
                                                        <span className="font-bold text-gray-500 font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100 shrink-0">
                                                            {leave.computedDays} d
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="mt-3 bg-white border border-gray-100 text-gray-900 rounded-xl p-4 flex justify-between items-center shadow-sm">
                                    <span className="text-sm font-bold text-gray-500">Total días pagados</span>
                                    <span className="font-black text-lg">{totalWorked + totalPaidLeaveDays} días</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3">
                            <button onClick={onDownload} className="w-full flex justify-center items-center gap-2 py-3 bg-gray-50 text-gray-900 font-bold border border-gray-200 rounded-xl hover:bg-gray-100 transition-all active:scale-[0.98]">
                                <Download className="w-4 h-4" strokeWidth={2.5} /> Descargar Boleta
                            </button>
                            <button onClick={onClose} className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl shadow-md hover:bg-black transition-all active:scale-[0.98]">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </m.div>
            </LazyMotion>
        </div>
    );
}
