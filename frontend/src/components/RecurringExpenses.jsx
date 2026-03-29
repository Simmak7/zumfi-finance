import React from 'react';
import { RefreshCw } from 'lucide-react';
import { formatCurrency } from '../utils/currencies';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../i18n';
import './SmartComponents.css';

export function RecurringExpenses({ items }) {
    const { t } = useTranslation();
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    if (!items || items.length === 0) {
        return (
            <div className="smart-card">
                <h3>{t('recurring.fixedExpenses')}</h3>
                <div className="empty-state">{t('recurring.noRecurring')}</div>
            </div>
        );
    }

    return (
        <div className="smart-card recurring-card">
            <h3>
                <RefreshCw size={18} /> {t('recurring.fixedExpenses')}
            </h3>
            <div className="recurring-list">
                {items.map((item, idx) => (
                    <div key={idx} className="recurring-item">
                        <div className="rec-info">
                            <span className="rec-name">{item.name}</span>
                            <span className="rec-freq">{item.frequency}</span>
                        </div>
                        <div className="rec-amount">
                            {formatCurrency(item.average_amount, currency)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
