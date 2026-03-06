import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import FileUpload from '../components/FileUpload';
import { supabase } from '../lib/supabase';

/**
 * @fileoverview NewWorker.jsx - Registro de Nuevos Colaboradores.
 * Este componente proporciona un formulario completo para el alta de personal,
 * incluyendo la subida de documentos de identidad (DUI) y fotografía de perfil.
 */

/**
 * Componente NewWorker
 * Maneja la lógica de captura de datos, previsualización de imagen de perfil
 * y subida de documentos múltiples a Supabase Storage antes de crear el registro
 * del trabajador en la base de datos.
 * 
 * @returns {JSX.Element} El formulario de registro de trabajadores.
 */
export default function NewWorker() {
    /** Estado para los campos de texto del formulario. */
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        duiNumber: '',
        phoneNumber: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        currentAddress: '',
        allergiesComments: '',
    });

    /** Estado para los archivos de documentos (DUI, NIT, etc.). */
    const [files, setFiles] = useState({});
    /** Estado para la foto de perfil en crudo (File). */
    const [profilePic, setProfilePic] = useState(null);
    /** URL de previsualización para la foto de perfil. */
    const [profilePicPreview, setProfilePicPreview] = useState(null);
    /** Estado de carga durante el envío del formulario. */
    const [isSubmitting, setIsSubmitting] = useState(false);

    /**
     * Maneja cambios en campos de texto estándar.
     */
    const handleTextChange = (e) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    /**
     * Maneja cambios en campos numéricos de teléfono, limitando a 8 dígitos.
     */
    const handlePhoneChange = (e) => {
        const { name, value } = e.target;
        const digits = value.replace(/\D/g, '').substring(0, 8);
        setFormData((prev) => ({ ...prev, [name]: digits }));
    };

    /**
     * Callback para recibir archivos desde el componente FileUpload.
     * 
     * @param {string} id - Identificador del campo del archivo.
     * @param {File} file - El archivo seleccionado.
     */
    const handleFileUpload = (id, file) => {
        setFiles((prev) => ({ ...prev, [id]: file }));
    };

    /**
     * Maneja la selección de la foto de perfil y genera su vista previa.
     */
    const handleProfilePicChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setProfilePic(file);
            setProfilePicPreview(URL.createObjectURL(file));
        }
    };

    /**
     * Procesa el envío del formulario.
     * Sube todos los archivos a sus respectivos buckets en Supabase Storage
     * y luego crea el registro del trabajador con las URLs públicas obtenidas.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!files.dui_front || !files.dui_back) {
            toast.error("Las fotos del DUI son obligatorias");
            return;
        }

        setIsSubmitting(true);
        const loadingToast = toast.loading('Guardando trabajador (subiendo archivos)...');

        try {
            const uploadedUrls = {};

            /**
             * Sube un archivo individual a un bucket específico.
             * 
             * @param {string} bucket - Nombre del bucket destino.
             * @param {File} file - Archivo a subir.
             * @returns {Promise<string|null>} La URL pública del archivo.
             */
            const uploadFile = async (bucket, file) => {
                if (!file) return null;
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;

                const { data, error } = await supabase.storage
                    .from(bucket)
                    .upload(fileName, file);

                if (error) throw error;

                const { data: publicData } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(fileName);

                return publicData.publicUrl;
            };

            const uploadPromises = Object.entries(files).map(async ([id, file]) => {
                const url = await uploadFile(id, file);
                return { id, url };
            });

            if (profilePic) {
                uploadPromises.push(uploadFile('profile_pictures', profilePic).then(url => ({ id: 'profile_picture', url })));
            }

            const results = await Promise.all(uploadPromises);

            results.forEach(({ id, url }) => {
                uploadedUrls[`${id}_url`] = url;
            });

            const { error: dbError } = await supabase
                .from('workers')
                .insert({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    dui_number: formData.duiNumber,
                    phone_number: formData.phoneNumber,
                    emergency_contact_name: formData.emergencyContactName,
                    emergency_contact_phone: formData.emergencyContactPhone,
                    current_address: formData.currentAddress,
                    allergies_comments: formData.allergiesComments || null,
                    dui_front_url: uploadedUrls['dui_front_url'] || null,
                    dui_back_url: uploadedUrls['dui_back_url'] || null,
                    nit_url: uploadedUrls['nit_url'] || null,
                    afp_url: uploadedUrls['afp_url'] || null,
                    solvencia_url: uploadedUrls['solvencia_url'] || null,
                    antecedentes_url: uploadedUrls['antecedentes_url'] || null,
                    profile_picture_url: uploadedUrls['profile_picture_url'] || null
                });

            if (dbError) throw dbError;

            toast.success('Trabajador guardado exitosamente', { id: loadingToast });

            setFormData({
                firstName: '', lastName: '', duiNumber: '', phoneNumber: '',
                emergencyContactName: '', emergencyContactPhone: '',
                currentAddress: '', allergiesComments: '',
            });
            setFiles({});
            setProfilePic(null);
            setProfilePicPreview(null);

        } catch (error) {
            console.error('Error saving worker:', error);
            if (error.code === '23505') {
                toast.error('Ya existe un trabajador registrado con este número de DUI', { id: loadingToast });
            } else {
                toast.error(error.message || 'Error al guardar el trabajador', { id: loadingToast });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto pb-12">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Registro de Trabajador</h1>
                <p className="text-gray-600 mt-2">Completa el formulario y sube la documentación requerida.</p>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex flex-col items-center mb-8 border-b pb-6">
                            <label htmlFor="profile-upload" className="cursor-pointer group relative">
                                <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md flex items-center justify-center relative">
                                    {profilePicPreview ? (
                                        <img src={profilePicPreview} alt="Vista previa del perfil" className="w-full h-full object-cover" />
                                    ) : (
                                        <svg className="w-24 h-24 mt-4 text-gray-300 group-hover:text-primary-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white text-xs font-semibold text-center leading-tight px-2">Cambiar Foto</span>
                                    </div>
                                </div>
                            </label>
                            <input id="profile-upload" type="file" accept="image/*" onChange={handleProfilePicChange} className="hidden" />
                            <p className="text-sm text-gray-500 mt-3 font-medium">Foto de Perfil (Opcional)</p>
                        </div>

                        <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">1. Datos del Trabajador</h2>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">Nombres *</label>
                                    <input id="firstName" type="text" name="firstName" value={formData.firstName} onChange={handleTextChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow" placeholder="Ej. Juan Carlos" required />
                                </div>
                                <div>
                                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Apellidos *</label>
                                    <input id="lastName" type="text" name="lastName" value={formData.lastName} onChange={handleTextChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow" placeholder="Ej. Pérez Gómez" required />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="duiNumber" className="block text-sm font-medium text-gray-700 mb-1">Número de DUI *</label>
                                    <input id="duiNumber" type="text" name="duiNumber" value={formData.duiNumber} onChange={handleTextChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow" placeholder="00000000-0" required />
                                </div>
                                <div>
                                    <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">Teléfono Personal *</label>
                                    <div className="flex rounded-lg shadow-sm">
                                        <span className="inline-flex items-center px-4 rounded-l-lg border border-y border-l border-gray-300 bg-gray-50 text-gray-500 sm:text-sm font-medium">+503</span>
                                        <input id="phoneNumber" type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handlePhoneChange} className="flex-1 block w-full border border-gray-300 rounded-none rounded-r-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow" placeholder="00000000" required />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="currentAddress" className="block text-sm font-medium text-gray-700 mb-1">Dirección Actual *</label>
                                <input id="currentAddress" type="text" name="currentAddress" value={formData.currentAddress} onChange={handleTextChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow" placeholder="Colonia, Calle, Municipio..." required />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="emergencyContactName" className="block text-sm font-medium text-gray-700 mb-1">Contacto de Emergencia *</label>
                                    <input id="emergencyContactName" type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleTextChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow" placeholder="Nombre completo" required />
                                </div>
                                <div>
                                    <label htmlFor="emergencyContactPhone" className="block text-sm font-medium text-gray-700 mb-1">Tel. de Emergencia *</label>
                                    <div className="flex rounded-lg shadow-sm">
                                        <span className="inline-flex items-center px-4 rounded-l-lg border border-y border-l border-gray-300 bg-gray-50 text-gray-500 sm:text-sm font-medium">+503</span>
                                        <input id="emergencyContactPhone" type="text" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handlePhoneChange} className="flex-1 block w-full border border-gray-300 rounded-none rounded-r-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow" placeholder="00000000" required />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="allergiesComments" className="block text-sm font-medium text-gray-700 mb-1">Alergias o Comentarios Médicos</label>
                                <textarea id="allergiesComments" name="allergiesComments" value={formData.allergiesComments} onChange={handleTextChange} rows={2} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow" placeholder="Es alérgico a la penicilina, sufre de asma, etc." />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">2. Documentos</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <FileUpload id="dui_front" label="DUI Frontal" accept={{ 'image/jpeg': [], 'image/png': [] }} onUpload={handleFileUpload} file={files['dui_front']} />
                            <FileUpload id="dui_back" label="DUI Reverso" accept={{ 'image/jpeg': [], 'image/png': [] }} onUpload={handleFileUpload} file={files['dui_back']} />
                        </div>
                        <FileUpload id="nit" label="NIT" accept={{ 'image/jpeg': [], 'image/png': [], 'application/pdf': [] }} onUpload={handleFileUpload} file={files['nit']} />
                        <FileUpload id="afp" label="AFP" accept={{ 'image/jpeg': [], 'image/png': [], 'application/pdf': [] }} onUpload={handleFileUpload} file={files['afp']} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <FileUpload id="solvencia" label="Solvencia Policial" accept={{ 'image/jpeg': [], 'image/png': [], 'application/pdf': [] }} onUpload={handleFileUpload} file={files['solvencia']} />
                            <FileUpload id="antecedentes" label="Antecedentes Penales" accept={{ 'image/jpeg': [], 'image/png': [], 'application/pdf': [] }} onUpload={handleFileUpload} file={files['antecedentes']} />
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-gray-500 text-center sm:text-left">
                            Verifica que los documentos y datos sean correctos antes de guardar.
                        </p>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-xl font-medium transition-colors disabled:opacity-70 whitespace-nowrap shadow-md hover:shadow-lg"
                        >
                            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" strokeWidth={1.5} />}
                            <span className="text-base">{isSubmitting ? 'Guardando...' : 'Guardar Registro'}</span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
