import React, { useState } from 'react';
import { Save, Trash2, Loader2 } from 'lucide-react';
import { useInspector } from '../../../context/InspectorContext';
import { useToast } from '../../../context/ToastContext';
import { createStockHolding, updateStockHolding, deleteStockHolding } from '../../../services/api';
import { formatMoney } from '../../../utils/currencies';
import { useTranslation } from '../../../i18n';

const PRESET_COLORS = ['#0ea5e9', '#3b82f6', '#6366f1', '#a855f7', '#f59e0b', '#ef4444', '#10b981', '#64748b'];
const CURRENCIES = ['CZK', 'EUR', 'USD'];
const TYPES = [
    { value: 'stock', label: 'Stock' },
    { value: 'etf', label: 'ETF' },
];

export function StockHoldingForm({ stock, onSuccess }) {
    const { closeInspector } = useInspector();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const isEdit = !!stock;
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: stock?.name || '',
        ticker: stock?.ticker || '',
        holding_type: stock?.holding_type || 'stock',
        shares: stock?.shares ?? '',
        avg_cost_per_share: stock?.avg_cost_per_share ?? '',
        current_price: stock?.current_price ?? '',
        currency: stock?.currency || 'CZK',
        notes: stock?.notes || '',
        color: stock?.color || PRESET_COLORS[0],
    });

    // Compute live metrics
    const shares = Number(formData.shares) || 0;
    const avgCost = Number(formData.avg_cost_per_share) || 0;
    const curPrice = formData.current_price !== '' ? Number(formData.current_price) : null;
    const totalCost = shares * avgCost;
    const marketValue = curPrice != null ? shares * curPrice : null;
    const gainLoss = marketValue != null ? marketValue - totalCost : null;
    const gainPct = gainLoss != null && totalCost > 0 ? (gainLoss / totalCost) * 100 : null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                shares: Number(formData.shares),
                avg_cost_per_share: Number(formData.avg_cost_per_share),
                current_price: formData.current_price !== '' ? Number(formData.current_price) : null,
            };
            if (isEdit) {
                await updateStockHolding(stock.id, payload);
            } else {
                await createStockHolding(payload);
            }
            window.dispatchEvent(new Event('portfolio-updated'));
            if (onSuccess) onSuccess();
            closeInspector();
        } catch (err) {
            console.error("Error saving stock holding:", err);
            addToast(t('portfolioForm.failedToSave'), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('portfolioForm.deleteStockHolding'))) return;
        setLoading(true);
        try {
            await deleteStockHolding(stock.id);
            window.dispatchEvent(new Event('portfolio-updated'));
            closeInspector();
        } catch (err) {
            console.error("Error deleting stock holding:", err);
            addToast(t('portfolioForm.failedToDelete'), "error");
        } finally {
            setLoading(false);
        }
    };

    const update = (field, value) => setFormData({ ...formData, [field]: value });

    return (
        <div className="portfolio-form">
            <h3>{isEdit ? t('portfolioForm.editStockHolding') : t('portfolioForm.addStockHolding')}</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>{t('portfolioForm.name')}</label>
                    <input
                        type="text"
                        placeholder="e.g. Apple Inc."
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
                            placeholder="e.g. AAPL"
                            value={formData.ticker}
                            onChange={e => update('ticker', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('portfolioForm.type')}</label>
                        <select value={formData.holding_type} onChange={e => update('holding_type', e.target.value)}>
                            {TYPES.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>{t('portfolioForm.shares')}</label>
                        <input
                            type="number"
                            step="any"
                            placeholder="100"
                            value={formData.shares}
                            onChange={e => update('shares', e.target.value)}
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
                    <label>{t('portfolioForm.avgCostPerShare')}</label>
                    <input
                        type="number"
                        step="any"
                        placeholder="150.00"
                        value={formData.avg_cost_per_share}
                        onChange={e => update('avg_cost_per_share', e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>{t('portfolioForm.currentPricePerShare')}</label>
                    <input
                        type="number"
                        step="any"
                        placeholder="175.00"
                        value={formData.current_price}
                        onChange={e => update('current_price', e.target.value)}
                    />
                </div>

                {totalCost > 0 && (
                    <div className="computed-metrics">
                        <div className="metric-row">
                            <span>{t('portfolioForm.totalCost')}</span>
                            <span>{formatMoney(totalCost)} {formData.currency}</span>
                        </div>
                        {marketValue != null && (
                            <>
                                <div className="metric-row">
                                    <span>{t('portfolioForm.marketValue')}</span>
                                    <span>{formatMoney(marketValue)} {formData.currency}</span>
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
