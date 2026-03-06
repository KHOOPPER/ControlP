import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Building2, Save, Upload, X, ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * @fileoverview Settings.jsx - Configuración del Sistema y Branding.
 * Este componente permite al administrador ajustar el nombre de la empresa y
 * el logo institucional, los cuales se reflejan dinámicamente en toda la plataforma.
 */

/** Clave de localStorage para la configuración del sistema. */
const LS_KEY = 'controlp_settings';
/** Dimensión máxima (px) para redimensionar logos subidos. */
const MAX_DIM = 300;
/** Calidad de compresión JPEG (0-1). */
const QUALITY = 0.82;

/** Carga la configuración guardada en localStorage o devuelve valores por defecto. */
const load = () => {
    try {
        const s = JSON.parse(localStorage.getItem(LS_KEY)) || {};
        if (!s.companyName) s.companyName = 'Planillero';
        return s;
    } catch { return { companyName: 'Planillero' }; }
};

/**
 * Comprime una imagen en el cliente via Canvas y la devuelve como base64 JPEG.
 * @param {File} file - Archivo de imagen seleccionado.
 * @returns {Promise<string>} URI data: de la imagen comprimida.
 */
const compressImage = (file) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > MAX_DIM || height > MAX_DIM) {
                const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', QUALITY));
        };
        img.onerror = reject;
        img.src = url;
    });

/**
 * Componente Settings
 * Interfaz de configuración para nombre de empresa y logo institucional.
 * Los cambios se persisten en localStorage.
 *
 * @returns {JSX.Element} La vista de ajustes del sistema.
 */
export default function Settings() {
    /** Nombre de la empresa (editable). */
    const [companyName, setCompanyName] = useState('');
    /** Vista previa del logo (base64 data URL). */
    const [logoPreview, setLogoPreview] = useState('');
    /** Estado de compresión de imagen en curso. */
    const [isCompressing, setIsCompressing] = useState(false);
    /** Referencia al input de archivo oculto. */
    const fileInputRef = useRef(null);

    useEffect(() => {
        const s = load();
        setCompanyName(s.companyName || '');
        setLogoPreview(s.logoDataUrl || '');
    }, []);

    /** Comprime y previsualiza el logo seleccionado por el usuario. */
    const handleLogoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error('El logo debe pesar menos de 5 MB');
            return;
        }
        setIsCompressing(true);
        try {
            const compressed = await compressImage(file);
            setLogoPreview(compressed);
        } catch {
            toast.error('No se pudo procesar la imagen');
        } finally {
            setIsCompressing(false);
        }
    };

    /** Elimina el logo actual de la vista previa. */
    const removeLogo = () => {
        setLogoPreview('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    /** Persiste la configuración en localStorage y notifica al resto de la app. */
    const save = () => {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify({ companyName, logoDataUrl: logoPreview }));
            window.dispatchEvent(new CustomEvent('controlp-settings-updated'));
            toast.success('Ajustes guardados');
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                toast.error('Logo demasiado grande para guardar. Intenta con una imagen más pequeña.');
            } else {
                toast.error('Error al guardar');
            }
        }
    };

    const inputCls = "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white shadow-sm transition";

    return (
        <div className="max-w-2xl mx-auto pb-12">
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                    <SettingsIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600" strokeWidth={1.5} />
                    Ajustes
                </h1>
                <p className="text-gray-500 mt-1 text-sm sm:text-base">Configura la información de tu empresa.</p>
            </div>

            <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Información de la empresa</h2>
                    </div>

                    {/* Company Name */}
                    <div>
                        <label htmlFor="companyName" className="text-xs font-semibold text-gray-500 mb-1.5 block">Nombre de la empresa</label>
                        <input
                            id="companyName"
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Ej. Planillero"
                            className={inputCls}
                        />
                    </div>

                    {/* Logo */}
                    <div>
                        <label className="text-xs font-semibold text-gray-500 mb-2 block">Logo de la empresa</label>

                        {logoPreview ? (
                            /* ── Logo preview zone ── */
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                {/* Preview */}
                                <div className="relative shrink-0">
                                    <img
                                        src={logoPreview}
                                        alt="Vista previa del logo de la empresa"
                                        className="h-16 w-16 object-contain rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm"
                                    />
                                    <button
                                        onClick={removeLogo}
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Info + change button */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">Logo cargado</p>
                                    <p className="text-xs text-gray-400 mt-0.5 mb-3">Imagen comprimida y lista para guardar</p>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isCompressing}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:border-gray-300 shadow-sm transition-colors disabled:opacity-50"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        Cambiar logo
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ── Upload zone ── */
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isCompressing}
                                className="w-full h-36 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 transition-all cursor-pointer disabled:opacity-60 group"
                            >
                                {isCompressing ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm text-primary-500 font-medium">Procesando imagen…</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-primary-100 flex items-center justify-center transition-colors">
                                            <Upload className="w-5 h-5" strokeWidth={1.5} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-semibold">Subir logo</p>
                                            <p className="text-xs mt-0.5">PNG, JPG, SVG — máx. 5 MB</p>
                                        </div>
                                    </>
                                )}
                            </button>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoChange}
                        />
                    </div>
                </div>

                {/* Save */}
                <button
                    onClick={save}
                    className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-black transition flex items-center justify-center gap-2"
                >
                    <Save className="w-4 h-4" />
                    Guardar ajustes
                </button>
            </div>
        </div>
    );
}
