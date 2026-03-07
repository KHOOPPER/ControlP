import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, ArrowLeft, Download, ShieldAlert, Phone, MapPin, UserCheck, AlertTriangle } from 'lucide-react';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import toast from 'react-hot-toast';

/**
 * @fileoverview WorkerDetails.jsx - Perfil Detallado del Colaborador.
 * Este componente muestra toda la información técnica y administrativa de un empleado,
 * incluyendo previsualización de documentos y generación de ficha técnica en PDF.
 */

/**
 * Componente DocumentPreview
 * Renderiza una vista previa de documentos (PDF o Imagen).
 * 
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.label - Etiqueta descriptiva del documento.
 * @param {string} props.url - URL del archivo almacenado en Supabase Storage.
 * @returns {JSX.Element|null} El cuadro de previsualización o null si no hay URL.
 */
const DocumentPreview = ({ label, url }) => {
    if (!url) return null;
    const isPdf = url.toLowerCase().includes('.pdf');

    return (
        <div className="p-4 rounded-xl flex flex-col gap-3 bg-gray-50 border border-gray-100">
            <div className="font-semibold text-gray-700">{label}</div>
            {isPdf ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 p-8 rounded-lg bg-white border border-dashed border-gray-300 hover:border-primary-400 hover:bg-gray-50 transition-colors group">
                    <ShieldAlert className="w-8 h-8 text-gray-400 group-hover:text-primary-500 transition-colors" />
                    <span className="font-medium text-gray-500 group-hover:text-primary-600">Ver Documento PDF</span>
                </a>
            ) : (
                <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-white">
                    <img src={url} alt={label} className="w-full h-auto object-contain max-h-96" crossOrigin="anonymous" />
                </div>
            )}
        </div>
    );
};

/**
 * Componente WorkerDetails
 * Página de perfil individual que carga los datos de un trabajador por su ID
 * y permite la exportación de sus datos a formato PDF.
 * 
 * @returns {JSX.Element} La vista detallada del perfil.
 */
export default function WorkerDetails() {
    /** ID del trabajador extraído de la URL. */
    const { id } = useParams();
    /** Objeto con los datos del trabajador cargados de la DB. */
    const [worker, setWorker] = useState(null);
    /** Estado de carga de la consulta inicial. */
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchWorker = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('workers')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setWorker(data);
            } catch (error) {
                console.error('Error fetching worker details:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (id) fetchWorker();
    }, [id]);

    /**
     * Importa dinámicamente jsPDF y dispara la construcción del documento.
     */
    const handleDownloadPdf = async () => {
        const loadingToast = toast.loading('Generando PDF...');
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF('p', 'mm', 'a4');
            await buildPdf(doc);
            toast.success('PDF generado exitosamente', { id: loadingToast });
        } catch (error) {
            console.error('Error generando el PDF:', error);
            toast.error('Ocurrió un error al generar el PDF', { id: loadingToast });
        }
    };

    /**
     * Construye la estructura visual del PDF con los datos del perfil activo.
     * 
     * @param {Object} doc - Instancia de jsPDF.
     */
    const buildPdf = async (doc) => {
        const pageWidth = 210;
        const margin = 20;
        const contentWidth = pageWidth - margin * 2;
        let y = 25;

        // Cargar configuración de la empresa
        let companySettings = { companyName: 'ControlP - Registro de Personal', logoDataUrl: null };
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
            try {
                const imgProps = doc.getImageProperties(companySettings.logoDataUrl);
                const targetHeight = 16;
                const calculatedWidth = (imgProps.width * targetHeight) / imgProps.height;
                const finalWidth = Math.min(calculatedWidth, 50);

                doc.addImage(companySettings.logoDataUrl, 'JPEG', margin, startY, finalWidth, targetHeight, '', 'FAST');

                const textXPos = margin + finalWidth + 4;
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
                doc.text(companySettings.companyName.toUpperCase(), textXPos, startY + 10);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 100);
                doc.text('Perfil del Trabajador', textXPos, startY + 16);
            } catch (e) {
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
                doc.text(companySettings.companyName.toUpperCase(), margin, startY + 8);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 100);
                doc.text('Perfil del Trabajador', margin, startY + 14);
            }
        } else {
            doc.setFillColor(0, 0, 0);
            doc.rect(margin, startY, 40, 12, 'F');
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);

            const dispName = companySettings.companyName !== 'ControlP - Registro de Personal' ? companySettings.companyName : 'ControlP';
            doc.text(dispName.substring(0, 15), margin + 2, startY + 8);

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(16);
            doc.text('PERFIL DEL TRABAJADOR', margin + 46, startY + 8);
        }

        // Línea separadora superior
        doc.setLineWidth(0.5);
        doc.line(margin, 42, pageWidth - margin, 42);

        y = 52; // Mover 'y' inicial más abajo por el nuevo header

        // Función para cargar imagen a Base64
        const fetchAsBase64 = async (url) => {
            if (!url) return null;
            try {
                const res = await fetch(url);
                const blob = await res.blob();
                return await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.warn('Could not fetch image for PDF', url);
                return null;
            }
        };

        // Renderizar Foto de Perfil si existe
        if (worker.profile_picture_url) {
            const profileImgData = await fetchAsBase64(worker.profile_picture_url);
            if (profileImgData) {
                try {
                    const avatarSize = 35;
                    // Dibujar avatar a la derecha (pageWidth - margin - avatarSize)
                    const xPos = pageWidth - margin - avatarSize;
                    doc.addImage(profileImgData, 'JPEG', xPos, 50, avatarSize, avatarSize, '', 'MEDIUM');
                } catch (e) {
                    // Ignorar si falla la carga de imagen
                }
            }
        }

        // Helper para añadir líneas de texto con control de salto de página
        const addLine = (text, fontSize = 10, isBold = false, textColor = [0, 0, 0]) => {
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', isBold ? 'bold' : 'normal');
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            const lines = doc.splitTextToSize(text, contentWidth);
            lines.forEach(line => {
                if (y > 275) { doc.addPage(); y = 20; }
                doc.text(line, margin, y);
                y += fontSize * 0.4;
            });
        };

        // Helper para campos de datos clave/valor sin superposición
        const addField = (label, value, isBoldValue = false) => {
            if (y > 275) { doc.addPage(); y = 20; }
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(150, 150, 150);
            doc.text(label.toUpperCase(), margin, y);
            y += 4;

            doc.setFontSize(10);
            doc.setFont('helvetica', isBoldValue ? 'bold' : 'normal');
            doc.setTextColor(0, 0, 0);
            const valueLines = doc.splitTextToSize(value || '-', contentWidth - (worker.profile_picture_url ? 45 : 0)); // Evitar superponer con el avatar
            valueLines.forEach(line => {
                if (y > 275) { doc.addPage(); y = 20; }
                doc.text(line, margin, y);
                y += 5;
            });
            y += 3; // Extra space
        };

        const addSpacer = (h = 5) => { y += h; };
        const addSeparator = () => {
            if (y > 275) { doc.addPage(); y = 20; }
            doc.setDrawColor(220);
            doc.setLineWidth(0.2);
            doc.line(margin, y, pageWidth - margin, y);
            y += 8;
        };

        addLine('DATOS PERSONALES', 11, true, [100, 100, 100]);
        addSpacer(4);
        addField('Nombre', `${worker.first_name} ${worker.last_name}`, true);
        addField('DUI', worker.dui_number);
        addField('Teléfono', `+503 ${worker.phone_number}`);
        addField('Dirección Actual', worker.current_address);

        // Ensure y is pushed past the avatar if needed
        if (worker.profile_picture_url && y < 95) {
            y = 95;
        } else {
            addSpacer(2);
        }
        addSeparator();

        addLine('CONTACTO DE EMERGENCIA', 11, true, [100, 100, 100]);
        addSpacer(4);
        addField('Nombre de Contacto', worker.emergency_contact_name);
        addField('Teléfono', `+503 ${worker.emergency_contact_phone}`);

        if (worker.allergies_comments) {
            addSpacer(2);
            addField('Condiciones Médicas / Alergias', worker.allergies_comments);
        }
        addSpacer(2);
        addSeparator();

        addLine('DOCUMENTACION Y EXPEDIENTE', 11, true, [100, 100, 100]);
        addSpacer(4);
        const docs = [
            { label: 'DUI Frontal', url: worker.dui_front_url },
            { label: 'DUI Reverso', url: worker.dui_back_url },
            { label: 'NIT', url: worker.nit_url },
            { label: 'AFP', url: worker.afp_url },
            { label: 'Solvencia Policial', url: worker.solvencia_url },
            { label: 'Antecedentes Penales', url: worker.antecedentes_url },
        ];

        for (const d of docs) {
            if (d.url) {
                doc.setTextColor(34, 197, 94); // Green
                doc.text('✓', margin, y);
                addLine(`   ${d.label}`, 10, false, [0, 0, 0]);
                y -= 1;
            } else {
                doc.setTextColor(239, 68, 68); // Red
                doc.text('✗', margin, y);
                addLine(`   ${d.label}`, 10, false, [150, 150, 150]);
                y -= 1;
            }
        }

        // --- RENDERIZAR IMÁGENES DE DOCUMENTOS ---
        const docsWithImages = docs.filter(d => d.url && !d.url.toLowerCase().includes('.pdf'));

        if (docsWithImages.length > 0) {
            addSpacer(8);
            addSeparator();
            addLine('ANEXOS DE EXPEDIENTE', 11, true, [100, 100, 100]);
            addSpacer(6);

            for (const d of docsWithImages) {
                const imgData = await fetchAsBase64(d.url);
                if (imgData) {
                    try {
                        const imgProps = doc.getImageProperties(imgData);
                        let tWidth = imgProps.width;
                        let tHeight = imgProps.height;
                        const maxW = contentWidth * 0.85; // Limitar el ancho máximo a 85% para centrar
                        const maxH = 100; // Altura máxima permitida para anexos

                        // Escalar proporciones
                        if (tWidth > maxW) {
                            tHeight = (tHeight * maxW) / tWidth;
                            tWidth = maxW;
                        }
                        if (tHeight > maxH) {
                            tWidth = (tWidth * maxH) / tHeight;
                            tHeight = maxH;
                        }

                        // Comprobar espacio restante en la página
                        // Reservamos espacio para el título y la imagen (aprox tHeight + 20)
                        if (y + tHeight + 20 > 280) {
                            doc.addPage();
                            y = 20;
                        }

                        doc.setFontSize(10);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(0, 0, 0);
                        doc.text(d.label, margin, y);
                        y += 6;

                        // Centrar imagen
                        const xOffset = margin + (contentWidth - tWidth) / 2;

                        // Dibujar borde sutil alrededor de la imagen
                        doc.setDrawColor(220);
                        doc.setLineWidth(0.5);
                        doc.rect(xOffset, y, tWidth, tHeight);
                        doc.addImage(imgData, 'JPEG', xOffset, y, tWidth, tHeight, '', 'MEDIUM');

                        y += tHeight + 15; // Espacio después de la imagen
                    } catch (e) {
                        console.warn(`Error rendering image for ${d.label}`, e);
                    }
                }
            }
        }

        addSpacer(12);
        addSeparator();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generado el ${new Date().toLocaleDateString('es-SV')} a las ${new Date().toLocaleTimeString('es-SV')}`, margin, y);

        doc.save(`${worker.first_name}_${worker.last_name}_Perfil.pdf`);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-primary-600">
                <Loader2 className="w-12 h-12 animate-spin mb-4" />
                <p className="font-medium animate-pulse">Cargando perfil del trabajador...</p>
            </div>
        );
    }

    if (!worker) {
        return (
            <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-gray-900">Trabajador no encontrado</h2>
                <Link to="/workers" className="text-primary-600 hover:underline mt-4 inline-block">Volver al directorio</Link>
            </div>
        );
    }

    return (
        <LazyMotion features={domAnimation}>
            <div className="max-w-4xl mx-auto pb-12">
                <div className="flex items-center justify-between mb-6">
                    <Link to="/workers" className="inline-flex items-center gap-2 font-medium text-gray-500 hover:text-gray-900 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        Volver al directorio
                    </Link>
                    <button onClick={handleDownloadPdf} className="inline-flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm">
                        <Download className="w-5 h-5" />
                        Descargar PDF
                    </button>
                </div>

                <m.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    id="worker-pdf-content" className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-8"
                >
                    {/* Profile Header */}
                    <div className="px-8 py-10 bg-gray-900 text-white flex flex-col items-center gap-4 relative overflow-hidden">
                        {/* Avatar */}
                        <div className="w-32 h-32 rounded-full bg-gray-100 border-4 border-white shadow-md flex items-center justify-center shrink-0 z-10 overflow-hidden relative">
                            {worker.profile_picture_url ? (
                                <img src={worker.profile_picture_url} alt="Perfil" className="w-full h-full object-cover" crossOrigin="anonymous" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                    <UserCheck className="w-16 h-16 text-gray-300" />
                                </div>
                            )}
                        </div>

                        <div className="text-center z-10">
                            <h1 className="text-3xl sm:text-4xl font-bold mt-2 text-white">{worker.first_name} {worker.last_name}</h1>
                            <p className="mt-2 text-lg flex items-center justify-center gap-2 text-gray-300">
                                <UserCheck className="w-5 h-5" />
                                DUI: {worker.dui_number}
                            </p>
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-gray-900 pb-2 border-b border-gray-100">Información de Contacto</h3>
                                <ul className="space-y-4 text-gray-700">
                                    <li className="flex items-start gap-3">
                                        <Phone className="w-5 h-5 shrink-0 mt-0.5 text-gray-400" />
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Teléfono Personal</p>
                                            <p className="font-medium text-gray-900">+503 {worker.phone_number}</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-gray-400" />
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Dirección Actual</p>
                                            <p className="font-medium text-gray-900">{worker.current_address}</p>
                                        </div>
                                    </li>
                                </ul>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-gray-900 pb-2 border-b border-gray-100">Contacto de Emergencia</h3>
                                <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 space-y-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Contacto</p>
                                        <p className="font-bold text-gray-900 mt-0.5">{worker.emergency_contact_name}</p>
                                        <p className="font-medium text-primary-600">+503 {worker.emergency_contact_phone}</p>
                                    </div>
                                    {worker.allergies_comments && (
                                        <div className="pt-3 border-t border-gray-200">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2 mb-1">
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                Condiciones Médicas / Alergias
                                            </p>
                                            <p className="text-sm font-medium text-gray-700">{worker.allergies_comments}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-gray-900 pb-2 mb-6 border-b border-gray-100">Documentos Adjuntos</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <DocumentPreview label="DUI Frontal" url={worker.dui_front_url} />
                                <DocumentPreview label="DUI Reverso" url={worker.dui_back_url} />
                                <DocumentPreview label="NIT" url={worker.nit_url} />
                                <DocumentPreview label="AFP" url={worker.afp_url} />
                                <DocumentPreview label="Solvencia Policial" url={worker.solvencia_url} />
                                <DocumentPreview label="Antecedentes Penales" url={worker.antecedentes_url} />

                                {!worker.dui_front_url && !worker.nit_url && (
                                    <p className="text-sm italic p-6 rounded-2xl text-center text-gray-400 bg-gray-50 border border-dashed border-gray-200 col-span-2">
                                        No hay documentos adjuntos a este perfil.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </m.div>
            </div>
        </LazyMotion>
    );
}
