import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { formatCurrency } from '../utils/currencies';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../i18n';
import './TrendWidget.css';

export function TrendWidget({ trends }) {
    const { t } = useTranslation();
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    if (!trends || trends.length === 0) return null;

    // Filter interesting trends (e.g., > 10% change) 
    // or just show top 3 movers?
    // Let's sort by absolute diff percent desc
    const sorted = [...trends].sort((a, b) => Math.abs(b.diff_percent) - Math.abs(a.diff_percent)).slice(0, 3);

    return (
        <div className="trend-widget-container">
            <h3>{t('trends.monthlyTrends')}</h3>
            <div className="trend-list">
                {sorted.map(item => {
                    const isUp = item.diff_percent > 0;
                    const isZero = item.diff_percent === 0;

                    return (
                        <div key={item.category} className="trend-item">
                            <div className="trend-info">
                                <span className="trend-cat">{item.category}</span>
                                <span className="trend-val">{formatCurrency(item.current, currency)}</span>
                            </div>
                            <div className={`trend-indicator ${isUp ? 'up' : isZero ? 'neutral' : 'down'}`}>
                                {isUp ? <ArrowUp size={14} /> : isZero ? <Minus size={14} /> : <ArrowDown size={14} />}
                                <span>{Math.abs(item.diff_percent)}%</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
