import React, { useState, useEffect } from 'react';
import { useInspector } from '../../../context/InspectorContext';
import {
    createMortgage, updateMortgage, deleteMortgage,
    getPropertyInvestments, getCategories,
} from '../../../services/api';
import { CURRENCY_SYMBOLS } from '../../../utils/currencies';
import { useToast } from '../../../context/ToastContext';
import { Save, Loader2, Trash2, Calculator } from 'lucide-react';
import { useTranslation } from '../../../i18n';
import '../../../components/GoalEditor.css';

const POPULAR_CURRENCIES = ['CZK', 'EUR', 'GBP', 'USD', 'PLN', 'HUF', 'CHF', 'SEK', 'NOK', 'DKK'];

export function MortgageEditor({ mortgage, onSuccess, onClose }) {
    const { closeInspector } = useInspector();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const close = onClose || closeInspector;
    const isEdit = !!mortgage;
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [properties, setProperties] = useState([]);
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        name: mortgage?.name || '',
        original_amount: mortgage?.original_amount ?? '',
        interest_rate: mortgage?.interest_rate ?? '',
        term_months: mortgage?.term_months ?? '',
        monthly_payment: mortgage?.monthly_payment ?? '',
        start_date: mortgage?.start_date || '',
        extra_payments: mortgage?.extra_payments ?? '0',
        property_id: mortgage?.property_id ?? '',
        category_id: mortgage?.category_id ?? '',
        currency: mortgage?.currency || 'CZK',
        fix_end_date: mortgage?.fix_end_date || '',
        balance_override: mortgage?.balance_override ?? '',
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
        setFormData(prev => ({
            ...prev,
            monthly_payment: Math.round(payment * 100) / 100,
        }));
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

            if (isEdit) {
                await updateMortgage(mortgage.id, payload);
            } else {
                await createMortgage(payload);
            }

            window.dispatchEvent(new Event('mortgages-updated'));
            if (onSuccess) onSuccess();
            close();
        } catch (err) {
            console.error('Error saving mortgage:', err);
            addToast(t('mortgageEditor.saveFailed'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!mortgage?.id) return;
        setDeleting(true);
        try {
            await deleteMortgage(mortgage.id);
            window.dispatchEvent(new Event('mortgages-updated'));
            if (onSuccess) onSuccess();
            close();
        } catch (err) {
            console.error('Error deleting mortgage:', err);
            addToast(t('mortgageEditor.deleteFailed'), 'error');
        } finally {
            setDeleting(false);
        }
    };

    const currSymbol = CURRENCY_SYMBOLS[formData.currency] || formData.currency;
    const termYears = formData.term_months ? Math.floor(Number(formData.term_months) / 12) : 0;
    const termRemMonths = formData.term_months ? Number(formData.term_months) % 12 : 0;

    return (
        <div className="goal-editor">
            <h3>{isEdit ? t('mortgageEditor.editMortgage') : t('mortgageEditor.addMortgage')}</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>{t('mortgageEditor.mortgageName')}</label>
                    <input
                        type="text"
                        placeholder={t('mortgageEditor.mortgageNamePlaceholder')}
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>{t('mortgageEditor.currency')}</label>
                    <select
                        value={formData.currency}
                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    >
                        {POPULAR_CURRENCIES.map(c => (
                            <option key={c} value={c}>
                                {c} ({CURRENCY_SYMBOLS[c] || c})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>{t('mortgageEditor.originalLoanAmount', { symbol: currSymbol })}</label>
                    <input
                        type="number"
                        step="0.01"
                        placeholder="3000000"
                        value={formData.original_amount}
                        onChange={e => setFormData({ ...formData, original_amount: e.target.value })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>{t('mortgageEditor.annualInterestRate')}</label>
                    <input
                        type="number"
                        step="0.001"
                        placeholder="5.29"
                        value={formData.interest_rate}
                        onChange={e => setFormData({ ...formData, interest_rate: e.target.value })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>
                        {t('mortgageEditor.termMonths')}
                        {termYears > 0 && (
                            <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 8 }}>
                                = {termYears}y {termRemMonths > 0 ? `${termRemMonths}m` : ''}
                            </span>
                        )}
                    </label>
                    <input
                        type="number"
                        min="1"
                        placeholder="360"
                        value={formData.term_months}
                        onChange={e => setFormData({ ...formData, term_months: e.target.value })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>{t('mortgageEditor.monthlyPaymentWithSymbol', { symbol: currSymbol })}</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="16750"
                            value={formData.monthly_payment}
                            onChange={e => setFormData({ ...formData, monthly_payment: e.target.value })}
                            required
                            style={{ flex: 1 }}
                        />
                        <button
                            type="button"
                            className="autofill-btn"
                            onClick={computePayment}
                            title={t('mortgageEditor.calculateTooltip')}
                        >
                            <Calculator size={16} />
                        </button>
                    </div>
                </div>

                <div className="form-group">
                    <label>{t('mortgageEditor.startDate')}</label>
                    <input
                        type="date"
                        value={formData.start_date}
                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>{t('mortgageEditor.fixedRateEndDate')} <span style={{ opacity: 0.4, fontWeight: 400 }}>({t('mortgageEditor.optional')})</span></label>
                    <input
                        type="date"
                        value={formData.fix_end_date}
                        onChange={e => setFormData({ ...formData, fix_end_date: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label>{t('mortgageEditor.extraPaymentsMade', { symbol: currSymbol })}</label>
                    <input
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={formData.extra_payments}
                        onChange={e => setFormData({ ...formData, extra_payments: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label>
                        {t('mortgageEditor.balanceOverride', { symbol: currSymbol })}
                        <span style={{ opacity: 0.4, fontWeight: 400, marginLeft: 6 }}>
                            {t('mortgageEditor.balanceOverrideHint')}
                        </span>
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        placeholder={t('mortgageEditor.autoCalculatePlaceholder')}
                        value={formData.balance_override}
                        onChange={e => setFormData({ ...formData, balance_override: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label>{t('mortgageEditor.linkedProperty')}</label>
                    <select
                        value={formData.property_id}
                        onChange={e => setFormData({ ...formData, property_id: e.target.value })}
                    >
                        <option value="">{t('mortgageEditor.none')}</option>
                        {properties.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>{t('mortgageEditor.category')}</label>
                    <select
                        value={formData.category_id}
                        onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                    >
                        <option value="">{t('mortgageEditor.none')}</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-actions">
                    {isEdit && (
                        <button
                            type="button"
                            className="delete-btn"
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            <Trash2 size={16} />
                            <span>{deleting ? t('mortgageEditor.deleting') : t('mortgageEditor.deleteMortgage')}</span>
                        </button>
                    )}
                    <button type="submit" className="save-btn" disabled={loading}>
                        {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                        <span>{isEdit ? t('mortgageEditor.updateMortgage') : t('mortgageEditor.saveMortgage')}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
