import React, { useState } from 'react';
import { Save, Trash2, Loader2 } from 'lucide-react';
import { useInspector } from '../../../context/InspectorContext';
import { useToast } from '../../../context/ToastContext';
import { createInvestment, updateInvestment, deleteInvestment } from '../../../services/api';
import { formatMoney } from '../../../utils/currencies';
import { useTranslation } from '../../../i18n';

const PRESET_COLORS = ['#6366f1', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#10b981', '#64748b'];
const CURRENCIES = ['CZK', 'EUR', 'USD'];
const TYPES = [
    { value: 'etf', label: 'ETF' },
    { value: 'stock', label: 'Stock' },
    { value: 'bond', label: 'Bond' },
    { value: 'crypto', label: 'Crypto' },
    { value: 'other', label: 'Other' },
];

export function InvestmentForm({ investment, onSuccess }) {
    const { closeInspector } = useInspector();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const isEdit = !!investment;
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: investment?.name || '',
        ticker: investment?.ticker || '',
        investment_type: investment?.investment_type || 'etf',
        units: investment?.units ?? '',
        avg_purchase_price: investment?.avg_purchase_price ?? '',
        current_price: investment?.current_price ?? '',
        currency: investment?.currency || 'USD',
        notes: investment?.notes || '',
        color: investment?.color || PRESET_COLORS[0],
    });

    // Compute live metrics
    const units = Number(formData.units) || 0;
    const avgPrice = Number(formData.avg_purchase_price) || 0;
    const curPrice = formData.current_price !== '' ? Number(formData.current_price) : null;
    const totalInvested = units * avgPrice;
    const currentValue = curPrice != null ? units * curPrice : null;
    const gainLoss = currentValue != null ? currentValue - totalInvested : null;
    const gainPct = gainLoss != null && totalInvested > 0 ? (gainLoss / totalInvested) * 100 : null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                units: Number(formData.units),
                avg_purchase_price: Number(formData.avg_purchase_price),
                current_price: formData.current_price !== '' ? Number(formData.current_price) : null,
            };
            if (isEdit) {
                await updateInvestment(investment.id, payload);
            } else {
                await createInvestment(payload);
            }
            window.dispatchEvent(new Event('portfolio-updated'));
            if (onSuccess) onSuccess();
            closeInspector();
        } catch (err) {
            console.error("Error saving investment:", err);
            addToast(t('portfolioForm.failedToSave'), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('portfolioForm.deleteInvestment'))) return;
        setLoading(true);
        try {
            await deleteInvestment(investment.id);
            window.dispatchEvent(new Event('portfolio-updated'));
            closeInspector();
        } catch (err) {
            console.error("Error deleting investment:", err);
            addToast(t('portfolioForm.failedToDelete'), "error");
        } finally {
            setLoading(false);
        }
    };

    const update = (field, value) => setFormData({ ...formData, [field]: value });

    return (
        <div className="portfolio-form">
            <h3>{isEdit ? t('portfolioForm.editInvestment') : t('portfolioForm.addInvestment')}</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>{t('portfolioForm.name')}</label>
                    <input
                        type="text"
                        placeholder="e.g. Vanguard S&P 500"
                        value={formData.name}
                        onChange={e => update('name', e.target.value)}
                        required
                    />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>{t('portfolioForm.ticker')}</label>
                        <input
                            type="text"
                            placeholder="e.g. VOO"
                            value={formData.ticker}
                            onChange={e => update('ticker', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('portfolioForm.type')}</label>
                        <select value={formData.investment_type} onChange={e => update('investment_type', e.target.value)}>
                            {TYPES.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>{t('portfolioForm.units')}</label>
                        <input
                            type="number"
                            step="any"
                            placeholder="50"
                            value={formData.units}
                            onChange={e => update('units', e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group form-group-small">
                        <label>{t('portfolioForm.currency')}</label>
                        <select value={formData.currency} onChange={e => update('currency', e.target.value)}>
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
                <div className="form-group">
                    <label>{t('portfolioForm.avgPurchasePrice')}</label>
                    <input
                        type="number"
                        step="any"
                        placeholder="430.00"
                        value={formData.avg_purchase_price}
                        onChange={e => update('avg_purchase_price', e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>{t('portfolioForm.currentPricePerUnit')}</label>
                    <input
                        type="number"
                        step="any"
                        placeholder="450.00"
                        value={formData.current_price}
                        onChange={e => update('current_price', e.target.value)}
                    />
                </div>

                {/* Live computed metrics */}
                {totalInvested > 0 && (
                    <div className="computed-metrics">
                        <div className="metric-row">
                            <span>{t('portfolioForm.totalInvested')}</span>
                            <span>{formatMoney(totalInvested)} {formData.currency}</span>
                        </div>
                        {currentValue != null && (
                            <>
                                <div className="metric-row">
                                    <span>{t('portfolioForm.currentValue')}</span>
                                    <span>{formatMoney(currentValue)} {formData.currency}</span>
                                </div>
                                <div className={`metric-row ${gainLoss >= 0 ? 'positive' : 'negative'}`}>
                                    <span>{t('portfolio.gainLoss')}</span>
                                    <span>
                                        {gainLoss >= 0 ? '+' : ''}{formatMoney(gainLoss)} ({gainPct?.toFixed(1)}%)
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div className="form-group">
                    <label>{t('portfolioForm.notes')}</label>
                    <textarea
                        placeholder="Optional notes..."
                        value={formData.notes}
                        onChange={e => update('notes', e.target.value)}
                        rows={2}
                    />
                </div>
                <div className="form-group">
                    <label>{t('portfolioForm.color')}</label>
                    <div className="color-picker">
                        {PRESET_COLORS.map(c => (
                            <div
                                key={c}
                                className={`color-swatch ${formData.color === c ? 'selected' : ''}`}
                                style={{ background: c }}
                                onClick={() => update('color', c)}
                            />
                        ))}
                    </div>
                </div>
                <div className="form-actions">
                    <button type="submit" className="save-btn" disabled={loading}>
                        {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                        <span>{isEdit ? t('portfolioForm.update') : t('portfolioForm.save')}</span>
                    </button>
                    {isEdit && (
                        <button type="button" className="delete-btn" onClick={handleDelete} disabled={loading}>
                            <Trash2 size={18} />
                            <span>{t('portfolioForm.delete')}</span>
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
