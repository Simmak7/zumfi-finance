import React from 'react';
import { AlertTriangle, TrendingUp, AlertCircle, PiggyBank, ArrowUpRight, Receipt } from 'lucide-react';
import { formatCurrency } from '../utils/currencies';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../i18n';
import './AnomalyCard.css';

const TYPE_ICONS = {
    category_spike: TrendingUp,
    deficit: AlertCircle,
    savings_crash: PiggyBank,
    spending_spike: ArrowUpRight,
    large_transaction: Receipt,
};

function severityClass(severity) {
    if (severity >= 60) return 'severe';
    if (severity >= 30) return 'moderate';
    return 'mild';
}

export function AnomalyCard({ anomalies }) {
    const { t } = useTranslation();
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    if (!anomalies || anomalies.length === 0) return null;

    return (
        <div className="anomaly-card">
            <div className="anomaly-header">
                <AlertTriangle size={20} className="alert-icon" />
                <h3>{t('anomaly.unusualActivity')}</h3>
            </div>
            <div className="anomaly-list">
                {anomalies.slice(0, 3).map((item, idx) => {
                    const Icon = TYPE_ICONS[item.type] || AlertTriangle;
                    const sev = severityClass(item.severity || 0);
                    return (
                        <div key={idx} className={`anomaly-item ${sev}`}>
                            <div className="anomaly-row-top">
                                <Icon size={16} className={`anomaly-type-icon ${sev}`} />
                                <span className="anomaly-desc">{item.description}</span>
                                <span className="anomaly-amount">
                                    {formatCurrency(item.amount, currency)}
                                </span>
                            </div>
                            <div className="anomaly-reason">{item.reason}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
