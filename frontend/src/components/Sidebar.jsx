import React, { useMemo } from 'react';
import { LayoutDashboard, Receipt, PiggyBank, Wallet, FileCheck, FileSpreadsheet, HelpCircle, Settings, LogOut } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useZumfi } from '../features/zumfi/context/ZumfiContext';
import { ZumfiHome } from '../features/zumfi/components/ZumfiHome';
import { useTranslation } from '../i18n';
import clsx from 'clsx';
import './Sidebar.css';

const NAV_ITEMS_MAP = {
    dashboard:    { icon: LayoutDashboard, labelKey: 'nav.dashboard', path: '/' },
    transactions: { icon: Receipt, labelKey: 'nav.transactions', path: '/transactions' },
    budget:       { icon: PiggyBank, labelKey: 'nav.budgetGoals', path: '/budget' },
    portfolio:    { icon: Wallet, labelKey: 'nav.portfolio', path: '/portfolio' },
    bills:        { icon: FileCheck, labelKey: 'nav.bills', path: '/bills' },
    import:       { icon: FileSpreadsheet, labelKey: 'nav.import', path: '/import' },
    help:         { icon: HelpCircle, labelKey: 'nav.help', path: '/help' },
};

const SETTINGS_NAV = { icon: Settings, labelKey: 'nav.settings', path: '/settings' };

export function Sidebar() {
    const { user, logout } = useAuth();
    const { settings } = useSettings();
    const { prefs } = useZumfi();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const navItems = useMemo(() => {
        if (!settings) return [];

        const order = settings.page_order || Object.keys(NAV_ITEMS_MAP);
        const hidden = new Set(settings.hidden_pages || []);

        const items = order
            .filter(key => !hidden.has(key) && NAV_ITEMS_MAP[key])
            .map(key => ({ key, ...NAV_ITEMS_MAP[key] }));

        items.push({ key: 'settings', ...SETTINGS_NAV });
        return items;
    }, [settings]);

    return (
        <aside className="app-sidebar">
            <div className="logo-section">
                <span className="logo-text"><span className="logo-zum">ZUM</span><span className="logo-fi">FI</span></span>
                <span className="logo-finance">Finance</span>
            </div>

            <nav className="nav-menu">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => clsx('nav-item', isActive && 'active')}
                    >
                        <item.icon size={20} />
                        <span>{t(item.labelKey)}</span>
                    </NavLink>
                ))}
            </nav>

            {prefs.visible && (
                <div className="zumfi-home-area">
                    <div className="zumfi-home-col">
                        <span
                            className="zumfi-carrot-btn"
                            title={t('donate.sectionTitle')}
                            onClick={() => navigate('/settings')}
                        >
                            {'\u{1F955}'}
                        </span>
                        <ZumfiHome />
                    </div>
                </div>
            )}

            {user && (
                <div className="user-section">
                    <div className="user-avatar">{(user.display_name || user.email || '?')[0].toUpperCase()}</div>
                    <div className="user-info">
                        <span className="user-name">{user.display_name || user.email}</span>
                    </div>
                    <LogOut size={18} className="logout-icon" onClick={logout} style={{ cursor: 'pointer' }} />
                </div>
            )}
            <div className="sidebar-version">v1.1</div>
        </aside>
    );
}
