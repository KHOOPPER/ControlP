import { Trash2, Edit2 } from 'lucide-react';

/**
 * @fileoverview BoletaItem.jsx - Registro Individual de Boleta.
 * Este componente representa una fila/tarjeta de un colaborador dentro de la lista
 * de generación de boletas, permitiendo ingresar montos, editar pagos y abrir previsualizaciones.
 */

/**
 * Componente BoletaItem
 * Maneja la visualización y edición del pago neto de un trabajador para un periodo específico.
 * 
 * @param {Object} props - Propiedades del componente.
 * @param {Object} props.entry - Datos de la entrada de planilla (incluye trabajador y asistencia).
 * @param {Function} props.onDelete - Función para remover al trabajador de la lista actual.
 * @param {Function} props.onSavePayment - Función para persistir el monto ingresado.
 * @param {Function} props.onEditPayment - Función para habilitar la edición de un monto ya guardado.
 * @param {Function} props.onOpenBoleta - Función para abrir el modal de previsualización de boleta.
 * @param {string|number} props.paymentInput - Valor actual en el campo de entrada de pago.
 * @param {Function} props.onInputChange - Función para manejar el cambio en el input de pago.
 * @param {boolean} props.isEditing - Indica si el registro está en modo edición.
 * @returns {JSX.Element} La tarjeta de registro del colaborador.
 */
export default function BoletaItem({
    entry,
    onDelete,
    onSavePayment,
    onEditPayment,
    onOpenBoleta,
    paymentInput,
    onInputChange,
    isEditing
}) {
    const totalWorked = (Array.isArray(entry.days_attended) ? entry.days_attended : []).filter(Boolean).length;
    const hasPayment = entry.total_net !== null && entry.total_net !== undefined && entry.total_net !== 0 && !isEditing;

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {entry.workers?.profile_picture_url ? (
                        <img
                            src={entry.workers.profile_picture_url}
                            alt={`${entry.workers.first_name} ${entry.workers.last_name}`}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-xs font-bold text-gray-400">
                            {entry.workers?.first_name?.[0]}{entry.workers?.last_name?.[0]}
                        </span>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 text-sm truncate" title={`${entry.workers?.first_name} ${entry.workers?.last_name}`}>
                        {entry.workers?.first_name} {entry.workers?.last_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 whitespace-nowrap overflow-x-auto no-scrollbar mask-gradient">
                        <span className="text-[10px] font-medium text-gray-500 shrink-0">{entry.workers?.dui_number}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 shrink-0" title="Días Asistidos">
                            {totalWorked}d asis.
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => onDelete(entry)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition shrink-0"
                    title="Quitar de esta planilla"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
            <div className="flex flex-col gap-3">
                {!hasPayment ? (
                    <div className="flex gap-2">
                        <div className="relative flex-1 min-w-0">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 bg-gray-50 text-gray-900"
                                value={paymentInput || ''}
                                onChange={(e) => onInputChange(entry.id, e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => onSavePayment(entry.id, paymentInput)}
                            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition shadow-sm active:scale-95 shrink-0"
                        >
                            Guardar
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2 items-center">
                        <div className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between min-w-0">
                            <span className="text-[11px] font-bold text-gray-500 uppercase shrink-0">Total</span>
                            <span className="text-sm font-black text-gray-900 truncate ml-2">${parseFloat(entry.total_net).toFixed(2)}</span>
                        </div>
                        <button
                            onClick={() => onEditPayment(entry.id, entry.total_net)}
                            className="p-2 bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition shadow-sm active:scale-95 flex items-center justify-center shrink-0"
                            title="Editar"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onOpenBoleta(entry.id)}
                            className="px-4 py-2 bg-gray-900 text-white hover:bg-black rounded-xl text-sm font-bold transition shadow-sm active:scale-95 flex items-center gap-2 shrink-0"
                        >
                            Boleta
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
