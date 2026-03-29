import React, { useState, useEffect, useMemo } from 'react';
import {
    Settings as SettingsIcon, Save, GripVertical, Eye, EyeOff, Rabbit, Globe,
    LayoutDashboard, Receipt, PiggyBank, Wallet, FileCheck, FileSpreadsheet, HelpCircle, Heart,
} from 'lucide-react';
import { CarrotDonation } from '../../donate/components/CarrotDonation';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSettings, DEFAULT_PAGE_ORDER } from '../../../context/SettingsContext';
import { useToast } from '../../../context/ToastContext';
import { useZumfi } from '../../zumfi/context/ZumfiContext';
import { SkeletonLoader } from '../../../components/SkeletonLoader';
import { AccountSection } from './AccountSection';
import { TwoFactorSection } from './TwoFactorSection';
import { useTranslation, LANGUAGES } from '../../../i18n';
import './SettingsPage.css';

const CURRENCIES = [
    { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
    { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
    { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
    { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
    { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
    { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn' },
    { code: 'RSD', name: 'Serbian Dinar', symbol: 'din' },
    { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
    { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
    { code: 'ISK', name: 'Icelandic Krona', symbol: 'kr' },
    { code: 'GEL', name: 'Georgian Lari', symbol: '₾' },
    { code: 'BAM', name: 'Bosnia Mark', symbol: 'KM' },
    { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br' },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
    { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
    { code: 'THB', name: 'Thai Baht', symbol: '฿' },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
    { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
    { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
    { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
    { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
    { code: 'KZT', name: 'Kazakh Tenge', symbol: '₸' },
    { code: 'MNT', name: 'Mongolian Tugrik', symbol: '₮' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
    { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼' },
    { code: 'OMR', name: 'Omani Rial', symbol: '﷼' },
    { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD' },
    { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD' },
    { code: 'JOD', name: 'Jordanian Dinar', symbol: 'JD' },
    { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
    { code: 'IRR', name: 'Iranian Rial', symbol: '﷼' },
    { code: 'LBP', name: 'Lebanese Pound', symbol: 'L£' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
    { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
    { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
    { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' },
    { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD' },
    { code: 'TND', name: 'Tunisian Dinar', symbol: 'DT' },
    { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'ARS', name: 'Argentine Peso', symbol: 'AR$' },
    { code: 'CLP', name: 'Chilean Peso', symbol: 'CL$' },
    { code: 'COP', name: 'Colombian Peso', symbol: 'COL$' },
    { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/.' },
    { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U' },
    { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$' },
    { code: 'CRC', name: 'Costa Rican Colon', symbol: '₡' },
    { code: 'JMD', name: 'Jamaican Dollar', symbol: 'J$' },
    { code: 'TTD', name: 'Trinidad Dollar', symbol: 'TT$' },
];

const PAGE_META_KEYS = {
    dashboard:    { icon: LayoutDashboard, labelKey: 'nav.dashboard', locked: true },
    transactions: { icon: Receipt, labelKey: 'nav.transactions', locked: false },
    budget:       { icon: PiggyBank, labelKey: 'nav.budgetGoals', locked: false },
    portfolio:    { icon: Wallet, labelKey: 'nav.portfolio', locked: false },
    bills:        { icon: FileCheck, labelKey: 'nav.bills', locked: false },
    import:       { icon: FileSpreadsheet, labelKey: 'nav.import', locked: false },
    help:         { icon: HelpCircle, labelKey: 'nav.help', locked: false },
};

function SortablePageItem({ pageKey, meta, isHidden, onToggleVisibility }) {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: pageKey,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
    };

    const Icon = meta.icon;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className={`page-order-item${isHidden ? ' page-hidden' : ''}`}
        >
            <div className="drag-handle" {...listeners}>
                <GripVertical size={16} />
            </div>
            <Icon size={18} />
            <span className="page-label">{t(meta.labelKey)}</span>
            {!meta.locked ? (
                <button
                    className="visibility-toggle"
                    onClick={onToggleVisibility}
                    title={isHidden ? t('settings.showPage') : t('settings.hidePage')}
                >
                    {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            ) : (
                <span className="always-visible-badge">{t('settings.alwaysVisible')}</span>
            )}
        </div>
    );
}

export function SettingsPage() {
    const { settings, saveSettings, loading } = useSettings();
    const { prefs, setVisible, setPageData } = useZumfi();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const [saving, setSaving] = useState(false);

    // Local editable state
    const [preferredCurrency, setPreferredCurrency] = useState('CZK');
    const [pageOrder, setPageOrder] = useState(DEFAULT_PAGE_ORDER);
    const [hiddenPages, setHiddenPages] = useState([]);
    const [showRabbit, setShowRabbit] = useState(true);
    const [language, setLanguage] = useState('en');

    // Sync local state from loaded settings
    useEffect(() => {
        if (settings) {
            setPreferredCurrency(settings.preferred_currency || 'CZK');
            setPageOrder(settings.page_order || DEFAULT_PAGE_ORDER);
            setHiddenPages(settings.hidden_pages || []);
            setShowRabbit(settings.show_zumfi_rabbit ?? true);
            setLanguage(settings.language || 'en');
        }
    }, [settings]);

    // Sync Zumfi visibility from server on load
    useEffect(() => {
        if (settings && settings.show_zumfi_rabbit !== undefined) {
            setVisible(settings.show_zumfi_rabbit);
        }
    }, [settings?.show_zumfi_rabbit, setVisible]);

    const hasChanges = useMemo(() => {
        if (!settings) return false;
        return (
            preferredCurrency !== settings.preferred_currency ||
            JSON.stringify(pageOrder) !== JSON.stringify(settings.page_order || DEFAULT_PAGE_ORDER) ||
            JSON.stringify([...hiddenPages].sort()) !== JSON.stringify([...(settings.hidden_pages || [])].sort()) ||
            showRabbit !== (settings.show_zumfi_rabbit ?? true) ||
            language !== (settings.language || 'en')
        );
    }, [preferredCurrency, pageOrder, hiddenPages, showRabbit, language, settings]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveSettings({
                preferred_currency: preferredCurrency,
                page_order: pageOrder,
                hidden_pages: hiddenPages,
                show_zumfi_rabbit: showRabbit,
                language,
            });
            setVisible(showRabbit);
            addToast(t('settings.saved'), 'success');
        } catch {
            addToast(t('settings.saveFailed'), 'error');
        } finally {
            setSaving(false);
        }
    };

    // Drag-and-drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = pageOrder.indexOf(active.id);
        const newIndex = pageOrder.indexOf(over.id);
        setPageOrder(arrayMove(pageOrder, oldIndex, newIndex));
    };

    const togglePageVisibility = (pageKey) => {
        if (PAGE_META_KEYS[pageKey]?.locked) return;
        setHiddenPages(prev =>
            prev.includes(pageKey)
                ? prev.filter(k => k !== pageKey)
                : [...prev, pageKey]
        );
    };

    // Feed settings data to Zumfi for proximity interactions
    useEffect(() => {
        setPageData({
            _page: 'settings',
            preferredCurrency,
            hasUnsavedChanges: hasChanges,
            hiddenPages,
            pageOrder,
            showRabbit,
            zumiEnabled: showRabbit,
        });
        return () => setPageData(null);
    }, [preferredCurrency, hasChanges, hiddenPages, pageOrder, showRabbit, setPageData]);

    if (loading) return (
        <div className="page-container">
            <SkeletonLoader variant="card" count={1} />
        </div>
    );

    return (
        <div className="page-container">
            <header className="page-header" data-zumfi-zone="settings-header">
                <div>
                    <h1 className="page-title">{t('settings.title')}</h1>
                    <p className="page-subtitle">{t('settings.subtitle')}</p>
                </div>
            </header>

            {/* Support Zumi */}
            <div className="settings-section" data-zumfi-zone="donate">
                <h2 className="settings-section-title">
                    <Heart size={20} /> {t('donate.sectionTitle')}
                </h2>
                <CarrotDonation />
            </div>

            {/* Language Settings */}
            <div className="settings-section" data-zumfi-zone="settings-language">
                <h2 className="settings-section-title">
                    <Globe size={20} /> {t('settings.languageSettings')}
                </h2>
                <div className="setting-item">
                    <label htmlFor="language" className="setting-label">
                        {t('settings.language')}
                    </label>
                    <p className="setting-description">
                        {t('settings.languageDescription')}
                    </p>
                    <div className="language-options">
                        {LANGUAGES.map(lang => (
                            <button
                                key={lang.code}
                                className={`language-option${language === lang.code ? ' active' : ''}`}
                                onClick={() => setLanguage(lang.code)}
                                type="button"
                            >
                                <span className="language-flag">{lang.flag === 'GB' ? '\u{1F1EC}\u{1F1E7}' : lang.flag === 'CZ' ? '\u{1F1E8}\u{1F1FF}' : '\u{1F1FA}\u{1F1E6}'}</span>
                                <span className="language-name">{lang.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Currency Settings */}
            <div className="settings-section" data-zumfi-zone="settings-currency">
                <h2 className="settings-section-title">
                    <SettingsIcon size={20} /> {t('settings.currencySettings')}
                </h2>
                <div className="setting-item">
                    <label htmlFor="currency" className="setting-label">
                        {t('settings.preferredCurrency')}
                    </label>
                    <p className="setting-description">
                        {t('settings.currencyDescription')}
                    </p>
                    <select
                        id="currency"
                        className="currency-select"
                        value={preferredCurrency}
                        onChange={(e) => setPreferredCurrency(e.target.value)}
                    >
                        {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>
                                {c.code} - {c.name} ({c.symbol})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Navigation Settings */}
            <div className="settings-section" data-zumfi-zone="settings-navigation">
                <h2 className="settings-section-title">
                    <LayoutDashboard size={20} /> {t('settings.navigation')}
                </h2>
                <p className="setting-description">
                    {t('settings.navDescription')}
                </p>
                <div className="page-order-list">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={pageOrder} strategy={verticalListSortingStrategy}>
                            {pageOrder.map(key => (
                                <SortablePageItem
                                    key={key}
                                    pageKey={key}
                                    meta={PAGE_META_KEYS[key]}
                                    isHidden={hiddenPages.includes(key)}
                                    onToggleVisibility={() => togglePageVisibility(key)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>

            {/* Account Security */}
            <AccountSection />

            {/* Two-Factor Authentication */}
            <TwoFactorSection />

            {/* Appearance */}
            <div className="settings-section" data-zumfi-zone="settings-appearance">
                <h2 className="settings-section-title">
                    <Rabbit size={20} /> {t('settings.appearance')}
                </h2>
                <div className="setting-item toggle-row" data-zumfi-zone="settings-zumi">
                    <div>
                        <label className="setting-label">{t('settings.zumiRabbit')}</label>
                        <p className="setting-description">
                            {t('settings.zumiDescription')}
                        </p>
                    </div>
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            checked={showRabbit}
                            onChange={(e) => setShowRabbit(e.target.checked)}
                        />
                        <span className="toggle-slider" />
                    </label>
                </div>
            </div>

            {/* Save Button */}
            <button
                className="save-btn"
                onClick={handleSave}
                disabled={saving || !hasChanges}
            >
                <Save size={16} />
                {saving ? t('settings.saving') : t('settings.save')}
            </button>
        </div>
    );
}
