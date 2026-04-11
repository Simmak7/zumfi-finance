import React from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatMonthShort } from '../../../utils/dates';
import { formatCurrency } from '../../../utils/currencies';
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

function CustomTooltip({ active, payload, label, currency }) {
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

export function IncomeExpensesChart({ data, currency = 'CZK' }) {
    const { t } = useTranslation();
    const incomeLabel = t('charts.income');
    const expensesLabel = t('charts.expenses');

    if (!data || data.length < 1) {
        return (
            <div className="chart-card">
                <h3>{t('charts.incomeVsExpenses')}</h3>
                <div className="chart-empty">
                    Not enough data. Import statements to see the chart.
                </div>
            </div>
        );
    }

    const chartData = data.map(d => ({
        month: formatMonth(d.month),
        [incomeLabel]: d.total_income,
        [expensesLabel]: d.total_expenses,
    }));

    // Compute smart Y-axis domain that zooms in when values are close.
    // Include all values (including 0s) so months with no income or no
    // expenses prevent the zoom — the chart must show 0 for those months.
    const allValues = data.flatMap(d => [d.total_income, d.total_expenses]);
    const dataMax = allValues.length > 0 ? Math.max(...allValues) : 0;
    const dataMin = allValues.length > 0 ? Math.min(...allValues) : 0;
    const range = dataMax - dataMin;

    let yDomain;
    if (dataMax > 0 && dataMin > 0 && dataMin > dataMax * 0.6) {
        // All values are positive and close together (min > 60% of max) — zoom in
        const padding = Math.max(range * 0.5, dataMax * 0.05);
        yDomain = [
            Math.max(0, Math.floor((dataMin - padding) / 1000) * 1000),
            Math.ceil((dataMax + padding) / 1000) * 1000,
        ];
    } else {
        yDomain = [0, 'auto'];
    }

    return (
        <div className="chart-card" data-zumfi-zone="income-chart">
            <h3>{t('charts.incomeVsExpenses')}</h3>
            <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
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
                        domain={yDomain}
                    />
                    <Tooltip content={<CustomTooltip currency={currency} />} />
                    <Legend
                        wrapperStyle={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}
                    />
                    <Area
                        type="monotone"
                        dataKey={incomeLabel}
                        stroke="#22c55e"
                        strokeWidth={2}
                        fill="url(#gradIncome)"
                    />
                    <Area
                        type="monotone"
                        dataKey={expensesLabel}
                        stroke="#f43f5e"
                        strokeWidth={2}
                        fill="url(#gradExpenses)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
