import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts';
import { getSavingsHistory } from '../../../services/api';
import { formatMonthShort } from '../../../utils/dates';
import { formatCurrency } from '../../../utils/currencies';
import { useMonth } from '../../../context/MonthContext';
import { useSettings } from '../../../context/SettingsContext';
import { useTranslation } from '../../../i18n';

const TOOLTIP_STYLE = {
    backgroundColor: '#1e1e2d',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '0.8rem',
};

function formatMonth(monthStr) {
    return formatMonthShort(monthStr);
}

function formatAmount(value) {
    return Math.round(value).toLocaleString();
}

function CustomTooltip({ active, payload, label, currency = 'CZK' }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={TOOLTIP_STYLE}>
            <p style={{ marginBottom: '0.25rem', fontWeight: 600 }}>{label}</p>
            {payload.map((entry) => (
                <p key={entry.name} style={{ color: entry.color, margin: '0.1rem 0' }}>
                    {entry.name}: {formatCurrency(entry.value, currency)}
                </p>
            ))}
        </div>
    );
}

export function SavingsTrendChart() {
    const [data, setData] = useState([]);
    const { lastDataMonth } = useMonth();
    const { settings } = useSettings();
    const { t } = useTranslation();
    const currency = settings?.preferred_currency || 'CZK';

    useEffect(() => {
        const load = async () => {
            try {
                const history = await getSavingsHistory(12, lastDataMonth);
                const filtered = history.filter(d => d.total_savings > 0);
                setData(filtered);
            } catch (err) {
                console.error('Error loading savings history:', err);
            }
        };
        load();

        const handleUpdate = () => load();
        window.addEventListener('portfolio-updated', handleUpdate);
        return () => window.removeEventListener('portfolio-updated', handleUpdate);
    }, [lastDataMonth]);

    const hasData = data.filter(d => d.total_savings > 0).length >= 1;
    if (!hasData) {
        return (
            <div className="chart-card">
                <h3>{t('portfolio.savingsDevelopment')}</h3>
                <div className="chart-empty">
                    {t('portfolio.notEnoughData')}
                </div>
            </div>
        );
    }

    const chartData = data.map(d => ({
        month: formatMonth(d.month),
        Savings: Number(d.total_savings),
    }));

    return (
        <div className="chart-card">
            <h3>{t('portfolio.savingsDevelopment')}</h3>
            <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="gradSavings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                    <XAxis
                        dataKey="month"
                        stroke="rgba(255,255,255,0.3)"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                    />
                    <YAxis
                        stroke="rgba(255,255,255,0.3)"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                        tickFormatter={formatAmount}
                        width={55}
                    />
                    <Tooltip content={<CustomTooltip currency={currency} />} />
                    <Area
                        type="monotone"
                        dataKey="Savings"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fill="url(#gradSavings)"
                        dot={{ fill: '#22c55e', strokeWidth: 0, r: 3 }}
                        activeDot={{ r: 5, fill: '#22c55e' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
