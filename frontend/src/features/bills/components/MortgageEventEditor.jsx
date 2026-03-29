import React, { useState } from 'react';
import { useInspector } from '../../../context/InspectorContext';
import { useToast } from '../../../context/ToastContext';
import { createMortgageEvent, updateMortgageEvent, deleteMortgageEvent } from '../../../services/api';
import { CURRENCY_SYMBOLS } from '../../../utils/currencies';
import { Save, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from '../../../i18n';
import '../../../components/GoalEditor.css';

const EVENT_TYPE_KEYS = [
    { value: 'extra_payment', labelKey: 'mortgageTab.extraPaymentLabel' },
    { value: 'rate_change', labelKey: 'mortgageTab.interestRateChangeLabel' },
    { value: 'payment_change', labelKey: 'mortgageTab.monthlyPaymentChangeLabel' },
    { value: 'balance_override', labelKey: 'mortgageTab.balanceCorrectionLabel' },
    { value: 'fix_period_change', labelKey: 'mortgageTab.fixPeriodChangeLabel' },
];

export function MortgageEventEditor({ event, mortgageId, currency = 'CZK', onSuccess }) {
    const { closeInspector } = useInspector();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const isEdit = !!event;
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
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
        setLoading(true);
        try {
            const payload = {
                event_type: formData.event_type,
                event_date: formData.event_date,
                note: formData.note || null,
            };

            if (formData.event_type === 'extra_payment') {
                payload.amount = Number(formData.amount);
            } else if (formData.event_type === 'rate_change') {
                payload.old_rate = formData.old_rate ? Number(formData.old_rate) : null;
                payload.new_rate = Number(formData.new_rate);
            } else if (formData.event_type === 'payment_change') {
                payload.old_payment = formData.old_payment ? Number(formData.old_payment) : null;
                payload.new_payment = Number(formData.new_payment);
            } else if (formData.event_type === 'balance_override') {
                payload.new_balance = Number(formData.new_balance);
            } else if (formData.event_type === 'fix_period_change') {
                payload.new_fix_end_date = formData.new_fix_end_date || null;
            }

            if (isEdit) {
                await updateMortgageEvent(event.id, payload);
            } else {
                await createMortgageEvent(mortgageId, payload);
            }

            window.dispatchEvent(new Event('mortgages-updated'));
            window.dispatchEvent(new Event('mortgage-events-updated'));
            if (onSuccess) onSuccess();
            closeInspector();
        } catch (err) {
            console.error('Error saving event:', err);
            addToast(t('mortgageEditor.saveEventFailed'), 'error');
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
            if (onSuccess) onSuccess();
            closeInspector();
        } catch (err) {
            console.error('Error deleting event:', err);
            addToast(t('mortgageEditor.deleteEventFailed'), 'error');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="goal-editor">
            <h3>{isEdit ? t('mortgageEditor.editEvent') : t('mortgageEditor.addMortgageEvent')}</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>{t('mortgageEditor.eventType')}</label>
                    <select
                        value={formData.event_type}
                        onChange={e => setFormData({ ...formData, event_type: e.target.value })}
                        disabled={isEdit}
                    >
                        {EVENT_TYPE_KEYS.map(et => (
                            <option key={et.value} value={et.value}>{t(et.labelKey)}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>{t('mortgageEditor.date')}</label>
                    <input
                        type="date"
                        value={formData.event_date}
                        onChange={e => setFormData({ ...formData, event_date: e.target.value })}
                        required
                    />
                </div>

                {formData.event_type === 'extra_payment' && (
                    <div className="form-group">
                        <label>{t('mortgageEditor.amount', { symbol: currSymbol })}</label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="100000"
                            value={formData.amount}
                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            required
                        />
                    </div>
                )}

                {formData.event_type === 'rate_change' && (
                    <>
                        <div className="form-group">
                            <label>{t('mortgageEditor.oldRate')}</label>
                            <input
                                type="number"
                                step="0.001"
                                placeholder="5.29"
                                value={formData.old_rate}
                                onChange={e => setFormData({ ...formData, old_rate: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('mortgageEditor.newRate')}</label>
                            <input
                                type="number"
                                step="0.001"
                                placeholder="4.89"
                                value={formData.new_rate}
                                onChange={e => setFormData({ ...formData, new_rate: e.target.value })}
                                required
                            />
                        </div>
                    </>
                )}

                {formData.event_type === 'payment_change' && (
                    <>
                        <div className="form-group">
                            <label>{t('mortgageEditor.oldMonthlyPayment', { symbol: currSymbol })}</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="16750"
                                value={formData.old_payment}
                                onChange={e => setFormData({ ...formData, old_payment: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('mortgageEditor.newMonthlyPayment', { symbol: currSymbol })}</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="15900"
                                value={formData.new_payment}
                                onChange={e => setFormData({ ...formData, new_payment: e.target.value })}
                                required
                            />
                        </div>
                    </>
                )}

                {formData.event_type === 'balance_override' && (
                    <div className="form-group">
                        <label>{t('mortgageEditor.correctedBalance', { symbol: currSymbol })}</label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="2500000"
                            value={formData.new_balance}
                            onChange={e => setFormData({ ...formData, new_balance: e.target.value })}
                            required
                        />
                    </div>
                )}

                {formData.event_type === 'fix_period_change' && (
                    <div className="form-group">
                        <label>{t('mortgageEditor.newFixEndDate')}</label>
                        <input
                            type="date"
                            value={formData.new_fix_end_date}
                            onChange={e => setFormData({ ...formData, new_fix_end_date: e.target.value })}
                            required
                        />
                    </div>
                )}

                <div className="form-group">
                    <label>{t('mortgageEditor.note')} <span style={{ opacity: 0.4, fontWeight: 400 }}>({t('mortgageEditor.optional')})</span></label>
                    <input
                        type="text"
                        placeholder={t('mortgageEditor.notePlaceholder')}
                        value={formData.note}
                        onChange={e => setFormData({ ...formData, note: e.target.value })}
                    />
                </div>

                <button type="submit" className="save-btn" disabled={loading}>
                    {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                    <span>{isEdit ? t('mortgageEditor.updateEvent') : t('mortgageEditor.saveEvent')}</span>
                </button>

                {isEdit && (
                    <button
                        type="button"
                        className="delete-btn"
                        onClick={handleDelete}
                        disabled={deleting}
                        style={{
                            marginTop: '0.75rem',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0.6rem',
                            background: 'rgba(244, 63, 94, 0.1)',
                            border: '1px solid rgba(244, 63, 94, 0.2)',
                            color: '#f43f5e',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                        }}
                    >
                        <Trash2 size={16} />
                        <span>{deleting ? t('mortgageEditor.deleting') : t('mortgageEditor.deleteEvent')}</span>
                    </button>
                )}
            </form>
        </div>
    );
}
