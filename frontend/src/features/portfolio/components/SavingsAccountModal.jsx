import React, { useState } from 'react';
import { X, Save, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { createSavingsAccount, updateSavingsAccount, deleteSavingsAccount } from '../../../services/api';
import { useMonth } from '../../../context/MonthContext';
import { useTranslation } from '../../../i18n';
import '../../dashboard/components/CategoryTransactionsModal.css';

const PRESET_COLORS = ['#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#f59e0b', '#f43f5e'];
const CURRENCIES = ['CZK', 'EUR', 'USD'];

export function SavingsAccountModal({ account, onClose, onSuccess }) {
    const { addToast } = useToast();
    const { t } = useTranslation();
    const { selectedMonth } = useMonth();
    const isEdit = !!account;
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: account?.name || '',
        institution: account?.institution || '',
        balance: account?.balance ?? '',
        interest_rate: account?.interest_rate ?? '',
        currency: account?.currency || 'CZK',
        notes: account?.notes || '',
        color: account?.color || PRESET_COLORS[0],
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                balance: Number(formData.balance),
                interest_rate: formData.interest_rate !== '' ? Number(formData.interest_rate) : null,
            };
            if (isEdit) {
                await updateSavingsAccount(account.id, payload, selectedMonth);
            } else {
                await createSavingsAccount(payload);
            }
            window.dispatchEvent(new Event('portfolio-updated'));
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error("Error saving account:", err);
            addToast(t('portfolioForm.failedToSave'), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('portfolioForm.deleteSavingsAccount'))) return;
        setLoading(true);
        try {
            await deleteSavingsAccount(account.id);
            window.dispatchEvent(new Event('portfolio-updated'));
            onClose();
        } catch (err) {
            console.error("Error deleting account:", err);
            addToast(t('portfolioForm.failedToDelete'), "error");
        } finally {
            setLoading(false);
        }
    };

    const update = (field, value) => setFormData({ ...formData, [field]: value });

    return (
        <div className="ctm-overlay" onClick={onClose}>
            <div
                className="ctm-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '480px' }}
            >
                <div className="ctm-header">
                    <div className="ctm-header-title">
                        <h2>{isEdit ? t('portfolioForm.editSavingsAccount') : t('portfolioForm.addSavingsAccount')}</h2>
                    </div>
                    <button className="mcw-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ctm-body">
                    <form onSubmit={handleSubmit} className="portfolio-form" style={{ padding: 0 }}>
                        <div className="form-group">
                            <label>{t('portfolioForm.accountName')}</label>
                            <input
                                type="text"
                                placeholder="e.g. Emergency Fund"
                                value={formData.name}
                                onChange={e => update('name', e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('portfolioForm.institution')}</label>
                            <input
                                type="text"
                                placeholder="e.g. CSOB, Fio"
                                value={formData.institution}
                                onChange={e => update('institution', e.target.value)}
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('portfolioForm.balance')}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="100000"
                                    value={formData.balance}
                                    onChange={e => update('balance', e.target.value)}
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
                            <label>{t('portfolioForm.interestRateApy')}</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="4.5"
                                value={formData.interest_rate}
                                onChange={e => update('interest_rate', e.target.value)}
                            />
                        </div>
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
            </div>
        </div>
    );
}
