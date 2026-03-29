import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../../utils/currencies';
import { useSettings } from '../../../context/SettingsContext';
import { X, TrendingUp } from 'lucide-react';
import { getAllocationDetails } from '../../../services/api';
import { formatMonthLabel } from '../../../utils/dates';
import { useTranslation } from '../../../i18n';
import './AllocationWizard.css';

export function AllocationInfoPopup({ month, onClose }) {
    const [data, setData] = useState(null);
    const { t } = useTranslation();
    const { settings } = useSettings();
    const formatAmount = (value) => formatCurrency(value, settings?.preferred_currency || 'CZK');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getAllocationDetails(month)
            .then(setData)
            .catch((err) => console.error('Failed to load allocation details:', err))
            .finally(() => setLoading(false));
    }, [month]);

    const monthLabel = formatMonthLabel(month);

    return (
        <div className="wizard-overlay" onClick={onClose}>
            <div className="wizard-modal" onClick={e => e.stopPropagation()}>
                <div className="wizard-header">
                    <h2><TrendingUp size={22} /> {t('allocation.title')}</h2>
                    <button className="wizard-close" onClick={onClose}><X size={20} /></button>
                </div>

                {loading ? (
                    <div className="wizard-loading">{t('common.loading')}</div>
                ) : !data || data.allocations.length === 0 ? (
                    <div className="wizard-empty">
                        <p>{t('allocation.noDetails') || `No allocation details found for ${monthLabel}.`}</p>
                    </div>
                ) : (
                    <div className="alloc-info-body">
                        <h3>{t('allocation.alreadyAllocated')} - {monthLabel}</h3>
                        <div className="confirm-list">
                            {data.allocations.map((item, i) => (
                                <div key={i} className="confirm-row">
                                    <span>{item.goal_name}</span>
                                    <span className="confirm-amount">{formatAmount(item.amount)}</span>
                                </div>
                            ))}
                            <div className="confirm-row confirm-total">
                                <span>{t('budget.totalPlanned') || 'Total'}</span>
                                <span>{formatAmount(data.total)}</span>
                            </div>
                        </div>
                        <p className="alloc-info-hint">
                            {t('allocation.changeHint') || 'To change allocations, manage your goals in Portfolio \u2192 Savings.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

