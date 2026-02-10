import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

/**
 * AlertModal - Reusable alert/notification modal component
 * 
 * USAGE EXAMPLE:
 * 
 * 1. Import the hook and component in your component:
 *    import { AlertModal, useAlertModal } from './AlertModal';
 * 
 * 2. Use the hook to get modal state and methods:
 *    const { modal, showAlert, hideAlert } = useAlertModal();
 * 
 * 3. Show alerts anywhere in your code:
 *    showAlert('error', 'Error Title', 'Error message here');
 *    showAlert('warning', 'Warning Title', 'Multiple lines\nare supported');
 *    showAlert('success', 'Success!', 'Operation completed');
 *    showAlert('info', 'Info', 'Did you know...');
 * 
 * 4. Add the modal component to your JSX:
 *    <AlertModal 
 *        show={modal.show}
 *        type={modal.type}
 *        title={modal.title}
 *        message={modal.message}
 *        onClose={hideAlert}
 *    />
 */

export type AlertType = 'error' | 'warning' | 'success' | 'info';

interface AlertModalProps {
    show: boolean;
    type: AlertType;
    title: string;
    message: string;
    onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({ show, type, title, message, onClose }) => {
    if (!show) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" 
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon and Title */}
                <div className="flex items-start gap-4 mb-4">
                    <div className={`p-3 rounded-full ${
                        type === 'error' ? 'bg-red-100' :
                        type === 'warning' ? 'bg-amber-100' :
                        type === 'success' ? 'bg-green-100' :
                        'bg-blue-100'
                    }`}>
                        {type === 'error' && <AlertCircle className="text-red-600" size={24} />}
                        {type === 'warning' && <AlertCircle className="text-amber-600" size={24} />}
                        {type === 'success' && <CheckCircle className="text-green-600" size={24} />}
                        {type === 'info' && <Info className="text-blue-600" size={24} />}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
                        <p className="text-slate-600 text-sm whitespace-pre-line leading-relaxed">{message}</p>
                    </div>
                </div>
                
                {/* OK Button */}
                <button
                    onClick={onClose}
                    className={`w-full px-4 py-2.5 rounded-lg font-semibold text-white transition-all ${
                        type === 'error' ? 'bg-red-500 hover:bg-red-600' :
                        type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                        type === 'success' ? 'bg-green-500 hover:bg-green-600' :
                        'bg-blue-500 hover:bg-blue-600'
                    }`}
                >
                    OK
                </button>
            </div>
        </div>
    );
};

// Hook for easier usage
export const useAlertModal = () => {
    const [modal, setModal] = React.useState<{ 
        show: boolean; 
        type: AlertType; 
        title: string; 
        message: string 
    }>({ 
        show: false, 
        type: 'info', 
        title: '', 
        message: '' 
    });

    const showAlert = (type: AlertType, title: string, message: string) => {
        setModal({ show: true, type, title, message });
    };

    const hideAlert = () => {
        setModal({ ...modal, show: false });
    };

    return { modal, showAlert, hideAlert };
};
