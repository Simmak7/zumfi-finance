import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getStockDetailHistory } from '../../../services/api';
import { formatCurrency, formatMoney } from '../../../utils/currencies';
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

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const invested = payload.find(p => p.dataKey === 'Invested');
    const value = payload.find(p => p.dataKey === 'Value');
    const inv = invested?.value;
    const val = value?.value;
    const diff = (inv != null && val != null) ? val - inv : null;

    return (
        <div style={TOOLTIP_STYLE}>
            <p style={{ marginBottom: '0.25rem', fontWeight: 600 }}>{label}</p>
            {invested && inv != null && (
                <p style={{ color: '#f59e0b', margin: '0.1rem 0' }}>
                    Invested: {formatMoney(inv)}
                </p>
            )}
            {value && val != null && (
                <p style={{ color: '#0ea5e9', margin: '0.1rem 0' }}>
                    Value: {formatMoney(val)}
                </p>
            )}
            {diff != null && (
                <p style={{ color: diff >= 0 ? '#22c55e' : '#ef4444', margin: '0.1rem 0' }}>
                    {diff >= 0 ? '+' : ''}{formatMoney(diff)}
                </p>
            )}
        </div>
    );
}

export function StockDetailModal({ stock, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const result = await getStockDetailHistory(stock.ticker, stock.currency, 60);
                setData(result);
            } catch (err) {
                console.error('Failed to load stock detail history:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [stock.ticker, stock.currency]);

    const history = data?.history || [];

    // Filter to months with at least some data
    const chartData = history
        .filter(m => m.market_value != null || m.total_invested != null)
        .map(m => ({
            month: formatMonthShort(m.month),
            Invested: m.total_invested != null ? Number(m.total_invested) : null,
            Value: m.market_value != null ? Number(m.market_value) : null,
        }));

    const hasChartData = chartData.length >= 2;

    // Compute summary stats
    const latestWithValue = [...history].reverse().find(m => m.market_value != null);
    const latestWithInvested = [...history].reverse().find(m => m.total_invested != null);
    const totalInvested = latestWithInvested?.total_invested ?? stock.total_cost ?? 0;
    const currentValue = latestWithValue?.market_value ?? stock.market_value ?? 0;
    const gainLoss = currentValue - totalInvested;
    const gainLossPct = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;
    const isPositive = gainLoss >= 0;

    const typeLabel = stock.holding_type === 'etf' ? 'ETF' : 'Stock';

    return (
        <div className="ctm-overlay" onClick={onClose}>
            <div
                className="ctm-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '700px' }}
            >
                <div className="ctm-header">
                    <div className="ctm-header-title">
                        <div
                            className="ctm-color-dot"
                            style={{ background: stock.color || '#0ea5e9' }}
                        />
                        <h2>{stock.name} ({stock.ticker})</h2>
                    </div>
                    <button className="mcw-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ctm-subtitle">
                    {typeLabel} &middot; {stock.currency}
                </div>

                <div className="ctm-body">
                    {loading ? (
                        <div className="ctm-empty">Loading...</div>
                    ) : (
                        <>
                            {/* Summary stats */}
                            <div className="stock-detail-stats">
                                <div className="stock-stat">
                                    <span className="stock-stat-label">Invested</span>
                                    <span className="stock-stat-value" style={{ color: '#f59e0b' }}>
                                        {formatCurrency(totalInvested, stock.currency)}
                                    </span>
                                </div>
                                <div className="stock-stat">
                                    <span className="stock-stat-label">Current Value</span>
                                    <span className="stock-stat-value" style={{ color: '#0ea5e9' }}>
                                        {formatCurrency(currentValue, stock.currency)}
                                    </span>
                                </div>
                                <div className="stock-stat">
                                    <span className="stock-stat-label">Gain / Loss</span>
                                    <span className={`stock-stat-value ${isPositive ? 'positive' : 'negative'}`}>
                                        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        {isPositive ? '+' : ''}{formatCurrency(gainLoss, stock.currency)}
                                        <span className="stock-stat-pct">
                                            ({isPositive ? '+' : ''}{gainLossPct.toFixed(1)}%)
                                        </span>
                                    </span>
                                </div>
                            </div>

                            {/* Chart */}
                            {hasChartData ? (
                                <div style={{ marginTop: '1rem' }}>
                                    <div style={{
                                        fontSize: '0.85rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: '0.5rem',
                                    }}>
                                        Monthly Development
                                    </div>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                                            <XAxis
                                                dataKey="month"
                                                stroke="rgba(255,255,255,0.3)"
                                                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                stroke="rgba(255,255,255,0.3)"
                                                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                                                tickFormatter={formatAmount}
                                                width={50}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend
                                                wrapperStyle={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="Invested"
                                                stroke="#f59e0b"
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                                dot={false}
                                                connectNulls
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="Value"
                                                stroke="#0ea5e9"
                                                strokeWidth={2}
                                                dot={{ fill: '#0ea5e9', strokeWidth: 0, r: 3 }}
                                                activeDot={{ r: 5, fill: '#0ea5e9' }}
                                                connectNulls
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="ctm-empty" style={{ minHeight: '80px' }}>
                                    Not enough monthly data for chart. Upload more statements to see development.
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="ctm-footer">
                    <span className="ctm-count">
                        {Number(stock.shares).toFixed(2)} shares &middot; Avg cost: {formatCurrency(
                            stock.avg_cost_per_share, stock.currency
                        )}
                    </span>
                </div>
            </div>
        </div>
    );
}
