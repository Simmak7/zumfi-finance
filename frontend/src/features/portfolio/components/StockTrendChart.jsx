import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts';
import { getStockHoldingsHistory } from '../../../services/api';
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

const COLORS = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#0284c7', '#0369a1', '#075985'];

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

export function StockTrendChart() {
    const [data, setData] = useState([]);
    const [holdingKeys, setHoldingKeys] = useState([]);
    const { lastDataMonth } = useMonth();
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';

    useEffect(() => {
        const load = async () => {
            try {
                const history = await getStockHoldingsHistory(12, lastDataMonth);
                // Build chart data: each month has total + per-holding values
                // Pick top holdings by latest month's value
                const latestWithData = [...history].reverse().find(m => m.total_value > 0);
                if (!latestWithData) {
                    setData([]);
                    setHoldingKeys([]);
                    return;
                }
                // Get top 5 holdings by value, group rest as "Other"
                const sorted = [...latestWithData.holdings]
                    .sort((a, b) => Number(b.market_value || 0) - Number(a.market_value || 0));
                const topKeys = sorted.slice(0, 5).map(h => `${h.ticker}_${h.currency}`);

                const displayKeys = sorted.slice(0, 5).map(h => h.ticker);

                const chartData = history.map(m => {
                    const row = { month: formatMonthShort(m.month) };
                    // Initialize all keys to 0 so Recharts gets numeric values
                    for (const k of displayKeys) row[k] = 0;
                    let otherVal = 0;
                    for (const h of m.holdings) {
                        const key = `${h.ticker}_${h.currency}`;
                        const val = Number(h.market_value || 0);
                        if (topKeys.includes(key)) {
                            row[h.ticker] = val;
                        } else {
                            otherVal += val;
                        }
                    }
                    if (sorted.length > 5) row['Other'] = otherVal;
                    return row;
                });

                const keys = [...displayKeys];
                if (sorted.length > 5) keys.push('Other');

                // Filter out leading months with no data (all zeros)
                const filtered = chartData.filter(d => keys.some(k => d[k] > 0));
                setData(filtered.length > 0 ? filtered : chartData.slice(-1));
                setHoldingKeys(keys);
            } catch (err) {
                console.error('Error loading stock history:', err);
            }
        };
        load();

        const handleUpdate = () => load();
        window.addEventListener('portfolio-updated', handleUpdate);
        return () => window.removeEventListener('portfolio-updated', handleUpdate);
    }, [lastDataMonth]);

    const hasData = data.filter(d => {
        return holdingKeys.some(k => d[k] > 0);
    }).length >= 1;

    if (!hasData) {
        return (
            <div className="chart-card">
                <h3>Stock Portfolio Development</h3>
                <div className="chart-empty">
                    No stock statement data yet. Upload a Revolut stock statement to see your portfolio development.
                </div>
            </div>
        );
    }

    return (
        <div className="chart-card">
            <h3>Stock Portfolio Development</h3>
            <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        {holdingKeys.map((key, i) => (
                            <linearGradient key={key} id={`gradStock_${key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.25} />
                                <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                            </linearGradient>
                        ))}
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
                    <Tooltip content={(props) => <CustomTooltip {...props} currency={currency} />} />
                    {holdingKeys.map((key, i) => (
                        <Area
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stackId="1"
                            stroke={COLORS[i % COLORS.length]}
                            strokeWidth={2}
                            fill={`url(#gradStock_${key})`}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
