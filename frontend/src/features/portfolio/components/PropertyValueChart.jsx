import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getPropertyHistory } from '../../../services/api';
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

function formatAmount(value) {
    return Math.round(value).toLocaleString();
}

function CustomTooltip({ active, payload, label, currency }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={TOOLTIP_STYLE}>
            <p style={{ marginBottom: '0.25rem', fontWeight: 600 }}>{label}</p>
            {payload.map((entry) => (
                <p key={entry.name} style={{ color: entry.color, margin: '0.1rem 0' }}>
                    {entry.name}: {formatMoney(entry.value)} {currency}
                </p>
            ))}
        </div>
    );
}

export function PropertyValueChart({ propertyId, purchasePrice, currency }) {
    const [data, setData] = useState([]);

    useEffect(() => {
        if (!propertyId) return;
        const load = async () => {
            try {
                const res = await getPropertyHistory(propertyId, 120);
                setData(filterToYearly(res.history || []));
            } catch (err) {
                console.error('Error loading property history:', err);
            }
        };
        load();

        const handleUpdate = () => load();
        window.addEventListener('portfolio-updated', handleUpdate);
        return () => window.removeEventListener('portfolio-updated', handleUpdate);
    }, [propertyId]);

    if (data.length < 1) {
        return (
            <div className="chart-card chart-card-compact">
                <h4>Value History</h4>
                <div className="chart-empty">
                    No history yet. Value snapshots are recorded monthly.
                </div>
            </div>
        );
    }

    const chartData = data.map(d => ({
        month: formatYearLabel(d.month),
        'Estimated Value': Math.round(d.estimated_value),
    }));

    const purchase = purchasePrice ? Math.round(purchasePrice) : null;

    return (
        <div className="chart-card chart-card-compact">
            <h4>Value History</h4>
            <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`gradProp${propertyId}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                    <XAxis
                        dataKey="month"
                        stroke="rgba(255,255,255,0.3)"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                    />
                    <YAxis
                        stroke="rgba(255,255,255,0.3)"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                        tickFormatter={formatAmount}
                        width={60}
                    />
                    <Tooltip content={<CustomTooltip currency={currency} />} />
                    {purchase != null && (
                        <ReferenceLine
                            y={purchase}
                            stroke="#64748b"
                            strokeDasharray="6 4"
                            label={{
                                value: `Paid: ${formatMoney(purchase)}`,
                                position: 'insideTopRight',
                                fill: '#94a3b8',
                                fontSize: 11,
                            }}
                        />
                    )}
                    <Area
                        type="monotone"
                        dataKey="Estimated Value"
                        stroke="#f97316"
                        strokeWidth={2}
                        fill={`url(#gradProp${propertyId})`}
                        dot={{ fill: '#f97316', strokeWidth: 0, r: 3 }}
                        activeDot={{ r: 5, fill: '#f97316' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
