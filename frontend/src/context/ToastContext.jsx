import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef({});

    const addToast = useCallback((message, type = 'success', duration = 3000) => {
        const id = ++toastId;
        setToasts(prev => {
            const next = [...prev, { id, message, type }];
            return next.length > 3 ? next.slice(-3) : next;
        });
        timersRef.current[id] = setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
            delete timersRef.current[id];
        }, duration);
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
        if (timersRef.current[id]) {
            clearTimeout(timersRef.current[id]);
            delete timersRef.current[id];
        }
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
