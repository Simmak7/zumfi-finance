import React, { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Target, TrendingUp, Check } from 'lucide-react';
import { getGoals } from '../../../services/api';
import { useInspector } from '../../../context/InspectorContext';
import { formatDate } from '../../../utils/dates';
import { formatCurrency } from '../../../utils/currencies';
import { useSettings } from '../../../context/SettingsContext';
import { useTranslation } from '../../../i18n';

const TOOLTIP_STYLE = {
    backgroundColor: '#1e1e2d',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '0.8rem',
    padding: '0.5rem 0.75rem',
};

function GoalRadialChart({ goal, currency }) {
    const { openInspector } = useInspector();
    const current = Number(goal.current_amount);
    const target = Number(goal.target_amount);
    const pct = target > 0 ? (current / target) * 100 : 0;
    const displayPct = Math.round(pct);
    const isOver = pct > 100;
    const isCompleted = goal.status === 'completed';
    const color = goal.color || '#fbbf24';

    // For the donut chart: show filled vs remaining
    // If over 100%, show full ring + overflow indicator
    const fillPct = Math.min(pct, 100);
    const remainPct = 100 - fillPct;

    const data = remainPct > 0
        ? [
            { name: 'Progress', value: fillPct },
            { name: 'Remaining', value: remainPct },
        ]
        : [{ name: 'Progress', value: 100 }];

    // Overflow ring data (only rendered when > 100%)
    const overflowPct = pct - 100;
    const overflowData = isOver
        ? [
            { name: 'Overflow', value: Math.min(overflowPct, 100) },
            { name: 'Base', value: Math.max(100 - overflowPct, 0) },
        ]
        : null;

    return (
        <div
            className="goal-chart-card"
            onClick={() => openInspector('goal', goal)}
        >
            <div className="goal-chart-ring-wrap">
                <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                        {/* Main progress ring */}
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={60}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                            isAnimationActive={true}
                            animationDuration={800}
                        >
                            <Cell fill={color} />
                            {remainPct > 0 && (
                                <Cell fill="rgba(255,255,255,0.06)" />
                            )}
                        </Pie>

                        {/* Overflow ring (inner, only when > 100%) */}
                        {isOver && overflowData && (
                            <Pie
                                data={overflowData}
                                cx="50%"
                                cy="50%"
                                innerRadius={38}
                                outerRadius={46}
                                startAngle={90}
                                endAngle={-270}
                                dataKey="value"
                                stroke="none"
                                isAnimationActive={true}
                                animationDuration={1000}
                            >
                                <Cell fill={color} opacity={0.5} />
                                <Cell fill="rgba(255,255,255,0.04)" />
                            </Pie>
                        )}
                    </PieChart>
                </ResponsiveContainer>

                {/* Center label */}
                <div className="goal-chart-center">
                    <span className={`goal-chart-pct ${isOver ? 'goal-over' : ''}`}>
                        {displayPct}%
                    </span>
                    {isOver && (
                        <span className="goal-chart-over-label">
                            <TrendingUp size={10} />
                            +{displayPct - 100}%
                        </span>
                    )}
                    {isCompleted && !isOver && (
                        <span className="goal-chart-done-label">
                            <Check size={10} />
                        </span>
                    )}
                </div>
            </div>

            <div className="goal-chart-info">
                <div className="goal-chart-name-row">
                    <span
                        className="goal-chart-dot"
                        style={{ background: color }}
                    />
                    <span className="goal-chart-name">{goal.name}</span>
                </div>
                <div className="goal-chart-amounts">
                    {formatCurrency(current, currency)} / {formatCurrency(target, currency)}
                </div>
                {goal.deadline && (
                    <div className="goal-chart-deadline">
                        {formatDate(goal.deadline)}
                    </div>
                )}
            </div>
        </div>
    );
}

export function SavingsGoalsChart() {
    const [goals, setGoals] = useState([]);
    const { settings } = useSettings();
    const { t } = useTranslation();
    const currency = settings?.preferred_currency || 'CZK';

    const fetchGoals = async () => {
        try {
            const data = await getGoals();
            setGoals(data);
        } catch (err) {
            console.error('Error fetching goals:', err);
        }
    };

    useEffect(() => {
        fetchGoals();
        const handleUpdate = () => fetchGoals();
        window.addEventListener('goals-updated', handleUpdate);
        return () => window.removeEventListener('goals-updated', handleUpdate);
    }, []);

    if (goals.length === 0) return null;

    // Sort: active first (by progress desc), then completed
    const sorted = [...goals].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        const pctA = Number(a.target_amount) > 0
            ? Number(a.current_amount) / Number(a.target_amount)
            : 0;
        const pctB = Number(b.target_amount) > 0
            ? Number(b.current_amount) / Number(b.target_amount)
            : 0;
        return pctB - pctA;
    });

    return (
        <div className="chart-card" style={{ marginTop: '2rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Target size={18} />
                {t('portfolio.goalProgress')}
                <span className="section-count">{goals.length}</span>
            </h3>
            <div className="goal-charts-grid">
                {sorted.map(goal => (
                    <GoalRadialChart key={goal.id} goal={goal} currency={currency} />
                ))}
            </div>
        </div>
    );
}
