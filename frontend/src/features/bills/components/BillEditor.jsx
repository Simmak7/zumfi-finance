import React, { useState, useEffect } from 'react';
import { useInspector } from '../../../context/InspectorContext';
import { useToast } from '../../../context/ToastContext';
import { useSettings } from '../../../context/SettingsContext';
import { addBill, updateBill, getCategories } from '../../../services/api';
import { CURRENCY_SYMBOLS } from '../../../utils/currencies';
import { Save, Loader2 } from 'lucide-react';
import { useTranslation } from '../../../i18n';
import '../../../components/GoalEditor.css';

export function BillEditor({ bill, onSuccess }) {
    const { closeInspector } = useInspector();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    const currSymbol = CURRENCY_SYMBOLS[currency] || currency;
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        name: bill?.name || '',
        expected_amount: bill?.expected_amount || '',
        frequency: bill?.frequency || 'monthly',
        due_day: bill?.due_day || '',
        category_id: bill?.category_id || '',
    });

    useEffect(() => {
        getCategories()
            .then(cats => setCategories(cats.filter(c => c.section === 'fixed')))
            .catch(() => {});
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                expected_amount: Number(formData.expected_amount),
                due_day: formData.due_day ? Number(formData.due_day) : null,
                category_id: formData.category_id ? Number(formData.category_id) : null,
            };

            if (bill?.id) {
                await updateBill(bill.id, payload);
            } else {
                await addBill(payload);
            }

            window.dispatchEvent(new Event('bills-updated'));
            if (onSuccess) onSuccess();
            closeInspector();
        } catch (err) {
            console.error("Error saving bill:", err);
            addToast(t('billEditor.saveFailed'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="goal-editor">
            <h3>{bill?.id ? t('billEditor.editBill') : t('billEditor.addRecurringBill')}</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>{t('billEditor.billName')}</label>
                    <input
                        type="text"
                        placeholder={t('billEditor.billNamePlaceholder')}
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>{t('billEditor.expectedAmount', { symbol: currSymbol })}</label>
                    <input
                        type="number"
                        step="0.01"
                        placeholder="15000"
                        value={formData.expected_amount}
                        onChange={e => setFormData({ ...formData, expected_amount: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>{t('billEditor.frequency')}</label>
                    <select
                        value={formData.frequency}
                        onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                    >
                        <option value="monthly">{t('billEditor.monthly')}</option>
                        <option value="quarterly">{t('billEditor.quarterly')}</option>
                        <option value="yearly">{t('billEditor.yearly')}</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>{t('billEditor.dueDay')}</label>
                    <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="1"
                        value={formData.due_day}
                        onChange={e => setFormData({ ...formData, due_day: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label>{t('billEditor.category')}</label>
                    <select
                        value={formData.category_id}
                        onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                    >
                        <option value="">{t('billEditor.none')}</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <button type="submit" className="save-btn" disabled={loading}>
                    {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                    <span>{bill?.id ? t('billEditor.updateBill') : t('billEditor.saveBill')}</span>
                </button>
            </form>
        </div>
    );
}
