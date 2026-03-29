import React from 'react';
import { formatCurrency } from '../utils/currencies';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../i18n';
import './SmartComponents.css';

export function SpendForecast({ current, predicted, recentParams }) {
    const { t } = useTranslation();
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    // Avoid division by zero
    const maxVal = Math.max(current, predicted, 1);
    const percentUsed = (current / maxVal) * 100;

    // Safety check for large values
    const safePercent = Math.min(100, Math.max(0, percentUsed));

    // Determine status color
    let statusClass = "good";
    if (current > predicted) statusClass = "danger";
    else if (current > predicted * 0.9) statusClass = "warning";

    return (
        <div className="smart-card forecast-card" data-zumfi-zone="forecast">
            <h3>{t('forecast.title')}</h3>
            <div className="forecast-content">
                <div className="forecast-numbers">
                    <div className="current-spend">
                        <span className="label">{t('forecast.current')}</span>
                        <span className="value">{formatCurrency(current, currency)}</span>
                    </div>
                    <div className="predicted-spend">
                        <span className="label">{t('forecast.predicted')}</span>
                        <span className="value">{formatCurrency(predicted, currency)}</span>
                    </div>
                </div>

                <div className="forecast-bar">
                    <div
                        className={`bar-fill ${statusClass}`}
                        style={{ width: `${safePercent}%` }}
                    />
                    <div className="prediction-marker" style={{ left: '100%' }} />
                </div>

                <div className="forecast-meta">
                    {t('forecast.basedOn', { count: recentParams?.length || 3 })}
                </div>
            </div>
        </div>
    );
}
