import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, PiggyBank, FileCheck, MoreHorizontal, Wallet, FileSpreadsheet, HelpCircle, Settings, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../i18n';
import clsx from 'clsx';
import './MobileNav.css';

const NAV_ITEMS_MAP = {
    dashboard:    { icon: LayoutDashboard, labelKey: 'nav.home', path: '/' },
    transactions: { icon: Receipt, labelKey: 'nav.transactions', path: '/transactions' },
    budget:       { icon: PiggyBank, labelKey: 'nav.budget', path: '/budget' },
    bills:        { icon: FileCheck, labelKey: 'nav.bills', path: '/bills' },
    portfolio:    { icon: Wallet, labelKey: 'nav.portfolio', path: '/portfolio' },
    import:       { icon: FileSpreadsheet, labelKey: 'nav.import', path: '/import' },
    help:         { icon: HelpCircle, labelKey: 'nav.help', path: '/help' },
};

const SETTINGS_ITEM = { key: 'settings', icon: Settings, labelKey: 'nav.settings', path: '/settings' };
const MAX_PRIMARY = 5;

export function MobileNav() {
    const [moreOpen, setMoreOpen] = useState(false);
    const { user, logout } = useAuth();
    const { settings } = useSettings();
    const { t } = useTranslation();
    const location = useLocation();

    // Close sheet on navigation
    useEffect(() => {
        setMoreOpen(false);
    }, [location.pathname]);

    // Close on escape
    useEffect(() => {
        if (!moreOpen) return;
        const handler = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [moreOpen]);

    const { visiblePrimary, visibleMore } = useMemo(() => {
        const order = settings?.page_order || Object.keys(NAV_ITEMS_MAP);
        const hidden = new Set(settings?.hidden_pages || []);

        const visible = order
            .filter(key => !hidden.has(key) && NAV_ITEMS_MAP[key])
            .map(key => ({ key, ...NAV_ITEMS_MAP[key] }));

        const primary = visible.slice(0, MAX_PRIMARY);
        const more = visible.slice(MAX_PRIMARY);
        more.push(SETTINGS_ITEM);
        return { visiblePrimary: primary, visibleMore: more };
    }, [settings]);

    const isMoreActive = visibleMore.some(item => location.pathname === item.path);

    return (
        <>
            <nav className="mobile-nav">
                {visiblePrimary.map(tab => (
                    <NavLink
                        key={tab.key}
                        to={tab.path}
                        className={({ isActive }) => clsx('mobile-nav-tab', isActive && 'active')}
                        end={tab.path === '/'}
                    >
                        <tab.icon size={22} />
                        <span>{t(tab.labelKey)}</span>
                    </NavLink>
                ))}
                <button
                    className={clsx('mobile-nav-tab', (moreOpen || isMoreActive) && 'active')}
                    onClick={() => setMoreOpen(v => !v)}
                >
                    {moreOpen ? <X size={22} /> : <MoreHorizontal size={22} />}
                    <span>{t('nav.more')}</span>
                </button>
            </nav>

            {moreOpen && (
                <>
                    <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)} />
                    <div className="mobile-more-sheet">
                        <div className="mobile-more-handle" />
                        {visibleMore.map(item => (
                            <NavLink
                                key={item.key}
                                to={item.path}
                                className={({ isActive }) => clsx('mobile-more-item', isActive && 'active')}
                            >
                                <item.icon size={20} />
                                <span>{t(item.labelKey)}</span>
                            </NavLink>
                        ))}
                        {user && (
                            <button className="mobile-more-item logout" onClick={logout}>
                                <LogOut size={20} />
                                <span>{t('nav.logOut')}</span>
                            </button>
                        )}
                    </div>
                </>
            )}
        </>
    );
}
