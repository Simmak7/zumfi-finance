import React, { useState, useEffect } from 'react';
import { X, BarChart3 } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts';
import { getStockBreakdown } from '../../../services/api';
import { formatCurrency } from '../../../utils/currencies';
import { formatMonthShort } from '../../../utils/dates';
import '../../dashboard/components/CategoryTransactionsModal.css';

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

export function StockCurrencyModal({ onClose, selectedMonth }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getStockBreakdown(12, selectedMonth)
            .then(setData)
            .catch((err) => console.error('Failed to load stock breakdown:', err))
            .finally(() => setLoading(false));
    }, [selectedMonth]);

    const chartData = (data?.monthly_history || [])
        .map(m => ({
            month: formatMonthShort(m.month),
            value: Number(m.total_converted),
        }));

    const hasChartData = chartData.filter(d => d.value > 0).length >= 2;

    return (
        <div className="ctm-overlay" onClick={onClose}>
            <div
                className="ctm-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '620px' }}
            >
                <div className="ctm-header">
                    <div className="ctm-header-title">
                        <BarChart3 size={18} style={{ color: '#0ea5e9' }} />
                        <h2>Stock Portfolio</h2>
                        {data && (
                            <span className="ctm-amount">
                                {formatCurrency(data.total_converted, data.preferred_currency)}
                            </span>
                        )}
                    </div>
                    <button className="mcw-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {data?.rates_date && (
                    <div className="ctm-subtitle">
                        Monthly avg. exchange rate: {data.rates_date} (CNB)
                    </div>
                )}

                <div className="ctm-body">
                    {loading ? (
                        <div className="ctm-empty">Loading...</div>
                    ) : !data ? (
                        <div className="ctm-empty">Failed to load data.</div>
                    ) : (
                        <>
                            <div className="ctm-list">
                                {data.currency_breakdown.map((item) => {
                                    const pct = data.total_converted > 0
                                        ? Math.round(item.converted_amount / data.total_converted * 100)
                                        : 0;
                                    return (
                                        <div key={item.currency} className="ctm-tx-row">
                                            <div className="ctm-tx-info">
                                                <span className="ctm-tx-desc">
                                                    {formatCurrency(item.original_amount, item.currency)}
                                                </span>
                                                <span className="ctm-tx-meta">
                                                    {item.exchange_rate
                                                        ? `1 ${item.currency} = ${item.exchange_rate} ${data.preferred_currency}`
                                                        : item.currency === data.preferred_currency
                                                            ? 'Base currency'
                                                            : 'Rate unavailable'}
                                                    {' \u2014 '}{pct}% of total
                                                </span>
                                            </div>
                                            <span className="ctm-tx-amount" style={{ color: '#0ea5e9' }}>
                                                {formatCurrency(item.converted_amount, data.preferred_currency)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {hasChartData && (
                                <div style={{ marginTop: '1.25rem' }}>
                                    <div style={{
                                        fontSize: '0.85rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: '0.5rem',
                                    }}>
                                        Development ({data.preferred_currency})
                                    </div>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="stockModalGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
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
                                                width={50}
                                            />
                                            <Tooltip
                                                contentStyle={TOOLTIP_STYLE}
                                                formatter={(val) => [
                                                    formatCurrency(val, data.preferred_currency),
                                                    'Total',
                                                ]}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#0ea5e9"
                                                strokeWidth={2}
                                                fill="url(#stockModalGrad)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="ctm-footer">
                    <span className="ctm-count">
                        {!loading && data
                            ? `${data.currency_breakdown.length} currenc${data.currency_breakdown.length !== 1 ? 'ies' : 'y'}`
                            : ''}
                    </span>
                </div>
            </div>
        </div>
    );
}
