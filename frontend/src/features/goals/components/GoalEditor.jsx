import React, { useState } from 'react';
import { useInspector } from '../../../context/InspectorContext';
import { useToast } from '../../../context/ToastContext';
import { addGoal, updateGoal, deleteGoal } from '../../../services/api';
import { Save, Loader2, Trash2 } from 'lucide-react';
import { useSettings } from '../../../context/SettingsContext';
import { CURRENCY_SYMBOLS } from '../../../utils/currencies';
import { useTranslation } from '../../../i18n';
import '../../../components/GoalEditor.css';

const PRESET_COLORS = ['#f43f5e', '#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#fbbf24', '#f97316'];

export function GoalEditor({ goal, onSuccess }) {
    const { closeInspector } = useInspector();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const isEdit = !!goal;
    const [loading, setLoading] = useState(false);
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    const currSymbol = CURRENCY_SYMBOLS[currency] || currency;
    const [deleting, setDeleting] = useState(false);
    const [formData, setFormData] = useState({
        name: goal?.name || '',
        target_amount: goal?.target_amount ? String(goal.target_amount) : '',
        current_amount: goal?.current_amount ? String(goal.current_amount) : '0',
        color: goal?.color || PRESET_COLORS[0],
        deadline: goal?.deadline || '',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                name: formData.name,
                target_amount: Number(formData.target_amount),
                current_amount: Number(formData.current_amount),
                color: formData.color,
                deadline: formData.deadline || null,
            };
            if (isEdit) {
                await updateGoal(goal.id, payload);
            } else {
                await addGoal(payload);
            }
            window.dispatchEvent(new Event('goals-updated'));
            if (onSuccess) onSuccess();
            closeInspector();
        } catch (err) {
            console.error("Error saving goal:", err);
            addToast(t('goals.failedToSave') || "Failed to save goal", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('goals.delete') + '?')) return;
        setDeleting(true);
        try {
            await deleteGoal(goal.id);
            window.dispatchEvent(new Event('goals-updated'));
            if (onSuccess) onSuccess();
            closeInspector();
        } catch (err) {
            console.error("Error deleting goal:", err);
            addToast(t('goals.failedToDelete') || "Failed to delete goal", "error");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="goal-editor">
            <h3>{isEdit ? t('goals.editGoal') : t('goals.addGoal')}</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>{t('goals.name')}</label>
                    <input
                        type="text"
                        placeholder="e.g. New Car, Vacation"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>{t('goals.targetAmount')} ({currSymbol})</label>
                    <input
                        type="number"
                        placeholder="50000"
                        value={formData.target_amount}
                        onChange={e => setFormData({ ...formData, target_amount: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>{t('goals.currentAmount')} ({currSymbol})</label>
                    <input
                        type="number"
                        placeholder="0"
                        value={formData.current_amount}
                        onChange={e => setFormData({ ...formData, current_amount: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label>{t('goals.deadline')}</label>
                    <input
                        type="date"
                        value={formData.deadline}
                        onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label>{t('goals.colorTag') || 'Color Tag'}</label>
                    <div className="color-picker">
                        {PRESET_COLORS.map(c => (
                            <div
                                key={c}
                                className={`color-swatch ${formData.color === c ? 'selected' : ''}`}
                                style={{ background: c }}
                                onClick={() => setFormData({ ...formData, color: c })}
                            />
                        ))}
                    </div>
                </div>
                <button type="submit" className="save-btn" disabled={loading}>
                    {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                    <span>{isEdit ? t('goals.editGoal') : t('goals.save')}</span>
                </button>
                {isEdit && (
                    <button
                        type="button"
                        className="save-btn delete-btn"
                        onClick={handleDelete}
                        disabled={deleting}
                        style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', marginTop: '0.75rem' }}
                    >
                        {deleting ? <Loader2 className="spin" size={18} /> : <Trash2 size={18} />}
                        <span>{t('goals.delete')}</span>
                    </button>
                )}
            </form>
        </div>
    );
}
