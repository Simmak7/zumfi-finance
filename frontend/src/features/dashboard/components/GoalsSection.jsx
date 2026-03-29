import { useInspector } from '../../../context/InspectorContext';
import { formatCurrency } from '../../../utils/currencies';
import { useSettings } from '../../../context/SettingsContext';
import { useTranslation } from '../../../i18n';

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

export function GoalsSection({ goals }) {
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    const { openInspector } = useInspector();
    const { t } = useTranslation();

    return (
        <div className="chart-card goals-card wide">
            <div className="card-header-row">
                <h3>{t('goals.title')}</h3>
                <button
                    className="add-goal-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        openInspector('add-goal', {});
                    }}
                >
                    + {t('common.add')}
                </button>
            </div>
            <div className="goals-list horizontal-scroll">
                {goals.length === 0 ? (
                    <div className="empty-state-card">
                        <p>{t('goals.noGoalsHint')}</p>
                    </div>
                ) : (
                    goals.map((goal, idx) => (
                        <div
                            key={goal.id}
                            className="goal-item interactive"
                            onClick={() => openInspector('goal', goal)}
                        >
                            <div className="goal-header">
                                <span>{goal.name}</span>
                                <span>{formatCurrency(goal.current_amount, currency)}</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div
                                    className="progress-bar-fill"
                                    style={{
                                        width: `${Math.min(100, (goal.current_amount / (goal.target_amount || 1)) * 100)}%`,
                                        background: goal.color || COLORS[idx % COLORS.length],
                                    }}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
