import React from 'react';
import { Check, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import './Toast.css';

const ICONS = {
    success: Check,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const COLORS = {
    success: '#22c55e',
    error: '#f43f5e',
    warning: '#fbbf24',
    info: '#6366f1',
};

export function ToastContainer() {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="toast-stack">
            {toasts.map(toast => {
                const Icon = ICONS[toast.type] || Check;
                const color = COLORS[toast.type] || COLORS.success;
                return (
                    <div key={toast.id} className="toast-item" style={{ borderLeftColor: color }}>
                        <Icon size={16} style={{ color, flexShrink: 0 }} />
                        <span className="toast-message">{toast.message}</span>
                        <button className="toast-close" onClick={() => removeToast(toast.id)}>
                            <X size={14} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
