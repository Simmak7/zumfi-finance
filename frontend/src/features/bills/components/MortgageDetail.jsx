import React, { useState, useEffect, useCallback } from 'react';
import { getMortgage, getMortgageEvents, getMortgagePayments,
    createMortgage, updateMortgage, deleteMortgage,
    createMortgageEvent, updateMortgageEvent, deleteMortgageEvent,
    deleteMortgagePayment,
    getPropertyInvestments, getCategories,
} from '../../../services/api';
import { formatCurrency, formatMoney, CURRENCY_SYMBOLS } from '../../../utils/currencies';
import { useToast } from '../../../context/ToastContext';
import { SkeletonLoader } from '../../../components/SkeletonLoader';
import {
    X, Plus, Edit3, Percent, CreditCard, ArrowLeft,
    Bell, Calendar, History, ChevronRight, Clock, DollarSign, Target,
    Save, Loader2, Trash2, Calculator,
} from 'lucide-react';
import { useTranslation } from '../../../i18n';
import './MortgageDetail.css';

const EVENT_LABEL_KEYS = {
    extra_payment: 'mortgageTab.extraPaymentLabel',
    rate_change: 'mortgageTab.rateChangeLabel',
    payment_change: 'mortgageTab.paymentChangeLabel',
    balance_override: 'mortgageTab.balanceCorrectionLabel',
    fix_period_change: 'mortgageTab.fixPeriodUpdateLabel',
};

const EVENT_ICONS = {
    extra_payment: DollarSign,
    rate_change: Percent,
    payment_change: CreditCard,
    balance_override: Target,
    fix_period_change: Calendar,
};

const EVENT_COLORS = {
    extra_payment: '#10b981',
    rate_change: '#f59e0b',
    payment_change: '#6366f1',
    balance_override: '#8b5cf6',
    fix_period_change: '#3b82f6',
};

const POPULAR_CURRENCIES = ['CZK', 'EUR', 'GBP', 'USD', 'PLN', 'HUF', 'CHF', 'SEK', 'NOK', 'DKK'];

const EVENT_TYPE_KEYS = [
    { value: 'extra_payment', labelKey: 'mortgageTab.extraPaymentLabel' },
    { value: 'rate_change', labelKey: 'mortgageTab.interestRateChangeLabel' },
    { value: 'payment_change', labelKey: 'mortgageTab.monthlyPaymentChangeLabel' },
    { value: 'balance_override', labelKey: 'mortgageTab.balanceCorrectionLabel' },
    { value: 'fix_period_change', labelKey: 'mortgageTab.fixPeriodChangeLabel' },
];

// ────────────────────────────────────────────────────────────
// Sub-view: Detail
// ────────────────────────────────────────────────────────────
function DetailView({ mortgage, events, payments, curr, onEditMortgage, onAddEvent, onEditEvent, onDelete }) {
    const { addToast } = useToast();
    const { t } = useTranslation();
    const activeReminders = (mortgage.fix_expiry_reminders || []).filter(r => r.is_active);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        setDeleting(true);
        try {
            await deleteMortgage(mortgage.id);
            window.dispatchEvent(new Event('mortgages-updated'));
            onDelete();
        } catch (err) {
            console.error('Error deleting mortgage:', err);
        } finally {
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    const formatEventDetail = (ev) => {
        switch (ev.event_type) {
            case 'extra_payment':
                return `+${formatCurrency(ev.amount, curr)} ${t('mortgageTab.paidOffPrincipal')}`;
            case 'rate_change':
                return `${ev.old_rate != null ? `${Number(ev.old_rate).toFixed(3)}%` : '?'} → ${Number(ev.new_rate).toFixed(3)}%${ev.new_fix_end_date ? ` (${t('mortgageTab.fixedUntilSubtitle', { date: ev.new_fix_end_date })})` : ''}`;
            case 'payment_change':
                return `${ev.old_payment != null ? formatCurrency(ev.old_payment, curr) : '?'} → ${formatCurrency(ev.new_payment, curr)}/mo`;
            case 'balance_override':
                return t('mortgageTab.balanceSetTo', { amount: formatCurrency(ev.new_balance, curr) });
            case 'fix_period_change':
                return t('mortgageTab.newFixEnds', { date: ev.new_fix_end_date });
            default:
                return '';
        }
    };

    return (
        <>
            <div className="mdm-hero">
                <span className="mdm-hero-label">{t('mortgageTab.remainingBalance')}</span>
                <span className="mdm-hero-value">{formatCurrency(mortgage.remaining_balance, curr)}</span>
            </div>

            <div className="mdm-progress-section">
                <div className="mdm-progress-bar">
                    <div className="mdm-progress-fill" style={{ width: `${mortgage.progress_pct || 0}%` }} />
                </div>
                <div className="mdm-progress-labels">
                    <span>{t('mortgageTab.paidOffPct', { pct: mortgage.progress_pct })}</span>
                    <span>{formatCurrency(mortgage.principal_paid, curr)} / {formatCurrency(mortgage.original_amount, curr)}</span>
                </div>
            </div>

            {activeReminders.length > 0 && (
                <div className="mdm-reminders">
                    {activeReminders.map((r, i) => (
                        <div key={i} className="mdm-reminder">
                            <Bell size={14} />
                            <div>
                                <span className="mdm-reminder-title">{r.label}</span>
                                <span className="mdm-reminder-date">{t('mortgageTab.fixExpires', { date: r.fix_end_date })}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mdm-stats-grid">
                <div className="mdm-stat">
                    <span className="mdm-stat-label">{t('mortgageTab.monthlyPayment')}</span>
                    <span className="mdm-stat-value">{formatCurrency(mortgage.monthly_payment, curr)}</span>
                </div>
                <div className="mdm-stat">
                    <span className="mdm-stat-label">{t('mortgageTab.interestRateLabel')}</span>
                    <span className="mdm-stat-value">{Number(mortgage.interest_rate).toFixed(2)}%</span>
                </div>
                <div className="mdm-stat">
                    <span className="mdm-stat-label">{t('mortgageTab.timeLeftLabel')}</span>
                    <span className="mdm-stat-value">
                        {Math.floor((mortgage.months_remaining || 0) / 12)}y {(mortgage.months_remaining || 0) % 12}m
                    </span>
                </div>
                <div className="mdm-stat">
                    <span className="mdm-stat-label">{t('mortgageTab.elapsed')}</span>
                    <span className="mdm-stat-value">
                        {Math.floor((mortgage.months_elapsed || 0) / 12)}y {(mortgage.months_elapsed || 0) % 12}m
                    </span>
                </div>
                <div className="mdm-stat">
                    <span className="mdm-stat-label">{t('mortgageTab.principalPaid')}</span>
                    <span className="mdm-stat-value">{formatCurrency(mortgage.principal_paid, curr)}</span>
                </div>
                <div className="mdm-stat">
                    <span className="mdm-stat-label">{t('mortgageTab.interestPaid')}</span>
                    <span className="mdm-stat-value">{formatCurrency(mortgage.interest_paid, curr)}</span>
                </div>
                <div className="mdm-stat">
                    <span className="mdm-stat-label">{t('mortgageTab.extraPayments')}</span>
                    <span className="mdm-stat-value mdm-green">{formatCurrency(mortgage.extra_payments, curr)}</span>
                </div>
                <div className="mdm-stat">
                    <span className="mdm-stat-label">{t('mortgageTab.projectedPayoff')}</span>
                    <span className="mdm-stat-value mdm-small">{mortgage.projected_payoff_date || '—'}</span>
                </div>
            </div>

            {mortgage.total_interest_lifetime && (
                <div className="mdm-lifetime">
                    <span className="mdm-stat-label">{t('mortgageTab.totalInterestLifetime')}</span>
                    <span className="mdm-stat-value mdm-amber">{formatCurrency(mortgage.total_interest_lifetime, curr)}</span>
                </div>
            )}

            <div className="mdm-actions">
                <button className="mdm-action-btn mdm-action-primary" onClick={onAddEvent}>
                    <Plus size={16} />
                    <span>{t('mortgageTab.addEvent')}</span>
                </button>
                <button className="mdm-action-btn mdm-action-secondary" onClick={onEditMortgage}>
                    <Edit3 size={16} />
                    <span>{t('mortgageTab.editMortgage')}</span>
                </button>
            </div>

            <button
                className="mdm-delete-btn"
                onClick={handleDelete}
                disabled={deleting}
                onBlur={() => setConfirmDelete(false)}
            >
                <Trash2 size={16} />
                <span>{deleting ? t('mortgageTab.deletingMortgage') : confirmDelete ? t('mortgageTab.clickAgainToConfirm') : t('mortgageTab.deleteMortgage')}</span>
            </button>

            <div className="mdm-history">
                <h4 className="mdm-section-title">
                    <History size={15} />
                    <span>{t('mortgageTab.history')}</span>
                </h4>
                {events.length === 0 ? (
                    <p className="mdm-no-events">{t('mortgageTab.noEvents')}</p>
                ) : (
                    <div className="mdm-timeline">
                        {events.map((ev, idx) => {
                            const Icon = EVENT_ICONS[ev.event_type] || History;
                            const color = EVENT_COLORS[ev.event_type] || '#8b5cf6';
                            return (
                                <div key={ev.id} className="mdm-tl-item" onClick={() => onEditEvent(ev)}>
                                    <div className="mdm-tl-dot" style={{ background: color }}>
                                        <Icon size={12} color="white" />
                                    </div>
                                    {idx < events.length - 1 && <div className="mdm-tl-line" />}
                                    <div className="mdm-tl-content">
                                        <div className="mdm-tl-header">
                                            <span className="mdm-tl-type" style={{ color }}>
                                                {EVENT_LABEL_KEYS[ev.event_type] ? t(EVENT_LABEL_KEYS[ev.event_type]) : ev.event_type}
                                            </span>
                                            <span className="mdm-tl-date">{ev.event_date}</span>
                                        </div>
                                        <span className="mdm-tl-detail">{formatEventDetail(ev)}</span>
                                        {ev.note && <span className="mdm-tl-note">{ev.note}</span>}
                                    </div>
                                    <ChevronRight size={14} className="mdm-tl-chevron" />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {payments.length > 0 && (
                <div className="mdm-payments-section">
                    <h4 className="mdm-section-title">
                        <CreditCard size={15} />
                        <span>{t('mortgageTab.confirmedPayments')}</span>
                    </h4>
                    <div className="mdm-payments-list">
                        {payments.map((p) => (
                            <div key={p.id} className="mdm-payment-item">
                                <div className="mdm-payment-month">{p.month}</div>
                                <div className="mdm-payment-details">
                                    <span className="mdm-payment-amount">
                                        {formatCurrency(p.paid_amount, curr)}
                                    </span>
                                    {p.principal_portion && (
                                        <span className="mdm-payment-split">
                                            {t('mortgageTab.principal')}: {formatCurrency(p.principal_portion, curr)}
                                            {' / '}
                                            {t('mortgageTab.interest')}: {formatCurrency(p.interest_portion, curr)}
                                        </span>
                                    )}
                                </div>
                                <button
                                    className="mdm-payment-remove"
                                    onClick={() => {
                                        deleteMortgagePayment(mortgage.id, p.id).then(() => {
                                            window.dispatchEvent(new Event('mortgages-updated'));
                                        }).catch(() => addToast(t('mortgageTab.removePaymentFailed'), 'error'));
                                    }}
                                    title={t('mortgageTab.removeConfirmation')}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

// ────────────────────────────────────────────────────────────
// Sub-view: Edit Mortgage (inline form)
// ────────────────────────────────────────────────────────────
function EditMortgageView({ mortgage, onDone, onDeleted }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [properties, setProperties] = useState([]);
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        name: mortgage.name || '',
        original_amount: mortgage.original_amount ?? '',
        interest_rate: mortgage.interest_rate ?? '',
        term_months: mortgage.term_months ?? '',
        monthly_payment: mortgage.monthly_payment ?? '',
        start_date: mortgage.start_date || '',
        extra_payments: mortgage.extra_payments ?? '0',
        property_id: mortgage.property_id ?? '',
        category_id: mortgage.category_id ?? '',
        currency: mortgage.currency || 'CZK',
        fix_end_date: mortgage.fix_end_date || '',
        balance_override: mortgage.balance_override ?? '',
    });

    useEffect(() => {
        getPropertyInvestments().then(setProperties).catch(() => {});
        getCategories()
            .then(cats => setCategories(cats.filter(c => c.section === 'fixed')))
            .catch(() => {});
    }, []);

    const computePayment = () => {
        const P = Number(formData.original_amount);
        const annualRate = Number(formData.interest_rate);
        const n = Number(formData.term_months);
        if (!P || !annualRate || !n) return;
        const r = annualRate / 100 / 12;
        const payment = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        setFormData(prev => ({ ...prev, monthly_payment: Math.round(payment * 100) / 100 }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                name: formData.name,
                original_amount: Number(formData.original_amount),
                interest_rate: Number(formData.interest_rate),
                term_months: Number(formData.term_months),
                monthly_payment: Number(formData.monthly_payment),
                start_date: formData.start_date,
                extra_payments: Number(formData.extra_payments || 0),
                property_id: formData.property_id ? Number(formData.property_id) : null,
                category_id: formData.category_id ? Number(formData.category_id) : null,
                currency: formData.currency,
                fix_end_date: formData.fix_end_date || null,
                balance_override: formData.balance_override !== '' ? Number(formData.balance_override) : null,
            };
            await updateMortgage(mortgage.id, payload);
            window.dispatchEvent(new Event('mortgages-updated'));
            onDone();
        } catch (err) {
            console.error('Error saving mortgage:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteMortgage(mortgage.id);
            window.dispatchEvent(new Event('mortgages-updated'));
            onDeleted();
        } catch (err) {
            console.error('Error deleting mortgage:', err);
        } finally {
            setDeleting(false);
        }
    };

    const currSymbol = CURRENCY_SYMBOLS[formData.currency] || formData.currency;
    const termYears = formData.term_months ? Math.floor(Number(formData.term_months) / 12) : 0;
    const termRemMonths = formData.term_months ? Number(formData.term_months) % 12 : 0;

    return (
        <form onSubmit={handleSubmit} className="mdm-form">
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.mortgageName')}</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.currency')}</label>
                <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}>
                    {POPULAR_CURRENCIES.map(c => <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c] || c})</option>)}
                </select>
            </div>
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.originalLoanAmount', { symbol: currSymbol })}</label>
                <input type="number" step="0.01" value={formData.original_amount} onChange={e => setFormData({ ...formData, original_amount: e.target.value })} required />
            </div>
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.annualInterestRate')}</label>
                <input type="number" step="0.001" value={formData.interest_rate} onChange={e => setFormData({ ...formData, interest_rate: e.target.value })} required />
            </div>
            <div className="mdm-form-group">
                <label>
                    {t('mortgageEditor.termMonths')}
                    {termYears > 0 && <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 8 }}>= {termYears}y {termRemMonths > 0 ? `${termRemMonths}m` : ''}</span>}
                </label>
                <input type="number" min="1" value={formData.term_months} onChange={e => setFormData({ ...formData, term_months: e.target.value })} required />
            </div>
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.monthlyPaymentWithSymbol', { symbol: currSymbol })}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="number" step="0.01" value={formData.monthly_payment} onChange={e => setFormData({ ...formData, monthly_payment: e.target.value })} required style={{ flex: 1 }} />
                    <button type="button" className="mdm-calc-btn" onClick={computePayment} title={t('mortgageEditor.calculateTooltip')}><Calculator size={16} /></button>
                </div>
            </div>
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.startDate')}</label>
                <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} required />
            </div>
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.fixedRateEndDate')} <span className="mdm-form-hint">({t('mortgageEditor.optional')})</span></label>
                <input type="date" value={formData.fix_end_date} onChange={e => setFormData({ ...formData, fix_end_date: e.target.value })} />
            </div>
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.extraPaymentsMade', { symbol: currSymbol })}</label>
                <input type="number" step="0.01" value={formData.extra_payments} onChange={e => setFormData({ ...formData, extra_payments: e.target.value })} />
            </div>
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.balanceOverride', { symbol: currSymbol })} <span className="mdm-form-hint">{t('mortgageTab.manuallySetRemaining')}</span></label>
                <input type="number" step="0.01" placeholder={t('mortgageEditor.autoCalculatePlaceholder')} value={formData.balance_override} onChange={e => setFormData({ ...formData, balance_override: e.target.value })} />
            </div>
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.linkedProperty')}</label>
                <select value={formData.property_id} onChange={e => setFormData({ ...formData, property_id: e.target.value })}>
                    <option value="">{t('mortgageEditor.none')}</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.category')}</label>
                <select value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })}>
                    <option value="">{t('mortgageEditor.none')}</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <button type="submit" className="mdm-action-btn mdm-action-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                <span>{t('mortgageEditor.updateMortgage')}</span>
            </button>
            <button type="button" className="mdm-delete-btn" onClick={handleDelete} disabled={deleting}>
                <Trash2 size={16} />
                <span>{deleting ? t('mortgageEditor.deleting') : t('mortgageEditor.deleteMortgage')}</span>
            </button>
        </form>
    );
}

// ────────────────────────────────────────────────────────────
// Sub-view: Add / Edit Event (inline form)
// ────────────────────────────────────────────────────────────
function EventFormView({ event, mortgageId, currency, onDone }) {
    const { t } = useTranslation();
    const isEdit = !!event;
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        event_type: event?.event_type || 'extra_payment',
        event_date: event?.event_date || new Date().toISOString().slice(0, 10),
        amount: event?.amount ?? '',
        old_rate: event?.old_rate ?? '',
        new_rate: event?.new_rate ?? '',
        old_payment: event?.old_payment ?? '',
        new_payment: event?.new_payment ?? '',
        new_balance: event?.new_balance ?? '',
        new_fix_end_date: event?.new_fix_end_date ?? '',
        note: event?.note ?? '',
    });

    const currSymbol = CURRENCY_SYMBOLS[currency] || currency;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const payload = { event_type: formData.event_type, event_date: formData.event_date, note: formData.note || null };
            if (formData.event_type === 'extra_payment') payload.amount = Number(formData.amount);
            else if (formData.event_type === 'rate_change') {
                payload.old_rate = formData.old_rate ? Number(formData.old_rate) : null;
                payload.new_rate = Number(formData.new_rate);
                payload.new_fix_end_date = formData.new_fix_end_date || null;
            } else if (formData.event_type === 'payment_change') {
                payload.old_payment = formData.old_payment ? Number(formData.old_payment) : null;
                payload.new_payment = Number(formData.new_payment);
            } else if (formData.event_type === 'balance_override') payload.new_balance = Number(formData.new_balance);
            else if (formData.event_type === 'fix_period_change') payload.new_fix_end_date = formData.new_fix_end_date || null;

            if (isEdit) await updateMortgageEvent(event.id, payload);
            else await createMortgageEvent(mortgageId, payload);

            window.dispatchEvent(new Event('mortgages-updated'));
            window.dispatchEvent(new Event('mortgage-events-updated'));
            onDone();
        } catch (err) {
            console.error('Error saving event:', err);
            const msg = err?.response?.data?.detail || err?.message || 'Failed to save event';
            setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!event?.id) return;
        setDeleting(true);
        try {
            await deleteMortgageEvent(event.id);
            window.dispatchEvent(new Event('mortgages-updated'));
            window.dispatchEvent(new Event('mortgage-events-updated'));
            onDone();
        } catch (err) {
            console.error('Error deleting event:', err);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mdm-form">
            {error && <div className="mdm-error">{error}</div>}
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.eventType')}</label>
                <select value={formData.event_type} onChange={e => setFormData({ ...formData, event_type: e.target.value })} disabled={isEdit}>
                    {EVENT_TYPE_KEYS.map(et => <option key={et.value} value={et.value}>{t(et.labelKey)}</option>)}
                </select>
            </div>
            <div className="mdm-form-group">
                <label>{t('mortgageEditor.date')}</label>
                <input type="date" value={formData.event_date} onChange={e => setFormData({ ...formData, event_date: e.target.value })} required />
            </div>

            {formData.event_type === 'extra_payment' && (
                <div className="mdm-form-group">
                    <label>{t('mortgageEditor.amount', { symbol: currSymbol })}</label>
                    <input type="number" step="0.01" placeholder="100000" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required />
                </div>
            )}
            {formData.event_type === 'rate_change' && (
                <>
                    <div className="mdm-form-group">
                        <label>{t('mortgageEditor.oldRate')}</label>
                        <input type="number" step="0.001" value={formData.old_rate} onChange={e => setFormData({ ...formData, old_rate: e.target.value })} />
                    </div>
                    <div className="mdm-form-group">
                        <label>{t('mortgageEditor.newRate')}</label>
                        <input type="number" step="0.001" value={formData.new_rate} onChange={e => setFormData({ ...formData, new_rate: e.target.value })} required />
                    </div>
                    <div className="mdm-form-group">
                        <label>{t('mortgageEditor.newFixationEndDate')} <span className="mdm-form-hint">({t('mortgageEditor.optional')})</span></label>
                        <input type="date" value={formData.new_fix_end_date} onChange={e => setFormData({ ...formData, new_fix_end_date: e.target.value })} />
                    </div>
                </>
            )}
            {formData.event_type === 'payment_change' && (
                <>
                    <div className="mdm-form-group">
                        <label>{t('mortgageEditor.oldMonthlyPayment', { symbol: currSymbol })}</label>
                        <input type="number" step="0.01" value={formData.old_payment} onChange={e => setFormData({ ...formData, old_payment: e.target.value })} />
                    </div>
                    <div className="mdm-form-group">
                        <label>{t('mortgageEditor.newMonthlyPayment', { symbol: currSymbol })}</label>
                        <input type="number" step="0.01" value={formData.new_payment} onChange={e => setFormData({ ...formData, new_payment: e.target.value })} required />
                    </div>
                </>
            )}
            {formData.event_type === 'balance_override' && (
                <div className="mdm-form-group">
                    <label>{t('mortgageEditor.correctedBalance', { symbol: currSymbol })}</label>
                    <input type="number" step="0.01" value={formData.new_balance} onChange={e => setFormData({ ...formData, new_balance: e.target.value })} required />
                </div>
            )}
            {formData.event_type === 'fix_period_change' && (
                <div className="mdm-form-group">
                    <label>{t('mortgageEditor.newFixEndDate')}</label>
                    <input type="date" value={formData.new_fix_end_date} onChange={e => setFormData({ ...formData, new_fix_end_date: e.target.value })} required />
                </div>
            )}

            <div className="mdm-form-group">
                <label>{t('mortgageEditor.note')} <span className="mdm-form-hint">({t('mortgageEditor.optional')})</span></label>
                <input type="text" placeholder={t('mortgageEditor.notePlaceholder')} value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} />
            </div>

            <button type="submit" className="mdm-action-btn mdm-action-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                <span>{isEdit ? t('mortgageEditor.updateEvent') : t('mortgageEditor.saveEvent')}</span>
            </button>
            {isEdit && (
                <button type="button" className="mdm-delete-btn" onClick={handleDelete} disabled={deleting}>
                    <Trash2 size={16} />
                    <span>{deleting ? t('mortgageEditor.deleting') : t('mortgageEditor.deleteEvent')}</span>
                </button>
            )}
        </form>
    );
}

// ────────────────────────────────────────────────────────────
// Main modal
// ────────────────────────────────────────────────────────────
export function MortgageDetailModal({ mortgageId, onClose }) {
    const { t } = useTranslation();
    const [mortgage, setMortgage] = useState(null);
    const [events, setEvents] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    // subView: null = detail, { type: 'edit-mortgage' }, { type: 'add-event' }, { type: 'edit-event', event }
    const [subView, setSubView] = useState(null);

    const fetchData = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const [m, evts, pmts] = await Promise.all([
                getMortgage(mortgageId),
                getMortgageEvents(mortgageId),
                getMortgagePayments(mortgageId),
            ]);
            setMortgage(m);
            setEvents(evts);
            setPayments(pmts);
        } catch (err) {
            console.error('Error fetching mortgage detail:', err);
        } finally {
            setLoading(false);
        }
    }, [mortgageId]);

    useEffect(() => {
        fetchData();
        const handler = () => fetchData(false);
        window.addEventListener('mortgages-updated', handler);
        window.addEventListener('mortgage-events-updated', handler);
        return () => {
            window.removeEventListener('mortgages-updated', handler);
            window.removeEventListener('mortgage-events-updated', handler);
        };
    }, [fetchData]);

    const curr = mortgage?.currency || 'CZK';

    const goBack = () => setSubView(null);

    const getTitle = () => {
        if (!subView) return mortgage?.name || t('mortgageTab.mortgage');
        if (subView.type === 'edit-mortgage') return t('mortgageEditor.editMortgage');
        if (subView.type === 'add-event') return t('mortgageTab.addEvent');
        if (subView.type === 'edit-event') return t('mortgageEditor.editEvent');
        return t('mortgageTab.mortgage');
    };

    const getSubtitle = () => {
        if (!subView && mortgage) {
            return `${curr} · ${Number(mortgage.interest_rate).toFixed(2)}%${mortgage.fix_end_date ? ` · ${t('mortgageTab.fixedUntilSubtitle', { date: mortgage.fix_end_date })}` : ''}`;
        }
        return mortgage?.name || '';
    };

    return (
        <div className="mdm-overlay" onClick={onClose}>
            <div className="mdm-modal" onClick={e => e.stopPropagation()}>
                <div className="mdm-header">
                    <div className="mdm-header-left">
                        {subView && (
                            <button className="mdm-back" onClick={goBack}>
                                <ArrowLeft size={16} />
                            </button>
                        )}
                        <div>
                            <h2>{getTitle()}</h2>
                            <span className="mdm-header-sub">{getSubtitle()}</span>
                        </div>
                    </div>
                    <button className="mdm-close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="mdm-body">
                    {loading ? (
                        <SkeletonLoader variant="list-item" count={4} />
                    ) : !mortgage ? (
                        <p className="mdm-empty">{t('mortgageTab.mortgageNotFound')}</p>
                    ) : !subView ? (
                        <DetailView
                            mortgage={mortgage}
                            events={events}
                            payments={payments}
                            curr={curr}
                            onEditMortgage={() => setSubView({ type: 'edit-mortgage' })}
                            onAddEvent={() => setSubView({ type: 'add-event' })}
                            onEditEvent={(ev) => setSubView({ type: 'edit-event', event: ev })}
                            onDelete={onClose}
                        />
                    ) : subView.type === 'edit-mortgage' ? (
                        <EditMortgageView
                            mortgage={mortgage}
                            onDone={goBack}
                            onDeleted={onClose}
                        />
                    ) : subView.type === 'add-event' ? (
                        <EventFormView
                            mortgageId={mortgageId}
                            currency={curr}
                            onDone={goBack}
                        />
                    ) : subView.type === 'edit-event' ? (
                        <EventFormView
                            event={subView.event}
                            mortgageId={mortgageId}
                            currency={curr}
                            onDone={goBack}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
