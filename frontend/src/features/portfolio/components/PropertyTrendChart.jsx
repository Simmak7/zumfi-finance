import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { getPropertiesHistory } from '../../../services/api';
import { formatMonthShort } from '../../../utils/dates';
import { formatMoney } from '../../../utils/currencies';

/** Keep only December of each year + the current (last) month. */
function filterToYearly(history) {
    if (history.length === 0) return [];
    return history.filter((item, i) =>
        i === history.length - 1 || item.month.endsWith('-12')
    );
}

/** "2024-12" → "2024", "2026-02" → "Feb '26" */
function formatYearLabel(monthStr) {
    if (monthStr.endsWith('-12')) return monthStr.slice(0, 4);
    return formatMonthShort(monthStr);
}

const TOOLTIP_STYLE = {
    backgroundColor: '#1e1e2d',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '0.8rem',
};

const COLORS = ['#f97316', '#fb923c', '#fdba74', '#ea580c', '#c2410c', '#9a3412'];

function formatAmount(value) {
    return Math.round(value).toLocaleString();
}

function CustomTooltip({ active, payload, label, currencies }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={TOOLTIP_STYLE}>
            <p style={{ marginBottom: '0.25rem', fontWeight: 600 }}>{label}</p>
            {payload.map((entry) => {
                const cur = currencies[entry.name] || '';
                return (
                    <p key={entry.name} style={{ color: entry.color, margin: '0.1rem 0' }}>
                        {entry.name}: {formatMoney(entry.value)} {cur}
                    </p>
                );
            })}
        </div>
    );
}

export function PropertyTrendChart() {
    const [chartData, setChartData] = useState([]);
    const [propertyKeys, setPropertyKeys] = useState([]);
    const [purchasePrices, setPurchasePrices] = useState({});
    const [currencies, setCurrencies] = useState({});

    useEffect(() => {
        const load = async () => {
            try {
                const result = await getPropertiesHistory(120);
                setPurchasePrices(result.purchase_prices || {});
                setCurrencies(result.currencies || {});
                const allHistory = result.history || [];
                if (allHistory.length === 0) {
                    setChartData([]);
                    setPropertyKeys([]);
                    return;
                }

                const history = filterToYearly(allHistory);

                const nameSet = new Set();
                for (const m of history) {
                    for (const p of m.properties) nameSet.add(p.name);
                }
                const keys = [...nameSet];
                setPropertyKeys(keys);

                const data = history.map(m => {
                    const row = { month: formatYearLabel(m.month) };
                    for (const p of m.properties) {
                        row[p.name] = Math.round(p.estimated_value);
                    }
                    return row;
                });
                setChartData(data);
            } catch (err) {
                console.error('Error loading property trend:', err);
            }
        };
        load();

        const handleUpdate = () => load();
        window.addEventListener('portfolio-updated', handleUpdate);
        return () => window.removeEventListener('portfolio-updated', handleUpdate);
    }, []);

    if (chartData.length < 1) {
        return (
            <div className="chart-card">
                <h3>Property Value Development</h3>
                <div className="chart-empty">
                    Not enough data yet. Property snapshots are recorded when you visit Portfolio.
                </div>
            </div>
        );
    }

    return (
        <div className="chart-card">
            <h3>Property Value Development</h3>
            <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        {propertyKeys.map((key, i) => (
                            <linearGradient key={key} id={`gradPropTrend${i}`} x1="0" y1="0" x2="0" y2="1">
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
                        width={65}
                    />
                    <Tooltip content={<CustomTooltip currencies={currencies} />} />
                    <Legend
                        wrapperStyle={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}
                    />
                    {propertyKeys.map((key, i) => {
                        const pp = purchasePrices[key];
                        const cur = currencies[key] || '';
                        if (!pp || pp <= 0) return null;
                        return (
                            <ReferenceLine
                                key={`ref-${key}`}
                                y={Math.round(pp)}
                                stroke={COLORS[i % COLORS.length]}
                                strokeDasharray="6 4"
                                strokeOpacity={0.5}
                                label={{
                                    value: `${key} paid: ${formatMoney(pp)} ${cur}`,
                                    position: i % 2 === 0 ? 'insideTopRight' : 'insideBottomRight',
                                    fill: COLORS[i % COLORS.length],
                                    fontSize: 10,
                                    fontWeight: 500,
                                }}
                            />
                        );
                    })}
                    {propertyKeys.map((key, i) => (
                        <Area
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={COLORS[i % COLORS.length]}
                            strokeWidth={2}
                            fill={`url(#gradPropTrend${i})`}
                            dot={{ fill: COLORS[i % COLORS.length], strokeWidth: 0, r: 3 }}
                            activeDot={{ r: 5, fill: COLORS[i % COLORS.length] }}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
