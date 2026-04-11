import { createContext, useContext, useState, useEffect } from 'react';
import { getLastDataMonth } from '../services/api';

const MonthContext = createContext();

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function MonthProvider({ children }) {
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [maxMonth, setMaxMonth] = useState(null);
    const [lastDataMonth, setLastDataMonth] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getLastDataMonth()
            .then((data) => {
                if (cancelled) return;
                const current = getCurrentMonth();
                const lastMonth = data?.month || current;
                setSelectedMonth(lastMonth);
                setLastDataMonth(lastMonth);
                // Allow one month ahead so user can navigate to upload new data
                const next = nextMonth(lastMonth);
                setMaxMonth(next <= current ? next : current);
                setReady(true);
            })
            .catch(() => {
                if (cancelled) return;
                const fallback = getCurrentMonth();
                setSelectedMonth(fallback);
                setLastDataMonth(fallback);
                setMaxMonth(fallback);
                setReady(true);
            });
        return () => { cancelled = true; };
    }, []);

    // Re-fetch maxMonth when data changes (e.g. after statement upload/delete)
    // Auto-navigate to the new latest month so the user sees their new data
    useEffect(() => {
        const handleStatementsUpdate = () => {
            getLastDataMonth()
                .then((data) => {
                    if (data?.month) {
                        const current = getCurrentMonth();
                        const next = nextMonth(data.month);
                        setMaxMonth(next <= current ? next : current);
                        setLastDataMonth(data.month);
                        // Navigate to the new latest month
                        setSelectedMonth(data.month);
                    }
                })
                .catch(() => {});
        };
        window.addEventListener('statements-updated', handleStatementsUpdate);
        return () => window.removeEventListener('statements-updated', handleStatementsUpdate);
    }, []);

    // Don't render children until we know the correct default month
    if (!ready) return null;

    return (
        <MonthContext.Provider value={{ selectedMonth, setSelectedMonth, maxMonth, lastDataMonth }}>
            {children}
        </MonthContext.Provider>
    );
}

export function useMonth() {
    const ctx = useContext(MonthContext);
    if (!ctx) throw new Error('useMonth must be used within MonthProvider');
    return ctx;
}
