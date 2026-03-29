import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSettings, updateSettings } from '../services/api';
import { I18nProvider } from '../i18n';

const SettingsContext = createContext(null);

const DEFAULT_PAGE_ORDER = [
    'dashboard', 'transactions', 'budget', 'portfolio', 'bills', 'import', 'help',
];

/**
 * Reconcile saved page order with the canonical list.
 * Handles future additions (appended at end) and removals (filtered out).
 */
function reconcilePageOrder(saved, canonical) {
    if (!saved) return [...canonical];
    const valid = saved.filter(k => canonical.includes(k));
    const missing = canonical.filter(k => !saved.includes(k));
    return [...valid, ...missing];
}

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadSettings = useCallback(async () => {
        try {
            const data = await getSettings();
            data.page_order = reconcilePageOrder(data.page_order, DEFAULT_PAGE_ORDER);
            setSettings(data);
        } catch {
            setSettings({
                preferred_currency: 'CZK',
                page_order: [...DEFAULT_PAGE_ORDER],
                hidden_pages: [],
                show_zumfi_rabbit: true,
                language: 'en',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const saveSettings = useCallback(async (partial) => {
        const updated = await updateSettings(partial);
        updated.page_order = reconcilePageOrder(updated.page_order, DEFAULT_PAGE_ORDER);
        setSettings(updated);
        window.dispatchEvent(new Event('settings-updated'));
        return updated;
    }, []);

    const value = {
        settings,
        loading,
        saveSettings,
        reloadSettings: loadSettings,
    };

    const language = settings?.language || 'en';

    return (
        <SettingsContext.Provider value={value}>
            <I18nProvider language={language}>
                {children}
            </I18nProvider>
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
    return ctx;
}

export { DEFAULT_PAGE_ORDER };
