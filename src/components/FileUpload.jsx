import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UserCircle, Briefcase, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';

/**
 * Componente FileUpload
 * Proporciona una zona de arrastrar y soltar para la carga de documentos,
 * con iconos dinámicos basados en el tipo de archivo solicitado.
 */
export default function FileUpload({ label, accept, onUpload, file, id }) {

    const onDrop = useCallback(
        (acceptedFiles) => {
            if (acceptedFiles.length > 0) {
                onUpload(id, acceptedFiles[0]);
            }
        },
        [onUpload, id]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept,
        maxFiles: 1,
    });

    const getIcon = () => {
        switch (id) {
            case 'dui_front':
            case 'dui_back':
                return <UserCircle className="w-10 h-10 text-primary-400" strokeWidth={1.5} />;
            case 'nit':
            case 'afp':
                return <Briefcase className="w-10 h-10 text-primary-400" strokeWidth={1.5} />;
            case 'solvencia':
            case 'antecedentes':
                return <ShieldCheck className="w-10 h-10 text-primary-400" strokeWidth={1.5} />;
            default:
                return <FileText className="w-10 h-10 text-primary-400" strokeWidth={1.5} />;
        }
    }

    return (
        <div className="mb-4">
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2 cursor-pointer">
                {label}
            </label>
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                    }`}
            >
                <input {...getInputProps({ id })} />
                {file ? (
                    <div className="flex flex-col items-center gap-2 text-green-600">
                        <CheckCircle2 className="w-10 h-10" />
                        <span className="text-sm font-medium truncate w-full px-2">
                            {file.name.substring(0, file.name.lastIndexOf('.')) || file.name}
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                        {getIcon()}
                        <span className="text-sm font-medium text-primary-600">
                            Subir o capturar
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
