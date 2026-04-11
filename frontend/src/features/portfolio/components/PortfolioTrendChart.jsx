import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getPortfolioHistory } from '../../../services/api';
import { formatMonthShort } from '../../../utils/dates';
import { formatCurrency } from '../../../utils/currencies';
import { useMonth } from '../../../context/MonthContext';
import { useSettings } from '../../../context/SettingsContext';

const TOOLTIP_STYLE = {
    backgroundColor: '#1e1e2d',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '0.8rem',
};

function formatAmount(value) {
    return Math.round(value).toLocaleString();
}

function CustomTooltip({ active, payload, label, currency = 'CZK' }) {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
    return (
        <div style={{ ...TOOLTIP_STYLE, padding: '0.75rem' }}>
            <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>{label}</p>
            {payload.map((entry) => (
                <p key={entry.name} style={{ color: entry.color, margin: '0.15rem 0', fontSize: '0.8rem' }}>
                    {entry.name}: {formatCurrency(entry.value, currency)}
                </p>
            ))}
            <p style={{ marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.4rem', fontWeight: 700 }}>
                Total: {formatCurrency(total, currency)}
            </p>
        </div>
    );
}

export function PortfolioTrendChart() {
    const [data, setData] = useState([]);
    const { lastDataMonth } = useMonth();
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';

    useEffect(() => {
        const load = async () => {
            try {
                const history = await getPortfolioHistory(12, lastDataMonth);
                // Only show months that have actual data (non-zero portfolio value)
                const filtered = history.filter(d => d.total_portfolio > 0);
                setData(filtered);
            } catch (err) {
                console.error('Error loading portfolio history:', err);
            }
        };
        load();

        const handleUpdate = () => load();
        window.addEventListener('portfolio-updated', handleUpdate);
        return () => window.removeEventListener('portfolio-updated', handleUpdate);
    }, [lastDataMonth]);

    const hasData = data.filter(d => d.total_portfolio > 0).length >= 1;
    if (!hasData) {
        return (
            <div className="chart-card">
                <h3>Portfolio Development</h3>
                <div className="chart-empty">
                    Not enough data yet. Portfolio snapshots are recorded when you update your portfolio.
                </div>
            </div>
        );
    }

    const chartData = data.map(d => ({
        month: formatMonthShort(d.month),
        Savings: Number(d.total_savings),
        Stocks: Number(d.total_stocks),
        Properties: Number(d.total_properties),
    }));

    return (
        <div className="chart-card">
            <h3>Portfolio Development</h3>
            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="gradPortSavings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradPortStocks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradPortProperties" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
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
                        width={65}
                    />
                    <Tooltip content={(props) => <CustomTooltip {...props} currency={currency} />} />
                    <Legend
                        wrapperStyle={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="Properties"
                        stackId="1"
                        stroke="#f97316"
                        strokeWidth={2}
                        fill="url(#gradPortProperties)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#f97316' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="Stocks"
                        stackId="1"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        fill="url(#gradPortStocks)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#0ea5e9' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="Savings"
                        stackId="1"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fill="url(#gradPortSavings)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#22c55e' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
