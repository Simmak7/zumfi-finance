import React, { useState } from 'react';
import { X, Save, Loader2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { createStockHolding } from '../../../services/api';
import { useTranslation } from '../../../i18n';
import '../../dashboard/components/CategoryTransactionsModal.css';

const PRESET_COLORS = ['#0ea5e9', '#3b82f6', '#6366f1', '#a855f7', '#f59e0b', '#ef4444', '#10b981', '#64748b'];
const CURRENCIES = ['CZK', 'EUR', 'USD'];
const TYPES = [
    { value: 'stock', label: 'Stock' },
    { value: 'etf', label: 'ETF' },
];

export function AddStockModal({ onClose, onSuccess }) {
    const { addToast } = useToast();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '', ticker: '', holding_type: 'stock',
        shares: '', avg_cost_per_share: '', current_price: '',
        currency: 'USD', notes: '', color: PRESET_COLORS[0],
    });

    const update = (field, value) => setFormData({ ...formData, [field]: value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createStockHolding({
                ...formData,
                shares: Number(formData.shares),
                avg_cost_per_share: Number(formData.avg_cost_per_share),
                current_price: formData.current_price !== '' ? Number(formData.current_price) : null,
            });
            window.dispatchEvent(new Event('portfolio-updated'));
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error("Error saving stock:", err);
            addToast(t('portfolioForm.failedToSave'), "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ctm-overlay" onClick={onClose}>
            <div className="ctm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                <div className="ctm-header">
                    <div className="ctm-header-title">
                        <h2>{t('portfolioForm.addStockHolding')}</h2>
                    </div>
                    <button className="mcw-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="ctm-body">
                    <button
                        className="portfolio-add-btn stock"
                        style={{ width: '100%', justifyContent: 'center', marginBottom: '1.25rem' }}
                        onClick={() => { onClose(); navigate('/import'); }}
                    >
                        <Upload size={16} />
                        <span>Import Stock Portfolio</span>
                    </button>

                    <form onSubmit={handleSubmit} className="portfolio-form" style={{ padding: 0 }}>
                        <div className="form-group">
                            <label>{t('portfolioForm.name')}</label>
                            <input type="text" placeholder="e.g. Apple Inc." value={formData.name}
                                onChange={e => update('name', e.target.value)} required />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('portfolioForm.ticker')}</label>
                                <input type="text" placeholder="e.g. AAPL" value={formData.ticker}
                                    onChange={e => update('ticker', e.target.value)} />
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
                                <input type="number" step="any" placeholder="100" value={formData.shares}
                                    onChange={e => update('shares', e.target.value)} required />
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
                            <input type="number" step="any" placeholder="150.00" value={formData.avg_cost_per_share}
                                onChange={e => update('avg_cost_per_share', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>{t('portfolioForm.currentPricePerShare')}</label>
                            <input type="number" step="any" placeholder="175.00" value={formData.current_price}
                                onChange={e => update('current_price', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>{t('portfolioForm.color')}</label>
                            <div className="color-picker">
                                {PRESET_COLORS.map(c => (
                                    <div key={c} className={`color-swatch ${formData.color === c ? 'selected' : ''}`}
                                        style={{ background: c }} onClick={() => update('color', c)} />
                                ))}
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="save-btn" disabled={loading}>
                                {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                                <span>{t('portfolioForm.save')}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
