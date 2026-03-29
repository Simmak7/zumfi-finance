import React from 'react';
import {
    RadialBarChart, RadialBar, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Target } from 'lucide-react';
import { useInspector } from '../../../context/InspectorContext';
import { EmptyState } from '../../../components/EmptyState';
import { formatMoney, formatCurrency } from '../../../utils/currencies';
import { useSettings } from '../../../context/SettingsContext';
import { useTranslation } from '../../../i18n';

const COLORS = [
    '#6366f1', '#22c55e', '#f97316', '#ec4899',
    '#06b6d4', '#a855f7', '#eab308', '#f43f5e',
];

const TOOLTIP_STYLE = {
    backgroundColor: '#1e1e2d',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '0.8rem',
};

function GoalTooltip({ active, payload }) {
    const { settings } = useSettings();
    const curr = settings?.preferred_currency || 'CZK';
    const { t } = useTranslation();
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div style={TOOLTIP_STYLE}>
            <p style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{d.name}</p>
            <p>{formatCurrency(d.current, curr)} / {formatCurrency(d.target, curr)}</p>
            <p>{Math.round(d.progress)}% {t('goals.completed')}</p>
        </div>
    );
}

export function GoalsRadialChart({ goals }) {
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    const { openInspector } = useInspector();
    const { t } = useTranslation();

    if (!goals || goals.length === 0) {
        return (
            <div className="chart-card">
                <div className="card-header-row">
                    <h3>{t('goals.title')}</h3>
                    <button
                        className="add-goal-btn"
                        onClick={() => openInspector('add-goal', {})}
                    >
                        + {t('common.add')}
                    </button>
                </div>
                <EmptyState
                    icon={Target}
                    title={t('goals.noGoals')}
                    description={t('goals.noGoalsDesc')}
                    actionLabel={t('goals.addGoal')}
                    onAction={() => openInspector('add-goal', {})}
                />
            </div>
        );
    }

    const chartData = goals.map((goal, idx) => ({
        name: goal.name,
        progress: Math.min(100, Math.round(
            (goal.current_amount / (goal.target_amount || 1)) * 100
        )),
        fill: goal.color || COLORS[idx % COLORS.length],
        current: goal.current_amount,
        target: goal.target_amount,
    }));

    return (
        <div className="chart-card">
            <div className="card-header-row">
                <h3>{t('goals.title')}</h3>
                <button
                    className="add-goal-btn"
                    onClick={() => openInspector('add-goal', {})}
                >
                    + {t('common.add')}
                </button>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(180, goals.length * 40)}>
                <RadialBarChart
                    data={chartData}
                    innerRadius="25%"
                    outerRadius="95%"
                    startAngle={90}
                    endAngle={-270}
                    barSize={12}
                >
                    <RadialBar
                        dataKey="progress"
                        background={{ fill: 'rgba(255,255,255,0.06)' }}
                        clockWise
                        cornerRadius={6}
                    />
                    <Tooltip content={<GoalTooltip />} />
                </RadialBarChart>
            </ResponsiveContainer>
            <div className="goals-legend">
                {goals.map((goal, idx) => (
                    <div
                        key={goal.id}
                        className="goal-legend-item"
                        onClick={() => openInspector('goal', goal)}
                    >
                        <span
                            className="legend-dot"
                            style={{ background: goal.color || COLORS[idx % COLORS.length] }}
                        />
                        <span className="goal-legend-name">{goal.name}</span>
                        <span className="goal-legend-amount">
                            {formatCurrency(goal.current_amount, currency)} / {formatCurrency(goal.target_amount, currency)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
