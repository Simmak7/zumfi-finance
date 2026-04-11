import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Wand2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { getBillStatus, autofillBills, getMissingBills } from '../../../services/api';
import { useInspector } from '../../../context/InspectorContext';
import { useToast } from '../../../context/ToastContext';
import { SkeletonLoader } from '../../../components/SkeletonLoader';
import { BillChecklist } from './BillChecklist';
import { MortgageTab } from './MortgageTab';
import { formatMoney, formatCurrency } from '../../../utils/currencies';
import { MonthPicker } from '../../../components/MonthPicker';
import { useMonth } from '../../../context/MonthContext';
import { useZumfi } from '../../zumfi/context/ZumfiContext';
import { useSettings } from '../../../context/SettingsContext';
import { useTranslation } from '../../../i18n';
import './BillsPage.css';

export function BillsPage() {
    const { t } = useTranslation();
    const TABS = [
        { key: 'recurring', label: t('bills.recurringBills') },
        { key: 'mortgage', label: t('bills.mortgage') },
    ];
    const { openInspector } = useInspector();
    const { addToast } = useToast();
    const { setPageData } = useZumfi();
    const [billStatuses, setBillStatuses] = useState([]);
    const [missingBills, setMissingBills] = useState(null);
    const [loading, setLoading] = useState(true);
    const [autofilling, setAutofilling] = useState(false);
    const [activeTab, setActiveTab] = useState('recurring');
    const { selectedMonth, setSelectedMonth, maxMonth } = useMonth();
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    const [missingDismissed, setMissingDismissed] = useState(false);

    // Reset dismissed state when month changes; check localStorage
    useEffect(() => {
        const key = `missing-bills-dismissed-${selectedMonth}`;
        setMissingDismissed(localStorage.getItem(key) === '1');
    }, [selectedMonth]);

    const dismissMissing = useCallback(() => {
        localStorage.setItem(`missing-bills-dismissed-${selectedMonth}`, '1');
        setMissingDismissed(true);
    }, [selectedMonth]);

    const fetchBills = async () => {
        setLoading(true);
        try {
            const [data, missing] = await Promise.all([
                getBillStatus(selectedMonth),
                getMissingBills(selectedMonth),
            ]);
            setBillStatuses(data);
            setMissingBills(missing);
        } catch (err) {
            console.error("Error fetching bills:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBills();
        const handleUpdate = () => fetchBills();
        window.addEventListener('bills-updated', handleUpdate);
        return () => window.removeEventListener('bills-updated', handleUpdate);
    }, [selectedMonth]);

    const totalMonthly = billStatuses.reduce(
        (sum, b) => sum + (b.paid_amount != null ? Number(b.paid_amount) : 0), 0
    );

    const handleAutofill = async () => {
        setAutofilling(true);
        try {
            const result = await autofillBills(selectedMonth);
            if (result.created > 0) {
                addToast(t('bills.added', { count: result.created }), 'success');
                fetchBills();
            } else if (result.skipped > 0) {
                addToast(t('bills.allExist'), 'info');
            } else {
                addToast(t('bills.noRecurring'), 'info');
            }
        } catch (err) {
            console.error('Autofill failed:', err);
            addToast(t('bills.autofillFailed'), 'error');
        } finally {
            setAutofilling(false);
        }
    };

    const paidCount = billStatuses.filter(b => b.paid_amount != null && Number(b.paid_amount) > 0).length;
    const overdueCount = billStatuses.filter(b => b.status === 'overdue').length;
    const totalExpected = billStatuses.reduce((sum, b) => sum + Number(b.expected_amount || 0), 0);
    const totalPaid = billStatuses.reduce((sum, b) => sum + (b.paid_amount != null ? Number(b.paid_amount) : 0), 0);

    useEffect(() => {
        setPageData({
            _page: 'bills',
            billStatuses,
            totalMonthly,
            missingBills,
            paidCount,
            overdueCount,
            totalExpected,
            totalPaid,
            activeTab,
        });
        return () => setPageData(null);
    }, [billStatuses, totalMonthly, missingBills, paidCount, overdueCount, totalExpected, totalPaid, activeTab, setPageData]);

    return (
        <div className="page-container">
            <header className="page-header" data-zumfi-zone="bills-header">
                <div>
                    <h1 className="page-title">{t('bills.title')}</h1>
                    <p className="page-subtitle">{t('bills.subtitle')}</p>
                </div>
                <div className="bills-header-actions">
                    <div data-zumfi-zone="bills-month-picker">
                        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} max={maxMonth} />
                    </div>
                </div>
            </header>

            <div className="bills-tabs" data-zumfi-zone="bills-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`bills-tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'recurring' && (
                <div className="bills-recurring-content">
                    <div className="bills-total-card" data-zumfi-zone="bills-summary">
                        <span className="bills-total-label">{t('bills.monthlyFixed')}</span>
                        <span className="bills-total-amount">
                            {formatCurrency(totalMonthly, currency)}
                        </span>
                        <span className="bills-total-count">
                            {t('bills.billCount', { count: billStatuses.length })}
                        </span>
                    </div>

                    {!loading && missingBills && (
                        missingBills.all_paid ? (
                            <div className="missing-bills-banner success" data-zumfi-zone="bills-missing">
                                <CheckCircle size={16} />
                                <span>{t('bills.allPaid')}</span>
                            </div>
                        ) : missingBills.missing.length > 0 && !missingDismissed && (
                            <div className="missing-bills-banner warning" data-zumfi-zone="bills-missing">
                                <AlertTriangle size={16} />
                                <div className="missing-bills-content">
                                    <span className="missing-bills-title">{t('bills.missingTitle')}</span>
                                    <ul className="missing-bills-list">
                                        {missingBills.missing.map((item, i) => (
                                            <li key={i}>
                                                {item.name}
                                                <span className="missing-bill-amount">
                                                    ~{formatCurrency(item.typical_amount, currency)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button className="missing-bills-dismiss" onClick={dismissMissing}>
                                        {t('bills.iUnderstand')}
                                    </button>
                                </div>
                            </div>
                        )
                    )}

                    <div className="bills-actions-row">
                        <button
                            className="autofill-btn"
                            data-zumfi-zone="bills-autofill"
                            onClick={handleAutofill}
                            disabled={autofilling}
                        >
                            <Wand2 size={18} className={autofilling ? 'spin' : ''} />
                            <span>{autofilling ? t('bills.detecting') : t('bills.detectBills')}</span>
                        </button>
                        <button
                            className="add-bill-btn"
                            data-zumfi-zone="bills-add-btn"
                            onClick={() => openInspector('add-bill', null)}
                        >
                            <Plus size={18} />
                            <span>{t('bills.addBill')}</span>
                        </button>
                    </div>

                    <div data-zumfi-zone="bills-checklist">
                        {loading ? (
                            <SkeletonLoader variant="list-item" count={4} />
                        ) : (
                            <BillChecklist
                                billStatuses={billStatuses}
                                onRefresh={fetchBills}
                            />
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'mortgage' && (
                <MortgageTab />
            )}
        </div>
    );
}
