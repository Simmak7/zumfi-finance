import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getGoalHistory } from '../../../services/api';
import { formatCurrency } from '../../../utils/currencies';
import { useSettings } from '../../../context/SettingsContext';
import { formatMonthShort } from '../../../utils/dates';
import { useTranslation } from '../../../i18n';
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

function CustomTooltip({ active, payload, label, currency = 'CZK' }) {
    if (!active || !payload?.length) return null;
    const saved = payload.find(p => p.dataKey === 'Saved');
    return (
        <div style={TOOLTIP_STYLE}>
            <p style={{ marginBottom: '0.25rem', fontWeight: 600 }}>{label}</p>
            {saved && saved.value != null && (
                <p style={{ color: saved.color, margin: '0.1rem 0' }}>
                    Saved: {formatCurrency(saved.value, currency)}
                </p>
            )}
        </div>
    );
}

export function GoalDevelopmentModal({ goal, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { settings } = useSettings();
    const { t } = useTranslation();
    const currency = settings?.preferred_currency || 'CZK';

    useEffect(() => {
        const load = async () => {
            try {
                const result = await getGoalHistory(goal.id, 12);
                setData(result);
            } catch (err) {
                console.error('Failed to load goal history:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [goal.id]);

    const history = data?.history || [];
    const chartData = history
        .filter(m => m.current_amount != null)
        .map(m => ({
            month: formatMonthShort(m.month),
            Saved: Number(m.current_amount),
        }));

    const hasChartData = chartData.length >= 2;
    const color = goal.color || '#fbbf24';
    const gradientId = `gradGoal${goal.id}`;
    const current = Number(goal.current_amount);
    const target = Number(goal.target_amount);
    const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

    return (
        <div className="ctm-overlay" onClick={onClose}>
            <div
                className="ctm-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '650px' }}
            >
                <div className="ctm-header">
                    <div className="ctm-header-title">
                        <div
                            className="ctm-color-dot"
                            style={{ background: color }}
                        />
                        <h2>{goal.name}</h2>
                        <span className="ctm-amount">{pct}%</span>
                    </div>
                    <button className="mcw-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ctm-subtitle">
                    {formatCurrency(current, currency)} / {formatCurrency(target, currency)}
                </div>

                <div className="ctm-body">
                    {loading ? (
                        <div className="ctm-empty">{t('common.loading')}</div>
                    ) : hasChartData ? (
                        <div style={{ marginTop: '0.5rem' }}>
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart
                                    data={chartData}
                                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient
                                            id={gradientId}
                                            x1="0" y1="0" x2="0" y2="1"
                                        >
                                            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="rgba(255,255,255,0.07)"
                                    />
                                    <XAxis
                                        dataKey="month"
                                        stroke="rgba(255,255,255,0.3)"
                                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                                    />
                                    <YAxis
                                        stroke="rgba(255,255,255,0.3)"
                                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                                        tickFormatter={formatAmount}
                                        width={55}
                                    />
                                    <Tooltip content={<CustomTooltip currency={currency} />} />
                                    <ReferenceLine
                                        y={target}
                                        stroke="rgba(255,255,255,0.2)"
                                        strokeDasharray="5 5"
                                        label={{
                                            value: 'Target',
                                            fill: 'rgba(255,255,255,0.3)',
                                            fontSize: 11,
                                            position: 'right',
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="Saved"
                                        stroke={color}
                                        strokeWidth={2}
                                        fill={`url(#${gradientId})`}
                                        dot={{ fill: color, strokeWidth: 0, r: 3 }}
                                        activeDot={{ r: 5, fill: color }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="ctm-empty" style={{ minHeight: '80px' }}>
                            {t('portfolio.notEnoughGoalData')}
                        </div>
                    )}
                </div>

                <div className="ctm-footer">
                    <span className="ctm-count">
                        {goal.deadline
                            ? `${t('goals.deadline')}: ${goal.deadline}`
                            : t('portfolio.noDeadlineSet')}
                    </span>
                </div>
            </div>
        </div>
    );
}
