import React, { useState, useEffect } from 'react';
import { Target, Check, Pencil, BarChart2, TrendingUp, TrendingDown, Minus, Plus } from 'lucide-react';
import { getGoalsWithDeltas } from '../../../services/api';
import { formatDate } from '../../../utils/dates';
import { formatCurrency } from '../../../utils/currencies';
import { useSettings } from '../../../context/SettingsContext';
import { GoalDevelopmentModal } from './GoalDevelopmentModal';
import { GoalEditorModal } from './GoalEditorModal';
import { useTranslation } from '../../../i18n';

export function SavingsGoalsList({ fullWidth }) {
    const [goals, setGoals] = useState([]);
    const [chartGoal, setChartGoal] = useState(null);
    const [editGoal, setEditGoal] = useState(null);
    const [showAddGoal, setShowAddGoal] = useState(false);
    const { settings } = useSettings();
    const { t } = useTranslation();
    const currency = settings?.preferred_currency || 'CZK';

    const fetchGoals = async () => {
        try {
            const data = await getGoalsWithDeltas();
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

    return (
        <div className={`portfolio-section ${fullWidth ? 'portfolio-section-full' : ''}`} style={{ marginTop: '2rem' }}>
            <h2 className="section-title">
                <Target size={20} />
                {t('portfolio.savingsGoals')}
                <span className="section-count">{goals.length}</span>
                <button
                    className="section-add-btn"
                    onClick={() => setShowAddGoal(true)}
                    style={{ borderColor: 'rgba(251, 191, 36, 0.25)', background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}
                >
                    <Plus size={12} />
                    <span>{t('portfolio.addGoalBtn')}</span>
                </button>
            </h2>

            {goals.length === 0 ? (
                <div className="portfolio-empty">
                    <Target size={32} />
                    <p>{t('goals.noGoals')}</p>
                    <p className="empty-hint">{t('goals.noGoalsHint')}</p>
                </div>
            ) : (
                <div className="portfolio-cards">
                    {goals.map(goal => {
                        const current = Number(goal.current_amount);
                        const target = Number(goal.target_amount);
                        const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
                        const isCompleted = goal.status === 'completed';

                        const prevAmount = goal.previous_amount;
                        const delta = prevAmount != null ? current - prevAmount : null;

                        return (
                            <div
                                key={goal.id}
                                className="portfolio-card goal-card"
                            >
                                <div className="card-top-row">
                                    <div
                                        className="card-color-dot"
                                        style={{ background: goal.color || '#fbbf24' }}
                                    />
                                    <span className="card-name">{goal.name}</span>
                                    {isCompleted && (
                                        <span className="type-badge goal-done-badge">
                                            <Check size={12} /> {t('goals.done')}
                                        </span>
                                    )}
                                    <button
                                        className="goal-edit-btn"
                                        onClick={(e) => { e.stopPropagation(); setChartGoal(goal); }}
                                        title={t('goals.viewDevelopment')}
                                    >
                                        <BarChart2 size={14} />
                                    </button>
                                    <button
                                        className="goal-edit-btn"
                                        onClick={(e) => { e.stopPropagation(); setEditGoal(goal); }}
                                        title={t('goals.editGoal')}
                                    >
                                        <Pencil size={14} />
                                    </button>
                                </div>

                                <div className="goal-progress-wrap">
                                    <div className="goal-progress-bar">
                                        <div
                                            className="goal-progress-fill"
                                            style={{
                                                width: `${pct}%`,
                                                background: goal.color || '#fbbf24',
                                            }}
                                        />
                                    </div>
                                    <span className="goal-progress-label">{pct}%</span>
                                </div>

                                <div className="card-balance">
                                    {formatCurrency(current, currency)} / {formatCurrency(target, currency)}
                                </div>

                                {delta != null && delta !== 0 && (
                                    <div className={`goal-delta ${delta > 0 ? 'positive' : 'negative'}`}>
                                        {delta > 0
                                            ? <TrendingUp size={12} />
                                            : <TrendingDown size={12} />}
                                        <span>
                                            {t('goals.vsLastMonth', { amount: `${delta > 0 ? '+' : ''}${formatCurrency(delta, currency)}` })}
                                        </span>
                                    </div>
                                )}
                                {delta === 0 && (
                                    <div className="goal-delta neutral">
                                        <Minus size={12} />
                                        <span>{t('goals.noChangeVsLastMonth')}</span>
                                    </div>
                                )}

                                {goal.deadline && (
                                    <div className="card-meta">
                                        <span>{t('goals.deadline')}: {formatDate(goal.deadline)}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {chartGoal && (
                <GoalDevelopmentModal
                    goal={chartGoal}
                    onClose={() => setChartGoal(null)}
                />
            )}

            {editGoal && (
                <GoalEditorModal
                    goal={editGoal}
                    onClose={() => setEditGoal(null)}
                />
            )}

            {showAddGoal && (
                <GoalEditorModal
                    goal={null}
                    onClose={() => setShowAddGoal(false)}
                />
            )}
        </div>
    );
}
